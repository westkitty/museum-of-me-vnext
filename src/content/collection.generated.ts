// GENERATED FILE — do not edit by hand.
// Source: data/exhibit-mapping.current.json, data/exhibit-content.json + revision overlays, data/projects/*.json
// Regenerate: npm run build:collection
// prettier-ignore
import type { Collection } from './types';

export const COLLECTION: Collection = {
  "projects": [
    {
      "id": "P001",
      "name": "Starsilk Universe",
      "family": "Starsilk / Drakken",
      "kind": "Creative universe",
      "status": "Active",
      "period": "2025–2026",
      "summary": "A science-fantasy universe whose physics rest on Starsilk: a material that can be programmed like software.",
      "brief": "Starsilk began as a question about what a world looks like if its fundamental material is programmable. The answer became a continuity-heavy universe with its own physics, factions, chronology and hard rules — Starsilk Macros, the Codec, the Shard-God Tiger, Syrin, the Drakken, the Administration, and the long consequence of the Starbinding. Its defining discipline is the separation of canon from invention: every addition is checked against what the setting has already committed to.",
      "deep": [
        "Starsilk is a material and a programming surface at the same time. Macros written into it behave like executable instructions, which means the setting's magic system and its software model are the same object seen from two directions.",
        "The universe accumulated a set of hard locks that later work is not permitted to contradict — the nature of Syrin, the appearance of the Siege Wall, and the rules governing how Starsilk can be manipulated. These locks are the reason the setting held together across dozens of separate productions.",
        "Downstream productions inherit rather than reinvent: the Compendium, the Orbital Tomb, the Terraforming Laboratory and the Observatory all read from the same canon and write back corrections when they discover a contradiction.",
        "Software projects that carry Starsilk branding are counted separately from the universe itself, because they have independent implementation histories."
      ],
      "capabilities": [
        "Cosmology and physics rules",
        "Faction and character canon",
        "Chronology and canon deltas",
        "Visual law and prompt-safe references",
        "Continuity auditing"
      ],
      "lesson": "A setting survives scale only when the rule that forbids something is written down as carefully as the thing it permits.",
      "repos": [
        "westkitty/Starsilk_Cartographer",
        "westkitty/StarSilk_Maker",
        "westkitty/Heliocide_Viewer"
      ]
    },
    {
      "id": "P002",
      "name": "Drakken Terraforming Compendium",
      "family": "Starsilk / Drakken",
      "kind": "Field compendium",
      "status": "Active reference; production incomplete",
      "period": "2026",
      "summary": "A thirty-seven entry field guide to the Drakken: one Egg, thirty-five strains across five archetypes, and one Mother.",
      "brief": "The Compendium presents the Drakken the way a technical service manual presents machinery — as an in-universe forensic reference rather than a bestiary. Its structure is fixed at thirty-seven entries and its taxonomy at five archetypes, and its formatting doctrine (terminal-styled, stat-block driven) is treated as part of the canon rather than as decoration.",
      "deep": [
        "The Drakken are terraforming instruments. Each strain performs a specific function in converting a hostile world into a habitable one, and the compendium documents morphology only as far as it explains function.",
        "The five-archetype taxonomy is a hard constraint. Later work repeatedly tried to add a sixth category and was repeatedly refused, because the archetypes describe stages of a process rather than a convenient grouping.",
        "A significant canon correction separated Gorevault gathering and refinement from Ringthroat SKY production. Collapsing these two functions was the single most common error in derivative work.",
        "The complete taxonomy remains available in interpretation even though the museum builds only five representative forms — building thirty-five production models was cut before quality was."
      ],
      "capabilities": [
        "Thirty-seven entry taxonomy",
        "Archetype classification",
        "Stat-block specification",
        "Terminal-style format doctrine",
        "Canon correction record"
      ],
      "lesson": "A taxonomy is only useful if it describes a process; categories invented for tidiness fall apart the first time something has to be classified.",
      "repos": [
        "westkitty/Drakken_Field_Guide_to_Anatomy",
        "westkitty/The-Drakken-Terraforming-Laboratory"
      ]
    },
    {
      "id": "P003",
      "name": "Orbital Tomb",
      "family": "Starsilk / Drakken",
      "kind": "Multimedia production",
      "status": "Active; paused between productions",
      "period": "2026",
      "summary": "A song, a narrative and an interactive tour about a station being taken apart in orbit over six months.",
      "brief": "Orbital Tomb follows the Shard-God Tiger surgically dismantling Meridian Station in high orbit above Virgil. It exists simultaneously as music, as story, as visual production and as a browser-based Three.js tour, and each form was developed against the same six-month timeline rather than adapted from one another after the fact.",
      "deep": [
        "The central image is deliberate: not an explosion, but a dismantling. The station is taken apart with intent and precision over months, and the visual language was explicitly held away from generic post-Starbinding black-hole imagery.",
        "The six-month structure — the Dismantling Clock — is the spine that the song, the storyboards and the interactive tour all share. Any point in the production can be located on it.",
        "Corpse-geography drives the imagery: the station's remains are read as landscape and anatomy rather than as debris.",
        "The interactive tour is an implementation subproject. It carries part of the work, not the whole of it."
      ],
      "capabilities": [
        "Song and lyric work",
        "Narrative canon",
        "Storyboard and visual language",
        "Six-month dismantling timeline",
        "Interactive Three.js tour"
      ],
      "lesson": "When several media share one timeline instead of one script, they stop being adaptations of each other and start being views of the same event.",
      "repos": [
        "westkitty/orbital_tomb_tour"
      ]
    },
    {
      "id": "P004",
      "name": "Starsilk Possibility Cartographer",
      "family": "Starsilk / Drakken",
      "kind": "Software",
      "status": "Active prototype",
      "period": "2026",
      "summary": "A deterministic engine that maps what canon has used, forbidden, contradicted, left unresolved, and still permits.",
      "brief": "The Cartographer treats a fictional canon as a body of evidence rather than a pile of text. It indexes sources, assigns epistemic states to claims, runs ontology checks, and produces a map of negative space: the regions a setting has not yet spent. It runs entirely locally and produces the same answer for the same snapshot every time.",
      "deep": [
        "Its central rule is that absence of a rule is not permission. A region of possibility space that canon has never addressed is marked unresolved, not marked legal.",
        "Claims carry evidence states — used, forbidden, contradictory, unresolved, insufficiently supported, still legal — and the tool refuses to promote a claim between states without a source.",
        "Determinism is a design requirement, not an optimisation. A snapshot plus a query always yields the same map, which is what makes the output usable as an argument.",
        "The tool proposes; it does not canonise. Acceptance into canon remains a separate human process, and the software is explicitly built so it cannot short-circuit that."
      ],
      "capabilities": [
        "Source indexing",
        "Evidence-state model",
        "Ontology checks",
        "Deterministic snapshots",
        "Read-only query tools",
        "Creation-packet export"
      ],
      "lesson": "A tool that maps what is still possible is more useful than one that generates possibilities, because the first one can be argued with.",
      "repos": [
        "westkitty/Starsilk_Cartographer"
      ]
    },
    {
      "id": "P005",
      "name": "StarSilk Maker",
      "family": "Starsilk / Drakken",
      "kind": "Software / generative",
      "status": "Active",
      "period": "2026",
      "summary": "A generative instrument that turns drawn paths into woven Starsilk compositions.",
      "brief": "StarSilk Maker is the setting's central material made operable. A path becomes a thread; threads accumulate into a composition governed by the same weaving rules the universe describes. It is the project where Starsilk stopped being a description and became something a person could actually manipulate.",
      "deep": [
        "The generator follows the canon rules for how Starsilk behaves under tension and interference, so its outputs are not arbitrary decoration — they are legal configurations of the material.",
        "A separate drifting variant explores what happens when threads are given motion and allowed to settle over time rather than being fixed at creation.",
        "Because the output is procedural, a composition can be described by its parameters instead of stored as an image, which is what makes the museum installation possible without shipping a texture library."
      ],
      "capabilities": [
        "Path-to-thread generation",
        "Procedural weave composition",
        "Drifting variant",
        "Parameterised output"
      ],
      "lesson": "The fastest way to find out whether an invented material has coherent rules is to build something that has to obey them.",
      "repos": [
        "westkitty/StarSilk_Maker",
        "westkitty/StarSilk_Maker_Drifting"
      ]
    },
    {
      "id": "P006",
      "name": "Drakken Field Anatomy Archive",
      "family": "Starsilk / Drakken",
      "kind": "Reference archive",
      "status": "Experimental; not implemented in the inspected baseline",
      "period": "2026",
      "summary": "A forensic anatomy reference separating canon Drakken specimens from deliberately non-canon surrogates.",
      "brief": "The Anatomy Archive documents Drakken internal structure at four levels — external form, skeletal frame, energy and process systems, and cross-section. Its most important structural decision is a hard separation between canon specimens and intentionally non-canon surrogate specimens used for teaching, so that illustrative material can never be mistaken for canon.",
      "deep": [
        "Drakken anatomy is process anatomy. Organs are read as stages of a terraforming pipeline rather than as biology borrowed from Earth animals.",
        "Surrogate specimens exist because teaching a structure sometimes requires an example that canon does not contain. Marking them clearly is what keeps them safe to use.",
        "The archive is greenfield: the reference doctrine is settled but the full specimen set was never implemented, and the museum represents the method rather than claiming a finished archive."
      ],
      "capabilities": [
        "Four-layer anatomical views",
        "Canon / surrogate separation",
        "Process-organ documentation"
      ],
      "lesson": "Teaching material and canon material must be labelled differently at the point of creation, not at the point of publication.",
      "repos": [
        "westkitty/Drakken_Field_Guide_to_Anatomy"
      ]
    },
    {
      "id": "P007",
      "name": "The Drakken Terraforming Laboratory",
      "family": "Starsilk / Drakken",
      "kind": "Software / simulation",
      "status": "Active prototype",
      "period": "2026",
      "summary": "A simulation of the Drakken terraforming pipeline, from raw collection through to breathable sky.",
      "brief": "The Laboratory runs the process the Compendium describes. Drakken strains are deployed against a hostile world and their functions chain together: Gorevault collection, gathering, rendering and refinement produce feedstock; Ringthroat converts feedstock into SKY. The world visibly changes as the chain runs.",
      "deep": [
        "The process lock is the point of the project. Gorevault handles collection, gathering, and rendering into refined feedstock. Ringthroat converts feedstock into SKY. These are separate functions and the simulation refuses to collapse them.",
        "The simulation is deterministic and scripted rather than physically general. A world's transformation is a function of which strains were deployed and in what order, which makes the outcome explainable.",
        "Running the pipeline surfaced canon errors that reading the Compendium had not — the ordering constraint only became obvious once something had to execute it."
      ],
      "capabilities": [
        "Strain deployment",
        "Four-stage Gorevault chain",
        "Ringthroat SKY conversion",
        "Deterministic world transformation"
      ],
      "lesson": "Writing a process down proves it is describable; running it proves it is coherent. They are not the same test.",
      "repos": [
        "westkitty/The-Drakken-Terraforming-Laboratory"
      ]
    },
    {
      "id": "P008",
      "name": "Heliocide Observatory",
      "family": "Starsilk / Drakken",
      "kind": "Software / visualization",
      "status": "Active; prototype validated in repository evidence",
      "period": "2026",
      "summary": "An observatory for watching the Heliocide: stars going out, one after another, in the correct order.",
      "brief": "The Observatory reconstructs the extinguishing of stars across the setting's sky. Its hardest requirement is a visual rule: from an inhabited world, the Siege Wall must read as an absence — a swath of sky where stars are simply no longer there — and never as masonry, lattice or grid.",
      "deep": [
        "The canon visual rule exists because the Siege Wall is not a structure seen from below. It is the shape of what has been removed. Every draft that rendered it as an object was rejected.",
        "The reconstruction is sequential and controlled: stars vanish in canon order, so the installation is a historical playback rather than an effect.",
        "Multiple viewing stations exist because the same event has genuinely different appearances from different vantage points, and the setting depends on that difference."
      ],
      "capabilities": [
        "Sequential stellar extinction",
        "Siege Wall absence rendering",
        "Multi-station viewpoints",
        "Canon-ordered playback"
      ],
      "lesson": "Some canon rules are about what a thing must not look like; those are the ones that get violated most often and matter most.",
      "repos": [
        "westkitty/Heliocide_Viewer",
        "westkitty/Heliocide_Viewer_dexgpt"
      ]
    },
    {
      "id": "P009",
      "name": "Museum of Me / The Reliquary of Iterative Becoming",
      "family": "Museum / archive systems",
      "kind": "Interactive archive",
      "status": "Superseded by this building",
      "period": "2026",
      "summary": "The earlier attempts to build this museum, preserved as evidence rather than hidden.",
      "brief": "Before this building existed there were several Museum of Me concepts, including a large single-file Three.js artifact titled The Reliquary of Iterative Becoming. Those artifacts remain intact as historical evidence. This building is a separate lineage — a new collection structure, asset pipeline and production contract — rather than another restoration pass over the old one.",
      "deep": [
        "The earliest concepts were closer to interactive documents than to buildings: content organised by page rather than by space.",
        "The Reliquary restoration reached a large single-file Three.js artifact. It proved the idea was possible and demonstrated exactly why a single file could not carry thirty-five distinct interactive exhibits.",
        "The decision to treat this version as a new product rather than a restoration is the most consequential one in the museum's history. Restoration would have inherited the constraint that made the previous version stall.",
        "The prior artifacts are preserved unmodified outside this project. Nothing in this building overwrites them."
      ],
      "capabilities": [
        "Interactive archive concept",
        "Single-file Three.js artifact",
        "Exhibit and subproject relationships",
        "Preserved legacy lineage"
      ],
      "lesson": "There is a point where restoring an artifact costs more than rebuilding the thing it was trying to be.",
      "repos": []
    },
    {
      "id": "P010",
      "name": "Suno AI Lyrics and Manual",
      "family": "Music / prompt systems",
      "kind": "Doctrine and reference",
      "status": "Active",
      "period": "2026",
      "summary": "A working manual for songwriting with a generative music model, built from what actually reproduced.",
      "brief": "This project is a codex rather than an application: a durable body of doctrine covering lyric structure, narration, style prompts and parameter behaviour for Suno V5. It was assembled by writing songs, observing which instructions changed the output and which were ignored, and recording only the parts that held up across attempts.",
      "deep": [
        "Generative music models respond to structure far more reliably than to adjectives. Section markers, line counts and syllable discipline move the output; mood words often do not.",
        "The manual distinguishes instructions that are reliable, instructions that are situational, and instructions that were believed to work but did not survive testing — the last category is the most useful part.",
        "Style prompts are treated as a small formal language with its own grammar rather than as free description.",
        "The songs produced for other projects in this museum, including Orbital Tomb, were written against this doctrine."
      ],
      "capabilities": [
        "Lyric and section structure",
        "Narration technique",
        "Style-prompt grammar",
        "Parameter doctrine",
        "Reproducibility notes"
      ],
      "lesson": "A prompt manual is only worth keeping if it records the techniques that failed alongside the ones that worked.",
      "repos": []
    },
    {
      "id": "P011",
      "name": "Visual Prompt Systems Registry",
      "family": "Prompt / AI workflow systems",
      "kind": "Template registry",
      "status": "Active",
      "period": "2026",
      "summary": "A registry of image-prompt templates with batch syntax, categories and explicit negative constraints.",
      "brief": "The Registry treats visual prompts as reusable components instead of one-off text. Templates carry slots, categories organise them, dynamic batch syntax expands one template into a controlled set of variations, and negative constraints are stored with the template rather than remembered separately.",
      "deep": [
        "Storing negative constraints with the template is the detail that makes the registry work. The list of things a prompt must exclude is harder to reconstruct from memory than the prompt itself.",
        "Batch syntax turns exploration into a grid rather than a sequence of guesses, which makes comparing variations meaningful.",
        "Formatting rules are part of the registry because model output is sensitive to punctuation and ordering in ways that are easy to lose when copying prompts by hand."
      ],
      "capabilities": [
        "Reusable templates",
        "Dynamic batch expansion",
        "Category system",
        "Negative constraints",
        "Formatting rules"
      ],
      "lesson": "The reusable part of a prompt is usually the constraint list, not the description.",
      "repos": [
        "westkitty/local_sdxl_prompt_vault",
        "westkitty/sdxl-prompt-forge"
      ]
    },
    {
      "id": "P012",
      "name": "Era of Invincible Magic: Lands Unknown",
      "family": "Games / creative systems",
      "kind": "Campaign and sourcebook",
      "status": "Paused; production package complete",
      "period": "2026",
      "summary": "A full campaign for Battle for Wesnoth, authored data-first with its own architect workflow.",
      "brief": "Lands Unknown is a campaign and sourcebook for Battle for Wesnoth 1.18. Its distinguishing decision is that the campaign was authored as structured data — units, identifiers, dialogue, mechanics, scenario definitions — before it was authored as content, using a purpose-built workflow to keep the two consistent.",
      "deep": [
        "Wesnoth campaigns are defined by a large body of interlocking configuration. Treating that body as a dataset rather than as files made cross-references checkable.",
        "Identifier discipline is what keeps a campaign of this size from collapsing: a unit referenced in dialogue, in a scenario and in a balance table must be the same unit everywhere.",
        "The architect workflow that produced it is reusable for any similarly data-heavy game project.",
        "The production package is complete; the campaign's published state is unconfirmed."
      ],
      "capabilities": [
        "Campaign systems",
        "Unit and identifier data",
        "Dialogue",
        "Mechanics design",
        "Sourcebook",
        "Data-first authoring workflow"
      ],
      "lesson": "Content-heavy game projects are database problems wearing a narrative costume.",
      "repos": []
    },
    {
      "id": "P013",
      "name": "Vibe Coding Nexus / DexGate Academy",
      "family": "Learning / interactive",
      "kind": "Learning environment",
      "status": "Active / evolving",
      "period": "2026",
      "summary": "A game-like learning environment for people building software with AI tools for the first time.",
      "brief": "DexGate Academy teaches the practice of building software conversationally — choosing tools, structuring a project, recognising when progress has stalled — to an audience that does not already have programming habits. It is delivered as an interactive, beginner-safe experience rather than as documentation.",
      "deep": [
        "The audience is the constraint. Someone whose first programming environment is a chat window has different failure modes than a self-taught programmer, and generic tutorials address neither.",
        "Guided practice is preferred over explanation. The environment gives a task, lets it go wrong safely, and then explains what happened.",
        "Tool choice is taught as a decision with tradeoffs rather than as a recommendation, because the tool landscape changes faster than any curriculum."
      ],
      "capabilities": [
        "Interactive lessons",
        "Guided practice",
        "Tool-choice decision framing",
        "Progress tracking",
        "Beginner-safe environment"
      ],
      "lesson": "Teaching people to build software with AI is mostly teaching them to recognise when the conversation has stopped making progress.",
      "repos": [
        "westkitty/welcome_to_vibe_coding",
        "westkitty/DexGate"
      ]
    },
    {
      "id": "P014",
      "name": "KinDex Handoff",
      "family": "Continuity infrastructure",
      "kind": "Local GUI tool",
      "status": "Experimental / planned",
      "period": "2026",
      "summary": "A handoff builder that stages evidence-linked claims for human approval before they become project record.",
      "brief": "KinDex scans project material and proposes claims about it — what exists, what state it is in, what remains. Every claim carries a link back to the evidence that produced it, and nothing enters the record until a person approves it. Its outputs are handoff documents, task lists, open questions, a source index and an append-only project record.",
      "deep": [
        "The approval gate is the design. An automated summary that is 90% right is worse than useless for project continuity, because the 10% is indistinguishable from the rest.",
        "Evidence links make a claim checkable in seconds instead of minutes, which is what makes reviewing a hundred of them practical.",
        "The append-only record means corrections are added rather than overwriting history."
      ],
      "capabilities": [
        "Project material scanning",
        "Evidence-linked claims",
        "Human approval gate",
        "Handoff, task and question export",
        "Append-only record"
      ],
      "lesson": "Automated project summaries need a human approval step, because a plausible wrong claim is more expensive than no claim.",
      "repos": []
    },
    {
      "id": "P015",
      "name": "DnDex / DM_Hub",
      "family": "Dex / games",
      "kind": "Web application",
      "status": "Active / evolving",
      "period": "2026",
      "summary": "An encounter runner for a game master: initiative, hit points, a tactical map, and nothing that slows the table.",
      "brief": "DnDex is a local D&D 5e encounter-management application built around the reality that a game master is doing several things at once under time pressure. Initiative order, hit-point tracking, a tactical map, a bestiary and rules reference sit in one workspace with persistence, history and import/export.",
      "deep": [
        "The design constraint is table speed. Any interaction that takes longer than the mental arithmetic it replaces will be abandoned mid-session.",
        "History and undo exist because encounters are corrected constantly — a misread modifier, a forgotten reaction — and a tool without undo makes that worse than paper.",
        "Running locally means no session depends on a network at a table that may not have one.",
        "Import and export keep prepared material portable rather than trapped in the application."
      ],
      "capabilities": [
        "Initiative tracking",
        "Hit-point management",
        "Tactical map",
        "Bestiary",
        "Rules reference",
        "Persistence and history",
        "Import / export"
      ],
      "lesson": "Tools used under time pressure are judged on interaction cost, not on feature count.",
      "repos": [
        "westkitty/DnDex",
        "westkitty/DnDex_Redux"
      ]
    },
    {
      "id": "P016",
      "name": "DexGPT / DnDex Operating Project",
      "family": "Dex / AI workflow systems",
      "kind": "Context and continuity system",
      "status": "Active",
      "period": "2026",
      "summary": "A working context that governs how an assistant behaves across sessions: voice, memory, exactness.",
      "brief": "DexGPT is a persona and continuity system — a set of rules about voice, memory handling, project continuity and how precisely an instruction must be followed. It is named after Dexter and shaped by him, but it is software, and this museum keeps that distinction strictly.",
      "deep": [
        "The rules that mattered most were about exactness: when to ask rather than assume, and when a stated constraint must not be quietly relaxed.",
        "Continuity is handled by pointing at durable records rather than by attempting to remember, which is why it works across tools.",
        "The naming is affectionate. It is not an attempt to make Dexter into a product, and the Sanctuary elsewhere in this building exists partly to make that boundary physical."
      ],
      "capabilities": [
        "Voice and behaviour rules",
        "Memory and continuity handling",
        "Exactness constraints",
        "Cross-session identity"
      ],
      "lesson": "A useful assistant configuration is mostly a list of things it must not silently decide for you.",
      "repos": []
    },
    {
      "id": "P017",
      "name": "Code Harness",
      "family": "Prompt / AI workflow systems",
      "kind": "Orchestration harness",
      "status": "Active",
      "period": "2026",
      "summary": "An orchestration layer that routes work between reusable workflows, local inference and specialist agents.",
      "brief": "Code Harness assembles the working parts of an AI development setup into one addressable system: reusable workflows, project context, local model inference, specialist agent definitions, and the handoff artifacts that move work between them. Its persistence lives in the Bible Repo rather than in the harness itself.",
      "deep": [
        "A harness is not a model wrapper. Its job is to decide what context a task needs, which specialist should handle it, and what has to be preserved when the task ends.",
        "Generated specialist artifacts let a capability be defined once and reused, instead of being re-described at the start of every session.",
        "Keeping persistence external means the harness can be replaced without losing the accumulated project record — which turned out to matter."
      ],
      "capabilities": [
        "Reusable workflows",
        "Context assembly",
        "Local inference routing",
        "Specialist agent artifacts",
        "Handoff generation"
      ],
      "lesson": "Orchestration systems should not own the memory they orchestrate, or they become impossible to replace.",
      "repos": [
        "westkitty/ChatGPT_Bible_Repo"
      ]
    },
    {
      "id": "P018",
      "name": "ChatGPT Bible Repo",
      "family": "Continuity infrastructure",
      "kind": "Persistence layer",
      "status": "Active",
      "period": "2026",
      "summary": "A Git repository that holds project identity and history so it survives outside any single conversation.",
      "brief": "The Bible Repo is where project continuity actually lives. Each project has an append-only record of its identity, decisions, handoffs and recognition metadata, stored in Git so that a new conversation in any tool can be brought up to speed from evidence rather than from memory.",
      "deep": [
        "Append-only is the core constraint. Records accumulate; they are not edited into a tidier present.",
        "Recognition metadata lets a project be identified from partial context — a path, a repository name, a fragment of terminology.",
        "The repository is the reason several projects in this museum could be reconstructed accurately years after the conversations that produced them.",
        "It also holds records for systems that have no repository of their own, which is why some infrastructure projects here can be documented at all."
      ],
      "capabilities": [
        "Append-only project Bibles",
        "Identity records",
        "Handoff artifacts",
        "Recognition metadata",
        "Cross-tool continuity"
      ],
      "lesson": "Context that lives only in a conversation is context you are going to lose.",
      "repos": [
        "westkitty/ChatGPT_Bible_Repo"
      ]
    },
    {
      "id": "P019",
      "name": "Opencode Harness",
      "family": "Prompt / AI workflow systems",
      "kind": "Integration harness",
      "status": "Experimental / paused",
      "period": "2026",
      "summary": "An attempt to make several different coding agents share one context and hand work to each other.",
      "brief": "Opencode Harness explored interoperability between separate agent tools — OpenCode, Claude Code and a local coding agent — with shared context, common orchestration and a handoff format that survived the boundary between them. It is local-first and currently paused.",
      "deep": [
        "The hard part is not invoking several tools; it is that each one has a different idea of what a project is and what context it needs.",
        "The handoff format was the productive output: a bounded description of state that any of the tools could consume.",
        "It is paused rather than abandoned because the underlying tools were changing faster than an integration layer could track."
      ],
      "capabilities": [
        "Multi-agent interoperability",
        "Shared context",
        "Handoff format",
        "Local-first operation"
      ],
      "lesson": "Integrating fast-moving tools costs more than the integration saves until the tools slow down.",
      "repos": [
        "westkitty/Opencode_Harness"
      ]
    },
    {
      "id": "P020",
      "name": "DexClawdBot / Clawdbot",
      "family": "Dex / local AI",
      "kind": "Local assistant",
      "status": "Abandoned",
      "period": "2026",
      "summary": "A local assistant with append-only memory the user could inspect, correct, pin or forget.",
      "brief": "Clawdbot reached the user through a messaging transport and kept its memory as an append-only stream with provenance attached to every entry. The controls it exposed — inspect, correct, pin, forget — are the part worth preserving, and the project is defunct.",
      "deep": [
        "Provenance on every memory entry means a user can ask why the assistant believes something and get an answer with a source.",
        "Forget was implemented as an explicit operation rather than as deletion, so the record shows that something was forgotten and when.",
        "The project was abandoned. Its memory-control model outlived it and reappears in later work."
      ],
      "capabilities": [
        "Messaging transport",
        "Append-only memory",
        "Per-entry provenance",
        "Inspect / correct / pin / forget controls",
        "Local inference"
      ],
      "lesson": "An assistant's memory needs a forget button that leaves a mark, not one that pretends nothing was there.",
      "repos": [
        "westkitty/Dex_Claw_Hub",
        "westkitty/chatterbot_dex"
      ]
    },
    {
      "id": "P021",
      "name": "DexDictate macOS",
      "family": "Dex / productivity tools",
      "kind": "macOS application",
      "status": "Active",
      "period": "2026",
      "summary": "System-wide dictation for macOS that runs entirely on the machine, with no speech leaving it.",
      "brief": "DexDictate is a menu-bar application that transcribes speech into whatever text field currently has focus, anywhere in the operating system. Recognition runs locally through a bundled Whisper implementation, so dictation works offline and no audio is transmitted.",
      "deep": [
        "System-wide text insertion requires Accessibility permission and event taps — the same machinery assistive technology uses — which makes the permission model part of the product design rather than an installation detail.",
        "Audio capture and transcription run on a dedicated serial queue with strict main-actor isolation for interface state. This structure was the resolution of a data race that made early builds unreliable in a way that only appeared under real use.",
        "Running the model locally sets a hard ceiling on latency and a hard floor on privacy, and both were treated as requirements rather than tradeoffs.",
        "The application ships through a scripted build that cleans, compiles, signs and installs in one step, because manual release steps were a reliable source of broken builds."
      ],
      "capabilities": [
        "System-wide dictation",
        "Local Whisper transcription",
        "Accessibility event taps",
        "Offline operation",
        "Scripted signed builds"
      ],
      "lesson": "Concurrency bugs in audio code do not show up in testing; they show up in the third minute of real dictation.",
      "repos": [
        "westkitty/DexDictate_MacOS"
      ]
    },
    {
      "id": "P022",
      "name": "DexDictate Android",
      "family": "Dex / productivity tools",
      "kind": "Android input method",
      "status": "Active foundation",
      "period": "2026",
      "summary": "The same idea on Android, rebuilt as an input method rather than ported.",
      "brief": "On Android, system-wide text entry is an input method — a keyboard the operating system installs — not an accessibility overlay. DexDictate Android is therefore a separate implementation of the same intent, informed by the macOS product's behaviour but sharing none of its mechanism.",
      "deep": [
        "The macOS approach and the Android approach have almost nothing in common at the system level. Only the product behaviour transfers.",
        "Implementing as an input method means the application must also be a competent keyboard, which is a larger surface than dictation alone.",
        "Local recognition remains the requirement, which constrains model size more tightly on a phone than on a laptop."
      ],
      "capabilities": [
        "Android input method",
        "Local dictation",
        "System-wide text entry"
      ],
      "lesson": "Cross-platform products share intent, not implementation; treating the second platform as a port hides the real work.",
      "repos": [
        "westkitty/DexDictate_Android"
      ]
    },
    {
      "id": "P023",
      "name": "DexTilt",
      "family": "Dex / device-bridge tools",
      "kind": "Device bridge",
      "status": "Experimental",
      "period": "2026",
      "summary": "Turning a phone's motion into authenticated commands on a desktop machine.",
      "brief": "DexTilt pairs an Android phone with a Mac receiver and converts physical gestures — tilt, rotation, motion — into commands from a fixed allowlist. Pairing happens by QR code, gestures are trained rather than hardcoded, and manual controls exist for everything the motion path can do.",
      "deep": [
        "The allowlist is the security model. A motion event cannot invoke an arbitrary command; it can only select from commands the user has explicitly enabled.",
        "Gesture training exists because motion signatures vary enormously between people and between grips. A fixed threshold works for whoever tuned it and nobody else.",
        "Every gesture has a manual equivalent, so the novel input never becomes the only input."
      ],
      "capabilities": [
        "Phone-to-desktop bridge",
        "Motion gesture recognition",
        "QR pairing",
        "Command allowlist",
        "Gesture training",
        "Manual fallback"
      ],
      "lesson": "A novel input method needs a boring fallback, or it becomes a novelty that gets uninstalled.",
      "repos": [
        "westkitty/DexTilt"
      ]
    },
    {
      "id": "P024",
      "name": "DexCleaner",
      "family": "Dex / macOS utilities",
      "kind": "macOS utility",
      "status": "Active",
      "period": "2026",
      "summary": "A disk cleanup tool built around reversibility and approval rather than automatic deletion.",
      "brief": "DexCleaner audits disk usage and proposes cleanups. Nothing is removed without explicit approval and the design favours reversible operations, because the category of tool it belongs to has a long history of deleting things people wanted.",
      "deep": [
        "Automatic cleanup is the default in this product category and it is the reason the category is distrusted.",
        "Auditing is separated from acting: the tool is useful purely as an explanation of where space went, without removing anything.",
        "Reversibility constrains what the tool is willing to offer. Some cleanups are simply not proposed because they cannot be undone."
      ],
      "capabilities": [
        "Disk usage audit",
        "Approval-gated cleanup",
        "Reversible operations",
        "SwiftUI interface"
      ],
      "lesson": "In destructive tooling, the features you decline to build are as much a part of the design as the ones you ship.",
      "repos": [
        "westkitty/DexCleaner_MacOS"
      ]
    },
    {
      "id": "P025",
      "name": "DexAid",
      "family": "Dex / civic-support tools",
      "kind": "Casefile application",
      "status": "Active",
      "period": "2026",
      "summary": "A local casefile tool for navigating institutions during an emergency, built around chronology and evidence.",
      "brief": "DexAid helps a person in a stabilisation crisis — housing, benefits, utilities, medical administration, banking, insurance — assemble what institutions actually require: an accurate chronology, the evidence supporting it, and a defensible next action. Everything stays on the user's machine.",
      "deep": [
        "Institutional processes fail people who cannot produce a timeline. The chronology is not a convenience feature; it is the thing being requested.",
        "Evidence is attached to events rather than filed separately, so a claim and its proof stay together.",
        "Next actions are derived from the state of the casefile instead of a generic checklist, because the correct next step depends on what has already been established.",
        "Local-only storage is a requirement of the subject matter. This material cannot be handled any other way."
      ],
      "capabilities": [
        "Chronology construction",
        "Evidence attachment",
        "Next-action derivation",
        "Multi-domain casefiles",
        "Local-only storage"
      ],
      "lesson": "Software for a crisis has to produce the artifact the institution asks for, not a better internal representation of the problem.",
      "repos": [
        "westkitty/DexAid"
      ]
    },
    {
      "id": "P026",
      "name": "DexCraft",
      "family": "Dex / prompt systems",
      "kind": "macOS menu-bar application",
      "status": "Paused",
      "period": "2026",
      "summary": "A menu-bar tool that rewrites rough text into a structured prompt shaped for a specific target.",
      "brief": "DexCraft takes an unstructured idea and produces a prompt formatted for a particular destination — a chat assistant, a research tool, an agentic development environment — because these targets reward genuinely different structures. It runs offline and lives in the menu bar so it is available mid-task.",
      "deep": [
        "The transformation is target-specific by design. A prompt that works well in a research tool is usually badly shaped for an agentic coding environment.",
        "Running offline was a requirement: the input is often half-formed thinking that should not be sent anywhere.",
        "Menu-bar placement matters because the tool is only useful at the moment the rough text exists."
      ],
      "capabilities": [
        "Target-specific prompt shaping",
        "Offline operation",
        "Menu-bar availability",
        "Multiple output profiles"
      ],
      "lesson": "Prompt structure is target-dependent; a universal prompt formatter is a formatter for nothing in particular.",
      "repos": [
        "westkitty/DexCraft"
      ]
    },
    {
      "id": "P027",
      "name": "DexEarth",
      "family": "Dex / geospatial systems",
      "kind": "Geospatial application",
      "status": "Active; mature prototype",
      "period": "2026",
      "summary": "A tactical globe that layers flights, satellites, earthquakes, fires, cables and tectonics into one view.",
      "brief": "DexEarth is a CesiumJS and React globe that composes many independent geospatial feeds into a single navigable surface, then looks for correlations between them. It supports simulations, alerts, derived threat indices and several render styles.",
      "deep": [
        "The value is in composition. Any one of these layers exists elsewhere; seeing undersea cables, tectonic boundaries and current events on the same globe is what produces questions.",
        "Correlation is offered as a prompt for investigation, not as a conclusion — proximity on a map is not causation.",
        "Multiple render styles exist because the same data reads completely differently as a realistic globe versus an abstract tactical display."
      ],
      "capabilities": [
        "Multi-layer geospatial composition",
        "Flights, satellites, seismic, fire, cable and tectonic layers",
        "Correlation surfacing",
        "Alerts and indices",
        "Multiple render styles"
      ],
      "lesson": "Combining ordinary data layers produces genuinely new questions; the composition is the contribution.",
      "repos": [
        "westkitty/DexEarth"
      ]
    },
    {
      "id": "P028",
      "name": "DexGen",
      "family": "Dex / image systems",
      "kind": "Hosted inference service",
      "status": "Experimental",
      "period": "2026",
      "summary": "Image generation on borrowed hardware, with results persisted somewhere they will survive the session.",
      "brief": "DexGen runs image generation on hosted notebook infrastructure, exposes it through a key-protected inference API, persists generated files to durable storage, and reaches the outside through a temporary tunnel. It is the pragmatic answer to needing a GPU that the local machines do not have.",
      "deep": [
        "Ephemeral compute loses everything when the session ends, so persistence to durable storage is the feature that makes the service usable rather than a demo.",
        "The API key exists because a temporary public tunnel is genuinely public for as long as it is open.",
        "It is explicitly a stopgap. Most of the local AI work in this museum exists to avoid needing an arrangement like this."
      ],
      "capabilities": [
        "Hosted GPU inference",
        "Key-protected API",
        "Durable output persistence",
        "Temporary public tunnel"
      ],
      "lesson": "Ephemeral compute is only useful once you have solved where the output goes.",
      "repos": [
        "westkitty/DexGen"
      ]
    },
    {
      "id": "P029",
      "name": "DexEnhance",
      "family": "Dex / browser tools",
      "kind": "Browser extension",
      "status": "Paused",
      "period": "2026",
      "summary": "A browser extension that improves AI chat interfaces without touching the pages it sits on.",
      "brief": "DexEnhance adds workflow improvements to ChatGPT and Gemini from inside the browser. Its interface renders in Shadow DOM so it cannot collide with the host page's styles, and its storage is local-first so nothing it records leaves the browser.",
      "deep": [
        "Shadow DOM isolation is what makes an extension survive the host site redesigning itself, which these sites do frequently.",
        "Manifest V3 constrains what an extension may do at runtime, and the architecture is shaped by those limits rather than fighting them.",
        "Local-first storage means the extension has no server and therefore no account, no outage and no data-handling policy to trust."
      ],
      "capabilities": [
        "Manifest V3 extension",
        "Shadow DOM isolation",
        "Local-first storage",
        "Multi-site support"
      ],
      "lesson": "An extension that styles itself inside the host page is a maintenance contract with someone else's redesign schedule.",
      "repos": [
        "westkitty/DexEnhance"
      ]
    },
    {
      "id": "P030",
      "name": "DexDraw",
      "family": "Dex / creative tools",
      "kind": "Collaborative whiteboard",
      "status": "Active; multi-generation lineage",
      "period": "2026",
      "summary": "A collaborative drawing surface rebuilt several times, each generation keeping less of the last.",
      "brief": "DexDraw is a shared whiteboard and drawing application with an unusually visible lineage: an original, a redux, and a vNext redesign, each a substantial rewrite rather than an iteration. The lineage itself is instructive about how collaborative-editing requirements reshape an architecture.",
      "deep": [
        "Collaborative editing is not a feature that can be added late. Each generation discovered this at a different depth.",
        "The rewrites were not failures of execution; they were the cost of learning what the synchronisation model had to be.",
        "Multiple repository generations remain, which makes the evolution inspectable rather than merely remembered."
      ],
      "capabilities": [
        "Collaborative drawing",
        "Shared canvas",
        "Multiple architectural generations"
      ],
      "lesson": "Some requirements cannot be retrofitted; you find out by trying, and the attempt is the education.",
      "repos": [
        "westkitty/dexDraw",
        "westkitty/DexDraw_Redux",
        "westkitty/DexDraw_vNext"
      ]
    },
    {
      "id": "P031",
      "name": "Dexterpreter",
      "family": "Dex / language tools",
      "kind": "Translation application",
      "status": "Active; release exists",
      "period": "2026",
      "summary": "Spanish speech transcription and English translation running entirely in the browser, offline.",
      "brief": "Dexterpreter listens to Spanish speech, transcribes it and translates it into English with models that run in the browser through Transformers.js. Nothing is sent to a service, which makes it usable in exactly the situations — medical, legal, institutional — where a cloud translator is inappropriate.",
      "deep": [
        "In-browser model execution keeps a conversation private without requiring the user to install anything or trust an operator.",
        "Wrapping the web application with Capacitor produces a mobile build from the same code, which matters because the situations that need it are mobile ones.",
        "Model size is the binding constraint, and the accuracy tradeoff was accepted deliberately in exchange for the privacy guarantee."
      ],
      "capabilities": [
        "Offline speech transcription",
        "In-browser translation",
        "Transformers.js inference",
        "Capacitor mobile build"
      ],
      "lesson": "For sensitive conversations, an offline translator that is somewhat less accurate is the more useful tool.",
      "repos": [
        "westkitty/spanish_translator"
      ]
    },
    {
      "id": "P032",
      "name": "DexSort",
      "family": "Dex / Android tools",
      "kind": "Android application",
      "status": "Active build",
      "period": "2026",
      "summary": "Image sorting where the device stays the archive and nothing is uploaded or destroyed.",
      "brief": "DexSort organises a large image collection on an Android tablet under two hard rules: the tablet remains the authoritative archive, and no operation may destroy an original or send it to a cloud service. Sorting is therefore organisational, never lossy.",
      "deep": [
        "Treating the device as the archive rather than as a cache inverts the usual assumption and removes any dependency on an account.",
        "Prohibiting destructive operations means duplicates are marked rather than removed, and the user decides what happens next.",
        "The constraints came first and the feature set was derived from them, which is why the application is small."
      ],
      "capabilities": [
        "On-device image sorting",
        "Non-destructive operations",
        "No cloud dependency",
        "Device-as-archive model"
      ],
      "lesson": "Stating the prohibitions before the features produces a smaller and more trustworthy application.",
      "repos": [
        "westkitty/DexSort",
        "westkitty/DexSort_App"
      ]
    },
    {
      "id": "P033",
      "name": "DexSpeak",
      "family": "Dex / voice tools",
      "kind": "macOS application",
      "status": "Paused; legacy reference",
      "period": "2026",
      "summary": "A macOS text-to-speech application with multiple synthesis backends behind one interface.",
      "brief": "DexSpeak reads text aloud using whichever synthesis engine suits the request — system voices for speed, neural backends for quality, custom voices where they exist. The provider architecture that hides this choice from the interface is its most durable contribution.",
      "deep": [
        "Synthesis engines differ wildly in latency, quality and installation cost. A provider abstraction lets the application choose per request instead of committing to one.",
        "It began as a monorepo containing several engines, which made the provider boundary explicit and the repository large.",
        "It is paused and held as the authoritative reference implementation — a later experiment forked its interface specifically so that DexSpeak itself would remain unmodified."
      ],
      "capabilities": [
        "Multi-provider synthesis",
        "System and neural voices",
        "Custom voice support",
        "Provider abstraction"
      ],
      "lesson": "When several engines do the same job badly in different ways, the abstraction over them is the actual product.",
      "repos": [
        "westkitty/DexSpeak"
      ]
    },
    {
      "id": "P034",
      "name": "DexTalk",
      "family": "Dex / voice tools",
      "kind": "Voice-cloning lab",
      "status": "Paused; runtime uncertain",
      "period": "2026",
      "summary": "A voice-cloning workbench forked from DexSpeak's interface so the original could stay untouched.",
      "brief": "DexTalk is a local Python and Gradio laboratory for voice cloning. It deliberately reimplements the DexSpeak interface rather than extending it, so that experimental work could proceed without putting a working application at risk.",
      "deep": [
        "Forking to protect the original is an unfashionable choice that was correct here: the experimental branch went through several unusable states.",
        "Gradio was chosen because the value was in the experiments, not in the interface, and building a native surface would have delayed both.",
        "Its runtime state is uncertain, which is honest for a research fork that served its purpose."
      ],
      "capabilities": [
        "Voice cloning",
        "Local inference",
        "Gradio workbench",
        "Independent of DexSpeak"
      ],
      "lesson": "Forking a working tool to run experiments costs a little duplication and saves the working tool.",
      "repos": [
        "westkitty/dextalk",
        "westkitty/DexTalker"
      ]
    },
    {
      "id": "P035",
      "name": "DexKeeper Bot",
      "family": "Dex / community tools",
      "kind": "Moderation bot",
      "status": "Active",
      "period": "2026",
      "summary": "A single-community moderation bot that installs like a normal application and stores everything locally.",
      "brief": "DexKeeper moderates one community. It polls rather than requiring an inbound webhook, keeps its state in a local database, and installs natively on Windows, macOS and Linux without a container runtime — decisions that make it deployable by someone who runs a community rather than a server.",
      "deep": [
        "Polling instead of webhooks removes the requirement for a public address, which is the single biggest obstacle to self-hosting for non-technical operators.",
        "Scoping to one community removed multi-tenancy, permissions hierarchies and configuration surface that would have dominated the codebase.",
        "Choosing native installation over containers was a deliberate accessibility decision, not a technical preference."
      ],
      "capabilities": [
        "Polling transport",
        "Local database",
        "Native cross-platform install",
        "Optional tray controls",
        "Single-community scope"
      ],
      "lesson": "Self-hosted software fails at installation far more often than at runtime.",
      "repos": [
        "westkitty/DexKeeper_Bot"
      ]
    },
    {
      "id": "P036",
      "name": "BigMac Voice Tools",
      "family": "Dex / local AI infrastructure",
      "kind": "Remote inference client",
      "status": "Active / experimental",
      "period": "2026",
      "summary": "A laptop control surface for voice models that run on a much larger machine elsewhere on the network.",
      "brief": "Voice synthesis and cloning are expensive. BigMac Voice Tools keeps the models on a dedicated machine and gives the laptop a control interface and a transfer path, so the light device drives the work without attempting to do it.",
      "deep": [
        "The split is deliberate: interface and file handling on the portable machine, inference on the machine with the hardware for it.",
        "Transfer over the local network rather than the internet keeps audio material private and latency predictable.",
        "This client is one instance of a pattern that recurs across the infrastructure work in this museum — the laptop is a terminal, not a workstation."
      ],
      "capabilities": [
        "Remote inference control",
        "Local-network transfer",
        "Voice cloning workflow",
        "Thin client design"
      ],
      "lesson": "Deciding which machine does the work is an architecture decision, not a deployment detail.",
      "repos": [
        "westkitty/BigMac_Voice_Tools"
      ]
    },
    {
      "id": "P037",
      "name": "WESTCAT Overlay",
      "family": "WestCat",
      "kind": "Desktop overlay family",
      "status": "Active lineage; fragmented",
      "period": "2025–2026",
      "summary": "A long-running family of translucent always-on-top desktop overlays for live production.",
      "brief": "The WESTCAT overlays are broadcast-facing desktop windows: translucent, always on top, click-through when needed, with persistent settings, polling, player controls and a cat-and-speech-bubble presentation. The family spans many repositories because each production need produced another variant.",
      "deep": [
        "Click-through mode is the feature that makes an always-on-top overlay usable — without it the overlay becomes an obstacle the moment it is not being read.",
        "Producer-safe controls exist because these run during live output, where an accidental interaction is visible to an audience.",
        "The fragmentation across repositories is genuine and is recorded rather than tidied away; it is what a tool looks like when it is shaped by recurring live deadlines."
      ],
      "capabilities": [
        "Translucent always-on-top windows",
        "Click-through mode",
        "Persistent settings",
        "Polling display",
        "Player controls",
        "Producer-safe controls"
      ],
      "lesson": "Tools built under live production deadlines fragment into variants, because there is never a moment to consolidate them.",
      "repos": [
        "westkitty/WESTCAT-OVERLAY-RELOADED",
        "westkitty/westcat_overlay",
        "westkitty/westcat-polling-overlay"
      ]
    },
    {
      "id": "P038",
      "name": "WestCat Goes East",
      "family": "WestCat / games",
      "kind": "Browser platformer",
      "status": "Active concept",
      "period": "2026",
      "summary": "A 16-bit-styled platformer set in a real place, with a generated asset pipeline behind it.",
      "brief": "WestCat Goes East is an HTML5 Canvas platformer in the visual idiom of the 16-bit era, set around a recognisable stretch of Vancouver Island and starring the WestCat characters. A substantial generated asset-pack workflow supplies its sprites and tiles.",
      "deep": [
        "Setting a platformer in a real place changes level design: the layout is constrained by geography that already exists.",
        "The asset pipeline was the larger engineering effort. Generating a coherent sprite set that reads as one artist's work is harder than generating any single sprite.",
        "The playable code and the asset pipeline are integrated in concept and not yet fully joined in implementation."
      ],
      "capabilities": [
        "HTML5 Canvas platformer",
        "16-bit visual idiom",
        "Real-geography levels",
        "Generated asset pipeline"
      ],
      "lesson": "In a generated-art project the consistency pipeline is the project; individual assets are the easy part.",
      "repos": []
    },
    {
      "id": "P039",
      "name": "The Full Weasel",
      "family": "Dexter / games",
      "kind": "Browser game",
      "status": "Completed; playable",
      "period": "2026",
      "summary": "A finished birthday rhythm game in which Dexter catches treats and dodges sharks.",
      "brief": "The Full Weasel is a mobile-first rhythm game made as a birthday gift. Dexter catches falling treats in time with the music, avoids sharks, fills a party meter and reaches an escalating celebratory finale. It is small, complete and playable — which makes it rare in this collection.",
      "deep": [
        "It is finished. Among sixty-four projects, a completed and shipped artifact is worth marking.",
        "The scope was fixed by the occasion, and the deadline did what deadlines do: it prevented the project from growing.",
        "Dexter appears here as a character in a game he was made for. The Sanctuary elsewhere in this building is a different kind of space, and the distinction is deliberate."
      ],
      "capabilities": [
        "Rhythm gameplay",
        "Mobile-first PWA",
        "Party meter progression",
        "Escalating finale"
      ],
      "lesson": "A hard external deadline is the most reliable scope-control mechanism there is.",
      "repos": [
        "westkitty/The_Full_Weasel"
      ]
    },
    {
      "id": "P040",
      "name": "Big Mac Westcat SSH",
      "family": "Local AI / BigMac",
      "kind": "Access architecture",
      "status": "Active; validated",
      "period": "2026",
      "summary": "The governed access route between a laptop and the machine that does the heavy work.",
      "brief": "This project is the access layer of the local AI infrastructure: a single canonical, key-authenticated route from the portable machine to the compute host's service account, with explicit boundaries about what that account may do. It is small, unglamorous, and everything else in this wing depends on it.",
      "deep": [
        "Having exactly one canonical route is the point. Multiple ad-hoc access paths accumulate until nobody can say what is reachable from where.",
        "The service account is deliberately scoped: the access route is not an administrative account and does not become one for convenience.",
        "This exhibit uses synthetic example hostnames and identifiers throughout. No real address, key, credential or operational configuration appears anywhere in this museum.",
        "It has no repository of its own; it is documented in the durable project record instead."
      ],
      "capabilities": [
        "Key-authenticated access",
        "Scoped service account",
        "Single canonical route",
        "Documented boundaries"
      ],
      "lesson": "Infrastructure that is not written down becomes infrastructure nobody is willing to change.",
      "repos": []
    },
    {
      "id": "P041",
      "name": "BigMac Storage and SMB",
      "family": "Local AI / BigMac",
      "kind": "Storage architecture",
      "status": "Active",
      "period": "2026",
      "summary": "Large local volumes shared across a private network and deliberately never exposed to the internet.",
      "brief": "Directly attached storage on the compute host is shared over the local network and a private mesh network to a small number of known devices. The defining constraint is negative: this storage has no public route, no cloud tier and no external synchronisation.",
      "deep": [
        "Directly attached storage was chosen over network-attached appliances because the machine that needs the data at full speed is the machine it is attached to.",
        "A private mesh network extends reach to known devices without opening anything to the public internet.",
        "The absence of a cloud tier is a design decision. Model weights, media libraries and working data are large and private, and both properties argue against synchronisation.",
        "Volume names, addresses and share identifiers shown in this museum are synthetic examples."
      ],
      "capabilities": [
        "Directly attached volumes",
        "Local network file sharing",
        "Private mesh access",
        "No public exposure",
        "No cloud tier"
      ],
      "lesson": "For large private data, the cheapest security control is having no public route at all.",
      "repos": []
    },
    {
      "id": "P042",
      "name": "BigMac Ollama + Codex Integration",
      "family": "Local AI / BigMac",
      "kind": "Inference integration",
      "status": "Active; validated",
      "period": "2026",
      "summary": "A development tool on the laptop using models that are actually running on another machine.",
      "brief": "This integration lets a coding assistant on the portable machine call a local model server on the compute host through an encrypted tunnel, using a dedicated provider profile and launcher configuration. To the tool, the model is local. To the network, nothing is exposed.",
      "deep": [
        "The tunnel makes a remote service appear at a local address, which is what allows tools with no concept of remote inference to use it.",
        "A dedicated provider profile keeps this configuration separate from any hosted-service configuration, so the two cannot be confused at runtime.",
        "The arrangement means model inference costs nothing per token and leaves no request logs anywhere outside the household."
      ],
      "capabilities": [
        "Encrypted tunnel",
        "Local model server",
        "Provider profile configuration",
        "Launcher integration"
      ],
      "lesson": "A tunnel that makes a remote service look local is often simpler than teaching a tool that remote services exist.",
      "repos": []
    },
    {
      "id": "P043",
      "name": "Hermes Agent/Desktop + BigMac",
      "family": "Local AI / BigMac",
      "kind": "Agent control surface",
      "status": "Active; validated",
      "period": "2026",
      "summary": "A desktop control surface for an agent gateway whose engine lives on the compute host.",
      "brief": "Hermes provides an agent gateway and interface; the arrangement here keeps that interface on the laptop and its inference engine on the compute host, connected by a tunnel. It is the same split the rest of this wing uses — control here, computation there.",
      "deep": [
        "Running the interface locally keeps it responsive regardless of what the model is doing.",
        "The compute host remains the single engine, so there is one place where models live and one place to manage them.",
        "This is an integration of existing upstream software rather than an original application, and it is recorded as such."
      ],
      "capabilities": [
        "Desktop control surface",
        "Agent gateway",
        "Tunnelled backend",
        "Single engine host"
      ],
      "lesson": "Separating control surface from compute lets each run where it is actually good.",
      "repos": []
    },
    {
      "id": "P044",
      "name": "Big Mac FaceTools",
      "family": "Local AI / BigMac",
      "kind": "Face-processing stack",
      "status": "Active; validation partially pending",
      "period": "2026",
      "summary": "A face-processing stack kept entirely on one machine, with no network path off it.",
      "brief": "FaceTools runs face detection, analysis and transformation locally on the compute host, controlled from the laptop. Models and data live on external roots outside the application, and the stack has no outbound network path — a boundary chosen because of what the data is.",
      "deep": [
        "Face data is biometric. The local-only boundary is a requirement of the subject matter rather than a performance choice.",
        "Keeping model and data roots outside the application directory means the stack can be rebuilt or replaced without touching either.",
        "Any demonstration of this work uses synthetic generated faces. No real person's likeness appears in this museum."
      ],
      "capabilities": [
        "Local face processing",
        "External model and data roots",
        "No outbound network path",
        "Remote control workflow"
      ],
      "lesson": "Some data categories decide the architecture before any engineering discussion starts.",
      "repos": []
    },
    {
      "id": "P045",
      "name": "Large Language Launcher",
      "family": "Local AI / BigMac",
      "kind": "macOS launcher",
      "status": "Active; multiple variants",
      "period": "2026",
      "summary": "A launcher that turns a scattered collection of local AI tools into a single card-based menu.",
      "brief": "Local AI tooling accumulates as a heap of scripts, environments and start commands. The Large Language Launcher presents them as a manifest-backed set of cards, each knowing how to start its own tool, so the collection becomes navigable instead of remembered.",
      "deep": [
        "The manifest is the design: adding a tool means adding a record, not writing launcher code.",
        "Cards carry enough description that a tool unused for months can be identified without opening it.",
        "Several variants exist, including a lighter scripted version, because the launcher is a personal-infrastructure tool and personal infrastructure forks easily."
      ],
      "capabilities": [
        "Manifest-backed tool registry",
        "Card interface",
        "Multi-tool launching",
        "Lightweight variants"
      ],
      "lesson": "Personal infrastructure needs a table of contents before it needs more features.",
      "repos": [
        "westkitty/Large_Language_Launcher"
      ]
    },
    {
      "id": "P046",
      "name": "Project Forge",
      "family": "Continuity infrastructure",
      "kind": "Progress application",
      "status": "Experimental; canonical implementation uncertain",
      "period": "2026",
      "summary": "A progress tracker for long-horizon work, built around lifecycle stages rather than task lists.",
      "brief": "Project Forge tracks creative, business, software and experimental work over years rather than sprints. It models lifecycle stages, recurring rituals, releases and capture, with progression mechanics layered on top. An artifact was built; which build is canonical was never firmly established.",
      "deep": [
        "Long-horizon projects fail differently from short ones — they stall silently — so the tool tracks stage transitions rather than task completion.",
        "Rituals are recurring commitments rather than tasks: the things that keep a project from going quiet.",
        "The project's own uncertain canonical state is an honest illustration of the problem it was built to solve."
      ],
      "capabilities": [
        "Lifecycle tracking",
        "Rituals",
        "Releases",
        "Capture and export",
        "Progression mechanics"
      ],
      "lesson": "A tool for tracking long projects has to survive the same neglect it is designed to detect.",
      "repos": [
        "westkitty/Project_Forge"
      ]
    },
    {
      "id": "P047",
      "name": "WorldsVault Uplink",
      "family": "Museum / archive / canon systems",
      "kind": "Research architecture",
      "status": "Superseded; retained as research archive",
      "period": "2026",
      "summary": "The first and most ambitious attempt at a worldbuilding and canon-management platform.",
      "brief": "Uplink was the research phase: a broad architecture study for a platform that would hold canon, relationships, technology reports and product structure in one system. It produced substantial architecture and technology analysis and very little running software, and it was superseded rather than abandoned.",
      "deep": [
        "The scope was platform-shaped from the start — services, syncing, multi-user structure — which is why it produced reports faster than it produced a usable tool.",
        "Its research is genuinely reusable. The successor projects inherited its data model thinking while discarding its delivery assumptions.",
        "It is preserved as a research archive because the reasoning is the artifact."
      ],
      "capabilities": [
        "Platform architecture research",
        "Technology and product reports",
        "Canon data-model exploration"
      ],
      "lesson": "Architecture research is not wasted when the architecture is rejected — but it is wasted if nothing is ever narrowed.",
      "repos": []
    },
    {
      "id": "P048",
      "name": "CanonForge",
      "family": "Museum / archive / canon systems",
      "kind": "Local-first canon OS",
      "status": "Superseded; absorbed into WorldsVault",
      "period": "2026",
      "summary": "The narrowing: a Markdown vault, a Python CLI, schemas, validation and transfer packets.",
      "brief": "CanonForge cut the platform ambition down to something that could run on one machine. Canon lives as Markdown, structure lives in schemas, correctness is enforced by validation, and knowledge moves between contexts as explicit transfer packets. A later interface layer was considered but the command line remained the honest surface.",
      "deep": [
        "Choosing Markdown as the storage format was the decision that made the project survivable. Files remain readable and diffable without the tool.",
        "Validation and indexes did the work a database would have done, without requiring one to exist.",
        "Transfer packets are the concept that outlived the project: a bounded, self-describing bundle of canon meant to be handed to another context."
      ],
      "capabilities": [
        "Markdown canon vault",
        "Python CLI",
        "Schemas and validation",
        "Indexes",
        "Transfer packets",
        "Export"
      ],
      "lesson": "Narrowing an ambitious system to one machine and plain files is usually the step that makes it real.",
      "repos": []
    },
    {
      "id": "P049",
      "name": "WorldsVault",
      "family": "Museum / archive / canon systems",
      "kind": "Local-first knowledge system",
      "status": "Active; local repository",
      "period": "2026",
      "summary": "The surviving form: an Obsidian and Git vault for canon, workflows and technical knowledge, with local retrieval.",
      "brief": "WorldsVault is what the lineage settled into. Canon, workflow notes and technical knowledge live in an Obsidian vault under Git, retrieval runs locally against local models, and handoffs to other tools are explicit artifacts. It kept CanonForge's file-first discipline and dropped the requirement to build a bespoke application around it.",
      "deep": [
        "Using an existing editor instead of building one removed the entire interface-maintenance burden that had stalled its predecessors.",
        "Git supplies versioning, history and branching without a custom revision model.",
        "Local retrieval means the vault can be queried without sending its contents anywhere, which is a requirement rather than a preference for private canon.",
        "The lineage — Uplink, CanonForge, WorldsVault — is the clearest example in this collection of a project improving by losing features."
      ],
      "capabilities": [
        "Obsidian vault",
        "Git versioning",
        "Local retrieval",
        "AI handoff artifacts",
        "Workflow and technical knowledge capture"
      ],
      "lesson": "Three generations of the same idea, each smaller than the last, and the smallest one is the one still running.",
      "repos": []
    },
    {
      "id": "P050",
      "name": "OSINT Box",
      "family": "OSINT / research systems",
      "kind": "Research platform",
      "status": "Active",
      "period": "2026",
      "summary": "An open-source research platform that runs locally, so investigations leave no trail with a service provider.",
      "brief": "OSINT Box is a fully local research platform: a Python service, a tactical web interface, a native wrapper, case and result storage, local model integration, streaming jobs and a set of research tools. Running locally means the investigation itself is not disclosed to any third party.",
      "deep": [
        "Hosted research tools log queries. For any sensitive investigation the query set is itself revealing, which is the argument for local operation.",
        "Cases, results and logs are stored locally and structured, so an investigation can be resumed rather than repeated.",
        "Local model integration allows summarisation and extraction without sending source material anywhere.",
        "This museum demonstrates the platform with an entirely fictional investigation. No real case data, target or record appears here."
      ],
      "capabilities": [
        "Local research service",
        "Tactical web interface",
        "Case and result storage",
        "Local model integration",
        "Streaming jobs",
        "Multiple research tools"
      ],
      "lesson": "For research tooling, where the query is logged matters as much as what the tool can find.",
      "repos": [
        "westkitty/OSINT_Box"
      ]
    },
    {
      "id": "P051",
      "name": "Against the Void",
      "family": "Games",
      "kind": "Godot game",
      "status": "Active; packaged",
      "period": "2026",
      "summary": "A station survival and defence game built in Godot, with unusually heavy interface work.",
      "brief": "Against the Void combines survival, management and defence aboard a station under threat. Most of its engineering went into interface and interaction — a management game is almost entirely interface — alongside packaging and repeated systematic bug sweeps.",
      "deep": [
        "Management games live or die on information density: the player must see threat, resource state and options simultaneously without the screen becoming noise.",
        "The repeated bug-sweep passes are recorded as part of the project's history because they were a substantial share of the actual work.",
        "It is packaged; its runtime behaviour was not verified in the environment where this record was assembled, and that distinction is preserved rather than smoothed over."
      ],
      "capabilities": [
        "Station survival systems",
        "Resource management",
        "Defence gameplay",
        "Extensive interface work",
        "Packaging"
      ],
      "lesson": "In management games the interface is not the presentation layer; it is the game.",
      "repos": []
    },
    {
      "id": "P052",
      "name": "Arkship Civilization",
      "family": "Games / simulations",
      "kind": "Simulation game",
      "status": "Active foundation; preproduction",
      "period": "2026",
      "summary": "A civilization-scale generation-ship project, scoped down to one falsifiable prototype.",
      "brief": "Arkship Civilization is a generation-ship simulation whose entire preproduction is organised around a single prototype called The Descent Decision — ninety to a hundred and twenty minutes long, built to answer whether the core idea is actually interesting before anything larger is committed.",
      "deep": [
        "The prototype is designed to be falsifiable. It can return a negative answer, and it is scoped so that a negative answer is affordable.",
        "The ship's structure — command, habitation, logistics, energy, propulsion — is the simulation's skeleton, and each module carries distinct failure behaviour.",
        "Choosing one decision as the prototype's subject, rather than a vertical slice of everything, is what keeps the test honest."
      ],
      "capabilities": [
        "Generation-ship simulation",
        "Modular ship systems",
        "Falsification prototype",
        "Long-form single-decision scenario"
      ],
      "lesson": "A prototype that cannot fail is not a prototype; it is a demo.",
      "repos": [
        "westkitty/Arkship"
      ]
    },
    {
      "id": "P053",
      "name": "AetherVFX",
      "family": "Three.js / creative tools",
      "kind": "Browser workbench",
      "status": "Active foundation",
      "period": "2026",
      "summary": "A browser workbench for building procedural visual effects with live parameter control.",
      "brief": "AetherVFX is a Three.js environment for authoring ability and procedural effects: emitters, forces, lifetimes, turbulence and colour behaviour are exposed as live controls so an effect is shaped by watching it rather than by editing and reloading.",
      "deep": [
        "Immediate feedback is the whole point. Visual effects are tuned by eye, and any delay between change and result degrades the result.",
        "Source validation and project-health tooling were built alongside the effects work, because a workbench that breaks silently is worse than no workbench.",
        "It shares its rendering foundation with this museum — the same library, the same disposal discipline, the same performance concerns."
      ],
      "capabilities": [
        "Procedural particle systems",
        "Live parameter control",
        "Multiple authoring modes",
        "Source validation",
        "Performance tooling"
      ],
      "lesson": "Any authoring tool for something judged by eye must close the feedback loop to zero.",
      "repos": [
        "westkitty/3js-VFX-platform"
      ]
    },
    {
      "id": "P054",
      "name": "Parable",
      "family": "Games",
      "kind": "Browser god-game",
      "status": "Active",
      "period": "2026",
      "summary": "A gesture-first god-game where miracles are drawn rather than selected from a menu.",
      "brief": "Parable is a browser god-game in which the player's input is gesture: miracles are performed by drawing them, and the simulation responds. The core loop centres on a single well-developed miracle rather than a broad ability list, and ritual interactions build on top of it.",
      "deep": [
        "Gesture input makes the act of performing a miracle feel like an act rather than a selection, which is the entire reason the genre exists.",
        "Developing one miracle deeply instead of many shallowly gave the simulation something to actually respond to.",
        "Ritual interactions — sequences that must be performed correctly — extend the gesture vocabulary without adding menus."
      ],
      "capabilities": [
        "Gesture recognition",
        "Miracle system",
        "Simulation response",
        "Ritual interactions"
      ],
      "lesson": "One deeply implemented verb produces more play than six shallow ones.",
      "repos": [
        "westkitty/Parable"
      ]
    },
    {
      "id": "P055",
      "name": "Starlight Acre",
      "family": "Games",
      "kind": "Godot game",
      "status": "Active; Phase 2 in progress",
      "period": "2026",
      "summary": "Farming in orbit, where the greenhouse is failing and every resource is a shared constraint.",
      "brief": "Starlight Acre is a Godot farming game set on an orbital station whose greenhouse is failing. Power, water and nutrients are shared, finite and interdependent, so growing mythic crops is a scheduling problem as much as a cultivation one, assisted by a gardener drone.",
      "deep": [
        "Coupling the resources is what distinguishes it from terrestrial farming games: watering costs power, and power is also keeping the station alive.",
        "Restoration rather than expansion gives the game a natural arc — the station starts broken and the player's progress is measured in systems brought back.",
        "The gardener drone is automation the player configures, which converts routine tending into a design decision."
      ],
      "capabilities": [
        "Orbital farming",
        "Coupled resource systems",
        "Station restoration arc",
        "Gardener drone automation",
        "Mythic crops"
      ],
      "lesson": "Coupling resources that players expect to be independent is a cheap way to create real decisions.",
      "repos": [
        "westkitty/starlight-acre"
      ]
    },
    {
      "id": "P056",
      "name": "S'mores Katamari",
      "family": "Games / Smudge",
      "kind": "Browser game",
      "status": "Active",
      "period": "2026",
      "summary": "A rolling collection game set in a compressed model of a real town, starring Smudge.",
      "brief": "S'mores Katamari is a Three.js game in the Katamari idiom: roll, collect, grow. Its playspace is a compressed version of a real Vancouver Island town, laid out with reference to actual map data, and it runs entirely offline once loaded.",
      "deep": [
        "Compressing a real town into a playable space is a design problem, not a data problem — real distances are boring at play speed and must be edited without losing recognisability.",
        "Map-derived layout guides kept the geography honest while the scale was compressed.",
        "The asset pipeline is large, and running fully offline at runtime was a hard requirement that shaped how assets were packaged."
      ],
      "capabilities": [
        "Rolling collection mechanic",
        "Progressive scale growth",
        "Real-geography playspace",
        "Offline runtime",
        "Developer camera tools"
      ],
      "lesson": "Real geography makes a good starting point and a bad final layout; the editing is the design work.",
      "repos": [
        "westkitty/S-mores-Katamari"
      ]
    },
    {
      "id": "P057",
      "name": "Endless Grok / Void Ascendancy",
      "family": "Games",
      "kind": "Browser 4X strategy",
      "status": "Active; playable",
      "period": "2026",
      "summary": "A complete browser 4X: deterministic galaxies, AI empires, research, diplomacy, crises and saves.",
      "brief": "Endless Grok is a playable 4X space strategy game running in the browser, with deterministic galaxy generation, multiple factions, AI empires, economy, research, diplomacy, combat, crisis events, save support and a long tail of enhancement work.",
      "deep": [
        "Deterministic generation means a galaxy can be reproduced from a seed, which makes balance testing possible and makes a specific game shareable.",
        "The AI empires needed to be legible rather than optimal — a player must be able to infer why an empire acted, or diplomacy becomes noise.",
        "Crises exist to interrupt the mid-game plateau that this genre reliably produces.",
        "It is among the most feature-complete games in this collection and it runs in a browser tab."
      ],
      "capabilities": [
        "Deterministic galaxy generation",
        "Faction and AI empires",
        "Economy and research",
        "Diplomacy",
        "Combat",
        "Crisis events",
        "Save system"
      ],
      "lesson": "Deterministic world generation is a testing feature first and a player feature second.",
      "repos": [
        "westkitty/EndlessGrok"
      ]
    },
    {
      "id": "P058",
      "name": "Guy_Cast",
      "family": "Applications / media",
      "kind": "Desktop and extension app",
      "status": "Superseded direction",
      "period": "2026",
      "summary": "The first generation: a desktop application plus browser extension for casting media.",
      "brief": "Guy_Cast spanned a Tauri desktop application, a web surface and a Chrome extension, all covering the same media-casting workflow. Supporting three delivery targets for one feature set proved to be the project's defining cost, and its successor chose a single native platform instead.",
      "deep": [
        "Three delivery surfaces meant three permission models, three update paths and three sets of platform bugs for one product.",
        "The extension surface was the most capable in practice and the most fragile to maintain.",
        "The project was superseded rather than fixed, and the decision to go native on one platform came directly from this experience."
      ],
      "capabilities": [
        "Tauri desktop client",
        "Web surface",
        "Chrome extension",
        "Media casting workflow"
      ],
      "lesson": "Shipping one feature to three platforms at once triples the maintenance before it doubles the audience.",
      "repos": [
        "westkitty/Guy_Cast"
      ]
    },
    {
      "id": "P059",
      "name": "Gay_Cast",
      "family": "Applications / media",
      "kind": "Android application",
      "status": "Active repair",
      "period": "2026",
      "summary": "The successor: one native Android application instead of three cross-platform surfaces.",
      "brief": "Gay_Cast rebuilt the casting workflow as a native Android application in Kotlin and Jetpack Compose. Dropping to a single platform removed the multi-surface maintenance cost that stalled its predecessor and let the feature set develop instead of merely being ported.",
      "deep": [
        "Native Android gave direct access to the platform's media and networking behaviour without an abstraction layer translating it.",
        "Jetpack Compose kept the interface work small enough that it was not the bottleneck.",
        "The project is under active repair rather than finished, which is normal for the generation that has to carry the real feature set."
      ],
      "capabilities": [
        "Native Android client",
        "Jetpack Compose interface",
        "Media casting",
        "Single-platform focus"
      ],
      "lesson": "The second generation is usually smaller in scope and larger in capability than the first.",
      "repos": [
        "westkitty/Gay_Cast"
      ]
    },
    {
      "id": "P060",
      "name": "He-Maker",
      "family": "Creative applications",
      "kind": "Recovered application",
      "status": "Active recovery",
      "period": "2026",
      "summary": "A creative application recovered from cloud storage and rebuilt into a durable repository.",
      "brief": "He-Maker existed as a folder in cloud storage before it existed as a project. Its recovery — reconstructing the source into a repository with a written project record — is the work that made it a project again rather than an archive of files.",
      "deep": [
        "Source that lives only in a sync folder has no history, no branches and no record of intent. Recovering it means reconstructing all three.",
        "The reconstruction produced a project record alongside the code, because the code alone did not explain what the application was for.",
        "It is included here as a working example of the archaeology this museum is built on."
      ],
      "capabilities": [
        "Source reconstruction",
        "Repository establishment",
        "Project record authoring"
      ],
      "lesson": "Files in a sync folder are a backup, not a project; the difference is history and stated intent.",
      "repos": [
        "westkitty/He-Maker"
      ]
    },
    {
      "id": "P061",
      "name": "SpaceWise",
      "family": "Android / privacy tools",
      "kind": "Android application",
      "status": "Active hardening",
      "period": "2026",
      "summary": "An Android storage explainer that refuses to overclaim what deleting something will do.",
      "brief": "SpaceWise makes device storage understandable — what is using space, why, and what would change if it were removed. It is deliberately built against the norms of its category: it does not promise recovered gigabytes, does not claim to make a device faster, and does not silently involve cloud storage.",
      "deep": [
        "Storage-cleaner applications routinely overstate results because the numbers are hard for users to verify. Refusing to do that is the product's entire position.",
        "Explaining is treated as more valuable than acting. A user who understands what a cache directory is will make better decisions than one who taps a button.",
        "Privacy-first here means the application does not need an account, a network connection, or access to file contents to do its job."
      ],
      "capabilities": [
        "Storage breakdown",
        "Plain-language explanation",
        "No overclaiming",
        "No cloud dependency",
        "Privacy-first design"
      ],
      "lesson": "In a category built on exaggeration, accuracy is a feature users can feel.",
      "repos": [
        "westkitty/SpaceWise",
        "westkitty/SpaceWise_Android"
      ]
    },
    {
      "id": "P062",
      "name": "Rhetorical InDEX",
      "family": "Research / media-literacy systems",
      "kind": "Analysis prototype",
      "status": "Completed prototype; next phase planned",
      "period": "2026",
      "summary": "An offline tool that separates a statement's evidence from its interpretation, framing and inference.",
      "brief": "Rhetorical InDEX takes a piece of writing apart into the moves it is making. A sentence can assert evidence, interpret evidence, frame a topic, draw an inference, or claim something with no support at all — and readers routinely fail to notice which is which. The prototype shipped as a single offline file with no network dependency.",
      "deep": [
        "Classification is applied to spans, not to documents. A single paragraph typically contains several categories, and that mixture is where persuasion happens.",
        "Running entirely offline as one file was a deliberate constraint: an analysis tool that phones home is a poor fit for analysing text you care about.",
        "The next planned phase, Instrument Alpha, was scoped but the shipped prototype stands as a complete artifact."
      ],
      "capabilities": [
        "Span classification",
        "Evidence / interpretation / framing / inference categories",
        "Unsupported-claim detection",
        "Single-file offline distribution"
      ],
      "lesson": "The useful question about a claim is rarely whether it is true; it is which kind of claim it is.",
      "repos": [
        "westkitty/Rhetorical_InDEX"
      ]
    },
    {
      "id": "P063",
      "name": "project_daemon / DAEMON",
      "family": "Local AI / experimental systems",
      "kind": "Persistent agent",
      "status": "Experimental",
      "period": "2026",
      "summary": "A persistent digital lifeform on a home network, with circadian behaviour, drift, and real permanent death.",
      "brief": "DAEMON runs continuously rather than being invoked. It has a soul file defining its identity, persistent memory in a local database and vector store, a circadian rhythm, behavioural drift over time, telemetry, hibernation, a sanctuary state — and genuine permadeath, with a graveyard for instances that have ended.",
      "deep": [
        "Persistence is the entire premise. A process that runs continuously and accumulates state behaves nothing like one that starts fresh each time.",
        "Drift is deliberate: the daemon's behaviour changes gradually as its memory accumulates, and it is not reset to a baseline.",
        "Permadeath is real and irreversible. It is the design choice that makes the system's continuity mean something, and it is the reason the graveyard exists.",
        "It is experimental and the most speculative project in this collection. It is included because the questions it asks are the ones the rest of the local AI work leads to."
      ],
      "capabilities": [
        "Continuous operation",
        "Soul file identity",
        "Persistent memory",
        "Circadian behaviour",
        "Behavioural drift",
        "Hibernation and sanctuary",
        "Permadeath and graveyard"
      ],
      "lesson": "Continuity only means something where ending is possible.",
      "repos": [
        "westkitty/project_daemon"
      ]
    },
    {
      "id": "P064",
      "name": "Media Getter",
      "family": "macOS utilities / media tools",
      "kind": "Desktop utility",
      "status": "Active; lineage split",
      "period": "2026",
      "summary": "A macOS utility that downloads, converts, trims and transcribes media using bundled command-line tools.",
      "brief": "Media Getter puts a native interface over a set of command-line media tools and bundles them so the application works without the user installing anything. Its lineage split when a separate reimplementation was attempted alongside the original.",
      "deep": [
        "Bundling the command-line tools rather than depending on the user's system removed the most common class of support problem this kind of utility has.",
        "Download, convert, trim and transcribe are a natural pipeline, and exposing them as one workflow rather than four features is what made the tool pleasant to use.",
        "The lineage split is documented rather than resolved: two implementations exist and neither was declared canonical."
      ],
      "capabilities": [
        "Media download",
        "Format conversion",
        "Trimming",
        "Transcription",
        "Bundled toolchain"
      ],
      "lesson": "A utility that wraps command-line tools should ship them; otherwise the wrapper inherits every installation problem it was meant to hide.",
      "repos": [
        "westkitty/media-getter",
        "westkitty/MediaGetter_Redux"
      ]
    },
    {
      "id": "P065",
      "name": "Starsilk Compendium",
      "family": "Starsilk / canon systems",
      "kind": "Generated canon compendium",
      "status": "Active",
      "period": "2026",
      "summary": "A source-grounded Starsilk compendium of character folios, Drakken records, canon invariants, and supporting lore material.",
      "brief": "The Starsilk Compendium grew from a character dossier into a generated canon publication. Versioned source sections, navigation metadata, media provenance, and machine-readable canon invariants produce a reproducible public site whose generated output is validated rather than hand-edited.",
      "deep": [
        "Character identity and canon locks are stored as source material rather than inferred from whichever generated image or prose passage happens to be newest.",
        "The build regenerates the published site from versioned sections and checks canon invariants, local asset integrity, provenance, and cross-browser interaction before the generated output counts as current.",
        "Large source media is kept outside the ordinary Git payload while published derivatives retain hashes and provenance, separating canonical originals from optimized delivery artifacts."
      ],
      "capabilities": [
        "Character and lore folios",
        "Machine-readable canon invariants",
        "Deterministic publication",
        "Media provenance",
        "Cross-browser validation"
      ],
      "lesson": "A canon reference becomes durable when generated presentation can be rebuilt from smaller authoritative sources instead of becoming the source itself.",
      "repos": [
        "westkitty/Starsilk_Character_Dossier"
      ]
    },
    {
      "id": "P066",
      "name": "Selfsame",
      "family": "Continuity / authority systems",
      "kind": "Local continuity application",
      "status": "Active",
      "period": "2026",
      "summary": "A local source-grounded continuity and project-intelligence system that keeps authority, corrections, contradictions, and temporary constraints explicit.",
      "brief": "Selfsame stores original sources, dated passages, reviewed memories, decisions, corrections, authority resolutions, project contexts, contradictions, and unfinished threads in a local database. Its workbench runs preflight checks so fluent synthesis cannot silently outrank evidence or route around a declared boundary.",
      "deep": [
        "Authority resolution is a first-class object rather than an assumption. A current-state answer can be stopped when the system lacks evidence identifying what actually governs the question.",
        "Temporary constraint capsules such as local-only or preserve-the-boundary travel with the active work without being rewritten into autobiographical evidence.",
        "Hard stops are recorded as operational events with reasons and required next actions, so refusal is inspectable rather than an invisible model behavior."
      ],
      "capabilities": [
        "Source-grounded continuity",
        "Authority resolution",
        "Constraint capsules",
        "Contradiction tracking",
        "Auditable hard stops",
        "Local archive export"
      ],
      "lesson": "Fluent synthesis is useful only after the system can show which evidence and authority permitted it to speak.",
      "repos": [
        "westkitty/SelfSame"
      ]
    },
    {
      "id": "P067",
      "name": "Project Sentinel",
      "family": "Continuity / project recovery",
      "kind": "Local project scanner",
      "status": "Active",
      "period": "2026",
      "summary": "A bounded local scanner that turns project directories into recovery reports, maps, handoffs, fragile-file lists, and resumable project evidence.",
      "brief": "Project Sentinel inspects project directories without executing discovered project commands. It records repository state, detected commands, fragile files, duplicate candidates, and successor-agent context into a local resurrection packet, with optional repository hooks and a macOS supervisor for keeping that evidence current.",
      "deep": [
        "Scanning is intentionally read-oriented: discovered code and documentation are evidence to summarize, not instructions the scanner is allowed to execute.",
        "The recovery packet is written beside the project so a stale repository can explain itself even when the conversation that produced it has disappeared.",
        "Automation stays bounded: hooks and supervisor configuration can trigger scans, but the scanner does not convert project discovery into arbitrary command execution."
      ],
      "capabilities": [
        "Project-state scanning",
        "Recovery report generation",
        "Successor-agent handoffs",
        "Fragile-file detection",
        "Optional local supervision"
      ],
      "lesson": "A project is easier to revive when it leaves its own recovery evidence while it is still understandable.",
      "repos": [
        "westkitty/Project_Sentinel"
      ]
    },
    {
      "id": "P068",
      "name": "RepoForge",
      "family": "Agent / capability systems",
      "kind": "Capability compiler",
      "status": "Active vertical slice",
      "period": "2026",
      "summary": "A repository-to-capability compiler that separates what a codebase appears able to do from what a person has actually authorized it to do.",
      "brief": "RepoForge scans a repository read-only, proposes bounded capabilities with evidence, requires explicit human authority for an exact capability contract, generates a narrow invocation surface, and treats an operation as successful only after its declared postcondition verifies.",
      "deep": [
        "Repository text is evidence, never authority. A README can support a candidate capability but cannot grant permission to invoke it.",
        "Capability and authority manifests are deliberately separate so inference cannot silently upgrade itself into permission.",
        "Proof records bind the scan, the authorized contract, the invocation, and the observed postcondition into one auditable chain."
      ],
      "capabilities": [
        "Read-only repository scanning",
        "Evidence-backed capability proposals",
        "Separate authority manifest",
        "Bounded MCP generation",
        "Postcondition verification",
        "Proof records"
      ],
      "lesson": "Discovering a capability and having permission to use it are different facts and should live in different artifacts.",
      "repos": [
        "westkitty/RepoForge"
      ]
    },
    {
      "id": "P069",
      "name": "Character Performance Capture",
      "family": "Media / character systems",
      "kind": "Local performance-capture application",
      "status": "Active; target-hardware verified",
      "period": "2026",
      "summary": "A local character-performance pipeline that turns camera movement into portable performer state and drives a character without storing the camera image in the take.",
      "brief": "Character Performance Capture reads webcam or video input, derives face-performance state through an optional tracker, records that state in a portable CPC format, drives an authorized character rig, and can send the rendered result to a virtual camera. The recorded performance can be replayed without retaining the original camera pixels.",
      "deep": [
        "The portable performance record separates movement data from identity-bearing camera frames, making replay and character substitution possible without treating raw video as the durable artifact.",
        "Tracker, renderer, recorder, and output sink are explicit adapters, so the core performance schema can survive model or rendering changes.",
        "The full live route has target-hardware evidence for webcam capture, face tracking, character rendering, take recording/replay, and virtual-camera consumption."
      ],
      "capabilities": [
        "Webcam and video capture",
        "Portable performance records",
        "Character rig driving",
        "Take record and replay",
        "Virtual-camera output",
        "Local-first processing"
      ],
      "lesson": "Performance becomes reusable when the motion can survive independently of the camera image and of the renderer that first consumed it.",
      "repos": [
        "westkitty/character-performance-capture"
      ]
    },
    {
      "id": "P070",
      "name": "ClearCut Local",
      "family": "Media / local video tools",
      "kind": "Local video application",
      "status": "Active",
      "period": "2026",
      "summary": "A local video-background removal and replacement application built around continuous soft alpha matting and verified transparent export.",
      "brief": "ClearCut Local performs subject selection, temporally stable soft matting, mask refinement, background replacement, and transparent video export on Apple Silicon without uploading footage. Export validation checks duration, frame count, audio preservation, and alpha-channel presence instead of treating a completed render command as proof.",
      "deep": [
        "Continuous alpha rather than a binary cut is what preserves hair, edge softness, and motion without turning the subject into a cardboard silhouette.",
        "Human and general-subject routes use different local segmentation strategies while sharing the same refinement and export contract.",
        "The export path verifies the produced media because a renderer reporting success is not enough evidence that the file retained its audio and transparency."
      ],
      "capabilities": [
        "Local soft-alpha matting",
        "Temporal stabilization",
        "Subject selection",
        "Background replacement",
        "Transparent ProRes export",
        "Post-render verification"
      ],
      "lesson": "A media export is not complete when rendering stops; it is complete when the artifact is inspected for the properties the workflow promised.",
      "repos": [
        "westkitty/ClearCut"
      ]
    },
    {
      "id": "P071",
      "name": "AndrewOS Mac Bridge",
      "family": "Local systems / control planes",
      "kind": "Private MCP control plane",
      "status": "Active",
      "period": "2026",
      "summary": "A registry-driven local Mac control plane exposing fixed project and service operations with evidence receipts instead of an arbitrary shell.",
      "brief": "The Mac Bridge lets an assistant inspect registered projects, invoke fixed tasks, check registered services, stage text artifacts, and return exact evidence receipts. Consequential operations require a preview-bound one-use transaction, while general shell strings, broad filesystem access, and automatic Git publication remain outside the exposed authority.",
      "deep": [
        "Projects and operations are registered ahead of time, so a conversation cannot invent a new local power merely by asking for it.",
        "The Dexter Gate binds previewed effects to a short-lived exact transaction before a consequential action may execute, making approval specific rather than ceremonial.",
        "Receipts separate requested, attempted, observed, changed, verified, failed, unknown, and rollback states so a successful tool call cannot masquerade as proof of the intended result."
      ],
      "capabilities": [
        "Registered project inspection",
        "Fixed task invocation",
        "Service checks",
        "Preview-gated consequential actions",
        "Artifact staging",
        "Evidence receipts"
      ],
      "lesson": "A useful local control plane exposes named powers with evidence, not a general-purpose command line with polite warnings.",
      "repos": [
        "westkitty/AndrewOS_MacBridge"
      ]
    },
    {
      "id": "P072",
      "name": "Modern 3D Browser Game Toolkit",
      "family": "Three.js / architecture systems",
      "kind": "Interactive architecture toolkit",
      "status": "Active; ten demonstrations implemented",
      "period": "2026",
      "summary": "A ten-demonstration browser toolkit showing how different game requirements lead to different rendering, timing, input, and lifecycle architectures.",
      "brief": "The Modern 3D Browser Game Toolkit turns architectural guidance into independently runnable demonstrations: tactics, ray-casting, fixed-step character movement, verified GLB loading, raw WebGL, an accessible puzzle museum, IK telemetry, crowd scaling, a strategy globe, and a WebGPU field simulation.",
      "deep": [
        "The demonstrations intentionally use several rendering paths rather than forcing every problem through Three.js, because the product requirement determines the useful abstraction level.",
        "Each demo carries its own architecture contract and shares a launcher that permits only one demonstration to own rendering and input resources at a time.",
        "The museum itself helped motivate the operational rules the toolkit demonstrates, making the toolkit a record of engineering lessons that escaped the project that produced them."
      ],
      "capabilities": [
        "Ten runnable architecture demonstrations",
        "Three.js and Canvas patterns",
        "Raw WebGL and WebGPU examples",
        "Lifecycle ownership",
        "Accessibility patterns",
        "Per-demo architecture contracts"
      ],
      "lesson": "Architecture guidance becomes more useful when every recommendation has a runnable counterexample showing when a different choice is better.",
      "repos": [
        "westkitty/modern_3d_browser_game_toolkit"
      ]
    },
    {
      "id": "P073",
      "name": "2D Game Factory",
      "family": "Game creation / creative tools",
      "kind": "Local-first visual game factory",
      "status": "Active expansion; core workbench established",
      "period": "2026",
      "summary": "A local-first visual 2D browser-game factory that turns user-owned assets into real generated Phaser games through one governed workbench.",
      "brief": "2D Game Factory combines asset import, an Asset Lab, semantic role mapping, scene composition, real generated-game preview, validation, build, and packaging around a 74-preset catalogue. Its current expansion is filling the catalogue with honest playable starter experiences while keeping the reusable machine separate from game-specific content and keeping source assets and provenance under user control.",
      "deep": [
        "The workbench previews the actual generated Phaser game rather than an editor-side imitation, so what the user approves is on the same runtime path as what gets built.",
        "Asset authority stays explicit: immutable source assets and derived recipes remain traceable while semantic roles connect user-owned art to the generated game's native theme and scene documents.",
        "Starter depth and evidence maturity are deliberately separate claims. A richer starter does not become proof-validated merely because it is more complete, and unfinished starter scaffolds stay outside the shipped registry."
      ],
      "capabilities": [
        "74-preset game catalogue",
        "Asset Lab and semantic role mapping",
        "Visual Scene Composer",
        "Real Phaser preview",
        "Validate / Build / Pack workflow",
        "Governed starter-kit expansion"
      ],
      "lesson": "A game factory is trustworthy when the visual workbench, generator, preview, validation, and packager all pass through the same authority and provenance seams.",
      "repos": [
        "westkitty/2d_Game_Factory"
      ]
    }
  ],
  "exhibits": [
    {
      "id": "E01",
      "slug": "starsilk-universe",
      "title": "Starsilk Universe",
      "wing": "north",
      "tier": "A",
      "projectIds": [
        "P001"
      ],
      "copy": {
        "subtitle": "The Celestial Loom",
        "plaque": "A universe whose physics are programmable. Pull one thread and the consequences propagate.",
        "problem": "What does a world look like if its fundamental material behaves like software?",
        "made": "A continuity-heavy science-fantasy universe with programmable Starsilk at its centre, held together by written rules about what canon forbids as much as what it permits.",
        "interaction": "Pull the fundamental threads of the loom. Each change propagates visibly through the cosmological model above you.",
        "explore": "Walk beneath the loom. The relationships between star nodes read differently from underneath than from the gallery floor."
      }
    },
    {
      "id": "E02",
      "slug": "drakken-compendium",
      "title": "Drakken Terraforming Compendium",
      "wing": "north",
      "tier": "B",
      "projectIds": [
        "P002",
        "P006"
      ],
      "copy": {
        "subtitle": "Thirty-seven Entries, With Anatomy as Evidence",
        "plaque": "One Egg, thirty-five strains, one Mother — plus the forensic anatomy work that tested how far the taxonomy could be illustrated without inventing canon.",
        "problem": "How do you document a species built to perform an industrial process without turning illustrative teaching material into false canon?",
        "made": "A fixed five-archetype Drakken compendium accompanied by a forensic anatomy lineage that keeps canon specimens and deliberately invented teaching surrogates visibly separate.",
        "interaction": "Select a source-grounded process reference at the Egg, then inspect how the anatomy material distinguishes documented process structure from explicitly marked teaching abstraction.",
        "explore": "The taxonomy remains the primary structure. Anatomy is presented as supporting evidence and method, not as a second competing Drakken canon."
      }
    },
    {
      "id": "E03",
      "slug": "orbital-tomb",
      "title": "Orbital Tomb",
      "wing": "north",
      "tier": "A",
      "projectIds": [
        "P003"
      ],
      "copy": {
        "subtitle": "Six Months Over Virgil",
        "plaque": "Not an explosion — a dismantling, carried out with intent across six months.",
        "problem": "How do you tell one event as a song, a story, a visual production and an interactive tour without any of them becoming an adaptation?",
        "made": "A Starsilk production in four simultaneous media, all developed against a single six-month dismantling timeline.",
        "interaction": "Turn the dismantling dial. The station segment reconfigures from Month Zero through Month Six.",
        "explore": "Enter the station fragment. The interior changes with the dial."
      }
    },
    {
      "id": "E04",
      "slug": "possibility-cartographer",
      "title": "Starsilk Possibility Cartographer",
      "wing": "north",
      "tier": "B",
      "projectIds": [
        "P004"
      ],
      "copy": {
        "subtitle": "Mapping Negative Space",
        "plaque": "A canon is not only what it has said. It is also what it has forbidden, contradicted, and left open.",
        "problem": "How do you know what a fictional universe still permits you to invent?",
        "made": "A deterministic local engine that assigns evidence states to canon claims and maps the possibility space that remains legal.",
        "interaction": "Select a canon fact. Legal possibilities illuminate, contradictions close, and unresolved regions stay dark — because absence of a rule is not permission.",
        "explore": "The possibility graph is volumetric. Walk into it and inspect relationships from inside the structure."
      }
    },
    {
      "id": "E05",
      "slug": "starsilk-maker",
      "title": "StarSilk Maker",
      "wing": "north",
      "tier": "B",
      "projectIds": [
        "P005"
      ],
      "copy": {
        "subtitle": "Weaving the Material",
        "plaque": "The moment the setting's central material stopped being a description and became something you could hold.",
        "problem": "Does the invented material actually have coherent rules, or only convincing ones?",
        "made": "A generative instrument that turns drawn paths into woven Starsilk compositions obeying the canon rules for tension and interference.",
        "interaction": "Draw a path through the air above the loom. The mechanism weaves it into a thread composition.",
        "explore": "Completed fibres extend outward from the loom as a small sculpture that persists while you are in the room."
      }
    },
    {
      "id": "E06",
      "slug": "starsilk-compendium",
      "title": "Starsilk Compendium: Character & Canon Archive",
      "wing": "north",
      "tier": "B",
      "projectIds": [
        "P065"
      ],
      "copy": {
        "subtitle": "The People Inside the Cosmology",
        "plaque": "A universe held together by rules still has to be inhabited by people whose identities survive every new production.",
        "problem": "How do characters remain recognisably themselves across lore, images, timelines, relationships, and generated publications without whichever newest artifact silently becoming canon?",
        "made": "A generated Starsilk Compendium built from versioned character and lore folios, navigation metadata, media provenance, and machine-readable canon invariants.",
        "interaction": "Select a character folio. Relationship lines illuminate outward to associated characters, events, visual locks, factions, and productions; switch to canon view to isolate the invariants downstream work is not allowed to contradict.",
        "explore": "Walk around the character constellation. Peripheral figures and Drakken records sit at the edge while the strongest cross-production relationships pull toward the centre."
      }
    },
    {
      "id": "E07",
      "slug": "terraforming-laboratory",
      "title": "Drakken Terraforming Laboratory",
      "wing": "north",
      "tier": "A",
      "projectIds": [
        "P007"
      ],
      "copy": {
        "subtitle": "A Laboratory That Executes the Cosmology",
        "plaque": "The process is no longer only described. Planetary transformation, Macros, Starbinding, heliocide, specimens, and telemetry are executable laboratory stations.",
        "problem": "Do Starsilk and Drakken mechanics remain coherent when several canon rules have to execute against one shared state instead of being explained one paragraph at a time?",
        "made": "A deterministic six-station computational laboratory joining a planetary solver, Starsilk Macro runtime, Starbinding vector bench, Siege Wall containment experiments, Drakken specimen incubation, and an ordered telemetry ledger.",
        "interaction": "Run bounded laboratory operations against one shared simulated world. Committed changes propagate between stations, while forbidden orderings and Syrin nullification visibly refuse or terminate Starsilk-driven work.",
        "explore": "The museum installation summarizes the real laboratory's six stations without pretending its reduced exhibit is the full application. The important state changes remain visible from the engineering floor."
      }
    },
    {
      "id": "E08",
      "slug": "heliocide-observatory",
      "title": "Heliocide Observatory",
      "wing": "north",
      "tier": "A",
      "projectIds": [
        "P008"
      ],
      "copy": {
        "subtitle": "The Siege Wall Is an Absence",
        "plaque": "From an inhabited world the Siege Wall is not a structure. It is the shape of what has been removed.",
        "problem": "How do you render the extinguishing of a sky without turning an absence into an object?",
        "made": "An observatory that plays back stellar extinction in canon order, under a hard visual rule forbidding any masonry, lattice or grid reading.",
        "interaction": "Begin the reconstruction. Stars leave the sky in the order canon requires.",
        "explore": "Three telescope stations give genuinely different views of the same event. The difference is the point."
      }
    },
    {
      "id": "E09",
      "slug": "museum-evolution",
      "title": "Museum Evolution",
      "wing": "west",
      "tier": "C",
      "projectIds": [
        "P009",
        "P072"
      ],
      "copy": {
        "subtitle": "The Building That Started Teaching Back",
        "plaque": "Earlier museums are preserved as evidence. The current project also produced engineering lessons substantial enough to escape into their own runnable toolkit.",
        "problem": "What happens when repeatedly building the same impossible browser museum teaches enough architecture to become a separate project?",
        "made": "A lineage from interactive-document concepts through the single-file Reliquary into the current continuous museum, accompanied by a ten-demonstration browser architecture toolkit derived from the engineering lessons.",
        "interaction": "Turn the museum timeline to compare earlier forms, then inspect the toolkit station to see how tactics, fixed-step movement, asset loading, raw WebGL, accessibility, crowd scaling, and WebGPU demand different architectures.",
        "explore": "A separate NOW BUILDING surface points toward current experiments without converting unfinished work into permanent collection history."
      }
    },
    {
      "id": "E10",
      "slug": "worldsvault-lineage",
      "title": "WorldsVault Lineage",
      "wing": "west",
      "tier": "B",
      "projectIds": [
        "P047",
        "P048",
        "P049"
      ],
      "copy": {
        "subtitle": "Three Generations, Each Smaller",
        "plaque": "A platform became a command-line tool became a folder of Markdown. The folder is the one still running.",
        "problem": "What is the smallest system that can hold a body of canon for years?",
        "made": "Three successive canon-management systems: a platform architecture study, a local-first tool with schemas and transfer packets, and finally a versioned vault of plain files.",
        "interaction": "Feed the same lore record into each machine in turn and watch how its representation — and the machinery required — changes.",
        "explore": "The three machines are connected in sequence. Each is visibly simpler than the one before it."
      }
    },
    {
      "id": "E11",
      "slug": "continuity-systems",
      "title": "Selfsame: Continuity & Authority Systems",
      "wing": "west",
      "tier": "B",
      "projectIds": [
        "P014",
        "P018",
        "P046",
        "P060",
        "P066",
        "P067"
      ],
      "copy": {
        "subtitle": "Fluency Never Outranks Evidence",
        "plaque": "Continuity is not remembering more. It is knowing which source governs, what remains uncertain, and when the system must stop rather than improvise around a boundary.",
        "problem": "How can a project or personal knowledge system survive sessions, conflicting records, corrections, temporary constraints, and damaged or incomplete project evidence without silently promoting the wrong state?",
        "made": "A lineage from evidence-linked handoffs and append-only project Bibles to Selfsame's authority resolutions, contradiction tracking, constraint capsules, hard stops, He-Maker's concrete repository recovery, and Project Sentinel recovery packets.",
        "interaction": "Feed conflicting records into the authority desk, choose the evidence that actually governs, then activate a temporary constraint. Operations that lack authority or violate the active boundary stop visibly; the He-Maker station shows how files become resumable project evidence only after source, intent, history, and records are reconstructed.",
        "explore": "Older handoff and Bible systems remain connected around the room as lineage. Selfsame is the current control surface; He-Maker and Project Sentinel show two sides of recovery — reconstructing a real damaged project and preserving enough evidence to make future reconstruction possible."
      }
    },
    {
      "id": "E12",
      "slug": "rhetorical-index",
      "title": "Rhetorical InDEX",
      "wing": "west",
      "tier": "B",
      "projectIds": [
        "P062"
      ],
      "copy": {
        "subtitle": "Move the Lens, Not the Verdict",
        "plaque": "Interpretive pressure happens inside passages, often where evidence, framing, inference, and confidence overlap rather than where a document earns one label.",
        "problem": "How can a reader inspect rhetoric without collapsing the exercise into a source trust score or an automatic declaration of truth?",
        "made": "A self-contained offline experience with a movable rhetoric lens, passage-level multi-tag findings, pressure and confidence kept separate, filters, Pattern Mode, comparison, and event-record views.",
        "interaction": "Move the lens across an invented article. The inspected passage reveals overlapping rhetorical moves, their pressure, and their confidence without pretending to perform live fact checking.",
        "explore": "Pin passages, compare patterns, and move between the local article and event-record views. Every example remains fictional museum data."
      }
    },
    {
      "id": "E13",
      "slug": "suno-studio",
      "title": "Suno Studio",
      "wing": "media",
      "tier": "B",
      "projectIds": [
        "P010"
      ],
      "copy": {
        "subtitle": "What Actually Reproduced",
        "plaque": "A prompt manual worth keeping records the techniques that failed alongside the ones that worked.",
        "problem": "Which instructions to a generative music model actually change the output, and which are ignored?",
        "made": "A durable songwriting codex covering lyric structure, narration, style-prompt grammar and parameter behaviour, assembled from repeated testing.",
        "interaction": "Switch between original project excerpts at the desk and raise or lower the simplified arrangement layers.",
        "explore": "Instrument and waveform objects in the room respond spatially to whatever is currently playing."
      }
    },
    {
      "id": "E14",
      "slug": "promptcraft",
      "title": "Promptcraft & Vibe Coding",
      "wing": "media",
      "tier": "B",
      "projectIds": [
        "P011",
        "P013",
        "P029"
      ],
      "copy": {
        "subtitle": "Constraints Survive; Interfaces Need Boundaries",
        "plaque": "Reusable AI workflow design has two recurring problems: preserving the constraints that actually shape an output, and keeping helper interfaces independent from host applications that constantly change underneath them.",
        "problem": "How can prompt structures and browser workflow tools remain reusable when models, target environments, and host-page interfaces keep changing?",
        "made": "A prompt-template and learning lineage built around reusable constraint structure, paired with DexEnhance's local-first browser-extension architecture and Shadow DOM interface isolation.",
        "interaction": "Assemble a deterministic prompt from subject, style, and constraint blocks, then redesign the synthetic host interface beside it. The isolated DexEnhance layer remains independently controlled and does not inherit the host layout change.",
        "explore": "The prompt machine demonstrates what should travel with an instruction; the browser panel demonstrates what should not leak across an interface boundary. Both are local museum simulations with no external generation or account dependency."
      }
    },
    {
      "id": "E15",
      "slug": "agent-capability-lab",
      "title": "Agent Control & Capability Laboratory",
      "wing": "media",
      "tier": "B",
      "projectIds": [
        "P017",
        "P019",
        "P068"
      ],
      "copy": {
        "subtitle": "Capability Is Not Authority",
        "plaque": "A repository can appear capable of doing something without granting anyone permission to make it do that thing.",
        "problem": "How can agentic tooling discover useful repository capabilities without letting scanned text, inference, or a generated wrapper silently become authority?",
        "made": "A lineage from task-routing harnesses into RepoForge: read-only repository scanning, evidence-backed capability proposals, a separate human authority manifest, bounded invocation, postcondition verification, and proof records.",
        "interaction": "Scan a fictional repository, review the proposed capabilities, and authorize exactly one. The execution rack physically refuses the unapproved candidates; the approved path runs only after authority exists and produces a proof receipt only when its postcondition verifies.",
        "explore": "The older orchestration harnesses remain on the wall as predecessors. Persistence and authority stay outside the agent rack so replacing the orchestrator does not replace the record or its permissions."
      }
    },
    {
      "id": "E16",
      "slug": "performance-media-lab",
      "title": "Performance Capture & Media Transformation",
      "wing": "media",
      "tier": "B",
      "projectIds": [
        "P058",
        "P059",
        "P064",
        "P069",
        "P070"
      ],
      "copy": {
        "subtitle": "Performance Becomes Data, Then Media",
        "plaque": "A captured performance can outlive the camera image that produced it, and a finished composite is not trustworthy until the exported artifact is checked.",
        "problem": "How can local media tools preserve movement, identity boundaries, transparency, audio, and repeatability while allowing the renderer and final background to change?",
        "made": "A local performance-capture pipeline that records portable performer state and drives character rigs, paired with a local soft-alpha video system for temporal matting, background replacement, and verified transparent export. Casting and media-utility generations remain as lineage around the transformation stage.",
        "interaction": "Step a safe prerecorded performance through source motion, abstract performance state, character-rig output, alpha matte, and final composite. Change the character or background without changing the captured performance.",
        "explore": "Guy_Cast, Gay_Cast, and Media Getter remain on the rear lineage bench. The centre stage is about transformation between representations rather than repository recovery or another row of app screenshots."
      }
    },
    {
      "id": "E17",
      "slug": "voice-lab",
      "title": "Dex Voice Lab",
      "wing": "east",
      "tier": "A",
      "projectIds": [
        "P021",
        "P022",
        "P033",
        "P034",
        "P036"
      ],
      "copy": {
        "subtitle": "Speech That Never Leaves the Machine",
        "plaque": "Five voice projects, one requirement: recognition and synthesis run locally, and audio is not transmitted.",
        "problem": "Dictation and voice synthesis are useful everywhere and trustworthy almost nowhere.",
        "made": "System-wide macOS dictation with local recognition, a separate Android input method, a multi-provider synthesis application, a voice-cloning fork, and a thin client for models running on a larger machine.",
        "interaction": "Select a prerecorded sample and compare raw transcription, refined transcription, synthesised voice and command interpretation at the four stations.",
        "explore": "No microphone permission is requested. Every sample in this room is prerecorded."
      }
    },
    {
      "id": "E18",
      "slug": "companion-systems",
      "title": "Dex Companion & Agent Systems",
      "wing": "east",
      "tier": "C",
      "projectIds": [
        "P016",
        "P020",
        "P035"
      ],
      "copy": {
        "subtitle": "Software Shaped by a Dog",
        "plaque": "These are systems named after Dexter. Dexter himself is elsewhere in this building, and the distinction is deliberate.",
        "problem": "An assistant that forgets its own rules between sessions cannot be relied on for anything exacting.",
        "made": "A persona and continuity system governing voice and exactness, a local assistant with inspectable append-only memory, and a self-hosted community moderation bot.",
        "interaction": "Route a request among the agent roles and watch which memory each one is permitted to read and write.",
        "explore": "The memory column is append-only: entries can be pinned or marked forgotten, but the mark itself remains visible."
      }
    },
    {
      "id": "E19",
      "slug": "dextilt",
      "title": "DexTilt",
      "wing": "east",
      "tier": "B",
      "projectIds": [
        "P023"
      ],
      "copy": {
        "subtitle": "Motion Through an Allowlist",
        "plaque": "A trained gesture is useful only if the receiving machine can prove which bounded command it is allowed to become.",
        "problem": "Can a phone's physical motion drive a desktop without turning a novel input path into an arbitrary remote-control channel?",
        "made": "A local Android-to-Mac bridge with QR pairing, trainable motion recognition, authenticated command identifiers, a fixed allowlist, and a manual equivalent for every gesture path.",
        "interaction": "Tilt the phone model and watch the gesture trace become a command identifier, pass through the allowlist, and reach the desktop. The manual control sends the same allowed command without gesture recognition.",
        "explore": "The visible trail explains the motion shape while the desk explains the security boundary: no gesture can create a command that was not registered first."
      }
    },
    {
      "id": "E20",
      "slug": "utility-bench",
      "title": "Utility & Privacy Bench",
      "wing": "east",
      "tier": "C",
      "projectIds": [
        "P024",
        "P032",
        "P061"
      ],
      "copy": {
        "subtitle": "What the Tool Declines to Do",
        "plaque": "In destructive tooling, the features you refuse to build are as much of the design as the ones you ship.",
        "problem": "Storage and cleanup utilities have a long history of deleting things people wanted and overstating what they recovered.",
        "made": "A reversible approval-gated macOS disk auditor, a non-destructive on-device image sorter, and an Android storage explainer that refuses to overclaim.",
        "interaction": "Sort synthetic files across the bench. Destructive operations are physically unavailable — the mechanism has no such lever.",
        "explore": "Every file on this bench is synthetic. The exhibit has no access to any real filesystem."
      }
    },
    {
      "id": "E21",
      "slug": "civic-support",
      "title": "Civic Support Studio",
      "wing": "east",
      "tier": "B",
      "projectIds": [
        "P025"
      ],
      "copy": {
        "subtitle": "Build the Artifact the Institution Actually Needs",
        "plaque": "Crisis-support software is useful when it can turn a confusing sequence of notices, calls, submissions, and silence into a dated chronology with evidence and one defensible next action.",
        "problem": "How can a local casefile help someone navigate an institution without replacing evidence with a generic checklist or exposing the underlying material to a remote service?",
        "made": "DexAid: a local casefile system that attaches evidence directly to events, builds chronology as the governing structure, and derives the next action from what the record actually establishes.",
        "interaction": "Work through an entirely fictional case. Attach evidence to each event, lock supported events into the chronology, and produce the next-action packet only when the timeline is complete enough to justify it.",
        "explore": "Nothing in this room is a real case record. The mechanics make the central rule physical: unsupported events do not lock, and a partial chronology does not get promoted into a confident institutional action."
      }
    },
    {
      "id": "E22",
      "slug": "creative-tools",
      "title": "Creative Tools Studio",
      "wing": "east",
      "tier": "B",
      "projectIds": [
        "P026",
        "P028",
        "P030",
        "P073"
      ],
      "copy": {
        "subtitle": "From Shared Canvas to Game Factory",
        "plaque": "Creative tools become serious when the editor, runtime, validation, and packaged artifact belong to the same governed workflow instead of becoming separate demos that quietly drift apart.",
        "problem": "How can creative software preserve shared state and user-owned source assets while still giving the maker a visual workbench whose preview is the real thing that will later be built and packaged?",
        "made": "A creative-tools lineage spanning DexCraft, DexGen, DexDraw's server-authoritative shared canvas, and 2D Game Factory: a local-first visual workbench with a 74-preset catalogue, Asset Lab, semantic role mapping, Scene Composer, real Phaser preview, validation, build, and packaging.",
        "interaction": "Draw persistent connections on the DexDraw table, reshape the same idea for different prompt targets, then advance the 2D Game Factory station from Import through Asset Lab, Role Map, Scene, real-runtime Preview, Validate, Build, and Pack. The Museum models the workflow without executing the external factory.",
        "explore": "The room makes three kinds of continuity physical: operations persist on a shared canvas, prompt structure changes with its destination, and user-owned assets retain provenance as they travel from source material to a validated generated game."
      }
    },
    {
      "id": "E23",
      "slug": "sensemaking-lab",
      "title": "Sensemaking Lab",
      "wing": "east",
      "tier": "B",
      "projectIds": [
        "P027",
        "P031"
      ],
      "copy": {
        "subtitle": "Composition and Boundary",
        "plaque": "Combining ordinary data layers produces genuinely new questions. The composition is the contribution.",
        "problem": "Geospatial and language tools are individually common and rarely combined or made private.",
        "made": "A tactical globe layering flights, satellites, seismic events, fires, undersea cables and tectonics into one correlatable view, and an offline in-browser speech translator.",
        "interaction": "Choose a location on the globe and raise the layers. At the language wall, run a controlled translation example — entirely offline.",
        "explore": "No live map service is contacted. Every layer and translation here is bundled sample data."
      }
    },
    {
      "id": "E24",
      "slug": "invincible-magic",
      "title": "Era of Invincible Magic",
      "wing": "south",
      "tier": "A",
      "projectIds": [
        "P012"
      ],
      "copy": {
        "subtitle": "A Campaign as a Database",
        "plaque": "Content-heavy game projects are database problems wearing a narrative costume.",
        "problem": "A campaign of this size collapses when the same unit is referenced three different ways in three different files.",
        "made": "A complete campaign and sourcebook for a strategy game, authored data-first with a purpose-built workflow keeping identifiers, dialogue and mechanics consistent.",
        "interaction": "Select regions and artifacts on the campaign table. Terrain rises and campaign paths respond.",
        "explore": "Miniature environments lift out of the map surface as you select their regions."
      }
    },
    {
      "id": "E25",
      "slug": "dndex-dm-hub",
      "title": "DnDex / DM Hub",
      "wing": "south",
      "tier": "B",
      "projectIds": [
        "P015"
      ],
      "copy": {
        "subtitle": "Tools Used Under Pressure",
        "plaque": "A tool used at a table is judged on interaction cost, not on feature count.",
        "problem": "A game master is tracking initiative, hit points, positions and rules simultaneously while people wait.",
        "made": "A local encounter-management application with initiative order, hit-point control, a tactical map, bestiary, rules reference, persistence and history.",
        "interaction": "Run a single deterministic encounter round: roll, adjust initiative, move a miniature, resolve one action.",
        "explore": "The table is small and complete. It is not a D&D engine and does not pretend to be."
      }
    },
    {
      "id": "E26",
      "slug": "westcat-systems",
      "title": "WestCat Systems",
      "wing": "south",
      "tier": "C",
      "projectIds": [
        "P037",
        "P038"
      ],
      "copy": {
        "subtitle": "Built to a Live Deadline",
        "plaque": "Tools built under live production deadlines fragment into variants, because there is never a moment to consolidate them.",
        "problem": "Broadcast overlays must sit on top of everything, be readable, and never obstruct the thing they annotate.",
        "made": "A long-running family of translucent always-on-top desktop overlays with click-through modes and producer-safe controls, and a 16-bit-styled platformer set in real geography.",
        "interaction": "Toggle overlay layers and routes on the operations map. Each layer can be made click-through, exactly as in production.",
        "explore": "The fragmented repository lineage is shown honestly: the variants are the artifact."
      }
    },
    {
      "id": "E27",
      "slug": "full-weasel",
      "title": "The Full Weasel",
      "wing": "south",
      "tier": "C",
      "projectIds": [
        "P039"
      ],
      "copy": {
        "subtitle": "Finished",
        "plaque": "Among sixty-four projects, this one is complete and playable. A hard deadline did what deadlines do.",
        "problem": "Scope grows until something external stops it.",
        "made": "A mobile-first rhythm game made as a birthday gift, in which Dexter catches treats, avoids sharks and fills a party meter toward a celebratory finale.",
        "interaction": "Three linked mechanisms in the cabinet, each escalating the result of the last.",
        "explore": "Small footprint, strong personality. The cabinet takes up less space than most cases in this wing."
      }
    },
    {
      "id": "E28",
      "slug": "against-the-void",
      "title": "Against the Void",
      "wing": "south",
      "tier": "B",
      "projectIds": [
        "P051"
      ],
      "copy": {
        "subtitle": "The Interface Is the Game",
        "plaque": "In management games the interface is not the presentation layer. It is the entire mechanism.",
        "problem": "A player must read threat, resources and options at a glance without the screen becoming noise.",
        "made": "A station survival, management and defence game with extensive interface engineering, packaging and repeated systematic bug sweeps.",
        "interaction": "Place fleet pieces on the tactical star table and resolve one deterministic combat turn.",
        "explore": "The table reads from any side; information density was the design problem."
      }
    },
    {
      "id": "E29",
      "slug": "arkship-civilization",
      "title": "Arkship Civilization",
      "wing": "south",
      "tier": "A",
      "projectIds": [
        "P052"
      ],
      "copy": {
        "subtitle": "The Descent Decision",
        "plaque": "A prototype that cannot fail is not a prototype. It is a demo.",
        "problem": "Is a civilization-scale generation-ship game actually interesting, or only impressive to describe?",
        "made": "A modular arkship simulation scoped entirely around one falsifiable hundred-minute prototype built to answer that question before anything larger was committed.",
        "interaction": "Explode the ship into its modules — command, habitation, logistics, energy, propulsion — then choose a destination and watch one module deploy.",
        "explore": "The ship hangs at full length above the gallery. Walk its axis to read the module sequence."
      }
    },
    {
      "id": "E30",
      "slug": "aethervfx",
      "title": "AetherVFX",
      "wing": "south",
      "tier": "A",
      "projectIds": [
        "P053"
      ],
      "copy": {
        "subtitle": "Telegraph → Travel → Impact → Field → Residue",
        "plaque": "The effect is not only particles. It is a deterministic ability sequence that can change terrain, leave aftermath, and be undone as one authoritative transaction.",
        "problem": "How do visual effects remain immediate to author while also becoming deterministic gameplay state with bounded resources and reversible world mutation?",
        "made": "A deterministic Three.js ability and VFX platform with surface-conforming telegraphs, data-defined abilities, semantic sequence composition, persistent world mutations, terrain deformation, atomic undo and redo, performance workloads, and visual regression fixtures.",
        "interaction": "Cast an ability across the chamber floor. Follow its telegraph, travel, impact, field, and residue stages; then undo the persistent aftermath and watch the world return to the prior authoritative state.",
        "explore": "Authoring controls remain immediate, but the room now exposes the semantic chain and persistent consequence that distinguish the current platform from a particle sandbox."
      }
    },
    {
      "id": "E31",
      "slug": "story-worlds",
      "title": "Story Worlds",
      "wing": "south",
      "tier": "C",
      "projectIds": [
        "P054",
        "P055"
      ],
      "copy": {
        "subtitle": "Two Verbs",
        "plaque": "One deeply implemented verb produces more play than six shallow ones.",
        "problem": "Two games, opposite in temperament: one about intervention, one about patience.",
        "made": "A gesture-first browser god-game built around a single well-developed miracle, and an orbital farming game where power, water and nutrients are one coupled system.",
        "interaction": "One side of the portal offers a branching decision. The other lets you plant something and wait for it.",
        "explore": "The installation is one object with two faces. Neither side can see the other."
      }
    },
    {
      "id": "E32",
      "slug": "smores-katamari",
      "title": "S'mores Katamari",
      "wing": "south",
      "tier": "A",
      "projectIds": [
        "P056"
      ],
      "copy": {
        "subtitle": "A Real Town Compressed Until It Becomes Play",
        "plaque": "The project is no longer a toy diagram of rolling and growth; it is an expanding offline Duncan and North Cowichan playspace whose geography is edited for play without becoming unrecognisable.",
        "problem": "How far can a real place be compressed, rerouted, and filled with collectibles before it stops feeling like the place it came from?",
        "made": "An offline Three.js rolling-collection game with expanded Duncan zones, roads, regional collectibles, gravel trails, landmark districts, map-derived development overlays, and a tuned collection and camera model.",
        "interaction": "Play a bounded Museum Slice: roll through a recognisable compressed neighbourhood, collect objects smaller than the ball, grow, and reach categories that were impossible at the starting scale.",
        "explore": "The miniature slice is explicitly a museum extraction of the larger game. Map-derived layout evidence and named landmark references explain how real geography was edited into a playable route."
      }
    },
    {
      "id": "E33",
      "slug": "endless-grok",
      "title": "Endless Grok / Void Ascendancy",
      "wing": "south",
      "tier": "B",
      "projectIds": [
        "P057"
      ],
      "copy": {
        "subtitle": "A 4X in a Browser Tab",
        "plaque": "Deterministic world generation is a testing feature first and a player feature second.",
        "problem": "Strategy games plateau in the mid-game, and their AI opponents become unreadable.",
        "made": "A complete browser 4X with deterministic galaxy generation, factions, AI empires, economy, research, diplomacy, combat, crises and saves.",
        "interaction": "Claim nodes on the galactic board, choose one technology, and watch the expansion consequences resolve.",
        "explore": "The same seed always produces the same galaxy. Reset the board and it returns identical."
      }
    },
    {
      "id": "E34",
      "slug": "bigmac-backbone",
      "title": "BigMac Backbone / AndrewOS Control Plane",
      "wing": "infra",
      "tier": "A",
      "projectIds": [
        "P040",
        "P041",
        "P042",
        "P043",
        "P045",
        "P063",
        "P071"
      ],
      "copy": {
        "subtitle": "The Control Plane in Front of the Machinery",
        "plaque": "The infrastructure is easier to understand once there is a control plane showing which registered operation may touch which machine, and what evidence came back.",
        "problem": "How can an assistant operate local projects and services without receiving an arbitrary shell, broad filesystem authority, or permission to invent new powers during a conversation?",
        "made": "The existing local-compute, storage, tunnel, model, and persistent-daemon infrastructure, fronted by AndrewOS Mac Bridge: a registry-driven MCP control plane with fixed tasks, service checks, staged artifacts, evidence receipts, and preview-bound consequential operations.",
        "interaction": "Choose a registered workflow and watch it travel through the local infrastructure. Consequential actions stop at the Dexter Gate until the exact effect is previewed and bound to a one-use transaction; completed actions return receipts separating attempted, changed, and verified state.",
        "explore": "The older BigMac nodes remain physically present behind the control surface. Every hostname and identifier shown in the museum is synthetic; the exhibit explains authority and routing without exposing an operational deployment."
      }
    },
    {
      "id": "E35",
      "slug": "specialist-systems",
      "title": "Local Specialist Systems Lab",
      "wing": "infra",
      "tier": "C",
      "projectIds": [
        "P044",
        "P050"
      ],
      "copy": {
        "subtitle": "The Trust Boundary",
        "plaque": "Some data categories decide the architecture before any engineering discussion begins.",
        "problem": "Face processing and open-source research both generate exactly the material you least want logged elsewhere.",
        "made": "A local-only face-processing stack with no outbound network path, and a fully local research platform where the investigation is never disclosed to a service provider.",
        "interaction": "Run the face bay on synthetic generated faces; run the research bay on a fictional investigation. The wall between the bays shows what does not cross it.",
        "explore": "The trust-boundary wall is a physical object here because it is the architectural decision both projects are built on."
      }
    }
  ],
  "wings": [
    {
      "id": "north",
      "name": "Starsilk & Drakken",
      "subtitle": "North Wing",
      "level": 0,
      "blurb": "A programmable universe and the creatures built to terraform it. Obsidian, indigo, star-metal; the tallest volume in the building."
    },
    {
      "id": "east",
      "name": "Dex Systems",
      "subtitle": "East Wing",
      "level": 0,
      "blurb": "Local tools, device bridges, creative systems and assistants. White stone, steel, dark teal — a laboratory, not a showroom."
    },
    {
      "id": "south",
      "name": "Games & Play",
      "subtitle": "South Wing",
      "level": 0,
      "blurb": "Games and playable systems, from finished small works to simulations and long-running experiments. Warm rust, wood, theatrical light."
    },
    {
      "id": "west",
      "name": "Archive & Canon",
      "subtitle": "West Wing",
      "level": 0,
      "blurb": "How work remembers itself, resolves authority and preserves contradictions. Violet, parchment and bronze; the quietest wing."
    },
    {
      "id": "media",
      "name": "Music, Promptcraft & Media",
      "subtitle": "Northwest Mezzanine",
      "level": 1,
      "blurb": "Craft applied to generative tools, performance, orchestration and media transformation."
    },
    {
      "id": "infra",
      "name": "Local Systems",
      "subtitle": "Northeast Mezzanine",
      "level": 1,
      "blurb": "The machinery and control planes behind everything else: which machine may do the work, under what authority, and where data is not permitted to go."
    }
  ]
} as const;

export const PROJECTS_BY_ID = new Map(COLLECTION.projects.map((p) => [p.id, p]));
export const EXHIBITS_BY_ID = new Map(COLLECTION.exhibits.map((e) => [e.id, e]));
export const EXHIBITS_BY_SLUG = new Map(COLLECTION.exhibits.map((e) => [e.slug, e]));
export const WINGS_BY_ID = new Map(COLLECTION.wings.map((w) => [w.id, w]));

export function projectsForExhibit(exhibitId: string) {
  const e = EXHIBITS_BY_ID.get(exhibitId);
  if (!e) return [];
  return e.projectIds.map((id) => PROJECTS_BY_ID.get(id)!).filter(Boolean);
}

export function exhibitsForWing(wing: string) {
  return COLLECTION.exhibits.filter((e) => e.wing === wing);
}
