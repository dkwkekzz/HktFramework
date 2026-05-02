# Design — UHktSpriteNiagaraCrowdRenderer

기존 `UHktSpriteCrowdRenderer`(HISM)는 그대로 두고, Niagara Mesh Renderer 기반의 신규 크라우드 렌더러를 같은 진입 API로 병행 운용하기 위한 설계 문서.

## 배경 — 왜 새 렌더러가 필요한가

현 HISM 기반 경로의 잔존 이슈:

1. **렌더 스레드 싱크 어긋남** — Instance transform / PerInstanceCustomData / view uniform이 각자 다른 경로로 렌더 스레드에 도달. WPO 셰이더가 이 셋을 셰이더 단계에서 합성. 같은 프레임 데이터로 정확히 합쳐진다는 보장이 없음.
2. **WPO motion vector 미출력** — WPO가 정점을 매 프레임 다른 곳으로 옮기는데도 GBuffer velocity는 0. TSR/TAA reprojection이 어긋나 시간축으로 누적되며 흔들림(지터/계단/스미어).
3. **Y-axis 빌보드 재계산** — `RightDir = normalize(CamPos - ObjPos)` 라서 인스턴스 평행이동 시에도 미세하게 회전. 가까운 카메라에서 한쪽 면이 출렁이는 형태로 가시화.

근본 해소를 위해 빌보드/위치/UV 처리를 머티리얼 셰이더 단계에서 빼내고, Niagara가 내장으로 처리하는 구조로 분리.

## 1. 목표 / 비목표

### Goals

- **렌더 스레드 싱크 문제 근본 해소** — 인스턴스 위치/회전을 단일 파티클 속성으로 atomically 갱신, WPO 빌보드 제거.
- **Velocity 정상 출력** — Niagara Mesh Renderer는 motion vector를 GBuffer에 정상 기록 → TSR/TAA reprojection이 매끄러움.
- **기존 진입점 호환** — `RegisterEntity / SetCharacter / UpdateEntity / UnregisterEntity / ClearAll` API 동일.
- **아틀라스/캐릭터 모델 보존** — 1 atlas = 1 Niagara System 인스턴스 (현재 1 atlas = 1 HISM과 1:1 매핑).
- **CVar로 런타임 토글** (`hkt.Sprite.Renderer = HISM | Niagara`) — A/B 비교 + 안전한 롤백.

### Non-goals

- 기존 HISM 렌더러 제거. 둘은 평행 존재. 마이그레이션 결정은 별도 PR.
- 멀티 카메라 / 분할 화면 정합성. 단일 view 카메라 가정.
- HktSpriteTerrain(별 모듈) 영향 없음.

## 2. 모듈 / 파일 레이아웃

```
HktGameplay/Source/HktSpriteCore/
├── Public/
│   ├── HktSpriteCrowdRenderer.h            (기존, 유지)
│   ├── HktSpriteNiagaraCrowdRenderer.h     ← 신규
│   └── IHktSpriteCrowdRenderer.h           ← 신규(공통 인터페이스, 옵션)
└── Private/
    ├── HktSpriteCrowdRenderer.cpp           (기존, 유지)
    ├── HktSpriteNiagaraCrowdRenderer.cpp    ← 신규
    └── HktSpriteNiagaraSystemPool.{h,cpp}   ← 신규(시스템 인스턴스 캐시)

HktGameplay/Content/Niagara/                 ← 신규(쿠킹된 에셋, 커밋)
├── NS_HktSpriteAtlasCrowd.uasset            ← 템플릿 Niagara System
└── M_HktSpriteAtlasUVOnly.uasset            ← WPO 제거된 머티리얼

HktGameplayGenerator/Source/HktSpriteGenerator/
├── HktSpriteNiagaraTemplateBuilder.{h,cpp}  ← 신규(NS/Material 빌드 콘솔 명령)
```

`HktSpriteCore/Build.cs`에 `Niagara`, `NiagaraCore` 모듈 의존 추가.

