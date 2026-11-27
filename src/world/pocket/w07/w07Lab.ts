import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { addRail, addWall } from '../kit/worldKit';
import {
  type Box, CHASM, CLOSET, CLOSET_WINDOW, FOYER, FOYER_HEIGHT, LEDGE, LEDGE_Y, NET_Y,
  onRoomCFloor, type Panel, PANELS, RAILS, ROOM_A, ROOM_A_HEIGHT, ROOM_B, ROOM_B_HEIGHT, ROOM_C, ROOM_C_HEIGHT, SHAFT,
  SHAFT_FLOOR_Y, SHELL,
} from './w07Layout';

/** A small generated texture (no asset): `paint(u, v)` returns [r, g, b] in 0..255. */
function dataTexture(ctx: PocketWorldContext, size: number, paint: (u: number, v: number) => readonly [number, number, number, number?]): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a = 255] = paint((x + 0.5) / size, (y + 0.5) / size);
      data.set([r, g, b, a], (y * size + x) * 4);
    }
  }
  const tex = ctx.scope.track(new THREE.DataTexture(data, size, size));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface LabMaterials {
  readonly wall: THREE.MeshStandardMaterial;
  readonly floor: THREE.MeshStandardMaterial;
  readonly metal: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshStandardMaterial;
  readonly hazard: THREE.MeshStandardMaterial;
  readonly panel: THREE.MeshStandardMaterial;
  readonly light: THREE.MeshStandardMaterial;
  readonly ceiling: THREE.MeshStandardMaterial;
}

export function labMaterials(ctx: PocketWorldContext): LabMaterials {
  const { scope } = ctx;
  // Concrete-grey wall tiles with dark grout: clearly NOT a portal surface.
  const wallTex = dataTexture(ctx, 64, (u, v) => {
    const grout = u < 0.04 || v < 0.04;
    const n = Math.sin(u * 37 + v * 11) * 5 + Math.sin(v * 53) * 3;
    return grout ? [44, 48, 54] : [92 + n, 98 + n, 106 + n];
  });
  const floorTex = dataTexture(ctx, 64, (u, v) => {
    const line = u < 0.03 || v < 0.03;
    const n = Math.sin(u * 29 + v * 17) * 4;
    return line ? [52, 56, 62] : [92 + n, 98 + n, 106 + n];
  });
  const hazardTex = dataTexture(ctx, 64, (u, v) => {
    // Soft-edged diagonal stripes (two per tile), so they stay crisp without aliasing.
    const t = ((u + v) * 2) % 1;
    const k = Math.min(1, Math.max(0, (Math.min(Math.abs(t - 0.25), Math.abs(t - 0.75)) - 0.235) / 0.03 + 0.5));
    const yellow = [235, 188, 40], black = [30, 30, 32];
    return [0, 1, 2].map((c) => Math.round(yellow[c] * (1 - k) + black[c] * k)) as unknown as [number, number, number];
  });
  // Approved panel: bright white, a black frame and corner chevrons.
  const panelTex = dataTexture(ctx, 128, (u, v) => {
    const edge = Math.min(u, v, 1 - u, 1 - v);
    if (edge < 0.035) return [20, 22, 26];
    const cu = Math.min(u, 1 - u), cv = Math.min(v, 1 - v);
    if (cu < 0.16 && cv < 0.16 && Math.abs(cu - cv) < 0.025 && edge > 0.05) return [40, 44, 52];
    const n = Math.sin(u * 40) * 2 + Math.sin(v * 31) * 2;
    return [246 + n, 247 + n, 250];
  });
  return {
    wall: scope.track(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 })),
    floor: scope.track(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.05 })),
    metal: scope.track(new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.45, metalness: 0.6 })),
    glass: scope.track(new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide })),
    hazard: scope.track(new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 })),
    panel: scope.track(new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.08 })),
    light: scope.track(new THREE.MeshStandardMaterial({ color: 0x20262c, emissive: 0xe8f4ff, emissiveIntensity: 1.6 })),
    ceiling: scope.track(new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.9 })),
  };
}

