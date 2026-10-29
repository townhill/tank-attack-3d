# Graph Report - tank-attack-3d  (2026-10-29)

## Corpus Check
- 87 files · ~89,708 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1288 nodes · 3777 edges · 65 communities (50 shown, 15 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 422 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `119ec910`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- collision.test.ts
- math.ts
- Synth Sound Effects
- Procedural Tank Geometry
- Audio Test Fakes
- Audio Math & Engine Loops
- Package & Lint Config
- Tactical Map View
- Tactical Unit Symbols
- README Gameplay Concepts
- Camera State & Manager
- Game Controller Lifecycle
- combat.test.ts
- Audio Manager & Mixer
- Scoring.ts
- User Settings Store
- Menu Screens
- WorldView
- Enemy AI Test Harness
- Radar Display
- Tank Entity & Aim Solver
- Spatial Audio Panning
- Visual Effects Bursts
- Random
- TypeScript Config
- Simulation Step & Waves
- Renderer Setup
- HUD
- Enemy Steering & Navigation
- Wave Composition
- MapProjection
- Input & Gamepad
- Enemy Controller
- Particle System
- Audio Loop Graph
- Game Event Types
- Edge Material Library
- Simulation.ts
- Graphify Project Rules
- Tank View & Tracks
- Graphics Mode Specs
- .constructor
- Terrain
- Radar.ts
- World
- Graphics Mode Application
- App Bootstrap & WebGL Check
- Graphics Modes & Hidden-Line
- AI State Transitions
- Renderer.ts
- Fake Audio Params
- HudPresenter.ts
- settings.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- Tank.ts
- generateHeights
- Obstacle
- formatDistance
- PerfOverlay
- .fill
- vitest
- tank.test.ts

## God Nodes (most connected - your core abstractions)
1. `Tank` - 71 edges
2. `Simulation` - 65 edges
3. `Game` - 53 edges
4. `TacticalMap` - 51 edges
5. `World` - 51 edges
6. `Random` - 49 edges
7. `clamp()` - 44 edges
8. `Terrain` - 34 edges
9. `GraphicsModeSpec` - 32 edges
10. `Radar` - 31 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `Random` --implements--> `mulberry32 seeded RNG`  [INFERRED]
  src/utils/random.ts → README.md
- `solveElevation()` --implements--> `Crosshair raycast with ballistic gun laying`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `zoneMultiplier()` --implements--> `Directional damage zones and armour`  [INFERRED]
  src/combat/DamageSystem.ts → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (65 total, 15 thin omitted)

### Community 0 - "collision.test.ts"
Cohesion: 0.19
Nodes (21): circleVsObstacle(), clipSlab(), createPushResult(), exitScratch, PushResult, range, segmentVsAabb(), segmentVsCylinder() (+13 more)

### Community 1 - "math.ts"
Cohesion: 0.24
Nodes (17): angleDiff(), damp(), dampAngle(), distance2D(), distanceSq2D(), forwardX(), forwardZ(), inverseLerp() (+9 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.11
Nodes (36): fireTimbre, steppedGlide(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged(), burst() (+28 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.09
Nodes (40): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+32 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (18): ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain (+10 more)

### Community 5 - "Audio Math & Engine Loops"
Cohesion: 0.10
Nodes (28): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams, engineParams (+20 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.09
Nodes (3): context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.09
Nodes (32): fitScale(), niceScaleLength(), AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS (+24 more)

### Community 9 - "README Gameplay Concepts"
Cohesion: 0.07
Nodes (29): 3D Tanks (1989 Acorn Archimedes), Aiming, Architecture, Battlezone (1980 arcade), Gunner / chase / tactical cameras, Compact radar, Controls, Difficulty (+21 more)

### Community 11 - "Game Controller Lifecycle"
Cohesion: 0.19
Nodes (4): window.__vt development debug handle, Development summary, Game, mapSizeLabel()

### Community 12 - "combat.test.ts"
Cohesion: 0.10
Nodes (22): ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like, fireWeapon(), invQuat (+14 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.18
Nodes (4): AudioManager, PlayerLoops, getAudioContextCtor(), unlockedManager()

### Community 14 - "Scoring.ts"
Cohesion: 0.24
Nodes (9): DIFFICULTY, TANK_SPECS, accuracy(), createStats(), formatTime(), KeyValueStore, killScore(), waveClearBonus() (+1 more)

### Community 15 - "User Settings Store"
Cohesion: 0.19
Nodes (11): browserStorage(), DEFAULT_SETTINGS, DIFFICULTIES, MapIntel, pickBoolean(), pickEnum(), pickNumber(), QUALITY_LEVELS (+3 more)

### Community 16 - "Menu Screens"
Cohesion: 0.20
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView"
Cohesion: 0.17
Nodes (5): ObstacleView, ProjectileView, TerrainView, createEnvironmentScene(), WorldView

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.18
Nodes (16): BASE_INPUT, engage(), engagedAttacker(), FixedRandom, makeFlatWorld(), makeHarness(), makeObstacle(), placeTank() (+8 more)

### Community 19 - "Radar Display"
Cohesion: 0.15
Nodes (4): Radar, GraphicsModeId, rgba(), tacticalTheme

### Community 20 - "Tank Entity & Aim Solver"
Cohesion: 0.20
Nodes (5): Tank, AimSolver, makeTank(), simWithEnemy(), makeTank()

### Community 21 - "Spatial Audio Panning"
Cohesion: 0.12
Nodes (19): crushCurve(), distanceGain(), listenerUp(), MAX_DISTANCE, MAX_ONE_SHOT_VOICES, relativePan(), Vec3Like, VoiceSlot (+11 more)

### Community 23 - "Random"
Cohesion: 0.14
Nodes (19): WORLD, hashSeed(), boundRadiusOf(), ObstacleKind, ObstacleShape, STOREY_HEIGHT, DEFAULT_WORLD_OPTIONS, footprintBase() (+11 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation Step & Waves"
Cohesion: 0.10
Nodes (8): Design principles, Per-tick GameEvent list, Three.js, GameStats, createPlayerCommand(), Simulation, ContactTracker, run()

### Community 28 - "Enemy Steering & Navigation"
Cohesion: 0.16
Nodes (15): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+7 more)

### Community 29 - "Wave Composition"
Cohesion: 0.12
Nodes (17): AIContext, TransitionInput, DifficultySpec, EnemyKind, WAVES, EnemyEntry, aimErrorScale(), maxConcurrentEnemies() (+9 more)

### Community 30 - "MapProjection"
Cohesion: 0.24
Nodes (3): MapProjection, Contact, projection()

### Community 31 - "Input & Gamepad"
Cohesion: 0.10
Nodes (8): PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget(), AimState

### Community 33 - "Particle System"
Cohesion: 0.12
Nodes (8): GameEvent, Emitter, FlashSlot, LightSlot, makeFlashTexture(), RingSlot, ParticleSpawn, ParticleSystem

### Community 35 - "Game Event Types"
Cohesion: 0.22
Nodes (12): hitZone, HitSurface, TankKind, EnemySpawnedEvent, FireEvent, GameOverEvent, ImpactEvent, PlayerDamagedEvent (+4 more)

### Community 36 - "Edge Material Library"
Cohesion: 0.12
Nodes (10): createEdge(), createSolid(), EDGE_ROLES, EdgeRole, MaterialLibrary, MaterialOptions, SOLID_ROLES, SolidRole (+2 more)

### Community 37 - "Simulation.ts"
Cohesion: 0.14
Nodes (17): applyDamage(), computeDamage(), Damageable, DamageInput, zoneMultiplier(), createProjectileHit(), BASE_GEOMETRY, DAMAGE (+9 more)

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.20
Nodes (6): PartGeometry, TRACK_SEGMENT_COUNT, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 40 - "Graphics Mode Specs"
Cohesion: 0.15
Nodes (12): GRAPHICS_MODES, MAP_SIZE_IDS, AppState, randomSeed(), seedFromUrl(), Control, difficultyBlurb(), GameOverSummary (+4 more)

### Community 42 - "Terrain"
Cohesion: 0.20
Nodes (7): Terrain, footprintIsUsable(), makeRamp(), makeWorld(), drive(), rampTerrain(), makeRamp()

### Community 43 - "Radar.ts"
Cohesion: 0.19
Nodes (15): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), viewAngle(), BOUNDARY_DASH (+7 more)

### Community 44 - "World"
Cohesion: 0.13
Nodes (13): three, SUN_OFFSET, CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH, sampleHeights(), shadeRelief(), VISUAL_RANGE (+5 more)

### Community 46 - "App Bootstrap & WebGL Check"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 47 - "Graphics Modes & Hidden-Line"
Cohesion: 0.26
Nodes (9): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), GraphicsModeId, ColourPair (+1 more)

### Community 48 - "AI State Transitions"
Cohesion: 0.43
Nodes (6): decideNextState(), engageState(), isCombatState(), shouldEvade(), shouldRetreat(), decide()

### Community 49 - "Renderer.ts"
Cohesion: 0.33
Nodes (5): QualityLevel, CRT_SHADER, QUALITY_PRESETS, QualityPreset, RenderConfig

### Community 51 - "HudPresenter.ts"
Cohesion: 0.23
Nodes (9): CAMERA_LABELS, el(), HELP_HTML, HudFrame, HudTarget, Indicator, MAX_HUD_TARGETS, stat() (+1 more)

### Community 56 - "Tank.ts"
Cohesion: 0.18
Nodes (10): NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight, scratchUp (+2 more)

### Community 57 - "generateHeights"
Cohesion: 0.42
Nodes (4): mulberry32 seeded RNG, Seeded procedural battlefield, SimplexNoise2D, generateHeights()

### Community 59 - "formatDistance"
Cohesion: 0.25
Nodes (5): formatDistance(), gridColumnLetter(), gridIndex(), gridLabel(), mapSizeBlurb()

### Community 60 - "PerfOverlay"
Cohesion: 0.25
Nodes (4): Performance overlay, Quality, Quality presets with auto-reduce, PerfOverlay

### Community 61 - ".fill"
Cohesion: 0.43
Nodes (3): css(), HudPresenter, CameraMode

### Community 62 - "vitest"
Cohesion: 0.43
Nodes (4): vitest, AIM_LIMITS, CAMERA_LIMITS, CAMERA_MODES

### Community 64 - "tank.test.ts"
Cohesion: 0.50
Nodes (4): DriveOptions, expectedMuzzle(), flatTerrain(), toWorld()

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simulation` connect `Simulation Step & Waves` to `Tactical Map View`, `Tactical Unit Symbols`, `Game Controller Lifecycle`, `Scoring.ts`, `Radar Display`, `Tank Entity & Aim Solver`, `Visual Effects Bursts`, `Random`, `HUD`, `Wave Composition`, `Particle System`, `Simulation.ts`, `Graphics Mode Specs`, `.constructor`, `Radar.ts`, `World`, `HudPresenter.ts`, `Obstacle`, `formatDistance`, `.fill`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Synth Sound Effects` be split into smaller, more focused modules?**
  _Cohesion score 0.11259920634920635 - nodes in this community are weakly interconnected._
- **Why does `TacticalMap` connect `Tactical Map View` to `Graphics Mode Specs`, `.constructor`, `Tactical Unit Symbols`, `Game Controller Lifecycle`, `README Gameplay Concepts`, `World`, `Radar Display`, `Simulation Step & Waves`, `formatDistance`, `MapProjection`, `Input & Gamepad`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `Procedural Tank Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.09427609427609428 - nodes in this community are weakly interconnected._
- **Why does `GameEvent` connect `Particle System` to `Synth Sound Effects`, `Game Event Types`, `Audio Test Fakes`, `Audio Math & Engine Loops`, `Simulation.ts`, `Graphics Mode Specs`, `World`, `HudPresenter.ts`, `Visual Effects Bursts`, `Simulation Step & Waves`, `HUD`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.0743321718931475 - nodes in this community are weakly interconnected._