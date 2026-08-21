#!/usr/bin/env node
/**
 * Generate The_Reliquary_of_Iterative_Becoming.html from the modular build.
 * Does not overwrite historical source artifacts in the parent directory.
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-standalone');
const outDir = join(root, 'release');
const outFile = join(outDir, 'The_Reliquary_of_Iterative_Becoming.html');

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
const digest = createHash('sha256').update(html).digest('hex');
writeFileSync(join(outDir, 'The_Reliquary_of_Iterative_Becoming.sha256'), `${digest}  The_Reliquary_of_Iterative_Becoming.html\n`);
console.log(`standalone: wrote ${relative(root, outFile)} (${html.length} bytes)`);
console.log(`sha256 ${digest}`);
