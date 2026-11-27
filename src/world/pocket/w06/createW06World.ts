import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { seededRandom, tierCount, type PocketPreviewHandle } from '../kit/worldKit';
import { buildIsland, buildUpdraftVisual } from './w06Islands';
import { buildW06Scenery } from './w06Scenery';
import { buildWind } from './w06Wind';
import {
  CAIRN_POS, FALL_RESET_Y, GATE_POS, type Island, ISLANDS, LANTERN_POS, MEADOW_LIP_GATE, onIsland, PARASOL_POS,
  ROUTE_CHECKPOINTS, SPAWN, SUMMIT, UPDRAFT_A, UPDRAFT_B, UPDRAFT_SPIRE, UPDRAFTS,
} from './w06Layout';

export interface W06Snapshot {
  readonly hasParasol: boolean;
  readonly lipOpen: boolean;
  readonly updraft: string | null;
  readonly gliding: boolean;
  readonly rides: number;
  readonly checkpoints: readonly string[];
  readonly lanternFound: boolean;
  readonly summitReached: boolean;
  readonly finaleStarted: boolean;
  readonly finaleProgress: number;
  readonly completionEligible: boolean;
  readonly completeRequested: boolean;
  readonly fallResets: number;
}

export interface W06PreviewHandle extends PocketPreviewHandle {
  getSnapshot(): W06Snapshot;
}

const FINALE_SECONDS = 10;

/** A soft round sprite generated in memory (no asset). */
function softSprite(ctx: PocketWorldContext): THREE.DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      data.set([255, 255, 255, Math.round(Math.max(0, 1 - d) ** 1.6 * 255)], (y * size + x) * 4);
    }
  }
  const tex = ctx.scope.track(new THREE.DataTexture(data, size, size));
  tex.needsUpdate = true;
  return tex;
}

/**
 * W06 Skyborne Gardens.
 *
 * Act I: take a seed parasol from the giant dandelion and glide from the Seed
 * Meadow down to the Cloud Orchard. Act II: ride updrafts up to the Wind
 * Terrace and the Sky Pavilion (a side updraft reaches an optional Lookout
 * Spire and its sky lantern). Act III: glide off the Pavilion into the Great
 * Thermal, rise to the Summit Garden and release the parasol at the cairn: the
 * Great Migration lifts every seed into the golden sky. A cloud door returns
 * home. No jumping, nothing timed; a missed glide returns the visitor softly.
 */
