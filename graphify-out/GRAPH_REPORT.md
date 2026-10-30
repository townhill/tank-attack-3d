# Graph Report - tank-attack-3d  (2026-10-30)

## Corpus Check
- 115 files · ~187,988 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1565 nodes · 4888 edges · 62 communities (53 shown, 9 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 511 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2caddf00`
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
- combat.test.ts
- Audio Manager & Mixer
- Game.ts
- WorldView.ts
- Menu
- WorldView
- Enemy AI Test Harness
- Radar Display
- Tank.ts
- .frame
- Visual Effects Bursts
- WorldGenerator.ts
- TypeScript Config
- Simulation
- .applySettings
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
- Ballistics.ts
- StateMachine.ts
- Terrain
- settings.ts
- Tank
- Graphics Mode Application
- Game
- ContactTracker
- Bridge.ts
- MaterialLibrary
- Fake Audio Params
- HUD
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- WaterGenerator.ts
- World.ts
- MapProjection.ts
- .constructor
- aiWater.test.ts
- tacticalData.ts
- distanceField.ts

## God Nodes (most connected - your core abstractions)
1. `Tank` - 91 edges
2. `World` - 79 edges
3. `Simulation` - 76 edges
4. `Random` - 57 edges
5. `Game` - 54 edges
6. `Terrain` - 54 edges
7. `clamp()` - 53 edges
8. `TacticalMap` - 51 edges
9. `Obstacle` - 35 edges
10. `GraphicsModeSpec` - 34 edges

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

## Communities (62 total, 9 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.16
Nodes (18): belowTerrain(), belowWater(), clipSlab(), exitScratch, marchBelow(), marchToSurface(), range, segmentVsAabb() (+10 more)

### Community 1 - "Random"
Cohesion: 0.21
Nodes (4): AIContext, Sky, Random, Harness

### Community 2 - "Synth Sound Effects"
Cohesion: 0.25
Nodes (29): fireTimbre, steppedGlide(), burst(), cannon(), CLANG_PARTIALS, crushedBurst(), detune(), explosion() (+21 more)

### Community 3 - "Procedural Tank Geometry"
Cohesion: 0.09
Nodes (41): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+33 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (18): ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain (+10 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.07
Nodes (44): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, crushCurve(), ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams (+36 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.10
Nodes (3): gridColumnLetter(), context2d(), TacticalMap

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.09
Nodes (32): AIM_DASH, BOUNDARY_DASH, element(), MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS, STOPPED_EVENTS (+24 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.07
Nodes (28): 3D Tanks (1989 Acorn Archimedes), Aiming, Battlezone (1980 arcade), Gunner / chase / tactical cameras, Compact radar, Controls, Difficulty, Easy / Normal / Hard difficulty levels (+20 more)

### Community 10 - "Design principles"
Cohesion: 0.20
Nodes (4): Architecture, Design principles, Per-tick GameEvent list, Three.js

### Community 11 - "Mixer"
Cohesion: 0.19
Nodes (8): distanceGain(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged(), createPanner(), Voice

### Community 12 - "combat.test.ts"
Cohesion: 0.10
Nodes (22): computeDamage(), Damageable, DamageInput, hitZone, zoneMultiplier(), fireWeapon(), HitSurface, DAMAGE (+14 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.11
Nodes (5): AudioManager, Mixer, getAudioContextCtor(), VoicePool, unlockedManager()

### Community 14 - "Game.ts"
Cohesion: 0.09
Nodes (20): MAP_SIZES, DIFFICULTIES, GRAPHICS_MODES, MAP_SIZE_IDS, MapIntel, pickBoolean(), pickEnum(), pickNumber() (+12 more)

### Community 15 - "WorldView.ts"
Cohesion: 0.11
Nodes (20): Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), three, TankKind, GraphicsModeId (+12 more)

### Community 16 - "Menu"
Cohesion: 0.19
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 17 - "WorldView"
Cohesion: 0.18
Nodes (7): BridgeView, ObstacleView, TerrainView, WaterView, createEnvironmentScene(), WorldView, World

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.18
Nodes (16): BASE_INPUT, engage(), engagedAttacker(), FixedRandom, makeFlatWorld(), makeHarness(), makeObstacle(), placeTank() (+8 more)

### Community 19 - "Radar Display"
Cohesion: 0.18
Nodes (3): viewAngle(), Radar, rgba()

### Community 20 - "Tank.ts"
Cohesion: 0.07
Nodes (43): WORLD, NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight (+35 more)

### Community 22 - "Visual Effects Bursts"
Cohesion: 0.21
Nodes (3): Effects, generateObstacles(), pickStructure()

### Community 23 - "WorldGenerator.ts"
Cohesion: 0.15
Nodes (19): placeBridges(), boundRadiusOf(), BoxShape, buildingStoreys(), CircleShape, ObstacleKind, ObstacleShape, STOREY_HEIGHT (+11 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation"
Cohesion: 0.13
Nodes (5): applyDamage(), stepProjectile(), Simulation, simWithEnemy(), riverSim()

### Community 26 - ".applySettings"
Cohesion: 0.07
Nodes (6): Performance overlay, Quality, Quality presets with auto-reduce, Renderer, PerfOverlay, PerfStats

### Community 27 - "InputManager"
Cohesion: 0.09
Nodes (10): DEFAULT_SETTINGS, PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget() (+2 more)

### Community 28 - "EnemyAI.ts"
Cohesion: 0.16
Nodes (16): Gaussian aim error, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering (+8 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.14
Nodes (14): AudioEnemy, DifficultySpec, EnemyKind, EnemySpawnedEvent, EnemyEntry, aimErrorScale(), maxConcurrentEnemies(), shareFrom() (+6 more)

### Community 31 - "tacticalWater.test.ts"
Cohesion: 0.18
Nodes (9): drawBridgeSymbol(), GraphicsModeId, tacticalTheme, drawMapBridges(), ShorelineIndex, compareWithBruteForce(), Extent, Recording (+1 more)

### Community 32 - "Enemy Controller"
Cohesion: 0.16
Nodes (4): EnemyController, AIState, Mission, randomMask()

### Community 33 - "BridgePlacer.ts"
Cohesion: 0.10
Nodes (31): BRIDGE, WATER, BridgeLocal, BANK_LINES, bankDistance(), buildBridge(), Crossing, planCrossing() (+23 more)

### Community 35 - "WaterMap"
Cohesion: 0.18
Nodes (4): Bridge, DistanceField, WaterMap, gridWith()

### Community 36 - "Effects.ts"
Cohesion: 0.12
Nodes (7): Emitter, FlashSlot, LightSlot, makeFlashTexture(), RingSlot, ParticleSpawn, ParticleSystem

### Community 37 - "main.ts"
Cohesion: 0.28
Nodes (5): #app main mount element, body data-mode attribute, WebGL 2 requirement, root, webglAvailable()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 40 - "Ballistics.ts"
Cohesion: 0.31
Nodes (7): isCombatState(), ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like

### Community 41 - "StateMachine.ts"
Cohesion: 0.43
Nodes (6): decideNextState(), engageState(), shouldEvade(), shouldRetreat(), TransitionInput, decide()

### Community 42 - "Terrain"
Cohesion: 0.21
Nodes (12): buildChunk(), crossEdge(), crossings, crossTriangle(), shorelineSegments(), Terrain, generateHeights(), makeRamp() (+4 more)

### Community 43 - "settings.ts"
Cohesion: 0.16
Nodes (23): AI, BASE_GEOMETRY, DIFFICULTY, MapSize, MapSizeSpec, PROJECTILE, SIM_HZ, TANK_SPECS (+15 more)

### Community 44 - "Tank"
Cohesion: 0.05
Nodes (29): Crossing, deckX(), deckZ(), NavPlanner, preference(), travelDirection(), NEIGHBOURS, PathFinder (+21 more)

### Community 45 - "Graphics Mode Application"
Cohesion: 0.24
Nodes (5): QualityLevel, GraphicsModeSpec, CRT_SHADER, QualityPreset, RenderConfig

### Community 46 - "Game"
Cohesion: 0.18
Nodes (3): window.__vt development debug handle, Development summary, Game

### Community 48 - "Bridge.ts"
Cohesion: 0.14
Nodes (24): vitest, bridgePieces(), createBridgeLocal(), DECK_THICKNESS, deckHeightAt(), exitScratch, isOnDeck(), kerbPush() (+16 more)

### Community 49 - "MaterialLibrary"
Cohesion: 0.18
Nodes (3): createEdge(), createSolid(), MaterialLibrary

### Community 51 - "HUD"
Cohesion: 0.12
Nodes (6): GameEvent, css(), HudPresenter, CameraMode, HUD, pad3()

### Community 57 - "WaterGenerator.ts"
Cohesion: 0.08
Nodes (37): mulberry32 seeded RNG, Seeded procedural battlefield, lerp(), smoothstep(), SimplexNoise2D, gradeApproaches(), shoreCap(), carveLake() (+29 more)

### Community 58 - "World.ts"
Cohesion: 0.10
Nodes (22): createProjectileHit(), invQuat, localA, localB, muzzleDir, muzzlePos, ProjectileHit, staticHit (+14 more)

### Community 59 - "MapProjection.ts"
Cohesion: 0.18
Nodes (15): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), BOUNDARY_DASH, NO_DASH (+7 more)

### Community 60 - ".constructor"
Cohesion: 0.19
Nodes (6): browserStorage(), randomSeed(), seedFromUrl(), BestScoreStore, mapSizeLabel(), UiSoundKind

### Community 62 - "aiWater.test.ts"
Cohesion: 0.17
Nodes (8): SIM_DT, FixedStepAccumulator, createPlayerCommand(), BattleLog, riverBattle(), runMissions(), run(), drive()

### Community 67 - "tacticalData.ts"
Cohesion: 0.13
Nodes (16): fitScale(), formatDistance(), gridIndex(), gridLabel(), niceScaleLength(), CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH (+8 more)

### Community 68 - "distanceField.ts"
Cohesion: 0.47
Nodes (3): FAR_DISTANCE, lowerEnvelope(), squaredDistances()

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 313 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `WorldView` to `Collision.ts`, `Random`, `Procedural Tank Geometry`, `Tactical Map View`, `Tactical Unit Symbols`, `combat.test.ts`, `WorldView.ts`, `Enemy AI Test Harness`, `Radar Display`, `Tank.ts`, `.frame`, `WorldGenerator.ts`, `Simulation`, `InputManager`, `EnemyAI.ts`, `waves.test.ts`, `tacticalWater.test.ts`, `BridgePlacer.ts`, `WaterMap`, `Terrain`, `settings.ts`, `Tank`, `Bridge.ts`, `World.ts`, `MapProjection.ts`, `tacticalData.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Procedural Tank Geometry` be split into smaller, more focused modules?**
  _Cohesion score 0.09155844155844156 - nodes in this community are weakly interconnected._
- **Why does `TacticalMap` connect `Tactical Map View` to `tacticalData.ts`, `Tactical Unit Symbols`, `VECTOR TANKS`, `settings.ts`, `Game`, `ContactTracker`, `WorldView`, `Simulation`, `InputManager`, `.constructor`, `MapProjection`, `tacticalWater.test.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.0743321718931475 - nodes in this community are weakly interconnected._
- **Why does `Tank` connect `Tank` to `Random`, `audioMath.ts`, `Tactical Unit Symbols`, `Design principles`, `combat.test.ts`, `WorldView.ts`, `Enemy AI Test Harness`, `Radar Display`, `Tank.ts`, `.frame`, `Simulation`, `InputManager`, `EnemyAI.ts`, `waves.test.ts`, `Enemy Controller`, `Tank View & Tracks`, `settings.ts`, `ContactTracker`, `Bridge.ts`, `MaterialLibrary`, `HUD`, `World.ts`, `MapProjection.ts`, `aiWater.test.ts`, `tacticalData.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `audioMath.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06605222734254992 - nodes in this community are weakly interconnected._