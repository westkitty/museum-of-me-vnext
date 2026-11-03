import type { Vec3 } from './layout';
import { LAND_SUPPORT_Y, PIER_CENTERLINE } from './exterior/IslandSiteLayout';

/**
 * Authoritative exterior visitor start: on the south arrival pier, facing
 * north toward the museum. Keep it outside the entrance prompt (z <= 154)
 * and prewarm (z <= 134) volumes. The pier owns safe floor support here.
 */
const pierStart = PIER_CENTERLINE[2];
export const START_POSITION: Vec3 = [pierStart[0], LAND_SUPPORT_Y, pierStart[1]];
export const START_YAW = 0;
