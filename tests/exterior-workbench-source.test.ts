import { describe, expect, it } from 'vitest';
import { AUTHORABLE_SCENE_DEFINITIONS } from '../src/workshop/AuthorableSceneRegistry';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';

describe('shared exterior Workbench source', () => {
  it('owns the playable exterior roots and stable non-authorable spatial feature IDs', () => {
    const world = new ExteriorWorld('low');
    const features = new Map<string, string>();
    world.root.traverse((object) => {
      const featureId = object.userData.spatialFeatureId;
      if (typeof featureId === 'string') features.set(featureId, object.name);
    });
    expect(world.root.name).toBe('exterior-world');
    const expected: Record<string, string> = {
      'exterior-museum-shell': 'exterior-museum-shell',
      'exterior-dome': 'central-turquoise-dome-glazing',
      'lagoon-east': 'east-sheltered-lagoon',
      'spire-northwest': 'single-golden-spire',
      'pier-south': 'south-arrival-pier-deck',
    };
    for (const [id, name] of Object.entries(expected)) expect(features.get(id)).toBe(name);
    expect([...features.keys()].some((id) => AUTHORABLE_SCENE_DEFINITIONS.some((entry) => entry.id === id))).toBe(false);
    expect(world.collision.supportHeight(0, 10, 0)).toBeCloseTo(-0.5);
    world.dispose();
  });
});
