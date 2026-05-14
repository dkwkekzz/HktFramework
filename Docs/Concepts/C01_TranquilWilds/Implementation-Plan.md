# C01 — 구현 핸드오프 계획 (PR-1 ~ PR-4)

> **목적**: 03~06 의 ADR 을 *코드* 로 옮기기 위한 PR 시퀀스. 각 PR 은 자기완결적이라 *다른 agent 에게 그대로 던질 수 있게* 브리프 형식으로 작성한다.
> **선행 결정**: 05/06 의 *책임 분리* 는 **최소 모델** 로 채택 — HktRule 은 echo 라우터만, 모든 판정 (거리/도구/region) 은 VM bytecode 내부.
> **상위**: [`README.md`](./README.md) · **선행**: [`05-interactions.md`](./05-interactions.md) · [`06-tools.md`](./06-tools.md)
> **기록일**: 2026-05-13

---

## 1. 트리 예제로 본 현재 코드의 가능 / 불가능

사용자 시나리오: *"트리는 주변에 적당히 spawn, 베이면 재료 drop, 본인은 재미있는 방식으로 전파"*.

| 트리 동작 | 메커니즘 | 현재 가능? | 부족분 |
|---|---|---|---|
| 청크 로드 시 주변 spawn | `FHktTerrainSpawnerSpec` + `SpawnEntityAround` (Circle / RandomSeeded) | ✅ | — |
| **적당히 (cap)** | Region 카운터 read → 임계 초과 시 Halt | ❌ | **PR-2 (Region 인프라)** |
| 베어짐 — Action 수신 | HktRule 라우터 → `Action.Natural.Fell` → `Event.Natural.TreeFelled` | ❌ | **PR-1 (태그 + 라우터)** |
| 거리·도구 판정 (최소 모델) | spawner story 머리에서 `GetDistance` / `HasTag` / `FindByOwner` | ⚠️ 일부 가능 | **CheckFacing opcode** 만 신규, 나머지 기존 opcode 충분 |
| 베이면 재료 drop | TreeFelled 수신 story → `SpawnEntityAt(EventLocation, 재료 태그)` × N | ✅ PR-1 통과 후 즉시 | — |
| 인접 region 으로 묘목 시드 | `DispatchEvent` + `FindOrCreateRegion(인접 chunk)` + `RandomInt` | ⚠️ | **PR-2** |
| cluster / variant 별 카운터 | indexed map read/write | ❌ | **PR-3 (LoadStoreIndexed)** — 트리 데모에는 불필요 |

→ **최소 데모 경로**: **PR-1 + PR-2** 만 끝나면 *"주변 spawn (cap 있음) → 베기 → 재료 drop → 인접 묘목 시드"* 까지 1 종 트리 완결 작동.

---

## 2. 4 PR 시퀀스

```
PR-1 (M3-lite)  태그 카탈로그 + HktRule echo 라우터          [의존: 없음]
PR-2 (M1)       Region 인프라 (RegionId + PropertyId + RegionAddScalar)
                                                              [의존: 없음, PR-1 병행 가능]
PR-3 (M2)       Indexed opcode + RegionMapRead/Write          [의존: PR-2]
PR-4+ (07)      spawner story 본문 (1 PR 1 spawner)           [의존: PR-1 + PR-2,
                                                               일부는 PR-3 추가]
```

각 PR 의 LOC 예상: PR-1 ≈ 300, PR-2 ≈ 500, PR-3 ≈ 700, PR-4 (1 spawner) ≈ 200.

---

## 3. PR-1 브리프 — *그대로 다른 agent 에게 던질 수 있는 형식*

### 3.0 맥락 (네가 처음 들어오므로)

- 이 프로젝트는 UE5.6 결정론 시뮬레이션 프레임워크. HktCore 는 순수 C++ VM (UObject 0), spawner story 가 자연 entity 의 *생성/변환/소멸* 을 결정한다.
- 너의 작업은 **플레이어 행위 → spawner story 진입의 *얇은 echo 라우터*** 를 만드는 것이다.
- *판정* 은 하지 않는다 — 판정은 다음 PR 에서 spawner story 본문 (VM bytecode) 이 한다.
- 결정 (이미 내려진): *최소 모델* — HktRule 은 echo only, 모든 판정은 VM 내부.

### 3.1 사전 읽기 (필수, 순서대로)

1. `CLAUDE.md` (루트) — 절대 원칙 1~6
2. `HktGameplay/CLAUDE.md` — 모듈 그래프
3. `Docs/Concepts/C01_TranquilWilds/05-interactions.md` — §2 책임 분리 / §3 매트릭스 / §8 태그 컨벤션
4. `Docs/Concepts/C01_TranquilWilds/06-tools.md` — §2 도구 카탈로그 / §3 데이터 모델
5. `HktGameplay/Source/HktRule/Public/` — 기존 HktRule 인터페이스 (Read 만, 수정 X)

