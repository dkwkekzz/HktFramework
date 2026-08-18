# History — 닫힌 것들의 기록

**조회용이다.** 진행 중인 작업은 여기에 없다. Agent 는 평소 이 파일을 읽지 않는다 —
"왜 그때 그렇게 정했는가" 를 되짚을 때만 연다.

살아 있는 문서는 **지금 할 일만** 담는다. 무언가 닫히면 그 자리에서 지우고 여기로 옮긴다.

```text
overlay.md              현재 Capability 상태          → 갱신 이력은 여기
frontier.md             지금 고를 수 있는 후보         → 선택 기록·배운 것은 여기
open-questions.md       Human 결정 대기 중인 질문      → 닫힌 질문은 여기
constraints/README.md   현재 Active Constraint        → 반영 이력은 여기
```

---

# 1. 닫힌 질문

## Q9. 반영된 DC 5종의 문안 확정 — CLOSED

    무엇          2026-08-15 Human 지시로 전투 기획서의 명시 원칙 5종을 constraints/ 에
                  반영했다 (PLAYER-CAUSALITY · DEFENSE-IS-ACTIVE · POWER-HAS-COST ·
                  SHARED-BUDGET · MATCHUP-SOFT). 반영 자체는 지시받았으나
                  statement / requires / prohibits / prefers 의 **문안은 Agent 추출**이다.
                  첫 반영이 원본보다 세게 써서 제거된 이력이 있으므로 문안 검토가 필요하다.

    영향          차단 아님 — Graph 평가와 Frontier 조건 6 판정은 이 문안 기준으로 이미
                  수행됐다. 문안이 REVISED 되면 해당 평가만 다시 본다.

    선택지        (a) 문안 유지 (APPROVED 확정)
                  (b) 개별 DC 를 REVISED — 어느 항목이 원본과 다른지 지목

    DECISION      CLOSED (2026-08-17) — 기획서가 R1 로 전면 개정되어 구판 기준 문안 확정이
                  무의미해졌다. R1 기준 재작성(Q10)이 이 질문을 대체한다.

## Q10. R1 전면 개정 뒤 DC 5종의 지위 — CLOSED

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

    DECISION      (b)+(c) — 2026-08-17 Human 지시 ("새로운 기획으로 constraints 다시 작성").
                  CAUSALITY · SHARED-BUDGET 은 R1 기준 재정합(APPROVED 유지),
                  ONE-FORMULA · ONE-LAYER-AT-A-TIME 신설(R1 핵심 원칙 · §14·§16),
                  이연 층 근거의 DEFENSE-IS-ACTIVE · MATCHUP-SOFT · POWER-HAS-COST 는
                  DRAFT 보류 — 해당 층 재설계 시 재승인. 같은 지시로 C010·C011 구현도
                  롤백했다 (frontier.md 선택 기록 참조).

