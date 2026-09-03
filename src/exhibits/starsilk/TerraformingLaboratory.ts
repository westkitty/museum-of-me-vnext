import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E07 — The Drakken Terraforming Laboratory.
 * Museum-scale summary of the current six-station deterministic application.
 */

interface Station {
  readonly name: string;
  readonly colour: number;
  readonly note: string;
}

const STATIONS: readonly Station[] = [
  { name: 'Planet', colour: 0x63b06f, note: 'Commit Heat, Cool, Uplift, Fracture, Pressure, or CO₂ against one shared simulated planet.' },
  { name: 'Macro', colour: 0x63bde0, note: 'Compile and step bounded Starsilk Macro instructions; emitted operations mutate the same planet.' },
  { name: 'Starbinding', colour: 0xe8c65a, note: 'Aim a star-dive vector. A hit may withdraw Starsilk; total depletion collapses the modeled core immediately.' },
  { name: 'Siege Wall', colour: 0x9269bb, note: 'Use heliocide events as sources in a containment solve and expose capacity fracture rather than hiding it.' },
  { name: 'Incubator', colour: 0xd56862, note: 'Hatch deterministic laboratory specimens or an explicitly labeled non-canon Experimental Egg.' },
  { name: 'Telemetry', colour: 0xc7d2d4, note: 'Inspect the ordered mutation ledger without smuggling wall-clock time into deterministic state.' },
] as const;

const PLANET_ACTIONS = ['Heat', 'Cool', 'Uplift', 'Fracture', 'Pressure', 'CO₂'] as const;

