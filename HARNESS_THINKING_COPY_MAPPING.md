# Frontend Guide: Harness Thinking States

## Purpose

This is the implementation contract for turning the harness event stream into
consumer-visible thinking states.

It answers five frontend questions:

1. Which log fields are safe to show?
2. Which copy is verbatim, formatted, inferred, or developer-only?
3. When does the UI create, merge, update, or omit a state?
4. How does an entity remain the same card across different tool calls?
5. What should happen when logged information is missing or inaccessible?

The rules are data-driven. They do not contain capture-specific conditionals and should
work for future places, products, routes, sources, and enrichment tools that
follow the same event contracts.

## Checked-in capture collections

The developer selector exposes two real harness-stream collections:

- `Reviewed`: the original 10 captures used to establish the mapping contract.
- `Tests`: 20 additional captures, shown 10 per page in D mode.

All capture prompts are verbatim from their manifests. Test capture IDs use a
`test-` prefix internally so they cannot collide with reviewed IDs. Harness
captures always replay on their logged timestamps; no demo clock is substituted.

The delivered Tests files contained thousands of raw `reasoning` token chunks.
The checked-in copies omit only those chunks because the adapter never consumes
or renders chain of thought. Tool calls/results, insights, timestamps, interim
and final responses, errors, and completion events remain intact.

Mapping failures are indexed rather than hidden or replaced with fallback UI.
At this update, 16 Tests captures are playable and four are explicit gaps:

- `test-q03`: the run ends with a context-window error and no final response.
- `test-q11`: the final response blocks are empty.
- `test-q14`: no timestamped consumer-visible thinking event is available.
- `test-q19`: the classified hybrid shape has fewer than two output forms.

## Non-negotiable rules

| Rule | Frontend behavior |
| --- | --- |
| Use arrived information only | A fact can render only after its result event reaches the frontend. |
| Do not fill missing fields | If the log has no value, omit the field, card, or state. Do not invent fallback text. |
| Distinguish missing from inaccessible | A logged image reference may use a placeholder when its bytes cannot be fetched. The image is known but inaccessible. |
| Keep raw diagnostics out of consumer UI | Tool names, provider IDs, URLs, payload sizes, batch IDs, and internal reasoning remain developer-only. |
| Never expose chain of thought | A reasoning or `llm_thinking` event may drive phase/timing, but its reasoning content is never rendered. |
| Preserve event time | Status and result states use the timestamps at which those events reached the frontend. |
| Preserve identity | Search and detail results with the same provider ID update the same visual element. |
| Do not serialize parallel work | One explicit parallel batch becomes one status and one result state, not one state per call. |

## Copy provenance: know what the user is reading

Every consumer sentence belongs to one of these categories. Frontend code and
reviews should use these names consistently.

| Category | Meaning | Example |
| --- | --- | --- |
| `LOGGED_VERBATIM` | Exact agent text from `text_interim`, after relevance validation | `Pulling up school backpacks for both boys and girls now.` |
| `LOGGED_FORMATTED` | Fixed template populated only with structured logged values | `Found 10 products` |
| `UI_PROCESS_COPY` | Frontend-authored process sentence based on deterministic state logic | `Organizing the options around what matters most` |
| `DEVELOPER_ONLY` | Untouched raw diagnostic, visible only in D mode | `Tool done: PlaceDetails · 6008 chars` |

### Important: synthesis copy is not verbatim log text

The following current sentences are `UI_PROCESS_COPY`:

- `Turning the research into a step-by-step recipe`
- `Building the plan around these details`
- `Bringing these place details into a useful shortlist`
- `Organizing the options around what matters most`
- `Putting the route details together`
- `Bringing the useful details together into a clear answer`

The log provides only the lifecycle signal and time, for example:

```text
insight.subtype = llm_thinking
insight.label   = LLM thinking…
insight.ts      = 1787127669796
```

The frontend selects the domain-specific sentence locally. Therefore:

- the phase and timestamp are log-backed;
- the sentence itself is frontend-authored;
- the sentence describes process only and must never add a factual claim;
- if product policy changes to strict verbatim-only copy, remove this sentence
  and use the lifecycle marker only for visual activity while retaining the
  previous evidence.

## End-to-end data flow

```text
HarnessStreamEvent
  -> streamToSemanticEvents
  -> SemanticAgentEvent
  -> sourceNativePasses arrival timeline
  -> ThinkingPass
  -> runtime schedule
  -> renderer selected by valueType
```

The important objects are:

```ts
interface SemanticAgentEvent {
  id: string;
  type: 'search' | 'retrieve' | 'enrichment' | 'maps' | 'internal' | ...;
  startTime: number;   // relative trace time
  endTime: number;     // relative trace time
  input?: unknown;
  entities?: ExtractedEntity[];
  metadata?: {
    tool?: string;
    parallelGroup?: number;
    interimText?: string;
    loggedStartTimestamp?: number;
    loggedResultTimestamp?: number;
    loggedTimestamp?: number;
    // normalized result metadata, sources, route values, etc.
  };
}

interface ThinkingPass {
  id: string;
  narration: string;             // consumer copy only
  developerNarration?: string;   // D mode only
  valueType?: ThinkingValueType;
  payload?: ThinkingPayload;
  sourceEventIds?: string[];
  traceTiming?: { start: number; end: number };
  loggedAt?: number;              // absolute frontend-arrival timestamp
}
```

## Raw event mapping

| Harness event | Semantic meaning | Consumer use |
| --- | --- | --- |
| `text_interim` | Agent action narration | Candidate for `LOGGED_VERBATIM` start copy |
| `tool_use` + `tool_selected` insight | Operation started | Status state and exact start time |
| `tool_result` + `tool_done` insight | Information arrived | Result state, payload, and exact result time |
| `parallel_batch` | Calls were simultaneous | Group membership; never consumer copy |
| `reasoning` | Internal model reasoning | Timing/diagnostics only; text never shown |
| `insight[subtype=llm_thinking]` | Model entered a thinking lifecycle phase | May trigger synthesis process state |
| `text_final` / `text_replace` | Final response | Final-answer pipeline, not thinking narration |
| `turn_complete`, token usage, skills, guardrails | Internal lifecycle/diagnostics | Developer-only |

## Tool classification

Tool classification happens once in the adapter. Components consume semantic
events and typed payloads; they must not interpret tool names independently.

| Tool family | Semantic type | Consumer operation |
| --- | --- | --- |
| `ProductSearch` | `search` | Product discovery |
| `PlaceSearch`, `NearbyPlaces` | `search` | Place discovery |
| `PlaceDetails`, `PlaceReviews` | `enrichment` | Add information to known places |
| `ProductDetails`, `ProductFetch` | `enrichment` | Add information to known products |
| `WebSearch` | `retrieve` | Find sources |
| `WebFetch` | `retrieve` | Read one known source |
| `GetRoute`, directions, distance tools | `maps` | Route calculation |
| `CricketEvents` and equivalent event tools | `search` | Event discovery |
| Unknown tool | `unknown` | Developer diagnostics; no guessed consumer state |

## Start-state copy mapping

The formatter first tries an action-aligned `text_interim`. If it cannot use
that text safely, it uses the fixed mapping below. If required fields are
missing, it emits no state.

