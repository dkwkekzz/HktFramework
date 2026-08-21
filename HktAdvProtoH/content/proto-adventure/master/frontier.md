# Frontier

**후보와 그 의존 순서**, 그리고 **지금 도는 것**을 담는다. Human 이 여기서 하나를 골라
다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle). Cycle 로 넘어가는 것은
선택된 후보 블록의 MASTER TRACE 칸들이다 — 그 외 절은 Human 선택 자료다.
앞선 후보가 닫혀야 열리는 것은 그 블록의 `의존` 칸이 무엇이 먼저인지를 적는다.
아직 **어느 것도 고를 수 없는** 결손은 후보가 아니라 "지금 열 수 없는 것" 에 있다.

    기준 Overlay   master/overlay.md — C020(아이템의 바닥 · 사용·소모) 완료 +
                   아이템(IS) · 인벤토리(IE) · 스킬(SK) 주입 반영 +
                   C022(자리가 유한해진다) 실측 반영 — Human Play 확인 대기
    진행 현황      사다리가 어디까지 섰는지는 graph/GRAPH.md 의 "척추" 절이 그린다.
                   후보를 읽는 법과 이 파일의 규칙은 guides/master-frontier.md 소유다

## 한눈에 보기

| # | 레인 | 기능 | 이것이 무엇인가 | 세계에 없는 것 | 크기 |
|---|---|---|---|---|---|
| 1 | A | **자리가 유한해진다** | 지닌 것이 유한한 칸에 들어가고, 차면 더 받지 못하며, 무엇을 덜어낼지 고르면 자리가 빈다 | 칸 · 가득 참 · 덜어내기 셋 다 | 작음 |
| 2 | A | **걸어 둔 것만이 몸을 바꾼다** | 지닌 것과 지금 적용된 것이 갈리고, 건 동안에만 그 물건이 주는 것이 몸에 나타난다 | 적용이라는 개념 전부 — 자리 · 적합성 · 유효 값 | 중간 |
| 3 | A | **한 자리에는 하나** | 이미 찬 자리에 다른 것을 걸면 빼기와 걸기가 한 번에 일어난다. 가방이 가득해도 바꿔 끼우는 것은 된다 | 교체라는 단위 · 가득 찬 상태의 비대칭 | 작음 |
| 4 | A | **걸기 전에 안다** | 걸면 무엇이 어떻게 달라지는지를 걸기 전에 세계가 계산해 보여 준다 | 적용하지 않은 채 계산한 결과 | 아주 작음 |
| 5 | A | **자리를 손으로 정리한다** | 담긴 것을 옮기고 맞바꾸고 겹친 것을 나누고 정렬한다 | 자리 사이의 이동 · 나누기 · 정렬 | 작음 |
| 6 | A | **재료가 다른 것이 된다** | 가진 재료를 정해진 조합으로 다른 것으로 바꾼다 | 제작법이라는 데이터와 그것을 평가하는 자리 | 중간 |
| 7 | A | **물건이 몸 밖에 놓인다** | 아이템이 누구의 것도 아닌 채로 세계의 한 자리에 놓인다 | 위치를 가진 아이템 · 줍기 · 버리기 · 소유 · 소멸 | 큼 |
| 8 | B | **휘두름의 모양이 값이 된다** | 기술이 닿는 모양이 코드가 아니라 기술의 정의에 담긴다 | 모양 자체 — 반경 · 각도 · 길이가 코드 상수다 | 작음 |

## 후보

### 1. FR-WHAT-YOU-CARRY-TAKES-ROOM — 자리가 유한해진다

    이것이 무엇인가    지닌 것이 **유한한 자리**에 들어간다. 차면 더 받지 못하고,
                       무엇을 덜어낼지 고르면 자리가 빈다. 지금은 종류마다 숫자 하나라
                       얼마를 지니든 아무 일도 일어나지 않는다 — 그래서 "무엇을 들고
                       나갈까" 가 판단이 아니다
    세계에 생기는 것    ① 담을 자리가 유한해진다 — 칸 · 겹칠 수 있는 한도 · 가득 참 판정
                       ② 획득이 전량 성공 또는 전량 실패다 — 다 담기지 못하면 아무것도
                          담지 않고, 세계의 것은 그대로 남는다 (IE §6.1)
                       ③ 덜어내기 — **플레이어가 스스로 줄이는 첫 경로.** 덜어낸 것은
                          세계에 놓이지 않고 없어진다 (IS §5.5 의 소모)
                       ④ 스스로 되돌릴 수 없는 막힘이 생기지 않는다
    이 기능이 아닌 것   **사용이 아니다** — 쓴다 · 없어진다는 C020 이 이미 세웠다.
                       정의소 · 소지 관찰도 아니다 (같음).
                       장착이 아니다 (IS §6 Cycle 2 · IE 전체).
                       몸 밖의 아이템이 아니다 — 덜어낸 것은 세계에 나타나지 않는다.
                       그 도착지는 Cycle 4 가 바꾼다 (IS §5.6 · IE §34).
                       무게 · 부피가 아니다 — 유한해지는 것은 칸이다.
                       가방을 늘리는 확장도 아니다 — 칸 수는 이 Cycle 이 정하는 값이고
                       그 값을 바꾸는 규칙은 다음 이야기다 (IE §3.1)
    이미 있는 것        **C020 이 세운 것 전부** — 아이템 정의소(`world/semantic/item.ts`),
                       변경 단일 통로와 소모(`world/rules/inventory.ts` · `item-use.ts`),
                       용도로 묻는 채굴(`body-uses.ts`), 소지품 관찰 계약, 사용 행동.
                       이 후보는 그 위에 **자리**만 얹는다. 행동 얼개(시간 · 대상 ·
                       중단 · 사유)도 C001 · C002 · C019 로 서 있다
    Playable Result    캔 것이 유한한 자리에 쌓이는 것을 보고, 차면 더 캐도 받지 못하며,
                       무엇을 덜어낼지 골라 자리를 비우면 다시 캘 수 있다
    Observable Result  쓴 자리와 전체가 함께 보이고, 받지 못했을 때 왜 못 받았는지가
                       사유로 온다. 덜어내면 수량이 줄고 자리가 빈다. 실패한 요청은
                       자리도 수량도 건드리지 않는다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE — 무엇을 들고 나갈지가 선택이 되는 자리
    Missing / Partial  **Capability 노드를 목표로 삼지 않는다.** 소지 한도는 할 수 있는
                       일을 늘리는 것이 아니라 좁히는 것이라 Capability 가 아니다
                       (overlay 아이템 절 · IS §4 · §6 의 판정을 그대로 따른다).
                       이 후보가 여는 것은 **MC-EQUIP-ITEM 의 전제**다 — IE §48 이
                       칸을 Cycle 1 에, 장착을 Cycle 2 에 두었고 Human 이 Q34 로
                       그 배치를 확정했다
    원본 근거          IE §3.1 (가방 용량) · §5 (Stack) · §6 · §6.1 (획득 원자성) ·
                       §48 (Cycle 1) · §49 P2 · P3 · IS §5.5 (소모) · HISTORY Q34
    Active Constraints DC-ITEM-CAPACITY-IS-FINITE · DC-ITEM-CHANGE-IS-ONE-UNIT ·
                       DC-ITEM-KIND-IS-DATA-NOT-BRANCH · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval    SATISFIED — 유한함만 세우고 칸 수는 Cycle 이 갖는다(CAPACITY).
                       획득도 덜어내기도 전부 아니면 전무다(ONE-UNIT). 겹침 한도는
                       정의가 답하고 규칙은 종류 이름을 묻지 않는다(KIND-IS-DATA).
                       왜 못 받는지를 세계가 싣는다(SURFACE-LIST)
    Why one Cycle      칸과 덜어내기는 한 몸이다. 칸만 넣으면 가방이 차는 순간 채굴이
                       영구히 막히고 되돌릴 방법이 없다. 덜어내기만 넣으면 덜어낼 이유가
                       없다. 둘이 함께 와야 "무엇을 버릴까" 가 판단이 된다
    7 조건             1 **노드 아님** (위 Missing 칸의 사유 — 이 파일에서 유일한 예외이며
                       근거는 IE §48 과 Q34 다) · 2 자원 갈래의 다음 칸(적용)을 연다 ·
                       3 Client 실측 가능 · 4 한 Cycle · 5 새 World 규칙(자리가 유한하다 ·
                       플레이어가 스스로 줄인다) · 6 Active 와 양립 · 7 장착이 이 위에 얹힌다
    Status             SELECTED — 아래 참조

