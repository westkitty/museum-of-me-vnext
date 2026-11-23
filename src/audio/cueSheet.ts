import { getAsset, type AssetRecord } from '../assets/manifest';

export const MUSIC_CUE_SHEET_VERSION = 1 as const;

export type MusicCueKind = 'cue' | 'transition' | 'end';

export interface MusicTimeSignature {
  readonly numerator: number;
  readonly denominator: number;
}

export interface MusicBeatGrid {
  readonly bpm: number;
  readonly timeSignature?: MusicTimeSignature;
  readonly offsetSeconds?: number;
}

export interface MusicLoopRegion {
  readonly id?: string;
  readonly label?: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly crossfadeSeconds?: number;
}

export interface MusicNamedCue {
  readonly id: string;
  readonly timeSeconds: number;
  readonly kind?: MusicCueKind;
  readonly sectionId?: string;
  readonly label?: string;
  readonly tags?: readonly string[];
  readonly data?: Readonly<Record<string, string | number | boolean>>;
}

export interface MusicStemDefinition {
  readonly id: string;
  readonly assetId: string;
  readonly groupId?: string;
  readonly sectionId?: string;
  readonly defaultGain?: number;
  readonly startOffsetSeconds?: number;
  readonly durationSeconds?: number;
  readonly loop?: boolean;
  readonly loopRegion?: MusicLoopRegion;
}

export interface MusicSectionDefinition {
  readonly id: string;
  readonly label?: string;
  readonly startSeconds?: number;
  readonly endSeconds?: number;
  readonly loop?: boolean;
  readonly loopRegion?: MusicLoopRegion;
  readonly stemIds?: readonly string[];
}

export interface MusicCueSheet {
  readonly version: typeof MUSIC_CUE_SHEET_VERSION;
  readonly id: string;
  readonly title?: string;
  readonly durationSeconds?: number;
  readonly loop?: boolean;
  readonly loopRegion?: MusicLoopRegion;
  readonly loopRegions?: readonly MusicLoopRegion[];
  readonly defaultLoopRegionId?: string;
  readonly beatGrid?: MusicBeatGrid;
  readonly stems: readonly MusicStemDefinition[];
  readonly sections?: readonly MusicSectionDefinition[];
  readonly cues?: readonly MusicNamedCue[];
  readonly endMarkerSeconds?: number;
}

export interface MusicBeatPosition {
  readonly beat: number;
  readonly bar: number;
  readonly beatInBar: number;
}

export interface CueSheetValidationOptions {
  readonly resolveAsset?: (assetId: string) => AssetRecord | undefined;
  readonly requireLocalAssets?: boolean;
}

export type CueSheetValidationResult =
  | { readonly ok: true; readonly sheet: MusicCueSheet }
  | { readonly ok: false; readonly errors: readonly string[] };

