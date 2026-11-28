import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addLightRig, addPlatform, gradientSkyDome, seededRandom, type PocketPreviewHandle } from '../kit/worldKit';
import { chooseDexterPose, selectDexterCharacter, type DexterRigStatus } from './dexterCharacter';

export interface W10Snapshot {
  readonly hasGlider: boolean;
  readonly gliding: boolean;
  readonly climbing: boolean;
  readonly stamina: number;
  readonly updraft: boolean;
  readonly blockSteps: readonly number[];
  readonly shrineOpen: boolean;
  readonly checkpoints: readonly string[];
  readonly optionalFound: boolean;
  readonly panoramaProgress: number;
  readonly completeRequested: boolean;
  readonly rigStatus: DexterRigStatus;
}
export interface W10PreviewHandle extends PocketPreviewHandle { getSnapshot(): W10Snapshot }

const SPAWN = [0, 12, 36] as const;
const FALL_Y = -8;
const GLIDE_SINK = 0.85;
const GLIDE_SPEED = 5.5;

/** W10 wilderness mechanics with a clearly marked temporary character rig. */
export function createW10WorldFactory(onReady?: (handle: W10PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W10 load aborted', 'AbortError');
    const { root, scope, collision, player, input } = ctx;
    const grass = scope.track(new THREE.MeshStandardMaterial({ color: 0x547d58, roughness: 0.95, flatShading: true }));
    const grassLight = scope.track(new THREE.MeshStandardMaterial({ color: 0x7ca070, roughness: 0.92, flatShading: true }));
    const rock = scope.track(new THREE.MeshStandardMaterial({ color: 0x65736a, roughness: 0.95, flatShading: true }));
    const darkRock = scope.track(new THREE.MeshStandardMaterial({ color: 0x414d50, roughness: 0.95, flatShading: true }));
    const wood = scope.track(new THREE.MeshStandardMaterial({ color: 0x7b5a39, roughness: 0.85 }));
    const gold = scope.track(new THREE.MeshStandardMaterial({ color: 0xd7bf78, metalness: 0.4, roughness: 0.45, emissive: 0x665026, emissiveIntensity: 0.35 }));
    const windMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xb4e2d5, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    gradientSkyDome(ctx, { zenith: 0x34648c, horizon: 0xb7d7c8, nadir: 0x6a9376 }, 480);
    addLightRig(ctx, { sky: 0xd7ecdd, ground: 0x425d50, hemiIntensity: 1.5, sun: 0xffe7ac, sunIntensity: 1.6, sunPosition: [-40, 90, 55] });
    const fog = new THREE.FogExp2(0xa7c5b4, 0.003);

    // Actual walkable wilderness, launch plateau, climb summit and final landing.
    const valley = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(90, 82, 1, 1)), grass);
    valley.rotation.x = -Math.PI / 2; valley.position.set(0, -0.03, -15); valley.raycast = () => {}; root.add(valley);
    collision.addFloor(-45, 45, -56, 26, 0);
    addPlatform(ctx, rock, { minX: -13, maxX: 13, minZ: 23, maxZ: 46, y: 12, depth: 12 });
    addPlatform(ctx, rock, { minX: 8, maxX: 22, minZ: -56, maxZ: -31, y: 8, depth: 8 });
    addPlatform(ctx, rock, { minX: -17, maxX: 17, minZ: -110, maxZ: -82, y: 3, depth: 9 });
    for (const [x, y, z, w, d] of [[0, 12.04, 34.5, 24, 20], [15, 8.04, -43.5, 12, 21], [0, 3.04, -96, 32, 25]] as const) {
      const turf = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(w, d)), grassLight);
      turf.rotation.x = -Math.PI / 2; turf.position.set(x, y, z); turf.raycast = () => {}; root.add(turf);
    }
    const mountainGeo = scope.track(new THREE.DodecahedronGeometry(1, 1));
    const outcrop = (x: number, z: number, r: number, h: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(mountainGeo, material);
      mesh.position.set(x, h * 0.35 - 2, z); mesh.scale.set(r, h * 0.65, r * 0.8);
      mesh.rotation.y = x * 0.04; mesh.raycast = () => {}; root.add(mesh);
    };
    for (const [x, z, r, h] of [[-48, 5, 14, 28], [44, -5, 18, 34], [-43, -38, 15, 30], [43, -48, 22, 42], [-62, -105, 22, 40], [63, -113, 20, 38]] as const) outcrop(x, z, r, h, darkRock);
    // Landmark silhouettes: a western arch, cedar grove, shrine and far needle.
    const archLeg = scope.track(new THREE.BoxGeometry(2, 14, 2));
    for (const x of [-30, -18]) {
      const leg = new THREE.Mesh(archLeg, rock); leg.position.set(x, 7, -12); root.add(leg);
    }
    const archTop = new THREE.Mesh(scope.track(new THREE.BoxGeometry(16, 2, 2)), rock); archTop.position.set(-24, 14, -12); root.add(archTop);
    const treeTrunk = scope.track(new THREE.CylinderGeometry(0.26, 0.48, 5, 7));
    const treeCrown = scope.track(new THREE.ConeGeometry(2.4, 8, 8));
    const treeMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x244e3c, roughness: 0.95, flatShading: true }));
    const random = seededRandom(1010);
    const trees: [number, number][] = [];
    for (let i = 0; i < (ctx.quality.tier === 'low' ? 45 : 90); i++) {
      const x = (random() - 0.5) * 76, z = -50 + random() * 70;
      if (Math.abs(x) < 6 || (x > 7 && x < 24 && z < -25) || (x < -15 && z > -22 && z < -5)) continue;
      trees.push([x, z]);
    }
    const trunkBatch = new THREE.InstancedMesh(treeTrunk, wood, trees.length);
    const crownBatch = new THREE.InstancedMesh(treeCrown, treeMat, trees.length);
    const dummy = new THREE.Object3D();
    trees.forEach(([x, z], i) => {
      const s = 0.75 + random() * 0.8;
      dummy.position.set(x, 2.5 * s, z); dummy.scale.setScalar(s); dummy.updateMatrix(); trunkBatch.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 6.5 * s; dummy.updateMatrix(); crownBatch.setMatrixAt(i, dummy.matrix);
    });
    trunkBatch.instanceMatrix.needsUpdate = true; crownBatch.instanceMatrix.needsUpdate = true;
    trunkBatch.raycast = () => {}; crownBatch.raycast = () => {}; root.add(trunkBatch, crownBatch);
    const grassGeo = scope.track(new THREE.ConeGeometry(0.13, 0.7, 3));
    const tufts = new THREE.InstancedMesh(grassGeo, grassLight, ctx.quality.tier === 'low' ? 180 : 400);
    for (let i = 0; i < tufts.count; i++) {
      dummy.position.set((random() - 0.5) * 78, 0.35, -50 + random() * 70);
      dummy.rotation.y = random() * Math.PI * 2; dummy.scale.setScalar(0.5 + random()); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix);
    }
    tufts.instanceMatrix.needsUpdate = true; tufts.raycast = () => {}; root.add(tufts);

    // Wind through the final canyon: a broad rising column and readable ribbons.
    const windRibbons = [0, 1, 2].map((i) => {
      const ribbon = new THREE.Mesh(scope.track(new THREE.TorusGeometry(7 + i * 1.5, 0.11, 5, 40)), windMat);
      ribbon.rotation.x = Math.PI / 2; ribbon.position.set(3, 2 + i * 3, -68); root.add(ribbon); return ribbon;
    });
    const shrine = new THREE.Group(); shrine.position.set(15, 8, -46); root.add(shrine);
    const base = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(4.6, 5.2, 0.45, 12)), darkRock); base.position.y = 0.24; shrine.add(base);
    const arch = new THREE.Mesh(scope.track(new THREE.TorusGeometry(3.5, 0.22, 8, 48, Math.PI)), gold);
    arch.position.y = 4.1; shrine.add(arch);
    const gate = new THREE.Mesh(scope.track(new THREE.BoxGeometry(11, 5, 0.7)), darkRock);
    gate.position.set(15, 2.5, -55.5); root.add(gate);
    collision.setDynamicWall('w10-shrine-gate', { kind: 'wall', minX: 9.5, maxX: 20.5, minY: 0, maxY: 5, minZ: -55.9, maxZ: -55.1 });
    const plates = [13, 17].map((x) => {
      const plate = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 24)), gold);
      plate.position.set(x, 8.06, -44); root.add(plate); return plate;
    });
    const blockSteps = [0, 0];
    const blocks = [10, 20].map((x, i) => {
      const block = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.85, 0.85, 0.85)), rock);
      block.name = `w10-shrine-block-${i}`; block.position.set(x, 8.45, -44); root.add(block); return block;
    });
    const updateBlock = (i: number) => {
      blocks[i].position.x = (i === 0 ? 10 : 20) + (i === 0 ? 1 : -1) * blockSteps[i];
      const x = blocks[i].position.x;
      collision.setDynamicWall(`w10-block-${i}`, { kind: 'wall', minX: x - 0.43, maxX: x + 0.43, minY: 8, maxY: 8.85, minZ: -44.43, maxZ: -43.57 });
      (plates[i].material as THREE.MeshStandardMaterial).emissiveIntensity = blockSteps[i] === 3 ? 1.5 : 0.35;
    };
    updateBlock(0); updateBlock(1);

    const gliderRack = new THREE.Mesh(scope.track(new THREE.ConeGeometry(1.6, 0.4, 8)), gold);
    gliderRack.position.set(0, 12.6, 30); root.add(gliderRack);
    const spareRack = new THREE.Mesh(scope.track(new THREE.ConeGeometry(1.4, 0.35, 8)), gold);
    spareRack.position.set(0, 0.5, 8); root.add(spareRack);
    const grip = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.4, 3.4, 0.18)), wood);
    grip.position.set(15, 1.7, -30.3); root.add(grip);
    const optional = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.7, 1)), gold);
    optional.position.set(-24, 1.3, -12); root.add(optional);
    const panorama = new THREE.Group(); panorama.position.set(0, 3, -99); root.add(panorama);
    const spire = new THREE.Mesh(scope.track(new THREE.ConeGeometry(5, 42, 8, 2)), darkRock);
    spire.position.set(0, 20, -137); panorama.add(spire);
    const crown = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(3, 1)), gold);
    crown.position.set(0, 42, -137); panorama.add(crown);
    const farReveal = new THREE.Group(); farReveal.visible = false; root.add(farReveal);
    const farRock = scope.track(new THREE.MeshStandardMaterial({ color: 0x738d79, roughness: 0.98, flatShading: true }));
    for (const [x, z, r, h] of [[-75, -145, 22, 38], [-45, -165, 15, 22], [48, -166, 18, 27], [82, -190, 26, 34], [4, -220, 26, 20]] as const) {
      const mesa = new THREE.Mesh(mountainGeo, farRock);
      mesa.position.set(x, h * 0.24, z); mesa.scale.set(r, h * 0.55, r * 0.85); farReveal.add(mesa);
      const canopy = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(r * 0.24, 1)), treeMat);
      canopy.position.set(x, h * 0.82, z); canopy.scale.set(1.4, 0.5, 1); farReveal.add(canopy);
    }
    const sun = new THREE.Mesh(scope.track(new THREE.SphereGeometry(12, 24, 16)), scope.track(new THREE.MeshBasicMaterial({ color: 0xffd997, toneMapped: false })));
    sun.position.set(-28, 13, -220); farReveal.add(sun);
    const halo = new THREE.Mesh(scope.track(new THREE.TorusGeometry(20, 0.8, 6, 64)), scope.track(new THREE.MeshBasicMaterial({ color: 0xffe6ad, transparent: true, opacity: 0.7 })));
    halo.position.set(-28, 13, -219); farReveal.add(halo);
    const birds = new THREE.Group(); farReveal.add(birds);
    for (let i = 0; i < 11; i++) {
      const wing = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.3, 1.7, 3)), darkRock);
      wing.position.set(-18 + i * 3.7, 28 + Math.sin(i * 1.3) * 5, -125 - i * 3);
      wing.rotation.z = Math.PI / 2; wing.rotation.y = (i % 3 - 1) * 0.3; birds.add(wing);
    }
    const exit = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.8, 1)), gold);
    exit.position.set(0, 4.4, -103); root.add(exit);

    // The character goes through the Dexter seam. No candidate is offered: there is no
    // approved Dexter model, and no stand-in animal (docs/plans/W10_DEXTER_MODEL_HANDOFF.md),
    // so the seam returns the labelled test-only rig.
    const { character } = selectDexterCharacter(scope);
    root.add(character.object);

    let hasGlider = false, climbing = false, updraft = false, shrineOpen = false, optionalFound = false;
    let stamina = 100, panoramaProgress = 0, completeRequested = false, arrivalAnnounced = false, eligible = false;
    const checkpoints: string[] = [];
    const checkpoint = (id: string) => { if (!checkpoints.includes(id)) { checkpoints.push(id); ctx.saveCheckpoint(); } };
    const use = () => {
      if (input.uiCaptured || completeRequested) return;
      const p = player.position;
      const near = (x: number, y: number, z: number, r = 4) => Math.hypot(p.x - x, p.y - y, p.z - z) < r;
      if (!hasGlider && (near(0, 12, 30, 5) || near(0, 0, 8, 5))) {
        hasGlider = true; ctx.announce('Explorer glider ready. Walking off a ledge becomes a steerable glide.', 7); return;
      }
      if (!climbing && near(15, 0, -28, 5) && p.y < 2) {
        climbing = true; stamina = Math.max(stamina, 45); player.velocity.y = 0;
        ctx.announce('Grip the cliff. Hold forward to climb; pause to recover stamina.', 7); return;
      }
      if (p.y > 7.5 && p.z < -35 && p.z > -52) {
        for (let i = 0; i < 2; i++) {
          const b = blocks[i].position;
          if (blockSteps[i] >= 3 || Math.hypot(p.x - b.x, p.z - b.z) > 4.2) continue;
          blockSteps[i]++; updateBlock(i);
          ctx.announce(`Shrine stone ${i + 1} slides one notch toward its plate.`, 4);
          if (blockSteps.every((n) => n === 3) && !shrineOpen) {
            shrineOpen = true; gate.visible = false; collision.setDynamicWall('w10-shrine-gate', null);
            ctx.announce('Both stones settle. The shrine opens onto the wind canyon.', 8);
          }
          return;
        }
      }
      if (near(-24, 0, -12, 5)) { optionalFound = true; ctx.announce('A tiny cedar seed rests beneath the old arch.', 6); return; }
      if (near(0, 3, -99, 7) && shrineOpen && panoramaProgress === 0) {
        panoramaProgress = 0.001; farReveal.visible = true;
        ctx.announce('At the far overlook, the wilderness opens beyond the needle.', 8); return;
      }
      if (near(0, 3, -103, 5) && eligible) { completeRequested = true; ctx.requestComplete(); }
    };
    const offInteract = input.on('interact', use);
    onReady?.({ getSnapshot: (): W10Snapshot => ({ hasGlider, gliding: hasGlider && !player.grounded && !updraft, climbing, stamina, updraft, blockSteps: [...blockSteps], shrineOpen, checkpoints: [...checkpoints], optionalFound, panoramaProgress, completeRequested, rigStatus: character.status }) });
    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      cameraMode: 'third-person-dexter',
      fog,
      background: new THREE.Color(0x9fc5b3),
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!arrivalAnnounced) { arrivalAnnounced = true; ctx.announce('Breath of the Weasel. Take the explorer glider, cross the valley, climb to the shrine, then ride the canyon wind.', 9); }
        const p = player.position;
        if (p.y < FALL_Y || (p.z < -80 && p.y < 2.8)) {
          if (!ctx.resetToCheckpoint()) player.teleport([...SPAWN], 0);
          player.velocity.set(0, 0, 0); climbing = false;
          ctx.announce('A warm gust returns you to your last safe camp.', 5); return;
        }
        if (p.y < 0.5 && p.z < 20 && p.z > -22) checkpoint('valley-camp');
        if (p.y > 7.7 && p.z < -32 && p.z > -56) checkpoint('shrine-ledge');
        if (p.y > 2.7 && p.z < -85) checkpoint('far-overlook');
        if (climbing) {
          player.velocity.y = 0;
          // Forward is the key or a firm push of the touch stick (up is negative).
          const climbHeld = input.isDown('forward') || (!input.uiCaptured && input.touchMoveY < -0.35);
          if (climbHeld && stamina > 0) {
            player.shift(0, dt * 3.2, 0); stamina = Math.max(0, stamina - dt * 13);
          } else stamina = Math.min(100, stamina + dt * 24);
          if (player.position.y >= 8) {
            player.teleport([15, 8, -33], player.yaw); climbing = false; stamina = 100;
            checkpoint('shrine-ledge'); ctx.announce('You crest the cliff. Two movable stones face the shrine plates.', 7);
          }
        } else if (hasGlider && !player.grounded) {
          const v = player.velocity;
          const h = Math.hypot(v.x, v.z);
          if (h > GLIDE_SPEED) { v.x *= GLIDE_SPEED / h; v.z *= GLIDE_SPEED / h; }
          updraft = p.z < -56 && p.z > -80 && Math.hypot(p.x - 3, p.z + 68) < 14;
          if (updraft && p.y < 11) v.y = Math.max(v.y, ctx.reducedMotion() ? 3 : 2.4);
          else if (v.y < -GLIDE_SINK) v.y = -GLIDE_SINK;
        } else { updraft = false; stamina = Math.min(100, stamina + dt * 24); }
        if (panoramaProgress > 0 && panoramaProgress < 1) {
          panoramaProgress = Math.min(1, panoramaProgress + dt / (ctx.reducedMotion() ? 0.2 : 8));
          if (panoramaProgress >= 1 && !eligible) { eligible = true; ctx.markCompletionEligible(); ctx.announce('The adventure is complete. The return marker glows on the overlook.', 8); }
        }
      },
      variableUpdate(dt) {
        const v = player.velocity;
        const pose = chooseDexterPose({ grounded: player.grounded, climbing, hasGlider, speed: Math.hypot(v.x, v.z), verticalSpeed: v.y });
        character.update(player.position, player.yaw, pose, dt, ctx.reducedMotion());
        windRibbons.forEach((ribbon, i) => { ribbon.rotation.z += ctx.reducedMotion() ? 0 : dt * (0.1 + i * 0.03); });
        crown.scale.setScalar(1 + panoramaProgress * 1.2);
        exit.scale.setScalar(1 + panoramaProgress * 0.5);
        if (panoramaProgress > 0) {
          fog.density = 0.003 - panoramaProgress * 0.0019;
          sun.position.y = 13 + panoramaProgress * 26;
          halo.position.y = sun.position.y;
          birds.position.x = ctx.reducedMotion() ? 0 : Math.sin(panoramaProgress * Math.PI) * 7;
        }
      },
      dispose() {
        offInteract();
        character.dispose();
        collision.setDynamicWall('w10-shrine-gate', null);
        collision.setDynamicWall('w10-block-0', null); collision.setDynamicWall('w10-block-1', null);
      },
    };
  };
}
