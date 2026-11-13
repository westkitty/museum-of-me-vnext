import * as THREE from 'three';
import { createTextTexture, createFallbackTexture, canRenderText } from '../assets/TextTexture';
import type { ResourceScope } from '../assets/ResourceScope';
import type { ExhibitRecord, ProjectRecord } from '../content/types';

type TextTextureOptions = NonNullable<Parameters<typeof createTextTexture>[2]>;

interface ResidentTextController {
  readonly material: THREE.MeshStandardMaterial;
  readonly preview: THREE.Texture;
  highResolution: THREE.Texture | null;
  setHighResolution(high: boolean): void;
}

const residentTextControllers = new WeakMap<THREE.Object3D, ResidentTextController>();

function scaledTextOptions(
  opts: TextTextureOptions,
  scale: number,
): TextTextureOptions {
  const scaled = { ...opts };
  for (const key of ['width', 'height', 'titleSize', 'bodySize', 'padding', 'paddingX', 'paddingY'] as const) {
    const value = opts[key];
    if (value !== undefined) scaled[key] = Math.max(1, Math.round(value * scale));
  }
  return scaled;
}

function residentTextMaterial(
  scope: ResourceScope,
  paragraphs: readonly string[],
  opts: TextTextureOptions,
): { material: THREE.MeshStandardMaterial; controller: ResidentTextController | null } {
  if (!canRenderText()) return { material: textMaterial(scope, paragraphs, opts), controller: null };

  const preview = createTextTexture(scope, paragraphs, scaledTextOptions(opts, 0.5));
  const material = scope.track(new THREE.MeshStandardMaterial({
    map: preview,
    roughness: 0.85,
    metalness: 0,
  }));
  const controller: ResidentTextController = {
    material,
    preview,
    highResolution: null,
    setHighResolution(high: boolean): void {
      if (high === (this.highResolution !== null)) return;
      if (high) {
        this.highResolution = createTextTexture(scope, paragraphs, opts);
        this.material.map = this.highResolution;
        return;
      }
      this.material.map = this.preview;
      this.highResolution?.dispose();
      if (this.highResolution) scope.untrack(this.highResolution);
      this.highResolution = null;
    },
  };
  return { material, controller };
}

function attachResidentText(
  mesh: THREE.Mesh,
  controller: ResidentTextController | null,
): THREE.Mesh {
  if (controller) residentTextControllers.set(mesh, controller);
  return mesh;
}

/** Upgrade or release the large plaque and lectern canvases below an exhibit root. */
export function setFurnitureTextResolution(root: THREE.Object3D, high: boolean): void {
  root.traverse((node) => residentTextControllers.get(node)?.setHighResolution(high));
}

/** Diagnostic count used by lifecycle tests and browser performance probes. */
export function highResolutionFurnitureTextCount(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((node) => {
    if (residentTextControllers.get(node)?.highResolution) count++;
  });
  return count;
}

/**
 * Interpretation furniture, shared by every exhibit in the museum.
 *
 * Plan §9 defines three layers. Layers 1 and 2 are physical objects in the room
 * — a wall plaque and a reading lectern — and layer 3 lives in the DOM. These
 * builders are the permanent implementation of layers 1 and 2, not scaffolding.
 */

export function textMaterial(scope: ResourceScope, paragraphs: readonly string[], opts: Parameters<typeof createTextTexture>[2]): THREE.MeshStandardMaterial {
  const map = canRenderText()
    ? createTextTexture(scope, paragraphs, opts)
    : createFallbackTexture(scope);
  return scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 }));
}

/**
 * The ten-second plaque. Mounted on the bay's back wall at reading height.
 * Returns the group so the caller can position it.
 */
export function buildPlaque(scope: ResourceScope, record: ExhibitRecord): THREE.Group {
  const group = new THREE.Group();
  group.name = `plaque:${record.id}`;

  const frame = new THREE.Mesh(
    scope.track(new THREE.BoxGeometry(2.5, 1.3, 0.09)),
    scope.track(new THREE.MeshStandardMaterial({ color: 0x2a2419, roughness: 0.5, metalness: 0.35 })),
  );
  group.add(frame);

  const text = residentTextMaterial(scope, [record.copy.plaque], {
    width: 1024,
    height: 512,
    title: record.title,
    titleSize: 54,
    bodySize: 34,
    align: 'center',
    padding: 46,
  });
  const face = attachResidentText(new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(2.34, 1.16)),
    text.material,
  ), text.controller);
  face.position.z = 0.05;
  group.add(face);

  return group;
}

