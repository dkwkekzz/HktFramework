# C01-04 — Region 영속 상태 시스템 (ADR)

> **목적**: [`03-natural-spawners.md`](./03-natural-spawners.md) §5 에서 *이름만 합의* 된 13 개 region 카운터의 **저장 모델 · 읽기/쓰기 API · 결정론 · 영속화 · 복제** 를 결정한다. 본 문서가 통과하면 07 의 schema 2 JSON 본문이 region state 를 안전하게 참조할 수 있다.
> **상태**: ADR (Phase 0). 구현 착수 전, 데이터 모델 단일 출처.
> **상위**: [`README.md`](./README.md) · **선행**: [`03-natural-spawners.md`](./03-natural-spawners.md) · [`../../Design-VoxelSpawner.md`](../../Design-VoxelSpawner.md)
> **기록일**: 2026-05-13

---

## 0. 범위 / 비범위

### 범위
- 03 §5 의 카운터 13 종 (`Region.Lineages` ~ `Region.SeenTheGrain`) 이 **어디에 살고**, **VM 이 어떻게 읽고**, **누가 쓰는가** 의 합의.
- 본 시스템이 *서버 권위 + 결정론 + V2 컴플라이언스* 를 만족하는 방식의 채택.
- 신규 PropertyId·EntityType 명칭 컨벤션. 실제 매크로 등록은 후속 PR.

### 비범위
- 카운터별 임계치 곡선 (Quake dispatch 발화 조건) — 05/07 에서 결정.
- save-game 직렬화 포맷의 바이너리 스펙 — Phase 1 구현 PR.
- 클라이언트 UI 표기 (region 이름·뱃지·맵 마커) — Presentation 책임.
- 멀티 서버 / 샤딩 / cross-region 동기화 — 시즌 0 비범위.

---

## 1. 컴플라이언스 / 가드레일 (재확인)

| # | 항목 | 본 ADR 의 준수 방식 |
|---|---|---|
| **루트 절대 원칙 2** | `HktCore` UObject/UWorld 의존 0 | Region state 도 `FHktWorldState` SoA 내부에 산다. UObject 0. |
| **루트 절대 원칙 3** | 서버 권위, 클라는 `FHktWorldView` 읽기 전용 | 모든 카운터 갱신은 서버 VM 결과. 클라는 view-projection 만. |
| **루트 절대 원칙 4** | VM 은 WorldState 직접 쓰기 금지 | 모든 쓰기는 `FHktVMWorldStateProxy::SetPropertyDirty` 경유. |
| **루트 절대 원칙 6** | 컬럼 포인터 호이스팅 | RegionId → row 매핑은 dispatch *진입 1 회* 만 해석. 루프 안 `GetProperty` 금지. |
| **VM 메모리 모델** | 시뮬레이션 상태는 SoA 연속 컬럼만 — 해시·간접·산발 자료구조(TMap 등)는 시뮬레이션 진실의 일부가 될 수 없다 | 모든 region lookup 은 *SoA 선형 스캔* (`RegionIdKey` + `RecordKey` + `Archetype` 컬럼 매치). 보조 hash 인덱스 일체 도입 안 함. |
| **Design-VoxelSpawner.md 부록 A D1~D7** | Reg 네임스페이스 / RegisterIndex / Schema 1 / cpp 스니펫 신설 금지 | 본 ADR 은 *데이터 모델* 만 추가. 읽기/쓰기는 `FHktVar` + 기존 opcode (`LoadStore`) 조합. |
| **Design-VoxelSpawner.md 부록 A 신규 OpCode 정책** | 신규 opcode 기본 금지 | **opcode 추가 0**. region state 는 *별도 EntityType* 으로 표현 → 기존 `LoadStore` 가 그대로 동작. |
| **README §2 G1~G6** | spawner = `FHktTerrainSpawnerSpec` / Param0~3 / schema 2 / 서버 권위 | Region state 는 spawner spec 의 *결과물* 일 뿐, 진입 메커니즘을 추가하지 않는다. |

