#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { report } from './_lib.mjs';

const errors = [];
const notes = [];

const manifest = JSON.parse(readFileSync('data/source-parity/manifest.json', 'utf8'));
const installations = JSON.parse(readFileSync('data/source-parity/installations.json', 'utf8'));
const supplementary = JSON.parse(readFileSync('data/source-parity/supplementary.json', 'utf8'));
const visitors = JSON.parse(readFileSync('data/source-parity/visitors.json', 'utf8'));
const assets = JSON.parse(readFileSync('data/source-parity/curated-assets.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

if (installations.length !== 14) errors.push(`expected 14 primary installations, found ${installations.length}`);
if (supplementary.length !== 15) errors.push(`expected 15 supplementary records, found ${supplementary.length}`);
if (visitors.length !== 17) errors.push(`expected 17 visitors, found ${visitors.length}`);
if (assets.length !== 9) errors.push(`expected 9 curated rasters, found ${assets.length}`);
if (new Set(installations.map((i) => i.id)).size !== 14) errors.push('primary installation ids are not unique');
if (new Set(visitors.map((v) => v.id)).size !== 17) errors.push('visitor ids are not unique');
if (pkg.dependencies?.three !== '0.185.1') errors.push(`package.json three is ${pkg.dependencies?.three}, curated identity is 0.185.1`);
if (manifest.threejs.curated !== '0.185.1') errors.push('manifest threejs identity drifted');

for (const raster of assets) {
  const bytes = readFileSync(raster.relativePath);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== raster.bytes) errors.push(`${raster.id} byte length ${bytes.length} != ${raster.bytes}`);
  if (digest !== raster.sha256) errors.push(`${raster.id} sha256 mismatch`);
}

// ── installation runtime contract ────────────────────────────────────────────
const runtime = JSON.parse(readFileSync('data/source-parity/installation-runtime.json', 'utf8'));
const ids = installations.map((i) => i.id);
const stateIds = Object.keys(runtime.defaultStates);
if (stateIds.length !== 14) errors.push(`expected 14 default installation states, found ${stateIds.length}`);
for (const id of ids) {
  if (!runtime.defaultStates[id]) errors.push(`${id} has no source default state`);
  const thesis = runtime.constants.installationTheses[id];
  if (!thesis) errors.push(`${id} has no installation thesis`);
  else {
    if (!thesis.silhouette) errors.push(`${id} thesis has no silhouette`);
    if (!Array.isArray(thesis.required) || thesis.required.length === 0) {
      errors.push(`${id} thesis names no required parts`);
    }
  }
  const spec = installations.find((i) => i.id === id);
  const controls = spec.controls ?? [];
  if (controls.length === 0) errors.push(`${id} has no source controls`);
  if (controls.length > runtime.spatialContract.maxControlsPerInstallation) {
    errors.push(`${id} has ${controls.length} controls, above the source control-grid limit`);
  }
  for (const [, code] of controls) {
    if (!/^(Key[A-Z]|Digit[1-9]|Arrow(Left|Right|Up|Down)|Space)$/.test(String(code))) {
      errors.push(`${id} has a non-source control code "${code}"`);
    }
  }
  if (!runtime.sourcePositions.curated[id]) errors.push(`${id} has no recorded CURATED position`);
  if (!runtime.sourcePositions.versionB[id]) errors.push(`${id} has no recorded Version B position`);
}

// ── visitor conversation authority ───────────────────────────────────────────
const authority = JSON.parse(readFileSync('data/source-parity/visitor-authority.json', 'utf8'));
if (authority.visitors.length !== 17) {
  errors.push(`visitor authority has ${authority.visitors.length} records, expected 17`);
}
const byId = new Map(visitors.map((v) => [v.id, v]));
let authoredLines = 0;
for (const truth of authority.visitors) {
  const v = byId.get(truth.id);
  if (!v) { errors.push(`visitor "${truth.id}" is missing from the runtime records`); continue; }
  authoredLines += truth.lines.length;
  const fields = ['title', 'subtitle', 'speed', 'height', 'width'];
  for (const f of fields) {
    if (JSON.stringify(v[f]) !== JSON.stringify(truth[f])) {
      errors.push(`visitor ${truth.id} field "${f}" drifted from the CURATED authority`);
    }
  }
  if (JSON.stringify(v.lines) !== JSON.stringify(truth.lines)) {
    errors.push(`visitor ${truth.id} dialogue drifted from the CURATED authority`);
  }
  if (JSON.stringify(v.focusIds ?? []) !== JSON.stringify(truth.focusIds)) {
    errors.push(`visitor ${truth.id} focusIds drifted from the CURATED authority`);
  }
  if (JSON.stringify(v.reactsTo ?? []) !== JSON.stringify(truth.reactsTo)) {
    errors.push(`visitor ${truth.id} reactsTo drifted from the CURATED authority`);
  }
}

notes.push(`authority countContract=${manifest.authority.countContract}`);
notes.push(`14 installation state machines, ${authoredLines} authored visitor lines`);
notes.push(`${installations.length} primary, ${supplementary.length} supplementary, ${visitors.length} visitors, ${assets.length} rasters`);
process.exit(report('source-parity', errors, notes));
