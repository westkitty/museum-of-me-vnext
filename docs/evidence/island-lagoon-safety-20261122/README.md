# Island safety: east lagoon fall/rescue loop (2026-11-22)

**Reproduced (real browser, main `a358b66`).** A visitor holding W toward the
east lagoon from the west bank left support at x ≈ 63 and fell through the
floorless basin. The fall safety net in `PlayerController` lifted them to
`y = support ?? 0` at the same x/z. Over open water that is `y = 0` over the
same hole, so the fall restarted every ~2.5 s: 13 rescues in 30 s, never
grounded. The only way out was steering back to land in mid-air.

**Fix**
- `addLagoonEdge` (`IslandSiteLayout.ts`): 12 oriented wall colliders along
  `LAGOON_OUTLINE`, 1.4 m high (above the 1.18 m jump apex), registered by
  `ExteriorWorld` after island support. Walking or running at the water now
  stops on the bank. The water itself stays unsupported: no fake floor.
- `PlayerController` safety net: returns the visitor to the last spot they
  stood on real support (updated while grounded, and on teleport). Anything
  that still puts a visitor over the water, such as a flight exit, gives
  exactly one rescue to dry land, and no loop is possible anywhere.

**Tests**
- `tests/lagoon-edge-safety.test.ts`: from 2 m on the land side of every
  shoreline segment (t = 0.1 / 0.5 / 0.9), a capsule walking straight at the
  water in 5 cm steps never enters the lagoon and ends on supported land. Open
  water stays unsupported.
- `tests/browser/island-lagoon-safety.e2e.ts` (real keyboard, reduced motion):
  - Four banks (west, south-west, north, east): zero rescues, min y −0.5,
    grounded on land.
  - Placed over open water after standing on the west bank: exactly one
    rescue to (50, −0.5, 8), then a keyboard walk back toward the island path.
- Passage proof `passage-traversal` (57 passages / 169 lanes) and
  `island-landmark-walk` still pass.

W01 Lagoon Depths will add a deliberate dive interaction at the bank. The edge
does not prevent that.
