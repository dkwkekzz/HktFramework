# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 **이 파일에서 지운 뒤 결정 내용을
[HISTORY.md](HISTORY.md) 로 옮긴다.**

미해결 **1건** — 닫힌 질문은 HISTORY.md.

[frontier.md](frontier.md) 의 `SELECTED` 는 FR-WHAT-YOU-CARRY-CAN-BE-SPENT
(아이템의 바닥)이고 Cycle Stage 1 이 그것을 받는다. 아래 질문은 그 Cycle 을
막지 않는다.

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
