# Append-ready Bible entry: V7 (not appended)

Target: `westkitty/ChatGPT_Bible_Repo`, file `bibles/Museum_of_Me_Bible.md`. The file is append-only.

- **Already published:** the W01 r125, eleven-world, V3, V5 and V6 entries.
- **To publish:** append the entry below after the V6 entry, and only with owner authorization. Nothing here duplicates the earlier entries.

---

### 2026-11-27 — V7 world production: W01 and W09 defects closed, every entrance on foot, long session, Dexter seam guard, governed performance trials (local; NOT COMPLETE FOR PRODUCTION)

- **VERIFIED LOCAL: W01 aim miss closed.**
  - The V6 "unexplained displacement" was the keyboard test walker overshooting at full run on a slow host. It was reproduced by starving the test runner.
  - The walker now predicts its stop, settles and rechecks.
  - The W01 world is unchanged.
- **VERIFIED LOCAL: W09 meteor-cascade softlock repaired.**
  - A visitor pinned by a stone that moves only with time could not move time.
  - A blocked movement intent now advances the clock at walking pace. Stillness and frozen states still stop it.
  - Owner acceptance of the rule change is pending.
- **VERIFIED LOCAL (browser emulation): every entrance on foot.**
  - Interior: W04 and W07, through the front door and the authored passages, including the grand stair.
  - Roof: W05, W06 and the W10 roof, by the West Flank Ascent.
  - With the V6 ground approaches, all eleven worlds are reached from the pier without placement.
- **VERIFIED LOCAL: long-session lifecycle.**
  - Two passes over six worlds, with completions, early exits and failed and interrupted loads through the dialog.
  - Resources return flat.
- **VERIFIED LOCAL: Esc while a world opens now cancels it.** Final qualification found that Esc during "Opening…" was ignored once focus left the disabled Enter button, so the world opened anyway. Focus now waits on Back; a regression test covers it.
- **VERIFIED LOCAL: Dexter identity gate enforced in code.** W10's character comes only through a guarded selection that needs owner approval with provenance and the technical contract. The rig remains TEST-ONLY; no likeness was made.
- **Performance:** FAILED, attribution unresolved. The final candidate ran three admissible-start trials on a frozen tree: 8/12, 10/12 and 9/12. The misses were p99s at 33 ms (two 60 Hz frames) and second-entry worst frames of 83 and 233 ms. Peak host load during those trials was 15–35, against 5 during baseline-1, which passed 12/12 on effectively the same measured code. A matched A/B on a quiet machine is the owner's call.
- **Qualification:**
  - Gate PASS (1,462 tests; initial bundle 12.58 MB / 20 MB).
  - World suite 83/87 on the first full run. All four failures were diagnosed and pass on rerun: two were the touch test walker on moving supports (W03 gear, W08 pad; fixed), one an unexplained intermittent W09 time-dial aim miss, and one a product defect (Esc during "Opening…" was ignored; fixed, with a new regression test).
  - Rehearsal 5/5 with Metal; a first run without Metal was invalid (0/5). The failed-load test was re-run on the final tree, 1/1.
  - Physical-device touch NOT ATTEMPTED; owner procedure written.
- **Published to PR #83** at the owner's request (2026-11-27).
- **Not done:** no merge, deploy or production activation.
