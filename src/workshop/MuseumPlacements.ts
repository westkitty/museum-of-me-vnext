import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import { WorkshopSurfaces, type WorkshopSurfaceSelection } from './WorkshopSurfaces';
import { resolveBuilderResourceUrl } from './builderAssetCatalog';
import { defaultOpening, wallOpeningSegments } from './WallOpenings';
import { createWorkshopActivation } from './BuilderEvents';
import { constructionColliders } from './ConstructionCollision';
import type { CollisionWorld } from '../world/CollisionWorld';
import type { InteractionManager } from '../interaction/InteractionManager';
import { AuthorableSceneRegistry, type AuthorableSceneTransform } from './AuthorableSceneRegistry';
import { validateWorkshopManifestForMuseum } from './conservation';
import {
  canonicalizeWorkshopManifest,
  WORKSHOP_SCHEMA_VERSION,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
  type WorkshopSceneOverride,
  type WorkshopSurfaceOverride,
} from './schema';

interface PlacementMaterials {
  stone: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
}

interface ManagedModel {
  readonly root: THREE.Group;
  readonly placeholder: THREE.Object3D;
  readonly scope: ResourceScope;
  loading: boolean;
  failed: boolean;
}

async function defaultModelLoader(assetId: string): Promise<THREE.Object3D> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  return (await new GLTFLoader().loadAsync(resolveBuilderResourceUrl(assetId))).scene;
}

export class MuseumPlacements {
  readonly group = new THREE.Group();
  readonly surfaces = new WorkshopSurfaces();

  private readonly roots = new Map<string, THREE.Group>();
  private readonly scope = new ResourceScope('museum-placements');
  private readonly registry: AuthorableSceneRegistry | null;
  private manifest: WorkshopPlacementManifest;
  private readonly boundCollisions = new Map<CollisionWorld, Set<string>>();
  private readonly interactionDisposers: Array<() => void> = [];
  private interaction: InteractionManager | null = null;
  private onAnnounce: ((message: string) => void) | null = null;
  private comparingOriginal = false;
  private readonly comparisonSceneTransforms = new Map<string, AuthorableSceneTransform>();
  private rebuildRevision = 0;
  private activeWorld: 'exterior' | 'interior' | null = null;
  private readonly managedModels = new Map<string, ManagedModel>();
  private managedLoadsInFlight = 0;

