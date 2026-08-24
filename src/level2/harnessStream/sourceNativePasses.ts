import type { SemanticAgentEvent } from '../../types/semanticEvent';
import { toNormalizedEntity } from '../normalization/entityBridge';
import type {
  EntityFieldArrival,
  EntityPreviewPayload,
  RoutePayload,
  SourcesPayload,
  ThinkingPass,
  ThinkingPayload,
  ThinkingValueType,
} from '../types/pass';
import type { NormalizedEntity } from '../types/entity';
import { isSameCandidate, mergeCandidate } from '../userValue/candidateResolution';
import {
  consumerStartCopy,
  developerResultCopy,
  developerStartCopy,
  entityResultNoun,
  fetchedSourceResultCopy,
  harnessToolKind,
  inputEntityExternalIds,
  plural,
  routeResultCopy,
  type LoggedSourceIdentity,
  zeroResultCopy,
} from './thinkingCopy';

/* Harness-stream thinking is a replay of frontend arrivals, not a narrative
 * plan. Consumer narration is a deterministic formatter over logged fields;
 * untouched harness labels remain available separately in developerNarration.
 * Missing formatter inputs omit the state instead of creating fallback copy. */

interface VisibleValue {
  valueType: ThinkingValueType;
  payload: ThinkingPayload;
}

