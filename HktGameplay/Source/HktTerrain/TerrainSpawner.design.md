# Terrain Spawner 통합 설계도

> **상태**: 설계 단계. 구현 착수 전. 본 문서는 의사결정의 단일 출처.
> **브랜치**: `claude/terrain-spawner-planning-R2Jp3`
> **관련 모듈**: `HktTerrain`(주체) · `HktCore/HktStory`(행동) · `HktMapGenerator`(어댑터·마이그레이션 대상)

---

## 0. 목표 / 비목표

### 목표
- `HktTerrain`이 지형 베이크와 함께 **Spawner 데이터를 단일 출처로 보유**.
- Spawner의 동작은 **전부 Story bytecode**로 표현 (웨이브·매복·패트롤·연쇄·조건부 등 복합 패턴).
- Bake 시점에 LLM이 (지형 컨텍스트 → Story) 매핑을 정적으로 결정 → 런타임 결정론 0 비용.

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

- 스폰 패턴(웨이브·매복·패트롤·연쇄·조건부·환경반응)은 **전부 bytecode**. archetype 정형 분류 도입 금지 (§5 ADR 참조).
- `EHktSpawnRule` enum 폐기.
- 진입 메커니즘은 기존 `FHktEvent` + `PendingGroupIntents` 큐 그대로 — 별도 VM 진입 API 없음 (§4-a).
- `Param0~3` 슬롯 별칭은 `SpawnerParams::` 네임스페이스(HktStoryEventParams.h) — 단지 컨벤션 헤더 (라이브러리·템플릿 아님).
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
| `WaitPlayerInRadius(Center, RadiusRaw)` | 매복 패턴. 기존 `FindInRadius`+루프는 매 tick polling이라 비효율. | Yield-기반 polling을 VM이 내부 최적화 | **보류**. 우선 polling으로 구현 후 프로파일 결과를 보고 ADR 작성 |

§1-3 정책에 따라 추가 시 별도 ADR 필수.

### 4-d. Schema 2 변경 없음

> **설계 결정 (2026-05-12 갱신)**: spawner story 는 일반 Story 와 **구조적으로 동일**하다.
> 별도 `spawner_bound`/`args_int`/`args_tag` 메타 필드 없이, story 본문이 자체적으로
> 정의하는 인자는 `LoadStore(PropertyId::Param0..3)` 로 직접 읽는다. Generator 는 schema 2
> JSON 을 자유롭게 작성하며 (§5 ADR), `SpawnerParams::` 공통 별칭만 따른다.

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

## 5. ADR — Story Archetype 라이브러리를 도입하지 않는다

> **결정 (2026-05-12)**: Phase 3 으로 8종 archetype 템플릿 + `Spawner.Archetype.*` 분류 + LLM 의 (archetype, params) 선택지를 도입하려던 설계는 **폐기**. spawner story 는 LLM 이 schema 2 JSON 으로 **자유롭게 직접 작성**한다.

### 5-1. 폐기 사유

| # | 사유 |
|---|---|
| **R1** | **사용자 의도와 충돌** — spawner 는 "복합적이고 다양한 생성" 이 목표. 8종 정형 분류는 우리가 폐기한 `EHktSpawnRule` enum 이 이름만 바꿔 부활하는 것. |
| **R2** | **Story 본질 훼손** — Story 는 (사실상) 튜링 완전 bytecode. 8개 템플릿으로 가두면 새 패턴마다 archetype 추가 의존이 생기고, 보스 처치 → 호위 도주 → 다른 region 에서 복수 등장 같은 복합 패턴은 어차피 표현 불가. |
| **R3** | **Leaky abstraction** — story 자체가 이미 DSL 인데 archetype 은 그 위에 약한 DSL 을 한 층 더 쌓는 것. story-gen 이 이미 schema 2 JSON 을 생성 가능. |
| **R4** | **Param0~3 평탄화로 의미 약화** — §3-a 갱신으로 진입 인자가 4-슬롯 정수로 단순화되면서 archetype "라이브러리" 의 무게가 사라짐. 남은 의미는 `SpawnerParams::` 별칭 컨벤션 뿐인데 이는 헤더 1개로 충분. |

### 5-2. 대체 방향

