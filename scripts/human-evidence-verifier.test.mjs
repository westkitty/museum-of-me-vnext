import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyHumanEvidence } from './human-evidence-verifier-lib.mjs';

const labels = [
  'Garden and facade composition reads cleanly from the real spawn.',
  'Daylight is bright without looking washed out.',
  'Rotunda stays luminous and neutral while all six route threads remain legible.',
  'Wing furnishing and atmosphere add identity without clutter or blocked sightlines.',
  'Exhibit colour fields support rather than overpower representative hero objects.',
  'Pointer lock captures, releases, recovers, and recaptures correctly on this device.',
  'Audible ambience/exhibit audio agrees with visible subtitles.',
  'Representative-device FPS and 1% low are acceptable at the required checkpoints.',
  'No visible voids, z-fighting, clipping, broken transparency, or obvious geometry failure.',
];

function report(status = 'PASS', snapshots = 6, notes = 'MacBook Pro; Safari current; visual/audio/pointer observations recorded.') {
  return [
    '# Museum of Me vNext — Human QA Evidence',
    '',
    '## Acceptance checks',
    '',
    ...labels.map((label) => `- [${status === 'PASS' ? 'x' : ' '}] **${status}** — ${label}`),
    '',
    '## Telemetry snapshots',
    '',
    ...Array.from({ length: snapshots }, (_, i) => `- \`2026-08-20T20:00:0${i}.000Z | zone=checkpoint-${i} | fps=60 | low1=55\``),
    '',
    '## Notes',
    '',
    notes,
    '',
  ].join('\n');
}

test('accepts a complete all-pass human evidence record', () => {
  const result = verifyHumanEvidence(report());
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.checks.some((line) => line.includes('all 9')));
});

test('rejects pending or needs-work acceptance states', () => {
  for (const status of ['PENDING', 'NEEDS WORK']) {
    const result = verifyHumanEvidence(report(status));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((line) => line.includes(status)));
  }
});

test('rejects incomplete telemetry and empty notes', () => {
  const result = verifyHumanEvidence(report('PASS', 3, 'No notes recorded.'));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((line) => line.includes('telemetry')));
  assert.ok(result.errors.some((line) => line.includes('notes')));
});

test('rejects evidence with the wrong acceptance-check count', () => {
  const broken = report().replace(/^- \[x\] \*\*PASS\*\* — No visible voids.*\n/m, '');
  const result = verifyHumanEvidence(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((line) => line.includes('exactly 9')));
});
