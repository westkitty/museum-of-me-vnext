import * as THREE from 'three';
import type { PocketWorldContext, PocketWorldFactory, PocketWorldInstance } from '../types';
import { CoralCathedralSystem } from './cathedral';
import { W01MarineLife } from './creatures';
import { CurrentTransportSystem } from './currentTransport';
import { buildW01Environment, REEF_TERRACES, W01_SPAWN_POSITION, W01_SPAWN_YAW } from './reefs';
import {
  DEFAULT_W01_STEM_MAPPING,
  type W01ReefId,
  type W01StateSnapshot,
  type W01StationId,
  type W01StemId,
  type W01StemMapping,
} from './types';
import {
  buildW01ProcessionCueSheet,
  ensureW01AudioAssetsRegistered,
  resolveW01MusicSourceMode,
} from './w01Music';

export interface W01ControllerHandle {
  getSnapshot(): W01StateSnapshot;
  rideCurrent(to: W01StationId): boolean;
  activateReefEnvironment(reef: W01ReefId): boolean;
  awakenMusician(reef: W01ReefId): boolean;
  activateCathedral(): boolean;
  conductFinale(): boolean;
}

export interface CreateW01WorldOptions {
  readonly stemMapping?: W01StemMapping;
  readonly onReady?: (handle: W01ControllerHandle) => void;
}

