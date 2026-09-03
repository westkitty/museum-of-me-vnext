#!/usr/bin/env node
// Gate: every current project maps to exactly one of the 35 stable physical exhibit slots.
// Project count is deliberately not frozen: the collection is a living autobiography.
import { existsSync } from 'node:fs';
import { readJson, walk, report } from './_lib.mjs';

const errors = [];
const mappingPath = existsSync('data/exhibit-mapping.current.json')
  ? 'data/exhibit-mapping.current.json'
  : 'data/exhibit-mapping.json';
const map = readJson(mappingPath);
const exhibits = map.exhibits;

if (exhibits.length !== 35) errors.push(`expected 35 physical exhibit slots, found ${exhibits.length}`);

const seenId = new Set();
const seenSlug = new Set();
const projectOwner = new Map();
const WINGS = new Set(['north', 'south', 'east', 'west', 'media', 'infra']);
const TIERS = new Set(['A', 'B', 'C']);

for (const e of exhibits) {
  if (seenId.has(e.id)) errors.push(`duplicate exhibit id ${e.id}`);
  seenId.add(e.id);
  if (seenSlug.has(e.slug)) errors.push(`duplicate exhibit slug ${e.slug}`);
  seenSlug.add(e.slug);
  if (!WINGS.has(e.wing)) errors.push(`${e.id}: unknown wing "${e.wing}"`);
  if (!TIERS.has(e.tier)) errors.push(`${e.id}: unknown tier "${e.tier}"`);
  if (!e.projects?.length) errors.push(`${e.id}: represents no project`);
  for (const p of e.projects) {
    if (projectOwner.has(p)) errors.push(`project ${p} mapped twice: ${projectOwner.get(p)} and ${e.id}`);
    projectOwner.set(p, e.id);
  }
}

const copy = new Map();
for (const f of walk('data/projects', ['.json'])) {
  for (const p of readJson(f)) {
    if (copy.has(p.id)) errors.push(`duplicate project copy for ${p.id}`);
    copy.set(p.id, p);
  }
}

for (const id of projectOwner.keys()) {
  if (!copy.has(id)) errors.push(`exhibit ${projectOwner.get(id)} references unknown project ${id}`);
}
for (const id of copy.keys()) {
  if (!projectOwner.has(id)) errors.push(`project ${id} has copy but is not represented by any current exhibit`);
}
if (projectOwner.size !== copy.size) {
  errors.push(`mapping represents ${projectOwner.size} identities but ${copy.size} authored current project records exist`);
}

const REQUIRED = ['id', 'name', 'family', 'kind', 'status', 'summary', 'brief', 'deep', 'capabilities', 'lesson'];
for (const [id, p] of copy) {
  for (const k of REQUIRED) {
    if (p[k] === undefined || p[k] === null || p[k] === '') errors.push(`${id}: missing field "${k}"`);
  }
  if (!Array.isArray(p.deep)) errors.push(`${id}: deep must be an array of paragraphs, got ${typeof p.deep}`);
  else if (p.deep.length < 2) errors.push(`${id}: deep needs at least 2 paragraphs`);
}

const base = readJson('data/exhibit-content.json');
const overlays = existsSync('data/exhibit-content.revision2.json') ? readJson('data/exhibit-content.revision2.json') : {};
const ec = { ...base, ...overlays };
for (const e of exhibits) {
  const c = ec[e.id];
  if (!c) { errors.push(`${e.id}: no interpretive content`); continue; }
  for (const k of ['subtitle', 'plaque', 'problem', 'made', 'interaction', 'explore']) {
    if (!c[k]) errors.push(`${e.id}: interpretive content missing "${k}"`);
  }
}

process.exit(report('mapping', errors, [
  `${exhibits.length} stable exhibit slots`,
  `${projectOwner.size} current project identities represented`,
  `${copy.size} authored current project records`,
  `mapping source: ${mappingPath}`,
]));
