# Design — HktSprite Paper2D Renderer

기존 `UHktSpriteCrowdRenderer`(HISM, CPD 16슬롯 + 커스텀 빌보드 머티리얼)와 `UHktSpriteNiagaraCrowdRenderer`(Niagara Mesh Renderer)를 그대로 두고, **언리얼엔진 기본 Paper2D** 자산만으로 같은 외부 API를 충족하는 세 번째 크라우드 렌더러를 추가한다. 동시에 HktSpriteGenerator의 워크스페이스를 입력 삼아 Paper2D 자산을 빌드하는 별도 툴을 신설한다.

## 배경 / 동기

- HISM/Niagara 경로 모두 *커스텀 머티리얼*에 의존 — Y-axis 빌보드 + 16슬롯 CPD/Niagara DynParam을 직접 셰이더에서 풀어낸다. UE 표준 워크플로우(Paper2D)에서 벗어나 있어 디버깅·미리보기·외부 도구 호환이 어렵다.
- UE 기본 스프라이트(`UPaperSprite` + `UPaperFlipbook` + `UPaperFlipbookComponent`) 만으로 같은 화면을 만들 수 있다면, 소규모 크라우드/디버그 미리보기/에디터 워크플로에서 표준 도구(애니메이션 미리보기, MaterialEditor, AssetEditor) 를 그대로 활용할 수 있다.
- 단, 인스턴싱이 없어 대규모(수천+) 크라우드에는 부적합 — 본 렌더러는 HISM/Niagara 의 **대체가 아닌 병렬 옵션**이며, 호스트의 `hkt.Sprite.Renderer` CVar 로 선택한다.

## 1. 목표 / 비목표

### Goals

- **외부 API 동일** — `RegisterEntity / UnregisterEntity / SetCharacter / UpdateEntity / ClearAll` 시그니처 그대로.
- **UE 기본 스프라이트만 사용** — `UPaperSprite`, `UPaperFlipbook`, `UPaperFlipbookComponent`. 커스텀 셰이더/CPD 0.
- **HktSpriteGenerator 무수정** — 기존 generator 코드/패널/MCP 도구 한 글자도 손대지 않음.
- **워크스페이스 재사용** — `{ProjectSavedDir}/SpriteGenerator/{SafeChar}/{SafeAnim}/atlas_{Dir}.png` + `atlas_meta.json` 을 입력으로 Paper2D 자산을 별도 툴이 생성.
- **CVar 토글** — `hkt.Sprite.Renderer = 0(HISM) | 1(Niagara) | 2(Paper2D)` 단순 dispatch.

### Non-goals

- HISM/Niagara 렌더러 제거. 셋 모두 병존.
- 인스턴싱 — 본 렌더러는 엔터티당 컴포넌트 1개. 대규모 성능 보장 안 함.
- 기존 `UHktSpriteCharacterTemplate` 의 의미 변경. Paper2D 경로는 별도 DataAsset(`UHktPaperCharacterTemplate`) 사용.
- `HktSpriteGenerator.HktSpriteGeneratorFunctionLibrary` 의 함수 시그니처/동작 변경. 빌더에서는 `GetConvention*` public static 헬퍼만 호출.

## 2. 전체 구성

```
+-- 빌드 시점 (Editor) --------------------------------------------+
|  Workspace ({Saved}/SpriteGenerator/{SafeChar}/{SafeAnim}/...)   |
|     ├─ {Dir}/frame_*.png        (Stage 1, generator 산출)        |
|     ├─ atlas_{Dir}.png          (Stage 2, generator 산출)        |
|     └─ atlas_meta.json          (Stage 2, generator 산출)        |
|                ↓ (입력으로 사용, 수정 없음)                       |
|  HktPaper2DGenerator (신규 Editor 모듈)                          |
|     UHktPaperSpriteBuilderFunctionLibrary::BuildPaperSpriteAnim  |
|                ↓ 출력                                             |
|  /Game/Generated/PaperSprites/...                                |
|     ├─ T_PaperAtlas_{SafeChar}_{SafeAnim}_{Dir}     (UTexture2D) |
|     ├─ PS_{SafeChar}_{SafeAnim}_{Dir}_{Frame}       (UPaperSprite)|
|     ├─ PFB_{SafeChar}_{SafeAnim}_{Dir}              (UPaperFlipbook)|
|     └─ DA_PaperCharacter_{SafeChar}                 (UHktPaperCharacterTemplate)|
+------------------------------------------------------------------+
                                ↓ 런타임 로드 (HktAsset 비동기)
+-- 런타임 (Game) -------------------------------------------------+
|  AHktSpriteCrowdHost (기존)                                      |
|     └─ Sync/Tick → IHktSpriteCrowdRenderer (CVar dispatch)       |
|              ├─ UHktSpriteCrowdRenderer       (HISM)             |
|              ├─ UHktSpriteNiagaraCrowdRenderer(Niagara)          |
|              └─ UHktSpriteCrowdRenderer_Paper2D (신규)           |
|                    └─ Entity 1명 = UPaperFlipbookComponent 1개   |
+------------------------------------------------------------------+
```

