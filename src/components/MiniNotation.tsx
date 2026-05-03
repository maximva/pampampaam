"use client";
import { useEffect, useRef } from "react";
import { Factory, Beam } from "vexflow";

interface MiniNotationProps {
    timeSignature: string;
    notes: string;
}

export default function MiniNotation({ timeSignature, notes }: MiniNotationProps) {
    const containerRef = useRef<HTMLDivElement>(null!);

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = ""; // Clear on re-render

        const vf = new Factory({
            renderer: {
                elementId: "vexflow-container",
                width: 220,
                height: 120
            }
        });

        const score = vf.EasyScore();
        const system = vf.System({ x: 10, y: 20, width: 200 });

        try {
            if (!notes || notes.trim() === "") {
                system.addStave({ voices: [] }).addTimeSignature(timeSignature);
                vf.draw();
                return;
            }

            const vexNotes = score.notes(notes);
            const voice = score.voice(vexNotes, { time: timeSignature }).setStrict(false);

            system.addStave({
                voices: [voice]
            }).addTimeSignature(timeSignature);

            // --- THE FIX ---
            // 1. Generate beams BEFORE drawing the factory.
            // This tells the underlying notes to hide their individual flags!
            const beams = Beam.generateBeams(vexNotes);

            // 2. Draw the system (the notes will now render perfectly without flags)
            vf.draw();

            // 3. Finally, draw the beams we calculated
            beams.forEach((b) => b.setContext(vf.getContext()).draw());

        } catch (error) {
            console.error("Failed to render VexFlow EasyScore:", error);
        }
    }, [timeSignature, notes]);

    return <div ref={containerRef} className="pointer-events-none w-[220px] h-[120px]" />;
}
