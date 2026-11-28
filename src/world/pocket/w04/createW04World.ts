import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { addPlatform, addRail, addRamp, inRect, type PocketPreviewHandle } from '../kit/worldKit';
import { buildEqStair, buildSequencerBridge } from './w04Mechanisms';
import { buildW04Scenery, rectGrid } from './w04Scenery';
import {
  beatPulse, BSIDE_ALCOVE, BSIDE_POS, DECK, EQ_CONSOLE_POS, EQ_PRESETS, FALL_RESET_Y, GATE_POS, type Landing,
  MASTER_POS, MEZZANINE, PAD_POSITIONS, PLAZA, ROUTE_CHECKPOINTS, SPAWN, STAGE, STAGE_RAMP,
} from './w04Layout';

export interface W04Snapshot {
  readonly beatsRecorded: readonly boolean[];
  readonly bridgeSegmentsUp: number;
  readonly bridgeComplete: boolean;
  readonly eqPreset: string;
  readonly eqSettled: boolean;
  readonly eqHeights: readonly number[];
  readonly checkpoints: readonly string[];
  readonly bsideFound: boolean;
  readonly stageReached: boolean;
  readonly finaleStarted: boolean;
  readonly finaleProgress: number;
  readonly completionEligible: boolean;
  readonly completeRequested: boolean;
  readonly fallResets: number;
}

export interface W04PreviewHandle extends PocketPreviewHandle {
  getSnapshot(): W04Snapshot;
}

const FINALE_SECONDS = 10;
const PRESET_NAMES: Record<string, string> = { flat: 'Flat', wave: 'Wave', rise: 'Rise' };

/**
 * W04 Digital Beat World.
 *
 * Act I: record four beats on the step pads; each raises two segments of the
 * Sequencer Bridge out of the void. Act II: on the Beat Deck, choose the EQ
 * preset that shapes the twelve equalizer bars into a stair (an optional
 * B-side record waits in a side alcove). Act III: climb to the Stage and play
 * the Drop; the world lights up in full, and the ring gate opens home.
 * The beat is always visible; nothing depends on hearing it or on timing.
 */
