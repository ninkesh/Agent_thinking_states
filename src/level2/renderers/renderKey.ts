import type { ThinkingValueType } from '../types/pass';

/**
 * Renderers whose canvas represents one evolving object rather than a
 * disposable beat. Keeping their React key stable lets new log fields update
 * the existing UI without remounting cards, images, source chips, or maps.
 */
const PERSISTENT_CANVAS_VALUE_TYPES = new Set<ThinkingValueType>([
  'entity_preview',
  'trace_entities',
  'sources',
  'route',
]);

export function thinkingCanvasRenderKey(
  valueType: ThinkingValueType | undefined,
  passId: string
): string {
  return valueType && PERSISTENT_CANVAS_VALUE_TYPES.has(valueType)
    ? `${valueType}-canvas`
    : passId;
}
