# Three.js AI development toolkit (development-only)

Shared installs live in `~/.local/share/3d-lab`; no MCP package or browser bridge is added to the Museum runtime. The global usage, security, update and uninstall guide is `~/.local/share/3d-lab/README.md`.

## Launch the actual Museum

The selected local checkout is the root of this repository. From this checkout:

```sh
3d-lab museum --project "$PWD" play
3d-lab museum --project "$PWD" workshop
3d-lab museum --project "$PWD" flight
3d-lab museum --project "$PWD" island
3d-lab museum --project "$PWD" workbench
```

The launcher starts Vite on the existing loopback port 5173 if free and opens the selected URL in the default browser. It leaves any existing non-Museum listener untouched. The URLs are:

- Playable first-person Museum: <http://127.0.0.1:5173/>
- Workshop: <http://127.0.0.1:5173/?edit=1>
- Developer free flight and sky controls: <http://127.0.0.1:5173/?devtools=1>
- Full Island survey: <http://127.0.0.1:5173/workbench/?view=island>
- Architectural workbench: <http://127.0.0.1:5173/workbench/?view=museum>

The launcher reports the experience and whether the DevTools scene bridge is active. Use `3d-lab doctor` for global status. The `threejs_devtools` MCP entry must be loaded by a fresh Codex process after the global config change. The dedicated MCP Chrome profile is separate from the default browser profile.

Claude Desktop Code's Browser/Preview pane reads the existing `.claude/launch.json`; it already offers `museum` on port 5173 and `museum-production` preview on 4173. Choose **Run museum** in the Code Browser's Dev servers menu to start the local Vite preview. This project-owned entry does not duplicate or replace `3d-lab museum`.

## Existing project contracts

- Play and the developer controls inspect the actual existing scene and preserve first-person traversal. `?edit=1` adds the existing dev-only Workshop; `?devtools=1` adds the existing flight/sky controls.
- Workshop edits only registered safe placement objects. The existing localhost Vite save endpoint and conservation schema remain the persistent-save boundary; structural geometry, collisions, routes and source installations stay protected.
- `/workbench/?view=museum` is the separate read-only architectural survey, with existing floors/wings, isolation, selection, annotations and camera tools.
- `/workbench/?view=island` builds the canonical exterior world for the survey, including terrain, lagoon, vegetation, shoreline, pier and exterior lighting. It is a separate survey page lifecycle, not a competing playable render loop.
- `src/app/Loop.ts` remains the single playable frame-loop owner; the existing `RendererHost` owns the visitor renderer and `ResourceScope`/lifecycle code owns disposal.

MCP live changes are temporary browser previews. Review the DevTools `pending_changes` source patch before approving a persistent edit. Studio scenes are independent and must be reviewed/adapted under the existing Museum contracts. No new backend, public runtime dependency, visitor overlay or runtime network call is introduced by this toolkit integration.

## Local validation boundary

Automated source/build checks can verify that public bundles exclude dev-only tools. They do not prove human visual acceptance, representative-device performance, physical traversal feel or Needle Inspector UI activation. Record those separately.
