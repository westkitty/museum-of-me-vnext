import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENTS, WING_BY_ID, faceDirection, rightOf, type Vec3 } from './layout';
import { PaletteSet, type Palette } from './palette';

/**
 * Gives each exhibit a small colour signature derived from its containing wing.
 * The result is variation without visual anarchy: every threshold is recognisably
 * part of its wing, but neighbouring exhibits do not collapse into one flat hue.
 *
 * Colours are hue-jittered variants of the wing's own accent/trim palette
 * (see `ExhibitColorFields`, which uses the identical technique), not an
 * independent hardcoded table -- so a museum-wide palette retune moves the
 * threshold accents along with every other palette-driven layer instead of
 * leaving them visibly off-family.
 */
export class ExhibitThresholds {
  readonly group = new THREE.Group();
  private readonly palettes: PaletteSet;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'exhibit-threshold-accents';
    this.palettes = new PaletteSet(scope);
  }

  build(): THREE.Group {
    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      const d = faceDirection(wing.face);
      const r = rightOf(d);
      const palette = this.palettes.get(placement.wing);
      const seed = numericSeed(placement.exhibitId);
      const primaryMat = this.derivedMaterial(palette, seed, false, 0.48, 0.18);
      const secondaryMat = this.derivedMaterial(palette, seed, true, 0.62, 0.08);
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

  /** Same hue-jitter technique as `ExhibitColorFields.derivedMaterial`: a
   * deterministic variant of the wing's own accent (primary) or a
   * trim-leaning complement, never an independent colour. */
  private derivedMaterial(
    palette: Palette,
    seed: number,
    complement: boolean,
    roughness: number,
    metalness: number,
  ): THREE.MeshStandardMaterial {
    const accent = (palette.accent as THREE.MeshStandardMaterial).color.clone();
    const trim = (palette.trim as THREE.MeshStandardMaterial).color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    accent.getHSL(hsl);
    const color = complement
      ? trim.clone().lerp(
        new THREE.Color().setHSL((hsl.h + 0.5 + ((seed % 3) - 1) * 0.018 + 1) % 1, Math.max(0.22, hsl.s * 0.72), Math.min(0.72, hsl.l + 0.07)),
        0.5,
      )
      : accent.setHSL(
        (hsl.h + ((seed % 5) - 2) * 0.014 + 1) % 1,
        Math.min(0.86, hsl.s + ((seed >> 2) % 3) * 0.025),
        Math.max(0.25, Math.min(0.78, hsl.l + (((seed >> 4) % 5) - 2) * 0.018)),
      );
    return this.scope.track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }
}

function numericSeed(id: string): number {
  let value = 0;
  for (let i = 0; i < id.length; i++) value = (value * 31 + id.charCodeAt(i)) >>> 0;
  return value;
}
