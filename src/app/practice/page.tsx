"use client";
import { useSearchParams, useRouter } from "next/navigation";
import {Suspense, useState, useMemo, useEffect, useId, useRef, ReactNode} from "react";
import { Factory, BarlineType, Beam, Fraction } from "vexflow";
import { RHYTHM_PRESETS } from "@/lib/rhythmData";
import { playRhythmPreview } from "@/lib/audioEngine";
import { EPSILON, getMeasureBeats, getNotes, getScoreBeats, type TupletSpec } from "@/lib/rhythmParser";
import MiniNotation from "@/components/MiniNotation";

// One tap of the palette adds one of these to the answer. A single option is one
// note or one rest. A combined option adds several notes that together fill one
// beat and are drawn beamed as a unit, so they read as a single cell instead of
// separate taps. A tuplet additionally carries the ratio, which is what makes
// three eighths last one beat rather than one and a half.
type PaletteOption = {
    id: string;
    notes: string[];
    tuplet?: TupletSpec;
};

// Dots follow the rest marker ("B4/8/r."), matching the EasyScore grammar.
// Longest to shortest within each group.
const NOTE_SELECT_OPTIONS: PaletteOption[] = [
    { id: "w", notes: ["G4/w"] },
    { id: "h.", notes: ["G4/h."] },
    { id: "h", notes: ["G4/h"] },
    { id: "q.", notes: ["G4/q."] },
    { id: "q", notes: ["G4/q"] },
    { id: "8.", notes: ["G4/8."] },
    { id: "8", notes: ["G4/8"] },
    { id: "16", notes: ["G4/16"] },
    { id: "hr", notes: ["B4/h/r"] },
    { id: "qr", notes: ["B4/q/r"] },
    { id: "8r.", notes: ["B4/8/r."] },
    { id: "8r", notes: ["B4/8/r"] },
    { id: "16r", notes: ["B4/16/r"] },
    // Three in the time of two: three eighths fill one beat.
    { id: "8t", notes: ["G4/8", "G4/8", "G4/8"], tuplet: { start: 0, numNotes: 3, notesOccupied: 2 } },
    // Also one beat each: two eighths, an eighth plus two sixteenths, four
    // sixteenths. Beamed as a unit so the cell reads as one thing.
    { id: "2x8", notes: ["G4/8", "G4/8"] },
    { id: "8+16x2", notes: ["G4/8", "G4/16", "G4/16"] },
    { id: "4x16", notes: ["G4/16", "G4/16", "G4/16", "G4/16"] },
];

function NoteButtonIcon({ option }: { option: PaletteOption }) {
    const containerRef = useRef<HTMLDivElement>(null!);
    const rawId = useId();
    const uniqueId = `vex-btn-${rawId.replace(/:/g, "")}`;
    const score = option.notes.join(", ");
    const isCombined = option.notes.length > 1;
    const isTuplet = option.tuplet !== undefined;
    // Pulled out as plain values so the effect depends on the ratio itself rather
    // than on the object identity of option.tuplet.
    const tupletNumNotes = option.tuplet?.numNotes;
    const tupletNotesOccupied = option.tuplet?.notesOccupied;

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";

        // A tuplet draws its bracket and the "3" above the stave, so that button
        // gets a taller canvas with the stave lower down to leave room for it.
        const vf = new Factory({
            renderer: {
                elementId: uniqueId,
                width: isCombined ? 104 : 80,
                height: isTuplet ? 100 : 80,
            }
        });

        const easyScore = vf.EasyScore();

        // 1. noConnector: true tells the System to stop generating the right-side connector!
        const system = vf.System({
            x: 12,
            y: isTuplet ? 2 : -18,
            width: isTuplet ? 72 : isCombined ? 80 : 56,
        });

        try {
            const vexNotes = easyScore.notes(score);
            // Hand the group to VexFlow's own Tuplet, exactly as MiniNotation does,
            // so the button shows the same triplet the answer will be drawn with.
            if (tupletNumNotes !== undefined && tupletNotesOccupied !== undefined) {
                easyScore.tuplet(vexNotes, {
                    numNotes: tupletNumNotes,
                    notesOccupied: tupletNotesOccupied,
                });
            }
            const voice = easyScore.voice(vexNotes, { time: "4/4" }).setStrict(false);
            const stave = system.addStave({ voices: [voice] });
            (stave as any).options.num_lines = 0;

            stave.setBegBarType(BarlineType.NONE);
            stave.setEndBarType(BarlineType.NONE);

            // A combined cell is beamed as one unit so the button shows a single
            // group. Without this the eighth and the two sixteenths of the
            // 8+16+16 cell would sit apart and read as separate cells.
            const cellBeams: Beam[] = [];
            if (isCombined) {
                const beamable = vexNotes.filter(n => n.hasStem());
                if (beamable.length > 1) {
                    // One group spanning the whole cell. VexFlow 5 takes the beam
                    // groups as a flat list of beat boundaries, so a single boundary
                    // at beat 1 beams every note of the cell together.
                    cellBeams.push(...Beam.generateBeams(beamable, { groups: [new Fraction(1, 4)] }));
                }
            }

            vf.draw();

            // Beams can only be drawn once the factory has drawn the notes, since
            // they need the tick contexts to position themselves.
            cellBeams.forEach(b => b.setContext(vf.getContext()).draw());
        } catch (error) {
            console.error("Failed to render button icon:", error);
        }
    }, [score, isCombined, isTuplet, tupletNumNotes, tupletNotesOccupied, uniqueId]);

    // A combined cell draws more noteheads than a single note, so it is scaled down
    // further to fit them without crowding inside compact buttons.
    const scale = isTuplet
        ? "scale-[0.48] sm:scale-[0.52] md:scale-[0.56]"
        : isCombined
        ? "scale-[0.52] sm:scale-[0.58] md:scale-[0.62]"
        : "scale-[0.55] sm:scale-[0.62] md:scale-[0.68]";

    return (
        <div
            id={uniqueId}
            ref={containerRef}
            className={`pointer-events-none flex items-center justify-center transform ${scale}`}
        />
    );
}


