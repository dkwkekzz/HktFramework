# Frontier — ITEM 트랙

아이템(IS) · 인벤토리(IE) 도메인의 후보와 지금 도는 것을 담는다. 트랙 규칙과 트랙 간
판단은 [README.md](README.md), 읽는 법은 guides/master-frontier.md 소유다.

    기준 Overlay   master/overlay.md — 아이템의 바닥(C020) · 자리의 유한함(C022) ·
                   적용(C023) 까지 닫혔다. 아이템(IS) · 인벤토리(IE) 주입 반영

## 한눈에 보기

| FR | 기능 | 이것이 무엇인가 | 세계에 없는 것 | 크기 |
|---|---|---|---|---|
| FR-ONE-SLOT-ONE-ITEM | **한 자리에는 하나** | 이미 찬 자리에 다른 것을 걸면 빼기와 걸기가 한 번에 일어난다. 가방이 가득해도 바꿔 끼우는 것은 된다 | 교체라는 단위 · 가득 찬 상태의 비대칭 | 작음 |
| FR-SEE-BEFORE-YOU-WEAR | **걸기 전에 안다** | 걸면 무엇이 어떻게 달라지는지를 걸기 전에 세계가 계산해 보여 준다 | 적용하지 않은 채 계산한 결과 | 아주 작음 |
| FR-ARRANGE-WHAT-YOU-CARRY | **자리를 손으로 정리한다** | 담긴 것을 옮기고 맞바꾸고 겹친 것을 나누고 정렬한다 | 자리 사이의 이동 · 나누기 · 정렬 | 작음 |
| FR-MATERIALS-BECOME-SOMETHING-ELSE | **재료가 다른 것이 된다** | 가진 재료를 정해진 조합으로 다른 것으로 바꾼다 | 제작법이라는 데이터와 그것을 평가하는 자리 | 중간 |
| FR-THINGS-LIE-IN-THE-WORLD | **물건이 몸 밖에 놓인다** | 아이템이 누구의 것도 아닌 채로 세계의 한 자리에 놓인다 | 위치를 가진 아이템 · 줍기 · 버리기 · 소유 · 소멸 | 큼 |

## 후보

### FR-ONE-SLOT-ONE-ITEM — 한 자리에는 하나

    이것이 무엇인가    한 자리에는 하나만 있다. 이미 찬 자리에 다른 것을 걸면 빼는 것과
                       거는 것이 **한 번**에 일어난다. 플레이어에게 그것은 두 동작이
                       아니라 하나다
    세계에 생기는 것    ① 교체가 하나의 성공 단위다 — 둘 중 하나가 성립하지 않으면
                          아무것도 일어나지 않는다 (IE §17 · Invariant 5)
                       ② 가득 찬 가방에서의 **비대칭** — 그냥 푸는 것은 담을 곳이 없어
                          막히고, 바꿔 끼우는 것은 된다. 나온 것이 들어간 것의 자리를
                          쓰기 때문이다 (IE §15 · §16.1)
                       ③ 그 둘의 사유가 각각 다른 코드로 온다
    이 기능이 아닌 것   걸기·풀기 자체가 아니다 (**C023 이 세웠다**).
                       자리 수를 늘리는 것이 아니다.
                       끌어다 놓는 조작이 아니다 — 그것은 표면이다 (IE §18~§20 `[VIEW]`).
                       가방 안에서 자리를 바꾸는 것도 아니다 (FR-ARRANGE-WHAT-YOU-CARRY)
    이미 있는 것        **C023 이 세운 적용 전부.** 그리고 C020 이 세운 "검증 → 효과 →
                       소모가 한 단위" 형태(`world/rules/item-use.ts`)가 원자성의
                       선례로 이미 있다 — 시작과 완료 사이에 세계가 움직였을 수 있으므로
                       완료 시점에 다시 검증한다는 것까지 같다
    Playable Result    가방이 가득 차 있어도 걸고 있던 것을 새것으로 바꿔 낄 수 있다.
                       같은 상태에서 그냥 풀려고 하면 자리가 없다는 사유가 온다
    Observable Result  교체 뒤 새것의 효과만 있고 옛것의 효과는 없다. 실패한 교체는
                       걸린 것도 지닌 것도 값도 바꾸지 않는다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE
    Missing / Partial  **MC-EQUIP-ITEM (PARTIAL — C023)** — 이 후보가 그 노드의
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
    7 조건             1 MC-EQUIP-ITEM 이 PARTIAL · 2 같은 갈래를 전진 · 3 실측 가능 ·
                       4 한 Cycle · 5 새 World 규칙(교체라는 단위) · 6 양립 ·
                       7 이후 모든 자리 조작이 이 원자성을 재사용
    의존               **없다 — C023 이 그 앞을 세웠다.** 걸린 것이 있으므로 바꿔 낄
                       대상이 세계에 있다. 지금 찬 자리에 걸려 하면 `no-empty-slot` 으로
                       거절되며, 그것을 성공 경로로 바꾸는 것이 이 후보다.
                       IE §48 은 원래 이것을 장착과 같은 Cycle 에 두었다 —
                       C023 이 앞 절반만 닫았으므로 이 후보가 그 나머지다
    Status             PROPOSED

