# Append-ready Bible entry (not yet appended)

Target: `westkitty/ChatGPT_Bible_Repo` → `bibles/Museum_of_Me_Bible.md` (append-only).

State of the local Bible clone on 2026-11-27 (read only; nothing written):

- `/Users/andrew/museum of me/ChatGPT_Bible_Repo` is at `a9294b2`.
- Its uncommitted changes are a modified `bibles/Museum_of_Me_Bible.md` and a stray `.DS_Store`. The modification holds the earlier W01, eleven-world and V3 appends; see [the V5 append-ready entry](BIBLE_APPEND_READY_V5_20261126.md).
- The V5 entry itself is also still unappended.

To publish:

1. Fast-forward the clone, keeping its local append.
2. Append the V5 entry, then the entry below.
3. Commit with owner authorization.

---

### 2026-11-27 — V6 world production: construction performance, eleven touch journeys, authentic sessions, distribution, Dexter readiness (local; NOT COMPLETE FOR PRODUCTION)

- **Exterior walk performance.**
  - **VERIFIED LOCAL, repair.** Interior construction now yields at safe boundaries inside each former long step (`BuildSteps`).
  - **VERIFIED LOCAL, matched A/B.** Exterior-walk p99 went from 33.3–50.0 ms (V5) to 16.8 ms (V6) in 5/5 pairs.
  - **`perf:device` on the exact candidate:** FAIL in all four runs (4–6/12) under heavy machine contention: even idle missed, and a matched control of the build that passed 12/12 earlier failed equally. Not attributed to code; repeated-trial acceptance NOT MET.
- **VERIFIED LOCAL, browser-emulated touch.** Full touch journeys passed for all eleven worlds (11/11). Physical-device touch is UNVERIFIED.
- **VERIFIED LOCAL, natural approaches.**
  - Seven ground entrances are reached on foot from the pier.
  - Interior and rooftop entrances still use labelled diagnostic placement.
- **VERIFIED LOCAL, cross-world sessions on foot.**
  - Earned progression W09 → W10 → L01 ×2, by keyboard and by touch. No stamp inflation; resources and music return flat; the persistent passport is untouched.
  - Early exits across four worlds.
- **Distribution.**
  - **VERIFIED LOCAL, reduction.** Unreferenced builder-catalog files are pruned from public builds. The checker-counted size went 17.54 → 12.58 MB with the 20 MB rule unchanged; all eleven worlds active is about 15.7 MB.
  - `verify:dist` now rejects any world chunk, orphan stem or rehearsal code in an ordinary build.
  - **VERIFIED LOCAL, rehearsals 5/5:**
    - staged prefixes;
    - earned progression in the production build;
    - failed and interrupted loads;
    - activated offline package.
- **VERIFIED LOCAL, defect fixed.** After a failed world download, the entry dialog's Esc now works without a click.
- **VERIFIED LOCAL, finishing.** W10's third-person camera keeps the character in view against cliffs: boom 5.42 → 3.98 m with the visitor's back to the rock.
- **VERIFIED LOCAL, Dexter readiness.**
  - W10 drives its character only through the `DexterCharacter` seam.
  - Asset contract and validator done.
  - A model-production handoff is written.
  - Still `TEST_ONLY_NOT_APPROVED_DEXTER`; no model made or substituted.
- **Qualification on the exact candidate.**
  - Gate PASS (153 files / 1,458 tests).
  - Content isolation PASS.
  - Workshop 16/16.
  - Standalone PASS.
  - Rehearsal 5/5.
- **Not green in one invocation.**
  - World suite 74/76: a W01 aim miss (passed on rerun; cause unexplained) and a W09 touch pinch point (route fixed; the passing rerun never reached the pinch).
  - Standard suite 115/119: interruption hooks out of date after the stepwise build; 119 + 1 skip after the fix.
- **PENDING OWNER.**
  - Per-world visual/audio acceptance.
  - Approved W10 Dexter model.
  - Physical-device touch.
  - Headed representative-device performance.
  - Budget definition (Option A/B).
  - W09 cascade pinch-point design.
  - Interior-chunk laziness.
- **State.** Branch `feat/world-production-20261126` committed and pushed to `origin` at the owner's request. Local checkpoint `refs/checkpoints/world-production-v6-final-local`. No merge, no deploy, no production activation.
