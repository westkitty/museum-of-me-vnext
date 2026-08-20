# Museum of Me — The Reliquary vNext
## Complete Three.js Construction Plan

**Status:** Implementation-ready planning artifact  
**Date:** 2026-08-19  
**Project:** Museum of Me / The Reliquary of Iterative Becoming vNext

---

## 1. Executive decision

The new museum should be treated as a **vNext product**, not as another restoration pass on the historical Reliquary artifact.

Preserve the existing Reliquary as legacy evidence and as a historical source. Build the new museum as a maintainable Three.js project with a new collection structure, architecture contract, asset pipeline, validation system, and deployment path.

The product is a persistent first-person museum containing:

- **64 represented project identities**
- **35 visitor-facing interactive exhibits**
- **6 themed wings**
- **2 architectural levels**
- **1 monumental central Reliquary Rotunda**
- **1 sacred Dexter Sanctuary**, not counted as an ordinary exhibit
- one continuous physical building
- no level-select doors during ordinary exploration
- no visible loading screens between wings
- no required live AI/API/backend systems
- no creator-glorification framing
- project-first interpretation throughout

The museum should feel enormous because the work is enormous. Scale comes from architecture, sightlines, volume, and the density of actual project history—not from self-congratulatory language.

---

## 2. Product laws

1. The museum is a **real Three.js/WebGL first-person environment**.
2. The museum is **one continuous persistent physical building**.
3. The Reliquary Rotunda is the spatial and conceptual center.
4. Every project is represented, but projects are not required to receive equal floor area.
5. Every visitor-facing exhibit must provide:
   - physical 3D presence,
   - meaningful interaction,
   - clear interpretation,
   - optional deeper material.
6. Every exhibit should exploit something the digital medium does better than a static webpage.
7. The museum presents the projects; it does not glorify their creator.
8. Dexter is sacred and is never reduced to mascot branding.
9. No project requires live private systems or personal data to function in the public museum.
10. Scope is cut before quality is cut.
11. The project is not complete while visitor-facing placeholders remain.
12. Shared interaction primitives are reused underneath highly differentiated exhibit presentations.
13. No exhibit owns its own render loop.
14. Ordinary interface surfaces remain semantic HTML/CSS.
15. All runtime assets are governed through stable IDs, manifests, provenance, ownership, and disposal rules.

---

## 3. Research-derived design principles

Existing immersive museum work suggests several useful principles:

- Virtual museums benefit from **scale, sound, architecture, and spatial presence**, not merely grids of objects.
- Digital exhibits should permit impossible physical-museum behaviors: entering models, exploding assemblies, changing time, manipulating systems, and observing processes from otherwise impossible viewpoints.
- The building needs a readable main route while still allowing deep optional exploration.
- First-person navigation should feel spatially coherent rather than like a sequence of level loads.

Useful references:

- Museum of Other Realities: https://www.museumor.com/
- The Met, virtual-world work: https://www.metmuseum.org/perspectives/our-first-virtual-worlds-atopia
- Google Arts & Culture Pocket Gallery: https://artsandculture.google.com/project/pocket-gallery/explore
- Three.js PointerLockControls: https://threejs.org/docs/pages/PointerLockControls.html
- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Three.js releases: https://github.com/mrdoob/three.js/releases

**Guiding law:**

> Every exhibit should offer something that makes more sense in a virtual museum than it would as a screenshot on a website.

---

## 4. Scope cuts made before construction

The launch version will **not** require:

- multiplayer,
- VR headset support,
- live AI inference,
- live access to BigMac,
- live OSINT searches,
- microphone capture by default,
- actual personal files or case records,
- complex simulated crowds,
- fully conversational NPCs,
- thirty-five bespoke control systems,
- an embedded full copy of every original application,
- one bespoke rendering architecture per exhibit,
- single-file HTML delivery,
- every legacy Reliquary subsystem solely because it once existed,
- external APIs for core museum functionality,
- heavy general-purpose physics where deterministic animation is sufficient.

The historical single-file Reliquary remains preserved separately.

---

## 5. Exhibit complexity tiers

Thirty-five equal-size hero rooms would make completion unrealistic. Use three production tiers.

### Tier A — Landmark installations

Approximately **9 exhibits**.

These receive major architecture, custom lighting, bespoke 3D assets, and the strongest interactions.

Candidate Tier A exhibits:

- Starsilk Universe
- Orbital Tomb
- Drakken Terraforming Laboratory
- Heliocide Observatory
- Dex Voice Lab
- Era of Invincible Magic
- Arkship Civilization
- S'mores Katamari
- BigMac Backbone

### Tier B — Full interactive galleries

Approximately **16 exhibits**.

Distinctive hero object plus meaningful interaction, implemented on shared interaction systems.

### Tier C — Interactive project cases

Approximately **10 exhibits**.

Smaller modular environments with the same minimum quality contract.

**Rule:** Reduce square footage before reducing finish quality.

---

# 6. Physical museum architecture

## 6.1 Ground floor

```text
                         NORTH

               STARSILK & DRAKKEN
                       WING
                         │
                         │
        ARCHIVE ─── RELIQUARY ─── DEX
        & CANON      ROTUNDA      SYSTEMS
          WING           │         WING
                         │
                   GAMES & PLAY
                       WING
                         │
                    MAIN ENTRY
```

## 6.2 Upper floor

```text
       NW MEZZANINE                  NE MEZZANINE
    MUSIC / PROMPTCRAFT            LOCAL SYSTEMS
         / MEDIA                   / INFRASTRUCTURE
             \                         /
              ─── ROTUNDA BALCONY ───
```

## 6.3 Reliquary Rotunda

Recommended design dimensions:

- approximately **32 m interior diameter**
- approximately **25 m floor-to-dome height**
- two-level internal balcony
- large central skylight/glass dome
- approximately 6 m clear circulation ring
- major wing arches visible simultaneously
- central orientation installation
- no giant statue of the creator

The Rotunda must communicate scale immediately.

## 6.4 Wing circulation

Main public routes:

- 4–6 m clear width
- broad turning radii
- long views into major galleries
- compressed thresholds that open into large rooms
- visible relationships between floors

## 6.5 Wing identities

### North — Starsilk & Drakken
Largest and tallest wing. Mythic, celestial, dark, monumental.

### South — Games & Play
Widest wing. Warm, theatrical, kinetic, playful without becoming an arcade.

### East — Dex Systems
Modular technological laboratory. White stone, steel, dark teal, amber wood.

### West — Archive & Canon
Dense scholarly archive. Violet, parchment, bronze, shelving, diagrams.

### Northwest mezzanine — Music / Promptcraft / Media
Studio-influenced, brass and wood, acoustically controlled.

### Northeast mezzanine — Local Systems
Quiet industrial infrastructure space showing the machinery behind the work.

---

# 7. Sacred Dexter architecture

The **Dexter Sanctuary** is not part of the Dex Systems Wing and is not counted among the 35 exhibits.

