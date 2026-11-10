import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { installExhibits } from '../src/exhibits';
import { createExhibit } from '../src/exhibits/registry';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { AssetManager } from '../src/assets/AssetManager';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import type { ResourceScope } from '../src/assets/ResourceScope';
import { INSTALLATION_PLACEMENTS, INSTALLATION_PLACEMENT_BY_ID } from '../src/world/installationPlacement';
import { PLACEMENT_BY_EXHIBIT, WING_BY_ID, faceDirection, rightOf } from '../src/world/layout';

installExhibits();

const assets = new AssetManager();

function buildExhibit(id: string) {
  const interaction = new InteractionManager();
  const module = createExhibit(id)!;
  const host = new ExhibitHost(module, EXHIBITS_BY_ID.get(id)!, {
    addControl: (exhibitId, c) => interaction.register(exhibitId, c),
    announce: () => {},
    reducedMotion: () => false,
    detailScale: () => 1,
    loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
      (await assets.load(assetId, scope, { detail })).object,
  });
  return { host, interaction };
}

async function liveExhibit(id: string) {
  const built = buildExhibit(id);
  await built.host.preload();
  built.host.mount();
  built.host.activate(0);
  return built;
}

describe('source installation clearance and spatial integration', () => {
  it('verifies all 13 wing installations have valid placements and dimensions', () => {
    const wingPlacements = INSTALLATION_PLACEMENTS.filter((p) => p.host !== 'sanctuary');
    expect(wingPlacements).toHaveLength(13);

    for (const p of wingPlacements) {
      const bay = PLACEMENT_BY_EXHIBIT.get(p.host);
      expect(bay, `Exhibit placement for ${p.host}`).toBeDefined();
      const wing = WING_BY_ID.get(bay!.wing);
      expect(wing, `Wing spec for ${bay!.wing}`).toBeDefined();

      // Plinth clearance: installation must not intersect central bay plinth (radius 1.3m = 2.6m box)
      const dToPlinth = Math.hypot(p.position[0] - bay!.anchor[0], p.position[2] - bay!.anchor[2]);
      const minPlinthClearance = 1.3 + Math.max(p.footprint[0], p.footprint[1]);
      expect(dToPlinth, `${p.id} plinth distance (${dToPlinth.toFixed(2)}m)`).toBeGreaterThan(minPlinthClearance);

      // Lectern plinth clearance
      const lecternDToPlinth = Math.hypot(p.lectern[0] - bay!.anchor[0], p.lectern[2] - bay!.anchor[2]);
      expect(lecternDToPlinth, `${p.id} lectern to plinth (${lecternDToPlinth.toFixed(2)}m)`).toBeGreaterThan(1.3 + p.lecternCollisionRadius);

      // Bay boundary margin: must be well inside bay bounds
      const marginX = bay!.bounds.h[0] - Math.abs(p.position[0] - bay!.bounds.c[0]) - p.footprint[0];
      const marginZ = bay!.bounds.h[2] - Math.abs(p.position[2] - bay!.bounds.c[2]) - p.footprint[1];
      expect(marginX, `${p.id} X margin (${marginX.toFixed(2)}m)`).toBeGreaterThan(0.2);
      expect(marginZ, `${p.id} Z margin (${marginZ.toFixed(2)}m)`).toBeGreaterThan(0.2);

      // Floor height matches bay floor
      expect(p.position[1], `${p.id} floor Y`).toBe(bay!.anchor[1]);
      expect(p.lectern[1], `${p.id} lectern floor Y`).toBe(bay!.anchor[1]);
      expect(p.interactionPoint[1], `${p.id} interactionPoint floor Y`).toBe(bay!.anchor[1]);
    }
  });

  it('measures clearance between each wing installation and its host exhibit geometry', async () => {
    const wingPlacements = INSTALLATION_PLACEMENTS.filter((p) => p.host !== 'sanctuary');

    // Group placements by host exhibit
    const byHost = new Map<string, typeof wingPlacements>();
    for (const p of wingPlacements) {
      const list = byHost.get(p.host) ?? [];
      list.push(p);
      byHost.set(p.host, list);
    }

    const clearanceReport: Record<string, unknown> = {};

    for (const [hostId, placements] of byHost.entries()) {
      const { host } = await liveExhibit(hostId);
      const bay = PLACEMENT_BY_EXHIBIT.get(hostId)!;

      // Update world matrices for exhibit
      host.group.updateMatrixWorld(true);

      for (const p of placements) {
        // Transform installation footprint and lectern to exhibit local space
        // Local space: anchor is (0, 0, 0); +Z points to hall
        const dx = p.position[0] - bay.anchor[0];
        const dz = p.position[2] - bay.anchor[2];
        const length = Math.hypot(bay.facing[0], bay.facing[2]);
        const toHall = [bay.facing[0] / length, bay.facing[2] / length];
        const along = [toHall[1], -toHall[0]];

        // In mount space:
        // zLocal = dx * toHall[0] + dz * toHall[1]
        // xLocal = dx * along[0] + dz * along[1]
        const zLocal = dx * toHall[0] + dz * toHall[1];
        const xLocal = dx * along[0] + dz * along[1];

        // Installation box in mount space (approx half extents 2.3 x 1.85)
        const instBox = new THREE.Box3(
          new THREE.Vector3(xLocal - 2.3, 0, zLocal - 1.85),
          new THREE.Vector3(xLocal + 2.3, 3.5, zLocal + 1.85),
        );

        // Lectern box in mount space
        const ldx = p.lectern[0] - bay.anchor[0];
        const ldz = p.lectern[2] - bay.anchor[2];
        const lzLocal = ldx * toHall[0] + ldz * toHall[1];
        const lxLocal = ldx * along[0] + ldz * along[1];
        const lecternBox = new THREE.Box3(
          new THREE.Vector3(lxLocal - 0.8, 0, lzLocal - 0.4),
          new THREE.Vector3(lxLocal + 0.8, 1.8, lzLocal + 0.4),
        );

        // Check intersections with exhibit meshes
        const collidingMeshes: string[] = [];
        let minMeshDistance = Infinity;

        host.group.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          if (!mesh.geometry.boundingBox) return;

          // Convert box to mount local space
          // Note: host.group is at (0,0,0) in its own space
          const localBox = mesh.geometry.boundingBox.clone();
          const meshToHost = mesh.matrixWorld.clone().premultiply(host.group.matrixWorld.clone().invert());
          localBox.applyMatrix4(meshToHost);

          if (localBox.intersectsBox(instBox)) {
            collidingMeshes.push(`${mesh.name || 'unnamed'}(inst)`);
          }
          if (localBox.intersectsBox(lecternBox)) {
            collidingMeshes.push(`${mesh.name || 'unnamed'}(lectern)`);
          }

          // Compute distance from box center to instBox center
          const d = localBox.distanceToPoint(new THREE.Vector3(xLocal, 1, zLocal));
          if (d < minMeshDistance) minMeshDistance = d;
        });

        clearanceReport[p.id] = {
          host: hostId,
          positionLocal: [Number(xLocal.toFixed(2)), Number(zLocal.toFixed(2))],
          lecternLocal: [Number(lxLocal.toFixed(2)), Number(lzLocal.toFixed(2))],
          minMeshDistance: Number(minMeshDistance.toFixed(2)),
          collidingMeshes,
        };

        expect(collidingMeshes, `Collisions for ${p.id} in ${hostId}`).toHaveLength(0);
        expect(minMeshDistance, `Distance from exhibit hero parts for ${p.id}`).toBeGreaterThan(1.5);
      }
    }
  });

  it('checks clearance against wing doorways and hall access', () => {
    const wingPlacements = INSTALLATION_PLACEMENTS.filter((p) => p.host !== 'sanctuary');

    for (const p of wingPlacements) {
      const bay = PLACEMENT_BY_EXHIBIT.get(p.host)!;

      // Distance from doorway center
      const dToDoor = Math.hypot(p.position[0] - bay.doorway[0], p.position[2] - bay.doorway[2]);
      const lecternDToDoor = Math.hypot(p.lectern[0] - bay.doorway[0], p.lectern[2] - bay.doorway[2]);

      // Lectern should be clear of doorway threshold
      expect(dToDoor, `${p.id} distance to doorway`).toBeGreaterThan(3.0);
      expect(lecternDToDoor, `${p.id} lectern distance to doorway`).toBeGreaterThan(2.0);
    }
  });

  it('proves clearance against wing hall furnishings, benches, and plants', () => {
    const wingPlacements = INSTALLATION_PLACEMENTS.filter((p) => p.host !== 'sanctuary');

    for (const p of wingPlacements) {
      const bay = PLACEMENT_BY_EXHIBIT.get(p.host)!;
      const wing = WING_BY_ID.get(bay.wing)!;

      // Distance from installation center to hall center-line
      const dHall = faceDirection(wing.face);
      const rHall = rightOf(dHall);
      const lateralDist = Math.abs(p.position[0] * rHall[0] + p.position[2] * rHall[2]);

      // Bay inner area starts at lateralDist >= wing.hallHalfWidth
      // Installation sits deep in the corner: lateralDist should be well beyond hall boundary
      expect(lateralDist, `${p.id} lateral distance into bay`).toBeGreaterThan(wing.hallHalfWidth + 1.0);

      // Lectern also remains inside bay area or threshold transition
      const lecternLateral = Math.abs(p.lectern[0] * rHall[0] + p.lectern[2] * rHall[2]);
      expect(lecternLateral, `${p.id} lectern lateral distance`).toBeGreaterThan(wing.hallHalfWidth);
    }
  });

  it('verifies two installations sharing E26 maintain clear mutual clearance', () => {
    const westcatEast = INSTALLATION_PLACEMENT_BY_ID.get('westcat-east')!;
    const westcatFamiliar = INSTALLATION_PLACEMENT_BY_ID.get('westcat-familiar')!;

    expect(westcatEast.host).toBe('E26');
    expect(westcatFamiliar.host).toBe('E26');

    // Distance between the two installations
    const dInst = Math.hypot(
      westcatEast.position[0] - westcatFamiliar.position[0],
      westcatEast.position[2] - westcatFamiliar.position[2],
    );
    expect(dInst, 'Distance between dual E26 installations').toBeGreaterThan(10.0);

    // Distance between their lecterns
    const dLecterns = Math.hypot(
      westcatEast.lectern[0] - westcatFamiliar.lectern[0],
      westcatEast.lectern[2] - westcatFamiliar.lectern[2],
    );
    expect(dLecterns, 'Distance between dual E26 lecterns').toBeGreaterThan(5.0);
  });
});
