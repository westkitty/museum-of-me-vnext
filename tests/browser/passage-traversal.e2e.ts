import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Passage } from '../../src/world/passages';
import { walkPassagesInPage, type PassageResult } from './helpers/passage-walk';

/**
 * Complete passage inventory, walked in the real application with the real
 * controller and collision: every lane of every passage inbound and back out.
 * Writes test-results/traversal/{manifest.json,report.md}.
 */

test.setTimeout(30 * 60_000);

const OUT = 'test-results/traversal';

function report(PASSAGES: readonly Passage[], results: readonly PassageResult[]): string {
  const byId = new Map(PASSAGES.map((p) => [p.id, p]));
  const lanes = results.flatMap((r) => r.lanes);
  const lines = [
    '# Passage traversal coverage',
    '',
    `Passages: ${results.length} · PASS ${results.filter((r) => r.status === 'PASS').length} · FAIL ${results.filter((r) => r.status === 'FAIL').length} · UNKNOWN ${PASSAGES.length - results.length}`,
    `Lanes walked both ways: ${lanes.filter((l) => l.inbound === 'PASS' && l.outbound === 'PASS').length} / ${lanes.length}`,
    `Exhibit approaches reaching the visitor spot: ${results.filter((r) => byId.get(r.id)?.exhibitId && r.interactionReached).length} / ${PASSAGES.filter((p) => p.exhibitId).length}`,
    '',
    '| Passage | Kind | Lanes (offset: in/out) | Min headroom | Walked through visible geometry | Status |',
    '|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    const p = byId.get(r.id)!;
    const laneText = r.lanes.map((l) => `${l.offset}: ${l.inbound[0]}/${l.outbound[0]}`).join(', ');
    const through = [...new Set(r.lanes.flatMap((l) => l.walkedThrough))].join(', ') || '—';
    const headroom = Math.min(...r.lanes.map((l) => l.minHeadroom));
    lines.push(`| ${r.id} | ${p.kind} | ${laneText}${r.interactionReached === false ? ' · spot NOT reached' : ''} | ${headroom} | ${through} | ${r.status} |`);
  }
  const failures = results.filter((r) => r.status === 'FAIL');
  if (failures.length) {
    lines.push('', '## Failures', '');
    for (const r of failures) {
      for (const l of r.lanes.filter((lane) => lane.inbound === 'FAIL' || lane.outbound === 'FAIL' || !lane.floorOk || !lane.headroomOk)) {
        lines.push(`- ${r.id} lane ${l.offset}: ${l.reason ?? 'floor/headroom'} at (${l.end.join(', ')}); blockers: ${l.blockers.join('; ') || 'none'}`);
      }
      if (r.interactionReached === false) lines.push(`- ${r.id}: visitor/interaction position not reached`);
    }
  }
  return lines.join('\n') + '\n';
}

test('every visitor passage is walkable in both directions on every lane', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(async () => {
    const app = window.__museum!;
    app.stop();
    app.renderer.renderer.setPixelRatio(0.25);
    // The seam passage needs the entrance prepared, exactly as a ticketed
    // visitor's approach prepares it (QA sessions hold a ticket).
    await app.worldDirector.prepareInterior();
    for (let i = 0; i < 600 && !app.interiorWorld?.streaming.telemetry.prewarmReady; i++) {
      app.variableUpdate(1 / 60);
      app.render(0);
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
  });

  // The inventory is loaded through the app's own module pipeline: its source
  // (layout, installation placement and their JSON source data) is exactly
  // what the running museum was built from.
  const all = await page.evaluate(async () => {
    const url = '/src/world/passages.ts';
    return (await import(/* @vite-ignore */ url)).PASSAGES as Passage[];
  });
  const filter = process.env.PASSAGE_FILTER;
  const passages: Passage[] = all.filter((p) => !filter || p.id.includes(filter));
  const results = await walkPassagesInPage(page, passages);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    passages: passages.map((p) => ({ ...p, result: results.find((r) => r.id === p.id) ?? null })),
  }, null, 2));
  writeFileSync(`${OUT}/report.md`, report(all, results));

  expect(results.length).toBe(passages.length);
  const failed = results.filter((r) => r.status === 'FAIL').map((r) => r.id);
  expect(failed, report(all, results)).toEqual([]);
  const through = results.flatMap((r) => r.lanes.flatMap((l) => l.walkedThrough.map((name) => `${r.id}: ${name}`)));
  expect(through, 'visible solid-looking geometry the visitor walks through').toEqual([]);
  expect(errors).toEqual([]);
});
