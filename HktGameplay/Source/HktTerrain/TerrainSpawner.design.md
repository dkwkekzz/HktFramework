# Terrain Spawner 통합 설계도

> **상태**: 설계 단계. 구현 착수 전. 본 문서는 의사결정의 단일 출처.
> **브랜치**: `claude/terrain-spawner-planning-R2Jp3`
> **관련 모듈**: `HktTerrain`(주체) · `HktCore/HktStory`(행동) · `HktMapGenerator`(어댑터·마이그레이션 대상)

---

## 0. 목표 / 비목표

### 목표
- `HktTerrain`이 지형 베이크와 함께 **Spawner 데이터를 단일 출처로 보유**.
- Spawner의 동작은 **전부 Story bytecode**로 표현 (웨이브·매복·패트롤·연쇄·조건부 등 복합 패턴).
- Bake 시점에 LLM이 (지형 컨텍스트 → Story archetype) 매핑을 정적으로 결정 → 런타임 결정론 0 비용.

### 비목표
- 런타임 절차적 spawner 배치(추후 별도 설계).
- Spawner UI/디버거(별도).
- 기존 32개 cpp 스토리 재작성(레거시 보존, PR-3 마이그레이션 일정에 따름).

---

## 1. V2 마이그레이션 컴플라이언스 (절대 준수)

> **본 통합으로 신설되는 모든 코드는 Story V2 (PR-2 / JSON schema 2) 정합이어야 한다.**
> 위반 시 PR 거부. 본 섹션은 두 번 다시 V2 방향을 거스르는 설계가 나오지 않도록 박아두는 가드레일이다.

### 1-1. 금지 (Hard Don't)

| # | 금지 사항 | 근거 |
|---|---|---|
| **D1** | `namespace Reg` (`Reg::R0~R9`, `Reg::Self/Target/Spawned/Hit/Iter/Flag/Count`) **참조 금지** | `HktStoryTypes.h:21-23` — deprecated. PR-3에서 제거 예정. |
| **D2** | `RegisterIndex` 타입을 인자/반환으로 받는 **신규 메서드 정의 금지** | 신 API는 `FHktVar`/`FHktVarBlock`. 기존 deprecated 시그니처와 공존만 허용. |
| **D3** | 특수 레지스터 슬롯(R10~R15) **신규 의미 부여 금지** (예: `SpawnerOrigin`, `SpawnerBiome` 등을 새 슬롯으로 잡지 않는다) | D1 영역 확장. strangler-fig 방향 역행. |
| **D4** | 신규 Story를 cpp 스니펫(`HktStory/Public/Snippets/*`)으로 추가 금지 | Schema 2 JSON 으로만 작성. cpp 스니펫은 레거시 호환 전용. |
| **D5** | JSON Schema 1 (구 schema, `{"schema": 1, ...}` 또는 schema 필드 누락) **참조 금지** | Schema 2(`{"schema": 2, ...}`)만 사용. |
| **D6** | `FHktScopedReg` / `FHktScopedRegBlock`을 **신규 코드에서 사용 금지** | `HktStoryBuilder.h:120-123` — deprecated. 신규는 `NewVar()`/`NewVarBlock()`. |
| **D7** | `FHktRegAllocator`를 빌더 외부에서 직접 호출 금지 | 빌드 타임 Linear-Scan 할당기가 vreg → 물리 레지스터 매핑을 수행. 외부는 vreg만 본다. |

### 1-2. 허용 (Use Instead)

| # | 항목 | 사용처 |
|---|---|---|
| **U1** | `FHktVar` (가상 변수) — `FHktStoryBuilder::NewVar()` | 모든 단일 변수 슬롯 |
| **U2** | `FHktVarBlock` (연속 N개) — `FHktStoryBuilder::NewVarBlock(N)` | Position(3), Bounds(6) 등 |
| **U3** | `FHktStoryBuilder::Self()` / `Target()` | Entity 컨텍스트 |
| **U4** | OpCode 반환 — `SpawnEntity(...)`, `WaitCollision(...)`, `GetPosition(...)` 등이 `FHktVar`/`FHktVarBlock`을 **반환** | 호출자가 결과를 명시적으로 수령 |
| **U5** | Schema 2 JSON | `HktStoryGenerator`/`McpBuildStory` 입력 |
| **U6** | **Builder 메서드 추가**로 신규 의미 노출 — 새 vreg 발급 + 기존 opcode 조합 emit | Spawner context 주입 등 |

