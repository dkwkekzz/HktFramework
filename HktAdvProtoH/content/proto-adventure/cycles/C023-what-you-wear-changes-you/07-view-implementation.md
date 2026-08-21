# C023 — View Implementation

> 화면에 두 번째 목록이 섰다. 소지품 옆에 **걸어 둔 것**이 나란히 놓이고,
> 무엇이 걸려 몸이 어떻게 달라졌는지가 그 자리에서 읽힌다.
> 화면은 적합성을 한 번도 판정하지 않는다 — 받은 값을 옮긴다.

## SPEC CONSUMED

    04-gameview.spec.yaml 만으로 구현했다. `world/` 도 `03-world-semantic.md` 도
    View 의 입력이 아니다.

    equipment                                자리 여섯 · 비어 있는 자리 포함
      [].slotId                              띠 줄의 id · 푸는 요청에 되돌린다
      [].item {kind · category · origin?}    담긴 것
      [].grants                              그것이 지금 주는 용도들
      [].contributions [{name · value}]      그것이 지금 보태는 값들
      [].actions [use-item · unequip-item]   available + unavailableReason
    inventory[].actions[role=equip-item]     항목마다 하나
    interactions.mine.unavailableReason      `no-mining-tool` — 코드 그대로, 문구가 옮겨감
    entities[].attributes.combatStats        형태 무변경 — **화면 코드를 고치지 않았다**
    inventoryRoom                            형태 무변경 — 걸면 used 가 줄어드는 것을 옮길 뿐

## ASSET MAPPING

    걸린 것 줄            아이콘 🎽 · label '걸린 것' · value `<이름> · <보태는 값>`
    빈 자리              패널에서 `·  빈 자리` — 띠에는 오지 않는다 (VIEW NOTE ①)
    걸린 것이 없음         띠에 `걸린 것: 없음` 한 줄 (자리를 안 그리는 것과 다르다)
    분류 아이콘            소지품의 표를 그대로 쓴다 — 자리 쪽에 두 번째 표를 만들지 않는다

    새 문구 (view/code-text.ts — **표에 한 줄이 늘 뿐이다**)
        not-equippable   '걸 수 있는 물건이 아니다'   / 짧게 '걸 수 없음'
        no-empty-slot    '걸 자리가 남지 않았다 …'    / 짧게 '자리 없음'
        slot-empty       '그 자리에 걸린 것이 없다'    / 짧게 '빈 자리'
        unknown-slot     '그런 자리가 없다'          / 짧게 '없는 자리'
        use.mine         '채집'
        stat.*           여덟 능력의 이름
        no-mining-tool   '곡괭이가 없다' → **'채집 도구를 걸지 않았다'** (CHANGED — NOTE ②)

## INPUT → ACTION REQUEST

    V → 숫자      소지품 N 번 칸을 건다      { interactionId: 'equip-item', itemKind }
    U → 숫자      걸린 N 번 자리를 푼다      { interactionId: 'unequip-item', equipSlotId }
    B → 숫자      (C022) 덜어내기
    숫자          (C020) 쓰기

    셋 중 **하나만 열려 있다** — 열면 나머지는 닫히고, 숫자 한 번으로 닫힌다.
    같은 숫자 키가 열린 것에 따라 다른 목록을 읽는다: 걸기·덜어내기·쓰기는 **소지품 칸**을,
    풀기는 **걸린 자리**를 가리킨다. 그 순서는 둘 다 세계가 준 차례이고 화면은 번호만 붙인다.

    **화면은 되는지 안 되는지를 판정하지 않는다.** 없는 칸이면 보내지 않고, 있으면 그대로
    요청한다. 안 되는 경우 세계가 사유와 함께 거절하며 그 사유는 이미 패널에 떠 있다.

