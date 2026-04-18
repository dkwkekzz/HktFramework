# RND: 3D Density Function Migration

> **상태:** 설계 (Phase 1 착수 대기)
> **모듈:** `HktVoxelTerrain` (Layer 3 확장)
> **의존:** `rnd-terrain-generator.md` v2 (Phase 0 완료 필수)
> **최종 수정:** 2026-04-17

---

## 0. 개요

Phase 0 terrain generator는 **heightmap 기반 2.5D 지형**을 생성한다. 이는 복셀 엔진의 핵심 장점인 **3D 지형 자유도**를 활용하지 못하는 한계가 있다.

본 RND는 Phase 0 완료 후 Layer 3를 **3D density function** 기반으로 점진적으로 전환하는 계획이다.

**최종 목표:** Minecraft 1.18 Caves & Cliffs 스타일의 지형 — 동굴, 오버행, 아치, 공중섬, 협곡이 자연스럽게 공존하는 3D 복셀 월드.

**"점진적"이 중요한 이유**

- Phase 0에서 검증된 결정론/경계/성능 자산을 최대한 재사용
- 각 단계가 독립적으로 테스트/롤백 가능해야 함
- 시각적 회귀(regression) 방지 — 이미 "괜찮아 보이는" Phase 0 지형을 망가뜨리지 않으면서 3D 요소만 추가
- 팀 규모(1~2명) 고려 시 big-bang 재작성은 리스크 과다

따라서 **4단계 마이그레이션**으로 나눈다. 각 단계는 2~4주 분량의 독립 작업이며, 각 단계 완료 시점에 월드가 "동작하는 상태"여야 한다.

---

## 1. 배경: Heightmap vs 3D Density

### 1.1 Heightmap (Phase 0)

```
for each (x, z):
    h = height(x, z)
    for y in [0, 256]:
        voxel(x, y, z) = y <= h ? Solid : Air
```

**장점:** 빠름 (16×16 = 256회 height 호출), 간단, 청크 경계 쉬움, 메모리 작음.

**한계:**
- **동굴 불가** — 높이 함수는 단조. y=50에 air, y=40에 solid는 불가능.
- **오버행 불가** — 같은 이유.
- **공중섬 불가** — 지면과 분리된 solid 영역 표현 불가.
- **다층 지형 불가** — 절벽 내부의 평지, 산 내부의 동굴 네트워크 등.

### 1.2 3D Density Function

```
for each (x, y, z):
    d = density(x, y, z)
    voxel(x, y, z) = d > 0 ? Solid : Air
```

**장점:** 3D 구조 완전 자유. 동굴, 오버행, 공중섬, 다층 지형 모두 자연 표현.

**한계:**
- **비용** — 16×16×256 = 65536회 density 호출. FBm 등 비싼 노이즈면 수십 ms.
- **복잡도** — 단순 지면 모양 제어가 어려움. 의도한 형태를 만들려면 여러 노이즈를 조합.
- **경계 처리** — 3D이므로 청크 경계가 6면으로 늘어남 (기존 4면). 경계 연속성 검증 복잡.
- **메모리/대역폭** — 동굴이 많아지면 Greedy Mesher의 효율이 떨어져 vertex 수 증가.

### 1.3 Minecraft 1.18의 접근

Minecraft가 채택한 구조 (참고용):

```
density(x, y, z) = 
    height_bias(y)                         // y별 기본 편향
  + final_density(continent, erosion, pv)  // 3D FBm
  + jaggedness(x, y, z) * noise            // 경사 변동
  - cave_carver(x, y, z)                   // 동굴 카빙
  + spaghetti_cave_offset                  // 긴 터널
  + aquifer_offset                         // 수위 변동
```

핵심 아이디어: **하나의 거대 density field = 여러 작은 field의 합성**. 각 field는 독립적으로 튜닝 가능.

---

## 2. 마이그레이션 4단계

