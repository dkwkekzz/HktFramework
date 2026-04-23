# R&D: 2D Skeletal Animation System (HktSpriteCore)

> **목표:** 라그나로크 온라인 정통 방식의 `.spr`/`.act` 스프라이트 애니메이션 시스템을 UE5 + AI 파이프라인 위에 재구축한다.
> **범위:** 플레이어/적 캐릭터 본체.
> **렌더링 컨텍스트:** 복셀 3D 지형 + 2D 빌보드 스프라이트 캐릭터.
> **최종 수정:** 2026-04-21

---

## 0. 선행 결정 사항

- **기존 복셀 캐릭터 아키텍처(`UHktVoxelCrowdRenderer`, 7-layer 복셀 스킨, 32×32×48 복셀 플레이어)는 전면 폐기.**
- **지형은 복셀(`HktVoxelCore` + Binary Greedy Meshing) 그대로 유지.**
- **레퍼런스: 라그나로크 온라인 정통** — 쿼터뷰 카메라, 8방향 스프라이트, 컷아웃 방식 파츠 조합.
- **결정론 원칙 불변:** VM은 애니메이션 프레임을 모른다. `animState`, `animStartTick`, `facing`만 보유.

---

## 1. 라그나로크 방식의 본질 재정의

라그나로크의 "2D 스켈레탈"은 Spine/DragonBones 식 **메시 디폼(skinned mesh)이 아니다**. 본질은:

1. **파츠별 스프라이트 시트** — Body, Head, Weapon, Shield, Headgear가 각각 독립된 이미지 소스.
2. **액션 파일(.act)이 지시하는 컷아웃 트랜스폼** — 각 프레임마다 각 파츠의 (x, y, rotation, scale, tint)를 규정.
3. **계층적 anchor 구조** — Body의 특정 프레임이 Head anchor를 "여기"라고 지정하면, Head는 그 anchor에 자신의 pivot을 맞춤.
4. **방향별 독립 시트** — 8방향 각각에 대해 프레임 시퀀스가 따로 존재.

이 모델은 프로젝트의 기존 철학과 정확히 일치한다:
- **Rigid Transform Table**(복셀 파츠 애니에서 채택한 방식)의 2D 버전 그대로.
- **Pure Function 기반 생성** — 프레임 인덱스 → 트랜스폼은 순수 함수.
- **모듈러 에셋 조합** — 7-layer 복셀 스킨의 2D 재현.

---

## 2. 아키텍처 개요

```
┌──────────────────────────────────────────┐
│ VM Layer (HktCore, Deterministic)        │
│  Entity {                                │
│    pos: FVec3                            │
│    facing: uint8 (0..7)                  │
│    animState: FName                      │
│    animStartTick: int64                  │
│    partLoadout: FHktSpriteLoadout        │
│  }                                       │
└──────────────────┬───────────────────────┘
                   │ State Snapshot
                   │ (per-tick interpolated)
                   ▼
┌──────────────────────────────────────────┐
│ UE5 Presentation Layer                   │
│  UHktSpriteCrowdRenderer                 │
│   ├ Instanced Billboard Quads (파츠별)   │
│   ├ Sprite Atlas Manager                 │
│   ├ Animation Resolver (tick→frame)      │
│   └ Custom Primitive Data (팔레트/틴트)  │
└──────────────────────────────────────────┘
```

### 2.1 설계 원칙

| 원칙 | 적용 |
|------|------|
| UE5는 순수 프레젠테이션 | 프레임 선택·보간은 모두 UE5 쪽 |
| Pure Function 생성 | `(animState, animStartTick, now, facing) → FrameIndex` 순수 함수 |
| Instanced Rendering | 파츠별 `UInstancedStaticMeshComponent` (Quad 메쉬) |
| Data-Driven | 모든 파츠·액션이 Data Asset |
| AI 파이프라인 정합 | LoRA 생성 이미지 → 아틀라스 팩 → Data Asset 자동 생성 |

