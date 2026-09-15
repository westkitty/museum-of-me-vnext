# Museum of Me — Forensic Uplift Ledger (2026-09-15)

**Status:** local automated verification complete. Exact-head remote CI remains pending until this branch is committed and pushed. Human visual/feel acceptance remains distinct and unverified.

This ledger exists to prevent count laundering. Each row has one primary category only. UI presentation and underlying mechanics are separated only where they have independently observable behavior and acceptance evidence. Documentation itself is not counted.

## Corrections discovered during the pass

| ID | Correction | Evidence | State |
|---|---|---|---|
| CORR-01 | Command Palette recent actions no longer become inert merely because the current query changed; recent execution resolves against all current actions. | `src/ui/CommandPalette.ts` | IMPLEMENTED |
| CORR-02 | DexGPT is included in the authoritative modal-input list so closing another panel cannot prematurely release movement behind it. | `src/app/UILayer.ts` | IMPLEMENTED |
| CORR-03 | DexGPT is disposed with the rest of the UI instead of leaking its DOM surface/listeners for the app lifetime. | `src/app/UILayer.ts` | IMPLEMENTED |
| CORR-04 | Accessible collection copy no longer hard-codes the historical 64-project count; it derives the current collection and exposes Visit Thread parity. | `src/accessibility/DomMirror.ts` | IMPLEMENTED |

## UI/UX

| ID | Implemented improvement | Primary evidence | Proof requirement | State |
|---|---|---|---|---|
| UIUX-01 | Theme preset cards present each itinerary mode with explanatory copy | `src/ui/VisitThreadPanel.ts` | browser Visit Thread flow | IMPLEMENTED |
| UIUX-02 | Pace controls show the concrete stop count before selection | `src/ui/VisitThreadPanel.ts` | browser Visit Thread flow | IMPLEMENTED |
| UIUX-03 | Topic and wing focus controls make route narrowing visible and explicit | `src/ui/VisitThreadPanel.ts` | typecheck + browser flow | IMPLEMENTED |
| UIUX-04 | Visit-history and bookmark bias options are exposed as understandable toggles | `src/ui/VisitThreadPanel.ts` | typecheck + browser flow | IMPLEMENTED |
| UIUX-05 | Active routes use numbered, structured stop cards instead of a flat button list | `src/ui/VisitThreadPanel.ts` | browser Visit Thread flow | IMPLEMENTED |
| UIUX-06 | Reached, skipped, current, and upcoming stops have text state plus aria-current semantics | `src/ui/VisitThreadPanel.ts` | browser current-state assertion | IMPLEMENTED |
| UIUX-07 | A live route summary exposes next stop and remaining itinerary state without implying completion score | `src/ui/VisitThreadPanel.ts` | browser Visit Thread flow | IMPLEMENTED |
| UIUX-08 | The museum map renders numbered itinerary markers at actual exhibit doorways | `src/ui/MapPanel.ts` | browser map assertion | IMPLEMENTED |
| UIUX-09 | Same-floor itinerary stops are connected by a restrained route-link overlay on the real plan | `src/ui/MapPanel.ts` | browser map assertion | IMPLEMENTED |
| UIUX-10 | Map copy explicitly distinguishes itinerary markers from museum completion | `src/ui/MapPanel.ts` | browser map assertion | IMPLEMENTED |
| UIUX-11 | A compact persistent HUD chip shows the active thread without becoming a score bar | `src/ui/HUD.ts` | browser HUD assertion | IMPLEMENTED |
| UIUX-12 | Small screens switch modal panels to a bottom-sheet layout sized to the viewport | `src/ui/museum.css` | narrow Chromium viewport | IMPLEMENTED |
| UIUX-13 | Small-screen panel headers stay visible with sticky positioning during long routes | `src/ui/museum.css` | narrow Chromium viewport | IMPLEMENTED |
| UIUX-14 | Thread and journal controls use touch-sized minimum targets on narrow screens | `src/ui/museum.css` | narrow Chromium target measurement | IMPLEMENTED |
| UIUX-15 | New thread surfaces honor the existing reduced-transparency preference | `src/ui/museum.css` | source contract + full build | IMPLEMENTED |
| UIUX-16 | New thread and journal surfaces have explicit high-contrast states | `src/ui/museum.css` | source contract + full build | IMPLEMENTED |
| UIUX-17 | New route, journal, and preview surfaces support forced-colors mode | `src/ui/museum.css` | source contract + full build | IMPLEMENTED |
| UIUX-18 | The Journal is reorganized into toolbar, controls, results, editor, status, and destructive zones | `src/ui/JournalPanel.ts` | typecheck + browser journal surface | IMPLEMENTED |
| UIUX-19 | The Journal grid and editor collapse cleanly to one column on narrow screens | `src/ui/museum.css` | narrow Chromium journal assertion | IMPLEMENTED |
| UIUX-20 | Journal filtering reports a live visible-result count instead of silently changing the grid | `src/ui/JournalPanel.ts` | typecheck + DOM semantics | IMPLEMENTED |

