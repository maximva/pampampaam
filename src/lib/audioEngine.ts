import * as Tone from "tone";

let previewSynth: Tone.Synth | null = null;
let currentPart: Tone.Part | null = null;

export async function playRhythmPreview(easyScore: string, tempo: number) {
    if (Tone.getContext().state !== "running") {
        await Tone.start();
    }

    if (!previewSynth) {
        previewSynth = new Tone.Synth({
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.005,  // Sharp percussive hit at the start
                decay: 0.1,     // Initial volume drops slightly
                sustain: 0.1,   // SUSTAIN: 0.3 (Holds the tone at 30% volume for the duration)
                release: 0.2    // RELEASE: 0.4 (Takes 0.4s to smoothly fade out after the note ends)
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

    const beatDuration = 60 / tempo;
    const durationMap: Record<string, number> = {
        w: beatDuration * 4,
        h: beatDuration * 2,
        q: beatDuration,
        "8": beatDuration / 2,
        "16": beatDuration / 4,
    };

    const notes = easyScore.split(",").map(n => n.trim());
    let currentOffset = 0;

    const partEvents = notes.map(noteStr => {
        const [, durationRaw] = noteStr.split("/");
        const durationSec = durationMap[durationRaw] || beatDuration;

        // Add the calculated durationSec to the event object
        const event = { time: currentOffset, note: "C5", duration: durationSec };

        currentOffset += durationSec;
        return event;
    });

    currentPart = new Tone.Part((time, value) => {
        // --- THE FIX ---
        // 1. Pass value.duration instead of "32n"
        // 2. Multiply duration by 0.85 to create a slight "gap" between notes (articulation),
        //    allowing the release tail to be heard clearly before the next note hits.
        previewSynth!.triggerAttackRelease(value.note, value.duration * 0.85, time);
    }, partEvents);

    currentPart.start(0);
    transport.start("+0.05");
}
