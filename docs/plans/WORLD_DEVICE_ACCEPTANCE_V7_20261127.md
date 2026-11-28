# Physical-device acceptance procedure: pocket worlds (V7, 2026-11-27)

The automated suites only prove touch in **browser emulation** (Chrome with `hasTouch`). Nothing in this campaign was tested on a real phone or tablet. This procedure is for the owner, about 30–40 minutes on one device. Record each result as PASS, FAIL (say what happened) or SKIPPED.

## Before you start

- **Build.** Use the rehearsal build (`VITE_POCKET_REHEARSAL=1`, as served by `playwright.rehearsal.config.ts`) or a preview URL with `?preview=<world ids>`. Ordinary production builds have no worlds active.
- **Device.** Note the model, OS version, browser and version.
- **Storage.** Use a private window, so no earlier passport affects the results.
- **Orientation.** Hold the device in landscape unless a step says otherwise.

## Controls to confirm once (any world)

| # | Check | Expected |
|---|---|---|
| C1 | Touch and drag on the left half of the screen | The visitor walks in the drag direction. Any deflection walks at full walking speed; touch never runs. |
| C2 | Drag on the right half | The view turns and pitches. It stops when you lift your finger, with no drift. |
| C3 | Tap the centre dot while it highlights an entrance or object | The entry dialog opens, or the object responds. |
| C4 | No keyboard key caps (`F`, `Enter`) appear anywhere in the HUD | Touch prompts only. |
| C5 | Open a world dialog, then tap **Enter**; inside, tap **Back to Museum** | You enter and return, and you can walk straight away. |
| C6 | Rotate to portrait and back | The HUD reflows, and the controls still work. |
| C7 | Settings → reduced motion on, then enter W09 or W10 | Camera motion is calmer, and nothing is missing that you need to progress. |

## Per world (enter, take the first steps, use the world's main action, leave)

| World | Entrance (walk there) | Main action to try |
|---|---|---|
| W01 | East lagoon pearl | Ride the first whale departure. Music starts, and stops on Back. |
| W02 | Western Fern Ravine anchor | Wake the root seed and climb the roots onto the growing bridge. |
| W03 | Sundial gnomon, south-west terrace | Ride the turnstile and the lift. |
| W04 | Inside the museum: east wing, E19 DexTilt | Activate a pad and build part of the bridge. |
| W05 | Roof, by the West Flank Ascent ramps: greenhouse flower | Grow one pad. |
| W06 | Roof: Flight Pad II console (do not step on the pad) | Take the parasol and glide once. |
| W07 | Inside: infra wing (north-east, upper floor), test-lab door | Pass through one portal pair. |
| W08 | Suspended droplet by the reflecting rill | Turn the first lens. |
| W09 | Ruined observatory orrery | Walk forward and watch the sky move; stand still and it stops. Push against a rail: the sky keeps moving (V7 fix). |
| W10 | Pier (after a stamp) or the roof destination | Walk and climb with the third-person camera; near cliffs the camera comes in, then eases back. |
| L01 | Lighthouse lens at the top of the stair | Climb and reach the lens. No stamp is awarded. |

For each world, record: whether you could reach the entrance by touch alone, whether entry and exit worked, any stutter at entry (count the hitches you can see), any control that didn't respond, and anything on screen that suggests a keyboard.

## Interruptions (pick two worlds)

| # | Check | Expected |
|---|---|---|
| I1 | Inside a world, switch to another app for 30 s, then come back | The world resumes or pauses cleanly, and controls work. |
| I2 | Lock the screen while a world is opening, then unlock | Either the world opens or the dialog offers a retry. You are never stuck. |
| I3 | Airplane mode, then try to enter a world not yet visited | **Production build only:** the dialog says "Passage did not open. You remain safely in the museum." Turn the network back on and the retry works. |

## Reporting

Send the table back with the device line from the start. A FAIL needs only one sentence and, if possible, a screenshot. These results are the only evidence that can change "physical-device touch: UNVERIFIED".
