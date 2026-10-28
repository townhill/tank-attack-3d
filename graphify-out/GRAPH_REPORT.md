# Graph Report - tank-attack-3d  (2026-10-28)

## Corpus Check
- 87 files · ~87,886 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 1220 nodes · 3614 edges · 46 communities (36 shown, 10 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 401 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `df4f64d5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Menu
- Package And Lint Config
- EnemyAI.ts
- Simulation.ts
- math.ts
- World
- Tank
- TypeScript Compiler Config
- WeaponSystem.ts
- Graphify Usage Rules
- EnemyController
- eventSounds.ts
- TankModel.ts
- audio.test.ts
- audioMath.ts
- TacticalMap
- tacticalTheme.ts
- AudioManager
- combat.test.ts
- Radar
- Game
- mapProjection.test.ts
- InputManager
- Effects
- EnemyKind
- AudioManager.ts
- GraphicsModeSpec
- Renderer
- VECTOR TANKS
- HUD
- synth.ts
- Effects.ts
- MapProjection
- .applySettings
- Radar.ts
- events.ts
- WorldView.ts
- LoopGraph
- Game.ts
- main.ts
- settings.ts
- .gameOver
- WorldView
- ai.test.ts
- tacticalData.ts
- FakeParam

## God Nodes (most connected - your core abstractions)
1. `Tank` - 70 edges
2. `Simulation` - 62 edges
3. `Game` - 51 edges
4. `TacticalMap` - 50 edges
5. `World` - 50 edges
6. `Random` - 47 edges
7. `clamp()` - 44 edges
8. `Terrain` - 34 edges
9. `GraphicsModeSpec` - 32 edges
10. `Obstacle` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Design principles` --references--> `Tank`  [INFERRED]
  README.md → src/entities/Tank.ts
- `Design principles` --references--> `Simulation`  [INFERRED]
  README.md → src/game/Simulation.ts
- `Design principles` --references--> `GameEvent`  [INFERRED]
  README.md → src/game/events.ts
- `projection()` --calls--> `MapProjection`  [EXTRACTED]
  tests/mapProjection.test.ts → src/ui/MapProjection.ts
- `graphify Skill` --conceptually_related_to--> `graphify-out Knowledge Graph`  [INFERRED]
  .claude/CLAUDE.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Scoped Graph Query Tools** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 1.00]
- **Graph-First Codebase Navigation Hierarchy** — claude_query_first_rule, claude_graphify_query, claude_wiki_index, claude_graph_report [INFERRED 0.85]

## Communities (46 total, 10 thin omitted)

### Community 0 - "Menu"
Cohesion: 0.20
Nodes (4): UserSettings, make(), Menu, MenuCallbacks

### Community 1 - "Package And Lint Config"
Cohesion: 0.06
Nodes (35): dependencies, three, description, devDependencies, eslint, @eslint/js, globals, @types/three (+27 more)

### Community 2 - "EnemyAI.ts"
Cohesion: 0.21
Nodes (13): aimDir, leadPoint, muzzleDir, muzzlePos, playerCentre, sightPoint, steering, faceTowards() (+5 more)

### Community 3 - "Simulation.ts"
Cohesion: 0.20
Nodes (13): DIFFICULTY, TANK_SPECS, WAVES, accuracy(), createStats(), formatTime(), GameStats, KeyValueStore (+5 more)

### Community 4 - "math.ts"
Cohesion: 0.06
Nodes (43): NO_CONTROLS, scratchBack, scratchForward, scratchLocal, scratchMatrix, scratchQuat, scratchRight, scratchUp (+35 more)

### Community 5 - "World"
Cohesion: 0.33
Nodes (3): TerrainView, World, TickOptions

### Community 6 - "Tank"
Cohesion: 0.07
Nodes (14): Tank, AimSolver, HudPresenter, createPlayerCommand(), Simulation, CameraMode, PartGeometry, writeTrackSegments() (+6 more)

### Community 7 - "TypeScript Compiler Config"
Cohesion: 0.09
Nodes (21): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+13 more)