| Operation | Required logged information | Consumer copy | Provenance |
| --- | --- | --- | --- |
| Product search | `input.query_text` | `Searching products for “{query}”` | `LOGGED_FORMATTED` |
| Place search | `input.query` | `Searching places for “{query}”` | `LOGGED_FORMATTED` |
| Web search | `input.query` | `Searching the web for “{query}”` | `LOGGED_FORMATTED` |
| Parallel search | Explicit batch + unique queries | `Searching {domain} across {N} queries` | `LOGGED_FORMATTED` |
| Single entity enrichment | Input ID joined to prior entity title | `Checking details for {title}` | `LOGGED_FORMATTED` |
| Parallel place enrichment | Batch + resolved IDs | `Checking details for {N} places` | `LOGGED_FORMATTED` |
| Parallel product enrichment | Batch + resolved IDs | `Checking details for {N} products` | `LOGGED_FORMATTED` |
| Web fetch | URL joined to a prior source/domain | `Reading {source}` | `LOGGED_FORMATTED` |
| Route | `origin` + `destination` | `Checking the route from {origin} to {destination}` | `LOGGED_FORMATTED` |
| Upcoming events | `status=UPCOMING` | `Checking upcoming cricket matches` | `LOGGED_FORMATTED` |

### Verbatim interim acceptance rule

`text_interim.text` is used as-is only when both are true:

1. It contains an action verb such as search, check, fetch, read, verify,
   refine, find, pull, or build.
2. It shares a meaningful task term with the prompt, current tool input, or
   tool domain.

Generic words such as `details`, `results`, `candidates`, and `information`
do not prove relevance.

Example of a suppressed copied interim:

```text
Prompt:  Find arancini restaurants near me that are open late.
Interim: Fetching reviews about spice levels and family ambiance.
```

The text is action-shaped but not aligned with `arancini` or `open late`. The
frontend drops it and formats the actual four-place details batch instead.

## Result-state copy mapping

| Arrived information | Consumer copy | Provenance |
| --- | --- | --- |
| First concrete entity set | `Found {N} {products|places}` | `LOGGED_FORMATTED` |
| Parallel search entity set | `Found {N} {products|places} across {S} searches` | `LOGGED_FORMATTED` |
| Additional concrete entities | `Added {N} more {products|places}` | `LOGGED_FORMATTED` |
| Explicit refinement result | `The refined {search|searches} found {N} …` | `LOGGED_FORMATTED`; refinement word must come from aligned interim |
| Known entities changed | `Updated {N} {products|places}` | `LOGGED_FORMATTED` |
| Single enrichment result | `{field summary} received for {title}` | `LOGGED_FORMATTED` |
| Parallel enrichment result | `{field summary} received across {N} {places|products}` | `LOGGED_FORMATTED` |
| First source set | `Checked {N} sources` | `LOGGED_FORMATTED` |
| Additional source set | `Found {N} additional sources` | `LOGGED_FORMATTED` |
| Duplicate source set | `Rechecked {N} sources` | `LOGGED_FORMATTED` |
| Web fetch completed | `Read {source}` | `LOGGED_FORMATTED` |
| Route result | `{distance} · {duration}` | `LOGGED_FORMATTED` |
| Explicit zero place/product result | `No places found` / `No products found` | `LOGGED_FORMATTED` |
| Explicit zero upcoming events | `No upcoming matches found` | `LOGGED_FORMATTED` |
| Duplicate result with no new visible value | No new state | — |

Counts use concrete arrays delivered to the frontend, not a larger provider
`total` when the corresponding objects are absent. Ten reported matches with
four delivered `places[]` objects produces four cards, never ten placeholders.

## Entity identity and card persistence

### Provider identity is the contract

Search results become normalized entities with a stable provider ID:

```text
PlaceSearch.places[].place_id
  -> NormalizedEntity.externalId
  -> PlaceDetails.input.place_id
  -> same NormalizedEntity
  -> same rendered card
```

The adapter does not maintain a hard-coded list of possible ID field names.
It walks structured enrichment input and treats a string as an entity reference
only when it exactly matches an `externalId` previously received in a result.

This supports current and future shapes such as:

```text
place_id
product_id
restaurant_id
{ subject: { id: "provider-id" } }
```

It prevents unrelated `request_id` or `user_id` values from creating identity.

### Render key

```text
externalId exists -> external:{externalId}
otherwise         -> local:{normalizedEntity.id}
```

Never use array position or a newly parsed tool-local ID as the React key.
The stable key preserves the existing image, DOM element, and layout history
while details arrive.

