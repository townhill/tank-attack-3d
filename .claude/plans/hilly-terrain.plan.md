# Plan: Hilly Terrain — Terrain choice

**Source PRD**: .claude/prds/hilly-terrain.prd.md
**Selected Milestone**: 1 — Terrain choice
**Complexity**: Medium
**Branch**: `feat/hilly-terrain`, cut from an up-to-date `master` (feat/water-bridges is already merged)

## Summary
Add a `terrain` setting (Gentle | Hilly) that players pick in Settings → Battlefield, beside the fords toggle. It travels the same route `fords` already takes: settings → Game → WorldLoader and its worker → `worldOptionsFor` → `generateHeights`.

- **Gentle**: today's numbers move into a height profile that reproduces the current heightfield bit for bit. Golden fingerprints, recorded before any change, enforce this.
- **Hilly**: a second profile with taller, longer hills, ridgelines and valleys.
- **Survey**: a test-side battlefield survey measures cover (how much of the battlefield is hidden at engagement range), plus steepness, obstacle and spawn guardrails, for both types. The measured Gentle baseline sets the PRD's cover target.

## Decisions taken in this plan (change before approving)
1. **The choice lives in Settings → Battlefield**, as the PRD says: a `Terrain (new battlefields)` select beside the fords toggle, with Gentle and Hilly as its options. The start banner shows `· HILLY`, so it's always clear which terrain a game is on.
2. **The spawn stays level on Hilly** for M1 (PRD open question 2). Whether to change that is a question for the M3 playtests.
3. **Water generation runs unchanged on Hilly** in M1. The survey reports how often Hilly falls back to fewer rivers or lakes. Making water, bridges and fords fit Hilly's valleys is M2's job (open question 3).
4. **Provisional guardrails for tuning Hilly** (PRD open question 1). They are starting values, checked against the Gentle baseline, and yours to change:
   - At most 5% of dry playable ground is steeper than the enemies' safe slope (0.42, [Navigation.ts:21](src/ai/Navigation.ts:21)).
   - At least 75% of dry playable ground is flat enough for enemy spawns (≤ 0.30, [Simulation.ts:69](src/game/Simulation.ts:69)).
   - Hilly places at least 85% as many obstacles as Gentle on the same seed.
