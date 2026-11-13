#!/usr/bin/env node
// Gate (plan Phase 9): no visitor-facing placeholder prose survives.
import { readFileSync } from 'node:fs';
import { walk, report } from './_lib.mjs';
import { countClaims } from './content-count-lib.mjs';

const BANNED = [
  /\bTODO\b/i,
  /\bplaceholder\b/i,
  /\blorem ipsum\b/i,
  /\bcoming soon\b/i,
  /\bTBD\b/,
  /\bFIXME\b/i,
  /\bXXX\b/,
  /\bfill (this |me )?in\b/i,
];

const errors = [];
const notes = [];

// The data layer and generated content are entirely visitor-facing.
const dataFiles = [...walk('data', ['.json']), ...walk('src/content', ['.ts', '.json'])];
for (const f of dataFiles) {
  const text = readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const re of BANNED) {
      if (re.test(line)) errors.push(`${f}:${i + 1} matches ${re}: ${line.trim().slice(0, 100)}`);
    }
  });
}

// Exhibit and UI source carries visitor-facing copy in string literals. Engine
// comments may legitimately discuss scaffolding, so only literals are scanned.
const sourceFiles = [...walk('src/exhibits', ['.ts']), ...walk('src/ui', ['.ts']), ...walk('src/accessibility', ['.ts'])];
const STRING_LITERAL = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
let literalCount = 0;
for (const f of sourceFiles) {
  const text = readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    const code = line.replace(/^\s*\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    for (const m of code.matchAll(STRING_LITERAL)) {
      const literal = m[1] ?? m[2] ?? m[3] ?? '';
      literalCount++;
      for (const re of BANNED) {
        if (re.test(literal)) {
          errors.push(`${f}:${i + 1} visitor-facing string matches ${re}: ${literal.slice(0, 80)}`);
        }
      }
    }
  });
}

// Every visitor-facing sentence should be finished prose, not a stub.
const collection = readFileSync('src/content/collection.generated.ts', 'utf8');
for (const m of collection.matchAll(/"(summary|brief|plaque|problem|made|interaction|explore|lesson)":\s*"([^"]*)"/g)) {
  if (m[2].trim().length < 20) errors.push(`collection: "${m[1]}" is too short to be finished: "${m[2]}"`);
  if (!/[.!?]"?$/.test(m[2].trim())) errors.push(`collection: "${m[1]}" does not end as a sentence: "${m[2].slice(-40)}"`);
}

// A count the visitor can read must be the count the building actually holds.
// The collection grew from 64 to 73 identities while two sentences still said
// "sixty-four projects"; this keeps any stated current total tied to the living
// data while leaving explicitly historical sentences alone.
const totals = {
  projects: walk('data/projects', ['.json']).reduce((n, f) => n + JSON.parse(readFileSync(f, 'utf8')).length, 0),
  exhibits: (collection.match(/"id":\s*"E\d+"/g) ?? []).length,
};
let countClaimTotal = 0;
let historicalClaims = 0;
for (const f of ['src/content/collection.generated.ts', ...sourceFiles, ...walk('src/world', ['.ts']), ...walk('src/guide', ['.ts'])]) {
  const text = readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    for (const claim of countClaims(line, totals)) {
      countClaimTotal++;
      if (claim.historical && claim.stated !== claim.actual) historicalClaims++;
      if (!claim.ok) errors.push(`${f}:${i + 1} states "${claim.text}" but the current collection holds ${claim.actual}`);
    }
  });
}
notes.push(`${countClaimTotal} stated collection totals checked against ${totals.projects} projects / ${totals.exhibits} exhibits (${historicalClaims} explicitly historical)`);

notes.push(`${dataFiles.length} data files, ${sourceFiles.length} source files, ${literalCount} visitor-facing literals scanned`);

process.exit(report('content', errors, notes));
