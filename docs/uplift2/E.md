# Uplift 2 — sub-agent E: DexGPT guide, state/persistence, lifecycle

**Status: ACTIVE DEVELOPMENT / PRE-1.0.** One local commit on the worktree branch, based on `728fdea`.
Nothing pushed, merged or deployed. No human acceptance has been recorded for any item.

Area: `src/guide/DeterministicMuseumGuide.ts`, `src/state/*`, `src/ui/CuratorPanel.ts` (state line only),
`src/ui/MuseumGuidePanel.ts`, `src/app/Lifecycle.ts` (context loss, wake lock), new `src/render/ContextLossNotice.ts`.
This does not repeat uplift 1 items I15 (stair directions) or I16 (contextual first question).

Evidence states: **VERIFIED (browser)** means it ran in real Chromium (SwiftShader) on the dev server at port 4185,
with results in `docs/evidence/uplift2-E/browser-results.json`. **VERIFIED (unit)** means `tests/uplift2-e.test.ts` only.

## Improvements (8)

| # | Title | Weakness observed (baseline 728fdea) | Change | Files | Test | State |
|---|---|---|---|---|---|---|
| 1 | DexGPT compares two exhibits or projects | `compare Dex Voice Lab and The Full Weasel` answered about Dex Voice Lab only; `difference between E02 and E07` answered about E02 only | Finds every named record (no overlaps, plus exhibit ids). Sets two exhibits side by side: wing, floor, project count, stages, plaque, shared family, which ones are opened. Projects get kind, family and the verbatim status line. With only one name it asks for a second and offers real rooms that share a family | guide | unit ×4; browser `compare` | VERIFIED (browser) |
| 2 | DexGPT "what's nearby" | `what is nearby` returned the generic fallback | Position-aware: rooms on the same floor, the 6 closest in a straight line re-ranked by walking metres (existing `exhibitWalkDistance`), top 3, each marked opened or not yet opened. Plain answers outside the museum and in the Sanctuary, which it keeps apart from the collection | guide | unit ×3; browser `nearby` (4 / 18 / 36 m) | VERIFIED (browser) |
| 3 | DexGPT: how the projects in a room differ | `what changed between the projects in this room` gave the generic "You are at" paragraph | For the current or named room, gives each project its stage, its verbatim status line and its own authored `lesson`, plus a stage summary. It says it is not a timeline, because the collection has no finer dates than `period` | guide | unit ×2 | VERIFIED (unit). In the browser the visitor spot did not register an exhibit, so only the polite "not in a bay" decline was exercised |
| 4 | Fallbacks that suggest real matches | `starsilck` and `voice spaceship` both hit the dead-end fallback | Spelling correction against the collection's own vocabulary (edit distance ≤1, or ≤2 for words of 8+ letters, words of 5+ letters only), then the question is answered again with "I read X as Y". When no single exhibit matches every word, it says what each word finds on its own and names the words that found nothing | guide | unit ×3; browser `respell`, `partial` | VERIFIED (browser) |
| 5 | Return-visit continuity | `where did I leave off` answered **Local Specialist Systems Lab (E35)**, an unrelated room. Nothing welcomed a returning visitor | Recap from this device's journal: count, most recent rooms, bookmarks, notes, the saved floor-line target ("Carry on to …"), the next unopened room in the same wing, and "Back to …". Only when the journal already held visits at page load, the guide panel shows a "Welcome back" line and a "Where did I leave off?" chip. Nothing new is stored | guide, MuseumGuidePanel | unit ×4; browser welcome note, chip, recap | VERIFIED (browser) |
| 6 | Cross-tab journal consistency | Two open tabs: each saved its whole in-memory journal, so the last writer erased the other tab's visits. Measured: tab A visits E01, then tab B visits E02, and storage holds `E02` only | `Journal.save()` merges whatever another tab wrote since this tab last read (local changes kept, everything else follows storage, a clear made elsewhere is honoured, this tab's own clear is not undone). The new `reconcileExternal()` is wired to the existing `storage` listener | Journal, UILayer (4 lines) | unit ×4; browser two tabs | VERIFIED (browser): stored `E01,E02`, and each tab sees the other's visit |
| 7 | Storage failure shown to the visitor | Every store swallowed write errors (`catch { /* quota */ }`). Measured on a quota error: nothing thrown and no notice, so bookmarks and notes silently vanished on reload | New `PersistenceHealth`. The Journal, Preferences, Study, Visit Thread, Secrets and Installation stores report each write. The HUD announces once per change, and the Curator status line names which records are not kept, whether storage is full or blocked, and the remedy (Export session). The notice clears when writes succeed again. In-memory only | PersistenceHealth (new), 6 stores, CuratorPanel, UILayer (2 lines) | unit ×2; browser with `setItem` throwing `QuotaExceededError` | VERIFIED (browser) |
| 8 | WebGL context loss: visitor-language notice and a way out | The only sign was a 6-second HUD subtitle, "WebGL context lost. Waiting for restoration.", and nothing if the context never returned | `ContextLossNotice`: an accessible `role=alert` card in plain words that says the journal and settings are safe. After 10 s it offers "Reload the museum". On restore it says "The picture is back" and hides after 3.5 s. It adds no loop (two one-shot timers, cleared on dispose) and takes no focus. Supports reduced transparency, high contrast and forced colours | ContextLossNotice (new), uplift2-e.css (new), Lifecycle | unit ×2; browser via `WEBGL_lose_context` (lost → stalled → restored → hidden; loop stopped, then running) | VERIFIED (browser) |

