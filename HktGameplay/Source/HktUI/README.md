# HktUI 모듈

## 개요

HktUI는 HktGameplay 플러그인의 UI 모듈입니다. HktPresentation과 완전히 분리된 데이터 기반, 태그 기반 Slate UI 프레임워크를 제공합니다.

- **HktPresentation 의존성 없음** - 델리게이트와 인터페이스만을 통한 통신
- **데이터 기반 위젯 생성** - GameplayTag -> DataAsset -> Slate 위젯 파이프라인
- **비동기 에셋 로딩** - HktAssetSubsystem 태그 시스템을 통한 위젯 로딩
- **전략 패턴 포지셔닝** - 뷰포트 고정 및 월드 투영 UI를 위한 플러그 가능한 앵커 전략

## 아키텍처

```
GameMode (HUDClass)
  |
  v
AHktHUD (base)                  <- LoadAndCreateWidget(Tag, Callback)
  |-- AHktLoginHUD              <- 로그인 화면
  |-- AHktIngameHUD             <- 인게임 뷰포트 + 엔티티 HUD
  |
  v
UHktUISubsystem (LocalPlayerSubsystem)
  |-- RootElement (UHktUIElement tree)
  |-- EntityUIMap (EntityId -> UHktUIElement)
  |-- SConstraintCanvas (메인 뷰포트 캔버스)
  |
  v  Tick
  |-- TickAllElements()         <- Strategy -> 화면 위치
  |-- UpdateCanvasSlots()       <- 슬롯 오프셋 + 가시성
```

### 데이터 흐름

```
GameplayTag (Widget.LoginHud)
  |  HktAssetSubsystem::LoadAssetAsync
  v
UHktTagDataAsset + IHktUIViewFactory (예: UHktWidgetLoginHudDataAsset)
  |  CreateView()  ->  TSharedPtr<IHktUIView>  (SWidget를 래핑하는 FHktSlateView)
  |  CreateStrategy()  ->  UHktUIAnchorStrategy
  v
UHktUIElement
  |  View + Strategy + CanvasSlot
  v
SConstraintCanvas slot (Strategy에 의해 매 프레임마다 위치 지정)
```

## HUD 타입

### AHktLoginHUD

로그인 화면 HUD. 로그인 맵의 GameMode에서 `HUDClass`로 설정합니다.

- 마우스 커서와 함께 UI 전용 입력 모드 설정
- PlayerController에 `UHktLoginComponent`가 없으면 연결
- `Widget.LoginHud` 태그 로드 -> `SHktLoginHudWidget`
- 로그인 흐름: ID/PW 입력 -> `UHktLoginComponent::Server_RequestLogin` -> 서버 검증 -> `Client_ReceiveLoginResult` -> `OnLoginSuccess` -> GameInstance에 저장 -> `OpenLevelBySoftObjectPtr`

### AHktIngameHUD

뷰포트 UI와 엔티티별 월드 HUD를 모두 관리하는 인게임 HUD. 인게임 맵의 GameMode에서 `HUDClass`로 설정합니다.

**뷰포트 UI:**
- `Widget.IngameHud` 태그 로드 -> `SHktIngameHudWidget`
- 인벤토리 / 장비 / 스킬 토글 버튼이 있는 하단 바
- 각 버튼은 샘플 데이터가 있는 패널을 엽니다

**엔티티 UI:**
- `IHktPlayerInteractionInterface::GetWorldState(OutState)`로 `FHktWorldState` 포인터 조회
- `OnWorldViewUpdated` 델리게이트 구독 후 `RefreshWorldState()` → `SyncEntityElements()` / `UpdateEntityProperties()` 호출
- `SyncEntityElements()`: 엔티티별로 `SHktEntityHudWidget` 생성/제거 (`FHktWorldState::ForEachEntity`, `IsValidEntity`)
- `UpdateEntityProperties()`: `FHktWorldState::GetProperty`로 Health, OwnedPlayerUid, Team 갱신
- `UHktWorldViewAnchorStrategy`: `FHktWorldState`에서 PosX/Y/Z 읽기 → `ProjectWorldLocationToScreen`

## 앵커 전략

| 전략 | 사용 사례 | 위치 소스 |
|------|----------|-----------|
| `UHktViewportAnchorStrategy` | 로그인, 인게임 뷰포트 | 고정 화면 좌표 (기본값 0,0) |
| `UHktWorldViewAnchorStrategy` | 엔티티 HUD | FHktWorldState PosX/Y/Z -> 월드 투 화면 투영 |

## 주요 클래스

