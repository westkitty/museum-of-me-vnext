#!/usr/bin/env node
// Guard known avoidable allocation forms in per-frame code. This is
// intentionally static: ResourceScope tests prove disposable-resource stability,
// not total JavaScript heap allocation.
import { readFileSync } from 'node:fs';
import { walk, report } from './_lib.mjs';

const FORBIDDEN = /\bnew\s+(?:THREE\.)?(?:Vector2|Vector3|Color|Euler|Quaternion|Matrix3|Matrix4|CatmullRomCurve3|SplineCurve|Array|Map|Set|Object)\b/g;
const errors = [];

function methodBody(source, start) {
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  return '';
}

/** Every `onUpdate` in an exhibit module. */
function exhibitUpdates(errors) {
  for (const file of walk('src/exhibits', ['.ts'])) {
    const source = readFileSync(file, 'utf8');
    // Matches both the method-declaration form every current exhibit uses and
    // an arrow-function class-field form (`onUpdate = (...): void => {`), which
    // would otherwise silently bypass this gate for any exhibit written that
    // way in the future -- none currently are, but the pattern only protects
    // what it can actually match.
    const pattern = /(?:protected\s+override\s+)?onUpdate\s*(?:\([^)]*\)\s*:\s*void\s*\{|=\s*\([^)]*\)\s*:\s*void\s*=>\s*\{)/g;
    for (const match of source.matchAll(pattern)) {
      const body = methodBody(source, match.index);
      for (const found of body.matchAll(FORBIDDEN)) {
        const line = source.slice(0, (match.index ?? 0) + (found.index ?? 0)).split('\n').length;
        errors.push(`${file}:${line}: forbidden construction in onUpdate: ${found[0]}`);
      }
    }
  }
}

/**
 * Named per-frame methods outside the exhibit modules. These run from the
 * variable-step phase of the single loop, and each was a real source of
 * steady-state garbage before it was fixed:
 *  - Lighting.update rebuilt an array of `{ light, d }` objects every frame;
 *  - StreamingManager.evaluate allocated a `Set` (plus the spread that filled
 *    it) every frame just to answer "which zones are relevant".
 * Listing them explicitly keeps the guard honest about what it covers.
 */
const PER_FRAME_METHODS = [
  { file: 'src/render/Lighting.ts', method: 'update' },
  { file: 'src/exhibits/StreamingManager.ts', method: 'evaluate' },
];

function namedPerFrameMethods(errors) {
  for (const { file, method } of PER_FRAME_METHODS) {
    const source = readFileSync(file, 'utf8');
    const pattern = new RegExp(`\\b${method}\\s*\\([^)]*\\)\\s*:\\s*void\\s*\\{`, 'g');
    let matched = false;
    for (const match of source.matchAll(pattern)) {
      matched = true;
      const body = methodBody(source, match.index);
      for (const found of body.matchAll(FORBIDDEN)) {
        const line = source.slice(0, (match.index ?? 0) + (found.index ?? 0)).split('\n').length;
        errors.push(`${file}:${line}: forbidden construction in ${method}(): ${found[0]}`);
      }
    }
    if (!matched) errors.push(`${file}: no ${method}() found to check -- update PER_FRAME_METHODS`);
  }
}

exhibitUpdates(errors);
namedPerFrameMethods(errors);

process.exit(report('hotpaths', errors, [
  'checked known object constructors in exhibit onUpdate methods',
  `checked ${PER_FRAME_METHODS.length} named per-frame methods outside the exhibits`,
]));