export class MusicCueSheetValidationError extends Error {
  readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Invalid music cue sheet: ${errors.join('; ')}`);
    this.name = 'MusicCueSheetValidationError';
    this.errors = errors;
  }
}

const VALID_DENOMINATORS = new Set([1, 2, 4, 8, 16, 32]);
const VALID_CUE_KINDS = new Set<MusicCueKind>(['cue', 'transition', 'end']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Local bundled audio URL check for offline `file://` and CSP compliance.
 * Permits relative paths, Vite bundled asset paths, `data:`, `blob:`, and
 * same-origin HTTP(S) URLs on a live local/hosted origin; forbids remote hosts.
 */
export function isLocalAudioUrl(url: string): boolean {
  if (!isNonEmptyString(url)) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('data:audio/') || trimmed.startsWith('data:application/ogg') || trimmed.startsWith('blob:')) {
    return true;
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return !trimmed.split('/').includes('..');
  }
  if (typeof window !== 'undefined' && (window.location?.protocol === 'http:' || window.location?.protocol === 'https:')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return false;
}

function validateLoopRegion(
  region: unknown,
  label: string,
  durationLimit: number | undefined,
  seenRegionIds: Set<string>,
  errors: string[],
  requireId = false,
): string | null {
  if (!isPlainObject(region)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  let validId: string | null = null;
  if (region.id !== undefined) {
    if (!isNonEmptyString(region.id)) {
      errors.push(`${label}.id must be a non-empty string`);
    } else if (seenRegionIds.has(region.id)) {
      errors.push(`Duplicate loop region id "${region.id}"`);
    } else {
      seenRegionIds.add(region.id);
      validId = region.id;
    }
  } else if (requireId) {
    errors.push(`${label}.id must be a non-empty string`);
  }
  if (region.label !== undefined && typeof region.label !== 'string') {
    errors.push(`${label}.label must be a string when provided`);
  }
  if (!isFiniteNonNegative(region.startSeconds)) {
    errors.push(`${label}.startSeconds must be a finite number >= 0`);
  }
  if (typeof region.endSeconds !== 'number' || !Number.isFinite(region.endSeconds)) {
    errors.push(`${label}.endSeconds must be a finite number`);
    return validId;
  }
  if (isFiniteNonNegative(region.startSeconds) && region.endSeconds <= region.startSeconds) {
    errors.push(`${label} has invalid loop range (${region.startSeconds}..${region.endSeconds})`);
  }
  if (durationLimit !== undefined && region.endSeconds > durationLimit) {
    errors.push(`${label}.endSeconds (${region.endSeconds}) exceeds durationSeconds (${durationLimit})`);
  }
  if (region.crossfadeSeconds !== undefined) {
    if (!isFiniteNonNegative(region.crossfadeSeconds)) {
      errors.push(`${label}.crossfadeSeconds must be a finite number >= 0`);
    } else if (
      isFiniteNonNegative(region.startSeconds)
      && region.endSeconds > region.startSeconds
      && region.crossfadeSeconds >= (region.endSeconds - region.startSeconds) * 0.5
    ) {
      errors.push(
        `${label}.crossfadeSeconds (${region.crossfadeSeconds}) must be < half of loop duration (${(region.endSeconds - region.startSeconds) * 0.5})`,
      );
    }
  }
  return validId;
}

export function validateMusicCueSheet(
  input: unknown,
  options: CueSheetValidationOptions = {},
): CueSheetValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: ['Cue sheet must be a plain object'] };
  }

  if (input.version !== MUSIC_CUE_SHEET_VERSION) {
    errors.push(`Unsupported cue sheet version: ${String(input.version)} (expected ${MUSIC_CUE_SHEET_VERSION})`);
  }

  if (!isNonEmptyString(input.id)) {
    errors.push('Cue sheet "id" must be a non-empty string');
  }

  if (input.title !== undefined && typeof input.title !== 'string') {
    errors.push('Cue sheet "title" must be a string when provided');
  }

  let durationSeconds: number | undefined;
  if (input.durationSeconds !== undefined) {
    if (!isFinitePositive(input.durationSeconds)) {
      errors.push('Cue sheet "durationSeconds" must be a finite number > 0');
    } else {
      durationSeconds = input.durationSeconds;
    }
  }

  if (input.loop !== undefined && typeof input.loop !== 'boolean') {
    errors.push('Cue sheet "loop" must be a boolean when provided');
  }

  if (input.endMarkerSeconds !== undefined) {
    if (!isFiniteNonNegative(input.endMarkerSeconds)) {
      errors.push('Cue sheet "endMarkerSeconds" must be a finite number >= 0');
    } else if (durationSeconds !== undefined && input.endMarkerSeconds > durationSeconds) {
      errors.push(`Cue sheet "endMarkerSeconds" (${input.endMarkerSeconds}) exceeds durationSeconds (${durationSeconds})`);
    }
  }

  const seenRegionIds = new Set<string>();
  const topLevelRegionIds = new Set<string>();
  if (input.loopRegion !== undefined) {
    const id = validateLoopRegion(input.loopRegion, 'loopRegion', durationSeconds, seenRegionIds, errors);
    if (id) topLevelRegionIds.add(id);
  }
  if (input.loopRegions !== undefined) {
    if (!Array.isArray(input.loopRegions)) {
      errors.push('Cue sheet "loopRegions" must be an array');
    } else {
      for (let i = 0; i < input.loopRegions.length; i++) {
        const id = validateLoopRegion(
          input.loopRegions[i],
          `loopRegions[${i}]`,
          durationSeconds,
          seenRegionIds,
          errors,
          true,
        );
        if (id) topLevelRegionIds.add(id);
      }
    }
  }
  if (input.defaultLoopRegionId !== undefined) {
    if (!isNonEmptyString(input.defaultLoopRegionId)) {
      errors.push('Cue sheet "defaultLoopRegionId" must be a non-empty string when provided');
    } else if (!topLevelRegionIds.has(input.defaultLoopRegionId)) {
      errors.push(
        `Cue sheet "defaultLoopRegionId" ("${input.defaultLoopRegionId}") does not match loopRegion.id or any entry in loopRegions`,
      );
    }
  }

  if (input.beatGrid !== undefined) {
    if (!isPlainObject(input.beatGrid)) {
      errors.push('Cue sheet "beatGrid" must be an object');
    } else {
      if (!isFinitePositive(input.beatGrid.bpm)) {
        errors.push('beatGrid.bpm must be a finite number > 0');
      }
      if (input.beatGrid.offsetSeconds !== undefined) {
        if (!isFiniteNonNegative(input.beatGrid.offsetSeconds)) {
          errors.push('beatGrid.offsetSeconds must be a finite number >= 0');
        } else if (durationSeconds !== undefined && input.beatGrid.offsetSeconds >= durationSeconds) {
          errors.push(`beatGrid.offsetSeconds (${input.beatGrid.offsetSeconds}) must be < durationSeconds (${durationSeconds})`);
        }
      }
      if (input.beatGrid.timeSignature !== undefined) {
        const ts = input.beatGrid.timeSignature;
        if (!isPlainObject(ts)) {
          errors.push('beatGrid.timeSignature must be an object');
        } else {
          if (typeof ts.numerator !== 'number' || !Number.isInteger(ts.numerator) || ts.numerator < 1) {
            errors.push('beatGrid.timeSignature.numerator must be an integer >= 1');
          }
          if (typeof ts.denominator !== 'number' || !VALID_DENOMINATORS.has(ts.denominator)) {
            errors.push('beatGrid.timeSignature.denominator must be one of 1, 2, 4, 8, 16, 32');
          }
        }
      }
    }
  }

  const sectionIds = new Set<string>();
  const sectionStemRefs: Array<{ sectionId: string; stemIds: readonly unknown[] }> = [];
  if (input.sections !== undefined) {
    if (!Array.isArray(input.sections)) {
      errors.push('Cue sheet "sections" must be an array');
    } else {
      for (let i = 0; i < input.sections.length; i++) {
        const section = input.sections[i];
        const prefix = `sections[${i}]`;
        if (!isPlainObject(section)) {
          errors.push(`${prefix} must be an object`);
          continue;
        }
        if (!isNonEmptyString(section.id)) {
          errors.push(`${prefix}.id must be a non-empty string`);
        } else if (sectionIds.has(section.id)) {
          errors.push(`Duplicate section id "${section.id}"`);
        } else {
          sectionIds.add(section.id);
        }
        if (section.label !== undefined && typeof section.label !== 'string') {
          errors.push(`${prefix}.label must be a string`);
        }
        if (section.loop !== undefined && typeof section.loop !== 'boolean') {
          errors.push(`${prefix}.loop must be a boolean`);
        }
        if (section.startSeconds !== undefined) {
          if (!isFiniteNonNegative(section.startSeconds)) {
            errors.push(`${prefix}.startSeconds must be a finite number >= 0`);
          } else if (durationSeconds !== undefined && section.startSeconds >= durationSeconds) {
            errors.push(`${prefix}.startSeconds (${section.startSeconds}) must be < durationSeconds (${durationSeconds})`);
          }
        }
        if (section.endSeconds !== undefined) {
          if (typeof section.endSeconds !== 'number' || !Number.isFinite(section.endSeconds)) {
            errors.push(`${prefix}.endSeconds must be a finite number`);
          } else {
            const minStart = isFiniteNonNegative(section.startSeconds) ? section.startSeconds : 0;
            if (section.endSeconds <= minStart) {
              errors.push(`${prefix}.endSeconds (${section.endSeconds}) must be > startSeconds (${minStart})`);
            }
            if (durationSeconds !== undefined && section.endSeconds > durationSeconds) {
              errors.push(`${prefix}.endSeconds (${section.endSeconds}) exceeds durationSeconds (${durationSeconds})`);
            }
          }
        }
        if (section.loopRegion !== undefined) {
          validateLoopRegion(section.loopRegion, `${prefix}.loopRegion`, durationSeconds, seenRegionIds, errors);
        }
        if (section.stemIds !== undefined) {
          if (!Array.isArray(section.stemIds)) {
            errors.push(`${prefix}.stemIds must be an array`);
          } else if (isNonEmptyString(section.id)) {
            sectionStemRefs.push({ sectionId: section.id, stemIds: section.stemIds });
          }
        }
      }
    }
  }

  const resolveAsset = options.resolveAsset ?? getAsset;
  const requireLocalAssets = options.requireLocalAssets !== false;
  const stemIds = new Set<string>();
  if (!Array.isArray(input.stems) || input.stems.length === 0) {
    errors.push('Cue sheet "stems" must be a non-empty array');
  } else {
    for (let i = 0; i < input.stems.length; i++) {
      const stem = input.stems[i];
      const prefix = `stems[${i}]`;
      if (!isPlainObject(stem)) {
        errors.push(`${prefix} must be an object`);
        continue;
      }
      if (!isNonEmptyString(stem.id)) {
        errors.push(`${prefix}.id must be a non-empty string`);
      } else if (stemIds.has(stem.id)) {
        errors.push(`Duplicate stem id "${stem.id}"`);
      } else {
        stemIds.add(stem.id);
      }

      if (!isNonEmptyString(stem.assetId)) {
        errors.push(`${prefix}.assetId must be a non-empty string`);
      } else {
        const record = resolveAsset(stem.assetId);
        if (!record) {
          errors.push(`${prefix} references unregistered asset "${stem.assetId}"`);
        } else {
          if (record.kind !== 'audio') {
            errors.push(`${prefix} asset "${stem.assetId}" has kind "${record.kind}", expected "audio"`);
          }
          if (requireLocalAssets && record.url !== undefined && !isLocalAudioUrl(record.url)) {
            errors.push(`${prefix} asset "${stem.assetId}" uses a non-local URL`);
          }
        }
      }

      if (stem.groupId !== undefined && !isNonEmptyString(stem.groupId)) {
        errors.push(`${prefix}.groupId must be a non-empty string when provided`);
      }
      if (stem.sectionId !== undefined) {
        if (!isNonEmptyString(stem.sectionId) || !sectionIds.has(stem.sectionId)) {
          errors.push(`${prefix}.sectionId "${String(stem.sectionId)}" is not declared in sections`);
        }
      }
      if (stem.defaultGain !== undefined) {
        if (typeof stem.defaultGain !== 'number' || !Number.isFinite(stem.defaultGain)
          || stem.defaultGain < 0 || stem.defaultGain > 1) {
          errors.push(`${prefix}.defaultGain must be a finite number in [0, 1]`);
        }
      }
      if (stem.startOffsetSeconds !== undefined) {
        if (!isFiniteNonNegative(stem.startOffsetSeconds)) {
          errors.push(`${prefix}.startOffsetSeconds must be a finite number >= 0`);
        } else if (durationSeconds !== undefined && stem.startOffsetSeconds >= durationSeconds) {
          errors.push(`${prefix}.startOffsetSeconds (${stem.startOffsetSeconds}) must be < durationSeconds (${durationSeconds})`);
        }
      }
      if (stem.durationSeconds !== undefined && !isFinitePositive(stem.durationSeconds)) {
        errors.push(`${prefix}.durationSeconds must be a finite number > 0`);
      }
      if (stem.loop !== undefined && typeof stem.loop !== 'boolean') {
        errors.push(`${prefix}.loop must be a boolean when provided`);
      }
      if (stem.loopRegion !== undefined) {
        validateLoopRegion(stem.loopRegion, `${prefix}.loopRegion`, durationSeconds, seenRegionIds, errors);
      }
    }
  }

  for (const ref of sectionStemRefs) {
    const localSeen = new Set<string>();
    for (const rawStemId of ref.stemIds) {
      if (!isNonEmptyString(rawStemId) || !stemIds.has(rawStemId)) {
        errors.push(`Section "${ref.sectionId}" references unknown stem "${String(rawStemId)}"`);
      } else if (localSeen.has(rawStemId)) {
        errors.push(`Section "${ref.sectionId}" lists duplicate stem "${rawStemId}"`);
      } else {
        localSeen.add(rawStemId);
      }
    }
  }

  const cueIds = new Set<string>();
  let previousCueTime = -Infinity;
  if (input.cues !== undefined) {
    if (!Array.isArray(input.cues)) {
      errors.push('Cue sheet "cues" must be an array');
    } else {
      for (let i = 0; i < input.cues.length; i++) {
        const cue = input.cues[i];
        const prefix = `cues[${i}]`;
        if (!isPlainObject(cue)) {
          errors.push(`${prefix} must be an object`);
          continue;
        }
        if (!isNonEmptyString(cue.id)) {
          errors.push(`${prefix}.id must be a non-empty string`);
        } else if (cueIds.has(cue.id)) {
          errors.push(`Duplicate cue id "${cue.id}"`);
        } else {
          cueIds.add(cue.id);
        }

        if (typeof cue.timeSeconds !== 'number' || !Number.isFinite(cue.timeSeconds) || cue.timeSeconds < 0) {
          errors.push(`${prefix}.timeSeconds is negative or invalid (must be a finite number >= 0)`);
        } else {
          if (cue.timeSeconds < previousCueTime) {
            errors.push(`${prefix} ("${String(cue.id)}") timestamp ${cue.timeSeconds} is out of order (preceded by ${previousCueTime})`);
          }
          if (durationSeconds !== undefined && cue.timeSeconds > durationSeconds) {
            errors.push(`${prefix} ("${String(cue.id)}") timestamp ${cue.timeSeconds} exceeds durationSeconds (${durationSeconds})`);
          }
          previousCueTime = Math.max(previousCueTime, cue.timeSeconds);
        }

        if (cue.kind !== undefined && !VALID_CUE_KINDS.has(cue.kind as MusicCueKind)) {
          errors.push(`${prefix}.kind "${String(cue.kind)}" must be "cue", "transition", or "end"`);
        }
        if (cue.sectionId !== undefined) {
          if (!isNonEmptyString(cue.sectionId) || !sectionIds.has(cue.sectionId)) {
            errors.push(`${prefix}.sectionId "${String(cue.sectionId)}" is not declared in sections`);
          }
        }
        if (cue.label !== undefined && typeof cue.label !== 'string') {
          errors.push(`${prefix}.label must be a string when provided`);
        }
        if (cue.tags !== undefined) {
          if (!Array.isArray(cue.tags) || cue.tags.some((t) => !isNonEmptyString(t))) {
            errors.push(`${prefix}.tags must be an array of non-empty strings when provided`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, sheet: input as unknown as MusicCueSheet };
}

export function assertValidMusicCueSheet(
  input: unknown,
  options?: CueSheetValidationOptions,
): MusicCueSheet {
  const result = validateMusicCueSheet(input, options);
  if (!result.ok) {
    throw new MusicCueSheetValidationError(result.errors);
  }
  return result.sheet;
}

export function beatOffsetToSeconds(beatGrid: MusicBeatGrid, beatsFromOrigin: number): number {
  const offset = beatGrid.offsetSeconds ?? 0;
  return offset + (beatsFromOrigin * 60) / beatGrid.bpm;
}

export function barBeatToSeconds(
  beatGrid: MusicBeatGrid,
  barIndexZeroBased: number,
  beatIndexZeroBased = 0,
): number {
  const beatsPerBar = beatGrid.timeSignature?.numerator ?? 4;
  return beatOffsetToSeconds(beatGrid, barIndexZeroBased * beatsPerBar + beatIndexZeroBased);
}

export function secondsToBeatPosition(beatGrid: MusicBeatGrid, seconds: number): MusicBeatPosition {
  const offset = beatGrid.offsetSeconds ?? 0;
  const elapsed = Math.max(0, seconds - offset);
  const beatDuration = 60 / beatGrid.bpm;
  const totalBeats = elapsed / beatDuration;
  const beatsPerBar = beatGrid.timeSignature?.numerator ?? 4;
  const bar = Math.floor(totalBeats / beatsPerBar);
  const beatInBar = totalBeats - bar * beatsPerBar;
  return { beat: totalBeats, bar, beatInBar };
}

function nextGridStepSeconds(
  offsetSeconds: number,
  stepDurationSeconds: number,
  currentSeconds: number,
  minLeadSeconds: number,
): number {
  const safeNow = Math.max(0, currentSeconds) + Math.max(0, minLeadSeconds);
  if (safeNow < offsetSeconds - 1e-9) {
    return offsetSeconds;
  }
  const index = Math.floor((safeNow - offsetSeconds) / stepDurationSeconds + 1e-9) + 1;
  return offsetSeconds + index * stepDurationSeconds;
}

export function nextBeatTimeSeconds(
  beatGrid: MusicBeatGrid,
  currentSeconds: number,
  minLeadSeconds = 0,
): number {
  const offset = beatGrid.offsetSeconds ?? 0;
  const beatDuration = 60 / beatGrid.bpm;
  return nextGridStepSeconds(offset, beatDuration, currentSeconds, minLeadSeconds);
}

export function nextBarTimeSeconds(
  beatGrid: MusicBeatGrid,
  currentSeconds: number,
  minLeadSeconds = 0,
): number {
  const offset = beatGrid.offsetSeconds ?? 0;
  const beatsPerBar = beatGrid.timeSignature?.numerator ?? 4;
  const barDuration = (60 / beatGrid.bpm) * beatsPerBar;
  return nextGridStepSeconds(offset, barDuration, currentSeconds, minLeadSeconds);
}

export function resolveLoopRegionById(
  sheet: MusicCueSheet,
  regionId: string,
): MusicLoopRegion | null {
  if (sheet.loopRegion?.id === regionId) return sheet.loopRegion;
  if (sheet.loopRegions) {
    for (const region of sheet.loopRegions) {
      if (region.id === regionId) return region;
    }
  }
  return null;
}

export function resolveDefaultLoopRegion(sheet: MusicCueSheet): MusicLoopRegion | null {
  if (sheet.defaultLoopRegionId) {
    return resolveLoopRegionById(sheet, sheet.defaultLoopRegionId);
  }
  return sheet.loopRegion ?? null;
}

export interface NextMatchingCueOptions {
  readonly kind?: MusicCueKind;
  readonly cueId?: string;
  readonly tag?: string;
  readonly sectionId?: string;
  readonly activeLoopRegion?: MusicLoopRegion | null;
  readonly minLeadSeconds?: number;
}

export interface NextMatchingCueResult {
  readonly cue: MusicNamedCue;
  readonly targetSeconds: number;
  readonly wrapsLoop: boolean;
}

export function nextMatchingCue(
  sheet: MusicCueSheet,
  currentSeconds: number,
  options: NextMatchingCueOptions = {},
): NextMatchingCueResult | null {
  const cues = sheet.cues;
  if (!cues || cues.length === 0) return null;

  const matches = (cue: MusicNamedCue): boolean => {
    if (options.cueId !== undefined && cue.id !== options.cueId) return false;
    if (options.kind !== undefined && (cue.kind ?? 'cue') !== options.kind) return false;
    if (options.sectionId !== undefined && cue.sectionId !== options.sectionId) return false;
    if (options.tag !== undefined && !(cue.tags?.includes(options.tag) ?? false)) return false;
    return true;
  };

  const threshold = Math.max(0, currentSeconds) + Math.max(0, options.minLeadSeconds ?? 0);
  const loop = options.activeLoopRegion ?? null;

  for (const cue of cues) {
    if (!matches(cue)) continue;
    if (cue.timeSeconds > threshold + 1e-9) {
      if (!loop || cue.timeSeconds <= loop.endSeconds + 1e-9) {
        return { cue, targetSeconds: cue.timeSeconds, wrapsLoop: false };
      }
    }
  }

  if (loop) {
    for (const cue of cues) {
      if (!matches(cue)) continue;
      if (cue.timeSeconds >= loop.startSeconds - 1e-9 && cue.timeSeconds <= loop.endSeconds + 1e-9) {
        return { cue, targetSeconds: cue.timeSeconds, wrapsLoop: true };
      }
    }
  }

  return null;
}
