"use client";
import { useEffect, useId, useRef } from "react";
import { Factory, Beam } from "vexflow";

interface MiniNotationProps {
    timeSignature: string;
    notes: string;
}

export default function MiniNotation({ timeSignature, notes }: MiniNotationProps) {
    const containerRef = useRef<HTMLDivElement>(null!);
    const rawId = useId();
    const uniqueId = `vexflow-${rawId.replace(/:/g, "")}`;

    // 1. Split by '|'
    // 2. Clean leading/trailing spaces AND commas from each chunk
    // 3. Drop completely empty chunks to prevent VexFlow formatter crashes
    const measures = notes
        ? notes.split('|')
            .map(m => m.trim().replace(/^,+|,+$/g, '').trim())
            .filter(m => m !== '')
        : [];

    const numBars = Math.max(1, measures.length);
    const dynamicWidth = 40 + 140 + ((numBars - 1) * 110);

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";

        const vf = new Factory({
            renderer: {
                elementId: uniqueId,
                width: dynamicWidth,
                height: 120
            }
        });

        const score = vf.EasyScore();
        let xOffset = 10;
        const allBeams: Beam[] = [];

        try {
            // Handle completely empty initial state
            if (measures.length === 0) {
                const system = vf.System({ x: xOffset, y: 20, width: 140 });
                system.addStave({ voices: [] }).addTimeSignature(timeSignature);
                vf.draw();
                return;
            }

            // Loop through each valid measure chunk
            measures.forEach((cleanNotes, i) => {
                const isFirst = i === 0;
                const measureWidth = isFirst ? 160 : 110; // First measure needs room for time signature

                const system = vf.System({
                    x: xOffset,
                    y: 20,
                    width: measureWidth,
                });

                const vexNotes = score.notes(cleanNotes);

                // setStrict(false) allows incomplete measures without crashing
                const voice = score.voice(vexNotes, { time: timeSignature }).setStrict(false);

                const stave = system.addStave({ voices: [voice] });
                if (isFirst) stave.addTimeSignature(timeSignature);

                // Collect notes that need beams
                const stemmables = vexNotes.filter(n => typeof (n as any).hasStem === 'function' && (n as any).hasStem());
                allBeams.push(...Beam.generateBeams(stemmables));

                xOffset += measureWidth;
            });

            // Draw the main elements
            vf.draw();

            // Beams must be drawn *after* the factory draws the rest of the system
            allBeams.forEach(b => b.setContext(vf.getContext()).draw());

        } catch (error) {
            console.error("Failed to render VexFlow EasyScore:", error);
        }
    }, [timeSignature, notes, dynamicWidth, uniqueId]);

    return (
        <div
            id={uniqueId}
            ref={containerRef}
            className="pointer-events-none h-[120px] transition-all duration-300"
            style={{ width: `${dynamicWidth}px` }}
        />
    );
}
