import * as Tone from "tone";
import { getSoundedBeats, parseNote, type TupletSpec } from "./rhythmParser";

export type PreviewSound = "default" | "piano" | "woodblock";

export const SOUND_OPTIONS: { id: PreviewSound; name: string }[] = [
    { id: "default", name: "Standaard" },
    { id: "piano", name: "Piano" },
    { id: "woodblock", name: "Woodblock" },
];

// The part only ever attacks and releases notes, so the voices are typed by
// that narrow contract instead of their concrete Tone classes.
type PreviewSynth = {
    triggerAttackRelease(note: string, duration: number, time: number): void;
};

const previewSynths: Record<PreviewSound, PreviewSynth | null> = {
    default: null,
    piano: null,
    woodblock: null,
};
let currentPart: Tone.Part | null = null;

/** The tempo slider is in quarter notes per minute, so every length below is
 * measured in quarter notes and scaled by that. */
const beatDuration = (tempo: number) => 60 / tempo;

/** The unchanged default voice: a smooth FM tone. */
function createDefaultSynth(): PreviewSynth {
    return new Tone.FMSynth({
        harmonicity: 3, // Adds complexity to the tone
        modulationIndex: 10,
        oscillator: { type: "sine" }, // Smooth base
        envelope: {
            attack: 0.005,  // Instant "hit" of the hammer
            decay: 1.5,    // Long decay like a real string
            sustain: 0.1,  // Volume drops almost to zero if held
            release: 0.1    // Natural fade
        },
        modulation: { type: "sawtooth" },
        modulationEnvelope: {
            attack: 0.002,
            decay: 0.2,
            sustain: 0.1,
            release: 0.2
        }
    }).toDestination();
}

/** A piano-like voice: a triangle wave through a lowpass whose brightness fades
 * as the note rings, with a fast hammer attack and a long decay down to almost
 * nothing. Polyphonic so overlapping notes never choke each other. */
function createPianoSynth(): PreviewSynth {
    const piano = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "triangle" },
        filter: { Q: 0.5, type: "lowpass", rolloff: -24 },
        envelope: {
            attack: 0.002,
            decay: 2.5,
            sustain: 0.05,
            release: 1.2,
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.35,
            sustain: 0.4,
            baseFrequency: 400,
            octaves: 2.5,
        },
    }).toDestination();
    piano.volume.value = -10;
    return piano;
}

/** A short woody "tok": a sine pitch drop with almost no sustain. */
function createWoodblockSynth(): PreviewSynth {
    return new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 3,
        oscillator: { type: "sine" },
        envelope: {
            attack: 0.001,
            decay: 0.22,
            sustain: 0,
            release: 0.05,
        },
    }).toDestination();
}

export async function playRhythmPreview(easyScore: string, tempo: number, tuplets: TupletSpec[] = [], sound: PreviewSound = "default") {
    try {
        if (Tone.getContext().state !== "running") {
            await Tone.start();
        }

        // Browsers only allow the audio context to start inside a real user
        // gesture. If it is still not running here the play button was not
        // reached by a gesture (or the tab is muted), and nothing will be
        // audible, so say so instead of failing silently.
        if (Tone.getContext().state !== "running") {
            console.warn(
                "[audio] context is " + Tone.getContext().state + ", so this preview is silent. " +
                "A browser blocks audio outside a user gesture; check the tab and system volume."
            );
            return;
        }

        if (!previewSynths[sound]) {
            previewSynths[sound] =
                sound === "woodblock"
                    ? createWoodblockSynth()
                    : sound === "piano"
                        ? createPianoSynth()
                        : createDefaultSynth();
            Tone.getContext().lookAhead = 0.05;
        }
        const previewSynth = previewSynths[sound]!;

        if (currentPart) {
            currentPart.stop();
            currentPart.dispose();
        }

        const transport = Tone.getTransport();
        transport.stop();
        transport.cancel();

        const quarter = beatDuration(tempo);

        // Lengths come from the shared EasyScore parser rather than a hand-written
        // table, so every spelling the app can produce is timed correctly. The old
        // table only knew w/h/q/8/8./16, so "q." and "4." silently fell back to a
        // plain quarter and dotted quarters played a third too fast, while the
        // rest check "parts[2] === 'r'" missed dotted rests like "B4/8/r.".
        // getSoundedBeats also applies any tuplet's ratio, so a 3:2 group of three
        // eighths is played in the time of two instead of taking a beat and a half.
        const notes = easyScore.split(",").map(n => n.trim()).filter(n => n !== "");
        let currentOffset = 0;
        // A woodblock sits higher than the default tone so the clicks cut
        // through instead of humming underneath the beat.
        const eventNote = sound === "woodblock" ? "G5" : "C5";

        const partEvents = notes.map((noteStr, index) => {
            const parsed = parseNote(noteStr);
            const durationSec = getSoundedBeats(noteStr, index, tuplets) * quarter;

            if (!parsed) {
                console.warn('[audio] could not parse note token "' + noteStr + '", skipping it');
            }

            const event = {
                time: currentOffset,
                note: eventNote,
                // An unparsable token must not shift everything after it.
                duration: durationSec > 0 ? durationSec : quarter,
                isRest: parsed ? parsed.isRest : false,
            };

            currentOffset += event.duration;
            return event;
        });

        if (!partEvents.length) return;

        currentPart = new Tone.Part((time, value) => {
            // Only trigger sound if the event is not a rest
            if (!value.isRest) {
                // Multiply duration by 0.85 to create a slight "gap" between notes
                previewSynth!.triggerAttackRelease(value.note, value.duration * 0.85, time);
            }
        }, partEvents);

        currentPart.start(0);
        transport.start("+0.05");
    } catch (error) {
        // Called straight from an onClick, so without this any failure is an
        // unhandled rejection and the user just sees nothing happen.
        console.error("[audio] playback failed", error);
    }
}
