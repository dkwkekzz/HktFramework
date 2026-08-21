# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 **이 파일에서 지운 뒤 결정 내용을
[HISTORY.md](HISTORY.md) 로 옮긴다.**

미해결 **4건** — 닫힌 질문은 HISTORY.md.

[frontier.md](frontier.md) 의 `SELECTED` 는 비어 있다 — 직전 선택
FR-INTERRUPT-THE-STARTUP 은 C019 로 닫혔고 다음 선택은 Human 대기다.
Q29 는 그 선택을 막지 않는다. **Q32 는 아이템 영역의 다음 Cycle 을 막는다** —
장착을 후보로 확정하려면 그 둘의 승인이 먼저다.

번호가 띄엄띄엄한 것은 앞선 질문들이 이미 닫혀 HISTORY 로 갔기 때문이다 —
번호는 재사용하지 않는다.

## Q29. "아는 힘"(통찰)은 독립한 Capability 노드인가 — OPEN

    무엇          C016 이 세계에 세운 통찰(살펴보지 않고도 아는 힘)을 Graph 에서
                  어떻게 잡을 것인가. 지금은 MC-OBSERVE 의 **경로 하나**로 담겨 있고
                  별도 노드가 없다. C016 08 이 "성장 축으로 보면 독립한 노드일 수 있다"
                  를 보고하며 판단을 Master 로 넘겼다.

    영향          지금 당장 막히는 것은 없다 — 통찰은 MC-OBSERVE 안에서 실측으로
                  닫혔고 Frontier 판정도 그 상태로 나왔다.
                  다만 성장 축이 세계에 들어오는 순간(FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY)
                  "무엇을 올리는가" 의 목록이 필요해지고, 그때 통찰이 능력치들과 같은
                  자리에 있어야 하는지가 실제 문제가 된다.

    선택지        (a) 노드를 세우지 않는다 (현행 유지)
                      → 통찰은 MC-OBSERVE 의 경로로 남는다. SCHEMA 의 "required_by 와
                        demanded_by 가 둘 다 비면 노드가 아니다" 를 지킨다 —
                        지금 통찰을 **따로** 요구하는 Possibility 가 하나도 없다.
                        Graph 가 가벼워지는 대신, 성장 축이 올 때 다시 물어야 한다.
                  (b) MC-INSIGHT 를 신설한다
                      → 성장으로 올리는 대상이 명시적으로 잡힌다. 그러나 지금은
                        required_by 를 채울 Possibility 가 없어 노드 규칙을 어긴다.
                        세우려면 "아는 힘으로 감당한다" 는 Possibility 를 먼저
                        세워야 하고, 그것은 OPTIONS 작업이다.
                  (c) 성장 축 Cycle 이 열릴 때로 미룬다
                      → 그때는 요구가 실제로 생기므로 (b) 의 걸림돌이 사라진다.
                        Agent 판단으로는 이쪽이 "필요가 먼저" 원칙에 가장 맞는다.

    DECISION      PENDING

## Q32. IE 주입이 세운 두 Constraint 를 승인하는가 — OPEN · 차단

    무엇          `design/Design-Inventory-Equipment-D1.md`(IE) 주입으로 두 DC 가
                  DRAFT 로 섰다. IS §5.4 · §10 이 후속 문서에 넘긴 영역이고,
                  기존 아이템 DC 4종과 겹치지 않는 새 의미다.

                  DC-ITEM-CAPACITY-IS-FINITE
                      담을 자리도 적용할 자리도 유한하고, 적용할 자리가 훨씬 좁다.
                      몇 개인가는 Cycle 이 소유한다.
                  DC-ITEM-LIVES-IN-ONE-PLACE
                      아이템은 정확히 한 곳에 있다. 저장소가 아이템을 담고
                      다른 저장소의 자리를 가리키지 않는다.

    영향          **차단이다.** 둘 다 MC-EQUIP-ITEM 에 걸려 있고 지금
                  `constraint_evaluation` 이 UNRESOLVED 다. UNRESOLVED 를 안은
                  노드는 Frontier 후보로 확정되지 못하므로, 장착 Cycle 을 후보로
                  올리려면 이 결정이 먼저다.
                  거절하면 IE §49 P2·P3·P4·P9 가 Master 에 자리를 갖지 못한 채
                  Cycle 로만 내려가고, 다음 아이템 Cycle 이 같은 판단을 다시 한다.

    선택지        (a) 둘 다 승인한다
                      → MC-EQUIP-ITEM 의 두 UNRESOLVED 가 SATISFIED 로 바뀌고
                        장착이 Frontier 후보 조건을 갖춘다. Agent 추천.
                  (b) DC-ITEM-CAPACITY-IS-FINITE 만 승인한다
                      → 한도는 서지만 저장소 형태는 Cycle 이 매번 고른다.
                        IE §13.1 이 지적한 사고(정렬이 장착을 깨뜨림)를 막을
                        상위 근거가 없어진다.
                  (c) DC-ITEM-LIVES-IN-ONE-PLACE 만 승인한다
                      → 구조는 서지만 "가방이 유한하다" 가 원칙이 아니게 되어
                        소지 한도를 넣을지 말지를 Cycle 이 정하게 된다.
                  (d) 둘 다 미룬다
                      → 장착 Cycle 이 열릴 때 다시 묻는다. 그때는 이미 구현
                        방향이 잡힌 뒤라 Constraint 가 사후 추인이 된다.

    DECISION      PENDING