### FR-SEE-BEFORE-YOU-WEAR — 걸기 전에 안다

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
    이미 있는 것        **C023 의 유효 값 재계산.** 그것이 **함수로 서 있으므로** 이 후보는
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
                       보여 준다. FR-ONE-SLOT-ONE-ITEM 과 같은 사유의 예외다
    원본 근거          IE §37 · §21 · §48 (Cycle 2)
    Active Constraints DC-WORLD-OWNS-THE-SURFACE-LIST · DC-ITEM-HOLDING-IS-NOT-APPLYING
    Constraint Eval    SATISFIED — 미리 본 값도 세계가 계산해 싣는다(SURFACE-LIST).
                       미리 보는 것은 적용이 아니므로 몸은 한 톨도 바뀌지 않는다(HOLDING)
    Why one Cycle      아주 작다. **FR-ONE-SLOT-ONE-ITEM 에 얹어 한 Cycle 로 돌아도 된다**
                       — 따로 세운 것은 그것이 없어도 C023 이 완결되었기 때문이지,
                       별도 Cycle 이어야 해서가 아니다. 크기 판단은 Human 몫이다
    7 조건             1 노드 아님(위 사유) · 2 고르는 일을 판단으로 만든다 ·
                       3 실측 가능 · 4 한 Cycle · 5 **약함** — 새 규칙이라기보다 기존
                       계산의 관찰 확장이다. 이 칸이 약한 것을 감추지 않는다 ·
                       6 양립 · 7 이후 제작·성장의 "하면 어떻게 되는가" 가 재사용
    의존               **없다 — C023 이 유효 값을 함수로 세웠다.**
    Status             PROPOSED

### FR-ARRANGE-WHAT-YOU-CARRY — 자리를 손으로 정리한다

    이것이 무엇인가    자리에 담긴 것을 사람이 **골라서** 옮기고, 맞바꾸고, 겹친 묶음을
                       나누고, 한 번에 정렬한다. C022 는 자리를 만들지만 그 배치를
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
    이미 있는 것        C022 가 세운 자리 · 겹침 한도 · 원자성 · 자리 관찰.
                       이 후보는 그 위에 **배치를 바꾸는 행동**만 더한다
    Playable Result    가득 찬 가방에서 흩어진 같은 종류를 한 자리로 모아 자리를 만든다
    Observable Result  옮긴 뒤의 배치가 그대로 보이고, 안 되는 조작은 사유가 온다.
                       정렬해도 걸어 둔 것은 흔들리지 않는다 (IE §46 Test 12)
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-ADAPT-BY-RESOURCE
    Missing / Partial  **Capability 노드를 목표로 삼지 않는다** — 배치를 바꾸는 것은
                       할 수 있는 일을 늘리지 않는다. FR-ONE-SLOT-ONE-ITEM ·
                       FR-SEE-BEFORE-YOU-WEAR 와 같은 사유의 예외다
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
    의존               **없다 — C022 가 이미 섰다.** 장착과는 무관하므로
                       FR-ONE-SLOT-ONE-ITEM · FR-SEE-BEFORE-YOU-WEAR 와 순서를 다툴
                       이유가 없다.
                       다만 **이 후보를 세울지 자체가 Human 결정 대기다** — open-questions
                       Q37 이 그것을 묻고 있고(자리에 이름을 줄 것인가), 이 후보가 그
                       질문의 (b) 안이다. Human 이 (a)(현행 유지)를 고르면 이 후보는 지운다
    Status             PROPOSED

