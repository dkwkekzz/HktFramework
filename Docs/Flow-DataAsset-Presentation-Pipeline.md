# Flow → DataAsset → Presentation 파이프라인

Flow에서 정의한 태그가 DataAsset을 거쳐 Presentation에서 시각화되기까지의 전체 공정을 정리한다.

---

## 전체 흐름 요약

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Story 정의 (HktStory)                                         │
│     Flow에서 사용할 태그를 UE_DEFINE_GAMEPLAY_TAG로 선언          │
│     ex) Entity.Character.Player, Anim.Montage.Attack, VFX.Spawn │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. DataAsset 등록 (UE 에디터)                                   │
│     UHktTagDataAsset 파생 에셋을 에디터에서 생성                  │
│     IdentifierTag에 Flow에서 사용한 태그를 지정                   │
│     ex) DA_PlayerCharacter.IdentifierTag = "Entity.Character.Player"│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 에셋 스캔 (UHktAssetSubsystem)                               │
│     게임 시작 시 Asset Registry에서 모든 UHktTagDataAsset 스캔    │
│     Tag → SoftObjectPath 매핑 테이블 구축                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. VM 실행 → WorldState 기록 (HktCore)                          │
│     SpawnEntity 명령이 EntitySpawnTag 프로퍼티에 태그 인덱스 기록 │
│     PlayAnim/PlayAnimMontage가 AnimState/VisualState 기록        │
│     PlayVFXAttached가 엔티티에 VFX 태그 추가                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Presentation 소비 (HktPresentation)                          │
│     WorldView Diff → PresentationState 갱신                      │
│     Renderer가 Tag → DataAsset 비동기 로드 → UE5 시각화          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1단계: Flow 정의에서 태그 선언

Flow 정의 파일(`HktStory/Private/Definitions/*.cpp`)에서 GameplayTag를 선언하고 Flow 바이트코드에서 사용한다.

### 태그 카테고리별 역할

| 태그 접두사 | 용도 | Flow에서의 사용처 | Presentation에서의 소비 |
|---|---|---|---|
| `Entity.*` | 엔티티 시각 식별자 | `.SpawnEntity(Type, Tag)` | `FHktActorRenderer` → `UHktActorVisualDataAsset` 로드 |
| `Anim.*` | 루프 애니메이션 상태 | `.PlayAnim(Entity, Tag)` | `UHktAnimInstance::SetAnimStateTag()` |
| `Anim.Montage.*` | 원샷 몽타주 | `.PlayAnimMontage(Entity, Tag)` | `UHktAnimInstance::PlayMontageByTag()` |
| `VFX.*` | 이펙트 | `.PlayVFXAttached(Entity, Tag)` | `FHktVFXRenderer::PlayVFXAtLocation()` |
| `Sound.*` | 사운드 | `.PlaySound(Tag)` | (TODO) |
| `Entity.Item.*` | 아이템/장비 | `.SpawnEntity(Tag)` + EquipIndex 프로퍼티 | `AHktItemActor` 렌더링, `AttachSocketName`으로 캐릭터 소켓 부착 |

### 예시: HktStoryCharacterSpawn.cpp

```cpp
namespace HktStoryCharacterSpawn
{
    // 태그 선언 — 이 태그들이 DataAsset의 IdentifierTag와 1:1 매칭
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Character_Player, "Entity.Character.Player", "...");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_Spawn,             "Anim.Spawn",              "...");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Anim_Montage_Intro,     "Anim.Montage.Intro",      "...");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_SpawnEffect,        "VFX.Niagara.SpawnEffect", "...");
    UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_Sword,      "Entity.Item.Sword",       "...");

    HKT_REGISTER_STORY_BODY()
    {
        Story(Story_CharacterSpawn)
            .SpawnEntity(Entity_Character_Player)                 // → ClassTag 영구 부여 + EntitySpawnTag에 기록
            .PlayVFXAttached(Self, VFX_SpawnEffect)               // → 엔티티에 VFX 태그 추가
            .AddTag(Self, Tag_Anim_FullBody_Action_Spawn)         // → 태그 기반 애니메이션 자동 재생
            .AddTag(Self, Tag_Anim_Montage_Intro)                 // → 태그 기반 몽타주 자동 재생
            .SpawnEntity(Entity_Item_Sword)                        // → 아이템 엔티티 생성 (Entity로 통합)
            .Halt()
            .BuildAndRegister();
    }
}
```

