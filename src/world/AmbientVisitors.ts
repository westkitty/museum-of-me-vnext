import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AssetManager, LoadedAsset } from '../assets/AssetManager';
import { QUATERNIUS_ASSET_IDS } from '../assets/quaterniusAssets';
import type { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENT_BY_EXHIBIT, WINGS, faceDirection, place, ROTUNDA_APOTHEM, GROUND_Y, LEVEL_1_Y, type Vec3 } from './layout';
import { rng } from '../assets/generators';

interface Walker {
  readonly mesh: THREE.Group;
  readonly path: readonly Vec3[];
  /** Ground speed in metres per second. */
  readonly speed: number;
  /** Seconds this walker lingers at each route corner. */
  readonly pauses: readonly number[];
  readonly mixer: THREE.AnimationMixer;
  readonly walk: THREE.AnimationAction;
  /** Seconds into the walker's looping route timeline. */
  clock: number;
  farElapsed: number;
}

/** Comfortable gallery walking pace that matches the Walk clip's stride (m/s). */
export const AMBIENT_WALK_SPEED: readonly [number, number] = [1.0, 1.3];
/** How far an exhibit observer sits to one side of the visitor's viewing spot (m). */
export const OBSERVER_SIDE_OFFSET = 1.8;

export interface WalkerPose {
  readonly x: number; readonly y: number; readonly z: number;
  readonly yaw: number;
  readonly moving: boolean;
}

/**
 * Pose on a looping walker route at `time` seconds: constant ground speed
 * along every leg (arc length, not leg count), a pause at each corner, and
 * the turn to the next heading made smoothly during that pause.
 *
 * The former parameterisation gave every leg the same duration regardless of
 * its length, so walkers raced along long hall legs and crept along short
 * ones while the Walk clip played at one rate — and snapped their heading at
 * every corner.
 */
export function walkerPoseAt(path: readonly Vec3[], speed: number, pauses: readonly number[], time: number): WalkerPose {
  const n = path.length;
  const legs = path.map((a, i) => {
    const b = path[(i + 1) % n];
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) };
  });
  const cycle = legs.reduce((sum, leg, i) => sum + leg.length / speed + (pauses[i % pauses.length] ?? 0), 0);
  let t = cycle > 0 ? ((time % cycle) + cycle) % cycle : 0;
  for (let i = 0; i < n; i++) {
    const leg = legs[i];
    const walk = leg.length / speed;
    if (t < walk) {
      const f = walk > 0 ? t / walk : 1;
      return {
        x: leg.a[0] + (leg.b[0] - leg.a[0]) * f,
        y: leg.a[1] + (leg.b[1] - leg.a[1]) * f,
        z: leg.a[2] + (leg.b[2] - leg.a[2]) * f,
        yaw: leg.yaw, moving: true,
      };
    }
    t -= walk;
    const pause = pauses[i % pauses.length] ?? 0;
    if (t < pause) {
      const next = legs[(i + 1) % n].yaw;
      let delta = next - leg.yaw;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const u = Math.min(1, t / Math.min(pause, 1.2));
      return { x: leg.b[0], y: leg.b[1], z: leg.b[2], yaw: leg.yaw + delta * u * u * (3 - 2 * u), moving: false };
    }
    t -= pause;
  }
  const last = legs[n - 1];
  return { x: last.b[0], y: last.b[1], z: last.b[2], yaw: legs[0].yaw, moving: false };
}

/**
 * Where an exhibit observer sits: beside, not on, the spot the guide route
 * delivers the visitor to, and turned toward the exhibit. Observers used to
 * be placed exactly on `visitorSpot`, so a guided visitor arrived inside one.
 */
export function observerSpot(placement: { readonly visitorSpot: Vec3; readonly anchor: Vec3; readonly facing: Vec3 }): { position: Vec3; yaw: number } {
  const [fx, , fz] = placement.facing;
  const position: Vec3 = [
    placement.visitorSpot[0] - fz * OBSERVER_SIDE_OFFSET,
    placement.visitorSpot[1],
    placement.visitorSpot[2] + fx * OBSERVER_SIDE_OFFSET,
  ];
  return { position, yaw: Math.atan2(placement.anchor[0] - position[0], placement.anchor[2] - position[2]) };
}

