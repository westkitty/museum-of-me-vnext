import { describe, it, expect } from 'vitest';
import {
  defaultStateFor,
  applyInstallationKey,
  describeInstallationState,
} from '../src/content/installationState';
import { SOURCE_INSTALLATIONS } from '../src/content/sourceParity';

describe('source installation control adjudication (pass 7)', () => {
  const EIGHT_TARGETS = [
    {
      id: 'orbital-tomb',
      idempotentKey: 'ArrowLeft',
      actionKey: 'ArrowRight',
      actionName: 'Later month',
      expectedBefore: 'Meridian month 0/6',
      expectedAfter: 'Meridian month 1/6',
      expectedProperty: 'month',
      beforeVal: 0,
      afterVal: 1,
    },
    {
      id: 'drakken-sandbox',
      idempotentKey: 'Digit1',
      actionKey: 'Space',
      actionName: 'Advance assault',
      expectedBefore: 'Pyric / Solar · assault step 0/5 · actual condition',
      expectedAfter: 'Pyric / Solar · assault step 1/5 · actual condition',
      expectedProperty: 'step',
      beforeVal: 0,
      afterVal: 1,
    },
    {
      id: 'vibe-nexus',
      idempotentKey: 'Digit1',
      actionKey: 'Space',
      actionName: 'Advance compiler',
      expectedBefore: 'Purpose preserved · phase 0/4 · 0 failures',
      expectedAfter: 'Purpose preserved · phase 1/4 · 0 failures',
      expectedProperty: 'phase',
      beforeVal: 0,
      afterVal: 1,
    },
    {
      id: 'dexdictate',
      idempotentKey: 'KeyH',
      actionKey: 'Space',
      actionName: 'Start / stop capture',
      expectedBefore: 'hold mode · Idle · 0 local insertions',
      expectedAfter: 'hold mode · Capturing · 0 local insertions',
      expectedProperty: 'phase',
      beforeVal: 0,
      afterVal: 1,
    },
    {
      id: 'dexvault',
      idempotentKey: 'Digit1',
      actionKey: 'Space',
      actionName: 'Run retrieval step',
      expectedBefore: 'Canon constraint · retrieval step 0/3',
      expectedAfter: 'Canon constraint · retrieval step 1/3',
      expectedProperty: 'step',
      beforeVal: 0,
      afterVal: 1,
    },
    {
      id: 'osint-box',
      idempotentKey: 'Digit1',
      actionKey: 'Space',
      actionName: 'Advance safe route',
      expectedBefore: 'URL · ArchiveBox · step 0',
      expectedAfter: 'URL · ArchiveBox · step 1',
      expectedProperty: 'step',
      beforeVal: 0,
      afterVal: 1,
    },
    {
      id: 'westcat-east',
      idempotentKey: 'Digit1',
      actionKey: 'Space',
      actionName: 'Advance route',
      expectedBefore: 'Dry streets · route 0.00/10',
      expectedAfter: 'Dry streets · route 1.15/10',
      expectedProperty: 'distance',
      beforeVal: 0,
      afterVal: 1.15,
    },
    {
      id: 'westcat-familiar',
      idempotentKey: 'Digit1',
      actionKey: 'Space',
      actionName: 'Advance state',
      expectedBefore: 'Focus · watching',
      expectedAfter: 'Focus · working',
      expectedProperty: 'stateIndex',
      beforeVal: 0,
      afterVal: 1,
    },
  ];

  it('proves that controls[0] was idempotent for each of the eight installations', () => {
    for (const target of EIGHT_TARGETS) {
      const spec = SOURCE_INSTALLATIONS.find((s) => s.id === target.id)!;
      expect(spec, `Spec for ${target.id}`).toBeDefined();
      expect(String(spec.controls![0][1]), `${target.id} controls[0] code`).toBe(target.idempotentKey);

      const defaultState = defaultStateFor(target.id);
      const statusBefore = describeInstallationState(target.id, defaultState);
      expect(statusBefore).toBe(target.expectedBefore);

      // Dispatching controls[0] on the default state produces NO mutation
      const result = applyInstallationKey(target.id, defaultState, target.idempotentKey);
      expect(result.state[target.expectedProperty], `${target.id} after idempotentKey`).toBe(target.beforeVal);
      expect(JSON.stringify(result.state), `${target.id} state equality`).toBe(JSON.stringify(defaultState));
    }
  });

  it('proves that each of the eight installations successfully mutates and updates when its primary action key is dispatched', () => {
    for (const target of EIGHT_TARGETS) {
      const defaultState = defaultStateFor(target.id);

      // Dispatching the authored action key
      const result = applyInstallationKey(target.id, defaultState, target.actionKey);
      expect(result.changed, `${target.id} changed`).toBe(true);
      expect(result.state[target.expectedProperty], `${target.id} ${target.expectedProperty}`).toBe(target.afterVal);

      // Check interpretive status description
      const statusAfter = describeInstallationState(target.id, result.state);
      expect(statusAfter).toBe(target.expectedAfter);

      // Check reset key restores pristine state
      const resetCode = target.id === 'parable' ? 'KeyX' : 'KeyR';
      const resetResult = applyInstallationKey(target.id, result.state, resetCode);
      expect(resetResult.changed, `${target.id} reset changed`).toBe(true);
      expect(JSON.stringify(resetResult.state)).toBe(JSON.stringify(defaultState));
    }
  });
});
