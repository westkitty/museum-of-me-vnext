#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'release', 'The_Reliquary_of_Iterative_Becoming.html');
if (!existsSync(file)) {
  console.error('offline-standalone: missing release HTML');
  process.exit(1);
}
const html = readFileSync(file, 'utf8');
const errors = [];
function decodedScripts(source) {
  const scripts = [];
  for (const match of source.matchAll(/src="data:text\/javascript;base64,([^"]+)"/g)) {
    scripts.push(Buffer.from(match[1], 'base64').toString('utf8'));
  }
  return scripts.join('\n');
}
const runtime = `${html}\n${decodedScripts(html)}`;
if (!runtime.includes('WebGLRenderer') && !runtime.includes('REVISION')) {
  errors.push('generated HTML does not contain Three.js/WebGL runtime');
}
if (/https?:\/\/(?:cdn\.|unpkg\.com|jsdelivr\.net|esm\.sh)/.test(runtime)) {
  errors.push('generated HTML still names a CDN host');
}
if (!runtime.includes('data:image/webp') || !runtime.includes('data:image/avif')) {
  errors.push('generated HTML is missing curated raster payloads');
}
if (!runtime.includes('curator-archive')) {
  errors.push('generated HTML is missing source visitor identities');
}
const digest = createHash('sha256').update(html).digest('hex');
if (errors.length) {
  console.error('offline-standalone: FAIL');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`offline-standalone: static checks PASS sha256=${digest}`);
