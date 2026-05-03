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
                sustain: 0.1,   // Holds the tone at 10% volume for the duration
                release: 0.2    // Takes 0.2s to smoothly fade out after the note ends
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
        "8.": beatDuration * 0.75, // Added this to support your dotted eighth note!
        "8": beatDuration / 2,
        "16": beatDuration / 4,
    };

    const notes = easyScore.split(",").map(n => n.trim()).filter(n => n !== "");
    let currentOffset = 0;

    const partEvents = notes.map(noteStr => {
        // VexFlow format is typically "Pitch/Duration/Type" (e.g., "B4/q/r")
        const parts = noteStr.split("/");
        const durationRaw = parts[1];

        // If there's a third element and it's "r", mark it as a rest
        const isRest = parts.length > 2 && parts[2] === "r";

        const durationSec = durationMap[durationRaw] || beatDuration;

        const event = {
            time: currentOffset,
            note: "C5",
            duration: durationSec,
            isRest: isRest
        };

        currentOffset += durationSec;
        return event;
    });

    currentPart = new Tone.Part((time, value) => {
        // Only trigger sound if the event is not a rest
        if (!value.isRest) {
            // Multiply duration by 0.85 to create a slight "gap" between notes
            previewSynth!.triggerAttackRelease(value.note, value.duration * 0.85, time);
        }
    }, partEvents);

    currentPart.start(0);
    transport.start("+0.05");
}
