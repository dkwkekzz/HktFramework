# CLAUDE.md

HktGameplay 플러그인의 런타임 시뮬레이션 / 네트워킹 / 프레젠테이션 가이드. 프로젝트 전체 원칙은 루트 [../CLAUDE.md](../CLAUDE.md) 참조.

## Module Dependency Graph

```
HktGameplay (Runtime)
├── HktCore             — 순수 C++ SOA 결정론적 VM (UObject 0)
├── HktStory            — 재사용 가능한 바이트코드 스니펫 라이브러리 (fluent API)
├── HktRule             — 서버/클라이언트 룰 인터페이스
│   └── HktRuntime      — 네트워킹, GGPO 롤백 동기화 (30Hz)
├── HktAsset            — GameplayTag → DataAsset 비동기 로딩
├── HktPresentation     — 읽기 전용 UE5 시각화 (OnWorldViewUpdated)
│   └── HktVFX          — Niagara VFX 인텐트 해석 (클라이언트 전용)
├── HktUI               — 데이터 드리븐 Slate UI (anchor strategy 패턴)
├── HktLandscapeTerrain — Landscape 기반 지형 (HktVoxel과 별개 경로)
├── HktSpriteCore       — 스프라이트 렌더링
└── HktVoxelCore        [PostConfigInit — Default 단계보다 선행]
    ├── HktVoxelTerrain — 지형 생성/파괴 (HktRuntime 의존)
    ├── HktVoxelSkin    — 메시 스키닝/베이킹 (Editor에서 UnrealEd 조건부)
    └── HktVoxelVFX     — 파괴 VFX (Niagara 의존)
```

## HktCore — 결정론적 시뮬레이션 엔진

- **SOA 데이터 레이아웃**: 엔티티 데이터를 `PropertyId`로 인덱싱된 컬럼 배열에 저장 (`HktCoreProperties.h`에 정의). 컬럼 포인터 호이스팅으로 캐시 효율적인 벌크 이터레이션.
- **3-tier 프로퍼티 저장소**: Hot(0–15, 직접 인덱스 O(1)) → Warm(슬롯당 16 fixed pairs) → Overflow(heap `TArray`)
- **FHktWorldState**: 완전한 시뮬레이션 스냅샷. 아키타입 기반 엔티티 풀, `EntityToIndex`/`IndexToEntity` 매핑, `FreeIndices` 슬롯 재사용.
- **FHktWorldView**: 제로 카피 읽기 전용 뷰 + 희소 오버레이. Presentation 레이어가 `GetInt(Entity, PropId)`로 읽음 (Overlay → WorldState 순으로 확인).
- **VM 실행**: 바이트코드 프로그램이 `FHktVMRuntime` (R0~R15, 16개 레지스터)에서 실행. 실행 컨텍스트는 `FHktVMContext` (구 `FHktVMStore` 대체); 쓰기는 `FHktVMWorldStateProxy::SetPropertyDirty`를 경유하여 dirty 추적 후 커밋.
- **프레임 파이프라인**: `ProcessBatch()` → Arrange → Build VMs → Process VMs → Physics(공간 해싱) → Apply Dirty → Cleanup → CreateWorldView

## HktRuntime — 네트워킹 레이어

- **서버**: `AHktGameMode` → `IHktServerRuleInterfaces` (InitGame, Tick, PostLogin, Logout, PushIntent)
- **클라이언트**: `AHktInGamePlayerController` → `IHktClientRuleInterfaces` (SubjectAction, SlotAction, TargetAction)
- **FHktEntityState**: 네트워크 직렬화 전용 DTO — HktCore 내부에서는 절대 사용 금지 (SOA WorldState 직접 사용)

## HktStory — 스토리 패턴 라이브러리

재사용 가능한 바이트코드 스니펫. `FHktStoryBuilder&`를 반환하는 플루언트(Fluent) API로 체이닝 가능.

