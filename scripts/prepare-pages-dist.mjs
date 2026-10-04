#!/usr/bin/env node
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = 'dist';
if (!existsSync(`${root}/index.html`)) {
  console.error('pages prepare: FAIL - dist/index.html missing');
  process.exit(1);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const sha = process.env.MUSEUM_BUILD_SHA || git(['rev-parse', 'HEAD']);
const ref = process.env.MUSEUM_BUILD_REF || git(['branch', '--show-current']) || 'detached';
const base = process.env.VITE_PUBLIC_BASE || '/museum-of-me-vnext/';

writeFileSync(`${root}/.nojekyll`, '');
copyFileSync(`${root}/index.html`, `${root}/404.html`);
writeFileSync(
  `${root}/build-info.json`,
  JSON.stringify({ version: 1, sha, ref, base }, null, 2) + '\n',
);

console.log('pages prepare: PASS');
console.log(`  - sha ${sha}`);
console.log(`  - ref ${ref}`);
console.log(`  - base ${base}`);
console.log('  - .nojekyll + SPA 404 fallback + exact revision receipt written');