| 클래스 | 역할 |
|-------|------|
| `AHktHUD` | 기본 HUD - 비동기 위젯 로딩, UISubsystem 바인딩 |
| `AHktLoginHUD` | 로그인 화면 HUD 서브클래스 |
| `AHktIngameHUD` | 엔티티 추적 기능이 있는 인게임 HUD 서브클래스 |
| `UHktUISubsystem` | LocalPlayerSubsystem - 엘리먼트 트리, 캔버스 관리, 틱 |
| `UHktUIElement` | UI 엘리먼트 노드 - View + Strategy + 계층 구조 + 캔버스 슬롯 |
| `IHktUIView` / `FHktSlateView` | Slate 위젯 래퍼 인터페이스 |
| `UHktUIAnchorStrategy` | 추상 화면 위치 계산기 |
| `IHktUIViewFactory` | `CreateView()` / `CreateStrategy()`를 정의하는 인터페이스 (UHktTagDataAsset 구현체와 함께 사용) |

## Slate 위젯

| 위젯 | 설명 |
|------|------|
| `SHktLoginHudWidget` | 중앙 정렬 로그인 폼 (ID, PW, 버튼, 상태 텍스트) |
| `SHktIngameHudWidget` | 3개의 토글 패널이 있는 하단 바 (인벤토리, 장비, 스킬) |
| `SHktEntityHudWidget` | 컴팩트한 엔티티 HUD (엔티티 ID, 소유자 레이블, 체력 바) |

## 헬퍼 API

```cpp
#include "HktUIHelpers.h"

// 구체적인 PC 타입을 모르는 상태에서 PC에서 컴포넌트 찾기
UHktLoginComponent* Comp = HktUI::FindComponent<UHktLoginComponent>(PC);

// IHktUserEventConsumer 인터페이스를 통해 이벤트 전송
HktUI::SendUserEvent(PC, FHktUserEvent(TEXT("SomeEvent")));

// Slate 컨텍스트에서 첫 번째 로컬 PlayerController 가져오기
APlayerController* PC = HktUI::GetFirstLocalPlayerController();
```

## 파일 구조

```
HktUI/
+-- HktUI.Build.cs
+-- README.md
+-- Public/
|   +-- IHktUIModule.h
|   +-- IHktUIView.h                    <- Slate 위젯 래퍼 인터페이스
|   +-- HktUIHelpers.h                  <- FindComponent, SendUserEvent 헬퍼
+-- Private/
    +-- HktHUD.h/cpp                    <- 기본 HUD (LoadAndCreateWidget)
    +-- HktLoginHUD.h/cpp               <- 로그인 HUD 서브클래스
    +-- HktIngameHUD.h/cpp              <- 인게임 HUD 서브클래스 (뷰포트 + 엔티티)
    +-- HktUISubsystem.h/cpp            <- LocalPlayerSubsystem (트리, 캔버스, 틱)
    +-- HktUIElement.h/cpp              <- UI 엘리먼트 노드
    +-- HktUIAnchorStrategy.h           <- 추상 앵커 전략
    +-- HktViewportAnchorStrategy.h     <- 고정 뷰포트 위치
    +-- HktWorldViewAnchorStrategy.h/cpp <- FHktWorldState 엔티티 위치
    +-- HktSlateView.h                  <- FHktSlateView (IHktUIView 구현)
    +-- IHktUIViewFactory.h (Public)    <- CreateView/CreateStrategy 인터페이스
    +-- HktWidgetLoginHudDataAsset.h/cpp
    +-- HktWidgetIngameHudDataAsset.h/cpp
    +-- HktWidgetEntityHudDataAsset.h/cpp
    +-- HktLoginComponent.h/cpp         <- 로그인 RPC 컴포넌트
    +-- Widgets/
        +-- SHktLoginHudWidget.h/cpp    <- 로그인 Slate 위젯
        +-- SHktIngameHudWidget.h       <- 인게임 뷰포트 Slate 위젯
        +-- SHktEntityHudWidget.h       <- 엔티티 월드 Slate 위젯
```

## GameplayTags

| 태그 | DataAsset | 위젯 |
|------|-----------|------|
| `Widget.LoginHud` | `UHktWidgetLoginHudDataAsset` | `SHktLoginHudWidget` |
| `Widget.IngameHud` | `UHktWidgetIngameHudDataAsset` | `SHktIngameHudWidget` |
| `Widget.EntityHud` | `UHktWidgetEntityHudDataAsset` | `SHktEntityHudWidget` |

## 설정

1. **로그인 맵 GameMode**: `HUDClass = AHktLoginHUD` 설정
2. **인게임 맵 GameMode**: `HUDClass = AHktIngameHUD` 설정
3. **HktRuntimeGlobalSetting**: `InGameMap`을 대상 레벨로 설정 (로그인 -> 인게임 전환용)
4. **HktAssetSubsystem**: `Widget.LoginHud`, `Widget.IngameHud`, `Widget.EntityHud` 태그에 대한 DataAsset 등록

## 의존성

- **HktCore**: FHktWorldState, FHktEntityId, PropertyId
- **HktRuntime**: HktGameplayTags, HktGameInstance, HktRuntimeGlobalSetting, IHktPlayerInteractionInterface
- **HktAsset**: HktAssetSubsystem (태그 기반 비동기 로딩)
- **UE5 Slate**: SConstraintCanvas, SCompoundWidget, SProgressBar, SEditableTextBox
