import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import { type WorkshopPrefabId } from './catalog';
import { AuthorableSceneRegistry, type AuthorableSceneTransform } from './AuthorableSceneRegistry';
import { validateWorkshopManifestForMuseum } from './conservation';
import {
  canonicalizeWorkshopManifest,
  WORKSHOP_SCHEMA_VERSION,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
  type WorkshopSceneOverride,
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
  private readonly registry: AuthorableSceneRegistry | null;
  private manifest: WorkshopPlacementManifest;

  constructor(rawManifest: unknown, registry: AuthorableSceneRegistry | null = null) {
    this.group.name = 'museum-authored-placements';
    this.registry = registry;
    const parsed = validateWorkshopManifestForMuseum(rawManifest, registry?.entries() ?? []);
    if (!parsed.ok || !parsed.value) {
      throw new Error(`Museum Workshop placement manifest is invalid: ${parsed.errors.join('; ')}`);
    }
    this.manifest = parsed.value;
    this.rebuild();
  }

  get objectCount(): number { return this.roots.size; }

  getObject(id: string): THREE.Object3D | null {
    return this.roots.get(id) ?? this.registry?.get(id)?.root ?? null;
  }

  getSceneEntry(id: string) {
    return this.registry?.get(id) ?? null;
  }

  sceneEntries() {
    return this.registry?.entries() ?? [];
  }

  selectableObjects(): readonly THREE.Object3D[] {
    return [...this.roots.values(), ...(this.registry?.selectableObjects() ?? [])];
  }

  authorableEntryForObject(object: THREE.Object3D | null) {
    return this.registry?.entryForObject(object) ?? null;
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
    const sceneOverrides: WorkshopSceneOverride[] = [];
    const saved = new Map((this.manifest.sceneOverrides ?? []).map((override) => [override.id, override]));
    for (const entry of this.registry?.entries() ?? []) {
      const transform = this.registry?.capture(entry.id);
      if (!transform) continue;
      if (saved.has(entry.id) || !transformsEqual(transform, entry.baseline)) {
        sceneOverrides.push({ id: entry.id, ...transform });
      }
    }
    return canonicalizeWorkshopManifest({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects, sceneOverrides });
  }

  replaceManifest(rawManifest: unknown): WorkshopPlacementManifest {
    const parsed = validateWorkshopManifestForMuseum(rawManifest, this.registry?.entries() ?? []);
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
    return this.replaceManifest({
      schemaVersion: WORKSHOP_SCHEMA_VERSION,
      objects,
      sceneOverrides: current.sceneOverrides,
    });
  }

  setSceneOverride(id: string, transform: AuthorableSceneTransform): WorkshopPlacementManifest {
    const entry = this.registry?.get(id);
    if (!entry) throw new Error(`Unknown authorable scene object: ${id}`);
    const current = this.captureManifest();
    const sceneOverrides = current.sceneOverrides?.filter((item) => item.id !== id) ?? [];
    sceneOverrides.push({ id, ...transform });
    return this.replaceManifest({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects: current.objects, sceneOverrides });
  }

  removeRecord(id: string): WorkshopPlacementManifest {
    const current = this.captureManifest();
    return this.replaceManifest({
      schemaVersion: WORKSHOP_SCHEMA_VERSION,
      objects: current.objects.filter((record) => record.id !== id),
      sceneOverrides: current.sceneOverrides,
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
    for (const entry of this.registry?.entries() ?? []) this.registry?.apply(entry.id, entry.baseline);
    for (const override of this.manifest.sceneOverrides ?? []) this.registry?.apply(override.id, override);
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

function transformsEqual(a: AuthorableSceneTransform, b: AuthorableSceneTransform): boolean {
  return a.position.every((value, index) => value === b.position[index])
    && a.rotation.every((value, index) => value === b.rotation[index])
    && a.scale.every((value, index) => value === b.scale[index]);
}