> **신규 코드는 `FHktVar` API 를 사용할 것.** 구 `RegisterIndex` 기반 API (`Reg::Self`, `FHktScopedReg`, `FHktRegAllocator`)는 PR-3 에서 strangler-fig 방식으로 JSON 마이그레이션 예정. PR-2 에서는 빌드 타임 Liveness + Linear-Scan 할당기가 도입되어 anonymous VReg(`B.NewVar()`)에 GP 레지스터(R0..R9)를 자동 배정한다. JSON 도 `{"schema": 2, ...}` 와 VarRef 폼(`{"var":"name"}` / `{"self":true}` / `{"const":N}`)을 지원한다.

- `FHktVar` / `FHktVarBlock` — 신 가상 변수 핸들 (PR-2)
- `FHktScopedReg` — 스크래치 레지스터 자동 관리 (호출자 레지스터 충돌 방지) — *PR-3 에서 제거 예정*
- `HktSnippetItem` — 장비 슬롯 디스패치, 아이템 스탯 적용/제거, 유효성 검사
- `HktSnippetCombat` — 전투 액션 패턴
- `HktSnippetNPC` — NPC 행동 패턴
- `HktStoryJsonLoader` — JSON에서 스토리 정의 로드 (schema 1·2 동시 지원)
- `HktStoryTags` — 엔티티 서브타입·속성·애니메이션 태그 공유 선언

## HktPresentation — 시각화

- `UHktPresentationSubsystem` (LocalPlayerSubsystem)가 `IHktPlayerInteractionInterface::OnWorldViewUpdated`에 바인딩
- diff 처리 순서: Removed → Spawned → Delta, 이후 렌더러에 디스패치
- `FHktEntityPresentation`은 7개 ViewModel 그룹: Transform, Movement, Vitals, Combat, Ownership, Animation, Visualization
- `THktVisualField<T>` — 세대 카운터 기반 더티 트래킹 (프레임 진행 시 자동 클린)
- Processor 디스패치: Unit/Building → `FHktActorProcessor`, Projectile → `FHktMassEntityProcessor` (TODO)

## HktAsset — 태그 기반 에셋 관리

GameplayTag → DataAsset → Widget/VFX 런타임 해석 3단계 파이프라인. HktUI, HktVFX, HktPresentation이 비동기 에셋 로딩에 사용.

## HktUI — 데이터 드리븐 Slate UI

HktPresentation 의존 없음 (인터페이스/델리게이트만 사용).

**앵커 전략 패턴** — 플러거블 포지셔닝:
- `UHktViewportAnchorStrategy` — 고정 스크린 좌표 (로그인, HUD 바)
- `UHktWorldViewAnchorStrategy` — FHktWorldState PosX/Y/Z → `ProjectWorldLocationToScreen` (엔티티 추적)

**데이터 흐름**: GameplayTag → `UHktAssetSubsystem::LoadAssetAsync` → `UHktTagDataAsset` + `IHktUIViewFactory` → `CreateView()` + `CreateStrategy()` → `UHktUIElement`

**HUD 타입**:
- `AHktLoginHUD` — ID/PW 폼, 서버 로그인 RPC, 클라이언트 콜백
- `AHktIngameHUD` — 뷰포트 바 (인벤토리/장비/스킬) + 엔티티별 추적 위젯

**헬퍼 API**: `HktUI::FindComponent<T>()`, `HktUI::SendUserEvent()`, `HktUI::GetFirstLocalPlayerController()`

## HktVFX — VFX 인텐트 해석

클라이언트 전용, 읽기 전용. 게임 로직 없음.

- `FHktVFXIntent` — 프로그래머 정의 VFX 시맨틱 인텐트
- `UHktVFXAssetBank` — VFX 에셋 저장 + Intent → Niagara/텍스처 런타임 해석
- `UHktVFXRuntimeResolver` — 런타임 VFX 스폰 컴포넌트

## HktLandscapeTerrain / HktSpriteCore

