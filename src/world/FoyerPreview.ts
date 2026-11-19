import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { buildLabel, updateLabel } from '../exhibits/Furniture';
import type { InteractionManager } from '../interaction/InteractionManager';
import { GROUND_Y, VESTIBULE_TO } from './layout';

const WINDOW_TITLE = 'What would a missing star look like?';
const GUIDE_LINE = 'See the full reconstruction at Heliocide Observatory.';
const STARS_PRESENT = 'The stars are visible.';
const STARS_ABSENT = 'A patch of the sky is empty now.';

/** A small preview of the Observatory, alongside the clear entrance route. */
export class FoyerPreview {
  readonly group = new THREE.Group();
  private readonly unbind: () => void;

  constructor(scope: ResourceScope, interaction: InteractionManager, announce: (message: string) => void) {
    this.group.name = 'foyer-observatory-preview';
    this.group.position.set(1.1, GROUND_Y + 1.55, VESTIBULE_TO - 6.35);
    const display = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(1.3, 0.9, 0.1)),
      scope.track(new THREE.MeshBasicMaterial({ color: 0x111324 })),
    );
    display.name = 'foyer-star-window';
    this.group.add(display);

    const stars = new THREE.Group();
    stars.name = 'foyer-stars-that-disappear';
    this.group.add(stars);
    const dot = scope.track(new THREE.CircleGeometry(0.016, 8));
    const light = scope.track(new THREE.MeshBasicMaterial({ color: 0xe9ddbf }));
    for (const [x, y] of [
      [-0.51, -0.16], [-0.48, 0.25], [-0.34, 0.04], [-0.17, 0.32], [-0.13, -0.28],
      [-0.04, 0.13], [0.12, -0.1], [0.19, 0.23], [0.33, -0.26], [0.47, 0.07], [0.49, 0.32],
    ]) {
      const star = new THREE.Mesh(dot, light);
      star.position.set(x, y, 0.06);
      (x > -0.1 && x < 0.35 ? stars : this.group).add(star);
    }

    const title = buildLabel(scope, WINDOW_TITLE, 1.42, 0.18);
    title.position.set(0, 0.6, 0.065);
    this.group.add(title);
    const action = () => stars.visible ? 'Watch stars disappear' : 'Bring the stars back';
    const state = buildLabel(scope, action(), 1.42, 0.16);
    state.position.set(0, -0.57, 0.065);
    this.group.add(state);
    const caption = buildLabel(scope, GUIDE_LINE, 1.42, 0.17);
    caption.position.set(0, -0.82, 0.065);
    this.group.add(caption);

    this.unbind = interaction.register('foyer-observatory-preview', {
      object: display,
      label: action,
      description: `${WINDOW_TITLE} ${GUIDE_LINE}`,
      activate: () => {
        stars.visible = !stars.visible;
        updateLabel(scope, state, action());
        announce(`${stars.visible ? STARS_PRESENT : STARS_ABSENT} ${GUIDE_LINE}`);
      },
    });
  }

  dispose(): void {
    this.unbind();
  }
}