---

## 3. 데이터 모델

### 3.1 계층 구조 (Bone Hierarchy)

라그나로크 본체 구조 재현:

```
Root (월드 위치, facing)
 └─ Body                            (기본 프레임, 대부분의 애니메이션 타이밍의 원천)
     ├─ Head                        (Body의 HeadAnchor에 부착)
     │   ├─ HeadgearTop             (Head의 TopAnchor)
     │   ├─ HeadgearMid             (Head의 MidAnchor)
     │   └─ HeadgearLow             (Head의 LowAnchor)
     ├─ Weapon                      (Body의 WeaponHandAnchor)
     └─ Shield                      (Body의 ShieldHandAnchor)
```

**핵심:** Body가 **타이밍 마스터**. Head는 Body 프레임의 `HeadAnchor`를 따라가며, Head 자신도 독립 애니 프레임을 가질 수 있음(예: 호흡).

### 3.2 프레임 단위 데이터

```cpp
// 한 파츠의 한 방향, 한 프레임
USTRUCT(BlueprintType)
struct FHktSpriteFrame
{
    GENERATED_BODY()

    UPROPERTY() int32 AtlasIndex = 0;          // 아틀라스 내 스프라이트 인덱스
    UPROPERTY() FVector2f PivotOffset;         // 스프라이트 자체의 pivot 오프셋 (픽셀)
    UPROPERTY() FVector2f Scale = FVector2f(1);
    UPROPERTY() float Rotation = 0.f;          // degrees
    UPROPERTY() FLinearColor Tint = FLinearColor::White;
    UPROPERTY() int8 ZBias = 0;                // 파츠 간 Z-fighting 해소용

    // 자식 파츠가 부착될 앵커 포인트 (이 프레임 기준)
    UPROPERTY() TMap<FName, FVector2f> ChildAnchors;
    // 키 예시: "HeadAnchor", "WeaponHandAnchor", "ShieldHandAnchor"
};

USTRUCT(BlueprintType)
struct FHktSpriteAction
{
    GENERATED_BODY()

    UPROPERTY() FName ActionId;                // "idle", "walk", "attack_1", "hurt", "die"
    UPROPERTY() TArray<FHktSpriteFrame> FramesByDirection[8]; // N, NE, E, SE, S, SW, W, NW
    UPROPERTY() float FrameDurationMs = 100.f; // 고정 fps 기준; 프레임별 가변은 후술
    UPROPERTY() TArray<float> PerFrameDurationMs; // 비어있으면 고정, 있으면 override
    UPROPERTY() bool bLooping = true;
    UPROPERTY() FName OnCompleteTransition;    // 비루프 액션 종료 후 전환할 액션
};

USTRUCT(BlueprintType)
struct FHktSpritePartTemplate
{
    GENERATED_BODY()

    UPROPERTY() FName PartId;                  // "body_warrior_m_base", "head_default_01"
    UPROPERTY() FName PartSlot;                // "Body", "Head", "Weapon", ...
    UPROPERTY() UTexture2D* Atlas;
    UPROPERTY() FVector2f AtlasCellSize;       // 단일 프레임 픽셀 크기
    UPROPERTY() TMap<FName, FHktSpriteAction> Actions;
};
```

### 3.3 캐릭터 Loadout (VM-side)

```cpp
USTRUCT()
struct FHktSpriteLoadout
{
    GENERATED_BODY()

    UPROPERTY() FName BodyPartId;
    UPROPERTY() FName HeadPartId;
    UPROPERTY() FName WeaponPartId;
    UPROPERTY() FName ShieldPartId;
    UPROPERTY() FName HeadgearTopId;
    UPROPERTY() FName HeadgearMidId;
    UPROPERTY() FName HeadgearLowId;

    UPROPERTY() uint8 PaletteIndex = 0;        // 기존 8-color palette system 재활용
    UPROPERTY() FLinearColor TintOverride = FLinearColor::White;
};
```

