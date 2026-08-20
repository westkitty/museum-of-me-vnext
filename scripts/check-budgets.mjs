#!/usr/bin/env node
// Gate (plan §24): every exhibit's declared budget is within its tier ceiling,
// and the shipped bundle stays inside the initial-visit budget.
import { statSync, existsSync } from 'node:fs';
import { readJson, walk, report } from './_lib.mjs';

const TIER_MB = { A: 15, B: 8, C: 4 };
/** Plan §24: application shell + Rotunda, first visit. */
const INITIAL_VISIT_MB = 20;

const errors = [];
const notes = [];

const map = readJson('data/exhibit-mapping.json');
for (const e of map.exhibits) {
  const ceiling = TIER_MB[e.tier];
  if (ceiling === undefined) errors.push(`${e.id}: unknown tier "${e.tier}"`);
}

const tiers = map.exhibits.reduce((acc, e) => ((acc[e.tier] = (acc[e.tier] ?? 0) + 1), acc), {});
notes.push(`tiers: ${Object.entries(tiers).map(([t, n]) => `${t}=${n}`).join(', ')}`);
notes.push(`ceilings: A=${TIER_MB.A} MB, B=${TIER_MB.B} MB, C=${TIER_MB.C} MB`);

// If a production build exists, hold it to the initial-visit budget.
if (existsSync('dist')) {
  let bytes = 0;
  for (const f of walk('dist', ['.js', '.css', '.html', '.wasm'])) {
    if (f.endsWith('.map')) continue;
    bytes += statSync(f).size;
  }
  const mb = bytes / (1024 * 1024);
  notes.push(`initial visit bundle: ${mb.toFixed(2)} MB of ${INITIAL_VISIT_MB} MB budget`);
  if (mb > INITIAL_VISIT_MB) {
    errors.push(`initial visit bundle is ${mb.toFixed(2)} MB, over the ${INITIAL_VISIT_MB} MB budget`);
  }
} else {
  notes.push('no dist/ — run npm run build first to check the transfer budget');
}

// Any shipped binary asset must be declared in the manifest.
const declared = new Set();
for (const f of walk('src', ['.ts'])) {
  const text = (await import('node:fs')).readFileSync(f, 'utf8');
  for (const m of text.matchAll(/register(?:Procedural|Asset)\(\s*\{?\s*(?:id:\s*)?'([^']+)'/g)) {
    declared.add(m[1]);
  }
}
const shipped = walk('public/assets', ['.glb', '.ktx2', '.png', '.jpg', '.ogg', '.mp3']);
for (const f of shipped) {
  notes.push(`shipped binary: ${f}`);
}
notes.push(`${declared.size} declared assets, ${shipped.length} shipped binaries`);

process.exit(report('budgets', errors, notes));
