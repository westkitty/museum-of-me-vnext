import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addLightRig, addPlatform, addRail, gradientSkyDome, type PocketPreviewHandle } from '../kit/worldKit';

export interface L01Snapshot {
  readonly beamAngle: number;
  readonly revealed: readonly boolean[];
  readonly stage: number;
  readonly checkpoints: readonly string[];
  readonly optionalFound: boolean;
  readonly beaconRestored: boolean;
  readonly panoramaProgress: number;
  readonly completeRequested: boolean;
}
export interface L01PreviewHandle extends PocketPreviewHandle { getSnapshot(): L01Snapshot }

const SPAWN = [0, 0, 26] as const;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** L01: a safe coastal path is exposed in stages by the lighthouse beam. */
export function createL01WorldFactory(onReady?: (handle: L01PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('L01 load aborted', 'AbortError');
    const { root, scope, collision, player } = ctx;
    const stone = scope.track(new THREE.MeshStandardMaterial({ color: 0x485760, roughness: 0.94, flatShading: true }));
    const pathMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xc3bc9b, roughness: 0.7, emissive: 0x263047, emissiveIntensity: 0.3 }));
    const brass = scope.track(new THREE.MeshStandardMaterial({ color: 0xd6b269, metalness: 0.65, roughness: 0.4 }));
    const lightMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffe8a2, toneMapped: false }));
    const ghostMat = scope.track(new THREE.MeshBasicMaterial({ color: 0x8cb7c9, transparent: true, opacity: 0.18, depthWrite: false }));
    gradientSkyDome(ctx, { zenith: 0x14233b, horizon: 0x51677a, nadir: 0x0f273c }, 420);
    addLightRig(ctx, { sky: 0xb4c8d8, ground: 0x274052, hemiIntensity: 1.2, sun: 0xe4cfaa, sunIntensity: 1.1, sunPosition: [40, 60, -30] });
    const fog = new THREE.FogExp2(0x506475, 0.008);

    // The sea has no collision. Every traversable stone and light path does.
    const sea = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(500, 500)), scope.track(new THREE.MeshStandardMaterial({ color: 0x173e57, metalness: 0.2, roughness: 0.35, transparent: true, opacity: 0.92 })));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -7; sea.raycast = () => {}; root.add(sea);
    const islands = [
      { minX: -7, maxX: 7, minZ: 16, maxZ: 34 },
      { minX: -6, maxX: 6, minZ: -7, maxZ: 5 },
      { minX: 17, maxX: 27, minZ: -7, maxZ: 5 },
      { minX: 16, maxX: 28, minZ: -43, maxZ: -23 },
    ] as const;
    islands.forEach((r) => addPlatform(ctx, stone, { ...r, y: 0, depth: 7 }));
    const cliffMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x263d4b, roughness: 0.96, flatShading: true }));
    const rockGeo = scope.track(new THREE.DodecahedronGeometry(1, 1));
    const rock = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(rockGeo, cliffMat);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.raycast = () => {}; root.add(mesh);
    };
    islands.forEach((r, i) => {
      const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
      rock(cx, -8.5, cz, (r.maxX - r.minX) * 0.7, 8 + i * 2, (r.maxZ - r.minZ) * 0.7);
      rock(r.minX - 1.4, -5, cz + 2, 2.2, 5, 4);
      rock(r.maxX + 1.3, -6, cz - 2, 2.4, 6, 3.5);
    });
    // Coastal breakwaters and lamp posts give each waiting island a readable edge.
    const postGeo = scope.track(new THREE.CylinderGeometry(0.11, 0.17, 2.6, 8));
    const bulbGeo = scope.track(new THREE.SphereGeometry(0.23, 8, 6));
    for (const [x, z] of [[-5, 21], [5, 21], [-4, -4], [4, -4], [19, -4], [25, -4], [18, -32], [26, -32]] as const) {
      const post = new THREE.Mesh(postGeo, brass); post.position.set(x, 1.3, z); root.add(post);
      const bulb = new THREE.Mesh(bulbGeo, lightMat); bulb.position.set(x, 2.75, z); root.add(bulb);
    }
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      addRail(ctx, x0, z0, x1, z1, 0);
      const dx = x1 - x0, dz = z1 - z0;
      const mesh = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.14, 0.15, Math.hypot(dx, dz))), brass);
      mesh.position.set((x0 + x1) / 2, 0.92, (z0 + z1) / 2);
      mesh.rotation.y = Math.atan2(dx, dz); root.add(mesh);
    };
    islands.forEach((r, i) => {
      if (i !== 2) rail(r.minX, r.minZ, r.minX, r.maxZ); // keeper island receives the eastward light path
      if (i !== 1) rail(r.maxX, r.minZ, r.maxX, r.maxZ); // watch island sends the eastward light path
    });
    const paths = [
      { minX: -2.5, maxX: 2.5, minZ: 5, maxZ: 16, cx: 0, cz: 10.5, angle: Math.atan2(4.7, 14.5) },
      { minX: 6, maxX: 17, minZ: -2.5, maxZ: 2.5, cx: 11.5, cz: 0, angle: Math.atan2(16.2, 25) },
      { minX: 19.5, maxX: 24.5, minZ: -23, maxZ: -7, cx: 22, cz: -15, angle: Math.atan2(26.7, 40) },
    ] as const;
    const bridgeMeshes = paths.map((r) => {
      const mesh = new THREE.Mesh(scope.track(new THREE.BoxGeometry(r.maxX - r.minX, 0.36, r.maxZ - r.minZ)), pathMat);
      mesh.position.set(r.cx, -0.18, r.cz); mesh.visible = false; root.add(mesh);
      const ghost = new THREE.LineSegments(scope.track(new THREE.EdgesGeometry(mesh.geometry)), ghostMat);
      ghost.position.copy(mesh.position); ghost.raycast = () => {}; root.add(ghost);
      return { mesh, ghost };
    });

    const tower = (x: number, z: number, height: number, mat: THREE.Material) => {
      const shaft = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.1, 1.8, height, 10)), mat);
      shaft.position.set(x, height / 2, z); root.add(shaft); return shaft;
    };
    tower(-4.7, 25, 13, stone);
    const lens = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1.25, 18, 12)), lightMat);
    lens.position.set(-4.7, 13.5, 25); root.add(lens);
    const beamPivot = new THREE.Group(); beamPivot.position.set(-4.7, 13.5, 25); root.add(beamPivot);
    const beam = new THREE.Mesh(scope.track(new THREE.ConeGeometry(12, 85, 24, 1, true)), scope.track(new THREE.MeshBasicMaterial({ color: 0xffe8b3, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })));
    beam.rotation.x = Math.PI / 2; beam.position.z = -42.5; beam.raycast = () => {}; beamPivot.add(beam);
    for (const [x, z, h] of [[-35, -45, 25], [52, -65, 35], [-58, -90, 42], [65, -110, 27]] as const) {
      const ruin = tower(x, z, h, stone); ruin.scale.set(1, 1, 0.75);
      const cap = new THREE.Mesh(scope.track(new THREE.ConeGeometry(2.6, 5, 8)), brass);
      cap.position.set(x, h + 2, z); root.add(cap);
    }
    const beaconBase = tower(22, -36, 12, stone);
    const beacon = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1.1, 16, 12)), lightMat);
    beacon.position.set(22, 2.2, -35); root.add(beacon);
    const tidePool = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1, 1.1, 0.12, 24)), brass);
    tidePool.position.set(21, 0.06, -3); root.add(tidePool);
    const exit = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.8, 1)), brass);
    exit.position.set(22, 1.45, -40); root.add(exit);
    const panorama = new THREE.Group(); panorama.visible = false; root.add(panorama);
    for (const [x, z, r] of [[0, -115, 13], [-35, -130, 18], [40, -155, 21], [70, -180, 12]] as const) {
      const island = new THREE.Mesh(scope.track(new THREE.ConeGeometry(r, r * 1.6, 9)), scope.track(new THREE.MeshStandardMaterial({ color: 0x7c8f83, roughness: 1, flatShading: true })));
      island.position.set(x, 0, z); panorama.add(island);
      const crown = new THREE.Mesh(scope.track(new THREE.ConeGeometry(r * 0.4, r * 1.7, 7)), stone);
      crown.position.set(x, r * 0.5, z); panorama.add(crown);
    }
    const aurora = new THREE.Mesh(scope.track(new THREE.TorusGeometry(38, 1.1, 8, 72)), scope.track(new THREE.MeshBasicMaterial({ color: 0xffd99c, transparent: true, opacity: 0.65, side: THREE.DoubleSide })));
    aurora.position.set(0, 46, -140); panorama.add(aurora);

    let beamAngle = -0.5;
    const revealed = [false, false, false];
    const checkpoints: string[] = [];
    let stage = 0, optionalFound = false, beaconRestored = false, panoramaProgress = 0, completeRequested = false, arrivalAnnounced = false, eligible = false;
    const checkpoint = (id: string) => { if (!checkpoints.includes(id)) { checkpoints.push(id); ctx.saveCheckpoint(); } };
    const reveal = (i: number) => {
      revealed[i] = true; bridgeMeshes[i].mesh.visible = true; bridgeMeshes[i].ghost.visible = false;
      const r = paths[i]; collision.setDynamicFloor(`l01-light-path-${i}`, { kind: 'floor', minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, y: 0 });
      if (i === 0 || i === 2) { rail(r.minX, r.minZ, r.minX, r.maxZ); rail(r.maxX, r.minZ, r.maxX, r.maxZ); }
      else { rail(r.minX, r.minZ, r.maxX, r.minZ); rail(r.minX, r.maxZ, r.maxX, r.maxZ); }
      ctx.announce('The beam has revealed a solid light path. It will remain while you cross.', 7);
    };
    ctx.interaction.register('l01-beacon', { object: beacon, label: () => beaconRestored ? 'Beacon restored' : 'Restore the beacon', activate: () => {
      if (stage < 3 || beaconRestored) return;
      beaconRestored = true; panorama.visible = true; fog.density = 0.003;
      ctx.announce('The beacon ignites. Fog parts to reveal the coast beyond the end of the world.', 9);
    } });
    ctx.interaction.register('l01-tide-pool', { object: tidePool, label: () => 'Study the tide pool', activate: () => {
      optionalFound = true; ctx.announce('A tiny second lighthouse shines inside the tide pool.', 6);
    } });
    ctx.interaction.register('l01-exit', { object: exit, label: () => eligible ? 'Return to the peninsula lighthouse' : 'The beacon is still dark', activate: () => {
      if (!eligible || completeRequested) return;
      completeRequested = true; ctx.requestComplete();
    } });
    onReady?.({ getSnapshot: (): L01Snapshot => ({ beamAngle, revealed: [...revealed], stage, checkpoints: [...checkpoints], optionalFound, beaconRestored, panoramaProgress, completeRequested }) });
    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      fog,
      background: new THREE.Color(0x455a70),
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!arrivalAnnounced) { arrivalAnnounced = true; ctx.announce('Lighthouse at World’s End. Follow the sweeping beam. A pale outline marks each safe waiting path.', 8); }
        if (!ctx.reducedMotion()) beamAngle = (beamAngle + dt * 0.55) % (Math.PI * 2);
        else beamAngle = paths[stage]?.angle ?? 0;
        const p = player.position;
        if (p.y < -10) { if (!ctx.resetToCheckpoint()) player.teleport([...SPAWN], 0); ctx.announce('The sea mist returns you to the last safe stone.', 5); }
        if (p.z < 4 && p.x < 8) { stage = Math.max(stage, 1); checkpoint('watch-island'); }
        if (p.x > 18 && p.z > -8) { stage = Math.max(stage, 2); checkpoint('keeper-island'); }
        if (p.x > 17 && p.z < -25) { stage = 3; checkpoint('beacon-island'); }
        const i = stage;
        if (i < 3 && !revealed[i] && (ctx.reducedMotion() || Math.abs(wrapAngle(beamAngle - paths[i].angle)) < 0.12)) reveal(i);
        if (beaconRestored) {
          panoramaProgress = Math.min(1, panoramaProgress + dt / (ctx.reducedMotion() ? 0.2 : 7));
          if (panoramaProgress >= 1 && !eligible) { eligible = true; ctx.markCompletionEligible(); ctx.announce('The entire coast is visible. The return light waits behind the beacon.', 7); }
        }
      },
      variableUpdate() {
        beamPivot.rotation.y = -beamAngle;
        lens.scale.setScalar(1 + panoramaProgress * 0.25);
        beaconBase.scale.y = 1 + panoramaProgress * 0.05;
        aurora.rotation.z = panoramaProgress * 0.35;
      },
      dispose() { paths.forEach((_, i) => collision.setDynamicFloor(`l01-light-path-${i}`, null)); },
    };
  };
}
