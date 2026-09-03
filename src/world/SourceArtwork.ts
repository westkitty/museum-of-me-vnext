import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { sourceArtworkForExhibit } from '../content/sourceParity';
import { curatedUrl, registerCuratedAssets } from '../assets/curatedAssets';
import { PLACEMENTS } from './layout';

/**
 * Places exact curated rasters on the source-intended exhibit walls and
 * sanctuary identity surfaces. Procedural colour fields remain; they do not
 * replace these bytes.
 */
export class SourceArtwork {
  readonly group = new THREE.Group();
  private readonly loader = new THREE.TextureLoader();

  constructor(
    private readonly scope: ResourceScope,
    exhibitMounts: ReadonlyMap<string, THREE.Group>,
  ) {
    this.group.name = 'source-artwork';
    registerCuratedAssets();
    for (const placement of PLACEMENTS) {
      const raster = sourceArtworkForExhibit(placement.exhibitId);
      if (!raster) continue;
      const mount = exhibitMounts.get(placement.exhibitId);
      const frame = this.framedPlane(raster.id, raster.width ?? 1, raster.height ?? 1, 2.4);
      if (!frame) continue;
      frame.position.set(0, 2.15, 0);
      if (mount) mount.add(frame);
      else {
        frame.position.set(placement.anchor[0], placement.anchor[1] + 2.15, placement.anchor[2]);
        this.group.add(frame);
      }
    }
  }

  framedPlane(id: string, widthPx: number, heightPx: number, heightM: number): THREE.Group | null {
    const url = curatedUrl(id);
    if (!url) return null;
    const aspect = widthPx / Math.max(1, heightPx);
    const w = heightM * aspect;
    const group = new THREE.Group();
    group.name = `source-art:${id}`;
    const frame = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(w + 0.12, heightM + 0.12, 0.06)),
      this.scope.track(new THREE.MeshStandardMaterial({ color: 0x2c261c, roughness: 0.55, metalness: 0.12 })),
    );
    const backing = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(w + 0.02, heightM + 0.02, 0.03)),
      this.scope.track(new THREE.MeshStandardMaterial({ color: 0x111015, roughness: 0.9 })),
    );
    backing.position.z = 0.02;
    const map = typeof document === 'undefined'
      ? null
      : this.loader.load(url);
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      this.scope.track(map);
    }
    const plane = new THREE.Mesh(
      this.scope.track(new THREE.PlaneGeometry(w, heightM)),
      this.scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.86, color: map ? 0xffffff : 0x8a7a5c })),
    );
    plane.position.z = 0.04;
    plane.name = `raster:${id}`;
    group.add(frame, backing, plane);
    return group;
  }
}