interface Observer { readonly mesh: THREE.Group; }
const AMBIENT_MIXER_INTERVAL = 1 / 30;
const FAR_AMBIENT_DISTANCE_SQ = 70 * 70;
const FAR_AMBIENT_UPDATE_INTERVAL = 0.1;
const AMBIENT_VISIBILITY_SQ = 150 * 150;
type AmbientAssetLoader = Pick<AssetManager, 'load'>;
interface VisitorPrototypes {
  readonly men: LoadedAsset;
  readonly women: LoadedAsset;
  readonly posed: LoadedAsset;
}

/** A bounded, deterministic population of Quaternius visitors. Routes stay authored here. */
export class AmbientVisitors {
  readonly group = new THREE.Group();
  private readonly walkers: Walker[] = [];
  private readonly observers: Observer[] = [];
  private targetCount: number;
  private loading = 0;
  private motionFrozen = false;
  private mixerElapsed = 0;
  private prototypes: VisitorPrototypes | null = null;
  loadError: Error | null = null;

  constructor(private readonly scope: ResourceScope, count: number) {
    this.group.name = 'ambient-visitors';
    this.targetCount = Math.max(0, count);
  }

  get count(): number { return this.targetCount; }
  get ready(): boolean { return this.targetCount === 0 || this.residentCount === this.targetCount; }
  get residentCount(): number { return this.walkers.length + this.observers.length; }

  positions(): Array<{ id: string; x: number; y: number; z: number; kind: 'ambient' }> {
    return [
      ...this.walkers.map((visitor, index) => ({
        id: `ambient-walker:${index}`,
        x: visitor.mesh.position.x,
        y: visitor.mesh.position.y,
        z: visitor.mesh.position.z,
        kind: 'ambient' as const,
      })),
      ...this.observers.map((visitor, index) => ({
        id: `ambient-observer:${index}`,
        x: visitor.mesh.position.x,
        y: visitor.mesh.position.y,
        z: visitor.mesh.position.z,
        kind: 'ambient' as const,
      })),
    ];
  }

  /** Load governed prototypes, then clone skinned visitors without shared-skeleton corruption. */
  async setPopulation(loader: AmbientAssetLoader, count: number): Promise<void> {
    this.targetCount = Math.max(0, count);
    const token = ++this.loading;
    this.clearPopulation();
    this.loadError = null;
    delete this.group.userData.loadError;
    if (this.targetCount === 0) return;

    try {
      const prototypes = this.prototypes ?? await this.loadPrototypes(loader);
      if (token !== this.loading || this.scope.isDisposed) return;
      this.prototypes = prototypes;
      this.populate(prototypes.men, prototypes.women, prototypes.posed);
      this.setMotionFrozen(this.motionFrozen);
    } catch (error) {
      if (token !== this.loading) return;
      this.loadError = error instanceof Error ? error : new Error(String(error));
      this.group.userData.loadError = this.loadError.message;
      this.clearPopulation();
      throw this.loadError;
    }
  }

  /**
   * Fetches and parses the visitor models ahead of time, without adding anyone
   * to the scene, so populating on entry does not parse 5 MB of GLB mid-walk.
   */
  async preloadPrototypes(loader: AmbientAssetLoader): Promise<readonly THREE.Object3D[]> {
    this.prototypes ??= await this.loadPrototypes(loader);
    return [this.prototypes.men.object, this.prototypes.women.object, this.prototypes.posed.object];
  }