> **재확인**: 03 §6 의 "region 카운터 read/write 는 opcode 가 아닌 *시스템* 추가" 결정을 본 ADR 이 이행한다.

---

## 2. 문제 정의 — 13 카운터의 형태 분류

03 §5 의 표를 *데이터 형태* 로 재분류하면 세 묶음으로 줄어든다.

| 묶음 | 형태 | 본 PR 의 카운터 | 1 region 당 슬롯 수 |
|---|---|---|---|
| **A. Region-Scalar** | 정수 1 개 / region | `Region.HarvestedClusters` · `Region.FireCounter` · `Region.DeadTrees` · `Region.SuccessionPatches` · `Region.SeenTheGrain` | 5 (고정) |
| **B. Region-Map (sparse Key → Record)** | `(KeyHash) → struct` | `Region.Lineages[LineageId]` · `Region.FelledElders[LineageId]` · `Region.VariantCatalog[VariantId]` · `Region.NamedPeaks[id]` · `Region.OreDepleted[OreId]` | 가변 (sparse) |
| **C. Region-Set (append-only)** | `(KeyHash) → presence + lite payload` | `Region.CrossingPoints` · `Region.HardenedTrails[id]` · `Region.KnownSprings[id]` | 가변 (append) |

> B 와 C 의 차이: B 는 *카운터/구조체 갱신* (UPDATE 빈도 ≥ INSERT), C 는 *발견 시 1 회 등록* (INSERT-only + 후속 read). 둘 다 sparse — region 마다 등장 슬롯이 다르다.

**관찰**: 세 묶음 모두 `(RegionId, Key) → Value` 의 동일 추상으로 환원된다. A 는 Key 가 고정(=`PropertyId`), B 와 C 는 Key 가 동적(=`KeyHash`). 따라서 데이터 모델은 *RegionId 가 첫째 차원* 인 하나의 SoA 평면으로 충분하다.

---

## 3. 결정 (Decisions)

### D1 — Region 은 *Virtual Entity* 다. 별도 store 를 만들지 않는다.

본 ADR 의 핵심 결정.

```
[기각] 별도 IHktRegionStateSource 인터페이스 + 새 opcode
[기각] HktCore 외부 (HktRule 측) 의 region store + RPC
[채택] FHktWorldState 내부에 EntityType=Region / RegionRecord 두 종 추가
```

채택 사유:
1. **opcode 추가 0** — region scalar 읽기는 `LoadStore(MyVar, RegionEntity, PropertyId::FireCounter)` 그대로. §1-3 정책 준수.
2. **결정론 자동** — WorldState SoA 안에 살면 GGPO 롤백·체크섬·dirty 추적이 *공짜로* 따라온다 (절대 원칙 4).
3. **단일 진실** — region state 가 시뮬레이션 결과의 일부라는 사실이 데이터 위치로 자명. 외부 store 였다면 어디서 누가 갱신하는지 매번 추적해야 한다.
4. **WorldView 자동** — replication 도 entity 와 동일 경로. 클라 측 별도 채널 0.

> **트레이드오프**: 13 카운터 → 신규 `PropertyId` 5 개 (group A) + 신규 EntityType 2 개 + group B/C 의 record 슬롯 PropertyId 일부. PropertyId 256 슬롯 한도(`HktCoreProperties.h:43` 의 `NameTable[256]`)에 여유 있음 (현재 ~70 등록).

### D2 — RegionId 는 macro-tile 좌표 해시.

```cpp
// HktCore/Public/HktRegionId.h  (신규)
namespace HktRegionId
{
    // CVar: hkt.Region.TileSize  (default 8 chunks per side, 결정론 영향)
    int32 ToMacroTile(int32 ChunkCoord);

    // RegionId = ToMacroTile(ChunkX) | (ToMacroTile(ChunkY) << 16)
    uint32 FromChunkCoord(const FIntVector& ChunkCoord);
}
```

