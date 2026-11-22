import { Panel } from './Panel';
import { el } from './dom';
import type { Passport } from '../state/Passport';
import type { PocketWorldRegistry } from '../world/pocket/PocketWorldRegistry';
import type { PocketWorldDefinition, StampedWorldId } from '../world/pocket/types';
import './pocket.css';

/**
 * Two-page 10-slot Pocket-World Passport modal (`KeyP`).
 *
 * Left page: W01..W05. Right page: W06..W10.
 * Bonus interlude L01 sits in a separate footer card strictly outside the
 * 10-stamp tally. Rootbound Hollow and museum secrets are never counted here.
 */
export class PassportPanel extends Panel {
  private readonly unbind: (() => void)[] = [];

  constructor(
    private readonly passport: Passport,
    private readonly registry: PocketWorldRegistry,
    private readonly isInPocketWorld: () => boolean = () => false,
    private readonly activePocketTitle: () => string | null = () => null,
    private readonly onExitPocket?: () => void,
  ) {
    super('passport', 'Passport', 'Pocket worlds & stamps');
    this.unbind.push(
      passport.subscribe(() => { if (this.isOpen) this.render(); }),
      registry.subscribe(() => { if (this.isOpen) this.render(); }),
    );
  }

  protected render(): void {
    const stamped = this.registry.stampedDefinitions();
    const leftSlots = stamped.slice(0, 5);
    const rightSlots = stamped.slice(5, 10);
    const bonus = this.registry.bonusDefinitions()[0];
    const earned = this.passport.earnedCount;
    const total = this.passport.totalStamps;
    const inPocket = this.isInPocketWorld();
    const activeTitle = this.activePocketTitle();

    const summaryChildren: Array<Node | string> = [
      el('div', { class: 'passport-summary__tally' },
        el('strong', { text: `${earned} of ${total} stamps` }),
        el('span', {
          text: inPocket && activeTitle
            ? `Currently exploring: ${activeTitle}. Return safely any time.`
            : 'Optional pocket worlds across the island and museum.',
        }),
      ),
    ];
    if (inPocket && this.onExitPocket) {
      summaryChildren.push(
        el('button', {
          class: 'passport-summary__back',
          type: 'button',
          text: 'Back to Museum',
          onclick: () => {
            this.close();
            this.onExitPocket?.();
          },
        }),
      );
    }

    const nodes: Array<Node> = [
      el('section', { class: 'passport-summary', role: 'status', 'aria-live': 'polite' }, ...summaryChildren),
    ];

    if (this.passport.recoveryNotice) {
      nodes.push(el('p', { class: 'passport-notice', role: 'status', text: this.passport.recoveryNotice }));
    }

    nodes.push(
      el('div', { class: 'passport-spread' },
        this.renderPage('Page I · Worlds 01–05', leftSlots, earned),
        this.renderPage('Page II · Worlds 06–10', rightSlots, earned),
      ),
    );

    if (bonus) {
      nodes.push(this.renderBonusCard(bonus));
    }

    const footerActions: Array<Node> = [
      el('p', {
        class: 'panel__note',
        text: 'Ten optional stamps (W01–W10). Bonus interludes and main-island discoveries never add an eleventh stamp, and the main museum never requires a stamp.',
      }),
    ];
    if (inPocket && this.onExitPocket) {
      footerActions.push(
        el('button', {
          class: 'passport-summary__back',
          type: 'button',
          text: 'Back to Museum',
          onclick: () => {
            this.close();
            this.onExitPocket?.();
          },
        }),
      );
    }
    nodes.push(el('div', { class: 'passport-footer-actions' }, ...footerActions));

    this.setContent(...nodes);
  }

  private renderPage(heading: string, defs: readonly PocketWorldDefinition[], earnedCount: number): HTMLElement {
    return el('section', { class: 'passport-page', 'aria-label': heading },
      el('h3', { class: 'passport-page__title', text: heading }),
      el('ol', { class: 'passport-slots' },
        ...defs.map((def) => this.renderSlot(def, earnedCount)),
      ),
    );
  }

  private renderSlot(def: PocketWorldDefinition, earnedCount: number): HTMLElement {
    const id = def.id as StampedWorldId;
    const stamp = this.passport.stampFor(id);
    const visited = this.passport.hasVisited(id);
    const locked = !stamp && earnedCount < def.requiresStampCount;
    const playable = this.registry.isPlayable(id, this.passport);

    let statusText: string;
    if (stamp) {
      statusText = `Stamped · ${formatDate(stamp.earnedAt)}`;
    } else if (locked) {
      statusText = 'Locked · Earn 1 stamp to unlock';
    } else if (visited) {
      statusText = 'Explored · Not yet stamped';
    } else if (playable) {
      statusText = 'Ready · Not yet stamped';
    } else {
      statusText = 'Passage dormant';
    }

    const stateClass = stamp
      ? 'passport-slot--stamped'
      : locked
        ? 'passport-slot--locked'
        : visited
          ? 'passport-slot--visited'
          : '';

    return el('li', { class: `passport-slot ${stateClass}`.trim(), 'data-world-id': def.id },
      el('span', { class: 'passport-slot__seal', 'aria-hidden': 'true', text: stamp ? '✦' : def.id }),
      el('div', { class: 'passport-slot__body' },
        el('strong', { text: `${def.id} · ${def.title}` }),
        el('span', { class: 'passport-slot__entry', text: `Entry: ${def.entryDescription}` }),
        el('span', { class: 'passport-slot__status', text: statusText }),
      ),
    );
  }

  private renderBonusCard(def: PocketWorldDefinition): HTMLElement {
    const bonus = this.passport.bonusFor('L01');
    const visited = this.passport.hasVisited('L01');
    const playable = this.registry.isPlayable('L01', this.passport);
    const statusText = bonus
      ? `Beacon relit · ${formatDate(bonus.completedAt)} (Bonus complete — does not add a stamp)`
      : visited
        ? 'Explored · Optional interlude (no stamp slot)'
        : playable
          ? 'Ready · Optional interlude (no stamp slot)'
          : 'Passage dormant · Optional interlude (no stamp slot)';

    return el('section', {
      class: `passport-bonus${bonus ? ' passport-bonus--complete' : ''}`,
      'aria-label': 'Bonus interlude',
      'data-world-id': def.id,
    },
    el('span', { class: 'passport-bonus__kicker', text: 'Bonus Interlude · No Stamp Slot' }),
    el('strong', { text: `${def.id} · ${def.title}` }),
    el('span', { class: 'passport-bonus__entry', text: `Entry: ${def.entryDescription}` }),
    el('span', { class: 'passport-bonus__status', text: statusText }),
    );
  }

  override dispose(): void {
    for (const off of this.unbind) off();
    this.unbind.length = 0;
    super.dispose();
  }
}

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recorded';
  }
}
