# HktPresentation

ISP(Intent-Simulation-Presentation) 아키텍처의 **Presentation** 레이어.
HktCore의 시뮬레이션 결과를 UE5 시각화로 변환하는 읽기 전용 뷰 모듈이다.

---

## 데이터 흐름

```
IHktPlayerInteractionInterface::OnWorldViewUpdated(FHktWorldView)
    │
    ▼
UHktPresentationSubsystem
    ├─ ProcessInitialSync / ProcessDiff
    │   ├─ State.BeginFrame(FrameNumber)
    │   ├─ ForEachRemoved  → State.RemoveEntity()
    │   ├─ ForEachSpawned  → State.AddEntity()
    │   └─ ForEachDelta    → State.ApplyDelta()
    │
    └─ SyncRenderers()
        ├─ FHktActorRenderer      (Unit, Building)
        ├─ FHktMassEntityRenderer (Projectile — TODO)
        └─ FHktUIRenderer         (UI — TODO)
```

## 핵심 구조

### 1. UHktPresentationSubsystem (LocalPlayerSubsystem)

진입점. `BindInteraction()`으로 `IHktPlayerInteractionInterface`에 바인딩하여 `OnWorldViewUpdated` 델리게이트를 수신한다.

- **InitialSync** — 첫 동기화. `View.ForEachEntity()`로 전체 엔티티를 `State`에 추가.
- **ProcessDiff** — 이후 프레임. Removed → Spawned → Delta 순으로 증분 적용.
- **SyncRenderers** — 변경점 적용 후 세 Renderer에 `Sync(State)` 호출.

### 2. FHktWorldView (입력)

HktCore에서 오는 읽기 전용 뷰. WorldState 포인터 + Diff 배열을 참조만 하며 복사 없음.

| 이터레이터 | 내용 |
|---|---|
| `ForEachEntity()` | WorldState 전체 엔티티 순회 |
| `ForEachSpawned()` | 새로 생성된 엔티티 |
| `ForEachRemoved()` | 제거된 엔티티 ID |
| `ForEachDelta()` | 프로퍼티 변경 (EntityId, PropId, NewValue) |

### 3. THktVisualField\<T\> (변경 감지)

Generation counter 기반 dirty 추적 템플릿.

```cpp
THktVisualField<FVector> Location;

Location.Set(NewPos, Frame);              // 값 설정 + 프레임 기록
Location.IsDirty(CurrentFrame);           // LastModifiedFrame == CurrentFrame
Location.Get();                           // 현재 값
```

프레임이 넘어가면 자동으로 clean 상태가 되므로 별도 리셋이 필요 없다.

### 4. FHktPresentationState (뷰모델 컨테이너)

엔티티별 `FHktEntityPresentation`을 EntityId 인덱스 배열로 관리한다.
`ValidMask`(TBitArray)로 유효성 추적.

프레임별 변경 목록:
- `SpawnedThisFrame` — 이번 프레임에 생성된 엔티티
- `RemovedThisFrame` — 이번 프레임에 제거된 엔티티
- `DirtyThisFrame` — 프로퍼티가 변경된 엔티티

### 5. FHktEntityPresentation (엔티티 뷰모델)

7개 ViewModel 그룹으로 구성:

| 그룹 | 필드 | PropertyId 매핑 |
|---|---|---|
| **Transform** | Location, Rotation | PosX/Y/Z(0-2), RotYaw(3) |
| **Movement** | MoveTarget, MoveSpeed, bIsMoving | MoveTargetX/Y/Z(4-6), MoveSpeed(7), IsMoving(8) |
| **Vitals** | Health, MaxHealth, HealthRatio, Mana, MaxMana, ManaRatio | Health(10), MaxHealth(11), Mana(15), MaxMana(16) |
| **Combat** | AttackPower, Defense | AttackPower(12), Defense(13) |
| **Ownership** | Team, OwnedPlayerUid | Team(14), OwnedPlayerUid(52) |
| **Animation** | AnimState, VisualState | AnimState(40), VisualState(41) |
| **Visualization** | VisualElement (FGameplayTag) | EntitySpawnTag(22) |

각 그룹은 `Apply()`(초기화)와 `TryApplyDelta()`(증분 적용) 인터페이스를 제공한다.

### 6. Renderer

`IHktPresentationRenderer::Sync(State)` 인터페이스를 구현한다.

**FHktActorRenderer** (구현 완료):
- `SpawnedThisFrame` → 비동기 에셋 로드 후 AActor 스폰
- `RemovedThisFrame` → Actor 제거
- `DirtyThisFrame` → `THktVisualField::IsDirty()` 체크 후 Transform 업데이트
- `ActorMap<EntityId, TWeakObjectPtr<AActor>>`로 관리

**RenderCategory 분류:**

| Entity Tag | Category | Renderer |
|---|---|---|
| Entity.Character.*, Entity.NPC.*, Entity.Building.* | Actor | FHktActorRenderer |
| Entity.Projectile.* | MassEntity | FHktMassEntityRenderer (TODO) |
| 기타 | None | — |

---

## 파일 구조

```
Source/HktPresentation/
├── Public/
│   ├── IHktPresentationModule.h        # 모듈 인터페이스
│   ├── HktPresentationSubsystem.h      # 메인 서브시스템
│   ├── HktPresentationState.h          # State + EntityPresentation
│   ├── HktPresentationViewModels.h     # 7개 ViewModel 그룹
│   ├── HktVisualField.h               # 변경 감지 템플릿
│   └── HktPresentationRenderer.h       # Renderer 인터페이스
├── Private/
│   ├── HktPresentationSubsystem.cpp
│   ├── HktPresentationState.cpp
│   ├── HktPresentationViewModels.cpp
│   ├── HktPresentationModule.cpp
│   ├── Renderers/
│   │   ├── HktActorRenderer.h/cpp      # Actor 렌더러 (구현됨)
│   │   ├── HktMassEntityRenderer.h/cpp # Mass 렌더러 (TODO)
│   │   └── HktUIRenderer.h/cpp         # UI 렌더러 (TODO)
│   └── DataAssets/
│       └── HktActorVisualDataAsset.h   # 비주얼 에셋 정의
```

## 설계 원칙

| 원칙 | 적용 |
|---|---|
| **읽기 전용** | 시뮬레이션 로직 없음. HktCore 결과를 시각화만 담당 |
| **제로 카피 뷰** | FHktWorldView는 포인터 참조만 사용 |
| **Generation Counter** | THktVisualField로 별도 리셋 없는 dirty 추적 |
| **Render Category 분리** | 엔티티 타입별로 적합한 Renderer 디스패치 |
| **비동기 스폰** | 에셋 로드 완료 콜백으로 블로킹 없이 Actor 생성 |
| **클라이언트 전용** | 서버 코드 없음 |
