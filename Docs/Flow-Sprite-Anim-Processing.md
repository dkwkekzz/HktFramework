# Sprite Animation Processing — WorldView → ViewModel → Renderer

서버 권위 `WorldView` 가 클라이언트의 sprite 렌더(Paper2D 액터 / HISM 크라우드 / Niagara 크라우드) 에 도달하기까지의 단일 처리 경로. 모든 2D sprite 표현 수단은 동일한 `HktSpriteAnimProcessor` 산출물(`FHktSpriteAnimViewModel`) 만 소비하며, 자체 의사결정 로직을 갖지 않는다.

관련 문서:
- [Flow-DataAsset-Presentation-Pipeline.md](Flow-DataAsset-Presentation-Pipeline.md) — Tag → DataAsset → Renderer 비동기 로딩 (anim *데이터* 의 소스)
- [Design-HktSpritePaper2DRenderer.md](Design-HktSpritePaper2DRenderer.md) — Paper2D 단일-액터 경로 (소비자 #1)
- [Design-HktSpriteNiagaraCrowdRenderer.md](Design-HktSpriteNiagaraCrowdRenderer.md) — Niagara 크라우드 (소비자 #2)
- [SpritePipeline-3Stage.md](SpritePipeline-3Stage.md) — 어셋 생성 파이프라인

---

## 0. 동기 — 왜 단일 출처가 필요한가

2D 캐릭터를 표현할 수 있는 수단이 셋 있다:

| 수단 | 구현 | 용도 |
|---|---|---|
| `AHktSpritePaperActor` | UE Paper2D `UPaperFlipbookComponent` | 엔터티당 1액터. 인스턴싱 불가한 환경 / 클릭 가능 캐릭터 |
| `UHktSpriteCrowdRenderer` (호스트 `AHktSpriteCrowdHost`) | HISM 단일-쿼드 + CPD 16슬롯 | atlas 당 1 HISM. 대규모 크라우드 (수백~수천) |
| `UHktSpriteNiagaraCrowdRenderer` | Niagara Mesh Renderer + NDI Array | HISM 대체 후보 (CVar `hkt.Sprite.Renderer` 토글) |

리팩터 이전엔 세 수단이 *각자* anim 의사결정(Movement/Combat/Animation 뷰 흡수, AnimTag 해석, Facing 산출, `Anim.Action.*` 자동 만료) 을 들고 있었다. 결과적으로:
- 코드 중복 — `if (V.bIsMoving.IsDirty(Frame))` 같은 같은 블록이 PaperActor / CrowdHost 양쪽에 동일하게 존재.
- 누락 버그 — `Anim.Action.*` 자동 만료가 Paper 경로에만 있었고 Crowd 경로는 영원히 action 태그를 픽 → Locomotion 폴백 불가.
- 카메라 yaw 회전 시 facing 동작이 두 경로에서 달랐음 (Paper sticky / Crowd 재산출).

리팩터 이후 **모든 의사결정은 `HktSpriteAnimProcessor` 네임스페이스의 순수 함수가 담당**하며, 표현 수단은 산출물 `FHktSpriteAnimViewModel` 의 set 만 처리한다.

---

## 1. 전체 흐름

```
                       ┌─────────────────────────────────────────────────────┐
서버 (HktCore VM)      │ FHktWorldState SOA 컬럼                              │
  PropertyId::* 갱신   │   - AnimState / AnimStartTick / Tags / Velocity ...  │
                       └────────────────────┬────────────────────────────────┘
                                            │ (네트워크 권위 batch, 30Hz)
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ FHktWorldView (델타) → UHktPresentationSubsystem::ProcessDiff                   │
│   ↓                                                                            │
│ FHktPresentationState SOA 뷰                                                   │
│   - FHktMovementView    : bIsMoving / bIsJumping / Velocity                    │
│   - FHktCombatView      : MotionPlayRate / AttackSpeed / CPRatio               │
│   - FHktAnimationView   : Tags(GameplayTagContainer) / PendingAnimTriggers     │
│   - FHktSpriteView      : Character / AnimStartTick (서버 권위)                │
│   - FHktTransformView   : RenderLocation                                        │
└────────────────────┬─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ HktSpriteAnimProcessor (namespace, 순수 함수)                                  │
│                                                                                │
│   ① AbsorbViews(Fragment, State, Id, Frame, MinFacingSpeed)                   │
│       - Movement view → Fragment.bIsMoving/bIsFalling/MoveSpeed/LastMoveDirXY │
│       - Combat view   → Fragment.AttackPlayRate / CPRatio                     │
│       - Animation view→ SyncFromTagContainer / ApplyAnimTag(PendingTriggers)  │
│       - returns bFacingSourceDirty                                            │
│                                                                                │
│   ② TickViewModel(Fragment, AuthAnimStartTick, DeltaSec, CameraYaw, VM, ...)  │
│       - Fragment.LocalNowSec += DeltaSec                                       │
│       - ResolveRenderOutputs → AnimTag/PlayRate (Montage > UpperBody          │
│                                  > Action > FullBody > Locomotion 폴백)       │
│       - sticky: LastAuthAnimStartTick / LastResolvedTag 변화 시               │
│                  Fragment.AnimStartLocalSec = LocalNowSec                     │
│       - LastMoveDirXY + CameraYaw → Facing/bFacingRight 매 호출 재산출         │
│       - VM 채움                                                                │
│                                                                                │
│   ③ ExpireActionLayers(Fragment, LocalNowSec, QueryDurationSec)               │
│       - Anim.Action.* layer 의 elapsed >= duration 이면 RemoveAnimTag         │
│       - QueryDurationSec 은 Renderer-specific (Paper: Flipbook.GetTotalDuration│
│                                       HISM/Niagara: anim FrameDuration*NumFrames)│
└────────────────────┬─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ FHktSpriteAnimViewModel  (per entity, 매 프레임)                                │
│   - AnimTag           : 그릴 최종 anim                                         │
│   - PlayRate                                                                   │
│   - Facing (8방향)                                                             │
│   - bFacingRight                                                               │
│   - LocalNowSec / AnimStartLocalSec                                            │
│     ElapsedSec = (LocalNowSec - AnimStartLocalSec) * PlayRate                  │
└────────────────────┬─────────────────────────────────────────────────────────┘
                     │
            ┌────────┴────────┬─────────────────────────┐
            ▼                 ▼                         ▼
┌─────────────────┐ ┌────────────────────┐ ┌──────────────────────────┐
│ PaperActor      │ │ CrowdHost          │ │ NiagaraCrowd (CVar gated)│
│  - Flipbook bind│ │  → CrowdRenderer   │ │  → NDI Array push        │
│  - SetPlayback  │ │     ResolveAtlas + │ │     (Position/Color/UV/  │
│     Position    │ │     CPD 16 slots   │ │      DynParam)           │
└─────────────────┘ └────────────────────┘ └──────────────────────────┘
```

---

## 2. 데이터 모델

### 2.1 `FHktSpriteAnimFragment` — 엔터티 anim 런타임 상태 (POD)

> 위치: `HktGameplay/Source/HktSpriteCore/Public/HktSpriteAnimProcessor.h`

UObject 가 아닌 POD struct. 표현 수단마다 자체 `TMap<FHktEntityId, FHktSpriteAnimFragment>` 또는 actor 멤버로 보유.

| 분류 | 필드 | 의미 |
|---|---|---|
| 태그 layer | `AnimLayerTags` (`TMap<FGameplayTag, FGameplayTag>`) | 부모 layer (예 `Anim.FullBody`) → 현재 재생 중 태그 (`Anim.FullBody.Locomotion.Run`) |
| 태그 layer | `AnimStateTag` | `Anim.FullBody` layer 의 alias (하위호환) |
| 태그 layer | `CurrentAnimTag` | 가장 최근 `ApplyAnimTag` 입력 |
| 태그 layer | `PrevAnimTags` | 직전 프레임의 `Anim.*` 스냅샷 (diff 감지) |
| 움직임 | `bIsMoving` / `bIsFalling` / `MoveSpeed` / `FallingSpeed` | `FHktMovementView` 흡수 |
| 움직임 | `LastMoveDirXY` (`FVector2D`) | sticky XY 속도. 임계 이상으로 이동 시에만 갱신 → 정지 후에도 마지막 방향 유지 |
| 전투 | `AttackPlayRate` / `CPRatio` | `FHktCombatView` 의 `MotionPlayRate ‖ AttackSpeed` 에서 파생 |
| sticky | `LocalNowSec` (`double`) | 로컬 실시간 클럭 (`TickViewModel` 가 매 호출 누적) |
| sticky | `AnimStartLocalSec` (`double`) | 현재 ResolvedTag 의 재생 시작 시각 |
| sticky | `LastAuthAnimStartTick` (`int32`) | 서버 권위 `FHktSpriteView::AnimStartTick` 의 최근 관측치. 변화 시 anchor reset |
| sticky | `LastResolvedTag` | 직전 `ResolveRenderOutputs` 결과. 변화 시 anchor reset |
| sticky | `LastClientFacing` (`EHktSpriteFacing`) | 마지막 산출 facing (8방향) |
| sticky | `bLastFacingRight` | 화면-공간 우향 sticky (NumDirections≤2 mirror 결정) |

### 2.2 `FHktSpriteAnimViewModel` — 렌더러가 set 하는 최종 입력

```cpp
struct FHktSpriteAnimViewModel {
    bool             bValid;                  // Processor 가 한 번이라도 채웠는가
    FGameplayTag     AnimTag;                 // FindAnimationOrFallback 룩업 키
    float            PlayRate;                // Combat → AttackPlayRate, etc.
    EHktSpriteFacing Facing;                  // 8방향 (renderer 가 dirIdx 로 변환)
    bool             bFacingRight;            // NumDirections≤2 mirror 결정
    double           LocalNowSec;             // 클럭
    double           AnimStartLocalSec;       // ElapsedSec = (Now - Start) * PlayRate
};
```

**Renderer 는 위 7개 필드 외 anim 결정 입력을 가지지 않는다.** 추가 의사결정 필요 시 Processor 에 추가하고 VM 에 노출하는 형태로만 확장한다.

---

## 3. 단계별 상세

### 3.1 ① AbsorbViews — WorldView 흡수

**호출 사이트**: PaperActor `Tick`, CrowdHost `UpdateEntitiesPerFrame` (per-entity).

**입력**: `FHktPresentationState&` (View 컬럼들), `FHktEntityId`, `Frame`, `MinFacingSpeed` (CVar `hkt.Sprite.Facing.MinSpeed`).

**처리**:
1. `FHktMovementView` 의 `bIsMoving / bIsJumping / Velocity` — `IsDirty(Frame)` 인 필드만 Fragment 에 반영.
2. `Velocity.IsDirty(Frame)` 이고 `‖VelXY‖ ≥ MinFacingSpeed` 면 `LastMoveDirXY = VelXY`, **`bFacingSourceDirty = true`**.
3. `FHktCombatView` — `MotionPlayRate > 0 ? .../100 : AttackSpeed/100` 로 `AttackPlayRate` 산출. `CPRatio` 도 흡수.
4. `FHktAnimationView` — `TagsDirtyFrame == Frame` 면 `SyncFromTagContainer`. `PendingAnimTriggers.Num() > 0` 이면 각 태그 `ApplyAnimTag` 후 Reset, **`bFacingSourceDirty = true`**.

**반환**: `bFacingSourceDirty` — 호출자가 `FHktSpriteView::Facing` 에 `MutableSV->Facing.Set(...)` 할지 게이트로 사용. (카메라 yaw 변화만으로는 false → ViewModel 미갱신, 렌더러는 VM.Facing 으로 즉시 반영.)

> **Idempotent**: 같은 Frame 으로 두 번 호출해도 `IsDirty(Frame)` 이 true 인 필드를 같은 값으로 재기록할 뿐 부작용 없음. `OnCameraViewChanged` 가 같은 프레임에서 `Tick` + 별도 호출되더라도 안전.

### 3.2 ② TickViewModel — 결정 + VM 산출

**호출 사이트**: PaperActor `Tick`, CrowdHost `UpdateEntitiesPerFrame` (per-entity, AbsorbViews 직후).

**입력**: `FHktSpriteAnimFragment&`, `int32 AuthAnimStartTick` (= `FHktSpriteView::AnimStartTick.Get()`), `double DeltaSec`, `float CameraYawDeg`.

**처리 순서**:
1. `Fragment.LocalNowSec += DeltaSec` — 매 호출 누적. (`OnCameraViewChanged` 의 강제 호출은 `DeltaSec = 0` 으로 두 번 가속 방지.)
2. `ResolveRenderOutputs(Fragment, OutAnimTag, OutPlayRate, dedup)` — 우선순위:
   1. `Anim.Montage.*`
   2. `Anim.UpperBody.*`
   3. `Anim.Action.*` (transient one-shot — `ExpireActionLayers` 가 종료)
   4. `Anim.FullBody.*`
   5. 그 외 임의 `Anim.*` layer
   6. **Locomotion 폴백**: `bIsFalling > bIsMoving(Run/Walk) > Idle` 로 `Anim.FullBody.Locomotion.*` 합성. Walk↔Run 임계는 CVar `hkt.Sprite.Loco.RunSpeedThreshold` (기본 300 cm/s).
3. **AnimStart sticky 갱신**: `Fragment.LastAuthAnimStartTick != AuthAnimStartTick` 이거나 `AnimTag != Fragment.LastResolvedTag` 면:
   ```
   Fragment.LastAuthAnimStartTick = AuthAnimStartTick
   Fragment.LastResolvedTag       = AnimTag
   Fragment.AnimStartLocalSec     = Fragment.LocalNowSec     // anchor reset
   ```
   서버측 `Op_PlayAnim` dedup (동일 태그 해시 시 `TouchAnimStartTickBySlot` 스킵) 로 `AuthAnimStartTick` 이 안 올라가는 경우에도 ResolvedTag 변화로 자력 anchor 갱신 — idle ↔ run 이 항상 0초부터 재생.
4. **Facing 산출**: `Fragment.LastMoveDirXY.IsNearlyZero()` 가 아니면:
   - `DirYawDeg = atan2(Dir.Y, Dir.X) * RAD2DEG`
   - `Fragment.LastClientFacing = HktFacingFromYaw(DirYawDeg, CameraYawDeg)`
   - `ScreenX = Dir.Y - Dir.X` (Iso yaw=45 기준 화면 우측 양수) → `bLastFacingRight`
   - LastMoveDirXY 가 ZeroVector 면 직전 LastClientFacing 유지 (한 번도 움직이지 않은 엔터티는 `S` 기본값).
5. VM 채움 → 호출자에 반환.

**Facing 을 매 호출 재산출하는 이유**: 카메라 yaw 회전 시 디스플레이 dir 이 즉시 따라가도록. 캐릭터가 N 을 보고 정지한 상태에서 카메라가 캐릭터 주위를 동쪽으로 90° 돌면 화면-우향 → 디스플레이 dir 도 E 로 전환되어야 자연스럽다. `bFacingSourceDirty` 는 ViewModel write-back 여부만 게이트하며 내부 산출은 매번 한다.

### 3.3 ③ ExpireActionLayers — Anim.Action.* 자동 만료

**호출 사이트**: PaperActor `Tick`, CrowdHost `UpdateEntitiesPerFrame` (per-entity, **TickViewModel 이후**).

**입력**: `FHktSpriteAnimFragment&`, `double LocalNowSec`, `TFunctionRef<float(const FGameplayTag&)> QueryDurationSec`.

**처리**:
1. `Fragment.AnimLayerTags` 중 layer key 가 `Anim.Action.*` 매칭하는 항목 순회.
2. 각 layer 의 anim tag 에 대해 `QueryDurationSec(tag)` 호출 — 자산 미존재/0 반환 시 즉시 만료(`RemoveAnimTag`). 양수면 `(LocalNowSec - Fragment.AnimStartLocalSec) >= duration` 일 때 만료.

**왜 callback 인가**: anim duration 의 데이터 소스가 렌더러 별로 다름.
- Paper2D: `UHktPaperAnimationDataAsset::Flipbooks[{tag, dir=0}]->GetTotalDuration()`
- HISM/Niagara: `UHktHISMSpriteAnimationDataAsset::FindAnimation(tag)` → `FramesPerDirection × FrameDurationMs ÷ 1000` (또는 `PerFrameDurationMs` 합)

호출자는 자기 자산 모델에 맞는 람다를 전달.

**왜 TickViewModel *뒤* 인가**: 이번 프레임의 ResolveRenderOutputs 가 action layer 를 픽한 뒤 만료 → 다음 프레임 resolver 가 Locomotion 폴백으로 전환. (만약 이전에 만료하면 action 이 한 프레임 일찍 끊긴다.)

---

## 4. Renderer 소비 (set-only)

### 4.1 `AHktSpritePaperActor::Tick(DeltaTime)`

```cpp
// 위치 보간 + 빌보드 회전 (생략)
// ...

// WorldView → Processor → VM
UHktPresentationSubsystem* PS = UHktPresentationSubsystem::Get(PC);
FHktPresentationState& PState = PS->GetMutableState();

const bool bDirty = HktSpriteAnimProcessor::AbsorbViews(
    AnimFragment, PState, CachedEntityId, PState.GetCurrentFrame(), MinFacingSpeed);

FHktSpriteAnimViewModel VM;
HktSpriteAnimProcessor::TickViewModel(
    AnimFragment, ServerAuthoritativeAnimStartTick,
    DeltaTime, CameraYaw, VM, bLoggedResolveRenderOutputsFailure);

HktSpriteAnimProcessor::ExpireActionLayers(AnimFragment, AnimFragment.LocalNowSec,
    [Anim = Animation](const FGameplayTag& Tag) -> float {
        UPaperFlipbook* FB = Anim->Flipbooks.Find({Tag, 0});
        return FB ? FB->GetTotalDuration() : 0.f;
    });

if (bDirty) PState.GetMutableSprite(CachedEntityId)->Facing.Set((uint8)VM.Facing, Frame);

// VM 소비 — set only
const FHktPaperAnimMeta* Meta = Animation->FindAnimationOrFallback(VM.AnimTag);
const auto StoredFacing = FHktSpriteAnimation::ResolveStoredFacing(
    VM.Facing, Meta->NumDirections, Meta->bMirrorWestFromEast, bFlipX, VM.bFacingRight);
RebindFlipbookIfNeeded(ResolvedTag, KeyDir, bFlipX, *Meta);
const double ElapsedSec = (VM.LocalNowSec - VM.AnimStartLocalSec) * VM.PlayRate;
FlipbookComp->SetPlaybackPosition(ElapsedSec * CurrentMetaTimeScale, false);
```

서버 권위 `AnimStartTick` 입력은 `ApplySprite(const FHktSpriteView&)` 가 매 sync 마다 캐시.

### 4.2 `AHktSpriteCrowdHost::UpdateEntitiesPerFrame`

각 sprite 엔터티에 대해 동일한 3 단계 호출 후 `FHktSpriteEntityUpdate` 구조체로 변환:

```cpp
FHktSpriteEntityUpdate Update;
Update.WorldLocation  = TV->RenderLocation.Get();
Update.Facing         = VM.Facing;
Update.AnimTag        = VM.AnimTag;
Update.AnimStartTick  = int64(VM.AnimStartLocalSec * 1000.0);   // sec → ms
Update.NowTick        = int64(VM.LocalNowSec * 1000.0);
Update.TickDurationMs = 1.0f;                                    // ms 도메인
Update.PlayRate       = VM.PlayRate;
Renderer->UpdateEntity(Id, Update);
```

`UHktSpriteCrowdRenderer::UpdateEntity` 가 `HktResolveSpriteFrame` 로 (StoredFacing, FrameIndex, bFlipX) 결정 → CPD 16 슬롯 채움.

### 4.3 `UHktSpriteNiagaraCrowdRenderer`

현재 dormant (CVar `hkt.Sprite.Renderer == 1` 시 활성). 활성화되면 CrowdHost 와 동일 패턴으로 호스트가 dispatch.

---

## 5. 시퀀스 — 한 프레임의 호출 순서

```
[PresentationSubsystem::OnTick]
   ProcessDiff(WorldView)            // FHktPresentationState 갱신
       ├ Movement/Combat/Animation/Sprite views (dirty flag set on Frame)
       └ SpawnedThisFrame / RemovedThisFrame
   ↓
   SyncProcessors()                  // 등록된 Processor.Sync() 호출
       ├ FHktActorProcessor::Sync       // PaperActor 의 ApplyTransform/Physics/Sprite 호출
       └ AHktSpriteCrowdHost::Sync      // Spawned 처리, CrowdRenderer.RegisterEntity/SetCharacter
   ↓
   Tick(Processors)
       ├ FHktActorProcessor::Tick    (no-op for sprite)
       └ AHktSpriteCrowdHost::Tick(State, DeltaTime)
              ↓ UpdateEntitiesPerFrame
                 for each Crowd sprite entity:
                    AbsorbViews → TickViewModel → ExpireActionLayers
                    Renderer->UpdateEntity(VM 기반 update)

[Actor Tick frame phase (UE 표준 Tick group)]
   for each AHktSpritePaperActor:
      Tick(DeltaTime)
         ├ 위치 보간 + 빌보드
         ├ AbsorbViews → TickViewModel → ExpireActionLayers
         └ Flipbook bind + SetPlaybackPosition
```

**ActorProcessor 와 PaperActor::Tick 의 순서**: ActorProcessor 는 `ApplySprite` 로 `ServerAuthoritativeAnimStartTick` 만 캐시. PaperActor::Tick 은 그 캐시와 자기 Fragment 로 VM 산출 — 두 단계가 다른 프레임 phase 에 있어도 캐시 read 만 발생하므로 1 프레임 lag 없음.

---

## 6. Anim layer 우선순위 의미

`ResolveRenderOutputs` 우선순위는 `UHktAnimInstance` 와 동일:

| 순위 | Layer | 용도 | 만료 방식 |
|---|---|---|---|
| 1 | `Anim.Montage.*` | 원샷 액션 (공격 발동 등) | 클라/서버 명시적 `RemoveAnimTag` |
| 2 | `Anim.UpperBody.*` | 상체 오버라이드 (공격/캐스트 지속) | 서버 `AddTag/RemoveTag` |
| 3 | `Anim.Action.*` | transient one-shot (Strike/Cast 등) | **`ExpireActionLayers` 자동 만료** |
| 4 | `Anim.FullBody.*` | 기본 상태 (Locomotion/Idle/Death) | 서버 `AddTag/RemoveTag` |
| 5 | 그 외 `Anim.*` | (custom layer) | 서버 |
| 폴백 | (없음) | Movement → `Anim.FullBody.Locomotion.{Idle,Walk,Run,Fall}` 합성 | — |

`Anim.Action.*` 만 자동 만료 — 다른 layer 는 서버 권위 태그 변경으로만 종료.

---

## 7. Facing 양자화 + Mirror

`FHktSpriteAnimation::ResolveStoredFacing(VM.Facing, NumDirections, bMirror, OutFlipX, VM.bFacingRight)` 가 8방향 입력을 자산의 NumDirections 에 맞춰 양자화:

| NumDirections | 의미 | 매핑 |
|---|---|---|
| 1 | 단일 sprite | 모든 입력 → slot 0, bFlipX=false |
| 2 | 좌우 분리 | `bFacingRight ? slot 0 (E) : slot 1 (W)` — 8방향 양자화 손실 우회 |
| 5 | N/NE/E/SE/S + 미러 | W/SW/NW 입력 → E/SE/NE 의 X-flip |
| 8 | 전부 | 1:1 매핑, bFlipX=false |

`bMirrorWestFromEast=true` 면 미러 dir 키를 별도 등록하지 않아도 X-flip 으로 자동 미러.

---

## 8. 확장 — 새 sprite 렌더러 추가

새 표현 수단을 추가할 때 anim 의사결정 코드를 다시 작성하지 말 것. 다음만 구현:

1. **호스트 (또는 액터)**: `AbsorbViews → TickViewModel → ExpireActionLayers` 호출. 각 엔터티당 `FHktSpriteAnimFragment` 하나 유지.
2. **Duration 콜백**: 자기 자산 모델에서 (AnimTag) → seconds 함수 람다 작성.
3. **VM 소비**: VM 의 7개 필드만 사용. 의사결정 새로 만들지 말 것.
4. **`ApplySprite` (액터 경로) 또는 `Sync` (호스트 경로)**: 서버 권위 `FHktSpriteView::AnimStartTick` 캐시.

새 결정 로직이 필요하면 *Processor 에* 추가하고 VM 에 노출. 렌더러는 절대 자체 결정 금지.

---

## 9. CVar 인덱스

| CVar | 기본 | 의미 |
|---|---|---|
| `hkt.Sprite.Facing.MinSpeed` | 5 (cm/s) | Facing 입력 (`LastMoveDirXY`) 갱신 최소 속도. 미만 시 sticky |
| `hkt.Sprite.Loco.RunSpeedThreshold` | 300 (cm/s) | Walk ↔ Run locomotion 폴백 분기점 |
| `hkt.PaperSprite.YawDirtyDeg` | 0.5 (deg) | PaperActor 빌보드 회전 dirty 임계 (anim 무관, 회전 마샬링 비용 최적화) |
| `hkt.PaperSprite.ViewAlignedBillboard` | 1 | 1: view-aligned (pitch 포함), 0: cylindrical yaw-only |

---

## 10. 관련 코드

| 파일 | 역할 |
|---|---|
| `HktSpriteCore/Public/HktSpriteAnimProcessor.h` | Fragment / VM / namespace API |
| `HktSpriteCore/Private/HktSpriteAnimProcessor.cpp` | `AbsorbViews` / `TickViewModel` / `ExpireActionLayers` 구현 + 저수준 태그 조작 |
| `HktSpriteCore/Public/HktSpritePaperActor.h/.cpp` | Paper2D 액터 (소비자) |
| `HktSpriteCore/Public/HktSpriteCrowdHost.h/.cpp` | HISM 크라우드 호스트 (소비자) |
| `HktSpriteCore/Public/HktSpriteCrowdRenderer.h/.cpp` | HISM 렌더러 (`ResolveVisualAsset` 콜백용 노출) |
| `HktSpriteCore/Public/HktSpriteFrameResolver.h` | `HktFacingFromYaw` / `HktResolveSpriteFrame` 순수 함수 |
| `HktPresentation/Public/HktPresentationState.h` | `FHktSpriteView` / `FHktMovementView` / `FHktCombatView` / `FHktAnimationView` |
