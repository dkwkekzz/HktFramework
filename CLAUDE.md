# CLAUDE.md

루트 라우터 — 프로젝트 전체에 걸친 절대 원칙과 모듈별 가이드 진입점만 보관한다. 세부 사항은 각 플러그인 CLAUDE.md를 참조할 것.

## Repository

UE5.6 플러그인 프레임워크. 3개의 독립 플러그인으로 구성된다.

| 플러그인 | 역할 | 상세 가이드 |
|---|---|---|
| `HktGameplay/` | 런타임 시뮬레이션, 네트워킹, 프레젠테이션, UI, VFX, Voxel | [HktGameplay/CLAUDE.md](HktGameplay/CLAUDE.md) |
| `HktGameplayGenerator/` | LLM 기반 에셋 자동 생성, MCP 서버 | [HktGameplayGenerator/CLAUDE.md](HktGameplayGenerator/CLAUDE.md) |
| `HktGameplayDeveloper/` | 인사이트 패널, 자동화 테스트 | [HktGameplayDeveloper/CLAUDE.md](HktGameplayDeveloper/CLAUDE.md) |

작업 대상 플러그인을 먼저 식별하고 해당 CLAUDE.md를 읽을 것. 루트는 위 문서들에 중복 기재하지 않는다.

플러그인 외 독립 트랙:
- [HktLedgerWeb/CLAUDE.md](HktLedgerWeb/CLAUDE.md) — 에너지 원장 동기화 MMORPG 웹 프로토타입 (UE 빌드·타 플러그인과 무관).
- [HktFeature/CLAUDE.md](HktFeature/CLAUDE.md) — 오픈월드 MMORPG 규칙을 feature 단위로 정의·시뮬레이션하는 웹 트랙 (원장 엔진 기반, UE 빌드·타 플러그인과 무관).
- [HktSplatGenesis/CLAUDE.md](HktSplatGenesis/CLAUDE.md) — 절차적/창발 3DGS 실험장 (무대=Spark 환경 + 생명=WebGPU 캐릭터 2층 합성; UE 빌드·타 플러그인과 무관).
- [HktSplatLife/CLAUDE.md](HktSplatLife/CLAUDE.md) — HktSplatGenesis 의 **생명(캐릭터=동적)** 자립 분리판 (WebGPU 전용, 무대 없음).
- [HktSplatEnv/CLAUDE.md](HktSplatEnv/CLAUDE.md) — HktSplatGenesis 의 **환경(정적=무대)** 자립 분리판 (Spark WebGL2 전용, 생명 없음).
- [HktCreature/CLAUDE.md](HktCreature/CLAUDE.md) — 오픈월드 MMORPG 용 창발형 3D 크리처를 AI-only 파이프라인으로 만드는 웹 트랙 (스켈레톤은 코드로 짓고 절차 살을 얹어 Mixamo 애니메이션을 그대로 구동; three.js/Vite, UE 빌드·타 플러그인과 무관).

## Coding Conventions

- **네이밍 prefix**: `FHkt`(struct), `UHkt`(UObject), `IHkt`(interface), `AHkt`(Actor), `SHkt`(Slate), `THkt`(template)
- **PropertyId**: `uint16` in `PropertyId` namespace (`HktCore/Public/HktCoreProperties.h`). 추가 시 `HKT_DEFINE_PROPERTY` 매크로 사용.
- **코드 주석**: 한국어
- **HktInsights 가드**: `ENABLE_HKT_INSIGHTS` 매크로로 감싸기 (HktCore Build.cs 가 비-Shipping 에서 자동 정의). 데이터 주입은 `HKT_INSIGHT_COLLECT(Category, Key, Value)` 매크로 — Shipping 에서는 no-op.
- **HktVoxelCore LoadingPhase**: `PostConfigInit` 고정 — 렌더 서브시스템 선행 초기화 필수, 변경 금지
- **로그 카테고리**: `LogTemp` 사용 지양 — 각 모듈 전용 카테고리(`LogHktCore`, `LogHktPresentation`, `LogHktVoxelCore`, …)를 적극 사용. 신규 모듈은 `*Log.h` 에 `DECLARE_LOG_CATEGORY_EXTERN` + 모듈 cpp 에 `DEFINE_LOG_CATEGORY` 패턴을 따른다. 단일 파일 한정이면 `DEFINE_LOG_CATEGORY_STATIC` 허용.
- **하드코딩 지양 / CVar 적극 사용**: 매직 넘버·임계값·토글 플래그는 가급적 `FAutoConsoleVariableRef` 또는 `TAutoConsoleVariable` 로 노출하여 런타임 튜닝/디버깅을 가능케 한다 (`hkt.<Module>.<Knob>` 네이밍). 결정론에 영향을 주는 값(시뮬레이션 상수)은 예외 — `HktSimulationLimits` 등 헤더 상수로 고정.
- **Story 작업 시**: V2 마이그레이션 정합 필수 — [Docs/PR-3-Phase2-Plan.md](Docs/PR-3-Phase2-Plan.md) · [HktGameplay/Content/Stories/SCHEMA.md](HktGameplay/Content/Stories/SCHEMA.md) 선행 숙지.
