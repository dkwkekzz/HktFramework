# 아이템 상호작용 (Drop / Pickup) — 설계

본 문서는 [I-0035 — 아이템 상호작용 (Drop / Pickup)](intents/I-0035.md) 의 상세 근거 및 구현 설계.

상위 의도 / 관련 문서:
- [I-0014 — 모험과 성장을 위한 상호작용](intents/I-0014.md)
- [I-0034 — 엔티티 수명주기](intents/I-0034.md) — 사망 분기의 단일 진실원
- [I-0033 — 엔티티 충돌·선택의 시뮬레이션 일치](intents/I-0033.md) — 픽업 볼륨 정합
- [I-0016 — Brain System](intents/I-0016.md) — NPC 의 픽업 의도 채널
- [Design-Entity-Item-System.md](Design-Entity-Item-System.md) — 아이템 상태 머신 / 소유 규칙의 정의 진실원
- [HktGameplay/Content/Stories/SCHEMA.md](../HktGameplay/Content/Stories/SCHEMA.md)

---

## 1. 책임 분담 — 누가 어디서 한다

```
[ 죽는 엔티티의 Lifecycle Story ]
   │
   │  WaitTag(Self, StateDead) → 깨어남 → "사망 처리" 분기
   │
   │  ┌─── 사망 분기 안에서 ───┐
   │  │ HktSnippetItem::SpawnGroundItemAtPos(<ItemTag>, <Template>, SelfPos)  │  ← 본 의도의 핵심 1줄
   │  │   또는 ::DropToGround(<ExistingItem>, <PosSource>)                    │
   │  └────────────────────────┘
   │  Anim.FullBody.Action.Death → WaitSeconds → DestroyEntity → Halt
   │
   ▼
[ Ground 상태의 아이템 엔티티 ]  ItemState=0, OwnerEntity=0, OwnerUid=0
   │
   │  (서버는 더 이상 능동적으로 무엇도 하지 않는다 — 픽업 시점을 기다린다)
   │
   ▼
[ 살아있는 엔티티 클라이언트 (Player) / Brain (NPC) ]
   │
   │  근접 인식 → Story.Event.Item.Pickup 디스패치 (Self=picker, Target=item)
   │
   ▼
[ Story_ItemPickup ]
   precondition: ItemState==0, Dist ≤ PickupRange, 빈 EquipSlot 존재
   steps:        SnippetAssignOwnership → SnippetActivateInSlot
```

| 구간 | 누가 한다 | 비고 |
|---|---|---|
| 사망 감지 | lifecycle Story (`WaitTag StateDead`) | 단일 채널 ([I-0034](intents/I-0034.md)) |
| 아이템 생성 / 드랍 | lifecycle 안의 snippet 1 줄 | C++ 후크 / 별도 시스템 금지 |
| Ground 유지 | WorldState 의 ItemState=0 + cleanup 시스템 | 별도 polling 없음 |
| 픽업 트리거 | 클라이언트 (Player) / NPC Brain | 서버는 폴링하지 않는다 |
| 픽업 판정 | `Story_ItemPickup` precondition + steps | 권위 1 회 |

---

## 2. 왜 드랍은 Lifecycle 안의 한 줄이어야 하는가

### 2.1 사망 인과의 단일 출처

사망 → 드랍 → cleanup 의 한 줄기는 **lifecycle Story 안에서 위에서 아래로 읽힌다**. 같은 인과를 다음과 같이 분리하면 손실이 silent 로 새어 나간다:

| 분리 방식 | 손실 시나리오 |
|---|---|
| lifecycle 은 `State.Dead` 만 부여, drop 은 별도 `OnDeath` 이벤트 채널 | drop 이벤트가 백프레셔(`SpawnerBackpressureSoftCap`) 로 *조용히* discarded → 시체는 남지만 아이템이 사라진다 |
| C++ 사망 후크 (`HktCombatSystem::OnEntityDied`) 에서 SpawnEntity | HktCore 순수성 위반 (스폰은 VM 전용). 또한 결정론 입력에서 빠짐 — 재현 불가 |
| Cleanup System 이 RemoveEntity 직전에 drop | cleanup 은 *데이터 무지* (어느 entity 가 무엇을 떨어뜨리는지 모름). loot 정의를 cleanup 코드에 매번 추가해야 함 |

