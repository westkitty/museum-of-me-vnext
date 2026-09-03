import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { FLIGHT_PAD_CENTER, PLINTH_TOP_Y } from './layout';

const MAX_MOTES = 18;

interface Mote {
  readonly mesh: THREE.Mesh;
  readonly phase: number;
  readonly radius: number;
}

/**
 * A small, emissive upward dust column that makes the rotunda flight pad read
 * as interactive before it is activated. It is presentation-only: no light,
 * collider, texture, particle framework, or independent animation loop.
 */
export class FlightPadAtmosphere {
  readonly group = new THREE.Group();
  private readonly motes: Mote[] = [];
  private elapsed = 0;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'flight-pad-rising-dust';
    const geometry = this.scope.track(new THREE.SphereGeometry(0.055, 6, 5));
    const material = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0x74dcff,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));

    for (let index = 0; index < MAX_MOTES; index++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'flight-pad-rising-mote';
      this.group.add(mesh);
      this.motes.push({
        mesh,
        phase: ((index * 11) % MAX_MOTES) / MAX_MOTES,
        radius: 0.22 + ((index * 7) % 13) / 13 * 1.2,
      });
    }
    this.update(0, 1, false);
  }

  /** Called by App's existing loop. Reduced motion holds the visible motes still. */
  update(dt: number, detailScale: number, reducedMotion: boolean): void {
    if (!reducedMotion) this.elapsed += dt;
    const visible = Math.max(4, Math.min(MAX_MOTES, Math.round(6 + detailScale * 12)));

    for (let index = 0; index < this.motes.length; index++) {
      const mote = this.motes[index];
      mote.mesh.visible = index < visible;
      if (!mote.mesh.visible) continue;

      const rise = (mote.phase + this.elapsed * 0.2) % 1;
      const angle = mote.phase * Math.PI * 8 + this.elapsed * 0.35;
      mote.mesh.position.set(
        FLIGHT_PAD_CENTER[0] + Math.cos(angle) * mote.radius,
        PLINTH_TOP_Y + 0.12 + rise * 2.15,
        FLIGHT_PAD_CENTER[2] + Math.sin(angle) * mote.radius,
      );
      const scale = 0.45 + (1 - rise) * 0.85;
      mote.mesh.scale.setScalar(scale);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
  }
}