DexGPT is software. Dexter is Dexter.

The Sanctuary should sit slightly below and behind the central Rotunda axis, reached through a quieter threshold.

Required features:

- authoritative tricolor Phalène Dexter model
- hanging ears preserved exactly
- accurate proportions and recognizable coat/face
- central resting platform
- restrained reference imagery
- minimal contextual interpretation
- low ambient sound
- quiet seating
- no score or completion badge
- no mascot interface
- no paw-print collectibles
- no tutorial dialogue

The space exists because Dexter matters, not because it needs content density.

---

# 8. Visitor circulation model

Support three simultaneous visit styles.

## Wanderer

Walk anywhere. No required order.

## Guided visitor

Open the map, choose an exhibit, and follow restrained spatial wayfinding.

## Deep visitor

Stop at exhibits and open deeper project material.

Visited state is for orientation—not achievement scoring.

---

# 9. Interpretation system

Every exhibit uses three information layers.

## Layer 1 — Ten-second understanding

Physical plaque:

- project name
- what it is
- one sentence of significance

## Layer 2 — One-minute understanding

Physical lectern/display:

- original problem or idea
- what was made
- major capabilities
- historical/current status

## Layer 3 — Deep dive

Accessible DOM panel containing:

- history
- architecture
- screenshots/artifacts
- milestones
- interesting failures
- design decisions
- current status
- project relationships
- optional source/repository references

Interpretation describes the project rather than praising its creator.

---

# 10. Exhibit plan

## NORTH WING — Starsilk & Drakken

Visual language: obsidian, deep indigo, violet, restrained gold, star-metal, woven geometries, celestial projection. Elegant and mythic rather than generic neon science fiction.

---

## Exhibit 01 — Starsilk Universe — Tier A

### Physical form
A massive suspended **celestial loom** occupies a circular chamber. Stars, worlds, and branching geometric systems orbit an illuminated thread structure.

### Interaction
Visitors manipulate several fundamental threads. Changing one propagates visible consequences through the model.

### 3D exploration
Walk around and partly underneath the loom. Relationships reveal themselves from different angles.

### Information
Explain:

- Starsilk
- Starsilk Macros
- Codec
- Tiger
- Syrin
- Drakken
- Starbinding
- major cosmological relationships

### Required assets

- celestial loom GLB
- thread shader/system
- star nodes
- world miniatures
- engraved floor diagram
- curated art panels

---

## Exhibit 02 — Drakken Terraforming Compendium — Tier B

### Scope constraint
Do **not** build thirty-five full production Drakken models.

### Physical form
Central Drakken Egg surrounded by five archetype stations.

### Interaction
Choose an archetype. The Egg opens a projection showing representative morphology and environmental function.

### 3D exploration
Five representative models/silhouettes plus Mother as a distant architectural-scale figure or projection.

### Information
The complete thirty-seven-entry taxonomy remains available through interpretation interfaces.

### Assets

- Egg
- five representative archetype models
- Mother relief/projection
- taxonomy diagrams
- compendium page textures

---

## Exhibit 03 — Orbital Tomb — Tier A

### Physical form
A damaged Meridian Station segment intersects the gallery.

### Interaction
A timeline dial moves the installation from Month Zero through Month Six. Station geometry progressively changes.

### 3D exploration
Visitors can enter the station fragment.

### Information
Explain:

- Orbital Tomb project
- song
- narrative
- visual production
- interactive tour

### Asset policy
Reuse approved station assets where technically appropriate rather than recreating everything.

---

## Exhibit 04 — Starsilk Possibility Cartographer — Tier B

### Physical form
A volumetric constellation of possibility nodes.

### Interaction
Select a canon fact. Legal possibilities illuminate. Forbidden or contradictory paths close. Unknowns remain unresolved.

### 3D exploration
Walk around the graph and inspect relationships spatially.

### Purpose
Show what the software does rather than recreating a flat interface.

---

## Exhibit 05 — StarSilk Maker — Tier B

### Physical form
A celestial textile loom.

### Interaction
The visitor draws a path in 3D. The loom turns it into a procedural thread composition.

### 3D exploration
Fibers extend outward as a small sculpture.

### Optional feature
Save a generated swatch locally during the session.

---

## Exhibit 06 — Drakken Field Anatomy Archive — Tier B

### Physical form
Three forensic tables.

### Canon rule
The intentionally non-canon surrogate specimens remain clearly separated from canon Drakken specimens.

### Interaction
Toggle:

- external
- skeletal
- energy/process
- section view

### 3D exploration
Rotate and raise anatomical layers.

---

## Exhibit 07 — Drakken Terraforming Laboratory — Tier A

### Physical form
A large planetary sphere suspended above an engineering floor.

### Interaction
Visitors deploy a bounded sequence of Drakken processes.

### Process lock

Gorevault:

**collection → gathering → rendering/refinement → feedstock**

Ringthroat:

**feedstock → SKY**

Do not collapse these functions.

### 3D exploration
Walk around the transforming world.

### Technical implementation
Deterministic scripted simulation rather than expensive general-purpose physics.

---

## Exhibit 08 — Heliocide Observatory — Tier A

### Physical form
A vast observatory window.

### Interaction
Initiate a short controlled reconstruction. Stars vanish sequentially.

### Canon visual rule
The Siege Wall appears as the correct swath/absence in stellar space—not a literal masonry wall, lattice, or visible grid from the inhabited-world viewpoint.

### 3D exploration
Multiple telescope stations offer distinct views.

### Scope
Museum installation inspired by Heliocide Observatory, not the full standalone application embedded inside the museum.

---

# 11. WEST WING — Archive & Canon

Visual language: dark violet, parchment, bronze, shelving, star-map motifs. More scholarly, less spectacular.

---

## Exhibit 09 — Museum Evolution — Tier C

### Physical form
Architectural maquette table.

### Interaction
Turn a timeline control. Earlier Museum of Me / Reliquary concepts appear as layered models.

### Purpose
Explain the museum's own evolution without turning the building into self-celebration.

---

## Exhibit 10 — WorldsVault Lineage — Tier B

Represents:

- WorldsVault Uplink
- CanonForge
- WorldsVault

### Physical form
Three connected archival machines.

### Interaction
Pass the same lore record through each system and observe how representation and architecture evolve.

### Purpose
Project evolution becomes the interaction.

---

## Exhibit 11 — Continuity Systems — Tier C

Represents:

- KinDex Handoff
- ChatGPT Bible Repo
- Project Forge

### Physical form
Mechanical documentation chain.

### Interaction
Visitors assemble a fictional project handoff from evidence blocks.

### Lesson
Durable project context must live somewhere outside a transient conversation.

---

## Exhibit 12 — Rhetorical InDEX — Tier B

### Physical form
Large evidence-analysis table.

### Interaction
Visitors classify sample statements as:

- evidence
- interpretation
- framing
- inference
- unsupported

