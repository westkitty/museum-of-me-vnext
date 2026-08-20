import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { Filament, buildConsole } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E19 — DexTilt. Tier B.
 *
 * An oversized phone on a pedestal, linked to a desk. Tilting the phone fires a
 * gesture; the desktop answers. The gesture's path stays in the air afterwards
 * as a visible ribbon, which is the thing a flat screenshot cannot show: the
 * shape of a motion command.
 *
 * The allowlist is physical here. There are exactly four commands, they are
 * printed on the desk, and no gesture can invoke anything else — which is the
 * project's actual security model rendered as furniture.
 */

interface Gesture {
  readonly name: string;
  readonly command: string;
  /** Tilt in radians: [pitch, roll]. */
  readonly tilt: readonly [number, number];
  readonly colour: number;
}

const GESTURES: readonly Gesture[] = [
  { name: 'Tip forward', command: 'Next track', tilt: [0.55, 0], colour: 0x3fb9b2 },
  { name: 'Tip back', command: 'Previous track', tilt: [-0.55, 0], colour: 0x5fb0e8 },
  { name: 'Roll right', command: 'Volume up', tilt: [0, 0.6], colour: 0xe8c65a },
  { name: 'Roll left', command: 'Volume down', tilt: [0, -0.6], colour: 0xd97a4e },
];

const TRAIL_POINTS = 26;

export class DexTilt extends ExhibitBase {
  private phone!: THREE.Group;
  private desk!: THREE.Group;
  private screen!: THREE.Mesh;
  private indicator!: THREE.Mesh;
  private trail!: Filament;
  private trailPoints = this.tracked<THREE.Vector3>();
  /** Holds `trailPoints` by reference, so the curve never has to be rebuilt. */
  private trailCurve!: THREE.CatmullRomCurve3;
  private readonly scratchTip = new THREE.Vector3();

