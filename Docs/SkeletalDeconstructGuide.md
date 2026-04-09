**에디터 설정 과정**을 상세히 설명합니다.

---

## AHktDeconstructUnitActor 에디터 설정 가이드

전체 흐름은 **에셋 제작(5단계) → Blueprint 생성(2단계) → 런타임 연결(1단계)** 총 8단계입니다.

---

### Phase 1: 에셋 제작

#### Step 1. 프리미티브 Static Mesh 제작 (SM_HktGeo_*)

**경로**: `Content/Generated/Deconstruct/Meshes/`

| 에셋 이름 | 형태 | 용도 | 버텍스 수 |
|-----------|------|------|----------|
| `SM_HktGeo_Icosahedron` | 정이십면체 | Void(Dark) Element | ~60 |
| `SM_HktGeo_Octahedron` | 정팔면체 | Ice Element | ~24 |
| `SM_HktGeo_Tetrahedron` | 정사면체 | Lightning Element | ~12 |
| `SM_HktGeo_CustomShard` | 비대칭 파편 | Fire, Nature Element | ~30 |

**제작 방법**:
1. Modeling Mode 또는 외부 DCC(Blender)에서 제작
2. 크기: **1cm 기준** (Niagara에서 Scale로 조절)
3. 피벗: 중앙
4. LOD: 불필요 (매우 작음)
5. Collision: 없음 (렌더 전용)

---

#### Step 2. Material 제작 (M_HktDeconstruct_*)

**경로**: `Content/Generated/Deconstruct/Materials/`

**(a) M_HktDeconstruct_PointGlow** (E1 CorePoints용)
```
Material Domain:  Surface
Blend Mode:       Translucent
Shading Model:    Unlit

노드 구성:
  Particle Color → Base Color
  Particle Color × Fresnel → Emissive Color
  Distance to Camera 기반 Opacity (근거리 뭉침 방지)
  → 최종 Opacity = Fresnel × DistanceFade × ParticleAlpha
```

**(b) M_HktDeconstruct_GeoFragment** (E2 GeoFragments용)
```
Material Domain:  Surface
Blend Mode:       Opaque 또는 Translucent
Shading Model:    Default Lit

노드 구성:
  Particle Color → Base Color (2색 Lerp, Normal.Z 기반)
  Metallic: 0.8~1.0
  Roughness: 0.1~0.3
  Fresnel → Emissive Color (엣지 발광)
  World Position Offset: Sine(Time) × 미세 진폭 (진동)
```

**(c) M_HktDeconstruct_EnergyRibbon** (E3 EnergyRibbons용)
```
Material Domain:  Surface
Blend Mode:       Translucent (Additive)
Shading Model:    Unlit

노드 구성:
  Panner(U 스크롤) → 노이즈 텍스처 UV
  노이즈 텍스처 → 에너지 패턴
  Particle Color → Color
  패턴 기반 Opacity (단속적 끊김)
  Emissive Strength: 3.0~8.0
```

**(d) M_HktDeconstruct_AuraDot** (E4 SurfaceAura용)
```
Material Domain:  Surface
Blend Mode:       Translucent (Additive)
Shading Model:    Unlit

노드 구성:
  RadialGradientExponential → 원형 글로우
  Particle Color → Color
  Particle Alpha → Opacity
```

**(e) M_HktDeconstruct_CoreGlow** (E5 메시 Material)
```
Material Domain:  Surface
Blend Mode:       Translucent
Shading Model:    Unlit
Two Sided:        On

노드 구성:
  Opacity: 0.05~0.15 (거의 투명)
  Fresnel → Emissive Color × 팔레트 색상 (Scalar Parameter "Intensity")
  World-space 노이즈 기반 디졸브 마스크
  → 메시에 "틈이 있는" 반투명 발광 효과
```

---

#### Step 3. Niagara System 제작 (NS_HktDeconstruct)

**경로**: `Content/Generated/Deconstruct/FX/NS_HktDeconstruct`

