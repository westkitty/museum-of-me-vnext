import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { GROUND_Y, VESTIBULE_TO, faceDirection, place, type Vec3 } from './layout';

/**
 * Non-colliding architectural overlays that make the museum read as a deliberate
 * public building from the garden spawn. They reinforce the existing entrance
 * geometry without altering its doorway, collision, or canonical route.
 */
export class ExteriorIdentity {
  readonly group = new THREE.Group();

  private readonly stone: THREE.MeshStandardMaterial;
  private readonly warmStone: THREE.MeshStandardMaterial;
  private readonly azure: THREE.MeshStandardMaterial;
  private readonly beam: THREE.MeshBasicMaterial;
  private readonly glass: THREE.MeshStandardMaterial;
  private readonly bronze: THREE.MeshStandardMaterial;
  private readonly amber: THREE.MeshBasicMaterial;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'exterior-museum-identity';
    this.stone = this.mat(0x121820, 0.82, 0.16);
    this.warmStone = this.mat(0x0b1016, 0.78, 0.22);
    this.azure = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x56b8ed, emissive: 0x17658f, emissiveIntensity: 0.62, roughness: 0.34, metalness: 0.45,
    }));
    this.beam = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0x3bafff, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.glass = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x75c9ff,
      roughness: 0.16,
      metalness: 0,
      transparent: true,
      opacity: 0.48,
    }));
    this.bronze = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x936d4d, roughness: 0.36, metalness: 0.72,
      emissive: 0x392011, emissiveIntensity: 0.16,
    }));
    this.amber = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffc388, toneMapped: false,
    }));
  }

  build(): THREE.Group {
    const d = faceDirection('s');
    const z = place(d, VESTIBULE_TO + 0.72, 0, GROUND_Y)[2];

    // A monumental portico is layered behind the actual doorway. Every added
    // element is visual-only and leaves collision, navigation and the verified
    // vestibule aperture unchanged. The warm inlays act as architectural
    // illumination without consuming additional live-light/shadow budgets.
    this.buildMonumentalPortico(z);

    // A wider upper cornice gives the entrance a readable civic silhouette from
    // the far edge of the arrival garden.
    this.box('arrival-facade-cornice', [0, 10.9, z], [14.6, 0.38, 0.42], this.warmStone);
    this.box('arrival-facade-frieze', [0, 9.95, z + 0.06], [12.2, 0.52, 0.32], this.stone);

    // Tall pilasters extend the entrance composition beyond the immediate door
    // frame and visually anchor the two flanking window bays.
    for (const x of [-13.2, -9.1, 9.1, 13.2]) {
      this.box('arrival-facade-pilaster', [x, 5.0, z], [0.36, 5.0, 0.34], this.warmStone);
      const cap = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(1.2, 0.28, 0.88)),
        this.azure,
      );
      cap.position.set(x, 9.9, z + 0.04);
      this.group.add(cap);
    }

    // Four tall glazed panels make the facade feel open to the garden in bright
    // weather without cutting real openings into the validated wall geometry.
    for (const x of [-11.15, -7.2, 7.2, 11.15]) {
      const panel = this.box('arrival-facade-glazing', [x, 5.25, z + 0.38], [1.42, 3.05, 0.08], this.glass);
      panel.castShadow = false;
      const top = this.box('arrival-window-header', [x, 8.65, z + 0.4], [1.58, 0.14, 0.12], this.azure);
      top.castShadow = false;
    }

    // A restrained central crest crowns the entrance. It is abstract rather
    // than heraldic: a ring-and-axis form that echoes the Rotunda and dome.
    const crest = new THREE.Group();
    crest.name = 'arrival-facade-crest';
    crest.position.set(0, 12.2, z + 0.48);
    this.group.add(crest);

    const ring = new THREE.Mesh(
      this.scope.track(new THREE.TorusGeometry(1.2, 0.12, 8, 36)),
      this.azure,
    );
    ring.rotation.x = Math.PI / 2;
    crest.add(ring);
    this.localBox(crest, [0, 0, 0], [0.08, 1.55, 0.08], this.azure);
    this.localBox(crest, [0, 0, 0], [1.55, 0.08, 0.08], this.azure);

    // Low side plinths connect the architecture to the terrace and create a
    // finished edge without placing anything in the central approach corridor.
    for (const x of [-16.4, 16.4]) {
      this.box('arrival-side-plinth', [x, 0.7, z + 1.5], [2.0, 0.7, 1.35], this.warmStone);
      const urn = new THREE.Mesh(
        this.scope.track(new THREE.CylinderGeometry(0.48, 0.7, 0.9, 12)),
        this.stone,
      );
      urn.position.set(x, 1.85, z + 1.5);
      this.group.add(urn);
    }

    // Visible searchlight language is intentionally material-only. The two
    // translucent upward cones reinforce the actual bounded floodlights
    // without creating more shadow maps or point-light budget pressure.
    for (const x of [-19, 19]) {
      const base = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.42, 0.58, 0.48, 12)), this.azure);
      base.name = 'exterior-searchlight-emitter';
      base.position.set(x, 0.28, z + 3.6);
      this.group.add(base);
      const shaft = new THREE.Mesh(this.scope.track(new THREE.ConeGeometry(4.4, 25, 20, 1, true)), this.beam);
      shaft.name = 'exterior-searchlight-beam';
      shaft.position.set(x, 12.8, z + 3.6);
      shaft.rotation.x = Math.PI;
      this.group.add(shaft);
    }

    return this.group;
  }

  /** Architectural spectacle whose geometry never participates in collision. */
  private buildMonumentalPortico(z: number): void {
    // Two 18-metre towers establish the building's visual horizon at arrival.
    for (const side of [-1, 1]) {
      const x = side * 20.2;
      this.ornament('monumental-portal-tower', [x, 8.6, z - 0.35], [2.45, 8.6, 2.55], this.stone);
      this.ornament('monumental-portal-tower-cap', [x, 17.45, z - 0.2], [3.08, 0.6, 2.9], this.warmStone);
      this.ornament('monumental-portal-tower-reveal', [side * 17.68, 8.55, z + 1.08], [0.12, 7.2, 0.11], this.bronze);
      this.ornament('monumental-portal-warm-inlay', [side * 17.51, 7.85, z + 1.24], [0.045, 5.8, 0.05], this.amber);

      // Broad setbacks provide near-to-far architectural layers.
      this.ornament('monumental-wing-mass', [side * 28.3, 5.15, z - 2.6], [5.2, 5.15, 3.0], this.warmStone);
      this.ornament('monumental-wing-parapet', [side * 28.3, 10.65, z - 2.4], [5.5, 0.42, 3.2], this.stone);
      for (const offset of [-3.3, 0, 3.3]) {
        this.ornament('monumental-wing-pilaster', [side * 28.3 + offset, 5.0, z + 0.46],
          [0.34, 4.55, 0.35], this.bronze);
      }
    }

    // The large horizontal silhouette sits above the existing facade crest,
    // preserving the visual/physical identity of the actual entrance.
    this.ornament('monumental-portal-architrave', [0, 15.4, z - 0.1], [18.6, 0.82, 1.15], this.stone);
    this.ornament('monumental-portal-bronze-cornice', [0, 16.3, z + 0.62], [18.75, 0.09, 0.46], this.bronze);
    this.ornament('monumental-portal-amber-cornice', [0, 15.02, z + 1.02], [15.2, 0.035, 0.05], this.amber);

    // Pier rhythm emphasizes the scale of the passage without creating any
    // physical obstacle or extra window/light/interaction semantics.
    for (const side of [-1, 1]) {
      this.ornament('monumental-entrance-pier', [side * 7.0, 7.0, z + 0.56],
        [0.65, 6.85, 0.55], this.warmStone);
      this.ornament('monumental-entrance-pier-glint', [side * 7.72, 7.0, z + 0.82],
        [0.05, 6.2, 0.06], this.amber);
    }
  }

  private ornament(name: string, center: Vec3, half: Vec3, material: THREE.Material): void {
    const mesh = this.box(name, center, half, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private localBox(parent: THREE.Object3D, center: Vec3, half: Vec3, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2)),
      material,
    );
    mesh.position.set(center[0], center[1], center[2]);
    parent.add(mesh);
    return mesh;
  }
}
