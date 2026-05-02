# Design — HktSprite Paper2D Actor

기존 `UHktSpriteCrowdRenderer`(HISM) / `UHktSpriteNiagaraCrowdRenderer`(Niagara) 의 *크라우드 호스트형 인스턴싱* 구조와 별개로, **언리얼엔진 기본 Paper2D** 자산을 사용해 **엔티티 1명 = AActor 1개 = 컴포넌트 1개** 모델로 스프라이트를 렌더링하는 경로를 추가한다. 데이터는 `HktSpriteGenerator` 의 워크스페이스를 입력으로 별도 빌더가 생성한다.

## 배경 / 동기

- HISM/Niagara 경로는 모두 1 atlas = 1 인스턴싱 컴포넌트 + 커스텀 빌보드 머티리얼(CPD 16슬롯 / Niagara DynParam) 을 사용. UE 표준 Paper2D 워크플로우와 분리되어 있어 디버깅·미리보기·외부 도구 호환이 어렵다.
- Paper2D 옵션은 **인스턴싱이 없으므로 크라우드 호스트가 무의미**하다. 엔티티당 컴포넌트를 들고 다니는 모델이라면 — `HktPresentation` 이 이미 `FHktActorProcessor` + `IHktPresentableActor` 로 정확히 그 패턴을 구현하고 있다. 본 설계는 그 위에 액터 클래스 1개만 얹는다.
- HISM/Niagara 는 그대로. Paper2D 는 *다른 VisualTag 로 시작하는 별개 흐름* — 같은 화면에 두 경로가 공존 가능, dispatch 분기/CVar 토글 불필요.

## 1. 목표 / 비목표

### Goals

- **표준 ActorProcessor 패턴 사용** — `FHktActorProcessor` + `IHktPresentableActor`. 신규 호스트/프로세서 0.
- **엔티티당 액터 1개 + 컴포넌트 1개** — `AHktSpritePaperActor` (Root + `UPaperFlipbookComponent`).
- **UE 기본 스프라이트만 사용** — `UPaperSprite`, `UPaperFlipbook`, `UPaperFlipbookComponent`. 커스텀 셰이더/CPD 0.
- **HktSpriteGenerator 무수정** — 기존 코드/패널/MCP 도구 한 글자도 손대지 않음. public static 컨벤션 헬퍼만 호출.
- **워크스페이스 재사용** — `{ProjectSavedDir}/SpriteGenerator/{SafeChar}/{SafeAnim}/atlas_{Dir}.png` + `atlas_meta.json`.

### Non-goals

- HISM/Niagara 렌더러 제거. 셋 모두 병존하되 **다른 VisualTag** 로 진입한다(예: HISM 경로는 `Sprite.Character.Knight`, Paper2D 경로는 `PaperSprite.Character.Knight`).
- 인스턴싱 / 대규모 크라우드. 본 경로는 소~중규모(수십 캐릭터, 디버그/에디터 미리보기/단순 게임모드) 용도.
- `AHktSpriteCrowdHost` 변경. CVar dispatch 도입 안 함 — Paper2D 는 별도 흐름이라 호스트와 무관.
- 새 Presentation Processor. 기존 `FHktActorProcessor` 가 처음부터 끝까지 처리.
- `UHktSpriteCharacterTemplate` 의 의미 변경. Paper2D 는 별개 DataAsset 사용.

## 2. 전체 구성

