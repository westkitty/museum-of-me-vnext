import runtimeJson from '../../data/source-parity/installation-runtime.json';

/**
 * THE SOURCE INSTALLATION STATE CONTRACT.
 *
 * Ported from the Reliquary source: Version B `src/exhibits/state.ts`
 * (sanitizeState / applyInstallationKey / tickInstallationState /
 * describeInstallationState) and the control tables in the CURATED HTML
 * `exhibitData[].controls`, which are byte-identical between the two source
 * authorities.
 *
 * This module is pure data + pure functions so the governing behaviour can be
 * asserted without a renderer, and so the runtime system and the QA harness
 * exercise exactly the same code the visitor drives.
 */

export type InstallationId =
  | 'starsilk-atlas' | 'drakken-sandbox' | 'orbital-tomb' | 'smores-katamari'
  | 'westcat-east' | 'parable' | 'vibe-nexus' | 'westcat-familiar' | 'heliocide'
  | 'dexdictate' | 'tablet-link' | 'osint-box' | 'dexvault' | 'dexgpt';

export type InstallationState = Record<string, unknown>;

export interface InstallationThesis {
  readonly title: string;
  readonly subject: string;
  readonly silhouette: string;
  readonly required: readonly string[];
}

interface RuntimeData {
  readonly defaultStates: Record<string, InstallationState>;
  readonly constants: {
    readonly eraNames: string[];
    readonly atlasOverlays: string[];
    readonly strains: string[];
    readonly strainColors: number[][];
    readonly katamariItems: (number | string | number[])[][];
    readonly familiarModes: string[];
    readonly familiarStates: string[][];
    readonly osintSeeds: string[];
    readonly osintRoutes: string[][];
    readonly vaultQueries: string[];
    readonly dexModes: string[];
    readonly installationTheses: Record<string, InstallationThesis>;
  };
  readonly spatialContract: {
    readonly standard: SpatialContract;
    readonly sanctuary: SpatialContract;
    readonly maxControlsPerInstallation: number;
    readonly footprint: Record<string, [number, number]>;
  };
  readonly sourcePositions: {
    readonly curated: Record<string, number[]>;
    readonly versionB: Record<string, number[]>;
  };
}

export interface SpatialContract {
  readonly readingZoneRadius: number;
  readonly interactionRadius: number;
  readonly cameraSafeDistance: number;
  readonly lecternCollisionRadius: number;
  readonly lecternPrompt: string;
}

const RUNTIME = runtimeJson as unknown as RuntimeData;

export const INSTALLATION_DEFAULT_STATES = RUNTIME.defaultStates;
export const INSTALLATION_CONSTANTS = RUNTIME.constants;
export const INSTALLATION_THESES = RUNTIME.constants.installationTheses;
export const SPATIAL_CONTRACT = RUNTIME.spatialContract;
export const SOURCE_POSITIONS = RUNTIME.sourcePositions;

/** Every installation id in source order. */
export const INSTALLATION_IDS = Object.keys(INSTALLATION_DEFAULT_STATES) as InstallationId[];

