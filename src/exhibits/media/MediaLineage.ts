import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E16 — Performance Capture & Media Transformation. */

const STAGES = [
  { name: 'Source motion', colour: 0xcbb39b, note: 'A safe prerecorded performer fixture supplies movement. The museum does not request a camera.' },
  { name: 'PerformanceFrame', colour: 0x63c7e6, note: 'Movement becomes portable performer state rather than durable camera pixels.' },
  { name: 'Character rig', colour: 0x9d8bff, note: 'The same recorded state drives a different authorized character representation.' },
  { name: 'Soft alpha matte', colour: 0x7fd67f, note: 'Continuous alpha preserves soft edges and temporal stability instead of a binary cut.' },
  { name: 'Composite', colour: 0xe8c65a, note: 'Character output and background are combined.' },
  { name: 'Verified artifact', colour: 0xf1e3a2, note: 'Duration, frames, audio and transparency are checked before the export counts.' },
] as const;

const BACKGROUNDS = ['studio', 'night museum', 'transparent'] as const;
const CHARACTERS = ['reference A', 'reference B', 'wireframe'] as const;

export class MediaLineage extends ExhibitBase {
  private stages = this.tracked<THREE.Mesh>();
  private characterVariants = this.tracked<THREE.Group>();
  private backgroundVariants = this.tracked<THREE.Group>();
  private performanceMarkers = this.tracked<THREE.Mesh>();
  private verificationLamps = this.tracked<THREE.Mesh>();
  private stage = 0;
  private character = 0;
  private background = 0;
  private pulse!: Pulse;
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private travelling = false;
  private sourceRig!: THREE.Group;
  private sourceLeftArm!: THREE.Mesh;
  private sourceRightArm!: THREE.Mesh;
  private outputFrame!: THREE.Mesh;
  private mattePlate!: THREE.Mesh;

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.1, -6.5); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(3.0, 0, -4.2); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    const metal = this.standard(0x3f464b, { roughness: 0.45, metalness: 0.5 });
    const railPoints: THREE.Vector3[] = [];
    STAGES.forEach((stage, i) => {
      const x = -3.1 + i * 1.22;
      const mesh = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.92, 1.25, 0.12)), this.standard(stage.colour, { roughness: 0.55 }));
      mesh.position.set(x, 1.55, -4.5); this.group.add(mesh); this.stages.push(mesh);
      const label = buildLabel(scope, stage.name, 0.86); label.position.set(x, 2.45, -4.4); this.group.add(label); scope.track(label.geometry);
      railPoints.push(new THREE.Vector3(x, 3.0, -4.35));
      if (i > 0) {
        const a = railPoints[i - 1]; const b = railPoints[i];
        this.curves.push(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.18, 0)), b]));
      }
    });
    const rail = new Filament(scope, this.scaled(26), 0.018, metal); rail.follow(new THREE.CatmullRomCurve3(railPoints)); this.group.add(rail.group);
    this.pulse = new Pulse(scope, 0.09, this.emissive(0xffffff, 1.8)); this.group.add(this.pulse.mesh);

    // A physical source fixture makes "performance" visible before it becomes data.
    this.sourceRig = new THREE.Group();
    this.sourceRig.name = 'E16 source performer';
    this.sourceRig.position.set(-2.05, 0.95, -2.65);
    this.group.add(this.sourceRig);

    const sourceMat = this.standard(0xcbb39b, { roughness: 0.78 });
    const sourceTorso = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.22, 0.72, 5, 10)), sourceMat);
    sourceTorso.position.y = 0.65; this.sourceRig.add(sourceTorso);
    const sourceHead = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.2, 14, 10)), sourceMat);
    sourceHead.position.y = 1.48; this.sourceRig.add(sourceHead);
    this.sourceLeftArm = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.72, 0.12)), sourceMat);
    this.sourceLeftArm.position.set(-0.33, 0.74, 0); this.sourceLeftArm.rotation.z = 0.35; this.sourceRig.add(this.sourceLeftArm);
    this.sourceRightArm = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.72, 0.12)), sourceMat);
    this.sourceRightArm.position.set(0.33, 0.74, 0); this.sourceRightArm.rotation.z = -0.35; this.sourceRig.add(this.sourceRightArm);

    const sourceLabel = buildLabel(scope, 'SOURCE MOTION · SAFE FIXTURE', 1.75);
    sourceLabel.position.set(-2.05, 2.7, -2.65); this.group.add(sourceLabel); scope.track(sourceLabel.geometry);

    // PerformanceFrame markers are deliberately abstract. They are the portable
    // movement representation, not stored camera pixels or a second identity.
    const markerMat = this.emissive(0x63c7e6, 1.25);
    const markerPositions = [
      [-2.05, 2.38, -2.58],
      [-2.05, 1.82, -2.58],
      [-2.38, 1.55, -2.58],
      [-1.72, 1.55, -2.58],
      [-2.05, 1.12, -2.58],
    ] as const;
    for (const [x, y, z] of markerPositions) {
      const marker = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.055, 10, 8)), markerMat);
      marker.position.set(x, y, z); marker.visible = false; this.group.add(marker); this.performanceMarkers.push(marker);
    }

    // Output bay: character and background are separate visible layers so the
    // visitor can change either without changing the captured performance.
    this.outputFrame = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(2.55, 2.45, 0.09)),
      this.emissive(0x9d8bff, 0.18),
    );
    this.outputFrame.position.set(1.65, 1.78, -2.78); this.group.add(this.outputFrame);
    const outputLabel = buildLabel(scope, 'OUTPUT PREVIEW · SAME PERFORMANCE', 2.3);
    outputLabel.position.set(1.65, 3.25, -2.74); this.group.add(outputLabel); scope.track(outputLabel.geometry);

    const studio = new THREE.Group(); studio.name = 'E16 background studio'; this.group.add(studio); this.backgroundVariants.push(studio);
    const studioPanel = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.15, 1.95, 0.035)), this.standard(0x657786, { roughness: 0.9 }));
    studioPanel.position.set(1.65, 1.78, -2.70); studio.add(studioPanel);
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.04, 1.6, 0.02)), this.emissive(0x9bc5d6, 0.25));
      stripe.position.set(0.95 + i * 0.7, 1.78, -2.675); studio.add(stripe);
    }

    const night = new THREE.Group(); night.name = 'E16 background night museum'; this.group.add(night); this.backgroundVariants.push(night);
    const nightPanel = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.15, 1.95, 0.035)), this.standard(0x111827, { roughness: 0.96 }));
    nightPanel.position.set(1.65, 1.78, -2.70); night.add(nightPanel);
    for (let i = 0; i < 7; i++) {
      const star = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.025, 8, 6)), this.emissive(0xb8d9ff, 1.1));
      star.position.set(0.8 + (i % 4) * 0.55, 1.15 + Math.floor(i / 4) * 0.72, -2.665); night.add(star);
    }
    const museumLine = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.65, 0.26, 0.04)), this.standard(0x263746, { roughness: 0.7 }));
    museumLine.position.set(1.65, 1.15, -2.66); night.add(museumLine);

    const transparent = new THREE.Group(); transparent.name = 'E16 background transparent'; this.group.add(transparent); this.backgroundVariants.push(transparent);
    const checkerA = this.standard(0xd7d7d7, { roughness: 0.95 });
    const checkerB = this.standard(0x8d8d8d, { roughness: 0.95 });
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const tile = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.52, 0.46, 0.025)), (row + col) % 2 === 0 ? checkerA : checkerB);
        tile.position.set(0.87 + col * 0.52, 1.09 + row * 0.46, -2.69); transparent.add(tile);
      }
    }

    const referenceA = new THREE.Group(); referenceA.name = 'E16 character reference A'; this.group.add(referenceA); this.characterVariants.push(referenceA);
    const aMat = this.standard(0x63c7e6, { roughness: 0.5, metalness: 0.15 });
    const aBody = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.24, 0.78, 5, 10)), aMat); aBody.position.set(1.65, 1.62, -2.57); referenceA.add(aBody);
    const aHead = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.22, 14, 10)), aMat); aHead.position.set(1.65, 2.48, -2.57); referenceA.add(aHead);

    const referenceB = new THREE.Group(); referenceB.name = 'E16 character reference B'; this.group.add(referenceB); this.characterVariants.push(referenceB);
    const bMat = this.standard(0x9d8bff, { roughness: 0.42, metalness: 0.32 });
    const bBody = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.58, 1.0, 0.24)), bMat); bBody.position.set(1.65, 1.62, -2.57); referenceB.add(bBody);
    const bHead = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.26, 1)), bMat); bHead.position.set(1.65, 2.47, -2.57); referenceB.add(bHead);

    const wire = new THREE.Group(); wire.name = 'E16 character wireframe'; this.group.add(wire); this.characterVariants.push(wire);
    const wireMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xb7ffd0, wireframe: true }));
    const wireBody = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.62, 1.02, 0.28)), wireMat); wireBody.position.set(1.65, 1.62, -2.55); wire.add(wireBody);
    const wireHead = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.28, 1)), wireMat); wireHead.position.set(1.65, 2.48, -2.55); wire.add(wireHead);

    this.mattePlate = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(1.05, 1.95)),
      scope.track(new THREE.MeshBasicMaterial({ color: 0x7fd67f, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })),
    );
    this.mattePlate.name = 'E16 soft alpha matte';
    this.mattePlate.position.set(1.65, 1.82, -2.52); this.mattePlate.visible = false; this.group.add(this.mattePlate);

    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.055, 10, 8)), this.emissive(0x7fd67f, 0.08));
      lamp.name = `E16 verification lamp ${i + 1}`;
      lamp.position.set(0.92 + i * 0.48, 0.88, -2.48); this.group.add(lamp); this.verificationLamps.push(lamp);
    }
    const verifyLabel = buildLabel(scope, 'FRAMES · DURATION · AUDIO · ALPHA', 2.05);
    verifyLabel.position.set(1.65, 0.62, -2.5); this.group.add(verifyLabel); scope.track(verifyLabel.geometry);

    const advance = buildConsole(scope, 0.72, 0.48, 1.0, metal); advance.position.set(0, 0, -2.2); this.group.add(advance);
    const advanceLabel = buildLabel(scope, 'ADVANCE PIPELINE', 0.72); advanceLabel.position.set(0, 1.02, 0.2); advanceLabel.rotation.x = -Math.PI / 2.1; advance.add(advanceLabel); scope.track(advanceLabel.geometry);
    this.control({
      object: advance,
      label: 'Advance the performance/media pipeline',
      description: 'Moves the same performance through state capture, character rendering, alpha matting, compositing, and artifact verification.',
      activate: () => {
        if (this.travelling) return;
        if (this.stage >= STAGES.length - 1) { this.stage = 0; this.applyVisualState(); this.ctx.announce(`${STAGES[0].name}. ${STAGES[0].note}`); return; }
        this.travelling = true; this.pulse.start();
      },
    });

    const character = buildConsole(scope, 0.62, 0.44, 1.0, metal); character.position.set(-2.25, 0, -1.25); this.group.add(character);
    const characterLabel = buildLabel(scope, 'CHARACTER', 0.62); characterLabel.position.set(0, 1.02, 0.2); characterLabel.rotation.x = -Math.PI / 2.1; character.add(characterLabel); scope.track(characterLabel.geometry);
    this.control({
      object: character,
      label: 'Change character representation',
      description: 'Changes the visible rendering target while preserving the same captured performance state.',
      activate: () => {
        this.character = (this.character + 1) % CHARACTERS.length;
        this.applyVisualState();
        this.ctx.announce(`Character ${CHARACTERS[this.character]}. The PerformanceFrame did not change.`);
      },
    });

    const background = buildConsole(scope, 0.62, 0.44, 1.0, metal); background.position.set(2.25, 0, -1.25); this.group.add(background);
    const backgroundLabel = buildLabel(scope, 'BACKGROUND', 0.62); backgroundLabel.position.set(0, 1.02, 0.2); backgroundLabel.rotation.x = -Math.PI / 2.1; background.add(backgroundLabel); scope.track(backgroundLabel.geometry);
    this.control({
      object: background,
      label: 'Change composite background',
      description: 'Changes the visible output background independently from the captured performance and selected character.',
      activate: () => {
        this.background = (this.background + 1) % BACKGROUNDS.length;
        this.applyVisualState();
        this.ctx.announce(`Background: ${BACKGROUNDS[this.background]}. Captured motion and character state remain unchanged.`);
      },
    });

    // Historical app lineage remains visible but secondary.
    const lineage = buildLabel(scope, 'LINEAGE WALL: Guy_Cast → Gay_Cast · Media Getter', 3.7);
    lineage.position.set(0, 4.05, -6.05); this.group.add(lineage); scope.track(lineage.geometry);
    const privacy = buildLabel(scope, 'Museum fixture only · no camera requested · performance state ≠ camera pixels', 3.8);
    privacy.position.set(0, 3.7, -6.05); this.group.add(privacy); scope.track(privacy.geometry);

    this.applyVisualState();
  }

  private applyVisualState(): void {
    for (let i = 0; i < this.characterVariants.length; i++) this.characterVariants[i].visible = i === this.character;
    for (let i = 0; i < this.backgroundVariants.length; i++) this.backgroundVariants[i].visible = i === this.background;
    for (const marker of this.performanceMarkers) marker.visible = this.stage >= 1;
    this.mattePlate.visible = this.stage >= 3;

    const frameMat = this.outputFrame.material as THREE.MeshStandardMaterial;
    frameMat.emissive.setHex(this.stage >= 2 ? 0x9d8bff : 0x4f5863);
    frameMat.emissiveIntensity = this.stage >= 2 ? 0.72 : 0.18;

    for (const lamp of this.verificationLamps) {
      const mat = lamp.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(this.stage >= 5 ? 0x7fd67f : 0x4b554f);
      mat.emissiveIntensity = this.stage >= 5 ? 1.4 : 0.08;
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.travelling && this.pulse.isRunning) {
      const curve = this.curves[Math.min(this.curves.length - 1, this.stage)];
      if (this.pulse.update(dt, curve, this.reducedMotion ? 5 : 1.4)) {
        this.stage = Math.min(STAGES.length - 1, this.stage + 1); this.travelling = false;
        this.applyVisualState();
        this.ctx.announce(`${STAGES[this.stage].name}. ${STAGES[this.stage].note}`);
      }
    }
    for (let i = 0; i < this.stages.length; i++) {
      const mat = this.stages[i].material as THREE.MeshStandardMaterial;
      const target = i === this.stage ? 1 : 0.55;
      mat.emissive.setHex(STAGES[i].colour); mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
      const lift = i === this.stage ? 0.12 : 0;
      this.stages[i].position.y += ((1.55 + lift) - this.stages[i].position.y) * (this.reducedMotion ? 1 : Math.min(1, dt * 5));
    }

    if (!this.reducedMotion) {
      const swing = Math.sin(this.elapsed * 2.2) * 0.22;
      this.sourceLeftArm.rotation.z = 0.35 + swing;
      this.sourceRightArm.rotation.z = -0.35 - swing;
      this.sourceRig.rotation.y = Math.sin(this.elapsed * 0.75) * 0.08;
    }
  }

  protected override onReset(): void {
    this.stage = 0; this.character = 0; this.background = 0; this.travelling = false; this.pulse.stop();
    this.sourceLeftArm.rotation.z = 0.35; this.sourceRightArm.rotation.z = -0.35; this.sourceRig.rotation.y = 0;
    this.applyVisualState();
  }

  protected override describeState(): string {
    return `Pipeline at ${STAGES[this.stage].name}. Character: ${CHARACTERS[this.character]}. Background: ${BACKGROUNDS[this.background]}. The output preview visibly changes while the same performance state survives both presentation choices.`;
  }
}