  constructor(rawManifest: unknown, registry: AuthorableSceneRegistry | null = null,
    private readonly modelLoader: (assetId: string) => Promise<THREE.Object3D> = defaultModelLoader) {
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
  get isComparingOriginal(): boolean { return this.comparingOriginal; }

  /**
   * Reversible, data-preserving visual comparison. The authored manifest is
   * never changed, and there is no second scene or render loop.
   */
  setOriginalComparison(active: boolean): void {
    if (this.comparingOriginal === active) return;
    if (active) {
      this.comparisonSceneTransforms.clear();
      for (const entry of this.registry?.entries() ?? []) {
        const current = this.registry?.capture(entry.id);
        if (current) this.comparisonSceneTransforms.set(entry.id, current);
        this.registry?.apply(entry.id, entry.baseline);
      }
      this.group.visible = false;
    } else {
      for (const [id, transform] of this.comparisonSceneTransforms) {
        this.registry?.apply(id, transform);
      }
      this.comparisonSceneTransforms.clear();
      this.group.visible = true;
    }
    this.comparingOriginal = active;
    this.surfaces.setRevealOriginal(active);
  }

  bindInteractions(manager: InteractionManager, announce: (message: string) => void): void {
    this.interaction = manager;
    this.onAnnounce = announce;
    this.rebuild();
  }

  /** Invoked by the existing App loop; no second frame loop or engine. */
  syncWorld(
    world: 'exterior' | 'interior',
    exterior: CollisionWorld,
    interior?: CollisionWorld,
    exteriorRoot?: THREE.Object3D,
    interiorRoot?: THREE.Object3D,
  ): void {
    const changedWorld = this.activeWorld !== world;
    this.activeWorld = world;
    if (exteriorRoot) this.surfaces.bind('exterior', exteriorRoot);
    if (interiorRoot) this.surfaces.bind('interior', interiorRoot);
    for (const record of this.manifest.objects) {
      const root = this.roots.get(record.id);
      if (root) root.visible = !record.worldId || record.worldId === 'shared' || record.worldId === world;
    }
    if (changedWorld) this.syncManagedModels(world);
    this.syncCollision(exterior, 'exterior');
    if (interior) this.syncCollision(interior, 'interior');
  }

  /**
   * Editing a live solid object through TransformControls mutates the THREE root
   * without rebuilding the declarative manifest. Invalidate the cached dynamic
   * walls so the next existing App tick recomputes their new world-space AABBs.
   * Never touch the museum's static architecture collision geometry.
   */
  invalidateCollisions(): void {
    for (const [world, ids] of this.boundCollisions) {
      for (const id of ids) {
        world.setDynamicWall(id, null);
        world.setDynamicFloor(id, null);
      }
    }
    this.boundCollisions.clear();
  }

  private syncCollision(target: CollisionWorld, world: 'exterior' | 'interior'): void {
    if (this.boundCollisions.has(target)) return;
    const ids = new Set<string>();
    this.boundCollisions.set(target, ids);
    for (const record of this.manifest.objects) {
      if (record.collision !== 'solid') continue;
      if (record.worldId && record.worldId !== 'shared' && record.worldId !== world) continue;
      const root = this.roots.get(record.id);
      if (record.prefab === 'floor-slab' || record.prefab === 'partition-wall') {
        root?.updateWorldMatrix(true, true);
        for (const { id, collider } of constructionColliders(record, root?.matrixWorld)) {
          ids.add(id);
          if (collider.kind === 'floor') target.setDynamicFloor(id, collider);
          else target.setDynamicWall(id, collider);
        }
        continue;
      }
      if (!root) continue;
      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) continue;
      ids.add(record.id);
      target.setDynamicWall(record.id, {
        kind: 'wall', minX: box.min.x, maxX: box.max.x, minY: box.min.y,
        maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z,
      });
    }
  }

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

  surfaceAt(object: THREE.Object3D, world: 'exterior' | 'interior'): WorkshopSurfaceSelection | null {
    return this.surfaces.selectionFor(object, world);
  }

  getSurfaceOverride(id: string): WorkshopSurfaceOverride | null {
    return this.manifest.surfaceOverrides?.find((item) => item.id === id) ?? null;
  }

  setSurfaceOverride(override: WorkshopSurfaceOverride): WorkshopPlacementManifest {
    const current = this.captureManifest();
    const surfaceOverrides = [...(current.surfaceOverrides ?? []).filter((item) => item.id !== override.id), override];
    return this.replaceManifest({ ...current, surfaceOverrides });
  }