### 1-3. 신규 OpCode 정책

- **기본은 추가 금지**. 기존 60+ opcode와 Builder 조합으로 표현.
- 추가가 본질적으로 필요한 경우(예: polling을 단일 opcode로만 표현 가능한 경우)에만 **별도 ADR 통과 후** 추가.
- 본 통합에서 잠정 후보: `WaitPlayerInRadius` 1개 (§3-c). 결정 보류.

### 1-4. 헤더 가드 / 검증

- 신규 헤더 최상단에 `#error if defined(HKT_REG_NAMESPACE_LEGACY)` 같은 가드는 두지 않는다 — 컴파일 경고(`[[deprecated]]`)가 이미 PR-2에서 부착됨. CI에서 신규 파일이 deprecated API를 호출하면 경고를 에러로 승격하는 룰을 운용.
- 본 문서가 단일 진실 — 모호한 경우 본 §1을 인용해 PR 차단 가능.

---

## 2. 핵심 패러다임

```
[기존]  Spawner = (Position, EntityTag, Rule:enum, Count, Respawn)        — 정적 데이터
[신규]  Spawner = (Position, StoryTag, Param0~3)                           — Story 이벤트
```

- 스폰 패턴(웨이브·매복·패트롤·연쇄·조건부·환경반응)은 **전부 bytecode**.
- `EHktSpawnRule` enum 폐기.
- 진입 메커니즘은 기존 `FHktEvent` + `PendingGroupIntents` 큐 그대로 — 별도 VM 진입 API 없음 (§4-a).
- archetype 별 슬롯 의미는 `SpawnerParams::` 별칭 네임스페이스(HktStoryEventParams.h).
- Bake 시점 LLM 결정 → 정적 직렬화 → 런타임 결정론 0 비용.
- HktCore는 `IHktTerrainDataSource`로만 spawner 메타를 소비 (단방향 의존 원칙 유지).

---

## 3. Phase 1 — 데이터 모델 (HktTerrain)

### 3-a. `FHktTerrainSpawnerSpec` (신규)

`HktTerrainBakedAsset.h`에 추가:

```cpp
USTRUCT()
struct HKTTERRAIN_API FHktTerrainSpawnerSpec
{
    GENERATED_BODY()

    // ─── 결정론 위치 (FHktFixed32 raw, Q16.16) ───
    UPROPERTY() int32 PosXRaw = 0;
    UPROPERTY() int32 PosYRaw = 0;
    UPROPERTY() int32 PosZRaw = 0;

    // ─── 행동 ───
    /** 실행할 Story (반드시 schema 2). 미존재 시 베이크 실패. */
    UPROPERTY() FGameplayTag StoryTag;

    /**
     * Story 진입 인자 — 4-슬롯 평탄화 정수. archetype 별 의미는 `SpawnerParams::`
     * 네임스페이스(HktStoryEventParams.h) 에서 별칭 정의. `FHktEvent::Param0~3` 으로
     * 1:1 매핑되어 기존 PendingGroupIntents 큐에 그대로 흘려보낼 수 있다.
     */
    UPROPERTY() int32 Param0 = 0;
    UPROPERTY() int32 Param1 = 0;
    UPROPERTY() int32 Param2 = 0;
    UPROPERTY() int32 Param3 = 0;

    // ─── 인덱싱 / 검증 ───
    UPROPERTY() FIntVector ChunkCoord = FIntVector::ZeroValue;
    UPROPERTY() uint32 SlotHash = 0;        // 결정론 ID: hash(ChunkCoord, SlotIndex)
    UPROPERTY() int32 BiomeId = 0;          // 베이크 시점 biome (런타임 검증)
};
```