### 2. FR-WHAT-YOU-WEAR-CHANGES-YOU — 걸어 둔 것만이 몸을 바꾼다

    이것이 무엇인가    지닌 것 중 몇을 몸에 **걸어 둔 것**과 그냥 가진 것이 갈린다.
                       건 동안에만 그 물건이 주는 것이 몸에 나타나고, 풀면 정확히
                       이전의 몸으로 돌아온다. 지금 세계는 이 구분이 없다 — 곡괭이를
                       가지고만 있어도 캐진다
    세계에 생기는 것    ① 적용 자리 — 담을 칸보다 훨씬 좁다. 그 좁음이 "무엇을 걸어
                          둘까" 를 선택으로 만든다 (IE §49 P3). 자리의 수·이름은 값이다
                       ② 적합성 — 무엇이 어느 자리에 들어가는가를 **정의가 답한다**.
                          맞지 않으면 사유와 함께 거절된다 (IE §11)
                       ③ 걸기와 풀기가 각각 하나의 성공 단위다. 실패하면 아무것도
                          바뀌지 않는다 (IE §12 · §14 · Invariant 5)
                       ④ 몸에 **기본값과 유효 값**이 갈린다. 유효 값은 기본값과 지금
                          걸린 것들의 기여로 **다시 계산한다** — 걸고 풀 때 값을
                          더하고 빼지 않는다 (HISTORY Q33 · IE §38)
                       ⑤ 용도의 출처가 소지에서 적용으로 옮긴다 — 곡괭이는 걸어야
                          캘 수 있다 (IE §22 · DC-ITEM-HOLDING-IS-NOT-APPLYING)
                       ⑥ 관찰 — 지금 무엇이 걸려 있고, 무엇을 걸 수 있으며, 안 되는
                          것은 왜 안 되는가 (IE §28 · §29)
    이 기능이 아닌 것   **교체가 아니다** — 이미 찬 자리를 바꿔 끼우는 것은 후보 3 이다.
                       미리보기가 아니다 (후보 4).
                       자리를 늘리거나 잠그는 것이 아니다 (IE §40 — 성장 축이 온 뒤).
                       개체가 아니다 — 같은 종류끼리 상태가 달라지지 않는다
                       (DC-GROWTH-DEFINITION-INSTANCE-SPLIT · IE §41).
                       세계에 놓인 아이템이 아니다 (IS §6 Cycle 4).
                       **장비 아이템을 여럿 만드는 일이 아니다** — 검증에 필요한 최소
                       몇 줄은 정의에 늘지만, 이 후보가 여는 것은 종류가 아니라 적용이다
    이미 있는 것        코드 대조 — `world/rules/body-uses.ts` 가 "이 몸에 그 용도가 지금
                       있는가" 를 **이미 한 자리에서 묻는다**. 이 후보는 그 답의 출처만
                       바꾼다. 정의소(`world/semantic/item.ts`)가 용도·위력·분류를 이미
                       지니고, 수량 변경은 단일 통로(`world/rules/inventory.ts`)이며,
                       소지품 관찰(`InventoryItemView[]`)에 항목별 가능/사유가 이미 실린다.
                       C022 가 자리와 획득·덜어내기의 원자성을 세웠다.
                       **없는 것은 적용 자체다** — `equip`·`slot` 이라는 말이 world/ ·
                       protocol/ 에 0건이고, 몸은 `physicalAttack` 을 값 하나로 지닌다
                       (`world/semantic/actor.ts`) — 기본값과 유효 값의 구분이 없다
    Playable Result    곡괭이를 가지고만 있으면 캐지지 않고, 걸어야 캘 수 있다. 걸면
                       몸의 값이 달라지고 풀면 정확히 이전으로 돌아온다
    Observable Result  걸린 것과 지닌 것이 구분되어 보이고, 걸 수 없는 것은 왜 안 되는지가
                       사유로 온다. 걸기 전후로 값이 바뀌고, 풀면 그 값이 정확히 원래로
                       돌아온다. 실패한 요청은 자리도 값도 건드리지 않는다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE — "물건이 대신해 주고, 물건을 잃으면 도로
                       못 하게 된다" (BW §17). 그 되돌아옴을 소유하는 자리다
    Missing / Partial  **MC-EQUIP-ITEM (MISSING)** — 이 후보가 닫으면 PARTIAL 이 된다.
                       남는 절반은 후보 3 이 닫는다 (그 노드의 world_shape 이 교체와
                       가득 찬 상태의 비대칭까지 요구한다)
    원본 근거          IE §10 · §11 · §12 · §13 · §13.1 · §21 · §22 · §28 · §29 · §38 ·
                       §48 (Cycle 2) · §49 P1 · P3 · P5 · P6 · IS §5.4 · HISTORY Q33
    Active Constraints DC-ITEM-HOLDING-IS-NOT-APPLYING · DC-ITEM-CAPABILITY-COMES-FROM-GRANTS ·
                       DC-ITEM-LIVES-IN-ONE-PLACE · DC-ITEM-CHANGE-IS-ONE-UNIT ·
                       DC-ITEM-KIND-IS-DATA-NOT-BRANCH · DC-ITEM-CAPACITY-IS-FINITE ·
                       DC-WORLD-OWNS-THE-SURFACE-LIST · DC-GROWTH-DEFINITION-INSTANCE-SPLIT
    Constraint Eval    SATISFIED. 첫째에 주의 — **지금 세계가 그 원칙을 어기고 있고**
                       (가지고만 있어도 캐진다), 이 후보는 위반이 아니라 **그 위반의
                       해소**다. 유효 값은 가감이 아니라 재계산이다(Q33 의 prefers).
                       적합성은 정의가 답하므로 규칙이 종류 이름을 묻지 않는다.
                       자리가 물건을 직접 담으므로 한 물건이 두 곳에 있지 않는다(§13.1)
    Why one Cycle      걸기와 풀기는 한 몸이다 — 풀 수 없으면 되돌릴 수 없는 상태를
                       플레이어가 만든다. 그리고 유효 값의 재계산이 없으면 "걸었다" 가
                       관찰되지 않아 그 자체로 확인할 것이 없다
    7 조건             1 MC-EQUIP-ITEM 이 MISSING · 2 자원 갈래의 막힌 칸을 연다
                       (`IM-*` 의 grants 가 처음으로 몸에 닿는다) · 3 Client 실측 가능 ·
                       4 한 Cycle · 5 새 World 규칙(적용이라는 상태) ·
                       6 Active 와 양립 · 7 이후 제작·전리품이 이 위에 얹힌다
    의존               **후보 1(C022)이 먼저다 — 실측은 이미 끝났고 Human Play 확인만
                       남았다.** 자리가 유한하지 않으면 "적용 자리가 담을 칸보다 좁다" 가
                       성립하지 않고, 풀 때 담을 곳이 모자라는 상황(IE §15)도 생기지 않는다.
                       그 자리는 이제 세계에 있다 — `Inventory.UsedSlots` 와 사유 `no-room`
    Status             PROPOSED

