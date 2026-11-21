import programmeJson from '../../data/cinema/programme.json';

/**
 * The cinema's screening content, kept apart from the room (src/world/Cinema.ts)
 * and the player (CinemaPlayback.ts). Entries come only from
 * data/cinema/programme.json, which may list only real media shipped with the
 * museum; tests/cinema.test.ts hashes every listed file against the disk.
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

export interface Film {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly exhibitId: string | null;
  readonly description: string;
  readonly context: string;
  readonly media: FilmMedia;
  readonly poster: { readonly src: string; readonly sha256: string; readonly frameAtSeconds: number } | null;
  /** WebVTT path, when the film has captions. */
  readonly captions: { readonly src: string; readonly language: string; readonly label: string } | null;
  readonly captionsNote: string | null;
  readonly sourceFile: string;
}

export interface Programme {
  readonly films: readonly Film[];
  /** Entries in the data file that could not be used, with the reason (shown honestly, never hidden). */
  readonly rejected: readonly { readonly id: string; readonly reason: string }[];
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Relative, local paths only: no scheme, no host, no parent traversal. */
export function isLocalMediaPath(path: unknown): path is string {
  return isText(path) && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('/') && !path.startsWith('//')
    && !path.split('/').includes('..');
}

/** Validate raw programme data. Anything malformed is rejected with a reason, not repaired. */
export function parseProgramme(raw: unknown): Programme {
  const films: Film[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const entries = (raw as { films?: unknown })?.films;
  if (!Array.isArray(entries)) return { films, rejected: [{ id: '(programme)', reason: 'No films list in the programme data.' }] };
  const seen = new Set<string>();
  for (const entry of entries as Record<string, unknown>[]) {
    const id = isText(entry?.id) ? entry.id : '(unnamed)';
    const media = entry?.media as Record<string, unknown> | undefined;
    const reason = !isText(entry?.id) ? 'missing id'
      : seen.has(id) ? 'duplicate id'
        : !isText(entry.title) ? 'missing title'
          : !isText(entry.description) ? 'missing description'
            : !media || !isLocalMediaPath(media.src) ? 'media must be a local relative path'
              : !isText(media.type) || !/^video\//.test(media.type) ? 'media type must be video/*'
                : !(Number(media.width) > 0 && Number(media.height) > 0) ? 'media dimensions missing'
                  : !(Number(media.durationSeconds) > 0) ? 'media duration missing'
                    : entry.captions != null && !isLocalMediaPath((entry.captions as Record<string, unknown>).src) ? 'captions must be a local relative path'
                      : null;
    if (reason) {
      rejected.push({ id, reason });
      continue;
    }
    seen.add(id);
    const captions = entry.captions as Record<string, unknown> | null | undefined;
    const poster = entry.poster as Record<string, unknown> | null | undefined;
    films.push({
      id,
      title: String(entry.title),
      projectId: String(entry.projectId ?? ''),
      exhibitId: isText(entry.exhibitId) ? entry.exhibitId : null,
      description: String(entry.description),
      context: isText(entry.context) ? entry.context : '',
      media: {
        src: String(media!.src), type: String(media!.type), sha256: String(media!.sha256 ?? ''),
        bytes: Number(media!.bytes ?? 0), width: Number(media!.width), height: Number(media!.height),
        durationSeconds: Number(media!.durationSeconds), hasAudio: media!.hasAudio === true,
      },
      poster: poster && isLocalMediaPath(poster.src)
        ? { src: String(poster.src), sha256: String(poster.sha256 ?? ''), frameAtSeconds: Number(poster.frameAtSeconds ?? 0) }
        : null,
      captions: captions && isLocalMediaPath(captions.src)
        ? { src: String(captions.src), language: isText(captions.language) ? captions.language : 'en', label: isText(captions.label) ? captions.label : 'Captions' }
        : null,
      captionsNote: isText(entry.captionsNote) ? entry.captionsNote : null,
      sourceFile: isText(entry.sourceFile) ? entry.sourceFile : '',
    });
  }
  return { films, rejected };
}

export const CINEMA_PROGRAMME: Programme = parseProgramme(programmeJson);

/** Resolve a programme path against the page, so a sub-path deployment and file:// both work. */
export function resolveMediaUrl(path: string, base: string = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/'): string {
  return new URL(path, base).href;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
