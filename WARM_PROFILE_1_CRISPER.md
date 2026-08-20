# WARM_PROFILE_1_CRISPER

**Date:** 2026-06-17
**Route:** `/warm_profile_1_crisper` or `/warm-profile-1-crisper`
**Source doc:** Ambient_Feed_Copy_Recommendations_Full.docx — Akshay table
**Experiment:** 1-signal minimal reasoning vs warm_profile_1 (2-signal) and warm_profile_1_crisp (compressed)

---

## Content Structure

| Version | Signals | Reasoning |
|---------|---------|-----------|
| warm_profile_1 | 2 signals | ~180–240 chars |
| warm_profile_1_crisp | 2 signals | ~140–160 chars |
| warm_profile_1_crisper | **1 signal** | **48–68 chars** |

---

## Signal Selected Per Card

| Card | ID | Signal selected | Source |
|------|----|----------------|--------|
| India vs Afghanistan, Tonight | ws-india-afg | "Big cricket nights are rarely something you miss." | doc col1 |
| The Nandi Hills Ride | ws-nandi-hills | "Your triathlon plans make this worth a look." | doc col1 |
| Om Beach at Sunrise | ws-om-beach | "You seem to prefer quieter escapes over crowded destinations." | doc col1 |
| A Coffee Estate at First Light | ws-coorg | "Coffee has become more than just a morning drink for you." | doc col1 |
| The Amalfi Edit | ws-amalfi | "That September trip is starting to take shape." | doc col1 |
| Wind Down Together | ws-wind-down | "Better sleep has been a recurring goal lately." | doc col1 |
| Your Father's Records, Played Right | ws-vinyl-ritual | "Some experiences are worth rediscovering properly." | doc col1 |
| Gehra Hua and This Week's Hits | ws-gehra-hua | "Your music taste sits comfortably between indie favourites and what's new." | doc col1 |

---

## Reasoning Character Counts

| Card | Reasoning | Chars |
|------|-----------|-------|
| ws-india-afg | Tonight's match matters before the next stage begins. | 53 |
| ws-nandi-hills | The Nandi loop remains one of Bangalore's favourite endurance rides. | 68 |
| ws-om-beach | This season brings calmer beaches and fewer visitors. | 53 |
| ws-coorg | Monsoon is when these estates are at their most beautiful. | 58 |
| ws-amalfi | Shoulder season offers the best balance of weather and crowds. | 62 |
| ws-wind-down | Small changes before bed often make the biggest difference. | 59 |
| ws-vinyl-ritual | A listening session is the easiest way to begin. | 48 |
| ws-gehra-hua | This week's playlist brings both worlds together. | 49 |

All within 48–68 characters. Well under the 140-char maximum.

---

## CTA Per Card (from document, verbatim)

| Card | CTA |
|------|-----|
| ws-india-afg | Follow the action live |
| ws-nandi-hills | See the Sunday route |
| ws-om-beach | Explore the weekend escape |
| ws-coorg | Compare estate stays |
| ws-amalfi | Save for September |
| ws-wind-down | Try it tonight? |
| ws-vinyl-ritual | Hear it before you buy it |
| ws-gehra-hua | Queue this week's playlist |

CTA is stored in `warmCardCrisperData.ts` per card and rendered directly — not sourced from `ctaGenerator.ts`.

---

## Validation

| Check | Status |
|-------|--------|
| Uses warm_profile_1 template | ✓ |
| Only 1 signal per card | ✓ |
| Only 1 reasoning per card | ✓ |
| Reasoning under 140 characters | ✓ (max 68) |
| No manual line breaks in reasoning | ✓ |
| No dash separators (—, –) in reasoning | ✓ |
| CTA from supplied document | ✓ |
| Animations unchanged | ✓ (same GSAP timeline, same mascot, same CTA transitions) |
| Signal animation: reveal → hold → fade → reasoning | ✓ |
| No Signal 2 introduced | ✓ |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/L0/warmCardCrisperData.ts` | New — 1-signal + reasoning + CTA per card, from document |
| `src/components/L0/SignalDecisionReasoningCrisper.tsx` | New — 1-signal animation (left/right cards) |
| `src/components/L0/CenterSignalDecisionReasoningCrisper.tsx` | New — 1-signal animation (center cards) |
| `src/components/L0/WarmProfile1CrisperCinematicL0.tsx` | New — cinematic renderer using crisper data + CTA |
| `src/components/L0/WarmProfile1CrisperL0Glance.tsx` | New — L0 router for crisper route |
| `src/WarmProfile1CrisperApp.tsx` | New — app entry for `/warm_profile_1_crisper` route |
| `src/main.tsx` | Updated — route detection and render for `isWarmProfile1Crisper` |

---

## Animation Timing (1-signal vs 2-signal)

| Phase | warm_profile_1 (2-signal) | warm_profile_1_crisper (1-signal) |
|-------|--------------------------|-----------------------------------|
| Signal 1 reveal | 0–3200ms | 0–3200ms |
| Signal 1 hold | 3200–8200ms | 3200–8200ms |
| Signal 2 enter + reveal | 8200–11400ms | — |
| Signal 2 hold | 11400–16400ms | — |
| Signals fade | 16400–17800ms | 8200–8900ms |
| Reasoning reveal | 18200–25200ms | 9300–16300ms |
| Hold + onSequenceDone | 25200–30200ms | 16300–21300ms |
| **Total** | **~30.2s** | **~21.3s** |

The crisper sequence is ~9 seconds shorter per card.