lifecycle Story 안에서는 *깨어나는 그 자리* 에 drop 호출이 박혀 있으므로, 새로운 entity 타입을 추가할 때도 "lifecycle 한 곳만 보면 된다" 가 유지된다.

### 2.2 lifecycle 의 부담은 0 에 가깝다

drop 은 `WaitTag(StateDead)` 가 깨어난 *직후* 의 일회성 분기다. 매 프레임 폴링되지 않으므로 ([I-0034](intents/I-0034.md) §2 참조), drop 한 줄이 lifecycle 의 *대기* 본질을 깨뜨리지 않는다.

---

## 3. 왜 snippet 으로 모듈화하는가

### 3.1 동일 패턴의 반복

현재 `Story_NPCLifecycle.json` 의 사망 분기에는 4 종 아이템 drop 이 *완전 인라인* 으로 작성되어 있다 — 같은 11~12 줄짜리 블록 (SpawnEntity → ItemState=0 → ItemId → EquipIndex=-1 → CopyPosition → 스탯 → SkillTag → Stance → Attr Tag) 이 4 번 반복.

```
drop_staff:   SpawnEntity Entity.Item.AncientStaff …
drop_bandage: SpawnEntity Entity.Item.Bandage …
drop_hammer:  SpawnEntity Entity.Item.ThunderHammer …
drop_wings:   SpawnEntity Entity.Item.WingsOfFreedom …
```

NPC / Voxel Unit / Building 등 lifecycle 이 추가될수록 같은 패턴이 곱해진다. 손으로 복제된 코드가 늘면:

- **silent 변형**: 한 곳에서 `ItemState=0` 을 빠뜨려도 lifecycle 별로 다르게 동작
- **속성 표준 깨짐**: 새 필수 속성 (예: `Durability`) 추가 시 *모든* lifecycle 의 모든 drop 분기를 수정해야 함
- **읽기 어려움**: lifecycle 의 본업(brain / 대기) 코드가 drop boilerplate 에 묻힘

### 3.2 snippet 의 범위

snippet 은 "ground 아이템 1 개를 위치 P 에 생성" 의 단위. 어떤 *종류* 의 아이템을 만들지는 호출자가 정한다 — 그 결정은 lifecycle 마다 다르고 random table 일 수 있다. 표준화 대상은 *기계적인 속성 설정 시퀀스* 뿐.

| snippet | 책임 |
|---|---|
| `SpawnGroundItem(ItemTag, Template, PosSource)` | 새 entity 생성 + Ground 상태 + 위치 복사 |
| `SpawnGroundItemAtPos(ItemTag, Template, PosBlock)` | Self 없는 Flow Story 용 — 위치는 레지스터 블록 |
| `DropToGround(ExistingItem, PosSource)` | 이미 존재하는 (장착 중인) 아이템을 ground 로 전이 |
| `AssignOwnership(Item, NewOwner)` / `ReleaseOwnership(Item)` | OwnerEntity + OwnerUid 동시 갱신 |
| `ActivateInSlot(Item, SlotIndex, Char)` / `DeactivateToInventory(Item, Char)` | 슬롯 등록 + 스탯 적용/차감 |

본 의도가 손대는 것은 **drop 측 snippet 호출 통일**. pickup 측 snippet 은 이미 `Story_ItemPickup.json` 안에서 일관 사용 중이다.

---

## 4. 왜 픽업은 클라이언트 액션인가

### 4.1 전수 폴링의 비용

서버가 매 틱 모든 living entity × 모든 ground item 의 proximity 를 계산하면 비용은 `O(N_living × N_ground)`. 월드 규모가 커질수록 폴링 비용이 *상호작용이 일어나지 않는 시점에도* 깔린다. 게다가 서버는 *누가 픽업을 원하는지* 알 길이 없으므로, 픽업 의도가 없는 entity 까지 후보로 흘려보내야 한다.

### 4.2 의도 기반 트리거

픽업은 **사용자(또는 NPC Brain) 가 명시적으로 시도** 했을 때만 서버 판정이 일어난다.

| 트리거 | 출처 | 채널 |
|---|---|---|
| 마우스 클릭 (Ground 아이템) | `AHktIngamePlayerController::OnTargetAction` — `ItemState==0` 감지 → `Story.Event.Item.Pickup` 디스패치 | 기존 구현 |
| 자동 근접 픽업 (반경 N 안에서 자동) | 클라 proximity 감지 → 일정 시간 안 멈춰 있으면 자동 dispatch | [TODO] |
| 단축키 (`E`) | 가장 가까운 ground item 한 개에 디스패치 | [TODO] |
| NPC Brain | `ActionIntent*` 에 *Pickup 타입* 추가 → lifecycle 안에서 평가 → 디스패치 | [TODO] — [I-0016](intents/I-0016.md) 와 함께 설계 |

