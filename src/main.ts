import { App } from './app/App';
import { EnvironmentDressing } from './world/EnvironmentDressing';
import { ExhibitThresholds } from './world/ExhibitThresholds';

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
try {
  app = new App({ canvas, uiRoot, a11yRoot });

  // Furnishing is deliberately layered on top of the already validated
  // architecture. It shares the application ResourceScope, so all generated
  // geometry and materials are disposed with the rest of the museum.
  const environment = new EnvironmentDressing(app.scope).build();
  app.scene.add(environment);

  // Exhibit thresholds inherit their colour signatures from the containing
  // wing rather than becoming thirty-five unrelated palettes.
  const thresholds = new ExhibitThresholds(app.scope).build();
  app.scene.add(thresholds);
} catch (err) {
  fail(
    'This museum needs WebGL 2, which this browser did not provide. The full text of every exhibit is still available in the accessible contents.',
    err,
  );
}

app.start();

// Expose for Playwright smoke tests and the diagnostics overlay. Read-only in practice.
declare global {
  interface Window {
    __museum?: App;
  }
}
window.__museum = app;
