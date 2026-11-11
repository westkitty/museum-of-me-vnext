#!/usr/bin/env node
/**
 * Generate The_Reliquary_of_Iterative_Becoming.html from the modular build.
 * Does not overwrite historical source artifacts in the parent directory.
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-standalone');
const outDir = join(root, 'release');
const outFile = join(outDir, 'The_Reliquary_of_Iterative_Becoming.html');
const embeddedSource = join(dist, 'embedded');
const embeddedOutput = join(outDir, 'embedded');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('standalone: dist/index.html missing; run vite build first');
  process.exit(1);
}

function mimeFor(file) {
  if (file.endsWith('.js')) return 'text/javascript';
  if (file.endsWith('.css')) return 'text/css';
  if (file.endsWith('.wasm')) return 'application/wasm';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.avif')) return 'image/avif';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = walk(join(dist, 'assets'));
const encoded = new Map();
for (const file of assets) {
  const rel = relative(dist, file).replaceAll('\\', '/');
  const bytes = readFileSync(file);
  encoded.set(rel, `data:${mimeFor(file)};base64,${bytes.toString('base64')}`);
}

// Offline authored artwork stays inside the portable HTML document.
// Refuse missing or tampered files before producing a release.
const authoredSource = JSON.parse(readFileSync(join(root, 'data/workshop-placements.json'), 'utf8'));
const embeddedWorkshopMedia = {};
for (const item of authoredSource.objects ?? []) {
  const image = item.image;
  if (!image) continue;
  if (!/^workshop-media\/[0-9a-f]{64}\.webp$/.test(image)) {
    throw new Error(`standalone: unsupported authored media reference: ${image}`);
  }
  if (embeddedWorkshopMedia[image]) continue;
  const bytes = readFileSync(join(dist, image));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length < 20 || bytes.length > 3 * 1024 * 1024
    || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP'
    || bytes.readUInt32LE(4) !== bytes.length - 8
    || !['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))
    || hash !== image.slice('workshop-media/'.length, -'.webp'.length)) {
    throw new Error(`standalone: invalid, oversized or tampered authored image: ${image}`);
  }
  embeddedWorkshopMedia[image] = `data:image/webp;base64,${bytes.toString('base64')}`;
}
if (Object.keys(embeddedWorkshopMedia).length) {
  const payload = `<script type="application/json" id="museum-workshop-media">${JSON.stringify(embeddedWorkshopMedia)}</script>`;
  if (!html.includes('</head>')) throw new Error('standalone: HTML head not found for inline artwork');
  html = html.replace('</head>', `${payload}</head>`);
}

html = html.replace(/(?:src|href)="(\.\/assets\/[^"]+)"/g, (all, spec) => {
  const key = spec.replace(/^\.\//, '');
  const data = encoded.get(key);
  if (!data) return all;
  return all.replace(spec, data);
});

if (/src="https?:|href="https?:|import\(/.test(html) && /cdn\.|unpkg|jsdelivr/.test(html)) {
  console.error('standalone: generated HTML still references a CDN');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html);
// The Full Weasel is a complete first-party web application, not a texture we
// can safely flatten into the parent document. Keep its locally-built tree
// beside the standalone HTML so its relative URLs, media and iframe boundary
// remain intact under file:// without a network host.
if (existsSync(embeddedSource)) cpSync(embeddedSource, embeddedOutput, { recursive: true, force: true });
const digest = createHash('sha256').update(html).digest('hex');
writeFileSync(join(outDir, 'The_Reliquary_of_Iterative_Becoming.sha256'), `${digest}  The_Reliquary_of_Iterative_Becoming.html\n`);
console.log(`standalone: wrote ${relative(root, outFile)} (${html.length} bytes)`);
if (existsSync(embeddedSource)) console.log(`standalone: copied ${relative(root, embeddedOutput)} for local embedded artifacts`);
console.log(`sha256 ${digest}`);
