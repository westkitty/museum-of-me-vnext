import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addPlatform, addRail, addRamp, inRect, orientedWall, paintVertices, type PocketPreviewHandle, type Rect } from '../kit/worldKit';
import { BANK_GAP, buildCistern, buildLilyPond } from './w05Mechanisms';
import { buildW05Scenery } from './w05Scenery';
import {
  ATRIUM, BLOOM_COLLAR, BLOOM_POS, CANOPY, CANOPY_CENTER, CANOPY_MIRROR_POS, CANOPY_RADIUS, CANOPY_TARGET_POINTS,
  CANOPY_TARGETS, CANOPY_Y, type CanopyTarget, DECK, DECK_CALL_POS, DEW_VALVE_POS, FALL_RESET_Y, GALLERY, GATE_POS,
  inCanopy, type Landing, LEAF_RAMP, LILY_PADS, ORCHID_ALCOVE, ORCHID_POS, POND, POND_WATER_Y, ROUTE_CHECKPOINTS,
  SKYLIGHT_Y, SPAWN, SUN_MIRROR_POS,
} from './w05Layout';

export interface W05Snapshot {
  readonly mirrorTarget: number;
  readonly padsLit: readonly boolean[];
  readonly padGrowth: readonly number[];
  readonly padsGrown: number;
  readonly pondComplete: boolean;
  readonly raftY: number;
  readonly raftTarget: number;
  readonly raftRiding: boolean;
  readonly checkpoints: readonly string[];
  readonly orchidFound: boolean;
  readonly canopyReached: boolean;
  readonly canopyTarget: string;
  readonly dewOn: boolean;
  readonly finaleStarted: boolean;
  readonly finaleProgress: number;
  readonly completionEligible: boolean;
  readonly completeRequested: boolean;
  readonly fallResets: number;
}

export interface W05PreviewHandle extends PocketPreviewHandle {
  getSnapshot(): W05Snapshot;
}

const FINALE_SECONDS = 10;
const PETALS = 14;
const TARGET_NAMES: Record<CanopyTarget, string> = { ferns: 'the ferns', glass: 'the glass roof', bud: 'the bud' };
const UP = new THREE.Vector3(0, 1, 0);

/** Tile grout lines lying on a terrace (one draw, never raycast). */
function tileLines(ctx: PocketWorldContext, r: Rect, y: number, spacing: number, material: THREE.LineBasicMaterial) {
  const pts: number[] = [];
  for (let x = r.minX + spacing; x < r.maxX - 1e-6; x += spacing) pts.push(x, y, r.minZ, x, y, r.maxZ);
  for (let z = r.minZ + spacing; z < r.maxZ - 1e-6; z += spacing) pts.push(r.minX, y, z, r.maxX, y, z);
  const g = ctx.scope.track(new THREE.BufferGeometry());
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(g, material);
  lines.raycast = () => {};
  ctx.root.add(lines);
}

/** Orient a unit (height 1, base at origin) beam mesh from a to b. */
function placeBeam(beam: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const d = new THREE.Vector3().subVectors(b, a);
  beam.position.copy(a);
  beam.quaternion.setFromUnitVectors(UP, d.clone().normalize());
  beam.scale.set(1, d.length(), 1);
}

/**
 * W05 Impossible Greenhouse.
 *
 * Act I: turn the Sun Mirror to light the three seed pods in the pond; each
 * grows into a lily pad, and together they cross to the Fern Hall. Act II:
 * ride the leaf raft as the cistern floods, up to the Vine Gallery (an optional
 * night orchid hides behind the ferns). Act III: climb the leaf ramp to the
 * Canopy, where the Bloom needs both: light from the canopy mirror and water
 * from the dew valve. It opens into the Impossible Bloom and the glasshouse
 * greets the dawn; the vine arch returns home. Nothing is timed or audible.
 */
