/**
 * Parsing for VexFlow EasyScore note tokens, shared by the practice page (which
 * grades answers) and the audio engine (which schedules them), so the two can
 * never disagree about how long a token lasts.
 *
 * Grammar reference, node_modules/vexflow/build/esm/src/easyscore.js:
 *   PARAMS = DURATION -> TYPE -> DOTS
 *   DURATION = "/" DURATIONS   where DURATIONS is [0-9whq]+
 *   TYPE     = "/" MAYBESLASH TYPES, and TYPES includes "r" for a rest
 *   DOTS     = "." zero or more
 *
 * The order matters: the rest marker comes before the dots, so a dotted eighth
 * rest is "B4/8/r." and never "B4/8./r".
 */

const DURATION_DENOMINATORS: Record<string, number> = { w: 1, h: 2, q: 4 };

export const EPSILON = 1e-6;

/**
 * A tuplet in the shape VexFlow's Tuplet expects, so notation can pass it
 * straight to the native API. The ratio lives beside the score rather than
 * inside it, because VexFlow 5 has no EasyScore token for a tuplet.
 */
export interface TupletSpec {
    /** Index of the group's first note, counting notes in easyScore order. */
    start: number;
    /** VexFlow numNotes: how many notes the group contains. */
    numNotes: number;
    /** VexFlow notesOccupied: how many notes' worth of space the group takes. */
    notesOccupied: number;
}

/**
 * Denominator of a duration token: 4 for both "q" and "4", since VexFlow counts
 * four quarter notes to a whole. Returns null when the token is not a duration.
 */
export const parseDuration = (token: string) => {
    const denominator = DURATION_DENOMINATORS[token.toLowerCase()] ?? Number(token);
    return Number.isFinite(denominator) && denominator > 0 ? denominator : null;
};

export interface ParsedNote {
    pitch: string;
    denominator: number;
    isRest: boolean;
    dots: number;
}

/** Splits a note token such as "G4/8", "G4/q." or "B4/8/r." into its parts. */
export const parseNote = (noteStr: string): ParsedNote | null => {
    const slash = noteStr.indexOf('/');
    if (slash === -1) return null;
    const match = noteStr.slice(slash + 1).match(/^([a-z0-9]+)(\/r)?(\.*)$/i);
    if (!match) return null;
    const denominator = parseDuration(match[1]);
    if (denominator === null) return null;
    return {
        pitch: noteStr.slice(0, slash),
        denominator,
        isRest: match[2] === '/r',
        dots: match[3].length,
    };
};

/** Length of one note token in quarter notes, or 0 when it is not a note. */
export const getNoteBeats = (noteStr: string) => {
    const note = parseNote(noteStr);
    if (!note) return 0;
    return (4 / note.denominator) * (2 - 1 / Math.pow(2, note.dots));
};

/**
 * Length of one full measure in quarter notes, so the units match getNoteBeats:
 * 2/4 -> 2, 3/4 -> 3, 6/8 -> 3, 9/8 -> 4.5, 12/8 -> 6. Using the numerator
 * directly (6 for 6/8) mixes eighths with quarters and never closes a bar.
 */
export const getMeasureBeats = (timeSignature: string) => {
    const [numerator, denominator] = timeSignature.split("/").map(Number);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 4;
    return numerator * (4 / denominator);
};

/**
 * Rewrites a note token to a canonical spelling, so the letter duration aliases
 * and the numeric ones compare equal: "G4/q." and "G4/4." are the same note and
 * must not be graded as different. The rest marker and the dots are kept, so a
 * rest never compares equal to a sounded note.
 */
export const canonicalizeNote = (noteStr: string) => {
    const note = parseNote(noteStr);
    if (!note) return noteStr;
    const dots = note.dots > 0 ? ".".repeat(note.dots) : "";
    return `${note.pitch}/${note.denominator}${note.isRest ? "/r" : ""}${dots}`;
};

/**
 * Notes of a score string, ignoring bar separators. Where the bars fall is a
 * rendering detail, not part of the answer the user types, so it must not
 * decide whether an answer counts as correct.
 */
export const getNotes = (score: string) =>
    score.split(",").map(n => canonicalizeNote(n.trim())).filter(n => n !== "" && n !== "|");

/** The tuplet covering a note index, if any. */
export const getTupletAt = (index: number, tuplets: TupletSpec[] = []) =>
    tuplets.find(t => index >= t.start && index < t.start + t.numNotes);

/**
 * Length of one note in quarter notes as actually sounded, i.e. shortened by any
 * tuplet it belongs to. Three eighths in a 3:2 tuplet are a third of a beat each
 * rather than a half, which is what keeps a tuplet bar one bar long. This mirrors
 * what VexFlow does to the tick values of the notes in its Tuplet.
 */
export const getSoundedBeats = (noteStr: string, index: number, tuplets: TupletSpec[] = []) => {
    const beats = getNoteBeats(noteStr);
    const tuplet = getTupletAt(index, tuplets);
    return tuplet ? beats * (tuplet.notesOccupied / tuplet.numNotes) : beats;
};
