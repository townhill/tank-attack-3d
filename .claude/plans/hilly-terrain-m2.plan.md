# Plan: Hilly Terrain — Hilly fully playable

**Source PRD**: .claude/prds/hilly-terrain.prd.md
**Selected Milestone**: 2 — Hilly fully playable
**Complexity**: Medium
**Branch**: keep working on `feat/hilly-terrain` (M1 is committed there as feeb6ec, not pushed). One PR for M1 + M2, as with the water milestones, unless you'd rather ship M1 alone first.

## Summary
**Why rivers fail on Hilly** (measured 2026-10-31 by replaying the water pipeline stage by stage):
- Rivers are planned fine: 12 of 12 Standard seeds.
- Bridges don't fit: 0.08 per river, against 1.6 on Gentle. Ramp rejections rise from 259 to 4,661.
- The cause: a river's surface can only fall downstream, so on Hilly it cuts deep channels through the hills. Their valley walls rise at up to 0.4, while a bridge ramp may climb at most 0.18 over at most 80 m (about 14 m).
- The result: unbridged rivers split the map, reachable ground drops to 71–86%, the 97% reachability rule rejects the layout, and after three retries most seeds keep no rivers. Only 1 of 12 Standard seeds keeps its river on the first try.

**The fix:** Hilly rivers carve a **valley bench**, a gentle shelf beside each bank (0.12 slope, below the ramp grade) about 60 m wide, with the usual walls beyond. Carving reach rises from 120 m to 150 m. A throwaway prototype kept every river on the first try on 12 of 12 Standard and 4 of 4 Large seeds, with 3 bridges per river on Standard and about 6 on Large.

**What else this milestone does:**
- The bench settings live in the terrain profile, so Gentle stays bit-identical.
- The bench costs some cover: 53.2% hidden against the 56.4% target, though fighting-range cover holds at 39.5% (target 34%). Steep ground fell to 4.6%, which leaves room to re-tune Hilly and win the cover back.
- Checks that fords and enemy routes work on Hilly at every size, and keeps generation time within a budget.

## Decisions taken in this plan (change before approving)
1. **Rivers follow valleys by carving a bench.** This answers PRD open question 3. Alternatives I measured:

   | Approach | Seeds keeping all rivers | Hidden, all ranges | Generation time | Why not |
   |---|---|---|---|---|
   | **Bench (recommended)** | 12 of 12 | 53.2% | Similar to Gentle in the same run | — |
   | Broad valleys: 0.15 walls out to 260 m | 12 of 12 | 47.8% (33.3% at fighting range) | 3–4× slower carving | Flattens about half a Standard map |
   | Longer cut-in ramps (160 m) | 4 of 12 | unchanged | — | The cuttings are too deep |
   | High bridges over the cuttings | not measured | — | — | Needs a new bridge type with new rendering, collision and navigation; out of proportion |

