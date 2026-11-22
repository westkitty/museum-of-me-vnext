import { GROUND_Y, PLACEMENT_BY_EXHIBIT, type Vec3 } from '../layout';
import {
  LAND_SUPPORT_Y,
  LIGHTHOUSE_PENINSULA_CENTER,
  OBSERVATORY_CENTER,
} from '../exterior/IslandSiteLayout';
import type { Passport } from '../../state/Passport';
import {
  ALL_POCKET_WORLD_IDS,
  isPocketWorldId,
  type PocketReadiness,
  type PocketWorldContext,
  type PocketWorldDefinition,
  type PocketWorldFactory,
  type PocketWorldId,
  type PocketWorldInstance,
  type SafeAnchor,
} from './types';

function anchor(hostWorld: SafeAnchor['hostWorld'], position: Vec3, yaw = 0, pitch = 0): SafeAnchor {
  return Object.freeze({
    hostWorld,
    position: Object.freeze([...position]) as Vec3,
    yaw,
    pitch,
  });
}

const E19_SPOT: Vec3 = PLACEMENT_BY_EXHIBIT.get('E19')?.visitorSpot ?? [0, GROUND_Y, 0];

const CANONICAL_ENTRIES: readonly PocketWorldDefinition[] = [
  {
    id: 'W01',
    title: 'Lagoon Depths',
    entryDescription: 'East lagoon water surface',
    stampSlot: 0,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'The east lagoon surface shimmers softly. Lagoon Depths (W01) is not open yet.',
    returnAnchor: anchor('exterior', [47, LAND_SUPPORT_Y, 4], -Math.PI / 2, 0),
    load: undefined,
  },
  {
    id: 'W02',
    title: 'Prehistoric Fern Island',
    entryDescription: 'Western Fern Ravine',
    stampSlot: 1,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'Deep fronds stir in the Western Fern Ravine. Prehistoric Fern Island (W02) is not open yet.',
    returnAnchor: anchor('exterior', [-134.5, LAND_SUPPORT_Y, -5.1], Math.PI / 2, 0),
    load: undefined,
  },
  {
    id: 'W03',
    title: 'Clockwork Sundial',
    entryDescription: 'Existing southwest astronomical marker terrace',
    stampSlot: 2,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'The bronze gnomon rests still in the moonlight. Clockwork Sundial (W03) is not open yet.',
    returnAnchor: anchor('exterior', [-38.5, LAND_SUPPORT_Y, 134], -Math.PI / 2, 0),
    load: undefined,
  },
  {
    id: 'W04',
    title: 'Digital Beat World',
    entryDescription: 'E19 DexTilt exhibit if verified',
    stampSlot: 3,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'The E19 display holds a steady rhythm. Digital Beat World (W04) is not open yet.',
    returnAnchor: anchor('interior', E19_SPOT, 0, 0),
    load: undefined,
  },
  {
    id: 'W05',
    title: 'Impossible Greenhouse',
    entryDescription: 'Rooftop glasshouse giant flower',
    stampSlot: 4,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'The rooftop conservatory flower sleeps folded. Impossible Greenhouse (W05) is not open yet.',
    returnAnchor: anchor('exterior', [0, GROUND_Y, 145], 0, 0),
    load: undefined,
  },
  {
    id: 'W06',
    title: 'Skyborne Gardens',
    entryDescription: 'Rooftop cafe second flight pad',
    stampSlot: 5,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'Distant floating islands hang on the horizon. Skyborne Gardens (W06) is not open yet.',
    returnAnchor: anchor('exterior', [0, GROUND_Y, 145], 0, 0),
    load: undefined,
  },
  {
    id: 'W07',
    title: 'Portal Slingshot Trials',
    entryDescription: 'Back of verified least-populated wing, under-construction testing lab',
    stampSlot: 6,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'The wing testing lab remains sealed behind calibration glass. Portal Slingshot Trials (W07) is not open yet.',
    returnAnchor: anchor('interior', [0, GROUND_Y, 0], 0, 0),
    load: undefined,
  },
  {
    id: 'W08',
    title: 'World Inside a Raindrop',
    entryDescription: 'Suspended droplet near reflecting rill',
    stampSlot: 7,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'A quiet reflection lingers on the rill. World Inside a Raindrop (W08) is not open yet.',
    returnAnchor: anchor('exterior', [-2, LAND_SUPPORT_Y, 146], Math.PI / 4, 0),
    load: undefined,
  },
  {
    id: 'W09',
    title: 'Museum Between Seconds',
    entryDescription: 'Ruined southern wooded observatory, broken orrery',
    stampSlot: 8,
    isBonus: false,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: 'The halted brass rings quiver as if waiting for your next step. The Museum Between Seconds (W09) is not open yet.',
    returnAnchor: anchor('exterior', [OBSERVATORY_CENTER[0] - 3.2, OBSERVATORY_CENTER[1], OBSERVATORY_CENTER[2]], -Math.PI / 2, 0),
    load: undefined,
  },
  {
    id: 'L01',
    title: "Lighthouse at World's End",
    entryDescription: 'Peninsula lighthouse lens',
    stampSlot: null,
    isBonus: true,
    requiresStampCount: 0,
    cameraMode: 'first-person',
    readiness: 'dormant',
    dormantHint: "The Fresnel lens sweeps the dark horizon. Its sea passage to The Lighthouse at World's End (L01) is not open yet.",
    returnAnchor: anchor('exterior', [LIGHTHOUSE_PENINSULA_CENTER[0] - 1.5, 11.5, LIGHTHOUSE_PENINSULA_CENTER[2]], -Math.PI / 2, 0),
    load: undefined,
  },
  {
    id: 'W10',
    title: 'Breath of the Weasel',
    entryDescription: 'First-earned-stamp unlocked pier NPC or rooftop second flight pad when playable',
    stampSlot: 9,
    isBonus: false,
    requiresStampCount: 1,
    cameraMode: 'third-person-dexter',
    readiness: 'dormant',
    dormantHint: 'The distant wild island rests across the water. Breath of the Weasel (W10) is not open yet.',
    returnAnchor: anchor('exterior', [0, LAND_SUPPORT_Y, 192], Math.PI, 0),
    load: undefined,
  },
];

