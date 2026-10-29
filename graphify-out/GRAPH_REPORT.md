# Graph Report - tank-attack-3d  (2026-10-29)

## Corpus Check
- 87 files · ~88,951 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1280 nodes · 3742 edges · 60 communities (44 shown, 16 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 422 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e647b56b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- collision.test.ts
- Math Utils & Tank Core
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
- Projectiles & Damage
- Audio Manager & Mixer
- Scoring.ts
- User Settings Store
- Menu Screens
- World Scene Views
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
- clamp
- Input & Gamepad
- Enemy Controller
- Particle System
- Audio Loop Graph
- Game Event Types
- Edge Material Library
- Voice
- Graphify Project Rules
- Tank View & Tracks
- Graphics Mode Specs
- .constructor
- Terrain
- Ballistics Solver
- WeaponSystem.ts
- Graphics Mode Application
- App Bootstrap & WebGL Check
- Graphics Modes & Hidden-Line
- AI State Transitions
- WorldView.ts
- Fake Audio Params
- Contact Tracker
- settings.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- AimState
- World
- Obstacle
- Development summary

## God Nodes (most connected - your core abstractions)
1. `Tank` - 71 edges
2. `Simulation` - 65 edges
3. `Game` - 52 edges
4. `TacticalMap` - 51 edges
5. `World` - 50 edges
6. `Random` - 49 edges
7. `clamp()` - 44 edges
8. `Terrain` - 34 edges
9. `GraphicsModeSpec` - 32 edges
10. `Radar` - 31 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `PerfOverlay` --implements--> `Performance overlay`  [INFERRED]
  src/ui/PerfOverlay.ts → README.md
- `solveElevation()` --implements--> `Crosshair raycast with ballistic gun laying`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
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

## Communities (60 total, 16 thin omitted)

### Community 0 - "collision.test.ts"
Cohesion: 0.17
Nodes (23): circleVsObstacle(), clipSlab(), createPushResult(), exitScratch, PushResult, range, segmentVsAabb(), segmentVsCylinder() (+15 more)

### Community 1 - "Math Utils & Tank Core"
Cohesion: 0.07
Nodes (45): vitest, NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight (+37 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.20
Nodes (34): fireTimbre, steppedGlide(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged(), burst() (+26 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.09
Nodes (41): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+33 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (21): chooseVoice(), voiceLoudness(), warningInterval(), ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer (+13 more)

### Community 5 - "Audio Math & Engine Loops"
Cohesion: 0.11
Nodes (26): CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams, engineParams, FIRE_TIMBRES (+18 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.10
Nodes (4): context2d(), element(), TacticalMap, tacticalTheme

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.10
Nodes (30): AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS, STOPPED_EVENTS, BOUNDARY_DASH (+22 more)

### Community 9 - "README Gameplay Concepts"
Cohesion: 0.08
Nodes (24): 3D Tanks (1989 Acorn Archimedes), Aiming, Battlezone (1980 arcade), Gunner / chase / tactical cameras, Compact radar, Controls, Directional damage zones and armour, Enemies (+16 more)

### Community 12 - "Projectiles & Damage"
Cohesion: 0.12
Nodes (17): applyDamage(), computeDamage(), Damageable, DamageInput, hitZone, zoneMultiplier(), createProjectileHit(), fireWeapon() (+9 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.18
Nodes (4): AudioManager, Mixer, getAudioContextCtor(), unlockedManager()

### Community 14 - "Scoring.ts"
Cohesion: 0.20
Nodes (11): DIFFICULTY, TANK_SPECS, WAVES, accuracy(), BestScoreStore, createStats(), formatTime(), KeyValueStore (+3 more)

### Community 15 - "User Settings Store"
Cohesion: 0.19
Nodes (11): browserStorage(), DEFAULT_SETTINGS, GRAPHICS_MODES, MapIntel, pickBoolean(), pickEnum(), pickNumber(), QUALITY_LEVELS (+3 more)

### Community 16 - "Menu Screens"
Cohesion: 0.20
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.14
Nodes (19): AIContext, DifficultySpec, BASE_INPUT, engage(), engagedAttacker(), FixedRandom, Harness, HarnessOptions (+11 more)

### Community 19 - "Radar Display"
Cohesion: 0.10
Nodes (17): bearingOf(), clampToRadius(), Point2, rotateToView(), sweepLag(), viewAngle(), BOUNDARY_DASH, NO_DASH (+9 more)

### Community 20 - "Tank Entity & Aim Solver"
Cohesion: 0.21
Nodes (7): segmentVsTank(), Tank, AimSolver, clipEveryCorner(), makeTank(), simWithEnemy(), makeTank()

### Community 21 - "Spatial Audio Panning"
Cohesion: 0.14
Nodes (15): crushCurve(), listenerUp(), MAX_DISTANCE, MAX_ONE_SHOT_VOICES, relativePan(), Vec3Like, VoiceBuilder, AudioContextCtor (+7 more)

### Community 23 - "Random"
Cohesion: 0.11
Nodes (22): mulberry32 seeded RNG, Seeded procedural battlefield, WORLD, GRAD2, SimplexNoise2D, hashSeed(), Random, boundRadiusOf() (+14 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation Step & Waves"
Cohesion: 0.10
Nodes (8): Architecture, Design principles, Per-tick GameEvent list, Three.js, GameStats, createPlayerCommand(), Simulation, run()

### Community 26 - "Renderer Setup"
Cohesion: 0.12
Nodes (4): Performance overlay, Quality, Quality presets with auto-reduce, Renderer

### Community 27 - "HUD"
Cohesion: 0.20
Nodes (3): GameEvent, HUD, pad3()

### Community 28 - "Enemy Steering & Navigation"
Cohesion: 0.16
Nodes (15): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+7 more)

### Community 29 - "Wave Composition"
Cohesion: 0.20
Nodes (10): EnemyKind, EnemySpawnedEvent, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition(), waveEnemyCount(), WaveManager (+2 more)

### Community 30 - "clamp"
Cohesion: 0.10
Nodes (17): fitScale(), formatDistance(), gridColumnLetter(), gridIndex(), gridLabel(), MapProjection, NICE_STEPS, niceScaleLength() (+9 more)

### Community 31 - "Input & Gamepad"
Cohesion: 0.12
Nodes (9): PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget(), flatWorld() (+1 more)

### Community 32 - "Enemy Controller"
Cohesion: 0.19
Nodes (3): EnemyController, AIState, EnemyEntry

### Community 33 - "Particle System"
Cohesion: 0.14
Nodes (7): Emitter, FlashSlot, LightSlot, makeFlashTexture(), RingSlot, ParticleSpawn, ParticleSystem

### Community 35 - "Game Event Types"
Cohesion: 0.26
Nodes (11): HitSurface, Faction, TankKind, FireEvent, GameOverEvent, ImpactEvent, PlayerDamagedEvent, TankDestroyedEvent (+3 more)

### Community 36 - "Edge Material Library"
Cohesion: 0.23
Nodes (4): createEdge(), createSolid(), MaterialLibrary, Sky

### Community 37 - "Voice"
Cohesion: 0.13
Nodes (5): distanceGain(), VoiceSlot, createPanner(), Voice, VoicePool

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.16
Nodes (6): ObstacleView, PartGeometry, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 40 - "Graphics Mode Specs"
Cohesion: 0.14
Nodes (13): DIFFICULTIES, GraphicsModeId, AppState, randomSeed(), seedFromUrl(), GRAPHICS_MODE_SPECS, Control, difficultyBlurb() (+5 more)

### Community 42 - "Terrain"
Cohesion: 0.17
Nodes (9): Terrain, footprintBase(), footprintIsUsable(), makeRamp(), makeWorld(), drive(), flatTerrain(), rampTerrain() (+1 more)

### Community 43 - "Ballistics Solver"
Cohesion: 0.19
Nodes (11): Difficulty, Easy / Normal / Hard difficulty levels, Enemy perception (line of sight, hearing, reaction delay), Target leading (shell travel-time compensation), isCombatState(), ballisticDirection(), leadTarget(), shellPositionAt() (+3 more)

### Community 44 - "WeaponSystem.ts"
Cohesion: 0.23
Nodes (10): invQuat, localA, localB, muzzleDir, muzzlePos, ProjectileHit, staticHit, NO_HIT (+2 more)

### Community 46 - "App Bootstrap & WebGL Check"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 47 - "Graphics Modes & Hidden-Line"
Cohesion: 0.39
Nodes (6): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default)

### Community 48 - "AI State Transitions"
Cohesion: 0.43
Nodes (6): decideNextState(), engageState(), shouldEvade(), shouldRetreat(), TransitionInput, decide()

### Community 49 - "WorldView.ts"
Cohesion: 0.15
Nodes (14): three, QualityLevel, ColourPair, EDGE_ROLES, EdgeRole, MaterialOptions, SOLID_ROLES, SolidRole (+6 more)

### Community 52 - "settings.ts"
Cohesion: 0.18
Nodes (6): BASE_GEOMETRY, SIM_DT, SIM_HZ, TankSpec, WeaponSpec, FixedStepAccumulator

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simulation` connect `Simulation Step & Waves` to `Math Utils & Tank Core`, `Tactical Map View`, `Tactical Unit Symbols`, `Game Controller Lifecycle`, `Projectiles & Damage`, `Scoring.ts`, `Enemy AI Test Harness`, `Radar Display`, `Tank Entity & Aim Solver`, `Visual Effects Bursts`, `Random`, `HUD`, `Wave Composition`, `clamp`, `Graphics Mode Specs`, `WorldView.ts`, `Contact Tracker`, `World`, `Obstacle`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Math Utils & Tank Core` be split into smaller, more focused modules?**
  _Cohesion score 0.06939890710382514 - nodes in this community are weakly interconnected._
- **Why does `Tank` connect `Tank Entity & Aim Solver` to `Math Utils & Tank Core`, `Tactical Unit Symbols`, `Camera State & Manager`, `Projectiles & Damage`, `Enemy AI Test Harness`, `Radar Display`, `Random`, `Simulation Step & Waves`, `Enemy Steering & Navigation`, `clamp`, `Input & Gamepad`, `Enemy Controller`, `Edge Material Library`, `Tank View & Tracks`, `Graphics Mode Specs`, `Terrain`, `WeaponSystem.ts`, `Contact Tracker`, `settings.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `Procedural Tank Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.09155844155844156 - nodes in this community are weakly interconnected._
- **Why does `GameEvent` connect `HUD` to `Math Utils & Tank Core`, `Synth Sound Effects`, `Game Event Types`, `Particle System`, `Audio Math & Engine Loops`, `Audio Test Fakes`, `Graphics Mode Specs`, `Projectiles & Damage`, `WorldView.ts`, `Visual Effects Bursts`, `Simulation Step & Waves`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.06868686868686869 - nodes in this community are weakly interconnected._