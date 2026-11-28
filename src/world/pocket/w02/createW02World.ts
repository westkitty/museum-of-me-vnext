import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addPlatform, addRail, addRamp, inRect, type PocketPreviewHandle } from '../kit/worldKit';
import { buildRootBridge } from './w02Bridge';
import { buildW02Finale } from './w02Finale';
import { buildW02Flora } from './w02Flora';
import { buildW02Landscape } from './w02Landscape';
import {
  BALCONY, CLIMB, EAST_GROUND_RAMP, EAST_SHELF, FALL_RESET_Y, FOSSIL_RAMP, GORGE_EAST,
  isIslandGround, RAMP_A, RAMP_C, RAMP_E, ROUTE_CHECKPOINTS, SADDLE, SEED_POS, SPAWN, SUMMIT, WEST_SHELF,
  type W02RampDef, type W02ShelfDef,
} from './w02Layout';

export interface W02Snapshot {
  readonly bridgeOpen: boolean;
  readonly bridgeGrowth: number;
  readonly bridgeComplete: boolean;
  readonly bridgeSupportedMaxX: number;
  readonly checkpointSaved: boolean;
  readonly fossilFound: boolean;
  readonly crossed: boolean;
  readonly checkpoints: readonly string[];
  readonly summitReached: boolean;
  readonly finaleStarted: boolean;
  readonly finaleProgress: number;
  readonly completionEligible: boolean;
  readonly completeRequested: boolean;
  readonly fallResets: number;
}

export interface W02PreviewHandle extends PocketPreviewHandle {
  getSnapshot(): W02Snapshot;
}

const FINALE_SECONDS = 9;