```
+-- 빌드 시점 (Editor) --------------------------------------------+
|  Workspace ({Saved}/SpriteGenerator/{SafeChar}/{SafeAnim}/...)   |
|     ├─ {Dir}/frame_*.png      (Stage 1, generator 산출)          |
|     ├─ atlas_{Dir}.png        (Stage 2, generator 산출)          |
|     └─ atlas_meta.json        (Stage 2, generator 산출)          |
|                ↓ (입력으로 사용, generator 코드 수정 0)           |
|  HktPaper2DGenerator (신규 Editor 모듈)                          |
|     UHktPaperSpriteBuilderFunctionLibrary                        |
|        BuildPaperSpriteAnim / BuildPaperCharacter                |
|                ↓ 출력                                             |
|  /Game/Generated/PaperSprites/{SafeChar}/                        |
|     ├─ T_PaperAtlas_..._{Dir}        (UTexture2D)                |
|     ├─ PS_..._{Dir}_{Frame}          (UPaperSprite)              |
|     ├─ PFB_..._{Dir}                 (UPaperFlipbook)            |
|     ├─ DA_PaperCharacter_{Char}      (UHktPaperCharacterTemplate)|
|     └─ DA_PaperVisual_{Char}         (UHktActorVisualDataAsset,  |
|                                       ActorClass=AHktSpritePaperActor,
|                                       AnimationData=DA_PaperCharacter)|
+------------------------------------------------------------------+
                                ↓ 런타임 (변경 없음)
+-- 런타임 (Game) — 기존 Presentation 파이프라인 그대로 ----------+
|  Server SpawnEntity → FHktSpriteView/FHktVisualizationView       |
|         (VisualTag = "PaperSprite.Character.Knight")             |
|                ↓                                                  |
|  FHktActorProcessor (기존)                                        |
|     1. PendingSpawns 소비                                         |
|     2. UHktAssetSubsystem::LoadAssetAsync(VisualTag)              |
|        → DA_PaperVisual_Knight (UHktActorVisualDataAsset)        |
|     3. World->SpawnActor<AActor>(VisualAsset->ActorClass = ...)  |
|        → AHktSpritePaperActor 인스턴스                            |
|     4. P->OnVisualAssetLoaded(VisualAsset)                       |
|        → 액터가 AnimationData(=DA_PaperCharacter) 캐싱            |
|     5. P->ApplyTransform / ApplyAnimation 매 프레임/dirty시       |
|                ↓                                                  |
|  AHktSpritePaperActor (신규, IHktPresentableActor)                |
|     ├─ Root: USceneComponent                                     |
|     └─ Child: UPaperFlipbookComponent                            |
|        - SetFlipbook((AnimTag, DirIdx))                          |
|        - SetPlaybackPosition(elapsedSec)                          |
|        - SetSpriteColor(Tint)                                    |
|        - 매 프레임 카메라 yaw 따라 RootComponent 회전 (빌보드)   |
+------------------------------------------------------------------+
```

## 3. 파일 레이아웃

### 3-A. 신규 Editor 모듈 — `HktPaper2DGenerator`

```
HktGameplayGenerator/Source/HktPaper2DGenerator/
├── HktPaper2DGenerator.Build.cs
├── Public/
│   └── HktPaperSpriteBuilderFunctionLibrary.h
└── Private/
    ├── HktPaper2DGeneratorModule.cpp
    ├── HktPaperSpriteBuilderFunctionLibrary.cpp
    ├── HktPaperAssetBuilder.{h,cpp}        (UTexture2D/UPaperSprite/UPaperFlipbook 빌드)
    ├── HktPaperUnlitMaterialBuilder.{h,cpp}(M_HktPaperUnlit 자동 생성)
    └── HktPaperWorkspaceScanner.{h,cpp}    (워크스페이스 발견·메타 파싱)
```

`Build.cs` 의존:
- 공용: `Core`, `CoreUObject`, `Engine`, `GameplayTags`
- Paper2D: `Paper2D`, `Paper2DEditor`
- Asset 작업: `AssetTools`, `AssetRegistry`, `UnrealEd`, `EditorScriptingUtilities`
- 입력 헬퍼: `HktSpriteGenerator` (public static convention helper 호출 전용)
- 출력 DataAsset 정의: `HktSpriteCore`, `HktAsset`(UHktActorVisualDataAsset)

`HktSpriteGenerator` 의 헤더/cpp/패널/MCP 함수는 일체 수정하지 않는다. 호출만 한다:
- `UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot`
- `UHktSpriteGeneratorFunctionLibrary::GetConventionDirectionalAtlasPng`
- `UHktSpriteGeneratorFunctionLibrary::GetConventionDirectionalBundleDir`

### 3-B. 신규 런타임 — `HktSpriteCore`

