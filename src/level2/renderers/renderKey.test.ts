import { describe, expect, it } from 'vitest';
import type { ThinkingValueType } from '../types/pass';
import { thinkingCanvasRenderKey } from './renderKey';

describe('thinkingCanvasRenderKey', () => {
  it.each<ThinkingValueType>([
    'entity_preview',
    'trace_entities',
    'sources',
    'route',
  ])('keeps the %s canvas mounted across passes', (valueType) => {
    expect(thinkingCanvasRenderKey(valueType, 'pass-a')).toBe(`${valueType}-canvas`);
    expect(thinkingCanvasRenderKey(valueType, 'pass-b')).toBe(`${valueType}-canvas`);
  });

  it('uses the pass id for transient renderers', () => {
    expect(thinkingCanvasRenderKey('count', 'pass-b')).toBe('pass-b');
    expect(thinkingCanvasRenderKey(undefined, 'pass-c')).toBe('pass-c');
  });
});
