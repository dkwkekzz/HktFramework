# C01-01 — 자연 Entity 카탈로그

> **목적**: TranquilWilds 의 풀숲/강/산이 *지형 베이크* 만으로 자연스럽게 깔리도록 하는 entity 들의 1차 목록.
> **상태**: Skeletal. 각 entity 의 시뮬레이션 속성 / 시각 에셋 / Story 시드는 후속 문서에서 채운다.
> **상위**: [`README.md`](./README.md)
> **다음**: [`02-natural-growth.md`](./02-natural-growth.md)

---

## 0. 범위 / 비범위

### 범위
- **자연적으로 깔리는** entity 만. 즉 베이크 시점에 `FHktTerrainSpawnerSpec` 으로 직렬화되어 청크 로드 시 시뮬레이션에 진입.
- 풀숲 / 강 / 산 의 3 대 지형 feature 에 분배.

### 비범위
- 적대 NPC / 보스 / 야생 동물 본체 → Step 4 (Story 시드) 에서 정의.
- 플레이어가 설치/건축한 entity (`Entity.Building.*`) → 본 컨셉 밖.
- 광역 환경 상태 (날씨/계절) → L2 환경 레이어 (별도).

---

## 1. 분배 원칙

| 지형 feature | 주(主) entity 가족 | 부(副) entity 가족 |
|---|---|---|
| 풀숲 평지 | Flora | Trace |
| 강가 / 수면 | Water · Flora(Reed/Lily) | Trace |
| 경사면 (풀숲 → 산) | Flora(Pine 우세) · Geology | — |
| 산봉 / 절벽 | Mountain · Geology | — |
| 지하 / 동굴 입구 | Geology(CaveMouth) | — |

> Biome 경계 (풀숲↔산) 는 두 분포의 가중 평균. `FHktTerrainSpawnerSpec::BiomeId` 가 베이크 시 자동 부여 (Design-VoxelSpawner.md §Generator 파이프라인).

---

## 2. Entity 카탈로그 (총 20)

각 행은 **사양 한 줄 + 1~2 줄 설명** 만 둔다. 후속 문서에서 확장.

### 2-1. Flora (식물군) — 10

| # | Tag | 한글 | 분포 | 1차 역할 | 비고 |
|---|---|---|---|---|---|
| F01 | `Entity.Natural.Flora.Grass` | 잡초 | 풀숲 평지 (밀집) | 시각 베이스 · 채집 X | 가장 흔함. 화재로 사라짐 (L2 연동) |
| F02 | `Entity.Natural.Flora.Shrub` | 떨기나무 | 풀숲 / 경사 하단 | 시야 차단 · 은신 | 동물 흔적의 시작점 (Trace 와 결합) |
| F03 | `Entity.Natural.Flora.Birch` | 자작나무 | 풀숲 → 산 전이대 | 채집(목재 소) | 곧고 빠르게 자람 |
| F04 | `Entity.Natural.Flora.Oak` | 참나무 | 풀숲 (군집) | 채집(목재 대) · 그늘 | 도토리 → BerryBush 대체 후보 |
| F05 | `Entity.Natural.Flora.Pine` | 소나무 | 경사면 / 산 하단 | 채집(목재) · 송진 | 화재 가속 |
| F06 | `Entity.Natural.Flora.BerryBush` | 야생 베리 | 풀숲 + 강가 | 채집(식량) | 계절성(시즌 0 에는 무시) |
| F07 | `Entity.Natural.Flora.Herb` | 약초 | 풀숲 (희소) | 채집(회복재) | 변종(`Entity.Attr.*` 부가) 시드 |
| F08 | `Entity.Natural.Flora.Mushroom` | 버섯 | 그늘 / Oak 인근 | 채집 + 위험 | 일부 변종은 환각/독 (후속) |
| F09 | `Entity.Natural.Flora.Reed` | 갈대 | 강가 수면 인접 | 채집(공예) · 은신 | 물 흐름 시각 큐 |
| F10 | `Entity.Natural.Flora.WaterLily` | 물 백합 | 호수/늪 수면 | 채집(약초) · 발판 | 폭우 시 떠내려감 |

### 2-2. Geology (지질) — 4

| # | Tag | 한글 | 분포 | 1차 역할 | 비고 |
|---|---|---|---|---|---|
| G01 | `Entity.Natural.Geology.Boulder` | 큰 바위 | 풀숲 / 경사 | 시야 차단 · 채광 단단 | 부수면 자갈 N개 |
| G02 | `Entity.Natural.Geology.OreOutcrop` | 광맥 노출 | 산 / 절벽 | 채광 자원 | 광종(Param2 로 분기) |
| G03 | `Entity.Natural.Geology.Pebble` | 자갈 | 강가 / 산악 | 투척 · 공예 | Boulder 파괴 부산물 |
| G04 | `Entity.Natural.Geology.CaveMouth` | 동굴 입구 | 산 하단 / 절벽 | 입구 (다른 region 진입) | Story dispatch 핵심 |