### 4.3 서버 권위 — Story_ItemPickup

클라이언트가 보낸 디스패치는 *희망사항* 일 뿐. 실제 판정은 서버 측 Story 의 precondition 이 결정한다:

```jsonc
"preconditions": [
  /* ① 상태: 이미 누군가가 가져가지 않았는가 */
  ItemState == 0,
  /* ② 거리: 클라가 거짓 보고했는가 */
  GetDistance(Self, Target) ≤ PickupRange,
  /* ③ 용량: 픽업자가 빈 슬롯이 있는가 */
  EquipSlot0..8 중 하나가 0
]
```

클라가 거리·상태·슬롯을 조작해도 서버 precondition 이 `Fail` 로 끊는다. precondition 자체는 read-only 이므로 부작용이 없다 — `Fail` 시 *아무 일도 일어나지 않는 것* 이 본 의도.

### 4.4 픽업 볼륨의 정합 ([I-0033](intents/I-0033.md))

클라이언트가 그리는 픽업 인식 볼륨은 시뮬레이션 캡슐과 *같은 발 기준·같은 크기* 여야 한다. 어긋나면 *눈에 보이는 픽업 가능 범위* 와 *서버 판정 범위* 가 분리되어, 사용자가 "분명 닿았는데 픽업 안 됨" / "안 닿았는데 픽업됨" 을 겪는다. 정합은 [I-0033](intents/I-0033.md) 의 `IHktSelectable` + sim 캡슐 파생 규칙 위에 선다.

---

## 5. 구현 설계

### 5.1 Drop snippet 의 확장 — `SnippetRandomLootDrop`

현 NPC lifecycle 의 4-way 인라인 분기를 한 snippet 호출로 대체한다.

```cpp
namespace HktSnippetItem
{
    /**
     * 가중치 기반 random loot drop.
     * 호출자는 lifecycle 의 사망 분기 안에서 한 줄로 호출한다.
     * 내부적으로 RandomInt + 분기 + SpawnGroundItem 시퀀스를 생성.
     *
     * @param Entries  drop 후보 — {ItemTag, ItemId, Weight, Template}
     * @param PosSourceEntity  ground 위치를 복사할 entity (보통 Self)
     */
    struct FHktLootEntry
    {
        FGameplayTag ItemTag;
        int32 ItemId = 0;
        int32 Weight = 1;
        FHktGroundItemTemplate Template;
    };

    HKTSTORY_API FHktStoryBuilder& RandomLootDrop(
        FHktStoryBuilder& B,
        const TArray<FHktLootEntry>& Entries,
        RegisterIndex PosSourceEntity);
}
```

**왜 가중치인가**: 현 NPC 의 `modulus=4 + RandomInt` 는 균등 분포에 묶여 있다. 가중치를 받으면 "희귀 아이템은 1/100" 같은 일반 패턴이 같은 snippet 안에서 표현된다.

**JSON Story 측 노출**: 신규 op 가 아니라 *빌더 패턴* 으로만 노출한다. JSON 에서는 기존 `SnippetSpawnGroundItem` 의 가중치 확장 형태(`SnippetRandomLootDrop`) 를 op 로 받게 추가하거나, lifecycle 의 random drop 부분만 C++ 측에서 빌드해 storyTag 로 dispatch 한다. **선택**: JSON 일관성을 위해 `SnippetRandomLootDrop` op 를 schema 2 에 추가 (구현 비용 < lifecycle JSON 4 개 × 모든 신규 NPC 마다의 복제 비용).

[TODO] op 추가 vs 빌더 전용 결정 — 다음 단계에서 schema 영향 점검 후 확정.

### 5.2 lifecycle Story 의 drop 분기 통일

기존 `Story_NPCLifecycle.json` 의 `die` 라벨 이후 ~70 줄을 다음으로 축소:

```jsonc
{ "op": "Label", "name": "die" },
{ "op": "SnippetRandomLootDrop", "table": "NPC.Default", "posSource": "Self" },
{ "op": "AddTag", "entity": "Self", "tag": "Anim.FullBody.Action.Death" },
{ "op": "WaitSeconds", "seconds": 3.0 },
{ "op": "DestroyEntity", "entity": "Self" },
{ "op": "Halt" }
```

`table` 키는 DataAsset `UHktLootTableDataAsset` 의 GameplayTag 식별자. 이로써:

- lifecycle JSON 은 *어느 테이블을 굴리는가* 만 결정
- 새 아이템 / 가중치 변경은 DataAsset 한 곳에서 수정
- 동일 테이블을 NPC 외에 Voxel Unit / Building lifecycle 에서 재사용 가능

[TODO] DataAsset 로딩 경로 — [HktAsset](../HktGameplay/Source/HktAsset) 의 GameplayTag → DataAsset 비동기 로딩 결정론 검토 필요.

### 5.3 Pickup 거리의 CVar 노출

현 `Story_ItemPickup.json` 의 거리 임계는 하드코딩 `300`. 디자이너 튜닝을 위해 CVar 로 분리:

```cpp
// HktSimulationLimits.h (결정론 입력이므로 서버·클라 동기 필수)
static constexpr int32 DefaultPickupRangeCm = 300;
```

**CVar 가 아닌 헤더 상수로 두는 이유**: 픽업 거리는 결정론 입력 (precondition 의 비교값). CVar 로 노출하면 서버·클라 가 다른 값을 보면 즉시 desync. 따라서 **헤더 상수만**. 디자이너 튜닝은 별도 entity Property (`PickupRangeOverride` Cold) 로 처리해 entity 별로 다른 범위(예: 자석 아이템) 를 표현.

[TODO] entity 별 픽업 범위 override 가 정말 필요한가 — 우선 헤더 상수만 두고 필요해질 때 도입.

### 5.4 클라이언트 픽업 트리거 정책

3 가지 트리거 채널을 한 곳에서 결정:

| 채널 | 조건 | 우선순위 |
|---|---|---|
| 명시 클릭 | `OnTargetAction` 에서 cursor target == ground item | 1 (가장 명확) |
| 단축키 (E) | 자기 캡슐 반경 `PickupHintRange` (= `DefaultPickupRangeCm`) 안 가장 가까운 ground item 1 개 | 2 |
| 자동 근접 | 같은 반경 안에서 N 프레임 정지 시 자동 dispatch | 3 — 기본 비활성, CVar 토글 |

자동 픽업은 *기본 비활성*. 켠 채로 두면 사용자 의도와 무관한 슬롯 점유가 일어나 인벤토리 관리가 손쉽게 망가진다. 토글 CVar 는 `hkt.Client.AutoPickup`.

UI 측: ground 아이템이 `PickupHintRange` 안에 들어오면 *주위 아이콘 / 단축키 힌트* 가 떠야 한다 — 사용자가 "픽업 가능 상태" 를 인지하지 못하면 명시 트리거가 의미를 잃는다.

[TODO] UI 힌트 — [HktUI](../HktGameplay/Source/HktUI) 의 Widget.PickupHint 신규.

### 5.5 NPC Brain 의 픽업 의도

NPC 가 ground 아이템을 줍게 하려면 `ActionIntent*` 채널 ([I-0016](intents/I-0016.md)) 에 *Pickup 타입* 이 필요:

```
ActionIntentType:
  0 = None
  1 = Move (기존)
  2 = Attack (기존)
  3 = Pickup  ← NEW — ActionIntentTarget = ground item entity
```

NPC lifecycle 안에서:

```
do_pickup:
  Self → ActionIntentTarget 의 거리 ≤ PickupRange 이면 DispatchEventTo(ItemPickup, Target) + clear_intent
  아니면 MoveToward(Target.Pos)
```

이로써 같은 `Story_ItemPickup` 한 곳에서 Player / NPC 모두 처리. AI 디자인이 어떤 NPC 가 무엇을 픽업할지 결정하는 채널은 별도 brain 정책 layer.

[TODO] [I-0016](intents/I-0016.md) 의 `ActionIntentType` enum 확장 + Player lifecycle 의 동작 비교 — 픽업이 player intent 도 채울 수 있는가, 아니면 player 는 직접 dispatch 채널이 본업인가.

### 5.6 단계별 작업 (Phase Plan)

