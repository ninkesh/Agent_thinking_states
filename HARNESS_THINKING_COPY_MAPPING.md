# Harness Thinking Copy: Field-to-Information Mapping

## Scope

This document defines copy for the **thinking phase** of the 10 captured
harness cases. It does not define final-answer headlines, card reasons,
follow-up prompts, or CTA copy.

The consumer surface uses four handling classes:

| Class | Meaning |
| --- | --- |
| Show as-is | Exact logged action copy that is relevant to the active task |
| Better logged information | Replace an opaque logged value with a human-readable value already present elsewhere in the log |
| Deterministic UI logic | Format structured logged fields with a fixed, localizable template |
| Developer-only | Preserve the untouched diagnostic for D mode; never render it on the consumer surface |

There is no “weak agent claim” class in thinking. A thinking state describes
an action or an arrived value. It does not make a recommendation or factual
conclusion.

## Data flow

```text
harness stream event
  -> semantic event with raw diagnostic metadata
  -> timestamped status/result arrival
  -> deterministic consumer formatter
  -> ThinkingPass.narration             (consumer)
  -> ThinkingPass.developerNarration    (D mode only)
```

The formatter is implemented in:

- `src/level2/harnessStream/thinkingCopy.ts`
- `src/level2/harnessStream/sourceNativePasses.ts`
- `src/level2/harnessStream/streamToSemanticEvents.ts`

## Field-to-information mapping

| Harness field | Meaning | Consumer use | Developer use |
| --- | --- | --- | --- |
| Manifest `prompt` | User request that started the turn | Relevance check for `text_interim` | Show as captured query |
| `text_interim.text` | Freeform agent action narration | Show verbatim only when action-aligned | Preserve verbatim |
| `insight[subtype=tool_selected].label` | Raw selected-tool label | Never render | `developerNarration` |
| `insight[subtype=tool_selected].detail` | Raw selected-tool detail | Only used through structured tool input; never shown raw | `developerNarration` |
| `tool_use.name` | Tool class | Selects a fixed formatter | Show raw tool class |
| `tool_use.input.query_text` | Product-search query | `Searching products for “{query}”` | Show full input in diagnostics if needed |
| `tool_use.input.query` | Place/web-search query | Tool-specific search template | Show full input in diagnostics if needed |
| Any structured tool-input value matching an earlier `externalId` | Provider entity reference (`place_id`, `product_id`, nested `subject.id`, or a future equivalent) | Preserve the matching entity and render its resolved title | Raw ID remains developer-only |
| `tool_use.input.url` | Fetch target | Join against known source domain; otherwise use hostname | Raw URL remains developer-only |
| `tool_use.input.origin` | Route origin | Route start copy | Show raw input |
| `tool_use.input.destination` | Route destination | Route start copy | Show raw input |
| `tool_use.input.status` | Event temporal scope | Allows `upcoming matches` for `UPCOMING` | Show raw enum |
| `parallel_batch.count` | Simultaneous call count | One coalesced start state | Preserve every raw call |
| `tool_result` product/place arrays | Arrived entities | Exact title/rating/price canvas; derive added/updated count | Raw JSON remains developer-only |
| Enrichment result fields absent from the earlier entity | Newly received consumer information | Add the exact values to the existing tile and name the fields received | Raw result remains developer-only |
| Enrichment result fields equal to the earlier entity | Repeated information | Do not repeat or animate them | Available in the raw result |
| Enrichment result fields different from the earlier entity | Changed consumer information | Update the existing tile and use an `updated` completion | Available in the raw result |
| Web-search titles and URLs | Consulted sources | Exact source labels and cumulative unique source count | Raw URL remains developer-only |
| Route `distance_text` | Logged route distance | Exact result summary | Raw response remains developer-only |
| Route `duration_text` | Logged route duration | Exact result summary | Raw response remains developer-only |
| Result `total` / `count` | Reported result count | Zero/non-zero result copy when no entities exist | Raw count remains available |
| `insight[subtype=tool_done].label` | Raw completion label | Never render | `developerNarration` |
| `insight[subtype=tool_done].detail` | Payload size such as `6008 chars` | Never render | `developerNarration` |
| `tool_selected.ts` | Frontend start-arrival time | `ThinkingPass.loggedAt` for status | Exact timestamp |
| `tool_done.ts` | Frontend result-arrival time | `ThinkingPass.loggedAt` for result | Exact timestamp |
| `insight[subtype=llm_thinking].ts` after the final tool result | Direct synthesis lifecycle signal | Change to deterministic synthesis copy while retaining the latest evidence | Exact timestamp and raw label |

