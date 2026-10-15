import type { App } from '../app/App';

/** Live-world title presentation: no second renderer, media, or animation loop. */
export function mountCinematicArrival(app: App): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has('qa') || params.has('edit')) return;
  const root = document.createElement('section');
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  root.className = 'cinematic-arrival';
  root.setAttribute('aria-label', 'Museum of Me introduction');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.tabIndex = -1;
  const content = document.createElement('div');
  content.className = 'cinematic-arrival__content';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'cinematic-arrival__eyebrow';
  eyebrow.textContent = 'THE RELIQUARY OF ITERATIVE BECOMING';
  const heading = document.createElement('h1');
  heading.tabIndex = -1;
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
  orientation.textContent = 'Walk with WASD or arrow keys, look with the mouse, and press F to interact. Keyboard-only visitors can turn with Q/E and look up or down with Page Up/Page Down.';
  const touchOrientation = document.createElement('p');
  touchOrientation.className = 'cinematic-arrival__orientation cinematic-arrival__orientation--touch';
  touchOrientation.textContent = 'Touch: move on the left, look on the right, and tap the centre reticle to interact.';
  const enter = document.createElement('button');
  enter.type = 'button';
  enter.disabled = true;
  enter.setAttribute('aria-describedby', 'cinematic-arrival-description');
  enter.textContent = 'Preparing your arrival…';
  heading.id = 'cinematic-arrival-heading';
  root.setAttribute('aria-labelledby', heading.id);
  content.append(eyebrow, heading, description, orientation, touchOrientation, enter);
  root.append(content);
  document.body.append(root);

  // Suppress interaction with the underlying museum while this modal is active.
  const background = ['museum-canvas', 'ui-root', 'a11y-root']
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  const priorInert = background.map((element) => element.inert);
  background.forEach((element) => { element.inert = true; });

  app.input.releasePointerLock();
  app.input.uiCaptured = true;
  app.player.setFrozen(true);
  heading.focus({ preventScroll: true });
  // Respect the real entrance streaming contract rather than assuming four
  // seconds always means GPU preparation has completed. Do not trap visitors
  // indefinitely on slow or unsupported devices.
  const started = performance.now();
  const minimum = app.titlePrewarmStatus.minimumDwellMs;
  const maxWait = minimum + 4000;
  let entered = false;
  const check = () => {
    if (!root.isConnected) {
      app.setArrivalUpdate(null);
      return;
    }
    const elapsed = performance.now() - started;
    const status = app.titlePrewarmStatus;
    if (elapsed < minimum) return;
    if (!status.ready && elapsed < maxWait) {
      enter.textContent = 'Preparing the galleries…';
      return;
    }
    app.setArrivalUpdate(null);
    enter.disabled = false;
    enter.textContent = 'Enter the museum';
    enter.focus({ preventScroll: true });
  };
  app.setArrivalUpdate(check);
  const finish = () => {
    if (entered || enter.disabled || !app.enterArrival()) return;
    entered = true;
    app.setArrivalUpdate(null);
    app.ui.hud.completeArrival();
    root.remove();
    background.forEach((element, i) => { element.inert = priorInert[i]; });
    app.input.uiCaptured = false;
    app.player.setFrozen(false);
    previousFocus?.focus({ preventScroll: true });
    // The Enter button grants access; it does not secretly capture the mouse.
    // Explicit mouse-look opt-in remains in the persistent HUD. Requesting
    // pointer lock during dialog dismissal caused browser-driver stalls on
    // the clean Linux CI runner even though standalone behavior was healthy.
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      // UILayer derives the HUD touch presentation from InputManager each
      // frame. Set the owner state or mouse controls reappear next frame.
      app.input.touchActive = true;
      app.ui.hud.setTouchMode(true);
    }
  };
  enter.addEventListener('click', finish, { once: true });
  root.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!enter.disabled) finish();
    }
    if (event.key === 'Tab') {
      // The introductory dialog has one actionable control.
      event.preventDefault();
      (enter.disabled ? heading : enter).focus({ preventScroll: true });
    }
  });
}
