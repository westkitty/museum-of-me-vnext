import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

// Fixed private output boundary. Refuse symlinks rather than follow them into source/public.
export function outputDirectory(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], cwd);
  if (!success(root) || resolve(cwd) !== resolve(root.stdout.trim())) throw new Error('Invoke Sentinel from a repository root');
  const dir = join(resolve(cwd), '.sentinel');
  if (existsSync(dir) && (lstatSync(dir).isSymbolicLink() || !lstatSync(dir).isDirectory())) {
    throw new Error('Sentinel output directory must be a real private directory');
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}
export function writeOutput(name, data, cwd = process.cwd()) {
  if (!['state.json', 'index.html'].includes(name)) throw new Error('Unsupported Sentinel output');
  const file = join(outputDirectory(cwd), name);
  if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw new Error('Refusing output symlink');
  writeFileSync(file, data, { mode: 0o600 });
  return file;
}
function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}
function success(result) { return result.status === 0 && !result.error; }
function reason(result) { return String(result.error?.message || result.stderr || 'Git command failed').trim(); }

// Only an explicit full object ID is authority; prose, HEAD and log heuristics are not.
export function getBaselineSha(revision, cwd = process.cwd()) {
  if (!revision || !/^[a-f0-9]{40}$/i.test(revision)) {
    return { status: 'unavailable-baseline', sha: null, reason: 'UNKNOWN: supply an explicit full baseline commit SHA' };
  }
  const result = git(['rev-parse', '--verify', `${revision}^{commit}`], cwd);
  if (!success(result)) {
    if (result.error || result.status !== 128 || /not a git repository|permission denied/i.test(result.stderr || '')) return { status: 'comparison-failed', sha: null, reason: reason(result) };
    const shallow = git(['rev-parse', '--is-shallow-repository'], cwd);
    return { status: success(shallow) && shallow.stdout.trim() === 'true' ? 'incomplete-history' : 'unavailable-baseline', sha: null, reason: reason(result) };
  }
  return { status: 'ok', sha: result.stdout.trim() };
}
export function getChangedFiles(revision, cwd = process.cwd()) {
  const baseline = getBaselineSha(revision, cwd);
  if (baseline.status !== 'ok') return { ...baseline, files: null };
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}'], cwd);
  if (!success(head)) return { status: 'comparison-failed', files: null, reason: reason(head) };
  // Require proven ancestry, avoiding an ambiguous merge-base or partial-history fallback.
  const ancestry = git(['merge-base', '--is-ancestor', baseline.sha, head.stdout.trim()], cwd);
  if (!success(ancestry)) {
    const shallow = git(['rev-parse', '--is-shallow-repository'], cwd);
    return { status: success(shallow) && shallow.stdout.trim() === 'true' ? 'incomplete-history' : 'comparison-failed', files: null, reason: ancestry.status === 1 ? 'Baseline ancestry is not established' : reason(ancestry) };
  }
  const diff = git(['diff', '--name-only', '-z', baseline.sha, head.stdout.trim(), '--'], cwd);
  if (!success(diff)) return { status: 'comparison-failed', files: null, reason: reason(diff) };
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], cwd);
  if (!success(dirty)) return { status: 'comparison-failed', files: null, reason: reason(dirty) };
  return { status: 'ok', baselineSha: baseline.sha, currentSha: head.stdout.trim(), workingTreeClean: dirty.stdout.length === 0, files: diff.stdout.split('\0').filter(Boolean) };
}
export function mapToSystems(files) {
  return [...new Set(files.map(file => file.endsWith('.md') ? 'docs' : file.startsWith('data/') ? 'collection' : 'code'))];
}
// A partial selector is advisory only. All non-document changes get the same known checks.
export const CHECKS = ['npm run typecheck', 'npm run lint', 'npm run test', 'npm run validate:mapping', 'npm run validate:content'];
export function determineTests(systems) { return systems.some(system => system !== 'docs') ? [...CHECKS] : []; }
export function reconcileIssues(previous, findings, currentSha, context = {}) {
  const valid = context.status === 'ok' && context.workingTreeClean === true;
  const checks = context.checks || [];
  const merged = previous.map(old => {
    const finding = valid && findings.find(item => item.id === old.id);
    const check = checks.find(item => item.cmd === old.check && item.status === 'passed');
    const status = finding ? 'confirmed' : valid && check ? 'resolved' : valid ? 'not-rechecked' : 'unknown';
    // Keep an immutable snapshot before replacing current evidence; never mutate input state.
    const { history = [], ...snapshot } = old;
    return { ...old, ...(finding || {}), id: old.id, firstSeen: old.firstSeen,
      lastSeen: finding ? currentSha : old.lastSeen, status,
      resolution: status === 'resolved' ? { revision: currentSha, baselineSha: context.baselineSha, check: check.cmd } : null,
      history: [...history, structuredClone(snapshot)] };
  });
  if (valid) for (const finding of findings) {
    if (!previous.some(old => old.id === finding.id)) merged.push({ ...finding, status: 'new', firstSeen: currentSha, lastSeen: currentSha, history: [] });
  }
  return merged;
}
export function run({ baseline, execute = false, cwd = process.cwd() } = {}) {
  const started = performance.now();
  let comparison = getChangedFiles(baseline, cwd);
  const stateFile = join(outputDirectory(cwd), 'state.json');
  if (existsSync(stateFile) && lstatSync(stateFile).isSymbolicLink()) throw new Error('Refusing state symlink');
  const previous = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { issues: [], runs: [] };
  const affectedSystems = comparison.files ? mapToSystems(comparison.files) : [];
  const selected = comparison.status === 'ok' && comparison.workingTreeClean ? determineTests(affectedSystems) : [];
  const checks = selected.map(cmd => {
    if (!execute) return { cmd, attempted: false, status: 'unavailable', reason: 'Checks were not requested (--checks)' };
    const start = performance.now();
    const result = spawnSync('npm', cmd.split(' ').slice(1), { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    return { cmd, attempted: true, status: result.error || result.status === null ? 'unavailable' : result.status === 0 ? 'passed' : 'failed',
      durationMs: performance.now() - start, exitCode: result.status, evidence: `${result.stdout || ''}\n${result.stderr || ''}\n${result.error?.message || ''}`.slice(-8000) };
  });
  if (checks.some(check => check.status !== 'unavailable')) {
    const after = getChangedFiles(baseline, cwd);
    if (after.status !== 'ok' || !after.workingTreeClean || after.currentSha !== comparison.currentSha) {
      comparison = { ...comparison, status: 'comparison-failed', workingTreeClean: false, reason: 'Repository changed during verification; evidence is not revision-specific' };
    }
  }
  const findings = checks.filter(check => check.status === 'failed').map(check => ({ id: Buffer.from(check.cmd).toString('base64'), check: check.cmd, title: `Test failed: ${check.cmd}`, description: check.evidence }));
  const issues = reconcileIssues(previous.issues || [], findings, comparison.currentSha, { ...comparison, checks });
  const lastRun = { timestamp: new Date().toISOString(), analysisDurationMs: performance.now() - started,
    comparison, affectedSystems, checks, issues,
    avoidedWork: { commandsNotAttempted: CHECKS.filter(cmd => !checks.some(check => check.cmd === cmd && check.attempted)), savedDurationMs: null },
    unverifiedClaims: ['Skipped or unavailable checks provide no passing evidence.', 'Time saved and real-device performance are UNKNOWN.', ...(comparison.workingTreeClean === false ? ['Tracked working tree is dirty; revision-specific verification unavailable.'] : [])],
    recommendations: issues.filter(issue => issue.status !== 'resolved').slice(0, 3).map(issue => `Recheck ${issue.title}`) };
  writeOutput('state.json', JSON.stringify({ issues, runs: [...(previous.runs || []), lastRun], lastRun }, null, 2), cwd);
  return lastRun;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--checks' && !arg.startsWith('--baseline='))) throw new Error('Use --baseline=<full commit SHA> [--checks]');
  const report = run({ baseline: args.find(arg => arg.startsWith('--baseline='))?.slice(11), execute: args.includes('--checks') });
  console.log(JSON.stringify(report, null, 2));
  if (report.comparison.status !== 'ok' || report.comparison.workingTreeClean === false || report.checks.some(check => check.status !== 'passed')) process.exitCode = 1;
}
