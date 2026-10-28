import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, chmodSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { CHECKS, determineTests, getBaselineSha, getChangedFiles, mapToSystems, reconcileIssues, run, writeOutput } from '../scripts/sentinel/runner.js';
import { escapeHtml, generateReport, renderReport } from '../scripts/sentinel/report.js';

const temporary: string[] = [];
function temp() { const dir = mkdtempSync(join(tmpdir(), 'museum-sentinel-')); temporary.push(dir); return dir; }
function git(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function fixture() {
  const cwd = temp();
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.email', 'fixture@example.invalid']);
  git(cwd, ['config', 'user.name', 'Sentinel fixture']);
  writeFileSync(join(cwd, 'OPERATIONAL_STATE.md'), `Historical baseline is \`${'a'.repeat(40)}\``);
  git(cwd, ['add', '.']); git(cwd, ['commit', '-qm', 'initial']);
  return { cwd, baseline: git(cwd, ['rev-parse', 'HEAD']) };
}
const old = { id: 'one', check: 'npm run test', status: 'new', title: 'Old', description: 'previous evidence', firstSeen: 'first', lastSeen: 'first' };
const context = { status: 'ok', baselineSha: 'baseline', workingTreeClean: true };
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('Sentinel baseline and truthful comparison', () => {
  it('requires explicit authority even when operational prose contains a SHA', () => {
    const { cwd, baseline } = fixture();
    expect(getBaselineSha(undefined, cwd).status).toBe('unavailable-baseline');
    expect(getBaselineSha('HEAD', cwd).status).toBe('unavailable-baseline');
    expect(getBaselineSha('--help;echo unsafe', cwd).status).toBe('unavailable-baseline');
    expect(getBaselineSha(baseline, cwd)).toMatchObject({ status: 'ok', sha: baseline });
    expect(getBaselineSha('f'.repeat(40), cwd).status).toBe('unavailable-baseline');
  });
  it('distinguishes no changes, failed Git and unavailable baseline', () => {
    const { cwd, baseline } = fixture();
    expect(getChangedFiles(baseline, cwd)).toMatchObject({ status: 'ok', files: [], workingTreeClean: true });
    expect(getChangedFiles(baseline, temp())).toMatchObject({ status: 'comparison-failed', files: null });
    git(cwd, ['checkout', '--orphan', 'disjoint']);
    git(cwd, ['commit', '-qam', 'unrelated']);
    expect(getChangedFiles(baseline, cwd)).toMatchObject({ status: 'comparison-failed', files: null });
  });
  it('reports failed Git diff as a failed comparison, never an empty set', () => {
    const { cwd, baseline } = fixture(); const bin = temp();
    const shim = join(bin, 'git');
    writeFileSync(shim, '#!/bin/sh\nif [ "$1" = diff ]; then echo forced-diff-error >&2; exit 70; fi\nexec /usr/bin/git "$@"\n');
    chmodSync(shim, 0o700);
    const previousPath = process.env.PATH;
    try {
      process.env.PATH = `${bin}:${previousPath}`;
      expect(getChangedFiles(baseline, cwd)).toMatchObject({ status: 'comparison-failed', files: null, reason: 'forced-diff-error' });
    } finally { process.env.PATH = previousPath; }
  });
  it('reports incomplete shallow history instead of falling back to a parent', () => {
    const { cwd, baseline } = fixture();
    writeFileSync(join(cwd, 'next.md'), 'next'); git(cwd, ['add', '.']); git(cwd, ['commit', '-qm', 'next']);
    const clone = join(temp(), 'shallow');
    git(cwd, ['clone', '-q', '--depth=1', `file://${cwd}`, clone]);
    expect(getChangedFiles(baseline, clone)).toMatchObject({ status: 'incomplete-history', files: null });
  });
  it('preserves hostile filenames and marks dirty tracked source', () => {
    const { cwd, baseline } = fixture();
    const filename = 'hostile\n<script>.ts'; writeFileSync(join(cwd, filename), 'source');
    git(cwd, ['add', '.']); git(cwd, ['commit', '-qm', 'source']);
    expect(getChangedFiles(baseline, cwd).files).toEqual([filename]);
    writeFileSync(join(cwd, filename), 'dirty');
    expect(getChangedFiles(baseline, cwd).workingTreeClean).toBe(false);
  });
  it('selects no checks for docs or no change; all known checks for other source', () => {
    expect(determineTests(mapToSystems([]))).toEqual([]);
    expect(determineTests(mapToSystems(['docs/README.md']))).toEqual([]);
    expect(determineTests(mapToSystems(['src/state/store.ts']))).toEqual(CHECKS);
  });
});

describe('Sentinel immutable issue evidence', () => {
  it('does not resolve skipped, unavailable, unrelated or invalid-context checks', () => {
    for (const checks of [[], [{ cmd: old.check, status: 'unavailable' }], [{ cmd: 'other', status: 'passed' }]]) {
      expect(reconcileIssues([old], [], 'next', { ...context, checks })[0].status).toBe('not-rechecked');
    }
    expect(reconcileIssues([old], [], 'next', { status: 'comparison-failed', checks: [{ cmd: old.check, status: 'passed' }] })[0].status).toBe('unknown');
    expect(reconcileIssues([old], [], 'next', { ...context, workingTreeClean: false, checks: [{ cmd: old.check, status: 'passed' }] })[0].status).toBe('unknown');
  });
  it('preserves identity and prior snapshots while updating latest evidence', () => {
    const before = structuredClone(old);
    const current = { ...old, description: 'current evidence', firstSeen: 'wrong' };
    const [confirmed] = reconcileIssues([old], [current], 'next', context);
    expect(old).toEqual(before);
    expect(confirmed).toMatchObject({ firstSeen: 'first', lastSeen: 'next', description: 'current evidence', status: 'confirmed', history: [before] });
    const [resolved] = reconcileIssues([confirmed], [], 'final', { ...context, checks: [{ cmd: old.check, status: 'passed' }] });
    expect(confirmed.status).toBe('confirmed');
    expect(resolved).toMatchObject({ status: 'resolved', resolution: { revision: 'final', baselineSha: 'baseline', check: old.check } });
    expect(resolved.history).toHaveLength(2);
    expect(reconcileIssues([resolved], [], 'later', context)[0].status).toBe('not-rechecked');
    expect(reconcileIssues([], [current], 'new', context)[0].status).toBe('new');
  });
});

describe('Sentinel private report and actual runner integration', () => {
  it('escapes every dynamic report field and uses no executable script', () => {
    const hostile = `<script>alert("x")</script><img src=x onerror='alert(1)'>&`;
    const html = renderReport({ timestamp: hostile, analysisDurationMs: hostile, comparison: { reason: hostile }, checks: [{ cmd: hostile, status: hostile, evidence: hostile }], issues: [{ status: 'new', title: hostile, description: hostile, firstSeen: hostile }], unverifiedClaims: [hostile], recommendations: [hostile], avoidedWork: hostile });
    expect(escapeHtml(hostile)).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('default-src');
  });
  it('rejects output escapes and symlinks without touching museum source', () => {
    const { cwd } = fixture(); const outside = temp();
    expect(() => writeOutput('../source.ts', 'unsafe', cwd)).toThrow();
    symlinkSync(outside, join(cwd, '.sentinel'));
    expect(() => writeOutput('state.json', 'unsafe', cwd)).toThrow();
    rmSync(join(cwd, '.sentinel')); mkdirSync(join(cwd, '.sentinel'));
    symlinkSync(join(cwd, 'OPERATIONAL_STATE.md'), join(cwd, '.sentinel/state.json'));
    expect(() => run({ cwd })).toThrow();
    expect(() => generateReport(cwd)).toThrow();
    mkdirSync(join(cwd, 'public'));
    expect(() => writeOutput('index.html', 'private', join(cwd, 'public'))).toThrow();
    expect(readFileSync(join(cwd, 'OPERATIONAL_STATE.md'), 'utf8')).toContain('Historical baseline');
  });
  it('runs actual CLI checks, confirms a repeated failure, resolves with proof and renders private HTML', () => {
    const { cwd, baseline } = fixture();
    const scripts = Object.fromEntries(['typecheck', 'lint', 'test', 'validate:mapping', 'validate:content'].map(name => [name, name === 'test' ? 'node check.cjs' : 'node -e "process.exit(0)"']));
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ scripts }));
    writeFileSync(join(cwd, 'check.cjs'), "process.exit(require('node:fs').existsSync('pass') ? 0 : 1)");
    git(cwd, ['add', '.']); git(cwd, ['commit', '-qm', 'checks']);
    const runner = resolve('scripts/sentinel/runner.js'); const reporter = resolve('scripts/sentinel/report.js');
    const invoke = () => spawnSync(process.execPath, [runner, `--baseline=${baseline}`, '--checks'], { cwd, encoding: 'utf8' });
    expect(invoke().status).toBe(1);
    const read = () => JSON.parse(readFileSync(join(cwd, '.sentinel/state.json'), 'utf8'));
    const first = read(); expect(first.issues[0].status).toBe('new');
    expect(invoke().status).toBe(1); expect(read().issues[0].status).toBe('confirmed');
    writeFileSync(join(cwd, 'pass'), ''); expect(invoke().status).toBe(0);
    const final = read(); expect(final.issues[0].status).toBe('resolved');
    expect(final.runs).toHaveLength(3); expect(final.runs[0]).toEqual(first.lastRun);
    expect(final.lastRun.analysisDurationMs).toBeGreaterThan(0); expect(final.lastRun.avoidedWork.savedDurationMs).toBeNull();
    expect(spawnSync(process.execPath, [reporter], { cwd, encoding: 'utf8' }).status).toBe(0);
    expect(readFileSync(join(cwd, '.sentinel/index.html'), 'utf8')).toContain('Resolved with proof');
    expect(git(cwd, ['diff', '--name-only'])).toBe('');
    const unrequested = run({ baseline, cwd });
    expect(unrequested.checks).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'unavailable' })]));
    expect(generateReport(cwd)).toBe(join(cwd, '.sentinel/index.html'));
  }, 30_000);
});
