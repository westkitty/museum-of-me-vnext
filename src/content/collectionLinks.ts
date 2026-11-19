import { EXHIBITS_BY_ID } from './collection.generated';
import type { ExhibitRecord } from './types';

export function exhibitFromParameter(value: string | null): ExhibitRecord | undefined {
  return value ? EXHIBITS_BY_ID.get(value.trim().toUpperCase()) : undefined;
}

export function museumLink(options: { exhibit?: string; guide?: string; browse?: boolean } = {}): string {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  if (options.browse) url.searchParams.set('view', 'collection');
  if (options.exhibit) url.searchParams.set('exhibit', options.exhibit);
  if (options.guide) url.searchParams.set('guide', options.guide);
  return url.href;
}