export function createW05WorldFactory(onReady?: (handle: W05PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W05 load aborted', 'AbortError');
    const { scope, root, collision } = ctx;
    const fog = new THREE.FogExp2(0x0c2422, 0.012);
    const scenery = buildW05Scenery(ctx, fog);
    const glow = (hex: number, intensity = 1) => scope.track(new THREE.MeshStandardMaterial({ color: 0x101410, emissive: hex, emissiveIntensity: intensity }));
    const terracotta = scope.track(new THREE.MeshStandardMaterial({ color: 0xa65a3a, roughness: 0.85 }));
    const stone = scope.track(new THREE.MeshStandardMaterial({ color: 0x6f6a5e, roughness: 0.9 }));
    const leaf = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
    const iron = scope.track(new THREE.MeshStandardMaterial({ color: 0x1f2b26, metalness: 0.75, roughness: 0.4 }));
    const brass = scope.track(new THREE.MeshStandardMaterial({ color: 0xc19a4a, metalness: 0.85, roughness: 0.3 }));
    const water = scope.track(new THREE.MeshStandardMaterial({ color: 0x0c3430, emissive: 0x041a18, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.9 }));
    const beamMat = (hex: number) => scope.track(new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const beamGeo = scope.track(new THREE.CylinderGeometry(0.16, 0.16, 1, 12, 1, true));
    beamGeo.translate(0, 0.5, 0);
    const shaftGeo = scope.track(new THREE.CylinderGeometry(0.7, 1.3, 1, 18, 1, true));
    shaftGeo.translate(0, 0.5, 0);

    // ---- Terraces.
    const grout = scope.track(new THREE.LineBasicMaterial({ color: 0x5a2e1c, transparent: true, opacity: 0.7 }));
    // Stone terraces with a terracotta tile floor (the tile plane sits just above the slab top).
    const tileGeo = scope.track(new THREE.PlaneGeometry(1, 1));
    tileGeo.rotateX(-Math.PI / 2);
    const terrace = (def: Landing, depth: number) => {
      addPlatform(ctx, stone, { ...def, depth });
      const tiles = new THREE.Mesh(tileGeo, terracotta);
      tiles.scale.set(def.maxX - def.minX, 1, def.maxZ - def.minZ);
      tiles.position.set((def.minX + def.maxX) / 2, def.y + 0.004, (def.minZ + def.maxZ) / 2);
      root.add(tiles);
      tileLines(ctx, def, def.y + 0.01, 1, grout);
    };
    terrace(ATRIUM, 3);
    terrace(DECK, 3);
    terrace(ORCHID_ALCOVE, 2.5);
    terrace(GALLERY, 6);
    const ramp = addRamp(ctx, leaf, { ...LEAF_RAMP, depth: 0.4, rails: true });
    paintVertices(ramp.geometry, (_x, _y, _z, out) => out.setHSL(0.28, 0.5, 0.24));
    // A short lip joins the ramp top to the round canopy leaf.
    collision.addFloor(LEAF_RAMP.minX, LEAF_RAMP.maxX, LEAF_RAMP.minZ - 1.2, LEAF_RAMP.minZ, CANOPY_Y);

    // The Canopy: a giant round leaf on a stalk.
    collision.addMaskedFloor(CANOPY.minX, CANOPY.maxX, CANOPY.minZ, CANOPY.maxZ, CANOPY_Y, inCanopy);
    const canopyGeo = scope.track(new THREE.CylinderGeometry(CANOPY_RADIUS + 0.2, CANOPY_RADIUS - 0.6, 0.5, 64, 4));
    canopyGeo.translate(0, -0.25, 0);
    paintVertices(canopyGeo, (x, _y, z, out) => {
      const r = Math.hypot(x, z) / CANOPY_RADIUS;
      const vein = Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 11)), 24) * (0.3 + r * 0.7);
      out.setHSL(0.27 + r * 0.03, 0.5, 0.2 + r * 0.06 + vein * 0.1);
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, leaf);
    canopyMesh.position.set(CANOPY_CENTER[0], CANOPY_Y, CANOPY_CENTER[1]);
    root.add(canopyMesh);
    const stalk = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.4, 2.4, 34, 14)), scope.track(new THREE.MeshStandardMaterial({ color: 0x3d6b32, roughness: 0.8 })));
    stalk.position.set(CANOPY_CENTER[0], CANOPY_Y - 17.4, CANOPY_CENTER[1]);
    root.add(stalk);

    // ---- Rails (wrought iron) on every drop-away edge.
    const railSegs: [number, number, number, number, number][] = [
      // Potting Atrium (the pond bank rail at z 13 belongs to the pond).
      [-8, 28, 8, 28, 0], [-8, 13, -8, 28, 0], [8, 13, 8, 28, 0],
      // Fern Hall: bank ends, west, east (alcove opening), north (cistern opening).
      [-10, 1, -8, 1, 0], [8, 1, 10, 1, 0], [-10, -14, -10, 1, 0], [10, -14, 10, -10, 0], [10, -4, 10, 1, 0],
      [-10, -14, -3.6, -14, 0], [3.6, -14, 10, -14, 0],
      // Orchid alcove.
      [10, -10, 16, -10, 0], [10, -4, 16, -4, 0], [16, -10, 16, -4, 0],
      // Vine Gallery: south (cistern opening), sides, north (ramp opening).
      [-10, -22, -3.6, -22, 6], [3.6, -22, 10, -22, 6], [-10, -34, -10, -22, 6], [10, -34, 10, -22, 6],
      [-10, -34, -2, -34, 6], [2, -34, 10, -34, 6],
    ];
    const bankVisual: [number, number, number, number, number][] = [
      [-8, ATRIUM.minZ, BANK_GAP[0], ATRIUM.minZ, 0], [BANK_GAP[1], ATRIUM.minZ, 8, ATRIUM.minZ, 0],
      [-8, DECK.maxZ, BANK_GAP[0], DECK.maxZ, 0], [BANK_GAP[1], DECK.maxZ, 8, DECK.maxZ, 0],
    ];
    const ringSegs = 28;
    const ring: { cx: number; cz: number; half: number; yaw: number }[] = [];
    for (let i = 0; i < ringSegs; i++) {
      const a = ((i + 0.5) / ringSegs) * Math.PI * 2;
      const toRamp = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)));
      if (toRamp < 0.3) continue;
      const r = CANOPY_RADIUS - 0.15;
      const cx = CANOPY_CENTER[0] + Math.cos(a) * r, cz = CANOPY_CENTER[1] + Math.sin(a) * r;
      const half = (Math.PI * r) / ringSegs;
      collision.add(orientedWall(cx, cz, 0.15, half, -a, CANOPY_Y - 0.6, CANOPY_Y + 1.1));
      ring.push({ cx, cz, half, yaw: -a });
    }
    const railGeo = scope.track(new THREE.CylinderGeometry(0.05, 0.05, 1, 6));
    const postGeo = scope.track(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6));
    const allRails = [...railSegs, ...bankVisual];
    const railMesh = new THREE.InstancedMesh(railGeo, iron, allRails.length + ring.length);
    const postMesh = new THREE.InstancedMesh(postGeo, iron, allRails.length * 2 + ring.length);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let posts = 0;
    allRails.forEach(([x0, z0, x1, z1, y], i) => {
      if (i < railSegs.length) addRail(ctx, x0, z0, x1, z1, y);
      const len = Math.hypot(x1 - x0, z1 - z0);
      q.setFromUnitVectors(UP, new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize());
      railMesh.setMatrixAt(i, mtx.compose(new THREE.Vector3((x0 + x1) / 2, y + 1.0, (z0 + z1) / 2), q, new THREE.Vector3(1, len, 1)));
      postMesh.setMatrixAt(posts++, mtx.makeTranslation(x0, y + 0.52, z0));
      postMesh.setMatrixAt(posts++, mtx.makeTranslation(x1, y + 0.52, z1));
    });
    ring.forEach(({ cx, cz, half, yaw }, i) => {
      // Cylinder axis y -> tangent: first lay it along z, then turn by yaw.
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
      railMesh.setMatrixAt(allRails.length + i, mtx.compose(new THREE.Vector3(cx, CANOPY_Y + 1.0, cz), q, new THREE.Vector3(1, half * 2, 1)));
      postMesh.setMatrixAt(posts++, mtx.makeTranslation(cx, CANOPY_Y + 0.52, cz));
    });
    postMesh.count = posts;
    railMesh.raycast = () => {};
    postMesh.raycast = () => {};
    root.add(railMesh, postMesh);

    // ---- The pond (Act I).
    const pondWater = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(POND.maxX - POND.minX, POND.maxZ - POND.minZ)), water);
    pondWater.rotation.x = -Math.PI / 2;
    pondWater.position.set(0, POND_WATER_Y, (POND.minZ + POND.maxZ) / 2);
    root.add(pondWater);
    for (const x of [POND.minX - 0.3, POND.maxX + 0.3]) {
      const coping = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.6, 1.2, POND.maxZ - POND.minZ)), stone);
      coping.position.set(x, -0.4, (POND.minZ + POND.maxZ) / 2);
      root.add(coping);
    }
    const pond = buildLilyPond(ctx, { leaf });
    const podMats = LILY_PADS.map(() => glow(0x9cff7a, 0.6));
    const podGeo = scope.track(new THREE.SphereGeometry(0.32, 14, 10));
    const pods = LILY_PADS.map(([x, z], i) => {
      const pod = new THREE.Mesh(podGeo, podMats[i]);
      pod.position.set(x, POND_WATER_Y + 0.12, z);
      pod.scale.set(1, 0.7, 1);
      root.add(pod);
      return pod;
    });

    // Sun Mirror: a skylight shaft falls onto it; its reflection lights one pod.
    const sunMirror = new THREE.Group();
    sunMirror.position.set(...SUN_MIRROR_POS);
    const pedestal = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.35, 0.5, 1.0, 12)), stone);
    pedestal.position.y = 0.5;
    const mirrorPivot = new THREE.Group();
    mirrorPivot.position.y = 1.5;
    const mirrorFace = new THREE.Mesh(scope.track(new THREE.CircleGeometry(0.6, 32)),
      scope.track(new THREE.MeshStandardMaterial({ color: 0xdff6ff, metalness: 1, roughness: 0.05, emissive: 0x88c8d8, emissiveIntensity: 0.35, side: THREE.DoubleSide })));
    const mirrorRim = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.62, 0.05, 8, 32)), brass);
    mirrorPivot.add(mirrorFace, mirrorRim);
    sunMirror.add(pedestal, mirrorPivot);
    root.add(sunMirror);
    collision.addBox([SUN_MIRROR_POS[0], 0.75, SUN_MIRROR_POS[2]], [0.55, 0.75, 0.55]);
    const sunShaftMat = beamMat(0xfff1c0);
    sunShaftMat.opacity = 0.16;
    const sunShaft = new THREE.Mesh(shaftGeo, sunShaftMat);
    placeBeam(sunShaft, new THREE.Vector3(SUN_MIRROR_POS[0], 1.5, SUN_MIRROR_POS[2]), new THREE.Vector3(SUN_MIRROR_POS[0] - 3, SKYLIGHT_Y, SUN_MIRROR_POS[2] + 2));
    sunShaft.raycast = () => {};
    root.add(sunShaft);
    const pondBeam = new THREE.Mesh(beamGeo, beamMat(0xfff4b0));
    pondBeam.visible = false;
    pondBeam.raycast = () => {};
    root.add(pondBeam);

    // ---- Fern Hall decor, the cistern, the deck call lever (Act II).
    const frondGeo = scope.track(new THREE.ConeGeometry(0.25, 2.4, 5));
    frondGeo.translate(0, 1.2, 0);
    const fernMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x3c7f3a, roughness: 0.8 }));
    const fernSpots: [number, number, number][] = [[-8.6, -2, 0], [-8.6, -7, 0], [-8.6, -12, 0], [8.6, -1.6, 0], [8.6, -12.6, 0], [-8.6, -32, 6], [8.6, -32, 6], [-8.6, -24, 6], [8.6, -24, 6]];
    const fronds = new THREE.InstancedMesh(frondGeo, fernMat, fernSpots.length * 9);
    const e = new THREE.Euler();
    fernSpots.forEach(([x, z, y], i) => {
      for (let k = 0; k < 9; k++) {
        e.set(0.5 + (k % 3) * 0.25, (k / 9) * Math.PI * 2, 0, 'YXZ');
        fronds.setMatrixAt(i * 9 + k, mtx.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e), new THREE.Vector3(1, 0.8 + (k % 2) * 0.4, 1)));
      }
    });
    fronds.raycast = () => {};
    root.add(fronds);
    // Fern curtain over the alcove opening (walk-through).
    const curtainGeo = scope.track(new THREE.PlaneGeometry(0.5, 3.2));
    curtainGeo.translate(0, -1.6, 0);
    const curtainMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x356f34, side: THREE.DoubleSide, transparent: true, opacity: 0.85, roughness: 0.8 }));
    const curtain = new THREE.InstancedMesh(curtainGeo, curtainMat, 14);
    for (let k = 0; k < 14; k++) {
      e.set(0, Math.PI / 2 + (k % 2 ? 0.3 : -0.3), 0);
      curtain.setMatrixAt(k, mtx.compose(new THREE.Vector3(10 + (k % 2) * 0.15, 3.4, -9.7 + k * 0.42), q.setFromEuler(e), new THREE.Vector3(1, 0.7 + (k % 3) * 0.15, 1)));
    }
    curtain.raycast = () => {};
    root.add(curtain);

    for (const x of [-3.3, 3.3]) {
      const wall = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.6, 10.6, 8)), stone);
      wall.position.set(x, 1.3, -18);
      root.add(wall);
    }
    const cistern = buildCistern(ctx, { leaf, iron, brass, water });
    // Ivy over the gallery's face above the cistern: what a rising rider looks at.
    const ivyGeo = scope.track(new THREE.CircleGeometry(0.32, 6));
    const ivy = new THREE.InstancedMesh(ivyGeo, scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide })), 90);
    const ivyRand = (k: number) => (Math.sin(k * 12.9898) * 43758.5453) % 1;
    const ivyColor = new THREE.Color();
    for (let k = 0; k < 90; k++) {
      const strand = k % 9;
      const x = -2.7 + strand * 0.68 + ivyRand(k) * 0.2;
      const y = GALLERY.y - 0.2 - Math.floor(k / 9) * (0.4 + Math.abs(ivyRand(k + 3)) * 0.35) * (0.5 + (strand % 3) * 0.35);
      e.set(0, 0, ivyRand(k + 7) * 1.2);
      ivy.setMatrixAt(k, mtx.compose(new THREE.Vector3(x, Math.max(0.3, y), GALLERY.maxZ + 0.03), q.setFromEuler(e), new THREE.Vector3(1, 1.25, 1)));
      ivy.setColorAt(k, ivyColor.setHSL(0.28 + ivyRand(k + 11) * 0.04, 0.5, 0.22 + Math.abs(ivyRand(k + 5)) * 0.1));
    }
    ivy.raycast = () => {};
    root.add(ivy);

    const deckCall = new THREE.Group();
    deckCall.position.set(...DECK_CALL_POS);
    const callPost = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 8)), iron);
    callPost.position.y = 0.5;
    const callHandle = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.1, 0.55, 0.1)), brass);
    callHandle.position.set(0, 1.1, 0);
    callHandle.rotation.x = 0.5;
    deckCall.add(callPost, callHandle);
    root.add(deckCall);
    collision.addBox([DECK_CALL_POS[0], 0.6, DECK_CALL_POS[2]], [0.3, 0.6, 0.3]);

    // Optional night orchid behind the fern curtain.
    const orchid = new THREE.Group();
    orchid.position.set(...ORCHID_POS);
    const orchidPot = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.42, 0.3, 0.6, 14)), terracotta);
    orchidPot.position.y = 0.3;
    const orchidStem = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5)), fernMat);
    orchidStem.position.y = 1.0;
    const orchidGlow = glow(0x5fa8ff, 1.2);
    const orchidPetalGeo = scope.track(new THREE.SphereGeometry(0.16, 10, 8));
    orchid.add(orchidPot, orchidStem);
    // Five petals splayed up and out from the stem top, around a pale lip.
    for (let k = 0; k < 5; k++) {
      const pivot = new THREE.Group();
      pivot.position.y = 1.42;
      pivot.rotation.y = (k / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(orchidPetalGeo, orchidGlow);
      petal.position.set(0, 0.08, 0.2);
      petal.rotation.x = -0.6;
      petal.scale.set(0.75, 0.3, 1.5);
      pivot.add(petal);
      orchid.add(pivot);
    }
    const lip = new THREE.Mesh(orchidPetalGeo, glow(0xdff0ff, 0.8));
    lip.position.y = 1.44;
    lip.scale.setScalar(0.5);
    orchid.add(lip);
    root.add(orchid);
    collision.addBox([ORCHID_POS[0], 0.5, ORCHID_POS[2]], [0.45, 0.5, 0.45]);
    if (signal.aborted) throw new DOMException('W05 load aborted', 'AbortError');

    // ---- The Canopy: mirror, dew valve, the Bloom and the vine arch (Act III).
    const canopyMirror = new THREE.Group();
    canopyMirror.position.set(...CANOPY_MIRROR_POS);
    const cPed = new THREE.Mesh(pedestal.geometry, stone);
    cPed.position.y = 0.5;
    const cPivot = new THREE.Group();
    cPivot.position.y = 1.5;
    cPivot.add(new THREE.Mesh(mirrorFace.geometry, mirrorFace.material), new THREE.Mesh(mirrorRim.geometry, brass));
    canopyMirror.add(cPed, cPivot);
    root.add(canopyMirror);
    collision.addBox([CANOPY_MIRROR_POS[0], CANOPY_Y + 0.75, CANOPY_MIRROR_POS[2]], [0.55, 0.75, 0.55]);
    const canopyShaft = new THREE.Mesh(shaftGeo, sunShaftMat);
    placeBeam(canopyShaft, new THREE.Vector3(CANOPY_MIRROR_POS[0], CANOPY_Y + 1.5, CANOPY_MIRROR_POS[2]), new THREE.Vector3(CANOPY_MIRROR_POS[0] - 3, SKYLIGHT_Y + 4, CANOPY_MIRROR_POS[2] + 2));
    canopyShaft.raycast = () => {};
    root.add(canopyShaft);
    const canopyBeam = new THREE.Mesh(beamGeo, beamMat(0xfff4b0));
    canopyBeam.raycast = () => {};
    root.add(canopyBeam);

    const dewValve = new THREE.Group();
    dewValve.position.set(...DEW_VALVE_POS);
    const dewPost = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.14, 0.18, 1.0, 10)), iron);
    dewPost.position.y = 0.5;
    const dewWheel = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.4, 0.06, 8, 24)), brass);
    dewWheel.position.y = 1.05;
    dewWheel.rotation.x = Math.PI / 2;
    dewValve.add(dewPost, dewWheel);
    root.add(dewValve);
    collision.addBox([DEW_VALVE_POS[0], CANOPY_Y + 0.55, DEW_VALVE_POS[2]], [0.4, 0.55, 0.4]);
    // The dew pipe hangs from the vault above the bud; its stream shows when open.
    const pipe = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.18, 0.18, 14, 10)), brass);
    pipe.position.set(BLOOM_POS[0], CANOPY_Y + 13 + 7, BLOOM_POS[2]);
    root.add(pipe);
    const dewStreamMat = beamMat(0x9fe8ff);
    const dewStream = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.06, 0.1, 1, 8, 1, true)), dewStreamMat);
    placeBeam(dewStream, new THREE.Vector3(BLOOM_POS[0], CANOPY_Y + 2.2, BLOOM_POS[2]), new THREE.Vector3(BLOOM_POS[0], CANOPY_Y + 13, BLOOM_POS[2]));
    dewStream.visible = false;
    dewStream.raycast = () => {};
    root.add(dewStream);

    // The Bloom: collar, stem, closed petals, stamens.
    const collar = new THREE.Mesh(scope.track(new THREE.TorusGeometry(BLOOM_COLLAR, 0.35, 10, 40)), terracotta);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(BLOOM_POS[0], CANOPY_Y + 0.35, BLOOM_POS[2]);
    root.add(collar);
    collision.addBox([BLOOM_POS[0], CANOPY_Y + 0.6, BLOOM_POS[2]], [2.0, 0.6, 2.0]);
    const bloom = new THREE.Group();
    bloom.position.set(BLOOM_POS[0], CANOPY_Y, BLOOM_POS[2]);
    root.add(bloom);
    const bloomStem = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.35, 0.55, 1, 10)), fernMat);
    bloomStem.geometry.translate(0, 0.5, 0);
    bloom.add(bloomStem);
    const head = new THREE.Group();
    bloom.add(head);
    // Petal: a cupped blade (width tapers to a point, tip curls outward), base magenta to pale gold.
    const petalGeo = scope.track(new THREE.PlaneGeometry(1, 1, 6, 12));
    petalGeo.translate(0, 0.5, 0);
    const pp = petalGeo.getAttribute('position');
    for (let k = 0; k < pp.count; k++) {
      const y = pp.getY(k);
      const width = 0.84 * Math.pow(Math.sin(Math.PI * Math.min(1, y * 0.92 + 0.04)), 0.7);
      const x = pp.getX(k) * width;
      pp.setXYZ(k, x, y, y * y * 0.32 - Math.abs(x) * 0.25);
    }
    petalGeo.computeVertexNormals();
    paintVertices(petalGeo, (x, y, _z, out) => out.setHSL((0.9 + y * 0.17) % 1, 0.7 - y * 0.2, 0.34 + y * 0.36 + (1 - Math.abs(x) * 2) * 0.04));
    const petalMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, emissive: 0xff6aa0, emissiveIntensity: 0.06 }));
    const petals = Array.from({ length: PETALS }, (_, i) => {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / PETALS) * Math.PI * 2 + (i % 2 ? 0.12 : 0);
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.raycast = () => {};
      pivot.add(petal);
      head.add(pivot);
      return { pivot, petal, inner: i % 2 === 1 };
    });
    const stamenMat = glow(0xffe27a, 0.9);
    const stamens = new THREE.InstancedMesh(scope.track(new THREE.SphereGeometry(0.12, 8, 6)), stamenMat, 16);
    head.add(stamens);
    const orchidRingMat = glow(0x5fa8ff, 0);
    const orchidRing = new THREE.InstancedMesh(orchidPetalGeo, orchidRingMat, 10);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      orchidRing.setMatrixAt(k, mtx.compose(new THREE.Vector3(Math.cos(a) * 2.9, 0.4, Math.sin(a) * 2.9), q.identity(), new THREE.Vector3(1.6, 0.8, 1.6)));
    }
    orchidRing.visible = false;
    bloom.add(orchidRing);
    const bloomLight = new THREE.PointLight(0xffb0d0, 0, 40, 1.5);
    bloomLight.castShadow = false;
    bloom.add(bloomLight);

    const gate = new THREE.Group();
    gate.position.set(...GATE_POS);
    gate.rotation.y = Math.atan2(-(BLOOM_POS[0] - GATE_POS[0]), -(BLOOM_POS[2] - GATE_POS[2])) + Math.PI;
    const arch = new THREE.Mesh(scope.track(new THREE.TorusGeometry(1.5, 0.16, 8, 40, Math.PI)), fernMat);
    arch.position.y = 1.0;
    const gateVeilMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    const veil = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.4, 32, 0, Math.PI)), gateVeilMat);
    veil.position.y = 1.0;
    const archBlossoms = new THREE.InstancedMesh(orchidPetalGeo, glow(0xffd27a, 1.0), 9);
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI;
      archBlossoms.setMatrixAt(k, mtx.makeTranslation(Math.cos(a) * 1.5, 1.0 + Math.sin(a) * 1.5, 0));
    }
    const gatePosts = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.3, 1.0, 0.25)), fernMat);
    gatePosts.position.y = 0.5;
    gate.add(arch, veil, archBlossoms, gatePosts);
    gate.visible = false;
    root.add(gate);

    // ---- State.
    let mirrorTarget = -1;
    const checkpoints: string[] = [];
    let orchidFound = false;
    let canopyReached = false;
    let canopyTarget: CanopyTarget = 'ferns';
    let dewOn = false;
    let finaleStarted = false;
    let finaleProgress = 0;
    let completionEligible = false;
    let completeRequested = false;
    let fallResets = 0;
    let announcedArrival = false;
    let announcedPond = false;
    let time = 0;
    const reduced = () => ctx.reducedMotion();

    ctx.interaction.register('w05-sun-mirror', {
      object: sunMirror,
      label: () => (pond.complete ? 'Sun Mirror (all pads grown)' : mirrorTarget < 0 ? 'Turn the Sun Mirror' : `Turn the Sun Mirror (lighting pod ${mirrorTarget + 1})`),
      description: 'A mirror catching the skylight. Turning it sends light to the next seed pod in the pond.',
      activate: () => {
        mirrorTarget = (mirrorTarget + 1) % LILY_PADS.length;
        if (pond.light(mirrorTarget, reduced())) {
          ctx.announce(`Light falls on seed pod ${mirrorTarget + 1}. ${reduced() ? 'A lily pad has grown.' : 'A lily pad is growing.'}`, 6);
        } else {
          ctx.announce(`Seed pod ${mirrorTarget + 1} has already grown.`, 5);
        }
      },
    });
    ctx.interaction.register('w05-raft-valve', {
      object: cistern.valveObject,
      label: () => (cistern.target === 0 ? 'Open the Flood Valve' : 'Open the Drain Valve'),
      description: 'A valve on the leaf raft. Flooding the cistern lifts the raft to the Vine Gallery; draining lowers it.',
      activate: () => {
        const dir = cistern.toggle(reduced());
        ctx.announce(dir === 'rising' ? 'The cistern floods. The raft rises toward the Vine Gallery.' : 'The cistern drains. The raft sinks to the Fern Hall.', 6);
      },
    });
    ctx.interaction.register('w05-deck-call', {
      object: deckCall,
      label: () => (cistern.atBottom ? 'Raft Lever (raft is here)' : 'Call the Raft Down'),
      description: 'Drains the cistern so the leaf raft returns to the Fern Hall.',
      activate: () => {
        if (cistern.atBottom) return;
        cistern.call(reduced());
        ctx.announce('The cistern drains. The raft is coming down.', 5);
      },
    });
    ctx.interaction.register('w05-orchid', {
      object: orchid,
      label: () => (orchidFound ? 'Night Orchid Found' : 'Inspect the Night Orchid'),
      description: 'A blue orchid hidden behind the fern curtain. Optional: its light joins the Bloom.',
      activate: () => {
        if (orchidFound) return;
        orchidFound = true;
        ctx.announce('A night orchid, hidden behind the ferns. Its blue light will join the Bloom.', 6);
      },
    });
    ctx.interaction.register('w05-canopy-mirror', {
      object: canopyMirror,
      label: () => (finaleStarted ? 'Canopy Mirror' : `Turn the Canopy Mirror (now on ${TARGET_NAMES[canopyTarget]})`),
      description: 'A mirror on the canopy. The Bloom needs its light on the bud.',
      activate: () => {
        if (finaleStarted) return;
        canopyTarget = CANOPY_TARGETS[(CANOPY_TARGETS.indexOf(canopyTarget) + 1) % CANOPY_TARGETS.length];
        ctx.announce(canopyTarget === 'bud' ? 'The light falls on the bud.' : `The light falls on ${TARGET_NAMES[canopyTarget]}.`, 5);
      },
    });
    ctx.interaction.register('w05-dew-valve', {
      object: dewValve,
      label: () => (finaleStarted ? 'Dew Valve' : dewOn ? 'Close the Dew Valve' : 'Open the Dew Valve'),
      description: 'Lets dew fall from the vault onto the bud. The Bloom needs water as well as light.',
      activate: () => {
        if (finaleStarted) return;
        dewOn = !dewOn;
        ctx.announce(dewOn ? 'Dew falls onto the bud.' : 'The dew valve closes.', 5);
      },
    });
    ctx.interaction.register('w05-return-gate', {
      object: gate,
      label: () => (completionEligible ? 'Return to the Museum' : 'Vine Arch (closed)'),
      description: 'A vine arch that opens once the Bloom is open. It returns you to the rooftop conservatory.',
      activate: () => {
        if (!completionEligible || completeRequested) return;
        completeRequested = true;
        ctx.requestComplete();
      },
    });

    const onLanding = (def: Landing) => {
      const p = ctx.player.position;
      if (!ctx.player.grounded || Math.abs(p.y - def.y) > 0.35) return false;
      return def === ROUTE_CHECKPOINTS[2] ? inCanopy(p.x, p.z) : inRect(def, p.x, p.z);
    };

    const snapshot = (): W05Snapshot => ({
      mirrorTarget, padsLit: LILY_PADS.map((_, i) => pond.isLit(i)), padGrowth: pond.growth(), padsGrown: pond.grownCount,
      pondComplete: pond.complete, raftY: cistern.y, raftTarget: cistern.target, raftRiding: cistern.riding(),
      checkpoints: [...checkpoints], orchidFound, canopyReached, canopyTarget, dewOn,
      finaleStarted, finaleProgress, completionEligible, completeRequested, fallResets,
    });
    onReady?.({ getSnapshot: snapshot });

    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const tmpN = new THREE.Vector3();
    const aimMirror = (pivot: THREE.Group, origin: THREE.Vector3, sky: THREE.Vector3, target: THREE.Vector3 | null, instant: boolean) => {
      const toSky = tmpA.subVectors(sky, origin).normalize();
      const toTarget = target ? tmpB.subVectors(target, origin).normalize() : tmpB.set(0, 1, 0);
      tmpN.addVectors(toSky, toTarget).normalize();
      const goal = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmpN);
      const parentInv = pivot.parent!.quaternion.clone().invert();
      goal.premultiply(parentInv);
      if (instant) pivot.quaternion.copy(goal); else pivot.quaternion.slerp(goal, 0.08);
    };
    const pondMirrorOrigin = new THREE.Vector3(SUN_MIRROR_POS[0], 1.5, SUN_MIRROR_POS[2]);
    const pondSky = new THREE.Vector3(SUN_MIRROR_POS[0] - 3, SKYLIGHT_Y, SUN_MIRROR_POS[2] + 2);
    const canopyMirrorOrigin = new THREE.Vector3(CANOPY_MIRROR_POS[0], CANOPY_Y + 1.5, CANOPY_MIRROR_POS[2]);
    const canopySky = new THREE.Vector3(CANOPY_MIRROR_POS[0] - 3, SKYLIGHT_Y + 4, CANOPY_MIRROR_POS[2] + 2);
    const podPoint = new THREE.Vector3();
    const canopyPoint = new THREE.Vector3();
    const stamenM = new THREE.Matrix4();

    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      spawnPitch: 0,
      fog,
      background: new THREE.Color(0x06120f),
      fieldOfView: 70,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!announcedArrival) {
          announcedArrival = true;
          ctx.announce('The Impossible Greenhouse. Turn the Sun Mirror to light the seed pods in the pond.', 8);
        }
        pond.fixedUpdate(dt);
        cistern.fixedUpdate(dt);
        if (pond.complete && !announcedPond) {
          announcedPond = true;
          ctx.announce('All three lily pads have grown. Cross the pond to the Fern Hall.', 6);
        }
        const p = ctx.player.position;
        if (p.y < FALL_RESET_Y) {
          fallResets++;
          ctx.resetToCheckpoint();
          ctx.announce('The water lifts you gently back to solid ground.', 5);
          return;
        }
        for (const def of ROUTE_CHECKPOINTS) {
          if (checkpoints.includes(def.id) || !onLanding(def)) continue;
          checkpoints.push(def.id);
          ctx.saveCheckpoint();
          if (def === DECK) ctx.announce('The Fern Hall. Step onto the leaf raft and open its valve to flood the cistern.', 7);
          if (def === GALLERY) ctx.announce('The Vine Gallery. Climb the leaf ramp to the canopy.', 6);
          if (def === CANOPY) {
            canopyReached = true;
            ctx.announce('The Canopy. The bud needs light and water: aim the canopy mirror at it and open the dew valve.', 8);
          }
        }
        if (!finaleStarted && canopyReached && canopyTarget === 'bud' && dewOn) {
          finaleStarted = true;
          finaleProgress = reduced() ? 1 : 0;
          ctx.announce('Light and water together. The Impossible Bloom is waking.', 7);
        }
        if (finaleStarted && finaleProgress < 1) finaleProgress = Math.min(1, finaleProgress + dt / FINALE_SECONDS);
        if (finaleStarted && finaleProgress >= 1 && !completionEligible) {
          completionEligible = true;
          ctx.markCompletionEligible();
          gate.visible = true;
          ctx.announce('The Bloom is open and the glasshouse greets the dawn. The vine arch is open: step through to return to the museum.', 8);
        }
      },
      variableUpdate(dt) {
        time += dt;
        const r = reduced();
        const b = finaleProgress;
        const eb = b * b * (3 - 2 * b);
        pond.syncVisuals();
        cistern.syncVisuals(time, r);
        scenery.update(time, eb, r);

        // Act I light.
        const target = mirrorTarget >= 0 ? podPoint.set(LILY_PADS[mirrorTarget][0], 0.1, LILY_PADS[mirrorTarget][1]) : null;
        aimMirror(mirrorPivot, pondMirrorOrigin, pondSky, target, r);
        pondBeam.visible = target !== null && !pond.complete;
        if (target) placeBeam(pondBeam, pondMirrorOrigin, target);
        const growth = pond.growth();
        pods.forEach((pod, i) => {
          pod.visible = growth[i] < 1;
          podMats[i].emissiveIntensity = pond.isLit(i) ? 1.6 : 0.5 + (r ? 0 : 0.2 * Math.sin(time * 1.4 + i));
        });

        // Act III light and water.
        const [tx, ty, tz] = CANOPY_TARGET_POINTS[canopyTarget];
        canopyPoint.set(tx, ty, tz);
        aimMirror(cPivot, canopyMirrorOrigin, canopySky, canopyPoint, r);
        placeBeam(canopyBeam, canopyMirrorOrigin, canopyPoint);
        canopyBeam.visible = !completionEligible;
        dewStream.visible = dewOn && !completionEligible;
        if (dewStream.visible) dewStreamMat.opacity = 0.32 + (r ? 0 : 0.08 * Math.sin(time * 3));
        if (!r && dewOn && !finaleStarted) dewWheel.rotation.z = Math.min(dewWheel.rotation.z + dt * 2, Math.PI);

        // The Bloom: rises from the collar and opens high above the canopy.
        const rise = 1.2 + eb * 3.0;
        bloomStem.scale.y = rise;
        head.position.y = rise;
        const breathe = r || finaleStarted ? 0 : 0.03 * Math.sin(time * 0.8);
        petals.forEach(({ pivot, inner }) => {
          const petal = pivot.children[0] as THREE.Mesh;
          const closed = -0.18 + breathe, open = inner ? 0.95 : 1.2;
          petal.rotation.x = closed + (open - closed) * eb;
          petal.scale.setScalar((inner ? 2.0 : 2.3) + eb * (inner ? 3.6 : 4.4));
        });
        petalMat.emissiveIntensity = 0.06 + eb * 0.22 + (canopyTarget === 'bud' && !finaleStarted ? 0.12 : 0);
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          const rr = 0.25 + eb * 0.6;
          stamens.setMatrixAt(k, stamenM.makeTranslation(Math.cos(a) * rr, 0.4 + eb * (1.2 + (k % 3) * 0.4), Math.sin(a) * rr));
        }
        stamens.instanceMatrix.needsUpdate = true;
        stamenMat.emissiveIntensity = 0.9 + eb * 1.4;
        bloomLight.intensity = eb * 60;
        orchidRing.visible = orchidFound && finaleStarted;
        orchidRingMat.emissiveIntensity = eb * 2.0;
        orchidGlow.emissiveIntensity = 1.2 + (r ? 0 : 0.3 * Math.sin(time * 1.1));
        if (gate.visible && !r) gateVeilMat.opacity = 0.4 + 0.1 * Math.sin(time * 1.3);
      },
      dispose() {
        pond.dispose();
        cistern.dispose();
      },
    };
  };
}
