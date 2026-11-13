# E30 Integration Hand-Off (`NOT AUTHORIZED`)

**Status:** Candidate only (`NOT AUTHORIZED` for production swap).

## Replacement Target
- Production incumbent slot: `src/exhibits/AetherVFX.ts` (registered under `E30` in `src/exhibits/index.ts`).
- Candidate entrypoint: `createCandidate(def: ExhibitDefinition): ExhibitModule` in `experiments/arena/replacements/E30-the-spell-that-leaves-a-scar/index.ts`.

## Production Parity & Safety Notes
- Preserves the frozen `ExhibitModule` interface via `ExhibitBase`.
- Fixes incumbent plinth encroachment (`plinthIntersections === 0`, down from 4 intersections in `AetherVFX.ts`) by placing the caster console at `z = -2.05` and the basin behind `z = -2.3`.
- No edits made to `src/exhibits/index.ts`, `data/`, or shared runtime code.
