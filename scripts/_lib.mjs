import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function walk(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (!exts || exts.includes(extname(p))) out.push(p);
  }
  return out;
}

export function report(name, errors, notes = []) {
  for (const n of notes) console.log(`  · ${n}`);
  if (errors.length === 0) {
    console.log(`✓ ${name}: PASS`);
    return 0;
  }
  console.error(`✗ ${name}: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  return 1;
}
