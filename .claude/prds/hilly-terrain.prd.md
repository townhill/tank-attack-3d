# Hilly Terrain Option

## Problem
Players of VECTOR TANKS fight on gentle rolling ground. Hills reach only about ±20 m across a 1 km battlefield, large basins are flattened further, and the spawn is kept level. The result is little cover: hills rarely break line of sight, ambushes are hard to set up, and engagements play out in the open. Players have no way to choose more dramatic ground. Now that water and bridges have shipped, terrain is the most noticeable gap left.

## Evidence
- Developer playtesting: fights play out in the open, with little cover to break line of sight. This is one observer; there is no outside player feedback yet.
- Current generator (observed): the only big relief is the boundary mountain ring outside the play area. Inside it, relief is roughly ±20 m, and much of the map is scaled down to about a fifth of that.
- Measured Gentle baseline (2026-10-31, battlefield survey over 12 Standard, 4 Large and 2 Huge seeds; eye 3.2 m, target 2 m, rocks and structures count as cover):

  | Size | Relief (p5–p95) | Hidden, all ranges | Hidden, 60–150 m | Hidden, 150–320 m | Median move to cover from a threat 120 m away | Cover within 60 m | Too steep for enemies | Spawnable |
  |---|---|---|---|---|---|---|---|---|
  | Standard | 11.6 m | 37.6% | 22.7% | 47.6% | 20 m | 85.5% | 0.1% | 95.0% |
  | Large | 12.5 m | 38.9% | 24.0% | 47.9% | 23 m | 82.7% | 0.1% | 94.1% |
  | Huge | 12.6 m | 43.8% | 25.8% | 53.5% | 25 m | 83.1% | 0.1% | 93.9% |

  At the 90–150 m range enemies prefer, a player on Gentle is in sight about 77% of the time. That fits the playtest observation that fights happen in the open.
- Hilly as built in milestone 1 (same survey and seeds, water on):

  | Size | Relief | Hidden, all ranges | Hidden, 60–150 m | Too steep for enemies | Spawnable | Rivers placed | Generation time |
  |---|---|---|---|---|---|---|---|
  | Standard | 35.5 m | 56.9% | 41.4% | 5.8% | 76.2% | 0.4 of 1 | 179 ms (Gentle 94) |
  | Large | 38.5 m | 58.2% | 41.5% | 6.4% | 76.0% | 0.5 of 2 | 688 ms (Gentle 285) |
  | Huge | 36.5 m | 59.2% | 41.7% | 6.1% | 75.8% | 1.5 of 3 | 1311 ms (Gentle 657) |

  Meeting the cover target cost about 6% steep ground; the user chose that over a 5% steep limit with about 52% cover (2026-10-31). Rivers often fail to fit Hilly ground, which also doubles generation time through retried layouts; that is milestone 2.
- Hilly after milestone 2 (valley benches for rivers, re-tuned detail and ridges; same survey and seeds, water on):

  | Size | Hidden, all ranges | Hidden, 60–150 m | Too steep | Spawnable | Rivers placed | Bridges per river | Generation vs Gentle, same run |
  |---|---|---|---|---|---|---|---|
  | Standard | 56.5% | 41.1% | 6.1% | 75.6% | 1 of 1 | 3.0 | 1.24× |
  | Large | 57.9% | 42.6% | 6.4% | 72.6% | 2 of 2 | 5.9 | 1.29× |
  | Huge | 57.5% | 40.6% | 6.2% | 73.9% | 3 of 3 | 9.0 | 1.30× |

  The Standard cover target (56.4%) is met with 0.1 points to spare. Every first-wave enemy on the tested Hilly seeds (one per size, 3 enemies each) closed to fighting range within 75 s, and none got stuck; Gentle managed 2 of 3 on Standard. Fords cross every river on Hilly too.
- Assumption: other players feel the same lack of cover. Needs validation via playtests of a Hilly prototype.

## Users
- **Primary**: A player setting up a match who wants a fight with cover, ridgelines and valleys. The trigger is choosing the battlefield before a game, alongside map size and the other Battlefield settings.
- **Not for**: Players who like today's gentle ground. Gentle stays the default and is unchanged.

