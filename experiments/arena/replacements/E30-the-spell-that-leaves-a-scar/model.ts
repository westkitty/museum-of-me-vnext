export type SpellId = 'cinder' | 'rime' | 'prism';

export type ZoneId = 'rim' | 'conduit' | 'channel';

export type ScarKind =
  | 'none'
  | 'crater'
  | 'frost'
  | 'spire'
  | 'quench'
  | 'flashover'
  | 'vitrified'
  | 'cryoprism';

export interface SpellSpec {
  readonly id: SpellId;
  readonly name: string;
  readonly shortLabel: string;
  readonly colorHex: number;
  readonly emissiveHex: number;
}

export interface ZoneSpec {
  readonly id: ZoneId;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly neighbors: readonly ZoneId[];
}

export interface ZoneState {
  readonly id: ZoneId;
  readonly scar: ScarKind;
  readonly intensity: number;
  readonly heat: number;
  readonly conductivity: number;
}

export interface CastOutcome {
  readonly spell: SpellId;
  readonly target: ZoneId;
  readonly priorScar: ScarKind;
  readonly resultingScar: ScarKind;
  readonly reaction: 'baseline' | 'reinforce' | 'quench' | 'flashover' | 'refract' | 'vitrify' | 'cryoprism';
  readonly refractedTargets: readonly ZoneId[];
  readonly summary: string;
}

export interface CastSnapshot {
  readonly zones: Readonly<Record<ZoneId, ZoneState>>;
  readonly castCount: number;
  readonly reactionCount: number;
  readonly refractionCount: number;
  readonly lastOutcome: CastOutcome | null;
}

export interface ArenaState extends CastSnapshot {
  readonly selectedSpell: SpellId;
  readonly selectedZone: ZoneId;
  readonly history: readonly CastSnapshot[];
}

export const SPELLS: readonly SpellSpec[] = [
  { id: 'cinder', name: 'Cinder Lance', shortLabel: 'Cinder', colorHex: 0xff6b2c, emissiveHex: 0xff4500 },
  { id: 'rime', name: 'Rime Surge', shortLabel: 'Rime', colorHex: 0x5cd6ff, emissiveHex: 0x1ea8ff },
  { id: 'prism', name: 'Prism Lattice', shortLabel: 'Prism', colorHex: 0xc97dff, emissiveHex: 0xa244ff },
] as const;

export const ZONES: readonly ZoneSpec[] = [
  { id: 'rim', name: 'West Basalt Rim', x: -1.85, z: -4.45, neighbors: ['conduit'] },
  { id: 'conduit', name: 'Central Conduit', x: 0.0, z: -5.15, neighbors: ['rim', 'channel'] },
  { id: 'channel', name: 'East Quench Basin', x: 1.85, z: -4.45, neighbors: ['conduit'] },
] as const;

export const SCAR_LABELS: Readonly<Record<ScarKind, string>> = {
  none: 'Bare Basalt',
  crater: 'Glassified Crater',
  frost: 'Frost Rime Crust',
  spire: 'Resonant Crystal Spire',
  quench: 'Thermal Quench Fissure',
  flashover: 'Sublimation Mist Ring',
  vitrified: 'Vitrified Obsidian Monolith',
  cryoprism: 'Cryo-Prism Refractor',
};

function makeInitialZones(): Record<ZoneId, ZoneState> {
  return {
    rim: { id: 'rim', scar: 'none', intensity: 0, heat: 0, conductivity: 0 },
    conduit: { id: 'conduit', scar: 'none', intensity: 0, heat: 0, conductivity: 1 },
    channel: { id: 'channel', scar: 'none', intensity: 0, heat: 0, conductivity: 0 },
  };
}

export function createInitialArenaState(): ArenaState {
  return {
    selectedSpell: 'cinder',
    selectedZone: 'conduit',
    zones: makeInitialZones(),
    castCount: 0,
    reactionCount: 0,
    refractionCount: 0,
    lastOutcome: null,
    history: [],
  };
}