## 3. 모듈 / 파일 레이아웃

### 3-A. 신규 모듈 — `HktPaper2DGenerator` (Editor)

```
HktGameplayGenerator/Source/HktPaper2DGenerator/
├── HktPaper2DGenerator.Build.cs
├── Public/
│   ├── HktPaperSpriteBuilderFunctionLibrary.h
│   └── HktPaper2DGeneratorTypes.h          (작업 결과 JSON 빌더, 옵션)
└── Private/
    ├── HktPaper2DGeneratorModule.cpp
    ├── HktPaperSpriteBuilderFunctionLibrary.cpp
    ├── HktPaperAssetBuilder.{h,cpp}        (UPaperSprite/Flipbook 생성 코어)
    ├── HktPaperUnlitMaterialBuilder.{h,cpp}(M_HktPaperUnlit 자동 생성)
    └── HktPaperWorkspaceScanner.{h,cpp}    (워크스페이스 발견/메타 파싱)
```

`Build.cs` 의존:
- 공용: `Core`, `CoreUObject`, `Engine`, `GameplayTags`
- Paper2D: `Paper2D`, `Paper2DEditor`
- Asset 작업: `AssetTools`, `AssetRegistry`, `UnrealEd`, `EditorScriptingUtilities`
- 입력 헬퍼: `HktSpriteGenerator` (public static convention helper 호출용)
- 출력 DataAsset 정의: `HktSpriteCore`

`HktSpriteGenerator` 의 헤더 / cpp 는 수정하지 않는다 — 그쪽이 노출하는 `UHktSpriteGeneratorFunctionLibrary::GetConventionDirectionalAtlasPng / GetConventionDirectionalBundleDir / GetConventionBundleRoot` 등 **이미 BlueprintCallable 로 공개된** static 메서드만 호출.

### 3-B. 신규 헤더 — `HktSpriteCore` (런타임 DataAsset)

```
HktGameplay/Source/HktSpriteCore/
├── Public/
│   ├── HktPaperCharacterTemplate.h         ← 신규
│   └── HktSpriteCrowdRenderer_Paper2D.h    ← 신규(런타임 컴포넌트)
└── Private/
    ├── HktPaperCharacterTemplate.cpp
    └── HktSpriteCrowdRenderer_Paper2D.cpp
```

런타임 `Build.cs` 에 `Paper2D` 의존만 추가. `Paper2DEditor` 는 Editor 전용이므로 런타임 모듈에는 절대 들어가면 안 됨.

## 4. 데이터 모델 (Paper2D 경로)

### `UHktPaperCharacterTemplate`

