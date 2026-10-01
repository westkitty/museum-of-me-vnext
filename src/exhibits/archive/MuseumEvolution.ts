import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E09 — Museum Evolution, plus the engineering toolkit it produced and a rotating NOW BUILDING surface. */

interface Generation {
  readonly name: string;
  readonly form: 'document' | 'rooms' | 'monolith' | 'building';
  readonly note: string;
  readonly colour: number;
}

const GENERATIONS: readonly Generation[] = [
  { name: 'Museum of Me, concept', form: 'document', colour: 0x8a7a9a, note: 'Closer to an interactive document than a building. Content was organised by page rather than by space.' },
  { name: 'The Reliquary, early', form: 'rooms', colour: 0x9d8bff, note: 'Rooms appeared, but as separate scenes rather than one continuous place.' },
  { name: 'The Reliquary, restored', form: 'monolith', colour: 0xc3a8ec, note: 'One enormous single-file Three.js artifact. It proved the idea and exposed the cost of making one file own everything.' },
  { name: 'vNext — active development', form: 'building', colour: 0xe8c65a, note: 'A separate lineage that preserves the old artifacts while continuing to change. This is not treated as a finished 1.0 museum.' },
];

const TOOLKIT_DEMOS = ['tactics table', 'ray-cast labyrinth', 'fixed-step character course', 'verified GLB adventure', 'raw WebGL arena', 'accessible puzzle museum', 'IK telemetry', 'crowd lab', 'strategy globe', 'WebGPU field'] as const;