  /** Called from the existing single owner loop. */
  update(dt: number, reducedMotion: boolean, viewerX?: number, viewerZ?: number): void {
    if (this.motionFrozen !== reducedMotion) this.setMotionFrozen(reducedMotion);
    if (reducedMotion) {
      this.mixerElapsed = 0;
      return;
    }
    this.mixerElapsed += dt;
    if (viewerX !== undefined && viewerZ !== undefined) {
      for (const observer of this.observers) {
        const dx = observer.mesh.position.x - viewerX;
        const dz = observer.mesh.position.z - viewerZ;
        observer.mesh.visible = dx * dx + dz * dz <= AMBIENT_VISIBILITY_SQ;
      }
    }
    const mixerStep = this.mixerElapsed >= AMBIENT_MIXER_INTERVAL ? this.mixerElapsed : 0;
    if (mixerStep > 0) this.mixerElapsed = 0;
    for (const walker of this.walkers) {
      walker.clock += dt;

      let far = false;
      if (viewerX !== undefined && viewerZ !== undefined) {
        const dxView = walker.mesh.position.x - viewerX;
        const dzView = walker.mesh.position.z - viewerZ;
        const distanceSq = dxView * dxView + dzView * dzView;
        walker.mesh.visible = distanceSq <= AMBIENT_VISIBILITY_SQ;
        far = distanceSq > FAR_AMBIENT_DISTANCE_SQ;
        if (far) {
          walker.farElapsed += dt;
          if (walker.farElapsed + Number.EPSILON * 8 < FAR_AMBIENT_UPDATE_INTERVAL) continue;
        }
      }

      const pose = walkerPoseAt(walker.path, walker.speed, walker.pauses, walker.clock);
      walker.mesh.position.set(pose.x, pose.y, pose.z);
      walker.mesh.rotation.y = pose.yaw;
      // Stand still (no stride) while lingering at a corner.
      walker.walk.paused = !pose.moving;
      // Near visitors retain the 30 Hz pose cadence. Far visitors coarse-step
      // both transform and skeleton work at 10 Hz, with accumulated time so
      // their route/animation state still advances while off-screen.
      if (far) {
        walker.mixer.update(walker.farElapsed);
        walker.farElapsed = 0;
      } else {
        if (walker.farElapsed > 0) {
          walker.mixer.update(walker.farElapsed);
          walker.farElapsed = 0;
        }
        if (mixerStep > 0) walker.mixer.update(mixerStep);
      }
    }
  }

  dispose(): void {
    this.loading += 1;
    this.clearPopulation();
    this.prototypes = null;
    this.group.removeFromParent();
    this.group.clear();
  }

  private populate(men: LoadedAsset, women: LoadedAsset, posed: LoadedAsset): void {
    const random = rng(90909);
    const walkerCount = Math.max(1, this.targetCount - Math.min(3, Math.floor(this.targetCount / 2)));
    for (let index = 0; index < walkerCount; index++) {
      const source = index % 2 === 0 ? men : women;
      const mesh = cloneSkeleton(source.object) as THREE.Group;
      mesh.name = `ambient-walker:${index}`;
      const path = this.authorPath(index, random);
      mesh.position.set(path[0][0], path[0][1], path[0][2]);
      const clip = source.animations.find((animation) => animation.name === 'Walk');
      if (!clip) throw new Error(`Quaternius walker asset "${source.id}" has no verified Walk clip`);
      const mixer = new THREE.AnimationMixer(mesh);
      const walk = mixer.clipAction(clip);
      walk.play();
      this.group.add(mesh);
      const speed = AMBIENT_WALK_SPEED[0] + random() * (AMBIENT_WALK_SPEED[1] - AMBIENT_WALK_SPEED[0]);
      const pauses = path.map(() => 1.2 + random() * 3.3);
      const clock = random() * 60;
      const start = walkerPoseAt(path, speed, pauses, clock);
      mesh.position.set(start.x, start.y, start.z);
      mesh.rotation.y = start.yaw;
      // Match stride to ground speed so feet do not slide (clip authored near 1.15 m/s).
      walk.timeScale = speed / 1.15;
      this.walkers.push({ mesh, path, speed, pauses, mixer, walk, clock, farElapsed: 0 });
    }

    const exhibitIds = ['E02', 'E04', 'E05', 'E06'];
    const observerCount = this.targetCount - walkerCount;
    for (let index = 0; index < observerCount; index++) {
      const placement = PLACEMENT_BY_EXHIBIT.get(exhibitIds[index % exhibitIds.length]);
      if (!placement) continue;
      const mesh = cloneSkeleton(posed.object) as THREE.Group;
      mesh.name = `ambient-exhibit-observer:${placement.exhibitId}`;
      // The source FBX uses centimetres; inspected height is normalized to ~1.8 m.
      mesh.scale.setScalar(0.006);
      const spot = observerSpot(placement);
      mesh.position.set(spot.position[0], spot.position[1], spot.position[2]);
      mesh.rotation.y = spot.yaw;
      this.group.add(mesh);
      this.observers.push({ mesh });
    }
  }