```cpp
USTRUCT(BlueprintType)
struct FHktPaperAnimDirKey
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere) FGameplayTag AnimTag;
    UPROPERTY(EditAnywhere) uint8 DirIdx = 0;
    bool operator==(const FHktPaperAnimDirKey& O) const { return AnimTag == O.AnimTag && DirIdx == O.DirIdx; }
};
FORCEINLINE uint32 GetTypeHash(const FHktPaperAnimDirKey& K) { return HashCombine(GetTypeHash(K.AnimTag), K.DirIdx); }

USTRUCT(BlueprintType)
struct FHktPaperAnimMeta
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere) int32 NumDirections = 8;        // 1/5/8 (기존 양자화 규약)
    UPROPERTY(EditAnywhere) float FrameDurationMs = 100.f;
    UPROPERTY(EditAnywhere) bool  bLooping = true;
    UPROPERTY(EditAnywhere) bool  bMirrorWestFromEast = true;
    UPROPERTY(EditAnywhere) FVector2f PivotPx;              // (CellW/2, CellH) 기본
    UPROPERTY(EditAnywhere) FVector2f Scale = {1, 1};
    UPROPERTY(EditAnywhere) FLinearColor Tint = FLinearColor::White;
};

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktPaperCharacterTemplate : public UHktTagDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere) float PixelToWorld = 2.f;
    UPROPERTY(EditAnywhere) FGameplayTag DefaultAnimTag;
    UPROPERTY(EditAnywhere) TMap<FGameplayTag, FHktPaperAnimMeta> Animations;
    UPROPERTY(EditAnywhere) TMap<FHktPaperAnimDirKey, TObjectPtr<UPaperFlipbook>> Flipbooks;
};
```

`UHktSpriteCharacterTemplate` 와 의도적으로 평행 관계 — 같은 캐릭터 태그를 두 DataAsset 이 동시에 가질 수 있다(서로 다른 출력 경로). 런타임 렌더러가 어느 쪽을 로드할지는 CVar 와 Asset 발견 규약(`/Game/Generated/PaperSprites/...` vs `/Game/Generated/Sprites/...`)으로 결정.

### 자산 네이밍 (워크스페이스 → UE 자산)

| 워크스페이스 입력 | UE 자산 이름 (예: Sprite.Character.Knight, Anim.FullBody.Locomotion.Idle, Dir=E) |
|---|---|
| `{Saved}/SpriteGenerator/Knight/FullBody_Loc_Idle/atlas_E.png` | `T_PaperAtlas_Knight_FullBody_Loc_Idle_E` |
| ↳ frame 0,1,...,N-1                | `PS_Knight_FullBody_Loc_Idle_E_0`, `_1`, ... |
| ↳ 시퀀스                            | `PFB_Knight_FullBody_Loc_Idle_E` |
| 캐릭터 통합                         | `DA_PaperCharacter_Knight` |

## 5. 빌드 알고리즘 (anim 1개 단위)

`UHktPaperSpriteBuilderFunctionLibrary::BuildPaperSpriteAnim(CharacterTag, AnimTag, ...)`:

1. **워크스페이스 발견**
   - `Root = UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(CharacterTag)`
   - `DirIdx = 0..7` 에 대해 `GetConventionDirectionalAtlasPng(CharacterTag, AnimTag, DirIdx)` 가 디스크에 존재하는지 확인 → 존재 dir 집합 결정.
   - 0개면 실패(error JSON). 발견 수에 따라 `NumDirections = 1 | 5 | 8` 양자화 — 기존 `BuildSpriteAnim` 의 추론 규칙을 동일하게 별도 헬퍼로 재구현(generator cpp 를 수정/공유하지 않음).

2. **셀 메타 결정**
   - `{Anim}/atlas_meta.json` 가 있으면 `cellW`, `cellH`, `frameCount` 우선.
   - 없으면 인자 `CellWidth/CellHeight`. 둘 다 0 이면 atlas 종횡비 기반 자동 추론(높이를 한 변, 너비/한 변을 frameCount로).
   - `frameCount = atlasWidth / cellW` (정수 나머지 0 검증).

3. **UTexture2D 임포트**
   - 출력 경로: `{OutputDir}/Atlases/T_PaperAtlas_{SafeChar}_{SafeAnim}_{Dir}`.
   - `FAssetImportTask` 사용. 압축: `TC_EditorIcon` 또는 `TC_UserInterface2D`(BC7 압축 회피, 픽셀 정확). `Filter = TF_Nearest`, `MipGenSettings = NoMipmaps`, `sRGB = true`.
   - 이미 존재하면 reimport(소스 파일 경로 갱신).

