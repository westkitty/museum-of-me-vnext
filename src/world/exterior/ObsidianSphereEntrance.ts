import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ResourceScope } from '../../assets/ResourceScope';
import type { CollisionWorld } from '../CollisionWorld';
import {
  ENTRANCE_PORTAL_Z, GROUND_Y, OBSIDIAN_SPHERE_CENTER_Z,
  OBSIDIAN_SPHERE_RADIUS,
} from '../layout';

/**
 * Physical exterior threshold, not a screen, teleport, loading overlay or new world.
 * The curved opaque shell conceals the expensive interior while the visitor
 * walks around a solid central obsidian column. The existing doorway seam at
 * ENTRANCE_PORTAL_Z is still the only world transition.
 */
const SIDES = 32;
const TWO_PI = Math.PI * 2;
const LOWER_SHELL_START = 1.49;
const OCULUS_POLAR_ANGLE = 0.12;
const OPENING_HALF_ANGLE = 0.43;
const CENTER_Y = 4.5;
const R = OBSIDIAN_SPHERE_RADIUS;
const THETA_FLOOR = Math.acos(-CENTER_Y / R);
const CENTER_Z = OBSIDIAN_SPHERE_CENTER_Z;

export function isSphereWallSector(index: number): boolean {
  const angle = ((index + 0.5) / SIDES) * TWO_PI;
  // Two aligned walk-through doorways, each wider than the visitor capsule.
  return Math.abs(Math.sin(angle)) <= Math.cos(OPENING_HALF_ANGLE);
}

/** The light follows actual traversed depth, not an arbitrary loading timer. */
export function sphereRevealLevel(x: number, z: number, reducedMotion = false): number {
  if (reducedMotion) return 0.52;
  const dx = x;
  const dz = z - CENTER_Z;
  if (dx * dx + dz * dz > (R + 1.5) * (R + 1.5)) return 0.10;
  const frontZ = CENTER_Z + Math.sqrt(R * R - CENTER_Y * CENTER_Y);
  const u = THREE.MathUtils.clamp((frontZ - z) / (frontZ - ENTRANCE_PORTAL_Z), 0, 1);
  return 0.14 + u * u * (3 - 2 * u) * 0.86;
}

export class ObsidianSphereEntrance {
  readonly group = new THREE.Group();
  private readonly floorGlow: THREE.MeshBasicMaterial;
  private readonly traceryGlow: THREE.MeshBasicMaterial;
  private readonly doorwayGlow: THREE.MeshBasicMaterial;
  private readonly monolith: THREE.MeshStandardMaterial;
  private readonly oculusGlow: THREE.MeshBasicMaterial;
  private readonly exitGlow: THREE.MeshBasicMaterial;
  private readonly vaultGlows: readonly THREE.MeshBasicMaterial[];
  private lightLevel = 0.10;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'obsidian-sphere-entrance';
    this.group.userData.spatialFeatureId = 'obsidian-sphere-entrance';
    this.group.userData.visualRole = 'walkthrough-loading-threshold';

    // Emissive material-only glow: adding even one real exterior PointLight
    // changes THREE's light-count shader programs across the world seam and
    // caused 18 costly visible-frame recompilations on real Chromium CI.