## Gameplay / Interaction

| ID | Implemented improvement | Primary evidence | Proof requirement | State |
|---|---|---|---|---|
| GAME-01 | Highlights planning preferentially selects collection anchor exhibits | `src/state/VisitThread.ts` | tests/visit-thread.test.ts | IMPLEMENTED |
| GAME-02 | Systems planning ranks continuity, infrastructure, authority, agent, and architecture material | `src/state/VisitThread.ts` | tests/visit-thread.test.ts | IMPLEMENTED |
| GAME-03 | Making planning ranks media, prompt, performance, animation, design, and production material | `src/state/VisitThread.ts` | tests/visit-thread.test.ts | IMPLEMENTED |
| GAME-04 | Play planning ranks games, simulations, VFX, abilities, and exploratory work | `src/state/VisitThread.ts` | tests/visit-thread.test.ts | IMPLEMENTED |
| GAME-05 | Wildcard planning produces deterministic seed-dependent left-turn routes | `src/state/VisitThread.ts` | wildcard determinism test | IMPLEMENTED |
| GAME-06 | Bookmark planning can construct a route from the visitor’s marked exhibits | `src/state/VisitThread.ts` | bookmark route test | IMPLEMENTED |
| GAME-07 | Quick pace produces a three-stop route | `src/state/VisitThread.ts` | pace tests | IMPLEMENTED |
| GAME-08 | Standard pace produces a five-stop route | `src/state/VisitThread.ts` | pace tests | IMPLEMENTED |
| GAME-09 | Deep pace produces an eight-stop route | `src/state/VisitThread.ts` | pace tests | IMPLEMENTED |
| GAME-10 | Avoid-visited mode materially penalizes already-opened exhibits | `src/state/VisitThread.ts` | avoid-visited test | IMPLEMENTED |
| GAME-11 | Prefer-bookmarks mode gives marked exhibits extra route weight without making them mandatory | `src/state/VisitThread.ts` | planner tests | IMPLEMENTED |
| GAME-12 | Topic terms alter route ranking using actual local exhibit/project text | `src/state/VisitThread.ts` | topic ranking test | IMPLEMENTED |
| GAME-13 | A route can be restricted to one real museum wing | `src/state/VisitThread.ts` | wing focus test | IMPLEMENTED |
| GAME-14 | Initial route selection structurally limits overconcentration to two stops per wing | `src/state/VisitThread.ts` | diversity test | IMPLEMENTED |
| GAME-15 | Route ordering prefers the visitor’s current wing when it is represented | `src/state/VisitThread.ts` | current-wing order test | IMPLEMENTED |
| GAME-16 | Interacting with the current itinerary stop advances the route | `src/app/App.ts + src/state/VisitThread.ts` | auto-advance test + browser integration | IMPLEMENTED |
| GAME-17 | Visiting a later itinerary stop out of order records it without jerking the current cursor | `src/state/VisitThread.ts` | out-of-order visit test | IMPLEMENTED |
| GAME-18 | The visitor can deliberately skip the current stop | `src/state/VisitThread.ts` | state transition test | IMPLEMENTED |
| GAME-19 | The visitor can step back to a previous itinerary stop | `src/state/VisitThread.ts` | state transition test | IMPLEMENTED |
| GAME-20 | A thread completes only when every stop is reached or deliberately skipped | `src/state/VisitThread.ts` | completion/archive test | IMPLEMENTED |

## Backend / Technical