---

## 2단계: DataAsset 생성 (UE 에디터 작업)

Flow에서 선언한 태그마다 대응하는 DataAsset을 에디터에서 생성한다.

### DataAsset 클래스 계층

```
UPrimaryDataAsset
  └─ UHktTagDataAsset                    (IdentifierTag: FGameplayTag)
       ├─ UHktActorVisualDataAsset       (ActorClass, MontageMappings)
       ├─ UHktVFXVisualDataAsset         (NiagaraSystem)
       ├─ UHktWidgetLoginHudDataAsset    (UI 팩토리)
       ├─ UHktWidgetIngameHudDataAsset   (UI 팩토리)
       └─ UHktWidgetEntityHudDataAsset   (UI 팩토리)
```

### 태그별 DataAsset 매칭 규칙

| Flow 태그 | DataAsset 클래스 | 에디터에서 설정할 내용 |
|---|---|---|
| `Entity.Character.Player` | `UHktActorVisualDataAsset` | ActorClass = BP_PlayerCharacter, MontageMappings = [{Anim.Montage.Attack → AM_Attack}, ...] |
| `VFX.SpawnEffect` | `UHktVFXVisualDataAsset` | NiagaraSystem = NS_SpawnEffect |
| `VFX.HitSpark` | `UHktVFXVisualDataAsset` | NiagaraSystem = NS_HitSpark |

### UHktActorVisualDataAsset 구조

```cpp
UCLASS(BlueprintType)
class UHktActorVisualDataAsset : public UHktTagDataAsset
{
    // 이 시각 태그에 대응하는 액터/블루프린트
    UPROPERTY(EditDefaultsOnly) TSubclassOf<AActor> ActorClass;

    // 애니메이션 태그 → 몽타주 매핑 (스폰 시 AnimInstance에 주입)
    UPROPERTY(EditDefaultsOnly) TArray<FHktAnimMontageEntry> MontageMappings;
};
```

> **핵심**: `IdentifierTag`가 Flow의 `SpawnEntity` 태그와 정확히 일치해야 한다.
> Flow가 `Entity.Character.Player`로 엔티티를 생성하면,
> `IdentifierTag = "Entity.Character.Player"`인 DataAsset이 로드된다.

---

## 3단계: 에셋 인덱싱 (UHktAssetSubsystem)

게임 인스턴스 초기화 시 자동으로 수행된다.

```
UHktAssetSubsystem::Initialize()
  └─ RebuildTagMap()
       ├─ FAssetRegistryModule에서 UHktTagDataAsset 전체 검색
       ├─ 각 에셋의 IdentifierTag 메타데이터 추출 (에셋 로드 없이)
       └─ TagToPathMap[Tag] = SoftObjectPath 구축
```

이후 어디서든 태그로 에셋을 요청할 수 있다:

```cpp
// 동기
UHktTagDataAsset* Asset = AssetSubsystem->LoadAssetSync(Tag);

// 비동기
AssetSubsystem->LoadAssetAsync(Tag, [](UHktTagDataAsset* Asset) { ... });
```

---

## 4단계: VM 실행 → WorldState 프로퍼티 기록

Flow VM이 바이트코드를 실행하면서 WorldState에 프로퍼티를 기록한다.
이 프로퍼티들이 Presentation 계층의 입력이 된다.

### 프로퍼티 매핑 (VM → WorldState → Presentation)

| VM 명령 | WorldState PropertyId | PresentationViewModel 필드 | Renderer 처리 |
|---|---|---|---|
| `SpawnEntity(Type, Tag)` | `EntitySpawnTag(22)` | `Visualization.VisualElement` | ActorRenderer → DataAsset 로드 → Actor 스폰 |
| `PlayAnim(Entity, Tag)` | `AnimState(40)` | `Animation.AnimState` | AnimInstance.SetAnimStateTag() |
| `PlayAnimMontage(Entity, Tag)` | `VisualState(41)` | `Animation.MontageState` | AnimInstance.PlayMontageByTag() |
| `PlayVFXAttached(Entity, Tag)` | 엔티티 태그 컨테이너 | TagDelta로 전달 | VFXRenderer.PlayVFXAtLocation() |
| `SetPosition(Entity, R0)` | `PosX/Y/Z(0-2)` | `Transform.Location` | ActorRenderer.UpdateMotionTarget() |
| `MoveToward(Entity, Target, Speed)` | `IsMoving(8)` | `Movement.bIsMoving` | AnimInstance.bIsMoving |

