# L0 Card Transition Zoom Fix

Route affected: `warm_profile_1_crisp` only.

---

## Root cause

`buildColdStartL0Timeline` (shared by all L0 templates) contained this at t=0:

```js
tl.fromTo(bg,
  { scale: 1.05, yPercent: -1.8 },
  { scale: 1.00, yPercent: 0, duration: 2.8, ease: 'power1.out' },
0);
```

Every incoming card started its background at **scale 1.05** and eased back to **1.0** over 2.8s. Because the scale-back started immediately with the card mount, it was visible as a backward zoom — the image appeared to pop/snap inward on every card transition.

---

## Fix

Added an optional `bgEntrance` parameter to `L0TimelineOpts`:

```ts
bgEntrance?: 'zoom' | 'fade'
```

| Value | Behaviour |
|-------|-----------|
| `'zoom'` (default) | Original cold-start behaviour — scale 1.05 → 1.0 over 2.8s |
| `'fade'` | No scale on mount. Opacity crossfade only (0.9s, `power2.inOut`). After card settles, a very gentle drift 1.0 → 1.015 runs over 8s — barely perceptible ambient movement. |

`WarmProfile1CinematicL0` now passes `bgEntrance: 'fade'`. `ColdStartApp`/`ColdStartCinematicL0` pass nothing (defaults to `'zoom'`), preserving their original behaviour exactly.

The existing `prevImage` underlay (persistent bg layer behind the incoming `bgRef`) already prevents any black flash during the crossfade.

---

## Transition behaviour after fix

| Phase | Before | After |
|-------|--------|-------|
| Card mount | bg pops in at scale 1.05, immediately shrinks | bg fades in at scale 1.0, no scale change on mount |
| Ambient motion | Shrink-back from 1.05 completes over 2.8s | Imperceptibly slow drift 1.0 → 1.015 over 8s |
| Outgoing card | Unchanged | Unchanged |

---

## Templates updated

All three alignment variants in `WarmProfile1CinematicL0` are covered by the single `bgEntrance: 'fade'` option — left, center, and right use the same bg animation code path.

---

## Files changed

| File | Change |
|------|--------|
| `src/animations/coldStartL0Timeline.ts` | Added `bgEntrance` option to `L0TimelineOpts`; branched bg entrance logic |
| `src/components/L0/WarmProfile1CinematicL0.tsx` | Pass `bgEntrance: 'fade'` in timeline opts |
