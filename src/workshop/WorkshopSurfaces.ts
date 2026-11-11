import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import type { WorkshopSurfaceOverride } from './schema';
import { builderFinishUrl } from './builderAssetCatalog';

type World = 'exterior' | 'interior';
type PaintMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
export interface WorkshopSurfaceSelection {
  readonly id: string;
  readonly worldId: World;
  readonly label: string;
  readonly mesh: PaintMesh;
}

/**
 * Non-destructive material editing for existing world meshes.
 *
 * Meshes are addressed by their deterministic child-index path from an
 * authoritative world root. The original geometry, collider, shared material,
 * and traversal state remain untouched. On revert, restore original materials.
 */
export class WorkshopSurfaces {
  private readonly roots: Partial<Record<World, THREE.Object3D>> = {};
  private readonly originals = new Map<PaintMesh, THREE.Material | THREE.Material[]>();
  private readonly resources = new ResourceScope('builder-surface-finishes');
  private current: readonly WorkshopSurfaceOverride[] = [];
  private reveal = false;

  bind(world: World, root: THREE.Object3D): void {
    if (this.roots[world] === root) return;
    this.restoreAll();
    this.roots[world] = root;
    this.apply(this.current);
  }

  selectionFor(object: THREE.Object3D, world: World): WorkshopSurfaceSelection | null {
    const mesh = object as PaintMesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh
      || (mesh as THREE.SkinnedMesh).isSkinnedMesh || !mesh.material) return null;
    const root = this.roots[world];
    if (!root) return null;
    const indices: number[] = [];
    let node: THREE.Object3D | null = mesh;
    while (node && node !== root) {
      const parent: THREE.Object3D | null = node.parent;
      if (!parent) return null;
      const index = parent.children.indexOf(node);
      if (index < 0) return null;
      indices.unshift(index);
      node = parent;
    }
    if (node !== root || indices.length === 0 || indices.length > 13) return null;
    const id = world + ':' + indices.join('/');
    if (id.length > 140) return null;
    return { id, worldId: world, label: mesh.name || mesh.parent?.name || 'Scene surface', mesh };
  }

  resolve(id: string): WorkshopSurfaceSelection | null {
    const colon = id.indexOf(':');
    const world = id.slice(0, colon) as World;
    if (world !== 'exterior' && world !== 'interior') return null;
    let node: THREE.Object3D | undefined = this.roots[world];
    if (!node) return null;
    for (const value of id.slice(colon + 1).split('/')) {
      if (!/^[0-9]{1,5}$/.test(value)) return null;
      node = node.children[Number(value)];
      if (!node) return null;
    }
    return this.selectionFor(node, world);
  }

  apply(overrides: readonly WorkshopSurfaceOverride[]): void {
    this.restoreAll();
    this.current = overrides;
    if (this.reveal) return;
    for (const override of overrides) {
      const found = this.resolve(override.id);
      if (!found) continue; // e.g. interior still loading or model changed
      const { mesh } = found;
      this.originals.set(mesh, mesh.material);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const copies = materials.map((source) => {
        const mat = this.resources.track(source.clone());
        const paint = mat as THREE.MeshStandardMaterial;
        if ('color' in paint && paint.color?.isColor) {
          if (override.color) paint.color.set(override.color);
          else if (override.texture) paint.color.set('#ffffff');
        }
        if (override.texture && 'map' in paint) {
          const url = builderFinishUrl(override.texture);
          if (url) {
            const image = this.resources.track(new THREE.TextureLoader().load(url, undefined, undefined, (error) => {
              console.warn('[Museum Builder] missing surface finish', override.texture, error);
            }));
            image.colorSpace = THREE.SRGBColorSpace;
            image.wrapS = THREE.RepeatWrapping;
            image.wrapT = THREE.RepeatWrapping;
            image.needsUpdate = true;
            paint.map = image;
          }
        } else if (override.color && 'map' in paint) {
          paint.map = null; // explicit paint is opaque, not tinted by existing artwork
        }
        mat.needsUpdate = true;
        return mat;
      });
      mesh.material = Array.isArray(mesh.material) ? copies : copies[0];
    }
  }

  setRevealOriginal(active: boolean): void {
    if (this.reveal === active) return;
    this.reveal = active;
    this.apply(this.current);
  }

  private restoreAll(): void {
    for (const [mesh, material] of this.originals) mesh.material = material;
    this.originals.clear();
    this.resources.releaseAll();
  }

  dispose(): void {
    this.restoreAll();
    this.resources.dispose();
  }
}
