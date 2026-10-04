import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { QualitySettings } from './QualityTiers';
import {
  DOME_APEX_Y, LEVEL_1_Y, SANCTUARY_CENTER, SANCTUARY_FLOOR_Y, SANCTUARY_HEIGHT,
  WINGS, PLACEMENTS, WING_BY_ID, faceDirection, place,
} from '../world/layout';

const MAX_ACTIVE_POINT_LIGHTS = 8;

export class Lighting {
  readonly group = new THREE.Group();
  readonly bayLights = new Map<string, THREE.PointLight>();
  private readonly bayFills = new Map<string, THREE.PointLight>();
  private readonly managed: THREE.PointLight[] = [];
  private readonly suppressed = new Set<THREE.PointLight>();
  private readonly distances: { light: THREE.PointLight; d: number }[] = [];
  private readonly bayEnabled = new Map<string, boolean>();
  private lastEyeX = Number.NaN;
  private lastEyeY = Number.NaN;
  private lastEyeZ = Number.NaN;
  private dirty = true;

  constructor(scope: ResourceScope, quality: QualitySettings) {
    this.group.name = 'lighting';

    // Night exterior: cool sky fill leaves the garden legible without turning
    // the whole interior dark. The Rotunda has its own architectural lighting.
    const hemi = new THREE.HemisphereLight(0x294f78, 0x101a22, 0.72);
    this.group.add(hemi);

    const ambient = new THREE.AmbientLight(0xb9d2e8, 0.34);
    this.group.add(ambient);

    const moonlight = new THREE.DirectionalLight(0xc9e2ff, 1.55);
    moonlight.position.set(-58, 96, 76);
    moonlight.target.position.set(0, 0, 0);
    if (quality.shadows) {
      moonlight.castShadow = true;
      moonlight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      moonlight.shadow.camera.near = 20;
      moonlight.shadow.camera.far = 320;
      const extent = 70;
      moonlight.shadow.camera.left = -extent;
      moonlight.shadow.camera.right = extent;
      moonlight.shadow.camera.top = extent;
      moonlight.shadow.camera.bottom = -extent;
      moonlight.shadow.bias = -0.0008;
    }
    this.group.add(moonlight, moonlight.target);

    const bounce = new THREE.DirectionalLight(0x4d82a6, 0.46);
    bounce.position.set(70, 32, -90);
    bounce.target.position.set(0, 6, 0);
    this.group.add(bounce, bounce.target);

    // Three real exterior lights are justified: one holds the entrance under
    // the canopy and two wash the facade. Searchlight cones elsewhere are
    // emissive geometry, not additional scene lights.
    const arrival = new THREE.PointLight(0xb9e4ff, 300, 90, 2);
    arrival.position.set(0, 10, 132);
    this.group.add(arrival);
    this.managed.push(arrival);

    for (const x of [-20, 20]) {
      const flood = new THREE.PointLight(0x6fcaff, 250, 68, 2);
      flood.name = 'night-exterior-floodlight';
      flood.position.set(x, 7, 117);
      this.group.add(flood);
      this.managed.push(flood);
    }

    const oculus = new THREE.PointLight(0xfff7e8, 260, 90, 2);
    oculus.position.set(0, DOME_APEX_Y - 3, 0);
    this.group.add(oculus);
    this.managed.push(oculus);

    for (const w of WINGS) {
      const d = faceDirection(w.face);
      const count = Math.max(2, Math.round((w.hallTo - w.hallFrom) / 26));
      for (let i = 0; i < count; i++) {
        const along = w.hallFrom + ((i + 0.5) / count) * (w.hallTo - w.hallFrom);
        const p = place(d, along, 0, w.floorY + w.hallHeight - 1.6);
        const strong = i % 2 === 0;
        const lamp = new THREE.PointLight(0xffe6bd, strong ? 130 : 70, strong ? 46 : 34, 2);
        lamp.position.set(p[0], p[1], p[2]);
        this.group.add(lamp);
        this.managed.push(lamp);
      }
    }

    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      const key = new THREE.PointLight(0xffe9c8, 160, 30, 2);
      key.position.set(
        placement.anchor[0],
        wing.floorY + wing.bayHeight - 2.2,
        placement.anchor[2],
      );
      key.visible = false;
      this.suppressed.add(key);
      this.group.add(key);
      this.managed.push(key);

      const fill = new THREE.PointLight(0xbfc8e0, 45, 18, 2);
      fill.position.set(placement.anchor[0], wing.floorY + 1.6, placement.anchor[2]);
      fill.visible = false;
      this.suppressed.add(fill);
      this.group.add(fill);
      this.managed.push(fill);

      this.bayLights.set(placement.exhibitId, key);
      this.bayFills.set(placement.exhibitId, fill);
      this.bayEnabled.set(placement.exhibitId, false);
    }

    const balcony = new THREE.PointLight(0xf2e8d6, 70, 55, 2);
    balcony.position.set(0, LEVEL_1_Y + 5, 0);
    this.group.add(balcony);
    this.managed.push(balcony);

    const sanctuary = new THREE.PointLight(0xf6ecd8, 60, 34, 2.2);
    sanctuary.position.set(SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y + SANCTUARY_HEIGHT - 1.2, SANCTUARY_CENTER[2]);
    this.group.add(sanctuary);
    this.managed.push(sanctuary);

    void scope;
  }

  setBayLight(exhibitId: string, on: boolean): void {
    if (this.bayEnabled.get(exhibitId) === on) return;
    this.bayEnabled.set(exhibitId, on);
    this.dirty = true;
    for (const light of [this.bayLights.get(exhibitId), this.bayFills.get(exhibitId)]) {
      if (!light) continue;
      if (on) this.suppressed.delete(light);
      else this.suppressed.add(light);
    }
  }

  update(eye: readonly [number, number, number]): void {
    const dxEye = eye[0] - this.lastEyeX;
    const dyEye = eye[1] - this.lastEyeY;
    const dzEye = eye[2] - this.lastEyeZ;
    if (!this.dirty && dxEye * dxEye + dyEye * dyEye + dzEye * dzEye < 0.0025) return;
    this.lastEyeX = eye[0];
    this.lastEyeY = eye[1];
    this.lastEyeZ = eye[2];
    this.dirty = false;
    let candidateCount = 0;
    for (const light of this.managed) {
      if (this.suppressed.has(light)) {
        light.visible = false;
        continue;
      }
      const dx = light.position.x - eye[0];
      const dy = light.position.y - eye[1];
      const dz = light.position.z - eye[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d > light.distance * light.distance) {
        light.visible = false;
        continue;
      }
      const entry = this.distances[candidateCount] ?? { light, d };
      entry.light = light;
      entry.d = d;
      this.distances[candidateCount++] = entry;
    }
    this.distances.length = candidateCount;

    this.distances.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.distances.length; i++) {
      this.distances[i].light.visible = i < MAX_ACTIVE_POINT_LIGHTS;
    }
  }

  get activePointLights(): number {
    let n = 0;
    for (const light of this.managed) if (light.visible) n++;
    return n;
  }

  dispose(): void {
    this.group.traverse((node) => {
      const shadow = (node as { shadow?: THREE.LightShadow }).shadow;
      if (shadow?.dispose) shadow.dispose();
    });
    this.group.removeFromParent();
    this.group.clear();
    this.bayLights.clear();
    this.bayFills.clear();
    this.bayEnabled.clear();
    this.managed.length = 0;
    this.suppressed.clear();
  }
}
