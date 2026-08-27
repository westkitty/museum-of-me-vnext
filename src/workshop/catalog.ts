export const WORKSHOP_PREFABS = [
  {
    id: 'display-plinth',
    label: 'Display plinth',
    description: 'Low non-colliding pedestal for sculpture, objects, and visual anchors.',
  },
  {
    id: 'museum-bench',
    label: 'Museum bench',
    description: 'Simple gallery bench for composition and visitor-rest areas.',
  },
  {
    id: 'sign-post',
    label: 'Sign post',
    description: 'Freestanding museum sign for wayfinding or temporary interpretation.',
  },
  {
    id: 'artifact-table',
    label: 'Artifact table',
    description: 'Non-colliding display table for small objects and exhibit dressing.',
  },
] as const;

export type WorkshopPrefabId = (typeof WORKSHOP_PREFABS)[number]['id'];

const PREFAB_IDS = new Set<string>(WORKSHOP_PREFABS.map((prefab) => prefab.id));

export function isWorkshopPrefabId(value: unknown): value is WorkshopPrefabId {
  return typeof value === 'string' && PREFAB_IDS.has(value);
}

export function workshopPrefabLabel(id: WorkshopPrefabId): string {
  return WORKSHOP_PREFABS.find((prefab) => prefab.id === id)?.label ?? id;
}
