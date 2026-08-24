import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildScenarioFromHarnessStream } from './buildScenarioFromHarnessStream';
import {
  consumerEntityFieldArrivals,
  selectedEntitiesForIdentityCalls,
  selectedPlacesForDetailCalls,
} from './sourceNativePasses';
import type { HarnessStreamEvent, HarnessTurnEventSource } from './types';
import type { SemanticAgentEvent } from '../../types/semanticEvent';
import type { NormalizedEntity } from '../types/entity';
import type { EntityPreviewPayload } from '../types/pass';
import { selectEntityFacts } from '../renderers/entityFacts';

const FIXTURE_DIR = join(__dirname, '../../../scripts/fixtures/harness-stream');

function scenario(id: string) {
  const manifest: Record<string, string> = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf-8'));
  const events: HarnessStreamEvent[] = JSON.parse(readFileSync(join(FIXTURE_DIR, `${id}_events.json`), 'utf-8'));
  const turn: HarnessTurnEventSource = { turnId: id, prompt: manifest[id], events };
  return buildScenarioFromHarnessStream(turn).scenario!;
}

describe('harness consumer thinking copy', () => {
  it('never exposes raw tool diagnostics on the consumer narration field', () => {
    for (const id of ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10']) {
      for (const pass of scenario(id).thinkingPasses) {
        expect(pass.narration).not.toMatch(/Tool (?:→|done:)|\bchars\b|\bChIJ|https?:\/\//);
      }
    }
  });

  it('preserves untouched diagnostics separately for D mode', () => {
    const passes = scenario('q03').thinkingPasses;
    expect(passes.some((pass) => pass.developerNarration?.includes('Tool → PlaceDetails'))).toBe(true);
    expect(passes.some((pass) => pass.developerNarration?.includes('Tool done: GetRoute'))).toBe(true);
  });

  it('maps representative states across all ten real cases', () => {
    const narrations = Object.fromEntries(
      ['q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10']
        .map((id) => [id, scenario(id).thinkingPasses.map((pass) => pass.narration)])
    );

    expect(narrations.q01).toContain('Pulling up school backpacks for both boys and girls now.');
    expect(narrations.q01.some((copy) => copy.startsWith('Found 10 products.'))).toBe(true);

    expect(narrations.q02).toContain('Searching the web across 2 queries');
    expect(narrations.q02).toContain('Checked 4 sources across 2 searches');
    expect(narrations.q02).toContain('Reading Thavala Dosai — Your Everyday Cook');

    expect(narrations.q03).toContain('Checking details for Rawla Narlai Luxury Heritage Hotel');
    expect(narrations.q03).toContain('130 km · 2 hours 26 mins');

    expect(narrations.q04).toContain('The initial search returned mostly clothing and shoes because the catalogue is fashion-focused. Let me refine with specific game titles and categories to find actual board and card games.');
    expect(narrations.q04).toContain('Found 7 products across 2 searches');
    expect(narrations.q04.some((copy) => copy.startsWith('The refined searches found 8 products.'))).toBe(true);
    expect(narrations.q04).not.toContain('Added 3 more products');

    expect(narrations.q05.some((copy) => copy.startsWith('Found 6 places.'))).toBe(true);

    expect(narrations.q06).not.toContain(expect.stringContaining('spice levels'));
    expect(narrations.q06).toContain('Checking details for 4 places');

    expect(narrations.q07).not.toContain(expect.stringContaining('spice levels'));
    expect(narrations.q07).toContain('Checking details for 4 places');

    expect(narrations.q08.some((copy) => copy.startsWith('Found 8 places across 4 searches.'))).toBe(true);

    expect(narrations.q09.some((copy) => copy.startsWith('No upcoming matches found.'))).toBe(true);

    expect(narrations.q10).toContain("Now I'll fetch detailed information for the top-rated restaurants to verify their tofu offerings and late-night hours.");
    expect(narrations.q10).not.toContain(expect.stringContaining('ChIJ'));
    expect(narrations.q10.at(-1)).toMatch(/useful shortlist$/);
    expect(narrations.q10.at(-1)).not.toMatch(/recipe/i);
  });

  it('renders each Q04 parallel search batch as one readable result set', () => {
    const resultPasses = scenario('q04').thinkingPasses.filter((pass) => pass.valueType === 'trace_entities');

    expect(resultPasses.map((pass) => pass.narration)).toEqual([
      'Found 7 products across 2 searches',
      'The initial search returned mostly clothing and shoes because the catalogue is fashion-focused. Let me refine with specific game titles and categories to find actual board and card games.',
      'The refined searches found 8 products. Organizing the options around what matters most',
    ]);
    expect((resultPasses[0].payload as EntityPreviewPayload).entities).toHaveLength(7);
    expect((resultPasses[2].payload as EntityPreviewPayload).entities).toHaveLength(8);
    expect(resultPasses[0].loggedAt).toBe(1787127761785);
    expect(resultPasses[2].loggedAt).toBe(1787127769472);
  });

  it('shows up to three request-aware logged facts instead of rating alone', () => {
    const foundEntities = (id: string) => {
      const built = scenario(id);
      const pass = built.thinkingPasses.find(
        (candidate) => /^Found \d+ (?:places|products)/.test(candidate.narration) && candidate.valueType === 'trace_entities'
      );
      return { built, entities: (pass?.payload as EntityPreviewPayload).entities };
    };

    const q01 = foundEntities('q01');
    expect(selectEntityFacts(q01.entities[0], q01.built.requirements)).toEqual(['Kids', '₹1090', 'Savana']);

    const q05 = foundEntities('q05');
    expect(selectEntityFacts(q05.entities[0], q05.built.requirements)).toEqual([
      '4.9★ (54)',
      '₹400–600 per person',
      'Koramangala, Bengaluru',
    ]);

    const q06 = foundEntities('q06');
    expect(selectEntityFacts(q06.entities[0], q06.built.requirements)).toEqual([
      'Open now',
      '4.5★ (6,521)',
      'Italian Restaurant',
    ]);

    const q07 = foundEntities('q07');
    expect(selectEntityFacts(q07.entities[1], q07.built.requirements)).toEqual([
      '4.5★ (49)',
      '12 min · 5.0 km',
      '₹400–600 per person',
    ]);

    const q08 = foundEntities('q08');
    expect(selectEntityFacts(q08.entities[0], q08.built.requirements)).toEqual([
      '5★ (15)',
      'Open now',
      'Art Gallery',
    ]);

    const q10 = foundEntities('q10');
    expect(selectEntityFacts(q10.entities[1], q10.built.requirements)).toEqual([
      'Open now',
      '4.6★ (280)',
      '₹2000+ per person',
    ]);
  });

  it('uses PlaceDetails place_ids as an exact selection, never a title or rank heuristic', () => {
    const known: NormalizedEntity[] = [
      { id: 'a', type: 'restaurant', externalId: 'place-a', title: 'A' },
      { id: 'b', type: 'restaurant', externalId: 'place-b', title: 'B' },
      { id: 'c', type: 'restaurant', externalId: 'place-c', title: 'C' },
    ];
    const detailCall = (id: string, placeId: string): SemanticAgentEvent => ({
      id,
      type: 'enrichment',
      sourceSpanIds: [id],
      startTime: 0,
      endTime: 1,
      narration: 'PlaceDetails',
      input: { place_id: placeId },
      metadata: { tool: 'PlaceDetails' },
    });

    const selected = selectedPlacesForDetailCalls(
      [detailCall('detail-b', 'place-b'), detailCall('detail-c', 'place-c')],
      known
    );

    expect(selected?.externalIds).toEqual(['place-b', 'place-c']);
    expect(selected?.entities.map((entity) => entity.title)).toEqual(['B', 'C']);

    const q07DetailPass = scenario('q07').thinkingPasses.find(
      (pass) => pass.narration === 'Checking details for 4 places'
    );
    const payload = q07DetailPass?.payload as { entities?: NormalizedEntity[]; inspectionIds?: string[] } | undefined;
    expect(payload?.entities).toHaveLength(4);
    expect(payload?.entities?.map((entity) => entity.title)).toContain('Lucknow Street');
    expect(new Set(payload?.inspectionIds)).toEqual(new Set(payload?.entities?.map((entity) => entity.id)));
  });

  it('applies the same exact-id continuity to product and generic enrichment tools', () => {
    const known: NormalizedEntity[] = [
      { id: 'local-product', type: 'product', externalId: 'product-42', title: 'Logged Backpack' },
    ];
    const fetchEvent: SemanticAgentEvent = {
      id: 'fetch-product',
      type: 'enrichment',
      sourceSpanIds: ['fetch-product'],
      startTime: 0,
      endTime: 1,
      narration: 'ProductFetch',
      input: {
        request_id: 'not-an-entity',
        subject: { kind: 'catalog_item', id: 'product-42' },
      },
      metadata: { tool: 'ProductFetch' },
    };

    expect(selectedEntitiesForIdentityCalls([fetchEvent], known)?.entities[0]).toBe(known[0]);
  });

  it('uses the same field-delta contract for product enrichment and drops repeats', () => {
    const previous: NormalizedEntity = {
      id: 'local-product',
      type: 'product',
      externalId: 'product-42',
      title: 'Logged Backpack',
      price: '₹1200',
      attributes: { brand: 'Northstar', inStock: true },
    };
    const arriving: NormalizedEntity = {
      id: 'fetched-product',
      type: 'product',
      externalId: 'product-42',
      title: 'Logged Backpack',
      price: '₹1200',
      attributes: {
        brand: 'Northstar',
        inStock: true,
        originalPrice: 1500,
        currency: 'INR',
        vtonEnabled: true,
      },
    };

    expect(consumerEntityFieldArrivals(previous, arriving)).toEqual([
      { field: 'original_price', value: 'Original price: ₹1500', change: 'added' },
      { field: 'virtual_try_on', value: 'Virtual try-on available', change: 'added' },
    ]);
    expect(consumerEntityFieldArrivals(arriving, arriving)).toEqual([]);
  });

  it('coalesces Q10 parallel details into one exact-id inspection and one cumulative result', () => {
    const passes = scenario('q10').thinkingPasses;
    const checkingIndex = passes.findIndex(
      (pass) => pass.narration === "Now I'll fetch detailed information for the top-rated restaurants to verify their tofu offerings and late-night hours."
    );
    expect(checkingIndex).toBeGreaterThanOrEqual(0);

    const followingEntityPass = passes.slice(checkingIndex + 1).find((pass) => pass.valueType === 'trace_entities');
    expect(followingEntityPass?.narration).toMatch(/received across 4 places\./);

    const checkingEntities = (passes[checkingIndex].payload as { entities?: NormalizedEntity[] })?.entities ?? [];
    const updatedEntities = (followingEntityPass?.payload as { entities?: NormalizedEntity[] })?.entities ?? [];
    expect(checkingEntities).toHaveLength(4);
    expect(updatedEntities).toHaveLength(4);
    expect(new Set(updatedEntities.map((entity) => entity.externalId))).toEqual(
      new Set(checkingEntities.map((entity) => entity.externalId))
    );
  });

  it('keeps every per-place field arrival inside the cumulative Q07 detail result', () => {
    const detailResult = scenario('q07').thinkingPasses.find(
      (pass) => pass.valueType === 'trace_entities'
        && Object.keys((pass.payload as EntityPreviewPayload).fieldArrivals ?? {}).length > 0
    );
    expect(detailResult).toBeDefined();

    const payload = detailResult?.payload as EntityPreviewPayload;
    const entity = payload.entities.find((candidate) => candidate.externalId === 'ChIJ4SOBNhwVrjsRJf8wyc6izjk');
    expect(entity).toBeDefined();
    if (!entity) return;
    expect(payload.fieldArrivals?.[entity.id]).toEqual([
      {
        field: 'hours',
        value: 'Friday: 11:00 AM – 11:30 PM',
        change: 'added',
        multiline: true,
      },
      {
        field: 'review',
        value: '5★ · RNR is my go to for donne biryani, great vegetarian options and lovely ambience.',
        change: 'added',
        multiline: true,
      },
    ]);
  });

  it('keeps both Q03 route summaries after the second rapid route result arrives', () => {
    const latestPass = scenario('q03').thinkingPasses.find(
      (pass) => pass.valueType === 'route'
        && ((pass.payload as { alternates?: unknown[] }).alternates?.length ?? 0) === 2
    );
    expect(latestPass).toBeDefined();
    const latest = latestPass?.payload as { alternates?: Array<{ label: string; distance?: string; eta?: string }> };
    expect(latest.alternates).toHaveLength(2);
    expect(latest.alternates?.map((route) => [route.distance, route.eta])).toEqual([
      ['130 km', '2 hours 26 mins'],
      ['122 km', '2 hours 26 mins'],
    ]);
  });
});