### Failed identity join

If the enrichment input ID cannot be joined to a known entity:

- do not guess by title similarity or rank;
- do not show an `Untitled` card;
- omit the entity-specific consumer state;
- retain the raw ID in developer diagnostics.

## Parallel batching

An explicit `parallelGroup` is one agent action.

```text
status time = earliest tool_selected timestamp in the group
result time = latest tool_done timestamp in the group
```

The combined pass retains every member in `sourceEventIds`.

For parallel enrichment:

- resolve every input ID against known entities;
- render only those selected entities;
- keep one `inspectionIds` entry per selected card;
- merge all results at the final group arrival;
- keep new field values keyed by entity ID.

This avoids impossible 0-4 ms sequences and false ordering such as:

```text
Chowman -> Garden Asia -> Shang Palace -> China Pearl
```

when the log says all four calls ran simultaneously.

## Cumulative result behavior

### Entities

Entity sets merge by stable identity. A later result updates the known entity
instead of replacing its card.

### Sources

Sources merge by normalized domain or label. Duplicate domains are rechecked,
not counted as newly discovered sources.

### Routes

Each route keeps its exact origin, destination, distance, and duration. The
newest route may own the active map, while `payload.alternates` retains all
logged route summaries in a compact `Routes checked` ledger.

### Search refinement

A later search replaces the visible search attempt only when an aligned
interim explicitly says `refine`, `refined`, or `refining`. Result quality is
not inferred from titles. The canonical identity pool still retains earlier
entities for future exact-ID joins.

## Enrichment field-delta mapping

The detail panel shows only consumer-safe values that are new or changed
relative to the earlier version of the same entity.

| Logged/normalized field | Display value | Summary label |
| --- | --- | --- |
| `availability` / `opening_hours` | Exact logged hours | `Hours` |
| New `reviews[]` entry | `{rating}★ · {exact review text}` | `{N} review(s)` |
| `attributes.editorialSummary` | Exact summary | `description` |
| `rating` | `{rating}★` | `rating` |
| `reviewCount` | Localized count + `reviews` | `review count` |
| `price` | Exact normalized price | `price` |
| `location` | Exact location | `location` |
| `distance` | Exact distance | `distance` |
| `travelTime` | Exact duration | `travel time` |
| `attributes.openNow` | `Open now` / `Currently closed` | `open status` |
| `attributes.phone` | Exact phone | `phone number` |
| `attributes.website` / `ctaUrl` | Exact URL | `website` |
| Product `brand` | Exact brand | `brand` |
| Product `inStock` | `In stock` / `Out of stock` | `stock status` |
| Product `originalPrice` + currency | Deterministically formatted amount | `original price` |
| Product `categories` | Exact values joined with separators | `categories` |
| Product `gender` | Exact value | `gender` |
| Product `vtonEnabled` | Availability sentence | `virtual try-on status` |

Explicitly excluded fields include provider IDs, coordinates, raw tool
metadata, similarity scores, payload sizes, and unclassified future fields.
A future field must be reviewed and added to this allow-list before it can
reach consumer UI.

Delta rules:

```text
arriving value absent                  -> ignore
arriving value equals previous value   -> ignore
previous absent, arriving present      -> change = added
previous present, arriving different   -> change = changed
```

The detail panel renders to the right of the original tile. It must not repeat
rating, price, location, or other values that were already visible before the
detail call.

## Discovery-card fact selection

Found cards show at most three logged facts.

Priority:

1. Fields explicitly requested in the user prompt.
2. Entity-appropriate defaults.
3. Fewer facts when values are absent; never placeholder facts.

Formatting rules:

- rating and review count combine as `4.5★ (6,521)`;
- travel time and distance combine as `12 min · 5.0 km`;
- place defaults include rating, route, price, availability, locality, and
  provider category;
- product defaults include price, brand, category, gender, and stock status;
- provider categories are context, not proof that a place serves a requested
  dish or that a product satisfies an unlogged property.

