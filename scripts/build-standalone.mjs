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
// Assemble only in-use textures and GLB models into the offline file.
// The catalog is a source-pinned local inventory. Never fetch external URLs.
const builderCatalog = JSON.parse(readFileSync(join(root, 'src/workshop/builderAssets.json'), 'utf8'));
const byModelId = new Map(builderCatalog.models.map((model) => [model.id, model]));
const byFinishId = new Map(builderCatalog.textures.map((finish) => [finish.id, finish]));
const surfaceFinishes = new Set([
  ...(authoredSource.objects ?? []).map((item) => item.texture),
  ...(authoredSource.surfaceOverrides ?? []).map((item) => item.texture),
].filter(Boolean));
for (const finish of surfaceFinishes) {
  if (embeddedWorkshopMedia[finish]) continue;
  const known = byFinishId.get(finish);
  if (known) {
    const path = known.path;
    if (!/^builder-assets\/openlife\/[a-z0-9_]+\.png$/.test(path)) {
      throw new Error('standalone: catalog finish has unsafe path');
    }
    const bytes = readFileSync(join(dist, path));
    if (bytes.length > 3 * 1024 * 1024 || bytes.length < 24
      || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error('standalone: invalid catalog texture: ' + finish);
    }
    embeddedWorkshopMedia[finish] = 'data:image/png;base64,' + bytes.toString('base64');
    continue;
  }
  if (!/^workshop-media\/[0-9a-f]{64}\.webp$/.test(finish)) {
    throw new Error('standalone: unapproved texture reference: ' + finish);
  }
  const bytes = readFileSync(join(dist, finish));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== finish.slice(15, -5)
    || bytes.length < 20 || bytes.length > 3 * 1024 * 1024
    || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('standalone: texture hash mismatch: ' + finish);
  }
  embeddedWorkshopMedia[finish] = 'data:image/webp;base64,' + bytes.toString('base64');
}
const modelRefs = new Set((authoredSource.objects ?? [])
  .map((item) => item.assetId).filter(Boolean));
for (const id of modelRefs) {
  const known = byModelId.get(id);
  let path;
  if (known) {
    path = known.path;
    if (!/^builder-assets\/openlife\/[a-z0-9_]+\.glb$/.test(path)) {
      throw new Error('standalone: unsafe catalog model path');
    }
  } else if (/^workshop-models\/[0-9a-f]{64}\.glb$/.test(id)) {
    path = id;
  } else {
    throw new Error('standalone: unknown model: ' + id);
  }
  const bytes = readFileSync(join(dist, path));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length < 32 || bytes.length > 8 * 1024 * 1024
    || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length
    || (known ? hash !== known.sha256 : hash !== id.slice(16, -4))) {
    throw new Error('standalone: invalid, oversized or tampered GLB ' + id);
  }
  embeddedWorkshopMedia[id] = 'data:application/octet-stream;base64,' + bytes.toString('base64');
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
