# Graph Report - tank-attack-3d  (2026-11-26)

## Corpus Check
- 152 files · ~245,396 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1927 nodes · 5981 edges · 81 communities (68 shown, 13 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 624 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a66c03b8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Collision.ts
- WorldGenerator.ts
- Synth Sound Effects
- deckHeightAt
- Audio Test Fakes
- clamp
- Package & Lint Config
- Tactical Map View
- Tactical Unit Symbols
- VECTOR TANKS
- worldLoader.test.ts
- Mixer
- Graphics modes
- Audio Manager & Mixer
- .constructor
- lakeMirror.ts
- Menu
- WorldView.ts
- ai.test.ts
- Radar Display
- math.ts
- aiming.test.ts
- Visual Effects Bursts
- Plan: Hilly Terrain — Hilly fully playable
- TypeScript Config
- settings.ts
- .applySettings
- aiming.test.ts
- TankModel.ts
- waves.test.ts
- bridgeDetail.ts
- ObstacleView.ts
- Menu.ts
- Terrain
- Audio Loop Graph
- World
- Game.ts
- main.ts
- Graphify Project Rules
- three
- combat.test.ts
- carveRiver
- Terrain
- Effects.ts
- planRivers
- Plan: Hilly Terrain — Terrain choice
- Game
- MapProjection
- tacticalWater.test.ts
- Game.ts
- Fake Audio Params
- HUD
- battlefieldSurvey.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- geometry.ts
- WaterGenerator.ts
- Simulation
- .dispose
- GraphicsModeSpec
- NavGrid
- debugPlacement.test.ts
- WorldView.ts
- Gameplay
- HUD.ts
- Tank
- tacticalData.ts
- .beginGame
- BridgePlacer.ts
- Hilly Terrain Option
- ShorelineIndex
- shoreline.ts
- hillyTerrain.test.ts
- Crosshair raycast with ballistic gun laying
- SegmentList
- userSettings.ts
- PerfOverlay
- generateHeights
- Enemy AI state machine
- AutoQuality.ts

## God Nodes (most connected - your core abstractions)
1. `World` - 101 edges
2. `Tank` - 93 edges
3. `Simulation` - 78 edges
4. `Terrain` - 68 edges
5. `Game` - 61 edges
6. `clamp()` - 61 edges
7. `Random` - 59 edges
8. `TacticalMap` - 51 edges
9. `vitest` - 48 edges
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
- `Random` --implements--> `mulberry32 seeded RNG`  [INFERRED]
  src/utils/random.ts → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (81 total, 13 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.11
Nodes (40): travelDirection(), bridgeBoundRadius(), createBridgeLocal(), DECK_THICKNESS, exitScratch, isOnDeck(), kerbPush(), PARAPET_HEIGHT (+32 more)

### Community 1 - "WorldGenerator.ts"
Cohesion: 0.10
Nodes (24): TERRAIN_TYPES, TerrainProfile, boundRadiusOf(), BoxShape, buildingStoreys(), CircleShape, hasTaperedProfile(), Obstacle (+16 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.19
Nodes (37): fireTimbre, steppedGlide(), impactRecipeFor(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged() (+29 more)

### Community 3 - "deckHeightAt"
Cohesion: 0.35
Nodes (11): addCentreline(), addLamps(), addRailings(), addStiffeners(), addStringers(), addTrusses(), bridgeDetailSegments(), parapetCentre() (+3 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.06
Nodes (14): FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain, fakeMixer(), FakeNode (+6 more)

### Community 5 - "clamp"
Cohesion: 0.07
Nodes (51): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, crushCurve(), distanceGain(), ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES (+43 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.10
Nodes (3): gridColumnLetter(), context2d(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.07
Nodes (44): BOUNDARY_DASH, NO_DASH, RadarOrientation, RING_FRACTIONS, AIM_DASH, BOUNDARY_DASH, element(), MapIntel (+36 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.14
Nodes (12): 3D Tanks (1989 Acorn Archimedes), Architecture, Battlezone (1980 arcade), Controls, Installation and commands, Known limitations, Possible future improvements, Prerequisites (+4 more)

### Community 10 - "worldLoader.test.ts"
Cohesion: 0.08
Nodes (30): Decisions taken in this plan (change before approving), Files to Change, Patterns to Mirror, Task 6: The player's choice, end to end, MapSize, TerrainType, pickEnum(), SimulationOptions (+22 more)

### Community 11 - "Mixer"
Cohesion: 0.13
Nodes (5): Vec3Like, Mixer, NoiseBank, Voice, VoicePool

### Community 12 - "Graphics modes"
Cohesion: 0.25
Nodes (9): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), Performance overlay, Quality (+1 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.19
Nodes (3): AudioManager, getAudioContextCtor(), unlockedManager()

### Community 14 - ".constructor"
Cohesion: 0.14
Nodes (5): SettingsStore, randomSeed(), seedFromUrl(), BestScoreStore, mapSizeLabel()

### Community 15 - "lakeMirror.ts"
Cohesion: 0.11
Nodes (15): ahead, clip, CLIP_TO_TEXTURE, corner, eye, lakeReach(), MIN_EYE_HEIGHT, mirrorCamera() (+7 more)

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView.ts"
Cohesion: 0.11
Nodes (8): BridgeView, FordView, LakeReflection, ObstacleView, TerrainView, WaterView, WorldView, shoreWetness()

### Community 18 - "ai.test.ts"
Cohesion: 0.06
Nodes (45): Gaussian aim error, AIContext, aimDir, EnemyController, leadPoint, muzzleDir, muzzlePos, playerCentre (+37 more)

### Community 19 - "Radar Display"
Cohesion: 0.14
Nodes (10): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), viewAngle(), Radar (+2 more)

### Community 20 - "math.ts"
Cohesion: 0.09
Nodes (36): NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight, scratchUp (+28 more)

### Community 21 - "aiming.test.ts"
Cohesion: 0.09
Nodes (6): PlayerController, PlayerCommand, GamepadState, CameraManager, AimState, CameraState

### Community 22 - "Visual Effects Bursts"
Cohesion: 0.19
Nodes (3): Effects, generateObstacles(), pickStructure()

### Community 23 - "Plan: Hilly Terrain — Hilly fully playable"
Cohesion: 0.13
Nodes (14): Acceptance, Decisions taken in this plan (change before approving), Outcome (2026-10-31, not committed), Plan: Hilly Terrain — Hilly fully playable, Risks, Summary, Task 1: Pin the failure in a test, Task 3: Re-tune Hilly cover (+6 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "settings.ts"
Cohesion: 0.12
Nodes (24): AI, BASE_GEOMETRY, MapSizeSpec, NoiseLayer, PROJECTILE, RidgeLayer, SIM_DT, SIM_HZ (+16 more)

### Community 26 - ".applySettings"
Cohesion: 0.11
Nodes (6): targetPixelRatio(), CRT_SHADER, QUALITY_PRESETS, QualityPreset, RenderConfig, Renderer

### Community 27 - "aiming.test.ts"
Cohesion: 0.12
Nodes (6): applyDeadzone(), GAME_KEYS, InputManager, isEditableTarget(), isBrowserShortcut(), KeyModifiers

### Community 28 - "TankModel.ts"
Cohesion: 0.16
Nodes (20): box(), mergeParts(), scalePolygon(), buildBarrel(), buildHull(), buildMantlet(), buildTurret(), cache (+12 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.20
Nodes (10): EnemyKind, EnemySpawnedEvent, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition(), waveEnemyCount(), WaveManager (+2 more)

### Community 30 - "bridgeDetail.ts"
Cohesion: 0.11
Nodes (27): BridgeStyle, bridgeStyles(), CUTWATER_LENGTH, DASH_GAP, DASH_LENGTH, DASH_LIFT, GIRDER_DEPTH, GIRDER_HALF_WEB (+19 more)

### Community 31 - "ObstacleView.ts"
Cohesion: 0.18
Nodes (13): edgePositions(), SegmentList, transformSegments(), Vec2, buildingModel(), ChunkBuild, Facade, facadeDetail() (+5 more)

### Community 32 - "Menu.ts"
Cohesion: 0.14
Nodes (12): MAP_SIZES, DIFFICULTIES, GRAPHICS_MODES, GraphicsModeId, MAP_SIZE_IDS, TERRAIN_TYPE_IDS, Control, difficultyBlurb() (+4 more)

### Community 33 - "Terrain"
Cohesion: 0.10
Nodes (35): vitest, WATER, FORD_BRIDGE_CLEARANCE, FORD_DEPTH, FORD_HALF_LENGTH, FORD_TAPER, fordSite(), placeFords() (+27 more)

### Community 35 - "World"
Cohesion: 0.09
Nodes (23): Bridge, BridgeLocal, DistanceField, FAR_DISTANCE, lowerEnvelope(), PlanarVector, squaredDistances(), Ford (+15 more)

### Community 36 - "Game.ts"
Cohesion: 0.22
Nodes (10): DIFFICULTY, WAVES, accuracy(), createStats(), formatTime(), GameStats, KeyValueStore, killScore() (+2 more)

### Community 37 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "three"
Cohesion: 0.21
Nodes (5): REFLECT_SCALE, FakeRenderer, LAKE, pass(), setup()

### Community 40 - "combat.test.ts"
Cohesion: 0.06
Nodes (38): ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like, applyDamage(), computeDamage() (+30 more)

### Community 41 - "carveRiver"
Cohesion: 0.38
Nodes (10): Files to Change, Patterns to Mirror, Task 2: Valley bench (Hilly only), RiverValley, carveLake(), carveRiver(), raiseLevel(), shoreHeight() (+2 more)

### Community 42 - "Terrain"
Cohesion: 0.25
Nodes (11): lakeVertexIds(), ReflectionUniforms, buildChunk(), raiseBed(), riverFlowField(), vertexRange(), makeWorld(), makeRamp() (+3 more)

### Community 45 - "Plan: Hilly Terrain — Terrain choice"
Cohesion: 0.13
Nodes (13): Acceptance, Outcome (2026-10-31), Plan: Hilly Terrain — Terrain choice, Risks, Summary, Task 1: Lock Gentle before touching it, Task 2: Battlefield survey (the measuring stick), Task 3: Measure the Gentle baseline (+5 more)

### Community 46 - "Game"
Cohesion: 0.16
Nodes (3): window.__vt development debug handle, Development summary, Game

### Community 48 - "tacticalWater.test.ts"
Cohesion: 0.33
Nodes (6): drawFordSymbol(), drawMapBridges(), drawMapFords(), fordSignAngle(), Extent, Recording

### Community 49 - "Game.ts"
Cohesion: 0.07
Nodes (27): three, AppState, Emitter, FlashSlot, LightSlot, makeFlashTexture(), RingSlot, ColourPair (+19 more)

### Community 52 - "battlefieldSurvey.ts"
Cohesion: 0.06
Nodes (42): Acceptance, Decisions taken in this plan (change before approving), Files to Change, Outcome (2026-10-31), Patterns to Mirror, Plan: Hilly Terrain — Tuned and shipped, Risks, Summary (+34 more)

### Community 56 - "geometry.ts"
Cohesion: 0.35
Nodes (8): centroid2(), extrudeProfileX(), flipWinding(), loft(), polygon(), prismAlongZ(), TriangleBuilder, rockModel()

### Community 57 - "WaterGenerator.ts"
Cohesion: 0.12
Nodes (22): LakeKind, chaikin(), DEPTH_RANGE, describeRiver(), dilateLevels(), HALF_WIDTH_RANGE, isNearLake(), isNearRiver() (+14 more)

### Community 58 - "Simulation"
Cohesion: 0.13
Nodes (9): Design principles, Per-tick GameEvent list, Three.js, Simulation, gridIndex(), gridLabel(), riverBattle(), simWithEnemy() (+1 more)

### Community 61 - "NavGrid"
Cohesion: 0.06
Nodes (20): Crossing, deckX(), deckZ(), farEnd(), NavPlanner, preference(), NEIGHBOURS, PathFinder (+12 more)

### Community 62 - "debugPlacement.test.ts"
Cohesion: 0.33
Nodes (5): bridgeApproach(), fordApproach(), nearest(), Placement, withFords()

### Community 63 - "WorldView.ts"
Cohesion: 0.27
Nodes (8): QUALITY_LEVELS, REFLECT_DEFINE, reflectsLakes(), RIPPLES_DEFINE, SHEEN_DEFINE, WATER_DETAIL, WaterDetail, waterShaderDefines()

### Community 64 - "Gameplay"
Cohesion: 0.29
Nodes (8): Compact radar, Difficulty, Easy / Normal / Hard difficulty levels, Enemy perception (line of sight, hearing, reaction delay), Gameplay, HUD, radar and tactical map, Tactical map, Target leading (shell travel-time compensation)

### Community 65 - "HUD.ts"
Cohesion: 0.28
Nodes (7): el(), HELP_HTML, HudFrame, HudTarget, Indicator, MAX_HUD_TARGETS, stat()

### Community 66 - "Tank"
Cohesion: 0.10
Nodes (10): segmentVsTank(), Tank, AimSolver, settle(), addEnemy(), clipEveryCorner(), makeTank(), tankAt() (+2 more)

### Community 67 - "tacticalData.ts"
Cohesion: 0.12
Nodes (16): fitScale(), formatDistance(), niceScaleLength(), mapSizeBlurb(), ContactTracker, CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH (+8 more)

### Community 69 - "BridgePlacer.ts"
Cohesion: 0.12
Nodes (21): BRIDGE, smoothstep(), BANK_LINES, bankDistance(), buildBridge(), Crossing, gradeApproaches(), placeBridges() (+13 more)

### Community 70 - "Hilly Terrain Option"
Cohesion: 0.18
Nodes (10): Delivery Milestones, Evidence, Hilly Terrain Option, Hypothesis, Open Questions, Problem, Risks, Scope (+2 more)

### Community 71 - "ShorelineIndex"
Cohesion: 0.53
Nodes (3): ShorelineIndex, compareWithBruteForce(), segmentKey()

### Community 72 - "shoreline.ts"
Cohesion: 0.60
Nodes (4): crossEdge(), crossings, crossTriangle(), shorelineSegments()

### Community 73 - "hillyTerrain.test.ts"
Cohesion: 0.27
Nodes (7): BattlefieldSurvey, Sample, SEEDS, bytesOf(), foldBytes(), foldText(), worldFingerprint()

### Community 74 - "Crosshair raycast with ballistic gun laying"
Cohesion: 0.67
Nodes (3): Aiming, Gunner / chase / tactical cameras, Gun marker (actual barrel aim indicator)

### Community 75 - "SegmentList"
Cohesion: 0.27
Nodes (7): BANK_SIDES, FORD_ENDS, FORD_MARKER_HEIGHT, FORD_MARKER_SETBACK, fordMarkerSegments(), ford, world

### Community 77 - "userSettings.ts"
Cohesion: 0.24
Nodes (8): browserStorage(), DEFAULT_SETTINGS, MapIntel, pickBoolean(), pickNumber(), RadarOrientation, sanitizeSettings(), MemoryStore

### Community 79 - "generateHeights"
Cohesion: 0.36
Nodes (4): mulberry32 seeded RNG, Seeded procedural battlefield, SimplexNoise2D, generateHeights()

### Community 80 - "Enemy AI state machine"
Cohesion: 0.33
Nodes (6): Directional damage zones and armour, Enemies, Heavy enemy tank, Scout enemy tank, Standard enemy tank, Escalating enemy waves

### Community 81 - "AutoQuality.ts"
Cohesion: 0.29
Nodes (6): QualityLevel, AutoQuality, QualityStep, SLOW_FPS, SLOW_SECONDS, run()

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 429 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Collision.ts`, `WorldGenerator.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `worldLoader.test.ts`, `.constructor`, `WorldView.ts`, `ai.test.ts`, `Radar Display`, `math.ts`, `aiming.test.ts`, `settings.ts`, `bridgeDetail.ts`, `ObstacleView.ts`, `Terrain`, `combat.test.ts`, `Terrain`, `Plan: Hilly Terrain — Terrain choice`, `tacticalWater.test.ts`, `Game.ts`, `battlefieldSurvey.ts`, `Simulation`, `NavGrid`, `debugPlacement.test.ts`, `WorldView.ts`, `Tank`, `tacticalData.ts`, `.beginGame`, `BridgePlacer.ts`, `ShorelineIndex`, `hillyTerrain.test.ts`, `SegmentList`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Terrain` (e.g. with `Files to Change` and `Task 6: The player's choice, end to end`) actually correct?**
  _`Terrain` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Collision.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1096938775510204 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Terrain` to `Collision.ts`, `WorldGenerator.ts`, `clamp`, `Package & Lint Config`, `worldLoader.test.ts`, `lakeMirror.ts`, `ai.test.ts`, `Radar Display`, `math.ts`, `aiming.test.ts`, `settings.ts`, `.applySettings`, `aiming.test.ts`, `waves.test.ts`, `bridgeDetail.ts`, `World`, `Game.ts`, `three`, `combat.test.ts`, `tacticalWater.test.ts`, `Game.ts`, `battlefieldSurvey.ts`, `NavGrid`, `debugPlacement.test.ts`, `WorldView.ts`, `tacticalData.ts`, `BridgePlacer.ts`, `hillyTerrain.test.ts`, `SegmentList`, `userSettings.ts`, `AutoQuality.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Game` (e.g. with `Decisions taken in this plan (change before approving)` and `body data-mode attribute`) actually correct?**
  _`Game` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `WorldGenerator.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09872241579558652 - nodes in this community are weakly interconnected._