"use client";
import { useSearchParams, useRouter } from "next/navigation";
import {Suspense, useState, useMemo, useEffect, useId, useRef, ReactNode} from "react";
import { Factory, BarlineType } from "vexflow";
import { RHYTHM_PRESETS } from "@/lib/rhythmData";
import { playRhythmPreview } from "@/lib/audioEngine";
import MiniNotation from "@/components/MiniNotation";

const NOTE_SELECT_OPTIONS = [
    { id: "q", duration: "G4/q" },
    { id: "q.", duration: "G4/q." },
    { id: "8", duration: "G4/8" },
    { id: "8.", duration: "G4/8." },
    { id: "16", duration: "G4/16" },
    { id: "qr", duration: "B4/q/r" },
    { id: "8r", duration: "B4/8/r" },
];

function NoteButtonIcon({ duration }: { duration: string }) {
    const containerRef = useRef<HTMLDivElement>(null!);
    const rawId = useId();
    const uniqueId = `vex-btn-${rawId.replace(/:/g, "")}`;

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";

        const vf = new Factory({
            renderer: { elementId: uniqueId, width: 80, height: 80 }
        });

        const score = vf.EasyScore();

        // 1. noConnector: true tells the System to stop generating the right-side connector!
        const system = vf.System({
            x: 12,
            y: -18,
            width: 56,
        });

        try {
            const vexNotes = score.notes(duration);
            const voice = score.voice(vexNotes, { time: "4/4" }).setStrict(false);
            const stave = system.addStave({ voices: [voice] });
            (stave as any).options.num_lines = 0;

            stave.setBegBarType(BarlineType.NONE);
            stave.setEndBarType(BarlineType.NONE);

            vf.draw();
        } catch (error) {
            console.error("Failed to render button icon:", error);
        }
    }, [duration, uniqueId]);

    return (
        <div
            id={uniqueId}
            ref={containerRef}
            className="pointer-events-none flex items-center justify-center transform scale-[0.7]"
        />
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

    if (!currentTask) {
        return <div className="p-8 text-center">Geen ritmes geselecteerd.</div>;
    }

    const answerString = userAnswer.join(", ");

    const getNoteBeats = (noteStr: string) => {
        if (noteStr.includes('/q.')) return 1.5;
        if (noteStr.includes('/q')) return 1;
        if (noteStr.includes('/8.')) return 0.75;
        if (noteStr.includes('/8')) return 0.5;
        if (noteStr.includes('/16')) return 0.25;
        return 0;
    };

    const handleAddNote = (duration: string) => {
        setUserAnswer(prev => {
            const newAnswer = [...prev, duration];
            const prevTotalBeats = prev.reduce((sum, n) => sum + getNoteBeats(n), 0);
            const beatsPerMeasure = parseInt(timeSignature.split('/')[0], 10);

            if (prevTotalBeats > 0 && prevTotalBeats % beatsPerMeasure === 0) {
                return [...prev, '|', duration];
            }

            return newAnswer;
        });
        setFeedback("idle");
    };

    const handleUndo = () => {
        setUserAnswer(prev => {
            if (prev.length === 0) return prev;
            if (prev[prev.length - 1] === '|') {
                return prev.slice(0, -2);
            }
            return prev.slice(0, -1);
        });
        setFeedback("idle");
    };

    const handleClear = () => {
        setUserAnswer([]);
        setFeedback("idle");
    };

    const checkAnswer = () => {
        const target = targetScore.replace(/\s+/g, '');
        const user = answerString.replace(/\s+/g, '');

        if (target === user) {
            setFeedback("correct");
        } else {
            setFeedback("incorrect");
        }
    };

    const nextTask = () => {
        setUserAnswer([]);
        setFeedback("idle");
        if (currentTaskIndex < activeTasks.length - 1) {
            setCurrentTaskIndex(prev => prev + 1);
        } else {
            router.push("/");
        }
    };

    return (
        <div className="min-h-screen bg-[#FFF6EB] flex flex-col items-center p-4 md:p-8 font-sans relative overflow-hidden">

            {/* Background elements */}
            <div className="absolute top-20 left-10 text-orange-300 opacity-50 rotate-12 text-6xl pointer-events-none">♪</div>
            <div className="absolute top-40 right-20 text-green-300 opacity-50 -rotate-12 text-6xl pointer-events-none">♫</div>

            {/* Header / Navigation */}
            <header className="flex justify-between items-center w-full max-w-4xl mb-6 bg-white/60 backdrop-blur-md p-2 px-4 rounded-2xl shadow-sm border border-white/40">
                <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Terug
                </button>

                {/* Progressindicator */}
                <div className="flex flex-col items-center">
                    <div className="flex gap-2 mb-1.5">
                        {activeTasks.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                    i === currentTaskIndex
                                        ? 'bg-blue-600'
                                        : 'bg-transparent border border-slate-300'
                                }`}
                            />
                        ))}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        Oefening {currentTaskIndex + 1} van {activeTasks.length}
                    </span>
                </div>

                {/* BPM Badge */}
                <div className="flex items-center gap-2 bg-[#EEF2FF] text-[#4338CA] px-4 py-2 rounded-xl font-bold text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M19.366 3.125a.75.75 0 00-.916-.142l-9.115 4.5A.75.75 0 008.75 8.16v8.423a3.75 3.75 0 101.5 2.895V10.165l7.615-3.76a.75.75 0 00.385-.672V4a.75.75 0 00-.384-.672z" clipRule="evenodd" />
                    </svg>
                    {tempo} BPM
                </div>
            </header>

            <main className="w-full max-w-4xl bg-white rounded-[2rem] shadow-sm p-3 md:p-10 border border-slate-100 z-10">
                {/* Step 1 */}
                <section className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="bg-[#EEF2FF] p-3 rounded-full text-[#4F46E5]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                                <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">1. Luister</h2>
                    </div>

                    <div className="flex justify-center mb-4 relative">
                        <button
                            onClick={() => playRhythmPreview(playableScore, tempo)}
                            className="group flex items-center gap-3 bg-gradient-to-b from-[#5C7CFA] to-[#4C6EF5] hover:from-[#4C6EF5] hover:to-[#3B5BDB] text-white px-10 py-4 rounded-full font-bold shadow-[0_8px_20px_-6px_rgba(76,110,245,0.5)] transition-all active:scale-95 text-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                            </svg>
                            Speel af
                        </button>
                    </div>
                </section>

                <hr className="border-dashed border-slate-200 my-8" />

                {/* Step 2 */}
                <section className="mb-8 flex flex-col">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="bg-[#FFF4E5] p-3 rounded-full text-[#F59E0B]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                                 className="w-6 h-6">
                                <path
                                    d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.158 3.712 3.712 1.158-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z"/>
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">2. Jouw antwoord</h2>
                    </div>
                    <p className="text-slate-500 mb-6 ml-16">Gebruik de noten hieronder om jouw ritme in te voeren.</p>

                    <div className="flex flex-wrap items-center gap-3 ml-0 md:ml-16">
                        <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#F1F3F5] rounded-3xl border border-[#DDE2E5]">
                            {NOTE_SELECT_OPTIONS.map((noteType) => {
                                const isSelected = noteType.id === selectedDuration;
                                return (
                                    <div key={noteType.id} className="relative">
                                        <button
                                            onClick={() => {
                                                handleAddNote(noteType.duration);
                                                setSelectedDuration(noteType.id);
                                            }}
                                            className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-[0_4px_12px_-6px_rgba(0,0,0,0.1)] transition-all overflow-hidden border-2 border-[#DDE2E5] hover:border-[#CED4DA]"
                                        >
                                            <NoteButtonIcon duration={noteType.duration} />
                                        </button>
                                        {isSelected && (
                                            <div className="absolute -inset-1 border-4 border-[#5C7CFA] rounded-3xl pointer-events-none"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="hidden md:block w-px h-10 bg-slate-200 mx-2"></div>

                        {/* Undo/Clear buttons */}
                        <div className="flex gap-3 mt-2 md:mt-0">
                            <button onClick={handleUndo} disabled={userAnswer.length === 0} className="flex items-center gap-2 px-5 py-3.5 bg-[#FFF9EB] text-[#D4A017] border border-[#FBEECB] rounded-xl font-semibold hover:bg-[#FFF4D6] disabled:opacity-50 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>
                                </svg>
                                Herstel
                            </button>
                            <button onClick={handleClear} disabled={userAnswer.length === 0} className="flex items-center gap-2 px-5 py-3.5 bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2] rounded-xl font-semibold hover:bg-[#FEE2E2] disabled:opacity-50 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                                </svg>
                                Wis
                            </button>
                        </div>
                    </div>

                    <div className="ml-0 md:ml-16 bg-[#F8FAFB] border border-[#E8F0F4] rounded-xl p-4 mt-2 mb-6 flex justify-center items-center min-h-[120px] shadow-sm">
                        <MiniNotation timeSignature={timeSignature} notes={answerString}/>
                    </div>

                    {feedback === "idle" && (
                        <div className="ml-0 md:ml-16 mt-4 flex justify-center">
                            <button
                                onClick={checkAnswer}
                                disabled={userAnswer.length === 0}
                                className="flex items-center gap-2 bg-gradient-to-r from-[#FF9A76] to-[#FF7A50] hover:from-[#FF8C66] hover:to-[#FF6B3D] disabled:from-slate-300 disabled:to-slate-300 text-white px-10 py-4 rounded-full font-bold text-lg shadow-[0_8px_20px_-6px_rgba(255,122,80,0.5)] transition-all active:scale-95 md:w-auto justify-center"
                            >
                                Controleer antwoord
                            </button>
                        </div>
                    )}

                    {feedback === "correct" && (
                        <div className="ml-0 md:ml-16 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                            <div className="bg-[#F2FCF5] border border-[#D1F4E0] w-full rounded-2xl p-6 relative overflow-hidden mb-6 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="bg-[#48C774] text-white rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <div className="z-10">
                                        <h3 className="text-[#2F855A] font-bold text-lg">Goed gedaan!</h3>
                                        <p className="text-[#38A169] text-sm mt-1">Je ritme is helemaal correct.</p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={nextTask} className="flex items-center justify-center gap-2 bg-[#48C774] hover:bg-[#3EAD65] text-white px-10 py-4 rounded-full font-bold shadow-lg w-full md:w-auto transition-transform active:scale-95 text-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                {currentTaskIndex < activeTasks.length - 1 ? "Volgende oefening" : "Stop oefeningen"}
                            </button>
                        </div>
                    )}

                    {feedback === "incorrect" && (
                        <div className="ml-0 md:ml-16 flex flex-col items-center animate-in fade-in duration-300">
                            <div className="bg-[#FFF5F5] border border-[#FED7D7] w-full rounded-2xl p-6 relative overflow-hidden mb-6 shadow-sm">
                                <div className="flex items-center gap-4 mb-4 z-10 relative">
                                    <div className="bg-[#FC8181] text-white rounded-full w-12 h-12 flex items-center justify-center shrink-0 shadow-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-[#C53030] font-bold text-lg">Oeps, niet helemaal goed</h3>
                                        <p className="text-[#E53E3E] text-sm mt-1">Vergelijk jouw ritme met het juiste ritme hieronder.</p>
                                    </div>
                                </div>

                                <div className="border-t border-[#FED7D7] pt-4 mt-2">
                                    <p className="text-sm text-[#C53030] font-medium mb-3">Juiste antwoord:</p>
                                    <div className="bg-white/60 border border-[#FED7D7] rounded-xl p-3 flex justify-center items-center min-h-[100px]">
                                        <MiniNotation timeSignature={timeSignature} notes={targetScore} />
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => {
                                handleClear();
                                setFeedback("idle");
                            }} className="flex items-center justify-center gap-2 bg-[#FF8C66] hover:bg-[#FF7A50] text-white px-10 py-4 rounded-full font-bold shadow-lg w-full md:w-auto transition-transform active:scale-95 text-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                Probeer opnieuw
                            </button>
                        </div>
                    )}
                </section>
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