### VM 내부 동작 상세

**SpawnEntity**: 엔티티 할당 후 `EntitySpawnTag` 프로퍼티에 태그 문자열의 인덱스를 기록

```cpp
// HktVMInterpreterActions.cpp:36
Runtime.Context->WriteEntity(NewEntity, PropertyId::EntitySpawnTag, StringIndex);
```

**PlayAnim**: VMProxy를 통해 AnimState를 dirty 마킹

```cpp
// HktVMInterpreterActions.cpp:256
VMProxy->SetPropertyDirty(*WorldState, E, PropertyId::AnimState, TagNetIndex);
```

**PlayVFXAttached**: 엔티티의 태그 컨테이너에 VFX 태그 추가

```cpp
// HktVMInterpreterActions.cpp:297
VMProxy->AddTag(*WorldState, Runtime.GetRegEntity(Entity), Tag);
```

---

## 5단계: Presentation에서 소비

### 5-1. WorldView → PresentationState 변환

```
OnWorldViewUpdated(FHktWorldView)
  ├─ ProcessDiff()
  │   ├─ ForEachSpawned  → State.AddEntity()
  │   │   └─ FHktVM_Visualization::Apply()
  │   │       └─ VisualElement.Set(IndexToTag(EntitySpawnTag), Frame)
  │   ├─ ForEachDelta    → State.ApplyDelta()
  │   │   ├─ PropertyId::AnimState      → Animation.AnimState.Set(Tag, Frame)
  │   │   ├─ PropertyId::VisualState    → Animation.MontageState.Set(Tag, Frame)
  │   │   └─ PropertyId::EntitySpawnTag → Visualization.VisualElement.Set(Tag, Frame)
  │   └─ ForEachTagDelta → VFX 태그 감지
  │       └─ "VFX.*" 접두사 신규 태그 → VFXRenderer.PlayVFXAtLocation()
  └─ SyncRenderers()
```

### 5-2. ActorRenderer: Entity 태그 → DataAsset → Actor 스폰

```
FHktActorRenderer::Sync(State)
  └─ SpawnedThisFrame 순회
      └─ SpawnActor(Entity)
          ├─ VisualTag = Entity.Visualization.VisualElement.Get()
          │   // "Entity.Character.Player"
          ├─ UHktAssetSubsystem::LoadAssetAsync(VisualTag, ...)
          │   // TagToPathMap에서 SoftObjectPath 찾아 비동기 로드
          └─ 콜백:
              ├─ Cast<UHktActorVisualDataAsset>(LoadedAsset)
              ├─ World->SpawnActor(VisualAsset->ActorClass)
              └─ HktAnim->InitMontageMappings(VisualAsset->MontageMappings)
                  // DataAsset의 몽타주 매핑을 AnimInstance에 주입
```

### 5-3. Animation: Anim 태그 → AnimInstance 전달

```
FHktActorRenderer::UpdateAnimation(Id, Entity, Frame)
  ├─ Animation.AnimState.IsDirty(Frame)?
  │   └─ HktAnim->SetAnimStateTag(AnimTag)     // 루프 애니메이션
  └─ Animation.MontageState.IsDirty(Frame)?
      └─ HktAnim->PlayMontageByTag(MontageTag) // 원샷 몽타주
          └─ FindMontage(Tag)
              // InitMontageMappings에서 주입받은 매핑에서 Tag로 검색
```

### 5-4. VFX: VFX 태그 → Niagara 스폰

```
ProcessDiff → ForEachTagDelta
  └─ "VFX.*" 접두사의 새 태그 감지
      └─ VFXRenderer->PlayVFXAtLocation(Tag, Position)
          ├─ Tag 기반: UHktAssetSubsystem → UHktVFXVisualDataAsset → NiagaraSystem
          └─ Intent 기반: UHktVFXAssetBank → 퍼지 매칭 (Element/Intensity)
```

---

## 새 게임 흐름 추가 시 체크리스트

Flow에서 새로운 태그를 사용할 때, Presentation에서 올바르게 시각화되려면 다음을 확인한다.

