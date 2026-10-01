# Runtime Source QA — 14 installations, 17 conversations

> **Historical result, not a fresh 2026-10-01 pass.** The PASS below is preserved from an earlier
> offline browser run; its original execution date is not embedded in this report. A fresh current
> attempt could not launch because Playwright Chromium 151 was missing and its CDN download failed.
> Current status is **BLOCKED before assertions**, not PASS/FAIL for the candidate. See
> [`OPERATIONAL_STATE.md`](../../OPERATIONAL_STATE.md) and the dated
> [`quality uplift report`](QUALITY_UPLIFT_2026-10-01.md).

**VERDICT: PASS (historical run only)**

Evidence source: the canonical standalone artifact, booted from a `file://`
URL with the browser context offline. Every assertion below ran against the
real production `App`: the real scene graph, the real `InteractionManager`
raycast from the real camera, the real `PlayerController` and `CollisionWorld`,
the real installation state machines, the real `Journal` and the real
persistence store. No mocks and no test-only implementations.

- Boot zone: `plaza`
- First-person traversal from the visitor start: 233.3 m, zones plaza → south → rotunda → north
- Dexter Sanctuary reached by walking the real route: yes (final zone `sanctuary`, floor y=-5.00)
- Requests while offline: 1 total, 0 remote

## 14 source primary installations

| # | Installation | Host | Focus | Engage | Controls driven | State moved | Persisted | Restored | Journal | Reset | Thesis parts | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Starsilk Atlas (`starsilk-atlas`) | E01 | yes | yes | 6 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 2 | Drakken Terraforming Sandbox (`drakken-sandbox`) | E07 | yes | yes | 8 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 3 | Orbital Tomb Visual Timeline (`orbital-tomb`) | E03 | yes | yes | 3 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 4 | S'mores Katamari (`smores-katamari`) | E32 | yes | yes | 5 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 5 | WestCat Goes East (`westcat-east`) | E26 | yes | yes | 5 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 6 | Parable (`parable`) | E31 | yes | yes | 4 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 7 | Vibe Coding Nexus (`vibe-nexus`) | E14 | yes | yes | 4 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 8 | WESTCAT Familiar (`westcat-familiar`) | E26 | yes | yes | 6 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 9 | Heliocide Control Room (`heliocide`) | E08 | yes | yes | 5 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 10 | DexDictate (`dexdictate`) | E17 | yes | yes | 4 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 11 | Relay Link / TabletLink (`tablet-link`) | E18 | yes | yes | 2 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 12 | OSINT Box (`osint-box`) | E23 | yes | yes | 6 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 13 | DexVault / Vault Architect (`dexvault`) | E20 | yes | yes | 5 | yes | yes | yes | yes | yes | 5/5 | **PASS** |
| 14 | DexGPT / Dexter's Sanctuary (`dexgpt`) | sanctuary | yes | yes | 5 | yes | yes | yes | yes | yes | 1/1 | **PASS** |

### Per-control transitions

**Starsilk Atlas** — final state: `First Blood Rings — Y3 · Contradictions and confidence`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Previous era | `ArrowLeft` | yes | yes | Fringe Strikes — Y0 · Administration containment |
| Next era | `ArrowRight` | yes | yes | First Blood Rings — Y3 · Administration containment |
| Administration | `Digit1` | NO | NO | First Blood Rings — Y3 · Administration containment |
| Drakken | `Digit2` | yes | yes | First Blood Rings — Y3 · Drakken transformation |
| Starbinding | `Digit3` | yes | yes | First Blood Rings — Y3 · Starbinding consequence |
| Contradictions | `Digit4` | yes | yes | First Blood Rings — Y3 · Contradictions and confidence |

**Drakken Terraforming Sandbox** — final state: `Pyric / Solar · assault step 0/5 · actual condition`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Pyric / Solar | `Digit1` | NO | NO | Pyric / Solar · assault step 0/5 · actual condition |
| Seismic / Stone | `Digit2` | yes | yes | Seismic / Stone · assault step 0/5 · actual condition |
| Oceanic / Cloud | `Digit3` | yes | yes | Oceanic / Cloud · assault step 0/5 · actual condition |
| Air / Vacuum | `Digit4` | yes | yes | Air / Vacuum · assault step 0/5 · actual condition |
| Bio / Soil | `Digit5` | yes | yes | Bio / Soil · assault step 0/5 · actual condition |
| Advance assault | `Space` | yes | yes | Bio / Soil · assault step 1/5 · actual condition |
| Official / actual | `KeyO` | yes | yes | Bio / Soil · assault step 1/5 · official report |
| Reset | `KeyR` | yes | yes | Pyric / Solar · assault step 0/5 · actual condition |

