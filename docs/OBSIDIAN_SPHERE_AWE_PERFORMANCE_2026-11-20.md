# Obsidian sphere — AWE and performance proof (2026-11-20)

## Authority and outcome

Owner authorized an actual vNext implementation, an AWE uplift, a performance repair, and a release subject to protected gates. The [original approach sketch](../docs/OBSIDIAN_SPHERE_THRESHOLD_2026-11-20.md) directs the spatial sequence: outdoor flanking fountains, separate ticket kiosk, dark round chamber with a central obstruction and two traversable routes, then the impossible larger atrium and galleries. The 73 identities / 35 exhibits / six wings, 14 source installations, 17 visitor records, Sanctuary, single world-transition seam, reduced motion, accessibility and offline behavior are protected.

**Creative hypothesis — not a proven audience emotion:** approaching a small, dark object that physically conceals the exit, then turning around a solid column to find an opening into a much larger, luminous hall should communicate the museum's central theme: it keeps becoming something more than the visitor expected. The user's movement causes the reveal.

## Three AWE challengers

| Candidate | Causal mechanism | Visitor agency and reinterpretation | Gate |
|---|---|---|---|
| **The Inverted Foyer (chosen)** | A real curved room, central occluder, open-sky oculus and three increasingly illuminated overhead arches frame the destination | Walk left or right around the column; the exit resolves as an earned architectural discovery rather than a cinematic cut | Source-grounded, keyboard/touch compatible, low-motion, measurable |
| Spectacle Storm | Particles and a fast animated portal rush | Passive spectacle, not a change in understanding | Rejected: GPU overhead, photosensitivity/comfort, false impression of an actual teleport |
| Archive Whisper | Chronological project voices or names appear inside the shell | Reflective gallery of historical development | Deferred: project-sourced individual narratives and approval required before asserting historical specifics |

The incumbent physical sphere and existing atrium remain valid. Only small, non-disruptive details from the chosen challenger were added; they do not introduce new exhibit content or a third render world.

## Signature moment (implementation)

1. From the garden, the dark sphere and its low lit outline read as a compact exterior object. The kiosk remains an ordinary world-space interaction.
2. At the outer arch, the solid central column interrupts the sightline. Both sides are actual collision-walkable routes.
3. Advancing around the column raises the chamber's bounded shadowless illumination. Three vault ribs become visible in order according to the visitor's Z position, not a countdown or click. The oculus exposes a small patch of the existing island sky above the centre.
4. Approaching the back aperture lights the exit frame; crossing the existing z=128 seam reveals the separately loaded, much larger atrium. The existing interior sequence begins with the azure Museum of Me hologram, followed by fountains, walls and floor.
5. Returning outside uses the same portal and continuous world shift. Reduced motion renders the vaults stably without pulsing or sudden camera motion.

**Human wow verdict:** UNKNOWN until visually observed and tested. Question for a reviewer: *Did the column and arch progression make the scale change understandable before you reached the interior?*

## Frozen performance benchmark

- Build A: draft PR #66, commit `f7bd90785144d19a26d4e2cfa9512d876b6f419d`, before batching/oculus/vault arches.
- Build B: commit `a94f6a245f92068fd6373ad5d66b1209fecb36f0`, after batching/oculus/vault arches and updated focused tests.
- Captured through one ordinary application renderer using the same Big Mac macOS, Playwright Chromium / SwiftShader setup, viewport 800 × 450 CSS px, DPR 0.5, low tier, QA exterior, stopped main loop; two warmed render() calls at camera [0,0,153] yaw 0 (outside) and [5,0,138] yaw 0 (inside). No alternate requestAnimationFrame was added. Results are matched geometry and draw-submission observations, **not** real-device FPS, GPU timings, thermal readings, p95 or p99 frame-time distributions.

| Metric | Build A | Build B | Delta |
|---|---:|---:|---:|
| Sphere renderable mesh objects | 46 | 16 | **−30 / −65.2%** |
| Exterior frame renderer draw calls | 521 | 490 | **−31 / −5.95%** |
| Chamber frame renderer draw calls | 393 | 385 | **−8 / −2.04%** |
| Renderer geometry allocations | 540 | 510 | **−30 / −5.56%** |
| Exterior frame triangles | 107,112 | 107,896 | +784 / +0.73% |
| Chamber frame triangles | 99,158 | 102,302 | +3,144 / +3.17% |
| Renderer textures | 11 | 11 | unchanged |

Source changes: wall-sector meshes replaced with one `THREE.InstancedMesh` retaining each oriented wall collider; twelve distinct meridian geometries merged into one tracked geometry and the temporary CPU geometries disposed; all additional vault geometry is generated once and materials are updated from the existing loop only. No new npm dependencies or remote assets. Source/build draw-call estimates must not be presented as a demonstrated sustained FPS improvement.

## Gate results and pending work

- **Local VERIFIED, scoped:** Typecheck and zero-warning ESLint passed after batching; Vitest `obsidian-entrance-2026-11-20.test.ts` (3), `uplift2-A.test.ts` (10), and `exterior-jury.test.ts` (4) passed after changes. Chromium render-submission baseline/candidate each passed.
- **Fixed CI mismatch:** Previously the I7 regression required no lights anywhere outdoors; one new shadowless point light is integral to the narrow chamber. The updated test permits exactly one named `obsidian-chamber-bounce` light, with castShadow false, bounded radius and solid central column.
- **Release pending:** Exact final-head full development, browser, Workshop and offline standalone checks; verified Pages SHA; real physical-device FPS and long-session resource settling; subjective visual quality. No conclusion of release readiness is justified from these bounded samples alone.
- **Rollback:** Revert only the feature PR or move the published pages-preview ref back to its independently verified prior SHA if a post-merge release regression is observed. Do not rewrite the user's Git history.
