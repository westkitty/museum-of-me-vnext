import * as THREE from 'three';
import { TransformControls, type TransformControlsMode } from 'three/examples/jsm/controls/TransformControls.js';
import type { App } from '../app/App';
import type { MuseumPlacements } from './MuseumPlacements';
import { BuilderCamera, type BuilderView } from './BuilderCamera';
import type { AuthorableSceneEntry, AuthorableSceneTransform } from './AuthorableSceneRegistry';
import { WORKSHOP_PREFABS, type WorkshopPrefabId } from './catalog';
import { BUILDER_MODELS, BUILDER_FINISHES, searchBuilderLibrary, builderModel } from './builderAssetCatalog';
import { conservationErrors, validateWorkshopConservation } from './conservation';
import { WorkshopHistory } from './history';
import {
  type WorkshopAnchor,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
} from './schema';
import './workshop.css';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const SAVE_ENDPOINT = '/__museum-workshop/save';
const MEDIA_ENDPOINT = '/__museum-workshop/media';
const MODEL_ENDPOINT = '/__museum-workshop/model';
const GRID_SNAP = [0, 0.05, 0.1, 0.25, 0.5, 1] as const;
const INPUT_KEYS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'] as const;
type InputKey = (typeof INPUT_KEYS)[number];

/** Development-only authoring UI. Production receives only MuseumPlacements. */
export class Workshop {
  private readonly root = document.createElement('div');
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly transform: TransformControls;
  private readonly camera: BuilderCamera;
  private readonly paintInput: HTMLInputElement;
  private readonly textureInput: HTMLSelectElement;
  private readonly modelInput: HTMLInputElement;
  private readonly finishFileInput: HTMLInputElement;
  private readonly searchInput: HTMLInputElement;
  private readonly categoryInput: HTMLSelectElement;
  private readonly assetResults: HTMLElement;
  private readonly imageInput: HTMLInputElement;
  private readonly depthInput: HTMLInputElement;
  private readonly collisionInput: HTMLSelectElement;
  private readonly eventInput: HTMLSelectElement;
  private readonly snapInput: HTMLSelectElement;
  private readonly uniformScaleInput: HTMLInputElement;
  private wallPlacementActive = false;
  private savedVisitorPosition: THREE.Vector3 | null = null;
  private savedVisitorYaw = 0;
  private savedVisitorWorld: 'interior' | 'exterior' = 'exterior';
  private readonly helper: THREE.Object3D;
  private readonly history = new WorkshopHistory();
  private readonly inputs = {} as Record<InputKey, HTMLInputElement>;
  private readonly labelInput: HTMLInputElement;
  private readonly anchorInput: HTMLSelectElement;
  private readonly outliner: HTMLElement;
  private readonly title: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly status: HTMLElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private selectionBox: THREE.BoxHelper | null = null;
  private selectedId: string | null = null;
  private selectedSurfaceId: string | null = null;
  private dragBefore: WorkshopPlacementManifest | null = null;
  private openState = false;

  constructor(private readonly app: App, private readonly placements: MuseumPlacements) {
    this.root.className = 'museum-workshop';
    this.root.hidden = true;
    this.root.innerHTML = WORKSHOP_HTML;
    document.body.append(this.root);

    this.labelInput = this.el<HTMLInputElement>('label');
    this.anchorInput = this.el<HTMLSelectElement>('anchor');
    this.outliner = this.el('outliner');
    this.title = this.el('selection-title');
    this.meta = this.el('selection-meta');
    this.status = this.el('status');
    this.saveButton = this.el<HTMLButtonElement>('save');
    this.undoButton = this.el<HTMLButtonElement>('undo');
    this.redoButton = this.el<HTMLButtonElement>('redo');
    this.paintInput = this.el<HTMLInputElement>('paint');
    this.textureInput = this.el<HTMLSelectElement>('texture');
    this.modelInput = this.el<HTMLInputElement>('model-import');
    this.finishFileInput = this.el<HTMLInputElement>('finish-import');
    this.searchInput = this.el<HTMLInputElement>('asset-search');
    this.categoryInput = this.el<HTMLSelectElement>('asset-category');
    this.assetResults = this.el('asset-results');
    this.imageInput = this.el<HTMLInputElement>('image');
    this.depthInput = this.el<HTMLInputElement>('depth');
    this.collisionInput = this.el<HTMLSelectElement>('collision');
    this.eventInput = this.el<HTMLSelectElement>('event');
    this.snapInput = this.el<HTMLSelectElement>('grid-snap');
    this.uniformScaleInput = this.el<HTMLInputElement>('uniform-scale');
    for (const key of INPUT_KEYS) this.inputs[key] = this.el<HTMLInputElement>(key);

    this.camera = new BuilderCamera(app);
    this.transform = new TransformControls(app.camera, app.renderer.canvas);
    this.helper = this.transform.getHelper();
    this.helper.name = 'museum-workshop-transform-controls';
    this.helper.visible = false;
    this.transform.enabled = false;
    this.transform.setTranslationSnap(0.1);
    this.transform.setRotationSnap(5 * RAD);
    this.transform.setScaleSnap(0.05);
    this.transform.setSize(0.82);
    app.scene.add(this.helper);

    this.bindUi();
    this.transform.addEventListener('mouseDown', this.onTransformStart);
    this.transform.addEventListener('mouseDown', this.onDragCameraDisable);
    this.transform.addEventListener('mouseUp', this.onDragCameraEnable);
    this.transform.addEventListener('mouseUp', this.onTransformEnd);
    this.transform.addEventListener('objectChange', this.onTransformChange);
    app.renderer.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    document.addEventListener('keydown', this.onKeyDown, true);
    this.refresh();
  }

  get isOpen(): boolean { return this.openState; }

  open(targetId: string | null = null): void {
    if (this.openState) return;
    if (this.app.ui.anyPanelOpen) {
      this.note('Close the current museum panel before opening Workshop.', 'warn');
      return;
    }
    if (targetId) {
      if (targetId.startsWith('exterior:') || targetId.startsWith('interior:')) this.selectSurface(targetId);
      else this.select(targetId);
    }
    this.openState = true;
    this.savedVisitorPosition = this.app.player.position.clone();
    this.savedVisitorYaw = this.app.player.yaw;
    this.savedVisitorWorld = this.app.activeWorld;
    this.root.hidden = false;
    this.app.input.releasePointerLock();
    this.app.input.uiCaptured = true;
    this.app.player.setFrozen(true);
    this.app.ui.setBuildModeActive(true);
    this.camera.open();
    this.transform.enabled = true;
    this.helper.visible = this.selectedId !== null;
    if (this.selectionBox) this.selectionBox.visible = true;
    this.el<HTMLElement>('panel').focus();
    this.note('Workshop active. Visitor movement is paused.', 'ok');
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.root.hidden = true;
    this.camera.close();
    this.placements.setOriginalComparison(false);
    this.wallPlacementActive = false;
    this.transform.enabled = false;
    this.helper.visible = false;
    if (this.selectionBox) this.selectionBox.visible = false;
    this.app.input.uiCaptured = false;
    this.app.player.setFrozen(false);
    // Return to the original visitor context after builder world survey.
    const wasWorld = this.savedVisitorWorld;
    const original = this.savedVisitorPosition?.clone() ?? null;
    const yaw = this.savedVisitorYaw;
    this.savedVisitorPosition = null;
    if (wasWorld === 'exterior' && this.app.activeWorld !== 'exterior') this.app.worldDirector.switchToExterior();
    if (wasWorld === 'interior' && this.app.activeWorld !== 'interior') {
      void this.app.worldDirector.switchToInterior().then(() => {
        if (original) this.app.player.teleport([original.x, original.y, original.z], yaw);
      }).catch((error) => console.error('[Museum Builder] restore interior failed', error));
    } else if (original) this.app.player.teleport([original.x, original.y, original.z], yaw);
    this.app.ui.setBuildModeActive(false);
    this.app.ui.hud.setWorkshopCue(null);
  }

