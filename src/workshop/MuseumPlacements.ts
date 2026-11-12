import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import { WorkshopSurfaces, type WorkshopSurfaceSelection } from './WorkshopSurfaces';
import { resolveBuilderResourceUrl } from './builderAssetCatalog';
import { defaultOpening, wallOpeningSegments } from './WallOpenings';
import { createWorkshopActivation } from './BuilderEvents';
import { MEANINGFUL_ACTIONS } from './MeaningfulObjects';
import { ModelHandleReleasedError, ModelTemplateCache } from './ModelTemplateCache';
import { constructionColliders } from './ConstructionCollision';
import type { CollisionWorld } from '../world/CollisionWorld';
import { ZONES, zoneAtXYZ, type ZoneId } from '../world/layout';
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

/** One mesh's geometry bounds and its transform relative to the placement root. */
interface LocalBounds { readonly box: THREE.Box3; readonly matrix: THREE.Matrix4 }

/**
 * Residency bounds. Manifests at or below MAX_RESIDENT_PLACEMENTS keep every
 * placement live (the historical behaviour). Larger manifests keep only the
 * nearest active-world placements within RESIDENT_RADIUS of the focus live;
 * the rest stay as records whose solid collision is derived from cached prefab
 * bounds, so navigation never depends on whether a visual is loaded.
 */
export const MAX_RESIDENT_PLACEMENTS = 384;
export const RESIDENT_RADIUS = 60;
const RESIDENCY_STEP_SQ = 4 * 4;
const ZONE_NEIGHBOURS = new Map<ZoneId, ReadonlySet<ZoneId>>(
  ZONES.map((zone) => [zone.id, new Set<ZoneId>(zone.neighbours as readonly ZoneId[])]));
