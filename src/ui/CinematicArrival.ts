import type { App } from '../app/App';

/** Live-world title presentation: no second renderer, media, or animation loop. */
export function mountCinematicArrival(app: App): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has('qa') || params.has('edit')) return;
  const root = document.createElement('section');
  root.className = 'cinematic-arrival';
  root.setAttribute('aria-label', 'Museum of Me introduction');
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
  description.textContent = 'An explorable collection of worlds, systems, stories, and becoming.';
  const enter = document.createElement('button');
  enter.type = 'button';
  enter.disabled = true;
  enter.textContent = 'Preparing your arrival…';
  content.append(eyebrow, heading, description, enter);
  root.append(content);
  document.body.append(root);

  app.input.releasePointerLock();
  app.input.uiCaptured = true;
  app.player.setFrozen(true);
  const dwell = window.setTimeout(() => {
    if (!root.isConnected) return;
    enter.disabled = false;
    enter.textContent = 'Enter the museum';
  }, 4000);
  enter.addEventListener('click', () => {
    window.clearTimeout(dwell);
    root.remove();
    app.input.uiCaptured = false;
    app.player.setFrozen(false);
  }, { once: true });
}
