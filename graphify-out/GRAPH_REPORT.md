# Graph Report - tank-attack-3d  (2026-10-29)

## Corpus Check
- 113 files · ~184,702 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1545 nodes · 4799 edges · 59 communities (49 shown, 10 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 509 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `694e55a1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Collision.ts
- Random
- Synth Sound Effects
- Procedural Tank Geometry
- Audio Test Fakes
- audioMath.ts
- Package & Lint Config
- Tactical Map View
- Tactical Unit Symbols
- VECTOR TANKS
- Design principles
- Mixer
- settings.ts
- Audio Manager & Mixer
- Game.ts
- aiWater.test.ts
- Menu
- WorldView
- Enemy AI Test Harness
- Radar Display
- Tank Entity & Aim Solver
- Visual Effects Bursts
- WorldGenerator.ts
- TypeScript Config
- Simulation
- Renderer Setup
- InputManager
- EnemyAI.ts
- waves.test.ts
- MapProjection
- Enemy Controller
- BridgePlacer.ts
- Audio Loop Graph
- Effects.ts
- Graphify Project Rules
- Tank View & Tracks
- Terrain
- KeyValueStore
- NavGrid
- Graphics Mode Application
- Game
- World.ts
- WorldView.ts
- Fake Audio Params
- HUD
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- .planLeg
- WaterGenerator.ts
- World
- MapProjection.ts
- Game.ts
- NavPlanner
- .step
- Enemy AI state machine
- tacticalData.ts
- distanceField.ts

## God Nodes (most connected - your core abstractions)
1. `Tank` - 91 edges
2. `Simulation` - 75 edges
3. `World` - 74 edges
4. `Random` - 57 edges
5. `Game` - 54 edges
6. `Terrain` - 53 edges
7. `clamp()` - 52 edges
8. `TacticalMap` - 51 edges
9. `Obstacle` - 35 edges
10. `GraphicsModeSpec` - 34 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `PerfOverlay` --implements--> `Performance overlay`  [INFERRED]
  src/ui/PerfOverlay.ts → README.md
- `Random` --implements--> `mulberry32 seeded RNG`  [INFERRED]
  src/utils/random.ts → README.md
- `solveElevation()` --implements--> `Crosshair raycast with ballistic gun laying`  [INFERRED]
  src/combat/Ballistics.ts → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (59 total, 10 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.19
Nodes (20): segmentVsBridge(), belowTerrain(), belowWater(), circleVsObstacle(), clipSlab(), exitScratch, marchBelow(), marchToSurface() (+12 more)

### Community 1 - "Random"
Cohesion: 0.22
Nodes (6): AIContext, DifficultySpec, GRAD2, Random, Harness, randomMask()

### Community 2 - "Synth Sound Effects"
Cohesion: 0.20
Nodes (35): fireTimbre, relativePan(), steppedGlide(), playDestroyed(), playEventSound(), playFire(), playPlayerDamaged(), burst() (+27 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.09
Nodes (41): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+33 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (20): chooseVoice(), voiceLoudness(), ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource (+12 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.07
Nodes (41): CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, crushCurve(), ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams, engineParams (+33 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.11
Nodes (3): context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.10
Nodes (31): fitScale(), niceScaleLength(), AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS (+23 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.05
Nodes (36): #app main mount element, body data-mode attribute, 3D Tanks (1989 Acorn Archimedes), Aiming, Battlezone (1980 arcade), Gunner / chase / tactical cameras, Classic Vector graphics mode, Compact radar (+28 more)

### Community 10 - "Design principles"
Cohesion: 0.20
Nodes (4): Architecture, Design principles, Per-tick GameEvent list, Three.js

### Community 11 - "Mixer"
Cohesion: 0.13
Nodes (5): distanceGain(), playImpact(), createPanner(), Voice, VoicePool

### Community 12 - "settings.ts"
Cohesion: 0.05
Nodes (64): three, vitest, ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like (+56 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.16
Nodes (4): AudioManager, Mixer, getAudioContextCtor(), unlockedManager()

### Community 14 - "Game.ts"
Cohesion: 0.11
Nodes (22): MAP_SIZES, MapSize, DIFFICULTIES, GRAPHICS_MODES, GraphicsModeId, MAP_SIZE_IDS, MapIntel, pickBoolean() (+14 more)

### Community 15 - "aiWater.test.ts"
Cohesion: 0.33
Nodes (6): addEnemy(), BattleLog, Mission, riverBattle(), makeRiverWorld(), riverSim()

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView"
Cohesion: 0.17
Nodes (7): BridgeView, ObstacleView, ProjectileView, TerrainView, WaterView, createEnvironmentScene(), WorldView

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.17
Nodes (17): steerTowards(), BASE_INPUT, engage(), engagedAttacker(), FixedRandom, makeFlatWorld(), makeHarness(), makeObstacle() (+9 more)

### Community 19 - "Radar Display"
Cohesion: 0.15
Nodes (4): Radar, GraphicsModeId, rgba(), tacticalTheme

### Community 20 - "Tank Entity & Aim Solver"
Cohesion: 0.19
Nodes (7): Tank, AimSolver, settle(), makeTank(), tankAt(), drive(), makeTank()

### Community 23 - "WorldGenerator.ts"
Cohesion: 0.12
Nodes (23): mulberry32 seeded RNG, Seeded procedural battlefield, SimplexNoise2D, boundRadiusOf(), BoxShape, CircleShape, ObstacleKind, ObstacleShape (+15 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 26 - "Renderer Setup"
Cohesion: 0.12
Nodes (6): QualityLevel, CRT_SHADER, QUALITY_PRESETS, QualityPreset, RenderConfig, Renderer

### Community 27 - "InputManager"
Cohesion: 0.10
Nodes (8): PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget(), AimState

### Community 28 - "EnemyAI.ts"
Cohesion: 0.14
Nodes (17): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+9 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.15
Nodes (13): TransitionInput, EnemyKind, EnemySpawnedEvent, EnemyEntry, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition() (+5 more)

### Community 30 - "MapProjection"
Cohesion: 0.14
Nodes (4): MapProjection, Contact, unitColor(), projection()

### Community 33 - "BridgePlacer.ts"
Cohesion: 0.09
Nodes (33): BRIDGE, WATER, BridgeLocal, createBridgeLocal(), toBridgeLocal(), BANK_LINES, bankDistance(), buildBridge() (+25 more)

### Community 36 - "Effects.ts"
Cohesion: 0.15
Nodes (6): Emitter, FlashSlot, LightSlot, RingSlot, ParticleSpawn, ParticleSystem

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.17
Nodes (6): PartGeometry, TRACK_SEGMENT_COUNT, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 42 - "Terrain"
Cohesion: 0.14
Nodes (16): buildChunk(), crossEdge(), crossings, crossTriangle(), shorelineSegments(), HeightField, Terrain, makeRamp() (+8 more)

### Community 43 - "KeyValueStore"
Cohesion: 0.16
Nodes (12): DIFFICULTY, WAVES, DEFAULT_SETTINGS, accuracy(), createStats(), formatTime(), GameStats, KeyValueStore (+4 more)

### Community 44 - "NavGrid"
Cohesion: 0.07
Nodes (11): PathFinder, MinHeap, DistanceField, NavGrid, WaterMap, planLakes(), dryFeatures(), generateWaterFeatures() (+3 more)

### Community 46 - "Game"
Cohesion: 0.13
Nodes (4): window.__vt development debug handle, Development summary, Game, mapSizeLabel()

### Community 48 - "World.ts"
Cohesion: 0.11
Nodes (32): Crossing, travelDirection(), bridgePieces(), Bridge, DECK_THICKNESS, deckHeightAt(), exitScratch, isOnDeck() (+24 more)

### Community 49 - "WorldView.ts"
Cohesion: 0.12
Nodes (10): makeFlashTexture(), createEdge(), createSolid(), EDGE_ROLES, EdgeRole, MaterialLibrary, MaterialOptions, SOLID_ROLES (+2 more)

### Community 51 - "HUD"
Cohesion: 0.11
Nodes (12): css(), HudPresenter, CameraMode, el(), HELP_HTML, HUD, HudFrame, HudTarget (+4 more)

### Community 56 - ".planLeg"
Cohesion: 0.36
Nodes (4): deckX(), deckZ(), preference(), Route

### Community 57 - "WaterGenerator.ts"
Cohesion: 0.06
Nodes (52): AIM_LIMITS, CAMERA_LABELS, CAMERA_LIMITS, CAMERA_MODES, CameraState, angleDiff(), clamp(), damp() (+44 more)

### Community 58 - "World"
Cohesion: 0.12
Nodes (13): awayFromWater, nearby, ProjectileHit, SimulationOptions, bridgeBoundRadius(), PlanarVector, Obstacle, ObstacleGrid (+5 more)

### Community 59 - "MapProjection.ts"
Cohesion: 0.13
Nodes (19): bearingOf(), clampToRadius(), gridColumnLetter(), gridIndex(), gridLabel(), NICE_STEPS, Point2, rotateToView() (+11 more)

### Community 60 - "Game.ts"
Cohesion: 0.08
Nodes (11): browserStorage(), SettingsStore, AppState, randomSeed(), seedFromUrl(), FixedStepAccumulator, BestScoreStore, CameraManager (+3 more)

### Community 61 - "NavPlanner"
Cohesion: 0.18
Nodes (8): NavPlanner, NEIGHBOURS, createWaypoint(), PathFollower, Waypoint, NAV, freshPlanner(), world

### Community 62 - ".step"
Cohesion: 0.29
Nodes (4): createPlayerCommand(), runMissions(), run(), drive()

### Community 63 - "Enemy AI state machine"
Cohesion: 0.40
Nodes (5): Directional damage zones and armour, Heavy enemy tank, Scout enemy tank, Standard enemy tank, Escalating enemy waves

### Community 67 - "tacticalData.ts"
Cohesion: 0.20
Nodes (7): ContactTracker, CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH, sampleHeights(), shadeRelief(), VISUAL_RANGE

### Community 68 - "distanceField.ts"
Cohesion: 0.47
Nodes (3): FAR_DISTANCE, lowerEnvelope(), squaredDistances()

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 309 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Collision.ts`, `Random`, `Procedural Tank Geometry`, `Tactical Map View`, `Tactical Unit Symbols`, `settings.ts`, `aiWater.test.ts`, `WorldView`, `Enemy AI Test Harness`, `Tank Entity & Aim Solver`, `WorldGenerator.ts`, `Simulation`, `EnemyAI.ts`, `BridgePlacer.ts`, `Terrain`, `NavGrid`, `World.ts`, `WaterGenerator.ts`, `Game.ts`, `NavPlanner`, `tacticalData.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Procedural Tank Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.09085213032581453 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `settings.ts` to `Collision.ts`, `BridgePlacer.ts`, `Audio Test Fakes`, `distanceField.ts`, `Package & Lint Config`, `Terrain`, `KeyValueStore`, `NavGrid`, `aiWater.test.ts`, `World.ts`, `Enemy AI Test Harness`, `waves.test.ts`, `WorldGenerator.ts`, `WaterGenerator.ts`, `World`, `MapProjection.ts`, `NavPlanner`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.0708245243128964 - nodes in this community are weakly interconnected._
- **Why does `Tank` connect `Tank Entity & Aim Solver` to `Random`, `Tactical Map View`, `Tactical Unit Symbols`, `Design principles`, `settings.ts`, `aiWater.test.ts`, `Enemy AI Test Harness`, `Radar Display`, `Visual Effects Bursts`, `Simulation`, `EnemyAI.ts`, `waves.test.ts`, `Enemy Controller`, `Tank View & Tracks`, `Terrain`, `World.ts`, `HUD`, `.planLeg`, `WaterGenerator.ts`, `World`, `MapProjection.ts`, `Game.ts`, `NavPlanner`, `.step`, `tacticalData.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `audioMath.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07188778492109878 - nodes in this community are weakly interconnected._