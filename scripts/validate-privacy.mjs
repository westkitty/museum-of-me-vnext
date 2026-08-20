#!/usr/bin/env node
// Gate (plan §29): nothing private, operational, or sensitive reaches visitor-facing space.
import { readFileSync } from 'node:fs';
import { walk, report } from './_lib.mjs';

const PATTERNS = [
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/, 'IPv4 literal'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9]{20,}/, 'OpenAI-style key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\/Users\/[a-z]/i, 'absolute home path'],
  [/\bssh-(?:rsa|ed25519) AAAA/, 'SSH public key blob'],
  [/\b[a-z0-9-]+\.(?:local|internal|lan)\b/i, 'private hostname'],
  [/\bBearer [A-Za-z0-9._-]{20,}/, 'bearer token'],
];

// Personal identifiers that must not appear in visitor content.
// The creator's own public handle is permitted (it names public repositories).
const DENY_NAMES = [/\bBryan\b/];

const errors = [];
const files = [...walk('data', ['.json']), ...walk('src/content', ['.ts', '.json']), ...walk('src/exhibits', ['.ts'])];

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const [re, label] of PATTERNS) {
      if (re.test(line)) errors.push(`${f}:${i + 1} ${label}: ${line.trim().slice(0, 90)}`);
    }
    for (const re of DENY_NAMES) {
      if (re.test(line)) errors.push(`${f}:${i + 1} personal identifier: ${line.trim().slice(0, 90)}`);
    }
  });
}

process.exit(report('privacy', errors, [`${files.length} files scanned`]));
