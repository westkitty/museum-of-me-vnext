import * as THREE from 'three';
import { TransformControls, type TransformControlsMode } from 'three/examples/jsm/controls/TransformControls.js';
import type { App } from '../app/App';
import type { MuseumPlacements } from './MuseumPlacements';
import type { AuthorableSceneEntry, AuthorableSceneTransform } from './AuthorableSceneRegistry';
import { WORKSHOP_PREFABS, type WorkshopPrefabId } from './catalog';
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
const INPUT_KEYS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz'] as const;
type InputKey = (typeof INPUT_KEYS)[number];

/** Development-only authoring UI. Production receives only MuseumPlacements. */
export class Workshop {
  private readonly root = document.createElement('div');
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly transform: TransformControls;
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
    for (const key of INPUT_KEYS) this.inputs[key] = this.el<HTMLInputElement>(key);

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
    if (targetId) this.select(targetId);
    this.openState = true;
    this.root.hidden = false;
    this.app.input.releasePointerLock();
    this.app.input.uiCaptured = true;
    this.app.player.setFrozen(true);
    this.app.ui.setBuildModeActive(true);
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
    this.transform.enabled = false;
    this.helper.visible = false;
    if (this.selectionBox) this.selectionBox.visible = false;
    this.app.input.uiCaptured = false;
    this.app.player.setFrozen(false);
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
    this.transform.removeEventListener('mouseUp', this.onTransformEnd);
    this.transform.removeEventListener('objectChange', this.onTransformChange);
    this.transform.detach();
    this.transform.disconnect();
    this.helper.removeFromParent();
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
    for (const input of Object.values(this.inputs)) input.addEventListener('change', () => this.commitTransform());

    const palette = this.el('palette');
    for (const prefab of WORKSHOP_PREFABS) {
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

  private add(prefab: WorkshopPrefabId): void {
    const before = this.placements.captureManifest();
    if (before.objects.length >= 256) return this.note('Workshop object limit reached.', 'error');
    const direction = new THREE.Vector3();
    this.app.camera.getWorldDirection(direction);
    const x = this.app.camera.position.x + direction.x * 4;
    const z = this.app.camera.position.z + direction.z * 4;
    const y = this.app.museum.collision.supportHeight(x, z, this.app.player.position.y, 1.5)
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
    };
    const after = this.placements.setRecord(record);
    this.history.push(`Add ${record.label}`, before, after);
    this.select(record.id);
    this.note(`${record.label} added.`, 'ok');
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
    const floor = this.app.museum.collision.supportHeight(
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
    if (!label || label.length > 80 || (anchor !== 'floor' && anchor !== 'free')) return this.refreshInspector();
    const before = this.placements.captureManifest();
    const after = this.placements.setRecord({ ...record, label, anchor });
    this.history.push(`Edit ${record.label}`, before, after);
    this.select(record.id);
    this.refresh();
  }

  private commitTransform(): void {
    const object = this.object();
    const record = this.record();
    const sceneEntry = this.sceneEntry();
    if (!object || (!record && !sceneEntry)) return;
    const v = Object.fromEntries(INPUT_KEYS.map((key) => [key, Number(this.inputs[key].value)])) as Record<InputKey, number>;
    if (Object.values(v).some((value) => !Number.isFinite(value))) return this.note('Transform values must be finite.', 'error');
    const before = this.placements.captureManifest();
    object.position.set(
      THREE.MathUtils.clamp(v.px, -500, 500),
      THREE.MathUtils.clamp(v.py, -150, 150),
      THREE.MathUtils.clamp(v.pz, -500, 500),
    );
    object.rotation.set(v.rx * RAD, v.ry * RAD, v.rz * RAD);
    object.scale.set(
      THREE.MathUtils.clamp(v.sx, 0.05, 20),
      THREE.MathUtils.clamp(v.sy, 0.05, 20),
      THREE.MathUtils.clamp(v.sz, 0.05, 20),
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
    this.selectionBox?.update();
    this.refresh();
  }

  private undo(): void { this.applyHistory(this.history.undo(), 'Undo'); }
  private redo(): void { this.applyHistory(this.history.redo(), 'Redo'); }

  private applyHistory(result: { label: string; manifest: WorkshopPlacementManifest } | null, verb: string): void {
    if (!result) return;
    const id = this.selectedId;
    this.placements.replaceManifest(result.manifest);
    this.select(id && this.placements.getObject(id) ? id : null);
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

  private authorableHit(centre: boolean): { id: string; entry: AuthorableSceneEntry | null } | null {
    if (centre) this.pointer.set(0, 0);
    this.raycaster.setFromCamera(this.pointer, this.app.camera);
    const hit = this.raycaster.intersectObjects([...this.placements.selectableObjects()], true)[0];
    if (!hit) return null;
    const entry = this.placements.authorableEntryForObject(hit.object);
    const id = entry?.id ?? hit.object.userData.workshopId;
    return typeof id === 'string' ? { id, entry } : null;
  }

  private readonly onCanvasPointerDown = (event: PointerEvent): void => {
    if (!this.openState || event.button !== 0 || this.transform.dragging || this.transform.axis !== null) return;
    const rect = this.app.renderer.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const hit = this.authorableHit(false);
    this.select(hit?.id ?? null);
    if (!hit) this.note('Protected scene geometry. Only registered dressing objects can be edited.', 'warn');
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
        THREE.MathUtils.clamp(object.scale.x, 0.05, 20),
        THREE.MathUtils.clamp(object.scale.y, 0.05, 20),
        THREE.MathUtils.clamp(object.scale.z, 0.05, 20),
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
      if (hit) this.select(hit.id);
      else this.note('Protected scene geometry. Only registered dressing objects can be edited.', 'warn');
      this.refresh();
      return;
    }
    if (!this.openState) return;
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
    const placementSelected = this.record() !== null;
    this.el<HTMLButtonElement>('duplicate').disabled = !placementSelected;
    this.el<HTMLButtonElement>('delete').disabled = !placementSelected;
    this.el<HTMLButtonElement>('floor').disabled = !placementSelected;
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.dataset.active = String(button.dataset.mode === this.transform.mode);
    });
  }