## 3. Niagara System 템플릿 (`NS_HktSpriteAtlasCrowd`)

**원칙**: 시스템은 "용기"만 제공. 모든 인스턴스 데이터는 외부에서 주입.

### 3.1 Emitter 1개 (CPUSim)

| 항목 | 값 |
|---|---|
| Sim Target | CPU |
| Spawn | 사용 안 함 (수동 풀 — `RegisterEntity`마다 1 spawn, `UnregisterEntity` 시 kill) |
| Lifetime | `MAX_FLT` (영구) — 명시적 kill만 |
| Emitter State | Loop = Infinite |

### 3.2 Particle Attributes

| 속성 | 타입 | 역할 |
|---|---|---|
| `Position` | Vector | 월드 위치 (= `Update.WorldLocation`) |
| `MeshScale` | Vector | (CellW_world, 1, CellH_world) — quad 크기 |
| `Color` | LinearColor | Tint × Alpha |
| `Velocity` | Vector | 직전 프레임 위치 차분 (CPU script로 자동 계산 → Niagara가 GBuffer velocity로 출력) |
| `MaterialRandom` | float | 미사용/예약 |
| `DynamicMaterialParameter` | Vec4 | `(AtlasIdx, CellW_px, CellH_px, FlipV)` — 머티리얼 UV 셀 결정 |
| `DynamicMaterialParameter1` | Vec4 | `(ZBias_cm, PaletteIndex, reserved, reserved)` |
| `EntityId` | int (custom attr) | C++ 갱신 시 인덱스 매칭용 (선택) |

### 3.3 Mesh Renderer

| 항목 | 값 |
|---|---|
| Mesh | `SM_HktSpriteQuad` (단일 Z-up quad, 1×1 unit) — 기존 자산 재사용 |
| Material Override | `M_HktSpriteAtlasUVOnly`의 MID (atlas 텍스처 주입) |
| Facing Mode | **`Camera Plane Facing`** (Y-axis billboard처럼 보이게 하려면 `Custom Fixed Axis` + `Up = +Z`) |
| Mesh Alignment | `Velocity Aligned` 사용 안 함 — 빌보드만 |
| Sort Mode | `View Distance` (translucent 사용 시) / 또는 머티리얼이 Masked면 정렬 불필요 |
| Output Velocity | **ON** (TSR/TAA용) |

> Niagara Mesh Renderer의 `Facing Mode = Camera Plane Facing` 또는 `Cylindrical Constraint Axis = (0,0,1)` 설정으로 **Y축 빌보드를 엔진이 직접** 처리. WPO 머티리얼 코드 0줄.

### 3.4 User Parameters (시스템 인스턴스 외부 입력)

| 이름 | 타입 | 설명 |
|---|---|---|
| `User.Atlas` | Texture2D | MID로 주입할 아틀라스 (Niagara 단계가 아니라 머티리얼 MID에 직접 set, 시스템 입력 아님) |
| `User.AtlasSizePx` | Vec2 | atlas 가로/세로 픽셀 |
| `User.WorldScale` | float | 컴포넌트 GlobalWorldScale |
| `User.ComponentZBias` | float | 컴포넌트 ZBias |

### 3.5 Module 구성

기본 모듈만:

- **Emitter Update**: Emitter State.
- **Particle Update**:
  - `Calculate Velocity from Position Delta` (커스텀 1-라이너) — 이전 프레임 Position 저장 후 dt로 나눔. Niagara에 빌트인 모듈 있음 (`Update Position by Velocity` 역방향).
  - 다른 갱신 없음 — 모든 속성은 외부에서 직접 set.

## 4. 머티리얼 (`M_HktSpriteAtlasUVOnly`)

기존 `M_HktSpriteYBillboard`에서 **WPO 통째로 제거** + CPD 의존 제거. UV 계산은 Niagara `DynamicMaterialParameter`로 받음.

