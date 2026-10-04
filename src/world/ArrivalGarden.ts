import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import {
  GROUND_Y, PLAZA_DEPTH, VESTIBULE_TO,
  faceDirection, place, type Vec3,
} from './layout';

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
    this.island = this.mat(0x142d2f, 0.96);
    // The shoreline is the distant water boundary, not a luminous outline.
    this.shoreline = this.mat(0x183238, 0.98);
    this.waterTime = { value: 0 };
    this.water = this.scope.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { time: this.waterTime },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        uniform float time;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = smoothstep(0.0, 1.0, fract(p));
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        void main() {
          vUv = uv;
          vec3 p = position;
          float broad = noise(p.xy * 0.038 + vec2(time * 0.012, -time * 0.009));
          float cross = noise(p.xy * 0.081 + vec2(-time * 0.016, time * 0.013));
          p.z += (broad - 0.5) * 0.18 + (cross - 0.5) * 0.045;
          vec4 worldPosition = modelMatrix * vec4(p, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        uniform float time;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(41.7, 289.3))) * 19341.173);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = smoothstep(0.0, 1.0, fract(p));
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float value = 0.0;
          value += noise(p) * 0.58;
          value += noise(p * 2.03 + 17.0) * 0.27;
          value += noise(p * 4.11 - 9.0) * 0.15;
          return value;
        }
        void main() {
          vec2 flow = vUv * vec2(5.2, 3.4) + vec2(time * 0.012, -time * 0.009);
          float broad = fbm(flow);
          float cross = fbm(vUv * vec2(11.0, 7.0) + vec2(-time * 0.018, time * 0.014));
          float field = broad * 0.78 + cross * 0.22;
          float sheen = smoothstep(0.66, 0.86, field);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - clamp(abs(viewDir.y), 0.0, 1.0), 3.0);
          float waveA = sin((vUv.x * 13.0 + vUv.y * 7.0) * 6.283 + time * 0.22);
          float waveB = cos((vUv.x * 5.0 - vUv.y * 11.0) * 6.283 - time * 0.17);
          float glint = smoothstep(0.72, 0.96, waveA * waveB * 0.5 + 0.5) * sheen;
          vec3 deep = vec3(0.006, 0.018, 0.032);
          vec3 reflectedSky = vec3(0.028, 0.092, 0.135);
          vec3 horizonFlash = vec3(0.16, 0.34, 0.44);
          vec3 colour = mix(deep, reflectedSky, broad * 0.52 + fresnel * 0.34);
          colour += vec3(0.026, 0.082, 0.12) * sheen;
          colour += vec3(0.018, 0.052, 0.074) * smoothstep(0.76, 0.96, cross) * 0.35;
          colour += horizonFlash * glint * (0.08 + fresnel * 0.22);
          gl_FragColor = vec4(colour, 0.94);
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

    return this.group;
  }

  authorableSceneRoots(): readonly { readonly id: string; readonly root: THREE.Object3D }[] {
    return this.authorableRoots;
  }

  /** Water and shoreline are visual-only: the proven exterior ground and its
   * Sanctuary-trench cut-out remain the sole collision authority. */
  private buildIsland(): void {
    const water = new THREE.Mesh(this.scope.track(new THREE.CircleGeometry(330, 96)), this.water);
    water.name = 'night-island-water';
    water.rotation.x = -Math.PI / 2;
    water.position.y = GROUND_Y - 0.46;
    water.receiveShadow = false;
    this.group.add(water);

    const shape = new THREE.Shape();
    const radii = [126, 133, 121, 136, 127, 142, 132, 124, 138, 128, 143, 129, 137, 123, 132, 126];
    radii.forEach((radius, i) => {
      const angle = (i / radii.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.86;
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });
    shape.closePath();
    const island = new THREE.Mesh(
      this.scope.track(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false })),
      this.island,
    );
    island.name = 'night-island-terrain';
    island.rotation.x = -Math.PI / 2;
    island.position.y = GROUND_Y - 0.5;
    island.receiveShadow = true;
    this.group.add(island);

    const shore = new THREE.Mesh(this.scope.track(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(radii.map((radius, i) => {
        const angle = (i / radii.length) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * radius, GROUND_Y - 0.36, Math.sin(angle) * radius * 0.86);
      }), true, 'catmullrom', 0.2),
      96, 0.32, 6, true,
    )), this.shoreline);
    shore.name = 'night-island-shoreline';
    shore.userData.visualRole = 'water-boundary';
    this.group.add(shore);
  }

  /** Called from the existing variable-step loop. Reduced motion keeps the
   * water still; this visual-only animation never owns a frame loop. */
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