### 3. FR-ONE-SLOT-ONE-ITEM — 한 자리에는 하나

    이것이 무엇인가    한 자리에는 하나만 있다. 이미 찬 자리에 다른 것을 걸면 빼는 것과
                       거는 것이 **한 번**에 일어난다. 플레이어에게 그것은 두 동작이
                       아니라 하나다
    세계에 생기는 것    ① 교체가 하나의 성공 단위다 — 둘 중 하나가 성립하지 않으면
                          아무것도 일어나지 않는다 (IE §17 · Invariant 5)
                       ② 가득 찬 가방에서의 **비대칭** — 그냥 푸는 것은 담을 곳이 없어
                          막히고, 바꿔 끼우는 것은 된다. 나온 것이 들어간 것의 자리를
                          쓰기 때문이다 (IE §15 · §16.1)
                       ③ 그 둘의 사유가 각각 다른 코드로 온다
    이 기능이 아닌 것   걸기·풀기 자체가 아니다 (후보 2 가 세운다).
                       자리 수를 늘리는 것이 아니다.
                       끌어다 놓는 조작이 아니다 — 그것은 표면이다 (IE §18~§20 `[VIEW]`).
                       가방 안에서 자리를 바꾸는 것도 아니다 (후보 5)
    이미 있는 것        후보 2 가 세우는 적용 전부. 그리고 C020 이 세운 "검증 → 효과 →
                       소모가 한 단위" 형태(`world/rules/item-use.ts`)가 원자성의
                       선례로 이미 있다 — 시작과 완료 사이에 세계가 움직였을 수 있으므로
                       완료 시점에 다시 검증한다는 것까지 같다
    Playable Result    가방이 가득 차 있어도 걸고 있던 것을 새것으로 바꿔 낄 수 있다.
                       같은 상태에서 그냥 풀려고 하면 자리가 없다는 사유가 온다
    Observable Result  교체 뒤 새것의 효과만 있고 옛것의 효과는 없다. 실패한 교체는
                       걸린 것도 지닌 것도 값도 바꾸지 않는다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE
    Missing / Partial  **MC-EQUIP-ITEM (후보 2 이후 PARTIAL)** — 이 후보가 그 노드의
                       world_shape 마지막 두 문장을 닫는다
    원본 근거          IE §15 · §16 · §16.1 · §17 · §46 Test 07 · Test 09 · Test 10 ·
                       §48 (Cycle 2) · §49 P7
    Active Constraints DC-ITEM-CHANGE-IS-ONE-UNIT · DC-ITEM-LIVES-IN-ONE-PLACE ·
                       DC-ITEM-CAPACITY-IS-FINITE · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval    SATISFIED — 교체가 전부 아니면 전무이고(ONE-UNIT), 옮기는 중에도
                       한 물건은 한 곳에 있으며(LIVES-IN-ONE-PLACE), 왜 되고 왜 안 되는지를
                       세계가 싣는다(SURFACE-LIST)
    Why one Cycle      비대칭 하나가 이 후보의 전부다 — "가득 차면 못 풀지만 바꿔 끼울
                       수는 있다". 그 한 문장이 성립하면 닫힌다
    7 조건             1 후보 2 이후 PARTIAL · 2 같은 갈래를 전진 · 3 실측 가능 ·
                       4 한 Cycle · 5 새 World 규칙(교체라는 단위) · 6 양립 ·
                       7 이후 모든 자리 조작이 이 원자성을 재사용
    의존               **후보 2 가 먼저다.** 걸린 것이 없으면 바꿔 낄 것도 없다.
                       Human 이 원하면 후보 2 에 합쳐 한 Cycle 로 돌 수도 있다 —
                       IE §48 은 원래 둘을 같은 Cycle 에 두었다
    Status             PROPOSED