## Start-copy templates

| Tool | Required fields | Consumer template |
| --- | --- | --- |
| `ProductSearch` | `query_text` | `Searching products for “{query}”` |
| `PlaceSearch` | `query` | `Searching places for “{query}”` |
| `PlaceDetails` | `place_id` joined to an earlier title | `Checking details for {title}` |
| Parallel `PlaceDetails` | Each call's `place_id` joined to its title | One `Checking details for {N} places` state with all resolved subjects |
| `WebSearch` | `query` | `Searching the web for “{query}”` |
| Parallel `WebSearch` | Unique query count | `Searching the web across {N} queries` |
| `WebFetch` | URL joined to source label/domain | `Reading {source}` |
| `GetRoute` | `origin` and `destination` | `Checking the route from {origin} to {destination}` |
| `CricketEvents` | `status=UPCOMING` | `Checking upcoming cricket matches` |

If a required field is missing, the formatter returns `undefined`. The UI
keeps the previous real state visible. It does not substitute “Working on it,”
“Checking details,” “Untitled,” or any other fallback.

## Result-copy templates

| Arrived information | Consumer template |
| --- | --- |
| First entity set | `Found {N} {products|places}` |
| New entities after a visible set | `Added {N} more {products|places}` |
| Existing entities gain fields outside an identity-targeted enrichment | `Updated {N} {products|places}` |
| Identity-targeted enrichment adds consumer fields | `{field summary} received for {title}` |
| Identity-targeted enrichment changes a consumer field | `{field summary} updated for {title}` |
| Parallel identity-targeted enrichment | `{field summary} received across {N} {places|products}` |
| Identity-targeted enrichment repeats existing fields only | No completion state |
| First web-source set | `Checked {N} {source|sources}` |
| New unique web sources | `Added {N} more {source|sources}` |
| WebFetch completion | `Read {source}` |
| Route result | `{distance} · {duration}`; omit a missing segment |
| Zero upcoming cricket events | `No upcoming matches found` |
| Zero product/place results | `No products found` / `No places found` |

Payload sizes, tool names, raw IDs, raw URLs, JSON sizes, and internal batch
identifiers never appear in consumer narration.

For example, if search already supplied RNR Biryani's rating, review count,
price, open status, phone number, location and route estimate, and
`PlaceDetails` later supplies only new hours and one review, the result is:

```text
Hours and 1 review received for RNR Biryani - Jayanagar
```

The same tile reveals the exact logged values:

```text
Friday: 11:00 AM – 11:30 PM
5★ · RNR is my go to for donne biryani, great vegetarian options and lovely ambience.
```

It does not repeat the already-known `4.3★`, `6,879 reviews`, price, phone,
open status, distance or travel time.

## Exact interim-copy rule

`text_interim` is shown verbatim only when both conditions hold:

1. It contains an action verb such as search, check, fetch, read, verify,
   refine, find, pull, or build.
2. It shares at least one meaningful task term with the user prompt, active
   tool inputs, or tool-specific context.

Generic work words—such as *details*, *candidates*, *results*, *search*, and
*information*—do not count as task terms.

Example:

```text
Prompt: Find arancini restaurants near me that are open late.
Interim: Now I need to fetch detailed reviews and specifics on spice levels
         and family ambiance for the top candidates.
```

The interim contains an action verb but shares no meaningful task term with
*arancini* or *open late*. It is suppressed. The parallel PlaceDetails batch
then deterministically renders:

```text
Checking details for 4 places
```

This is relevance validation, not factual-claim evaluation.

## Identifier resolution

The adapter maintains the cumulative entities that have reached the frontend.
Provider identifiers are resolved with:

```text
tool_use.input.place_id
  -> prior entity.externalId
  -> prior entity.title
```

If the join succeeds:

```text
Tool → PlaceDetails · ChIJEfXy3cIVrjsRFKH0ilntLN4
  -> Checking details for Chianti, Koramangala
```

If a single-call join fails, no title-specific consumer status is emitted. A
parallel batch may still show its exact request count, but no unresolved card
is fabricated. The raw ID remains available in D mode.

