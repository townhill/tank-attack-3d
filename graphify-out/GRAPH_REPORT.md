# Graph Report - tank-attack-3d  (2026-10-29)

## Corpus Check
- 87 files · ~156,636 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1292 nodes · 3787 edges · 67 communities (50 shown, 17 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 422 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4f2e1b37`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- collision.test.ts
- math.ts
- Synth Sound Effects
- Procedural Tank Geometry
- Audio Test Fakes
- audioMath.ts
- Package & Lint Config
- Tactical Map View
- Tactical Unit Symbols
- README Gameplay Concepts
- CameraState
- Development summary
- combat.test.ts
- Audio Manager & Mixer
- Scoring.ts
- tank.test.ts
- Menu.ts
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
- InputManager
- Enemy Steering & Navigation
- waves.test.ts
- MapProjection
- .frame
- Enemy Controller
- Particle System
- Audio Loop Graph
- Game Event Types
- Edge Material Library
- combat.test.ts
- Graphify Project Rules
- Tank View & Tracks
- World
- .constructor
- Terrain
- Ballistics.ts
- World.ts
- Graphics Mode Application
- Game
- settings.ts
- AI State Transitions
- Game.ts
- Fake Audio Params
- HUD
- settings.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- Tank.ts
- Random
- Obstacle
- MapProjection.ts
- PerfOverlay
- EnemyEngines
- HudPresenter.ts
- main.ts
- Graphics modes
- .fill
- CameraState.ts

## God Nodes (most connected - your core abstractions)
1. `Tank` - 71 edges
2. `Simulation` - 65 edges
3. `Game` - 53 edges
4. `World` - 53 edges
5. `TacticalMap` - 51 edges
6. `Random` - 49 edges
7. `clamp()` - 44 edges
8. `GraphicsModeSpec` - 32 edges
9. `Radar` - 31 edges
10. `Obstacle` - 31 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `solveElevation()` --implements--> `Crosshair raycast with ballistic gun laying`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `zoneMultiplier()` --implements--> `Directional damage zones and armour`  [INFERRED]
  src/combat/DamageSystem.ts → README.md
- `Design principles` --references--> `Tank`  [INFERRED]
  README.md → src/entities/Tank.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (67 total, 17 thin omitted)

### Community 0 - "collision.test.ts"
Cohesion: 0.17
Nodes (24): circleVsObstacle(), clipSlab(), createPushResult(), exitScratch, PushResult, range, segmentVsAabb(), segmentVsCylinder() (+16 more)

### Community 1 - "math.ts"
Cohesion: 0.26
Nodes (16): angleDiff(), damp(), dampAngle(), distance2D(), distanceSq2D(), forwardX(), forwardZ(), inverseLerp() (+8 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.11
Nodes (36): fireTimbre, steppedGlide(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged(), burst() (+28 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.09
Nodes (41): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+33 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (18): ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain (+10 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.12
Nodes (25): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, engineParams, FIRE_TIMBRES (+17 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.10
Nodes (3): context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.07
Nodes (40): BOUNDARY_DASH, NO_DASH, RadarOrientation, RING_FRACTIONS, AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH (+32 more)

### Community 9 - "README Gameplay Concepts"
Cohesion: 0.08
Nodes (25): 3D Tanks (1989 Acorn Archimedes), Aiming, Architecture, Battlezone (1980 arcade), Gunner / chase / tactical cameras, Compact radar, Controls, Directional damage zones and armour (+17 more)

### Community 12 - "combat.test.ts"
Cohesion: 0.11
Nodes (13): createProjectileHit(), fireWeapon(), invQuat, localA, localB, muzzleDir, muzzlePos, ProjectileHit (+5 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.16
Nodes (4): AudioManager, PlayerLoops, getAudioContextCtor(), unlockedManager()

### Community 14 - "Scoring.ts"
Cohesion: 0.31
Nodes (11): DIFFICULTY, MapSize, TANK_SPECS, accuracy(), createStats(), formatTime(), GameStats, killScore() (+3 more)

### Community 15 - "tank.test.ts"
Cohesion: 0.24
Nodes (6): HeightField, drive(), DriveOptions, expectedMuzzle(), flatTerrain(), toWorld()

### Community 16 - "Menu.ts"
Cohesion: 0.06
Nodes (27): MAP_SIZES, DEFAULT_SETTINGS, DIFFICULTIES, GRAPHICS_MODES, GraphicsModeId, MAP_SIZE_IDS, MapIntel, pickBoolean() (+19 more)

### Community 17 - "WorldView"
Cohesion: 0.19
Nodes (3): ObstacleView, createEnvironmentScene(), WorldView

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.15
Nodes (19): AIContext, DifficultySpec, BASE_INPUT, engage(), engagedAttacker(), FixedRandom, Harness, HarnessOptions (+11 more)

### Community 19 - "Radar Display"
Cohesion: 0.16
Nodes (8): bearingOf(), clampToRadius(), Point2, rotateToView(), sweepLag(), viewAngle(), Radar, view()

### Community 20 - "Tank Entity & Aim Solver"
Cohesion: 0.19
Nodes (6): segmentVsTank(), Tank, AimSolver, clipEveryCorner(), makeTank(), makeTank()

### Community 21 - "Spatial Audio Panning"
Cohesion: 0.12
Nodes (19): crushCurve(), distanceGain(), listenerUp(), MAX_DISTANCE, MAX_ONE_SHOT_VOICES, relativePan(), Vec3Like, VoiceSlot (+11 more)

### Community 23 - "Random"
Cohesion: 0.14
Nodes (15): vitest, WORLD, GRAD2, hashSeed(), boundRadiusOf(), DEFAULT_WORLD_OPTIONS, generateWorld(), MAX_BUILDING_SLOPE (+7 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation Step & Waves"
Cohesion: 0.13
Nodes (6): Design principles, Per-tick GameEvent list, Three.js, Simulation, ContactTracker, simWithEnemy()

### Community 27 - "InputManager"
Cohesion: 0.14
Nodes (7): PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget()

### Community 28 - "Enemy Steering & Navigation"
Cohesion: 0.17
Nodes (14): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+6 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.18
Nodes (9): WAVES, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition(), waveEnemyCount(), WaveManager, WavePhase (+1 more)

### Community 30 - "MapProjection"
Cohesion: 0.15
Nodes (3): MapProjection, Contact, projection()

### Community 33 - "Particle System"
Cohesion: 0.14
Nodes (7): Emitter, FlashSlot, LightSlot, makeFlashTexture(), RingSlot, ParticleSpawn, ParticleSystem

### Community 35 - "Game Event Types"
Cohesion: 0.27
Nodes (12): hitZone, HitSurface, Faction, TankKind, FireEvent, GameOverEvent, ImpactEvent, PlayerDamagedEvent (+4 more)

### Community 36 - "Edge Material Library"
Cohesion: 0.22
Nodes (4): createEdge(), createSolid(), MaterialLibrary, Sky

### Community 37 - "combat.test.ts"
Cohesion: 0.18
Nodes (8): applyDamage(), computeDamage(), Damageable, DamageInput, zoneMultiplier(), stepProjectile(), DAMAGE, PROJECTILE

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.20
Nodes (5): PartGeometry, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 41 - ".constructor"
Cohesion: 0.24
Nodes (5): browserStorage(), randomSeed(), seedFromUrl(), BestScoreStore, UiSoundKind

### Community 42 - "Terrain"
Cohesion: 0.21
Nodes (8): segmentVsTerrain(), Terrain, footprintIsUsable(), makeRamp(), makeFlatWorld(), makeWorld(), rampTerrain(), makeRamp()

### Community 43 - "Ballistics.ts"
Cohesion: 0.19
Nodes (11): Difficulty, Easy / Normal / Hard difficulty levels, Enemy perception (line of sight, hearing, reaction delay), Target leading (shell travel-time compensation), isCombatState(), ballisticDirection(), leadTarget(), shellPositionAt() (+3 more)

### Community 44 - "World.ts"
Cohesion: 0.26
Nodes (5): NO_HIT, createStaticHit(), StaticSurface, flatWorld(), settle()

### Community 47 - "settings.ts"
Cohesion: 0.18
Nodes (9): AI, BASE_GEOMETRY, MapSizeSpec, SIM_DT, SIM_HZ, TankSpec, WeaponSpec, createPlayerCommand() (+1 more)

### Community 48 - "AI State Transitions"
Cohesion: 0.29
Nodes (9): decideNextState(), engageState(), shouldEvade(), shouldRetreat(), TransitionInput, EnemyKind, EnemySpawnedEvent, EnemyEntry (+1 more)

### Community 49 - "Game.ts"
Cohesion: 0.14
Nodes (16): three, QualityLevel, AppState, ColourPair, GRAPHICS_MODE_SPECS, EDGE_ROLES, EdgeRole, MaterialOptions (+8 more)

### Community 51 - "HUD"
Cohesion: 0.14
Nodes (4): GameEvent, css(), HUD, pad3()

### Community 56 - "Tank.ts"
Cohesion: 0.18
Nodes (10): NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight, scratchUp (+2 more)

### Community 57 - "Random"
Cohesion: 0.19
Nodes (8): mulberry32 seeded RNG, Seeded procedural battlefield, SimplexNoise2D, Random, generateHeights(), generateObstacles(), pickStructure(), StructureTemplate

### Community 59 - "MapProjection.ts"
Cohesion: 0.16
Nodes (14): fitScale(), formatDistance(), gridColumnLetter(), gridIndex(), gridLabel(), NICE_STEPS, niceScaleLength(), mapSizeBlurb() (+6 more)

### Community 60 - "PerfOverlay"
Cohesion: 0.20
Nodes (5): Performance overlay, Quality, Quality presets with auto-reduce, PerfOverlay, PerfStats

### Community 61 - "EnemyEngines"
Cohesion: 0.31
Nodes (4): enemyEngineParams, selectNearestEnemies(), EnemyEngines, smooth()

### Community 62 - "HudPresenter.ts"
Cohesion: 0.29
Nodes (7): el(), HudFrame, HudTarget, Indicator, MAX_HUD_TARGETS, stat(), DEG

### Community 63 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 64 - "Graphics modes"
Cohesion: 0.39
Nodes (6): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default)

### Community 66 - "CameraState.ts"
Cohesion: 0.53
Nodes (4): AIM_LIMITS, CAMERA_LABELS, CAMERA_LIMITS, CAMERA_MODES

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 276 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simulation` connect `Simulation Step & Waves` to `Tactical Map View`, `Tactical Unit Symbols`, `Scoring.ts`, `Enemy AI Test Harness`, `Radar Display`, `Tank Entity & Aim Solver`, `Visual Effects Bursts`, `Random`, `waves.test.ts`, `combat.test.ts`, `World`, `Game`, `settings.ts`, `Game.ts`, `HUD`, `Random`, `Obstacle`, `MapProjection.ts`, `HudPresenter.ts`, `.fill`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Synth Sound Effects` be split into smaller, more focused modules?**
  _Cohesion score 0.11259920634920635 - nodes in this community are weakly interconnected._
- **Why does `TacticalMap` connect `Tactical Map View` to `Tactical Unit Symbols`, `README Gameplay Concepts`, `.constructor`, `World`, `Game`, `Game.ts`, `Simulation Step & Waves`, `MapProjection`, `.frame`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `Procedural Tank Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.09155844155844156 - nodes in this community are weakly interconnected._
- **Why does `Game` connect `Game` to `audioMath.ts`, `Tactical Map View`, `CameraState`, `Development summary`, `Audio Manager & Mixer`, `Scoring.ts`, `Menu.ts`, `WorldView`, `Radar Display`, `Tank Entity & Aim Solver`, `Simulation Step & Waves`, `Renderer Setup`, `InputManager`, `.frame`, `.constructor`, `Game.ts`, `HUD`, `PerfOverlay`, `main.ts`, `Graphics modes`, `.fill`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.0743321718931475 - nodes in this community are weakly interconnected._