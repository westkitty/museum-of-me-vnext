import { el, clear } from '../ui/dom';
import { COLLECTION, exhibitsForWing, projectsForExhibit } from '../content/collection.generated';
import type { StreamingManager } from '../exhibits/StreamingManager';

/**
 * The accessible museum.
 *
 * Plan §31: every physical plaque has a focusable DOM equivalent. This goes
 * further — the whole collection is reachable by keyboard without walking, and
 * whichever exhibit the visitor is standing in reports its live interactive
 * state in words. Atmosphere never costs readability.
 */
export class DomMirror {
  private readonly liveRegion: HTMLElement;
  private readonly stateBlock: HTMLElement;
  private currentExhibit: string | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly streaming: StreamingManager,
    private readonly onOpenExhibit: (id: string) => void,
  ) {
    this.liveRegion = el('p', { role: 'status', 'aria-live': 'polite', class: 'a11y-live' });
    this.stateBlock = el('div', {});
    this.build();
  }

  private build(): void {
    clear(this.root);
    this.root.append(
      el('a', { class: 'skip', href: '#a11y-collection', text: 'Skip to the museum contents' }),
      el('h1', { text: 'Museum of Me — The Reliquary of Iterative Becoming' }),
      el('p', {
        text:
          'A first-person museum of sixty-four projects, presented through thirty-five exhibits across six wings and two levels. ' +
          'The full text of every exhibit is below and needs no walking. Press H at any time to return here, or Escape to go back to the museum.',
      }),
      el('h2', { text: 'Controls' }),
      el('ul', {},
        el('li', { text: 'W A S D or the arrow keys — walk. Shift — sprint.' }),
        el('li', { text: 'Q and E — turn. Page Up and Page Down — look vertically. A mouse is optional.' }),
        el('li', { text: 'Space — jump. F or Enter — interact with whatever you are facing.' }),
        el('li', { text: 'M — map. J — journal. O — settings. H — these contents.' }),
        el('li', { text: 'Escape — release the mouse, or close a panel.' }),
        el('li', { text: 'On a touch screen: the left half of the screen walks, the right half looks, and a tap in the centre interacts.' }),
      ),
      el('p', {
        text:
          'Settings (O) offer reduced motion, high contrast, interface scaling, field of view, look sensitivity and subtitles. ' +
          'With reduced motion on, every exhibit stays fully usable — its moving parts simply hold still.',
      }),
      el('h2', { text: 'Where you are' }),
      this.stateBlock,
      this.liveRegion,
      el('h2', { id: 'a11y-collection', text: 'The collection' }),
      ...this.collectionNodes(),
      ...this.sanctuaryNodes(),
    );
  }

  private collectionNodes(): Node[] {
    const nodes: Node[] = [];
    for (const wing of COLLECTION.wings) {
      nodes.push(
        el('h3', { text: `${wing.subtitle} — ${wing.name}` }),
        el('p', { text: wing.blurb }),
      );
      const list = el('ul', {});
      for (const record of exhibitsForWing(wing.id)) {
        const projects = projectsForExhibit(record.id);
        list.append(
          el('li', {},
            el('button', {
              type: 'button',
              class: 'panel__card',
              text: `${record.id} · ${record.title} — ${record.copy.subtitle}`,
              onclick: () => this.onOpenExhibit(record.id),
            }),
            el('p', { text: record.copy.plaque }),
            el('p', { text: `Represents: ${projects.map((p) => p.name).join(', ')}.` }),
          ),
        );
      }
      nodes.push(list);
    }
    return nodes;
  }

  /**
   * The Sanctuary, listed after the collection and deliberately not among it.
   * Dexter is not a project and this is not exhibit thirty-six.
   */
  private sanctuaryNodes(): Node[] {
    return [
      el('h3', { text: 'The Dexter Sanctuary' }),
      el('p', {
        text:
          'Below and behind the Rotunda, reached by a ramp through a narrow threshold. It is not one of the thirty-five exhibits. ' +
          'A tricolour Phalène, with the hanging ears the variety is named for. Several systems in this museum carry his name; none of them are him. ' +
          'There is nothing to collect here and nothing to complete.',
      }),
    ];
  }

  /** Called when the visitor's focus or location changes. */
  setCurrentExhibit(exhibitId: string | null): void {
    if (exhibitId === this.currentExhibit) return;
    this.currentExhibit = exhibitId;
    this.refreshState();
  }

  /** Refresh the live state description of the exhibit the visitor is in. */
  refreshState(): void {
    clear(this.stateBlock);
    if (!this.currentExhibit) {
      this.stateBlock.append(el('p', { text: 'You are between exhibits.' }));
      return;
    }
    const host = this.streaming.get(this.currentExhibit);
    if (!host || !host.isActive) {
      this.stateBlock.append(el('p', { text: 'That exhibit is not currently loaded.' }));
      return;
    }
    const content = host.module.getAccessibleContent();
    this.stateBlock.append(
      el('h3', { text: content.heading }),
      el('p', { text: content.plaque }),
      el('p', { text: `Current state: ${content.state}` }),
      el('h4', { text: 'What you can do here' }),
      el('ul', {}, ...content.controls.map((c) => el('li', { text: `${c.label} — ${c.description}` }))),
      ...content.body.map((paragraph) => el('p', { text: paragraph })),
    );
  }

  announce(message: string): void {
    this.liveRegion.textContent = message;
  }

  focus(): void {
    const first = this.root.querySelector<HTMLElement>('a, button');
    first?.focus();
  }

  dispose(): void {
    clear(this.root);
  }
}
