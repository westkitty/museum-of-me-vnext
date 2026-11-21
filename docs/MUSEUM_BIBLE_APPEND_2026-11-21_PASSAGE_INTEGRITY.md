# Pending Bible append — passage integrity (2026-11-21)

**Persistence status: PENDING.** Ready to append to `westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md`; not appended (that repository is not attached to this session and no append was authorized).

---

## 2026-11-21 — Passage integrity: complete movement-based walkthrough and repairs (IMPLEMENTED; DRAFT PR #67, NOT MERGED)

- **Repository / base:** `westkitty/museum-of-me-vnext`, branch `claude/new-session-wyjula` from `main` `148c8d0` (PR #66). Not merged; not published.
- **Method:**
  - an authoritative passage inventory (`src/world/passages.ts`: 57 passages, 169 lanes);
  - every lane walked inbound and back out in the real app with the real controller and assembled collision world;
  - a visible-geometry walk-through probe;
  - a continuous no-teleport grand tour (ticket by F, sphere, seam, 35 exhibits, Sanctuary, exit and re-entry).
- **Result:** baseline 43/57 passages and 152/169 lanes; after **57/57 and 169/169**, 35/35 visitor spots, 0 walk-through visuals. Grand tour 2,179 m.
- **Root causes repaired:**
  - wall colliders padding into openings, and fat diagonal walls;
  - installation plinths in 13/13 host bay doorways (setback; wall returns at E01/E08/E14);
  - oversized installation and sphere-column colliders;
  - curved-stair surface up to ~1.3 m off the treads at the edges (oriented ramps);
  - benches, pilasters, skirting, jambs, decor and plants in doorways;
  - blank white vestibule panels and walk-through door columns;
  - facade piers in the inner portal;
  - the opaque backdrop wall and arch at the sphere's inner exit.
- **Added:** wading movement in the obsidian chamber (62%, eased). Predictive preparation from the pier junction.
- **Preserved:** 73/35/6, 14 installations (footprints unchanged), 17 visitors, Sanctuary, E09, single loop, the seam, Workshop and offline behaviour. No lights at the seam (0 new programs at entry, measured).
- **Evidence states:**
  - Local gate, 84/84 Playwright and offline standalone: VERIFIED.
  - Exact-head CI: see PR #67.
  - Real-device FPS, real-network timing and human visual acceptance: UNKNOWN.
- **Next decisions:**
  - owner review of the narrower E01/E08/E14 doorways and the retoned seam buffer;
  - release approval for merge and Pages.
