import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENTS, WING_BY_ID, type ExhibitPlacement } from './layout';
import { PaletteSet } from './palette';

/**
 * Small persistent colour fields inside all 35 exhibit bays.
 *
 * Threshold accents already tell visitors which exhibit they are entering. This
 * layer carries that language behind the hero object itself: a low floor field
 * and a restrained backdrop derived from the containing wing palette. Variant
 * colours are deterministic and stay related to the parent wing rather than
 * becoming thirty-five independent palettes.
 */
export class ExhibitColorFields {
  readonly group = new THREE.Group();
  private readonly palettes: PaletteSet;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'exhibit-color-fields';
    this.palettes = new PaletteSet(scope);
  }

  build(): THREE.Group {
    for (const placement of PLACEMENTS) this.buildField(placement);
    return this.group;
  }

  private buildField(placement: ExhibitPlacement): void {
    const wing = WING_BY_ID.get(placement.wing)!;
    const palette = this.palettes.get(placement.wing);
    const seed = numericSeed(placement.exhibitId);
    const primary = this.derivedMaterial(
      palette.accent as THREE.MeshStandardMaterial,
      palette.trim as THREE.MeshStandardMaterial,
      seed,
      false,
      0.42,
    );
    const complement = this.derivedMaterial(
      palette.accent as THREE.MeshStandardMaterial,
      palette.trim as THREE.MeshStandardMaterial,
      seed,
      true,
      0.68,
    );

    const field = new THREE.Group();
    field.name = `exhibit-color-field:${placement.exhibitId}`;
    this.group.add(field);

    const floor = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(2.35, 2.35, 0.035, 28)),
      primary,
    );
    floor.name = `exhibit-floor-field:${placement.exhibitId}`;
    floor.position.set(placement.anchor[0], wing.floorY + 0.035, placement.anchor[2]);
    floor.receiveShadow = true;
    field.add(floor);

    // `facing` points from the hero toward the hall, so the backdrop moves in
    // the opposite direction until it sits near the bay's far wall.
    const backDistance = wing.bayDepth / 2 - 0.72;
    const bx = placement.anchor[0] - placement.facing[0] * backDistance;
    const bz = placement.anchor[2] - placement.facing[2] * backDistance;
    const width = Math.min(6.4, wing.bayHalfAlong * 0.88);
    const height = Math.min(4.0, wing.bayHeight * 0.4);
    const angle = Math.atan2(placement.facing[0], placement.facing[2]);

    const backdrop = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(width, height, 0.09)),
      complement,
    );
    backdrop.name = `exhibit-backdrop-field:${placement.exhibitId}`;
    backdrop.position.set(bx, wing.floorY + height / 2 + 0.6, bz);
    backdrop.rotation.y = angle;
    backdrop.receiveShadow = true;
    field.add(backdrop);

    // A narrow primary rail prevents the translucent backdrop from reading as
    // an unstructured colour rectangle and visually ties it back to the floor.
    const rail = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(width + 0.28, 0.12, 0.13)),
      primary,
    );
    rail.name = `exhibit-backdrop-rail:${placement.exhibitId}`;
    rail.position.set(bx, wing.floorY + height + 0.68, bz);
    rail.rotation.y = angle;
    field.add(rail);
  }

  private derivedMaterial(
    accentMaterial: THREE.MeshStandardMaterial,
    trimMaterial: THREE.MeshStandardMaterial,
    seed: number,
    complement: boolean,
    opacity: number,
  ): THREE.MeshStandardMaterial {
    const accent = accentMaterial.color.clone();
    const trim = trimMaterial.color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    accent.getHSL(hsl);

    if (complement) {
      const paired = new THREE.Color().setHSL(
        (hsl.h + 0.5 + ((seed % 3) - 1) * 0.018 + 1) % 1,
        Math.max(0.22, hsl.s * 0.72),
        Math.min(0.72, hsl.l + 0.07),
      );
      accent.copy(trim).lerp(paired, 0.58);
    } else {
      accent.setHSL(
        (hsl.h + ((seed % 5) - 2) * 0.014 + 1) % 1,
        Math.min(0.86, hsl.s + ((seed >> 2) % 3) * 0.025),
        Math.max(0.25, Math.min(0.78, hsl.l + (((seed >> 4) % 5) - 2) * 0.018)),
      );
    }

    return this.scope.track(new THREE.MeshStandardMaterial({
      color: accent,
      roughness: complement ? 0.76 : 0.66,
      metalness: complement ? 0.04 : 0.08,
      transparent: true,
      opacity,
      depthWrite: opacity > 0.6,
    }));
  }
}

function numericSeed(id: string): number {
  let value = 0;
  for (let i = 0; i < id.length; i++) value = (value * 33 + id.charCodeAt(i)) >>> 0;
  return value;
}