/** A box mesh with UVs scaled to world metres (for tiled textures). */
export function worldBox(scope: PocketWorldContext['scope'], b: Box, tile = 1.6): THREE.BufferGeometry {
  const sx = b.maxX - b.minX, sy = b.maxY - b.minY, sz = b.maxZ - b.minZ;
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.getAttribute('uv');
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const x = pos.getX(i) + b.minX + sx / 2, y = pos.getY(i) + b.minY + sy / 2, z = pos.getZ(i) + b.minZ + sz / 2;
    if (nx > 0.5) uv.setXY(i, z / tile, y / tile);
    else if (ny > 0.5) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  g.translate(b.minX + sx / 2, b.minY + sy / 2, b.minZ + sz / 2);
  return scope.track(g);
}

function mesh(ctx: PocketWorldContext, geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = ctx.root): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.raycast = () => {};
  parent.add(m);
  return m;
}

export interface PanelVisual {
  readonly panel: Panel;
  readonly surface: THREE.Mesh;
  readonly highlight: THREE.Mesh;
}

/**
 * Build the lab: floors (with the drop shaft and the chasm left open), the
 * shell walls, calibration glass, railings, ceilings and light strips, hazard
 * edges, the safety net, the ledge, and every approved white panel.
 */
export function buildLab(ctx: PocketWorldContext, mats: LabMaterials, shaftFloorOpen: () => boolean): { panels: PanelVisual[]; highlightMat: THREE.MeshBasicMaterial } {
  const { collision, scope } = ctx;

  // ---- Floors.
  collision.addFloor(FOYER.minX, FOYER.maxX, FOYER.minZ, FOYER.maxZ + 0.01, 0);
  collision.addFloor(ROOM_A.minX, ROOM_A.maxX, ROOM_A.minZ - 0.4, ROOM_A.maxZ + 0.4, 0);
  collision.addFloor(CLOSET.minX - 0.4, CLOSET.maxX, CLOSET.minZ, CLOSET.maxZ, 0);
  collision.addFloor(ROOM_B.minX, ROOM_B.maxX, ROOM_B.minZ - 0.4, ROOM_B.maxZ, 0);
  collision.addMaskedFloor(ROOM_C.minX, ROOM_C.maxX, -50, ROOM_C.maxZ, 0, onRoomCFloor);
  collision.addMaskedFloor(SHAFT.minX, SHAFT.maxX, SHAFT.minZ, SHAFT.maxZ, SHAFT_FLOOR_Y, () => !shaftFloorOpen());
  collision.addFloor(CHASM.minX, CHASM.maxX, CHASM.minZ, CHASM.maxZ, NET_Y);
  collision.addFloor(LEDGE.minX, LEDGE.maxX, LEDGE.minZ, LEDGE.maxZ, LEDGE_Y);

  const floorSlab = (minX: number, maxX: number, minZ: number, maxZ: number, y: number, mat: THREE.Material = mats.floor) =>
    mesh(ctx, worldBox(scope, { minX, maxX, minY: y - 0.3, maxY: y, minZ, maxZ }, 2), mat);
  floorSlab(FOYER.minX, FOYER.maxX, FOYER.minZ, FOYER.maxZ, 0);
  floorSlab(ROOM_A.minX, ROOM_A.maxX, ROOM_A.minZ - 0.4, ROOM_A.maxZ + 0.4, 0);
  floorSlab(CLOSET.minX - 0.4, CLOSET.maxX, CLOSET.minZ, CLOSET.maxZ, 0);
  floorSlab(ROOM_B.minX, ROOM_B.maxX, ROOM_B.minZ - 0.4, ROOM_B.maxZ, 0);
  // Chamber Three: main floor around the shaft, the side walkways, and the ledge.
  floorSlab(ROOM_C.minX, ROOM_C.maxX, SHAFT.maxZ, ROOM_C.maxZ, 0);
  floorSlab(ROOM_C.minX, ROOM_C.maxX, -46, SHAFT.minZ, 0);
  floorSlab(ROOM_C.minX, SHAFT.minX, SHAFT.minZ, SHAFT.maxZ, 0);
  floorSlab(SHAFT.maxX, ROOM_C.maxX, SHAFT.minZ, SHAFT.maxZ, 0);
  floorSlab(ROOM_C.minX, -6, -50, -46, 0);
  floorSlab(6, ROOM_C.maxX, -50, -46, 0);
  mesh(ctx, worldBox(scope, { minX: LEDGE.minX, maxX: LEDGE.maxX, minY: NET_Y - 0.5, maxY: LEDGE_Y, minZ: LEDGE.minZ, maxZ: LEDGE.maxZ }, 2), mats.floor);
  // Under the walkways and along the chasm's south edge, solid bodies down to the net.
  mesh(ctx, worldBox(scope, { minX: ROOM_C.minX, maxX: -6, minY: NET_Y, maxY: -0.3, minZ: -50, maxZ: -46 }), mats.wall);
  mesh(ctx, worldBox(scope, { minX: 6, maxX: ROOM_C.maxX, minY: NET_Y, maxY: -0.3, minZ: -50, maxZ: -46 }), mats.wall);
  mesh(ctx, worldBox(scope, { minX: -6, maxX: 6, minY: NET_Y, maxY: -0.3, minZ: -46, maxZ: -45.6 }), mats.wall);
  // Hazard edging: the shaft's drop line and the chasm edges.
  mesh(ctx, worldBox(scope, { minX: SHAFT.maxX, maxX: SHAFT.maxX + 0.25, minY: -0.29, maxY: 0.01, minZ: SHAFT.minZ, maxZ: SHAFT.maxZ }, 0.5), mats.hazard);
  mesh(ctx, worldBox(scope, { minX: -10, maxX: 10, minY: LEDGE_Y - 0.01, maxY: LEDGE_Y + 0.01, minZ: -52.25, maxZ: -52 }, 0.5), mats.hazard);
  // Shaft lining and floor (the floor is the white panel C1, built below).
  mesh(ctx, worldBox(scope, { minX: SHAFT.minX - 0.4, maxX: SHAFT.maxX + 0.4, minY: SHAFT_FLOOR_Y - 0.6, maxY: SHAFT_FLOOR_Y, minZ: SHAFT.minZ - 0.4, maxZ: SHAFT.maxZ + 0.4 }), mats.metal);
  for (const b of SHELL.slice(22, 26)) mesh(ctx, worldBox(scope, { ...b, maxY: b.maxY - 0.3 }), mats.wall);

  // ---- Safety net over the chasm floor.
  const net = new THREE.GridHelper(20, 40, 0xf0c040, 0x8a7a40);
  net.scale.set(1, 1, 6 / 20);
  net.position.set(0, NET_Y + 0.02, (CHASM.minZ + CHASM.maxZ) / 2);
  scope.track(net.geometry);
  scope.track(net.material as THREE.Material);
  net.raycast = () => {};
  ctx.root.add(net);
  mesh(ctx, worldBox(scope, { minX: CHASM.minX, maxX: CHASM.maxX, minY: NET_Y - 0.4, maxY: NET_Y, minZ: CHASM.minZ, maxZ: CHASM.maxZ }), mats.ceiling);

  // ---- Shell walls (visible) and their colliders.
  const glassBoxes = new Set([7, 15]);
  SHELL.forEach((b, i) => {
    addWall(ctx, b.minX, b.maxX, b.minY, b.maxY, b.minZ, b.maxZ);
    if (i >= 22 && i <= 25) return; // shaft lining drawn above
    if (i >= 26) return; // ledge face and net bodies drawn with the floors
    if (glassBoxes.has(i)) {
      mesh(ctx, worldBox(scope, { ...b, minY: 0 }), mats.glass);
      // Mullions and a top rail in dark metal.
      const alongX = b.maxX - b.minX > b.maxZ - b.minZ;
      const len = alongX ? b.maxX - b.minX : b.maxZ - b.minZ;
      const start = alongX ? b.minX : b.minZ;
      for (let k = 0; k <= Math.round(len / 4); k++) {
        const at = start + (k * len) / Math.round(len / 4);
        const m = alongX
          ? { minX: at - 0.06, maxX: at + 0.06, minZ: b.minZ - 0.02, maxZ: b.maxZ + 0.02 }
          : { minX: b.minX - 0.02, maxX: b.maxX + 0.02, minZ: at - 0.06, maxZ: at + 0.06 };
        mesh(ctx, worldBox(scope, { ...m, minY: 0, maxY: b.maxY }), mats.metal);
      }
      mesh(ctx, worldBox(scope, { minX: b.minX - 0.03, maxX: b.maxX + 0.03, minY: 0, maxY: 0.25, minZ: b.minZ - 0.03, maxZ: b.maxZ + 0.03 }), mats.metal);
      return;
    }
    if (i === 21) return; // the pylon is drawn on its own
    if (i === 6) {
      // Chamber One's east wall, drawn around the closet window opening.
      const w = CLOSET_WINDOW;
      for (const piece of [
        { minZ: b.minZ, maxZ: w.minZ, minY: -0.3, maxY: b.maxY },
        { minZ: w.maxZ, maxZ: b.maxZ, minY: -0.3, maxY: b.maxY },
        { minZ: w.minZ, maxZ: w.maxZ, minY: -0.3, maxY: w.minY },
        { minZ: w.minZ, maxZ: w.maxZ, minY: w.maxY, maxY: b.maxY },
      ]) mesh(ctx, worldBox(scope, { minX: b.minX, maxX: b.maxX, ...piece }), mats.wall);
      return;
    }
    mesh(ctx, worldBox(scope, { ...b, minY: Math.max(b.minY, -0.3) }), mats.wall);
  });
  // Ledge face below the ledge and the pylon.
  mesh(ctx, worldBox(scope, { minX: -10, maxX: 10, minY: NET_Y, maxY: LEDGE_Y - 0.02, minZ: -52.4, maxZ: -52 }), mats.wall);
  mesh(ctx, worldBox(scope, SHELL[21]), mats.metal);
  // The closet window: a pane set into Chamber One's east wall (drawn over the wall).
  mesh(ctx, worldBox(scope, { minX: 8.15, maxX: 8.25, minY: CLOSET_WINDOW.minY, maxY: CLOSET_WINDOW.maxY, minZ: CLOSET_WINDOW.minZ, maxZ: CLOSET_WINDOW.maxZ }), mats.glass);

  // ---- Railings.
  const railMesh = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    addRail(ctx, x0, z0, x1, z1, y, 1.1, 0.12);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const bar = new THREE.Mesh(scope.track(new THREE.BoxGeometry(x0 === x1 ? 0.08 : len + 0.08, 0.08, x0 === x1 ? len + 0.08 : 0.08)), mats.hazard);
    bar.position.set((x0 + x1) / 2, y + 1.05, (z0 + z1) / 2);
    bar.raycast = () => {};
    ctx.root.add(bar);
    const posts = Math.max(2, Math.round(len / 1.5) + 1);
    for (let k = 0; k < posts; k++) {
      const t = k / (posts - 1);
      const post = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 6)), mats.metal);
      post.position.set(x0 + (x1 - x0) * t, y + 0.52, z0 + (z1 - z0) * t);
      post.raycast = () => {};
      ctx.root.add(post);
    }
  };
  RAILS.forEach(([x0, z0, x1, z1, y]) => railMesh(x0, z0, x1, z1, y));

  // ---- Ceilings and light strips.
  const ceil = (minX: number, maxX: number, minZ: number, maxZ: number, y: number) => {
    mesh(ctx, worldBox(scope, { minX: minX - 0.4, maxX: maxX + 0.4, minY: y, maxY: y + 0.3, minZ: minZ - 0.4, maxZ: maxZ + 0.4 }), mats.ceiling);
    for (let x = minX + 2.5; x < maxX - 1; x += 5) {
      mesh(ctx, worldBox(scope, { minX: x - 0.25, maxX: x + 0.25, minY: y - 0.08, maxY: y, minZ: minZ + 1, maxZ: maxZ - 1 }), mats.light);
    }
  };
  ceil(FOYER.minX, FOYER.maxX, FOYER.minZ, FOYER.maxZ, FOYER_HEIGHT);
  ceil(ROOM_A.minX, ROOM_A.maxX, ROOM_A.minZ, ROOM_A.maxZ, ROOM_A_HEIGHT);
  ceil(CLOSET.minX, CLOSET.maxX, CLOSET.minZ, CLOSET.maxZ, 4);
  ceil(ROOM_B.minX, ROOM_B.maxX, ROOM_B.minZ, ROOM_B.maxZ, ROOM_B_HEIGHT);
  ceil(ROOM_C.minX, ROOM_C.maxX, ROOM_C.minZ, ROOM_C.maxZ, ROOM_C_HEIGHT);

  // ---- Approved white panels and their aim highlights.
  const highlightTex = dataTexture(ctx, 64, (u, v) => {
    const edge = Math.min(u, v, 1 - u, 1 - v);
    return [255, 255, 255, edge < 0.06 ? 255 : 0];
  });
  const highlightMat = scope.track(new THREE.MeshBasicMaterial({ map: highlightTex, color: 0x7fe0ff, transparent: true, depthWrite: false }));
  const panels = PANELS.map((p): PanelVisual => {
    const w = p.half * 2;
    const h = p.kind === 'floor' ? p.half * 2 : p.top - p.bottom;
    const surface = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(w, h)), mats.panel);
    const highlight = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(w + 0.12, h + 0.12)), highlightMat);
    for (const [m, off] of [[surface, 0.025], [highlight, 0.04]] as const) {
      if (p.kind === 'floor') {
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.centre[0], p.centre[1] + off, p.centre[2]);
      } else {
        m.rotation.y = Math.atan2(p.normal[0], p.normal[2]);
        m.position.set(p.centre[0] + p.normal[0] * off, p.centre[1], p.centre[2] + p.normal[2] * off);
      }
      m.raycast = () => {};
      ctx.root.add(m);
    }
    highlight.visible = false;
    return { panel: p, surface, highlight };
  });
  return { panels, highlightMat };
}

