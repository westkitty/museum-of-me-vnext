import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { FLIGHT_PAD_CENTER, PLINTH_TOP_Y } from './layout';

const MAX_MOTES = 18;
const VISIBILITY_RADIUS_SQ = 80 * 80;

interface Mote {
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
  readonly instances: THREE.InstancedMesh;
  private readonly motes: Mote[] = [];
  private readonly transform = new THREE.Object3D();
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

    this.instances = new THREE.InstancedMesh(geometry, material, MAX_MOTES);
    this.instances.name = 'flight-pad-rising-motes';
    this.instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.instances);

    for (let index = 0; index < MAX_MOTES; index++) {
      this.motes.push({
        phase: ((index * 11) % MAX_MOTES) / MAX_MOTES,
        radius: 0.22 + ((index * 7) % 13) / 13 * 1.2,
      });
    }
    this.update(0, 1, false);
  }

  /**
   * Called by App's existing loop. One InstancedMesh replaces eighteen draw
   * submissions, and the tiny effect sleeps entirely when the visitor is far
   * enough away that it cannot contribute to the frame.
   */
  update(
    dt: number,
    detailScale: number,
    reducedMotion: boolean,
    viewerX = FLIGHT_PAD_CENTER[0],
    viewerZ = FLIGHT_PAD_CENTER[2],
  ): void {
    if (!reducedMotion) this.elapsed += dt;

    const dx = viewerX - FLIGHT_PAD_CENTER[0];
    const dz = viewerZ - FLIGHT_PAD_CENTER[2];
    const inRange = dx * dx + dz * dz <= VISIBILITY_RADIUS_SQ;
    this.group.visible = inRange;
    if (!inRange) return;

    const visible = Math.max(4, Math.min(MAX_MOTES, Math.round(6 + detailScale * 12)));
    this.instances.count = visible;

    for (let index = 0; index < visible; index++) {
      const mote = this.motes[index];
      const rise = (mote.phase + this.elapsed * 0.2) % 1;
      const angle = mote.phase * Math.PI * 8 + this.elapsed * 0.35;
      this.transform.position.set(
        FLIGHT_PAD_CENTER[0] + Math.cos(angle) * mote.radius,
        PLINTH_TOP_Y + 0.12 + rise * 2.15,
        FLIGHT_PAD_CENTER[2] + Math.sin(angle) * mote.radius,
      );
      this.transform.scale.setScalar(0.45 + (1 - rise) * 0.85);
      this.transform.updateMatrix();
      this.instances.setMatrixAt(index, this.transform.matrix);
    }
    this.instances.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.instances.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