export class TerraformingLaboratory extends ExhibitBase {
  private world!: THREE.Mesh;
  private atmosphere!: THREE.Mesh;
  private stationMeshes = this.tracked<THREE.Group>();
  private stationLamps = this.tracked<THREE.Mesh>();
  private pulse!: Pulse;
  private sharedCurves = this.tracked<THREE.CatmullRomCurve3>();
  private activeStation = 0;
  private planetAction = 0;
  private mutationCount = 0;
  private macroStep = 0;
  private stellarStarsilk = 1;
  private collapsed = false;
  private nullified = false;
  private latticeFractured = false;
  private specimen = 0;
  private telemetry = this.tracked<string>();

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.3, -7.3); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(3.6, 0, -5.1); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    this.world = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(2.0, 3)), this.standard(0x6b4a3a, { roughness: 0.9 }));
    this.world.position.set(0, 5.0, -4.0); this.group.add(this.world);
    this.atmosphere = new THREE.Mesh(scope.track(new THREE.SphereGeometry(2.28, 28, 20)), scope.track(new THREE.MeshStandardMaterial({ color: 0x7fb8e0, transparent: true, opacity: 0.08, roughness: 0.1, side: THREE.DoubleSide })));
    this.atmosphere.position.copy(this.world.position); this.group.add(this.atmosphere);

    const deck = new THREE.Mesh(scope.track(new THREE.RingGeometry(2.1, 5.4, 42)), this.standard(0x29283a, { roughness: 0.88 }));
    deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.04, -4.0); this.group.add(deck);

    STATIONS.forEach((station, i) => {
      const a = (i / STATIONS.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 4.35;
      const z = -4.0 + Math.sin(a) * 3.45;
      const c = buildConsole(scope, 0.7, 0.5, 1.0, this.standard(0x343247, { roughness: 0.65 }));
      c.position.set(x, 0, z); c.rotation.y = -a + Math.PI / 2; this.group.add(c); this.stationMeshes.push(c);
      const lamp = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.075, 10, 8)), this.emissive(station.colour, i === 0 ? 1.2 : 0.12));
      lamp.position.set(0, 1.22, 0); c.add(lamp); this.stationLamps.push(lamp);
      const label = buildLabel(scope, `${i + 1}. ${station.name}`, 0.76); label.position.set(0, 1.03, 0.24); label.rotation.x = -Math.PI / 2.1; c.add(label); scope.track(label.geometry);

      const from = new THREE.Vector3(x, 1.15, z);
      const to = this.world.position.clone();
      const curve = new THREE.CatmullRomCurve3([from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.8, 0)), to]);
      this.sharedCurves.push(curve);
      const line = new Filament(scope, this.scaled(14), 0.018, this.standard(0x3a3950, { roughness: 0.8 })); line.follow(curve); this.group.add(line.group);

      this.control({ object: c, label: `Operate ${station.name} station`, description: station.note, activate: () => this.operate(i) });
    });

    this.pulse = new Pulse(scope, 0.1, this.emissive(0xffffff, 1.9)); this.group.add(this.pulse.mesh);

    const nullify = buildConsole(scope, 0.76, 0.5, 1.0, this.standard(0x4f252c, { roughness: 0.6 }));
    nullify.position.set(0, 0, -0.35); this.group.add(nullify);
    const nullLabel = buildLabel(scope, 'SYRIN CONTACT', 0.72); nullLabel.position.set(0, 1.02, 0.2); nullLabel.rotation.x = -Math.PI / 2.1; nullify.add(nullLabel); scope.track(nullLabel.geometry);
    this.control({ object: nullify, label: 'Inject positive Syrin contact', description: 'Any positive contact nullifies the active Starsilk runtime. This is a hard exception, not a resistance roll.', activate: () => {
      if (this.nullified) { this.ctx.announce('Starsilk is already nullified. Only a full laboratory reset restores the runtime.'); return; }
      this.nullified = true; this.telemetry.push('SYRIN_CONTACT → Starsilk runtime inert');
      this.ctx.announce('NULLIFIED. Active Starsilk colour drains from the laboratory. Macro and Starbinding controls remain inert until full reset; ordinary planet physics may still step.');
    }});

    const status = buildLabel(scope, 'ONE SHARED STATE · HARD ZERO-STARSILK COLLAPSE · POSITIVE SYRIN CONTACT NULLIFIES', 4.35);
    status.position.set(0, 4.55, -6.4); this.group.add(status); scope.track(status.geometry);
  }

  private operate(index: number): void {
    this.activeStation = index;
    const station = STATIONS[index];
    if (index === 0) {
      const action = PLANET_ACTIONS[this.planetAction]; this.planetAction = (this.planetAction + 1) % PLANET_ACTIONS.length;
      this.mutationCount++; this.telemetry.push(`PLANET ${action}`); this.pulse.start();
      this.ctx.announce(`${station.name}: committed ${action} at a bounded target cell. Mutation ${this.mutationCount}. Shared planet state changed.`);
    } else if (index === 1) {
      if (this.nullified) { this.ctx.announce('Macro refused. Syrin contact left the Starsilk runtime inert.'); return; }
      this.macroStep++; this.mutationCount++; this.telemetry.push(`MACRO step ${this.macroStep} → EMIT`); this.pulse.start();
      this.ctx.announce(`Macro: deterministic instruction ${this.macroStep} committed. Its EMIT operation changed the same planet visible at the Planet station.`);
    } else if (index === 2) {
      if (this.nullified) { this.ctx.announce('Starbinding refused. The Starsilk runtime is inert after Syrin contact.'); return; }
      if (this.collapsed) { this.ctx.announce('The modeled stellar core has already collapsed. Reset the laboratory before another Starbinding run.'); return; }
      this.stellarStarsilk = Math.max(0, this.stellarStarsilk - 0.5); this.telemetry.push(`STARBINDING withdraw 0.5 → remaining ${this.stellarStarsilk}`); this.pulse.start();
      if (this.stellarStarsilk === 0) { this.collapsed = true; this.ctx.announce('Starbinding HIT. Remaining Starsilk reached exactly zero: immediate heliocide state transition to collapse. There is no warning threshold.'); }
      else this.ctx.announce(`Starbinding HIT. Half the modeled core Starsilk remains: ${this.stellarStarsilk.toFixed(1)}. No collapse occurs above zero.`);
    } else if (index === 3) {
      this.latticeFractured = !this.latticeFractured; this.telemetry.push(`SIEGE_WALL ${this.latticeFractured ? 'capacity fracture' : 'stable solve'}`); this.pulse.start();
      this.ctx.announce(this.latticeFractured ? 'Siege Wall laboratory solve exceeds declared anchoring capacity: persistent FRACTURED state.' : 'Siege Wall laboratory solve is within the declared node-capacity model: stable containment state.');
    } else if (index === 4) {
      const names = ['Fault-Tongue', 'Obsidian Gul', 'Tremorhound', 'Vortenbray', 'Experimental Egg — NON-CANON'];
      this.specimen = (this.specimen + 1) % names.length; this.telemetry.push(`INCUBATOR ${names[this.specimen]}`); this.pulse.start();
      this.ctx.announce(`Incubator: ${names[this.specimen]}. ${this.specimen === names.length - 1 ? 'This specimen is explicitly non-canon.' : 'A deterministic laboratory phenotype path begins against the shared planet.'}`);
    } else {
      const recent = this.telemetry.slice(-4);
      this.ctx.announce(recent.length ? `Telemetry ledger, most recent first: ${recent.reverse().join(' | ')}` : 'Telemetry ledger is empty. No mutation has been committed yet.');
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.pulse.isRunning) this.pulse.update(dt, this.sharedCurves[this.activeStation], this.reducedMotion ? 5 : 0.85);
    for (let i = 0; i < this.stationLamps.length; i++) {
      const mat = this.stationLamps[i].material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity += ((i === this.activeStation ? 1.35 : 0.12) - mat.emissiveIntensity) * Math.min(1, dt * 5);
    }
    const wm = this.world.material as THREE.MeshStandardMaterial;
    if (this.collapsed) wm.color.setHex(0x09090d);
    else if (this.nullified) wm.color.setHex(0x4b4448);
    else if (this.mutationCount >= 6) wm.color.setHex(0x3f7a52);
    else if (this.mutationCount >= 3) wm.color.setHex(0x536647);
    else wm.color.setHex(0x6b4a3a);
    const am = this.atmosphere.material as THREE.MeshStandardMaterial;
    am.opacity += ((this.mutationCount > 0 ? 0.08 + Math.min(0.22, this.mutationCount * 0.025) : 0.06) - am.opacity) * Math.min(1, dt * 2);
    if (!this.reducedMotion) { this.world.rotation.y += dt * 0.08; this.atmosphere.rotation.y -= dt * 0.04; }
  }

  protected override onReset(): void {
    this.activeStation = 0; this.planetAction = 0; this.mutationCount = 0; this.macroStep = 0; this.stellarStarsilk = 1; this.collapsed = false; this.nullified = false; this.latticeFractured = false; this.specimen = 0; this.telemetry.length = 0; this.pulse.stop();
    if (this.world) { this.world.rotation.set(0,0,0); (this.world.material as THREE.MeshStandardMaterial).color.setHex(0x6b4a3a); }
  }

  protected override describeState(): string {
    return `Active station: ${STATIONS[this.activeStation].name}. Shared planet mutations: ${this.mutationCount}. Stellar Starsilk: ${this.stellarStarsilk.toFixed(1)}${this.collapsed ? ' — collapsed' : ''}. Starsilk runtime: ${this.nullified ? 'NULLIFIED' : 'active'}. Siege Wall lab state: ${this.latticeFractured ? 'fractured' : 'stable/not driven'}. Telemetry entries: ${this.telemetry.length}.`;
  }
}
