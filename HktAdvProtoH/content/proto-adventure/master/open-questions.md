# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 **이 파일에서 지운 뒤 결정 내용을
[HISTORY.md](HISTORY.md) 로 옮긴다.**

미해결 **3건** — 닫힌 질문은 HISTORY.md.

Frontier 선택은 **비어 있다** — [frontier.md](frontier.md) 의 `SELECTED` 가 없음이고
도는 Cycle 도 없다. 후보 둘 중 하나를 Human 이 고르는 것이 다음이며,
Q29 · Q31 은 그 선택을 막지 않는다. **Q30 은 아이템 후보를 고를 때 함께 답해야 한다** —
그 Cycle 이 지고 갈 Constraint 넷이 아직 승인되지 않았다.

번호가 Q29 인 것은 TG(지목) 주입에서 열린 Q23~Q28 이 이미 닫혀 HISTORY 로 갔기
때문이다 — 번호는 재사용하지 않는다.

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

## Q30. 아이템 Constraint 넷을 승인하는가 — OPEN

    무엇          `design/Design-Item-System-R0.md` 주입으로 DRAFT 넷이 섰다.
                  Constraint 의 승격은 Human 만 한다 (CLAUDE.md 원칙 19).

                  DC-ITEM-KIND-IS-DATA-NOT-BRANCH
                      종류 이름은 정의를 찾는 열쇠일 뿐 규칙의 분기 조건이 아니다
                  DC-ITEM-CAPABILITY-COMES-FROM-GRANTS
                      성질(IP-*)은 세계 유래만이고 용도는 종류가 가진다.
                      능력 판정은 성질 조회가 아니라 "지금 무엇을 주는가" 로 한다
                  DC-ITEM-HOLDING-IS-NOT-APPLYING
                      가지고 있는 것만으로는 몸이 달라지지 않는다. 풀면 정확히 원복된다
                  DC-ITEM-CHANGE-IS-ONE-UNIT
                      효과와 수량은 함께 변하거나 함께 변하지 않는다

    영향          아이템 Cycle 이 이 넷을 Active Constraint 로 지고 간다. 승인 없이
                  Cycle 을 열면 그 Cycle 의 Constraint Eval 이 DRAFT 를 근거로 서게 되고,
                  나중에 어느 하나가 거절되면 이미 닫힌 규칙을 되돌려야 한다.
                  특히 두 번째는 구현 형태를 직접 가른다 — 승인되면 채굴 판정이
                  "곡괭이인가" 에서 "지금 무엇을 주는가" 로 바뀐다.

    선택지        (a) 넷 다 승인한다
                      → 아이템 Cycle 이 곧바로 열린다. 넷 다 지금 세계의 실제 결손에서
                        나왔고 서로 충돌하지 않는다 (Agent 판정).
                  (b) 일부만 승인한다
                      → 승인되지 않은 것은 Cycle 의 Constraint 목록에서 빠진다.
                        빼도 Cycle 은 열리지만 그 자리의 판단은 Cycle 이 매번 새로 한다.
                  (c) 문안을 고쳐 다시 낸다
                      → 원본 문서(IS §7)와 함께 고친다. 문서가 원본이고 DC 는 번역이다.

    DECISION      PENDING

## Q31. 회복 아이템의 원천을 세계에 세울 것인가 — OPEN

    무엇          아이템 사용 층의 첫 적용처가 `MC-RESTORE-BIOLOGICAL-STATE` 인데,
                  그것을 주는 아이템의 정의(IT-*)가 없다. BW §8 은 원천(회귀초)을
                  이름으로만 대고 ID 를 주지 않았고, Q22 의 광물 정의는 식물을
                  범위 밖으로 두었다.

    영향          아이템 Cycle 1(아이템의 바닥)은 이것 없이도 닫힌다 — 지금 세계에 있는
                  것(돌·곡괭이)만으로 "쓴다 · 줄어든다" 를 세울 수 있다. 다만 그 Cycle 이
                  세우는 효과가 무엇을 되돌리는지는 임의의 수치 회복이 되기 쉽고,
                  그러면 `MC-RESTORE-BIOLOGICAL-STATE` 는 여전히 MISSING 으로 남는다
                  (그 노드는 "체력을 얼마 채운다" 가 아니라 "이전 상태로 되돌린다" 다).

    선택지        (a) 지금 세운다
                      → 식물 계통의 IP/IT 를 Q22 와 같은 방식(origin_trace 필수)으로
                        정의한다. Master 작업 한 바퀴가 더 든다.
                  (b) 아이템 Cycle 1 이후로 미룬다
                      → 먼저 "쓴다" 를 세우고, 무엇을 쓰는가는 돌·곡괭이로 족하다고 본다.
                        회복은 그 다음 Cycle 이 원천과 함께 가져온다.
                  (c) 회복을 이 갈래에서 떼어낸다
                      → 수치 회복은 아이템이 아닌 다른 경로(휴식 등)로 두고,
                        `MC-RESTORE-BIOLOGICAL-STATE` 는 자원 갈래로만 남긴다.

    DECISION      PENDING