### FR-MATERIALS-BECOME-SOMETHING-ELSE — 재료가 다른 것이 된다

    이것이 무엇인가    가진 재료를 정해진 조합으로 **다른 것**으로 바꾼다. 캔 돌이 그
                       자체로는 쓸모가 없고 무엇으로 바뀌어야 값을 갖는 자리다
    세계에 생기는 것    ① 제작법이 데이터다 — 재료 · 결과물 · 요구 조건. 새 항목이
                          규칙 코드를 열지 않는다 (IS §5.5)
                       ② 지금 만들 수 있는 것과 **무엇이 모자라 못 만드는지**가 실행
                          전에 보인다
                       ③ 재료 감소와 결과물 생성이 하나의 성공 단위다 — 실패하면
                          재료가 한 톨도 줄지 않는다
                       ④ 제작 맥락 — 특정 자리·도구를 요구하는 제작 (IS §5.5 마지막 줄)
    이 기능이 아닌 것   장착이 아니다 (**C023 이 세웠다** — 만든 것이 쓸모를 가지려면 그것이 먼저다).
                       세계에 놓인 재료가 아니다 (FR-THINGS-LIE-IN-THE-WORLD).
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
    의존               **없다 — C023(장착)이 그 앞을 세웠다.** IS §6 의 순서 그대로다 —
                       만든 것이 쓸모를 가지려면 걸 수 있어야 한다. 소모(C020)는 이미 섰다
    Status             PROPOSED

### FR-THINGS-LIE-IN-THE-WORLD — 물건이 몸 밖에 놓인다

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
    의존               **없다 — C023(장착)이 그 앞을 세웠다** — IE §35 의 "걸어 둔 것을 내려놓는 길은
                       담을 곳을 거치지 않는다" 가 이 후보의 항목 ⑤ 이고, 걸린 것이
                       없으면 그 비대칭이 성립하지 않는다. IS §6 도 같은 순서다.
                       **이 후보의 Stage 1 이 답해야 할 질문이 하나 열려 있다** —
                       open-questions Q38 (C022 가 세운 "덜어냄" 과 IE §34 의 "버리기" 가
                       같은 행동인가). 그 답이 이 후보의 크기를 가른다
    Status             PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

트랙 안의 순서는 Agent 가 정한 것이 아니라 **IS §6 이 이미 그은 것**이다 —
바닥 → 장착 → 제작 → 세계의 아이템. 앞의 셋이 닫혔으므로 남은 것은 그 뒤다.

```text
  (바닥 C020 · 자리 C022 · 적용 C023 — 닫혔다)
        ↓
  FR-ONE-SLOT-ONE-ITEM              한 자리에는 하나
        ↓
  FR-SEE-BEFORE-YOU-WEAR            걸기 전에 안다
        ↓
  FR-MATERIALS-BECOME-SOMETHING-ELSE 재료가 다른 것이 된다
        ↓
  FR-THINGS-LIE-IN-THE-WORLD        물건이 몸 밖에 놓인다

  FR-ARRANGE-WHAT-YOU-CARRY         자리를 손으로 정리한다 ← 아무 때나. 순서가 자유롭다
```

