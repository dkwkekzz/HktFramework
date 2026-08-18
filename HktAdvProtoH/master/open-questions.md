# Open Questions — Human 결정 대기

Master Layer 작업 중 Agent 가 **임의로 결정하지 않고 남긴 것**들이다.
Constraint 승인 · Constraint 충돌 · 설계 공백 · Trade-off 가 여기 모인다.

```text
Agent 가 쓴다      질문 · 영향 범위 · 선택지 · 각 선택의 결과
Human 이 답한다    DECISION 줄
```

답이 정해지면 해당 Node/Constraint 에 반영하고 **이 파일에서 지운 뒤 결정 내용을
[HISTORY.md](HISTORY.md) 로 옮긴다.** 여기에는 아직 답이 없는 것만 남는다 —
닫힌 질문이 쌓이면 매번 읽어야 하는 문서가 무거워진다.

미해결 **6건** — Q2 · Q3 · Q8 · Q11 · Q15 · Q16 (닫힌 질문은 HISTORY.md).

---

## Q2. 전투 Goal 의 World Cause 가 없다 — OPEN

    무엇          MG-OVERCOME-SUPERIOR-OPPONENT 의 `motivation` · `caused_by` 가 비어 있다.
                  MA-HOSTILE-COMBATANT 의 `wants` 도 비어 있다 — 왜 앞을 막는지 모른다.
                  원본이 전투 규칙 문서라 세계의 사정을 공급하지 않기 때문이다.

    영향          WHY Quality Gate(정책 §15)의 "왜 원하는지 설명할 수 있는가" 를 채우지 못한다.
                  (Narrative 는 개정 정책에서 보조 규칙(§11)이 되어 별도 Gate 가 아니다.)
                  Cycle 을 도는 데는 지장이 없다 — Frontier 는 Possibility 까지만 요구한다.
                  그러나 "왜 이 기능이 존재하는가" 의 최상단이 비어 있는 상태로 누적된다.
                  2026-08-18 GR(Growth) 주입 이후 무게가 늘었다 — Class/Item 은
                  origin_trace(World Cause) 필수라서(DC-GROWTH-CLASS-ORIGIN-TRACE APPROVED)
                  이것이 닫히기 전에는 성장 콘텐츠 노드(CL-*/IT-*)를 한 개도 만들 수 없다.

    필요한 것     master/root.md 의 Root Game Goal · World Premise (Human 소유)

    선택지        (a) 지금 root.md 를 채우고 WHY 단계로 World Cause 를 확장한 뒤 Cycle 을 연다
                  (b) 전투 Cycle 을 먼저 돌리고 World Cause 는 나중에 붙인다
                      — 그때 기존 MG 의 의미가 흔들릴 수 있다

    DECISION      <PENDING>

---

## Q3. Belief(틀릴 수 있는 믿음)를 전투에 둘 것인가 — OPEN

    무엇          Belief 가 0 건이다. 원본은 결과를 만든 모든 원인을 공개하는 쪽이고(§15.1),
                  그러면 오독이 성립하지 않는다.

    영향          개정 정책에서 Belief 는 필요할 때만 만드는 보조 Node 다(§5.3 · §11) —
                  차단은 아니나, Mystery · Investigation · Reversal 이 전투 층에서는
                  생기지 않는다는 설계 폭의 문제는 그대로 남는다.

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
                  (b) 전투 밖 경로를 Graph 에 연다 → root.md 와 WHY/OPTIONS 확장이 선행 (Q2 와 같은 입력)

    DECISION      <PENDING>

---

## Q11. R1 §14 Critical 층(Critical Chance) 는 DC-COMBAT-PLAYER-CAUSALITY 와 충돌 — OPEN

    Conflict      R1 §14 Critical 층은 Critical Chance / Critical Damage 를 예고하지만
                  DC-COMBAT-PLAYER-CAUSALITY 는 random_critical 을 prohibits 한다.
                  R1 자신도 "결정론을 중요하게 여긴다면 Critical 자체를 넣을지 여기서
                  다시 판단한다 · C010(기본 공식)은 Critical 없이도 완전히 동작해야 한다" 고
                  유보했다.

    Affected      DC-COMBAT-PLAYER-CAUSALITY · R1 §14 Critical 층 · MC-CONDITION-STACKING

    Trade-off     (a) 확률 Critical 을 넣지 않는다 — 그 층을 건너뛰거나, 조건부(비확률)
                      Critical 로 재설계한다. 후자를 고르면 그 층의 설계 문서가 먼저
                      필요하다 (2026-08-18 Q12 — 근거는 현행 두 문서에서만 온다)
                      → DC 유지, 전투 정체성 유지
                  (b) DC 를 REVISED 하여 확률 Critical 허용 → 전통 MMORPG 감각을 얻는 대신
                      "같은 상태 → 같은 결과" 원칙과 기존 Cycle 검증 근거가 흔들린다

    Expected      결정 전까지 Frontier 에 확률 Critical 후보를 올리지 않는다 (현재 상태).

    DECISION      <PENDING>

---

## Q15. GR 을 셋째 근거 문서로 추가 — "근거 문서는 둘뿐" 결정의 개정 — OPEN

    무엇          2026-08-18 Q12 결정은 근거 문서를 R1 · DT 둘로 한정했다.
                  이번 주입 산출물(DC-GROWTH-* · SCHEMA growth 절 · growth-graph.md)은
                  GR 을 인용한다 — provenance 명시가 주입 공정의 MUST 라서 피할 수 없다.

    영향          결정 전에는 graph/*.yaml 의 기존 노드(전투)에 GR 인용을 섞지 않는다
                  (현재 상태 — 이번 주입은 constraints/ 와 growth/ 만 GR 을 인용한다).

    선택지        (a) GR 을 셋째 근거로 공식 추가 — 인용 키 `GR §x` 확정,
                      constraints/README 의 "둘뿐" 문구를 셋으로 개정
                  (b) GR 은 Growth 영역 한정 근거로만 인정 — 전투 노드에는 계속 금지

    DECISION      <PENDING>

---

## Q16. GR §41 Growth Quality Gate 의 guides/ 반영 — OPEN

    무엇          GR §41 은 Class/Item/Growth 체크리스트를 정의한다. 이것은 Constraint
                  (설계 형태의 제한)가 아니라 작업 완료 조건(DONE WHEN)의 성격이라
                  DC 로 만들지 않았다. 반영처는 guides/master-graph.md 또는 신규
                  guides/master-growth.md 인데, guides/ 수정은 Inject 범위 밖이다.

    영향          반영 전에는 첫 CL/IT 노드를 만들 때 §41 점검이 공정에 강제되지 않는다.
                  Q2 가 닫히기 전에는 실해가 없으나, 첫 성장 탐색 전에는 필요하다.

    선택지        (a) guides/master-graph.md 에 Growth 절 추가 (공정 문서 수정 승인)
                  (b) 신규 guides/master-growth.md 분리
                  (c) 반영하지 않고 GR §41 직접 참조로 운용

    DECISION      <PENDING>
