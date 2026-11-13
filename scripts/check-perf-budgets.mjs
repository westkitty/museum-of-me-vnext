#!/usr/bin/env node
// Compare a device performance run (perf-results/) with tests/perf/budgets.json.
// Exit 1 if any limit is broken; targets only warn. Missing results are reported, not passed.
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Resolve "a.b[*].c[0]" against a value; [*] fans out over arrays. */
export function resolvePath(value, path) {
  let current = [value];
  for (const token of path.match(/[^.[\]]+|\[\*\]|\[\d+\]/g) ?? []) {
    const next = [];
    for (const item of current) {
      if (item === undefined || item === null) continue;
      if (token === '[*]') { if (Array.isArray(item)) next.push(...item); }
      else if (/^\[\d+\]$/.test(token)) next.push(item[Number(token.slice(1, -1))]);
      else next.push(item[token]);
    }
    current = next;
  }
  return current.filter((item) => typeof item === 'number' && Number.isFinite(item));
}

/** Derive growth figures from the transition run's GC snapshots. */
export function withDerived(results) {
  const transitions = (results.transitions ?? []).map((run) => {
    const gc = run.gcAfter0_5_10RoundTrips ?? [];
    if (gc.length < 2) return run;
    return { ...run, domGrowth: gc.at(-1).domNodes - gc[0].domNodes, heapGrowthMB: +(gc.at(-1).jsHeapUsedMB - gc[0].jsHeapUsedMB).toFixed(2) };
  });
  return { ...results, transitions };
}

export function checkBudgets(budgets, results) {
  const rows = [];
  for (const budget of budgets) {
    const values = resolvePath(results, budget.path);
    if (!values.length) { rows.push({ ...budget, status: 'MISSING', worst: null }); continue; }
    const worst = budget.max !== undefined ? Math.max(...values) : Math.min(...values);
    const broken = (budget.max !== undefined && worst > budget.max) || (budget.min !== undefined && worst < budget.min);
    const missedTarget = budget.target !== undefined && (budget.max !== undefined ? worst > budget.target : worst < budget.target);
    rows.push({ ...budget, worst, status: broken ? 'FAIL' : missedTarget ? 'WARN' : 'PASS' });
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { budgets, device } = JSON.parse(readFileSync('tests/perf/budgets.json', 'utf8'));
  const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
  const device_ = read('perf-results/device-results.json');
  const transitions = read('perf-results/transition-results.json');
  const results = withDerived({ ...(device_ ?? {}), transitions: transitions ?? [] });
  const rows = checkBudgets(budgets, results);
  console.log(`Performance budgets (baseline device: ${device})`);
  if (results.gpu) console.log(`This run: ${results.gpu.renderer}`);
  for (const row of rows) {
    const bound = row.max !== undefined ? `<= ${row.max}` : `>= ${row.min}`;
    console.log(`  ${row.status.padEnd(7)} ${row.id.padEnd(28)} worst ${row.worst ?? '-'} ${row.unit} (limit ${bound}${row.target !== undefined ? `, target ${row.target}` : ''})`);
  }
  const failed = rows.filter((row) => row.status === 'FAIL' || row.status === 'MISSING');
  console.log(failed.length ? `perf budgets: FAIL (${failed.length})` : 'perf budgets: PASS');
  process.exit(failed.length ? 1 : 0);
}
