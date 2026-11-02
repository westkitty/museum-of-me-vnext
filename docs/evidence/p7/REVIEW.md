# P7 visual and performance evidence

Status: engineering evidence captured; human visual approval remains pending.

## Capture identity

- Project: `westkitty/museum-of-me-vnext`
- Feature branch: `feature/exterior-first-impossible-threshold-20261102`
- Runtime implementation source: P6 runtime commit `ff720e697fc6b6356c1fbac0b94507d42ba57e8d`; P7 changes the camera capture, traversal and offline proof harnesses, not visitor runtime source.
- Browser: Playwright Chromium 151, 1280 × 720 CSS pixels, device pixel ratio 1, medium quality for canonical camera views. The renderer reports Google ANGLE / Vulkan / SwiftShader. This is software-rendered browser evidence, not physical GPU or mobile-device performance.
- Screenshots are actual Three.js visitor-runtime canvas captures from the production scene and camera code. Canonical QA positions come from `docs/references/exterior-island/REFERENCE_MANIFEST.md`. Capture code calls the camera-follow sky, lighting and exterior updates before rendering.

## Reference-image provenance

The user supplied the six reference views and states that their original bytes match the handoff hashes. The canonical append-only Bible records the exact hash list, JPEG/JFIF signatures under `.png` filenames, 1536 × 1536 dimensions and the verified ZIP hash at remote Bible commit `d33dfb1fe00086099520293dfcedfd3c95e6e140`. The originals and ZIP are not checked into this implementation repository.

The six image attachments available to this execution were materialized as true-PNG clipboard previews. Their local file hashes differ from the locked source hashes, so these previews were used only to compare visible content; they are not claimed as byte-verification copies. No reference image was converted, replaced or added to the museum repository.

The standalone source views `1000230572.png`–`1000230575.png` are the visual comparison authority. The two 2×2 composites (`1000230571.png`, `1000230568.png`) provide atmosphere only; their mirrored panels are not treated as simultaneous geometry states.

## Visual comparison

| Locked view | Evidence | Result | Observation |
|---|---|---|---|
| `front-south` vs. `1000230573.png` | [front-south.png](front-south.png), [ground-pier.png](ground-pier.png) | PARTIAL | The centered doorway, twin roof wings, dome and axial stair approach are present. The locked camera sits close to the entrance terrace, so its framing omits much of the distant pier and elevated reference composition. The runtime materials and foliage read more subdued and faceted than the illustration. |
| `east-lagoon` vs. `1000230574.png` / `1000230575.png` | [east-lagoon.png](east-lagoon.png) | PARTIAL | The lagoon and east roof profile share the intended side relationship. The camera crops the wider island route and the vegetation density/material finish is simpler than the source view. |
| `west-woodland` vs. `1000230575.png` | [west-woodland.png](west-woodland.png) | PARTIAL | The west flank and perimeter woodland are present; the screenshot does not make the complete northwest spire garden and island loop as legible as the reference. |
| `high-topdown` vs. `1000230572.png` | [high-topdown.png](high-topdown.png) | PARTIAL | The spatial ordering is coherent: museum centered, lagoon east, gold-spire garden northwest and pier south. The locked view is dark and tightly framed, and does not communicate the complete island silhouette with the clarity of the source image. |
| `rear-north` (no matching standalone rear reference) | [rear-north.png](rear-north.png) | PARTIAL | The rear shell is closed and both roof wings continue across the north end. Landscape massing and rear facade detail remain much simpler than the illustrative treatment. |
| Walking threshold and return | [interior-threshold.png](interior-threshold.png), [exterior-return.png](exterior-return.png) | PARTIAL | The real keyboard route traverses the stairs and terrace, reveals the larger indoor volume and returns through the same threshold. The screenshots show the low-tier SwiftShader run and are not an aesthetic or hardware acceptance sample. |

The screenshots support a `PARTIAL` technical comparison, not a 100% fidelity claim. No controlled pixel-difference score is reported: reference perspectives, exposure, render style and source encoding are not equivalent. **Human visual approval: PENDING.**

## Performance sample

One cold-context exterior-start and entrance-preparation sample was emitted by `tests/browser/predictive-interior.e2e.ts` on the local Vite development server, with no network shaping. The test browser used Chromium 151 / SwiftShader, 1280 × 720, DPR 1, low quality and automatic frame cap. Quality is deliberately low for this semantic telemetry journey so the serial software-renderer suite can keep processing frames; this sample is not a hardware performance acceptance run.

| Metric | Observation |
|---|---:|
| First useful exterior input | 4,710 ms |
| Cold navigation response transfer | 1,989 bytes |
| Initial same-origin resource transfer | 4,112,009 bytes across 97 entries |
| Initial resources naming the interior module | 0 |
| Interior module request transfer on approach | 35,526 bytes (Vite development server) |
| Interior module request → loaded | 5,476.4 ms |
| Interior build start → build complete | 12,249.7 ms |
| Entrance readiness after request | 20,606.6 ms |
| Threshold commit → first interior frame | 874.2 ms |
| First interior render call | 873.7 ms |
| Exterior sample frame intervals, 37 samples | p50 566.6 ms; p95 666.7 ms; p99 851 ms |
| Long task maximum in the preparation sample | 812 ms |
| Sampled draws / triangles / geometries / textures | 217 / 45,584 / 158 / 4 |

These values document the software-renderer scenario and must not be read as physical GPU timing. P0 recorded a 9.31 MB built initial artifact, not browser `transferSize` under this same scenario; therefore the P0-to-P7 first-transfer and first-use performance comparison is **UNVERIFIED**. The observed frame intervals and long task are not a 60 FPS pass. Physical tablet/phone performance, sustained temperature, battery and touch-route acceptance remain **UNVERIFIED**.
