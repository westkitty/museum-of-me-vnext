#!/usr/bin/env node
import { verifyHosted } from './hosted-verifier-lib.mjs';

const target = process.argv[2];
if (!target) {
  console.error('usage: npm run verify:hosted -- https://museum.example/');
  process.exitCode = 2;
} else {
  const result = await verifyHosted(target);
  if (!result.ok) {
    console.error('hosted release: FAIL');
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log('hosted release: PASS');
    for (const check of result.checks) console.log(`  - ${check}`);
    console.log('  - transport/header proof only; visual, audio, pointer-lock feel and device FPS remain human checks');
  }
}
