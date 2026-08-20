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

  constructor(scope: ResourceScope, quality: QualitySettings) {
    this.group.name = 'lighting';

    // Daylight fill is intentionally bright enough that the garden reads as a
    // sunny public space while still leaving useful shadow and interior depth.
    const hemi = new THREE.HemisphereLight(0xd8ecff, 0x6f755f, 1.25);
    this.group.add(hemi);

    const ambient = new THREE.AmbientLight(0xfffdf7, 0.62);
    this.group.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff1cf, 2.65);
    sun.position.set(48, 96, 120);
    sun.target.position.set(0, 0, 0);
    if (quality.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      sun.shadow.camera.near = 20;
      sun.shadow.camera.far = 320;
      const extent = 70;
      sun.shadow.camera.left = -extent;
      sun.shadow.camera.right = extent;
      sun.shadow.camera.top = extent;
      sun.shadow.camera.bottom = -extent;
      sun.shadow.bias = -0.0008;
    }
    this.group.add(sun, sun.target);

    const bounce = new THREE.DirectionalLight(0xbcd8ef, 0.78);
    bounce.position.set(-70, 40, -90);
    bounce.target.position.set(0, 6, 0);
    this.group.add(bounce, bounce.target);

    // The arrival plaza needs only a modest warm lift now that it is genuinely
    // daylight; it remains useful beneath the entrance canopy.
    const arrival = new THREE.PointLight(0xffefd1, 150, 78, 2);
    arrival.position.set(0, 10, 132);
    this.group.add(arrival);
    this.managed.push(arrival);

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
    for (const light of [this.bayLights.get(exhibitId), this.bayFills.get(exhibitId)]) {
      if (!light) continue;
      if (on) this.suppressed.delete(light);
      else this.suppressed.add(light);
    }
  }

  update(eye: readonly [number, number, number]): void {
    this.distances.length = 0;
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
      this.distances.push({ light, d });
    }

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
    this.managed.length = 0;
    this.suppressed.clear();
  }
}
