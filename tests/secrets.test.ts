import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { SECRETS, type SecretDefinition } from '../src/content/secrets';
import { SecretsLog } from '../src/state/Secrets';
import { SecretSpots, isSecretControlId, type SecretFind } from '../src/world/SecretSpots';
import { ZONE_BY_ID } from '../src/world/layout';
import type { ExhibitControl } from '../src/exhibits/contract';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('secret content', () => {
  it('has ten secrets with unique ids, titles and lines', () => {
    expect(SECRETS).toHaveLength(10);
    expect(new Set(SECRETS.map((secret) => secret.id)).size).toBe(SECRETS.length);
    for (const secret of SECRETS) {
      expect(secret.title.length).toBeGreaterThan(0);
      expect(secret.line.length).toBeGreaterThan(0);
    }
  });

  it('mixes places to reach with objects to examine', () => {
    const kinds = new Set(SECRETS.map((secret) => secret.trigger.kind));
    expect(kinds.has('object')).toBe(true);
    expect(kinds.has('area') || kinds.has('zone')).toBe(true);
  });

  it('notes Dexter\'s Sanctuary quietly, at the threshold, without touching the room', () => {
    const sanctuary = SECRETS.find((secret) => secret.trigger.kind === 'zone' && secret.trigger.zone === 'sanctuary')!;
    expect(sanctuary.quiet).toBe(true);
    expect(sanctuary.world).toBe('interior');
    // The sanctuary zone begins on the descending approach, before the chamber.
    expect(ZONE_BY_ID.get('sanctuary')!.shapes.length).toBeGreaterThan(1);
  });

  it('only uses zone triggers inside, where zones mean something', () => {
    for (const secret of SECRETS) {
      if (secret.trigger.kind === 'zone') expect(secret.world).toBe('interior');
    }
  });

  it('places outdoor secrets away from the interior plan they would be confused with', () => {
    // Outdoor area secrets must not be inside the building footprint.
    for (const secret of SECRETS) {
      if (secret.world !== 'exterior' || secret.trigger.kind === 'zone') continue;
      const [x, , z] = secret.trigger.kind === 'area' ? secret.trigger.center : secret.trigger.position;
      expect(Math.hypot(x, z), `${secret.id} is outside the museum`).toBeGreaterThan(40);
    }
  });
});

describe('SecretsLog', () => {
  it('records a find once and remembers it across visits', () => {
    const storage = new MemoryStorage();
    const log = new SecretsLog(storage);
    expect(log.markFound('a', 1)).toBe(true);
    expect(log.markFound('a', 2)).toBe(false);
    const again = new SecretsLog(storage);
    expect(again.has('a')).toBe(true);
    expect(again.foundAt('a')).toBe(1);
    expect(again.countOf(['a', 'b'])).toBe(1);
  });

  it('starts fresh from unreadable or foreign saved data', () => {
    const storage = new MemoryStorage();
    storage.setItem('museum-of-me:secrets', '{not json');
    expect(new SecretsLog(storage).countOf(['a'])).toBe(0);
    storage.setItem('museum-of-me:secrets', JSON.stringify({ version: 99, found: { a: 1 } }));
    expect(new SecretsLog(storage).has('a')).toBe(false);
    storage.setItem('museum-of-me:secrets', JSON.stringify({ version: 1, found: { a: 'x', b: 3 } }));
    const log = new SecretsLog(storage);
    expect(log.has('a')).toBe(false);
    expect(log.has('b')).toBe(true);
  });

  it('keeps counting for this visit when storage is unavailable', () => {
    const log = new SecretsLog(null);
    expect(log.markFound('a')).toBe(true);
    expect(log.has('a')).toBe(true);
  });
});

describe('SecretSpots', () => {
  const defs: SecretDefinition[] = [
    { id: 'room', world: 'interior', title: 'Room', line: 'r', trigger: { kind: 'zone', zone: 'balcony' } },
    { id: 'spot', world: 'exterior', title: 'Spot', line: 's', trigger: { kind: 'area', center: [100, 0, 0], radius: 3 } },
    { id: 'thing', world: 'exterior', title: 'Thing', line: 't', trigger: { kind: 'object', position: [50, 0, 50], model: 'folded-star', prompt: 'Pick it up' } },
  ];

  function setup() {
    const finds: SecretFind[] = [];
    const spots = new SecretSpots(defs, new SecretsLog(null), (find) => finds.push(find));
    return { spots, finds };
  }

  it('finds an area secret only in its own world and only once', () => {
    const { spots, finds } = setup();
    spots.update('interior', at(100, 0, 0), 'plaza');
    expect(finds).toHaveLength(0);
    spots.update('exterior', at(101, 0, 1), 'plaza');
    spots.update('exterior', at(101, 0, 1), 'plaza');
    expect(finds.map((find) => find.secret.id)).toEqual(['spot']);
    expect(finds[0]).toMatchObject({ found: 1, total: 3 });
  });

  it('does not find an area secret from far above or below it', () => {
    const { spots, finds } = setup();
    spots.update('exterior', at(100, 10, 0), 'plaza');
    expect(finds).toHaveLength(0);
  });

  it('finds a zone secret on reaching the zone inside, never from outside', () => {
    const { spots, finds } = setup();
    spots.update('exterior', at(0, 10, 0), 'balcony');
    expect(finds).toHaveLength(0);
    spots.update('interior', at(0, 10, 0), 'balcony');
    expect(finds.map((find) => find.secret.id)).toEqual(['room']);
  });

  it('builds object secrets into their world and finds them through the interaction surface', () => {
    const { spots, finds } = setup();
    const scope = new ResourceScope('secrets-test');
    const root = new THREE.Group();
    const controls = new Map<string, ExhibitControl>();
    spots.attachObjects('exterior', root, scope, (id, control) => { controls.set(id, control); return () => controls.delete(id); });
    expect(root.getObjectByName('secret-thing')).toBeDefined();
    expect([...controls.keys()]).toEqual(['secret:thing']);
    expect(isSecretControlId('secret:thing')).toBe(true);
    expect(isSecretControlId('north-1')).toBe(false);
    controls.get('secret:thing')!.activate();
    controls.get('secret:thing')!.activate();
    expect(finds.map((find) => find.secret.id)).toEqual(['thing']);
    spots.dispose();
    expect(controls.size).toBe(0);
    expect(root.children).toHaveLength(0);
    scope.dispose();
  });

  it('lets one secret use its own presentation instead of the default', () => {
    const { spots, finds } = setup();
    const own = vi.fn();
    spots.setPresentation('spot', own);
    spots.update('exterior', at(100, 0, 0), 'plaza');
    expect(own).toHaveBeenCalledWith(expect.objectContaining({ found: 1, total: 3 }));
    expect(finds).toHaveLength(0);
  });

  it('keeps the find even if a presentation throws', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = new SecretsLog(null);
    const spots = new SecretSpots(defs, log, () => { throw new Error('boom'); });
    spots.update('exterior', at(100, 0, 0), 'plaza');
    expect(log.has('spot')).toBe(true);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