```
HktGameplay/Source/HktSpriteCore/
├── Public/
│   ├── HktPaperCharacterTemplate.h     ← 신규 DataAsset
│   └── HktSpritePaperActor.h           ← 신규 AActor (IHktPresentableActor 구현)
└── Private/
    ├── HktPaperCharacterTemplate.cpp
    └── HktSpritePaperActor.cpp
```

`HktSpriteCore.Build.cs` 에 `Paper2D` 의존 추가. `Paper2DEditor` 는 **추가하지 않음** (Editor 전용 모듈이라 런타임 누설 시 패키징 실패).

`HktPresentation` 모듈에는 한 글자도 추가하지 않는다 — `IHktPresentableActor` / `FHktActorProcessor` 는 그대로 사용.

## 4. 데이터 모델

### `UHktPaperCharacterTemplate` — 캐릭터 단위 Flipbook 룩업 테이블

```cpp
USTRUCT(BlueprintType)
struct FHktPaperAnimDirKey
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere) FGameplayTag AnimTag;
    UPROPERTY(EditAnywhere) uint8 DirIdx = 0;
    bool operator==(const FHktPaperAnimDirKey& O) const { return AnimTag == O.AnimTag && DirIdx == O.DirIdx; }
};
FORCEINLINE uint32 GetTypeHash(const FHktPaperAnimDirKey& K)
{ return HashCombine(GetTypeHash(K.AnimTag), K.DirIdx); }

USTRUCT(BlueprintType)
struct FHktPaperAnimMeta
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere) int32 NumDirections = 8;        // 1 / 5 / 8 (기존 양자화 규약)
    UPROPERTY(EditAnywhere) float FrameDurationMs = 100.f;
    UPROPERTY(EditAnywhere) bool  bLooping = true;
    UPROPERTY(EditAnywhere) bool  bMirrorWestFromEast = true;
    UPROPERTY(EditAnywhere) FVector2f Scale = {1, 1};
    UPROPERTY(EditAnywhere) FLinearColor Tint = FLinearColor::White;
};

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktPaperCharacterTemplate : public UDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere) float PixelToWorld = 2.f;
    UPROPERTY(EditAnywhere) FGameplayTag DefaultAnimTag;
    UPROPERTY(EditAnywhere) TMap<FGameplayTag, FHktPaperAnimMeta> Animations;

    /** (AnimTag, DirIdx) → UPaperFlipbook. 미러 dir 은 키 미생성 — 액터가 X-스케일로 처리. */
    UPROPERTY(EditAnywhere) TMap<FHktPaperAnimDirKey, TObjectPtr<UPaperFlipbook>> Flipbooks;
};
```

> `UHktTagDataAsset` 파생이 아닌 단순 `UDataAsset` 으로 둔다. **HktAsset 비동기 로드의 진입점은 `UHktActorVisualDataAsset`** 이며, 이 템플릿은 그 안에서 하드 참조로 끌려온다.

### `UHktActorVisualDataAsset` (기존) — Paper2D 캐릭터 등록

기존 ActorProcessor 가 사용하는 그대로의 자산. 빌더는 캐릭터당 한 개씩 추가 생성:

| 필드 | 값 |
|---|---|
| `IdentifierTag` (HktTagDataAsset) | `PaperSprite.Character.Knight` (서버 SpawnEntity 의 VisualTag 와 일치) |
| `ActorClass` | `AHktSpritePaperActor::StaticClass()` |
| (캐릭터 데이터 슬롯, 신규 필드 추가 여부 결정) | `DA_PaperCharacter_Knight` 하드 참조 |

`UHktActorVisualDataAsset` 에 Paper2D 캐릭터 데이터 슬롯이 없다면 두 갈래:
- **B-1 (권장)**: `UHktActorVisualDataAsset` 에 `TObjectPtr<UDataAsset> AnimationData` 같은 범용 슬롯이 있으면 거기에 `UHktPaperCharacterTemplate*` 저장. `OnVisualAssetLoaded` 에서 액터가 `Cast<UHktPaperCharacterTemplate>(VisualAsset->AnimationData)`.
- **B-2**: 없으면 `UHktActorVisualDataAsset` 자체를 상속한 `UHktPaperActorVisualDataAsset` 신설(HktSpriteCore 또는 HktAsset 에). `UPROPERTY TObjectPtr<UHktPaperCharacterTemplate> Animation` 추가. 빌더는 이 파생 클래스를 출력.