function cloneZones(zones: Readonly<Record<ZoneId, ZoneState>>): Record<ZoneId, ZoneState> {
  return {
    rim: { ...zones.rim },
    conduit: { ...zones.conduit },
    channel: { ...zones.channel },
  };
}

function resolvePrimaryTransition(spell: SpellId, existing: ScarKind): {
  scar: ScarKind;
  reaction: CastOutcome['reaction'];
  heatDelta: number;
  condDelta: number;
  refracts: boolean;
} {
  if (existing === 'none') {
    if (spell === 'cinder') return { scar: 'crater', reaction: 'baseline', heatDelta: 2, condDelta: 0, refracts: false };
    if (spell === 'rime') return { scar: 'frost', reaction: 'baseline', heatDelta: -2, condDelta: 1, refracts: false };
    return { scar: 'spire', reaction: 'baseline', heatDelta: 0, condDelta: 2, refracts: false };
  }

  if (existing === 'spire' || existing === 'cryoprism') {
    if (spell === 'prism') {
      return { scar: existing, reaction: 'reinforce', heatDelta: 0, condDelta: 1, refracts: true };
    }
    return { scar: existing, reaction: 'refract', heatDelta: spell === 'cinder' ? 1 : -1, condDelta: 1, refracts: true };
  }

  if (existing === 'crater') {
    if (spell === 'rime') return { scar: 'quench', reaction: 'quench', heatDelta: -3, condDelta: 2, refracts: false };
    if (spell === 'prism') return { scar: 'vitrified', reaction: 'vitrify', heatDelta: -1, condDelta: 2, refracts: false };
    return { scar: 'crater', reaction: 'reinforce', heatDelta: 1, condDelta: 0, refracts: false };
  }

  if (existing === 'frost') {
    if (spell === 'cinder') return { scar: 'flashover', reaction: 'flashover', heatDelta: 3, condDelta: 1, refracts: false };
    if (spell === 'prism') return { scar: 'cryoprism', reaction: 'cryoprism', heatDelta: -1, condDelta: 2, refracts: true };
    return { scar: 'frost', reaction: 'reinforce', heatDelta: -1, condDelta: 1, refracts: false };
  }

  if (existing === 'quench') {
    if (spell === 'cinder') return { scar: 'flashover', reaction: 'flashover', heatDelta: 2, condDelta: 1, refracts: false };
    if (spell === 'prism') return { scar: 'spire', reaction: 'baseline', heatDelta: 0, condDelta: 2, refracts: false };
    return { scar: 'frost', reaction: 'reinforce', heatDelta: -1, condDelta: 1, refracts: false };
  }

  if (existing === 'flashover') {
    if (spell === 'rime') return { scar: 'quench', reaction: 'quench', heatDelta: -2, condDelta: 2, refracts: false };
    if (spell === 'prism') return { scar: 'cryoprism', reaction: 'cryoprism', heatDelta: 0, condDelta: 2, refracts: true };
    return { scar: 'crater', reaction: 'reinforce', heatDelta: 2, condDelta: 0, refracts: false };
  }

  // vitrified obsidian monolith channels heat/cold outward when struck again
  if (spell === 'prism') return { scar: 'vitrified', reaction: 'reinforce', heatDelta: 0, condDelta: 1, refracts: false };
  return { scar: 'vitrified', reaction: 'refract', heatDelta: spell === 'cinder' ? 1 : -1, condDelta: 1, refracts: true };
}

function zoneSpecFor(id: ZoneId): ZoneSpec {
  return ZONES.find((z) => z.id === id) ?? ZONES[1];
}

function spellSpecFor(id: SpellId): SpellSpec {
  return SPELLS.find((s) => s.id === id) ?? SPELLS[0];
}

