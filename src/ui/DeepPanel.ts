import { Panel } from './Panel';
import { el } from './dom';
import { EXHIBITS_BY_ID } from '../content/collection.generated';
import { museumLink } from '../content/collectionLinks';
import type { Journal } from '../state/Journal';
import { exhibitReading, type ExhibitReadingContext } from './ExhibitReading';

/** Interpretation layer 3, including project history and source references. */
export class DeepPanel extends Panel {
  private exhibitId: string | null = null;

  constructor(
    private readonly journal: Journal,
    private readonly guideTo?: (exhibitId: string) => void,
    private readonly locate?: ExhibitReadingContext['locate'],
  ) {
    super('deep', 'Exhibit', 'Deeper reading');
  }

  openFor(exhibitId: string): void {
    this.exhibitId = exhibitId;
    this.open();
  }

  protected render(): void {
    const record = this.exhibitId ? EXHIBITS_BY_ID.get(this.exhibitId) : undefined;
    if (!record) {
      this.setContent(el('p', { text: 'That exhibit is not part of this collection.' }));
      return;
    }
    this.setHeading(record.title, record.copy.subtitle);
    const bookmarked = this.journal.bookmarks().some((entry) => entry.exhibitId === record.id);
    const actions = el('div', { class: 'exhibit-reading__actions' },
      this.guideTo && el('button', { type: 'button', class: 'panel__close', text: 'Guide me there', onclick: () => {
        this.close();
        this.guideTo?.(record.id);
      } }),
      el('a', { href: museumLink({ exhibit: record.id }), text: 'Open shareable exhibit page' }),
      el('button', {
        class: 'panel__close', type: 'button', text: bookmarked ? 'Remove bookmark' : 'Bookmark this exhibit',
        onclick: (event: Event) => {
          const on = this.journal.toggleBookmark(record.id);
          (event.currentTarget as HTMLButtonElement).textContent = on ? 'Remove bookmark' : 'Bookmark this exhibit';
        },
      }),
    );
    this.setContent(...exhibitReading(record, actions, {
      locate: this.locate,
      openExhibit: (id) => this.openFor(id),
    }));
  }
}
