#!/usr/bin/env node
const rawUrl = process.argv[2];
const expectedSha = process.argv[3] || process.env.MUSEUM_BUILD_SHA || '';

if (!rawUrl) {
  console.error('usage: node scripts/verify-pages-hosted.mjs https://user.github.io/repo/ [expected-sha]');
  process.exit(2);
}

const base = new URL(rawUrl);
if (base.protocol !== 'https:') {
  console.error('pages hosted: FAIL\n  - GitHub Pages verification requires HTTPS');
  process.exit(1);
}
if (!base.pathname.endsWith('/')) base.pathname += '/';

const errors = [];
const checks = [];

async function fetchNoStore(url) {
  return fetch(url, { cache: 'no-store', redirect: 'follow' });
}

const shell = await fetchNoStore(base);
if (!shell.ok) errors.push(`shell returned HTTP ${shell.status}`);
const html = shell.ok ? await shell.text() : '';
for (const mount of ['museum-canvas', 'ui-root', 'a11y-root']) {
  if (!html.includes(`id="${mount}"`) && !html.includes(`id='${mount}'`)) {
    errors.push(`HTML shell is missing #${mount}`);
  }
}
if (shell.ok) checks.push(`shell ${shell.status}`);

const refs = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/gi)].map((m) => m[1]);
for (const ref of refs) {
  const url = new URL(ref, base);
  if (url.origin !== base.origin) {
    errors.push(`cross-origin asset: ${url.href}`);
    continue;
  }
  const response = await fetchNoStore(url);
  if (!response.ok) errors.push(`asset ${url.pathname} returned HTTP ${response.status}`);
}
if (refs.length) checks.push(`${refs.length} deployed JS/CSS assets reachable`);
else errors.push('deployed shell references no JS/CSS assets');

const receiptUrl = new URL('build-info.json', base);
const receiptResponse = await fetchNoStore(receiptUrl);
if (!receiptResponse.ok) {
  errors.push(`build receipt returned HTTP ${receiptResponse.status}`);
} else {
  const receipt = await receiptResponse.json();
  if (expectedSha && receipt.sha !== expectedSha) {
    errors.push(`deployed SHA mismatch: expected ${expectedSha}, found ${receipt.sha}`);
  } else {
    checks.push(`deployed sha ${receipt.sha}`);
  }
}

const missing = new URL(`__pages-fallback-check-${Date.now()}.html`, base);
const missingResponse = await fetchNoStore(missing);
const missingHtml = await missingResponse.text();
if (missingResponse.status !== 404) {
  errors.push(`missing-route probe expected HTTP 404, received ${missingResponse.status}`);
}
if (!missingHtml.includes('museum-canvas')) {
  errors.push('missing-route probe did not return the SPA fallback shell');
} else {
  checks.push('404 fallback returns the museum shell');
}

if (errors.length) {
  console.error('pages hosted: FAIL');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('pages hosted: PASS');
for (const check of checks) console.log(`  - ${check}`);