export function defaultStateFor(id: string): InstallationState {
  return clone(INSTALLATION_DEFAULT_STATES[id] ?? {});
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Clamp and enumerate a persisted or hostile state back into the source's legal
 * range. Source parity: Version B `sanitizeState`.
 */
export function sanitizeInstallationState(id: string, input: unknown): InstallationState {
  const base = defaultStateFor(id);
  const patch = input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
  const s: Record<string, unknown> = { ...base, ...patch };
  const c = INSTALLATION_CONSTANTS;
  switch (id) {
    case 'starsilk-atlas':
      s.era = clamp(num(s.era), 0, 4);
      s.overlay = clamp(num(s.overlay), 0, 3);
      break;
    case 'drakken-sandbox':
      s.strain = clamp(num(s.strain), 0, 4);
      s.step = clamp(num(s.step), 0, 5);
      s.official = !!s.official;
      break;
    case 'orbital-tomb':
      s.month = clamp(num(s.month), 0, 6);
      break;
    case 'smores-katamari': {
      s.x = clamp(num(s.x), -1.85, 1.85);
      s.z = clamp(num(s.z), -1.65, 1.65);
      s.vx = clamp(num(s.vx), -4, 4);
      s.vz = clamp(num(s.vz), -4, 4);
      s.size = clamp(Number(s.size) || 0.34, 0.34, 0.78);
      const raw = Array.isArray(s.collected) ? s.collected : [];
      s.collected = [...new Set(raw.map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n < 15))];
      break;
    }
    case 'westcat-east':
      s.condition = clamp(num(s.condition), 0, 2);
      s.distance = clamp(num(s.distance), 0, 10);
      break;
    case 'parable':
      s.armed = !!s.armed;
      s.miracle = ['None', 'Fireball', 'Rain'].includes(s.miracle as string) ? s.miracle : 'None';
      s.casts = Math.max(0, num(s.casts));
      break;
    case 'vibe-nexus':
      s.route = clamp(num(s.route), 0, 1);
      s.phase = clamp(num(s.phase), 0, 4);
      s.failures = Math.max(0, num(s.failures));
      break;
    case 'westcat-familiar':
      s.mode = clamp(num(s.mode), 0, 3);
      s.stateIndex = clamp(num(s.stateIndex), 0, 2);
      break;
    case 'heliocide': {
      s.phase = clamp(num(s.phase), 0, 5);
      s.authorized = !!s.authorized;
      s.holding = !!s.holding;
      const log = Array.isArray(s.log) ? s.log : [];
      s.log = log.filter((v) => ['BEGIN', 'STATUS', 'MODEL', 'HOLD', 'AUTHORIZE'].includes(v as string)).slice(-5);
      break;
    }
    case 'dexdictate':
      s.mode = s.mode === 'toggle' ? 'toggle' : 'hold';
      s.phase = clamp(num(s.phase), 0, 3);
      s.timer = Math.max(0, num(s.timer));
      s.history = Math.max(0, num(s.history));
      break;
    case 'tablet-link':
      s.phase = clamp(num(s.phase), 0, 4);
      break;
    case 'osint-box':
      s.seed = clamp(num(s.seed), 0, 3);
      s.step = clamp(num(s.step), 0, (c.osintRoutes[s.seed as number] || []).length);
      break;
    case 'dexvault':
      s.query = clamp(num(s.query), 0, 2);
      s.step = clamp(num(s.step), 0, 3);
      break;
    case 'dexgpt':
      s.mode = clamp(num(s.mode), 0, 2);
      s.inspect = !!s.inspect;
      break;
    default:
      break;
  }
  return s;
}

export interface KeyResult {
  readonly state: InstallationState;
  readonly changed: boolean;
  readonly message?: string;
}

/**
 * Apply one source control code. Source parity: Version B
 * `applyInstallationKey`, including the `parable` exception where KeyR is not
 * the reset (KeyX is) because KeyR is unbound for that installation.
 */
