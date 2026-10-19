import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { PLACEMENTS, WING_BY_ID, type ExhibitPlacement } from './layout';
import { resolveExhibitTheme } from './ExhibitTheme';
import { architecturalStoneFinish } from './SurfaceFinish';
import { radialFloorMask } from './RadialFloorMask';

/**
 * Small persistent colour fields inside all 35 exhibit bays.
 *
 * Threshold accents already tell visitors which exhibit they are entering. This
 * layer carries that language behind the hero object itself: a low floor field
 * and a real bay-back wall surface derived from the exhibit's existing project
 * metadata. It never alters an exhibit's hero object or collision footprint.
 */
export class ExhibitColorFields {
  readonly group = new THREE.Group();
  private readonly reliefs: { matrix: THREE.Matrix4; color: THREE.Color; wing: ExhibitPlacement['wing'] }[] = [];
  private reliefMesh: THREE.InstancedMesh | null = null;
  private readonly rims: { matrix: THREE.Matrix4; color: THREE.Color; wing: ExhibitPlacement['wing'] }[] = [];
  private rimMesh: THREE.InstancedMesh | null = null;
  private readonly pools: { matrix: THREE.Matrix4; color: THREE.Color; wing: ExhibitPlacement['wing'] }[] = [];
  private poolMesh: THREE.InstancedMesh | null = null;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'exhibit-color-fields';
  }

  build(): THREE.Group {
    for (const placement of PLACEMENTS) this.buildField(placement);
    this.buildReliefAccents();
    return this.group;
  }

  private buildField(placement: ExhibitPlacement): void {
    const wing = WING_BY_ID.get(placement.wing)!;
    const theme = resolveExhibitTheme(placement.exhibitId, placement.wing);
    const primary = this.material(theme.floor, 0.66, 0.08, 0.74, true);
    const wall = this.material(theme.wall, 0.78, 0.02, 0.9, true);
    const trim = this.material(theme.trim, 0.5, 0.16, 0.88);

    const field = new THREE.Group();
    field.name = `exhibit-color-field:${placement.exhibitId}`;
    field.userData.theme = theme.id;
    field.userData.themeSource = theme.source;
    this.group.add(field);

    const floor = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(2.35, 2.35, 0.035, 28)),
      primary,
    );
    floor.name = `exhibit-floor-field:${placement.exhibitId}`;
    floor.position.set(placement.anchor[0], wing.floorY + 0.035, placement.anchor[2]);
    floor.receiveShadow = true;
    field.add(floor);

    // The hall direction is perpendicular to the wing-facing hero orientation.
    // It locates this colour surface against the actual closed back wall, not
    // as a floating rectangle behind an installation.
    const towardHallX = placement.doorway[0] - placement.anchor[0];
    const towardHallZ = placement.doorway[2] - placement.anchor[2];
    const towardHallLength = Math.hypot(towardHallX, towardHallZ);
    const hallNormalX = towardHallX / towardHallLength;
    const hallNormalZ = towardHallZ / towardHallLength;
    const backDistance = wing.bayDepth / 2 - 0.12;
    const bx = placement.anchor[0] - hallNormalX * backDistance;
    const bz = placement.anchor[2] - hallNormalZ * backDistance;
    const width = wing.bayHalfAlong * 2 - 0.28;
    const height = wing.bayHeight - 0.5;
    const angle = Math.atan2(hallNormalX, hallNormalZ);

    const backdrop = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(width, height, 0.09)),
      wall,
    );
    backdrop.name = `exhibit-theme-wall:${placement.exhibitId}`;
    backdrop.position.set(bx, wing.floorY + height / 2 + 0.18, bz);
    backdrop.rotation.y = angle;
    backdrop.receiveShadow = true;
    field.add(backdrop);

    // The architectural frame makes the field read as a wall finish while the
    // hero object remains visually and lifecycle-independent.
    const rail = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(width + 0.28, 0.12, 0.13)),
      trim,
    );
    rail.name = `exhibit-theme-wall-header:${placement.exhibitId}`;
    rail.position.set(bx, wing.floorY + height + 0.22, bz);
    rail.rotation.y = angle;
    field.add(rail);

    // Art-directed, inset brass/colour witness marks are instanced across all
    // 35 bays in one material/draw. They frame the story without replacing or
    // attaching to any streamed hero exhibit.
    const pose = new THREE.Object3D();
    const color = new THREE.Color(theme.trim);
    for (const side of [-1, 1] as const) {
      const lateral = side * width * 0.37;
      for (const [localX, localY, scaleX, scaleY] of [
        [lateral, height * 0.71, 0.042, 1.18],
        [lateral - side * 0.38, height * 0.71 + 0.6, 0.76, 0.042],
      ]) {
        pose.position.set(
          bx + Math.cos(angle) * localX + hallNormalX * 0.12,
          wing.floorY + localY + 0.18,
          bz - Math.sin(angle) * localX + hallNormalZ * 0.12,
        );
        pose.rotation.set(0, angle, 0);
        pose.scale.set(scaleX, scaleY, 0.045);
        pose.updateMatrix();
        this.reliefs.push({ matrix: pose.matrix.clone(), color, wing: placement.wing });
      }
    }

    for (const side of [-1, 1] as const) {
      const upright = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(0.13, height + 0.15, 0.13)),
        trim,
      );
      upright.name = `exhibit-theme-wall-upright:${placement.exhibitId}`;
      upright.position.set(
        bx + Math.cos(angle) * (width / 2 + 0.02) * side,
        wing.floorY + height / 2 + 0.18,
        bz - Math.sin(angle) * (width / 2 + 0.02) * side,
      );
      upright.rotation.y = angle;
      field.add(upright);
    }

    // Inlaid metal boundary: a gallery stage, not a flat coloured placeholder.
    // Each room has one matrix, submitted in the same cullable instanced batch.
    const rimPose = new THREE.Object3D();
    rimPose.position.set(placement.anchor[0], wing.floorY + 0.066, placement.anchor[2]);
    rimPose.rotation.x = -Math.PI / 2;
    rimPose.updateMatrix();
    this.rims.push({
      matrix: rimPose.matrix.clone(),
      color: new THREE.Color(theme.trim),
      wing: placement.wing,
    });

    // A feathered wash on the same stage gives each authored hero a subtle
    // visual anchor. The wash is a projected floor colour, never a real light
    // or an additional interaction/collision surface.
    const poolPose = new THREE.Object3D();
    poolPose.position.set(placement.anchor[0], wing.floorY + 0.061, placement.anchor[2]);
    poolPose.rotation.x = -Math.PI / 2;
    poolPose.updateMatrix();
    this.pools.push({
      matrix: poolPose.matrix.clone(),
      color: new THREE.Color(theme.trim),
      wing: placement.wing,
    });
  }

  private buildReliefAccents(): void {
    // One batched draw, no per-frame animation, no emissive scene lights.
    const geom = this.scope.track(new THREE.BoxGeometry(1, 1, 1));
    const metal = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.48,
      depthWrite: false, toneMapped: false,
    }));
    const relief = this.scope.track(new THREE.InstancedMesh(geom, metal, this.reliefs.length));
    relief.name = 'gallery-relief-accents';
    relief.renderOrder = 2;
    for (let i = 0; i < this.reliefs.length; i++) {
      relief.setMatrixAt(i, this.reliefs[i].matrix);
      relief.setColorAt(i, this.reliefs[i].color);
    }
    relief.instanceMatrix.needsUpdate = true;
    relief.computeBoundingSphere();
    this.reliefMesh = relief;
    this.group.add(relief);

    const rimGeometry = this.scope.track(new THREE.RingGeometry(2.30, 2.39, 56));
    const rimMaterial = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.7,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    const rims = this.scope.track(new THREE.InstancedMesh(rimGeometry, rimMaterial, this.rims.length));
    rims.name = 'gallery-floor-inlaid-rims';
    rims.renderOrder = 2;
    for (let i = 0; i < this.rims.length; i++) {
      rims.setMatrixAt(i, this.rims[i].matrix);
      rims.setColorAt(i, this.rims[i].color);
    }
    rims.instanceMatrix.needsUpdate = true;
    rims.computeBoundingSphere();
    this.rimMesh = rims;
    this.group.add(rims);

    const washGeometry = this.scope.track(new THREE.PlaneGeometry(4.2, 4.2));
    const washMaterial = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0xffffff, alphaMap: radialFloorMask(this.scope),
      transparent: true, opacity: 0.20, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    const washes = this.scope.track(new THREE.InstancedMesh(washGeometry, washMaterial, this.pools.length));
    washes.name = 'gallery-curatorial-light-pools';
    washes.renderOrder = 1;
    for (let i = 0; i < this.pools.length; i++) {
      washes.setMatrixAt(i, this.pools[i].matrix);
      washes.setColorAt(i, this.pools[i].color);
    }
    washes.instanceMatrix.needsUpdate = true;
    washes.computeBoundingSphere();
    this.poolMesh = washes;
    this.group.add(washes);
  }

  /** Keep all three gallery batches within the exact same portal-culling set. */
  setVisibleWings(wings: ReadonlySet<string> | null): void {
    const relief = this.reliefMesh;
    const rims = this.rimMesh;
    const pools = this.poolMesh;
    if (!relief || !rims || !pools) return;
    if (!wings && relief.count === this.reliefs.length
      && rims.count === this.rims.length && pools.count === this.pools.length) return;
    const marks = wings ? this.reliefs.filter((item) => wings.has(item.wing)) : this.reliefs;
    const rings = wings ? this.rims.filter((item) => wings.has(item.wing)) : this.rims;
    const washes = wings ? this.pools.filter((item) => wings.has(item.wing)) : this.pools;
    for (let i = 0; i < marks.length; i++) {
      relief.setMatrixAt(i, marks[i].matrix);
      relief.setColorAt(i, marks[i].color);
    }
    relief.count = marks.length;
    relief.instanceMatrix.needsUpdate = true;
    if (relief.instanceColor) relief.instanceColor.needsUpdate = true;
    relief.computeBoundingSphere();
    for (let i = 0; i < rings.length; i++) {
      rims.setMatrixAt(i, rings[i].matrix);
      rims.setColorAt(i, rings[i].color);
    }
    rims.count = rings.length;
    rims.instanceMatrix.needsUpdate = true;
    if (rims.instanceColor) rims.instanceColor.needsUpdate = true;
    rims.computeBoundingSphere();
    for (let i = 0; i < washes.length; i++) {
      pools.setMatrixAt(i, washes[i].matrix);
      pools.setColorAt(i, washes[i].color);
    }
    pools.count = washes.length;
    pools.instanceMatrix.needsUpdate = true;
    if (pools.instanceColor) pools.instanceColor.needsUpdate = true;
    pools.computeBoundingSphere();
  }

  private material(color: number, roughness: number, metalness: number, opacity: number, mineral = false): THREE.MeshStandardMaterial {
    const finish = mineral ? architecturalStoneFinish(this.scope) : null;
    return this.scope.track(new THREE.MeshStandardMaterial({
      color, roughness, metalness, transparent: true, opacity, depthWrite: true,
      ...(finish ? { map: finish, roughnessMap: finish } : {}),
    }));
  }
}
