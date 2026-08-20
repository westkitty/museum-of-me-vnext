import type * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { Tier, WingId, ExhibitRecord, ProjectRecord } from '../content/types';
import type { Vec3, Box } from '../world/layout';

/** The interaction vocabulary (plan §16). Shared primitives, varied presentation. */
export type InteractionVerb =
  | 'inspect' | 'manipulate' | 'configure' | 'simulate'
  | 'construct' | 'navigate' | 'sequence' | 'listen';

export interface ExhibitDefinition {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly wing: WingId;
  readonly tier: Tier;
  readonly projectIds: readonly string[];
  readonly bounds: Box;
  readonly anchor: Vec3;
  /** Primary verb, and at most one secondary. */
  readonly interaction: InteractionVerb;
  readonly secondaryInteraction?: InteractionVerb;
  /** Metres from the anchor at which the exhibit becomes active. */
  readonly activationRadius: number;
  readonly audioZone: string;
  readonly streamingGroup: string;
  /** Transfer budget in MB. Tier A ≤ 15, B ≤ 8, C ≤ 4. */
  readonly budgetMB: number;
}

/** Everything an exhibit is allowed to touch. It gets nothing else. */
export interface ExhibitContext {
  /** The group this exhibit owns. Adding anywhere else is a contract violation. */
  readonly group: THREE.Group;
  /** Allocation scope. Everything the module creates must be tracked here. */
  readonly scope: ResourceScope;
  readonly record: ExhibitRecord;
  readonly projects: readonly ProjectRecord[];
  /** Visitor accessibility preferences the module must honour. */
  readonly reducedMotion: boolean;
  /** Detail multiplier from the current quality tier. */
  readonly detailScale: number;
  /** Register an interactive control. Returns a disposer. */
  readonly addControl: (control: ExhibitControl) => () => void;
  /** Announce a change to assistive technology and the subtitle line. */
  readonly announce: (message: string) => void;
  /** Load a governed asset into this exhibit's scope. */
  readonly loadAsset: (assetId: string) => Promise<THREE.Object3D>;
}

export interface ExhibitUpdateContext {
  /** Visitor eye position, world space. */
  readonly eye: Vec3;
  /** Metres from the visitor to this exhibit's anchor. */
  readonly distance: number;
  /** Seconds since this exhibit activated. */
  readonly elapsed: number;
}

/**
 * A world-space interactive control. The InteractionManager raycasts these and
 * shows the cue; the module never handles raw input.
 */
export interface ExhibitControl {
  readonly object: THREE.Object3D;
  /** Shown in the interaction cue, e.g. "Pull the thread". */
  readonly label: string;
  /** Longer description for the accessible mirror. */
  readonly description?: string;
  readonly activate: () => void;
  /** Optional drag handler, in normalised −1..1 screen delta. */
  readonly drag?: (dx: number, dy: number) => void;
}

/** Text the accessible mirror renders for this exhibit. */
export interface AccessibleExhibitContent {
  readonly heading: string;
  readonly plaque: string;
  readonly body: readonly string[];
  /** Current state of the exhibit's interaction, in words. */
  readonly state: string;
  readonly controls: readonly { label: string; description: string }[];
}

export type ExhibitState = 'unloaded' | 'loaded' | 'mounted' | 'active';

/**
 * THE FROZEN EXHIBIT CONTRACT (docs/EXHIBIT_CONTRACT.md).
 * Changing this interface requires a dedicated shared-core task.
 */
export interface ExhibitModule {
  readonly def: ExhibitDefinition;
  preload(ctx: ExhibitContext): Promise<void>;
  mount(ctx: ExhibitContext): void;
  activate(): void;
  update(dt: number, ctx: ExhibitUpdateContext): void;
  deactivate(): void;
  unmount(): void;
  dispose(): void;
  /** Return to the state immediately after the first activate(). Idempotent. */
  reset(): void;
  getAccessibleContent(): AccessibleExhibitContent;
}

export const TIER_BUDGET_MB: Record<Tier, number> = { A: 15, B: 8, C: 4 };
export const DEFAULT_ACTIVATION_RADIUS: Record<Tier, number> = { A: 16, B: 13, C: 11 };