export function applyInstallationKey(id: string, current: InstallationState, code: string): KeyResult {
  let s = clone(current) as Record<string, unknown>;
  let changed = false;
  let message = '';
  const c = INSTALLATION_CONSTANTS;
  const reset = (): void => {
    s = defaultStateFor(id) as Record<string, unknown>;
    changed = true;
    message = 'Installation reset.';
  };
  if (code === 'KeyR' && id !== 'parable') {
    reset();
    return { state: s, changed, message };
  }
  switch (id) {
    case 'starsilk-atlas':
      if (code === 'ArrowLeft') { s.era = clamp(num(s.era) - 1, 0, 4); changed = true; }
      if (code === 'ArrowRight') { s.era = clamp(num(s.era) + 1, 0, 4); changed = true; }
      if (/^Digit[1-4]$/.test(code)) { s.overlay = Number(code.slice(-1)) - 1; changed = true; }
      break;
    case 'drakken-sandbox':
      if (/^Digit[1-5]$/.test(code)) { s.strain = Number(code.slice(-1)) - 1; s.step = 0; changed = true; }
      if (code === 'Space') { s.step = clamp(num(s.step) + 1, 0, 5); changed = true; }
      if (code === 'KeyO') { s.official = !s.official; changed = true; }
      break;
    case 'orbital-tomb':
      if (code === 'ArrowLeft') { s.month = clamp(num(s.month) - 1, 0, 6); changed = true; }
      if (code === 'ArrowRight') { s.month = clamp(num(s.month) + 1, 0, 6); changed = true; }
      break;
    case 'smores-katamari':
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) {
        if (code === 'KeyW') s.vz = num(s.vz) - 0.45;
        if (code === 'KeyS') s.vz = num(s.vz) + 0.45;
        if (code === 'KeyA') s.vx = num(s.vx) - 0.45;
        if (code === 'KeyD') s.vx = num(s.vx) + 0.45;
        changed = true;
      }
      break;
    case 'westcat-east':
      if (/^Digit[1-3]$/.test(code)) { s.condition = Number(code.slice(-1)) - 1; changed = true; }
      if (code === 'Space') {
        s.distance = clamp(num(s.distance) + [1.15, 0.55, 0.8][num(s.condition)], 0, 10);
        changed = true;
      }
      break;
    case 'parable':
      if (code === 'KeyC') { s.armed = true; changed = true; }
      if ((code === 'KeyF' || code === 'KeyN') && s.armed) {
        s.miracle = code === 'KeyF' ? 'Fireball' : 'Rain';
        s.casts = num(s.casts) + 1;
        s.armed = false;
        changed = true;
      }
      if (code === 'KeyX') reset();
      break;
    case 'vibe-nexus':
      if (code === 'Digit1') { s.route = 0; changed = true; }
      if (code === 'Digit2') { s.route = 1; s.failures = num(s.failures) + 1; changed = true; }
      if (code === 'Space') { s.phase = clamp(num(s.phase) + 1, 0, 4); changed = true; }
      break;
    case 'westcat-familiar':
      if (/^Digit[1-4]$/.test(code)) { s.mode = Number(code.slice(-1)) - 1; s.stateIndex = 0; changed = true; }
      if (code === 'Space') {
        const states = c.familiarStates[num(s.mode)] || [];
        s.stateIndex = (num(s.stateIndex) + 1) % Math.max(1, states.length);
        changed = true;
      }
      break;
    case 'heliocide': {
      const log = (s.log as string[]) ?? [];
      if (code === 'KeyB' && num(s.phase) === 0) {
        s.phase = 1; s.log = ['BEGIN']; changed = true;
      } else if (code === 'Space' && num(s.phase) >= 1 && num(s.phase) < 3) {
        s.phase = num(s.phase) + 1;
        s.log = [...log, num(s.phase) === 2 ? 'STATUS' : 'MODEL'];
        changed = true;
      } else if (code === 'KeyH' && num(s.phase) >= 3) {
        s.phase = 4; s.holding = true; s.authorized = false;
        if (!log.includes('HOLD')) s.log = [...log, 'HOLD'];
        changed = true;
      } else if (code === 'KeyA' && num(s.phase) >= 3) {
        s.phase = 5; s.authorized = true; s.holding = false;
        if (!log.includes('AUTHORIZE')) s.log = [...log, 'AUTHORIZE'];
        changed = true;
      }
      break;
    }
    case 'dexdictate':
      if (code === 'KeyH') { s.mode = 'hold'; changed = true; }
      if (code === 'KeyT') { s.mode = 'toggle'; changed = true; }
      if (code === 'Space') {
        if (num(s.phase) === 0) { s.phase = 1; s.timer = 0; }
        else if (num(s.phase) === 1) { s.phase = 2; s.timer = 0; }
        else { s.phase = 0; s.timer = 0; }
        changed = true;
      }
      break;
    case 'tablet-link':
      if (code === 'Space') { s.phase = (num(s.phase) + 1) % 5; changed = true; }
      break;
    case 'osint-box':
      if (/^Digit[1-4]$/.test(code)) { s.seed = Number(code.slice(-1)) - 1; s.step = 0; changed = true; }
      if (code === 'Space') {
        s.step = clamp(num(s.step) + 1, 0, (c.osintRoutes[num(s.seed)] || []).length);
        changed = true;
      }
      break;
    case 'dexvault':
      if (/^Digit[1-3]$/.test(code)) { s.query = Number(code.slice(-1)) - 1; s.step = 0; changed = true; }
      if (code === 'Space') { s.step = clamp(num(s.step) + 1, 0, 3); changed = true; }
      break;
    case 'dexgpt':
      if (/^Digit[1-3]$/.test(code)) { s.mode = Number(code.slice(-1)) - 1; changed = true; }
      if (code === 'Space') { s.inspect = !s.inspect; changed = true; }
      break;
    default:
      break;
  }
  return { state: sanitizeInstallationState(id, s), changed, message: message || undefined };
}

/**
 * Time-driven state. Source parity: Version B `tickInstallationState`. Only
 * `dexdictate` (capture pipeline) and `smores-katamari` (rolling physics and
 * collection) advance without input.
 */