    this.floorGlow = scope.track(new THREE.MeshBasicMaterial({
      color: 0x248ac0, transparent: true, opacity: 0.04,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
    }));
    this.traceryGlow = scope.track(new THREE.MeshBasicMaterial({
      color: 0x73d8ff, transparent: true, opacity: 0.04,
      depthWrite: false, toneMapped: false,
    }));
    this.doorwayGlow = scope.track(new THREE.MeshBasicMaterial({
      color: 0x4ecbfa, transparent: true, opacity: 0.05,
      depthWrite: false, toneMapped: false,
    }));
    this.oculusGlow = scope.track(new THREE.MeshBasicMaterial({
      color: 0x6accfa, transparent: true, opacity: 0.1,
      depthWrite: false, toneMapped: false,
    }));
    this.exitGlow = scope.track(new THREE.MeshBasicMaterial({
      color: 0x94e5ff, transparent: true, opacity: 0.03,
      depthWrite: false, toneMapped: false,
    }));
    this.vaultGlows = Array.from({ length: 3 }, () => scope.track(new THREE.MeshBasicMaterial({
      color: 0x4cb8ef, transparent: true, opacity: 0.03,
      depthWrite: false, toneMapped: false,
    })));
    this.monolith = scope.track(new THREE.MeshStandardMaterial({
      color: 0x0b1018, metalness: 0.76, roughness: 0.25,
      emissive: 0x133b58, emissiveIntensity: 0.07, flatShading: true,
    }));
  }

  private mesh(
    name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number,
  ): THREE.Mesh {
    const node = new THREE.Mesh(this.scope.track(geometry), material);
    node.name = name;
    node.position.set(x, y, z);
    node.receiveShadow = true;
    this.group.add(node);
    return node;
  }

  /** Build once. No runtime asset requests, side effects or extra frame loop. */
  build(): THREE.Group {
    const obsidian = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x0b101b, metalness: 0.67, roughness: 0.36,
      side: THREE.DoubleSide, flatShading: true,
    }));
    const innerObsidian = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x070b12, metalness: 0.44, roughness: 0.56,
      side: THREE.DoubleSide, flatShading: true,
    }));
    const darkStone = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x080d16, metalness: 0.28, roughness: 0.8,
    }));
    const trim = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x21364b, metalness: 0.88, roughness: 0.27,
    }));

    // The lower part of a true sphere is buried beneath the island, leaving a
    // convincing dome with a full-height, walkable ring at ground level.
    this.mesh(
      'obsidian-sphere-dome',
      new THREE.SphereGeometry(
        R, 64, 24, 0, TWO_PI, OCULUS_POLAR_ANGLE, LOWER_SHELL_START - OCULUS_POLAR_ANGLE,
      ),
      obsidian, 0, GROUND_Y + CENTER_Y, CENTER_Z,
    );

    // A real open oculus offers one sliver of island sky over the monolith.
    // It lets the vast skylit atrium read as an architectural discovery, not
    // an arbitrary portal effect. Static, one draw, and no new shader or loop.
    const oculusRadius = R * Math.sin(OCULUS_POLAR_ANGLE);
    const oculus = this.mesh(
      'obsidian-open-sky-oculus',
      new THREE.TorusGeometry(oculusRadius, 0.075, 6, 48),
      this.oculusGlow,
      0, GROUND_Y + CENTER_Y + R * Math.cos(OCULUS_POLAR_ANGLE), CENTER_Z,
    );
    oculus.rotation.x = Math.PI / 2;

    // Skipped sectors carve real open sightlines at both ends. Collision uses
    // the same sectors with oriented segments, not one impassable cylinder.
    const slice = TWO_PI / SIDES;
    const wallRadius = 9.2;
    const occupiedSectors = Array.from({ length: SIDES }, (_, index) => index)
      .filter(isSphereWallSector);
    // One instanced draw replaces every separate wall-sector draw. The real
    // oriented collision segments are deliberately preserved one-for-one.
    const wallBatch = new THREE.InstancedMesh(
      this.scope.track(new THREE.SphereGeometry(
        R, 5, 6, 0, slice, LOWER_SHELL_START, THETA_FLOOR - LOWER_SHELL_START,
      )),
      innerObsidian, occupiedSectors.length,
    );
    wallBatch.name = 'obsidian-sphere-curved-wall-batch';
    wallBatch.receiveShadow = true;
    const wallTransform = new THREE.Object3D();
    occupiedSectors.forEach((i, instanceIndex) => {
      const angle = (i + 0.5) * slice;
      wallTransform.position.set(0, GROUND_Y + CENTER_Y, CENTER_Z);
      wallTransform.rotation.y = i * slice;
      wallTransform.updateMatrix();
      wallBatch.setMatrixAt(instanceIndex, wallTransform.matrix);

      const yaw = -angle - Math.PI / 2;
      const halfX = wallRadius * slice * 0.53;
      const halfZ = 0.42;
      const centerX = Math.cos(angle) * wallRadius;
      const centerZ = CENTER_Z + Math.sin(angle) * wallRadius;
      const cx = Math.cos(yaw);
      const sx = Math.sin(yaw);
      const broadX = Math.abs(cx) * halfX + Math.abs(sx) * halfZ;
      const broadZ = Math.abs(sx) * halfX + Math.abs(cx) * halfZ;
      this.collision.add({
        kind: 'wall',
        minX: centerX - broadX, maxX: centerX + broadX,
        minY: GROUND_Y, maxY: GROUND_Y + 5.6,
        minZ: centerZ - broadZ, maxZ: centerZ + broadZ,
        oriented: { centerX, centerZ, halfX, halfZ, yaw },
      });
    });
    wallBatch.instanceMatrix.needsUpdate = true;
    wallBatch.computeBoundingSphere();
    this.scope.track(wallBatch);
    this.group.add(wallBatch);

    // An actual dark stone floor conceals the old decorative rill where it
    // passes beneath the new threshold; outdoor garden colliders are preserved.
    const floor = this.mesh(
      'obsidian-sphere-floor', new THREE.CircleGeometry(R - 0.65, 64),
      darkStone, 0, GROUND_Y + 0.075, CENTER_Z,
    );
    floor.rotation.x = -Math.PI / 2;
    const rim = this.mesh(
      'obsidian-sphere-floor-ring', new THREE.RingGeometry(5.25, 5.33, 64),
      this.floorGlow, 0, GROUND_Y + 0.091, CENTER_Z,
    );
    rim.rotation.x = -Math.PI / 2;

    // Central obstruction forces a real choice of left or right traversal.
    // The faceted object, not a click target, physically blocks a straight shot.
    this.mesh(
      'obsidian-central-column',
      new THREE.CylinderGeometry(2.55, 2.95, 8.0, 7),
      this.monolith, 0, GROUND_Y + 4, CENTER_Z,
    );
    this.collision.addBox(
      [0, GROUND_Y + 4, CENTER_Z], [2.95, 4, 2.95],
    );
    this.mesh(
      'obsidian-column-plinth',
      new THREE.CylinderGeometry(3.15, 3.4, 0.22, 12),
      trim, 0, GROUND_Y + 0.11, CENTER_Z,
    );
    const crown = this.mesh(
      'obsidian-column-crown',
      new THREE.CylinderGeometry(2.6, 2.6, 0.10, 7),
      this.traceryGlow, 0, GROUND_Y + 8.08, CENTER_Z,
    );
    crown.rotation.y = Math.PI / 7;

    // Two legible luminous paths describe the circulation without arrows,
    // prompts or a scripted traversal. Either side works in either direction.
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 18; i++) {
        const angle = Math.PI / 2 + side * (i / 18) * Math.PI;
        points.push(new THREE.Vector3(
          Math.cos(angle) * 5.1, GROUND_Y + 0.12,
          CENTER_Z + Math.sin(angle) * 5.1,
        ));
      }
      this.mesh(
        'obsidian-circulation-arc-' + (side < 0 ? 'west' : 'east'),
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.045, 6, false),
        this.floorGlow, 0, 0, 0,
      );
    }

    // From outdoors these narrow obsidian portals read as a single small
    // structure. Once through, the concealed depth makes the atrium impossible.
    const entranceEdge = Math.sqrt(R * R - CENTER_Y * CENTER_Y) - 0.18;
    for (const direction of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = Math.PI * i / 16;
        points.push(new THREE.Vector3(
          Math.cos(t) * 3.42,
          GROUND_Y + Math.sin(t) * 5.18,
          CENTER_Z + direction * entranceEdge,
        ));
      }
      this.mesh(
        direction > 0 ? 'obsidian-sphere-outside-arch' : 'obsidian-sphere-atrium-arch',
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.09, 6, false),
        direction > 0 ? this.doorwayGlow : this.exitGlow, 0, 0, 0,
      );
    }

    // One geometrically merged draw for the twelve static meridians; preserve
    // the authored curves and the closed-world number of rays.
    const meridians: THREE.BufferGeometry[] = [];
    for (let m = 0; m < 12; m++) {
      const azimuth = m * TWO_PI / 12;
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 12; j++) {
        const polar = j / 12 * LOWER_SHELL_START;
        points.push(new THREE.Vector3(
          Math.cos(azimuth) * Math.sin(polar) * (R + 0.025),
          GROUND_Y + CENTER_Y + Math.cos(polar) * (R + 0.025),
          CENTER_Z + Math.sin(azimuth) * Math.sin(polar) * (R + 0.025),
        ));
      }
      meridians.push(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points), 20, 0.065, 5, false,
      ));
    }
    const mergedMeridians = mergeGeometries(meridians, false);
    // Temporary sub-geometries are not owned by the scene; free their CPU
    // buffers immediately after merging instead of retaining duplicate copies.
    meridians.forEach((geometry) => geometry.dispose());
    if (!mergedMeridians) throw new Error('Could not merge obsidian meridians');
    this.mesh('obsidian-sphere-meridian-batch', mergedMeridians, trim, 0, 0, 0);

    // Three restrained archways turn the actual walk around the monolith into
    // the reveal: their order emerges only as the visitor changes perspective.
    // These geometry-only stations need no light, animation loop or collision.
    for (const [index, z] of [143, 138, 133].entries()) {
      const points: THREE.Vector3[] = [];
      for (let n = 0; n <= 16; n++) {
        const t = Math.PI * n / 16;
        points.push(new THREE.Vector3(
          Math.cos(t) * 7.1,
          GROUND_Y + 0.22 + Math.sin(t) * 5.85,
          z,
        ));
      }
      this.mesh(
        'obsidian-reveal-vault-' + (index + 1),
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.045, 5, false),
        this.vaultGlows[index], 0, 0, 0,
      );
    }

    this.update(0, [0, GROUND_Y, CENTER_Z + R + 3], false);
    return this.group;
  }

  update(
    dt: number,
    eye: readonly [number, number, number],
    reducedMotion: boolean,
  ): void {
    const target = sphereRevealLevel(eye[0], eye[2], reducedMotion);
    const mix = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, Math.min(dt, 0.1)) * 2.1);
    this.lightLevel += (target - this.lightLevel) * mix;
    this.floorGlow.opacity = 0.04 + this.lightLevel * 0.62;
    this.traceryGlow.opacity = 0.02 + this.lightLevel * 0.82;
    this.doorwayGlow.opacity = 0.04 + this.lightLevel * 0.72;
    this.monolith.emissiveIntensity = 0.05 + this.lightLevel * 0.34;

    // Moving inward reveals the oculus and three vaults in spatial order.
    // Reversing the walk naturally dims them; reduced motion holds stable.
    const front = CENTER_Z + Math.sqrt(R * R - CENTER_Y * CENTER_Y);
    const progress = reducedMotion ? 1
      : THREE.MathUtils.clamp((front - eye[2]) / (front - ENTRANCE_PORTAL_Z), 0, 1);
    this.vaultGlows.forEach((mat, index) => {
      const start = index * 0.28;
      const stage = THREE.MathUtils.smoothstep(progress, start, start + 0.26);
      mat.opacity = 0.025 + this.lightLevel * 0.75 * stage;
    });
    this.oculusGlow.opacity = 0.08 + this.lightLevel * 0.52;
    this.exitGlow.opacity = 0.025 + this.lightLevel * 0.72
      * THREE.MathUtils.smoothstep(progress, 0.55, 0.9);
  }
}