- **`SpawnerParams::` 네임스페이스** (`HktStoryEventParams.h`) 만 유지 — `SpawnPosX = Param0`, `SpawnPosY = Param1` 같은 공통 별칭 + spawner story 본문이 자체적으로 정의하는 `Param2/3` 의미. **강제 분류 아님**.
- **`spawner-design` skill** (§6) 이 LLM 으로 하여금 `(위치, schema 2 story JSON, Param0~3 값)` 을 직접 출력하도록 한다. 템플릿 선택지가 아닌 자유 작성.
- **예제는 라이브러리가 아닌 참고용** — 필요 시 1~2 개 schema 2 JSON 예제 (`Content/Stories/Spawner/Example_*.json`) 를 두되, Generator 가 의존하지 않는다.

### 5-3. 무엇이 archetype 도입 트리거가 되면 다시 ADR 한다

- LLM 이 spawner story 본문에서 반복적으로 동일한 명령 시퀀스를 만들어 토큰 비용이 비대해질 때
- 그리고 그 시퀀스가 3~4 개 정도로 자연 수렴할 때 (8 개 강제 분류는 그 시점에도 거부)

위 조건이 관측될 때 별도 ADR 로 재논의. 본 시점에는 도입하지 않는다.

---

## 6. Phase 3 — Generator 파이프라인

```
concept-design   →  terrain_spec + encounter_intent (biome별 출현 의도)
                              ↓
   map-gen       →  region별 spawner 후보 슬롯 추출 (terrain feature 기반)
                              ↓
spawner-design   →  슬롯별 (위치, schema 2 story JSON, Param0~3) 직접 작성  ← LLM 자유 작성
                              ↓                              ↓
   terrain-bake                                          story-gen
   (Spawners[] 직렬화)                                   (schema 2 JSON 컴파일)
                              ↓
   검증: StoryTag 존재 / Param 슬롯 본문 일관성 / biome 일치 / 위치 유효성
```

### 6-a. concept-design 확장
- `terrain_spec`에 `encounter_intent[]` 필드:
  ```json
  { "biome": "mountain", "intent": "ambush_predators", "intensity": 0.7 }
  ```

### 6-b. spawner-design (신규 skill)
- 입력: terrain_spec + bake 후보 슬롯 + encounter_intent + `SpawnerParams::` 컨벤션 헤더 발췌
- 출력 (슬롯별): `(world position, schema 2 story JSON, Param0~3 값)`
- LLM 은 archetype 선택지가 아닌 **schema 2 JSON 본문을 직접 작성**한다 (§5 ADR).
- map-gen 과 분리 — map-gen 은 region/landscape, spawner-design 은 spawner.

### 6-c. story-gen 연계
- spawner-design 이 산출한 schema 2 JSON 을 그대로 `McpBuildStory` 로 컴파일.
- 별도 archetype 템플릿 등록 단계 없음 (§5 ADR).

### 6-d. terrain-bake 확장
- `UHktTerrainBakeLibrary::BakeRegion`에 spawner slot 추출 단계 추가:
  - 청크 표면 셀 (top-most non-air voxel)
  - 동굴 입구 (cave threshold edge)
  - biome 경계
  - 수면 인접 / 산악 정상
- 추출된 슬롯 + spawner-design 결과 합본 → `FHktTerrainSpawnerSpec` 직렬화.

### 6-e. 검증 단계 (Bake 시점)
- 각 `StoryTag`가 schema 2 컴파일 산출물에 존재하는지.
- `Param0~3` 값이 해당 story 본문이 읽는 슬롯과 일관되는지 (정적 분석 — story 본문에서 `LoadStore(PropertyId::Param0)` 등을 추출해 미사용 슬롯에 값 부여 시 경고).
- `BiomeId`가 청크 실제 biome과 일치하는지 (Generator 결정 ≠ 실제 지형 방지).
- `PosRaw`가 청크 경계 내인지.

---

## 7. Phase 4 — 런타임 실행

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

## 8. Phase 5 — 마이그레이션

