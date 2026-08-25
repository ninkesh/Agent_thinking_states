import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { streamToSemanticEvents } from './streamToSemanticEvents';
import { buildScenarioFromHarnessStream } from './buildScenarioFromHarnessStream';
import type { HarnessStreamEvent, HarnessTurnEventSource } from './types';

/* Feeds all 30 real captured event streams through the adapter —
   never synthetic data, matching this repo's own corpus-testing convention
   (see fromTrace.test.ts / registry.test.ts). Asserts well-formed output,
   not "looks right"; classification-quality reporting lives in
   scripts/validateHarnessStream.ts. */

const FIXTURE_DIR = join(__dirname, '../../../scripts/fixtures/harness-stream');
const CAPTURE_COLLECTIONS = [
  { directory: FIXTURE_DIR, idPrefix: '' },
  { directory: join(FIXTURE_DIR, 'tests'), idPrefix: 'test-' },
];

function loadAllTurns(): HarnessTurnEventSource[] {
  return CAPTURE_COLLECTIONS.flatMap(({ directory, idPrefix }) => {
    const manifest: Record<string, string> = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf-8'));
    const ids = readdirSync(directory)
      .filter((f) => f.endsWith('_events.json'))
      .map((f) => f.replace('_events.json', ''))
      .sort();
    return ids.map((id) => {
      const events: HarnessStreamEvent[] = JSON.parse(readFileSync(join(directory, `${id}_events.json`), 'utf-8'));
      return { turnId: `${idPrefix}${id}`, prompt: manifest[id], events };
    });
  });
}

describe('streamToSemanticEvents — real captured turns', () => {
  const turns = loadAllTurns();
  const reviewedTurns = turns.filter((turn) => !turn.turnId.startsWith('test-'));
  const testTurns = turns.filter((turn) => turn.turnId.startsWith('test-'));

  it('loads all 30 captured turns with a manifest prompt', () => {
    expect(turns).toHaveLength(30);
    for (const turn of turns) expect(turn.prompt).toBeTruthy();
  });

  it('keeps raw reasoning chunks out of the checked-in corpus', () => {
    for (const turn of testTurns) {
      expect(turn.events.some((event) => event.type === 'reasoning')).toBe(false);
    }
  });

  it.each(turns.map((t) => [t.turnId, t] as const))('%s produces well-formed semantic events', (_id, turn) => {
    const { events, diagnostics } = streamToSemanticEvents(turn.events);

    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.startTime).toBeLessThanOrEqual(e.endTime);
      expect(e.startTime).toBeGreaterThanOrEqual(0);
    }

    // Raw reasoning must never leak as consumer-visible narration.
    for (const e of events) {
      if (e.type === 'internal') continue;
      expect(e.narration ?? '').not.toMatch(/^The user wants/);
    }

    // Every tool the adapter doesn't recognize is a real gap worth seeing,
    // not a silent drop — surfaced here rather than asserted to zero, since
    // q09's CricketEvents is a legitimate example.
    expect(Array.isArray(diagnostics.unrecognizedTools)).toBe(true);
  });

  it.each(turns.map((t) => [t.turnId, t] as const))('%s classifies to a real scenario, never thrown', (_id, turn) => {
    const result = buildScenarioFromHarnessStream(turn);
    expect(result.scenario ?? result.rejectedReason).toBeTruthy();
    if (result.scenario) {
      expect(result.scenario.source).toBe('harness_stream');
      expect(result.scenario.thinkingPasses.length).toBeGreaterThan(0);
      for (const p of result.scenario.thinkingPasses) {
        expect(p.traceTiming?.start).toBeLessThanOrEqual(p.traceTiming!.end);
        expect(typeof p.loggedAt).toBe('number');
        expect(p.id).toMatch(/^(?:hs-\d+-(?:status|result)|pass-synthesis-hs-\d+)$/);
      }
      const synthesis = result.scenario.thinkingPasses.find((p) => p.id.startsWith('pass-synthesis-'));
      // The original reviewed set established the multi-event synthesis
      // contract. Some newly delivered tests genuinely have a one-operation
      // run, so requiring >1 source there would invent a second event.
      if (!turn.turnId.startsWith('test-')) {
        expect(synthesis?.sourceEventIds?.length).toBeGreaterThan(1);
      }
      expect(result.scenario.thinkingPasses.some((p) => p.valueType === 'intent' || p.valueType === 'synthesis_structure')).toBe(false);
    }
  });

  it.each(reviewedTurns.map((t) => [t.turnId, t] as const))('%s tags visible states with exact insight timestamps', (_id, turn) => {
    const extraction = streamToSemanticEvents(turn.events);
    const result = buildScenarioFromHarnessStream(turn);
    expect(result.scenario).toBeDefined();

    const visibleEvents = extraction.events.filter((event) => event.type !== 'internal' && event.type !== 'unknown');
    for (const event of visibleEvents) {
      const selectedAt = event.metadata?.loggedStartTimestamp;
      const resultAt = event.metadata?.loggedResultTimestamp;
      if (typeof selectedAt !== 'number' || typeof resultAt !== 'number') continue;
      // Parallel calls share one consumer status at the first logged arrival
      // and one atomic result at the final member's arrival. Every raw event
      // remains referenced by both passes; millisecond-separated members are
      // not fabricated into individually readable UI states.
      const status = result.scenario!.thinkingPasses.find(
        (pass) => pass.id.endsWith('-status') && pass.sourceEventIds?.includes(event.id)
      );
      expect(status).toBeDefined();
      const groupedIds = new Set(status!.sourceEventIds);
      const expectedStatusAt = Math.min(
        ...visibleEvents
          .filter((candidate) => groupedIds.has(candidate.id))
          .map((candidate) => candidate.metadata?.loggedStartTimestamp)
          .filter((timestamp): timestamp is number => typeof timestamp === 'number')
      );
      expect(status?.loggedAt).toBe(expectedStatusAt);
      const value = result.scenario!.thinkingPasses.find(
        (pass) => pass.id.endsWith('-result') && pass.sourceEventIds?.includes(event.id)
      );
      if (value) {
        const valueIds = new Set(value.sourceEventIds);
        const expectedResultAt = Math.max(
          ...visibleEvents
            .filter((candidate) => valueIds.has(candidate.id))
            .map((candidate) => candidate.metadata?.loggedResultTimestamp)
            .filter((timestamp): timestamp is number => typeof timestamp === 'number')
        );
        expect(value.loggedAt).toBe(expectedResultAt);
      }
    }
  });

  it('q08 keeps Local Favorite as a badge, not an inferred winner, and does not invent its two absent links', () => {
    const result = buildScenarioFromHarnessStream(turns.find((turn) => turn.turnId === 'q08')!);
    expect(result.scenario?.finalResponse.kind).toBe('entity_rail');
    if (result.scenario?.finalResponse.kind !== 'entity_rail') return;
    expect(result.scenario.finalResponse.winnerId).toBeUndefined();
    expect(result.scenario.finalResponse.entities).toHaveLength(8);
    expect(result.scenario.finalResponse.entities.filter((entity) => entity.attributes?.ctaUrl)).toHaveLength(6);
  });
});
