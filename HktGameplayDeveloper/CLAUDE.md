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

## Agent 자동 수정 루프

AI Agent (Claude Code) 가 코드 수정 후 자동으로 테스트를 실행하고
실패 시 다시 수정하는 사이클을 위한 도구.

### 구성

| 파일 | 역할 |
|---|---|
| `Tools/run_automation_tests.py` | UnrealEditor-Cmd 를 헤드리스로 띄워 Automation 테스트 실행 → JSON 리포트 파싱 → 구조화된 결과를 stdout 으로 출력 |
| `Tools/.hkt-test.env.example` | 환경 설정 예제 (엔진/프로젝트 경로). 복사해서 `.hkt-test.env` 로 사용 |
| `.claude/commands/test-fix.md` | `/test-fix [filter] [max_iters]` — 실행 → 실패 분석 → 수정 → 재실행 루프 |

### 사용

```bash
# 1. 일회성 설정 (한 번만)
cp HktGameplayDeveloper/Tools/.hkt-test.env.example \
   HktGameplayDeveloper/Tools/.hkt-test.env
# .hkt-test.env 안의 UE_ENGINE_PATH, UE_PROJECT_FILE 두 줄 채우기

# 2-A. CLI 단독 실행 (사람용)
python HktGameplayDeveloper/Tools/run_automation_tests.py --filter HktCore.Story
# 종료 코드: 0 = all pass, 1 = some failed, 2 = run error

# 2-B. 에이전트 루프 (Claude Code 안에서)
/test-fix HktCore.Story 5
```

### 출력 구조 (stdout JSON)

```jsonc
{
  "success": false,
  "total": 47, "passed": 45, "failed": 2, "skipped": 0,
  "duration_seconds": 12.34,
  "filter": "HktCore.Story",
  "failures": [
    {
      "test_name": "FHktStoryV2_MoveStop_Equivalent",
      "full_test_path": "HktCore.Story.V2.MoveStop.Equivalent",
      "errors": ["Expected MoveForce=0 got 12.5"],
      "warnings": [],
      "duration_ms": 18.2
    }
  ],
  "raw_report_path": "/tmp/hkt-automation-XXXX",
  "stderr_tail": "..."
}
```

이 형식은 LLM 에이전트가 `failures[].errors` 만으로 수정 위치를
바로 추적할 수 있도록 설계되었다 (UE 로그 전체 파싱 불필요).
