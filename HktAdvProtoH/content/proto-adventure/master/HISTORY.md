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

## Q14. 심연(Abyss) 예시의 지위 — 삽화인가 세계 설정의 씨앗인가 — CLOSED

    무엇          GR 은 심연·가론·심연의 버서커 계보(§24.2 · §30 · §36)로 구조를 설명한다.
                  주입 시 삽화로 판정해 그래프에 옮기지 않았고, 씨앗으로 쓸지를 물었다.

    DECISION      질문 제거 — 2026-08-18 Human 지시. 심연 예시는 삽화로 남는다(비주입 유지).
                  실제 세계관은 root.md 가 채워질 때 새로 정한다.

## Q15. GR 을 셋째 근거 문서로 추가할 것인가 — CLOSED

    무엇          Q12 는 근거 문서를 R1·DT 둘로 한정했는데, Growth 주입 산출물이
                  GR 을 인용하게 되어 GR 의 지위를 물었다.

    DECISION      (b) 영역 분리 — 2026-08-18 Human 승인. GR 은 성장(GROWTH) 영역 한정
                  근거다. 근거는 영역을 넘지 않는다 — 전투 노드에 GR 금지, 성장 노드에
                  R1/DT 금지. constraints/README 에 상시 규칙으로 반영.

## Q16. GR §41 Growth Quality Gate 의 guides/ 반영 — CLOSED

    무엇          GR §41 체크리스트(Class/Item/Growth 완료 조건)를 가이드 문서에
                  복사할지, 원본 참조로 둘지를 물었다.

    DECISION      (c) 복사하지 않는다 — 2026-08-18 Human 승인. 이중 관리를 피하기 위해
                  GR §41 을 직접 참조한다. SCHEMA.md growth 절에 "생성·변경 시 §41 통과"
                  상시 규칙 한 줄로 반영.

## Q2. 전투 Goal 의 World Cause 가 없다 — CLOSED

    무엇          MG-OVERCOME-SUPERIOR-OPPONENT 의 motivation · caused_by 와
                  MA-HOSTILE-COMBATANT 의 wants 가 비어 있었다 (원본이 전투 규칙 문서).
                  BW 주입으로 root.md 와 MW 11종이 생겨 입력이 도착했었다.

    DECISION      (a) WHY 확장 실행 — 2026-08-19 Human 지시. 현재 세계의 적대 존재를
                  FRINGE 토착 포식자(BW §21)로 자리매김했다:
                      MG-OVERCOME-SUPERIOR-OPPONENT  caused_by MW-ZONE-FRINGE ·
                                                     motivation MG-EXPLORE-BEIRA
                      MG-SURVIVE-ENEMY-OFFENSIVE     caused_by MW-ZONE-FRINGE
                      MG-ACQUIRE-RARE-ORGAN          caused_by MW-ZONE-WILD (BW §22)
                      MG-HOLD-HUNTING-GROUND 신설    owner MA-HOSTILE-COMBATANT — 생존·영역
                  BW §26 MG-OVERCOME-CREATURE ≙ MG-OVERCOME-SUPERIOR-OPPONENT (Q18 과 연동).

## Q3. Belief(틀릴 수 있는 믿음)를 전투에 둘 것인가 — CLOSED

    무엇          Belief 가 0 건 — 전투 층은 모든 원인을 공개하는 쪽이라 오독이 성립하지
                  않았고, Mystery/Investigation/Reversal 의 설계 폭 문제로 남겨 뒀었다.

    DECISION      도입하지 않는다 — 2026-08-19 Human: "믿음이라는 게 플레이어에게 필요한
                  개념 같지 않다. NPC AI 는 아직 작업도 안 했고 왜 필요한지 모르겠다.
                  전투 정보는 상황에 따라 부분적으로 보여질 수도 가려질 수도 있다."
                  → Belief(MB-*)는 만들지 않는다. 정보의 불완전성은 "틀리게 믿는 것"이
                  아니라 **관찰 범위**(무엇이 언제 관찰에 실리는가)로 다룬다 — 각 Cycle 의
                  관찰 계약(GameView Spec) 소유. knowledge.yaml 주석에 상시 규칙으로 반영.

## Q8. 전투 밖 경로가 없다 — CLOSED

    무엇          같은 상대(MG-OVERCOME-SUPERIOR-OPPONENT)를 넘어서는 방법이 전부 전투
                  안에 있었다 — 교섭·회피·정보로 "전투를 우회"하는 경로를 열지 물었다.

    DECISION      (a) 전투는 전투로 푼다 — 2026-08-19 Human: "전투는 그냥 전투일 뿐,
                  비전투라는 게 무슨 말인지도 모르겠고 필요 없어 보인다."
                  → 상대를 넘어서는 Goal 에 비전투 대안을 억지로 만들지 않는다.
                  구분: MG-ACQUIRE-RARE-ORGAN 의 대안 5종(BW §27 — 거래·줍기 등)은
                  "전투를 비전투로 푸는 것"이 아니라 **다른 Goal 의 다른 활동**이므로
                  유지된다 — 전투가 선택인 것과 전투를 우회하는 것은 다르다.

## Q11. R1 §14 Critical 층과 DC-COMBAT-PLAYER-CAUSALITY 의 충돌 — CLOSED

    DECISION      (b) DC 를 REVISED 하여 확률 Critical 허용 — 2026-08-19 Human.
                  random_critical 을 prohibits 에서 제거하고 statement 에 단일 예외를
                  명시했다 (명중·회피·피해량 난수 금지는 유지). explainable_result 는
                  Critical 발생 여부·증폭까지 포함하도록 강화. R1 §14 C011 층의 유보
                  ("넣을지 다시 판단")를 "넣는다"로 닫았다 — Critical 층이 Frontier
                  후보 자격을 얻었다 (FR-CRITICAL-AMPLIFIES-THE-BLOW).

## Q17. BW 주입 DC 5종(DRAFT) 승인 — CLOSED

    DECISION      (a) 5종 일괄 APPROVED — 2026-08-19 Human.
                  RESOURCE-ADAPTATION-TRACE · CREATURE-FROM-PRESSURE ·
                  COMBAT-IS-ONE-POSSIBILITY · PLAYER-UNFIXED-PATH · PROGRESSION-IS-REACH.
                  BW 유래 노드 전체의 constraint_evaluation 을 UNRESOLVED → SATISFIED 로
                  재판정 (각 노드에 근거 주석). Active 는 12종 → 17종.

## Q18. BW 의 전투 교차분 — 기존 전투 노드와의 매핑 — CLOSED

    DECISION      (a) 매핑 승인 — 2026-08-19 Human. 기존 노드 재사용 + BW 를 매핑된
                  전투 노드의 보조 근거로 허용 (Q15 영역 분리 규칙의 예외) + 신규 3종은
                  OPTIONS 로 검토.
                      MG-OVERCOME-CREATURE ≙ MG-OVERCOME-SUPERIOR-OPPONENT
                      MP-DEFEAT-BY-COMBAT = 그 Goal 아래 전투 Possibility 서브트리 전체
                      BREAK-DEFENSE ≙ BREAK-THE-GUARD · READ-AND-PUNISH ≙ READ-AND-COUNTER ·
                      OVERWHELM ≙ OUTGROW-THE-OPPONENT · EXPLOIT-WEAKNESS ≙
                      EXPLOIT-OPEN-BODY/MATCH-WEAPON-TO-ARMOR · OUTLAST ≙ HOLD-FORTIFIED
                      MC-ATTACK ≙ MC-COMBAT-STRIKE · MC-DEFEND ≙ MC-GUARD · MC-EVADE(동일) ·
                      MC-BREAK(동일 — semantic 을 방어 구조 전반으로 CHANGED)
                  OPTIONS 산출: MP-CONTROL-MOVEMENT · MP-INTERRUPT ·
                  MP-WEAPONIZE-ENVIRONMENT 신설 (사다리 MC 재사용 — 복제 없음).
                  MP-KILL-CREATURE 는 requires.goals 로 전투 서브트리에 연결.

