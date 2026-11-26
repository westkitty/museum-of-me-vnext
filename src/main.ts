import placementManifest from '../data/workshop-placements.json';
import { mountCinematicArrival } from './ui/CinematicArrival';
import './ui/cinematic-arrival.css';
import { App } from './app/App';
import './ui/reliquary-finish.css';
import { exhibitFromParameter } from './content/collectionLinks';
import { MuseumPlacements } from './workshop/MuseumPlacements';
import { AuthorableSceneRegistry } from './workshop/AuthorableSceneRegistry';

export function startMuseum(): void {
  const canvas = document.getElementById('museum-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');
  const a11yRoot = document.getElementById('a11y-root');

  if (!canvas || !uiRoot || !a11yRoot) {
    throw new Error('The museum could not find its mount points.');
  }

  const bootstrapStarted = performance.now();
  const app = new App({ canvas, uiRoot, a11yRoot });
  const coreBootMs = performance.now() - bootstrapStarted;
  const environmentBootMs = 0;
  const sceneRegistry = new AuthorableSceneRegistry([
    ...app.arrivalGarden.authorableSceneRoots(),
  ]);
  app.sceneRegistry = sceneRegistry;

  // Museum Workshop writes only this declarative placement source. The normal
  // runtime consumes it in every build; the development editor itself is loaded
  // separately and is stripped from production output.
  let source: unknown = placementManifest;
  if (import.meta.env.DEV) {
    const script = document.getElementById('museum-workshop-source');
    if (!script?.textContent || !/^[a-f0-9]{64}$/.test(script.dataset.sha256 ?? '')) {
      throw new Error('The local Workshop source snapshot is missing; refusing to load an unversioned editor.');
    }
    const bytes = Uint8Array.from(atob(script.textContent), (character) => character.charCodeAt(0));
    source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  }
  const placements = new MuseumPlacements(source, sceneRegistry);
  app.attachMuseumPlacements(placements.group);

  // Expose the constructed app before starting the continuous render loop. Browser
  // proofs can now observe and stop the real runtime at its first stable boundary.
  window.__museum = app;
  // The shared Three.js DevTools bridge discovers the active scene/renderer by
  // inspecting ordinary window properties. Keep its entry point development-only
  // and point it at the existing app; never create another renderer or loop.
  if (import.meta.env.DEV) {
    window.museumDevtools = app;
  }
  // Expose startup phase timings in opt-in QA only, never as inferred GPU time.
  if (new URLSearchParams(window.location.search).has('qa')) {
    console.info('[Museum boot]', JSON.stringify({
      coreMs: Math.round(coreBootMs),
      environmentMs: Math.round(environmentBootMs),
      finishingMs: Math.round(performance.now() - bootstrapStarted - coreBootMs - environmentBootMs),
      totalMs: Math.round(performance.now() - bootstrapStarted),
    }));
  }
  placements.bindInteractions(app.interaction, (message) => app.ui.hud.announce(message));
  // Meaningful Objects reach exhibits only through their existing visitor control path.
  placements.bindMeaningfulActions((installation, code) => app.sourceInstallations?.key(installation, code) ?? false);
  const syncBuilderPlacements = () => placements.syncWorld(
    app.museumWorld, app.exteriorWorld.collision, app.museum?.collision,
    app.exteriorWorld.root, app.museum?.root, app.camera.position,
  );
  // Establish the initial world before the first frame, including when a test or
  // embedding host pauses the application immediately after boot.
  syncBuilderPlacements();
  app.setWorkshopUpdate(syncBuilderPlacements);
  const guide = exhibitFromParameter(new URLSearchParams(window.location.search).get('guide'));
  if (guide) app.ui.guideToExhibit(guide.id);
  app.start();
  mountCinematicArrival(app);
  document.getElementById('museum-loading')?.remove();

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
        app.setWorkshopUpdate(() => {
          syncBuilderPlacements();
          workshop.update();
        });
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
}

// Expose for Playwright smoke tests and diagnostics. Workshop itself exists only
// in development builds with ?edit=1.
declare global {
  interface Window {
    __museum?: App;
    __museumWorkshop?: { dispose(): void };
    museumDevtools?: App;
  }
}