### PlaceDetails selection and transition

A `PlaceDetails` call is also an exact selection signal. The frontend takes
that call's `tool_use.input.place_id` and joins it to the `externalId` values
already received from `PlaceSearch`. Calls in one explicit `parallel_batch`
become one consumer state because the log says they ran simultaneously; every
resolved subject remains individually identified inside that state.

```text
PlaceSearch places[].place_id
  -> normalized entity.externalId
  -> PlaceDetails tool_use.input.place_id
  -> selected thinking tiles
```

Only the resolved tiles named by the active call or batch remain on the
consumer canvas. Unselected search results are not shown as though they were
also being inspected. Each selected tile keeps the same stable entity key, so
it moves into the inspection layout without remounting or refetching its image.
It also replays the neutral inspection sweep; it is not promoted.

Some captures report a larger `total_results` than the number of actual
`places[]` objects included in the result. The total can be narrated, but only
the concrete place objects can become cards. For example, Q06, Q07, and Q10
report 10 results but expose four place objects, and all four are subsequently
sent to one parallel `PlaceDetails` batch. Those cases transition from the four
logged result cards to a four-card inspection state; they never fabricate the
six absent cards or serialize simultaneous calls into a false order.

This means only "selected for detail inspection." It does not mean
"shortlisted," "preferred," "best," or "recommended." If a requested id
cannot be joined to an arrived entity, the frontend does not guess from its
title or position and does not render that unresolved tile.

### Cross-tool element continuity

Tool-local parsed ids are not UI identity. Before rendering adjacent entity
passes, the frontend computes the key as:

```text
externalId present -> `external:${externalId}`
otherwise          -> `local:${parsedEntityId}`
```

The frontend does not maintain a list of accepted id field names. It walks the
structured enrichment input (including nested objects and arrays) and treats a
value as an entity reference only when it exactly matches an `externalId`
previously observed in a tool result. Thus `place_id`, `product_id`, a future
`restaurant_id`, or `{ subject: { id } }` all work without component changes,
while unrelated `request_id` or `user_id` values cannot create continuity.

When the current enrichment call carries a matching external id, the renderer
reuses the existing React key. The tile, its loaded image, and its position
history remain mounted while new logged fields update. This supports
`PlaceSearch -> PlaceDetails`, `ProductSearch -> ProductFetch/ProductDetails`,
and equivalent future entity flows without tool-specific component code.

When several identity-targeted calls run in parallel, their starts coalesce at
the first batch timestamp and their results coalesce at the final batch result
timestamp. All returned data is merged into the canonical entity set, and
`fieldArrivals` stays keyed by each entity's stable local id. Thus one result
state can show the exact new fields beside all four matching cards without a
millisecond sequence such as `Chowman -> Garden Asia -> Shang Palace`.

If neither side exposes the same stable id, continuity is not inferred from
title similarity at the rendering boundary. The new element renders normally.

## Scalable frontend inference boundary

The frontend can scalably describe **observable next actions** with one
central adapter over tool name, structured input, batch identity, and earlier
arrived entities. Individual components should consume the normalized action;
they should not each interpret raw tool names.

| Observable operation | Deterministic frontend state | Required fields |
| --- | --- | --- |
| `PlaceDetails` | `Checking details for {resolved name}` | that call's `place_id` plus earlier entity join |
| `WebFetch` | `Reading {source}` | `url` plus earlier source/domain join |
| `GetRoute` | `Checking the route from {origin} to {destination}` | `origin`, `destination` |
| Parallel searches | `Searching … across {N} queries` | batch id plus unique queries |
| A later search | `Searching … for “{query}”` | the exact new query |
| Tool result arrival | `Found/Added/Updated {N} …` | returned entities and stable ids |

The frontend must not infer intent or judgment from those operations. For
example, `PlaceDetails` proves inspection but not preference; a second search
proves another search but not why the first result was inadequate. Copy such
as "refining because results were irrelevant," "these are the best," or "I
have enough information" requires either action-aligned logged narration or a
new structured assessment event from the agent/backend.

## Delta and duplicate handling

Entity results are merged by provider identity and the existing candidate
resolution rules.

```text
added   = entities not present in the previous visible set
updated = existing entities whose logged fields changed
```