→ 1차 PR 에서 `UHktActorVisualDataAsset` 의 현행 필드 구성을 확인 후 B-1 가능 여부 검증. 불가하면 B-2.

### 자산 네이밍

| 워크스페이스 입력 | UE 자산 이름 (예: Knight, Anim.FullBody.Loc.Idle, Dir=E) |
|---|---|
| `{Saved}/SpriteGenerator/Knight/FullBody_Loc_Idle/atlas_E.png` | `T_PaperAtlas_Knight_FullBody_Loc_Idle_E` |
| ↳ frame 0..N-1 | `PS_Knight_FullBody_Loc_Idle_E_0` … |
| ↳ 시퀀스 | `PFB_Knight_FullBody_Loc_Idle_E` |
| 캐릭터 데이터 | `DA_PaperCharacter_Knight` |
| 액터 비주얼 등록 | `DA_PaperVisual_Knight` (`IdentifierTag = PaperSprite.Character.Knight`) |

## 5. 빌더 — `UHktPaperSpriteBuilderFunctionLibrary`

```cpp
UCLASS()
class UHktPaperSpriteBuilderFunctionLibrary : public UBlueprintFunctionLibrary
{
public:
    /** (Char, Anim) 단위 빌드 — Workspace 의 atlas_{Dir}.png 들을 임포트해 Sprite/Flipbook 생성 후
     *  DA_PaperCharacter_{Char} 에 upsert. DA_PaperVisual_{Char} 도 동시에 upsert. */
    UFUNCTION(BlueprintCallable, Category="HKT|PaperSpriteBuilder")
    static FString BuildPaperSpriteAnim(
        const FString& CharacterTagStr,
        const FString& AnimTagStr,
        int32 CellWidth      = 0,
        int32 CellHeight     = 0,
        float PixelToWorld   = 2.0f,
        float FrameDurationMs= 100.f,
        bool  bLooping       = true,
        bool  bMirrorWestFromEast = true,
        const FString& OutputDir = TEXT(""));        // 기본: /Game/Generated/PaperSprites/{SafeChar}

    /** 캐릭터 워크스페이스 안의 모든 anim 디렉터리를 자동 발견해 일괄 빌드. */
    UFUNCTION(BlueprintCallable, Category="HKT|PaperSpriteBuilder")
    static FString BuildPaperCharacter(
        const FString& CharacterTagStr,
        const FString& VisualIdentifierTagStr = TEXT(""),  // 비우면 "PaperSprite.Character.{Char}"
        float PixelToWorld   = 2.0f,
        const FString& OutputDir = TEXT(""));
};
```

### 처리 단계 (anim 1개)

1. **워크스페이스 발견** — 8 dir 에 대해 `GetConventionDirectionalAtlasPng` 가 디스크에 존재하는지 검사. 발견 수로 `NumDirections = 1 | 5 | 8` 양자화.

2. **셀 메타** — `{Anim}/atlas_meta.json` 우선 → 인자 → atlas 종횡비 폴백. `frameCount = atlasW / cellW` 정수 검증.

3. **UTexture2D 임포트** — `T_PaperAtlas_..._{Dir}` 이름. 압축 `TC_UserInterface2D`, `TF_Nearest`, `MipGenSettings = NoMipmaps`, `sRGB = true`. 이미 있으면 reimport.

4. **UPaperSprite 생성** (cell 단위)
   - `FSpriteAssetInitParameters InitParams; InitParams.SetTextureAndFill(Tex, FVector2D(i*cellW, 0), FVector2D(cellW, cellH));`
   - `Sprite->InitializeSprite(InitParams)`
   - `Sprite->SetPivotMode(ESpritePivotMode::Custom_Cell, PivotPx);` 기본 `(cellW/2, cellH)` (셀 하단 중앙)
   - `Sprite->PixelsPerUnrealUnit = 1.f / PixelToWorld;`
   - `Sprite->Material = M_HktPaperUnlit;` (없으면 생성)
   - 미러 dir(W/SW/NW) 은 sprite 자체를 안 만든다 — 동일 sprite 를 액터가 X-스케일로 미러.

