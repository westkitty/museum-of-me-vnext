import type { App } from '../app/App';
import { museumLink } from '../content/collectionLinks';

/** Live-world title presentation: no second renderer, media, or animation loop. */
export function mountCinematicArrival(app: App): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has('qa') || params.has('edit')) return;
  const root = document.createElement('section');
  root.className = 'cinematic-arrival';
  root.setAttribute('aria-label', 'Museum of Me introduction');
  root.setAttribute('role', 'region');
  const content = document.createElement('div');
  content.className = 'cinematic-arrival__content';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'cinematic-arrival__eyebrow';
  eyebrow.textContent = 'THE RELIQUARY OF ITERATIVE BECOMING';
  const heading = document.createElement('h1');
  heading.textContent = 'Welcome to the';
  const name = document.createElement('em');
  name.textContent = ' Museum of Me';
  heading.append(name);
  const description = document.createElement('p');
  description.className = 'cinematic-arrival__description';
  description.textContent = 'Six wings. Thirty-five exhibits. No prescribed route — just worlds, systems, and stories you can walk into.';
  description.id = 'cinematic-arrival-description';
  const orientation = document.createElement('p');
  orientation.className = 'cinematic-arrival__orientation';
  orientation.textContent = 'Walk with WASD or arrow keys. Select Resume mouse look to turn with the mouse; press F to interact. Keyboard-only visitors can turn with Q/E and look up or down with Page Up/Page Down.';
  const touchOrientation = document.createElement('p');
  touchOrientation.className = 'cinematic-arrival__orientation cinematic-arrival__orientation--touch';
  touchOrientation.textContent = 'Touch: move on the left, look on the right, and tap the centre reticle to interact.';
  const invitation = document.createElement('p');
  invitation.className = 'cinematic-arrival__invitation';
  invitation.textContent = 'Walk up to the doors and take a ticket at the kiosk.';
  heading.id = 'cinematic-arrival-heading';
  root.setAttribute('aria-labelledby', heading.id);
  root.setAttribute('aria-describedby', description.id);
  const browse = document.createElement('a');
  browse.href = museumLink({ browse: true });
  browse.textContent = 'Browse the collection';
  const actions = document.createElement('div');
  actions.className = 'cinematic-arrival__actions';
  actions.append(browse);
  content.append(eyebrow, heading, description, invitation, orientation, touchOrientation, actions);
  root.append(content);
  document.body.append(root);

  // The welcome is a title over the live island, not a gate: there is no
  // "Enter" button. Admission is the ticket kiosk by the doors, and the
  // galleries are prepared while the ticket prints. The visitor can walk
  // straight away; the title fades on the first step, look, or Escape.
  app.ui.hud.setCinematicArrivalActive(true);
  app.ui.hud.completeArrival();
  if (window.matchMedia?.('(pointer: coarse)').matches) {
    // UILayer derives the HUD touch presentation from InputManager each frame.
    app.input.touchActive = true;
    app.ui.hud.setTouchMode(true);
  }
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    app.setArrivalUpdate(null);
    app.dismissArrival();
    app.ui.hud.setCinematicArrivalActive(false);
    window.removeEventListener('keydown', onKey, true);
    root.classList.add('cinematic-arrival--leaving');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => root.remove(), reduce ? 0 : 700);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !dismissed) dismiss();
  };
  window.addEventListener('keydown', onKey, true);
  const start = { x: app.player.position.x, z: app.player.position.z, yaw: app.player.yaw };
  app.setArrivalUpdate(() => {
    if (!root.isConnected) { app.setArrivalUpdate(null); return; }
    const p = app.player.position;
    const moved = Math.abs(p.x - start.x) > 0.6 || Math.abs(p.z - start.z) > 0.6;
    const turned = Math.abs(app.player.yaw - start.yaw) > 0.35;
    if (moved || turned || app.input.pointerLocked || app.activeWorld !== 'exterior') dismiss();
  });
}