### 4. FR-SEE-BEFORE-YOU-WEAR — 걸기 전에 안다

    이것이 무엇인가    걸면 무엇이 어떻게 달라지는지를 **걸기 전에** 세계가 계산해
                       알려 준다. 지금 세계에서 결과를 아는 유일한 방법은 실제로
                       해 보는 것이다
    세계에 생기는 것    ① 적용하지 않은 채 계산한 유효 값 — 세계 상태는 바뀌지 않는다
                       ② 그 계산이 실제 적용과 **같은 규칙**을 쓴다. 두 곳에 두면
                          미리 본 값과 실제 값이 어긋난다
                       ③ 그 결과가 관찰에 실린다 (IE §37)
    이 기능이 아닌 것   화면 배치·비교 표가 아니다 — 그것은 표면이다.
                       자동 추천이 아니다 — 무엇이 나은지는 세계가 고르지 않는다.
                       세계를 바꾸지 않는다 — 미리 보는 것으로는 아무 일도 일어나지 않는다
    이미 있는 것        후보 2 의 유효 값 재계산. 그것이 **함수로 서 있으면** 이 후보는
                       같은 함수를 걸지 않은 상태에 한 번 더 돌리는 일이다
                       (Q33 이 재계산을 prefers 로 올린 것이 이 후보를 싸게 만든다).
                       그리고 "무엇이 왜 안 되는가" 를 관찰에 싣는 형태는 C017 · C020 이
                       이미 세웠다
    Playable Result    둘 중 무엇을 걸지, 걸기 전에 값이 어떻게 달라지는지 보고 고른다
    Observable Result  고른 물건마다 지금 값과 걸었을 때의 값이 함께 온다.
                       실제로 걸면 미리 본 값과 같은 값이 나온다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE
    Missing / Partial  **Capability 노드를 목표로 삼지 않는다** — 미리 보기는 할 수 있는
                       일을 늘리는 것이 아니라 이미 할 수 있는 일의 결과를 앞당겨
                       보여 준다. 후보 1 과 같은 사유의 예외다
    원본 근거          IE §37 · §21 · §48 (Cycle 2)
    Active Constraints DC-WORLD-OWNS-THE-SURFACE-LIST · DC-ITEM-HOLDING-IS-NOT-APPLYING
    Constraint Eval    SATISFIED — 미리 본 값도 세계가 계산해 싣는다(SURFACE-LIST).
                       미리 보는 것은 적용이 아니므로 몸은 한 톨도 바뀌지 않는다(HOLDING)
    Why one Cycle      아주 작다. **후보 2 에 얹어 한 Cycle 로 돌아도 된다** — 따로 세운
                       것은 그것이 없어도 후보 2 가 완결되기 때문이지, 별도 Cycle 이어야
                       해서가 아니다. 크기 판단은 Human 몫이다
    7 조건             1 노드 아님(위 사유) · 2 고르는 일을 판단으로 만든다 ·
                       3 실측 가능 · 4 한 Cycle · 5 **약함** — 새 규칙이라기보다 기존
                       계산의 관찰 확장이다. 이 칸이 약한 것을 감추지 않는다 ·
                       6 양립 · 7 이후 제작·성장의 "하면 어떻게 되는가" 가 재사용
    의존               **후보 2 가 먼저다.**
    Status             PROPOSED

### 5. FR-ARRANGE-WHAT-YOU-CARRY — 자리를 손으로 정리한다

    이것이 무엇인가    자리에 담긴 것을 사람이 **골라서** 옮기고, 맞바꾸고, 겹친 묶음을
                       나누고, 한 번에 정렬한다. 후보 1 은 자리를 만들지만 그 배치를
                       바꾸는 수단은 두지 않는다 (C022 EXCLUDED)
    세계에 생기는 것    ① 자리 사이의 이동과 맞바꿈이 세계의 규칙이 된다 — 어느 자리에
                          무엇이 있는가는 세계의 사실이므로 화면이 정하지 않는다
                       ② 겹친 묶음을 둘로 나눈다 (IE §33)
                       ③ 정렬 규칙을 세계가 소유한다 (IE §31)
                       ④ 각 조작의 가능/불가와 사유
    이 기능이 아닌 것   끌어다 놓기라는 조작 방식이 아니다 (IE §18~§20 `[VIEW]`).
                       필터가 아니다 — 그것은 보는 사람의 편의이고 세계 상태가 아니다
                       (IE §32 `[VIEW]`).
                       자리 수를 바꾸는 것이 아니다.
                       장착 자리와는 무관하다 — 여기는 가방 안이다
    이미 있는 것        후보 1(C022)이 세운 자리 · 겹침 한도 · 원자성 · 자리 관찰.
                       이 후보는 그 위에 **배치를 바꾸는 행동**만 더한다
    Playable Result    가득 찬 가방에서 흩어진 같은 종류를 한 자리로 모아 자리를 만든다
    Observable Result  옮긴 뒤의 배치가 그대로 보이고, 안 되는 조작은 사유가 온다.
                       정렬해도 걸어 둔 것은 흔들리지 않는다 (IE §46 Test 12)
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE
    Missing / Partial  **Capability 노드를 목표로 삼지 않는다** — 배치를 바꾸는 것은
                       할 수 있는 일을 늘리지 않는다. 후보 1 · 4 와 같은 사유의 예외다
    원본 근거          IE §4 · §31 · §33 · §46 Test 12 · §48 (Cycle 1 의 남은 줄)
    Active Constraints DC-ITEM-CHANGE-IS-ONE-UNIT · DC-ITEM-LIVES-IN-ONE-PLACE ·
                       DC-WORLD-OWNS-THE-SURFACE-LIST · DC-ITEM-KIND-IS-DATA-NOT-BRANCH
    Constraint Eval    SATISFIED — 나누기도 옮기기도 전부 아니면 전무이고, 옮기는 중에
                       한 물건이 두 자리에 있지 않으며, 배치는 세계가 소유한다
    Why one Cycle      네 조작이 모두 "자리에 담긴 것을 사람이 고쳐 놓는다" 하나다
    7 조건             1 노드 아님(위 사유) · 2 **약함** — 갈래를 전진시키기보다 이미 선
                       것을 쓰기 편하게 한다 · 3 실측 가능 · 4 한 Cycle ·
                       5 **약함** — 새 게임 의미가 얇다. 이 둘이 약한 것을 감추지 않는다 ·
                       6 양립 · 7 이후 창고·거래가 같은 이동 규칙을 재사용
    의존               **후보 1(C022)은 이미 섰다.** 장착과는 무관하므로 후보 2~4 와
                       순서를 다툴 이유가 없다.
                       다만 **이 후보를 세울지 자체가 Human 결정 대기다** — open-questions
                       Q37 이 그것을 묻고 있고(자리에 이름을 줄 것인가), 이 후보가 그
                       질문의 (b) 안이다. Human 이 (a)(현행 유지)를 고르면 이 후보는 지운다
    Status             PROPOSED

