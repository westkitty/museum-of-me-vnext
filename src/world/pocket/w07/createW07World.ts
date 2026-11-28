import * as THREE from 'three';
import { INTERACTION_ONLY_LAYER, INTERACTION_REACH } from '../../../interaction/InteractionManager';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addLightRig, type PocketPreviewHandle } from '../kit/worldKit';
import { buildLab, labMaterials, portalVisual, wallButton, worldBox } from './w07Lab';
import { createPortalSystem, shotTarget } from './w07Portals';
import {
  A_FAR, B_DOOR, B_GALLERY, BLOCK_HALF, CORE_POS, DISPENSER_POS, FOYER_GATE, GATE_POS, inRect, LEDGE, LEDGE_Y, NET_Y,
  type Panel, PLATE_POS, PLATE_RADIUS, PROTOTYPE_POS, RESET_A_POS, RESET_B_POS, RESET_C_POS, SHAFT, SHAFT_FLOOR_Y,
  SLINGSHOT_POS, SPAWN, type ZoneId, zoneAt,
} from './w07Layout';

export interface W07Snapshot {
  readonly hasSlingshot: boolean;
  readonly gateOpen: boolean;
  readonly zone: ZoneId | null;
  readonly portals: readonly { panel: string; colour: string }[];
  readonly linked: boolean;
  readonly aimPanel: string | null;
  readonly shots: number;
  readonly invalidShots: number;
  readonly transits: number;
  readonly flings: number;
  readonly flying: boolean;
  readonly blockCarried: boolean;
  readonly blockPos: readonly [number, number, number];
  readonly blockReturns: number;
  readonly plateLatched: boolean;
  readonly doorBOpen: boolean;
  readonly roomsCleared: readonly string[];
  readonly checkpoints: readonly string[];
  readonly optionalFound: boolean;
  readonly ledgeReached: boolean;
  readonly finaleStarted: boolean;
  readonly finaleProgress: number;
  readonly completionEligible: boolean;
  readonly completeRequested: boolean;
  readonly netResets: number;
}

export interface W07PreviewHandle extends PocketPreviewHandle {
  getSnapshot(): W07Snapshot;
}

const FINALE_SECONDS = 8;
const AMBER = 0xffa030;
const TEAL = 0x2ad4d4;
const PROXY_DISTANCE = 3.4;

/** A Y-frame slingshot with a band (the lab's tool: never a gun). */
function slingshotModel(ctx: PocketWorldContext, wood: THREE.Material, band: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const cyl = (r: number, h: number) => ctx.scope.track(new THREE.CylinderGeometry(r, r * 1.1, h, 8));
  const handle = new THREE.Mesh(cyl(0.035, 0.32), wood);
  handle.position.y = 0.16;
  const armL = new THREE.Mesh(cyl(0.028, 0.26), wood);
  armL.position.set(-0.07, 0.42, 0);
  armL.rotation.z = 0.5;
  const armR = armL.clone();
  armR.position.x = 0.07;
  armR.rotation.z = -0.5;
  const strap = new THREE.Mesh(ctx.scope.track(new THREE.BoxGeometry(0.3, 0.025, 0.02)), band);
  strap.position.set(0, 0.52, 0.02);
  const pouch = new THREE.Mesh(ctx.scope.track(new THREE.SphereGeometry(0.035, 10, 8)), band);
  pouch.position.set(0, 0.52, 0.05);
  g.add(handle, armL, armR, strap, pouch);
  return g;
}

/**
 * W07 Portal Slingshot Trials.
 *
 * Act I: take the Portal Slingshot; in Chamber One, put portals on the two
 * white panels either side of the calibration glass and walk through.
 * Act II: in Chamber Two, carry the weighted block through the portals to the
 * plate behind the glass; the plate locks the north door open.
 * Act III: in Chamber Three, link the drop-shaft floor with the high panel on
 * the pylon, walk off the drop line, and the fall's speed carries you out of
 * the pylon across the gap to the calibration ledge. Start the Calibration
 * Core: every panel in the lab lights; the exit portal opens home.
 * Optional: a third panel through Chamber One's closet window leads to the
 * first prototype slingshot. Nothing is timed; misses return you gently.
 */
