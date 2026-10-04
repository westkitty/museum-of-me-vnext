#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'dist';
const expectedBase = process.env.VITE_PUBLIC_BASE || '/museum-of-me-vnext/';
const expectedSha = process.env.MUSEUM_BUILD_SHA || '';
const errors = [];
const checks = [];

for (const required of ['index.html', '404.html', '.nojekyll', 'build-info.json']) {
  if (!existsSync(join(root, required))) errors.push(`missing dist/${required}`);
}

const index = existsSync(join(root, 'index.html')) ? readFileSync(join(root, 'index.html'), 'utf8') : '';
const fallback = existsSync(join(root, '404.html')) ? readFileSync(join(root, '404.html'), 'utf8') : '';
if (index && fallback && index !== fallback) errors.push('404.html is not an exact SPA fallback copy of index.html');

const refs = [...index.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/gi)].map((m) => m[1]);
if (!refs.some((ref) => ref.endsWith('.js'))) errors.push('Pages shell has no JavaScript asset reference');
if (!refs.some((ref) => ref.endsWith('.css'))) errors.push('Pages shell has no CSS asset reference');

for (const ref of refs) {
  if (!ref.startsWith(`${expectedBase}assets/`)) {
    errors.push(`asset does not use Pages base ${expectedBase}: ${ref}`);
    continue;
  }
  const local = ref.slice(expectedBase.length);
  if (!existsSync(join(root, local))) errors.push(`referenced Pages asset is missing: dist/${local}`);
}
if (refs.length) checks.push(`${refs.length} JS/CSS references use ${expectedBase} and exist`);

let info = null;
if (existsSync(join(root, 'build-info.json'))) {
  try {
    info = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8'));
  } catch {
    errors.push('build-info.json is invalid JSON');
  }
}
if (info) {
  if (info.base !== expectedBase) errors.push(`build-info base mismatch: ${info.base}`);
  if (expectedSha && info.sha !== expectedSha) errors.push(`build-info SHA mismatch: expected ${expectedSha}, found ${info.sha}`);
  checks.push(`build receipt sha=${info.sha}`);
}

if (errors.length) {
  console.error('pages dist: FAIL');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('pages dist: PASS');
for (const check of checks) console.log(`  - ${check}`);
console.log('  - .nojekyll and SPA fallback present');
