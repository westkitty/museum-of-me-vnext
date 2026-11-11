import raw from './builderAssets.json';

export interface BuilderLibraryModel {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly source: string;
  readonly sourcePath: string;
  readonly license: string;
  readonly srcRevision: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly nominalSize: readonly [number, number, number];
  readonly path: string;
}

export interface BuilderFinish {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly source: string;
  readonly license: string;
}

export const BUILDER_MODELS: readonly BuilderLibraryModel[] = raw.models as BuilderLibraryModel[];
export const BUILDER_FINISHES: readonly BuilderFinish[] = raw.textures as BuilderFinish[];
export const BUILDER_MODEL_PATTERN = /^workshop-models\/[0-9a-f]{64}\.glb$/;
export const BUILDER_IMAGE_PATTERN = /^workshop-media\/[0-9a-f]{64}\.webp$/;

export function builderModel(id: string): BuilderLibraryModel | undefined {
  return BUILDER_MODELS.find((item) => item.id === id);
}

export function builderModelAllowed(id: unknown): id is string {
  return typeof id === 'string' && (Boolean(builderModel(id)) || BUILDER_MODEL_PATTERN.test(id));
}

export function builderFinishAllowed(id: unknown): id is string {
  return typeof id === 'string'
    && (id === 'none' || Boolean(BUILDER_FINISHES.find((item) => item.id === id))
      || BUILDER_IMAGE_PATTERN.test(id));
}

export function builderAssetUrl(path: string): string {
  // Only known owned assets and hash-named imported files are ever resolved.
  // Never accept remote URLs, arbitrary paths, or user-controlled protocols.
  return `${import.meta.env.BASE_URL}${path}`;
}

export function builderModelUrl(id: string): string {
  const known = builderModel(id);
  if (known) return builderAssetUrl(known.path);
  if (BUILDER_MODEL_PATTERN.test(id)) return builderAssetUrl(id);
  throw new Error('Unrecognized builder model');
}

export function builderFinishUrl(id: string): string | null {
  if (id === 'none') return null;
  const known = BUILDER_FINISHES.find((item) => item.id === id);
  if (known) return builderAssetUrl(known.path);
  if (BUILDER_IMAGE_PATTERN.test(id)) return builderAssetUrl(id);
  return null;
}

export function searchBuilderLibrary(query: string, category = 'All'): readonly BuilderLibraryModel[] {
  const term = query.trim().toLowerCase();
  return BUILDER_MODELS.filter((item) =>
    (category === 'All' || item.category === category)
    && (!term || [item.label, item.id, item.category, item.source, ...item.tags]
      .some((value) => value.toLowerCase().includes(term))));
}