/** Rock terraces read as strata with a mossy top; root ramps read as wood. */
function paintTerrace(geometry: THREE.BufferGeometry, top: THREE.Color, side: THREE.Color, band: THREE.Color): void {
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    if (nrm.getY(i) > 0.6) c.copy(top);
    else c.copy(side).lerp(band, (Math.floor(pos.getY(i) / 1.3) % 2 === 0) ? 0 : 0.55);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/**
 * W02 Prehistoric Fern Island.
 *
 * Act I: west-coast arrival among tree ferns, the broad root climb, the
 * optional fossil loop. Act II: the root seed grows a bridge across the
 * Veiled Gorge. Act III: switchback terraces to the Elder Fern summit, whose
 * awakening lifts the gorge veil and reveals the island; the root gate then
 * completes the world through the host.
 */
export function createW02WorldFactory(onReady?: (handle: W02PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W02 load aborted', 'AbortError');
    const { scope, collision, root } = ctx;
    const fog = new THREE.FogExp2(0x9fb79f, 0.0105);

    const landscape = buildW02Landscape(ctx, fog);
    // Supported ancient ground: the island halves either side of the gorge.
    collision.addMaskedFloor(-60, 65, -60, 65, 0, isIslandGround);

    const flora = buildW02Flora(ctx);
    if (signal.aborted) throw new DOMException('W02 load aborted', 'AbortError');

    // ---- Route terraces and ramps (visible slab + collider from one definition).
    const terraceMat = scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    const rootRampMat = scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    const mossTop = new THREE.Color(0x4f7a3c);
    const rootTop = new THREE.Color(0x7d5c3c);
    const paint = (mesh: THREE.Mesh, rootLike: boolean) => paintTerrace(mesh.geometry, rootLike ? rootTop : mossTop,
      new THREE.Color(rootLike ? 0x5c4128 : 0x6e5c45), new THREE.Color(rootLike ? 0x4a321f : 0x857155));
    const shelf = (def: W02ShelfDef, rootLike = false) => paint(addPlatform(ctx, rootLike ? rootRampMat : terraceMat, { ...def, depth: def.y + 0.6 }), rootLike);
    const ramp = (def: W02RampDef, rootLike = false) => paint(addRamp(ctx, rootLike ? rootRampMat : terraceMat, { ...def, depth: Math.min(def.yAtMin, def.yAtMax) + 0.6 }), rootLike);
    ramp(CLIMB, true);
    shelf(WEST_SHELF, true);
    ramp(FOSSIL_RAMP, true);
    shelf(EAST_SHELF, true);
    ramp(EAST_GROUND_RAMP);
    ramp(RAMP_A);
    shelf(BALCONY);
    ramp(RAMP_C);
    shelf(SADDLE);
    ramp(RAMP_E);
    shelf(SUMMIT);

    // Root railings on every edge that drops away (openings where routes join).
    const railMesh = new THREE.InstancedMesh(scope.track(new THREE.CylinderGeometry(0.2, 0.24, 1, 7)), flora.rootMaterial, 48);
    let railCount = 0;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const rail = (x0: number, z0: number, x1: number, z1: number, y: number) => {
      addRail(ctx, x0, z0, x1, z1, y);
      const len = Math.hypot(x1 - x0, z1 - z0);
      q.setFromUnitVectors(up, new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize());
      railMesh.setMatrixAt(railCount++, m.compose(new THREE.Vector3((x0 + x1) / 2, y + 0.62, (z0 + z1) / 2), q, new THREE.Vector3(1, len, 1)));
    };
    // West shelf: gorge-edge stubs either side of the bridge, north edge around the fossil ramp, south edge.
    rail(-4, 0, -4, 2, 2); rail(-4, 10, -4, 12, 2);
    rail(-17, 0, -14, 0, 2); rail(-10, 0, -4, 0, 2); rail(-17, 12, -4, 12, 2);
    // East shelf.
    rail(8, 0, 8, 2, 2); rail(8, 10, 8, 12, 2); rail(8, 0, 12, 0, 2); rail(18, 0, 18, 4, 2); rail(18, 10, 18, 12, 2); rail(8, 12, 18, 12, 2);
    // Fern Balcony.
    rail(8, -24, 8, -14, 6); rail(8, -24, 22, -24, 6); rail(8, -14, 12, -14, 6); rail(18, -14, 22, -14, 6);
    rail(22, -24, 22, -23, 6); rail(22, -17, 22, -14, 6);
    // Root Saddle.
    rail(36, -26, 44, -26, 10); rail(44, -26, 44, -12, 10); rail(36, -26, 36, -23, 10); rail(36, -17, 36, -12, 10);
    rail(36, -12, 37, -12, 10); rail(43, -12, 44, -12, 10);
    // Elder summit lookout.
    rail(32, 2, 37, 2, 14); rail(43, 2, 46, 2, 14); rail(46, 2, 46, 16, 14); rail(32, 16, 46, 16, 14); rail(32, 2, 32, 16, 14);
    railMesh.count = railCount;
    root.add(railMesh);

    // Low fern clumps along terrace margins so the high route reads as overgrown
    // ancient ground, not bare slabs. Decorative only: knee-high, no colliders.
    const margin: [number, number, number][] = [];
    for (const def of [WEST_SHELF, EAST_SHELF, BALCONY, SADDLE, SUMMIT]) {
      const w = def.maxX - def.minX;
      const d = def.maxZ - def.minZ;
      for (let k = 0; k < 10; k++) {
        const t = (k + 0.5) / 10;
        margin.push([def.minX + t * w, def.y, def.minZ + 0.5], [def.minX + t * w, def.y, def.maxZ - 0.5]);
        if (k % 2 === 0) margin.push([def.minX + 0.5, def.y, def.minZ + t * d], [def.maxX - 0.5, def.y, def.minZ + t * d]);
      }
    }
    const clumpMesh = new THREE.InstancedMesh(flora.frondGeometry, flora.frondMaterial, margin.length * 4);
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const at = new THREE.Vector3();
    margin.forEach(([x, y, z], i) => {
      for (let k = 0; k < 4; k++) {
        euler.set(0, k * 1.57 + i * 0.7, 0.7, 'YZX');
        q.setFromEuler(euler);
        const size = 0.9 + ((i * 7 + k) % 5) * 0.12;
        clumpMesh.setMatrixAt(i * 4 + k, m.compose(at.set(x, y + 0.02, z), q, scale.set(size, size, size)));
      }
    });
    root.add(clumpMesh);

    // ---- Act II: the root seed and the growing bridge.
    const bridge = buildRootBridge(ctx, flora.rootMaterial);
    const seedMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xb4e2a0, emissive: 0x3f9366, emissiveIntensity: 0.9 }));
    const seed = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.7, 1)), seedMat);
    seed.position.set(...SEED_POS);
    root.add(seed);
    const seedCradle = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.95, 0.18, 6, 14)), flora.rootMaterial);
    seedCradle.rotation.x = Math.PI / 2;
    seedCradle.position.set(SEED_POS[0], SEED_POS[1] - 0.65, SEED_POS[2]);
    root.add(seedCradle);

    const finale = buildW02Finale(ctx, flora.frondGeometry, flora.frondMaterial, flora.rootMaterial);

    // ---- Route state (owned by the world; the host only stores poses).
    let checkpointSaved = false;
    let fossilFound = false;
    let crossed = false;
    const checkpoints: string[] = [];
    let summitReached = false;
    let finaleStarted = false;
    let finaleProgress = 0;
    let completionEligible = false;
    let completeRequested = false;
    let fallResets = 0;
    let announcedArrival = false;
    let time = 0;

    ctx.interaction.register('w02-root-seed', {
      object: seed,
      label: () => (bridge.open ? (bridge.complete ? 'Root Bridge Grown' : 'The Root Bridge Is Growing') : 'Awaken the Root Bridge'),
      description: 'A living seed at the gorge edge. Awakening it grows a root bridge across the Veiled Gorge.',
      activate: () => {
        if (bridge.open) return;
        bridge.grow(ctx.reducedMotion());
        seedMat.emissiveIntensity = 2.2;
        checkpointSaved = ctx.saveCheckpoint();
        ctx.announce(bridge.complete
          ? 'The root bridge spans the Veiled Gorge. Cross to the eastern shelf.'
          : 'Roots surge out across the Veiled Gorge. Follow the bridge as it grows.', 7);
      },
    });
    ctx.interaction.register('w02-fossil', {
      object: finale.fossil,
      label: () => (fossilFound ? 'Ancient Fossil Studied' : 'Study Ancient Fossil'),
      description: 'An ammonite and a fish skeleton in the stone of an older island. Optional.',
      activate: () => {
        if (fossilFound) return;
        fossilFound = true;
        finale.markFossilStudied();
        ctx.announce('The fossils remember a herd that once crossed this island. The old root ramp east rejoins the climb.', 7);
      },
    });
    ctx.interaction.register('w02-elder-heart', {
      object: finale.heart,
      label: () => (finaleStarted ? (completionEligible ? 'The Elder Fern Is Awake' : 'The Elder Fern Is Waking') : 'Wake the Elder Fern'),
      description: 'The heart of the Elder Fern on the summit. Waking it reveals the ancient island.',
      activate: () => {
        if (finaleStarted || !crossed || !summitReached) return;
        finaleStarted = true;
        finaleProgress = ctx.reducedMotion() ? 1 : 0;
        ctx.announce('The Elder Fern unfurls. The veil lifts from the gorge.', 7);
      },
    });
    ctx.interaction.register('w02-return-gate', {
      object: finale.gate,
      label: () => (completionEligible ? 'Return to the Museum' : 'Root Gate (dormant)'),
      description: 'A root gate that opens once the Elder Fern is awake. It returns you to the Fern Ravine.',
      activate: () => {
        if (!completionEligible || completeRequested) return;
        completeRequested = true;
        ctx.requestComplete();
      },
    });

    const onShelf = (def: W02ShelfDef) => {
      const p = ctx.player.position;
      return ctx.player.grounded && inRect(def, p.x, p.z) && Math.abs(p.y - def.y) < 0.35;
    };

    const snapshot = (): W02Snapshot => ({
      bridgeOpen: bridge.open, bridgeGrowth: bridge.growth, bridgeComplete: bridge.complete,
      bridgeSupportedMaxX: bridge.supportedMaxX, checkpointSaved, fossilFound, crossed,
      checkpoints: [...checkpoints], summitReached, finaleStarted, finaleProgress, completionEligible,
      completeRequested, fallResets,
    });
    onReady?.({ getSnapshot: snapshot });

    return {
      spawnPosition: SPAWN,
      spawnYaw: -Math.PI / 2,
      spawnPitch: 0,
      fog,
      background: new THREE.Color(0x9fb79f),
      fieldOfView: 68,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!announcedArrival) {
          announcedArrival = true;
          ctx.announce('Prehistoric Fern Island. Climb the great root east to the rest shelf above the Veiled Gorge.', 8);
        }
        bridge.fixedUpdate(dt);
        const p = ctx.player.position;
        if (p.y < FALL_RESET_Y) {
          fallResets++;
          ctx.resetToCheckpoint();
          return;
        }
        if (!crossed && bridge.complete && p.x >= GORGE_EAST + 0.5 && onShelf(EAST_SHELF)) crossed = true;
        if (crossed) {
          for (const def of ROUTE_CHECKPOINTS) {
            if (checkpoints.includes(def.id) || !onShelf(def)) continue;
            checkpoints.push(def.id);
            ctx.saveCheckpoint();
            if (def === BALCONY) ctx.announce('From the Fern Balcony the veiled gorge falls away below. The Elder Fern waits on the summit.', 7);
            if (def === SUMMIT) {
              summitReached = true;
              ctx.announce('The Elder Fern summit. Wake the fern at its roots.', 7);
            }
          }
        }
        if (finaleStarted && finaleProgress < 1) finaleProgress = Math.min(1, finaleProgress + dt / FINALE_SECONDS);
        if (finaleStarted && finaleProgress >= 1 && !completionEligible) {
          completionEligible = true;
          ctx.markCompletionEligible();
          finale.showGate();
          ctx.announce('The ancient island is revealed. Step through the root gate to return to the museum.', 8);
        }
      },
      variableUpdate(dt) {
        time += dt;
        const reduced = ctx.reducedMotion();
        landscape.update(time, finaleProgress, reduced);
        flora.update(time, reduced);
        finale.update(time, finaleProgress, finaleStarted, 1, reduced);
        if (!reduced && !bridge.open) seed.rotation.y = time * 0.6;
      },
    };
  };
}

export { RAMP_A, RAMP_C, RAMP_E, SADDLE, SUMMIT };
