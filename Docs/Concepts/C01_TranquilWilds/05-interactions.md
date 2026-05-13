# C01-05 — 플레이어 상호작용 → 자연 이벤트 매핑

> **목적**: 03 의 11 spawner story 가 의존하는 `Event.Natural.*` / `Event.Region.*` 가 *어느 플레이어 행위* 에서 발화되는지 매핑한다. 본 문서로 *player input → spawner story* 인과 그래프가 완결된다.
> **상태**: Skeletal — 판정 임계치 곡선·도구 요구·UI 입력 매핑은 후속.
> **상위**: [`README.md`](./README.md) · **선행**: [`03-natural-spawners.md`](./03-natural-spawners.md) · [`04-region-state.md`](./04-region-state.md)
> **기록일**: 2026-05-13

---

## 0. 범위 / 비범위

### 범위
- 자연 entity (`Entity.Natural.*`) 에 대한 **플레이어 측 행위** 의 이벤트 매핑.
- *Action tag → 판정 조건 → Event tag → 수신 spawner* 의 1:N 그래프.
- 판정 책임이 어느 모듈에 있는가의 분리선.

### 비범위
- 키바인딩 / 입력 디바이스 / 제스처 → action tag 변환 (`HktUI` 책임).
- 적대 NPC·보스·야생 동물 전투 행위 (본 컨셉 밖, Step 4 별도 시즌).
- 도구 (`Entity.Tool.*`) 자체의 정의 — 본 PR 은 *도구 요구 조건* 만 표기, 사양은 후속 `06-tools.md`.
- UI 표기 (행위 가능 hint·결과 토스트) — `HktUI` / `HktPresentation`.

---

## 1. 가드레일 (재인용)

| # | 항목 | 근거 |
|---|---|---|
| **I1** | 이벤트는 모두 `FHktEvent` **단일 진입 경로** + `PendingGroupIntents` 큐. 별도 RPC / Delegate / 콜백 도입 금지. | TerrainSpawner.design.md §4-a |
| **I2** | 모든 행위 판정은 **서버 권위**. 클라는 인텐트(`FHktIntent` 또는 입력 메시지)만 보내고, 서버 룰이 *통과 여부 + 발화* 를 결정한다. | 절대 원칙 3 / G5 |
| **I3** | 판정은 **결정론**. 거리/각도/임계치는 `FHktFixed32` 또는 정수. 균일 random 0. | G3 / G5 |
| **I4** | `Event.Natural.*` 의 `Param0~3` 의미는 **수신 spawner story 본문** 이 `LoadStore(PropertyId::Param0..3)` 로 자체 정의한다 — 본 문서는 *컨벤션* 만 표기. | G4 / TerrainSpawner.design.md §4-d |
| **I5** | 동일 행위가 *복수* 이벤트를 발화하는 경우, 같은 dispatch tick 의 동일 `PendingGroupIntents` 큐 슬롯에 enqueue 되며 enumeration 순서는 결정론적. | TerrainSpawner.design.md §4-a / 04-region-state §4 T6 |
| **I6** | 행위가 region counter 를 갱신하면 04 ADR §3 의 *RegionWrite helper* 경로로만 — 서버 VM 본문이 갱신, 별도 store 0. | [`04-region-state.md`](./04-region-state.md) §1 / §3 D1 |

---

## 2. 책임 분리 (한 화면)

```
[Client]                            [Server — HktRule]                  [Server — HktStoryVM]
키/제스처 입력                       OnAction_<Verb>                    OnEvent_<EventTag>
   ↓ (HktUI)                            ↓ (판정)                            ↓ (story bytecode)
Action.Natural.<Verb>          ┌── PASS → FHktEvent 발화 ──┐         spawner story 본문
   ↓ (FHktIntent 전송)         │                            ↓         (LoadStore Param0~3
서버 도달                       │                  PendingGroupIntents  / RegionWrite / dispatch)
                                └── FAIL → silent / hint event ─→ Presentation hint (선택)
```