5. **UPaperFlipbook 생성** — `FScopedFlipbookMutator` 로 KeyFrames 채우고 `FramesPerSecond = 1000.f / FrameDurationMs`. **Looping 플래그는 자산이 안 들고 있음** — 액터의 `UPaperFlipbookComponent::SetLooping(bLooping)` 에서 적용.

6. **`UHktPaperCharacterTemplate` upsert** — `DA_PaperCharacter_{Char}` 로드/생성, `Animations[AnimTag] = FHktPaperAnimMeta{...}`, 빌드된 dir 마다 `Flipbooks.Add({AnimTag, DirIdx}, Flipbook)`.

7. **`UHktActorVisualDataAsset` upsert** — `DA_PaperVisual_{Char}` 로드/생성:
   - `IdentifierTag = "PaperSprite.Character.{Char}"`
   - `ActorClass = AHktSpritePaperActor::StaticClass()`
   - 캐릭터 데이터 슬롯에 `UHktPaperCharacterTemplate*` 하드 참조

   → 이렇게 두면 서버는 SpawnEntity 의 VisualTag 를 `PaperSprite.Character.Knight` 로 주는 것만으로 Paper2D 경로 진입.

8. **반환 JSON**
```json
{ "success": true,
  "characterTag": "Knight",
  "animTag": "...",
  "characterDataAssetPath": "/Game/Generated/PaperSprites/Knight/DA_PaperCharacter_Knight",
  "visualDataAssetPath":    "/Game/Generated/PaperSprites/Knight/DA_PaperVisual_Knight",
  "numDirections": 8, "framesPerDir": 6,
  "atlases":  [...], "flipbooks": [...] }
```

## 6. 머티리얼 — `M_HktPaperUnlit`

`HktPaperUnlitMaterialBuilder` 가 자동 빌드 (`HktSpriteBillboardMaterialBuilder` 와 동일 패턴). 콘솔 명령: `HktPaperSprite.BuildUnlitMaterial`.

- `Shading Model = Unlit`
- `Blend Mode = Masked`, `OpacityMaskClipValue = 0.5`
- `Two Sided = true`
- `Used With Sprite = true` (필수)
- 노드:
  - `BaseColor = ParticleColor.RGB * SpriteTexture.RGB`
  - `OpacityMask = SpriteTexture.A * ParticleColor.A`
- Tint 는 `UPaperFlipbookComponent::SetSpriteColor` 가 자동으로 ParticleColor 에 바인딩됨.

## 7. 런타임 액터 — `AHktSpritePaperActor`

```cpp
UCLASS(Blueprintable)
class HKTSPRITECORE_API AHktSpritePaperActor : public AActor, public IHktPresentableActor
{
    GENERATED_BODY()
public:
    AHktSpritePaperActor();

    virtual void Tick(float DeltaTime) override;

    // IHktPresentableActor
    virtual void SetEntityId(FHktEntityId Id) override { CachedEntityId = Id; }
    virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) override;     // VisualAsset → Template 캐싱
    virtual void ApplyTransform(const FHktTransformView& V) override;          // 위치 보간 + 빌보드 회전
    virtual void ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce) override;
    virtual void ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce) override;
    virtual void ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce) override;

protected:
    UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent>          RootScene;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UPaperFlipbookComponent>  FlipbookComp;

private:
    FHktEntityId CachedEntityId = InvalidEntityId;

    UPROPERTY(Transient)
    TObjectPtr<UHktPaperCharacterTemplate> Template;

    /** AnimFragment — `HktSpriteAnimProcessor` 의 입력 POD. AHktSpriteCrowdHost 와 동일 구조이지만
     *  여기서는 액터 인스턴스가 직접 보유 (호스트 없음). */
    FHktSpriteAnimFragment AnimFragment;

    /** 마지막으로 적용한 (AnimTag, DirIdx) — 동일하면 SetFlipbook 스킵. */
    FGameplayTag CurrentAnimTag;
    uint8        CurrentDirIdx = 0xFF;
    bool         bMirrored = false;

    /** 서버 권위 AnimStartTick 변경 감지 → 로컬 시각 캡처. */
    int32  LastAuthoritativeAnimStartTick = MIN_int32;
    double AnimStartLocalSec = 0.0;

    void RebindFlipbook();
    void ApplyBillboardYaw();   // 카메라 yaw 따라 RootScene 회전
};
```

