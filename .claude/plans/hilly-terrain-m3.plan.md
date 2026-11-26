# Plan: Hilly Terrain — Tuned and shipped

**Source PRD**: .claude/prds/hilly-terrain.prd.md
**Selected Milestone**: 3 — Tuned and shipped
**Complexity**: Small to Medium (mostly measurement, docs and screenshots; tuning only if playtests or the held-out check call for it)
**Branch**: `feat/hilly-terrain-tuning`, cut from master at 9053a8d (PR townhill/tank-attack-3d#4). It already carries the PRD edit marking milestones 1 and 2 complete.

## Summary
**Where Hilly stands** (cover report, 2026-10-31, same seeds as before):

| | Hidden, all ranges | Hidden, 60–150 m | Median move to cover | Cover within 60 m | Too steep | Lakes and ponds placed |
|---|---|---|---|---|---|---|
| Gentle Standard / Large / Huge | 37.6 / 38.9 / 43.8% | 22.7 / 24.0 / 25.8% | 20 / 23 / 25 m | 85.5 / 82.7 / 83.1% | 0.1% | 3.0 of 3 / 12 of 12 / 27 of 27 |
| Hilly Standard / Large / Huge | 56.5 / 57.9 / 57.5% | 41.1 / 42.6 / 40.6% | 8 / 5 / 15 m | 91.4 / 89.1 / 91.3% | 6.1 / 6.4 / 6.2% | 2.8 of 3 / 10.5 of 12 / 23 of 27 |

- **Metric 1 (cover, line of sight):** met, but Standard clears 56.4% by only 0.1 point, on the same 12 seeds Hilly was tuned against.
- **Metric 2 (cover in play):** the PRD leaves its threshold TBD until the first playtests. The survey's version is already better on Hilly: tanks find cover in under half the distance.
- **Open questions 1 and 2** (how steep is too steep; keep the spawn level) both wait on playtests.

**What M3 does**, in four stages with one stop:
1. **Before playtests (me):** check that the cover target holds on seeds Hilly was never tuned on, write the metric 2 threshold into the PRD and its tests, and hand you a short playtest kit.
2. **Playtests (you):** about six Hilly matches. **I stop here until you report back.**
3. **Tuning (me), only if stage 1 or 2 calls for it:** adjust the Hilly profile within the guardrails, re-measure, and record the answers to open questions 1 and 2.
4. **Ship (me):** README, two new screenshots taken after any tuning, full validation, then a PR when you ask.

## Decisions taken in this plan (change before approving)
1. **Metric 2 threshold.**
   - **Survey:** at every map size, Hilly's median move to cover is no longer than Gentle's, and at least 85% of positions have cover within 60 m. Hilly already meets this; it becomes a guardrail so tuning can't lose it.
   - **Playtests:** in at least 5 of 6 Hilly matches, you could break line of sight within a short drive whenever you needed to.
2. **Held-out check.** I'll survey 36 Standard seeds that tuning never used (113–148). The cover target there is a ratio: Hilly must hide at least 1.5× what Gentle hides on the same seeds, at all ranges and at 60–150 m.
   - If it falls short, a small bump: ridges 9 → 10 m first, then detail 5 → 6 m.
   - Every guardrail below must still hold. If they can't all hold together, I'll stop and show you the trade-off, as in M1.
3. **Playtest kit.**
   - **Seeds:** Standard 101, 105 and 109; Large 201; Huge 301; plus one random seed. The first five are in the survey set, so I can compare what you felt with what was measured.
   - **How to play one:** set Terrain to Hilly, keep Normal difficulty, and open the game with `?seed=101` (and so on) in the URL. The banner shows the seed.
   - **Optional comparison:** play seed 101 once on Gentle as well.
   - **What to note for each match** (a line or two each is plenty):
     - **Cover:** could you get out of sight within a short drive?
     - **Steepness:** did any climb crawl or stop you?
     - **Enemies:** did they find you? Did any get stuck, or did fights stall?
     - **Spawn:** is a flat start fine, or would you want cover from the first second?
     - **Anything that looks wrong:** banks, bridges, floating rocks.
4. **How feedback maps to changes** (Hilly profile in `settings.ts` only):

   | You report | Change | Watch |
   |---|---|---|
   | Climbs too slow or steep | Hills 46 → about 40 m, or ridges 9 → 8 m | Cover ratio |
   | Cover too far away | Detail 5 → 6 m (small folds near the tank) | Steep share |
   | Too much cover; fights stall or enemies are hard to find | Ridges 9 → 8 m | Cover ratio |
   | Want cover from the start | Spawn floor 0.06 → about 0.25, so the start keeps some relief | Spawn slope at most 0.3 within 30 m; spawnable share |
   | Nothing | No change; the open questions close as "keep as is" | — |

5. **Guardrails every change must keep:**
   - Gentle fingerprints identical.
   - Cover at least 1.5× Gentle on both the tuning and the held-out seeds.
   - Metric 2 survey threshold met.
   - Steep ground at most 7%; spawnable ground at least 70%.
   - Every river kept, with at least 2 bridges each.
   - Enemies still close in.
   - Generation at most 1.5× Gentle's time.
6. **Screenshots:** two new ones, taken after tuning:
   - `hilly-valley.jpg`: chase view along a Hilly valley with its river and a bridge.
   - `hilly-tactical-map.jpg`: a Hilly tactical map with dense contours.

   Both go in a fourth row of the README's screenshot table, in Neon at 1600×900, captured with the chrome-devtools tools as in the water feature.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Survey report | [coverReport.test.ts](tests/coverReport.test.ts) | `SEEDS` per size, `measure()` builds a row, one printed table, opt-in through `COVER_REPORT=1` |
| Guardrail tests | [hillyTerrain.test.ts](tests/hillyTerrain.test.ts) | Named constants at the top (`COVER_TARGET_RATIO`, `MAX_STEEP_SHARE`), means over seeds 1, 42 and 2026, behaviour-sentence names |
| Terrain tuning | `TERRAIN_TYPES.hilly` in [settings.ts](src/config/settings.ts) | Numbers with comments explaining why; Gentle untouched |
| README features | `### Map size` and `### Water and bridges` in [README.md](README.md) | A short lead sentence, a comparison table, then bullets; settings named as **Settings → Battlefield → …** |
| README screenshots | The `<table>` under `## Screenshots` | Pairs of 50% images, alt text that describes the scene, a bold caption row |
| Screenshot capture | water-bridges M5 | chrome-devtools viewport 1600×900, `take_screenshot` to a file, saved as `.jpg`; drive the game with `window.__vt.debugCommand(...)` |
| Errors | — | No new runtime code paths, so no new error handling |

## Files to Change
| File | Action | Why |
|---|---|---|
| `tests/coverReport.test.ts` | UPDATE | Held-out Standard seeds 113–148 for both terrains, with Hilly-to-Gentle cover ratios |
| `tests/hillyTerrain.test.ts` | UPDATE | Metric 2 guardrail: median move to cover no longer than Gentle's, and at least 85% within 60 m |
| `src/config/settings.ts` | UPDATE (only if needed) | Hilly profile tuning from the held-out check or playtests |
| `README.md` | UPDATE | Terrain section, intro, screenshots, architecture, testing, limitations, future work, development summary |
| `docs/screenshots/hilly-valley.jpg`, `docs/screenshots/hilly-tactical-map.jpg` | CREATE | New screenshots |
| `.claude/prds/hilly-terrain.prd.md` | UPDATE | Milestone 3 in progress; metric 2 threshold; held-out and playtest results; open questions 1 and 2; milestone 3 complete at the end |
| `graphify-out/*` | UPDATE | `graphify update .` after the code changes |

## Tasks
### Task 1: Held-out cover check
- **Action**: Add a held-out row set to the cover report: Standard seeds 113–148 on both terrains, printing Hilly-to-Gentle ratios at all ranges and at 60–150 m. Run it. If a ratio is under 1.5, apply decision 2.
- **Mirror**: `SEEDS` and `measure()` in `coverReport.test.ts`.
- **Validate**: `COVER_REPORT=1 npx vitest run tests/coverReport.test.ts --silent=false` (run with the preview server stopped).

### Task 2: Metric 2 threshold and guardrail
- **Action**: Write the decision 1 threshold into the PRD's Success Metrics, with the measured numbers. Add a test to `hillyTerrain.test.ts` for the median move to cover and the share within 60 m, compared with Gentle on the same seeds.
- **Mirror**: The cover-ratio tests in `hillyTerrain.test.ts`.
- **Validate**: `npx vitest run tests/hillyTerrain.test.ts`

### Task 3: Hand over the playtest kit, then stop
- **Action**: Give you the seeds, the setup and the notes to take (decision 3). Wait for your results.
- **Validate**: Your report.

### Task 4: Tune from the results
- **Action**: Apply decision 4 to what you report, one lever at a time, re-running the report and the Hilly tests after each change. Record the playtest results and the answers to open questions 1 and 2 in the PRD. If you'd like to feel a change before it lands, I'll pause for another short playtest.
- **Mirror**: The M2 re-tune: profile numbers in `settings.ts`, measured in the same report run.
- **Validate**: `npx vitest run tests/hillyTerrain.test.ts tests/gentleTerrain.test.ts tests/aiHilly.test.ts tests/fords.test.ts`, plus the cover report.

### Task 5: README
- **Action**:
  - **Intro:** the *Battlefields* bullet mentions Gentle or Hilly ground.
  - **New `### Terrain` section after `### Map size`:**
    - Where the setting lives: **Settings → Battlefield → Terrain (new battlefields)**.
    - A Gentle vs Hilly table: relief, hidden at fighting range, median move to cover, steep ground.
    - The HILLY banner, and that Hilly changes the battlefield a seed gives.
    - Rivers carve gentle valley benches so bridges fit; the spawn stays level, or whatever the playtests decide.
  - **Architecture:** `settings.ts` holds terrain profiles.
  - **Testing:**
    - Update the counts.
    - Add bullets for the terrain types: Gentle fingerprints, Hilly cover and its guardrails, Hilly rivers, fords and enemies, and the opt-in cover report command.
  - **Known limitations:**
    - Hilly finds fewer lake sites.
    - Enemies drive over hills but don't use them for cover.
  - **Possible future improvements:** more terrain types (Mountainous, Canyons), and enemies using hills for cover or ambush.
  - **Development summary:**
    - Terrain choice under implemented features.
    - The new test count.
    - A Hilly line in the browser smoke test.
- **Mirror**: `### Map size` and `### Water and bridges`.
- **Validate**: Read it rendered on GitHub after pushing; check that every number matches the final report.

### Task 6: Screenshots
- **Action**: Take the two screenshots from decision 6 after tuning. Add the fourth table row with alt text and captions.
- **Mirror**: The water-feature screenshots and table row.
- **Validate**: Open both images. Check that they are 1600×900, in Neon, with no HUD clutter over the subject.

### Task 7: Validate and close out
- **Action**: Run full validation and rebuild the graph. Mark milestone 3 complete in the PRD and change its status line from DRAFT. Fill in an Outcome section here. Commit and open a PR when you ask.
- **Validate**: See below.

## Validation
```bash
npm run typecheck
npm run lint
npm test
npm run coverage
npm run build
COVER_REPORT=1 npx vitest run tests/coverReport.test.ts --silent=false
graphify update .
```
Plus a browser check:
- Play a Hilly seed in all three graphics modes.
- Drive over a ridge.
- The tactical map and radar draw.
- No console errors.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| The held-out seeds show the cover target was luck of the 12 tuning seeds | Medium | Decision 2's small bump; stop and show the trade-off if the guardrails can't all hold |
| Playtest feedback pulls against the cover target (for example, "too steep" with cover at the margin) | Medium | One lever at a time, measured; the trade-off comes back to you rather than me picking |
| One player's playtests | High | Recorded as such in the PRD evidence; more players stay an open validation |
| Screenshots go stale if tuning changes later | Low | Taken last, after tuning |
| The opt-in report's 1.5× timing check is noisy (Large measured 1.40× today, 1.29× before) | Medium | Run with the preview stopped and the machine quiet; repeat once before acting on a failure |
| A hilly spawn (if chosen) puts the player on a slope at the start | Low | Keep the spawn slope at most 0.3 within 30 m, and update the test that keeps the spawn level |

## Acceptance
- [ ] The held-out check passes, or the trade-off was decided by you.
- [ ] The metric 2 threshold is in the PRD and guarded by a test.
- [ ] Playtests are done and recorded; open questions 1 and 2 are answered.
- [ ] Any tuning keeps every guardrail.
- [ ] The README and the two screenshots are updated and match the final numbers.
- [ ] Validation passes and the graph is rebuilt.

**Not in M3:** more terrain types, enemies using hills tactically, making Hilly the default, and rivers that flow through lakes. These stay in the PRD's "not ruled out" list.

## Outcome (2026-10-31)
- **Held-out check:** with 9 m ridges, Hilly hid 1.496× what Gentle hid on seeds 113–148, just short of 1.5×. I measured three variants:

  | Variant | Held-out ratio | Steep: Standard / Large / Huge |
  |---|---|---|
  | Ridges 9.5 m | 1.50× | 6.4 / 6.7 / 6.3% |
  | Ridges 10 m | 1.51× | 6.8 / 7.1 / 6.6% |
  | Detail 6 m | 1.51× | 6.9 / 7.3 / 6.7% |

  9.5 m is the only one that meets the target with every guardrail held, so it is adopted. Hilly now sits on the target rather than above it: any more cover costs steep ground.
- **Metric 2:** the threshold is written into the PRD. It is guarded in `hillyTerrain.test.ts` (Standard) and in the opt-in report (every size). Hilly's median move to cover is 5–10 m against Gentle's 20–25 m, and 90–94% of positions have cover within 60 m.
- **Report:** the cover report now has a held-out case and checks metric 2 at every size. Its main case still checks generation time, at 0.79–1.40× Gentle's across runs.
- **Playtest:** you reported "I've played it and it's good", so nothing was tuned after the held-out change. Open questions 1 and 2 closed as "keep as is": about 6.5% steep ground, and a level spawn. Per-match notes weren't recorded.
- **README:**
  - New Terrain section, intro line and terrain profiles under architecture.
  - Testing: 941 tests in 43 files, terrain-type bullets and the opt-in report command.
  - Known limitations, future work and the development summary updated.
  - A fourth screenshot row.
- **Screenshots:** `hilly-valley.jpg` (chase view from a hillside into seed 42's river valley) and `hilly-tactical-map.jpg` (seed 42's whole battlefield), both 1600×900 in Neon.
  - The chrome-devtools browser was held by another Claude Code session, so I used the built-in browser.
  - That pane only displays 800×450, so I froze a frame, scaled `#app` 2× with CSS, captured four 800×450 quarters and joined them with ImageMagick.
- **Browser check (seed 42, Hilly):**
  - Neon, Hybrid and Classic all render.
  - A tank climbed 61 m to a ridge top at 25.7 m and over it, staying within 0.12 m of the ground.
  - The tactical map and radar draw.
  - No console errors.
  - The pane's settings were restored afterwards.
- **Validation:** typecheck, lint, all 941 tests, the build and coverage pass (97.8% statements, 94.4% branches). The opt-in report's two cases pass, and the graph is rebuilt.