```
[DynamicParam0.x] = AtlasIdx
[DynamicParam0.y] = CellW_px
[DynamicParam0.z] = CellH_px
[DynamicParam0.w] = FlipV (0/1)

[VectorParam: AtlasSize] = (Atlas.x, Atlas.y, 0, 0)
[TexParam:    Atlas]     = atlas texture (MID set)

UV Custom HLSL (현 kUVCode 그대로 재사용 가능, 입력만 DynamicParam으로 변경)
→ TextureSample Atlas → EmissiveColor (Unlit)

OpacityMask = TextureSample.A * DynamicParam0?  (필요 시 BLEND_Translucent 검토)
```

| 머티리얼 속성 | 설정 |
|---|---|
| Domain | Surface |
| Shading Model | Unlit |
| Blend Mode | Masked (or Translucent — 추후 결정) |
| Two Sided | true |
| Used With Niagara Meshes | **true** (필수) |
| Used With Instanced Static Meshes | false |
| Output Velocity From WPO | N/A (WPO 없음) |

**WPO 0줄, CPD 0개**. 셰이더 그래프가 현재 25노드 → 약 8노드로 축소.

## 5. 신규 컴포넌트 — `UHktSpriteNiagaraCrowdRenderer`

### 5.1 외부 API (HISM 버전과 동일 시그니처)

```cpp
void RegisterEntity(FHktEntityId);
void UnregisterEntity(FHktEntityId);
void SetCharacter(FHktEntityId, FGameplayTag);
void UpdateEntity(FHktEntityId, const FHktSpriteEntityUpdate&);
void ClearAll();
```

→ `IHktSpriteCrowdRenderer` 추출하면 Processor가 깔끔하게 swap. 추출 비용이 부담되면 두 컴포넌트 공통 시그니처로 두고 Processor가 `UObject*`로 들고 dynamic dispatch.

### 5.2 내부 구조

```cpp
struct FNiagaraEntitySlot
{
    FGameplayTag CharacterTag;
    FSoftObjectPath CurrentAtlasPath;
    int32 ParticleIndex = INDEX_NONE;   // 풀 안의 인덱스
    bool  bActive = false;
    EHktSpriteUpdateStatus LastUpdateStatus;
};

UPROPERTY(Transient)
TMap<FSoftObjectPath, TObjectPtr<UNiagaraComponent>> AtlasSystems;

UPROPERTY(Transient)
TMap<FSoftObjectPath, TObjectPtr<UMaterialInstanceDynamic>> AtlasMIDs;

// atlas당 attribute 배열 (parallel 배열, NDIArray로 시스템에 푸시)
TMap<FSoftObjectPath, FAtlasParticleArrays> AtlasArrays;

struct FAtlasParticleArrays
{
    TArray<FVector>      Positions;
    TArray<FLinearColor> Colors;
    TArray<FVector4>     DynParam0;   // AtlasIdx/CellW/CellH/FlipV
    TArray<FVector4>     DynParam1;   // ZBias/Palette/...
    TArray<FVector>      Scales;
    TBitArray<>          AliveMask;
    TArray<int32>        FreeList;    // swap-and-pop 풀 관리
};

TMap<FHktEntityId, FNiagaraEntitySlot> Entities;
```

### 5.3 시스템 인스턴스 관리 (`HktSpriteNiagaraSystemPool`)

- atlas SoftObjectPath → `UNiagaraComponent` 캐시. 없으면 생성:
  1. `UNiagaraComponent::CreateSystem(NS_HktSpriteAtlasCrowd)` 자식 컴포넌트로 추가.
  2. atlas 텍스처를 `AtlasMIDs`로 만든 MID에 `SetTextureParameterValue("Atlas", AtlasTex)`.
  3. `User.AtlasSizePx`, `User.WorldScale`, `User.ComponentZBias` 세팅.
  4. `UNiagaraComponent::SetMaterialOverride(0, MID)` (MeshRenderer 첫 슬롯).
  5. `UNiagaraComponent::Activate(true)`.
