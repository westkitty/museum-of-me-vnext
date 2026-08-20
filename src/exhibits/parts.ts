import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';

/**
 * Reusable interactive parts.
 *
 * Plan law 12: shared interaction primitives underneath highly differentiated
 * presentations. These are those primitives. An exhibit composes them and
 * dresses them; it does not invent its own control mechanism.
 *
 * All of them allocate once and animate by transform, so an exhibit can change
 * continuously without churning GPU resources.
 */

/**
 * A filament: a chain of segments that follows an arbitrary curve and can be
 * re-shaped every frame without allocating. The museum's threads, cables,
 * orbits, routes and pulses are all built from this.
 */
export class Filament {
  readonly group = new THREE.Group();
  private readonly segments: THREE.Mesh[] = [];
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly dir = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();

  constructor(
    scope: ResourceScope,
    readonly count: number,
    radius: number,
    material: THREE.Material,
  ) {
    // One unit-length cylinder, reused by every segment.
    const geo = scope.track(new THREE.CylinderGeometry(radius, radius, 1, 6, 1, true));
    for (let i = 0; i < count; i++) {
      const seg = new THREE.Mesh(geo, material);
      seg.matrixAutoUpdate = true;
      this.segments.push(seg);
      this.group.add(seg);
    }
  }

  /** Lay the filament along a curve. Cheap enough to call every frame. */
  follow(curve: THREE.Curve<THREE.Vector3>): void {
    const points = curve.getSpacedPoints(this.count);
    for (let i = 0; i < this.count; i++) {
      const a = points[i];
      const b = points[i + 1];
      this.dir.subVectors(b, a);
      const length = this.dir.length();
      if (length < 1e-6) {
        this.segments[i].visible = false;
        continue;
      }
      this.segments[i].visible = true;
      this.mid.addVectors(a, b).multiplyScalar(0.5);
      this.dir.normalize();
      this.quat.setFromUnitVectors(this.up, this.dir);
      this.segments[i].position.copy(this.mid);
      this.segments[i].quaternion.copy(this.quat);
      this.segments[i].scale.set(1, length, 1);
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}

/**
 * A physical dial the visitor turns. Detented, so it always lands on a state
 * rather than on a fraction — which is what makes an exhibit's behaviour
 * describable in words for the accessible mirror.
 */
export class Dial {
  readonly group = new THREE.Group();
  readonly handle: THREE.Mesh;
  private index = 0;
  private displayAngle = 0;

  constructor(
    scope: ResourceScope,
    readonly steps: number,
    radius = 0.26,
    materials?: { body?: THREE.Material; handle?: THREE.Material },
  ) {
    const body = materials?.body ?? scope.track(new THREE.MeshStandardMaterial({ color: 0x2f2a24, roughness: 0.55, metalness: 0.4 }));
    const grip = materials?.handle ?? scope.track(new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 }));

    const plate = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(radius, radius, 0.07, 24)), body);
    this.group.add(plate);

    this.handle = new THREE.Mesh(scope.track(new THREE.BoxGeometry(radius * 1.5, 0.06, radius * 0.34)), grip);
    this.handle.position.y = 0.06;
    this.group.add(this.handle);

    // Detent marks, so the dial's positions are legible before it is touched.
    const markGeo = scope.track(new THREE.BoxGeometry(0.02, 0.02, radius * 0.22));
    for (let i = 0; i < steps; i++) {
      const mark = new THREE.Mesh(markGeo, grip);
      const a = (i / steps) * Math.PI * 2;
      mark.position.set(Math.sin(a) * radius * 0.82, 0.04, Math.cos(a) * radius * 0.82);
      mark.rotation.y = a;
      this.group.add(mark);
    }
  }

  get value(): number {
    return this.index;
  }

  set value(next: number) {
    this.index = ((next % this.steps) + this.steps) % this.steps;
  }

  advance(by = 1): number {
    this.value = this.index + by;
    return this.index;
  }

  /** Ease the handle toward its detent. Call from the exhibit's update. */
  update(dt: number, instant = false): void {
    const target = -(this.index / this.steps) * Math.PI * 2;
    let delta = target - this.displayAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.displayAngle += instant ? delta : delta * Math.min(1, dt * 9);
    this.handle.rotation.y = this.displayAngle;
  }
}