이 구조는 VM 상태의 일부다. Loadout 변경(장비 교체)은 VM 이벤트로 발생하고, 렌더러는 State Snapshot으로 감지해 파츠를 교체한다.

---

## 4. 애니메이션 리졸빙 (Pure Function)

### 4.1 프레임 선택 함수

```cpp
// 순수 함수 — 같은 입력이면 항상 같은 출력
struct FHktSpriteFrameResolveInput {
    const FHktSpriteAction* Action;
    int64 AnimStartTick;
    int64 NowTick;
    float TickDurationMs;
    uint8 Facing;   // 0..7
};

struct FHktSpriteFrameResolveResult {
    int32 FrameIndex;
    float BlendAlpha;   // 프레임 간 보간용 (옵션)
    bool bFinished;     // 비루프 액션 종료 여부
};

FHktSpriteFrameResolveResult HktResolveSpriteFrame(const FHktSpriteFrameResolveInput& In);
```

**구현 핵심:**
- 경과 시간 = `(NowTick - AnimStartTick) * TickDurationMs`.
- `PerFrameDurationMs`가 있으면 누적 비교, 없으면 `경과 / FrameDurationMs`.
- 루프면 `% NumFrames`, 아니면 마지막에 고정 + `bFinished = true`.
- **`NowTick`은 float이 아닌 int64 + 보간 알파로 분리** — 히트스톱 적용 지점.

### 4.2 히트스톱 처리

기존 원칙 그대로: **VM tick은 멈추지 않는다. presentation layer에서 `NowTick` 보간 알파를 고정.**

- 피격 발생 → VM이 `hitstop` 이벤트 스트림 발행 (duration 100ms).
- 렌더러는 해당 엔티티의 `InterpolationAlpha`를 고정, 동시에 `NowTick`도 고정.
- 결과: 프레임이 멈추고 위치 보간도 멈춤. VM은 그 사이에도 정상 tick.

---

## 5. 렌더링 파이프라인

### 5.1 `UHktSpriteCrowdRenderer`

기존 `UHktVoxelCrowdRenderer`의 2D 버전. 핵심 아이디어 그대로:

- **파츠 슬롯 × 아틀라스** 조합으로 `UInstancedStaticMeshComponent` 하나씩.
  - 예: Body는 `HISM_Body_WarriorM`, `HISM_Body_Mage`, ... 아틀라스별 분리.
  - Head, Weapon 등 슬롯도 동일.
- 메쉬는 **단일 Quad** (Static Mesh로 2-tri plane, 2x2 UV).
- 파츠별로 `AddInstance` → Per-instance transform + Custom Primitive Data.

### 5.2 Per-Instance Custom Primitive Data

라그나로크 파츠는 파츠별로 `(x, y, rotation, scale, tint, uv_rect)`가 다르다. 이걸 **Custom Primitive Data float 슬롯**에 담는다:

| 슬롯 | 용도 |
|------|------|
| 0~3 | UV Rect (umin, vmin, usize, vsize) — 아틀라스 내 프레임 선택 |
| 4~5 | 2D Offset (픽셀 → 월드 환산) |
| 6 | Rotation (rad) |
| 7~8 | Scale (x, y) |
| 9~12 | Tint RGBA |
| 13 | Palette Index |
| 14 | Flip (0=normal, 1=horizontal flip for facing mirror) |
| 15 | ZBias |

총 16 float. Custom Primitive Data의 최대 슬롯 내.

### 5.3 빌보딩 (Y-axis Billboard)

라그나로크의 핵심: **카메라 틸트와 무관하게 스프라이트는 월드 Z축 기준 수직 유지.**

**머티리얼 World Position Offset 구현:**
```
// 의사 코드
pivot = ActorPosition;
toCam = CameraPosition - pivot;
toCam.z = 0;                       // Y-axis only
toCam = normalize(toCam);
right = cross(WorldUp, toCam);
up = WorldUp;

localPos = VertexPosition - pivot; // 로컬 쿼드 좌표
world = pivot + right * localPos.x + up * localPos.y;
```

