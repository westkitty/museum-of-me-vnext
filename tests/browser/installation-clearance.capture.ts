import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as THREE from 'three';

test('capture inspection evidence and verify clearance for all 13 wing source installations', async ({ page }) => {
  test.setTimeout(300_000);

  const outDir = 'docs/evidence/installation-clearance-pass6-20261110';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await expect(page.locator('#museum-canvas')).toBeVisible();

  await page.evaluate(async () => {
    const app = window.__museum!;
    app.stop();
    await app.ensureInteriorLoaded();
    app.exteriorWorld.root.visible = false;
    app.interiorWorld!.root.visible = true;
    app.interiorWorld!.setActive(true);
    app.worldDirector.activeWorld = 'interior';

    // Hide UI/diagnostics overlay for clear screenshots
    const style = document.createElement('style');
    style.innerHTML = '.diag, .hud, .ui-root, #a11y-root { display: none !important; }';
    document.head.appendChild(style);
  });

  const installations = [
    { id: 'starsilk-atlas', host: 'E01', wing: 'north' },
    { id: 'orbital-tomb', host: 'E03', wing: 'north' },
    { id: 'drakken-sandbox', host: 'E07', wing: 'north' },
    { id: 'heliocide', host: 'E08', wing: 'north' },
    { id: 'vibe-nexus', host: 'E14', wing: 'media' },
    { id: 'dexdictate', host: 'E17', wing: 'east' },
    { id: 'tablet-link', host: 'E18', wing: 'east' },
    { id: 'dexvault', host: 'E20', wing: 'east' },
    { id: 'osint-box', host: 'E23', wing: 'east' },
    { id: 'westcat-east', host: 'E26', wing: 'south' },
    { id: 'westcat-familiar', host: 'E26', wing: 'south' },
    { id: 'parable', host: 'E31', wing: 'south' },
    { id: 'smores-katamari', host: 'E32', wing: 'south' },
  ];

  const ACTION_KEYS: Record<string, string> = {
    'starsilk-atlas': 'ArrowRight',
    'orbital-tomb': 'ArrowRight',
    'drakken-sandbox': 'Space',
    'heliocide': 'KeyB',
    'vibe-nexus': 'Space',
    'dexdictate': 'Space',
    'tablet-link': 'Space',
    'dexvault': 'Space',
    'osint-box': 'Space',
    'westcat-east': 'Space',
    'westcat-familiar': 'Space',
    'parable': 'KeyC',
    'smores-katamari': 'KeyW',
  };

  const surveyResults: Record<string, unknown>[] = [];

  for (const { id, host: hostId, wing } of installations) {
    const actionKey = ACTION_KEYS[id] ?? 'Space';
    // 1. Prepare bay and exhibit
    const result = await page.evaluate(async ({ id, hostId, wing }) => {
      const app = window.__museum!;
      const host = app.interiorWorld!.streaming.hosts.get(hostId);
      if (!host) throw new Error(`Host not found: ${hostId}`);

      if (host.currentState === 'unloaded') await host.preload();
      if (host.currentState === 'loaded') host.mount();
      if (host.currentState === 'mounted') host.activate(0);

      const runtime = app.sourceInstallations!.get(id);
      if (!runtime) throw new Error(`Installation runtime not found: ${id}`);
      const p = runtime.placement;

      const mount = host.group.parent;
      if (!mount) throw new Error(`Mount not found for ${hostId}`);

      // Stand in doorway looking into the bay at the installation corner
      // Doorway is at p.doorway if available, or compute from mount
      const theta = mount.rotation.y;
      const anchorX = mount.position.x;
      const anchorY = mount.position.y;
      const anchorZ = mount.position.z;

      // Distance to plinth
      const distToPlinth = Math.hypot(p.position[0] - anchorX, p.position[2] - anchorZ);

      // Entrance view camera: 6.5m in front of anchor (+Z mount space), aimed at installation
      const entranceCam = [
        anchorX + 6.5 * Math.sin(theta),
        anchorY + 1.7,
        anchorZ + 6.5 * Math.cos(theta),
      ] as [number, number, number];

      // Aim at installation center
      const instTarget = [p.position[0], p.position[1] + 1.2, p.position[2]] as [number, number, number];

      // Set up entrance view
      app.player.teleport(entranceCam);
      app.camera.position.set(entranceCam[0], entranceCam[1], entranceCam[2]);
      app.camera.lookAt(instTarget[0], instTarget[1], instTarget[2]);
      app.atmosphere.update(wing as 'north' | 'west' | 'east' | 'south' | 'media' | 'infra' | 'rotunda', 1 / 60, true);
      app.renderer.render();

      // Check mesh presence
      let meshCount = 0;
      runtime.group.traverse((n: THREE.Object3D) => { if ((n as THREE.Mesh).isMesh) meshCount += 1; });

      return {
        id,
        hostId,
        wing,
        title: runtime.spec.title,
        pos: [Number(p.position[0].toFixed(2)), Number(p.position[1].toFixed(2)), Number(p.position[2].toFixed(2))],
        lectern: [Number(p.lectern[0].toFixed(2)), Number(p.lectern[1].toFixed(2)), Number(p.lectern[2].toFixed(2))],
        interactionPoint: [Number(p.interactionPoint[0].toFixed(2)), Number(p.interactionPoint[1].toFixed(2)), Number(p.interactionPoint[2].toFixed(2))],
        distToPlinth: Number(distToPlinth.toFixed(2)),
        meshCount,
      };
    }, { id, hostId, wing });

    // Capture entrance view screenshot
    await page.screenshot({ path: `${outDir}/${id}-entrance.png` });

    // 2. Set up interaction view
    const interactionResult = await page.evaluate(async ({ id, wing, actionKey }) => {
      const app = window.__museum!;
      const runtime = app.sourceInstallations!.get(id)!;
      const p = runtime.placement;

      // Stand at interaction point, look at lectern / installation
      const eye = [p.interactionPoint[0], p.interactionPoint[1] + 1.7, p.interactionPoint[2]] as [number, number, number];
      const target = [p.lectern[0], p.lectern[1] + 1.1, p.lectern[2]] as [number, number, number];

      app.player.teleport([p.interactionPoint[0], p.interactionPoint[1], p.interactionPoint[2]]);
      const dx = target[0] - eye[0];
      const dz = target[2] - eye[2];
      app.player.yaw = Math.atan2(-dx, -dz);
      app.player.pitch = Math.atan2(target[1] - eye[1], Math.hypot(dx, dz));
      app.player.applyToCamera(app.camera, 1);
      app.camera.updateMatrixWorld(true);

      app.worldDirector.update(app.player.position);
      app.interaction.update(app.camera);

      const focus = app.interaction.currentFocus;
      const focusAcquired = Boolean(focus && focus.exhibitId === `installation:${id}`);
      const focusLabel = focus ? focus.label : null;

      // Invoke interaction
      app.interaction.activate();
      const engaged = app.sourceInstallations!.activeId === id;

      // Exercise primary action control
      let stateChanged = false;
      const beforeState = JSON.stringify(runtime.state);
      const keyToDispatch = actionKey ?? (runtime.spec.controls?.[0]?.[1] ? String(runtime.spec.controls[0][1]) : null);
      if (keyToDispatch) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: keyToDispatch, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: keyToDispatch, bubbles: true }));
        const afterState = JSON.stringify(runtime.state);
        stateChanged = beforeState !== afterState;
      }

      app.atmosphere.update(wing as 'north' | 'west' | 'east' | 'south' | 'media' | 'infra' | 'rotunda', 1 / 60, true);
      app.renderer.render();

      return {
        focusAcquired,
        focusLabel,
        engaged,
        stateChanged,
        statusLine: app.sourceInstallations!.status(id),
      };
    }, { id, wing, actionKey });

    // Capture interaction view screenshot
    await page.screenshot({ path: `${outDir}/${id}-interaction.png` });

    surveyResults.push({
      ...result,
      ...interactionResult,
    });
  }

  // Write survey results to disk
  writeFileSync(
    join(outDir, 'survey-results.json'),
    JSON.stringify(surveyResults, null, 2),
    'utf-8',
  );

  console.log('Survey Results:', JSON.stringify(surveyResults, null, 2));

  // Assertions for all 13 installations
  for (const item of surveyResults) {
    expect(item.meshCount, `${item.id} mesh count`).toBeGreaterThan(3);
    expect(item.distToPlinth, `${item.id} plinth distance`).toBeGreaterThan(4.0);
    expect(item.focusAcquired, `${item.id} focus acquired`).toBe(true);
    expect(item.engaged, `${item.id} engaged`).toBe(true);
    expect(item.stateChanged, `${item.id} state changed`).toBe(true);
  }
});