4. **UPaperSprite 생성 (cell 단위)**
   - per frame `i ∈ [0, frameCount)`:
     - `Package = CreatePackage("{OutputDir}/Sprites/PS_..._i")`
     - `Sprite = NewObject<UPaperSprite>(Package, FName(*Name), RF_Public | RF_Standalone)`
     - `FSpriteAssetInitParameters InitParams; InitParams.SetTextureAndFill(Texture, FVector2D(i*cellW, 0), FVector2D(cellW, cellH));`
     - `Sprite->InitializeSprite(InitParams)`
     - `Sprite->SetPivotMode(ESpritePivotMode::Custom_Cell, /*PivotPositionCustom=*/PivotPx);` `Sprite->SetTrim(false);`
     - `Sprite->PixelsPerUnrealUnit = 1.f / PixelToWorld;`
     - `Sprite->Material = M_HktPaperUnlit;` (없으면 빌드 — 5절 머티리얼)
     - `FAssetRegistryModule::AssetCreated(Sprite); Package->MarkPackageDirty();`
   - 미러 정책(`bMirrorWestFromEast=true`): W/SW/NW 슬롯은 별도 sprite 안 만든다 — 런타임이 컴포넌트 X-스케일을 음수로 적용.

5. **UPaperFlipbook 생성**
   - `Flipbook = NewObject<UPaperFlipbook>(Package, FName(*Name), RF_Public | RF_Standalone)`
   - `FScopedFlipbookMutator M(Flipbook);`
     - `M.FramesPerSecond = 1000.f / FrameDurationMs;`
     - `M.KeyFrames.Reset();`
     - 각 sprite 에 `FPaperFlipbookKeyFrame{ Sprite, FrameRun=1 }` push
   - `bLooping` 은 **컴포넌트 측에서** `SetLooping(true)` 로 적용 — flipbook 자산 자체는 looping 플래그가 없음.
   - `bMirrorWestFromEast=true` 면 미러 dir(W/SW/NW) 의 flipbook 키는 만들지 않음 — DataAsset 의 `Flipbooks` 맵 키를 8개 다 채울 필요 없음. 런타임이 fallback 처리.

6. **`UHktPaperCharacterTemplate` upsert**
   - `DA_PaperCharacter_{SafeChar}` 가 이미 있으면 로드, 없으면 신규.
   - `Template->IdentifierTag = CharacterTag` (HktTagDataAsset 컨벤션 — `UHktAssetSubsystem::LoadAssetAsync` 가 이걸로 발견).
   - `Template->PixelToWorld = PixelToWorld;`
   - `Template->Animations.Add(AnimTag, FHktPaperAnimMeta{...})` (이미 있으면 덮어쓰기).
   - 빌드된 dir 마다 `Template->Flipbooks.Add({AnimTag, DirIdx}, Flipbook)`.
   - `Template->MarkPackageDirty()`, save package.

7. **반환 JSON**
```json
{
  "success": true,
  "characterTag": "Sprite.Character.Knight",
  "animTag": "Anim.FullBody.Locomotion.Idle",
  "dataAssetPath": "/Game/Generated/PaperSprites/DA_PaperCharacter_Knight",
  "numDirections": 8,
  "framesPerDir": 6,
  "atlases":  ["/Game/Generated/PaperSprites/Atlases/T_PaperAtlas_Knight_FullBody_Loc_Idle_E", ...],
  "flipbooks":["/Game/Generated/PaperSprites/Flipbooks/PFB_Knight_FullBody_Loc_Idle_E", ...]
}
```

`BuildPaperCharacter(CharacterTag)` 는 워크스페이스 안의 모든 `{SafeAnim}` 디렉터리를 발견해 각각 `BuildPaperSpriteAnim` 을 반복 호출하는 일괄 진입점.

## 6. 머티리얼 — `M_HktPaperUnlit`

Paper2D 기본 머티리얼은 `Translucent + Lit` 형태라 우리 컨벤션(2D 픽셀 룩, alpha-test, 라이팅 무관)에 맞지 않는다. 신규로 `M_HktPaperUnlit` 를 자동 빌드:

- `Shading Model = Unlit`
- `Blend Mode = Masked`, OpacityMaskClipValue = 0.5
- `Two Sided = true`
- `Used With Sprite = true` (필수, 그렇지 않으면 패키징/PIE 에서 셰이더 컴파일 누락)
- 노드:
  - `BaseColor = ParticleColor * SpriteTexture.RGB`
  - `OpacityMask = SpriteTexture.A * ParticleColor.A`