  private async loadPrototypes(loader: AmbientAssetLoader): Promise<VisitorPrototypes> {
    const [men, women, posed] = await Promise.all([
      loader.load(QUATERNIUS_ASSET_IDS.menCasual, this.scope),
      loader.load(QUATERNIUS_ASSET_IDS.womenCasual, this.scope),
      loader.load(QUATERNIUS_ASSET_IDS.posedSitting, this.scope),
    ]);
    return { men, women, posed };
  }

  private setMotionFrozen(frozen: boolean): void {
    this.motionFrozen = frozen;
    for (const walker of this.walkers) {
      if (frozen) {
        walker.walk.paused = true;
        walker.mixer.setTime(0);
      } else {
        walker.walk.paused = false;
      }
    }
  }

  private clearPopulation(): void {
    for (const walker of this.walkers) {
      walker.mixer.stopAllAction();
      walker.mixer.uncacheRoot(walker.mesh);
      this.releaseActor(walker.mesh);
    }
    for (const observer of this.observers) this.releaseActor(observer.mesh);
    this.walkers.length = 0;
    this.observers.length = 0;
  }

  private releaseActor(root: THREE.Object3D): void {
    // Population clones share leased prototype geometry/materials, but own
    // skeleton bone textures created by the renderer. Release only those.
    const skeletons = new Set<THREE.Skeleton>();
    root.traverse((node) => {
      const mesh = node as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
    });
    for (const skeleton of skeletons) skeleton.dispose();
    root.removeFromParent();
  }

  private authorPath(index: number, random: () => number): Vec3[] {
    const ground = WINGS.filter((wing) => wing.level === 0);
    const upper = WINGS.filter((wing) => wing.level === 1);
    if (index % 3 === 0) {
      const radius = 9 + random() * 3;
      return Array.from({ length: 8 }, (_, point) => {
        const angle = (point / 8) * Math.PI * 2;
        return [Math.sin(angle) * radius, GROUND_Y, Math.cos(angle) * radius] as Vec3;
      });
    }
    if (index % 5 === 4 && upper.length > 0) {
      const wing = upper[index % upper.length];
      const direction = faceDirection(wing.face);
      return [
        place(direction, ROTUNDA_APOTHEM - 3, 0, LEVEL_1_Y),
        place(direction, wing.hallFrom + 4, 0, LEVEL_1_Y),
        place(direction, wing.hallTo - 4, 0, LEVEL_1_Y),
        place(direction, wing.hallFrom + 4, 0, LEVEL_1_Y),
      ];
    }
    const wing = ground[index % ground.length];
    const direction = faceDirection(wing.face);
    const lateral = (random() - 0.5) * wing.hallHalfWidth * 0.7;
    return [
      place(direction, ROTUNDA_APOTHEM + 3, lateral, GROUND_Y),
      place(direction, wing.hallFrom + 10, lateral, GROUND_Y),
      place(direction, Math.min(wing.hallTo - 6, wing.hallFrom + 40), lateral, GROUND_Y),
      place(direction, wing.hallFrom + 10, -lateral, GROUND_Y),
    ];
  }
}