### Apply 흐름 (한 프레임)

`FHktActorProcessor` 는 SOA 뷰 단위로 액터에 dispatch한다. 각 Apply* 가 받는 정보:

```
ApplyTransform(V)   : RenderLocation (매 프레임)
ApplyAnimation(V)   : Tags(GameplayTagContainer), PendingAnimTriggers, TagsDirtyFrame
ApplyMovement(V)    : bIsMoving / bIsJumping / Velocity
ApplyCombat(V)      : MotionPlayRate / AttackSpeed / CPRatio
```

액터는 이를 `FHktSpriteAnimFragment` 로 흡수(기존 `HktSpriteAnimProcessor::SyncFromTagContainer / ApplyAnimTag` 그대로 재사용)한 뒤, `Tick(DeltaTime)` 에서:

1. `HktSpriteAnimProcessor::ResolveRenderOutputs(AnimFragment, OutAnimTag, OutPlayRate)` — 최종 anim/playrate 결정.
2. `HktResolveSpriteFrame(...)` — `(StoredFacing=DirIdx, FrameIdx, bFlipX)` 결정. (Facing 은 별도 SOA 뷰 — `FHktSpriteView::Facing` — 인데 액터에는 직접 안 들어옴. 옵션 1: Facing 도 `IHktPresentableActor` 에 새 Apply* 추가. 옵션 2: 액터가 World 에서 자기 velocity 로 추정. → 1차 PR 은 옵션 1 — `IHktPresentableActor` 에 신규 메서드 추가는 인터페이스 영역이라 신중하게: §11 트레이드오프 참고.)
3. `KeyDir = bFlipX ? 미러원본Dir(W↦E, SW↦SE, NW↦NE) : DirIdx`, `bMirrored = bFlipX && bMirrorWestFromEast`.
4. `(AnimTag, KeyDir)` 가 변경되면 `Template->Flipbooks[{AnimTag, KeyDir}]` 룩업 → `FlipbookComp->SetFlipbook(FB)`, `SetLooping(meta.bLooping)`, `SetSpriteColor(meta.Tint)`.
5. `ElapsedSec = (NowLocalSec - AnimStartLocalSec) * PlayRate`. `FlipbookComp->SetPlaybackPosition(ElapsedSec, /*bFireEvents=*/false)`.
6. `bMirrored` 이면 컴포넌트 `RelativeScale3D.X = -1`, 아니면 +1.
7. `RootScene->SetWorldRotation(FRotator(0, CameraYawDeg, 0))` — Y-billboard 와 동등한 효과. CameraYaw 입수 방법은 §8.

### 빌보드 회전 입수 (`AHktSpriteCrowdHost::SetCameraYaw` 와 등가)

기존 호스트는 `IHktPresentationProcessor::OnCameraViewChanged` 콜백을 받아 yaw 를 캐시한다. 본 액터는 호스트가 없으므로 두 갈래:
- **C-1 (권장)**: 액터가 `Tick` 안에서 `GetWorld()->GetFirstPlayerController()->PlayerCameraManager->GetCameraRotation().Yaw` 를 직접 조회. PlayerCameraManager 는 PIE 시작 직후 1~2 프레임 사이 null 일 수 있어 가드 필요.
- **C-2**: Game Instance Subsystem 에 yaw 값을 발행하고 액터가 구독. 멀티 액터의 중복 조회 회피.

→ 1차 PR 은 C-1. 액터 수가 많아지면 C-2 로 전환.

### Facing 입수

