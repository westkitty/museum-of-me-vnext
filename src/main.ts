import placementManifest from '../data/workshop-placements.json';
import { mountCinematicArrival } from './ui/CinematicArrival';
import './ui/cinematic-arrival.css';
import { App } from './app/App';
import { MuseumPlacements } from './workshop/MuseumPlacements';
import { AuthorableSceneRegistry } from './workshop/AuthorableSceneRegistry';

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
let sceneRegistry: AuthorableSceneRegistry;
const bootstrapStarted = performance.now();
let coreBootMs = 0;
const environmentBootMs = 0;
try {
  app = new App({ canvas, uiRoot, a11yRoot });
  coreBootMs = performance.now() - bootstrapStarted;

  sceneRegistry = new AuthorableSceneRegistry([
    ...app.arrivalGarden.authorableSceneRoots(),
  ]);
  app.sceneRegistry = sceneRegistry;

  // Museum Workshop writes only this declarative placement source. The normal
  // runtime consumes it in every build; the development editor itself is loaded
  // separately and is stripped from production output.
  placements = new MuseumPlacements(placementManifest, sceneRegistry);
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
// Expose startup phase timings in opt-in QA only, never as inferred GPU time.
if (new URLSearchParams(window.location.search).has('qa')) {
  console.info('[Museum boot]', JSON.stringify({
    coreMs: Math.round(coreBootMs),
    environmentMs: Math.round(environmentBootMs),
    finishingMs: Math.round(performance.now() - bootstrapStarted - coreBootMs - environmentBootMs),
    totalMs: Math.round(performance.now() - bootstrapStarted),
  }));
}
app.start();
mountCinematicArrival(app);

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('edit') === '1') {
  let toggleWorkshop: (() => void) | null = null;
  app.ui.setBuildModeControl(() => {
    if (toggleWorkshop) toggleWorkshop();
    else app.ui.hud.announce('Museum Workshop is still loading.');
  });
  void import('./workshop/Workshop')
    .then(async ({ Workshop }) => {
      await app.ensureInteriorLoaded();
      const workshop = new Workshop(app, placements);
      toggleWorkshop = () => workshop.toggle();
      app.setWorkshopUpdate(() => workshop.update());
      window.__museumWorkshop = workshop;
    })
    .catch((error) => {
      console.error('[Museum Workshop] failed to start', error);
      app.ui.hud.announce('Museum Workshop failed to start. See the developer console.');
    });
}

if (import.meta.env.DEV) {
  const query = new URLSearchParams(window.location.search);
  if (query.get('edit') === '1' || query.get('devtools') === '1') {
    void import('./dev/FlightSkyControls')
      .then(({ FlightSkyControls }) => app.setDeveloperOverlay(new FlightSkyControls(app)))
      .catch((error) => {
        console.error('[Developer Flight/Sky] failed to start', error);
        app.ui.hud.announce('Developer Flight/Sky controls failed to start.');
      });
  }
}

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('choreo') === '1') {
  void import('./choreo/VisitorChoreographer')
    .then(({ VisitorChoreographer }) => app.setDevelopmentTool(new VisitorChoreographer(app)))
    .catch((error) => {
      console.error('[Visitor Choreographer] failed to start', error);
      app.ui.hud.announce('Visitor Choreographer failed to start. See the developer console.');
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