- Texture 파라미터는 두지 않음 — Paper2D 가 `SpriteTexture` 매크로를 통해 `UPaperSprite::SourceTexture` 를 자동 바인딩.

`HktPaperUnlitMaterialBuilder.cpp` 에 `MaterialEditingLibrary` 로 코드 빌드. `HktSpriteBillboardMaterialBuilder.cpp` 와 동일 패턴.
콘솔 명령 `HktPaperSprite.BuildUnlitMaterial` 로 강제 재빌드 가능.

## 7. 런타임 — `UHktSpriteCrowdRenderer_Paper2D`

기존 `UHktSpriteCrowdRenderer`(HISM)와 같은 외부 시그니처. 내부 구조만 교체:

```cpp
UCLASS(ClassGroup=(HktSprite), meta=(BlueprintSpawnableComponent))
class HKTSPRITECORE_API UHktSpriteCrowdRenderer_Paper2D : public UActorComponent
{
    GENERATED_BODY()
public:
    UHktSpriteCrowdRenderer_Paper2D();

    void RegisterEntity(FHktEntityId Id);
    void UnregisterEntity(FHktEntityId Id);
    void SetCharacter(FHktEntityId Id, FGameplayTag CharacterTag);
    void UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update);
    void ClearAll();

    UPROPERTY(EditAnywhere, Category="HKT|Sprite", meta=(ClampMin="0.01"))
    float GlobalWorldScale = 1.f;

    UPROPERTY(EditAnywhere, Category="HKT|Sprite|Depth")
    float ComponentZBias = 0.f;

private:
    struct FEntityState
    {
        FGameplayTag CharacterTag;
        FGameplayTag CurrentAnimTag;
        uint8        CurrentDirIdx = 0xFF;
        bool         bMirrored = false;
        TWeakObjectPtr<UPaperFlipbookComponent> Comp;
        EHktSpriteUpdateStatus LastUpdateStatus = EHktSpriteUpdateStatus::OK;
    };

    UPROPERTY(Transient)
    TMap<FGameplayTag, TObjectPtr<UHktPaperCharacterTemplate>> TemplateCache;

    TMap<FHktEntityId, FEntityState> Entities;
    TSet<FGameplayTag> PendingTemplateLoads;

    UPaperFlipbookComponent* GetOrCreateComponent(FHktEntityId Id, FEntityState& State);
    void RequestTemplateLoad(FGameplayTag Tag);
};
```

### `UpdateEntity` 핵심 흐름

```
1. State, Template 검증 (HISM 버전과 동일 — EHktSpriteUpdateStatus 재사용)
2. HktResolveSpriteFrame(In) 으로 (DirIdx, FrameIdx, bFlipX) 결정
3. AnimMeta = Template->Animations[Update.AnimTag]
4. KeyDir = bFlipX ? 미러원본Dir : DirIdx          (W→E, SW→SE, NW→NE)
   - bFlipX 이고 AnimMeta.bMirrorWestFromEast 면 컴포넌트 X-scale = -1
5. Flipbook = Template->Flipbooks.Find({AnimTag, KeyDir})
   - 못 찾으면 fallback: 같은 AnimTag 의 가장 가까운 dir
6. Component = GetOrCreateComponent(Id, State)
7. (AnimTag/KeyDir 변경 시에만) Component->SetFlipbook(Flipbook); Component->SetLooping(AnimMeta.bLooping);
8. ElapsedSec = (NowTick - AnimStartTick) * TickDurationMs * 0.001f * PlayRate
9. Component->SetPlaybackPositionInFrames(Frame_or_Time, /*bFireEvents=*/false)
   - 또는 SetPlaybackPosition(ElapsedSec, false). 기존 FrameResolver 결과를
     무시하고 Paper2D 내부 시간축에 맡길지 / 직접 frame 강제할지는 5.x 에서 선택.
10. SetWorldTransform(Update.WorldLocation, Rotation=0, Scale=({-1 if mirror else +1}, 1, 1) * AnimMeta.Scale)
11. SetSpriteColor(AnimMeta.Tint * Update.TintOverride)
12. ZBias: AddRelativeLocation(CameraDirCm * (Update.ZBias + ComponentZBias)) 또는 TranslucencySortPriority
```

### 컴포넌트 라이프사이클

