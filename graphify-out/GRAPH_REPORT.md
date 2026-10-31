# Graph Report - tank-attack-3d  (2026-10-31)

## Corpus Check
- 137 files · ~219,364 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1784 nodes · 5642 edges · 63 communities (53 shown, 10 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 564 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `09016be3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Collision.ts
- lakeReflection.test.ts
- Synth Sound Effects
- bridgeDetail.ts
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
- Enemy AI Test Harness
- Radar Display
- math.ts
- .frame
- Visual Effects Bursts
- WorldGenerator.ts
- TypeScript Config
- Simulation
- Renderer
- aiming.test.ts
- .applySettings
- waves.test.ts
- Random
- tacticalWater.test.ts
- Enemy Controller
- waterFixtures.ts
- Audio Loop Graph
- World
- Gameplay
- main.ts
- Graphify Project Rules
- Tank View & Tracks
- combat.test.ts
- Enemy AI state machine
- BridgePlacer.ts
- NavGrid
- Graphics Mode Application
- Game
- .drawGhost
- makeRiverWorld
- MaterialLibrary
- Fake Audio Params
- .startNewGame
- Favicon Vector Icon
- Root CLAUDE.md
- Local .claude CLAUDE.md
- SegmentList
- Terrain
- Obstacle
- .constructor
- WorldView.ts
- Tank
- tacticalData.ts
- AutoQuality.ts
- Crosshair raycast with ballistic gun laying

## God Nodes (most connected - your core abstractions)
1. `World` - 95 edges
2. `Tank` - 93 edges
3. `Simulation` - 76 edges
4. `Terrain` - 64 edges
5. `clamp()` - 61 edges
6. `Random` - 57 edges
7. `Game` - 56 edges
8. `TacticalMap` - 51 edges
9. `vitest` - 41 edges
10. `Obstacle` - 37 edges

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

## Communities (63 total, 10 thin omitted)

### Community 0 - "Collision.ts"
Cohesion: 0.14
Nodes (32): exitScratch, isOnDeck(), kerbPush(), parapetPush(), pointInsideBridge(), segmentVsBridge(), belowTerrain(), circleVsObstacle() (+24 more)

### Community 1 - "lakeReflection.test.ts"
Cohesion: 0.21
Nodes (5): REFLECT_SCALE, FakeRenderer, LAKE, pass(), setup()

### Community 2 - "Synth Sound Effects"
Cohesion: 0.21
Nodes (36): fireTimbre, steppedGlide(), impactRecipeFor(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged() (+28 more)

### Community 3 - "bridgeDetail.ts"
Cohesion: 0.09
Nodes (40): addCentreline(), addLamps(), addRailings(), addStiffeners(), addStringers(), addTrusses(), bridgeDetailSegments(), BridgeStyle (+32 more)

### Community 4 - "Audio Test Fakes"
Cohesion: 0.07
Nodes (18): ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor, FakeGain (+10 more)

### Community 5 - "audioMath.ts"
Cohesion: 0.07
Nodes (46): chooseVoice(), CRITICAL_HEALTH, CRITICAL_HEALTH_INTERVAL, crushCurve(), ENEMY_ENGINE_BASE, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams (+38 more)

### Community 6 - "Package & Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 7 - "Tactical Map View"
Cohesion: 0.09
Nodes (4): context2d(), element(), TacticalMap, drawWreck()

### Community 8 - "Tactical Unit Symbols"
Cohesion: 0.07
Nodes (41): BOUNDARY_DASH, NO_DASH, RadarOrientation, RING_FRACTIONS, AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH (+33 more)

### Community 9 - "VECTOR TANKS"
Cohesion: 0.15
Nodes (11): 3D Tanks (1989 Acorn Archimedes), Battlezone (1980 arcade), Controls, Installation and commands, Known limitations, Possible future improvements, Prerequisites, Synthesised Web Audio (+3 more)

### Community 10 - "worldLoader.test.ts"
Cohesion: 0.08
Nodes (20): MapSize, generateWorld(), worldOptionsFor(), browserWorldWorker(), finishHere(), generateHere(), Job, WorldLoader (+12 more)

### Community 11 - "Voice"
Cohesion: 0.12
Nodes (5): distanceGain(), VoiceSlot, createPanner(), Voice, VoicePool

### Community 12 - "Graphics modes"
Cohesion: 0.25
Nodes (9): body data-mode attribute, Classic Vector graphics mode, Graphics modes, How hidden-line removal works, Hybrid 3D graphics mode, Modern Neon Vector graphics mode (default), Performance overlay, Quality (+1 more)

### Community 13 - "Audio Manager & Mixer"
Cohesion: 0.16
Nodes (4): AudioManager, PlayerLoops, Mixer, unlockedManager()

### Community 14 - "Game.ts"
Cohesion: 0.12
Nodes (23): browserStorage(), DIFFICULTIES, GRAPHICS_MODES, GraphicsModeId, MAP_SIZE_IDS, MapIntel, pickBoolean(), pickEnum() (+15 more)

### Community 15 - "lakeMirror.ts"
Cohesion: 0.11
Nodes (16): ahead, clip, CLIP_TO_TEXTURE, corner, eye, lakeReach(), lakeVertexIds(), MIN_EYE_HEIGHT (+8 more)

### Community 16 - "Menu"
Cohesion: 0.18
Nodes (5): UserSettings, difficultyBlurb(), make(), Menu, MenuCallbacks

### Community 17 - "WorldView.ts"
Cohesion: 0.11
Nodes (9): BridgeView, FordView, mergeParts(), LakeReflection, ObstacleView, Sky, TerrainView, createEnvironmentScene() (+1 more)

### Community 18 - "Enemy AI Test Harness"
Cohesion: 0.06
Nodes (48): Gaussian aim error, AIContext, aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint (+40 more)

### Community 19 - "Radar Display"
Cohesion: 0.15
Nodes (9): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), viewAngle(), Radar (+1 more)

### Community 20 - "math.ts"
Cohesion: 0.08
Nodes (41): NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight, scratchUp (+33 more)

### Community 23 - "WorldGenerator.ts"
Cohesion: 0.13
Nodes (20): mulberry32 seeded RNG, Seeded procedural battlefield, MAP_SIZES, WORLD, createBridgeLocal(), boundRadiusOf(), ObstacleShape, STOREY_HEIGHT (+12 more)

### Community 24 - "TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 25 - "Simulation"
Cohesion: 0.07
Nodes (17): Architecture, Design principles, Per-tick GameEvent list, Three.js, vitest, SIM_DT, FixedStepAccumulator, GameStats (+9 more)

### Community 27 - "aiming.test.ts"
Cohesion: 0.08
Nodes (10): PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget(), AimState (+2 more)

### Community 29 - "waves.test.ts"
Cohesion: 0.12
Nodes (22): BASE_GEOMETRY, DIFFICULTY, EnemyKind, MapSizeSpec, SIM_HZ, TANK_SPECS, WAVES, WeaponSpec (+14 more)

### Community 30 - "Random"
Cohesion: 0.07
Nodes (43): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), polygon(), prismAlongZ() (+35 more)

### Community 31 - "tacticalWater.test.ts"
Cohesion: 0.15
Nodes (17): drawBridgeSymbol(), drawFordSymbol(), drawMapBridges(), drawMapFords(), FORD_BANK_REACH, fordSignAngle(), ShorelineIndex, PARAPET_THICKNESS (+9 more)

### Community 32 - "Enemy Controller"
Cohesion: 0.17
Nodes (4): EnemyController, Waypoint, AIState, EnemyEntry

### Community 33 - "waterFixtures.ts"
Cohesion: 0.12
Nodes (26): FORD_BRIDGE_CLEARANCE, FORD_DEPTH, FORD_HALF_LENGTH, FORD_TAPER, fordSite(), placeFords(), sampleAt(), BRIDGE_LINK_OFFSET (+18 more)

### Community 35 - "World"
Cohesion: 0.08
Nodes (28): WATER, Bridge, BridgeLocal, toBridgeLocal(), PushResult, segmentVsWater(), DistanceField, lowerEnvelope() (+20 more)

### Community 36 - "Gameplay"
Cohesion: 0.25
Nodes (9): Compact radar, Difficulty, Easy / Normal / Hard difficulty levels, Enemies, Enemy perception (line of sight, hearing, reaction delay), Gameplay, HUD, radar and tactical map, Tactical map (+1 more)

### Community 37 - "main.ts"
Cohesion: 0.32
Nodes (4): #app main mount element, WebGL 2 requirement, root, webglAvailable()

### Community 38 - "Graphify Project Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 39 - "Tank View & Tracks"
Cohesion: 0.16
Nodes (7): TankKind, PartGeometry, TRACK_SEGMENT_COUNT, writeTrackSegments(), PartObjects, TankView, WHITE

### Community 40 - "combat.test.ts"
Cohesion: 0.08
Nodes (37): applyDamage(), computeDamage(), Damageable, DamageInput, hitZone, zoneMultiplier(), createProjectileHit(), fireWeapon() (+29 more)

### Community 41 - "Enemy AI state machine"
Cohesion: 0.40
Nodes (5): Directional damage zones and armour, Heavy enemy tank, Scout enemy tank, Standard enemy tank, Escalating enemy waves

### Community 42 - "BridgePlacer.ts"
Cohesion: 0.16
Nodes (18): BRIDGE, BANK_LINES, bankDistance(), buildBridge(), Crossing, placeBridges(), planCrossing(), planRamp() (+10 more)

### Community 44 - "NavGrid"
Cohesion: 0.06
Nodes (21): Crossing, deckX(), deckZ(), farEnd(), NavPlanner, preference(), travelDirection(), NEIGHBOURS (+13 more)

### Community 46 - "Game"
Cohesion: 0.15
Nodes (3): window.__vt development debug handle, Development summary, Game

### Community 47 - ".drawGhost"
Cohesion: 0.24
Nodes (3): MapProjection, Contact, unitColor()

### Community 48 - "makeRiverWorld"
Cohesion: 0.27
Nodes (7): bridgeApproach(), fordApproach(), nearest(), Placement, withFords(), makeRiverWorld(), riverSim()

### Community 49 - "MaterialLibrary"
Cohesion: 0.15
Nodes (4): makeFlashTexture(), createEdge(), createSolid(), MaterialLibrary

### Community 51 - ".startNewGame"
Cohesion: 0.14
Nodes (4): GameEvent, HudPresenter, HUD, pad3()

### Community 56 - "SegmentList"
Cohesion: 0.27
Nodes (7): BANK_SIDES, FORD_ENDS, FORD_MARKER_HEIGHT, FORD_MARKER_SETBACK, fordMarkerSegments(), ford, world

### Community 57 - "Terrain"
Cohesion: 0.07
Nodes (45): buildChunk(), lerp(), smoothstep(), SimplexNoise2D, gradeApproaches(), shoreCap(), raiseBed(), Terrain (+37 more)

### Community 58 - "Obstacle"
Cohesion: 0.36
Nodes (3): bridgeBoundRadius(), Obstacle, ObstacleGrid

### Community 60 - ".constructor"
Cohesion: 0.11
Nodes (9): DEFAULT_SETTINGS, SettingsStore, randomSeed(), seedFromUrl(), BestScoreStore, KeyValueStore, mapSizeLabel(), MemoryStore (+1 more)

### Community 63 - "WorldView.ts"
Cohesion: 0.10
Nodes (24): three, QUALITY_LEVELS, QualityLevel, Emitter, FlashSlot, LightSlot, RingSlot, ReflectionUniforms (+16 more)

### Community 66 - "Tank"
Cohesion: 0.14
Nodes (11): ProjectileHit, Tank, AimSolver, hashSeed(), HeightField, placeTank(), addEnemy(), makeTank() (+3 more)

### Community 67 - "tacticalData.ts"
Cohesion: 0.10
Nodes (19): fitScale(), formatDistance(), gridColumnLetter(), gridIndex(), gridLabel(), niceScaleLength(), mapSizeBlurb(), ContactTracker (+11 more)

### Community 68 - "AutoQuality.ts"
Cohesion: 0.33
Nodes (5): AutoQuality, QualityStep, SLOW_FPS, SLOW_SECONDS, run()

### Community 69 - "Crosshair raycast with ballistic gun laying"
Cohesion: 0.67
Nodes (3): Aiming, Gunner / chase / tactical cameras, Gun marker (actual barrel aim indicator)

## Knowledge Gaps
- **15 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 363 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Collision.ts`, `bridgeDetail.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `worldLoader.test.ts`, `Game.ts`, `WorldView.ts`, `Enemy AI Test Harness`, `Radar Display`, `math.ts`, `.frame`, `WorldGenerator.ts`, `Simulation`, `aiming.test.ts`, `waves.test.ts`, `Random`, `tacticalWater.test.ts`, `waterFixtures.ts`, `combat.test.ts`, `NavGrid`, `Game`, `makeRiverWorld`, `SegmentList`, `Terrain`, `Obstacle`, `WorldView.ts`, `Tank`, `tacticalData.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Collision.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14102564102564102 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Simulation` to `Collision.ts`, `lakeReflection.test.ts`, `bridgeDetail.ts`, `Audio Test Fakes`, `Package & Lint Config`, `worldLoader.test.ts`, `lakeMirror.ts`, `Enemy AI Test Harness`, `Radar Display`, `math.ts`, `WorldGenerator.ts`, `aiming.test.ts`, `waves.test.ts`, `Random`, `tacticalWater.test.ts`, `waterFixtures.ts`, `World`, `combat.test.ts`, `BridgePlacer.ts`, `NavGrid`, `makeRiverWorld`, `SegmentList`, `.constructor`, `WorldView.ts`, `tacticalData.ts`, `AutoQuality.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `bridgeDetail.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09397163120567376 - nodes in this community are weakly interconnected._
- **Why does `clamp()` connect `audioMath.ts` to `Enemy Controller`, `waterFixtures.ts`, `Synth Sound Effects`, `Tank`, `tacticalData.ts`, `Tactical Map View`, `Tactical Unit Symbols`, `BridgePlacer.ts`, `Voice`, `Audio Manager & Mixer`, `.drawGhost`, `Enemy AI Test Harness`, `Radar Display`, `math.ts`, `.frame`, `Terrain`, `aiming.test.ts`, `tacticalWater.test.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `Audio Test Fakes` be split into smaller, more focused modules?**
  _Cohesion score 0.0743321718931475 - nodes in this community are weakly interconnected._