### 2-3. Water (수계) — 3

| # | Tag | 한글 | 분포 | 1차 역할 | 비고 |
|---|---|---|---|---|---|
| W01 | `Entity.Natural.Water.Ford` | 얕은 여울 | 강 횡단 가능 지점 | 횡단 비트 (탐색 분기) | 우회 강제 핵심 |
| W02 | `Entity.Natural.Water.Waterfall` | 폭포 | 산↔평지 고도 차 | 시그널 S3~S4 (지평선 큐) | 음향 큐 |
| W03 | `Entity.Natural.Water.Spring` | 옹달샘 | 산기슭 | 회복 hotspot · 모임 | NPC 만남 spawn 시드 |

### 2-4. Mountain (산악) — 1

| # | Tag | 한글 | 분포 | 1차 역할 | 비고 |
|---|---|---|---|---|---|
| M01 | `Entity.Natural.Mountain.Peak` | 산봉우리 | 산 정상 | 조망 보상 · 명명권 | 1 region 당 1~3 개 |

### 2-5. Trace (자연 흔적) — 2

| # | Tag | 한글 | 분포 | 1차 역할 | 비고 |
|---|---|---|---|---|---|
| T01 | `Entity.Natural.Trace.FallenLog` | 쓰러진 통나무 | 풀숲 / 산 하단 | 채집(목재) · 임시 다리 | Oak/Pine 가 자연 사멸 시 생성 |
| T02 | `Entity.Natural.Trace.AnimalTrail` | 동물 흔적 | 풀숲 평지 | 탐색 단서 (Story 시드) | 따라가면 Spring/Burrow 로 수렴 |

---

## 3. 공통 속성 스키마 (skeleton)

각 entity 는 후속 PR 에서 다음 필드를 채운다. **본 PR 은 표 항목만 명시.**

```text
// FHktEntityNaturalSpec  (HktCore 측 정의 예정 — 이름은 잠정)
Tag                : FGameplayTag           // Entity.Natural.*
Density            : FHktFixed32            // 청크 평균 출현 비율 (Q16.16)
BiomeMask          : uint32                 // 등장 가능 biome 비트마스크
SlopeRange         : (FHktFixed32, FHktFixed32)  // 경사 허용
ElevationRange     : (FHktFixed32, FHktFixed32)  // 고도 허용
SpawnerStoryTag    : FGameplayTag           // 깔 때 실행할 Story (Spawner.Story.Natural.*)
GrowthStoryTag     : FGameplayTag           // 자연 성장 Story (선택)
Param0..3 의미     : (per-entity 결정 — SpawnerParams:: 별칭으로 표현)
```

> **G1 / G4 컴플라이언스**: 위 구조는 직렬화 전용 `FHktTerrainSpawnerSpec` 으로 환원되어야 한다. 자체 진입 메커니즘을 추가하지 않는다.

---

## 4. 결정론 / 베이크 메모

- 위치는 청크 베이크 시점에 `SlotHash = hash(ChunkCoord, SlotIndex)` 로 고정. 재로드 시 동일 출현 (Design-VoxelSpawner.md §Runtime 결정론).
- `Density` 는 청크 단위 quota 로 환산 — 슬롯 추출 단계 (Design-VoxelSpawner.md §Generator 파이프라인) 에서 노이즈 + biome 가중치로 정수 카운트화.
- `BiomeMask` 는 베이크 시 청크 실제 biome 과 교집합 검증 (Design-VoxelSpawner.md §Generator 파이프라인 검증 단계).

---

## 5. 오픈 이슈

| # | 이슈 | 메모 |
|---|---|---|
| N1 | F08 Mushroom 의 독성 변종을 entity 변형으로 둘 것인지, 별도 entity tag 로 둘 것인지 | 후속 02-natural-growth 에서 결정 |
| N2 | T02 AnimalTrail 은 entity 가 아닌 *지형 마커* 인지 | 시뮬레이션 entity 로 두는 편이 dispatch 가 단순 — 본 PR 에서는 entity 로 가정 |
| N3 | W01 Ford 는 지형 자체 feature 인데 spawner spec 으로 둘 가치가 있는가 | Story 진입점으로서 식별자가 필요 → entity 로 유지 |
| N4 | 20개를 한 region 에 다 깔 것인가, biome 별 부분집합인가 | 후속 — region 분포표 별도 |