  removeSurfaceOverride(id: string): WorkshopPlacementManifest {
    const current = this.captureManifest();
    return this.replaceManifest({
      ...current, surfaceOverrides: (current.surfaceOverrides ?? []).filter((entry) => entry.id !== id),
    });
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
      const transform = this.comparingOriginal
        ? this.comparisonSceneTransforms.get(entry.id)
        : this.registry?.capture(entry.id);
      if (!transform) continue;
      if (saved.has(entry.id) || !transformsEqual(transform, entry.baseline)) {
        sceneOverrides.push({ id: entry.id, ...transform });
      }
    }
    return canonicalizeWorkshopManifest({
      schemaVersion: WORKSHOP_SCHEMA_VERSION, objects, sceneOverrides,
      surfaceOverrides: this.manifest.surfaceOverrides,
    });
  }

  replaceManifest(rawManifest: unknown): WorkshopPlacementManifest {
    this.setOriginalComparison(false);
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
      surfaceOverrides: current.surfaceOverrides,
    });
  }

  setSceneOverride(id: string, transform: AuthorableSceneTransform): WorkshopPlacementManifest {
    const entry = this.registry?.get(id);
    if (!entry) throw new Error(`Unknown authorable scene object: ${id}`);
    const current = this.captureManifest();
    const sceneOverrides = current.sceneOverrides?.filter((item) => item.id !== id) ?? [];
    sceneOverrides.push({ id, ...transform });
    return this.replaceManifest({
      schemaVersion: WORKSHOP_SCHEMA_VERSION, objects: current.objects,
      sceneOverrides, surfaceOverrides: current.surfaceOverrides,
    });
  }

  removeRecord(id: string): WorkshopPlacementManifest {
    const current = this.captureManifest();
    return this.replaceManifest({
      schemaVersion: WORKSHOP_SCHEMA_VERSION,
      objects: current.objects.filter((record) => record.id !== id),
      sceneOverrides: current.sceneOverrides,
      surfaceOverrides: current.surfaceOverrides,
    });
  }

  dispose(): void {
    this.setOriginalComparison(false);
    this.rebuildRevision++;
    this.releaseManagedModels();
    this.surfaces.dispose();
    for (const release of this.interactionDisposers.splice(0)) release();
    for (const [target, ids] of this.boundCollisions) {
      for (const id of ids) {
        target.setDynamicWall(id, null);
        target.setDynamicFloor(id, null);
      }
    }
    this.boundCollisions.clear();
    this.group.removeFromParent();
    this.group.clear();
    this.roots.clear();
    this.scope.dispose();
  }

  private rebuild(): void {
    const revision = ++this.rebuildRevision;
    this.releaseManagedModels();
    for (const release of this.interactionDisposers.splice(0)) release();
    for (const [target, ids] of this.boundCollisions) {
      for (const id of ids) {
        target.setDynamicWall(id, null);
        target.setDynamicFloor(id, null);
      }
    }
    this.boundCollisions.clear();
    this.group.clear();
    this.roots.clear();
    this.scope.releaseAll();
    for (const entry of this.registry?.entries() ?? []) this.registry?.apply(entry.id, entry.baseline);
    for (const override of this.manifest.sceneOverrides ?? []) this.registry?.apply(override.id, override);
    const materials = this.createMaterials();

    for (const record of this.manifest.objects) {
      const root = this.buildPrefab(record, materials);
      if (record.color) {
        root.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh || mesh.userData.workshopImageSurface) return;
          const material = mesh.material;
          if (material instanceof THREE.MeshStandardMaterial) {
            mesh.material = this.scope.track(material.clone());
            (mesh.material as THREE.MeshStandardMaterial).color.set(record.color!);
          }
        });
      }
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
      if (record.event && record.event !== 'none' && this.interaction) {
        const activate = createWorkshopActivation(
          record, root,
          (material) => this.scope.track(material),
          (message) => this.onAnnounce?.(message),
        );
        const release = this.interaction.register(`workshop:${record.id}`, {
          object: root,
          label: () => `${record.event === 'announce' ? 'Inspect' : 'Activate'} ${record.label}`,
          description: `Interact with authored museum object ${record.label}`,
          activate,
        });
        this.interactionDisposers.push(release);
      }
      if (record.prefab === 'catalog-model' && record.assetId) {
        if (record.collision === 'solid' || (record.event && record.event !== 'none')) {
          void this.loadCatalogModel(root, record, revision);
        }
      } else if (record.texture) {
        this.applyRecordFinish(root, record);
      }
      if (record.prefab === 'wall-art' && record.image) {
        const surface = root.getObjectByName('workshop-art-surface') as THREE.Mesh | undefined;
        if (surface) {
          const url = resolveWorkshopMediaUrl(record.image);
          const texture = this.scope.track(new THREE.TextureLoader().load(url, undefined, undefined, () => {
            console.warn('[Museum Builder] artwork missing:', record.image);
          }));
          texture.colorSpace = THREE.SRGBColorSpace;
          surface.material = this.scope.track(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
        }
      }
    }
    this.surfaces.apply(this.manifest.surfaceOverrides ?? []);
    if (this.activeWorld) this.syncManagedModels(this.activeWorld);
  }

  /** Release decoded assets while retaining their lightweight editable roots and saved transforms. */
  private releaseManagedModels(): void {
    for (const state of this.managedModels.values()) {
      state.scope.dispose();
      state.root.clear();
      state.root.add(state.placeholder);
    }
    this.managedModels.clear();
  }

  private syncManagedModels(world: 'exterior' | 'interior'): void {
    const records = this.manifest.objects.filter((record) => record.prefab === 'catalog-model' && record.assetId
      && record.collision !== 'solid' && (!record.event || record.event === 'none'));
    const eligible = new Set(records.filter((record) => !record.worldId || record.worldId === 'shared' || record.worldId === world)
      .map((record) => record.id));
    for (const [id, state] of this.managedModels) {
      if (eligible.has(id)) continue;
      state.scope.dispose();
      state.root.clear();
      state.root.add(state.placeholder);
      this.managedModels.delete(id);
    }
    for (const record of records) {
      if (this.managedLoadsInFlight >= 2) break;
      if (!eligible.has(record.id) || this.managedModels.has(record.id)) continue;
      const root = this.roots.get(record.id);
      const placeholder = root?.children[0];
      if (!root || !placeholder) continue;
      const state: ManagedModel = { root, placeholder, scope: new ResourceScope(`workshop-model:${record.id}`),
        loading: true, failed: false };
      this.managedModels.set(record.id, state);
      this.managedLoadsInFlight++;
      void this.modelLoader(record.assetId!).then((object) => {
        if (state.scope.isDisposed || this.managedModels.get(record.id) !== state) {
          const stale = new ResourceScope('stale-workshop-model');
          stale.trackObject(object); stale.dispose();
          return;
        }
        object.traverse((node) => { node.userData.workshopId = record.id; });
        state.scope.trackObject(object);
        if (record.color || record.texture) this.applyRecordFinish(object, record, state.scope);
        root.clear(); root.add(object);
      }).catch((error: unknown) => {
        if (!state.scope.isDisposed) {
          state.failed = true;
          state.scope.dispose();
          console.warn('[Museum Builder] model could not be loaded:', record.assetId, error);
        }
      }).finally(() => {
        state.loading = false;
        this.managedLoadsInFlight--;
        if (!this.scope.isDisposed && this.activeWorld) this.syncManagedModels(this.activeWorld);
      });
    }
  }

  private applyRecordFinish(root: THREE.Object3D, record: WorkshopPlacementRecord, scope = this.scope): void {
    const url = record.texture ? resolveBuilderResourceUrl(record.texture) : null;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.workshopImageSurface) return;
      const incoming = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = incoming.map((material) => {
        const mat = scope.track(material.clone()) as THREE.MeshStandardMaterial;
        if ('color' in mat && mat.color?.isColor) mat.color.set(record.color ?? '#ffffff');
        if (url && 'map' in mat) {
          const texture = scope.track(new THREE.TextureLoader().load(url, undefined, undefined,
            (error) => console.warn('[Museum Builder] model finish failed', record.texture, error)));
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          mat.map = texture;
        }
        mat.needsUpdate = true;
        return mat;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    });
  }

  private async loadCatalogModel(root: THREE.Group, record: WorkshopPlacementRecord, revision: number): Promise<void> {
    try {
      const object = await this.modelLoader(record.assetId!);
      if (revision !== this.rebuildRevision || this.scope.isDisposed) {
        const stale = new ResourceScope('stale-builder-model');
        stale.trackObject(object);
        stale.dispose();
        return;
      }
      root.clear();
      object.traverse((node) => { node.userData.workshopId = record.id; });
      root.add(object);
      this.scope.trackObject(object);
      if (record.color || record.texture) this.applyRecordFinish(object, record);
      // The true model bounds become available only after the asynchronous
      // load; invalidate old dynamic boxes and let the normal App tick rebind.
      for (const [world, ids] of this.boundCollisions) {
        for (const id of ids) {
          world.setDynamicWall(id, null);
          world.setDynamicFloor(id, null);
        }
      }
      this.boundCollisions.clear();
    } catch (error) {
      console.warn('[Museum Builder] model could not be loaded:', record.assetId, error);
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

  private buildPrefab(record: WorkshopPlacementRecord, materials: PlacementMaterials): THREE.Group {
    const root = new THREE.Group();
    switch (record.prefab) {
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
      case 'catalog-model': {
        // Visible loading proxy is replaced once the self-hosted GLB resolves.
        root.add(this.mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), materials.stone, [0, 0.35, 0]));
        break;
      }
      case 'sculpture-sphere': {
        root.add(this.mesh(new THREE.SphereGeometry(0.5, 24, 16), materials.accent, [0, 0, 0]));
        break;
      }
      case 'partition-wall': {
        const kind = record.opening ?? 'none';
        const fallback = defaultOpening(kind);
        const parts = wallOpeningSegments(kind, {
          width: record.openingWidth ?? fallback.width,
          height: record.openingHeight ?? fallback.height,
          sill: record.openingSill ?? fallback.sill,
        });
        for (const part of parts) {
          root.add(this.mesh(
            new THREE.BoxGeometry(part.width, part.height, 0.15),
            materials.stone, [part.centerX, part.centerY, 0],
          ));
        }
        break;
      }
      case 'floor-slab': {
        root.add(this.mesh(new THREE.BoxGeometry(2, 0.16, 2), materials.stone, [0, -0.08, 0]));
        break;
      }
      case 'roof-panel': {
        root.add(this.mesh(new THREE.BoxGeometry(2, 0.18, 2), materials.wood, [0, 0, 0]));
        break;
      }
      case 'wall-art': {
        const depth = record.depth ?? 0.055;
        root.add(this.mesh(new THREE.BoxGeometry(1.08, 1.08, depth), materials.wood, [0, 0, 0]));
        const surface = this.mesh(new THREE.PlaneGeometry(1, 1), materials.stone, [0, 0, depth / 2 + 0.003]);
        surface.name = 'workshop-art-surface';
        surface.userData.workshopImageSurface = true;
        root.add(surface);
        break;
      }
      case 'wall-panel': {
        root.add(this.mesh(new THREE.BoxGeometry(1, 1, record.depth ?? 0.025), materials.stone, [0, 0, 0]));
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

let cachedEmbeddedWorkshopMedia: Record<string, string> | null = null;

/**
 * Hosted Pages uses its own local static assets. A generated offline HTML
 * contains its authored WebP bytes in a bounded, hash-verified JSON script.
 */
function resolveWorkshopMediaUrl(image: string): string {
  if (cachedEmbeddedWorkshopMedia === null) {
    cachedEmbeddedWorkshopMedia = {};
    const script = document.getElementById('museum-workshop-media');
    if (script?.textContent) {
      try {
        const parsed: unknown = JSON.parse(script.textContent);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          for (const [key, value] of Object.entries(parsed)) {
            if (/^workshop-media\/[0-9a-f]{64}\.webp$/.test(key)
              && typeof value === 'string'
              && value.startsWith('data:image/webp;base64,')) cachedEmbeddedWorkshopMedia[key] = value;
          }
        }
      } catch (error) {
        console.error('[Museum Builder] embedded artwork manifest is invalid', error);
      }
    }
  }
  return cachedEmbeddedWorkshopMedia[image] ?? `${import.meta.env.BASE_URL}${image}`;
}

function transformsEqual(a: AuthorableSceneTransform, b: AuthorableSceneTransform): boolean {
  return a.position.every((value, index) => value === b.position[index])
    && a.rotation.every((value, index) => value === b.rotation[index])
    && a.scale.every((value, index) => value === b.scale[index]);
}
