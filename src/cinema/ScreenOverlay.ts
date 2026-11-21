import * as THREE from 'three';

export type Point2 = readonly [number, number];

/**
 * CSS `matrix3d` that maps an element of `width` × `height` (origin top-left)
 * onto the quadrilateral `quad` (top-left, top-right, bottom-right,
 * bottom-left, in CSS pixels). The planar homography of a rectangle seen in
 * perspective, so the player lies exactly over the projected cinema screen.
 * Returns null for a degenerate quad.
 */
export function quadMatrix3d(width: number, height: number, quad: readonly [Point2, Point2, Point2, Point2]): string | null {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  if (!Number.isFinite(den) || Math.abs(den) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  // Unit square → quad, then scale the element down to the unit square.
  const a = (x1 - x0 + g * x1) / width, b = (x3 - x0 + h * x3) / height, c = x0;
  const d = (y1 - y0 + g * y1) / width, e = (y3 - y0 + h * y3) / height, f = y0;
  const gw = g / width, hh = h / height;
  const values = [a, d, 0, gw, b, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1];
  if (!values.every(Number.isFinite)) return null;
  return `matrix3d(${values.map((v) => +v.toPrecision(9)).join(',')})`;
}

/** Apply a CSS matrix3d (column-major) to a point, for tests. */
export function applyMatrix3d(matrix: string, x: number, y: number): Point2 {
  const m = matrix.slice('matrix3d('.length, -1).split(',').map(Number);
  const X = m[0] * x + m[4] * y + m[12];
  const Y = m[1] * x + m[5] * y + m[13];
  const W = m[3] * x + m[7] * y + m[15];
  return [X / W, Y / W];
}

/** Base size of the player element before it is mapped onto the screen (16:9, above YouTube's 200 px minimum). */
export const OVERLAY_WIDTH = 1280;
export const OVERLAY_HEIGHT = 720;

/**
 * The YouTube player's place in the theater: a DOM layer just above the WebGL
 * canvas whose element is warped, every rendered frame, onto the projected
 * corners of the auditorium screen. It follows the camera, the seat, the
 * viewport size and resizing. It cannot be hidden behind 3D geometry (a
 * browser iframe always draws over the canvas), so it hides itself whenever
 * the screen is not wholly in front of the camera, and the museum's panels
 * and controls sit above it.
 */
export class ScreenOverlay {
  readonly root: HTMLElement;
  readonly frame: HTMLElement;
  private lastTransform = '';
  private shown = false;
  private interactive = false;
  private readonly corner = new THREE.Vector3();
  private readonly view = new THREE.Vector3();
  private readonly quad: [Point2, Point2, Point2, Point2] = [[0, 0], [0, 0], [0, 0], [0, 0]];
  private static readonly LOCAL_CORNERS: readonly [number, number][] = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];

  constructor(parent: HTMLElement) {
    this.frame = document.createElement('div');
    this.frame.className = 'cinema-youtube__frame';
    this.frame.style.width = `${OVERLAY_WIDTH}px`;
    this.frame.style.height = `${OVERLAY_HEIGHT}px`;
    this.root = document.createElement('div');
    this.root.className = 'cinema-youtube';
    this.root.setAttribute('aria-label', 'YouTube screening on the cinema screen');
    this.root.hidden = true;
    this.root.appendChild(this.frame);
    // First child: every HUD element and panel stacks above the player.
    parent.prepend(this.root);
  }

  get isShown(): boolean { return this.shown; }
  get transform(): string { return this.lastTransform; }

  /** Let pointer input reach YouTube's own controls (captions, quality) — off by default so the museum keeps its input. */
  setInteractive(on: boolean): void {
    this.interactive = on;
    this.root.classList.toggle('cinema-youtube--interactive', on);
    const iframe = this.frame.querySelector('iframe');
    if (iframe) iframe.tabIndex = on ? 0 : -1;
  }

  get isInteractive(): boolean { return this.interactive; }

  /**
   * Fit the player to `screen` (a plane of unit size, scaled to the screen) as
   * seen by `camera` on `canvas`. Call after the frame renders.
   */
  update(active: boolean, camera: THREE.Camera, screen: THREE.Object3D, canvas: HTMLCanvasElement): void {
    if (!active) { this.hide(); return; }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { this.hide(); return; }
    camera.updateMatrixWorld();
    screen.updateMatrixWorld();
    const near = (camera as THREE.PerspectiveCamera).near ?? 0.1;
    for (let i = 0; i < 4; i++) {
      const [u, v] = ScreenOverlay.LOCAL_CORNERS[i];
      this.corner.set(u, v, 0).applyMatrix4(screen.matrixWorld);
      this.view.copy(this.corner).applyMatrix4(camera.matrixWorldInverse);
      // Any corner at or behind the camera plane cannot be projected sensibly.
      if (this.view.z > -near) { this.hide(); return; }
      this.corner.project(camera);
      this.quad[i] = [rect.left + (this.corner.x + 1) / 2 * rect.width, rect.top + (1 - this.corner.y) / 2 * rect.height];
    }
    const matrix = quadMatrix3d(OVERLAY_WIDTH, OVERLAY_HEIGHT, this.quad);
    if (!matrix) { this.hide(); return; }
    if (matrix !== this.lastTransform) {
      this.lastTransform = matrix;
      this.frame.style.transform = matrix;
    }
    if (!this.shown) {
      this.shown = true;
      this.root.hidden = false;
    }
    const iframe = this.frame.querySelector('iframe');
    if (iframe && iframe.tabIndex !== (this.interactive ? 0 : -1)) iframe.tabIndex = this.interactive ? 0 : -1;
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }
}