**Orbital Tomb Visual Timeline** — final state: `Meridian month 0/6`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Earlier month | `ArrowLeft` | NO | NO | Meridian month 0/6 |
| Later month | `ArrowRight` | yes | yes | Meridian month 1/6 |
| Reset timeline | `KeyR` | yes | yes | Meridian month 0/6 |

**S'mores Katamari** — final state: `0/15 objects collected · scale 0.34`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Forward | `KeyW` | yes | NO | 0/15 objects collected · scale 0.34 |
| Left | `KeyA` | yes | NO | 0/15 objects collected · scale 0.34 |
| Brake / reverse | `KeyS` | yes | NO | 0/15 objects collected · scale 0.34 |
| Right | `KeyD` | yes | NO | 0/15 objects collected · scale 0.34 |
| Reset miniature | `KeyR` | NO | NO | 0/15 objects collected · scale 0.34 |

**WestCat Goes East** — final state: `Dry streets · route 0.00/10`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Dry streets | `Digit1` | NO | NO | Dry streets · route 0.00/10 |
| Rain traction | `Digit2` | yes | yes | Rain traction · route 0.00/10 |
| Ferry rhythm | `Digit3` | yes | yes | Ferry rhythm · route 0.00/10 |
| Advance route | `Space` | yes | yes | Ferry rhythm · route 0.80/10 |
| Reset route | `KeyR` | yes | yes | Dry streets · route 0.00/10 |

**Parable** — final state: `Ritual unarmed · None · 0 casts`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Arm clockwise spiral | `KeyC` | yes | yes | Ritual armed · None · 0 casts |
| Vertical zigzag / Fireball | `KeyF` | yes | yes | Ritual unarmed · Fireball · 1 casts |
| Downward line / Rain | `KeyN` | NO | NO | Ritual unarmed · Fireball · 1 casts |
| Restart world | `KeyX` | yes | yes | Ritual unarmed · None · 0 casts |

**Vibe Coding Nexus** — final state: `Purpose preserved · phase 0/4 · 0 failures`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Preserve purpose | `Digit1` | NO | NO | Purpose preserved · phase 0/4 · 0 failures |
| Generic shortcut | `Digit2` | yes | yes | Generic shortcut · phase 0/4 · 1 failures |
| Advance compiler | `Space` | yes | yes | Generic shortcut · phase 1/4 · 1 failures |
| Reset | `KeyR` | yes | yes | Purpose preserved · phase 0/4 · 0 failures |

**WESTCAT Familiar** — final state: `Focus · watching`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Focus mode | `Digit1` | NO | NO | Focus · watching |
| Check-in mode | `Digit2` | yes | yes | Check-in · idle |
| Explore mode | `Digit3` | yes | yes | Explore · watching |
| Inspect mode | `Digit4` | yes | yes | Inspect · judging |
| Advance state | `Space` | yes | yes | Inspect · alert |
| Reset | `KeyR` | yes | yes | Focus · watching |

**Heliocide Control Room** — final state: `Phase 0/5 · awaiting command · no record`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Begin sequence | `KeyB` | yes | yes | Phase 1/5 · awaiting command · BEGIN |
| Next command state | `Space` | yes | yes | Phase 2/5 · awaiting command · BEGIN / STATUS |
| Hold | `KeyH` | NO | NO | Phase 2/5 · awaiting command · BEGIN / STATUS |
| Authorize | `KeyA` | NO | NO | Phase 2/5 · awaiting command · BEGIN / STATUS |
| Reset | `KeyR` | yes | yes | Phase 0/5 · awaiting command · no record |

**DexDictate** — final state: `hold mode · Idle · 0 local insertions`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Hold-to-talk mode | `KeyH` | NO | NO | hold mode · Idle · 0 local insertions |
| Toggle mode | `KeyT` | yes | yes | toggle mode · Idle · 0 local insertions |
| Start / stop capture | `Space` | yes | yes | toggle mode · Capturing · 0 local insertions |
| Clear demonstration | `KeyR` | yes | yes | hold mode · Idle · 0 local insertions |

**Relay Link / TabletLink** — final state: `Disconnected`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Advance connection | `Space` | yes | yes | Discovery |
| Reset connection | `KeyR` | yes | yes | Disconnected |

**OSINT Box** — final state: `URL · ArchiveBox · step 0`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| URL seed | `Digit1` | NO | NO | URL · ArchiveBox · step 0 |
| Domain seed | `Digit2` | yes | yes | authorized domain · theHarvester · step 0 |
| Username seed | `Digit3` | yes | yes | authorized username · Maigret · step 0 |
| Local file seed | `Digit4` | yes | yes | local file · ExifTool · step 0 |
| Advance safe route | `Space` | yes | yes | local file · ExifTool · step 1 |
| Reset | `KeyR` | yes | yes | URL · ArchiveBox · step 0 |