## Q19. root.md 문안 확인 — CLOSED

    DECISION      (a) 문안 확정 — 2026-08-19 Human. BW §1 · §35~§36 의 문장 그대로 유지.

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
| FR-PENETRATION-DEVALUES-THE-WALL | C013-penetration-devalues-the-wall | **CLOSED** 2026-08-19 — MC-PENETRATION 승격 · MP-PIERCE-THE-HARD-DEFENSE 닫힘 (요구 4종 완비) |
| FR-OBSERVE-REVEALS-THE-OPPONENT | C014-observe-reveals-the-opponent | **CLOSED** 2026-08-19 — MC-OBSERVE 승격 (IMPLEMENTED 가 아니라 **PARTIAL** — 아래 Overlay 이력) · 탐험 사다리의 첫 칸 |
| FR-CRITICAL-AMPLIFIES-THE-BLOW | C015-critical-amplifies-the-blow | **CLOSED** — MC-CRITICAL-STRIKE 승격 · 세계에 우연이 처음 들어왔다. MP-BET-ON-THE-CRITICAL-BLOW 는 **절반만** 닫혔다 (성질을 올릴 원천이 없다) |
| FR-INSIGHT-SEES-BEFORE-LOOKING | C016-insight-sees-before-looking | **CLOSED** — MC-OBSERVE 의 **경로** 결손이 닫혔다 (앎에 이르는 길이 둘 · 앎이 자리 단위). 노드는 여전히 PARTIAL — 남은 결손은 습성 하나 |
| FR-PREDICT-READS-THE-NEXT-BLOW | (C017 — 접었다) | **보류** 2026-08-20 Human 결정 — 후보에서 내리고 **AI 기획서**를 기다린다. 이유는 계보의 구멍이다: BW §21 은 이름 `MC-PREDICT` 만 대고 정의를 쓰지 않으며 R1·DT 는 예측을 언급하지 않는다 — 노드 semantic 은 Agent 가 채운 것이고 BW §32 의 **층 스케일**이 한 마리의 다음 일격으로 좁아졌다. 자율 존재의 행동을 정의한 기획 문서가 서면 그 위에서 다시 판정한다. 앞선 경위 — 2026-08-19 Human 이 C017 로 골랐다가 Stage 1 만 쓰고 선택을 철회했고, 그때 얻은 "넘어야 할 선" 셋과 A안 판단은 git history 에 있다 |

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

    없음을 계약에 실을 때는 무엇을 왜 뺐는지를 함께 싣는다. (C014)
    가려진 자리를 지우면 보는 이가 "0 인가 · 아직 안 왔나 · 세계가 안 주나" 를 구별할 수
    없고, 결국 자기 코드에 "이 종류는 이럴 것이다" 를 적기 시작한다. 세계가 가린 항목의
    이름 목록을 실은 덕에 그 목록을 셋에서 하나로 줄였을 때 화면이 따라왔다 (View 변경 0).

    앎은 값이 아니라 자리로 둔다. (C014)
    장부에 Id 만 담고 투영이 매 tick 현재 값을 읽는다. 값을 베꼈다면 살펴본 뒤 상대의
    능력이 바뀌어도 옛 숫자가 남았을 것이고, "능력치로 미리 안다" 같은 후속 경로가
    아예 성립하지 않았다.

    의미가 바뀐 테스트는 지우지 않고 새 경계로 다시 쓴다. (C014)
    C007 R2 의 "세계는 어떤 속성도 숨기지 않는다" 검증을 둘로 갈랐다 —
    그 자리가 "무엇이 **여전히** 안 가려지는가" 의 기록이 되었다.

