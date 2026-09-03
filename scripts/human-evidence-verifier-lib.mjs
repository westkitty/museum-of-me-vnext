const ACCEPTANCE_LINE = /^- \[[ xX]\] \*\*(PASS|PENDING|NEEDS WORK)\*\* — /gm;
const SNAPSHOT_LINE = /^- `[^`]*zone=[^`]*fps=[^`]*low1=[^`]*`$/gm;

export function verifyHumanEvidence(markdown) {
  const errors = [];
  const checks = [];
  const text = String(markdown ?? '');

  if (!text.includes('# Museum of Me vNext — Human QA Evidence')) {
    errors.push('missing Museum of Me human QA evidence heading');
  }

  const statuses = [...text.matchAll(ACCEPTANCE_LINE)].map((match) => match[1]);
  if (statuses.length !== 9) {
    errors.push(`expected exactly 9 acceptance checks, found ${statuses.length}`);
  } else {
    const pending = statuses.filter((status) => status === 'PENDING').length;
    const needsWork = statuses.filter((status) => status === 'NEEDS WORK').length;
    const passed = statuses.filter((status) => status === 'PASS').length;
    if (pending > 0) errors.push(`${pending} acceptance check(s) remain PENDING`);
    if (needsWork > 0) errors.push(`${needsWork} acceptance check(s) remain NEEDS WORK`);
    if (passed !== 9) errors.push(`expected 9 PASS acceptance checks, found ${passed}`);
    if (errors.length === 0) checks.push('all 9 human acceptance checks are PASS');
  }

  const snapshots = [...text.matchAll(SNAPSHOT_LINE)];
  if (snapshots.length < 6) {
    errors.push(`expected at least 6 telemetry snapshots, found ${snapshots.length}`);
  } else {
    checks.push(`${snapshots.length} telemetry snapshots recorded`);
  }

  const notesMatch = text.match(/## Notes\s*\n\s*([\s\S]*?)(?:\n## |$)/);
  const notes = notesMatch?.[1]?.trim() ?? '';
  if (!notes || /^No notes recorded\.?$/i.test(notes)) {
    errors.push('human notes are missing; record device/browser identity and concrete observations');
  } else {
    checks.push('human notes are present');
  }

  if (/No telemetry snapshots captured\./i.test(text)) {
    errors.push('report explicitly says no telemetry snapshots were captured');
  }

  return { ok: errors.length === 0, errors, checks };
}
