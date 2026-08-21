# C023 — World Semantic

> 세계에 **적용**이라는 자리가 생긴다. 몸이 자리들을 지니고, 자리가 물건을 직접 담고,
> 담긴 것만이 몸의 값과 할 수 있는 일을 바꾼다. 유효 값은 저장하지 않는다 —
> C022 가 자리를 세지 않고 계산했듯, 이 Cycle 도 몸의 값을 쌓지 않고 다시 세운다.

## SEMANTIC DELTA

    REUSED

        Actor.Inventory                     C001 · C020 — 걸기가 여기서 빼고 풀기가 여기 넣는다
        ItemDefinition                      C020 — 적용에 관한 것도 이 정의가 답한다
        ItemDefinition.Uses                 C020 — **형태 그대로.** 읽는 쪽만 바뀐다
        RULE-INVENTORY-ADD-001              C020 — 푸는 것이 이 통로로 들어온다
        RULE-INVENTORY-REMOVE-001           C020 — 거는 것이 이 통로로 나간다
        RULE-INVENTORY-ROOM-001             C022 — 푸는 쪽이 "받을 자리가 있는가" 를 묻는다
        World.InventoryCapacity             C022 — 값 4. **이 Cycle 은 이 값을 바꾸지 않는다**
        Actor 전투 능력치 여덟               C010 · C012 · C013 · C015 — 이제 **기본값**이다
        RULE-DAMAGE-CALCULATE-001           공식은 한 글자도 열리지 않는다
        InventoryItemView                   C020 · C022 — 항목에 걸기 행동이 는다
        InventoryRoomView                   C022 — 그대로. 걸린 것은 애초에 세어지지 않는다
        AttributesView.combatStats          C010~C015 — **싣는 값이 유효 값이 된다.**
                                            계약의 형태는 한 글자도 바뀌지 않는다

    ADDED

        World.EquipSlots                    적용 자리의 id 목록 — **이름만 지닌다**
        ItemDefinition.Equip                걸 수 있는 물건임을 밝히는 자리.
                                            **없으면 걸 수 없다**
        ItemDefinition.Equip.Targets        전용 자리 — **비면 제한이 없다** (어느 자리에나).
                                            지금 이것을 선언하는 물건은 하나도 없다
        ItemDefinition.Equip.Contributions  걸린 동안 몸의 값에 보태는 것. 없을 수 있다
        Actor.Equipment                     자리별로 담긴 종류. 없는 자리는 비어 있다
        Actor.EffectiveStats                **파생** — 저장하지 않는다
        RULE-ITEM-EQUIP-001                 건다
        RULE-ITEM-UNEQUIP-001               푼다
        RULE-EFFECTIVE-STATS-001            유효 값을 다시 센다
        RULE-BODY-GRANTABLE-USES-001        이 몸이 **지닐 수 있는** 용도 — 막힘 판정 전용
        EquipmentSlotView                   자리 관찰
        ActionRequest.EquipSlotId           **푸는 요청에만 실린다** — 어느 자리를
                                            푸는가. 거는 요청은 자리를 싣지 않는다

    CHANGED

        RULE-BODY-USES-001
            NEW SOURCE      Uses = ⋃ { 정의(Equipment[slot]).Uses | slot ∈ EquipSlots }
            OLD SOURCE      Uses = ⋃ { 정의(kind).Uses | Items[kind] > 0 }
            **묻는 문장도 부르는 쪽도 열리지 않는다.** 훑는 곳만 바뀐다

        RULE-ITEM-DISCARD-001
            NEW PRECONDITION 3   덜어내면 **지닐 수 있는 용도** 중 세계가 되돌려줄 수
                                 없는 것이 하나도 없다 (no-way-back)
            OLD PRECONDITION 3   덜어내면 **지금 있는 용도** 중 …
            사유 코드도 판정의 자리도 그대로다. **보는 범위**가 가방에서 가방과 자리
            양쪽으로 넓어진다 (RATIONALE 3)

        offenseStatValue · defenseStatValue · penetrationStatValue · Critical 읽는 자리
            NEW SOURCE      유효 값
            OLD SOURCE      Actor 에 저장된 값
            **고르는 방식도 공식도 그대로다.** 아무것도 걸지 않은 몸에서 두 값은 같다

    AFFECTED

        RULE-MINE-001                   곡괭이를 걸어야 캐진다. 코드는 열리지 않는다 —
                                        같은 함수에 같은 물음을 한다
        RULE-ATTRIBUTE-SET-001          밖에서 넣는 값은 **기본값**이다.
                                        관찰에 나가는 것은 유효 값이므로 걸린 것이
                                        있으면 넣은 수와 보이는 수가 다르다
        RULE-ITEM-USE-001               **좁히지 않는다.** 가방의 돌은 걸지 않아도
                                        그대로 던져진다 (RATIONALE 5)
        RULE-OBSERVER-JOIN-001          초기 소지품 — 곡괭이를 **걸지 않은 채** 준다
        RULE-CRITICAL-STRIKE-001        유효 값을 읽는다. 지금은 기여가 없어 결과가 같다
        RULE-GUARD-*                    막기는 능력치를 읽지 않는다 — 무관

