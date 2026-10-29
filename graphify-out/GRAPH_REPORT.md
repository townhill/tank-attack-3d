# Graph Report - tank-attack-3d  (2026-10-29)

## Corpus Check
- 107 files · ~177,135 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1476 nodes · 4524 edges · 60 communities (48 shown, 12 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 482 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ed1a7e4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- World.ts
- math.ts
- Synth Sound Effects
- Procedural Tank Geometry
- Audio Test Fakes
- audioMath.ts
- Package & Lint Config
- Tactical Map View
- Tactical Unit Symbols
- VECTOR TANKS
- Game.ts
- Mixer
- WeaponSystem.ts
- Audio Manager & Mixer
- Game.ts
- combat.test.ts
- Menu
- WorldView
- Enemy AI Test Harness
- Radar Display
- Tank Entity & Aim Solver
- Spatial Audio Panning
- Visual Effects Bursts
- WorldGenerator.ts
- TypeScript Config
- Simulation Step & Waves
- Renderer Setup
- InputManager
- EnemyAI.ts
- waves.test.ts
- MapProjection
- MaterialLibrary
- Enemy Controller
- settings.ts
- Audio Loop Graph
- WaterMap
- Effects.ts
- MinHeap
- Graphify Project Rules
- Tank View & Tracks
- events.ts
- Graphics modes
- Terrain
- KeyValueStore
- NavGrid
- Graphics Mode Application
- Game
- main.ts
- ContactTracker
- WorldView.ts
- Fake Audio Params
- HUD
- settings.ts
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- WaterGenerator.ts
- World
- MapProjection.ts
- PerfOverlay

## God Nodes (most connected - your core abstractions)
1. `Tank` - 76 edges
2. `Simulation` - 72 edges
3. `World` - 71 edges
4. `Random` - 55 edges
5. `Game` - 54 edges
6. `clamp()` - 52 edges
7. `TacticalMap` - 51 edges
8. `Terrain` - 49 edges
9. `GraphicsModeSpec` - 34 edges
10. `Radar` - 31 edges

## Surprising Connections (you probably didn't know these)
- `AudioManager` --implements--> `Synthesised Web Audio`  [INFERRED]
  src/audio/AudioManager.ts → README.md
- `leadTarget()` --implements--> `Target leading (shell travel-time compensation)`  [INFERRED]
  src/combat/Ballistics.ts → README.md
- `PerfOverlay` --implements--> `Performance overlay`  [INFERRED]
  src/ui/PerfOverlay.ts → README.md
- `zoneMultiplier()` --implements--> `Directional damage zones and armour`  [INFERRED]
  src/combat/DamageSystem.ts → README.md
- `Projectile` --implements--> `No allocation in hot loops (pooling)`  [EXTRACTED]
  src/entities/Projectile.ts → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Enemy AI stack (state machine, perception, steering, fire control)** — src_ai_statemachine, src_ai_enemyai, src_ai_navigation, readme_enemy_ai_state_machine, readme_enemy_perception, readme_local_steering, readme_gaussian_aim_error [EXTRACTED 1.00]
- **Hidden-line vector rendering pipeline** — readme_hidden_line_removal, readme_terrain_shader_grid, src_rendering_materials, src_rendering_terrainview_terrainview, src_rendering_graphicsmodes [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]
- **Deterministic headless simulation core** — src_game_simulation_simulation, src_game_gameloop_fixedstepaccumulator, src_entities_tank_tank, readme_fixed_timestep, readme_simulation_presentation_separation, readme_gameevent_stream [INFERRED 0.85]

## Communities (60 total, 12 thin omitted)

### Community 0 - "World.ts"
Cohesion: 0.10
Nodes (47): bridgePieces(), Bridge, bridgeBoundRadius(), createBridgeLocal(), DECK_THICKNESS, deckHeightAt(), exitScratch, isOnDeck() (+39 more)

### Community 1 - "math.ts"
Cohesion: 0.06
Nodes (45): TankSpec, NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight (+37 more)

### Community 2 - "Synth Sound Effects"
Cohesion: 0.22
Nodes (34): fireTimbre, steppedGlide(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged(), burst() (+26 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.09
Nodes (41): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+33 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (20): chooseVoice(), voiceLoudness(), ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource (+12 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.11
Nodes (26): CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams, engineParams, FIRE_TIMBRES (+18 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.09
Nodes (3): context2d(), element(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.08
Nodes (39): BOUNDARY_DASH, NO_DASH, RadarOrientation, RING_FRACTIONS, AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH (+31 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.08
Nodes (25): 3D Tanks (1989 Acorn Archimedes), Battlezone (1980 arcade), Compact radar, Controls, Difficulty, Easy / Normal / Hard difficulty levels, Directional damage zones and armour, Enemies (+17 more)

### Community 10 - "Game.ts"
Cohesion: 0.10
Nodes (12): Gunner / chase / tactical cameras, AppState, randomSeed(), seedFromUrl(), PlayerController, PlayerCommand, GAME_KEYS, GamepadState (+4 more)

### Community 11 - "Mixer"
Cohesion: 0.13
Nodes (5): Vec3Like, Mixer, NoiseBank, Voice, VoicePool

### Community 12 - "WeaponSystem.ts"
Cohesion: 0.09
Nodes (19): createProjectileHit(), fireWeapon(), invQuat, localA, localB, muzzleDir, muzzlePos, ProjectileHit (+11 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.19
Nodes (4): AudioManager, UiSound, getAudioContextCtor(), unlockedManager()

### Community 14 - "Game.ts"
Cohesion: 0.11
Nodes (21): MAP_SIZES, MapSize, browserStorage(), DIFFICULTIES, GRAPHICS_MODES, GraphicsModeId, MAP_SIZE_IDS, MapIntel (+13 more)

### Community 15 - "combat.test.ts"
Cohesion: 0.13
Nodes (16): Aiming, Gun marker (actual barrel aim indicator), ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like (+8 more)

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView"
Cohesion: 0.24
Nodes (6): BridgeView, ObstacleView, TerrainView, WaterView, createEnvironmentScene(), WorldView

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.10
Nodes (28): AIContext, AIState, decideNextState(), engageState(), isCombatState(), shouldEvade(), shouldRetreat(), TransitionInput (+20 more)

### Community 19 - "Radar Display"
Cohesion: 0.15
Nodes (8): bearingOf(), clampToRadius(), Point2, rotateToView(), sweepLag(), viewAngle(), Radar, view()

### Community 20 - "Tank Entity & Aim Solver"
Cohesion: 0.18
Nodes (8): segmentVsTank(), Tank, AimSolver, hashSeed(), placeTank(), clipEveryCorner(), makeTank(), makeTank()

### Community 21 - "Spatial Audio Panning"
Cohesion: 0.13
Nodes (16): crushCurve(), distanceGain(), listenerUp(), MAX_DISTANCE, MAX_ONE_SHOT_VOICES, relativePan(), VoiceSlot, VoiceBuilder (+8 more)

### Community 23 - "WorldGenerator.ts"
Cohesion: 0.10
Nodes (24): mulberry32 seeded RNG, Seeded procedural battlefield, WORLD, GRAD2, SimplexNoise2D, Random, boundRadiusOf(), ObstacleKind (+16 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation Step & Waves"
Cohesion: 0.12
Nodes (6): Architecture, Design principles, Per-tick GameEvent list, Three.js, Simulation, simWithEnemy()

### Community 27 - "InputManager"
Cohesion: 0.11
Nodes (3): applyDeadzone(), InputManager, isEditableTarget()

### Community 28 - "EnemyAI.ts"
Cohesion: 0.17
Nodes (14): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+6 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.14
Nodes (20): DIFFICULTY, EnemyKind, TANK_SPECS, WAVES, accuracy(), createStats(), formatTime(), GameStats (+12 more)

### Community 30 - "MapProjection"
Cohesion: 0.24
Nodes (3): MapProjection, unitColor(), projection()

### Community 31 - "MaterialLibrary"
Cohesion: 0.14
Nodes (5): makeFlashTexture(), createEdge(), createSolid(), MaterialLibrary, Sky

### Community 33 - "settings.ts"
Cohesion: 0.09
Nodes (38): vitest, BASE_GEOMETRY, BRIDGE, MapSizeSpec, SIM_HZ, WATER, WeaponSpec, BridgeLocal (+30 more)

### Community 35 - "WaterMap"
Cohesion: 0.13
Nodes (8): DistanceField, FAR_DISTANCE, lowerEnvelope(), PlanarVector, squaredDistances(), WaterMap, dryFeatures(), randomMask()

### Community 36 - "Effects.ts"
Cohesion: 0.12
Nodes (6): Emitter, FlashSlot, LightSlot, RingSlot, ParticleSpawn, ParticleSystem

### Community 37 - "MinHeap"
Cohesion: 0.20
Nodes (3): MinHeap, CourseGrid, planRivers()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.18
Nodes (6): PartGeometry, TRACK_SEGMENT_COUNT, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 40 - "events.ts"
Cohesion: 0.23
Nodes (12): HitSurface, Faction, TankKind, EnemySpawnedEvent, FireEvent, GameOverEvent, ImpactEvent, PlayerDamagedEvent (+4 more)

### Community 41 - "Graphics modes"
Cohesion: 0.25
Nodes (9): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), Performance overlay, Quality (+1 more)

### Community 42 - "Terrain"
Cohesion: 0.18
Nodes (12): buildChunk(), gradeApproaches(), shoreCap(), crossEdge(), crossings, crossTriangle(), shorelineSegments(), Terrain (+4 more)

### Community 43 - "KeyValueStore"
Cohesion: 0.13
Nodes (7): DEFAULT_SETTINGS, SettingsStore, BestScoreStore, KeyValueStore, mapSizeLabel(), MemoryStore, MemoryStore

### Community 44 - "NavGrid"
Cohesion: 0.33
Nodes (3): NavGrid, planLakes(), generateWaterFeatures()

### Community 46 - "Game"
Cohesion: 0.15
Nodes (3): window.__vt development debug handle, Development summary, Game

### Community 47 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 49 - "WorldView.ts"
Cohesion: 0.14
Nodes (14): three, QualityLevel, ColourPair, EDGE_ROLES, EdgeRole, MaterialOptions, SOLID_ROLES, SolidRole (+6 more)

### Community 51 - "HUD"
Cohesion: 0.12
Nodes (6): GameEvent, css(), HudPresenter, CameraMode, HUD, pad3()

### Community 57 - "WaterGenerator.ts"
Cohesion: 0.13
Nodes (31): clamp(), lerp(), smoothstep(), lakeRadiusAt(), carveLake(), carveRiver(), carveWater(), chaikin() (+23 more)

### Community 58 - "World"
Cohesion: 0.17
Nodes (5): PushResult, Obstacle, ObstacleGrid, segmentPassesNear(), World

### Community 59 - "MapProjection.ts"
Cohesion: 0.14
Nodes (15): fitScale(), formatDistance(), gridColumnLetter(), gridIndex(), gridLabel(), NICE_STEPS, niceScaleLength(), mapSizeBlurb() (+7 more)

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 302 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simulation` connect `Simulation Step & Waves` to `math.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `Game.ts`, `WeaponSystem.ts`, `combat.test.ts`, `Enemy AI Test Harness`, `Radar Display`, `Tank Entity & Aim Solver`, `Visual Effects Bursts`, `WorldGenerator.ts`, `waves.test.ts`, `settings.ts`, `Game`, `ContactTracker`, `WorldView.ts`, `HUD`, `World`, `MapProjection.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `World.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0994535519125683 - nodes in this community are weakly interconnected._
- **Why does `clamp()` connect `WaterGenerator.ts` to `Enemy Controller`, `math.ts`, `Synth Sound Effects`, `settings.ts`, `Audio Test Fakes`, `audioMath.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `MapProjection.ts`, `Game.ts`, `Audio Manager & Mixer`, `combat.test.ts`, `Radar Display`, `Tank Entity & Aim Solver`, `Spatial Audio Panning`, `InputManager`, `EnemyAI.ts`, `MapProjection`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `math.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06400409626216078 - nodes in this community are weakly interconnected._
- **Why does `Tank` connect `Tank Entity & Aim Solver` to `Enemy Controller`, `math.ts`, `Tank View & Tracks`, `Tactical Unit Symbols`, `Tactical Map View`, `Game.ts`, `WeaponSystem.ts`, `combat.test.ts`, `ContactTracker`, `Enemy AI Test Harness`, `HUD`, `Radar Display`, `Simulation Step & Waves`, `MapProjection.ts`, `EnemyAI.ts`, `waves.test.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `Procedural Tank Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.09220779220779221 - nodes in this community are weakly interconnected._