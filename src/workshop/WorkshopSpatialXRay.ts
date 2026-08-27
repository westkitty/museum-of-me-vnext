import * as THREE from 'three';
import { GROUND_Y, LEVEL_1_Y, SANCTUARY_FLOOR_Y } from '../world/layout';
import { validateWorkshopConservation } from './conservation';
import { WORKSHOP_SCHEMA_VERSION, type WorkshopPlacementManifest, type WorkshopPlacementRecord } from './schema';

const SAMPLE_STEP = 3;
const SAMPLE_LIMIT = 72;
const SAMPLE_SCALE: [number, number, number] = [0.05, 0.05, 0.05];

function probeRecord(x: number, y: number, z: number): WorkshopPlacementRecord {
  return {
    id: '__xray-probe__',
    label: 'Conservation probe',
    prefab: 'sign-post',
    anchor: 'free',
    position: [x, y, z],
    rotation: [0, 0, 0],
    scale: SAMPLE_SCALE,
  };
}

function probeManifest(record: WorkshopPlacementRecord): WorkshopPlacementManifest {
  return { schemaVersion: WORKSHOP_SCHEMA_VERSION, objects: [record] };
}

function pointsGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(points);
  return geometry;
}

/**
 * Development-only visualization derived from the same conservation validator
 * that gates Workshop runtime construction and saves. It deliberately samples
 * that authority instead of maintaining a second set of protected coordinates.
 */
export class WorkshopSpatialXRay {
  readonly group = new THREE.Group();
  private built = false;
  private enabled = false;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private protectedSamples = 0;
  private safeSamples = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = 'museum-workshop-spatial-xray';
    this.group.visible = false;
    this.scene.add(this.group);
  }

  get isEnabled(): boolean { return this.enabled; }

  get summary(): string {
    if (!this.built) return 'X-Ray not sampled yet.';
    return `${this.protectedSamples} protected samples / ${this.safeSamples} open samples`;
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    if (value && !this.built) this.build();
    this.enabled = value;
    this.group.visible = value;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.length = 0;
  }

  private build(): void {
    const protectedPoints: THREE.Vector3[] = [];
    const safePoints: THREE.Vector3[] = [];
    const levels = [GROUND_Y + 0.04, LEVEL_1_Y + 0.04, SANCTUARY_FLOOR_Y + 0.04];

    for (const y of levels) {
      for (let x = -SAMPLE_LIMIT; x <= SAMPLE_LIMIT; x += SAMPLE_STEP) {
        for (let z = -SAMPLE_LIMIT; z <= SAMPLE_LIMIT; z += SAMPLE_STEP) {
          const result = validateWorkshopConservation(probeManifest(probeRecord(x, y, z)));
          const point = new THREE.Vector3(x, y, z);
          if (result.ok) safePoints.push(point);
          else protectedPoints.push(point);
        }
      }
    }

    this.safeSamples = safePoints.length;
    this.protectedSamples = protectedPoints.length;
    this.group.add(
      this.makePoints('workshop-xray-open-space', safePoints, 0x36c9d6, 0.12, 0.12),
      this.makePoints('workshop-xray-protected-space', protectedPoints, 0xff4d35, 0.32, 0.72),
    );
    this.built = true;
  }

  private makePoints(
    name: string,
    points: THREE.Vector3[],
    color: number,
    size: number,
    opacity: number,
  ): THREE.Points {
    const geometry = pointsGeometry(points);
    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.disposables.push(geometry, material);
    const cloud = new THREE.Points(geometry, material);
    cloud.name = name;
    cloud.frustumCulled = true;
    cloud.renderOrder = 20;
    return cloud;
  }
}