## Image handling

Image behavior is intentionally different from missing text behavior.

```text
logged ordinary image URL
  -> try exact URL

logged places/{PLACE_ID}/photos/{PHOTO_REF}
  -> /api/glance-media?name={encoded ref}&maxWidth={width}
  -> server adds Authorization and X-Account-ID

bytes unavailable / auth absent / stale ref
  -> placeholder image is allowed
```

Rules:

- never put a JWT or account ID in browser code or a query parameter;
- never commit credentials;
- use `GLANCE_MEDIA_JWT` and `GLANCE_ACCOUNT_ID` server-side only;
- an inaccessible logged image does not mean the entity lacks an image;
- placeholder images must not be described as the actual venue/product photo.

## Timing and lifecycle

### Timestamp fields

| State | Absolute `loggedAt` | Relative `traceTiming.start` |
| --- | --- | --- |
| Tool status | `tool_selected.ts` | selected timestamp minus first trace timestamp |
| Tool result | `tool_done.ts` | completed timestamp minus first trace timestamp |
| Parallel status | Earliest selected timestamp | Earliest grouped relative start |
| Parallel result | Latest completed timestamp | Latest grouped relative end |
| Synthesis lifecycle | Post-tool `llm_thinking.ts` unless merged within one frame | Relative lifecycle time |

The scheduler keeps the current state visible until the next state starts. It
does not invent intermediate consumer states to fill a quiet period.

### Same-frame result and synthesis

The final result and `llm_thinking` marker often arrive 5-14 ms apart. A 60 Hz
display cannot render both states. If they are no more than 17 ms apart:

- create one combined state;
- keep the exact result-arrival timestamp;
- retain both result and lifecycle event IDs;
- keep the result evidence payload;
- combine result copy and `UI_PROCESS_COPY` in one line.

Example:

```text
Found 10 products. Organizing the options around what matters most
```

The first sentence is `LOGGED_FORMATTED`; the second is `UI_PROCESS_COPY`.

### Synthesis mapping precedence

Current selection order:

```text
explicit requirements.entityType
  -> provider-typed entity evidence (place or product)
  -> prompt keyword
  -> current valueType
  -> generic
```

Provider-typed evidence outranks loose prompt keywords. For example, Q10 asks
for a tofu dish but the tool results are restaurants, so the UI uses place
shortlist process copy, not recipe process copy.

## Missing and inaccessible information matrix

| Situation | Consumer behavior |
| --- | --- |
| Field absent from logs | Drop the field |
| Entity array absent | Do not create cards |
| Reported total exceeds concrete objects | Show only concrete cards |
| Required copy input absent | Omit that state and retain the previous one |
| Entity ID cannot be resolved | Omit entity-specific status/card |
| Duplicate result adds no value | No new state |
| Unknown tool or field | Developer-only until mapped |
| Raw reasoning exists | Never show its content |
| Logged image exists but cannot be fetched | Use a placeholder image |
| Explicit zero result exists | Show the deterministic zero-result state |

Avoid fallback consumer copy such as `Working on it`, `Checking details`,
`Untitled`, or fabricated descriptions. A neutral animation can communicate
activity without claiming unavailable information.

## Rendering contract

| `valueType` | Expected rendering behavior |
| --- | --- |
| `trace_entities` | Stable entity tiles, exact selected IDs, optional per-entity detail arrivals |
| `sources` | Cumulative unique source chips/count |
| `route` | Latest map/summary plus accumulated route ledger |
| `count` | Exact compact count, never a fabricated card set |
| No payload | Narration and neutral activity treatment only |

Consumer components may read:

```text
ThinkingPass.narration
ThinkingPass.valueType
ThinkingPass.payload
```

Consumer components must not read:

```text
ThinkingPass.developerNarration
raw tool input/output
internal reasoning text
provider diagnostics
```

## Worked examples

### Parallel place details

