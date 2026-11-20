import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import { canRenderText, createFallbackTexture, createTextTexture } from '../../assets/TextTexture';
import {
  ANCIENT_TREE_CENTER, LAND_SUPPORT_Y, PATH_LOOP_LENGTH, projectOntoLoop, walkingDistancesToDoors,
} from './IslandSiteLayout';

/**
 * Physical fingerposts at the island loop's forks. Every distance printed on
 * a blade is measured along the authored path centrelines from the post, so a
 * visitor deciding which way round to walk is told the truth, not a guess.
 */
export interface WaymarkerPost {
  readonly id: 'pier-east' | 'pier-west' | 'rear-garden' | 'spire-junction';
  readonly x: number;
  readonly z: number;
  /** Yaw of the primary blade face (0 = facing south, toward +z). */
  readonly yaw: number;
  /** Second face on the back of the blade, for posts read from both ways. */
  readonly doubleSided: boolean;
}

export const WAYMARKER_POSTS: readonly WaymarkerPost[] = [
  // At the pier junction, both read from the spawn looking north.
  { id: 'pier-east', x: 7.4, z: 188.6, yaw: 0, doubleSided: false },
  { id: 'pier-west', x: -7.4, z: 188.6, yaw: 0, doubleSided: false },
  // Rear garden: read from the path just south of the post.
  { id: 'rear-garden', x: -3.6, z: -113.4, yaw: 0, doubleSided: false },
  // Spire-garden junction: approached from the east (path 3) and the south-west (path 4).
  { id: 'spire-junction', x: -110, z: -44, yaw: Math.PI / 2, doubleSided: true },
];

/** Landmarks named on the pier fingerposts, with their authored centres. */
export const WAYMARKER_LANDMARKS = {
  windGrove: [48, 108],
  wildlifeHide: [55, -14],
  ancientTree: [ANCIENT_TREE_CENTER[0], ANCIENT_TREE_CENTER[2]],
  sundialTerrace: [-34, 134],
  meadow: [-68, 118],
  fernRavine: [-126, -2],
} as const satisfies Record<string, readonly [number, number]>;

/** "about 240 m" / "about 1.1 km" — rounded the way a printed sign would be. */
export function formatWalk(metres: number): string {
  if (metres >= 1000) return `about ${(Math.round(metres / 100) / 10).toFixed(1)} km`;
  return `about ${Math.max(10, Math.round(metres / 10) * 10)} m`;
}

/** Distance along the loop from the pier junction, east-first or west-first. */
function fromJunction([x, z]: readonly [number, number], direction: 'east' | 'west'): number {
  const { s, distance } = projectOntoLoop(x, z);
  return distance + (direction === 'east' ? s : PATH_LOOP_LENGTH - s);
}

export interface WaymarkerText { readonly title: string; readonly subtitle: string }

export function waymarkerText(post: WaymarkerPost): WaymarkerText {
  const L = WAYMARKER_LANDMARKS;
  switch (post.id) {
    case 'pier-east':
      return {
        title: 'Lagoon walk  →',
        subtitle: `Wind grove ${formatWalk(fromJunction(L.windGrove, 'east'))} · `
          + `Wildlife hide ${formatWalk(fromJunction(L.wildlifeHide, 'east'))} · `
          + `Ancient tree ${formatWalk(fromJunction(L.ancientTree, 'east'))}`,
      };
    case 'pier-west':
      return {
        title: '←  Woodland walk',
        subtitle: `Sundial terrace ${formatWalk(fromJunction(L.sundialTerrace, 'west'))} · `
          + `Meadow ${formatWalk(fromJunction(L.meadow, 'west'))} · `
          + `Fern ravine ${formatWalk(fromJunction(L.fernRavine, 'west'))}`,
      };
    case 'rear-garden': {
      const d = walkingDistancesToDoors(post.x, post.z);
      // Facing south: the visitor's left is west.
      return {
        title: 'Museum doors',
        subtitle: `← by the spire garden ${formatWalk(d.west)} · by the lagoon walk ${formatWalk(d.east)} →`,
      };
    }
    case 'spire-junction': {
      const d = walkingDistancesToDoors(post.x, post.z);
      return {
        title: 'Museum doors',
        subtitle: `by the stone circle & lagoon ${formatWalk(d.east)} · by the fern ravine ${formatWalk(d.west)}`,
      };
    }
  }
}

export class ExteriorWaymarkers {
  readonly group = new THREE.Group();

  constructor(private readonly scope: ResourceScope, private readonly collision: CollisionWorld) {
    this.group.name = 'exterior-waymarkers';
  }

  build(): THREE.Group {
    const postMaterial = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x2a2421, roughness: 0.62, metalness: 0.55,
    }));
    const capMaterial = this.scope.track(new THREE.MeshBasicMaterial({ color: 0xffbc78, toneMapped: false }));
    const postGeometry = this.scope.track(new THREE.CylinderGeometry(0.075, 0.1, 2.75, 10));
    const capGeometry = this.scope.track(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10));
    for (const post of WAYMARKER_POSTS) {
      const group = new THREE.Group();
      group.name = `waymarker:${post.id}`;
      group.userData.visualRole = 'exterior-fork-wayfinding';
      group.position.set(post.x, LAND_SUPPORT_Y, post.z);
      group.rotation.y = post.yaw;
      const pole = new THREE.Mesh(postGeometry, postMaterial);
      pole.position.y = 1.375;
      pole.castShadow = true;
      group.add(pole);
      const cap = new THREE.Mesh(capGeometry, capMaterial);
      cap.position.y = 2.79;
      group.add(cap);
      const text = waymarkerText(post);
      group.userData.title = text.title;
      group.userData.subtitle = text.subtitle;
      const faces = post.doubleSided ? [0, Math.PI] : [0];
      for (const turn of faces) {
        const blade = waymarkerSign(this.scope, text.title, text.subtitle);
        blade.name = `waymarker-blade:${post.id}:${turn === 0 ? 'front' : 'back'}`;
        blade.scale.setScalar(0.42);
        blade.rotation.y = turn;
        // Front and back faces sit just either side of the pole.
        const offset = turn === 0 ? 0.11 : -0.11;
        blade.position.set(0, 2.15, offset);
        group.add(blade);
      }
      this.group.add(group);
      // Slim physical post: the blades are above head-height clearance of the shoulder.
      this.collision.addBox([post.x, LAND_SUPPORT_Y + 1.3, post.z], [0.12, 1.3, 0.12]);
    }
    return this.group;
  }
}

/**
 * The same face as the interior wing signs, built from the core text module.
 * The exterior must not import `exhibits/Furniture`: that pulls the exhibit
 * chunk into the cold exterior boot (see tests/browser/exterior-first.e2e.ts).
 */
function waymarkerSign(scope: ResourceScope, name: string, subtitle: string): THREE.Mesh {
  const opts = {
    width: 1080, height: 300, title: name, titleSize: 76, bodySize: 34, align: 'center' as const,
    rule: false, padding: 22, background: '#141118', titleColor: '#e8c65a', color: '#b9b2a5',
  };
  const map = canRenderText() ? createTextTexture(scope, [subtitle], opts) : createFallbackTexture(scope);
  return new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(5.4, 1.5)),
    scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 })),
  );
}