### 3.2 산출물

- **`Source/HktCore/Public/HktCoreTags.h`** (또는 기존 위치에 추가)
  - **Action 8 종**: `Action.Natural.{Fell, Harvest, Pluck, Eat, Ignite, Mine, Cross, Drink}`
  - **Event 13 종**: `Event.Natural.{TreeFelled, BerryHarvested, HerbCollected, AquaticPlucked, MushroomEaten, FireIgnited, BoulderBroken, OreMined, SpringDrank, FordCrossed, TrailEndpointReached, PeakReached, GrainObserved}`
  - **Tool 5 종**: `Entity.Tool.{Axe, Pickaxe, Tinder, Container, Torch}`
  - **Material 6 종**: `Material.{Wood, Stone, Sharpened, Bronze, Flint, Cup}`
- **`Source/HktRule/Public/HktNaturalActionRouter.h` + `.cpp`**
  - `void RouteAction(FHktEvent& OutEvent, const FHktIntent& Intent)` — 1:1 변환, 판정 0
  - 매핑: `Action.Natural.<Verb>` → `Event.Natural.<Verbed>` (테이블)
  - `OutEvent.Param0..3` 은 `Intent.Hints` 에서 그대로 복사 (서버는 판정 0, 클라 hint 그대로 통과 — 권위는 VM 단계에서)
- **`HktAutomationTests/Private/Tests/HktNaturalRouterTests.cpp`** (신규)
  - Action → Event 매핑 round-trip × verb 8 종
  - invalid Action tag → `OutEvent.EventTag.IsValid() == false`
  - `IMPLEMENT_SIMPLE_AUTOMATION_TEST` 래퍼로 UE Automation Panel 노출

### 3.3 절차 (각 step 후 빌드 + 테스트 통과 확인)

1. **태그 등록** — `HktCoreTags.h` 에 위 32 종 추가. 기존 패턴 (`UE_DEFINE_GAMEPLAY_TAG_STATIC`) 활용. 빌드 통과로 충돌 검사.
2. **라우터 헤더 작성** — namespace `HktNaturalActionRouter`. 함수 1 개. 매핑 테이블은 `static const TMap<FGameplayTag, FGameplayTag>` 로 init-once (`FCoreDelegates::OnPostEngineInit` 또는 lazy).
3. **라우터 cpp 작성** — `RouteAction` 구현. 매핑 못 찾으면 `OutEvent.EventTag = Invalid` (호출자가 silent skip).
4. **테스트 작성** — `HktOpcodeTests_*.cpp` 패턴 그대로 (`FHktTestResult::Pass/Fail`, `FHktTestReport`). Automation 래퍼 명명: `HktCore.Action.Router.<Verb>`.
5. **Runner 등록** — `HktAutomationTestsRunner.cpp` 에 `RunNaturalRouterTests` 추가, `RunAllTests` 에 append.

### 3.4 안티 패턴 (절대 금지)

- ❌ HktRule 안에서 거리/도구/region 검사 — 판정 0, echo 만.
- ❌ `OnAction_Fell` 같은 verb 별 cpp 함수 — 단일 `RouteAction` 만.
- ❌ random / float / static mutable state.
- ❌ `LogTemp` — `LogHktRule` 카테고리 사용 (없으면 생성).
- ❌ 매직 넘버 — 라우터는 임계 자체가 없음.
- ❌ 매핑 테이블에 *복수 Event* 매핑 — 한 Action 은 정확히 한 Event. 분기는 spawner story 가.

### 3.5 완료 기준

