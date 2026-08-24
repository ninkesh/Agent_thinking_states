import { classifyTraceScenario } from '../classification/scenarioClassifier';
import { extractQueryRequirements } from '../classification/queryRequirements';
import { partitionEnvelope } from '../classification/entityRole';
import { parseResponseEnvelope } from '../normalization/responseEnvelope';
import { toNormalizedEntity } from '../normalization/entityBridge';
import { checkDiscoveryInvariants } from '../userValue/discoveryInvariants';
import { resolveCandidateSet } from '../userValue/candidateResolution';
import { partitionByVisibility } from '../userValue/visibility';
import { buildFinalResponse } from '../finalResponse/buildFinalResponse';
import { describeHollowResponse } from '../finalResponse/integrity';
import type { Level2Scenario, ScenarioSource } from '../types/scenario';
import type { ThinkingPass } from '../types/pass';
import { streamToSemanticEvents } from './streamToSemanticEvents';
import { buildTraceSummary } from './traceSummary';
import { buildSourceNativePasses } from './sourceNativePasses';
import { buildSynthesisBeat } from './synthesisBeat';
import type { HarnessTurnEventSource } from './types';

/* ─────────────────────────────────────────────────────────────────────────────
   LEVEL 2 — HarnessTurnEventSource -> Level2Scenario.

   Final-response classification and normalization stay shared with Phoenix.
   Thinking passes intentionally do not use the authored archetype plans:
   harness captures already contain frontend event order, exact status text,
   exact results and insight timestamps. buildSourceNativePasses replays those
   arrivals directly, without adding acknowledge/shortlist content. One
   deterministic synthesis lifecycle state is allowed when the harness itself
   emits a post-tool llm_thinking marker; it retains the last arrived evidence.

   One deliberate omission: no memory-context wiring. Phoenix's
   extractMemoryContext reads a `memory.retrieval` CHILD SPAN this source has
   no equivalent of — skipped rather than faked. If the harness ever emits an
   explicit memory-recall event, this is the one place to add it back.
   ───────────────────────────────────────────────────────────────────────────── */

export interface HarnessStreamScenarioResult {
  scenario?: Level2Scenario;
  rejectedReason?: string;
  diagnostics: {
    eventCount: number;
    internalEventCount: number;
    unrecognizedTools: string[];
    unusableToolOutputs: string[];
    filteredEvents: Array<{ eventId: string; type: string; reason: string }>;
    noRealTimingFound: boolean;
  };
}

/** Two states that begin within one 60Hz render frame cannot both reach the
 * screen. When the logged synthesis lifecycle marker follows the final result
 * that closely, emit one later, fully-grounded state: result copy + synthesis
 * copy, with the result evidence retained and both source events attached. */
function appendSynthesisPasses(passes: ThinkingPass[], synthesis: ThinkingPass[]): ThinkingPass[] {
  if (synthesis.length !== 1 || !passes.length) return [...passes, ...synthesis];
  const last = passes[passes.length - 1];
  const beat = synthesis[0];
  const lastAt = last.traceTiming?.start;
  const beatAt = beat.traceTiming?.start;
  const withinOneRenderFrame = lastAt != null && beatAt != null && beatAt >= lastAt && beatAt - lastAt <= 17;
  if (!withinOneRenderFrame) return [...passes, beat];

  const resultCopy = last.narration.trim().replace(/[.!?]+$/, '');
  return [
    ...passes.slice(0, -1),
    {
      ...beat,
      narration: `${resultCopy}. ${beat.narration}`,
      // The merged state first becomes possible when the result arrives. The
      // lifecycle marker follows within the same browser frame, so retain the
      // evidence arrival's exact frontend timestamp rather than delaying the
      // newly available data to the later bookkeeping insight.
      traceTiming: { start: lastAt, end: beat.traceTiming!.end },
      ...(last.loggedAt != null ? { loggedAt: last.loggedAt } : {}),
      ...(last.developerNarration ? { developerNarration: last.developerNarration } : {}),
      sourceEventIds: [...new Set([...(last.sourceEventIds ?? []), ...(beat.sourceEventIds ?? [])])],
      sourceSpanIds: [...new Set([...(last.sourceSpanIds ?? []), ...(beat.sourceSpanIds ?? [])])],
    },
  ];
}