/**
 * A lever with two or more positions. Reads as a physical switch rather than a
 * checkbox, which is the difference between an exhibit and a web form.
 */
export class Lever {
  readonly group = new THREE.Group();
  readonly arm: THREE.Mesh;
  private index = 0;
  private display = 0;

  constructor(
    scope: ResourceScope,
    readonly positions: number,
    length = 0.4,
    materials?: { body?: THREE.Material; arm?: THREE.Material },
  ) {
    const body = materials?.body ?? scope.track(new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6, metalness: 0.3 }));
    const armMat = materials?.arm ?? scope.track(new THREE.MeshStandardMaterial({ color: 0xb9822c, roughness: 0.3, metalness: 0.75 }));

    const base = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.22, 0.08, 0.3)), body);
    this.group.add(base);

    this.arm = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.028, 0.034, length, 8)), armMat);
    this.arm.position.y = length / 2;
    const pivot = new THREE.Group();
    pivot.add(this.arm);
    this.group.add(pivot);

    const knob = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.055, 12, 8)), armMat);
    knob.position.y = length;
    pivot.add(knob);
    this.pivot = pivot;
  }

  private readonly pivot: THREE.Group;

  get value(): number {
    return this.index;
  }

  set value(next: number) {
    this.index = Math.max(0, Math.min(this.positions - 1, next));
  }

  advance(): number {
    this.value = (this.index + 1) % this.positions;
    return this.index;
  }

  update(dt: number, instant = false): void {
    const span = 0.9;
    const target = -span / 2 + (this.index / Math.max(1, this.positions - 1)) * span;
    this.display += instant ? target - this.display : (target - this.display) * Math.min(1, dt * 10);
    this.pivot.rotation.x = this.display;
  }
}

/**
 * A shallow pedestal that holds a control at a comfortable height and reads as
 * museum furniture rather than as a floating widget.
 */
export function buildConsole(
  scope: ResourceScope,
  width = 0.7,
  depth = 0.5,
  height = 1.0,
  material?: THREE.Material,
): THREE.Group {
  const mat = material ?? scope.track(new THREE.MeshStandardMaterial({ color: 0x35302a, roughness: 0.75 }));
  const group = new THREE.Group();

  const column = new THREE.Mesh(scope.track(new THREE.BoxGeometry(width * 0.62, height - 0.12, depth * 0.62)), mat);
  column.position.y = (height - 0.12) / 2;
  group.add(column);

  const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(width, 0.12, depth)), mat);
  top.position.y = height - 0.06;
  group.add(top);

  const foot = new THREE.Mesh(scope.track(new THREE.BoxGeometry(width * 0.9, 0.06, depth * 0.9)), mat);
  foot.position.y = 0.03;
  group.add(foot);

  return group;
}

/** A glowing node — used for stars, network points, graph vertices. */
export function buildNode(scope: ResourceScope, radius: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(radius, 1)), material);
}

/**
 * A pulse that travels along a curve. Used wherever an exhibit needs to show
 * something moving through a system rather than merely describing it.
 */
export class Pulse {
  readonly mesh: THREE.Mesh;
  private t = 0;
  private running = false;

  constructor(scope: ResourceScope, radius: number, material: THREE.Material) {
    this.mesh = new THREE.Mesh(scope.track(new THREE.SphereGeometry(radius, 10, 8)), material);
    this.mesh.visible = false;
  }

  start(): void {
    this.t = 0;
    this.running = true;
    this.mesh.visible = true;
  }

  stop(): void {
    this.running = false;
    this.mesh.visible = false;
    this.t = 0;
  }

  get progress(): number {
    return this.t;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Advance along the curve. Returns true on the frame it completes. */
  update(dt: number, curve: THREE.Curve<THREE.Vector3>, speed: number): boolean {
    if (!this.running) return false;
    this.t += dt * speed;
    if (this.t >= 1) {
      this.stop();
      return true;
    }
    curve.getPoint(this.t, this.mesh.position);
    return false;
  }
}
