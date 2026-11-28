import { runStepsSync, type BuildSteps } from '../util/buildSteps';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PaletteSet } from './palette';
import { architecturalStoneFinish } from './SurfaceFinish';
import { applyArchitecturalFinish } from '../render/ArchitecturalShading';
import type { ResourceScope } from '../assets/ResourceScope';
import { buildWingSign, textMaterial } from '../exhibits/Furniture';
import { canRenderText, createFallbackTexture } from '../assets/TextTexture';
import { buildBench } from '../assets/generators';
import { bayOpeningSpan } from './installationPlacement';
import { alongClearOfBayOpenings } from './bayClearance';
import { EXHIBIT_DOORWAY_LINES } from '../content/exhibitDoorways';
import { WINGS_BY_ID, EXHIBITS_BY_ID, COLLECTION } from '../content/collection.generated';
import {
  WINGS, PLACEMENTS, OCTAGON_FACES, ROTUNDA_APOTHEM, LEVEL_1_Y, GROUND_Y,
  DOME_SPRING_Y, faceDirection, rightOf, place, VESTIBULE_TO, VESTIBULE_FROM,
  SANCTUARY_DIR, SANCTUARY_RAMP_FROM, STAIRS, stairArcPoint, stairLanding, type Vec3, type WingSpec,
} from './layout';

/**
 * The exhibit numbers a wing holds, as a range when they run on ("E17–E23"),
 * otherwise listed. Read from the layout's own exhibit order.
 */
export function wingExhibitRange(wing: WingSpec): string {
  const numbers = wing.exhibits.map((id) => Number(id.slice(1)));
  const contiguous = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
  if (wing.exhibits.length === 1) return wing.exhibits[0];
  return contiguous ? `${wing.exhibits[0]}–${wing.exhibits[wing.exhibits.length - 1]}` : wing.exhibits.join(' · ');
}

/** Subtitle of a wing's threshold sign: its wing name plus what it holds. */
export function wingThresholdSubtitle(wing: WingSpec): string {
  const record = WINGS_BY_ID.get(wing.id);
  const count = wing.exhibits.length;
  return `${record?.subtitle ?? wing.id} · ${wingExhibitRange(wing)} · ${count} exhibit${count === 1 ? '' : 's'}`;
}

/**
 * Which hand the way back lies on for a visitor stepping out of a bay into the
 * hall. They face across the hall; the Rotunda is back along the wing axis.
 */
export function rotundaHandFromBay(wing: WingSpec, side: 'left' | 'right'): 'left' | 'right' {
  const dir = faceDirection(wing.face);
  const r = rightOf(dir);
  const sign = side === 'right' ? 1 : -1;
  const facing: Vec3 = [-sign * r[0], 0, -sign * r[2]];
  const theirRight = rightOf(facing);
  return theirRight[0] * -dir[0] + theirRight[2] * -dir[2] > 0 ? 'right' : 'left';
}

/** Copy of the way-back cue inside each bay opening, arrows on the right hands. */
export function bayWayBackLine(wing: WingSpec, side: 'left' | 'right'): string {
  const hand = rotundaHandFromBay(wing, side);
  const back = wing.level === 1 ? 'Balcony & stairs down' : 'Rotunda';
  const toward = (text: string, h: 'left' | 'right') => h === 'left' ? `← ${text}` : `${text} →`;
  if (wing.id === 'south') {
    // The entrance hall is the one hall with a way out at its far end.
    const exit = hand === 'left' ? 'right' : 'left';
    return hand === 'left' ? `${toward(back, hand)}   ·   ${toward('Exit', exit)}` : `${toward('Exit', exit)}   ·   ${toward(back, hand)}`;
  }
  return toward(back, hand);
}

const BLADE_CELL = [256, 128] as const;
const BLADE_ATLAS_COLUMNS = 7;
const BLADE_ATLAS_ROWS = Math.ceil(PLACEMENTS.length / BLADE_ATLAS_COLUMNS);

