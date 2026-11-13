# E26 Candidate — Reality Becomes a Cartridge

- **Slot:** `E26` (`south` wing, Tier C · 4 MB)
- **Represented Projects:** `P037` (`WESTCAT Overlay`) + `P038` (`WestCat Goes East`)
- **Architectural Thesis:** Unfolds a synthetic coastal topographic diorama into a genuinely playable 5-stage 3D platformer cartridge with real gap-jump traversal, reversible back to map mode, alongside an independent translucent non-blocking WESTCAT telemetry overlay (`depthWrite: false`, click-through).

## Verification
- `E26.test.ts`: frozen contract, Tier C budget check, 0 leaks, fold/reverse parity, full 5-stage playability & gap-slip behavior.
- `E26.e2e.ts`: live Chromium WebGL rendering for both Diorama and unfolded Cartridge + Overlay states.