```text
PlaceSearch result: 4 concrete places
  -> Found 4 places

parallel_batch: 4 PlaceDetails calls
  -> Checking details for 4 places
  -> render the same four cards by externalId

final grouped result
  -> Hours, 4 reviews and description received across 4 places
  -> attach each exact field arrival to its matching card
```

### Two rapid routes

```text
Jodhpur result -> 130 km · 2 hours 26 mins
Udaipur result -> 122 km · 2 hours 26 mins

final route payload.alternates:
  Jodhpur -> Rawla Narlai   130 km · 2 hours 26 mins
  Udaipur -> Rawla Narlai   122 km · 2 hours 26 mins
```

The second result updates one stable route canvas; it does not erase the first
summary.

### Search-to-detail continuity

```text
search entity.externalId = ChIJ...
detail input.place_id     = ChIJ...

same externalId
  -> same React key
  -> same valueType-scoped canvas key
  -> same image instance
  -> existing card moves into inspection layout
  -> newly arrived hours/reviews render beside it
```

The shared `thinkingCanvasRenderKey` rule applies to both thinking experiences.
`entity_preview`, `trace_entities`, `sources`, and `route` keep a stable canvas
key across passes; transient count/text/status renderers remain keyed by pass.
Do not recreate this rule inside a route component.

## Implementation ownership

| Concern | File |
| --- | --- |
| Raw harness event parsing and timestamps | `src/level2/harnessStream/streamToSemanticEvents.ts` |
| Consumer and developer copy formatting | `src/level2/harnessStream/thinkingCopy.ts` |
| Arrival grouping, identity merge, deltas, cumulative payloads | `src/level2/harnessStream/sourceNativePasses.ts` |
| Scenario assembly and same-frame synthesis merge | `src/level2/harnessStream/buildScenarioFromHarnessStream.ts` |
| Synthesis lifecycle and `UI_PROCESS_COPY` | `src/level2/harnessStream/synthesisBeat.ts` |
| Stable entity keys | `src/level2/normalization/entityBridge.ts` |
| Persistent canvas render keys | `src/level2/renderers/renderKey.ts` |
| Discovery-card fact selection | `src/level2/renderers/entityFacts.ts` |
| Thinking renderer selection | `src/level2/renderers/registry.ts` |
| Entity detail panel | `src/components/AgentThinkingTrace/level2/EntityDetailArrivalPanel.tsx` |
| Entity and source rendering | `src/components/AgentThinkingTrace/level2/ThinkingValueRenderers.tsx` |
| Cumulative route rendering | `src/components/AgentThinkingTrace/level2/MapThinkingStage.tsx` |
| Real timestamp scheduling | `src/level2/runtime/schedule.ts` |
| Playback lifecycle | `src/level2/runtime/useLevel2Runtime.ts` |
| Authenticated image proxy client | `src/api/glanceMediaClient.ts` and `vite.config.ts` |
| Generated ten-case scenario data | `src/level2/scenarios/harnessStreamScenarios.ts` |

## Adding a new tool or field

Before consumer UI can use it:

1. Classify the tool into a semantic event type.
2. Extract only structured values actually present in the result.
3. Decide whether each value is consumer-safe or developer-only.
4. Add deterministic copy only when its required inputs are explicit.
5. Define stable identity if the result updates an existing entity.
6. Define parallel grouping behavior.
7. Define duplicate and cumulative merge behavior.
8. Add the field to the enrichment allow-list if applicable.
9. Add adapter, copy, timing, and renderer tests.
10. Regenerate the harness scenarios and verify no sub-animation states return.

Do not add a component-local interpretation of raw tool data. Extend the
central adapter and typed payload contract instead.

## Verification

```bash
./node_modules/.bin/vitest run
npm run build
git diff --check
```

Current baseline at the time of this document update:

- 22 test files and 333 tests passing;
- production TypeScript/Vite build passing;
- 30 captures indexed: 10 Reviewed and 20 Tests;
- 26 playable scenarios and four visible mapping gaps;
- 83 generated thinking states across the 26 playable scenarios.