export function createW01WorldFactory(options: CreateW01WorldOptions = {}): PocketWorldFactory {
  const mapping = options.stemMapping ?? DEFAULT_W01_STEM_MAPPING;

  return async (ctx: PocketWorldContext, signal: AbortSignal): Promise<PocketWorldInstance> => {
    ensureW01AudioAssetsRegistered();
    const musicSourceMode = await resolveW01MusicSourceMode(signal);
    if (signal.aborted) {
      throw new DOMException('W01 load aborted', 'AbortError');
    }

    const cueSheet = buildW01ProcessionCueSheet(musicSourceMode);
    const musicSession = ctx.createMusicSession(cueSheet);

    const { root: envRoot, anchors, visuals } = buildW01Environment(ctx.scope, ctx.collision);
    const marineLife = new W01MarineLife(ctx.scope, ctx.quality);
    const currents = new CurrentTransportSystem(ctx.scope, ctx.reducedMotion());
    const cathedral = new CoralCathedralSystem(ctx.scope, ctx.collision);

    ctx.root.add(envRoot, marineLife.group, currents.group, cathedral.group);

    let currentStation: W01StationId = 'central';
    let lastMusicCue: string | null = null;
    let completionEligible = false;
    const envActions: Record<W01ReefId, boolean> = { turtle: false, ray: false, whale: false };
    const awakened: Record<W01ReefId, boolean> = { turtle: false, ray: false, whale: false };
    const activeStems = new Set<W01StemId>(['bass']);

    const offCue = musicSession.onCue((event) => {
      if (event.cue.label) {
        lastMusicCue = event.cue.label;
      }
    });

    const rideCurrent = (to: W01StationId): boolean => {
      if (currents.isRiding) return false;
      const ok = currents.startRide(
        currentStation,
        to,
        () => ctx.player.beginGuidedTransport(),
        ctx.reducedMotion(),
      );
      if (ok) {
        ctx.announce(`Riding ocean current toward ${stationLabel(to)}. Look around freely.`, 4);
      }
      return ok;
    };

    const activateReefEnvironment = (reef: W01ReefId): boolean => {
      if (envActions[reef]) return false;
      envActions[reef] = true;
      visuals.setEnvActivated(reef);
      ctx.announce(envAnnouncement(reef), 5);
      return true;
    };

    const awakenMusician = (reef: W01ReefId): boolean => {
      if (awakened[reef]) return false;
      awakened[reef] = true;
      visuals.setMusicianAwakened(reef);
      if (reef === 'turtle') marineLife.turtle.setAwakened(true);
      if (reef === 'ray') marineLife.ray.setAwakened(true);
      if (reef === 'whale') marineLife.whale.setAwakened(true);

      const stem = mapping[reef];
      activeStems.add(stem);
      musicSession.scheduleStemGain(stem, 1, { at: 'next-bar', fadeSeconds: 1.2 });

      const count = Object.values(awakened).filter(Boolean).length;
      if (count === 3) {
        visuals.setCathedralReady(true);
        ctx.announce('All three musicians are awake! Return to the Central Station to awaken the Coral Cathedral.', 7);
      } else {
        ctx.announce(`${musicianLabel(reef)} awakened (${count}/3). Musical layer added.`, 6);
      }
      return true;
    };

    const activateCathedral = (): boolean => {
      if (!awakened.turtle || !awakened.ray || !awakened.whale) {
        ctx.announce('Awaken all three reef musicians before calling the Coral Cathedral together.', 5);
        return false;
      }
      if (!cathedral.beginAssembly(ctx.reducedMotion())) return false;
      musicSession.setActiveLoopRegion(null);
      musicSession.scheduleMix({ bass: 1, drums: 1, other: 1 }, { at: 'next-bar', fadeSeconds: 1.4 });
      marineLife.turtle.setCathedralProcession(true);
      marineLife.ray.setCathedralProcession(true);
      marineLife.whale.setCathedralProcession(true);
      if (cathedral.currentPhase === 'assembled') {
        ctx.announce('The Coral Cathedral passage is open. Walk the ascending bridge to the Conductor Platform.', 7);
      } else {
        ctx.announce('The three coral habitats are converging into the Coral Cathedral.', 6);
      }
      return true;
    };

    const conductFinale = (): boolean => {
      if (cathedral.currentPhase !== 'assembled') {
        ctx.announce('Assemble the Coral Cathedral first.', 4);
        return false;
      }
      cathedral.markCompleted();
      completionEligible = true;
      ctx.markCompletionEligible();
      ctx.announce('The Great Ocean Procession is complete. Passport stamp earned!', 6);
      ctx.requestComplete();
      return true;
    };

    // Register interactive controls through ctx.interaction
    const reefNames: readonly W01ReefId[] = ['turtle', 'ray', 'whale'];
    for (const reef of reefNames) {
      ctx.interaction.register(`w01-depart-${reef}`, {
        object: anchors.departurePylons[reef],
        label: () => `Ride Current to ${stationLabel(reef)}`,
        description: `Board the guided ocean current to ${stationLabel(reef)}.`,
        activate: () => { void rideCurrent(reef); },
      });
      ctx.interaction.register(`w01-return-${reef}`, {
        object: anchors.returnBeacons[reef],
        label: 'Ride Return Current to Central Station',
        description: 'Return smoothly to the Central Current Station.',
        activate: () => { void rideCurrent('central'); },
      });
      ctx.interaction.register(`w01-env-${reef}`, {
        object: anchors.envObjects[reef],
        label: () => (envActions[reef] ? `${envLabel(reef)} (Resonating)` : envLabel(reef)),
        activate: () => { void activateReefEnvironment(reef); },
      });
      ctx.interaction.register(`w01-musician-${reef}`, {
        object: anchors.musicianObjects[reef],
        label: () => (awakened[reef] ? `${musicianLabel(reef)} (Awake)` : `Awaken ${musicianLabel(reef)}`),
        activate: () => { void awakenMusician(reef); },
      });
    }

    ctx.interaction.register('w01-cathedral-altar', {
      object: anchors.cathedralAltar,
      label: () => {
        if (cathedral.currentPhase === 'assembled' || cathedral.currentPhase === 'completed') {
          return 'Coral Cathedral Assembled';
        }
        return awakened.turtle && awakened.ray && awakened.whale
          ? 'Awaken the Coral Cathedral'
          : 'Inspect Cathedral Convergence Altar';
      },
      activate: () => { void activateCathedral(); },
    });

    ctx.interaction.register('w01-conductor-podium', {
      object: cathedral.conductorPodium,
      label: 'Conduct the Great Ocean Procession',
      description: 'Complete W01 and earn the Lagoon Depths passport stamp.',
      activate: () => { void conductFinale(); },
    });

    await musicSession.play();

    const handle: W01ControllerHandle = {
      getSnapshot: () => ({
        station: currentStation,
        ridingTo: currents.ridingTo,
        rideProgress: currents.rideProgress,
        envActions: { ...envActions },
        awakened: { ...awakened },
        cathedralPhase: cathedral.currentPhase,
        cathedralProgress: cathedral.currentProgress,
        musicSourceMode,
        activeStems: [...activeStems],
        completionEligible,
        lastMusicCue,
      }),
      rideCurrent,
      activateReefEnvironment,
      awakenMusician,
      activateCathedral,
      conductFinale,
    };
    options.onReady?.(handle);

    return {
      spawnPosition: W01_SPAWN_POSITION,
      spawnYaw: W01_SPAWN_YAW,
      spawnPitch: 0,
      fog: new THREE.FogExp2(0x06273c, 0.0068),
      background: new THREE.Color(0x052136),
      fieldOfView: 68,
      keepMuseumSky: false,
      keepMuseumLighting: false,
      fixedUpdate(dt: number) {
        currents.fixedUpdate(
          dt,
          (x, y, z) => ctx.player.setGuidedPosition(x, y, z),
          (landSpot) => ctx.player.endGuidedTransport(landSpot),
          (arrivedAt) => {
            currentStation = arrivedAt;
            ctx.saveCheckpoint();
            ctx.announce(`Arrived at ${stationLabel(arrivedAt)}.`, 4);
          },
        );
        // Recovery if visitor ever slips off a terrace while not riding a current
        if (!currents.isRiding && ctx.player.position.y < -18) {
          ctx.resetToCheckpoint();
        }
      },
      variableUpdate(dt: number) {
        const reduced = ctx.reducedMotion();
        currents.variableUpdate(dt, reduced);
        marineLife.update(dt, reduced);
        visuals.update(dt, reduced);
        const justAssembled = cathedral.update(dt, reduced);
        if (justAssembled) {
          ctx.announce(
            'The Coral Cathedral has locked into place. Walk up the ascending nave to the Conductor\'s Platform.',
            7,
          );
        }
      },
      dispose() {
        offCue();
        currents.cancelRide();
        cathedral.dispose();
        musicSession.dispose();
      },
    };
  };
}

function stationLabel(station: W01StationId): string {
  switch (station) {
    case 'central': return 'Central Current Station';
    case 'turtle': return 'Turtle Reef';
    case 'ray': return 'Ray Reef';
    case 'whale': return 'Whale Reef';
    case 'cathedral': return 'Coral Cathedral';
  }
}

function musicianLabel(reef: W01ReefId): string {
  switch (reef) {
    case 'turtle': return 'Sea Turtle';
    case 'ray': return 'Manta Ray';
    case 'whale': return 'Baleen Whale';
  }
}

function envLabel(reef: W01ReefId): string {
  switch (reef) {
    case 'turtle': return 'Ring Resonance Shell Chime';
    case 'ray': return 'Align Current Sail Vane';
    case 'whale': return 'Sound Deep Resonance Monolith';
  }
}

function envAnnouncement(reef: W01ReefId): string {
  switch (reef) {
    case 'turtle': return 'The ancient shell chime rings through Turtle Reef.';
    case 'ray': return 'The luminous coral sail aligns with the upper ocean current.';
    case 'whale': return 'The deep stone monolith hums across Whale Reef.';
  }
}

export { REEF_TERRACES };