이로써 카메라가 위아래로 움직여도 스프라이트는 항상 수직. 단, 카메라가 **진짜 위에서 내려다보면** 스프라이트는 가늘어짐(Paper Mario 현상) — 라그나로크는 카메라 틸트를 제한해서 이 문제를 회피. **우리도 카메라 피치를 `[30°, 60°]` 정도로 고정 권장.**

### 5.4 Facing 처리 (8방향 + Mirror 최적화)

정통 라그나로크는 8방향 모두 개별 스프라이트. 하지만 대부분 좌우 대칭이므로:

- **5방향만 생성** (N, NE, E, SE, S) → `Flip` 플래그로 W, SW, NW 생성.
- 스토리지 37.5% 절감, 생성 비용(AI) 37.5% 절감.
- 단점: 비대칭 디테일(한쪽 어깨 문신 등) 포기.

**결정:** 캐릭터 기본 파츠는 5방향 + mirror, 비대칭이 중요한 특수 파츠는 8방향 fallback.

### 5.5 깊이 처리

**문제:** 3D 복셀 지형 안에서 캐릭터가 벽 뒤로 일부만 가려지는 상황.

**해법:**
- 스프라이트 머티리얼 **Z-test ON, Z-write ON** (알파 컷아웃).
- 알파 경계에서 Dithered Alpha 대신 **Alpha Test (masked)** 사용. 반투명 부분은 별도 파츠로 분리.
- 파츠 간 Z-fighting → `ZBias`로 해결 (Head는 Body 대비 +1, Weapon은 +2 등).

### 5.6 LOD

Crowd Renderer 철학 그대로 3-tier:

| Tier | 거리 | 처리 |
|------|------|------|
| L0 | 0~30m | 전 파츠 렌더, 풀 프레임레이트 애니 |
| L1 | 30~60m | Head/Body만, 10fps 고정 |
| L2 | 60m~ | Body 단일, 정지 프레임 (silhouette) |

### 5.7 그림자

3D 지형 위 2D 캐릭터의 그림자 처리:

- **옵션 A:** 타원형 Blob Shadow Decal (라그나로크 방식, 저비용).
- **옵션 B:** 스프라이트 자체의 Z-projected 그림자 (sheared 빌보드, 중비용).
- **권장:** A로 시작. 시각적으로 라그나로크 정통이고 복셀 지형과 자연스럽게 어울림.

---

## 6. AI 파이프라인 통합

### 6.1 생성 파이프라인

```
[LoRA 스타일 고정]
      ↓
[ControlNet + 캐릭터 베이스 포즈 5방향]
      ↓
[8프레임 시퀀스 자동 생성]  (Walk/Attack/Idle 각각)
      ↓
[배경 제거 + 스프라이트 정렬]
      ↓
[자동 앵커 포인트 검출]  (머리 위치/손 위치 — 포즈 추정 모델)
      ↓
[아틀라스 팩 + Data Asset 자동 생성]
```

### 6.2 앵커 포인트 자동화

가장 어려운 부분. 옵션:
- **포즈 추정(MediaPipe, DWPose)** — 2D 이미지에서 관절 키포인트 검출 → HeadAnchor, HandAnchor 자동 추출.
- **ControlNet 생성 시 키포인트 보존** — 입력 OpenPose 좌표를 앵커 메타로 저장.
- **수동 보정 도구** — 자동 검출 결과를 에디터에서 조정(최종 폴리싱용).

**권장 워크플로우:** ControlNet 입력의 OpenPose 좌표를 메타데이터로 함께 기록. 생성된 이미지의 캔버스 좌표계에서 해당 관절 위치를 그대로 앵커로 사용. 정확도 95%+ 예상.

### 6.3 스타일 일관성