기존 HISM 경로는 `AHktSpriteCrowdHost::Sync` 가 `FHktSpriteView::Facing` 을 직접 읽는다. `IHktPresentableActor` 인터페이스에는 `ApplySprite(const FHktSpriteView&)` 같은 메서드가 없다.

옵션:
- **F-1**: 액터가 자기 위치/속도(`FHktMovementView::Velocity`) 로 facing 추정. 서버 권위 facing 과 미세 어긋남 발생 가능.
- **F-2**: `IHktPresentableActor` 에 `ApplySprite(const FHktSpriteView&, ...)` 신규 메서드 + `FHktActorProcessor::Sync` 안에 sprite 뷰 패스 추가. **HktPresentation 변경**이 필요 — 인터페이스 default empty body 라 기존 액터들 영향 0. 단, 모듈 의존(HktPresentation → FHktSpriteView 정의 위치) 정리 필요.
- **F-3**: 액터가 `UHktPresentationSubsystem` 에서 자기 EntityId 로 `FHktSpriteView` 를 직접 read. 인터페이스 무변경. 단, 매 프레임 룩업 비용.

→ 1차 PR 은 F-3. 안정화 후 F-2 로 정착(인터페이스 정식 추가).

## 8. 변경 영역 요약 (한 줄 정리)

| 모듈 | 파일 | 변경 |
|---|---|---|
| `HktGameplayGenerator/Source/HktPaper2DGenerator/` | (전부) | **신규** |
| `HktGameplay/Source/HktSpriteCore/Public/HktPaperCharacterTemplate.h` | | **신규** |
| `HktGameplay/Source/HktSpriteCore/Public/HktSpritePaperActor.h` | | **신규** |
| `HktGameplay/Source/HktSpriteCore/Private/HktPaperCharacterTemplate.cpp` | | **신규** |
| `HktGameplay/Source/HktSpriteCore/Private/HktSpritePaperActor.cpp` | | **신규** |
| `HktGameplay/Source/HktSpriteCore/HktSpriteCore.Build.cs` | | `Paper2D` 의존 추가 (1줄) |
| `HktGameplay/Source/HktSpriteGenerator/...` | | **수정 0** |
| `HktGameplay/Source/HktSpriteCore/HktSpriteCrowdRenderer.{h,cpp}` | | **수정 0** |
| `HktGameplay/Source/HktSpriteCore/HktSpriteNiagaraCrowdRenderer.{h,cpp}` | | **수정 0** |
| `HktGameplay/Source/HktSpriteCore/HktSpriteCrowdHost.{h,cpp}` | | **수정 0** |
| `HktGameplay/Source/HktPresentation/...` | | (F-3 채택 시) **수정 0** / (F-2 채택 시) `IHktPresentableActor.h` 만 메서드 1개 추가 |

## 9. 트레이드오프 / 위험

- **자산 폭증**: 캐릭터 1명 = `Animations × Directions × FramesPerDir` 개의 `UPaperSprite`. 8 × 6 × 10 = 480 개. 미러 절약(8→5) 평균 60%. 1차 PR 은 그대로 디스크에 출력. PR-3 에서 sprite 를 transient package 로 만들고 flipbook 만 디스크에 두는 옵션 검토.
- **인스턴싱 부재**: 엔티티 1명 = 액터 1개 + 컴포넌트 1개 + 드로콜 1개. 1000 엔티티 시 무거움 — 본 경로의 **명시적 제약**. 대규모 크라우드는 HISM/Niagara 그대로 유지.
- **빌보드 비용**: 매 프레임 액터 N개의 `SetWorldRotation`. yaw 변화량 임계값 dirty check 필요(PR-3).
- **Facing 입수**: §7 의 F-3 → F-2 마이그레이션 빚을 진다. F-3 은 매 프레임 Subsystem 룩업 비용.
- **`UHktActorVisualDataAsset` 슬롯**: 캐릭터 데이터(`UHktPaperCharacterTemplate*`) 를 어디에 둘지(B-1/B-2)는 1차 PR 의 첫 단계에서 자산 정의 확인 후 결정.
- **머티리얼 단일**: PaletteIndex(HISM CPD slot 13) 같은 셰이더 레벨 확장은 미지원. 도입 시 머티리얼 파라미터 컬렉션/MID 추가.
- **시간축 일치**: HISM 경로는 `FrameResolver` 결과 `FrameIdx` 를 GPU 로 바로 보냄. Paper2D 는 `SetPlaybackPosition(elapsedSec)` 으로 위임 — loop wrap, 마지막 프레임 hold 등 미세 차이. 1차 PR 은 `SetPlaybackPositionInFrames(FrameIdx, false)` 로 명시 강제 후 비교.
- **워크스페이스 결합도**: `HktPaper2DGenerator` 가 generator 의 컨벤션(파일명/디렉터리/atlas_meta.json 스키마)에 의존. 컨벤션이 깨지면(generator 측 변경) 빌더도 깨짐 — 동기화 책임 명시.