export function createW04WorldFactory(onReady?: (handle: W04PreviewHandle) => void): PocketWorldFactory {
  return (ctx: PocketWorldContext, signal: AbortSignal): PocketWorldInstance => {
    if (signal.aborted) throw new DOMException('W04 load aborted', 'AbortError');
    const { scope, root } = ctx;
    const fog = new THREE.FogExp2(0x0a0820, 0.011);
    const scenery = buildW04Scenery(ctx, fog);
    // Each caller gets its own material so per-element intensity can differ.
    const glow = (hex: number) => scope.track(new THREE.MeshStandardMaterial({ color: 0x0b0b14, emissive: hex, emissiveIntensity: 1 }));
    const deck = scope.track(new THREE.MeshStandardMaterial({ color: 0x141428, metalness: 0.4, roughness: 0.55 }));
    const chrome = scope.track(new THREE.MeshStandardMaterial({ color: 0x9aa0c8, metalness: 0.9, roughness: 0.25 }));

    // ---- Landings: dark decks with neon grid tops.
    const gridMat = scope.track(new THREE.LineBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.55 }));
    const gridMatWarm = scope.track(new THREE.LineBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.5 }));
    // Glowing trim bands around each slab's sides, so floating decks read against the void.
    const trimCool = glow(0x38e8ff);
    const trimWarm = glow(0xff4fd8);
    const trimGeo = scope.track(new THREE.BoxGeometry(1, 1, 1));
    const landing = (def: Landing, depth: number, warm = false) => {
      addPlatform(ctx, deck, { ...def, depth });
      rectGrid(ctx, def, def.y + 0.012, 2, warm ? gridMatWarm : gridMat);
      const w = def.maxX - def.minX, d = def.maxZ - def.minZ, cx = (def.minX + def.maxX) / 2, cz = (def.minZ + def.maxZ) / 2;
      for (const [sx, sz, px, pz] of [[w + 0.06, 0.06, cx, def.minZ], [w + 0.06, 0.06, cx, def.maxZ], [0.06, d + 0.06, def.minX, cz], [0.06, d + 0.06, def.maxX, cz]] as const) {
        for (const band of [0.18, depth * 0.55]) {
          const trim = new THREE.Mesh(trimGeo, warm ? trimWarm : trimCool);
          trim.scale.set(sx, band === 0.18 ? 0.1 : 0.05, sz);
          trim.position.set(px, def.y - band, pz);
          trim.raycast = () => {};
          root.add(trim);
        }
      }
    };
    landing(PLAZA, 3);
    landing(DECK, 3);
    landing(BSIDE_ALCOVE, 2.5, true);
    landing(MEZZANINE, 8); // deep enough that no one on the flat bars can walk under it
    landing(STAGE, 5, true);
    addRamp(ctx, deck, { ...STAGE_RAMP, depth: 0.6, rails: true });

    // ---- Rails (neon tubes) on every drop-away edge; openings only where routes join.
    const railSegs: [number, number, number, number, number][] = [
      // Mixer Plaza: north opening to the bridge.
      [-7, 16, -1.5, 16, 0], [1.5, 16, 7, 16, 0], [-7, 30, 7, 30, 0], [-7, 16, -7, 30, 0], [7, 16, 7, 30, 0],
      // Beat Deck: south opening (bridge), west opening (alcove), north opening (EQ stair).
      [-8, 0, -1.5, 0, 0], [1.5, 0, 8, 0, 0], [-8, -14, -2, -14, 0], [2, -14, 8, -14, 0], [8, -14, 8, 0, 0],
      [-8, -14, -8, -10, 0], [-8, -4, -8, 0, 0],
      // B-side alcove.
      [-14, -10, -8, -10, 0], [-14, -4, -8, -4, 0], [-14, -10, -14, -4, 0],
      // Mezzanine: south opening (stair), north opening (ramp).
      [-8, MEZZANINE.maxZ, -2, MEZZANINE.maxZ, 6], [2, MEZZANINE.maxZ, 8, MEZZANINE.maxZ, 6], [-8, -40, -3, -40, 6], [3, -40, 8, -40, 6],
      [-8, -40, -8, MEZZANINE.maxZ, 6], [8, -40, 8, MEZZANINE.maxZ, 6],
      // Stage: south opening (ramp).
      [-10, -52, -3, -52, 10], [3, -52, 10, -52, 10], [-10, -66, 10, -66, 10], [-10, -66, -10, -52, 10], [10, -66, 10, -52, 10],
    ];
    const railMat = glow(0x38e8ff);
    const railMesh = new THREE.InstancedMesh(scope.track(new THREE.CylinderGeometry(0.05, 0.05, 1, 6)), railMat, railSegs.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    railSegs.forEach(([x0, z0, x1, z1, y], i) => {
      addRail(ctx, x0, z0, x1, z1, y);
      const len = Math.hypot(x1 - x0, z1 - z0);
      q.setFromUnitVectors(up, new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize());
      railMesh.setMatrixAt(i, m.compose(new THREE.Vector3((x0 + x1) / 2, y + 1.0, (z0 + z1) / 2), q, new THREE.Vector3(1, len, 1)));
    });
    root.add(railMesh);

    const bridge = buildSequencerBridge(ctx, { deck, glow });
    const eq = buildEqStair(ctx, { deck, glow });
    if (signal.aborted) throw new DOMException('W04 load aborted', 'AbortError');

    // ---- Step pads (Act I).
    const padGeo = scope.track(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 16));
    const padTopGeo = scope.track(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16));
    const pads = PAD_POSITIONS.map(([x, y, z]) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const body = new THREE.Mesh(padGeo, chrome);
      body.position.y = 0.55;
      const topMat = glow(0x2a2a50);
      const top = new THREE.Mesh(padTopGeo, topMat);
      top.position.y = 1.14;
      g.add(body, top);
      root.add(g);
      ctx.collision.addBox([x, y + 0.6, z], [0.55, 0.6, 0.55]);
      return { g, topMat };
    });

    // ---- EQ console (Act II).
    const eqConsole = new THREE.Group();
    eqConsole.position.set(...EQ_CONSOLE_POS);
    const consoleBody = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.8, 1.0, 0.9)), chrome);
    consoleBody.position.y = 0.5;
    eqConsole.add(consoleBody);
    const sliderMats = EQ_PRESETS.map(() => glow(0x203040));
    EQ_PRESETS.forEach((_, i) => {
      const slider = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.3, 0.12, 0.6)), sliderMats[i]);
      slider.position.set(-0.55 + i * 0.55, 1.06, 0);
      eqConsole.add(slider);
    });
    root.add(eqConsole);
    ctx.collision.addBox([EQ_CONSOLE_POS[0], 0.5, EQ_CONSOLE_POS[2]], [1.0, 0.5, 0.55]);

    // ---- Optional B-side record (alcove).
    const bside = new THREE.Group();
    bside.position.set(...BSIDE_POS);
    const crate = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.1, 0.8, 1.1)), deck);
    crate.position.y = 0.4;
    const vinyl = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 40)),
      scope.track(new THREE.MeshStandardMaterial({ color: 0x050507, metalness: 0.3, roughness: 0.25 })));
    vinyl.position.set(0, 0.95, 0);
    vinyl.rotation.x = -0.35;
    const label = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 24)), glow(0xffb347));
    vinyl.add(label);
    bside.add(crate, vinyl);
    root.add(bside);
    ctx.collision.addBox([BSIDE_POS[0], 0.45, BSIDE_POS[2]], [0.6, 0.45, 0.6]);

    // ---- Master console and the ring gate (Act III).
    const master = new THREE.Group();
    master.position.set(...MASTER_POS);
    const masterBody = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.1, 1.3, 1.1, 24)), chrome);
    masterBody.position.y = 0.55;
    const playMat = glow(0x38e8ff);
    const playShape = new THREE.Shape();
    playShape.moveTo(-0.3, -0.36); playShape.lineTo(0.42, 0); playShape.lineTo(-0.3, 0.36); playShape.closePath();
    const playIcon = new THREE.Mesh(scope.track(new THREE.ShapeGeometry(playShape)), playMat);
    playIcon.rotation.x = -Math.PI / 2;
    playIcon.position.y = 1.12;
    master.add(masterBody, playIcon);
    root.add(master);
    ctx.collision.addBox([MASTER_POS[0], MASTER_POS[1] + 0.55, MASTER_POS[2]], [1.3, 0.55, 1.3]);
    // Speaker stacks flanking the stage (decorative; collider blocks).
    const speakerGeo = scope.track(new THREE.BoxGeometry(2.2, 5, 2.2));
    const coneGeo = scope.track(new THREE.TorusGeometry(0.62, 0.14, 8, 24));
    const coneMat = glow(0xff4fd8);
    const speakers: THREE.Group[] = [];
    for (const x of [-7.6, 7.6]) {
      const s = new THREE.Group();
      s.position.set(x, 10, -63.4);
      const cab = new THREE.Mesh(speakerGeo, deck);
      cab.position.y = 2.5;
      s.add(cab);
      for (const y of [1.4, 3.6]) {
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(0, y, 1.12);
        s.add(cone);
      }
      root.add(s);
      speakers.push(s);
      ctx.collision.addBox([x, 12.5, -63.4], [1.1, 2.5, 1.1]);
    }
    const gate = new THREE.Group();
    gate.position.set(...GATE_POS);
    gate.rotation.y = -Math.PI / 2;
    const gateRing = new THREE.Mesh(scope.track(new THREE.TorusGeometry(1.6, 0.12, 8, 48)), glow(0x55f2ff));
    gateRing.position.y = 1.8;
    const gateVeilMat = scope.track(new THREE.MeshBasicMaterial({ color: 0x7a4dff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    const gateVeil = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.5, 40)), gateVeilMat);
    gateVeil.position.y = 1.8;
    gate.add(gateRing, gateVeil);
    gate.visible = false;
    root.add(gate);

    // ---- State.
    const recorded = [false, false, false, false];
    const checkpoints: string[] = [];
    let bsideFound = false;
    let stageReached = false;
    let finaleStarted = false;
    let finaleProgress = 0;
    let completionEligible = false;
    let completeRequested = false;
    let fallResets = 0;
    let announcedArrival = false;
    let time = 0;
    const reduced = () => ctx.reducedMotion();

    pads.forEach((pad, i) => {
      ctx.interaction.register(`w04-pad-${i}`, {
        object: pad.g,
        label: () => (recorded[i] ? `Beat ${i + 1} Recorded` : `Record Beat ${i + 1}`),
        description: `Step pad ${i + 1}. Recording it raises two segments of the Sequencer Bridge.`,
        activate: () => {
          if (recorded[i]) return;
          recorded[i] = true;
          bridge.record(i, reduced());
          const left = recorded.filter((r) => !r).length;
          ctx.announce(left ? `Beat ${i + 1} recorded. ${left} more to complete the bridge.` : 'All four beats recorded. The Sequencer Bridge is whole.', 6);
        },
      });
    });
    ctx.interaction.register('w04-eq-console', {
      object: eqConsole,
      label: () => `EQ Preset: ${PRESET_NAMES[eq.preset]} (next: ${PRESET_NAMES[EQ_PRESETS[(EQ_PRESETS.indexOf(eq.preset) + 1) % EQ_PRESETS.length]]})`,
      description: 'Cycles the equalizer preset. The bars ahead take its shape; one shape is a stair.',
      activate: () => {
        const next = EQ_PRESETS[(EQ_PRESETS.indexOf(eq.preset) + 1) % EQ_PRESETS.length];
        eq.setPreset(next, reduced());
        ctx.announce(next === 'rise' ? 'Rise: the bars climb in even steps to the mezzanine.'
          : next === 'wave' ? 'Wave: the bars swell and dip. No way up yet.' : 'Flat: the bars lie level with the deck.', 6);
      },
    });
    ctx.interaction.register('w04-bside', {
      object: bside,
      label: () => (bsideFound ? 'B-Side Found' : 'Flip the B-Side'),
      description: 'A record left in a side alcove. Optional: its colours join the Drop.',
      activate: () => {
        if (bsideFound) return;
        bsideFound = true;
        ctx.announce('The B-side. Its amber colours will join the Drop.', 6);
      },
    });
    ctx.interaction.register('w04-master', {
      object: master,
      label: () => (finaleStarted ? (completionEligible ? 'The Drop Is Playing' : 'Dropping...') : 'Play the Drop'),
      description: 'The master control on the Stage. Playing it lights the whole world.',
      activate: () => {
        if (finaleStarted || !stageReached) return;
        finaleStarted = true;
        finaleProgress = reduced() ? 1 : 0;
        ctx.announce('The Drop. Every light in the world joins the beat.', 7);
      },
    });
    ctx.interaction.register('w04-return-gate', {
      object: gate,
      label: () => (completionEligible ? 'Return to the Museum' : 'Ring Gate (closed)'),
      description: 'A ring gate that opens after the Drop. It returns you to the E19 desktop.',
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

    const snapshot = (): W04Snapshot => ({
      beatsRecorded: [...recorded], bridgeSegmentsUp: bridge.segmentsUp, bridgeComplete: bridge.complete,
      eqPreset: eq.preset, eqSettled: eq.settled, eqHeights: eq.heights(), checkpoints: [...checkpoints], bsideFound,
      stageReached, finaleStarted, finaleProgress, completionEligible, completeRequested, fallResets,
    });
    onReady?.({ getSnapshot: snapshot });

    return {
      spawnPosition: SPAWN,
      spawnYaw: 0,
      spawnPitch: 0,
      fog,
      background: new THREE.Color(0x05060f),
      fieldOfView: 70,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt) {
        if (!announcedArrival) {
          announcedArrival = true;
          ctx.announce('Digital Beat World. Record the four beats on the step pads to build the bridge.', 8);
        }
        bridge.fixedUpdate(dt);
        eq.fixedUpdate(dt);
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
          if (def === DECK) ctx.announce('The Beat Deck. Set the EQ console so the bars form a stair.', 7);
          if (def === MEZZANINE) ctx.announce('The Mezzanine. The Stage waits at the top of the ramp.', 6);
          if (def === STAGE) {
            stageReached = true;
            ctx.announce('The Stage. Play the Drop at the master control.', 7);
          }
        }
        if (finaleStarted && finaleProgress < 1) finaleProgress = Math.min(1, finaleProgress + dt / FINALE_SECONDS);
        if (finaleStarted && finaleProgress >= 1 && !completionEligible) {
          completionEligible = true;
          ctx.markCompletionEligible();
          gate.visible = true;
          ctx.announce('The Drop fills the world. The ring gate is open: step through to return to the museum.', 8);
        }
      },
      variableUpdate(dt) {
        time += dt;
        const r = reduced();
        const pulse = r ? 0.5 : beatPulse(time);
        const drop = finaleProgress;
        bridge.syncVisuals(pulse);
        eq.syncVisuals(pulse, drop);
        scenery.update(time, pulse, drop, bsideFound, r);
        // The playhead walks the pads one beat at a time; recorded pads stay lit.
        const playhead = Math.floor(time / (60 / 96)) % pads.length;
        pads.forEach((pad, i) => {
          pad.topMat.emissive.setHex(recorded[i] ? (i % 2 ? 0xff4fd8 : 0x38e8ff) : 0x2a2a50);
          pad.topMat.emissiveIntensity = recorded[i] ? 1.2 + pulse * 0.6 : (!r && i === playhead ? 1.6 : 0.8);
        });
        EQ_PRESETS.forEach((name, i) => {
          sliderMats[i].emissive.setHex(name === eq.preset ? (name === 'rise' ? 0x58ff8a : 0x38e8ff) : 0x203040);
        });
        playMat.emissiveIntensity = stageReached && !finaleStarted ? 1 + pulse : 1.4;
        railMat.emissiveIntensity = 0.8 + pulse * 0.35 + drop * 0.6;
        gridMat.opacity = 0.45 + pulse * 0.15 + drop * 0.3;
        gridMatWarm.opacity = 0.4 + pulse * 0.15 + drop * 0.35;
        coneMat.emissiveIntensity = 0.8 + (r ? 0 : pulse) * (0.4 + drop);
        if (!r) speakers.forEach((s) => { s.scale.setScalar(1 + pulse * 0.015 * (1 + drop * 2)); });
        if (gate.visible && !r) gateVeilMat.opacity = 0.42 + 0.12 * Math.sin(time * 1.6);
        if (!r && !bsideFound) vinyl.rotation.y = time * 0.9;
      },
      dispose() {
        bridge.dispose();
        eq.dispose();
      },
    };
  };
}
