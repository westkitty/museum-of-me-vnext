import { parseProgramme, parseYouTubeEntry, type Programme } from './programme';
import { parseYouTubeLink } from './youtube';

/**
 * Curator drafts: YouTube screenings a curator has added in THIS browser.
 * They live in localStorage under DRAFT_KEY, are always labelled "draft — this
 * browser only", and never change the published museum. They become part of
 * the shared programme only when promoted into data/cinema/programme.json:
 * through the development server's save route, or by exporting the programme
 * file and committing it. Nothing here talks to a server or to YouTube.
 */
export const DRAFT_KEY = 'museum-of-me:cinema-drafts:v1';
export const MAX_DRAFTS = 50;

export type DraftEntry = Record<string, unknown> & { readonly id: string; readonly source: 'youtube' };

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Programme ID for a video: lowercase, hyphen-joined, plus a short hash so IDs differing only in case stay distinct. */
export function draftIdFor(videoId: string): string {
  let hash = 0;
  for (const ch of videoId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const slug = videoId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'video';
  return `youtube-${slug}-${hash.toString(36).slice(0, 6)}`;
}

export function newDraftEntry(videoId: string, submittedUrl: string, today = new Date().toISOString().slice(0, 10)): DraftEntry {
  return {
    id: draftIdFor(videoId),
    source: 'youtube',
    title: `YouTube video ${videoId}`,
    projectId: '',
    exhibitId: null,
    description: '',
    context: 'Added by a curator from a pasted YouTube link. Title not yet verified with YouTube.',
    youtube: {
      videoId,
      submittedUrl,
      titleSource: 'provisional',
      author: null,
      durationSeconds: null,
      durationSource: null,
      availability: 'unverified',
      availabilityNote: `Added ${today}; not yet checked against YouTube.`,
      verifiedAt: null,
    },
  };
}

export type AddResult = { readonly ok: true; readonly entry: DraftEntry } | { readonly ok: false; readonly reason: string };

export class CinemaDrafts {
  private entries: DraftEntry[] = [];
  private readonly listeners = new Set<() => void>();
  /** Why the last load found nothing usable (unreadable storage, bad data), shown to the curator. */
  loadNote: string | null = null;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly publishedRaw: () => unknown,
  ) {
    this.load();
  }

  get list(): readonly DraftEntry[] { return this.entries; }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** The published programme with this browser's drafts after it, validated together. */
  programme(): Programme {
    return parseProgramme(this.publishedRaw(), this.entries);
  }

  add(link: string): AddResult {
    const parsed = parseYouTubeLink(link);
    if (!parsed.ok) return parsed;
    const published = parseProgramme(this.publishedRaw()).films;
    if (published.some((f) => f.kind === 'youtube' && f.youtube.videoId === parsed.videoId)) {
      return { ok: false, reason: 'That video is already in the published programme.' };
    }
    if (this.entries.some((e) => (e.youtube as { videoId: string }).videoId === parsed.videoId)) {
      return { ok: false, reason: 'That video is already in your drafts.' };
    }
    if (this.entries.length >= MAX_DRAFTS) return { ok: false, reason: `Drafts are limited to ${MAX_DRAFTS}; promote or remove some first.` };
    const entry = newDraftEntry(parsed.videoId, link.trim());
    const check = parseYouTubeEntry(entry, true);
    if ('reason' in check) return { ok: false, reason: check.reason };
    this.entries = [...this.entries, entry];
    this.save();
    return { ok: true, entry };
  }

  /** Curator-edited fallback title/description. A changed title is marked as the curator's, not YouTube's. */
  update(id: string, patch: { title?: string; description?: string }): string | null {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index < 0) return 'No such draft.';
    const current = this.entries[index];
    const title = patch.title === undefined ? current.title : patch.title.trim();
    const description = patch.description === undefined ? current.description : patch.description.trim();
    const titleChanged = title !== current.title;
    const next: DraftEntry = {
      ...current,
      title,
      description,
      youtube: { ...(current.youtube as Record<string, unknown>), ...(titleChanged ? { titleSource: 'curator' } : {}) },
    };
    const check = parseYouTubeEntry(next, true);
    if ('reason' in check) return check.reason;
    this.entries = this.entries.map((e, i) => (i === index ? next : e));
    this.save();
    return null;
  }

  move(id: string, delta: -1 | 1): void {
    const index = this.entries.findIndex((e) => e.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= this.entries.length) return;
    const next = [...this.entries];
    [next[index], next[target]] = [next[target], next[index]];
    this.entries = next;
    this.save();
  }

  remove(id: string): void {
    const next = this.entries.filter((e) => e.id !== id);
    if (next.length === this.entries.length) return;
    this.entries = next;
    this.save();
  }

  clear(): void {
    this.entries = [];
    this.save();
  }

  /**
   * The whole programme file as it would read with these drafts promoted: the
   * published entries unchanged and in order, then the drafts. Paste it over
   * data/cinema/programme.json and commit to publish.
   */
  exportProgramme(): string {
    const raw = this.publishedRaw() as { films?: unknown[] } & Record<string, unknown>;
    const films = [...(raw.films ?? []), ...this.entries];
    return `${JSON.stringify({ ...raw, films }, null, 2)}\n`;
  }

  /**
   * Import an exported programme (or a bare list of entries): every valid
   * YouTube entry not already published becomes a draft. Returns a summary.
   */
  importText(text: string): { added: number; skipped: string[] } {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return { added: 0, skipped: ['The file is not valid JSON.'] };
    }
    const list = Array.isArray(value) ? value : (value as { films?: unknown })?.films;
    if (!Array.isArray(list)) return { added: 0, skipped: ['No films list found.'] };
    const published = parseProgramme(this.publishedRaw()).films;
    const known = new Set(published.flatMap((f) => (f.kind === 'youtube' ? [f.youtube.videoId] : [])));
    for (const e of this.entries) known.add((e.youtube as { videoId: string }).videoId);
    const skipped: string[] = [];
    let added = 0;
    for (const item of list as Record<string, unknown>[]) {
      if (item?.source !== 'youtube') continue;
      const check = parseYouTubeEntry(item, true);
      if ('reason' in check) { skipped.push(`${String(item.id ?? '(unnamed)')}: ${check.reason}`); continue; }
      if (known.has(check.film.youtube.videoId)) { skipped.push(`${check.film.id}: already listed`); continue; }
      if (this.entries.length >= MAX_DRAFTS) { skipped.push(`${check.film.id}: draft limit reached`); continue; }
      known.add(check.film.youtube.videoId);
      this.entries = [...this.entries, item as DraftEntry];
      added++;
    }
    if (added) this.save();
    return { added, skipped };
  }

  private load(): void {
    this.entries = [];
    this.loadNote = null;
    let text: string | null = null;
    try {
      text = this.storage?.getItem(DRAFT_KEY) ?? null;
    } catch {
      this.loadNote = 'This browser does not allow saved drafts (storage unavailable); drafts last until the page closes.';
      return;
    }
    if (!text) return;
    try {
      const value = JSON.parse(text) as unknown;
      if (!Array.isArray(value)) throw new Error('not a list');
      for (const item of value as Record<string, unknown>[]) {
        if (item?.source === 'youtube' && !('reason' in parseYouTubeEntry(item, true))) this.entries.push(item as DraftEntry);
      }
      if (this.entries.length !== value.length) this.loadNote = 'Some saved drafts were invalid and were left out.';
    } catch {
      this.loadNote = 'Saved drafts could not be read and were left out.';
    }
  }

  private save(): void {
    try {
      if (this.entries.length) this.storage?.setItem(DRAFT_KEY, JSON.stringify(this.entries));
      else this.storage?.removeItem(DRAFT_KEY);
    } catch {
      this.loadNote = 'Drafts could not be saved in this browser; they last until the page closes.';
    }
    for (const fn of this.listeners) fn();
  }
}
