#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { verifyHumanEvidence } from './human-evidence-verifier-lib.mjs';

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run verify:human-evidence -- <completed-human-qa.md>');
  process.exitCode = 2;
} else {
  let markdown;
  try {
    markdown = readFileSync(path, 'utf8');
  } catch (error) {
    console.error(`human QA evidence: FAIL\n  - could not read ${path}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }

  if (markdown !== undefined) {
    const result = verifyHumanEvidence(markdown);
    if (!result.ok) {
      console.error('human QA evidence: FAIL');
      for (const error of result.errors) console.error(`  - ${error}`);
      process.exitCode = 1;
    } else {
      console.log('human QA evidence: PASS');
      for (const check of result.checks) console.log(`  - ${check}`);
      console.log('  - this validates evidence completeness only; it does not create or substitute for the human observations');
    }
  }
}
