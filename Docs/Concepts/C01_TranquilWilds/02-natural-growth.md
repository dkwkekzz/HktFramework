# C01-02 — 자연 성장 컨텐츠 설계 (skeleton)

> **목적**: [`01-natural-entities.md`](./01-natural-entities.md) 의 20 entity 가 *시간과 지형 조건* 에 따라 변하면서 "살아있는 풀숲" 의 1차 인상을 만들어내는 규칙을 정의한다.
> **상태**: Skeletal. 인과 사슬과 Story 본문은 후속 (`04-story-seeds`, `05-story-dispatch`).
> **상위**: [`README.md`](./README.md)
> **이전**: [`01-natural-entities.md`](./01-natural-entities.md)

---

## 0. 무엇을 "성장" 이라 부르는가

본 컨셉에서 "자연 성장" 은 세 가지 의미를 동시에 가진다.

| 의미 | 주체 | 예 |
|---|---|---|
| **A. 개체 성장** | entity 본인 | 묘목 → 자작나무 → 노목 → FallenLog |
| **B. 군집 확산** | 같은 tag 의 무리 | BerryBush 가 인접 셀로 번짐 |
| **C. 천이 (succession)** | 다른 tag 로의 교체 | 화재 흔적 → Grass → Shrub → Birch |

세 의미가 같은 시뮬레이션 평면에서 다뤄지되, **Story 단위는 다르다** — A 는 entity 자신의 GrowthStoryTag, B 는 부모 spawner story, C 는 환경 이벤트가 깨우는 dispatch.

---

## 1. 가드레일 (재인용)

- **G1 / G3** — 성장도 spawner spec 의 `GrowthStoryTag` (Story V2 JSON) 로만 표현. 신규 opcode 도입 금지가 기본.
- **G5** — 성장 판정은 서버 시뮬레이션. 클라는 `FHktWorldView` 차이만 본다.
- **VM 제약** — 청크 단위 dispatch (TerrainSpawner.design.md §7) 만 사용. tick 단위 polling 은 매 frame 부담이라 최후 수단.

---

## 2. 시간 스케일 매핑

이전 시리즈 (`Concept01_TranquilWilds/02-system-skeleton.md`) 의 3-Tier 를 본 PR 의 entity 들에 매핑.

| Tier | 주기 | 트리거 | 본 PR 에서 다루는 entity 변화 |
|---|---|---|---|
| **Whisper** (마이크로) | 분 단위 | 청크 로드 / 가까운 행위 | Grass 살랑임, Mushroom 포자 흩어짐 (시각 큐 위주) |
| **Tremor** (미들) | 세션 단위 (~1h) | 환경 임계치 / Story 누적 | BerryBush 결실, FallenLog 생성, Spring 인근 NPC 모임 시드 |
| **Quake** (매크로) | region 영속 | 누적 chain / 명명권 | 산불 흔적 → 변종 식생, 산봉 명명, 강 흐름 영구 변경 |

본 PR (skeleton) 의 책임은 **각 entity 가 어느 Tier 의 후보인지만 표시** 하는 것. 임계치/곡선은 후속.

---

## 3. Entity × 성장 매트릭스

각 셀은 (성장 유형 A/B/C, 후보 Tier).

| Entity | A 개체 성장 | B 군집 확산 | C 천이 |
|---|---|---|---|
| Grass (F01) | — | Tremor | Quake (화재→재생) |
| Shrub (F02) | Tremor | Tremor | — |
| Birch (F03) | Tremor (묘목→성목) | — | Tremor (Grass→Birch) |
| Oak (F04) | Quake (노목화) | — | Quake (Birch→Oak) |
| Pine (F05) | Tremor | Tremor (산악) | — |
| BerryBush (F06) | — | Tremor | — |
| Herb (F07) | — | — | Quake (변종 발현) |
| Mushroom (F08) | — | Whisper | Quake (Oak 노목 인근 변종) |
| Reed (F09) | — | Tremor (강가) | — |
| WaterLily (F10) | — | Tremor | — |
| Boulder (G01) | — | — | Quake (낙석으로 분포 변동) |
| OreOutcrop (G02) | — | — | — (정적) |
| Pebble (G03) | — | Tremor (Boulder 파괴 시) | — |
| CaveMouth (G04) | — | — | — (정적) |
| Ford (W01) | — | — | Quake (강 흐름 변경 시 이동) |
| Waterfall (W02) | — | — | — |
| Spring (W03) | — | — | — |
| Peak (M01) | — | — | — |
| FallenLog (T01) | Tremor (썩어 사라짐) | — | Tremor (Oak/Pine 사멸 시 생성) |
| AnimalTrail (T02) | Whisper (이동) | Tremor | Quake (Spring 발견 시 굳어짐) |

> 빈 셀은 "본 시즌 0 에는 다루지 않는다" 의 의미. 후속 PR 에서 채워질 수 있다.

---

## 4. 성장 트리거 (Tier 별 dispatch 패턴)

### 4-1. Whisper — 청크 로컬 시각 큐

