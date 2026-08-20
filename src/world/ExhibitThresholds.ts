import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { WingId } from '../content/types';
import { PLACEMENTS, WING_BY_ID, faceDirection, rightOf, type Vec3 } from './layout';

const FAMILY: Record<WingId, readonly number[]> = {
  north: [0x8176d9, 0x9e91ef, 0x566bd6, 0xc2a6e8],
  east: [0x45a39e, 0x66c7c0, 0x4f8fa2, 0x8ad6bd],
  south: [0xd86847, 0xee8d52, 0xc44e55, 0x9ebd67],
  west: [0x9b6da9, 0xc28ab6, 0x755690, 0xd1a394],
  media: [0xc9913f, 0xe1b45c, 0xc97855, 0xe2cf80],
  infra: [0x6d9b65, 0x8abd78, 0x4f8070, 0xb1c982],
};

/**
 * Gives each exhibit a small colour signature derived from its containing wing.
 * The result is variation without visual anarchy: every threshold is recognisably
 * part of its wing, but neighbouring exhibits do not collapse into one flat hue.
 */
export class ExhibitThresholds {
  readonly group = new THREE.Group();

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'exhibit-threshold-accents';
  }

  build(): THREE.Group {
    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      const d = faceDirection(wing.face);
      const r = rightOf(d);
      const family = FAMILY[placement.wing];
      const seed = numericSeed(placement.exhibitId);
      const primary = family[seed % family.length];
      const secondary = family[(seed + 1 + (seed % 2)) % family.length];
      const primaryMat = this.material(primary, 0.48, 0.18);
      const secondaryMat = this.material(secondary, 0.62, 0.08);
      const y = wing.floorY;
      const sign = placement.side === 'right' ? 1 : -1;

      for (const edge of [-1, 1]) {
        const offset = edge * (wing.bayOpening / 2 + 0.36);
        const at: Vec3 = [
          placement.doorway[0] + d[0] * offset + r[0] * sign * 0.09,
          y + 1.55,
          placement.doorway[2] + d[2] * offset + r[2] * sign * 0.09,
        ];
        const blade = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(0.24, 3.1, 0.18)),
          edge < 0 ? primaryMat : secondaryMat,
        );
        blade.name = `exhibit-accent:${placement.exhibitId}`;
        blade.position.set(at[0], at[1], at[2]);
        blade.rotation.y = Math.atan2(d[0], d[2]);
        this.group.add(blade);
      }

      const header = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(wing.bayOpening + 0.7, 0.18, 0.2)),
        primaryMat,
      );
      header.name = `exhibit-header:${placement.exhibitId}`;
      header.position.set(
        placement.doorway[0] + r[0] * sign * 0.08,
        y + Math.min(wing.bayHeight * 0.72, 4.8),
        placement.doorway[2] + r[2] * sign * 0.08,
      );
      header.rotation.y = Math.atan2(d[0], d[2]);
      this.group.add(header);
    }
    return this.group;
  }

  private material(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    return this.scope.track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }
}

function numericSeed(id: string): number {
  let value = 0;
  for (let i = 0; i < id.length; i++) value = (value * 31 + id.charCodeAt(i)) >>> 0;
  return value;
}