export function createW06WorldFactory(onReady?: (handle: W06PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W06 load aborted', 'AbortError');
    const { scope, root, collision } = ctx;
    const fog = new THREE.FogExp2(0xd6e8f4, 0.0055);
    const scenery = buildW06Scenery(ctx, fog);
    const glow = (hex: number, intensity = 1) => scope.track(new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: hex, emissiveIntensity: intensity }));
    const ground = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9 }));
    const rock = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, flatShading: true }));
    const wood = scope.track(new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.8 }));
    const stone = scope.track(new THREE.MeshStandardMaterial({ color: 0xb7ad9c, roughness: 0.9, flatShading: true }));
    const sprite = softSprite(ctx);

    // ---- Islands.
    const flowerSets = ISLANDS.map((island, i) => buildIsland(ctx, island, { ground, rock, rail: wood }, 600 + i * 17));

    // ---- Updrafts.
    const petalGeo = scope.track(new THREE.PlaneGeometry(0.3, 0.14));
    const petalMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xffe4ee, side: THREE.DoubleSide, roughness: 0.7, emissive: 0xffc0d8, emissiveIntensity: 0.25 }));
    const airMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    const draftVisuals = UPDRAFTS.map((u) => buildUpdraftVisual(ctx, u, petalGeo, petalMat, airMat));
    const ventGeo = scope.track(new THREE.TorusGeometry(1, 0.16, 6, 28));
    for (const u of [UPDRAFT_A, UPDRAFT_SPIRE, UPDRAFT_B]) {
      const vent = new THREE.Mesh(ventGeo, stone);
      vent.rotation.x = Math.PI / 2;
      vent.scale.setScalar(u.r);
      vent.position.set(u.cx, u.base + 0.06, u.cz);
      root.add(vent);
    }

    // ---- Trees (blossoming orchard and garden trees), kept off the walking lines.
    const rand = seededRandom(616);
    const trunkGeo = scope.track(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 7));
    trunkGeo.translate(0, 1.1, 0);
    const crownGeo = scope.track(new THREE.IcosahedronGeometry(1.5, 1));
    const crownMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }));
    const treeSpots: [Island, number, number][] = [];
    for (const island of ISLANDS) {
      if (island.r < 6) continue;
      const count = Math.round(island.r * 0.6);
      for (let k = 0; k < count; k++) {
        const side = k % 2 ? 1 : -1;
        const x = island.cx + side * (3.6 + rand() * (island.r - 5.4));
        const z = island.cz + (rand() - 0.5) * island.r * 1.1;
        if (!onIsland({ ...island, r: island.r - 1.6 }, x, z)) continue;
        treeSpots.push([island, x, z]);
      }
    }
    const trunks = new THREE.InstancedMesh(trunkGeo, wood, treeSpots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sv = new THREE.Vector3();
    const col = new THREE.Color();
    const swellM = new THREE.Matrix4();
    treeSpots.forEach(([island, x, z], i) => {
      trunks.setMatrixAt(i, mtx.makeTranslation(x, island.y, z));
      const sc = 0.8 + rand() * 0.5;
      crowns.setMatrixAt(i, mtx.compose(v.set(x, island.y + 2.6 * sc + 0.4, z), q.identity(), sv.set(sc, sc * 0.85, sc)));
      crowns.setColorAt(i, island.id === 'cloud-orchard' ? col.setHSL(0.94, 0.55, 0.82) : col.setHSL(0.28 + rand() * 0.05, 0.45, 0.42));
      collision.addBox([x, island.y + 1.1, z], [0.35, 1.1, 0.35]);
    });
    trunks.raycast = () => {};
    crowns.raycast = () => {};
    root.add(trunks, crowns);

    // ---- The giant dandelion (seed parasols) and the meadow lip.
    const dandelion = new THREE.Group();
    dandelion.position.set(...PARASOL_POS);
    const stem = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.07, 0.11, 2.6, 8)), scope.track(new THREE.MeshStandardMaterial({ color: 0x7aa860, roughness: 0.7 })));
    stem.position.y = 1.3;
    dandelion.add(stem);
    const spokes: number[] = [];
    const tips: number[] = [];
    const headY = 2.8;
    for (let k = 0; k < 160; k++) {
      const yk = 1 - (k / 159) * 2;
      const rk = Math.sqrt(1 - yk * yk);
      const a = k * 2.39996;
      const dx = Math.cos(a) * rk, dz = Math.sin(a) * rk;
      spokes.push(0, headY, 0, dx * 0.85, headY + yk * 0.85, dz * 0.85);
      tips.push(dx * 0.92, headY + yk * 0.92, dz * 0.92);
    }
    const spokeGeo = scope.track(new THREE.BufferGeometry());
    spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3));
    const spokeLines = new THREE.LineSegments(spokeGeo, scope.track(new THREE.LineBasicMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0.8 })));
    const tipGeo = scope.track(new THREE.BufferGeometry());
    tipGeo.setAttribute('position', new THREE.Float32BufferAttribute(tips, 3));
    const tipPoints = new THREE.Points(tipGeo, scope.track(new THREE.PointsMaterial({ color: 0xffffff, map: sprite, size: 0.22, transparent: true, depthWrite: false })));
    const headCore = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.16, 10, 8)), scope.track(new THREE.MeshStandardMaterial({ color: 0xc9b98a })));
    headCore.position.y = headY;
    // An invisible hit body over the stem so the dandelion can be aimed at anywhere along it.
    const hit = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.4, 0.4, 2.6, 8)), scope.track(new THREE.MeshBasicMaterial({ visible: false })));
    hit.position.y = 1.3;
    dandelion.add(spokeLines, tipPoints, headCore, hit);
    root.add(dandelion);
    collision.addBox([PARASOL_POS[0], 1.3, PARASOL_POS[2]], [0.3, 1.3, 0.3]);
    const garland = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.05, 0.05, MEADOW_LIP_GATE.maxX - MEADOW_LIP_GATE.minX, 6)), glow(0xff9ac0, 0.6));
    garland.rotation.z = Math.PI / 2;
    garland.position.set(0, 0.9, (MEADOW_LIP_GATE.minZ + MEADOW_LIP_GATE.maxZ) / 2);
    root.add(garland);

    // ---- The optional sky lantern on the Lookout Spire.
    const lantern = new THREE.Group();
    lantern.position.set(...LANTERN_POS);
    const lanternPost = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6)), wood);
    lanternPost.position.y = 0.6;
    const lanternMat = glow(0xffb45a, 1.1);
    const lanternBody = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.28, 0.22, 0.55, 12)), lanternMat);
    lanternBody.position.y = 1.45;
    lantern.add(lanternPost, lanternBody);
    root.add(lantern);
    collision.addBox([LANTERN_POS[0], 0.9 + LANTERN_POS[1], LANTERN_POS[2]], [0.3, 0.9, 0.3]);

    // ---- The Seed Cairn and the cloud door on the Summit.
    const cairn = new THREE.Group();
    cairn.position.set(...CAIRN_POS);
    const cairnGeo = scope.track(new THREE.DodecahedronGeometry(1, 0));
    [[0, 0.5, 1.0], [0.1, 1.35, 0.75], [-0.05, 2.0, 0.55]].forEach(([dx, dy, s]) => {
      const stoneMesh = new THREE.Mesh(cairnGeo, stone);
      stoneMesh.position.set(dx, dy, 0);
      stoneMesh.scale.set(s * 1.1, s * 0.6, s);
      cairn.add(stoneMesh);
    });
    const cairnSeedMat = glow(0xfff4c8, 0.4);
    const cairnSeed = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.2, 10, 8)), cairnSeedMat);
    cairnSeed.position.y = 2.45;
    cairn.add(cairnSeed);
    root.add(cairn);
    collision.addBox([CAIRN_POS[0], CAIRN_POS[1] + 1.1, CAIRN_POS[2]], [1.0, 1.1, 1.0]);

    const gate = new THREE.Group();
    gate.position.set(...GATE_POS);
    gate.rotation.y = Math.atan2(-(SUMMIT.cx - GATE_POS[0]), -(SUMMIT.cz - GATE_POS[2]));
    const puffGeo = scope.track(new THREE.IcosahedronGeometry(0.5, 1));
    const doorPuffs = new THREE.InstancedMesh(puffGeo, scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, emissive: 0xffe0c0, emissiveIntensity: 0.4 })), 16);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      doorPuffs.setMatrixAt(k, mtx.compose(v.set(Math.cos(a) * 1.6, 1.9 + Math.sin(a) * 1.6, 0), q.identity(), sv.setScalar(0.8 + (k % 3) * 0.2)));
    }
    const doorVeilMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffd7a8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    const doorVeil = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.45, 36)), doorVeilMat);
    doorVeil.position.y = 1.9;
    gate.add(doorPuffs, doorVeil);
    gate.visible = false;
    root.add(gate);

    // ---- The Great Migration: seeds lift from every island into a slow spiral.
    const seedCount = tierCount(ctx, 1400, 500);
    const seedStart = new Float32Array(seedCount * 3);
    const seedPos = new Float32Array(seedCount * 3);
    const seedOrbit = Array.from({ length: seedCount }, (_, i) => {
      const island = ISLANDS[i % ISLANDS.length];
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (island.r - 0.5);
      seedStart.set([island.cx + Math.cos(a) * d, island.y + 0.3, island.cz + Math.sin(a) * d], i * 3);
      return { phase: rand() * Math.PI * 2, radius: 8 + rand() * 46, height: 30 + rand() * 60, delay: rand() * 0.45 };
    });
    seedPos.set(seedStart);
    const seedGeo = scope.track(new THREE.BufferGeometry());
    seedGeo.setAttribute('position', new THREE.BufferAttribute(seedPos, 3));
    const seedMat = scope.track(new THREE.PointsMaterial({ color: 0xfff0c0, map: sprite, size: 0.9, transparent: true, depthWrite: false, opacity: 0.95 }));
    const migration = new THREE.Points(seedGeo, seedMat);
    migration.frustumCulled = false;
    migration.visible = false;
    migration.raycast = () => {};
    root.add(migration);
    const lanternFlight = new THREE.InstancedMesh(lanternBody.geometry, lanternMat, 14);
    lanternFlight.visible = false;
    lanternFlight.frustumCulled = false;
    root.add(lanternFlight);

    // ---- State and wind.
    const wind = buildWind(ctx);
    const checkpoints: string[] = [];
    let lanternFound = false;
    let summitReached = false;
    let finaleStarted = false;
    let finaleProgress = 0;
    let completionEligible = false;
    let completeRequested = false;
    let fallResets = 0;
    let announcedArrival = false;
    let time = 0;
    const reduced = () => ctx.reducedMotion();
    const lipOpen = () => wind.hasParasol;
    const applyGate = () => collision.setDynamicWall('w06-meadow-lip', lipOpen() ? null : { kind: 'wall', ...MEADOW_LIP_GATE, minY: -1, maxY: 2 });
    applyGate();

    ctx.interaction.register('w06-parasol', {
      object: dandelion,
      label: () => (wind.hasParasol ? 'Seed Parasol Taken' : 'Take a Seed Parasol'),
      description: 'A giant dandelion clock. One of its seeds makes a parasol that turns any fall into a slow glide.',
      activate: () => {
        if (!wind.takeParasol()) return;
        applyGate();
        ctx.announce('You hold a seed parasol. Walk off the open lip to the north and glide down to the Cloud Orchard.', 8);
      },
    });
    ctx.interaction.register('w06-lantern', {
      object: lantern,
      label: () => (lanternFound ? 'Sky Lantern Lit' : 'Light the Sky Lantern'),
      description: 'A paper lantern on the Lookout Spire. Optional: lit lanterns join the Great Migration.',
      activate: () => {
        if (lanternFound) return;
        lanternFound = true;
        ctx.announce('The sky lantern glows. Lanterns will rise with the seeds at the summit.', 6);
      },
    });
    ctx.interaction.register('w06-cairn', {
      object: cairn,
      label: () => (finaleStarted ? 'The Seeds Are Rising' : summitReached ? 'Release the Seed Parasol' : 'Seed Cairn'),
      description: 'A cairn on the Summit Garden. Releasing the parasol here begins the Great Migration.',
      activate: () => {
        if (finaleStarted || !summitReached || !wind.hasParasol) return;
        finaleStarted = true;
        finaleProgress = reduced() ? 1 : 0;
        ctx.announce('You release the parasol. Every seed in the gardens lifts into the wind.', 7);
      },
    });
    ctx.interaction.register('w06-return-gate', {
      object: gate,
      label: () => (completionEligible ? 'Return to the Museum' : 'Cloud Door (closed)'),
      description: 'A door of cloud that opens after the Great Migration. It returns you to the rooftop flight pad.',
      activate: () => {
        if (!completionEligible || completeRequested) return;
        completeRequested = true;
        ctx.requestComplete();
      },
    });

    const onLanding = (island: Island) => {
      const p = ctx.player.position;
      return ctx.player.grounded && onIsland(island, p.x, p.z) && Math.abs(p.y - island.y) < 0.35;
    };
    const snapshot = (): W06Snapshot => ({
      hasParasol: wind.hasParasol, lipOpen: lipOpen(), updraft: wind.updraft, gliding: wind.gliding, rides: wind.rides,
      checkpoints: [...checkpoints], lanternFound, summitReached, finaleStarted, finaleProgress, completionEligible,
      completeRequested, fallResets,
    });
    onReady?.({ getSnapshot: snapshot });

    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      spawnPitch: 0,
      fog,
      background: new THREE.Color(0xd6e8f4),
      fieldOfView: 70,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!announcedArrival) {
          announcedArrival = true;
          ctx.announce('Skyborne Gardens. Take a seed parasol from the giant dandelion.', 8);
        }
        const p = ctx.player.position;
        if (p.y < FALL_RESET_Y) {
          fallResets++;
          ctx.resetToCheckpoint();
          ctx.player.velocity.set(0, 0, 0);
          ctx.announce('The wind carries you softly back to the last island.', 5);
          return;
        }
        wind.fixedUpdate(reduced());
        for (const island of ROUTE_CHECKPOINTS) {
          if (checkpoints.includes(island.id) || !onLanding(island)) continue;
          checkpoints.push(island.id);
          ctx.saveCheckpoint();
          if (island.id === 'cloud-orchard') ctx.announce('The Cloud Orchard. Step into the rising petals: the updraft will lift you.', 7);
          if (island.id === 'wind-terrace') ctx.announce('The Wind Terrace. Another updraft rises to the north.', 6);
          if (island.id === 'sky-pavilion') ctx.announce('The Sky Pavilion. Glide off the north lip into the Great Thermal.', 7);
          if (island.id === SUMMIT.id) {
            summitReached = true;
            ctx.announce('The Summit Garden. Release your seed parasol at the cairn.', 7);
          }
        }
        if (finaleStarted && finaleProgress < 1) finaleProgress = Math.min(1, finaleProgress + dt / FINALE_SECONDS);
        if (finaleStarted && finaleProgress >= 1 && !completionEligible) {
          completionEligible = true;
          ctx.markCompletionEligible();
          gate.visible = true;
          ctx.announce('The seeds are aloft and the gardens glow gold. The cloud door is open: step through to return to the museum.', 8);
        }
      },
      variableUpdate(dt) {
        time += dt;
        const r = reduced();
        const f = finaleProgress;
        const ef = f * f * (3 - 2 * f);
        scenery.update(time, ef, r);
        draftVisuals.forEach((d) => d.update(time, r));
        garland.visible = !lipOpen();
        cairnSeedMat.emissiveIntensity = summitReached && !finaleStarted ? 0.9 + (r ? 0 : 0.3 * Math.sin(time * 2)) : 0.4;
        cairnSeed.visible = !finaleStarted;
        if (!r) dandelion.rotation.y = Math.sin(time * 0.4) * 0.08;

        // Flowers swell as the gardens bloom in the finale.
        if (finaleStarted) {
          const swell = 1 + ef * 0.6;
          swellM.makeScale(swell, swell, swell);
          flowerSets.forEach(({ flowers, flowerBase }) => {
            flowerBase.forEach((base, k) => {
              flowers.setMatrixAt(k, mtx.copy(base).multiply(swellM));
            });
            flowers.instanceMatrix.needsUpdate = true;
          });
        }

        // The Great Migration.
        migration.visible = finaleStarted;
        if (finaleStarted) {
          const spin = r ? 0 : time * 0.12;
          seedOrbit.forEach((o, i) => {
            const t = Math.min(1, Math.max(0, (ef - o.delay) / (1 - o.delay)));
            const e = t * t * (3 - 2 * t);
            const a = o.phase + spin + e * 2.5;
            const tx = SUMMIT.cx + Math.cos(a) * o.radius;
            const tz = SUMMIT.cz + Math.sin(a) * o.radius;
            const ty = SUMMIT.y + o.height * e;
            seedPos[i * 3] = seedStart[i * 3] + (tx - seedStart[i * 3]) * e;
            seedPos[i * 3 + 1] = seedStart[i * 3 + 1] + (ty - seedStart[i * 3 + 1]) * e;
            seedPos[i * 3 + 2] = seedStart[i * 3 + 2] + (tz - seedStart[i * 3 + 2]) * e;
          });
          seedGeo.attributes.position.needsUpdate = true;
        }
        lanternFlight.visible = finaleStarted && lanternFound;
        if (lanternFlight.visible) {
          for (let k = 0; k < 14; k++) {
            const island = ISLANDS[k % ISLANDS.length];
            const a = k * 1.7 + (r ? 0 : time * 0.05);
            lanternFlight.setMatrixAt(k, mtx.makeTranslation(island.cx + Math.cos(a) * (island.r * 0.5), island.y + 2 + ef * (18 + k * 2.5), island.cz + Math.sin(a) * (island.r * 0.5)));
          }
          lanternFlight.instanceMatrix.needsUpdate = true;
        }
        lanternMat.emissiveIntensity = lanternFound ? 1.8 + (r ? 0 : 0.2 * Math.sin(time * 3)) : 0.7;
        if (gate.visible && !r) doorVeilMat.opacity = 0.4 + 0.1 * Math.sin(time * 1.4);
      },
      dispose() {
        collision.setDynamicWall('w06-meadow-lip', null);
      },
    };
  };
}
