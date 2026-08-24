import type { NormalizedEntity } from '../types/entity';
import type { QueryRequirements } from '../types/query';

/* Discovery cards should answer "what do we know about these?" without
 * turning thinking into the final response. The selector is deterministic:
 * user-requested fields first, then entity-appropriate logged facts, capped
 * at three. No empty slot is filled with generated copy. */

type FactKey =
  | 'rating'
  | 'price'
  | 'location'
  | 'availability'
  | 'route'
  | 'category'
  | 'brand'
  | 'gender'
  | 'stock';

function attributes(entity: NormalizedEntity): Record<string, unknown> {
  return entity.attributes ?? {};
}

function loggedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function titleCaseEnum(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ratingFact(entity: NormalizedEntity): string | undefined {
  if (entity.rating == null) return undefined;
  return entity.reviewCount != null
    ? `${entity.rating}★ (${entity.reviewCount.toLocaleString('en-IN')})`
    : `${entity.rating}★`;
}

function routeFact(entity: NormalizedEntity): string | undefined {
  if (entity.travelTime && entity.distance) return `${entity.travelTime} · ${entity.distance}`;
  return entity.travelTime ?? entity.distance;
}

function availabilityFact(entity: NormalizedEntity): string | undefined {
  if (typeof entity.availability === 'string' && entity.availability.trim()) return entity.availability.trim();
  const openNow = attributes(entity).openNow;
  return typeof openNow === 'boolean' ? (openNow ? 'Open now' : 'Currently closed') : undefined;
}

function categoryFact(entity: NormalizedEntity): string | undefined {
  const attrs = attributes(entity);
  const categories = Array.isArray(attrs.categories)
    ? attrs.categories.filter((value): value is string => typeof value === 'string' && !!value.trim())
    : [];
  if (categories[0]) return titleCaseEnum(categories[0]);
  const types = Array.isArray(attrs.types)
    ? attrs.types.filter((value): value is string => typeof value === 'string' && !!value.trim())
    : [];
  return types[0] ? titleCaseEnum(types[0]) : undefined;
}

function factValue(entity: NormalizedEntity, key: FactKey): string | undefined {
  const attrs = attributes(entity);
  switch (key) {
    case 'rating': return ratingFact(entity);
    case 'price': return entity.price;
    case 'location': return entity.subtitle ?? (entity.location && entity.location.length <= 42 ? entity.location : undefined);
    case 'availability': return availabilityFact(entity);
    case 'route': return routeFact(entity);
    case 'category': return categoryFact(entity);
    case 'brand': return loggedString(attrs.brand) ?? (entity.type === 'product' ? entity.subtitle : undefined);
    case 'gender': {
      const gender = loggedString(attrs.gender);
      return gender ? titleCaseEnum(gender) : undefined;
    }
    case 'stock': {
      const inStock = attrs.inStock;
      return typeof inStock === 'boolean' ? (inStock ? 'In stock' : 'Out of stock') : undefined;
    }
  }
}

function requestedFactKeys(requirements: QueryRequirements): FactKey[] {
  const keys: FactKey[] = [];
  for (const attribute of requirements.requestedAttributes) {
    // Provider categories remain a fallback rather than a request-priority
    // fact: `chinese_restaurant` does not prove the requested Jiangsu-style
    // dish, just as `cafe` does not prove a specific drink is served.
    const key: FactKey | undefined =
      attribute === 'duration' || attribute === 'distance' ? 'route'
        : attribute === 'rating' || attribute === 'price' || attribute === 'location'
          || attribute === 'availability' || attribute === 'gender'
          ? attribute
          : undefined;
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function defaultsFor(entity: NormalizedEntity): FactKey[] {
  if (entity.type === 'product') return ['price', 'brand', 'category', 'gender', 'stock'];
  if (['place', 'restaurant', 'hotel', 'destination'].includes(entity.type)) {
    return ['rating', 'route', 'price', 'availability', 'location', 'category'];
  }
  return ['rating', 'price', 'route', 'availability', 'location', 'category'];
}

/** At most three exact/deterministically formatted discovery facts. */
export function selectEntityFacts(
  entity: NormalizedEntity,
  requirements: QueryRequirements | undefined,
  limit = 3
): string[] {
  const keys = [...(requirements ? requestedFactKeys(requirements) : []), ...defaultsFor(entity)];
  const seenKeys = new Set<FactKey>();
  const seenValues = new Set<string>();
  const facts: string[] = [];

  for (const key of keys) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const value = factValue(entity, key);
    if (!value || seenValues.has(value)) continue;
    seenValues.add(value);
    facts.push(value);
    if (facts.length >= limit) break;
  }
  return facts;
}
