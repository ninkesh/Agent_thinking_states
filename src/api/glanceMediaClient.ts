const GLANCE_MEDIA_ROOT = '/api/glance-media';
const PHOTO_NAME_RE = /^places\/[^/\s]+\/photos\/[^/?#\s]+$/;

/** Pull a Google Places photo resource name out of either the raw resource
 * string or a media URL that carries it in its path/query. Legacy CDN URLs
 * do not contain a Google photo reference and therefore remain unchanged. */
export function extractPlacePhotoName(value: string | undefined): string | undefined {
  const input = value?.trim();
  if (!input) return undefined;
  if (PHOTO_NAME_RE.test(input)) return input;

  try {
    const url = new URL(input, 'http://local.invalid');
    const queryName = url.searchParams.get('name');
    if (queryName && PHOTO_NAME_RE.test(queryName)) return queryName;

    const pathMatch = url.pathname.match(/\/?(?:v1\/)?(places\/[^/\s]+\/photos\/[^/?#\s]+)(?:\/media)?$/);
    return pathMatch?.[1] && PHOTO_NAME_RE.test(pathMatch[1]) ? pathMatch[1] : undefined;
  } catch {
    return undefined;
  }
}

export function glanceMediaUrl(photoName: string, maxWidth = 800): string | undefined {
  const name = extractPlacePhotoName(photoName);
  if (!name) return undefined;
  const width = Math.min(1600, Math.max(1, Math.round(maxWidth)));
  return `${GLANCE_MEDIA_ROOT}?name=${encodeURIComponent(name)}&maxWidth=${width}`;
}

/** Resource names require authenticated byte fetching; ordinary logged URLs
 * remain exact and are attempted as-is. */
export function resolveLoggedImageUrl(value: string | undefined, maxWidth = 800): string | undefined {
  if (!value?.trim()) return undefined;
  return glanceMediaUrl(value, maxWidth) ?? value;
}
