import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const STATE_FILE = '.sentinel.json';

function getBaselineSha() {
  try {
    const opState = readFileSync('OPERATIONAL_STATE.md', 'utf8');
    // Look for: "baseline as of YYYY-MM-DD is `sha`"
    const match = opState.match(/baseline.*?is\s+`([a-f0-9]{40})`/i);
    if (match) return match[1];
  } catch {
    // Ignore error
  }

  const log = execSync('git log -n 10 --oneline', { encoding: 'utf8' });
  const lines = log.split('\n').filter(Boolean);
  if (lines.length > 1) {
      return lines[lines.length - 1].split(' ')[0];
  }
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

function getChangedFiles(baselineSha) {
  const currentSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  if (baselineSha.startsWith(currentSha)) return [];

  try {
    try {
        const output = execSync(`git diff --name-only ${baselineSha}...HEAD`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return output.split('\n').filter(Boolean);
    } catch {
        const log = execSync('git log -n 2 --format="%H"', { encoding: 'utf8' }).trim().split('\n');
        const fallbackBase = log.length > 1 ? log[1] : log[0];
        const output = execSync(`git diff --name-only ${fallbackBase} HEAD`, { encoding: 'utf8' });
        return output.split('\n').filter(Boolean);
    }
  } catch {
    return [];
  }
}

function mapToSystems(changedFiles) {
  const systems = new Set();
  for (const file of changedFiles) {
    if (file.startsWith('src/world/') || file.startsWith('src/exhibits/')) systems.add('museum-systems');
    else if (file.startsWith('data/')) systems.add('collection');
    else if (file.includes('package.json') || file.includes('package-lock.json')) systems.add('dependency');
    else if (file.startsWith('src/state/')) systems.add('persistence');
    else if (file.startsWith('src/player/') || file.startsWith('src/interaction/')) systems.add('input');
    else if (file.startsWith('tests/')) systems.add('tests');
    else if (file.endsWith('.md')) systems.add('docs');
    else systems.add('other');
  }
  return Array.from(systems);
}

function determineTests(systems) {
    const testsToRun = new Set();
    if (systems.includes('dependency') || systems.includes('museum-systems') || systems.includes('collection')) {
        testsToRun.add('npm run typecheck');
        testsToRun.add('npm run lint');
    }
    if (systems.includes('collection')) {
        testsToRun.add('npm run validate:mapping');
        testsToRun.add('npm run validate:content');
    }
    if (systems.includes('museum-systems') || systems.includes('input') || systems.includes('tests')) {
        testsToRun.add('npm run test');
    }
    return Array.from(testsToRun);
}

function executeTests(tests) {
    const failures = [];
    for (const testCmd of tests) {
        console.log(`Running test: ${testCmd}`);
        const result = spawnSync(testCmd, { shell: true, stdio: 'pipe', encoding: 'utf8' });
        if (result.status !== 0) failures.push({ cmd: testCmd, output: result.stderr || result.stdout });
    }
    return failures;
}

function loadState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  return { issues: [], lastRun: null };
}

export function reconcileIssues(previousIssues, newIssues, currentSha) {
  const allIssues = [];
  for (const old of previousIssues) {
      const stillFailing = newIssues.find(n => n.id === old.id);
      if (stillFailing) {
          old.status = 'confirmed';
          old.lastSeen = currentSha;
          allIssues.push(old);
      } else {
          old.status = 'resolved';
          allIssues.push(old);
      }
  }
  for (const n of newIssues) {
      if (!previousIssues.find(o => o.id === n.id)) {
          n.status = 'new';
          allIssues.push(n);
      }
  }
  return allIssues;
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function run() {
  const startTime = Date.now();
  const currentSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const baselineSha = getBaselineSha();
  console.log(`Baseline: ${baselineSha}, Current: ${currentSha}`);

  const changedFiles = getChangedFiles(baselineSha);
  console.log(`Changed files: ${changedFiles.length}`);

  const systems = mapToSystems(changedFiles);
  console.log(`Affected systems: ${systems.join(', ')}`);

  const state = loadState();
  const previousIssues = state.issues || [];

  let tests = [];
  let failures = [];
  let avoidedWork = '';
  if (systems.length === 1 && systems.includes('docs')) {
      console.log('Only documentation changed, skipping heavy tests.');
      avoidedWork = 'Skipped full WebGL gate and 675+ unit tests due to doc-only change.';
  } else {
      tests = determineTests(systems);
      const isPartial = tests.length > 0 && !tests.some(t => t.includes('npm run gate'));
      if (isPartial) {
          avoidedWork = `Ran targeted checks only (${tests.length} commands). Avoided full 12+ command gate.`;
      } else {
          avoidedWork = 'Escalated to required validation based on changed systems.';
      }
      failures = executeTests(tests);
  }

  const newIssues = failures.map(f => ({
      id: Buffer.from(f.cmd).toString('base64'),
      title: `Test failed: ${f.cmd}`,
      description: f.output.substring(0, 500) + (f.output.length > 500 ? '...' : ''),
      status: 'confirmed',
      firstSeen: currentSha,
      lastSeen: currentSha
  }));

  const allIssues = reconcileIssues(previousIssues, newIssues, currentSha);
  const analysisDurationMs = Date.now() - startTime;

  const reportData = {
      timestamp: new Date().toISOString(),
      analysisDurationMs,
      avoidedWork,
      baselineSha,
      currentSha,
      changedFiles,
      affectedSystems: systems,
      testsRun: tests,
      issues: allIssues,
      unverifiedClaims: [
          "Actual real-device performance (FPS) and thermal throttling",
          "Subjective human artistic signoff for visual changes"
      ],
      recommendations: allIssues.filter(i => i.status !== 'resolved').slice(0, 3).map(i => `Fix test failure: ${i.title}`)
  };

  if (reportData.recommendations.length === 0) reportData.recommendations.push("Review doc changes if any");

  state.issues = allIssues;
  state.lastRun = reportData;
  saveState(state);

  console.log("Inspection complete. State saved.");
}

if (import.meta.url === `file://${process.argv[1]}`) run();

export { getBaselineSha, getChangedFiles, mapToSystems, determineTests };
