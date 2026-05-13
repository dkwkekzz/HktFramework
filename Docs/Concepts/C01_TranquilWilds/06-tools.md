# C01-06 — 도구 카탈로그 / Action↔Tool 매트릭스

> **목적**: 05 §3 의 *도구 요구* 컬럼을 결정짓는 단일 출처. `Entity.Tool.*` 의 카탈로그 + Material tier ladder + 행위 판정 시 도구 검사 시퀀스를 합의한다.
> **상태**: Skeletal — 내구도(Durability) · 제작(Crafting) · 획득 경로(Acquisition) 는 본 PR 비범위.
> **상위**: [`README.md`](./README.md) · **선행**: [`05-interactions.md`](./05-interactions.md) · [`01-natural-entities.md`](./01-natural-entities.md)
> **기록일**: 2026-05-13

---

## 0. 범위 / 비범위

### 범위
- `Entity.Tool.*` 의 카탈로그 (5 종) 와 각 도구의 **데이터 모델** (Material tier · 슬롯 · 사용 대상).
- *Action × Tool* 매트릭스 — 05 §3 의 도구 요구를 *어느 도구 + 어느 tier* 가 통과시키는가의 단일 출처.
- 서버 룰의 **도구 검사 시퀀스** (HktRule 의 OnAction 단계).
- `Equipment` 슬롯 컨벤션 (HotbarPrimary / Offhand / Inventory).

### 비범위
- **Durability** (내구도) — 시즌 0 은 *내구도 0* 가정 (도구는 영구). 후속 `08-durability.md`.
- **Crafting** (제작) — 시즌 0 의 도구 획득은 *시작 inventory* + *자연 발견* 으로 한정. 후속 `09-crafting.md`.
- **Acquisition** (획득 경로) — 시작 인벤토리 / 폐허 / 보상 등. 본 PR 은 *어디서 얻는가* 무관.
- **무기 / 전투** — 본 컨셉은 평화적 자연 상호작용. 적대 NPC 와의 전투용 무기는 시즌 1+.
- **도구 UI** — hotbar 표기 / 컨텍스트 메뉴는 `HktUI` 책임.

---

## 1. 가드레일

| # | 항목 | 근거 |
|---|---|---|
| **T1** | 도구는 일반 entity. 별도 store 도입 0. `WorldState.SlotToEntity` 의 보통 슬롯 사용. | 절대 원칙 5 / G3 |
| **T2** | 도구의 *카테고리* 는 `Entity.Tool.<Kind>` 태그, *tier* 는 `Material.<Name>` 태그로 표기 — 두 차원 분리. | G4 / 05 §8 |
| **T3** | 행위 통과 판정은 **서버 룰 (HktRule) 단독 책임**. spawner story 본문은 도구 검사 0 — 통과한 이벤트만 본다. | 05 §5 / G5 |
| **T4** | 도구 검사는 결정론적 정수 비교. Material tier 는 정수 ladder 로 매핑한 후 `>=` 비교. random 0. | G5 |
| **T5** | 도구는 *plural 슬롯* 점유 — `Equipment.HotbarPrimary` / `Equipment.Offhand` / 인벤토리 백 중 하나. 슬롯 컨벤션은 §6. | G4 |
| **T6** | 도구가 *없어도 통과* 인 행위 (빈손 Harvest 등) 는 매트릭스 §4 에서 *RequiredKind = none* 으로 표기. | T3 / 05 §3 |

---

## 2. 도구 카탈로그 (5 종)

| # | Entity 태그 | Kind | 용도 | Material tier (시즌 0) | Default 슬롯 |
|---|---|---|---|---|---|
| **A** | `Entity.Tool.Axe` | Axe | 베기 (F03/F04/F05) | {Wood < Stone < Sharpened} | HotbarPrimary |
| **P** | `Entity.Tool.Pickaxe` | Pickaxe | 채광 (G01/G02) | {Stone < Bronze} | HotbarPrimary |
| **T** | `Entity.Tool.Tinder` | FireStarter | 점화 (F05 slope / F01 Grass) | {Flint} (시즌 0 단일 tier) | Offhand |
| **C** | `Entity.Tool.Container` | Container | 음용 운반 (W03 Spring) | {Cup} (시즌 0 단일 tier) | Inventory |
| **L** | `Entity.Tool.Torch` | Light | 야간 조명 + Ignite 대체 트리거 | {Wood} (시즌 0 단일 tier) | Offhand |