/** Point a blade plane's UVs at its exhibit number's cell of the shared atlas. */
export function bladeAtlasUv(geometry: THREE.PlaneGeometry, exhibitId: string): void {
  const index = PLACEMENTS.findIndex((placement) => placement.exhibitId === exhibitId);
  const column = index % BLADE_ATLAS_COLUMNS;
  const row = Math.floor(index / BLADE_ATLAS_COLUMNS);
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (column + uv.getX(i)) / BLADE_ATLAS_COLUMNS, 1 - (row + 1 - uv.getY(i)) / BLADE_ATLAS_ROWS);
  }
  uv.needsUpdate = true;
}

/** Height of a hall's projecting bay-number blade signs, above head height. */
export const BAY_BLADE_HEIGHT = 3.9;
/** Along-hall gap between a bay opening's Rotunda-side edge and its blade sign. */
export const BAY_BLADE_SETBACK = 1.1;

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
  private readonly wayBackMaterials = new Map<string, THREE.Material>();
  private bladeMaterial: THREE.Material | null = null;

  constructor(
    private readonly scope: ResourceScope,
    private readonly pal: PaletteSet,
  ) {}

  applyAll(parents: ReadonlyMap<string, THREE.Group>): void {
    this.applyZone('rotunda', parents);
    this.applyZone('balcony', parents);
    for (const wing of WINGS) this.applyZone(wing.id, parents);
    this.applyZone('entrance-detail', parents);
    this.applyZone('sanctuary', parents);
  }

  /** Apply one architectural region so lazy preparation can yield between regions. */
  applyZone(id: string, parents: ReadonlyMap<string, THREE.Group>): void {
    runStepsSync(this.applyZoneSteps(id, parents));
  }

  /** The same region, split at safe boundaries for the cooperative build (see `src/util/buildSteps.ts`). */
  *applyZoneSteps(id: string, parents: ReadonlyMap<string, THREE.Group>): BuildSteps {
    const parent = parents.get(id);
    if (!parent) return;
    if (id === 'rotunda') { this.detailRotunda(parent); yield; this.stairSigns(parent, 0); }
    else if (id === 'balcony') { this.detailBalcony(parent); yield; this.stairSigns(parent, 1); }
    else if (id === 'entrance-detail') this.detailEntrance(parent);
    else if (id === 'sanctuary') this.detailSanctuaryApproach(parent);
    else {
      const wing = WINGS.find((candidate) => candidate.id === id);
      if (wing) yield* this.detailWing(wing, parent);
    }
  }

  // ── Rotunda ───────────────────────────────────────────────────────────────

  private detailRotunda(parent: THREE.Group): void {
    const p = this.pal.get('rotunda');
    const halfSide = side(ROTUNDA_APOTHEM) / 2;
    const coveGlow = this.accentGlow(p.accent, 0.34);
    const sealBacking = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x555f60, roughness: 0.83, metalness: 0.12,
    }));

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

      const cove = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(halfSide * 1.84, 0.055, 0.08)),
        coveGlow,
      );
      cove.name = `rotunda-cove-glow:${face}`;
      cove.position.set(mid[0], LEVEL_1_Y - 0.7, mid[2]);
      cove.rotation.y = cornice.rotation.y;
      cove.renderOrder = 2;
      parent.add(cove);

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
        const sign = buildWingSign(this.scope, record.name, wingThresholdSubtitle(wing));
        sign.name = `wing-threshold-sign:${wing.id}`;
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
        this.detailRotundaArchiveSeal(parent, face, dir, p.trim, sealBacking);
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

  /**
   * Readable architectural punctuation on the only three lower blind faces.
   * A discreet eight-direction archive compass gives the Rotunda scale without
   * blocking a wing threshold, the NW Dexter approach, or the circulation ring.
   * Static, mergeable, material-only; no light, collider, animation, or text.
   */
  private detailRotundaArchiveSeal(
    parent: THREE.Group, face: (typeof OCTAGON_FACES)[number], dir: Vec3,
    bronze: THREE.Material, stone: THREE.Material,
  ): void {
    const seal = new THREE.Group();
    seal.name = `rotunda-archive-seal:${face}`;
    // Set the relief ahead of the inner wall face (the wall has thickness),
    // otherwise its outer rings are depth-occluded and only the raised hub shows.
    const at = place(dir, ROTUNDA_APOTHEM - 0.71, 0, GROUND_Y + 4.7);
    seal.position.set(at[0], at[1], at[2]);
    // Local +Z faces into the Rotunda rather than pointing into the wall.
    seal.rotation.y = Math.atan2(-dir[0], -dir[2]);
    parent.add(seal);

    const backing = new THREE.Mesh(
      this.scope.track(new THREE.CircleGeometry(1.88, 8)),
      stone,
    );
    backing.name = `rotunda-archive-seal-backing:${face}`;
    // Match the rings' exact wall-facing plane; rotating an octagonal cylinder
    // tilted the front cap and visually displaced it from the compass marks.
    backing.rotation.z = Math.PI / 8;
    backing.position.z = 0.03;
    seal.add(backing);

    for (const [radius, thickness] of [[1.58, 0.08], [1.26, 0.045]] as const) {
      const ring = new THREE.Mesh(
        this.scope.track(new THREE.RingGeometry(radius - thickness, radius, 48)),
        bronze,
      );
      ring.position.z = 0.077;
      seal.add(ring);
    }

    const stroke = this.scope.track(new THREE.BoxGeometry(0.09, 0.42, 0.035));
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const tick = new THREE.Mesh(stroke, bronze);
      tick.position.set(Math.sin(angle) * 1.07, Math.cos(angle) * 1.07, 0.10);
      tick.rotation.z = -angle;
      seal.add(tick);
    }

    const hub = new THREE.Mesh(this.scope.track(new THREE.OctahedronGeometry(0.29, 0)), bronze);
    hub.position.z = 0.16;
    seal.add(hub);
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
        const sign = buildWingSign(this.scope, record.name, wingThresholdSubtitle(wing));
        sign.name = `wing-threshold-sign:${wing.id}`;
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

  /**
   * Physical stair wayfinding. At each stair foot a sign names where the
   * flight goes; at each balcony landing a sign names the way back down.
   * Both face the visitor approaching on that floor and sit on the rotunda
   * wall, clear of the treads and of every walking line.
   */
  private stairSigns(parent: THREE.Group, level: 0 | 1): void {
    const upper = [...WINGS.filter((wing) => wing.level === 1).map((wing) => WINGS_BY_ID.get(wing.id)?.name ?? wing.id), 'Museum Cinema'];
    for (const stair of STAIRS) {
      const point = level === 0 ? stairArcPoint(stair, 0.04) : stairLanding(stair, 1.6);
      const angle = Math.atan2(point[2], point[0]);
      const radius = ROTUNDA_APOTHEM - 0.55;
      const sign = level === 0
        ? buildWingSign(this.scope, 'Stairs to the upper floor', upper.join(' · '))
        : buildWingSign(this.scope, 'Stairs down to the Rotunda', 'Ground-floor wings · Dexter Sanctuary · Exit');
      sign.name = `stair-sign:${stair.id}:${level === 0 ? 'foot' : 'landing'}`;
      sign.scale.setScalar(0.5);
      sign.position.set(Math.cos(angle) * radius, (level === 0 ? GROUND_Y : LEVEL_1_Y) + (level === 0 ? 3.1 : 2.55), Math.sin(angle) * radius);
      // Face the centre of the rotunda, where the visitor approaches from.
      sign.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle));
      parent.add(sign);
    }
  }

  private *detailWing(wing: WingSpec, parent: THREE.Group): BuildSteps {
    const p = this.pal.get(wing.id);
    const dir = faceDirection(wing.face);
    const r = rightOf(dir);
    const y = wing.floorY;
    const angle = Math.atan2(dir[0], dir[2]);

    const thresholdGlow = this.accentGlow(p.accent, wing.id === 'north' ? 0.64 : 0.42);

    // Two material-only light rails make each wing threshold read instantly
    // without adding another realtime light to the strict point-light budget.
    for (const s of [-1, 1]) {
      const threshold = place(dir, ROTUNDA_APOTHEM + 1.15, s * (wing.hallHalfWidth - 0.18), y);
      const rail = new THREE.Mesh(
        this.scope.track(new THREE.BoxGeometry(0.075, Math.min(wing.archHeight, 6.8), 0.075)),
        thresholdGlow,
      );
      rail.name = `wing-threshold-glow:${wing.id}:${s < 0 ? 'left' : 'right'}`;
      rail.position.set(threshold[0], y + Math.min(wing.archHeight, 6.8) / 2, threshold[2]);
      rail.renderOrder = 2;
      parent.add(rail);
    }

    // A rhythm of pilasters down both hall walls, on solid wall only. On the
    // 6 m rhythm two pilasters fell inside most 9 m bay openings, free-standing
    // 13 m posts in the doorway (2026-11-21 walkthrough).
    const bayOpenings = PLACEMENTS.filter((placement) => placement.wing === wing.id).map((placement) => {
      const centre = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch;
      const span = bayOpeningSpan(placement.exhibitId);
      return { side: placement.side === 'right' ? 1 : -1, from: centre + span.from - 0.5, to: centre + span.to + 0.5 };
    });
    const bays = Math.max(2, Math.round((wing.hallTo - wing.hallFrom) / 6));
    for (let i = 0; i <= bays; i++) {
      const along = wing.hallFrom + (i / bays) * (wing.hallTo - wing.hallFrom);
      for (const s of [-1, 1]) {
        if (bayOpenings.some((opening) => opening.side === s && along > opening.from && along < opening.to)) continue;
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

    // A continuous cornice along both hall walls, and a skirting that stops at
    // every bay doorway. The skirting (0.13–0.47 m) used to run straight across
    // each opening: a knee-high strip through every exhibit threshold that
    // visitors walked through (2026-11-21 walkthrough, all 35 bays).
    for (const s of [-1, 1] as const) {
      const lateral = s * (wing.hallHalfWidth - 0.18);
      const openings = PLACEMENTS
        .filter((placement) => placement.wing === wing.id && (placement.side === 'right' ? 1 : -1) === s)
        .map((placement) => {
          const centre = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch;
          const span = bayOpeningSpan(placement.exhibitId);
          return [centre + span.from, centre + span.to] as const;
        })
        .sort((a, b) => a[0] - b[0]);
      const runs: Array<readonly [number, number]> = [];
      let cursor = wing.hallFrom;
      for (const [open, close] of openings) {
        if (open > cursor) runs.push([cursor, open]);
        cursor = Math.max(cursor, close);
      }
      if (cursor < wing.hallTo) runs.push([cursor, wing.hallTo]);
      const band = (alongFrom: number, alongTo: number, height: number, thickness: number) => {
        const from = place(dir, alongFrom, lateral, y);
        const to = place(dir, alongTo, lateral, y);
        const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
        if (length < 0.05) return;
        const mesh = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(length, 0.34, thickness)),
          p.trim,
        );
        mesh.position.set((from[0] + to[0]) / 2, y + height, (from[2] + to[2]) / 2);
        mesh.rotation.y = Math.atan2(-(to[2] - from[2]), to[0] - from[0]);
        parent.add(mesh);
      };
      band(wing.hallFrom, wing.hallTo, wing.hallHeight - 0.4, 0.34);
      // One merged skirting mesh per wall, as before the doorway gaps.
      const pieces: THREE.BufferGeometry[] = [];
      for (const [a, b] of runs) {
        const from = place(dir, a, lateral, y);
        const to = place(dir, b, lateral, y);
        const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
        if (length < 0.05) continue;
        const piece = new THREE.BoxGeometry(length, 0.34, 0.28);
        piece.rotateY(Math.atan2(-(to[2] - from[2]), to[0] - from[0]));
        piece.translate((from[0] + to[0]) / 2, y + 0.3, (from[2] + to[2]) / 2);
        pieces.push(piece);
      }
      const skirting = pieces.length ? mergeGeometries(pieces, false) : null;
      pieces.forEach((piece) => piece.dispose());
      if (skirting) {
        const mesh = new THREE.Mesh(this.scope.track(skirting), p.trim);
        mesh.name = `hall-skirting:${wing.id}`;
        parent.add(mesh);
      }
    }

    yield;
    // An oversized full-bright accent strip made the entire hall read like a
    // fluorescent conveyor belt, overwhelming the exhibits. A darker honed
    // mineral runner gives the visitor a path without flattening the palette.
    // Paired inlaid signals keep each wing's colour legible at a distance.
    const runnerFrom = place(dir, wing.hallFrom, 0, y);
    const runnerTo = place(dir, wing.hallTo, 0, y);
    const runnerLength = Math.hypot(runnerTo[0] - runnerFrom[0], runnerTo[2] - runnerFrom[2]);
    const runnerWidth = wing.hallHalfWidth * 0.9;
    const runnerColor = (p.floor as THREE.MeshStandardMaterial).color.clone()
      .lerp((p.accent as THREE.MeshStandardMaterial).color, 0.16);
    const finish = architecturalStoneFinish(this.scope);
    const runnerMat = this.scope.track(new THREE.MeshStandardMaterial({
      color: runnerColor, roughness: 0.72, metalness: 0.12,
      map: finish, roughnessMap: finish,
    }));
    applyArchitecturalFinish(runnerMat, wing.id, (p.accent as THREE.MeshStandardMaterial).color, 'runner');
    const runner = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(runnerLength, 0.02, runnerWidth)),
      runnerMat,
    );
    runner.name = `wing-honed-runner:${wing.id}`;
    runner.position.set((runnerFrom[0] + runnerTo[0]) / 2, y + 0.03, (runnerFrom[2] + runnerTo[2]) / 2);
    runner.rotation.y = Math.atan2(-(runnerTo[2] - runnerFrom[2]), runnerTo[0] - runnerFrom[0]);
    parent.add(runner);

    const signal = this.scope.track(new THREE.MeshBasicMaterial({
      color: (p.accent as THREE.MeshStandardMaterial).color,
      transparent: true, opacity: wing.id === 'north' ? 0.57 : 0.48,
      depthWrite: false, toneMapped: false,
    }));
    const signalGeo = this.scope.track(new THREE.BoxGeometry(runnerLength, 0.012, 0.055));
    for (const s of [-1, 1] as const) {
      const rail = new THREE.Mesh(signalGeo, signal);
      rail.name = `wing-runner-inlay:${wing.id}:${s < 0 ? 'left' : 'right'}`;
      rail.position.copy(runner.position);
      rail.position.y += 0.021;
      const localOffset = s * (runnerWidth / 2 - 0.09);
      rail.position.x += Math.sin(runner.rotation.y) * localOffset;
      rail.position.z += Math.cos(runner.rotation.y) * localOffset;
      rail.rotation.y = runner.rotation.y;
      parent.add(rail);
    }

    yield;
    // One way-back cue per hall side, shared by every bay on that side: the
    // copy only depends on the side, so the bays share one small texture.
    // Wide and short, with large type: it is read from the visitor spot deep
    // in the bay, about 8 m away.
    const wayBackGeometry = this.scope.track(new THREE.PlaneGeometry(2.6, 0.54));
    // Identical copy shares one material across wings, so the static merge
    // folds every cue with the same words into one draw.
    const wayBack = new Map<'left' | 'right', THREE.Material>();
    for (const side of ['left', 'right'] as const) {
      const line = bayWayBackLine(wing, side);
      let material = this.wayBackMaterials.get(line);
      if (!material) {
        material = textMaterial(this.scope, [], {
          width: 640, height: 133, title: line, titleSize: 76, fitTitle: true, align: 'center',
          rule: false, paddingX: 18, paddingY: 12, background: '#141118', titleColor: '#e8d9b0',
        });
        this.wayBackMaterials.set(line, material);
      }
      wayBack.set(side, material);
    }

    yield;
    // Threshold framing and a title over every bay opening, so an exhibit can
    // be identified from the hall without walking into it.
    for (const placement of PLACEMENTS) {
      if (placement.wing !== wing.id) continue;
      yield; // one doorway (text sign, blades, cue, jambs, bench) per step
      const record = EXHIBITS_BY_ID.get(placement.exhibitId)!;
      const sign = buildWingSign(this.scope, EXHIBIT_DOORWAY_LINES[record.id], `${record.title} · ${record.id}`);
      sign.name = `exhibit-doorway:${record.id}`;
      sign.scale.setScalar(0.62);
      const sign_at = placement.doorway;
      const sign_sign = placement.side === 'right' ? 1 : -1;
      sign.position.set(sign_at[0], y + wing.bayHeight * 0.78, sign_at[2]);
      sign.rotation.y = Math.atan2(-sign_sign * r[0], -sign_sign * r[2]);
      parent.add(sign);
      this.scope.track(sign.geometry);

      // A double-sided blade sign projecting from the wall just before the
      // opening. Doorway titles face across the hall and read edge-on from
      // along it; the blade carries the exhibit number into the long view, so
      // the bay order (and where a numbered exhibit is) reads down the hall.
      const bayCentre = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch;
      const bladeAt = place(dir, bayCentre - wing.bayOpening / 2 - BAY_BLADE_SETBACK, sign_sign * (wing.hallHalfWidth - 0.6), y);
      const bladeGeometry = this.scope.track(new THREE.PlaneGeometry(1.0, 0.5));
      bladeAtlasUv(bladeGeometry, record.id);
      const bladeMaterial = this.bladeAtlasMaterial();
      for (const face of [-1, 1] as const) {
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.name = `bay-number-blade:${record.id}`;
        blade.position.set(bladeAt[0] + face * dir[0] * 0.012, y + BAY_BLADE_HEIGHT, bladeAt[2] + face * dir[2] * 0.012);
        // Face each way along the hall: toward the Rotunda and away from it.
        blade.rotation.y = Math.atan2(face * dir[0], face * dir[2]);
        parent.add(blade);
      }

      // Inside the bay, over the opening, a cue for the visitor leaving: which
      // way along the hall leads back to the Rotunda (and, in the entrance
      // hall, to the exit).
      const cue = new THREE.Mesh(wayBackGeometry, wayBack.get(placement.side)!);
      cue.name = `bay-way-back:${record.id}`;
      // Set toward the Rotunda side of the opening, clear of the bay's central
      // pendant, which otherwise hides the middle of a centred sign.
      const cueAt = place(dir, bayCentre - wing.bayOpening / 2 + 1.6, sign_sign * (wing.hallHalfWidth + 0.34), y);
      cue.position.set(cueAt[0], y + wing.bayHeight * 0.72 + 0.45, cueAt[2]);
      cue.rotation.y = Math.atan2(sign_sign * r[0], sign_sign * r[2]);
      parent.add(cue);

      // Jambs framing the opening from outside its clear span: centred on the
      // edge they stood 0.21 m into the doorway with no collider, so a visitor
      // near the jamb walked through them.
      const span = bayOpeningSpan(placement.exhibitId);
      for (const s of [-1, 1]) {
        const along = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch
          + (s < 0 ? span.from - 0.21 : span.to + 0.21);
        const at = place(dir, along, sign_sign * wing.hallHalfWidth, y);
        const jamb = new THREE.Mesh(
          this.scope.track(new THREE.BoxGeometry(0.42, wing.bayHeight * 0.76, 0.5)),
          p.trim,
        );
        jamb.position.set(at[0], y + (wing.bayHeight * 0.76) / 2, at[2]);
        jamb.rotation.y = angle;
        parent.add(jamb);
      }

      // A bench opposite each bay, against solid wall. Where the opposite side
      // has its own bay at the same position (most halls), the bench used to
      // stand in that bay's doorway, a non-colliding seat across its entrance.
      const oppositeAlong = alongClearOfBayOpenings(wing,
        wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch, (-sign_sign) as -1 | 1);
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

    // Orientation line inside the vestibule. Set well back from
    // EnvironmentDressing's "Welcome" sign (VESTIBULE_FROM + 2.2) -- the two
    // used to sit only 1.2 m apart in the first sixth of the 14 m vestibule,
    // reading as one cluttered, overlapping sign rather than two.
    const welcome = buildWingSign(
      this.scope,
      `${COLLECTION.projects.length} projects, ${COLLECTION.exhibits.length} exhibits`,
      'The Rotunda is straight ahead. Press M for a map.',
    );
    welcome.scale.setScalar(0.82);
    const welcomeAt = place(dir, VESTIBULE_FROM + 9.0, 0, GROUND_Y);
    welcome.position.set(welcomeAt[0], 4.2, welcomeAt[2]);
    parent.add(welcome);
    this.scope.track(welcome.geometry);

    // The two columns that flanked the old front doors stood at x = ±5 inside
    // what is now the atrium's 14 m inner portal, with no collider: a visitor
    // walked through them. The portal is framed by the atrium wall itself.
    void p;
  }

  /**
   * One shared texture holds every exhibit number, so all 70 blade faces use
   * one material and the static merge folds them into a handful of draws.
   */
  private bladeAtlasMaterial(): THREE.Material {
    if (this.bladeMaterial) return this.bladeMaterial;
    let map: THREE.Texture;
    if (canRenderText()) {
      const canvas = document.createElement('canvas');
      canvas.width = BLADE_ATLAS_COLUMNS * BLADE_CELL[0];
      canvas.height = BLADE_ATLAS_ROWS * BLADE_CELL[1];
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas context unavailable — cannot render museum text');
      ctx.fillStyle = '#141118';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e8c65a';
      ctx.font = '600 76px Georgia, "Iowan Old Style", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      PLACEMENTS.forEach((placement, index) => {
        const column = index % BLADE_ATLAS_COLUMNS;
        const row = Math.floor(index / BLADE_ATLAS_COLUMNS);
        ctx.fillText(placement.exhibitId, (column + 0.5) * BLADE_CELL[0], (row + 0.54) * BLADE_CELL[1], BLADE_CELL[0] - 20);
      });
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      map = this.scope.track(texture);
    } else {
      map = createFallbackTexture(this.scope);
    }
    this.bladeMaterial = this.scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 }));
    return this.bladeMaterial;
  }

  private accentGlow(source: THREE.Material, opacity: number): THREE.MeshBasicMaterial {
    const color = 'color' in source && source.color instanceof THREE.Color
      ? source.color.clone()
      : new THREE.Color(0xd8c18d);
    return this.scope.track(new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
  }

  private detailSanctuaryApproach(parent: THREE.Group): void {
    // One quiet, non-colliding sign at the threshold. The Sanctuary announces
    // itself once and the hall stays otherwise clear and distinct from E01–E35.
    const sign = buildWingSign(this.scope, 'STINK WEASEL DEN', '');
    sign.name = 'sanctuary-threshold-sign';
    sign.userData.copy = 'STINK WEASEL DEN';
    sign.scale.setScalar(0.74);
    const at = place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 0.6, 0, GROUND_Y);
    sign.position.set(at[0], 2.9, at[2]);
    sign.rotation.y = Math.atan2(SANCTUARY_DIR[0], SANCTUARY_DIR[2]) + Math.PI;
    parent.add(sign);
    this.scope.track(sign.geometry);
  }
}
