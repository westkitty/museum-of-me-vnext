import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial, Filament } from '../parts';
import { fibonacciSphere, rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E23 — Sensemaking Lab. Tier B.
 *
 * A globe that layers independently ordinary data until the combination
 * produces a question, and a language wall that translates without sending
 * anything anywhere. The two halves share a premise: the useful property is
 * where the work happens, not how clever the model is.
 *
 * CONSTRAINT: no live map service and no translation API. Every layer and every
 * phrase in this room is bundled sample data.
 */

interface Layer {
  readonly name: string;
  readonly colour: number;
  readonly count: number;
  readonly radius: number;
  readonly note: string;
}

const LAYERS: readonly Layer[] = [
  { name: 'Flights', colour: 0xe8c65a, count: 60, radius: 1.32, note: 'Ordinary on its own. Everyone has seen this map.' },
  { name: 'Undersea cables', colour: 0x3fb9b2, count: 26, radius: 1.02, note: 'Also ordinary. Also seen a hundred times.' },
  { name: 'Tectonic boundaries', colour: 0xd97a4e, count: 34, radius: 1.01, note: 'Geology, unrelated to either of the above.' },
  { name: 'Seismic events', colour: 0xd9543a, count: 40, radius: 1.05, note: 'Now the layers start asking each other questions.' },
];

const PHRASES = [
  { es: '¿Dónde le duele?', en: 'Where does it hurt?', note: 'Medical intake. Exactly the conversation you would not send to a cloud service.' },
  { es: 'No entiendo el formulario.', en: 'I do not understand the form.', note: 'Institutional. The stakes are in the accuracy, not the fluency.' },
  { es: 'Necesito hablar con un abogado.', en: 'I need to speak with a lawyer.', note: 'Legal. Privacy is the requirement, and a slightly smaller model is the price.' },
] as const;

export class SensemakingLab extends ExhibitBase {
  private globe!: THREE.Group;
  private layerGroups = this.tracked<THREE.Group>();
  private layerOn = this.tracked<boolean>();
  private layerLamps = this.tracked<THREE.Mesh>();
  private phraseDial!: Dial;
  private phrase = 0;
  private correlationsShown = false;
  private correlations = this.tracked<Filament>();

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
    lectern.position.set(3.4, 0, -5.2);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const steel = this.standard(0x9aa4a6, { roughness: 0.35, metalness: 0.6 });

    // ── the globe ──
    const plinth = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.8, 1.0, 1.0, 20)), steel);
    plinth.position.set(-1.6, 0.5, -4.0);
    this.group.add(plinth);

    this.globe = new THREE.Group();
    this.globe.position.set(-1.6, 2.5, -4.0);
    this.group.add(this.globe);

    const sphere = new THREE.Mesh(
      scope.track(new THREE.IcosahedronGeometry(1.0, 4)),
      this.standard(0x22323f, { roughness: 0.9, metalness: 0.1 }),
    );
    this.globe.add(sphere);

    const graticule = new THREE.Mesh(
      scope.track(new THREE.SphereGeometry(1.005, 24, 16)),
      scope.track(new THREE.MeshStandardMaterial({ color: 0x4a6a7a, wireframe: true, roughness: 1 })),
    );
    this.globe.add(graticule);

    // ── the layers ──
    const random = rng(23023);
    LAYERS.forEach((layer, i) => {
      const g = new THREE.Group();
      g.visible = false;
      this.globe.add(g);
      this.layerGroups.push(g);
      this.layerOn.push(false);

      const mat = this.emissive(layer.colour, 1.1);
      const points = fibonacciSphere(this.scaled(layer.count), layer.radius);
      if (layer.name === 'Flights' || layer.name === 'Undersea cables') {
        // Arcs between points.
        for (let k = 0; k < points.length - 1; k += 2) {
          const a = points[k];
          const b = points[(k + 7) % points.length];
          const mid = a.clone().lerp(b, 0.5).setLength(layer.radius * (layer.name === 'Flights' ? 1.22 : 1.0));
          const arc = new Filament(scope, 8, 0.008, mat);
          arc.follow(new THREE.CatmullRomCurve3([a, mid, b]));
          g.add(arc.group);
        }
      } else {
        const dotGeo = scope.track(new THREE.SphereGeometry(0.022, 8, 6));
        for (const p of points) {
          const dot = new THREE.Mesh(dotGeo, mat);
          dot.position.copy(p);
          dot.scale.setScalar(0.6 + random() * 1.2);
          g.add(dot);
        }
      }

      // Toggle console per layer.
      const consoleGroup = buildConsole(scope, 0.5, 0.4, 1.0, steel);
      consoleGroup.position.set(-3.6 + i * 0.72, 0, -2.2);
      this.group.add(consoleGroup);

      const lamp = new THREE.Mesh(
        scope.track(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12)),
        this.emissive(layer.colour, 0.08),
      );
      lamp.position.set(0, 1.03, 0);
      consoleGroup.add(lamp);
      this.layerLamps.push(lamp);

      const label = buildLabel(scope, layer.name, 0.56);
      label.position.set(0, 1.02, 0.2);
      label.rotation.x = -Math.PI / 2.1;
      consoleGroup.add(label);
      scope.track(label.geometry);

      this.control({
        object: consoleGroup,
        label: `Raise layer: ${layer.name}`,
        description: `${layer.note} All layers here are bundled sample data — no live map service is contacted.`,
        activate: () => {
          this.layerOn[i] = !this.layerOn[i];
          const on = this.layerOn.filter(Boolean).length;
          this.ctx.announce(
            on >= 3
              ? `${layer.name} ${this.layerOn[i] ? 'raised' : 'lowered'}. ${on} layers together — this is where the questions start. Proximity is not causation.`
              : `${layer.name} ${this.layerOn[i] ? 'raised' : 'lowered'}. ${layer.note}`,
          );
        },
      });
    });

    // ── correlation threads, shown only when enough layers are up ──
    const corrMat = this.emissive(0xf2f2f2, 0.7);
    const corrPoints = fibonacciSphere(this.scaled(8), 1.1);
    for (let i = 0; i < corrPoints.length; i++) {
      const filament = new Filament(scope, 6, 0.006, corrMat);
      const a = corrPoints[i];
      const b = corrPoints[(i + 3) % corrPoints.length];
      filament.follow(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).setLength(1.4), b]));
      filament.setVisible(false);
      this.globe.add(filament.group);
      this.correlations.push(filament);
    }

    // ── the language wall ──
    const wall = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(3.2, 2.4, 0.16)),
      this.standard(0xdde3e1, { roughness: 0.85 }),
    );
    wall.position.set(2.6, 1.7, -5.6);
    this.group.add(wall);

    this.esLabel = buildLabel(scope, PHRASES[0].es, 2.6);
    this.esLabel.position.set(2.6, 2.3, -5.5);
    this.group.add(this.esLabel);
    scope.track(this.esLabel.geometry);

    this.enLabel = buildLabel(scope, PHRASES[0].en, 2.6);
    this.enLabel.position.set(2.6, 1.5, -5.5);
    this.group.add(this.enLabel);
    scope.track(this.enLabel.geometry);

    const offline = buildLabel(scope, 'Runs entirely in the browser. Nothing is transmitted.', 2.8);
    offline.position.set(2.6, 0.85, -5.5);
    this.group.add(offline);
    scope.track(offline.geometry);

    const langConsole = buildConsole(scope, 0.6, 0.46, 1.0, steel);
    langConsole.position.set(2.6, 0, -3.6);
    this.group.add(langConsole);

    this.phraseDial = new Dial(scope, PHRASES.length, 0.22, { handle: this.emissive(0x3fb9b2, 0.8) });
    this.phraseDial.group.position.set(0, 1.04, 0);
    langConsole.add(this.phraseDial.group);

    this.control({
      object: langConsole,
      label: 'Translate a different phrase',
      description:
        'Runs a bundled example through in-browser translation. These are exactly the conversations you would not hand to a cloud service, which is why a slightly smaller local model is the better tool.',
      activate: () => {
        this.phrase = this.phraseDial.advance();
        const p = PHRASES[this.phrase];
        this.ctx.announce(`“${p.es}” — “${p.en}”. ${p.note}`);
      },
    });
  }

  private esLabel!: THREE.Mesh;
  private enLabel!: THREE.Mesh;

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.phraseDial.update(dt);

    for (let i = 0; i < this.layerGroups.length; i++) {
      this.layerGroups[i].visible = this.layerOn[i];
      const lamp = this.layerLamps[i].material as THREE.MeshStandardMaterial;
      const target = this.layerOn[i] ? 1.4 : 0.08;
      lamp.emissiveIntensity += (target - lamp.emissiveIntensity) * Math.min(1, dt * 5);
    }

    // Correlations only appear once enough layers are up to make them meaningful.
    const on = this.layerOn.filter(Boolean).length;
    const show = on >= 3;
    if (show !== this.correlationsShown) {
      this.correlationsShown = show;
      for (const c of this.correlations) c.setVisible(show);
    }

    if (!this.reducedMotion) this.globe.rotation.y += dt * 0.08;
  }

  protected override onReset(): void {
    this.phrase = 0;
    this.correlationsShown = false;
    for (let i = 0; i < this.layerOn.length; i++) {
      this.layerOn[i] = false;
      this.layerGroups[i].visible = false;
    }
    for (const c of this.correlations) c.setVisible(false);
    if (this.phraseDial) {
      this.phraseDial.value = 0;
      this.phraseDial.update(0, true);
    }
    if (this.globe) this.globe.rotation.set(0, 0, 0);
  }

  protected override describeState(): string {
    const on = LAYERS.filter((_l, i) => this.layerOn[i]).map((l) => l.name);
    const globe = on.length === 0
      ? 'No layers are raised on the globe.'
      : `Raised on the globe: ${on.join(', ')}.${on.length >= 3 ? ' Correlation threads are showing — proximity on a map is not causation.' : ''}`;
    const p = PHRASES[this.phrase];
    return `${globe} At the language wall: “${p.es}” translated as “${p.en}”, entirely offline.`;
  }
}
