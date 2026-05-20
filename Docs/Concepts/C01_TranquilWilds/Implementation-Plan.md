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
| cluster / variant 별 카운터 | region 안의 *키별* record entity (lineage / variant / ore species) | ❌ | **PR-3 (entity-per-record + RegionMapRead/Write)** — Birch 데모에는 불필요, Oak/BerryBush/Mushroom 부터 필요 |

→ **최소 데모 경로**: **PR-1 + PR-2** 만 끝나면 *"주변 spawn (cap 있음) → 베기 → 재료 drop → 인접 묘목 시드"* 까지 1 종 트리 완결 작동.

---

## 2. 4 PR 시퀀스

```
PR-1 (M3-lite)  태그 카탈로그 + HktRule echo 라우터          [의존: 없음]
                ※ 라우터 부분은 PR-4 검토 중 ADR-R1 (§3.7) 로 폐기.
                  Event.Natural.* 태그 카탈로그는 유지.
PR-2 (M1)       Region 인프라 (RegionId + PropertyId + RegionAddScalar)
                                                              [의존: 없음, PR-1 병행 가능]
PR-3 (M2)       Region record entity (Lineage/Variant/OreSpecies)
                + FindOrCreateRegionRecord (SoA 선형 스캔)
                + Builder helper RegionMapRead/Write           [의존: PR-2]
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

### 3.7 ADR-R1 — `HktNaturalActionRouter` 폐기 (2026-05-14)

> **결정**: PR-4 검토 중 발견. PR-1 의 `Action.Natural.* → Event.Natural.*` echo 라우터 + `Action.Natural.*` 태그 카탈로그 8 종 + `HktNaturalRouterTests.cpp` + `FHktDefaultServerRule::OnReceived_RuntimeEvent` 의 wire-up 분기를 **모두 제거**. 클라이언트는 `Event.Natural.*` 를 직접 발사하며 검증은 VM precondition + 결정론 모델이 단독 담당한다.

#### 폐기 사유

| # | 사유 |
|---|---|
| **R1** | 라우터는 사실상 lookup-rename 함수 — EventTag 만 바꾸고 8 개 필드를 그대로 복사. 어떤 검증도 추가하지 않음. |
| **R2** | "권위 경계" 가설은 잘못된 인식. 본 프레임워크의 server-authoritative (절대원칙 3) 는 **VM 결정론** + **각 story 의 precondition** 으로 보장된다. 클라가 EventTag 를 변조해도 (a) precondition 이 실패하면 dispatch 거부 (b) 통과해도 VM 결과가 다른 클라/서버와 결정론 불일치 → GGPO/desync 로 검출. 라우터 변환은 이 chain 의 어디에도 기여하지 않음. |
| **R3** | "Action vs Event" namespace 분리의 기능적 가치 없음. 로깅 가독성 외에는 의미 없음. 그조차 `HKT_EVENT_LOG` 의 source 채널 (Client/Server) 로 구분 가능. |
| **R4** | 향후 확장점 명목 (스로틀링, N:1 매핑, 안티치트) 도 모두 실제로는 다른 계층 (RPC throttling, story precondition, 결정론 검증) 의 책임. 라우터 단계에서 의미를 가질 수 없음. |

#### 제거 산출물

- `HktGameplay/Source/HktRule/Public/HktNaturalActionRouter.h`
- `HktGameplay/Source/HktRule/Private/HktNaturalActionRouter.cpp`
- `HktGameplayDeveloper/.../Tests/HktNaturalRouterTests.cpp`
- `HktNaturalActionTags` namespace (8 종 `Action.Natural.*` 태그)
- `FHktDefaultServerRule::OnReceived_RuntimeEvent` 의 라우터 호출 분기

#### 유지

- `HktNaturalEventTags` namespace (13 종 `Event.Natural.*`) — 클라가 직접 발사할 시뮬 이벤트 카탈로그.
- 05-interactions.md / 06-tools.md 의 *게임 디자인* 기술 — "플레이어 행위" 라는 표현은 디자인 의도 기술로 보존하되, 구현은 `Event.Natural.*` 직접 발사로 단순화.

#### 클라이언트 측 책임

플레이어가 도끼로 Birch 우클릭 → 클라이언트가 직접 `FHktEvent { EventTag = Event.Natural.TreeFelled, Source = player, Target = tree, Location = tree.pos }` 를 ServerRPC 로 송신. 서버는 ownership 검증 + EventId 시퀀스 부여 후 그대로 `PendingGroupIntents` 큐에 enqueue. 거리/도구 검증은 `Birch_FelledListener.json` 의 step 들이 담당.

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
  - `FHktEntityId FindOrCreateRegionEntity(uint32 RegionId)` — **SoA 선형 스캔** (`Entity.Region` 태그 + `RegionIdKey` 컬럼 매치), 없으면 `AllocateEntity` + `AddTag("Entity.Region")` + `SetProperty(RegionIdKey)`. *보조 hash 캐시 도입 금지* — VM 메모리 모델 가드 (04 §1).
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

## 5. PR-3 브리프 골격 (재계획 — 04 ADR D1/D4 정합)

> **모델 전환 기록**: 본 PR 의 초기 안은 `LoadStoreIndexed` / `SaveStoreIndexed` opcode + `BasePropId + 16 슬롯 reserved` 의 *column-slot 모델* 이었다. 04 ADR §3-D1/D4 의 *entity-per-record 모델* 및 VM 메모리 모델 가드 (시뮬 상태 = SoA 만, hash 자료구조 금지) 와 충돌하므로 폐기. 본 §5 는 entity-per-record 로 재작성된 산출물 명세다.

### 5.1 산출물

| # | 변경 | 위치 | 구현 |
|---|---|---|---|
| **A. RegionRecord 태그** | `Entity.RegionRecord` (parent) + `.Lineage` / `.Variant` / `.OreSpecies` (leaf) 4 종. EHktArchetype 확장 *안 함* — PR-2 의 Region 패턴(태그-only 식별) 그대로 따른다. record 는 trait composition 이 필요 없는 pure 데이터 row 이므로 archetype enum 으로 끌어올릴 동기 없음. | `HktCore/Public/HktCoreDefs.h` + `.cpp` | ✅ |
| **B. PropertyId 추가** | Cold tier 10 슬롯: `RecordKey` (32bit 공용 키, Lineage/Variant/Ore 모두 재사용) + `LineageFelledCount` / `LineagePromotedCount` / `LineageElderPosX/Y/Z` + `VariantPotency` / `VariantFirstFoundFrame` + `OreDepletedCount` / `OreCurrentSpeciesId`. `RegionIdKey` 는 PR-2 의 것 재사용. | `HktCore/Public/HktCoreProperties.h` | ✅ |
| **C. WorldState SoA lookup** | `FHktEntityId FHktWorldState::FindOrCreateRegionRecord(uint32 RegionId, const FGameplayTag& RecordTag, uint32 KeyHash)` — PR-2 의 `FindOrCreateRegionEntity` 와 동일 *SoA 선형 스캔* 패턴, 4-조건 매치 (`RecordTag` + `RegionIdKey` + `RecordKey` + parent tag). 보조 hash 인덱스 도입 *금지* (VM 메모리 모델 가드). | `HktCore/Public/HktWorldState.h` + `.cpp` | ✅ |
| **D. 신규 opcode + VM Host fn** | `EOpCode::RegionMapFindOrCreate(W,R,R)` — host-call 카테고리 (FindByOwner/SpawnEntity 와 동일). interpreter 가 RegionEntity vreg 에서 RegionIdKey 를 읽어 `FindOrCreateRegionRecord` 호출, 결과 EntityId 를 Dst vreg 에 적재. VM Proxy 의 `AllocateEntity` / `AddTag` / `SetProperty` 가 이미 dirty 추적 — 별도 hook 불필요. Precondition evaluator 의 skip-list 에 추가 (record 생성은 부작용). Validator 가 entity-reg flow 추적. | `HktCore/Public/HktStoryTypes.h`, `HktCore/Private/VM/HktVMInterpreter.{h,cpp}`, `HktVMInterpreterActions.cpp`, `HktStoryValidator.cpp` | ✅ |
| **E. Builder helper** | `RegionMapFindOrCreate(RegionEntity, RecordTag, KeyVar)` → 새 record vreg 반환. `RegionMapRead(Dst, RegionEntity, RecordTag, KeyVar, PropId)` 와 `RegionMapWrite(RegionEntity, RecordTag, KeyVar, PropId, ValueVar)` 는 FindOrCreate + 기존 `LoadStoreEntity` / `SaveStoreEntity` 시퀀스 emit. PR-2 의 `RegionAddScalar` 패턴 연장. | `HktCore/Public/HktStoryBuilder.h` + `.cpp` | ✅ |
| **F. 자동화 테스트** | `HktOpcodeTests_RegionMap.cpp` (신규) — 6 테스트: ① Creation (row + 태그 + RegionIdKey + RecordKey) ② CacheHit (같은 키 재호출) ③ MultiKey (같은 region 의 42/137 격리) ④ CrossRegion (regionA.42 vs regionB.42 격리) ⑤ RegionMapWrite VM 실행 (Builder emit 시퀀스 → record 컬럼 갱신) ⑥ RegionMapRead lazy create (read-before-create → 자동 생성 + default 0). Runner 등록. | `HktAutomationTests/Private/Tests/HktOpcodeTests_RegionMap.cpp` + `HktAutomationTestsRunner.cpp` | ✅ |

### 5.2 핵심 결정 (이미 합의)

- **VM 메모리 모델 가드** — 시뮬 상태는 SoA 연속 컬럼만. TMap / TArray<TArray> / 포인터 그래프 일체 금지. lookup 은 SoA 선형 스캔.
- **신규 opcode 1 (host-call 카테고리)** — `RegionMapFindOrCreate(Dst=RecordEntity, Src1=RegionEntity, Src2=KeyVar, Imm12=RecordTag NetIndex)`. record key 가 *런타임 vreg* 값이므로 dispatch-time 사전 해소 불가 → VM 측 host-call 이 필요하다. `FindByOwner` / `SpawnEntity` / `CountByTag` 와 동일 카테고리. **신규 property 어드레싱 모드 0** (04 §1-3 의 본래 의도) — `LoadStoreEntity` / `SaveStoreEntity` 그대로 사용해 record 컬럼에 접근.
- **키 폭 제약 없음** — `KeyHash` 는 32bit 자유 hash. modulo 슬롯 매핑 없음 → 충돌 0.
- **선형 스캔 성능** — 시즌 0 의 RegionRecord row 총합 추정 < 활성 region 16 × 25 ≈ 400. spawner story 진입 시 1 회 호출 (cold path). 04 §11 트리거 (수천 row) 발화 시 별도 ADR 로 가속 자료구조 검토 — 단 VM 메모리 모델 위반 없는 형태 (SoA 정렬 컬럼 + 이진탐색 등).
- **EntityType 범위 D3** — 시즌 0 demo 우선순위 (Birch → Oak → BerryBush → Mushroom) 를 따라 `RegionLineage` / `RegionVariant` / `RegionOreSpecies` 3 종만. `RegionPeak` (S08 명명권) / `RegionFeature` (S06/S07/S10) 는 해당 spawner 진입 PR 에서 추가.

### 5.3 안티 패턴 (절대 금지)

- ❌ 보조 hash 인덱스 (`TMap<(RegionId<<32)|Key, EntityRow>` 등) — VM 메모리 모델 위반.
- ❌ *property 어드레싱* opcode (`LoadStoreIndexed` / `SaveStoreIndexed` 류) 부활 — 04 §1-3 / §3-D1 위반. host-call 카테고리의 `RegionMapFindOrCreate` 1 개는 허용 (record entity 자체를 해소만 함, property 어드레싱은 기존 그대로).
- ❌ `BasePropId + 16` 슬롯 reserved 블록 — column-slot 모델 부활 금지. record 컬럼은 *record entity 의 일반 PropertyId* 로 정의.
- ❌ `KeyHash % N` modulo 슬롯 매핑 — 충돌 위험.
- ❌ region record 의 별도 store / 별도 SoA — 절대 원칙 5 위반.

### 5.4 완료 기준

- 빌드 success.
- `HktOpcodeTests_RegionMap.cpp` 6 테스트 통과 (§5.1-F).
- 신규 태그 4 종 / `HKT_DEFINE_PROPERTY` 10 슬롯 등록 충돌 0 (기존 namespace 와 비교 검증).
- PR 본문이 04 ADR §3-D1/D4/D6 + 본 §5.2 의 VM 메모리 모델 가드를 인용.
- 04 §1 가드레일 표의 *VM 메모리 모델* 행이 본 PR 의 커밋 메시지 / PR description 에 명시.

### 5.5 구현 결과 (커밋 `4980977`)

- 변경 15 files / +623 lines.
- 위 §5.1 의 A~F 모두 ✅.
- §5.4 의 빌드 verify 는 sandbox 에 Unreal Editor binary 가 없어 **agent 측에서 실행 못함** — `HktGameplayDeveloper/Tools/run_automation_tests.py` 로 로컬/CI 환경에서 검증 필요. 코드 일관성은 PR-2 패턴을 면밀히 참조.
- 후속 PR (PR-5+ Oak) 에서 본 helper 가 첫 실사용처가 된다.

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

- [x] **PR-1** — 태그 카탈로그 (Event.Natural.* 13종 + Entity.Tool.* 5종 + Material.* 6종). *라우터 부분 (Action.Natural.* 8종 + HktNaturalActionRouter + 테스트) 는 §3.7 ADR-R1 로 폐기.*
- [x] **PR-2** — Region 인프라 (RegionId / FindOrCreate / RegionAddScalar)
- [x] **PR-3** — Region record entity (Lineage/Variant/OreSpecies) + `FindOrCreateRegionRecord` (SoA 선형 스캔) + `RegionMapFindOrCreate` host-call opcode + `RegionMapRead`/`RegionMapWrite` Builder helper. *property 어드레싱 모드 신규 0, hash 자료구조 0.*
- [x] **PR-4** — Birch JSON spawner 3종 (`Content/Stories/Natural/Birch/`) + `.spec.json` 사이드카 (HktStorySpec 자동화). 신규 태그 5종(`Entity.Natural.{Birch,Branch,BirchSapling}` · `Event.Region.SaplingSeed` · `Story.Flow.Spawner.Natural.Birch`). **§3.7 ADR-R1 결정**: 검토 중 라우터 가치 부재 확인 — 라우터/`Action.Natural.*` 태그/wire-up 모두 제거. 클라이언트가 `Event.Natural.*` 직접 발사 모델로 단순화. **범위 노트**: §6.1 시나리오의 `RegionAddScalar`/`RegionMapWrite` 는 JSON op 노출이 PR-2/PR-3 산출에 없으므로 *글로벌 cap*(기존 JSON op `CountByTag` 활용) 으로 대체 — region-scoped cap 은 PR-5+ 에서 교체. **남은 갭**: (1) 클라이언트가 `Event.Natural.TreeFelled` 를 발사하는 입력/UI 경로 (HktUI/HktPresentation 측 책임), (2) BakedAsset 의 `FHktTerrainSpawnerSpec` 에 Birch spawner entry — 둘 다 PR-4 의 컨텐츠 범위 밖.
- [x] **PR-5** — Oak (lineage 분기, 03 §S02). Oak JSON spawner 3종 (`Content/Stories/Natural/Oak/`) + `.spec.json` 사이드카. 신규 태그 6종(`Entity.Natural.{Oak,OakElder,OakSapling}` · `Event.Region.OakSaplingSeed` · `Event.Natural.OakFelled` · `Story.Flow.Spawner.Natural.Oak`). **Region helper JSON op 노출**: `FindOrCreateRegionAt` / `RegionAddScalar` / `RegionMapFindOrCreate` / `RegionMapRead` / `RegionMapWrite` 5종을 V2 핸들러로 등록 — PR-3 Builder helper 의 emit 시퀀스를 그대로 호출. **신규 host-call opcode 1종**: `FindOrCreateRegionEntityAt(W,R,R)` — 위치(cm) → chunk → RegionId → RegionEntity 해소. spawner story 가 Param0/Param1 의 spawn 좌표만으로 region-scoped helper 진입점을 얻는다. 결정론: `TerrainState->VoxelSizeCm` 정수 캐스팅 + `FHktTerrainState::FloorDiv`. precondition skip-list + validator entity-reg 추적 갱신. **Lineage 데모 회로**: Oak_Spawn 이 LineageFelledCount cap 검사 + LineageElderPosX/Y 기록 + spawn 한 모든 Oak 의 RecordKey 에 LineageId 적재. Oak_FelledListener 가 Target 의 RecordKey 로 LineageId 회복 → LineageFelledCount +1, RegionOakCount -1, Param2 채워 OakSaplingSeed 디스패치. Oak_SaplingSeed 가 LineageId 를 sapling 의 RecordKey 에 계승. **이벤트 태그 분리(ADR-T1)**: `FHktVMProgramRegistry::RegisterProgram` 이 tag→program 1:1 (overwrite) 라 Birch 와 Oak 리스너가 동일 `Event.Natural.TreeFelled` 로 동시 등록 불가 (test 자동화 시 last-wins 로 한쪽이 사라짐 → spec 실패). Oak 리스너의 storyTag 를 `Event.Natural.OakFelled` 로 분리, 클라이언트가 target 의 종 태그에 따라 트리별 이벤트를 직접 발사하도록 임시 우회. **남은 갭**: (1) 클라 입력/UI 가 종 태그별 이벤트 분기, (2) BakedAsset 의 Oak spawner entry, (3) router story 또는 multi-handler 레지스트리 도입 시 `TreeFelled` 단일 진입 복원 (PR-6+).
- [x] **Placement Story 패스 전환** (2026-05-15) — cpp 하드코딩 biome→Story 매핑을 폐기하고 bytecode 통일. (1) `Event.Terrain.ChunkLoaded` 신규 이벤트 — sim 이 새 surface 청크 로드 시 발화 (Param0/1=청크 중심 cm, Param2=BiomeId, Param3=SlotHash31). (2) `FHktTerrainBakedChunk` v3 surface metadata (BiomeId/SurfaceVoxelZ/SlotHash/bIsSurfaceChunk). (3) `IHktTerrainDataSource::TryGetChunkContext` + `FHktTerrainProvider` 구현. (4) `FHktTerrainSystem::Process` 가 `GetChunkSpawners` (명시 배치) 와 `ChunkLoaded` (biome 정책) 둘 다 emit — **공존 정책**. (5) 기본 정책 JSON `Content/Stories/Natural/Placement_TranquilWilds.json` — biome switch → `DispatchEvent OakSpawn/BirchSpawn`. `Spawners[]` 는 명시 배치 (보스/랜드마크/HktMapSpawnerAdapter) 전용으로 의미 재정의 — 자동 채움 안 함. Design-VoxelSpawner.md §Runtime 진입 메커니즘 갱신. PR-4/PR-5 "BakedAsset spawner entry" 갭 해소.
- [ ] **PR-6+** — 03 의 나머지 spawner (BerryBush / Pine slope / RiverEdge / ...) + Birch 의 글로벌 cap → region-scoped cap 마이그레이션.

---

## 8. 시작 전 결정 필요 사항

| # | 결정 | 옵션 | 누가 |
|---|---|---|---|
| **D1** | PR-1 의 echo 라우터가 들어갈 모듈 | (a) 기존 HktRule / (b) 신규 `HktNaturalRule` 서브모듈 | 사용자 선택 |
| **D2** | 태그 등록 위치 | (a) 기존 `HktCoreTags.h` 가 있으면 거기 / (b) 신규 `HktNaturalTags.h` | agent 가 코드 조사 후 결정 |
| **D3** | PR-4 의 첫 트리 종 | (a) Birch (위 시나리오) / (b) Oak (사용자 예제 직접) / (c) 다른 종 | 사용자 선택 |
| **D4** | PR-2 의 PropertyId 그룹 A 시작 ID | 기존 namespace 충돌 검사 후 결정 (agent) | agent |
| **D5** | PR-3 의 키 폭 / 슬롯 모델 | ~~column-slot 16 슬롯~~ 폐기. 04 ADR D4 의 entity-per-record 채택 — KeyHash 32bit 자유, 슬롯/모듈로 매핑 없음. | Resolved (entity-per-record) |

D1 / D3 만 시작 전 결정 필요. D2 / D4 는 agent 가 코드 보고 결정.

---

## 9. 결정 요약 (1 화면)

```
PR-1  (no dep)         HktRule echo 라우터  + Tag 카탈로그 32 종
PR-2  (no dep)         Region 인프라 (PropertyId A + RegionId + RegionAddScalar)
PR-3  (dep: PR-2)      Region record entity (Lineage/Variant/OreSpecies)
                       + FindOrCreateRegionRecord (SoA 선형 스캔)
                       + RegionMapRead/Write Builder helper
PR-4  (dep: PR-1+2)    Birch 트리 1 종 데모 (3 story file + 시나리오 테스트)
PR-5+ (dep: PR-4)      Oak / BerryBush / Pine / ... 각 1 PR

판정 모델: 최소 — HktRule echo, 모든 판정은 VM bytecode 내부
opcode 신규: 1 host-call (RegionMapFindOrCreate) — property 어드레싱은 기존 LoadStoreEntity/SaveStoreEntity 그대로
            + (선택) CheckFacing — Frontal arc 검사 필요 시
helper 신규: RegionAddScalar (PR-2) / RegionMapRead / RegionMapWrite (PR-3, 기존 opcode wrapper)
메모리 모델: 시뮬 상태 = SoA 연속 컬럼만. TMap/hash 자료구조 시뮬 진실로 두지 않음.
```
