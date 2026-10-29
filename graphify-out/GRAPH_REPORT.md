# Graph Report - tank-attack-3d  (2026-10-29)

## Corpus Check
- 89 files · ~87,886 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1271 nodes · 3708 edges · 56 communities (44 shown, 12 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 419 edges (avg confidence: 0.85)
- Token cost: 229,518 input · 0 output

## Community Hubs (Navigation)
- World, Terrain & Collision
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
- Tank Specs & Difficulty
- User Settings Store
- Menu Screens
- World Scene Views
- Enemy AI Test Harness
- Radar Display
- Tank Entity & Aim Solver
- Spatial Audio Panning
- Visual Effects Bursts
- Radar Projection Math
- TypeScript Config
- Simulation Step & Waves
- Renderer Setup
- HUD Presenter
- Enemy Steering & Navigation
- Wave Composition
- Tactical Map Data Helpers
- Input & Gamepad
- Enemy Controller
- Particle System
- Audio Loop Graph
- Game Event Types
- Edge Material Library
- Map Projection & Zoom
- Graphify Project Rules
- Tank View & Tracks
- Graphics Mode Specs
- Best Score & Attract Mode
- Perf Overlay & Quality
- Ballistics Solver
- Event Processing Pipeline
- Graphics Mode Application
- App Bootstrap & WebGL Check
- Graphics Modes & Hidden-Line
- AI State Transitions
- Quality Presets & CRT Shader
- Fake Audio Params
- Contact Tracker
- Fixed-Step Game Loop
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `Tank` - 71 edges
2. `Simulation` - 65 edges
3. `Game` - 52 edges
4. `TacticalMap` - 51 edges
5. `World` - 50 edges
6. `Random` - 48 edges
7. `clamp()` - 44 edges
8. `Terrain` - 34 edges
9. `GraphicsModeSpec` - 32 edges
10. `Radar` - 31 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `solveElevation()` --implements--> `Crosshair raycast with ballistic gun laying`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `zoneMultiplier()` --implements--> `Directional damage zones and armour`  [INFERRED]
  src/combat/DamageSystem.ts → README.md
- `Design principles` --references--> `Tank`  [INFERRED]
  README.md → src/entities/Tank.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (56 total, 12 thin omitted)

### Community 0 - "World, Terrain & Collision"
Cohesion: 0.05
Nodes (60): createProjectileHit(), invQuat, localA, localB, muzzleDir, muzzlePos, ProjectileHit, staticHit (+52 more)

### Community 1 - "Math Utils & Tank Core"
Cohesion: 0.05
Nodes (53): mulberry32 seeded RNG, Seeded procedural battlefield, three, vitest, NO_CONTROLS, scratchBack, scratchForward, scratchLocal (+45 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.11
Nodes (36): fireTimbre, steppedGlide(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged(), burst() (+28 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.10
Nodes (37): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+29 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (18): ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain (+10 more)

### Community 5 - "Audio Math & Engine Loops"
Cohesion: 0.10
Nodes (30): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams, engineParams (+22 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.10
Nodes (5): fitScale(), gridColumnLetter(), context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.10
Nodes (29): AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS, STOPPED_EVENTS, BOUNDARY_DASH (+21 more)

### Community 9 - "README Gameplay Concepts"
Cohesion: 0.07
Nodes (29): 3D Tanks (1989 Acorn Archimedes), Aiming, Architecture, Battlezone (1980 arcade), Gunner / chase / tactical cameras, Compact radar, Controls, Difficulty (+21 more)

### Community 10 - "Camera State & Manager"
Cohesion: 0.09
Nodes (3): CameraManager, AimState, CameraState

### Community 11 - "Game Controller Lifecycle"
Cohesion: 0.17
Nodes (3): window.__vt development debug handle, Development summary, Game

### Community 12 - "Projectiles & Damage"
Cohesion: 0.11
Nodes (12): applyDamage(), computeDamage(), Damageable, DamageInput, hitZone, zoneMultiplier(), fireWeapon(), stepProjectile() (+4 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.15
Nodes (6): AudioManager, Vec3Like, PlayerLoops, Mixer, NoiseBank, unlockedManager()

### Community 14 - "Tank Specs & Difficulty"
Cohesion: 0.19
Nodes (19): AI, BASE_GEOMETRY, DIFFICULTY, PROJECTILE, SIM_HZ, TANK_SPECS, WAVES, WeaponSpec (+11 more)

### Community 15 - "User Settings Store"
Cohesion: 0.12
Nodes (14): browserStorage(), DEFAULT_SETTINGS, DIFFICULTIES, MapIntel, pickBoolean(), pickEnum(), pickNumber(), QUALITY_LEVELS (+6 more)

### Community 16 - "Menu Screens"
Cohesion: 0.19
Nodes (5): UserSettings, difficultyBlurb(), make(), Menu, MenuCallbacks

### Community 17 - "World Scene Views"
Cohesion: 0.15
Nodes (5): ObstacleView, ProjectileView, Sky, createEnvironmentScene(), WorldView

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.14
Nodes (20): AIContext, DifficultySpec, BASE_INPUT, engage(), engagedAttacker(), FixedRandom, Harness, HarnessOptions (+12 more)

### Community 19 - "Radar Display"
Cohesion: 0.15
Nodes (4): Radar, GraphicsModeId, rgba(), tacticalTheme

### Community 20 - "Tank Entity & Aim Solver"
Cohesion: 0.17
Nodes (6): segmentVsTank(), Tank, AimSolver, clipEveryCorner(), makeTank(), makeTank()

### Community 21 - "Spatial Audio Panning"
Cohesion: 0.14
Nodes (16): crushCurve(), distanceGain(), listenerUp(), MAX_DISTANCE, MAX_ONE_SHOT_VOICES, relativePan(), VoiceSlot, VoiceBuilder (+8 more)

### Community 23 - "Radar Projection Math"
Cohesion: 0.18
Nodes (16): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), viewAngle(), BOUNDARY_DASH (+8 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation Step & Waves"
Cohesion: 0.17
Nodes (5): Design principles, Per-tick GameEvent list, Three.js, Simulation, simWithEnemy()

### Community 27 - "HUD Presenter"
Cohesion: 0.16
Nodes (5): css(), HudPresenter, CameraMode, HUD, pad3()

### Community 28 - "Enemy Steering & Navigation"
Cohesion: 0.17
Nodes (14): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+6 more)

### Community 29 - "Wave Composition"
Cohesion: 0.19
Nodes (11): EnemyKind, EnemySpawnedEvent, EnemyEntry, aimErrorScale(), maxConcurrentEnemies(), shareFrom(), waveComposition(), waveEnemyCount() (+3 more)

### Community 30 - "Tactical Map Data Helpers"
Cohesion: 0.15
Nodes (11): formatDistance(), gridIndex(), gridLabel(), niceScaleLength(), CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH, sampleHeights() (+3 more)

### Community 31 - "Input & Gamepad"
Cohesion: 0.18
Nodes (5): applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget()

### Community 33 - "Particle System"
Cohesion: 0.13
Nodes (7): Emitter, FlashSlot, LightSlot, makeFlashTexture(), RingSlot, ParticleSpawn, ParticleSystem

### Community 35 - "Game Event Types"
Cohesion: 0.21
Nodes (12): HitSurface, Faction, TankKind, TankSpec, FireEvent, GameOverEvent, ImpactEvent, PlayerDamagedEvent (+4 more)

### Community 36 - "Edge Material Library"
Cohesion: 0.20
Nodes (8): createEdge(), createSolid(), EDGE_ROLES, EdgeRole, MaterialLibrary, MaterialOptions, SOLID_ROLES, SolidRole

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.24
Nodes (3): PartGeometry, writeTrackSegments(), TankView

### Community 40 - "Graphics Mode Specs"
Cohesion: 0.20
Nodes (9): GRAPHICS_MODES, GraphicsModeId, ColourPair, GRAPHICS_MODE_SPECS, Control, GameOverSummary, MenuScreen, SECTIONS (+1 more)

### Community 41 - "Best Score & Attract Mode"
Cohesion: 0.25
Nodes (3): randomSeed(), seedFromUrl(), BestScoreStore

### Community 42 - "Perf Overlay & Quality"
Cohesion: 0.22
Nodes (5): Performance overlay, Quality, Quality presets with auto-reduce, PerfOverlay, PerfStats

### Community 43 - "Ballistics Solver"
Cohesion: 0.31
Nodes (7): isCombatState(), ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like

### Community 44 - "Event Processing Pipeline"
Cohesion: 0.31
Nodes (4): SIM_DT, GameEvent, createPlayerCommand(), run()

### Community 46 - "App Bootstrap & WebGL Check"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 47 - "Graphics Modes & Hidden-Line"
Cohesion: 0.39
Nodes (6): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default)

### Community 48 - "AI State Transitions"
Cohesion: 0.43
Nodes (6): decideNextState(), engageState(), shouldEvade(), shouldRetreat(), TransitionInput, decide()

### Community 49 - "Quality Presets & CRT Shader"
Cohesion: 0.33
Nodes (5): QualityLevel, CRT_SHADER, QUALITY_PRESETS, QualityPreset, RenderConfig

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simulation` connect `Simulation Step & Waves` to `World, Terrain & Collision`, `Math Utils & Tank Core`, `Tactical Map View`, `Tactical Unit Symbols`, `Best Score & Attract Mode`, `Game Controller Lifecycle`, `Event Processing Pipeline`, `Projectiles & Damage`, `Tank Specs & Difficulty`, `Enemy AI Test Harness`, `Radar Display`, `Tank Entity & Aim Solver`, `Contact Tracker`, `Visual Effects Bursts`, `Radar Projection Math`, `HUD Presenter`, `Wave Composition`, `Tactical Map Data Helpers`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `World, Terrain & Collision` be split into smaller, more focused modules?**
  _Cohesion score 0.05183459522422831 - nodes in this community are weakly interconnected._
- **Why does `Tank` connect `Tank Entity & Aim Solver` to `Enemy Controller`, `World, Terrain & Collision`, `Math Utils & Tank Core`, `Game Event Types`, `Tank View & Tracks`, `Tactical Unit Symbols`, `Camera State & Manager`, `Projectiles & Damage`, `Tank Specs & Difficulty`, `Enemy AI Test Harness`, `Radar Display`, `Contact Tracker`, `Radar Projection Math`, `Simulation Step & Waves`, `HUD Presenter`, `Enemy Steering & Navigation`, `Wave Composition`, `Tactical Map Data Helpers`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `Math Utils & Tank Core` be split into smaller, more focused modules?**
  _Cohesion score 0.05465765501028504 - nodes in this community are weakly interconnected._
- **Why does `TacticalMap` connect `Tactical Map View` to `World, Terrain & Collision`, `Map Projection & Zoom`, `Tactical Unit Symbols`, `Best Score & Attract Mode`, `README Gameplay Concepts`, `Game Controller Lifecycle`, `Camera State & Manager`, `Tank Specs & Difficulty`, `Contact Tracker`, `Radar Display`, `Simulation Step & Waves`, `Tactical Map Data Helpers`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Synth Sound Effects` be split into smaller, more focused modules?**
  _Cohesion score 0.10955710955710955 - nodes in this community are weakly interconnected._