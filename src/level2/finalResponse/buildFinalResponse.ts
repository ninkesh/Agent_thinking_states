import { partitionEnvelope } from '../classification/entityRole';
import type { ParsedEnvelope } from '../normalization/responseEnvelope';
import { firstSentence, normalizeString, stripMarkup } from '../normalization/normalize';
import type { ScenarioArchetype, ScenarioClassification } from '../types/archetype';
import type { NonEntityBlock, NormalizedEntity } from '../types/entity';
import type { QueryRequirements } from '../types/query';
import type { ComparisonDimension } from '../types/pass';
import type {
  ActionRef,
  FactRow,
  FinalResponseModel,
} from '../types/finalResponse';

/* ─────────────────────────────────────────────────────────────────────────────
   LEVEL 2 — Final response construction.

   The final response is the RICHER artifact. Where thinking showed a partial
   view (three of eight candidates, a count, one signal), this carries the
   complete set, the agent's own reasoning, the actions, and the supporting
   information that never belonged in a candidate list.

   Two rules it never breaks:

     1. No winner is invented. `winnerId` is set only when the trace itself
        used an explicit winner badge. Ratings are preserved as facts but are
        never promoted into a verdict by this adapter.
     2. Attributes and supporting blocks never become candidates. They are
        carried in `supporting`, which is real content, shown as context.
   ───────────────────────────────────────────────────────────────────────────── */

const WINNER_BADGE_RE = /\b(top\s*pick|#\s*1|winner|editor'?s?\s*(choice|pick)|our\s*pick|recommended)\b/i;

/** The headline is a LEAD, not the whole answer. Prefer the envelope's own
 *  `<summary>`; otherwise take the first sentence of the opening paragraph so
 *  the body still has something left to say. Returning the whole first
 *  paragraph would make the headline and the body identical, which is exactly
 *  the "thinking and the final response look the same" failure in a different
 *  place. */
function headlineFrom(envelope: ParsedEnvelope, fallback: string): string {
  const summary = normalizeString(stripMarkup(envelope.summary));
  if (summary) return summary;
  const lead = normalizeString(stripMarkup(envelope.prose[0]));
  if (!lead) return fallback;
  return firstSentence(lead) ?? lead.slice(0, 160);
}

/** Body paragraphs with the headline's own text removed, so the lead sentence
 *  is never repeated verbatim immediately below itself. */
function bodyFrom(envelope: ParsedEnvelope, headline: string): string[] {
  const paragraphs = envelope.prose
    .map((p) => normalizeString(stripMarkup(p)))
    .filter((p): p is string => !!p);

  const out: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph === headline) continue;
    if (paragraph.startsWith(headline)) {
      const remainder = normalizeString(paragraph.slice(headline.length));
      if (remainder) out.push(remainder);
      continue;
    }
    out.push(paragraph);
  }
  return out;
}

function actionsFor(entity: NormalizedEntity): ActionRef[] {
  const out: ActionRef[] = [];
  const ctaUrl = entity.attributes?.ctaUrl;
  const ctaLabel = entity.attributes?.ctaLabel;
  if (typeof ctaUrl === 'string' && typeof ctaLabel === 'string') {
    out.push({ label: ctaLabel, url: ctaUrl });
  }
  return out;
}

function factsFor(entity: NormalizedEntity, requirements: QueryRequirements): FactRow[] {
  const rows: FactRow[] = [];
  const push = (label: string, value: unknown) => {
    const v = typeof value === 'number' ? String(value) : normalizeString(value);
    if (v) rows.push({ label, value: v });
  };
  push('Rating', entity.rating != null ? `${entity.rating}${entity.reviewCount ? ` · ${entity.reviewCount} reviews` : ''}` : undefined);
  push('Price', entity.price);
  push('Where', entity.location ?? entity.subtitle);
  push('Hours', typeof entity.availability === 'string' ? entity.availability : undefined);
  push('Travel time', entity.travelTime);
  push('Distance', entity.distance);
  // Anything the prompt explicitly asked for that isn't already covered.
  for (const attr of requirements.requestedAttributes) {
    const extra = entity.attributes?.[attr];
    if (extra != null && !rows.some((r) => r.label.toLowerCase() === attr)) push(attr, extra);
  }
  return rows;
}

