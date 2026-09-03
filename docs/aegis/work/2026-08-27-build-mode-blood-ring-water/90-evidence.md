# Build Mode, Blood Ring and water repair — evidence

## Evidence slots

- Evidence action / check performed: focused Vitest tests, `npm run test:workshop`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run gate`, `npm run build:standalone`, `npm run verify:standalone`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, and exact mapping hash comparison against task-start HEAD.
- Result / exit status: focused tests 30/30 PASS; Workshop proof PASS; browser suite 5/5 PASS; gate 26 files / 565 tests PASS; standalone static/offline/runtime proof PASS (14/14 installations, 17/17 visitors, 0 remote requests); audit PASS with 0 vulnerabilities; diff check PASS; `data/exhibit-mapping.json` hash unchanged at `d95f1d7d1617246e8baac23ffde5e710b1ba06dd92a8af9d8620d334d360966e`.
- Covered scope: Build Mode lifecycle and browser state, TransformControls activation, ordinary prompt handback, physical Blood Ring source contract, removal of old Blood Band shader, water shader lifecycle/reduced motion, existing Workshop conservation/save/persistence, ordinary browser paths, production leakage boundary, standalone offline behavior, dependency audit, mapping immutability.
- Uncovered scope: human visual appearance, perceptual ring scale/refraction/material quality, water realism/reflection quality, representative-device performance, pointer-lock feel outside the automated browser path, hosted deployment.
- Residual risk: human QA remains blocked/incomplete and must independently inspect the repaired experience; the repaired ring and water appearance are still unknown on a human/device pass.
- Confidence grade: B
