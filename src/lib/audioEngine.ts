import * as Tone from "tone";
import { getSoundedBeats, parseNote, type TupletSpec } from "./rhythmParser";

let previewSynth: Tone.FMSynth | null = null;
let currentPart: Tone.Part | null = null;

/** The tempo slider is in quarter notes per minute, so every length below is
 * measured in quarter notes and scaled by that. */
const beatDuration = (tempo: number) => 60 / tempo;

export async function playRhythmPreview(easyScore: string, tempo: number, tuplets: TupletSpec[] = []) {
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

        if (!previewSynth) {
            previewSynth = new Tone.FMSynth({
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
            Tone.getContext().lookAhead = 0.05;
        }

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

        const partEvents = notes.map((noteStr, index) => {
            const parsed = parseNote(noteStr);
            const durationSec = getSoundedBeats(noteStr, index, tuplets) * quarter;

            if (!parsed) {
                console.warn('[audio] could not parse note token "' + noteStr + '", skipping it');
            }

            const event = {
                time: currentOffset,
                note: "C5",
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
