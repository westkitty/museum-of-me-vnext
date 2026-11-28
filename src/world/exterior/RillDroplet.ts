import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import { GROUND_Y } from '../layout';

/** Where the droplet hangs: over the reflecting rill, in front of W08's registry return pose. */
// Keep the visible drop above the sphere's west walking lane and eye line.
export const RILL_DROPLET_POS: readonly [number, number, number] = [-3.2, GROUND_Y + 3.0, 143.1];

/**
 * The World Inside a Raindrop anchor (W08): a single raindrop suspended in
 * the air over the reflecting rill, with slow rings spreading on the water
 * beneath it. It adds no collider and replaces nothing.
 */
export class RillDroplet {
  readonly group = new THREE.Group();
  /** The interactive target: the drop itself (a generous invisible hit sphere). */
  readonly control: THREE.Group;
  private readonly drop: THREE.Mesh;
  private readonly rings: THREE.Mesh[] = [];
  private readonly ringMat: THREE.MeshBasicMaterial;
  private time = 0;

  constructor(scope: ResourceScope) {
    this.group.name = 'rill-droplet';
    this.group.position.set(RILL_DROPLET_POS[0], GROUND_Y, RILL_DROPLET_POS[2]);
    const control = new THREE.Group();
    control.name = 'rill-droplet-control';
    control.position.y = RILL_DROPLET_POS[1] - GROUND_Y;
    // A teardrop: a sphere drawn up into a point at the top.
    const geo = scope.track(new THREE.SphereGeometry(0.24, 28, 20));
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 0.24;
      if (y > 0) {
        const pinch = 1 - y * 0.78;
        pos.setXYZ(i, pos.getX(i) * pinch, pos.getY(i) * (1 + y * 0.9), pos.getZ(i) * pinch);
      }
    }
    geo.computeVertexNormals();
    this.drop = new THREE.Mesh(geo, scope.track(new THREE.MeshStandardMaterial({
      color: 0xd8f4ff, transparent: true, opacity: 0.62, roughness: 0.04, metalness: 0.1, emissive: 0x6ac8e8, emissiveIntensity: 0.55,
    })));
    const glint = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.05, 10, 8)), scope.track(new THREE.MeshBasicMaterial({ color: 0xffffff })));
    glint.position.set(-0.08, 0.06, 0.16);
    const hit = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.55, 12, 8)), scope.track(new THREE.MeshBasicMaterial({ visible: false })));
    control.add(this.drop, glint, hit);
    this.group.add(control);
    this.control = control;

    this.ringMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xe0f6ff, transparent: true, opacity: 0.4, depthWrite: false }));
    const ringGeo = scope.track(new THREE.RingGeometry(0.9, 1, 48));
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(ringGeo, this.ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      ring.raycast = () => {};
      this.group.add(ring);
      this.rings.push(ring);
    }
    this.update(0, true);
  }

  update(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) this.time += dt;
    const t = this.time;
    this.drop.position.y = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.05;
    this.rings.forEach((ring, k) => {
      const phase = reducedMotion ? (k + 1) / 4 : ((t * 0.25 + k / 3) % 1);
      ring.scale.setScalar(0.15 + phase * 0.6);
      ring.visible = true;
    });
    this.ringMat.opacity = 0.35;
  }
}
