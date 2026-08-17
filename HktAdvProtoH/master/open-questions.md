# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 이 항목을 `CLOSED` 로 바꾼다.
항목은 지우지 않는다 — 왜 그렇게 정했는지의 기록이다.

미해결 **6건** · 닫힌 것 5건.

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

## Q9. 반영된 DC 5종의 문안 확정 — OPEN

    무엇          2026-08-15 Human 지시로 전투 기획서의 명시 원칙 5종을 constraints/ 에
                  반영했다 (PLAYER-CAUSALITY · DEFENSE-IS-ACTIVE · POWER-HAS-COST ·
                  SHARED-BUDGET · MATCHUP-SOFT). 반영 자체는 지시받았으나
                  statement / requires / prohibits / prefers 의 **문안은 Agent 추출**이다.
                  첫 반영이 원본보다 세게 써서 제거된 이력이 있으므로 문안 검토가 필요하다.

    영향          차단 아님 — Graph 평가와 Frontier 조건 6 판정은 이 문안 기준으로 이미
                  수행됐다. 문안이 REVISED 되면 해당 평가만 다시 본다.

    선택지        (a) 문안 유지 (APPROVED 확정)
                  (b) 개별 DC 를 REVISED — 어느 항목이 원본과 다른지 지목

    DECISION      <PENDING>

---

## Q10. R1 전면 개정 뒤 DC 5종의 지위 — OPEN

    무엇          2026-08-17 Human 이 전투 기획서를 R1 로 전면 개정했다
                  ("가장 단순한 공격/방어 공식 먼저"). DC 5종이 인용하는 구판(R0) § 번호와
                  일부 근거(공방 심리전 §1.1 · Flow §7 · Vow §12 · 상성 §6)가 현행 문서에서
                  삭제되거나 §14 확장 순서로 이연되었다. DC 의 방향 자체(능동 방어 ·
                  집중의 대가 · 공유 예산 · 소프트 상성)는 R1 §14·§15·핵심 원칙과 일치하나,
                  개정 후 문안·인용 재확정은 Human 소유다 (Q9 문안 검토와 병합 가능).

    영향          차단 아님 — R1 이 지정한 다음 층(기본 공식)에 실질 적용되는 DC 는
                  DC-COMBAT-PLAYER-CAUSALITY 뿐이고 SATISFIED 다.
                  DC-COMBAT-DEFENSE-IS-ACTIVE 는 C010·C011 로 이미 세계에서 충족되어 있어
                  "이번 층의 방어는 능력치다"(R1 §8) 와 충돌하지 않는다 — DC 주석이
                  수동 감쇄 바닥을 명시적으로 허용한다.

    선택지        (a) DC 5종 유지 — 인용은 구판 표기로 읽는다 (현재 상태)
                  (b) R1 기준으로 해당 DC 를 REVISED — 인용과 문안을 현행 문서로 재추출
                  (c) 이연 층에만 근거를 둔 DC(MATCHUP-SOFT · POWER-HAS-COST)를
                      해당 층의 재설계 문서가 나올 때까지 보류 표시

    DECISION      <PENDING>

---

## Q11. R1 §14 C009(Critical Chance) 는 DC-COMBAT-PLAYER-CAUSALITY 와 충돌 — OPEN

    Conflict      R1 §14 C009 층은 Critical Chance / Critical Damage 를 예고하지만
                  DC-COMBAT-PLAYER-CAUSALITY 는 random_critical 을 prohibits 한다.
                  R1 자신도 "결정론을 중요하게 여긴다면 Critical 자체를 넣을지 여기서
                  다시 판단한다 · C008 은 Critical 없이도 완전히 동작해야 한다" 고 유보했다.

    Affected      DC-COMBAT-PLAYER-CAUSALITY · R1 §14 C009 층 · (참고) 구판 §10 의
                  조건부 Critical(비확률) 설계와 MC-CONDITION-STACKING

    Trade-off     (a) 확률 Critical 을 넣지 않는다 — 그 층을 건너뛰거나 구판 §10 방향의
                      조건부(비확률) Critical 로 재설계 → DC 유지, 전투 정체성 유지
                  (b) DC 를 REVISED 하여 확률 Critical 허용 → 전통 MMORPG 감각을 얻는 대신
                      "같은 상태 → 같은 결과" 원칙과 기존 Cycle 검증 근거가 흔들린다

    Expected      결정 전까지 Frontier 에 확률 Critical 후보를 올리지 않는다 (현재 상태).

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