- 1 region = `TileSize × TileSize` 청크 (z 축은 region 키에 포함하지 않음 — 산/지하/지표 동일 region 공유).
- `TileSize` 는 *결정론 영향* 이므로 시뮬레이션 상수. CVar 노출은 디버그용 (`HktSimulationLimits` 헤더 상수에 고정해도 무방, 시즌 0 에는 CVar).
- spawner spec 의 `ChunkCoord` 에서 1 회 해석되어 `FHktEvent::Param2` 의 상위 비트에 인라인되거나, dispatch 시점에 ServerRule 이 부여 (§5 진입 패턴).

> 의문: relevancy group index 를 그대로 RegionId 로 쓰면? — 채택 안 함. relevancy 그룹은 *네트워크 가시성* 단위이고 ETM ε 단위로 동적 재계산될 수 있어 *지리적 정체성* 으로 부적합. macro-tile 은 지리만 본다.

### D3 — Group A (Scalar): RegionEntity 1 개 + PropertyId 5 종.

```cpp
// HktCore/Public/HktCoreProperties.h  (추가 — 후속 PR)
namespace HktProperty
{
    // ===== Region-Scalar (Cold tier — region 당 1 row, 자주 안 바뀜) =====
    HKT_DEFINE_PROPERTY(RegionFireCounter,        Cold)
    HKT_DEFINE_PROPERTY(RegionHarvestedClusters,  Cold)
    HKT_DEFINE_PROPERTY(RegionDeadTrees,          Cold)
    HKT_DEFINE_PROPERTY(RegionSuccessionPatches,  Cold)
    HKT_DEFINE_PROPERTY(RegionSeenTheGrain,       Cold)
}
```

- `Entity.Region` 태그 부여. 한 region 당 EntityId 1 개. EntityId 는 *처음 touch 되는 순간* lazy create. (Region 이 한 번도 카운터를 안 건드리면 row 도 없음 — sparse 유지.) EHktArchetype 확장은 *하지 않는다* — region/record 는 trait composition 이 필요 없는 pure 데이터 row, tag-only 식별이 더 자연스럽다.
- **Lookup 은 SoA 선형 스캔** — `FHktWorldState::FindOrCreateRegionEntity(RegionId)` 가 `Entity.Region` 태그 + `RegionIdKey` 컬럼을 직접 스캔해 매치. 보조 hash 인덱스 도입 안 함 (VM 메모리 모델 가드 §1). dispatch 진입에서 1 회 호출 후 vreg 에 EntityId 호이스팅.

### D4 — Group B (Map): RecordTag=`Entity.RegionRecord.{Lineage|Variant|OreSpecies}`, 1 record = 1 entity.

PR-3 구현은 *EHktArchetype 확장 없이* tag-only 식별 — `Entity.RegionRecord` (parent) + leaf tag 1 종으로 record 유형 구분. `RegionIdKey` (소속 region) + `RecordKey` (32bit 키) 2 컬럼은 모든 record 가 공유, 유형별 추가 컬럼만 별도.

| 카운터 | RecordTag | 핵심 PropertyId | 시즌 0 |
|---|---|---|---|
| `Region.Lineages[LineageId]` | `Entity.RegionRecord.Lineage` | `RegionIdKey` (공용), `RecordKey` (공용), `LineageElderPosX/Y/Z`, `LineageFelledCount`, `LineagePromotedCount` | ✅ PR-3 |
| `Region.FelledElders[LineageId]` | (재사용) `Entity.RegionRecord.Lineage` 의 `LineageFelledCount` | — | ✅ PR-3 |
| `Region.VariantCatalog[VariantId]` | `Entity.RegionRecord.Variant` | `RegionIdKey`, `RecordKey`, `VariantPotency`, `VariantFirstFoundFrame` | ✅ PR-3 |
| `Region.NamedPeaks[id]` | (예약) `Entity.RegionRecord.Peak` | (예약) `PeakPosX/Y/Z`, `PeakNameTagId`, `PeakNamedFrame` | ⏳ S08 |
| `Region.OreDepleted[OreId]` | `Entity.RegionRecord.OreSpecies` | `RegionIdKey`, `RecordKey`, `OreDepletedCount`, `OreCurrentSpeciesId` | ✅ PR-3 |

