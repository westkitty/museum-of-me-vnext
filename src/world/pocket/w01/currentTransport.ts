import * as THREE from 'three';
import type { ResourceScope } from '../../../assets/ResourceScope';
import type { Vec3 } from '../../layout';
import type { W01ReefId, W01StationId } from './types';

export interface CurrentRouteSpec {
  readonly id: string;
  readonly from: W01StationId;
  readonly to: W01StationId;
  readonly color: number;
  readonly points: readonly Vec3[];
  readonly landSpot: Vec3;
  readonly durationSeconds: number;
}

export const W01_CURRENT_ROUTES: readonly CurrentRouteSpec[] = [
  {
    id: 'central-to-turtle',
    from: 'central',
    to: 'turtle',
    color: 0x38e4ae,
    points: [
      [-7.5, 0, -2.5],
      [-22, 4.5, -18],
      [-46, 6.5, -36],
      [-62, 4, -50],
    ],
    landSpot: [-62, 4, -50],
    durationSeconds: 5.2,
  },
  {
    id: 'turtle-to-central',
    from: 'turtle',
    to: 'central',
    color: 0x38e4ae,
    points: [
      [-60, 4, -54],
      [-42, 7.5, -34],
      [-20, 3.5, -14],
      [-5.5, 0, -1.5],
    ],
    landSpot: [-5.5, 0, -1.5],
    durationSeconds: 4.8,
  },
  {
    id: 'central-to-ray',
    from: 'central',
    to: 'ray',
    color: 0x67d4ff,
    points: [
      [7.5, 0, -2.5],
      [24, 6.5, -16],
      [48, 13.5, -34],
      [62, 12, -48],
    ],
    landSpot: [62, 12, -48],
    durationSeconds: 5.4,
  },
  {
    id: 'ray-to-central',
    from: 'ray',
    to: 'central',
    color: 0x67d4ff,
    points: [
      [60, 12, -52],
      [44, 15, -34],
      [20, 5.5, -14],
      [5.5, 0, -1.5],
    ],
    landSpot: [5.5, 0, -1.5],
    durationSeconds: 4.8,
  },
  {
    id: 'central-to-whale',
    from: 'central',
    to: 'whale',
    color: 0xffca6b,
    points: [
      [0, 0, -8.5],
      [0, -2.5, -36],
      [0, -7.5, -72],
      [0, -10, -100],
    ],
    landSpot: [0, -10, -100],
    durationSeconds: 5.6,
  },
  {
    id: 'whale-to-central',
    from: 'whale',
    to: 'central',
    color: 0xffca6b,
    points: [
      [6, -10, -104],
      [10, -5.5, -70],
      [6, -1.5, -34],
      [0, 0, -6],
    ],
    landSpot: [0, 0, -6],
    durationSeconds: 5.0,
  },
];

interface BuiltRoute {
  readonly spec: CurrentRouteSpec;
  readonly curve: THREE.CatmullRomCurve3;
  readonly tubeMat: THREE.MeshBasicMaterial;
  readonly motes: THREE.InstancedMesh;
  readonly moteCount: number;
}

export class CurrentTransportSystem {
  readonly group = new THREE.Group();
  private readonly routes = new Map<string, BuiltRoute>();
  private readonly dummy = new THREE.Object3D();
  private readonly scratchPos = new THREE.Vector3();

  private activeRide: {
    readonly route: BuiltRoute;
    readonly releaseTransport: () => void;
    elapsed: number;
    readonly duration: number;
  } | null = null;

  private flowTime = 0;