```text
ONE-SLOT · SEE-BEFORE   **C023 이 남긴 절반과 덤이다.** 교체는 MC-EQUIP-ITEM 을 PARTIAL 에서
                        끝까지 밀고, 미리보기는 C023 이 세운 유효 값 재계산을 적용하지 않은
                        채로 한 번 더 부르는 일이다. 둘 다 작고, 둘을 한 Cycle 로 묶어도 된다 —
                        IE §48 의 Cycle 2 가 원래 셋을 한 묶음으로 그렸다

MATERIALS (제작)        C023 뒤. 만든 것이 쓸모를 가지려면 걸 수 있어야 한다 (IS §6) —
                        이제 걸 수 있다

THINGS-LIE (세계의      후보 중 여는 것이 가장 넓다 — 전리품 · 드롭 · 거래 · C017 의 미도달
   아이템)              규칙이 전부 이 위에 얹힌다. 대신 가장 크다. IE §35 의 앞칸도 C023 이 섰다

ARRANGE (자리 정리)     7 조건 2·5 가 약하다 — 새 게임 의미보다 편의 쪽이다. 급하지 않고,
                        **세울지 자체가 Q37 의 답을 기다린다.** 다만 화면 쪽에서 타일뷰·드래그를
                        하려면 이 후보가 세우는 "칸 인덱스" 가 있어야 한다 (C023 08 다음으로 넘기는 것 ②)
```

## SELECTED

```text
없음 — Human 선택 대기
```

    Agent 추천은 **FR-ONE-SLOT-ONE-ITEM** — 이 트랙에서 유일하게 Capability 를 끝까지
    미는 것이고(MC-EQUIP-ITEM PARTIAL → IMPLEMENTED), 작으며, 지금 세계가
    `no-empty-slot` 으로 거절하는 자리를 정상 성공 경로로 바꾼다.
    FR-SEE-BEFORE-YOU-WEAR 를 얹어 한 Cycle 로 돌아도 된다.

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.
트랙 밖(세계 기반 등)의 결손은 [README.md](README.md) 의 같은 절에 있다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **영속** (IE §39) | 세계에 저장·복구라는 개념이 없다. 걸어 둔 것이 다시 켰을 때 그대로인가, 로드를 두 번 해도 값이 누적되지 않는가(IE §46 Test 13)는 영속이 설 때 함께 온다. IE §48 이 이 절을 어느 Cycle 에도 매지 않은 이유다 |
| **자리 잠금·해금** (IE §40) | 성장 축이 세계에 없다. 자리가 처음부터 다 열려 있는지, 무엇을 해야 열리는지는 "무엇으로 자라는가" 가 선 뒤의 이야기다 (IE §48 — 어느 Cycle 에도 매이지 않는다) |
| **아이템 개체화** (IE §41) | 같은 종류끼리 상태가 달라야 할 이유가 아직 없다 (DC-GROWTH-DEFINITION-INSTANCE-SPLIT · IS §2.1). 내구도·강화·각인처럼 개체마다 다른 값이 생기는 층이 오면 그때 선다 |
| **지속 효과 · 재사용 제한** (IS §5.3 의 남은 줄) | 그 반쪽을 소유한 노드가 MC-CONDITION-STACKING 인데 `part_of.grounded: false` 다 — 조건 층의 설계 문서가 없어 후보의 Target 으로 세울 수 없다 (guides/master-frontier.md Must Not). 지금 세계의 조건 얼개는 이름도 지속 시간도 없는 배율 둘뿐이다 |
| **회복 아이템** (MC-RESTORE-BIOLOGICAL-STATE) | Human 이 미뤘다 (HISTORY Q31) — 그 노드는 "체력을 얼마 채운다" 가 아니라 이전 상태로 되돌리는 것이고, 원천(식물 계통 `IP-*`/`IT-*`)이 세계에 정의되어 있지 않다. 원천 문서 [design/Design-Resource-Catalog-R0.md](../../../../design/Design-Resource-Catalog-R0.md) 가 Human 승인 대기다 (Q36 과 같은 문서) |
| 감정 도구 | FR-MATERIALS-BECOME-SOMETHING-ELSE · FR-THINGS-LIE-IN-THE-WORLD 뒤다 (장착은 C023 으로 섰다). 지금은 감정할 대상(개체 상태)도 없다 (IE §41 — 위 칸) |
