import type { App } from '../app/App';
import type { MuseumPlacements } from './MuseumPlacements';
import { Workshop as BaseWorkshop } from './Workshop';
import { WorkshopSpatialXRay } from './WorkshopSpatialXRay';
import './workshop-conservation-studio.css';

interface LedgerDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

interface LedgerCheckpoint {
  readonly id: string;
  readonly createdAt: string;
  readonly label: string;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly beforeObjects: number;
  readonly afterObjects: number;
  readonly diff: LedgerDiff;
  readonly conservation: 'PASS';
}

interface LedgerDocument {
  readonly version: 1;
  readonly checkpoints: readonly LedgerCheckpoint[];
}

const LEDGER_ENDPOINT = '/__museum-workshop/ledger';

/**
 * Development-only conservation shell around the existing Workshop. The base
 * Workshop remains the authoring owner; this layer adds inspectable spatial
 * protection and durable save-history visibility without replacing its state.
 */
export class Workshop {
  private readonly base: BaseWorkshop;
  private readonly xray: WorkshopSpatialXRay;
  private readonly root = document.createElement('section');
  private readonly status = document.createElement('p');
  private readonly list = document.createElement('ol');
  private readonly xrayButton = document.createElement('button');
  private readonly ledgerButton = document.createElement('button');
  private readonly baseObserver: MutationObserver;
  private ledgerCount: number | null = null;

  constructor(app: App, placements: MuseumPlacements) {
    this.base = new BaseWorkshop(app, placements);
    this.xray = new WorkshopSpatialXRay(app.scene);
    this.root.className = 'museum-conservation-studio';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Museum conservation tools');

    const title = document.createElement('strong');
    title.textContent = 'CONSERVATION';
    this.xrayButton.type = 'button';
    this.xrayButton.textContent = 'Spatial X-Ray';
    this.xrayButton.addEventListener('click', () => this.toggleXRay());
    this.ledgerButton.type = 'button';
    this.ledgerButton.textContent = 'Refresh Ledger';
    this.ledgerButton.addEventListener('click', () => void this.refreshLedger());
    this.status.className = 'museum-conservation-status';
    this.status.textContent = 'X-Ray off. Ledger not loaded.';
    this.list.className = 'museum-conservation-ledger';

    const actions = document.createElement('div');
    actions.className = 'museum-conservation-actions';
    actions.append(this.xrayButton, this.ledgerButton);
    this.root.append(title, actions, this.status, this.list);
    document.body.append(this.root);

    // Base Workshop owns F8, Escape and its own Exit button. Observe its hidden
    // state so this additive shell follows every existing open/close path.
    const baseRoot = document.querySelector<HTMLElement>('.museum-workshop');
    this.baseObserver = new MutationObserver(() => this.syncOpenState());
    if (baseRoot) this.baseObserver.observe(baseRoot, { attributes: true, attributeFilter: ['hidden'] });
    this.syncOpenState();
  }

  get isOpen(): boolean { return this.base.isOpen; }

  open(): void {
    this.base.open();
    this.syncOpenState();
  }

  close(): void {
    this.base.close();
    this.syncOpenState();
  }

  toggle(): void {
    this.base.toggle();
    this.syncOpenState();
  }

  dispose(): void {
    this.baseObserver.disconnect();
    this.xray.dispose();
    this.base.dispose();
    this.root.remove();
  }

  private syncOpenState(): void {
    const wasHidden = this.root.hidden;
    this.root.hidden = !this.base.isOpen;
    if (!this.base.isOpen) {
      this.xray.setEnabled(false);
      this.xrayButton.textContent = 'Spatial X-Ray';
    }
    if (wasHidden && this.base.isOpen) void this.refreshLedger();
    this.renderStatus();
  }

  private toggleXRay(): void {
    const enabled = this.xray.toggle();
    this.xrayButton.textContent = enabled ? 'Hide Spatial X-Ray' : 'Spatial X-Ray';
    this.renderStatus();
  }

  private renderStatus(): void {
    const xray = this.xray.isEnabled ? `X-Ray ON — ${this.xray.summary}` : 'X-Ray off';
    const ledger = this.ledgerCount === null
      ? 'Ledger not loaded'
      : `${this.ledgerCount} conservation checkpoint${this.ledgerCount === 1 ? '' : 's'}`;
    this.status.textContent = `${xray}. ${ledger}. Cyan = open sampled space; red = protected sampled space.`;
  }

  private async refreshLedger(): Promise<void> {
    this.ledgerButton.disabled = true;
    try {
      const response = await fetch(LEDGER_ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Ledger HTTP ${response.status}`);
      const ledger = await response.json() as LedgerDocument;
      this.ledgerCount = ledger.checkpoints.length;
      this.renderLedger(ledger);
    } catch (error) {
      this.ledgerCount = null;
      this.list.replaceChildren();
      const item = document.createElement('li');
      item.textContent = error instanceof Error ? error.message : 'Ledger unavailable.';
      this.list.append(item);
    } finally {
      this.ledgerButton.disabled = false;
      this.renderStatus();
    }
  }

  private renderLedger(ledger: LedgerDocument): void {
    this.list.replaceChildren();
    const recent = [...ledger.checkpoints].slice(-6).reverse();
    if (recent.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No conservation checkpoints yet.';
      this.list.append(empty);
      return;
    }

    for (const checkpoint of recent) {
      const item = document.createElement('li');
      const time = new Date(checkpoint.createdAt).toLocaleString();
      item.textContent = `${checkpoint.label} · ${time} · +${checkpoint.diff.added.length} / -${checkpoint.diff.removed.length} / ~${checkpoint.diff.changed.length} · ${checkpoint.conservation}`;
      item.title = `after ${checkpoint.afterHash.slice(0, 12)} · ${checkpoint.afterObjects} objects`;
      this.list.append(item);
    }
  }
}