```
┌──────────────────────────────────────────────────────────────┐
│ Stage 1: Density Floor (동등 전환)                           │
│   heightmap을 density로 재해석 — 시각적 차이 없음             │
│   목적: 인프라 구축, 성능 베이스라인 확보                     │
├──────────────────────────────────────────────────────────────┤
│ Stage 2: Cave Carver 추가                                    │
│   3D Worley/Perlin noise로 동굴 네트워크 새김                 │
│   목적: 첫 번째 순수 3D 구조                                  │
├──────────────────────────────────────────────────────────────┤
│ Stage 3: Overhang + 3D Variance                             │
│   표면 근처 3D 노이즈로 오버행/아치 자연 발생                 │
│   목적: heightmap 티 탈피                                     │
├──────────────────────────────────────────────────────────────┤
│ Stage 4: Floating Islands + Abyss 활성화                     │
│   공중섬, FloatingMeadow/VoidRift 이상 바이옴 완전 구현       │
│   목적: Phase 0에서 비활성화된 콘텐츠 해금                    │
└──────────────────────────────────────────────────────────────┘
```

각 단계는 **피처 플래그**로 제어한다:

```cpp
struct FHktTerrainPhase1Flags
{
    bool bUseDensityFloor         = false;  // Stage 1
    bool bEnableCaveCarver        = false;  // Stage 2
    bool bEnable3DVariance        = false;  // Stage 3
    bool bEnableFloatingIslands   = false;  // Stage 4
};
```

이 플래그로 각 단계를 independently 켜고 끌 수 있다. 회귀 발생 시 플래그만 내리면 즉시 이전 단계로 복구.

---

## 3. Stage 1 — Density Floor (동등 전환)

**목적:** heightmap 세계를 density function으로 **시각적으로 동일하게** 재구성. 3D 구조 추가는 없음. 이 단계는 *인프라 구축*이며, 성공 기준은 "Phase 0과 픽셀 단위 동일".

### 3.1 기본 공식

```
density(x, y, z) = height(x, z) - y
```

이 공식은 heightmap과 수학적으로 등가:
- `y < height` → `density > 0` → Solid
- `y > height` → `density < 0` → Air

즉 **기존 heightmap 함수를 density의 컴포넌트로 재포장**한다.

### 3.2 코드 구조

```cpp
// HktVoxelTerrain/Public/HktDensityField.h
class FHktDensityField
{
public:
    virtual float Sample(float WorldX, float WorldY, float WorldZ) const = 0;
};

// Stage 1에서 추가
class FHktHeightmapDensityField : public FHktDensityField
{
public:
    FHktHeightmapDensityField(FHktTerrainGenerator* Gen);
    virtual float Sample(float X, float Y, float Z) const override
    {
        float h = Gen->GetHeightmapHeight(X, Z);  // Phase 0의 함수 재사용
        return h - Y;
    }
};
```

### 3.3 Layer 3 단계 A 수정

```cpp
// Before (Phase 0)
for each (x, z):
    h = ComputeHeight(x, z);
    for (y = 0; y < 256; ++y):
        chunk.Set(x, y, z, y <= h ? Stone : Air);

// After (Stage 1)
for each (x, y, z):
    if (Flags.bUseDensityFloor):
        d = DensityField.Sample(worldX, y, worldZ);
        chunk.Set(x, y, z, d > 0 ? Stone : Air);
    else:
        // 기존 heightmap 경로 유지
        ...
```

### 3.4 성능 검증

- 순회 범위: 16×16×256 = 65536 (heightmap의 256배)
- 하지만 density field가 `height(x,z) - y` 한 번 + 뺄셈이므로 열당 1회 + 256회 비교
- **최적화:** (x, z)별로 height를 한 번 계산해 캐시 → heightmap과 동등한 비용
- **목표:** Phase 0 대비 +10% 이내

### 3.5 테스트

| 테스트 | 검증 |
|-------|------|
| `Stage1_BitwiseIdentical` | 동일 시드로 Stage 1 ON/OFF 결과가 비트 단위 동일 |
| `Stage1_Performance` | 평균 생성 시간 Phase 0 대비 +10% 이내 |

### 3.6 기간

**2주** — 순수 리팩토링. 새 기능 없음. 인터페이스 설계가 핵심.

---

## 4. Stage 2 — Cave Carver

**목적:** density field에 **감산 항(subtraction term)**을 추가해 3D 동굴 네트워크 생성.

### 4.1 공식 확장