- 빌드 success.
- `hkt.automation.run` 실행 시 `[PASS]` ≥ 14 (verb 8 + invalid 1 + round-trip 보조) 모두 통과.
- Editor 의 Session Frontend → Automation → `HktCore.Action.Router.*` 노드 가시.
- 신규 PropertyId / 신규 모듈 의존 0.
- 본 문서의 [§7](#7-진행-상태) PR-1 항목 [x] 체크.

### 3.6 그 다음 (PR-2 예고)

- Region 인프라 (PropertyId 그룹 A + `HktRegionId.h` + `FindOrCreateRegionEntity` + `RegionAddScalar` Builder helper). 너의 라우터를 *사용* 하지는 않음 — 병행 가능.

---

## 4. PR-2 브리프 골격 (본격 시점에 PR-1 형식으로 확장)

### 4.1 산출물
- `Source/HktCore/Public/Terrain/HktRegionId.h` — 순수 함수 namespace
  - `MacroTile ToMacroTile(ChunkX, ChunkY, TileSize=8)`
  - `uint32 FromChunkCoord(ChunkX, ChunkY)` — pack(MacroTile.X, MacroTile.Y) as uint32
- `Source/HktCore/Public/HktCoreProperties.h` — PropertyId 그룹 A 추가
  - 04 §3 의 scalar counter: `RegionSeenTheGrain`, `RegionHarvestedClusters`, `RegionFireCounter`, `RegionDeadTrees`, `RegionCrossingPoints`, `RegionFelledElders` 등 ≈ 10 슬롯
  - 할당 범위: 기존 사용 범위 (확인 후) 와 겹치지 않는 새 블록 (예: 800~819)
- `Source/HktCore/Public/HktWorldState.h` + `.cpp`
  - `FHktEntityId FindOrCreateRegionEntity(uint32 RegionId)` — 내부 `TMap<uint32, FHktEntityId>` 캐시, 없으면 `AllocateEntity` + `AddTag("Entity.Region")`
- `Source/HktCore/Public/HktStoryBuilder.h` — Builder helper 추가
  - `RegionAddScalar(FHktVar RegionEntity, uint16 PropId, int32 Delta)` — `LoadStoreEntity + AddImm + SaveStoreEntity` 의 ScopedReg 래퍼
- `HktAutomationTests/Private/Tests/HktOpcodeTests_Region.cpp` (신규)

### 4.2 핵심 안티 패턴
- ❌ Region 을 별도 store 로 만들지 말 것 — 일반 entity SoA 재사용 (절대 원칙 5).
- ❌ Region 의 SoA column 신규 추가 금지 — 기존 SoA + 신규 PropertyId 만.
- ❌ Region 해소 (FindOrCreateRegion) 를 HktRule cpp 에 두지 말 것 — `FHktWorldState` 멤버 함수로 두고, 추후 VM 옵코드 (PR-3 또는 별도) 가 호출.

### 4.3 완료 기준
- `HktOpcodeTests_Region.cpp` 의 7 테스트 통과:
  - RegionId 결정론 (같은 coord → 같은 id) × 2 (양수 / 음수 chunk)
  - MacroTile 그룹화 (TileSize 내 청크 동일 RegionId) × 1
  - 다른 tile → 다른 RegionId × 1
  - FindOrCreateRegion creation × 1
  - FindOrCreateRegion cache hit (같은 RegionId 두 번 호출 → 같은 entity) × 1
  - RegionAddScalar increment × 1

---

## 5. PR-3 브리프 골격

### 5.1 산출물
- 신규 EOpCode 2 종: `LoadStoreIndexed`, `SaveStoreIndexed`
  - 시그니처: `(Dst, EntityReg, BasePropIdImm, KeyReg)` / `(EntityReg, BasePropIdImm, KeyReg, ValueReg)`
  - 동작: 실제 PropertyId = `BasePropId + KeyReg`, 단 `Key >= MaxKey(=16)` 면 silent (Read=0 / Write=skip)
- VM Interpreter 분기 추가, decode 테이블 추가, Builder fluent API 추가
- `RegionMapRead(Dst, RegionEntity, BasePropIdImm, KeyVar)` / `RegionMapWrite(RegionEntity, BasePropIdImm, KeyVar, ValueVar)` — wrapper
- PropertyId 그룹 C 추가 (map base IDs): `RegionVariantCatalogBase`, `RegionOreDepletedBase`, `RegionHarvestedClustersBase` — 각각 16 슬롯 reserved

### 5.2 핵심 결정 (시작 전 결정 필요)
- **Max key 범위** — 시즌 0 은 16 으로 고정. 키 범위 확장은 시즌 1+ 별도 PR.
- **PropertyId 그룹 C 의 reserved 블록 크기** — base × 16 → group 당 16 슬롯. 3 group = 48 슬롯 reserved.
- **out-of-range key 처리** — `Read=0`, `Write=skip`. exception / Fail 아님 (결정론 친화).

### 5.3 완료 기준
- map read/write × 4 key 결정론 테스트 통과
- out-of-range key safe behavior 검증 × 2

---

## 6. PR-4+ — 07 본문 작성 (1 PR 1 spawner)

### 6.1 첫 작업: **Birch 트리** (가장 단순한 시나리오 — 데모)

#### 산출물
- `HktGameplay/Content/Stories/Natural/Birch/birch-spawn.json` — chunk-load spawner
- `HktGameplay/Content/Stories/Natural/Birch/birch-felled-listener.json` — `Event.Natural.TreeFelled` 수신
- `HktGameplay/Content/Stories/Natural/Birch/birch-sapling-seed.json` — `Event.Region.SaplingSeed` 수신
- 위 3 story 의 시나리오 테스트 (HktStoryScenarioTests.cpp)

#### 시나리오
```
[청크 로드]
  → birch-spawn 진입
  → RegionAddScalar(RegionBirchCount, +1) — 카운터 read
  → If RegionBirchCount >= 12: Halt    (cap)
  → SpawnEntityAround(Entity.Natural.Birch, Circle, N=3, Radius=400)

[플레이어가 Birch 베기 — Action.Natural.Fell]
  → HktRule.RouteAction → Event.Natural.TreeFelled (P0=Birch tag id, P1=Pos hash)
  → birch-felled-listener 진입
  → 거리·도구 판정 (Axe + Material.Wood 이상)
    Precondition:
      GetDistance(d, Self, EventSource) → CmpLe(d, 200)
      FindByOwner(Tool, EventSource, Entity.Tool.Axe)
      HasTag(Tool, Material.Wood) OR Stone OR Sharpened
  → DestroyEntity(Self)
  → SpawnEntityAt(Entity.Natural.Branch, EventLocation, 3)
  → RegionAddScalar(RegionBirchCount, -1)
  → DispatchEvent(Event.Region.SaplingSeed, EventLocation + RandomInt offset)
  → Halt

[Event.Region.SaplingSeed 수신]
  → birch-sapling-seed 진입
  → If RegionBirchCount >= 12: Halt
  → SpawnEntityAt(Entity.Natural.BirchSapling, EventLocation)
  → Halt
```

#### 완료 기준
- 시나리오 테스트: 트리 베기 1 회 → Branch 3 개 + BirchSapling 1 개 생성 + RegionBirchCount 변화 확인.
- 결정론 보장: 같은 seed / 같은 frame 으로 재실행 시 동일 결과.

### 6.2 이후 PR 들

03 의 11 spawner 중 우선순위 순:
1. Birch (위) ← *PR-4*
2. Oak (lineage 분기) ← *PR-5*
3. BerryBush (PR-3 필요) ← *PR-6*
4. Pine slope + FireIgnited ← *PR-7*
5. ... (S04~S11)

---

## 7. 진행 상태

- [x] **PR-1** — 태그 + HktRule echo 라우터
- [x] **PR-2** — Region 인프라 (RegionId / FindOrCreate / RegionAddScalar)
- [ ] **PR-3** — Indexed opcode (LoadStoreIndexed / SaveStoreIndexed) + RegionMapRead/Write
- [ ] **PR-4** — Birch spawner story 본문 + 데모 시나리오 테스트
- [ ] **PR-5+** — 03 의 나머지 spawner

---

## 8. 시작 전 결정 필요 사항

| # | 결정 | 옵션 | 누가 |
|---|---|---|---|
| **D1** | PR-1 의 echo 라우터가 들어갈 모듈 | (a) 기존 HktRule / (b) 신규 `HktNaturalRule` 서브모듈 | 사용자 선택 |
| **D2** | 태그 등록 위치 | (a) 기존 `HktCoreTags.h` 가 있으면 거기 / (b) 신규 `HktNaturalTags.h` | agent 가 코드 조사 후 결정 |
| **D3** | PR-4 의 첫 트리 종 | (a) Birch (위 시나리오) / (b) Oak (사용자 예제 직접) / (c) 다른 종 | 사용자 선택 |
| **D4** | PR-2 의 PropertyId 그룹 A 시작 ID | 기존 namespace 충돌 검사 후 결정 (agent) | agent |
| **D5** | PR-3 의 max key 16 vs 8 | 16 (시즌 0 변형 종 수 여유) — 디폴트 | Resolved (16) |

D1 / D3 만 시작 전 결정 필요. D2 / D4 는 agent 가 코드 보고 결정.

---

## 9. 결정 요약 (1 화면)

```
PR-1  (no dep)         HktRule echo 라우터  + Tag 카탈로그 32 종
PR-2  (no dep)         Region 인프라 (PropertyId A + RegionId + RegionAddScalar)
PR-3  (dep: PR-2)      Indexed opcode + RegionMapRead/Write + PropertyId C
PR-4  (dep: PR-1+2)    Birch 트리 1 종 데모 (3 story file + 시나리오 테스트)
PR-5+ (dep: PR-4)      Oak / BerryBush / Pine / ... 각 1 PR

판정 모델: 최소 — HktRule echo, 모든 판정은 VM bytecode 내부
opcode 신규: 2 (LoadStoreIndexed / SaveStoreIndexed)
            + (선택) CheckFacing — Frontal arc 검사 필요 시
helper 신규: RegionAddScalar / RegionMapRead / RegionMapWrite (기존 opcode wrapper)
```