# 3. Overlay 갱신 이력

    2026-08-19 (C013 Feedback — Penetration 층)

    승격 1종
        MC-PENETRATION   MISSING → IMPLEMENTED
        근거  C013 08-verification — 마주한 방어가 결정적으로 깎이고(resistance 90 → 56.25),
              마주하지 않은 방어에는 닿지 않으며(물리 타격의 C010 값 20 이 그대로),
              두껍게 굳힐수록 걷히는 몫이 커진다(0/7.5/33.75/112.5).
              방어를 없애지는 못한다(관통 100000 에서도 남는다).

    닫힌 Possibility 1종
        MP-PIERCE-THE-HARD-DEFENSE   요구 Capability 4종이 모두 IMPLEMENTED.
        단 경로는 아직 좁다 — 플레이어가 관통을 **얻는** 선택이 세계에 없다
        (종류가 정한 값과 디버그 명령뿐). Cycle 이 FR-EARN-THE-PIERCING 을 제안했고,
        형태(장비·성장·준비 행동)를 근거 문서가 정하지 않아 frontier 의 대기열로 갔다.

    넓어진 Knowledge 1종
        MK-OPPONENT-DEFENSE-SHAPE   새로 세운 것이 아니다. C012 의 DefenseShape 위에
        "그 방어가 나에게 얼마인가" 가 얹혔다 — 같은 지식의 관계 형태다.

    Constraint Evaluation 갱신
        MC-PENETRATION 에 DC-COMBAT-ONE-FORMULA · DC-COMBAT-MATCHUP-SOFT 판정을 더했다.
        둘 다 이 Capability 의 구현 형태를 실제로 제한했다 —
        새 공식을 만들지 않고 기존 감쇄식이 읽는 값 하나를 바꿨고(ONE-FORMULA),
        타입별 배율표·면역 없이 깎이기 전후가 관찰된다(MATCHUP-SOFT).
        DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST 도 SATISFIED 이나
        노드에 Edge 를 더하지 않았다 — 전자는 Cycle 선택의 제약이고 후자는 GLOBAL 이다.

    Constraint Candidate 접수 1종
        CC-THE-WORLD-OWNS-THE-RELATION (PENDING) — 두 존재 사이에서만 정해지는 값도
        세계가 계산해 관찰에 싣는다. 관찰 1회이고 기존
        DC-WORLD-OWNS-THE-SURFACE-LIST 와의 경계가 정리되지 않아 승격하지 않았다.

    Master Gap 없음.

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

    2026-08-19 (C014 Feedback — 탐험 사다리 첫 칸 · 살펴봄)

    승격 1종 — **IMPLEMENTED 가 아니라 PARTIAL 이다**
        MC-OBSERVE   MISSING → PARTIAL
        근거  C014 08-verification — 살펴봄이 행동으로 존재하고
              (RULE-OBSERVE-BEGIN/COMPLETE-001), 살펴본 뒤에만 상대의 겨루는 힘이
              관찰에 실리며, 무엇을 아는가가 관찰자마다 다르다.
        판정  Cycle 은 `IMPLEMENTED` 로 보고하면서 주의를 함께 보고했다 —
              "semantic 이 말한 행동·습성 중 **습성**은 세계에 아직 개념이 없다".
              Feedback 이 그 주의를 적용해 PARTIAL 로 낮췄다. semantic 은 셋을 말하는데
              (`행동·습성·상태`) 닫힌 것은 상태뿐이다.
        남은 결손 둘
              행동·습성   자율 존재의 행동 패턴을 읽는 의미가 없다 (MC-PREDICT 와 같은 자리)
              경로 하나   앎에 이르는 길이 살펴봄뿐이고, 앎이 존재 단위여서 부분 공개가 없다
        이 판정이 곧 새 후보 둘의 근거가 되었다 — PARTIAL 은 Frontier 후보 자격이다.

    유지 1종
        MC-COMBAT-CAUSE-READING   PARTIAL 유지. C014 는 계산 내역을 넓히지 않고
        **누가 볼 수 있는지**만 정했으므로 승격을 보고하지 않았다. C010 의 보고 없는
        승격 보류도 그대로 남는다.

    Possibility
        MP-VENTURE-INTO-FRINGE   요구 3종 → 2종 (MC-PREDICT · MC-USE-TERRAIN).
        지역·이동이라는 세계 기반은 여전히 없다.

    Constraint Evaluation 갱신
        MC-OBSERVE 에 DC-WORLD-PROGRESSION-IS-REACH · DC-COMBAT-MATCHUP-SOFT ·
        DC-WORLD-PLAYER-UNFIXED-PATH 판정을 더했다. 셋 다 구현 형태를 실제로 제한했다 —
        진행이 수치가 아니라 고를 근거로 나타나야 했고(PROGRESSION-IS-REACH),
        살펴봄이 계산에 닿지 않아야 했고(MATCHUP-SOFT: 실측 17 이 C013 과 동일),
        살펴봄이 다른 행동의 관문이 되어서는 안 됐다(UNFIXED-PATH).
        DC-WORLD-OWNS-THE-SURFACE-LIST 도 SATISFIED 이나 GLOBAL 이므로 Edge 를 더하지
        않았다 — C013 Feedback 이 세운 기준과 같다.

    Constraint Candidate 접수 1종
        CC-THE-WORLD-NAMES-WHAT-IT-WITHHELD (PENDING) — 세계가 관찰에서 무엇을 뺐다면
        무엇을 왜 뺐는지를 함께 싣는다. 관찰 1회이고 기존
        DC-WORLD-OWNS-THE-SURFACE-LIST 와의 경계가 정리되지 않아 승격하지 않았다.
        이로써 그 DC 와 경계를 다투는 후보가 셋이 되었다 (READ · RELATION · WITHHELD).

    새 후보 2종 (같은 날 Human 지시)
        Human: "아이템을 쓴다거나 나의 능력치 및 스킬에 따라 미리 알 수도 있어?
        그럴 여지만 있으면 됨." → "후보로 올리고 완료처리해줘"
        FR-INSIGHT-SEES-BEFORE-LOOKING   기른 통찰이 살펴봄 없이 일부를 보여준다.
                                         MC-OBSERVE(PARTIAL)의 **경로** 결손을 닫는다
        FR-PREDICT-READS-THE-NEXT-BLOW   MC-PREDICT + MC-OBSERVE 의 **습성** 결손이 같은 자리
        아이템 경로는 후보로 올리지 않고 frontier 의 "지금 열 수 없는 것" 에 사유를 적었다 —
        **아이템을 "쓴다" 는 개념이 세계에 없다** (소지 개수만 있고 사용·소모 Rule 0건).
        부분 공개가 먼저 서면 남는 것은 "아이템 사용" 하나이므로 그때 후보가 된다.

    Master Gap 없음. Stage 5 가 확인한 판단 둘(C007 R2 개정 범위 · DT §10 조정)이
    승인되어 반환 조건이 발생하지 않았다.

    2026-08-19 (C015 Feedback — Critical 층)

    승격 1종
        MC-CRITICAL-STRIKE   MISSING → IMPLEMENTED
        근거  C015 08-verification — 같은 조건 다섯 대에서 [20, 20, 40, 40, 20] 이
              실측되고, 성질을 바꾸면 빈도와 크기가 각각 달라지며(가능성 1 → 매번 ·
              배율 3 → 60), occurred · chance · multiplier · damageBeforeCritical 넷이
              모든 타격의 계산 경위에 실린다.

        **IMPLEMENTED 로 올린 근거를 적어 둔다.** semantic 뒷문장("성장·장비로 자란다")이
        아직 세계에 없지만 이 노드의 `world_shape` 는 그것을 요구하지 않는다. 판정 기준은
        semantic 이 아니라 world_shape 다 (overlay.md 머리말). 같은 결손을 지는
        MC-ATTACK-POWER 가 PARTIAL 인 것은 그 노드의 world_shape 가 "세계 안의 행위로
        이 값을 올릴 수 있어야 한다" 를 **직접 적고 있기** 때문이다 — 두 판정은 어긋나지
        않는다. Critical 쪽의 그 결손은 MP-BET-ON-THE-CRITICAL-BLOW 의
        `requires.resource` 가 진다.

    Possibility 1종 PARTIAL 로
        MP-BET-ON-THE-CRITICAL-BLOW   ABSENT → PARTIAL. 요구 Capability 3종이 전부
        IMPLEMENTED 이나 `requires.resource`(Critical 성질을 올릴 성장·장비의 원천)가
        비어 있어 "준비로 기대값을 올린다" 는 이 갈래의 절반이 서지 않았다.

    Constraint Candidate 접수 1종
        CC-WORLD-OWNS-THE-CHANCE (PENDING) — 우연의 원천은 세계 상태이고 관찰에
        실리지 않으며 그럼에도 결과는 끝까지 설명된다. 관찰 1회이고
        DC-COMBAT-PLAYER-CAUSALITY(REVISED)와의 경계가 정리되지 않아 승격하지 않았다.

    Master Gap 없음.

    2026-08-19 (C016 Feedback — 통찰)

    승격 없음 · 결손 하나 닫힘
        MC-OBSERVE   PARTIAL 유지. 남은 결손 둘 중 **경로 쪽**이 닫혔다 —
        앎에 이르는 길이 둘(살펴봄 · 기른 통찰)이 되고, 앎이 존재 단위에서 자리 단위로
        넓어졌다. 남는 것은 **행동·습성** 하나뿐이고 그것이 닫히면 IMPLEMENTED 다.

    Possibility 1종 PARTIAL 로
        MP-LEARN-TO-HANDLE-THE-LAYER   ABSENT → PARTIAL. BW §32 사슬의 첫 칸이 섰다.

    Knowledge 1종 승격
        MK-OPPONENT-DEFENSE-SHAPE   PARTIAL → PRESENT. 이 줄은 C014 시점에 이미
        낡아 있었다 — "처음부터 전부 보이므로 알게 되는 과정이 없다" 고 적혀 있었으나
        C014 가 그것을 가렸고 C016 이 자리별로 열었다. Feedback 이 밀린 동안 살아 있는
        문서가 사실과 어긋난 사례이며, 밀리면 안 되는 이유의 실례다.

    Overlay 근거 정정 1종 (코드 대조)
        MC-PREDICT   MISSING 유지, **결손의 자리를 고쳤다.** 이전 판정은
        "상대 행동에 읽을 예고 구간이 노출되지 않는다" 였으나 코드 대조로 틀린 것이
        확인되었다 — 예고 구간은 있고(`collision.ts` SWING_BEGIN) 진행 중인 행동의
        종류·진행도·칼끝이 계약에 실린다(`EntityView.state` · `progress` · `swing`).
        실제 결손은 둘이다: ① 자율 존재가 쓰는 스킬이 하나뿐이라 읽을 갈래가 없다
        (`npc-decide.ts` — 사거리 안이면 언제나 `attack`) ② 그 앎이 살펴봄·통찰과
        무관하게 누구에게나 그냥 온다.

    Constraint Candidate 접수 2종
        CC-A-NEW-WAY-OF-KNOWING-IS-NOT-A-GATE (PENDING) — **관찰 2회**
        (C014 `POSSIBILITY-STILL-FIGHT-BLIND` · C016 `INTENT-INSIGHT-NOT-A-GATE-001`).
        PENDING 후보 중 유일하게 반복이 확인된 것이다.
        CC-CONDITION-OPENS-WITHOUT-RECORDING (PENDING) — 조건이 여는 것을 기록하지
        않으면 되돌림 규칙이 필요 없다. C015 의 "확률의 양 끝에서 소비하지 않는다" 와
        같은 종류일 수 있어 그 경계도 판단에 뒀다.

    Human 결정 대기 1건 신규
        Q23 — 통찰을 독립 Capability(MC-INSIGHT)로 세울 것인가. C016 08 이 판단을
        Master 로 넘겼다. 지금 통찰을 따로 요구하는 Possibility 가 없어 SCHEMA 의
        노드 규칙("required_by 와 demanded_by 가 둘 다 비면 노드가 아니다")에 걸리므로,
        Agent 판단으로는 성장 축 Cycle 이 열릴 때로 미루는 쪽을 권한다.

    Master Gap 없음.
        다만 C016 이 보고한 자리 하나를 여기서 닫았다 — frontier 의 SELECTED 가
        "다음 단계 cycles/C015-<name>" 을 가리키고 있었으나 C015 는 Human 이 따로 고른
        Critical 층이 가져갔고 그 Frontier 를 받은 것은 C016 이다. 두 후보를 지우면서
        해소되었다.

    2026-08-19 (Human Select — 다음 Cycle)

    FR-PREDICT-READS-THE-NEXT-BLOW 를 Human 이 선택했다. 함께 물었던 판단
    (MC-OBSERVE 의 "습성" 을 이 Cycle 에 함께 닫을지, 따로 볼지)에 **A안 — 한 Cycle 로
    묶는다** 로 답했다.

        Human 질문   "플레이어는 자신이 입력을 통해 캐릭터를 제어하는건데 이게 무슨
                     의미가 있는건지 모르겠어." → 코드 대조로 답한 것이 위 MC-PREDICT
                     근거 정정이다. 예고는 이미 보이고 반응도 되지만, 자율 존재의
                     행동이 언제나 하나라 **읽을 거리가 없다** 는 것이 진짜 결손이었다.
        A안 근거     갈래 없이는 읽을 것이 없고, 읽기 없이는 갈래가 보이지 않는다 —
                     둘로 나누면 어느 쪽도 혼자서는 플레이 가능한 Delta 가 되지 않는다.
        Cycle 에 나르는 것   frontier 의 **넘어야 할 선** 셋. ① 자율 존재의 다음 행동에
                     갈래가 둘 이상 ② 그 갈래를 아는 것이 앎의 관문 뒤에 ③ 알고 대응한
                     결과가 모르고 대응한 결과와 다르다. 셋 중 하나라도 못 넘으면
                     이미 있는 것에 이름표를 붙인 Cycle 이 된다.

    배운 것: Overlay 의 "부족한 것" 칸이 **틀릴 수 있다.** MC-PREDICT 는 근거 칸이
    비어 있는 채로(`—`) 결손 문장만 있었고, 그 문장이 코드와 달랐다. 근거가 빈 MISSING
    줄은 판정이 아니라 추측일 수 있다 — Frontier 로 올릴 때 코드 대조를 한 번 거친다.

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

    2026-08-19 CC 승격 2종 — Cycle 관찰에서 올라온 GLOBAL Constraint