**DexVault / Vault Architect** — final state: `Canon constraint · retrieval step 0/3`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Canon query | `Digit1` | NO | NO | Canon constraint · retrieval step 0/3 |
| Project query | `Digit2` | yes | yes | Project state · retrieval step 0/3 |
| Contradiction query | `Digit3` | yes | yes | Contradiction check · retrieval step 0/3 |
| Run retrieval step | `Space` | yes | yes | Contradiction check · retrieval step 1/3 |
| Reset | `KeyR` | yes | yes | Canon constraint · retrieval step 0/3 |

**DexGPT / Dexter's Sanctuary** — final state: `Dex mode · watching`

| Control | Code | State moved | Line changed | Resulting interpretive line |
|---|---|---|---|---|
| Dex mode | `Digit1` | NO | NO | Dex mode · watching |
| Work mode | `Digit2` | yes | yes | Work mode · watching |
| Plain mode | `Digit3` | yes | yes | Plain mode · watching |
| Inspect evidence | `Space` | yes | yes | Plain mode · evidence under inspection |
| Reset | `KeyR` | yes | yes | Dex mode · watching |

## 17 authored visitor conversations

| # | Visitor | Role | Focus | Started | Lines | Re-entry | Journal | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | Archive Curator (`curator-archive`) | Archive Curator · Central Canon Observatory | yes | yes | 3 | yes | yes | **PASS** |
| 2 | Game Visitor (`visitor-katamari`) | Game Visitor · West Gameworks | yes | yes | 3 | yes | yes | **PASS** |
| 3 | Myth Systems Researcher (`visitor-myth`) | Myth Systems Researcher · West Systems Workshop | yes | yes | 3 | yes | yes | **PASS** |
| 4 | Local-first Engineer (`visitor-local`) | Local-first Engineer · East Local Systems Lab | yes | yes | 3 | yes | yes | **PASS** |
| 5 | Forensic Analyst (`visitor-analyst`) | Forensic Analyst · East Local Systems Lab | yes | yes | 3 | yes | yes | **PASS** |
| 6 | Memory Architect (`visitor-memory`) | Memory Architect · East Local Systems Lab | yes | yes | 3 | yes | yes | **PASS** |
| 7 | Accessibility Visitor (`visitor-access`) | Accessibility Visitor · Rear Sanctuary | yes | yes | 3 | yes | yes | **PASS** |
| 8 | Floor Docent (`docent`) | Floor Docent · Museum Staff | yes | yes | 3 | yes | yes | **PASS** |
| 9 | Gallery Attendant (`guard`) | Gallery Attendant · Museum Staff | yes | yes | 3 | yes | yes | **PASS** |
| 10 | Installation Conservator (`conservator`) | Installation Conservator · Museum Staff | yes | yes | 3 | yes | yes | **PASS** |
| 11 | Design Student (`student-a`) | Design Student · Visiting Pair | yes | yes | 3 | yes | yes | **PASS** |
| 12 | Systems Student (`student-b`) | Systems Student · Visiting Pair | yes | yes | 3 | yes | yes | **PASS** |
| 13 | Seated Sketcher (`sketcher`) | Seated Sketcher · West Gameworks | yes | yes | 3 | yes | yes | **PASS** |
| 14 | Visiting Architect (`architect`) | Visiting Architect · Threshold Hall | yes | yes | 3 | yes | yes | **PASS** |
| 15 | System Pilgrim (`pilgrim`) | System Pilgrim · Rear Sanctuary | yes | yes | 3 | yes | yes | **PASS** |
| 16 | Continuity Researcher (`research-pair-a`) | Continuity Researcher · Central Canon Observatory | yes | yes | 3 | yes | yes | **PASS** |
| 17 | Media Researcher (`research-pair-b`) | Media Researcher · Central Canon Observatory | yes | yes | 3 | yes | yes | **PASS** |

### Conversations as spoken

**Archive Curator** — Archive Curator · Central Canon Observatory · staff

1. The Atlas earns its scale by refusing to fill silence with invention.
2. Meridian becomes legible only after the people inside it can no longer interrupt the composition.
3. The chronology is not decoration. Every gap marks an unresolved authority problem.

Re-entry returned: "The Atlas earns its scale by refusing to fill silence with invention."

**Game Visitor** — Game Visitor · West Gameworks

1. The tiny town is convincing because the rules are local before the scenery is local.
2. Smudge collects scale itself, not merely clutter.
3. This wing understands that place has mechanics. Duncan is not wallpaper.

Re-entry returned: "The tiny town is convincing because the rules are local before the scenery is local."

**Myth Systems Researcher** — Myth Systems Researcher · West Systems Workshop

1. The control room is frightening because it records authority instead of flattering it.
2. The familiar is not a mascot. It is a visible state machine with opinions.
3. He builds myth the way other people build databases, and somehow both remain true.

Re-entry returned: "The control room is frightening because it records authority instead of flattering it."

