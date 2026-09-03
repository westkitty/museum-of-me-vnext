import * as THREE from 'three';
import { GeometryKit } from './GeometryKit';
import { PaletteSet } from './palette';
import { CollisionWorld } from './CollisionWorld';
import { Detailing } from './Detailing';
import { mergeStatic, type MergeReport } from './MergeStatic';
import type { ResourceScope } from '../assets/ResourceScope';
import {
  ROTUNDA_APOTHEM, ROTUNDA_WALL, LEVEL_1_Y, BALCONY_INNER_APOTHEM,
  DOME_SPRING_Y, DOME_APEX_Y, GROUND_Y,
  OCTAGON_FACES, faceDirection, rightOf, place, add, stairArcPoint,
  WINGS, type WingSpec, type OctagonFace, type Vec3,
  SOUTH, VESTIBULE_FROM, VESTIBULE_TO, PLAZA_DEPTH, PLAZA_HALF_WIDTH,
  SANCTUARY_DIR, SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, SANCTUARY_FLOOR_Y,
  SANCTUARY_RAMP_HALF_WIDTH, SANCTUARY_RADIUS, SANCTUARY_HEIGHT, SANCTUARY_CENTER,
  STAIRS, PLACEMENTS, FLIGHT_PAD_CENTER, FLIGHT_PAD_RADIUS, PLINTH_RADIUS, PLINTH_HEIGHT, PLINTH_TOP_Y,
  PLINTH_FLOOR_HALF,
} from './layout';

/** Circumradius of the octagon whose apothem is `a`. */
const circum = (a: number) => a / Math.cos(Math.PI / 8);
/** Side length of the octagon whose apothem is `a`. */
const side = (a: number) => 2 * a * Math.tan(Math.PI / 8);

/** The two endpoints of an octagon face, at the given apothem. */
function faceEnds(face: OctagonFace, apothem: number): [Vec3, Vec3] {
  const d = faceDirection(face);
  const r = rightOf(d);
  const half = side(apothem) / 2;
  const mid = place(d, apothem);
  return [
    [mid[0] - r[0] * half, 0, mid[2] - r[2] * half],
    [mid[0] + r[0] * half, 0, mid[2] + r[2] * half],
  ];
}

export interface MuseumBuildResult {
  readonly root: THREE.Group;
  /** What the static-geometry merge saved, for diagnostics. */
  readonly merge: MergeReport;
  readonly collision: CollisionWorld;
  /** One group per exhibit bay: where exhibit modules mount their contents. */
  readonly exhibitMounts: ReadonlyMap<string, THREE.Group>;
  /** Streaming groups, keyed by zone, for Layer-2 detail. */
  readonly zoneGroups: ReadonlyMap<string, THREE.Group>;
}

/**
 * Builds the entire museum: exterior, plaza, entrance, Rotunda, all six wings,
 * mezzanine, stairs, the Dexter Sanctuary, and all 35 exhibit volumes.
 *
 * Phase 2 builds this as a deliberately plain graybox. Phase 6 replaces the
 * materials and adds architectural detail without moving a single wall, because
 * every dimension comes from `layout.ts`.
 */
export class Museum {
  readonly root = new THREE.Group();
  readonly collision = new CollisionWorld();
  readonly exhibitMounts = new Map<string, THREE.Group>();
  readonly zoneGroups = new Map<string, THREE.Group>();

  private readonly kit: GeometryKit;
  private readonly pal: PaletteSet;

  constructor(private readonly scope: ResourceScope) {
    this.root.name = 'museum-building';
    this.pal = new PaletteSet(scope);
    this.kit = new GeometryKit(scope, this.collision, this.root);
  }

  build(): MuseumBuildResult {
    this.buildExterior();
    this.buildRotunda();
    this.buildBalcony();
    this.buildStairs();
    for (const w of WINGS) this.buildWing(w);
    this.buildEntrance();
    this.buildSanctuary();

    // Production dressing on geometry that is already proven traversable.
    // Nothing here moves a wall, so every traversal test stays valid.
    new Detailing(this.scope, this.pal).applyAll(this.zoneGroups);

    // Collapse the static architecture into one mesh per material. Collision
    // was already recorded during construction, so this changes only how the
    // building is drawn, never where its walls are.
    const merge = mergeStatic(this.root, this.scope);

    return {
      root: this.root,
      collision: this.collision,
      exhibitMounts: this.exhibitMounts,
      zoneGroups: this.zoneGroups,
      merge,
    };
  }

  private zoneGroup(id: string): THREE.Group {
    let g = this.zoneGroups.get(id);
    if (!g) {
      g = new THREE.Group();
      g.name = `zone:${id}`;
      this.root.add(g);
      this.zoneGroups.set(id, g);
    }
    return g;
  }