## Q33. 장착 효과를 "재계산" 으로 못박을 것인가 — OPEN

    무엇          IE §38 이 장착 효과의 계산 방식을 명시했다 — 장착에 `+5`,
                  해제에 `-5` 를 하는 누적 수정이 아니라 언제나
                  `기본값 + 지금 적용된 것들의 기여` 로 다시 계산한다.
                  이것을 기존 DC-ITEM-HOLDING-IS-NOT-APPLYING(APPROVED)의
                  `prefers` 로 더할 것인가.

    영향          지금 그 DC 는 **증상**을 금지한다 — "장착과 해제를 반복해 값이
                  누적되는 형태". IE 는 그 증상이 나오지 않게 하는 **방법**을
                  공급한다. 방법이 원칙에 없으면 Cycle 마다 다시 고르게 되고,
                  저장·복구에서 값이 두 번 얹히는 사고(IE §39)를 막을 상위 근거가
                  없다. 다만 막히는 것은 없다 — Q32 와 달리 차단이 아니다.

    영향 범위     DC-ITEM-HOLDING-IS-NOT-APPLYING · MC-EQUIP-ITEM ·
                  아이템 Cycle 2 의 03-world-semantic.md

    선택지        (a) prefers 한 줄을 더한다 — status 를 REVISED 로
                      → "유효 값을 기본값과 지금 적용된 것들의 기여로 다시
                        계산하는 것 — 장착·해제 시점에 값을 가감하지 않는다".
                        원본이 "권장한다" 로 썼으므로 prohibits 가 아니라
                        prefers 다 (원본보다 세게 쓰지 않는다). Agent 추천.
                  (b) 더하지 않는다
                      → 방법은 Cycle 소유로 남는다. 기존 prohibits 가 결과만
                        막고 있어 원칙의 완결성은 떨어지지만 어긋나지는 않는다.
                  (c) 별도 DC 로 세운다
                      → 같은 의미가 두 DC 에 나뉘어 앉는다. Agent 는 권하지
                        않는다 — 이것은 독립한 원칙이 아니라 그 DC 의 실행 방식이다.

    DECISION      PENDING

## Q34. 소지 한도는 "아이템의 바닥" 안인가, 다음 칸인가 — OPEN · 차단

    무엇          기존 Frontier 후보 FR-WHAT-YOU-CARRY-CAN-BE-SPENT 의
                  `이 기능이 아닌 것` 이 "무게 · 칸수 같은 소지 제한도 아니다" 로
                  적혀 있다. 그것은 IS §10 이 소지 제한을 범위 밖으로 둔 상태에서
                  쓴 문장이다.

                  IE 는 그 영역을 받아 §48 에서 반대로 배치했다 — 슬롯 모델(§4) ·
                  Stack(§5) · 획득 우선순위와 원자성(§6 · §6.1)을 **Cycle 1(아이템의
                  바닥)이 요구하는 것**으로 넣었다. 같은 Cycle 의 경계가 두 문서에서
                  다르게 그어져 있다.

    영향          **차단이다.** 후보의 `이 기능이 아닌 것` 은 그 Cycle 의 경계를
                  정하는 칸이다 (guides/master-frontier.md). 지금 상태로 Cycle 을
                  열면 01-cycle.md 가 어느 쪽을 옮겨 적을지 정해지지 않는다.

    영향 범위     frontier.md 의 FR-WHAT-YOU-CARRY-CAN-BE-SPENT ·
                  IE §48 의 Cycle 1 행 · MC-USE-ITEM 의 world_shape

    Trade-off     한도를 넣으면 "쓴다 · 줄어든다" 하나였던 Cycle 이 "담을 자리가
                  모자라 못 받는다" 까지 지게 된다. 빼면 IE 의 슬롯 모델 전체가
                  장착 Cycle 로 밀리는데, 장착은 그 위에 서는 층이라 바닥이 없는
                  채로 자리부터 만들게 된다.

    선택지        (a) 후보를 고친다 — 한도를 Cycle 1 에 넣는다
                      → IE §48 을 그대로 따른다. 슬롯 · Stack · 가득 참 판정이
                        "가진 것" 의 바닥과 함께 선다. Cycle 이 커지지만 IE 가
                        말한 대로 이 셋은 쪼개면 어느 것도 플레이로 닫히지 않는다.
                        Agent 추천 — 장착 Cycle 이 바닥 위에 서게 된다.
                  (b) IE §48 을 고친다 — 한도를 장착 Cycle 로 미룬다
                      → 후보를 그대로 둔다. Cycle 1 이 작게 유지되는 대신
                        장착 Cycle 이 자리와 칸을 동시에 지게 된다.
                  (c) 한도만 따로 셋째 칸으로 뺀다
                      → 소지 한도가 그 자체로 플레이 가능한 변화인지 물어야 한다.
                        Agent 판단으로는 아니다 — 할 수 있는 일이 늘지 않고
                        좁아지기만 하므로 단독 Cycle 의 조건(CLAUDE.md 원칙 6)을
                        만족하지 않는다.

    DECISION      PENDING
