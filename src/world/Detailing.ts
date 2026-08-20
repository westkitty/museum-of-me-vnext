import * as THREE from 'three';
import { PaletteSet } from './palette';
import type { ResourceScope } from '../assets/ResourceScope';
import { buildWingSign } from '../exhibits/Furniture';
import { buildBench } from '../assets/generators';
import { WINGS_BY_ID, EXHIBITS_BY_ID } from '../content/collection.generated';
import {
  WINGS, PLACEMENTS, OCTAGON_FACES, ROTUNDA_APOTHEM, LEVEL_1_Y, GROUND_Y,
  DOME_SPRING_Y, faceDirection, rightOf, place, VESTIBULE_TO, VESTIBULE_FROM,
  SANCTUARY_DIR, SANCTUARY_RAMP_FROM, type Vec3, type WingSpec,
} from './layout';

/** Side length of the octagon whose apothem is `a`. */
const side = (a: number) => 2 * a * Math.tan(Math.PI / 8);

/**
 * Production architecture (plan Phase 6).
 *
 * Everything here is dressing on geometry that already exists and is already
 * proven traversable — cornices, pilasters, signage, seating, floor inlays and
 * threshold framing. Nothing moves a wall, so every traversal test stays valid
 * by construction rather than by re-verification.
 */
export class Detailing {
  constructor(
    private readonly scope: ResourceScope,
    private readonly pal: PaletteSet,
  ) {}

  applyAll(parents: ReadonlyMap<string, THREE.Group>): void {
    this.detailRotunda(parents.get('rotunda')!);
    this.detailBalcony(parents.get('balcony')!);
    for (const wing of WINGS) this.detailWing(wing, parents.get(wing.id)!);
    this.detailEntrance(parents.get('south')!);
    this.detailSanctuaryApproach(parents.get('sanctuary')!);
  }

  // ── Rotunda ───────────────────────────────────────────────────────────────

  private detailRotunda(parent: THREE.Group): void {
    const p = this.pal.get('rotunda');
    const halfSide = side(ROTUNDA_APOTHEM) / 2;

    for (const face of OCTAGON_FACES) {
      const dir = faceDirection(face);
      const r = rightOf(dir);
      const mid = place(dir, ROTUNDA_APOTHEM - 0.4);

      // Cornice running the full circuit at balcony level.
      const cornice = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(halfSide * 2, 0.5, 0.55)),
        p.trim,
      );
      cornice.position.set(mid[0], LEVEL_1_Y - 0.35, mid[2]);
      cornice.rotation.y = Math.atan2(dir[0], dir[2]) + Math.PI;
      parent.add(cornice);

