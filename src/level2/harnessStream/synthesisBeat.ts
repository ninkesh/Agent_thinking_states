import type { SemanticAgentEvent } from '../../types/semanticEvent';
import type { ScenarioClassification } from '../types/archetype';
import type { FinalResponseModel } from '../types/finalResponse';
import type { EntityPreviewPayload, ThinkingPass } from '../types/pass';
import type { QueryRequirements } from '../types/query';

/* ─────────────────────────────────────────────────────────────────────────────
   LEVEL 2 — Log-backed synthesis lifecycle beat.

   The harness emits a direct `llm_thinking` lifecycle insight after the final
   tool result. We use only the existence and timestamp of that marker — never
   its raw reasoning content — to change the consumer phase while the final
   answer is being composed.

   The beat carries forward the last already-visible evidence payload. It does
   not reveal final-response sections, invent a conclusion, or clear the canvas.
   Its traceTiming is anchored to the real lifecycle marker and real trace end.
   ───────────────────────────────────────────────────────────────────────────── */

const MIN_SYNTHESIS_GAP_MS = 3000;

export interface BuildSynthesisBeatInput {
  events: SemanticAgentEvent[];
  requirements: QueryRequirements;
  classification: ScenarioClassification;
  finalResponse: FinalResponseModel;
  prompt?: string;
  /** Most recent payload the frontend had already received. Reused verbatim
   * so synthesis changes the activity line without replacing evidence. */
  lastEvidence?: Pick<ThinkingPass, 'visibility' | 'valueType' | 'payload'>;
}

function evidenceEntityContext(lastEvidence: BuildSynthesisBeatInput['lastEvidence']): string | undefined {
  if (lastEvidence?.valueType !== 'trace_entities' && lastEvidence?.valueType !== 'entity_preview') return undefined;
  const entities = (lastEvidence.payload as EntityPreviewPayload | undefined)?.entities ?? [];
  if (entities.some((entity) => entity.type === 'product')) return 'product';
  if (entities.some((entity) => ['place', 'restaurant', 'hotel', 'destination'].includes(entity.type))) return 'place';
  return undefined;
}

function domainNarration(
  entityType: string | undefined,
  prompt: string | undefined,
  lastEvidence: BuildSynthesisBeatInput['lastEvidence']
): string {
  // A provider-typed entity is stronger than a loose prompt keyword: Q10 asks
  // for a tofu dish but the actual operation is comparing restaurants, not
  // writing a recipe. Explicit extracted entityType remains strongest.
  const context = (entityType ?? evidenceEntityContext(lastEvidence) ?? prompt ?? lastEvidence?.valueType ?? '').toLowerCase();
  if (/recipe|dish|cook/.test(context)) return 'Turning the research into a step-by-step recipe';
  if (/stay|trip|itinerary|plan|hotel|resort/.test(context)) return 'Building the plan around these details';
  if (/restaurant|cafe|bar|place/.test(context)) return 'Bringing these place details into a useful shortlist';
  if (/product|item|gadget/.test(context)) return 'Organizing the options around what matters most';
  if (/route|direction|way|drive/.test(context)) return 'Putting the route details together';
  return 'Bringing the useful details together into a clear answer';
}

function lastConsumerEventEnd(events: SemanticAgentEvent[]): number {
  const visible = events.filter((event) => event.type !== 'internal' && event.type !== 'unknown');
  return visible.length ? Math.max(...visible.map((event) => event.endTime)) : 0;
}

function lifecycleSignalAfter(events: SemanticAgentEvent[], after: number): SemanticAgentEvent | undefined {
  return events
    .filter((event) => {
      if (event.type !== 'internal' || event.startTime < after) return false;
      return event.metadata?.subtype === 'llm_thinking' || event.metadata?.kind === 'reasoning';
    })
    .sort((a, b) => a.startTime - b.startTime)[0];
}

function loggedTimestamp(event: SemanticAgentEvent): number | undefined {
  const value = event.metadata?.loggedTimestamp;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function buildSynthesisBeat(input: BuildSynthesisBeatInput): ThinkingPass[] {
  const { events, requirements, prompt, lastEvidence } = input;
  if (!events.length) return [];

  const traceEnd = Math.max(...events.map((event) => event.endTime));
  const signal = lifecycleSignalAfter(events, lastConsumerEventEnd(events));
  if (!signal || traceEnd - signal.startTime < MIN_SYNTHESIS_GAP_MS) return [];

  const retainedPayload = lastEvidence?.payload && lastEvidence.valueType
    ? { valueType: lastEvidence.valueType, payload: lastEvidence.payload }
    : undefined;
  const signalLoggedAt = loggedTimestamp(signal);

  return [{
    id: `pass-synthesis-${signal.id}`,
    visibility: retainedPayload ? 'canvas_value' : 'status',
    narration: domainNarration(requirements.entityType, prompt, lastEvidence),
    ...(retainedPayload ?? {}),
    sourceEventIds: [signal.id],
    sourceSpanIds: signal.sourceSpanIds,
    confidence: 'high',
    enterDuration: 160,
    holdDuration: 0,
    exitDuration: 0,
    traceTiming: { start: signal.startTime, end: traceEnd },
    ...(signalLoggedAt != null ? { loggedAt: signalLoggedAt } : {}),
  }];
}