> **설계 결정 (2026-05-12 갱신)**: TMap<FName, ...> EntryArgs 와 `FGameplayTagContainer ContextTags`
> 는 폐기. 이유:
>   - 청크 로드 시 일제 dispatch 에서 spawner 당 TMap 2개 힙 블롭 → 캐시미스 폭발.
>   - 기존 `FHktEvent::Param0~3` + `Location` + `HktEventBuilder::Spawner` 가 이미 동일 컨텍스트를
>     인라인 POD 로 표현 — 별도 진입 경로 도입은 중복.
>   - archetype 별 4-슬롯이 부족하면 `SpawnerParams::` 네임스페이스에 별칭 추가로 충분 (예:
>     `inline const uint16 BiomeId = PropertyId::Param2`).

### 3-b. `UHktTerrainBakedAsset` 확장

```cpp
UCLASS(BlueprintType)
class HKTTERRAIN_API UHktTerrainBakedAsset : public UDataAsset
{
    // CurrentBakeVersion: 1 → 2  (재베이크 강제)
    static constexpr int32 CurrentBakeVersion = 2;

    UPROPERTY() TArray<FHktTerrainSpawnerSpec> Spawners;

    // 청크좌표 → spawner 인덱스 다중맵 (PostLoad/RebuildIndex에서 구축, 비직렬화)
    TMultiMap<FIntVector, int32> ChunkCoordToSpawnerIndex;

    void GetSpawnersForChunk(const FIntVector& Coord, TArray<const FHktTerrainSpawnerSpec*>& Out) const;
};
```

### 3-c. `IHktTerrainDataSource` 확장 (HktCore)

```cpp
class IHktTerrainDataSource
{
public:
    // ... 기존 ...

    /** 청크의 spawner 메타 — HktCore는 본 인터페이스로만 접근 (HktTerrain 헤더 직접 include 금지) */
    virtual void GetChunkSpawners(
        const FIntVector& ChunkCoord,
        TArray<FHktTerrainSpawnerView>& Out) const = 0;
};
```

`FHktTerrainSpawnerView`는 HktCore 측에서 정의하는 plain POD (UObject 0). `FHktTerrainProvider`가 어댑터.

### 3-d. 변경 영향

- 베이크 파일 1 → 2: 기존 `.uasset` 자동 재베이크 필요 (CLAUDE.md "변경 시" 절차 준수).
- `FHktMapSpawner` 어댑터 1릴리즈 유지 (§7).

---

## 4. Phase 2 — Story V2 API 확장

> §1 컴플라이언스를 만족하는 방식으로만 추가. **opcode 신설은 금지**가 기본.

### 4-a. Spawner Context 주입 — 기존 `FHktEvent` 재사용 (별도 entry-args 메커니즘 폐기)

> **설계 결정 (2026-05-12)**: 별도 `FHktStoryEntryArgs` 구조체 + VM `StartInstance` API +
> entry-arg vreg prefill 메커니즘은 **모두 폐기**. 이유:
>   - `FHktDefaultServerRule::OnEvent_GameModeTick` 의 `PendingWorldInit` 흐름이 보여주듯,
>     `FHktEvent` (`EventTag` + `Location` + `Param0~3`) 가 이미 spawner 컨텍스트를 표현하는
>     **단일 진입 메커니즘**이다.
>   - 별도 진입 경로 + TMap<FName, ...> EntryArgs 는 (1) 캐시미스 (2) 진입 경로 분기 (3) 빌더
>     메서드 중복 으로 비용만 추가.
>   - 4-슬롯이 부족한 archetype 은 매우 드물고, 필요 시 `SpawnerParams::` 별칭으로 의미 부여.

#### Spawner Story 가 컨텍스트를 읽는 방식

기존 패턴 그대로:

```cpp
// archetype 별 의미는 SpawnerParams::* 에서 별칭 정의 (HktStoryEventParams.h)
namespace SpawnerParams
{
    inline const uint16 SpawnPosX = PropertyId::Param0;
    inline const uint16 SpawnPosY = PropertyId::Param1;
    // archetype 별 추가 별칭 — SlotHash, BiomeId 등 필요 시 Param2/3 에 매핑
}

// Story 코드 (Schema 2 JSON 또는 Builder):
B.LoadStore(MyVar, SpawnerParams::SpawnPosX);   // Event.Param0 읽기
```

좌표 자체는 `FHktEvent::Location` (FVector) 또는 `Param0~3` 에 raw int 로 인라인되어 흘러간다.

