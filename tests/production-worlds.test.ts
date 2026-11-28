import { describe, expect, it, vi } from 'vitest';
import { CANONICAL_POCKET_WORLDS, PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import {
  POCKET_PROMOTION_ORDER,
  PRODUCTION_ACTIVE_WORLDS,
  PRODUCTION_WORLD_FACTORIES,
  activateProductionWorlds,
  assertPromotionPrefix,
  lazyProductionLoader,
} from '../src/world/pocket/productionWorlds';
import type { PocketWorldContext, PocketWorldId } from '../src/world/pocket/types';
import { rehearsalPrefixFromSearch, startPocketRehearsal } from '../src/world/pocket/pocketRehearsal';

const noStamps = { earnedCount: 0, canEnterW10: () => false };

describe('production pocket-world activation', () => {
  it('keeps every production destination dormant by default', () => {
    expect(PRODUCTION_ACTIVE_WORLDS).toEqual([]);
    const registry = new PocketWorldRegistry();
    expect(activateProductionWorlds(registry)).toEqual([]);
    for (const def of registry.list()) {
      expect(def.readiness).toBe('dormant');
      expect(def.load).toBeUndefined();
    }
  });

  it('follows the protected promotion order and covers all eleven worlds', () => {
    expect(POCKET_PROMOTION_ORDER).toEqual(['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'L01', 'W10']);
    expect(Object.keys(PRODUCTION_WORLD_FACTORIES).sort()).toEqual([...CANONICAL_POCKET_WORLDS.map((d) => d.id)].sort());
  });

  it('refuses out-of-order, skipped or repeated promotion', () => {
    expect(() => assertPromotionPrefix(['W01', 'W02'])).not.toThrow();
    expect(() => assertPromotionPrefix(['W02'])).toThrow(/out of order/);
    expect(() => assertPromotionPrefix(['W01', 'W03'])).toThrow(/expected W02/);
    expect(() => assertPromotionPrefix(['W01', 'W01'])).toThrow();
    expect(() => assertPromotionPrefix([...POCKET_PROMOTION_ORDER, 'W01' as PocketWorldId])).toThrow(/expected nothing/);
    const registry = new PocketWorldRegistry();
    expect(() => activateProductionWorlds(registry, ['W01', 'W06'])).toThrow();
    expect(registry.get('W01')?.readiness).toBe('dormant');
  });

  it('activates with canonical titles, slots and the genuine W10 stamp gate', () => {
    const registry = new PocketWorldRegistry();
    activateProductionWorlds(registry, POCKET_PROMOTION_ORDER);
    for (const canonical of CANONICAL_POCKET_WORLDS) {
      const def = registry.get(canonical.id)!;
      expect(def.readiness).toBe('verified');
      expect(typeof def.load).toBe('function');
      expect(def.title).toBe(canonical.title);
      expect(def.title).not.toMatch(/preview|test rig/i);
      expect(def.stampSlot).toBe(canonical.stampSlot);
      expect(def.isBonus).toBe(canonical.isBonus);
      expect(def.returnAnchor).toEqual(canonical.returnAnchor);
    }
    expect(registry.stampedDefinitions()).toHaveLength(10);
    expect(registry.bonusDefinitions().map((d) => d.id)).toEqual(['L01']);
    expect(registry.canEnter('W06', noStamps).ok).toBe(true);
    expect(registry.canEnter('L01', noStamps).ok).toBe(true);
    const w10 = registry.canEnter('W10', noStamps);
    expect(w10.ok).toBe(false);
    expect(w10.ok ? '' : w10.reason).toBe('locked-stamps');
    expect(registry.canEnter('W10', { earnedCount: 1, canEnterW10: () => true }).ok).toBe(true);
  });

  it('fetches a world module once, honours abort, and retries after a failed fetch', async () => {
    const created = { id: 'instance' };
    const factory = vi.fn(() => created);
    let fail = true;
    const fetchFactory = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return factory as never;
    });
    const load = lazyProductionLoader('W02', fetchFactory);
    const ctx = {} as PocketWorldContext;
    await expect(load(ctx, new AbortController().signal)).rejects.toThrow('offline');
    fail = false;
    const aborted = new AbortController(); aborted.abort();
    await expect(load(ctx, aborted.signal)).rejects.toThrow(/aborted/);
    expect(factory).not.toHaveBeenCalled();
    await expect(load(ctx, new AbortController().signal)).resolves.toBe(created);
    await load(ctx, new AbortController().signal);
    expect(fetchFactory).toHaveBeenCalledTimes(2); // one failed fetch, then one cached module
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('rehearses a staged release as an ordered prefix of the promotion order', async () => {
    expect(rehearsalPrefixFromSearch('', 11)).toBe(11);
    expect(rehearsalPrefixFromSearch('?rehearsalPrefix=3', 11)).toBe(3);
    expect(rehearsalPrefixFromSearch('?qa=1&rehearsalPrefix=0', 11)).toBe(0);
    for (const bad of ['-1', '12', '2.5', 'all']) expect(rehearsalPrefixFromSearch(`?rehearsalPrefix=${bad}`, 11)).toBe(11);

    const registry = new PocketWorldRegistry();
    await startPocketRehearsal(registry, '?rehearsalPrefix=9');
    const verified = registry.list().filter((d) => d.readiness === 'verified').map((d) => d.id);
    expect(verified).toEqual(POCKET_PROMOTION_ORDER.slice(0, 9));
    expect(registry.canEnter('L01', noStamps).ok).toBe(false);
    expect(registry.canEnter('W10', noStamps).ok).toBe(false);
  });
});
