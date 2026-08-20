#!/usr/bin/env node
// Guard known avoidable allocation forms in exhibit frame updates. This is
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

for (const file of walk('src/exhibits', ['.ts'])) {
  const source = readFileSync(file, 'utf8');
  const pattern = /(?:protected\s+override\s+)?onUpdate\s*\([^)]*\)\s*:\s*void\s*\{/g;
  for (const match of source.matchAll(pattern)) {
    const body = methodBody(source, match.index);
    for (const found of body.matchAll(FORBIDDEN)) {
      const line = source.slice(0, (match.index ?? 0) + (found.index ?? 0)).split('\n').length;
      errors.push(`${file}:${line}: forbidden construction in onUpdate: ${found[0]}`);
    }
  }
}

process.exit(report('hotpaths', errors, ['checked known object constructors in exhibit onUpdate methods']));
