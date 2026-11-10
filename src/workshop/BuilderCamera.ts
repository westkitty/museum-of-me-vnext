import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { App } from '../app/App';

export type BuilderView = 'dollhouse' | 'orbit' | 'top';

/**
 * Home Plan-inspired model-first camera. Uses the SAME renderer, canvas and
 * scene as the actual museum; never creates a second frame loop or world.
 */
export class BuilderCamera {
  readonly orbit: OrbitControls;
  readonly grid: THREE.GridHelper;
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private active = false;
  private view: BuilderView = 'dollhouse';

  constructor(private readonly app: App) {
    this.orbit = new OrbitControls(app.camera, app.renderer.canvas);
    this.orbit.enabled = false;
    this.orbit.enableDamping = false;
    this.orbit.enablePan = true;
    this.orbit.minDistance = 1;
    this.orbit.maxDistance = 500;
    this.grid = new THREE.GridHelper(120, 120, 0x72979e, 0x344e55);
    this.grid.name = 'museum-builder-planning-grid';
    this.grid.visible = false;
    this.grid.traverse((node) => {
      const material = (node as THREE.LineSegments).material;
      if (material && !Array.isArray(material)) material.depthWrite = false;
    });
    app.scene.add(this.grid);
    this.orbit.addEventListener('change', this.onChange);
  }

  open(): void {
    if (this.active) return;
    this.active = true;
    this.orbit.enabled = true;
    const player = this.app.player.position;
    const target = new THREE.Vector3(player.x, player.y + 2, player.z);
    this.orbit.target.copy(target);
    this.app.camera.position.copy(target).add(new THREE.Vector3(22, 21, 22));
    this.orbit.update();
    this.grid.position.set(0, this.app.player.collisionWorld.supportHeight(player.x, player.z, player.y, 2) ?? player.y, 0);
    this.grid.visible = true;
    this.onChange();
    this.app.setWorkshopCameraOverride(this.apply);
  }

  close(): void {
    this.active = false;
    this.orbit.enabled = false;
    this.grid.visible = false;
    this.app.setWorkshopCameraOverride(null);
  }

  setDragging(dragging: boolean): void {
    this.orbit.enabled = this.active && !dragging;
  }

  setView(view: BuilderView): void {
    this.view = view;
    const target = this.orbit.target;
    const distance = Math.max(15, this.app.camera.position.distanceTo(target));
    if (view === 'top') this.app.camera.position.set(target.x, target.y + distance, target.z + 0.001);
    else if (view === 'dollhouse') this.app.camera.position.set(target.x + distance * 0.58, target.y + distance * 0.62, target.z + distance * 0.53);
    else this.app.camera.position.set(target.x + distance * 0.7, target.y + distance * 0.28, target.z + distance * 0.65);
    this.app.camera.up.set(0, 1, 0);
    this.orbit.update();
    this.onChange();
  }

  focus(object: THREE.Object3D): void {
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(3, bounds.getSize(new THREE.Vector3()).length());
    this.orbit.target.copy(center);
    this.app.camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.8, radius));
    this.orbit.update();
    this.onChange();
  }

  get currentView(): BuilderView { return this.view; }

  private readonly onChange = (): void => {
    if (!this.active) return;
    this.position.copy(this.app.camera.position);
    this.quaternion.copy(this.app.camera.quaternion);
  };

  private readonly apply = (): void => {
    this.app.camera.position.copy(this.position);
    this.app.camera.quaternion.copy(this.quaternion);
    this.app.camera.updateMatrixWorld(true);
    this.app.sky.follow(this.app.camera);
  };

  dispose(): void {
    this.close();
    this.orbit.removeEventListener('change', this.onChange);
    this.orbit.dispose();
    this.grid.removeFromParent();
    this.grid.geometry.dispose();
    const material = this.grid.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  }
}