  constructor(scope: ResourceScope, reducedMotion: boolean) {
    this.group.name = 'w01-current-streams';
    const moteGeo = scope.track(new THREE.OctahedronGeometry(0.18, 0));

    for (const spec of W01_CURRENT_ROUTES) {
      const vecPoints = spec.points.map(([x, y, z]) => new THREE.Vector3(x, y + 0.9, z));
      const curve = new THREE.CatmullRomCurve3(vecPoints, false, 'catmullrom', 0.45);
      const tubeGeo = scope.track(new THREE.TubeGeometry(curve, 36, 0.22, 6, false));
      const tubeMat = scope.track(new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }));
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.name = `w01-current-ribbon:${spec.id}`;
      this.group.add(tube);

      const moteCount = reducedMotion ? 8 : 16;
      const moteMat = scope.track(new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }));
      const motes = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
      motes.name = `w01-current-motes:${spec.id}`;
      motes.frustumCulled = false;
      this.group.add(motes);

      this.routes.set(spec.id, { spec, curve, tubeMat, motes, moteCount });
    }
    this.updateMotes(0, true);
  }

  get isRiding(): boolean {
    return this.activeRide !== null;
  }

  get ridingTo(): W01StationId | null {
    return this.activeRide?.route.spec.to ?? null;
  }

  get rideProgress(): number {
    if (!this.activeRide) return 0;
    return Math.min(1, this.activeRide.elapsed / Math.max(0.001, this.activeRide.duration));
  }

  startRide(
    from: W01StationId,
    to: W01StationId,
    beginTransport: () => () => void,
    reducedMotion: boolean,
  ): boolean {
    if (this.activeRide) return false;
    const key = `${from}-to-${to}`;
    const route = this.routes.get(key);
    if (!route) return false;
    const releaseTransport = beginTransport();
    const duration = reducedMotion ? 0.65 : route.spec.durationSeconds;
    this.activeRide = { route, releaseTransport, elapsed: 0, duration };
    return true;
  }

  /** Step active current ride in fixedUpdate so PlayerController interpolates cleanly. */
  fixedUpdate(
    dt: number,
    setGuidedPosition: (x: number, y: number, z: number) => void,
    endGuidedTransport: (landSpot: Vec3) => void,
    onArrive: (station: W01StationId) => void,
  ): void {
    const ride = this.activeRide;
    if (!ride) return;
    ride.elapsed = Math.min(ride.duration, ride.elapsed + Math.max(0, dt));
    const rawT = ride.duration > 0 ? ride.elapsed / ride.duration : 1;
    const easedT = smoothstep(rawT);
    ride.route.curve.getPointAt(easedT, this.scratchPos);
    setGuidedPosition(this.scratchPos.x, this.scratchPos.y, this.scratchPos.z);

    if (ride.elapsed >= ride.duration) {
      const { spec } = ride.route;
      this.activeRide = null;
      endGuidedTransport(spec.landSpot);
      onArrive(spec.to);
    }
  }

  variableUpdate(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) {
      this.flowTime += Math.max(0, dt);
    }
    this.updateMotes(this.flowTime, reducedMotion);
  }

  cancelRide(): void {
    if (!this.activeRide) return;
    const { releaseTransport } = this.activeRide;
    this.activeRide = null;
    releaseTransport();
  }

  outboundKeyForReef(reef: W01ReefId): string {
    return `central-to-${reef}`;
  }

  private updateMotes(time: number, reducedMotion: boolean): void {
    const speed = reducedMotion ? 0 : 0.14;
    for (const route of this.routes.values()) {
      const isRidingThis = this.activeRide?.route === route;
      route.tubeMat.opacity = isRidingThis ? 0.45 : 0.22;
      for (let i = 0; i < route.moteCount; i++) {
        const t = ((i / route.moteCount) + time * speed) % 1;
        route.curve.getPointAt(t, this.scratchPos);
        this.dummy.position.copy(this.scratchPos);
        const s = isRidingThis ? 1.35 : 0.9;
        this.dummy.scale.setScalar(s);
        this.dummy.updateMatrix();
        route.motes.setMatrixAt(i, this.dummy.matrix);
      }
      route.motes.instanceMatrix.needsUpdate = true;
    }
  }
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}
