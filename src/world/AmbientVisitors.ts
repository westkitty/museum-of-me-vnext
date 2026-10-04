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
  readonly speed: number;
  readonly mixer: THREE.AnimationMixer;
  readonly walk: THREE.AnimationAction;
  t: number;
  farElapsed: number;
}

interface Observer { readonly mesh: THREE.Group; }
const AMBIENT_MIXER_INTERVAL = 1 / 30;
const FAR_AMBIENT_DISTANCE_SQ = 70 * 70;
const FAR_AMBIENT_UPDATE_INTERVAL = 0.1;
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

  /** Called from the existing single owner loop. */
  update(dt: number, reducedMotion: boolean, viewerX?: number, viewerZ?: number): void {
    if (this.motionFrozen !== reducedMotion) this.setMotionFrozen(reducedMotion);
    if (reducedMotion) {
      this.mixerElapsed = 0;
      return;
    }
    this.mixerElapsed += dt;
    const mixerStep = this.mixerElapsed >= AMBIENT_MIXER_INTERVAL ? this.mixerElapsed : 0;
    if (mixerStep > 0) this.mixerElapsed = 0;
    for (const walker of this.walkers) {
      const n = walker.path.length;
      walker.t = (walker.t + dt * walker.speed * 0.04) % 1;

      let far = false;
      if (viewerX !== undefined && viewerZ !== undefined) {
        const dxView = walker.mesh.position.x - viewerX;
        const dzView = walker.mesh.position.z - viewerZ;
        far = dxView * dxView + dzView * dzView > FAR_AMBIENT_DISTANCE_SQ;
        if (far) {
          walker.farElapsed += dt;
          if (walker.farElapsed + Number.EPSILON * 8 < FAR_AMBIENT_UPDATE_INTERVAL) continue;
        }
      }

      const scaled = walker.t * n;
      const index = Math.floor(scaled);
      const fraction = scaled - index;
      const a = walker.path[index % n];
      const b = walker.path[(index + 1) % n];
      walker.mesh.position.set(
        a[0] + (b[0] - a[0]) * fraction,
        a[1] + (b[1] - a[1]) * fraction,
        a[2] + (b[2] - a[2]) * fraction,
      );
      walker.mesh.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
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
      this.walkers.push({ mesh, path, speed: 0.5 + random() * 0.3, mixer, walk, t: random(), farElapsed: 0 });
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
      mesh.position.set(placement.visitorSpot[0], placement.visitorSpot[1], placement.visitorSpot[2]);
      mesh.rotation.y = Math.atan2(-placement.facing[0], -placement.facing[2]);
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
      walker.mesh.removeFromParent();
    }
    for (const observer of this.observers) observer.mesh.removeFromParent();
    this.walkers.length = 0;
    this.observers.length = 0;
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
