import { useEffect, useState, type CSSProperties } from 'react';
import { resolveLoggedImageUrl } from '../../../api/glanceMediaClient';
import { fetchPlaceDetails, placePhotoUrl } from '../../../api/googlePlacesClient';
import { pickLocalFallbackImage } from '../../../adapters/localImageFallback';

/* ─────────────────────────────────────────────────────────────────────────────
   LEVEL 2 — The shared image resolver.

   Extracted verbatim from Level2CandidateCard so the THINKING tile and the
   FINAL card resolve imagery through exactly the same integration.

   Three tiers, in order:

     1. The trace's own image value. A Google photo resource name is routed
        through the authenticated same-origin Glance proxy; an ordinary URL
        is attempted exactly as logged.
     2. A Google Places photo resource resolved from the entity's real
        place_id, then fetched through the same Glance proxy.
     3. A clearly tracked local placeholder, used only when an image reference
        exists but its bytes are inaccessible in this environment, or when
        the non-prod/UAT image integration has not supplied them yet.

   Tier 3 is the one approved exception to the log-only content rule. Missing
   non-image fields are omitted; they never receive analogous fallback text.
   ───────────────────────────────────────────────────────────────────────────── */

export default function EnrichedImage({
  itemId,
  itemTitle,
  fallbackSrc,
  placeId,
  className,
  style,
  onTierResolved,
}: {
  itemId: string;
  itemTitle: string;
  fallbackSrc?: string;
  /** Real Google place_id, when the entity resolved to one — enables tier 2
   *  (see file header). Omit it to use only the image recorded in the trace. */
  placeId?: string;
  className?: string;
  style?: CSSProperties;
  onTierResolved?: (tier: number) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [livePhotoSrc, setLivePhotoSrc] = useState<string | undefined>(undefined);
  const loggedPhotoSrc = resolveLoggedImageUrl(fallbackSrc, 600);
  const placeholderSrc = pickLocalFallbackImage(itemTitle, itemId);

  // Resolve the place-backed photo in parallel even when a logged URL exists:
  // legacy harness CDN URLs are exact trace data but may now be stale. The
  // live result remains second priority and is only displayed after failure.
  useEffect(() => {
    if (!placeId) {
      setLivePhotoSrc(undefined);
      return;
    }
    let cancelled = false;
    fetchPlaceDetails(placeId).then((details) => {
      if (cancelled) return;
      const photo = details?.photos[0];
      setLivePhotoSrc(photo ? placePhotoUrl(photo.name, 600) || undefined : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  useEffect(() => setAttempt(0), [fallbackSrc, placeId]);

  const candidates = [
    loggedPhotoSrc ? { src: loggedPhotoSrc, sourceTier: 0 } : undefined,
    livePhotoSrc ? { src: livePhotoSrc, sourceTier: 1 } : undefined,
    { src: placeholderSrc, sourceTier: 2 },
  ].filter((candidate): candidate is { src: string; sourceTier: number } => !!candidate);
  const candidate = candidates[attempt];

  useEffect(() => {
    if (candidate) onTierResolved?.(candidate.sourceTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.sourceTier]);

  if (!candidate) return null;

  return (
    <img
      className={className}
      style={style}
      src={candidate.src}
      alt=""
      data-image-item={`${itemId}:${itemTitle}`}
      onError={() => setAttempt((current) => current + 1)}
    />
  );
}
