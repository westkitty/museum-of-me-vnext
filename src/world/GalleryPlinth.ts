import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ResourceScope } from '../assets/ResourceScope';
import type { Palette } from './palette';

/**
 * Four layered, softly bevelled gallery profiles share one set of geometries
 * across all 35 bays. The existing Museum collider remains authoritative.
 * No additional lights, shader passes or independent interaction surfaces.
 */
export class GalleryPlinthKit {
  private readonly foot: THREE.BufferGeometry;
  private readonly body: THREE.BufferGeometry;
  private readonly seam: THREE.BufferGeometry;
  private readonly cap: THREE.BufferGeometry;

  constructor(scope: ResourceScope) {
    this.foot = scope.track(new RoundedBoxGeometry(2.72, 0.16, 2.72, 2, 0.065));
    this.body = scope.track(new RoundedBoxGeometry(2.57, 0.65, 2.57, 3, 0.13));
    this.seam = scope.track(new RoundedBoxGeometry(2.70, 0.035, 2.70, 2, 0.016));
    this.cap = scope.track(new RoundedBoxGeometry(2.74, 0.09, 2.74, 2, 0.035));
  }

  build(exhibitId: string, palette: Palette): THREE.Group {
    const root = new THREE.Group();
    root.name = 'exhibit-curatorial-plinth:' + exhibitId;
    const layers: readonly [string, THREE.BufferGeometry, THREE.Material, number][] = [
      ['foot', this.foot, palette.trim, 0.08],
      ['mineral-core', this.body, palette.wall, 0.445],
      ['metal-reveal', this.seam, palette.accent, 0.784],
      ['stone-cap', this.cap, palette.floor, 0.853],
    ];
    for (const [name, geometry, material, y] of layers) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'plinth-' + name + ':' + exhibitId;
      mesh.position.y = y;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      root.add(mesh);
    }
    return root;
  }
}