#### 청크 로드 → spawner dispatch

`FHktDefaultServerRule::OnEvent_GameModeTick` 의 `PendingWorldInit` 분기는 본 통합 완료 시 제거되고,
**TerrainSubsystem 의 청크 로드 콜백**이 spawner 를 enumerate 해 동일 `PendingGroupIntents` 큐에
이벤트를 주입한다:

```cpp
// for each newly-loaded chunk:
TArray<FHktTerrainSpawnerView> Spawners;
TerrainSource->GetChunkSpawners(ChunkX, ChunkY, ChunkZ, Spawners);
for (const FHktTerrainSpawnerView& S : Spawners)
{
    FHktEvent E = HktEventBuilder::Spawner(S.StoryTag,
                                            S.PosXRaw, S.PosYRaw);  // Param0/1
    E.Location = FVector(/* PosXRaw → cm 변환 */);
    E.Param2 = S.Param2;   // archetype 별 의미 (e.g. SlotHash low 32-bit)
    E.Param3 = S.Param3;
    const int32 GroupIdx = Graph.CalculateRelevancyGroupIndex(E.Location);
    PendingGroupIntents[GroupIdx].Add(E);
}
```

VM 측 변경 0, 새 진입 API 0, 새 prefill 0.

### 4-b. Spawn Helper Builder 메서드 (opcode 추가 없음)

기존 opcode (`SpawnEntity`, `SaveStoreEntity`, `RandomInt`, `Add`, `Sub`, ...)를 조합해 emit하는 Builder 메서드:

```cpp
class FHktStoryBuilder
{
public:
    /** 지정 위치에 단일 엔티티 spawn. 반환: spawned entity var. */
    FHktVar SpawnEntityAt(FGameplayTag EntityTag, FHktVarBlock Position);

    /** 중심점 주변에 N개 spawn. Pattern: Circle / Line / RandomSeeded. */
    FHktVarBlock SpawnEntityAround(
        FGameplayTag EntityTag,
        FHktVarBlock Center,
        FHktVar RadiusRaw,
        FHktVar CountVar,
        EHktSpawnPattern Pattern);
};

enum class EHktSpawnPattern : uint8 { Circle, Line, RandomSeeded };
```

이들은 **신규 opcode를 발생시키지 않는다** — Builder 레벨 매크로 expansion.

### 4-c. 잠정 신규 OpCode 후보 (결정 보류)

| 후보 | 동기 | 대안 | 결정 |
|---|---|---|---|
| `WaitPlayerInRadius(Center, RadiusRaw)` | 매복 archetype. 기존 `FindInRadius`+루프는 매 tick polling이라 비효율. | Yield-기반 polling을 VM이 내부 최적화 | **보류**. 우선 polling으로 구현 후 프로파일 결과를 보고 ADR 작성 |

§1-3 정책에 따라 추가 시 별도 ADR 필수.

### 4-d. Schema 2 변경 없음

> **설계 결정 (2026-05-12 갱신)**: spawner story 는 일반 Story 와 **구조적으로 동일**하다.
> 별도 `spawner_bound`/`args_int`/`args_tag` 메타 필드 없이, archetype 별 인자는 본문에서
> `LoadStore(PropertyId::Param0..3)` 로 직접 읽는다. Generator 가 archetype 템플릿 → JSON
> 합성 시 슬롯 의미만 일관되게 유지하면 충분.

```json
{
  "schema": 2,
  "tag": "Spawner.Story.AmbushWolves",
  "vregs": [...],
  "instructions": [
    {"op": "LoadStore", "dst": {"var":"posX"}, "prop": "Param0"},
    {"op": "LoadStore", "dst": {"var":"posY"}, "prop": "Param1"},
    /* ... */
  ]
}
```

---

## 5. Phase 3 — Story Archetype 라이브러리

> 모든 archetype은 **Schema 2 JSON**(`HktGameplay/Source/HktStory/StoryDefinitions/Spawner/*.json`). cpp 스니펫 신규 추가 금지 (§1 D4).

