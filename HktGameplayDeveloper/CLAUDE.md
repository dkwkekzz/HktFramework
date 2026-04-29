# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plugin Overview

**HktGameplayDeveloper** is a developer tools plugin for HktProto. It provides runtime debugging panels, editor tab integration, and automated test infrastructure for the HktGameplay simulation engine. All functionality is conditionally compiled — guarded by `ENABLE_HKT_INSIGHTS` / `WITH_HKT_INSIGHTS` and absent in Shipping builds.

Depends on: `HktGameplay` plugin (HktCore, HktStory, HktRuntime modules).

## Modules

### HktInsights (Runtime/DeveloperTool)
Real-time debugging data collection and Slate panel widgets. Reads from `FHktCoreDataCollector` (singleton in HktCore) and `FHktCoreEventLog` (ring buffer).

Five Slate panels:
- `SHktVMStatePanel` — 3-pane VM inspector (entity list → VM list → register detail)
- `SHktWorldStatePanel` — Entity property viewer with Hot/Cold tier organization
- `SHktRuntimeInsightsPanel` — Tabbed runtime data (Server / Client / ProxySimulator)
- `SHktGameplayLogPanel` — Chronological event log with hierarchical GameplayTag filter tree
- `SHktInsightTable` — Reusable generic Key|Value table widget

**Console commands:**
```
hkt.insights.clear          클리어 모든 수집 데이터
hkt.insights.categories     카테고리 목록 출력
hkt.insights.dump <Cat>     카테고리 데이터 덤프
```

### HktInsightsEditor (Editor)
Registers four nomad dockable tabs in the UE5 editor: **HKT VM State**, **HKT Runtime**, **HKT World State**, **HKT Gameplay Log**. Accessible via `Window` menu and `Tools > Instrumentation`. Tabs wrap the Slate panels from HktInsights.

### HktAutomationTests (DeveloperTool)
Automated VM and story test suite. Uses `FHktAutomationTestHarness` — a self-contained mini-runtime that holds `FHktWorldState`, `FHktVMWorldStateProxy`, `FHktVMInterpreter`, `FHktVMRuntime`, and `FHktVMContext`.

**Test categories:**
- `HktOpcodeTests` — VM instruction validation (ControlFlow, Data, Entity, Composite)
- `HktStoryIntegrityTests` — Program structure, register flow, precondition enforcement
- `HktStoryScenarioTests` — End-to-end story execution via harness
- `HktStoryJsonParserTests` — JSON schema and Story builder fluent API

## Agent 테스트 자동화

`Tools/` — 헤드리스 Automation 러너 + `/test-fix` 슬래시 커맨드. 상세: [Tools/README.md](Tools/README.md)
