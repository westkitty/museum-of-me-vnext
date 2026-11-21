# E30 Candidate — The Spell That Leaves a Scar

- **Slot:** `E30` (`south` wing, Tier A · 15 MB)
- **Represented Project:** `P053` — `AetherVFX` (contained projectile -> impact -> field -> aftermath pipeline)
- **Architectural Thesis:** Every cast takes place inside a warded basalt containment chamber (`z in [-6.8, -2.5]`) completely clear of the bay center plinth (`PLINTH_BOX`). Each spell leaves a persistent physical terrain scar (`crater`, `frost`, `spire`, `quench`, `flashover`, `vitrified`, `cryoprism`) that materially changes subsequent spell outcomes, including lateral refraction beams into neighboring zones.

## Controls
1. **Cycle Spell:** `Cinder Lance` (Pyro), `Rime Surge` (Cryo), `Prism Lattice` (Crystal).
2. **Target Zone:** `West Basalt Rim`, `Central Conduit`, `East Quench Basin`.
3. **Cast Spell:** Fires arc projectile -> shockwave ring -> pooled instanced shard burst -> persistent scar assembly.
4. **Undo Last Cast:** Atomically restores exact pre-cast state stack and scar visuals.
5. **Reset Arena:** Clears all scars deterministically back to bare basalt.

## Verification
- Static checks: `tsc --noEmit`, `eslint --max-warnings 0`, zero allocations in `onUpdate`.
- Unit & Contract suite (`E30.test.ts`): frozen `ExhibitModule` contract, zero `ResourceScope` leaks on remount, zero plinth intersections, causal matrix & atomic undo checks.
- Browser WebGL suite (`E30.e2e.ts`): verified live projectile/scar rendering, console-error-free interaction, undo, reduced-motion, and reset in Chromium.
