# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

LLM 기반 UE5 게임플레이 어셋 자동 생성 시스템. MCP(Model Context Protocol)를 통해 언리얼 에디터와 통신하며, 어셋들을 생성한다.

두 개의 독립 컴포넌트로 구성된다:
- **Python MCP 서버** (`McpServer/`) — LLM 클라이언트 ↔ UE5 에디터 브릿지
- **C++ UE5 플러그인** (`Source/`) — 에디터 UI, 어셋 빌더, 런타임 서브시스템

## 빌드 및 실행

```bash
# MCP 서버 설치/실행 (McpServer/ 에서)
pip install -e ".[dev]"
python -m hkt_mcp.server   # 또는: hkt-mcp
pytest
```

UE5 에디터 콘솔: `HktGen.Prompt` — Generator Prompt 패널 열기

UE5 어셋 출력 경로: Project Settings > HktGameplay > HktAsset > `ConventionRootDirectory` (기본: `/Game/Generated`)

### MCP Server Environment Variables

| 변수 | 설명 |
|---|---|
| `UE_PROJECT_PATH` | UE 프로젝트 루트 |
| `HKT_STEPS_DIR` | 스텝 데이터 출력 경로 (default: `.hkt_steps/`) |
| `HKT_MAPS_DIR` | HktMap JSON 파일 위치 (default: `.hkt_maps/`) |
| `SD_WEBUI_URL` | Stable Diffusion WebUI (default: `http://localhost:7860`) |
| `MONOLITH_URL` | Monolith MCP 프록시 (default: `http://localhost:9316/mcp`) |

## 스텝 시스템 상세

### Feature 시스템

- **Pipeline feature**: concept_design에서 feature_outlines로 도출, feature_design에서 상세화
- **Manual feature**: 개별 탭에서 직접 생성 시 ad-hoc feature 자동 등록 (`manual-{type}-{timestamp}`)
- **Per-feature work.json**: `.hkt_steps/{project_id}/features/{feature_id}/work.json` — Worker 간 충돌 방지
- **Manifest 추적**: `FeatureStatus`로 feature별 진행 상황 (stories/assets 완료 수) 추적
- 스텝 간 데이터: `.hkt_steps/{project_id}/{step_type}/output.json`
- 스텝 실패 시 `step_fail` 도구로 에러 기록

### Generator Pipeline (8 steps)
```
concept_design → feature_design → [parallel Worker Agents per feature]
                                       ├── story_generation
                                       ├── asset_discovery
                                       └── char/item/vfx_generation
concept_design → map_generation  (parallel with feature_design)
```
Steps communicate via `.hkt_steps/{project_id}/{step_type}/output.json`. Skills: `/concept-design`, `/feature-design`, `/map-gen`, `/story-gen`, `/asset-discovery`, `/char-gen`, `/item-gen`, `/vfx-gen`, `/texture-gen`, `/full-pipeline`.

## Python MCP 서버 아키텍처

```
hkt_mcp/
├── server.py          # 진입점, 50+ MCP 도구 등록
├── config.py          # 환경변수 기반 McpConfig
├── sd_client.py       # Stable Diffusion WebUI 클라이언트
├── bridge/
│   ├── editor_bridge.py     # Remote Control API → UE5 에디터
│   ├── runtime_bridge.py    # WebSocket → 런타임 게임 인스턴스
│   └── monolith_client.py   # HTTP 프록시 (localhost:9316), 도구 동적 병합
├── steps/
│   ├── models.py      # StepType enum, 각 스텝 입출력 JSON 스키마
│   └── store.py       # 파일 기반 스텝 스토어 (.hkt_steps/)
└── tools/             # 도구별 구현 (asset/level/vfx/story/texture/map/step 등)
```

**통신 흐름**: LLM 클라이언트 → JSON-RPC(stdio) → Python MCP 서버 → Remote Control API / WebSocket → UE5