  private target = new THREE.Vector2(0, 0);
  private current = new THREE.Vector2(0, 0);
  private lastGesture: Gesture | null = null;
  private settleTimer = 0;
  private manualUsed = false;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -7.2);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.2, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const steel = this.standard(0xb8c2c4, { roughness: 0.35, metalness: 0.55 });
    const dark = this.standard(0x1d2326, { roughness: 0.5, metalness: 0.3 });
    const teal = this.emissive(0x2f8f8a, 0.7);

    // ── the phone, on its own plinth ──
    const plinth = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.62, 0.72, 1.0, 20)), dark);
    plinth.position.set(-1.9, 0.5, -3.4);
    this.group.add(plinth);

    this.phone = new THREE.Group();
    this.phone.position.set(-1.9, 1.65, -3.4);
    this.group.add(this.phone);

    const shell = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.78, 1.55, 0.08)), dark);
    this.phone.add(shell);

    this.screen = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(0.68, 1.4)),
      this.emissive(0x2f8f8a, 0.35),
    );
    this.screen.position.z = 0.045;
    this.phone.add(this.screen);

    // The tilt indicator: a bead that slides on the screen with the phone.
    this.indicator = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.07, 12, 8)), this.emissive(0xe8c65a, 1.4));
    this.indicator.position.z = 0.07;
    this.phone.add(this.indicator);

    // ── the desk it drives ──
    this.desk = new THREE.Group();
    this.desk.position.set(2.2, 0, -4.2);
    this.group.add(this.desk);

    const deskTop = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.0, 0.08, 1.0)), this.standard(0x6b5334, { roughness: 0.7 }));
    deskTop.position.y = 0.9;
    this.desk.add(deskTop);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.08, 0.9, 0.8)), steel);
      leg.position.set(s * 0.86, 0.45, 0);
      this.desk.add(leg);
    }

    const monitor = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.5, 0.9, 0.06)), dark);
    monitor.position.set(0, 1.5, -0.32);
    this.desk.add(monitor);

    const display = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(1.4, 0.8)), teal);
    display.position.set(0, 1.5, -0.28);
    this.desk.add(display);

    // The allowlist, printed on the desk. Four commands, and only four.
    GESTURES.forEach((gesture, i) => {
      const label = buildLabel(scope, `${gesture.name} → ${gesture.command}`, 1.6);
      label.position.set(0, 0.95, 0.34 - i * 0.2);
      label.rotation.x = -Math.PI / 2;
      this.desk.add(label);
      scope.track(label.geometry);
    });

    // ── the gesture trail ──
    for (let i = 0; i < TRAIL_POINTS; i++) this.trailPoints.push(this.phone.position.clone());
    this.trailCurve = new THREE.CatmullRomCurve3(this.trailPoints);
    this.trail = new Filament(scope, TRAIL_POINTS - 1, 0.028, this.emissive(0x3fb9b2, 1.2));
    this.group.add(this.trail.group);

    // ── controls ──
    // The phone itself is the primary control: take hold of it and tilt.
    this.control({
      object: this.phone,
      label: 'Tilt the phone',
      description:
        'Cycles through the four trained gestures. Each fires exactly one command from the allowlist, and the desktop answers.',
      activate: () => {
        const next = this.lastGesture
          ? GESTURES[(GESTURES.indexOf(this.lastGesture) + 1) % GESTURES.length]
          : GESTURES[0];
        this.fire(next);
      },
      drag: (dx, dy) => {
        this.target.set(
          THREE.MathUtils.clamp(this.target.x - dy * 0.9, -0.7, 0.7),
          THREE.MathUtils.clamp(this.target.y + dx * 0.9, -0.7, 0.7),
        );
      },
    });

    // The manual fallback, physically present. A novel input needs a boring one.
    const consoleGroup = buildConsole(scope, 0.6, 0.44, 1.0, dark);
    consoleGroup.position.set(2.2, 0, -1.9);
    consoleGroup.rotation.y = -0.3;
    this.group.add(consoleGroup);

    const button = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16)), this.emissive(0xd97a4e, 0.8));
    button.position.set(0, 1.03, 0);
    consoleGroup.add(button);

    const manualLabel = buildLabel(scope, 'Manual control', 0.54);
    manualLabel.position.set(0, 1.02, 0.18);
    manualLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(manualLabel);
    scope.track(manualLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Use the manual control instead',
      description:
        'Every gesture has a button. The novel input is never the only input — that is what keeps it from being a novelty.',
      activate: () => {
        this.manualUsed = true;
        this.fire(GESTURES[2], true);
      },
    });

    this.resetPose();
  }

  private fire(gesture: Gesture, manual = false): void {
    this.lastGesture = gesture;
    this.target.set(gesture.tilt[0], gesture.tilt[1]);
    this.settleTimer = this.reducedMotion ? 0.1 : 1.5;
    (this.screen.material as THREE.MeshStandardMaterial).emissive.setHex(gesture.colour);
    this.ctx.announce(
      manual
        ? `Manual control: ${gesture.command}. The same command, without the gesture.`
        : `${gesture.name} — the desktop receives “${gesture.command}”.`,
    );
  }

  private resetPose(): void {
    this.target.set(0, 0);
    this.current.set(0, 0);
    this.phone.rotation.set(0, 0, 0);
    for (const p of this.trailPoints) p.copy(this.phone.position);
    this.trail.follow(this.trailCurve);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    // Ease the phone toward its target tilt; hold still under reduced motion.
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 6);
    this.current.lerp(this.target, rate);
    this.phone.rotation.x = this.current.x;
    this.phone.rotation.z = -this.current.y;

    this.indicator.position.set(this.current.y * 0.26, -this.current.x * 0.5, 0.07);

    // The trail records where the phone's top corner has been. The oldest
    // point is recycled rather than discarded, so following the trail costs
    // nothing per frame.
    const tip = this.trailPoints.shift() ?? this.scratchTip.clone();
    tip.set(0, 0.8, 0.1).applyEuler(this.phone.rotation).add(this.phone.position);
    this.trailPoints.push(tip);
    this.trail.follow(this.trailCurve);

    if (this.settleTimer > 0) {
      this.settleTimer -= dt;
      if (this.settleTimer <= 0) this.target.set(0, 0);
    }

    if (!this.reducedMotion) {
      const pulse = 0.6 + Math.sin(this.elapsed * 3) * 0.12;
      (this.screen.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    }
  }

  protected override onReset(): void {
    this.lastGesture = null;
    this.manualUsed = false;
    this.settleTimer = 0;
    if (this.phone) this.resetPose();
    if (this.screen) {
      const mat = this.screen.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x2f8f8a);
      mat.emissiveIntensity = 0.35;
    }
  }

  protected override describeState(): string {
    if (!this.lastGesture) return 'The phone rests level. No gesture has been fired.';
    const manual = this.manualUsed ? ' The manual control has also been used.' : '';
    return `The last gesture was “${this.lastGesture.name}”, which sent “${this.lastGesture.command}” to the desktop.${manual}`;
  }
}
