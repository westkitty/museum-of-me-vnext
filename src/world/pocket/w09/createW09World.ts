import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addLightRig, addPlatform, addRamp, addRail, gradientSkyDome, seededRandom, type PocketPreviewHandle } from '../kit/worldKit';

export interface W09Snapshot {
  readonly localTime: number;
  readonly orreryBridge: boolean;
  readonly aligned: readonly boolean[];
  readonly meteorBridge: boolean;
  readonly checkpoints: readonly string[];
  readonly optionalFound: boolean;
  readonly finaleProgress: number;
  readonly completeRequested: boolean;
}
export interface W09PreviewHandle extends PocketPreviewHandle { getSnapshot(): W09Snapshot }

const SPAWN = [0, 0, 25] as const;
const dialPositions = [[-4, 0, -6], [4, 0, -6]] as const;
const targets = [3, 8] as const;
const phaseDistance = (t: number, target: number) => Math.abs(((t - target + 6) % 12 + 12) % 12 - 6);

/** W09: the celestial apparatus moves only when the visitor intends to move. */
export function createW09WorldFactory(onReady?: (handle: W09PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W09 load aborted', 'AbortError');
    const { scope, root, collision, player } = ctx;
    const stone = scope.track(new THREE.MeshStandardMaterial({ color: 0x343c55, roughness: 0.85, metalness: 0.2 }));
    const brass = scope.track(new THREE.MeshStandardMaterial({ color: 0xb69761, roughness: 0.38, metalness: 0.72, emissive: 0x33240e, emissiveIntensity: 0.3 }));
    const star = scope.track(new THREE.MeshBasicMaterial({ color: 0xb9dcff, toneMapped: false }));
    const ember = scope.track(new THREE.MeshBasicMaterial({ color: 0xf5bb79, toneMapped: false }));
    const bridgeMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x5b728e, metalness: 0.65, roughness: 0.25, emissive: 0x1a4972, emissiveIntensity: 0.35 }));
    gradientSkyDome(ctx, { zenith: 0x03091d, horizon: 0x1c2747, nadir: 0x111326 }, 360);
    addLightRig(ctx, { sky: 0x8fa7d7, ground: 0x252035, hemiIntensity: 1.5, sun: 0xb7caff, sunIntensity: 1.2, sunPosition: [-20, 65, 30] });

    // Three spatial acts. Each visible slab is paired with its collision support.
    addPlatform(ctx, stone, { minX: -10, maxX: 10, minZ: 14, maxZ: 32, y: 0, depth: 4 });
    addPlatform(ctx, stone, { minX: -10, maxX: 10, minZ: -13, maxZ: 5, y: 0, depth: 4 });
    addPlatform(ctx, stone, { minX: -9, maxX: 9, minZ: -30, maxZ: -23, y: 0, depth: 4 });
    addRamp(ctx, stone, { minX: -4, maxX: 4, minZ: -43, maxZ: -30, axis: 'z', yAtMin: 2, yAtMax: 0 });
    addPlatform(ctx, stone, { minX: -9, maxX: 9, minZ: -49, maxZ: -43, y: 2, depth: 4 });
    addRamp(ctx, stone, { minX: -4, maxX: 4, minZ: -62, maxZ: -49, axis: 'z', yAtMin: 5, yAtMax: 2 });
    addPlatform(ctx, stone, { minX: -10, maxX: 10, minZ: -78, maxZ: -62, y: 5, depth: 7 });
    const visibleRail = (x: number, a: number, b: number, ya: number, yb = ya) => {
      const rail = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.18, 0.16, Math.hypot(b - a, yb - ya))), brass);
      rail.position.set(x, (ya + yb) / 2 + 0.9, (a + b) / 2);
      rail.rotation.x = -Math.atan2(yb - ya, b - a);
      root.add(rail);
    };
    for (const [a, b, y, x] of [[14, 32, 0, 10], [-13, 5, 0, 10], [-30, -23, 0, 9], [-49, -43, 2, 9], [-78, -62, 5, 10]] as const) {
      addRail(ctx, -x, a, -x, b, y); addRail(ctx, x, a, x, b, y);
      visibleRail(-x, a, b, y); visibleRail(x, a, b, y);
    }
    visibleRail(-4, -43, -30, 2, 0); visibleRail(4, -43, -30, 2, 0);
    visibleRail(-4, -62, -49, 5, 2); visibleRail(4, -62, -49, 5, 2);

    const makeBridge = (minZ: number, maxZ: number) => {
      const mesh = new THREE.Mesh(scope.track(new THREE.BoxGeometry(5, 0.4, maxZ - minZ)), bridgeMat);
      mesh.position.set(0, -0.2, (minZ + maxZ) / 2);
      mesh.visible = false;
      root.add(mesh);
      return mesh;
    };
    const firstBridge = makeBridge(5, 14);
    const secondBridge = makeBridge(-23, -13);
    const unlockBridge = (id: string, mesh: THREE.Mesh, minZ: number, maxZ: number) => {
      mesh.visible = true;
      collision.setDynamicFloor(id, { kind: 'floor', minX: -2.5, maxX: 2.5, minZ, maxZ, y: 0 });
      addRail(ctx, -2.5, minZ, -2.5, maxZ, 0); addRail(ctx, 2.5, minZ, 2.5, maxZ, 0);
      visibleRail(-2.5, minZ, maxZ, 0); visibleRail(2.5, minZ, maxZ, 0);
    };

    // Monumental frozen orrery, with a physical bridge that materializes when its ring reaches alignment.
    const orrery = new THREE.Group(); orrery.position.set(0, 12, 5); root.add(orrery);
    const rings = [8, 11, 14].map((radius, i) => {
      const ring = new THREE.Mesh(scope.track(new THREE.TorusGeometry(radius, 0.15 + i * 0.04, 8, 72)), brass);
      ring.rotation.set(i * 0.4, i * 0.6, i * 0.25); orrery.add(ring); return ring;
    });
    const core = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(2.2, 2)), ember); orrery.add(core);
    const random = seededRandom(9009);
    const starGeo = scope.track(new THREE.SphereGeometry(0.08, 5, 4));
    const stars = scope.track(new THREE.InstancedMesh(starGeo, star, ctx.quality.tier === 'low' ? 90 : 220));
    const dummy = new THREE.Object3D();
    for (let i = 0; i < stars.count; i++) {
      dummy.position.set((random() - 0.5) * 180, random() * 65 + 8, (random() - 0.5) * 180 - 18);
      dummy.scale.setScalar(random() * 2 + 0.5); dummy.updateMatrix(); stars.setMatrixAt(i, dummy.matrix);
    }
    stars.instanceMatrix.needsUpdate = true; root.add(stars);

    const plate = (x: number, z: number, mat: THREE.Material, y = 0) => {
      const base = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.85, 1.05, 1.2, 16)), stone);
      base.position.set(x, y + 0.6, z); root.add(base);
      const face = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.42, 1)), mat);
      face.position.set(x, y + 1.65, z); root.add(face);
      return face;
    };
    const timeDial = plate(0, 19, brass);
    const alignmentDials = dialPositions.map(([x, , z]) => plate(x, z, star));
    const optional = plate(-7, -9, brass);
    const exit = plate(0, -73, ember, 5);
    const meteorBodies = [-35, -47, -58].map((z, i) => {
      const mesh = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(1.25 + i * 0.2, 1)), scope.track(new THREE.MeshStandardMaterial({ color: 0x806a6d, roughness: 0.78, emissive: 0x9b4d20, emissiveIntensity: 0.75, flatShading: true })));
      mesh.position.set(0, [2.5, 3.3, 5.2][i], z); root.add(mesh); return mesh;
    });
    const meteorTrails = meteorBodies.map((body) => {
      const trail = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.8, 5, 10)), scope.track(new THREE.MeshBasicMaterial({ color: 0x8db8ff, transparent: true, opacity: 0.45, depthWrite: false })));
      trail.rotation.x = Math.PI / 2; root.add(trail); trail.position.copy(body.position); trail.position.z -= 2.5; return trail;
    });
    // Each chamber has a different silhouette. These structures are visual only;
    // the route itself is carried by the paired slab/collider geometry above.
    const pylonGeo = scope.track(new THREE.CylinderGeometry(0.36, 0.62, 9, 8));
    const finialGeo = scope.track(new THREE.IcosahedronGeometry(0.68, 1));
    for (const [z, y] of [[23, 0], [-3, 0], [-26, 0], [-46, 2], [-68, 5]] as const) {
      for (const x of [-8.2, 8.2]) {
        const pylon = new THREE.Mesh(pylonGeo, stone); pylon.position.set(x, y + 4.5, z); root.add(pylon);
        const finial = new THREE.Mesh(finialGeo, star); finial.position.set(x, y + 9.5, z); root.add(finial);
      }
    }
    const celestialRings = [[-5, 13, 10], [-46, 20, 18], [-92, 22, 17]] as const;
    const skyArches = celestialRings.map(([z, y, radius], i) => {
      const ring = new THREE.Mesh(scope.track(new THREE.TorusGeometry(radius, 0.22, 8, 96)), i === 1 ? star : brass);
      ring.position.set(0, y, z); ring.rotation.y = i * 0.3; root.add(ring); return ring;
    });
    const constellation = new THREE.Group(); constellation.position.set(0, 14, -5); root.add(constellation);
    const constellationPoints = [[-6, 2], [-3, 5], [0, 1], [2, 5], [6, 3], [4, -2], [-2, -3]] as const;
    for (const [x, y] of constellationPoints) {
      const point = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.42, 0)), star);
      point.position.set(x, y, 0); constellation.add(point);
    }
    const finalCrown = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(5, 2)), scope.track(new THREE.MeshBasicMaterial({ color: 0x6f90c5, transparent: true, opacity: 0.35, depthWrite: false })));
    finalCrown.position.set(0, 22, -98); root.add(finalCrown);

    let localTime = 0;
    let lastX: number = SPAWN[0], lastZ: number = SPAWN[2];
    let orreryBridge = false, meteorBridge = false, optionalFound = false;
    const aligned = [false, false];
    const checkpoints: string[] = [];
    let finaleProgress = 0, completeRequested = false, arrivalAnnounced = false, completionEligible = false;
    const advance = (amount: number) => { localTime += amount; };
    const markCheckpoint = (id: string) => {
      if (checkpoints.includes(id)) return;
      checkpoints.push(id); ctx.saveCheckpoint();
    };
    const register = (id: string, object: THREE.Object3D, label: () => string, activate: () => void) =>
      ctx.interaction.register(id, { object, label, activate });
    register('w09-time-dial', timeDial, () => 'Advance celestial time', () => {
      advance(1.5); ctx.announce('The sky advances while you stand still. Movement also carries time forward.', 5);
    });
    alignmentDials.forEach((dial, i) => register(`w09-constellation-${i}`, dial,
      () => aligned[i] ? 'Constellation held in alignment' : `Align constellation ${i + 1}`,
      () => {
        if (aligned[i]) return;
        if (phaseDistance(localTime, targets[i]) > 1.2) {
          advance(1.5);
          ctx.announce('The points are apart. The station advances the sky while you stand still.', 6);
          return;
        }
        aligned[i] = true; dial.material = brass;
        ctx.announce(`Constellation ${i + 1} is held. The sky remembers its position.`, 5);
      }));
    register('w09-discovery', optional, () => 'Read the lost astronomer’s chart', () => {
      optionalFound = true; ctx.announce('The chart records a sky that existed between two seconds.', 6);
    });
    register('w09-exit', exit, () => completionEligible ? 'Return through the restored sky' : 'The sky is not restored yet', () => {
      if (!completionEligible || completeRequested) return;
      completeRequested = true; ctx.requestComplete();
    });
    const snapshot = (): W09Snapshot => ({ localTime, orreryBridge, aligned: [...aligned], meteorBridge, checkpoints: [...checkpoints], optionalFound, finaleProgress, completeRequested });
    onReady?.({ getSnapshot: snapshot });

    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      fog: new THREE.FogExp2(0x171e35, 0.004),
      background: new THREE.Color(0x0c1430),
      fieldOfView: 72,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!arrivalAnnounced) { arrivalAnnounced = true; ctx.announce('The Museum Between Seconds. Step and the sky moves. Stop and it waits.', 8); }
        const p = player.position;
        const moved = Math.hypot(p.x - lastX, p.z - lastZ);
        const intentional = ctx.input.isDown('forward') || ctx.input.isDown('back') || ctx.input.isDown('left') || ctx.input.isDown('right') || Math.abs(ctx.input.touchMoveX) + Math.abs(ctx.input.touchMoveY) > 0.12;
        if (intentional && moved > 0.002) advance(Math.min(moved, dt * 12) * 0.8);
        lastX = p.x; lastZ = p.z;
        if (!orreryBridge && localTime >= 5) {
          orreryBridge = true; unlockBridge('w09-orrery-bridge', firstBridge, 5, 14);
          ctx.announce('The orrery settles. A bridge of fixed stars spans the first void.', 7);
        }
        if (orreryBridge && p.z < 4) markCheckpoint('alignment-gallery');
        if (!meteorBridge && aligned.every(Boolean)) {
          meteorBridge = true; unlockBridge('w09-meteor-bridge', secondBridge, -23, -13);
          ctx.announce('Both constellations hold. The path through the suspended cascade appears.', 7);
        }
        if (meteorBridge && p.z < -25) markCheckpoint('cascade-threshold');
        if (p.z < -44) markCheckpoint('meteor-shelter');
        if (p.z < -65) markCheckpoint('final-observatory');
        if (p.y < -8) {
          if (!ctx.resetToCheckpoint()) player.teleport([...SPAWN], 0);
          lastX = player.position.x; lastZ = player.position.z;
          ctx.announce('The frozen sky catches you at the last safe terrace.', 5);
        }
        // Meteor stones are moving obstructions on a fully supported, railed route.
        // They freeze at rest; contact merely blocks the capsule, never causes a fall.
        meteorBodies.forEach((body, i) => {
          const x = Math.sin(localTime * (0.42 + i * 0.08) + i * 1.8) * 3.3;
          body.position.x = x; meteorTrails[i].position.x = x;
          collision.setDynamicWall(`w09-meteor-${i}`, { kind: 'wall', minX: x - 0.95, maxX: x + 0.95, minY: [0.8, 1.8, 3.5][i], maxY: body.position.y + 1, minZ: body.position.z - 0.9, maxZ: body.position.z + 0.9 });
        });
        if (p.z < -65 && meteorBridge) {
          finaleProgress = Math.min(1, finaleProgress + dt / (ctx.reducedMotion() ? 0.2 : 8));
          if (finaleProgress >= 1 && !completionEligible) {
            completionEligible = true; ctx.markCompletionEligible();
            ctx.announce('The celestial alignment is restored. Touch the star at the end to return.', 8);
          }
        }
      },
      variableUpdate() {
        rings[0].rotation.y = localTime * 0.12;
        rings[1].rotation.x = 0.4 + localTime * 0.08;
        rings[2].rotation.z = 0.5 + localTime * 0.06;
        core.scale.setScalar(1 + finaleProgress * 2.5);
        exit.scale.setScalar(1 + finaleProgress * 0.8);
        constellation.rotation.z = localTime * 0.035;
        skyArches[0].rotation.z = localTime * 0.025;
        skyArches[1].rotation.z = localTime * -0.018;
        skyArches[2].rotation.z = finaleProgress * Math.PI * 0.35;
        finalCrown.scale.setScalar(1 + finaleProgress * 0.55);
        (finalCrown.material as THREE.MeshBasicMaterial).opacity = 0.35 + finaleProgress * 0.55;
      },
      dispose() {
        collision.setDynamicFloor('w09-orrery-bridge', null);
        collision.setDynamicFloor('w09-meteor-bridge', null);
        meteorBodies.forEach((_, i) => collision.setDynamicWall(`w09-meteor-${i}`, null));
      },
    };
  };
}
