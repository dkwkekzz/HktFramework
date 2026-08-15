# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 이 항목을 `CLOSED` 로 바꾼다.
항목은 지우지 않는다 — 왜 그렇게 정했는지의 기록이다.

미해결 **3건** · 닫힌 것 5건.

---

## Q2. 전투 Goal 의 World Cause 가 없다 — OPEN

    무엇          MG-OVERCOME-SUPERIOR-OPPONENT 의 `motivation` · `caused_by` 가 비어 있다.
                  MA-HOSTILE-COMBATANT 의 `wants` 도 비어 있다 — 왜 앞을 막는지 모른다.
                  원본이 전투 규칙 문서라 세계의 사정을 공급하지 않기 때문이다.

    영향          Goal Quality Gate(§25.2) 와 Narrative Gate(§25.4) 를 통과하지 못한다.
                  Cycle 을 도는 데는 지장이 없다 — Frontier 는 Possibility 까지만 요구한다.
                  그러나 "왜 이 기능이 존재하는가" 의 최상단이 비어 있는 상태로 누적된다.

    필요한 것     master/root.md 의 Root Game Goal · World Premise (Human 소유)

    선택지        (a) 지금 root.md 를 채우고 M2 로 World Cause 를 확장한 뒤 Cycle 을 연다
                  (b) 전투 Cycle 을 먼저 돌리고 World Cause 는 나중에 붙인다
                      — 그때 기존 MG 의 의미가 흔들릴 수 있다

    DECISION      <PENDING>

---

## Q3. Belief(틀릴 수 있는 믿음)를 전투에 둘 것인가 — OPEN

    무엇          Belief 가 0 건이다. 원본은 결과를 만든 모든 원인을 공개하는 쪽이고(§15.1),
                  그러면 오독이 성립하지 않는다.

    영향          Narrative Gate 의 "Belief 와 객관적 WorldState 가 다를 가능성" 항목.
                  Mystery · Investigation · Reversal 이 전투 층에서는 생기지 않는다.

    선택지        (a) 전투는 완전 공개, 오독은 전투 밖(조사·정보)에서만
                  (b) 전투에도 오독의 여지를 둔다 (상대의 의도는 보이되 상태는 추정)
                      → 원본 §15.1 의 공개 범위와 경계를 다시 그어야 한다

    DECISION      <PENDING>

---

## Q8. 전투 밖 경로가 없다 — OPEN

    무엇          같은 상대를 넘어서는 방법 9개가 전부 전투 안에 있다.
                  회피·교섭·환경 조작·정보로 넘어서는 경로는 Graph 에 없다.

    영향          원본이 전투 문서이므로 당연한 결과이며 억지로 만들지 않았다.
                  다만 "이 상대를 넘어서는 방법이 싸움뿐인가" 는 MMORPG 설계 결정이다.

    선택지        (a) 전투는 전투로만 푼다
                  (b) 전투 밖 경로를 Graph 에 연다 → root.md 와 M2 확장이 선행 (Q2 와 같은 입력)

    DECISION      <PENDING>

---

## 닫힌 질문

    Q1  DRAFT Constraint 3종 승인 여부
    Q4  상대가 내 위험을 읽지 못하면 제약이 위험이 아니다
    Q5  상성을 Break 로 옮기면 Break 가 지배 전략이 되는가
    Q6  Guard 와 Perfect Guard 를 한 Cycle 로 묶는가
    Q7  Constraint Candidate 3종 승격 여부

    CLOSED 사유 (5건 공통)
        Human 지시로 전투 기획서에서 산출한 DC 4종 · CC 3종을 제거했다.
        위 질문들은 전부 그 Constraint 들이 있어야 성립하는 질문이었으므로 함께 닫는다.

        특히 Q4 는 원본에 없는 요구에서 나온 질문이었다 —
        원본 §7 은 "플레이어가 상대의 Flow 를 읽는다" 고 할 뿐
        "모든 위험은 상대가 읽을 수 있어야 한다" 고 하지 않는다.
        그 요구를 Agent 가 세웠기 때문에 생긴 문제이며, 요구가 사라지면 문제도 사라진다.

        Q6 의 실질(Guard 와 Perfect Guard 를 묶을지)은 Constraint 와 무관하게 남아 있다 —
        frontier.md 의 추천 순서에 판단 재료로 남겼다.
