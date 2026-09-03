import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PaletteSet } from './palette';
import { WINGS, faceDirection, place, type WingSpec } from './layout';

/**
 * Decorative, non-light-source atmosphere for the themed wings.
 *
 * These fixtures use emissive materials rather than additional scene lights, so
 * they strengthen colour identity without increasing the managed point-light
 * budget or affecting collision/traversal.
 */
export class WingAtmosphere {
  readonly group = new THREE.Group();
  private readonly palettes: PaletteSet;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'wing-atmosphere';
    this.palettes = new PaletteSet(scope);
  }

  build(): THREE.Group {
    for (const wing of WINGS) this.buildWing(wing);
    return this.group;
  }

  private buildWing(wing: WingSpec): void {
    const d = faceDirection(wing.face);
    const palette = this.palettes.get(wing.id);
    const accentColor = (palette.accent as THREE.MeshStandardMaterial).color.getHex();
    const trimColor = (palette.trim as THREE.MeshStandardMaterial).color.getHex();
    const glow = this.glowMaterial(accentColor, 0.38);
    const muted = this.glowMaterial(trimColor, 0.16);
    const span = wing.hallTo - wing.hallFrom;
    const count = Math.max(3, Math.min(7, Math.round(span / 18)));
    const angle = Math.atan2(d[0], d[2]);

    for (let i = 0; i < count; i++) {
      const along = wing.hallFrom + ((i + 0.5) / count) * span;
      const at = place(d, along, 0, wing.floorY);
      const fixture = new THREE.Mesh(this.fixtureGeometry(wing.id, i), i % 2 === 0 ? glow : muted);
      fixture.name = `wing-ceiling-fixture:${wing.id}`;
      fixture.position.set(at[0], wing.floorY + wing.hallHeight - 1.0, at[2]);
      fixture.rotation.set(Math.PI / 2, angle + i * 0.23, 0);
      this.group.add(fixture);
    }

    // Two broad wall inlays per wing create slower colour beats between the
    // smaller ceiling fixtures. They sit against the walls and never intrude
    // into the walkable centreline.
    for (const [fraction, side] of [[0.33, -1], [0.72, 1]] as const) {
      const along = wing.hallFrom + span * fraction;
      const at = place(d, along, side * (wing.hallHalfWidth - 0.12), wing.floorY);
      const panel = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(Math.min(6.5, span / 5), 2.4, 0.12)),
        muted,
      );
      panel.name = `wing-wall-inlay:${wing.id}`;
      panel.position.set(at[0], wing.floorY + 3.0, at[2]);
      panel.rotation.y = angle + Math.PI / 2;
      this.group.add(panel);
    }

    if (wing.id === 'north') this.buildNorthSparkles(wing, glow);
  }

  /** Static, emissive Starsilk dust: visual atmosphere without another light or frame-loop system. */
  private buildNorthSparkles(wing: WingSpec, material: THREE.Material): void {
    const sparkles = new THREE.Group();
    sparkles.name = 'north-azure-sparkles';
    const geometry = this.scope.track(new THREE.SphereGeometry(0.045, 6, 5));
    const d = faceDirection(wing.face);
    const span = wing.hallTo - wing.hallFrom;

    for (let index = 0; index < 42; index++) {
      const along = wing.hallFrom + ((index * 37) % 101) / 101 * span;
      const side = ((index * 19) % 29) / 29 * (wing.hallHalfWidth * 1.45) - wing.hallHalfWidth * 0.72;
      const at = place(d, along, side, wing.floorY + 1.2 + ((index * 13) % 47) / 47 * (wing.hallHeight - 2.6));
      const sparkle = new THREE.Mesh(geometry, material);
      sparkle.name = 'north-azure-sparkle';
      sparkle.position.set(at[0], at[1], at[2]);
      const scale = 0.55 + ((index * 11) % 10) / 10;
      sparkle.scale.setScalar(scale);
      sparkles.add(sparkle);
    }

    this.group.add(sparkles);
  }

  private fixtureGeometry(id: WingSpec['id'], index: number): THREE.BufferGeometry {
    switch (id) {
      case 'north':
        return this.scope.track(new THREE.OctahedronGeometry(index % 2 === 0 ? 0.42 : 0.32, 0));
      case 'east':
        return this.scope.track(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 6));
      case 'south':
        return this.scope.track(new THREE.TorusGeometry(0.43, 0.11, 7, 18));
      case 'west':
        return this.scope.track(new THREE.DodecahedronGeometry(0.36, 0));
      case 'media':
        return this.scope.track(new THREE.RingGeometry(0.18, 0.46, 20));
      case 'infra':
        return this.scope.track(new THREE.CylinderGeometry(0.38, 0.48, 0.18, 6));
    }
  }

  private glowMaterial(color: number, intensity: number): THREE.MeshStandardMaterial {
    return this.scope.track(new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.52,
      metalness: 0.18,
    }));
  }
}
