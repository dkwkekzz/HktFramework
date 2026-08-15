# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 이 항목을 `CLOSED` 로 바꾼다.
항목은 지우지 않는다 — 왜 그렇게 정했는지의 기록이다.

미해결 **8건** (전투 영역 첫 주입 · Quality Gate 자가 점검에서 나왔다).

---

## Q1. DRAFT Constraint 3종을 승인하는가 — OPEN · 차단

    무엇          DC-COMBAT-DEFENSE-EARNS-INITIATIVE
                  DC-COMBAT-RISK-BUYS-POWER
                  DC-COMBAT-NO-HARD-COUNTER
                  셋 다 원본 문서에서 Agent 가 해석해 세웠다. 원본은 이것들을
                  "차용한 설계 원리"(§3)로 서술하지 술어로 못 박지 않았다.

    영향          Frontier 6종의 Constraint Evaluation 이 전부 이것에 달려 있다.
                  특히 DEFENSE-EARNS-INITIATIVE 가 승인되지 않으면
                  FR-GUARD-TRADES-BODY-FOR-RESOURCE 의 UNRESOLVED(Q6)가 사라진다.

    선택지        APPROVED   그대로 승인
                  REVISED    문장·requires·prohibits 를 고쳐 승인
                  REJECTED   Constraint 로 두지 않는다 (원리는 남되 설계를 제한하지 않는다)

    DECISION      <PENDING>

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

    무엇          Belief 가 0 건이다. 지금 설계는 모든 원인을 관찰 가능하게 공개하는 쪽이며
                  (DC-COMBAT-PLAYER-CAUSALITY), 그러면 오독이 성립하지 않는다.

    영향          Narrative Gate 의 "Belief 와 객관적 WorldState 가 다를 가능성" 항목.
                  Mystery · Investigation · Reversal 이 전투 층에서는 생기지 않는다.
                  CC-CHOICE-REQUIRES-READABLE-WORLD 를 GLOBAL 로 승격하면 전투 밖에서도
                  좁아진다.

    선택지        (a) 전투는 완전 공개, 오독은 전투 밖(조사·정보)에서만 → CC 를 COMBAT 으로 좁힌다
                  (b) 전투에도 오독의 여지를 둔다 (상대의 의도는 보이되 상태는 추정)
                      → DC-COMBAT-PLAYER-CAUSALITY 의 `observable_cause` 와 경계를 다시 그어야 한다

    DECISION      <PENDING>

---

## Q4. 상대가 내 위험을 읽지 못하면 제약이 위험이 아니다 — OPEN · 설계 결함 후보

    무엇          DC-COMBAT-RISK-BUYS-POWER 는 `risk_is_readable_by_opponent` 를 요구한다.
                  즉 내가 몸을 열면 상대가 그것을 읽고 때려야 위험이 실재한다.
                  그런데 현재 세계의 상대는 C007 의 `control: autonomous` 이고,
                  그 행동은 배회와 단순 반응이다 — 열린 몸을 노리는 판단을 하지 않는다.

    결과          MP-STAKE-EVERYTHING-ON-ONE-BLOW 와 MP-EXPLOIT-OPEN-BODY 의 위험이
                  PvE 에서 한쪽으로만 성립한다. 플레이어는 상대의 틈을 노리지만
                  상대는 플레이어의 틈을 노리지 않는다. Vow 의 위력만 남고 위험이 빠진다.

    선택지        (a) 상대의 판단을 Capability 로 세운다 (MC-OPPONENT-READS-OPENINGS 신설)
                      → Vow / Flow Frontier 의 선행 조건이 하나 늘어난다
                  (b) 위험을 상대의 판단이 아닌 세계 규칙으로 만든다
                      (열린 동안 받는 피해가 규칙으로 커진다)
                      → `risk_is_readable_by_opponent` 를 완화해야 한다
                  (c) PvP 에서만 성립한다고 인정하고 Constraint 에 명시한다

    비고          이것은 Cycle 이 발견한 것이 아니라 Graph 를 세우자 드러난 것이다.
                  FR-FLOW-OPENS-THE-BODY 또는 FR-VOW 를 열기 전에 답이 필요하다.

    DECISION      <PENDING>