- `RegisterEntity`: state만 생성. 컴포넌트는 첫 `UpdateEntity` 에서 lazy.
- `UnregisterEntity`: `Comp->DestroyComponent()`, state 제거.
- `ClearAll`: 모든 컴포넌트 destroy, 맵 비움.
- `SetCharacter`: 캐릭터 바뀌면 컴포넌트는 유지(Flipbook 만 다음 update 에서 교체) — destroy 비용 회피.

### 빌보드

`UPaperFlipbookComponent` 의 SpriteAlignment 옵션은 정적이라 카메라 추종이 없다. 두 갈래:

**옵션 R-1 (권장)**: Owner Actor 의 `bAlwaysFaceCamera` 플래그 또는 컴포넌트 매 프레임 `SetWorldRotation(CameraYawAroundZ)` — Y-axis billboard 와 동일한 효과. `AHktSpriteCrowdHost::OnCameraViewChanged` 가 이미 카메라 yaw 를 받고 있으니 그 값을 렌더러에 dispatch.

**옵션 R-2**: 머티리얼에 World Position Offset 추가 — 결국 HISM 경로의 단점이 재현됨. 비채택.

## 8. CVar dispatch / 호스트 변경

`AHktSpriteCrowdHost` 가 현재 `Renderer = CreateDefaultSubobject<UHktSpriteCrowdRenderer>(...)` 로 HISM 을 직접 보유. 다음과 같이 변경(별도 PR):

1. `IHktSpriteCrowdRenderer` (UInterface) — 기존 5개 메서드 + `OnCameraViewChanged(yaw)` 노출.
2. HISM/Niagara/Paper2D 세 컴포넌트 모두 인터페이스 구현.
3. `AHktSpriteCrowdHost::BeginPlay` 에서 `IConsoleVariable* CV = IConsoleManager::Get().FindConsoleVariable(TEXT("hkt.Sprite.Renderer"))` 값으로 분기 — 0/1/2.
4. 기존 PIE 디폴트는 0 (HISM) 유지 — 변동성 없음.

## 9. 워크스페이스 입력 의존성 (수정 금지 영역과의 경계)

| 호출하는 것 | 어디서 | 수정 가능? |
|---|---|---|
| `UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot` | static, BlueprintCallable | 호출만, 수정 금지 |
| `... ::GetConventionDirectionalBundleDir` | static, BlueprintCallable | 호출만 |
| `... ::GetConventionDirectionalAtlasPng` | static, BlueprintCallable | 호출만 |
| `... ::BuildSpriteAnim` / `EditorPackDirectionalAtlases` 등 | — | 호출도 안 함(병렬 파이프라인) |
| `atlas_meta.json` 포맷 | generator 가 작성 | 읽기만 |

generator 의 `.cpp` / `.h` / 패널 / MCP 함수 시그니처는 일체 손대지 않음. `HktPaper2DGenerator` 가 generator 의 워크스페이스 컨벤션과 결합도가 높다는 점은 트레이드오프 — 컨벤션이 깨지면(generator 측 변경) Paper2D 빌더도 같이 깨진다. 이는 받아들이고, 컨벤션이 변경될 때만 양쪽 동기화.

## 10. 트레이드오프 / 위험

- **자산 폭증**: 캐릭터 1명 = `Animations × Directions × FramesPerDir` 개의 `UPaperSprite`. 8 × 6 × 10 = 480 자산. 디스크/패키지 크기 무시 못함. 실제 운영은 미러 절약(8→5)으로 평균 60% 수준. 필요 시 PR-3 에서 `UPaperSprite` 를 메모리 전용(Transient package)으로 만들고 디스크엔 `UPaperFlipbook` 만 저장하는 옵션 추가.
- **인스턴싱 부재**: 엔터티 1명 = 컴포넌트 1개 + 드로콜. 1000 엔터티 시 무거움. 기획상 본 렌더러는 *대규모 크라우드 외* 용도에 한정.
- **빌보드 회전 비용**: 매 프레임 컴포넌트별 `SetWorldRotation` — 1000개에서는 SceneProxy 갱신 비용 누적. R-1 채택 시 카메라 yaw 변화량이 임계 이상일 때만 갱신하는 dirty check 필요.
- **머티리얼 한 종류**: 셰이더 변형은 Tint/SpriteColor 외 없음. 현 HISM 의 PaletteIndex(slot 13) 같은 확장은 미지원. 도입 시 머티리얼 파라미터 컬렉션 / MID 추가 필요.
- **기존 FrameResolver 와의 시간축**: HISM 경로는 `HktResolveSpriteFrame` 결과 `FrameIndex` 를 직접 GPU 로 보냈다. Paper2D 는 자체 시간축이 있어 `SetPlaybackPosition(elapsedSec)` 으로 위임하면 결과가 미묘하게 다를 수 있다(loop wrap, 마지막 프레임 hold 등). 공정 비교를 위해 1차 PR 에서는 `SetPlaybackPositionInFrames(FrameIdx, false)` 로 명시 강제 — Paper2D 기본 동작과 차이 없음을 확인한 뒤 `SetPlaybackPosition` 으로 단순화 검토.