### 6. FR-MATERIALS-BECOME-SOMETHING-ELSE — 재료가 다른 것이 된다

    이것이 무엇인가    가진 재료를 정해진 조합으로 **다른 것**으로 바꾼다. 캔 돌이 그
                       자체로는 쓸모가 없고 무엇으로 바뀌어야 값을 갖는 자리다
    세계에 생기는 것    ① 제작법이 데이터다 — 재료 · 결과물 · 요구 조건. 새 항목이
                          규칙 코드를 열지 않는다 (IS §5.5)
                       ② 지금 만들 수 있는 것과 **무엇이 모자라 못 만드는지**가 실행
                          전에 보인다
                       ③ 재료 감소와 결과물 생성이 하나의 성공 단위다 — 실패하면
                          재료가 한 톨도 줄지 않는다
                       ④ 제작 맥락 — 특정 자리·도구를 요구하는 제작 (IS §5.5 마지막 줄)
    이 기능이 아닌 것   장착이 아니다 (후보 2 — 만든 것이 쓸모를 가지려면 그것이 먼저다).
                       세계에 놓인 재료가 아니다 (후보 7).
                       등급·희귀도·강화가 아니다 (IS §10 — 수치와 분포의 문제).
                       조합 결과를 미리 만들어 두는 것이 아니다
                       (DC-GROWTH-DEFINITION-INSTANCE-SPLIT — 만들 때 생긴다)
    이미 있는 것        코드 대조 — 소모(`world/rules/inventory.ts` 의 remove)와 "검증 →
                       효과 → 수량 변경이 한 단위" 형태(`item-use.ts`)가 C020 으로 이미
                       섰다. 제작은 그 형태를 **재료 여럿 → 결과물 하나**로 넓히는 일이다.
                       정의소도 있으므로 결과물은 정의에 항목이 느는 것으로 끝난다.
                       **없는 것은 제작법이라는 데이터와 그것을 평가하는 자리**다
    Playable Result    캔 돌로 도구를 만들고, 만든 것을 걸어 전에 못 하던 것을 한다
    Observable Result  만들 수 있는 것과 못 만드는 사유가 실행 전에 오고, 만들면 재료가
                       줄고 결과물이 는다. 실패한 제작은 아무것도 바꾸지 않는다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE · MP-PREPARE-IN-CIVILIZATION
    Missing / Partial  **MC-CRAFT-FROM-MATERIALS (MISSING)** — `grounded: true`
    원본 근거          IS §5.5 · §6 (Cycle 3) · §8 · §9
    Active Constraints DC-ITEM-CHANGE-IS-ONE-UNIT · DC-ITEM-KIND-IS-DATA-NOT-BRANCH ·
                       DC-GROWTH-DEFINITION-INSTANCE-SPLIT · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval    SATISFIED — 노드의 constraint_evaluation 셋이 이미 그렇게 적혀 있고,
                       "무엇이 모자란가" 를 세계가 계산해 싣는다(SURFACE-LIST)
    Why one Cycle      제작법 · 가능 여부 · 원자적 실행 셋이 한 몸이다. 제작법만 두면
                       만들 수 없고, 가능 여부 없이 만들면 왜 안 되는지 알 수 없다
    7 조건             1 MISSING · 2 자원 갈래와 문명권 준비 갈래 둘을 동시에 전진 ·
                       3 실측 가능 · 4 한 Cycle · 5 새 World 규칙(변환) · 6 양립 ·
                       7 이후 모든 변환(정제·해체·수리)이 이 자리를 재사용
    의존               **후보 2(장착)가 먼저다.** IS §6 이 그 순서를 이미 정했다 —
                       만든 것이 쓸모를 가지려면 걸 수 있어야 한다. 소모(C020)는 이미 섰다
    Status             PROPOSED