| ID | Implemented improvement | Primary evidence | Proof requirement | State |
|---|---|---|---|---|
| BACK-01 | Persisted Visit Thread state is wrapped in SHA-256 integrity metadata | `src/state/VisitThread.ts` | integrity persistence test | IMPLEMENTED |
| BACK-02 | Visit Thread persistence carries an explicit schema version | `src/state/VisitThread.ts` | future-schema test | IMPLEMENTED |
| BACK-03 | Thread imports and stored payloads are capped at 128 KiB | `src/state/VisitThread.ts` | constants + focused tests | IMPLEMENTED |
| BACK-04 | Persisted route ids are restricted to real collection exhibits | `src/state/VisitThread.ts` | sanitization test | IMPLEMENTED |
| BACK-05 | Duplicate route ids are removed during sanitization | `src/state/VisitThread.ts` | sanitization test | IMPLEMENTED |
| BACK-06 | Route state is bounded to at most twelve stops | `src/state/VisitThread.ts` | bounded editing + sanitization tests | IMPLEMENTED |
| BACK-07 | Persisted cursors are clamped to the sanitized route | `src/state/VisitThread.ts` | sanitization test | IMPLEMENTED |
| BACK-08 | Completed/skipped state is normalized to route membership and completion wins conflicts | `src/state/VisitThread.ts` | sanitizeVisitThreadState coverage | IMPLEMENTED |
| BACK-09 | Recent itinerary history is bounded to eight entries | `src/state/VisitThread.ts` | bounded archive implementation | IMPLEMENTED |
| BACK-10 | Every persisted mutation snapshots the previous thread state first | `src/state/VisitThread.ts` | backup/restore test | IMPLEMENTED |
| BACK-11 | A valid previous thread snapshot can be restored without discarding it | `src/state/VisitThread.ts` | backup/restore test | IMPLEMENTED |
| BACK-12 | Malformed persisted JSON is quarantined with reason evidence | `src/state/VisitThread.ts` | malformed quarantine test | IMPLEMENTED |
| BACK-13 | Integrity-tampered thread state is quarantined instead of trusted | `src/state/VisitThread.ts` | tamper quarantine test | IMPLEMENTED |
| BACK-14 | Future thread schemas are rejected and quarantined rather than guessed | `src/state/VisitThread.ts` | future-schema test | IMPLEMENTED |
| BACK-15 | Mutations operate on a sanitized cloned draft rather than directly trusting current object state | `src/state/VisitThread.ts` | commit implementation + focused suite | IMPLEMENTED |
| BACK-16 | Persisted mutations carry monotonically refreshed revision/update metadata | `src/state/VisitThread.ts` | persistence implementation + cross-tab test | IMPLEMENTED |
| BACK-17 | Each thread instance has a writer identity for storage reconciliation | `src/state/VisitThread.ts` | cross-tab reconciliation test | IMPLEMENTED |
| BACK-18 | Route planning is a pure function with no Journal persistence side effect | `src/state/VisitThread.ts` | planner purity test | IMPLEMENTED |
| BACK-19 | Wildcard selection uses a stable local hash instead of runtime randomness | `src/state/VisitThread.ts` | same-seed/different-seed test | IMPLEMENTED |
| BACK-20 | Topic scoring bounds normalized query tokens before applying them to collection text | `src/state/VisitThread.ts` | planner implementation + topic test | IMPLEMENTED |

## Quality of Life