## WORLD STATE

    World.EquipSlots                           World Authority · 고정
        자리 id 의 목록 (E1 … E6). **자리는 이름과 차례만 지닌다** —
        받는 성격도, 전용 용도도, 서로 다른 무엇도 지니지 않는다.
        여섯은 서로 완전히 같으므로 **어디에 걸리는지는 선택이 아니다** (RATIONALE 9)

    ItemDefinition                             World Authority · 고정 (C020 REUSED)
        Equip            **있으면 걸 수 있는 물건이다.** 없으면 걸 수 없다
            Targets      전용 자리들. **비어 있으면 제한이 없다** — 어느 자리에나 걸린다.
                         제한은 물건이 선언할 때만 생기는 **예외**이며,
                         지금 이것을 선언하는 물건은 세계에 하나도 없다 (IE §10 · §11)
            Contributions 걸린 동안 몸의 값에 보태는 것. 없을 수 있다
        Uses             (REUSED · 형태 무변경) 걸린 동안 몸에 주는 용도들

    Actor.Equipment                            World Authority
        SlotId → ItemKind        담긴 것이 없는 자리는 항목이 없다
        **개체가 아니라 종류를 담는다** — 같은 종류 둘을 구분할 이유가 아직 없다
        (DC-GROWTH-DEFINITION-INSTANCE-SPLIT · IE §13.1)

    Actor.EffectiveStats                       World Authority · **파생 (저장하지 않는다)**
        여덟 전투 능력치의 유효 값.
        Actor 에 저장된 여덟 값은 이제 **기본값**이라는 뜻을 가진다 — 이름은 그대로다

    변경 권한

        Actor.Equipment       RULE-ITEM-EQUIP-001 · RULE-ITEM-UNEQUIP-001 뿐
        Actor.Inventory       RULE-INVENTORY-ADD/REMOVE-001 뿐 (C020 무변경) —
                              걸기·풀기도 그 통로를 지난다. 두 번째 통로를 파지 않는다
        Actor.EffectiveStats  누구도 바꾸지 않는다. 계산이 낳는다

