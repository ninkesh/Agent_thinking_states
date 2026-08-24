import { describe, expect, it } from 'vitest';
import type { SemanticAgentEvent } from '../../types/semanticEvent';
import type { ScenarioClassification } from '../types/archetype';
import type { FinalResponseModel } from '../types/finalResponse';
import type { QueryRequirements } from '../types/query';
import { buildSynthesisBeat } from './synthesisBeat';

const baseRequirements: QueryRequirements = {
  requestedAttributes: [],
  comparisonIntent: false,
  rankingIntent: false,
  routeIntent: false,
  listIntent: false,
  explanationIntent: false,
  matchedPhrases: [],
};

const classification: ScenarioClassification = {
  archetype: 'structured_no_image',
  confidence: 'low',
  signals: [],
  hasImages: false,
  hasMapSignals: false,
  hasStructuredData: true,
};

const finalResponse: FinalResponseModel = { kind: 'text', headline: 'Done', body: ['Some prose.'] };

function events(lastToolEnd: number, thinkingAt: number, traceEnd: number): SemanticAgentEvent[] {
  return [
    {
      id: 'tool-result',
      type: 'retrieve',
      sourceSpanIds: ['tool'],
      startTime: 0,
      endTime: lastToolEnd,
      narration: 'Read source',
      metadata: {},
    },
    {
      id: 'thinking-signal',
      type: 'internal',
      sourceSpanIds: [],
      startTime: thinkingAt,
      endTime: thinkingAt,
      narration: 'LLM thinking',
      metadata: { subtype: 'llm_thinking', loggedTimestamp: 1787000000000 },
    },
    {
      id: 'trace-end',
      type: 'internal',
      sourceSpanIds: [],
      startTime: traceEnd,
      endTime: traceEnd,
      narration: 'Token usage',
      metadata: { subtype: 'token_usage' },
    },
  ];
}

function build(overrides: Partial<Parameters<typeof buildSynthesisBeat>[0]> = {}) {
  return buildSynthesisBeat({
    events: events(20_000, 20_010, 33_000),
    requirements: baseRequirements,
    classification,
    finalResponse,
    ...overrides,
  });
}

describe('buildSynthesisBeat', () => {
  it('requires an explicit post-tool thinking lifecycle marker', () => {
    const withoutSignal = events(20_000, 20_010, 33_000).filter((event) => event.id !== 'thinking-signal');
    expect(build({ events: withoutSignal })).toHaveLength(0);
  });

  it('does not add a state for a short final gap', () => {
    expect(build({ events: events(20_000, 20_010, 21_500) })).toHaveLength(0);
  });

  it('anchors the state to the logged lifecycle timestamp and trace end', () => {
    const [beat] = build();
    expect(beat.sourceEventIds).toEqual(['thinking-signal']);
    expect(beat.traceTiming).toEqual({ start: 20_010, end: 33_000 });
    expect(beat.loggedAt).toBe(1787000000000);
  });

  it('retains the exact previous evidence payload instead of revealing final content', () => {
    const payload = { sources: [{ label: 'Logged source', kind: 'web' as const }], sourceCount: 1, searchCount: 1 };
    const [beat] = build({
      lastEvidence: { visibility: 'canvas_value', valueType: 'sources', payload },
    });
    expect(beat.visibility).toBe('canvas_value');
    expect(beat.valueType).toBe('sources');
    expect(beat.payload).toBe(payload);
    expect(beat.valueType).not.toBe('synthesis_structure');
  });

  it('uses deterministic, domain-aware process copy', () => {
    expect(build({ requirements: { ...baseRequirements, entityType: 'recipe' } })[0].narration).toMatch(/recipe/i);
    expect(build({ requirements: { ...baseRequirements, entityType: 'stay' } })[0].narration).toMatch(/plan/i);
    expect(build({ prompt: 'How do I cook this dish?' })[0].narration).toMatch(/recipe/i);
    expect(build()[0].narration).toBe('Bringing the useful details together into a clear answer');
  });
});
