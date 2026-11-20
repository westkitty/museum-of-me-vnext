# Uplift 2 — Agent D: HUD, input, accessibility, mobile and settings

**Status: ACTIVE DEVELOPMENT / PRE-1.0.** Local commit in an agent worktree only; nothing pushed, merged or
deployed. Base: `728fdea` (uplift 1). No human acceptance has been recorded for any item below.

Evidence states: **VERIFIED (browser)** = measured in real headless Chromium (Playwright, SwiftShader WebGL)
against the running dev server, with the real frame pipeline; **VERIFIED (unit)** = `tests/uplift2-D.test.ts`.
"Before" values for CSS items were measured in the same page with this agent's stylesheet disabled; "before"
values for script items were measured on the unmodified `728fdea` build earlier in the session.

## Improvements (8)

| # | Title | Weakness observed (evidence) | Change | Files | Test | State |
|---|---|---|---|---|---|---|
| 1 | Close stays in view in long panels | At interface scale 1.6, Settings content is 2,563 px in a 617 px panel; scrolled to the end the Close button sat at y = −2,051 (off-screen). Header was only sticky below 720 px width | Panel heading + Close are sticky at every width; short-landscape (≤500 px tall) layout trims chrome and respects safe-area insets | `src/ui/uplift2-D.css` (imported by `Panel.ts`) | browser: Close rect inside panel after scrolling (before `visible:false`, after top 92 px) | VERIFIED (browser) |
| 2 | Form controls follow scale and touch size | Command-palette field was 185 × 21 px with the browser's fixed 13.3 px font at scale 1.6 (body 25.6 px); results 21 px tall; on an 844 × 390 touch phone 36 controls across Settings / Command / Study / Thread / DexGPT were < 44 px (checkboxes 13 px, ranges 16 px, plain buttons 36 px) | Panel inputs/selects inherit the interface font; museum field style; full-width palette field; ≥ 44 px controls, checkbox rows and plain buttons on coarse pointers | `src/ui/uplift2-D.css` | browser: field 955 × 64 px, font 23.6 px; phone targets < 44 px: 36 → 0 | VERIFIED (browser) |
| 3 | Dialogs named and described by what is on screen | Every panel used `aria-label` only; the visible kicker ("Comfort and accessibility", "Where you are"…) was not exposed; the touch Museum menu had an empty subtitle | `aria-labelledby` → visible `h2`, `aria-describedby` → kicker (kept in sync by `setHeading`); menu kicker "Visitor tools" | `Panel.ts`, `VisitorMenuPanel.ts` | browser: 8 panels resolve name + description; `getByRole('dialog', {name:'Museum map'})` | VERIFIED (browser) |
| 4 | Command palette is a real combobox | Selection shown only by `data-selected` outline; no `role`, `aria-activedescendant`, result count or key hint; ArrowUp at the top stuck; selected row could leave the scrolled view; refocus put the caret at the start | `role=combobox` field + `role=listbox` / `option` results with `aria-selected`, active-descendant, wrap-around arrows, PageUp/PageDown by 5, scroll-into-view, caret kept at end, persistent polite status ("24 results. Up and Down arrows choose…") | `CommandPalette.ts`, CSS | unit: `moveCommandSelection`, `commandStatusText`; browser: ArrowUp from 0 → option 11, selected, in view, focus stays in field | VERIFIED (browser + unit) |
| 5 | Settings explained, linked and spoken with units | 3 settings had no explanation; hints were not connected to controls; selects' labels had no `for`; slider values were bare numbers ("65", "1.00") | Every control has a hint linked by `aria-describedby`; labels associated; `aria-valuetext` + visible output with units (65°, 160 %, ×1.20) updated live while dragging | `SettingsPanel.ts` | unit: `settingValueText`; browser: 19/19 controls labelled + described; FOV drag → camera 80° and "80°" spoken | VERIFIED (browser + unit) |
| 6 | Touch look sensitivity | `touchSensitivity` was stored and sanitised but never used or shown; touch look was scaled by *mouse* sensitivity | New "Touch look sensitivity" slider; `touchLookGain()` makes touch independent of mouse (default gain unchanged at 1.6); included in Restore defaults; screen rotation ends a held virtual stick (`resetTransient` on `orientationchange`) | `Input.ts`, `SettingsPanel.ts`, `Lifecycle.ts`, `App.ts` (2 lines, marked) | unit: gain + real `applyLook`; browser: yaw per drag identical at mouse ×1/×2, doubles at touch ×2; stick 0.8/−1 → 0/0 after rotation | VERIFIED (browser + unit) |
| 7 | Visible, recoverable paused 3D view | On a real WebGL context loss the loop stopped and the only signal was a polite subtitle "WebGL context lost. Waiting for restoration." with no way out | Persistent `role=alert` notice in visitor language with a 44 px "Reload the museum" button; after 8 s without restoration it recommends reloading; hidden again on restore | `src/ui/PauseNotice.ts`, `Lifecycle.ts`, CSS | unit: `pauseNoticeFor`; browser: `WEBGL_lose_context` → notice visible, loop stopped; restore → notice hidden, loop running | VERIFIED (browser + unit) |
| 8 | Camera comfort on step-ups | Measured with the real controller on the canonical route: the camera rose 0.543 m in one 1/60 s step at the grand-stair foot, 0.55 m entering the Sanctuary, and 20 × 0.214 m snaps on the Sanctuary return flight | Camera-only exponential ease (τ = 75 ms) after walked rises > 8 cm; collision, step-up rule, bindings and movement basis unchanged; ramps untouched; teleport/flight clear it | `PlayerController.ts` | unit: body still rises > 0.5 m in one step, camera max per-step rise < 0.15 m, settles to eye height, lag < 10 % after 0.25 s | VERIFIED (unit) |

## Defects repaired (not counted)

| ID | Defect | Evidence | Repair | Verification |
|---|---|---|---|---|
| D-1 | Slider ranges disagreed with persistence clamps: Mouse sensitivity offered 0.3–2.5 but stored 0.45–2.25; Interface scale offered 0.8 but stored ≥ 0.85, so a chosen value silently changed on reload | `sanitizePreferences` vs `SettingsPanel` literals | `SETTING_RANGES` equals the sanitiser clamps | unit: both ends of every slider survive `sanitizePreferences` |
| D-2 | Closing a panel opened from inside another panel (Journal → "Build a Visit Thread instead" → Escape) left keyboard focus on an element inside the now-hidden dialog | browser: `activeElement` = hidden `.panel__body` | `restoreFocusAfterClose`: opener only if still focusable and visible, else the topmost open panel, else the page | browser: focus = body, 0 open panels, W walks 1.56 m |

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint . --max-warnings 0` | PASS |
| `npx vitest run` | PASS — 1063/1063 tests, 112 files (11 new in `tests/uplift2-D.test.ts`) |
| Browser script (scratch, real Chromium, 1280 × 720 and 844 × 390 touch) | 12/12 checks PASS |
| Not run (per brief) | `npm run test:e2e`, `npm run gate` |

Captures: `docs/evidence/uplift2-D/` (SwiftShader; colours approximate).

## Limits

- Real touch hardware, real screen readers (NVDA/VoiceOver), real notched devices (safe-area values are 0 in
  headless Chromium) and human comfort judgement of the step easing are UNVERIFIED.
- The context-loss path was exercised with `WEBGL_lose_context`, not a real driver reset.
- Shared files touched: `src/app/App.ts` (import + two marked lines for touch gain). `HUD.ts` and
  `UILayer.ts` unchanged; `museum.css` unchanged.
