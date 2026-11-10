# Pending Bible append — Museum of Me completion pass 1

**Persistence status: PENDING.** Ready to append to `westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md`.
Not appended: that repository is outside this work order's write authority. Canonical Bible read at local HEAD `b462d57`.

---

## 2026-11-09 — Completion pass 1: collection-count drift and deterministic guide comprehension (IMPLEMENTED; LOCAL ONLY)

- **Repository / base:** `westkitty/museum-of-me-vnext`, local branch `feat/completion-guide-and-drift-20261109` from `main` `a96d2f74bc2057d25a6cc324c4f79a4588144a16`. Not pushed, merged or deployed.
- **VERIFIED defect, repaired:** two visitor-facing sentences (E27 plaque; The Full Weasel deep text) still said "sixty-four projects" against a 73-project living collection. Corrected, and `validate:content` now rejects any stated project/exhibit total that disagrees with the data.
- **VERIFIED defect, repaired:** the local DexGPT guide could not answer ordinary visitor questions (named project inside a sentence, subject search, "what is this museum", "what am I looking at", status questions). It now can, still deterministically and offline, from the generated collection, the Journal and the visitor's location only.
- **Preserved:** Dexter is not DexGPT; the guide says so explicitly and gives no wayfinding action for Dexter. No online inference, no new dependency, no new exhibit slot, no progression.
- **Evidence:** `npm run gate` PASS (768 unit tests); Chromium `museum.e2e.ts` 9/9 PASS; live dev-server check of the guide panel at E27.
- **UNVERIFIED at this revision:** standalone/offline, Workshop and Pages proofs; the wider Chromium suite; all nine human acceptance judgments.
- **Still BRAINSTORMED, not promoted:** star-collapse consequences, Games-wing traversal rewards, Westcat guide presentation, theater wing, live guide backend.
- **Product status:** ACTIVE DEVELOPMENT / PRE-1.0. Verdict: PARTIAL.
