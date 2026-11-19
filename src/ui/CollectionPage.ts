import { COLLECTION, exhibitsForWing, projectsForExhibit } from '../content/collection.generated';
import { exhibitFromParameter, museumLink } from '../content/collectionLinks';
import { SANCTUARY_DESCRIPTION, SANCTUARY_INSCRIPTION, SANCTUARY_TITLE } from '../content/sanctuaryCopy';
import { el } from './dom';
import { exhibitReading } from './ExhibitReading';
import './collection-page.css';

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
    root.append(el('article', {},
      el('h1', { text: record.title }),
      el('p', { class: 'collection-page__subtitle', text: record.copy.subtitle }),
      ...exhibitReading(record, el('p', { class: 'exhibit-reading__actions' },
        el('a', { href: museumLink({ guide: record.id }), text: 'Guide me there in 3D' }),
      )),
    ));
    return;
  }

  root.append(el('h1', { text: 'Museum of Me collection' }));
  if (exhibitParam !== null) root.append(el('p', { role: 'status', text: 'This exhibit link does not match the collection. Choose an exhibit below.' }));
  for (const wing of COLLECTION.wings) {
    root.append(el('section', {},
      el('h2', { text: wing.name }),
      el('p', { text: wing.blurb }),
      el('ul', { class: 'collection-page__index' }, ...exhibitsForWing(wing.id).map((exhibit) =>
        el('li', {},
          el('a', { href: museumLink({ exhibit: exhibit.id }), text: exhibit.title }),
          el('p', { text: exhibit.copy.plaque }),
          el('p', { class: 'collection-page__projects', text: projectsForExhibit(exhibit.id).map((project) => project.name).join(' · ') }),
        ),
      )),
    ));
  }
  root.append(el('section', {},
    el('h2', { text: SANCTUARY_TITLE }),
    el('p', { text: SANCTUARY_DESCRIPTION }),
    ...SANCTUARY_INSCRIPTION.map((line) => el('p', { text: line })),
  ));
}