1. **Content Browser → 우클릭 → FX → Niagara System → New system from selected emitter(s)**
2. Empty System으로 생성 후 이름: `NS_HktDeconstruct`
3. **System 레벨 User Parameters 추가** (C++ 코드와의 계약):

| 이름 | 타입 | 기본값 |
|------|------|--------|
| `Coherence` | float | 1.0 |
| `PointScatter` | float | 0.0 |
| `PointDensity` | float | 1.0 |
| `Agitation` | float | 0.0 |
| `BaseColor` | LinearColor | (1,1,1,1) |
| `SecondaryColor` | LinearColor | (1,1,1,1) |
| `AccentColor` | LinearColor | (1,1,1,1) |
| `PulseRate` | float | 1.0 |
| `TrailLifetime` | float | 0.05 |
| `RibbonWidthMult` | float | 1.0 |
| `RibbonEmissiveMult` | float | 1.0 |
| `AuraVelocityMult` | float | 1.0 |
| `AuraSpawnRateMult` | float | 1.0 |
| `FragmentScaleMult` | float | 1.0 |
| `FragmentMesh` | Object (StaticMesh) | SM_HktGeo_Icosahedron |
| `SkeletalMeshComponent` | Object (SkeletalMeshComponent) | None |

4. **Emitter 추가** (각 Emitter 내부 설정):

**(E1) CorePoints Emitter:**
```
Sim Target: GPU Compute
Emitter Properties:
  - Deterministic: Off (GPU)
  
Spawn:
  - Spawn Per Frame: ~3000 × User.PointDensity

Initialize Particle:
  - Skeletal Mesh Location 모듈 추가
    - Source: User.SkeletalMeshComponent
    - Source Mode: Vertices (Direct)
    - Output: Position, Normal, Velocity, Bone Index
  - Position += Normal × Random(0, User.PointScatter)
  - Lifetime: Lerp(0.017, 0.13, User.TrailLifetime × 10)

Particle Update:
  - Color = Lerp(User.BaseColor, User.AccentColor, Sine(Time × User.PulseRate))
  - Scale = Lerp(0.3, 0.8, Random) × User.Coherence

Renderer: Sprite
  - Material: M_HktDeconstruct_PointGlow
  - Alignment: Camera Facing
  - Sort: View Depth
```

**(E2) GeoFragments Emitter:**
```
Sim Target: GPU Compute

Spawn:
  - Spawn Per Frame: ~600 × User.PointDensity × 0.3

Initialize:
  - Skeletal Mesh Location (Vertices, 40% sampling)
  - Position += Normal × Random(0, User.PointScatter)
  - Lifetime: 0.033~0.066

Update:
  - Rotation Rate = Random(30,120) × (1 + User.Agitation × 3) deg/s
  - Scale = BaseScale × User.FragmentScaleMult × User.Coherence

Renderer: Mesh
  - Particle Mesh: User.FragmentMesh
  - Material: M_HktDeconstruct_GeoFragment
```

**(E3) EnergyRibbons Emitter:**
```
Sim Target: CPU (리본은 CPU 필수)

Spawn:
  - 5 체인(Spine, L-Arm, R-Arm, L-Leg, R-Leg)
  - 체인당 본 수만큼 파티클 스폰

Initialize:
  - Skeletal Mesh Location (Bones)
  - Ribbon ID = 체인 인덱스

Update:
  - 본 위치 매 프레임 추적

Renderer: Ribbon
  - Width: 0.5cm × User.RibbonWidthMult
  - Material: M_HktDeconstruct_EnergyRibbon
  - UV Scroll
```

**(E4) SurfaceAura Emitter:**
```
Sim Target: GPU Compute

Spawn:
  - Spawn Rate: 300 × User.AuraSpawnRateMult

Initialize:
  - Skeletal Mesh Location (Surface, Random)
  - Velocity: Normal × Random(5,15) × User.AuraVelocityMult

Update:
  - Curl Noise Force
  - Drag: 0.3
  - Size by Life: 0 → peak → 0
  - Opacity by Life: 동일 커브

Renderer: Sprite
  - Material: M_HktDeconstruct_AuraDot
  - Size: 0.1~0.4 cm
```