  toggle(): void {
    if (this.openState) this.close();
    else this.open();
  }

  /** Called by App's existing variable phase; never owns a frame loop. */
  update(): void {
    if (this.openState) {
      this.app.ui.hud.setWorkshopCue(null);
      return;
    }
    const hit = this.authorableHit(true);
    const focus = this.app.interaction.currentFocus;
    this.app.ui.hud.setWorkshopCue(!focus && hit ? hit.entry?.label ?? hit.id : null);
  }

  dispose(): void {
    this.close();
    this.app.renderer.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    document.removeEventListener('keydown', this.onKeyDown, true);
    this.transform.removeEventListener('mouseDown', this.onTransformStart);
    this.transform.removeEventListener('mouseDown', this.onDragCameraDisable);
    this.transform.removeEventListener('mouseUp', this.onDragCameraEnable);
    this.transform.removeEventListener('mouseUp', this.onTransformEnd);
    this.transform.removeEventListener('objectChange', this.onTransformChange);
    this.transform.detach();
    this.transform.disconnect();
    this.helper.removeFromParent();
    this.camera.dispose();
    this.clearSelectionBox();
    this.root.remove();
  }

  private bindUi(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => this.setMode(button.dataset.mode as TransformControlsMode));
    });
    this.el<HTMLButtonElement>('space').addEventListener('click', () => this.toggleSpace());
    this.el<HTMLButtonElement>('floor').addEventListener('click', () => this.snapFloor());
    this.el<HTMLButtonElement>('duplicate').addEventListener('click', () => this.duplicate());
    this.el<HTMLButtonElement>('delete').addEventListener('click', () => this.remove());
    this.el<HTMLButtonElement>('exit').addEventListener('click', () => this.close());
    this.saveButton.addEventListener('click', () => void this.save());
    this.undoButton.addEventListener('click', () => this.undo());
    this.redoButton.addEventListener('click', () => this.redo());
    this.labelInput.addEventListener('change', () => this.commitMetadata());
    this.anchorInput.addEventListener('change', () => this.commitMetadata());
    for (const [key, input] of Object.entries(this.inputs)) {
      input.addEventListener('change', () => this.commitTransform(key as InputKey));
    }
    this.paintInput.addEventListener('change', () => this.commitAppearance());
    this.textureInput.addEventListener('change', () => {
      if (this.textureInput.value !== 'none') this.paintInput.value = '#ffffff';
      this.commitAppearance();
    });
    this.modelInput.addEventListener('change', () => void this.importModel());
    this.finishFileInput.addEventListener('change', () => void this.importFinish());
    this.searchInput.addEventListener('input', () => this.refreshAssetLibrary());
    this.categoryInput.addEventListener('change', () => this.refreshAssetLibrary());
    this.depthInput.addEventListener('change', () => this.commitAppearance());
    this.collisionInput.addEventListener('change', () => this.commitAppearance());
    this.eventInput.addEventListener('change', () => this.commitAppearance());
    this.imageInput.addEventListener('change', () => void this.importArtwork());
    this.el<HTMLButtonElement>('place-wall').addEventListener('click', () => this.beginWallPlacement());
    this.snapInput.addEventListener('change', () => this.configureSnap());
    this.el<HTMLButtonElement>('view-dollhouse').addEventListener('click', () => this.setView('dollhouse'));
    this.el<HTMLButtonElement>('view-orbit').addEventListener('click', () => this.setView('orbit'));
    this.el<HTMLButtonElement>('view-top').addEventListener('click', () => this.setView('top'));
    this.el<HTMLButtonElement>('focus').addEventListener('click', () => {
      const object = this.object();
      const selectedSurface = this.selectedSurfaceId
        ? this.placements.surfaces.resolve(this.selectedSurfaceId) : null;
      if (object || selectedSurface) this.camera.focus(object ?? selectedSurface!.mesh);
    });
    this.el<HTMLButtonElement>('world-exterior').addEventListener('click', () => void this.switchWorld('exterior'));
    this.el<HTMLButtonElement>('world-interior').addEventListener('click', () => void this.switchWorld('interior'));
    this.el<HTMLButtonElement>('compare').addEventListener('click', () => this.toggleComparison());

    const palette = this.el('palette');
    for (const finish of BUILDER_FINISHES) {
      const option = document.createElement('option');
      option.value = finish.id;
      option.textContent = finish.label;
      option.title = finish.source + ' · ' + finish.license;
      this.textureInput.append(option);
    }
    for (const category of ['All', ...new Set(BUILDER_MODELS.map((item) => item.category))]) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      this.categoryInput.append(option);
    }
    this.refreshAssetLibrary();
    for (const prefab of WORKSHOP_PREFABS) {
      if (prefab.id === 'catalog-model') continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = prefab.label;
      button.title = prefab.description;
      button.addEventListener('click', () => this.add(prefab.id));
      palette.append(button);
    }
  }

  private setMode(mode: TransformControlsMode): void {
    this.transform.setMode(mode);
    this.refresh();
  }

  private toggleSpace(): void {
    const space = this.transform.space === 'world' ? 'local' : 'world';
    this.transform.setSpace(space);
    this.el<HTMLButtonElement>('space').textContent = space === 'world' ? 'World' : 'Local';
  }

  private readonly onDragCameraDisable = (): void => this.camera.setDragging(true);
  private readonly onDragCameraEnable = (): void => this.camera.setDragging(false);

  private configureSnap(): void {
    const value = Number(this.snapInput.value);
    if (!GRID_SNAP.includes(value as typeof GRID_SNAP[number])) return;
    this.transform.setTranslationSnap(value || null);
    this.transform.setRotationSnap(value ? 5 * RAD : null);
    this.transform.setScaleSnap(value || null);
    this.note(value ? `Grid snap: ${value} m` : 'Free placement enabled', 'ok');
  }

  private toggleComparison(): void {
    this.wallPlacementActive = false;
    this.placements.setOriginalComparison(!this.placements.isComparingOriginal);
    this.helper.visible = this.openState && !this.placements.isComparingOriginal && this.selectedId !== null;
    if (this.selectionBox) this.selectionBox.visible = this.helper.visible;
    this.note(
      this.placements.isComparingOriginal
        ? 'ORIGINAL VIEW — authored objects are hidden; no placement data was changed.'
        : 'AUTHORED VIEW — your saved and unsaved work is restored.',
      'ok',
    );
    this.refresh();
  }

  private setView(view: BuilderView): void {
    this.camera.setView(view);
    this.refresh();
  }

  private async switchWorld(world: 'interior' | 'exterior'): Promise<void> {
    if (world === this.app.activeWorld) return;
    if (world === 'interior') {
      this.note('Preparing museum interior…', 'ok');
      const ready = await this.app.worldDirector.switchToInterior();
      if (!ready) return this.note('Interior preparation is not ready.', 'warn');
      this.app.player.teleport([7, 0, 0]);
    } else {
      this.app.worldDirector.switchToExterior();
      const original = this.savedVisitorWorld === 'exterior' ? this.savedVisitorPosition : null;
      if (original) this.app.player.teleport([original.x, original.y, original.z], this.savedVisitorYaw);
      else this.app.player.teleport([0, 0, 150]);
    }
    // Keep editing the real active world, never simultaneously render both.
    this.camera.close();
    this.camera.open();
    this.select(null);
    this.refresh();
  }

  private refreshAssetLibrary(): void {
    this.assetResults.replaceChildren();
    const matched = searchBuilderLibrary(this.searchInput.value, this.categoryInput.value || 'All');
    this.el('asset-count').textContent = matched.length + ' locally verified 3D assets';
    for (const item of matched) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'workshop-asset';
      button.dataset.assetId = item.id;
      button.disabled = this.placements.isComparingOriginal;
      const title = document.createElement('strong');
      title.textContent = item.label;
      const detail = document.createElement('small');
      detail.textContent = item.category + ' · ' + item.source + ' · ' + item.license;
      button.append(title, detail);
      button.title = item.tags.join(', ') + ' · ' + item.bytes + ' bytes';
      button.addEventListener('click', () => this.addModel(item.id, item.label));
      this.assetResults.append(button);
    }
    if (!matched.length) {
      const empty = document.createElement('p');
      empty.className = 'workshop-muted';
      empty.textContent = 'No matching assets. Search another category or import a local GLB.';
      this.assetResults.append(empty);
    }
  }

  private addModel(assetId: string, label: string): void {
    if (this.placements.isComparingOriginal) return;
    const before = this.placements.captureManifest();
    if (before.objects.length >= 256) return this.note('Museum object limit (256) reached.', 'error');
    const direction = this.app.camera.getWorldDirection(new THREE.Vector3());
    const x = this.app.camera.position.x + direction.x * 5;
    const z = this.app.camera.position.z + direction.z * 5;
    const collision = this.app.player.collisionWorld;
    const y = collision.supportHeight(x, z, this.app.player.position.y, 2) ?? this.app.player.position.y;
    const model = builderModel(assetId);
    const record: WorkshopPlacementRecord = {
      id: this.uniqueId('catalog-model'),
      label: label.slice(0, 80),
      prefab: 'catalog-model',
      assetId,
      anchor: 'floor',
      position: [x, y, z],
      rotation: [0, Math.atan2(-direction.x, -direction.z), 0],
      scale: [1, 1, 1],
      worldId: this.app.activeWorld,
      collision: 'none',
    };
    try {
      const after = this.placements.setRecord(record);
      this.history.push('Summon ' + label, before, after);
      this.select(record.id);
      this.note(label + ' summoned from ' + (model?.source ?? 'local import') + '. Move, scale, paint or save it.', 'ok');
      this.refresh();
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'Placement was rejected by conservation.', 'error');
    }
  }

  private async importModel(): Promise<void> {
    const file = this.modelInput.files?.[0];
    if (!file) return;
    this.modelInput.value = '';
    if (!file.name.toLowerCase().endsWith('.glb') || file.size > 8 * 1024 * 1024) {
      return this.note('Only self-contained GLB files under 8 MB can be imported.', 'error');
    }
    try {
      this.note('Importing local 3D model…', 'ok');
      const response = await fetch(MODEL_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'model/gltf-binary' }, body: file,
      });
      const result = await response.json() as { ok?: boolean; assetId?: string; error?: string };
      if (!response.ok || !result.ok || !result.assetId) throw new Error(result.error ?? 'GLB import failed');
      this.addModel(result.assetId, file.name.replace(/\.glb$/i, ''));
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'GLB import failed.', 'error');
    }
  }

  private ensureFinishOption(value: string): void {
    if (!value || value === 'none') return;
    if ([...this.textureInput.options].some((option) => option.value === value)) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = 'Imported texture · ' + value.slice(0, 20) + '…';
    this.textureInput.append(option);
  }

  private async importFinish(): Promise<void> {
    const file = this.finishFileInput.files?.[0];
    if (!file) return;
    this.finishFileInput.value = '';
    const selectedId = this.selectedId;
    const surfaceId = this.selectedSurfaceId;
    if ((!selectedId && !surfaceId) || !file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      return this.note('Select a surface or object, then an image smaller than 15 MB.', 'warn');
    }
    try {
      this.note('Converting texture into local WebP…', 'ok');
      const bitmap = await createImageBitmap(file);
      const factor = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * factor));
      canvas.height = Math.max(1, Math.round(bitmap.height * factor));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image canvas is unavailable');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolveBlob) => canvas.toBlob(resolveBlob, 'image/webp', 0.85));
      if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('Converted texture exceeds 3 MB');
      const response = await fetch(MEDIA_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: blob,
      });
      const result = await response.json() as { ok?: boolean; image?: string; error?: string };
      if (!response.ok || !result.ok || !result.image) throw new Error(result.error ?? 'Texture import failed');
      if (selectedId !== this.selectedId || surfaceId !== this.selectedSurfaceId) {
        this.note('Image imported. Selection changed; re-select the target to apply it.', 'warn');
        return;
      }
      this.ensureFinishOption(result.image);
      this.textureInput.value = result.image;
      this.commitAppearance();
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'Texture import failed.', 'error');
    }
  }

  private add(prefab: WorkshopPrefabId): void {
    if (this.placements.isComparingOriginal) return;
    const before = this.placements.captureManifest();
    if (before.objects.length >= 256) return this.note('Workshop object limit reached.', 'error');
    const direction = new THREE.Vector3();
    this.app.camera.getWorldDirection(direction);
    const x = this.app.camera.position.x + direction.x * 4;
    const z = this.app.camera.position.z + direction.z * 4;
    const collision = this.app.museum?.collision ?? this.app.player.collisionWorld;
    const y = collision.supportHeight(x, z, this.app.player.position.y, 1.5)
      ?? this.app.player.position.y;
    const def = WORKSHOP_PREFABS.find((item) => item.id === prefab);
    const record: WorkshopPlacementRecord = {
      id: this.uniqueId(prefab),
      label: def?.label ?? prefab,
      prefab,
      anchor: 'floor',
      position: [x, y, z],
      rotation: [0, Math.atan2(-direction.x, -direction.z), 0],
      scale: [1, 1, 1],
      worldId: this.app.activeWorld,
    };
    const after = this.placements.setRecord(record);
    this.history.push(`Add ${record.label}`, before, after);
    this.select(record.id);
    if (prefab === 'wall-art' || prefab === 'wall-panel') this.beginWallPlacement();
    else this.note(`${record.label} added.`, 'ok');
    this.refresh();
  }

  private duplicate(): void {
    const record = this.record();
    if (!record) return;
    const before = this.placements.captureManifest();
    const copy: WorkshopPlacementRecord = {
      ...record,
      id: this.uniqueId(record.prefab),
      label: `${record.label} copy`.slice(0, 80),
      position: [record.position[0] + 0.8, record.position[1], record.position[2] + 0.8],
    };
    const after = this.placements.setRecord(copy);
    this.history.push(`Duplicate ${record.label}`, before, after);
    this.select(copy.id);
    this.refresh();
  }

  private remove(): void {
    if (this.selectedSurfaceId) {
      const id = this.selectedSurfaceId;
      const before = this.placements.captureManifest();
      try {
        const after = this.placements.removeSurfaceOverride(id);
        this.history.push('Clear scene finish', before, after);
        this.selectSurface(id);
        this.note('Original surface material restored.', 'ok');
        this.refresh();
      } catch (error) {
        this.note(error instanceof Error ? error.message : 'Could not restore finish', 'error');
      }
      return;
    }
    const record = this.record();
    if (!record) return;
    const before = this.placements.captureManifest();
    const after = this.placements.removeRecord(record.id);
    this.history.push(`Delete ${record.label}`, before, after);
    this.select(null);
    this.note(`${record.label} removed.`, 'warn');
    this.refresh();
  }

  private snapFloor(): void {
    const object = this.object();
    const record = this.record();
    if (!object || !record) return;
    const collision = this.app.museum?.collision ?? this.app.player.collisionWorld;
    const floor = collision.supportHeight(
      object.position.x, object.position.z, object.position.y, 2.0,
    );
    if (floor === null) return this.note('No supporting collision floor found here.', 'warn');
    const before = this.placements.captureManifest();
    const after = this.placements.setRecord({
      ...record,
      anchor: 'floor',
      position: [object.position.x, floor, object.position.z],
    });
    this.history.push(`Snap ${record.label} to floor`, before, after);
    this.select(record.id);
    this.refresh();
  }

  private commitMetadata(): void {
    const record = this.record();
    if (!record) return;
    const label = this.labelInput.value.trim();
    const anchor = this.anchorInput.value as WorkshopAnchor;
    if (!label || label.length > 80 || (anchor !== 'floor' && anchor !== 'free' && anchor !== 'wall')) return this.refreshInspector();
    if (anchor === 'wall' && record.prefab !== 'wall-art' && record.prefab !== 'wall-panel') {
      return this.note('Wall mounting requires wall art or a paintable panel.', 'warn');
    }
    const before = this.placements.captureManifest();
    const after = this.placements.setRecord({ ...record, label, anchor });
    this.history.push(`Edit ${record.label}`, before, after);
    this.select(record.id);
    this.refresh();
  }

  private commitTransform(changed?: InputKey): void {
    const object = this.object();
    const record = this.record();
    const sceneEntry = this.sceneEntry();
    if (!object || (!record && !sceneEntry)) return;
    const v = Object.fromEntries(INPUT_KEYS.map((key) => [key, Number(this.inputs[key].value)])) as Record<InputKey, number>;
    if (changed?.startsWith('s') && this.uniformScaleInput.checked) {
      v.sx = v.sy = v.sz = v[changed];
    }
    if (Object.values(v).some((value) => !Number.isFinite(value))) return this.note('Transform values must be finite.', 'error');
    const before = this.placements.captureManifest();
    object.position.set(
      THREE.MathUtils.clamp(v.px, -500, 500),
      THREE.MathUtils.clamp(v.py, -150, 150),
      THREE.MathUtils.clamp(v.pz, -500, 500),
    );
    object.rotation.set(v.rx * RAD, v.ry * RAD, v.rz * RAD);
    object.scale.set(
      THREE.MathUtils.clamp(v.sx, 0.05, 100),
      THREE.MathUtils.clamp(v.sy, 0.05, 100),
      THREE.MathUtils.clamp(v.sz, 0.05, 100),
    );
    const label = record?.label ?? sceneEntry?.label ?? this.selectedId ?? 'object';
    let after: WorkshopPlacementManifest;
    try {
      after = sceneEntry
        ? this.placements.setSceneOverride(sceneEntry.id, this.captureTransform(object))
        : this.placements.captureManifest();
    } catch (error) {
      this.placements.replaceManifest(before);
      this.note(error instanceof Error ? error.message : 'Transform rejected by Museum conservation.', 'error');
      this.refresh();
      return;
    }
    this.history.push(`Transform ${label}`, before, after);
    if (record?.collision === 'solid') this.placements.invalidateCollisions();
    this.selectionBox?.update();
    this.refresh();
  }

  private commitAppearance(): void {
    if (this.placements.isComparingOriginal) return;
    const record = this.record();
    const surfaceId = this.selectedSurfaceId;
    const texture = this.textureInput.value;
    if (surfaceId && !record) {
      const selected = this.placements.surfaces.resolve(surfaceId);
      if (!selected) return this.note('Scene surface is no longer available.', 'warn');
      const color = this.paintInput.value;
      if (!/^#[0-9a-f]{6}$/i.test(color)) return this.note('Choose a valid color.', 'error');
      const before = this.placements.captureManifest();
      try {
        const after = this.placements.setSurfaceOverride({
          id: selected.id, worldId: selected.worldId,
          color, ...(texture !== 'none' ? { texture } : {}),
        });
        this.history.push('Paint ' + selected.label, before, after);
        this.selectSurface(surfaceId);
        this.note('Surface finish applied without modifying structural geometry.', 'ok');
        this.refresh();
      } catch (error) {
        this.note(error instanceof Error ? error.message : 'Surface finish rejected.', 'error');
      }
      return;
    }
    if (!record) return;
    const depth = Number(this.depthInput.value);
    const color = this.paintInput.value;
    if (!/^#[0-9a-f]{6}$/i.test(color) || !Number.isFinite(depth) || depth < 0.01 || depth > 2) {
      return this.note('Color or wall thickness is invalid.', 'error');
    }
    const before = this.placements.captureManifest();
    try {
      const after = this.placements.setRecord({
        ...record, color, depth,
        texture: texture === 'none' ? undefined : texture,
        collision: this.collisionInput.value as 'none' | 'solid',
        event: this.eventInput.value as 'none' | 'announce',
      });
      this.history.push(`Finish ${record.label}`, before, after);
      this.select(record.id);
      this.note('Finish and behavior updated in preview. Save to build to persist.', 'ok');
      this.refresh();
    } catch (error) {
      this.placements.replaceManifest(before);
      this.note(error instanceof Error ? error.message : 'Finish change was rejected.', 'error');
    }
  }

  private beginWallPlacement(): void {
    const record = this.record();
    if (!record || (record.prefab !== 'wall-art' && record.prefab !== 'wall-panel')) {
      return this.note('Select a wall-art or wall-panel object first.', 'warn');
    }
    this.wallPlacementActive = true;
    this.note('Click a visible vertical wall surface in the museum to attach this object.', 'ok');
  }

  private mountOnWall(): void {
    const record = this.record();
    if (!record) return;
    const root = this.app.activeWorld === 'exterior' ? this.app.exteriorWorld.root : this.app.museum?.root;
    if (!root) return this.note('Active world geometry is unavailable.', 'warn');
    this.raycaster.setFromCamera(this.pointer, this.app.camera);
    const hits = this.raycaster.intersectObject(root, true);
    const normalMatrix = new THREE.Matrix3();
    for (const hit of hits) {
      if (!hit.face) continue;
      hit.object.updateWorldMatrix(true, false);
      normalMatrix.getNormalMatrix(hit.object.matrixWorld);
      const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
      if (Math.abs(normal.y) > 0.35) continue;
      const pose = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      const rotation = new THREE.Euler().setFromQuaternion(pose, 'XYZ');
      const offset = (record.depth ?? 0.055) / 2 + 0.018;
      const position = hit.point.clone().addScaledVector(normal, offset);
      const before = this.placements.captureManifest();
      try {
        const after = this.placements.setRecord({
          ...record, anchor: 'wall', worldId: this.app.activeWorld,
          position: [position.x, position.y, position.z],
          rotation: [rotation.x, rotation.y, rotation.z],
          collision: record.collision ?? 'none',
        });
        this.history.push(`Mount ${record.label}`, before, after);
        this.wallPlacementActive = false;
        this.select(record.id);
        this.note(`${record.label} attached. Adjust width, height and depth in the inspector.`, 'ok');
        this.refresh();
      } catch (error) {
        this.note(error instanceof Error ? error.message : 'Wall placement violates museum conservation.', 'error');
      }
      return;
    }
    this.note('No vertical surface found here. Try another wall.', 'warn');
  }

  private async importArtwork(): Promise<void> {
    const record = this.record();
    const file = this.imageInput.files?.[0];
    if (!file || record?.prefab !== 'wall-art') return;
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      this.imageInput.value = '';
      return this.note('Choose an image under 15 MB.', 'error');
    }
    this.note('Preparing local artwork…', 'ok');
    try {
      const bitmap = await createImageBitmap(file);
      const factor = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * factor));
      canvas.height = Math.max(1, Math.round(bitmap.height * factor));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image canvas unavailable');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolveBlob) => canvas.toBlob(resolveBlob, 'image/webp', 0.86));
      if (!blob || blob.type !== 'image/webp' || blob.size > 3 * 1024 * 1024) {
        throw new Error('Image conversion failed or exceeded 3 MB');
      }
      const response = await fetch(MEDIA_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: blob,
      });
      const result = await response.json() as { ok?: boolean; image?: string; error?: string };
      if (!response.ok || !result.ok || !result.image) throw new Error(result.error ?? 'Local artwork import failed');
      const current = this.record();
      if (!current || current.id !== record.id) {
        this.note('Artwork imported but selection changed. Re-select artwork to apply.', 'warn');
        return;
      }
      const before = this.placements.captureManifest();
      const after = this.placements.setRecord({ ...current, image: result.image });
      this.history.push(`Import artwork ${record.label}`, before, after);
      this.select(record.id);
      this.note('Artwork loaded into the museum. Save the build; review image files before publishing.', 'ok');
      this.refresh();
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'Artwork import failed.', 'error');
    } finally {
      this.imageInput.value = '';
    }
  }

  private undo(): void { this.applyHistory(this.history.undo(), 'Undo'); }
  private redo(): void { this.applyHistory(this.history.redo(), 'Redo'); }

  private applyHistory(result: { label: string; manifest: WorkshopPlacementManifest } | null, verb: string): void {
    if (!result) return;
    const id = this.selectedId;
    const surfaceId = this.selectedSurfaceId;
    this.placements.replaceManifest(result.manifest);
    if (surfaceId) this.selectSurface(surfaceId);
    else this.select(id && this.placements.getObject(id) ? id : null);
    this.note(`${verb}: ${result.label}`, 'ok');
    this.refresh();
  }

  private async save(): Promise<void> {
    this.saveButton.disabled = true;
    this.note('Writing validated placement source…', 'ok');
    try {
      const manifest = this.placements.captureManifest();
      const conservation = validateWorkshopConservation(manifest);
      if (!conservation.ok) {
        this.note(conservationErrors(conservation.violations).slice(0, 2).join('; '), 'error');
        return;
      }
      const response = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      });
      const payload = await response.json() as { ok?: boolean; path?: string; objects?: number; error?: string; details?: string[] };
      if (!response.ok || !payload.ok) throw new Error(payload.details?.join('; ') || payload.error || `HTTP ${response.status}`);
      this.note(`Saved ${payload.objects ?? 0} objects to ${payload.path ?? 'the build manifest'}.`, 'ok');
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'Workshop save failed.', 'error');
    } finally {
      this.saveButton.disabled = false;
    }
  }

  private select(id: string | null): void {
    this.selectedSurfaceId = null;
    this.selectedId = id;
    this.transform.detach();
    this.helper.visible = false;
    this.clearSelectionBox();
    const object = id ? this.placements.getObject(id) : null;
    if (!object) {
      this.selectedId = null;
      this.refreshInspector();
      return;
    }
    this.transform.attach(object);
    this.helper.visible = this.openState;
    this.selectionBox = new THREE.BoxHelper(object, 0x39c9ff);
    this.selectionBox.visible = this.openState;
    this.app.scene.add(this.selectionBox);
    this.refreshInspector();
  }

  private selectSurface(id: string): void {
    const surface = this.placements.surfaces.resolve(id);
    this.selectedId = null;
    this.selectedSurfaceId = surface?.id ?? null;
    this.transform.detach();
    this.helper.visible = false;
    this.clearSelectionBox();
    if (surface) {
      this.selectionBox = new THREE.BoxHelper(surface.mesh, 0xffcc66);
      this.selectionBox.visible = this.openState;
      this.app.scene.add(this.selectionBox);
    }
    this.refreshInspector();
  }

  private object(): THREE.Object3D | null { return this.selectedId ? this.placements.getObject(this.selectedId) : null; }
  private record(): WorkshopPlacementRecord | null {
    return this.selectedId
      ? this.placements.captureManifest().objects.find((item) => item.id === this.selectedId) ?? null
      : null;
  }

  private sceneEntry(): AuthorableSceneEntry | null {
    return this.selectedId ? this.placements.getSceneEntry(this.selectedId) : null;
  }

  private captureTransform(object: THREE.Object3D): AuthorableSceneTransform {
    return {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    };
  }

  private authorableHit(centre: boolean, preferSurface = false): { id: string; entry: AuthorableSceneEntry | null; isSurface: boolean } | null {
    if (centre) this.pointer.set(0, 0);
    this.raycaster.setFromCamera(this.pointer, this.app.camera);
    const world = this.app.activeWorld;
    const worldRoot = world === 'exterior' ? this.app.exteriorWorld.root : this.app.museum?.root;
    const candidates = [...this.placements.selectableObjects(), ...(worldRoot ? [worldRoot] : [])];
    const hits = this.raycaster.intersectObjects(candidates, true);
    for (const hit of hits) {
      if (typeof hit.object.userData.workshopId === 'string') {
        return { id: hit.object.userData.workshopId, entry: null, isSurface: false };
      }
      const entry = this.placements.authorableEntryForObject(hit.object);
      const surface = this.placements.surfaceAt(hit.object, world);
      if (preferSurface && surface) return { id: surface.id, entry, isSurface: true };
      if (entry) return { id: entry.id, entry, isSurface: false };
      if (surface) return { id: surface.id, entry: null, isSurface: true };
    }
    return null;
  }

  private readonly onCanvasPointerDown = (event: PointerEvent): void => {
    if (this.placements.isComparingOriginal) return;
    if (!this.openState || event.button !== 0 || this.transform.dragging || this.transform.axis !== null) return;
    const rect = this.app.renderer.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (this.wallPlacementActive) {
      event.preventDefault();
      this.mountOnWall();
      return;
    }
    const hit = this.authorableHit(false, event.altKey);
    if (hit?.isSurface) this.selectSurface(hit.id);
    else this.select(hit?.id ?? null);
    if (!hit) this.note('No editable mesh here. Instanced and skeletal assets are protected.', 'warn');
    this.refresh();
  };

  private readonly onTransformStart = (): void => { this.dragBefore = this.placements.captureManifest(); };
  private readonly onTransformChange = (): void => {
    const object = this.object();
    if (object) {
      object.position.set(
        THREE.MathUtils.clamp(object.position.x, -500, 500),
        THREE.MathUtils.clamp(object.position.y, -150, 150),
        THREE.MathUtils.clamp(object.position.z, -500, 500),
      );
      object.scale.set(
        THREE.MathUtils.clamp(object.scale.x, 0.05, 100),
        THREE.MathUtils.clamp(object.scale.y, 0.05, 100),
        THREE.MathUtils.clamp(object.scale.z, 0.05, 100),
      );
    }
    this.selectionBox?.update();
    this.refreshInspector();
  };
  private readonly onTransformEnd = (): void => {
    const before = this.dragBefore;
    const record = this.record();
    const sceneEntry = this.sceneEntry();
    this.dragBefore = null;
    if (before && (record || sceneEntry)) {
      try {
        const after = sceneEntry
          ? this.placements.setSceneOverride(sceneEntry.id, this.captureTransform(this.object()!))
          : this.placements.captureManifest();
        this.history.push(`Transform ${record?.label ?? sceneEntry?.label ?? 'object'}`, before, after);
        if (record?.collision === 'solid') this.placements.invalidateCollisions();
      } catch (error) {
        this.placements.replaceManifest(before);
        this.note(error instanceof Error ? error.message : 'Transform rejected by Museum conservation.', 'error');
      }
    }
    this.refresh();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'F8') {
      event.preventDefault(); event.stopPropagation(); this.toggle(); return;
    }
    const target = event.target as HTMLElement | null;
    const editing = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target?.tagName ?? '')
      || Boolean(target?.isContentEditable)
      || target?.getAttribute('role') === 'button';
    if (event.code === 'KeyF' && !editing) {
      const hit = this.authorableHit(true);
      if (!this.openState) {
        if (this.app.interaction.currentFocus || !hit) return;
        event.preventDefault(); event.stopPropagation(); this.open(hit.id); return;
      }
      event.preventDefault(); event.stopPropagation();
      if (hit?.isSurface) this.selectSurface(hit.id);
      else if (hit) this.select(hit.id);
      else this.note('No individually selectable mesh at crosshair.', 'warn');
      this.refresh();
      return;
    }
    if (!this.openState) return;
    if (this.placements.isComparingOriginal) {
      if (event.code === 'Escape') this.toggleComparison();
      event.stopPropagation();
      return;
    }
    if (event.code === 'Escape' && this.wallPlacementActive) {
      this.wallPlacementActive = false;
      this.note('Wall attachment cancelled.', 'warn');
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.code === 'KeyS') { event.preventDefault(); void this.save(); }
    else if (!editing && mod && event.code === 'KeyZ') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
    }
    else if (!editing && mod && event.code === 'KeyD') { event.preventDefault(); this.duplicate(); }
    else if (!editing && event.code === 'Delete') { event.preventDefault(); this.remove(); }
    else if (!editing && event.code === 'KeyG') { event.preventDefault(); this.snapFloor(); }
    else if (!editing && event.code === 'KeyW') this.setMode('translate');
    else if (!editing && event.code === 'KeyE') this.setMode('rotate');
    else if (!editing && event.code === 'KeyR') this.setMode('scale');
    else if (!editing && event.code === 'Escape') this.close();
    event.stopPropagation();
  };

  private refresh(): void {
    // Workshop is the only runtime allowed to reposition static shadow casters.
    // Production keeps the shadow map baked; authoring refreshes it on demand.
    this.app.renderer.requestShadowUpdate();
    this.refreshInspector();
    this.refreshOutliner();
    this.undoButton.disabled = !this.history.canUndo;
    this.redoButton.disabled = !this.history.canRedo;
    const placement = this.record();
    const placementSelected = placement !== null;
    const comparing = this.placements.isComparingOriginal;
    // A comparison is a read-only lens; no edits can be made until the user
    // explicitly returns to the authored scene.
    this.saveButton.disabled = comparing;
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => { button.disabled = comparing; });
    this.el<HTMLButtonElement>('floor').disabled = comparing || !placementSelected;
    this.el<HTMLButtonElement>('duplicate').disabled = comparing || !placementSelected;
    this.el<HTMLButtonElement>('delete').disabled = comparing || (!placementSelected && !this.selectedSurfaceId);
    this.el<HTMLElement>('palette').querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = comparing; });
    this.assetResults.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = comparing; });
    this.modelInput.disabled = comparing;
    this.el<HTMLButtonElement>('place-wall').disabled = placement?.prefab !== 'wall-art' && placement?.prefab !== 'wall-panel';
    this.el<HTMLButtonElement>('focus').disabled = !this.object() && !this.selectedSurfaceId;
    this.el<HTMLButtonElement>('compare').dataset.active = String(this.placements.isComparingOriginal);
    this.el<HTMLButtonElement>('compare').textContent = this.placements.isComparingOriginal
      ? 'Return to authored view' : 'Reveal original';
    this.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
      button.dataset.active = String(button.dataset.view === this.camera.currentView);
    });
    this.el<HTMLElement>('world-indicator').textContent = `Editing: ${this.app.activeWorld === 'exterior' ? 'Island' : 'Museum'}`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.dataset.active = String(button.dataset.mode === this.transform.mode);
    });
  }

  private refreshInspector(): void {
    const record = this.record();
    const sceneEntry = this.sceneEntry();
    const object = this.object();
    const surface = this.selectedSurfaceId ? this.placements.surfaces.resolve(this.selectedSurfaceId) : null;
    const disabled = (!record && !sceneEntry && !surface) || (!object && !surface);
    this.labelInput.disabled = disabled || sceneEntry !== null || surface !== null || this.placements.isComparingOriginal;
    this.anchorInput.disabled = disabled || sceneEntry !== null || surface !== null || this.placements.isComparingOriginal;
    for (const input of Object.values(this.inputs)) input.disabled = disabled || surface !== null || this.placements.isComparingOriginal;
    const locked = this.placements.isComparingOriginal;
    this.uniformScaleInput.disabled = disabled || surface !== null || locked;
    this.paintInput.disabled = (!record && !surface) || locked;
    this.textureInput.disabled = (!record && !surface) || locked;
    this.finishFileInput.disabled = (!record && !surface) || locked;
    this.depthInput.disabled = (record?.prefab !== 'wall-art' && record?.prefab !== 'wall-panel') || locked;
    this.collisionInput.disabled = !record || locked;
    this.eventInput.disabled = !record || locked;
    this.imageInput.disabled = record?.prefab !== 'wall-art' || locked;
    if (surface) {
      const finish = this.placements.getSurfaceOverride(surface.id);
      this.title.textContent = surface.label;
      this.meta.textContent = surface.id + ' · ' + surface.worldId
        + ' · paint-only original mesh (geometry and collision stay protected)';
      this.labelInput.value = surface.label;
      this.anchorInput.value = 'wall';
      this.paintInput.value = finish?.color ?? '#ffffff';
      const texture = finish?.texture ?? 'none';
      this.ensureFinishOption(texture);
      this.textureInput.value = texture;
      this.depthInput.value = '0.055';
      this.collisionInput.value = 'none';
      this.eventInput.value = 'none';
      for (const input of Object.values(this.inputs)) input.value = '';
      return;
    }
    if ((!record && !sceneEntry) || !object) {
      this.title.textContent = 'Nothing selected';
      this.meta.textContent = 'Click an authored object or choose one below.';
      this.labelInput.value = '';
      this.paintInput.value = '#a3b5bd';
      this.textureInput.value = 'none';
      this.depthInput.value = '0.055';
      this.collisionInput.value = 'none';
      this.eventInput.value = 'none';
      for (const input of Object.values(this.inputs)) input.value = '';
      return;
    }
    this.title.textContent = record?.label ?? sceneEntry!.label;
    this.meta.textContent = record
      ? `${record.id} · ${record.prefab}`
      : `${sceneEntry!.id} · existing scene · ${sceneEntry!.source} · ${sceneEntry!.collisionPolicy}`;
    this.labelInput.value = record?.label ?? sceneEntry!.label;
    this.anchorInput.value = record?.anchor ?? 'free';
    this.paintInput.value = record?.color ?? '#a3b5bd';
    const finish = record?.texture ?? 'none';
    this.ensureFinishOption(finish);
    this.textureInput.value = finish;
    this.depthInput.value = String(record?.depth ?? 0.055);
    this.collisionInput.value = record?.collision ?? 'none';
    this.eventInput.value = record?.event ?? 'none';
    const values: Record<InputKey, number> = {
      px: object.position.x, py: object.position.y, pz: object.position.z,
      rx: object.rotation.x * DEG, ry: object.rotation.y * DEG, rz: object.rotation.z * DEG,
      sx: object.scale.x, sy: object.scale.y, sz: object.scale.z,
    };
    for (const key of INPUT_KEYS) this.inputs[key].value = values[key].toFixed(key.startsWith('r') ? 2 : 3);
  }

  private refreshOutliner(): void {
    this.outliner.replaceChildren();
    const objects = this.placements.captureManifest().objects;
    const sceneEntries = this.placements.sceneEntries();
    const finishedSurfaces = this.placements.captureManifest().surfaceOverrides
      ?.filter((item) => item.worldId === this.app.activeWorld) ?? [];
    if (!objects.length && !sceneEntries.length && !finishedSurfaces.length) {
      const empty = document.createElement('p'); empty.className = 'workshop-muted'; empty.textContent = 'No authored objects yet.'; this.outliner.append(empty); return;
    }
    for (const finish of finishedSurfaces) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.selected = String(finish.id === this.selectedSurfaceId);
      button.textContent = 'Painted mesh · ' + finish.id;
      button.addEventListener('click', () => { this.selectSurface(finish.id); this.refresh(); });
      this.outliner.append(button);
    }
    for (const entry of sceneEntries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.selected = String(entry.id === this.selectedId);
      button.textContent = entry.label;
      const small = document.createElement('small'); small.textContent = `${entry.id} · existing`; button.append(small);
      button.addEventListener('click', () => { this.select(entry.id); this.refresh(); });
      this.outliner.append(button);
    }
    for (const record of objects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.selected = String(record.id === this.selectedId);
      button.textContent = record.label;
      const small = document.createElement('small'); small.textContent = record.id; button.append(small);
      button.addEventListener('click', () => { this.select(record.id); this.refresh(); });
      this.outliner.append(button);
    }
  }

  private uniqueId(prefab: WorkshopPrefabId): string {
    const ids = new Set(this.placements.captureManifest().objects.map((record) => record.id));
    for (let i = 1; i < 1000; i++) {
      const id = `${prefab}-${String(i).padStart(2, '0')}`;
      if (!ids.has(id)) return id;
    }
    return `${prefab}-${Date.now()}`;
  }

  private clearSelectionBox(): void {
    if (!this.selectionBox) return;
    this.selectionBox.removeFromParent();
    this.selectionBox.geometry.dispose();
    this.selectionBox.material.dispose();
    this.selectionBox = null;
  }

  private note(message: string, kind: 'ok' | 'warn' | 'error'): void {
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  private el<T extends HTMLElement = HTMLElement>(name: string): T {
    const element = this.root.querySelector<T>(`[data-workshop="${name}"]`);
    if (!element) throw new Error(`Museum Workshop UI is missing ${name}`);
    return element;
  }
}

