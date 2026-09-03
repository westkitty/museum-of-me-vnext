#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const humanChecklistPath = 'validation/reports/HUMAN_QA_CHECKLIST.md';
const original = readFileSync(humanChecklistPath);

let result;
try {
  result = spawnSync(process.execPath, ['scripts/qa-report.mjs'], {
    stdio: 'inherit',
  });
} finally {
  // qa-report.mjs is allowed to regenerate the automated QA report, but the
  // human checklist is a hand-maintained release contract. Restore its exact
  // bytes so an automated gate can never silently replace newer human-QA rules
  // with the older generated scaffold embedded in qa-report.mjs.
  writeFileSync(humanChecklistPath, original);
}

if (result?.error) throw result.error;
process.exitCode = result?.status ?? 1;