export class MuseumEvolution extends ExhibitBase {
  private models = this.tracked<THREE.Group>();
  private dial!: Dial;
  private index = 0;
  private toolkitIndex = 0;
  private currentWorkLit = false;
  private toolkitNode!: THREE.Mesh;
  private nowBuilding!: THREE.Mesh;

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.2, -7.2); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(3.2, 0, -4.6); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    const wood = this.standard(0x5d4d70, { roughness: 0.75 });
    const bronze = this.standard(0x8a6a42, { roughness: 0.35, metalness: 0.7 });

    const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.3, 0.1, 2.3)), wood); top.position.set(-0.7, 0.9, -4.2); this.group.add(top);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.14, 0.9, 1.9)), bronze); leg.position.set(-0.7 + sx * 1.45, 0.45, -4.2); this.group.add(leg); }

    GENERATIONS.forEach((generation) => {
      const model = this.buildGeneration(generation); model.position.set(-0.7, 0.98, -4.2); model.visible = false; this.group.add(model); this.models.push(model);
    });
    this.models[0].visible = true;

    const timeline = buildConsole(scope, 0.64, 0.48, 1.0, wood); timeline.position.set(-0.7, 0, -1.9); this.group.add(timeline);
    this.dial = new Dial(scope, GENERATIONS.length, 0.24, { handle: this.emissive(0xc3a8ec, 0.8) }); this.dial.group.position.set(0, 1.04, 0); timeline.add(this.dial.group);
    const timelineLabel = buildLabel(scope, 'TURN THE TIMELINE', 0.72); timelineLabel.position.set(0, 1.02, 0.22); timelineLabel.rotation.x = -Math.PI / 2.1; timeline.add(timelineLabel); scope.track(timelineLabel.geometry);
    this.control({ object: timeline, label: 'Turn the museum timeline', description: 'Steps through the museum’s own forms. The current building is described as active development, not as a completed release.', activate: () => {
      this.index = this.dial.advance(); const g = GENERATIONS[this.index]; this.ctx.announce(`${g.name}. ${g.note}`);
    }});

    // Toolkit: the museum's engineering lessons escaped into a separate runnable project.
    this.toolkitNode = new THREE.Mesh(scope.track(new THREE.DodecahedronGeometry(0.62, 0)), this.emissive(0x68b7d5, 0.8));
    this.toolkitNode.position.set(2.25, 1.7, -4.1); this.group.add(this.toolkitNode);
    const toolkitLabel = buildLabel(scope, 'MODERN 3D BROWSER GAME TOOLKIT', 2.25); toolkitLabel.position.set(2.25, 2.65, -4.1); this.group.add(toolkitLabel); scope.track(toolkitLabel.geometry);
    this.control({ object: this.toolkitNode, label: 'Inspect the architecture toolkit', description: 'Cycles through ten runnable demonstrations whose architecture differs because their requirements differ.', activate: () => {
      this.toolkitIndex = (this.toolkitIndex + 1) % TOOLKIT_DEMOS.length;
      this.ctx.announce(`Toolkit demo ${this.toolkitIndex + 1}/10: ${TOOLKIT_DEMOS[this.toolkitIndex]}. The museum produced lessons that became a project independent of the museum.`);
    }});

    // Rotating surface outside the permanent 35-project mapping.
    this.nowBuilding = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.0, 1.05, 0.12)), this.emissive(0xd98258, 0.28));
    this.nowBuilding.position.set(2.25, 1.0, -2.25); this.group.add(this.nowBuilding);
    const nowLabel = buildLabel(scope, 'NOW BUILDING', 1.35); nowLabel.position.set(2.25, 1.8, -2.18); this.group.add(nowLabel); scope.track(nowLabel.geometry);
    const workLabel = buildLabel(scope, 'Every Fight Is Followed By A Century', 1.8); workLabel.position.set(2.25, 0.95, -2.17); this.group.add(workLabel); scope.track(workLabel.geometry);
    this.control({ object: this.nowBuilding, label: 'Inspect current work', description: 'A rotating development surface outside the permanent 35-slot collection. Current example: Immortals — Every Fight Is Followed By A Century.', activate: () => {
      this.currentWorkLit = !this.currentWorkLit;
      this.ctx.announce(this.currentWorkLit
        ? 'NOW BUILDING: Every Fight Is Followed By A Century. Combat can damage a city; a century later reconstruction, public memory, and archaeology respond to what actually happened. This remains current work, not permanent collection canon.'
        : 'NOW BUILDING surface dimmed. Current work remains outside the permanent collection mapping.');
    }});
  }

  private buildGeneration(generation: Generation): THREE.Group {
    const scope = this.ctx.scope; const group = new THREE.Group();
    const mat = this.standard(generation.colour, { roughness: 0.6, metalness: 0.15 });
    const seamMaterial = this.standard(0x6a5a42, { roughness: 0.5, metalness: 0.5 });
    if (generation.form === 'document') {
      for (let i = 0; i < this.scaled(7); i++) { const page = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.5, 0.012, 0.68)), mat); page.position.set(-0.9 + i * 0.3, 0.02 + i * 0.014, 0); page.rotation.y = i * 0.04; group.add(page); }
    } else if (generation.form === 'rooms') {
      for (let i = 0; i < this.scaled(6); i++) { const a = (i / 6) * Math.PI * 2; const room = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.34, 0.2, 0.34)), mat); room.position.set(Math.sin(a) * 0.75, 0.1, Math.cos(a) * 0.55); group.add(room); }
    } else if (generation.form === 'monolith') {
      const block = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.5, 0.62, 0.95)), mat); block.position.y = 0.31; group.add(block);
      for (let i = 0; i < this.scaled(12); i++) { const seam = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.02, 0.64, 0.97)), seamMaterial); seam.position.set(-0.7 + i * 0.12, 0.31, 0); group.add(seam); }
    } else {
      const rotunda = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.34, 0.38, 0.3, 8)), mat); rotunda.position.y = 0.15; group.add(rotunda);
      const dome = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat); dome.position.y = 0.3; group.add(dome);
      const wings: [number, number][] = [[0,-1],[1,0],[0,1],[-1,0]];
      wings.forEach(([dx,dz],i) => { const length = i === 2 ? 1.15 : i === 3 ? 0.5 : 0.95; const wing = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.3,0.2,length)), mat); wing.position.set(dx*(0.32+length/2),0.1,dz*(0.32+length/2)); wing.rotation.y = dx !== 0 ? Math.PI/2 : 0; group.add(wing); });
      const sanctuary = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.16,0.16,0.1,16)), this.standard(0xd9c69a,{roughness:0.9})); sanctuary.position.set(-0.55,0.03,-0.55); group.add(sanctuary);
    }
    const label = buildLabel(scope, generation.name, 1.5); label.position.set(0, 0.86, 0); group.add(label); scope.track(label.geometry); return group;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.dial.update(dt, this.reducedMotion);
    for (let i = 0; i < this.models.length; i++) { const active = i === this.index; this.models[i].visible = active; if (active && !this.reducedMotion) this.models[i].rotation.y += dt * 0.16; }
    if (!this.reducedMotion) this.toolkitNode.rotation.y += dt * 0.32;
    const nm = this.nowBuilding.material as THREE.MeshStandardMaterial; nm.emissiveIntensity += ((this.currentWorkLit ? 1.2 : 0.28) - nm.emissiveIntensity) * Math.min(1, dt * 5);
  }

  protected override onReset(): void {
    this.index = 0; this.toolkitIndex = 0; this.currentWorkLit = false;
    if (this.dial) { this.dial.value = 0; this.dial.update(0, true); }
    this.models.forEach((model, i) => { model.visible = i === 0; model.rotation.set(0,0,0); });
  }

  protected override describeState(): string {
    const g = GENERATIONS[this.index];
    return `Timeline: ${g.name}. Toolkit example: ${TOOLKIT_DEMOS[this.toolkitIndex]}. NOW BUILDING is ${this.currentWorkLit ? 'showing the current Immortals experiment' : 'dimmed'} and remains outside the permanent collection.`;
  }
}
