# Museum Workshop hardening — evidence record

## Evidence slots

- Evidence action / check performed: Replayed the full local validation ladder after the conservation/save response repair: typecheck, focused Workshop tests, production build, five-test ordinary Chromium suite, Workshop authoring proof, standalone rebuild/offline verifier/runtime source QA, canonical gate, and production dependency audit.
- Result / exit status: All named checks exited 0. Workshop focused tests: 16/16. Ordinary browser suite: 5/5. Canonical gate: 26 files / 565 tests plus validators/build/budget/release-dist checks. Audit: 0 vulnerabilities. Standalone source QA: 14/14 installations and 17/17 authored visitor conversations, zero remote requests.
- Covered scope: Current feature-branch source, real client Workshop path, loopback save bridge, deterministic conservation rules, direct runtime construction, author-to-visitor standalone path, ordinary visitor browser journeys, production static output, and production dependency surface.
- Uncovered scope: Human visual/audio/pointer-lock/device-performance acceptance; merge/main/release publication; external Bible update.
- Residual risk: Human QA remains intentionally manual and authoritative; the implementation commit is covered by exact-head CI run `33042038232`.
- Confidence grade: A

## Root-cause record

The prior browser failure was not an assertion defect. In run `33038039499`, software WebGL continued rendering while the first `?qa=1` test executed semantic QA actions; the telemetry-capture click reached the 30-second timeout although four later tests passed. Stopping the real Museum loop immediately after boot preserves boot evidence while preventing renderer starvation of protocol actions. The repaired local five-test suite passed without removing or weakening assertions, and exact-head CI run `33042038232` passed all four jobs on implementation commit `5c591e630b31df9d96a620ce5a2b29c689523407`.
