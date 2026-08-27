#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'dist';
const errors = [];

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

if (!existsSync(root)) {
  console.error('release dist: FAIL\n  - dist/ does not exist; run npm run build first');
  process.exit(1);
}

for (const required of ['dist/index.html', 'dist/_headers']) {
  if (!existsSync(required)) errors.push(`missing ${required}`);
}

const files = filesUnder(root);
const rel = files.map((file) => relative(root, file).replaceAll('\\', '/'));
const suspicious = rel.filter((name) => /(^|\/)(\.env|id_rsa|id_ed25519)|\.(pem|key|p12|log)$/i.test(name));
if (suspicious.length) errors.push(`suspicious files in dist: ${suspicious.join(', ')}`);

const index = existsSync('dist/index.html') ? readFileSync('dist/index.html', 'utf8') : '';
if (!/\.\/assets\/[^"']+-[A-Za-z0-9_-]+\.js/.test(index)) {
  errors.push('index.html does not reference a hashed JavaScript asset');
}
if (!/\.\/assets\/[^"']+-[A-Za-z0-9_-]+\.css/.test(index)) {
  errors.push('index.html does not reference a hashed CSS asset');
}

const headers = existsSync('dist/_headers') ? readFileSync('dist/_headers', 'utf8') : '';
for (const required of [
  'Cache-Control: public, max-age=31536000, immutable',
  'X-Content-Type-Options: nosniff',
  'Content-Security-Policy:',
  "frame-ancestors 'none'",
]) {
  if (!headers.includes(required)) errors.push(`_headers is missing required release rule: ${required}`);
}

const jsChunks = rel.filter((name) => /^assets\/.+\.js$/.test(name));
const cssChunks = rel.filter((name) => /^assets\/.+\.css$/.test(name));
if (jsChunks.length < 2) errors.push(`expected multiple production JavaScript chunks, found ${jsChunks.length}`);

// Museum Workshop is a local development authoring tool. The declarative
// placement runtime belongs in production; editor UI and the filesystem write
// endpoint absolutely do not. Build-time dead-code elimination must prove that
// separation on every release build.
const workshopRuntimeMarkers = [
  '/__museum-workshop/save',
  'Museum Workshop development editor',
  'museum-workshop-transform-controls',
];
for (const chunk of jsChunks) {
  const text = readFileSync(join(root, chunk), 'utf8');
  for (const marker of workshopRuntimeMarkers) {
    if (text.includes(marker)) errors.push(`development-only Workshop marker leaked into ${chunk}: ${marker}`);
  }
}
for (const chunk of cssChunks) {
  const text = readFileSync(join(root, chunk), 'utf8');
  if (text.includes('.museum-workshop')) {
    errors.push(`development-only Workshop styles leaked into ${chunk}`);
  }
}

if (errors.length) {
  console.error('release dist: FAIL');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
console.log('release dist: PASS');
console.log(`  - ${rel.length} files`);
console.log(`  - ${(bytes / 1024 / 1024).toFixed(2)} MB uncompressed build output`);
console.log(`  - ${jsChunks.length} JavaScript chunks`);
console.log('  - hashed assets, cache policy, CSP and secret-file denylist verified');
console.log('  - development-only Museum Workshop editor/write path excluded from production');
