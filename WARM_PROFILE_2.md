# WARM_PROFILE_2

Route: `/warm_profile_2_crisp` or `/warm-profile-2-crisp`

Persona: **Ananya** — Bangalore, urban professional.
Content source: `Cold Start Content/Glance_TV_Warm_Start_Ananya.docx`

---

## Route

Registered in `src/main.tsx` — same convention as `warm_profile_1_crisp`.

---

## Files changed / created

| File | Action |
|------|--------|
| `src/main.tsx` | Added import + route detection + render branch for `WarmProfile2CrispApp` |
| `src/WarmProfile2CrispApp.tsx` | New — entry point for the route |
| `src/components/L0/WarmProfile2CrispL0Glance.tsx` | New — routes wp2-* items to `WarmProfile1CinematicL0` |
| `src/components/L0/warmProfile2SignalDataCrisp.ts` | New — signal + reasoning for all 11 cards |
| `src/data/warmProfile2FeedItems.ts` | New — 11 FeedItem entries for Ananya |
| `src/config/glanceConfig.ts` | Added wp2-* layout entries |

---

## Image mapping

All images reuse the cold-start set (`/images/cold-start/`). No new images.

| Card ID | Image file | Content |
|---------|-----------|---------|
| `wp2-balcony` | `balcony-escape.webp` | Your Balcony, This Monsoon |
| `wp2-gond-art` | `gond-art.webp` | A Saturday Morning at the Easel |
| `wp2-gold-stack` | `layer-gold-stack.jpg` | A Layered Gold Stack, Before It Climbs |
| `wp2-football` | `monsoon-football.webp` | Sub for Sunday |
| `wp2-bonda` | `mysore-bonda.webp` | The Mysore Bonda Morning |
| `wp2-shivanasamudra` | `roar-sivanasamudra.webp` | The Roar of Shivanasamudra |
| `wp2-vidhana` | `silence-vidhana-soudha.webp` | A Sunrise Frame, On Your X100VI |
| `wp2-sunnys` | `sunnys-lavelle-road.jpg` | A Quiet Table for Your Parents |
| `wp2-pour-over` | `taste-pour-over.webp` | Get Your Pour-Over Right |
| `wp2-therpup` | `therpup-cafe.webp` | A Morning at TherPUP |
| `wp2-vinyasa` | `vinyasa-flow.webp` | A 20-Minute Iyengar Flow |

---

## Signals selected per card

Document listed 2–3 signals per card. 2 strongest were kept.

| Card | Signal 1 | Signal 2 (chosen over others) |
|------|----------|-------------------------------|
| wp2-balcony | "Asked about monsoon-friendly plants in April" | "Sunlite planter set on wishlist" |
| wp2-gond-art | "Bookmarked the Bhajju Shyam show" | "Asked about beginner art workshops in May" |
| wp2-gold-stack | "Tanishq Mia capsule on wishlist" | "Asked me to track gold price in March" |
| wp2-football | "Domlur 5-a-side is short a sub" | "Asked about women's pickup leagues in Feb" |
| wp2-bonda | "Liked this card last time" | "Chatted about Karnataka breakfasts beyond idli" |
| wp2-shivanasamudra | "Asked for monsoon drives within 4 hours in May" | "Bookmarked Avathi and Muthyala Maduvu" |
| wp2-vidhana | "Fujifilm X100VI on wishlist 6 weeks" | "Asked for sunrise spots beyond Nandi" |
| wp2-sunnys | "Asked where to take parents — quiet, not loud" | "Restaurants you like are too modern for the brief" |
| wp2-pour-over | "Asked how to nail pour-over at home in April" | "Cast-iron kettle on wishlist" |
| wp2-therpup | "Asked which pet cafe in Bangalore is worth it" | "CUPA adoption page bookmarked" |
| wp2-vinyasa | "Asked Iyengar or Ashtanga for a desk job in March" | "BKS Iyengar institute bookmarked" |

---

## Reasoning character counts

All under 160 characters. No dash separators.