**Local-first Engineer** — Local-first Engineer · East Local Systems Lab

1. Relay Link does not pretend a dropped bridge is still connected. That is rarer than it should be.
2. DexDictate treats privacy as architecture, not a footer promise.
3. The discipline is the point: local, inspectable, recoverable, and honest about failure states.

Re-entry returned: "Relay Link does not pretend a dropped bridge is still connected. That is rarer than it should be."

**Forensic Analyst** — Forensic Analyst · East Local Systems Lab

1. The evidence trays are more important than the tool count.
2. A local model is useful here only if the chain of custody remains visible.
3. Even the investigative tools are shaped by consent, scope, provenance, and restraint.

Re-entry returned: "The evidence trays are more important than the tool count."

**Memory Architect** — Memory Architect · East Local Systems Lab

1. The archive does not resolve contradictions just because retrieval found both of them.
2. A source-grounded answer is a path through rooms, not a sentence from nowhere.
3. DexVault makes the underlying fear explicit: losing the thread is a form of damage.

Re-entry returned: "The archive does not resolve contradictions just because retrieval found both of them."

**Accessibility Visitor** — Accessibility Visitor · Rear Sanctuary

1. The scent markers are care translated into spatial design.
2. The dog is allowed to remain difficult, specific, and real.
3. Dexter is sacred here, but not sentimentalized. Blindness changes the route, and the room honors that.

Re-entry returned: "The scent markers are care translated into spatial design."

**Floor Docent** — Floor Docent · Museum Staff · staff

1. The museum is organized by governing problem, not by date.
2. You are allowed to disagree with the labels. The artifacts are the stronger evidence.
3. Please notice that the installations change in place. Nothing is a slideshow pretending to be a room.

Re-entry returned: "The museum is organized by governing problem, not by date."

**Gallery Attendant** — Gallery Attendant · Museum Staff · staff

1. Please keep the path clear around the floor-plan kiosk.
2. No, the dog does not speak. The room is still listening.
3. The central installations are interactive. The walls are not touchscreens.

Re-entry returned: "Please keep the path clear around the floor-plan kiosk."

**Installation Conservator** — Installation Conservator · Museum Staff · staff

1. This installation has more moving state than most museums would permit.
2. Maintenance is part of the interpretation when failure states are the subject.
3. The wall reliefs are intentionally fixed. Their orientation belongs to the building.

Re-entry returned: "This installation has more moving state than most museums would permit."

**Design Student** — Design Student · Visiting Pair · pair `students`

1. Look at the ring: it is material, not symbolic anatomy.
2. The museum keeps refusing the easiest visual metaphor.
3. The official-versus-actual switch is doing more narrative work than a whole cutscene.

Re-entry returned: "Look at the ring: it is material, not symbolic anatomy."

**Systems Student** — Systems Student · Visiting Pair · pair `students`

1. The six-month pacing is the exhibit. The station model is only the evidence.
2. The strongest interaction here is being forced to wait.
3. The system is teaching canon through state transitions instead of a lore dump.

Re-entry returned: "The six-month pacing is the exhibit. The station model is only the evidence."

**Seated Sketcher** — Seated Sketcher · West Gameworks · seated

1. The ferry is a clock that the player has to inhabit.
2. Rain should change the hand before it changes the color palette.
3. I am drawing the grade of the street, not the skyline. The grade is the mechanic.

Re-entry returned: "The ferry is a clock that the player has to inhabit."

**Visiting Architect** — Visiting Architect · Threshold Hall

1. The portal frames make the canon wing feel earned.
2. This building finally behaves like a place that expects return visits.
3. The good choice was turning the introduction into a vestibule rather than a menu.

Re-entry returned: "The portal frames make the canon wing feel earned."

**System Pilgrim** — System Pilgrim · Rear Sanctuary

1. The sacred part is not the glow. The sacred part is the accommodation.
2. Dexter is treated as a governing presence, not a mascot.
3. The sanctuary is convincing because it is specific: blindness, scent, route, rest.

Re-entry returned: "The sacred part is not the glow. The sacred part is the accommodation."

**Continuity Researcher** — Continuity Researcher · Central Canon Observatory · pair `researchpair`

1. The most interesting thing here is that the labels do not overpromise.
2. The museum reads like a self-portrait made of methodologies.
3. He keeps building systems that admit contradictions into the room.

Re-entry returned: "The most interesting thing here is that the labels do not overpromise."

**Media Researcher** — Media Researcher · Central Canon Observatory · pair `researchpair`

1. There is something refreshing about a museum that lets the artifact stay a little ugly.
2. The more specific the canon gets, the less decorative it feels.
3. The outreach film folio on the wall reframes the whole war section.

Re-entry returned: "There is something refreshing about a museum that lets the artifact stay a little ugly."