- `added > 0` produces `Found…` or `Added…`.
- `added = 0, updated > 0` produces `Updated…`.
- `added = 0, updated = 0` produces no result state.

### Enrichment field delta

For an identity-targeted call, the adapter first joins the result to the
earlier entity by exact external id. It then compares the arriving value with
the previously arrived value. This comparison is independent of tool names,
so it applies equally to `PlaceDetails`, `ProductFetch`, `ProductDetails`, and
future enrichment operations that use the same identity contract.

```text
exact external-id join
  -> previous normalized entity vs arriving normalized entity
  -> allow-listed consumer field delta
  -> same card + newly arrived facts
```

| Normalized/logged field | Tile value | Completion label |
| --- | --- | --- |
| `availability` / `opening_hours` | Exact logged hours text | `Hours` |
| New `reviews[]` item | `{rating}★ · {exact review text}` | `{N} review(s)` |
| `attributes.editorialSummary` | Exact logged summary | `description` |
| `rating` | `{rating}★` | `rating` |
| `reviewCount` | Localized numeral + `reviews` | `review count` |
| `price` | Exact normalized logged price | `price` |
| `location` | Exact normalized logged location | `location` |
| `distance` | Exact logged distance | `distance` |
| `travelTime` | Exact logged duration | `travel time` |
| `attributes.openNow` | `Open now` / `Currently closed` | `open status` |
| `attributes.phone` | Exact logged phone | `phone number` |
| `attributes.website` / product `ctaUrl` | Exact logged URL | `website` |
| Product `brand` | Exact logged brand | `brand` |
| Product `inStock` | `In stock` / `Out of stock` | `stock status` |
| Product `originalPrice` + currency | Deterministically formatted amount | `original price` |
| Product `categories` | Exact values joined with separators | `categories` |
| Product `gender` | Exact logged value | `gender` |
| Product `vtonEnabled` | Deterministic availability copy | `virtual try-on status` |

Raw ids, coordinates, image transport state, tool metadata, similarity score,
and unknown future fields are deliberately excluded. Images are handled by
the image resolver and may use placeholders when bytes are unavailable; that
is not treated as missing logged information. Unknown fields are not exposed
automatically: they must first be classified and added to this consumer-safe
allow-list.

Long values such as hours, reviews and descriptions use a two-line clamped
detail treatment. On an enrichment-result state, the original entity tile
remains mounted on the left and one `New details` panel enters on its right.
The panel contains only before/after field arrivals; fields already present in
search stay on the original card and are not repeated as discoveries. Changed
values use the heading `Updated details`. The normalized payload retains each
arrival independently; the renderer does not paraphrase review text or
generate a claim about it.

Sources use domain-or-label identity and accumulate uniquely across searches.
This prevents repeated searches from replacing earlier consulted sources or
claiming that duplicate sources are new.

## Parallel-batch handling

Parallel calls normally share one status at the earliest `tool_selected.ts`
and one atomic result at the latest `tool_done.ts`. Result events separated by
only a few milliseconds are not individually readable browser states; every
raw event remains referenced by the combined pass for diagnostics.

This rule includes `PlaceDetails` and other identity-targeted enrichment. The
different ids remain separate inside the batch payload; they do not require a
false visual sequence.

Examples:

```text
4 PlaceDetails starts  -> `Checking details for 4 places`
4 PlaceDetails results -> one per-entity cumulative details state
2 WebSearch starts     -> `Searching the web across 2 queries`
2 WebSearch results    -> `Checked {N concrete sources} across 2 searches`
4 PlaceSearch results  -> `Found {N concrete places} across 4 searches`
```

For a parallel batch with an action-aligned `text_interim`, the exact interim
wins over the deterministic batch template.

## Cumulative rapid results

Later results update stable evidence rather than erasing earlier values:

- Entity and source results already merge cumulatively by stable identity.
- Parallel enrichment results retain a `fieldArrivals` entry for every
  resolved entity in the batch.
- Route results accumulate as logged route summaries. The newest route can
  own the active map while the earlier distance/duration rows remain visible.

This uses explicit batch identity and result type, not case-specific timing
or titles. A 409 ms route result therefore remains available after the next
route arrives without delaying or fabricating either timestamp.

## Final synthesis lifecycle

