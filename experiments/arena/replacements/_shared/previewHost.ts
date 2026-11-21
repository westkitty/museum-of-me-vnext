import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ExhibitHost } from '../../../../src/exhibits/ExhibitHost';
import { createExhibit, definitionFor } from '../../../../src/exhibits/registry';
import { installExhibits } from '../../../../src/exhibits';
import { resolveExhibitLabel, type ExhibitControl, type ExhibitDefinition, type ExhibitModule } from '../../../../src/exhibits/contract';
import { InteractionManager } from '../../../../src/interaction/InteractionManager';
import { AssetManager } from '../../../../src/assets/AssetManager';
import { EXHIBITS_BY_ID } from '../../../../src/content/collection.generated';
import { PLACEMENT_BY_EXHIBIT } from '../../../../src/world/layout';
import type { ResourceScope } from '../../../../src/assets/ResourceScope';

export type CandidateModuleExports = {
  readonly createCandidate: (def: ExhibitDefinition) => ExhibitModule;
};

const CANDIDATE_LOADERS = import.meta.glob<CandidateModuleExports>('../E*/index.ts');

export interface PreviewSnapshot {
  readonly slot: string;
  readonly mode: 'candidate' | 'incumbent';
  readonly ready: boolean;
  readonly heading: string;
  readonly plaque: string;
  readonly state: string;
  readonly body: readonly string[];
  readonly controls: readonly { label: string; description: string }[];
  readonly announcements: readonly string[];
  readonly resources: number;
  readonly lastLeakCount: number;
  readonly meshes: number;
  readonly triangles: number;
  readonly drawCalls: number;
  readonly reducedMotion: boolean;
  readonly detailScale: number;
  readonly plinthIntersections: number;
  readonly error: string | null;
}

declare global {
  interface Window {
    __ARENA_PREVIEW__?: {
      getSnapshot(): PreviewSnapshot;
      activateControl(index: number): void;
      reset(): void;
      remountCycle(): Promise<{ leakCount: number; resourceCount: number }>;
      setReducedMotion(value: boolean): Promise<void>;
      setDetailScale(value: number): Promise<void>;
      setCameraPreset(preset: 'front' | 'overview' | 'side'): void;
      destroy(): void;
    };
  }
}

const PLINTH_BOX = new THREE.Box3(
  new THREE.Vector3(-1.3, 0, -1.3),
  new THREE.Vector3(1.3, 0.9, 1.3),
);