- HISM 쪽의 `HISMPrimePending` 같은 1-frame proxy 워밍업 동등물이 필요할 수 있음 — Niagara MeshRenderer가 활성화 직후 첫 프레임에 텍스처 바인딩이 1 tick 비어 있으면 동일 패턴 적용.

### 5.4 swap-and-pop / 마이그레이션

- 엔터티가 다른 atlas로 이동(애니 변경): 기존 atlas 배열에서 `RemoveAtSwap` + 같은 인덱스에 살아남은 마지막 엔터티의 `Slot.ParticleIndex` 갱신 → 다른 atlas 배열에 push.
- 한 엔터티는 동시에 정확히 한 atlas의 한 ParticleIndex에 존재 (현 HISM 규약과 동일).

### 5.5 풀에서 NDI Array로 푸시

각 tick 끝에:

```cpp
UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector(NC, "User.Positions", Arr.Positions);
UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayColor (NC, "User.Colors",    Arr.Colors);
UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector4(NC, "User.DynParam0", Arr.DynParam0);
UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector4(NC, "User.DynParam1", Arr.DynParam1);
UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector(NC, "User.Scales",    Arr.Scales);
```

Particle Update에서 ExecutionIndex로 배열 읽어 attribute로 set:

```
Position                    = User.Positions[ExecutionIndex]
Color                       = User.Colors[ExecutionIndex]
DynamicMaterialParameter    = User.DynParam0[ExecutionIndex]
DynamicMaterialParameter1   = User.DynParam1[ExecutionIndex]
MeshScale                   = User.Scales[ExecutionIndex]
```

NDI Array 푸시는 게임 스레드에서 일괄 → Niagara가 다음 tick에 atomically 반영 → **싱크 문제 사라짐**. 위치/스케일/UV가 항상 같은 프레임 데이터.

## 6. 데이터 흐름 — 한 프레임

```
Processor.UpdateEntity(Id, Update)
    │
    ▼
Renderer.UpdateEntity
    1. ResolveAtlas(Anim, Template) → AtlasPath
    2. atlas 변경되었으면 RemoveFromOld() + AddToNew(); ParticleIndex 갱신
    3. AtlasArrays[AtlasPath] 슬롯에 Position/Color/DynParam0/DynParam1/Scale write
       (배열 in-place 갱신, dirty 플래그)
    │
    ▼
Renderer.TickComponent (모든 UpdateEntity 후)
    for each AtlasPath in dirty:
        SetNiagaraArrayVector/Color/Vector4(NC, name, Arr...)
    dirty.Reset()
    │
    ▼
Niagara Tick (다음 프레임 시작)
    Particle Update: ExecutionIndex로 NDI 배열 읽어 속성 set
    Velocity = (Position - PrevPosition) / dt
    │
    ▼
Mesh Renderer
    Camera-aligned quad emit, GBuffer + velocity 정상 기록
```

## 7. 카메라 정렬 / 빌보드 처리

- Mesh Renderer의 **`Facing Mode = Camera Plane Facing`** 으로 카메라 평면에 평행한 quad.
- "Y-axis(지면 수직 유지) 빌보드"가 필요하면 **`Cylindrical Constraint Axis`** 또는 **`Custom Facing Vector`** 설정.
- 모든 인스턴스가 **공통 view 행렬**로 정렬 → 인스턴스 평행이동 시 회전 0 → **현 지터 원인 제거**.

## 8. Velocity / TSR 호환

- Niagara Mesh Renderer는 빌트인으로 motion vector 출력 (CPU sim도 마찬가지).
- 머티리얼은 WPO 없음 → `r.Velocity.EnableVertexDeformation` 같은 추가 설정 불필요.
- TSR/TAA reprojection이 정상 → smear 없음 + 톱니 깜빡임 없음.

## 9. CVar / 토글