```text
신설  DC-WORLD-OWNS-THE-CHANCE              C015 — 우연을 다루는 형태 네 조각
신설  DC-CONDITION-OPENS-WITHOUT-RECORDING  C016 — 조건이 여는 것은 기록하지 않는다
```

    이로써 Active 는 17종 → **19종** 이고 GLOBAL 무리가 셋이 되었다
    (SURFACE-LIST · OWNS-THE-CHANCE · CONDITION-OPENS).

    **승격 조건 첫 항(반복)을 면제한 첫 사례다.** 둘 다 관찰 1회뿐이다.
    근거는 반복이 아니라 **비가역성**이었다.

        OWNS-THE-CHANCE 의 ④    "이미 정해진 판정에서 우연의 원천을 소비하지 않는다" 는
                                 두 번째 우연이 들어온 뒤에 세우면 그때까지의 모든
                                 재현이 깨진다. C015 는 확률 0 인 세계가 C013 과
                                 완전히 같다는 것을 실측해 이 조각을 선점했다.
        CONDITION-OPENS          한 번 기록형으로 만든 뒤 조건형으로 되돌리려면
                                 저장된 데이터의 이전이 따라붙는다.

    같은 예외를 다시 쓸 때는 그 비가역성을 먼저 보인다 — 관찰 1회를 일반 통로로 만들지
    않는다. 이 단서를 `candidates/README.md` 와 `constraints/README.md` 양쪽에 적었다.

    합치지 않고 둘로 세운 이유: 뿌리는 같으나(안 써도 되는 상태는 쓰지 않는다)
    적용 대상이 우연과 조건으로 갈린다. `relations.supports` 로 이어 두었다.
    DC-COMBAT-PLAYER-CAUSALITY 와도 충돌이 아니라 분업이다 —
    그쪽이 **범위**(어디에 허용하는가), OWNS-THE-CHANCE 가 **형태**(어떻게 다루는가)다.

    함께 세운 문서 규칙 — SCHEMA.md **"읽히게 쓴다"** (CC · DC 공통)

        Human 지적: 두 CC 가 "무슨 말인지 모르겠다". 원칙 문장만으로는 읽히지 않고,
        읽히지 않는 원칙은 지켜지지 않는다. 그래서 CC 에 `무엇을 말하는가 (예시)` 절을
        **필수**로 세우고 5항 규칙을 SCHEMA 에 두었다 — 나쁜 방식 대비 · 실물 코드 인용 ·
        무엇이 달라지나 · 가장 안 읽히는 조각 지목 · 경계 긋기.
        `statement`/`requires`/`prohibits`/`prefers` 는 판정용이므로 압축을 유지하고,
        설명은 CC 의 예시 절과 DC 의 `rationale` 이 진다.
        guides/master-constraint.md · master-feedback.md 가 이 규칙을 가리킨다.

---

# 4. 주입(Inject) 이력

    2026-08-19 BW — design/Master-World-Beira.md (세계관: 세계압·탐험·자원·전투 파생)

    Human 지시로 주입. 세계(WORLD) 영역이 열렸다. 산출물:
        root.md            채움 — BW §1 (Root Game Goal) · §35~§36 (World Premise).
                           문안은 전부 문서의 문장이다. 확인 대기 → Q19
        constraints/       DC-WORLD-* 5종 DRAFT (RESOURCE-ADAPTATION-TRACE ·
                           CREATURE-FROM-PRESSURE · COMBAT-IS-ONE-POSSIBILITY ·
                           PLAYER-UNFIXED-PATH · PROGRESSION-IS-REACH) → Q17
        graph/             MW 6종 (PRIMAL-WORLD · WORLD-PRESSURE · SAFE-FRONTIER ·
                           DEPTH-GRADIENT · HYPER-PREDATION · SPATIAL-SHEAR) ·
                           MG 2종 (EXPLORE-BEIRA · ACQUIRE-RARE-ORGAN) ·
                           MP 5종 (§27 대안 — requires 미배선) ·
                           MC 23종 (§20~§25 사다리 21 + 자원 유래 2 — required_by 미배선)
        growth/items/      IP-BOUNDARY-STABLE · IT-BOUNDARY-BLADE (§10 — 문서 명명)
        MA-PLAYER          CHANGED — BW §1 탐험 Actor 정의를 원본으로, R1 전투 관점 유지

    옮기지 않은 것과 사유:
        BW §28 범용 Combat Graph (MP-DEFEAT-BY-COMBAT + 8분기) · §26 MG-OVERCOME-CREATURE ·
        §20~§22 의 MC-ATTACK/DEFEND/EVADE/BREAK — 기존 전투 노드와 같은 의미로 보여
        중복 등록하지 않았다. 매핑은 Human 결정 대기 → Q18
        BW §17~§18 독성 예시 (MC-DETOXIFY · MA-TOXIN-SCHOLAR · IT-PURIFICATION-ORGAN ·
        CL-???) — Growth Overlay 작동 방식을 설명하는 삽화 (Q14 심연 선례)
        회귀초의 IT-* — 문서가 Item ID 를 명명하지 않았다 (Capability 만 명명)
        BW §7 자원 가능성 예시 8종(불치병 치료 식물·노화 지연 물질 등) · §15 탐험 이유
        11종 · §25 UNKNOWN 생명 예시 5종 — 전부 "예:" 로 제시된 가능성 목록이다.
        노드로 세우면 목록이 세계가 된다(§15 는 고정 금지가 원칙) — 각각 root/DC/MW
        노드의 의미로만 반영하고 개별 항목은 비주입 (Q14 삽화 선례와 같은 기준)
        BW §18 "Resource 가 있다는 이유만으로 Capability 를 만들지 않는다" —
        기존 DC-GROWTH-NEED-FROM-POSSIBILITY(APPROVED)와 같은 원칙이라 REUSED (신설 없음)
        수치·공식 — 없음 (BW 는 수치를 두지 않는 문서다 · 정책 §7.2)

    탐험 영역 Frontier 후보는 세우지 않았다 — DC 승인(Q17)과 requires/required_by
    배선(OPTIONS/NEED)이 선행이다. 기존 전투 후보 FR-PENETRATION-DEVALUES-THE-WALL 은
    이 주입의 영향을 받지 않는다.

    2026-08-19 BW 보충 주입 (같은 날 2차) — Human 감사 지적: "10뎁스 세계관 대비 그래프가 얕다"

    감사 결과 1차 주입이 문서의 의미 두 곳을 압축한 것이 확인되어 보충했다:
        MW-ZONE-* 5종        §21~§25 가 한 절씩 서술한 깊이 층(FRINGE·WILD·DANGER·
                             DEEP·UNKNOWN)을 MW-DEPTH-GRADIENT 하나로 눌렀던 것을 복원
        MP-VENTURE-INTO-* 5종  §16 탐험 Loop + §21~§25 의 "필요:" 는 층 진입 ← 요구
                             Capability 의 명시적 배선이었다 — "OPTIONS 몫" 판정은
                             오판. ID 만 Agent 명명, 의미·배선은 전부 문서 것
        required_by 배선 21건  사다리 MC 20종 + MC-BREAK(§22 가 같은 ID 를 직접 요구 —
                             semantic 폭은 Q18 유지)
    이로써 탐험 영역에 Goal → Possibility → Capability 척추가 섰다
    (MG-EXPLORE-BEIRA → 깊이 진입 5 → 사다리 21). 여전히 남는 공백(§27 대안의
    requires · 층별 Local Goal)은 문서가 실제로 공급하지 않는 것들이다.

---

