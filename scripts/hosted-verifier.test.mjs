import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseAssetRefs, verifyHosted } from './hosted-verifier-lib.mjs';

const shellHeaders = {
  'cache-control': 'public, max-age=0, must-revalidate',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self'; frame-ancestors 'none'",
};
const assetHeaders = { 'cache-control': 'public, max-age=31536000, immutable' };

const goodHtml = `<!doctype html>
<html><head>
<link rel="stylesheet" href="./assets/index-AbC123.css">
</head><body>
<canvas id="museum-canvas"></canvas><div id="ui-root"></div><div id="a11y-root"></div>
<script type="module" src="./assets/index-XyZ987.js"></script>
</body></html>`;

function fakeFetch(entries) {
  return async (input) => {
    const key = input instanceof URL ? input.href : String(input);
    const entry = entries.get(key);
    if (!entry) return new Response('missing', { status: 404 });
    return new Response(entry.body ?? '', {
      status: entry.status ?? 200,
      headers: entry.headers ?? {},
    });
  };
}

function goodEntries() {
  return new Map([
    ['https://museum.example/', { body: goodHtml, headers: shellHeaders }],
    ['https://museum.example/assets/index-AbC123.css', { body: 'body{}', headers: assetHeaders }],
    ['https://museum.example/assets/index-XyZ987.js', { body: 'export{}', headers: assetHeaders }],
  ]);
}

test('extracts unique release JavaScript and CSS references', () => {
  assert.deepEqual(releaseAssetRefs(goodHtml), [
    './assets/index-AbC123.css',
    './assets/index-XyZ987.js',
  ]);
});

test('accepts a hosted shell with the required headers and hashed same-origin assets', async () => {
  const result = await verifyHosted('https://museum.example/', fakeFetch(goodEntries()));
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.errors.length, 0);
  assert.ok(result.checks.some((line) => line.includes('2 same-origin hashed')));
});

test('rejects a hosted shell whose CSP lost the frame boundary', async () => {
  const entries = goodEntries();
  entries.set('https://museum.example/', {
    body: goodHtml,
    headers: { ...shellHeaders, 'content-security-policy': "default-src 'self'" },
  });
  const result = await verifyHosted('https://museum.example/', fakeFetch(entries));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((line) => line.includes('hosted CSP')));
});

test('rejects cross-origin or non-immutable release assets', async () => {
  const html = goodHtml.replace(
    './assets/index-XyZ987.js',
    'https://cdn.example/index-XyZ987.js',
  );
  const entries = goodEntries();
  entries.set('https://museum.example/', { body: html, headers: shellHeaders });
  entries.set('https://museum.example/assets/index-AbC123.css', {
    body: 'body{}',
    headers: { 'cache-control': 'public, max-age=0' },
  });

  const result = await verifyHosted('https://museum.example/', fakeFetch(entries));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((line) => line.includes('cross-origin release asset')));
  assert.ok(result.errors.some((line) => line.includes('asset cache policy is not immutable')));
});

test('rejects non-HTTPS public targets before making a request', async () => {
  let called = false;
  const result = await verifyHosted('http://museum.example/', async () => {
    called = true;
    throw new Error('should not run');
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
  assert.ok(result.errors[0].includes('requires HTTPS'));
});
