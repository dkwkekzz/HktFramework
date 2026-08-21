# CYCLE C023 — What You Wear Changes You

[PASS] Cycle Definition           (적용이라는 개념 전부 · 걸기와 풀기는 한 몸 · 값은 Stage 3)
[PASS] Intent                     (적용 자리 · 적합성 · 원자성 · 재계산 · 출처 이전 · 관찰)
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-WHAT-YOU-WEAR-CHANGES-YOU — 걸어 둔 것만이 몸을 바꾼다
                        (`master/frontier.md` 후보 2 · 레인 A)
                        Human 이 2026-08-21 에 골랐다 — 레인 A 의 순서에서 후보 1(C022)
                        다음 칸이며, 그 앞칸은 Stage 8 실측이 끝나 있다

    Source Goal         MG-EXPLORE-BEIRA
                        베이라를 더 깊이 감당한다 — 지금 닿지 못하는 곳에 닿는다

    Source Possibility  MP-ADAPT-BY-RESOURCE
                        "자원으로 감당한다 — 물건이 대신해 주고, 물건을 잃으면 도로
                         못 하게 된다" (BW §17). **그 되돌아옴을 소유하는 자리다** —
                        지금 세계는 물건을 잃어도 도로 못 하게 되지 않는다.
                        가지고만 있으면 되기 때문이다

    Target Capability   MC-EQUIP-ITEM        (overlay: **MISSING**)
                        이 Cycle 이 닫으면 **PARTIAL** 이 된다. 남는 절반은 후보 3
                        (한 자리에는 하나 — 교체와 가득 찬 상태의 비대칭)이 닫는다.
                        그 노드의 world_shape 이 교체까지 요구하기 때문이다

    Reused Capability   MC-USE-ITEM              (overlay: IMPLEMENTED — C020)
                        자리의 유한함                (C022 — 칸 · 가득 참 · 덜어내기)
                        정의소 · 변경 단일 통로       (C020 — semantic/item.ts ·
                                                     rules/inventory.ts)
                        전투 능력치 계산              (C010 · C012 · C013 · C015)

    Active Constraints  DC-ITEM-HOLDING-IS-NOT-APPLYING           (**이 Cycle 의 중심**)
                        DC-ITEM-CAPABILITY-COMES-FROM-GRANTS
                        DC-ITEM-LIVES-IN-ONE-PLACE
                        DC-ITEM-CHANGE-IS-ONE-UNIT
                        DC-ITEM-KIND-IS-DATA-NOT-BRANCH
                        DC-ITEM-CAPACITY-IS-FINITE
                        DC-WORLD-OWNS-THE-SURFACE-LIST                     (GLOBAL)
                        DC-GROWTH-DEFINITION-INSTANCE-SPLIT
                        DC-COMBAT-ONE-FORMULA 는 대상이 아니다 —
                            피해 공식을 한 글자도 고치지 않는다. 공식이 **읽는 값의
                            출처**만 바뀐다 (아래 SCOPE NOTE ③)

    Constraint Note

        DC-ITEM-HOLDING-IS-NOT-APPLYING — 위반이 아니라 위반의 해소다
            **지금 세계가 이 원칙을 어기고 있다.** 곡괭이를 가지고만 있어도 캐진다
            (`world/rules/body-uses.ts` — 소지품을 훑어 용도를 모은다).
            C020 이 그 판정을 **한 자리로 모아** 두었으므로, 이 Cycle 은 새 판정을
            만드는 것이 아니라 그 한 자리가 **무엇을 훑는지**를 바꾼다.
            소지 → 적용. 규칙을 부르는 쪽(`rules/mine.ts`)은 열리지 않는다

        DC-ITEM-CAPABILITY-COMES-FROM-GRANTS
            무엇이 어느 자리에 들어가고 무엇을 주는지를 **정의가 답한다.**
            규칙은 종류 이름을 묻지 않는다. 그러므로 두 번째 장비가 생기는 일은
            정의소에 항목이 하나 느는 일이며, 걸기 규칙도 관찰 계약도 열리지 않는다

        DC-ITEM-LIVES-IN-ONE-PLACE
            **자리가 물건을 직접 담는다** (IE §13.1). 걸린 것은 소지품에서 빠지고
            자리에 있다. 소지품에도 있고 자리에도 있는 상태를 만들지 않는다 —
            두 곳에 적힌 하나의 진실은 반드시 어긋난다.
            그래서 푸는 데에는 담을 자리가 필요하다 (IE §15)

        DC-ITEM-CHANGE-IS-ONE-UNIT
            걸기도 풀기도 전량 성공 또는 전량 실패다. 실패한 요청은 자리도 값도
            수량도 건드리지 않는다 (IE §12 · §14 · Invariant 5).
            C020 이 사용 쪽에서, C022 가 획득·덜어내기 쪽에서 이미 세운 형태를
            적용 쪽으로 넓히는 일이다

        DC-ITEM-KIND-IS-DATA-NOT-BRANCH
            적합성 판정에 종류 이름이 나오지 않는다. 자리의 수·이름도 값이며
            **그 값은 Stage 3 이 소유한다** — 규칙에 박지 않는다

        DC-ITEM-CAPACITY-IS-FINITE
            C022 가 세운 칸을 그대로 쓴다. 적용 자리는 그 칸보다 **훨씬 좁고**
            (IE §49 P3), 그 좁음이 "무엇을 걸어 둘까" 를 선택으로 만든다.
            푸는 것이 담을 칸을 요구하므로 두 유한함이 여기서 처음 만난다

        DC-WORLD-OWNS-THE-SURFACE-LIST
            지금 무엇이 걸려 있는가 · 무엇을 걸 수 있는가 · 안 되는 것은 왜 안 되는가를
            **세계가 판정해 싣는다** (IE §28 · §29). View 가 "이건 여기 들어가나" 를
            자기 코드에서 계산하지 않는다

        DC-GROWTH-DEFINITION-INSTANCE-SPLIT
            개체(Instance)를 만들지 않는다. 자리에 담기는 것은 **종류와 수량**이지
            개체가 아니다 — 같은 종류끼리 상태가 달라져야 할 이유가 아직 없다
            (IS §2.1 · IE §41). 내구도 · 강화 · 각인은 이 Cycle 에 없다