> 카탈로그 추가 (Sickle / FishingRod / Hammer) 는 컨텐츠 누적 후. 본 PR 은 *05 가 명시한 도구 요구* 만 커버.

### 2-1. Material tier 매핑 (정수 ladder, T4)

| Tier 이름 | 정수 코드 | 적용 도구 |
|---|---|---|
| Wood | 0 | Axe, Torch |
| Stone | 1 | Axe, Pickaxe |
| Sharpened | 2 | Axe |
| Bronze | 2 | Pickaxe |
| Flint | 0 | Tinder |
| Cup | 0 | Container |

> 정수 코드는 *도구 종류 내부* 에서만 비교 — Axe.Stone(1) vs Pickaxe.Stone(1) 의 비교 0. Kind 가 일치한 후에만 tier 비교.

---

## 3. 데이터 모델

### 3-1. 도구 entity 의 태그 + cold attribute

```
Entity (Tool)
  ├─ Tag : Entity.Tool.<Kind>             # 카테고리 (Axe / Pickaxe / ...)
  ├─ Tag : Material.<Name>                # tier (Wood / Stone / ...)
  ├─ PropertyId::OwnerUid                 # 소유자 entity id (이미 존재)
  ├─ PropertyId::EquipmentSlot            # 0=Inventory / 1=HotbarPrimary / 2=Offhand (cold) [new]
  └─ (이후 시즌) PropertyId::Durability   # hot. 시즌 0 비범위.
```

> `EquipmentSlot` PropertyId 는 04 ADR 의 *그룹 A 신규* 와 별개로 본 PR 의 의존이 작다 — *시즌 0* 은 인벤토리 시스템이 단순하므로 *서버 룰이 외부 store* (예: `FHktInventoryState`) 로 우회해도 OK. 결정만 §6 에서.

### 3-2. 행위 측 entity 의 도구 요구

행위 판정 시 *대상 entity* 의 attribute 또는 *행위 spec* (HktRule 의 OnAction_*) 에서 도구 요구를 읽는다. 두 곳에 분산 0 — **`OnAction_<Verb>` 의 spec 1 곳** 에 단일 저장 (§4 매트릭스가 출처).

---

## 4. Action × Tool 매트릭스

05 §3 의 *Conditions* 컬럼 중 도구 요구만 추출. *RequiredKind* + *RequiredTier* 통과해야 행위 발화.

### 4-1. 베기 / 채광 / 채집

| Action | Target | RequiredKind | RequiredTier | 메모 |
|---|---|---|---|---|
| `Action.Natural.Fell` | F03 Birch | Axe | Wood (0) | 시작 도구로 가능 |
| `Action.Natural.Fell` | F04 Oak | Axe | Stone (1) | 진입 ladder |
| `Action.Natural.Fell` | F05 Pine | Axe | Stone (1) | Oak 와 동일 tier (Pine 의 진입 장벽은 *slope* 자체) |
| `Action.Natural.Fell` | F04 Oak (Elder) | Axe | Sharpened (2) | LineageId 분기 진입 |
| `Action.Natural.Mine` | G01 Boulder | Pickaxe | Stone (1) | 시작 도구로 가능 (또는 자연 발견) |
| `Action.Natural.Mine` | G02 OreOutcrop (Common) | Pickaxe | Stone (1) | 일반 광맥 |
| `Action.Natural.Mine` | G02 OreOutcrop (Rare) | Pickaxe | Bronze (2) | 04 §4 region 카운터로 Rare 발현 |
| `Action.Natural.Harvest` | F06 BerryBush | (none) | — | 빈손 OK |
| `Action.Natural.Harvest` | F07 Herb | (none) | — | 빈손 OK |
| `Action.Natural.Pluck` | F09 Reed / F10 WaterLily | (none) | — | 빈손 OK |
| `Action.Natural.Eat` | F08 Mushroom (inv) | (none) | — | 인벤토리 만 |

### 4-2. 점화 / 운반

| Action | Target | RequiredKind | RequiredTier | 대체 도구 |
|---|---|---|---|---|
| `Action.Natural.Ignite` | F05 Pine slope | Tinder | Flint (0) | Torch (Wood, 0) — 동등 통과 |
| `Action.Natural.Ignite` | F01 Grass cell | Tinder | Flint (0) | Torch — 동등 |
| `Action.Natural.Drink` | W03 Spring | (none) 직접 음용 OR Container Cup (0) | — | 직접 음용 시 단발성 buff, Container 사용 시 운반 가능 |

