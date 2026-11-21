import programmeJson from '../../data/cinema/programme.json';
import { YOUTUBE_ID, parseYouTubeLink, thumbnailUrl } from './youtube';

/**
 * The cinema's screening content, kept apart from the room (src/world/Cinema.ts)
 * and the player (CinemaPlayer.ts). Two kinds of source, told apart by a
 * `source` field and validated separately:
 *
 * - `local`: real media shipped with the museum (relative path, SHA-256 hashed
 *   against the disk by tests/cinema.test.ts). Plays offline.
 * - `youtube`: an explicitly chosen online exception, played through YouTube's
 *   official embed player after the visitor accepts the external-content notice.
 *   Unlisted links are accepted; a link in this public programme is public.
 */
export interface FilmMedia {
  /** Path relative to the app's base (no leading slash), so Pages and file:// both resolve it. */
  readonly src: string;
  readonly type: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly hasAudio: boolean;
}

interface FilmBase {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly exhibitId: string | null;
  readonly description: string;
  readonly context: string;
  readonly captionsNote: string | null;
  readonly sourceFile: string;
}

export interface LocalFilm extends FilmBase {
  readonly kind: 'local';
  readonly media: FilmMedia;
  readonly poster: { readonly src: string; readonly sha256: string; readonly frameAtSeconds: number } | null;
  /** WebVTT path, when the film has captions. */
  readonly captions: { readonly src: string; readonly language: string; readonly label: string } | null;
}

export type YouTubeAvailability = 'embeddable' | 'unverified' | 'unavailable';
export type TitleSource = 'youtube-oembed' | 'curator' | 'provisional';

export interface YouTubeSource {
  readonly videoId: string;
  /** The link as submitted (normalised form kept alongside in `canonicalUrl`). */
  readonly submittedUrl: string;
  readonly canonicalUrl: string;
  readonly titleSource: TitleSource;
  readonly author: { readonly name: string; readonly url: string } | null;
  /** Provider thumbnail (https://i.ytimg.com/...), shown only after consent. */
  readonly thumbnail: string;
  /** Seconds, only when read from YouTube's own player; otherwise null. */
  readonly durationSeconds: number | null;
  readonly durationSource: string | null;
  readonly availability: YouTubeAvailability;
  readonly availabilityNote: string | null;
  readonly verifiedAt: string | null;
}

export interface YouTubeFilm extends FilmBase {
  readonly kind: 'youtube';
  readonly youtube: YouTubeSource;
  /** True for a browser-local curator draft, never part of the published programme. */
  readonly draft: boolean;
}

export type Film = LocalFilm | YouTubeFilm;

export interface Programme {
  readonly films: readonly Film[];
  /** Entries in the data file that could not be used, with the reason (shown honestly, never hidden). */
  readonly rejected: readonly { readonly id: string; readonly reason: string }[];
}

export const PROVIDER_LABEL = 'YouTube · external, online only';

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Relative, local paths only: no scheme, no host, no parent traversal. */
export function isLocalMediaPath(path: unknown): path is string {
  return isText(path) && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('/') && !path.startsWith('//')
    && !path.split('/').includes('..');
}

/** Programme IDs: lowercase words and digits joined by hyphens. */
const PROGRAMME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TEXT = 600;

function localReason(entry: Record<string, unknown>): string | null {
  const media = entry.media as Record<string, unknown> | undefined;
  return !isText(entry.title) ? 'missing title'
    : !isText(entry.description) ? 'missing description'
      : !media || !isLocalMediaPath(media.src) ? 'media must be a local relative path'
        : !isText(media.type) || !/^video\//.test(media.type) ? 'media type must be video/*'
          : !(Number(media.width) > 0 && Number(media.height) > 0) ? 'media dimensions missing'
            : !(Number(media.durationSeconds) > 0) ? 'media duration missing'
              : entry.captions != null && !isLocalMediaPath((entry.captions as Record<string, unknown>).src) ? 'captions must be a local relative path'
                : null;
}

function toLocal(id: string, entry: Record<string, unknown>): LocalFilm {
  const media = entry.media as Record<string, unknown>;
  const captions = entry.captions as Record<string, unknown> | null | undefined;
  const poster = entry.poster as Record<string, unknown> | null | undefined;
  return {
    kind: 'local',
    id,
    title: String(entry.title),
    projectId: String(entry.projectId ?? ''),
    exhibitId: isText(entry.exhibitId) ? entry.exhibitId : null,
    description: String(entry.description),
    context: isText(entry.context) ? entry.context : '',
    media: {
      src: String(media.src), type: String(media.type), sha256: String(media.sha256 ?? ''),
      bytes: Number(media.bytes ?? 0), width: Number(media.width), height: Number(media.height),
      durationSeconds: Number(media.durationSeconds), hasAudio: media.hasAudio === true,
    },
    poster: poster && isLocalMediaPath(poster.src)
      ? { src: String(poster.src), sha256: String(poster.sha256 ?? ''), frameAtSeconds: Number(poster.frameAtSeconds ?? 0) }
      : null,
    captions: captions && isLocalMediaPath(captions.src)
      ? { src: String(captions.src), language: isText(captions.language) ? captions.language : 'en', label: isText(captions.label) ? captions.label : 'Captions' }
      : null,
    captionsNote: isText(entry.captionsNote) ? entry.captionsNote : null,
    sourceFile: isText(entry.sourceFile) ? entry.sourceFile : '',
  };
}

/**
 * Validate one YouTube entry. The ID must match its own link; text fields are
 * bounded plain text; the thumbnail is always rebuilt from the ID (never taken
 * from data), so an entry cannot point the museum at any other image host.
 */
