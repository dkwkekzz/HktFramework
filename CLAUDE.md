# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is an Unreal Engine 5.6 plugin framework (`HktFramework`) consisting of three plugins:

| Plugin | Purpose |
|--------|---------|
| `HktGameplay/` | Core gameplay runtime — deterministic simulation engine, networking, UI, VFX, Voxel |
| `HktGameplayGenerator/` | LLM-powered asset generation — MCP server, map/story/VFX/mesh/anim/item/texture generators |
| `HktGameplayDeveloper/` | Developer tooling — runtime debugging panels, automated test suite |

Each plugin has its own `CLAUDE.md` with detailed module-level guidance. Read those first when working within a specific plugin.

## Build Commands

All commands run from the UE project root (`E:\WS\UE5\HktProto`):

```bash
# Generate project files
"C:/Program Files/Epic Games/UE_5.6/Engine/Build/BatchFiles/GenerateProjectFiles.bat" HktProto.uproject

# Build Editor (Development)
"C:/Program Files/Epic Games/UE_5.6/Engine/Build/BatchFiles/RunUAT.bat" BuildCookRun -project=HktProto.uproject -platform=Win64 -clientconfig=Development -build
```

```bash
# MCP Python server (from HktGameplayGenerator/McpServer/)
pip install -e ".[dev]"
python -m hkt_mcp.server   # or: hkt-mcp
pytest                     # run MCP server tests
```

```bash
# Run automation tests (UE5 editor console or CLI)
# Tests are in HktGameplayDeveloper/Source/HktAutomationTests/
# Categories: HktOpcodeTests, HktStoryIntegrityTests, HktStoryScenarioTests, HktStoryJsonParserTests
```

## Architecture: Intent–Simulation–Presentation (ISP)

The framework enforces a strict 3-layer separation:

1. **Intent** (`HktRule`) — game logic decides *what* to do via `IHktServerRuleInterfaces` / `IHktClientRuleInterfaces`
2. **Simulation** (`HktCore`) — pure C++ deterministic VM executes logic and produces the next state
3. **Presentation** (`HktPresentation`) — read-only layer visualizes `FHktWorldView` output in UE5

**Critical constraint**: `HktCore` has zero UObject/UWorld dependency. All writes go through `FHktVMStore` buffered writes; `ApplyStoreSystem` commits atomically per frame.

## Plugin Dependency Graph

```
HktGameplay (runtime)
├── HktCore          — pure C++ SOA simulation VM (no UObject)
├── HktStory         — reusable bytecode snippet library (fluent API)
├── HktRule          — server/client rule interfaces
│   └── HktRuntime   — networking, GGPO rollback sync (30Hz)
├── HktAsset         — GameplayTag → DataAsset async loading
├── HktPresentation  — read-only UE5 visualization (OnWorldViewUpdated)
│   └── HktVFX       — Niagara VFX intent resolver
├── HktUI            — data-driven Slate UI (anchor strategy pattern)
└── HktVoxelCore     [PostConfigInit — loads before Default phase]
    ├── HktVoxelTerrain
    ├── HktVoxelSkin
    └── HktVoxelVFX

HktGameplayGenerator (editor)
├── HktGeneratorCore / HktGeneratorEditor  — prompt panel, subprocess wrapper
├── HktMcpBridge / HktMcpBridgeEditor      — UE5 ↔ MCP bridge subsystems
└── HktMapGenerator, HktStoryGenerator, HktVFXGenerator,
    HktMeshGenerator, HktAnimGenerator, HktItemGenerator, HktTextureGenerator

HktGameplayDeveloper (developer/editor)
├── HktInsights        — Slate debugging panels (VM, WorldState, Runtime, Log)
├── HktInsightsEditor  — dockable editor tabs
└── HktAutomationTests — FHktAutomationTestHarness + test suites
```

## Key Architectural Patterns

### HktCore VM
- **SOA layout**: entity data stored in `FHktDataColumn` arrays indexed by `PropertyId` (defined in `HktCoreProperties.h`). Hoist column pointers outside loops — never call `GetProperty()` per-entity inside bulk iteration.
- **3-tier property storage**: Hot (0–15, O(1) direct index) → Warm (16 fixed pairs per slot) → Overflow (heap `TArray`)
- **Frame pipeline**: `ProcessBatch()` → Arrange → Build VMs → Process VMs → Physics (spatial hash) → Apply Store → Cleanup → CreateWorldView
- **`FHktWorldView`**: zero-copy read-only snapshot with sparse overlays; Overlay checked before WorldState on `GetInt(Entity, PropId)`

### HktRuntime Networking
- Rule/Component/Actor separation: Rule handles flow (interfaces), Component implements interfaces, Actor only publishes events
- Server: `AHktGameMode` → `IHktServerRuleInterfaces`; Client: `AHktInGamePlayerController` → `IHktClientRuleInterfaces`
- `FHktEntityState` is a serialization-only DTO — never use it inside HktCore logic; use SOA WorldState directly

### Generator Pipeline (8 steps)
```
concept_design → feature_design → [parallel Worker Agents per feature]
                                       ├── story_generation
                                       ├── asset_discovery
                                       └── char/item/vfx_generation
concept_design → map_generation  (parallel with feature_design)
```
Steps communicate via `.hkt_steps/{project_id}/{step_type}/output.json`. Skills: `/concept-design`, `/feature-design`, `/map-gen`, `/story-gen`, `/asset-discovery`, `/char-gen`, `/item-gen`, `/vfx-gen`, `/texture-gen`, `/full-pipeline`.

## Coding Conventions

- **Naming prefixes**: `FHkt` (structs), `UHkt` (UObject), `IHkt` (interfaces), `AHkt` (Actors), `SHkt` (Slate widgets), `THkt` (templates)
- **PropertyId constants**: `uint16` in `PropertyId` namespace inside `HktCoreProperties.h`; use `HKT_DEFINE_PROPERTY` macro
- **Code comments**: Korean (한국어)
- **`HktInsights` guard**: wrap with `WITH_HKT_INSIGHTS` macro; disabled in Shipping builds
- **`HktVoxelCore` load phase**: must remain `PostConfigInit` — do not change without understanding render subsystem init order

## Debug Tools

```
# HKT Event Log (ring buffer, 8192 entries)
hkt.EventLog.Start / Stop / Dump / Clear
# Log file: Saved/Logs/HktEventLog.log

# Insights panels (editor Window menu or Tools > Instrumentation)
hkt.insights.clear / categories / dump <Cat>

# Generator Prompt panel
HktGen.Prompt   (UE5 editor console)
```

## MCP Server Environment Variables

| Variable | Description |
|----------|-------------|
| `UE_PROJECT_PATH` | UE project root |
| `HKT_STEPS_DIR` | Step data output (default: `.hkt_steps/`) |
| `HKT_MAPS_DIR` | HktMap JSON files (default: `.hkt_maps/`) |
| `SD_WEBUI_URL` | Stable Diffusion WebUI (default: `http://localhost:7860`) |
| `MONOLITH_URL` | Monolith MCP proxy (default: `http://localhost:9316/mcp`) |