키 lookup 은 **SoA 선형 스캔** — `FHktWorldState::FindOrCreateRegionRecord(RegionId, RecordType, KeyHash)` 가 다음 4 조건을 동시 만족하는 row 를 SoA 에서 직접 찾는다:

```
조건: Archetype == RecordType
   AND RegionIdKey == RegionId
   AND RecordKey   == KeyHash
   AND Tag         contains Entity.RegionRecord
```

없으면 `AllocateEntity` 로 lazy create. 보조 hash 자료구조 일체 도입 안 함 (VM 메모리 모델 가드 §1). dispatch 진입에서 1 회 호출 후 vreg 에 EntityId 호이스팅, 이후는 SoA 컬럼 포인터 호이스팅(절대 원칙 6).

> **성능 가정**: 시즌 0 의 RegionRecord row 총합은 활성 region 당 ~25, 16 active region × 25 ≈ 400 row. spawner story 진입 시 1 회 스캔 → cold path. §11 의 트리거 조건 발화 시점에 별도 ADR 로 hash 도입 재검토.

### D5 — Group C (Set): EntityType=`RegionFeature` 1 종 + `FeatureKind` 컬럼.

```cpp
HKT_DEFINE_PROPERTY(FeatureRegion,    Cold)   // 소속 RegionId
HKT_DEFINE_PROPERTY(FeatureKind,      Cold)   // 0=CrossingPoint, 1=HardenedTrail, 2=KnownSpring (확장)
HKT_DEFINE_PROPERTY(FeatureKey,       Cold)   // KeyHash
HKT_DEFINE_PROPERTY(FeaturePosX,      Cold)
HKT_DEFINE_PROPERTY(FeaturePosY,      Cold)
HKT_DEFINE_PROPERTY(FeaturePosZ,      Cold)
HKT_DEFINE_PROPERTY(FeaturePayload0,  Cold)   // kind 별 의미 자유 (e.g. quality, length)
HKT_DEFINE_PROPERTY(FeaturePayload1,  Cold)
```

Set 의 3 종 (CrossingPoint / HardenedTrail / KnownSpring) 은 *컬럼 형상이 동일* 하므로 EntityType 1 개로 통합 (`FeatureKind` 로 분기). 시즌 0 이후 형상이 갈리면 분리.

> 의문: 위치 좌표가 PropertyId 로 3 개 (X/Y/Z) — 일반 entity 의 `PosX/Y/Z` 를 재사용 못 하나? — 안 함. RegionFeature 는 *데이터 entity* 라 transform/collision/anim 컬럼이 없는 sparse row. `PosX/Y/Z` 가 Hot tier 라 메모리 비용 발생. `FeaturePosX/Y/Z` 는 Cold tier 로 분리.

### D6 — 쓰기는 *RegionWrite Builder Helper* 1 종으로만.

```cpp
// HktCore/Public/HktStoryBuilder.h  (확장 — host-call opcode 1, property 어드레싱 모드 신규 0)
class FHktStoryBuilder
{
public:
    // group A — scalar +=N
    void RegionAddScalar(FHktVar RegionIdVar, uint16 PropId, FHktVar DeltaVar);

    // group B — map 의 기존 record read (없으면 default)
    FHktVarBlock RegionMapRead(FHktVar RegionIdVar, uint16 EntityTypeId, FHktVar KeyVar,
                               TConstArrayView<uint16> RecordProps);

    // group B — map 의 record 갱신 (없으면 create + 채움)
    void RegionMapWrite(FHktVar RegionIdVar, uint16 EntityTypeId, FHktVar KeyVar,
                        TConstArrayView<uint16> RecordProps, FHktVarBlock Values);

    // group C — set append (KeyHash 중복 시 idempotent)
    void RegionFeatureAdd(FHktVar RegionIdVar, uint8 FeatureKind, FHktVar KeyVar,
                          FHktVarBlock Position, FHktVar Payload0, FHktVar Payload1);
};
```

