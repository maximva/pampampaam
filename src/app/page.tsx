"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import MiniNotation from "@/components/MiniNotation";
import { playRhythmPreview } from "@/lib/audioEngine";
import { RHYTHM_PRESETS } from "@/lib/rhythmData";
import { EPSILON, getMeasureBeats, getScoreBeats } from "@/lib/rhythmParser";

const SUFFIX_PRESETS = [
  { id: "kwart-kwartrust", name: "Bald 1e jaar", notes: "G4/q, B4/q/r" },
];

const TIME_SIGNATURES = Array.from(new Set(RHYTHM_PRESETS.map(r => r.timeSignature)));

const MIN_EXERCISES = 1;
const MAX_EXERCISES = 20;

const clampExercises = (value: number) =>
  Math.min(MAX_EXERCISES, Math.max(MIN_EXERCISES, value));

export default function Home() {
  const router = useRouter();
  const [tempo, setTempo] = useState(65);
  const [timeSignature, setTimeSignature] = useState(TIME_SIGNATURES[0] ?? "2/4");
  const [selectedRhythms, setSelectedRhythms] = useState<string[]>([]);
  const [numExercises, setNumExercises] = useState(5);
  // Held separately from numExercises so the field can be emptied while typing
  // without the value snapping back under the cursor; committed on blur or Enter.
  const [exerciseDraft, setExerciseDraft] = useState(String(5));
  // The ending is picked from these presets only, so the selection is stored as an
  // id. Holding the notes themselves as free text would let an ending through that
  // does not fit the meter and breaks the notation.
  const [suffixId, setSuffixId] = useState<string | null>(null);
  // The exercise count and the fixed ending are settled per session, so they live
  // in a dialog reached from the start button instead of the sidebar.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes, and the page behind the dialog must not scroll while it is up.
  useEffect(() => {
    if (!isSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSettingsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSettingsOpen]);

  const availableRhythms = useMemo(() => {
    return RHYTHM_PRESETS.filter(r => r.timeSignature === timeSignature);
  }, [timeSignature]);

  // --- NEW: Group rhythms by category ---
  const groupedRhythms = useMemo(() => {
    const groups: Record<string, typeof availableRhythms> = {};
    availableRhythms.forEach((rhythm) => {
      const cat = rhythm.category || "Overig";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(rhythm);
    });
    return groups;
  }, [availableRhythms]);

  // A fixed ending is played as its own bar after the rhythm, so it only makes sense
  // when it fits one bar of the selected meter. The same rule hides the note palette
  // entries that would not fit, and it also keeps the ending from overflowing the
  // voice, which would leave the notation blank.
  const relevantSuffixPresets = useMemo(() => {
    const measureBeats = getMeasureBeats(timeSignature);
    return SUFFIX_PRESETS.filter(preset => getScoreBeats(preset.notes) <= measureBeats + EPSILON);
  }, [timeSignature]);

  const selectedSuffix = useMemo(
    () => SUFFIX_PRESETS.find(preset => preset.id === suffixId),
    [suffixId]
  );

  const handleTimeSignatureChange = (newTs: string) => {
    setTimeSignature(newTs);
    setSelectedRhythms([]);
    setSuffixId(null);
  };

  const commitExercises = (value: number) => {
    const clamped = clampExercises(value);
    setNumExercises(clamped);
    setExerciseDraft(String(clamped));
  };

  // Typing commits straight away while the number is in range, so the steppers,
  // their disabled states and the session that eventually starts always agree
  // with what is on screen. Out-of-range and empty input stays in the draft and
  // is only normalised on blur or Enter.
  const handleExerciseDraftChange = (raw: string) => {
    setExerciseDraft(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    if (parsed >= MIN_EXERCISES && parsed <= MAX_EXERCISES) setNumExercises(parsed);
  };

  // An empty or non-numeric field keeps the current count rather than committing 0.
  const commitExerciseDraft = () => {
    const parsed = Number.parseInt(exerciseDraft, 10);
    commitExercises(Number.isNaN(parsed) ? numExercises : parsed);
  };

  // Reset the field on the way in, so a draft abandoned by Escape or the
  // Annuleren button can never reappear on the next open.
  const openSettings = () => {
    setExerciseDraft(String(numExercises));
    setIsSettingsOpen(true);
  };

  const toggleRhythm = (id: string) => {
    setSelectedRhythms(prev =>
        prev.includes(id)
            ? prev.filter(rId => rId !== id)
            : [...prev, id]
    );
  };

  const startPractice = () => {
    const rhythmsToUse = selectedRhythms.length > 0
        ? selectedRhythms
        : availableRhythms.map(r => r.id);
    if (rhythmsToUse.length === 0) return;
    const sequence: string[] = [];
    for (let i = 0; i < numExercises; i++) {
      const randomIndex = Math.floor(Math.random() * rhythmsToUse.length);
      sequence.push(rhythmsToUse[randomIndex]);
    }
    const rhythmQuery = sequence.join(",");
    const suffix = selectedSuffix?.notes ?? "";
    const suffixQuery = suffix ? `&suffix=${encodeURIComponent(suffix)}` : "";
    router.push(`/practice?tempo=${tempo}&ts=${timeSignature}&rhythms=${rhythmQuery}${suffixQuery}`);
  };

  return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8">

          {/* LEFT SIDEBAR */}
          <aside className="w-full md:w-80 shrink-0 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h1 className="text-3xl font-bold mb-8 text-slate-800">Ritmetrainer</h1>

              <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col">
                  <span id="maatsoort-label" className="font-semibold text-sm mb-2 text-slate-700">Maatsoort</span>
                  <div
                      role="group"
                      aria-labelledby="maatsoort-label"
                      className="flex rounded-lg overflow-hidden border border-slate-300 bg-slate-50"
                  >
                    {TIME_SIGNATURES.map((ts) => (
                        <button
                            key={ts}
                            type="button"
                            aria-pressed={timeSignature === ts}
                            onClick={() => handleTimeSignatureChange(ts)}
                            className={`flex-1 px-3 py-2.5 font-medium border-r border-slate-300 last:border-r-0 transition-colors ${
                                timeSignature === ts
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          {ts}
                        </button>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col">
                  <span className="font-semibold text-sm mb-2 text-slate-700">Tempo: {tempo} BPM</span>
                  <input
                      type="range" min="60" max="200" value={tempo}
                      onChange={(e) => setTempo(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </aside>

          {/* RIGHT AREA: Grouped Rhythm Selection */}
          <section className="flex-1 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <header className="flex justify-between items-end mb-8 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Ritmes</h2>
                <p className="text-slate-500 mt-1">Selecteer de figuren die je wilt oefenen</p>
              </div>

              {availableRhythms.length > 0 && (
                  <button
                      onClick={openSettings}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-all shadow-sm active:scale-[0.98]"
                  >
                    {selectedRhythms.length === 0 ? "Oefen alles" : "Oefen selectie"}
                  </button>
              )}
            </header>

            <div className="overflow-y-auto pr-2 space-y-10">
              {Object.entries(groupedRhythms).map(([category, rhythms]) => (
                  <div key={category}>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                      <span className="h-px w-8 bg-slate-200"></span>
                      {category}
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {rhythms.map((rhythm) => {
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
                              <div className="flex justify-between items-start">
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
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playRhythmPreview(rhythm.easyScore, tempo, rhythm.tuplets);
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
                                <MiniNotation timeSignature={rhythm.timeSignature} notes={rhythm.easyScore} tuplets={rhythm.tuplets} />
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  </div>
              ))}

              {availableRhythms.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                    <p className="text-lg font-medium text-slate-500">Geen ritmes gevonden</p>
                  </div>
              )}
            </div>
          </section>
        </div>

        {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop: a plain div rather than a click handler on the wrapper,
                    so clicks inside the dialog cannot bubble out and close it. */}
                <div
                    className="absolute inset-0 bg-slate-900/50"
                    onClick={() => setIsSettingsOpen(false)}
                    aria-hidden="true"
                />

                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="practice-settings-title"
                    tabIndex={-1}
                    className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-h-[90vh] overflow-y-auto focus:outline-none"
                >
                    <h2 id="practice-settings-title" className="text-xl font-bold text-slate-800">
                        Instellingen
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 mb-6">
                        {selectedRhythms.length === 0
                            ? `Je oefent alle ${availableRhythms.length} ritmes in ${timeSignature}.`
                            : `Je oefent ${selectedRhythms.length} geselecteerde ritme${selectedRhythms.length === 1 ? "" : "n"} in ${timeSignature}.`}
                    </p>

                    <div className="flex flex-col gap-6">
                        <label className="flex flex-col">
                            <span className="font-semibold text-sm mb-2 text-slate-700">Aantal oefeningen</span>
                            {/* A stepper with a large, high-contrast number instead of a
                                1-20 slider: the old value sat in a small pale badge that was
                                hard to read, and a slider gives no way to land on, say, 17. */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => commitExercises(numExercises - 1)}
                                    disabled={numExercises <= MIN_EXERCISES}
                                    aria-label="Eén oefening minder"
                                    className="w-11 h-11 shrink-0 rounded-lg border border-slate-300 bg-white text-slate-600 text-xl font-bold leading-none transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    min={MIN_EXERCISES}
                                    max={MAX_EXERCISES}
                                    value={exerciseDraft}
                                    onChange={(e) => handleExerciseDraftChange(e.target.value)}
                                    onBlur={commitExerciseDraft}
                                    onKeyDown={(e) => {
                                        if (e.key !== "Enter") return;
                                        e.preventDefault();
                                        commitExerciseDraft();
                                    }}
                                    aria-label="Aantal oefeningen"
                                    className="w-20 h-11 text-center text-2xl font-bold text-slate-800 border border-slate-300 rounded-lg bg-slate-50 [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => commitExercises(numExercises + 1)}
                                    disabled={numExercises >= MAX_EXERCISES}
                                    aria-label="Eén oefening meer"
                                    className="w-11 h-11 shrink-0 rounded-lg border border-slate-300 bg-white text-slate-600 text-xl font-bold leading-none transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
                                >
                                    +
                                </button>
                            </div>
                        </label>

                        <div className="flex flex-col">
                            <span className="font-semibold text-sm mb-2 text-slate-700">Vaste eindmaat</span>
                            {relevantSuffixPresets.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    Geen enkele eindmaat past in {timeSignature}.
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {relevantSuffixPresets.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            aria-pressed={suffixId === preset.id}
                                            onClick={() => setSuffixId(suffixId === preset.id ? null : preset.id)}
                                            className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                                                suffixId === preset.id
                                                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="pointer-events-none scale-75 -my-2">
                                                <MiniNotation timeSignature={timeSignature} notes={preset.notes}/>
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-slate-500 mt-1">{preset.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(false)}
                            className="px-5 py-2.5 rounded-lg font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                            Annuleren
                        </button>
                        <button
                            type="button"
                            onClick={startPractice}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-all shadow-sm active:scale-[0.98]"
                        >
                            Start oefenen
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
  );
}
