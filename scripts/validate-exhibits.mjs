#!/usr/bin/env node
// Gate (plan Phase 8/9): every exhibit has a bespoke implementation and none
// still resolves to the construction scaffolding.
import { readFileSync } from 'node:fs';
import { readJson, report } from './_lib.mjs';

const errors = [];
const notes = [];

const map = readJson('data/exhibit-mapping.json');
const index = readFileSync('src/exhibits/index.ts', 'utf8');

const bespoke = new Set();
for (const m of index.matchAll(/registerBespoke\(\s*'([^']+)'/g)) bespoke.add(m[1]);

for (const e of map.exhibits) {
  if (!bespoke.has(e.id)) {
    errors.push(`${e.id} (${e.title}) still resolves to ProvisionalExhibit scaffolding`);
  }
}
for (const id of bespoke) {
  if (!map.exhibits.some((e) => e.id === id)) errors.push(`unknown exhibit "${id}" registered`);
}

notes.push(`${bespoke.size} of ${map.exhibits.length} exhibits implemented bespoke`);

process.exit(report('exhibits', errors, notes));