- 이 helper 들은 **빌더 레벨 매크로 expansion**. PR-3 의 `RegionMapRead`/`Write` 는 신규 host-call opcode `RegionMapFindOrCreate` 1 개 + 기존 `LoadStoreEntity`/`SaveStoreEntity` 시퀀스. property 어드레싱 모드 신규 0 — §1-3 정책의 본래 의도 (indexed addressing 금지) 그대로 준수.
- `RecordTag` 는 `FGameplayTag` (`Entity.RegionRecord.{Lineage|Variant|OreSpecies}`) — Builder 시그니처에 직접 전달, NetIndex 로 인코딩되어 opcode Imm12 슬롯 (12-bit) 에 적재.
- `RegionIdVar` 는 spawner story 진입 시 `SpawnerParams::SpawnerRegion` (Param2 상위 비트 또는 별도 별칭) 으로 받는다 (§5).

### D7 — `SpawnerParams::SpawnerRegion` 컨벤션 추가.

`HktStoryEventParams.h` 에 별칭 1 줄 추가:

```cpp
namespace SpawnerParams
{
    // 03 의 spawner story 가 Region 카운터를 읽기 위한 entry-context.
    // ServerRule 의 spawner dispatch 단계에서 macro-tile 해석 후 인라인.
    inline const uint16 SpawnerRegion = PropertyId::Param2;
}
```

- Param2 의 *기존 의미* (e.g. `SpawnerSlot0`) 와 충돌하는 spawner 는 Param3 로 밀거나, 두 의미가 region 도출용 sub-field 로 공존 (e.g. 상위 16 bit = RegionId, 하위 16 bit = SlotHash low). 03 §3 의 각 spawner spec 에서 *spawner 본문이 자체적으로 의미 부여* (Design-VoxelSpawner.md §Schema 2 본문 컨벤션).
- archetype 강제 분류 부활 아님 — Design-VoxelSpawner.md 부록 B ADR 준수: 별칭 1 줄.

---

## 4. 결정론 (Determinism Contract)

| # | 항목 | 보장 방식 |
|---|---|---|
| **T1** | RegionId 계산 | `HktRegionId::FromChunkCoord` 는 순수 정수 연산. 모든 클라/서버 동일 결과. `TileSize` 는 결정론 상수. |
| **T2** | Scalar 카운터 갱신 | `Add` opcode + `SetPropertyDirty` 경로. GGPO 롤백 시 dirty queue 가 함께 복원. |
| **T3** | Map record create | SoA row 신설 → `Diff.SpawnedEntities` 자동 push. `RegionIdKey`/`RecordKey` set → `Diff.PropertyDeltas` 자동 push. 롤백 시 `UndoDiff` 가 `RemoveEntity` 로 row 회수 — *별도 인덱스 보정 0* (보조 인덱스 자체가 없음). |
| **T4** | Set append idempotent | 동일 (RegionId, Kind, KeyHash) 가 이미 있으면 row 재생성 X. — 이벤트 중복 발화 시에도 region state 동일. |
| **T5** | 클라/서버 체크섬 | RegionEntity 류는 일반 entity 와 동일 SoA 컬럼이므로 기존 체크섬 함수에 자동 포함. |
| **T6** | 순서 의존 | 같은 dispatch tick 내 여러 spawner 가 같은 카운터를 건드리면 *spawner index 오름차순* 으로 직렬 적용 (PendingGroupIntents 큐의 enumeration 순서가 결정론적). |

---

## 5. 진입 / 갱신 패턴 (Runtime Flow)

