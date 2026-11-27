#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The release dist by default; a directory argument checks another build (used by its regression test).
const root = process.argv[2] ?? 'dist';
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

for (const required of [join(root, 'index.html'), join(root, '_headers')]) {
  if (!existsSync(required)) errors.push(`missing ${required}`);
}

const files = filesUnder(root);
const rel = files.map((file) => relative(root, file).replaceAll('\\', '/'));
const suspicious = rel.filter((name) => /(^|\/)(\.env|id_rsa|id_ed25519)|\.(pem|key|p12|log)$/i.test(name));
if (suspicious.length) errors.push(`suspicious files in dist: ${suspicious.join(', ')}`);
const privateImports = rel.filter((name) => /^(?:workshop-models|workshop-media)\//.test(name));
if (privateImports.length) errors.push('private Workshop imports must not be included in public distribution');

const index = existsSync(join(root, 'index.html')) ? readFileSync(join(root, 'index.html'), 'utf8') : '';
if (!/\.\/assets\/[^"']+-[A-Za-z0-9_-]+\.js/.test(index)) {
  errors.push('index.html does not reference a hashed JavaScript asset');
}
if (!/\.\/assets\/[^"']+-[A-Za-z0-9_-]+\.css/.test(index)) {
  errors.push('index.html does not reference a hashed CSS asset');
}

const headers = existsSync(join(root, '_headers')) ? readFileSync(join(root, '_headers'), 'utf8') : '';
for (const required of [
  'Cache-Control: public, max-age=31536000, immutable',
  'X-Content-Type-Options: nosniff',
  'Content-Security-Policy:',
  "frame-ancestors 'none'",
]) {
  if (!headers.includes(required)) errors.push(`_headers is missing required release rule: ${required}`);
}

// Pocket worlds are dormant in ordinary builds (src/world/pocket/productionWorlds.ts
// and the vite.config.ts rehearsal gate). No world chunk, no W01 stem and no
// rehearsal activation code may reach a published dist, even as an orphan
// asset nobody imports: a dead dynamic import still makes Rollup emit them.
const worldFiles = rel.filter((name) => /(^|\/)(create(W\d\d|L01)World|productionWorlds|w01-(bass|drums|other))-[^/]+\.(js|m4a)$/.test(name)
  || /\.m4a$/i.test(name) && /(^|\/)w\d\d-/i.test(name));
if (worldFiles.length) errors.push(`pocket-world files leaked into the ordinary build: ${worldFiles.join(', ')}`);

const jsChunks = rel.filter((name) => /^assets\/.+\.js$/.test(name));
for (const chunk of jsChunks) {
  const text = readFileSync(join(root, chunk), 'utf8');
  for (const marker of ['rehearsalPrefix', 'rehearsalObserve']) {
    if (text.includes(marker)) errors.push(`rehearsal activation code leaked into ${chunk}: ${marker}`);
  }
}
const cssChunks = rel.filter((name) => /^assets\/.+\.css$/.test(name));
if (jsChunks.length < 2) errors.push(`expected multiple production JavaScript chunks, found ${jsChunks.length}`);

// Museum Workshop is a local development authoring tool. The declarative
// placement runtime belongs in production; editor UI and the filesystem write
// endpoint absolutely do not. Build-time dead-code elimination must prove that
// separation on every release build.
const workshopRuntimeMarkers = [
  'Visitor Choreographer',
  'Nominal source-route evidence',
  'choreo-launcher',
  '/__museum-workshop/save',
  '/__museum-cinema/programme',
  '/__museum-workshop/tge-thumbnail',
  '/__museum-workshop/tge-import',
  '/__museum-workshop/tge-status',
  'museum-workshop-source',
  'blaster-kit/blaster-a',
  'Museum Workshop development editor',
  'museum-workshop-transform-controls',
  // The shared Three.js DevTools bridge hook is development-only.
  'museumDevtools',
];
for (const chunk of jsChunks) {
  const text = readFileSync(join(root, chunk), 'utf8');
  for (const marker of workshopRuntimeMarkers) {
    if (text.includes(marker)) errors.push(`development-only editor marker leaked into ${chunk}: ${marker}`);
  }
}
for (const chunk of cssChunks) {
  const text = readFileSync(join(root, chunk), 'utf8');
  if (text.includes('.museum-workshop') || text.includes('.choreo-')) {
    errors.push(`development-only editor styles leaked into ${chunk}`);
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
console.log('  - development-only Workshop, Choreographer and DevTools hook excluded from production');
console.log('  - no pocket-world chunk, W01 stem or rehearsal activation code in the ordinary build');