- 청크가 로드되는 순간 spawner story 가 한 번 emit 후 종료.
- 별도 dispatch 없음. (`FHktEvent::Spawner` 1회 → entity 시각 attribute 갱신).
- **본 PR 에서는 후속 작업** — VFX 와 연동되므로 `HktPresentation` 책임.

### 4-2. Tremor — 시간/조건 임계치

- spawner story 가 **다른 spawner story 로 dispatch**.
- 예: `Spawner.Story.Natural.OakGrove` 가 종료 시점에 `Spawner.Story.Natural.MushroomSeed` 를 인접 셀로 emit.
- 구현: 기존 opcode (`SpawnEntity`, `RandomInt`, `LoadStore Param2`) 조합. 신규 opcode 0.

```text
[Spawner.Story.Natural.OakGrove]            (Tremor)
   ├─ SpawnEntity(Oak, slot0..N)
   └─ dispatch → Spawner.Story.Natural.MushroomSeed     (Whisper 후보)
       └─ SpawnEntity(Mushroom) at NearbyShadeCell
```

`dispatch` 는 별도 opcode 가 아니라 *spawner story 내부에서 `FHktEvent::Spawner` 를 큐에 다시 넣는 패턴*. (TerrainSpawner.design.md §4-a 의 `PendingGroupIntents` 재사용).

### 4-3. Quake — region 영속 변형

- region 누적치 (예: 화재 발생 N 회, 베어진 노목 수, 봉우리 명명 수) 가 임계 초과 시 단발 dispatch.
- 본 시즌 0 에서는 **이벤트만 정의** — 본문은 후속.
- 예: `Event.Natural.FireScarMature` → `Spawner.Story.Natural.BurnedSuccession` 으로 dispatch.

---

## 5. Story Dispatch 그래프 (자연 영역, 1차)

본 PR 은 그래프 *형상만* 합의한다. 실제 Story JSON 은 후속.

```
[청크 로드]
     │
     ├──▶ Spawner.Story.Natural.GrassPlain        (Tremor)
     │        └─▶ Spawner.Story.Natural.BerryPatch    (Tremor, 조건부)
     │
     ├──▶ Spawner.Story.Natural.OakGrove           (Tremor)
     │        ├─▶ Spawner.Story.Natural.MushroomSeed (Whisper, 그늘 셀)
     │        └─▶ Spawner.Story.Natural.FallenLogDecay (Tremor, 노목화 후)
     │
     ├──▶ Spawner.Story.Natural.PineSlope          (Tremor)
     │        └─▶ Event.Natural.FireSusceptible    (환경 신호)
     │
     ├──▶ Spawner.Story.Natural.RiverEdge          (Tremor)
     │        ├─▶ Reed / WaterLily 군집
     │        └─▶ Spawner.Story.Natural.AnimalTrailSeed
     │                └─▶ Spring 발견 시 Quake dispatch → Trail 굳어짐
     │
     └──▶ Spawner.Story.Natural.MountainCap        (Tremor)
              ├─▶ Peak / Cliff / OreOutcrop
              └─▶ CaveMouth (정적, dispatch 없음)
```

> 가지 끝의 **잎 노드만 entity 를 spawn** 한다. 중간 노드는 분기 + 조건 + Param 결정 역할.
> 이 그래프가 *컨셉의 골격* — 후속 PR 에서 각 노드 1개씩 Story JSON 으로 살을 붙인다.

---

## 6. 도파민·미지·성장 매핑 (1차)

| 가치 | 본 PR 에서 어떻게 시연되는가 |
|---|---|
| **미지** | T02 AnimalTrail 추적 → Spring 발견 → Quake dispatch 로 trail 영속화. 같은 region 재방문 시 "전에 내가 굳힌 길" 이 남아있다. |
| **도파민** | BerryBush 결실(Tremor), FallenLog 채집(Tremor), OreOutcrop 채광(즉시) — 마이크로 보상이 청크 로드마다 분포. |
| **무한 성장** | Oak 노목화 → Mushroom 변종 → Herb 변종 사슬이 region 단위로 누적. 명명권(Peak) 으로 매크로 영속화. |

세 가치의 충돌 해소(예: 도파민 vs 미지) 는 후속 `06-growth-loops.md`.

---

## 7. 본 PR 의 결론

1. 20개 자연 entity 의 성장 유형(A/B/C) 과 Tier(Whisper/Tremor/Quake) 를 표 1개에 고정.
2. dispatch 그래프의 **형상** 만 합의. Story 본문 0개.
3. 가드레일 G1~G6 위반 없음. 신규 opcode 없음.

## 8. 다음 PR 후보

- [x] `03-natural-spawners.md` — 본 그래프의 노드별 상세 spec (분포·dispatch·영속 hook).
- `04-region-state.md` — 03 이 도입한 region 카운터의 store/read 시스템.
- `05-interactions.md` — 플레이어 행위(베기/태우기/낚시/투척) 가 어느 `Event.Natural.*` 를 발화하는가.
- `07-story-bodies/` — 잎 노드를 schema 2 JSON 으로 실제 작성 (1 PR 1 spawner).