export function tickInstallationState(
  id: string,
  current: InstallationState,
  delta: number,
  held: ReadonlySet<string>,
): { state: InstallationState; changed: boolean } {
  const s = clone(current) as Record<string, unknown>;
  let changed = false;
  if (id === 'dexdictate') {
    const phase = num(s.phase);
    if (phase === 1 || phase === 2 || phase === 3) { s.timer = num(s.timer) + delta; changed = true; }
    if (phase === 1 && num(s.timer) >= 1.2) { s.phase = 2; s.timer = 0; }
    else if (phase === 2 && num(s.timer) >= 1.2) { s.phase = 3; s.timer = 0; s.history = num(s.history) + 1; }
    else if (phase === 3 && num(s.timer) >= 1.7) { s.phase = 0; s.timer = 0; }
  }
  if (id === 'smores-katamari') {
    const ax = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
    const az = (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0);
    if (ax || az) {
      s.vx = clamp(num(s.vx) + ax * delta * 3.1, -4, 4);
      s.vz = clamp(num(s.vz) + az * delta * 3.1, -4, 4);
      changed = true;
    }
    const damping = Math.pow(0.16, delta);
    s.vx = num(s.vx) * damping;
    s.vz = num(s.vz) * damping;
    if (Math.abs(num(s.vx)) > 0.002 || Math.abs(num(s.vz)) > 0.002) {
      s.x = clamp(num(s.x) + num(s.vx) * delta, -1.85, 1.85);
      s.z = clamp(num(s.z) + num(s.vz) * delta, -1.65, 1.65);
      changed = true;
    }
    const collected = (s.collected as number[]) ?? [];
    INSTALLATION_CONSTANTS.katamariItems.forEach((item, i) => {
      const ix = Number(item[0]);
      const iz = Number(item[1]);
      if (!collected.includes(i) && Math.hypot(num(s.x) - ix, num(s.z) - iz) <= num(s.size) + 0.18) {
        collected.push(i);
        s.size = clamp(num(s.size) + 0.035, 0.34, 0.78);
        changed = true;
      }
    });
    s.collected = collected;
  }
  return { state: s, changed };
}

/**
 * The interpretive lectern's live line. Source parity: Version B
 * `describeInstallationState`.
 */
export function describeInstallationState(id: string, s: InstallationState): string {
  const c = INSTALLATION_CONSTANTS;
  const v = s as Record<string, never>;
  switch (id) {
    case 'starsilk-atlas':
      return `${c.eraNames[num(v.era)]} · ${c.atlasOverlays[num(v.overlay)]}`;
    case 'drakken-sandbox':
      return `${c.strains[num(v.strain)]} · assault step ${num(v.step)}/5 · ${v.official ? 'official report' : 'actual condition'}`;
    case 'orbital-tomb':
      return `Meridian month ${num(v.month)}/6`;
    case 'smores-katamari':
      return `${((v.collected as unknown as number[]) ?? []).length}/15 objects collected · scale ${num(v.size).toFixed(2)}`;
    case 'westcat-east':
      return `${['Dry streets', 'Rain traction', 'Ferry rhythm'][num(v.condition)]} · route ${num(v.distance).toFixed(2)}/10`;
    case 'parable':
      return `${v.armed ? 'Ritual armed' : 'Ritual unarmed'} · ${String(v.miracle)} · ${num(v.casts)} casts`;
    case 'vibe-nexus':
      return `${num(v.route) === 0 ? 'Purpose preserved' : 'Generic shortcut'} · phase ${num(v.phase)}/4 · ${num(v.failures)} failures`;
    case 'westcat-familiar':
      return `${c.familiarModes[num(v.mode)]} · ${(c.familiarStates[num(v.mode)] || [])[num(v.stateIndex)]}`;
    case 'heliocide':
      return `Phase ${num(v.phase)}/5 · ${v.holding ? 'HOLD' : v.authorized ? 'AUTHORIZED' : 'awaiting command'} · ${((v.log as unknown as string[]) ?? []).join(' / ') || 'no record'}`;
    case 'dexdictate':
      return `${String(v.mode)} mode · ${['Idle', 'Capturing', 'Local inference', 'Inserted'][num(v.phase)]} · ${num(v.history)} local insertions`;
    case 'tablet-link':
      return `${['Disconnected', 'Discovery', 'Trust', 'Connected', 'Broken / recovery'][num(v.phase)]}`;
    case 'osint-box':
      return `${c.osintSeeds[num(v.seed)]} · ${(c.osintRoutes[num(v.seed)] || [])[Math.max(0, num(v.step) - 1)] || 'route not started'} · step ${num(v.step)}`;
    case 'dexvault':
      return `${c.vaultQueries[num(v.query)]} · retrieval step ${num(v.step)}/3`;
    case 'dexgpt':
      return `${c.dexModes[num(v.mode)]} mode · ${v.inspect ? 'evidence under inspection' : 'watching'}`;
    default:
      return 'Ready.';
  }
}