## WORLD RULE

    RULE-EQUIP-SLOT-FITS-001
        Implements     INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001
        Input          SlotId, ItemDefinition
        Preconditions  없음 — 언제나 답할 수 있다
        Transition     없음 (읽기 판정)
        Result         Equip.Targets 가 비어 있으면 참 (제한 없음)
                       비어 있지 않으면 SlotId ∈ Equip.Targets
        Note           **자리는 아무것도 묻지 않는다.** 묻는 것은 물건의 정의뿐이며,
                       그것도 스스로 제한을 선언했을 때만이다. 기본은 제한 없음이다.
                       종류 이름은 이 식에 없다.

                       **지금 세계에서 이 규칙은 언제나 참을 낸다** — 제한을 선언한
                       물건이 하나도 없기 때문이다. 그 물건이 생기는 날 이 규칙도
                       그것을 읽는 곳도 열리지 않는다. 정의에 줄이 하나 늘 뿐이다

    RULE-EFFECTIVE-STATS-001
        Implements     INTENT-EFFECTIVE-IS-RECOMPUTED-NOT-ACCUMULATED-001 ·
                       INTENT-CONTRIBUTION-COMES-FROM-THE-DEFINITION-001
        Input          Actor
        Preconditions  없음 — 언제나 답할 수 있다
        Transition     없음 (읽기 판정)
        Result         Effective[s] = Base[s] + Σ_{slot ∈ Equipment}
                                                정의(Equipment[slot]).Contributions[s]
        Note           **저장하지 않는다.** 저장하면 Equipment 와 EffectiveStats 라는
                       두 개의 진실이 생기고 둘을 맞추는 책임이 모든 변경 지점에
                       흩어진다 — C022 가 UsedSlots 에 대해 판정한 것과 같은 사정이다.
                       세는 비용은 자리 수에 비례하고 자리 수는 고정이므로 상수다.
                       그리고 이 형태에서만 "백 번 걸고 백 번 풀어도 표류하지 않는다" 가
                       검사가 아니라 **구조**로 성립한다

    RULE-BODY-USES-001 (CHANGED)
        Implements     INTENT-CAPABILITY-FROM-DECLARED-USE-001 (CHANGED) ·
                       INTENT-ONLY-THE-APPLIED-GIVES-001
        Input          Actor
        Preconditions  없음
        Transition     없음 (읽기 판정)
        Result         Uses = ⋃ { 정의(Equipment[slot]).Uses | slot ∈ Equipment }
        Note           묻는 쪽(RULE-MINE-001)은 열리지 않는다

    RULE-BODY-GRANTABLE-USES-001 (ADDED)
        Implements     INTENT-NO-SELF-INFLICTED-DEAD-END-001 (CHANGED)
        Input          Actor
        Preconditions  없음
        Transition     없음 (읽기 판정)
        Result         Grantable = ⋃ { 정의(k).Uses | k ∈ Items ∪ Equipment 의 값 }
        Note           **지금 있는 용도가 아니라 지닐 수 있는 용도다.** 둘을 가르지
                       않으면 막힘 판정이 무너진다 (RATIONALE 3)

    RULE-ITEM-EQUIP-001
        Implements     INTENT-APPLY-ITEM-001 · INTENT-FITNESS-COMES-FROM-THE-DEFINITION-001 ·
                       INTENT-APPLY-NEEDS-AN-EMPTY-PLACE-001 ·
                       INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001
        Input          Actor, ItemKind
        Preconditions  1. 그 종류의 정의가 있다                       (unknown-item)
                       2. Items[kind] > 0                            (not-enough)
                       3. 정의에 Equip 이 있다                        (not-equippable)
                       4. RULE-EQUIP-SLOT-FITS-001 이 참인 **빈 자리**가
                          하나 이상 있다                              (no-empty-slot)
        Transition     Slot = 조건을 만족하는 빈 자리 중 차례가 가장 앞선 것
                       RULE-INVENTORY-REMOVE-001(kind, 1)
                       Equipment[Slot] = kind
        Result         Success | Failure(reason)
        Note           **요청은 자리를 싣지 않는다.** 여섯 자리가 서로 완전히 같으므로
                       어디에 걸리는지는 고를 것이 아니다 — 세계가 고른다
                       (IE §20 "우선순위는 [WORLD]" · RATIONALE 9).

                       **같은 종류를 여러 자리에 걸 수 있다.** 소지 제한이 없다는 것이
                       그 뜻이다 (RATIONALE 10). 그때 용도는 겹쳐도 하나지만
                       기여는 자리마다 더해진다.

                       둘은 **하나의 성공 단위**다. 앞의 넷이 전부 참일 때만 둘 다
                       일어난다 — 하나만 일어나는 순간이 없다.
                       **시간을 쓰지 않는다.** 행동 얼개를 지나지 않고 하던 행동을
                       끊지도 않는다 (RATIONALE 6)

    RULE-ITEM-UNEQUIP-001
        Implements     INTENT-RELEASE-ITEM-001 · INTENT-RELEASE-ASKS-FOR-ROOM-001 ·
                       INTENT-A-THING-IS-IN-EXACTLY-ONE-PLACE-001
        Input          Actor, SlotId
        Preconditions  1. 그 자리가 세계에 있다                        (unknown-slot)
                       2. Equipment[slot] 이 비어 있지 않다            (slot-empty)
                       3. 그 종류 하나를 담을 자리가 있다               (no-room)
                          — RULE-INVENTORY-ROOM-001 이 판정한다
        Transition     Equipment.delete(slot)
                       RULE-INVENTORY-ADD-001(kind, 1)
        Result         Success | Failure(reason)
        Note           세계는 풀린 물건을 바닥에 떨어뜨리지 않는다 — 그럴 자리가
                       세계에 없기도 하고(IS §6 Cycle 4), 의도하지 않은 잃음을
                       만들지 않기 위해서이기도 하다 (IE §15)

    RULE-ITEM-DISCARD-001 (CHANGED)
        Implements     INTENT-DISCARD-ITEM-001 · INTENT-NO-SELF-INFLICTED-DEAD-END-001
        Preconditions  3. 덜어내면 **지닐 수 있는 용도**(RULE-BODY-GRANTABLE-USES-001)
                          중 세계가 되돌려줄 수 없는 것이 하나도 없다   (no-way-back)
        Note           **걸린 것은 이 규칙의 대상이 아니다** — 덜어내기는 가방에서
                       일어난다. 걸린 것을 놓으려면 먼저 풀어야 한다