      // Base moulding.
      const base = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(halfSide * 2, 0.42, 0.42)),
        p.trim,
      );
      base.position.set(mid[0], GROUND_Y + 0.21, mid[2]);
      base.rotation.y = cornice.rotation.y;
      parent.add(base);

      // Paired pilasters framing each face.
      for (const s of [-1, 1]) {
        const pilaster = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(0.6, LEVEL_1_Y - 0.7, 0.35)),
          p.trim,
        );
        const at: Vec3 = [
          mid[0] + r[0] * s * (halfSide - 0.7),
          0,
          mid[2] + r[2] * s * (halfSide - 0.7),
        ];
        pilaster.position.set(at[0], (LEVEL_1_Y - 0.7) / 2 + 0.4, at[2]);
        pilaster.rotation.y = cornice.rotation.y;
        parent.add(pilaster);
      }

      // Wing signage over each ground-floor threshold.
      const wing = WINGS.find((w) => w.face === face && w.level === 0);
      if (wing) {
        const record = WINGS_BY_ID.get(wing.id)!;
        const sign = buildWingSign(this.scope, record.name, record.subtitle);
        sign.position.set(
          dir[0] * (ROTUNDA_APOTHEM - 0.7),
          wing.archHeight + 0.95,
          dir[2] * (ROTUNDA_APOTHEM - 0.7),
        );
        sign.rotation.y = Math.atan2(dir[0], dir[2]) + Math.PI;
        parent.add(sign);
        this.scope.track(sign.geometry);
      }

      // A bench against each blind face, so the Rotunda is somewhere to stop.
      if (!wing && face !== 'nw') {
        const bench = buildBench(this.scope, 2.2);
        bench.position.set(
          dir[0] * (ROTUNDA_APOTHEM - 2.2),
          GROUND_Y,
          dir[2] * (ROTUNDA_APOTHEM - 2.2),
        );
        bench.rotation.y = Math.atan2(dir[0], dir[2]);
        parent.add(bench);
        this.scope.trackObject(bench);
      }
    }

    // Floor inlay: concentric rings drawing the eye to the centre.
    for (const [radius, width] of [[6.4, 0.14], [10.6, 0.1], [14.6, 0.18]] as const) {
      const ring = new THREE.Mesh(
        this.scope.track(new THREE.RingGeometry(radius - width, radius, 64)),
        p.trim,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = GROUND_Y + 0.035;
      parent.add(ring);
    }

    // The orientation kiosk: the museum's own map, in the museum.
    const kiosk = new THREE.Group();
    kiosk.position.set(0, GROUND_Y, 5.4);
    parent.add(kiosk);

    const stand = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(1.5, 0.1, 0.9)),
      p.trim,
    );
    stand.position.y = 1.05;
    stand.rotation.x = -Math.PI / 5;
    kiosk.add(stand);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.1, 1.05, 0.1)), p.trim);
      leg.position.set(s * 0.6, 0.52, 0);
      kiosk.add(leg);
    }
    const kioskSign = buildWingSign(this.scope, 'Museum map', 'Press M at any time');
    kioskSign.scale.setScalar(0.26);
    kioskSign.position.set(0, 1.13, 0.02);
    kioskSign.rotation.x = -Math.PI / 5;
    kiosk.add(kioskSign);
    this.scope.track(kioskSign.geometry);
  }

  private detailBalcony(parent: THREE.Group): void {
    const p = this.pal.get('balcony');
    const halfSide = side(ROTUNDA_APOTHEM) / 2;

    for (const face of OCTAGON_FACES) {
      const dir = faceDirection(face);
      const mid = place(dir, ROTUNDA_APOTHEM - 0.4);

      const cornice = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(halfSide * 2, 0.4, 0.45)),
        p.trim,
      );
      cornice.position.set(mid[0], DOME_SPRING_Y - 0.3, mid[2]);
      cornice.rotation.y = Math.atan2(dir[0], dir[2]) + Math.PI;
      parent.add(cornice);

      const wing = WINGS.find((w) => w.face === face && w.level === 1);
      if (wing) {
        const record = WINGS_BY_ID.get(wing.id)!;
        const sign = buildWingSign(this.scope, record.name, record.subtitle);
        sign.scale.setScalar(0.78);
        sign.position.set(
          dir[0] * (ROTUNDA_APOTHEM - 0.7),
          LEVEL_1_Y + wing.archHeight + 0.8,
          dir[2] * (ROTUNDA_APOTHEM - 0.7),
        );
        sign.rotation.y = Math.atan2(dir[0], dir[2]) + Math.PI;
        parent.add(sign);
        this.scope.track(sign.geometry);
      }
    }
  }

  // ── Wings ─────────────────────────────────────────────────────────────────

  private detailWing(wing: WingSpec, parent: THREE.Group): void {
    const p = this.pal.get(wing.id);
    const dir = faceDirection(wing.face);
    const r = rightOf(dir);
    const y = wing.floorY;
    const angle = Math.atan2(dir[0], dir[2]);

    // A rhythm of pilasters and lights down both hall walls.
    const bays = Math.max(2, Math.round((wing.hallTo - wing.hallFrom) / 6));
    for (let i = 0; i <= bays; i++) {
      const along = wing.hallFrom + (i / bays) * (wing.hallTo - wing.hallFrom);
      for (const s of [-1, 1]) {
        const at = place(dir, along, s * (wing.hallHalfWidth - 0.22), y);
        const pilaster = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(0.5, wing.hallHeight - 0.6, 0.3)),
          p.trim,
        );
        pilaster.position.set(at[0], y + (wing.hallHeight - 0.6) / 2, at[2]);
        pilaster.rotation.y = angle + Math.PI / 2;
        parent.add(pilaster);
      }
    }

    // Continuous cornice and skirting along both hall walls.
    for (const s of [-1, 1]) {
      const from = place(dir, wing.hallFrom, s * (wing.hallHalfWidth - 0.18), y);
      const to = place(dir, wing.hallTo, s * (wing.hallHalfWidth - 0.18), y);
      for (const [height, thickness] of [[wing.hallHeight - 0.4, 0.34], [0.3, 0.28]] as const) {
        const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
        const band = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(length, 0.34, thickness)),
          p.trim,
        );
        band.position.set((from[0] + to[0]) / 2, y + height, (from[2] + to[2]) / 2);
        band.rotation.y = Math.atan2(-(to[2] - from[2]), to[0] - from[0]);
        parent.add(band);
      }
    }

    // A floor runner down the centre of the hall.
    const runnerFrom = place(dir, wing.hallFrom, 0, y);
    const runnerTo = place(dir, wing.hallTo, 0, y);
    const runnerLength = Math.hypot(runnerTo[0] - runnerFrom[0], runnerTo[2] - runnerFrom[2]);
    const runner = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(runnerLength, 0.02, wing.hallHalfWidth * 0.9)),
      p.accent,
    );
    runner.position.set((runnerFrom[0] + runnerTo[0]) / 2, y + 0.03, (runnerFrom[2] + runnerTo[2]) / 2);
    runner.rotation.y = Math.atan2(-(runnerTo[2] - runnerFrom[2]), runnerTo[0] - runnerFrom[0]);
    parent.add(runner);

    // Threshold framing and a title over every bay opening, so an exhibit can
    // be identified from the hall without walking into it.
    for (const placement of PLACEMENTS) {
      if (placement.wing !== wing.id) continue;
      const record = EXHIBITS_BY_ID.get(placement.exhibitId)!;
      const sign = buildWingSign(this.scope, record.title, `${record.id} · ${record.copy.subtitle}`);
      sign.scale.setScalar(0.62);
      const sign_at = placement.doorway;
      const sign_sign = placement.side === 'right' ? 1 : -1;
      sign.position.set(sign_at[0], y + wing.bayHeight * 0.78, sign_at[2]);
      sign.rotation.y = Math.atan2(-sign_sign * r[0], -sign_sign * r[2]);
      parent.add(sign);
      this.scope.track(sign.geometry);

      // Jambs framing the opening.
      for (const s of [-1, 1]) {
        const along = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch + s * (wing.bayOpening / 2);
        const at = place(dir, along, sign_sign * wing.hallHalfWidth, y);
        const jamb = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(0.42, wing.bayHeight * 0.76, 0.5)),
          p.trim,
        );
        jamb.position.set(at[0], y + (wing.bayHeight * 0.76) / 2, at[2]);
        jamb.rotation.y = angle;
        parent.add(jamb);
      }

      // A bench opposite each bay.
      const oppositeAlong = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch;
      const benchAt = place(dir, oppositeAlong, -sign_sign * (wing.hallHalfWidth - 0.7), y);
      const bench = buildBench(this.scope, 1.5);
      bench.position.set(benchAt[0], y, benchAt[2]);
      bench.rotation.y = angle + Math.PI / 2;
      parent.add(bench);
      this.scope.trackObject(bench);
    }
  }

  // ── Entrance ──────────────────────────────────────────────────────────────

  private detailEntrance(parent: THREE.Group): void {
    const p = this.pal.get('south');
    const dir = faceDirection('s');

    const title = buildWingSign(this.scope, 'Museum of Me', 'The Reliquary of Iterative Becoming');
    title.scale.setScalar(1.5);
    const at = place(dir, VESTIBULE_TO - 0.4, 0, GROUND_Y);
    title.position.set(at[0], 7.2, at[2]);
    title.rotation.y = Math.PI;
    parent.add(title);
    this.scope.track(title.geometry);

    // Orientation line inside the vestibule.
    const welcome = buildWingSign(
      this.scope,
      'Sixty-four projects, thirty-five exhibits',
      'The Rotunda is straight ahead. Press M for a map.',
    );
    welcome.scale.setScalar(0.82);
    const welcomeAt = place(dir, VESTIBULE_FROM + 1.0, 0, GROUND_Y);
    welcome.position.set(welcomeAt[0], 4.2, welcomeAt[2]);
    parent.add(welcome);
    this.scope.track(welcome.geometry);

    // Columns flanking the doors.
    for (const s of [-1, 1]) {
      const columnAt = place(dir, VESTIBULE_TO - 1.2, s * 5.0, GROUND_Y);
      const column = new THREE.Mesh(
        this.scope.track(new THREE.CylinderGeometry(0.55, 0.65, 8.4, 16)),
        p.trim,
      );
      column.position.set(columnAt[0], 4.2, columnAt[2]);
      parent.add(column);
    }
  }

  private detailSanctuaryApproach(parent: THREE.Group): void {
    // One quiet sign at the threshold. The Sanctuary announces itself once and
    // then says nothing else.
    const sign = buildWingSign(this.scope, 'Dexter', 'Quiet, please');
    sign.scale.setScalar(0.62);
    const at = place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 0.6, 0, GROUND_Y);
    sign.position.set(at[0], 2.9, at[2]);
    sign.rotation.y = Math.atan2(SANCTUARY_DIR[0], SANCTUARY_DIR[2]) + Math.PI;
    parent.add(sign);
    this.scope.track(sign.geometry);
  }
}