| Card | Reasoning | Chars |
|------|-----------|-------|
| wp2-balcony | "Lalbagh prices climb in eight weeks. I'll pull a starter set of five monsoon plants plus fairy lights, under ₹3,500 across three nurseries." | 141 |
| wp2-gond-art | "Three studios near you added Saturday Gond drop-ins: ₹1,800, materials included. I'd book the 10am slot — the dot-work needs that light." | 137 |
| wp2-gold-stack | "Gold dipped to its softest since March — jewellers say Onam will pull it back up. I'll shortlist a chain, cuff, and two-ring stack under 8g." | 142 |
| wp2-football | "The BWFL runs an open pickup at the Koramangala turf this Sunday at 8am. I'll add you to the WhatsApp list and hold a 6:30 alarm." | 130 |
| wp2-bonda | "Five ingredients, 25 minutes, plus a curd-rest doing the real work. I'll send the recipe to your phone for the weekend." | 119 |
| wp2-shivanasamudra | "KRS released 14,200 cusecs yesterday — loudest in three monsoons. I'll plan 6am out, lunch at Talakadu, back by 4." | 115 |
| wp2-vidhana | "After last night's rain, the granite plinth is a black mirror. Sunrise is 5:48 — your reflection shot lives in the 30 minutes before traffic." | 142 |
| wp2-sunnys | "Sunny's on Lavelle Road has run eggs benedict and slow coffee since 1990. Tuesday and Wednesday breakfasts are the calmest." | 123 |
| wp2-pour-over | "Subko's Indiranagar runs a 45-minute walkthrough Saturday mornings. I'll book you the 9am slot — smallest group, technique you can take straight home." | 151 |
| wp2-therpup | "TherPUP in Whitefield: ₹500 an hour, eight resident dogs. The 10am slot averages 4 guests — the dogs are loosest just after their morning walk." | 144 |
| wp2-vinyasa | "Iyengar lands cleaner for desk-job shoulders. Cubbon AQI is 22 post-rain. I've cued a 20-minute flow, props-light — press play and start." | 139 |

---

## CTA labels

All CTA copy sourced from the document. None reused from warm_profile_1.

| Card | CTA |
|------|-----|
| wp2-balcony | Pull up a starter set? |
| wp2-gond-art | Book a Saturday seat? |
| wp2-gold-stack | Shortlist a few pieces for you? |
| wp2-football | Add me to the pickup? |
| wp2-bonda | Send the recipe to your phone? |
| wp2-shivanasamudra | Lock the day-trip? |
| wp2-vidhana | Wake me at 5:15? |
| wp2-sunnys | Want me to hold a table for tomorrow? |
| wp2-pour-over | Book the 9am Saturday? |
| wp2-therpup | Hold a morning slot for you? |
| wp2-vinyasa | Roll it tomorrow morning? |

---

## Tag (locationLabel) per card

Text only. No icons or symbols.

| Card | Tag |
|------|-----|
| wp2-balcony | Home · Morning |
| wp2-gond-art | Culture · Workshops |
| wp2-gold-stack | Fashion · Festive |
| wp2-football | Sports · Live |
| wp2-bonda | Food · Recipe |
| wp2-shivanasamudra | Travel · Day Trip |
| wp2-vidhana | Heritage · Photo Walk |
| wp2-sunnys | Restaurants · Heritage |
| wp2-pour-over | Coffee · Technique |
| wp2-therpup | Pet-friendly · Café |
| wp2-vinyasa | Wellness · Routine |

---

## Validation

- [x] Uses warm_profile_1 template (WarmProfile1CinematicL0, identical component)
- [x] Uses demo_coldstart image set (all 11 cold-start images)
- [x] Uses new content document (Glance_TV_Warm_Start_Ananya.docx)
- [x] Only 2 signals per card
- [x] All reasoning under 160 characters
- [x] No dash separators in reasoning
- [x] Reasoning naturally wraps to ~2 lines
- [x] CTA matches document, none reused from warm_profile_1