## OBSERVABLE SEMANTIC

    EquipmentSlotView[]                 (ADDED · 자기 몸에만 실린다)
        slotId              자리의 의미 코드 — 표시 이름은 View 책임.
                            **성격도 전용 용도도 실리지 않는다** — 자리에 그런 것이 없다
        item?               담긴 것 — kind · category · origin?. 비었으면 없다
        grants              담긴 것이 지금 주는 용도들. 비었으면 빈 목록
        contributions       담긴 것이 지금 보태는 값들 — { name, value }[]
        actions             [ unequip-item ] — available + unavailableReason

        **비어 있는 자리도 전부 실린다.** 비었다는 것이 관찰의 내용이다.
        차례는 EquipSlotDefinition.Order 이므로 같은 세계 상태면 같은 순서다.

    InventoryItemView.actions           (CHANGED — equip-item 이 는다)
        각 항목에 equip-item 이 **하나** 실린다. 자리를 고르는 자리가 없기 때문이다.
        available 과 unavailableReason 은 RULE-ITEM-EQUIP-001 의 판정과 **같은 자리**에서
        나온다 — 화면에 불가로 보이는 것을 억지로 요청해도 같은 사유로 거절된다.
        걸릴 수 없는 물건에는 not-equippable 이 실린다.

    AttributesView.combatStats          (CHANGED — 값이 유효 값이 된다)
        계약의 형태는 한 글자도 바뀌지 않는다. 여덟 값이 그대로 실리고,
        **그 값이 이제 걸린 것을 반영한 값**이다.
        남의 것이 살펴본 뒤에 열리는 것도(C014) 그대로다 —
        걸린 것이 남의 겨루는 힘을 바꾸므로 유효 값이 그 관문 뒤에 있는 것이 옳다.

    관찰하지 않는 것

        기본값                    싣지 않는다. 세계의 권위는 유효 값 하나이며, 둘을 다
                                 실으면 화면이 어느 쪽을 쓸지 고를 수 있게 된다.
                                 무엇이 얼마를 보태는지는 자리의 contributions 가 답한다
        가방 항목의 기여           **싣지 않는다.** 걸지 않은 것이 무엇을 줄지 보여 주는
                                 것은 미리보기이며 후보 4 의 일이다 (01-cycle.md EXCLUDED)
        걸린 것이 쓰는 자리        **없다.** 걸린 것은 가방에서 빠지므로 셀 것이 없다

    Observable Closure

        걸 수 있는가 / 왜 안 되는가        InventoryItemView.actions[equip-item]
        풀 수 있는가 / 왜 안 되는가        EquipmentSlotView.actions[unequip-item]
        무엇이 걸려 있는가                EquipmentSlotView.item
        걸린 것이 무엇을 주는가            EquipmentSlotView.grants · contributions
        몸의 값이 어떻게 되었는가          AttributesView.combatStats (유효 값)
        캘 수 있는가 / 왜 안 되는가        InteractionView(mine) — C001 무변경.
                                        곡괭이를 걸지 않으면 기존 사유 그대로 불가다
        가방이 얼마나 찼는가              InventoryRoomView — C022 무변경

