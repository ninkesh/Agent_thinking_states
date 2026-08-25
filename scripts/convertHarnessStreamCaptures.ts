/* ─────────────────────────────────────────────────────────────────────────────
   Harness stream capture conversion (build-time, mirrors
   classify-phoenix-corpus.ts's convention).

     npx tsx scripts/convertHarnessStreamCaptures.ts

   Reads the reviewed and Tests capture collections, runs each
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
import type { ScenarioArchetype } from '../src/level2/types/archetype';

// Resolve from the repository root so the converter behaves identically when
// run directly through tsx or as a temporary Vite SSR bundle.
const REPO_ROOT = process.cwd();
const FIXTURE_DIR = join(REPO_ROOT, 'scripts/fixtures/harness-stream');
const OUT_FILE = join(REPO_ROOT, 'src/level2/scenarios/harnessStreamScenarios.ts');

const COLLECTIONS = [
  { id: 'reviewed', directory: FIXTURE_DIR, capturePrefix: '' },
  { id: 'tests', directory: join(FIXTURE_DIR, 'tests'), capturePrefix: 'test-' },
] as const;

interface CaptureIndexEntry {
  id: string;
  label: string;
  collection: (typeof COLLECTIONS)[number]['id'];
  archetype?: ScenarioArchetype;
  unavailableReason?: string;
}

function main() {
  const scenarios: Level2Scenario[] = [];
  const captures: CaptureIndexEntry[] = [];

  for (const collection of COLLECTIONS) {
    const manifest: Record<string, string> = JSON.parse(readFileSync(join(collection.directory, 'manifest.json'), 'utf-8'));
    const ids = readdirSync(collection.directory)
      .filter((f) => f.endsWith('_events.json'))
      .map((f) => f.replace('_events.json', ''))
      .sort();

    for (const id of ids) {
      const captureId = `${collection.capturePrefix}${id}`;
      const prompt = manifest[id];
      if (!prompt) {
        captures.push({
          id: captureId,
          label: id,
          collection: collection.id,
          unavailableReason: 'No manifest prompt was supplied.',
        });
        continue;
      }
      const events: HarnessStreamEvent[] = JSON.parse(readFileSync(join(collection.directory, `${id}_events.json`), 'utf-8'));
      const turn: HarnessTurnEventSource = { turnId: captureId, prompt, events };

      const result = buildScenarioFromHarnessStream(turn);
      if (!result.scenario) {
        captures.push({
          id: captureId,
          label: prompt,
          collection: collection.id,
          unavailableReason: result.rejectedReason ?? 'The capture could not be mapped.',
        });
        continue;
      }

      const hollow = describeHollowResponse(result.scenario.finalResponse);
      if (hollow) {
        captures.push({
          id: captureId,
          label: prompt,
          collection: collection.id,
          archetype: result.scenario.archetype,
          unavailableReason: `Hollow final response: ${hollow}`,
        });
        continue;
      }

      scenarios.push({
        ...result.scenario,
        id: `harness-${captureId}`,
        // The selector uses the captured request itself. No hand-authored case
        // label is introduced alongside real harness data.
        metadata: {
          ...result.scenario.metadata,
          captureId,
          captureLabel: prompt,
          captureCollection: collection.id,
        },
      });
      captures.push({
        id: captureId,
        label: prompt,
        collection: collection.id,
        archetype: result.scenario.archetype,
      });
    }
  }

  const header = `/* GENERATED FILE — DO NOT EDIT BY HAND.
   Written by scripts/convertHarnessStreamCaptures.ts from the reviewed and
   Tests harness turn-event streams in scripts/fixtures/harness-stream/.
   Regenerate with:

     npx tsx scripts/convertHarnessStreamCaptures.ts

   Every scenario here is real agent output (source: 'harness_stream'), run
   through the SAME classifier/pass-builder/final-response pipeline every
   other source uses — see src/level2/harnessStream/buildScenarioFromHarnessStream.ts. */

import type { ScenarioArchetype } from '../types/archetype';
import type { Level2Scenario } from '../types/scenario';

export interface GeneratedHarnessStreamCapture {
  id: string;
  label: string;
  collection: 'reviewed' | 'tests';
  archetype?: ScenarioArchetype;
  unavailableReason?: string;
}

export const HARNESS_STREAM_CAPTURE_INDEX: GeneratedHarnessStreamCapture[] = ${JSON.stringify(captures, null, 2)};

export const HARNESS_STREAM_SCENARIOS: Level2Scenario[] = ${JSON.stringify(scenarios, null, 2)};
`;

  writeFileSync(OUT_FILE, header, 'utf-8');
  console.log(`\nWrote ${scenarios.length} playable scenarios and ${captures.length - scenarios.length} visible mapping gaps to ${OUT_FILE}\n`);
  for (const capture of captures) {
    console.log(`  ${capture.id}  → ${capture.archetype ?? 'gap'}${capture.unavailableReason ? ` (${capture.unavailableReason})` : ''}`);
  }
}

main();
