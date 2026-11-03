import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { CollisionWorld } from '../CollisionWorld';
import { ENTRANCE_PORTAL_Z, PLAZA_HALF_WIDTH, VESTIBULE_TO, type Vec3 } from '../layout';

/** Compact, exterior-only museum massing in a single local building frame. */
export class ExteriorMuseumShell {
  readonly group = new THREE.Group();

  constructor(private readonly scope: ResourceScope, private readonly collision: CollisionWorld) {
    this.group.name = 'exterior-museum-shell';
  }

  build(): THREE.Group {
    const g = this.group;
    const material = (color: number, roughness = 0.75, metalness = 0.15) =>
      this.scope.track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    const roof = material(0x0c1017, 0.72, 0.28);
    const rib = material(0x18202c, 0.55, 0.35);
    const spine = material(0x161e2b, 0.78, 0.2);
    const trim = material(0x222a3a, 0.62, 0.3);
    const wall = material(0x171b27, 0.82, 0.12);
    const gold = material(0xd4af37, 0.35, 0.8);
    const stone = material(0x232b35, 0.9, 0.05);
    const glass = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x1d7888, emissive: 0x0d4a55, emissiveIntensity: 0.65,
      roughness: 0.22, metalness: 0.12, transparent: true, opacity: 0.88, depthWrite: false,
      side: THREE.DoubleSide,
    }));
    const amber = this.scope.track(new THREE.MeshBasicMaterial({ color: 0xffb86c, toneMapped: false }));
    const cyan = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x40c4d8, toneMapped: false }));
    const jewelMat = this.scope.track(new THREE.MeshBasicMaterial({ color: 0x4de3f7, toneMapped: false }));
    // Match the roof eaves to the side walls and the rear elevation.
    const roofWidth = 25;
    const roofRise = 8.5;
    const roofLength = 210;
    const roofHalfLength = roofLength / 2;

    const box = (name: string, size: Vec3, pos: Vec3, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(...size)), mat);
      mesh.name = name;
      mesh.position.set(...pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    const cylinder = (name: string, radiusTop: number, radiusBottom: number, height: number,
      pos: Vec3, mat: THREE.Material, segments = 32) => {
      const mesh = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)), mat);
      mesh.name = name;
      mesh.position.set(...pos);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };

    // Structural spine and side elevations.
    box('museum-central-spine', [26, 11.5, 210], [0, 5.75, 0], spine);
    box('spine-east-trim', [0.55, 0.55, 210], [13.1, 10.9, 0], trim);
    box('spine-west-trim', [0.55, 0.55, 210], [-13.1, 10.9, 0], trim);
    for (const side of [-1, 1]) {
      box(`side-facade-${side}`, [1.6, 9.5, roofLength], [side * 38, 4.75, 0], wall);
      box(`amber-window-ribbon-${side}`, [0.08, 1.4, 192], [side * 37.16, 5.5, 0], amber);
      box(`cyan-window-sill-${side}`, [0.12, 0.12, 192], [side * 37.05, 4.72, 0], cyan);
    }

    // Barrel vault roof wings: a sampled arch profile extruded along the full Z length.
    for (const side of [-1, 1]) {
      const x0 = side * 25.5;
      const geo = this.barrelGeometry(roofWidth, roofRise, roofLength);
      const shell = new THREE.Mesh(this.scope.track(geo), roof);
      shell.name = `curved-roof-wing-${side < 0 ? 'west' : 'east'}`;
      shell.position.set(x0, 9.5, 0);
      shell.castShadow = true;
      shell.receiveShadow = true;
      g.add(shell);
      // Twelve crosswise raised seams per wing, shared geometry/material.
      const seamGeo = this.scope.track(this.barrelRibGeometry(roofWidth + 0.18, roofRise + 0.08));
      for (let z = -100; z <= 100; z += 10) {
        const seam = new THREE.Mesh(seamGeo, rib);
        seam.name = `roof-seam-${side}-${z}`;
        seam.position.set(x0, 9.5, z);
        g.add(seam);
      }
      // Rounded endcaps close the barrel ends.
      const endGeo = this.scope.track(this.barrelEndGeometry(roofWidth, roofRise));
      for (const z of [-roofHalfLength + 0.3, roofHalfLength - 0.3]) {
        const end = new THREE.Mesh(endGeo, trim);
        end.name = `roof-rounded-end-${side}-${z}`;
        end.position.set(x0, 9.5, z);
        // ShapeGeometry faces +Z; turn the north cap toward -Z.
        end.rotation.y = z < 0 ? Math.PI : 0;
        g.add(end);
      }
    }

    // Join the front of the roof wings (Z = 105) to the entrance facade
    // (Z = 128). The former 23-metre open gap exposed the back of the
    // portal as an isolated wall. Keep the central entry route clear.
    const entryLength = ENTRANCE_PORTAL_Z - roofHalfLength;
    const entryMidZ = (ENTRANCE_PORTAL_Z + roofHalfLength) / 2;
    box('entrance-connector-roof', [40, 0.8, entryLength + 0.7], [0, 11.6, entryMidZ], roof);
    for (const side of [-1, 1]) {
      const x = side * 19.55;
      box(`entrance-connector-wall-${side}`, [0.9, 11.5, entryLength + 0.7], [x, 5.75, entryMidZ], wall);
      this.collision.addBox([x, 5.75, entryMidZ], [0.45, 5.75, (entryLength + 0.7) / 2]);
      box(`south-wing-return-${side}`, [18.5, 9.5, 0.9], [side * 28.75, 4.75, roofHalfLength], wall);
      this.collision.addBox([side * 28.75, 4.75, roofHalfLength], [9.25, 4.75, 0.45]);
    }

    // Low rounded entry volume, portal frame and axial occlusion.
    const portico = new THREE.Mesh(this.scope.track(new THREE.TorusGeometry(9, 0.38, 10, 48, Math.PI)), gold);
    portico.name = 'south-rounded-glazed-portico';
    // The portal's visible arch belongs on the south face, not 22 m behind it.
    portico.position.set(0, 0, ENTRANCE_PORTAL_Z + 0.85);
    g.add(portico);
    const halfDoor = 3.5;
    box('portal-left-bronze-jamb', [0.45, 5.2, 0.55], [-halfDoor - 0.225, 2.6, ENTRANCE_PORTAL_Z], gold);
    box('portal-right-bronze-jamb', [0.45, 5.2, 0.55], [halfDoor + 0.225, 2.6, ENTRANCE_PORTAL_Z], gold);
    box('portal-bronze-lintel', [7.45, 0.45, 0.55], [0, 5.43, ENTRANCE_PORTAL_Z], gold);
    // Facade remains opaque outside the 7 m portal aperture.
    box('south-facade-left', [PLAZA_HALF_WIDTH - halfDoor, 12, 0.7], [-(PLAZA_HALF_WIDTH + halfDoor) / 2, 6, 128], wall);
    box('south-facade-right', [PLAZA_HALF_WIDTH - halfDoor, 12, 0.7], [(PLAZA_HALF_WIDTH + halfDoor) / 2, 6, 128], wall);
    box('north-rear-elevation', [76, 11.5, 1.4], [0, 5.75, -105], spine);
    for (const x of [-29, -18, 18, 29]) {
      box(`north-amber-slit-${x}`, [0.7, 7, 0.12], [x, 5.2, -104.2], amber);
    }

    // Turquoise radial dome, segmented into meridian ribs and a luminous spring ring.
    const dome = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), glass);
    dome.name = 'central-turquoise-dome-glazing';
    dome.position.set(0, 11.5, 0);
    g.add(dome);
    const ring = new THREE.Mesh(this.scope.track(new THREE.TorusGeometry(15, 0.22, 8, 64)), cyan);
    ring.name = 'dome-inner-glow-ring';
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 11.5, 0);
    g.add(ring);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 24; j++) {
        const t = (j / 24) * Math.PI / 2;
        // Equator at the spring line, pole at the apex: the exact glass hemisphere.
        points.push(new THREE.Vector3(15 * Math.cos(t) * Math.cos(a), 11.5 + 15 * Math.sin(t), 15 * Math.cos(t) * Math.sin(a)));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const meridian = new THREE.Mesh(this.scope.track(new THREE.TubeGeometry(curve, 24, 0.12, 6, false)), gold);
      meridian.name = `dome-gold-rib-${i + 1}`;
      g.add(meridian);
    }
    cylinder('dome-apex-finial', 0.22, 0.55, 4.25, [0, 26.375, 0], gold, 12);
    const jewel = new THREE.Mesh(this.scope.track(new THREE.IcosahedronGeometry(0.65, 1)), jewelMat);
    jewel.name = 'dome-cyan-jewel-tip';
    jewel.position.set(0, 28.3, 0);
    g.add(jewel);

    // Raised pale-stone terrace, paired planter courts and broad formal stair run.
    box('raised-stone-terrace', [40, 0.5, 30], [0, -0.25, VESTIBULE_TO + 15], stone);
    for (const side of [-1, 1]) {
      box(`terrace-balustrade-${side}`, [0.55, 0.8, 30], [side * 20, 0.4, VESTIBULE_TO + 15], trim);
      const px = side * 14;
      box(`topiary-planter-court-${side}`, [5, 0.65, 5], [px, 0.3, 143], trim);
      const shrub = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(3.8, 2.2, 3.8)), material(0x14281a, 0.96, 0));
      shrub.name = `sculpted-boxwood-${side}`;
      shrub.position.set(px, 1.72, 143);
      g.add(shrub);
    }
    // Six visible treads plus an unobstructed central accessible ramp.
    for (let i = 0; i < 6; i++) {
      const z = 158 + (i + 0.5) * 1;
      const y = -((i + 1) / 6) * 0.5;
      box(`formal-stair-tread-${i + 1}`, [24, 0.12, 1.02], [0, y, z], stone);
    }
    this.collision.add({
      kind: 'ramp', minX: -12, maxX: 12, minZ: 158, maxZ: 164,
      axis: 'z', yAtMin: 0, yAtMax: -0.5,
    });

    // Collision follows the reachable perimeter and leaves the full portal axis clear.
    this.collision.addBox([38, 4.75, 0], [0.8, 4.75, 98]);
    this.collision.addBox([-38, 4.75, 0], [0.8, 4.75, 98]);
    this.collision.addBox([0, 5.75, -105], [38, 5.75, 0.7]);
    this.collision.addBox([-(PLAZA_HALF_WIDTH + halfDoor) / 2, 6, 128], [(PLAZA_HALF_WIDTH - halfDoor) / 2, 6, 0.35]);
    this.collision.addBox([(PLAZA_HALF_WIDTH + halfDoor) / 2, 6, 128], [(PLAZA_HALF_WIDTH - halfDoor) / 2, 6, 0.35]);
    return g;
  }

  private barrelGeometry(width: number, rise: number, length: number): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const nx = 32;
    const nz = 20;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const z = -length / 2 + length * iz / nz;
      for (let ix = 0; ix <= nx; ix++) {
        const u = -1 + 2 * ix / nx;
        positions.push(u * width / 2, rise * Math.sqrt(Math.max(0, 1 - u * u)), z);
      }
    }
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const a = iz * (nx + 1) + ix;
      indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private barrelRibGeometry(width: number, rise: number): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const u = -1 + 2 * i / 32;
      points.push(new THREE.Vector3(u * width / 2, rise * Math.sqrt(Math.max(0, 1 - u * u)), 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.09, 5, false);
  }

  private barrelEndGeometry(width: number, rise: number): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    for (let i = 0; i <= 32; i++) {
      const u = -1 + 2 * i / 32;
      shape.lineTo(u * width / 2, rise * Math.sqrt(Math.max(0, 1 - u * u)));
    }
    shape.lineTo(width / 2, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 32);
  }
}