### Source rule
Use invented or public-domain examples. Do not surface private disputes.

---

# 12. NORTHWEST MEZZANINE — Music, Promptcraft & Media

Visual language: brass, purple, dark wood, acoustic materials, recording-studio influence.

---

## Exhibit 13 — Suno Studio — Tier B

### Physical form
Small recording studio / listening room.

### Interaction
Switch among selected original project excerpts and alter simplified arrangement layers on a mixing desk.

### 3D exploration
Instrument and waveform objects respond spatially.

### Rights rule
Use only audio cleared for the museum.

---

## Exhibit 14 — Promptcraft & Vibe Coding — Tier B

Represents:

- Visual Prompt Systems Registry
- Vibe Coding Nexus / DexGate Academy

### Physical form
Prompt assembly machine.

### Interaction
Combine deterministic prompt blocks. A simple rendered scene changes accordingly.

### Constraint
No external generation API is required.

---

## Exhibit 15 — Agent Harness Laboratory — Tier C

Represents:

- Code Harness
- Opencode Harness

### Physical form
Routing rack.

### Interaction
Route a fictional task through:

request → context → specialist → validation → handoff

### Purpose
Explain orchestration physically.

---

## Exhibit 16 — Media Application Lineage — Tier C

Represents:

- Guy_Cast
- Gay_Cast
- He-Maker
- Media Getter

### Physical form
Workbench with devices representing project generations.

### Interaction
Run a simulated media workflow:

input → trim → convert → transcribe → output

---

# 13. EAST WING — Dex Systems

Visual language: white stone, steel, dark teal, glass, amber wood. Clean laboratory rather than corporate dashboard.

---

## Exhibit 17 — Dex Voice Lab — Tier A

Represents:

- DexDictate macOS
- DexDictate Android
- DexSpeak
- DexTalk
- BigMac Voice Tools

### Physical form
Circular voice laboratory.

### Interaction
Visitors select prerecorded speech and compare:

- raw transcription
- refined transcription
- synthesized voice
- command interpretation

### Privacy
No microphone permission required for the core experience.

---

## Exhibit 18 — Dex Companion & Agent Systems — Tier C

Represents:

- DexGPT
- DexClawdBot
- DexKeeper Bot

### Rule
This exhibit is about software systems influenced by Dexter. It does not replace or trivialize Dexter's Sanctuary.

### Interaction
Route a request among fictional agent roles.

---

## Exhibit 19 — DexTilt — Tier B

### Physical form
Large phone model linked to a desktop station.

### Interaction
Drag/rotate the virtual phone. The Mac display responds to gesture events.

### 3D element
Gesture trajectories become visible spatial objects.

---

## Exhibit 20 — Utility & Privacy Bench — Tier C

Represents:

- DexCleaner
- DexSort
- SpaceWise

### Interaction
Organize synthetic files and observe disk-space/privacy implications.

### Safety
No real filesystem access.

---

## Exhibit 21 — Civic Support Studio — Tier B

Represents:

- DexAid
- DexEnhance

### Interaction
Using a completely fictional situation, assemble:

- chronology
- evidence
- next-action packet

### Privacy
No actual housing records, personal messages, or private case data.

---

## Exhibit 22 — Creative Tools Studio — Tier B

Represents:

- DexCraft
- DexGen
- DexDraw

### Physical form
Large collaborative design table.

### Interaction
Draw shapes, connect objects, and adjust visual prompt-like controls. The drawing appears directly on the table through a dynamic texture.

---

## Exhibit 23 — Sensemaking Lab — Tier B

Represents:

- DexEarth
- Dexterpreter

### Physical form
Interactive globe and language wall.

### Interaction
Choose a location and view geospatial information plus controlled translation examples.

### Constraint
No live map API is required.

---

# 14. SOUTH WING — Games & Play

Visual language: warm rust, wood, cobalt highlights, miniatures, theatrical lighting. Playful but not arcade-like.

---

## Exhibit 24 — Era of Invincible Magic — Tier A

### Physical form
Large fantasy campaign map table.

### Interaction
Select regions and artifacts. Terrain and campaign paths respond.

### 3D exploration
Miniature environments rise from the table.

---

## Exhibit 25 — DnDex / DM Hub — Tier B

### Physical form
Full DM table.

### Interaction
Run a tiny deterministic encounter:

- roll die
- change initiative
- move a miniature
- resolve one action

### Scope
No full D&D engine is required.

---

## Exhibit 26 — WestCat Systems — Tier C

Represents:

- WESTCAT Overlay
- WestCat Goes East

### Physical form
Layered travel / operations map.

### Interaction
Toggle overlays and route information.

---

## Exhibit 27 — The Full Weasel — Tier C

### Physical form
Mechanical puzzle cabinet.

### Interaction
Three linked mechanisms produce escalating absurd results.

Small footprint; strong personality.

---

## Exhibit 28 — Against the Void — Tier B

### Physical form
Tactical star table.

### Interaction
Place several fleet pieces and trigger one deterministic combat turn.

---

## Exhibit 29 — Arkship Civilization — Tier A

### Physical form
Large suspended Arkship model.

### Interaction
Exploded view reveals:

- command
- habitation
- logistics
- energy
- propulsion

Then choose a colony destination and watch one module deploy.

---

## Exhibit 30 — AetherVFX — Tier B

### Physical form
Transparent VFX chamber.

### Interaction
Adjust:

- emitter
- force
- lifetime
- turbulence
- color behavior

Visitors immediately reshape the effect.

---

## Exhibit 31 — Story Worlds — Tier C

Represents:

- Parable
- Starlight Acre

### Physical form
Two-sided story portal.

### Interaction
One side offers a small branching narrative decision. The other allows the visitor to plant/grow an object.

One installation, two contrasting expressions.

---

## Exhibit 32 — S'mores Katamari — Tier A

### Physical form
Miniature neighborhood diorama.

### Interaction
One short self-contained playable micro-level.

- roll
- collect objects
- grow visibly

### Scope
Not the complete game.

---

## Exhibit 33 — Endless Grok / Void Ascendancy — Tier B

### Physical form
Strategic galactic board.

### Interaction
Claim nodes, choose one technology, and observe expansion consequences.

---

# 15. NORTHEAST MEZZANINE — Local Systems

Visual language: quiet industrial green and dark metal. This wing exposes the machinery behind the systems.

---

## Exhibit 34 — BigMac Backbone — Tier A

Represents:

- Big Mac Westcat SSH
- BigMac Storage and SMB
- BigMac Ollama + Codex Integration
- Hermes Agent/Desktop + BigMac
- Large Language Launcher
- project_daemon / DAEMON

### Physical form
Room-scale network sculpture.

MacBook, BigMac, storage, model engine, tunnel, and agent surfaces become physical nodes.

### Interaction
Select a workflow. A pulse travels through the architecture.

### Privacy rule
Public exhibit uses sanitized/example addresses and identifiers.

No live credentials, keys, secrets, or operational private configuration.

