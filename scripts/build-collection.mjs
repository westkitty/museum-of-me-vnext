#!/usr/bin/env node
// Generates src/content/collection.generated.ts from the frozen data layer.
// Run after editing anything in data/. The output is committed.
import { writeFileSync } from 'node:fs';
import { readJson, walk } from './_lib.mjs';

const map = readJson('data/exhibit-mapping.json');
const copy = readJson('data/exhibit-content.json');

const projects = [];
for (const f of walk('data/projects', ['.json'])) projects.push(...readJson(f));
projects.sort((a, b) => a.id.localeCompare(b.id));

const exhibits = map.exhibits.map((e) => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  wing: e.wing,
  tier: e.tier,
  projectIds: e.projects,
  copy: copy[e.id],
}));

const wings = [
  { id: 'north', name: 'Starsilk & Drakken', subtitle: 'North Wing', level: 0,
    blurb: 'A programmable universe and the creatures built to terraform it. Obsidian, indigo, star-metal; the tallest volume in the building.' },
  { id: 'east', name: 'Dex Systems', subtitle: 'East Wing', level: 0,
    blurb: 'Nineteen tools built to run on your own machine. White stone, steel, dark teal — a laboratory, not a showroom.' },
  { id: 'south', name: 'Games & Play', subtitle: 'South Wing', level: 0,
    blurb: 'Twelve games and playable systems, from a finished birthday gift to a browser 4X. Warm rust, wood, theatrical light.' },
  { id: 'west', name: 'Archive & Canon', subtitle: 'West Wing', level: 0,
    blurb: 'How work remembers itself. Violet, parchment and bronze; the quietest and most scholarly wing.' },
  { id: 'media', name: 'Music, Promptcraft & Media', subtitle: 'Northwest Mezzanine', level: 1,
    blurb: 'Craft applied to generative tools — songwriting doctrine, prompt systems, orchestration, media lineages.' },
  { id: 'infra', name: 'Local Systems', subtitle: 'Northeast Mezzanine', level: 1,
    blurb: 'The machinery behind everything else. Which machine does the work, and where nothing is permitted to go.' },
];

const header = `// GENERATED FILE — do not edit by hand.
// Source: data/exhibit-mapping.json, data/exhibit-content.json, data/projects/*.json
// Regenerate: npm run build:collection
// prettier-ignore
import type { Collection } from './types';

export const COLLECTION: Collection = `;

const body = JSON.stringify({ projects, exhibits, wings }, null, 2);

const footer = ` as const;

export const PROJECTS_BY_ID = new Map(COLLECTION.projects.map((p) => [p.id, p]));
export const EXHIBITS_BY_ID = new Map(COLLECTION.exhibits.map((e) => [e.id, e]));
export const EXHIBITS_BY_SLUG = new Map(COLLECTION.exhibits.map((e) => [e.slug, e]));
export const WINGS_BY_ID = new Map(COLLECTION.wings.map((w) => [w.id, w]));

export function projectsForExhibit(exhibitId: string) {
  const e = EXHIBITS_BY_ID.get(exhibitId);
  if (!e) return [];
  return e.projectIds.map((id) => PROJECTS_BY_ID.get(id)!).filter(Boolean);
}

export function exhibitsForWing(wing: string) {
  return COLLECTION.exhibits.filter((e) => e.wing === wing);
}
`;

writeFileSync('src/content/collection.generated.ts', header + body + footer);
console.log(`✓ collection: ${projects.length} projects, ${exhibits.length} exhibits, ${wings.length} wings`);
