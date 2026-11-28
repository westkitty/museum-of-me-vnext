# W02 Prehistoric Fern Island — route and first slice

State: **development topology, first slice in progress; production dormant**. Base: `origin/feat/visual-finishing-20261125` at `3b59e96`. The W01 integration candidate remains separate and uncommitted. This layout applies the accepted W02 direction in the [world roster](WORLD_EXPANSION_WORLD_ROSTER_20261121.json) and [Batch B contract](POCKET_WORLD_COMPATIBILITY_BATCHES_20261122.md); it is not an owner-approved final map.

## Spatial sketch

The destination keeps the source island's clockwise coastline outline, scaled to a short walk. The western Fern Ravine corresponds to the arrival side. The ancient island has no museum building; a distant coastal ridge keeps its east/west relationship legible. The Veiled Gorge cuts north–south through the route and cannot be bypassed by walking through visual terrain.

```text
                    NORTH / ancient coastal ridge
       optional fossil loop ─┐
                             ▼
WEST COAST  arrival → giant ferns → broad root climb → rest shelf
                                                  checkpoint │
                                                     root seed│
                                     VEILED GORGE  ║  bridge grows east
                                                   ║       ↓
                                                   ║ east shelf → high switchback
                                                   ║                  ↓
                                                   ║          landmark vista / finale
                    SOUTH / recognizable island shore
```

Vertical route: arrival ground `y=0`; a 15 m long, 12 m wide ramp rises to a `y=2` root shelf; a wide bridge spans the gorge at `y=2`; the eastern route climbs by broad ramps and resting shelves to the eventual high vista. No narrow or mandatory precision jumps. A missed crossing returns to the latest supported checkpoint. The optional fossil loop reconnects before the root climb and cannot block completion.

## Three acts and learning progression

1. **Arrival / ancient island recognition:** west coast and giant fern shade; player sees the same coastline relationship as the main island. Discover the broad climb and optional fossil loop.
2. **Roots / Veiled Gorge:** reach a supported rest shelf, interact with a root seed, and watch a wide traversable root bridge grow. This is the first mechanical reversal: the chasm changes from barrier to route. The first slice implements and tests this beat.
3. **Elevated discovery:** follow a switchback with resting shelves to an overlook that reveals the ancient island. The full route will give the vista a substantial visual and interactive finale, then award W02 only after the visitor reaches it.

## Next implementation steps

1. Bind a dormant inspection marker to the verified western Fern Ravine approach; enable W02 only behind `?preview=w02` on the development server.
2. Build and headlessly verify the source-shaped island floor, first broad climb, rest checkpoint, root-seed interaction, bridge collider and reset/return lifecycle. The preview must not award a stamp.
3. Extend the eastern switchback, optional reconnecting fossil route, giant vegetation, vista reveal, completion and ten-visit resource checks. Exercise keyboard, touch, reduced motion, load failure and unaided visitor traversal.
4. Integrate with W01 only after its candidate is settled; retain W01→W02 production order. Measure lazy transfer and in-world Apple M1 performance headlessly, obtain owner visual acceptance, then consider production readiness.
