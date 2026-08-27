import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import { type WorkshopPrefabId } from './catalog';
import { validateWorkshopManifestForMuseum } from './conservation';
import {
  canonicalizeWorkshopManifest,
  WORKSHOP_SCHEMA_VERSION,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
} from './schema';

interface PlacementMaterials {
  stone: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
}

export class MuseumPlacements {
  readonly group = new THREE.Group();

  private readonly roots = new Map<string, THREE.Group>();
  private readonly scope = new ResourceScope('museum-placements');
  private manifest: WorkshopPlacementManifest;

  constructor(rawManifest: unknown) {
    this.group.name = 'museum-authored-placements';
    const parsed = validateWorkshopManifestForMuseum(rawManifest);
    if (!parsed.ok || !parsed.value) {
      throw new Error(`Museum Workshop placement manifest is invalid: ${parsed.errors.join('; ')}`);
    }
    this.manifest = parsed.value;
    this.rebuild();
  }

  get objectCount(): number { return this.roots.size; }

  getObject(id: string): THREE.Group | null {
    return this.roots.get(id) ?? null;
  }

  selectableObjects(): readonly THREE.Group[] {
    return [...this.roots.values()];
  }

  captureManifest(): WorkshopPlacementManifest {
    const objects = this.manifest.objects.map((record) => {
      const root = this.roots.get(record.id);
      if (!root) return record;
      return {
        ...record,
        position: [root.position.x, root.position.y, root.position.z] as [number, number, number],
        rotation: [root.rotation.x, root.rotation.y, root.rotation.z] as [number, number, number],
        scale: [root.scale.x, root.scale.y, root.scale.z] as [number, number, number],
      };
    });
    return canonicalizeWorkshopManifest({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects });
  }

  replaceManifest(rawManifest: unknown): WorkshopPlacementManifest {
    const parsed = validateWorkshopManifestForMuseum(rawManifest);
    if (!parsed.ok || !parsed.value) {
      throw new Error(`Museum Workshop placement manifest is invalid: ${parsed.errors.join('; ')}`);
    }
    this.manifest = parsed.value;
    this.rebuild();
    return this.captureManifest();
  }

  setRecord(record: WorkshopPlacementRecord): WorkshopPlacementManifest {
    const current = this.captureManifest();
    const objects = current.objects.filter((item) => item.id !== record.id);
    objects.push(record);
    return this.replaceManifest({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects });
  }

  removeRecord(id: string): WorkshopPlacementManifest {
    const current = this.captureManifest();
    return this.replaceManifest({
      schemaVersion: WORKSHOP_SCHEMA_VERSION,
      objects: current.objects.filter((record) => record.id !== id),
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.roots.clear();
    this.scope.dispose();
  }

  private rebuild(): void {
    this.group.clear();
    this.roots.clear();
    this.scope.releaseAll();
    const materials = this.createMaterials();

    for (const record of this.manifest.objects) {
      const root = this.buildPrefab(record.prefab, materials);
      root.name = `workshop:${record.id}`;
      root.userData.workshopId = record.id;
      root.userData.workshopPrefab = record.prefab;
      root.position.set(...record.position);
      root.rotation.set(...record.rotation);
      root.scale.set(...record.scale);
      root.traverse((node) => {
        node.userData.workshopId = record.id;
      });
      this.scope.trackObject(root);
      this.group.add(root);
      this.roots.set(record.id, root);
    }
  }

  private createMaterials(): PlacementMaterials {
    return {
      stone: this.scope.track(new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.78, metalness: 0.05 })),
      dark: this.scope.track(new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.68, metalness: 0.22 })),
      wood: this.scope.track(new THREE.MeshStandardMaterial({ color: 0x4a3528, roughness: 0.82, metalness: 0.02 })),
      accent: this.scope.track(new THREE.MeshStandardMaterial({
        color: 0x168bb2,
        emissive: 0x062c3a,
        emissiveIntensity: 0.55,
        roughness: 0.48,
        metalness: 0.18,
      })),
    };
  }

  private buildPrefab(prefab: WorkshopPrefabId, materials: PlacementMaterials): THREE.Group {
    const root = new THREE.Group();
    switch (prefab) {
      case 'display-plinth': {
        root.add(this.mesh(new THREE.CylinderGeometry(0.78, 0.88, 1.02, 12), materials.stone, [0, 0.51, 0]));
        root.add(this.mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.08, 12), materials.accent, [0, 1.06, 0]));
        break;
      }
      case 'museum-bench': {
        root.add(this.mesh(new THREE.BoxGeometry(2.2, 0.18, 0.72), materials.wood, [0, 0.68, 0]));
        for (const x of [-0.78, 0.78]) {
          for (const z of [-0.23, 0.23]) {
            root.add(this.mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), materials.dark, [x, 0.31, z]));
          }
        }
        break;
      }
      case 'sign-post': {
        root.add(this.mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.08, 12), materials.stone, [0, 0.04, 0]));
        root.add(this.mesh(new THREE.BoxGeometry(0.09, 1.45, 0.09), materials.dark, [0, 0.76, 0]));
        root.add(this.mesh(new THREE.BoxGeometry(1.25, 0.48, 0.08), materials.accent, [0, 1.54, 0]));
        break;
      }
      case 'artifact-table': {
        root.add(this.mesh(new THREE.BoxGeometry(1.65, 0.1, 1.0), materials.stone, [0, 0.88, 0]));
        for (const x of [-0.66, 0.66]) {
          for (const z of [-0.34, 0.34]) {
            root.add(this.mesh(new THREE.BoxGeometry(0.11, 0.84, 0.11), materials.dark, [x, 0.42, z]));
          }
        }
        break;
      }
    }
    return root;
  }

  private mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: readonly [number, number, number],
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