/**
 * The one-minute lectern. A tilted reading surface carrying the problem, what
 * was made, and the projects represented.
 */
export function buildLectern(
  scope: ResourceScope,
  record: ExhibitRecord,
  projects: readonly ProjectRecord[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = `lectern:${record.id}`;

  const stoneMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x3b342a, roughness: 0.8 }));

  const column = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.9, 1.02, 0.5)), stoneMat);
  column.position.y = 0.51;
  group.add(column);

  const base = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.1, 0.1, 0.7)), stoneMat);
  base.position.y = 0.05;
  group.add(base);

  const represented =
    projects.length === 1
      ? `Represents ${projects[0].name}.`
      : `Represents ${projects.length} projects: ${projects.map((p) => p.name).join(', ')}.`;

  const text = residentTextMaterial(scope, [record.copy.problem, record.copy.made, represented], {
    width: 1024,
    height: 740,
    title: record.copy.subtitle,
    titleSize: 44,
    bodySize: 29,
    padding: 52,
  });
  const surface = attachResidentText(new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(0.92, 0.66)),
    text.material,
  ), text.controller);
  surface.position.set(0, 1.08, 0.06);
  surface.rotation.x = -Math.PI / 3.4;
  group.add(surface);

  const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.0, 0.06, 0.72)), stoneMat);
  top.position.y = 1.03;
  top.rotation.x = -Math.PI / 3.4;
  group.add(top);

  return group;
}

/**
 * A small label for a control or sub-element inside an exhibit. Used wherever a
 * visitor needs to know what a thing is without opening a panel.
 */
export function buildLabel(scope: ResourceScope, text: string, width = 0.9, aspect = LABEL_ASPECT): THREE.Mesh {
  const mesh = new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(width, width * aspect)),
    labelMaterial(scope, text, width, aspect),
  );
  mesh.userData.labelAspect = aspect;
  mesh.userData.labelWidth = width;
  return mesh;
}

const LABEL_ASPECT = 0.32;

/**
 * Label text is fitted to its plate: a long caption is set smaller rather than
 * cut off mid-sentence. Wide plates get a wider canvas so the smaller type
 * stays sharp.
 */
function labelMaterial(scope: ResourceScope, text: string, width: number, aspect: number): THREE.MeshStandardMaterial {
  const canvasWidth = width >= 3.2 ? 2048 : width >= 1.2 ? 1024 : 512;
  const scale = canvasWidth / 512;
  const canvasHeight = Math.max(48, Math.round(canvasWidth * aspect));
  const padX = Math.round(28 * scale);
  const padY = Math.max(6, Math.min(Math.round(canvasHeight * 0.16), Math.round(20 * scale)));

  return textMaterial(scope, [], {
    width: canvasWidth,
    height: canvasHeight,
    title: text,
    titleSize: Math.round(54 * scale),
    fitTitle: true,
    align: 'center',
    rule: false,
    paddingX: padX,
    paddingY: padY,
    background: '#1a1712',
    titleColor: '#e8d9b0',
  });
}

/**
 * Swap a `buildLabel` mesh's text in place, disposing the old material/texture
 * so a control that re-labels a wall panel doesn't leak one text texture per
 * change over the exhibit's lifetime (the geometry is a fixed-size plane, so
 * only the material needs replacing).
 */
export function updateLabel(scope: ResourceScope, mesh: THREE.Mesh, text: string): void {
  const previous = mesh.material as THREE.MeshStandardMaterial;
  mesh.material = labelMaterial(
    scope, text,
    (mesh.userData.labelWidth as number | undefined) ?? 0.9,
    (mesh.userData.labelAspect as number | undefined) ?? LABEL_ASPECT,
  );
  const previousMap = previous.map as THREE.Texture | null;
  previousMap?.dispose();
  previous.dispose();
  if (previousMap) scope.untrack(previousMap);
  scope.untrack(previous);
}

/** Wing signage over a hall threshold. */
export function buildWingSign(scope: ResourceScope, name: string, subtitle: string): THREE.Mesh {
  return new THREE.Mesh(
    scope.track(new THREE.PlaneGeometry(5.4, 1.5)),
    textMaterial(scope, [subtitle], {
      width: 1080,
      height: 300,
      title: name,
      titleSize: 76,
      bodySize: 34,
      align: 'center',
      rule: false,
      padding: 22,
      background: '#141118',
      titleColor: '#e8c65a',
      color: '#b9b2a5',
    }),
  );
}