## Q12. 보류(DRAFT) 중인 DC 2종의 근거 층이 실재하게 되었다 — 재승인할 것인가 — CLOSED

    무엇          DC-COMBAT-DEFENSE-IS-ACTIVE 와 DC-COMBAT-MATCHUP-SOFT 는 2026-08-17
                  Human 지시로 DRAFT(보류)가 되었다. 사유는 "해당 층이 R1 로 이연되어
                  아직 세계에 없다" 였다. 그 전제가 사라졌다 —
                      DEFENSE-IS-ACTIVE 의 근거 층 = Defense Action  → C011 로 닫혔다
                      MATCHUP-SOFT 의 근거 층    = Damage Type      → C012 로 닫혔다
                  두 Cycle 모두 08-verification 에서 해당 DC 를 SATISFIED 로 실측 판정했다.

    영향          지금 두 DC 는 Active 가 아니므로 Frontier 의 Constraint Eval 에서
                  구속력이 없다. 특히 Active Defense 층(완벽한 막기·되받아치기)이
                  DEFENSE-IS-ACTIVE 의 두 번째 요구(방어 성공이 공격 기회를 만든다)를
                  정면으로 다루는 층인데, 그 층을 열 때 이 DC 가 보류인 채면
                  "방어 성공이 공격권을 뒤집어야 하는가" 를 Cycle 이 임의로 정하게 된다.

    선택지        (a) 두 DC 를 APPROVED 로 재승인 → Active 5종 → 7종.
                      Active Defense · Penetration Cycle 이 이 형태 아래에서 설계된다
                  (b) 문안을 손봐 REVISED 로 승인 → 특히 DEFENSE-IS-ACTIVE 의 두 번째
                      요구는 아직 세계에 없다(MC-PERFECT-GUARD·MC-COUNTER 는 MISSING)
                  (c) 계속 보류 → 각 Cycle 이 그때그때 판단한다

    DECISION      CLOSED (2026-08-18) — Human 지시: "기존 기획에 관련된 내용은 배제하고
                  남아 있다면 전부 삭제. 지금의 근거는 오로지
                  design/Design-Combat-OffenseDefense-R0.md 와
                  design/Design-Combat-DamageType-R0.md 이며 관련 없다면 그냥 없앤다."

                  선택지 (a)(b)(c) 중 어느 것도 아니다 — **보류라는 상태 자체를 없앴다.**
                  근거가 현행 두 문서에 있으면 승인하고, 없으면 삭제한다.

                      DC-COMBAT-MATCHUP-SOFT        → APPROVED
                          DT §7 이 문안을 직접 제시한다("상성은 별도 피해 배율이 아니라
                          대응 공격·방어 능력치의 차이로 표현한다"). 근거 층은 C012 로 닫혔다.
                          구판 유래 break_efficiency 는 DT §7 의 명시 지시대로 삭제했다.

                      DC-COMBAT-DEFENSE-IS-ACTIVE   → 삭제
                          근거가 구판 §1.1 · §3.2 · §8 뿐이다. 현행 R1 §8 은 오히려
                          "이번 단계의 방어는 버튼을 누르는 행동이 아니다" 라고 하고,
                          §14 Active Defense 층은 이름만 예고하며, DT §15 는 "이 문서는
                          그 효율을 정하지 않는다" 고 못 박는다. 남길 근거가 없다.

                      DC-COMBAT-POWER-HAS-COST      → 삭제
                          같은 결정으로 함께 삭제했다 (질문에는 없었으나 같은 사유다).
                          근거가 구판 §3.3 · §7 · §12 · §21 뿐이다.

                  이 질문이 걱정했던 것 — "Active Defense 층을 열 때 방어 성공이 공격권을
                  뒤집어야 하는가를 Cycle 이 임의로 정하게 된다" — 는 남는다. 다만 답은
                  보류된 DC 를 되살리는 것이 아니라 **그 층의 설계 문서를 Human 이 쓰는
                  것**이다. 문서가 오면 그것을 근거로 Constraint 를 새로 만든다.

                  같은 기준을 Graph 에도 적용했다 — 구판에만 근거가 있던
                  MC-WEAK-POINT · MC-REAR-ATTACK · MP-STRIKE-THE-VULNERABLE-SPOT 삭제.
                  상세는 overlay.md "이번 갱신" · constraints/README.md "반영 이력".

## Q13. DC-GROWTH 6종(DRAFT) + growth/ 스키마 확장 승인 — CLOSED

    무엇          GR(design/Master-Intent-Graph-Growth.md — 성장: Class/Item) 주입으로 만든
                  DC-GROWTH-NEED-FROM-POSSIBILITY · CLASS-ORIGIN-TRACE ·
                  NO-CAPABILITY-DUPLICATION · DEFINITION-INSTANCE-SPLIT ·
                  NOT-A-STAGE · GOAL-FIRST 6종이 DRAFT 였다.
                  SCHEMA.md 의 growth/ 확장(CL/IT/IP/IM 양식 · II- Runtime 전용)도
                  같은 문서의 번역이므로 함께 확인 대상이었다.

    DECISION      (a) 6종 일괄 APPROVED — 2026-08-18 Human 지시 ("모두 승인처리").
                  growth/ 스키마 확장도 함께 확정. Active 는 5종 → 11종.
                  승인 전 Agent 평가(대화 기록): ①NEED-FROM-POSSIBILITY ·
                  ②CLASS-ORIGIN-TRACE · ④DEFINITION-INSTANCE-SPLIT 이 척추,
                  ③NO-CAPABILITY-DUPLICATION · ⑥GOAL-FIRST 가 프로젝트 야망 보호,
                  ⑤NOT-A-STAGE 는 정책 §22.1 과 중복인 공정 보호 — Human 이
                  중복을 알고도 6종 전부를 승인했다.
                  GR 은 성장(GROWTH scope) 영역의 근거 문서가 된다 — 전투 노드에도
                  쓸지는 Q15 로 남는다.

## 사유만 남은 질문 (Q1 · Q4~Q7)

    Q12 보류 중인 DC 2종의 재승인 여부 (2026-08-18 — 보류 상태 자체를 없앴다)
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

---

# 2. Frontier — 선택 기록과 배운 것

| Frontier | Cycle | 결과 |
|---|---|---|
| FR-STATS-DECIDE-THE-DAMAGE | C010-stats-decide-the-damage | **CLOSED** 2026-08-17 — MC-ATTACK-POWER · MC-SKILL-SCALING · MC-DEFENSE-MITIGATION 승격 |
| FR-GUARD-TRADES-BODY-FOR-RESOURCE | C011-guard-trades-body-for-resource | **CLOSED** 2026-08-17 — MC-GUARD 승격 (overlay 반영 2026-08-18) |
| FR-MATCHUP-MAKES-THE-CHOICE | C012-damage-type-chooses-the-defense | **CLOSED** 2026-08-18 — MC-ATTACK-ARMOR-MATCHUP 승격 · MK-OPPONENT-DEFENSE-SHAPE 확립 |

    롤백된 것 (2026-08-17 Human 결정 — R1 층 순서와 어긋나 되돌렸다. 산출물은 git history)
        구 C010-guard-trades-body-for-resource · 구 C011-perfect-guard-turns-the-table
        Active Defense 층을 재구축할 때 그 산출물을 참조할 수 있다.

## 배운 것

    근거 없는 것을 "대기" 로 두면 대기열이 거짓말을 한다.
    Weak Point · Rear Attack 은 "R1 §13 이 범위에서 제외했다" 는 사유로 대기열에 있었으나,
    §13 목록에 그 둘은 없었다 — Agent 가 구판에서 옮겨 온 뒤 사유를 지어 붙인 것이다.

    2026-08-18 Human 결정으로 삭제했다. 대기 사유는 문서의 문장으로 확인되어야 한다.

    Playable Result 에는 **이번 층에서 실제로 제공되는 수단**을 적는다.
    FR-STATS-DECIDE-THE-DAMAGE 는 능력치 차이를 "장비·성장으로" 만든다고 적었으나 그 층은
    R1 §13 이 제외한 범위였고, Cycle 이 C009 디버그 명령으로 메워야 했다 (C010 05-review.md).

    Overlay 를 미루면 Frontier 가 거짓말을 한다.
    C011·C012 가 닫히는 동안 Feedback 이 밀려 이미 채워진 Capability 가 결손으로 남아 있었고,
    그 상태의 Frontier 는 "다음에 할 것이 없다" 로 읽혔다. Cycle 이 닫히면 Feedback 을 먼저 돌린다.

    Graph 에 노드가 없으면 그 층은 Frontier 에 나타나지 못한다.
    Penetration 이 그랬다 — 설계가 다음 층으로 지정하고 있는데도 MC-*/MP-* 가 없어
    Overlay 의 MISSING 목록에 들어가지 못했고, 결과적으로 후보가 될 길이 없었다.
    설계가 예고한 층은 닫히기 전에 **노드로 먼저 세워 둔다** (OPTIONS/NEED — Graph 확장).

---

# 3. Overlay 갱신 이력

    2026-08-18 (Q12 결정 — 근거 문서를 둘로 못 박았다)

    Human 결정: "지금의 근거는 오로지 Design-Combat-OffenseDefense-R0.md(R1) 와
    Design-Combat-DamageType-R0.md 이며, 관련 없으면 남기지 말고 없앤다."
    삭제된 구판(R0)에만 근거가 있던 것을 보류가 아니라 **삭제**했다.

    노드 삭제 2종 — 두 문서가 이 의미를 이름조차 대지 않는다
        MC-WEAK-POINT     몸의 특정 자리에 닿으면 더 큰 결과   (구판 §13.1 유래)
        MC-REAR-ATTACK    방어가 향하지 않은 쪽에서의 공격     (구판 §13.2 유래)
        → 이 둘만 요구하던 MP-STRIKE-THE-VULNERABLE-SPOT 도 함께 삭제.
        R1 §13 의 "하지 않을 것" 목록에도 이 둘은 없다 — 이연된 것이 아니라 근거가 없다.

    Constraint 삭제 2종 (constraints/README.md 반영 이력 참조)
        DC-COMBAT-DEFENSE-IS-ACTIVE   구판 §1.1·§3.2·§8 뿐. 현행 R1 §8 은 오히려
                                      "이번 단계의 방어는 버튼을 누르는 행동이 아니다" 다
        DC-COMBAT-POWER-HAS-COST      구판 §3.3·§7·§12·§21 뿐. 현행 R1 §14 Aura/Nen 은
                                      예시 한 줄만 두고 원칙을 규정하지 않는다
        → 두 DC 를 참조하던 노드 7종의 constraints · constraint_evaluation 항목 제거.

    Constraint 재승인 1종
        DC-COMBAT-MATCHUP-SOFT  DRAFT → APPROVED. DT §7 이 문안을 직접 제시하고,
                                근거 층(Damage Type)은 C012 로 닫혔다.
                                구판 유래 break_efficiency 는 DT §7 지시대로 삭제.
        → Active Constraint 4종 + GLOBAL 1종 = **5종**. 보류(DRAFT)는 이제 없다.

    문안 정리 — 구판에만 있던 세부를 노드에서 걷어냈다
        MC-GUARD          "균형 부담" 삭제 (C011 구현에도 없다)
        MC-PERFECT-GUARD  "상대를 노출시켜 공격권을 뒤집는다" 삭제 — R1 §14 는 이름만 예고
        MC-COUNTER        "더 큰 균형 부담" 삭제
        MC-BREAK          "균형 누적·폭발 구간" → "방어를 무너뜨린다" 로 축소
        MC-ATTACK-ARMOR-MATCHUP  "강한 감각은 균형 붕괴 효율 쪽" 삭제 —
                          DT §7 이 break_efficiency 를 채택하지 않는다고 명시한다
        MP-BREAK-THE-GUARD · MP-STAKE-EVERYTHING-ON-ONE-BLOW 도 같은 기준으로 축소.
        구판 § 인용은 Graph·Constraint 전체에서 0 건이 되었다 (판정 기록의 provenance 제외).

    **현재 IMPLEMENTED 7 · PARTIAL 2 · MISSING 9 (전체 18종).**
    Penetration Cycle 의 전제는 이 삭제로 달라지지 않는다 — MC-PENETRATION 은 R1 §14 와
    DT §15 라는 현행 근거를 가진 유일한 결손이며, 이제 MATCHUP-SOFT 가 Active 로서
    그 설계를 구속한다 (배율표가 아니라 대응 방어값을 깎아야 한다).

    2026-08-18 (Feedback) — C011-guard-trades-body-for-resource · C012-damage-type-chooses-the-defense
    두 Cycle 의 MASTER FEEDBACK 을 한 번에 반영했다. 두 Cycle 이 닫히는 동안 Feedback 이 밀려
    Overlay 가 2 Cycle 뒤처져 있었고, 그 때문에 Frontier 가 이미 채워진 Capability 를
    결손으로 계속 표시했다. 이번 갱신으로 해소했다.

    승격 2종 (근거: 각 Cycle 의 08-verification 실측)
        MC-GUARD                 MISSING → IMPLEMENTED   근거 C011
        MC-ATTACK-ARMOR-MATCHUP  MISSING → IMPLEMENTED   근거 C012

    이로써 **닫힌 Possibility 가 셋이 되었다** — MP-OUTGROW-THE-OPPONENT(C010) ·
    MP-TRADE-BODY-FOR-RESOURCE(C011) · MP-MATCH-WEAPON-TO-ARMOR(C012).
    MP-READ-AND-COUNTER 는 셋에서 둘로 줄었다.

    지식 1종이 세계에 섰다
        MK-OPPONENT-DEFENSE-SHAPE — C012 의 Actor 방어 형태가 모든 관찰에 실린다.
        Knowledge 는 Overlay 표의 대상이 아니므로 여기 기록으로만 남긴다.

    신규 노드 2종 (Graph 확장 — 이번에 추가했다)
        MC-PENETRATION              MISSING
        MP-PIERCE-THE-HARD-DEFENSE  (MG-OVERCOME-SUPERIOR-OPPONENT 를 달성하는 새 경로)

        추가 사유 — R1 §14 가 Damage Type 다음 층으로 Penetration 을 지정하고 있는데
        Graph 에 그 의미를 담는 노드가 하나도 없었다. 그래서 Overlay 에도 Frontier 에도
        나타나지 못했고 "다음 층의 근거가 없다" 로 보였다. 실제로는 **Graph 결손**이었다.
        의미의 출처는 R1 §14 Penetration 과 DamageType R0 §15(작용 지점·금지)다.

    승격하지 않은 것
        MC-CP-ECONOMY 는 PARTIAL 로 둔다. C011 로 기력을 쓰는 자리가 셋이 되었으나
        C011 자신이 승격을 보고하지 않았고(기력이 스스로 돌아오지 않는 결손은 그대로다),
        보고 없는 승격은 하지 않는다 (Feedback Guide MUST NOT).
        MC-COMBAT-CAUSE-READING 도 PARTIAL 로 둔다 — C010 에 이어 C012 가 계산 내역을
        더 두껍게 실었으나(고른 능력의 **이름**까지) 역시 보고가 없다. NEED(Overlay) 재판정 대상이다.

    Constraint Candidate 접수 2건 (둘 다 PENDING)
        CC-RESOURCE-GATE-IS-ALL-OR-NOTHING   C011 제안 — 관찰 2회
        CC-THE-WORLD-NAMES-WHAT-IT-READ      C012 제안 — 관찰 1회

    Human 판단 자리 2개가 열렸다 → open-questions.md Q12 (2026-08-18 CLOSED)
        DC-COMBAT-DEFENSE-IS-ACTIVE (DRAFT) 의 근거 층이 C011 로 실재하게 되었다.
        DC-COMBAT-MATCHUP-SOFT (DRAFT) 의 근거 층이 C012 로 실재하게 되었다.
        → 결정: MATCHUP-SOFT 는 DT §7 기준 재승인, DEFENSE-IS-ACTIVE 는 삭제 (위 참조).

    (그 시점 IMPLEMENTED 7 · PARTIAL 2 · MISSING 11 — 전체 20종)

    2026-08-17 (Feedback) — C010-stats-decide-the-damage 의 MASTER FEEDBACK 을 반영했다.

    승격 3종 (근거: 그 Cycle 의 08-verification 실측)
        MC-ATTACK-POWER        MISSING → IMPLEMENTED
        MC-SKILL-SCALING       MISSING → IMPLEMENTED
        MC-DEFENSE-MITIGATION  MISSING → IMPLEMENTED  (수동 감쇄에 한한다)

    이로써 **MP-OUTGROW-THE-OPPONENT 가 완전히 닫혔다** — 요구 Capability 가 하나도
    비어 있지 않은 첫 Possibility 다. MP-TRADE-BODY-FOR-RESOURCE 는 MC-GUARD 하나만
    남았고, MP-HOLD-FORTIFIED 도 요구 3종 중 하나가 채워졌다.

    승격하지 않은 것
        MC-COMBAT-CAUSE-READING 은 PARTIAL 로 둔다. C010 이 계산 내역을 관찰 계약에
        실었으므로 이 행의 "부족한 것" 은 실질적으로 해소된 것으로 보이나,
        C010 의 MASTER FEEDBACK 이 이 Capability 를 보고하지 않았다.
        보고 없이 코드를 근거로 승격하지 않는다 (Feedback Guide MUST NOT) — NEED(Overlay) 재판정 대상이다.

    Constraint Candidate 접수 1건 → **승격**
        CC-WORLD-OWNS-THE-SURFACE-LIST 를 접수하고, 같은 날 Human 이 승인했다.
        constraints/DC-WORLD-OWNS-THE-SURFACE-LIST.yaml (GLOBAL · APPROVED).
        Active Constraint 가 4종에서 5종이 되었고, 이 중 처음으로 COMBAT 이 아닌
        경계(World → View) 에 대한 것이다.

    2026-08-17 — Human 결정 두 건을 반영했다.

    1. 전투 기획서 R1 전면 개정 ("가장 단순한 공격/방어 공식 먼저").
       신규 MC-ATTACK-POWER · MC-SKILL-SCALING 판정 (둘 다 MISSING).
       구판 유래 MISSING 노드들에 R1 §13·§14 이연 표기.

    2. C010(막기·방어력) · C011(완벽한 막기·되받아침) 구현 롤백.
       두 Cycle 은 검사를 통과했으나 R1 의 층 순서(기본 공식이 먼저, 능동 방어는
       그 위)와 어긋나 Human 지시로 되돌렸다. 코드·Cycle 산출물은 git history 에 있다.
       MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER · MC-DEFENSE-MITIGATION → MISSING,
       MC-CP-ECONOMY · MC-COMBAT-CAUSE-READING 은 C007 시점 PARTIAL 로 복귀.
       재구축 시 이전 산출물(cycles/C010-*, C011-* — git history)을 참조할 수 있다.

    (그 시점 IMPLEMENTED 5 · PARTIAL 2 · MISSING 12 — 전체 19종)

---

# 4. Constraint 반영 이력

첫 반영(DC 4종)은 Agent 의 해석이 원본보다 강한 곳이 있어 Human 지시로 제거됐다 —
원본은 "피해 상성 폭을 작게 유지" 라고 하지 금지라고 하지 않았고, "플레이어가 상대의
Flow 를 읽는다" 고 하지 "모든 위험이 상대에게 읽혀야 한다" 고 하지 않았다.
2026-08-15 반영(5종)은 원본이 명시적으로 금지한 것만 `prohibits` 에, 정도 조절은
`prefers` 에 뒀다.

2026-08-17 — 기획서 R1 전면 개정 + C010·C011 구현 롤백에 따라 Human 지시로 재작성.
CAUSALITY·SHARED-BUDGET 은 R1 기준 재정합(APPROVED 유지), ONE-FORMULA ·
ONE-LAYER-AT-A-TIME 신설, 이연 층 근거의 3종은 DRAFT 보류.

2026-08-18 (Q12 결정) — **보류를 없애고 근거 문서를 둘로 못 박았다.**

```text
삭제  DC-COMBAT-DEFENSE-IS-ACTIVE   근거가 구판 §1.1 · §3.2 · §8 뿐이다.
                                    현행 R1 §8 은 오히려 "이번 단계의 방어는 버튼을 누르는
                                    행동이 아니다" 라고 하고, §14 Active Defense 층은
                                    이름만 예고하며, DT §15 는 "이 문서는 그 효율을 정하지
                                    않는다" 고 명시한다 → 남길 근거가 없다.
삭제  DC-COMBAT-POWER-HAS-COST      근거가 구판 §3.3 · §7 · §12 · §21 뿐이다.
                                    현행 R1 §14 Aura/Nen 은 예시 한 줄(Attack ×1.3 ·
                                    Defense ×0.7 · CP -5/sec)만 두고 제약·서약의 원칙을
                                    규정하지 않는다 → 남길 근거가 없다.
재승인 DC-COMBAT-MATCHUP-SOFT       DT §7 이 문안을 직접 제시한다. break_efficiency 는
                                    DT §7 이 "채택하지 않는다" 고 명시하므로 삭제.
                                    보류 사유(근거 층 부재)는 C012 로 사라졌다 → APPROVED.
정리  나머지 4종                     구판 § 인용을 전부 제거하고 R1 / DT 로 재근거했다.
```

두 DC 를 참조하던 Graph 노드의 `constraints` · `constraint_evaluation` 항목도 함께
제거했다. 이 DC 들이 필요해지면 해당 층(Active Defense · Aura/Nen)의 설계 문서가 나온 뒤
그 문서를 근거로 새로 만든다 — 근거 없는 문안을 보존해 두지 않는다.

2026-08-18 (GR 주입 · Q13) — **성장 영역 DC-GROWTH 6종 신설 → 같은 날 일괄 APPROVED.**

```text
신설  DC-GROWTH-NEED-FROM-POSSIBILITY     GR §22.2 · §27.1 · §42 — Class/Item 은 획득 경로일 뿐
신설  DC-GROWTH-CLASS-ORIGIN-TRACE        GR §24.2 · §41 — Class 는 세계 인과의 결과
신설  DC-GROWTH-NO-CAPABILITY-DUPLICATION GR §33 · §35 · §42 — Source 별 Capability 복제 금지
신설  DC-GROWTH-DEFINITION-INSTANCE-SPLIT GR §28~§32 · §42 — Master 는 유한 Definition 만
신설  DC-GROWTH-NOT-A-STAGE               GR §21 · §22.1 — Growth 는 Stage 가 아니라 Overlay
신설  DC-GROWTH-GOAL-FIRST                GR §34 · §42 — 성장 자체를 Goal 로 세우지 않는다
```

주입에서 문서의 심연 예시(§24.2 · §30 · §36)는 삽화로 판정해 Graph 에 옮기지 않았다(Q14 대기).
수치·공식은 옮기지 않았다(정책 §7.2). SCHEMA.md 에 growth/ 양식(CL/IT/IP/IM · II- Runtime
전용)을 추가했고 growth/growth-graph.md 가 Growth Overlay(획득 경로 판정)를 소유한다.