/** Wall-mounted push button (the registered object is the returned group). */
export function wallButton(ctx: PocketWorldContext, mats: LabMaterials, at: readonly [number, number, number], facingYaw: number, color = 0xd04030): { group: THREE.Group; cap: THREE.Mesh; capMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.position.set(at[0], at[1], at[2]);
  group.rotation.y = facingYaw;
  const plate = new THREE.Mesh(ctx.scope.track(new THREE.BoxGeometry(0.62, 0.62, 0.08)), mats.hazard);
  const capMat = ctx.scope.track(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 }));
  const cap = new THREE.Mesh(ctx.scope.track(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 20)), capMat);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.1;
  group.add(plate, cap);
  ctx.root.add(group);
  return { group, cap, capMat };
}

/** One portal's visual: an elliptical rim and a swirling inner veil (no render targets, no recursion). */
export function portalVisual(ctx: PocketWorldContext, colour: number): { group: THREE.Group; veilMat: THREE.MeshBasicMaterial; rimMat: THREE.MeshStandardMaterial; veil: THREE.Mesh } {
  const swirl = dataTexture(ctx, 128, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const a = Math.atan2(dy, dx);
    const band = 0.5 + 0.5 * Math.sin(a * 3 + r * 9);
    const fall = Math.max(0, 1 - r);
    const l = Math.round(255 * (0.35 + 0.65 * band) * fall + 30 * fall);
    return [l, l, l, Math.round(255 * Math.min(1, fall * 1.6))];
  });
  const group = new THREE.Group();
  const rimMat = ctx.scope.track(new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.4, roughness: 0.3 }));
  const rim = new THREE.Mesh(ctx.scope.track(new THREE.TorusGeometry(1, 0.06, 8, 48)), rimMat);
  const veilMat = ctx.scope.track(new THREE.MeshBasicMaterial({ map: swirl, color: colour, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  const veil = new THREE.Mesh(ctx.scope.track(new THREE.CircleGeometry(0.97, 40)), veilMat);
  rim.raycast = () => {};
  veil.raycast = () => {};
  group.add(rim, veil);
  group.visible = false;
  ctx.root.add(group);
  return { group, veilMat, rimMat, veil };
}

export { dataTexture };