export function parseYouTubeEntry(entry: Record<string, unknown>, draft = false): { film: YouTubeFilm } | { reason: string } {
  const id = isText(entry.id) ? entry.id : '';
  if (!PROGRAMME_ID.test(id) || id.length > 80) return { reason: 'programme id must be lowercase words and digits joined by hyphens' };
  const yt = entry.youtube as Record<string, unknown> | undefined;
  if (!yt) return { reason: 'missing youtube source' };
  const link = parseYouTubeLink(yt.submittedUrl);
  if (!link.ok) return { reason: `submitted link refused: ${link.reason}` };
  if (!YOUTUBE_ID.test(String(yt.videoId)) || yt.videoId !== link.videoId) return { reason: 'videoId does not match the submitted link' };
  if (!isText(entry.title) || entry.title.length > 200) return { reason: 'missing title' };
  for (const field of ['description', 'context'] as const) {
    if (entry[field] != null && (typeof entry[field] !== 'string' || (entry[field] as string).length > MAX_TEXT)) return { reason: `${field} must be plain text under ${MAX_TEXT} characters` };
  }
  const titleSource = yt.titleSource;
  if (titleSource !== 'youtube-oembed' && titleSource !== 'curator' && titleSource !== 'provisional') return { reason: 'titleSource must be youtube-oembed, curator or provisional' };
  const availability = yt.availability;
  if (availability !== 'embeddable' && availability !== 'unverified' && availability !== 'unavailable') return { reason: 'availability must be embeddable, unverified or unavailable' };
  const duration = yt.durationSeconds == null ? null : Number(yt.durationSeconds);
  if (duration !== null && !(duration > 0)) return { reason: 'durationSeconds must be positive or null' };
  if (duration !== null && !isText(yt.durationSource)) return { reason: 'a duration must say where it was verified' };
  const author = yt.author as Record<string, unknown> | null | undefined;
  const authorUrl = author && isText(author.url) ? author.url : '';
  if (author && (!isText(author.name) || !/^https:\/\/www\.youtube\.com\/@[A-Za-z0-9._-]{1,100}$/.test(authorUrl))) return { reason: 'author must name a youtube.com channel' };
  return {
    film: {
      kind: 'youtube',
      id,
      title: entry.title,
      projectId: String(entry.projectId ?? ''),
      exhibitId: isText(entry.exhibitId) ? entry.exhibitId : null,
      description: isText(entry.description) ? entry.description : '',
      context: isText(entry.context) ? entry.context : '',
      captionsNote: isText(entry.captionsNote) ? entry.captionsNote : 'Captions are provided by YouTube when the uploader has added them.',
      sourceFile: '',
      draft,
      youtube: {
        videoId: link.videoId,
        submittedUrl: String(yt.submittedUrl),
        canonicalUrl: link.url,
        titleSource,
        author: author ? { name: String(author.name), url: authorUrl } : null,
        thumbnail: thumbnailUrl(link.videoId),
        durationSeconds: duration,
        durationSource: duration === null ? null : String(yt.durationSource),
        availability,
        availabilityNote: isText(yt.availabilityNote) ? yt.availabilityNote : null,
        verifiedAt: isText(yt.verifiedAt) ? yt.verifiedAt : null,
      },
    },
  };
}

/** Validate raw programme data. Anything malformed is rejected with a reason, not repaired. */
export function parseProgramme(raw: unknown, drafts: readonly unknown[] = []): Programme {
  const films: Film[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const entries = (raw as { films?: unknown })?.films;
  if (!Array.isArray(entries)) return { films, rejected: [{ id: '(programme)', reason: 'No films list in the programme data.' }] };
  const seenIds = new Set<string>();
  const seenVideos = new Set<string>();
  const take = (entry: Record<string, unknown>, draft: boolean) => {
    const id = isText(entry?.id) ? entry.id : '(unnamed)';
    if (!isText(entry?.id)) { rejected.push({ id, reason: 'missing id' }); return; }
    if (seenIds.has(id)) { rejected.push({ id, reason: 'duplicate id' }); return; }
    const source = entry.source;
    if (source === 'local' && !draft) {
      const reason = localReason(entry);
      if (reason) { rejected.push({ id, reason }); return; }
      seenIds.add(id);
      films.push(toLocal(id, entry));
    } else if (source === 'youtube') {
      const parsed = parseYouTubeEntry(entry, draft);
      if ('reason' in parsed) { rejected.push({ id, reason: parsed.reason }); return; }
      if (seenVideos.has(parsed.film.youtube.videoId)) { rejected.push({ id, reason: `duplicate YouTube video ${parsed.film.youtube.videoId}` }); return; }
      seenIds.add(id);
      seenVideos.add(parsed.film.youtube.videoId);
      films.push(parsed.film);
    } else {
      rejected.push({ id, reason: draft ? 'drafts may only add YouTube videos' : 'source must be "local" or "youtube"' });
    }
  };
  for (const entry of entries as Record<string, unknown>[]) take(entry ?? {}, false);
  for (const entry of drafts as Record<string, unknown>[]) take(entry ?? {}, true);
  return { films, rejected };
}

export const CINEMA_PROGRAMME_DATA = programmeJson as unknown;
export const CINEMA_PROGRAMME: Programme = parseProgramme(programmeJson);

/** Resolve a programme path against the page, so a sub-path deployment and file:// both work. */
export function resolveMediaUrl(path: string, base: string = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/'): string {
  return new URL(path, base).href;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Duration for display, or null when the source does not know it. */
export function filmDuration(film: Film): number | null {
  return film.kind === 'local' ? film.media.durationSeconds : film.youtube.durationSeconds;
}