- **클라 측 "가능 여부 추측"** 은 visual hint 일 뿐 권위 0. 서버 판정과 불일치하면 서버가 이긴다 (롤백 시 hint 자동 정정).
- **판정 통과 직전 단계**까지가 `HktRule` (서버) 책임. `FHktEvent` 발화 이후는 `HktStoryVM` + spawner story 본문 책임. 두 단계의 경계는 *event tag*.

---

## 3. Action ↔ Event 마스터 테이블

행위는 *동사* 로 분류. 동일 동사가 entity 종류에 따라 다른 event 로 분기.

> **컬럼 의미**: *Verb* — 플레이어 액션. *Target* — 01 의 entity 카탈로그. *Conditions* — 서버 판정. *Event* — 발화되는 `Event.Natural.*` 또는 `(없음)`. *Param0~3* — 이벤트가 운반하는 의미 (수신 spawner 가 자체 해석).

### 3-1. 채취 / 채집 / 채광 계열 (도파민·즉시 보상)

| Verb | Target | Conditions | Event | Param0..3 의미 |
|---|---|---|---|---|
| **Fell** (베기) | F03 Birch | <2m · frontal arc · axe equipped · trunk HP 도달 | `Event.Natural.TreeFelled` | P0=Tag id · P1=Pos hash · P2=0 (no lineage) · P3=hits |
| Fell | F04 Oak (Elder/일반) | 위 + Oak 한정 도구 (대형 도끼) · Elder 면 P2=LineageId | `Event.Natural.TreeFelled` | P0=Tag id · P1=Pos hash · P2=LineageId · P3=hits |
| Fell | F05 Pine | 위 + Pine 한정 | `Event.Natural.TreeFelled` | P0=Tag id · P1=Pos hash · P2=line_id (S05 slope) · P3=hits |
| **Harvest** (채집) | F06 BerryBush | <1m · cluster 의 `ripening phase >= 임계` · 빈손 OK | `Event.Natural.BerryHarvested` | P0=cluster idx · P1=patch anchor hash · P2=ripening phase · P3=잔여 cluster 수 |
| Harvest | F07 Herb | <1m · 빈손 OK · region variant 적용 | `Event.Natural.HerbCollected` | P0=Variant id · P1=Pos hash · P2=region variant flag · P3=0 |
| **Pluck** (떠내기) | F09 Reed / F10 WaterLily | water-adjacent · <1m · 빈손 OK | `Event.Natural.AquaticPlucked` | P0=Tag id · P1=Pos hash · P2=0 · P3=0 |
| **Mine** (채광) | G01 Boulder | <2m · pickaxe equipped · 누적 HP 도달 | `Event.Natural.BoulderBroken` | P0=Pos hash · P1=Pebble drop count · P2=0 · P3=hits |
| Mine | G02 OreOutcrop | <2m · pickaxe · OreSpeciesId 별 도구 tier | `Event.Natural.OreMined` | P0=OreSpeciesId · P1=Pos hash · P2=outcrop_id · P3=remaining_units |

### 3-2. 변환 / 위험 행위 (미지·연쇄)

| Verb | Target | Conditions | Event | Param0..3 의미 |
|---|---|---|---|---|
| **Eat** (먹기) | F08 Mushroom (inventory) | inventory 보유 · 식용 액션 입력 | `Event.Natural.MushroomEaten` | P0=Variant id · P1=Potency · P2=region cataloged flag · P3=0 |
| **Ignite** (점화) | F05 Pine slope (단일 셀 → 줄 전파) | flint+steel 또는 횃불 · 인접 dry biome · `Region.FireSusceptible` 통과 | `Event.Natural.FireIgnited` | P0=line_id · P1=Pos hash · P2=ResinDensity · P3=0 |
| Ignite | F01 Grass cell (단일) | 위 + 풀 셀 | `Event.Natural.FireIgnited` | P0=0 (no line) · P1=Pos hash · P2=0 · P3=0 |
| **Drink** (음용) | W03 Spring | <1m · 컨테이너 또는 직접 음용 | `Event.Natural.SpringDrank` | P0=WaterQuality · P1=Pos hash · P2=NPCSeedHash · P3=0 |

### 3-3. 이동 / 위치 기반 (암묵 발화)

> 명시 액션 없이 *플레이어 위치 자체* 가 트리거.

