# C024 — View Implementation

> **결정 항목이 늘었을 뿐 그리는 코드가 늘지 않았다.** 문구 표에 다섯 줄, 아이콘 표에
> 한 줄, 역할 표에 한 줄, 키 표에 한 줄. 새 화면도 새 패널도 없다 — 바꿔 걸기는
> 소지품 항목의 손이므로 이미 그 손들이 사는 자리에 붙는다.

## SPEC CONSUMED

    inventory[].actions[exchange-item]     view/inventory-presentation.ts
        ACTION_LABEL 에 '바꿔 걸기' · ACTION_KEY_HINT 에 세 걸음 안내.
        **available 과 사유를 그대로 옮긴다** — 화면이 판정하지 않는다

    inventory[].category = gear            view/inventory-presentation.ts
        CATEGORY_ICON 에 🛡 한 줄. 모르는 분류는 아이콘 없이 나오는 성질 그대로다

    inventory[].actions[equip-item]        변경 없음 — C023 이 세운 그대로 그린다
    equipment[]                            변경 없음 — 자리 목록도 풀기도 그대로
    equipment[].actions[unequip-item]      **no-room 이 그대로 뜬다** (비대칭의 반쪽)
    entities.character.combatStats         변경 없음 — 화면은 받은 수를 그린다
    inventoryRoom                          변경 없음 — 교체 전후로 같은 값이 온다
    interactions.mine                      변경 없음 — 곡괭이가 밀려나면 기존 사유로 막힌다

    사유 문구 (view/code-text.ts)
        no-occupied-slot   '바꿔 낄 것이 걸려 있지 않다 — 그냥 걸면 된다' / '걸린 것 없음'
        slot-not-fit       '그 자리에는 걸리지 않는 물건이다' / '자리 안 맞음'
        unknown-slot       **C023 것을 그대로 쓴다** — 겪는 일이 하나이므로 문구도 하나다
        no-empty-slot      문구가 넓어졌다 ('무엇을 풀거나 **바꿔 껴야** 한다')
        item.buckler       '손방패'

## ASSET MAPPING

    gear → 🛡                              분류 아이콘 (view/inventory-presentation.ts)

    **스프라이트도 모션도 늘지 않았다.** 손방패는 몸 밖에 놓이지 않고 소지품과 자리에만
    있으므로 세계에 그릴 것이 없다. 걸린 것이 몸 그림을 바꾸는 것은 이 Cycle 의 일이
    아니다 (04 not-projected 밖 — 세계가 그 관찰을 보내지 않는다).

## INPUT → ACTION REQUEST

    , (Comma)  →  바꿔 걸기를 연다                    view/bindings.ts

        **아래줄 네 칸이 나란하다** — B 덜어내기 · N 걸기 · M 풀기 · , 바꿔 걸기.
        넷이 같은 형태의 여는 키이므로 손가락 자리도 나란한 것이 맞다.

    , → 숫자(소지품 칸) → 숫자(걸린 자리)
        → `{ interactionId: 'equip-item', itemKind, equipSlotId }`

        **세 걸음인 것은 이 조작이 "무엇을" 과 "어디에" 를 둘 다 요구하기 때문이다.**
        자리를 고르는 것은 판정이 아니라 **선택**이며, 그 선택이 세계가 대신 할 수 없는
        것이다 (INTENT-THE-DISPLACED-IS-NAMED-001).

        첫 걸음에서는 **아무것도 나가지 않는다.** 도중에 그만두거나 다른 키를 열면
        골라 둔 것이 버려지고 세계는 흔들리지 않는다. 없는 칸을 짚으면 닫힌다 —
        열린 채로 두면 다음 숫자가 자리로 읽혀 사람이 뜻을 잃는다.

        자리 번호는 **걸린 자리**의 번호다 — 풀기와 같은 번호이며, 바꿔 낄 대상이
        걸린 것이기 때문이다.

    N → 숫자                               변경 없음 — 자리를 싣지 않는 걸기 그대로

## FIXTURE TESTS

    **fixture 셋은 실제 세계 프로세스가 낳은 관찰이다** — 손으로 지어내지 않았다.

    exchange-nothing-worn.fixture.json     아무것도 걸지 않은 몸 (가방 2/4)
    exchange-full-bag.fixture.json         E1 곡괭이 · 가방 { 손방패, 돌 9 } = **4/4**
    exchange-done.fixture.json             바꿔 낀 뒤 — E1 손방패 · 곡괭이가 가방에

    view/tests/exchange.spec.ts (ADDED · 14)

        VIEW CLOSURE 1 — 손 하나로 보인다             3
            가능이면 손가락 자리가 붙는다 · no-occupied-slot 은 가방 탓으로 읽히지
            않는다 (같은 줄에서 그냥 걸기는 가능) · 걸 수 없는 것은 걸기와 같은 사유

        VIEW CLOSURE 2 — **비대칭이 한 화면에서 보인다**  2
            같은 fixture 에서 풀기는 ✗ 자리 없음 · 바꿔 걸기는 ✓ ·
            화면이 둘을 하나로 뭉치지 않는다

        VIEW CLOSURE 3 — 바꿔 낀 결과가 그대로 보인다    5
            자리에 새것과 그 값 · 헌것이 소지품으로 · 용도가 사라져 채집이 막힘 ·
            **화면이 값을 계산하지 않는다** · 모르는 분류도 멈추지 않는다

        VIEW CLOSURE 4 — 세 걸음 조작                  4
            첫 걸음에서 아무것도 나가지 않는다 · 다른 키를 열면 버려진다 ·
            없는 칸을 짚으면 닫힌다 · 걸린 자리가 없으면 보내지 않는다

    전체     `npm test` — 59 files · **1016 tests 통과** (06 판 1002 + 14)
             `npx tsc --noEmit` 통과 · `npm run boundary:check` 경계 위반 0

## NOTES

    ① 이펙트를 늘리지 않았다

        교체는 새 *사건*이 아니다 — 세계가 낳는 것은 자리와 값의 변화이고, 그것은
        이미 화면에 실린다. `effect-presentation.ts` 의 표 넷 중 어느 것도 열리지
        않았다 (F1 — 예산 7 을 건드리지 않는다).

    ② `,` 를 고른 이유

        아래줄(Z X C V B N M)이 이미 다 찼다 — Z·X 는 카메라, C·V 는 관찰, B·N·M 은
        여는 키다. `,` 는 M 바로 옆이므로 **B·N·M·, 가 손가락 자리로 나란하다.**
        조합 키(Shift·Ctrl)는 입력 계층이 팩에 전달하지 않으므로 쓸 수 없다
        (`engine/view-kernel/input/bindings.ts` 는 `code` 하나만 나른다).

    ③ 걸린 것이 몸 그림을 바꾸지 않는다

        손방패를 걸어도 캐릭터 그림은 그대로다. 세계가 "남이 무엇을 걸었는가" 를
        보내지 않고 자기 몸의 그림도 자리를 반영하지 않기 때문이다 (C023 이 그렇게
        닫았고 이 Cycle 은 그 계약을 열지 않는다). 화면이 소지품 계약에서 몸 그림을
        지어내면 그것이 곧 화면이 세계를 만드는 일이다.

    ④ 미리보기를 만들지 않았다

        "바꿔 끼면 값이 어떻게 되는가" 를 화면이 계산해 보여 주고 싶은 자리가
        분명히 있다 — contributions 와 combatStats 가 둘 다 손에 있기 때문이다.
        **하지 않았다.** 그것은 후보 2 의 일이고, 화면이 하면 세계와 화면에 같은
        계산이 둘 생긴다 (04 not-projected).
