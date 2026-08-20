# Exhibit Contract — FROZEN

**Frozen:** Phase 0, 2026-08-19. Changing this interface requires a dedicated shared-core task, not a wing-lane edit.

## The interface

```ts
interface ExhibitModule {
  readonly def: ExhibitDefinition;
  preload(ctx: ExhibitContext): Promise<void>;
  mount(ctx: ExhibitContext): void;
  activate(): void;
  update(dt: number, ctx: ExhibitUpdateContext): void;
  deactivate(): void;
  unmount(): void;
  dispose(): void;
  reset(): void;
  getAccessibleContent(): AccessibleExhibitContent;
}
```

## Lifecycle states

```
UNLOADED ──preload──▶ LOADED ──mount──▶ MOUNTED ──activate──▶ ACTIVE
   ▲                     │                 │                    │
   └──── dispose ────── unmount ◀──────────┘◀──── deactivate ───┘
```

Rules the runtime enforces (`src/exhibits/ExhibitHost.ts`):

1. Transitions only happen along the arrows above. Illegal transitions throw.
2. `update(dt)` is called **only** in `ACTIVE`.
3. `mount()` may only add objects to the group the host gives it. It may not touch the scene graph elsewhere.
4. `dispose()` must release every geometry, material, texture and render target the module created.
   The host asserts this by tracking the module's `ResourceScope` allocation count back to zero.
5. `reset()` returns the exhibit to its initial interactive state without unmounting. It must be idempotent.
6. **No module may call `requestAnimationFrame`, `setInterval`, or create its own render loop.**
   Enforced by ESLint (`no-restricted-globals`) and by `scripts/validate-frameloop.mjs`.
7. A module receives all engine services through `ExhibitContext`. It does not import the renderer,
   the camera, the loop, or another exhibit.

## Declaration

Every exhibit declares, in `ExhibitDefinition`:

| Field | Meaning |
|---|---|
| `id` | `E01`–`E35` |
| `slug` | stable kebab-case identifier |
| `title` | visitor-facing name |
| `projectIds` | the project IDs this exhibit represents (from the frozen mapping) |
| `wing` | `north` `south` `east` `west` `media` `infra` |
| `tier` | `A` `B` `C` — production tier, drives budget |
| `bounds` | world-space box the exhibit owns |
| `anchor` | world position of its hero object |
| `interaction` | primary verb; optional secondary verb |
| `activationRadius` | metres at which the exhibit activates |
| `audioZone` | ambient zone identifier |
| `streamingGroup` | which Layer-3 payload group it belongs to |
| `budgetMB` | transfer budget: A ≤ 15, B ≤ 8, C ≤ 4 |

## Interaction vocabulary

Every exhibit gets **one primary** and **at most one secondary** verb, drawn from a shared set
(plan §16), implemented once in `src/interaction/` and reused:

`inspect` · `manipulate` · `configure` · `simulate` · `construct` · `navigate` · `sequence` · `listen`

Differentiation comes from presentation and content, never from a bespoke input system.

## Minimum quality bar

An exhibit is not complete until all seven hold:

1. **Physical presence** — a real 3D hero object with volume, not a plane or a card.
2. **Meaningful interaction** — the primary verb changes something the visitor can see.
3. **Interpretation** — plaque (10 s) and lectern (60 s) exist and are project-first.
4. **Deeper material** — accessible DOM panel with history, decisions, and status.
5. **Accessible equivalent** — every visitor-facing string reachable by keyboard, in the DOM.
6. **Streaming** — loads on approach, unloads on departure, no visible transition.
7. **Disposal** — resource scope returns to zero; reset is deterministic.

## Reset determinism

`reset()` must produce a state indistinguishable from the state immediately after the first
`activate()`. Tested in `tests/exhibits.reset.test.ts` for every registered exhibit.
