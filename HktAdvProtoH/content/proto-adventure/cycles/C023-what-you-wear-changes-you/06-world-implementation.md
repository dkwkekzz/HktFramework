# C023 — World Implementation

> 세계에 적용이 섰다. `equip` 이라는 말이 `world/` `protocol/` 에 0건이던 자리에
> 자리 여섯과 규칙 둘, 그리고 **저장되지 않는 유효 값**이 생겼다.
> 채집이 묻는 문장은 한 글자도 바뀌지 않았고, 그 답이 어디서 오는지만 바뀌었다.

## IMPLEMENTED

    World.EquipSlots (E1~E6)          world/semantic/equipment.ts
    Equipment · createEquipment        world/semantic/equipment.ts
    equipmentSlots · equippedKinds     world/semantic/equipment.ts
    RULE-EQUIP-SLOT-FITS-001           world/semantic/equipment.ts (slotFits)
    equipmentContributions             world/semantic/equipment.ts
    RULE-EFFECTIVE-STATS-001           world/semantic/combat.ts (effectiveStat)
    ItemDefinition.Equip               world/semantic/item.ts
      .targets / .contributions        — pickaxe: { contributions: { physicalAttack: 12 } }
    ContributableStat · StatContributions
                                       world/semantic/item.ts
    IE §13.1 불변 조건                  world/semantic/item.ts (카탈로그 옆 확인)
    Actor.Equipment                    world/semantic/actor.ts · spawn.ts
    RULE-ITEM-EQUIP-001                world/rules/item-equip.ts
    RULE-ITEM-UNEQUIP-001              world/rules/item-equip.ts
    RULE-BODY-GRANTABLE-USES-001       world/rules/body-uses.ts
    equip-item · unequip-item          world/actions/interactions.ts
    EquipmentSlotView                  protocol/gameview.ts
    ActionRequest.equipSlotId          protocol/actions.ts
    RULE_ITEM_EQUIP · RULE_ITEM_UNEQUIP · RULE_EQUIP_SLOT_FITS ·
    RULE_EFFECTIVE_STATS · RULE_BODY_GRANTABLE_USES
                                       protocol/semantic-id.ts

## REUSED

    Inventory · RULE-INVENTORY-ADD/REMOVE-001    world/semantic/inventory.ts · rules/inventory.ts
    RULE-INVENTORY-ROOM-001                      world/rules/inventory-room.ts
    ItemDefinition · ITEM_CATALOG                world/semantic/item.ts
    RULE-DAMAGE-CALCULATE-001                    world/rules/damage-calculate.ts — **무변경**
    InventoryItemView · InventoryRoomView        protocol/gameview.ts — 형태 무변경
    AttributesView.combatStats                   protocol/gameview.ts — **한 글자도 안 바뀌었다**

## CHANGED

    RULE-BODY-USES-001            world/rules/body-uses.ts
        훑는 곳이 `actor.inventory.items` → `equippedKinds(actor.equipment)`.
        **함수 이름도 시그니처도 부르는 쪽(rules/mine.ts)도 열리지 않았다.**

    RULE-ITEM-DISCARD-001         world/rules/item-discard.ts
        `usesLostByDiscarding` 가 `ruleBodyUses` → `ruleBodyGrantableUses` 를 읽고,
        남는 용도에 걸린 것들을 더한다. 사유 코드도 판정의 자리도 그대로다.

    offenseStatValue · defenseStatValue · penetrationStatValue · defenseShape
                                  world/semantic/combat.ts
        `actor.<stat>` → `effectiveStat(actor, <stat>)`. 고르는 방식도 식도 그대로다.

    RULE-CRITICAL-STRIKE-001      world/rules/critical-strike.ts
        `attacker.criticalChance/Damage` → `effectiveStat(...)`. clamp 는 그대로.

## AFFECTED UPDATED

    RULE-MINE-001                 world/rules/mine.ts — **코드 0줄.** 같은 함수에 같은 물음
    RULE-OBSERVER-JOIN-001        world/rules/observer-body.ts — 코드 0줄.
                                  `spawnActor` 가 빈 자리를 준다 (아무것도 걸지 않은 채)
    World 초기 배치                world/index.ts — 광맥 기본값 12 → 15 (아래 NOTES ②)

## PROJECTION

    equipment                     world/projection/observer-view.ts (projectEquipment)
                                  자리 여섯 전부 · 비어 있는 자리 포함 · EQUIP_SLOTS 차례
    inventory[].actions[equip-item]
                                  같은 파일 (projectInventory) — 항목마다 하나
    equipment[].actions[unequip-item · use-item]
                                  같은 파일 — 판정은 evaluateItemUnequip · evaluateItemUse
    entities[].attributes.combatStats
                                  같은 파일 — **유효 값**. 계약의 형태 무변경
    entities[].attributes.versusObserver · defenseShape
                                  같은 파일 — 유효 값끼리 견준다
    hud self.combat.*             같은 파일 — 여덟 값 전부 유효 값

