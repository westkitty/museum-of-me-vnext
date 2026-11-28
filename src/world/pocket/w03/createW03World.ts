import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addPlatform, addRail, addRamp, inRect, paintVertices, type PocketPreviewHandle } from '../kit/worldKit';
import { buildW03Crown } from './w03Crown';
import { buildW03Machine, type Ride } from './w03Machine';
import { buildW03Scenery } from './w03Scenery';
import {
  ARM_HUB, armAligned, armWindowLeft, CROWN, CROWN_RAMP, ESCAPEMENT_GALLERY, FALL_RESET_Y, FORECAST_GALLERY,
  latchOpen, LIFT, LIFT_TOP, liftPhase, liftWindowLeft, ORRERY_LANDING, ORRERY_POS, PLAZA, ROUTE_CHECKPOINTS,
  SHUTTLE_DOCK_A, SHUTTLE_DOCK_B, SHUTTLE_X, shuttleDock, shuttleWindowLeft, SPAWN, STAR_ALCOVE, type Landing,
} from './w03Layout';

export interface W03Snapshot {
  readonly t: number;
  readonly riding: Ride;
  readonly armAligned: boolean;
  readonly armWindowLeft: number;
  readonly armAngle: number;
  readonly liftPhase: string;
  readonly liftWindowLeft: number;
  readonly liftY: number;
  readonly shuttleDock: 'A' | 'B' | null;
  readonly shuttleWindowLeft: number;
  readonly shuttleZ: number;
  readonly checkpoints: readonly string[];
  readonly crownReached: boolean;
  readonly latchesPrimed: readonly boolean[];
  readonly latchesReleased: readonly boolean[];
  readonly starChartAligned: boolean;
  readonly finaleStarted: boolean;
  readonly finaleProgress: number;
  readonly completionEligible: boolean;
  readonly completeRequested: boolean;
  readonly fallResets: number;
}

export interface W03PreviewHandle extends PocketPreviewHandle {
  getSnapshot(): W03Snapshot;
}

const FINALE_SECONDS = 10;
const LATCH_NAMES = ['north', 'western', 'eastern'] as const;

/**
 * W03 Clockwork Sundial.
 *
 * Act I: Gnomon Plaza and the turnstile bridge, which aligns on a published
 * rhythm (forecast lamps: green open, amber two seconds before change).
 * Act II: the piston lift to the Escapement Gallery, the shuttle to the
 * Orrery Landing, and the turning crown gear to the Sundial Crown ramp. An
 * optional star-chart alcove adds a constellation to the finale. Act III:
 * prime three sun latches; each releases when the gnomon's shadow reaches it
 * (no timing needed: priming early simply waits). Freed, the captive sun
 * rises and the dusk turns to dawn; the sun gate then completes the world.
 */
