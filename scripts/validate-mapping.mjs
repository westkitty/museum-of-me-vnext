#!/usr/bin/env node
// Gate: every project maps to exactly one exhibit. No missing project, no duplicate mapping.
import { readJson, walk, report } from './_lib.mjs';

const errors = [];
const map = readJson('data/exhibit-mapping.json');
const exhibits = map.exhibits;

if (exhibits.length !== 35) errors.push(`expected 35 exhibits, found ${exhibits.length}`);

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
    if (projectOwner.has(p)) {
      errors.push(`project ${p} mapped twice: ${projectOwner.get(p)} and ${e.id}`);
    }
    projectOwner.set(p, e.id);
  }
}

// Every project with authored museum copy must be mapped, and vice versa.
const copy = new Map();
for (const f of walk('data/projects', ['.json'])) {
  for (const p of readJson(f)) {
    if (copy.has(p.id)) errors.push(`duplicate project copy for ${p.id}`);
    copy.set(p.id, p);
  }
}
if (copy.size !== 64) errors.push(`expected 64 project records, found ${copy.size}`);

for (const id of projectOwner.keys()) {
  if (!copy.has(id)) errors.push(`exhibit ${projectOwner.get(id)} references unknown project ${id}`);
}
for (const id of copy.keys()) {
  if (!projectOwner.has(id)) errors.push(`project ${id} has copy but is not represented by any exhibit`);
}

// Required copy fields.
const REQUIRED = ['id', 'name', 'family', 'kind', 'status', 'summary', 'brief', 'deep', 'capabilities', 'lesson'];
for (const [id, p] of copy) {
  for (const k of REQUIRED) {
    if (p[k] === undefined || p[k] === null || p[k] === '') errors.push(`${id}: missing field "${k}"`);
  }
  if (Array.isArray(p.deep) && p.deep.length < 2) errors.push(`${id}: deep needs at least 2 paragraphs`);
}

// Exhibit interpretive copy.
const ec = readJson('data/exhibit-content.json');
for (const e of exhibits) {
  const c = ec[e.id];
  if (!c) { errors.push(`${e.id}: no interpretive content`); continue; }
  for (const k of ['subtitle', 'plaque', 'problem', 'made', 'interaction', 'explore']) {
    if (!c[k]) errors.push(`${e.id}: interpretive content missing "${k}"`);
  }
}

process.exit(
  report('mapping', errors, [
    `${exhibits.length} exhibits`,
    `${projectOwner.size} project identities represented`,
    `${copy.size} authored project records`,
  ]),
);