## SCOPE NOTE — 코드로 다시 대조한 것

### ① 없는 것은 적용 자체다 — 앞칸은 전부 서 있다

    코드 대조로 확인했다. `equip` · `slot` 이라는 말이 `world/` `protocol/` 에 0건이다.

        world/semantic/item.ts        정의의 단일 출처 — 분류 · 용도 · 위력 · 사용 ·
                                      겹침 한도를 이미 지닌다. **적용 자리와 기여만 없다**
        world/rules/body-uses.ts      "이 몸에 그 용도가 지금 있는가" 를 **이미 한 자리에서
                                      묻는다.** 이 Cycle 은 그 답의 출처만 바꾼다
        world/rules/inventory.ts      수량 변경의 단일 통로 — 걸기/풀기가 이 통로를 지난다
        world/rules/inventory-room.ts 자리를 세는 유일한 자리 — 푸는 쪽이 이것을 묻는다
        protocol/gameview.ts          `InventoryItemView[]` — 항목별 가능/사유가 이미 실린다

    그러므로 이 Cycle 에 남은 것은 **넷**이다: 적용 자리 · 적합성 · 걸기/풀기의
    원자성 · 유효 값의 재계산. 그리고 그 넷이 닿는 곳 하나 — 용도의 출처 이전.

### ② 몸에는 기본값과 유효 값의 구분이 없다

    `world/semantic/actor.ts` 는 `physicalAttack` 을 **값 하나**로 지닌다. 열 개 남짓의
    능력치가 전부 그렇다. 걸린 것이 값을 바꾸려면 그 하나가 둘로 갈려야 한다.

        기본값     그 몸이 아무것도 걸지 않았을 때의 값. 종류 카탈로그가 정한다
        유효 값    기본값과 **지금 걸린 것들의 기여**로 다시 계산한 값

    **가감이 아니라 재계산이다** (HISTORY Q33 의 prefers · IE §38). 걸 때 더하고 풀 때
    빼면 부동소수 오차 · 중복 적용 · 순서 의존이 전부 살아난다. 풀었을 때 "정확히
    이전으로" 가 성립하는 유일한 형태가 재계산이다.

    **어느 능력치가 갈리는지, 기여의 형태가 무엇인지는 Stage 3 이 소유한다.**
    여기서 못박는 것은 하나다 — 걸고 풀기를 아무리 반복해도 값이 표류하지 않는다.

### ③ 전투 공식은 한 글자도 고치지 않는다

    `world/semantic/combat.ts` 의 `offenseStatValue` 가 `actor.physicalAttack` 을 읽는다.
    유효 값이 서면 그 한 줄이 **유효 값을 읽도록** 바뀐다. 공식(`rawDamage` ·
    `RULE-DAMAGE-CALCULATE-001`)은 열리지 않는다 — 읽는 값의 출처만 바뀐다.

    그래서 **MC-ATTACK-POWER 의 "세계 안에서 값을 올릴 방법이 없다"** 도 같이 풀린다
    (overlay.md 48행). 지금 그 값을 올리는 경로는 디버그 명령뿐이다.

    이것은 **회귀 검증 대상**이다 — 아무것도 걸지 않은 몸의 피해가 C010 · C012 · C013 ·
    C015 의 실측치와 한 톨도 달라지지 않아야 한다.

