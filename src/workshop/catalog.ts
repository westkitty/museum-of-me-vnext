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
    id: 'sculpture-sphere',
    label: 'Sculpture sphere',
    description: 'A resizable sphere: small display piece or monumental outdoor sculpture.',
  },
  {
    id: 'wall-art',
    label: 'Wall artwork',
    description: 'Frame with editable size, depth, color and locally imported image.',
  },
  {
    id: 'wall-panel',
    label: 'Paintable wall panel',
    description: 'Thin wall finish overlay that can be colored, sized and surface-mounted.',
  },
  {
    id: 'artifact-table',
    label: 'Artifact table',
    description: 'Non-colliding display table for small objects and exhibit dressing.',
  },
  {
    id: 'partition-wall',
    label: 'Partition wall',
    description: 'Resizable paintable 3m-high construction wall; solid visitor collision by default.',
  },
  {
    id: 'floor-slab',
    label: 'Floor slab',
    description: 'Resizable 2m floor module with walkable top and adjustable height.',
  },
  {
    id: 'roof-panel',
    label: 'Roof panel',
    description: 'Resizable paintable roof module; place and rotate above your authored walls.',
  },
  {
    id: 'catalog-model',
    label: 'Imported 3D model',
    description: 'Reusable project GLB or a locally imported model with scale, color and interaction controls.',
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