```
density(x, y, z) = 
    height(x, z) - y                        // Stage 1 기본
  - CaveCarver(x, y, z) * CaveMask(x, z)    // Stage 2 신규
```

`CaveMask(x, z)`는 2D 노이즈로, 동굴이 밀집된 영역과 없는 영역을 구분한다 (서버 전체가 동굴 투성이가 되지 않도록).

### 4.2 Cave Carver 설계

**접근법 A: 3D Worley Noise (셀룰러 자동 동굴)**

```
worley = Worley3D(x/30, y/30, z/30, seed)
cave_strength = smoothstep(0.0, 0.4, worley)
```

Worley 노이즈는 자연스러운 "셀 구조"를 만든다. 적절히 튜닝하면 방-통로 형태의 동굴 네트워크.

**접근법 B: 3D Ridged Noise (긴 터널)**

```
ridged = 1 - abs(Perlin3D(x/50, y/50, z/50, seed))
cave_strength = pow(ridged, 4)
```

Ridged noise는 얇은 선형 구조를 만든다 → 뱀처럼 구불거리는 긴 터널.

**권장: 두 가지를 조합**

```
CaveCarver(x, y, z) = 
    WorleyCave(x, y, z) * 0.5              // 방 형태
  + RidgedCave(x, y, z) * 0.5              // 터널 형태
```

Minecraft는 이 둘을 명시적으로 분리해 사용 (noise caves + spaghetti caves).

### 4.3 Depth Gating

동굴이 **지표 근처**에만 생기지 않도록 y축 gating 추가:

```
depth_factor = smoothstep(5, 20, height(x, z) - y)
CaveCarver *= depth_factor
```

- 지표에서 5voxel 내: 동굴 없음 (지반 안정성)
- 지표에서 5~20voxel: 점진적 증가
- 20voxel 이상: 최대 강도

### 4.4 Lava/Water 처리

동굴이 해수면(y=60) 아래에 생기면 물 침수가 필요:

```
if (chunk.Get(x, y, z) == Air && y < 60):
    chunk.Set(x, y, z, Water);  // 또는 지하수위에 따라 Lava
```

간소화 버전: 해수면 일괄 적용. Phase 2에서 **aquifer(대수층)** 시스템으로 고도화.

### 4.5 성능

- 65536 voxel × Worley3D + Ridged 호출 = 수십만 회 노이즈
- 비용: 단일 청크 **30~50ms** 예상 (단순 구현)
- 최적화:
  - CaveMask로 동굴 없는 영역 조기 탈락 (대부분 청크는 동굴 없음)
  - SIMD batch noise (FastNoiseLite 지원)
  - Y 방향 stride 건너뛰기 + 보간 (노이즈 해상도 낮춤)

### 4.6 테스트

| 테스트 | 검증 |
|-------|------|
| `Stage2_CaveExistence` | 샘플 월드에서 동굴 voxel 비율이 기대 범위 내 (예: 전체 solid의 3~8%) |
| `Stage2_NoFloatingSolid` | 카빙 후 분리된 solid 덩어리가 없어야 함 (혹은 허용된 경우만) |
| `Stage2_CaveContinuity` | 청크 경계에서 동굴이 끊기지 않음 |
| `Stage2_Performance` | 단일 청크 80ms 이하 |

### 4.7 기간

**3~4주** — 튜닝이 핵심. 동굴이 "너무 많다/적다"의 균형 잡기에 시간 소모.

---

## 5. Stage 3 — Overhang + 3D Variance

**목적:** 지표 근처에 3D 노이즈 항을 추가해 **heightmap 티를 벗긴다**. 오버행, 아치, 울퉁불퉁한 절벽면 자연 발생.

### 5.1 공식 확장

```
density(x, y, z) = 
    height(x, z) - y                            // Stage 1
  - CaveCarver(x, y, z) * CaveMask(x, z)        // Stage 2
  + SurfaceVariance(x, y, z) * SurfaceMask(y)   // Stage 3 신규
```

`SurfaceVariance`는 **표면 근처에서만 활성화**되는 3D 노이즈:

```
SurfaceVariance(x, y, z) = Perlin3D(x/20, y/20, z/20, seed) * 8
SurfaceMask(y) = exp(-pow((y - height(x,z)) / 10, 2))  // 표면±10 voxel에서 강함
```

