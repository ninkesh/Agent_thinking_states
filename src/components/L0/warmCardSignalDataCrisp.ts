/**
 * warmCardSignalDataCrisp.ts — compressed reasoning variant for warm_profile_1_crisp.
 *
 * Signals are identical to warmCardSignalData.ts — DO NOT MODIFY signals.
 * Only reasoning has been compressed: same intent, same logic, ~50% length.
 *
 * Rules applied:
 *   - Exactly 2 balanced lines per reasoning block (\n at visual midpoint)
 *   - Same recommendation, same "why now"
 *   - No new angles or interpretations introduced
 */

import type { WarmCardSignalEntry } from './warmCardSignalData';

export const WARM_CARD_SIGNAL_DATA_CRISP: Record<string, WarmCardSignalEntry> = {

  // Card 1 — Sports · Live tonight
  'ws-india-afg': {
    signal1:      "You've liked 12 IPL themed cards across April and May.",
    signal1Hls:   ['12 IPL themed cards'],
    signal2:      "In March we chatted about your T20 fantasy team.",
    signal2Hls:   ['T20 fantasy team'],
    reasoning:    "India vs Afghanistan at Lucknow tonight, first ball at 2pm. I'll set your reminder and surface a fantasy XI before the match.",
    reasoningHls: ['Lucknow tonight', 'first ball at 2pm'],
  },

  // Card 2 — Sports · Local
  'ws-nandi-hills': {
    signal1:      "Three weeks back, you chatted about your first triathlon.",
    signal1Hls:   ['first triathlon'],
    signal2:      "The Garmin 265 and Lazer helmet are on your list.",
    signal2Hls:   ['Garmin 265', 'Lazer helmet'],
    reasoning:    "Hebbal group rolls for the Nandi loop at 4:30am Sunday for 60km, ascent\nat sunrise, back by 9. I'll map your route and add you to their WhatsApp.",
    reasoningHls: ['Nandi loop at 4:30am Sunday', 'ascent at sunrise'],
  },

  // Card 3 — Wellness · Travel
  'ws-om-beach': {
    signal1:      "4 weeks ago, you asked me for a non-touristy Goa weekend.",
    signal1Hls:   ['non-touristy Goa weekend'],
    signal2:      "Vihangama Cafe is bookmarked.",
    signal2Hls:   ['Vihangama Cafe'],
    reasoning:    "Gokarna: 8 hours by road or fly-drive via Hubli. Om Beach is where you should be for the upcoming long weekend. I'll plan it: SwaSwara, sunrise yoga, Vihangama.",
    reasoningHls: ['Om Beach', 'SwaSwara'],
  },

  // Card 4 — Travel · Weekend
  'ws-coorg': {
    signal1:      "Ama Plantation has been on your wishlist since February.",
    signal1Hls:   ['Ama Plantation', 'February'],
    signal2:      "You asked me twice about Indian single-origins.",
    signal2Hls:   ['Indian single-origins'],
    reasoning:    "Attikan won the specialty cup and runs monsoon estate stays. It's six hours out, peak green this fortnight. I'll shortlist Ama and Attikan for two nights.",
    reasoningHls: ['Attikan', 'peak green this fortnight'],
  },

  // Card 5 — Travel · Aspirational
  'ws-amalfi': {
    signal1:      "We've been chatting Amalfi vs. the Greek Islands for late September.",
    signal1Hls:   ['Amalfi vs. the Greek Islands', 'late September'],
    signal2:      "You've liked Aman and Belmond cards.",
    signal2Hls:   ['Aman and Belmond'],
    reasoning:    "September shoulder season - warm, crowds thinned. Le Sirenuse in Positano has a six-night window open now. I'll save it for the trip with your partner.",
    reasoningHls: ['Le Sirenuse in Positano', 'six-night window'],
  },

  // Card 6 — Wellness · Routine
  'ws-wind-down': {
    signal1:      "Two weeks back, you chatted about late screen time and your sleep.",
    signal1Hls:   ['late screen time', 'sleep'],
    signal2:      "Last week, you asked about magnesium glycinate.",
    signal2Hls:   ['magnesium glycinate'],
    reasoning:    "Sleep keeps coming up - I've put together a 30-minute wind-down: lights at 10:15, yoga nidra, screens off at 10:45. Want me to cue it for tonight?",
    reasoningHls: ['30-minute wind-down', 'yoga nidra'],
  },

  // Card 7 — Music · Format
  'ws-vinyl-ritual': {
    signal1:      "Two months back, you asked me how to play your father's 50-year-old records.",
    signal1Hls:   ["father's 50-year-old records"],
    signal2:      "The Pro-Ject turntable is on your list.",
    signal2Hls:   ['Pro-Ject turntable'],
    reasoning:    "The Local runs a Hindi film soundtracks night this Saturday - Aandhi reissue and Rafi pressing first. I'd start there before committing to the turntable.",
    reasoningHls: ['Hindi film soundtracks night this Saturday', 'Aandhi reissue'],
  },

  // Card 8 — Music · Trending
  'ws-gehra-hua': {
    signal1:      "You've liked 3 Peter Cat cards and bookmarked The Local.",
    signal1Hls:   ['Peter Cat', 'The Local'],
    signal2:      "Aswekeepsearching and Tejas run through everything you've been saving.",
    signal2Hls:   ['Aswekeepsearching', 'Tejas'],
    reasoning:    "Gehra Hua - most-played Hindi track this week. Anuv Jain, Bombay-indie. I've built a 14 track playlist: Peter Cat, Aswekeepsearching, Tejas, week's chart.",
    reasoningHls: ['most-played Hindi track', '14 track playlist'],
  },

};