DexGPT voice: every new answer speaks as the guide, is derived only from `collection.generated.ts`, the
journal and the visitor position, and is deterministic. A test checks that the new answers never claim to be Dexter.

## Defects found and repaired (not counted)

| ID | Defect | Measurement (baseline → after) | Fix | Test |
|---|---|---|---|---|
| D-E1 | Screen wake-lock leak. `UILayer.applyPreferences` calls `Lifecycle.syncWakeLock()` on every settings change, and each call requested a new sentinel and dropped the old one unreleased. Switching the setting off released only the last sentinel, so the screen stayed awake | Constructor plus five changes: requested 6, held 6, **5 still held after switching off** → requested 1, held 1, 0 after off | Idempotent sync: one sentinel, in-flight requests are shared, and the lock is released if the setting turned off mid-request | unit |
| D-E2 | Malformed journal entries accepted. `bookmarked: "yes"` showed as bookmarked, a missing `lastVisited` gave NaN sorting, a non-string note was coerced, and unreadable entries were dropped silently | Baseline: E03 kept `bookmarked:"yes"` with no `lastVisited`, and no notice → normalised entry and the notice "1 journal entry was unreadable and set aside (a copy is quarantined)…" | Per-entry `readEntries()` validation. An array `entries` field is quarantined | unit |

Measurements: a scratch script (not committed; `scratch-e/measure.ts` in the session scratchpad) ran baseline copies of `Journal.ts` and `Lifecycle.ts` from 728fdea next to the new ones.
Output: cross-tab `E02` → `E01,E02`; wake lock `{6,6,5}` → `{1,1,0}`; quota `{thrown:false, notice:null}`.

## Shared-file edits
- `src/app/UILayer.ts`: 2 imports; 4 lines in `onVisitThreadStorage` route the journal key to `reconcileExternal`; 2 lines subscribe `persistenceHealth` to `hud.announce`. Each is marked `uplift2(E)`.
- No edits to `museum.css`, `App.ts` or `HUD.ts`. Persistence schemas are unchanged: Journal stays v2 and no new keys are stored.

## Evidence
`docs/evidence/uplift2-E/`: `E1-dexgpt-compare.jpg`, `E2-dexgpt-nearby.jpg`, `E5-dexgpt-recap.jpg`, `E7-storage-full-curator.jpg`,
`E8-context-stalled.jpg`, `browser-results.json`. No external requests and no page errors were recorded in any browser scenario.

## Not verified
- Room-difference answer (#3) in the browser while standing inside a bay.
- Real GPU context loss (the browser run used the `WEBGL_lose_context` extension under SwiftShader); real quota exhaustion (simulated by a throwing `setItem`); the wake lock on real hardware.
- Human acceptance of the wording.