After the last tool result, a consumer synthesis state is created only when
the harness emits a direct post-tool `llm_thinking` or reasoning lifecycle
marker and at least three seconds remain before trace completion. Raw
reasoning text is never read.

The copy is deterministic and domain-aware—for example, organizing product
options, building a stay plan, or bringing place details into a shortlist.
The payload is the exact last evidence payload already received by the
frontend, so cards, details, routes, and sources stay visible.

When the result and lifecycle marker land within one 60 Hz browser frame
(17 ms), they become one state at the result-arrival timestamp:

```text
Hours, 4 reviews and description received across 4 places.
Bringing these place details into a useful shortlist
```

Both source event ids remain attached for developer provenance. This avoids
an unreadable result flash without inventing a delay or revealing final-answer
content early.

### Search attempts and refinements

Parallel searches within one batch contribute to one result set. A later
batch normally expands the visible set. It replaces the visible search
attempt only when the agent's own action-aligned interim explicitly uses
`refine`, `refined`, or `refining`; disappointing-looking titles alone never
trigger a reset.

The canonical identity pool still retains earlier entities for exact-id joins.
Only the consumer-visible search attempt resets. This lets a future detail
call resolve an earlier provider id without presenting a rejected batch as
though it remained among the refined options.

Q04 therefore renders:

```text
Found 7 products across 2 searches
The initial search returned mostly clothing and shoes ... Let me refine ...
The refined searches found 8 products
```

The first two API responses each report `total: 10`, but expose only four and
three concrete `products[]` objects. The canvas and its narration use the seven
objects the frontend actually received. Reported totals never create absent
cards or a count that contradicts the visible list.

## Expected Q01–Q10 consumer sequences

These are the significant states; entity-detail result lines repeat once per
actual result arrival.

| Case | Consumer thinking sequence |
| --- | --- |
| Q01 | Exact backpack interim -> `Found 10 products` + synthesis |
| Q02 | `Searching the web across 2 queries` -> `Checked 4 sources across 2 searches` -> `Reading…` / `Read…` -> final web search + recipe synthesis |
| Q03 | Exact Rawla Narlai interim -> `Found 1 place` -> resolved details -> Jodhpur route facts -> cumulative Jodhpur/Udaipur route facts + stay-plan synthesis |
| Q04 | Exact initial interim -> `Found 7 products across 2 searches` -> exact refinement interim -> `The refined searches found 8 products` + synthesis |
| Q05 | Exact Matcha interim -> `Found 6 places` + synthesis |
| Q06 | Exact arancini interim -> `Found 4 places` -> one four-place inspection -> cumulative details + synthesis; copied spice/family interim is suppressed |
| Q07 | Exact Lucknowi interim -> `Found 4 places` -> one four-place inspection -> cumulative details + synthesis; copied spice/family interim is suppressed |
| Q08 | Exact Hoi An interim -> `Found 8 places across 4 searches` + synthesis |
| Q09 | Exact cricket interim -> `No upcoming matches found` + synthesis |
| Q10 | Exact tofu interim -> `Found 4 places` -> exact tofu-verification batch -> cumulative details + place-shortlist synthesis |

## Rendering boundary

The consumer experience renders only `ThinkingPass.narration`.

### Discovery-card facts

`Found {N}` cards show up to three logged facts; rating is no longer the one
field that hides every other value. Selection is deterministic and shared
across cases:

1. Fields explicitly requested by the user come first.
2. Remaining slots use entity-appropriate logged facts.
3. Rating and review count are one fact (`4.5★ (6,521)`).
4. Travel time and distance are one fact (`12 min · 5.0 km`).
5. Missing values leave fewer facts; no placeholder copy fills the card.

Place defaults are rating, route, price, current availability, locality and
provider category. Product defaults are price, brand, category, gender and
stock status. Exact request phrases such as `open late`, `late-night`,
`tonight`, `male`, `female`, `boys`, `girls` and `unisex` raise their matching
logged fields in priority.

Provider categories remain fallback context rather than proof of request fit:
`chinese_restaurant` cannot verify a Jiangsu-style tofu dish, and `cafe`
cannot verify a particular drink. Phone numbers, coordinates, raw provider
ids and similarity scores remain off the lightweight thinking card.

The D panel may additionally render:

```text
raw: {ThinkingPass.developerNarration}
```

No consumer component should read `developerNarration`.
