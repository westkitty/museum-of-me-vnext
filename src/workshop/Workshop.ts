import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import { TransformControls, type TransformControlsMode } from 'three/examples/jsm/controls/TransformControls.js';
import type { App } from '../app/App';
import type { MuseumPlacements } from './MuseumPlacements';
import { BuilderCamera, type BuilderView } from './BuilderCamera';
import type { AuthorableSceneEntry, AuthorableSceneTransform } from './AuthorableSceneRegistry';
import { WORKSHOP_PREFABS, type WorkshopPrefabId } from './catalog';
import { measureWall, snapWallPoint, type WallPoint } from './WallSketch';
import { measureRoom } from './RoomSketch';
import { defaultOpening } from './WallOpenings';
import { BUILDER_MODELS, BUILDER_FINISHES, searchBuilderLibrary, builderModel } from './builderAssetCatalog';
import { conservationErrors, validateWorkshopConservation } from './conservation';
import { WorkshopHistory } from './history';
import { filterSourceCatalog, sourceAvailability, type SourceAvailability, type SourceAvailabilityInfo } from './sourceCatalog';
import { buildMuseumSceneIndex, querySceneIndex } from './SceneIndex';
import { scanAuthoredRouteClearance } from './RouteClearance';
import { applyWalkwayProposals, clearWalkways, type WalkwayProposal } from './ClearWalkways';
import { museumHealth } from './MuseumHealth';
import { visitorJury, type JuryCheck, type VisitorJuryReport } from './VisitorJury';
import { MEANINGFUL_ACTIONS, MEANING_MAX_DISTANCE } from './MeaningfulObjects';
import { applyCurateSuggestions, autoCurate, rejectCurateSuggestion, type CurateDensity, type CurateMode, type CurateSuggestion } from './AutoCurate';
import { NARRATIVE_GRAVITY_PILOTS, applyGravitySuggestions, narrativeGravity, rejectGravitySuggestion, type GravitySuggestion, type NarrativeGravityPilot } from './NarrativeGravity';
import { ZONES } from '../world/layout';
import { KIT_TEMPLATES, duplicateKit, kitFollowMember, kitOf, kitOverrides, placeKit, removeKit, resetKitSlot } from './ExhibitKits';
import { addEmptyRegion, isLocked, latestDecision, recordDecision, removeEmptyRegion, setLocked } from './CuratorMemory';
import {
  type WorkshopAnchor,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
  type MeaningfulActionId,
  type WorkshopKitTemplateId,
  type WorkshopVec3,
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
  private savedRevision: string;
  private sourceCatalog: typeof import('./catalog-data/tge-index.json').models | null = null;
  private sourceSelection: (typeof import('./catalog-data/tge-index.json').models)[number] | null = null;
  private sourcePage = 0;
  private sourceAvailability: (id: string) => SourceAvailabilityInfo = sourceAvailability(null);
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
  private readonly openingInput: HTMLSelectElement;
  private readonly openingWidthInput: HTMLInputElement;
  private readonly openingHeightInput: HTMLInputElement;
  private readonly openingSillInput: HTMLInputElement;
  private readonly collisionInput: HTMLSelectElement;
  private readonly eventInput: HTMLSelectElement;
  private readonly eventMessageInput: HTMLInputElement;
  private readonly eventColorInput: HTMLInputElement;
  private readonly snapInput: HTMLSelectElement;
  private readonly uniformScaleInput: HTMLInputElement;
  private wallPlacementActive = false;
  private wallDrawing = false;
  private wallDrawStart: WallPoint | null = null;
  private wallDrawHeight = 0;
  private roomDrawing = false;
  private roomDrawStart: WallPoint | null = null;
  private readonly roomPreview: THREE.LineLoop;
  private readonly roomRoofInput: HTMLInputElement;
  private readonly wallPreview: THREE.Line;
  private savedVisitorPosition: THREE.Vector3 | null = null;
  private savedVisitorYaw = 0;
  private savedVisitorWorld: 'interior' | 'exterior' = 'exterior';
  private readonly helper: THREE.Object3D;
  private readonly history = new WorkshopHistory();
  private walkwayGhost: THREE.Box3Helper | null = null;
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
    this.savedRevision = document.getElementById('museum-workshop-source')?.dataset.sha256 ?? '';
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
    this.openingInput = this.el<HTMLSelectElement>('opening');
    this.openingWidthInput = this.el<HTMLInputElement>('opening-width');
    this.openingHeightInput = this.el<HTMLInputElement>('opening-height');
    this.openingSillInput = this.el<HTMLInputElement>('opening-sill');
    this.collisionInput = this.el<HTMLSelectElement>('collision');
    this.eventInput = this.el<HTMLSelectElement>('event');
    this.eventMessageInput = this.el<HTMLInputElement>('event-message');
    this.eventColorInput = this.el<HTMLInputElement>('event-color');
    this.snapInput = this.el<HTMLSelectElement>('grid-snap');
    this.uniformScaleInput = this.el<HTMLInputElement>('uniform-scale');
    this.roomRoofInput = this.el<HTMLInputElement>('room-roof');
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
    const wallGuideGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(),
    ]);
    this.wallPreview = new THREE.Line(
      wallGuideGeometry,
      new THREE.LineBasicMaterial({ color: 0x72e5f4, depthTest: false }),
    );
    this.wallPreview.name = 'museum-builder-wall-guide';
    this.wallPreview.visible = false;
    this.wallPreview.frustumCulled = false;
    app.scene.add(this.wallPreview);
    const roomOutlineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
    ]);
    this.roomPreview = new THREE.LineLoop(
      roomOutlineGeometry,
      new THREE.LineBasicMaterial({ color: 0xf2d58b, depthTest: false }),
    );
    this.roomPreview.name = 'museum-builder-room-outline-guide';
    this.roomPreview.visible = false;
    this.roomPreview.frustumCulled = false;
    app.scene.add(this.roomPreview);

    this.bindUi();
    this.transform.addEventListener('mouseDown', this.onTransformStart);
    this.transform.addEventListener('mouseDown', this.onDragCameraDisable);
    this.transform.addEventListener('mouseUp', this.onDragCameraEnable);
    this.transform.addEventListener('mouseUp', this.onTransformEnd);
    this.transform.addEventListener('objectChange', this.onTransformChange);
    app.renderer.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    app.renderer.canvas.addEventListener('pointermove', this.onWallPointerMove);
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
    this.cancelWallDrawing();
    this.cancelRoomDrawing();
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
    this.app.renderer.canvas.removeEventListener('pointermove', this.onWallPointerMove);
    document.removeEventListener('keydown', this.onKeyDown, true);
    this.transform.removeEventListener('mouseDown', this.onTransformStart);
    this.transform.removeEventListener('mouseDown', this.onDragCameraDisable);
    this.transform.removeEventListener('mouseUp', this.onDragCameraEnable);
    this.transform.removeEventListener('mouseUp', this.onTransformEnd);
    this.transform.removeEventListener('objectChange', this.onTransformChange);
    this.transform.detach();
    this.transform.disconnect();
    this.helper.removeFromParent();
    this.wallPreview.removeFromParent();
    this.wallPreview.geometry.dispose();
    (this.wallPreview.material as THREE.Material).dispose();
    this.roomPreview.removeFromParent();
    this.roomPreview.geometry.dispose();
    (this.roomPreview.material as THREE.Material).dispose();
    this.camera.dispose();
    this.clearSelectionBox();
    this.root.remove();
  }

  private bindUi(): void {
    this.el<HTMLButtonElement>('scene-index-refresh').addEventListener('click', () => this.refreshSceneIndex());
    this.el<HTMLButtonElement>('clearance-scan').addEventListener('click', () => this.scanClearance());
    this.el<HTMLButtonElement>('walkways-scan').addEventListener('click', () => this.scanWalkways());
    this.el<HTMLButtonElement>('health-run').addEventListener('click', () => this.checkHealth());
    this.el<HTMLButtonElement>('jury-run').addEventListener('click', () => this.runJury());
    this.el<HTMLSelectElement>('meaning').addEventListener('change', () => this.commitMeaning());
    this.el<HTMLButtonElement>('curate-run').addEventListener('click', () => this.runCurate());
    this.el<HTMLButtonElement>('curate-approve-all').addEventListener('click', () => this.curateAction(this.curateSuggestions, 'approve'));
    this.el<HTMLButtonElement>('gravity-run').addEventListener('click', () => this.runGravity());
    this.el<HTMLButtonElement>('kit-place').addEventListener('click', () => this.placeKitInView());
    this.el<HTMLButtonElement>('kit-duplicate').addEventListener('click', () => this.kitAction('duplicate'));
    this.el<HTMLButtonElement>('kit-reset').addEventListener('click', () => this.kitAction('reset'));
    this.el<HTMLButtonElement>('kit-ungroup').addEventListener('click', () => this.kitAction('ungroup'));
    this.el<HTMLButtonElement>('kit-delete').addEventListener('click', () => this.kitAction('delete'));
    this.el<HTMLButtonElement>('curator-lock').addEventListener('click', () => { if (this.selectedId) this.toggleLock(this.selectedId); });
    this.el<HTMLButtonElement>('curator-empty').addEventListener('click', () => this.keepAreaEmpty());
    this.el<HTMLSelectElement>('scene-index-exhibit').addEventListener('change', () => this.describeSceneExhibit());
    this.el<HTMLButtonElement>('source-load').addEventListener('click', () => void this.loadSourceCatalog());
    this.el<HTMLButtonElement>('source-import').addEventListener('click', () => void this.importSourceCandidate());
    this.el<HTMLInputElement>('source-search').addEventListener('input', () => { this.sourcePage = 0; this.refreshSourceCatalog(); });
    this.el<HTMLSelectElement>('source-featured').addEventListener('change', () => { this.sourcePage = 0; this.refreshSourceCatalog(); });
    this.el<HTMLSelectElement>('source-pack').addEventListener('change', () => { this.sourcePage = 0; this.refreshSourceCatalog(); });
    this.el<HTMLSelectElement>('source-wing').addEventListener('change', () => { this.sourcePage = 0; this.refreshSourceCatalog(); });
    this.el<HTMLSelectElement>('source-availability').addEventListener('change', () => { this.sourcePage = 0; this.refreshSourceCatalog(); });
    this.el<HTMLButtonElement>('source-prev').addEventListener('click', () => { this.sourcePage--; this.refreshSourceCatalog(); });
    this.el<HTMLButtonElement>('source-next').addEventListener('click', () => { this.sourcePage++; this.refreshSourceCatalog(); });
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
    this.openingInput.addEventListener('change', () => {
      const kind = this.openingInput.value;
      if (kind === 'door' || kind === 'window') {
        const fallback = defaultOpening(kind);
        this.openingWidthInput.value = String(Math.round(fallback.width * 100));
        this.openingHeightInput.value = String(Math.round(fallback.height * 100));
        this.openingSillInput.value = String(Math.round(fallback.sill * 100));
      }
      this.commitAppearance();
    });
    for (const input of [this.openingWidthInput, this.openingHeightInput, this.openingSillInput]) {
      input.addEventListener('change', () => this.commitAppearance());
    }
    this.collisionInput.addEventListener('change', () => this.commitAppearance());
    this.eventInput.addEventListener('change', () => {
      if (this.eventInput.value === 'message' && !this.eventMessageInput.value.trim()) {
        this.eventMessageInput.value = `Welcome to ${this.record()?.label ?? 'the museum'}`;
      }
      this.commitAppearance();
    });
    this.eventMessageInput.addEventListener('change', () => this.commitAppearance());
    this.eventColorInput.addEventListener('change', () => this.commitAppearance());
    this.imageInput.addEventListener('change', () => void this.importArtwork());
    this.el<HTMLButtonElement>('place-wall').addEventListener('click', () => this.beginWallPlacement());
    this.el<HTMLButtonElement>('draw-wall').addEventListener('click', () => this.toggleWallDrawing());
    this.el<HTMLButtonElement>('draw-room').addEventListener('click', () => this.toggleRoomDrawing());
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
    this.cancelWallDrawing();
    this.cancelRoomDrawing();
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
    this.cancelWallDrawing();
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

  private refreshSceneIndex(): void {
    const index = buildMuseumSceneIndex(this.placements.captureManifest(), {
      exterior: this.app.exteriorWorld.collision, interior: this.app.museum?.collision,
    }, { placements: this.placements });
    const select = this.el<HTMLSelectElement>('scene-index-exhibit');
    const selected = select.value;
    select.replaceChildren();
    for (const exhibit of index.exhibits) {
      const option = document.createElement('option');
      option.value = exhibit.id; option.textContent = `${exhibit.id} · ${exhibit.wing}`;
      select.append(option);
    }
    if (index.exhibits.some((item) => item.id === selected)) select.value = selected;
    this.el('scene-index-summary').textContent = `${index.wings.length} wings · ${index.exhibits.length} exhibits · ${index.stairs.length} stairs · ${index.installations.length} source installations · ${index.authored.length} authored objects (${index.authored.filter((item) => item.resident).length} live) · ${index.sceneObjects?.filter((item) => item.moved).length ?? 0} moved original objects · ${index.collisions.exterior?.length ?? 'unknown'} exterior and ${index.collisions.interior?.length ?? 'unknown'} interior colliders. Snapshot derived from layout and live collision worlds.`;
    this.el('scene-index-unavailable').textContent = `Not indexed: ${index.unavailable.join(', ')}.`;
    this.describeSceneExhibit();
  }

  private describeSceneExhibit(): void {
    const index = buildMuseumSceneIndex(this.placements.captureManifest(), {}, { placements: this.placements });
    const exhibit = index.exhibits.find((item) => item.id === this.el<HTMLSelectElement>('scene-index-exhibit').value);
    if (!exhibit) return;
    const point = (values: readonly number[]) => values.map((value) => value.toFixed(1)).join(', ');
    this.el('scene-index-detail').textContent = `${exhibit.id} · ${exhibit.wing} · anchor (${point(exhibit.anchor)}) · doorway (${point(exhibit.doorway)}) · visitor position (${point(exhibit.visitorSpot)}) · bounds half-extents (${point(exhibit.bounds.h)}) metres.`
      + ` Within 3 m of the visitor position: ${querySceneIndex(index).near(exhibit.visitorSpot, 3)
        .filter((hit) => hit.kind !== 'route').map((hit) => `${hit.kind} ${hit.id}`).join(', ') || 'nothing indexed'}.`;
  }

  private scanClearance(): void {
    this.placements.invalidateCollisions();
    this.placements.syncWorld(this.app.activeWorld, this.app.exteriorWorld.collision, this.app.museum?.collision,
      this.app.exteriorWorld.root, this.app.museum?.root);
    const report = scanAuthoredRouteClearance(buildMuseumSceneIndex(this.placements.captureManifest(), {
      exterior: this.app.exteriorWorld.collision, interior: this.app.museum?.collision,
    }, { placements: this.placements }));
    this.el('clearance-status').textContent = `${report.status}: ${report.findings.length} potential authored or unknown obstruction(s). ${report.limitations.join(' ')}`;
    const results = this.el('clearance-results');
    results.replaceChildren();
    for (const finding of report.findings) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${finding.objectId ?? finding.colliderId} · ${finding.authority} authority · ${finding.world} · ${finding.routeFrom} → ${finding.routeTo}`;
      button.disabled = !finding.objectId;
      button.title = finding.explanation;
      button.addEventListener('click', () => {
        if (this.app.activeWorld !== finding.world) {
          this.note(`Switch to ${finding.world} to inspect ${finding.objectId}.`, 'warn');
          return;
        }
        this.select(finding.objectId);
        const object = finding.objectId ? this.placements.getObject(finding.objectId) : null;
        if (object) this.camera.focus(object);
      });
      results.append(button);
    }
  }

  private curateSuggestions: readonly CurateSuggestion[] = [];
  /** Bumped on every source selection and import; a status reply for an older request is ignored. */
  private sourceStatusRequest = 0;

  /** Suggestions only: preview shows a ghost, approval applies as one undoable step, rejection is remembered. */
  private runCurate(): void {
    this.setWalkwayGhost(null);
    this.placements.syncWorld(this.app.activeWorld, this.app.exteriorWorld.collision, this.app.museum?.collision,
      this.app.exteriorWorld.root, this.app.museum?.root);
    const manifest = this.placements.captureManifest();
    const scopeValue = this.el<HTMLSelectElement>('curate-scope').value;
    const report = autoCurate(buildMuseumSceneIndex(manifest, { exterior: this.app.exteriorWorld.collision, interior: this.app.museum?.collision },
      { placements: this.placements }), manifest, {
      mode: this.el<HTMLSelectElement>('curate-mode').value as CurateMode,
      density: this.el<HTMLSelectElement>('curate-density').value as CurateDensity,
      scope: scopeValue === 'museum' ? { kind: 'museum' } : { kind: 'zone', zone: scopeValue as (typeof ZONES)[number]['id'] },
    });
    this.curateSuggestions = report.suggestions;
    this.el<HTMLButtonElement>('curate-approve-all').disabled = !report.suggestions.length;
    this.el('curate-status').textContent = `${report.suggestions.length} suggestion(s), ${report.skipped.length} skipped. Nothing changes until you approve. ${report.limitations.join(' ')}`;
    const results = this.el('curate-results');
    results.replaceChildren();
    for (const suggestion of report.suggestions) {
      const row = document.createElement('div');
      row.dataset.curateSuggestion = suggestion.id;
      row.dataset.curateKind = suggestion.kind;
      const text = document.createElement('p');
      text.textContent = `${suggestion.kind === 'add' ? 'Add' : 'Move'} ${suggestion.label} · ${suggestion.zone}: ${suggestion.reason}`;
      row.append(text);
      for (const [action, label] of [['preview', 'Preview'], ['approve', 'Approve'], ['reject', 'Reject']] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.curateAction = action;
        button.textContent = label;
        button.addEventListener('click', () => {
          if (action === 'preview') {
            this.setWalkwayGhost(new THREE.Box3(new THREE.Vector3(...suggestion.bounds.min), new THREE.Vector3(...suggestion.bounds.max)));
            if (suggestion.kind === 'move') this.focusPlacement(suggestion.id);
          } else this.curateAction([suggestion], action);
        });
        row.append(button);
      }
      results.append(row);
    }
    for (const item of report.skipped.slice(0, 20)) {
      const note = document.createElement('p');
      note.className = 'workshop-muted';
      note.dataset.curateSkipped = item.id;
      note.textContent = `${item.id}: ${item.reason}`;
      results.append(note);
    }
  }

  private curateAction(suggestions: readonly CurateSuggestion[], action: 'approve' | 'reject'): void {
    if (!suggestions.length) return;
    const before = this.placements.captureManifest();
    try {
      const next = action === 'approve'
        ? applyCurateSuggestions(before, suggestions, new Set(suggestions.map((suggestion) => suggestion.id)))
        : suggestions.reduce((manifest, suggestion) => rejectCurateSuggestion(manifest, suggestion), before);
      const after = this.placements.replaceManifest(next);
      this.history.push(`${action === 'approve' ? 'Approve' : 'Reject'} ${suggestions.length} curation suggestion(s)`, before, after);
      this.placements.invalidateCollisions();
      this.note(action === 'approve' ? `${suggestions.length} suggestion(s) applied as one undoable step.` : 'Suggestion rejected and remembered.', 'ok');
    } catch (error) {
      this.placements.replaceManifest(before);
      this.note(error instanceof Error ? error.message : 'Suggestion rejected by Museum conservation.', 'error');
    }
    this.refresh();
    this.runCurate();
  }

  /** Pilot read of an exhibit's composition; NO CHANGE is a valid outcome and nothing moves without approval. */
  private runGravity(): void {
    this.setWalkwayGhost(null);
    this.placements.syncWorld(this.app.activeWorld, this.app.exteriorWorld.collision, this.app.museum?.collision,
      this.app.exteriorWorld.root, this.app.museum?.root);
    const manifest = this.placements.captureManifest();
    const exhibit = this.el<HTMLSelectElement>('gravity-exhibit').value as NarrativeGravityPilot;
    const report = narrativeGravity(buildMuseumSceneIndex(manifest, { exterior: this.app.exteriorWorld.collision, interior: this.app.museum?.collision },
      { placements: this.placements }), manifest, exhibit);
    const status = this.el('gravity-status');
    status.dataset.gravityVerdict = report.verdict;
    status.textContent = `${exhibit}: ${report.verdict}. ${report.verdict === 'NO CHANGE'
      ? 'The sightline from the visitor position is clear and nothing competes with the hero; nothing is proposed.'
      : `${report.suggestions.length} suggestion(s), ${report.competing.length} to review, ${report.unresolved.length} unresolved. Nothing changes until you approve.`}`;
    const results = this.el('gravity-results');
    results.replaceChildren();
    for (const suggestion of report.suggestions) {
      const row = document.createElement('div');
      row.dataset.gravitySuggestion = suggestion.objectId;
      const text = document.createElement('p');
      text.textContent = `Move ${suggestion.label}: ${suggestion.reason}`;
      row.append(text);
      for (const [action, label] of [['preview', 'Preview'], ['approve', 'Approve'], ['reject', 'Reject']] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.gravityAction = action;
        button.textContent = label;
        button.addEventListener('click', () => {
          if (action === 'preview') {
            this.setWalkwayGhost(new THREE.Box3(new THREE.Vector3(...suggestion.bounds.min), new THREE.Vector3(...suggestion.bounds.max)));
            this.focusPlacement(suggestion.objectId);
          } else this.gravityAction(suggestion, action);
        });
        row.append(button);
      }
      results.append(row);
    }
    const notes: [string, string, string][] = [
      ...report.competing.map((item) => ['competing', item.objectId, `${item.label}: ${item.reason}`] as [string, string, string]),
      ...report.unresolved.map((item) => ['unresolved', item.objectId, `${item.objectId}: ${item.reason}`] as [string, string, string]),
    ];
    for (const [kind, id, message] of notes) {
      const note = document.createElement('p');
      note.className = 'workshop-muted';
      note.dataset.gravityNote = kind;
      note.dataset.gravitySubject = id;
      note.textContent = message;
      results.append(note);
    }
    const preserved = document.createElement('p');
    preserved.className = 'workshop-muted';
    preserved.dataset.gravityPreserved = '';
    preserved.textContent = `Never moved: ${report.preserved.join('; ')}. ${report.limitations.join(' ')}`;
    results.append(preserved);
  }

  private gravityAction(suggestion: GravitySuggestion, action: 'approve' | 'reject'): void {
    const before = this.placements.captureManifest();
    try {
      const next = action === 'approve'
        ? applyGravitySuggestions(before, [suggestion], new Set([suggestion.objectId]))
        : rejectGravitySuggestion(before, suggestion);
      const after = this.placements.replaceManifest(next);
      this.history.push(`${action === 'approve' ? 'Approve' : 'Reject'} narrative gravity move`, before, after);
      this.placements.invalidateCollisions();
      this.note(action === 'approve' ? `${suggestion.label} moved out of the sightline as one undoable step.` : 'Suggestion rejected and remembered.', 'ok');
    } catch (error) {
      this.placements.replaceManifest(before);
      this.note(error instanceof Error ? error.message : 'Suggestion rejected by Museum conservation.', 'error');
    }
    this.refresh();
    this.runGravity();
  }

  /** Read-only health report; affected placements link to the object, nothing is changed. */
  private checkHealth(): void {
    this.placements.invalidateCollisions();
    this.placements.syncWorld(this.app.activeWorld, this.app.exteriorWorld.collision, this.app.museum?.collision,
      this.app.exteriorWorld.root, this.app.museum?.root);
    const manifest = this.placements.captureManifest();
    const index = buildMuseumSceneIndex(manifest, { exterior: this.app.exteriorWorld.collision, interior: this.app.museum?.collision },
      { placements: this.placements });
    // Only a jury run against this exact manifest may stand in for the jury check.
    const jury = this.lastJury?.manifest === JSON.stringify(manifest) ? this.lastJury.report : undefined;
    const report = museumHealth(index, manifest, { sceneEntries: this.placements.sceneEntries(), runtime: true, jury });
    const counts = (Object.entries(report.counts) as [string, number][]).filter(([, n]) => n).map(([status, n]) => `${n} ${status}`).join(' · ');
    this.el('health-status').textContent = `${report.status}: ${counts}.`;
    const results = this.el('health-results');
    results.replaceChildren();
    for (const check of report.checks) {
      const row = document.createElement('div');
      row.dataset.healthCheck = check.id;
      row.dataset.healthStatus = check.status;
      const text = document.createElement('p');
      text.textContent = `${check.status} · ${check.title}: ${check.detail}`;
      row.append(text);
      for (const subject of check.affected.slice(0, 20)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.healthSubject = subject.id;
        const where = subject.position ? ` at (${subject.position.map((v) => v.toFixed(1)).join(', ')})` : '';
        button.textContent = `${subject.label}${subject.world ? ` · ${subject.world}` : ''}${where}`;
        button.disabled = subject.kind !== 'placement';
        button.addEventListener('click', () => {
          if (subject.world && subject.world !== 'shared' && subject.world !== this.app.activeWorld) {
            this.note(`Switch to ${subject.world} to inspect ${subject.label}.`, 'warn');
            return;
          }
          this.focusPlacement(subject.id);
        });
        row.append(button);
      }
      if (check.affected.length > 20) {
        const more = document.createElement('p');
        more.textContent = `…and ${check.affected.length - 20} more.`;
        row.append(more);
      }
      results.append(row);
    }
  }

  private lastJury: { report: VisitorJuryReport; manifest: string } | null = null;

  /** Walk simulated visitors through the live interior collision world; read-only, nothing moves or saves. */
  private runJury(): void {
    this.placements.invalidateCollisions();
    this.placements.syncWorld(this.app.activeWorld, this.app.exteriorWorld.collision, this.app.museum?.collision,
      this.app.exteriorWorld.root, this.app.museum?.root);
    const manifest = this.placements.captureManifest();
    const interior = this.app.museum?.collision ?? null;
    const started = performance.now();
    const report = visitorJury(buildMuseumSceneIndex(manifest, { exterior: this.app.exteriorWorld.collision, interior: interior ?? undefined },
      { placements: this.placements }), manifest, interior);
    this.lastJury = { report, manifest: JSON.stringify(manifest) };
    this.el('jury-status').textContent = `${report.status}: ${report.summary} (${Math.round(performance.now() - started)} ms)`;
    const results = this.el('jury-results');
    results.replaceChildren();
    const row = (status: string, text: string, checks: readonly JuryCheck[]) => {
      const item = document.createElement('div');
      item.dataset.juryStatus = status;
      const line = document.createElement('p');
      line.textContent = text;
      item.append(line);
      for (const check of checks.filter((entry) => entry.status !== 'PASS')) {
        const detail = document.createElement('p');
        detail.textContent = `${check.status}: ${check.detail}`;
        item.append(detail);
        for (const subject of check.affected.filter((entry) => entry.kind === 'placement').slice(0, 5)) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.jurySubject = subject.id;
          button.textContent = `${subject.label}${subject.position ? ` at (${subject.position.map((v) => v.toFixed(1)).join(', ')})` : ''}`;
          button.addEventListener('click', () => this.focusPlacement(subject.id));
          item.append(button);
        }
      }
      results.append(item);
      return item;
    };
    for (const route of [...report.routes, ...report.stairs, report.sanctuary]) {
      row(route.status, `${route.status} · ${route.label} (${route.legs} legs)`, [route]).dataset.juryRoute = route.id;
    }
    for (const exhibit of report.exhibits) {
      row(exhibit.status, `${exhibit.exhibitId} · ${exhibit.status} · reached ${exhibit.reached.status} · hero ${exhibit.visible.status} · return ${exhibit.returns.status}`,
        [exhibit.reached, exhibit.visible, exhibit.returns]).dataset.juryExhibit = exhibit.exhibitId;
    }
  }

  /** Audit protected walkways; suggestions are previewed and applied only on approval, as one undoable step each. */
  private scanWalkways(): void {
    this.setWalkwayGhost(null);
    const manifest = this.placements.captureManifest();
    const report = clearWalkways(buildMuseumSceneIndex(manifest, {}, { placements: this.placements }), manifest);
    const proposals = report.proposals;
    this.el('walkways-status').textContent = `${report.status}: ${report.findings.length} obstruction(s) across ${report.walkways} protected walkways · ${proposals.length} suggested move(s) · ${report.unresolved.length} unresolved. ${report.limitations.join(' ')}`;
    const results = this.el('walkways-results');
    results.replaceChildren();
    for (const finding of report.findings) {
      const row = document.createElement('div');
      row.dataset.walkwayFinding = finding.objectId;
      const label = document.createElement('button');
      label.type = 'button';
      label.textContent = `${finding.severity} · ${finding.label} · ${finding.walkways.map((walkway) => `${walkway.label} (${walkway.intrusion.toFixed(2)} m)`).join(', ')}`;
      label.addEventListener('click', () => this.focusPlacement(finding.objectId));
      row.append(label);
      const proposal = proposals.find((item) => item.objectId === finding.objectId);
      const reason = report.unresolved.find((item) => item.objectId === finding.objectId)?.reason ?? null;
      const lock = document.createElement('button');
      lock.type = 'button';
      lock.dataset.walkwayAction = 'lock';
      lock.textContent = finding.locked ? 'Unlock' : 'Lock';
      lock.addEventListener('click', () => this.toggleLock(finding.objectId));
      row.append(lock);
      if (proposal) {
        for (const [action, text] of [['preview', `Preview move ${proposal.distance.toFixed(2)} m`], ['approve', 'Approve'], ['reject', 'Reject']] as const) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.walkwayAction = action;
          button.textContent = text;
          button.addEventListener('click', () => this.walkwayAction(action, proposal));
          row.append(button);
        }
      } else if (reason) {
        const note = document.createElement('p');
        note.className = 'workshop-muted';
        note.textContent = reason;
        row.append(note);
      }
      results.append(row);
    }
  }

  private walkwayAction(action: 'preview' | 'approve' | 'reject', proposal: WalkwayProposal): void {
    if (action === 'preview') {
      const bounds = this.placements.placementBounds(proposal.objectId);
      if (!bounds) { this.note('Bounds are not available for this object yet.', 'warn'); return; }
      const offset = new THREE.Vector3(proposal.to[0] - proposal.from[0], 0, proposal.to[2] - proposal.from[2]);
      this.setWalkwayGhost(bounds.translate(offset));
      this.focusPlacement(proposal.objectId);
      return;
    }
    const before = this.placements.captureManifest();
    if (action === 'reject') {
      const after = this.placements.replaceManifest(recordDecision(before, { kind: 'walkway-move', objectId: proposal.objectId,
        outcome: 'rejected', position: [...proposal.from] as WorkshopVec3 }));
      this.history.push(`Reject walkway suggestion for ${proposal.objectId}`, before, after);
      this.note(`Suggestion for ${proposal.objectId} rejected and remembered; the object was not moved.`, 'ok');
      this.refresh();
      this.scanWalkways();
      return;
    }
    const moved = applyWalkwayProposals(before, [proposal], new Set([proposal.objectId]));
    const after = this.placements.replaceManifest(recordDecision(moved, { kind: 'walkway-move', objectId: proposal.objectId,
      outcome: 'approved', position: [...proposal.to] as WorkshopVec3 }));
    this.history.push(`Clear walkway: move ${proposal.objectId}`, before, after);
    this.placements.invalidateCollisions();
    this.note(`Moved ${proposal.objectId} ${proposal.distance.toFixed(2)} m to clear the walkway. Undo restores it.`, 'ok');
    this.refresh();
    this.scanWalkways();
  }

  /** With "Move as kit" on, an edit of one part moves the whole kit; otherwise the part becomes an override. */
  private followKit(before: WorkshopPlacementManifest, id: string, after: WorkshopPlacementManifest): WorkshopPlacementManifest {
    const kit = kitOf(before, id);
    const moved = after.objects.find((item) => item.id === id);
    if (!kit || !moved || !this.el<HTMLInputElement>('kit-move-together').checked) return after;
    return this.placements.replaceManifest(kitFollowMember({ ...before, curator: after.curator ?? before.curator }, kit.id, id, moved));
  }

  private placeKitInView(): void {
    if (this.placements.isComparingOriginal) return;
    const template = this.el<HTMLSelectElement>('kit-template').value as WorkshopKitTemplateId;
    const direction = new THREE.Vector3();
    this.app.camera.getWorldDirection(direction);
    const x = this.app.camera.position.x + direction.x * 5;
    const z = this.app.camera.position.z + direction.z * 5;
    const collision = this.app.museum?.collision ?? this.app.player.collisionWorld;
    const y = collision.supportHeight(x, z, this.app.player.position.y, 1.5) ?? this.app.player.position.y;
    const before = this.placements.captureManifest();
    try {
      const { manifest, kit } = placeKit(before, template, { position: [x, y, z], rotationY: Math.atan2(-direction.x, -direction.z),
        worldId: this.app.activeWorld });
      const after = this.placements.replaceManifest(manifest);
      this.history.push(`Place ${kit.label}`, before, after);
      this.select(kit.members[0]?.id ?? null);
      this.note(`${kit.label} placed as ${kit.members.length} parts.`, 'ok');
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'Kit would intersect protected museum geometry.', 'error');
    }
    this.refresh();
  }

  private kitAction(action: 'duplicate' | 'reset' | 'ungroup' | 'delete'): void {
    const record = this.record();
    const before = this.placements.captureManifest();
    const kit = record ? kitOf(before, record.id) : null;
    if (!record || !kit) return;
    try {
      let after: WorkshopPlacementManifest;
      if (action === 'duplicate') {
        const copy = duplicateKit(before, kit.id, { position: [kit.position[0] + 3, kit.position[1], kit.position[2] + 3], rotationY: kit.rotationY });
        after = this.placements.replaceManifest(copy.manifest);
        this.select(copy.kit.members.find((member) => member.slot === kit.members.find((m) => m.id === record.id)?.slot)?.id ?? null);
      } else if (action === 'reset') {
        const slot = kit.members.find((member) => member.id === record.id)!.slot;
        after = this.placements.replaceManifest(resetKitSlot(before, kit.id, slot));
      } else {
        after = this.placements.replaceManifest(removeKit(before, kit.id, { keepMembers: action === 'ungroup' }));
        if (action === 'delete') this.select(null);
      }
      const verb = { duplicate: 'Duplicate', reset: 'Reset part of', ungroup: 'Ungroup', delete: 'Delete' }[action];
      this.history.push(`${verb} ${kit.label}`, before, after);
      this.note(`${verb} ${kit.label}.`, action === 'delete' ? 'warn' : 'ok');
    } catch (error) {
      this.placements.replaceManifest(before);
      this.note(error instanceof Error ? error.message : 'Kit change rejected by Museum conservation.', 'error');
    }
    this.refresh();
  }

  private refreshKit(): void {
    const manifest = this.placements.captureManifest();
    const record = this.record();
    const kit = record ? kitOf(manifest, record.id) : null;
    for (const key of ['kit-duplicate', 'kit-reset', 'kit-ungroup', 'kit-delete'] as const) this.el<HTMLButtonElement>(key).disabled = !kit;
    if (!kit || !record) {
      this.el('kit-status').textContent = `${manifest.kits?.length ?? 0} kit(s) placed. Select a part of a kit to edit it.`;
      return;
    }
    const slot = kit.members.find((member) => member.id === record.id)!.slot;
    const { overridden, removed } = kitOverrides(manifest, kit.id);
    this.el('kit-status').textContent = `${record.label} is the "${slot}" part of ${kit.label} (${kit.members.length} parts).`
      + ` ${overridden.length ? `Changed from the kit: ${overridden.join(', ')}.` : 'No parts changed from the kit.'}`
      + `${removed.length ? ` Removed: ${removed.join(', ')}.` : ''}`;
  }

  /** A hand move after an automated suggestion becomes the curator's standing decision for that object. */
  private rememberManualMove(id: string, after: WorkshopPlacementManifest): WorkshopPlacementManifest {
    const decision = latestDecision(after, 'walkway-move', id);
    const position = after.objects.find((item) => item.id === id)?.position;
    if (!decision || !position || decision.position.every((value, index) => Math.abs(value - position[index]) < 1e-4)) return after;
    return this.placements.replaceManifest(recordDecision(after, { kind: 'walkway-move', objectId: id, outcome: 'user-override', position }));
  }

  private toggleLock(id: string): void {
    const before = this.placements.captureManifest();
    const locked = !isLocked(before, id);
    const after = this.placements.replaceManifest(setLocked(before, id, locked));
    this.history.push(`${locked ? 'Lock' : 'Unlock'} ${id}`, before, after);
    this.note(locked ? `${id} is locked: automated tools will never move it.` : `${id} is unlocked.`, 'ok');
    this.refresh();
    this.refreshCuratorMemory();
    if (this.el('walkways-results').childElementCount) this.scanWalkways();
  }

  /** Keep the floor area under the selection, plus 0.5 m, free of automated placement. */
  private keepAreaEmpty(): void {
    const record = this.record();
    const bounds = record ? this.placements.placementBounds(record.id) : null;
    if (!record || !bounds) { this.note('Select a placed object to mark the area around it as deliberately empty.', 'warn'); return; }
    const before = this.placements.captureManifest();
    let n = 1;
    while (before.curator?.emptyRegions.some((region) => region.id === `empty-${n}`)) n++;
    const round = (v: number) => Math.round(v * 100) / 100;
    const after = this.placements.replaceManifest(addEmptyRegion(before, { id: `empty-${n}`, label: `Kept empty near ${record.label}`.slice(0, 80),
      worldId: record.worldId ?? 'shared', min: [round(bounds.min.x - 0.5), round(bounds.min.z - 0.5)], max: [round(bounds.max.x + 0.5), round(bounds.max.z + 0.5)] }));
    this.history.push(`Keep area empty near ${record.label}`, before, after);
    this.note(`Area around ${record.label} will be kept empty by automated tools.`, 'ok');
    this.refreshCuratorMemory();
  }

  private refreshCuratorMemory(): void {
    const manifest = this.placements.captureManifest();
    const memory = manifest.curator;
    const record = this.record();
    const lockButton = this.el<HTMLButtonElement>('curator-lock');
    lockButton.disabled = !record;
    lockButton.textContent = record && isLocked(manifest, record.id) ? 'Unlock for automation' : 'Lock against automation';
    this.el('curator-summary').textContent = `${memory?.locks.length ?? 0} locked · ${memory?.decisions.length ?? 0} remembered decision(s) · ${memory?.emptyRegions.length ?? 0} empty region(s). Saved with the placements.`;
    const list = this.el('curator-regions');
    list.replaceChildren();
    for (const region of memory?.emptyRegions ?? []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.curatorRegion = region.id;
      button.textContent = `Forget empty region: ${region.label}`;
      button.addEventListener('click', () => {
        const before = this.placements.captureManifest();
        const after = this.placements.replaceManifest(removeEmptyRegion(before, region.id));
        this.history.push(`Forget empty region ${region.label}`, before, after);
        this.refreshCuratorMemory();
      });
      list.append(button);
    }
  }

  private focusPlacement(id: string): void {
    this.select(id);
    const object = this.placements.getObject(id);
    if (object) this.camera.focus(object);
  }

  private setWalkwayGhost(bounds: THREE.Box3 | null): void {
    if (this.walkwayGhost) {
      this.walkwayGhost.removeFromParent();
      this.walkwayGhost.geometry.dispose();
      (this.walkwayGhost.material as THREE.Material).dispose();
      this.walkwayGhost = null;
    }
    if (!bounds) return;
    this.walkwayGhost = new THREE.Box3Helper(bounds, 0x3ddc84);
    this.walkwayGhost.name = 'workshop-walkway-ghost';
    this.app.scene.add(this.walkwayGhost);
  }

  private async loadSourceCatalog(): Promise<void> {
    const button = this.el<HTMLButtonElement>('source-load');
    button.disabled = true;
    try {
      const [catalog, report] = await Promise.all([import('./catalog-data/tge-index.json'),
        import('./catalog-data/tge-verification.json')]);
      this.sourceCatalog = catalog.default.models;
      // Only IDs whose bytes the committed verification report lists as verified are importable.
      this.sourceAvailability = sourceAvailability(report.default.sourceRevision === catalog.default.sourceRevision ? report.default : null);
      const packs = new Map(this.sourceCatalog.map((item) => [item.pack, item.packName]));
      const packSelect = this.el<HTMLSelectElement>('source-pack');
      for (const [id, label] of [...packs].sort((a, b) => a[1].localeCompare(b[1]))) {
        const option = document.createElement('option'); option.value = id; option.textContent = label; packSelect.append(option);
      }
      const wings = [...new Set(this.sourceCatalog.flatMap((item) => item.featured ? [item.featured.wing] : []))].sort();
      const wingSelect = this.el<HTMLSelectElement>('source-wing');
      for (const wing of wings) {
        const option = document.createElement('option'); option.value = wing; option.textContent = wing; wingSelect.append(option);
      }
      this.el('source-controls').hidden = false;
      button.hidden = true;
      this.refreshSourceCatalog();
    } catch {
      button.disabled = false;
      this.el('source-count').textContent = 'Source catalog could not be loaded.';
    }
  }

  private refreshSourceCatalog(): void {
    if (!this.sourceCatalog) return;
    const matches = filterSourceCatalog(this.sourceCatalog, {
      query: this.el<HTMLInputElement>('source-search').value,
      featuredOnly: this.el<HTMLSelectElement>('source-featured').value === 'featured',
      pack: this.el<HTMLSelectElement>('source-pack').value,
      wing: this.el<HTMLSelectElement>('source-wing').value,
      availability: this.el<HTMLSelectElement>('source-availability').value as SourceAvailability | '',
    }, this.sourceAvailability);
    const pages = Math.max(1, Math.ceil(matches.length / 24));
    this.sourcePage = Math.max(0, Math.min(this.sourcePage, pages - 1));
    this.el('source-count').textContent = `${matches.length} source candidates · page ${this.sourcePage + 1} of ${pages}`;
    this.el<HTMLButtonElement>('source-prev').disabled = this.sourcePage === 0;
    this.el<HTMLButtonElement>('source-next').disabled = this.sourcePage >= pages - 1;
    const results = this.el('source-results');
    results.replaceChildren();
    for (const item of matches.slice(this.sourcePage * 24, this.sourcePage * 24 + 24)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'workshop-asset';
      button.disabled = true;
      button.dataset.sourceId = item.id;
      const availability = this.sourceAvailability(item.id);
      button.dataset.sourceAvailability = availability.state;
      const img = document.createElement('img');
      img.alt = '';
      img.width = 96; img.height = 96;
      img.loading = 'lazy';
      img.addEventListener('load', () => { button.disabled = false; });
      img.addEventListener('error', () => { detail.textContent = 'Thumbnail unavailable'; });
      img.src = `/__museum-workshop/tge-thumbnail?id=${encodeURIComponent(item.id)}`;
      const title = document.createElement('strong'); title.textContent = item.name;
      const detail = document.createElement('small');
      detail.textContent = `${item.packName} · ${item.license}${availability.state === 'importable' ? '' : availability.state === 'unsupported' ? ' · Not importable' : ' · Unverified'}`;
      if (availability.state !== 'importable') button.title = availability.reason;
      button.append(img, title, detail);
      button.addEventListener('click', () => {
        this.sourceSelection = item;
        const importable = availability.state === 'importable';
        this.el<HTMLButtonElement>('source-import').disabled = !importable;
        this.el<HTMLButtonElement>('source-import').textContent = 'Import and place selected model';
        const details = `${item.name} · ${item.id} · ${item.bytes} bytes · ${item.license} · ${item.author} · source revision ${this.sourceCatalogRevision()} · ${item.featured?.role ?? 'Unassigned candidate'}`;
        if (!importable) {
          ++this.sourceStatusRequest;
          this.el('source-inspector').textContent = `${details} · ${availability.state === 'unsupported' ? 'Not importable' : 'Not importable until verified'}: ${availability.reason}.`;
          return;
        }
        this.el('source-inspector').textContent = `${details} · Checking local installation…`;
        const request = ++this.sourceStatusRequest;
        const current = () => this.sourceSelection === item && this.sourceStatusRequest === request;
        void fetch(`/__museum-workshop/tge-status?id=${encodeURIComponent(item.id)}`)
          .then(async (response) => {
            if (!response.ok) throw new Error('Local status unavailable');
            return await response.json() as { installed?: boolean };
          })
          .then((status) => {
            if (!current()) return;
            this.el('source-inspector').textContent = `${details} · ${status.installed ? 'Installed locally' : 'Not installed'}; visual review required.`;
            this.el<HTMLButtonElement>('source-import').textContent = status.installed ? 'Place cached model' : 'Import and place selected model';
          })
          .catch(() => {
            if (current()) this.el('source-inspector').textContent = `${details} · Local installation status unavailable.`;
          });
      });
      results.append(button);
    }
  }

  private sourceCatalogRevision(): string { return '3ddcc695adbba9fb918cf31b7c139b3f95b76910'; }

  private async importSourceCandidate(): Promise<void> {
    const selected = this.sourceSelection;
    if (!selected || this.placements.isComparingOriginal || this.sourceAvailability(selected.id).state !== 'importable') return;
    const button = this.el<HTMLButtonElement>('source-import');
    button.disabled = true;
    // A status check still in flight must not overwrite this import's result.
    this.sourceStatusRequest++;
    try {
      this.note(`Importing ${selected.name} from the pinned source…`, 'ok');
      const response = await fetch('/__museum-workshop/tge-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id }),
      });
      const result = await response.json() as { ok?: boolean; assetId?: string; error?: string };
      if (!response.ok || !result.ok || !result.assetId) throw new Error(result.error || 'Source import failed');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${result.assetId}`);
      const inspection = new ResourceScope('source-model-inspection');
      inspection.trackObject(gltf.scene);
      let dimensions: THREE.Vector3;
      let center: THREE.Vector3;
      try {
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) {
          throw new Error('Imported model has empty or invalid bounds');
        }
        dimensions = bounds.getSize(new THREE.Vector3());
        center = bounds.getCenter(new THREE.Vector3());
      } finally { inspection.dispose(); }
      this.addModel(result.assetId, selected.name);
      this.el('source-inspector').textContent = `${selected.name} · locally imported from ${selected.id} · ${selected.license} · bounds ${dimensions.toArray().map((n) => n.toFixed(2)).join(' × ')} m · bounding center from origin ${center.toArray().map((n) => n.toFixed(2)).join(', ')} m · visual review required.`;
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'Source import failed.', 'error');
    } finally { button.disabled = !this.sourceSelection || this.sourceAvailability(this.sourceSelection.id).state !== 'importable'; }
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

  private toggleWallDrawing(): void {
    if (this.wallDrawing) {
      this.cancelWallDrawing();
      this.note('Wall drawing cancelled.', 'warn');
      return;
    }
    if (this.placements.isComparingOriginal) return;
    this.wallPlacementActive = false;
    if (this.roomDrawing) this.cancelRoomDrawing();
    this.wallDrawing = true;
    this.wallDrawStart = null;
    // The visitor feet height defines the drawing plane; elevation can be
    // fine-tuned later in the ordinary inspector.
    this.wallDrawHeight = this.app.player.position.y;
    this.select(null);
    this.camera.focusGround(this.app.player.position);
    this.note('Wall tool: click a floor starting point, then click the endpoint. Escape cancels.', 'ok');
    this.refresh();
  }

  private cancelWallDrawing(): void {
    this.wallDrawing = false;
    this.wallDrawStart = null;
    this.wallPreview.visible = false;
    this.refresh();
  }

  private pointerOnDrawingPlane(): WallPoint | null {
    this.raycaster.setFromCamera(this.pointer, this.app.camera);
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.wallDrawHeight);
    const intersection = this.raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    if (!intersection || !Number.isFinite(intersection.x) || !Number.isFinite(intersection.z)) return null;
    if (Math.abs(intersection.x) > 500 || Math.abs(intersection.z) > 500) return null;
    return snapWallPoint(
      [intersection.x, this.wallDrawHeight, intersection.z],
      Number(this.snapInput.value),
    );
  }

  private updateWallGuide(end: WallPoint): void {
    const start = this.wallDrawStart;
    if (!start) return;
    const position = this.wallPreview.geometry.getAttribute('position') as THREE.BufferAttribute;
    position.setXYZ(0, start[0], start[1] + 0.08, start[2]);
    position.setXYZ(1, end[0], end[1] + 0.08, end[2]);
    position.needsUpdate = true;
    this.wallPreview.geometry.computeBoundingSphere();
    this.wallPreview.visible = true;
  }

  private drawWallClick(): void {
    const point = this.pointerOnDrawingPlane();
    if (!point) return this.note('Aim at the ground plane in top view.', 'warn');
    if (!this.wallDrawStart) {
      this.wallDrawStart = point;
      this.updateWallGuide(point);
      return this.note('Wall start fixed. Click its endpoint to construct.', 'ok');
    }
    const shape = measureWall(this.wallDrawStart, point);
    if (!shape) return this.note('Wall must be between 0.25 and 100 metres, level, and nonzero.', 'warn');
    const before = this.placements.captureManifest();
    if (before.objects.length >= 256) return this.note('Builder object limit reached.', 'error');
    const record: WorkshopPlacementRecord = {
      id: this.uniqueId('partition-wall'),
      label: 'Partition wall',
      prefab: 'partition-wall',
      anchor: 'floor',
      position: shape.position, rotation: shape.rotation, scale: shape.scale,
      worldId: this.app.activeWorld, collision: 'solid',
    };
    try {
      const after = this.placements.setRecord(record);
      this.history.push('Draw partition wall', before, after);
      this.cancelWallDrawing();
      this.select(record.id);
      this.note('Wall constructed. Select to resize, rotate, paint, texture, duplicate or save.', 'ok');
      this.refresh();
    } catch (error) {
      // The start remains selected so a blocked endpoint can be corrected.
      this.note(error instanceof Error ? error.message : 'Wall intersects a protected route.', 'error');
    }
  }

  private toggleRoomDrawing(): void {
    if (this.roomDrawing) {
      this.cancelRoomDrawing();
      this.note('Room drawing cancelled.', 'warn');
      return;
    }
    if (this.placements.isComparingOriginal) return;
    if (this.wallDrawing) this.cancelWallDrawing();
    this.wallPlacementActive = false;
    this.roomDrawing = true;
    this.roomDrawStart = null;
    // Room floor is anchored at the visitor's current floor level.
    this.wallDrawHeight = this.app.player.position.y;
    this.select(null);
    this.camera.focusGround(this.app.player.position);
    this.note('Room tool: click two opposite floor corners. Escape cancels.', 'ok');
    this.refresh();
  }

  private cancelRoomDrawing(): void {
    this.roomDrawing = false;
    this.roomDrawStart = null;
    this.roomPreview.visible = false;
    this.refresh();
  }

  private updateRoomGuide(end: WallPoint): void {
    const start = this.roomDrawStart;
    if (!start) return;
    const x0 = Math.min(start[0], end[0]), x1 = Math.max(start[0], end[0]);
    const z0 = Math.min(start[2], end[2]), z1 = Math.max(start[2], end[2]);
    const position = this.roomPreview.geometry.getAttribute('position') as THREE.BufferAttribute;
    const y = start[1] + 0.08;
    position.setXYZ(0, x0, y, z0);
    position.setXYZ(1, x1, y, z0);
    position.setXYZ(2, x1, y, z1);
    position.setXYZ(3, x0, y, z1);
    position.needsUpdate = true;
    this.roomPreview.geometry.computeBoundingSphere();
    this.roomPreview.visible = true;
  }

  private drawRoomClick(): void {
    const point = this.pointerOnDrawingPlane();
    if (!point) return this.note('Aim at the room floor plane.', 'warn');
    if (!this.roomDrawStart) {
      this.roomDrawStart = point;
      this.updateRoomGuide(point);
      return this.note('Room first corner fixed. Click the opposite corner.', 'ok');
    }
    const shape = measureRoom(this.roomDrawStart, point);
    if (!shape) return this.note('Room width and depth must each be 1.25–30 metres on one floor.', 'warn');

    const before = this.placements.captureManifest();
    const includeRoof = this.roomRoofInput.checked;
    const count = includeRoof ? 6 : 5;
    if (before.objects.length + count > 256) {
      return this.note('The Builder has reached its authored object limit.', 'error');
    }

    const usedIds = new Set(before.objects.map((record) => record.id));
    const idFor = (prefab: WorkshopPrefabId): string => {
      let i = 1;
      while (usedIds.has(`${prefab}-${String(i).padStart(2, '0')}`)) i++;
      const id = `${prefab}-${String(i).padStart(2, '0')}`;
      usedIds.add(id);
      return id;
    };

    const worldId = this.app.activeWorld;
    const walls: WorkshopPlacementRecord[] = shape.walls.map((wall, i) => ({
      id: idFor('partition-wall'), label: `Room wall ${i + 1}`,
      prefab: 'partition-wall', anchor: 'floor',
      position: wall.position, rotation: wall.rotation, scale: wall.scale,
      collision: 'solid', worldId,
    }));
    const floor: WorkshopPlacementRecord = {
      id: idFor('floor-slab'), label: 'Room floor',
      prefab: 'floor-slab', anchor: 'floor',
      position: shape.floor.position, rotation: [0, 0, 0], scale: shape.floor.scale,
      collision: 'solid', worldId,
    };
    const roof: WorkshopPlacementRecord[] = includeRoof ? [{
      id: idFor('roof-panel'), label: 'Room roof',
      prefab: 'roof-panel', anchor: 'free',
      position: shape.roof.position, rotation: [0, 0, 0], scale: shape.roof.scale,
      collision: 'none', worldId,
    }] : [];
    try {
      // Atomic source and history operation: validation can reject the whole
      // room without leaving orphan walls or a half-constructed floor.
      const after = this.placements.replaceManifest({
        ...before, objects: [...before.objects, ...walls, floor, ...roof],
      });
      this.history.push('Construct room', before, after);
      this.cancelRoomDrawing();
      this.select(floor.id);
      this.note(`Room ${shape.width.toFixed(1)} × ${shape.depth.toFixed(1)} m created. Walls, floor and roof are individually editable. Save to build to persist.`, 'ok');
      this.refresh();
    } catch (error) {
      this.note(error instanceof Error ? error.message : 'Room would intersect protected museum geometry.', 'error');
    }
  }

  private readonly onWallPointerMove = (event: PointerEvent): void => {
    if (!this.openState || (!this.wallDrawing && !this.roomDrawing)) return;
    if (this.wallDrawing && !this.wallDrawStart) return;
    if (this.roomDrawing && !this.roomDrawStart) return;
    const rect = this.app.renderer.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const endpoint = this.pointerOnDrawingPlane();
    if (endpoint && this.wallDrawing) this.updateWallGuide(endpoint);
    if (endpoint && this.roomDrawing) this.updateRoomGuide(endpoint);
  };

  private add(prefab: WorkshopPrefabId): void {
    if (this.placements.isComparingOriginal) return;
    if (this.wallDrawing) this.cancelWallDrawing();
    if (this.roomDrawing) this.cancelRoomDrawing();
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
      position: [x, prefab === 'roof-panel' ? y + 3.2 : y, z],
      rotation: [0, Math.atan2(-direction.x, -direction.z), 0],
      scale: prefab === 'partition-wall' ? [3, 1, 1] : [1, 1, 1],
      collision: prefab === 'partition-wall' || prefab === 'floor-slab' ? 'solid' : 'none',
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

  /** Bind or unbind an allowlisted exhibit action; refused (and reported) unless the object stands in that exhibit's bay. */
  private commitMeaning(): void {
    const record = this.record();
    if (!record) return;
    const value = this.el<HTMLSelectElement>('meaning').value as MeaningfulActionId | '';
    const { meaning: _previous, ...rest } = record;
    const before = this.placements.captureManifest();
    try {
      const after = this.placements.setRecord(value ? { ...rest, meaning: value } : rest);
      this.history.push(value ? `Bind ${record.label} to ${MEANINGFUL_ACTIONS[value].exhibit}` : `Unbind ${record.label}`, before, after);
      this.note(value ? `${record.label} now ${MEANINGFUL_ACTIONS[value].label.toLowerCase()} at ${MEANINGFUL_ACTIONS[value].exhibit}.` : `${record.label} no longer acts on an exhibit.`, 'ok');
    } catch (error) {
      this.placements.replaceManifest(before);
      this.note(error instanceof Error ? error.message : 'Binding refused.', 'error');
    }
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
    object.rotation.set(
      (record?.prefab === 'floor-slab' || record?.prefab === 'partition-wall') ? 0 : v.rx * RAD,
      v.ry * RAD,
      (record?.prefab === 'floor-slab' || record?.prefab === 'partition-wall') ? 0 : v.rz * RAD,
    );
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
    if (record) after = this.rememberManualMove(record.id, this.followKit(before, record.id, after));
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
    const opening = record.prefab === 'partition-wall'
      && (this.openingInput.value === 'door' || this.openingInput.value === 'window')
      ? this.openingInput.value as 'door' | 'window' : undefined;
    const width = opening ? Number(this.openingWidthInput.value) / 100 : undefined;
    const height = opening ? Number(this.openingHeightInput.value) / 100 : undefined;
    const sill = opening ? Number(this.openingSillInput.value) / 100 : undefined;
    const before = this.placements.captureManifest();
    try {
      const after = this.placements.setRecord({
        ...record, color, depth,
        texture: texture === 'none' ? undefined : texture,
        opening,
        openingWidth: width, openingHeight: height, openingSill: sill,
        collision: this.collisionInput.value as 'none' | 'solid',
        event: this.eventInput.value as 'none' | 'announce' | 'message' | 'toggle-glow' | 'toggle-tint',
        eventMessage: ['message', 'toggle-glow', 'toggle-tint'].includes(this.eventInput.value)
          ? this.eventMessageInput.value.trim() || undefined : undefined,
        eventColor: ['toggle-glow', 'toggle-tint'].includes(this.eventInput.value)
          ? this.eventColorInput.value : undefined,
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
    // New Builder walls are real wall surfaces too. An artwork cannot raycast
    // itself as the mounting target; skip the selected object below.
    const hits = this.raycaster.intersectObjects([root, this.placements.group], true);
    const selectedRoot = this.placements.getObject(record.id);
    const normalMatrix = new THREE.Matrix3();
    for (const hit of hits) {
      if (!hit.face || (selectedRoot && selectedRoot.getObjectById(hit.object.id))) continue;
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
    this.placements.replaceManifest(result.manifest, { history: true });
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
      if (!/^[a-f0-9]{64}$/.test(this.savedRevision)) throw new Error('The initial save revision is missing; reload the editor.');
      const conservation = validateWorkshopConservation(manifest);
      if (!conservation.ok) {
        this.note(conservationErrors(conservation.violations).slice(0, 2).join('; '), 'error');
        return;
      }
      const response = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workshop-Revision': this.savedRevision },
        body: JSON.stringify(manifest),
      });
      const payload = await response.json() as { ok?: boolean; path?: string; objects?: number; revision?: string; error?: string; details?: string[] };
      if (!response.ok || !payload.ok || !payload.revision || !/^[a-f0-9]{64}$/.test(payload.revision)) {
        throw new Error(payload.details?.join('; ') || payload.error || `HTTP ${response.status}: missing save revision`);
      }
      this.savedRevision = payload.revision;
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
    // Keep the selected placement live even if the editor camera moves away.
    this.placements.setPinned(object ? id : null);
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
    return this.selectedId ? this.placements.getRecord(this.selectedId) : null;
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
    if (!this.openState || event.button !== 0 || this.transform.dragging
      || (!this.wallDrawing && !this.roomDrawing && this.transform.axis !== null)) return;
    const rect = this.app.renderer.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (this.wallDrawing) {
      event.preventDefault();
      this.drawWallClick();
      return;
    }
    if (this.roomDrawing) {
      event.preventDefault();
      this.drawRoomClick();
      return;
    }
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
      if (this.record()?.prefab === 'floor-slab' || this.record()?.prefab === 'partition-wall') {
        object.rotation.x = 0;
        object.rotation.z = 0;
      }
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
        let after = sceneEntry
          ? this.placements.setSceneOverride(sceneEntry.id, this.captureTransform(this.object()!))
          : this.placements.captureManifest();
        if (record) after = this.rememberManualMove(record.id, this.followKit(before, record.id, after));
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
    if (event.code === 'Escape' && this.roomDrawing) {
      this.cancelRoomDrawing();
      this.note('Room drawing cancelled.', 'warn');
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.code === 'Escape' && this.wallDrawing) {
      this.cancelWallDrawing();
      this.note('Wall drawing cancelled.', 'warn');
      event.preventDefault();
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
    this.el<HTMLButtonElement>('draw-room').dataset.active = String(this.roomDrawing);
    this.el<HTMLButtonElement>('draw-room').textContent = this.roomDrawing ? 'Cancel room draw' : 'Draw room';
    this.el<HTMLButtonElement>('draw-room').disabled = comparing;
    this.roomRoofInput.disabled = comparing;
    this.el<HTMLButtonElement>('draw-wall').dataset.active = String(this.wallDrawing);
    this.el<HTMLButtonElement>('draw-wall').textContent = this.wallDrawing ? 'Cancel wall draw' : 'Draw wall';
    this.el<HTMLButtonElement>('draw-wall').disabled = comparing;
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
    this.refreshCuratorMemory();
    this.refreshKit();
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
    const notWall = record?.prefab !== 'partition-wall';
    this.openingInput.disabled = notWall || locked;
    this.openingWidthInput.disabled = notWall || locked || !record?.opening;
    this.openingHeightInput.disabled = notWall || locked || !record?.opening;
    this.openingSillInput.disabled = notWall || locked || record?.opening !== 'window';
    this.collisionInput.disabled = !record || locked;
    this.eventInput.disabled = !record || locked;
    this.el<HTMLSelectElement>('meaning').disabled = !record || locked;
    const hasAuthoredReaction = record?.event === 'message'
      || record?.event === 'toggle-glow' || record?.event === 'toggle-tint';
    this.eventMessageInput.disabled = !record || locked || !hasAuthoredReaction;
    this.eventColorInput.disabled = !record || locked
      || (record.event !== 'toggle-glow' && record.event !== 'toggle-tint');
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
      this.openingInput.value = 'none';
      this.collisionInput.value = 'none';
      this.eventInput.value = 'none';
      this.eventMessageInput.value = '';
      this.eventColorInput.value = '#ffc96b';
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
      this.openingInput.value = 'none';
      this.collisionInput.value = 'none';
      this.eventInput.value = 'none';
      this.eventMessageInput.value = '';
      this.eventColorInput.value = '#ffc96b';
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
    const opening = record?.opening ?? 'none';
    const fallback = defaultOpening(opening);
    this.openingInput.value = opening;
    this.openingWidthInput.value = String(Math.round((record?.openingWidth ?? fallback.width) * 100));
    this.openingHeightInput.value = String(Math.round((record?.openingHeight ?? fallback.height) * 100));
    this.openingSillInput.value = String(Math.round((record?.openingSill ?? fallback.sill) * 100));
    this.collisionInput.value = record?.collision ?? 'none';
    this.eventInput.value = record?.event ?? 'none';
    this.el<HTMLSelectElement>('meaning').value = record?.meaning ?? '';
    this.eventMessageInput.value = record?.eventMessage ?? '';
    this.eventColorInput.value = record?.eventColor ?? '#ffc96b';
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
  <button type="button" data-workshop="draw-wall" title="Two clicks on the floor to draw a solid, editable partition">Draw wall</button>
  <button type="button" data-workshop="draw-room" title="Two opposite corners create four walls and a walkable floor in one undoable step">Draw room</button>
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
  <section><h3>Room construction</h3>
    <p class="workshop-muted">Draw room: click two opposite floor corners. It makes four individual editable walls plus one walkable floor. Size 1.25–30 m per side. One Undo removes the whole room.</p>
    <label><input type="checkbox" data-workshop="room-roof"> Add roof panel with room</label>
    <p class="workshop-muted">Each new wall can have a real door or window opening. Original museum structure stays protected.</p>
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
    <h4>Partition wall openings</h4>
    <label>Opening<select data-workshop="opening"><option value="none">Solid wall</option><option value="door">Doorway</option><option value="window">Window opening</option></select></label>
    <label>Opening width %<input data-workshop="opening-width" type="number" min="20" max="80" step="1" value="42"></label>
    <label>Opening height %<input data-workshop="opening-height" type="number" min="20" max="90" step="1" value="73"></label>
    <label>Window sill %<input data-workshop="opening-sill" type="number" min="0" max="65" step="1" value="0"></label>
    <p class="workshop-muted">New authored walls only. Doorways retain accurate physical clearance; museum structural walls are not cut.</p>
    <button type="button" data-workshop="place-wall">Attach selected to wall</button>
    <label>Artwork image<input data-workshop="image" type="file" accept="image/*"></label>
    <p class="workshop-muted">Images become local WebP files in public/workshop-media. Review before committing or publishing.</p>
    <label>Collision<select data-workshop="collision"><option value="none">Walk through (none)</option><option value="solid">Solid bounding box</option></select></label>
    <label>On interact<select data-workshop="event"><option value="none">No action</option><option value="announce">Announce object name</option><option value="message">Show a custom message</option><option value="toggle-glow">Toggle glow</option><option value="toggle-tint">Toggle color tint</option></select></label>
    <label>Event message<input data-workshop="event-message" type="text" maxlength="160" placeholder="What should visitors see?" aria-label="Interaction message"></label>
    <label>Reaction color<input data-workshop="event-color" type="color" value="#ffc96b" aria-label="Interaction reaction color"></label>
    <label>Exhibit action<select data-workshop="meaning" aria-label="Exhibit action"><option value="">None</option>${Object.values(MEANINGFUL_ACTIONS)
      .map((action) => `<option value="${action.id}">${action.exhibit}: ${action.label}</option>`).join('')}</select></label>
    <p class="workshop-muted">Exhibit actions use the exhibit's own controls; the object must stand in that exhibit's bay within ${MEANING_MAX_DISTANCE} m of it.</p>
    <p class="workshop-muted">Visitor actions are limited to authored text, reversible emissive light or material tint. No user-supplied JavaScript is evaluated.</p>
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
    <h4>External source candidates</h4>
    <p class="workshop-muted">Browse verified source records. Thumbnails are fetched on demand and cached locally; models require a separate import and review.</p>
    <button type="button" data-workshop="source-load">Browse source catalog</button>
    <div data-workshop="source-controls" hidden>
      <label>Search source<input data-workshop="source-search" type="search" aria-label="Search source candidates"></label>
      <label>Collection<select data-workshop="source-featured"><option value="all">All 3D candidates</option><option value="featured">Featured 200</option></select></label>
      <label>Source pack<select data-workshop="source-pack"><option value="">All packs</option></select></label>
      <label>Featured target wing<select data-workshop="source-wing"><option value="">All wings</option></select></label>
      <label>Import status<select data-workshop="source-availability"><option value="">All statuses</option><option value="importable">Verified, importable</option><option value="unsupported">Not importable</option><option value="unchecked">Not yet verified</option></select></label>
      <p data-workshop="source-count" role="status"></p>
      <div data-workshop="source-results" class="workshop-asset-results" role="group" aria-label="Source candidates"></div>
      <button type="button" data-workshop="source-prev">Previous candidates</button>
      <button type="button" data-workshop="source-next">Next candidates</button>
      <p data-workshop="source-inspector" class="workshop-muted">Select a loaded thumbnail for source details.</p>
      <button type="button" data-workshop="source-import" disabled>Import and place selected model</button>
    </div>
  </section>
  <section><h3>Primitive objects & fixtures</h3><div class="workshop-palette" data-workshop="palette"></div></section>
  <section><h3>Scene index</h3>
    <button type="button" data-workshop="scene-index-refresh">Inspect current scene data</button>
    <p data-workshop="scene-index-summary" class="workshop-muted">Refresh to inspect authoritative layout data.</p>
    <label>Exhibit<select data-workshop="scene-index-exhibit" aria-label="Scene index exhibit"></select></label>
    <p data-workshop="scene-index-detail" class="workshop-muted"></p>
    <p data-workshop="scene-index-unavailable" class="workshop-muted"></p>
  </section>
  <section><h3>Route clearance</h3>
    <button type="button" data-workshop="clearance-scan">Scan authored route obstructions</button>
    <p data-workshop="clearance-status" role="status" class="workshop-muted">Not tested.</p>
    <div data-workshop="clearance-results" class="workshop-outliner"></div>
  </section>
  <section><h3>Clear walkways</h3>
    <button type="button" data-workshop="walkways-scan">Scan walkways and suggest moves</button>
    <p data-workshop="walkways-status" role="status" class="workshop-muted">Not tested.</p>
    <div data-workshop="walkways-results" class="workshop-outliner"></div>
  </section>
  <section><h3>Exhibit kits</h3>
    <div class="workshop-row"><select data-workshop="kit-template" aria-label="Kit">${Object.values(KIT_TEMPLATES)
      .map((template) => `<option value="${template.id}">${template.label}</option>`).join('')}</select>
      <button type="button" data-workshop="kit-place">Place kit in view</button></div>
    <label><input type="checkbox" data-workshop="kit-move-together" checked> Move as kit (untick to adjust one part)</label>
    <p data-workshop="kit-status" class="workshop-muted"></p>
    <div class="workshop-row"><button type="button" data-workshop="kit-duplicate" disabled>Copy whole kit</button>
      <button type="button" data-workshop="kit-reset" disabled>Reset this part</button>
      <button type="button" data-workshop="kit-ungroup" disabled>Ungroup</button>
      <button type="button" data-workshop="kit-delete" disabled>Delete kit</button></div>
  </section>
  <section><h3>Auto-curate &amp; clear</h3>
    <div class="workshop-row"><select data-workshop="curate-mode" aria-label="Curation mode"><option value="clear">Clear walkways</option><option value="furnish">Furnish</option><option value="both">Clear and furnish</option></select>
      <select data-workshop="curate-density" aria-label="Density"><option value="minimal">Minimal</option><option value="restrained" selected>Restrained</option><option value="rich">Rich</option></select>
      <select data-workshop="curate-scope" aria-label="Scope"><option value="museum">Whole museum</option>${ZONES.map((zone) => `<option value="${zone.id}">${zone.label}</option>`).join('')}</select></div>
    <div class="workshop-row"><button type="button" data-workshop="curate-run">Suggest</button><button type="button" data-workshop="curate-approve-all" disabled>Approve all shown</button></div>
    <p data-workshop="curate-status" role="status" class="workshop-muted">No suggestions yet. Nothing changes until you approve.</p>
    <div data-workshop="curate-results" class="workshop-outliner"></div>
  </section>
  <section><h3>Narrative gravity</h3>
    <p class="workshop-muted">Pilot exhibits only. Keeps the visitor's view of the hero clear; exhibit content is never moved, and NO CHANGE is a valid answer.</p>
    <div class="workshop-row"><select data-workshop="gravity-exhibit" aria-label="Exhibit">${NARRATIVE_GRAVITY_PILOTS.map((id) => `<option value="${id}">${id}</option>`).join('')}</select>
      <button type="button" data-workshop="gravity-run">Read composition</button></div>
    <p data-workshop="gravity-status" role="status" class="workshop-muted">Not read yet.</p>
    <div data-workshop="gravity-results" class="workshop-outliner"></div>
  </section>
  <section><h3>Museum health</h3>
    <button type="button" data-workshop="health-run">Check museum health</button>
    <p data-workshop="health-status" role="status" class="workshop-muted">Not tested.</p>
    <div data-workshop="health-results" class="workshop-outliner"></div>
  </section>
  <section><h3>Virtual visitor jury</h3>
    <p class="workshop-muted">Simulated visitors walk every exhibit, both floors, the stairs and the Sanctuary through the real collision world. Read-only.</p>
    <button type="button" data-workshop="jury-run">Run visitor jury</button>
    <p data-workshop="jury-status" role="status" class="workshop-muted">Not tested.</p>
    <div data-workshop="jury-results" class="workshop-outliner"></div>
  </section>
  <section><h3>Curator's memory</h3>
    <button type="button" data-workshop="curator-lock" disabled>Lock against automation</button>
    <button type="button" data-workshop="curator-empty">Keep area around selection empty</button>
    <p data-workshop="curator-summary" class="workshop-muted"></p>
    <div data-workshop="curator-regions" class="workshop-outliner"></div>
  </section>
  <section><h3>Placed objects</h3><div class="workshop-outliner" data-workshop="outliner"></div></section>
  <p data-workshop="world-indicator" class="workshop-muted">Editing: Island</p>
  <div class="workshop-status" data-workshop="status" role="status" aria-live="polite"></div>
</aside>`;