### Community 8 - "WeaponSystem.ts"
Cohesion: 0.05
Nodes (58): createProjectileHit(), invQuat, localA, localB, muzzleDir, muzzlePos, ProjectileHit, staticHit (+50 more)

### Community 9 - "Graphify Usage Rules"
Cohesion: 0.21
Nodes (12): /graphify Trigger Command, graphify Skill, Community Structure, God Nodes, graphify-out/graph.json, GRAPH_REPORT.md, graphify explain, graphify-out Knowledge Graph (+4 more)

### Community 11 - "eventSounds.ts"
Cohesion: 0.10
Nodes (37): fireTimbre, steppedGlide(), playDestroyed(), playEventSound(), playFire(), playImpact(), playPlayerDamaged(), Mixer (+29 more)

### Community 12 - "TankModel.ts"
Cohesion: 0.10
Nodes (37): box(), centroid2(), edgePositions(), extrudeProfileX(), flipWinding(), loft(), mergeParts(), polygon() (+29 more)

### Community 13 - "audio.test.ts"
Cohesion: 0.07
Nodes (19): SERVO_THRESHOLD, ALL_EVENTS, enemy(), FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeCompressor (+11 more)

### Community 14 - "audioMath.ts"
Cohesion: 0.12
Nodes (22): chooseVoice(), CRITICAL_HEALTH_INTERVAL, distanceGain(), ENEMY_ENGINE_BASE, engineParams, FIRE_TIMBRES, FREE, listenerUp() (+14 more)

### Community 15 - "TacticalMap"
Cohesion: 0.11
Nodes (3): context2d(), element(), TacticalMap

### Community 16 - "tacticalTheme.ts"
Cohesion: 0.10
Nodes (29): AIM_DASH, BOUNDARY_DASH, MapIntel, NO_DASH, RANGE_DASH, ROW_LABELS, STOPPED_EVENTS, BOUNDARY_DASH (+21 more)

### Community 17 - "AudioManager"
Cohesion: 0.17
Nodes (4): AudioManager, PlayerLoops, getAudioContextCtor(), unlockedManager()

### Community 18 - "combat.test.ts"
Cohesion: 0.11
Nodes (19): ballisticDirection(), leadTarget(), shellPositionAt(), solveElevation(), timeOfFlight(), Vec3Like, applyDamage(), computeDamage() (+11 more)

### Community 19 - "Radar"
Cohesion: 0.15
Nodes (4): Radar, GraphicsModeId, rgba(), tacticalTheme

### Community 20 - "Game"
Cohesion: 0.14
Nodes (3): Development summary, Game, CameraManager

### Community 21 - "mapProjection.test.ts"
Cohesion: 0.22
Nodes (7): fitScale(), formatDistance(), gridColumnLetter(), gridIndex(), gridLabel(), niceScaleLength(), projection()

### Community 22 - "InputManager"
Cohesion: 0.09
Nodes (9): PlayerController, PlayerCommand, applyDeadzone(), GAME_KEYS, GamepadState, InputManager, isEditableTarget(), AimState (+1 more)

### Community 24 - "EnemyKind"
Cohesion: 0.11
Nodes (19): AIContext, TransitionInput, DifficultySpec, EnemyKind, EnemySpawnedEvent, EnemyEntry, aimErrorScale(), maxConcurrentEnemies() (+11 more)

### Community 25 - "AudioManager.ts"
Cohesion: 0.16
Nodes (13): CRITICAL_HEALTH, ENEMY_ENGINE_RANGE, ENEMY_ENGINE_VOICES, enemyEngineParams, selectNearestEnemies(), warningInterval(), EnemyEngines, EnemyVoice (+5 more)

### Community 27 - "Renderer"
Cohesion: 0.12
Nodes (6): QualityLevel, CRT_SHADER, QUALITY_PRESETS, QualityPreset, RenderConfig, Renderer

### Community 28 - "VECTOR TANKS"
Cohesion: 0.11
Nodes (17): Aiming, Architecture, Controls, Design principles, Difficulty, Enemies, Gameplay, Graphics modes (+9 more)

