import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Regression: an ordinary release build must never carry a pocket-world chunk,
// a W01 stem (even an orphan nobody imports) or rehearsal activation code.
const verifier = fileURLToPath(new URL('./verify-release-dist.mjs', import.meta.url));
const headers = [
  '/assets/*', '  Cache-Control: public, max-age=31536000, immutable',
  '/*', '  X-Content-Type-Options: nosniff', "  Content-Security-Policy: default-src 'self'; frame-ancestors 'none'",
].join('\n');

function fixture(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'museum-dist-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<script type="module" src="./assets/museum-AbCd1234.js"></script><link rel="stylesheet" href="./assets/museum-AbCd1234.css">');
  writeFileSync(join(dir, '_headers'), headers);
  writeFileSync(join(dir, 'assets/museum-AbCd1234.js'), 'export{}');
  writeFileSync(join(dir, 'assets/three-AbCd1234.js'), 'export{}');
  writeFileSync(join(dir, 'assets/museum-AbCd1234.css'), 'body{}');
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(dir, name), body);
  return dir;
}

function verify(dir) {
  const run = spawnSync(process.execPath, [verifier, dir], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { code: run.status, out: `${run.stdout}${run.stderr}` };
}

test('a clean ordinary build passes', () => {
  const { code, out } = verify(fixture());
  assert.equal(code, 0, out);
  assert.match(out, /no pocket-world chunk, W01 stem or rehearsal activation code/);
});

test('an orphan W01 stem fails the release check', () => {
  const { code, out } = verify(fixture({ 'assets/w01-bass-BaA6VaRV.m4a': 'x' }));
  assert.equal(code, 1);
  assert.match(out, /pocket-world files leaked into the ordinary build: assets\/w01-bass-BaA6VaRV\.m4a/);
});

test('a pocket-world chunk or the production activation module fails the release check', () => {
  for (const name of ['assets/createW09World-D6H22rHu.js', 'assets/createL01World-AffEb_iz.js', 'assets/productionWorlds-DZklhnxG.js']) {
    const { code, out } = verify(fixture({ [name]: 'export{}' }));
    assert.equal(code, 1, name);
    assert.match(out, /pocket-world files leaked/, name);
  }
});

test('rehearsal activation code inside an ordinary chunk fails the release check', () => {
  const { code, out } = verify(fixture({ 'assets/main-AbCd9999.js': 'const q=new URLSearchParams(location.search).get("rehearsalPrefix")' }));
  assert.equal(code, 1);
  assert.match(out, /rehearsal activation code leaked into assets\/main-AbCd9999\.js: rehearsalPrefix/);
});
