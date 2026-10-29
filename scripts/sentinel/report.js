import { readFileSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { outputDirectory, writeOutput } from './runner.js';

export function escapeHtml(value) {
  return String(value ?? 'UNKNOWN').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
export function renderReport(run) {
  const e = escapeHtml;
  const sections = [['new', 'Newly confirmed'], ['confirmed', 'Previously confirmed'], ['resolved', 'Resolved with proof'], ['not-rechecked', 'Not rechecked'], ['unknown', 'Unknown']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Private Drift Sentinel report</title><style>body{font:16px system-ui;max-width:60rem;margin:2rem auto;padding:1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border:1px solid;padding:1rem;margin:1rem 0}</style></head><body>
  <h1>Private Drift Sentinel report</h1><p>Manual inspection; ACTIVE DEVELOPMENT / PRE-1.0. No scheduling enabled.</p>
  <h2>Comparison</h2><pre>${e(JSON.stringify(run.comparison, null, 2))}</pre>
  <p>Inspection duration: ${e(run.analysisDurationMs)} ms</p><p>Timestamp: ${e(run.timestamp)}</p>
  <h2>Actual check evidence</h2>${(run.checks || []).map(check => `<article><h3>${e(check.cmd)}: ${e(check.status)}</h3><pre>${e(JSON.stringify(check, null, 2))}</pre></article>`).join('') || '<p>Unavailable test evidence: no checks executed.</p>'}
  <h2>Check selection (no passing evidence from skipped work; time saved UNKNOWN)</h2><pre>${e(JSON.stringify(run.avoidedWork, null, 2))}</pre>
  ${sections.map(([status, label]) => `<h2>${label}</h2>${(run.issues || []).filter(issue => issue.status === status).map(issue => `<article><h3>${e(issue.title)}</h3><pre>${e(issue.description)}</pre><pre>${e(JSON.stringify(issue, null, 2))}</pre></article>`).join('') || '<p>None recorded</p>'}`).join('')}
  <h2>Unknowns</h2><ul>${(run.unverifiedClaims || []).map(claim => `<li>${e(claim)}</li>`).join('')}</ul>
  <h2>Recommendations</h2><ul>${(run.recommendations || []).map(item => `<li>${e(item)}</li>`).join('')}</ul></body></html>`;
}
export function generateReport(cwd = process.cwd()) {
  const stateFile = join(outputDirectory(cwd), 'state.json');
  if (lstatSync(stateFile).isSymbolicLink()) throw new Error('Refusing state symlink');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  if (!state.lastRun) throw new Error('No Sentinel run found');
  return writeOutput('index.html', renderReport(state.lastRun), cwd);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(generateReport());