export function buildScenarioFromHarnessStream(
  turn: HarnessTurnEventSource,
  source: ScenarioSource = 'harness_stream'
): HarnessStreamScenarioResult {
  const summary = buildTraceSummary(turn);
  // spans=[] is deliberate: classifyTraceScenario's image detection also
  // scans `summary.output` directly (see detectImages), which already
  // carries every real image URL this source has via serializeFinalEnvelope
  // — no synthetic PhoenixSpan[] is needed just to satisfy that signature.
  const classification = classifyTraceScenario(summary, []);

  const { events, diagnostics: streamDiag } = streamToSemanticEvents(turn.events);
  const diagnostics: HarnessStreamScenarioResult['diagnostics'] = {
    eventCount: events.length,
    internalEventCount: streamDiag.internalEventCount,
    unrecognizedTools: streamDiag.unrecognizedTools,
    unusableToolOutputs: streamDiag.unusableToolOutputs,
    filteredEvents: [],
    noRealTimingFound: streamDiag.noRealTimingFound,
  };

  if (classification.archetype === 'unknown') {
    return {
      rejectedReason: classification.excludedReason ?? 'Turn does not classify into a Level 2 archetype.',
      diagnostics,
    };
  }

  const requirements = extractQueryRequirements(summary.prompt);
  const envelope = parseResponseEnvelope(summary.output);
  const { entities: parsedEntities, supporting } = partitionEnvelope(envelope);

  // Same backfill fromTrace.ts performs for Phoenix: the final-response
  // parser carries no image; discovery-time tool_result entities do. Here
  // the reason is different (envelopeCardToEntity simply doesn't read the
  // `url` attribute yet, not that Phoenix's output never had one — see
  // serializeFinalEnvelope.ts's header) but the fix is the identical,
  // already-tested pattern.
  const discoveryEntities = events.flatMap((ev) => (ev.entities ?? []).map(toNormalizedEntity));
  const entities = parsedEntities.length
    ? resolveCandidateSet({ observed: discoveryEntities, finalEntities: parsedEntities, preferFinalIdentity: true }).canonical
    : parsedEntities;

  const finalResponse = buildFinalResponse({ envelope, classification, requirements, entities, supporting, sourceTextOnly: true });

  const hollow = describeHollowResponse(finalResponse);
  if (hollow) {
    return { rejectedReason: `Classified ${classification.archetype} but ${hollow}`, diagnostics };
  }

  const passes = buildSourceNativePasses(events, turn.prompt);
  const filtered = partitionByVisibility(events, requirements).invisible.map(({ event, reason }) => ({
    eventId: event.id,
    type: event.type,
    reason,
  }));
  diagnostics.filteredEvents = filtered;
  const traceDurationMs = events.length ? Math.max(...events.map((ev) => ev.endTime)) : undefined;

  if (!passes.length) {
    return { rejectedReason: 'No timestamped consumer-visible harness events were present.', diagnostics };
  }

  const lastEvidence = [...passes].reverse().find((pass) => pass.valueType && pass.payload);
  const synthesis = buildSynthesisBeat({
      events,
      requirements,
      classification,
      finalResponse,
      prompt: turn.prompt,
      ...(lastEvidence
        ? {
            lastEvidence: {
              visibility: lastEvidence.visibility,
              valueType: lastEvidence.valueType,
              payload: lastEvidence.payload,
            },
          }
        : {}),
    });
  const allPasses = appendSynthesisPasses(passes, synthesis);

  const invariantWarnings = checkDiscoveryInvariants(allPasses);

  const scenario: Level2Scenario = {
    id: `harness-${turn.turnId}`,
    archetype: classification.archetype,
    prompt: turn.prompt,
    domain: summary.skills[0] ?? 'general',
    source,
    traceId: turn.turnId,
    thinkingPasses: allPasses,
    finalResponse,
    classification,
    requirements,
    metadata: {
      toolSequence: summary.toolSequence,
      skills: summary.skills,
      latencyMs: summary.latencyMs,
      entityCount: entities.length,
      supportingCount: supporting.length,
      filteredEvents: filtered,
      unrecognizedTools: streamDiag.unrecognizedTools,
      internalEventCount: streamDiag.internalEventCount,
      invariantWarnings,
      noRealTimingFound: streamDiag.noRealTimingFound,
      ...(traceDurationMs != null ? { traceDurationMs } : {}),
    },
  };

  return { scenario, diagnostics };
}