---

## Exhibit 35 — Local Specialist Systems Lab — Tier C

Represents:

- Big Mac FaceTools
- OSINT Box

### Physical form
Two laboratory bays.

### Interaction
FaceTools uses synthetic/generated faces. OSINT Box uses a fictional investigation.

### Visual lesson
A physical trust-boundary wall explains local-only architecture.

---

# 16. Interaction vocabulary

Every exhibit should feel different visually and experientially while sharing a small interaction vocabulary.

1. **Inspect** — rotate, raise, open, explode.
2. **Manipulate** — move an object or control.
3. **Configure** — sliders/switches change a system.
4. **Simulate** — trigger deterministic system behavior.
5. **Construct** — draw/build/assemble something.
6. **Navigate** — move through a miniature world/timeline.
7. **Sequence** — advance or scrub through states.
8. **Listen/read** — spatial media and interpretation.

Each exhibit receives one primary interaction and at most one secondary interaction.

---

# 17. Exhibit module contract

Conceptual interface:

```ts
interface ExhibitModule {
  id: string;
  preload(): Promise<void>;
  mount(): void;
  activate(): void;
  update(dt: number): void;
  deactivate(): void;
  unmount(): void;
  dispose(): void;
}
```

Each exhibit declares:

- project IDs represented
- wing
- complexity tier
- world bounds
- hero asset IDs
- interaction type
- activation distance
- audio zone
- streaming group
- content record
- accessibility description
- performance budget

Freeze this contract before parallel wing development.

---

# 18. Three.js technical architecture

## 18.1 Recommended stack

- TypeScript
- Vite
- vanilla Three.js
- semantic HTML/CSS UI
- Playwright for browser smoke/e2e
- Vitest or equivalent for deterministic logic tests
- Blender + glTF tooling for asset preparation

Use the current pinned Three.js release chosen at project start after verification. The planning baseline assumed the r185 line.

## 18.2 Why vanilla Three.js

The museum requires:

- one large persistent scene
- explicit lifecycle ownership
- extensive streaming
- thirty-five independent exhibit modules
- first-person movement
- high-frequency mutable systems
- aggressive asset disposal

React Three Fiber is not prohibited, but it should not be introduced unless repository evidence proves that it materially improves the architecture. The default plan is vanilla Three.js.

---

# 19. Repository structure

```text
museum-of-me-vnext/
├── OPERATIONAL_STATE.md
├── README.md
├── package.json
├── vite.config.ts
├── docs/
│   ├── MUSEUM_VNEXT_BUILD_PLAN.md
│   ├── ARCHITECTURE.md
│   ├── EXHIBIT_CONTRACT.md
│   ├── ASSET_POLICY.md
│   ├── PRIVACY_POLICY.md
│   └── RELEASE_CHECKLIST.md
├── src/
│   ├── app/
│   ├── render/
│   ├── world/
│   ├── player/
│   ├── interaction/
│   ├── exhibits/
│   │   ├── starsilk/
│   │   ├── archive/
│   │   ├── dex/
│   │   ├── games/
│   │   ├── media/
│   │   └── infrastructure/
│   ├── assets/
│   ├── audio/
│   ├── content/
│   ├── state/
│   ├── ui/
│   └── accessibility/
├── public/
│   └── assets/
├── scripts/
├── tests/
└── validation/
```

---

# 20. Frame-loop ownership

There is exactly one render/frame-loop owner.

```text
input
↓
fixed simulation step
↓
player/collision
↓
active exhibit updates
↓
audio zones
↓
streaming decisions
↓
render interpolation
↓
Three.js render
```

No exhibit creates its own `requestAnimationFrame`.

---

# 21. Movement and collision

Use PointerLock-style first-person camera behavior and a capsule-based player controller against simplified static collision geometry.

The museum does not need a general-purpose physics engine unless a later bounded exhibit proves one is necessary.

## Desktop controls

- WASD — move
- mouse — look
- Shift — faster walk
- E — interact
- M — map
- J — journal
- Escape — release pointer

No mandatory jump.

Visible stairs should use simplified ramp collision underneath them.

---

# 22. Persistent-world streaming

"No loading screens" does not mean "keep the entire museum fully resident."

Use three streaming layers.

## Layer 1 — Museum proxy

Always loaded:

- Rotunda
- low-detail wing shells
- silhouettes
- major lighting
- doors/arches
- exterior

## Layer 2 — Wing detail

Preload:

- current wing
- neighboring wing
- visible wing entrances

## Layer 3 — Exhibit payload

Load heavy interactive content only when approaching.

On exit:

- deactivate
- release temporary render targets
- release audio
- dispose non-shared geometry/materials/textures

The player never sees a level transition.

---

# 23. Runtime asset strategy

Standard runtime 3D format: **GLB**.

Optimization candidates:

- Meshopt geometry compression
- KTX2/Basis textures
- instancing for repeated architecture
- baked lighting/AO for static interiors
- dynamic lighting only where important
- LOD for hero assets
- low-detail proxy architecture

Avoid:

- excessive shadow-casting lights
- 8K textures on ordinary props
- unique 4K textures for every wall
- unmanaged one-off shader experiments
- external hotlinked runtime assets

---

# 24. Initial performance budgets

These are starting gates and can be revised from measurement.

## Initial visit

Application shell + Rotunda:

**target ≤ 20 MB transferred**

## High-detail wing

**target ≤ 40 MB streamed**

## Exhibit payload

- Tier A: **target ≤ 15 MB**
- Tier B: **target ≤ 8 MB**
- Tier C: **target ≤ 4 MB**

## Textures

- ordinary: 1K–2K
- hero: 4K only when visibly justified

## Runtime

Desktop target:

- 60 FPS on representative modern hardware

Fallback target:

- stable 30 FPS on a lower quality tier

## Quality settings

- Low
- Medium
- High

Choose an initial quality tier automatically but allow manual override. Cap device pixel ratio.

---

# 25. Complete asset-production program

## 25.1 Core architecture kit

Produce once and reuse.

Approximate inventory:

- 8 wall modules
- 5 arch/door modules
- 4 column types
- 4 trim/cornice modules
- 3 balustrades
- 3 floor modules
- 2 stair kits
- 2 ramp kits
- 2 elevator surrounds
- 4 plinths
- 4 display cases
- 4 lecterns
- 4 bench/seating models
- 4 lighting fixtures
- signage frames
- utility doors
- invisible collision modules

Target approximately **55–65 reusable architectural pieces**.

## 25.2 Rotunda hero package

- glass dome
- structural dome frame
- central floor
- fountain/information structure
- grand arches
- balcony ring
- main staircase
- entrance facade
- main map
- Curator/orientation kiosk
- journal kiosk
- wing signage

## 25.3 Wing environment kits

Six visual kits:

1. Starsilk/Drakken
2. Archive/Canon
3. Dex Systems
4. Games/Play
5. Music/Promptcraft/Media
6. Local Systems

