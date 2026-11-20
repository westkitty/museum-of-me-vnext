import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { moveCommandSelection, commandStatusText } from '../src/ui/CommandPalette';
import { SETTING_RANGES, settingValueText, RESTORABLE_SETTINGS, pickRestorable, type RangeSetting } from '../src/ui/SettingsPanel';
import { DEFAULT_PREFERENCES, sanitizePreferences } from '../src/state/Preferences';
import { touchLookGain, TOUCH_LOOK_BASE_GAIN } from '../src/player/Input';
import type { InputManager } from '../src/player/Input';
import { PlayerController, EYE_HEIGHT, STEP_SMOOTH_MIN } from '../src/player/PlayerController';
import { pauseNoticeFor, CONTEXT_RESTORE_PATIENCE_S } from '../src/ui/PauseNotice';
import { buildMuseum } from './helpers/walk';
import { canonicalRoute } from '../src/world/route';

function fakeInput(held: ReadonlySet<string> = new Set()): InputManager {
  return {
    isDown: (a: string) => held.has(a), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => {},
  } as unknown as InputManager;
}

describe('uplift2 D · command palette keyboard model', () => {
  it('wraps arrow movement at both ends and pages by five', () => {
    expect(moveCommandSelection(0, 'ArrowUp', 12)).toBe(11);
    expect(moveCommandSelection(11, 'ArrowDown', 12)).toBe(0);
    expect(moveCommandSelection(3, 'ArrowDown', 12)).toBe(4);
    expect(moveCommandSelection(2, 'PageDown', 12)).toBe(7);
    expect(moveCommandSelection(9, 'PageDown', 12)).toBe(11);
    expect(moveCommandSelection(3, 'PageUp', 12)).toBe(0);
    // Out-of-range state (a list that shrank) is clamped before moving.
    expect(moveCommandSelection(40, 'ArrowDown', 5)).toBe(0);
    expect(moveCommandSelection(-3, 'ArrowUp', 5)).toBe(4);
  });

  it('leaves non-navigation keys to the search field', () => {
    for (const key of ['Enter', 'a', 'Home', 'End', 'Escape', 'Tab']) {
      expect(moveCommandSelection(1, key, 10)).toBeNull();
    }
    expect(moveCommandSelection(0, 'ArrowDown', 0)).toBe(0);
  });

  it('states the result count and the keys in the status line', () => {
    expect(commandStatusText(1, 'star')).toMatch(/^1 result\. /);
    expect(commandStatusText(7, 'star')).toMatch(/^7 results\. Up and Down arrows choose, Enter goes, Escape closes\.$/);
    expect(commandStatusText(12, '')).toMatch(/12 suggestions\. Type to search/);
    expect(commandStatusText(0, 'zzz')).toBe('No results.');
  });
});

describe('uplift2 D · settings ranges, units and touch look', () => {
  it('every slider range survives a reload unchanged (defect: mouse 0.3-2.5 / scale 0.8 were clamped on load)', () => {
    for (const [key, range] of Object.entries(SETTING_RANGES) as [RangeSetting, { min: number; max: number }][]) {
      for (const value of [range.min, range.max]) {
        const stored = sanitizePreferences({ ...DEFAULT_PREFERENCES, [key]: value });
        expect(stored[key], `${key}=${value}`).toBeCloseTo(value, 9);
      }
      expect(range.min).toBeLessThanOrEqual(DEFAULT_PREFERENCES[key]);
      expect(range.max).toBeGreaterThanOrEqual(DEFAULT_PREFERENCES[key]);
    }
  });

  it('speaks and shows slider values with their unit', () => {
    expect(settingValueText('fieldOfView', 65)).toBe('65°');
    expect(settingValueText('uiScale', 1.6)).toBe('160%');
    expect(settingValueText('masterVolume', 0.35)).toBe('35%');
    expect(settingValueText('hudOpacity', 0.88)).toBe('88%');
    expect(settingValueText('mouseSensitivity', 1.2)).toBe('×1.20');
    expect(settingValueText('touchSensitivity', 0.45)).toBe('×0.45');
  });

  it('touch sensitivity is restorable with the other comfort settings', () => {
    expect(RESTORABLE_SETTINGS).toContain('touchSensitivity');
    expect(pickRestorable({ ...DEFAULT_PREFERENCES, touchSensitivity: 2 }).touchSensitivity).toBe(2);
  });

  it('keeps the historical default touch gain and makes touch independent of mouse sensitivity', () => {
    expect(touchLookGain(1, 1)).toBeCloseTo(TOUCH_LOOK_BASE_GAIN, 9);
    expect(touchLookGain(Number.NaN, 0)).toBeCloseTo(TOUCH_LOOK_BASE_GAIN, 9);
    const built = buildMuseum();
    const turn = (touch: number, mouse: number) => {
      const pc = new PlayerController(built.collision, fakeInput());
      pc.yaw = 0;
      pc.applyLook(100 * touchLookGain(touch, mouse), 0, mouse, false);
      return pc.yaw;
    };
    // Changing mouse sensitivity no longer changes how far a drag turns.
    expect(turn(1, 2.25)).toBeCloseTo(turn(1, 0.45), 9);
    // Touch sensitivity does, proportionally.
    expect(turn(2, 1) / turn(1, 1)).toBeCloseTo(2, 9);
  });
});

