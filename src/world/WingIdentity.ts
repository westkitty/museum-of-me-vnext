import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PaletteSet } from './palette';
import { WINGS, ROTUNDA_APOTHEM, faceDirection, place, rightOf, type WingSpec, type Vec3 } from './layout';

/**
 * Strong, non-colliding spatial identity at every wing threshold.
 *
 * Colour alone is not enough. Each wing gets a repeated architectural band and
 * a small sculptural motif so visitors can recognise the area by silhouette as
 * well as hue. Everything remains outside the circulation/collision system.
 */
export class WingIdentity {
  readonly group = new THREE.Group();
  private readonly palettes: PaletteSet;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'wing-identity';
    this.palettes = new PaletteSet(scope);
  }

  build(): THREE.Group {
    for (const wing of WINGS) this.buildWing(wing);
    return this.group;
  }

  private buildWing(wing: WingSpec): void {
    const d = faceDirection(wing.face);
    const r = rightOf(d);
    const palette = this.palettes.get(wing.id);
    const y = wing.floorY;
    const angle = Math.atan2(d[0], d[2]);

    // A colour band sits immediately beyond the neutral Rotunda threshold.
    // It makes the transition legible before the visitor reads any signage.
    const bandAt = place(d, ROTUNDA_APOTHEM + 2.0, 0, y);
    const band = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(wing.archWidth + 1.8, 0.34, 0.28)),
      palette.accent,
    );
    band.name = `wing-threshold-band:${wing.id}`;
    band.position.set(bandAt[0], y + wing.archHeight - 0.55, bandAt[2]);
    band.rotation.y = angle;
    this.group.add(band);

    // Paired slim markers reinforce the same family at eye level while leaving
    // the central path completely clear.
    for (const side of [-1, 1]) {
      const at = place(d, ROTUNDA_APOTHEM + 2.2, side * (wing.corridorHalfWidth - 0.48), y);
      const marker = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(0.22, Math.min(4.8, wing.archHeight * 0.62), 0.26)),
        side < 0 ? palette.accent : palette.trim,
      );
      marker.name = `wing-threshold-marker:${wing.id}`;
      marker.position.set(at[0], y + Math.min(2.5, wing.archHeight * 0.32), at[2]);
      marker.rotation.y = angle;
      this.group.add(marker);
    }

    // One authored motif at the near hall edge and a smaller echo near the far
    // end give each wing a recognisable shape language rather than a recolour.
    const near = place(d, wing.hallFrom + 4.5, wing.hallHalfWidth - 1.35, y);
    const far = place(d, wing.hallTo - 5.0, -(wing.hallHalfWidth - 1.35), y);
    this.motif(wing.id, near, y, angle, palette.accent, palette.trim, 1.0);
    this.motif(wing.id, far, y, angle + Math.PI, palette.accent, palette.trim, 0.72);

    // A low trim strip along the first connector metres carries the wing colour
    // from the Rotunda into the hall, avoiding an abrupt single-frame transition.
    for (const side of [-1, 1]) {
      const from = place(d, ROTUNDA_APOTHEM + 1.8, side * (wing.corridorHalfWidth - 0.2), y);
      const to = place(d, wing.hallFrom - 0.8, side * (wing.corridorHalfWidth - 0.2), y);
      const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
      const strip = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(length, 0.18, 0.18)),
        palette.trim,
      );
      strip.name = `wing-transition-strip:${wing.id}`;
      strip.position.set((from[0] + to[0]) / 2, y + 0.22, (from[2] + to[2]) / 2);
      strip.rotation.y = Math.atan2(-(to[2] - from[2]), to[0] - from[0]);
      this.group.add(strip);
    }

    void r;
  }

  private motif(
    id: WingSpec['id'],
    at: Vec3,
    y: number,
    angle: number,
    accent: THREE.Material,
    trim: THREE.Material,
    scale: number,
  ): void {
    const g = new THREE.Group();
    g.name = `wing-motif:${id}`;
    g.position.set(at[0], y, at[2]);
    g.rotation.y = angle;
    g.scale.setScalar(scale);
    this.group.add(g);

    const pedestal = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.7, 0.86, 0.48, 16)),
      trim,
    );
    pedestal.position.y = 0.24;
    g.add(pedestal);

    let geometry: THREE.BufferGeometry;
    switch (id) {
      case 'north':
        geometry = this.scope.track(new THREE.IcosahedronGeometry(0.78, 1));
        break;
      case 'east':
        geometry = this.scope.track(new THREE.OctahedronGeometry(0.82, 0));
        break;
      case 'south':
        geometry = this.scope.track(new THREE.TorusKnotGeometry(0.56, 0.16, 48, 8, 2, 3));
        break;
      case 'west':
        geometry = this.scope.track(new THREE.DodecahedronGeometry(0.76, 0));
        break;
      case 'media':
        geometry = this.scope.track(new THREE.TorusGeometry(0.68, 0.18, 10, 28));
        break;
      case 'infra':
        geometry = this.scope.track(new THREE.CylinderGeometry(0.7, 0.7, 0.85, 6));
        break;
    }

    const sculpture = new THREE.Mesh(geometry, accent);
    sculpture.name = `wing-motif-sculpture:${id}`;
    sculpture.position.y = 1.28;
    sculpture.rotation.set(id === 'media' ? Math.PI / 2 : 0.2, 0.45, 0.12);
    g.add(sculpture);

    const ring = new THREE.Mesh(
      this.scope.track(new THREE.TorusGeometry(0.98, 0.055, 6, 32)),
      trim,
    );
    ring.position.y = 1.28;
    ring.rotation.x = Math.PI / 2.7;
    g.add(ring);
  }
}
