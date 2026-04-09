# Niagara 기반 Skeletal Mesh Deconstruction Visual System - 구현 설계

## Context

보스/특수 NPC 및 Mythic 등급 스킨을 위한 "점/결정체/에너지로 해체-재구성되는 캐릭터" 비주얼 시스템.
기존 복셀 렌더링과 별개의 프레젠테이션 경로로, `AHktUnitActor`의 SkeletalMeshComponent 위에
Niagara 파티클 레이어를 얹어 동적 비주얼을 구현한다.

**핵심 원칙**: 기존 ISP(Intent-Simulation-Presentation) 아키텍처를 준수하며,
새로운 모듈 추가 없이 HktPresentation 모듈 내에서 구현한다.

---

## 1. 아키텍처 결정

### 1.1 새 모듈 vs 기존 모듈 → HktPresentation 내 구현

- Deconstruction은 순수 프레젠테이션 레이어 로직이다
- 이미 HktPresentation이 Niagara, HktVFX에 의존하고 있다
- 별도 모듈을 만들면 HktPresentation과 양방향 의존이 발생할 위험이 있다
- **결론**: `Source/HktPresentation/` 내에 `Deconstruct/` 서브디렉토리로 구현

### 1.2 Renderer vs Actor 내장 → Actor 내장 방식

- `FHktDeconstructRenderer`를 별도로 만들면 Actor lifecycle 관리가 FHktActorRenderer와 중복된다
- 대신 **`AHktDeconstructUnitActor`** (AHktUnitActor의 서브클래스 또는 독립 Actor)를 만들어
  기존 `FHktActorRenderer`가 스폰/관리하도록 한다
- ActorVisualDataAsset의 ActorClass 필드에 `AHktDeconstructUnitActor`를 지정하면
  기존 파이프라인이 자동으로 작동한다

### 1.3 Element 매핑

기존 `EHktVFXElement`(12종)에서 Deconstruction에 사용할 5종을 매핑:

| R&D Element | EHktVFXElement | 비고 |
|-------------|----------------|------|
| Fire | Fire | 직접 매핑 |
| Ice | Ice | 직접 매핑 |
| Lightning | Lightning | 직접 매핑 |
| Void | Dark | Dark를 Void로 해석 |
| Nature | Nature | 직접 매핑 |

나머지 7종(Water, Earth, Wind, Holy, Poison, Arcane, Physical)은 Phase 0에서는
가장 가까운 5종 중 하나로 fallback한다.

---

## 2. 파일 구조

```
Source/HktPresentation/
├── Public/
│   └── Deconstruct/
│       ├── HktDeconstructTypes.h          — Enum, 구조체 (FHktDeconstructParams, EHktDeconstructElement)
│       └── HktDeconstructVisualDataAsset.h — Element별 팔레트/메시 설정 DataAsset
├── Private/
│   └── Deconstruct/
│       ├── HktDeconstructUnitActor.h       — Actor 헤더
│       ├── HktDeconstructUnitActor.cpp     — Actor 구현
│       ├── HktDeconstructParamController.h — Niagara 파라미터 브릿지 컴포넌트
│       └── HktDeconstructParamController.cpp
```

총 **6개 파일** 신규 생성. 기존 파일 수정은 최소화.

---

## 3. 클래스 설계

### 3.1 FHktDeconstructParams (HktDeconstructTypes.h)

Niagara User Parameter로 전달할 모든 런타임 상태를 담는 구조체.

```cpp
USTRUCT(BlueprintType)
struct FHktDeconstructParams
{
    GENERATED_BODY()

    // 형태 유지도 (1=원형, 0=완전 분해). Health 연동.
    float Coherence = 1.0f;

    // 포인트 이탈 거리(cm). 분해/조립 연출 핵심.
    float PointScatter = 0.0f;

    // 포인트 표시 비율 (0~1). HealthRatio 연동.
    float PointDensity = 1.0f;

    // 파편 회전/노이즈 강도 (0~1). 전투 상태 연동.
    float Agitation = 0.0f;

    // 기본 발광 색상 (팔레트 Primary)
    FLinearColor BaseColor = FLinearColor::White;

    // 맥동 속도(Hz)
    float PulseRate = 1.0f;

    // 잔상 지속 시간(초)
    float TrailLifetime = 0.05f;

    // 리본 폭 배율
    float RibbonWidthMult = 1.0f;

    // 리본 Emissive 배율
    float RibbonEmissiveMult = 1.0f;

    // Aura 속도 배율
    float AuraVelocityMult = 1.0f;

    // Aura 스폰 레이트 배율
    float AuraSpawnRateMult = 1.0f;

    // GeoFragment 스케일 배율
    float FragmentScaleMult = 1.0f;
};
```

