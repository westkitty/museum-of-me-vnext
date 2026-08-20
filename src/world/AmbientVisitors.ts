import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { WINGS, faceDirection, place, ROTUNDA_APOTHEM, GROUND_Y, LEVEL_1_Y, type Vec3 } from './layout';
import { rng } from '../assets/generators';

/**
 * A few other people in the building (plan §33).
 *
 * Deliberately minimal: a shared rig, authored paths, no AI, no conversation,
 * and no collision with the visitor. They exist so the museum does not feel
 * abandoned. Plan §33 is explicit that an empty finished museum beats a busy
 * broken one, so they are removed entirely on the low quality tier and they
 * hold still under reduced motion.
 */

interface Walker {
  readonly mesh: THREE.Group;
  readonly path: readonly Vec3[];
  readonly speed: number;
  t: number;
}

export class AmbientVisitors {
  readonly group = new THREE.Group();
  private readonly walkers: Walker[] = [];

  constructor(scope: ResourceScope, count: number) {
    this.group.name = 'ambient-visitors';
    if (count <= 0) return;

    const random = rng(90909);
    // One geometry and two materials for everybody. A crowd should not cost
    // more than a crowd's worth of draw calls.
    const bodyGeo = scope.track(new THREE.CapsuleGeometry(0.19, 0.62, 4, 10));
    const headGeo = scope.track(new THREE.SphereGeometry(0.13, 12, 10));
    const materials = [0x5a5266, 0x4a5460, 0x6a5a52, 0x52604f].map((c) =>
      scope.track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })),
    );

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Group();
      const material = materials[i % materials.length];

      const body = new THREE.Mesh(bodyGeo, material);
      body.position.y = 0.92;
      mesh.add(body);

      const head = new THREE.Mesh(headGeo, material);
      head.position.y = 1.48;
      mesh.add(head);

      this.group.add(mesh);
      this.walkers.push({
        mesh,
        path: this.authorPath(i, random),
        speed: 0.5 + random() * 0.3,
        t: random(),
      });
    }
  }

  /** Short authored circuits: rotunda ring, and out and back along a wing. */
  private authorPath(index: number, random: () => number): Vec3[] {
    const ground = WINGS.filter((w) => w.level === 0);
    const upper = WINGS.filter((w) => w.level === 1);

    if (index % 3 === 0) {
      // A slow circuit of the Rotunda's circulation ring.
      const radius = 9 + random() * 3;
      const points: Vec3[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        points.push([Math.sin(a) * radius, GROUND_Y, Math.cos(a) * radius]);
      }
      return points;
    }

    if (index % 5 === 4 && upper.length > 0) {
      // A mezzanine walk.
      const wing = upper[index % upper.length];
      const dir = faceDirection(wing.face);
      return [
        place(dir, ROTUNDA_APOTHEM - 3, 0, LEVEL_1_Y),
        place(dir, wing.hallFrom + 4, 0, LEVEL_1_Y),
        place(dir, wing.hallTo - 4, 0, LEVEL_1_Y),
        place(dir, wing.hallFrom + 4, 0, LEVEL_1_Y),
      ];
    }

    // Out along a wing hall and back.
    const wing = ground[index % ground.length];
    const dir = faceDirection(wing.face);
    const lateral = (random() - 0.5) * wing.hallHalfWidth * 0.7;
    return [
      place(dir, ROTUNDA_APOTHEM + 3, lateral, GROUND_Y),
      place(dir, wing.hallFrom + 10, lateral, GROUND_Y),
      place(dir, Math.min(wing.hallTo - 6, wing.hallFrom + 40), lateral, GROUND_Y),
      place(dir, wing.hallFrom + 10, -lateral, GROUND_Y),
    ];
  }

  get count(): number {
    return this.walkers.length;
  }

  /** Called once per frame from the single loop. */
  update(dt: number, reducedMotion: boolean): void {
    if (reducedMotion || this.walkers.length === 0) return;

    for (const walker of this.walkers) {
      const n = walker.path.length;
      walker.t = (walker.t + dt * walker.speed * 0.04) % 1;

      const scaled = walker.t * n;
      const i = Math.floor(scaled);
      const f = scaled - i;
      const a = walker.path[i % n];
      const b = walker.path[(i + 1) % n];

      walker.mesh.position.set(
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f,
      );
      // Face the direction of travel.
      walker.mesh.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
      // A gentle gait rather than a slide.
      walker.mesh.children[0].position.y = 0.92 + Math.sin(walker.t * n * Math.PI * 8) * 0.015;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.walkers.length = 0;
  }
}
