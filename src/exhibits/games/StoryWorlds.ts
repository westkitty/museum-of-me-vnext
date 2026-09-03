import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E31 — Story Worlds. Tier C.
 *
 * One installation with two faces that cannot see each other. On one side, a
 * gesture is drawn and a miracle happens at once. On the other, something is
 * planted and then it needs time. Intervention and patience, back to back —
 * the two games are opposite in temperament and the exhibit is built so a
 * visitor has to physically walk around to get from one to the other.
 */

const GESTURES = [
  { name: 'Strike', effect: 'The ground answers immediately. One verb, implemented deeply.', k: 1 },
  { name: 'Sweep', effect: 'A wider intervention, and a wider consequence.', k: 2 },
  { name: 'Ward', effect: 'A ritual sequence rather than a single mark.', k: 3 },
] as const;

const GROWTH = [
  { stage: 'Planted', note: 'Nothing visible. This is most of farming.' },
  { stage: 'Sprouted', note: 'Water and power were both spent to get here, and they came from the same budget.' },
  { stage: 'Grown', note: 'The greenhouse recovers a little. Restoration, not expansion.' },
] as const;

export class StoryWorlds extends ExhibitBase {
  private portal!: THREE.Group;
  private gestureTrail!: Filament;
  private crop!: THREE.Group;
  private cropParts = this.tracked<THREE.Mesh>();
  private gesture = -1;
  private growth = 0;
  private strikeFlash = 0;

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

    // ── the two-sided portal ──
    this.portal = new THREE.Group();
    this.portal.position.set(0, 0, -4.0);
    this.group.add(this.portal);

    const stone = this.standard(0x6a5a4a, { roughness: 0.85 });
    const slab = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.2, 3.4, 0.5)), stone);
    slab.position.y = 1.7;
    this.portal.add(slab);

    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.25, 0.3, 3.8, 12)), stone);
      pillar.position.set(s * 1.85, 1.9, 0);
      this.portal.add(pillar);
    }

    // ── side A: intervention ──
    const faceA = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(2.6, 2.6)),
      this.emissive(0x3a2a4a, 0.3),
    );
    faceA.position.set(0, 1.8, 0.26);
    this.portal.add(faceA);
    this.faceA = faceA;

    this.gestureTrail = new Filament(scope, 22, 0.022, this.emissive(0xe8a33a, 1.4));
    this.gestureTrail.group.position.set(0, 1.8, 0.32);
    this.portal.add(this.gestureTrail.group);
    this.drawGesture(0);
    this.gestureTrail.setVisible(false);

    const labelA = buildLabel(scope, 'Parable — draw a miracle', 1.5);
    labelA.position.set(0, 3.5, 0.28);
    this.portal.add(labelA);
    scope.track(labelA.geometry);

    // ── side B: patience ──
    const faceB = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(2.6, 2.6)),
      this.emissive(0x1e3428, 0.3),
    );
    faceB.position.set(0, 1.8, -0.26);
    faceB.rotation.y = Math.PI;
    this.portal.add(faceB);

    this.crop = new THREE.Group();
    this.crop.position.set(0, 0.9, -0.7);
    this.portal.add(this.crop);

    const bed = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.4, 0.3, 0.7)), this.standard(0x4a3a2a, { roughness: 0.95 }));
    bed.position.y = 0.15;
    this.crop.add(bed);

    const stemMat = this.emissive(0x7fd67f, 0.5);
    for (let i = 0; i < this.scaled(5); i++) {
      const stem = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.03, 0.045, 0.6, 6)), stemMat);
      stem.position.set(-0.5 + i * 0.25, 0.3, 0);
      stem.scale.y = 0.001;
      this.crop.add(stem);
      this.cropParts.push(stem);

      const bloom = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.09, 0)), this.emissive(0xe8c65a, 0.9));
      bloom.position.set(-0.5 + i * 0.25, 0.62, 0);
      bloom.visible = false;
      this.crop.add(bloom);
      this.cropParts.push(bloom);
    }

    const labelB = buildLabel(scope, 'Starlight Acre — plant and wait', 1.5);
    labelB.position.set(0, 3.5, -0.28);
    labelB.rotation.y = Math.PI;
    this.portal.add(labelB);
    scope.track(labelB.geometry);

    // ── controls, one per face, physically apart ──
    this.control({
      object: faceA,
      label: 'Draw a miracle',
      description:
        'One verb, implemented deeply. The gesture is the act rather than a menu choice, and the world answers on the same frame.',
      activate: () => {
        this.gesture = (this.gesture + 1) % GESTURES.length;
        this.drawGesture(this.gesture);
        this.gestureTrail.setVisible(true);
        this.strikeFlash = 0.8;
        const g = GESTURES[this.gesture];
        this.ctx.announce(`${g.name}. ${g.effect}`);
      },
    });

    this.control({
      object: this.crop,
      label: 'Tend the bed',
      description:
        'Power, water and nutrients come from one shared budget, so watering costs something that is also keeping the station alive.',
      activate: () => {
        this.growth = (this.growth + 1) % GROWTH.length;
        const g = GROWTH[this.growth];
        this.ctx.announce(`${g.stage}. ${g.note}`);
      },
    });
  }

  private faceA!: THREE.Mesh;

  private drawGesture(index: number): void {
    const g = GESTURES[index];
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const a = t * Math.PI * 2 * g.k;
      const r = 0.35 + t * 0.75;
      points.push(new THREE.Vector3(Math.sin(a) * r, Math.cos(a) * r * 0.85, Math.sin(t * Math.PI) * 0.12));
    }
    this.gestureTrail.follow(new THREE.CatmullRomCurve3(points));
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    // Intervention: an immediate flash that fades.
    if (this.strikeFlash > 0) {
      this.strikeFlash = Math.max(0, this.strikeFlash - dt * 1.6);
      const m = this.faceA.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.3 + this.strikeFlash * 1.6;
    }

    // Patience: growth eases in slowly, and never instantly even on reset.
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 1.1);
    for (let i = 0; i < this.cropParts.length; i += 2) {
      const stem = this.cropParts[i];
      const bloom = this.cropParts[i + 1];
      const target = this.growth === 0 ? 0.001 : this.growth === 1 ? 0.5 : 1;
      stem.scale.y += (target - stem.scale.y) * rate;
      stem.position.y = 0.3 * stem.scale.y + 0.15;
      bloom.visible = this.growth >= 2;
      bloom.position.y = 0.15 + stem.scale.y * 0.62;
    }

    if (!this.reducedMotion) this.portal.rotation.y += dt * 0.02;
  }

  protected override onReset(): void {
    this.gesture = -1;
    this.growth = 0;
    this.strikeFlash = 0;
    if (this.gestureTrail) this.gestureTrail.setVisible(false);
    if (this.portal) this.portal.rotation.set(0, 0, 0);
    if (this.faceA) (this.faceA.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
    for (let i = 0; i < this.cropParts.length; i += 2) {
      this.cropParts[i].scale.y = 0.001;
      this.cropParts[i + 1].visible = false;
    }
  }

  protected override describeState(): string {
    const side = this.gesture < 0
      ? 'No miracle has been drawn on the Parable face.'
      : `The Parable face shows a ${GESTURES[this.gesture].name.toLowerCase()} gesture.`;
    return `${side} On the Starlight Acre face the bed is ${GROWTH[this.growth].stage.toLowerCase()}. ${GROWTH[this.growth].note}`;
  }
}
