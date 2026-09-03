/**
 * E02 source grounding.
 *
 * The project ledger and the laboratory's CANON_BOUNDARIES.md agree on the
 * 37-entry frame (Egg, 35 strains in five archetypes, Mother). The laboratory
 * names four representative *processes*, not five biological archetypes. This
 * exhibit therefore presents those process references and one clearly marked
 * taxonomy abstraction; it does not invent specimen morphology or names.
 */
export const DRAKKEN_SOURCE_BASIS = {
  entryCount: 37,
  eggCount: 1,
  strainCount: 35,
  archetypeCount: 5,
  strainsPerArchetype: 7,
  motherCount: 1,
  sources: [
    'Archaeology PROJECT_LEDGER.csv (P002)',
    'The-Drakken-Terraforming-Laboratory/docs/CANON_BOUNDARIES.md',
  ],
} as const;

export interface DrakkenReferenceStation {
  readonly name: string;
  readonly semanticType: 'canonical process function' | 'museum taxonomy abstraction';
  readonly colour: number;
  /** Deliberately abstract display geometry, not canon morphology. */
  readonly glyph: readonly [number, number, number, number];
  readonly note: string;
}

export const DRAKKEN_REFERENCE_STATIONS: readonly DrakkenReferenceStation[] = [
  {
    name: 'Fault-Tongue', semanticType: 'canonical process function', colour: 0xa35b4b,
    glyph: [0.40, 2.3, 3, 7],
    note: 'A source-supported process reference for structural splitting and geological fracture.',
  },
  {
    name: 'Cloudmaw', semanticType: 'canonical process function', colour: 0x4f8eae,
    glyph: [0.56, 1.4, 5, 4],
    note: 'A source-supported process reference for radical planetary hydrology; it redistributes existing water.',
  },
  {
    name: 'Gorevault', semanticType: 'canonical process function', colour: 0x8a3a3a,
    glyph: [0.62, 1.5, 6, 3],
    note: 'Collection, gathering, rendering, separation, refinement, storage and conversion of planetary matter into prepared feedstock.',
  },
  {
    name: 'Ringthroat', semanticType: 'canonical process function', colour: 0x5f9bd6,
    glyph: [0.78, 1.1, 3, 12],
    note: 'Downstream of prepared feedstock: lift, extrusion and sky or orbital construction. It is not Gorevault.',
  },
  {
    name: 'Five-archetype frame', semanticType: 'museum taxonomy abstraction', colour: 0x8a7ab5,
    glyph: [0.50, 1.8, 5, 5],
    note: 'The source fixes five archetypes and seven strains in each, but this preserved source set does not name or describe the remaining representatives.',
  },
] as const;
