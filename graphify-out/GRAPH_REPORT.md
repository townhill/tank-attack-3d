# Graph Report - tank-attack-3d  (2026-10-31)

## Corpus Check
- 147 files · ~230,912 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1888 nodes · 5911 edges · 71 communities (64 shown, 7 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 620 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `feeb6ece`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Collision.ts
- WorldGenerator.ts
- Synth Sound Effects
- deckHeightAt
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
- EnemyAI.ts
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
- .constructor
- Water.ts
- Audio Loop Graph
- pathFinder.test.ts
- settings.ts
- main.ts
- Graphify Project Rules
- Tank View & Tracks
- combat.test.ts
- Plan: Hilly Terrain — Hilly fully playable
- Terrain
- Effects.ts
- NavGrid
- Plan: Hilly Terrain — Terrain choice
- Game
- .drawGhost
- World.ts
- MaterialLibrary
- Fake Audio Params
- .startNewGame
- battlefieldSurvey.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- geometry.ts
- Terrain
- lakeReflection.test.ts
- Radar.ts
- GraphicsModeSpec
- formatDistance
- ContactTracker
- WorldView.ts
- coverReport.test.ts
- Tank
- tacticalData.ts
- Hilly Terrain Option
- generateWorld
- WorldLoader
- worldFingerprint.ts

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
- `PerfOverlay` --implements--> `Performance overlay`  [INFERRED]
  src/ui/PerfOverlay.ts → README.md
- `Task 5: Hilly heights` --references--> `SimplexNoise2D`  [INFERRED]
  .claude/plans/hilly-terrain.plan.md → src/utils/noise.ts
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

## Communities (71 total, 7 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.12
Nodes (33): travelDirection(), exitScratch, isOnDeck(), kerbPush(), parapetPush(), pointInsideBridge(), segmentVsBridge(), toBridgeLocal() (+25 more)

### Community 1 - "WorldGenerator.ts"
Cohesion: 0.10
Nodes (28): mulberry32 seeded RNG, Seeded procedural battlefield, TERRAIN_TYPES, GRAD2, SimplexNoise2D, Random, createBridgeLocal(), boundRadiusOf() (+20 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.21
Nodes (34): steppedGlide(), impactRecipeFor(), playDestroyed(), playEventSound(), playImpact(), playPlayerDamaged(), burst(), cannon() (+26 more)

### Community 3 - "deckHeightAt"
Cohesion: 0.35
Nodes (11): addCentreline(), addLamps(), addRailings(), addStiffeners(), addStringers(), addTrusses(), bridgeDetailSegments(), parapetCentre() (+3 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.06
Nodes (14): FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain, fakeMixer(), FakeNode (+6 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.08
Nodes (52): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, crushCurve(), distanceGain(), ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES (+44 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.11
Nodes (5): fitScale(), gridColumnLetter(), context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.08
Nodes (34): AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS, STOPPED_EVENTS, BOUNDARY_DASH (+26 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.07
Nodes (25): 3D Tanks (1989 Acorn Archimedes), Aiming, Battlezone (1980 arcade), Gunner / chase / tactical cameras, Controls, Difficulty, Easy / Normal / Hard difficulty levels, Directional damage zones and armour (+17 more)

### Community 10 - "worldLoader.test.ts"
Cohesion: 0.16
Nodes (9): WorldReply, WorldRequest, packWorld(), transferablesOf(), scope, WorkerScope, FakeWorker, postAcross() (+1 more)

### Community 11 - "Voice"
Cohesion: 0.15
Nodes (3): playFire(), Voice, VoicePool

### Community 12 - "Graphics modes"
Cohesion: 0.16
Nodes (14): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), GraphicsModeId, ColourPair (+6 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.16
Nodes (3): AudioManager, Mixer, unlockedManager()

### Community 14 - "Game.ts"
Cohesion: 0.09
Nodes (21): MAP_SIZES, DEFAULT_SETTINGS, DIFFICULTIES, GRAPHICS_MODES, MAP_SIZE_IDS, MapIntel, pickBoolean(), pickEnum() (+13 more)

### Community 15 - "lakeMirror.ts"
Cohesion: 0.11
Nodes (15): ahead, clip, CLIP_TO_TEXTURE, corner, eye, lakeReach(), MIN_EYE_HEIGHT, mirrorCamera() (+7 more)

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView.ts"
Cohesion: 0.12
Nodes (9): BridgeView, FordView, LakeReflection, ProjectileView, TerrainView, WaterView, createEnvironmentScene(), SUN_OFFSET (+1 more)

### Community 18 - "EnemyAI.ts"
Cohesion: 0.06
Nodes (45): Gaussian aim error, AIContext, aimDir, EnemyController, leadPoint, muzzleDir, muzzlePos, playerCentre (+37 more)

### Community 19 - "Radar Display"
Cohesion: 0.14
Nodes (6): Compact radar, HUD, radar and tactical map, Tactical map, Radar, GraphicsModeId, tacticalTheme

### Community 20 - "math.ts"
Cohesion: 0.11
Nodes (32): three, NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight (+24 more)

### Community 21 - ".frame"
Cohesion: 0.09
Nodes (3): CameraManager, AimState, CameraState

### Community 23 - "World"
Cohesion: 0.12
Nodes (14): ProjectileHit, bridgeApproach(), fordApproach(), nearest(), Placement, bridgeBoundRadius(), Obstacle, ObstacleGrid (+6 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation"
Cohesion: 0.10
Nodes (12): Architecture, Design principles, Per-tick GameEvent list, Three.js, createPlayerCommand(), Simulation, ClosingIn, riverBattle() (+4 more)

### Community 26 - ".applySettings"
Cohesion: 0.15
Nodes (4): Performance overlay, Quality, Quality presets with auto-reduce, Renderer

### Community 27 - "aiming.test.ts"
Cohesion: 0.19
Nodes (3): applyDeadzone(), InputManager, isEditableTarget()

### Community 28 - "TankModel.ts"
Cohesion: 0.14
Nodes (19): edgePositions(), mergeParts(), scalePolygon(), SegmentList, buildHull(), buildMantlet(), cache, getTankGeometry() (+11 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.13
Nodes (12): TransitionInput, EnemyKind, EnemySpawnedEvent, EnemyEntry, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition() (+4 more)

### Community 30 - "bridgeDetail.ts"
Cohesion: 0.10
Nodes (29): BridgeStyle, bridgeStyles(), CUTWATER_LENGTH, DASH_GAP, DASH_LENGTH, DASH_LIFT, GIRDER_DEPTH, GIRDER_HALF_WEB (+21 more)

### Community 31 - "ObstacleView.ts"
Cohesion: 0.16
Nodes (16): box(), polygon(), transformSegments(), Vec2, buildingModel(), ChunkBuild, Facade, facadeDetail() (+8 more)

### Community 32 - ".constructor"
Cohesion: 0.13
Nodes (7): browserStorage(), randomSeed(), seedFromUrl(), BestScoreStore, UiSoundKind, PerfOverlay, PerfStats

### Community 33 - "Water.ts"
Cohesion: 0.10
Nodes (37): vitest, BRIDGE, WATER, smoothstep(), BANK_LINES, buildBridge(), Crossing, gradeApproaches() (+29 more)

### Community 34 - "Audio Loop Graph"
Cohesion: 0.17
Nodes (4): EnemyEngines, LoopGraph, PlayerLoops, smooth()

### Community 35 - "pathFinder.test.ts"
Cohesion: 0.09
Nodes (16): DistanceField, FAR_DISTANCE, lowerEnvelope(), PlanarVector, squaredDistances(), BRIDGE_LINK_OFFSET, FORD_LINK_OFFSET, NAV_CELL_SIZE (+8 more)

### Community 36 - "settings.ts"
Cohesion: 0.09
Nodes (31): AI, BASE_GEOMETRY, DIFFICULTY, MapSizeSpec, NoiseLayer, PROJECTILE, RidgeLayer, SIM_DT (+23 more)

### Community 37 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.19
Nodes (5): PartGeometry, TRACK_SEGMENT_COUNT, PartObjects, TankView, WHITE

### Community 40 - "combat.test.ts"
Cohesion: 0.07
Nodes (38): leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like, applyDamage(), computeDamage(), Damageable (+30 more)

### Community 41 - "Plan: Hilly Terrain — Hilly fully playable"
Cohesion: 0.13
Nodes (14): Acceptance, Decisions taken in this plan (change before approving), Outcome (2026-10-31, not committed), Plan: Hilly Terrain — Hilly fully playable, Risks, Summary, Task 1: Pin the failure in a test, Task 3: Re-tune Hilly cover (+6 more)

### Community 42 - "Terrain"
Cohesion: 0.11
Nodes (25): lakeVertexIds(), ReflectionUniforms, buildChunk(), raiseBed(), FLOW_PEAK_SPEED, riverFlowField(), vertexRange(), crossEdge() (+17 more)

### Community 43 - "Effects.ts"
Cohesion: 0.13
Nodes (6): Emitter, FlashSlot, LightSlot, RingSlot, ParticleSpawn, ParticleSystem

### Community 44 - "NavGrid"
Cohesion: 0.06
Nodes (19): Crossing, deckX(), deckZ(), farEnd(), NavPlanner, preference(), NEIGHBOURS, PathFinder (+11 more)

### Community 45 - "Plan: Hilly Terrain — Terrain choice"
Cohesion: 0.10
Nodes (20): Acceptance, Decisions taken in this plan (change before approving), Files to Change, Outcome (2026-10-31), Patterns to Mirror, Plan: Hilly Terrain — Terrain choice, Risks, Summary (+12 more)

### Community 46 - "Game"
Cohesion: 0.14
Nodes (4): window.__vt development debug handle, Development summary, Game, mapSizeLabel()

### Community 47 - ".drawGhost"
Cohesion: 0.17
Nodes (3): MapProjection, Contact, projection()

### Community 48 - "World.ts"
Cohesion: 0.10
Nodes (30): BANK_SIDES, FORD_ENDS, FORD_MARKER_HEIGHT, FORD_MARKER_SETBACK, fordMarkerSegments(), drawFordSymbol(), drawMapBridges(), drawMapFords() (+22 more)

### Community 49 - "MaterialLibrary"
Cohesion: 0.13
Nodes (5): makeFlashTexture(), createEdge(), createSolid(), MaterialLibrary, Sky

### Community 51 - ".startNewGame"
Cohesion: 0.10
Nodes (12): css(), HudPresenter, CameraMode, el(), HELP_HTML, HUD, HudFrame, HudTarget (+4 more)

### Community 52 - "battlefieldSurvey.ts"
Cohesion: 0.23
Nodes (14): coverDistance(), DEFAULT_SURVEY, GroundStats, isHidden(), isOpenGround(), NO_COVER_DISTANCE, percentile(), placeAround() (+6 more)

### Community 56 - "geometry.ts"
Cohesion: 0.36
Nodes (7): centroid2(), extrudeProfileX(), flipWinding(), loft(), prismAlongZ(), TriangleBuilder, buildBarrel()

### Community 57 - "Terrain"
Cohesion: 0.07
Nodes (39): Files to Change, Patterns to Mirror, Task 2: Valley bench (Hilly only), RiverValley, bankDistance(), LakeKind, RiverSample, waterDepthAt() (+31 more)

### Community 58 - "lakeReflection.test.ts"
Cohesion: 0.21
Nodes (5): REFLECT_SCALE, FakeRenderer, LAKE, pass(), setup()

### Community 59 - "Radar.ts"
Cohesion: 0.16
Nodes (16): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), viewAngle(), BOUNDARY_DASH (+8 more)

### Community 61 - "formatDistance"
Cohesion: 0.25
Nodes (5): formatDistance(), gridIndex(), gridLabel(), niceScaleLength(), mapSizeBlurb()

### Community 63 - "WorldView.ts"
Cohesion: 0.10
Nodes (18): QUALITY_LEVELS, QualityLevel, AutoQuality, QualityStep, SLOW_FPS, SLOW_SECONDS, CRT_SHADER, QUALITY_PRESETS (+10 more)

### Community 65 - "coverReport.test.ts"
Cohesion: 0.21
Nodes (9): WorldGenOptions, mean(), measure(), Measured, Row, SEEDS, SIZE_IDS, Variant (+1 more)

### Community 66 - "Tank"
Cohesion: 0.13
Nodes (11): ballisticDirection(), segmentVsTank(), Tank, AimSolver, settle(), addEnemy(), clipEveryCorner(), makeTank() (+3 more)

### Community 67 - "tacticalData.ts"
Cohesion: 0.24
Nodes (10): CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH, MOUNTAIN_DIM, sampleDepths(), sampleHeights(), shadeRelief(), shadeWater() (+2 more)

### Community 70 - "Hilly Terrain Option"
Cohesion: 0.18
Nodes (10): Delivery Milestones, Evidence, Hilly Terrain Option, Hypothesis, Open Questions, Problem, Risks, Scope (+2 more)

### Community 74 - "generateWorld"
Cohesion: 0.31
Nodes (6): generateWorld(), worldOptionsFor(), BattlefieldSurvey, Sample, SEEDS, local()

### Community 77 - "WorldLoader"
Cohesion: 0.20
Nodes (6): browserWorldWorker(), finishHere(), generateHere(), Job, WorldLoader, WorldWorker

### Community 80 - "worldFingerprint.ts"
Cohesion: 0.36
Nodes (7): MapSize, GOLDEN, GoldenWorld, bytesOf(), foldBytes(), foldText(), worldFingerprint()

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 409 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Collision.ts`, `WorldGenerator.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `worldLoader.test.ts`, `WorldView.ts`, `EnemyAI.ts`, `Radar Display`, `math.ts`, `.frame`, `Simulation`, `TankModel.ts`, `bridgeDetail.ts`, `ObstacleView.ts`, `Water.ts`, `pathFinder.test.ts`, `settings.ts`, `combat.test.ts`, `Terrain`, `NavGrid`, `Plan: Hilly Terrain — Terrain choice`, `Game`, `World.ts`, `battlefieldSurvey.ts`, `Radar.ts`, `Tank`, `tacticalData.ts`, `generateWorld`, `WorldLoader`, `worldFingerprint.ts`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Terrain` (e.g. with `Files to Change` and `Task 6: The player's choice, end to end`) actually correct?**
  _`Terrain` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Collision.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1226215644820296 - nodes in this community are weakly interconnected._
- **Why does `Game` connect `Game` to `.constructor`, `settings.ts`, `audioMath.ts`, `main.ts`, `Tactical Map View`, `Graphics modes`, `Plan: Hilly Terrain — Terrain choice`, `Game.ts`, `worldFingerprint.ts`, `Menu`, `WorldView.ts`, `.startNewGame`, `Radar Display`, `.frame`, `Simulation`, `.applySettings`, `aiming.test.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `WorldGenerator.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09513742071881606 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Water.ts` to `Collision.ts`, `WorldGenerator.ts`, `audioMath.ts`, `Package & Lint Config`, `worldLoader.test.ts`, `Game.ts`, `lakeMirror.ts`, `EnemyAI.ts`, `math.ts`, `World`, `Simulation`, `waves.test.ts`, `bridgeDetail.ts`, `pathFinder.test.ts`, `settings.ts`, `combat.test.ts`, `Terrain`, `NavGrid`, `World.ts`, `lakeReflection.test.ts`, `Radar.ts`, `WorldView.ts`, `coverReport.test.ts`, `generateWorld`, `worldFingerprint.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._