LoRA 하나로 전체 캐릭터 풀 커버. 7-layer 복셀 스킨에서 논의된 "AI 생성물 일관성 리스크"의 대부분이 2D로 오면서 해결됨 — 2D 이미지 LoRA는 2026년 현재 AAA급.

---

## 7. VFX 전략 (복셀 캐릭터 폐기의 여파)

기존 "Niagara + 복셀 큐브 파편" 하이브리드 VFX 전략은 **캐릭터가 복셀이 아니게 되면서 일부 재조정 필요.**

### 7.1 피격 VFX

- **옵션 A (정통 라그나로크):** 2D 스프라이트 파티클. "Hit" 텍스트 이펙트, 데미지 숫자, 피 분사 스프라이트.
- **옵션 B (시그니처):** 스프라이트 캐릭터가 피격 시 **복셀 더스트 파편** 방출. 3D 복셀 월드와 시각적 일관성 유지.

**권장:** **B를 기본, A를 보조.** 복셀 지형 세계의 정체성을 살리면서, 캐릭터 렌더링만 2D. "맞으면 복셀 먼지가 피어오름"은 시그니처가 될 수 있음.

### 7.2 사망 VFX

라그나로크 정통은 "캐릭터가 아래로 가라앉으며 사라짐". 우리는:
- **스프라이트 frame-by-frame dissolve** → 동시에 복셀 큐브 파편 방출.
- 지형이 복셀이므로 파편이 땅에 떨어져 자연스럽게 녹아듦.

### 7.3 스킬 VFX

- **2D 스프라이트 이펙트** (대다수 스킬) — LoRA로 이펙트 시트 생성.
- **3D 복셀 파티클** (지면 기반 임팩트, 폭발) — 기존 Niagara 파이프라인 재활용.

---

## 8. 기존 시스템과의 통합 영향

### 8.1 폐기 대상

- [x] `UHktVoxelCrowdRenderer` (캐릭터용) — **폐기**
- [x] 7-layer 복셀 스킨 시스템 — **폐기**
- [x] 32×32×48 복셀 플레이어 스펙 — **폐기**
- [x] 복셀 rigid part transform table — **폐기** (개념만 2D로 재활용)

### 8.2 유지 대상

- [x] `HktVoxelCore` (Binary Greedy Meshing, 지형 전용) — **유지**
- [x] HktCore VM (결정론) — **유지**
- [x] 터레인 6-layer 파이프라인 — **유지**
- [x] 8-color palette system — **유지** (스프라이트 틴트에 적용)
- [x] Niagara VFX 인프라 — **유지** (지형 상호작용용)
- [x] State Snapshot / Event Stream 2채널 — **유지**

### 8.3 신규 필요

- [ ] `HktSpriteCore` 플러그인 (신규)
- [ ] 스프라이트 아틀라스 스트리밍 시스템
- [ ] Y-axis billboard 머티리얼
- [ ] 앵커 포인트 자동 검출 파이프라인
- [ ] Loadout → CrowdRenderer 동기화 로직

---

## 9. 성능 예상

### 9.1 드로우콜 프로파일

10,000 캐릭터 on-screen 시나리오:

| 요소 | 드로우콜 |
|------|----------|
| Body HISM × N개 아틀라스 | ~5~10 |
| Head HISM × N개 아틀라스 | ~5~10 |
| Weapon HISM × N개 | ~3~5 |
| 기타 장비 슬롯 | ~5~10 |
| **총합** | **~20~40** |

복셀 파츠 HISM과 동등한 수준. 오히려 **쿼드 단위라 버텍스 수는 훨씬 적음.**

### 9.2 CPU 비용

- 프레임 리졸빙: 엔티티당 ~100ns (순수 함수, 캐시 친화적).
- 10k 엔티티 @ 60fps = 60μs/frame. 무시 가능.
- 병렬화 용이 — `ParallelFor`로 엔티티 배치 처리.

---

## 10. 열린 이슈 (차회 논의)