---

## Q5. 상성을 Break 로 옮기면 Break 가 지배 전략이 되는가 — OPEN · UNRESOLVED 유지

    무엇          DC-COMBAT-NO-HARD-COUNTER 는 상성의 강한 감각을 피해가 아니라
                  Break 효율에 싣기를 선호한다(원본 §6.3). 그런데 Break 는 이미
                  MP-BREAK-THE-GUARD 의 핵심이고 폭발 구간을 여는 유일한 경로다.
                  강화 요인이 한곳에 모이면 다른 경로가 밀려난다.

    현재 상태     MP-BREAK-THE-GUARD 와 MC-BREAK 의 constraint_evaluation 을
                  `UNRESOLVED` 로 두었다. 임의로 SATISFIED 로 올리지 않았다.

    판정 방법     실측 전에는 알 수 없다. FR-BREAK-OPENS-THE-BURST-WINDOW 와
                  FR-MATCHUP-MAKES-THE-CHOICE 가 둘 다 닫힌 뒤,
                  Break 를 거치지 않는 경로가 실제로 쓰이는지를 플레이로 본다.

    DECISION      <PENDING — 실측 후 재판정>

---

## Q6. Guard 와 Perfect Guard 를 한 Cycle 로 묶는가 — OPEN

    무엇          FR-GUARD-TRADES-BODY-FOR-RESOURCE 만 단독으로 닫으면
                  DC-COMBAT-DEFENSE-EARNS-INITIATIVE 의
                  `defense_success_transfers_initiative` 가 만족되지 않는다.
                  막기는 시간을 살 뿐 공격권을 가져오지 않기 때문이다.

    선택지        (a) 묶는다 — Cycle 이 커지지만 방어 설계가 한 번에 온전해진다
                  (b) 나눈다 — 한 Cycle 동안 Constraint 가 UNRESOLVED 인 것을 감수한다.
                      원본 §21 의 Phase 1 / 2 구분과 같다

    비고          Q1 에서 DEFENSE-EARNS-INITIATIVE 가 REJECTED 되면 이 질문은 사라진다.

    DECISION      <PENDING>

---

## Q7. Constraint Candidate 3종을 승격하는가 — OPEN

    무엇          candidates/CC-SINGLE-BUDGET-FORCES-TRADEOFF.md
                  candidates/CC-CHOICE-REQUIRES-READABLE-WORLD.md
                  candidates/CC-SAME-RULES-FOR-ALL-BODIES.md

    비고          SAME-RULES 는 원본 §22 의 Boss Super Armor 후속 확장과 정면으로 긴장한다.
                  보스를 만들기 전에 정하는 편이 싸다.
                  CHOICE-REQUIRES-READABLE-WORLD 는 Scope(GLOBAL / COMBAT)가 Q3 와 같은 결정이다.

    DECISION      <PENDING>

---

## Q8. 전투 밖 경로가 없다 — OPEN

    무엇          DC-COMBAT-NO-HARD-COUNTER 는 `multiple_valid_approaches` 를 요구한다.
                  현재 그 "여러 방법" 은 전부 전투 안에 있다 (9개 Possibility 전부 COMBAT).
                  같은 상대를 회피·교섭·환경 조작·정보로 넘어서는 경로는 Graph 에 없다.

    영향          원본이 전투 문서이므로 당연한 결과이며 억지로 만들지 않았다.
                  다만 "이 상대를 넘어서는 방법이 싸움뿐인가" 는 MMORPG 설계 결정이다.

    선택지        (a) 전투는 전투로만 푼다 — Constraint 의 범위를 전투 안으로 명시
                  (b) 전투 밖 경로를 Graph 에 연다 → root.md 와 M2 확장이 선행 (Q2 와 같은 입력)

    DECISION      <PENDING>

---

## 닫힌 질문

    없음
