import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { faceDirection, place, WING_BY_ID } from './layout';

const INFRA = WING_BY_ID.get('infra')!;
const DIR = faceDirection(INFRA.face);
/** Inner face of the Local Systems hall's end wall (the wall is 0.8 m thick, centred on hallTo). */
export const TEST_LAB_WALL_ALONG = INFRA.hallTo - 0.4;
export const TEST_LAB_DOOR_WIDTH = 3.2;
export const TEST_LAB_DOOR_HEIGHT = 4.2;
/** Where the lab's push button sits, right of the door, facing back down the hall. */
export const TEST_LAB_BUTTON_LATERAL = 2.55;

/**
 * The Exhibits Under Construction test lab door (W07's museum anchor).
 *
 * It stands flush against the end wall of the Local Systems wing (the wing
 * with the fewest exhibits), clear of both exhibit bays and of every hall
 * furnishing, and replaces nothing: it is not one of the 35 exhibit slots.
 * A sealed door of calibration glass in a hazard-striped frame, with a push
 * button beside it. It adds no floor footprint and no collider (nothing
 * protrudes more than 0.12 m from the wall, inside the visitor's own radius).
 */
export class TestLabDoor {
  readonly group = new THREE.Group();
  /** The interactive target: the whole door (frame, glass and button). */
  readonly control: THREE.Group;

  constructor(scope: ResourceScope) {
    this.group.name = 'test-lab-door';
    const y = INFRA.floorY;
    const at = place(DIR, TEST_LAB_WALL_ALONG, 0, y);
    this.group.position.set(at[0], at[1], at[2]);
    // Local +Z faces back down the hall (toward the rotunda).
    this.group.rotation.y = Math.atan2(-DIR[0], -DIR[2]);

    // Soft-edged diagonal hazard stripes (64 px, mipmapped), tiled per metre on each frame piece.
    const S = 64;
    const stripes = new Uint8Array(S * S * 4);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const t = (((i + j + 1) / S) * 2) % 1;
      const k = Math.min(1, Math.max(0, (Math.min(Math.abs(t - 0.25), Math.abs(t - 0.75)) - 0.235) / 0.03 + 0.5));
      stripes.set([232 * (1 - k) + 28 * k, 186 * (1 - k) + 28 * k, 44 * (1 - k) + 30 * k, 255].map(Math.round), (j * S + i) * 4);
    }
    const stripeTex = scope.track(new THREE.DataTexture(stripes, S, S));
    stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
    stripeTex.magFilter = THREE.LinearFilter;
    stripeTex.minFilter = THREE.LinearMipmapLinearFilter;
    stripeTex.generateMipmaps = true;
    stripeTex.colorSpace = THREE.SRGBColorSpace;
    stripeTex.needsUpdate = true;
    const hazard = scope.track(new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }));
    const metal = scope.track(new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.5, metalness: 0.5 }));
    const recess = scope.track(new THREE.MeshStandardMaterial({ color: 0x0e1216, emissive: 0x0a1418, emissiveIntensity: 1, roughness: 0.9 }));
    const glass = scope.track(new THREE.MeshStandardMaterial({ color: 0xc8ecff, emissive: 0x6fb8d8, emissiveIntensity: 0.18, transparent: true, opacity: 0.32, roughness: 0.08, depthWrite: false }));

    const w = TEST_LAB_DOOR_WIDTH, h = TEST_LAB_DOOR_HEIGHT;
    const door = new THREE.Group();
    door.name = 'test-lab-door-control';
    // Dark recess behind the glass, with a lit white calibration panel and two linked rings seen through it.
    const back = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(w, h)), recess);
    back.position.set(0, h / 2, 0.01);
    const panel = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(0.9, 1.6)), scope.track(new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xffffff, emissiveIntensity: 0.25 })));
    panel.position.set(-0.6, 1.4, 0.02);
    const ringA = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.34, 0.035, 8, 32)), scope.track(new THREE.MeshStandardMaterial({ color: 0xffa030, emissive: 0xffa030, emissiveIntensity: 1.2 })));
    ringA.position.set(0.55, 2.2, 0.03);
    ringA.scale.set(0.8, 1.1, 1);
    const ringB = new THREE.Mesh(ringA.geometry, scope.track(new THREE.MeshStandardMaterial({ color: 0x2ad4d4, emissive: 0x2ad4d4, emissiveIntensity: 1.2 })));
    ringB.position.set(0.95, 2.05, 0.03);
    ringB.scale.set(0.8, 1.1, 1);
    const pane = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(w - 0.2, h - 0.2)), glass);
    pane.position.set(0, h / 2, 0.06);
    // Hazard-striped frame (thin, flush with the wall).
    /** Box whose UVs run one stripe tile per 0.6 m, so stripes keep their width on any piece. */
    const tiledBox = (bw: number, bh: number, bd: number) => {
      const g = new THREE.BoxGeometry(bw, bh, bd);
      const uv = g.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * bw) / 0.6, (uv.getY(i) * bh) / 0.6);
      return scope.track(g);
    };
    const frame = (fw: number, fh: number, x: number, fy: number) => {
      const m = new THREE.Mesh(tiledBox(fw, fh, 0.1), hazard);
      m.position.set(x, fy, 0.05);
      return m;
    };
    door.add(back, panel, ringA, ringB, pane,
      frame(w + 0.4, 0.2, 0, h + 0.1), frame(0.2, h, -w / 2 - 0.1, h / 2), frame(0.2, h, w / 2 + 0.1, h / 2));
    // Mullion and a mid rail: the glass reads as sealed.
    const bar = (bw: number, bh: number, x: number, by: number) => {
      const m = new THREE.Mesh(scope.track(new THREE.BoxGeometry(bw, bh, 0.06)), metal);
      m.position.set(x, by, 0.08);
      return m;
    };
    door.add(bar(0.07, h - 0.2, 0, h / 2), bar(w - 0.2, 0.07, 0, h * 0.52));

    // Push button beside the door.
    const plate = new THREE.Mesh(tiledBox(0.5, 0.7, 0.06), hazard);
    plate.position.set(TEST_LAB_BUTTON_LATERAL, 1.2, 0.03);
    const cap = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.15, 0.17, 0.1, 20)), scope.track(new THREE.MeshStandardMaterial({ color: 0xd04030, emissive: 0xd04030, emissiveIntensity: 0.45 })));
    cap.rotation.x = Math.PI / 2;
    cap.position.set(TEST_LAB_BUTTON_LATERAL, 1.25, 0.1);
    door.add(plate, cap);
    this.group.add(door);
    this.control = door;

    // A hazard line on the floor in front of the door.
    const line = new THREE.Mesh(tiledBox(w + 2.6, 0.18, 0.001), hazard);
    line.rotation.x = -Math.PI / 2;
    line.position.set(TEST_LAB_BUTTON_LATERAL / 2 - 0.2, 0.006, 1.2);
    line.raycast = () => {};
    this.group.add(line);
  }
}