- **HktLandscapeTerrain** — UE5 Landscape 기반 지형 시스템 (HktVoxel과 독립적인 대안 경로).
- **HktSpriteCore** — 스프라이트 기반 렌더링 코어. 스프라이트 어셋 자동화는 `HktGameplayGenerator/HktSpriteGenerator` 참조.

## HktVoxel — 복셀 서브시스템 (4모듈)

**HktVoxelCore** (PostConfigInit — 렌더 서브시스템 선행 초기화)는 순수 렌더링만 담당 (게임 로직 없음):
- Greedy Meshing 파이프라인 (복셀 데이터 → GPU 업로드)
- VM 복셀 상태의 읽기 전용 복사본 공간 관리
- 공개 디렉터리: `Data/`, `Meshing/`, `Rendering/`, `LOD/`
- 의존: RenderCore, RHI, Renderer, HktCore

나머지 3모듈은 HktVoxelCore 위에 레이어:
- **HktVoxelTerrain** — 지형 생성/파괴, HktRuntime 의존
- **HktVoxelSkin** — 메시 스키닝/베이킹, Editor 빌드에서 UnrealEd 조건부 의존
- **HktVoxelVFX** — 파괴 VFX, Niagara 의존

## Plugin-Local Constraints

루트 [../CLAUDE.md](../CLAUDE.md)의 절대 원칙에 더해, HktGameplay 작업 시 다음을 추가로 준수한다.

1. **HktVoxelCore PostConfigInit** — 렌더 서브시스템 선행 초기화를 위해 Default보다 먼저 로드. `LoadingPhase` 변경 금지.
2. **HktVoxelSkin Editor 의존성** — Editor 빌드에서만 UnrealEd 조건부 링크. Runtime/Shipping에서 누설 금지.
3. **HktUI ↔ HktPresentation 단방향** — HktUI는 HktPresentation에 의존하지 않음 (인터페이스/델리게이트만 사용).

## Plugin-Local Conventions

루트 [../CLAUDE.md](../CLAUDE.md)의 글로벌 컨벤션(prefix, PropertyId 등) 위에 추가되는 HktGameplay 전용 규약.

- **엔티티 타입**: `HktType` 네임스페이스 — Unit, Projectile, Equipment, Building
- **GameplayTag 시스템**: 이벤트(`FHktEvent::EventTag`), UI 위젯(`Widget.LoginHud` 등), 에셋 해석에 사용

## Key File Locations

| 목적 | 경로 |
|------|------|
| 코어 시뮬레이션 | `Source/HktCore/` |
| VM 인터프리터 | `Source/HktCore/Private/VM/` |
| Property ID | `Source/HktCore/Public/HktCoreProperties.h` |
| 엔티티/이벤트 타입 | `Source/HktCore/Public/HktCoreDefs.h`, `HktCoreEvents.h` |
| World State | `Source/HktCore/Public/HktWorldState.h` |
| 룰 인터페이스 | `Source/HktRule/Public/` |
| Presentation 서브시스템 | `Source/HktPresentation/Public/HktPresentationSubsystem.h` |
| ViewModel | `Source/HktPresentation/Public/HktPresentationViewModels.h` |
| 모듈별 README | `Source/{Module}/README.md` |
| MCP 서버 (Python) | `../HktGameplayGenerator/McpServer/src/hkt_mcp/` |

## Debug: HKT Event Log

런타임 디버깅을 위한 이벤트 로그 시스템. `HKT_EVENT_LOG` 매크로로 기록된 로그를 링 버퍼(8192개)에 보관하고, 파일로 덤프하여 분석할 수 있다.

- **로그 파일**: `Saved/Logs/HktEventLog.log`
- **콘솔 명령**: `hkt.EventLog.Start` / `hkt.EventLog.Stop` / `hkt.EventLog.Dump` / `hkt.EventLog.Clear`
- **AI 디버깅 스킬**: `/debug-logs <증상>` — 로그 파일을 읽고 원인 분석
