# Pending Bible append — Museum of Me completion pass 5

**Persistence status: PENDING.** Ready to append to `westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md`.
Not appended: that repository is outside this work order's write authority.

---

## 2026-11-10 — Completion pass 5: Museum-wide caption legibility and typography repair (IMPLEMENTED; LOCAL ONLY)

- **Repository / base:** `westkitty/museum-of-me-vnext`, local branch `feat/completion-guide-and-drift-20261109` from `main` `a96d2f74bc2057d25a6cc324c4f79a4588144a16`. Continuing from `36c29a8d8ab7e6829341de83d688d1b21a62313d`. Not pushed, merged or deployed.
- **VERIFIED defects, repaired:**
  - Shared typography engine (`TextTexture.ts` & `Furniture.ts`):
    - Multi-tier canvas texture resolutions: 2048px canvas width for wide banners (`>= 3.2m`), 1024px for standard plates (`>= 1.2m`), 512px for small console/pedestal labels (`< 1.2m`). Eliminates pixelated text at typical visitor eye distance.
    - Proportional vertical padding for low-aspect strip banners: calculated as a fraction of canvas height (`Math.min(Math.round(canvasHeight * 0.16), Math.round(20 * scale))`), preventing runaway text shrinking down to unreadable single-pixel slivers.
    - Added explicit newline (`\n`) support in `TextTexture.ts`: allows curated line breaks at semantic boundaries rather than forcing arbitrary word wrapping.
    - Title font size floor raised to 22px in `fitTitle` to guarantee legible title headers on small plaques.
  - Physical exhibit layout & caption repairs across 11 bays:
    - E15 Agent Control & Capability Laboratory: Separated RepoForge compiler banner (`Y=3.85, Z=-5.3`) and predecessor lineage banner (`Y=4.85, Z=-6.55`), eliminating direct physical plate occlusion.
    - E16 Performance Capture & Media Transformation: Separated `LINEAGE` and `privacy` wall banners; raised `verifyLabel` (`CLEARCUT LOCAL`) to `(1.65, 3.65, -2.74)` clearing plinth shadow; raised `sourceLabel` (`CHARACTER PERFORMANCE CAPTURE`) to `(-2.05, 3.25, -2.65)` clearing mannequin head.
    - E35 Local Specialist Systems Lab: Mounted `wallLabel` (`Trust boundary — nothing crosses`) at `(0, 3.6, -1.55)` directly on the front face of the near partition post, eliminating post splitting caption in half.
    - E20 Utility & Privacy Bench: Moved `absent` (`There is no delete lever on this bench.`) to `(0, 3.75, -7.15)` on back wall unblocking museum wall plaque; lowered `meter` assembly down to `Y=1.35` onto bench surface, eliminating floating mid-air occlusion.
    - E11 Continuity Systems: Lineage banner formatted into clean two-line layout (`KinDex → Bible Repo → Selfsame\nHe-Maker / Project Sentinel → recovery evidence`) at `(-1.2, 4.35, -6.5)`, clearing `HE-MAKER · PROJECT RECOVERY`; table record cards formatted with bold state classification header over body text.
    - E30 AetherVFX: Arrow sequence formatted into structured two-line layout (`telegraph → travel → impact → field → residue\nmutation is state, not decoration`) at `(0, 4.35, -6.2)`, eliminating awkward 3-line word wrap.
    - E26 WestCat Systems: Lineage board and label moved to `(-2.3, 3.85, -6.6)` clear above `WESTCAT OVERLAY` and central artwork screen.
    - E34 BigMac Backbone: Raised receipt banner to `(0, 4.85, -6.4)` to clear daemon sphere at high DPI.
    - E08 Heliocide Observatory: Consolidated dual stacked black boxes on each witness pedestal into a single unified plaque (`${record.era}\n${record.label}`) at `(0, 2.05, 0)`, cutting visual obstruction in half.
    - E07 Terraforming Laboratory: Refined `status` banner at `(0, 4.35, -6.2)`.
    - E32 S'mores Katamari: Raised compression note to `Y=1.85` inside diorama.
- **Evidence:** 26 paired before/after screenshots in `docs/evidence/caption-repairs-pass5-20261110/`; `tests/caption-typography.test.ts` added (5 tests, all PASS); full canonical `npm run gate` PASS (781 unit tests / 61 files); standalone build and offline browser verification PASS (`runtime-source-qa` 14/14 installations and 17/17 visitors, 0 remote requests).
- **Product status:** ACTIVE DEVELOPMENT / PRE-1.0. Verdict: PARTIAL.