### Community 29 - "HUD"
Cohesion: 0.17
Nodes (4): GameEvent, css(), HUD, pad3()

### Community 30 - "synth.ts"
Cohesion: 0.21
Nodes (11): crushCurve(), MAX_DISTANCE, VoiceSlot, AudioContextCtor, createNoiseBank(), createPanner(), hasPositionParams(), LegacyPositional (+3 more)

### Community 31 - "Effects.ts"
Cohesion: 0.13
Nodes (7): Emitter, FlashSlot, LightSlot, makeFlashTexture(), RingSlot, ParticleSpawn, ParticleSystem

### Community 34 - "Radar.ts"
Cohesion: 0.19
Nodes (15): bearingOf(), clampToRadius(), NICE_STEPS, Point2, rotateToView(), sweepLag(), viewAngle(), BOUNDARY_DASH (+7 more)

### Community 35 - "events.ts"
Cohesion: 0.22
Nodes (13): hitZone, HitSurface, Faction, TankKind, TankSpec, FireEvent, GameOverEvent, ImpactEvent (+5 more)

### Community 36 - "WorldView.ts"
Cohesion: 0.12
Nodes (15): three, createEdge(), createSolid(), EDGE_ROLES, EdgeRole, MaterialLibrary, MaterialOptions, SOLID_ROLES (+7 more)

### Community 38 - "Game.ts"
Cohesion: 0.08
Nodes (26): browserStorage(), DEFAULT_SETTINGS, DIFFICULTIES, GRAPHICS_MODES, GraphicsModeId, MapIntel, pickBoolean(), pickEnum() (+18 more)

### Community 40 - "settings.ts"
Cohesion: 0.21
Nodes (9): vitest, BASE_GEOMETRY, SIM_DT, SIM_HZ, WeaponSpec, WORLD, makeObstacle(), rock() (+1 more)

### Community 43 - "ai.test.ts"
Cohesion: 0.15
Nodes (19): decideNextState(), engageState(), isCombatState(), shouldEvade(), shouldRetreat(), AI, BASE_INPUT, decide() (+11 more)

### Community 44 - "tacticalData.ts"
Cohesion: 0.20
Nodes (7): ContactTracker, CONTOUR_INTERVAL, HeightSamples, LIGHT_LENGTH, sampleHeights(), shadeRelief(), VISUAL_RANGE

## Knowledge Gaps
- **9 isolated node(s):** `@types/three`, `@vitest/coverage-v8`, `eslint`, `typescript`, `vite` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 271 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simulation` connect `Tank` to `Radar.ts`, `Simulation.ts`, `math.ts`, `World`, `Game.ts`, `WorldView.ts`, `WeaponSystem.ts`, `settings.ts`, `tacticalData.ts`, `TacticalMap`, `tacticalTheme.ts`, `Radar`, `Game`, `mapProjection.test.ts`, `Effects`, `EnemyKind`, `VECTOR TANKS`, `HUD`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `@types/three`, `@vitest/coverage-v8`, `eslint` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Package And Lint Config` be split into smaller, more focused modules?**
  _Cohesion score 0.057057057057057055 - nodes in this community are weakly interconnected._
- **Why does `Tank` connect `Tank` to `EnemyAI.ts`, `events.ts`, `math.ts`, `Simulation.ts`, `Game.ts`, `WorldView.ts`, `WeaponSystem.ts`, `Radar.ts`, `EnemyController`, `ai.test.ts`, `tacticalData.ts`, `TacticalMap`, `tacticalTheme.ts`, `combat.test.ts`, `Radar`, `InputManager`, `EnemyKind`, `VECTOR TANKS`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `math.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05879692446856626 - nodes in this community are weakly interconnected._
- **Why does `TacticalMap` connect `TacticalMap` to `MapProjection`, `World`, `Game.ts`, `Tank`, `tacticalTheme.ts`, `Radar`, `Game`, `mapProjection.test.ts`, `InputManager`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Tank` be split into smaller, more focused modules?**
  _Cohesion score 0.06610259122157588 - nodes in this community are weakly interconnected._