## Q20. 코드 대조로 올라간 Overlay 판정 2건 — CLOSED

    DECISION      (a) 둘 다 확정 (Human)

    MC-PENETRATION          MISSING → IMPLEMENTED
        C013 의 08-verification 이 기록한 실측. C013 은 Human Play 확인 후 닫힌다.
    MC-COMBAT-CAUSE-READING PARTIAL → IMPLEMENTED
        C010 이 계산 내역을 관찰 계약에 실었으나 그 Cycle 의 FEEDBACK 이 이 Capability 를
        보고하지 않아 PARTIAL 로 남아 있던 것. 코드에는 고른 능력치 이름·값부터
        막기 결과까지 전부 실린다.

    배운 것: Cycle FEEDBACK 이 빠뜨린 Capability 는 다음 Cycle 이 그것을 건드리기 전까지
    조용히 낡는다. 주기적인 코드 대조가 필요하다는 근거가 되었다.

## Q22. 지금 세계의 유일한 자원(돌)에 세계 유래를 부여하는가 — CLOSED

    DECISION      세계에 있어야 할 광물을 더 정의하고 연결한다 (Human)

    선택지 (a)(b)(c) 중 어느 하나가 아니라 범위를 넓히는 답이었다 — 돌 하나를
    구제하는 대신 광물 계통 자체를 세웠다.

    세운 것 (growth/items/)
        IP  5종  BOUNDARY-STABLE(기존) · UNREACTIVE · SHOCK-DISPERSING ·
                 BIOLOGICALLY-CLOSED · SELF-IDENTICAL
        IT  6종  COMMON-STONE · BOUNDARY-BLADE(기존) · SEALED-VESSEL ·
                 WARDING-PLATE · SEVERING-BLADE · ANCHOR-STONE
        IM  3종  BOUNDARY-EDGED · BIO-SEVERING · IDENTITY-ANCHORED

    원래 질문(돌)의 답: IT-COMMON-STONE 은 MW-SAFE-FRONTIER 에서 나온다.
    "굳지 않은 세계압이 적어 변화가 없는 땅" 이므로 아무 성질이 없는 것이 정상이고,
    그것이 곧 세계 유래다. 특별하지 않다는 사실 자체가 세계 법칙의 결과이므로
    DC-WORLD-RESOURCE-ADAPTATION-TRACE 를 위반하지 않는다. 베이라 광물들의 기준선 노릇을 한다.

    지킨 원칙
        grants 3건 전부 **이미 어떤 Possibility 가 요구하던** MC-* 를 가리킨다 —
        MC-CUT-ABNORMAL-STRUCTURE · MC-BREAK-BIOLOGICAL-LINK · MC-IDENTITY-ANCHOR.
        광물을 정당화하려고 새 MC-* 를 만들지 않았다
        (DC-GROWTH-NEED-FROM-POSSIBILITY · BW §18).
        불식광·산격석은 요구하는 경로가 없어 grants 를 비우고 사유를 적었다 —
        능력을 열지 않는 자원은 정상이다 (BW §12).

    효과: BW §17 순환(탐험 → 자원 → 능력 → 더 깊은 탐험)이 그래프에서 처음으로 닫혔다.
    grants 배선 0건 → 3건. 다만 세계 구현에는 여전히 제작·장착·거래가 없다.

    SCHEMA 변경: IP/IT 에 origin_trace 필수, IM 에 grants 규칙 명시.
    유래를 주석이 아니라 필드로 남긴다 — 이번 정비 전체의 교훈과 같다.

## Q21. 탐험의 갈래가 "방법" 이 아니라 "장소" 로 되어 있다 — CLOSED

    DECISION      (b) 장소를 빼고 방법만 남긴다 (Human)

    무엇이 문제였나
        MG-EXPLORE-BEIRA 아래 다섯 갈래가 MP-VENTURE-INTO-FRINGE ~ UNKNOWN 이었다.
        Possibility 는 "한 목적을 이루는 서로 다른 방법" 인데 그 자리에 장소가 들어가
        있었고, 게다가 서로 대안도 아니었다(순서대로만 열린다).
        원인은 설계 판단이 아니라 주입 과정의 부작용이다 — BW §21~§25 의 층별 "필요:"
        목록을 매달 곳이 필요해서 층마다 Possibility 를 만든 것이고, 그 다섯은
        방법이 아니라 능력 목록의 옷걸이였다.

    무엇을 했나
        층은 세계 상태로 되돌렸다. MW-ZONE-* 와 MW-SAFE-FRONTIER 에 demands 필드를
        신설해 BW §21~§25 · §20 의 "필요:" 목록을 그 층이 직접 소유하게 했다.
        Capability 쪽 거울은 demanded_by 다.

            demands     이곳을 감당하려면 무엇이 필요한가      — 장소의 조건
            requires    이 방법을 쓰려면 무엇이 필요한가        — 방법의 조건

        MP-VENTURE-INTO-* 5종을 삭제하고 MG-EXPLORE-BEIRA 의 갈래를 방법 3종으로 세웠다.
        셋 다 BW 가 실제로 말한 것이다 — 지어내지 않았다.

            MP-LEARN-TO-HANDLE-THE-LAYER   들어가 겪으며 익혀 감당한다      BW §32
            MP-ADAPT-BY-RESOURCE           세계가 만든 적응을 빌린다        BW §17
            MP-PREPARE-IN-CIVILIZATION     문명권에서 미리 갖추고 들어간다  BW §14

        비용과 위험이 서로 다르다 — 익히는 쪽은 싸고 위험하며 유일하게 아무도 가 본 적
        없는 곳에 쓸 수 있고, 준비하는 쪽은 안전하고 비싸며 먼저 겪은 사람을 전제한다.
        그래서 익히는 갈래가 나머지 둘의 앞이고(supports), 그 의존이 세계에 경제와
        사회가 생기는 자리가 된다.

    딸려 온 것
        MK-LOCAL-WORLDSTATE 의 revealed_by 가 둘이 되었다 — 겪어서 알거나 사서 알거나.
        발견이 목적을 만드는 배선(creates_goal 3종)은 익히는 갈래가 이어받았다 (BW §16).
        SCHEMA: world_state 에 demands, capability 에 demanded_by 를 추가하고,
        "required_by 와 demanded_by 가 둘 다 비면 그 Capability 는 노드가 아니다" 를
        명시했다 — 필요가 먼저임을 지키는 검사점이다.

    배운 것
        목록을 매달 곳이 필요하다는 이유로 노드 종류를 잘못 고르면, 그 오류는 문법
        오류가 아니라 **읽어도 말이 안 되는 그래프**로 나타난다. 노드를 세우기 전에
        "이것은 방법인가 장소인가 상태인가" 를 먼저 묻는다.

## Q23. TG 주입 DC 1종(DRAFT) 승인 — CLOSED

    DECISION      (a) 승인 (Human)

    DC-TARGET-IS-INTENT-NOT-AIM 이 Active 가 되었다 — "지목은 의도의 표명일 뿐
    명중·피해·정보·위협을 만들지 않으며 세계가 대신 다가가지 않는다".
    문안은 주입판 그대로다. 특히 "행동을 시작하는 순간 한 번 대상 쪽으로 몸을
    맞추는 것" 은 문서가 권장으로 남긴 자리이므로 requires 가 아니라 prefers 에
    남겼다 — 원본보다 세게 쓰지 않는다.

    MC-DESIGNATE-TARGET · MC-WATCH-TARGET 의 평가가 UNRESOLVED → SATISFIED 로 확정됐다.

## Q24. 적대·중립·우호라는 관계가 세계에 없다 — CLOSED

    DECISION      (b) 관계를 세운다. 별도 Cycle 로 진행한다 (Human)

    세운 것        MC-RELATION-STANCE (MISSING) — 존재 사이의 태도가 세계의 사실로
                   있고, 그 태도가 누구를 칠 수 있는지와 자율 존재가 다가온 것을
                   어떻게 대하는지를 가른다.

    지어낸 것이 없다는 근거: 세계의 사정은 이미 그래프에 있었다 —
    MA-HOSTILE-COMBATANT("자기 사냥터에 들어온 것은 사냥감이다", BW §21)와 그가 원하는
    MG-HOLD-HUNTING-GROUND 다. TG 가 공급하지 않은 것은 태도의 **사정**이었고,
    TG 가 공급한 것은 태도의 **쓰임**(대상 표시 · 공격 거절 · 후보 추리기)이었다.

    태도를 존재의 이름표가 아니라 **사이의 값**으로 정의했다. 그래야 나중에 사람
    사이의 태도와 진영이 같은 자리에 얹힌다.

    이 Capability 를 세우는 것은 지목과 별개의 Cycle 이다 — 지목은 태도 없이도 성립한다.

