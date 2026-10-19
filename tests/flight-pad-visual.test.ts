import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { FlightPadAtmosphere } from '../src/world/FlightPadAtmosphere';
import { FLIGHT_PAD_CENTER, PLINTH_TOP_Y } from '../src/world/layout';

describe('rotunda flight-pad visual contract', () => {
  it('presents a non-colliding brass rim and twelve batched launch glyphs', () => {
    const scope = new ResourceScope('flight-inscription');
    const flight = new FlightPadAtmosphere(scope);
    const rim = flight.group.getObjectByName('flight-pad-etched-rim') as THREE.Mesh;
    const glyphs = flight.group.getObjectByName('flight-pad-rotating-glyphs') as THREE.InstancedMesh;
    expect(rim.geometry).toBeInstanceOf(THREE.RingGeometry);
    expect(rim.position.y).toBeGreaterThan(PLINTH_TOP_Y);
    expect(glyphs.isInstancedMesh).toBe(true);
    expect(glyphs.count).toBe(12);
    expect(flight.instances.count).toBeLessThanOrEqual(18);
    let lights = 0;
    flight.group.traverse((node) => { if ((node as THREE.Light).isLight) lights++; });
    expect(lights).toBe(0);
    flight.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('freezes the inscription in reduced motion and sleeps outside its visibility radius', () => {
    const scope = new ResourceScope('flight-animation');
    const flight = new FlightPadAtmosphere(scope);
    const inscription = flight.group.getObjectByName('flight-pad-inscription')!;
    const start = inscription.rotation.y;
    flight.update(1 / 60, 1, false, FLIGHT_PAD_CENTER[0], FLIGHT_PAD_CENTER[2]);
    expect(inscription.rotation.y).toBeGreaterThan(start);
    const moved = inscription.rotation.y;
    flight.update(1 / 60, 1, true, FLIGHT_PAD_CENTER[0], FLIGHT_PAD_CENTER[2]);
    expect(inscription.rotation.y).toBe(moved);
    flight.update(1 / 60, 0.4, false, FLIGHT_PAD_CENTER[0] + 500, FLIGHT_PAD_CENTER[2]);
    expect(flight.group.visible).toBe(false);
    expect(inscription.rotation.y).toBe(moved);
    flight.dispose();
    scope.dispose();
  });
});