```cpp
// HktSpriteAnimProcessor 내
TAutoConsoleVariable<int32> CVarRenderer(
    TEXT("hkt.Sprite.Renderer"),
    0,                       // 0=HISM(기본), 1=Niagara
    TEXT("0=HISM crowd renderer, 1=Niagara crowd renderer"));
```

Processor가 0이면 `UHktSpriteCrowdRenderer`, 1이면 `UHktSpriteNiagaraCrowdRenderer`로 dispatch. 동일 OwnerActor에 두 컴포넌트 모두 부착 가능 (서로 idle).

## 10. 자산 빌드 / 배포

옵션 A — **사전 빌드된 `.uasset` 커밋** (권장)

- `HktSpriteGenerator` (Editor 모듈)에 `FHktSpriteNiagaraTemplateBuilder` 추가, 콘솔 명령 `HktSprite.BuildNiagaraTemplate`이 `NS_HktSpriteAtlasCrowd` + `M_HktSpriteAtlasUVOnly`를 생성/저장.
- 결과물을 git에 커밋 (Niagara 노드 그래프는 매우 크지만 변경 빈도 낮음).
- 런타임은 `LoadObject`만.

옵션 B — **런타임 빌드** (비권장)

Niagara 시스템은 머티리얼보다 그래프 구조가 훨씬 복잡 → 코드 빌더 비용 크고 검증 어려움. Editor-only 빌더로 한 번만 만들고 커밋하는 A가 안전.

## 11. 위험 / 미해결

| 항목 | 현황 | 대응 |
|---|---|---|
| **Niagara CPU sim 비용** vs HISM | 인스턴스 N개 × 5속성 set/tick. 수천 개 OK, 수만 개 시 GPU sim 검토 | 1차는 CPU. 임계 도달 시 GPUSim 변형 검토 |
| **Sort vs Masked** | Masked + Mesh Renderer 혼합 정렬 이슈 | Masked 유지 + 카메라 거리 sort 검증, 안 되면 Translucent + premultiplied alpha |
| **Atlas 첫 프레임 텍스처 바인딩 race** | 현 HISM에 있던 `HISMPrimePending` 패턴과 유사 | 동등 워밍업 (1 tick 후 SetTexture 재호출 + Activate) |
| **Z-fighting (캐릭터 vs Sprite Terrain)** | ZBias가 view forward 방향 — Mesh Renderer는 quad position을 직접 옮겨야 함 | `Position`에 미리 view forward 오프셋 합성 (게임 스레드에서 카메라 forward 받아서) |
| **멀티 카메라** | view-aligned는 단일 카메라 가정 | 1차 범위 외. 분할 화면 도입 시 별도 작업 |
| **HktInsights 카운터** | 현 HISM 경로의 카운터가 인스턴스/migrate 단위 | Niagara 경로에도 동일 카운터 emit (`HKT_INSIGHT_COLLECT`) |

## 12. 마이그레이션 단계

1. **PR-1** — 신규 컴포넌트 + Niagara 템플릿 자산. CVar 0(HISM 기본). 컴파일/머지만.
2. **PR-2** — Processor에 dispatch 분기. CVar 1로 PIE 검증. HISM과 시각 동등성 비교.
3. **PR-3** — 지터/색감 검증 통과 후 CVar 기본을 1로 전환.
4. **PR-4 (먼 미래)** — HISM 렌더러 제거, 머티리얼 빌더 정리. 결정은 별도.

## 13. 미확정 결정 (PIE 검증 후 확정)

- Niagara 시스템의 NDI Array 입력 슬롯 이름 확정 (현 안은 가안).
- Mesh Renderer Facing Mode를 `Camera Plane` vs `Custom Cylindrical(+Z)` 중 어느 쪽으로 갈지.
  - `Camera Plane`: 카메라 위/아래 시점에서 quad가 누워서 보일 수 있음.
  - `Cylindrical(+Z)`: 현 Y-axis billboard와 동등 — 항상 +Z up 유지.

이 두 가지는 PR-2에서 짧게 비교 후 결정.
