# Graph Report - tank-attack-3d  (2026-10-31)

## Corpus Check
- 121 files · ~195,471 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1625 nodes · 5106 edges · 74 communities (62 shown, 12 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 533 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ee71b6e1`
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
- events.ts
- Audio Manager & Mixer
- Game.ts
- WorldView.ts
- Menu
- WorldView
- Enemy AI Test Harness
- Radar Display
- math.ts
- .frame
- Visual Effects Bursts
- WorldGenerator.ts
- TypeScript Config
- Simulation
- Renderer
- InputManager
- EnemyAI.ts
- waves.test.ts
- MapProjection
- tacticalWater.test.ts
- Enemy Controller
- BridgePlacer.ts
- Audio Loop Graph
- WaterMap
- Effects.ts
- main.ts
- Graphify Project Rules
- Tank View & Tracks
- combat.test.ts
- Water.ts
- Terrain
- settings.ts
- NavGrid
- Graphics Mode Application
- Game
- .drawGhost
- Bridge.ts
- MaterialLibrary
- Fake Audio Params
- .startNewGame
- NavPlanner
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- synth.ts
- WaterGenerator.ts
- World
- MapProjection.ts
- .constructor
- WeaponSystem.ts
- waterSim.test.ts
- WaterView.ts
- aiming.test.ts
- Projectile
- HudPresenter.ts
- tacticalData.ts
- Graphics modes
- Tank.ts
- settings.ts
- HUD.ts
- .debugCommand
- CameraState.ts

## God Nodes (most connected - your core abstractions)
1. `Tank` - 91 edges
2. `World` - 79 edges
3. `Simulation` - 76 edges
4. `clamp()` - 59 edges
5. `Random` - 57 edges
6. `Terrain` - 56 edges
7. `Game` - 54 edges
8. `TacticalMap` - 51 edges
9. `Obstacle` - 35 edges
10. `vitest` - 34 edges

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

## Communities (74 total, 12 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.15
Nodes (24): pointInsideBridge(), segmentVsBridge(), belowTerrain(), belowWater(), circleVsObstacle(), clipSlab(), createPushResult(), exitScratch (+16 more)

### Community 1 - "Random"
Cohesion: 0.15
Nodes (8): GRAD2, hashSeed(), Random, addEnemy(), BattleLog, Mission, riverBattle(), randomMask()

### Community 2 - "Synth Sound Effects"
Cohesion: 0.19
Nodes (36): fireTimbre, steppedGlide(), impactRecipeFor(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged() (+28 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.05
Nodes (76): addCentreline(), addLamps(), addRailings(), addStiffeners(), addStringers(), addTrusses(), bridgeDetailSegments(), BridgeStyle (+68 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (20): chooseVoice(), voiceLoudness(), ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource (+12 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.12
Nodes (28): CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams, engineParams, FIRE_TIMBRES (+20 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.11
Nodes (5): fitScale(), gridColumnLetter(), context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.09
Nodes (31): AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS, STOPPED_EVENTS, BOUNDARY_DASH (+23 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.08
Nodes (22): 3D Tanks (1989 Acorn Archimedes), Battlezone (1980 arcade), Controls, Difficulty, Easy / Normal / Hard difficulty levels, Directional damage zones and armour, Enemies, Enemy perception (line of sight, hearing, reaction delay) (+14 more)

### Community 10 - "Design principles"
Cohesion: 0.15
Nodes (5): Architecture, Design principles, Per-tick GameEvent list, Three.js, FixedStepAccumulator

### Community 11 - "Mixer"
Cohesion: 0.12
Nodes (6): distanceGain(), Vec3Like, Mixer, createPanner(), Voice, VoicePool

### Community 12 - "events.ts"
Cohesion: 0.23
Nodes (12): hitZone, HitSurface, Faction, EnemySpawnedEvent, FireEvent, GameOverEvent, ImpactEvent, PlayerDamagedEvent (+4 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.17
Nodes (4): AudioManager, UiSound, getAudioContextCtor(), unlockedManager()

### Community 14 - "Game.ts"
Cohesion: 0.11
Nodes (22): browserStorage(), DEFAULT_SETTINGS, DIFFICULTIES, GRAPHICS_MODES, MAP_SIZE_IDS, MapIntel, pickBoolean(), pickEnum() (+14 more)

### Community 15 - "WorldView.ts"
Cohesion: 0.13
Nodes (17): three, TankKind, GraphicsModeId, Emitter, FlashSlot, LightSlot, RingSlot, ColourPair (+9 more)

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView"
Cohesion: 0.18
Nodes (5): BridgeView, ObstacleView, Sky, TerrainView, WorldView

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.11
Nodes (26): AIContext, decideNextState(), engageState(), isCombatState(), shouldEvade(), shouldRetreat(), DifficultySpec, BASE_INPUT (+18 more)

### Community 19 - "Radar Display"
Cohesion: 0.14
Nodes (6): Compact radar, HUD, radar and tactical map, Tactical map, Radar, GraphicsModeId, tacticalTheme

### Community 20 - "math.ts"
Cohesion: 0.21
Nodes (17): angleDiff(), dampAngle(), DEG, distance2D(), distanceSq2D(), forwardX(), forwardZ(), inverseLerp() (+9 more)

### Community 21 - ".frame"
Cohesion: 0.15
Nodes (5): Gunner / chase / tactical cameras, CameraManager, CameraState, damp(), lerp()

### Community 23 - "WorldGenerator.ts"
Cohesion: 0.14
Nodes (20): boundRadiusOf(), ObstacleKind, ObstacleShape, STOREY_HEIGHT, planLakes(), dryFeatures(), DEFAULT_WORLD_OPTIONS, footprintIsUsable() (+12 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation"
Cohesion: 0.10
Nodes (9): Tank, Simulation, HeightField, settle(), makeTank(), simWithEnemy(), drive(), makeTank() (+1 more)

### Community 27 - "InputManager"
Cohesion: 0.15
Nodes (3): applyDeadzone(), InputManager, isEditableTarget()

### Community 28 - "EnemyAI.ts"
Cohesion: 0.11
Nodes (18): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+10 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.15
Nodes (11): TransitionInput, EnemyKind, EnemyEntry, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition(), waveEnemyCount() (+3 more)

### Community 31 - "tacticalWater.test.ts"
Cohesion: 0.19
Nodes (10): drawMapBridges(), ShorelineIndex, crossEdge(), crossings, crossTriangle(), shorelineSegments(), compareWithBruteForce(), Extent (+2 more)

### Community 32 - "Enemy Controller"
Cohesion: 0.19
Nodes (3): EnemyController, AIState, clipEveryCorner()

### Community 33 - "BridgePlacer.ts"
Cohesion: 0.15
Nodes (18): BRIDGE, WATER, smoothstep(), BANK_LINES, bankDistance(), buildBridge(), Crossing, gradeApproaches() (+10 more)

### Community 35 - "WaterMap"
Cohesion: 0.14
Nodes (4): DistanceField, WaterMap, gridWith(), terrain

### Community 37 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.18
Nodes (5): PartGeometry, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 40 - "combat.test.ts"
Cohesion: 0.21
Nodes (12): ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like, applyDamage(), computeDamage() (+4 more)

### Community 41 - "Water.ts"
Cohesion: 0.13
Nodes (22): vitest, BridgeLocal, FLOW_PEAK_SPEED, riverFlowField(), vertexRange(), createWaterMap(), gradient, Lake (+14 more)

### Community 42 - "Terrain"
Cohesion: 0.18
Nodes (11): mulberry32 seeded RNG, Seeded procedural battlefield, buildChunk(), SimplexNoise2D, Terrain, generateHeights(), makeRamp(), makeWorld() (+3 more)

### Community 43 - "settings.ts"
Cohesion: 0.19
Nodes (14): DIFFICULTY, MapSize, TANK_SPECS, WAVES, accuracy(), createStats(), formatTime(), GameStats (+6 more)

### Community 44 - "NavGrid"
Cohesion: 0.11
Nodes (4): PathFinder, MinHeap, NavGrid, staysWalkable()

### Community 47 - ".drawGhost"
Cohesion: 0.24
Nodes (3): Contact, drawArrow(), unitColor()

### Community 48 - "Bridge.ts"
Cohesion: 0.12
Nodes (30): Crossing, travelDirection(), bridgePieces(), Bridge, bridgeBoundRadius(), createBridgeLocal(), DECK_THICKNESS, deckHeightAt() (+22 more)

### Community 49 - "MaterialLibrary"
Cohesion: 0.21
Nodes (4): makeFlashTexture(), createEdge(), createSolid(), MaterialLibrary

### Community 51 - ".startNewGame"
Cohesion: 0.17
Nodes (3): HUD, pad3(), mapSizeLabel()

### Community 52 - "NavPlanner"
Cohesion: 0.14
Nodes (13): deckX(), deckZ(), NavPlanner, preference(), NEIGHBOURS, Route, createWaypoint(), PathFollower (+5 more)

### Community 56 - "synth.ts"
Cohesion: 0.16
Nodes (15): crushCurve(), listenerUp(), MAX_DISTANCE, MAX_ONE_SHOT_VOICES, relativePan(), VoiceSlot, VoiceBuilder, AudioContextCtor (+7 more)

### Community 57 - "WaterGenerator.ts"
Cohesion: 0.11
Nodes (29): lakeRadiusAt(), carveLake(), carveRiver(), chaikin(), CourseGrid, DEPTH_RANGE, describeRiver(), dilateLevels() (+21 more)

### Community 58 - "World"
Cohesion: 0.15
Nodes (9): PushResult, NavSurroundings, Obstacle, ObstacleGrid, shoreWetness(), StaticHit, World, flatWorld() (+1 more)

### Community 59 - "MapProjection.ts"
Cohesion: 0.17
Nodes (15): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), viewAngle(), BOUNDARY_DASH (+7 more)

### Community 60 - ".constructor"
Cohesion: 0.14
Nodes (5): SettingsStore, seedFromUrl(), BestScoreStore, PerfOverlay, PerfStats

### Community 61 - "WeaponSystem.ts"
Cohesion: 0.14
Nodes (14): Aiming, Gun marker (actual barrel aim indicator), createProjectileHit(), invQuat, localA, localB, muzzleDir, muzzlePos (+6 more)

### Community 62 - "waterSim.test.ts"
Cohesion: 0.39
Nodes (6): SIM_DT, GameEvent, createPlayerCommand(), runMissions(), run(), drive()

### Community 63 - "WaterView.ts"
Cohesion: 0.18
Nodes (11): QUALITY_LEVELS, QualityLevel, CRT_SHADER, QualityPreset, RenderConfig, RIPPLES_DEFINE, SHEEN_DEFINE, WATER_DETAIL (+3 more)

### Community 64 - "aiming.test.ts"
Cohesion: 0.25
Nodes (5): PlayerController, PlayerCommand, GAME_KEYS, GamepadState, AimState

### Community 65 - "Projectile"
Cohesion: 0.18
Nodes (4): fireWeapon(), Projectile, ProjectilePool, shell()

### Community 66 - "HudPresenter.ts"
Cohesion: 0.35
Nodes (6): AimSolver, css(), HudPresenter, CameraMode, headingOf(), toCompassDegrees()

### Community 67 - "tacticalData.ts"
Cohesion: 0.11
Nodes (17): formatDistance(), gridIndex(), gridLabel(), niceScaleLength(), mapSizeBlurb(), ContactTracker, CONTOUR_INTERVAL, HeightSamples (+9 more)

### Community 68 - "Graphics modes"
Cohesion: 0.25
Nodes (9): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), Performance overlay, Quality (+1 more)

### Community 69 - "Tank.ts"
Cohesion: 0.18
Nodes (10): NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight, scratchUp (+2 more)

### Community 70 - "settings.ts"
Cohesion: 0.22
Nodes (7): AI, BASE_GEOMETRY, MAP_SIZES, MapSizeSpec, SIM_HZ, TankSpec, WeaponSpec

### Community 71 - "HUD.ts"
Cohesion: 0.28
Nodes (7): el(), HELP_HTML, HudFrame, HudTarget, Indicator, MAX_HUD_TARGETS, stat()

### Community 73 - "CameraState.ts"
Cohesion: 0.53
Nodes (4): AIM_LIMITS, CAMERA_LABELS, CAMERA_LIMITS, CAMERA_MODES

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 323 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Collision.ts`, `Procedural Tank Geometry`, `Tactical Map View`, `Tactical Unit Symbols`, `WorldView.ts`, `WorldView`, `Enemy AI Test Harness`, `Radar Display`, `math.ts`, `.frame`, `WorldGenerator.ts`, `Simulation`, `EnemyAI.ts`, `tacticalWater.test.ts`, `BridgePlacer.ts`, `WaterMap`, `combat.test.ts`, `Water.ts`, `Terrain`, `settings.ts`, `NavGrid`, `Bridge.ts`, `NavPlanner`, `MapProjection.ts`, `WeaponSystem.ts`, `WaterView.ts`, `aiming.test.ts`, `tacticalData.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Collision.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14942528735632185 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Water.ts` to `Collision.ts`, `Random`, `Procedural Tank Geometry`, `Audio Test Fakes`, `Package & Lint Config`, `Design principles`, `Game.ts`, `Enemy AI Test Harness`, `math.ts`, `WorldGenerator.ts`, `waves.test.ts`, `tacticalWater.test.ts`, `BridgePlacer.ts`, `WaterMap`, `combat.test.ts`, `settings.ts`, `NavGrid`, `Bridge.ts`, `NavPlanner`, `MapProjection.ts`, `waterSim.test.ts`, `WaterView.ts`, `aiming.test.ts`, `tacticalData.ts`, `CameraState.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `Procedural Tank Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.050042955326460484 - nodes in this community are weakly interconnected._
- **Why does `Simulation` connect `Simulation` to `Random`, `Tactical Map View`, `Tactical Unit Symbols`, `Design principles`, `Game.ts`, `WorldView.ts`, `Enemy AI Test Harness`, `Radar Display`, `Visual Effects Bursts`, `waves.test.ts`, `settings.ts`, `Game`, `.drawGhost`, `.startNewGame`, `NavPlanner`, `World`, `MapProjection.ts`, `waterSim.test.ts`, `HudPresenter.ts`, `tacticalData.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.0708245243128964 - nodes in this community are weakly interconnected._