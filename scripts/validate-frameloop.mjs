#!/usr/bin/env node
// PRODUCT LAW 13 / plan §20: exactly one frame-loop owner.
import { readFileSync } from 'node:fs';
import { walk, report } from './_lib.mjs';

const OWNER = 'src/app/Loop.ts';
const errors = [];
const files = walk('src', ['.ts']);
let ownerHasLoop = false;

for (const f of files) {
  const norm = f.split('\\').join('/');
  const text = readFileSync(f, 'utf8');
  const hasRaf = /\brequestAnimationFrame\s*\(/.test(text);
  const hasInterval = /\bsetInterval\s*\(/.test(text);
  if (norm === OWNER) {
    ownerHasLoop = hasRaf;
    continue;
  }
  if (hasRaf) errors.push(`${norm}: calls requestAnimationFrame — only ${OWNER} may own a frame loop`);
  if (hasInterval) errors.push(`${norm}: calls setInterval — use update(dt) from the single loop`);
}

if (!ownerHasLoop) errors.push(`${OWNER}: expected the single requestAnimationFrame owner, found none`);

process.exit(report('frame-loop ownership', errors, [`${files.length} source files scanned`]));