`monolith_client.py`는 별도 Monolith MCP 프록시 서버에서 도구를 동적으로 가져와 병합한다. 연결 실패 시 무시.

## C++ 플러그인 아키텍처

### 모듈 목록

| 모듈 | 타입 | 역할 |
|---|---|---|
| `HktGeneratorCore` | Runtime | Tag 해석, ConventionPath, `UHktGeneratorRouter` |
| `HktGeneratorEditor` | Editor | Generator Prompt 패널 UI, `FHktClaudeProcess` subprocess 래퍼 |
| `HktMcpBridge` | Runtime | `UHktMcpBridgeSubsystem` (최소 런타임) |
| `HktMcpBridgeEditor` | Editor | `UHktMcpEditorSubsystem`, `UHktMcpFunctionLibrary` |
| `HktMapGenerator` | Editor | HktMap JSON 파싱, Landscape/Spawner/Region 빌드 |
| `HktStoryGenerator` | Editor | Story JSON → HktCore 바이트코드 컴파일 |
| `HktVFXGenerator` | Editor | `FHktVFXNiagaraBuilder` — Config JSON → Niagara 시스템 빌드 |
| `HktMeshGenerator` | Editor | `FHktShapeGenerator`, `FHktShapeFactory` |
| `HktAnimGenerator` | Editor | 애니메이션 생성 서브시스템 |
| `HktItemGenerator` | Editor | 아이템 Mesh + 아이콘 생성 |
| `HktTextureGenerator` | Editor | `FHktTextureIntent` → SD WebUI 텍스처 |
| `HktSpriteGenerator` | Editor (PostEngineInit) | 스프라이트 어셋 자동 생성 (HktSpriteCore와 페어) |

### Generator Handler 패턴

`UHktGeneratorRouter`가 Tag prefix를 보고 적절한 `IHktGeneratorHandler`로 디스패치:
- `VFX.*` → VFX Generator
- `Entity.Character.*` → Mesh/Anim Generator
- `Entity.Item.*` → Item Generator

에셋 누락 시 (`HandleTagMiss`) Generator가 어셋을 빌드한 뒤 `UHktTagDataAsset` 파생 클래스도 함께 생성하여 런타임에서 발견 가능하게 함.

### Generator Prompt 패널

`FHktClaudeProcess`가 `claude --print --output-format stream-json`을 subprocess로 실행:
- SKILL.md → `--system-prompt` 인수
- Intent JSON → user prompt
- Refine 시 이전 결과 + 피드백 포함하여 재실행

## Tag 시스템과 Convention Path

### Convention Path (Generator 출력 경로)
Generator가 에셋 생성 시 경로 결정. 런타임 로딩에는 사용하지 않음.

| Tag 패턴 | Generator 출력 경로 패턴 |
|---|---|
| `Entity.Character.{Name}` | `{Root}/Characters/{Name}/BP_{Name}` |
| `Entity.Item.{Cat}.{Sub}` | `{Root}/Items/{Cat}/SM_{Sub}` |
| `VFX.Niagara.{Name}` | `{Root}/VFX/NS_{Name}` |
| `VFX.{Event}.{Element}` | `{Root}/VFX/NS_VFX_{Event}_{Element}` |
| `Anim.{Layer}.{Type}.{Name}` | `{Root}/Animations/Anim_{Layer}_{Type}_{Name}` |

### 런타임 에셋 로딩
- `UHktActorVisualDataAsset` — ActorClass 참조 (캐릭터/엔티티)
- `UHktVFXVisualDataAsset` — NiagaraSystem 하드 참조 (DataAsset 비동기 로드 시 함께 로드)
- `UHktAssetSubsystem::LoadAssetAsync()` 로 비동기 로드

## HktMap

JSON 기반 맵 정의 (UMap 아님). 런타임 동적 로드/언로드 가능. Landscape, Region, Spawner, Story 참조, Props로 구성. 파일 위치: `.hkt_maps/`
