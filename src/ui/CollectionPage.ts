import { COLLECTION, exhibitsForWing, projectsForExhibit } from '../content/collection.generated';
import { exhibitFromParameter, museumLink } from '../content/collectionLinks';
import { SANCTUARY_DESCRIPTION, SANCTUARY_INSCRIPTION, SANCTUARY_TITLE } from '../content/sanctuaryCopy';
import { el } from './dom';
import { exhibitReading } from './ExhibitReading';
import './collection-page.css';
import { projectNameWithStage } from '../content/projectStage';
import { collectionSearch } from '../content/collectionSearch';
import { wingAnchorId } from '../content/readingRelations';

/** Exhibit ids whose room or projects match the query (the shared collection search). */
export function matchingExhibitIds(query: string): Set<string> | null {
  if (!query.trim()) return null;
  return new Set(collectionSearch(query).map((entry) => entry.exhibit.id));
}

export function showCollectionPage(exhibitParam: string | null, unavailable = false): void {
  const root = document.getElementById('a11y-root');
  if (!root) return;
  // Remove any partially constructed 3D interface when startup failed.
  document.getElementById('museum-loading')?.remove();
  document.getElementById('museum-canvas')?.remove();
  document.getElementById('ui-root')?.remove();
  root.className = 'collection-page';
  root.setAttribute('aria-label', 'Museum of Me collection');
  document.documentElement.classList.add('reading-mode');
  const record = exhibitFromParameter(exhibitParam);

  root.replaceChildren(
    el('nav', { 'aria-label': 'Museum' },
      el('a', { href: museumLink({ browse: true }), text: 'Browse the collection' }),
      el('a', { href: museumLink(), text: 'Visit in 3D' }),
    ),
  );
  if (unavailable) root.append(el('p', {
    role: 'status',
    text: 'The 3D museum could not start. You can explore the full collection here.',
  }));

  if (record) {
    document.title = `${record.title} · Museum of Me`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', record.copy.plaque);
    root.append(el('article', { 'aria-labelledby': 'collection-exhibit-title' },
      el('h1', { id: 'collection-exhibit-title', text: record.title }),
      el('p', { class: 'collection-page__subtitle', text: record.copy.subtitle }),
      ...exhibitReading(record, el('p', { class: 'exhibit-reading__actions' },
        el('a', { href: museumLink({ guide: record.id }), text: 'Guide me there in 3D' }),
      ), { updateHash: true }),
    ));
    scrollToHash(root);
    return;
  }

  root.append(el('h1', { text: 'Museum of Me collection' }));
  if (exhibitParam !== null) root.append(el('p', { role: 'status', text: 'This exhibit link does not match the collection. Choose an exhibit below.' }));

  const initialQuery = new URLSearchParams(window.location.search).get('q') ?? '';
  const count = el('p', { class: 'collection-page__count', role: 'status', 'aria-live': 'polite' });
  const input = el('input', {
    type: 'search', id: 'collection-find', value: initialQuery, autocomplete: 'off',
    placeholder: 'Room, project, capability or repository…',
  });
  const find = el('form', { class: 'collection-page__find', role: 'search', 'aria-label': 'Find in the collection',
    onsubmit: (event: Event) => event.preventDefault() },
  el('label', { for: 'collection-find', text: 'Find a room or project' }), input, count);

  root.append(
    find,
    el('nav', { class: 'collection-page__jump', 'aria-label': 'Wings' },
      el('ul', {},
        ...COLLECTION.wings.map((wing) => el('li', {}, el('a', { href: `#${wingAnchorId(wing.id)}`, text: wing.name }))),
        el('li', {}, el('a', { href: '#sanctuary', text: SANCTUARY_TITLE })),
      ),
    ),
  );

  const sections: { section: HTMLElement; items: { li: HTMLElement; id: string }[] }[] = [];
  for (const wing of COLLECTION.wings) {
    const items = exhibitsForWing(wing.id).map((exhibit) => ({
      id: exhibit.id,
      li: el('li', { id: `room-${exhibit.id}` },
        el('a', { href: museumLink({ exhibit: exhibit.id }), text: `${exhibit.title}` }),
        el('span', { class: 'collection-page__room-id', text: ` · ${exhibit.id}` }),
        el('p', { text: exhibit.copy.plaque }),
        el('p', { class: 'collection-page__projects', text: projectsForExhibit(exhibit.id).map(projectNameWithStage).join(' · ') }),
      ),
    }));
    const section = el('section', { id: wingAnchorId(wing.id), 'aria-labelledby': `${wingAnchorId(wing.id)}-title` },
      el('h2', { id: `${wingAnchorId(wing.id)}-title`, text: wing.name }),
      el('p', { text: `${wing.blurb} ${wing.level === 1 ? 'Upper floor.' : 'Ground floor.'}` }),
      el('ul', { class: 'collection-page__index' }, ...items.map((item) => item.li)),
      el('p', { class: 'collection-page__top' }, el('a', { href: '#collection-find', text: 'Back to find and wings' })),
    );
    sections.push({ section, items });
    root.append(section);
  }
  const sanctuary = el('section', { id: 'sanctuary', 'aria-labelledby': 'sanctuary-title' },
    el('h2', { id: 'sanctuary-title', text: SANCTUARY_TITLE }),
    el('p', { text: SANCTUARY_DESCRIPTION }),
    ...SANCTUARY_INSCRIPTION.map((line) => el('p', { text: line })),
  );
  root.append(sanctuary);

  const apply = (query: string): void => {
    const matches = matchingExhibitIds(query);
    let shown = 0;
    for (const { section, items } of sections) {
      let inWing = 0;
      for (const { li, id } of items) {
        const visible = !matches || matches.has(id);
        li.hidden = !visible;
        if (visible) inWing++;
      }
      section.hidden = inWing === 0;
      shown += inWing;
    }
    sanctuary.hidden = matches !== null;
    count.textContent = matches
      ? shown === 0 ? `No rooms match “${query.trim()}”.` : `${shown} of ${COLLECTION.exhibits.length} rooms match “${query.trim()}”.`
      : `${COLLECTION.exhibits.length} rooms in ${COLLECTION.wings.length} wings.`;
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    history.replaceState(null, '', url.href);
  };
  input.addEventListener('input', () => apply(input.value));
  apply(initialQuery);
  scrollToHash(root);
}

/**
 * Honour #anchors on first load: the page is built after the browser looked
 * for them. Focus moves to the target's heading so keyboard and screen-reader
 * visitors start reading there too; the browser's own load-time fragment
 * handling resets focus, so the move waits for `load` when the page is still
 * loading.
 */
function scrollToHash(root: HTMLElement): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const target = root.ownerDocument.getElementById(id);
  if (!target) return;
  const go = () => {
    target.scrollIntoView({ block: 'start' });
    const heading = target.matches('h1, h2, h3') ? target : target.querySelector<HTMLElement>('h2, h3');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  };
  go();
  if (document.readyState !== 'complete') window.addEventListener('load', go, { once: true });
}
