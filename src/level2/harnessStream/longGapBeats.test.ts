import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildScenarioFromHarnessStream } from './buildScenarioFromHarnessStream';
import { scheduleActualPasses } from '../runtime/schedule';
import type { HarnessStreamEvent, HarnessTurnEventSource } from './types';

/* Real-data regression coverage for source-native timestamp replay. Uses the
   real q02 capture (Thavala Dosai recipe) — a genuinely long (33.5s) turn —
   and proves that no authored acknowledgement/synthesis beat is inserted. */

const FIXTURE_DIR = join(__dirname, '../../../scripts/fixtures/harness-stream');

function loadTurn(id: string): HarnessTurnEventSource {
  const manifest: Record<string, string> = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf-8'));
  const events: HarnessStreamEvent[] = JSON.parse(readFileSync(join(FIXTURE_DIR, `${id}_events.json`), 'utf-8'));
  return { turnId: id, prompt: manifest[id], events };
}

describe('q02 (33.5s real recipe research) — long pass no longer a static hold', () => {
  const { scenario } = buildScenarioFromHarnessStream(loadTurn('q02'));

  it('resolves into multiple meaningful beats, not one pass + one narration + a 30s hold', () => {
    expect(scenario!.thinkingPasses.length).toBeGreaterThan(1);
    const narrations = new Set(scenario!.thinkingPasses.map((p) => p.narration));
    // Every beat says something different — no beat is just a repeat of the
    // previous one's line under a new id.
    expect(narrations.size).toBe(scenario!.thinkingPasses.length);
  });

  it('contains only timestamped source passes and no authored synthesis/intent beat', () => {
    const passes = scenario!.thinkingPasses;
    expect(passes.every((pass) => typeof pass.loggedAt === 'number')).toBe(true);
    expect(passes.some((pass) => pass.id === 'pass-synthesis' || pass.valueType === 'intent')).toBe(false);
    expect(passes.map((pass) => pass.loggedAt)).toEqual([...passes.map((pass) => pass.loggedAt)].sort((a, b) => a! - b!));
  });

  it('no single scheduled window covers more than ~40% of the real trace duration', () => {
    const traceDurationMs = scenario!.metadata?.traceDurationMs as number;
    const { scheduled } = scheduleActualPasses(scenario!.thinkingPasses, traceDurationMs, 0);
    const longest = Math.max(...scheduled.map((s) => s.end - s.start));
    // Before this fix, one pass covered the ENTIRE 33.5s trace. A generous
    // 40% ceiling still catches a full regression back to one giant pass
    // without being brittle about the exact real split.
    expect(longest).toBeLessThan(traceDurationMs * 0.4);
  });
});

describe('q03 (hybrid, real GetRoute calls) — route data appears at its logged arrival', () => {
  const { scenario } = buildScenarioFromHarnessStream(loadTurn('q03'));

  it('formats route facts for consumers and preserves the raw diagnostic for D mode', () => {
    const passes = scenario!.thinkingPasses;
    const route = passes.find((p) => p.valueType === 'route');
    expect(route).toBeDefined();
    expect(route!.narration).toBe('130 km · 2 hours 26 mins');
    expect(route!.developerNarration).toBe('Tool done: GetRoute · 625 chars');
    expect(typeof route!.loggedAt).toBe('number');
    expect(passes.some((p) => p.id === 'pass-synthesis')).toBe(false);
  });
});

describe('all harness archetypes omit authored synthesis beats', () => {
  it('q05 (candidate_ranking) never gets a pass-synthesis appended', () => {
    const { scenario } = buildScenarioFromHarnessStream(loadTurn('q05'));
    expect(scenario!.thinkingPasses.some((p) => p.id === 'pass-synthesis')).toBe(false);
  });

  it('q01 (list) never gets a pass-synthesis appended', () => {
    const { scenario } = buildScenarioFromHarnessStream(loadTurn('q01'));
    expect(scenario!.thinkingPasses.some((p) => p.id === 'pass-synthesis')).toBe(false);
  });
});