## 11. PR 분할

- **PR-1 — 빌더 + 데이터 모델**
  - 신규 `HktPaper2DGenerator` 모듈
  - 신규 `UHktPaperCharacterTemplate` (HktSpriteCore 헤더만 추가)
  - `UHktPaperSpriteBuilderFunctionLibrary::BuildPaperSpriteAnim / BuildPaperCharacter`
  - `M_HktPaperUnlit` 자동 빌더 + 콘솔 명령
  - 콘솔 진입점: `HktPaperSprite.BuildCharacter <CharacterTag>`
  - 런타임 변경 0.

- **PR-2 — 런타임 렌더러**
  - 신규 `UHktSpriteCrowdRenderer_Paper2D`
  - `IHktSpriteCrowdRenderer` 인터페이스 + 세 렌더러 모두 구현
  - `AHktSpriteCrowdHost` 의 CVar dispatch
  - PIE 디폴트는 HISM 유지 (`hkt.Sprite.Renderer 0`)

- **PR-3 — 옵션**
  - `SHktPaperSpriteBuilderPanel` (기존 `SHktSpriteBuilderPanel` UX 미러)
  - MCP Python 도구 `editor_build_paper_sprite_character`
  - 자산 메모리 전용화 옵션
  - 카메라 yaw dirty check 최적화

## 12. 검증 방법

- **PR-1 단위 테스트**
  - Knight 캐릭터 워크스페이스에 미리 만들어둔 atlas_*.png + atlas_meta.json 으로 `BuildPaperCharacter` 실행 → DataAsset/Sprite/Flipbook 자산 발견되는지 AssetRegistry 쿼리.
  - `atlas_meta.json` 부재 / cellW=0 / 비정수 frameCount 등 입력 결함에서 실패 JSON 반환 확인.
  - 같은 anim 재실행 시 자산 덮어쓰기(이름 충돌 0).

- **PR-2 비주얼 회귀**
  - 동일 맵에서 `hkt.Sprite.Renderer 0/1/2` 토글하며 스크린샷 비교.
  - 렌더러 사이 전환 시 잔존 컴포넌트 / 인스턴스 누수 0 (`stat MemoryDetailed`).
  - 1000 엔터티 PIE 에서 Paper2D 경로 FPS 측정 — 의도된 워스트 수치 문서화.

- **이벤트 로그**
  - 기존 `EHktSpriteUpdateStatus` 코드와 `HKT_EVENT_LOG_ENTITY` 를 그대로 재사용해 동일 진단 흐름 유지.

## 13. 미해결 / 후속 결정 필요

- 자산 출력 루트 `/Game/Generated/PaperSprites` 가 좋은지, `Project Settings > HKT > ConventionRootDirectory` 와 어떻게 결합할지.
- `bMirrorWestFromEast` 디폴트 — 현재 generator 디폴트와 일치(true) 가정. 캐릭터별로 다르면 워크스페이스 사이드카에 명시 필요.
- 셀 메타 폴백 우선순위 — 현재 (atlas_meta.json > 인자 > 종횡비). 인자 우선이 더 나은 캐릭터(예: 고정 셀 그리드)가 있다면 옵션 플래그 추가.
- `UHktAssetSubsystem` 가 Paper2D DataAsset 도 동일하게 취급할 수 있는지 확인 — `IdentifierTag` 기반 발견은 동일 동작 예상.