| Verb | Target / Trigger | Conditions | Event | Param0..3 |
|---|---|---|---|---|
| **Cross** | W01 Ford cell | 한 발이 Ford 셀에 닿음 + 다른 발이 반대편 | `Event.Natural.FordCrossed` | P0=Pos hash · P1=region crossing index · P2=0 · P3=0 |
| **Reach (trail)** | T02 AnimalTrail endpoint | `EndpointHash` 셀 반경 2m | `Event.Natural.TrailEndpointReached` | P0=trail_id · P1=endpoint hash · P2=0 · P3=0 |
| **Reach (peak)** | M01 Peak | Peak entity 반경 2m + 고도 >= peak 고도 - 1m | `Event.Natural.PeakReached` | P0=peak_id · P1=region id · P2=0 · P3=0 |
| **Observe (grain)** | S01 GrassPlain 결의 끝 | 결 끝 셀 인근에서 Herb / BerryPatch 발견 (= 다른 이벤트가 통과 후) | `Event.Natural.GrainObserved` | P0=ChunkSeed · P1=WindAngleRaw · P2=0 · P3=0 |

> **In1 결정 (시즌 0)**: "Observe" 는 별도 perception 게이지 없이 *Herb/Berry 발견 이벤트의 부수 효과* 로 자동 발화 (§7 In1).

### 3-4. 발화 없음 (시즌 0 비범위)

| Verb | 메모 |
|---|---|
| Throw / Drop (투척) | G03 Pebble 등은 상호작용 가능하지만 spawner 분기 없음. 시즌 0 비범위. |
| Climb (오르기) | cliff 등반은 시즌 0 에 별도 이벤트 없음. 다음 시즌. |
| Hunt (T02 흔적 추적) | 자동 — endpoint 도달이 곧 Reach (trail). 별도 hunt 액션 0. |
| Sit / Rest / Emote | 환경에 영향 0 — 행위 자체 비범위. |

---

## 4. 그래프 — Player Input 면 + Spawner 면 합본

03 §4 의 dispatch 그래프 위에 *플레이어 입력* 을 얹은 완결 그래프.

```
[Player Action / Position Event]   [Event.Natural.* 발화]            [수신 Spawner Story]

Fell  Elder Oak     ──────────▶  TreeFelled (P2=LineageId)  ─────▶  S02 (LineageId 분기 + FelledElders++)
                                                                       ↳ S09 FallenLogDecay (stage=0)
Fell  일반 Oak / Pine            TreeFelled (P2=line_id/0)  ─────▶  S09
                                                                       ↳ S04 MushroomSeed (단계 1)

Harvest BerryBush ─────────────▶ BerryHarvested            ────────▶ S03 (cluster 카운터, 모두 채집 시 재시드)

Harvest Herb      ─────────────▶ HerbCollected             ────────▶ (entity 소비, region variant 카탈로그 read-only)

Eat Mushroom      ─────────────▶ MushroomEaten             ────────▶ S04 (Region.VariantCatalog[VariantId] 갱신)
                                                                       ↳ 미발견 시: Event.Region.VariantCataloged

Ignite Pine slope ─────────────▶ FireIgnited (P0=line_id)  ────────▶ S05 → FireSpreadLine
                                                                       ↳ 종료: S09 × N → S11 GrassSuccession
                                                                       ↳ Region.FireCounter += area

Ignite Grass      ─────────────▶ FireIgnited (P0=0)        ────────▶ S11 GrassSuccession (작은 패치)

Mine OreOutcrop   ─────────────▶ OreMined                  ────────▶ S08 (Region.OreDepleted[OreId] +1)
                                                                       ↳ 임계: Event.Region.OreVeinDepleted
Mine Boulder      ─────────────▶ BoulderBroken             ────────▶ (Pebble drop only, dispatch 없음)

Cross Ford        ─────────────▶ FordCrossed               ────────▶ S06 (Region.CrossingPoints + crossing index)

Drink Spring      ─────────────▶ SpringDrank               ────────▶ (entity attribute = buff, dispatch 없음)

Reach trail end   ─────────────▶ TrailEndpointReached      ────────▶ S07 (HardenedTrails 등록) → S10 SpringDiscovered

Reach Peak        ─────────────▶ PeakReached               ────────▶ S08 → PeakClaimed (NamedPeaks 등록 — 명명권)

Observe grain     ─────────────▶ GrainObserved             ────────▶ S01 (Region.SeenTheGrain +1)
```