## FIXTURE TESTS

    view/tests/equipment.spec.ts        13 tests (World 미기동)
      fixtures/equipment-empty.fixture.json      아무것도 걸지 않은 몸 · 채집 막힘
      fixtures/equipment-worn.fixture.json       곡괭이를 건 몸 · 가방에서 빠짐
      fixtures/equipment-full-bag.fixture.json   가방이 가득 차 풀 수 없는 몸 (IE §15)

      걸린 것과 지닌 것이 구분되어 보인다 · 걸면 가방 자리가 준다
      자리 여섯이 패널에 전부 선다 · 번호는 걸린 자리에만 · 띠 순서와 같다
      걸어서 생긴 용도가 보인다 · 걸 수 없는 사유가 자리 탓으로 읽히지 않는다
      가득 찬 가방에서 풀기가 불가로 보인다 · 걸린 것도 쓸 수 있다
      **보태는 값을 몸의 값에 더하지 않는다** (경위로만 보인다)
      **모르는 자리 · 모르는 종류 · 모르는 용도 · 모르는 능력도 코드 그대로 그린다**

    기존 20 개 fixture 에 `equipment: []` 한 줄 (Stage 6 에서 이미 넣었다)
    전체 982 tests 통과

## VIEW NOTE

    ① 띠와 패널을 가른 이유 — C022 가 소지품에서 내린 것과 같은 판단

       자리 여섯을 띠에 늘 세우면 그것만으로 가로 띠가 찬다. 그중 다섯은 늘 "빈 자리"
       한 마디이고, 그 다섯이 소지품과 대상 줄을 화면 밖으로 민다.

           띠      **걸린 자리만** — 한눈에 읽을 것 (무엇이 걸려 몸이 어떻게 달라졌나)
           패널    **자리 여섯 전부** — 읽어야 아는 것 (빈 자리 · 사유 · 손가락 자리)

       비어 있는 자리는 사라지지 않는다. 세로로 자라는 자리로 내려갔을 뿐이다 —
       계약이 보낸 것은 전부 보인다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    ② `no-mining-tool` 의 문구를 바꾼 것

       코드도 자리도 그대로다. 이전에는 "지니지 않았다" 였고 이제는 "걸지 않았다" 이므로,
       **가방에 곡괭이를 지닌 채로 '곡괭이가 없다' 를 읽는 일이 생긴다.** 그것은 세계가
       거짓말하는 것으로 읽힌다. 사유를 늘리지 않고 문구만 옮겼다 (04 interactions.mine).

    ③ 번호를 걸린 자리에만 붙인 이유

       빈 자리에 번호를 주면 여섯 개의 번호가 늘 떠 있는데 그중 쓸 수 있는 것은 걸린
       것뿐이다. 푸는 일은 걸린 것에만 있으므로 번호도 거기 붙인다 — 그래서 자리가
       하나 걸렸으면 `U → 1` 하나뿐이고, 자리 수가 여섯에서 셋으로 줄어도 화면은
       고치지 않는다.

    ④ 손가락 자리가 세 걸음이 된 것 — 조작 계층의 사정이지 게임의 판정이 아니다

       입력 계층이 조합 키(Shift·Ctrl)를 팩에 전달하지 않고 `code` 하나만 나른다
       (`engine/view-kernel/input/bindings.ts` — 기반이라 이 Cycle 이 편집하지 않는다).
       숫자 키는 이미 쓰기가 쓰고 있으므로 C022 가 B 로 두 걸음을 세웠고, 이 Cycle 이
       같은 형태로 V·U 를 더했다. 셋 중 하나만 열리게 한 것은 잘못 눌러 엉뚱한 요청이
       나가는 것을 줄이기 위해서이며, **그렇게 나간 요청도 세계가 사유와 함께 거절한다.**

       더 나은 조작(끌어놓기 · 자리 클릭)은 기반의 입력 capability 가 자라야 하는 일이라
       이 Cycle 의 범위 밖이다. 그 부족이 이 Cycle 의 Goal 을 막지는 않는다.

    ⑤ 화면이 판정하지 않는다는 것의 실제

       이 파일들 어디에도 `E1` 도 `pickaxe` 도 `stone` 도 없다. 자리 이름은 세계가 준
       차례에 번호를 붙이는 열쇠일 뿐이고, 종류·용도·능력의 이름은 문구를 찾는 열쇠로만
       쓰이며 표에 없으면 코드 그대로 보인다. 마지막 시험(`MAIN-HAND` · `unknown-thing` ·
       `fly` · `wingspan`)이 그것을 값으로 확인한다.

## GAMEVIEW CHANGE

    ADDED     equipment · inventory[].actions[equip-item]
    CHANGED   combatStats 의 값(형태 무변경) · interactions.mine 의 문구(코드 무변경)
