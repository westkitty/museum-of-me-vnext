#!/usr/bin/env node
// Gate (plan §27): statically check literal asset registration/provenance,
// obvious external hotlinks, and SHA-256 values for local processed assets.
// Transfer/tier budgets are checked separately by check-budgets.mjs.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk, report } from './_lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
// 3. Hash every locally imported file-backed runtime asset against its
//    manifest. Original third-party source files are provenance-only and may
//    live in an ignored acquisition cache; the processed files must be present
//    in this checkout and match byte-for-byte.
const HASHED_MODULES = [
  'src/assets/curatedAssets.ts',
  'src/assets/quaterniusAssets.ts',
];
let processedFilesVerified = 0;
let sourceHashesRetained = 0;
for (const relativeModule of HASHED_MODULES) {
  const modulePath = resolve(ROOT, relativeModule);
  const source = readFileSync(modulePath, 'utf8');
  const importedFiles = new Map(
    [...source.matchAll(/import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]/g)]
      .map((match) => [match[1], resolve(dirname(modulePath), match[2])]),
  );
  for (const match of source.matchAll(/registerAsset\(\s*\{([\s\S]*?)\}\s*\);/g)) {
    const body = match[1];
    const id = body.match(/id:\s*['\"]([^'\"]+)['\"]/ )?.[1];
    const kind = body.match(/kind:\s*['\"]([^'\"]+)['\"]/ )?.[1];
    if (!id || kind === 'procedural') continue;
    const importedUrl = body.match(/url:\s*(\w+)/)?.[1];
    const expected = body.match(/processedHash:\s*['\"]([a-f0-9]{64})['\"]/i)?.[1];
    const sourceHash = body.match(/sourceHash:\s*['\"]([a-f0-9]{64})['\"]/i)?.[1];
    if (!expected) {
      errors.push(`${relativeModule}: file-backed asset "${id}" has no SHA-256 processedHash`);
      continue;
    }
    const assetPath = importedUrl ? importedFiles.get(importedUrl) : undefined;
    if (!assetPath) {
      errors.push(`${relativeModule}: file-backed asset "${id}" URL is not a local imported file`);
      continue;
    }
    if (!existsSync(assetPath)) {
      errors.push(`${relativeModule}: asset "${id}" file is missing: ${relative(ROOT, assetPath)}`);
      continue;
    }
    const actual = createHash('sha256').update(readFileSync(assetPath)).digest('hex');
    if (actual !== expected) {
      errors.push(`${relativeModule}: processed hash mismatch for "${id}" (${relative(ROOT, assetPath)})`);
      continue;
    }
    if (sourceHash) sourceHashesRetained++;
    processedFilesVerified++;
  }
}

// The Full Weasel bundle is a local tree, not a single imported file. Its
// manifest hash covers sorted relative paths, a NUL separator, and raw bytes.
const fullWeaselModule = resolve(ROOT, 'src/assets/fullWeaselArtifact.ts');
const fullWeaselSource = readFileSync(fullWeaselModule, 'utf8');
const fullWeaselExpected = fullWeaselSource.match(/FULL_WEASEL_TREE_SHA256\s*=\s*['\"]([a-f0-9]{64})['\"]/i)?.[1];
const fullWeaselEntry = fullWeaselSource.match(/FULL_WEASEL_ENTRY\s*=\s*['\"]([^'\"]+)['\"]/ )?.[1];
if (!fullWeaselExpected || !fullWeaselEntry || !/processedHash:\s*FULL_WEASEL_TREE_SHA256/.test(fullWeaselSource)) {
  errors.push('fullWeaselArtifact.ts: missing tree hash, local entry, or manifest binding');
} else {
  const entryPath = resolve(ROOT, 'public', fullWeaselEntry.replace(/^\.\//, ''));
  const bundleRoot = dirname(entryPath);
  if (!existsSync(entryPath)) {
    errors.push(`Full Weasel entry is missing: ${relative(ROOT, entryPath)}`);
  } else {
    const bundleFiles = walk(bundleRoot).sort((a, b) => {
      const left = relative(bundleRoot, a).split(sep).join('/');
      const right = relative(bundleRoot, b).split(sep).join('/');
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const digest = createHash('sha256');
    for (const file of bundleFiles) {
      digest.update(relative(bundleRoot, file).split(sep).join('/'));
      digest.update(Buffer.from([0]));
      digest.update(readFileSync(file));
    }
    const actual = digest.digest('hex');
    if (actual !== fullWeaselExpected) errors.push('Full Weasel bundle tree SHA-256 does not match its manifest');
    else notes.push(`Full Weasel bundle tree hash verified (${bundleFiles.length} files)`);
  }
}

notes.push(`${ids.size} governed assets registered`);
notes.push(`${processedFilesVerified} imported asset file hashes verified`);
if (sourceHashesRetained > 0) {
  notes.push(`${sourceHashesRetained} sourceHash values retained as provenance; original-source availability is not checked here`);
}

process.exit(report('assets', errors, notes));
