/**
 * YouTube as an explicit, visitor-chosen online exception to the local-first
 * museum (docs/MUSEUM_CINEMA_YOUTUBE_2026-11-21.md). This module is the one
 * place that knows YouTube's addresses. Nothing here runs a request: it parses
 * links and builds URLs. Loading happens only in YouTubePlayback, and only after
 * the visitor chooses a YouTube screening and accepts the external-content notice.
 *
 * Unlisted videos are ordinary videos to the embed player: anyone with the link
 * can play them when the uploader allows embedding. Listing an unlisted link in
 * the public programme makes it discoverable; it is never treated as secret.
 */

/** YouTube video IDs are 11 characters of URL-safe base64. */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Hosts a pasted link may use. Anything else (including look-alikes) is refused. */
const WATCH_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com']);
const SHORT_HOST = 'youtu.be';

export type YouTubeLinkResult =
  | { readonly ok: true; readonly videoId: string; readonly url: string }
  | { readonly ok: false; readonly reason: string };

const MAX_LINK_LENGTH = 300;

/**
 * Normalise a pasted YouTube link to its video ID. Accepts
 * youtu.be/ID, youtube.com/watch?v=ID (with or without www, or m.), and
 * youtube.com/embed/ID, over https (http is upgraded). Refuses other hosts,
 * credentials, ports, other paths, malformed IDs and anything over 300 chars.
 */
export function parseYouTubeLink(input: unknown): YouTubeLinkResult {
  if (typeof input !== 'string') return { ok: false, reason: 'Paste a YouTube link.' };
  const text = input.trim();
  if (!text) return { ok: false, reason: 'Paste a YouTube link.' };
  if (text.length > MAX_LINK_LENGTH) return { ok: false, reason: 'That link is too long to be a YouTube video link.' };
  if (/[\s<>"'`\\]/.test(text)) return { ok: false, reason: 'That link contains characters a YouTube link never has.' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, reason: 'That is not a web link. Paste the full address, starting with https://.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'Only https:// YouTube links are accepted.' };
  if (url.username || url.password || url.port) return { ok: false, reason: 'That link has a login or port in it; YouTube links never do.' };
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === SHORT_HOST) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1) id = parts[0];
  } else if (WATCH_HOSTS.has(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1 && parts[0] === 'watch') {
      const values = url.searchParams.getAll('v');
      if (values.length === 1) id = values[0];
    } else if (parts.length === 2 && parts[0] === 'embed') {
      id = parts[1];
    }
  } else {
    return { ok: false, reason: `Only YouTube links are accepted (youtu.be or youtube.com), not ${host || 'that address'}.` };
  }
  if (id === null) return { ok: false, reason: 'That YouTube address does not point to a single video.' };
  if (!YOUTUBE_ID.test(id)) return { ok: false, reason: 'That link does not contain a valid YouTube video ID.' };
  return { ok: true, videoId: id, url: `https://youtu.be/${id}` };
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/** A provider thumbnail: loaded only after the visitor accepts the external-content notice. */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/** YouTube's official IFrame Player API script. */
export const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
/** Privacy-enhanced embed host for the player itself. */
export const PLAYER_HOST = 'https://www.youtube-nocookie.com';

/** Plain-language meaning of the IFrame API's onError codes, plus whether "Watch on YouTube" may still work. */
export function describeYouTubeError(code: number): { readonly message: string; readonly watchOnYouTube: boolean } {
  switch (code) {
    case 2:
      return { message: 'YouTube rejected this video ID.', watchOnYouTube: false };
    case 5:
      return { message: 'YouTube\'s player could not play this video in this browser.', watchOnYouTube: true };
    case 100:
      return { message: 'YouTube says this video is unavailable: it may have been removed or made private.', watchOnYouTube: false };
    case 101:
    case 150:
      // YouTube uses these codes when the uploader has turned off embedding, and
      // also when it declines to serve a particular browser or network (it gave
      // 150 for its own documentation sample video from an automated,
      // data-centre browser while this feature was built). So say both.
      return { message: 'YouTube would not play this video inside the museum: the uploader may have turned off embedding, or YouTube declined to serve this browser or network.', watchOnYouTube: true };
    case 152:
    case 153:
      return { message: 'YouTube refused to play here because it could not identify this site (missing referrer or client identity).', watchOnYouTube: true };
    default:
      return { message: `YouTube's player reported error ${code}.`, watchOnYouTube: true };
  }
}