  private refreshInspector(): void {
    const record = this.record();
    const sceneEntry = this.sceneEntry();
    const object = this.object();
    const disabled = (!record && !sceneEntry) || !object;
    this.labelInput.disabled = disabled || sceneEntry !== null;
    this.anchorInput.disabled = disabled || sceneEntry !== null;
    for (const input of Object.values(this.inputs)) input.disabled = disabled;
    if ((!record && !sceneEntry) || !object) {
      this.title.textContent = 'Nothing selected';
      this.meta.textContent = 'Click an authored object or choose one below.';
      this.labelInput.value = '';
      for (const input of Object.values(this.inputs)) input.value = '';
      return;
    }
    this.title.textContent = record?.label ?? sceneEntry!.label;
    this.meta.textContent = record
      ? `${record.id} · ${record.prefab}`
      : `${sceneEntry!.id} · existing scene · ${sceneEntry!.source} · ${sceneEntry!.collisionPolicy}`;
    this.labelInput.value = record?.label ?? sceneEntry!.label;
    this.anchorInput.value = record?.anchor ?? 'free';
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
    if (!objects.length && !sceneEntries.length) {
      const empty = document.createElement('p'); empty.className = 'workshop-muted'; empty.textContent = 'No authored objects yet.'; this.outliner.append(empty); return;
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
  <button type="button" data-workshop="space">World</button><button type="button" data-workshop="floor">Snap floor</button>
  <button type="button" data-workshop="undo">Undo</button><button type="button" data-workshop="redo">Redo</button>
  <button type="button" data-workshop="save">Save to build</button><button type="button" data-workshop="exit">Exit F8</button>
</div>
<nav class="workshop-keymap" data-workshop="keymap" aria-label="Museum Workshop keyboard commands">
  <span><kbd>F</kbd>Select/Edit object</span><span><kbd>F8</kbd>toggle</span><span><kbd>Esc</kbd>exit</span><span><kbd>W</kbd>move</span><span><kbd>E</kbd>rotate</span><span><kbd>R</kbd>scale</span><span><kbd>G</kbd>floor</span>
  <span><kbd>⌘/Ctrl+D</kbd>duplicate</span><span><kbd>Delete</kbd>remove</span><span><kbd>⌘/Ctrl+Z</kbd>undo</span><span><kbd>⇧⌘/Ctrl+Z</kbd>redo</span><span><kbd>⌘/Ctrl+S</kbd>save</span>
</nav>
<aside class="workshop-panel" data-workshop="panel" tabindex="-1" aria-label="Museum Workshop development editor">
  <header><div><span>DEVELOPMENT ONLY</span><h2>Museum Workshop</h2></div><b>safe objects</b></header>
  <section><h3>Selection</h3><strong data-workshop="selection-title"></strong><p class="workshop-muted" data-workshop="selection-meta"></p>
    <label>Label<input data-workshop="label" maxlength="80"></label>
    <label>Anchor<select data-workshop="anchor"><option value="floor">Floor anchored</option><option value="free">Free placement</option></select></label>
    <div class="workshop-row"><button type="button" data-workshop="duplicate">Duplicate</button><button type="button" data-workshop="delete">Delete</button></div>
  </section>
  <section><h3>Transform</h3>
    <div class="workshop-vector"><span>Position</span><input type="number" step=".05" data-workshop="px"><input type="number" step=".05" data-workshop="py"><input type="number" step=".05" data-workshop="pz"></div>
    <div class="workshop-vector"><span>Rotation °</span><input type="number" step="1" data-workshop="rx"><input type="number" step="1" data-workshop="ry"><input type="number" step="1" data-workshop="rz"></div>
    <div class="workshop-vector"><span>Scale</span><input type="number" min=".05" max="20" step=".05" data-workshop="sx"><input type="number" min=".05" max="20" step=".05" data-workshop="sy"><input type="number" min=".05" max="20" step=".05" data-workshop="sz"></div>
  </section>
  <section><h3>Add safe object</h3><div class="workshop-palette" data-workshop="palette"></div></section>
  <section><h3>Placed objects</h3><div class="workshop-outliner" data-workshop="outliner"></div></section>
  <div class="workshop-status" data-workshop="status" role="status" aria-live="polite"></div>
</aside>`;
