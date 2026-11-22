import * as THREE from 'three';
import type { App } from '../../src/app/App';
import type { PocketWorldContext } from '../../src/world/pocket/types';

// Vite development fixture loaded explicitly by Playwright. No production import.
export function installPocketFixture(app: App) {
  const observation = {
    ticks: 0, variableTicks: 0, aborted: 0, disposed: 0,
    events: 0, mediaStopped: 0, resourcesDisposed: 0,
    context: null as PocketWorldContext | null,
  };
  app.pocketRegistry.registerWorld('W05', {
    readiness: 'verified',
    load(ctx) {
      observation.context = ctx;
      const map = new THREE.DataTexture(new Uint8Array([210, 160, 100, 255]), 1, 1);
      map.needsUpdate = true;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 18), new THREE.MeshBasicMaterial({ map }));
      floor.position.y = -0.1;
      ctx.root.add(floor);
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial());
      marker.position.set(0, 1.6, -1.5);
      ctx.root.add(marker);
      ctx.scope.trackObject(ctx.root);
      for (const resource of [map, floor.geometry, marker.geometry]) {
        resource.addEventListener('dispose', () => observation.resourcesDisposed++);
      }
      ctx.collision.addFloor(-9, 9, -9, 9, 0);
      ctx.interaction.register('fixture-complete', {
        object: marker, label: 'Complete fixture',
        activate: () => ctx.requestComplete(),
      });
      const controls = document.createElement('div');
      controls.id = 'test-pocket-resource';
      document.body.append(controls);
      const listener = () => observation.events++;
      window.addEventListener('test-pocket-event', listener);
      const audio = new Audio();
      const onPause = audio.pause.bind(audio);
      ctx.scope.track({ dispose() {
        onPause();
        observation.mediaStopped++;
        controls.remove();
        window.removeEventListener('test-pocket-event', listener);
      } });
      ctx.signal.addEventListener('abort', () => observation.aborted++, { once: true });
      return {
        spawnPosition: [0, 0, 0], spawnYaw: 0, fieldOfView: 55,
        fixedUpdate() { observation.ticks++; },
        variableUpdate() { observation.variableTicks++; },
        dispose() { observation.disposed++; },
      };
    },
  });
  return observation;
}
