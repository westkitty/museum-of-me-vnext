# Star chart on the Observatory easel (2026-11-13)

This closes the one caveat left by the 2026-11-13 kit re-review (`../artistic-review-2026-11-13/`): the easel's canvas was plain white, so only its label said "star chart".

## What changed

- **New `star-chart` prefab** (`src/workshop/StarChart.ts`): a 0.86 × 0.66 m sheet.
  - It is drawn procedurally into pixel data with a fixed seed: deep-blue paper, declination circles and hour lines, 220 stars of varied brightness, gold constellation figures joining nearby bright stars, and a cream double border.
  - It uses no image file, font or network, so nothing new needs licensing and the build is unchanged in kind.
  - It does not collide with visitors.
- **Observatory Workstation kit:** a new `star-chart` slot mounts the sheet flush on the easel's canvas. The bundled easel's white board spans x ±0.45 and y 0.65–1.35 m, with its front face at z 0.07. The chart sits 1 mm proud of that face and inside its edges.
- The chart is also available in the Workshop palette as "Star chart".

## Verification

- `tests/exhibit-kit-models.test.ts` measures the easel canvas from the real GLB and checks that the chart's back is within 0–2 mm of the canvas face and inside its edges. Moving the chart 1 cm off the canvas makes this check fail (gap 0.011 m > 0.002 m).
- `tests/star-chart.test.ts` checks four things:
  - the texture aspect matches the sheet;
  - the drawing is deterministic and opaque;
  - the paper is blue and the border cream;
  - there are more than 150 star pixels inside the border.
- Frames captured in the real runtime (Google Chrome on the M1 GPU), with the kit placed in the exterior test field. Six parts were resident, there were no page errors, and nothing was saved:

| File | View |
|---|---|
| `observatory-front.png` | Whole kit from the front |
| `observatory-oblique.png` | Elevated oblique |
| `observatory-easel-close.png` | Easel and kit together |
| `observatory-chart-detail.png` | The chart itself |

## Verdict

The easel now reads as a star chart without its label. Template acceptance stands. As before, an installed kit should still be reviewed in its interior bay.