## Q25. TG §5.5 가 자기 원칙과 어긋난다 — 가려진 항목 목록의 중복 — CLOSED

    DECISION      (a) 대상 문맥에서 뺀다 (Human)

    무엇이 가려졌는지의 목록은 그 존재 쪽 한 자리에서만 온다. 고른 대상이라고 해서
    같은 목록을 따로 싣지 않으며, 화면은 고른 대상의 Id 로 그 존재를 찾아 읽는다 —
    이름·생명을 읽는 방식과 같아진다.

    DC-WORLD-OWNS-THE-SURFACE-LIST 에 예외를 내지 않았다. 계약의 실제 필드는
    그 Cycle 의 04-gameview.spec.yaml 이 이 결정대로 쓴다.

## Q26. Tab 순환 후보를 누가 정하는가 — CLOSED

    DECISION      (b) 화면이 고른다 (Human)

    다음 대상을 차례로 골라 나가는 것은 화면의 일이다. 세계는 그 판단의 재료를
    싣는다 — 무엇을 고를 수 있고 그것이 나를 어떻게 대하는지가 고르기 전에도
    관찰에 드러나야 한다. 그래서 이 결정은 MC-DESIGNATE-TARGET 의 world_shape 를
    넓혔다: 고른 뒤뿐 아니라 **고르기 전**의 관찰이 계약에 들어온다.

    따라오는 것: 순서 규칙(가까운 순 · 동률 처리)이 세계의 Rule 이 아니므로 세계 쪽
    테스트로 증명되지 않는다. 같은 상황에서 같은 대상이 골라지는 성질은 화면의
    성질이 되며, 그 검증은 View 구현 단계가 맡는다.

## Q27. 지목을 요구하는 것이 살펴봄 갈래 하나뿐인가 — CLOSED

    DECISION      (a) 지금대로 둔다 (Human)

    지목은 MP-LEARN-TO-HANDLE-THE-LAYER 의 조건으로 남는다 — 무엇을 살펴볼지를
    정하는 것이 그 행동의 전부이기 때문이다 (TG §3.3). 전투 갈래에는 매달지 않았다:
    지금 전투는 지목 없이도 성립한다(휘두른 자리에 닿으면 맞는다). 없는 요구를
    적으면 Frontier 의 결손 계산이 부풀려진다.

## Q28. TG §5 가 요구하는 기반(Engine) 변경은 Cycle 이 할 수 없다 — CLOSED

    DECISION      (a) 기반 트랙 커밋을 먼저 낸다 (Human)

    지금 기반이 컨텐츠의 결정을 확정해 버리고 있다 — 무엇을 지목하면 무슨 요청이
    되는가를 화면 커널이 정한다. 그 자리를 컨텐츠로 되돌리는 것 자체가 기반의 일이므로
    승격 규칙 4("승격은 Cycle 이 아니라 기반 트랙 커밋")를 그대로 따른다.

    이 결정은 Master 의 소유가 아니다 — 기반 경계는 Graph 의 어휘가 아니므로 노드에
    반영하지 않았다. 지목 Cycle 이 시작될 때 그 선행 커밋이 있는지가 전제가 된다.

    배운 것: 기반 기획 문서가 구현 배치까지 적어 오면, 그중 기반에 닿는 부분은
    Master 가 옮길 자리가 없다. 주입은 그것을 노드로 만들지 말고 질문으로 노출해야 한다.

## Frontier 재정리 — 기능(개념) 단위로 다시 쓰기 (2026-08-20 NEXT)

    Human 판정: 후보가 "수많은 구현 중 하나를 하드코딩으로 고른 느낌" 이다.
    맞는 지적이었다 — 장면만 적으면 그 장면을 만드는 방법이 여럿이므로 후보가 임의의
    구현으로 읽힌다.

    후보의 단위를 **세계가 갖게 되는 개념 하나**로 바꾸고, 후보마다 넷을 적었다.

        이것이 무엇인가    세계에 추가되는 개념 한 문장
        세계에 생기는 것    그 개념이 요구하는 상태 · 규칙 · 관찰
        이 기능이 아닌 것    경계 — 여기가 비면 후보가 아니라 소원이다
        이미 있는 것        재사용하는 것. **코드 대조로 채운다**

    경계 칸이 핵심이다. 같은 장면을 만드는 방법은 여럿이지만 개념의 경계가 정해지면
    그 안에서 어떻게 만들든 같은 것이 된다. 이 규칙을 guides/master-frontier.md 의
    Do·Must 와 SCHEMA.md 의 frontier 형식에 못 박아 다음 NEXT 가 되돌아가지 않게 했다.

    갈라진 것 하나
        "얻은 것이 나를 바꾼다"(FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY)에는 세 개념이
        뭉쳐 있었다 — 쓴다 · 만든다 · 걸친다. 경계를 적으니 갈라졌고 앞칸 하나(**쓴다**)만
        FR-ITEM-USE 로 남겼다. 제작 · 장비 · 감정 도구 · 관통과 치명을 얻는 경로는 전부
        같은 이유로 막혀 있으므로 "지금 열 수 없는 것" 에 그 이유와 함께 두었다.

    새로 선 것 둘 — TG(지목) 주입과 Q24(b) 결정에서 왔다
        FR-TARGET-SELECTION   대상 지목 (선행: 기반 트랙 커밋 1건 — Q28(a))
        FR-RELATION-STANCE    존재 사이의 관계

    후보는 다섯이다: 지목 · 관계 · 예측 · 중단 · 아이템 사용.

## Frontier 정정 — "행동" 은 이미 있는 개념이다 (2026-08-20)

    Human 물음: "행동이라는 개념이 모호하다. 지금 이 게임에 있는가?"
    코드 대조 결과 **있다.** 그리고 그 확인이 후보 하나를 틀린 것으로 판정했다.

    지금 세계에 있는 행동 (C002 · INTENT-ACTION-STATE-001)
        모든 존재는 언제나 정확히 하나의 행동 안에 있다.
        행동은 종류 · 소요 시간 · 대상 · 진행도 · 대체 가능 여부를 지닌다.
        진행도(0~1)가 관찰에 실리고, 진행 중 다른 행동을 못 내는 관문이 있다.
        휘두름은 이미 세 구간이다 — 앞의 얼마는 준비, 가운데가 유효 타격, 뒤는 회수.
        막기는 행동이 아니라 별도 상태다 (그래서 막으면서 걸을 수 있다).

    무엇이 틀렸나
        후보 "행동 예고 구간" 이 "행동이 나가기 전의 구간이 없다" 고 적었다. 구간은 있다.
        같은 오류를 다른 갈래에서 이미 잡아 둔 상태였다 — overlay 의 MC-PREDICT 행이
        코드 대조로 "예고 구간 자체는 이미 있다" 를 적고 있었고(C017 을 열었다 접으며
        얻은 것), 그 사실을 보지 않고 후보를 새로 쓴 것이 이 오류의 원인이다.

    어떻게 고쳤나
        후보를 FR-ACTION-PHASE 로 다시 세웠다 — "구간이 없다" 가 아니라 "구간의 의미가
        없다" 로. 더할 것 셋이 그 안에 들어간다: 비율을 종류마다 다르게 · 준비 구간을
        의미로 노출 · 그 구간을 취소 판정에 쓴다. 셋 중 하나만으로는 닫히지 않는다.

    한 번 잘못 거두었다 (병합에서 — 이 기록은 그 정정이다)
        main 을 병합할 때, main 의 MC-PREDICT 코드 대조("예고 구간 자체는 이미 있다")를
        보고 이 후보를 해소했다. FR-PREDICT 와 FR-INTERRUPT 두 축으로 갈라 넣으면
        같은 것이 된다고 판단했다. **그 판단은 Agent 의 몫이 아니었다** — 이 후보의
        모양은 2026-08-20 Human 이 직접 정한 것이고, 코드 사실이 바뀐 것도 아니었다
        (main 이 밝힌 것은 이 후보가 이미 "구간은 있다" 를 전제로 다시 쓰인 뒤였다).
        Human 이 누락을 지적해 되돌렸다.

        FR-PREDICT 와는 겹치지 않는다. 그쪽의 결손은 **읽을 거리와 앎의 관문**(자율
        존재가 쓰는 스킬이 하나뿐이고, 그 앎이 살펴봄과 무관하게 온다)이고,
        이쪽의 결손은 **구간의 의미**(비율 · 노출 · 취소 판정)다. 각자 성립하며
        둘 다 서면 "무엇이 오는지 알고 그 구간을 노려 끊는다" 가 된다.

    배운 것: 후보의 "이미 있는 것" 칸을 코드로 채우지 않으면, 이미 있는 것을 없다고
    적은 채 Cycle 로 내려간다. 그 칸은 근거 문서가 아니라 **코드 대조**로 채우며,
    overlay 가 이미 코드 대조로 적어 둔 행이 있으면 그것이 첫 출처다.