Each kit includes:

- materials
- wall treatment
- lighting fixtures
- signage
- floor treatment
- one or two signature props

## 25.4 Dexter Sanctuary package

- canonical Dexter model
- resting platform
- quiet seating
- sanctuary threshold
- wall reliefs
- reference panels
- restrained set dressing

## 25.5 Exhibit hero packages

Exactly one major visual anchor per exhibit.

**35 hero-object packages.**

Many can be procedural or adapted from existing project assets rather than modeled entirely from scratch.

---

# 26. Asset-source hierarchy

Use this order.

## 1. Existing authentic project artifacts

Preferred sources:

- existing GLBs
- screenshots
- game assets
- UI captures
- project artwork
- audio
- diagrams
- logos
- documentation illustrations

## 2. Derived museum assets

Create museum-safe reinterpretations from authentic material.

Example: transform an application screenshot into a physical instrument panel.

## 3. New original assets

Generate/model when the project lacks suitable artifacts.

## 4. External third-party assets

Use only for generic scenery when clearly worthwhile and legally appropriate.

Every external item requires provenance and license evidence.

---

# 27. Asset provenance record

Every asset records:

```text
asset ID
title
source
project
creator
ownership/license
original hash
processed hash
source format
runtime format
runtime size
texture dimensions
LOD data
streaming group
attribution
```

No undocumented downloaded model.

No mystery texture named `final-final2.png`.

---

# 28. Project-content packets

Before an exhibit enters implementation, prepare a source packet containing:

- canonical project ID
- canonical project name
- aliases
- one-paragraph description
- represented repository/artifact sources
- status
- 3–8 important screenshots/assets
- important milestones
- main capabilities
- most interesting development lesson
- project relationships
- privacy exclusions
- proposed exhibit copy
- proposed interaction
- asset requirements

No developer builds an exhibit directly from memory.

---

# 29. Privacy and sanitization

Before public release, source material passes a boundary audit.

Strip or replace:

- personal correspondence
- real IP addresses where unnecessary
- credentials
- SSH keys
- sensitive private file paths
- account details
- real OSINT case data
- housing records
- private contact information
- API keys
- tokens
- debug dumps containing secrets

BigMac and OSINT exhibits use synthetic demonstration information.

---

# 30. Museum interface

UI remains DOM-based.

## Persistent UI

Minimal:

- interaction cue
- optional current wing indicator
- optional subtitle/audio status

## Map — `M`

Shows:

- architectural map
- current position
- wing names
- exhibit destinations
- accessible routes

Selecting an exhibit activates wayfinding.

## Journal — `J`

Shows:

- visited exhibits
- bookmarks
- source references
- optional notes

No progress score.

---

# 31. Text accessibility

Every physical plaque receives:

1. a world-space visual version,
2. a focusable DOM equivalent.

This preserves atmosphere without sacrificing readability or accessibility.

---

# 32. Audio architecture

Use one ambient identity per wing rather than one soundtrack per exhibit.

Suggested beds:

- Starsilk — low celestial textile tones
- Archive — near-silence, paper/mechanical resonance
- Dex — quiet electronics
- Games — subtle activity/environment
- Media — acoustic studio room tone
- Infrastructure — low machine hum

Exhibit audio activates only inside its local acoustic zone.

---

# 33. Visitor population

Launch target:

- 4–8 lightweight ambient visitors
- 2 museum staff
- shared rig
- authored short paths
- no general AI
- no dynamic conversation system

If ambient visitors threaten performance or schedule, remove them.

An empty finished museum is preferable to a busy broken one.

---

# 34. Parallel development lanes

Parallel work begins only after core contracts are frozen.

## Lane A — Core

Owns:

- render loop
- player
- collision
- streaming
- interaction
- state
- map
- asset manager
- audio manager

No wing developer modifies core casually.

## Lane B — Architecture

Owns:

- Blender kits
- museum shell
- wing shells
- collision meshes
- materials

## Lane C — North wing

Eight Starsilk/Drakken exhibits.

## Lane D — East wing

Seven Dex exhibits.

## Lane E — South wing

Ten games/play exhibits.

## Lane F — West + upper wings

Archive + Media + Infrastructure.

## Lane G — Content

Source packets, copy, screenshots, provenance.

## Lane H — QA / performance

Begins after the vertical slice, not on day one.

---

# 35. Code ownership after interface freeze

```text
src/exhibits/starsilk/**        → North lane
src/exhibits/dex/**             → East lane
src/exhibits/games/**           → South lane
src/exhibits/archive/**         → West lane
src/exhibits/media/**           → NW lane
src/exhibits/infrastructure/**  → NE lane
```

Shared core changes require dedicated core work.

---

# 36. Git branch policy

Never build everything directly on `main`.

Example:

```text
main
├── feat/foundation
├── feat/graybox-museum
├── feat/core-runtime
├── feat/asset-pipeline
├── feat/vertical-slice
├── wing/starsilk
├── wing/dex
├── wing/games
├── wing/archive
├── wing/media
├── wing/infrastructure
└── release/v1
```

---

# 37. Required commit gate

Before every phase commit:

```bash
git status --short
git diff --check
npm run typecheck
npm run lint
npm test
npm run build
```

As phases mature, also run when present:

```bash
npm run validate:assets
npm run test:e2e
npm run check:budgets
```

Then:

```bash
git add <authorized paths>
git diff --cached
git commit -m "<phase-scoped message>"
git push -u origin <phase-branch>
```

Never push directly to `main`.

---

# 38. Construction phases

## PHASE 0 — vNext authority freeze

### Build

- create vNext repository/worktree
- preserve existing Reliquary artifacts unchanged
- create `OPERATIONAL_STATE.md`
- create build plan
- create 64→35 project mapping
- create privacy exclusions
- create source authority rules
- create asset policy
- record legacy hashes

### Gate

Every project maps to exactly one exhibit representation unless an explicitly documented relationship says otherwise.

No missing project.

No accidental duplicate mapping.

### Commit

`chore: establish museum vnext authority and build contract`

---

## PHASE 1 — Repository foundation

### Build

- Vite
- TypeScript
- Three.js
- linting
- tests
- CI
- empty renderer
- asset manifest system
- content schemas
- basic state

### Gate

- clean installation
- typecheck
- tests
- production build
- blank app renders

### Commit

`feat: establish threejs museum runtime foundation`

---

## PHASE 2 — Complete graybox building

Build the entire museum in deliberately plain geometry.

Include:

- exterior
- arrival plaza
- entrance
- Rotunda
- all six wings
- mezzanine
- stairs
- elevators/access routes
- Dexter Sanctuary
- all 35 future exhibit volumes

### Gate

The visitor can walk:

main entrance → every wing → upper floor → Sanctuary → entrance

without:

- teleport
- collision failure
- dead end
- visible loading

### Commit

`feat: complete traversable museum graybox`

**Do not begin visual polish before this gate passes.**

---