### 3.2 EHktDeconstructElement (HktDeconstructTypes.h)

```cpp
UENUM(BlueprintType)
enum class EHktDeconstructElement : uint8
{
    Fire,
    Ice,
    Lightning,
    Void,
    Nature,
    Count UMETA(Hidden)
};
```

`EHktVFXElement` → `EHktDeconstructElement` 변환 헬퍼 함수:
```cpp
EHktDeconstructElement MapVFXElementToDeconstruct(EHktVFXElement InElement);
```

### 3.3 UHktDeconstructVisualDataAsset (DataAsset)

Element별 비주얼 설정을 에디터에서 관리하는 DataAsset.

```cpp
UCLASS(BlueprintType)
class UHktDeconstructVisualDataAsset : public UHktTagDataAsset
{
    GENERATED_BODY()
public:
    // Niagara System (NS_HktDeconstruct)
    UPROPERTY(EditDefaultsOnly, Category="Deconstruct")
    TObjectPtr<UNiagaraSystem> DeconstructSystem;

    // CoreGlow Material (M_HktDeconstruct_CoreGlow)
    UPROPERTY(EditDefaultsOnly, Category="Deconstruct")
    TObjectPtr<UMaterialInterface> CoreGlowMaterial;

    // Element별 팔레트 설정
    UPROPERTY(EditDefaultsOnly, Category="Deconstruct|Palette")
    TArray<FHktDeconstructPalette> ElementPalettes;  // Count=5, indexed by EHktDeconstructElement

    // GeoFragment 메시 (Element별)
    UPROPERTY(EditDefaultsOnly, Category="Deconstruct|Fragment")
    TArray<TObjectPtr<UStaticMesh>> FragmentMeshes;  // Count=5, indexed by EHktDeconstructElement
};

USTRUCT(BlueprintType)
struct FHktDeconstructPalette
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere) FLinearColor Primary;
    UPROPERTY(EditAnywhere) FLinearColor Secondary;
    UPROPERTY(EditAnywhere) FLinearColor Accent;
};
```

### 3.4 AHktDeconstructUnitActor (핵심 Actor)

`AHktUnitActor`를 상속하여 NiagaraComponent를 추가하고, Deconstruction 비주얼을 관리.

```cpp
UCLASS(Blueprintable)
class AHktDeconstructUnitActor : public AHktUnitActor
{
    GENERATED_BODY()
public:
    AHktDeconstructUnitActor();

    // IHktPresentableActor override
    virtual void ApplyPresentation(const FHktEntityPresentation& Entity,
        int64 Frame, bool bForceAll,
        TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) override;

    virtual void Tick(float DeltaTime) override;

protected:
    // Niagara Component (NS_HktDeconstruct 바인딩)
    UPROPERTY(VisibleAnywhere, Category="HKT|Deconstruct")
    TObjectPtr<UNiagaraComponent> DeconstructNiagaraComponent;

private:
    // Param Controller (Niagara 파라미터 브릿지)
    UPROPERTY()
    TObjectPtr<UHktDeconstructParamController> ParamController;

    // 현재 Element (VisualElement 태그에서 파생)
    EHktDeconstructElement CurrentElement = EHktDeconstructElement::Fire;

    // 현재 파라미터 상태
    FHktDeconstructParams CurrentParams;

    // 이벤트 상태 (Lerp 타겟)
    FHktDeconstructParams TargetParams;

    // 이전 프레임 HealthRatio (변화 감지용)
    float PrevHealthRatio = 1.0f;

    // 스폰 연출 진행 중 플래그
    bool bSpawnAnimating = false;
    float SpawnAnimElapsed = 0.0f;

    void InitializeDeconstruct(const UHktDeconstructVisualDataAsset* DataAsset);
    void UpdateElement(EHktDeconstructElement NewElement, const UHktDeconstructVisualDataAsset* DataAsset);

    // 이벤트 핸들러 (ApplyPresentation에서 호출)
    void HandleDamage(float NewHealthRatio, float OldHealthRatio);
    void HandleDeath();
    void HandleSpawn();
};
```