| 단계 | 범위 | 산출 |
|---|---|---|
| **P1** | snippet API + JSON op 추가 | `HktSnippetItem::RandomLootDrop` + `SnippetRandomLootDrop` op + parser + validator |
| **P2** | `UHktLootTableDataAsset` 정의 + `NPC.Default` 1 개 작성 | DataAsset + HktAsset 로딩 경로 |
| **P3** | `Story_NPCLifecycle.json` 의 drop 분기를 snippet 호출로 교체 | spec.json 동기화, 결정론 회귀 테스트 |
| **P4** | `Birch_Lifecycle` / `Oak_Lifecycle` 등 ground item drop 이 필요한 lifecycle 에 snippet 적용 | (현재 Branch entity 만 spawn — Item drop 으로 통합할지는 별도 검토) |
| **P5** | 클라 픽업 힌트 UI + 단축키 트리거 | Widget.PickupHint + Input action |
| **P6** | NPC Brain 픽업 의도 — `ActionIntentType.Pickup` | [I-0016](intents/I-0016.md) 확장 |
| **P7** | 검증 / 결정론 테스트 / 통합 | EventLog dump 비교, 서버·클라 desync 회귀 |

P1~P3 가 본 의도의 *핵심 단언* 을 만족시키는 최소 범위. P4 이후는 확장.

---

## 6. 변경 예정 파일

| 파일 | 변경 |
|---|---|
| `HktGameplay/Source/HktStory/Public/Snippets/HktSnippetItem.h` | `FHktLootEntry` / `RandomLootDrop` 선언 |
| `HktGameplay/Source/HktStory/Private/Snippets/HktSnippetItem.cpp` | `RandomLootDrop` 구현 — `FHktLootEntry::Weight` 합산 → `RandomInt` → 분기 → `SpawnGroundItem` |
| `HktGameplay/Source/HktCore/Public/HktStoryTypes.h` | OpCode `SnippetRandomLootDrop` |
| `HktGameplay/Source/HktCore/Private/HktStoryJsonParser.cpp` | `"SnippetRandomLootDrop"` 등록 — `table` (GameplayTag) + `posSource` (entity ref) 파싱 |
| `HktGameplay/Source/HktCore/Private/HktStoryValidator.cpp` | 신규 op 케이스 |
| `HktGameplay/Source/HktCore/Public/HktSimulationLimits.h` | `DefaultPickupRangeCm = 300` |
| `HktGameplay/Source/HktAsset/Public/HktLootTableDataAsset.h` | `UHktLootTableDataAsset` — `TArray<FHktLootEntry>` + 식별 Tag |
| `HktGameplay/Content/Stories/Story_NPCLifecycle.json` (+ spec) | drop 분기 70 줄 → `SnippetRandomLootDrop` 1 줄 |
| `HktGameplay/Content/Stories/Story_ItemPickup.json` | 거리 임계를 `DefaultPickupRangeCm` 참조로 (또는 빌더 측 const) |
| `HktGameplay/Source/HktRuntime/Private/Actors/HktInGamePlayerController.{h,cpp}` | 단축키 (E) 픽업 트리거 — 가장 가까운 ground item 선택 |
| `HktGameplay/Source/HktUI` | `Widget.PickupHint` 신규 (P5) |

---

## 7. 결정론·보안 점검

| 항목 | 점검 |
|---|---|
| **drop** 의 random 결정성 | `RandomInt` 는 결정론 RNG (`FHktRandomStream`). 같은 frame seed 면 서버·클라 동일 결과 — 현 NPC lifecycle 의 4-way drop 이 이미 같은 채널 |
| **drop table DataAsset** 의 결정성 | Tag → DataAsset 매핑은 부팅 시 1 회 해결. 런타임 hot reload 금지 (결정론 입력에 진입) |
| **pickup** precondition 의 read-only 성 | `ItemState` / `GetDistance` / `EquipSlot*` 읽기만 — 부작용 0. fail 시 상태 무변화 |
| **클라 위변조 내성** | precondition 이 *모든* 조건을 서버 권위로 재검증. 클라 보낸 거리·상태는 무시 (검증의 입력으로만 사용) |
| **분리된 사망 채널 회귀** | 본 의도가 정확히 막고자 하는 것 — lifecycle 외부에서 drop 을 emit 하는 코드를 grep 으로 주기 점검 (`SpawnEntity.*ItemState.*0` 패턴이 lifecycle 외에 등장하면 alarm) |
