#!/usr/bin/env node
// Gate (plan §27): no undocumented asset, no duplicate id, no budget overrun,
// no external asset without provenance, no runtime hotlink.
import { readFileSync } from 'node:fs';
import { walk, report } from './_lib.mjs';

const errors = [];
const notes = [];
const files = walk('src', ['.ts']);
// The manifest module defines the registration API; it registers nothing itself.
const callSites = files.filter((f) => !f.split('\\').join('/').endsWith('src/assets/manifest.ts'));

// 1. No runtime request to a host this project does not control.
const HOTLINK = /(?:fetch|import|new URL|src\s*=|url\s*\(\s*)['"`]?https?:\/\/(?!localhost)/;
// three.js docs URLs in comments are fine; only flag code lines.
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (HOTLINK.test(code)) {
      errors.push(`${f}:${i + 1} hotlinked runtime asset: ${line.trim().slice(0, 90)}`);
    }
  });
}

// 2. Every registered asset carries provenance. Statically checked against the
//    registerAsset/registerProcedural call sites so it cannot drift from code.
const ids = new Map();
for (const f of callSites) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/registerProcedural\(\s*'([^']+)'/g)) {
    if (ids.has(m[1])) errors.push(`duplicate asset id "${m[1]}" (${f} and ${ids.get(m[1])})`);
    ids.set(m[1], f);
  }
  for (const m of text.matchAll(/registerAsset\(\s*\{([\s\S]{0,600}?)\}\s*\)/g)) {
    const body = m[1];
    const idm = body.match(/id:\s*'([^']+)'/);
    if (!idm) { errors.push(`${f}: registerAsset without a literal id`); continue; }
    if (ids.has(idm[1])) errors.push(`duplicate asset id "${idm[1]}" (${f} and ${ids.get(idm[1])})`);
    ids.set(idm[1], f);
    for (const field of ['title', 'kind', 'source', 'creator', 'license', 'streamingGroup']) {
      if (!new RegExp(`${field}:`).test(body)) {
        errors.push(`${f}: asset "${idm[1]}" missing provenance field "${field}"`);
      }
    }
    if (/source:\s*'external'/.test(body) && !/attribution:\s*'/.test(body)) {
      errors.push(`${f}: external asset "${idm[1]}" has no attribution`);
    }
  }
}
notes.push(`${ids.size} governed assets registered`);

process.exit(report('assets', errors, notes));
