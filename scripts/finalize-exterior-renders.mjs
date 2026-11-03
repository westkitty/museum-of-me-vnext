/**
 * Verify real Playwright PNG captures, then emit a source-bound manifest.
 * This does not synthesize imagery, use OCR, or assert human visual approval.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const folder = 'test-results/exterior-review-2026-11-03';
const expected = [
  '01-pier-arrival.png',
  '02-front-south.png',
  '03-east-lagoon.png',
  '04-west-woodland.png',
  '05-high-topdown.png',
  '06-rear-north.png',
  '07-mobile-pier-arrival.png',
];
const images = [];
const errors = [];
await mkdir(folder, { recursive: true });
for (const name of expected) {
  try {
    const file = await readFile(join(folder, name));
    const header = file.subarray(0, 8).toString('hex');
    if (header !== '89504e470d0a1a0a') throw new Error('not a PNG');
    const width = file.readUInt32BE(16);
    const height = file.readUInt32BE(20);
    if (file.length < 1024 || width < 320 || height < 300) {
      throw new Error('invalid or incomplete capture dimensions/size');
    }
    images.push({
      name,
      width,
      height,
      bytes: file.length,
      sha256: createHash('sha256').update(file).digest('hex'),
    });
  } catch (error) {
    errors.push(name + ': ' + String(error));
  }
}
const manifest = {
  revision: process.env.GITHUB_SHA ?? 'UNKNOWN',
  createdAt: new Date().toISOString(),
  captureType: 'real Three.js browser render / Playwright Chromium SwiftShader',
  screenshotFolder: folder,
  sourceState: 'RENDERED' ,
  humanVisualApproval: 'UNVERIFIED',
  physicalDevicePerformance: 'UNVERIFIED',
  imageCount: images.length,
  expectedCount: expected.length,
  images,
  errors,
};
await writeFile(join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(folder, 'README.md'), [
  '# Museum of Me — Exterior review renders',
  '',
  'Seven separate full-size screenshots of the actual exterior Three.js runtime.',
  'Source revision: ' + manifest.revision,
  '',
  'These are evidence for design review, not an acceptance decision or performance benchmark.',
  'The CI runner uses Chromium/SwiftShader; inspect real hardware separately.',
  '',
  ...images.map((f) => '- '+f.name+' ('+f.width+'x'+f.height+', '+f.bytes+' bytes)'),
  '',
  ...(errors.length ? ['## Missing or invalid renders', ...errors] : []),
].join('\n') + '\n');
console.log('EXTERIOR_RENDER_MANIFEST '+JSON.stringify({count:images.length,errors,revision:manifest.revision}));
if (errors.length || images.length !== expected.length) process.exitCode = 1;