## PHASE 3 — Core museum systems

Implement:

- first-person controller
- collision
- interaction manager
- exhibit lifecycle
- streaming zones
- audio zones
- UI
- map
- journal
- preferences
- save schema
- quality tiers
- loading telemetry
- diagnostics

### Gate

Five placeholder exhibit modules independently load, activate, deactivate, unload, and reload.

### Commit

`feat: establish persistent museum systems`

---

## PHASE 4 — Asset pipeline

Implement:

- asset IDs
- manifest
- GLB loader
- KTX2 support
- Meshopt support
- provenance ledger
- budget validation
- load/unload tests
- Blender export conventions

### Gate

One representative asset:

load → display → unload → reload

without leaked scene objects/resources.

### Commit

`feat: establish governed museum asset pipeline`

---

## PHASE 5 — Vertical slice

This is the most important build gate.

Build:

- finished Rotunda segment
- map
- Dexter Sanctuary prototype
- five deliberately different exhibits:

1. Starsilk Universe
2. WorldsVault Lineage
3. DexTilt
4. DnDex / DM Hub
5. Suno Studio

These test:

- large spatial sculpture
- sequence/history
- device interaction
- miniature game
- audio exhibit

### Gate

If these five require more interaction architecture than planned, repair the framework now.

### Commit

`feat: complete museum vertical slice`

---

## PHASE 6 — Production architecture

Replace graybox with production architecture.

Build:

- Rotunda
- wing shells
- balcony
- materials
- doors
- signs
- baked lighting
- architecture LODs
- collision proxies

### Gate

All traversal tests remain valid.

### Commit

`feat: complete production museum architecture`

---

## PHASE 7 — Parallel exhibit wave one

### North

Exhibits 1–4.

### East

Exhibits 17–20.

### South

Exhibits 24–27.

### West/Upper

Exhibits 9, 10, 13, 14, 34.

### Per-exhibit gate

Each must pass:

- physical presence
- interaction
- information
- 3D exploration
- accessibility
- streaming
- disposal

---

## PHASE 8 — Parallel exhibit wave two

### North

5–8.

### East

21–23.

### South

28–33.

### West/Upper

11, 12, 15, 16, 35.

### Gate

- all 35 exhibit IDs instantiated
- all 64 project IDs represented

---

## PHASE 9 — Content completion

No visitor-facing placeholder prose remains.

Every project receives:

- title
- description
- assets
- source references
- interpretation
- current/historical status where appropriate

### Gate

Automated visitor-content scan rejects:

```text
TODO
placeholder
lorem
coming soon
TBD
```

---

## PHASE 10 — Experience pass

Add:

- transitions
- quiet zones
- lighting rhythm
- audio
- wing identity
- sightline improvement
- pacing
- ambient visitors only if justified
- wayfinding

### Gate

The museum should feel intentional even while simply walking without interacting.

---

## PHASE 11 — Accessibility and input pass

Verify:

- keyboard
- mouse
- retained gamepad support if implemented
- touch fallback
- reduced motion
- readable text
- high contrast
- subtitles
- map keyboard operation
- pointer-lock recovery
- focus behavior
- UI scaling

---

## PHASE 12 — Performance and lifecycle

Profile:

- cold load
- wing transition
- exhibit activation
- repeated load/unload
- long whole-building traversal
- context-loss/recovery where practical
- resize
- blur/focus
- device pixel ratio
- memory growth

### Mandatory traversal

Entrance → North → East → South → West → upper level → Sanctuary → entrance.

Repeat.

Memory must settle rather than climb monotonically.

---

## PHASE 13 — Full museum QA

Every exhibit receives a deterministic checklist.

For all 35:

- reachable
- identifiable
- hero object present
- interaction works
- reset works
- accessible content exists
- mobile fallback does not crash
- unload/reload works
- no uncaught error

Capture a full screen-recording walkthrough for visual QA.

---

## PHASE 14 — Deployment and release

### Recommended hosting

Use:

- **Cloudflare Pages** for application code/static shell
- **Cloudflare R2** for large hashed museum assets

Useful hosting references:

- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- GitHub Pages limits: https://docs.github.com/pages/getting-started-with-github-pages/github-pages-limits
- MDN Cache Storage: https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage

### Deployment shape

```text
museum.example.com
    Cloudflare Pages
        HTML
        JS
        CSS
        manifests

assets.museum.example.com
    R2
        GLBs
        KTX2
        audio
        media
```

### Hashed asset examples

```text
arkship.a81c4f.glb
starsilk-loom.1378bd.glb
archive-wall.74ab23.ktx2
```

Service-worker/offline caching is optional after the hosted online version works correctly.

---

# 39. Release gate

Do not call the museum complete because all rooms exist.

## Architecture

- no inaccessible intended public space
- no collision holes
- no unintended traps
- no visible voids

## Exhibits

- 35/35 pass
- 64/64 project mappings pass

## Assets

- no missing assets
- no unlicensed external assets
- no runtime hotlinks

## Privacy

- no secrets
- no private case data
- no credentials
- no operational BigMac data

## Accessibility

- keyboard path works
- readable accessible exhibit copies exist
- reduced-motion path works

## Runtime

- no uncaught core-path exceptions
- load/unload lifecycle stable
- quality tiers work

## Deployment

- production URL works
- asset host resolves
- cache headers verified
- direct refresh works

Only then tag:

```text
v1.0.0
```

---

# 40. Scope-reduction ladder

If 35 exhibits remain too large, merge intentionally rather than ship unfinished rooms.

### 35 → 34
Merge Agent Harness Laboratory into Promptcraft & Vibe Coding.

### 34 → 33
Merge Continuity Systems into Museum Evolution.

### 33 → 32
Merge Local Specialist Systems into BigMac Backbone.

### 32 → 31
Merge Civic Support Studio into Utility / Support Systems.

### 31 → 30
Merge The Full Weasel into WestCat Systems as a second chamber.

### Identity-bearing spaces that should not be cut lightly

- Starsilk Universe
- Orbital Tomb
- Heliocide Observatory
- Drakken Terraforming Laboratory
- Dex Voice Lab
- Arkship Civilization
- S'mores Katamari
- BigMac Backbone
- Dexter Sanctuary
- Reliquary Rotunda

---

# 41. Master implementation prompt

