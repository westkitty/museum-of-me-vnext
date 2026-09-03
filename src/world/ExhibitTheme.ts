import { EXHIBITS_BY_ID, PROJECTS_BY_ID } from '../content/collection.generated';
import type { WingId } from '../content/types';

/**
 * Presentation-only colour grammar for exhibit bays.
 *
 * This deliberately reads the frozen collection metadata rather than adding a
 * parallel taxonomy to the mapping.  The metadata is reduced to a small,
 * stable room-language vocabulary; it does not alter project, exhibit, or hero
 * contracts.  A multi-project exhibit is classified from all of its linked
 * project families/kinds/capabilities, with the most specific signal winning.
 */
export interface ExhibitTheme {
  readonly id: string;
  readonly source: string;
  readonly wall: number;
  readonly trim: number;
  readonly floor: number;
}

const THEMES: Record<string, Omit<ExhibitTheme, 'id' | 'source'>> = {
  starsilk: { wall: 0x08283a, trim: 0x1a8fbe, floor: 0x061521 },
  dex: { wall: 0x10394f, trim: 0x32b9e8, floor: 0x0a1e2d },
  local: { wall: 0x123a35, trim: 0x48d9c1, floor: 0x081f1d },
  archive: { wall: 0x38264a, trim: 0xb780c1, floor: 0x21182e },
  prompt: { wall: 0x4a2a44, trim: 0xe08bc6, floor: 0x2a1728 },
  media: { wall: 0x4d3920, trim: 0xe0b65d, floor: 0x2a2011 },
  civic: { wall: 0x17434b, trim: 0x61c7cd, floor: 0x0c252a },
  games: { wall: 0x4a2534, trim: 0xf08a62, floor: 0x2a1420 },
  creative: { wall: 0x30325a, trim: 0x9b9cf4, floor: 0x1b1d36 },
  default: { wall: 0x27384a, trim: 0x6caed2, floor: 0x14212e },
};

/** Resolve an exhibit's environmental theme solely from existing collection metadata. */
export function resolveExhibitTheme(exhibitId: string, wing: WingId): ExhibitTheme {
  const exhibit = EXHIBITS_BY_ID.get(exhibitId);
  const projects = exhibit?.projectIds
    .map((id) => PROJECTS_BY_ID.get(id))
    .filter((project): project is NonNullable<typeof project> => Boolean(project)) ?? [];
  const source = projects
    .map((project) => `${project.family} ${project.kind} ${project.capabilities.join(' ')}`)
    .join(' ')
    .toLowerCase();

  const id = themeIdFor(source, wing);
  return { id, source, ...THEMES[id] };
}

function themeIdFor(source: string, wing: WingId): string {
  if (source.includes('starsilk') || source.includes('drakken')) return 'starsilk';
  if (source.includes('privacy') || source.includes('civic') || source.includes('geospatial')) return 'civic';
  if (source.includes('game') || source.includes('campaign') || source.includes('simulation')) return 'games';
  if (source.includes('dex')) return 'dex';
  if (source.includes('local ai') || source.includes('bigmac') || source.includes('inference')) return 'local';
  if (source.includes('archive') || source.includes('canon') || source.includes('continuity')) return 'archive';
  if (source.includes('prompt') || source.includes('agent') || source.includes('learning')) return 'prompt';
  if (source.includes('music') || source.includes('media') || source.includes('voice')) return 'media';
  if (source.includes('creative') || source.includes('visualization')) return 'creative';

  // The wing is an existing spatial classification, not a new content label.
  return wing === 'north' ? 'starsilk' : wing === 'east' ? 'dex' : wing === 'south' ? 'games' : 'default';
}