export const CANONICAL_POCKET_WORLDS: readonly PocketWorldDefinition[] = Object.freeze(
  CANONICAL_ENTRIES.map((entry) => Object.freeze({ ...entry })),
);

export interface PocketWorldRegistrationPatch {
  readonly readiness: PocketReadiness;
  readonly load?: PocketWorldFactory;
  readonly title?: string;
  readonly entryDescription?: string;
  readonly dormantHint?: string;
  readonly returnAnchor?: SafeAnchor;
}

export type PocketEntryCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'unknown' | 'dormant' | 'missing-loader' | 'locked-stamps';
      readonly message: string;
    };

/**
 * Authoritative registry of the 10 stamped pocket worlds (`W01`..`W10`) plus
 * the 1 non-stamp bonus interlude (`L01`).
 *
 * Every world defaults to `readiness: 'dormant'` and `load: undefined`, and
 * cannot be entered unless both `readiness === 'verified'` and
 * `typeof def.load === 'function'` (plus `passport.earnedCount >= requiresStampCount`).
 */
export class PocketWorldRegistry {
  private readonly definitions = new Map<PocketWorldId, PocketWorldDefinition>();
  private readonly listeners = new Set<() => void>();

  constructor(initial: readonly PocketWorldDefinition[] = CANONICAL_POCKET_WORLDS) {
    for (const def of initial) {
      this.definitions.set(def.id, Object.freeze({ ...def }));
    }
  }

  has(id: string): id is PocketWorldId {
    return isPocketWorldId(id) && this.definitions.has(id);
  }

  get(id: PocketWorldId): PocketWorldDefinition | undefined {
    return this.definitions.get(id);
  }

  list(): readonly PocketWorldDefinition[] {
    return ALL_POCKET_WORLD_IDS
      .map((id) => this.definitions.get(id))
      .filter((def): def is PocketWorldDefinition => Boolean(def));
  }

  stampedDefinitions(): readonly PocketWorldDefinition[] {
    return this.list()
      .filter((def) => !def.isBonus && def.stampSlot !== null)
      .sort((a, b) => (a.stampSlot ?? 0) - (b.stampSlot ?? 0));
  }

