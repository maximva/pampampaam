"use client";
import { useEffect, useId, useRef } from "react";
import { Factory, Beam } from "vexflow";
import type { TupletSpec } from "@/lib/rhythmParser";

interface MiniNotationProps {
    timeSignature: string;
    notes: string;
    /** Optional tuplets, indexed over the notes of this score. */
    tuplets?: TupletSpec[];
}

// 1. Split by '|'
// 2. Clean leading/trailing spaces AND commas from each chunk
// 3. Drop completely empty chunks to prevent VexFlow formatter crashes
const splitMeasures = (notes: string) =>
    notes
        ? notes.split('|')
            .map(m => m.trim().replace(/^,+|,+$/g, '').trim())
            .filter(m => m !== '')
        : [];

export default function MiniNotation({ timeSignature, notes, tuplets }: MiniNotationProps) {
    const containerRef = useRef<HTMLDivElement>(null!);
    const rawId = useId();
    const uniqueId = `vexflow-${rawId.replace(/:/g, "")}`;

    const numBars = Math.max(1, splitMeasures(notes).length);
    const dynamicWidth = 40 + 140 + ((numBars - 1) * 110);

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";

        const measures = splitMeasures(notes);

        const vf = new Factory({
            renderer: {
                elementId: uniqueId,
                width: dynamicWidth,
                height: 120,
            }
        });

        const score = vf.EasyScore();
        let xOffset = 10;
        // Tuplet start indices are counted over every note of the score, so the
        // running position has to carry across the bar lines.
        let noteOffset = 0;
        const allBeams: Beam[] = [];

        // Beat structure comes from the time signature: VexFlow's implicit
        // default is groups of 2/8, which beams 6/8 as 3 groups of 2. Asking for
        // the signature's own groups yields 3/8 for 6/8, i.e. 2 groups of 3.
        const beamGroups = Beam.getDefaultBeamGroups(timeSignature);

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

                // Hand every tuplet that overlaps this bar to VexFlow's own
                // Tuplet, passing the ratio through untouched. VexFlow rescales the
                // notes' ticks itself (setTuplet -> applyTickMultiplier), so the
                // voice below and the bar lines see the tuplet's real duration:
                // three eighths in a 3:2 tuplet measure one beat, not one and a
                // half, and no duration maths is needed here.
                const tupletGroups: (typeof vexNotes)[] = [];
                (tuplets ?? []).forEach(({ start, numNotes, notesOccupied }) => {
                    const from = Math.max(start - noteOffset, 0);
                    const to = Math.min(start + numNotes - noteOffset, vexNotes.length);
                    if (to <= from) return;
                    const group = vexNotes.slice(from, to);
                    score.tuplet(group, { numNotes, notesOccupied });
                    tupletGroups.push(group);
                });

                // setStrict(false) allows incomplete measures without crashing
                const voice = score.voice(vexNotes, { time: timeSignature }).setStrict(false);

                const stave = system.addStave({ voices: [voice] });
                if (isFirst) stave.addTimeSignature(timeSignature);

                // A tuplet's notes are beamed as their own group, so they are kept
                // out of the meter's beat beams: a note can only carry one beam,
                // and the tuplet's notes span one beat regardless of how many there are.
                const inTuplet = new Set(tupletGroups.flat());
                const stemmables = vexNotes.filter(n => n.hasStem() && !inTuplet.has(n));
                allBeams.push(...Beam.generateBeams(stemmables, { groups: beamGroups }));
                for (const group of tupletGroups) {
                    const beamable = group.filter(n => n.hasStem());
                    if (beamable.length > 1) {
                        allBeams.push(...Beam.generateBeams(beamable, { groups: beamGroups }));
                    }
                }

                noteOffset += vexNotes.length;
                xOffset += measureWidth;
            });

            // Draw the main elements
            vf.draw();

            // Beams must be drawn *after* the factory draws the rest of the system
            allBeams.forEach(b => b.setContext(vf.getContext()).draw());

        } catch (error) {
            console.error("Failed to render VexFlow EasyScore:", error);
        }
    }, [timeSignature, notes, tuplets, dynamicWidth, uniqueId]);

    return (
        <div
            id={uniqueId}
            ref={containerRef}
            className="pointer-events-none h-[120px] transition-all duration-300"
            style={{ width: `${dynamicWidth}px` }}
        />
    );
}
