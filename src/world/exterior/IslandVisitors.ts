import * as THREE from 'three';
import type { AssetManager } from '../../assets/AssetManager';
import { ResourceScope } from '../../assets/ResourceScope';
import type { QualityTier } from '../../render/QualityTiers';
import type { CollisionWorld } from '../CollisionWorld';
import { EYE_HEIGHT } from '../../player/PlayerController';
import type { Vec3 } from '../layout';
import { LAND_SUPPORT_Y } from './IslandSiteLayout';
import { ROOF_DECK_Y } from './rooftopLayout';
import { applyHotDogManPose, faceAvatar, findHotDogManRig, fitAvatar } from './HotDogManPose';

interface VisitorPlacement {
  readonly id: string;
  readonly spot: Vec3;
  readonly facing: number;
  readonly height: number;
}

export const ISLAND_VISITORS: readonly VisitorPlacement[] = [
  // Café customer, wind sculpture observer, meadow visitor, ravine walker,
  // tidepool watcher, stone circle observer, and reflecting-rill visitor.
  { id: 'island-coffee', spot: [-5.0, ROOF_DECK_Y, 33.5], facing: Math.PI / 2, height: 1.63 },
  { id: 'island-robothead', spot: [43.5, LAND_SUPPORT_Y, 104.5], facing: Math.PI / 8, height: 1.86 },
  { id: 'island-carrot-kid', spot: [-55, LAND_SUPPORT_Y, 117.5], facing: Math.PI, height: 1.48 },
  { id: 'island-cactusboy', spot: [-135.5, LAND_SUPPORT_Y, -2.5], facing: -Math.PI / 3, height: 1.77 },
  { id: 'island-froggy', spot: [130.5, LAND_SUPPORT_Y, 44], facing: -Math.PI / 2, height: 1.56 },
  { id: 'island-eyewizard', spot: [-58.5, LAND_SUPPORT_Y, -116], facing: Math.PI / 2, height: 1.92 },
  { id: 'island-goldfish-bag-person', spot: [-3.5, 0, 148.5], facing: Math.PI / 3, height: 1.77 },
];

const LOAD_RADIUS: Record<QualityTier, number> = { low: 20, medium: 28, high: 36 };
const RELEASE_MARGIN = 10;

/** Optional exterior residents with locally posed rigs and per-visitor asset leases. */
export class IslandVisitors {
  readonly group = new THREE.Group();
  private readonly leases = new Map<string, ResourceScope>();
  private readonly failed = new Set<string>();

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
    private tier: QualityTier,
    private readonly assets?: Pick<AssetManager, 'load'>,
  ) {
    this.group.name = 'island-visitors';
    scope.track({ dispose: () => this.clear() });
  }

  setQuality(tier: QualityTier): void {
    this.tier = tier;
  }

  update(eye: Vec3): void {
    if (!this.assets || this.scope.isDisposed) return;
    const loadRadius = LOAD_RADIUS[this.tier];
    for (const visitor of ISLAND_VISITORS) {
      const [x, y, z] = visitor.spot;
      const distance = Math.hypot(eye[0] - x, eye[1] - y - EYE_HEIGHT, eye[2] - z);
      const lease = this.leases.get(visitor.id);
      if (lease && distance > loadRadius + RELEASE_MARGIN) {
        lease.dispose();
        this.leases.delete(visitor.id);
      } else if (!lease && distance <= loadRadius && !this.failed.has(visitor.id)) {
        void this.load(visitor, this.assets);
      }
    }
  }

  clear(): void {
    for (const lease of this.leases.values()) lease.dispose();
    this.leases.clear();
  }

  private async load(visitor: VisitorPlacement, assets: Pick<AssetManager, 'load'>): Promise<void> {
    const [x, y, z] = visitor.spot;
    const floor = this.collision.supportHeight(x, z, y, 0.5);
    if (floor === null) {
      this.failed.add(visitor.id);
      return;
    }
    const scope = new ResourceScope(visitor.id);
    this.leases.set(visitor.id, scope);
    try {
      const { object } = await assets.load(visitor.id, scope);
      if (scope.isDisposed) return;
      const rig = findHotDogManRig(object);
      if (!rig) throw new Error('Missing required avatar bones');
      fitAvatar(object, visitor.height);
      object.position.x += x;
      object.position.y += floor;
      object.position.z += z;
      faceAvatar(rig, visitor.facing);
      applyHotDogManPose(rig, { time: 0, serve: 0, breathe: false });
      object.name = visitor.id;
      this.group.add(object);
    } catch (error) {
      if (scope.isDisposed) return;
      scope.dispose();
      this.leases.delete(visitor.id);
      this.failed.add(visitor.id);
      console.warn(`[IslandVisitors] ${visitor.id} unavailable`, error);
    }
  }
}
