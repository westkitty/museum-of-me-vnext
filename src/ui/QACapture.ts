import type { App } from '../app/App';
import { el } from './dom';

type QAStatus = 'pending' | 'pass' | 'needs-work';

interface QACheck {
  readonly id: string;
  readonly label: string;
}

const CHECKS: readonly QACheck[] = [
  { id: 'garden', label: 'Garden and facade composition reads cleanly from the real spawn.' },
  { id: 'daylight', label: 'Daylight is bright without looking washed out.' },
  { id: 'rotunda', label: 'Rotunda stays luminous and neutral while all six route threads remain legible.' },
  { id: 'wings', label: 'Wing furnishing and atmosphere add identity without clutter or blocked sightlines.' },
  { id: 'exhibits', label: 'Exhibit colour fields support rather than overpower representative hero objects.' },
  { id: 'pointer', label: 'Pointer lock captures, releases, recovers, and recaptures correctly on this device.' },
  { id: 'audio', label: 'Audio begins muted by default; Sound controls and opted-in playback behave as expected.' },
  { id: 'performance', label: 'Representative-device FPS and 1% low are acceptable at the required checkpoints.' },
  { id: 'defects', label: 'No visible voids, z-fighting, clipping, broken transparency, or obvious geometry failure.' },
];

/**
 * Human-only evidence recorder used by `?qa=1`.
 *
 * It never decides pass/fail itself and never mutates museum state. A human
 * records observations manually; telemetry snapshots only capture the existing
 * read-only diagnostic values at that moment.
 */
export class QACapture {
  readonly root: HTMLElement;

  private readonly body: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly summary: HTMLElement;
  private readonly notes: HTMLTextAreaElement;
  private readonly report: HTMLTextAreaElement;
  private readonly snapshotsNode: HTMLElement;
  private readonly statuses = new Map<string, QAStatus>();
  private readonly snapshots: string[] = [];
  private expanded = false;

  constructor(private readonly app: App) {
    for (const check of CHECKS) this.statuses.set(check.id, 'pending');

    this.toggleButton = el('button', {
      type: 'button',
      text: 'QA evidence',
      'aria-expanded': 'false',
      style: 'width:100%;background:#17141f;color:#f1eadf;border:0;padding:.55rem .7rem;text-align:left;font:600 .78rem ui-sans-serif,system-ui;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;',
      onclick: () => this.setExpanded(!this.expanded),
    });

    this.summary = el('p', {
      text: '0 passed · 0 needs work · 9 pending',
      style: 'margin:.55rem 0 .7rem;color:#c8c0b4;font:.72rem/1.45 ui-sans-serif,system-ui;',
    });

    const checks = el('div', { style: 'display:grid;gap:.55rem;' });
    CHECKS.forEach((check, index) => {
      const select = el('select', {
        id: `qa-check-${index}`,
        style: 'min-width:7.4rem;background:#111018;color:#eee7db;border:1px solid #4a4358;border-radius:3px;padding:.22rem .3rem;font:inherit;',
        onchange: (event: Event) => {
          const value = (event.currentTarget as HTMLSelectElement).value as QAStatus;
          this.statuses.set(check.id, value);
          this.refreshSummary();
        },
      },
      el('option', { value: 'pending', text: 'Pending' }),
      el('option', { value: 'pass', text: 'Pass' }),
      el('option', { value: 'needs-work', text: 'Needs work' }));

      const label = el('label', {
        for: select.id,
        style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:.55rem;color:#e6ded2;font:.72rem/1.45 ui-sans-serif,system-ui;',
      }, el('span', { text: check.label }), select);
      checks.append(label);
    });

    const snapshotButton = el('button', {
      type: 'button',
      text: 'Capture telemetry snapshot',
      style: this.actionButtonStyle(),
      onclick: () => this.captureSnapshot(),
    });
    const generateButton = el('button', {
      type: 'button',
      text: 'Generate Markdown report',
      style: this.actionButtonStyle(),
      onclick: () => this.generateReport(),
    });

    this.snapshotsNode = el('pre', {
      text: 'No telemetry snapshots yet.',
      'aria-live': 'polite',
      style: 'max-height:8rem;overflow:auto;white-space:pre-wrap;margin:.55rem 0;background:#0d0c12;border:1px solid #332e3d;padding:.5rem;color:#a8d9bf;font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;',
    });

    this.notes = el('textarea', {
      rows: '4',
      placeholder: 'Human notes: clipping, exposure, mute/default volume, device details, exact problem location…',
      style: 'width:100%;resize:vertical;background:#0d0c12;color:#eee7db;border:1px solid #4a4358;border-radius:3px;padding:.45rem;font:11px/1.45 ui-sans-serif,system-ui;',
    });

    this.report = el('textarea', {
      rows: '10',
      readonly: true,
      'aria-label': 'Generated human QA Markdown report',
      placeholder: 'Generate the report after the manual pass. Nothing is saved automatically.',
      style: 'width:100%;resize:vertical;background:#08070b;color:#d8d0c4;border:1px solid #332e3d;border-radius:3px;padding:.45rem;font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;',
    });

    this.body = el('div', {
      hidden: true,
      style: 'padding:.1rem .7rem .75rem;',
    },
    el('p', {
      text: 'Manual evidence only. Mark what you actually observe; telemetry supports the record but does not decide visual, audio, pointer-lock, or performance acceptance.',
      style: 'margin:.55rem 0;color:#d3cabd;font:.7rem/1.45 ui-sans-serif,system-ui;',
    }),
    this.summary,
    checks,
    el('div', { style: 'display:flex;gap:.45rem;flex-wrap:wrap;margin:.75rem 0 .4rem;' }, snapshotButton, generateButton),
    this.snapshotsNode,
    el('label', { style: 'display:grid;gap:.3rem;color:#d3cabd;font:.7rem ui-sans-serif,system-ui;' }, 'Notes', this.notes),
    el('label', { style: 'display:grid;gap:.3rem;margin-top:.6rem;color:#d3cabd;font:.7rem ui-sans-serif,system-ui;' }, 'Report', this.report));

    this.root = el('aside', {
      class: 'qa-capture',
      'aria-label': 'Human QA evidence recorder',
      style: 'position:fixed;top:.9rem;right:.9rem;z-index:50;width:min(390px,calc(100vw - 1.8rem));max-height:calc(100vh - 1.8rem);overflow:auto;background:rgba(10,9,14,.96);border:1px solid rgba(232,198,90,.5);border-radius:4px;box-shadow:0 16px 50px rgba(0,0,0,.55);pointer-events:auto;',
    }, this.toggleButton, this.body);
  }

