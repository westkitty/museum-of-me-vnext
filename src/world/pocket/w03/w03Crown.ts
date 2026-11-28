import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { easeInOut } from '../kit/worldKit';
import {
  CROWN, LATCH_ANGLES, latchOpen, latchPosition, latchSoon, STAR_CHART_POS, SUN_CAGE, SUN_GATE_POS, sunHandAngle,
} from './w03Layout';

const CAGE_BARS = 12;
const CAGE_RADIUS = 1.9;

export interface CrownMaterials {
  readonly brass: THREE.MeshStandardMaterial;
  readonly iron: THREE.MeshStandardMaterial;
}

/**
 * Act III: the captive sun in its brass cage on the Sundial Crown, the
 * gnomon shadow that sweeps the crown floor, three sun latches, the sunrise
 * finale, the optional star chart and the return gate.
 */
export function buildW03Crown(ctx: PocketWorldContext, mats: CrownMaterials) {
  const { scope, collision, root } = ctx;
  const [cx, cy, cz] = SUN_CAGE;

  // ---- Cage: a brass ring base, twelve bars that open like petals, a crown ring.
  const cage = new THREE.Group();
  cage.position.set(cx, cy, cz);
  root.add(cage);
  const base = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(CAGE_RADIUS + 0.35, CAGE_RADIUS + 0.55, 0.5, 28)), mats.iron);
  base.position.y = 0.25;
  cage.add(base);
  collision.addBox([cx, cy + 1.5, cz], [CAGE_RADIUS + 0.4, 1.6, CAGE_RADIUS + 0.4]);
  const barGeo = scope.track(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6));
  barGeo.translate(0, 2.1, 0);
  // Bars open like petals by at most ~0.6 rad, staying inside radius ~4.3 (clear of the latch walk).
  const bars: THREE.Group[] = [];
  for (let i = 0; i < CAGE_BARS; i++) {
    const a = (i / CAGE_BARS) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * CAGE_RADIUS, 0.5, Math.sin(a) * CAGE_RADIUS);
    pivot.rotation.y = -a;
    const bar = new THREE.Mesh(barGeo, mats.brass);
    pivot.add(bar);
    cage.add(pivot);
    bars.push(pivot);
  }
  // The crown ring and gnomon blade ride up with the freed sun.
  const crownTop = new THREE.Group();
  crownTop.position.y = 4.7;
  const crownRing = new THREE.Mesh(scope.track(new THREE.TorusGeometry(CAGE_RADIUS, 0.09, 6, 32)), mats.brass);
  crownRing.rotation.x = Math.PI / 2;
  crownTop.add(crownRing);
  cage.add(crownTop);

  // ---- The captive sun.
  const sunMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa531, emissiveIntensity: 1.1 }));
  const sun = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(1.05, 3)), sunMat);
  sun.position.set(0, 2.5, 0);
  cage.add(sun);
  const sunLight = new THREE.PointLight(0xffc070, 18, 26, 1.6);
  sunLight.castShadow = false;
  sun.add(sunLight);
  const haloMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffc777, transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
  const halo = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1.8, 20, 12)), haloMat);
  sun.add(halo);

  // ---- Gnomon blade on the cage and the shadow hand it casts across the crown.
  const blade = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 2.6, 1.3)), mats.brass);
  blade.position.set(0, 1.2, 0);
  crownTop.add(blade);
  const hand = new THREE.Group();
  hand.position.set(cx, cy + 0.03, cz);
  const shadowMat = scope.track(new THREE.MeshBasicMaterial({ color: 0x050308, transparent: true, opacity: 0.55, depthWrite: false }));
  const shadowGeo = scope.track(new THREE.PlaneGeometry(4.6, 0.9));
  shadowGeo.rotateX(-Math.PI / 2);
  shadowGeo.translate(CAGE_RADIUS + 0.6 + 2.3, 0, 0);
  hand.add(new THREE.Mesh(shadowGeo, shadowMat));
  root.add(hand);

  // ---- Hour ring inlaid in the crown floor (decorative), and three latches on it.
  const hourGeo = scope.track(new THREE.BoxGeometry(0.9, 0.02, 0.12));
  const hours = new THREE.InstancedMesh(hourGeo, mats.brass, 24);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    hours.setMatrixAt(i, m.compose(new THREE.Vector3(cx + Math.cos(a) * 6.3, cy + 0.02, cz + Math.sin(a) * 6.3),
      q.setFromAxisAngle(yAxis, -a), new THREE.Vector3(i % 6 === 0 ? 1.6 : 1, 1, 1)));
  }
  root.add(hours);

  const latchBodyGeo = scope.track(new THREE.CylinderGeometry(0.3, 0.38, 1.0, 10));
  const leverGeo = scope.track(new THREE.BoxGeometry(0.12, 0.8, 0.12));
  leverGeo.translate(0, 0.4, 0);
  const lampGeo = scope.track(new THREE.SphereGeometry(0.17, 12, 8));
  const latches = LATCH_ANGLES.map((_, i) => {
    const [lx, ly, lz] = latchPosition(i);
    const group = new THREE.Group();
    group.position.set(lx, ly, lz);
    const body = new THREE.Mesh(latchBodyGeo, mats.iron);
    body.position.y = 0.5;
    const lever = new THREE.Mesh(leverGeo, mats.brass);
    lever.position.y = 1.0;
    lever.rotation.z = 0.7;
    const lampMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x3a2a24, emissive: 0x401c10, emissiveIntensity: 0.6 }));
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.y = 1.12;
    group.add(body, lever, lamp);
    root.add(group);
    collision.addBox([lx, ly + 0.6, lz], [0.4, 0.6, 0.4]);
    return { group, lever, lamp, lampMat };
  });

  // ---- Optional star chart in the alcove off the Orrery Landing.
  const chart = new THREE.Group();
  chart.position.set(...STAR_CHART_POS);
  const chartStand = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.35, 0.5, 1.0, 10)), mats.iron);
  chartStand.position.y = 0.5;
  const chartDisc = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 32)), mats.brass);
  chartDisc.position.y = 1.08;
  chartDisc.rotation.x = -0.5;
  const pinMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xe8f0ff, emissive: 0x8fb0ff, emissiveIntensity: 0.5 }));
  const pinGeo = scope.track(new THREE.SphereGeometry(0.06, 6, 4));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996;
    const r = 0.25 + (i % 4) * 0.2;
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
    chartDisc.add(pin);
  }
  chart.add(chartStand, chartDisc);
  root.add(chart);
  collision.addBox([STAR_CHART_POS[0], STAR_CHART_POS[1] + 0.6, STAR_CHART_POS[2]], [0.6, 0.6, 0.6]);

  // A constellation ring that joins the sunrise when the chart has been aligned.
  const ringStarGeo = scope.track(new THREE.OctahedronGeometry(0.9, 0));
  const ringStarMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0, fog: false }));
  const constellation = new THREE.InstancedMesh(ringStarGeo, ringStarMat, 12);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    constellation.setMatrixAt(i, m.makeTranslation(Math.cos(a) * 16, Math.sin(a) * 16, 0));
  }
  constellation.visible = false;
  root.add(constellation);

  // ---- Return gate (hidden until the sunrise completes).
  const gate = new THREE.Group();
  gate.position.set(...SUN_GATE_POS);
  gate.rotation.y = Math.atan2(cx - SUN_GATE_POS[0], cz - SUN_GATE_POS[2]); // faces the cage
  const arch = new THREE.Mesh(scope.track(new THREE.TorusGeometry(1.5, 0.16, 8, 32, Math.PI)), mats.brass);
  arch.position.y = 1.9;
  const pillarGeo = scope.track(new THREE.CylinderGeometry(0.16, 0.2, 1.9, 8));
  const leftPillar = new THREE.Mesh(pillarGeo, mats.brass);
  leftPillar.position.set(-1.5, 0.95, 0);
  const rightPillar = new THREE.Mesh(pillarGeo, mats.brass);
  rightPillar.position.set(1.5, 0.95, 0);
  const veilMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xffe3a6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  const veilShape = new THREE.Shape();
  veilShape.moveTo(-1.4, 0);
  veilShape.lineTo(1.4, 0);
  veilShape.lineTo(1.4, 1.9);
  veilShape.absarc(0, 1.9, 1.4, 0, Math.PI, false);
  veilShape.lineTo(-1.4, 0);
  const veil = new THREE.Mesh(scope.track(new THREE.ShapeGeometry(veilShape, 16)), veilMat);
  gate.add(arch, leftPillar, rightPillar, veil);
  gate.visible = false;
  root.add(gate);

  const lampColor = { closed: new THREE.Color(0x401c10), soon: new THREE.Color(0xff9a2e), open: new THREE.Color(0x58ff8a), released: new THREE.Color(0xffd36a) };
  const sunStart = new THREE.Vector3(0, 2.5, 0);
  let chartTurn = 0;
  let chartAligned = false;

  return {
    latchObjects: latches.map((l) => l.group),
    chart,
    gate,
    cageCenter: new THREE.Vector3(cx, cy + 2.5, cz),
    alignChart(reducedMotion: boolean): void {
      chartAligned = true;
      if (reducedMotion) chartTurn = 1;
    },
    showGate(): void { gate.visible = true; },
    /** Animate latches, shadow hand, cage, sunrise and gate from machine time `t`. */
    update(t: number, time: number, released: readonly boolean[], primed: readonly boolean[], finale: number, reducedMotion: boolean): void {
      hand.rotation.y = -sunHandAngle(t);
      latches.forEach((l, i) => {
        const state = released[i] ? 'released' : latchOpen(t, i) ? 'open' : latchSoon(t, i) ? 'soon' : 'closed';
        l.lampMat.emissive.copy(lampColor[state]);
        const pulse = primed[i] && !released[i] && !reducedMotion ? 0.6 + 0.5 * Math.sin(time * 6) : 0;
        l.lampMat.emissiveIntensity = state === 'closed' ? 0.6 + pulse : 1.8;
        l.lever.rotation.z = released[i] ? -0.7 : primed[i] ? 0.2 : 0.7;
      });
      if (chartAligned && chartTurn < 1) chartTurn = Math.min(1, chartTurn + 0.012);
      chartDisc.rotation.y = easeInOut(chartTurn) * Math.PI * 0.75;

      // Finale: bars open (0–0.35), the sun rises and grows (0.2–1).
      const open = easeInOut(finale / 0.35);
      bars.forEach((b, i) => { b.rotation.z = -open * (0.5 + (i % 3) * 0.05); });
      const rise = easeInOut((finale - 0.2) / 0.8);
      sun.position.set(sunStart.x, sunStart.y + rise * 24, sunStart.z - rise * 30);
      sun.scale.setScalar(1 + rise * 5);
      crownTop.position.set(sun.position.x, rise > 0 ? sun.position.y + 2.2 + rise * 5 : 4.7, sun.position.z);
      crownTop.scale.setScalar(1 + rise * 3);
      sunMat.emissiveIntensity = 1.1 + rise * 1.6;
      sunLight.intensity = 18 + rise * 40;
      sunLight.distance = 26 + rise * 120;
      haloMat.opacity = 0.18 + rise * 0.2;
      if (!reducedMotion) sun.rotation.y = time * 0.25;
      constellation.visible = chartAligned && rise > 0.02;
      ringStarMat.opacity = chartAligned ? rise * 0.95 : 0;
      constellation.position.set(cx, cy + 2.5 + rise * 24, cz - rise * 30);
      constellation.rotation.y = reducedMotion ? 0 : time * 0.05;
      if (gate.visible && !reducedMotion) veilMat.opacity = 0.45 + 0.12 * Math.sin(time * 2);
    },
    get chartAligned() { return chartAligned; },
    floorY: CROWN.y,
  };
}

export type W03Crown = ReturnType<typeof buildW03Crown>;
