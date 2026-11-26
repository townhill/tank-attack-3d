# Graph Report - tank-attack-3d  (2026-10-31)

## Corpus Check
- 148 files · ~244,586 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1909 nodes · 5933 edges · 84 communities (74 shown, 10 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 622 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9053a8dd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Collision.ts
- WorldGenerator.ts
- Synth Sound Effects
- deckHeightAt
- Audio Test Fakes
- audio.test.ts
- Package & Lint Config
- Tactical Map View
- Tactical Unit Symbols
- VECTOR TANKS
- worldLoader.test.ts
- Voice
- three
- Audio Manager & Mixer
- .constructor
- lakeMirror.ts
- Menu
- WorldView.ts
- ai.test.ts
- Radar Display
- math.ts
- .frame
- Visual Effects Bursts
- World
- TypeScript Config
- Simulation
- .applySettings
- aiming.test.ts
- TankModel.ts
- waves.test.ts
- bridgeDetail.ts
- ObstacleView.ts
- Menu.ts
- Water.ts
- Audio Loop Graph
- distanceField.ts
- Game.ts
- main.ts
- Graphify Project Rules
- Tank View & Tracks
- combat.test.ts
- Plan: Hilly Terrain — Hilly fully playable
- Terrain
- Effects.ts
- MinHeap
- Tasks
- Game
- MapProjection
- tacticalWater.test.ts
- MaterialLibrary
- Fake Audio Params
- HUD
- battlefieldSurvey.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- geometry.ts
- Terrain
- HudPresenter.ts
- Radar.ts
- GraphicsModeSpec
- NavGrid
- EnemyController
- WorldView.ts
- combat.test.ts
- coverReport.test.ts
- Tank
- tacticalData.ts
- Random
- BridgePlacer.ts
- Hilly Terrain Option
- WorldLoader.ts
- settings.ts
- EnemyAI.ts
- events.ts
- SegmentList
- Plan: Hilly Terrain — Tuned and shipped
- carveRiver
- Game.ts
- generateHeights
- Tasks
- AutoQuality.ts
- Tasks
- planRivers

## God Nodes (most connected - your core abstractions)
1. `World` - 101 edges
2. `Tank` - 93 edges
3. `Simulation` - 78 edges
4. `Terrain` - 68 edges
5. `clamp()` - 61 edges
6. `Random` - 59 edges
7. `Game` - 58 edges
8. `TacticalMap` - 51 edges
9. `vitest` - 46 edges
10. `Obstacle` - 39 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `Task 5: Hilly heights` --references--> `SimplexNoise2D`  [INFERRED]
  .claude/plans/hilly-terrain.plan.md → src/utils/noise.ts
- `Random` --implements--> `mulberry32 seeded RNG`  [INFERRED]
  src/utils/random.ts → README.md
- `Risks` --references--> `shoreHeight()`  [INFERRED]
  .claude/plans/hilly-terrain-m2.plan.md → src/world/WaterGenerator.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (84 total, 10 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.15
Nodes (26): exitScratch, isOnDeck(), pointInsideBridge(), segmentVsBridge(), belowTerrain(), belowWater(), circleVsObstacle(), clipSlab() (+18 more)

### Community 1 - "WorldGenerator.ts"
Cohesion: 0.09
Nodes (33): TERRAIN_TYPES, boundRadiusOf(), BoxShape, CircleShape, ObstacleKind, ObstacleShape, STOREY_HEIGHT, planLakes() (+25 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.20
Nodes (35): steppedGlide(), impactRecipeFor(), playDestroyed(), playEventSound(), playImpact(), playPlayerDamaged(), burst(), cannon() (+27 more)

### Community 3 - "deckHeightAt"
Cohesion: 0.35
Nodes (11): addCentreline(), addLamps(), addRailings(), addStiffeners(), addStringers(), addTrusses(), bridgeDetailSegments(), parapetCentre() (+3 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.06
Nodes (14): FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain, fakeMixer(), FakeNode (+6 more)

### Community 5 - "audio.test.ts"
Cohesion: 0.08
Nodes (49): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, crushCurve(), distanceGain(), ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES (+41 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.09
Nodes (3): context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.09
Nodes (33): fitScale(), niceScaleLength(), AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS (+25 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.07
Nodes (26): 3D Tanks (1989 Acorn Archimedes), Architecture, Battlezone (1980 arcade), Compact radar, Controls, Difficulty, Easy / Normal / Hard difficulty levels, Directional damage zones and armour (+18 more)

### Community 10 - "worldLoader.test.ts"
Cohesion: 0.15
Nodes (8): createStaticHit(), WorldReply, transferablesOf(), WorkerScope, expectSameWorld(), FakeWorker, postAcross(), StubWorker

### Community 11 - "Voice"
Cohesion: 0.15
Nodes (3): playFire(), Voice, VoicePool

### Community 12 - "three"
Cohesion: 0.14
Nodes (15): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), three, ColourPair (+7 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.14
Nodes (6): AudioManager, Mixer, getAudioContextCtor(), NoiseBank, AudioFrame, unlockedManager()

### Community 14 - ".constructor"
Cohesion: 0.14
Nodes (5): SettingsStore, BestScoreStore, KeyValueStore, MemoryStore, MemoryStore

### Community 15 - "lakeMirror.ts"
Cohesion: 0.07
Nodes (21): ahead, clip, CLIP_TO_TEXTURE, corner, eye, lakeReach(), MIN_EYE_HEIGHT, mirrorCamera() (+13 more)

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView.ts"
Cohesion: 0.12
Nodes (7): BridgeView, FordView, LakeReflection, ObstacleView, ProjectileView, createEnvironmentScene(), WorldView

### Community 18 - "ai.test.ts"
Cohesion: 0.12
Nodes (24): steerTowards(), decideNextState(), engageState(), isCombatState(), shouldEvade(), shouldRetreat(), TransitionInput, BASE_INPUT (+16 more)

### Community 19 - "Radar Display"
Cohesion: 0.15
Nodes (5): viewAngle(), Radar, GraphicsModeId, rgba(), tacticalTheme

### Community 20 - "math.ts"
Cohesion: 0.12
Nodes (29): NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight, scratchUp (+21 more)

### Community 23 - "World"
Cohesion: 0.13
Nodes (20): Bridge, bridgeBoundRadius(), Obstacle, ObstacleGrid, Ford, Lake, River, WaterMap (+12 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation"
Cohesion: 0.10
Nodes (12): Design principles, Per-tick GameEvent list, Three.js, GameEvent, createPlayerCommand(), Simulation, ClosingIn, riverBattle() (+4 more)

### Community 27 - "aiming.test.ts"
Cohesion: 0.09
Nodes (8): PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget(), AimState

### Community 28 - "TankModel.ts"
Cohesion: 0.16
Nodes (19): mergeParts(), scalePolygon(), buildBarrel(), buildHull(), buildMantlet(), buildTurret(), cache, getTankGeometry() (+11 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.19
Nodes (12): DifficultySpec, EnemyKind, WAVES, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition(), waveEnemyCount() (+4 more)

### Community 30 - "bridgeDetail.ts"
Cohesion: 0.10
Nodes (30): BridgeStyle, bridgeStyles(), CUTWATER_LENGTH, DASH_GAP, DASH_LENGTH, DASH_LIFT, GIRDER_DEPTH, GIRDER_HALF_WEB (+22 more)

### Community 31 - "ObstacleView.ts"
Cohesion: 0.20
Nodes (13): box(), edgePositions(), transformSegments(), buildingModel(), ChunkBuild, Facade, facadeDetail(), facadeRect() (+5 more)

### Community 32 - "Menu.ts"
Cohesion: 0.14
Nodes (17): MAP_SIZES, DIFFICULTIES, GRAPHICS_MODES, GraphicsModeId, MAP_SIZE_IDS, MapIntel, pickBoolean(), pickNumber() (+9 more)

### Community 33 - "Water.ts"
Cohesion: 0.12
Nodes (31): BRIDGE, WATER, BridgeLocal, createBridgeLocal(), toBridgeLocal(), FORD_BRIDGE_CLEARANCE, FORD_DEPTH, FORD_HALF_LENGTH (+23 more)

### Community 34 - "Audio Loop Graph"
Cohesion: 0.19
Nodes (3): EnemyEngines, LoopGraph, smooth()

### Community 35 - "distanceField.ts"
Cohesion: 0.11
Nodes (11): PushResult, DistanceField, lowerEnvelope(), PlanarVector, squaredDistances(), FORD_TAPER, BRIDGE_LINK_OFFSET, FORD_LINK_OFFSET (+3 more)

### Community 36 - "Game.ts"
Cohesion: 0.32
Nodes (10): DIFFICULTY, TANK_SPECS, accuracy(), createStats(), formatTime(), GameStats, killScore(), waveClearBonus() (+2 more)

### Community 37 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.20
Nodes (5): PartGeometry, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 40 - "combat.test.ts"
Cohesion: 0.11
Nodes (13): createProjectileHit(), fireWeapon(), invQuat, localA, localB, muzzleDir, muzzlePos, staticHit (+5 more)

### Community 41 - "Plan: Hilly Terrain — Hilly fully playable"
Cohesion: 0.25
Nodes (7): Acceptance, Decisions taken in this plan (change before approving), Outcome (2026-10-31, not committed), Plan: Hilly Terrain — Hilly fully playable, Risks, Summary, Validation

### Community 42 - "Terrain"
Cohesion: 0.09
Nodes (19): vitest, DEFAULT_SETTINGS, lakeVertexIds(), buildChunk(), FLOW_PEAK_SPEED, riverFlowField(), vertexRange(), Terrain (+11 more)

### Community 43 - "Effects.ts"
Cohesion: 0.13
Nodes (6): Emitter, FlashSlot, LightSlot, RingSlot, ParticleSpawn, ParticleSystem

### Community 45 - "Tasks"
Cohesion: 0.22
Nodes (8): Task 2: Battlefield survey (the measuring stick), Task 3: Measure the Gentle baseline, Task 4: Move Gentle's numbers into a height profile, Task 5: Hilly heights, Task 7: Check in the browser and wrap up, Tasks, TerrainProfile, WorldGenOptions

### Community 46 - "Game"
Cohesion: 0.12
Nodes (4): window.__vt development debug handle, Development summary, Game, mapSizeLabel()

### Community 47 - "MapProjection"
Cohesion: 0.21
Nodes (4): MapProjection, Contact, unitColor(), projection()

### Community 48 - "tacticalWater.test.ts"
Cohesion: 0.17
Nodes (15): drawBridgeSymbol(), drawFordSymbol(), drawMapBridges(), drawMapFords(), FORD_BANK_REACH, fordSignAngle(), ShorelineIndex, crossEdge() (+7 more)

### Community 49 - "MaterialLibrary"
Cohesion: 0.14
Nodes (5): makeFlashTexture(), createEdge(), createSolid(), MaterialLibrary, Sky

### Community 51 - "HUD"
Cohesion: 0.13
Nodes (10): css(), el(), HELP_HTML, HUD, HudFrame, HudTarget, Indicator, MAX_HUD_TARGETS (+2 more)

### Community 52 - "battlefieldSurvey.ts"
Cohesion: 0.23
Nodes (14): coverDistance(), DEFAULT_SURVEY, GroundStats, isHidden(), isOpenGround(), NO_COVER_DISTANCE, percentile(), placeAround() (+6 more)

### Community 56 - "geometry.ts"
Cohesion: 0.33
Nodes (8): centroid2(), extrudeProfileX(), flipWinding(), loft(), polygon(), prismAlongZ(), TriangleBuilder, Vec2

### Community 57 - "Terrain"
Cohesion: 0.13
Nodes (22): LakeKind, chaikin(), DEPTH_RANGE, describeRiver(), dilateLevels(), HALF_WIDTH_RANGE, isNearLake(), isNearRiver() (+14 more)

### Community 58 - "HudPresenter.ts"
Cohesion: 0.23
Nodes (8): HudPresenter, AIM_LIMITS, CAMERA_LABELS, CAMERA_LIMITS, CAMERA_MODES, CameraMode, headingOf(), toCompassDegrees()

### Community 59 - "Radar.ts"
Cohesion: 0.14
Nodes (19): bearingOf(), clampToRadius(), formatDistance(), gridColumnLetter(), gridIndex(), gridLabel(), NICE_STEPS, Point2 (+11 more)

### Community 61 - "NavGrid"
Cohesion: 0.07
Nodes (20): Crossing, deckX(), deckZ(), farEnd(), NavPlanner, preference(), travelDirection(), NEIGHBOURS (+12 more)

### Community 62 - "EnemyController"
Cohesion: 0.19
Nodes (3): EnemyController, AIState, Mission

### Community 63 - "WorldView.ts"
Cohesion: 0.16
Nodes (14): QualityLevel, CRT_SHADER, QUALITY_PRESETS, QualityPreset, RenderConfig, REFLECT_DEFINE, reflectsLakes(), RIPPLES_DEFINE (+6 more)

### Community 64 - "combat.test.ts"
Cohesion: 0.15
Nodes (19): Aiming, Gunner / chase / tactical cameras, Gun marker (actual barrel aim indicator), ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight() (+11 more)

### Community 65 - "coverReport.test.ts"
Cohesion: 0.14
Nodes (13): Patterns to Mirror, Task 1: Held-out cover check, GENTLE, HELD_OUT_SEEDS, HILLY, mean(), measure(), Measured (+5 more)

### Community 66 - "Tank"
Cohesion: 0.11
Nodes (14): Task 1: Lock Gentle before touching it, ProjectileHit, TankSpec, Tank, AimSolver, hashSeed(), HeightField, Harness (+6 more)

### Community 67 - "tacticalData.ts"
Cohesion: 0.16
Nodes (11): ContactTracker, CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH, MOUNTAIN_DIM, sampleDepths(), sampleHeights(), shadeRelief() (+3 more)

### Community 68 - "Random"
Cohesion: 0.18
Nodes (4): GRAD2, Random, FAR_DISTANCE, randomMask()

### Community 69 - "BridgePlacer.ts"
Cohesion: 0.16
Nodes (19): smoothstep(), kerbPush(), parapetPush(), BANK_LINES, bankDistance(), buildBridge(), Crossing, gradeApproaches() (+11 more)

### Community 70 - "Hilly Terrain Option"
Cohesion: 0.18
Nodes (10): Delivery Milestones, Evidence, Hilly Terrain Option, Hypothesis, Open Questions, Problem, Risks, Scope (+2 more)

### Community 71 - "WorldLoader.ts"
Cohesion: 0.10
Nodes (22): Acceptance, Decisions taken in this plan (change before approving), Files to Change, Outcome (2026-10-31), Patterns to Mirror, Plan: Hilly Terrain — Terrain choice, Risks, Summary (+14 more)

### Community 72 - "settings.ts"
Cohesion: 0.18
Nodes (11): AI, BASE_GEOMETRY, MapSizeSpec, NoiseLayer, RidgeLayer, SIM_DT, SIM_HZ, TerrainTypeSpec (+3 more)

### Community 73 - "EnemyAI.ts"
Cohesion: 0.12
Nodes (15): Gaussian aim error, AIContext, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint (+7 more)

### Community 74 - "events.ts"
Cohesion: 0.27
Nodes (12): hitZone, HitSurface, Faction, TankKind, EnemySpawnedEvent, FireEvent, GameOverEvent, ImpactEvent (+4 more)

### Community 75 - "SegmentList"
Cohesion: 0.20
Nodes (9): BANK_SIDES, FORD_ENDS, FORD_MARKER_HEIGHT, FORD_MARKER_SETBACK, fordMarkerSegments(), SegmentList, ObstacleModel, ford (+1 more)

### Community 76 - "Plan: Hilly Terrain — Tuned and shipped"
Cohesion: 0.22
Nodes (8): Acceptance, Decisions taken in this plan (change before approving), Files to Change, Outcome (2026-10-31), Plan: Hilly Terrain — Tuned and shipped, Risks, Summary, Validation

### Community 77 - "carveRiver"
Cohesion: 0.38
Nodes (10): Files to Change, Patterns to Mirror, Task 2: Valley bench (Hilly only), RiverValley, carveLake(), carveRiver(), raiseLevel(), shoreHeight() (+2 more)

### Community 78 - "Game.ts"
Cohesion: 0.10
Nodes (15): Performance overlay, Quality, Quality presets with auto-reduce, browserStorage(), bridgeApproach(), fordApproach(), nearest(), Placement (+7 more)

### Community 79 - "generateHeights"
Cohesion: 0.36
Nodes (4): mulberry32 seeded RNG, Seeded procedural battlefield, SimplexNoise2D, generateHeights()

### Community 80 - "Tasks"
Cohesion: 0.29
Nodes (7): Task 1: Pin the failure in a test, Task 3: Re-tune Hilly cover, Task 4: Fords on Hilly, Task 5: Enemies close in on Hilly, Task 6: Generation-time budget, Task 7: Browser check and wrap-up, Tasks

### Community 81 - "AutoQuality.ts"
Cohesion: 0.29
Nodes (6): QUALITY_LEVELS, AutoQuality, QualityStep, SLOW_FPS, SLOW_SECONDS, run()

### Community 82 - "Tasks"
Cohesion: 0.29
Nodes (7): Task 2: Metric 2 threshold and guardrail, Task 3: Hand over the playtest kit, then stop, Task 4: Tune from the results, Task 5: README, Task 6: Screenshots, Task 7: Validate and close out, Tasks

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 426 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Collision.ts`, `WorldGenerator.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `worldLoader.test.ts`, `three`, `WorldView.ts`, `ai.test.ts`, `Radar Display`, `math.ts`, `.frame`, `Simulation`, `waves.test.ts`, `bridgeDetail.ts`, `ObstacleView.ts`, `Water.ts`, `distanceField.ts`, `Game.ts`, `combat.test.ts`, `Terrain`, `Tasks`, `Game`, `tacticalWater.test.ts`, `battlefieldSurvey.ts`, `Radar.ts`, `NavGrid`, `WorldView.ts`, `combat.test.ts`, `Tank`, `tacticalData.ts`, `BridgePlacer.ts`, `WorldLoader.ts`, `EnemyAI.ts`, `SegmentList`, `Game.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Terrain` (e.g. with `Files to Change` and `Task 6: The player's choice, end to end`) actually correct?**
  _`Terrain` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `WorldGenerator.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08985200845665962 - nodes in this community are weakly interconnected._
- **Why does `Game` connect `Game` to `Tank`, `HudPresenter.ts`, `audio.test.ts`, `main.ts`, `WorldLoader.ts`, `Tactical Map View`, `three`, `Audio Manager & Mixer`, `Game.ts`, `.constructor`, `Menu`, `WorldView.ts`, `HUD`, `Radar Display`, `.frame`, `Simulation`, `.applySettings`, `aiming.test.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.06456456456456457 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Terrain` to `Collision.ts`, `WorldGenerator.ts`, `audio.test.ts`, `Package & Lint Config`, `worldLoader.test.ts`, `.constructor`, `lakeMirror.ts`, `ai.test.ts`, `math.ts`, `World`, `Simulation`, `waves.test.ts`, `bridgeDetail.ts`, `Water.ts`, `Game.ts`, `combat.test.ts`, `MinHeap`, `tacticalWater.test.ts`, `HudPresenter.ts`, `Radar.ts`, `NavGrid`, `WorldView.ts`, `combat.test.ts`, `coverReport.test.ts`, `Random`, `settings.ts`, `SegmentList`, `Game.ts`, `AutoQuality.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._