### ④ 곡괭이의 용도가 옮겨 가면 두 규칙이 영향을 받는다

    `ruleBodyUses` 가 훑는 곳이 바뀌면, 그것을 읽는 두 곳이 함께 움직인다.

        rules/mine.ts               채굴 가능 판정 — **부르는 쪽은 열리지 않는다.**
                                    같은 함수에 같은 질문을 한다
        rules/item-discard.ts       `usesLostByDiscarding` 가 소지품을 훑어 "이걸 덜어내면
                                    무슨 용도를 잃는가" 를 답한다. 걸린 것이 소지품에
                                    없으므로 **이 판정이 걸린 것을 세지 못한다** —
                                    곡괭이를 걸어 둔 채 다른 곡괭이를 덜어내는 상황의
                                    답이 달라진다. Stage 3 이 소유한다

    또 하나 — `RULE-ITEM-DISCARD-001` 의 `no-way-back` 은 **걸린 것을 풀 때에도 물어야
    하는가**? 푸는 것은 잃는 것이 아니라 소지품으로 돌아오는 것이므로 아니다.
    그러나 그 판정을 Stage 3 이 명시적으로 답해야 한다.

### ⑤ 시작하자마자 캘 수 없게 된다 — 그것이 이 Cycle 의 관찰이다

    `world/rules/observer-body.ts` 가 곡괭이 하나를 초기 소지품으로 준다. 용도의 출처가
    적용으로 옮기면 **걸기 전에는 캐지지 않는다.** 이것은 결함이 아니라 이 Cycle 이
    보여 주려는 것 자체다 (Playable Result).

    다만 **되돌릴 수 없는 막힘을 플레이어가 스스로 만들 수 있어서는 안 된다** —
    C022 가 세운 원칙(`INTENT-NO-SELF-INFLICTED-DEAD-END-001`)이 그대로 산다.
    걸린 곡괭이가 덜어내기의 사정권 밖에 있게 되는지, 초기 상태를 걸린 채로 줄지는
    **Stage 3 이 정한다.** 여기서 못박는 결과는 둘이다.

        1. 아무것도 걸지 않은 상태에서 곡괭이를 걸면 캘 수 있다
        2. 어떤 조작 순서로도 "다시는 캘 수 없는" 상태에 갇히지 않는다

### ⑥ 검증에 필요한 장비 정의는 최소로 늘린다

    **장비 아이템을 여럿 만드는 일이 아니다.** 이 후보가 여는 것은 종류가 아니라
    적용이다. 그러나 두 가지를 관찰하려면 정의가 최소한 이만큼은 있어야 한다.

        용도를 주는 것       곡괭이 — 이미 있다. 자리만 붙으면 된다
        값을 바꾸는 것       **적어도 하나 필요하다.** 유효 값의 재계산은 값을 바꾸는
                            물건이 없으면 관찰될 수 없다
        맞지 않는 것         돌 — 이미 있다. 어느 자리에도 들어가지 않으므로
                            적합성 거절이 그대로 관찰된다

    **몇 종류를 어떤 값으로 늘릴지는 Stage 3 이 소유한다.** 여기서 못박는 것은
    "정의에 항목이 느는 것이지 규칙이 느는 것이 아니다" 하나다.

## TYPE

    New Capability

    적용이라는 개념이 세계에 하나도 없다 — 자리도, 적합성도, 기여도, 유효 값도 없다.
    C020 이 아이템의 바닥을, C022 가 자리를 세웠고 이 Cycle 이 그 위에 **적용**을 얹는다.
    기존 것을 넓히는 부분(용도의 출처 · 능력치의 갈림)이 있으나, 여는 개념 자체가
    새것이므로 New Capability 로 판정한다.

## TARGET CAPABILITY

    MC-EQUIP-ITEM — 지닌 것 중 하나를 몸에 적용해, 적용된 동안에만 그 물건이 주는 것을
    쓴다. 풀면 정확히 원래의 몸으로 돌아온다 (IS §5.4).

    이 Cycle 이 닫는 것은 그 노드의 **절반**이다 — 빈 자리에 걸고 푸는 것.
    남는 절반(이미 찬 자리의 교체 · 가득 찬 상태의 비대칭)은 후보 3 이 닫는다.

## GOAL

    플레이어가 곡괭이를 **걸어야** 캘 수 있고, 걸어 둔 것이 몸의 값을 바꾸며,
    풀면 값도 할 수 있는 일도 정확히 이전으로 돌아온다.

