/* ─────────────────────────────────────────────────────────────────────────────
   Harness stream capture conversion (build-time, mirrors
   classify-phoenix-corpus.ts's convention).

     npx tsx scripts/convertHarnessStreamCaptures.ts

   Reads the 10 captured qNN_events.json turns + manifest.json, runs each
   through the SAME pipeline the app uses at runtime
   (buildScenarioFromHarnessStream — no second implementation), and writes:

     src/level2/scenarios/harnessStreamScenarios.ts   HARNESS_STREAM_SCENARIOS

   Rejects loudly: a capture that doesn't classify, or that
   describeHollowResponse flags as hollow, fails the run rather than writing
   a silently-broken scenario. Real captures, not synthetic data — see
   scripts/fixtures/harness-stream/README for provenance.
   ───────────────────────────────────────────────────────────────────────────── */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildScenarioFromHarnessStream } from '../src/level2/harnessStream/buildScenarioFromHarnessStream';
import { describeHollowResponse } from '../src/level2/finalResponse/integrity';
import type { HarnessStreamEvent, HarnessTurnEventSource } from '../src/level2/harnessStream/types';
import type { Level2Scenario } from '../src/level2/types/scenario';

// Resolve from the repository root so the converter behaves identically when
// run directly through tsx or as a temporary Vite SSR bundle.
const REPO_ROOT = process.cwd();
const FIXTURE_DIR = join(REPO_ROOT, 'scripts/fixtures/harness-stream');
const OUT_FILE = join(REPO_ROOT, 'src/level2/scenarios/harnessStreamScenarios.ts');

function main() {
  const manifest: Record<string, string> = JSON.parse(readFileSync(join(FIXTURE_DIR, 'manifest.json'), 'utf-8'));
  const ids = readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('_events.json'))
    .map((f) => f.replace('_events.json', ''))
    .sort();

  const scenarios: Level2Scenario[] = [];
  const failures: string[] = [];

  for (const id of ids) {
    const prompt = manifest[id];
    if (!prompt) {
      failures.push(`${id}: no manifest entry`);
      continue;
    }
    const events: HarnessStreamEvent[] = JSON.parse(readFileSync(join(FIXTURE_DIR, `${id}_events.json`), 'utf-8'));
    const turn: HarnessTurnEventSource = { turnId: id, prompt, events };

    const result = buildScenarioFromHarnessStream(turn);
    if (!result.scenario) {
      failures.push(`${id}: rejected — ${result.rejectedReason ?? 'unmappable'}`);
      continue;
    }

    const hollow = describeHollowResponse(result.scenario.finalResponse);
    if (hollow) {
      failures.push(`${id}: hollow final response — ${hollow}`);
      continue;
    }

    scenarios.push({
      ...result.scenario,
      id: `harness-${id}`,
      // The selector uses the captured request itself. No hand-authored case
      // label is introduced alongside real harness data.
      metadata: { ...result.scenario.metadata, captureId: id, captureLabel: prompt },
    });
  }

  if (failures.length) {
    console.error(`\n${failures.length} capture(s) failed to convert:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
    process.exit(1);
  }

  const header = `/* GENERATED FILE — DO NOT EDIT BY HAND.
   Written by scripts/convertHarnessStreamCaptures.ts from the 10 real
   captured harness turn-event streams in scripts/fixtures/harness-stream/.
   Regenerate with:

     npx tsx scripts/convertHarnessStreamCaptures.ts

   Every scenario here is real agent output (source: 'harness_stream'), run
   through the SAME classifier/pass-builder/final-response pipeline every
   other source uses — see src/level2/harnessStream/buildScenarioFromHarnessStream.ts. */

import type { Level2Scenario } from '../types/scenario';

export const HARNESS_STREAM_SCENARIOS: Level2Scenario[] = ${JSON.stringify(scenarios, null, 2)};
`;

  writeFileSync(OUT_FILE, header, 'utf-8');
  console.log(`\nWrote ${scenarios.length} harness-stream scenarios to ${OUT_FILE}\n`);
  for (const s of scenarios) {
    console.log(`  ${s.metadata?.captureId}  ${s.metadata?.captureLabel}  → ${s.archetype}`);
  }
}

main();
