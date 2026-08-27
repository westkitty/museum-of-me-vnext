import placementManifest from '../data/workshop-placements.json';
import { App } from './app/App';
import { MuseumPlacements } from './workshop/MuseumPlacements';
import { PersistentEnvironment } from './world/PersistentEnvironment';

function fail(message: string, detail?: unknown): never {
  console.error('[museum]', message, detail);
  const el = document.getElementById('ui-root');
  if (el) {
    el.innerHTML = `<div class="noscript"><h1>Museum of Me</h1><p>${message}</p></div>`;
  }
  throw new Error(message);
}

const canvas = document.getElementById('museum-canvas') as HTMLCanvasElement | null;
const uiRoot = document.getElementById('ui-root');
const a11yRoot = document.getElementById('a11y-root');

if (!canvas || !uiRoot || !a11yRoot) {
  fail('The museum could not find its mount points.');
}

let app: App;
let placements: MuseumPlacements;
try {
  app = new App({ canvas, uiRoot, a11yRoot });

  // All always-resident polish lives behind one measurable lifecycle boundary.
  // It shares the application ResourceScope and never owns collision, loops or
  // exhibit lifecycle resources.
  const environment = new PersistentEnvironment(app.scope).build();
  app.scene.add(environment);

  // Museum Workshop writes only this declarative placement source. The normal
  // runtime consumes it in every build; the development editor itself is loaded
  // separately and is stripped from production output.
  placements = new MuseumPlacements(placementManifest);
  app.scene.add(placements.group);
} catch (err) {
  fail(
    'This museum needs WebGL 2, which this browser did not provide. The full text of every exhibit is still available in the accessible contents.',
    err,
  );
}

// Expose the constructed app before starting the continuous render loop. Browser
// proofs can now observe and stop the real runtime at its first stable boundary.
window.__museum = app;
app.start();

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('edit') === '1') {
  let toggleWorkshop: (() => void) | null = null;
  app.ui.setBuildModeControl(() => {
    if (toggleWorkshop) toggleWorkshop();
    else app.ui.hud.announce('Museum Workshop is still loading.');
  });
  void import('./workshop/WorkshopConservationStudio')
    .then(({ Workshop }) => {
      const workshop = new Workshop(app, placements);
      toggleWorkshop = () => workshop.toggle();
      window.__museumWorkshop = workshop;
    })
    .catch((error) => {
      console.error('[Museum Workshop] failed to start', error);
      app.ui.hud.announce('Museum Workshop failed to start. See the developer console.');
    });
}

// Expose for Playwright smoke tests and diagnostics. Workshop itself exists only
// in development builds with ?edit=1.
declare global {
  interface Window {
    __museum?: App;
    __museumWorkshop?: { dispose(): void };
  }
}