const WORKSHOP_HTML = `
<div class="workshop-toolbar">
  <button type="button" data-mode="translate">Move</button><button type="button" data-mode="rotate">Rotate</button><button type="button" data-mode="scale">Scale</button>
  <button type="button" data-view="dollhouse" data-workshop="view-dollhouse">Dollhouse</button>
  <button type="button" data-view="orbit" data-workshop="view-orbit">Orbit</button>
  <button type="button" data-view="top" data-workshop="view-top">Top</button>
  <button type="button" data-workshop="world-exterior">Island</button><button type="button" data-workshop="world-interior">Museum</button>
  <button type="button" data-workshop="compare" title="Temporarily reveal the original museum without losing authored work">Reveal original</button>
  <button type="button" data-workshop="space">World</button><button type="button" data-workshop="floor">Snap floor</button>
  <button type="button" data-workshop="undo">Undo</button><button type="button" data-workshop="redo">Redo</button>
  <button type="button" data-workshop="save">Save to build</button><button type="button" data-workshop="exit">Exit F8</button>
</div>
<nav class="workshop-keymap" data-workshop="keymap" aria-label="Museum Workshop keyboard commands">
  <span><kbd>F</kbd>Select/Edit object</span><span>Alt + click: paint child mesh</span><span><kbd>F8</kbd>toggle</span><span><kbd>Esc</kbd>exit</span><span><kbd>W</kbd>move</span><span><kbd>E</kbd>rotate</span><span><kbd>R</kbd>scale</span><span><kbd>G</kbd>floor</span>
  <span><kbd>⌘/Ctrl+D</kbd>duplicate</span><span><kbd>Delete</kbd>remove</span><span><kbd>⌘/Ctrl+Z</kbd>undo</span><span><kbd>⇧⌘/Ctrl+Z</kbd>redo</span><span><kbd>⌘/Ctrl+S</kbd>save</span>
</nav>
<aside class="workshop-panel" data-workshop="panel" tabindex="-1" aria-label="Museum Builder development editor">
  <header><div><span>DEVELOPMENT ONLY</span><h2>Museum Workshop</h2><p class="workshop-muted">Unified Builder</p></div><b>local authoring</b></header>
  <section><h3>Selection</h3><strong data-workshop="selection-title"></strong><p class="workshop-muted" data-workshop="selection-meta"></p>
    <label>Label<input data-workshop="label" maxlength="80"></label>
    <label>Anchor<select data-workshop="anchor"><option value="floor">Floor anchored</option><option value="free">Free placement</option><option value="wall">Wall mounted</option></select></label>
    <div class="workshop-row"><button type="button" data-workshop="duplicate">Duplicate</button><button type="button" data-workshop="delete">Delete</button></div>
  </section>
  <section><h3>Transform</h3>
    <div class="workshop-vector"><span>Position</span><input type="number" step=".05" data-workshop="px"><input type="number" step=".05" data-workshop="py"><input type="number" step=".05" data-workshop="pz"></div>
    <div class="workshop-vector"><span>Rotation °</span><input type="number" step="1" data-workshop="rx"><input type="number" step="1" data-workshop="ry"><input type="number" step="1" data-workshop="rz"></div>
    <div class="workshop-vector"><span>Scale</span><input type="number" min=".05" max="100" step=".05" data-workshop="sx" aria-label="Scale X"><input type="number" min=".05" max="100" step=".05" data-workshop="sy" aria-label="Scale Y"><input type="number" min=".05" max="100" step=".05" data-workshop="sz" aria-label="Scale Z"></div>
    <label><span>Proportions</span><span><input type="checkbox" data-workshop="uniform-scale"> Lock uniform scaling</span></label>
    <label>Grid<select data-workshop="grid-snap"><option value="0">Off — free</option><option value=".05">5 cm</option><option value=".1" selected>10 cm</option><option value=".25">25 cm</option><option value=".5">50 cm</option><option value="1">1 metre</option></select></label>
    <button type="button" data-workshop="focus">Focus selection</button>
  </section>
  <section><h3>Surface, finish &amp; behavior</h3>
    <label>Paint<input data-workshop="paint" type="color" value="#a3b5bd"></label>
    <label>Texture<select data-workshop="texture" aria-label="Surface texture"><option value="none">None — solid paint</option></select></label>
    <label>Import finish<input data-workshop="finish-import" type="file" accept="image/*" aria-label="Import custom texture image"></label>
    <p class="workshop-muted">Click a wall or object mesh to paint it. Alt-click a known scene object to paint its individual surface. Painting preserves structural geometry and collision.</p>
    <label>Depth (m)<input data-workshop="depth" type="number" min=".01" max="2" step=".01" value=".055"></label>
    <button type="button" data-workshop="place-wall">Attach selected to wall</button>
    <label>Artwork image<input data-workshop="image" type="file" accept="image/*"></label>
    <p class="workshop-muted">Images become local WebP files in public/workshop-media. Review before committing or publishing.</p>
    <label>Collision<select data-workshop="collision"><option value="none">Walk through (none)</option><option value="solid">Solid bounding box</option></select></label>
    <label>On interact<select data-workshop="event"><option value="none">No action</option><option value="announce">Announce object name</option></select></label>
    <p class="workshop-muted">Protected geometry and routes remain locked. No arbitrary scripts are executed.</p>
  </section>
  <section><h3>Asset library</h3>
    <p class="workshop-muted">Models copied from verified project sources. Search, inspect provenance, then summon into this world.</p>
    <label>Search<input data-workshop="asset-search" type="search" placeholder="statue, nature, chair…" aria-label="Search models"></label>
    <label>Category<select data-workshop="asset-category" aria-label="Asset category"></select></label>
    <p class="workshop-muted" data-workshop="asset-count">Loading catalog…</p>
    <div class="workshop-asset-results" data-workshop="asset-results" role="group" aria-label="Searchable asset models"></div>
    <label>Import GLB<input data-workshop="model-import" type="file" accept=".glb,model/gltf-binary" aria-label="Import local GLB model"></label>
    <p class="workshop-muted">Self-contained GLB, up to 8 MB. Local-only import; review rights and assets before publication.</p>
  </section>
  <section><h3>Primitive objects & fixtures</h3><div class="workshop-palette" data-workshop="palette"></div></section>
  <section><h3>Placed objects</h3><div class="workshop-outliner" data-workshop="outliner"></div></section>
  <p data-workshop="world-indicator" class="workshop-muted">Editing: Island</p>
  <div class="workshop-status" data-workshop="status" role="status" aria-live="polite"></div>
</aside>`;
