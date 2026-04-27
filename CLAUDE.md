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

## Absolute Principles (IMPORTANT)

프로젝트 전체에 무조건 적용되는 불변(invariant). 위반 시 근본부터 다시 검토할 것.

1. **ISP 3-Layer 분리** — Intent(`HktRule`) → Simulation(`HktCore`) → Presentation(`HktPresentation`). 레이어 역방향 의존 금지.
2. **HktCore 순수성** — `HktCore` 모듈은 UObject/UWorld/UE 런타임 의존 0. 순수 C++ 결정론적 VM 유지.
3. **서버 권위(Server-authoritative)** — 클라이언트는 읽기 전용 `FHktWorldView`만 수신. 모든 상태 변경은 서버 시뮬레이션 결과.
4. **VM은 WorldState 직접 쓰기 금지** — 모든 쓰기는 `FHktVMWorldStateProxy::SetPropertyDirty`를 경유하여 dirty 추적 후 커밋.
5. **`FHktEntityState`는 직렬화 전용 DTO** — HktCore 내부 로직에서 사용 금지. 반드시 SOA `FHktWorldState`를 직접 사용.
6. **컬럼 포인터 호이스팅** — 시스템 벌크 루프에서 `GetColumn()`을 루프 밖에서 캐시. 엔티티별 `GetProperty()`를 루프 안에서 호출 금지.

## Coding Conventions

- **네이밍 prefix**: `FHkt`(struct), `UHkt`(UObject), `IHkt`(interface), `AHkt`(Actor), `SHkt`(Slate), `THkt`(template)
- **PropertyId**: `uint16` in `PropertyId` namespace (`HktCore/Public/HktCoreProperties.h`). 추가 시 `HKT_DEFINE_PROPERTY` 매크로 사용.
- **코드 주석**: 한국어
- **HktInsights 가드**: `WITH_HKT_INSIGHTS` 매크로로 감싸기 — Shipping 빌드에서 비활성화
- **HktVoxelCore LoadingPhase**: `PostConfigInit` 고정 — 렌더 서브시스템 선행 초기화 필수, 변경 금지