### 7. FR-THINGS-LIE-IN-THE-WORLD — 물건이 몸 밖에 놓인다

    이것이 무엇인가    아이템이 처음으로 **누구의 것도 아닌 채로** 세계의 한 자리에
                       놓인다. 지금 세계에서 물건은 언제나 누군가의 몸 안에 있다
    세계에 생기는 것    ① 위치를 가진 아이템 존재 — 겹친 묶음 단위를 허용한다
                       ② 줍기(세계 → 몸)와 버리기(몸 → 세계) 양방향, 각각 한 단위
                       ③ 획득 권한 — 누가 가져갈 수 있는가
                       ④ 소멸 — 버려진 것이 언제 사라지는가 (값은 Cycle 소유)
                       ⑤ 걸어 둔 것을 내려놓는 길은 **담을 곳을 거치지 않는다**
                          (IE §35 — 가방이 가득해도 된다)
                       ⑥ **세계에서 존재가 사라지는 첫 경로**가 생긴다
    이 기능이 아닌 것   전리품 보관소가 아니다 — 쓰러진 몸에서 꺼내는 것은 그 다음이다
                       (IS §5.6 의 남은 줄. 여기가 그 바닥을 놓는다).
                       거래가 아니다 (IS §10 — 상대 주체와 관계가 선 뒤).
                       제작 재료의 자동 수거가 아니다
    이미 있는 것        코드 대조 — 위치를 가진 비-Actor 존재의 **선례가 하나 있다**:
                       광맥(`world/semantic/deposit.ts`)이 자리를 갖고 거리 판정을 받으며
                       관찰에 실린다. 줍기·버리기의 원자성 형태도 C020·C022 가 세웠다.
                       **없는 것은 그 존재가 아이템이 되는 것**과 소유·소멸이다
    Playable Result    지닌 것을 바닥에 내려놓고, 다시 줍고, 시간이 지나면 사라지는 것을 본다
    Observable Result  바닥의 것이 자리를 가진 존재로 관찰되고, 멀거나 권한이 없으면
                       사유가 온다. 둘이 동시에 마지막 하나를 집으면 한 쪽만 성공한다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-KILL-CREATURE · MP-TAKE-SHED-ORGAN · MP-TRADE-WITH-ACTOR
                       — 셋 다 "몸 밖의 것을 얻는다" 를 전제한다 (BW §27)
    Missing / Partial  **MC-TRANSFER-ITEM (MISSING)** — `grounded: true`
    원본 근거          IS §5.6 · §6 (Cycle 4) · IE §34 · §35 · §48
    Active Constraints DC-ITEM-CHANGE-IS-ONE-UNIT · DC-ITEM-LIVES-IN-ONE-PLACE ·
                       DC-WORLD-OWNS-THE-SURFACE-LIST · DC-ITEM-CAPACITY-IS-FINITE
    Constraint Eval    SATISFIED — 옮김이 전부 아니면 전무이고, 옮기는 중에도 한 물건은
                       한 곳에 있으며(LIVES-IN-ONE-PLACE), 주변에 무엇이 있고 왜 못 집는지를
                       세계가 싣는다
    Why one Cycle      놓기와 줍기는 한 몸이다 — 놓기만 있으면 세계가 물건으로 덮이고,
                       줍기만 있으면 놓을 것이 없다. 소멸도 같은 이유로 함께 온다
    7 조건             1 MISSING · 2 세 Possibility 를 동시에 전진 · 3 실측 가능 ·
                       4 한 Cycle · 5 새 World 규칙(몸 밖의 존재) · 6 양립 ·
                       7 **이 후보가 여는 것이 가장 넓다** — 전리품 · 드롭 · 거래 ·
                       C017 의 미도달 규칙(사라진 대상 비우기)이 전부 이 위에 얹힌다
    의존               **후보 2(장착)가 먼저다** — IE §35 의 "걸어 둔 것을 내려놓는 길은
                       담을 곳을 거치지 않는다" 가 이 후보의 항목 ⑤ 이고, 걸린 것이
                       없으면 그 비대칭이 성립하지 않는다. IS §6 도 같은 순서다.
                       **이 후보의 Stage 1 이 답해야 할 질문이 하나 열려 있다** —
                       open-questions Q38 (C022 가 세운 "덜어냄" 과 IE §34 의 "버리기" 가
                       같은 행동인가). 그 답이 이 후보의 크기를 가른다
    Status             PROPOSED

