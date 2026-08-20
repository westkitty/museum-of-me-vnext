#!/usr/bin/env node
// Gate (plan Phase 9): no visitor-facing placeholder prose survives.
import { readFileSync } from 'node:fs';
import { walk, report } from './_lib.mjs';

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
// Visitor-facing content only. Engine source may legitimately discuss placeholders in comments,
// so scan the data layer plus generated content, which is what actually reaches a visitor.
const files = [...walk('data', ['.json']), ...walk('src/content', ['.ts', '.json'])];

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const re of BANNED) {
      if (re.test(line)) errors.push(`${f}:${i + 1} matches ${re}: ${line.trim().slice(0, 100)}`);
    }
  });
}

process.exit(report('content', errors, [`${files.length} content files scanned`]));