```
[Server 청크 로드]
   FHktTerrainSystem::Process
      └─▶ GetChunkSpawners → FHktEvent (HktEventBuilder::SpawnerFromView)
              ├─ Location, Param0~1 (anchor) — Design-VoxelSpawner.md §Runtime 진입 메커니즘
              └─ Param2/3 — spawner 본문 의미 자유
                  └─ ServerRule 이 dispatch 직전에 RegionId 를 1 회 해석:
                     RegionId = HktRegionId::FromChunkCoord(ChunkCoord)
                     SpawnerParams::SpawnerRegion (= Param2) 의 일부 슬롯에 인라인

[VM 실행 — spawner story 본문]
   LoadStore(MyRegion, SpawnerParams::SpawnerRegion)     // vreg ← Param2
   ↓
   B.RegionAddScalar(MyRegion, PropertyId::RegionFireCounter, DeltaVar)
      ├─ FindOrCreateRegionEntity(RegionId) — SoA 선형 스캔 (Entity.Region + RegionIdKey)
      │  └─ 없으면: AllocateEntity + AddTag(Entity.Region) + SetProperty(RegionIdKey)
      └─ 기존 컬럼 포인터 호이스팅 → SetPropertyDirty(EntityRow, RegionFireCounter, NewValue)

[Replication]
   WorldState SoA → FHktWorldView projection (기존 경로)
      └─ 클라가 Entity.Region / Entity.RegionRecord.* 의 컬럼을 fan-in
          (Presentation 의 region UI 가 read)
```

VM 측 변경 0, 새 진입 API 0, 새 prefill 0 — Design-VoxelSpawner.md §Runtime 진입 메커니즘 과 동일 단일 경로.

---

## 6. 영속화 (Save / Load)

### 6-1. 무엇이 save 대상인가
- **save**: `Entity.Region` (RegionEntity) + `Entity.RegionRecord.{Lineage|Variant|OreSpecies}` (시즌 0) + 향후 `.Peak` / `.Feature` 가 부여된 모든 SoA row.
- **save 안 함**: 일반 entity (Unit/Projectile/...) 의 *시뮬 영속* 처리 정책은 별도 (Design-VoxelSpawner.md §청크 언로드 정책 (미결)).

### 6-2. 저장소
- save-game asset 의 별도 섹션 `RegionStateBlob`. **SoA 컬럼 단위로 직렬화** (entity row 별 직렬화가 아님 — 캐시 친화).
- 보조 인덱스 없음 — SoA 가 유일한 진실의 원천이므로 별도 재구축 단계도 불필요. load 직후 `FindOrCreateRegionEntity` / `FindOrCreateRegionRecord` 가 그대로 동작.

### 6-3. 마이그레이션
- `RegionStateBlobVersion` 1 부터 시작. 컬럼 추가는 *뒤에 append* 만 허용 (기존 row 의 미지정 컬럼은 0 으로 기본값).
- EntityType 추가는 새 섹션 추가 — 기존 save 는 빈 섹션.

### 6-4. 트리거
- 서버 종료 / 자동 저장 주기 / *region 이 active 권역에서 빠지는 순간* 의 셋 중 어느 시점에 flush 할지는 본 ADR 범위 밖 (Phase 1).

---

## 7. 복제 (Replication / WorldView)

- RegionEntity 류는 일반 entity 와 동일하게 `FHktWorldView` 에 projection.
- **relevancy 규칙**: 클라가 진입한 region 의 `Entity.Region` row 만 (+ 그 region 에 소속된 `Entity.RegionRecord.*` row) view 에 포함. 이웃 region 은 (시각화 hint 가 필요한 경우만) lite projection.
- `FHktWorldView::GetRegion(RegionId)` 보조 헬퍼 — UI/Presentation 이 자주 쓰는 패턴 단축.

> 클라가 region 카운터를 직접 *판정* 하지 않는다 (절대 원칙 3). 임계치 dispatch 는 서버에서만.

---

## 8. 영향 파일 (Phase 1 — 추정)