```text
You are implementing Museum of Me — The Reliquary of Iterative Becoming vNext, a persistent first-person Three.js museum.

PRIMARY OBJECTIVE

Build a finished, polished, maintainable virtual museum representing 64 confirmed projects through 35 interactive visitor-facing exhibits inside one continuous two-level physical museum.

This is a new vNext product. Do NOT turn the legacy Reliquary restoration artifact into the new codebase. Preserve legacy artifacts as read-only historical/source evidence. The old restoration may supply verified ideas, content, assets, and interaction patterns, but vNext has a new collection architecture and production contract.

PRODUCT LAWS

1. Genuine Three.js/WebGL first-person environment.
2. One continuous physical museum; no room-select screens or visible level loads.
3. Monumental Reliquary Rotunda at the center.
4. Six thematic wings:
   - North: Starsilk & Drakken
   - West: Archive & Canon
   - East: Dex Systems
   - South: Games & Play
   - Northwest mezzanine: Music / Promptcraft / Media
   - Northeast mezzanine: Local Systems
5. A sacred Dexter Sanctuary exists outside the ordinary exhibit count.
6. Museum content focuses on projects rather than glorifying their creator.
7. Every exhibit must provide:
   - physical 3D presence,
   - meaningful interaction,
   - clear information,
   - optional deeper interpretation.
8. 35 exhibits must represent all 64 project IDs exactly through an explicit mapping.
9. No live AI, cloud API, BigMac connection, OSINT query, private case data, credentials, or real personal data is required for the core visitor experience.
10. No exhibit gets its own frame loop.
11. Core interaction mechanisms are shared even though presentations differ.
12. Ordinary interface surfaces stay in semantic HTML/CSS.
13. Runtime assets use governed manifests, stable IDs, provenance, explicit ownership and disposal.
14. No hotlinked runtime assets.
15. Preserve accessibility, reduced motion, keyboard navigation, readable text, and input recovery.
16. Reduce scope before shipping unfinished rooms.

TECHNICAL BASELINE

Use TypeScript + Vite + vanilla Three.js unless repository evidence proves a different authoritative pinned baseline.

Use:
- one frame-loop owner,
- fixed-step player/simulation update,
- PointerLock-based first-person look,
- capsule/static collision,
- centralized AssetManager,
- centralized StreamingManager,
- centralized InteractionManager,
- centralized AudioManager,
- versioned visitor preferences/state,
- GLB runtime assets,
- KTX2/Meshopt where validated,
- DOM map/journal/accessibility surfaces.

MUSEUM EXHIBITS

North:
01 Starsilk Universe
02 Drakken Terraforming Compendium
03 Orbital Tomb
04 Starsilk Possibility Cartographer
05 StarSilk Maker
06 Drakken Field Anatomy Archive
07 Drakken Terraforming Laboratory
08 Heliocide Observatory

West:
09 Museum Evolution
10 WorldsVault Lineage
11 Continuity Systems
12 Rhetorical InDEX

Northwest mezzanine:
13 Suno Studio
14 Promptcraft & Vibe Coding
15 Agent Harness Laboratory
16 Media Application Lineage

East:
17 Dex Voice Lab
18 Dex Companion & Agent Systems
19 DexTilt
20 Utility & Privacy Bench
21 Civic Support Studio
22 Creative Tools Studio
23 Sensemaking Lab

South:
24 Era of Invincible Magic
25 DnDex / DM Hub
26 WestCat Systems
27 The Full Weasel
28 Against the Void
29 Arkship Civilization
30 AetherVFX
31 Story Worlds
32 S'mores Katamari
33 Endless Grok / Void Ascendancy

Northeast mezzanine:
34 BigMac Backbone
35 Local Specialist Systems Lab

DEXTER

Dexter is not a mascot. Preserve his exact visual identity from authoritative references. His Sanctuary is sparse, sacred, calm, and architecturally distinct. Dex software exhibits must not collapse Dexter himself into branding.

REQUIRED WORKFLOW

Work on ONE PHASE per execution unless the current phase explicitly establishes parallel wing branches.

Before edits:
1. Read OPERATIONAL_STATE.md.
2. Read docs/MUSEUM_VNEXT_BUILD_PLAN.md.
3. Read docs/ARCHITECTURE.md and docs/EXHIBIT_CONTRACT.md if present.
4. Inspect package.json, lockfile, build/test config, and relevant source.
5. Bound the current phase scope and do not broaden it.

Phase sequence:
0 authority/source freeze
1 repository/runtime foundation
2 complete museum graybox
3 core museum systems
4 asset pipeline
5 vertical slice
6 production architecture
7 exhibit wave one
8 exhibit wave two
9 content completion
10 experience polish
11 accessibility/input
12 performance/lifecycle
13 full museum QA
14 deployment/release

GIT DISCIPLINE

Use a phase branch.
Never push directly to main.

Before every phase commit:
- git status --short
- git diff --check
- npm run typecheck
- npm run lint
- npm test
- npm run build

When available also run:
- npm run validate:assets
- npm run test:e2e
- npm run check:budgets

Inspect git diff and staged files before committing.
Commit only the phase-authorized files.
Push the phase branch only after the phase acceptance gate passes.
Do not deploy production from a feature branch.

IMPLEMENTATION DISCIPLINE

Use one primary implementation pass and at most one bounded repair pass after failed validation.

Do not:
- re-scaffold the project,
- switch framework casually,
- add unrelated dependencies,
- broadly refactor passing systems,
- replace real 3D architecture with flat UI,
- use placeholder boxes as final exhibits,
- claim runtime verification from source inspection.

If a required capability cannot be proven, report it as unverified instead of claiming completion.

PHASE REPORT

Return only:
1. phase completed,
2. files changed,
3. acceptance criteria,
4. validation commands and results,
5. branch/commit identity,
6. unresolved blockers,
7. next authorized phase.

Stop after the current phase gate.
```

---

# 42. Phase and lane sub-prompts

## A. Phase 0 — Authority freeze

```text
Execute Museum vNext Phase 0 only.

Establish the new vNext project authority without modifying historical Reliquary source artifacts.

Create or update:
- OPERATIONAL_STATE.md
- docs/MUSEUM_VNEXT_BUILD_PLAN.md
- docs/ARCHITECTURE.md
- docs/EXHIBIT_CONTRACT.md
- docs/ASSET_POLICY.md
- docs/PRIVACY_POLICY.md
- src/content/projects.json
- src/content/exhibits.json

Encode the 64-project -> 35-exhibit mapping exactly.

Add deterministic validation that fails when:
- a confirmed project has no exhibit,
- a project is unintentionally mapped more than once,
- an exhibit has no represented project.

Do not build museum visuals yet.

Run the phase gate, commit on a phase branch, push that branch, and stop.
```

## B. Phase 2 — Graybox

```text
Build the complete traversable Museum of Me vNext graybox.

Create:
- exterior arrival plaza,
- entrance,
- monumental Reliquary Rotunda,
- North Starsilk wing,
- West Archive wing,
- East Dex wing,
- South Games wing,
- Northwest mezzanine,
- Northeast mezzanine,
- stairs/elevator routes,
- all 35 exhibit room footprints,
- Dexter Sanctuary.

Use simple materials and geometry only.

The entire building must exist in one continuous world.

Do not art-polish.

Validate a complete walking circuit through every wing and back to the entrance.

Preserve generous scale, long sightlines, and accessibility.

Run phase checks, commit, push branch, stop.
```

## C. Core runtime