  dispose(): void {
    this.root.remove();
  }

  private setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.body.hidden = !expanded;
    this.toggleButton.setAttribute('aria-expanded', String(expanded));
    this.toggleButton.textContent = expanded ? 'QA evidence — close' : 'QA evidence';
  }

  private refreshSummary(): void {
    let pass = 0;
    let needsWork = 0;
    for (const status of this.statuses.values()) {
      if (status === 'pass') pass++;
      if (status === 'needs-work') needsWork++;
    }
    const pending = CHECKS.length - pass - needsWork;
    this.summary.textContent = `${pass} passed · ${needsWork} needs work · ${pending} pending`;
  }

  private captureSnapshot(): void {
    const s = this.app.diagnostics.stats;
    const p = this.app.player.position;
    const line = [
      new Date().toISOString(),
      `zone=${this.app.zoneLabel}`,
      `pos=${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`,
      `fps=${s.fps.toFixed(0)}`,
      `low1=${this.app.diagnostics.fpsLow1.toFixed(0)}`,
      `draws=${s.drawCalls}`,
      `tris=${s.triangles}`,
      `geo=${s.geometries}`,
      `tex=${s.textures}`,
      `resident=${s.streamingResident}`,
      `active=${s.activeExhibits}`,
      `audio=${this.app.audio.isRunning ? 'on' : 'off'}`,
      `pointer=${this.app.input.pointerLocked ? 'locked' : 'free'}`,
      `exhibit=${this.app.currentExhibitId ?? '—'}`,
    ].join(' | ');
    this.snapshots.push(line);
    this.snapshotsNode.textContent = this.snapshots.join('\n');
  }

  private generateReport(): void {
    const statusLabel = (status: QAStatus): string => {
      if (status === 'pass') return 'PASS';
      if (status === 'needs-work') return 'NEEDS WORK';
      return 'PENDING';
    };
    const checkLines = CHECKS.map((check) => {
      const status = this.statuses.get(check.id) ?? 'pending';
      const mark = status === 'pass' ? 'x' : ' ';
      return `- [${mark}] **${statusLabel(status)}** — ${check.label}`;
    });
    const snapshotLines = this.snapshots.length
      ? this.snapshots.map((line) => `- \`${line}\``)
      : ['- No telemetry snapshots captured.'];
    const notes = this.notes.value.trim() || 'No notes recorded.';

    this.report.value = [
      '# Museum of Me vNext — Human QA Evidence',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '> Human-recorded observations. Automated/headless checks do not satisfy these judgments.',
      '',
      '## Acceptance checks',
      '',
      ...checkLines,
      '',
      '## Telemetry snapshots',
      '',
      ...snapshotLines,
      '',
      '## Notes',
      '',
      notes,
      '',
    ].join('\n');
    this.report.focus();
    this.report.select();
  }

  private actionButtonStyle(): string {
    return 'background:#282231;color:#f3ebdf;border:1px solid #5a4d69;border-radius:3px;padding:.35rem .5rem;font:600 10px ui-sans-serif,system-ui;cursor:pointer;';
  }
}
