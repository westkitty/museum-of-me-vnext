# Exhibit Kits re-review after the fixes (2026-11-13)

This follows up `../artistic-review-2026-11-12/`, where both kits were reviewed and not accepted. I measured the bundled library models from their real GLB files. Four of the defects came from the models themselves, not only from the kit layout.

| Defect seen on 2026-11-12 | Measured cause | Fix |
|---|---|---|
| The logging computer floats beside the desk | `computer_basic` is modelled with its base at 0.73 m, made to sit on `desk_basic`, whose top is at 0.71–0.77 m. The kit stood it on the floor beside the desk. | It now sits on the observing desk, with the keyboard toward the seat and the screen at the back. |
| The archive and star-chart "shelves" are blank slabs | The solid outer box of `bookshelf_basic` (1.0 × 1.8 × 0.34 m) seals in its shelves and all five books. | Replaced with `dresser_basic` drawer chests, labelled "Archive drawers" and "Star chart chest", with visible drawer fronts and pulls. |
| The document table clashes | It was the dark `artifact-table` prefab. | Replaced with `dining_table`, which uses the light-wood palette shared by the other parts. |
| The chair hovers (found in the close-up) | The "legs" of `dining_chair` are horizontal bars 0.19 m above the floor, so its seat hovers. | Replaced with `park_bench`, which stands on vertical legs and is as wide as the desk. Its labels are "Reading bench" and "Observer bench". |
| The telescope drum is detached | In `telescope_basic`, the tube does not touch its posts and the drum floats 0.12 m above the tube. | Owner decision (2026-11-13): replaced with `easel_basic`, labelled "Star chart easel". |

## Verdicts

- **Archive Research Station: accepted for template use.** It has a desk, a reading bench, two archive drawer chests and a document table, all in one wood palette.
- **Observatory Workstation: accepted for template use, with one caveat.** The easel's canvas is plain white in the source model, so "star chart" is carried only by the label.
- **Not covered by this acceptance:** acceptance applies to the template arrangement. No kit is installed in the museum, the canonical manifest still has 0 objects and 0 kits, and any real installation should be reviewed again in its interior bay.
- **Library models still available:** the defective library models (`bookshelf_basic`, `dining_chair` and `telescope_basic`) stay in the library for browsing. The kits just no longer use them.

## Regression tests

`tests/exhibit-kit-models.test.ts` loads the real bundled GLBs. It requires that:

- every kit part is a library model;
- no part of any kit model hovers or is detached from the model's base;
- no part is sealed inside another part;
- every kit part stands on the floor, or rests within the top of another kit part;
- floor-standing parts do not overlap.

On the 2026-11-12 templates, this test fails in all four of its checks.

The frames were captured in the real runtime with Google Chrome on the M1 GPU. Nothing was saved.