2. **Bench settings go in the terrain profile** as `riverValley: { benchWidth, benchSlope, reach }`. Gentle gets `{ 0, 0, 120 }`, which is exactly today's carving; the M1 fingerprints prove it. Lakes keep their current shores, because lake sites are already limited to 10 m of relief.
3. **Re-tune Hilly to win back cover.** Targets are unchanged: ≥ 1.5× Gentle at all ranges and at 60–150 m, steep ground ≤ 7%, spawnable ≥ 70% (averages). If the bench makes that impossible, I'll stop and show you the trade-off, as in M1.
4. **Generation-time budget: Hilly ≤ 1.5× Gentle at each map size, measured in the same report run.** Absolute times aren't comparable across runs: the machine's load average reached 66 while I prototyped, and Gentle Standard went from 94 ms to 496 ms.
5. **New measure: do enemies close in?** For each enemy in the first wave on Hilly and Gentle seeds at every size, record whether it gets within its preferred range plus 50 m of the player inside 90 simulated seconds. Hilly must match Gentle. Enemy AI is changed only if this fails.
6. **Fords:** checked on Hilly. FordPlacer changes only if a river goes unforded. More bridges per river leave fewer stretches 100 m clear of a bridge.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Terrain profile | `TERRAIN_TYPES` in [settings.ts](src/config/settings.ts) (M1) | A per-type numbers table, read through `WorldGenOptions.terrainProfile` |
| Keeping Gentle identical | `if (ridgeLayer.height > 0)` in [WorldGenerator.ts:107](src/world/WorldGenerator.ts:107); `opts.fords ? … : []` in `generateWaterFeatures` | New work runs only when its parameter asks for it; the M1 golden fingerprints in [gentleTerrain.test.ts](tests/gentleTerrain.test.ts) catch any drift |
| Carving | `carveRiver`, `shoreHeight`, `sideSlope` in [WaterGenerator.ts:503-604](src/world/WaterGenerator.ts:503) | Named constants with doc comments at the top; `shoreHeight` clamps natural ground between rising and falling walls |
| Optional parameters | `carveWater(terrain, rivers, lakes, playableHalfSize)` | A trailing parameter defaulting to Gentle's values, so `waterGen.test.ts` and `waterFixtures.ts` callers stay unchanged |
| Errors and fallbacks | `generateWaterFeatures` in [WorldGenerator.ts](src/world/WorldGenerator.ts) | Layouts that strand ground are undone and replanned; no new error paths |
| Tests | [waterGen.test.ts:14-53](tests/waterGen.test.ts:14) (straight river on flat ground), `makeTrough` in [waterFixtures.ts:84](tests/waterFixtures.ts:84), [fords.test.ts:97-140](tests/fords.test.ts:97), [aiWater.test.ts:71-125](tests/aiWater.test.ts:71), [hillyTerrain.test.ts](tests/hillyTerrain.test.ts) | Fixture worlds for the shape rules; generated seeds for battlefield-wide rules; behaviour-sentence names |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/config/settings.ts` | UPDATE | `RiverValley` and `TerrainProfile.riverValley`; Gentle `{ 0, 0, 120 }`, Hilly `{ 60, 0.12, 150 }`; re-tuned Hilly hill and ridge numbers |
| `src/world/WaterGenerator.ts` | UPDATE | `carveWater` and `carveRiver` take a `RiverValley` (defaulting to Gentle's); `shoreHeight` adds the bench; river reach comes from the valley |
| `src/world/WorldGenerator.ts` | UPDATE | `generateWaterFeatures` passes the profile's `riverValley` to `carveWater` |
| `tests/waterGen.test.ts` | UPDATE | The bench on a straight river: shelf slope, width, walls beyond, no cliff at the reach |
| `tests/hillyTerrain.test.ts` | UPDATE | Every Hilly seed keeps its rivers with at least 2 bridges each (Standard and Large); cover and guardrails after the re-tune |
| `tests/fords.test.ts` | UPDATE | Fords on Hilly: every river gets a wadeable ford |
| `tests/aiHilly.test.ts` | CREATE | Enemies close in on Hilly as reliably as on Gentle, one seed per size |
| `tests/coverReport.test.ts` | UPDATE | Bridges per river, how often layouts fall back, and Hilly generation time as a ratio of Gentle's |
| `.claude/prds/hilly-terrain.prd.md` | UPDATE | Close open question 3; M2 results |

## Tasks
### Task 1: Pin the failure in a test
- **Action**: Add to `tests/hillyTerrain.test.ts`: "keeps every river on Hilly battlefields, each bridged at least twice". It runs on Standard seeds 1, 42 and 2026 and one Large seed, and checks `world.rivers.length === opts.rivers` and bridges ≥ 2 × rivers. It should fail on today's code (seed 42 Huge has no rivers; most Standard seeds lose theirs).
- **Mirror**: the `sample()` helper in hillyTerrain.test.ts.
- **Validate**: `npx vitest run tests/hillyTerrain.test.ts` fails on the new test only.

### Task 2: Valley bench (Hilly only)
- **Action**:
  - **Tests first**, in `waterGen.test.ts`, on a straight river through a trough:
    - Within 60 m of the bank the ground rises no steeper than 0.12.
    - Beyond the bench, walls are no steeper than `VALLEY_SLOPE`.
    - Ground at the carving reach meets the natural ground.
  - **Then the code:**
    - `RiverValley` goes into settings.
    - `carveWater(…, valley = GENTLE_VALLEY)` threads it to `carveRiver`, which uses `valley.reach` for its reach.
    - `shoreHeight` adds `benchSlope * min(run, benchWidth) + slope * max(0, run - benchWidth)` when `benchWidth > 0`, and keeps today's formula otherwise.
    - `generateWaterFeatures` passes `opts.terrainProfile.riverValley`.
- **Mirror**: `shoreHeight`'s clamp; the `ridgeLayer.height > 0` style of check.
- **Validate**: `npx vitest run tests/waterGen.test.ts tests/gentleTerrain.test.ts tests/hillyTerrain.test.ts`. Gentle fingerprints unchanged; the Task 1 test passes.

### Task 3: Re-tune Hilly cover
- **Action**: Run the report and raise Hilly's hills and ridges until cover is back above both targets, using the steep-ground headroom the bench freed (4.6% against the 7% limit). If the targets and guardrails can't all be met, stop and bring the trade-off to you.
- **Validate**: `COVER_REPORT=1 npx vitest run tests/coverReport.test.ts --silent=false`; hillyTerrain tests pass.

### Task 4: Fords on Hilly
- **Action**: Add to `fords.test.ts`: "give every river a wadeable crossing on Hilly battlefields too", on Standard and Large Hilly seeds with fords on. If any river goes unforded, look at FordPlacer's 100 m bridge clearance against the extra bridges, and fix the narrowest rule.
- **Mirror**: [fords.test.ts:107](tests/fords.test.ts:107).
- **Validate**: `npx vitest run tests/fords.test.ts`

### Task 5: Enemies close in on Hilly
- **Action**: Write `tests/aiHilly.test.ts`. For seeds at Standard, Large and Huge on both terrain types: start the first wave, keep the player still and firing every few seconds, and record for each enemy whether it comes within its preferred range plus 50 m inside 90 simulated seconds. Hilly's share must be at least Gentle's minus 10 points, and no enemy may be stuck the whole run.
  - Only if this fails: look at the enemies' steep-ground avoidance (0.42 in Navigation.ts), the route steepness cost in NavGrid, and the path search budget (8,000 cells) on Huge. Fix the narrowest cause.
- **Mirror**: the simulation helpers in [aiWater.test.ts](tests/aiWater.test.ts) and `run()` in [simulation.test.ts](tests/simulation.test.ts).
- **Validate**: `npx vitest run tests/aiHilly.test.ts`

### Task 6: Generation-time budget
- **Action**: Add bridges per river, layout fallbacks, and Hilly-to-Gentle time ratio columns to the cover report. Check that Hilly ≤ 1.5× Gentle at each size within one run. If it's over, profile the stages: river carving dominated in the prototype, costing samples × reach².
- **Validate**: `COVER_REPORT=1 npx vitest run tests/coverReport.test.ts --silent=false`

### Task 7: Browser check and wrap-up
- **Action**:
  - Start the preview and play Hilly Standard and Huge games. Rivers, bridges and benches should render in Neon and Classic, with no console errors.
  - Drive across a bridge.
  - Turn fords on and check a ford marker.
  - Check the tactical map and radar show rivers and bridges.
  - Compare screenshots with Gentle on the same seed.
  - Restore settings and stop the preview before any timing runs.
  - Close open question 3 in the PRD, record the results, and run `graphify update .`.
- **Validate**: `npm run build`, `npm run coverage`

## Validation
```bash
npm run typecheck
npm run lint
npm test
npx vitest run tests/gentleTerrain.test.ts tests/hillyTerrain.test.ts tests/waterGen.test.ts tests/fords.test.ts tests/aiHilly.test.ts
COVER_REPORT=1 npx vitest run tests/coverReport.test.ts --silent=false
npm run build
npm run coverage
graphify update .
```
Plus the browser check in Task 7, with the preview stopped before any timing.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| The re-tune can't win back cover within the steep limit | Medium | The prototype freed 2.4 points of steep ground; if that isn't enough, you choose the trade-off (Task 3) |
| Benches look artificial: flat shelves in the wireframe | Medium | Browser comparison in Task 7; bench width and slope are profile numbers, easy to soften |
| Gentle drifts when `shoreHeight` changes | Low | Today's formula kept when `benchWidth` is 0; M1 golden fingerprints |
| Wider carving slows generation | Medium | Budget in Task 6; carving is the known hot spot |
| More bridges leave no stretch for a ford | Medium | Task 4 test; adjust only the clearance rule that blocks it |
| Enemies route poorly or get stuck on Hilly, especially on Huge with its search budget | Medium | Task 5 measure, compared with Gentle; fixes only if it fails |
| Timing results distorted by machine load | High | Ratios within one run; preview stopped first |

## Acceptance
- [ ] Every tested Hilly seed at Standard and Large keeps all its rivers on the first layout, each bridged at least twice; Huge checked in the report
- [ ] Gentle worlds match the M1 golden fingerprints
- [ ] Hilly meets the cover target and guardrails, or you've chosen a trade-off
- [ ] Fords cross every river on Hilly when turned on
- [ ] Enemies close in on Hilly about as reliably as on Gentle at every size
- [ ] Hilly generation ≤ 1.5× Gentle at each size, in the same run
- [ ] typecheck, lint, tests, build and coverage pass; browser checked; PRD and graph updated

## Outcome (2026-10-31, not committed)
- **Valley bench, as planned:** Gentle `{ 0, 0, 120 }`, Hilly `{ 60, 0.12, 150 }`. Gentle fingerprints unchanged.
- **Re-tune:** Hilly detail 4 → 5 m and ridges 8 → 9 m. Cover 56.5% / 41.1% on Standard; steep ground 6.1%. Results by size are in the PRD.
- **No changes needed** to fords (every Hilly river forded) or enemy AI (all first-wave enemies closed in at every size).
- **Report:** gained bridges per river and a Hilly-to-Gentle time ratio, and now fails if a ratio exceeds 1.5×. Measured 1.24–1.30×.
- **Browser:** seed 42 Standard has 1 river, 3 bridges and a ford; a tank drove across a bridge; Neon and Classic render. Huge seed 42 has 3 rivers and 27 bridges (none in M1). No console errors.
- **Validation:** typecheck, lint, all 939 tests, the build and coverage pass (97.8% statements, 94.4% branches), and the graph is rebuilt. Under heavy load (load average above 30), 9–13 slow generation tests had timed out in coverage, with no wrong results. On a quiet machine only two Huge-battlefield tests still did, at about 5.4 s: the Gentle golden fingerprint and the Huge obstacles test in `tests/terrain.test.ts`. Each now has a named 30 s `GENERATION_TIMEOUT`, as `tests/fords.test.ts` already did. The global default is unchanged.
