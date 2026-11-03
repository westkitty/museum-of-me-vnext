import { expect, test } from '@playwright/test';

const views = [
  ['front-south', [0, 18, 140], [0, 8, 0]],
  ['east-lagoon', [140, 35, 30], [0, 10, 0]],
  ['west-woodland', [-140, 30, -20], [0, 10, 0]],
  ['high-topdown', [0, 220, 0.1], [0, 0, 0]],
  ['rear-north', [0, 25, -140], [0, 10, 0]],
] as const;

test('P3 compact exterior architecture renders from canonical cameras and remains traversable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /webgl|shader|gl error/i.test(message.text())) errors.push(message.text());
  });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  const state = await page.evaluate(async (cameraViews) => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    const shell = app.exteriorWorld.museumShell.group;
    const names: string[] = [];
    shell.traverse((node) => { if (node.name) names.push(node.name); });
    const renders = [];
    for (const [id, position, target] of cameraViews) {
      app.renderer.camera.position.set(position[0], position[1], position[2]);
      app.renderer.camera.lookAt(target[0], target[1], target[2]);
      app.renderer.camera.updateProjectionMatrix();
      app.renderer.render();
      renders.push({ id, calls: app.renderer.renderer.info.render.calls, triangles: app.renderer.renderer.info.render.triangles });
    }
    const traversal = [];
    for (const z of [164, 158, 150, 143, 132]) {
      app.player.teleport([0, 0, z]);
      for (let i = 0; i < 30; i++) app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      traversal.push({ z, y: app.player.position.y, grounded: app.player.grounded });
    }
    return { names, renders, traversal };
  }, views);

  expect(state.names).toContain('curved-roof-wing-west');
  expect(state.names).toContain('curved-roof-wing-east');
  expect(state.names).toContain('central-turquoise-dome-glazing');
  expect(state.names.filter((name) => name.startsWith('dome-gold-rib-'))).toHaveLength(16);
  expect(state.names).toContain('amber-window-ribbon-1');
  expect(state.names).toContain('facade-window-mullions-1');
  expect(state.names).toContain('south-ceremonial-window-bays');
  expect(state.names).toContain('south-ceremonial-window-sills');
  expect(state.names).toContain('south-rounded-glazed-portico');
  expect(state.names).toContain('raised-stone-terrace');
  expect(state.names).toContain('north-facade-pilasters');
  expect(state.names).toContain('north-facade-cornice');
  expect(state.renders).toHaveLength(5);
  for (const render of state.renders) {
    expect(render.calls).toBeGreaterThan(0);
    expect(render.triangles).toBeLessThan(600_000);
  }
  expect(state.traversal.every((step) => step.grounded && step.y >= -0.6)).toBe(true);
  expect(errors).toEqual([]);
});