## 10. PR 분할

- **PR-1 — 데이터 빌더 + 자산 정의**
  - 신규 `HktPaper2DGenerator` 모듈
  - 신규 `UHktPaperCharacterTemplate`
  - `M_HktPaperUnlit` 자동 빌더 + 콘솔 명령 `HktPaperSprite.BuildUnlitMaterial`
  - `BuildPaperSpriteAnim` / `BuildPaperCharacter` + 콘솔 명령 `HktPaperSprite.BuildCharacter <CharacterTag>`
  - `UHktActorVisualDataAsset` 슬롯 결정(B-1/B-2)
  - 런타임 변경 0.

- **PR-2 — 런타임 액터**
  - 신규 `AHktSpritePaperActor`
  - `HktSpriteCore.Build.cs` 에 `Paper2D` 추가
  - Facing 입수 F-3 채택 (Subsystem 룩업)
  - PIE 검증: VisualTag = `PaperSprite.Character.Knight` 로 SpawnEntity → 자동으로 Paper2D 액터 스폰 → flipbook 재생
  - 호스트/HISM/Niagara 경로 변경 0.

- **PR-3 — 옵션**
  - `SHktPaperSpriteBuilderPanel` (기존 `SHktSpriteBuilderPanel` UX 미러)
  - MCP Python 도구 `editor_build_paper_sprite_character`
  - `IHktPresentableActor::ApplySprite` 정식 추가 (F-3 → F-2 마이그레이션)
  - 카메라 yaw dirty check / sprite transient package 옵션 / 자산 메모리 최적화

## 11. 검증

- **PR-1**
  - Knight 캐릭터의 워크스페이스로 `BuildPaperCharacter("Sprite.Character.Knight")` 실행 → AssetRegistry 에서 모든 자산 발견.
  - `atlas_meta.json` 부재, cellW=0, frameCount 비정수 등 결함 입력에서 실패 JSON 반환.
  - 같은 anim 재실행 시 자산 in-place 갱신, 이름 충돌 0.

- **PR-2**
  - 같은 PIE 에서 HISM 경로(`Sprite.Character.Knight`) 와 Paper2D 경로(`PaperSprite.Character.Knight`) 둘 다 SpawnEntity 했을 때 두 그룹이 동시에 화면에 보임.
  - Paper2D 액터 destroy 시 컴포넌트 누수 0 (`stat MemoryDetailed`).
  - 1000 엔티티 PIE — Paper2D 경로 FPS 측정 → 한계치 문서화.
  - 기존 HISM/Niagara 경로 회귀 0 (코드 변경 0이므로 컴파일/스크린샷 비교만).

## 12. 미해결 / 후속 결정

- `UHktActorVisualDataAsset` 의 캐릭터 데이터 슬롯 존재 여부 — 1차 PR 첫 작업.
- Facing 흐름: F-3 (런타임 룩업) vs F-2 (`IHktPresentableActor` 정식 추가) — PR-3 에서 F-2 로 정착.
- 자산 출력 루트 (`/Game/Generated/PaperSprites/{SafeChar}` vs Project Settings 의 `ConventionRootDirectory`).
- `bMirrorWestFromEast` 디폴트 — 캐릭터별로 다르면 워크스페이스 사이드카 추가 필요.
- 셀 메타 폴백 우선순위 (현 안: `atlas_meta.json` > 인자 > 종횡비).
