import type * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { AssetManager } from '../../assets/AssetManager';
import type { AudioManager } from '../../audio/AudioManager';
import type { InteractionManager } from '../../interaction/InteractionManager';
import type { InputManager } from '../../player/Input';
import type { PlayerController } from '../../player/PlayerController';
import type { QualitySettings } from '../../render/QualityTiers';
import type { CollisionWorld } from '../CollisionWorld';
import type { Vec3 } from '../layout';

export const STAMPED_WORLD_IDS = [
  'W01', 'W02', 'W03', 'W04', 'W05',
  'W06', 'W07', 'W08', 'W09', 'W10',
] as const;

export type StampedWorldId = (typeof STAMPED_WORLD_IDS)[number];

export type BonusWorldId = 'L01';

export type PocketWorldId = StampedWorldId | BonusWorldId;

export const ALL_POCKET_WORLD_IDS: readonly PocketWorldId[] = [
  'W01', 'W02', 'W03', 'W04', 'W05',
  'W06', 'W07', 'W08', 'W09', 'L01', 'W10',
] as const;

export type HostWorldId = 'exterior' | 'interior';

export type PocketReadiness = 'dormant' | 'verified';

export type CameraRigMode = 'first-person' | 'third-person-dexter';

export interface SafeAnchor {
  readonly hostWorld: HostWorldId;
  readonly position: Vec3;
  readonly yaw: number;
  readonly pitch: number;
}

export interface PocketWorldMeta {
  readonly id: PocketWorldId;
  readonly title: string;
  readonly entryDescription: string;
  readonly stampSlot: number | null;
  readonly isBonus: boolean;
  readonly requiresStampCount: number;
  readonly cameraMode: CameraRigMode;
  readonly readiness: PocketReadiness;
  readonly dormantHint: string;
  readonly returnAnchor: SafeAnchor;
}

export interface PocketExitOptions {
  readonly completed?: boolean;
  readonly viaVhsRewind?: boolean;
  readonly reason?: 'back' | 'completed' | 'abort' | 'reset';
}

export interface PocketWorldContext {
  readonly worldId: PocketWorldId;
  readonly scope: ResourceScope;
  readonly root: THREE.Group;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly collision: CollisionWorld;
  readonly player: PlayerController;
  readonly input: InputManager;
  readonly interaction: InteractionManager;
  readonly audio: AudioManager;
  readonly assets: AssetManager;
  readonly quality: QualitySettings;
  readonly signal: AbortSignal;
  reducedMotion(): boolean;
  announce(message: string, seconds?: number): void;
  /** Mark the current run eligible for completion when exiting with `completed: true`. */
  markCompletionEligible(): void;
  /** Complete this pocket world and return safely to the museum. */
  requestComplete(): void;
  /** Exit without awarding a stamp (defaults to VHS-rewind transition). */
  requestExit(opts?: PocketExitOptions): void;
}

export interface PocketWorldInstance {
  readonly spawnPosition: Vec3;
  readonly spawnYaw: number;
  readonly spawnPitch?: number;
  readonly cameraMode?: CameraRigMode;
  readonly fog?: THREE.Fog | THREE.FogExp2 | null;
  readonly background?: THREE.Color | THREE.Texture | null;
  readonly fieldOfView?: number;
  readonly keepMuseumSky?: boolean;
  readonly keepMuseumLighting?: boolean;
  fixedUpdate?(dt: number, eye: readonly [number, number, number]): void;
  variableUpdate?(dt: number, eye: readonly [number, number, number]): void;
  dispose?(): void;
}

export type PocketWorldFactory = (
  ctx: PocketWorldContext,
  signal: AbortSignal,
) => PocketWorldInstance | Promise<PocketWorldInstance>;

export interface PocketWorldDefinition extends PocketWorldMeta {
  readonly load?: PocketWorldFactory;
}

export const POCKET_PORTAL_CONTROL_PREFIX = 'pocket-portal:';

/** Non-exhibit portal anchors must never pollute the museum visit journal. */
export function isPocketPortalControlId(id: string): boolean {
  return (
    id === 'lighthouse-lens-l01'
    || id === 'observatory-orrery-w09'
    || id.startsWith(POCKET_PORTAL_CONTROL_PREFIX)
  );
}

export function isStampedWorldId(id: string): id is StampedWorldId {
  return (STAMPED_WORLD_IDS as readonly string[]).includes(id);
}

export function isPocketWorldId(id: string): id is PocketWorldId {
  return (ALL_POCKET_WORLD_IDS as readonly string[]).includes(id);
}