5. **Mirror `fords` rather than refactor.** Terrain becomes one more field or parameter beside `fords` in `WorldRequest`, `load()`, `worldOptionsFor()`, `SimulationOptions` and `Game`. Bundling map size, fords and terrain into one battlefield-choice object would be tidier, but it touches every call site. That's left for later.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming / spec table | [settings.ts:271-282](src/config/settings.ts:271) (`MapSize`, `MAP_SIZES`) | String-literal union of ids plus a `Record<Id, Spec>` with a `label`; the ids list lives in userSettings (`MAP_SIZE_IDS`) |
| Settings validation | [userSettings.ts:93-101](src/config/userSettings.ts:93) | `pickEnum(src.x, IDS, d.x)`; the default comes from `DEFAULT_SETTINGS`; corrupt or old stored data falls back to the default |
| Threading a world option | `fords`: [WorldLoader.ts:14-20, 76-84, 143-150](src/world/WorldLoader.ts:14), [worldWorker.ts:19-22](src/world/worldWorker.ts:19), [Simulation.ts:54-55, 100](src/game/Simulation.ts:54), [Game.ts:79-80, 288-316](src/game/Game.ts:79) | A `readonly` field with a `/** */` doc and a default of off. Game remembers what the current world was generated with, and reuses that world only when everything matches |
| Settings control | [Menu.ts:41-44, 50, 80-85](src/ui/Menu.ts:41) | A `select` control in `SECTIONS` whose options are mapped from a spec table (`GRAPHICS_MODES.map((m) => [m, GRAPHICS_MODE_SPECS[m].label])`); Battlefield settings say "(new battlefields)", like the fords toggle |
| Keeping old seeds identical | [WorldGenerator.ts:33-34, 281](src/world/WorldGenerator.ts:33), obstacle comment at [WorldGenerator.ts:225-228](src/world/WorldGenerator.ts:225) | New behaviour sits behind a check (`opts.fords ? … : []`); random sequences are never disturbed while a feature is off |
| Errors | [userSettings.ts:93](src/config/userSettings.ts:93), [WorldLoader.ts:96-130](src/world/WorldLoader.ts:96) | Bad stored values fall back to defaults; a generation failure falls back to the main thread with `console.warn`. No new error paths needed |
| Logging | [WorldLoader.ts:99](src/world/WorldLoader.ts:99) | `console.warn` only on degraded paths; lint allows warn, error and info |
| Tests | [terrain.test.ts:1-60](tests/terrain.test.ts:1), `expectSameWorld` in [worldLoader.test.ts:18-35](tests/worldLoader.test.ts:18), [waterFixtures.ts](tests/waterFixtures.ts) | Vitest in a node environment; `describe`/`it` names written as behaviour sentences; helpers are plain modules in `tests/` |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/config/settings.ts` | UPDATE | `TerrainType`, `TerrainProfile` and `TERRAIN_TYPES` (label, blurb, height profile) for gentle and hilly |
| `src/config/userSettings.ts` | UPDATE | `terrain` setting (default `'gentle'`), `TERRAIN_TYPE_IDS`, sanitised with `pickEnum` |
| `src/world/WorldGenerator.ts` | UPDATE | `WorldGenOptions.terrain: TerrainProfile`; `worldOptionsFor(size, fords, terrain = 'gentle')`; `generateHeights` reads the profile; ridge and valley layers that only Hilly uses |
| `src/world/WorldLoader.ts` | UPDATE | `terrain` on `WorldRequest`, `Job` and `load()` |
| `src/world/worldWorker.ts` | UPDATE | Pass `terrain` to `worldOptionsFor` |
| `src/game/Simulation.ts` | UPDATE | `SimulationOptions.terrain?` for worlds it generates itself |
| `src/game/Game.ts` | UPDATE | `worldTerrain` field; terrain in the world-reuse check; loader call; `· HILLY` in the banner; game-over summary; debug state |
| `src/ui/Menu.ts` | UPDATE | A `Terrain (new battlefields)` select in the Battlefield settings section, beside fords; a `Terrain` row on the game-over screen |
| `tests/worldFingerprint.ts` | CREATE | 32-bit fingerprint of a world: heights, water level, obstacles, rivers, lakes, bridges, fords |
| `tests/gentleTerrain.test.ts` | CREATE | Golden fingerprints of today's worlds, recorded before any change |
| `tests/battlefieldSurvey.ts` | CREATE | Seeded survey: relief, hidden share at engagement range, distance to cover, steep and spawnable share, obstacle counts, water outcome |
| `tests/battlefieldSurvey.test.ts` | CREATE | The survey's own tests, on hand-built worlds |
| `tests/hillyTerrain.test.ts` | CREATE | Hilly-vs-Gentle assertions on a few Standard seeds |
| `tests/coverReport.test.ts` | CREATE | Full survey table plus generation times; skipped unless `COVER_REPORT=1` |
| `tests/settings.test.ts` | UPDATE | Terrain default and sanitising |
| `tests/worldLoader.test.ts` | UPDATE | Request shape includes `terrain`; a Hilly request round-trips |
| `tests/simulation.test.ts` | UPDATE | A full first wave spawns on Hilly seeds |
| `.claude/prds/hilly-terrain.prd.md` | UPDATE | Gentle baseline numbers and cover target |

## Tasks
### Task 1: Lock Gentle before touching it
- **Action**: Write `tests/worldFingerprint.ts`: FNV-1a over the bytes of `terrain.heights` and `water.level`, plus the JSON of obstacles, rivers, lakes, bridges and fords. Then write `tests/gentleTerrain.test.ts`, which records fingerprints for seeds 1, 42 and 2026 on Standard, 7 on Large, 3 on Huge, and 42 on Standard with fords. Generate them with today's `worldOptionsFor(size, fords)` and capture the constants before any source change.
- **Mirror**: the fields compared in `expectSameWorld` ([worldLoader.test.ts:18-28](tests/worldLoader.test.ts:18)); FNV-1a as in `hashSeed` (src/utils/random.ts).
- **Validate**: `npx vitest run tests/gentleTerrain.test.ts` passes on the unchanged code.

### Task 2: Battlefield survey (the measuring stick)
- **Action**: Write `tests/battlefieldSurvey.test.ts` first, against hand-built worlds:
  - A flat world hides nothing.
  - A ridge fixture hides targets behind it but not those in front.
  - Steep and spawnable shares are right on a ramp of known slope.

  Then implement `surveyBattlefield(world, seed, samples)` in `tests/battlefieldSurvey.ts`, deterministic through `Random(seed)`. It reports:
  - **relief**: the 5th-to-95th-percentile height span over dry playable ground.
  - **hiddenShare**: the share of observer-target pairs with no `world.hasLineOfSight`, overall and split into 60–150 m and 150–320 m bands. Observers are seeded dry points with the eye at 3.2 m; each gets targets at a random bearing, 60–320 m away, at 2 m. The heights match the tactical map's sight check ([tacticalData.ts:231-232](src/ui/tacticalData.ts:231)). The range spans the AI's preferred ranges (90–150 m) and its gunfire alert range (320 m). Obstacles count as cover, so lost structures show up here too.
  - **coverDistance**: for each observer, with a threat 200 m away, the smallest radius (10 m steps up to 120 m) that holds a point hidden from the threat. Reported as a median and as the share within 60 m, to help set PRD metric 2's threshold later.
  - **steepShare** (> 0.42) and **spawnableShare** (≤ 0.30) of dry playable ground, using `slopeAt(x, z, 3)` as the AI and spawner do.
  - **Obstacles**: counts by kind against the requested counts.
  - **Water**: rivers, lakes and bridges placed against requested.
- **Mirror**: fixture style of `makeRamp` in [terrain.test.ts:11](tests/terrain.test.ts:11) and of [waterFixtures.ts](tests/waterFixtures.ts).
- **Validate**: `npx vitest run tests/battlefieldSurvey.test.ts`

### Task 3: Measure the Gentle baseline
- **Action**: Write `tests/coverReport.test.ts`. It surveys 12 Standard, 4 Large and 2 Huge seeds per terrain type (Hilly rows appear once Task 5 lands) and prints a table with `console.info`, including each size's generation time. It is skipped unless `COVER_REPORT=1`; when writing it, check that Vitest exposes the variable through `import.meta.env` and pick a working gate if it doesn't.
- Run it on Gentle and write the numbers into the PRD. Propose the cover target from them; the provisional rule is Hilly hiddenShare ≥ 1.5× Gentle's. You see the target at review and can move it.
- **Validate**: `COVER_REPORT=1 npx vitest run tests/coverReport.test.ts`

### Task 4: Move Gentle's numbers into a height profile
- **Action**: Add `TerrainType = 'gentle' | 'hilly'`, `TerrainProfile` and `TERRAIN_TYPES` to settings.ts. The gentle profile holds today's literals:
  - base 16 m at a 380 m scale, 4 octaves
  - detail 4 m at 110 m, 3 octaves, offsets 17.3 and −9.1
  - basin mask at 430 m, smoothstep −0.35 to 0.4, floor 0.22
  - no ridges, no valleys

  `generateHeights` reads `opts.terrain` and keeps every expression in the same order, so the floats come out identical. `worldOptionsFor(size, fords = false, terrain: TerrainType = 'gentle')` resolves the profile. Spawn flattening (30–140 m) and the boundary mountains stay as they are, shared by both types.
- **Mirror**: `MAP_SIZES` spec table; `WORLD` constants in settings.ts.
- **Validate**: `npx vitest run tests/gentleTerrain.test.ts tests/terrain.test.ts` still pass unchanged; `npm run typecheck`

### Task 5: Hilly heights
- **Action**: Write `tests/hillyTerrain.test.ts` first, so it fails. It covers seeds 1, 42 and 2026 on Standard:
  - Hilly relief is at least 2× Gentle's.
  - hiddenShare meets the Task 3 target.
  - The guardrails from Decision 4 hold.
  - The spawn ring (≤ 30 m) is as level as Gentle's.
  - The same seed gives the same fingerprint twice.
  - Hilly's fingerprint differs from Gentle's.

  Then add the hilly profile. Starting values, to tune with the report:

  | Element | Starting value |
  |---|---|
  | Base hills | 30 m at a 460 m scale |
  | Detail | 6 m at 120 m |
  | Basin floor | 0.5 (fewer, smaller open plains) |
  | Ridgelines | Ridged noise from a new seeded `SimplexNoise2D` (`seed ^` a new constant), 12 m at 240 m, centred on its mean so it raises crests without lifting everything |
  | Valleys | The zero lines of a low-frequency noise, carved up to 10 m deep and about 60 m wide by a smoothstep on `\|n\|` |

  Both new layers are added before the basin mask and run only when their amplitude is above 0, so Gentle never evaluates them.
- **Mirror**: `detail.ridged(...)` use in the boundary range ([WorldGenerator.ts:98](src/world/WorldGenerator.ts:98)); the `opts.fords` style of checking before doing work.
- **Validate**: `npx vitest run tests/hillyTerrain.test.ts tests/gentleTerrain.test.ts`; `COVER_REPORT=1 npx vitest run tests/coverReport.test.ts`

### Task 6: The player's choice, end to end
- **Action**:
  - **userSettings**: `terrain` (default `'gentle'`), `TERRAIN_TYPE_IDS`, `pickEnum`.
  - **Menu**: a `select` control, `Terrain (new battlefields)`, in the Battlefield section beside the fords toggle. Its options come from the `TERRAIN_TYPES` labels: "Gentle: rolling ground, open plains" and "Hilly: tall hills, ridgelines and valleys". Plus a `Terrain` row on the game-over screen.
  - **WorldLoader**: `WorldRequest`, `Job` and `load()` gain `terrain`; the worker passes it on.
  - **Simulation**: `SimulationOptions.terrain?`.
  - **Game**: a `worldTerrain` field; the reuse check in `startNewGame` compares terrain too; `beginGame` stores it; the banner adds `· HILLY`; the debug state reports `terrain`.
- **Mirror**: how `fords` is threaded; the `graphicsMode` select built from its spec table.
- **Tests**:
  - settings: the default is gentle, an unknown value becomes gentle, and `'hilly'` is kept.
  - worldLoader: requests default to `terrain: 'gentle'`, and a Hilly request returns the same world as generating locally.
  - simulation: on Hilly seeds, every enemy in the first wave spawns.
- **Validate**: `npm test`, `npm run typecheck`, `npm run lint`

### Task 7: Check in the browser and wrap up
- **Action**:
  - Start the `vector-tanks-dev` preview. Check that the Terrain control in Settings → Battlefield switches and survives a reload.
  - Start Hilly games on Standard and Huge. The generating status should show, with no worker errors in the console.
  - Switch type on the same seed and confirm a new world is generated.
  - Take chase-camera screenshots of Gentle and Hilly on one seed. Check the tactical map and radar still draw, and drive over a ridge.
  - Restore the settings afterwards, because `debugCommand` saves them.
  - Record the final survey numbers in the PRD, then run `graphify update .`.
- **Validate**: `npm run build`, `npm run coverage`

## Validation
```bash
npm run typecheck
npm run lint
npm test
npx vitest run tests/gentleTerrain.test.ts tests/hillyTerrain.test.ts
COVER_REPORT=1 npx vitest run tests/coverReport.test.ts
npm run build
npm run coverage
graphify update .
```
Plus the browser check in Task 7.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Moving the numbers into a profile changes Gentle's floats (expression order, −0 vs 0) | Medium | Golden fingerprints from Task 1 come before any change; keep the expression order; put Hilly's layers behind an `if` rather than multiplying them by 0 |
| Ridges steep enough to block sight are too steep to drive, so Hilly passes cover but fails steepness | Medium | Prefer more height over longer wavelengths to sharper ridges; tune with the survey; the guardrails are provisional |
| Fewer rocks and structures on Hilly, because they need slopes of at most 0.32 (buildings 0.18) | Medium | The survey counts them; a basin floor of 0.5 keeps flatter pockets; if Hilly is short, M2 can give it more placement attempts |
| Water on Hilly looks wrong (deep gorges, bridges over steep banks) or falls back more often | Medium | Outside M1; the survey reports the fallback rate; fixed in M2 |
| Enemy spawns fail more often on Hilly | Low–Medium | The spawnable-share guardrail, plus the full-first-wave simulation test |
| Survey tests slow the suite (the coverage run timed out once before) | Medium | The assertion tests use 3 Standard seeds with modest samples; the full report is opt-in |
| The reuse check misses terrain, so switching type on the same seed silently keeps the old world | Low | Explicit in Task 6; the Task 7 browser check switches type on one seed |

## Acceptance
- [ ] Settings → Battlefield offers Terrain: Gentle / Hilly; the choice persists and applies to the next new game
- [ ] Gentle worlds match the golden fingerprints for every recorded seed, with and without fords
- [ ] Hilly meets the cover target set from the Gentle baseline, and the provisional guardrails
- [ ] The Gentle baseline and the target are recorded in the PRD
- [ ] typecheck, lint, tests, build and coverage pass; the graph is updated
- [ ] Checked in the browser on Standard and Huge
- [ ] All tasks complete; patterns mirrored, not reinvented

**Not in M1:** making water, bridges and fords fit Hilly's valleys, and checking enemy routes at every size (M2); playtest tuning, README and screenshots (M3).

## Outcome (2026-10-31)
Built on `feat/hilly-terrain`, not committed. Where it differs from the plan above:
- **Cover measure:** the cover-distance threat stands 120 m away, not 200 m. At 200 m almost any move hid the observer on Gentle too (93% within 60 m), so the number couldn't tell the terrains apart.
- **Ridges and valleys:** ridged noise made sharp crests that were steep at any scale, so ridges became smooth bands along noise zero lines. Carved valley bands cost steepness without adding cover and were dropped; Hilly's valleys are the low ground between its much taller hills.
- **Trade-off and guardrails:** cover ≥ 1.5× Gentle could not be had with ≤ 5% steep ground (about 52% cover at 5%). You chose the cover target, so the steep limit is 7%. The spawnable floor is 70%, checked on the average as in the report; carved shores are steeper on Hilly. A full-set-of-enemies simulation test covers spawning per seed.
- **Spawn:** profiles gained `spawnFloor` (Gentle 0.12, unchanged; Hilly 0.06) so the spawn stays level on taller hills.
- **Option labels:** the Terrain select shows just "Gentle" and "Hilly". The longer descriptions overflowed the Battlefield panel at desktop width.
- **Final Hilly profile:** hills 46 m at 640 m, detail 4 m at 120 m, ridges 8 m at 400 m (width 0.4), basin floor 0.6. Survey numbers are in the PRD.
- **Found for M2:** rivers often fail to fit Hilly (Huge seed 42 has none), and the retried layouts roughly double generation time (Huge 1.3 s, in the worker).
