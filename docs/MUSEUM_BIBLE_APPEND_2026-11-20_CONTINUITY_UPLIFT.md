# Pending Bible append — Museum of Me continuity uplift (2026-11-20)

**Persistence status: PENDING (temporary continuity note).** Ready to append to
`westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md`. Not appended: the work order did not grant
commit/push authority, and appending requires a commit and push to that repository. The Bible was read
at `61a2711efe9b74753fb22f6e5b96a8861f3d7fd2`.

---

## 2026-11-20 — Continuity uplift: stairwell traversal repair, five interface repairs, 21 improvements (IMPLEMENTED; LOCAL WORKING TREE ONLY)

- **Repository / base:** `westkitty/museum-of-me-vnext`, branch `claude/new-session-wyjula` at `666869587009e27ffd38a02ca1a181c0bc7419ca` (= `main` after #60). Uncommitted local working-tree change. Not pushed, merged or deployed.
- **CONTINUITY GAP RECORDED:** this Bible has no entries for merged #58 (first-entry/tour stalls), #59 (hidden secrets) and #60 (visitor guidance, collection access, exhibit signs). They are present in `main` source; their Bible entries are absent, not inferred here.
- **CONFIRMED DEFECTS REPAIRED (6):**
  - **D03 (severe):** the balcony ring slab and its collision covered both grand stairs. Visitors climbed through the floor and could not walk back down: on the balcony they stayed at y = 10 across the whole flight. The traversal test had passed because its walker settled waypoints onto surfaces up to 5 m above and never failed on a fall. Repaired with an open, railed well over each upper flight (one shared authority in `layout.ts`), an outward-only landing, and corrected test walkers (traversal helper and Workshop Visitor Jury). Consequence: the balcony is walkable as the north arc w–nw–n–ne–e between the two stair heads; the south pocket of the ring is no longer reachable (it held no exhibit or required route). **Owner review suggested.**
  - **D01** two welcome cards overlapping on first load; **D05** Enter button off-screen on 844×390 landscape phones; **D02** resume/menu button covering the key hints; **D04** contents (H) not left by Escape, with movement keys dead; **D06** hall planting standing in bay openings (E09 guide arrival put the eye inside a plant).
- **IMPROVEMENTS IMPLEMENTED (21):** grand stairs on both map floors; stair signage at feet and landings; return-to-Rotunda signs in dead-end halls; floor in the HUD location; arrival line names the exhibit; guide start states floor, distance and stairs; visitor-language threshold copy; arrival composition keeps the facade in view; HUD hint backing plate; interaction-cue settle (reduced-motion aware); museum styling for plain panel commands; project lifecycle stage chips (canonical status text unchanged); related rooms by exact project family; "where to find it" line; DexGPT position-aware stair directions; DexGPT contextual first question; floor and route per wing in the text contents; explicit exit from the contents; restore default settings with undo; touch menu parity (contents, curator, clear floor line); lifecycle stages in collection indexes.
- **NOT CHANGED:** 35 slots / 73 identities / 6 wings; exhibit hero objects; 14 source installations and 17 visitor conversations; single frame loop; persistence schemas; Dexter Sanctuary content (reached on foot, inspected, unchanged); DexGPT remains deterministic, offline and distinct from Dexter; no new dependency or network request. Sanctuary guide routing remains **PROPOSED**.
- **EVIDENCE (local, this session):** see `docs/CONTINUITY_UPLIFT_2026-11-20.md` and `OPERATIONAL_STATE.md` revision 100 for exact results; captures in `docs/evidence/continuity-uplift-20261120/`.
- **EVIDENCE STATES:** source IMPLEMENTED; automated and headless-Chromium checks VERIFIED as recorded; human visual acceptance, device FPS, audio and pointer-lock feel UNKNOWN; exact-head CI not run (nothing pushed).
- **NEXT DECISIONS:** whether to commit/push and open a PR; owner review of the stairwell architecture and the unreachable south balcony pocket; human walkthrough with `?qa=1`.
