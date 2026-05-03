"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import MiniNotation from "@/components/MiniNotation";
import { playRhythmPreview } from "@/lib/audioEngine";
import { RHYTHM_PRESETS } from "@/lib/rhythmData"; // Import from your new data file

export default function Home() {
  const router = useRouter();
  const [tempo, setTempo] = useState(65);
  const [timeSignature, setTimeSignature] = useState("2/4");
  const [selectedRhythms, setSelectedRhythms] = useState<string[]>([]);
  const [numExercises, setNumExercises] = useState(5); // New state for exercise count

  const availableRhythms = useMemo(() => {
    return RHYTHM_PRESETS.filter(r => r.timeSignature === timeSignature);
  }, [timeSignature]);

  const handleTimeSignatureChange = (newTs: string) => {
    setTimeSignature(newTs);
    setSelectedRhythms([]);
  };

  const toggleRhythm = (id: string) => {
    setSelectedRhythms(prev =>
        prev.includes(id)
            ? prev.filter(rId => rId !== id)
            : [...prev, id]
    );
  };

  // Toggle "Select All" functionality
  const toggleSelectAll = () => {
    if (selectedRhythms.length === availableRhythms.length) {
      setSelectedRhythms([]); // Deselect all
    } else {
      setSelectedRhythms(availableRhythms.map(r => r.id)); // Select all
    }
  };

  const startPractice = () => {
    if (selectedRhythms.length === 0) return;

    // Generate a random sequence of rhythms based on the selected pool
    const sequence: string[] = [];
    for (let i = 0; i < numExercises; i++) {
      const randomIndex = Math.floor(Math.random() * selectedRhythms.length);
      sequence.push(selectedRhythms[randomIndex]);
    }

    const rhythmQuery = sequence.join(",");
    router.push(`/practice?tempo=${tempo}&ts=${timeSignature}&rhythms=${rhythmQuery}`);
  };

  const isAllSelected = availableRhythms.length > 0 && selectedRhythms.length === availableRhythms.length;

  return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8">

          {/* LEFT SIDEBAR: Settings & Controls */}
          <aside className="w-full md:w-80 shrink-0 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h1 className="text-3xl font-bold mb-8 text-slate-800">Ritmetrainer</h1>

              <div className="flex flex-col gap-6 mb-8">

                <label className="flex flex-col">
                  <span className="font-semibold text-sm mb-2 text-slate-700">Tempo: {tempo} BPM</span>
                  <input
                      type="range" min="60" max="200" value={tempo}
                      onChange={(e) => setTempo(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                  />
                </label>

                <label className="flex flex-col">
                  <span className="font-semibold text-sm mb-2 text-slate-700">Maatsoort</span>
                  <select
                      value={timeSignature}
                      onChange={(e) => handleTimeSignatureChange(e.target.value)}
                      className="border border-slate-300 p-2.5 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                  >
                    <option value="2/4">2/4</option>
                    <option value="3/4">3/4</option>
                    <option value="4/4">4/4</option>
                  </select>
                </label>

                <label className="flex flex-col pt-2 border-t border-slate-100">
                  <span className="font-semibold text-sm mb-2 text-slate-700">Aantal oefeningen</span>
                  <div className="flex items-center gap-4">
                    <input
                        type="range" min="1" max="20" value={numExercises}
                        onChange={(e) => setNumExercises(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                    />
                    <span className="font-mono bg-slate-100 px-3 py-1 rounded-md text-sm">{numExercises}</span>
                  </div>
                </label>

              </div>

              <button
                  onClick={startPractice}
                  disabled={selectedRhythms.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                {selectedRhythms.length === 0 ? "Selecteer ritmes" : `Start oefeningen`}
              </button>
            </div>
          </aside>

          {/* RIGHT AREA: Rhythm Selection Grid */}
          <section className="flex-1 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <header className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Ritmes</h2>
                <p className="text-slate-500 mt-1">Selecteer de figuren die je zou willen oefenen</p>
              </div>

              {/* Select All Button */}
              {availableRhythms.length > 0 && (
                  <button
                      onClick={toggleSelectAll}
                      className="text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-200"
                  >
                    {isAllSelected ? "Deselecteer Alles" : "Selecteer Alles"}
                  </button>
              )}
            </header>

            {availableRhythms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-4">
                  {availableRhythms.map((rhythm) => {
                    const isSelected = selectedRhythms.includes(rhythm.id);

                    return (
                        <div
                            key={rhythm.id}
                            onClick={() => toggleRhythm(rhythm.id)}
                            className={`relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                                isSelected
                                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                  isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'
                              }`}>
                                {isSelected && (
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                              </div>
                              <span className={`font-semibold leading-tight ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                          {rhythm.name}
                        </span>
                            </div>

                            <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playRhythmPreview(rhythm.easyScore, tempo);
                                }}
                                className={`p-1.5 rounded-full transition-colors flex items-center justify-center ${
                                    isSelected ? 'text-blue-700 bg-blue-100 hover:bg-blue-200' : 'text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-800'
                                }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
                                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>

                          <div className="flex justify-center items-center rounded-lg bg-white/60 -mx-2">
                            <MiniNotation timeSignature={rhythm.timeSignature} notes={rhythm.easyScore} />
                          </div>
                        </div>
                    );
                  })}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                  <p className="text-lg font-medium text-slate-500">Geen ritmes gevonden</p>
                </div>
            )}
          </section>
        </div>
      </main>
  );
}
