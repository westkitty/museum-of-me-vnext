import * as THREE from 'three';
import type { AssetManager } from '../../assets/AssetManager';
import { ResourceScope } from '../../assets/ResourceScope';
import { HOT_DOG_MAN_ASSET_ID } from '../../assets/hotDogManAssets';
import { EYE_HEIGHT } from '../../player/PlayerController';
import type { Vec3 } from '../layout';
import {
  applyHotDogManPose,
  findHotDogManRig,
  faceAvatar,
  fitAvatar,
  serveEnvelope,
  type HotDogManRig,
} from './HotDogManPose';

export type HotDogManLoader = Pick<AssetManager, 'load'>;
export type HotDogManState = 'waiting' | 'loading' | 'ready' | 'failed';

/** Distance (m) from the stand at which the model starts loading. */
export const HOT_DOG_MAN_LOAD_RADIUS = 40;
const ANIMATION_RADIUS = 18;
/** Seconds between unprompted serving gestures. */
export const HOT_DOG_MAN_SERVE_PERIOD = 9;

/**
 * ISLAND-04: Hot Dog Man operates the rooftop hot dog stand.
 *
 * Ownership: the owner-approved GLB is leased from AssetManager into the
 * rooftop's ResourceScope (prototype geometry and texture stay shared); this
 * actor owns only its skeleton clone (tracked by AssetManager) and the lit
 * materials it creates. No timers or frame loop: `update` is driven by
 * ExteriorWorld.variableUpdate. Loading is lazy and starts only when the
 * visitor comes within HOT_DOG_MAN_LOAD_RADIUS of the stand.
 */
export class HotDogMan {
  readonly group = new THREE.Group();
  private loader: HotDogManLoader | null = null;
  private stateValue: HotDogManState = 'waiting';
  private rig: HotDogManRig | null = null;
  private time = 0;
  private sinceServe = Number.POSITIVE_INFINITY;
  private untilAutoServe = 3;
  private failure: unknown = null;
  private heldServePose = false;
  private poseMoving = false;

  constructor(
    private readonly scope: ResourceScope,
    private readonly spot: Vec3,
    private readonly faceToward: Vec3,
  ) {
    this.group.name = 'rooftop-hot-dog-man';
    this.group.position.set(spot[0], spot[1], spot[2]);
  }

  get state(): HotDogManState { return this.stateValue; }
  get loadError(): unknown { return this.failure; }
  /** Current serve blend 0..1, for tests and evidence. */
  get serving(): number { return serveEnvelope(this.sinceServe); }

  /** Hand over the asset loader; loading still waits for visitor proximity. */
  setLoader(loader: HotDogManLoader): void {
    this.loader = loader;
  }

  /** Begin loading now (proximity calls this; tests may call it directly). */
  load(): Promise<void> {
    if (this.scope.isDisposed || this.stateValue !== 'waiting' || !this.loader) return Promise.resolve();
    this.stateValue = 'loading';
    const lease = this.scope.track(new ResourceScope(HOT_DOG_MAN_ASSET_ID));
    return this.loader.load(HOT_DOG_MAN_ASSET_ID, lease).then((asset) => {
      if (this.scope.isDisposed) return;
      this.install(asset.object, lease);
    }).catch((error: unknown) => {
      if (this.scope.isDisposed) return;
      lease.dispose();
      this.scope.untrack(lease);
      this.stateValue = 'failed';
      this.failure = error;
      console.warn('[HotDogMan] model unavailable', error);
    });
  }

  /** Visitor bought a hot dog: play the serving gesture now. */
  serve(): void {
    if (this.stateValue === 'ready') this.sinceServe = 0;
  }

  update(dt: number, eye: readonly [number, number, number], reducedMotion: boolean): void {
    const distance = Math.hypot(eye[0] - this.spot[0], eye[1] - this.spot[1] - EYE_HEIGHT, eye[2] - this.spot[2]);
    if (this.stateValue === 'waiting' && distance < HOT_DOG_MAN_LOAD_RADIUS) void this.load();
    if (this.scope.isDisposed || this.stateValue !== 'ready' || !this.rig) return;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;

    if (reducedMotion || distance > ANIMATION_RADIUS) {
      // No idle motion and no tweens: a held serving pose after a purchase,
      // otherwise the still idle pose.
      if (this.sinceServe < 3.2) this.sinceServe += step;
      const heldServe = distance <= ANIMATION_RADIUS && this.sinceServe < 3.2;
      if (this.poseMoving || this.heldServePose !== heldServe) {
        applyHotDogManPose(this.rig, { time: 0, serve: heldServe ? 1 : 0, breathe: false });
        this.heldServePose = heldServe;
        this.poseMoving = false;
      }
      return;
    }

    this.poseMoving = true;
    this.time += step;
    this.sinceServe += step;
    this.untilAutoServe -= step;
    if (this.untilAutoServe <= 0) {
      this.untilAutoServe = HOT_DOG_MAN_SERVE_PERIOD;
      if (this.sinceServe >= 3.2) this.sinceServe = 0;
    }
    applyHotDogManPose(this.rig, { time: this.time, serve: serveEnvelope(this.sinceServe), breathe: true });
  }

  private install(object: THREE.Object3D, lease: ResourceScope): void {
    const rig = findHotDogManRig(object);
    if (!rig) throw new Error('Hot Dog Man rig is missing required mixamorig bones');
    fitAvatar(object, 1.89);
    faceAvatar(rig, Math.atan2(this.faceToward[0] - this.spot[0], this.faceToward[2] - this.spot[2]));
    object.name = 'hot-dog-man-model';
    object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const lit = (source: THREE.Material): THREE.Material => {
        const basic = source as THREE.MeshBasicMaterial;
        const material = new THREE.MeshStandardMaterial({
          name: `${source.name || 'hot-dog-man'}-lit`,
          map: basic.map ?? null,
          color: basic.color ? basic.color.clone() : new THREE.Color(0xffffff),
          transparent: source.transparent,
          alphaTest: source.alphaTest,
          side: source.side,
          roughness: 0.82,
          metalness: 0,
          // A faint self-light keeps the costume readable on the night roof
          // without the flat glow of the source's unlit material.
          emissive: new THREE.Color(0xffffff),
          emissiveMap: basic.map ?? null,
          emissiveIntensity: 0.16,
        });
        // Only the new material is ours; the shared texture stays leased.
        lease.track(material);
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(lit) : lit(mesh.material);
    });

    this.group.add(object);
    this.rig = rig;
    this.stateValue = 'ready';
    applyHotDogManPose(rig, { time: 0, serve: 0, breathe: false });
  }
}
