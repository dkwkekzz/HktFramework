# SYSTEM DESIGN DOCUMENT
## Item System R0 — 정의 · 소지 · 사용 · 장착 · 제작 · 세계 개체화

> 상태: **기초 기획 초안** (Human 제출 원본 — 승인·개정 대기)
> 범위: 아이템이 세계의 자원으로 성립하기까지의 6 단계 기능 목록
> 아래 본문은 제출된 원본 그대로다. 검토 의견은 이 문서에 섞지 않는다.

---

# 아이템 시스템 단계별 기능 기획

아이템 시스템은 정의 → 소지/관찰 → 사용/효과 → 장착 → 소모/제작 → 세계 개체화의 순서로 확장한다. 각 단계는 다음 단계의 기반이 되며, 모든 기능은 플레이 중 결과를 관찰할 수 있고 자동 테스트로 성공/실패를 판정할 수 있는 형태로 정의한다. WoW, FFXIV, GW2, ESO 등 AAA MMORPG에서 일반적으로 사용하는 카탈로그 기반 아이템 정의, 인벤토리 관찰, 컨텍스트 행동, 장비 슬롯, 소비·제작 트랜잭션, Loot/World Object 구조를 현재 세계 모델에 맞게 적용한다.

| 단계 | 기능 | 무엇인가 | 왜 필요한가 | 구현 방향 | 관찰·검증 기준 |
|---|---|---|---|---|---|
| 1. 정의 | Item Catalog | 세계에 존재 가능한 아이템 종류의 단일 정의소 | stone, pickaxe 같은 종류별 조건문이 시스템 곳곳에 늘어나는 것을 막는다 | ItemDefinition 카탈로그를 두고 ItemKind는 catalog key로만 사용한다. 장비·소비재·재료 등 AAA MMORPG처럼 아이템 자체가 자신의 분류와 행동 정보를 가진다 | 신규 아이템을 catalog에 추가했을 때 기존 use/equip/mining 코드 수정 없이 inventory에 등장한다 |
| 1. 정의 | 상위 IT 연결 | 세계 아이템과 master/growth/items/IT-*의 대응 관계 | 성장 데이터와 실제 세계 아이템의 출처를 추적하기 위해 필요하다 | sourceItemId: IT-*를 명시한다. world naming과 master naming을 같은 문자열로 강제하지 않는다 | stone 조회 시 IT-COMMON-STONE까지 추적된다 |
| 1. 정의 | IP 성질 부여 | 아이템이 가진 기능적 성질 | “곡괭이라 채굴 가능”이 아니라 “채굴 성질을 가진 아이템이라 가능”하게 만들기 위함 | properties: IP-*[]를 두고 capability 판정은 ItemKind 대신 property를 조회한다 | 서로 다른 두 아이템에 동일 Mining IP를 부여하면 둘 다 동일 채굴 조건을 만족한다 |
| 1. 정의 | 행동 유형 선언 | 아이템이 use, equip, material 등 어떤 역할을 가질 수 있는지 정의 | GW2 등처럼 아이템 종류에 따라 가능한 컨텍스트 행동이 달라지는 구조의 기반 | catalog에 behavior/capability를 선언하고 실제 현재 가능 여부는 runtime resolver가 계산한다 | 소비재에는 Use, 장비에는 Equip이 나타나며 단순 재료에는 불필요한 행동이 나타나지 않는다 |
| 1. 정의 | Stack 규칙 | 같은 종류 아이템을 수량으로 합칠 수 있는 규칙 | 현재 Map<ItemKind, number> 구조를 명확한 도메인 규칙으로 만들기 위해 필요 | stackable, 필요 시 maxStack을 정의한다. 일반 재료·소비재는 스택하고 개별 상태 장비는 향후 instance로 전환한다 | stone 1개를 두 번 획득하면 항목 1개, quantity 2로 보인다 |
| 1. 정의 | Instance 전환 기준 | 언제 종류+수량 모델을 개별 아이템 모델로 확장할지 정의 | 내구도·강화·귀속 때문에 처음부터 모든 아이템에 UUID를 부여하는 과설계를 피한다 | 동일 종류 간 내구도·강화·귀속·개별 소유 상태가 달라져야 할 때 ItemInstance를 도입한다 | 해당 요구가 없을 때는 아이템마다 instance id가 생성되지 않는다 |
| 2. 소지/관찰 | Inventory List | Actor가 가진 전체 아이템과 수량 조회 | 현재 HUD의 stone 전용 필드 같은 특수 처리를 제거한다 | listInventory(actor)가 {itemKind, quantity} 목록을 반환한다. MMORPG 인벤토리처럼 하나의 일반화된 목록으로 노출한다 | stone 3, potion 2, sword 1 보유 시 정확히 세 종류가 관찰된다 |
| 2. 소지/관찰 | Quantity Query | 특정 아이템의 현재 보유량 조회 | 사용·제작·퀘스트·행동 조건의 공통 primitive | getQuantity(actor, itemKind) 제공 | 미보유는 0, stone 3개는 3을 반환한다 |
| 2. 소지/관찰 | Inventory Mutation API | 획득과 제거를 수행하는 단일 변경 경로 | stone += 1처럼 시스템별 직접 수정이 생기면 이후 제작·드롭·거래가 서로 다른 규칙을 갖게 된다 | addItem, removeItem을 inventory mutation의 유일한 통로로 둔다 | 채굴 성공 시 addItem 호출 결과로 stone quantity가 정확히 +1 된다 |
| 2. 소지/관찰 | Inventory Observation | UI에 전달하는 읽기 전용 소지품 표현 | UI가 Actor 내부 구조나 아이템 규칙을 직접 해석하지 않도록 한다 | InventoryEntryObservation에 종류·수량·표시 정보·현재 가능한 interaction을 포함한다 | HUD가 inventory.stone 같은 전용 필드 없이 전체 소지품을 표현한다 |
| 2. 소지/관찰 | Item Interaction Projection | 각 아이템에 지금 가능한 행동과 불가능 이유를 보여준다 | WoW/GW2/ESO처럼 선택한 아이템에서 사용할 수 있는 행동을 바로 확인하게 한다 | 기존 available + reason 계약을 item interaction에도 사용한다 | potion은 use:true, 조건 미달 sword는 equip:false + reason으로 관찰된다 |
| 2. 소지/관찰 | 분류·정렬·필터 | 장비·소비재·재료 등을 구분하여 표시 | 아이템 수가 늘면 단순 목록만으로 사용성이 급격히 떨어진다 | catalog의 category/tag를 presentation metadata로 사용한다 | 장비/소비재/재료 필터를 추가해도 게임 규칙 코드는 수정되지 않는다 |
| 3. 사용/효과 | Use Item Action | 아이템 사용을 정식 Actor 행동으로 만든다 | 아이템 사용만 시간·대상·중단·실패 규칙에서 벗어나는 것을 막는다 | 기존 행동 framework에 use-item을 추가한다 | use 요청이 다른 행동과 동일하게 시작·성공·실패 상태로 관찰된다 |
| 3. 사용/효과 | Target Policy | 아이템이 자신, 현재 대상 또는 대상 없음 중 무엇을 요구하는지 정의 | 회복약·공격 소비재·설치형 아이템의 차이를 일반화한다 | self, currentTarget, none 정책을 둔다. C017의 currentTarget을 그대로 사용한다 | self 회복약은 target 없이 성공하고 대상형 아이템은 target 부재 시 실패한다 |
| 3. 사용/효과 | Availability Resolver | 지금 이 아이템을 사용할 수 있는지 계산 | UI 표시와 서버 실행 판정이 달라지는 문제를 방지한다 | resolveItemInteraction(actor,item,context)가 available/reason을 반환하고 실행에서도 동일 결과를 사용한다 | UI에서 unavailable인 행동을 강제로 요청해도 같은 reason으로 실패한다 |
| 3. 사용/효과 | Immediate Effect | 사용 즉시 Actor나 Target의 상태를 바꾸는 효과 | 회복제, 공격 소비재 등 MMORPG 아이템의 가장 기본적인 사용 결과 | UseItem → EffectRequest → EffectResolver로 분리한다. 첫 적용은 MC-RESTORE-BIOLOGICAL-STATE | 손상된 Actor가 회복 아이템을 사용하면 생물 상태가 지정 규칙대로 회복된다 |
| 3. 사용/효과 | Status Effect | 일정 시간 몸에 남는 아이템 효과 | 음식·엘릭서·전투 버프 등 MMORPG의 지속형 소비재를 지원한다 | AppliedEffect {effectId, source, expiresAt} 형태로 장착 효과와 별도 관리한다 | 버프 사용 후 상태가 생기고 만료 시 자동으로 제거된다 |
| 3. 사용/효과 | Cooldown | 같은 아이템 또는 효과의 연속 사용 제한 | 전투 소비재의 반복 사용을 통제하기 위해 필요 | item/effect별 cooldown key와 종료 시각을 관리한다 | 첫 사용 직후 재사용은 cooldown-active, 종료 이후에는 다시 available이 된다 |
| 3. 사용/효과 | 사용 시간·중단 | 사용 완료까지 시간이 필요한 아이템 | 음식, 붕대, 채널링 소비재 등 AAA MMORPG에서 일반적인 사용 형태를 지원한다 | 기존 action duration/interruption을 재사용한다 | 3초 아이템은 3초 완료 전에는 효과가 발생하지 않고 중단되면 효과도 발생하지 않는다 |
| 4. 장착 | Equipment Slot | 몸에서 아이템이 적용되는 위치 | “보유”와 “현재 적용”을 분리하기 위한 핵심 구조 | equipment: Map<EquipmentSlot, ...>를 둔다. 무기·방어구·도구 등 MMORPG 방식으로 슬롯을 확장 가능하게 한다 | sword를 가지고만 있을 때는 능력치가 변하지 않고 장착 후에만 변한다 |
| 4. 장착 | Slot Compatibility | 어떤 아이템이 어느 슬롯에 들어갈 수 있는지 판정 | 잘못된 장비 조합을 막는다 | ItemDefinition의 장착 성질과 slot requirement를 resolver가 비교한다 | helmet을 mainHand에 장착하려 하면 명시적 reason으로 실패한다 |
| 4. 장착 | Equip / Unequip | 장비를 적용하거나 해제하는 행동 | 공격력·관통·채굴 능력 등 지속 효과의 lifecycle이 필요하다 | 일반 interaction으로 equip, unequip을 제공한다 | equip 직후 slot에 나타나고 unequip 후 slot이 비며 효과가 원복된다 |
| 4. 장착 | Swap | 이미 사용 중인 슬롯의 장비 교체 | 실제 플레이에서는 장착보다 교체가 더 빈번하다 | equip transaction이 기존 장비 해제와 신규 장비 적용을 한 번에 처리한다 | sword 장착 상태에서 axe 장착 시 최종적으로 axe만 적용된다 |
| 4. 장착 | Equipment Modifier | 장비가 Actor 능력치를 변경 | 현재 디버그 경로에 의존하는 MC-ATTACK-POWER, MC-PENETRATION, 치명 관련 능력치를 정상 게임 규칙으로 연결한다 | effective stat = base + equipped modifiers resolver 사용 | sword 장착/해제만으로 effective attack power가 상승/원복된다 |
| 4. 장착 | Equipment Capability | 장착 상태가 새로운 행동 가능성을 만든다 | 곡괭이 같은 도구를 ItemKind 하드코딩 없이 처리하기 위함 | 장착된 아이템의 IP를 Actor capability 계산에 합산한다 | Mining IP 도구 장착 시 mine이 available, 해제 시 다시 unavailable이 된다 |
| 5. 소모/제작 | Consume | 아이템 보유 수량을 감소시키는 기본 연산 | 현재 세계에 없는 “가진 것이 사라진다”는 규칙의 출발점 | consumeItem(actor,item,quantity)를 inventory primitive로 제공한다 | potion 3개에서 1개 사용 성공 후 2개가 된다 |
| 5. 소모/제작 | 부족 수량 검증 | 필요한 수량이 없을 때 변경을 거부한다 | 음수 inventory와 중간 실패를 방지한다 | mutation 전에 quantity validation 수행 | stone 1개 상태에서 2개 소비 요청 시 stone은 1개 그대로 유지된다 |
| 5. 소모/제작 | Use + Consume 원자 처리 | 소비와 효과 적용을 하나의 성공 단위로 묶는다 | 아이템만 사라지거나 효과만 발생하는 오류를 막는다 | validation → effect resolution → inventory mutation을 하나의 command/transaction으로 처리한다 | 실패한 use에서는 효과와 수량 변화가 모두 0이다 |
| 5. 소모/제작 | Recipe Catalog | 재료와 결과물 조합을 데이터로 정의 | 제작법이 코드 조건문으로 늘어나는 것을 방지한다 | Recipe {inputs, outputs, requirements} 카탈로그를 둔다 | recipe 데이터만 추가해 신규 제작 항목이 노출된다 |
| 5. 소모/제작 | Craft Availability | 현재 제작 가능 여부와 불가능 이유 | AAA MMORPG 제작 UI처럼 부족 재료·조건을 실행 전에 알 수 있어야 한다 | 재료 수량, 제작 능력, 제작대 등의 requirement를 resolver가 평가한다 | 재료 부족 시 필요한 재료가 reason으로 표시되고 충족하면 available로 변한다 |
| 5. 소모/제작 | Atomic Craft | 재료 감소와 결과물 증가를 하나의 작업으로 처리 | 제작 도중 일부 재료만 사라지는 상태를 막는다 | validate → consume inputs → add outputs → commit | 제작 성공 시 재료와 결과가 동시에 변하고 실패 시 둘 다 변하지 않는다 |
| 5. 소모/제작 | Craft Context | 특정 장소나 도구를 필요로 하는 제작 | ESO/FFXIV/WoW처럼 제작을 세계의 장소·도구와 연결하기 위함 | recipe requirement에 station/capability를 넣는다 | 대장간 밖에서는 제작 불가, 대장간 interaction 범위에서는 가능하다 |
| 6. 세계 개체화 | World Item Entity | Actor 밖의 공간에 존재하는 아이템 | 드롭·줍기·전리품을 만들기 위해 필요하다 | WorldItemEntity {entityId,itemKind,quantity,position,...}를 둔다. 모든 아이템을 instance화하지 않고 stack 단위 world entity를 허용한다 | 바닥 아이템이 world query와 화면에서 특정 위치를 가진 존재로 관찰된다 |
| 6. 세계 개체화 | Pickup | 세계의 아이템을 inventory로 옮긴다 | 가장 기본적인 world → inventory 이동 | interaction validation 후 world quantity 감소와 inventory 증가를 원자 처리한다 | ground stone 3을 줍고 나면 ground entity는 사라지고 inventory가 +3 된다 |
| 6. 세계 개체화 | Drop | inventory의 아이템을 세계에 놓는다 | inventory → world 역방향 이동이 필요하다 | inventory consume과 world entity spawn을 하나의 transaction으로 처리한다 | stone 5에서 2개 버리면 inventory 3, ground entity quantity 2가 된다 |
| 6. 세계 개체화 | Loot Container | 몬스터·상자·시체 등 몸 밖의 아이템 보관소 | AAA MMORPG는 모든 loot를 물리 아이템으로 바닥에 생성하지 않고 container/source를 통해 전달한다 | LootContainer가 item stack 목록을 가지고 interaction을 통해 Actor inventory로 이동시킨다 | 상자를 열기 전 inventory는 그대로이고 획득한 항목만 container에서 사라진다 |
| 6. 세계 개체화 | Pickup 권한 | 누가 해당 아이템을 획득할 수 있는지 결정 | 멀티플레이에서 전리품 경쟁과 소유권을 통제하기 위해 필요 | owner/party/claim policy를 world item 또는 loot source에 둔다 | A에게 귀속된 loot는 B가 시도하면 명시적 reason으로 실패한다 |
| 6. 세계 개체화 | Lifecycle / Despawn | 세계 아이템이 언제 사라지는지 결정 | 버려진 아이템의 무한 누적을 방지한다 | TTL, 지역 unload, source 종료 등의 제거 정책을 둔다 | TTL 경과 후 해당 item entity가 world observation에서 제거된다 |
| 6. 세계 개체화 | 동시 획득 원자성 | 동일 아이템에 여러 Actor가 동시에 접근할 때 단 한 번만 이전되게 한다 | 서버 권위형 MMORPG에서 duplication 방지를 위해 필수 | authoritative transfer transaction과 entity/version 검증 사용 | 두 Actor가 동시에 마지막 아이템을 pickup하면 한 명만 성공한다 |
| 6. 세계 개체화 | World Item Observation | 주변 아이템과 가능한 상호작용을 UI에 제공 | inventory와 동일하게 UI가 world 내부 구현을 직접 해석하지 않도록 한다 | 기존 interaction observation에 pickup + available/reason을 연결한다 | 거리 밖에서는 pickup unavailable, 접근하면 available로 바뀐다 |