### 5.2 효과

- 절벽 표면이 **울퉁불퉁**해짐 (heightmap의 매끈한 곡면 소멸)
- 일부 지점에서 density 기여가 커져 **오버행** 생성
- 산 정상 근처에서 **돌 아치**가 자연 발생
- 평지에서는 노이즈 크기가 작아 영향 미미

### 5.3 바이옴별 강도 조정

Variance 강도를 바이옴별로 다르게:

```
variance_strength = {
    Grassland: 0.3,      // 평원은 부드럽게
    RockyMountain: 1.0,  // 산은 강하게 → 오버행/아치
    Desert: 0.5,         // 중간 (메사의 절벽 효과)
    SnowPeak: 0.8,       // 거친 고산
    CrystalForest: 1.2,  // 이상 바이옴은 극적으로
    VoidRift: 1.5,
    ...
}
```

### 5.4 부작용 관리

Variance가 과하면 **작은 떠 있는 돌덩어리**가 다수 생긴다. 처리:

**Option A:** 허용. 공중에 뜬 바위는 복셀 특유의 매력.
**Option B:** Post-process로 연결 컴포넌트 분석 → 크기 임계값 이하는 제거.
**Option C:** Variance를 위쪽 방향으로 비대칭 제한 (올림만 허용, 파임은 제한적).

초기에는 Option A로 시작하고 피드백 따라 조정.

### 5.5 테스트

| 테스트 | 검증 |
|-------|------|
| `Stage3_OverhangCount` | 샘플 월드에서 오버행 voxel 존재 확인 (위에 solid, 아래 air, 더 아래 solid) |
| `Stage3_NoExcessiveFloat` | 떠 있는 solid 덩어리 크기 분포가 기대 범위 |
| `Stage3_CliffVisualScore` | 시각 회귀 테스트 — 기준 렌더와 비교 (수동 리뷰) |

### 5.6 기간

**3주** — 바이옴별 튜닝이 많음.

---

## 6. Stage 4 — Floating Islands + Abyss

**목적:** 공중섬을 필요로 하는 콘텐츠(Abyss 대륙, FloatingMeadow / VoidRift 이상 바이옴) 활성화.

### 6.1 공식 확장

```
density(x, y, z) = 
    base_terrain + cave + variance              // Stage 1~3
  + FloatingIslandField(x, y, z) * IslandMask   // Stage 4 신규
```

`FloatingIslandField`는 **특정 고도대(예: y=120~180)에 떠 있는 solid 덩어리**를 생성:

```
IslandMask(x, z) = 
    1 if continent is Abyss OR biome is FloatingMeadow/VoidRift,
    0 otherwise

island_center_noise = FBm(x/300, z/300, 4, 2.0, 0.5, seed)
// 저주파 → 섬은 드문드문 나타남

FloatingIslandField(x, y, z) =
    (island_center_noise - 0.7)              // 0.7 이상에서만 양수 → 희소
  * exp(-pow((y - 150) / 20, 2))             // y=150 근처에서 최대
  * (1 + 0.3 * Perlin3D(x/15, y/15, z/15))   // 섬 내부 모양 노이즈
```

### 6.2 Abyss 대륙 재활성화

Phase 0에서 Pangea로 폴백되던 `Abyss`를 진짜로 활성화:

```
if continent == Abyss:
    base_terrain_multiplier = 0.2   // 기본 지면 매우 낮음
    island_mask = 1.0                // 공중섬 활성
```

### 6.3 이상 바이옴 재활성화

`FloatingMeadow`, `VoidRift` — Phase 0에서 폴백되던 것들 진짜로 활성화. 각각 전용 island shape/색상 매핑.

### 6.4 도전 과제

- **접근성** — 공중섬에 어떻게 도달? (점프, 날개, 갈고리, 포털 등 게임플레이 시스템 필요 — 본 RND 범위 외)
- **Greedy Mesher 영향** — 공중섬은 분리된 연결 컴포넌트. 메쉬 효율 저하 가능. 측정 필요.
- **청크 경계** — 공중섬이 청크 경계에 걸리면 N-청크 확장 필요. Layer 4 랜드마크와 동일한 메커니즘 재사용.