| ID | Implemented improvement | Primary evidence | Proof requirement | State |
|---|---|---|---|---|
| QOL-01 | T opens Visit Thread as a first-class keyboard shortcut | `src/player/Input.ts` | input isolation tests + browser flow | IMPLEMENTED |
| QOL-02 | The command palette exposes Visit Thread as a searchable global action | `src/app/UILayer.ts` | browser/command integration | IMPLEMENTED |
| QOL-03 | DexGPT control help teaches the Visit Thread shortcut alongside existing controls | `src/guide/DeterministicMuseumGuide.ts` | guide test | IMPLEMENTED |
| QOL-04 | An empty Journal offers a direct Build a Visit Thread recovery path | `src/ui/JournalPanel.ts` | typecheck + browser surface | IMPLEMENTED |
| QOL-05 | A populated Journal keeps Visit Thread one action away in its toolbar | `src/ui/JournalPanel.ts` | typecheck + browser surface | IMPLEMENTED |
| QOL-06 | Journal entries can be searched by exhibit, wing, project, or personal note text | `src/ui/JournalPanel.ts` | Journal implementation + runtime review | IMPLEMENTED |
| QOL-07 | Journal entries can be filtered to all, bookmarked, or noted items | `src/ui/JournalPanel.ts` | Journal implementation + runtime review | IMPLEMENTED |
| QOL-08 | Journal entries can be sorted by recent visit, first visit, or title | `src/ui/JournalPanel.ts` | Journal implementation + runtime review | IMPLEMENTED |
| QOL-09 | Notes edit the explicitly selected journal entry instead of always the latest visit | `src/ui/JournalPanel.ts` | selected-entry implementation | IMPLEMENTED |
| QOL-10 | A journal note can be copied to the clipboard with visible success/failure feedback | `src/ui/JournalPanel.ts` | clipboard path + fallback message | IMPLEMENTED |
| QOL-11 | A journal note can be cleared without clearing the rest of the journal | `src/ui/JournalPanel.ts` | clear-note action | IMPLEMENTED |
| QOL-12 | Bookmarks can be toggled inline from journal cards without opening the deep record | `src/ui/JournalPanel.ts` | inline bookmark action | IMPLEMENTED |
| QOL-13 | A no-results Journal state has a one-action reset back to all entries | `src/ui/JournalPanel.ts` | no-results recovery action | IMPLEMENTED |
| QOL-14 | Clearing the entire journal requires explicit destructive confirmation | `src/ui/JournalPanel.ts` | confirm guard | IMPLEMENTED |
| QOL-15 | Active routes have an exhibit search for adding a stop without hunting through the map | `src/ui/VisitThreadPanel.ts` | add-stop search + bounded add test | IMPLEMENTED |
| QOL-16 | Stops can be reordered in place without rebuilding the thread | `src/ui/VisitThreadPanel.ts + src/state/VisitThread.ts` | bounded editing test | IMPLEMENTED |
| QOL-17 | Previous-stop navigation immediately restores floor-line guidance to that stop | `src/ui/VisitThreadPanel.ts` | runtime Visit Thread interaction | IMPLEMENTED |
| QOL-18 | Skipping a stop immediately guides to the next remaining stop | `src/ui/VisitThreadPanel.ts` | runtime Visit Thread interaction | IMPLEMENTED |
| QOL-19 | Ending a thread clears stale floor-line guidance instead of leaving a dead target | `src/ui/VisitThreadPanel.ts` | end action integration | IMPLEMENTED |
| QOL-20 | The HUD thread chip is itself an affordance that reopens the active thread | `src/ui/HUD.ts` | browser HUD interaction surface | IMPLEMENTED |

## Features

| ID | Implemented improvement | Primary evidence | Proof requirement | State |
|---|---|---|---|---|
| FEAT-01 | A visitor can build and start a local self-guided Visit Thread from current collection state | `src/ui/VisitThreadPanel.ts + src/state/VisitThread.ts` | browser Visit Thread flow | IMPLEMENTED |
| FEAT-02 | An active thread can be paused while preserving its route and cursor | `src/state/VisitThread.ts` | pause/resume test | IMPLEMENTED |
| FEAT-03 | A paused thread can be resumed without rebuilding it | `src/state/VisitThread.ts` | pause/resume test | IMPLEMENTED |
| FEAT-04 | Any stop in an active thread can become the current guided stop | `src/state/VisitThread.ts` | direct stop selection test | IMPLEMENTED |
| FEAT-05 | An active route can be reversed while preserving the current subject | `src/state/VisitThread.ts` | state transition test | IMPLEMENTED |
| FEAT-06 | A thread can be restarted from its first stop with completion/skip state cleared | `src/state/VisitThread.ts` | state transition test | IMPLEMENTED |
| FEAT-07 | A real collection exhibit can be added to an active bounded thread | `src/state/VisitThread.ts` | bounded editing test | IMPLEMENTED |
| FEAT-08 | A stop can be removed from a thread without mutating the collection | `src/state/VisitThread.ts` | bounded editing test | IMPLEMENTED |
| FEAT-09 | A visitor can end an active thread independently of museum access | `src/state/VisitThread.ts` | end/archive implementation | IMPLEMENTED |
| FEAT-10 | Finished or manually ended threads are retained in bounded local recent history | `src/state/VisitThread.ts` | archive tests | IMPLEMENTED |
| FEAT-11 | A recent thread can be replayed as a fresh active itinerary | `src/state/VisitThread.ts` | replay test | IMPLEMENTED |
| FEAT-12 | Visit Thread state can be exported as integrity-bearing JSON | `src/ui/VisitThreadPanel.ts + src/state/VisitThread.ts` | export payload tests | IMPLEMENTED |
| FEAT-13 | Imported Visit Thread JSON receives a non-mutating preview before acceptance | `src/state/VisitThread.ts` | import preview test | IMPLEMENTED |
| FEAT-14 | A confirmed import can replace current itinerary state with sanitized data | `src/ui/VisitThreadPanel.ts + src/state/VisitThread.ts` | import apply test | IMPLEMENTED |
| FEAT-15 | The UI can restore the prior valid Visit Thread snapshot after a bad change/import | `src/ui/VisitThreadPanel.ts + src/state/VisitThread.ts` | backup/restore test | IMPLEMENTED |
| FEAT-16 | Whole-session export now carries Visit Thread state beside journal, study, and preferences | `src/app/UILayer.ts` | integration/full gate | IMPLEMENTED |
| FEAT-17 | Whole-session import can restore embedded Visit Thread state through its validator | `src/app/UILayer.ts` | integration/full gate | IMPLEMENTED |
| FEAT-18 | Visit Thread state reconciles newer writes from another browser tab and announces the change | `src/app/UILayer.ts + src/state/VisitThread.ts` | cross-tab reconciliation test | IMPLEMENTED |
| FEAT-19 | An itinerary can be copied as readable plain text for sharing or reference | `src/ui/VisitThreadPanel.ts` | clipboard path + runtime surface | IMPLEMENTED |
| FEAT-20 | The builder provides a non-mutating route preview, including a deterministic wildcard reshuffle path | `src/ui/VisitThreadPanel.ts` | browser preview assertion + planner purity test | IMPLEMENTED |