### HktCore
| 파일 | 변경 | 상태 |
|---|---|---|
| `HktCore/Public/Terrain/HktRegionId.h`+cpp | 신규 — RegionId 계산 | ✅ PR-2 |
| `HktCore/Public/HktCoreProperties.h` | Group A 11 종 (PR-2) + Group B 10 종 (PR-3: `RecordKey` 공용 + Lineage 5 + Variant 2 + Ore 2). Group C (Feature) 는 시즌 0 비범위. | ✅ PR-2/3 |
| `HktCore/Public/HktCoreDefs.h`+cpp | `Entity.Region` (PR-2) + `Entity.RegionRecord` parent + `.Lineage` / `.Variant` / `.OreSpecies` (PR-3). EHktArchetype 확장 *안 함* — record 는 trait composition 불필요한 pure 데이터 row, tag-only 식별이 PR-2 패턴과 일관. `RegionPeak` / `RegionFeature` 는 S07/S08 진입 시 추가. | ✅ PR-2/3 |
| `HktCore/Public/HktWorldState.h`+cpp | `FindOrCreateRegionEntity(RegionId)` (PR-2) + `FindOrCreateRegionRecord(RegionId, FGameplayTag, KeyHash)` (PR-3) — 동일 SoA 선형 스캔 패턴 | ✅ PR-2/3 |
| `HktCore/Public/HktStoryBuilder.h`+cpp | `RegionAddScalar` (PR-2) + `RegionMapFindOrCreate` / `RegionMapRead` / `RegionMapWrite` (PR-3). `RegionFeatureAdd` 는 시즌 0 비범위. | ✅ PR-2/3 |
| `HktCore/Public/HktStoryEventParams.h` | `SpawnerParams::SpawnerRegion` 별칭 | (PR-4 dispatch 단계에서 필요해질 때 추가) |
| `HktCore/Public/HktStoryTypes.h` | EOpCode 신규: `RegionMapFindOrCreate(W,R,R)` host-call. (PR-3) | ✅ PR-3 |
| `HktCore/Private/VM/HktVMInterpreter.{h,cpp}`+`Actions.cpp` | `Op_RegionMapFindOrCreate` dispatch + 구현 + Precondition skip. (PR-3) | ✅ PR-3 |
| `HktCore/Private/HktStoryValidator.cpp` | Entity-reg flow 추적 (Dst=writer, Src1=reader). (PR-3) | ✅ PR-3 |
| `HktCore/Private/VM/HktVMWorldStateProxy.cpp` | 별도 host fn 노출 *불필요* — interpreter 가 직접 `WorldState::FindOrCreateRegionRecord` 호출. lazy create 의 `AllocateEntity` / `AddTag` / `SetProperty` 가 기존 dirty 추적 경로 그대로 사용. | ✅ PR-3 (수정 없음) |

### HktRule
| 파일 | 변경 |
|---|---|
| `HktRule/Private/HktServerRule.cpp` | spawner dispatch 분기에 `RegionId = FromChunkCoord(...)` 1 회 해석 + Param2 인라인 |

### HktPresentation
| 파일 | 변경 |
|---|---|
| (시즌 0 후속) | RegionEntity 류의 lite UI — 본 PR 비범위 |

---

## 9. 마이그레이션 / 단계

| 단계 | 작업 | 호환 | 상태 |
|---|---|---|---|
| **M0** | 본 ADR 승인 | — | ✅ |
| **M1** | `HktRegionId.h` + `Entity.Region` 태그 + PropertyId Group A 11 종 등록. WorldState `FindOrCreateRegionEntity` (lazy create). EHktArchetype 확장 *없이* tag-only 식별로 채택. | 기존 시뮬 무영향. | ✅ PR-2 (`16bed00`, `ca511be`) |
| **M2** | Group B 의 RegionRecord 3 종 (Lineage / Variant / OreSpecies) + `FindOrCreateRegionRecord` SoA 스캔 + `RegionMapFindOrCreate` host-call opcode + Builder helper 3 종. 자동화 테스트 6 개 (create / cache hit / multi-key / cross-region / VM write / lazy create). | 기존 story 무영향. | ✅ PR-3 (`4980977`) |
| **M3** | Group C `RegionFeature` (S06/S07/S10) + `RegionPeak` (S08 명명권) — 해당 spawner 진입 PR 에서 점진 추가. | save asset 버전 +1. | ⏳ 대기 (S06/S07/S08) |
| **M4** | 03 의 11 spawner 중 region 카운터 의존 종의 JSON 본문에서 helper 사용 — 07 시리즈 PR 군. PR-4 Birch (scalar만) → PR-5 Oak (Lineage map 첫 실사용) → PR-6 BerryBush (Variant) → PR-8 Ore. | 07-story-bodies 의존성 해소. | ⏳ 다음 (PR-4 Birch) |
| **M5** | save flush 정책 + region offload (Phase 1 마무리). | save asset 버전 고정. | ⏳ Phase 1 후반 |