### Entity 태그 (SpawnEntity)

- [ ] Flow 정의 파일에 `UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_XXX, "Entity.XXX", "...")` 선언
- [ ] UE 에디터에서 `UHktActorVisualDataAsset` 생성
  - [ ] `IdentifierTag` = `"Entity.XXX"` (Flow 태그와 정확히 일치)
  - [ ] `ActorClass` = 스폰할 블루프린트/액터 클래스 지정
  - [ ] `MontageMappings` = 이 엔티티가 사용할 몽타주 태그 → 몽타주 매핑

### Anim/Montage 태그

- [ ] Flow 정의 파일에 `Anim.*` 또는 `Anim.Montage.*` 태그 선언
- [ ] 해당 엔티티의 `UHktActorVisualDataAsset.MontageMappings`에 태그 → 몽타주 엔트리 추가
- [ ] AnimBP에서 `UHktAnimInstance`를 사용하도록 설정

### VFX 태그

- [ ] Flow 정의 파일에 `VFX.*` 태그 선언
- [ ] UE 에디터에서 `UHktVFXVisualDataAsset` 생성
  - [ ] `IdentifierTag` = `"VFX.XXX"`
  - [ ] `NiagaraSystem` = 재생할 Niagara 시스템 지정

### Sound 태그

- [ ] 현재 TODO 상태 — VM에서 Log만 출력, Presentation 소비 미구현

### Item 태그 (Entity.Item.*)

- [ ] Flow 정의 파일에 `UE_DEFINE_GAMEPLAY_TAG_COMMENT(Entity_Item_XXX, "Entity.Item.XXX", "...")` 선언
- [ ] UE 에디터에서 `UHktActorVisualDataAsset` 생성
  - [ ] `IdentifierTag` = `"Entity.Item.XXX"` (Flow 태그와 정확히 일치)
  - [ ] `ActorClass` = 스폰할 블루프린트/액터 클래스 지정
- [ ] `AttachSocketName` = 캐릭터에 부착할 소켓 이름 지정 (예: `weapon_r`, `shield_l`)
- [ ] Flow에서 `SpawnEntity(Entity_Item_XXX)` 사용, EquipIndex 등은 프로퍼티로 설정

---

## 핵심 파일 참조

| 계층 | 파일 | 역할 |
|---|---|---|
|  **Story** | `HktStory/Private/Definitions/*.cpp` | 태그 선언 + Flow 바이트코드 정의 |
| **DataAsset** | `HktAsset/Public/HktTagDataAsset.h` | 태그 기반 에셋 베이스 클래스 |
| **DataAsset** | `HktAsset/Public/HktAssetSubsystem.h` | 태그 → 에셋 매핑 및 로딩 |
| **DataAsset** | `HktPresentation/Private/DataAssets/HktActorVisualDataAsset.h` | 엔티티 시각화 에셋 |
| **DataAsset** | `HktPresentation/Private/DataAssets/HktVFXVisualDataAsset.h` | VFX 시각화 에셋 |
| **VM** | `HktCore/Private/VM/HktVMInterpreterActions.cpp` | VM 명령 → WorldState 기록 |
| **Presentation** | `HktPresentation/Public/HktPresentationViewModels.h` | ViewModel 그룹 정의 |
| **Presentation** | `HktPresentation/Private/HktPresentationSubsystem.cpp` | WorldView → State 변환 |
| **Presentation** | `HktPresentation/Private/Renderers/HktActorRenderer.cpp` | Tag → DataAsset → Actor |
| **Presentation** | `HktPresentation/Public/HktAnimInstance.h` | 태그 기반 애니메이션 처리 |

---

## 설계 원칙

| 원칙 | 적용 |
|---|---|
| **태그가 유일한 연결고리** | Flow와 Presentation은 GameplayTag로만 연결되며, 직접 참조 없음 |
| **에셋 로드 없는 인덱싱** | Asset Registry 메타데이터로 태그 매핑, 실제 로드는 필요 시점에 비동기로 |
| **서버-클라이언트 분리** | VM(서버)은 태그 인덱스를 WorldState에 기록, Presentation(클라이언트)은 이를 읽어 시각화 |
| **DataAsset이 시각 정책의 단일 진실** | Actor 클래스, 몽타주 매핑, Niagara 시스템 등 모든 시각 정책은 DataAsset에 집중 |