interface EntityMergeResult {
  entities: NormalizedEntity[];
  added: number;
  updated: number;
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function sameLoggedValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function arrivalChange(previous: unknown, arriving: unknown): EntityFieldArrival['change'] | undefined {
  if (!isPresent(arriving) || sameLoggedValue(previous, arriving)) return undefined;
  return isPresent(previous) ? 'changed' : 'added';
}

function attributesOf(entity: NormalizedEntity | undefined): Record<string, unknown> {
  return entity?.attributes ?? {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim());
}

function pushArrival(
  arrivals: EntityFieldArrival[],
  field: EntityFieldArrival['field'],
  previous: unknown,
  arriving: unknown,
  value: string | undefined,
  multiline = false
): void {
  const change = arrivalChange(previous, arriving);
  if (!change || !value) return;
  arrivals.push({ field, value, change, ...(multiline ? { multiline: true } : {}) });
}

interface LoggedReview {
  rating?: number;
  text?: string;
}

function reviews(value: unknown): LoggedReview[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((review) => {
    if (!review || typeof review !== 'object') return [];
    const item = review as { rating?: unknown; text?: unknown };
    const rating = typeof item.rating === 'number' && Number.isFinite(item.rating) ? item.rating : undefined;
    const reviewText = text(item.text);
    return rating == null && !reviewText ? [] : [{ ...(rating != null ? { rating } : {}), ...(reviewText ? { text: reviewText } : {}) }];
  });
}

function reviewKey(review: LoggedReview): string {
  return JSON.stringify([review.rating, review.text]);
}

function reviewValue(review: LoggedReview): string | undefined {
  if (review.rating != null && review.text) return `${review.rating}★ · ${review.text}`;
  if (review.text) return review.text;
  if (review.rating != null) return `${review.rating}★ review`;
  return undefined;
}

/** Compare one enrichment result only with the previously arrived version of
 * the same entity. This deliberately exposes an allow-list of consumer-safe
 * fields: raw ids, coordinates, internal similarity scores and tool metadata
 * can never leak merely because a future API adds them. */
export function consumerEntityFieldArrivals(
  previous: NormalizedEntity | undefined,
  arriving: NormalizedEntity
): EntityFieldArrival[] {
  const out: EntityFieldArrival[] = [];
  const previousAttributes = attributesOf(previous);
  const arrivingAttributes = attributesOf(arriving);

  const arrivingHours = text(arriving.availability);
  pushArrival(out, 'hours', previous?.availability, arriving.availability, arrivingHours, true);

  const previousReviews = reviews(previousAttributes.reviews);
  const previousReviewKeys = new Set(previousReviews.map(reviewKey));
  for (const review of reviews(arrivingAttributes.reviews)) {
    if (previousReviewKeys.has(reviewKey(review))) continue;
    const value = reviewValue(review);
    if (value) out.push({ field: 'review', value, change: 'added', multiline: true });
  }

  const editorialSummary = text(arrivingAttributes.editorialSummary);
  pushArrival(
    out,
    'description',
    previousAttributes.editorialSummary,
    arrivingAttributes.editorialSummary,
    editorialSummary,
    true
  );

  pushArrival(out, 'rating', previous?.rating, arriving.rating, arriving.rating != null ? `${arriving.rating}★` : undefined);
  pushArrival(
    out,
    'review_count',
    previous?.reviewCount,
    arriving.reviewCount,
    arriving.reviewCount != null ? `${arriving.reviewCount.toLocaleString('en-IN')} reviews` : undefined
  );
  pushArrival(out, 'price', previous?.price, arriving.price, text(arriving.price));

  const location = text(arriving.location);
  pushArrival(out, 'location', previous?.location, arriving.location, location, true);
  pushArrival(out, 'distance', previous?.distance, arriving.distance, text(arriving.distance));
  pushArrival(out, 'travel_time', previous?.travelTime, arriving.travelTime, text(arriving.travelTime));

  const openNow = arrivingAttributes.openNow;
  pushArrival(
    out,
    'open_status',
    previousAttributes.openNow,
    openNow,
    typeof openNow === 'boolean' ? (openNow ? 'Open now' : 'Currently closed') : undefined
  );
  pushArrival(out, 'phone', previousAttributes.phone, arrivingAttributes.phone, text(arrivingAttributes.phone));

  const website = text(arrivingAttributes.website) ?? text(arrivingAttributes.ctaUrl);
  const previousWebsite = previousAttributes.website ?? previousAttributes.ctaUrl;
  pushArrival(out, 'website', previousWebsite, arrivingAttributes.website ?? arrivingAttributes.ctaUrl, website, true);

  pushArrival(out, 'brand', previousAttributes.brand, arrivingAttributes.brand, text(arrivingAttributes.brand));
  const inStock = arrivingAttributes.inStock;
  pushArrival(
    out,
    'stock_status',
    previousAttributes.inStock,
    inStock,
    typeof inStock === 'boolean' ? (inStock ? 'In stock' : 'Out of stock') : undefined
  );

  const originalPrice = arrivingAttributes.originalPrice;
  const currency = text(arrivingAttributes.currency);
  const currencyPrefix = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  pushArrival(
    out,
    'original_price',
    previousAttributes.originalPrice,
    originalPrice,
    typeof originalPrice === 'number' && Number.isFinite(originalPrice)
      ? `Original price: ${currencyPrefix}${originalPrice}`
      : undefined
  );

  const categories = stringList(arrivingAttributes.categories);
  pushArrival(
    out,
    'categories',
    previousAttributes.categories,
    arrivingAttributes.categories,
    categories.length ? categories.join(' · ') : undefined,
    true
  );
  pushArrival(out, 'gender', previousAttributes.gender, arrivingAttributes.gender, text(arrivingAttributes.gender));

  const vtonEnabled = arrivingAttributes.vtonEnabled;
  pushArrival(
    out,
    'virtual_try_on',
    previousAttributes.vtonEnabled,
    vtonEnabled,
    typeof vtonEnabled === 'boolean' ? (vtonEnabled ? 'Virtual try-on available' : 'Virtual try-on unavailable') : undefined
  );

  return out;
}

function fieldSummary(arrivals: EntityFieldArrival[]): string | undefined {
  if (!arrivals.length) return undefined;
  const labels: string[] = [];
  const reviewCount = arrivals.filter((arrival) => arrival.field === 'review').length;
  const labelByField: Partial<Record<EntityFieldArrival['field'], string>> = {
    hours: 'Hours',
    description: 'description',
    rating: 'rating',
    review_count: 'review count',
    price: 'price',
    location: 'location',
    distance: 'distance',
    travel_time: 'travel time',
    open_status: 'open status',
    phone: 'phone number',
    website: 'website',
    brand: 'brand',
    stock_status: 'stock status',
    original_price: 'original price',
    categories: 'categories',
    gender: 'gender',
    virtual_try_on: 'virtual try-on status',
  };

  for (const arrival of arrivals) {
    if (arrival.field === 'review') {
      if (!labels.some((label) => label.endsWith('review') || label.endsWith('reviews'))) {
        labels.push(`${reviewCount} ${plural(reviewCount, 'review')}`);
      }
      continue;
    }
    const label = labelByField[arrival.field];
    if (label && !labels.includes(label)) labels.push(label);
  }

  if (!labels.length) return undefined;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function enrichmentResultCopy(title: string, arrivals: EntityFieldArrival[]): string | undefined {
  const summary = fieldSummary(arrivals);
  if (!summary) return undefined;
  const verb = arrivals.every((arrival) => arrival.change === 'added') ? 'received' : 'updated';
  return `${summary} ${verb} for ${title}`;
}

function enrichmentBatchResultCopy(
  events: SemanticAgentEvent[],
  entityCount: number,
  arrivals: EntityFieldArrival[]
): string | undefined {
  const summary = fieldSummary(arrivals);
  if (!summary || entityCount < 1) return undefined;
  const verb = arrivals.every((arrival) => arrival.change === 'added') ? 'received' : 'updated';
  const noun = entityResultNoun(events[0]);
  return `${summary} ${verb} across ${entityCount} ${plural(entityCount, noun)}`;
}

function epoch(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mergeEntityArrivals(current: NormalizedEntity[], arriving: NormalizedEntity[]): EntityMergeResult {
  const out = [...current];
  let added = 0;
  let updated = 0;
  for (const entity of arriving) {
    const index = out.findIndex((known) => isSameCandidate(known, entity));
    if (index >= 0) {
      const merged = mergeCandidate(out[index], entity);
      if (JSON.stringify(merged) !== JSON.stringify(out[index])) updated += 1;
      out[index] = merged;
    } else {
      out.push(entity);
      added += 1;
    }
  }
  return { entities: out, added, updated };
}

function eventSources(event: SemanticAgentEvent): LoggedSourceIdentity[] {
  const raw = event.metadata?.sources;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((source) => {
    if (!source || typeof source !== 'object') return [];
    const item = source as { label?: unknown; url?: unknown };
    if (typeof item.label !== 'string' || !item.label.trim()) return [];
    let domain: string | undefined;
    if (typeof item.url === 'string') {
      try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch { /* label remains usable */ }
    }
    return [{ label: item.label.trim(), ...(domain ? { domain } : {}) }];
  });
}

function sourceKey(source: LoggedSourceIdentity): string {
  return (source.domain ?? source.label).toLowerCase().replace(/^www\./, '');
}

function mergeSourceArrivals(
  current: LoggedSourceIdentity[],
  arriving: LoggedSourceIdentity[]
): { sources: LoggedSourceIdentity[]; added: number } {
  const out = [...current];
  let added = 0;
  for (const source of arriving) {
    const key = sourceKey(source);
    const index = out.findIndex((known) => sourceKey(known) === key);
    if (index >= 0) out[index] = { ...out[index], ...source };
    else {
      out.push(source);
      added += 1;
    }
  }
  return { sources: out, added };
}

function sourcesPayload(sources: LoggedSourceIdentity[], searchCount: number): SourcesPayload {
  return {
    sources: sources.map((source) => ({ ...source, kind: 'web' as const })),
    sourceCount: sources.length,
    searchCount,
  };
}

function routeValue(event: SemanticAgentEvent): RoutePayload | undefined {
  const metadata = event.metadata ?? {};
  const origin = typeof metadata.originText === 'string' ? metadata.originText : undefined;
  const destination = typeof metadata.destinationText === 'string' ? metadata.destinationText : undefined;
  const eta = typeof metadata.travelTime === 'string' ? metadata.travelTime : undefined;
  const distance = typeof metadata.distance === 'string' ? metadata.distance : undefined;
  if (!origin && !destination && !eta && !distance) return undefined;

  const from = metadata.from as { lat?: unknown; lng?: unknown } | undefined;
  const to = metadata.to as { lat?: unknown; lng?: unknown } | undefined;
  const hasGeo = origin && destination && typeof from?.lat === 'number' && typeof from.lng === 'number'
    && typeof to?.lat === 'number' && typeof to.lng === 'number';

  return {
    origin,
    destination,
    stops: [],
    eta,
    distance,
    ...(hasGeo ? {
      geo: {
        origin: { lat: from.lat as number, lng: from.lng as number, label: origin },
        destination: { lat: to.lat as number, lng: to.lng as number, label: destination },
        geometry: 'endpoints' as const,
      },
      stage: 'summary' as const,
    } : {}),
  };
}

function routeKey(route: RoutePayload): string {
  return [route.origin ?? '', route.destination ?? ''].join('\u0000');
}

/** Route calls may finish only a few hundred milliseconds apart. Preserve
 * every logged route summary in the newest payload so a later arrival updates
 * one stable canvas instead of erasing the earlier result. */
function mergeRouteArrivals(current: RoutePayload[], arriving: RoutePayload): RoutePayload[] {
  const key = routeKey(arriving);
  const index = current.findIndex((route) => routeKey(route) === key);
  if (index < 0) return [...current, arriving];
  return current.map((route, i) => (i === index ? { ...route, ...arriving } : route));
}

function cumulativeRouteValue(routes: RoutePayload[], current: RoutePayload): RoutePayload {
  if (routes.length < 2) return current;
  return {
    ...current,
    alternates: routes.map((route) => ({
      label: [route.origin, route.destination].filter(Boolean).join(' → ') || 'Route',
      ...(route.eta ? { eta: route.eta } : {}),
      ...(route.distance ? { distance: route.distance } : {}),
    })),
  };
}

function countLabel(event: SemanticAgentEvent): string {
  const kind = harnessToolKind(event);
  if (kind === 'cricket_events') return 'upcoming matches';
  if (kind === 'product_search') return 'products';
  if (kind === 'place_search') return 'places';
  return 'results';
}

function eventInputString(event: SemanticAgentEvent, ...keys: string[]): string | undefined {
  if (!event.input || typeof event.input !== 'object' || Array.isArray(event.input)) return undefined;
  const input = event.input as Record<string, unknown>;
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function eventMetadataString(event: SemanticAgentEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function searchCount(events: SemanticAgentEvent[]): number {
  const queries = new Set(
    events.map((event) => eventInputString(event, 'query_text', 'query')).filter((query): query is string => !!query)
  );
  return queries.size || (events.every((event) => event.type === 'search') ? events.length : 0);
}

/** Refinement is not guessed from disappointing results. It is a mode only
 * when the agent's own action-aligned interim explicitly says it is refining
 * the search. This lets the next batch replace the failed attempt without
 * treating every later search as a reset. */
function isExplicitRefinement(events: SemanticAgentEvent[]): boolean {
  return events.some((event) => /\brefin(?:e|es|ed|ing)\b/i.test(eventMetadataString(event, 'interimText') ?? ''));
}

function entityBatchResultCopy({
  events,
  count,
  beforeCount,
}: {
  events: SemanticAgentEvent[];
  count: number;
  beforeCount: number;
}): string {
  const noun = entityResultNoun(events[0]);
  const searches = searchCount(events);
  if (isExplicitRefinement(events)) {
    const subject = searches === 1 ? 'search' : 'searches';
    return `The refined ${subject} found ${count} ${plural(count, noun)}`;
  }
  if (beforeCount === 0) {
    return searches > 1
      ? `Found ${count} ${plural(count, noun)} across ${searches} searches`
      : `Found ${count} ${plural(count, noun)}`;
  }
  return `Added ${count} more ${plural(count, noun)}`;
}

interface StatusArrival {
  kind: 'status';
  at: number;
  events: SemanticAgentEvent[];
}

interface ResultArrival {
  kind: 'result';
  at: number;
  events: SemanticAgentEvent[];
}

type Arrival = StatusArrival | ResultArrival;

/** An enrichment call with a provider id is an exact identity signal. Resolve
 * it against entities already received by the frontend so Search -> Details,
 * ProductSearch -> ProductFetch, and equivalent flows reuse the same card. */
export function selectedEntitiesForIdentityCalls(
  events: SemanticAgentEvent[],
  knownEntities: NormalizedEntity[]
): { externalIds: string[]; entities: NormalizedEntity[] } | undefined {
  if (!events.length || events.some((event) => event.type !== 'enrichment')) return undefined;

  const externalIds = [...new Set(events.flatMap((event) => inputEntityExternalIds(event, knownEntities)))];
  if (!externalIds.length) return undefined;
  const selected = new Set(externalIds);
  return {
    externalIds,
    entities: knownEntities.filter((entity) => entity.externalId && selected.has(entity.externalId)),
  };
}

/** Backwards-compatible named helper for the explicit PlaceDetails contract. */
export function selectedPlacesForDetailCalls(
  events: SemanticAgentEvent[],
  knownEntities: NormalizedEntity[]
): { externalIds: string[]; entities: NormalizedEntity[] } | undefined {
  if (events.some((event) => harnessToolKind(event) !== 'place_details')) return undefined;
  return selectedEntitiesForIdentityCalls(events, knownEntities);
}

function arrivalTimeline(events: SemanticAgentEvent[]): Arrival[] {
  const visible = events.filter((event) => {
    if (event.type === 'internal' || event.type === 'unknown') return false;
    return epoch(event.metadata, 'loggedStartTimestamp') != null
      && epoch(event.metadata, 'loggedResultTimestamp') != null;
  });

  const statusGroups = new Map<string, SemanticAgentEvent[]>();
  for (const event of visible) {
    const parallel = event.metadata?.parallelGroup;
    // One explicit parallel group is one frontend state, including enrichment
    // calls. Serializing simultaneous identity calls created 0-4ms states that
    // disappeared before their entrance animation completed and falsely
    // implied an order the agent never followed.
    const key = typeof parallel === 'number' ? `parallel-${parallel}` : event.id;
    statusGroups.set(key, [...(statusGroups.get(key) ?? []), event]);
  }

  const arrivals: Arrival[] = [];
  for (const group of statusGroups.values()) {
    const ordered = [...group].sort(
      (a, b) => epoch(a.metadata, 'loggedStartTimestamp')! - epoch(b.metadata, 'loggedStartTimestamp')!
    );
    arrivals.push({
      kind: 'status',
      at: epoch(ordered[0].metadata, 'loggedStartTimestamp')!,
      events: ordered,
    });
  }
  const resultGroups = new Map<string, SemanticAgentEvent[]>();
  for (const event of visible) {
    const parallel = event.metadata?.parallelGroup;
    // A parallel search/retrieval batch is one agent action and, in practice,
    // its results often land only 3–15ms apart. A browser cannot communicate
    // those as separate states. Fold the explicit batch into one atomic
    // result at the final member's arrival. The group payload still retains
    // every exact subject and every per-subject field arrival.
    const key = typeof parallel === 'number' ? `parallel-${parallel}` : event.id;
    resultGroups.set(key, [...(resultGroups.get(key) ?? []), event]);
  }
  for (const group of resultGroups.values()) {
    const ordered = [...group].sort(
      (a, b) => epoch(a.metadata, 'loggedResultTimestamp')! - epoch(b.metadata, 'loggedResultTimestamp')!
    );
    arrivals.push({
      kind: 'result',
      at: Math.max(...ordered.map((event) => epoch(event.metadata, 'loggedResultTimestamp')!)),
      events: ordered,
    });
  }

  return arrivals.sort((a, b) => a.at - b.at || (a.kind === 'status' ? -1 : 1));
}

export function buildSourceNativePasses(events: SemanticAgentEvent[], prompt = ''): ThinkingPass[] {
  const passes: ThinkingPass[] = [];
  let accumulatedEntities: NormalizedEntity[] = [];
  let displayedEntities: NormalizedEntity[] = [];
  let accumulatedSources: LoggedSourceIdentity[] = [];
  let accumulatedRoutes: RoutePayload[] = [];
  let completedWebSearches = 0;
  let lastValue: VisibleValue | undefined;

  for (const arrival of arrivalTimeline(events)) {
    if (arrival.kind === 'status') {
      const detailSelection = selectedEntitiesForIdentityCalls(arrival.events, accumulatedEntities);

      const narration = consumerStartCopy({
        events: arrival.events,
        prompt,
        knownEntities: accumulatedEntities,
        knownSources: accumulatedSources,
      });
      if (!narration) continue;

      const first = arrival.events[0];
      const developerNarration = developerStartCopy(arrival.events);
      // During PlaceDetails, show only the places named by the calls. When an
      // id has not resolved yet, omit it; never leave unrelated search results
      // on screen as though they too were being checked.
      const statusValue: VisibleValue | undefined = detailSelection
        ? detailSelection.entities.length
          ? {
              valueType: 'trace_entities',
              payload: {
                entities: detailSelection.entities,
                inspectionIds: detailSelection.entities.map((entity) => entity.id),
              } as EntityPreviewPayload,
            }
          : undefined
        : lastValue;
      passes.push({
        id: `${first.id}-status`,
        visibility: statusValue ? 'canvas_value' : 'status',
        narration,
        ...(developerNarration ? { developerNarration } : {}),
        ...(statusValue ? { valueType: statusValue.valueType, payload: statusValue.payload } : {}),
        sourceEventIds: arrival.events.map((event) => event.id),
        sourceSpanIds: arrival.events.flatMap((event) => event.sourceSpanIds),
        confidence: 'high',
        enterDuration: 160,
        holdDuration: 0,
        exitDuration: 0,
        traceTiming: {
          start: Math.min(...arrival.events.map((event) => event.startTime)),
          end: Math.max(...arrival.events.map((event) => event.endTime)),
        },
        loggedAt: arrival.at,
      });
      continue;
    }

    const resultEvents = arrival.events;
    const event = resultEvents[0];
    const kind = harnessToolKind(event);
    let narration: string | undefined;
    let value: VisibleValue | undefined;

    if (resultEvents.some((resultEvent) => resultEvent.entities?.length)) {
      const previousEntities = accumulatedEntities;
      const arrivingEntities = resultEvents.flatMap((resultEvent) => (resultEvent.entities ?? []).map(toNormalizedEntity));
      const canonicalMerge = mergeEntityArrivals(accumulatedEntities, arrivingEntities);
      accumulatedEntities = canonicalMerge.entities;
      const identitySelection = selectedEntitiesForIdentityCalls(resultEvents, accumulatedEntities);
      const refinement = resultEvents.every((resultEvent) => resultEvent.type === 'search')
        && isExplicitRefinement(resultEvents);
      const previousDisplayCount = refinement ? 0 : displayedEntities.length;
      const displayMerge = identitySelection
        ? undefined
        : mergeEntityArrivals(refinement ? [] : displayedEntities, arrivingEntities);
      if (displayMerge) displayedEntities = displayMerge.entities;
      const visibleEntities = identitySelection
        ? identitySelection.entities
        : displayedEntities;
      const fieldArrivals = identitySelection
        ? Object.fromEntries(visibleEntities.flatMap((entity) => {
            const arriving = arrivingEntities.find((candidate) => isSameCandidate(candidate, entity));
            if (!arriving) return [];
            const previous = previousEntities.find((candidate) => isSameCandidate(candidate, entity));
            const arrivals = consumerEntityFieldArrivals(previous, arriving);
            return arrivals.length ? [[entity.id, arrivals]] : [];
          }))
        : undefined;
      value = {
        valueType: 'trace_entities',
        payload: {
          entities: visibleEntities,
          ...(fieldArrivals && Object.keys(fieldArrivals).length ? { fieldArrivals } : {}),
        } as EntityPreviewPayload,
      };

      if (identitySelection) {
        if (visibleEntities.length === 1) {
          const selectedEntity = visibleEntities[0];
          const arrivals = fieldArrivals?.[selectedEntity.id] ?? [];
          if (selectedEntity.title) narration = enrichmentResultCopy(selectedEntity.title, arrivals);
        } else {
          const arrivals = visibleEntities.flatMap((entity) => fieldArrivals?.[entity.id] ?? []);
          narration = enrichmentBatchResultCopy(resultEvents, visibleEntities.length, arrivals);
        }
      } else if (displayMerge && displayMerge.added > 0) {
        narration = entityBatchResultCopy({
          events: resultEvents,
          count: displayMerge.added,
          beforeCount: previousDisplayCount,
        });
      } else if (displayMerge && displayMerge.updated > 0) {
        const noun = entityResultNoun(event);
        narration = `Updated ${displayMerge.updated} ${plural(displayMerge.updated, noun)}`;
      }
    } else if (kind === 'web_search') {
      const arrivingSources = resultEvents.flatMap(eventSources);
      const uniqueArrivingSources = mergeSourceArrivals([], arrivingSources).sources;
      const beforeCount = accumulatedSources.length;
      const merged = mergeSourceArrivals(accumulatedSources, arrivingSources);
      accumulatedSources = merged.sources;
      completedWebSearches += resultEvents.length;
      if (uniqueArrivingSources.length) {
        const searches = searchCount(resultEvents);
        narration = beforeCount === 0
          ? searches > 1
            ? `Checked ${uniqueArrivingSources.length} ${plural(uniqueArrivingSources.length, 'source')} across ${searches} searches`
            : `Checked ${uniqueArrivingSources.length} ${plural(uniqueArrivingSources.length, 'source')}`
          : merged.added > 0
            ? `Found ${merged.added} additional ${plural(merged.added, 'source')}`
            : `Rechecked ${uniqueArrivingSources.length} ${plural(uniqueArrivingSources.length, 'source')}`;
        value = { valueType: 'sources', payload: sourcesPayload(accumulatedSources, completedWebSearches) };
      }
    } else if (kind === 'web_fetch') {
      narration = fetchedSourceResultCopy(event, accumulatedSources);
      value = lastValue?.valueType === 'sources' ? lastValue : undefined;
    } else if (kind === 'route') {
      const payload = routeValue(event);
      if (payload) {
        narration = routeResultCopy(payload);
        accumulatedRoutes = mergeRouteArrivals(accumulatedRoutes, payload);
        value = { valueType: 'route', payload: cumulativeRouteValue(accumulatedRoutes, payload) };
      }
    } else {
      const reportedTotal = event.metadata?.reportedTotal;
      if (typeof reportedTotal === 'number' && Number.isFinite(reportedTotal)) {
        narration = reportedTotal === 0
          ? zeroResultCopy(event)
          : `Found ${reportedTotal} ${countLabel(event)}`;
        value = { valueType: 'count', payload: { value: reportedTotal, label: countLabel(event) } };
      }
    }

    // A duplicate result that introduces neither visible information nor a
    // meaningful completion line produces no state. The previous state stays
    // on screen until the next real arrival.
    if (!narration) continue;
    if (value) lastValue = value;

    const developerNarration = resultEvents
      .map(developerResultCopy)
      .filter((copy): copy is string => !!copy)
      .join(' | ') || undefined;
    const resultAt = Math.max(...resultEvents.map((resultEvent) => resultEvent.endTime));
    passes.push({
      id: `${event.id}-result`,
      visibility: value || lastValue ? 'canvas_value' : 'status',
      narration,
      ...(developerNarration ? { developerNarration } : {}),
      ...(value
        ? { valueType: value.valueType, payload: value.payload }
        : lastValue
          ? { valueType: lastValue.valueType, payload: lastValue.payload }
          : {}),
      sourceEventIds: resultEvents.map((resultEvent) => resultEvent.id),
      sourceSpanIds: resultEvents.flatMap((resultEvent) => resultEvent.sourceSpanIds),
      confidence: 'high',
      enterDuration: 160,
      holdDuration: 0,
      exitDuration: 0,
      traceTiming: { start: resultAt, end: resultAt },
      loggedAt: arrival.at,
    });
  }

  return passes;
}