/** The winner, only when the trace genuinely distinguishes one. */
export function deriveWinner(
  entities: NormalizedEntity[],
  _requirements: QueryRequirements
): { winner?: NormalizedEntity; rationale?: string; via?: 'badge' } {
  const badged = entities.find((e) => e.judgment && WINNER_BADGE_RE.test(e.judgment));
  if (badged) return { winner: badged, rationale: badged.reasoning, via: 'badge' };
  return {};
}

function dimensionsFromBlocks(blocks: NonEntityBlock[], subjects: Array<{ id: string; label: string }>): ComparisonDimension[] {
  const dimensions: ComparisonDimension[] = [];

  for (const block of blocks) {
    if (!block.title || !block.lines.length) continue;
    const values: Record<string, string> = {};

    for (const line of block.lines) {
      // Real dimension lines are 'Subject: value' — 'Bir Billing: 2,400m
      // takeoff, 30–60 min flights'. Anything else is left out rather than
      // guessed at.
      const m = line.match(/^\s*([^:]{2,60}?)\s*:\s*(.+)$/);
      if (!m) continue;
      const label = m[1].trim().toLowerCase();
      const subject = subjects.find((s) => s.label.toLowerCase().includes(label) || label.includes(s.label.toLowerCase()));
      if (subject) values[subject.id] = m[2].trim();
    }

    if (Object.keys(values).length >= 1) {
      dimensions.push({ key: block.title.toLowerCase().replace(/\s+/g, '_'), label: block.title, values });
    } else {
      // The block compares, but not in a per-subject form this can align.
      // Keep it as an unaligned dimension rather than dropping real content.
      dimensions.push({
        key: block.title.toLowerCase().replace(/\s+/g, '_'),
        label: block.title,
        values: { __all: block.lines.join(' · ') },
      });
    }
  }

  return dimensions;
}

function structuredTable(entities: NormalizedEntity[], supporting: NonEntityBlock[]): { columns: string[]; rows: string[][] } {
  if (entities.length) {
    const columns = ['Name', 'Rating', 'Price', 'When'];
    const rows = entities.map((e) => [
      e.title ?? '—',
      e.rating != null ? String(e.rating) : '—',
      e.price ?? '—',
      typeof e.availability === 'string' ? e.availability : '—',
    ]);
    return { columns, rows };
  }
  // No entities: build the table out of the supporting blocks themselves,
  // which is what a schedule/scores answer actually is.
  const rows = supporting.flatMap((b) => b.lines.map((line) => {
    const m = line.match(/^\s*([^:]{2,60}?)\s*:\s*(.+)$/);
    return m ? [b.title ?? '—', m[1].trim(), m[2].trim()] : [b.title ?? '—', line, ''];
  }));
  return { columns: ['Group', 'Item', 'Detail'], rows };
}

export interface FinalResponseInput {
  envelope: ParsedEnvelope;
  classification: ScenarioClassification;
  requirements: QueryRequirements;
  /** Entities already partitioned by the caller, when it has them. Recomputed
   *  from the envelope otherwise. */
  entities?: NormalizedEntity[];
  supporting?: NonEntityBlock[];
  /** Harness-stream mode: use only text present in the captured response,
   *  including for nested hybrid sections. */
  sourceTextOnly?: boolean;
}