### 3.5 UHktDeconstructParamController (파라미터 브릿지)

FHktDeconstructParams → Niagara User Parameter 일괄 전송을 캡슐화.

```cpp
UCLASS()
class UHktDeconstructParamController : public UActorComponent
{
    GENERATED_BODY()
public:
    void Initialize(UNiagaraComponent* InNiagaraComp);

    // 현재 파라미터를 Niagara에 Push
    void PushParams(const FHktDeconstructParams& Params);

    // Element 전환 시 팔레트/메시 변경
    void SetElement(EHktDeconstructElement Element,
                    const FHktDeconstructPalette& Palette,
                    UStaticMesh* FragmentMesh);

private:
    TWeakObjectPtr<UNiagaraComponent> NiagaraComp;

    // 캐시된 Niagara Parameter Names (매 프레임 FName 생성 방지)
    static const FName PN_Coherence;
    static const FName PN_PointScatter;
    static const FName PN_PointDensity;
    static const FName PN_Agitation;
    static const FName PN_BaseColor;
    static const FName PN_PulseRate;
    static const FName PN_TrailLifetime;
    static const FName PN_RibbonWidthMult;
    static const FName PN_RibbonEmissiveMult;
    static const FName PN_AuraVelocityMult;
    static const FName PN_AuraSpawnRateMult;
    static const FName PN_FragmentScaleMult;
    static const FName PN_SecondaryColor;
    static const FName PN_AccentColor;
};
```

---

## 4. VM State → Niagara 파라미터 매핑

`AHktDeconstructUnitActor::ApplyPresentation()`에서 처리:

| FHktEntityPresentation 필드 | Deconstruct 파라미터 | 변환 로직 |
|-----|-----|-----|
| `HealthRatio` | `Coherence` | 직접 매핑 (0~1) |
| `HealthRatio` | `PointDensity` | `FMath::Lerp(0.3f, 1.0f, HealthRatio)` |
| `HealthRatio` 변화량 | `Agitation` (스파이크) | 감소 시 `Clamp(DeltaHP * -5.0f, 0, 1)` → 0.5초 감쇠 |
| `Velocity` 크기 | `Agitation` (기본) | `Clamp(Speed / 600.0f, 0, 0.3)` |
| `VisualElement` | `CurrentElement` | `MapVFXElementToDeconstruct()` → 팔레트/메시 교체 |
| `IsAlive` false 전환 | `HandleDeath()` | Coherence→0, PointScatter→50 (2초 Lerp) |
| `SpawnedThisFrame` | `HandleSpawn()` | Coherence 0→1, PointScatter 50→0 (1.5초 Lerp) |
| `Tags` ("Anim.Skill.*") | 스킬 발동 | Ribbon/Fragment/Aura 스파이크 (0.3~0.5초) |

### 4.1 Tick에서의 Lerp 처리

```cpp
void AHktDeconstructUnitActor::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);  // 위치 보간

    // 스폰 애니메이션
    if (bSpawnAnimating) { ... }

    // Agitation 감쇠 (매 프레임)
    CurrentParams.Agitation = FMath::FInterpTo(
        CurrentParams.Agitation, TargetParams.Agitation, DeltaTime, 4.0f);

    // Death/Spawn 시 Coherence, PointScatter Lerp
    CurrentParams.Coherence = FMath::FInterpTo(
        CurrentParams.Coherence, TargetParams.Coherence, DeltaTime, 2.0f);
    CurrentParams.PointScatter = FMath::FInterpTo(
        CurrentParams.PointScatter, TargetParams.PointScatter, DeltaTime, 2.0f);

    // 스킬 스파이크 감쇠
    CurrentParams.RibbonWidthMult = FMath::FInterpTo(
        CurrentParams.RibbonWidthMult, TargetParams.RibbonWidthMult, DeltaTime, 6.0f);

    // Niagara에 Push
    if (ParamController)
        ParamController->PushParams(CurrentParams);
}
```

---

## 5. Niagara 에셋 구조 (에디터에서 생성)

C++ 코드가 참조할 Niagara User Parameter 이름 계약:

```
NS_HktDeconstruct (System)
├── User Parameters:
│   ├── float  Coherence          (0~1)
│   ├── float  PointScatter       (0~50)
│   ├── float  PointDensity       (0~1)
│   ├── float  Agitation          (0~1)
│   ├── Color  BaseColor
│   ├── Color  SecondaryColor
│   ├── Color  AccentColor
│   ├── float  PulseRate          (0~10)
│   ├── float  TrailLifetime      (0.02~0.15)
│   ├── float  RibbonWidthMult    (0~5)
│   ├── float  RibbonEmissiveMult (0~10)
│   ├── float  AuraVelocityMult   (0~5)
│   ├── float  AuraSpawnRateMult  (0~5)
│   ├── float  FragmentScaleMult  (0~3)
│   └── Object FragmentMesh       (StaticMesh)
│
├── [E1] CorePoints (GPU Compute)
│   └── Skeletal Mesh Location → Sprite Renderer (M_HktDeconstruct_PointGlow)
├── [E2] GeoFragments (GPU Compute)
│   └── Skeletal Mesh Location → Mesh Renderer (M_HktDeconstruct_GeoFragment)
├── [E3] EnergyRibbons (CPU, 5 체인)
│   └── Bone sampling → Ribbon Renderer (M_HktDeconstruct_EnergyRibbon)
├── [E4] SurfaceAura (GPU Compute)
│   └── Surface Random → Sprite Renderer (M_HktDeconstruct_AuraDot)
└── (E5는 Actor의 Material 교체로 처리, Niagara 외부)
```

---

## 6. 기존 코드 수정 사항 (최소)

### 6.1 HktPresentation.Build.cs
변경 없음. 이미 Niagara 의존성이 있다.

### 6.2 UHktPresentationSubsystem
변경 없음. `FHktActorRenderer`가 `UHktActorVisualDataAsset::ActorClass`에 지정된 
`AHktDeconstructUnitActor`를 자동으로 스폰한다.

### 6.3 FHktEntityPresentation
변경 없음. 기존 HealthRatio, VisualElement, Velocity, Tags 필드를 그대로 사용한다.

### 6.4 에디터에서 설정할 사항
- `UHktActorVisualDataAsset` 생성: IdentifierTag = `Entity.Character.Boss` (예시), ActorClass = `AHktDeconstructUnitActor`
- `UHktDeconstructVisualDataAsset` 생성: 팔레트, 메시, Niagara System 레퍼런스
- Niagara System 에셋 `NS_HktDeconstruct` 에디터에서 제작
- Material 에셋 5종 에디터에서 제작

---

## 7. Week별 실행 계획

### Week 1: 뼈대 (E1 + Actor 기본)

**신규 파일:**
- `Source/HktPresentation/Public/Deconstruct/HktDeconstructTypes.h`
- `Source/HktPresentation/Public/Deconstruct/HktDeconstructVisualDataAsset.h`
- `Source/HktPresentation/Private/Deconstruct/HktDeconstructUnitActor.h`
- `Source/HktPresentation/Private/Deconstruct/HktDeconstructUnitActor.cpp`
- `Source/HktPresentation/Private/Deconstruct/HktDeconstructParamController.h`
- `Source/HktPresentation/Private/Deconstruct/HktDeconstructParamController.cpp`

**구현 범위:**
1. `FHktDeconstructParams`, `EHktDeconstructElement`, `FHktDeconstructPalette` 타입 정의
2. `UHktDeconstructVisualDataAsset` 구현
3. `AHktDeconstructUnitActor` 기본 골격: 생성자(NiagaraComponent 추가), `ApplyPresentation()` override
4. `UHktDeconstructParamController`: `Initialize()`, `PushParams()` (Coherence, PointScatter, PointDensity, BaseColor만)
5. `HandleSpawn()`: PointScatter 50→0 Lerp
6. Tick에서 Lerp 처리 기본 구조

**에디터 작업:**
- NS_HktDeconstruct 생성 (E1 CorePoints만)
- M_HktDeconstruct_PointGlow Material
- M_HktDeconstruct_CoreGlow Material (E5)

**검증:**
- UE5 마네킹에 Deconstruct Actor 배치
- 애니메이션 재생 시 포인트 클라우드 추적 확인
- PointScatter 값 변경으로 분해/조립 확인

### Week 2: 존재감 (E2 GeoFragments)