## WOW-ME

| ID | Capability | Why it is additional | Evidence | State |
|---|---|---|---|---|
| WOW-01 | **Thread Weave** deterministically explains why each itinerary stop was selected and writes a metadata-grounded bridge between adjacent exhibits; DexGPT can answer “why this stop?” from the same live route state. | It is an interpretive layer on top of the 100 counted improvements, not one of their category rows. It turns a route into a locally generated story about the work without adding a remote model, second collection database, teleportation, or gamified scoring. | `src/state/ThreadWeave.ts`, `src/ui/VisitThreadPanel.ts`, `src/guide/DeterministicMuseumGuide.ts`, `tests/thread-weave.test.ts` | IMPLEMENTED + AUTOMATED VERIFIED |

## Count gate

- UI/UX: 20 / 20 implemented
- Gameplay / interaction: 20 / 20 implemented
- Backend / technical: 20 / 20 implemented
- Quality of life: 20 / 20 implemented
- Features: 20 / 20 implemented
- WOW-ME: 1 / 1 implemented
- Duplicate IDs: 0
- Cross-category duplicate rows: prohibited; re-audit before closure.

## Automated verification closure

- Focused repaired Journal Chromium regression: PASS.
- Full production Chromium suite: 9/9 PASS.
- Canonical `npm run gate`: PASS — 31 test files / 610 tests, release tools, mapping/content/privacy/frame-loop/hotpath/asset/exhibit/source-parity validators, QA, production build, budgets, and `verify:dist`.
- Standalone build + `npm run verify:standalone`: PASS — offline browser boot, 14/14 installations, 17/17 authored visitor conversations, 0 remote requests.
- Development-only `npm run test:workshop`: PASS; checked-in Workshop placement source remained unchanged.
- Production dependency audit: PASS — 0 vulnerabilities at `--omit=dev --audit-level=high`.
- `git diff --check`: PASS.
- Pre-existing `src/content/collection.generated.ts` remains byte-identical to the preserved pre-task snapshot and is excluded from authored staging.
- Human visual composition, subjective interaction feel, pointer-lock feel, audio judgement, and representative-device FPS remain human evidence gaps; none are promoted by these automated checks.

## Protected invariants

- 35 physical exhibit slots and six wings remain authoritative.
- Collection access remains non-gated; Visit Thread is optional orientation, not progression.
- No scores, badges, achievements, or mandatory completion path are introduced.
- Wayfinding remains guidance only; it never teleports the visitor.
- Single application loop, existing collision authority, ResourceScope disposal, offline/privacy boundaries, Source Installations, Source Visitors, Dexter Sanctuary separation, Workshop conservation, and deferred Full Weasel behavior remain protected.
- Pre-existing deterministic `src/content/collection.generated.ts` working-tree output is preserved and must not be claimed as authored by this pass.

## Verification rule

Focused tests establish individual mechanics and technical guards. Browser checks establish representative real DOM/runtime paths and responsive layout. The canonical repository gate, standalone/offline verification, and diff-scope review remain mandatory before any commit/push closure claim. Human visual/feel judgment remains distinct from automated proof.