export function previewCastOutcome(state: ArenaState): CastOutcome {
  const spell = state.selectedSpell;
  const target = state.selectedZone;
  const prior = state.zones[target];
  const transition = resolvePrimaryTransition(spell, prior.scar);
  const neighbors = transition.refracts ? zoneSpecFor(target).neighbors : [];
  const spellName = spellSpecFor(spell).name;
  const zoneName = zoneSpecFor(target).name;

  if (prior.scar === 'none') {
    return {
      spell,
      target,
      priorScar: prior.scar,
      resultingScar: transition.scar,
      reaction: transition.reaction,
      refractedTargets: neighbors,
      summary: `${spellName} on ${zoneName} will etch a ${SCAR_LABELS[transition.scar]}.`,
    };
  }

  const branchNote = neighbors.length > 0 ? ` and refract into ${neighbors.length} neighboring zone(s)` : '';
  return {
    spell,
    target,
    priorScar: prior.scar,
    resultingScar: transition.scar,
    reaction: transition.reaction,
    refractedTargets: neighbors,
    summary: `${spellName} striking ${SCAR_LABELS[prior.scar]} triggers ${transition.reaction} (${SCAR_LABELS[transition.scar]})${branchNote}.`,
  };
}

export function applyCast(state: ArenaState): ArenaState {
  const snapshot: CastSnapshot = {
    zones: cloneZones(state.zones),
    castCount: state.castCount,
    reactionCount: state.reactionCount,
    refractionCount: state.refractionCount,
    lastOutcome: state.lastOutcome,
  };

  const spell = state.selectedSpell;
  const target = state.selectedZone;
  const nextZones = cloneZones(state.zones);
  const current = nextZones[target];
  const transition = resolvePrimaryTransition(spell, current.scar);

  nextZones[target] = {
    id: target,
    scar: transition.scar,
    intensity: Math.min(3, current.intensity + 1),
    heat: Math.max(-5, Math.min(5, current.heat + transition.heatDelta)),
    conductivity: Math.max(0, Math.min(6, current.conductivity + transition.condDelta)),
  };

  const refractedTargets: ZoneId[] = [];
  if (transition.refracts) {
    for (const neighborId of zoneSpecFor(target).neighbors) {
      const nState = nextZones[neighborId];
      const sub = resolvePrimaryTransition(spell, nState.scar);
      nextZones[neighborId] = {
        id: neighborId,
        scar: sub.scar,
        intensity: Math.min(3, nState.intensity + 1),
        heat: Math.max(-5, Math.min(5, nState.heat + sub.heatDelta)),
        conductivity: Math.max(0, Math.min(6, nState.conductivity + sub.condDelta)),
      };
      refractedTargets.push(neighborId);
    }
  }

  const didReact = transition.reaction !== 'baseline' && transition.reaction !== 'reinforce';
  const spellName = spellSpecFor(spell).name;
  const zoneName = zoneSpecFor(target).name;
  const summary =
    refractedTargets.length > 0
      ? `${spellName} refracted off ${SCAR_LABELS[current.scar]} at ${zoneName}, cascading to ${refractedTargets.join(' & ')}.`
      : didReact
        ? `${spellName} reacted with ${SCAR_LABELS[current.scar]} at ${zoneName} -> ${SCAR_LABELS[transition.scar]}.`
        : `${spellName} left a ${SCAR_LABELS[transition.scar]} at ${zoneName}.`;

  const outcome: CastOutcome = {
    spell,
    target,
    priorScar: current.scar,
    resultingScar: transition.scar,
    reaction: transition.reaction,
    refractedTargets,
    summary,
  };

  return {
    ...state,
    zones: nextZones,
    castCount: state.castCount + 1,
    reactionCount: state.reactionCount + (didReact ? 1 : 0),
    refractionCount: state.refractionCount + (refractedTargets.length > 0 ? 1 : 0),
    lastOutcome: outcome,
    history: [...state.history, snapshot],
  };
}

export function undoLastCast(state: ArenaState): ArenaState {
  if (state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  return {
    ...state,
    zones: cloneZones(previous.zones),
    castCount: previous.castCount,
    reactionCount: previous.reactionCount,
    refractionCount: previous.refractionCount,
    lastOutcome: previous.lastOutcome,
    history: state.history.slice(0, -1),
  };
}

export function countActiveScars(state: ArenaState): number {
  let total = 0;
  for (const zone of ZONES) {
    if (state.zones[zone.id].scar !== 'none') total++;
  }
  return total;
}