---

#### Step 4. UHktDeconstructVisualDataAsset 생성

**경로**: `Content/Generated/Deconstruct/DA_HktDeconstruct_Default`

1. **Content Browser → 우클릭 → Miscellaneous → Data Asset**
2. 클래스 선택: **HktDeconstructVisualDataAsset**
3. 프로퍼티 설정:

```
IdentifierTag:     Visual.Deconstruct.Default
DeconstructSystem: NS_HktDeconstruct (Step 3에서 제작)
CoreGlowMaterial:  M_HktDeconstruct_CoreGlow (Step 2e에서 제작)

ElementPalettes (5개, 순서대로 Fire/Ice/Lightning/Void/Nature):
  [0] Fire:      Primary=#FF4500, Secondary=#FF8C00, Accent=#FFD700
  [1] Ice:       Primary=#87CEEB, Secondary=#FFFFFF, Accent=#DDA0DD
  [2] Lightning: Primary=#9370DB, Secondary=#FFFFFF, Accent=#ADD8E6
  [3] Void:      Primary=#1A0033, Secondary=#8B008B, Accent=#4A0000
  [4] Nature:    Primary=#228B22, Secondary=#90EE90, Accent=#FFD700

FragmentMeshes (5개, 순서대로):
  [0] Fire:      SM_HktGeo_CustomShard
  [1] Ice:       SM_HktGeo_Octahedron
  [2] Lightning: SM_HktGeo_Tetrahedron
  [3] Void:      SM_HktGeo_Icosahedron
  [4] Nature:    SM_HktGeo_CustomShard
```

---

### Phase 2: Blueprint 생성

#### Step 5. Blueprint 서브클래스 생성

**경로**: `Content/Generated/Characters/Boss/BP_HktDeconstruct_Boss`

1. **Content Browser → 우클릭 → Blueprint Class**
2. Parent Class 검색: **HktDeconstructUnitActor**
3. 이름: `BP_HktDeconstruct_Boss`
4. Blueprint를 열고 **Class Defaults**에서:

```
[HKT|Deconstruct 카테고리]
  Deconstruct Data Asset → DA_HktDeconstruct_Default (Step 4에서 생성)

[HKT|Unit 카테고리]  (상속된 SkeletalMeshComponent)
  Mesh Component → Skeletal Mesh 설정
    - Skeletal Mesh Asset: SK_Mannequin (또는 보스 메시)
    - Anim Class: ABP_Mannequin_C (또는 보스 Animation Blueprint)
```

5. **Components 패널 확인**:
```
BP_HktDeconstruct_Boss (Self)
  └─ Capsule (CapsuleComponent, Root)
       └─ Mesh (SkeletalMeshComponent)
            └─ DeconstructNiagara (NiagaraComponent)  ← 자동 생성됨
  └─ DeconstructParamController (ActorComponent)       ← 자동 생성됨
```

6. (선택) Viewport에서 Skeletal Mesh 위치/크기 확인

#### Step 6. UHktActorVisualDataAsset 생성

**경로**: `Content/Generated/Characters/Boss/DA_Boss`

기존 `FHktActorRenderer` 파이프라인이 이 DataAsset의 `ActorClass`로 Actor를 스폰한다.

1. **Content Browser → 우클릭 → Miscellaneous → Data Asset**
2. 클래스 선택: **HktActorVisualDataAsset**
3. 프로퍼티 설정:

```
IdentifierTag:  Entity.Character.Boss
ActorClass:     BP_HktDeconstruct_Boss (Step 5에서 생성)
```

---

### Phase 3: 런타임 연결

#### Step 7. Convention Rule 추가 (선택)

**Project Settings → HktGameplay → HktAsset** 에서:

이미 `Entity.Character.` 프리픽스에 대한 Convention Rule이 있다면 자동으로 동작한다.
없다면 추가:

```
TagPrefix:    Entity.Character.
PathPattern:  {Root}/Characters/{Leaf}/DA_{Leaf}
```

이렇게 하면 VM에서 VisualElement 태그가 `Entity.Character.Boss`인 엔티티가 스폰될 때:
1. `UHktAssetSubsystem`이 태그로 `DA_Boss` DataAsset 로드
2. `FHktActorRenderer::SpawnActor()`이 `ActorClass = BP_HktDeconstruct_Boss` 확인
3. `World->SpawnActor<AActor>(BP_HktDeconstruct_Boss, ...)`
4. `BeginPlay()`에서 `DeconstructDataAsset`이 설정되어 있으므로 `InitializeDeconstruct()` 자동 호출
5. Niagara System 활성화, CoreGlow Material 적용, 스폰 연출 시작

#### Step 8. VM에서 엔티티 등록

서버(HktCore VM)에서 보스 엔티티를 생성할 때 VisualElement 프로퍼티에 `Entity.Character.Boss` 태그를 설정:

```cpp
// Story Definition 또는 VM 코드에서:
WorldState.SetTag(BossEntityId, PropertyId::VisualElement, "Entity.Character.Boss");
WorldState.SetProperty(BossEntityId, PropertyId::Health, 1000);
WorldState.SetProperty(BossEntityId, PropertyId::MaxHealth, 1000);
```

---

### 전체 데이터 흐름 요약

```
[VM] Entity Spawn (VisualElement = "Entity.Character.Boss")
  ↓
[HktAssetSubsystem] Tag → DA_Boss (UHktActorVisualDataAsset)
  ↓
[FHktActorRenderer] SpawnActor(BP_HktDeconstruct_Boss)
  ↓
[AHktDeconstructUnitActor::BeginPlay()]
  ↓ DeconstructDataAsset (BP Class Defaults에서 설정된 값)
  ↓
[InitializeDeconstruct()]
  ├─ NiagaraComponent.SetAsset(NS_HktDeconstruct)
  ├─ NiagaraComponent.SetVariableObject("SkeletalMeshComponent", MeshComponent)
  ├─ MeshComponent.SetMaterial(all, M_HktDeconstruct_CoreGlow)
  ├─ ParamController.Initialize(NiagaraComponent)
  ├─ UpdateElement(Fire)  // 기본
  ├─ HandleSpawn()        // 조립 연출 시작
  └─ NiagaraComponent.Activate()
  ↓
[매 프레임 Tick]
  ├─ TickParamInterpolation() → CurrentParams 보간
  └─ ParamController.PushParams() → Niagara User Parameters 업데이트
  ↓
[ApplyPresentation() - VM State 변경 시]
  ├─ HealthRatio 변화 → HandleDamage/HandleDeath
  ├─ VisualElement 변화 → UpdateElement (팔레트/메시 교체)
  ├─ Velocity → Agitation (기본 동요)
  └─ PendingAnimTriggers → HandleSkillActivate
```

---

### 에디터 단독 테스트 (VM 없이)

VM 연결 없이 에디터에서 비주얼만 테스트하려면:

1. 레벨에 `BP_HktDeconstruct_Boss`를 **직접 드래그 앤 드롭**
2. BeginPlay에서 `DeconstructDataAsset`이 설정되어 있으므로 자동 초기화
3. Details 패널에서 `DeconstructDataAsset`의 팔레트 값을 변경하여 실시간 확인
4. Level Blueprint에서 테스트:

```
// Level Blueprint에서 직접 테스트
Event BeginPlay
  → Delay 2초
  → Get Actor Reference (BP_HktDeconstruct_Boss)
  → Call InitializeDeconstruct (다른 DataAsset으로 교체 테스트)
```

또는 C++ 테스트:
```cpp
// 콘솔 명령이나 테스트 코드에서:
AHktDeconstructUnitActor* Actor = Cast<AHktDeconstructUnitActor>(TestActor);
Actor->InitializeDeconstruct(LoadObject<UHktDeconstructVisualDataAsset>(...));
```