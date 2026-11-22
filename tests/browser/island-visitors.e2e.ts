import { expect, test } from '@playwright/test';
import { ISLAND_VISITORS } from '../../src/world/exterior/IslandVisitors';
import { HOT_DOG_MAN_BONE_NAMES } from '../../src/world/exterior/HotDogManPose';
import {
  HOT_DOG_STAND_ID, HOT_DOG_STAND_OPERATOR_SPOT, HOT_DOG_STAND_VISITOR_SPOT,
} from '../../src/world/exterior/rooftopLayout';
import type { Vec3 } from '../../src/world/layout';

test.use({ viewport: { width: 960, height: 540 } });

test('ISLAND-04 keeps the exterior cast local, deferred, visible and interactive', async ({ page }, info) => {
  test.setTimeout(160_000);
  const npcRequests: URL[] = [];
  const failures: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/(?:hotdog-man|island-[^/]+)(?:-[\w-]+)?\.glb$/.test(url.pathname)) npcRequests.push(url);
  });
  page.on('pageerror', (error) => failures.push(error.message));

  await page.goto('/?qa=1', { waitUntil: 'load' });
  await page.waitForFunction(() => (window.__museum?.renderer.renderer.info.render.frame ?? 0) > 2,
    null, { timeout: 40_000 });
  const cold = await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.setQuality('low');
    const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return {
      interiorConstructed: app.interiorConstructed,
      transferred: entries.reduce((total, entry) => total + (entry as PerformanceResourceTiming).transferSize, 0),
    };
  });
  expect(cold.interiorConstructed).toBe(false);
  expect(cold.transferred).toBeGreaterThan(0);
  expect(cold.transferred).toBeLessThan(20 * 1024 * 1024);
  await info.attach('cold-start-transfer', { body: JSON.stringify(cold), contentType: 'application/json' });
  expect(npcRequests).toEqual([]);
  await page.addStyleTag({ content: '#ui-root, #a11y-root, .cinematic-arrival { display: none !important; }' });

  const renderView = async (eye: Vec3, target: Vec3, dt = 0) => {
    await page.evaluate(({ eye, target, dt }) => {
      const app = window.__museum!;
      app.renderer.camera.position.set(...eye);
      app.renderer.camera.lookAt(...target);
      app.sky.follow(app.renderer.camera);
      app.lighting.update(eye);
      app.exteriorWorld.variableUpdate(dt, eye, 'plaza', false);
      app.renderer.render();
    }, { eye, target, dt });
  };
  const capture = (name: string) => page.locator('#museum-canvas').screenshot({
    path: info.outputPath(`${name}.png`),
    timeout: 30_000,
  });

  const [sx, sy, sz] = HOT_DOG_STAND_OPERATOR_SPOT;
  const standEye: Vec3 = [HOT_DOG_STAND_VISITOR_SPOT[0], sy + 1.64, sz];
  const towardChef: Vec3 = [sx, sy + 1.47, sz];
  await page.evaluate((eye) => window.__museum!.exteriorWorld.variableUpdate(0, eye, 'plaza'), standEye);
  await page.waitForFunction(() => {
    const actor = window.__museum!.exteriorWorld.rooftop.hotDogMan;
    if (actor.state === 'failed') throw actor.loadError;
    return actor.state === 'ready';
  }, null, { timeout: 45_000, polling: 150 });

  const pose = () => page.evaluate(({ chest, hand, foot, toe }) => {
    const app = window.__museum!;
    const actor = app.exteriorWorld.rooftop.hotDogMan;
    const mesh = actor.group.getObjectByName('hot-dog-man-model')!;
    const find = (name: string) => {
      let result: typeof mesh | undefined;
      mesh.traverse((node) => { if (node.userData.name === name) result = node; });
      if (!result) throw new Error(`Missing bone ${name}`);
      return result;
    };
    const p = app.renderer.camera.position.clone();
    const toeForward = find(toe)!.getWorldPosition(p.clone()).sub(find(foot)!.getWorldPosition(p.clone())).normalize();
    return {
      chest: find(chest)!.quaternion.toArray(),
      hand: find(hand)!.getWorldPosition(p.clone()).toArray(),
      facesCounter: toeForward.x,
      serving: actor.serving,
    };
  }, {
    chest: HOT_DOG_MAN_BONE_NAMES.chest, hand: HOT_DOG_MAN_BONE_NAMES.rightHand,
    foot: HOT_DOG_MAN_BONE_NAMES.rightFoot, toe: HOT_DOG_MAN_BONE_NAMES.rightToe,
  });

  await renderView(standEye, towardChef, 0.1);
  const idle = await pose();
  expect(idle.facesCounter).toBeLessThan(-0.7);
  await renderView(standEye, towardChef, 0.1);
  expect((await pose()).chest).not.toEqual(idle.chest);
  await capture('hot-dog-man-idle');
  await renderView([2.6, sy + 1.68, sz - 0.4], [sx, sy + 1.55, sz]);
  await capture('hot-dog-stand');
  await renderView(standEye, towardChef);

  const focus = await page.evaluate(() => {
    const app = window.__museum!;
    app.renderer.camera.updateMatrixWorld();
    app.interaction.update(app.renderer.camera, 0.1);
    const focus = app.interaction.currentFocus;
    const activated = app.interaction.activate();
    return { focus, activated, subtitle: document.querySelector('.hud__subtitle')?.textContent };
  });
  expect(focus.focus?.exhibitId).toBe(HOT_DOG_STAND_ID);
  expect(focus.activated).toBe(true);
  expect(focus.subtitle).toContain('Hot Dog Man hands a hot dog');
  for (let i = 0; i < 8; i++) {
    await page.evaluate((eye) => window.__museum!.exteriorWorld.variableUpdate(0.1, eye, 'plaza', false), standEye);
  }
  await renderView(standEye, towardChef);
  const served = await pose();
  expect(served.serving).toBe(1);
  expect(served.hand[0]).toBeLessThan(idle.hand[0] - 0.2);
  await capture('hot-dog-man-serving');

  await page.evaluate((eye) => window.__museum!.exteriorWorld.variableUpdate(0.1, eye, 'plaza', true), standEye);
  const held = await pose();
  await page.evaluate((eye) => window.__museum!.exteriorWorld.variableUpdate(0.1, eye, 'plaza', true), standEye);
  expect(await pose()).toEqual(held);

  for (const visitor of ISLAND_VISITORS) {
    const { spot: [x, y, z], facing, height, id } = visitor;
    // Frame the café patron from the aisle, clear of the nearby table and chairs.
    const viewAngle = id === 'island-coffee' ? facing - 0.95 : facing;
    const eye: Vec3 = [x + Math.sin(viewAngle) * 3.4, y + 1.6, z + Math.cos(viewAngle) * 3.4];
    const target: Vec3 = [x, y + height / 2, z];
    await page.evaluate((eye) => window.__museum!.exteriorWorld.variableUpdate(0, eye, 'plaza'), eye);
    await page.waitForFunction((id) => Boolean(window.__museum!.exteriorWorld.islandVisitors.group
      .getObjectByName(id)), id, { timeout: 25_000, polling: 150 });
    await renderView(eye, target);
    await capture(id);
  }
  expect(npcRequests.every((url) => url.origin === new URL(page.url()).origin)).toBe(true);
  for (const { id } of ISLAND_VISITORS) expect(npcRequests.some((url) => url.pathname.includes(id))).toBe(true);
  expect(npcRequests.filter((url) => url.pathname.includes('hotdog-man'))).toHaveLength(1);

  await renderView([0, 2, 195], [0, 2, 128]);
  expect(await page.evaluate(() => window.__museum!.exteriorWorld.islandVisitors.group.children.length)).toBe(0);
  expect(failures).toEqual([]);
});