1. **카메라 시스템 확정** — 완전 고정 쿼터뷰(라그나로크 정통) vs. 제한된 줌/회전. 빌보드 구현에 직접 영향.
2. **해상도 정책** — 정통 라그나로크의 저해상도 픽셀 느낌 유지 vs. 고해상도 HD 스프라이트. 네이티브 해상도 결정.
3. **애니메이션 프레임 수 표준** — Walk 8frame? 12frame? AI 생성 비용 vs. 부드러움 트레이드오프.
4. **플레이어 커스터마이징 범위** — 라그나로크 정통은 헤어/의상/성별만. 프로젝트의 "모듈러 스킨 시혜 철학"을 어떻게 2D에서 재현할지.
5. **특수 포즈(수영, 기마, 비행)** — 기본 Body 시트 외에 어떤 특수 상태 시트를 두어야 하나.
6. **투사체/무기 궤적** — 2D 스프라이트 투사체 vs. 3D 라인 트레일. 복셀 세계와의 시각적 정합.

---

## 11. 구현 순서 제안

**Phase A — 기반 (1~2주)**
1. `HktSpriteCore` 플러그인 스켈레톤, 데이터 구조, 리졸버 순수 함수.
2. 단일 캐릭터(Body만) 렌더링 PoC. Y-axis billboard 머티리얼.
3. 고정 프레임 애니 재생 검증.

**Phase B — Crowd + 파츠 조합 (2주)**
4. `UHktSpriteCrowdRenderer` 구현. HISM 파츠별 배치.
5. Head/Weapon 부착, 앵커 포인트 시스템.
6. Loadout → CrowdRenderer 동기화.

**Phase C — AI 파이프라인 (3주)**
7. ControlNet + LoRA 파이프라인으로 테스트 캐릭터 1종 생성.
8. 자동 앵커 검출 or OpenPose 메타 보존.
9. 아틀라스 팩 + Data Asset 자동 생성 스크립트.

**Phase D — VFX 통합 (1주)**
10. 복셀 피격 파편(시그니처 룩) + 2D 이펙트 하이브리드.
11. 사망 dissolve.

**Phase E — Visual Target Zero**
12. 라그나로크 원작 스크린샷 1장 재현 테스트 — 복셀 지형 대체.

---

## 부록 A. 왜 이 방향이 맞는가 (핵심 논거)

1. **AI 강점 정확 타격** — 2D 이미지 생성은 AI 최강 분야. 3D 메쉬 생성의 약점(Meshy vs 복셀 논쟁)을 우회.
2. **스타일 일관성** — LoRA 하나로 전 캐릭터 커버. 복셀 스킨 시스템의 일관성 리스크 소멸.
3. **리깅/애니메이션 회피** — 가장 약한 고리를 아예 제거. 스켈레탈 메시, 웨이트 페인팅, IK 모두 불필요.
4. **기존 철학 승계** — Rigid Transform Table, Pure Function, HISM Crowd, Custom Primitive Data, 8-color palette 모두 그대로 사용.
5. **독특한 비주얼 포지셔닝** — 2026년 현재 "복셀 3D 지형 + 라그나로크 2D 스프라이트" 조합은 시장에 사실상 없음. MapleStory 2 공백과 라그나로크 향수를 동시 타격.

## 부록 B. 리스크 및 완화

| 리스크 | 완화 |
|--------|------|
| 3D-2D 시각적 이질감 | 스프라이트 셰이더에 복셀 월드 라이팅 수신(간이 per-pixel lighting) |
| 카메라 각도 제한 (Paper Mario 문제) | 피치 `[30°, 60°]` 락, 줌만 허용 |
| 커스터마이징 폭 감소 | 7-layer → 5-6 slot (Body/Head/Weapon/Shield/HeadgearT,M,L) + 틴트/팔레트 변이 |
| 그림자 품질 저하 | Blob shadow + 고해상도 스프라이트로 보완 |
| 과도한 스프라이트 스토리지 | 5방향 + mirror, BC7 압축, 아틀라스 스트리밍 |
