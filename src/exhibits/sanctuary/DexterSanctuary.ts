import * as THREE from 'three';
import { ResourceScope } from '../../assets/ResourceScope';
import { createTextTexture, createFallbackTexture, canRenderText } from '../../assets/TextTexture';
import { SANCTUARY_CENTER, SANCTUARY_FLOOR_Y, SANCTUARY_RADIUS, SANCTUARY_HEIGHT, SANCTUARY_DIR, rightOf, add } from '../../world/layout';
import { SOURCE_SANCTUARY } from '../../content/sourceParity';
import { curatedUrl, registerCuratedAssets } from '../../assets/curatedAssets';

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

    registerCuratedAssets();
    const loader = new THREE.TextureLoader();
    const refs = ['embedded-07', 'embedded-08'] as const;
    refs.forEach((id, i) => {
      const url = curatedUrl(id);
      const a = Math.PI + (i - 0.5) * 0.52;
      const frame = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(1.35, 1.05, 0.06)), this.mat(0x322c25, 0.5, 0.3));
      const canLoad = typeof document !== 'undefined';
      const material = url && canLoad
        ? this.scope.track(new THREE.MeshStandardMaterial({
            map: (() => {
              const texture = loader.load(url);
              texture.colorSpace = THREE.SRGBColorSpace;
              return this.scope.track(texture);
            })(),
            roughness: 0.86,
          }))
        : this.mat(0x8a7a5c, 0.85);
      const inner = new THREE.Mesh(this.scope.track(new THREE.PlaneGeometry(1.22, 0.92)), material);
      inner.name = `dexter-reference:${id}`;
      inner.position.z = 0.04;
      frame.add(inner);
      frame.position.set(
        Math.sin(a) * (SANCTUARY_RADIUS - 0.45),
        2.15,
        Math.cos(a) * (SANCTUARY_RADIUS - 0.45),
      );
      frame.rotation.y = a + Math.PI;
      this.group.add(frame);
    });

    this.buildScentRoute();
  }

  private buildScentRoute(): void {
    const path = SOURCE_SANCTUARY.scentPath;
    const gold = this.mat(0xd4bd7a, 0.45, 0.08);
    const stone = this.mat(0xb8a078, 0.7);
    const right = rightOf(SANCTUARY_DIR);
    for (let i = 0; i < path.length; i++) {
      const [lx, lz] = path[i];
      const depth = -(lz + 39);
      const world = add(add(SANCTUARY_CENTER, right, lx), SANCTUARY_DIR, depth);
      const disc = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 10)), i % 2 === 0 ? gold : stone);
      disc.name = `scent:${i}`;
      disc.position.set(world[0] - SANCTUARY_CENTER[0], 0.04, world[2] - SANCTUARY_CENTER[2]);
      this.group.add(disc);
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
    const brownEye = this.mat(0x5c3a1e, 0.35, 0.08);

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

      const eye = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.019, 10, 8)), brownEye);
      eye.name = 'brown-eye';
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
        `${SOURCE_SANCTUARY.modelLock.identity} is a ${SOURCE_SANCTUARY.modelLock.species}. Stance ${SOURCE_SANCTUARY.modelLock.stance}; ears ${SOURCE_SANCTUARY.modelLock.ears}; eyes ${SOURCE_SANCTUARY.modelLock.eyes}.`,
        `Blindness is expressed through ${SOURCE_SANCTUARY.modelLock.blindnessCue}, not by erasing the eyes.`,
      ],
    };
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
    this.breathe = null;
  }
}