function countPlinthHits(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const groupInv = root.matrixWorld.clone().invert();
  let hits = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const m2g = mesh.matrixWorld.clone().premultiply(groupInv);
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const im = mesh as THREE.InstancedMesh;
      im.computeBoundingBox();
      if (im.boundingBox && im.boundingBox.clone().applyMatrix4(m2g).intersectsBox(PLINTH_BOX)) hits++;
      return;
    }
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox && mesh.geometry.boundingBox.clone().applyMatrix4(m2g).intersectsBox(PLINTH_BOX)) {
      hits++;
    }
  });
  return hits;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function bootArenaPreview(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const slot = (params.get('slot') || 'E30').toUpperCase();
  const mode: 'candidate' | 'incumbent' = params.get('mode') === 'incumbent' ? 'incumbent' : 'candidate';
  let reducedMotion = params.get('reducedMotion') === '1';
  let detailScale = params.get('detail') === 'low' ? 0.5 : 1;

  const viewportEl = document.getElementById('viewport') as HTMLElement;
  const hudEl = document.getElementById('hud') as HTMLElement;
  const liveEl = document.getElementById('live-region') as HTMLElement;

  const placement = PLACEMENT_BY_EXHIBIT.get(slot);
  const record = EXHIBITS_BY_ID.get(slot);
  if (!placement || !record) {
    hudEl.innerHTML = `<div class="error">Unknown exhibit slot "${escapeHtml(slot)}".</div>`;
    return;
  }

  // Build isolated bay room matching the museum bay half-extents
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12151c);
  scene.fog = new THREE.Fog(0x12151c, 18, 42);

  const camera = new THREE.PerspectiveCamera(54, viewportEl.clientWidth / Math.max(1, viewportEl.clientHeight), 0.1, 100);
  camera.position.set(0, 2.3, 4.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewportEl.clientWidth, Math.max(1, viewportEl.clientHeight));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  viewportEl.appendChild(renderer.domElement);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.target.set(0, 1.35, -3.2);
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.minDistance = 1.5;
  orbit.maxDistance = 16;

  const bayW = placement.bounds.h[0] * 2;
  const bayH = placement.bounds.h[1] * 2;
  const bayD = placement.bounds.h[2] * 2;

  const bayRoom = new THREE.Group();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.92, metalness: 0.05 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x181c23, roughness: 0.9, metalness: 0.05 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(bayW, bayD), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0, -2.0);
  bayRoom.add(floorMesh);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(bayW, bayH), wallMat);
  backWall.position.set(0, bayH / 2, -2.0 - bayD / 2);
  bayRoom.add(backWall);

  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(bayD, bayH), wallMat);
    sideWall.position.set(side * (bayW / 2), bayH / 2, -2.0);
    sideWall.rotation.y = -side * (Math.PI / 2);
    bayRoom.add(sideWall);
  }

  // Reference marker for the museum's 2.6x0.9x2.6 center plinth footprint (wireframe only)
  const plinthWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, 0.9, 2.6)),
    new THREE.LineBasicMaterial({ color: 0x4b5568, transparent: true, opacity: 0.35 }),
  );
  plinthWire.position.set(0, 0.45, 0);
  bayRoom.add(plinthWire);

  // Lighting matching warm interior gallery fill + crisp key
  const hemi = new THREE.HemisphereLight(0xcdd9f0, 0x2a241e, 1.15);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.75);
  key.position.set(4, 7.5, 5);
  const fill = new THREE.DirectionalLight(0x88aadd, 0.65);
  fill.position.set(-5, 4.5, -2);
  bayRoom.add(hemi, key, fill);
  scene.add(bayRoom);

  const interaction = new InteractionManager();
  const assets = new AssetManager();
  const controls: ExhibitControl[] = [];
  const announcements: string[] = [];
  let host: ExhibitHost | null = null;
  let loadError: string | null = null;
  let showDeepInfo = false;
  let destroyed = false;
  let rafId = 0;

  async function loadModule(): Promise<ExhibitModule> {
    if (mode === 'incumbent') {
      installExhibits();
      const inc = createExhibit(slot);
      if (!inc) throw new Error(`Incumbent exhibit "${slot}" not found`);
      return inc;
    }
    const matchingKey = Object.keys(CANDIDATE_LOADERS).find((k) => k.startsWith(`../${slot}-`));
    if (!matchingKey) {
      throw new Error(`No candidate found for slot "${slot}". Available: ${Object.keys(CANDIDATE_LOADERS).join(', ') || 'none'}`);
    }
    const mod = await CANDIDATE_LOADERS[matchingKey]();
    if (typeof mod.createCandidate !== 'function') {
      throw new Error(`Candidate module "${matchingKey}" does not export createCandidate(def)`);
    }
    return mod.createCandidate(definitionFor(slot));
  }

  async function mountExhibit(): Promise<void> {
    controls.length = 0;
    interaction.dispose();
    if (host) {
      scene.remove(host.group);
      host.dispose();
      host = null;
    }
    const module = await loadModule();
    host = new ExhibitHost(module, record!, {
      addControl: (id, c) => {
        controls.push(c);
        return interaction.register(id, c);
      },
      announce: (_id, msg) => {
        announcements.push(msg);
        if (announcements.length > 16) announcements.shift();
        liveEl.textContent = msg;
        renderHud();
      },
      reducedMotion: () => reducedMotion,
      detailScale: () => detailScale,
      loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
        (await assets.load(assetId, scope, { detail })).object,
    });
    scene.add(host.group);
    await host.preload();
    host.mount();
    host.activate(0);
    renderHud();
  }

  function setCameraPreset(preset: 'front' | 'overview' | 'side'): void {
    if (preset === 'front') {
      camera.position.set(0, 2.25, 4.4);
      orbit.target.set(0, 1.35, -3.2);
    } else if (preset === 'overview') {
      camera.position.set(4.6, 5.2, 4.8);
      orbit.target.set(0, 1.1, -3.4);
    } else {
      camera.position.set(-5.2, 2.4, -0.6);
      orbit.target.set(0, 1.3, -3.8);
    }
    orbit.update();
  }

  function computeSnapshot(): PreviewSnapshot {
    let meshes = 0;
    let triangles = 0;
    let plinthIntersections = 0;
    if (host) {
      host.group.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        const g = m.geometry;
        if (g.index) triangles += g.index.count / 3;
        else if (g.attributes?.position) triangles += g.attributes.position.count / 3;
      });
      plinthIntersections = countPlinthHits(host.group);
    }
    const accessible = host?.module.getAccessibleContent();
    return {
      slot,
      mode,
      ready: Boolean(host && host.currentState === 'active' && !loadError),
      heading: accessible?.heading ?? `${slot} — ${record!.title}`,
      plaque: accessible?.plaque ?? '',
      state: accessible?.state ?? 'Not mounted',
      body: accessible?.body ?? [],
      controls: controls.map((c) => ({
        label: resolveExhibitLabel(c.label),
        description: c.description ?? '',
      })),
      announcements: [...announcements],
      resources: host?.resourceCount ?? 0,
      lastLeakCount: host?.lastLeakCount ?? 0,
      meshes,
      triangles: Math.round(triangles),
      drawCalls: renderer.info.render.calls,
      reducedMotion,
      detailScale,
      plinthIntersections,
      error: loadError,
    };
  }

  function activateControl(index: number): void {
    const c = controls[index];
    if (!c) return;
    c.activate();
    if (host) host.update(1 / 60, [camera.position.x, camera.position.y, camera.position.z], performance.now() / 1000);
    renderHud();
  }

  function resetExhibit(): void {
    if (!host) return;
    host.reset();
    host.update(1 / 60, [camera.position.x, camera.position.y, camera.position.z], performance.now() / 1000);
    announcements.push('Exhibit reset to initial state.');
    liveEl.textContent = 'Exhibit reset to initial state.';
    renderHud();
  }

  function renderHud(): void {
    const snap = computeSnapshot();
    const controlButtons = snap.controls
      .map(
        (c, idx) => `
          <button type="button" class="ctrl-btn" data-ctrl-idx="${idx}" title="${escapeHtml(c.description)}">
            <span class="key-badge">${idx + 1}</span>
            <span>${escapeHtml(c.label)}</span>
          </button>`,
      )
      .join('');

    const recentAnnouncements = snap.announcements.slice(-3).reverse()
      .map((a) => `<li>${escapeHtml(a)}</li>`)
      .join('');

    const deepPanel = showDeepInfo
      ? `<div class="deep-panel" role="region" aria-label="Exhibit Interpretation">
          <p><strong>Plaque:</strong> ${escapeHtml(snap.plaque)}</p>
          ${snap.body.map((b) => `<p>${escapeHtml(b)}</p>`).join('')}
        </div>`
      : '';

    hudEl.innerHTML = `
      <div class="hud-header">
        <div>
          <span class="slot-pill">${escapeHtml(snap.slot)} · ${escapeHtml(snap.mode.toUpperCase())}</span>
          <h1>${escapeHtml(snap.heading)}</h1>
        </div>
        <div class="header-actions">
          <button type="button" id="btn-mode">${mode === 'candidate' ? 'Compare Incumbent' : 'View Candidate'}</button>
          <button type="button" id="btn-info">${showDeepInfo ? 'Hide Info (I)' : 'Lectern / Info (I)'}</button>
        </div>
      </div>
      ${snap.error ? `<div class="error" role="alert">${escapeHtml(snap.error)}</div>` : ''}
      <div class="state-box" role="status">
        <strong>Current State:</strong> ${escapeHtml(snap.state)}
      </div>
      <div class="controls-grid" role="group" aria-label="Exhibit Controls">
        ${controlButtons || '<span class="muted">No controls registered</span>'}
      </div>
      <div class="toolbar">
        <button type="button" id="btn-reset">Reset (R)</button>
        <button type="button" id="btn-motion" aria-pressed="${reducedMotion}">Reduced Motion: ${reducedMotion ? 'ON' : 'OFF'}</button>
        <button type="button" id="btn-detail" aria-pressed="${detailScale < 1}">Detail: ${detailScale < 1 ? 'LOW (0.5)' : 'HIGH (1.0)'}</button>
        <button type="button" data-cam="front">Cam: Front</button>
        <button type="button" data-cam="overview">Cam: Overview</button>
        <button type="button" data-cam="side">Cam: Side</button>
      </div>
      <div class="metrics">
        <span>Resources: <strong id="m-res">${snap.resources}</strong></span>
        <span>Meshes: <strong>${snap.meshes}</strong></span>
        <span>Tris: <strong>${snap.triangles}</strong></span>
        <span>Plinth hits: <strong>${snap.plinthIntersections}</strong></span>
        <span>Last unmount leak: <strong>${snap.lastLeakCount}</strong></span>
      </div>
      ${deepPanel}
      ${recentAnnouncements ? `<ul class="log" aria-label="Announcements">${recentAnnouncements}</ul>` : ''}
    `;

    hudEl.querySelectorAll<HTMLButtonElement>('[data-ctrl-idx]').forEach((btn) => {
      btn.addEventListener('click', () => activateControl(Number(btn.dataset.ctrlIdx)));
    });
    hudEl.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => setCameraPreset(btn.dataset.cam as 'front' | 'overview' | 'side'));
    });
    document.getElementById('btn-reset')?.addEventListener('click', resetExhibit);
    document.getElementById('btn-info')?.addEventListener('click', () => {
      showDeepInfo = !showDeepInfo;
      renderHud();
    });
    document.getElementById('btn-mode')?.addEventListener('click', () => {
      const next = new URLSearchParams(window.location.search);
      next.set('slot', slot);
      if (mode === 'candidate') next.set('mode', 'incumbent');
      else next.delete('mode');
      window.location.search = next.toString();
    });
    document.getElementById('btn-motion')?.addEventListener('click', async () => {
      reducedMotion = !reducedMotion;
      await mountExhibit();
    });
    document.getElementById('btn-detail')?.addEventListener('click', async () => {
      detailScale = detailScale < 1 ? 1 : 0.5;
      await mountExhibit();
    });
  }

  // 3D viewport raycast clicking on controls
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  renderer.domElement.addEventListener('pointerdown', (ev) => {
    downX = ev.clientX;
    downY = ev.clientY;
  });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    for (let i = 0; i < controls.length; i++) {
      const hits = raycaster.intersectObject(controls[i].object, true);
      if (hits.length > 0) {
        activateControl(i);
        return;
      }
    }
  });

  // Keyboard shortcuts
  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
    if (ev.key >= '1' && ev.key <= '9') {
      const idx = Number(ev.key) - 1;
      if (idx < controls.length) {
        ev.preventDefault();
        activateControl(idx);
      }
    } else if (ev.key === 'r' || ev.key === 'R') {
      ev.preventDefault();
      resetExhibit();
    } else if (ev.key === 'i' || ev.key === 'I') {
      ev.preventDefault();
      showDeepInfo = !showDeepInfo;
      renderHud();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const onResize = (): void => {
    const w = viewportEl.clientWidth;
    const h = Math.max(1, viewportEl.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  try {
    await mountExhibit();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    renderHud();
  }

  let lastTime = performance.now();
  const tick = (now: number): void => {
    if (destroyed) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    orbit.update();
    if (host && host.currentState === 'active') {
      host.update(dt, [camera.position.x, camera.position.y, camera.position.z], now / 1000);
    }
    renderer.render(scene, camera);
    rafId = window.requestAnimationFrame(tick);
  };
  rafId = window.requestAnimationFrame(tick);

  window.__ARENA_PREVIEW__ = {
    getSnapshot: computeSnapshot,
    activateControl,
    reset: resetExhibit,
    remountCycle: async () => {
      if (!host) return { leakCount: -1, resourceCount: -1 };
      host.unmount();
      const leakCount = host.lastLeakCount;
      await host.preload();
      host.mount();
      host.activate(performance.now() / 1000);
      renderHud();
      return { leakCount, resourceCount: host.resourceCount };
    },
    setReducedMotion: async (value: boolean) => {
      reducedMotion = value;
      await mountExhibit();
    },
    setDetailScale: async (value: number) => {
      detailScale = value;
      await mountExhibit();
    },
    setCameraPreset,
    destroy: () => {
      destroyed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      interaction.dispose();
      if (host) {
        scene.remove(host.group);
        host.dispose();
        host = null;
      }
      orbit.dispose();
      renderer.dispose();
    },
  };
}

void bootArenaPreview();