## Hypothesis
We believe **a player-selectable Hilly terrain type with taller hills and deeper valleys** will **give real cover and line-of-sight breaks** for **players who choose it**.
We'll know we're right when **a seeded line-of-sight check shows a much larger share of the battlefield hidden from typical positions on Hilly than on Gentle (target set after measuring Gentle), and playtests find cover within a short drive in most Hilly matches**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Cover: share of the battlefield hidden from direct sight at typical positions, Hilly vs Gentle | Proposed: at least 1.5× Gentle on Standard, i.e. ≥ 56% at all ranges (Gentle 37.6%) and ≥ 34% at 60–150 m (Gentle 22.7%) | Automated seeded line-of-sight sampling across many seeds and all three map sizes |
| Cover in play: time to reach cover from a typical position | Within a short drive in most Hilly matches (threshold TBD — needs validation via first playtests; Gentle baseline: median 20 m, 85.5% within 60 m) | Developer playtests |
| Guardrail: Gentle unchanged | Identical battlefields for every tested seed | Compare generated worlds before and after for a fixed set of seeds |
| Guardrail: Hilly stays playable | Every tested seed yields a battlefield with the same reachability guarantee as Gentle; water fallback rate TBD | Seeded generation check across all map sizes |

## Scope
**MVP**: A terrain-type choice in the Battlefield settings, with two values:
- **Gentle** is the default. Every seed generates exactly the battlefield it does today.
- **Hilly** has taller hills and deeper valleys that give real cover.

On Hilly, everything that works on Gentle keeps working at every map size: rivers, lakes, ponds, bridges and optional fords; the player spawn; rocks and structures sitting properly on the ground; enemies reaching the player; the tactical map and radar.

**Out of scope**
- Deformable terrain (craters, or shells reshaping the ground). Explicitly excluded.

**Not in the MVP, not ruled out**
- Terrain types beyond Gentle and Hilly (for example Mountainous or Canyons). Revisit after Hilly ships.
- Enemies deliberately using hills for cover or ambush. On Hilly they only need to drive over and around hills, as they do today.
- Making Hilly the default.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Terrain choice | Players can pick Gentle or Hilly, and Gentle is unchanged. Hilly shows taller hills and valleys with a working spawn and obstacles. Its cover is measured against the Gentle baseline, and that sets the target. | in-progress | .claude/plans/hilly-terrain.plan.md |
| 2 | Hilly fully playable | Water, bridges, fords and enemy routes all work on Hilly at every map size, with the same reachability guarantee as Gentle. | in-progress | .claude/plans/hilly-terrain-m2.plan.md |
| 3 | Tuned and shipped | Slopes and relief are tuned from playtests until both cover metrics are met. README and screenshots are updated. | pending | — |

## Open Questions
- [ ] **How steep is too steep?** Tanks slow down on climbs and enemies avoid steep ground. What height and slope keep fights moving and every area reachable? Needs validation via playtests.
- [ ] **Keep the spawn level on Hilly?** The start area is flattened today. Keeping it flat is safe; a hilly start would give cover from the first second.
- [x] **Water on Hilly maps.** Answered in milestone 2. Rivers already follow the low ground; they failed because bridge ramps could not climb out of the deep cuttings they carve through tall hills. On Hilly, each river now carves a gentle bench beside its banks, and every tested seed keeps all its rivers, with bridges and fords. A few lakes still find no site flat enough (2.8 of 3 on Standard).

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Steep ground slows fights or cuts off parts of the map | Medium | High | Keep Gentle's reachability guarantee; settle the slope limit in playtests (open question 1) |
| Fewer rocks and structures on Hilly, because they need fairly flat ground, so some cover is lost | Medium | Medium | Compare obstacle counts on Hilly and Gentle across seeds |
| Hills make more seeds fall back to fewer rivers or lakes, or to dry land | Medium | Medium | Measure the water fallback rate on Hilly (open question 3) |
| Enemies get stuck or take poor routes over hills | Medium | Medium | Check enemy routes on Hilly seeds at every map size; smarter tactics stay deferred |
| A change leaks into Gentle and alters existing seeds | Low | High | Gentle-unchanged guardrail metric |
| So much cover that enemies are hard to find and fights stall | Low | Medium | Watch for it in playtests; tune relief down if needed |
| Battlefield generation gets noticeably slower on Huge | Low | Low | Measure generation time on Hilly against Gentle |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