## 병합 정리 — 두 갈래가 같은 Feedback 을 따로 돌았다 (2026-08-20)

    이 브랜치(TG 주입)와 main 이 각각 C015·C016 의 Master Feedback 을 돌았다.
    같은 사실을 두 벌로 적게 되어 병합에서 하나로 줄였다.

    남긴 것 (main)   C015·C016 Overlay 갱신 이력과 Frontier 선택 기록 표 ·
                     CC 3종(WORLD-OWNS-THE-CHANCE · A-NEW-WAY-OF-KNOWING-IS-NOT-A-GATE ·
                     CONDITION-OPENS-WITHOUT-RECORDING)과 그중 둘의 DC 승격 ·
                     MC-PREDICT 의 코드 대조 판정 · C017 을 접은 기록
    버린 것 (이 브랜치)  같은 사실의 두 번째 서술과, 이름만 다른 CC 2종
                     (CC-A-NEW-PATH-IS-NOT-A-GATE · CC-CONDITIONS-ARE-NOT-RECORDED)
    남긴 것 (이 브랜치)  TG 주입분 전부 — DC-TARGET-IS-INTENT-NOT-AIM(APPROVED) ·
                     MC-DESIGNATE-TARGET · MC-WATCH-TARGET · MC-RELATION-STANCE ·
                     Q23~Q28 의 결정 · 기능 단위 Frontier 형식

    번호 충돌 하나  두 갈래가 Q23 을 각각 썼다. 이 브랜치의 Q23~Q28 은 이미 닫혀
                    여기 있으므로, main 에서 열려 있던 "통찰은 독립한 노드인가" 를
                    **Q29** 로 옮겼다. 번호는 재사용하지 않는다.

    배운 것: Master Layer 는 한 번에 한 갈래만 도는 것이 안전하다. 두 갈래가 같은
    Overlay 를 동시에 갱신하면 병합이 사실을 고르는 일이 되고, 그 판단은 원래
    Agent 의 것이 아니다.

## Feedback — C017(지목) · C018(관계) 반영 (2026-08-20)

    두 Cycle 이 닫혔는데 Feedback 이 돌지 않아 Overlay 가 밀려 있었다.
    C017 은 main 에서 COMPLETE 로 닫혔고 C018 은 기계 검증까지 닫혔으나,
    overlay 는 여전히 지목 둘을 MISSING/PARTIAL 로, 관계를 MISSING 으로 적고 있었고
    frontier 는 그 셋을 아직 후보로 세워 두고 있었다.
    (Guide 가 경고한 그대로다 — 밀린 Overlay 는 이미 채워진 칸을 결손으로 보인다.)

### Overlay 갱신

```text
MC-DESIGNATE-TARGET   MISSING → IMPLEMENTED   근거 C017 08-verification
MC-WATCH-TARGET       PARTIAL → IMPLEMENTED   근거 C017 08-verification
MC-RELATION-STANCE    MISSING → IMPLEMENTED   근거 C018 08-verification
MA-HOSTILE-COMBATANT  PARTIAL → PRESENT       근거 C018 — 지킬 자리가 생겼다
MG-HOLD-HUNTING-GROUND PARTIAL → PRESENT      근거 C018 — world_shape 3줄 모두 실측
```

    MP-LEARN-TO-HANDLE-THE-LAYER 가 **네 칸 중 셋**이 되었다.
    남은 것은 예측 하나이며 그것이 MC-OBSERVE 의 마지막 결손과 같은 자리다 —
    닫히면 이 게임의 기본 진행 방식이 통째로 선다.

### Frontier 정리

```text
지웠다   FR-TARGET-SELECTION    → C017-target-gathers-the-actions 로 닫혔다
         FR-RELATION-STANCE     → C018-stance-decides-who-can-be-struck 로 닫혔다
남았다   예측 · 행동 구간 · 아이템 사용 (번호를 1·2·3 으로 다시 매겼다)
추천     1 예측 (한 갈래를 완주시키는 유일한 후보) · 2 아이템 사용 · 3 행동 구간
```

    **병합 정정** — 이 Feedback 을 쓸 때 남은 후보 셋 중 하나는 FR-INTERRUPT-DENIES-THE-BLOW
    였다. 같은 시각 main 에서 FR-ACTION-PHASE 가 되살아나며 그 후보를 **흡수했고**
    (MC-INTERRUPT 를 닫는 쪽이 그쪽이다), 병합에서 후보 2 를 행동 구간으로 바꿨다.
    닫힌 둘을 지운 것과 번호를 1·2·3 으로 매긴 것은 이쪽 판을 그대로 두었다 —
    main 은 C017·C018 이 닫힌 사실을 아직 몰랐다.

    "지금 열 수 없는 것" 에서 **막는 것이 사라진 항목 둘**을 표에 남겼다 —
    위협도·진영·도발(사정 목록에 항목을 더하면 된다)과 Tab 후보 추리기·대상 프레임의
    관계 표시(TG 가 요구하던 태도가 섰다). 둘 다 후보로 올리지는 않았다:
    앞의 것은 어느 Possibility 도 요구하지 않고(7 조건 2), 뒤의 것은 세계의 결손이
    아니라 화면의 편의다.

### 배운 것 — C018 이 이미 승인된 Constraint 를 다시 발견했다

    C018 이 `CC-WORLD-DERIVE-DONT-REMEMBER`("유도할 수 있으면 저장하지 않는다")를
    새 후보로 제안했다. 그런데 그것은 **이미 APPROVED 인 `DC-CONDITION-OPENS-WITHOUT-
    RECORDING` 과 같은 원칙**이다 (C016 에서 승격).

    새 후보를 만들지 않고 그 DC 의 세 번째 사례로 기록했다 —
    MC-RELATION-STANCE 의 constraint_evaluation 에 SATISFIED 로 이었다.

        C015  확률의 양 끝에서 우연의 원천을 소비하지 않는다
        C016  통찰이 연 자리를 기록하지 않아 되돌림 규칙이 한 줄도 안 바뀌었다
        C018  태도를 저장하지 않아 "물러나면 풀린다" 의 구현이 0줄이다

    공정에서 배운 것: **Cycle 이 Active Constraint 로 세우지 않은 GLOBAL Constraint 가
    그 Cycle 의 설계를 이미 지배하고 있을 수 있다.** C018 의 01~03 은 Active 로
    CREATURE-FROM-PRESSURE · COMBAT-IS-ONE-POSSIBILITY · SURFACE-LIST 셋만 들었고,
    scope 가 GLOBAL 인 CONDITION-OPENS-WITHOUT-RECORDING 을 보지 않았다.
    그래서 이미 있는 원칙을 스스로 다시 유도했다.
    — 원칙이 옳다는 증거이자, Cycle Stage 1 이 GLOBAL scope Constraint 를 훑어야
    한다는 신호다. 공정 변경은 Human 판단이므로 여기 적어만 둔다.

### Constraint Candidate 접수 (셋 다 PENDING)

```text
CC-THE-CHOICE-IS-THE-OBSERVERS-OWN    C017 · 3회 (C004 · C014 · C017)
    관찰자에게 매달리는 사실은 세계가 지니되 관찰자별로 갈리고, Id 만 담고,
    "없음" 을 저장하지 않고, **대상 쪽에는 아무것도 적지 않는다.**
    마지막 성질이 DC-TARGET-IS-INTENT-NOT-AIM 을 코드 구조로 지킨다 —
    대상 쪽이 비어 있으면 그 규칙을 어길 자리가 없다

CC-A-GATE-MOVES-WITH-ITS-MEANING      C017 · 1회
    관문이 옮겨가도 사유를 잃지 않는다. 사례가 하나뿐이라 두 번째 이사를 기다린다

CC-REASONS-ARE-A-LIST-NOT-A-BRANCH    C018 · 1회 — Cycle 이 스스로 보류를 권했다
    사정은 목록으로, 판정은 그 목록을 읽는다. 항목이 하나뿐이라 값어치가 아직
    실측되지 않았다 — 두 번째 사정이 서는 Cycle 이 확인하거나 기각한다
```

### 위층이 알아야 할 사실 둘 (Gap 은 아니다)