```text
Implement the Museum vNext core runtime only.

Build one frame-loop owner plus:
- first-person input,
- capsule/static collision,
- InteractionManager,
- ExhibitRegistry,
- StreamingManager,
- AssetManager,
- AudioManager,
- visitor state/preferences,
- map/journal shell,
- diagnostics.

Define and freeze the ExhibitModule lifecycle:
preload -> mount -> activate -> update -> deactivate -> unmount -> dispose.

Create five placeholder modules proving independent activation and disposal.

Do not build finished exhibits.

Run focused lifecycle and traversal checks, commit, push, stop.
```

## D. Asset pipeline

```text
Implement the governed Museum vNext asset pipeline.

Add:
- stable asset IDs,
- source/runtime manifests,
- provenance records,
- licensing/ownership fields,
- runtime budgets,
- GLB loading,
- KTX2 support,
- Meshopt support,
- load cancellation,
- disposal,
- validation tooling.

Prove one representative GLB can:
load -> render -> unload -> release -> reload.

Do not source random third-party assets yet.

Commit and push only after asset validation passes.
```

## E. North wing

```text
Implement the Starsilk & Drakken Wing within the frozen museum/exhibit contracts.

Exhibits:
01 Starsilk Universe
02 Drakken Terraforming Compendium
03 Orbital Tomb
04 Starsilk Possibility Cartographer
05 StarSilk Maker
06 Drakken Field Anatomy Archive
07 Drakken Terraforming Laboratory
08 Heliocide Observatory

Preserve Starsilk canon exactly.

The wing must remain mythic, celestial, elegant, and editorial rather than generic cyberpunk.

Each exhibit requires:
- physical 3D anchor,
- unique presentation,
- shared-system-compatible interaction,
- concise physical interpretation,
- accessible deep-dive surface,
- activation/reset path,
- explicit asset disposal.

Do not add new canon.
Do not turn Drakken Compendium into thirty-five full hero models.

Run wing traversal, exhibit activation, and stream/unload tests before commit.
```

## F. Dex wing

```text
Implement the Dex Systems Wing.

Exhibits:
17 Dex Voice Lab
18 Dex Companion & Agent Systems
19 DexTilt
20 Utility & Privacy Bench
21 Civic Support Studio
22 Creative Tools Studio
23 Sensemaking Lab

Use synthetic demonstration information.

No real filesystem changes.
No live BigMac access.
No private case material.
No required microphone permission.
No cloud API dependency.

Keep Dexter himself distinct from Dex-branded software. Do not mascotize him.

Run all exhibit reset/disposal paths, accessibility checks, and full wing traversal before commit.
```

## G. Games wing

```text
Implement the Games & Play Wing.

Exhibits:
24 Era of Invincible Magic
25 DnDex / DM Hub
26 WestCat Systems
27 The Full Weasel
28 Against the Void
29 Arkship Civilization
30 AetherVFX
31 Story Worlds
32 S'mores Katamari
33 Endless Grok / Void Ascendancy

Do not embed whole games.

Create museum-scale deterministic demonstrations.

S'mores Katamari may contain one bounded playable micro-level.

Every other exhibit must have strict start/reset behavior and remain subordinate to the museum runtime.

Avoid introducing separate physics/render loops.

Validate performance with several neighboring exhibits resident simultaneously.
```

## H. Archive wing

```text
Implement the Archive & Canon Wing.

Exhibits:
09 Museum Evolution
10 WorldsVault Lineage
11 Continuity Systems
12 Rhetorical InDEX

Make this wing quieter and more scholarly than the spectacle wings.

Museum Evolution must remain modest and historical; do not convert the museum into self-celebration.

WorldsVault Lineage should physically demonstrate evolution across Uplink -> CanonForge -> WorldsVault.

Continuity Systems should teach durable handoff/context through an interactive assembly.

Rhetorical InDEX must use fictional or public demonstration content rather than private disputes.
```

## I. Northwest mezzanine

```text
Implement the Northwest Mezzanine: Music / Promptcraft / Media.

Exhibits:
13 Suno Studio
14 Promptcraft & Vibe Coding
15 Agent Harness Laboratory
16 Media Application Lineage

Use only audio/media that is owned or cleared.

No live AI generation is required.

Promptcraft interactions must be deterministic.

Keep audio spatially zoned so the Rotunda and neighboring exhibits remain quiet.
```

## J. Northeast mezzanine

```text
Implement the Northeast Mezzanine: Local Systems.

Exhibits:
34 BigMac Backbone
35 Local Specialist Systems Lab

BigMac Backbone must show architecture and information flow rather than expose operational secrets.

Use synthetic addresses/configuration in visitor-facing content.

OSINT uses fictional data.
FaceTools uses synthetic faces.

The key narrative is local-first architecture and trust boundaries.
```

## K. Dexter Sanctuary

```text
Implement the Dexter Sanctuary as a sacred architectural destination, not a normal exhibit.

Use authoritative Dexter visual references.

Preserve:
- tricolor Phalène identity,
- hanging ears,
- correct proportions,
- recognizable face/coat,
- restrained behavior.

Do not:
- use mascot UI,
- add paw-print collectibles,
- give Dexter tutorial dialogue,
- gamify the Sanctuary,
- make the space visually noisy.

Create a calm threshold, central Dexter presence, subtle reference material, and accessible contextual text.

The Sanctuary must work even if the visitor has never entered a Dex software exhibit.
```

## L. Final performance and release

```text
Run the Museum vNext release-hardening phase.

Test:
- cold load,
- every wing transition,
- all 35 exhibits,
- full 64-project mapping,
- repeated load/unload,
- memory stability,
- quality tiers,
- keyboard,
- mouse,
- touch fallback,
- map,
- journal,
- reduced motion,
- accessible exhibit text,
- pointer-lock recovery,
- resize/focus/blur,
- deployment asset URLs,
- direct page refresh,
- production cache behavior.

Perform a full first-person walkthrough and capture screen-recording evidence for visual QA.

Do not treat build success as proof of museum behavior.

One bounded repair pass is allowed.

If any release gate remains failed or unverified, report NOT READY instead of shipping.
```

---

# 43. Immediate next steps

The next work should be deliberately boring and structural.

1. Declare vNext a new project lineage and leave the old restoration frozen.
2. Create the repository/worktree and `OPERATIONAL_STATE.md`.
3. Commit this plan as `docs/MUSEUM_VNEXT_BUILD_PLAN.md`.
4. Create the machine-readable 64→35 mapping.
5. Freeze the exhibit API.
6. Build the **entire museum graybox before making any gallery beautiful**.
7. Complete the five-exhibit vertical slice.
8. Only then permit concurrent wing production.

The decisive milestone is not that one wing looks spectacular.

It is:

> I can enter the museum, traverse the entire enormous building continuously, reach every future exhibit space and the Dexter Sanctuary, return to the entrance, and nothing about the architecture or runtime requires us to fake the finished experience later.

Once that is true, this stops being another Museum of Me concept.

It becomes a museum under construction.
