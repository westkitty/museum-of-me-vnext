import { PLACEMENTS, WINGS } from './layout';

/** Clearance kept between hall decor and the edge of a bay doorway (m). */
export const BAY_OPENING_CLEARANCE = 1.3;

/**
 * Nearest position along a hall, on one side, that stands against solid wall
 * rather than in a bay opening. Bay openings are where visitors turn into an
 * exhibit and where the guide's floor line ends; no hall decor stands there.
 */
export function alongClearOfBayOpenings(wing: (typeof WINGS)[number], along: number, side: -1 | 1): number {
  const centres = PLACEMENTS
    .filter((placement) => placement.wing === wing.id && (placement.side === 'right' ? 1 : -1) === side)
    .map((placement) => wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch);
  const keep = wing.bayOpening / 2 + BAY_OPENING_CLEARANCE;
  const clear = (value: number) => value >= wing.hallFrom + 1.5 && value <= wing.hallTo - 1.5
    && centres.every((centre) => Math.abs(value - centre) >= keep);
  for (let offset = 0; offset <= wing.bayPitch; offset += 0.25) {
    if (clear(along + offset)) return along + offset;
    if (clear(along - offset)) return along - offset;
  }
  return along;
}