  bonusDefinitions(): readonly PocketWorldDefinition[] {
    return this.list().filter((def) => def.isBonus);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Register or update a verified world implementation (used by tests and
   * staged world rollouts). Preserves canonical slot/bonus/camera invariants.
   */
  registerWorld(id: PocketWorldId, patch: PocketWorldRegistrationPatch): PocketWorldDefinition {
    const base = this.definitions.get(id);
    if (!base) throw new Error(`Unknown pocket world "${String(id)}"`);
    const updated: PocketWorldDefinition = Object.freeze({
      ...base,
      readiness: patch.readiness,
      load: patch.load,
      title: patch.title ?? base.title,
      entryDescription: patch.entryDescription ?? base.entryDescription,
      dormantHint: patch.dormantHint ?? base.dormantHint,
      returnAnchor: patch.returnAnchor
        ? anchor(
          patch.returnAnchor.hostWorld,
          patch.returnAnchor.position,
          patch.returnAnchor.yaw,
          patch.returnAnchor.pitch,
        )
        : base.returnAnchor,
    });
    this.definitions.set(id, updated);
    for (const fn of this.listeners) fn();
    return updated;
  }

  /** Reset a world back to its canonical dormant state (primarily for tests). */
  resetWorld(id: PocketWorldId): PocketWorldDefinition {
    const canonical = CANONICAL_POCKET_WORLDS.find((entry) => entry.id === id);
    if (!canonical) throw new Error(`Unknown pocket world "${String(id)}"`);
    const copy = Object.freeze({ ...canonical });
    this.definitions.set(id, copy);
    for (const fn of this.listeners) fn();
    return copy;
  }

  canEnter(id: PocketWorldId, passport?: Pick<Passport, 'earnedCount' | 'canEnterW10'>): PocketEntryCheck {
    const def = this.definitions.get(id);
    if (!def) {
      return { ok: false, reason: 'unknown', message: 'Unknown pocket world.' };
    }
    if (def.readiness !== 'verified') {
      return { ok: false, reason: 'dormant', message: def.dormantHint };
    }
    if (typeof def.load !== 'function') {
      return { ok: false, reason: 'missing-loader', message: def.dormantHint };
    }
    const earned = passport?.earnedCount ?? 0;
    if (earned < def.requiresStampCount || (id === 'W10' && !passport?.canEnterW10())) {
      return {
        ok: false,
        reason: 'locked-stamps',
        message: 'Earn at least one passport stamp in another pocket world to unlock Breath of the Weasel (W10).',
      };
    }
    return { ok: true };
  }

  isPlayable(id: PocketWorldId, passport?: Pick<Passport, 'earnedCount' | 'canEnterW10'>): boolean {
    return this.canEnter(id, passport).ok;
  }

  /**
   * AbortSignal-aware lazy world loader. Refuses dormant or unverified worlds
   * and guarantees `ctx.scope` is disposed if aborted or failed mid-load.
   */
  async load(
    id: PocketWorldId,
    signal: AbortSignal,
    ctx: PocketWorldContext,
  ): Promise<PocketWorldInstance> {
    if (signal.aborted) {
      cleanupFailedLoad(ctx);
      throw createAbortError();
    }
    const def = this.definitions.get(id);
    if (!def) {
      cleanupFailedLoad(ctx);
      throw new Error(`Unknown pocket world "${String(id)}"`);
    }
    if (def.readiness !== 'verified' || typeof def.load !== 'function') {
      cleanupFailedLoad(ctx);
      throw new Error(`Pocket world "${id}" is dormant and cannot be loaded.`);
    }

    let onAbort: (() => void) | null = null;
    try {
      const loadPromise = Promise.resolve(def.load(ctx, signal)).then(
        (instance) => {
          if (signal.aborted) {
            safeDisposeInstance(instance);
            cleanupFailedLoad(ctx);
            throw createAbortError();
          }
          return instance;
        },
        (error) => {
          cleanupFailedLoad(ctx);
          throw error;
        },
      );

      const abortPromise = new Promise<never>((_resolve, reject) => {
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        onAbort = () => reject(createAbortError());
        signal.addEventListener('abort', onAbort, { once: true });
      });

      return await Promise.race([loadPromise, abortPromise]);
    } catch (error) {
      cleanupFailedLoad(ctx);
      throw error;
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  }
}

function safeDisposeInstance(instance: PocketWorldInstance | undefined): void {
  try {
    instance?.dispose?.();
  } catch (error) {
    console.error('[PocketWorldRegistry] aborted instance dispose failed', error);
  }
}

function cleanupFailedLoad(ctx: PocketWorldContext): void {
  try {
    ctx.root.removeFromParent();
    ctx.root.clear();
  } catch {
    /* ignore */
  }
  ctx.scope.dispose();
}

export function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Pocket world load cancelled.', 'AbortError');
  }
  const error = new Error('Pocket world load cancelled.');
  error.name = 'AbortError';
  return error;
}