## TESTS

    world/tests/equip.spec.ts          25 tests — 이 Cycle 의 본체
        자리 여섯이 비어 실린다 · 자리에 성격 칸이 없다 · 세계가 빈 자리를 고른다
        not-equippable 은 자리 탓이 아니다 · 걸 수 있는 것은 겹치지 않는다 (IE §13.1)
        no-empty-slot · 가지고만 있으면 캐지지 않는다 · 걸면 캐고 풀면 못 캔다
        묻는 문장은 열리지 않았다 · 걸면 +12 풀면 정확히 원래 값
        **백 번 걸고 백 번 풀어도 표류하지 않는다**
        **둘을 걸면 +24, 하나만 풀면 정확히 +12** (재계산 ≠ 가감의 결정적 각본)
        밖에서 넣은 값은 기본값이다 · 물건은 한 곳에만 · 가방이 차면 못 푼다 (IE §15)
        덜어내면 풀린다 · slot-empty · unknown-slot
        걸어 둔 것이 있으면 가방의 같은 종류는 덜어낼 수 있다
        **풀어서 가방에 둔 마지막 곡괭이는 덜어낼 수 없다** (막힘이 막힌다)
        걸기·풀기는 시간을 쓰지 않는다 · 걸린 것도 쓸 수 있다
        남이 걸린 것은 오지 않는다 · 자율 존재의 값은 그대로다

    REGRESSION (기존 테스트의 갱신 — 의미가 아니라 자세가 바뀌었다)
        world/tests/drive.ts               `equipPickaxe` 헬퍼 추가.
                                           C014 의 observeFully · C017 의 selectTarget 이
                                           같은 자리에 선 것과 같은 성격이다
        mine · action · move · target · attack · observer · observer-mark ·
        world-tick · item-use · server/world-host
                                           채집 앞에 걸기를 세웠다 — 세계를 약하게 만든
                                           것이 아니라 걸기가 플레이의 한 걸음으로 들어온 것
        inventory-room.spec.ts             자리 수가 하나씩 줄었다 (곡괭이가 가방을 떠남).
                                           돌 9 → 12 에서 가득. **⌈n/한도⌉ 식은 무변경**
        view/tests/fixtures/*.json (20)    `equipment: []` 한 줄

    전체 969 tests 통과 (`npm test` — boundary:check 포함)

## NOTES

    ① Stage 3 이 답하지 않은 것 — 걸린 것을 쓰는 입구  〔Human 확인 항목〕

       C020 이 세운 플레이 하나가 "곡괭이를 **쓰면** 채집이 시작된다" 이고, 그 입구는
       소지품 항목의 `use-item` 이었다. C023 으로 곡괭이가 가방을 떠나면 그 항목이
       사라지므로, 아무것도 하지 않으면 **그 입구가 조용히 없어진다.**

       규칙 쪽은 이미 옳다 — `ruleItemUse` 는 `consumes` 만큼만 수량을 요구하고
       곡괭이는 0 이라, 걸린 곡괭이로도 그대로 성립한다. 없어지는 것은 **관찰**뿐이다.
       그래서 `EquipmentSlotView.actions` 에 `use-item` 을 실었다. 판정은 소지품 항목이
       쓰는 것과 **같은 자리**(`evaluateItemUse`)에서 나오므로 두 입구의 판정은 여전히
       하나다 (C020 이 세운 관계 그대로).

       03/04 에 이 항목이 없었다 — Stage 3 의 AFFECTED 는 "쓰기를 좁히지 않는다"
       (RATIONALE 5) 까지만 답하고 곡괭이가 목록을 떠나는 경우를 보지 못했다.
       04-gameview.spec.yaml 에 반영했다.

    ② 광맥 기본값 12 → 15  〔값 하나, 규칙 0줄〕

       걸면 곡괭이가 가방을 떠나 담을 수 있는 돌이 9 에서 12 로 늘었다. 광맥 12 로는
       가방이 차는 순간과 광맥이 마르는 순간이 겹쳐 **C022 가 세운 `no-room` 관찰이
       플레이에서 사라진다.** C022 자신이 5 → 12 를 올린 이유(RATIONALE 4 — "한도는
       세계에 캘 것이 자리보다 많을 때만 겪힌다")를 그대로 지키려고 값 하나를 옮겼다.
       가방 칸 수(4)와 겹침 한도(3)는 **건드리지 않았다.**

    ③ RULE-EFFECTIVE-STATS-001 이 `rules/` 가 아니라 `semantic/` 에 있다

       `semantic/` 은 `rules/` 를 import 하지 않는다(이 코드베이스의 계층). 그런데
       `offenseStatValue` · `rawDamage` · `defenseShape` 가 **semantic 안에서** 유효 값을
       읽어야 한다. 순수 파생이고 상태를 바꾸지 않으므로 `semantic/combat.ts` 에 두었다.
       C022 의 `ruleInventoryRoom` 이 `rules/` 에 있는 것은 그것을 읽는 쪽이 rules ·
       projection 뿐이기 때문이며, 같은 성격의 판정이 읽는 쪽에 따라 자리를 달리한 것이다.
       Rule ID 는 주석으로 남겼다 (Traceability).

    ④ 유효 값을 저장하지 않는 비용

       `effectiveStat` 은 부를 때마다 걸린 것들을 훑는다. 자리 수(6)가 고정이므로 상수다.
       한 타격의 피해 계산에서 여러 번 불리지만, 그 대가로 **"표류하지 않는다" 가 검사가
       아니라 구조**가 된다 (03 RATIONALE 1). 백 번 걸고 푸는 시험이 이것을 확인한다.

    ⑤ 도달하지 않은 두 가지 — 값으로만 확인했다

       전용 자리(`Equip.Targets`)를 선언한 물건이 세계에 없다. 규칙(`slotFits`)은 서
       있고 단위 시험이 `targets` 가 없음을 확인한다. 그런 물건이 생겨도 사유 코드는
       늘지 않는다 — 요구한 자리가 다 차면 `no-empty-slot` 이다.
       곡괭이 두 자루를 얻는 경로도 세계에 없다 (광맥은 돌만 낸다). 규칙은 허용하며,
       `actorItems` 로 세운 시험이 재계산의 결정적 각본을 확인한다.