function PaletteButton({
    option,
    isSelected,
    onSelect,
}: {
    option: PaletteOption;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const isCombined = option.notes.length > 1;

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={onSelect}
                aria-label={`Voeg ${option.id} toe`}
                className={`${
                    isCombined ? "w-16 sm:w-18 md:w-20 h-10 sm:h-11 md:h-12" : "w-10 sm:w-11 md:w-12 h-10 sm:h-11 md:h-12"
                } bg-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xs transition-all overflow-hidden border border-[#DDE2E5] hover:border-[#CED4DA] active:scale-95 cursor-pointer`}
            >
                <NoteButtonIcon option={option} />
            </button>
            {isSelected && (
                <div className="absolute -inset-0.5 sm:-inset-1 border-2 sm:border-3 border-[#5C7CFA] rounded-xl sm:rounded-2xl pointer-events-none"></div>
            )}
        </div>
    );
}


function PracticeArea() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tempo = parseInt(searchParams.get("tempo") || "65", 10);
    const timeSignature = searchParams.get("ts") || "2/4";
    const rhythmsParam = searchParams.get("rhythms");
    const rhythmIds = rhythmsParam ? rhythmsParam.split(",") : [];
    const suffix = searchParams.get("suffix") || ""; // Get suffix

    const activeTasks = useMemo(() => {
        return rhythmIds
            .map(id => RHYTHM_PRESETS.find(r => r.id === id))
            .filter((r): r is typeof RHYTHM_PRESETS[0] => r !== undefined);
    }, [rhythmIds]);

    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState<string[]>([]);
    // Tuplets the student has entered, so the answer is drawn and measured the way
    // the target is. Indices count notes only, not the '|' bar separators.
    const [answerTuplets, setAnswerTuplets] = useState<TupletSpec[]>([]);
    const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");
    const [selectedDuration, setSelectedDuration] = useState<string>("q");

    const currentTask = activeTasks[currentTaskIndex];

    const targetScore = useMemo(() => {
        if (!currentTask) return "";
        return suffix ? `${currentTask.easyScore}, |, ${suffix}` : currentTask.easyScore;
    }, [currentTask, suffix]);

    const playableScore = useMemo(() => {
        if (!currentTask) return "";
        return suffix ? `${currentTask.easyScore}, ${suffix}` : currentTask.easyScore;
    }, [currentTask, suffix]);

    // Only offer notes that fit inside one measure of the selected meter, so a
    // whole note is not offered in 2/4 and a half note is not offered in 3/8. A
    // tuplet is measured as it sounds, so three eighths count as one beat and
    // stay available in 2/4.
    const availableNoteOptions = useMemo(() => {
        const measureBeats = getMeasureBeats(timeSignature);
        return NOTE_SELECT_OPTIONS.filter(
            option => getScoreBeats(option.notes.join(", "), option.tuplet ? [option.tuplet] : []) <= measureBeats + EPSILON
        );
    }, [timeSignature]);

    // Three separate boxes: plain notes, rests, and combined cells that add more
    // than one note at a time. A combined cell is not a neighbour of a single
    // note, so mixing them in one row made the triplet easy to miss.
    const noteOptions = useMemo(
        () => availableNoteOptions.filter(o => !o.tuplet && o.notes.length === 1 && !o.notes[0].includes("/r")),
        [availableNoteOptions]
    );
    const restOptions = useMemo(
        () => availableNoteOptions.filter(o => !o.tuplet && o.notes.length === 1 && o.notes[0].includes("/r")),
        [availableNoteOptions]
    );
    const combinedOptions = useMemo(
        () => availableNoteOptions.filter(o => o.notes.length > 1),
        [availableNoteOptions]
    );

    if (!currentTask) {
        return <div className="p-8 text-center">Geen ritmes geselecteerd.</div>;
    }

    const answerString = userAnswer.join(", ");

    const handleAddNote = (option: PaletteOption) => {
        // The tuplet's index is counted over notes, and bar separators are not
        // notes, so they do not shift it.
        const startIndex = userAnswer.filter(n => n !== "|").length;

        setUserAnswer(prev => {
            // Measured as it sounds, so an entered triplet counts as the one beat it
            // takes rather than the one and a half its written noteheads suggest.
            const filledBeats = getScoreBeats(prev.join(", "), answerTuplets);
            const measureBeats = getMeasureBeats(timeSignature);
            const remainder = filledBeats % measureBeats;
            const measureIsFull = filledBeats > 0
                && (Math.abs(remainder) < EPSILON || Math.abs(remainder - measureBeats) < EPSILON);

            if (measureIsFull) {
                return [...prev, "|", ...option.notes];
            }

            return [...prev, ...option.notes];
        });

        // Drop any tuplet the new one would overlap. Two triplets cannot share a
        // note, and the meter filter already keeps them from filling a bar between
        // them, so this only guards the edge case of two triplets in one beat.
        setAnswerTuplets(prev => {
            const kept = prev.filter(t => t.start + t.numNotes <= startIndex);
            return option.tuplet ? [...kept, { ...option.tuplet, start: startIndex }] : kept;
        });

        setFeedback("idle");
    };

    const handleUndo = () => {
        if (userAnswer.length === 0) return;

        const trimmed = userAnswer[userAnswer.length - 1] === '|'
            ? userAnswer.slice(0, -2)
            : userAnswer.slice(0, -1);
        setUserAnswer(trimmed);

        // Undoing into a tuplet removes it; undoing past its last note drops it.
        // A tuplet whose notes are gone must not linger in the answer notation.
        const noteCount = trimmed.filter(n => n !== "|").length;
        setAnswerTuplets(prev => prev.filter(t => t.start + t.numNotes <= noteCount));

        setFeedback("idle");
    };

    const handleClear = () => {
        setUserAnswer([]);
        setAnswerTuplets([]);
        setFeedback("idle");
    };

    const checkAnswer = () => {
        const target = getNotes(targetScore);
        const user = getNotes(answerString);
        const notesMatch = target.length === user.length && target.every((note, i) => note === user[i]);
        // The same noteheads read as a triplet or as a plain group, and those are
        // not the same rhythm: three plain eighths last one and a half beats while
        // a triplet of them lasts one. So the sounded length has to agree as well,
        // which is what makes an entered triplet count as the beat it fills.
        const sameLength = Math.abs(
            getScoreBeats(targetScore, currentTask.tuplets) - getScoreBeats(answerString, answerTuplets)
        ) < EPSILON;

        setFeedback(notesMatch && sameLength ? "correct" : "incorrect");
    };

    const nextTask = () => {
        setUserAnswer([]);
        setAnswerTuplets([]);
        setFeedback("idle");
        if (currentTaskIndex < activeTasks.length - 1) {
            setCurrentTaskIndex(prev => prev + 1);
        } else {
            router.push("/");
        }
    };

    return (
        <div className="h-dvh max-h-dvh min-h-screen flex flex-col items-center bg-[#FFF6EB] p-2 sm:p-4 font-sans relative overflow-hidden select-none">

            {/* Background elements */}
            <div className="absolute top-10 left-6 text-orange-300/40 rotate-12 text-5xl pointer-events-none">♪</div>
            <div className="absolute top-14 right-8 text-green-300/40 -rotate-12 text-5xl pointer-events-none">♫</div>

            {/* Header / Navigation */}
            <header className="flex justify-between items-center w-full max-w-4xl mb-2 sm:mb-3 bg-white/70 backdrop-blur-md py-1.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl shadow-xs border border-white/60 shrink-0">
                <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span>Terug</span>
                </button>

                {/* Progress indicator */}
                <div className="flex flex-col items-center">
                    <div className="flex gap-1.5 sm:gap-2 mb-0.5">
                        {activeTasks.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-colors ${
                                    i === currentTaskIndex
                                        ? 'bg-blue-600 ring-2 ring-blue-300/50'
                                        : i < currentTaskIndex
                                        ? 'bg-blue-300'
                                        : 'bg-transparent border border-slate-300'
                                }`}
                            />
                        ))}
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium">
                        Oefening {currentTaskIndex + 1} van {activeTasks.length}
                    </span>
                </div>

                {/* BPM Badge */}
                <div className="flex items-center gap-1.5 bg-[#EEF2FF] text-[#4338CA] px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M19.366 3.125a.75.75 0 00-.916-.142l-9.115 4.5A.75.75 0 008.75 8.16v8.423a3.75 3.75 0 101.5 2.895V10.165l7.615-3.76a.75.75 0 00.385-.672V4a.75.75 0 00-.384-.672z" clipRule="evenodd" />
                    </svg>
                    <span>{tempo} BPM</span>
                </div>
            </header>

            <main className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-sm p-3 sm:p-5 border border-slate-100 flex-1 flex flex-col justify-between min-h-0 overflow-y-auto sm:overflow-hidden z-10 gap-2 sm:gap-3">
                {/* Primary flow action: Speel af → Controleer → Volgende. One prominent
                    spot, so the eye never has to hunt for the next step. */}
                <div className="flex justify-center items-center min-h-[48px] sm:min-h-[52px] shrink-0">
                    {feedback === "idle" && userAnswer.length === 0 && (
                        <button
                            type="button"
                            onClick={() => playRhythmPreview(playableScore, tempo, currentTask.tuplets)}
                            className="flex items-center gap-2.5 bg-gradient-to-r from-[#5C7CFA] to-[#4C6EF5] hover:from-[#4C6EF5] hover:to-[#3B5BDB] text-white px-8 py-3 sm:px-10 sm:py-3.5 rounded-full font-bold text-sm sm:text-base shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                            </svg>
                            <span>Speel het ritme af</span>
                        </button>
                    )}
                    {feedback === "idle" && userAnswer.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => playRhythmPreview(playableScore, tempo, currentTask.tuplets)}
                                title="Luister nog eens"
                                aria-label="Luister nog eens"
                                className="flex items-center gap-1.5 bg-white text-[#4C6EF5] border-2 border-[#DDE7FF] hover:border-[#4C6EF5] hover:bg-[#F5F8FF] px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                </svg>
                                <span>Opnieuw</span>
                            </button>
                            <button
                                type="button"
                                onClick={checkAnswer}
                                className="flex items-center gap-2 bg-gradient-to-r from-[#FF9A76] to-[#FF7A50] hover:from-[#FF8C66] hover:to-[#FF6B3D] text-white px-6 py-2 sm:px-8 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-all active:scale-95 cursor-pointer"
                            >
                                <span>Controleer antwoord</span>
                            </button>
                        </div>
                    )}

                    {feedback === "correct" && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs sm:text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0">
                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                </svg>
                                <span>Goed gedaan! Helemaal juist.</span>
                            </div>
                            <button
                                type="button"
                                onClick={nextTask}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 sm:px-6 sm:py-2 rounded-full font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                            >
                                <span>{currentTaskIndex < activeTasks.length - 1 ? "Volgende oefening" : "Stop oefeningen"}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {feedback === "incorrect" && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-200">
                            <span className="text-rose-600 font-bold text-xs sm:text-sm">Niet helemaal goed</span>
                            <button
                                type="button"
                                onClick={() => playRhythmPreview(playableScore, tempo, currentTask.tuplets)}
                                title="Luister nog eens"
                                aria-label="Luister nog eens"
                                className="flex items-center gap-1.5 bg-white text-[#4C6EF5] border-2 border-[#DDE7FF] hover:border-[#4C6EF5] hover:bg-[#F5F8FF] px-4 py-1.5 sm:px-5 sm:py-2 rounded-full font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                </svg>
                                <span>Opnieuw</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleClear();
                                    setFeedback("idle");
                                }}
                                className="flex items-center gap-1.5 bg-[#FF8C66] hover:bg-[#FF7A50] text-white px-5 py-1.5 sm:px-6 sm:py-2 rounded-full font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-all active:scale-95 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                <span>Probeer opnieuw</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Answer card: stave + Herstel/Wis live together in one box */}
                <div className="flex flex-col gap-2 shrink-0">
                    {feedback === "incorrect" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full animate-in fade-in duration-200">
                            <div className="bg-rose-50/60 border border-rose-200 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 flex flex-col items-center">
                                <span className="text-[10px] sm:text-xs font-bold text-rose-600 uppercase tracking-wide">Jouw antwoord</span>
                                <div className="w-full flex justify-center items-center h-[90px] sm:h-[110px] overflow-x-auto">
                                    <div className="scale-85 sm:scale-95 origin-center">
                                        <MiniNotation timeSignature={timeSignature} notes={answerString} tuplets={answerTuplets}/>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 flex flex-col items-center">
                                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-wide">Juiste antwoord</span>
                                <div className="w-full flex justify-center items-center h-[90px] sm:h-[110px] overflow-x-auto">
                                    <div className="scale-85 sm:scale-95 origin-center">
                                        <MiniNotation timeSignature={timeSignature} notes={targetScore} tuplets={currentTask.tuplets}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={`w-full bg-[#F8FAFB] border rounded-xl sm:rounded-2xl shadow-xs transition-colors overflow-hidden ${
                            feedback === "correct" ? "border-emerald-300 bg-emerald-50/40 ring-2 ring-emerald-400/20" : "border-[#E8F0F4]"
                        }`}>
                            <div className="flex items-center justify-between px-2 sm:px-3 pt-1.5">
                                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Jouw invoer</span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleUndo}
                                        disabled={userAnswer.length === 0 || feedback !== "idle"}
                                        title="Herstel laatste noot"
                                        aria-label="Herstel laatste noot"
                                        className="flex items-center gap-1 px-2.5 py-1 bg-[#FFF9EB] text-[#D4A017] border border-[#FBEECB] rounded-lg font-semibold text-[11px] sm:text-xs hover:bg-[#FFF4D6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>
                                        </svg>
                                        <span>Herstel</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        disabled={userAnswer.length === 0 || feedback !== "idle"}
                                        title="Wis alles"
                                        aria-label="Wis alles"
                                        className="flex items-center gap-1 px-2.5 py-1 bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2] rounded-lg font-semibold text-[11px] sm:text-xs hover:bg-[#FEE2E2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                                        </svg>
                                        <span>Wis</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-center items-center h-[88px] sm:h-[104px] overflow-x-auto px-1 pb-1">
                                <div className="scale-90 sm:scale-100 origin-center">
                                    <MiniNotation timeSignature={timeSignature} notes={answerString} tuplets={answerTuplets}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Note Input Palette: Noten, Rusten, Combinaties */}
                <div className="flex flex-col gap-1.5 sm:gap-2.5 w-full shrink-0">
                    {[
                        { label: "Noten", options: noteOptions },
                        { label: "Rusten", options: restOptions },
                        { label: "Combinaties", options: combinedOptions },
                    ].map(({ label, options }) => (
                        <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 sm:text-slate-500 uppercase sm:normal-case tracking-wider sm:tracking-normal sm:w-22 shrink-0 px-1">
                                {label}
                            </span>
                            <div className="flex flex-wrap gap-1 sm:gap-1.5 p-1 bg-[#F1F3F5] rounded-xl sm:rounded-2xl border border-[#DDE2E5] items-center">
                                {options.map((option) => (
                                    <PaletteButton
                                        option={option}
                                        isSelected={option.id === selectedDuration}
                                        onSelect={() => {
                                            handleAddNote(option);
                                            setSelectedDuration(option.id);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

const PracticeLoading = () => (
    <div className="flex items-center justify-center min-h-screen bg-[#FFF6EB] text-slate-500 font-medium">
        Aan het laden...
    </div>
);

export default function PracticePage() {
    return (
        <Suspense fallback={(<PracticeLoading />) as ReactNode}>
            <PracticeArea/>
        </Suspense>
    );
}
