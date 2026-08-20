/**
 * warmProfile2SignalDataCrisp.ts — signal + reasoning for warm_profile_2_crisp.
 *
 * Persona: Ananya — Bangalore, urban professional.
 * Content source: Warm_Feed_Copy_Export.docx
 *
 * Signal rule: 2 strongest signals per card only.
 * Reasoning rule: max 160 characters, no dash separators, natural wrap to ~2 lines.
 */

import type { WarmCardSignalEntry } from './warmCardSignalData';

export const WARM_PROFILE_2_SIGNAL_DATA_CRISP: Record<string, WarmCardSignalEntry> = {

  // Card 1 — Home · Morning
  'wp2-balcony': {
    signal1:      'You asked me about monsoon friendly plants in April.',
    signal1Hls:   ['monsoon friendly plants', 'April'],
    signal2:      'The Sunlite planter set is on your wishlist.',
    signal2Hls:   ['Sunlite planter set'],
    reasoning:    "Lalbagh plant prices climb in eight weeks. I'll pull a starter set of five monsoon plants plus fairy lights, under ₹3,500.",
    reasoningHls: ['Lalbagh plant prices climb', 'five monsoon plants'],
  },

  // Card 2 — Culture · Workshops
  'wp2-gond-art': {
    signal1:      'You bookmarked the Bhajju Shyam show.',
    signal1Hls:   ['Bhajju Shyam show'],
    signal2:      'In May, you asked me about beginner art workshops.',
    signal2Hls:   ['beginner art workshops'],
    reasoning:    "Three studios near you added Saturday Gond drop-ins: ₹1,800, materials included. I'd book the 10am slot - that light is right for Gond.",
    reasoningHls: ['Saturday Gond drop-ins', '10am slot'],
  },

  // Card 3 — Fashion · Festive
  'wp2-gold-stack': {
    signal1:      'The Tanishq Mia capsule is on your wishlist.',
    signal1Hls:   ['Tanishq Mia capsule'],
    signal2:      'You asked me to track the gold prices in March.',
    signal2Hls:   ['track the gold prices', 'March'],
    reasoning:    "Gold dipped to its softest since March - Onam will pull it back. I'll shortlist a chain, cuff, and two ring stack under 8g.",
    reasoningHls: ['softest since March', 'chain, cuff, and two ring stack'],
  },

  // Card 4 — Sports · Live
  'wp2-football': {
    signal1:      'You told me your Domlur 5-a-side is short a sub.',
    signal1Hls:   ['Domlur 5-a-side', 'short a sub'],
    signal2:      "In February, you asked about women's pickup leagues.",
    signal2Hls:   ["women's pickup leagues"],
    reasoning:    "The BWFL runs an open pickup at the Koramangala turf Sunday at 8am. I'll add you to the WhatsApp list and set a 6:30 alarm.",
    reasoningHls: ['Koramangala turf Sunday at 8am', '6:30 alarm'],
  },

  // Card 5 — Food · Recipe
  'wp2-bonda': {
    signal1:      'You liked this card last time.',
    signal1Hls:   ['liked this card last time'],
    signal2:      'We chatted about Karnataka breakfasts beyond idli last month.',
    signal2Hls:   ['Karnataka breakfasts beyond idli'],
    reasoning:    "Five ingredients, 25 minutes, plus a 90 minute curd-rest doing the work. I'll send the recipe to your phone for the weekend.",
    reasoningHls: ['five ingredients, 25 minutes', 'recipe to your phone'],
  },

  // Card 6 — Travel · Day Trip
  'wp2-shivanasamudra': {
    signal1:      'In May, you asked me for monsoon drives within four hours.',
    signal1Hls:   ['monsoon drives within four hours'],
    signal2:      'You bookmarked Avathi and Muthyala Maduvu.',
    signal2Hls:   ['Avathi', 'Muthyala Maduvu'],
    reasoning:    "KRS released 14,200 cusecs yesterday - loudest in three monsoons. I'll plan 6am out day trip, lunch at Talakadu, back by 4.",
    reasoningHls: ['14,200 cusecs yesterday', 'lunch at Talakadu'],
  },

  // Card 7 — Heritage · Photo Walk
  'wp2-vidhana': {
    signal1:      'The Fujifilm X100VI has been on your wishlist six weeks.',
    signal1Hls:   ['Fujifilm X100VI', 'six weeks'],
    signal2:      'You asked me for sunrise spots beyond Nandi.',
    signal2Hls:   ['sunrise spots beyond Nandi'],
    reasoning:    "After last night's rain, the granite plinth is a black mirror. Sunrise is 5:48 - your shot lives in the 30 minutes before traffic.",
    reasoningHls: ['granite plinth is a black mirror', '30 minutes before traffic'],
  },

  // Card 8 — Restaurants · Heritage
  'wp2-sunnys': {
    signal1:      'Last month, you asked where to take your parents - quiet, not loud.',
    signal1Hls:   ['take your parents', 'quiet, not loud'],
    signal2:      'The restaurants you like are too modern for the brief.',
    signal2Hls:   ['too modern for the brief'],
    reasoning:    "Sunny's on Lavelle Road has run eggs benedict and slow coffee since 1990. Tuesday and Wednesday breakfasts are the calmest.",
    reasoningHls: ['eggs benedict and slow coffee since 1990', 'Tuesday and Wednesday'],
  },

  // Card 9 — Coffee · Technique
  'wp2-pour-over': {
    signal1:      'In April, you asked me how to nail pour over at home.',
    signal1Hls:   ['nail pour over at home'],
    signal2:      'The cast-iron kettle is on your wishlist.',
    signal2Hls:   ['cast-iron kettle'],
    reasoning:    "Subko's Indiranagar runs a 45-minute walkthrough Saturday mornings. I'll book the 9am slot - smallest group, technique straight to your kitchen.",
    reasoningHls: ["Subko's Indiranagar", '9am slot'],
  },

  // Card 10 — Pet-friendly · Café
  'wp2-therpup': {
    signal1:      'In May, you asked me which pet cafe in Bangalore is worth it.',
    signal1Hls:   ['pet cafe in Bangalore'],
    signal2:      "CUPA's adoption page is bookmarked.",
    signal2Hls:   ["CUPA's adoption page"],
    reasoning:    'TherPUP in Whitefield: ₹500 an hour, eight resident dogs. The 10am slot averages 4 guests - best just after their morning walk.',
    reasoningHls: ['TherPUP in Whitefield', '10am slot averages 4 guests'],
  },

  // Card 11 — Wellness · Routine
  'wp2-vinyasa': {
    signal1:      'In March, you asked me Iyengar or Ashtanga for a desk job.',
    signal1Hls:   ['Iyengar or Ashtanga', 'desk job'],
    signal2:      'The BKS Iyengar institute is bookmarked.',
    signal2Hls:   ['BKS Iyengar institute'],
    reasoning:    "Iyengar lands cleaner for desk-job shoulders - Cubbon AQI is 22 post-rain. I've cued a 20-minute flow, props-light. Press play and start.",
    reasoningHls: ['desk-job shoulders', 'Cubbon AQI is 22'],
  },

};