## BALANCE

    World.EquipSlots               6      E1 … E6. **여섯이 서로 완전히 같다**
    pickaxe.Equip                  있다   → 걸 수 있다
    pickaxe.Equip.Targets          (없음) → **제한 없음.** 여섯 어느 자리에나 걸린다
    pickaxe.Equip.Contributions    physicalAttack +12
    stone.Equip                    (없음) → 걸 수 없다
    World.InventoryCapacity        4      **C022 의 값 — 바꾸지 않는다**

    이 값들이 만드는 플레이

        시작        곡괭이 1 → 가방 1 / 4 · 자리 여섯 다 비었다.
                    **캘 수 없다** — 가지고만 있기 때문이다
        건다        곡괭이 → 세계가 E1 을 고른다. 가방 0 / 4 ·
                    물리 공격 40 → 52. 기본 기술의 raw 26 → 32. 이제 캘 수 있다
        돌을        stone 은 not-equippable — 걸 수 있는 물건이 아니다.
                    **자리 탓이 아니다** — 어느 자리에 물어도 같은 답이다
        캔다        4 자리 × 3 = 돌 12 개까지 → 가방 4 / 4
        풀 수 없다   가득 찬 가방에서 곡괭이를 풀면 no-room (IE §15).
                    **자리 둘이 처음 만나는 자리다**
        덜어낸다     돌 전부 → 가방 0 / 4. 이제 풀린다
        푼다        물리 공격 52 → **정확히 40**. 캘 수 없게 된다
        막히지 않는다 곡괭이를 풀어 가방에 두고 덜어내려 하면 no-way-back —
                    C022 의 판정이 자리까지 보게 되어 그대로 산다

    **네 값 어느 것을 바꿔도 규칙 코드는 한 줄도 열리지 않는다.**
    자리를 여섯에서 셋으로 줄이는 것도, 곡괭이가 보태는 값을 바꾸는 것도,
    전용 자리를 선언하는 물건을 세우는 것도 값이나 정의가 달라지는 일이다.
    이것이 Stage 8 의 검증 항목이다.

    지금 세계에서 도달할 수 없는 것 두 가지

        전용 자리 판정      RULE-EQUIP-SLOT-FITS-001 이 언제나 참을 낸다 — 전용 자리를
                           선언한 물건이 하나도 없기 때문이다. 규칙은 서고,
                           단위 시험이 값으로만 확인한다. **사유 코드는 늘지 않는다** —
                           그런 물건이 생겨도 요구한 자리가 다 차면 no-empty-slot 이다
        같은 종류 여럿 걸기  곡괭이를 두 자루 지닐 경로가 세계에 없다
                           (광맥은 돌만 낸다). 규칙은 허용하며 단위 시험이 확인한다 —
                           **두 자루를 걸면 +24, 하나만 풀면 정확히 +12** 가
                           "재계산이지 가감이 아니다" 의 가장 강한 관찰이다