export function createW03WorldFactory(onReady?: (handle: W03PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W03 load aborted', 'AbortError');
    const { scope, root } = ctx;
    const fog = new THREE.Fog(0x3a2f40, 40, 260);
    const scenery = buildW03Scenery(ctx, fog);

    const brass = scope.track(new THREE.MeshStandardMaterial({ color: 0xb48a4e, metalness: 0.85, roughness: 0.34 }));
    const iron = scope.track(new THREE.MeshStandardMaterial({ color: 0x34343c, metalness: 0.65, roughness: 0.55 }));
    const plate = scope.track(new THREE.MeshStandardMaterial({ color: 0x8c6a3e, metalness: 0.7, roughness: 0.45 }));
    const stone = scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));

    // ---- Static landings (visible slab + collider) and their railings.
    const top = new THREE.Color(0xb7a58a);
    const side = new THREE.Color(0x8d7a63);
    const band = new THREE.Color(0xa58c69);
    const landing = (def: Landing, depth: number) => {
      const mesh = addPlatform(ctx, stone, { ...def, depth });
      mesh.geometry.computeVertexNormals();
      const nrm = mesh.geometry.getAttribute('normal');
      let i = 0;
      paintVertices(mesh.geometry, (_x, y, _z, out) => {
        const up = nrm.getY(i++) > 0.6;
        if (up) out.copy(top);
        else out.copy(side).lerp(band, Math.floor((def.y - y) / 0.9) % 2 === 0 ? 0 : 0.6);
      });
      return mesh;
    };
    landing(PLAZA, 3);
    landing(FORECAST_GALLERY, 3);
    landing(ESCAPEMENT_GALLERY, 3.5);
    landing(ORRERY_LANDING, 3.5);
    landing(STAR_ALCOVE, 2.5);
    landing(CROWN, 4.5);
    const ramp = addRamp(ctx, plate, { ...CROWN_RAMP, depth: 0.6, rails: true });
    ramp.name = 'w03-crown-ramp';

    // Iron support columns under every landing, into the clockwork abyss.
    const columnGeo = scope.track(new THREE.CylinderGeometry(0.7, 1.0, 30, 10));
    const columns: [number, number, number][] = [
      [-6, 0, 30], [6, 0, 30], [-4, 0, -2], [4, 0, -2], [12, 5, -4], [20, 5, -4], [12, 5, -36], [22, 5, -36],
      [27, 5, -36], [-22, 12, -56], [-16, 12, -46], [-2, 8.6, -51],
    ];
    const columnMesh = new THREE.InstancedMesh(columnGeo, iron, columns.length);
    const m = new THREE.Matrix4();
    columns.forEach(([x, y, z], i) => columnMesh.setMatrixAt(i, m.makeTranslation(x, y - 3.5 - 15, z)));
    root.add(columnMesh);

    // Brass railings on every edge that drops away; openings only where a
    // crossing meets the landing (those openings are gated by the machine).
    const railSegs: [number, number, number, number, number][] = [
      // Gnomon Plaza (north opening to the turnstile).
      [-8, 22, -2, 22, 0], [2, 22, 8, 22, 0], [-8, 34, 8, 34, 0], [-8, 22, -8, 34, 0], [8, 22, 8, 34, 0],
      // Forecast Gallery (south: turnstile; east: lift).
      [-6, 4, -2, 4, 0], [2, 4, 6, 4, 0], [-6, -8, 6, -8, 0], [-6, -8, -6, 4, 0], [6, -8, 6, -6, 0], [6, -2, 6, 4, 0],
      // Escapement Gallery (west: lift; north: shuttle).
      [10, -10, 10, -6, 5], [10, -2, 10, 2, 5], [10, 2, 22, 2, 5], [22, -10, 22, 2, 5], [10, -10, 15, -10, 5], [19, -10, 22, -10, 5],
      // Orrery Landing (south: shuttle; north: gear; east: star alcove).
      [10, -28, 15, -28, 5], [19, -28, 24, -28, 5], [10, -44, 10, -28, 5], [24, -44, 24, -40, 5], [24, -32, 24, -28, 5],
      [10, -44, 14, -44, 5], [20, -44, 24, -44, 5],
      // Star alcove.
      [24, -40, 30, -40, 5], [24, -32, 30, -32, 5], [30, -40, 30, -32, 5],
      // Sundial Crown (east: ramp).
      [-12, -60, -12, -54, 12], [-12, -48, -12, -42, 12], [-26, -60, -12, -60, 12], [-26, -42, -12, -42, 12], [-26, -60, -26, -42, 12],
    ];
    const railBar = new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(1, 0.1, 0.1)), brass, railSegs.length);
    const postGeo = scope.track(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6));
    const postPositions: [number, number, number][] = [];
    const q = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    railSegs.forEach(([x0, z0, x1, z1, y], i) => {
      addRail(ctx, x0, z0, x1, z1, y);
      const len = Math.hypot(x1 - x0, z1 - z0);
      q.setFromAxisAngle(yAxis, Math.atan2(-(z1 - z0), x1 - x0));
      railBar.setMatrixAt(i, m.compose(new THREE.Vector3((x0 + x1) / 2, y + 1.05, (z0 + z1) / 2), q, new THREE.Vector3(len, 1, 1)));
      const posts = Math.max(1, Math.round(len / 2));
      for (let k = 0; k <= posts; k++) postPositions.push([x0 + ((x1 - x0) * k) / posts, y + 0.52, z0 + ((z1 - z0) * k) / posts]);
    });
    const railPosts = new THREE.InstancedMesh(postGeo, brass, postPositions.length);
    postPositions.forEach(([x, y, z], i) => railPosts.setMatrixAt(i, m.makeTranslation(x, y, z)));
    root.add(railBar, railPosts);

    // Plaza sundial face: an inlaid brass ring and hour marks around the arrival point.
    const faceRing = new THREE.Mesh(scope.track(new THREE.RingGeometry(4.2, 4.5, 48)), brass);
    faceRing.rotation.x = -Math.PI / 2;
    faceRing.position.set(0, 0.012, 28.5);
    const hourMarks = new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(0.1, 0.02, 0.8)), brass, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      hourMarks.setMatrixAt(i, m.compose(new THREE.Vector3(Math.cos(a) * 3.6, 0.012, 28.5 + Math.sin(a) * 3.6),
        q.setFromAxisAngle(yAxis, Math.PI / 2 - a), new THREE.Vector3(1, 1, 1)));
    }
    root.add(faceRing, hourMarks);
    // The decorative orrery on its landing.
    const orrery = new THREE.Group();
    orrery.position.set(...ORRERY_POS);
    const orreryBase = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 12)), iron);
    orreryBase.position.y = 0.6;
    const orrerySun = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.42, 16, 10)),
      scope.track(new THREE.MeshStandardMaterial({ color: 0xffcf7a, emissive: 0xff9a2e, emissiveIntensity: 0.9 })));
    orrerySun.position.y = 1.7;
    orrery.add(orreryBase, orrerySun);
    const orreryArms: THREE.Group[] = [];
    const planetGeo = scope.track(new THREE.SphereGeometry(0.16, 10, 6));
    const armGeo = scope.track(new THREE.BoxGeometry(1, 0.04, 0.04));
    for (let k = 0; k < 4; k++) {
      const armGroup = new THREE.Group();
      armGroup.position.y = 1.7 - k * 0.12;
      const len = 0.8 + k * 0.42;
      const bar = new THREE.Mesh(armGeo, brass);
      bar.scale.x = len;
      bar.position.x = len / 2;
      const planet = new THREE.Mesh(planetGeo, k % 2 ? iron : brass);
      planet.position.x = len;
      armGroup.add(bar, planet);
      orrery.add(armGroup);
      orreryArms.push(armGroup);
    }
    root.add(orrery);
    ctx.collision.addBox([ORRERY_POS[0], ORRERY_POS[1] + 1, ORRERY_POS[2]], [1.0, 1.0, 1.0]);

    const machine = buildW03Machine(ctx, { brass, iron, plate });
    if (signal.aborted) throw new DOMException('W03 load aborted', 'AbortError');
    const crown = buildW03Crown(ctx, { brass, iron });

    // ---- Forecast lamps at every crossing: green open, amber within two
    // seconds of a change, dim red closed. Colour is paired with the lamp
    // rising (open) or sinking (closed), so state never relies on hue alone.
    const lampGeo = scope.track(new THREE.SphereGeometry(0.22, 12, 8));
    const lampPostGeo = scope.track(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6));
    const LAMP = { open: new THREE.Color(0x58ff8a), soon: new THREE.Color(0xffa23a), closed: new THREE.Color(0x5a1a12) };
    type LampState = keyof typeof LAMP;
    const lamps: { mat: THREE.MeshStandardMaterial; mesh: THREE.Mesh; baseY: number; state: () => LampState }[] = [];
    const addLamp = (x: number, y: number, z: number, state: () => LampState) => {
      const post = new THREE.Mesh(lampPostGeo, brass);
      post.position.set(x, y + 0.7, z);
      const mat = scope.track(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x5a1a12, emissiveIntensity: 1.6 }));
      const mesh = new THREE.Mesh(lampGeo, mat);
      mesh.position.set(x, y + 1.55, z);
      root.add(post, mesh);
      lamps.push({ mat, mesh, baseY: y + 1.55, state });
    };
    const reduced = () => ctx.reducedMotion();
    const windowState = (open: boolean, left: number, opensSoon: boolean): LampState => (open ? (left < 1.5 ? 'soon' : 'open') : opensSoon ? 'soon' : 'closed');
    const armState = (): LampState => (reduced() ? 'open' : windowState(armAligned(machine.t), armWindowLeft(machine.t), armAligned(machine.t + 2)));
    addLamp(2.6, 0, 22.5, armState);
    addLamp(-2.6, 0, 3.5, armState);
    const liftState = (want: 'bottom' | 'top') => (): LampState =>
      windowState(liftPhase(machine.t) === want, liftWindowLeft(machine.t), liftPhase(machine.t + 2) === want);
    addLamp(LIFT.minX - 0.5, 0, LIFT.minZ - 0.6, liftState('bottom'));
    addLamp(LIFT.maxX + 0.5, LIFT_TOP, LIFT.minZ - 0.6, liftState('top'));
    const shuttleState = (want: 'A' | 'B') => (): LampState =>
      windowState(shuttleDock(machine.t) === want, shuttleWindowLeft(machine.t), shuttleDock(machine.t + 2) === want);
    addLamp(SHUTTLE_X[1] + 0.6, 5, ESCAPEMENT_GALLERY.minZ + 0.5, shuttleState('A'));
    addLamp(SHUTTLE_X[1] + 0.6, 5, ORRERY_LANDING.maxZ - 0.5, shuttleState('B'));
    void SHUTTLE_DOCK_A; void SHUTTLE_DOCK_B; void ARM_HUB;

    // ---- Route state.
    const checkpoints: string[] = [];
    let crownReached = false;
    const primed = [false, false, false];
    const released = [false, false, false];
    let finaleStarted = false;
    let finaleProgress = 0;
    let completionEligible = false;
    let completeRequested = false;
    let fallResets = 0;
    let announcedArrival = false;
    let time = 0;

    crown.latchObjects.forEach((object, i) => {
      ctx.interaction.register(`w03-latch-${i}`, {
        object,
        label: () => (released[i] ? 'Sun Latch Released' : primed[i] ? 'Latch Primed: Waiting for the Shadow' : 'Prime Sun Latch'),
        description: `The ${LATCH_NAMES[i]} sun latch. Prime it and it releases when the gnomon's shadow reaches it.`,
        activate: () => {
          if (primed[i] || released[i]) return;
          primed[i] = true;
          ctx.announce(reduced() || latchOpen(machine.t, i)
            ? 'The shadow lies on the latch. It springs open.'
            : 'Latch primed. It will release when the gnomon\'s shadow sweeps over it.', 6);
        },
      });
    });
    ctx.interaction.register('w03-star-chart', {
      object: crown.chart,
      label: () => (crown.chartAligned ? 'Star Chart Aligned' : 'Align the Star Chart'),
      description: 'A brass star chart in a quiet alcove. Optional: aligning it adds the constellation to the sunrise.',
      activate: () => {
        if (crown.chartAligned) return;
        crown.alignChart(reduced());
        ctx.announce('The star chart turns into alignment. Its constellation will rise with the sun.', 6);
      },
    });
    ctx.interaction.register('w03-return-gate', {
      object: crown.gate,
      label: () => (completionEligible ? 'Return to the Museum' : 'Sun Gate (closed)'),
      description: 'A brass sun gate that opens after the sunrise. It returns you to the astronomical terrace.',
      activate: () => {
        if (!completionEligible || completeRequested) return;
        completeRequested = true;
        ctx.requestComplete();
      },
    });

    const onLanding = (def: Landing) => {
      const p = ctx.player.position;
      return ctx.player.grounded && inRect(def, p.x, p.z) && Math.abs(p.y - def.y) < 0.35;
    };

    const snapshot = (): W03Snapshot => ({
      t: machine.t, riding: machine.riding,
      armAligned: machine.armAlignedNow(), armWindowLeft: reduced() ? 99 : armWindowLeft(machine.t), armAngle: machine.armAngle,
      liftPhase: liftPhase(machine.t), liftWindowLeft: liftWindowLeft(machine.t), liftY: machine.liftY,
      shuttleDock: shuttleDock(machine.t), shuttleWindowLeft: shuttleWindowLeft(machine.t), shuttleZ: machine.shuttleZ,
      checkpoints: [...checkpoints], crownReached, latchesPrimed: [...primed], latchesReleased: [...released],
      starChartAligned: crown.chartAligned, finaleStarted, finaleProgress, completionEligible, completeRequested, fallResets,
    });
    onReady?.({ getSnapshot: snapshot });

    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      spawnPitch: 0,
      fog,
      background: new THREE.Color(0x3a2f40),
      fieldOfView: 70,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!announcedArrival) {
          announcedArrival = true;
          ctx.announce('Clockwork Sundial. The turnstile bridge aligns on a rhythm: cross when its lamps glow green.', 8);
        }
        machine.fixedUpdate(dt);
        const p = ctx.player.position;
        if (p.y < FALL_RESET_Y) {
          fallResets++;
          ctx.resetToCheckpoint();
          return;
        }
        for (const def of ROUTE_CHECKPOINTS) {
          if (checkpoints.includes(def.id) || !onLanding(def)) continue;
          checkpoints.push(def.id);
          ctx.saveCheckpoint();
          if (def === FORECAST_GALLERY) ctx.announce('The Forecast Gallery. The piston lift rises when its lamp turns amber; step on while it glows green.', 7);
          if (def === ESCAPEMENT_GALLERY) ctx.announce('The Escapement Gallery. The shuttle carries you north to the Orrery Landing.', 7);
          if (def === ORRERY_LANDING) ctx.announce('The Orrery Landing. Ride the turning crown gear to the ramp. A quiet alcove lies east.', 7);
          if (def === CROWN) {
            crownReached = true;
            ctx.announce('The Sundial Crown. Prime the three sun latches; the gnomon\'s shadow releases each in turn.', 8);
          }
        }
        if (crownReached) {
          for (let i = 0; i < 3; i++) {
            if (primed[i] && !released[i] && (reduced() || latchOpen(machine.t, i))) {
              released[i] = true;
              const left = released.filter((r) => !r).length;
              ctx.announce(left ? `A sun latch releases. ${left} remain.` : 'The last latch releases. The captive sun is free.', 6);
            }
          }
          if (!finaleStarted && released.every(Boolean)) {
            finaleStarted = true;
            finaleProgress = reduced() ? 1 : 0;
          }
        }
        if (finaleStarted && finaleProgress < 1) finaleProgress = Math.min(1, finaleProgress + dt / FINALE_SECONDS);
        if (finaleStarted && finaleProgress >= 1 && !completionEligible) {
          completionEligible = true;
          ctx.markCompletionEligible();
          crown.showGate();
          ctx.announce('Dawn over the Clockwork Sundial. The sun gate is open: step through to return to the museum.', 8);
        }
      },
      variableUpdate(dt) {
        time += dt;
        const r = reduced();
        machine.syncVisuals();
        scenery.update(time, finaleProgress, r);
        crown.update(machine.t, time, released, primed, finaleProgress, r);
        for (const lamp of lamps) {
          const state = lamp.state();
          lamp.mat.emissive.copy(LAMP[state]);
          lamp.mesh.position.y = lamp.baseY + (state === 'open' ? 0.12 : state === 'closed' ? -0.12 : 0);
        }
        if (!r) orreryArms.forEach((a, k) => { a.rotation.y = time * (0.6 / (k + 1)); });
      },
      dispose() {
        machine.dispose();
      },
    };
  };
}