---

## 10. 오픈 이슈

| # | 이슈 | 옵션 | 우선순위 |
|---|---|---|---|
| **R1** | TileSize 결정값 (4 / 8 / 16) | 풀숲 region 의 *체감 단위* 가 어느 정도인지 03 의 dispatch 그래프와 매칭해서 결정 | High — M1 전 |
| **R2** | `LineageId` 의 비트 폭 (현재 16 bit 가정) | sparse 가정 하 16 bit 충돌 확률 — region 당 ~1k Elder 까지 안전 | Mid — M2 |
| **R3** | 명명권(`NamedPeaks`) 의 tag id 가 GameplayTag NetIndex 인가 별도 사전인가 | NetIndex 는 *세션 단위 안정* 이므로 영속에 부적합 → 별도 region-local 사전 | Mid — M3 |
| **R4** | 보조 hash 인덱스 도입 여부 | VM 메모리 모델 가드 §1 — 시뮬레이션 상태는 SoA 만. hash 일체 도입 안 함. SoA 선형 스캔으로 충분 (시즌 0 row 총합 추정 < 수백). | Resolved: 도입 안 함 |
| **R5** | RegionEntity 류의 relevancy — 인접 region 까지 view 에 포함? | (a) 진입한 region 만 / (b) 인접 1-ring lite / (c) 항상 전체 region 메타 | Mid — 시즌 0 은 (a) |
| **R6** | save flush 시점 | 종료 / 주기 / region offload | Low — M5 |
| **R7** | 카운터 *감소* 정책 (남획 → 자연 복원) | 03 S03 의 `ClusterCount` 감소 패턴이 1 차 예 — 다른 카운터에도 일반화? | Mid — 시즌 0 후 |

---

## 11. 무엇이 본 ADR 의 트리거가 되어 재검토 되어야 하는가

- region 카운터의 형태가 group A/B/C 의 어느 것도 아닌 경우 (예: time-series log)
- 한 region 의 RegionEntity 류 row 합계가 수천을 넘어 `FindOrCreateRegionRecord` 의 SoA 선형 스캔이 프로파일러 hot-path 로 잡히는 경우 → *VM 메모리 모델을 깨지 않는* 가속 자료구조 (예: SoA 안의 정렬 컬럼 + 이진탐색, 또는 청크 단위 row 클러스터링) 별도 ADR 로 검토
- save asset 의 region blob 이 메모리 한도를 초과하는 경우 → region-by-region lazy load 로 전환

위 조건이 *실제로 측정* 될 때 별도 ADR 로 갱신. 본 시점에는 채택 결정 유지.

---

## 12. 결정 요약 (1 화면)

```
Region 영속 상태
  ├─ 어디에?   FHktWorldState 안 (Virtual Entity 6 종)
  ├─ 어떻게?   기존 LoadStoreEntity/SaveStoreEntity opcode + Builder helper. host-call opcode 1 신규 (RegionMapFindOrCreate, PR-3) — property 어드레싱 모드 신규 0.
  ├─ 키:        RegionId = macro-tile 좌표 해시 (TileSize 결정론 상수)
  ├─ 결정론:   SoA 컬럼 + SetPropertyDirty → GGPO 자동
  ├─ 영속:     RegionStateBlob (컬럼 단위 직렬화), 인덱스는 load 후 재구축
  ├─ 복제:     WorldView projection (entity 와 동일 경로)
  └─ 진입:     spawner story → Param2 (SpawnerRegion 별칭) → RegionWrite helper
```

다음 후속 PR (`05-interactions.md` / `07-story-bodies/`) 은 본 ADR 의 D1~D7 을 인용해 region state 를 안전하게 참조한다. 본 ADR 을 거스르는 새 store 가 등장하면 §1 / §3-D1 을 인용해 PR 차단.
