import type { SemanticAgentEvent } from '../../types/semanticEvent';
import type { NormalizedEntity } from '../types/entity';

/** Consumer copy for harness thinking states is a formatter over logged
 * structure, never a second generative step. Raw tool diagnostics remain on
 * the pass as developerNarration; this module only returns text that is safe
 * for the consumer surface. */

export type HarnessToolKind =
  | 'product_search'
  | 'place_search'
  | 'place_details'
  | 'product_details'
  | 'entity_details'
  | 'web_search'
  | 'web_fetch'
  | 'route'
  | 'cricket_events'
  | 'unknown';

export interface LoggedSourceIdentity {
  label: string;
  domain?: string;
}

const ACTION_VERB = /\b(search|searching|check|checking|fetch|fetching|find|finding|pull|pulling|look|looking|read|reading|verify|verifying|refine|refining|build|building)\b/i;

/** Generic work words cannot prove that an interim belongs to this task.
 * Q06's copied "spice levels and family ambiance" line, for example, shares
 * "details" and "candidates" with almost any PlaceDetails operation. */
const NON_SIGNAL_WORDS = new Set([
  'about', 'across', 'actual', 'agent', 'also', 'and', 'around', 'best', 'build', 'building',
  'candidate', 'candidates', 'check', 'checking', 'current', 'detail', 'detailed', 'details',
  'fetch', 'fetching', 'find', 'finding', 'for', 'from', 'get', 'getting', 'information', 'initial',
  'into', 'look', 'looking', 'more', 'near', 'need', 'now', 'place', 'places', 'product', 'products',
  'pull', 'pulling', 'refine', 'refining', 'result', 'results', 'search', 'searching', 'specific',
  'the', 'their', 'this', 'those', 'tool', 'top', 'verify', 'verifying', 'with', 'your',
]);