/** Records are immutable once validated, so each record's zone is computed once. */
const recordZones = new WeakMap<WorkshopPlacementRecord, ZoneId>();
function recordZone(record: WorkshopPlacementRecord): ZoneId {
  let zone = recordZones.get(record);
  if (!zone) {
    zone = zoneAtXYZ(record.position[0], record.position[1], record.position[2]);
    recordZones.set(record, zone);
  }
  return zone;
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
  private readonly recordsById = new Map<string, WorkshopPlacementRecord>();
  private readonly scope = new ResourceScope('museum-placements');
  private readonly recordScopes = new Map<string, ResourceScope>();
  private materials: PlacementMaterials | null = null;
  private readonly registry: AuthorableSceneRegistry | null;
  private manifest: WorkshopPlacementManifest;
  private readonly boundCollisions = new Map<CollisionWorld, Set<string>>();
  private readonly interactionDisposers = new Map<string, () => void>();
  private interaction: InteractionManager | null = null;
  private onAnnounce: ((message: string) => void) | null = null;
  /** Routes an allowlisted Meaningful Object action to the real exhibit control. */
  private meaningTrigger: ((installation: string, code: string) => boolean) | null = null;
  private comparingOriginal = false;
  private readonly comparisonSceneTransforms = new Map<string, AuthorableSceneTransform>();
  private rebuildRevision = 0;
  private activeWorld: 'exterior' | 'interior' | null = null;
  private readonly managedModels = new Map<string, ManagedModel>();
  private managedLoadsInFlight = 0;
  /** Root-relative mesh bounds per prefab shape, and per catalog asset once loaded. */
  private readonly shapeBounds = new Map<string, readonly LocalBounds[]>();
  private readonly residencyFocus = new THREE.Vector3();
  private hasResidencyFocus = false;
  private pinnedId: string | null = null;
  /** One decoded template per model asset, shared by reference count across placements. */
  private readonly models: ModelTemplateCache;
  private focusZone: ZoneId | null = null;

  constructor(rawManifest: unknown, registry: AuthorableSceneRegistry | null = null,
    modelLoader: (assetId: string) => Promise<THREE.Object3D> = defaultModelLoader) {
    this.models = new ModelTemplateCache(modelLoader);
    this.group.name = 'museum-authored-placements';
    this.registry = registry;
    const parsed = validateWorkshopManifestForMuseum(rawManifest, registry?.entries() ?? []);
    if (!parsed.ok || !parsed.value) {
      throw new Error(`Museum Workshop placement manifest is invalid: ${parsed.errors.join('; ')}`);
    }
    this.manifest = parsed.value;
    this.rebuild();
  }

  /** Saved placement records, whether or not they are currently live. */
  get objectCount(): number { return this.recordsById.size; }
  /** Placements that currently have a live root in the scene. */
  get residentCount(): number { return this.roots.size; }

  /**
   * Keep one placement live regardless of distance (the editor's selection).
   * Pass null to release the pin; the next residency pass may then unload it.
   */
  setPinned(id: string | null): void {
    this.pinnedId = id;
    if (id) this.getObject(id);
  }
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

  /** Connect Meaningful Objects to the exhibits' own control path (SourceInstallations.key). */
  bindMeaningfulActions(trigger: (installation: string, code: string) => boolean): void {
    this.meaningTrigger = trigger;
    this.rebuild();
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
    focus?: THREE.Vector3,
  ): void {
    const changedWorld = this.activeWorld !== world;
    this.activeWorld = world;
    if (exteriorRoot) this.surfaces.bind('exterior', exteriorRoot);
    if (interiorRoot) this.surfaces.bind('interior', interiorRoot);
    if (changedWorld) {
      for (const record of this.manifest.objects) {
        const root = this.roots.get(record.id);
        if (root) root.visible = !record.worldId || record.worldId === 'shared' || record.worldId === world;
      }
    }
    const zoned = world === 'interior' && this.recordsById.size > MAX_RESIDENT_PLACEMENTS;
    const zoneChanged = Boolean(focus) && zoned
      && zoneAtXYZ(focus!.x, focus!.y, focus!.z) !== this.focusZone;
    if (focus && (!this.hasResidencyFocus || changedWorld || zoneChanged
      || focus.distanceToSquared(this.residencyFocus) >= RESIDENCY_STEP_SQ)) {
      this.residencyFocus.copy(focus);
      this.hasResidencyFocus = true;
      this.updateResidency();
    } else if (changedWorld && this.recordsById.size > MAX_RESIDENT_PLACEMENTS) {
      this.updateResidency();
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
      const box = new THREE.Box3();
      if (root) {
        root.updateWorldMatrix(true, true);
        box.setFromObject(root);
      } else if (!this.recordBounds(record, box)) {
        continue;
      }
      if (box.isEmpty()) continue;
      ids.add(record.id);
      target.setDynamicWall(record.id, {
        kind: 'wall', minX: box.min.x, maxX: box.max.x, minY: box.min.y,
        maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z,
      });
    }
  }

  /** Returns a live root, materializing a dormant placement on demand. */
  getObject(id: string): THREE.Object3D | null {
    const live = this.roots.get(id);
    if (live) return live;
    const record = this.recordsById.get(id);
    if (record && this.materials) {
      this.addPlacement(record, this.materials, this.rebuildRevision);
      this.sortRoots();
      return this.roots.get(id) ?? null;
    }
    return this.registry?.get(id)?.root ?? null;
  }

  /** Whether a placement currently has a live root in the scene. */
  isResident(id: string): boolean { return this.roots.has(id); }

  /**
   * World-space bounds of one placement without materializing it: the live
   * root when resident, otherwise derived from its record and cached shape.
   * Null for unknown ids and for models whose bounds are not yet known.
   */
  placementBounds(id: string): THREE.Box3 | null {
    const root = this.roots.get(id);
    if (root) {
      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      return box.isEmpty() ? null : box;
    }
    const record = this.recordsById.get(id);
    const box = new THREE.Box3();
    return record && this.recordBounds(record, box) && !box.isEmpty() ? box : null;
  }

  /** Read one current placement without serializing and sorting the entire manifest. */
  getRecord(id: string): WorkshopPlacementRecord | null {
    const record = this.recordsById.get(id);
    if (!record) return null;
    const root = this.roots.get(id);
    const current = root ? { ...record,
      position: root.position.toArray() as [number, number, number],
      rotation: [root.rotation.x, root.rotation.y, root.rotation.z] as [number, number, number],
      scale: root.scale.toArray() as [number, number, number],
    } : record;
    return canonicalizeWorkshopManifest({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects: [current] }).objects[0] ?? null;
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
      ...(this.manifest.curator ? { curator: this.manifest.curator } : {}),
      ...(this.manifest.kits ? { kits: this.manifest.kits } : {}),
    });
  }

  replaceManifest(rawManifest: unknown): WorkshopPlacementManifest {
    this.setOriginalComparison(false);
    const parsed = validateWorkshopManifestForMuseum(rawManifest, this.registry?.entries() ?? []);
    if (!parsed.ok || !parsed.value) {
      throw new Error(`Museum Workshop placement manifest is invalid: ${parsed.errors.join('; ')}`);
    }
    const previous = this.manifest;
    this.manifest = parsed.value;
    const oldById = new Map(previous.objects.map((record) => [record.id, record]));
    const newById = new Map(parsed.value.objects.map((record) => [record.id, record]));
    const canReconcile = this.materials !== null;
    if (canReconcile) {
      // Keep prefab resources when only transforms, surfaces or scene overrides change.
      // Reapply even an unchanged saved transform: a live gizmo may have moved its root.
      let collisionDirty = false;
      for (const old of previous.objects) {
        const replacement = newById.get(old.id);
        if (!replacement || !samePlacementDefinition(old, replacement)) {
          if (old.collision === 'solid' || replacement?.collision === 'solid') collisionDirty = true;
          this.releasePlacement(old.id);
          oldById.delete(old.id);
          if (this.pinnedId === old.id && !replacement) this.pinnedId = null;
        }
      }
      for (const record of parsed.value.objects) {
        const root = this.roots.get(record.id);
        const old = oldById.get(record.id);
        if (!old) {
          if (record.collision === 'solid') collisionDirty = true;
        } else if (!root) {
          if (record.collision === 'solid' && !sameTransform(old, record)) collisionDirty = true;
        } else {
          const current = { position: root.position.toArray(), rotation: [root.rotation.x, root.rotation.y, root.rotation.z],
            scale: root.scale.toArray() };
          if (record.collision === 'solid' && (JSON.stringify(current) !== JSON.stringify({ position: record.position, rotation: record.rotation, scale: record.scale })
            || JSON.stringify({ position: old.position, rotation: old.rotation, scale: old.scale })
              !== JSON.stringify({ position: record.position, rotation: record.rotation, scale: record.scale }))) collisionDirty = true;
          root.position.set(...record.position); root.rotation.set(...record.rotation); root.scale.set(...record.scale);
        }
        this.recordsById.set(record.id, record);
      }
      this.updateResidency();
      if (collisionDirty) this.invalidateCollisions();
      // Live scene roots may have moved since the saved override, even when
      // the requested manifest is byte-for-byte identical to the old one.
      for (const entry of this.registry?.entries() ?? []) this.registry?.apply(entry.id, entry.baseline);
      for (const override of parsed.value.sceneOverrides ?? []) this.registry?.apply(override.id, override);
      if (JSON.stringify(previous.surfaceOverrides ?? []) !== JSON.stringify(parsed.value.surfaceOverrides ?? [])) {
        this.surfaces.apply(parsed.value.surfaceOverrides ?? []);
      }
      if (this.activeWorld) this.syncManagedModels(this.activeWorld);
    } else {
      this.rebuild();
    }
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
      ...(current.curator ? { curator: current.curator } : {}),
      ...(current.kits ? { kits: current.kits } : {}),
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
      ...(current.curator ? { curator: current.curator } : {}),
      ...(current.kits ? { kits: current.kits } : {}),
    });
  }

  removeRecord(id: string): WorkshopPlacementManifest {
    const current = this.captureManifest();
    return this.replaceManifest({
      schemaVersion: WORKSHOP_SCHEMA_VERSION,
      objects: current.objects.filter((record) => record.id !== id),
      sceneOverrides: current.sceneOverrides,
      surfaceOverrides: current.surfaceOverrides,
      // A deleted object can no longer be locked; its past decisions remain as history.
      ...(current.curator ? { curator: { ...current.curator, locks: current.curator.locks.filter((lock) => lock !== id) } } : {}),
      ...(current.kits ? { kits: current.kits.map((kit) => ({ ...kit, members: kit.members.filter((member) => member.id !== id) })) } : {}),
    });
  }

  dispose(): void {
    this.setOriginalComparison(false);
    this.rebuildRevision++;
    this.releaseManagedModels();
    this.surfaces.dispose();
    for (const release of this.interactionDisposers.values()) release();
    this.interactionDisposers.clear();
    for (const scope of this.recordScopes.values()) scope.dispose();
    this.recordScopes.clear();
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
    this.recordsById.clear();
    this.scope.dispose();
    this.models.dispose();
    this.materials = null;
    this.pinnedId = null;
  }

  private rebuild(): void {
    ++this.rebuildRevision;
    this.releaseManagedModels();
    for (const release of this.interactionDisposers.values()) release();
    this.interactionDisposers.clear();
    for (const scope of this.recordScopes.values()) scope.dispose();
    this.recordScopes.clear();
    for (const [target, ids] of this.boundCollisions) {
      for (const id of ids) {
        target.setDynamicWall(id, null);
        target.setDynamicFloor(id, null);
      }
    }
    this.boundCollisions.clear();
    this.group.clear();
    this.roots.clear();
    this.recordsById.clear();
    this.scope.releaseAll();
    for (const entry of this.registry?.entries() ?? []) this.registry?.apply(entry.id, entry.baseline);
    for (const override of this.manifest.sceneOverrides ?? []) this.registry?.apply(override.id, override);
    this.materials = this.createMaterials();

    for (const record of this.manifest.objects) this.recordsById.set(record.id, record);
    this.updateResidency();
    this.surfaces.apply(this.manifest.surfaceOverrides ?? []);
    if (this.activeWorld) this.syncManagedModels(this.activeWorld);
  }

  private addPlacement(record: WorkshopPlacementRecord, materials: PlacementMaterials, revision: number): void {
      this.recordsById.set(record.id, record);
      const recordScope = new ResourceScope(`workshop-placement:${record.id}`);
      this.recordScopes.set(record.id, recordScope);
      const root = this.buildPrefab(record, materials);
      if (record.color) {
        root.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh || mesh.userData.workshopImageSurface) return;
          const material = mesh.material;
          if (material instanceof THREE.MeshStandardMaterial) {
            mesh.material = recordScope.track(material.clone());
            (mesh.material as THREE.MeshStandardMaterial).color.set(record.color!);
          }
        });
      }
      root.name = `workshop:${record.id}`;
      root.visible = !this.activeWorld || !record.worldId || record.worldId === 'shared' || record.worldId === this.activeWorld;
      root.userData.workshopId = record.id;
      root.userData.workshopPrefab = record.prefab;
      root.position.set(...record.position);
      root.rotation.set(...record.rotation);
      root.scale.set(...record.scale);
      root.traverse((node) => {
        node.userData.workshopId = record.id;
      });
      root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) recordScope.track(mesh.geometry);
      });
      this.group.add(root);
      this.roots.set(record.id, root);
      const hasEvent = Boolean(record.event && record.event !== 'none');
      if ((hasEvent || record.meaning) && this.interaction) {
        const reaction = hasEvent ? createWorkshopActivation(
          record, root,
          (material) => recordScope.track(material),
          (message) => this.onAnnounce?.(message),
        ) : null;
        const meaning = record.meaning ? MEANINGFUL_ACTIONS[record.meaning] : null;
        const activate = () => {
          reaction?.();
          if (!meaning) return;
          // Only the allowlisted control code reaches the exhibit; if the interior is not loaded, say so.
          if (!this.meaningTrigger?.(meaning.installation, meaning.code)) this.onAnnounce?.(`${record.label}: ${meaning.exhibit} is not responding here.`);
        };
        const release = this.interaction.register(`workshop:${record.id}`, {
          object: root,
          label: () => meaning ? `${meaning.label} (${record.label})` : `${record.event === 'announce' ? 'Inspect' : 'Activate'} ${record.label}`,
          description: `Interact with authored museum object ${record.label}`,
          activate,
        });
        this.interactionDisposers.set(record.id, release);
      }
      if (record.prefab === 'catalog-model' && record.assetId) {
        if (record.collision === 'solid' || (record.event && record.event !== 'none') || record.meaning) {
          void this.loadCatalogModel(root, record, revision, recordScope);
        }
      } else if (record.texture) {
        this.applyRecordFinish(root, record, recordScope);
      }
      if (record.prefab === 'wall-art' && record.image) {
        const surface = root.getObjectByName('workshop-art-surface') as THREE.Mesh | undefined;
        if (surface) {
          const url = resolveWorkshopMediaUrl(record.image);
          const texture = recordScope.track(new THREE.TextureLoader().load(url, undefined, undefined, () => {
            console.warn('[Museum Builder] artwork missing:', record.image);
          }));
          texture.colorSpace = THREE.SRGBColorSpace;
          surface.material = recordScope.track(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
        }
      }
  }

  private releasePlacement(id: string): void {
    this.evictPlacement(id);
    this.recordsById.delete(id);
  }

  /** Drop a placement's live root and resources while keeping its saved record. */
  private evictPlacement(id: string): void {
    const managed = this.managedModels.get(id);
    if (managed) { managed.scope.dispose(); this.managedModels.delete(id); }
    this.interactionDisposers.get(id)?.();
    this.interactionDisposers.delete(id);
    this.recordScopes.get(id)?.dispose();
    this.recordScopes.delete(id);
    this.roots.get(id)?.removeFromParent();
    this.roots.delete(id);
  }

  private sortRoots(): void {
    const order = new Map(this.manifest.objects.map((record, index) => [record.id, index]));
    this.group.children.sort((a, b) => (order.get(a.userData.workshopId as string) ?? 0)
      - (order.get(b.userData.workshopId as string) ?? 0));
  }

  /**
   * Choose which placements are live. Small manifests stay fully live. For
   * large ones, keep the pinned placement, any root moved by a live edit that
   * the manifest has not yet captured, solid models whose bounds are not yet
   * known, and the nearest active-world placements within RESIDENT_RADIUS.
   */
  private updateResidency(): void {
    const materials = this.materials;
    if (!materials) return;
    const records = this.manifest.objects;
    const keep = new Set<string>();
    if (records.length <= MAX_RESIDENT_PLACEMENTS) {
      for (const record of records) keep.add(record.id);
    } else {
      if (this.pinnedId) keep.add(this.pinnedId);
      // Indoors, walls separate zones: favour the visitor's own zone, then its
      // neighbours, and leave non-adjacent zones dormant even when nearby.
      const zoned = this.activeWorld === 'interior' && this.hasResidencyFocus;
      const here = zoned ? zoneAtXYZ(this.residencyFocus.x, this.residencyFocus.y, this.residencyFocus.z) : null;
      this.focusZone = here;
      const near = here ? ZONE_NEIGHBOURS.get(here) : undefined;
      const candidates: { id: string; distanceSq: number }[] = [];
      for (const record of records) {
        const root = this.roots.get(record.id);
        if (root && !rootMatchesRecord(root, record)) { keep.add(record.id); continue; }
        if (record.collision === 'solid' && !this.hasShapeBounds(record)) { keep.add(record.id); continue; }
        if (!this.hasResidencyFocus) continue;
        if (this.activeWorld && record.worldId && record.worldId !== 'shared' && record.worldId !== this.activeWorld) continue;
        const dx = record.position[0] - this.residencyFocus.x;
        const dy = record.position[1] - this.residencyFocus.y;
        const dz = record.position[2] - this.residencyFocus.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (here) {
          const zone = recordZone(record);
          // The whole current zone is eligible and sorts ahead of every neighbour.
          if (zone === here) { candidates.push({ id: record.id, distanceSq: distanceSq - 1e9 }); continue; }
          if (!near?.has(zone)) continue;
        }
        if (distanceSq <= RESIDENT_RADIUS * RESIDENT_RADIUS) candidates.push({ id: record.id, distanceSq });
      }
      candidates.sort((a, b) => a.distanceSq - b.distanceSq || a.id.localeCompare(b.id));
      for (const candidate of candidates) {
        if (keep.size >= MAX_RESIDENT_PLACEMENTS) break;
        keep.add(candidate.id);
      }
    }
    for (const id of [...this.roots.keys()]) if (!keep.has(id)) this.evictPlacement(id);
    let added = false;
    for (const record of records) {
      if (!keep.has(record.id) || this.roots.has(record.id)) continue;
      this.addPlacement(record, materials, this.rebuildRevision);
      added = true;
    }
    if (added) this.sortRoots();
  }

  private shapeKey(record: WorkshopPlacementRecord): string {
    if (record.prefab === 'catalog-model') return `model:${record.assetId ?? ''}`;
    return JSON.stringify([record.prefab, record.depth ?? null, record.opening ?? null,
      record.openingWidth ?? null, record.openingHeight ?? null, record.openingSill ?? null]);
  }

  private hasShapeBounds(record: WorkshopPlacementRecord): boolean {
    return record.prefab !== 'catalog-model' || this.shapeBounds.has(this.shapeKey(record));
  }

  /** Root-relative mesh bounds for a placement's shape, built once per shape. */
  private localBounds(record: WorkshopPlacementRecord): readonly LocalBounds[] | null {
    const key = this.shapeKey(record);
    const cached = this.shapeBounds.get(key);
    if (cached) return cached;
    if (record.prefab === 'catalog-model' || !this.materials) return null;
    const probe = this.buildPrefab(record, this.materials);
    const bounds = collectLocalBounds(probe);
    probe.traverse((node) => { (node as THREE.Mesh).geometry?.dispose(); });
    this.shapeBounds.set(key, bounds);
    return bounds;
  }

  /** World AABB of a placement from its record alone, matching Box3.setFromObject on its root. */
  private recordBounds(record: WorkshopPlacementRecord, out: THREE.Box3): boolean {
    const bounds = this.localBounds(record);
    if (!bounds) return false;
    const rootMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...record.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...record.rotation)),
      new THREE.Vector3(...record.scale),
    );
    const matrix = new THREE.Matrix4();
    const box = new THREE.Box3();
    out.makeEmpty();
    for (const entry of bounds) {
      out.union(box.copy(entry.box).applyMatrix4(matrix.multiplyMatrices(rootMatrix, entry.matrix)));
    }
    return true;
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
      const handle = this.models.acquire(record.assetId!);
      state.scope.track({ dispose: handle.release });
      void handle.ready.then((object) => {
        // A stale handle was already released when its scope was disposed.
        if (state.scope.isDisposed || this.managedModels.get(record.id) !== state) return;
        object.traverse((node) => { node.userData.workshopId = record.id; });
        if (record.color || record.texture) this.applyRecordFinish(object, record, state.scope);
        root.clear(); root.add(object);
      }).catch((error: unknown) => {
        if (error instanceof ModelHandleReleasedError) return;
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

  private async loadCatalogModel(root: THREE.Group, record: WorkshopPlacementRecord, revision: number, recordScope: ResourceScope): Promise<void> {
    const handle = this.models.acquire(record.assetId!);
    recordScope.track({ dispose: handle.release });
    try {
      const object = await handle.ready;
      if (revision !== this.rebuildRevision || recordScope.isDisposed) {
        handle.release();
        return;
      }
      root.clear();
      object.traverse((node) => { node.userData.workshopId = record.id; });
      root.add(object);
      if (record.color || record.texture) this.applyRecordFinish(object, record, recordScope);
      if (!this.shapeBounds.has(this.shapeKey(record))) this.shapeBounds.set(this.shapeKey(record), collectLocalBounds(root));
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
      if (error instanceof ModelHandleReleasedError) return;
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

function samePlacementDefinition(a: WorkshopPlacementRecord, b: WorkshopPlacementRecord | undefined): boolean {
  if (!b) return false;
  return JSON.stringify({ ...a, position: null, rotation: null, scale: null })
    === JSON.stringify({ ...b, position: null, rotation: null, scale: null });
}

function sameTransform(a: WorkshopPlacementRecord, b: WorkshopPlacementRecord): boolean {
  return a.position.every((value, index) => value === b.position[index])
    && a.rotation.every((value, index) => value === b.rotation[index])
    && a.scale.every((value, index) => value === b.scale[index]);
}

function rootMatchesRecord(root: THREE.Object3D, record: WorkshopPlacementRecord): boolean {
  return root.position.x === record.position[0] && root.position.y === record.position[1]
    && root.position.z === record.position[2]
    && root.rotation.x === record.rotation[0] && root.rotation.y === record.rotation[1]
    && root.rotation.z === record.rotation[2]
    && root.scale.x === record.scale[0] && root.scale.y === record.scale[1] && root.scale.z === record.scale[2];
}

/** Geometry bounds of every mesh under root, expressed relative to root itself. */
function collectLocalBounds(root: THREE.Object3D): LocalBounds[] {
  const inverseRoot = new THREE.Matrix4();
  root.updateWorldMatrix(true, true);
  inverseRoot.copy(root.matrixWorld).invert();
  const out: LocalBounds[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    out.push({ box: mesh.geometry.boundingBox!.clone(),
      matrix: new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld) });
  });
  return out;
}