| 단계 | 작업 | 호환 |
|---|---|---|
| **M0** | 본 설계 승인 | — |
| **M1** | `FHktTerrainSpawnerSpec` + `UHktTerrainBakedAsset` v2 추가. 빈 배열로 직렬화. | 기존 자산 영향 0 (재베이크 시 v2). |
| **M2** | `IHktTerrainDataSource::GetChunkSpawners` 추가, `FHktTerrainProvider` 어댑터 구현. VM 변경 없음 (기존 FHktEvent 경로 재사용). | 기존 story/VM 무영향. |
| **M3** | `FHktStoryBuilder` 헬퍼 (`SpawnEntityAt`, `SpawnEntityAround`) + `SpawnerParams::` Param 별칭 컨벤션 헤더 추가. | 기존 story 무영향. |
| **M4** | Generator skill (`spawner-design`) — LLM 이 schema 2 JSON 을 직접 작성. archetype 템플릿 없음 (§5 ADR). | — |
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
| `HktCore/Public/HktStoryEventParams.h` | `SpawnerParams::` 네임스페이스 — `SpawnPosX = Param0` 등 공통 별칭 (컨벤션 헤더). archetype 분류 없음. |
| `HktCore/Public/HktStoryTypes.h` | (조건부) 잠정 opcode — ADR 통과 시만 |
| `HktCore/Private/HktStoryVM.cpp` | `StopInstancesBySpawnerOrigin` 만 (StartInstance 폐기) |
| `HktRule/Private/HktServerRule.cpp` | `PendingWorldInit` 제거 + 청크 로드 시 spawner dispatch 분기 추가 |
| `HktGameplay/Content/Stories/Spawner/Example_*.json` | (선택) 참고용 1~2 예제 — 라이브러리 아님 |
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
| O3 | `spawner-design`을 별도 skill로 분리 vs map-gen 확장 | (a) 분리 / (b) 통합 | Resolved: (a) 분리 — §6-b |
| O4 | EntryArgs에 `float` 허용 여부 | 결정론 위반 위험. 현재 설계는 `int32` Param0~3 만 | Resolved: int32 만 |
| O5 | ~~Archetype 8종이 충분한가~~ | ~~"Roaming", "Migrating" 등~~ | **Closed — §5 ADR 로 archetype 자체 폐기** |
| O6 | Bake 시점 LLM 호출 비용 (대규모 region) | 슬롯당 호출 vs 배치 호출 vs 캐시 | Mid — M5 |
| O7 | spawner SlotHash 충돌 처리 | 좌표 다중 슬롯 시 인덱스도 포함 | Resolved: hash(ChunkCoord, SlotIndex) |

---

## 11. 변경 이력

