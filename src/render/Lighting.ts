import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { QualitySettings } from './QualityTiers';
import {
  DOME_APEX_Y, LEVEL_1_Y, SANCTUARY_CENTER, SANCTUARY_FLOOR_Y, SANCTUARY_HEIGHT,
  WINGS, PLACEMENTS, WING_BY_ID, faceDirection, place,
} from '../world/layout';

/**
 * Museum lighting. One sun, one sky fill, and a small set of interior sources
 * placed from the layout so lighting cannot drift away from the architecture.
 * Plan §23: few shadow-casting lights, and none at all on the low tier.
 */
export class Lighting {
  readonly group = new THREE.Group();
  /** Bay key lights, addressable by exhibit so streaming can switch them off. */
  readonly bayLights = new Map<string, THREE.PointLight>();

  constructor(scope: ResourceScope, quality: QualitySettings) {
    this.group.name = 'lighting';

    const hemi = new THREE.HemisphereLight(0xcfe0f0, 0x2a2620, 0.55);
    this.group.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.28);
    this.group.add(ambient);

    // Sun through the dome. The one shadow caster in the building.
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
    sun.position.set(60, 120, 40);
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

    // Rotunda: light falling from the oculus.
    const oculus = new THREE.PointLight(0xfff4de, 240, 90, 2);
    oculus.position.set(0, DOME_APEX_Y - 3, 0);
    this.group.add(oculus);

    // One warm source per wing hall, plus one at each mezzanine.
    for (const w of WINGS) {
      const d = faceDirection(w.face);
      const count = Math.max(2, Math.round((w.hallTo - w.hallFrom) / 26));
      for (let i = 0; i < count; i++) {
        const along = w.hallFrom + ((i + 0.5) / count) * (w.hallTo - w.hallFrom);
        const p = place(d, along, 0, w.floorY + w.hallHeight - 1.6);
        const lamp = new THREE.PointLight(0xffe6bd, 90, 42, 2);
        lamp.position.set(p[0], p[1], p[2]);
        this.group.add(lamp);
      }
    }

    // One warm key light per exhibit bay. Bays are alcoves off the halls, so a
    // hall lamp does not reach them and the exhibit would sit in shadow.
    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      const key = new THREE.PointLight(0xffe9c8, 70, 26, 2);
      key.position.set(
        placement.anchor[0],
        wing.floorY + wing.bayHeight - 2.2,
        placement.anchor[2],
      );
      // Off until the exhibit streams in. Thirty-five simultaneous point lights
      // would cost far more than the handful the visitor can actually see.
      key.visible = false;
      this.group.add(key);
      this.bayLights.set(placement.exhibitId, key);
    }

    // Balcony ring wash.
    const balcony = new THREE.PointLight(0xf2e8d6, 70, 55, 2);
    balcony.position.set(0, LEVEL_1_Y + 5, 0);
    this.group.add(balcony);

    // Sanctuary: a single soft shaft through the oculus. Nothing else.
    const sanctuary = new THREE.PointLight(0xf6ecd8, 60, 34, 2.2);
    sanctuary.position.set(SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y + SANCTUARY_HEIGHT - 1.2, SANCTUARY_CENTER[2]);
    this.group.add(sanctuary);

    // Nothing here allocates a disposable resource, but keep the scope in the
    // signature so lighting joins the same ownership discipline as everything else.
    void scope;
  }

  /** Switch a bay's key light with its exhibit's residency. */
  setBayLight(exhibitId: string, on: boolean): void {
    const light = this.bayLights.get(exhibitId);
    if (light) light.visible = on;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.bayLights.clear();
  }
}