| Archetype Tag | 패턴 | 주요 Param 슬롯 (Param0~3) | 의존 opcode |
|---|---|---|---|
| `Spawner.Archetype.Always` | 진입 즉시 N개 spawn | `EntityTag`, `Count` | `SpawnEntity`, `SpawnEntityAt`(builder) |
| `Spawner.Archetype.Wave` | 시간 분산 다중 웨이브 | `WaveCount`, `IntervalSec`, `PerWaveCount`, `Escalation` | + `YieldSeconds`, `Add` |
| `Spawner.Archetype.Ambush` | 플레이어 근접 → 일제 출현 | `TriggerRadius`, `Count`, `HideDuration` | + polling 루프 (`FindInRadius`+`Yield`) |
| `Spawner.Archetype.Patrol` | 경로 순찰 spawn (1회) | `EntityTag`, `PathPoints[]` | + `SetForwardTarget` |
| `Spawner.Archetype.Chain` | 처치 시 다음 웨이브 | `ChainDepth`, `EscalationRule` | + `WaitDeath` 이벤트 |
| `Spawner.Archetype.Conditional` | 다른 story 완료 시 트리거 | `UpstreamTag`, `DelaySec` | + `WaitEvent` |
| `Spawner.Archetype.Guardian` | 보스 + 호위 무리 | `BossTag`, `MinionTag`, `MinionCount` | + `FindInRadius` |
| `Spawner.Archetype.Environmental` | 특정 biome/voxel 조건만 활성 | `BiomeMask`, `VoxelFilter` | + `GetVoxelType`, `SpawnerBiome` |

각 archetype은:
- 매개변수화된 Schema 2 JSON 템플릿.
- LLM은 archetype 선택 + 파라미터만 결정 — bytecode 직접 생성하지 않음.
- Generator가 템플릿 + 파라미터 → 최종 JSON 합성 → `McpBuildStory`로 컴파일.

---

## 6. Phase 4 — Generator 파이프라인

```
concept-design   →  terrain_spec + encounter_intent (biome별 출현 의도)
                              ↓
   map-gen       →  region별 spawner 후보 슬롯 추출 (terrain feature 기반)
                              ↓
spawner-design   →  슬롯 × archetype 매핑 (새 skill 또는 map-gen 확장)
                              ↓                              ↓
   terrain-bake                                          story-gen
   (Spawners[] 직렬화)                                   (archetype JSON 합성·컴파일)
                              ↓
   검증: StoryTag 존재 / archetype 파라미터 형식 / biome 일치 / 위치 유효성
```

### 6-a. concept-design 확장
- `terrain_spec`에 `encounter_intent[]` 필드:
  ```json
  { "biome": "mountain", "intent": "ambush_predators", "intensity": 0.7 }
  ```

### 6-b. map-gen 확장 (또는 신규 skill `spawner-design`)
- 입력: terrain_spec + bake 산출 후보 슬롯 + encounter_intent
- 출력: `slot_id → (archetype_tag, params)` 매핑
- 권장: **신규 skill 분리** — map-gen은 region/landscape에 집중, spawner-design은 spawner 결정에 집중.

### 6-c. story-gen 확장
- archetype 템플릿 8종을 `McpServer`에 등록.
- spawner-design 결과를 받아 각 archetype 인스턴스 JSON 생성 → 컴파일.

### 6-d. terrain-bake 확장
- `UHktTerrainBakeLibrary::BakeRegion`에 spawner slot 추출 단계 추가:
  - 청크 표면 셀 (top-most non-air voxel)
  - 동굴 입구 (cave threshold edge)
  - biome 경계
  - 수면 인접 / 산악 정상
- 추출된 슬롯 + spawner-design 결과 합본 → `FHktTerrainSpawnerSpec` 직렬화.

### 6-e. 검증 단계 (Bake 시점)
- 각 `StoryTag`가 schema 2 컴파일 산출물에 존재하는지.
- `Param0~3` 슬롯 의미가 archetype 의 `SpawnerParams::` 별칭과 일치하는지.
- `BiomeId`가 청크 실제 biome과 일치하는지 (Generator 결정 ≠ 실제 지형 방지).
- `PosRaw`가 청크 경계 내인지.

---

## 7. Phase 5 — 런타임 실행