| 일자 | 변경 | 비고 |
|---|---|---|
| 2026-05-12 | 초안 작성 | 브랜치 `claude/terrain-spawner-planning-R2Jp3` |
| 2026-05-12 | §3-a / §4-a 정정 — TMap EntryArgs + `FHktStoryEntryArgs` 진입 메커니즘 폐기. 기존 `FHktEvent::Param0~3` + `PendingGroupIntents` 큐 재사용으로 단일 진입경로 유지. 빌더 spawner-context 메서드(SpawnerOrigin/Biome/SlotHash/EntryArg*) 제거, `bIsEntryArgSlot` vreg 플래그 제거, Spec/View 평탄화 (4-슬롯 정수). | `OnEvent_GameModeTick` 의 `HktEventBuilder::Spawner` 패턴이 이미 컨텍스트를 표현. 캐시미스/중복 진입경로 회피. |
| 2026-05-12 | §5 Story Archetype 라이브러리 폐기 → ADR 로 전환. §6 Generator 파이프라인을 LLM 자유 작성 흐름으로 재정의 (`spawner-design` 이 schema 2 JSON 직접 출력). §6-c story-gen 의 archetype 등록 단계 제거. §8 M3/M4·§9 영향 파일·§10 O5 정리 (Phase 번호 §6→Phase 3, §7→Phase 4, §8→Phase 5 로 재정렬). | "복합적이고 다양한 생성" 의도와 archetype 정형 분류 충돌 (`EHktSpawnRule` 부활 우려). Param0~3 평탄화로 archetype 의미가 `SpawnerParams::` 별칭 헤더 1개 수준으로 축소되어 라이브러리 도입 비용/이득 역전. |
| 2026-05-12 | **Phase 4 구현** — `FHktEvent` 에 `Param2/Param3` 슬롯 추가 (4-슬롯 평탄화 완성). `FHktTerrainSystem::Process` 가 새로 로드된 청크에서 `IHktTerrainDataSource::GetChunkSpawners` 를 enumerate → `EmittedSpawnerEvents` 로 출력. `FHktWorldDeterminismSimulator::ProcessBatch` 가 `Event.NewEvents` 와 병합해 `VMBuildSystem` 에 흘려보냄. `HktEventBuilder::SpawnerFromView` 헬퍼 추가 (PosXRaw Q16.16 → cm 정수 + Location). `SpawnerParams::SpawnerSlot0/1` 컨벤션 별칭 추가. | TerrainSpawner.design.md §7 Runtime Execution 구현. VM 측 변경 0, 새 진입 API 0, 별도 prefill 0 — 기존 `FHktEvent` 큐 단일 경로 유지. |
| 2026-05-12 | **Phase 5 M6 deprecation 마킹** — `EHktSpawnRule` / `FHktMapSpawner` / `AHktSpawnerActor::InitFromSpawnerData` 에 [[deprecated]] + 코멘트 마킹. HktMapData.h 상단에 마이그레이션 노트. **Phase 5 M5 부분 구현** — `HktMapSpawnerAdapter::MapSpawnerToTerrainSpec` (HktMapGenerator) 변환 헬퍼 추가. EntityTag NetIndex → `Param2`, Count → `Param3` 컨벤션. HktMapGenerator 모듈 종속에 HktCore/HktTerrain 추가. | M5 의 "AHktSpawnerActor 런타임 행동 전환" 은 Phase 3 (BakeRegion 자동 추출) 완료 의존이라 본 PR 범위 밖 — 별도 후속 작업. M7 (코드 제거) 도 동일. |
| 2026-05-12 | **PendingWorldInit 잔존 결정** — 설계 §7 의 "본 통합 완료 시 dispatch 루프로 흡수" 항목 중 `FHktDefaultServerRule::PendingWorldInit` / `OnEvent_GameModeInitWorld` 는 Phase 3 (BakeRegion 이 WorldInitLocation 위치에 spawner 슬롯 자동 생성) 가 완료된 후에만 안전하게 제거 가능 — 현재는 부트스트랩 호환성 유지를 위해 LEGACY 코멘트 마킹만 부착. Phase 3 출시 후 별도 PR 에서 제거. | 본 PR 에서 제거 시 기존 GameMode 콘텐츠가 부트스트랩 경로를 잃음 — 단계적 제거가 안전. |
| 2026-05-15 | **§4-a 런타임 정책 패스 (Placement Story) 추가** — `BakeRegion` 의 cpp 하드코딩 biome→Story 매핑 (Forest→Oak / Grassland→Birch switch) 을 폐기. 대신: (1) `Event.Terrain.ChunkLoaded` 신규 태그 + `ChunkLoadedParams::` 별칭 + `HktEventBuilder::ChunkLoaded(...)` 추가. (2) `FHktTerrainBakedChunk` v3 — `BiomeId / SurfaceVoxelZ / SlotHash / bIsSurfaceChunk` 필드. (3) `IHktTerrainDataSource::TryGetChunkContext(...)` 가상 메서드 (`FHktTerrainProvider` 가 BakedAsset 조회로 구현). (4) `FHktTerrainSystem::Process` 가 새 surface 청크 로드 시 `ChunkLoaded` 이벤트를 `EmittedSpawnerEvents` 로 push (기존 `GetChunkSpawners` 경로와 공존). (5) 기본 정책 JSON `Content/Stories/Natural/Placement_TranquilWilds.json` — Event.Terrain.ChunkLoaded 를 listen → biome (Param2) switch → `SaveStore Param2=SlotHash31` 후 `DispatchEvent OakSpawn` / Grassland 는 곧장 `DispatchEvent BirchSpawn`. `Spawners[]` 는 명시 배치 (보스/랜드마크/HktMapSpawnerAdapter) 전용으로 의미 재정의 — 자동 채움 안 함. | 룰 테이블은 archetype enum 부활의 약한 변형 (§5 ADR 정신 위배). bytecode 통일이 V2 컴플라이언스 + LLM 자유 작성 흐름 정합. `Spawners[]` 와 공존으로 보스/명시 배치는 직관성 유지. |