### 8. FR-THE-SHAPE-IS-DATA — 휘두름의 모양이 값이 된다

    이것이 무엇인가    기술이 닿는 **모양**(어디를 · 얼마나 넓게 · 몇을 함께)이 규칙
                       코드가 아니라 기술의 정의에 담긴다. 지금은 모든 기술이 같은
                       궤적을 쓰고, 그 궤적이 코드에 박혀 있다
    세계에 생기는 것    ① 기술 정의가 모양을 지닌다 — 찌르기는 좁고 길게, 횡베기는
                          넓게 (SK-EX §5.2 의 형상)
                       ② 닿는 것을 고르는 판정이 그 모양을 읽는다 — 규칙은 기술
                          이름을 묻지 않는다 (SK §7)
                       ③ 모양이 관찰에 실린다 — 무엇에 왜 닿았는지 설명된다
    이 기능이 아닌 것   **새 실행 형태가 아니다** — 투사체 · 장판 · 광선은 여기 없다.
                       그 셋은 세계에 **몸이 아닌 존재**가 먼저 서야 하고, 그것을
                       요구하는 Possibility 가 아직 없다 (Q35).
                       여럿을 동시에 치는 것 자체가 목적이 아니다 — 모양의 결과로
                       그렇게 될 뿐이다.
                       대상 기준의 갈래를 세우는 일도 아니다 — SK §3 이 그 갈래(자기 · 고른 것 ·
                       방향 · 세계의 한 자리)를 공급했으나, 이 후보가 쓰는 것은 지금
                       세계에 이미 있는 방향 기준 하나뿐이다.
                       새 기술을 여럿 만드는 일이 아니다 — 값이 다른 둘이면 족하다
    이미 있는 것        코드 대조 — 궤적 판정이 이미 한 자리에 있다
                       (`world/semantic/collision.ts` — 휘두른 무기 끝이 훑는 궤적 안의
                       몸만 맞는다). 기술 정의도 이미 값을 지닌다
                       (`world/semantic/combat.ts` 의 `SKILL_DEFINITIONS` — 위력 · 길이 ·
                       구간 경계). C019 가 구간 경계를 전역 상수에서 정의로 내린 것이
                       **이 후보와 똑같은 형태의 선례**다.
                       **없는 것은 모양 자체**다 — 반경 · 각도 · 길이가 코드 상수다
    Playable Result    좁고 길게 찌르는 기술과 넓게 베는 기술이 실제로 다르게 닿는다 —
                       하나는 정면의 먼 것에, 하나는 옆의 여럿에
    Observable Result  기술마다 다른 모양이 관찰에 실리고, 같은 자리에 선 상대가 기술에
                       따라 맞기도 하고 안 맞기도 한다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-OUTGROW-THE-OPPONENT 외 — MC-COMBAT-STRIKE 를 요구하는 전투
                       갈래 전부가 이 노드를 지난다
    Missing / Partial  **MC-COMBAT-STRIKE 의 확장** (overlay: IMPLEMENTED).
                       새 Capability 를 세우지 않는다 — 이 후보가 닫는 것은 그 노드에
                       걸린 `DC-SKILL-IS-COMBINATION-NOT-NAME: UNRESOLVED` 다
                       (휘두름의 모양이 아직 규칙 코드에 있다)
    원본 근거          SK §5 (근접 공격 = 접촉) · §7 (규칙은 이름을 묻지 않는다) ·
                       §12 수용 기준 3 · 15 · SK-EX §5.2 (형상) · §8.1 (접촉) ·
                       open-questions Q35 ("휘두름의 모양을 정의로 꺼내는 일이
                       선행 작업이 된다")
    Active Constraints DC-SKILL-IS-COMBINATION-NOT-NAME · DC-SKILL-COMBINE-BEFORE-NEW-FORM ·
                       DC-COMBAT-ONE-FORMULA · DC-COMBAT-PLAYER-CAUSALITY ·
                       DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval    SATISFIED — 모양을 값으로 내리는 것이 IS-COMBINATION-NOT-NAME 이
                       요구하는 형태 그 자체다. 새 형태를 만들지 않고 파라미터로 푸는
                       것이므로 COMBINE-BEFORE-NEW-FORM 과도 맞는다(SK §6-2 의 정석 사례).
                       피해 공식은 한 글자도 건드리지 않는다(ONE-FORMULA).
                       모양은 결정적이므로 같은 자리·같은 기술이면 같은 결과다
    Why one Cycle      모양을 정의로 내리는 것과 판정이 그것을 읽는 것은 한 몸이다.
                       정의에만 두면 아무 일도 일어나지 않고, 판정만 고치면 읽을 값이 없다
    7 조건             1 **노드 아님 — 기존 노드의 확장이다.** 다만 그 노드에 걸린
                       Constraint 판정이 UNRESOLVED 이므로 결손은 실재한다 ·
                       2 전투 갈래 전부의 바닥을 넓힌다 · 3 실측 가능 · 4 한 Cycle ·
                       5 새 World 규칙(모양이 데이터다) · 6 양립 ·
                       7 이후 모든 전달 형태가 이 형상 축을 재사용한다
    의존               **없다.** 아이템 축과 겹치지 않는다 — 이것이 이 후보를 다른
                       세션에 맡길 수 있는 이유다 (아래 병렬 배치)
    Status             PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

여덟은 **두 레인**으로 갈린다. 레인 안에서는 순서가 강제되고, 레인 사이에는 의존이 없다.

```text
레인 A — 아이템 (IS · IE)          레인 B — 전투 (SK)

  1 자리가 유한해진다  ← 확인 대기     8 휘두름의 모양이 값이 된다
        ↓                              (의존 없음 · 단독으로 닫힌다)
  2 걸어 둔 것만이 몸을 바꾼다
        ↓
  3 한 자리에는 하나
        ↓
  4 걸기 전에 안다
        ↓
  6 재료가 다른 것이 된다
        ↓
  7 물건이 몸 밖에 놓인다

  5 자리를 손으로 정리한다  ← 1 뒤라면 아무 때나. 레인 안에서도 순서가 자유롭다
```

레인 A 의 순서는 Agent 가 정한 것이 아니라 **IS §6 이 이미 그은 것**이다 —
바닥 → 장착 → 제작 → 세계의 아이템. 뒤의 것이 앞의 것을 요구하고, 앞의 것은 뒤가
없어도 플레이로 닫힌다.

레인별 근거는 이렇다.

```text
2 (장착)      여덟 중 유일하게 Capability 를 닫는다. 자원이 능력이 되는 갈래가
              여기서 처음 몸에 닿고, 지금 세계가 어기고 있는 원칙 하나
              (가지고만 있어도 캐진다)가 해소된다. MC-ATTACK-POWER 의
              "세계 안에서 값을 올릴 방법이 없다" 도 같이 풀린다

3 · 4         2 의 남은 절반과 덤이다. 셋을 한 Cycle 로 묶어도 된다 —
              IE §48 의 Cycle 2 가 원래 그 묶음이다

6 (제작)      2 뒤. 만든 것이 쓸모를 가지려면 걸 수 있어야 한다 (IS §6)

7 (세계의     여덟 중 여는 것이 가장 넓다 — 전리품 · 드롭 · 거래 · C017 의 미도달
   아이템)    규칙이 전부 이 위에 얹힌다. 대신 가장 크다. IE §35 때문에 2 뒤다

5 (자리 정리)  7 조건 2·5 가 약하다 — 새 게임 의미보다 편의 쪽이다. 급하지 않고,
              **세울지 자체가 Q37 의 답을 기다린다**

8 (모양)      작고, 선례가 있고(C019 가 같은 형태로 구간 경계를 정의로 내렸다),
              방금 Active 가 된 원칙의 UNRESOLVED 하나를 닫는다
```

### 병렬 배치 — 두 세션으로 나눌 때

`레인 A 하나 · 레인 B 하나`가 가장 안전한 배치다. 아래 셋이 그 근거이자 규칙이다.

#### 겹치는 자리는 둘뿐이다

코드 대조로 확인한 것이다.

```text
world/semantic/combat.ts        A 의 2 는 유효 능력치를 읽도록 offenseStatValue 를 고친다
                                B 의 8 은 SKILL_DEFINITIONS 에 모양을 더한다
                                → 같은 파일, 다른 자리

protocol/gameview.ts            둘 다 관찰을 늘린다 (걸린 것 / 기술의 모양)
                                → 같은 파일, 다른 자리

그 밖의 등록부                   world/index.ts · protocol/semantic-id.ts
```

나머지는 갈린다 — A 는 `semantic/item.ts` · `inventory.ts` · `rules/inventory.ts` ·
`rules/item-use.ts` · `rules/body-uses.ts` 와 새 장착 자리, B 는 `semantic/collision.ts` 와
`rules/attack.ts` 다.

#### 겹치는 자리에서 지키는 것

```text
추가만 한다              기존 줄을 옮기거나 재배열하지 않는다. 병합은 추가끼리는 잘
                         붙지만 이동에는 약하다
자기 영역 끝에 붙인다     등록부·상수 목록에 넣을 때 파일 맨 끝을 다투지 않는다
의미 하나만 주의한다      A 의 2 가 **유효 능력치**를 세우면 전투가 읽는 값의 출처가
                         바뀐다. B 의 8 은 그 값을 건드리지 않으므로 안전하지만,
                         2 가 먼저 병합되면 B 는 rebase 뒤 전투 회귀를 다시 돌린다
                         (피해 값이 달라질 수 있다)
```

#### 두 층 사이에서 지키는 것

이것이 실제로 사고가 났던 자리다 — 두 갈래가 서로를 모른 채 돌아 Cycle 번호가 겹치고
한쪽 Overlay 가 통째로 누락됐다 (master/HISTORY.md).

```text
Cycle 번호를 먼저 예약한다   Stage 1 을 쓰기 전에 cycles/ 를 보고 번호를 잡은 즉시
                            그 디렉터리와 01-cycle.md 제목 줄만 만들어 push 한다.
                            다른 세션은 origin 을 fetch 해 다음 번호를 잡는다

master/ 는 Cycle 이 고치지 않는다   이미 규칙이다 (CLAUDE.md). 두 레인이 master 를
                            동시에 건드릴 일은 Feedback 때뿐이다

Feedback 은 한 번에 하나     닫힌 Cycle 의 08-verification 을 Master 에 반영하기 전에
                            **main 을 먼저 본다.** 병렬 갈래가 있으면 상대가 이미
                            갱신했는지 확인한 뒤 시작한다

레인마다 다른 브랜치         한쪽이 main 에 들어가면 다른 쪽은 즉시 그것을 가져온다.
                            늦게 가져올수록 위 "의미 하나" 가 커진다
```

## SELECTED

```text
FR-WHAT-YOU-CARRY-TAKES-ROOM — 자리가 유한해진다
C022-what-you-carry-takes-room 이 돈다 (Stage 8 실측 완료 · Human Play 확인 대기)
```

    **아직 소진되지 않았다.** 여덟 Stage 의 실측은 끝났고 Gate 15항 중 열넷이 충족이다.
    남은 하나가 `인간이 실제 게임에서 Cycle Goal 달성을 확인했다` 이며, 기계가 실제 세계
    프로세스와 실제 브라우저로 같은 각본을 두 번 돌았어도 그것을 대신하지 않는다.
    확인되면 이 후보를 지우고 결과를 HISTORY 로 옮긴다 (C022 08-verification.md).

    이것은 **Human 이 2026-08-21 에 고른 것의 남은 절반**이다 — 새 선택이 아니다.
    그때 고른 "아이템의 바닥" 은 Q34 로 다섯 조각(정의 · 자리 · 관찰 · 사용 · 소모)이
    되었고, 그중 넷이 C020 으로 닫혔다. 남은 하나가 자리이며, 덜어내기가 그것과 한 몸인
    것도 같은 날 Human 이 정했다 (C022 01-cycle.md SCOPE NOTE ①).
    닫힌 절반의 결과는 HISTORY.md 에 있다.

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **영속** (IE §39) | 세계에 저장·복구라는 개념이 없다. 걸어 둔 것이 다시 켰을 때 그대로인가, 로드를 두 번 해도 값이 누적되지 않는가(IE §46 Test 13)는 영속이 설 때 함께 온다. IE §48 이 이 절을 어느 Cycle 에도 매지 않은 이유다 |
| **자리 잠금·해금** (IE §40) | 성장 축이 세계에 없다. 자리가 처음부터 다 열려 있는지, 무엇을 해야 열리는지는 "무엇으로 자라는가" 가 선 뒤의 이야기다 (IE §48 — 어느 Cycle 에도 매이지 않는다) |
| **아이템 개체화** (IE §41) | 같은 종류끼리 상태가 달라야 할 이유가 아직 없다 (DC-GROWTH-DEFINITION-INSTANCE-SPLIT · IS §2.1). 내구도·강화·각인처럼 개체마다 다른 값이 생기는 층이 오면 그때 선다 |
| **스킬 실행 형태** (MS-SKILL-FORM 의 빈 다섯 칸) | 이제 하나가 막는다 — **그 형태를 요구하는 Possibility 가 없다** (Q35 의 7 조건 2 — OPTIONS 작업이 먼저다). 기획 공백은 SK 최종안이 메웠다: 대상 기준·대상 결정의 갈래(HISTORY Q42 가 기다리던 것)는 SK §3 이, 몸 아닌 존재와 그 관찰 경계(Q44 ①②)는 SK-SP 가, 없는 효과를 미리 두지 않는 규칙(Q44 ③)은 SK-EF 가 공급했고, 자리 자체가 열넷에서 여섯으로 줄어 Q44 ④ 도 해소됐다. 남은 실질 장벽은 하나 — 투사체·장판·설치는 세계에 **몸이 아닌 존재**가 먼저 서야 하고, 그것을 요구하는 Possibility 가 아직 없다 |
| **지속 효과 · 재사용 제한** (IS §5.3 의 남은 줄) | 그 반쪽을 소유한 노드가 MC-CONDITION-STACKING 인데 `part_of.grounded: false` 다 — 조건 층의 설계 문서가 없어 후보의 Target 으로 세울 수 없다 (guides/master-frontier.md Must Not). 지금 세계의 조건 얼개는 이름도 지속 시간도 없는 배율 둘뿐이다 |
| **회복 아이템** (MC-RESTORE-BIOLOGICAL-STATE) | Human 이 미뤘다 (HISTORY Q31) — 그 노드는 "체력을 얼마 채운다" 가 아니라 이전 상태로 되돌리는 것이고, 원천(식물 계통 `IP-*`/`IT-*`)이 세계에 정의되어 있지 않다. 원천 문서 [design/Design-Resource-Catalog-R0.md](../../../design/Design-Resource-Catalog-R0.md) 가 Human 승인 대기다 (Q36 과 같은 문서) |
| 감정 도구 | 후보 2 · 6 · 7 뒤다. 지금은 감정할 대상(개체 상태)도 없다 (IE §41 — 위 칸) || 능동 방어 · Aura/Nen · 베이라 사다리의 잠정 조각 전부 | 그 전체의 설계 문서가 없다 (`part_of.grounded: false` — 척추 시각화의 점선). 능동 방어가 요구하는 **행동 안의 시점 판정**은 C019 로 바닥이 섰다 — 남은 것은 문서뿐이다 |
| 다음 수를 읽는다 (MC-PREDICT · MC-OBSERVE 습성) | 위와 같음 — 반쪽을 소유한 시스템(MS-CREATURE-BEHAVIOR)이 DRAFT 다. 초안 [design/Design-Creature-Behavior-R0.md](../../../design/Design-Creature-Behavior-R0.md) 승인 → Inject → 재판정 |
| 지형 · 문명권 준비 갈래 · 희귀 기관 갈래 | 세계 기반(지역 · 문명권 · 거래 주체)이 없다 (overlay.md World 표 ABSENT). 희귀 기관 쪽은 그 위에 **물건이 몸 밖에 놓인다**(후보 7)까지 필요하다 — IS 주입으로 공통 앞칸이 드러났다 |
| 위협도 · 진영 · 도발 | 막는 것은 없다 (HOSTILITY_REASONS 에 항목 추가로 시작) — 아직 어느 Possibility 도 요구하지 않는다 (7 조건 2) |
| Tab 후보 추리기 · 대상 프레임 관계 표시 | 세계의 결손이 아니라 화면의 편의 — Cycle 이 아니라 View 작업 |
| 회피 (MC-EVADE) | R1 §13 이 이후 확장으로만 지정 |

**후보로 올리지 않은 결손 하나**: 기력이 스스로 돌아오지 않는다 (MC-CP-ECONOMY PARTIAL).
어느 상위 갈래를 전진시키는지 근거 문서가 말하지 않아 7 조건 2 를 세울 수 없다 —
밸런스로 다룰지 규칙으로 세울지는 Human 판단이다.