```
[Server]
UHktTerrainSubsystem::AcquireChunk(Coord)
   ↓ (HktCore 측 호출)
IHktTerrainDataSource::LoadChunk + GetChunkSpawners
   ↓
FHktTerrainState::OnChunkLoaded  →  IHktServerRule 알림 (or 직접 큐 주입)
   ↓
for each spawner in chunk:
    FHktEvent E = HktEventBuilder::Spawner(spawner.StoryTag,
                                            spawner.PosXRaw, spawner.PosYRaw);
    E.Location = ToVector(spawner.PosXRaw, ...);
    E.Param2 = spawner.Param2;
    E.Param3 = spawner.Param3;
    PendingGroupIntents[Graph.CalculateRelevancyGroupIndex(E.Location)].Add(E);
   ↓
기존 이벤트 → Story dispatch 경로 (HktDefaultServerRule::OnEvent_GameModeTick)
   ↓
Story bytecode 실행 (SOA WorldState dirty proxy 경유)
   ↓
FHktWorldView 갱신 (절대 원칙 3: 서버 권위)

[Client]
FHktWorldView 수신 → HktPresentation 렌더
```

> `PendingWorldInit` 패턴 (서버 측 1회성 GameMode WorldInit Story) 은 본 통합 완료 시 위
> dispatch 루프로 흡수되며 제거된다.

### 7-a. 청크 언로드
- 청크가 SimMaxChunksLoaded LRU에서 제거될 때 해당 spawner 가 시작한 Story VM 인스턴스를
  **결정론적으로 정지** 정책은 추후 결정 (§10 O1).
- 이미 spawn된 엔티티 정리 정책도 §10 O1 에 종속 — 본 설계는 dispatch 까지만 다룬다.

### 7-b. 결정론
- `SlotHash`를 RNG seed로 사용 → 동일 청크 재로드 시 동일 출현.
- 단, "재로드"는 시뮬레이션 의미가 아니라 메모리 캐시 의미 (시뮬레이션 상태는 영속).

---

## 8. Phase 6 — 마이그레이션

| 단계 | 작업 | 호환 |
|---|---|---|
| **M0** | 본 설계 승인 | — |
| **M1** | `FHktTerrainSpawnerSpec` + `UHktTerrainBakedAsset` v2 추가. 빈 배열로 직렬화. | 기존 자산 영향 0 (재베이크 시 v2). |
| **M2** | `IHktTerrainDataSource::GetChunkSpawners` 추가, `FHktTerrainProvider` 어댑터 구현. VM 변경 없음 (기존 FHktEvent 경로 재사용). | 기존 story/VM 무영향. |
| **M3** | `FHktStoryBuilder` 헬퍼 (`SpawnEntityAt`, `SpawnEntityAround`) + `SpawnerParams::` archetype 별 Param 별칭 추가. | 기존 story 무영향. |
| **M4** | Archetype 8종 JSON + Generator skill (`spawner-design`). | — |
| **M5** | terrain-bake가 spawner 직렬화. `AHktSpawnerActor`는 어댑터로 변환 — `FHktMapSpawner` 입력을 받아 `FHktTerrainSpawnerSpec`으로 변환 후 spawner story 트리거. | HktMapGenerator JSON 입력 호환. |
| **M6** | `FHktMapSpawner` / `EHktSpawnRule` / `AHktSpawnerActor` deprecated 마킹. 1 릴리즈 후 제거. | 컴파일 경고 단계. |
| **M7** | 제거 + `HktMapGenerator`의 spawner 관련 코드 정리. | 메이저 버전. |

---

## 9. 영향 파일 (추정)