  // ── Exterior and arrival ─────────────────────────────────────────────────

  /**
   * Exterior ground collision, with the Dexter Sanctuary's ramp trench left as
   * a genuine open cut.
   *
   * The ground plane sits at GROUND_Y - 0.5 and `supportHeight` stands the
   * visitor on the HIGHEST surface at or below their step-up. A single ground
   * rect across the whole site therefore sat on top of the descending sanctuary
   * ramp: the visitor walked over the trench at -0.5 and the Sanctuary could
   * not be reached on foot at all. The ground mesh is unchanged — a one-sided
   * plane is invisible from inside the chamber below it — but the collider now
   * omits the trench, so the ramp is the only thing to stand on there.
   */
  private addExteriorGroundCollision(): void {
    this.addFloorClearOfSanctuaryRamp(-300, 300, -300, 300, GROUND_Y - 0.5);
  }

  /**
   * Add a floor rect that stops short of the sanctuary ramp trench, so nothing
   * roofs the descent. Used for both the exterior ground and the rotunda slab,
   * whose generous square otherwise overhung the ramp mouth.
   */
  private addFloorClearOfSanctuaryRamp(
    rectMinX: number, rectMaxX: number, rectMinZ: number, rectMaxZ: number, y: number,
  ): void {
    const d = SANCTUARY_DIR;
    const r = rightOf(d);
    // Conservative trench envelope in (along, lateral) ramp coordinates.
    // The cut begins exactly where the ramp begins. Starting it any earlier
    // would punch a hole in the rotunda floor before there is a ramp to land on.
    const alongMin = SANCTUARY_RAMP_FROM;
    const alongMax = SANCTUARY_RAMP_TO + 2;
    const latMax = SANCTUARY_RAMP_HALF_WIDTH + 1.2;

    // World-space bounds of that envelope, so the cut-out stays local.
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (const a of [alongMin, alongMax]) {
      for (const l of [-latMax, latMax]) {
        const x = d[0] * a + r[0] * l;
        const z = d[2] * a + r[2] * l;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
    }
    minX = Math.floor(minX) - 1; maxX = Math.ceil(maxX) + 1;
    minZ = Math.floor(minZ) - 1; maxZ = Math.ceil(maxZ) + 1;

    // Clamp the cut-out to the rect being added.
    minX = Math.max(minX, rectMinX); maxX = Math.min(maxX, rectMaxX);
    minZ = Math.max(minZ, rectMinZ); maxZ = Math.min(maxZ, rectMaxZ);
    if (minX >= maxX || minZ >= maxZ) {
      this.collision.addFloor(rectMinX, rectMaxX, rectMinZ, rectMaxZ, y);
      return;
    }

    // Everything outside the cut-out's bounding box, in four slabs.
    if (rectMinX < minX) this.collision.addFloor(rectMinX, minX, rectMinZ, rectMaxZ, y);
    if (maxX < rectMaxX) this.collision.addFloor(maxX, rectMaxX, rectMinZ, rectMaxZ, y);
    if (rectMinZ < minZ) this.collision.addFloor(minX, maxX, rectMinZ, minZ, y);
    if (maxZ < rectMaxZ) this.collision.addFloor(minX, maxX, maxZ, rectMaxZ, y);

    // Inside the box, tile the ground and drop only the tiles the trench
    // actually crosses. The chamber itself keeps its ground cover: it is
    // underground, and from the sanctuary floor the plane is already above the
    // visitor's step-up so it can never lift them.
    const step = 2;
    const inv = 1 / (d[0] * r[2] - d[2] * r[0]);
    for (let x = minX; x < maxX; x += step) {
      for (let z = minZ; z < maxZ; z += step) {
        const x1 = Math.min(x + step, maxX);
        const z1 = Math.min(z + step, maxZ);
        let aMin = Infinity; let aMax = -Infinity; let lMin = Infinity; let lMax = -Infinity;
        for (const cx of [x, x1]) {
          for (const cz of [z, z1]) {
            // Invert [d r] to recover (along, lateral) for this corner.
            const a = (cx * r[2] - cz * r[0]) * inv;
            const l = (cz * d[0] - cx * d[2]) * inv;
            aMin = Math.min(aMin, a); aMax = Math.max(aMax, a);
            lMin = Math.min(lMin, l); lMax = Math.max(lMax, l);
          }
        }
        // Remove only tiles that begin at or beyond the ramp start, so the
        // cut can never open a hole in the floor before there is a ramp to
        // land on. Laterally the test stays conservative, which clears the
        // full width of the corridor.
        const crossesTrench = aMin >= alongMin && aMin <= alongMax
          && lMax >= -latMax && lMin <= latMax;
        if (crossesTrench) continue;
        this.collision.addFloor(x, x1, z, z1, y);
      }
    }
  }

  private buildExterior(): void {
    const p = this.pal.get('plaza');
    const dir = faceDirection('s');

    // Ground plane wide enough that the building reads as sited, not floating.
    const groundGeo = this.scope.track(new THREE.PlaneGeometry(600, 600));
    const ground = new THREE.Mesh(groundGeo, p.floor);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y - 0.5;
    ground.receiveShadow = true;
    this.root.add(ground);
    this.addExteriorGroundCollision();

    // Arrival plaza: a raised terrace in front of the entrance.
    const plazaNear = VESTIBULE_TO;
    const plazaFar = VESTIBULE_TO + PLAZA_DEPTH;
    const nearZ = place(dir, plazaNear)[2];
    const farZ = place(dir, plazaFar)[2];
    this.kit.slab(-PLAZA_HALF_WIDTH, PLAZA_HALF_WIDTH, Math.min(nearZ, farZ), Math.max(nearZ, farZ), GROUND_Y, 0.5, p.floor);

    // Steps down from the plaza to the ground, so the entry has a real threshold.
    this.kit.stair(
      [0, 0, Math.max(nearZ, farZ)],
      [0, 0, Math.max(nearZ, farZ) + 6],
      GROUND_Y, GROUND_Y - 0.5, 12, 4, p.trim,
    );

    // Low parapets flanking the plaza — never fully enclosing it.
    for (const s of [-1, 1]) {
      this.kit.box(
        [s * PLAZA_HALF_WIDTH, GROUND_Y + 0.6, (Math.min(nearZ, farZ) + Math.max(nearZ, farZ)) / 2],
        [0.6, 0.6, PLAZA_DEPTH / 2],
        p.trim,
      );
    }
  }

  // ── Rotunda ──────────────────────────────────────────────────────────────

  private buildRotunda(): void {
    const g = this.zoneGroup('rotunda');
    const p = this.pal.get('rotunda');
    const kit = new GeometryKit(this.scope, this.collision, g);

    // Octagonal floor.
    const floorShape = octagonShape(circum(ROTUNDA_APOTHEM));
    const floorGeo = this.scope.track(new THREE.ExtrudeGeometry(floorShape, { depth: 0.6, bevelEnabled: false }));
    const floor = new THREE.Mesh(floorGeo, p.floor);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = GROUND_Y;
    floor.receiveShadow = true;
    g.add(floor);
    // The rotunda slab is deliberately generous, which used to leave it
    // overhanging the sanctuary ramp mouth and standing the visitor at y=0 over
    // a ramp already 1.5 m below them. It now stops at the trench.
    this.addFloorClearOfSanctuaryRamp(
      -ROTUNDA_APOTHEM - 2, ROTUNDA_APOTHEM + 2, -ROTUNDA_APOTHEM - 2, ROTUNDA_APOTHEM + 2, GROUND_Y,
    );

    // Eight wall faces. Wings open on N/E/S/W; the Sanctuary threshold on NW.
    const wingFaces = new Map(WINGS.filter((w) => w.level === 0).map((w) => [w.face, w]));
    for (const face of OCTAGON_FACES) {
      const [a, b] = faceEnds(face, ROTUNDA_APOTHEM);
      const wing = wingFaces.get(face);
      if (wing) {
        kit.wallWithOpening(a, b, GROUND_Y, LEVEL_1_Y, ROTUNDA_WALL, wing.archWidth, wing.archHeight, p.wall);
      } else if (face === 'nw') {
        kit.wallWithOpening(a, b, GROUND_Y, LEVEL_1_Y, ROTUNDA_WALL, 5, 4.6, p.wall);
      } else {
        kit.wall(a, b, GROUND_Y, LEVEL_1_Y, ROTUNDA_WALL, p.wall);
      }
      // Pier at each corner, giving the octagon a readable structure.
      kit.prop(add(a, [0, LEVEL_1_Y / 2, 0]), [1, LEVEL_1_Y / 2, 1], p.trim);
    }

    // Drum above the balcony: solid on the wing faces, glazed clerestory elsewhere.
    const drumTop = DOME_SPRING_Y;
    const mezzFaces = new Set(WINGS.filter((w) => w.level === 1).map((w) => w.face));
    for (const face of OCTAGON_FACES) {
      const [a, b] = faceEnds(face, ROTUNDA_APOTHEM);
      const wing = WINGS.find((w) => w.level === 1 && w.face === face);
      if (wing) {
        kit.wallWithOpening(a, b, LEVEL_1_Y, drumTop - LEVEL_1_Y, ROTUNDA_WALL, wing.archWidth, wing.archHeight, p.wall);
      } else {
        // Solid below, clerestory glazing above — light without an opening.
        kit.wall(a, b, LEVEL_1_Y, 3.2, ROTUNDA_WALL, p.wall);
        const glassMid = add([(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2], [0, LEVEL_1_Y + 3.2 + (drumTop - LEVEL_1_Y - 3.2) / 2, 0]);
        const glassPane = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(side(ROTUNDA_APOTHEM) * 0.82, drumTop - LEVEL_1_Y - 3.2, 0.2)),
          this.pal.glass(),
        );
        glassPane.position.set(glassMid[0], glassMid[1], glassMid[2]);
        const d = faceDirection(face);
        glassPane.rotation.y = Math.atan2(d[0], d[2]) + Math.PI;
        g.add(glassPane);
        kit.wallCollision(a, b, LEVEL_1_Y + 3.2, drumTop - LEVEL_1_Y - 3.2, ROTUNDA_WALL);
      }
      if (!mezzFaces.has(face)) continue;
    }

    // Glass dome. A sphere cap, springing from the drum and reaching the apex.
    const domeRadius = circum(ROTUNDA_APOTHEM);
    const rise = DOME_APEX_Y - DOME_SPRING_Y;
    const domeGeo = this.scope.track(
      new THREE.SphereGeometry(domeRadius, 40, 20, 0, Math.PI * 2, 0, Math.asin(Math.min(1, domeRadius / Math.hypot(domeRadius, rise)))),
    );
    const dome = new THREE.Mesh(domeGeo, this.pal.glass());
    dome.scale.set(1, rise / domeRadius, 1);
    dome.position.y = DOME_SPRING_Y;
    g.add(dome);

    // Structural dome ribs, so the glass reads as architecture.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rib = new THREE.Mesh(
        this.scope.track(new THREE.TorusGeometry(domeRadius * 0.98, 0.18, 6, 24, Math.PI / 2)),
        p.trim,
      );
      rib.position.y = DOME_SPRING_Y;
      rib.scale.set(1, rise / domeRadius, 1);
      rib.rotation.set(0, a, Math.PI / 2);
      g.add(rib);
    }

    // Central orientation plinth, doubling as the flight pad: a low kerb a
    // visitor steps up onto like any other ledge (height stays under the
    // player's 0.55 m step-up, so it needs no stairs of its own). Stepping
    // onto it launches the visitor and suspends gravity — see
    // `PlayerController.enterFlight`, triggered from App's fixedUpdate.
    const plinth = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(PLINTH_RADIUS, PLINTH_RADIUS + 0.6, PLINTH_HEIGHT, 32)),
      p.trim,
    );
    plinth.position.set(0, PLINTH_TOP_Y - PLINTH_HEIGHT / 2, 0);
    g.add(plinth);
    // A floor, not a wall: `addBox` would make this impassable regardless of
    // height (see the identical Sanctuary-dais fix above), but a kerb this
    // low should be climbed like any other low ledge. The floor is an
    // inscribed square, not one sized to the full radius -- see
    // `PLINTH_FLOOR_HALF` for why a circumscribed square would float a
    // visitor over open air at the disc's corners.
    this.collision.addFloor(
      -PLINTH_FLOOR_HALF, PLINTH_FLOOR_HALF, -PLINTH_FLOOR_HALF, PLINTH_FLOOR_HALF, PLINTH_TOP_Y,
    );

    const flightPad = new THREE.Mesh(
      this.scope.track(new THREE.CircleGeometry(FLIGHT_PAD_RADIUS - 0.1, 48)),
      p.accent,
    );
    flightPad.rotation.x = -Math.PI / 2;
    flightPad.position.set(FLIGHT_PAD_CENTER[0], PLINTH_TOP_Y + 0.01, FLIGHT_PAD_CENTER[2]);
    g.add(flightPad);
    const flightPadRing = new THREE.Mesh(
      this.scope.track(new THREE.RingGeometry(FLIGHT_PAD_RADIUS - 0.16, FLIGHT_PAD_RADIUS - 0.1, 48)),
      p.trim,
    );
    flightPadRing.rotation.x = -Math.PI / 2;
    flightPadRing.position.set(FLIGHT_PAD_CENTER[0], PLINTH_TOP_Y + 0.011, FLIGHT_PAD_CENTER[2]);
    g.add(flightPadRing);
  }

  private buildBalcony(): void {
    const g = this.zoneGroup('balcony');
    const p = this.pal.get('balcony');
    const kit = new GeometryKit(this.scope, this.collision, g);

    // Octagonal ring floor with the atrium open through the middle.
    const ringShape = octagonShape(circum(ROTUNDA_APOTHEM));
    ringShape.holes.push(octagonPath(circum(BALCONY_INNER_APOTHEM)));
    const ringGeo = this.scope.track(new THREE.ExtrudeGeometry(ringShape, { depth: 0.7, bevelEnabled: false }));
    const ring = new THREE.Mesh(ringGeo, p.floor);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = LEVEL_1_Y;
    ring.receiveShadow = true;
    g.add(ring);

    // Ring collision: one oriented strip per octagon face. Each strip is a
    // straight chord, not a true arc, so extending it a little past its own
    // face's corner overlaps the neighbouring face's strip there. Without the
    // overlap, two adjacent rotated rectangles meet at a single point and
    // leave a thin uncovered sliver right at the turn -- too small to show up
    // as a hole underfoot, but enough to catch a capsule walking the ring and
    // deflect it off its line by half a metre.
    const CORNER_OVERLAP = 0.75;
    for (const face of OCTAGON_FACES) {
      const d = faceDirection(face);
      const r = rightOf(d);
      const half = side(ROTUNDA_APOTHEM) / 2 + CORNER_OVERLAP;
      const mid = (BALCONY_INNER_APOTHEM + ROTUNDA_APOTHEM) / 2;
      const c = place(d, mid);
      const from: Vec3 = [c[0] - r[0] * half, 0, c[2] - r[2] * half];
      const to: Vec3 = [c[0] + r[0] * half, 0, c[2] + r[2] * half];
      kit.orientedFloorCollision(from, to, (ROTUNDA_APOTHEM - BALCONY_INNER_APOTHEM) / 2, LEVEL_1_Y);

      // Balustrade along the atrium edge.
      const inner = place(d, BALCONY_INNER_APOTHEM);
      const ih = side(BALCONY_INNER_APOTHEM) / 2;
      kit.wall(
        [inner[0] - r[0] * ih, 0, inner[2] - r[2] * ih],
        [inner[0] + r[0] * ih, 0, inner[2] + r[2] * ih],
        LEVEL_1_Y, 1.1, 0.35, p.trim,
      );
    }
  }

  private buildStairs(): void {
    const g = this.zoneGroup('rotunda');
    const p = this.pal.get('rotunda');
    const kit = new GeometryKit(this.scope, this.collision, g);

    for (const s of STAIRS) {
      // Visible treads and collision both derive from the same short arc
      // chords. CollisionWorld has no true helix primitive, so overlapping
      // linear ramp segments approximate the curve without a separate path.
      for (let segment = 0; segment < s.collisionSegments; segment++) {
        const t0 = segment / s.collisionSegments;
        const t1 = (segment + 1) / s.collisionSegments;
        const from = stairArcPoint(s, t0);
        const to = stairArcPoint(s, t1);
        const steps = Math.max(1, Math.round(s.visibleSteps / s.collisionSegments));
        kit.stair(from, to, from[1], to[1], s.halfWidth, steps, p.trim);
      }

      const head = stairArcPoint(s, 1);
      const d = faceDirection(s.face);
      const tangent: Vec3 = [-Math.sin(Math.atan2(d[2], d[0]) + s.endAngle), 0, Math.cos(Math.atan2(d[2], d[0]) + s.endAngle)];
      // A short tangential landing reaches the balcony ring without extending
      // into either neighbouring wing threshold.
      kit.orientedFloorCollision(add(head, tangent, -1.5), add(head, tangent, 1.5), s.halfWidth + 0.15, s.toY);
    }
  }

  // ── Wings ────────────────────────────────────────────────────────────────

  private buildWing(w: WingSpec): void {
    const g = this.zoneGroup(w.id);
    const p = this.pal.get(w.id);
    const kit = new GeometryKit(this.scope, this.collision, g);
    const d = faceDirection(w.face);
    const r = rightOf(d);
    const y = w.floorY;

    // Connector corridor from the rotunda wall to the hall.
    kit.orientedFloor(place(d, w.corridorFrom, 0, y), place(d, w.corridorTo, 0, y), w.corridorHalfWidth, y, 0.5, p.floor);
    for (const s of [-1, 1]) {
      kit.wall(
        place(d, w.corridorFrom, s * w.corridorHalfWidth, y),
        place(d, w.corridorTo, s * w.corridorHalfWidth, y),
        y, w.archHeight, 0.6, p.wall,
      );
    }
    kit.ceiling(
      Math.min(place(d, w.corridorFrom, -w.corridorHalfWidth)[0], place(d, w.corridorTo, w.corridorHalfWidth)[0]),
      Math.max(place(d, w.corridorFrom, -w.corridorHalfWidth)[0], place(d, w.corridorTo, w.corridorHalfWidth)[0]),
      Math.min(place(d, w.corridorFrom, -w.corridorHalfWidth)[2], place(d, w.corridorTo, w.corridorHalfWidth)[2]),
      Math.max(place(d, w.corridorFrom, -w.corridorHalfWidth)[2], place(d, w.corridorTo, w.corridorHalfWidth)[2]),
      y + w.archHeight, 0.4, p.ceiling,
    );

    // Main hall floor and ceiling.
    kit.orientedFloor(place(d, w.hallFrom, 0, y), place(d, w.hallTo, 0, y), w.hallHalfWidth, y, 0.5, p.floor);
    this.orientedCeiling(kit, d, w.hallFrom, w.hallTo, w.hallHalfWidth, y + w.hallHeight, p.ceiling);

    // Hall side walls, opened where a bay sits.
    const bayAlongs = new Map<'left' | 'right', number[]>([['left', []], ['right', []]]);
    for (const pl of PLACEMENTS) {
      if (pl.wing !== w.id) continue;
      bayAlongs.get(pl.side)!.push(w.hallFrom + w.bayLead + pl.slot * w.bayPitch);
    }

    for (const side of ['left', 'right'] as const) {
      const sign = side === 'right' ? 1 : -1;
      const openings = bayAlongs.get(side)!.sort((a, b) => a - b);
      let cursor = w.hallFrom;
      for (const centre of openings) {
        const openFrom = centre - w.bayOpening / 2;
        const openTo = centre + w.bayOpening / 2;
        if (openFrom > cursor) {
          kit.wall(
            place(d, cursor, sign * w.hallHalfWidth, y),
            place(d, openFrom, sign * w.hallHalfWidth, y),
            y, w.hallHeight, 0.6, p.wall,
          );
        }
        // Lintel above the bay opening.
        kit.wall(
          place(d, openFrom, sign * w.hallHalfWidth, y),
          place(d, openTo, sign * w.hallHalfWidth, y),
          y + w.bayHeight * 0.72, w.hallHeight - w.bayHeight * 0.72, 0.6, p.wall,
        );
        cursor = openTo;
      }
      if (cursor < w.hallTo) {
        kit.wall(
          place(d, cursor, sign * w.hallHalfWidth, y),
          place(d, w.hallTo, sign * w.hallHalfWidth, y),
          y, w.hallHeight, 0.6, p.wall,
        );
      }
    }

    // End wall. The south hall's far end is the inner doorway to the vestibule,
    // so it is opened rather than closed.
    if (w.id === 'south') {
      kit.wallWithOpening(
        place(d, w.hallTo, -w.hallHalfWidth, y),
        place(d, w.hallTo, w.hallHalfWidth, y),
        y, w.hallHeight, 0.8, 8, 6, p.wall,
      );
    } else {
      kit.wall(
        place(d, w.hallTo, -w.hallHalfWidth, y),
        place(d, w.hallTo, w.hallHalfWidth, y),
        y, w.hallHeight, 0.8, p.wall,
      );
    }

    // Bays.
    for (const pl of PLACEMENTS) {
      if (pl.wing !== w.id) continue;
      this.buildBay(kit, w, d, r, pl.exhibitId, pl.slot, pl.side, g);
    }
  }

  private buildBay(
    kit: GeometryKit,
    w: WingSpec,
    d: Vec3,
    r: Vec3,
    exhibitId: string,
    slot: number,
    side: 'left' | 'right',
    parent: THREE.Group,
  ): void {
    const p = this.pal.get(w.id);
    const y = w.floorY;
    const sign = side === 'right' ? 1 : -1;
    const centreAlong = w.hallFrom + w.bayLead + slot * w.bayPitch;
    const nearLat = sign * w.hallHalfWidth;
    const farLat = sign * (w.hallHalfWidth + w.bayDepth);
    const a = w.bayHalfAlong;

    // Floor and ceiling.
    kit.orientedFloor(
      place(d, centreAlong, nearLat, y),
      place(d, centreAlong, farLat, y),
      a, y, 0.5, p.floor,
    );
    this.baySlabCeiling(kit, d, r, centreAlong, nearLat, farLat, a, y + w.bayHeight, p.ceiling);

    // Back wall and the two side walls.
    kit.wall(
      place(d, centreAlong - a, farLat, y),
      place(d, centreAlong + a, farLat, y),
      y, w.bayHeight, 0.7, p.wall,
    );
    for (const s of [-1, 1]) {
      kit.wall(
        place(d, centreAlong + s * a, nearLat, y),
        place(d, centreAlong + s * a, farLat, y),
        y, w.bayHeight, 0.7, p.wall,
      );
    }

    // Mount point for the exhibit module. Empty in the graybox.
    const mount = new THREE.Group();
    mount.name = `exhibit:${exhibitId}`;
    const anchor = place(d, centreAlong, (nearLat + farLat) / 2, y);
    mount.position.set(anchor[0], anchor[1], anchor[2]);
    // Orient so +Z of the mount points back toward the hall.
    mount.rotation.y = Math.atan2(-sign * r[0], -sign * r[2]);
    parent.add(mount);
    this.exhibitMounts.set(exhibitId, mount);

    // Graybox volume marker: a plinth that reads as "an exhibit belongs here".
    // It sits at the bay centre where the hero object will stand, leaving the
    // approach from the doorway clear.
    const marker = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(2.6, 0.9, 2.6)),
      p.trim,
    );
    marker.position.set(0, 0.45, 0);
    mount.add(marker);
    this.collision.addBox([anchor[0], y + 0.45, anchor[2]], [1.3, 0.45, 1.3]);
  }

  private baySlabCeiling(
    kit: GeometryKit, d: Vec3, r: Vec3,
    centreAlong: number, nearLat: number, farLat: number, halfAlong: number,
    y: number, mat: THREE.Material,
  ): void {
    const c1 = place(d, centreAlong, nearLat);
    const c2 = place(d, centreAlong, farLat);
    const minX = Math.min(c1[0], c2[0]) - Math.abs(d[0]) * halfAlong - Math.abs(r[0]) * 0.1;
    const maxX = Math.max(c1[0], c2[0]) + Math.abs(d[0]) * halfAlong + Math.abs(r[0]) * 0.1;
    const minZ = Math.min(c1[2], c2[2]) - Math.abs(d[2]) * halfAlong - Math.abs(r[2]) * 0.1;
    const maxZ = Math.max(c1[2], c2[2]) + Math.abs(d[2]) * halfAlong + Math.abs(r[2]) * 0.1;
    kit.ceiling(minX, maxX, minZ, maxZ, y, 0.4, mat);
  }

  private orientedCeiling(
    kit: GeometryKit, d: Vec3, from: number, to: number, halfWidth: number, y: number, mat: THREE.Material,
  ): void {
    const r = rightOf(d);
    const a = place(d, from, -halfWidth);
    const b = place(d, to, halfWidth);
    const pad = Math.abs(r[0]) > 0.01 && Math.abs(r[2]) > 0.01 ? halfWidth : 0;
    kit.ceiling(
      Math.min(a[0], b[0]) - pad, Math.max(a[0], b[0]) + pad,
      Math.min(a[2], b[2]) - pad, Math.max(a[2], b[2]) + pad,
      y, 0.5, mat,
    );
  }

  // ── Entrance ─────────────────────────────────────────────────────────────

  private buildEntrance(): void {
    const g = this.zoneGroup('south');
    const p = this.pal.get('south');
    const kit = new GeometryKit(this.scope, this.collision, g);
    const d = faceDirection('s');
    const hw = SOUTH.hallHalfWidth;

    kit.orientedFloor(place(d, VESTIBULE_FROM, 0, GROUND_Y), place(d, VESTIBULE_TO, 0, GROUND_Y), hw, GROUND_Y, 0.5, p.floor);
    this.orientedCeiling(kit, d, VESTIBULE_FROM, VESTIBULE_TO, hw, GROUND_Y + 9, p.ceiling);
    for (const s of [-1, 1]) {
      kit.wall(
        place(d, VESTIBULE_FROM, s * hw, GROUND_Y),
        place(d, VESTIBULE_TO, s * hw, GROUND_Y),
        GROUND_Y, 9, 0.8, p.wall,
      );
    }
    // Front facade with the main doorway.
    kit.wallWithOpening(
      place(d, VESTIBULE_TO, -hw - 6, GROUND_Y),
      place(d, VESTIBULE_TO, hw + 6, GROUND_Y),
      GROUND_Y, 12, 1.2, 7, 5.2, p.wall,
    );
  }

  // ── Dexter Sanctuary ─────────────────────────────────────────────────────

  /**
   * Plan §7. Below and behind the Rotunda axis, through a quieter threshold.
   * It is deliberately sparse and it is not one of the 35 exhibits.
   */
  private buildSanctuary(): void {
    const g = this.zoneGroup('sanctuary');
    const p = this.pal.get('sanctuary');
    const kit = new GeometryKit(this.scope, this.collision, g);
    const d = SANCTUARY_DIR;
    const hw = SANCTUARY_RAMP_HALF_WIDTH;

    // Descending approach.
    kit.ramp(
      place(d, SANCTUARY_RAMP_FROM), place(d, SANCTUARY_RAMP_TO),
      GROUND_Y, SANCTUARY_FLOOR_Y, hw, p.floor,
    );
    for (const s of [-1, 1]) {
      kit.wall(
        place(d, SANCTUARY_RAMP_FROM, s * hw, SANCTUARY_FLOOR_Y),
        place(d, SANCTUARY_RAMP_TO, s * hw, SANCTUARY_FLOOR_Y),
        SANCTUARY_FLOOR_Y, GROUND_Y - SANCTUARY_FLOOR_Y + 4.4, 0.6, p.wall,
      );
    }

    // The chamber: circular, low, quiet.
    const floorGeo = this.scope.track(new THREE.CylinderGeometry(SANCTUARY_RADIUS, SANCTUARY_RADIUS, 0.6, 48));
    const floor = new THREE.Mesh(floorGeo, p.floor);
    floor.position.set(SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y - 0.3, SANCTUARY_CENTER[2]);
    g.add(floor);
    this.collision.addFloor(
      SANCTUARY_CENTER[0] - SANCTUARY_RADIUS, SANCTUARY_CENTER[0] + SANCTUARY_RADIUS,
      SANCTUARY_CENTER[2] - SANCTUARY_RADIUS, SANCTUARY_CENTER[2] + SANCTUARY_RADIUS,
      SANCTUARY_FLOOR_Y,
    );

    // Enclosing wall, left open where the approach arrives.
    const segments = 32;
    const approach = Math.atan2(-d[0], -d[2]);
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      let delta = Math.atan2(Math.sin(a0 - approach), Math.cos(a0 - approach));
      if (Math.abs(delta) < 0.22) continue; // the doorway
      const from: Vec3 = [
        SANCTUARY_CENTER[0] + Math.sin(a0) * SANCTUARY_RADIUS, 0,
        SANCTUARY_CENTER[2] + Math.cos(a0) * SANCTUARY_RADIUS,
      ];
      const to: Vec3 = [
        SANCTUARY_CENTER[0] + Math.sin(a1) * SANCTUARY_RADIUS, 0,
        SANCTUARY_CENTER[2] + Math.cos(a1) * SANCTUARY_RADIUS,
      ];
      kit.wall(from, to, SANCTUARY_FLOOR_Y, SANCTUARY_HEIGHT, 0.6, p.wall);
      delta = 0;
    }

    // Ceiling with a small oculus overhead — the only light that enters directly.
    const ceilGeo = this.scope.track(new THREE.RingGeometry(2.4, SANCTUARY_RADIUS + 0.4, 48));
    const ceil = new THREE.Mesh(ceilGeo, p.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y + SANCTUARY_HEIGHT, SANCTUARY_CENTER[2]);
    g.add(ceil);
    this.collision.addBox(
      [SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y + SANCTUARY_HEIGHT + 0.2, SANCTUARY_CENTER[2]],
      [SANCTUARY_RADIUS, 0.2, SANCTUARY_RADIUS],
    );

    // The central resting platform. Nothing stands on it in the graybox.
    const platform = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(2.6, 2.9, 0.55, 32)),
      p.trim,
    );
    platform.position.set(SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y + 0.28, SANCTUARY_CENTER[2]);
    g.add(platform);
    // A floor, not a wall: at 0.55 m tall this is a step, not an obstacle, and
    // a visitor should be able to walk up onto it like any other low ledge.
    // `addBox` made it a 'wall' collider, which resolveHorizontal always
    // treats as impassable regardless of height -- unlike a floor, walls are
    // never steppable -- so the dais sat there as a solid drum blocking the
    // exact centre of the chamber the whole route is built to reach.
    // The platform's own visible top radius is 2.6 m; a square floor sized to
    // that radius circumscribes the disc (corners at 2.6·√2 ≈ 3.68 m) and
    // floats a visitor over open air at each corner (see `PLINTH_FLOOR_HALF`
    // in layout.ts for the identical rotunda-plinth case). Inscribing the
    // square instead keeps it strictly inside the visible disc.
    const DAIS_TOP_RADIUS = 2.6;
    const daisFloorHalf = DAIS_TOP_RADIUS / Math.SQRT2;
    this.collision.addFloor(
      SANCTUARY_CENTER[0] - daisFloorHalf, SANCTUARY_CENTER[0] + daisFloorHalf,
      SANCTUARY_CENTER[2] - daisFloorHalf, SANCTUARY_CENTER[2] + daisFloorHalf,
      SANCTUARY_FLOOR_Y + 0.55,
    );

    // Quiet seating around the edge.
    for (let i = 0; i < 5; i++) {
      const a = approach + Math.PI + (i - 2) * 0.42;
      const bench = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(2.4, 0.45, 0.7)),
        p.trim,
      );
      bench.position.set(
        SANCTUARY_CENTER[0] + Math.sin(a) * (SANCTUARY_RADIUS - 2.6),
        SANCTUARY_FLOOR_Y + 0.22,
        SANCTUARY_CENTER[2] + Math.cos(a) * (SANCTUARY_RADIUS - 2.6),
      );
      bench.rotation.y = -a;
      g.add(bench);
    }
  }
}

// ── octagon helpers ────────────────────────────────────────────────────────

function octagonPath(radius: number): THREE.Path {
  const path = new THREE.Path();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.sin(a) * radius;
    const y = Math.cos(a) * radius;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

function octagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.sin(a) * radius;
    const y = Math.cos(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}
