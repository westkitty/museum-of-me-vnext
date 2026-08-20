import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { createTextTexture, createFallbackTexture, canRenderText } from '../../assets/TextTexture';
import { SANCTUARY_CENTER, SANCTUARY_FLOOR_Y, SANCTUARY_RADIUS, SANCTUARY_HEIGHT } from '../../world/layout';

/**
 * THE DEXTER SANCTUARY.
 *
 * Dexter is a tricolour Phalène. He is not a mascot, not a logo, and not a
 * feature of the Dex software exhibits — those are named after him, which is a
 * different thing entirely.
 *
 * This space is deliberately outside the thirty-five. It has no score, no badge,
 * no collectible, no tutorial voice and no interaction that rewards anything.
 * It has a resting platform, a little light, somewhere to sit, and one short
 * inscription. It exists because Dexter matters, not because the building
 * needed more content.
 *
 * The rules below are load-bearing. Anything that would make this room feel
 * like a game does not belong in it.
 */

/** The one piece of interpretation in the room. Kept short on purpose. */
const INSCRIPTION = [
  'A tricolour Phalène, with the hanging ears the variety is named for.',
  'Several systems in this museum carry his name. None of them are him.',
];

export class DexterSanctuary {
  readonly group = new THREE.Group();
  private readonly scope: ResourceScope;
  private breathe: THREE.Object3D | null = null;
  private elapsed = 0;

  constructor(scope: ResourceScope) {
    this.scope = scope;
    this.group.name = 'dexter-sanctuary';
    this.group.position.set(SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y, SANCTUARY_CENTER[2]);
    this.build();
  }

  private mat(color: number, roughness = 0.7, metalness = 0): THREE.MeshStandardMaterial {
    return this.scope.track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }

  private build(): void {
    // ── the resting platform ──
    const stone = this.mat(0x4a4239, 0.85);
    const platform = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(2.4, 2.7, 0.42, 40)),
      stone,
    );
    platform.position.y = 0.21;
    this.group.add(platform);

    const cushion = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(1.55, 1.7, 0.22, 32)),
      this.mat(0x6b4a3e, 0.95),
    );
    cushion.position.y = 0.5;
    this.group.add(cushion);

    this.group.add(this.buildDexter());

    // ── light: one shaft from the oculus, and nothing else ──
    const shaft = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(1.5, 2.6, SANCTUARY_HEIGHT - 0.6, 24, 1, true)),
      this.scope.track(new THREE.MeshBasicMaterial({
        color: 0xf6ecd8, transparent: true, opacity: 0.055,
        side: THREE.DoubleSide, depthWrite: false,
      })),
    );
    shaft.position.y = (SANCTUARY_HEIGHT - 0.6) / 2 + 0.4;
    this.group.add(shaft);

    // ── the inscription, low on the wall, read by kneeling or standing close ──
    const map = canRenderText()
      ? createTextTexture(this.scope, INSCRIPTION, {
          width: 1024, height: 400, background: '#2a2620', color: '#d9c69a',
          titleColor: '#e8d9b0', title: 'Dexter', titleSize: 62, bodySize: 30,
          align: 'center', padding: 44,
        })
      : createFallbackTexture(this.scope, 0x2a2620);
    const inscription = new THREE.Mesh(
      this.scope.track(new THREE.PlaneGeometry(3.2, 1.25)),
      this.scope.track(new THREE.MeshStandardMaterial({ map, roughness: 0.9 })),
    );
    inscription.position.set(0, 1.9, -SANCTUARY_RADIUS + 0.5);
    this.group.add(inscription);

    // ── restrained reference imagery: three small framed panels, unlit ──
    const frameMat = this.mat(0x322c25, 0.5, 0.3);
    const panelMat = this.mat(0x8a7a5c, 0.85);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI + (i - 1) * 0.52;
      const frame = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.86, 0.66, 0.06)), frameMat);
      const inner = new THREE.Mesh(this.scope.track(new THREE.PlaneGeometry(0.74, 0.54)), panelMat);
      inner.position.z = 0.04;
      frame.add(inner);
      frame.position.set(
        Math.sin(a) * (SANCTUARY_RADIUS - 0.45),
        2.0,
        Math.cos(a) * (SANCTUARY_RADIUS - 0.45),
      );
      frame.rotation.y = a + Math.PI;
      this.group.add(frame);
    }
  }

  /**
   * Dexter, built to the variety's proportions: a small spaniel with a long
   * fine coat, a plumed tail carried over the back, and the drop ears that make
   * him a Phalène rather than a Papillon. Tricolour: white ground, black
   * saddle and mask, tan above the eyes and on the cheeks.
   *
   * He is lying down. This is a resting place.
   */
  private buildDexter(): THREE.Group {
    const dexter = new THREE.Group();
    dexter.name = 'dexter';
    dexter.position.set(0, 0.6, 0);

    const white = this.mat(0xf2ece2, 0.92);
    const black = this.mat(0x1d1a18, 0.9);
    const tan = this.mat(0x9a6a3c, 0.9);
    const dark = this.mat(0x121110, 0.6);

    // Body: lying, chest forward, hind legs tucked.
    const body = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.19, 0.42, 6, 14)), white);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.19, 0);
    dexter.add(body);

    // The saddle — the black over the back that makes him tricolour.
    const saddle = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.175, 0.3, 6, 14)), black);
    saddle.rotation.z = Math.PI / 2;
    saddle.position.set(-0.03, 0.235, 0);
    saddle.scale.set(1, 1, 0.92);
    dexter.add(saddle);

    // Chest and front legs, extended forward as a resting dog holds them.
    const chest = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.155, 14, 12)), white);
    chest.position.set(0.24, 0.17, 0);
    chest.scale.set(1.05, 0.95, 1);
    dexter.add(chest);

    const legGeo = this.scope.track(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8));
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, white);
      leg.rotation.z = Math.PI / 2;
      leg.position.set(0.42, 0.055, s * 0.1);
      dexter.add(leg);

      const paw = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.052, 10, 8)), white);
      paw.position.set(0.53, 0.052, s * 0.1);
      paw.scale.set(1.15, 0.75, 1);
      dexter.add(paw);

      // Tucked hind legs.
      const hind = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.1, 10, 8)), white);
      hind.position.set(-0.24, 0.11, s * 0.14);
      hind.scale.set(1.3, 0.8, 1);
      dexter.add(hind);
    }

    // Neck and head.
    const neck = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.09, 0.1, 4, 10)), white);
    neck.position.set(0.34, 0.31, 0);
    neck.rotation.z = -0.7;
    dexter.add(neck);

    const head = new THREE.Group();
    head.position.set(0.44, 0.42, 0);
    dexter.add(head);

    const skull = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.115, 16, 14)), white);
    skull.scale.set(1.05, 1, 0.95);
    head.add(skull);

    // The black mask, split by the white blaze that runs up the muzzle.
    for (const s of [-1, 1]) {
      const mask = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.105, 12, 10)), black);
      mask.scale.set(0.95, 0.95, 0.5);
      mask.position.set(-0.005, 0.012, s * 0.055);
      head.add(mask);

      // Tan above each eye — the tricolour marking that reads as an expression.
      const brow = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.026, 8, 6)), tan);
      brow.scale.set(1.2, 0.6, 0.8);
      brow.position.set(0.055, 0.055, s * 0.052);
      head.add(brow);

      const cheek = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.032, 8, 6)), tan);
      cheek.scale.set(0.9, 0.8, 0.6);
      cheek.position.set(0.02, -0.035, s * 0.085);
      head.add(cheek);

      const eye = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.019, 10, 8)), dark);
      eye.position.set(0.082, 0.028, s * 0.048);
      head.add(eye);

      // THE EARS. Hanging, long-fringed, carried down — this is what makes him
      // a Phalène. They are never to be modelled erect.
      const ear = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.036, 0.16, 5, 10)), black);
      ear.position.set(-0.035, -0.055, s * 0.105);
      ear.rotation.z = 0.28;
      ear.rotation.x = s * 0.22;
      ear.scale.set(1, 1, 0.55);
      head.add(ear);

      const fringe = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.03, 0.12, 4, 8)), white);
      fringe.position.set(-0.055, -0.16, s * 0.108);
      fringe.rotation.z = 0.2;
      fringe.scale.set(1, 1, 0.5);
      head.add(fringe);
    }

    // The white blaze between the mask halves.
    const blaze = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.026, 0.12, 4, 8)), white);
    blaze.position.set(0.045, 0.03, 0);
    blaze.rotation.z = -0.5;
    head.add(blaze);

    const muzzle = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.042, 0.07, 5, 10)), white);
    muzzle.rotation.z = Math.PI / 2;
    muzzle.position.set(0.135, -0.022, 0);
    head.add(muzzle);

    const nose = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.026, 10, 8)), dark);
    nose.position.set(0.185, -0.012, 0);
    head.add(nose);

    // The plumed tail, carried over the back.
    const tail = new THREE.Mesh(this.scope.track(new THREE.CapsuleGeometry(0.055, 0.34, 6, 12)), white);
    tail.position.set(-0.36, 0.34, 0.04);
    tail.rotation.z = -0.95;
    tail.rotation.x = 0.25;
    dexter.add(tail);

    const plume = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.085, 12, 10)), white);
    plume.position.set(-0.14, 0.42, 0.06);
    plume.scale.set(1.5, 0.7, 0.8);
    dexter.add(plume);

    // Chest ruff.
    const ruff = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.13, 12, 10)), white);
    ruff.position.set(0.29, 0.22, 0);
    ruff.scale.set(0.8, 1.1, 1.15);
    dexter.add(ruff);

    dexter.rotation.y = -0.5;
    this.breathe = body;
    return dexter;
  }

  /**
   * The only motion in the room: the slow rise and fall of a sleeping chest.
   * Held still entirely under reduced motion.
   */
  update(dt: number, reducedMotion: boolean): void {
    if (reducedMotion || !this.breathe) return;
    this.elapsed += dt;
    const breath = Math.sin(this.elapsed * 0.55) * 0.006;
    this.breathe.position.y = 0.19 + breath;
    this.breathe.scale.set(1, 1, 1 + breath * 1.6);
  }

  /** The Sanctuary's text for the accessible mirror. It is not an exhibit entry. */
  accessibleContent(): { heading: string; body: readonly string[] } {
    return {
      heading: 'The Dexter Sanctuary',
      body: [
        'A quiet room below and behind the Rotunda, reached by a ramp through a narrow threshold.',
        ...INSCRIPTION,
        'There is nothing to collect here and nothing to complete. There is a platform, a little light from an opening overhead, and somewhere to sit.',
      ],
    };
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.breathe = null;
  }
}
