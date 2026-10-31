# Graph Report - tank-attack-3d  (2026-10-31)

## Corpus Check
- 145 files · ~226,824 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1862 nodes · 5854 edges · 81 communities (73 shown, 8 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 602 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cdb13fc7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Collision.ts
- Random
- Synth Sound Effects
- World.ts
- Audio Test Fakes
- audioMath.ts
- Package & Lint Config
- Tactical Map View
- Tactical Unit Symbols
- VECTOR TANKS
- worldLoader.test.ts
- Voice
- Graphics modes
- Audio Manager & Mixer
- Game.ts
- lakeMirror.ts
- Menu
- WorldView.ts
- ai.test.ts
- Radar Display
- math.ts
- .frame
- Visual Effects Bursts
- WorldGenerator.ts
- TypeScript Config
- Simulation
- .applySettings
- aiming.test.ts
- EnemyAI.ts
- waves.test.ts
- Random
- tacticalWater.test.ts
- Enemy Controller
- Water.ts
- Audio Loop Graph
- pathFinder.test.ts
- settings.ts
- main.ts
- Graphify Project Rules
- Tank View & Tracks
- WeaponSystem.ts
- aiWater.test.ts
- Terrain
- Effects.ts
- NavGrid
- Plan: Hilly Terrain — Terrain choice
- Game
- .drawGhost
- World
- MaterialLibrary
- Fake Audio Params
- .startNewGame
- battlefieldSurvey.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- NavPlanner
- Terrain
- events.ts
- MapProjection.ts
- KeyValueStore
- aiming.test.ts
- WorldLoader.ts
- WorldView.ts
- Tank.ts
- coverReport.test.ts
- Tank
- tacticalData.ts
- AutoQuality.ts
- combat.test.ts
- Hilly Terrain Option
- .planLeg
- shoreline.ts
- MinHeap
- generateWorld
- NavGrid.ts
- HudPresenter.ts
- WorldLoader
- navPlanner.test.ts
- StateMachine.ts
- worldFingerprint.ts

## God Nodes (most connected - your core abstractions)
1. `World` - 101 edges
2. `Tank` - 93 edges
3. `Simulation` - 76 edges
4. `Terrain` - 68 edges
5. `clamp()` - 61 edges
6. `Random` - 59 edges
7. `Game` - 58 edges
8. `TacticalMap` - 51 edges
9. `vitest` - 45 edges
10. `Obstacle` - 39 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `Task 5: Hilly heights` --references--> `SimplexNoise2D`  [INFERRED]
  .claude/plans/hilly-terrain.plan.md → src/utils/noise.ts
- `zoneMultiplier()` --implements--> `Directional damage zones and armour`  [INFERRED]
  src/combat/DamageSystem.ts → README.md
- `Patterns to Mirror` --references--> `MapSize`  [INFERRED]
  .claude/plans/hilly-terrain.plan.md → src/config/settings.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (81 total, 8 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.11
Nodes (38): travelDirection(), BRIDGE, lerp(), BANK_LINES, bankDistance(), Crossing, gradeApproaches(), placeBridges() (+30 more)

### Community 1 - "Random"
Cohesion: 0.14
Nodes (10): mulberry32 seeded RNG, Seeded procedural battlefield, GRAD2, SimplexNoise2D, Random, FAR_DISTANCE, generateHeights(), generateObstacles() (+2 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.21
Nodes (36): fireTimbre, steppedGlide(), impactRecipeFor(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged() (+28 more)

### Community 3 - "World.ts"
Cohesion: 0.12
Nodes (27): girderOffsets(), pierFootprint(), bridgePieces(), bridgeBoundRadius(), createBridgeLocal(), DECK_THICKNESS, deckHeightAt(), exitScratch (+19 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (18): ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain (+10 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.07
Nodes (46): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, crushCurve(), ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams (+38 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.09
Nodes (5): fitScale(), context2d(), element(), TacticalMap, GraphicsModeId

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.08
Nodes (41): BOUNDARY_DASH, NO_DASH, RadarOrientation, RING_FRACTIONS, AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH (+33 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.08
Nodes (23): 3D Tanks (1989 Acorn Archimedes), Architecture, Battlezone (1980 arcade), Controls, Difficulty, Easy / Normal / Hard difficulty levels, Directional damage zones and armour, Enemies (+15 more)

### Community 10 - "worldLoader.test.ts"
Cohesion: 0.12
Nodes (10): browserWorldWorker(), WorldReply, WorldWorker, packWorld(), transferablesOf(), scope, WorkerScope, FakeWorker (+2 more)

### Community 11 - "Voice"
Cohesion: 0.12
Nodes (5): distanceGain(), VoiceSlot, createPanner(), Voice, VoicePool

### Community 12 - "Graphics modes"
Cohesion: 0.26
Nodes (9): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), GraphicsModeId, ColourPair (+1 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.16
Nodes (4): AudioManager, PlayerLoops, Mixer, unlockedManager()

### Community 14 - "Game.ts"
Cohesion: 0.09
Nodes (24): MAP_SIZES, browserStorage(), DIFFICULTIES, GRAPHICS_MODES, MAP_SIZE_IDS, MapIntel, pickBoolean(), pickNumber() (+16 more)

### Community 15 - "lakeMirror.ts"
Cohesion: 0.07
Nodes (23): three, ahead, clip, CLIP_TO_TEXTURE, corner, eye, lakeReach(), MIN_EYE_HEIGHT (+15 more)

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView.ts"
Cohesion: 0.11
Nodes (9): bridgeStyles(), BridgeView, FordView, transformSegments(), GraphicsModeSpec, ObstacleView, ProjectileView, createEnvironmentScene() (+1 more)

### Community 18 - "ai.test.ts"
Cohesion: 0.15
Nodes (20): AIContext, DifficultySpec, BASE_INPUT, engage(), engagedAttacker(), FixedRandom, Harness, HarnessOptions (+12 more)

### Community 19 - "Radar Display"
Cohesion: 0.16
Nodes (5): Compact radar, HUD, radar and tactical map, Tactical map, viewAngle(), Radar

### Community 20 - "math.ts"
Cohesion: 0.18
Nodes (20): angleDiff(), damp(), dampAngle(), DEG, distance2D(), distanceSq2D(), forwardX(), forwardZ() (+12 more)

### Community 21 - ".frame"
Cohesion: 0.15
Nodes (3): Gunner / chase / tactical cameras, CameraManager, CameraState

### Community 23 - "WorldGenerator.ts"
Cohesion: 0.13
Nodes (16): TERRAIN_TYPES, boundRadiusOf(), Obstacle, ObstacleKind, ObstacleShape, STOREY_HEIGHT, ObstacleGrid, DEFAULT_WORLD_OPTIONS (+8 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation"
Cohesion: 0.14
Nodes (5): Design principles, Per-tick GameEvent list, Three.js, Simulation, simWithEnemy()

### Community 26 - ".applySettings"
Cohesion: 0.08
Nodes (6): Performance overlay, Quality, Quality presets with auto-reduce, Renderer, PerfOverlay, PerfStats

### Community 27 - "aiming.test.ts"
Cohesion: 0.11
Nodes (6): applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget(), AimState

### Community 28 - "EnemyAI.ts"
Cohesion: 0.15
Nodes (17): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+9 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.16
Nodes (11): TransitionInput, EnemyKind, EnemyEntry, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition(), waveEnemyCount() (+3 more)

### Community 30 - "Random"
Cohesion: 0.05
Nodes (72): addCentreline(), addLamps(), addRailings(), addStiffeners(), addStringers(), addTrusses(), bridgeDetailSegments(), BridgeStyle (+64 more)

### Community 31 - "tacticalWater.test.ts"
Cohesion: 0.23
Nodes (10): drawFordSymbol(), drawMapBridges(), drawMapFords(), fordSignAngle(), ShorelineIndex, shorelineSegments(), compareWithBruteForce(), Extent (+2 more)

### Community 32 - "Enemy Controller"
Cohesion: 0.20
Nodes (4): EnemyController, Waypoint, AIState, isCombatState()

### Community 33 - "Water.ts"
Cohesion: 0.12
Nodes (31): vitest, WATER, BridgeLocal, buildBridge(), FORD_BRIDGE_CLEARANCE, FORD_DEPTH, FORD_HALF_LENGTH, FORD_TAPER (+23 more)

### Community 35 - "pathFinder.test.ts"
Cohesion: 0.13
Nodes (6): DistanceField, lowerEnvelope(), squaredDistances(), dryFeatures(), gridWith(), terrain

### Community 36 - "settings.ts"
Cohesion: 0.19
Nodes (17): BASE_GEOMETRY, DIFFICULTY, MapSizeSpec, NoiseLayer, RidgeLayer, SIM_HZ, TANK_SPECS, TerrainTypeSpec (+9 more)

### Community 37 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.18
Nodes (6): PartGeometry, TRACK_SEGMENT_COUNT, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 40 - "WeaponSystem.ts"
Cohesion: 0.08
Nodes (15): createProjectileHit(), fireWeapon(), invQuat, localA, localB, muzzleDir, muzzlePos, ProjectileHit (+7 more)

### Community 41 - "aiWater.test.ts"
Cohesion: 0.16
Nodes (9): SIM_DT, FixedStepAccumulator, createPlayerCommand(), BattleLog, Mission, riverBattle(), runMissions(), run() (+1 more)

### Community 42 - "Terrain"
Cohesion: 0.15
Nodes (13): lakeVertexIds(), buildChunk(), raiseBed(), FLOW_PEAK_SPEED, riverFlowField(), vertexRange(), Terrain, makeWorld() (+5 more)

### Community 43 - "Effects.ts"
Cohesion: 0.13
Nodes (6): Emitter, FlashSlot, LightSlot, RingSlot, ParticleSpawn, ParticleSystem

### Community 44 - "NavGrid"
Cohesion: 0.16
Nodes (3): PathFinder, NavGrid, staysWalkable()

### Community 45 - "Plan: Hilly Terrain — Terrain choice"
Cohesion: 0.13
Nodes (14): Acceptance, Patterns to Mirror, Plan: Hilly Terrain — Terrain choice, Risks, Summary, Task 1: Lock Gentle before touching it, Task 2: Battlefield survey (the measuring stick), Task 3: Measure the Gentle baseline (+6 more)

### Community 46 - "Game"
Cohesion: 0.13
Nodes (3): window.__vt development debug handle, Development summary, Game

### Community 47 - ".drawGhost"
Cohesion: 0.21
Nodes (3): MapProjection, Contact, projection()

### Community 48 - "World"
Cohesion: 0.11
Nodes (24): bridgeApproach(), fordApproach(), nearest(), BANK_SIDES, FORD_ENDS, FORD_MARKER_HEIGHT, FORD_MARKER_SETBACK, Bridge (+16 more)

### Community 49 - "MaterialLibrary"
Cohesion: 0.12
Nodes (10): makeFlashTexture(), createEdge(), createSolid(), EDGE_ROLES, EdgeRole, MaterialLibrary, MaterialOptions, SOLID_ROLES (+2 more)

### Community 51 - ".startNewGame"
Cohesion: 0.13
Nodes (6): GameEvent, css(), HudPresenter, CameraMode, HUD, pad3()

### Community 52 - "battlefieldSurvey.ts"
Cohesion: 0.23
Nodes (14): coverDistance(), DEFAULT_SURVEY, GroundStats, isHidden(), isOpenGround(), NO_COVER_DISTANCE, percentile(), placeAround() (+6 more)

### Community 56 - "NavPlanner"
Cohesion: 0.21
Nodes (4): NavPlanner, preference(), PathFollower, freshPlanner()

### Community 57 - "Terrain"
Cohesion: 0.09
Nodes (33): smoothstep(), BANK_FREEBOARD, BANK_WIDTH, carveLake(), carveRiver(), chaikin(), CourseGrid, DEPTH_RANGE (+25 more)

### Community 58 - "events.ts"
Cohesion: 0.22
Nodes (13): hitZone, HitSurface, Faction, TankKind, EnemySpawnedEvent, FireEvent, GameOverEvent, ImpactEvent (+5 more)

### Community 59 - "MapProjection.ts"
Cohesion: 0.25
Nodes (11): bearingOf(), clampToRadius(), gridColumnLetter(), gridIndex(), gridLabel(), NICE_STEPS, Point2, rotateToView() (+3 more)

### Community 60 - "KeyValueStore"
Cohesion: 0.28
Nodes (3): KeyValueStore, MemoryStore, MemoryStore

### Community 61 - "aiming.test.ts"
Cohesion: 0.21
Nodes (8): DEFAULT_SETTINGS, PlayerController, PlayerCommand, AIM_LIMITS, CAMERA_LABELS, CAMERA_LIMITS, CAMERA_MODES, settle()

### Community 62 - "WorldLoader.ts"
Cohesion: 0.29
Nodes (11): Decisions taken in this plan (change before approving), Files to Change, Task 6: The player's choice, end to end, MapSize, TerrainType, pickEnum(), SimulationOptions, Job (+3 more)

### Community 63 - "WorldView.ts"
Cohesion: 0.18
Nodes (14): QualityLevel, CRT_SHADER, QUALITY_PRESETS, QualityPreset, RenderConfig, REFLECT_DEFINE, reflectsLakes(), RIPPLES_DEFINE (+6 more)

### Community 64 - "Tank.ts"
Cohesion: 0.15
Nodes (11): TankSpec, NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight (+3 more)

### Community 65 - "coverReport.test.ts"
Cohesion: 0.21
Nodes (9): Task 4: Move Gentle's numbers into a height profile, TerrainProfile, WorldGenOptions, mean(), measure(), Row, SEEDS, Variant (+1 more)

### Community 66 - "Tank"
Cohesion: 0.14
Nodes (8): segmentVsTank(), Tank, AimSolver, addEnemy(), clipEveryCorner(), makeTank(), tankAt(), makeTank()

### Community 67 - "tacticalData.ts"
Cohesion: 0.13
Nodes (15): formatDistance(), niceScaleLength(), mapSizeBlurb(), ContactTracker, CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH, MOUNTAIN_DIM (+7 more)

### Community 68 - "AutoQuality.ts"
Cohesion: 0.33
Nodes (6): QUALITY_LEVELS, AutoQuality, QualityStep, SLOW_FPS, SLOW_SECONDS, run()

### Community 69 - "combat.test.ts"
Cohesion: 0.18
Nodes (15): Aiming, Gun marker (actual barrel aim indicator), ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like (+7 more)

### Community 70 - "Hilly Terrain Option"
Cohesion: 0.18
Nodes (10): Delivery Milestones, Evidence, Hilly Terrain Option, Hypothesis, Open Questions, Problem, Risks, Scope (+2 more)

### Community 71 - ".planLeg"
Cohesion: 0.40
Nodes (4): deckX(), deckZ(), farEnd(), Route

### Community 72 - "shoreline.ts"
Cohesion: 0.27
Nodes (5): TerrainView, crossEdge(), crossings, crossTriangle(), shoreWetness()

### Community 74 - "generateWorld"
Cohesion: 0.29
Nodes (7): generateWorld(), worldOptionsFor(), generateHere(), BattlefieldSurvey, Sample, SEEDS, local()

### Community 75 - "NavGrid.ts"
Cohesion: 0.29
Nodes (8): Crossing, BRIDGE_LINK_OFFSET, FORD_LINK_OFFSET, NAV_CELL_SIZE, NavSurroundings, Portal, PortalEnd, pushScratch

### Community 76 - "HudPresenter.ts"
Cohesion: 0.27
Nodes (7): el(), HELP_HTML, HudFrame, HudTarget, Indicator, MAX_HUD_TARGETS, stat()

### Community 78 - "navPlanner.test.ts"
Cohesion: 0.48
Nodes (4): NEIGHBOURS, createWaypoint(), NAV, world

### Community 79 - "StateMachine.ts"
Cohesion: 0.53
Nodes (5): decideNextState(), engageState(), shouldEvade(), shouldRetreat(), decide()

### Community 80 - "worldFingerprint.ts"
Cohesion: 0.70
Nodes (4): bytesOf(), foldBytes(), foldText(), worldFingerprint()

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 393 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Collision.ts`, `World.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `worldLoader.test.ts`, `Game.ts`, `WorldView.ts`, `ai.test.ts`, `Radar Display`, `math.ts`, `.frame`, `WorldGenerator.ts`, `Simulation`, `EnemyAI.ts`, `Random`, `tacticalWater.test.ts`, `Water.ts`, `pathFinder.test.ts`, `settings.ts`, `WeaponSystem.ts`, `aiWater.test.ts`, `Terrain`, `NavGrid`, `Plan: Hilly Terrain — Terrain choice`, `Game`, `battlefieldSurvey.ts`, `NavPlanner`, `aiming.test.ts`, `WorldLoader.ts`, `WorldView.ts`, `Tank`, `tacticalData.ts`, `combat.test.ts`, `shoreline.ts`, `generateWorld`, `NavGrid.ts`, `WorldLoader`, `navPlanner.test.ts`, `worldFingerprint.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Terrain` (e.g. with `Files to Change` and `Task 6: The player's choice, end to end`) actually correct?**
  _`Terrain` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Collision.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10505050505050505 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Water.ts` to `Collision.ts`, `Random`, `World.ts`, `Audio Test Fakes`, `Package & Lint Config`, `worldLoader.test.ts`, `lakeMirror.ts`, `ai.test.ts`, `math.ts`, `WorldGenerator.ts`, `waves.test.ts`, `Random`, `tacticalWater.test.ts`, `pathFinder.test.ts`, `settings.ts`, `aiWater.test.ts`, `World`, `MapProjection.ts`, `KeyValueStore`, `aiming.test.ts`, `WorldLoader.ts`, `WorldView.ts`, `coverReport.test.ts`, `tacticalData.ts`, `AutoQuality.ts`, `combat.test.ts`, `MinHeap`, `generateWorld`, `navPlanner.test.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `Random` be split into smaller, more focused modules?**
  _Cohesion score 0.13538461538461538 - nodes in this community are weakly interconnected._
- **Why does `Game` connect `Game` to `Tank`, `audioMath.ts`, `main.ts`, `Tactical Map View`, `Graphics modes`, `Game.ts`, `Menu`, `WorldView.ts`, `.startNewGame`, `Radar Display`, `.frame`, `Simulation`, `.applySettings`, `aiming.test.ts`, `WorldLoader.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._