function metadataString(event: SemanticAgentEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function inputRecord(event: SemanticAgentEvent): Record<string, unknown> {
  return event.input && typeof event.input === 'object' && !Array.isArray(event.input)
    ? event.input as Record<string, unknown>
    : {};
}

function inputString(event: SemanticAgentEvent, ...keys: string[]): string | undefined {
  const input = inputRecord(event);
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function harnessToolName(event: SemanticAgentEvent): string {
  return metadataString(event, 'tool') ?? '';
}

export function harnessToolKind(event: SemanticAgentEvent): HarnessToolKind {
  const name = harnessToolName(event).toLowerCase();
  if (name.includes('productsearch')) return 'product_search';
  if (name.includes('placesearch') || name.includes('nearbyplaces')) return 'place_search';
  if (name.includes('placedetails') || name.includes('placereviews')) return 'place_details';
  if (name.includes('productdetails') || name.includes('productfetch')) return 'product_details';
  if (name.includes('websearch')) return 'web_search';
  if (name.includes('webfetch')) return 'web_fetch';
  if (name.includes('getroute') || name.includes('direction') || name.includes('distance')) return 'route';
  if (name.includes('cricket') && name.endsWith('events')) return 'cricket_events';
  if (name.includes('details')) return 'entity_details';
  return 'unknown';
}

function queryFor(event: SemanticAgentEvent): string | undefined {
  return inputString(event, 'query_text', 'query');
}

function normalizeDomain(value: string): string {
  return value.toLowerCase().replace(/^www\./, '');
}

function domainForUrl(value: string): string | undefined {
  try {
    return normalizeDomain(new URL(value).hostname);
  } catch {
    return undefined;
  }
}

export function sourceNameForFetch(
  event: SemanticAgentEvent,
  knownSources: LoggedSourceIdentity[]
): string | undefined {
  const url = inputString(event, 'url');
  if (!url) return undefined;
  const domain = domainForUrl(url);
  if (!domain) return undefined;
  return knownSources.find((source) => source.domain && normalizeDomain(source.domain) === domain)?.label ?? domain;
}

function structuredStringValues(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((item) => structuredStringValues(item, depth + 1));
  if (typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>)
    .flatMap((item) => structuredStringValues(item, depth + 1));
}

/** Exact cross-tool identity matching without coupling the UI to field names.
 * A current tool-input string is an entity reference only when it exactly
 * equals an external id previously observed in a tool result. This supports
 * place_id/product_id today and future shapes such as restaurant_id or nested
 * subject.id without treating request_id, user_id, or arbitrary strings as
 * entity identity. */
export function inputEntityExternalIds(
  event: SemanticAgentEvent,
  knownEntities: NormalizedEntity[]
): string[] {
  const known = new Set(
    knownEntities.map((entity) => entity.externalId).filter((id): id is string => !!id)
  );
  if (!known.size) return [];
  return [...new Set(structuredStringValues(event.input).filter((value) => known.has(value)))];
}

export function resolveInputEntityTitle(
  event: SemanticAgentEvent,
  knownEntities: NormalizedEntity[]
): string | undefined {
  const externalId = inputEntityExternalIds(event, knownEntities)[0];
  if (!externalId) return undefined;
  return knownEntities.find((entity) => entity.externalId === externalId)?.title;
}

function tokens(value: string): Set<string> {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !NON_SIGNAL_WORDS.has(token));
  return new Set(normalized);
}

function toolSignal(kind: HarnessToolKind): string {
  switch (kind) {
    case 'cricket_events': return 'cricket matches ipl upcoming';
    case 'route': return 'route travel directions distance drive';
    case 'web_search':
    case 'web_fetch': return 'web source sources article';
    default: return '';
  }
}

function stringInputSignals(event: SemanticAgentEvent): string[] {
  return Object.values(inputRecord(event)).flatMap((value) => {
    if (typeof value !== 'string') return [];
    if (/^https?:/i.test(value) || /^ChIJ/i.test(value)) return [];
    return [value];
  });
}

/** Freeform logged narration is used verbatim only when it describes an
 * action and shares a meaningful task term with the prompt/tool inputs. This
 * suppresses copied cross-task narration without rewriting or fact-checking
 * the agent. */
export function isActionAlignedInterim(
  interim: string,
  prompt: string,
  events: SemanticAgentEvent[]
): boolean {
  if (!ACTION_VERB.test(interim)) return false;
  const interimTokens = tokens(interim);
  const contextTokens = tokens([
    prompt,
    ...events.flatMap(stringInputSignals),
    ...events.map((event) => toolSignal(harnessToolKind(event))),
  ].join(' '));
  return [...interimTokens].some((token) => contextTokens.has(token));
}

function quote(value: string): string {
  // Advanced web queries may already contain exact quoted phrases. Wrapping
  // those in a second quote pair produces noisy `“"phrase" …”` copy.
  return /["“”]/.test(value) ? value : `“${value}”`;
}

function groupedSearchCopy(kind: HarnessToolKind, events: SemanticAgentEvent[]): string | undefined {
  const count = new Set(events.map(queryFor).filter((query): query is string => !!query)).size;
  if (!count) return undefined;
  if (kind === 'product_search') return `Searching products across ${count} queries`;
  if (kind === 'place_search') return `Searching places across ${count} queries`;
  if (kind === 'web_search') return `Searching the web across ${count} queries`;
  return undefined;
}

/** Copy for the moment one tool call (or one logged parallel batch) starts. */
export function consumerStartCopy({
  events,
  prompt,
  knownEntities,
  knownSources,
}: {
  events: SemanticAgentEvent[];
  prompt: string;
  knownEntities: NormalizedEntity[];
  knownSources: LoggedSourceIdentity[];
}): string | undefined {
  const interim = events
    .map((event) => metadataString(event, 'interimText'))
    .find((text): text is string => !!text);
  if (interim && isActionAlignedInterim(interim, prompt, events)) return interim;

  const kinds = new Set(events.map(harnessToolKind));
  if (kinds.size !== 1) return undefined;
  const kind = [...kinds][0];

  if (events.length > 1) {
    if (kind === 'place_details') return `Checking details for ${events.length} places`;
    if (kind === 'product_details') return `Checking details for ${events.length} products`;
    if (kind === 'entity_details') return `Checking details for ${events.length} items`;
    return groupedSearchCopy(kind, events);
  }

  const event = events[0];
  switch (kind) {
    case 'product_search': {
      const query = queryFor(event);
      return query ? `Searching products for ${quote(query)}` : undefined;
    }
    case 'place_search': {
      const query = queryFor(event);
      return query ? `Searching places for ${quote(query)}` : undefined;
    }
    case 'place_details':
    case 'product_details':
    case 'entity_details': {
      const title = resolveInputEntityTitle(event, knownEntities);
      return title ? `Checking details for ${title}` : undefined;
    }
    case 'web_search': {
      const query = queryFor(event);
      return query ? `Searching the web for ${quote(query)}` : undefined;
    }
    case 'web_fetch': {
      const source = sourceNameForFetch(event, knownSources);
      return source ? `Reading ${source}` : undefined;
    }
    case 'route': {
      const origin = inputString(event, 'origin');
      const destination = inputString(event, 'destination');
      return origin && destination ? `Checking the route from ${origin} to ${destination}` : undefined;
    }
    case 'cricket_events': {
      const status = inputString(event, 'status')?.toUpperCase();
      return status === 'UPCOMING' ? 'Checking upcoming cricket matches' : undefined;
    }
    default:
      return undefined;
  }
}

export function developerStartCopy(events: SemanticAgentEvent[]): string | undefined {
  const lines = events.flatMap((event) => {
    const label = metadataString(event, 'selectedLabel');
    const detail = metadataString(event, 'selectedDetail');
    return label || detail ? [label && detail ? `${label} · ${detail}` : label ?? detail!] : [];
  });
  return lines.length ? lines.join(' | ') : undefined;
}

export function developerResultCopy(event: SemanticAgentEvent): string | undefined {
  const label = metadataString(event, 'completedLabel');
  const detail = metadataString(event, 'completedDetail');
  if (label && detail) return `${label} · ${detail}`;
  return label ?? detail;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

export function entityResultNoun(event: SemanticAgentEvent): 'product' | 'place' | 'result' {
  const kind = harnessToolKind(event);
  if (kind === 'product_search' || kind === 'product_details') return 'product';
  if (kind === 'place_search' || kind === 'place_details') return 'place';
  if (event.entities?.some((entity) => entity.type === 'product')) return 'product';
  if (event.entities?.some((entity) => entity.type === 'place')) return 'place';
  return 'result';
}

export function zeroResultCopy(event: SemanticAgentEvent): string {
  const kind = harnessToolKind(event);
  if (kind === 'cricket_events') return 'No upcoming matches found';
  if (kind === 'product_search') return 'No products found';
  if (kind === 'place_search') return 'No places found';
  return 'No results found';
}

export function fetchedSourceResultCopy(
  event: SemanticAgentEvent,
  knownSources: LoggedSourceIdentity[]
): string | undefined {
  const source = sourceNameForFetch(event, knownSources);
  return source ? `Read ${source}` : undefined;
}

export function routeResultCopy(payload: { origin?: string; destination?: string; distance?: string; eta?: string }): string | undefined {
  const summary = [payload.distance, payload.eta].filter(Boolean).join(' · ');
  if (summary) return summary;
  return payload.origin && payload.destination ? `Route from ${payload.origin} to ${payload.destination}` : undefined;
}