> Tinder ↔ Torch 의 *동등 통과* 는 §5 의 OR 조건 절로 처리.

### 4-3. 위치 이벤트 (도구 무관)

| Action / Trigger | Target | RequiredKind | 메모 |
|---|---|---|---|
| Cross / Reach trail / Reach peak / Observe grain / FordCrossed | — | (none) | 위치 자체가 트리거 — 도구 0 |

---

## 5. 판정 시퀀스 (HktRule)

각 `OnAction_<Verb>` 의 도구 검사 단계.

```
[OnAction_<Verb>(SourceEntity, TargetEntity, Pos)]
  1. 거리 / 각도 / line-of-sight 검사  (05 §5)
  2. 대상 entity attribute 검사 (HP / ripe / mature)
  3. 도구 검사  ←  본 PR
     a. spec.RequiredKind == none  →  통과
     b. 그 외:
        ToolEntity = ResolveEquipped(SourceEntity, spec.RequiredKind)
        if ToolEntity == InvalidEntityId → 실패 (silent + Presentation hint optional)
        if !HasTag(ToolEntity, "Material.<Name>" ∋ tier >= spec.RequiredTier) → 실패
        # OR 분기: alt RequiredKind (예: Tinder|Torch) 있으면 둘 다 시도, 하나라도 통과면 OK
  4. Biome / region 조건 검사 (예: FireSusceptible)
  5. 통과 → HktEventBuilder::Action(...) 발화
```

### 5-1. `ResolveEquipped` 의 결정론

```
ResolveEquipped(SourceEntity, RequiredKind):
  1. HotbarPrimary 슬롯의 entity → Kind 일치하면 반환
  2. Offhand 슬롯의 entity        → Kind 일치하면 반환
  3. Inventory 슬롯 enumeration   → 결정론 순서 (slot index 오름차순) 첫 일치 반환
  4. 없으면 InvalidEntityId
```

> 결정론 enumeration 보장 — 인벤토리 추가/제거 시 *slot index 재정렬 금지* (04 §4 T6 의 SoA enumeration 컨벤션과 동등).

### 5-2. 실패 시 처리 (T6 의 결정)

- 시즌 0 은 *silent 실패* (05 In7 의 (a) 옵션 = 시즌 0 결정). Presentation hint 는 별도 후속.
- 실패에 대한 *이벤트 발화 0* — `PendingGroupIntents` 큐에 진입조차 하지 않음.

---

## 6. Equipment 슬롯 컨벤션

| 슬롯 | EquipmentSlot 코드 | 정원 | 용도 |
|---|---|---|---|
| HotbarPrimary | 1 | 1 슬롯 | 주 액션 (Fell / Mine) — 한 번에 1 도구만 |
| Offhand | 2 | 1 슬롯 | 보조 (Tinder / Torch) — 점화 / 조명 |
| Inventory | 0 | N 슬롯 (시즌 0 N=16) | Container · 여분 도구 · 채집물 |

### 6-1. 슬롯 ↔ 행위 자동 매핑 (T5)

- `Action.Natural.Fell` / `.Mine` → HotbarPrimary 만 검사 (Inventory fallback 0).
- `Action.Natural.Ignite` → Offhand → Inventory fallback.
- `Action.Natural.Drink` → Container 가 Inventory 에 있으면 운반 모드, 없으면 직접 음용 모드.

> "HotbarPrimary fallback 0" 의 이유: 베기/채광은 *능동* 행위 — 도구 빼들고 휘두름. 빠진 채로는 행위 자체 0.

---

## 7. 결정론 / 영속

- 모든 도구 검사는 결정론. random 0. tier 비교는 정수.
- `ResolveEquipped` 의 enumeration 은 §5-1 의 고정 순서.
- 도구 entity 의 ownership 변경 (서버 권한 이동) 도 결정론 — `OwnerUid` 컬럼만 갱신.
- 시즌 0 의 도구는 내구도 0 이므로 *영속 hook 0* — 도구 entity 의 생성/제거가 곧 영속 변화.

---

## 8. 오픈 이슈