## INCLUDED

    적용 자리                몸이 이름 있는 유한한 자리들을 지닌다. 자리는 물건을 직접
                            담는다 — 걸린 것은 소지품에 없다. **자리의 수와 이름은
                            Stage 3 이 소유한다.** 담을 칸보다 훨씬 좁다는 것만 못박는다

    적합성                   무엇이 어느 자리에 들어가는가를 **정의가 답한다.**
                            맞지 않으면 사유와 함께 거절된다. 규칙이 종류 이름을 묻지 않는다

    걸기 · 풀기              각각 하나의 성공 단위다. 걸기는 소지품에서 빼 자리에 넣고,
                            풀기는 자리에서 빼 소지품에 넣는다. 담을 칸이 모자라면
                            풀기가 사유와 함께 거절되며 **아무것도 바뀌지 않는다**

    유효 값의 재계산          몸에 기본값과 유효 값이 갈린다. 유효 값은 기본값과 지금
                            걸린 것들의 기여로 **다시 계산한다.** 걸고 풀 때 더하고
                            빼지 않는다. 전투 공식은 유효 값을 읽는다

    용도의 출처 이전          `ruleBodyUses` 가 훑는 곳이 소지품에서 적용 자리로 옮긴다.
                            곡괭이는 걸어야 캘 수 있다.
                            그 영향을 받는 기존 규칙(채굴 · 덜어내기)도 함께 검증한다

    적용의 관찰              지금 무엇이 걸려 있는지, 소지품의 무엇을 걸 수 있는지,
                            안 되는 것은 왜 안 되는지가 세계의 판정으로 실린다.
                            걸기/풀기 전후의 값 변화가 화면에서 확인된다

## EXCLUDED

    교체                     이미 찬 자리에 다른 것을 거는 것 — 빼기와 걸기가 한 번에
                            일어나는 단위. **후보 3 (FR-ONE-SLOT-ONE-ITEM)** 이 닫는다.
                            이 Cycle 에서 찬 자리에 걸려 하면 사유와 함께 거절된다

    미리보기                 걸면 무엇이 어떻게 달라지는지를 걸기 전에 계산해 보여 주는 것.
                            **후보 4 (FR-SEE-BEFORE-YOU-WEAR)** 가 닫는다

    자리 늘리기 · 잠금        자리가 처음부터 다 열려 있는가, 무엇을 해야 열리는가
                            (IE §40). 성장 축이 세계에 선 뒤의 이야기다

    아이템 개체화             내구도 · 강화 · 각인 — 같은 종류끼리 값이 달라지는 것
                            (IE §41 · DC-GROWTH-DEFINITION-INSTANCE-SPLIT)

    세계에 놓인 아이템         줍기 · 버리기 · 소유 · 소멸 (IS §6 Cycle 4 · 후보 7)

    자리 정리                 자리 사이의 이동 · 나누기 · 정렬 (후보 5)

    제작                     재료가 다른 것이 되는 것 (후보 6)

    영속                     걸어 둔 것이 다시 켰을 때 그대로인가 (IE §39).
                            세계에 저장·복구라는 개념이 없다

    장비 종류의 확장           검증에 필요한 최소만 정의에 늘린다 (SCOPE NOTE ⑥).
                            무기 · 방어구 계통을 세우는 일이 아니다

    지속 효과 · 재사용 제한     걸린 것이 시간에 따라 무엇을 하는 것 — 조건 층이 없다
                            (MC-CONDITION-STACKING 이 grounded: false)

## RELATED EXISTING CAPABILITY

    재사용

        아이템 정의소            `world/semantic/item.ts` — 적용 자리와 기여가 여기 는다
        수량 변경 단일 통로       `world/rules/inventory.ts` — 걸기/풀기가 이 통로를 지난다
        자리 계산               `world/rules/inventory-room.ts` — 푸는 쪽이 이것을 묻는다
        용도 판정 한 자리         `world/rules/body-uses.ts` — 훑는 곳만 바뀐다
        소지품 관찰 계약          `protocol/gameview.ts` 의 `InventoryItemView[]`
        능력치 계산              `world/semantic/combat.ts` — 읽는 값의 출처만 바뀐다

    영향 가능

        RULE-MINE-001                   곡괭이를 걸어야 캐진다 (부르는 쪽은 열리지 않는다)
        RULE-ITEM-DISCARD-001           걸린 것을 세지 못한다 — 판정의 범위가 달라진다
        RULE-INVENTORY-ADD-001          푸는 것이 이 통로로 들어온다
        RULE-DAMAGE-CALCULATE-001       유효 값을 읽는다 — 결과는 같아야 한다 (회귀)
        RULE-INVENTORY-ROOM-001         걸린 것은 자리를 쓰지 않는다
        `world/rules/observer-body.ts`  초기 소지품 — 걸린 채로 줄지는 Stage 3
