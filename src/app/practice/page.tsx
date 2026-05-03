"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useMemo } from "react";
import { RHYTHM_PRESETS } from "@/lib/rhythmData";
import { playRhythmPreview } from "@/lib/audioEngine";
import MiniNotation from "@/components/MiniNotation";

function PracticeArea() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tempo = parseInt(searchParams.get("tempo") || "120", 10);
    const timeSignature = searchParams.get("ts") || "2/4";
    const rhythmIds = searchParams.get("rhythms")?.split(",") || [];

    // Map directly over the incoming IDs to preserve duplicates and random order
    const activeTasks = useMemo(() => {
        return rhythmIds
            .map(id => RHYTHM_PRESETS.find(r => r.id === id))
            // Filter out any undefined values just in case a bad ID gets in the URL
            .filter((r): r is typeof RHYTHM_PRESETS[0] => r !== undefined);
    }, [rhythmIds]);

    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");

    const currentTask = activeTasks[currentTaskIndex];

    if (!currentTask) {
        return <div className="p-8 text-center">No rhythms selected.</div>;
    }

    // Convert the user's array of notes into the EasyScore string VexFlow needs
    const answerString = userAnswer.join(", ");

    const handleAddNote = (duration: string) => {
        setUserAnswer(prev => [...prev, `B4/${duration}`]);
        setFeedback("idle"); // Reset feedback when they change their answer
    };

    const handleUndo = () => {
        setUserAnswer(prev => prev.slice(0, -1));
        setFeedback("idle");
    };

    const handleClear = () => {
        setUserAnswer([]);
        setFeedback("idle");
    };

    const checkAnswer = () => {
        // Normalize strings (remove spaces) to compare them accurately
        const target = currentTask.easyScore.replace(/\s+/g, '');
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
            router.push("/"); // Back to home if finished
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen p-4 md:p-8 bg-slate-100">

            {/* Header */}
            <header className="flex justify-between items-center w-full max-w-3xl mb-8 bg-white p-4 rounded-xl shadow-sm">
                <button onClick={() => router.push("/")} className="text-slate-500 hover:text-slate-800">
                    ← Terug
                </button>
                <div className="flex gap-4 items-center">
          <span className="bg-slate-100 px-3 py-1 rounded-full text-sm font-mono font-medium">
            Oefening {currentTaskIndex + 1} van {activeTasks.length}
          </span>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-mono font-bold">
            {tempo} BPM
          </span>
                </div>
            </header>

            <main className="w-full max-w-3xl bg-white rounded-2xl shadow-sm p-6 md:p-10 border border-slate-200">

                {/* Step 1: Listen */}
                <section className="mb-12 flex flex-col items-center">
                    <h2 className="text-xl font-bold text-slate-800 mb-6">1. Beluister het ritme</h2>
                    <button
                        onClick={() => playRhythmPreview(currentTask.easyScore, tempo)}
                        className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold shadow-md transition-transform active:scale-95 text-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                        </svg>
                        Speel ritme af
                    </button>
                </section>

                {/* Step 2: Draw */}
                <section className="mb-8 flex flex-col items-center border-t border-slate-100 pt-10">
                    <h2 className="text-xl font-bold text-slate-800 mb-6">2. Noteer je antwoord</h2>

                    {/* Note Input Palette */}
                    <div className="flex gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <button onClick={() => handleAddNote("q")}
                                className="px-4 py-2 bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300 font-bold text-xl"
                                title="Quarter Note">♩
                        </button>


                        <button onClick={() => handleAddNote("8")}
                                className="px-4 py-2 bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300 font-bold text-xl"
                                title="Eighth Note">♪
                        </button>
                        <button onClick={() => handleAddNote("8.")}
                                className="px-4 py-2 bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300 font-bold text-xl"
                                title="Dotted Eighth Note">♪.
                        </button>
                        <button onClick={() => handleAddNote("16")}
                                className="px-4 py-2 bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-300 font-bold text-xl"
                                title="Sixteenth Note">♬
                        </button>
                        <div className="w-px bg-slate-300 mx-2"></div>
                        <button onClick={handleUndo} disabled={userAnswer.length === 0}
                                className="px-4 py-2 text-slate-600 disabled:opacity-50 hover:text-slate-900">Herstel
                        </button>
                        <button onClick={handleClear} disabled={userAnswer.length === 0}
                                className="px-4 py-2 text-red-600 disabled:opacity-50 hover:text-red-800">Wis alles
                        </button>
                    </div>

                    {/* The Live Stave Canvas */}
                    <div
                        className="bg-white border-2 border-slate-100 rounded-xl p-4 w-full flex justify-center items-center min-h-[160px]">
                        <MiniNotation timeSignature={timeSignature} notes={answerString} />
                    </div>
                </section>

                {/* Step 3: Validate */}
                <section className="flex flex-col items-center pt-6">
                    {feedback === "idle" && (
                        <button
                            onClick={checkAnswer}
                            disabled={userAnswer.length === 0}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white px-8 py-3 rounded-lg font-bold shadow transition-colors w-full md:w-auto"
                        >
                            Controleer antwoord
                        </button>
                    )}

                    {feedback === "correct" && (
                        <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300">
                            <div className="bg-green-100 text-green-800 border border-green-200 px-6 py-4 rounded-lg font-bold mb-6 w-full text-center">
                                🎉 Correct! Goed gedaan.
                            </div>
                            <button onClick={nextTask} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-lg font-bold shadow w-full md:w-auto">
                                {currentTaskIndex < activeTasks.length - 1 ? "Volgend ritme" : "Stop oefeningen"}
                            </button>
                        </div>
                    )}

                    {feedback === "incorrect" && (
                        <div className="flex flex-col items-center w-full animate-in fade-in duration-300">
                            <div className="bg-red-100 text-red-800 border border-red-200 px-6 py-4 rounded-lg font-bold mb-6 w-full text-center">
                                Nog niet helemaal. Luister opnieuw en pas de noten aan!
                            </div>
                            <button onClick={() => setFeedback("idle")} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-8 py-3 rounded-lg font-bold w-full md:w-auto">
                                Probeer opnieuw
                            </button>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default function PracticePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Aan het laden...</div>}>
            <PracticeArea />
        </Suspense>
    );
}