describe('uplift2 D · camera comfort on step-ups', () => {
  it('eases the eye after a step-up while collision still lifts the body in one step', () => {
    const built = buildMuseum();
    const pc = new PlayerController(built.collision, fakeInput(new Set(['forward'])));
    const camera = new THREE.PerspectiveCamera();
    const route = canonicalRoute();
    pc.teleport([...route[1].at] as [number, number, number]);
    let maxBodyRise = 0;
    let maxCameraRise = 0;
    let lastCameraY = Number.NaN;
    for (let i = 2; i < route.length; i++) {
      const target = route[i].at;
      for (let s = 0; s < 1200; s++) {
        const dx = target[0] - pc.position.x;
        const dz = target[2] - pc.position.z;
        if (Math.hypot(dx, dz) < 0.6) break;
        pc.yaw = Math.atan2(-dx, -dz);
        const y0 = pc.position.y;
        pc.fixedUpdate(1 / 60);
        maxBodyRise = Math.max(maxBodyRise, pc.position.y - y0);
        pc.applyToCamera(camera, 1);
        if (Number.isFinite(lastCameraY)) maxCameraRise = Math.max(maxCameraRise, camera.position.y - lastCameraY);
        lastCameraY = camera.position.y;
      }
    }
    // Measured before this change: the camera rose 0.543 m in one 1/60 s step
    // at the grand-stair foot and 0.55 m entering the Sanctuary.
    expect(maxBodyRise).toBeGreaterThan(0.5);
    expect(maxCameraRise).toBeLessThan(0.15);
    // Standing still, the eye settles exactly at eye height.
    const still = new PlayerController(built.collision, fakeInput());
    still.teleport([pc.position.x, pc.position.y, pc.position.z]);
    for (let s = 0; s < 60; s++) still.fixedUpdate(1 / 60);
    still.applyToCamera(camera, 1);
    expect(camera.position.y).toBeCloseTo(still.position.y + EYE_HEIGHT, 3);
    expect(STEP_SMOOTH_MIN).toBeGreaterThan(0.05);
  });

  it('settles within a quarter second and teleport clears any lag', () => {
    const built = buildMuseum();
    const pc = new PlayerController(built.collision, fakeInput(new Set(['forward'])));
    const route = canonicalRoute();
    pc.teleport([...route[1].at] as [number, number, number]);
    let peak = 0;
    let stepsAfterPeak = -1;
    for (let i = 2; i < route.length && stepsAfterPeak < 0; i++) {
      const target = route[i].at;
      for (let s = 0; s < 1200; s++) {
        const dx = target[0] - pc.position.x;
        const dz = target[2] - pc.position.z;
        if (Math.hypot(dx, dz) < 0.6) break;
        pc.yaw = Math.atan2(-dx, -dz);
        pc.fixedUpdate(1 / 60);
        if (pc.stepEyeLag > 0.4) { peak = pc.stepEyeLag; stepsAfterPeak = 0; break; }
      }
    }
    expect(peak).toBeGreaterThan(0.4);
    // 15 fixed steps = 0.25 s; the walker keeps moving, so this also covers
    // the lag decaying while the visitor carries on walking.
    for (let s = 0; s < 15; s++) pc.fixedUpdate(1 / 60);
    expect(pc.stepEyeLag).toBeLessThan(peak * 0.1);
    pc.teleport([0, 0, 0]);
    expect(pc.stepEyeLag).toBe(0);
  });
});

describe('uplift2 D · paused 3D view notice', () => {
  it('says nothing while rendering is healthy', () => {
    expect(pauseNoticeFor({ contextLost: false })).toBeNull();
  });

  it('explains a lost graphics context in visitor language and offers a reload', () => {
    const first = pauseNoticeFor({ contextLost: true, lostForSeconds: 0 })!;
    expect(first.title).toBe('The 3D view has paused');
    expect(first.message).toMatch(/waiting/i);
    expect(first.message).not.toMatch(/WebGL/);
    expect(first.reload).toBe(true);
    const later = pauseNoticeFor({ contextLost: true, lostForSeconds: CONTEXT_RESTORE_PATIENCE_S })!;
    expect(later.message).toMatch(/Reloading usually fixes this/);
    expect(later.message).not.toBe(first.message);
  });
});
