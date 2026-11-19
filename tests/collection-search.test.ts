import { describe, expect, it } from 'vitest';
import { COLLECTION } from '../src/content/collection.generated';
import { exhibitFromParameter } from '../src/content/collectionLinks';
import { collectionSearch, COLLECTION_SEARCH_ENTRIES } from '../src/content/collectionSearch';

describe('collection discovery', () => {
  it('indexes each current project and associates it with its real host exhibit', () => {
    const projects = COLLECTION_SEARCH_ENTRIES.filter((entry) => entry.kind === 'project');
    expect(new Set(projects.map((entry) => entry.id))).toEqual(new Set(COLLECTION.projects.map((project) => project.id)));
    expect(collectionSearch('Large Language Launcher')[0]).toMatchObject({
      name: 'Large Language Launcher',
      kind: 'project',
      exhibit: { id: 'E34' },
    });
  });

  it('resolves repository aliases and filters saved queries by exhibit tags', () => {
    const project = COLLECTION.projects.find((entry) => entry.repos.length > 0)!;
    const alias = project.repos[0].split('/').at(-1)!;
    expect(collectionSearch(`type:project ${alias}`).some((entry) => entry.id === project.id)).toBe(true);
    expect(collectionSearch('type:project tag:privacy', { E17: ['Privacy'] })
      .every((entry) => entry.kind === 'project' && entry.exhibit.id === 'E17')).toBe(true);
    expect(collectionSearch('type:project tag:privacy', { E17: ['Privacy'] })).not.toHaveLength(0);
    expect(collectionSearch('type:project tag:privacy')).toEqual([]);
  });

  it('accepts stable exhibit IDs and rejects unknown routes', () => {
    expect(exhibitFromParameter('e08')?.id).toBe('E08');
    expect(exhibitFromParameter('E99')).toBeUndefined();
  });
});