**구현 범위:**
1. `PushParams()`에 Agitation, FragmentScaleMult 추가
2. `SetElement()`: Fragment 메시 교체, 팔레트 색상 전환
3. `HandleDamage()`: HealthRatio 변화 감지 → Agitation 스파이크
4. Element 전환 로직 (`VisualElement` dirty 감지)

**에디터 작업:**
- SM_HktGeo_Icosahedron, SM_HktGeo_Octahedron, SM_HktGeo_Tetrahedron, SM_HktGeo_CustomShard 메시 제작
- NS_HktDeconstruct에 E2 Emitter 추가
- M_HktDeconstruct_GeoFragment Material

**검증:**
- E1+E2 합산 비주얼 확인
- 5종 Element 전환 테스트
- 피격 시 Agitation 스파이크 확인

### Week 3: 생동감 (E3 Ribbons + E4 Aura)

**구현 범위:**
1. `PushParams()`에 RibbonWidthMult, RibbonEmissiveMult, AuraVelocityMult, AuraSpawnRateMult 추가
2. 스킬 발동 감지: `Tags` 중 `Anim.Skill.*` 패턴 → Ribbon/Aura 스파이크
3. `HandleDeath()`: Ribbon Width→0, Aura SpawnRate×3 구현

**에디터 작업:**
- NS_HktDeconstruct에 E3, E4 Emitter 추가
- M_HktDeconstruct_EnergyRibbon Material (UV Scroll + Noise)
- M_HktDeconstruct_AuraDot Material
- Post Process 볼륨 Bloom 조정

**검증:**
- 5 레이어 풀 스택 비주얼 확인
- 실루엣 가독성 테스트
- 스킬 발동 시 에너지 폭주 연출 확인

### Week 4: 제어 + LOD

**구현 범위:**
1. LOD 로직: `NeedsCameraSync()` override 또는 Tick에서 카메라 거리 계산
   - Niagara Scalability 설정으로 Emitter 활성화/비활성화
   - 또는 `UNiagaraComponent::SetVariableFloat("LODLevel", ...)` 방식
2. `OnDeath()` 완성: 2초 Lerp, SurfaceAura 폭발
3. `OnSpawn()` 완성: 1.5초 조립 + 0.5초 잔여 진동
4. 동시 다수 캐릭터 테스트

**검증:**
- 거리별 LOD 전환 확인
- 동시 5체 배치 프레임 측정
- OnDamage, OnDeath, OnSpawn, OnSkillActivate 전체 이벤트 테스트

---

## 8. 리스크 완화

| 리스크 | 완화 |
|--------|------|
| AHktUnitActor 상속 시 MeshComponent 접근 | `protected`로 변경 필요 시 최소 수정 |
| Niagara Skeletal Mesh Location이 상속 Actor에서 자동 바인딩 안 될 수 있음 | 생성자에서 명시적 `SetNiagaraVariableObject("SkeletalMeshComponent", MeshComponent)` |
| Element 전환 시 Niagara Emitter 재시작 비용 | FragmentMesh만 User Param으로 교체, 색상은 Color 파라미터로 즉시 전환 |
| 동시 20체 시 Draw Call 폭증 | Niagara GPU Instancing 기본 활성화 + LOD에서 E2 우선 제거 |
| MeshComponent가 Private 멤버 | AHktUnitActor에 `GetMeshComponent()` protected getter 추가 (1줄 수정) |

---

## 9. 기존 코드 최소 수정 목록

1. **`HktUnitActor.h`** (1줄): `MeshComponent`를 `protected`로 이동하거나 `GetMeshComponent()` getter 추가
2. **Build.cs**: 변경 없음 (Niagara 이미 의존)
3. **에디터**: DataAsset 2종 + Niagara System 1종 + Material 5종 + StaticMesh 4종 생성

---

## 10. 검증 방법

1. **컴파일**: `UnrealBuildTool` 성공 확인
2. **에디터 테스트**: 레벨에 `AHktDeconstructUnitActor` 배치, 애니메이션 재생 시 포인트 추적
3. **파라미터 테스트**: Details 패널에서 Coherence, PointScatter 실시간 조절
4. **이벤트 테스트**: Blueprint에서 HealthRatio 변경 → 피격/사망 연출 확인
5. **퍼포먼스**: `stat Niagara` 명령으로 파티클 수/GPU 비용 측정
6. **LOD**: 카메라 이동으로 거리별 Emitter 활성화 변화 확인
