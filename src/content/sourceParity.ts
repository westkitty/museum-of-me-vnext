import visitorsJson from '../../data/source-parity/visitors.json';
import installationsJson from '../../data/source-parity/installations.json';
import supplementaryJson from '../../data/source-parity/supplementary.json';
import sanctuaryJson from '../../data/source-parity/sanctuary.json';
import assetsJson from '../../data/source-parity/curated-assets.json';
import manifestJson from '../../data/source-parity/manifest.json';
import { faceDirection, place, GROUND_Y, LEVEL_1_Y, ROTUNDA_APOTHEM, SANCTUARY_CENTER, SANCTUARY_DIR, WINGS, type Vec3 } from '../world/layout';

export const SOURCE_THREE_VERSION = '0.185.1';
export const SOURCE_THREE_REVISION = '185';
export const SOURCE_PRIMARY_COUNT = 14;
export const SOURCE_SUPPLEMENTARY_COUNT = 15;
export const SOURCE_PROJECT_COUNT = 29;
export const SOURCE_VISITOR_COUNT = 17;
export const SOURCE_WITNESSABLE_COUNT = 46;
export const SOURCE_RASTER_COUNT = 9;

export interface SourceInstallation {
  readonly id: string;
  readonly title: string;
  readonly wing: string;
  readonly position: readonly number[];
  readonly radius: number;
  readonly accent: readonly number[];
  readonly build: string;
  readonly stage: string;
  readonly summary: string;
  readonly truth?: string;
  readonly controls?: readonly (readonly (string | boolean)[])[];
}

export interface SourceVisitor {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly position: readonly number[];
  readonly route: readonly (readonly number[])[];
  readonly speed: number;
  readonly pause: readonly number[];
  readonly height: number;
  readonly width: number;
  readonly palette: { coat: number[]; shirt: number[]; trousers: number[]; skin: number[]; hair: number[] };
  readonly prop?: string;
  readonly lines: readonly string[];
  readonly thoughts: readonly string[];
  readonly staff?: boolean;
  readonly seated?: boolean;
  readonly group?: string;
  readonly gesture?: string;
  readonly dialogueMode?: string;
  readonly focusIds?: readonly string[];
  readonly reactsTo?: readonly string[];
}

export interface SourceSupplementary {
  readonly id: string;
  readonly title: string;
  readonly stage: string;
  readonly summary: string;
  readonly accent: readonly number[];
  readonly keywords?: readonly string[];
  readonly kind?: string;
  readonly wall?: string;
  readonly z?: number;
  readonly caseType?: string;
  readonly asset?: string;
}

export interface CuratedRaster {
  readonly id: string;
  readonly fileName: string;
  readonly role: string;
  readonly usage: string;
  readonly mime: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly source: string;
  readonly relativePath: string;
}

export const SOURCE_INSTALLATIONS = installationsJson as SourceInstallation[];
export const SOURCE_VISITORS = visitorsJson as SourceVisitor[];
export const SOURCE_SUPPLEMENTARY = supplementaryJson as SourceSupplementary[];
export const CURATED_RASTERS = assetsJson as CuratedRaster[];
export const SOURCE_SANCTUARY = sanctuaryJson as {
  scentPath: number[][];
  composition: {
    focalPoint: number[];
    scentPath: number[][];
    referencePanelXs: number[];
    dialogueMode: string;
  };
  modelLock: {
    identity: string;
    species: string;
    stance: string;
    ears: string;
    eyes: string;
    blindnessCue: string;
    coat: string[];
    requiredFeatures: string[];
    modes: string[];
    reference: string;
  };
};
export const SOURCE_AUTHORITY = manifestJson;

export const PRIMARY_TO_VNEXT = SOURCE_AUTHORITY.primaryToVNext as Record<string, string>;
export const SUPPLEMENTARY_TO_VNEXT = SOURCE_AUTHORITY.supplementaryToVNext as Record<string, string>;

const VISITOR_WING: Record<string, 'north' | 'south' | 'east' | 'west' | 'rotunda' | 'sanctuary'> = {
  'curator-archive': 'north',
  'visitor-katamari': 'south',
  'visitor-myth': 'west',
  'visitor-local': 'east',
  'visitor-analyst': 'east',
  'visitor-memory': 'east',
  'visitor-access': 'sanctuary',
  docent: 'rotunda',
  guard: 'rotunda',
  conservator: 'west',
  'student-a': 'north',
  'student-b': 'north',
  sketcher: 'south',
  architect: 'rotunda',
  pilgrim: 'sanctuary',
  'research-pair-a': 'north',
  'research-pair-b': 'north',
};

/** vNext-safe authored routes. Source identities are preserved; old coordinates would collide with the later building. */
export function visitorRouteForVNext(id: string): Vec3[] {
  const zone = VISITOR_WING[id] ?? 'rotunda';
  if (zone === 'rotunda') {
    const radius = 10.4 + (id.length % 5) * 0.35;
    const points: Vec3[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + id.length * 0.08;
      points.push([Math.sin(a) * radius, GROUND_Y, Math.cos(a) * radius]);
    }
    return points;
  }
  if (zone === 'sanctuary') {
    const dir = SANCTUARY_DIR;
    return [
      place(dir, ROTUNDA_APOTHEM + 4, 1.4, GROUND_Y),
      place(dir, ROTUNDA_APOTHEM + 18, 1.1, GROUND_Y),
      place(dir, ROTUNDA_APOTHEM + 28, 0.6, -2),
      [SANCTUARY_CENTER[0] + 3.2, SANCTUARY_CENTER[1], SANCTUARY_CENTER[2] + 4.5],
      place(dir, ROTUNDA_APOTHEM + 18, -1.1, GROUND_Y),
    ];
  }
  const wing = WINGS.find((w) => w.id === zone);
  if (!wing) return visitorRouteForVNext('docent');
  const dir = faceDirection(wing.face);
  const y = wing.level === 1 ? LEVEL_1_Y : GROUND_Y;
  const lateral = zone === 'south' ? 2.4 : zone === 'east' ? -2.1 : 1.6;
  return [
    place(dir, ROTUNDA_APOTHEM + 3, lateral, y),
    place(dir, wing.hallFrom + 8, lateral, y),
    place(dir, Math.min(wing.hallTo - 8, wing.hallFrom + 36), lateral * 0.4, y),
    place(dir, wing.hallFrom + 8, -lateral, y),
  ];
}

export function sourceArtworkForExhibit(exhibitId: string): CuratedRaster | undefined {
  const roleByExhibit: Record<string, string> = {
    E01: 'project-art-starsilk-atlas',
    E03: 'project-art-orbital-tomb',
    E07: 'project-art-drakken-sandbox',
    E26: 'project-art-westcat-familiar',
    E32: 'project-art-smores-katamari',
  };
  const role = roleByExhibit[exhibitId];
  return role ? CURATED_RASTERS.find((a) => a.role === role) : undefined;
}

export const DEXTER_ARTWORK = CURATED_RASTERS.filter(
  (a) => a.role === 'project-art-dexgpt' || a.role === 'dexter-turnaround-reference',
);

export const SHELL_ARTWORK = CURATED_RASTERS.find((a) => a.role === 'museum-shell-background');
export const ENTRANCE_ARTWORK = CURATED_RASTERS.find((a) => a.role === 'entrance-background');
