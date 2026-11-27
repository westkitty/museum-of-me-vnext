import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addLightRig, addPlatform, addRail, addWall, inRect, orientedWall, slabGeometry, type PocketPreviewHandle } from '../kit/worldKit';
import { buildW08Scenery } from './w08Drop';
import {
  BUBBLE_CRADLE, BUBBLE_RADIUS, BUBBLE_RIDE_RADIUS, BUBBLE_SPEED, BUBBLE_TOP_Y, CROWN, type Crystal, DROP_CENTRE, DROP_RADIUS,
  EXIT_POS, LENS_HEIGHT, LENSES, MENISCUS_RADIUS, NUCLEUS_POS, onMeniscus, onPad, PAD_DOCK_T1, PAD_DOCK_T2, PAD_HALF_X, PAD_HALF_Z,
  PAD_SPEED, PAD_X, PRISM_POS, RAILS, SEED_1, SEED_2, SET_SECONDS, SOFT_FALL_HEIGHT, SPAN, SPAWN, STAIR, STEMS, T1, T2, T3,
  TERRACES, type Vec3,
} from './w08Layout';

export type BubbleState = 'asleep' | 'waiting' | 'rising' | 'docked' | 'returning';

export interface W08Snapshot {
  readonly lensAims: readonly number[];
  readonly litTargets: readonly string[];
  readonly crystals: readonly string[];
  readonly padZ: number;
  readonly padMoving: boolean;
  readonly padCrossings: number;
  readonly onPad: boolean;
  readonly bubble: BubbleState;
  readonly bubbleY: number;
  readonly bubbleRides: number;
  readonly checkpoints: readonly string[];
  readonly prismLit: boolean;
  readonly optionalFound: boolean;
  readonly crownReached: boolean;
  readonly finaleStarted: boolean;
  readonly finaleProgress: number;
  readonly completionEligible: boolean;
  readonly completeRequested: boolean;
  readonly softFalls: number;
}

export interface W08PreviewHandle extends PocketPreviewHandle {
  getSnapshot(): W08Snapshot;
}

const FINALE_SECONDS = 12;
const PAD_BOARD_SECONDS = 0.6;
const PAD_CALL_SECONDS = 1;
const BUBBLE_BOARD_SECONDS = 0.8;
const BUBBLE_RETURN_SECONDS = 1.5;

const poreOf = (dir: Vec3): Vec3 => {
  const l = Math.hypot(...dir);
  return [DROP_CENTRE[0] + (dir[0] / l) * (DROP_RADIUS - 1), DROP_CENTRE[1] + (dir[1] / l) * (DROP_RADIUS - 1), DROP_CENTRE[2] + (dir[2] / l) * (DROP_RADIUS - 1)];
};

/**
 * W08 World Inside a Raindrop.
 *
 * Act I (the Meniscus): turn the first water lens until the sunlight from a
 * pore in the drop's skin falls on the glass seed; the seed sets into the
 * Glass Stair up to the Glass Terrace. Act II (the Drift): a flattened water
 * sphere carries the visitor across to the Drift Terrace, where a second lens
 * sets the Glass Span up to the Bubble Terrace. Act III (the Bubble): a third
 * lens warms a sleeping air bubble; it carries the visitor up to the Crown,
 * where the mote of dust at the drop's heart lets the raindrop fall and
 * splash into the rill. Optional: the first lens can light a far prism whose
 * rainbow seed rides the splash. Nothing is timed and nothing needs a jump; a
 * long drop lands softly and returns the visitor to the last terrace.
 */