## 단계별 완료 기준

| 단계 | 완료로 보는 조건 |
|---|---|
| 정의 | 신규 아이템 추가가 관련 시스템의 ItemKind if/else 추가 없이 가능하다 |
| 소지/관찰 | Actor가 가진 모든 아이템·수량·가능 행동·불가 이유를 하나의 observation 계약으로 표현한다 |
| 사용/효과 | 아이템 사용 행동을 통해 Actor 또는 Target의 실제 상태가 변경되고 실패 이유까지 관찰된다 |
| 장착 | 장착/해제만으로 effective stat 및 capability가 변경되고 정확히 원복된다 |
| 소모/제작 | 아이템 감소가 존재하며 재료 → 제작 → 결과물이 원자적으로 수행된다 |
| 세계 개체화 | 아이템이 Actor 밖에 존재하며 pickup/drop/loot source를 통해 inventory와 양방향 이동한다 |

## 최종 통합 검증 시나리오

```text
돌을 채굴한다
→ Item Catalog에 정의된 돌이 inventory에 증가한다
→ 소지품 목록에서 돌의 수량과 가능한 행동을 확인한다
→ 돌을 요구하는 제작법이 available로 변한다
→ 제작을 실행한다
→ 돌이 감소하고 결과 장비가 생긴다
→ 장비를 장착한다
→ Actor의 능력치 또는 capability가 변한다
→ 소비 아이템을 사용한다
→ 수량이 감소하고 Actor 또는 Target의 상태가 변한다
→ 아이템을 버린다
→ world item으로 공간에 나타난다
→ 다른 Actor가 권한과 거리 조건을 만족하면 줍는다
→ world item은 사라지고 다른 Actor의 inventory에 들어간다
```

이 시나리오가 통과하면 아이템은 더 이상 몸 안에 들어 있는 종류별 숫자가 아니라, 정의된 성질을 가지고 소유·사용·장착·소모·제작·이동할 수 있는 세계의 일관된 자원으로 성립한다.