### HktGameplay
| 파일 | 변경 |
|---|---|
| `HktTerrain/Public/HktTerrainBakedAsset.h`+cpp | `FHktTerrainSpawnerSpec` 추가, BakeVersion 2, `GetSpawnersForChunk` |
| `HktTerrain/Public/HktTerrainSubsystem.h`+cpp | `AcquireChunkSpawners` |
| `HktTerrain/Public/HktTerrainBakeLibrary.h`+cpp | spawner slot 추출 + 직렬화 |
| `HktCore/Public/HktTerrainDataSource.h` | 인터페이스 확장 (`GetChunkSpawners`, `FHktTerrainSpawnerView`) |
| `HktCore/Public/HktTerrainProvider.h`+cpp | 어댑터 구현 |
| `HktCore/Public/HktStoryBuilder.h`+cpp | 신규 헬퍼 (§4-b 만 — SpawnEntityAt/Around + EHktSpawnPattern). §4-a 메서드는 폐기. |
| `HktCore/Public/HktStoryEventParams.h` | `SpawnerParams::` 네임스페이스에 archetype 별 Param 별칭 추가 |
| `HktCore/Public/HktStoryTypes.h` | (조건부) 잠정 opcode — ADR 통과 시만 |
| `HktCore/Private/HktStoryVM.cpp` | `StopInstancesBySpawnerOrigin` 만 (StartInstance 폐기) |
| `HktRule/Private/HktServerRule.cpp` | `PendingWorldInit` 제거 + 청크 로드 시 spawner dispatch 분기 추가 |
| `HktStory/StoryDefinitions/Spawner/*.json` | archetype 8종 (신규) |
| `HktTerrain/CLAUDE.md` | spawner 책임 추가 명시 |
| `HktTerrain/README.md` | spawner 데이터 흐름 추가 |

### HktGameplayGenerator
| 파일 | 변경 |
|---|---|
| `HktMapGenerator/Public/HktMapData.h` | `FHktMapSpawner` deprecated 마킹 |
| `HktMapGenerator/Public/HktSpawnerActor.h`+cpp | 어댑터로 변환 (M5) |
| `HktMapGenerator/Private/HktMapGeneratorSubsystem.cpp` | `FHktMapSpawner` → `FHktTerrainSpawnerSpec` 변환 |
| `McpServer/hkt_mcp/tools/spawner_tools.py` | 신규 skill `spawner-design` |
| `McpServer/hkt_mcp/steps/models.py` | StepType 확장 |
| `HktGameplayGenerator/Skills/spawner-design.md` | 신규 skill 명세 |

---

## 10. 오픈 이슈 (결정 필요)

| # | 이슈 | 옵션 | 우선순위 |
|---|---|---|---|
| O1 | 청크 언로드 시 이미 spawn된 엔티티 처리 | (a) 유지(엔티티는 시뮬 영속) / (b) 정리(spawner와 연동) / (c) per-archetype 정책 | High — M2 전 결정 |
| O2 | `WaitPlayerInRadius` opcode 추가 여부 | (a) 추가 / (b) polling으로 우선 구현 후 측정 | Mid — M3에서 결정 |
| O3 | `spawner-design`을 별도 skill로 분리 vs map-gen 확장 | (a) 분리 / (b) 통합 | Mid — M4 |
| O4 | EntryArgs에 `float` 허용 여부 | 결정론 위반 위험. 현재 설계는 `int32`(fixed-point) + Tag만 | Resolved: int/Tag만 |
| O5 | Archetype 8종이 충분한가 / 추가 후보 | "Roaming", "Migrating" 등 | Low — M4 |
| O6 | Bake 시점 LLM 호출 비용 (대규모 region) | 슬롯당 호출 vs 배치 호출 vs 캐시 | Mid — M5 |
| O7 | spawner SlotHash 충돌 처리 | 좌표 다중 슬롯 시 인덱스도 포함 | Resolved: hash(ChunkCoord, SlotIndex) |

---

## 11. 변경 이력

| 일자 | 변경 | 비고 |
|---|---|---|
| 2026-05-12 | 초안 작성 | 브랜치 `claude/terrain-spawner-planning-R2Jp3` |
| 2026-05-12 | §3-a / §4-a 정정 — TMap EntryArgs + `FHktStoryEntryArgs` 진입 메커니즘 폐기. 기존 `FHktEvent::Param0~3` + `PendingGroupIntents` 큐 재사용으로 단일 진입경로 유지. 빌더 spawner-context 메서드(SpawnerOrigin/Biome/SlotHash/EntryArg*) 제거, `bIsEntryArgSlot` vreg 플래그 제거, Spec/View 평탄화 (4-슬롯 정수). | `OnEvent_GameModeTick` 의 `HktEventBuilder::Spawner` 패턴이 이미 컨텍스트를 표현. 캐시미스/중복 진입경로 회피. |
