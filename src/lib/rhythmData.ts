import type { TupletSpec } from "./rhythmParser";

export type { TupletSpec };

export interface RhythmPreset {
    id: string;
    category: string;
    timeSignature: string;
    easyScore: string;
    tuplets?: TupletSpec[];
}

export const RHYTHM_PRESETS: RhythmPreset[] = [
    {
        id: "gepunte-kwart-achtste",
        category: "Kwarten & Achtsten",
        timeSignature: "2/4",
        easyScore: "G4/q., G4/8"
    },
    {
        id: "8-8-8-16-16",
        category: "Achtsten & zestienden",
        timeSignature: "2/4",
        easyScore: "G4/8, G4/8, G4/8, G4/16, G4/16"
    },
    {
        id: "8-8-16-16-8",
        category: "Achtsten & zestienden",
        timeSignature: "2/4",
        easyScore: "G4/8, G4/8, G4/16, G4/16, G4/8"
    },
    {
        id: "syncope",
        category: "Syncope",
        timeSignature: "2/4",
        easyScore: "G4/8, G4/q, G4/8"
    },
    {
        id: "syncope_2",
        category: "Syncope",
        timeSignature: "2/4",
        easyScore: "G4/8, G4/8, B4/8/r, G4/8"
    },
    {
        id: "hop-figuur",
        category: "Hopfiguur",
        timeSignature: "2/4",
        easyScore: "G4/8., G4/16, G4/8, G4/8"
    },
    {
        id: "hop-figuur-2",
        category: "Hopfiguur",
        timeSignature: "2/4",
        easyScore: "G4/8, G4/8, G4/8., G4/16"
    },
    {
        id: "sixteenths_eighths_2_4",
        category: "Achtsten & zestienden",
        timeSignature: "2/4",
        easyScore: "G4/16, G4/16, G4/16, G4/16, G4/8, G4/8"
    },
    {
        id: "mixed_2_4",
        category: "Achtsten & zestienden",
        timeSignature: "2/4",
        easyScore: "G4/8, G4/16, G4/16, G4/q"
    },
    {
        id: "mixed_2_4_8",
        category: "Achtsten & zestienden",
        timeSignature: "2/4",
        easyScore: "G4/8, G4/16, G4/16, G4/16, G4/16, G4/16, G4/16"
    },
    {
        id: "mixed_2_4_8_reverse",
        category: "Achtsten & zestienden",
        timeSignature: "2/4",
        easyScore: "G4/16, G4/16, G4/16, G4/16, G4/8, G4/16, G4/16"
    },
    {
        id: "2-eights-triplet",
        category: "Triolen",
        timeSignature: "2/4",
        // Three eighths squeezed into the space of two, then two more eighths:
        // 1 beat of triplet + 1 beat = one full 2/4 bar. The "3:2" is carried by
        // the tuplet below rather than inline, because VexFlow cannot parse it.
        easyScore: "G4/8, G4/8, G4/8, G4/8, G4/8",
        tuplets: [{ start: 0, numNotes: 3, notesOccupied: 2 }]
    },
    {
        id: "two-dotted-4",
        category: "Achtsten & zestienden",
        timeSignature: "6/8",
        easyScore: "G4/4., G4/4."
    },
    {
        id: "two-4-and-8",
        category: "Achtsten & zestienden",
        timeSignature: "6/8",
        easyScore: "G4/4, G4/8, G4/4, G4/8"
    },
    {
        id: "two-3-8",
        category: "Achtsten & zestienden",
        timeSignature: "6/8",
        easyScore: "G4/8, G4/8, G4/8, G4/8, G4/8, G4/8"
    },
    {
        id: "1-and-3-8",
        category: "Achtsten & zestienden",
        timeSignature: "6/8",
        easyScore: "G4/4., G4/8, G4/8, G4/8"
    },
    {
        id: "3-8-and-8-4",
        category: "Achtsten & zestienden",
        timeSignature: "6/8",
        easyScore: "G4/8, G4/8, G4/8, G4/4, G4/8"
    }
];