```text
① RULE-TARGET-CLEAR-STALE-001 은 플레이로 도달하지 않는다 (C017)
   존재가 세계에서 사라지는 경로가 0건이다. 규칙과 단위 검증은 섰고, 플레이 확인은
   존재를 없애는 개념이 오는 Cycle(전리품 · 소멸 · 지역 이동)의 몫이다.
   overlay 의 MC-DESIGNATE-TARGET 행에 단서로 남겼다

② 기반 트랙 커밋(Q28(a))은 C017 의 선행 조건이 아니었다
   Stage 4 의 코드 대조가 Stage 1 의 판단을 정정했고 Human 이 그대로 진행을 결정했다.
   C017 은 engine/ 을 한 줄도 편집하지 않고 닫혔다. 그 커밋의 값어치는 남아 있으며
   자리가 셋이다 — 지형 클릭의 결정 · 존재마다 오는 interaction 이 둘이 될 때 · 외곽선 강조
```

### Master Gap

    없음. 두 Cycle 모두 상위 의미와 어긋난 지점을 보고하지 않았고, 반영 중에도
    발견되지 않았다.

---

## 공정 개선 — 시스템 척추(part_of) 도입과 본문 이력 이관

Human 지시로 두 가지를 한 번에 반영했다 (상세 diff 는 git history 소유).

```text
part_of 도입    모든 MC-* 노드에 "이 조각이 속한 전체"를 정식 필드로 세웠다
                (SCHEMA · guides/master-graph · master-frontier 갱신). 형태는
                grounded + memberships(system·segment·source·role 목록) — 한 조각이
                여러 시스템·여러 자리에 속할 수 있고(MC-BREAK · MC-DISCOVER-WEAKNESS),
                깊이는 두 단계(system → segment)로 고정했다. 시스템·자리의 단일
                출처는 graph/systems.yaml(MS-* 레지스트리, DRAFT/PLANNED 상태 포함)
                이며 없는 참조는 master:graph ERROR 다. 도구가 척추 시각화를 낸다
                (GRAPH.md "척추" 절 + 뷰어의 척추 렌즈 · 잠정 점선).
                grounded: false = semantic 이 잠정(근거 문서가 이름만 댐) — Frontier
                후보의 Target 으로 세우지 않는다. MC-PREDICT 보류(위 Frontier 선택
                기록)를 규칙으로 일반화한 것이다.

이력 이관       살아 있는 문서(graph/*.yaml · overlay.md · frontier.md)에 쌓여 있던
                정정 경위 · 날짜 · Cycle 실측 서사를 제거했다 (CLAUDE.md 원칙 20 집행).
                제거된 근거의 현재값은 overlay.md 가, 경위는 이 파일의 기존 항목과
                git history 가 소유한다. 특히 NEED 재판정의 "이전 판정 MISSING 정정"
                주석 5건(MC-BREAK · MC-CONDITION-STACKING · MC-REPOSITION ·
                MC-FORCE-MOVEMENT · MC-INTERRUPT)은 overlay.md 의 해당 행이 근거를
                이어받았다.
```

---

## Master 정합 정정 — MC-INTERRUPT 의 grounded · MP-INTERRUPT 의 요구 · 후보 이름

Human 이 "FR-ACTION-PHASE 의 근간이 무엇인가" 를 물어 근간을 역추적하다 나온 셋을
한 번에 정정했다. 반영 결과는 각 살아 있는 문서가 소유하고, 여기에는 경위만 남긴다.

### ① MC-INTERRUPT 의 part_of 가 grounded: false 였다 — true 로 재판정

    무엇이 문제였나   후보의 Target 이 `grounded: false` 노드였다. 그것은 CLAUDE.md 원칙 21 ·
                      SCHEMA · guides/master-frontier Must Not 이 금지하는 형태이고,
                      frontier.md 자신의 "지금 열 수 없는 것" 표도 같은 사유로 베이라
                      사다리의 잠정 조각을 막고 있었다 — 후보가 그 규칙을 어긴 채 서 있었다.

    어떻게 판정했나   SCHEMA 의 판정 기준은 "semantic 문안이 확정 근거(**문서 문장 또는
                      닫힌 Cycle**)를 가졌는가" 다. MC-INTERRUPT 의 semantic("진행 중인
                      행동을 끊는다")은 C002 의 RULE-HIT-001 이 이미 세계에 세웠고
                      overlay 가 코드 대조로 PARTIAL 을 실측했다 — Agent 의 잠정 번역이
                      아니다. 같은 판정의 선례가 둘 있다: MC-CRITICAL-STRIKE
                      (R1 §14 이름 → C015 로 의미 확정) · MC-BODY-FACING (문서 없음 →
                      C006·C011 로 의미가 세계에 섰다).

    지어내지 않은 것  R1(전투 근거 문서)은 끊김을 한 번도 말하지 않는다. 그래서
                      MS-COMBAT-LADDER 소속을 새로 만들지 않았다 — 소속은 BW §23 DANGER
                      하나 그대로이고, 바뀐 것은 grounded 와 그 근거 표기뿐이다.
                      DANGER 층 전체(환경과 생물이 한 덩어리)는 여전히 문서가 없다.

### ② MP-INTERRUPT 가 ABSENT 인 Knowledge 를 요구하고 있었다 — 배선 제거

    무엇이 문제였나   `requires.knowledge: [MK-OPPONENT-FLOW-PATTERN]` 이었는데 그 노드는
                      ABSENT 다 (힘을 공격/방어에 배분하는 상태가 세계에 없다 —
                      MC-COMBAT-FLOW MISSING, R1 §14 Aura/Nen 층). overlay 의
                      "하나만 없고 그마저 절반" 은 Capability 만 센 문장이라, 그대로
                      두면 이 후보를 닫아도 MP-INTERRUPT 는 닫히지 않는다.

    왜 요구가 아닌가  끊는 데 필요한 것은 **눈에 보이는 준비 동작**이지 상대의 힘 배분을
                      아는 것이 아니다. MP-INTERRUPT 자신의 문장이 그렇게 말한다
                      ("상대 행동의 시작을 읽는 시점 판단" · "정확한 한 순간이 아니라
                      진행 중이면 성립"). MK 쪽 `revealed_by` 도 원래 둘뿐이었다
                      (MP-EXPLOIT-OPEN-BODY · MP-READ-AND-COUNTER) — 되받아치기 갈래의
                      지식이 끊기 갈래에 한쪽 방향으로만 매달려 있었던 것이다.
                      제거로 그 비대칭이 사라졌다. 새 Knowledge 노드는 만들지 않았다 —
                      준비 구간의 관찰은 이 후보가 세계에 직접 넣으므로 관문이 아니다.

### ③ 후보 이름 — FR-ACTION-PHASE → FR-INTERRUPT-THE-WINDUP (준비를 끊는다)

    왜 바꿨나        "행동 구간" 은 이 후보가 여는 것보다 넓다. 행동은 이미 세계의
                     개념이고(C002), 구간도 이미 있다 — 앞선 정정이 확인한 사실이다.
                     이름이 그 전부를 가리키면 후보의 경계가 이름에서 읽히지 않고,
                     척추의 어느 자리인지도 보이지 않는다.

    새 이름의 근거   척추에서 이 후보의 자리는 MP-INTERRUPT(BW §28) → MC-INTERRUPT
                     (BW §23) 다. 이름이 그 자리를 그대로 가리키고, 끊는 대상이
                     **준비 구간**임을 함께 말한다 — 상태(경직·기절)도 되받아치기도
                     아니라는 경계가 이름 안에 든다. 후보의 내용(비율 · 노출 ·
                     취소 판정 셋)은 2026-08-20 Human 이 정한 그대로다.

    흡수 이력        FR-INTERRUPT-DENIES-THE-BLOW 를 흡수한 판이 이 후보다 (위 병합 정정
                     참조). 이름이 다시 INTERRUPT 를 갖게 되어 그 이력과도 맞는다.

### 함께 갱신한 현재 상태 (③ 의 부산물)

    master/README.md 의 "현재 상태" 숫자가 C015~C018 반영 전 값에 멈춰 있었다 —
    Constraint 17→20 · Candidate 5→11 · Capability 42→45 · Frontier 5→2 ·
    Open Question 0→1 · 기준 시점 C013·C014→C017·C018. 숫자의 단일 출처가
    graph/GRAPH.md 머리말(재생성물)임을 README 에 적어 재발을 막았다.
    overlay.md 의 "MG-OVERCOME-SUPERIOR-OPPONENT (10 갈래)" 도 11 로 정정했다.