### 6.5 기간

**4주** — 게임플레이 연계 고려.

---

## 7. 공통 고려사항

### 7.1 결정론 유지

모든 단계에서 **순수 함수** 원칙 유지. `density(x, y, z)`는 `(WorldSeed, Epoch, x, y, z)`만의 함수.

### 7.2 Greedy Meshing 영향

3D 구조가 많아질수록 greedy meshing의 효율이 떨어진다:
- Phase 0: 열 단위로 solid가 연속 → greedy 면이 크게 합쳐짐
- Stage 2+: 동굴, 오버행 → 면이 잘게 쪼개짐
- 측정 필요: vertex count 증가율, draw call 증가율

각 Stage에서 벤치마크하고 성능 회귀 임계값 설정.

### 7.3 Greedy Meshing 외 메쉬 최적화

동굴 많은 지형에서 vertex 폭증 시:
- **Visibility occluder** — 땅 속 벽은 메쉬 생성 스킵
- **Surface-only extraction** — Dual Contouring 같은 대안 고려
- **LOD** — 멀리 있는 청크는 단순화 (이미 LOD 전략 있음)

### 7.4 Chunk Streaming 재평가

3D 지형은 **Y축 청크 분할**이 더 의미있어진다. 현재 `rnd-terrain-generator.md` 부록 C에 미해결 질문으로 남은 "Y축 청크 분할 여부"를 Stage 2 전에 결정해야 한다.

추천: **Stage 2 시작 전 Y축 32×8 분할 RND 선행** (`rnd-y-axis-chunking.md` 신설).

### 7.5 시각 회귀 방지

각 Stage 완료 시점에 **기준 월드 스크린샷**을 찍어 저장. 다음 Stage 진행 시 동일 좌표 렌더와 diff. 의도하지 않은 변화 조기 발견.

---

## 8. 전체 일정 요약

| Stage | 기간 | 출력 | 리스크 |
|-------|-----|------|--------|
| Stage 1: Density Floor | 2주 | 인프라 + Phase 0 동등 | 낮음 (리팩토링) |
| Stage 2: Cave Carver | 3~4주 | 동굴 네트워크 | 중간 (튜닝, 성능) |
| Stage 3: Overhang | 3주 | 오버행, 아치 | 중간 (부작용 관리) |
| Stage 4: Floating Islands | 4주 | 공중섬 완전 지원 | 높음 (게임플레이 연계) |

**전체: 12~13주 (3개월)**

Phase 0 완료 후 곧바로 시작할 필요는 없음. Phase 0로 로그라이트 프로토타입 검증을 먼저 하고, 이후 Phase 1 결정.

---

## 9. Go/No-Go 기준

각 Stage 종료 시 다음을 평가:

- **성능:** 단일 청크 생성 시간이 목표 이내 (Stage별 기준 별도 문서화)
- **시각 품질:** 수동 리뷰로 "Phase 0보다 확실히 나음" 확인
- **안정성:** 자동 테스트 전부 통과, 크래시 없음
- **결정론:** 동일 시드 → 동일 출력 여전히 성립

하나라도 실패하면 다음 Stage 진행 금지. 해당 Stage에서 멈추고 수정 또는 설계 재검토.

---

## 10. 폐기 시나리오

만약 Phase 1이 Phase 0 대비 기대한 가치를 주지 못한다면:

- **Stage 1~2까지만 유지** — 동굴만 얻고 오버행은 포기하는 선택도 유효
- **플래그로 완전 비활성화** — Phase 0 코드는 그대로 살아있으므로 언제든 롤백 가능
- **다른 방향 전환** — 예: Dual Contouring, 마칭 큐브 등 다른 3D 지형 기법 고려

점진적 마이그레이션의 가장 큰 장점: **어느 단계에서도 멈출 수 있다.**

---

## 부록: 참고 자료

- Minecraft 1.18 density function 공식: Wiki 및 역공학 자료
- "Fast Hydraulic Erosion Simulation and Visualization on GPU" (Mei et al.) — Phase 2 erosion 도입 시 참고
- FastNoiseLite SIMD batch API 문서
- Dual Contouring of Hermite Data (Ju et al.) — 대안 메쉬 기법
