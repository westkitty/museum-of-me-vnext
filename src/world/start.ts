import { ZONE_BY_ID, type Vec3 } from './layout';

/**
 * The visitor begins outside, in the centre of the authored arrival plaza, and
 * faces north toward the museum entrance. The position is derived from
 * `layout.ts` so runtime spawn, maps, zones, collision and wayfinding stay in
 * agreement as the exterior evolves.
 */
export const START_POSITION: Vec3 = ZONE_BY_ID.get('plaza')!.center;
export const START_YAW = 0;