> 가지 끝 (S03 재시드 / S09 단계 진행 / S04 카탈로그 / S10 / S11) 은 entity 생성·attribute 갱신·region counter 갱신에서 멈춘다. 그 외는 분기/조건/연쇄.

---

## 5. 판정 책임 — 어디서 무엇을 검사하나

각 행위가 통과 직전까지 거치는 검사를 *어느 모듈* 이 책임지는지.

| 검사 항목 | 모듈 | 메모 |
|---|---|---|
| 입력 → action tag 변환 | `HktUI` | 키바인딩, 콤보, 컨텍스트 메뉴. 본 PR 비범위. |
| 인텐트 직렬화 | `HktRule` (클라) | `FHktIntent { ActionTag, TargetEntityHint, Pos }` 단일 구조. 클라 hint 는 권위 0. |
| 거리 / 각도 / line-of-sight | `HktRule` (서버) `OnAction_<Verb>` | `FHktFixed32` 정수 비교. 노이즈 0. |
| 도구 요구 | `HktRule` (서버) | 인벤토리 column read — 무장 슬롯 / inventory tag 매칭. |
| Entity attribute (ripe / mature / felled stage) | `HktRule` (서버) | LoadStore 로 column 직접 read. cold tier OK. |
| Biome / region 조건 (예: `Region.FireSusceptible`) | `HktRule` (서버) | 04 ADR §3 의 RegionRead helper. |
| 통과 후 이벤트 발화 | `HktRule` (서버) | `HktEventBuilder::Action(EventTag, Param0~3, Location)` 1 회. PendingGroupIntents 큐 enqueue. |
| 이후 spawner 본문 실행 | `HktStoryVM` | 03 / 07 책임. 본 PR 입력 면 종료. |

> **회색 영역**: "<2m" 같은 거리 임계의 *값* 결정은 본 PR 범위 — 디폴트 표 형태로만 §6.

---

## 6. 디폴트 임계치 (조정 가능)

| 항목 | 디폴트 | CVar / 소재 |
|---|---|---|
| Fell / Mine 거리 | 200 cm | `hkt.Interaction.MeleeReach` (시즌 0 통일) |
| Harvest / Pluck / Drink 거리 | 100 cm | `hkt.Interaction.GatherReach` |
| Reach (trail / peak) 반경 | 200 cm | `hkt.Interaction.ReachRadius` |
| Frontal arc (베기/채광) | ±90° (±64/256 turn) | `hkt.Interaction.FrontalArc` |
| Ignite dry condition | `Region.FireCounter == 0` 또는 `WeatherDry` 태그 — 시즌 0 은 후자 0 처리 | — |
| Cross Ford 발판 검사 | 한 발이 Ford 셀 + 한 발이 반대편 cell | 결정론 정수 검사 |

> 시즌 0 의 본 PR 은 **디폴트 표 + CVar 노출** 만 합의. 곡선/스케일 조정은 후속.

---

## 7. 오픈 이슈

