import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { ExteriorWildlife, BUTTERFLY_PERCH_Y } from '../src/world/exterior/ExteriorWildlife';
import { IslandLandscape, PIER_TRIM_GAP, PATH_LIGHT_SPACING } from '../src/world/exterior/IslandLandscape';
import { WAYMARKER_POSTS, formatWalk, waymarkerText } from '../src/world/exterior/ExteriorWaymarkers';
import { lanternWalkStations } from '../src/world/exterior/ExteriorSignatureFeatures';
import {
  ANCIENT_TREE_CENTER, ISLAND_OUTLINE, PATH_CENTERLINES, PATH_LOOP_LENGTH, PIER_JUNCTION_TO_DOORS,
  distanceToPaths, isSiteLand, walkingDistancesToDoors,
} from '../src/world/exterior/IslandSiteLayout';
import { observerSpot, walkerPoseAt } from '../src/world/AmbientVisitors';
import { PLACEMENTS } from '../src/world/layout';
import { SECRETS } from '../src/content/secrets';

const matrix = new THREE.Matrix4();
function positions(mesh: THREE.InstancedMesh): THREE.Vector3[] {
  return Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix);
  });
}
/** The museum's east/west elevations stand at |x| = 38 ± 0.8 for |z| ≤ 105. */
function insideMuseumShell(x: number, z: number): boolean {
  return Math.abs(x) < 39.2 && Math.abs(z) < 106;
}

