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

미해결 **7건** — Q2 · Q3 · Q8 · Q11 · Q17 · Q18 · Q19 (닫힌 질문은 HISTORY.md).

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

    갱신          2026-08-19 BW(베이라 세계관) 주입으로 입력이 도착했다 — root.md 가
                  채워졌고(Q19) MW-* 6종과 일반 원리(조우 → Goal — BW §26~§27)가 생겼다.
                  남은 것은 배선이다: 기존 전투 Goal 을 베이라의 어떤 세계 사정
                  (어느 지역의 어떤 조우)에 잇는가 — 이것은 주입이 아니라 WHY 확장
                  몫이며 BW 는 구체 조우 상태를 명명하지 않았다.

    선택지        (a) WHY 확장을 실행해 전투 Goal 의 caused_by / motivation 을 배선한다
                  (b) 전투 트랙(Penetration 등)을 먼저 마무리하고 배선은 그 뒤에 한다

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

    갱신          2026-08-19 BW 주입으로 전투 밖 경로의 원형이 Graph 에 생겼다 —
                  MG-ACQUIRE-RARE-ORGAN 의 대안 5종 중 4종이 비전투다 (BW §27).
                  다만 "같은 상대를 넘어서는"(MG-OVERCOME-SUPERIOR-OPPONENT) 비전투
                  경로는 여전히 없다 — 그 확장은 OPTIONS 몫이다.

    선택지        (a) 전투는 전투로만 푼다
                  (b) 전투 밖 경로를 Graph 에 연다 → WHY/OPTIONS 확장이 선행 (Q2 와 같은 입력)

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

## Q17. BW(베이라 세계관) 주입 DC 5종(DRAFT) 승인 — OPEN · 차단

    무엇          2026-08-19 design/Master-World-Beira.md(BW) 주입으로 만든
                  DC-WORLD-RESOURCE-ADAPTATION-TRACE · CREATURE-FROM-PRESSURE ·
                  COMBAT-IS-ONE-POSSIBILITY · PLAYER-UNFIXED-PATH ·
                  PROGRESSION-IS-REACH 5종이 DRAFT 다. 문안(statement / requires /
                  prohibits / prefers)은 Agent 추출이다 — BW 의 GOOD/BAD 명시 원칙만
                  옮겼고 "가능하면"(§11)은 prefers 로 남겨 원본보다 세게 쓰지 않았다.

    영향          차단 — 승인 전에는 BW 유래 노드의 constraint_evaluation 이
                  UNRESOLVED 로 남고, WORLD scope 의 Filter 로 쓸 수 없다.
                  UNRESOLVED 를 SATISFIED 로 간주하지 않으므로 탐험 영역 Frontier
                  후보도 이 승인 전에는 세우지 않는다.

    선택지        (a) 5종 일괄 APPROVED
                  (b) 개별 REVISED — 어느 항목이 원본과 다른지 지목
                  (c) 일부 REJECTED

    DECISION      <PENDING>

---

## Q18. BW 의 전투 교차분 — 기존 전투 노드와의 매핑 — OPEN

    무엇          BW 는 세계관 문서지만 §20~§28 이 전투 이름들을 명명하며, 다수가
                  기존 전투 노드와 같은 의미로 보인다. 같은 의미를 새 이름으로 만들지
                  않기 위해(DC-GROWTH-NO-CAPABILITY-DUPLICATION · 주입 Guide Must)
                  아래는 주입하지 않고 매핑 후보로만 남겼다. 근거 영역 분리 규칙
                  (HISTORY Q15 — 전투 노드의 근거는 R1/DT)이 있어 Agent 가 확정하지
                  않는다.

                  Agent 매핑 판단 (≙ = 같은 의미로 재사용 제안):
                    MG-OVERCOME-CREATURE        ≙ MG-OVERCOME-SUPERIOR-OPPONENT (§26)
                    MP-DEFEAT-BY-COMBAT + 8분기 (§28):
                      MP-BREAK-DEFENSE          ≙ MP-BREAK-THE-GUARD
                      MP-READ-AND-PUNISH        ≙ MP-READ-AND-COUNTER
                      MP-OVERWHELM              ≙ MP-OUTGROW-THE-OPPONENT (근사)
                      MP-EXPLOIT-WEAKNESS       ≙ MP-EXPLOIT-OPEN-BODY / MP-MATCH-WEAPON-TO-ARMOR (분산)
                      MP-OUTLAST                ≙ MP-HOLD-FORTIFIED (근사)
                      MP-CONTROL-MOVEMENT · MP-INTERRUPT · MP-WEAPONIZE-ENVIRONMENT
                                                — 기존에 없음 (신규 후보)
                    MC-ATTACK ≙ MC-COMBAT-STRIKE · MC-DEFEND ≙ MC-GUARD ·
                    MC-EVADE ≙ MC-EVADE(기존) · MC-BREAK ≙ MC-BREAK(기존 — 단
                    기존 semantic 은 Guard 무너뜨리기로 좁고 BW §22 는 갑각 파괴를
                    요구한다. 넓히려면 REVISED 가 필요하다)

    영향          차단 아님 — 전투 트랙은 기존 노드로 계속 돈다. 다만 결정 전에는
                  MP-KILL-CREATURE 의 requires 배선(전투 스타일 분기)과 BW 를 전투
                  영역 근거로 인용하는 것을 하지 않는다.

    선택지        (a) 매핑 승인 — 기존 노드 재사용 + BW 를 해당 노드의 보조 근거로 허용
                      (Q15 영역 규칙에 예외 추가) + 신규 3종은 OPTIONS 탐색으로 검토
                  (b) 매핑만 승인, 근거는 계속 분리 (BW 인용은 탐험 노드에만)
                  (c) BW §28 을 별도 노드로 세운다 — 같은 의미의 이중 등록을 감수

    DECISION      <PENDING>

---

## Q19. root.md 문안 확인 — BW 주입으로 채워졌다 — OPEN

    무엇          root.md 는 Human 소유인데 비어 있었고, BW §1 이 ROOT GAME GOAL 을,
                  §35~§36 이 WORLD PREMISE 를 직접 선언한다. HISTORY Q14 의 결정
                  ("실제 세계관은 root.md 가 채워질 때 새로 정한다")이 예고한 그
                  세계관 문서가 도착한 것으로 판단해, 문서의 문장을 그대로 옮겨
                  root.md 를 채웠다 — Agent 창작 문안은 없다.

    영향          차단 아님 — 그러나 이 문안이 곧 모든 Goal 의 최종 상위 근거가
                  되므로, 틀렸다면 빨리 고쳐야 한다.

    선택지        (a) 문안 확정 (그대로 둔다)
                  (b) Human 이 직접 수정
                  (c) 되돌린다 (root.md 를 다시 비운다 — BW 주입 산출물 중 MW/MG 의
                      상위 근거가 다시 사라진다)

    DECISION      <PENDING>