export function createW08WorldFactory(onReady?: (handle: W08PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W08 load aborted', 'AbortError');
    const { scope, root, collision } = ctx;
    const fog = new THREE.FogExp2(0x8cc4d4, 0.0032);
    const scenery = buildW08Scenery(ctx);
    addLightRig(ctx, { sky: 0xeaf8ff, ground: 0x2e6070, hemiIntensity: 1.15, sun: 0xfff0d4, sunIntensity: 1.5, sunPosition: poreOf(LENSES[0].poreDir) });

    const glass = scope.track(new THREE.MeshStandardMaterial({ color: 0x9cd6ea, transparent: true, opacity: 0.9, roughness: 0.08, metalness: 0.05, emissive: 0x1a6684, emissiveIntensity: 0.4 }));
    const edgeMat = scope.track(new THREE.LineBasicMaterial({ color: 0xe8fcff, transparent: true, opacity: 0.85 }));
    const water = scope.track(new THREE.MeshStandardMaterial({ color: 0xbfe9f6, transparent: true, opacity: 0.55, roughness: 0.05, emissive: 0x3c9ab8, emissiveIntensity: 0.3, depthWrite: false }));
    const glow = (hex: number, intensity = 1) => scope.track(new THREE.MeshStandardMaterial({ color: 0x1a2024, emissive: hex, emissiveIntensity: intensity }));
    const outline = (mesh: THREE.Mesh) => {
      const lines = new THREE.LineSegments(scope.track(new THREE.EdgesGeometry(mesh.geometry, 30)), edgeMat);
      lines.raycast = () => {};
      mesh.add(lines);
    };

    // ---- The meniscus: a disc floor inside a ring of rising water.
    collision.addMaskedFloor(DROP_CENTRE[0] - MENISCUS_RADIUS, DROP_CENTRE[0] + MENISCUS_RADIUS, DROP_CENTRE[2] - MENISCUS_RADIUS, DROP_CENTRE[2] + MENISCUS_RADIUS, 0, (x, z) => onMeniscus(x, z));
    const ringSegments = 40;
    for (let k = 0; k < ringSegments; k++) {
      const a = ((k + 0.5) / ringSegments) * Math.PI * 2;
      const r = MENISCUS_RADIUS + 0.35;
      const half = (Math.PI * 2 * r) / ringSegments / 2 + 0.2;
      collision.add(orientedWall(DROP_CENTRE[0] + Math.cos(a) * r, DROP_CENTRE[2] + Math.sin(a) * r, 0.4, half, -a, -2, 40));
    }

    // ---- Terraces of liquid glass on water stems.
    for (const t of TERRACES) outline(addPlatform(ctx, glass, { ...t, depth: 0.6 }));
    const stemMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xb4e4f2, transparent: true, opacity: 0.5, roughness: 0.05, emissive: 0x3a90ac, emissiveIntensity: 0.25, depthWrite: false }));
    for (const s of STEMS) {
      const stem = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(s.r * 0.8, s.r * 1.25, s.top, 18, 1, true)), stemMat);
      stem.position.set(s.x, s.top / 2, s.z);
      stem.raycast = () => {};
      root.add(stem);
      addWall(ctx, s.x - s.r * 0.8, s.x + s.r * 0.8, -1, s.top, s.z - s.r * 0.8, s.z + s.r * 0.8);
    }
    for (const r of RAILS) addRail(ctx, r.x0, r.z0, r.x1, r.z1, r.y);
    const railMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xe6f8ff, transparent: true, opacity: 0.6, roughness: 0.1, emissive: 0x6ac0d8, emissiveIntensity: 0.4 }));
    for (const r of RAILS) {
      const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
      // A glass handrail: a bar along the segment, laid along the holder's local z.
      const bar = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.07, 0.07, len, 8)), railMat);
      bar.rotation.x = Math.PI / 2;
      const holder = new THREE.Group();
      holder.add(bar);
      holder.position.set((r.x0 + r.x1) / 2, r.y + 1.0, (r.z0 + r.z1) / 2);
      holder.rotation.y = Math.atan2(r.x1 - r.x0, r.z1 - r.z0);
      root.add(holder);
    }

    // ---- Glass seeds and the walkways they set into.
    const ghostMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xe8fbff, wireframe: true, transparent: true, opacity: 0.16, depthWrite: false }));
    const crystalMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0, roughness: 0.06, emissive: 0x58c4e4, emissiveIntensity: 1.2 }));
    const crystalMats = new Map<string, THREE.MeshStandardMaterial>();
    const crystalGhosts = new Map<string, THREE.Mesh>();
    const crystalMeshes = new Map<string, THREE.Mesh>();
    for (const c of [STAIR, SPAN]) {
      const geo = scope.track(slabGeometry(c.rect, c.axis, c.yAtMin, c.yAtMax, 0.35));
      const ghost = new THREE.Mesh(geo, ghostMat);
      ghost.raycast = () => {};
      root.add(ghost);
      crystalGhosts.set(c.id, ghost);
      const mat = scope.track(crystalMat.clone());
      crystalMats.set(c.id, mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.raycast = () => {};
      outline(mesh);
      root.add(mesh);
      crystalMeshes.set(c.id, mesh);
    }
    const seedGeo = scope.track(new THREE.OctahedronGeometry(0.3, 0));
    const seeds = new Map<string, { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }>();
    for (const [id, pos] of [['stair', SEED_1], ['span', SEED_2]] as const) {
      const mat = glow(0x8fe6ff, 0.5);
      const mesh = new THREE.Mesh(seedGeo, mat);
      mesh.position.set(...pos);
      mesh.scale.set(1, 1.6, 1);
      root.add(mesh);
      seeds.set(id, { mesh, mat });
    }

    // ---- Water lenses, their sun pores and their beams.
    const beamGeo = scope.track(new THREE.CylinderGeometry(0.06, 0.06, 1, 10, 1, true));
    beamGeo.translate(0, 0.5, 0);
    const beamMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending }));
    const hitMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffe8b0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    const hitGeo = scope.track(new THREE.SphereGeometry(0.32, 14, 10));
    const yAxis = new THREE.Vector3(0, 1, 0);
    const placeBeam = (mesh: THREE.Mesh, from: Vec3, to: Vec3) => {
      const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      const len = d.length();
      mesh.position.set(...from);
      mesh.quaternion.setFromUnitVectors(yAxis, d.normalize());
      mesh.scale.set(1, len, 1);
    };
    const lensAims = LENSES.map(() => 0);
    const lensRings: THREE.Mesh[] = [];
    const lensBeams: THREE.Mesh[] = [];
    const lensHits: THREE.Mesh[] = [];
    const lensGroups: THREE.Group[] = [];
    const lensCentre = (i: number): Vec3 => [LENSES[i].pos[0], LENSES[i].pos[1] + LENS_HEIGHT, LENSES[i].pos[2]];
    LENSES.forEach((lens, i) => {
      const g = new THREE.Group();
      g.position.set(...lens.pos);
      const pedestal = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.28, 0.42, 0.95, 16)), glass);
      pedestal.position.y = 0.475;
      const sphere = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.5, 28, 18)), water);
      sphere.position.y = LENS_HEIGHT;
      g.add(pedestal, sphere);
      root.add(g);
      lensGroups.push(g);
      const ring = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.62, 0.045, 8, 36)), glow(0xffe6a8, 0.8));
      ring.position.set(...lensCentre(i));
      root.add(ring);
      lensRings.push(ring);
      addWall(ctx, lens.pos[0] - 0.45, lens.pos[0] + 0.45, lens.pos[1] - 0.6, lens.pos[1] + 2.1, lens.pos[2] - 0.45, lens.pos[2] + 0.45);
      const pore = poreOf(lens.poreDir);
      const poreMesh = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.6, 28)), scope.track(new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false })));
      poreMesh.position.set(...pore);
      poreMesh.lookAt(DROP_CENTRE[0], DROP_CENTRE[1], DROP_CENTRE[2]);
      poreMesh.raycast = () => {};
      root.add(poreMesh);
      const inBeam = new THREE.Mesh(beamGeo, beamMat);
      placeBeam(inBeam, pore, lensCentre(i));
      inBeam.raycast = () => {};
      root.add(inBeam);
      const outBeam = new THREE.Mesh(beamGeo, beamMat);
      outBeam.raycast = () => {};
      root.add(outBeam);
      lensBeams.push(outBeam);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.raycast = () => {};
      root.add(hit);
      lensHits.push(hit);
    });
    const aimOf = (i: number) => LENSES[i].aims[lensAims[i]];
    const applyAims = () => {
      LENSES.forEach((_, i) => {
        const target = aimOf(i).target;
        placeBeam(lensBeams[i], lensCentre(i), target);
        lensHits[i].position.set(...target);
        lensRings[i].lookAt(target[0], target[1], target[2]);
      });
    };
    applyAims();

    // ---- The optional prism and its rainbow seed.
    const prism = new THREE.Group();
    prism.position.set(...PRISM_POS);
    const prismBody = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 3)), glass);
    prismBody.position.y = 0.7;
    outline(prismBody);
    const rainbowSeedMat = glow(0xffc8f0, 0.4);
    const rainbowSeed = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.2, 0)), rainbowSeedMat);
    rainbowSeed.position.y = 1.65;
    prism.add(prismBody, rainbowSeed);
    root.add(prism);
    addWall(ctx, PRISM_POS[0] - 0.5, PRISM_POS[0] + 0.5, -0.6, 1.5, PRISM_POS[2] - 0.5, PRISM_POS[2] + 0.5);
    const rainbow = new THREE.Group();
    // Across the meniscus from the prism, so it reads as an arc rather than a wall of light.
    rainbow.position.set(PRISM_POS[0] - 9, 0, PRISM_POS[2] - 8);
    rainbow.rotation.y = 0.35;
    [0xe8402e, 0xf08a28, 0xf2d040, 0x4cb85a, 0x3a7ee0, 0x7a52d0].forEach((hex, k) => {
      const arc = new THREE.Mesh(
        scope.track(new THREE.TorusGeometry(9.4 - k * 0.36, 0.18, 6, 72, Math.PI)),
        scope.track(new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.62, depthWrite: false })),
      );
      arc.raycast = () => {};
      rainbow.add(arc);
    });
    rainbow.visible = false;
    root.add(rainbow);

    // ---- The drift pad (a flattened water sphere).
    const padShape = new THREE.Shape();
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const x = Math.sign(c) * Math.abs(c) ** 0.5 * PAD_HALF_X;
      const y = Math.sign(s) * Math.abs(s) ** 0.5 * PAD_HALF_Z;
      if (k === 0) padShape.moveTo(x, y);
      else padShape.lineTo(x, y);
    }
    const padGeo = scope.track(new THREE.ExtrudeGeometry(padShape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 3 }));
    padGeo.rotateX(Math.PI / 2);
    const padMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xc8f0fc, transparent: true, opacity: 0.8, roughness: 0.05, emissive: 0x3aa0c0, emissiveIntensity: 0.4 }));
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.raycast = () => {};
    outline(pad);
    const padBelly = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), water);
    padBelly.scale.set(PAD_HALF_X * 1.05, 1.1, PAD_HALF_Z * 1.05);
    padBelly.position.y = -0.1;
    padBelly.raycast = () => {};
    const padGroup = new THREE.Group();
    padGroup.add(pad, padBelly);
    root.add(padGroup);

    // ---- The sleeping bubble in its cradle.
    const cradle = new THREE.Mesh(scope.track(new THREE.TorusGeometry(BUBBLE_RADIUS + 0.2, 0.16, 8, 48)), glass);
    cradle.rotation.x = Math.PI / 2;
    cradle.position.set(BUBBLE_CRADLE[0], T3.y + 0.12, BUBBLE_CRADLE[2]);
    root.add(cradle);
    const bubbleMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xeefcff, transparent: true, opacity: 0.12, roughness: 0.04, emissive: 0x8fd8f0, emissiveIntensity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    const bubbleGroup = new THREE.Group();
    const bubbleShell = new THREE.Mesh(scope.track(new THREE.SphereGeometry(BUBBLE_RADIUS, 36, 24)), bubbleMat);
    bubbleShell.position.y = BUBBLE_RADIUS * 0.82;
    const bubbleFloor = new THREE.Mesh(scope.track(new THREE.CircleGeometry(BUBBLE_RIDE_RADIUS + 0.3, 36)), water);
    bubbleFloor.rotation.x = -Math.PI / 2;
    bubbleFloor.position.y = 0.03;
    bubbleGroup.add(bubbleShell, bubbleFloor);
    bubbleShell.raycast = () => {};
    bubbleFloor.raycast = () => {};
    root.add(bubbleGroup);

    // ---- The Crown: the mote of dust at the drop's heart and the surface ring.
    const nucleus = new THREE.Group();
    nucleus.position.set(...NUCLEUS_POS);
    const nucleusMat = glow(0xffe2b0, 0.9);
    const mote = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.28, 2)), nucleusMat);
    mote.position.y = 1.4;
    const plinth = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.35, 0.5, 0.9, 16)), glass);
    plinth.position.y = 0.45;
    nucleus.add(plinth, mote);
    root.add(nucleus);
    addWall(ctx, NUCLEUS_POS[0] - 0.5, NUCLEUS_POS[0] + 0.5, CROWN.y - 0.6, CROWN.y + 2, NUCLEUS_POS[2] - 0.5, NUCLEUS_POS[2] + 0.5);
    const exitGate = new THREE.Group();
    exitGate.position.set(...EXIT_POS);
    exitGate.rotation.y = Math.PI / 2;
    const exitRing = new THREE.Mesh(scope.track(new THREE.TorusGeometry(1.3, 0.16, 10, 48)), glow(0x9fe8ff, 0.9));
    exitRing.position.y = 1.5;
    const exitVeilMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
    const exitVeil = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.25, 40)), exitVeilMat);
    exitVeil.position.y = 1.5;
    exitGate.add(exitRing, exitVeil);
    exitGate.visible = false;
    root.add(exitGate);

    // ---- State.
    const checkpoints: string[] = [];
    const crystals = new Set<string>();
    const crystalAge = new Map<string, number>();
    const litTime = new Map<string, number>();
    let padZ = PAD_DOCK_T1;
    let padTarget: number | null = null;
    let padWait = 0;
    let padCrossings = 0;
    let onPadNow = false;
    /** After a crossing the rider must step off before the pad will carry them again. */
    let padRiderArrived = false;
    let bubble: BubbleState = 'asleep';
    let bubbleY = T3.y;
    let bubbleWait = 0;
    let bubbleRides = 0;
    let optionalFound = false;
    let prismAnnounced = false;
    let crownReached = false;
    let finaleStarted = false;
    let finaleProgress = 0;
    let completionEligible = false;
    let completeRequested = false;
    let softFalls = 0;
    let airborneTop: number | null = null;
    let announcedArrival = false;
    let time = 0;
    const reduced = () => ctx.reducedMotion();
    const lit = (hits: string) => LENSES.some((_, i) => aimOf(i).hits === hits);
    const riding = () => {
      const p = ctx.player.position;
      return Math.hypot(p.x - BUBBLE_CRADLE[0], p.z - BUBBLE_CRADLE[2]) <= BUBBLE_RIDE_RADIUS + 0.05 && Math.abs(p.y - bubbleY) < 0.3;
    };

    const setCrystal = (c: Crystal) => {
      if (crystals.has(c.id)) return;
      crystals.add(c.id);
      crystalAge.set(c.id, reduced() ? 10 : 0);
      collision.add({ kind: 'ramp', ...c.rect, axis: c.axis, yAtMin: c.yAtMin, yAtMax: c.yAtMax });
      const lo = Math.min(c.yAtMin, c.yAtMax) - 0.6;
      const hi = Math.max(c.yAtMin, c.yAtMax) + 1.1;
      addWall(ctx, c.rect.minX, c.rect.maxX, lo, hi, c.rect.minZ - 0.3, c.rect.minZ);
      addWall(ctx, c.rect.minX, c.rect.maxX, lo, hi, c.rect.maxZ, c.rect.maxZ + 0.3);
      crystalGhosts.get(c.id)!.visible = false;
      crystalMeshes.get(c.id)!.visible = true;
      ctx.announce(c.id === 'stair'
        ? 'The light sets the seed into a glass stair. Climb it to the Glass Terrace.'
        : 'A glass span sets in the light, rising to the Bubble Terrace.', 7);
    };

    const updatePadFloor = () => {
      collision.setDynamicFloor('w08-pad', {
        kind: 'floor', minX: PAD_X - PAD_HALF_X, maxX: PAD_X + PAD_HALF_X, minZ: padZ - PAD_HALF_Z, maxZ: padZ + PAD_HALF_Z, y: T1.y,
        contains: (x, z) => onPad(padZ, x, z),
      });
    };
    const updateBubbleFloor = () => {
      const r = BUBBLE_RIDE_RADIUS + 0.3;
      collision.setDynamicFloor('w08-bubble', bubble === 'asleep' ? null : {
        kind: 'floor', minX: BUBBLE_CRADLE[0] - r, maxX: BUBBLE_CRADLE[0] + r, minZ: BUBBLE_CRADLE[2] - r, maxZ: BUBBLE_CRADLE[2] + r, y: bubbleY,
        contains: (x, z) => Math.hypot(x - BUBBLE_CRADLE[0], z - BUBBLE_CRADLE[2]) <= r,
      });
    };
    updatePadFloor();
    updateBubbleFloor();

    // ---- Interactions.
    LENSES.forEach((lens, i) => {
      ctx.interaction.register(`w08-${lens.id}`, {
        object: lensGroups[i],
        label: () => `Turn the Water Lens (light on ${aimOf(i).name})`,
        description: 'A sphere of water on a glass stem. Turning it bends the sunlight from the pore in the drop\'s skin onto something new.',
        activate: () => {
          lensAims[i] = (lensAims[i] + 1) % lens.aims.length;
          applyAims();
          const hits = aimOf(i).hits;
          if (hits === 'dock') ctx.announce('The light pools on the drift dock. Nothing there can hold it.', 5);
          if (hits === 'pool') ctx.announce('The light pools harmlessly on the glass.', 4);
        },
      });
    });
    ctx.interaction.register('w08-rainbow-seed', {
      object: prism,
      label: () => (optionalFound ? 'Rainbow Seed Gathered' : lit('prism') ? 'Gather the Rainbow Seed' : 'A Dark Glass Prism'),
      description: 'A prism standing alone on the meniscus. In sunlight it splits the light into a rainbow and grows a rainbow seed.',
      activate: () => {
        if (optionalFound) return;
        if (!lit('prism')) {
          ctx.announce('The prism is dark. Perhaps a lens could send it some light.', 5);
          return;
        }
        optionalFound = true;
        ctx.announce('You gather the rainbow seed. It will ride the splash.', 6);
      },
    });
    ctx.interaction.register('w08-nucleus', {
      object: nucleus,
      label: () => (finaleStarted ? 'The Drop Is Falling' : crownReached ? 'Let the Raindrop Fall' : 'Mote of Dust'),
      description: 'Every raindrop forms around a mote of dust. Touching this one lets the drop go.',
      activate: () => {
        if (finaleStarted || !crownReached) return;
        finaleStarted = true;
        finaleProgress = reduced() ? 1 : 0;
        ctx.announce('The raindrop lets go and falls toward the rill.', 7);
      },
    });
    const exitHit = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.3, 24)), scope.track(new THREE.MeshBasicMaterial({ visible: false })));
    exitHit.position.y = 1.5;
    exitGate.add(exitHit);
    ctx.interaction.register('w08-exit', {
      object: exitGate,
      label: () => (completionEligible ? 'Return to the Museum' : 'Surface Ring (closed)'),
      description: 'A ring of rill water that opens after the splash. It returns you to the reflecting rill.',
      activate: () => {
        if (!completionEligible || completeRequested) return;
        completeRequested = true;
        ctx.requestComplete();
      },
    });

    const snapshot = (): W08Snapshot => ({
      lensAims: [...lensAims],
      litTargets: LENSES.map((_, i) => aimOf(i).hits),
      crystals: [...crystals],
      padZ, padMoving: padTarget !== null, padCrossings, onPad: onPadNow,
      bubble, bubbleY, bubbleRides,
      checkpoints: [...checkpoints], prismLit: lit('prism'), optionalFound, crownReached,
      finaleStarted, finaleProgress, completionEligible, completeRequested, softFalls,
    });
    onReady?.({ getSnapshot: snapshot });

    const terraceMessages: Record<string, string> = {
      'glass-terrace': 'The Glass Terrace. Stand on the drift pad: it carries you across to the next terrace.',
      'drift-terrace': 'The Drift Terrace. Another water lens waits here.',
      'bubble-terrace': 'The Bubble Terrace. Warm the sleeping bubble with light.',
      crown: 'The Crown. Touch the mote of dust at the heart of the drop: let the raindrop fall.',
    };

    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      spawnPitch: 0,
      fog,
      background: new THREE.Color(0x8cc4d4),
      fieldOfView: 72,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!announcedArrival) {
          announcedArrival = true;
          ctx.announce('World Inside a Raindrop. Turn the water lens to bend the sunlight onto the glass seed.', 8);
        }
        const player = ctx.player;
        const p = player.position;
        const r = reduced();

        // A very long drop (should never happen inside the meniscus ring).
        if (p.y < -6) {
          softFalls++;
          if (!ctx.resetToCheckpoint()) player.teleport([...SPAWN], 0);
          player.velocity.set(0, 0, 0);
          airborneTop = null;
          return;
        }

        // Soft landings: a drop of more than a storey returns the visitor to the last terrace.
        if (!player.grounded) airborneTop = Math.max(airborneTop ?? p.y, p.y);
        else if (airborneTop !== null) {
          const fell = airborneTop - p.y;
          airborneTop = null;
          if (fell > SOFT_FALL_HEIGHT && checkpoints.length > 0) {
            softFalls++;
            ctx.resetToCheckpoint();
            player.velocity.set(0, 0, 0);
            ctx.announce('Surface tension catches you and lifts you back to the last terrace.', 5);
            return;
          }
        }

        // Light: a seed sets after a moment in the beam.
        for (const hits of ['stair', 'span', 'prism', 'bubble']) {
          litTime.set(hits, lit(hits) ? (litTime.get(hits) ?? 0) + dt : 0);
        }
        if ((litTime.get('stair') ?? 0) >= SET_SECONDS) setCrystal(STAIR);
        if ((litTime.get('span') ?? 0) >= SET_SECONDS) setCrystal(SPAN);
        if (lit('prism') && !prismAnnounced) {
          prismAnnounced = true;
          ctx.announce('The prism splits the light: a rainbow arcs over the meniscus, and a rainbow seed glimmers on the prism.', 7);
        }
        if (bubble === 'asleep' && (litTime.get('bubble') ?? 0) >= 1.2) {
          bubble = 'waiting';
          ctx.announce('The warmed bubble trembles free of its cradle. Step inside it to rise.', 7);
        }

        // The drift pad comes to the visitor's side, and crosses when they stand on it.
        onPadNow = player.grounded && Math.abs(p.y - T1.y) < 0.1 && onPad(padZ, p.x, p.z);
        if (padTarget === null) {
          const docked = padZ === PAD_DOCK_T1 ? PAD_DOCK_T1 : PAD_DOCK_T2;
          const other = docked === PAD_DOCK_T1 ? PAD_DOCK_T2 : PAD_DOCK_T1;
          const onT2 = inRect(T2, p.x, p.z) && p.y > 3;
          const westSide = (inRect(T1, p.x, p.z) && p.y > 3) || p.y < 1;
          const wanted = onT2 ? PAD_DOCK_T2 : westSide ? PAD_DOCK_T1 : null;
          if (!onPadNow) padRiderArrived = false;
          if (onPadNow && padRiderArrived) padWait = 0;
          else if (onPadNow) {
            padWait += dt;
            if (padWait >= PAD_BOARD_SECONDS) {
              padTarget = other;
              padWait = 0;
            }
          } else if (wanted !== null && wanted !== docked) {
            padWait += dt;
            if (padWait >= PAD_CALL_SECONDS) {
              padTarget = wanted;
              padWait = 0;
            }
          } else padWait = 0;
        }
        if (padTarget !== null) {
          const remaining = padTarget - padZ;
          const stepZ = r ? remaining : Math.sign(remaining) * Math.min(Math.abs(remaining), PAD_SPEED * dt);
          padZ += stepZ;
          if (onPadNow) p.z += stepZ;
          if (padZ === padTarget) {
            if (onPadNow) {
              padCrossings++;
              padRiderArrived = true;
            }
            padTarget = null;
          }
        }
        updatePadFloor();

        // The bubble.
        const inBubble = riding();
        if (bubble === 'waiting') {
          bubbleWait = inBubble && player.grounded ? bubbleWait + dt : 0;
          if (bubbleWait >= BUBBLE_BOARD_SECONDS) {
            bubbleWait = 0;
            bubble = 'rising';
            bubbleRides++;
            ctx.announce('The bubble rises toward the crown of the drop.', 5);
          }
        }
        if (bubble === 'rising') {
          bubbleY = r ? BUBBLE_TOP_Y : Math.min(BUBBLE_TOP_Y, bubbleY + BUBBLE_SPEED * dt);
          // The rider stays inside the bubble's membrane and on its floor.
          const dx = p.x - BUBBLE_CRADLE[0], dz = p.z - BUBBLE_CRADLE[2];
          const d = Math.hypot(dx, dz);
          if (d > BUBBLE_RIDE_RADIUS) {
            p.x = BUBBLE_CRADLE[0] + (dx / d) * BUBBLE_RIDE_RADIUS;
            p.z = BUBBLE_CRADLE[2] + (dz / d) * BUBBLE_RIDE_RADIUS;
          }
          if (p.y < bubbleY) {
            p.y = bubbleY;
            if (player.velocity.y < 0) player.velocity.y = 0;
          }
          if (r) player.restorePose([p.x, bubbleY, p.z], player.yaw, player.pitch);
          if (bubbleY >= BUBBLE_TOP_Y) {
            bubble = 'docked';
            ctx.announce('The bubble docks at the Crown. Step out onto the glass.', 5);
          }
        } else if (bubble === 'docked') {
          const below = player.grounded && !inBubble && p.y < BUBBLE_TOP_Y - 4;
          bubbleWait = below ? bubbleWait + dt : 0;
          if (bubbleWait >= BUBBLE_RETURN_SECONDS) {
            bubbleWait = 0;
            bubble = 'returning';
          }
        } else if (bubble === 'returning') {
          bubbleY = r ? T3.y : Math.max(T3.y, bubbleY - BUBBLE_SPEED * 2 * dt);
          if (bubbleY <= T3.y) bubble = 'waiting';
        }
        updateBubbleFloor();

        // Checkpoints on each terrace.
        for (const t of TERRACES) {
          if (checkpoints.includes(t.id)) continue;
          if (!player.grounded || !inRect(t, p.x, p.z) || Math.abs(p.y - t.y) > 0.3) continue;
          checkpoints.push(t.id);
          ctx.saveCheckpoint();
          if (t.id === 'crown') crownReached = true;
          ctx.announce(terraceMessages[t.id], 7);
        }

        // The fall and the splash.
        if (finaleStarted && finaleProgress < 1) finaleProgress = Math.min(1, finaleProgress + dt / FINALE_SECONDS);
        if (finaleStarted && finaleProgress >= 1 && !completionEligible) {
          completionEligible = true;
          ctx.markCompletionEligible();
          exitGate.visible = true;
          ctx.announce('Splash. The raindrop joins the rill. A surface ring opens on the Crown: step through to return to the museum.', 8);
        }
      },
      variableUpdate(dt) {
        time += dt;
        const r = reduced();
        scenery.update(time, finaleProgress, optionalFound, r);
        padGroup.position.set(PAD_X, T1.y - 0.12, padZ);
        bubbleGroup.position.set(BUBBLE_CRADLE[0], bubbleY, BUBBLE_CRADLE[2]);
        bubbleMat.opacity = bubble === 'asleep' ? 0.1 : 0.2 + (r ? 0 : 0.04 * Math.sin(time * 2.2));
        bubbleMat.emissiveIntensity = bubble === 'asleep' ? 0.06 : 0.28 + (r ? 0 : 0.08 * Math.sin(time * 1.7));
        for (const [id, age] of crystalAge) {
          const next = age + dt;
          crystalAge.set(id, next);
          const k = Math.min(1, next / 1.5);
          const mat = crystalMats.get(id)!;
          mat.opacity = 0.86 * k;
          mat.emissiveIntensity = 0.32 + 0.6 * (1 - k);
        }
        for (const [id, s] of seeds) {
          const set = crystals.has(id);
          const beam = lit(id);
          s.mat.emissiveIntensity = set ? 0.35 : beam ? 1.6 : 0.5 + (r ? 0 : 0.15 * Math.sin(time * 2));
          if (!r && !set) s.mesh.rotation.y = time * 0.8;
        }
        rainbow.visible = lit('prism') || optionalFound;
        rainbowSeed.visible = !optionalFound;
        rainbowSeedMat.emissiveIntensity = lit('prism') ? 1.4 : 0.3;
        if (!r) {
          mote.rotation.y = time * 0.5;
          mote.rotation.x = time * 0.3;
          lensHits.forEach((h, i) => h.scale.setScalar(1 + 0.12 * Math.sin(time * 3 + i)));
        }
        nucleusMat.emissiveIntensity = crownReached && !finaleStarted ? 1.2 + (r ? 0 : 0.3 * Math.sin(time * 2)) : 0.8;
        if (exitGate.visible && !r) exitVeilMat.opacity = 0.35 + 0.08 * Math.sin(time * 1.5);
        // Calm, deepening fog as the drop merges with the rill (no flash).
        const merge = finaleProgress <= 0.6 ? 0 : (finaleProgress - 0.6) / 0.4;
        fog.color.setRGB(0.66 - 0.28 * merge, 0.83 - 0.25 * merge, 0.88 - 0.24 * merge);
      },
      dispose() {
        collision.setDynamicFloor('w08-pad', null);
        collision.setDynamicFloor('w08-bubble', null);
      },
    };
  };
}
