import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const STATE_FILE = '.sentinel.json';
const OUTPUT_DIR = 'public/sentinel';
const OUTPUT_FILE = join(OUTPUT_DIR, 'index.html');

function generateReport() {
    if (!existsSync(STATE_FILE)) {
        console.error("No sentinel state found. Run runner.mjs first.");
        return;
    }

    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    const lastRun = state.lastRun || {};
    const issues = lastRun.issues || [];
    const claims = lastRun.unverifiedClaims || [];
    const recommendations = lastRun.recommendations || [];

    const newIssues = issues.filter(i => i.status === 'new');
    const confirmedIssues = issues.filter(i => i.status === 'confirmed');
    const resolvedIssues = issues.filter(i => i.status === 'resolved');

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Museum of Me \u2014 Drift Sentinel 2.0</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 20px; line-height: 1.6; }
        .container { max-width: 900px; margin: 0 auto; background: #151515; border: 1px solid #333; padding: 30px; border-radius: 8px; }
        h1, h2, h3 { color: #fff; margin-top: 0; }
        h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
        .metadata { margin-bottom: 30px; padding: 15px; background: #1a1a1a; border-left: 4px solid #555; }
        .issue { margin-bottom: 20px; padding: 15px; background: #222; border-left: 4px solid #888; }
        .issue.new { border-left-color: #ff5555; background: #2a1515; }
        .issue.confirmed { border-left-color: #ffaa00; background: #2a2210; }
        .issue.resolved { border-left-color: #55ff55; background: #152a15; opacity: 0.8; }
        .issue h3 { margin: 0 0 10px 0; }
        pre { background: #111; padding: 10px; overflow-x: auto; font-size: 0.9em; border: 1px solid #333; }
        ul { padding-left: 20px; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; margin-left: 10px; }
        .badge.new { background: #551111; color: #ffaaaa; border: 1px solid #ff5555; }
        .badge.confirmed { background: #553300; color: #ffcc66; border: 1px solid #ffaa00; }
        .badge.resolved { background: #113311; color: #aaffaa; border: 1px solid #55ff55; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Drift Sentinel 2.0 Inspection Report</h1>

        <div class="metadata">
            <p><strong>Inspection Time:</strong> ${lastRun.timestamp || 'N/A'}</p>
            <p><strong>Analysis Duration:</strong> ${lastRun.analysisDurationMs ? (lastRun.analysisDurationMs / 1000).toFixed(2) + 's' : 'N/A'}</p>
            <p><strong>Avoided Work:</strong> ${lastRun.avoidedWork || 'N/A'}</p>
            <p><strong>Comparison Baseline:</strong> <code>${lastRun.baselineSha || 'N/A'}</code></p>
            <p><strong>Current Revision:</strong> <code>${lastRun.currentSha || 'N/A'}</code></p>
            <p><strong>Affected Systems:</strong> ${lastRun.affectedSystems?.length ? lastRun.affectedSystems.join(', ') : 'None'}</p>
            <p><strong>Changed Files:</strong> ${lastRun.changedFiles?.length || 0}</p>
        </div>

        <h2>Unverified Claims (Explicit Unknowns)</h2>
        <ul>
            ${claims.map(c => `<li>${c}</li>`).join('') || '<li>None recorded</li>'}
        </ul>

        <h2>Recommendations (Max 3)</h2>
        <ul>
            ${recommendations.map(r => `<li>${r}</li>`).join('') || '<li>None</li>'}
        </ul>

        <h2>Timeline of Findings</h2>

        ${newIssues.length > 0 ? '<h3>Newly Confirmed Issues</h3>' : ''}
        ${newIssues.map(i => `
            <div class="issue new">
                <h3>${i.title} <span class="badge new">NEW</span></h3>
                <p><strong>First Seen:</strong> <code>${i.firstSeen}</code></p>
                <pre>${i.description}</pre>
            </div>
        `).join('')}

        ${confirmedIssues.length > 0 ? '<h3>Existing Unresolved Issues</h3>' : ''}
        ${confirmedIssues.map(i => `
            <div class="issue confirmed">
                <h3>${i.title} <span class="badge confirmed">CONFIRMED</span></h3>
                <p><strong>First Seen:</strong> <code>${i.firstSeen}</code> | <strong>Last Seen:</strong> <code>${i.lastSeen}</code></p>
                <pre>${i.description}</pre>
            </div>
        `).join('')}

        ${resolvedIssues.length > 0 ? '<h3>Recently Resolved</h3>' : ''}
        ${resolvedIssues.map(i => `
            <div class="issue resolved">
                <h3>${i.title} <span class="badge resolved">RESOLVED</span></h3>
                <p><strong>First Seen:</strong> <code>${i.firstSeen}</code></p>
            </div>
        `).join('')}

        ${issues.length === 0 ? '<p>No issues detected.</p>' : ''}
    </div>
</body>
</html>`;

    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    writeFileSync(OUTPUT_FILE, html);
    console.log(`Sentinel report generated at ${OUTPUT_FILE}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateReport();
}

export { generateReport };