export function buildFinalResponse(input: FinalResponseInput): FinalResponseModel {
  const { envelope, classification, requirements } = input;
  const partitioned = input.entities ? { entities: input.entities, supporting: input.supporting ?? [] } : partitionEnvelope(envelope);
  const { entities, supporting } = partitioned;

  const followUps = envelope.chips.length ? envelope.chips : undefined;
  const base = { followUps, supporting: supporting.length ? supporting : undefined };
  const archetype: ScenarioArchetype = classification.archetype === 'unknown' ? 'text_only' : classification.archetype;

  switch (archetype) {
    case 'text_only': {
      const headline = headlineFrom(envelope, 'Here is what I found');
      return { ...base, kind: 'text', headline, body: bodyFrom(envelope, headline) };
    }

    case 'summary': {
      const headline = headlineFrom(envelope, 'Here is what keeps coming up');
      return {
        ...base,
        kind: 'summary',
        headline,
        takeaways: bodyFrom(envelope, headline).slice(0, 5),
        themes: supporting.map((b) => ({ label: b.title ?? 'Theme', detail: b.lines.join(' · ') })),
      };
    }

    case 'candidate_ranking': {
      const { winner, rationale } = deriveWinner(entities, requirements);
      const headline = headlineFrom(envelope, winner?.title ? `${winner.title} looks like your best fit` : 'Here are the strongest options');
      const trailing = bodyFrom(envelope, headline);
      return {
        ...base,
        kind: 'entity_rail',
        headline,
        summary: trailing.length ? trailing.join('\n\n') : undefined,
        entities,
        winnerId: winner?.id,
        winnerRationale: rationale,
        actions: Object.fromEntries(entities.map((e) => [e.id, actionsFor(e)])),
      };
    }

    case 'list': {
      const headline = headlineFrom(envelope, `${entities.length} options worth a look`);
      const trailing = bodyFrom(envelope, headline);
      return {
        ...base,
        kind: 'list',
        headline,
        summary: trailing.length ? trailing.join('\n\n') : undefined,
        items: entities,
      };
    }

    case 'single_entity': {
      const entity = entities[0];
      if (!entity) {
        const headline = headlineFrom(envelope, 'Here is what I found');
        return { ...base, kind: 'text', headline, body: bodyFrom(envelope, headline) };
      }
      return {
        ...base,
        kind: 'entity',
        headline: headlineFrom(envelope, entity.title ?? 'Here is what I found'),
        entity,
        facts: factsFor(entity, requirements),
        actions: actionsFor(entity),
      };
    }

    case 'comparison': {
      const subjects = entities.map((e) => ({ id: e.id, label: e.title ?? e.id }));
      const dimensionBlocks = supporting.filter((b) => b.role === 'attribute');
      return {
        ...base,
        kind: 'comparison',
        headline: headlineFrom(envelope, 'Side by side'),
        comparison: { subjects, dimensions: dimensionsFromBlocks(dimensionBlocks, subjects) },
        entities,
        // A verdict is only claimed when the agent actually made one.
        verdict: deriveWinner(entities, requirements).winner?.reasoning,
        verdictSubjectId: deriveWinner(entities, requirements).winner?.id,
      };
    }

    case 'route_map': {
      const stops = entities.map((e) => ({ id: e.id, label: e.title ?? e.id, eta: e.travelTime, detail: e.subtitle }));
      return {
        ...base,
        kind: 'route',
        headline: headlineFrom(envelope, 'Here is the route'),
        route: {
          stops,
          origin: undefined,
          destination: stops[stops.length - 1]?.label,
        },
        notes: supporting.flatMap((b) => b.lines),
      };
    }

    case 'structured_no_image': {
      const { columns, rows } = structuredTable(entities, supporting);
      const headline = headlineFrom(envelope, 'Here is the breakdown');
      return {
        ...base,
        kind: 'structured',
        headline,
        columns,
        rows,
        notes: bodyFrom(envelope, headline),
      };
    }

    case 'hybrid': {
      const exactHeadline = headlineFrom(envelope, '');
      const sections: Array<{ title?: string; response: FinalResponseModel }> = [];
      if (entities.length) {
        const { winner, rationale } = deriveWinner(entities, requirements);
        sections.push({
          title: input.sourceTextOnly ? undefined : 'Options',
          response: {
            kind: 'entity_rail',
            headline: input.sourceTextOnly ? exactHeadline : winner?.title ? `${winner.title} leads` : 'The options',
            entities,
            winnerId: winner?.id,
            winnerRationale: rationale,
          },
        });
      }
      if (supporting.length) {
        const { columns, rows } = structuredTable([], supporting);
        sections.push({
          title: input.sourceTextOnly ? undefined : 'Details',
          response: { kind: 'structured', headline: input.sourceTextOnly ? exactHeadline : 'Details', columns, rows },
        });
      }
      return {
        ...base,
        supporting: input.sourceTextOnly ? undefined : base.supporting,
        kind: 'hybrid',
        headline: headlineFrom(envelope, input.sourceTextOnly ? '' : 'Here is the full picture'),
        summary: bodyFrom(envelope, exactHeadline).join('\n\n') || undefined,
        sections,
      };
    }
  }
}
