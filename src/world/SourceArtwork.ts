import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { sourceArtworkForExhibit } from '../content/sourceParity';
import { curatedUrl, registerCuratedAssets } from '../assets/curatedAssets';
import { PLACEMENTS, type Vec3 } from './layout';

interface PendingArtwork {
  readonly url: string;
  readonly position: Vec3;
  readonly material: THREE.MeshStandardMaterial;
  texture: THREE.Texture | null;
  loading: boolean;
  generation: number;
}

const LOAD_RADIUS_SQ = 120 * 120;
const RELEASE_RADIUS_SQ = 165 * 165;

/**
 * Exact local, curated rasters still occupy their source-authored frames.
 * The mesh and interaction hierarchy are permanent, while image transfer and
 * GPU residency are approached gradually and released well outside the wing.
 * Retains the same curated bytes and never introduces a network dependency.
 */
export class SourceArtwork {
  readonly group = new THREE.Group();
  private readonly loader = new THREE.TextureLoader();
  private readonly pending: PendingArtwork[] = [];
  private elapsed = 0;
  private disposed = false;

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
      const frame = this.framedPlane(
        raster.id, raster.width ?? 1, raster.height ?? 1, 2.4, placement.anchor,
      );
      if (!frame) continue;
      frame.position.set(0, 2.15, 0);
      if (mount) mount.add(frame);
      else {
        frame.position.set(placement.anchor[0], placement.anchor[1] + 2.15, placement.anchor[2]);
        this.group.add(frame);
      }
    }
  }

  /** One image load per call, with a 200ms cadence. */
  update(x: number, z: number, dt: number): void {
    if (this.disposed || typeof document === 'undefined') return;
    this.elapsed += dt;
    if (this.elapsed < 0.2) return;
    this.elapsed = 0;
    let submitted = false;

    for (const entry of this.pending) {
      const dx = entry.position[0] - x;
      const dz = entry.position[2] - z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq > RELEASE_RADIUS_SQ && entry.texture) {
        const texture = entry.texture;
        entry.generation++;
        entry.texture = null;
        entry.loading = false;
        entry.material.map = null;
        entry.material.color.setHex(0x8a7a5c);
        entry.material.needsUpdate = true;
        texture.dispose();
        this.scope.untrack(texture);
      }

      if (submitted || distanceSq > LOAD_RADIUS_SQ || entry.texture || entry.loading) continue;
      entry.loading = true;
      submitted = true;
      const generation = ++entry.generation;
      const texture = this.loader.load(
        entry.url,
        () => {
          if (this.disposed || generation !== entry.generation) return;
          entry.loading = false;
          entry.material.map = texture;
          entry.material.color.setHex(0xffffff);
          entry.material.needsUpdate = true;
        },
        undefined,
        (error) => {
          if (generation !== entry.generation) return;
          console.warn('[Artwork] local curated image unavailable', entry.url, error);
          entry.loading = false;
          if (entry.texture === texture) {
            entry.texture = null;
            texture.dispose();
            this.scope.untrack(texture);
          }
        },
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      entry.texture = this.scope.track(texture);
    }
  }

  framedPlane(
    id: string, widthPx: number, heightPx: number, heightM: number,
    position: Vec3 = [0, 0, 0],
  ): THREE.Group | null {
    const url = curatedUrl(id);
    if (!url) return null;
    const aspect = widthPx / Math.max(1, heightPx);
    const w = heightM * aspect;
    const group = new THREE.Group();
    group.name = 'source-art:' + id;
    const frame = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(w + 0.12, heightM + 0.12, 0.06)),
      this.scope.track(new THREE.MeshStandardMaterial({
        color: 0x2c261c, roughness: 0.55, metalness: 0.12,
      })),
    );
    const backing = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(w + 0.02, heightM + 0.02, 0.03)),
      this.scope.track(new THREE.MeshStandardMaterial({
        color: 0x111015, roughness: 0.9,
      })),
    );
    backing.position.z = 0.02;
    const material = this.scope.track(new THREE.MeshStandardMaterial({
      roughness: 0.86, color: 0x8a7a5c,
    }));
    const plane = new THREE.Mesh(
      this.scope.track(new THREE.PlaneGeometry(w, heightM)),
      material,
    );
    plane.position.z = 0.04;
    plane.name = 'raster:' + id;
    group.add(frame, backing, plane);
    this.pending.push({
      url, position, material, texture: null, loading: false, generation: 0,
    });
    return group;
  }

  get residentCount(): number {
    return this.pending.filter((entry) => !!entry.material.map).length;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.pending) {
      entry.generation++;
      if (entry.texture) {
        entry.texture.dispose();
        this.scope.untrack(entry.texture);
        entry.texture = null;
      }
      entry.loading = false;
    }
    this.pending.length = 0;
    this.group.removeFromParent();
  }
}