## RATIONALE

    1. 유효 값을 저장하지 않는 이유
       저장하면 Equipment 와 EffectiveStats 라는 두 개의 진실이 생기고, 둘을 맞추는
       책임이 모든 변경 지점으로 흩어진다. 그리고 "걸고 풀기를 반복해도 표류하지
       않는다" 를 **검사로 지켜야** 한다. 파생으로 두면 그 문장이 구조에서 나온다 —
       기본값에서 다시 세우므로 표류할 자리가 없다. C022 가 UsedSlots 에 대해 내린
       것과 같은 판정이다.

    2. 자리가 종류를 담고 개체를 담지 않는 이유
       같은 곡괭이 두 자루를 구분할 이유가 아직 없다 — 하나는 자리에 있고 하나는
       가방에 있으며 그 차이가 위치뿐이다 (IE §13.1 · IS §2.1).
       내구도·강화가 오면 그때 개체가 서고, 이 구조는 그대로다.

    3. 지금 있는 용도와 지닐 수 있는 용도를 가르는 이유
       **가르지 않으면 막힘 판정이 무너진다.** 용도가 걸린 것에서만 오면, 가방의
       곡괭이를 덜어내는 일은 "지금 있는 용도" 를 하나도 잃지 않는다 — 아무것도
       걸지 않았다면 애초에 잃을 것이 없기 때문이다. 그래서 곡괭이를 풀어 가방에 두고
       덜어내는 순간 세계에서 채굴이 영영 사라진다.
       C022 가 세운 문장("되돌릴 수 없는 막힘을 스스로 만들 수 없다")을 지키려면
       그 판정이 **몸이 지닐 수 있는 것 전부**를 보아야 한다.

    4. 자리를 몸이 아니라 세계가 지니는 이유
       C022 가 가방에 대해 내린 판정과 같다. 지금 모든 몸의 자리가 같고, 몸마다
       다른 자리를 지니는 것은 자리 잠금·해금의 의미이며 01-cycle.md 가 EXCLUDED 로
       두었다 (IE §40). 담긴 것은 몸이 지니고, 자리의 정의는 세계가 지닌다.

    9. 자리가 이름만 지니고, 어디에 걸릴지를 세계가 고르는 이유
       여섯 자리가 서로 완전히 같으므로 **고를 것이 없다.** 고르게 하면 화면에
       의미 없는 결정을 하나 만들고, 그 결정을 계약에 실어야 하며, 세계는 그것을
       받아 아무 차이도 내지 않는 일을 한다. 자리에 성격이 생기는 것은 그것을
       요구하는 물건이 나타날 때이고, 그때도 성격은 **물건이 선언한다**
       (IE §10 · §11 — 제한은 예외이지 기본이 아니다).
       고르는 자리를 없애면 요청도 계약도 관찰도 한 겹 얇아진다.

   10. 같은 종류를 여러 자리에 걸 수 있게 두는 이유
       막을 근거가 없다. 제한은 물건이 선언할 때만 생기며, 어떤 물건도 "나는 한 번만
       걸린다" 를 말하지 않는다. 막으려면 규칙이 종류를 세어야 하고, 그것이 정확히
       DC-ITEM-KIND-IS-DATA-NOT-BRANCH 가 없애려던 형태다.
       그리고 이 허용이 재계산의 가장 강한 관찰을 만든다 — 둘을 걸면 기여가 두 번
       더해지고, 하나만 풀면 정확히 한 번어치가 남는다. 가감으로 구현했다면
       그 각본에서 반드시 어긋난다.

    5. 쓰기의 대상을 좁히지 않는 이유
       "걸어야 쓸 수 있다" 로 넓히면 C020 이 세운 플레이(가방의 돌을 던진다)가
       이유 없이 사라진다. 그리고 IS §5.4 가 나눈 것은 **적용과 소지**이지
       적용과 사용이 아니다 — 소비 아이템은 걸지 않고 쓰는 것이 그 정의다.
       이 Cycle 이 옮기는 것은 **용도(Uses)의 출처** 하나다.

    6. 걸기와 풀기가 시간을 쓰지 않는 이유
       C022 의 덜어내기와 같은 사정이다. 푸는 것은 가방을 비우는 일과 나란히
       **막힘의 출구**이므로 그 자신이 끊겨 막힐 수 있어서는 안 된다.
       전투 중 장비 교체의 대가는 이 층이 아니라 그것을 요구하는 Possibility 가
       설 때의 일이다.

    7. 초기 곡괭이를 걸지 않은 채로 주는 이유
       이 Cycle 이 보여 주려는 첫 문장이 "가지고만 있으면 캐지지 않는다" 이기 때문이다.
       걸린 채로 시작하면 그 문장을 플레이로 볼 수 없다. 그리고 막힘이 아니다 —
       언제든 걸 수 있다.

    8. combatStats 계약을 늘리지 않는 이유
       유효 값과 기본값을 둘 다 실으면 화면이 어느 쪽을 그릴지 고를 수 있게 되고,
       그 순간 세계의 권위가 둘이 된다. 무엇이 얼마를 보태는지는 자리의
       contributions 가 이미 답하므로 기본값이 없어도 경위를 읽을 수 있다.

