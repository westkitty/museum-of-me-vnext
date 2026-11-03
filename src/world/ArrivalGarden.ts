import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import { NIGHT_MOON_DIRECTION } from './Sky';
import {
  GROUND_Y, PLAZA_DEPTH, VESTIBULE_TO,
  faceDirection, place, type Vec3,
} from './layout';
import { ISLAND_OUTLINE, LAGOON_OUTLINE, isSiteLand } from './exterior/IslandSiteLayout';

/**
 * Exterior Layer-2 dressing for the visitor's first view of the museum.
 * All placements are authored and deterministic; the central approach remains
 * deliberately clear so decoration can never turn the required route into an
 * obstacle course.
 */
export class ArrivalGarden {
  readonly group = new THREE.Group();

  private readonly stone: THREE.MeshStandardMaterial;
  private readonly lawn: THREE.MeshStandardMaterial;
  private readonly leaf: THREE.MeshStandardMaterial;
  private readonly leafLight: THREE.MeshStandardMaterial;
  private readonly bark: THREE.MeshStandardMaterial;
  private readonly flower: THREE.MeshStandardMaterial;
  private readonly metal: THREE.MeshStandardMaterial;
  private readonly poolWater: THREE.MeshStandardMaterial;
  private readonly island: THREE.MeshStandardMaterial;
  private readonly shoreline: THREE.MeshStandardMaterial;
  private readonly water: THREE.ShaderMaterial;
  private readonly waterTime: { value: number };
  private readonly authorableRoots: { id: string; root: THREE.Object3D }[] = [];
  private shrubCount = 0;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'arrival-garden';
    this.stone = this.mat(0x6d7880, 0.92);
    this.lawn = this.mat(0x183a37, 1);
    this.leaf = this.mat(0x183b3e, 0.94);
    this.leafLight = this.mat(0x296461, 0.96);
    this.bark = this.mat(0x263035, 1);
    this.flower = this.mat(0x3b9fc7, 0.72, 0.12);
    this.metal = this.mat(0x1c2b35, 0.5, 0.3);
    this.poolWater = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x24799b, roughness: 0.18, metalness: 0.28, transparent: true, opacity: 0.68,
    }));
    // Modest material separation preserves night without losing the land.
    this.island = this.mat(0x24453f, 0.96);
    // Stone/vegetation contrast is distinct from the new broken water foam.
    this.shoreline = this.mat(0x315761, 0.94);
    this.waterTime = { value: 0 };
    const waterUniforms = {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      time: this.waterTime,
      moonDirection: { value: NIGHT_MOON_DIRECTION.clone() },
    };
    this.water = this.scope.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: waterUniforms,
      vertexShader: /* glsl */ `
        uniform float time;
        uniform vec3 moonDirection;
        varying vec2 vLocalWater;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying float vWaveHeight;
        #include <fog_pars_vertex>

        void accumulateWave(
          inout float height,
          inout vec2 gradient,
          vec2 direction,
          float wavelength,
          float amplitude,
          vec2 samplePoint
        ) {
          float k = 6.28318530718 / wavelength;
          // Deep-water dispersion: longer waves travel faster instead of every
          // band sliding at an unrelated artistic speed.
          float omega = sqrt(9.81 * k);
          float phase = k * dot(direction, samplePoint) - omega * time;
          height += sin(phase) * amplitude;
          gradient += direction * (cos(phase) * amplitude * k);
        }

        void main() {
          vec3 p = position;
          vec2 samplePoint = p.xy;
          float height = 0.0;
          vec2 gradient = vec2(0.0);

          accumulateWave(height, gradient, vec2(0.940, 0.342), 78.0, 0.16, samplePoint);
          accumulateWave(height, gradient, vec2(-0.469, 0.883), 49.0, 0.095, samplePoint);
          accumulateWave(height, gradient, vec2(0.259, -0.966), 31.0, 0.052, samplePoint);
          accumulateWave(height, gradient, vec2(-0.819, -0.574), 21.0, 0.028, samplePoint);

          p.z += height;
          vec3 localNormal = normalize(vec3(-gradient, 1.0));
          vec4 worldPosition = modelMatrix * vec4(p, 1.0);
          vec4 mvPosition = viewMatrix * worldPosition;

          vLocalWater = samplePoint;
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
          vWaveHeight = height;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform vec3 moonDirection;
        varying vec2 vLocalWater;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying float vWaveHeight;
        #include <fog_pars_fragment>

        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 moonDir = normalize(moonDirection);

          float facing = max(dot(normal, viewDir), 0.0);
          float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
          vec3 halfDir = normalize(viewDir + moonDir);
          float moonSpecular = pow(max(dot(normal, halfDir), 0.0), 96.0);
          float broadSpecular = pow(max(dot(normal, halfDir), 0.0), 18.0);

          // Surf follows the actual polygonal coast geometry below, not an
          // unrelated ellipse that draws a detached ring across the ocean.
          float radius = length(vLocalWater);
          float crest = smoothstep(0.085, 0.19, vWaveHeight);
          // Keep four-wave dispersion and moon response; shift only the
          // night palette so top-down land/ocean separation survives.
          vec3 deep = vec3(0.008, 0.030, 0.060);
          vec3 skyReflection = vec3(0.040, 0.152, 0.235);
          vec3 foamColour = vec3(0.27, 0.60, 0.71);

          vec3 colour = mix(deep, skyReflection, 0.19 + fresnel * 0.65);
          colour += vec3(0.39, 0.63, 0.82) * broadSpecular * 0.070;
          colour += vec3(0.78, 0.90, 1.0) * moonSpecular * (0.24 + fresnel * 0.52);
          colour = mix(colour, foamColour, crest * 0.065);

          // Fade into atmospheric distance instead of exposing a hard disk edge.
          float outerFade = 1.0 - smoothstep(304.0, 329.0, radius);
          gl_FragColor = vec4(colour, (0.90 + fresnel * 0.075) * outerFade);
          #include <fog_fragment>
        }
      `,
    }));
  }

  build(): THREE.Group {
    this.buildIsland();
    const south = faceDirection('s');
    const nearZ = place(south, VESTIBULE_TO)[2];
    const farZ = place(south, VESTIBULE_TO + PLAZA_DEPTH)[2];
    const z0 = Math.min(nearZ, farZ);
    const z1 = Math.max(nearZ, farZ);
    const midZ = (z0 + z1) / 2;

    this.box('garden-main-walk', [0, GROUND_Y + 0.025, midZ], [5.4, 0.025, PLAZA_DEPTH / 2], this.stone);

    for (const side of [-1, 1]) {
      this.box(
        `garden-lawn-${side < 0 ? 'west' : 'east'}`,
        [side * 19, GROUND_Y + 0.035, midZ],
        [11.5, 0.035, PLAZA_DEPTH / 2 - 1.8],
        this.lawn,
      );
    }

    const trees: readonly Vec3[] = [
      [-27, GROUND_Y, z0 + 6], [27, GROUND_Y, z0 + 6],
      [-25, GROUND_Y, midZ + 5], [25, GROUND_Y, midZ + 5],
      [-29, GROUND_Y, z1 - 3], [29, GROUND_Y, z1 - 3],
    ];
    trees.forEach((p, i) => this.tree(p, 4.6 + (i % 2) * 0.6));

    for (const side of [-1, 1]) {
      for (const z of [z0 + 5, midZ, z1 - 5]) {
        this.shrub([side * 14.5, GROUND_Y, z], 1.45);
        this.shrub([side * 20.5, GROUND_Y, z + 2.2], 1.1);
      }
      for (const z of [z0 + 8, midZ + 3.5, z1 - 7]) {
        this.flowerCluster([side * 17.5, GROUND_Y, z]);
      }
    }

    this.bench([-10.5, GROUND_Y, midZ - 3], Math.PI / 2);
    this.bench([10.5, GROUND_Y, midZ + 4], -Math.PI / 2);
    this.fountain([18.5, GROUND_Y, midZ - 1]);
    this.arrivalMarker([-7.5, GROUND_Y, z1 - 4]);
    this.arrivalMarker([7.5, GROUND_Y, z1 - 4]);

    // Ceremonial approach: a restrained, mirrored amber rhythm and inlaid
    // paving guide the eye toward the entrance without blocking the route.
    // Visual-only meshes, no collision registrations or scene lights.
    this.buildCeremonialApproach(z0, z1);

    return this.group;
  }

  private buildCeremonialApproach(z0: number, z1: number): void {
    const amber = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffbc78, toneMapped: false,
    }));
    const bronze = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x8b6951, metalness: 0.58, roughness: 0.4,
    }));
    const reflection = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x52616a, metalness: 0.78, roughness: 0.23,
      transparent: true, opacity: 0.64, depthWrite: false,
    }));
    const stripGeometry = this.scope.track(new THREE.BoxGeometry(0.055, 0.016, 1));
    const pillarGeometry = this.scope.track(new THREE.BoxGeometry(1, 1, 1));
    const reflectionGeometry = this.scope.track(new THREE.PlaneGeometry(2.2, 1.55));
    const length = z1 - z0;

    // These 36 static visual objects used to cost up to 36 draw submissions.
    // Four InstancedMeshes keep the same world transforms and three materials
    // while reducing the maximum submission cost to four (before culling).
    // Neither instances nor their shared geometry own collision or lights.
    const strips = new THREE.InstancedMesh(stripGeometry, bronze, 2);
    strips.name = 'arrival-ceremonial-bronze-inlay';
    const panels = new THREE.InstancedMesh(reflectionGeometry, reflection, 18);
    panels.name = 'arrival-reflective-stone-inset';
    const pillars = new THREE.InstancedMesh(pillarGeometry, bronze, 8);
    pillars.name = 'arrival-ceremonial-obelisk';
    const crowns = new THREE.InstancedMesh(pillarGeometry, amber, 8);
    crowns.name = 'arrival-ceremonial-obelisk-crown';

    const transform = new THREE.Object3D();
    const set = (
      mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number,
      scaleX: number, scaleY: number, scaleZ: number, rotationX = 0,
    ): void => {
      transform.position.set(x, y, z);
      transform.rotation.set(rotationX, 0, 0);
      transform.scale.set(scaleX, scaleY, scaleZ);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    };

    for (const [index, side] of [-1, 1].entries()) {
      set(strips, index, side * 4.6, GROUND_Y + 0.056, (z0 + z1) / 2,
        1, 1, Math.max(0.5, length - 4));
    }

    // Shallow, non-colliding paving inserts, not a new reflection pass.
    for (let i = 0; i < 9; i++) {
      const z = z0 + (i + 0.5) * length / 9;
      for (const [sideIndex, side] of [-1, 1].entries()) {
        set(panels, i * 2 + sideIndex, side * 2.4, GROUND_Y + 0.052, z,
          1, 1, 1, -Math.PI / 2);
      }
    }

    // Paired obelisks remain outside the central 10.8-metre-wide walkway.
    for (let i = 0; i < 4; i++) {
      const z = z0 + (i + 0.65) * length / 4.6;
      for (const [sideIndex, side] of [-1, 1].entries()) {
        const index = i * 2 + sideIndex;
        const x = side * 11.8;
        set(pillars, index, x, GROUND_Y + 1.45, z, 0.5, 2.9, 0.5);
        set(crowns, index, x, GROUND_Y + 3.03, z, 0.58, 0.11, 0.58);
      }
    }

    for (const mesh of [strips, panels, pillars, crowns]) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      // InstancedMesh owns GPU instance buffers beyond the tracked geometry;
      // disposal must include the mesh itself, not only its shared resources.
      this.scope.trackObject(mesh);
    }
  }

  authorableSceneRoots(): readonly { readonly id: string; readonly root: THREE.Object3D }[] {
    return this.authorableRoots;
  }

  /** Water and shoreline are visual-only: the proven exterior ground and its
   * Sanctuary-trench cut-out remain the sole collision authority. */
  private buildIsland(): void {
    // Keep the economical annular ocean: its 164 m inner edge is INSIDE
    // every real shoreline segment (nearest coast is more than 178 m away).
    // A full disc adds GPU fill and cannot fix a nonexistent shoreline gap.
    const water = new THREE.Mesh(
      this.scope.track(new THREE.RingGeometry(164, 330, 124, 12)),
      this.water,
    );
    water.name = 'night-island-water';
    water.userData.visualRole = 'environment-water';
    water.userData.waveModel = 'deep-water-dispersion';
    water.rotation.x = -Math.PI / 2;
    // Four wave bands total <= 0.335 m. Keep crests below island Y=-0.5.
    water.position.y = GROUND_Y - 0.94;
    water.receiveShadow = false;
    this.group.add(water);

    const shape = new THREE.Shape();
    ISLAND_OUTLINE.forEach(([x, z], i) => i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z));
    shape.closePath();
    // The sheltered lagoon is absent from physical floor support. Give the
    // same exclusion to visible terrain instead of painting water over land.
    const lagoonCutout = new THREE.Path();
    LAGOON_OUTLINE.forEach(([x, z], i) => i === 0 ? lagoonCutout.moveTo(x, -z) : lagoonCutout.lineTo(x, -z));
    lagoonCutout.closePath();
    shape.holes.push(lagoonCutout);
    const island = new THREE.Mesh(
      this.scope.track(new THREE.ShapeGeometry(shape, 2)),
      this.island,
    );
    island.name = 'night-island-terrain';
    island.rotation.x = -Math.PI / 2;
    island.position.y = GROUND_Y - 0.5;
    island.receiveShadow = true;
    this.group.add(island);

    // Seal the ground's actual polygon edge as a shallow, faceted rock bank.
    // All bands share ISLAND_OUTLINE; no new walkable geometry or colliders.
    const cliffPositions: number[] = [];
    const fringePositions: number[] = [];
    const coastIndices: number[] = [];
    for (let i = 0; i < ISLAND_OUTLINE.length; i++) {
      const [ax, az] = ISLAND_OUTLINE[i];
      const [bx, bz] = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length];
      const offset = i * 4;
      // Slight outward lean joins ground to water instead of a hard cut edge.
      cliffPositions.push(
        ax, GROUND_Y - 0.49, az, bx, GROUND_Y - 0.49, bz,
        ax * 1.008, GROUND_Y - 1.55, az * 1.008,
        bx * 1.008, GROUND_Y - 1.55, bz * 1.008,
      );
      fringePositions.push(
        ax * 1.003, GROUND_Y - 0.65, az * 1.003,
        bx * 1.003, GROUND_Y - 0.65, bz * 1.003,
        ax * 1.025, GROUND_Y - 0.67, az * 1.025,
        bx * 1.025, GROUND_Y - 0.67, bz * 1.025,
      );
      coastIndices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2);
    }
    const bankGeometry = (positions: number[]): THREE.BufferGeometry => {
      const geometry = this.scope.track(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(coastIndices);
      geometry.computeVertexNormals();
      return geometry;
    };
    const bankMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x36535a, roughness: 0.98, metalness: 0, flatShading: true,
      side: THREE.DoubleSide,
    }));
    const cliff = new THREE.Mesh(bankGeometry(cliffPositions), bankMat);
    cliff.name = 'night-island-coastal-skirt';
    cliff.userData.visualRole = 'coast-edge-seal';
    this.group.add(cliff);

    // A muted intertidal fringe—not a luminous outline or a fake foam circle.
    const fringeMat = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0x749da7, transparent: true, opacity: 0.28,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: true,
    }));
    const fringe = new THREE.Mesh(bankGeometry(fringePositions), fringeMat);
    fringe.name = 'night-island-tidal-fringe';
    fringe.userData.visualRole = 'site-aligned-surf';
    fringe.renderOrder = 1;
    this.group.add(fringe);

    // Straight segments keep the perimeter line on the same site boundary as
    // the island, cliff, shoreline fringe, and collision site geometry.
    const shorelinePoints = ISLAND_OUTLINE.map(([x, z]) => new THREE.Vector3(x, GROUND_Y - 0.34, z));
    const shoreCurve = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < shorelinePoints.length; i++) {
      shoreCurve.add(new THREE.LineCurve3(shorelinePoints[i], shorelinePoints[(i + 1) % shorelinePoints.length]));
    }
    const shore = new THREE.Mesh(this.scope.track(new THREE.TubeGeometry(
      shoreCurve, 128, 0.30, 6, true,
    )), this.shoreline);
    shore.name = 'night-island-shoreline';
    shore.userData.visualRole = 'water-boundary';
    this.group.add(shore);

    // A single small, deterministic, indexed wash band follows the actual
    // authored island perimeter. Breaks and varied widths read as surf, not
    // a detached continuous neon circle. No animation, shaders or colliders.
    const washPositions: number[] = [];
    const washColors: number[] = [];
    const washIndices: number[] = [];
    const washPalette = [
      new THREE.Color(0x438595), new THREE.Color(0x58aabb), new THREE.Color(0x75c6d0),
    ];
    for (let edge = 0; edge < ISLAND_OUTLINE.length; edge++) {
      const [ax, az] = ISLAND_OUTLINE[edge];
      const [bx, bz] = ISLAND_OUTLINE[(edge + 1) % ISLAND_OUTLINE.length];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      if (length <= 0.01) continue;
      // The polygon has positive signed area in X/Z: right normal is sea.
      const nx = dz / length;
      const nz = -dx / length;
      const sections = Math.max(1, Math.ceil(length / 12));
      for (let section = 0; section < sections; section++) {
        if ((edge * 7 + section * 5) % 9 < 3) continue;
        const t0 = (section + 0.11) / sections;
        const t1 = (section + 0.80) / sections;
        const inner = 0.55 + ((edge + section) % 3) * 0.12;
        const outer = 2.05 + ((edge * 3 + section) % 4) * 0.25;
        const vertices = [[t0, inner], [t1, inner], [t0, outer], [t1, outer]] as const;
        const points = vertices.map(([t, dist]) => [ax + dx * t + nx * dist, az + dz * t + nz * dist] as const);
        if (points.some(([x, z]) => isSiteLand(x, z))) continue;
        const y = GROUND_Y - 0.69 - ((edge + section) % 3) * 0.014;
        const base = washPositions.length / 3;
        const colour = washPalette[(edge + section) % washPalette.length];
        for (const [x, z] of points) {
          washPositions.push(x, y, z);
          washColors.push(colour.r, colour.g, colour.b);
        }
        washIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const washGeometry = this.scope.track(new THREE.BufferGeometry());
    washGeometry.setAttribute('position', new THREE.Float32BufferAttribute(washPositions, 3));
    washGeometry.setAttribute('color', new THREE.Float32BufferAttribute(washColors, 3));
    washGeometry.setIndex(washIndices);
    washGeometry.computeVertexNormals();
    washGeometry.computeBoundingSphere();
    const coastalWash = new THREE.Mesh(washGeometry, this.scope.track(new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.46,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: true,
    })));
    coastalWash.name = 'night-island-broken-surf';
    coastalWash.userData.visualRole = 'broken-site-aligned-surf';
    coastalWash.renderOrder = 2;
    this.group.add(coastalWash);

    // Basin, rather than a translucent sticker: the carved opening reveals a
    // dark mineral bed through low, sheltered water. The exact same polygon
    // governs the hole, water, bed and stone bank (collision remains separate).
    const lagoonShape = new THREE.Shape();
    LAGOON_OUTLINE.forEach(([x, z], i) => i === 0 ? lagoonShape.moveTo(x, -z) : lagoonShape.lineTo(x, -z));
    lagoonShape.closePath();
    const lagoonGeometry = this.scope.track(new THREE.ShapeGeometry(lagoonShape, 2));
    const bedMaterial = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x123b4b, roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide,
    }));
    const bed = new THREE.Mesh(lagoonGeometry, bedMaterial);
    bed.name = 'east-lagoon-bed';
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = GROUND_Y - 1.7;
    bed.userData.visualRole = 'lagoon-mineral-bed';
    bed.receiveShadow = true;
    this.group.add(bed);

    // Basin-only material: the entrance fountain retains its existing water.
    const lagoonMaterial = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x2d91b8, roughness: 0.22, metalness: 0.16,
      emissive: 0x13435a, emissiveIntensity: 0.24,
      transparent: true, opacity: 0.76, depthWrite: false, side: THREE.DoubleSide,
    }));
    const lagoon = new THREE.Mesh(lagoonGeometry, lagoonMaterial);
    lagoon.name = 'east-sheltered-lagoon';
    lagoon.rotation.x = -Math.PI / 2;
    lagoon.position.y = GROUND_Y - 0.64;
    lagoon.userData.visualRole = 'enclosed-lagoon';
    this.group.add(lagoon);

    // The rock slope runs from the real ground edge to the lagoon bed.
    // All 12 segments are generated from LAGOON_OUTLINE, so no smoothed
    // spline can hang over a different shoreline or fill the cutout again.
    const centerX = LAGOON_OUTLINE.reduce((n, [x]) => n + x, 0) / LAGOON_OUTLINE.length;
    const centerZ = LAGOON_OUTLINE.reduce((n, [, z]) => n + z, 0) / LAGOON_OUTLINE.length;
    const wallPositions: number[] = [];
    const wallIndices: number[] = [];
    const bottomY = GROUND_Y - 1.7;
    for (let i = 0; i < LAGOON_OUTLINE.length; i++) {
      const [ax, az] = LAGOON_OUTLINE[i];
      const [bx, bz] = LAGOON_OUTLINE[(i + 1) % LAGOON_OUTLINE.length];
      const base = i * 4;
      wallPositions.push(
        ax, GROUND_Y - 0.5, az, bx, GROUND_Y - 0.5, bz,
        ax + (centerX - ax) * 0.055, bottomY, az + (centerZ - az) * 0.055,
        bx + (centerX - bx) * 0.055, bottomY, bz + (centerZ - bz) * 0.055,
      );
      wallIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    const wallGeometry = this.scope.track(new THREE.BufferGeometry());
    wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
    wallGeometry.setIndex(wallIndices);
    wallGeometry.computeVertexNormals();
    const wallMaterial = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x4b6b6f, roughness: 0.96, flatShading: true, side: THREE.DoubleSide,
    }));
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.name = 'east-lagoon-basin-wall';
    wall.userData.visualRole = 'lagoon-stone-slope';
    wall.receiveShadow = true;
    this.group.add(wall);

    // Keep the named original perimeter bank, but follow the literal outline.
    const lagoonCurve = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < LAGOON_OUTLINE.length; i++) {
      const [ax, az] = LAGOON_OUTLINE[i];
      const [bx, bz] = LAGOON_OUTLINE[(i + 1) % LAGOON_OUTLINE.length];
      lagoonCurve.add(new THREE.LineCurve3(
        new THREE.Vector3(ax, GROUND_Y - 0.36, az),
        new THREE.Vector3(bx, GROUND_Y - 0.36, bz),
      ));
    }
    const lagoonBank = new THREE.Mesh(this.scope.track(new THREE.TubeGeometry(
      lagoonCurve, 96, 0.58, 6, true,
    )), this.shoreline);
    lagoonBank.name = 'east-lagoon-rock-bank';
    this.group.add(lagoonBank);
  }

  /** Called from the existing variable-step loop. Reduced motion keeps the
   * water still; this visual-only animation never owns a frame loop. */
  /** Low tier draws opaque distant water, eliminating transparent overdraw. */
  setWaterQuality(tier: 'low' | 'medium' | 'high'): void {
    const transparent = tier !== 'low';
    if (this.water.transparent === transparent) return;
    this.water.transparent = transparent;
    this.water.depthWrite = !transparent;
    this.water.needsUpdate = true;
  }

  update(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) this.waterTime.value += Math.min(dt, 0.1);
  }

  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    return this.scope.track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }

  private box(name: string, center: Vec3, half: Vec3, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2)),
      material,
    );
    mesh.name = name;
    mesh.position.set(center[0], center[1], center[2]);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private tree([x, y, z]: Vec3, height: number): void {
    const trunkRadius = 0.48;
    const trunk = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.18, height, 10)),
      this.bark,
    );
    trunk.name = 'garden-tree-trunk';
    trunk.position.set(x, y + height / 2, z);
    trunk.castShadow = true;
    this.group.add(trunk);
    this.collision.addBox([x, y + height / 2, z], [0.58, height / 2, 0.58]);

    const crownGeo = this.scope.track(new THREE.IcosahedronGeometry(2.4, 1));
    const crown = new THREE.Mesh(crownGeo, this.leaf);
    crown.name = 'garden-tree-crown';
    crown.scale.set(1.25, 1.05, 1.1);
    crown.position.set(x, y + height + 1.25, z);
    crown.castShadow = true;
    this.group.add(crown);

    const crown2 = new THREE.Mesh(this.scope.track(new THREE.IcosahedronGeometry(1.65, 1)), this.leafLight);
    crown2.position.set(x + 1.15, y + height + 0.8, z - 0.55);
    crown2.castShadow = true;
    this.group.add(crown2);
  }

  private shrub([x, y, z]: Vec3, radius: number): void {
    const shrub = new THREE.Mesh(
      this.scope.track(new THREE.IcosahedronGeometry(radius, 1)),
      this.leafLight,
    );
    shrub.name = 'garden-shrub';
    shrub.scale.y = 0.72;
    shrub.position.set(x, y + radius * 0.62, z);
    shrub.castShadow = true;
    this.group.add(shrub);
    this.shrubCount++;
    if (this.shrubCount <= 6) {
      this.authorableRoots.push({
        id: `arrival-garden-shrub-${String(this.shrubCount).padStart(2, '0')}`,
        root: shrub,
      });
    }
  }

  private flowerCluster([x, y, z]: Vec3): void {
    for (const [dx, dz] of [[-0.7, -0.3], [0.15, 0.35], [0.7, -0.15], [-0.15, 0.75]] as const) {
      const stem = new THREE.Mesh(
        this.scope.track(new THREE.CylinderGeometry(0.035, 0.045, 0.62, 5)),
        this.leaf,
      );
      stem.position.set(x + dx, y + 0.31, z + dz);
      this.group.add(stem);
      const head = new THREE.Mesh(
        this.scope.track(new THREE.SphereGeometry(0.16, 7, 5)),
        this.flower,
      );
      head.position.set(x + dx, y + 0.68, z + dz);
      this.group.add(head);
    }
  }

  private bench([x, y, z]: Vec3, rotationY: number): void {
    const bench = new THREE.Group();
    bench.name = 'garden-bench';
    bench.position.set(x, y, z);
    bench.rotation.y = rotationY;
    this.group.add(bench);

    const seat = this.localBox(bench, [0, 0.55, 0], [2.2, 0.12, 0.55], this.metal);
    seat.castShadow = true;
    this.localBox(bench, [0, 1.18, 0.45], [2.2, 0.7, 0.12], this.metal);
    for (const sx of [-1.7, 1.7]) this.localBox(bench, [sx, 0.27, 0], [0.1, 0.27, 0.42], this.metal);

    const halfX = Math.abs(Math.cos(rotationY)) * 2.35 + Math.abs(Math.sin(rotationY)) * 0.7;
    const halfZ = Math.abs(Math.sin(rotationY)) * 2.35 + Math.abs(Math.cos(rotationY)) * 0.7;
    this.collision.addBox([x, y + 0.7, z], [halfX, 0.7, halfZ]);
  }

  private fountain([x, y, z]: Vec3): void {
    const base = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(3.1, 3.4, 0.55, 28)),
      this.stone,
    );
    base.name = 'garden-fountain';
    base.position.set(x, y + 0.28, z);
    base.castShadow = true;
    this.group.add(base);
    this.collision.addBox([x, y + 0.28, z], [3.4, 0.28, 3.4]);

    const pool = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(2.55, 2.55, 0.08, 28)),
      this.poolWater,
    );
    pool.position.set(x, y + 0.59, z);
    this.group.add(pool);

    const column = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.36, 0.58, 2.2, 12)),
      this.stone,
    );
    column.position.set(x, y + 1.55, z);
    this.group.add(column);
    const bowl = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(1.15, 0.85, 0.22, 18)),
      this.poolWater,
    );
    bowl.position.set(x, y + 2.6, z);
    this.group.add(bowl);
  }

  private arrivalMarker([x, y, z]: Vec3): void {
    const marker = this.box('garden-arrival-marker', [x, y + 1.3, z], [0.55, 1.3, 0.55], this.stone);
    marker.castShadow = true;
    const cap = new THREE.Mesh(
      this.scope.track(new THREE.SphereGeometry(0.32, 12, 8)),
      this.flower,
    );
    cap.position.set(x, y + 2.78, z);
    this.group.add(cap);
  }

  private localBox(
    parent: THREE.Object3D,
    center: Vec3,
    half: Vec3,
    material: THREE.Material,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2)),
      material,
    );
    mesh.position.set(center[0], center[1], center[2]);
    parent.add(mesh);
    return mesh;
  }
}