export function createW07WorldFactory(onReady?: (handle: W07PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W07 load aborted', 'AbortError');
    const { scope, root, collision, player } = ctx;
    const reduced = () => ctx.reducedMotion();
    const fog = new THREE.FogExp2(0x1c2228, 0.012);
    addLightRig(ctx, { sky: 0xe8f0ff, ground: 0x404850, hemiIntensity: 1.25, sun: 0xf4f8ff, sunIntensity: 1.1, sunPosition: [20, 60, 30] });
    const mats = labMaterials(ctx);

    // ---- Portals (logic first: the shaft floor asks it whether it is open).
    let announcedFling = false;
    const portals = createPortalSystem(player, collision, (e) => {
      if (e.to.id === 'C2' && e.speed < 12 && !announcedFling) {
        announcedFling = true;
        ctx.announce('Too slow to cross. A long fall carries more speed through a portal.', 7);
      }
    });
    const lab = buildLab(ctx, mats, () => portals.floorOpen('C1'));

    const wood = scope.track(new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.7 }));
    const band = scope.track(new THREE.MeshStandardMaterial({ color: 0x30d0d0, emissive: 0x1aa0a0, emissiveIntensity: 0.6, roughness: 0.5 }));
    const glowMat = (hex: number, i = 1) => scope.track(new THREE.MeshStandardMaterial({ color: 0x15181c, emissive: hex, emissiveIntensity: i, roughness: 0.4 }));

    // ---- Foyer: slingshot stand and the gate into Chamber One.
    const stand = new THREE.Group();
    stand.position.set(SLINGSHOT_POS[0], 0, SLINGSHOT_POS[2]);
    const pedestal = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.42, 0.5, 1.0, 20)), mats.metal);
    pedestal.position.y = 0.5;
    const pedestalTop = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 20)), mats.hazard);
    pedestalTop.position.y = 1.03;
    const slingshot = slingshotModel(ctx, wood, band);
    slingshot.position.y = 1.06;
    slingshot.rotation.y = 0.6;
    slingshot.scale.setScalar(1.6);
    stand.add(pedestal, pedestalTop, slingshot);
    root.add(stand);
    collision.addBox([SLINGSHOT_POS[0], 0.5, SLINGSHOT_POS[2]], [0.5, 0.6, 0.5]);
    const gateMesh = new THREE.Mesh(worldBox(scope, { ...FOYER_GATE, minY: 0, maxY: 5 }, 1.2), mats.hazard);
    root.add(gateMesh);
    const doorBMesh = new THREE.Mesh(worldBox(scope, { ...B_DOOR, minY: 0, maxY: 5 }, 1.2), mats.hazard);
    root.add(doorBMesh);
    // Scaffolding and crates: the lab is still under construction.
    for (const [x, z] of [[-6, 20], [-6, 28], [6, 28]] as const) {
      for (const dx of [0, 0.9]) {
        const pole = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.04, 0.04, 5.6, 6)), mats.metal);
        pole.position.set(x + (x < 0 ? dx : -dx), 2.8, z);
        pole.raycast = () => {};
        root.add(pole);
      }
    }
    for (const [x, z, s] of [[-5.6, 27.6, 0.8], [-4.7, 27.9, 0.6], [5.4, 19.6, 0.7]] as const) {
      const crate = new THREE.Mesh(scope.track(new THREE.BoxGeometry(s, s, s)), wood);
      crate.position.set(x, s / 2, z);
      root.add(crate);
      collision.addBox([x, s / 2, z], [s / 2, s / 2, s / 2]);
    }

    // ---- Closet: the first prototype (optional).
    const prototype = new THREE.Group();
    prototype.position.set(PROTOTYPE_POS[0], 0, PROTOTYPE_POS[2]);
    const plinth = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.7, 0.9, 0.7)), mats.metal);
    plinth.position.y = 0.45;
    const oldSling = slingshotModel(ctx, wood, scope.track(new THREE.MeshStandardMaterial({ color: 0xc89a40, emissive: 0x7a5010, emissiveIntensity: 0.4 })));
    oldSling.position.y = 0.92;
    oldSling.scale.setScalar(1.3);
    const dome = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), mats.glass);
    dome.position.y = 0.9;
    prototype.add(plinth, oldSling, dome);
    root.add(prototype);
    collision.addBox([PROTOTYPE_POS[0], 0.45, PROTOTYPE_POS[2]], [0.38, 0.5, 0.38]);

    // ---- Chamber Two: dispenser, weighted block, plate.
    const dispenser = new THREE.Group();
    dispenser.position.set(DISPENSER_POS[0], 0, DISPENSER_POS[2]);
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]] as const) {
      const leg = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6)), mats.metal);
      leg.position.set(dx, 1.6 + 1.6, dz);
      leg.raycast = () => {};
      dispenser.add(leg);
    }
    const hopper = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.4, 0.5, 1.4)), mats.hazard);
    hopper.position.y = 4.9;
    hopper.raycast = () => {};
    dispenser.add(hopper);
    root.add(dispenser);
    const blockGroup = new THREE.Group();
    const blockMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.55, metalness: 0.4 }));
    const blockMesh = new THREE.Mesh(scope.track(new THREE.BoxGeometry(BLOCK_HALF * 2, BLOCK_HALF * 2, BLOCK_HALF * 2)), blockMat);
    const blockBandMat = glowMat(TEAL, 0.9);
    const blockBand = new THREE.Mesh(scope.track(new THREE.BoxGeometry(BLOCK_HALF * 2.04, 0.12, BLOCK_HALF * 2.04)), blockBandMat);
    blockBand.raycast = () => {};
    blockGroup.add(blockMesh, blockBand);
    root.add(blockGroup);
    const plateMat = glowMat(0xd04030, 0.5);
    const plate = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(PLATE_RADIUS, PLATE_RADIUS + 0.1, 0.1, 32)), plateMat);
    plate.position.set(PLATE_POS[0], 0.05, PLATE_POS[2]);
    plate.raycast = () => {};
    root.add(plate);

    // ---- Chamber Three: calibration core and exit portal on the ledge.
    const core = new THREE.Group();
    core.position.set(CORE_POS[0], LEDGE_Y, CORE_POS[2]);
    const coreBase = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 24)), mats.metal);
    coreBase.position.y = 0.6;
    const coreOrbMat = glowMat(0x9fe8ff, 0.8);
    const coreOrb = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.45, 1)), coreOrbMat);
    coreOrb.position.y = 1.65;
    const coreRings = [AMBER, TEAL].map((c, i) => {
      const ring = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.75 + i * 0.18, 0.04, 8, 40)), glowMat(c, 1.2));
      ring.position.y = 1.65;
      ring.raycast = () => {};
      core.add(ring);
      return ring;
    });
    core.add(coreBase, coreOrb);
    root.add(core);
    collision.addBox([CORE_POS[0], LEDGE_Y + 0.8, CORE_POS[2]], [0.95, 0.9, 0.95]);
    const exitPortal = portalVisual(ctx, 0xffe7a0);
    exitPortal.group.position.set(GATE_POS[0], LEDGE_Y + 1.5, GATE_POS[2]);
    exitPortal.group.scale.set(1.1, 1.5, 1);
    const exitFrame = new THREE.Mesh(scope.track(new THREE.TorusGeometry(1.25, 0.12, 10, 48)), mats.metal);
    exitFrame.position.set(GATE_POS[0], LEDGE_Y + 1.5, GATE_POS[2] - 0.02);
    exitFrame.scale.set(1.05, 1.32, 1);
    root.add(exitFrame);
    // The interaction target: the frame plus an unrendered disc filling it (a ray through the ring's hole still meets the gate).
    const exitGate = new THREE.Group();
    const exitHit = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.2, 24)), scope.track(new THREE.MeshBasicMaterial({ visible: false })));
    exitHit.position.copy(exitFrame.position);
    exitHit.scale.copy(exitFrame.scale);
    exitGate.add(exitHit);
    root.add(exitGate);
    // Finale: little portal rings spiralling up around the core.
    const ringCount = 14;
    const ringGeo = scope.track(new THREE.TorusGeometry(0.32, 0.035, 6, 24));
    const finaleRings = [AMBER, TEAL, 0xffd870].map((c) => {
      const m = new THREE.InstancedMesh(ringGeo, glowMat(c, 1.6), ringCount);
      m.visible = false;
      m.raycast = () => {};
      root.add(m);
      return m;
    });

    // ---- Wall buttons.
    const resetA = wallButton(ctx, mats, RESET_A_POS, Math.PI);
    const resetB = wallButton(ctx, mats, RESET_B_POS, Math.PI);
    const resetC = wallButton(ctx, mats, RESET_C_POS, Math.PI);

    // ---- Portal visuals and the pellet.
    const amber = portalVisual(ctx, AMBER);
    const teal = portalVisual(ctx, TEAL);
    const pelletMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const pellet = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.07, 10, 8)), pelletMat);
    pellet.visible = false;
    pellet.raycast = () => {};
    root.add(pellet);
    const pelletFrom = new THREE.Vector3();
    const pelletTo = new THREE.Vector3();
    let pelletT = 1;
    const opening = new Map<string, number>();

    // ---- The slingshot's aim proxy: an interaction-only target held along the view ray.
    const proxy = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.35, 8, 6)), scope.track(new THREE.MeshBasicMaterial()));
    proxy.layers.set(INTERACTION_ONLY_LAYER);
    proxy.visible = false;
    root.add(proxy);

    // ---- State.
    let hasSlingshot = false;
    let blockCarried = false;
    const blockPos = new THREE.Vector3(DISPENSER_POS[0], BLOCK_HALF, DISPENSER_POS[2]);
    let blockReturns = 0;
    let plateLatched = false;
    let shots = 0;
    let invalidShots = 0;
    let zone: ZoneId | null = 'foyer';
    const roomsCleared: string[] = [];
    const checkpoints: string[] = [];
    let optionalFound = false;
    let ledgeReached = false;
    let finaleStarted = false;
    let finaleProgress = 0;
    let completionEligible = false;
    let completeRequested = false;
    let netResets = 0;
    let shaftStuck = 0;
    let announcedArrival = false;
    let time = 0;

    const applyGates = () => {
      collision.setDynamicWall('w07-foyer-gate', hasSlingshot ? null : { kind: 'wall', ...FOYER_GATE });
      collision.setDynamicWall('w07-door-b', plateLatched ? null : { kind: 'wall', ...B_DOOR });
      gateMesh.visible = !hasSlingshot;
      doorBMesh.visible = !plateLatched;
    };
    const applyBlock = () => {
      collision.setDynamicWall('w07-block', blockCarried ? null : {
        kind: 'wall', minX: blockPos.x - BLOCK_HALF, maxX: blockPos.x + BLOCK_HALF, minY: blockPos.y - BLOCK_HALF, maxY: blockPos.y + BLOCK_HALF,
        minZ: blockPos.z - BLOCK_HALF, maxZ: blockPos.z + BLOCK_HALF,
      });
    };
    applyGates();
    applyBlock();

    const returnBlock = (message?: string) => {
      blockCarried = false;
      blockPos.set(DISPENSER_POS[0], BLOCK_HALF, DISPENSER_POS[2]);
      blockReturns++;
      applyBlock();
      if (message) ctx.announce(message, 6);
    };
    const checkPlate = () => {
      if (plateLatched || blockCarried) return;
      if (!inRect(B_GALLERY, blockPos.x, blockPos.z)) return;
      if (Math.hypot(blockPos.x - PLATE_POS[0], blockPos.z - PLATE_POS[2]) > PLATE_RADIUS) return;
      plateLatched = true;
      if (!roomsCleared.includes('B')) roomsCleared.push('B');
      applyGates();
      ctx.announce('The plate locks down under the block. The north door is open.', 7);
    };
    const forwardFlat = () => {
      const f = player.forward;
      const l = Math.hypot(f.x, f.z) || 1;
      return [f.x / l, f.z / l] as const;
    };
    const setDownBlock = (): boolean => {
      const [fx, fz] = forwardFlat();
      for (const reach of [1.1, 0.8]) {
        const x = player.position.x + fx * reach, z = player.position.z + fz * reach;
        if (zoneAt(x, z) !== 'B') continue;
        const support = collision.supportHeight(x, z, player.position.y + 0.3);
        if (support === null || Math.abs(support - player.position.y) > 0.6) continue;
        const probe = { x, y: support, z };
        if (collision.resolveHorizontal(probe, BLOCK_HALF + 0.05, BLOCK_HALF * 2)) continue;
        blockCarried = false;
        blockPos.set(x, support + BLOCK_HALF, z);
        applyBlock();
        checkPlate();
        return true;
      }
      ctx.announce('No room to set the block down here.', 4);
      return false;
    };

    const nextColour = () => (portals.portals.length === 2 ? portals.portals.reduce((a, b) => (a.order < b.order ? a : b)).colour
      : portals.portals.some((p) => p.colour === 'amber') ? 'teal' : 'amber');
    const aimPanel = (): Panel | null => {
      if (!hasSlingshot || blockCarried) return null;
      const { eye, dir } = portals.aim();
      return shotTarget(eye, dir);
    };
    const fire = () => {
      const { eye, dir } = portals.aim();
      const target = shotTarget(eye, dir);
      shots++;
      pelletFrom.set(eye[0] + dir[0] * 0.6, eye[1] - 0.25, eye[2] + dir[2] * 0.6);
      if (!target) {
        invalidShots++;
        pelletTo.set(eye[0] + dir[0] * 10, eye[1] + dir[1] * 10, eye[2] + dir[2] * 10);
        pelletMat.color.setHex(0x9aa0a8);
        pelletT = reduced() ? 1 : 0;
        ctx.announce("That surface won't hold a portal. Aim at a white panel.", 4);
        return;
      }
      const colour = nextColour();
      const result = portals.place(target);
      pelletTo.set(target.centre[0], target.centre[1], target.centre[2]);
      pelletMat.color.setHex(colour === 'amber' ? AMBER : TEAL);
      pelletT = reduced() ? 1 : 0;
      if (result === 'placed') opening.set(target.id, reduced() ? 1 : 0);
      if (result === 'removed') ctx.announce('Portal closed.', 3);
      else if (portals.linked) ctx.announce('Portals linked. Walk into one to step out of the other.', 4);
    };

    // Buttons and props the slingshot defers to when they are on the view ray within reach.
    const raycaster = new THREE.Raycaster();
    raycaster.far = INTERACTION_REACH;
    type Control = { object: THREE.Object3D; label: () => string; activate: () => void };
    const controls: Control[] = [];
    const register = (id: string, c: Control & { description: string }) => {
      controls.push(c);
      ctx.interaction.register(id, c);
    };
    const isShown = (o: THREE.Object3D): boolean => {
      for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
      return true;
    };
    const nearControl = (): Control | null => {
      const { eye, dir } = portals.aim();
      raycaster.set(new THREE.Vector3(...eye), new THREE.Vector3(...dir));
      root.updateMatrixWorld();
      const hits = raycaster.intersectObjects(controls.filter((c) => isShown(c.object)).map((c) => c.object), true);
      for (const hit of hits) {
        let node: THREE.Object3D | null = hit.object;
        while (node) {
          const found = controls.find((c) => c.object === node);
          if (found) return found;
          node = node.parent;
        }
      }
      return null;
    };
    const slingshotAction = (): { label: string; run: () => void } => {
      if (blockCarried) return { label: 'Set Down the Block', run: () => { setDownBlock(); } };
      const near = nearControl();
      if (near) return { label: near.label(), run: near.activate };
      const target = aimPanel();
      if (!target) return { label: 'Portal Slingshot: aim at a white panel', run: fire };
      if (portals.portalOn(target.id)) return { label: 'Close the Portal on This Panel', run: fire };
      return { label: `Fire Portal Slingshot (${nextColour()})`, run: fire };
    };
    ctx.interaction.register('w07-slingshot', {
      object: proxy,
      label: () => slingshotAction().label,
      description: 'The Portal Slingshot. Aim at an approved white panel and fire to open a portal there; two portals link. Fire at an open portal to close it.',
      activate: () => { if (hasSlingshot) slingshotAction().run(); },
    });

    register('w07-slingshot-stand', {
      object: stand,
      label: () => (hasSlingshot ? 'Slingshot Stand (empty)' : 'Take the Portal Slingshot'),
      description: 'A stand holding the Portal Slingshot. It fires portals onto approved white panels only.',
      activate: () => {
        if (hasSlingshot) return;
        hasSlingshot = true;
        slingshot.visible = false;
        proxy.visible = true;
        applyGates();
        ctx.announce('You have the Portal Slingshot. It opens portals on white panels only; two portals link. The chamber door is open.', 8);
      },
    });
    register('w07-block', {
      object: blockMesh,
      label: () => (blockCarried ? 'Set Down the Block' : 'Pick Up the Weighted Block'),
      description: 'A weighted block. It is heavy enough to hold a pressure plate down; it can travel through portals with you.',
      activate: () => {
        if (blockCarried) { setDownBlock(); return; }
        blockCarried = true;
        applyBlock();
        ctx.announce('You carry the block. Walk through a portal and it comes with you.', 5);
      },
    });
    const resetLabel = (n: string) => () => `Reset Chamber ${n}`;
    register('w07-reset-a', {
      object: resetA.group, label: resetLabel('One'), description: 'Closes the portals in this chamber.',
      activate: () => { portals.clearAll(); ctx.announce('Chamber One reset.', 3); },
    });
    register('w07-reset-b', {
      object: resetB.group, label: resetLabel('Two'), description: 'Closes the portals and returns the block to its dispenser.',
      activate: () => { portals.clearAll(); returnBlock('Chamber Two reset. The block is back in its dispenser.'); },
    });
    register('w07-reset-c', {
      object: resetC.group, label: resetLabel('Three'), description: 'Closes the portals in this chamber.',
      activate: () => { portals.clearAll(); ctx.announce('Chamber Three reset.', 3); },
    });
    register('w07-prototype', {
      object: prototype,
      label: () => (optionalFound ? 'The First Prototype' : 'Examine the First Prototype'),
      description: 'An early slingshot under a glass dome, kept in the supply closet. Optional.',
      activate: () => {
        if (optionalFound) return;
        optionalFound = true;
        ctx.announce('The first prototype slingshot. Its golden band will join the calibration.', 6);
      },
    });
    register('w07-core', {
      object: core,
      label: () => (finaleStarted ? 'Calibrating' : ledgeReached ? 'Start the Calibration Core' : 'Calibration Core'),
      description: 'The lab’s Calibration Core, on the ledge past the gap. Starting it completes the trials.',
      activate: () => {
        if (finaleStarted || !ledgeReached) return;
        finaleStarted = true;
        finaleProgress = reduced() ? 1 : 0;
        ctx.announce('Calibration running. Every panel in the lab lights up.', 7);
      },
    });
    register('w07-exit', {
      object: exitGate,
      label: () => (completionEligible ? 'Return to the Museum' : 'Exit Portal (closed)'),
      description: 'The lab’s exit portal. It opens when calibration is complete and returns you to the testing-lab door.',
      activate: () => {
        if (!completionEligible || completeRequested) return;
        completeRequested = true;
        ctx.requestComplete();
      },
    });

    const groundedIn = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, y: number) =>
      player.grounded && inRect(r, player.position.x, player.position.z) && Math.abs(player.position.y - y) < 0.3;
    const checkpoint = (id: string) => {
      if (checkpoints.includes(id)) return;
      checkpoints.push(id);
      ctx.saveCheckpoint();
    };

    const snapshot = (): W07Snapshot => ({
      hasSlingshot, gateOpen: hasSlingshot, zone,
      portals: portals.portals.map((p) => ({ panel: p.panel.id, colour: p.colour })),
      linked: portals.linked, aimPanel: aimPanel()?.id ?? null, shots, invalidShots,
      transits: portals.transits, flings: portals.flings, flying: portals.flying,
      blockCarried, blockPos: [blockPos.x, blockPos.y, blockPos.z], blockReturns, plateLatched, doorBOpen: plateLatched,
      roomsCleared: [...roomsCleared], checkpoints: [...checkpoints], optionalFound, ledgeReached, finaleStarted, finaleProgress,
      completionEligible, completeRequested, netResets,
    });
    onReady?.({ getSnapshot: snapshot });

    const placeCarried = () => {
      if (!blockCarried) return;
      const [fx, fz] = forwardFlat();
      blockPos.set(player.position.x + fx * 1.1, player.position.y + 0.65, player.position.z + fz * 1.1);
    };
    const gentleReset = (message: string) => {
      netResets++;
      ctx.resetToCheckpoint();
      player.velocity.set(0, 0, 0);
      ctx.announce(message, 6);
    };

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      spawnPitch: 0,
      fog,
      background: new THREE.Color(0x1c2228),
      fieldOfView: 72,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!announcedArrival) {
          announcedArrival = true;
          ctx.announce('Portal Slingshot Trials. Take the Portal Slingshot from its stand.', 8);
        }
        portals.fixedUpdate(dt, reduced());
        const p = player.position;

        // Zones: each chamber is solved on its own, so leaving one closes its portals.
        const here = zoneAt(p.x, p.z);
        if (here && here !== zone) {
          zone = here;
          if (portals.clearOutside(zone) > 0) ctx.announce('The slingshot’s portals close behind you.', 3);
          if (zone === 'A') ctx.announce('Chamber One. The way on is behind the glass. Pellets fly through calibration glass; you cannot.', 8);
          if (zone === 'B' && !plateLatched) ctx.announce('Chamber Two. The weighted block holds the door plate down, but the plate is behind the glass.', 8);
          if (zone === 'C' && !ledgeReached) ctx.announce('Chamber Three. The ledge is out of reach. A long fall carries speed through a portal.', 8);
        }
        if (blockCarried && zone !== 'B') returnBlock('The block stays in Chamber Two: it is back in its dispenser.');

        // Checkpoints and chamber progress.
        if (zone === 'A' && groundedIn(A_FAR, 0) && !roomsCleared.includes('A')) {
          roomsCleared.push('A');
          checkpoint('chamber-one-far');
          ctx.announce('Chamber One clear. The door ahead leads to Chamber Two.', 6);
        }
        if (zone === 'B' && player.grounded) checkpoint('chamber-two');
        if (zone === 'C' && player.grounded && p.z > -46 && Math.abs(p.y) < 0.3) checkpoint('chamber-three');
        if (!ledgeReached && groundedIn(LEDGE, LEDGE_Y)) {
          ledgeReached = true;
          if (!roomsCleared.includes('C')) roomsCleared.push('C');
          checkpoint('ledge');
          ctx.announce('You cleared the gap. Start the Calibration Core.', 7);
        }

        // Gentle recovery: the safety net, the drop shaft and anything lower.
        if (p.y < NET_Y + 0.4 && p.z < -45.5 && p.z > -52.5 && player.grounded) {
          gentleReset('The safety net returns you to the chamber entrance.');
          return;
        }
        if (inRect(SHAFT, p.x, p.z) && p.y < SHAFT_FLOOR_Y + 0.2 && player.grounded) {
          shaftStuck += dt;
          if (shaftStuck > 1.2) {
            shaftStuck = 0;
            gentleReset('A lift returns you from the shaft. Link the shaft floor with another panel first.');
            return;
          }
        } else shaftStuck = 0;
        if (p.y < SHAFT_FLOOR_Y - 3) {
          gentleReset('You are returned to the last checkpoint.');
          return;
        }

        placeCarried();
        if (finaleStarted && finaleProgress < 1) finaleProgress = Math.min(1, finaleProgress + dt / FINALE_SECONDS);
        if (finaleStarted && finaleProgress >= 1 && !completionEligible) {
          completionEligible = true;
          ctx.markCompletionEligible();
          ctx.announce('Calibration complete. The exit portal is open: step through to return to the museum.', 8);
        }
      },
      variableUpdate(dt) {
        time += dt;
        const r = reduced();
        const f = finaleProgress;
        const ef = f * f * (3 - 2 * f);

        // Aim proxy along the camera ray, so the interaction ray always meets it first beyond reach of props.
        if (proxy.visible) {
          ctx.camera.getWorldPosition(camPos);
          ctx.camera.getWorldDirection(camDir);
          proxy.position.copy(camPos).addScaledVector(camDir, PROXY_DISTANCE);
        }

        // Aim highlight.
        const target = aimPanel();
        lab.panels.forEach((pv) => { pv.highlight.visible = pv.panel === target; });
        lab.highlightMat.opacity = r ? 0.9 : 0.75 + 0.2 * Math.sin(time * 6);

        // Portals.
        for (const [visual, colour] of [[amber, 'amber'], [teal, 'teal']] as const) {
          const portal = portals.portals.find((pp) => pp.colour === colour);
          visual.group.visible = portal !== undefined;
          if (!portal) continue;
          const panel = portal.panel;
          const open = Math.min(1, (opening.get(panel.id) ?? 1) + (r ? 1 : dt / 0.25));
          opening.set(panel.id, open);
          if (panel.kind === 'floor') {
            visual.group.rotation.set(-Math.PI / 2, 0, 0);
            visual.group.position.set(panel.centre[0], panel.centre[1] + 0.05, panel.centre[2]);
            visual.group.scale.set(panel.half * 0.92 * open, panel.half * 0.92 * open, 1);
          } else {
            visual.group.rotation.set(0, Math.atan2(panel.normal[0], panel.normal[2]), 0);
            visual.group.position.set(panel.centre[0] + panel.normal[0] * 0.05, panel.centre[1], panel.centre[2] + panel.normal[2] * 0.05);
            visual.group.scale.set(panel.half * 0.95 * open, ((panel.top - panel.bottom) / 2) * 0.95 * open, 1);
          }
          visual.veilMat.opacity = portals.linked ? 0.88 : 0.32;
          if (!r) visual.veil.rotation.z += dt * (portals.linked ? 1.6 : 0.5);
        }

        // Pellet flight (cosmetic; the portal is already placed).
        pellet.visible = pelletT < 1;
        if (pelletT < 1) {
          pelletT = Math.min(1, pelletT + dt / 0.22);
          pellet.position.lerpVectors(pelletFrom, pelletTo, pelletT);
          pellet.position.y += Math.sin(pelletT * Math.PI) * 0.3;
        }

        // Block and plate.
        placeCarried();
        blockGroup.position.copy(blockPos);
        blockGroup.rotation.y = blockCarried ? player.yaw : 0;
        blockBandMat.emissiveIntensity = plateLatched ? 1.6 : 0.9;
        plateMat.emissive.setHex(plateLatched ? 0x40e080 : 0xd04030);
        plateMat.emissiveIntensity = plateLatched ? 1.2 : 0.5 + (r ? 0 : 0.2 * Math.sin(time * 3));
        resetA.capMat.emissiveIntensity = resetB.capMat.emissiveIntensity = resetC.capMat.emissiveIntensity = 0.35;

        // Core and finale.
        if (!r) {
          coreRings[0].rotation.x = time * 0.7;
          coreRings[1].rotation.y = time * 0.9;
          coreOrb.rotation.y = time * 0.4;
        }
        coreOrbMat.emissiveIntensity = 0.8 + ef * 2.2 + (ledgeReached && !finaleStarted && !r ? 0.4 * Math.sin(time * 3) : 0);
        mats.panel.emissiveIntensity = 0.08 + ef * 0.9;
        mats.light.emissive.setHex(0xe8f4ff).lerp(new THREE.Color(0xffd890), ef);
        finaleRings.forEach((rings, k) => {
          rings.visible = finaleStarted && (k < 2 || optionalFound);
          if (!rings.visible) return;
          for (let i = 0; i < ringCount; i++) {
            const t = (i / ringCount + (r ? 0 : time * 0.06)) % 1;
            const a = i * 2.4 + k * 2.1 + (r ? 0 : time * 0.8);
            const rad = 1.6 + t * 4.5;
            v.set(CORE_POS[0] + Math.cos(a) * rad, LEDGE_Y + 1 + t * 8 * ef, CORE_POS[2] + Math.sin(a) * rad);
            e.set(Math.PI / 2 + Math.sin(a) * 0.4, a, 0);
            s.setScalar(ef * (1 - t * 0.5));
            rings.setMatrixAt(i, m.compose(v, q.setFromEuler(e), s));
          }
          rings.instanceMatrix.needsUpdate = true;
        });
        exitPortal.group.visible = completionEligible;
        if (completionEligible && !r) exitPortal.veil.rotation.z += dt * 0.8;
      },
      dispose() {
        collision.setDynamicWall('w07-foyer-gate', null);
        collision.setDynamicWall('w07-door-b', null);
        collision.setDynamicWall('w07-block', null);
      },
    };
  };
}