## JUDGEMENT — Human 확인이 필요한 판단

    ① 자리 여섯은 이 세계의 가방(4칸)보다 많다 — IE §10 의 비(比)와 어긋난다
       IE §10 이 소유하는 규칙 하나는 "**자리 수가 소지 칸 수보다 훨씬 적다**"
       (30 : 6) 이고, 그 좁음이 "무엇을 걸어 둘까" 를 비용 있는 선택으로 만든다.
       이 세계의 가방은 C022 가 플레이로 맞춘 4칸이라 6 : 4 로 **뒤집힌다.**

       지금은 겪히지 않는다 — 걸 수 있는 물건이 세계에 곡괭이 하나뿐이라 자리가
       여섯이든 하나든 플레이가 같다. 겪히기 시작하는 것은 걸 수 있는 종류가
       자리 수를 넘을 때이고, 그날 값 하나(자리 수 또는 가방 칸 수)가 움직이면 된다.
       **규칙 코드는 그날에도 열리지 않는다.**
       그때까지 어느 쪽을 움직일지는 Human 판단이다 (가방을 늘릴지, 자리를 줄일지).

    ② 걸 수 있는가는 정의가 Equip 을 지니는가로만 답한다
       돌이 걸리지 않는 이유는 "자리가 안 받아서" 가 아니라 **걸 수 있는 물건이
       아니어서**다. 어느 자리에 물어도 같은 답이 나온다.
       IE §13.1 은 여기에 하나를 더 요구한다 — 겹칠 수 있는 물건은 자리에 들어가지
       않는다 (자리 하나에 수량 여럿이라는 상태를 만들지 않기 위해). 이 Cycle 은
       그것을 **불변 조건**으로 두고 정의소에서 확인한다: Equip 을 지닌 물건은
       StackLimit 이 1 이어야 한다. 지금 곡괭이가 그렇다.

    ③ 곡괭이가 물리 공격을 보탠다
       IE §12 의 예시가 그대로 곡괭이 Attack +3 (기본 10 의 +30%) 이다. 이 세계의
       기본값 40 에 같은 비율을 적용해 +12 로 두었다. 이 하나로 **용도와 값 둘 다**
       관찰되므로 새 장비 종류를 세우지 않아도 된다.
       곡괭이가 무기가 되는 것은 아니다 — 기본 기술의 raw 가 26 에서 32 로 오를 뿐이다.

    ④ 이 Cycle 은 MC-ATTACK-POWER 의 결손 하나를 함께 연다
       overlay.md 는 그 노드를 "세계 안에서 이 값을 올릴 방법이 없다" 로 PARTIAL 에
       두었다. 곡괭이를 거는 것이 그 첫 경로다. 노렸던 것이 아니라 따라온 것이므로
       **Master 보고 항목**이다 (08-verification.md MASTER FEEDBACK).

## SEMANTIC CLOSURE

    "몸에 유한한 적용 자리가 있다"          → World.EquipSlots · Actor.Equipment
    "자리의 수와 이름은 값이다"             → World.EquipSlots (규칙에 이름이 없다)
    "적합성을 정의가 답한다"                → RULE-EQUIP-SLOT-FITS-001
                                            (제한은 물건만이 선언한다)
    "걸린 것만이 몸을 바꾼다"               → RULE-BODY-USES-001(CHANGED) ·
                                            RULE-EFFECTIVE-STATS-001
    "물음은 그대로, 답의 출처만 바뀐다"      → RULE-BODY-USES-001 의 NEW SOURCE
    "기본값과 유효 값이 갈린다"             → Actor 저장값 = 기본값 ·
                                            Actor.EffectiveStats = 파생
    "가감이 아니라 재계산이다"              → RULE-EFFECTIVE-STATS-001 (저장하지 않는다)
    "기여를 정의가 답한다"                  → ItemDefinition.Equip.Contributions
    "모든 판정이 유효 값을 읽는다"           → offense/defense/penetration/critical 읽는
                                            자리 전부 CHANGED
    "건다 — 하나의 성공 단위"               → RULE-ITEM-EQUIP-001 Precondition 4 + Transition
    "빈 자리를 요구한다"                    → RULE-ITEM-EQUIP-001 Precondition 4 (no-empty-slot)
    "푼다 — 값도 용도도 함께 사라진다"       → RULE-ITEM-UNEQUIP-001 Transition
                                            (둘 다 파생이므로 자동으로 함께 사라진다)
    "푸는 데 받을 자리가 필요하다"           → RULE-ITEM-UNEQUIP-001 Precondition 3 (no-room)
    "물건은 정확히 한 곳에 있다"             → Equipment 가 종류를 직접 담는다 ·
                                            Transition 이 Inventory 통로를 지난다
    "표류하지 않는다"                       → 유효 값이 파생이라 표류할 자리가 없다
    "되돌릴 수 없는 막힘이 없다"             → RULE-BODY-GRANTABLE-USES-001 +
                                            RULE-ITEM-DISCARD-001 Precondition 3
    "무엇이 걸렸는지 보인다"                → EquipmentSlotView
    "안 되는 것은 왜 안 되는지 온다"         → equip-item / unequip-item 의
                                            unavailableReason (실행과 같은 판정)
    "화면이 아무것도 판정하지 않는다"        → 모든 available/reason 이 세계 판정에서 온다
    "유효 값이 보인다"                      → AttributesView.combatStats

    남은 문장 없음 — Closure 통과.
