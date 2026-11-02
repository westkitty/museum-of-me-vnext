import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { PlayerController } from '../src/player/PlayerController';
import type { Action, InputManager } from '../src/player/Input';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { Sky, skyPreviewForHour } from '../src/world/Sky';
import { Lighting } from '../src/render/Lighting';
import { QUALITY } from '../src/render/QualityTiers';

describe('developer free flight', () => {
  function controller() {
    const held = new Set<Action>();
    const input = {
      on: () => () => {},
      isDown: (action: Action) => held.has(action),
      uiCaptured: false,
      touchMoveX: 0,
      touchMoveY: 0,
    } as unknown as InputManager;
    return { held, player: new PlayerController(new CollisionWorld(), input) };
  }

  it('flies without pad-launch pop, collision, or automatic landing', () => {
    const { held, player } = controller();
    player.teleport([2, 0, 3]);
    expect(player.setDeveloperFlight(true)).toBe(true);
    expect(player.developerFlightMode).toBe(true);
    held.add('forward');
    held.add('jump');
    player.fixedUpdate(0.1);
    expect(player.position.y).toBeCloseTo(0.7);
    expect(player.position.z).toBeLessThan(3);
    held.delete('forward');
    held.delete('jump');
    held.add('descend');
    player.fixedUpdate(0.1);
    expect(player.position.y).toBeCloseTo(0);
    held.clear();
    player.fixedUpdate(0.5);
    expect(player.flightMode).toBe(true);
    expect(player.position.y).toBeCloseTo(0);
    expect(player.setDeveloperFlight(false)).toBe(true);
    expect(player.flightMode).toBe(false);
    expect(player.developerFlightMode).toBe(false);
  });

  it('respects freezes and resets when teleported', () => {
    const { player } = controller();
    player.setFrozen(true);
    expect(player.setDeveloperFlight(true)).toBe(false);
    player.setFrozen(false);
    expect(player.setDeveloperFlight(true)).toBe(true);
    player.teleport([0, 1, 0]);
    expect(player.developerFlightMode).toBe(false);
    expect(player.flightMode).toBe(false);
  });

  it('preserves the separate Rotunda flight-pad behavior', () => {
    const { player } = controller();
    player.enterFlight();
    player.fixedUpdate(0.1);
    expect(player.flightMode).toBe(true);
    expect(player.developerFlightMode).toBe(false);
    expect(player.position.y).toBeGreaterThan(0.5);
  });
});

describe('manual sky clock preview', () => {
  it('covers night, sunrise, noon, and sunset with finite values', () => {
    expect(skyPreviewForHour(22).daylight).toBe(0);
    expect(skyPreviewForHour(12).daylight).toBe(1);
    expect(skyPreviewForHour(6).twilight).toBeGreaterThan(0.9);
    expect(skyPreviewForHour(18).twilight).toBeGreaterThan(0.9);
    expect(skyPreviewForHour(12).sunDirection.y).toBeGreaterThan(0.9);
    expect(skyPreviewForHour(0).daylight).toBe(0);
    expect(skyPreviewForHour(Number.NaN).daylight).toBe(0);
  });

  it('restores shader uniforms, horizon and moonlight after a day preview', () => {
    const scope = new ResourceScope('dev-sky');
    const sky = new Sky(scope);
    const lights = new Lighting(scope, QUALITY.low);
    const shader = sky.mesh.material as THREE.ShaderMaterial;
    const horizon = sky.horizon.getHex();
    const key = lights.group.children.find((x) => x instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
    const moonPosition = key.position.clone();
    const moonIntensity = key.intensity;
    const noon = sky.setTimeOfDay(12);
    lights.setSkyPreview(noon);
    expect(shader.uniforms.daylight.value).toBe(1);
    expect(sky.horizon.getHex()).not.toBe(horizon);
    expect(key.intensity).toBeGreaterThan(moonIntensity);
    expect(key.position.equals(moonPosition)).toBe(false);
    lights.setSkyPreview(sky.setTimeOfDay(null));
    expect(shader.uniforms.daylight.value).toBe(0);
    expect(shader.uniforms.twilight.value).toBe(0);
    expect(sky.horizon.getHex()).toBe(horizon);
    expect(key.position.distanceTo(moonPosition)).toBeLessThan(0.00001);
    expect(key.intensity).toBe(moonIntensity);
    lights.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
