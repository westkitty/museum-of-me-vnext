import { describe, expect, it } from 'vitest';
import { Passport, PASSPORT_BACKUP_KEY, PASSPORT_KEY, PASSPORT_QUARANTINE_KEY } from '../src/state/Passport';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import { exportVisitorSession, previewVisitorSession } from '../src/state/VisitorSession';
import { Journal } from '../src/state/Journal';
import { Study } from '../src/state/Study';
import { SecretsLog } from '../src/state/Secrets';
import { VisitThread } from '../src/state/VisitThread';
import { loadPreferencesResult } from '../src/state/Preferences';

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    clear: () => { data.clear(); },
    key: (index) => [...data.keys()][index] ?? null,
  };
}

describe('pocket-world registry and passport', () => {
  it('keeps ten canonical slots, a separate bonus and every production world dormant', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.list().map(({ id }) => id)).toEqual([
      'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'L01', 'W10',
    ]);
    expect(registry.stampedDefinitions().map(({ stampSlot }) => stampSlot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(registry.bonusDefinitions().map(({ id, stampSlot }) => [id, stampSlot])).toEqual([['L01', null]]);
    for (const def of registry.list()) {
      expect(def.load).toBeUndefined();
      expect(registry.canEnter(def.id)).toMatchObject({ ok: false, reason: 'dormant' });
    }
  });

  it('requires both a different-world earned stamp and a real W10 loader', () => {
    const registry = new PocketWorldRegistry();
    const passport = new Passport(null);
    passport.recordExit('W10', true);
    passport.recordExit('L01', true);
    expect(registry.isPlayable('W10', passport)).toBe(false);
    registry.registerWorld('W10', { readiness: 'verified' });
    expect(registry.canEnter('W10', passport)).toMatchObject({ reason: 'missing-loader' });
    registry.registerWorld('W10', { readiness: 'verified', load: () => ({ spawnPosition: [0, 0, 0], spawnYaw: 0 }) });
    expect(registry.canEnter('W10', passport)).toMatchObject({ reason: 'locked-stamps' });
    passport.recordExit('W01', true);
    expect(registry.isPlayable('W10', passport)).toBe(true);
  });

  it('unlocks on first exit with zero stamps and awards each completion once', () => {
    const device = storage();
    const passport = new Passport(device);
    expect(passport.unlockedUi).toBe(false);
    passport.recordExit('W05', false, 1);
    expect(passport.unlockedUi).toBe(true);
    expect(passport.earnedCount).toBe(0);
    expect(passport.recordExit('W05', true, 2).stampEarned).toBe(true);
    expect(passport.recordExit('W05', true, 3).stampEarned).toBe(false);
    expect(passport.recordExit('L01', true, 4).bonusCompleted).toBe(true);
    const restored = new Passport(device);
    expect(restored.stampFor('W05')?.earnedAt).toBe(2);
    expect(restored.earnedCount).toBe(1);
    expect(restored.hasStamp('L01')).toBe(false);
    expect(restored.hasBonusCompleted()).toBe(true);
  });

  it('reads older v1 records and quarantines a corrupt primary before backup recovery', () => {
    const device = storage();
    const early = JSON.stringify({ version: 1, unlockedUi: true, stamps: { W01: { earnedAt: 42 } } });
    device.setItem(PASSPORT_KEY, early);
    expect(new Passport(device).hasStamp('W01')).toBe(true);
    device.setItem(PASSPORT_BACKUP_KEY, early);
    device.setItem(PASSPORT_KEY, '{broken');
    const restored = new Passport(device);
    expect(restored.hasStamp('W01')).toBe(true);
    expect(restored.recoveryNotice).toBeTruthy();
    expect(device.getItem(PASSPORT_QUARANTINE_KEY)).toContain('{broken');
  });

  it('round-trips Passport through the visitor session and keeps older exports usable', () => {
    const passport = new Passport(null);
    passport.recordExit('W05', true);
    const parts = {
      passport, journal: new Journal(), study: new Study(() => new Set()),
      preferences: loadPreferencesResult().preferences,
      visitThread: new VisitThread(), secretsLog: new SecretsLog(),
    };
    const { values } = previewVisitorSession(exportVisitorSession(parts), parts);
    expect(JSON.parse(values[PASSPORT_KEY] ?? '').stamps.W05.worldId).toBe('W05');
    expect(previewVisitorSession(exportVisitorSession({ ...parts, passport: undefined }), parts).values[PASSPORT_KEY]).toBeUndefined();
  });
});