| # | 이슈 | 옵션 | 우선순위 |
|---|---|---|---|
| **To1** | `EquipmentSlot` 을 PropertyId 로 추가할 것인가, 별도 store (`FHktInventoryState`) 로 우회할 것인가 | (a) PropertyId 추가 (04 ADR 의 그룹 A 와 동일 패턴) / (b) 별도 store | Resolved: (a) — 04 ADR 정합 |
| **To2** | Material tier 의 정수 코드 충돌 (Axe.Stone=1 / Pickaxe.Stone=1) | Kind 가 일치한 후에만 tier 비교 — §2-1 의 컨벤션 | Resolved: §2-1 |
| **To3** | Tinder ↔ Torch 의 동등 통과 | OR 분기 (§5 spec 의 alt RequiredKind) | Resolved: §5 |
| **To4** | 시작 인벤토리 — 어떤 도구를 갖고 시작하는가 | (a) Axe.Wood + Pickaxe.Stone + Tinder.Flint / (b) Axe.Wood + Tinder.Flint, Pickaxe 는 자연 발견 / (c) Axe.Wood 만, 나머지는 자연 발견 | Mid — `09-crafting.md` 또는 별도 |
| **To5** | "자연 발견" — 폐허 / 부서진 보따리 / G03 Pebble 무덤 등에서 발견되는 entity 카탈로그 | 03 의 spawner 에 *Tool Drop* 노드를 추가할 것인지, 별도 *Story* 로 둘 것인지 | Mid |
| **To6** | 도구 *내구도* 미도입 시 도구 사용의 *비용* 이 0 — 경제성 0 | (a) 내구도 후속 PR / (b) 도구 사용 시 *행위 시간 (Wait frames)* 자체가 비용 | Resolved: (b) 가 시즌 0 의 비용 모델 |
| **To7** | Light (Torch) 가 *조명* 으로 쓰일 때 `Region.NightVisibility` 같은 region 카운터를 갱신해야 하는가 | (a) 갱신 / (b) 도구 entity 자체의 attribute 만 — 시즌 0 비범위 | Resolved: (b) |
| **To8** | 한 번에 *복수 도구* 가 필요한 행위 (예: Bronze Pickaxe + Container) 가 있는가 | 시즌 0 의 매트릭스에 없음 — 후속 등장 시 §4 spec 의 RequiredList 로 확장 | Resolved: 시즌 0 비범위 |
| **To9** | NPC 도 도구를 들 수 있는가 (Resolve 가 NPC entity 에도 통하는가) | 시즌 0 의 자연 entity 는 도구 0 — Resolve 호출 자체가 발생하지 않음 | Resolved: 시즌 0 자연 entity 비대상 |
| **To10** | 도구 *공유* (협동) — 한 도구를 두 플레이어가 차례로 사용 | 결정론 enumeration 으로 직렬화 — 첫 사용자가 OwnerUid 보유 | Resolved: 04 §4 T6 정합 |

---

## 9. 결정 요약 (1 화면)

```
Entity.Tool.<Kind>  +  Material.<Name>  (2-tag 컨벤션)
  Axe       : Wood < Stone < Sharpened   (3 tier)
  Pickaxe   : Stone < Bronze              (2 tier)
  Tinder    : Flint                       (1 tier)
  Container : Cup                         (1 tier)
  Torch     : Wood                        (1 tier, Ignite 의 alt RequiredKind)

판정 위치:
  HktRule.OnAction_<Verb>  ←  거리 / attribute / 도구 / region 의 단일 검사 지점

판정 단계 (§5):
  1. 거리·각도·LOS         (05 §5)
  2. 대상 attribute       (HP / ripe / mature)
  3. 도구  ←  본 PR        (ResolveEquipped + Tier >= 비교)
  4. region 조건          (04 ADR §3 RegionRead)
  5. 통과 → FHktEvent 발화

슬롯:
  HotbarPrimary (Fell/Mine) · Offhand (Ignite/Torch) · Inventory (Container/여분)

실패:
  silent — 시즌 0 의 결정 (05 In7-a)
```

---

## 10. 다음 PR 후보

- `07-story-bodies/` — 03 의 11 spawner 본문 schema 2 JSON. 본 PR 의 RequiredKind/RequiredTier 가 *수신 spawner* 의 도구 분기에 사용됨 (예: S02 Oak Elder 분기 시 Sharpened tier 통과 여부).
- `08-durability.md` — 시즌 1+. 내구도 hot attribute + 도구 소실 이벤트.
- `09-crafting.md` — 시즌 1+. Pebble + Branch → Stone Axe 등의 제작 카탈로그.
- `10-tool-discovery.md` (선택) — 자연 발견 entity (폐허/무덤) 의 도구 drop 패턴 — 03 의 spawner archetype 부활 우려 없는 *별도 컨텐츠 archetype* 으로 다룬다.