describe('uplift2 A — exterior, arrival and ambient life', () => {
  const world = new ExteriorWorld('low');

  it('I1 fingerposts at the island forks carry true walking distances', () => {
    const group = world.root.getObjectByName('exterior-waymarkers')!;
    expect(group).toBeTruthy();
    for (const post of WAYMARKER_POSTS) {
      const node = group.getObjectByName(`waymarker:${post.id}`)!;
      expect(node).toBeTruthy();
      expect(isSiteLand(post.x, post.z)).toBe(true);
      // Clear of the 2.3 m path ribbon and a 0.5 m shoulder.
      expect(distanceToPaths(post.x, post.z)).toBeGreaterThan(2.3 + 0.5 + 0.12);
      // A real (non-walk-through) post.
      expect(world.collision.resolveHorizontal({ x: post.x, y: -0.5, z: post.z }, 0.35, 1.78)).toBe(true);
      const blades = node.children.filter((child) => child.name.startsWith('waymarker-blade:'));
      expect(blades).toHaveLength(post.doubleSided ? 2 : 1);
      expect(String(node.userData.subtitle)).toMatch(/about \d/);
    }
    // Both ways round from any point add up to the whole loop plus two door legs.
    const rear = WAYMARKER_POSTS.find((post) => post.id === 'rear-garden')!;
    const d = walkingDistancesToDoors(rear.x, rear.z);
    const lateral = distanceToPaths(rear.x, rear.z);
    expect(d.east + d.west).toBeCloseTo(PATH_LOOP_LENGTH + 2 * PIER_JUNCTION_TO_DOORS + 2 * lateral, 0);
    expect(waymarkerText(rear).subtitle).toContain(formatWalk(d.west));
    expect(waymarkerText(rear).subtitle).toContain(formatWalk(d.east));
    expect(formatWalk(243)).toBe('about 240 m');
    expect(formatWalk(1149)).toBe('about 1.1 km');
    // The east pier blade lists its landmarks nearest first.
    const east = waymarkerText(WAYMARKER_POSTS[0]).subtitle.match(/about (\d+)/g)!.map((s) => Number(s.slice(6)));
    expect(east).toEqual([...east].sort((a, b) => a - b));
  });

  it('I1 the pier edge trim opens where the loop crosses the pier', () => {
    const [from, to] = PIER_TRIM_GAP;
    for (const side of [-1, 1]) {
      for (const name of [`pier-edge-${side}`, `pier-edge-north-${side}`]) {
        const edge = world.root.getObjectByName(name) as THREE.Mesh;
        const half = (edge.geometry as THREE.BoxGeometry).parameters.depth / 2;
        const lo = edge.position.z - half, hi = edge.position.z + half;
        expect(hi <= from + 1e-6 || lo >= to - 1e-6).toBe(true);
      }
    }
    // The rendered path centreline crosses x = ±5.35 inside the gap.
    for (const [index, end] of [[0, 0], [PATH_CENTERLINES.length - 1, 1]] as const) {
      const pts = PATH_CENTERLINES[index];
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
      for (let i = 0; i <= 400; i++) {
        const p = curve.getPoint(end ? 1 - i / 400 : i / 400);
        if (Math.abs(p.x) >= 5.35) {
          expect(p.z).toBeGreaterThan(from + 2.3 * 0.5);
          expect(p.z).toBeLessThan(to - 0.5);
          break;
        }
      }
    }
  });

  it('I2 path edge lights keep an even walking rhythm on both sides, with a lit junction', () => {
    const lights = world.root.getObjectByName('path-ground-light-instances') as THREE.InstancedMesh;
    const ids = lights.userData.sourceMarkerIds as string[];
    expect(ids.filter((id) => id.startsWith('path-junction-light-'))).toHaveLength(4);
    const pts = positions(lights);
    let left = 0, right = 0;
    for (const p of pts) {
      // Side relative to the nearest path segment.
      let best = Infinity, sign = 0;
      for (const line of PATH_CENTERLINES) {
        for (let i = 0; i < line.length - 1; i++) {
          const [ax, az] = line[i], [bx, bz] = line[i + 1];
          const dx = bx - ax, dz = bz - az;
          const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz)));
          const d = Math.hypot(p.x - ax - dx * t, p.z - az - dz * t);
          if (d < best) { best = d; sign = Math.sign(dx * (p.z - az) - dz * (p.x - ax)); }
        }
      }
      if (sign > 0) left++; else right++;
    }
    expect(Math.min(left, right) / pts.length).toBeGreaterThan(0.35);
    // Consecutive lights on one path are one spacing apart along the path (±25%).
    const path1 = pts.filter((_, i) => ids[i].startsWith('path-ground-light-1-'));
    for (let i = 1; i < path1.length; i++) {
      const gap = path1[i].distanceTo(path1[i - 1]);
      expect(gap).toBeGreaterThan(PATH_LIGHT_SPACING * 0.75);
      expect(gap).toBeLessThan(PATH_LIGHT_SPACING * 1.25 + 2 * 2.7);
    }
  });

  it('I3 wildlife moves with individual variation, inside its bounds, facing where it goes', () => {
    const scope = new ResourceScope('uplift2-a-wildlife');
    const life = new ExteriorWildlife(scope, 'high');
    const fish = life.root.getObjectByName('lagoon-fish-school') as THREE.InstancedMesh;
    const butterflies = life.root.getObjectByName('island-butterflies') as THREE.InstancedMesh;
    const birds = life.root.getObjectByName('coastal-bird-flocks') as THREE.InstancedMesh;
    const radii: number[][] = [[], [], []];
    const perched = new Set<number>(), flew = new Set<number>();
    let aligned = 0, total = 0;
    let prev = positions(fish);
    const far: readonly [number, number, number] = [0, 2, -250];
    for (let step = 0; step < 900; step++) {
      life.update(0.05, far, false);
      if (step % 3) continue;
      const nowFish = positions(fish);
      nowFish.forEach((p, i) => {
        const s = life.site('fish', i);
        const r = Math.hypot(p.x - s.x, p.z - s.z);
        expect(r).toBeLessThanOrEqual(s.radius + 1e-4);
        if (i === 0) radii[0].push(r);
        const v = p.clone().sub(prev[i]);
        if (v.length() > 1e-3) {
          fish.getMatrixAt(i, matrix);
          const nose = new THREE.Vector3().setFromMatrixColumn(matrix, 2).normalize();
          total++;
          if (nose.dot(v.normalize()) > 0.8) aligned++;
        }
      });
      prev = nowFish;
      positions(butterflies).forEach((p, i) => {
        const s = life.site('butterfly', i);
        expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeLessThanOrEqual(s.radius + 1e-4);
        if (i === 0) radii[1].push(Math.hypot(p.x - s.x, p.z - s.z));
        if (Math.abs(p.y - BUTTERFLY_PERCH_Y) < 0.01) perched.add(i); else if (p.y > 1) flew.add(i);
      });
      positions(birds).forEach((p, i) => {
        const s = life.site('bird', i);
        expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeLessThanOrEqual(s.radius + 1e-4);
        if (i === 0) radii[2].push(Math.hypot(p.x - s.x, p.z - s.z));
      });
    }
    // Old motion: perfect circles (constant radius). Now every population varies.
    for (const series of radii) expect(Math.max(...series) - Math.min(...series)).toBeGreaterThan(0.1);
    expect(aligned / total).toBeGreaterThan(0.95);
    // Butterflies both fly and settle to perch.
    expect([...perched].filter((i) => flew.has(i)).length).toBeGreaterThan(20);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('I4 reduced motion settles butterflies, hides birds and resumes cleanly', () => {
    const scope = new ResourceScope('uplift2-a-rest');
    const life = new ExteriorWildlife(scope, 'medium');
    const butterflies = life.root.getObjectByName('island-butterflies') as THREE.InstancedMesh;
    const birds = life.root.getObjectByName('coastal-bird-flocks') as THREE.InstancedMesh;
    life.update(0.5, [0, 2, 0], false);
    life.update(0.05, [0, 2, 0], true);
    expect(life.isResting).toBe(true);
    expect(birds.visible).toBe(false);
    for (const p of positions(butterflies)) expect(p.y).toBeCloseTo(BUTTERFLY_PERCH_Y, 5);
    const rest = Array.from(butterflies.instanceMatrix.array);
    life.update(1, [0, 2, 0], true);
    expect(Array.from(butterflies.instanceMatrix.array)).toEqual(rest);
    life.setQuality('high');
    for (const p of positions(butterflies)) expect(p.y).toBeCloseTo(BUTTERFLY_PERCH_Y, 5);
    life.update(0.05, [0, 2, 0], false);
    expect(life.isResting).toBe(false);
    expect(birds.visible).toBe(true);
    scope.dispose();
  });

  it('I5 butterflies lift away from a visitor; fish scatter from the bank', () => {
    const make = (name: string) => {
      const scope = new ResourceScope(name);
      return { scope, life: new ExteriorWildlife(scope, 'low') };
    };
    const a = make('startle-a'), b = make('startle-b');
    const site = a.life.site('butterfly', 0);
    const ba = a.life.root.getObjectByName('island-butterflies') as THREE.InstancedMesh;
    const bb = b.life.root.getObjectByName('island-butterflies') as THREE.InstancedMesh;
    // Prime both to the same time, then stand right in butterfly 0's home in one copy.
    const eye: [number, number, number] = [site.x, site.height, site.z];
    for (let i = 0; i < 60; i++) {
      a.life.update(0.05, eye, false);
      b.life.update(0.05, [0, 2, -250], false);
    }
    const pa = positions(ba)[0], pb = positions(bb)[0];
    const eyeV = new THREE.Vector3(...eye);
    expect(pa.distanceTo(eyeV)).toBeGreaterThan(pb.distanceTo(eyeV) + 0.3);
    expect(pa.distanceTo(pb)).toBeLessThan(3.5);

    const fa = make('flee-a'), fb = make('flee-b');
    const fishSite = fa.life.site('fish', 0);
    const fishA = fa.life.root.getObjectByName('lagoon-fish-school') as THREE.InstancedMesh;
    const fishB = fb.life.root.getObjectByName('lagoon-fish-school') as THREE.InstancedMesh;
    for (let i = 0; i < 60; i++) {
      fa.life.update(0.05, [fishSite.x, 1.6, fishSite.z], false);
      fb.life.update(0.05, [0, 2, -250], false);
    }
    expect(positions(fishA)[0].distanceTo(positions(fishB)[0])).toBeGreaterThan(0.2);
    for (const { scope } of [a, b, fa, fb]) scope.dispose();
  });

  it('I6 coastal outcrops follow coast length in irregular clusters', () => {
    for (const tier of ['low', 'high'] as const) {
      const scope = new ResourceScope(`rocks-${tier}`);
      const root = new IslandLandscape(scope, new CollisionWorld(), tier).build();
      const rocks = positions(root.getObjectByName('shoreline-rock-scatter') as THREE.InstancedMesh);
      expect(rocks.length).toBeGreaterThan(tier === 'low' ? 80 : 240);
      const edges = ISLAND_OUTLINE.map(([ax, az], i) => {
        const [bx, bz] = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length];
        return { ax, az, bx, bz, length: Math.hypot(bx - ax, bz - az), count: 0 };
      });
      for (const p of rocks) {
        let best = Infinity, owner = edges[0];
        for (const edge of edges) {
          const dx = edge.bx - edge.ax, dz = edge.bz - edge.az;
          const t = Math.max(0, Math.min(1, ((p.x - edge.ax) * dx + (p.z - edge.az) * dz) / (dx * dx + dz * dz)));
          const d = Math.hypot(p.x - edge.ax - dx * t, p.z - edge.az - dz * t);
          if (d < best) { best = d; owner = edge; }
        }
        expect(best).toBeLessThan(3.5); // on the waterline, not inland
        owner.count++;
      }
      // No stretch of open coast is left bare.
      const open = edges.filter((edge) => !(edge.az > 150 && Math.abs(edge.ax) < 30)
        && !(edge.bz > 150 && Math.abs(edge.bx) < 30));
      expect(open.filter((edge) => edge.count === 0).length).toBeLessThanOrEqual(tier === 'low' ? 3 : 0);
      // Clustered: the nearest-neighbour distance varies widely (not a kerb).
      const nn = rocks.map((p) => Math.min(...rocks.filter((q) => q !== p).map((q) => q.distanceTo(p))));
      const mean = nn.reduce((s, v) => s + v, 0) / nn.length;
      const sd = Math.sqrt(nn.reduce((s, v) => s + (v - mean) ** 2, 0) / nn.length);
      expect(sd / mean).toBeGreaterThan(0.6);
      scope.dispose();
    }
  });

  it('I7 the arrival axis continues through the doors to the foyer backdrop', () => {
    const runner = world.root.getObjectByName('vestibule-arrival-runner') as THREE.Mesh;
    const walk = world.root.getObjectByName('garden-main-walk') as THREE.Mesh;
    expect(runner).toBeTruthy();
    const runnerBox = new THREE.Box3().setFromObject(runner);
    expect(runnerBox.min.z).toBeLessThan(122.2);
    expect(runnerBox.max.z).toBeGreaterThan(127.9);
    expect(runnerBox.max.x - runnerBox.min.x).toBeCloseTo(new THREE.Box3().setFromObject(walk).max.x * 2, 1);
    const inlays: THREE.Object3D[] = [];
    world.root.traverse((node) => { if (node.name === 'vestibule-axis-inlay') inlays.push(node); });
    expect(inlays.map((node) => Math.abs(node.position.x))).toEqual([4.6, 4.6]);
    const coffers: THREE.Object3D[] = [];
    world.root.traverse((node) => { if (node.name === 'vestibule-soffit-coffer') coffers.push(node); });
    expect(coffers).toHaveLength(3);
    // The old threshold remains walkable, but the new centre is solid.
    // Do not introduce exterior lights: switching a light-bearing world root
    // changed shader variant counts and caused visible-frame compiles.
    expect(world.collision.resolveHorizontal({ x: 0, y: 0, z: 125 }, 0.35, 1.8)).toBe(false);
    expect(world.collision.resolveHorizontal({ x: 0, y: 0, z: 138 }, 0.35, 1.8)).toBe(true);
    const lights: THREE.Light[] = [];
    world.root.traverse((node) => { if ((node as THREE.Light).isLight) lights.push(node as THREE.Light); });
    expect(lights).toHaveLength(0);
  });

  it('I8 ambient walkers keep one real walking pace, pause at corners and turn smoothly', () => {
    const path: [number, number, number][] = [[0, 0, 0], [0, 0, 8], [0, 0, 38], [3, 0, 8]];
    const speed = 1.2, pauses = [2, 3, 1.5, 2.5];
    let prev = walkerPoseAt(path, speed, pauses, 0);
    let stopped = 0;
    for (let t = 0.05; t < 120; t += 0.05) {
      const pose = walkerPoseAt(path, speed, pauses, t);
      const moved = Math.hypot(pose.x - prev.x, pose.z - prev.z) / 0.05;
      if (pose.moving && prev.moving) expect(moved).toBeLessThan(speed * 1.02);
      if (!pose.moving && !prev.moving) {
        stopped++;
        expect(moved).toBeLessThan(1e-9);
      }
      const turn = Math.abs(Math.atan2(Math.sin(pose.yaw - prev.yaw), Math.cos(pose.yaw - prev.yaw)));
      expect(turn).toBeLessThan(0.25); // no heading snaps (old code: up to π in one frame)
      prev = pose;
    }
    expect(stopped).toBeGreaterThan(100);
  });

  it('defects: lantern walk, ancient tree and observers are where a visitor can use them', () => {
    // Lantern pools on the rendered path; bollards outside the building and the ribbon.
    for (const { px, pz, bx, bz } of lanternWalkStations()) {
      expect(distanceToPaths(px, pz)).toBeLessThan(0.8);
      expect(insideMuseumShell(px, pz)).toBe(false);
      expect(insideMuseumShell(bx, bz)).toBe(false);
      expect(isSiteLand(bx, bz)).toBe(true);
    }
    // Ancient tree trunk and roots clear of the east facade, beside the lagoon walk.
    const [tx, , tz] = ANCIENT_TREE_CENTER;
    expect(tx - 3.1).toBeGreaterThan(39.2);
    expect(distanceToPaths(tx, tz)).toBeGreaterThan(2.3 + 0.5 + 3.1);
    const stone = SECRETS.find((secret) => secret.id === 'tree-roots')!;
    if (stone.trigger.kind !== 'object') throw new Error('tree-roots must be an object secret');
    expect(Math.hypot(stone.trigger.position[0] - tx, stone.trigger.position[2] - tz)).toBeLessThan(4.5);
    expect(world.collision.resolveHorizontal({ x: stone.trigger.position[0], y: -0.5, z: stone.trigger.position[2] }, 0.3, 1.78)).toBe(false);
    // Seated observers never occupy the spot the guide route delivers a visitor to.
    for (const placement of PLACEMENTS) {
      const spot = observerSpot(placement);
      expect(Math.hypot(spot.position[0] - placement.visitorSpot[0], spot.position[2] - placement.visitorSpot[2])).toBeGreaterThan(1.5);
      const b = placement.bounds;
      expect(Math.abs(spot.position[0] - b.c[0])).toBeLessThan(b.h[0]);
      expect(Math.abs(spot.position[2] - b.c[2])).toBeLessThan(b.h[2]);
    }
  });
});