| # | 이슈 | 옵션 | 우선순위 |
|---|---|---|---|
| **In1** | "Observe (인지)" 의 트리거 메커니즘 | (a) Herb/Berry 발견의 부수 이벤트 / (b) 별도 perception 게이지 | Resolved: (a) — 시즌 0 |
| **In2** | "Cross (횡단)" 이 별도 action 인가 자동 위치 이벤트인가 | (a) 자동 — feet on Ford / (b) 명시 액션 | Resolved: (a) |
| **In3** | "Reach" 류 (Peak / trail endpoint) 의 위치 판정 임계 | radius=200 cm 기본 + entity attribute override | Resolved: §6 |
| **In4** | `Event.Natural.TreeFelled` 의 Param 슬롯 부족 (lineage + pos + hits + tag 4 개) | tag id 는 entity column 에서 read — 이벤트는 lineage/pos/hits 3 개 | Resolved: P0~P3 로 충분 (§3-1) |
| **In5** | 도구 요구 (axe/pickaxe/flint+steel) 의 entity 정의 | 본 PR 비범위 — `Entity.Tool.*` 후속 `06-tools.md` | Mid |
| **In6** | "Climb / Throw" 가 시즌 0 에는 이벤트 발화 없음 — 컨텐츠 누락? | 의도적 — 컨텐츠 누적 후 추가 | Resolved: 시즌 0 비범위 |
| **In7** | 행위 *실패* (도구 미보유 / 거리 부족 등) 시 클라 hint 가 필요한가 | (a) silent / (b) `Event.Natural.<Verb>Denied` lite event — Presentation 만 | Mid — 시즌 0 은 (a) |
| **In8** | 동일 tick 에 2 명 이상의 플레이어가 같은 entity 에 행위 (Fell 동시 입력) | 결정론 enumeration 순서로 직렬화 — 첫 번째 통과 후 나머지는 entity stale 판정 | Resolved: 04 §4 T6 (PendingGroupIntents enumeration 순서) |
| **In9** | 통과 후 이벤트 발화 → spawner 본문 실행이 *같은 tick* 인가 *다음 tick* 인가 | 같은 tick 의 dispatch loop (TerrainSpawner.design.md §7) — 본 PR 무결. | Resolved |
| **In10** | Region 카운터를 *읽는* 행위 판정 (예: Ignite 시 `Region.FireSusceptible` 확인) 의 성능 | 04 §3-D6 의 RegionMapRead helper 1 회 lookup — 캐시미스 1 회 | Resolved: 04 ADR 보장 |

---

## 8. `Event.Natural.*` / `Action.Natural.*` 네임스페이스 약속

| Tag 접두 | 의미 | 예 |
|---|---|---|
| `Action.Natural.<Verb>` | 플레이어 인텐트 (서버 판정 입력) | `Action.Natural.Fell` |
| `Event.Natural.<Verbed>` | 서버 판정 통과 시 발화 (수신 spawner 가 dispatch) | `Event.Natural.TreeFelled` |
| `Event.Region.<Noun>` | spawner story 내부에서 region counter 임계 도달 시 발화. 플레이어가 직접 트리거하지 않음. | `Event.Region.VariantCataloged` |

> §5 ADR (TerrainSpawner.design.md) 의 archetype 분류 부활 우려는 본 컨벤션에도 적용 — Verb 분류는 *입력 라벨* 일 뿐 spawner archetype 강제 아님.

---

## 9. 결정 요약 (1 화면)

```
Player Action → Event.Natural.*
  ├─ 입력 변환    : HktUI (action tag)
  ├─ 인텐트 전송  : HktRule (클라 → 서버)
  ├─ 서버 판정    : HktRule (거리/각도/도구/attribute/region) — 결정론
  ├─ 이벤트 발화  : HktEventBuilder::Action (PendingGroupIntents enqueue)
  └─ 수신 실행    : HktStoryVM (03 의 11 spawner — bytecode)

본 PR 의 합의:
  ├─ 행위 카탈로그 14 종 (Fell/Harvest/Pluck/Mine × entity 종류 + 위치 이벤트)
  ├─ 이벤트 카탈로그 11 종 (Event.Natural.*)
  ├─ 판정 책임 분리 (입력=HktUI / 판정=HktRule / 실행=HktStoryVM)
  └─ 디폴트 임계치 (§6) + CVar 노출
```

다음 후속 PR (`07-story-bodies/`) 은 본 PR 의 Event.Natural.* 를 *수신* 하는 spawner story 본문을 schema 2 JSON 으로 작성한다. 본 매핑이 *발화 면* 의 단일 출처.

---

## 10. 다음 PR 후보

- `06-tools.md` — `Entity.Tool.*` 정의 (axe/pickaxe/flint+steel/torch). 본 PR §3 의 *도구 요구* 컬럼이 입력.
- `07-story-bodies/` — 03 의 11 spawner 본문 schema 2 JSON. 본 PR 의 Event.Natural.* 가 dispatch 면의 단일 출처.
- (선택) `08-failure-hints.md` — 행위 실패 시 클라 hint 정책 (§7 In7).
