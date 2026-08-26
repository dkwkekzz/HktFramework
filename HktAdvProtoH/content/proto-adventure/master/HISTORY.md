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
                  content/proto-adventure/design/Design-Combat-OffenseDefense-R0.md 와
                  content/proto-adventure/design/Design-Combat-DamageType-R0.md 이며 관련 없다면 그냥 없앤다."

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
| FR-ONE-SLOT-ONE-ITEM | C024-one-slot-one-item | **CLOSED** 2026-08-22 — **MC-EQUIP-ITEM PARTIAL → IMPLEMENTED**. 같은 4/4 상태에서 해제는 `no-room` 으로 막히고 교체는 성립하는 비대칭이 실측되었다 (IE §15 · §16.1). 배운 것 — **그 비대칭은 특례가 아니라 계산의 결과다**: "걸 수 있는 것은 겹치지 않는다" 는 정의소 불변 조건에서 순 증가 0 이 나온다. 그리고 State 를 한 줄도 늘리지 않고 경로 하나만 열어 Capability 를 닫을 수 있었다 |
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

    2026-08-19 BW — content/proto-adventure/design/Master-World-Beira.md (세계관: 세계압·탐험·자원·전투 파생)

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

    2026-08-20 IS — content/proto-adventure/design/Design-Item-System-R0.md (아이템: 정의 · 소지 · 사용 · 장착 ·
                    제작 · 세계 개체화)

    Human 이 기획 원본을 제출하고, Agent 리뷰 4점을 반영한 개정판으로 주입을 지시했다.
    개정에서 달라진 것 (원본 → 개정):
        IP 로 capability 판정   → §3 grants 사슬. IP 는 세계 유래 성질, 용도는 IT 가 지닌다.
                                 곡괭이의 채굴은 성질이 아니라 종류의 선언으로 옮겼다
        6 단계 = 6 Cycle        → §6 Cycle 경계 4개. 정의·소지는 플레이 Delta 가 없어
                                 단독 Cycle 이 아니라 사용 Cycle 에 흡수된다 (원칙 6)
        새 효과·개체 구조 신설   → §2 소유 경계. 지속 효과는 기존 조건 합성 위에,
                                 개체는 출처 추적 요구로, 수치는 Cycle 소유로
        근거가 "AAA 가 그렇다"  → §4 상위 유래 표. 각 층이 여는 MC 와 그것을 요구하는 MP

    산출물:
        systems.yaml       MS-ITEM-SYSTEM (DEFINED) — 여섯 자리
        graph/             MC 4종 (USE-ITEM · EQUIP-ITEM · CRAFT-FROM-MATERIALS ·
                           TRANSFER-ITEM) · required_by 배선 7건
                           (MP-ADAPT-BY-RESOURCE +3 · MP-PREPARE-IN-CIVILIZATION +1 ·
                           MP-KILL-CREATURE · MP-TAKE-SHED-ORGAN · MP-TRADE-WITH-ACTOR)
        constraints/       DC-ITEM-* 4종 DRAFT → Q30(a) 로 APPROVED
        overlay.md         아이템 영역 4행 (전부 MISSING · 코드 대조) · 갈래 판정 갱신
        frontier.md        FR-ITEM-USE 제거 → FR-WHAT-YOU-CARRY-CAN-BE-SPENT 로 교체.
                           장착 · 제작 · 세계의 아이템은 "지금 열 수 없는 것" 에 순서로

    옮기지 않은 것과 사유:
        §5.1~§5.2 (카탈로그 · 소지 관찰) — 할 수 있는 일을 늘리지 않아 Capability 가
        아니다. 문서 자신이 넷의 바닥이라고 밝힌다 (§4 · §6)
        §5.2 의 분류·정렬·필터 — 화면의 편의이지 세계의 결손이 아니다
        §10 범위 밖 (거래와 화폐 · 무게와 칸수 · 내구도/강화/귀속 · 등급과 희귀도) —
        아직 어느 Possibility 도 요구하지 않는다
        구체 수치 (회복량 · 능력치 증분 · 사용 시간 · 쿨다운 · 소멸 시간) — 문서 자신이
        Cycle 소유로 명시했다 (정책 §7.2)
        MP-FIND-DEAD-SPECIMEN · MP-FORCE-CREATURE-TO-RELEASE 의 requires — 문서 §4 가
        이름을 댄 셋에 이 둘이 없어 배선하지 않았다 (주입은 문서에 있는 것만 옮긴다)

    주입이 드러낸 것: "자원이 아무 일도 하지 않는다" 는 구멍이 하나가 아니라 넷이었고
    (쓴다 · 적용한다 · 만든다 · 주고받는다), 그중 첫째가 나머지 셋의 바닥이다.
    MC-ATTACK-POWER 가 PARTIAL 로 남은 이유와 쓰러진 몸에서 아무것도 나오지 않는 이유가
    같은 뿌리라는 것도 이 배선으로 그래프에 나타났다.

## Q30. 아이템 Constraint 넷을 승인하는가 — CLOSED

    DECISION      (a) 넷 다 승인 (Human · 2026-08-20)

    DC-ITEM-KIND-IS-DATA-NOT-BRANCH · DC-ITEM-CAPABILITY-COMES-FROM-GRANTS ·
    DC-ITEM-HOLDING-IS-NOT-APPLYING · DC-ITEM-CHANGE-IS-ONE-UNIT 이 Active 가 되었다.
    문안은 주입판 그대로다 (Q23 선례와 같다 — 원본보다 세게 쓰지 않는다).

    이로써 아이템 Cycle 은 이 넷을 Active Constraint 로 지고 간다. 특히 둘째가 구현
    형태를 직접 가른다 — 채굴 판정이 "든 것이 곡괭이인가" 에서 "이 몸에 채굴 용도가
    지금 있는가" 로 바뀐다. Active Constraint 는 20종 → 24종.

## Q31. 회복 아이템의 원천을 세계에 세울 것인가 — CLOSED

    DECISION      (b) 아이템 Cycle 1 이후로 미룬다 (Human · 2026-08-20)

    먼저 "쓴다 · 줄어든다" 를 세우고, 무엇을 쓰는가는 지금 세계에 있는 것(돌 · 곡괭이)
    으로 족하다. 회복은 그 다음 Cycle 이 원천(식물 계통의 IP/IT)과 함께 가져온다.

    따라서 첫 아이템 Cycle 은 MC-RESTORE-BIOLOGICAL-STATE 를 닫지 않는다 — 그 노드는
    MISSING 으로 남고, 첫 Cycle 이 세우는 것은 그것이 얹힐 바닥(MC-USE-ITEM)이다.
    임의의 수치 회복으로 그 자리를 채웠다고 판정하지 않는다 (그 노드는 "체력을 얼마
    채운다" 가 아니라 "이전 상태로 되돌린다" 이므로).

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

### ③ 후보 이름 — FR-ACTION-PHASE → FR-INTERRUPT-THE-STARTUP (선딜을 노려 끊는다)

    왜 바꿨나        "행동 구간" 은 이 후보가 여는 것보다 넓다. 행동은 이미 세계의
                     개념이고(C002), 구간도 이미 있다 — 앞선 정정이 확인한 사실이다.
                     이름이 그 전부를 가리키면 후보의 경계가 이름에서 읽히지 않고,
                     척추의 어느 자리인지도 보이지 않는다.

    두 번 고쳤다     첫 개칭은 FR-INTERRUPT-THE-WINDUP("준비를 끊는다") 이었다.
                     Human 이 "무슨 말인지 모르겠다" 고 지적했고 그 지적이 옳다 —
                     windup 은 야구에서 온 말이고 "준비" 는 무엇을 준비하는지가
                     빠져 있다. 이 프로젝트의 독자는 MMORPG 를 만드는 사람이므로
                     그 바닥의 통용어로 쓴다: **선딜 · 판정 · 후딜 · 캔슬**.

    새 이름의 근거   척추에서 이 후보의 자리는 MP-INTERRUPT(BW §28) → MC-INTERRUPT
                     (BW §23) 다. 이름이 그 자리를 그대로 가리키고, 끊는 대상이
                     **선딜**임을 함께 말한다 — CC(경직·기절)도 카운터도 아니라는
                     경계가 이름 안에 든다. 후보의 내용(선딜 길이 · 노출 · 캔슬 판정
                     셋)은 2026-08-20 Human 이 정한 그대로다.

    배운 것          후보 이름은 그 후보를 처음 보는 사람이 무엇인지 알아볼 수 있어야
                     한다. 우리가 만드는 것의 바닥(MMORPG)에 이미 이름이 있으면
                     그것을 쓴다 — 새 말을 지어내면 같은 것을 두 번 배우게 된다.

    흡수 이력        FR-INTERRUPT-DENIES-THE-BLOW 를 흡수한 판이 이 후보다 (위 병합 정정
                     참조). 이름이 다시 INTERRUPT 를 갖게 되어 그 이력과도 맞는다.

### 함께 갱신한 현재 상태 (③ 의 부산물)

    master/README.md 의 "현재 상태" 숫자가 C015~C018 반영 전 값에 멈춰 있었다 —
    Constraint 17→20 · Candidate 5→11 · Capability 42→45 · Frontier 5→2 ·
    Open Question 0→1 · 기준 시점 C013·C014→C017·C018. 숫자의 단일 출처가
    graph/GRAPH.md 머리말(재생성물)임을 README 에 적어 재발을 막았다.
    overlay.md 의 "MG-OVERCOME-SUPERIOR-OPPONENT (10 갈래)" 도 11 로 정정했다.

---

## C019 닫힘 — 선딜을 노려 끊는다 (Master Feedback 반영)

    Cycle          C019-startup-can-be-interrupted · STATUS COMPLETE
    Frontier       FR-INTERRUPT-THE-STARTUP (Human 선택 2026-08-20 · 이름 두 번 고침)
    사슬           MG-OVERCOME-SUPERIOR-OPPONENT → MP-INTERRUPT → MC-INTERRUPT
                   BW §28 의 여덟 갈래 중 다섯 번째가 섰다

### Overlay 승격

    MC-INTERRUPT   PARTIAL → IMPLEMENTED
        결손이었던 "끊는 것을 **노리는** 수단" 이 닫혔다. 근거는 08 의 실측이다 —
        끊김이 선딜 구간에만 성립하고, 같은 개입이 시점만으로 갈리며(0.49 ↔ 0.51),
        캔슬된 기술은 피해 0 이 아니라 산정 자체가 없다.

    MP-INTERRUPT   PARTIAL → PRESENT
        요구가 MC-INTERRUPT 하나뿐이었고 그것이 섰다. MG-OVERCOME-SUPERIOR-OPPONENT
        의 다섯 번째 경로다 (C011 · C012 · C013 · C015 에 이어).

    MW-ZONE-DANGER 의 demands 4종 중 하나가 채워졌다 (0/4 → 1/4).

### Constraint Evaluation 기록

    MC-INTERRUPT 노드에 둘을 남겼다 — 이 Cycle 에서 실제로 구현 형태를 제한했다.
        DC-COMBAT-PLAYER-CAUSALITY   캔슬 판정에 난수가 한 번도 쓰이지 않는다.
                                     세계의 흔들림(ChanceCursor)을 건드리지 않는다
        DC-COMBAT-ONE-FORMULA        피해 공식 파일을 한 글자도 고치지 않았다.
                                     캔슬은 공식 밖에서 그 산정이 일어나지 않게 한다
    ONE-LAYER-AT-A-TIME · SURFACE-LIST 도 SATISFIED 였으나 노드에 남기지 않았다 —
    구현 형태를 제한한 것이 아니라 지켜진 것이므로 (무차별 Edge 금지).

### Constraint Candidate 접수

    CC-THE-WORLD-JUDGES-THE-MOMENT (PENDING)
        세계 안에서만 아는 경계로 갈리는 사실은 경계가 아니라 갈린 결과를 보낸다.
        관찰 2회 — C012 의 defenseShape · C019 의 actionPhase.
        표면 무리 셋과 경계가 겹치므로 넷을 한자리에서 볼 것을 제안했다.

### 이 Cycle 이 다음에 남긴 것

    행동 안의 시점을 읽는 규칙이 세계에 생겼다. R1 §14 Active Defense 층이 요구하는
    "언제 눌렀는가" 가 이 위에 얹힌다 — MC-PERFECT-GUARD 의 결손이 "막기의 **시작
    시각**이 판정에 쓰이지 않는다" 였고, 이제 그 바닥이 있다. 남은 것은 그 층의
    설계 문서뿐이다 (overlay · frontier 의 해당 줄에 단서를 남겼다).

### 후보 이름을 두 번 고친 경위

    FR-ACTION-PHASE("행동 구간") → FR-INTERRUPT-THE-WINDUP("준비를 끊는다")
                                 → FR-INTERRUPT-THE-STARTUP("선딜을 노려 끊는다")

    첫 번째는 이미 세계에 있는 개념(C002 의 행동 · collision.ts 의 구간)까지 가리켜
    후보보다 넓었다. 두 번째는 Human 이 "무슨 말인지 모르겠다" 고 지적했고 그 지적이
    옳았다 — windup 은 야구에서 온 말이고 "준비" 는 무엇을 준비하는지가 빠져 있다.
    세 번째에서 이 바닥(MMORPG)의 통용어로 갔다: **선딜 · 판정 · 후딜 · 캔슬**.

    배운 것: 후보 이름은 그 후보를 처음 보는 사람이 무엇인지 알아볼 수 있어야 한다.
    우리가 만드는 것의 바닥에 이미 이름이 있으면 그것을 쓴다 — 새 말을 지어내면
    같은 것을 두 번 배우게 된다.

### Master Gap

    없음.

---

## Q32. IE 주입이 세운 두 Constraint 를 승인하는가 — CLOSED

    DECISION      (a) 둘 다 승인한다 (Human · 2026-08-21)

    DC-ITEM-CAPACITY-IS-FINITE · DC-ITEM-LIVES-IN-ONE-PLACE 가 APPROVED 로 섰다.
    아이템 영역 Constraint 는 이제 6종이다.

    MC-EQUIP-ITEM 의 두 UNRESOLVED 가 SATISFIED 로 바뀌었고, MC-TRANSFER-ITEM 의
    LIVES-IN-ONE-PLACE 도 함께 풀렸다. 장착이 Frontier 후보 조건을 갖추었으나
    순서상 바닥이 먼저이므로 후보로 올리지는 않았다 (frontier "지금 열 수 없는 것").

    IS §10 이 "무게 · 칸수 등 소지 제한" 을 범위 밖으로 두고 IS §5.4 가 자리 구성을
    후속 문서에 넘긴 그 자리를, IE 가 받아 채웠다.

---

## Q33. 장착 효과를 "재계산" 으로 못박을 것인가 — CLOSED

    DECISION      (a) prefers 한 줄을 더한다 — status 를 REVISED 로 (Human · 2026-08-21)

    DC-ITEM-HOLDING-IS-NOT-APPLYING 이 REVISED 가 되었다. 더한 것은 prefers 하나다.

        유효 값을 기본값과 지금 적용된 것들의 기여로 다시 계산하는 것 —
        장착·해제 시점에 값을 가감하지 않는다

    requires 와 prohibits 는 손대지 않았다. 원본(IE §38)이 "권장한다" 로 썼으므로
    금지로 올리지 않는다 — 같은 결과를 다른 방법으로 담보하는 구현을 막지 않는다.

    이 DC 는 원래 **증상**만 금지하고 있었다("장착과 해제를 반복해 값이 누적되는
    형태"). IE 가 그 증상이 나오지 않게 하는 **방법**을 공급했고, 그 방법이 원칙에
    없으면 Cycle 마다 다시 고르게 된다.

---

## Q34. 소지 한도는 "아이템의 바닥" 안인가, 다음 칸인가 — CLOSED

    DECISION      (a) 후보를 고친다 — 한도를 Cycle 1 에 넣는다 (Human · 2026-08-21)

    FR-WHAT-YOU-CARRY-CAN-BE-SPENT 를 IE §48 의 Cycle 1 행에 맞췄다. IE 는 손대지
    않았다 — 뒤에 온 문서가 자기 영역의 원본이라는 IS §5.4 의 선언을 따른다.

    후보에서 바뀐 것:

        이것이 무엇인가    "담을 자리가 유한한 곳에 들어가며" 를 더했다
        세계에 생기는 것    ② 로 "담을 자리가 유한해진다" 를 넣어 여섯 항목이 되었다
        이 기능이 아닌 것   "무게 · 칸수 같은 소지 제한도 아니다" 를 지우고,
                            "무게 · 부피가 아니다"(유한해지는 것은 칸이지 무게가 아니다)와
                            "가방을 늘리는 확장 시스템도 아니다" 로 바꿨다
        Why one Cycle      넷 → 다섯(정의 · 자리 · 관찰 · 사용 · 소모).
                            칸이 없으면 "가득 찼다" 도 없고, 그러면 소모가 만드는 압박이
                            반쪽이 된다 — 캐서 줄어들 뿐 무엇을 들고 다닐지는 여전히
                            선택이 아니다
        Active Constraints  DC-ITEM-CAPACITY-IS-FINITE 추가.
                            DC-ITEM-LIVES-IN-ONE-PLACE 는 이 Cycle 의 대상이 아니다 —
                            저장소가 아직 하나뿐이라 위반할 자리가 없다

    (c) 한도만 셋째 칸으로 빼는 안은 택하지 않았다. 소지 한도는 할 수 있는 일을
    늘리는 것이 아니라 좁히는 것이라 단독 Cycle 의 조건(CLAUDE.md 원칙 6)을
    만족하지 않는다.

## Q41. SF 가 명시한 원칙 셋을 Constraint 로 승인하는가 — CLOSED

    〔번호 정정〕 이 넷(Q41~Q44)은 처음 Q37~Q40 으로 적혔으나, 같은 날 다른 갈래에서
    C022 가 닫히며 Q37 · Q38 을 **다른 질문에** 먼저 썼다. 번호는 재사용하지 않으므로
    나중에 병합된 이쪽을 Q41~Q44 로 옮겼다. 내용은 그대로다.

    DECISION      (a) 셋 다 승인하고 병존시킨다 (Human · 2026-08-21)

    DC-SKILL-IS-COMBINATION-NOT-NAME · DC-SKILL-DELIVERY-IS-NOT-EFFECT ·
    DC-SKILL-COMBINE-BEFORE-NEW-FORM 이 Active 가 되었다. 문안은 주입판 그대로다
    (Q23 · Q30 선례와 같다 — 원본보다 세게 쓰지 않는다). Scope 는 `SKILL` —
    회복 · 소환 · 부여도 같은 조합으로 표현되므로 COMBAT 보다 넓다.

    (b) 의 통합안(첫째를 DC-ITEM-KIND-IS-DATA-NOT-BRANCH 와 합치는 것)은 택하지 않았다.
    두 원칙은 같은 방향이지만 근거 문서와 영역이 다르므로 병존하고, 새 쪽이
    `relations.supports` 로 옛 쪽을 가리킨다.

    승인과 함께 MC-COMBAT-STRIKE 에 앞의 둘을 걸었다 —
    DELIVERY-IS-NOT-EFFECT 는 SATISFIED(C020 이 전달을 하나 더하며 피해 경로를 한 줄도
    바꾸지 않았다), IS-COMBINATION-NOT-NAME 은 UNRESOLVED(값은 정의가 지니나 휘두름의
    모양이 아직 규칙 코드에 있다 — Q35 가 그 자리다).
    Active Constraint 는 26종 → 29종.

## Q42. 고른 상대에게 빗나감 없이 들어가는 스킬을 허용하는가 — CLOSED

    DECISION      지금 정하지 않는다. 범위 타격과 단일 대상 타격이 둘 다 있고 타게팅
                  방식은 스킬마다 다르다 — 그 갈래와 각각의 판정을 **이후 추가 기획**이
                  명확히 정의한다 (Human · 2026-08-21)

    확정된 것은 하나다. 타게팅 방식은 세계가 하나로 고정하는 규칙이 아니라 **스킬이
    지니는 갈래**다. 그러므로 이 질문의 답은 원칙(DC)이 아니라 그 갈래의 목록과
    각각의 조건을 적는 문서가 소유한다.

    DC-TARGET-IS-INTENT-NOT-AIM 은 손대지 않았다 — Active 그대로다. 따라서 그 추가
    기획이 오기 전까지 세계의 기준선은 지금 형태다: 고른 것에게 곧바로 위력을 전하는
    길은 이미 있으나(C020 던지기) 사거리 · 완료 시점 재검증 · 태도 관문을 지난다.
    조건 없는 "골랐다 = 맞았다" 를 세우려면 그 DC 를 먼저 고쳐야 하며, 그것은 살펴봄 ·
    채집을 포함한 모든 대상 지정 행동에 영향을 준다.

    유도 · 연쇄도 같은 문서로 넘어간다 — 세계가 대신 따라가거나 다음 대상을 고르는
    형태이므로 같은 자리에서 함께 정의된다.

## Q43. SF 의 유지형 발동이 무엇을 치르는지가 없다 — CLOSED

    DECISION      유지형은 반드시 무언가를 치른다. 무엇을 치르는지는 스킬마다 다르며
                  기력에 한정하지 않는다 — 기력 · 생명 · 아이템 · 시간 등 캐릭터의
                  모든 부분이 대가가 될 수 있다 (Human · 2026-08-21)

    이 답은 DC-COMBAT-SHARED-BUDGET 과 부딪히지 않는다. 그 원칙이 금지하는 것은
    **행동별 전용 게이지의 신설**이지 자원의 종류가 여럿인 것이 아니다 — 이미 세계에
    있는 것들(기력 · 생명 · 지닌 물건)을 대가로 쓰는 것은 예산을 쪼개는 일이 아니다.

    남은 세부는 Cycle 소유다. 어떤 유지형이 무엇을 얼마나 치르는지는 정의가 고르고
    그 값은 `03-world-semantic.md` 가 갖는다 (정책 §7.2). 특히 "유지형 전달이 만든
    타격이 기력을 되채우는가" 는 그 Cycle 이 답한다 — 지금 세계에서 기력은 타격 성공
    으로만 차므로, 고정 간격 판정이 그대로 충전하면 예산이 무한해진다.

## Q44. SF 가 답하지 않은 것 넷 — CLOSED

    DECISION      지금 정하지 않는다. 답하지 않은 것은 **이후 추가 기획**이 가져온다
                  (Human · 2026-08-21)

    넷은 그대로 남는다 — ① 세계에 몸이 아닌 존재가 없다 ② 전달체가 누구에게 보이는가
    ③ 효과 축의 절반이 없는 층(회복 · 조건)을 요구한다 ④ §29 의 기준을 SF 자신의
    14종에 적용하면 넷이 걸린다.

    따름 결과 둘.

        MS-SKILL-FORM 은 status: DRAFT 이고 자리도 14 그대로 둔다 — ④ 를 답하는
        문서가 오기 전에는 칸 수를 Agent 판단으로 줄이지 않는다.

        전달 형태는 아직 Frontier 후보가 되지 못한다. 그 형태를 요구하는 Possibility 가
        없고(Q35 의 7 조건 2), 위 넷 중 ①③ 이 그 Cycle 의 크기를 정하기 때문이다.
        frontier.md 의 "지금 열 수 없는 것" 이 그 사유를 진다.

---

## Frontier 선택 — FR-WHAT-YOU-CARRY-CAN-BE-SPENT (아이템의 바닥)

    선택            Human · 2026-08-21 (Q32 · Q33 · Q34 승인과 함께)
    직전 선택       FR-INTERRUPT-THE-STARTUP → C019 로 닫힘

    가장 크게 막힌 축(자원 → 능력)의 첫 칸이다. 뒤의 셋(장착 · 제작 · 세계의 아이템)과
    회복 · 절단 · 능력치 획득 · 전리품이 모두 이 하나를 기다린다.

    후보가 하나뿐이었던 것은 전투 쪽이 C019 로 닫히고 다음 전투 층(능동 방어)이
    설계 문서를 기다리기 때문이다.


## C020 닫힘 — 쓴다 · 없어진다 (Master Feedback 반영)

    Cycle          C020-what-you-carry-can-be-spent · STATUS COMPLETE
                   검사 6종 · 914 tests · Human Play 확인 (2026-08-21)
    Frontier       FR-WHAT-YOU-CARRY-CAN-BE-SPENT — **절반 소진**
    사슬           MG-EXPLORE-BEIRA → MP-ADAPT-BY-RESOURCE → MC-USE-ITEM
                   자원으로 감당하는 갈래의 첫 칸이 세계에서 굴러간다

### Overlay 승격

    MC-USE-ITEM    MISSING → IMPLEMENTED
        world_shape 세 문장이 모두 실측으로 닫혔다 — 쓸 수 있는 것과 없는 것이
        사유와 함께 오고, 고른 상대에게 돌을 던져 상태가 바뀌며 수량이 줄고,
        끊긴 사용은 아무 흔적도 남기지 않는다. 근거는 코드의 존재가 아니라
        세계 프로세스 실측이다 (타격 기록 `["stone", 3]` · 60초 16회 시도 9회 성립).

    MC-EQUIP-ITEM · MC-CRAFT-FROM-MATERIALS · MC-TRANSFER-ITEM   MISSING 유지
        다만 **공통 앞칸의 대부분이 섰다** — 정의소 · 변경 단일 통로 · 소모 ·
        원자성 · 용도 사슬의 몸에 닿는 절반. 각 행의 근거 칸에 그것을 적었다.

    MC-RESTORE-BIOLOGICAL-STATE · MC-CUT-ABNORMAL-STRUCTURE   MISSING 유지
        이 Cycle 은 그 어느 것도 닫지 않았다 (Q31 의 결정 그대로).

### Constraint Evaluation

    노드에 새로 남긴 것은 없다. 아이템 DC 넷(KIND-IS-DATA · CHANGE-IS-ONE-UNIT ·
    CAPABILITY-COMES-FROM-GRANTS · SURFACE-LIST)은 이미 SATISFIED 로 서 있었고,
    이 Cycle 은 그것을 **실측으로 확인**했을 뿐 구현 형태를 새로 제한하지 않았다
    (무차별 Edge 금지). 08 이 보고한 두 가지는 그대로 기록해 둔다 —
        COMES-FROM-GRANTS 는 절반만 섰다. `IM-*` 의 grants 가 몸에 닿는 것은 장착의 몫이다.
        ONE-LAYER-AT-A-TIME 은 SATISFIED 이나 그 근거가 Stage 1 의 주장과 달라졌다.
        "사거리를 그대로 두므로 층이 올라가지 않는다" 는 주장이 실측으로 깨졌고
        (사거리 2.0 에서는 그 사용이 성립하지 않는다), Human 결정으로 5.0 이 되었다.
        층은 여전히 올라가지 않았다 — 이미 있는 층에 입구가 하나 더 생겼고 그 입구가 소지품이다.

### 배운 것 — 두 갈래가 서로를 모른 채 병합됐다

    PR #772(이 Cycle)와 PR #774(IE 주입 + 다음 Cycle 정의)가 공통 조상 이전에서
    갈라져 각자 main 에 들어왔다. 파일이 겹치지 않아 git 은 조용히 합쳤지만
    **Master 상태는 한쪽만 반영됐다.**

        overlay      MC-USE-ITEM 이 MISSING 인 채로, 이미 사라진 코드를 근거로 인용했다
        frontier     이미 완주한 Frontier 가 SELECTED 로 적혔다
        Cycle ID     C020 이 둘이 되었다
        다음 Cycle   그 01-cycle.md 의 SCOPE NOTE ① 이 병합으로 거짓이 되었다
                     ("세계에 쓸 수 있는 것이 하나도 없다" — 작성 시점에는 참이었다)

    이 Feedback 이 넷을 정리했다. C020 자신의 01-cycle.md 가 이 위험을 예고하고 있었다
    ("두 갈래가 같은 Overlay 를 동시에 갱신하면 병합이 사실을 고르는 일이 된다") —
    실제로 일어난 것은 동시 갱신이 아니라 **한쪽의 통째 누락**이었다.
    2026-08-20 의 같은 교훈(병합 정리 절)에 이어 두 번째다.

    규칙으로 남긴다 — **닫힌 Cycle 의 Feedback 은 다음 Master 작업보다 먼저 돌린다.**
    (guides/master-feedback.md 가 이미 Must 로 갖고 있다. 지키지 못한 것은 두 세션이
    서로의 존재를 몰랐기 때문이므로, 병렬 갈래가 있으면 Master 작업 전에 main 을 먼저 본다.)

## Frontier 절반 소진 — FR-WHAT-YOU-CARRY-CAN-BE-SPENT

    Human 이 2026-08-21 에 고른 "아이템의 바닥" 은 Q34 로 다섯 조각이 되었다.

        정의 · 관찰 · 사용 · 소모     C020 으로 닫힘
        자리(소지 한도)              남았다 → FR-WHAT-YOU-CARRY-TAKES-ROOM 으로 frontier 에 남긴다

    후보를 새로 세운 것이 아니라 **같은 선택의 남은 절반**이다. 덜어내기가 자리와
    한 몸인 것도 같은 날 Human 이 정했다 (C022 SCOPE NOTE ①) — 칸만 넣으면
    가방이 차는 순간 채굴이 영구히 막히기 때문이다.

    직전 선택       FR-INTERRUPT-THE-STARTUP → C019 로 닫힘

## Feedback — C022(자리가 유한해진다) 반영 · 2026-08-21

    C022 의 `08-verification.md` MASTER FEEDBACK 을 Master 에 되돌렸다.
    **Cycle 은 아직 소진되지 않았다** — 여덟 Stage 실측은 끝났고 Gate 15항 중 열넷이
    충족이며, 남은 하나가 `인간이 실제 게임에서 Cycle Goal 달성을 확인했다` 다.
    그래서 frontier 의 후보를 지우지 않고 SELECTED 를 실제 상태로 갱신했다.
    확인이 끝나면 후보를 지우고 결과를 이 파일로 옮긴다.

### 번호 정정 — C021 → C022 (Master Gap ①)

    이 Cycle 은 `C020` 으로 정의되었다가 병합 충돌로 `C021` 로, 다시 다른 갈래가
    C021 을 쓰고 있어 Human 지시로 `C022` 로 옮겼다. `master/` 는 Cycle Agent 가
    편집하지 않으므로 세 파일이 낡은 번호를 부르고 있었다.

        frontier.md         4건 (SELECTED 절 · "지금 열 수 없는 것" 표)
        open-questions.md   1건
        HISTORY.md          1건

    의미는 하나도 바뀌지 않았다. **같은 사고가 이번 달에 세 번째다** —
    2026-08-20 병합 정리, 2026-08-21 C020 중복, 그리고 이번. 셋 다 원인이 같다:
    병렬 갈래가 서로의 Cycle 번호를 모른다. Cycle 번호를 고르는 것은 Cycle Agent 이고,
    그때 참조하는 것은 자기 갈래의 `cycles/` 뿐이다.

### Capability Overlay — 승격 0건

    이 Cycle 은 Capability 노드를 목표로 삼지 않았다. 소지 한도는 할 수 있는 일을
    늘리는 것이 아니라 **좁히는** 것이라 Capability 가 아니며, 그 판정은 IS §4 · §6 과
    overlay 아이템 절이 이미 내린 것을 그대로 따른 것이다.

    바뀐 것은 표의 **근거**다.

        MC-EQUIP-ITEM   MISSING 유지. 막던 것이 사라졌다 — IE §15 · §16.1 의 비대칭
                        ("가방이 가득할 때 해제는 막히고 교체는 된다")을 표현할 자리가
                        이제 세계에 있다 (`Inventory.UsedSlots` · 사유 `no-room`).
                        Human Play 확인이 끝나면 frontier 후보로 올린다
        MC-USE-ITEM     IMPLEMENTED 그대로 (C020). 이 Cycle 이 건드리지 않았다

### Constraint Evaluation — Graph 편집 0건 (의도된 것)

    C022 가 다섯 DC 를 SATISFIED 로 보고했다 (CAPACITY-IS-FINITE · CHANGE-IS-ONE-UNIT ·
    KIND-IS-DATA-NOT-BRANCH · WORLD-OWNS-THE-SURFACE-LIST ·
    GROWTH-DEFINITION-INSTANCE-SPLIT). 그런데 **Graph 노드에 바꿀 값이 없었다.**

    이 Cycle 이 목표로 삼은 노드가 없고, 그 DC 들을 지닌 노드(MC-EQUIP-ITEM 등)의
    `constraint_evaluation` 은 설계 수준의 판정이라 이미 SATISFIED 다. 판정이 실제
    구현에서 확인된 것은 **Cycle 의 사실**이지 노드의 값 변화가 아니다.
    없는 Edge 를 만들어 기록을 남기지 않았다 — 무차별 Edge 금지 (guides/master-feedback.md
    Do 3 · SCHEMA).

    다만 하나는 기록해 둘 값이 있다.

        DC-ITEM-CAPACITY-IS-FINITE 의 세 번째 requires ("칸 수를 바꿔도 규칙 코드가
        열리지 않는다")가 **처음으로 실행으로 확인되었다.** C022 가 값 두 줄(자리 수 ·
        겹침 한도)만 바꿔 같은 플레이 각본을 그대로 다시 돌렸고, 규칙 코드는 0줄
        바뀌었다 (자리 4·돌 3겹 → 돌 9 에서 가득 / 자리 3·돌 2겹 → 돌 4 에서 가득,
        둘 다 통과). 세 번째 조합(자리 6·돌 5겹)에서는 **가방이 차지 않았다** —
        자리가 광맥보다 커졌기 때문이다. 그것이 "한도는 세계에 캘 것이 자리보다
        많을 때만 겪힌다" 를 추측이 아니라 관찰로 만들었다.

### Constraint Candidate 접수 — CC-NO-SELF-INFLICTED-DEAD-END

    "플레이어는 자기 손으로 되돌릴 수 없는 막힘을 만들 수 없다."
    관찰 셋(C011 막기 무너짐 · C019 선딜 끊김 · C022 덜어내기)인데 성격이 갈린다 —
    앞의 둘은 **값으로** 지켰고 C022 가 처음으로 **규칙으로** 세웠다.

    승격 전에 정할 것이 Scope 다. GLOBAL 로 올리면 "되돌릴 수 없는 선택의 무게" 자체를
    세계에서 구조적으로 없애게 되고, 그것은 북극성(헌터헌터 수준의 깊이)과 정면으로
    부딪힐 수 있다. C022 가 막은 것은 재미있는 상실이 아니라 **아무것도 할 수 없게 되는
    상태**였다 — 그 둘을 가르는 선이 Human 이 판단할 핵심이다. `HUMAN DECISION: PENDING`.

### Master Gap 접수

    ② 자리 배치 조작을 세울 것인가        → Q37 (자리에 이름을 줄 것인가)
    ③ IE §34 "버리기" 와 C022 "덜어냄"    → Q38 (같은 행동인가)
    ④ 빈 가방을 플레이로 만들 수 없다      → **질문으로 세우지 않았다.**
        곡괭이는 `no-way-back` 이고 돌은 캐야 생기므로 자리 0 인 화면을 사람이 볼
        경로가 없다. 규칙은 0 을 정상으로 답하고 계약도 그 값을 싣는다 — 결함이 아니라
        **지금 세계의 크기**이고, 아이템이 늘면 저절로 사라진다. 결정할 것이 없는 것을
        질문으로 만들지 않는다.


---

## 주입 — 스킬 최종안(SK) 교체 · 구판(SF) 삭제 · 2026-08-21

    Human 지시: "승인된 Constraint 3종이 R0 의 §28.1 · §28.2 · §28.5 를 근거로 인용하는
    부분을 대체하고 R0 을 삭제. `content/proto-adventure/design/Skill/Skill-System.md` 를 근거로 하도록."

    구판 `content/proto-adventure/design/Design-Combat-SkillForm-R0.md`(SF)가 최종안 네 문서로 확장·분할됐다.

        content/proto-adventure/design/Skill/Skill-System.md           SK      정의 · 전체 관계 · 문서 책임 경계 ·
                                                       새 Primitive 추가 기준 · 금지 구조
        content/proto-adventure/design/Skill/Skill-Execution-Form.md   SK-EX   발동 · 대상 기준 · 대상 결정 ·
                                                       공간 조회 · 실행 여섯
        content/proto-adventure/design/Skill/World-Spatial-Presence.md SK-SP   몸이 아닌 존재의 공간 존재
        content/proto-adventure/design/Skill/Skill-Effect.md           SK-EF   효과 — 지금 있는 것으로의 연결

    구판은 삭제했다. 근거 문서로 남은 인용은 없다 — 아래 재배선이 전부를 옮겼다.

    **바뀐 의미** (구판 → 최종안). 이름의 교체가 아니라 축의 재편이다.

        지목 한 축          →  대상 기준(Anchor)과 대상 결정(Resolution) 두 축.
                               "고른 것 = 맞는 것" 이 아니게 되었고, 한 명이냐 여럿이냐가
                               스킬의 종류가 아니라 **결정의 결과**가 되었다
        전달 14종 열거      →  실행 여섯 + 공간 존재의 값 차이.
                               투사체 · 장판 · 부착 영역 · 이동 영역 · 함정 · 자취가
                               서로 다른 형태가 아니라 같은 존재의 기준(Anchor)과
                               이동(Movement) 값이 다른 것으로 되돌아갔다
        형상 · 시점 두 축    →  공간 조회의 한 칸 · 사건(Trigger)의 형태로 흡수
        효과 17종 선언      →  지금 세계에 구현된 것만. 회복 · 보호막 · 조건은
                               그 층이 서기 전에는 이름조차 두지 않는다

    산출물:
        constraints/    REVISED 3종 — IS-COMBINATION-NOT-NAME(조합의 항이 여섯에서
                        다섯으로) · DELIVERY-IS-NOT-EFFECT(자리 이름만 Delivery →
                        Execution · ID 유지) · COMBINE-BEFORE-NEW-FORM(추가 기준 다섯
                        → 여섯). 방향과 금지 범위는 그대로다
                        DRAFT 3종 — ANCHOR-IS-NOT-RESOLUTION · EFFECT-MUST-ALREADY-EXIST ·
                        PRESENCE-IS-WORLD-NOT-SKILL. 최종안이 새로 명시한 원칙이며
                        Human 승인 대기 → Q45
        graph/          MS-SKILL-FORM 재작성 — 이름 "스킬 전달 형태" → "스킬 실행 형태",
                        자리 14 → 6 (CONTACT · DIRECT · SPATIAL-QUERY ·
                        SPATIAL-PRESENCE · TRIGGER · COMPOSITION).
                        MC-COMBAT-STRIKE 의 `part_of` 근거 SF §6 → SK §5
        overlay.md      표에 줄을 더하지 않았다 — 그 형태를 요구하는 Possibility 가
                        여전히 없기 때문이다 (SCHEMA — 그런 것은 노드가 아니다).
                        차 있는 칸은 접촉 하나 그대로
        frontier.md     후보 8(휘두름의 모양이 값이 된다)의 근거를 SK 로 옮겼다.
                        (그 뒤 C023 Feedback 이 후보 둘을 소진시켜 **지금 6번**이다)
                        후보 자체는 바뀌지 않았다 — 여는 것도, 크기도, 의존 없음도 그대로다
        open-questions  Q35 의 관련 절 갱신 (자리가 여섯으로 줄어 (b) 를 골라도 열 층의
                        총량이 전보다 작다) · Q45 신설

    **닫힌 질문이 기다리던 문서가 이것이다.** Q42(타게팅 방식의 갈래) · Q44(SF 가
    답하지 않은 넷)는 "이후 추가 기획이 가져온다" 로 닫혔었다. 최종안이 그중 넷을
    공급했다 — 대상 기준·결정의 갈래(SK §3) · 몸 아닌 존재(SK-SP) · 그 존재가 누구에게
    보이는가의 경계(SK-SP §10) · 없는 효과를 미리 두지 않는 규칙(SK-EF §5). 자리를
    여섯으로 줄인 것이 Q44 ④(자기 기준을 자기 14종에 적용하면 넷이 걸린다)도 해소했다.
    닫힌 질문을 다시 열지는 않았다 — 남은 결손은 Q35 하나이고 그것은 기획이 아니라
    **배선**(어느 Possibility 가 이 자리를 요구하는가)이다.

    옮기지 않은 것과 사유:
        Goal / Possibility / Capability 노드 — 하나도 세우지 않았다. 최종안도 구판과
        같이 "누가 무엇을 왜 원하는가" 를 공급하지 않는다. 지금 MC 를 세우면
        required_by 와 demanded_by 가 둘 다 빈 고아 노드가 된다 (Q35 의 7 조건 2)
        수치 — 반경 · 각도 · 틱 간격 · 비행 속도는 전부 문서에 남겼다 (정책 §7.2)
        DIRECT 칸의 채움 — C020 의 던지기가 SK §8 의 대상 직접 실행과 같은 모양이지만
        문서가 그 노드를 지목하지 않았으므로 비워 두었다 (구판 판정과 같은 기준)

## Q45. SK 최종안이 새로 명시한 Constraint 셋을 승인하는가 — CLOSED

    DECISION      (a) 셋 다 승인 (Human · 2026-08-21)
                  PRESENCE 의 Scope 는 `SKILL` 유지 — 근거가 스킬 영역 문서이므로
                  영역을 넘기지 않는다 (Human · 같은 날)

    DC-SKILL-ANCHOR-IS-NOT-RESOLUTION · DC-SKILL-EFFECT-MUST-ALREADY-EXIST ·
    DC-SKILL-PRESENCE-IS-WORLD-NOT-SKILL 이 Active 가 되었다. 문안은 주입판 그대로다
    (Q23 · Q30 · Q41 선례 — 원본보다 세게 쓰지 않는다). Scope 는 셋 다 `SKILL` 이다.

    같은 결정에 포함된 것 — Active 셋(IS-COMBINATION-NOT-NAME ·
    DELIVERY-IS-NOT-EFFECT · COMBINE-BEFORE-NEW-FORM)의 근거를 삭제된 구판(SF)에서
    최종안(SK)으로 옮긴 재정합이 확정됐다. 셋 다 REVISED 이며 방향과 금지 범위는
    그대로다. 바뀐 것은 조합의 항 이름(여섯 → 다섯) · 추가 기준의 수(다섯 → 여섯) ·
    자리 이름(Delivery → Execution) 셋뿐이다. `DELIVERY-IS-NOT-EFFECT` 의 ID 는
    유지했다 — 이력이 이미 그 ID 로 여럿을 가리킨다.

    승인과 함께 MC-COMBAT-STRIKE 에 ANCHOR-IS-NOT-RESOLUTION 을 걸었다 —
    SATISFIED. 지금 세계의 휘두름은 고른 대상(`CurrentTarget`)을 읽지 않는다.
    맞는 것을 정하는 것은 칼끝이 쓸고 지나간 호이고(`world/semantic/collision.ts`),
    호에 든 여럿이 각각 맞으며 한 휘두름에 같은 몸은 한 번만 맞는다
    (`world/simulation/swing-strike.ts` — `StruckActorIds` · `Result Struck(대상 수)`).
    나머지 둘은 노드에 걸지 않았다 — EFFECT-MUST-ALREADY-EXIST 가 구속할 새 효과도,
    PRESENCE-IS-WORLD-NOT-SKILL 이 구속할 몸 아닌 존재도 세계에 아직 없다.

    Scope 를 넓히지 않은 결과 하나가 남는다. Frontier 후보 7(물건이 몸 밖에 놓인다 —
    C023 Feedback 뒤 **지금 5번**)이
    요구하는 것이 PRESENCE 와 같은 자리이지만, 그 후보는 이 원칙에 구속되지 않는다.
    그쪽을 구속하려면 아이템·세계 영역 문서가 같은 의미를 근거로 세워야 한다.

    Active Constraint 는 29종 → 32종.

---

## Feedback — C023(걸어 둔 것만이 몸을 바꾼다) 반영 · 2026-08-21

    C023 이 Gate 15항을 전부 충족하고 닫혔다. `08-verification.md` 의 MASTER FEEDBACK
    여섯 항을 반영했다. Human 이 완료를 판정했고 Agent 가 대신 판정하지 않았다.

### Capability Overlay — 승격 1건

        MC-EQUIP-ITEM   MISSING → **PARTIAL**   근거 C023 08-verification (세계 프로세스 실측)

    world_shape 다섯 문장 중 앞 셋이 닫혔다.

        닫힌 것   같은 물건을 가지고만 있을 때와 적용했을 때 몸이 다르게 판정된다
                  풀면 값과 가능한 행동이 정확히 이전으로 돌아온다
                  맞지 않는 것을 넣으려 하면 사유와 함께 거절된다
        남은 것   이미 찬 자리에 넣으면 넣기와 빼내기가 **한 번에** 일어난다
                  담을 곳이 가득해도 **바꿔 끼우는 것은 된다** (IE §16 · §16.1 의 비대칭)

    남은 둘은 후보 `FR-ONE-SLOT-ONE-ITEM` 이 소유한다 — 그것이 닫히면 IMPLEMENTED 다.

    이로써 `IM-*` 의 grants 가 **처음으로 몸에 닿았다.** overlay 아이템 절이
    "이것이 없어 grants 가 몸에 닿지 못한다" 로 적어 두던 자리가 사라졌다.

### Overlay 근거 갱신 — 승격 없이 결손이 줄어든 곳 셋

        MC-ATTACK-POWER          PARTIAL 유지. **"세계 안에서 이 값을 올릴 방법이 없다"**
                                 가 사라졌다 — 곡괭이를 걸면 물리 공격 40 → 52 가 플레이로
                                 관찰된다. 남은 결손을 다시 썼다: 값이 **달라지는** 것은
                                 섰고 **키우는** 축(성장 · 배움)이 없다

        MP-OUTGROW-THE-OPPONENT  같은 결손을 두 곳이 적고 있었다. MC 쪽을 고치고 이 줄을
                                 두면 Overlay 가 스스로 모순되므로 함께 고쳤다.
                                 이 갈래가 말하는 것은 *압도*이므로 여전히 자라는 축이 없다

        MP-ADAPT-BY-RESOURCE     **이 갈래의 문장이 세계에서 통째로 참이 되었다** —
                                 "물건이 대신해 주고, 물건을 잃으면 도로 못 하게 된다"
                                 (BW §17). 앞 절반은 C020, 뒤 절반은 C023 이 세웠다.
                                 남은 것은 제작이며 회복·절단 앞을 여전히 막는다

    **건드리지 않은 곳 하나** — MP-BET-ON-THE-CRITICAL-BLOW 는 "Critical 성질을 올릴
    성장·장비가 세계에 없다" 로 적혀 있고, C023 의 기여 얼개는 여덟 능력치 전부를
    대상으로 한다. 그러나 그런 물건이 실제로 없으므로 결손 문장이 여전히 참이고,
    Cycle 이 보고하지 않은 것을 추측으로 고치지 않았다 (guides/master-feedback.md Must Not).

### Frontier — 후보 둘 소진, 여섯 남음

    소진된 것을 지우고 번호를 다시 매겼다 (3~8 → 1~6).

        FR-WHAT-YOU-CARRY-TAKES-ROOM      C022 로 구현되었고 C023 의 실측이 다시 확인했다
                                          (가방 4/4 · `no-room` · 덜어내면 다시 캔다)
        FR-WHAT-YOU-WEAR-CHANGES-YOU      **C023 으로 닫혔다**

    남은 여섯의 `의존` 칸이 크게 바뀌었다 — 넷이 "후보 2(장착)가 먼저다" 였고
    그것이 전부 **"없다 — C023 이 그 앞을 세웠다"** 가 되었다.
    레인 A 에서 지금 바로 고를 수 있는 것이 다섯이다.

    병렬 배치 절도 다시 썼다. C023 이 `combat.ts` 의 `offenseStatValue` 를 유효 값으로
    옮기면서 **레인 A 와 B 가 겹치던 자리를 이미 지났다** — 남은 겹침은 `gameview.ts`
    와 등록부뿐이다.

    SELECTED 는 비웠다. 다음은 Human 이 고르는 자리다.

### Constraint Evaluation — Graph 편집 1건 (overlay 필드)

    C023 이 여덟 DC 를 보고했고 그중 다섯이 MC-EQUIP-ITEM 의 `constraint_evaluation` 에
    이미 SATISFIED 로 있었다. **판정이 실제 구현에서 확인된 것은 Cycle 의 사실이지
    노드의 값 변화가 아니다** — C022 때와 같은 판단으로 노드를 건드리지 않았다.
    바뀐 것은 `overlay: MISSING → PARTIAL` 하나다.

    기록해 둘 값 하나.

        DC-ITEM-KIND-IS-DATA-NOT-BRANCH 와 DC-ITEM-CAPABILITY-COMES-FROM-GRANTS 가
        **값 두 줄로 실행 확인되었다.** 자리 수 6 → 3, 곡괭이의 기여 12 → 20 을 바꾸고
        같은 각본을 다시 돌려 40/40 통과했고 `world/rules/` `world/projection/` 변경
        줄 수가 **0** 이었다.

        그 시험을 세우다 한 번 되돌린 것이 더 값지다 — 첫 판은 각본에 `base + 12` 를
        박아 두어 기여를 바꾸자 세 곳이 깨졌다. **규칙이 아니라 시험이 값을 알고
        있었다.** 정의에서 읽도록 고친 뒤에야 이 항이 실제로 증명되었다.
        C022 가 "각본이 값을 읽어 판단하므로 그대로 돈다" 를 적어 둔 것과 같은 형태이며,
        같은 함정을 한 번 더 밟았다는 뜻이기도 하다.

### Constraint Candidate 접수 — 2종

    CC-THE-EFFECTIVE-IS-DERIVED-NOT-STORED
        "여러 출처가 합쳐져 나오는 값은 저장하지 않고 매번 다시 센다."
        관찰 둘(C022 자리 · C023 유효 값)인데 **둘째가 이유를 하나 더 댄다** —
        C022 는 정합성을 위해, C023 은 **가역성**("풀면 정확히 이전으로")을 위해
        파생을 골랐다. 다음에 이 물음이 오는 곳은 아이템이 아니라 조건 층이고
        (MC-CONDITION-STACKING · IE §21 의 "하나의 합성 얼개"), 그 문서가 오기 전에
        서 있으면 얼개를 하나로 묶을 근거가 된다.
        승격 전에 정할 것은 **"합성된 값" 과 "누적이 곧 진실인 값"(HP·기력·수량)을
        가르는 선**이다. `HUMAN DECISION: PENDING`.

    CC-THE-SURFACE-MUST-NOT-PROMISE-WHAT-THE-INPUT-CANNOT-DO
        "화면이 안내하는 조작은 실제로 그 일을 해야 한다."
        C023 의 첫 판이 `걸기 ✓ V → 1` 이라고 띄웠는데 `V` 는 이미 속성 관찰이었다.
        **세계는 옳았고 결정 Layer 도 옳았다** — 어긋난 것은 화면의 말과 손가락 사이다.
        World 시험도 Fixture 시험도 잡지 못한다 (둘 다 키를 모른다).

        Cycle Agent 스스로 **"Master 노드가 아니라 공정의 문제일 수 있다"** 고 보고했고
        Agent 판단도 그렇다 — 키 충돌은 판단이 아니라 조회이므로 도구가 맞다.
        다만 도구는 "같은 키가 둘" 만 잡고 이 후보의 넓은 부분은 잡지 못한다.
        **닫든 세우든 도구 작업을 어딘가에 적어 두는 것**이 실제 결론이다.
        `HUMAN DECISION: PENDING`.

### Master Gap — 없음. 다만 Human 이 알아야 할 것 셋

    ① IE §10 의 비(比)가 뒤집혀 있다 — 자리 6 · 가방 4
        "자리 수가 소지 칸 수보다 훨씬 적다"(30 : 6)가 이 세계에서 6 : 4 다.
        **지금은 겪히지 않는다** — 걸 수 있는 물건이 곡괭이 하나뿐이라 자리가 여섯이든
        하나든 플레이가 같다. 겪히는 것은 걸 수 있는 종류가 자리 수를 넘을 때이고,
        그날 값 하나가 움직이면 된다 (위 실행 확인이 그것을 보였다).
        **질문으로 세우지 않았다** — 지금 결정할 것이 없다.

    ② C022 의 Cycle Artifact 가 아직 `IN PROGRESS — AWAITING HUMAN PLAY` 다
        Overlay 와 Frontier 는 C022 를 닫힌 것으로 반영했다 — 그 근거는 C022 자신의
        실측이고, C023 의 실측이 그 규칙들을 다시 처음부터 돌렸다(가방 4/4 · `no-room` ·
        덜어내기 · `no-way-back`). 그러나 **Cycle Artifact 는 History 이므로 이 층이
        고치지 않는다.** C022 의 STATUS 를 닫을지는 Human 이 그 Cycle 쪽에서 할 일이다.

    ③ 03 이 답하지 않은 것 하나를 Stage 6 이 닫았다 — 걸린 것을 쓰는 입구
        C020 이 세운 "곡괭이를 쓰면 채집이 시작된다" 가, 곡괭이가 가방을 떠나면서
        조용히 사라질 뻔했다. 규칙은 이미 옳았고 관찰만 없었으므로 자리에 `use-item`
        을 실었다. **Master Capability 를 늘리지 않는다** — 잃을 뻔한 것을 지킨 것이다.
        반영할 노드가 없어 기록만 남긴다.

### 화면 쪽으로 넘어간 것 하나 (Master 밖)

    소지품·장착의 타일뷰(격자 · 빈 슬롯 · 드래그 · 우클릭 메뉴)는 **Cycle 이 아니라
    기반 트랙 일이다** — `SceneHudItem.widget` 이 `counter | flag | label` 셋뿐이라
    격자를 그릴 능력이 없다. 표시·우클릭·드래그로 걸기/풀기까지는 World 도 계약도
    바뀌지 않는다.

    다만 **칸 사이 이동 · 나누기 · 정렬**은 세계에 칸 인덱스가 없어 후보
    `FR-ARRANGE-WHAT-YOU-CARRY`(지금 3번)가 필요하다. 그 후보의 7 조건이 약해
    보류 중이었는데(Q37), **화면 쪽 요구가 그 후보에 새 근거를 준다.**
    frontier 의 추천 순서에 그 사실을 적었다.

---

## Feedback — C024(한 자리에는 하나) 반영 · 2026-08-22

    C024 가 Gate 15항을 전부 충족하고 닫혔다. `08-verification.md` 의 MASTER FEEDBACK
    을 반영했다. Human 이 완료를 판정했고 Agent 가 대신 판정하지 않았다.

    **Stage 5 가 통상과 다르게 닫혔다** — Human 이 Stage 1~4 산출 뒤 "끝까지 진행" 으로
    남은 전부를 지시했고, `05-review.md` 는 그 지시의 기록이지 Agent 의 판정이 아니다.
    03 의 JUDGEMENT 다섯은 Agent 권고안 그대로 채택되었다. 이 사실을 여기 적어 두는 것은
    **그 다섯이 검토를 거친 결정이 아니라 기본값**이기 때문이다 — 뒤집을 일이 생기면
    Cycle Artifact 를 고치지 말고 다음 Cycle 이 CHANGED 로 처리한다.

### Capability Overlay — 승격 1건

        MC-EQUIP-ITEM   PARTIAL → **IMPLEMENTED**   근거 C024 08-verification (세계 프로세스 실측)

    C023 이 남긴 world_shape 두 문장이 닫혔다.

        닫힌 것   이미 찬 자리에 넣으면 넣는 것과 빼내는 것이 **한 번에** 일어나고,
                  둘 중 하나가 성립하지 않으면 아무것도 일어나지 않는다
                  담을 곳이 모자라 풀 수 없을 때도 **바꿔 끼우는 것은 된다**

    실측은 **같은 세계 상태에서 두 요청을 연달아** 던져 얻었다 (IE §46 Test 09 가 요구한
    형태 그대로) — 가방 4/4 에서 해제는 `no-room`, 교체는 성공, 그리고 교체 뒤에도 4/4.
    물리 공격 52 → **40**(기본값) · 물리 방어 50 → 65 로 헌것의 기여가 정확히 사라졌고
    채집도 함께 사라졌다.

    **남은 곁가지 둘은 결손이 아니다** — overlay 의 "부족한 것" 칸에 적었다.
        · 전용 자리를 선언한 물건이 없어 `slot-not-fit` 이 코드에만 서 있다
        · 자리 여섯이 걸 것 둘보다 넓어, 교체가 아직 *고르는 일*이 아니다 (아래 Gap ②)

### Overlay 근거 갱신 — 승격 없이 결손이 줄어든 곳 둘

        MC-ATTACK-POWER          PARTIAL 유지. "물건 쪽도 곡괭이 하나뿐" 이 사라졌다 —
                                 걸 것이 둘이 되었다. 다만 그 둘은 **바꿔 끼는 관계이지
                                 쌓이는 관계가 아니므로** 값을 키우는 축은 여전히 없다

        MP-ADAPT-BY-RESOURCE     갈래가 처음으로 **둘**이 되었다 (공격을 얹을지 방어를
                                 얹을지). 그러나 자리가 여섯이라 아직 둘 다 걸 수 있어
                                 진짜 선택은 아니다 — 그 사실을 근거 칸에 적었다

### Constraint Evaluation — 기록 1건

        MC-EQUIP-ITEM 에 `DC-ITEM-CHANGE-IS-ONE-UNIT: SATISFIED` 를 더했다.
        이 Cycle 이 그 원칙을 **실제로 구현 형태에 걸었기** 때문이다 — 교체를 두 요청으로
        가르지 않고 하나로 둔 것, 검증을 변경보다 앞세워 중간 상태를 없앤 것, 실패 셋에서
        자리·수량·유효 값·용도 넷이 그대로인 것이 전부 이 원칙의 결과다.
        나머지 여섯(HOLDING · CAPABILITY-FROM-GRANTS · CAPACITY-IS-FINITE ·
        LIVES-IN-ONE-PLACE · KIND-IS-DATA · SURFACE-LIST)은 판정이 바뀌지 않아 그대로 둔다.

### Frontier 정리

        지운 것   `FR-ONE-SLOT-ONE-ITEM` (후보 1) — 소진. 결과는 위 표에
        세운 것   `FR-THE-PLACES-ARE-NARROWER-THAN-WHAT-YOU-WEAR` (자리가 걸 것보다
                  좁아진다) — **C024 가 낳은 후보다.** 교체라는 수단은 섰는데 그것을
                  써야 할 이유가 세계에 없다는 것이 이 Cycle 의 실측으로 드러났다
        번호      레인 A 가 하나 줄고 하나 늘어 여섯 그대로다. 추천 1순위를 새 후보로 옮겼다

### Constraint Candidate — 접수 1건

    CC-WHAT-THE-WORLD-CANNOT-GIVE-BACK-MUST-NOT-BE-LOSABLE
        "세계가 다시 내어줄 수 없는 것을 처음부터 쥐여 주었다면, 그것을 잃는 길도 막아야
        한다." C024 가 손방패를 초기 소지품으로 주었는데 세계에 그것을 내는 곳이 없다.
        C022 의 막힘 판정은 **용도**만 보므로 걸리지 않는다 — 손방패는 용도를 주지 않기
        때문이다. 지금은 아무 해도 없다(잃어도 세계가 좁아질 뿐 막히지 않는다).
        `HUMAN DECISION: PENDING`.

### Master Gap — 셋. 전부 Human 이 볼 것이고 Agent 가 해결하지 않았다

    ① 유래를 답하지 못하는 아이템이 **둘**이 되었다 (Q36 이 열려 있다)
        곡괭이에 이어 손방패도 `IT-*` 가 없다. Cycle 이 지어 붙이지 않은 것은 옳다 —
        `Design-Resource-Catalog-R0.md` 가 승인 대기이고 그것이 Q36 과 함께 닫힌다.
        **질문을 새로 세우지 않았다.** 이 Cycle 이 한 것은 Q36 의 무게를 하나 올린 것뿐이며,
        그 사실을 Q36 에 적었다.

    ② 자리 여섯이 걸 것 둘보다 여전히 넓다 (IE §49 P3)
        **이것은 후보로 세웠다** (`FR-THE-PLACES-ARE-NARROWER-THAN-WHAT-YOU-WEAR`).
        C023 Feedback 때 "지금은 겪히지 않는다 · 질문으로 세우지 않았다" 로 남겼던 것이,
        걸 것이 둘이 되면서 **겪히기 직전까지 왔다** — 그래서 이번에는 후보다.
        어느 쪽을 움직일지(자리를 줄일지 걸 것을 늘릴지)는 그 Cycle 이 Human 에게 묻는다.

    ③ 교체가 시간을 쓰지 않는다
        걸기·풀기와 같이 즉시 일어난다 (C023 이 그렇게 세웠고 C024 가 따랐다).
        전투 중에 값을 갈아 끼우는 것이 공짜라는 뜻이다. **지금은 겪히지 않는다** —
        걸 것이 둘뿐이고 전투 중에 바꿀 이유가 없다. 대가의 축이 서면 다시 볼 자리이며,
        **질문으로 세우지 않았다** (지금 결정할 것이 없다).

---

## Feedback — C025(휘두름의 모양이 값이 된다) 반영 · 2026-08-21

    입력   `cycles/C025-the-shape-is-data/08-verification.md` 의 MASTER FEEDBACK 아홉 항.
           그 Cycle 은 Stage 8 실측을 마쳤고 **Human Play 확인만 남았다** — 그래서
           후보를 지우지 않고 `SELECTED` 로 옮겼다 (아래 Frontier 절).

### Capability Overlay — 승격 없음, 판정 하나 닫힘

    MC-COMBAT-STRIKE 는 **IMPLEMENTED 그대로**다. C025 는 새 Capability 를 세우지
    않았고 기존 노드의 내부를 넓혔다. 대신 그 노드에 걸려 있던 Constraint 판정이 닫혔다.

        DC-SKILL-IS-COMBINATION-NOT-NAME    UNRESOLVED → SATISFIED

    근거는 코드가 있다는 사실이 아니라 **값을 바꿔 본 결과**다. 큰 기술의 모양 셋을
    `40°·2.2·0.55` 에서 `100°·1.6·0.9` 로 바꾸고 같은 플레이 각본을 그대로 다시 돌렸더니
    옆에 선 상대의 판정이 뒤집혔다 — 규칙 코드 0줄 · 화면 코드 0줄 · 각본 0줄.
    되돌리니 첫 판의 값이 그대로 돌아왔다 (C025 08-verification.md CONSTRAINT 실측).

    **이것이 MC-COMBAT-STRIKE 의 마지막 UNRESOLVED 였다** — 이제 그 노드의 네 판정이
    모두 SATISFIED 다.

### Overlay 근거 갱신 — 상태를 바꾸지 않은 곳 둘

    MC-COMBAT-STRIKE   근거 칸에 C025 를 더했다. 모양이 전역 상수에서 정의로 내려왔다는
                       사실은 상태를 바꾸지 않지만 **다음에 무엇이 싼가**를 바꾼다
    MC-EVADE           MISSING 유지. "공격이 이미 공간 판정이라 얹힐 바닥은 서 있다" 에
                       한 줄이 붙었다 — 그 공간이 이제 **기술마다 다르므로** 회피가
                       설 때 피할 대상이 하나가 아니다. 상태를 바꿀 근거는 아니다

    MS-SKILL-FORM 서술에도 한 줄이 늘었다. CONTACT 칸의 모양이 값이 되었으므로 남은
    다섯 칸이 설 때 그 축을 재사용한다 — **다만 그것이 남은 칸을 여는 것은 아니다.**
    막는 것은 형상이 아니라 요구하는 Possibility 가 없다는 쪽이다 (Q35 의 7 조건 2).

### Frontier — 소진 없음, `SELECTED` 의 형태가 바뀌었다

    후보 6(FR-THE-SHAPE-IS-DATA)은 **지우지 않았다.** Gate 15항 중 열넷이 충족이고
    남은 하나가 Human Play 확인이다 — 기계가 실제 세계 프로세스와 실제 브라우저로 같은
    각본을 돌렸어도 그것을 대신하지 않는다. Status 를 `SELECTED — C025 가 돈다` 로 바꿨다.

    `SELECTED` 칸을 **레인별로** 적는 형태로 바꿨다.

        레인 B   FR-THE-SHAPE-IS-DATA — C025 가 돈다 (Human Play 확인 대기)
        레인 A   없음 — Human 선택 대기

    지금까지 이 칸은 하나만 담았고, 그래서 레인 둘이 동시에 돌 때 한쪽이 **이 칸 밖에서
    출발해야 했다.** C025 가 실제로 그랬다 — 01-cycle.md 의 MASTER TRACE 가 그 사유를
    적고 있다. 형태를 바꾼 것은 결손을 드러내기 위한 최소 변경이며, 이대로 둘지는
    Human 판단이다 (Q46).

### Constraint Evaluation — Graph 편집 1건

    `graph/capabilities.yaml` 의 MC-COMBAT-STRIKE `constraint_evaluation` 한 줄.
    노드에는 값과 짧은 근거만 두었다 — 경위는 이 문서가 소유한다 (원칙 20).

### Constraint Candidate 접수 — 1종

    CC-A-SHARED-CONSTANT-BECOMES-A-DEFINITION
        "세계가 모든 종류에 똑같이 물려주던 상수가 종류마다 달라야 할 이유를 얻으면,
         새 층을 세우지 않고 그 상수를 정의로 내린다."

        C019(시간 축)와 C025(공간 축)가 각자 발견해 같은 답에 이르렀다. 두 번 다
        더 큰 것을 만들 뻔했고 — C019 는 "선딜 시스템", C025 는 "공격 방식 층" —
        값 몇 칸으로 끝난 것은 결과이지 처음부터 보이던 길이 아니었다.

        **반론도 함께 적었다.** DC-SKILL-COMBINE-BEFORE-NEW-FORM 이 이미 절반을 담고
        있어(§6-2 — 파라미터로 되는 것을 새 형태로 세우지 않는다), 그쪽 rationale 에
        C025 를 두 번째 사례로 적는 것으로 족할 수 있다. HUMAN DECISION: PENDING.

### 새 열린 질문 — Q46 (공정)

    "레인이 둘일 때 `SELECTED` 와 Cycle 번호를 누가 잡는가."

    다른 열린 질문 다섯과 결이 다르다 — 게임의 의미가 아니라 **두 층이 굴러가는 방식**을
    묻는다. 세 번 겹친 뒤에 올라왔다.

        C022   C020 → C021 → C022 로 두 번 옮겼다
        C025   C023 → C024 → C025 로 **두 번** 옮겼다. 두 번 다 레인 A 가 같은 번호로
               먼저 main 에 들어왔다 (`C023-what-you-wear-changes-you` · `C024-one-slot-one-item`)

    두 레인이 각자 "다음 빈 번호" 를 세면 언제나 같은 수가 나온다. 번호는 레인이 스스로
    정할 수 있는 것이 아니라 먼저 잡아 두어야 하는 것이다. 선택지 넷을 Q46 에 적었다.

    **번호 쪽 절반은 그 사이에 답을 얻었다.** 레인 A 가 `frontier.md` 의 "병렬 배치" 절에
    `Cycle 번호를 먼저 예약한다` 를 세웠다 (Stage 1 전에 디렉터리와 제목 줄만 push).
    이 Feedback 은 그 규칙을 지우지 않고 Q46 의 선택지 (a) 로 기록했다 —
    실무에서 먼저 선 것을 문서가 뒤늦게 따라간 형태다.

### Q35 갱신 — 선행 작업이 끝났다

    Q35 의 "아직 없는 것" 에서 **휘두름의 모양이 빠졌다.** 그 항목의 선택지 (a) 가
    *"대신 휘두름의 모양을 정의로 꺼내는 일이 선행 작업이 된다"* 고 적었고, 그 일이
    C025 다.

    **질문 자체는 열려 있다.** 선행 작업이 끝난 것과 "층이냐 갈래냐" 를 정하는 것은
    다르다 — (a) 를 고르는 데 걸림돌이 하나 줄었을 뿐이다.

### Master Gap — 없음. 기반 트랙으로 넘어간 것 둘 (Master 밖)

    C025 가 보고한 아홉 항 중 둘은 Master 의 일이 아니라 **기반(engine)** 의 일이다.
    Overlay 에 올리지 않았고 여기 기록만 남긴다.

    조작 키의 단일 출처가 없다
        키를 먼저 가져가는 자리가 셋인데(`keyboard.ts` 의 MOVE_KEYS · TURN_KEYS,
        `app/main.ts` 의 셋) 어느 것도 팩이 읽을 수 있게 내보내지 않는다. 그래서
        **C012 의 오라 스킬(R)과 C017 의 살펴보기(T)가 눌러도 나가지 않는 상태로 있었다** —
        C025 가 실제로 눌러 보고 발견해 H · Y 로 옮겼다. 팩은 `RESERVED_KEY_CODES` 라는
        사본으로 막아 두었으며, 기반이 그 목록을 내보내면 사본을 지운다.

    `SceneColliderDebug` 의 이름이 뜻과 어긋난다
        C025 가 그 계약을 평시 장면 표현에 쓴다. 능력이 하는 일은 이름과 무관하게
        "지면 위 부피를 그린다" 하나여서 그대로 맞지만 이름은 어긋난다.

## Feedback — C026(가진 것을 여는 자리) 반영 · 2026-08-23

    입력   `cycles/C026-open-what-you-carry/08-verification.md` 의 MASTER FEEDBACK.
           그 Cycle 은 STATUS COMPLETE 다 — Stage 8 실측을 마쳤고 Human 이 실제 게임
           화면을 보고 확인했다.

    이 Cycle 은 **Frontier 후보에서 오지 않았다.** 기획서
    `content/proto-adventure/design/Design-View-Inventory-Equipment-UX-D1.md` 가 스스로 `[DIRECT-CYCLE]` 로
    표시했고 Human 이 후보 등록을 건너뛰고 착수를 지시했다. 그것이 절차의 예외가 아니라
    **층의 구분**이라는 것이 이번에 확인되었다 — Master Layer 가 고르는 것은 "세계가
    무엇을 더 할 수 있게 되는가" 이고, 이 Cycle 은 그것을 하나도 늘리지 않는다.

### Capability Overlay — 승격 없음, 판정 하나 없음

    **어떤 노드의 상태도 바뀌지 않았다.** 이 Cycle 은 Capability 를 목표로 삼지 않았고
    (01-cycle.md MASTER TRACE 의 `Target Capability: 없음`), 실제로 세계를 한 줄도
    고치지 않았다 (06-world-implementation.md — `world/` 무변경).

    바뀐 것은 판정이 아니라 **판정의 값어치**다. 아이템 영역의 IMPLEMENTED 넷은 지금까지
    "세계에 그 의미가 있다" 였고, 그것에 닿는 길은 손가락 자리(`B`·`N`·`M`·`,`)를 외운
    사람에게만 있었다 — 한 물건에 대한 답이 화면 두 곳에 흩어져 있었고, 무엇을 고르는
    중인지는 어디에도 남지 않았다. 이제 그 넷이 **겪을 수 있다**.

    overlay.md 의 아이템 영역 서문에 그 문단을 넣었고 표는 한 칸도 건드리지 않았다.
    같은 이유로 `graph/capabilities.yaml` 도 손대지 않는다 — 노드에는 값만 둔다.

### Constraint Evaluation — 기록하지 않는다

    Cycle 이 넷을 SATISFIED 로 보고했다 (SURFACE-LIST · KIND-IS-DATA-NOT-BRANCH ·
    CAPACITY-IS-FINITE · HOLDING-IS-NOT-APPLYING). **어느 노드에도 적지 않는다** —
    이 Cycle 이 Capability 노드를 건드리지 않았으므로 판정을 걸 자리가 없고,
    없는 자리에 Edge 를 만드는 것이 무차별 Edge 다 (Guide MUST NOT).

    다만 넷 중 하나는 이번에 **어긴 형태가 무엇인지**가 실제로 드러났으므로 남긴다.
    DC-WORLD-OWNS-THE-SURFACE-LIST 를 어기는 가장 자연스러운 길은 "세계가 된다고 한 것을
    화면 사정으로 안 된다고 그리는 것" 이다. 이 Cycle 에서 `exchange-item` 이 정확히 그
    자리였다 — 세계는 가능이라고 실었는데 그 표면에는 자리를 고르는 길이 아직 없다.
    감추지도 않고 불가로 그리지도 않고 **"이 자리에서는 아직" 을 곁글자로** 적는 것으로
    풀었다. 세계의 판정과 화면의 형편을 뭉개지 않는 형태이며, 이후 표면 작업이 같은
    자리를 만난다.

### Constraint Candidate — 접수 없음

    Cycle 이 반복 패턴 하나를 보고했다: **표면이 넓어질 때 화면이 판정을 시작하려 한다.**
    두 번 나타났고(가방의 형편에서 교체 가능 여부를 유추하려는 자리 · 위 `exchange-item`),
    **둘 다 기존 Constraint 로 막혔다.** 이미 있는 것이 막은 패턴은 새 Constraint 가
    아니다 — 후보로 올리지 않는다. Cycle 자신도 그렇게 판정했다.

### Frontier — 지울 후보 없음, 두 후보가 싸졌다

    소진된 후보가 없다. 이 Cycle 이 어느 후보에서도 오지 않았기 때문이다.

    대신 둘의 값이 내려갔다.

        후보 1 FR-SEE-BEFORE-YOU-WEAR      미리 본 값이 설 자리가 생겼다. 고른 물건
                                           하나의 상세가 뜨는 표면이 이미 서 있으므로
                                           이 후보는 **세계 쪽 계산 하나**만 더하면 된다
        후보 2 FR-ARRANGE-WHAT-YOU-CARRY   그 결손이 화면에서 드러났다 — 소지품 표면의
                                           빈 칸들은 서로 구별되지 않고 지목할 수 없다.
                                           세계에 번호 붙은 빈 자리가 없기 때문이며
                                           (INTENT-EMPTY-ROOM-HAS-NO-ADDRESS-001),
                                           그 축을 세우는 것이 이 후보다

    `SELECTED` 절에 레인 A 에서 후보 없이 한 바퀴가 돌고 닫혔다는 사실을 적었다.
    레인 A 의 **후보 자리**는 여전히 비어 있고 Human 선택 대기다.

### 이번에 처음 명시된 부정형 하나

    `INTENT-EMPTY-ROOM-HAS-NO-ADDRESS-001` — **세계에는 번호 붙은 빈 자리가 없다.**

    C022 가 자리를 수로만 세운 결과이므로 새로 정한 것이 아니라 이미 그러한 것을 밝힌
    것이다. 이것을 못 박지 않았다면 Stage 4 가 "빈 칸도 요청 대상" 이라는 없는 의미를
    만들어 냈을 것이고, 그 다음에 오는 것은 세계에 없는 "칸을 끌어다 옮기기" 다.

    **그리고 그 부정형이 계약의 오류 하나를 잡았다.** Stage 4 가 "capacity 만큼의 칸을
    놓고 항목이 앉지 않은 것을 빈 자리로" 라고 적었는데, 그 규칙은 화면이 겹침 한도를
    안다고 전제한다 — 계약은 그것을 싣지 않는다(C022 가 일부러 뺐다). 돌 아홉은 항목
    하나에 자리 셋이므로 성립할 수 없다. Stage 7 이 `GAMEVIEW GAP` 으로 반환해 고쳤다.

### Master 의 일이 아닌 것 — 기반(engine) 으로 간다

    Cycle 이 함께 보고한 것 중 둘은 Master Graph 의 일이 아니다. 여기 적어 두는 것은
    그것이 **어디로 갔는지**를 잃지 않기 위해서다.

    ① `engine/view-kernel` 안에 표시 문구(한국어)가 남아 있다 — 팩에 이미 문구 표가
       있으므로 같은 것이 두 곳에 있다. 기반 트랙 부채로 적혔다
       (design/Design-System-Content-Separation.md 남은 부채)
    ② 이동·시점 키의 원본(MOVE_KEYS · TURN_KEYS)이 팩에 내보내지지 않아 사본
       (`RESERVED_KEY_CODES`)으로 막고 있다 — **레인 B 의 C025 가 먼저 올린 것과 같은
       부채**이며 여전히 열려 있다. C026 은 기반 쪽에서 `keyboard.suspendMovement` 로
       한 면(표면이 잡고 있는 동안 방향키가 평범한 키가 된다)만 닫았다

    두 레인이 **같은 원인의 서로 다른 두 면**을 각자 발견했다는 것이 이번 관찰이다.

### 번호 이동 — C025 → C026 (세 번째)

    레인 B 의 `C025-the-shape-is-data` 가 먼저 main 에 들어와 이 Cycle 이 C026 으로
    옮겼다. 나중에 병합하는 쪽이 옮긴다 — 먼저 들어온 것의 번호를 바꾸면 이미 그것을
    가리키는 문서들이 어긋난다.

    frontier.md 의 "병렬 배치" 절이 이미 `Cycle 번호를 먼저 예약한다` 를 규칙으로
    적어 두었다. **이번에도 지켜지지 않았다** — 이 Cycle 은 기획서의 직접 실행 지시로
    출발해 Frontier 를 거치지 않았고, 번호 예약은 그 절에만 적혀 있기 때문이다.
    `[DIRECT-CYCLE]` 로 출발하는 Cycle 도 번호를 예약해야 하는가는 Human 판단이다 —
    open-questions Q46(SELECTED 칸의 형태)과 같은 뿌리다.

## 주입 — 세계 무대(BT) · 2026-08-26

    Human 지시: "LANES.md 참고하여 위의 기획에 대한 master 주입을 진행한다.
    2. 세계 무대: content/proto-adventure/design/Master-World-Beira-Terrain.md"

    BW(`Master-World-Beira.md`)가 세계압과 깊이를 공급했고, BT 는 그 압력이 대륙 규모로
    **무엇에 결속되는가**를 공급한다. 같은 세계(WORLD) 영역의 둘째 문서이며 인용 약칭을
    `BT` 로 새로 두었다 (graph 각 파일 머리말).

    **바뀐 것** — 세계를 나누는 축이 하나 늘었다.

        BW 의 축   깊이 — FRINGE · WILD · DANGER · DEEP · UNKNOWN (얼마나 깊은가)
        BT 의 축   법칙 — 여덟 대지형 (어떤 원리의 땅인가). 난이도 순이 아니다 (BT §16)

    둘이 어떻게 겹치는지는 어느 문서도 말하지 않는다 → Q47 (지어내지 않았다).

    산출물:
        constraints/    DRAFT 4종 — TERRAIN-IS-A-PRINCIPLE(§1 · §15) ·
                        SAFETY-IS-A-NATURAL-EXCEPTION(§3 · §13) ·
                        TERRAIN-LAW-IS-OBSERVABLE(§2 · §15.8 · §15.9) ·
                        TERRAIN-READS-AT-A-DISTANCE(§14). 승인 대기 → Q51.
                        승인 전이라 어느 노드에도 배선하지 않았다
        graph/          MW 9종 — MACRO-TERRAIN 하나와 그 아래 TERRAIN-* 여덟.
                        arises_from 은 FREE 와 BOUND 둘이다 (BT §1 이 둘을 함께 든다) ·
                        MG 1종 — RESCUE-THE-TAKEN. 네 지형이 같은 행동을 각자 명명했다
                        (§6.6 · §7.7 · §8.7 · §11.7) ·
                        MC 9종 — 요구처가 전부 장소다 (demanded_by). 방법(Possibility)이
                        요구하는 것은 아직 없다 ·
                        MS-BEIRA-TERRAIN — 순서 없는 시스템 (segments 없음)
        기존 노드 8종    CHANGED — READ-ENVIRONMENT · OBSERVE · PREDICT · IDENTITY-ANCHOR ·
                        VERIFY-REALITY · FORCE-MOVEMENT · CRAFT-FROM-MATERIALS ·
                        TRANSFER-ITEM 에 지형을 요구처로 더하고 소속 하나를 얹었다.
                        semantic 은 한 글자도 고치지 않았다 — 같은 의미를 새 이름으로
                        복제하지 않는다 (DC-GROWTH-NO-CAPABILITY-DUPLICATION)
        overlay.md      표 둘이 늘었다 — 대지형 Capability 9줄과 지형별 demands 8줄.
                        **판정은 하나도 바뀌지 않았다** (전부 MISSING/ABSENT).
                        "가장 큰 구멍" 이 셋에서 넷이 되었다: 넷째가 **땅이 없다**이며,
                        앞의 셋(자원 · 성장 · 앞날)이 놓일 바닥이다
        open-questions  Q47~Q51 신설 (관계 셋 · 주입 범위 하나 · DC 승인 하나)

    **잠정으로 둔 것** — MC 아홉 중 셋(TIME-THE-CYCLE · FIND-SAFE-ROUTE ·
    ANCHOR-LOCAL-LAW)은 `part_of.grounded: false` 다. BT 가 그 일을 지형마다 다른 이름의
    행동·자원으로만 적고 하나의 이름을 주지 않아, 묶은 문안이 Agent 의 번역이기 때문이다.
    나머지 여섯은 문서 문장이 그대로 정의한다.

    옮기지 않은 것과 사유:
        자원 24종 · 세력 37종 — 노드로 세우지 않았다. 자원 노드는 `grants` 로 기존 MC-*
        를 가리켜야 하고 세력 노드는 관점과 원하는 것을 가져야 하는데, BT 는 둘 다
        공급하지 않는다. 자원 쪽은 승인 대기 문서(Design-Resource-Catalog-R0)와 자리가
        겹치기도 한다 → Q50
        §11.5 회귀밀 — 새 Capability 가 아니다. 주는 의미가 BW §8 회귀초와 같아
        MC-RESTORE-BIOLOGICAL-STATE 를 재사용했다. 두 문서가 같은 능력을 서로 다른
        지형에서 낳는다는 사실은 → Q49
        §12 지형 간 연결 — 새 DC 도 새 노드도 만들지 않았다.
        DC-WORLD-PROGRESSION-IS-REACH 와 MP-ADAPT-BY-RESOURCE 가 이미 소유한 형태다
        각 지형의 Local Goal — RESCUE-THE-TAKEN 하나를 뺀 나머지는 세우지 않았다.
        BT 의 "주요 경험" 은 무엇을 하게 되는가이지 누가 무엇을 왜 원하는가가 아니다
        (§27 기관 대안과 같은 자리 — WHY 확장 몫)
        수치 — 없음 (BT 는 수치를 두지 않는 문서다 · 정책 §7.2)

    Frontier 후보는 세우지 않았다. 세계에 땅이 없어 아홉 노드 전부가 같은 하나에 막혀
    있고, 그 하나를 여는 Cycle 의 모양은 Q47 · Q48 이 답해져야 정해진다.

# 대지형(BT) 주입이 낸 다섯 — 2026-08-26 Human 결정

    다섯이 한 번에 닫혔다. 아래는 open-questions.md 에 있던 원문이며 `DECISION` 줄만
    채워 옮겼다. 반영 결과는 각 항 뒤의 "반영" 절에 적는다.

## Q47. 대지형(BT)과 깊이 층(BW §19)은 어떤 관계인가 — CLOSED

    무엇          BT 주입으로 세계를 나누는 축이 둘이 되었다. BW 는 깊이로 나눈다 —
                  FRINGE · WILD · DANGER · DEEP · UNKNOWN 순으로 굳지 않은 세계압이
                  높아지는 기울기다 (BW §19, MW-DEPTH-GRADIENT). BT 는 법칙으로 나눈다 —
                  여덟 대지형은 각각 다른 매질에 결속된 다른 원리이며, 난이도 순으로
                  배치된 목록이 **아니다** (BT §16).

                  두 축이 같은 세계를 두 번 나누고 있는데, 그 둘이 어떻게 겹치는지는
                  어느 문서도 말하지 않는다.

    지금 상태     Graph 에는 둘이 나란히 서 있고 서로를 가리키지 않는다.
                  MW-ZONE-* 5종은 MW-DEPTH-GRADIENT 아래에, MW-TERRAIN-* 8종은
                  MW-MACRO-TERRAIN 아래에 있다. 시스템 레지스트리도 둘이다
                  (MS-BEIRA-LADDER · MS-BEIRA-TERRAIN).

    영향          땅이 세계에 들어오는 첫 Cycle 이 무엇을 만들지가 이 답에 달렸다.
                  한 지역을 만들 때 그것이 "FRINGE 의 한 자리" 인지 "어느 대지형의
                  얕은 곳" 인지가 정해져야 그 지역이 무엇을 요구할지 (demands) 고를 수 있다.
                  지금 그 요구 목록이 두 벌(층 22 항 · 지형 25 항)이고 겹치는 것이 여덟이다.

    선택지        (a) **직교한다** — 대지형은 어떤 법칙의 땅인가이고, 깊이는 그 땅 안에서
                      얼마나 들어갔는가다. 한 대지형 안에 얕은 곳과 심부가 함께 있다.
                      → BT §3 이 이것을 거의 그대로 적는다: "하나의 대지형 안에도 안전한
                        마을과 극단적으로 위험한 심부가 함께 존재한다." 그러면 층의
                        demands 는 깊이가 요구하는 것이고 지형의 demands 는 법칙이
                        요구하는 것이며, 한 지역은 둘을 함께 요구한다.
                      → 값이 가장 싸다 — 지금 선 노드를 하나도 지우지 않는다.
                  (b) **대지형이 층을 대체한다** — BT §16 이 난이도 순 배치를 부정했으니
                      FRINGE~UNKNOWN 사다리를 접는다.
                      → MW-ZONE-* 5종과 MS-BEIRA-LADDER 가 사라지고, 그 demands 22 항의
                        요구처를 지형으로 옮겨야 한다. BW §21~§25 가 공급한 층별 생태
                        서술도 갈 곳을 잃는다. 되돌리기 어렵다.
                  (c) **층이 지형마다 따로 있다** — 같은 이름의 층이 지형마다 다른 것을
                      요구한다 (빙원의 DEEP 과 수해의 DEEP 이 다르다).
                      → 가장 세밀하지만 노드 수가 곱으로 는다. 지금 여덟 × 다섯이다.

    Agent 판단     (a) 를 권한다. 근거는 BT §3 의 문장 하나와, 그것을 골랐을 때 지워야
                  하는 것이 없다는 사실이다. 다만 (a) 를 고르면 "이 지역은 어느 지형의
                  어느 깊이인가" 가 지역 노드의 필수 항이 되므로, 그 형태는 첫 지역
                  Cycle 의 03-world-semantic.md 가 정한다 (정책 §7.2).

    DECISION      (a) 직교한다 (Human)

## Q48. 백왕의 갈비분지는 MW-SAFE-FRONTIER 인가 — CLOSED

    무엇          플레이어가 출발하는 곳이 어디인가. BW §14 의 문명권은 **굳지 않은
                  세계압이 적어서** 예측 가능한 땅이고 (MW-SAFE-FRONTIER), BT §4 의
                  갈비분지는 **세계압이 높은데 백왕의 뼈가 그것을 흡수해서** 안정된
                  땅이다. 둘 다 안전하지만 안전한 **이유**가 반대에 가깝다.

    이미 정해진 것 두 노드는 지금 따로 서 있고, 갈비분지의 causes 는 MW-SAFE-FRONTIER 와
                  같은 Goal(MG-EXPLORE-BEIRA)을 가리킨다 — 같은 목적을 두 곳이 낳는
                  것으로 두었지 새 Goal 을 만들지 않았다.

    영향          "안전한 곳에서 출발해 위험한 곳으로 들어간다" 의 출발선이 어디인가.
                  MP-PREPARE-IN-CIVILIZATION(문명권에서 준비해 간다)이 어디서
                  성립하는지도 함께 정해진다 — 분지에서 원정을 꾸리는 것(BT §4.6)이
                  그 갈래인지, 그 앞에 다른 문명권이 있는지.

    선택지        (a) **둘 다 있다** — 문명권은 베이라 **밖**의 안정된 인간 세계이고,
                      분지는 베이라 **안**의 자연적 안전지대다. 준비 갈래는 두 곳
                      모두에서 성립하되 파는 것이 다르다 (밖은 평범한 것, 안은 베이라의 것).
                      → BT §4 이 분지를 "인간이 베이라에서 확보한" 안전지대라고 적고,
                        BT §13 이 그것을 여덟 지형 각각의 자연적 피난처 중 하나로 둔다.
                  (b) **분지가 문명권 자리를 대신한다** — MW-SAFE-FRONTIER 의 demands 와
                      causes 를 분지로 옮기고 노드를 하나로 합친다.
                      → 세계가 단순해지지만 BW §13~§14 의 "문명은 안정된 세계의 결과다"
                        라는 인과가 갈 곳을 잃는다. 분지의 안정은 문명이 만든 것이 아니라
                        유해가 허용한 것이므로 같은 문장이 성립하지 않는다.
                  (c) 지금 정하지 않는다 — 첫 지역 Cycle 이 그 자리에서 정한다.

    Agent 판단     (a) 를 권한다. 안전의 사유가 다른 두 곳을 하나로 합치면
                  DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION(DRAFT)이 요구하는 "그 자리가
                  안전한 자연적 사유" 가 하나로 뭉개진다. 다만 이것은 세계의 출발선을
                  정하는 일이므로 Human 이 정할 일이다.

    DECISION      (a) 둘 다 있다 (Human)

## Q49. 대표 지역 둘(MW-HYPER-PREDATION · MW-SPATIAL-SHEAR)은 여덟 대지형과 무엇인가 — CLOSED

    무엇          BW §8 · §10 이 세운 대표 지역 둘이 있다 — 포식 경쟁이 극단이라 회귀초가
                  태어난 곳과, 공간이 어긋나 경계결정만 살아남은 곳. BT 는 여덟 대지형을
                  세우면서 그 둘을 언급하지 않는다. 그래서 지금 Graph 에는 세계의 땅이
                  세 무리로 서 있다: 깊이 층 다섯 · 대표 지역 둘 · 대지형 여덟.

    겹침의 증거    BT §11.5 의 **회귀밀**은 "대상을 최근의 안정된 생체 상태로 되돌린다" 이며,
                  BW §8 의 **회귀초**와 같은 의미다 (MC-RESTORE-BIOLOGICAL-STATE).
                  능력 노드를 복제하지는 않았다 (DC-GROWTH-NO-CAPABILITY-DUPLICATION) —
                  같은 능력에 획득 경로가 둘인 것은 정상이기 때문이다. 그러나 **같은
                  능력을 낳는 땅이 두 문서에 따로 있다**는 사실은 그대로 남는다.

    영향          자원 유래를 추적할 때 어느 땅을 가리킬 것인가 (DC-WORLD-RESOURCE-ADAPTATION-TRACE).
                  그리고 Q47 의 답이 (a) 라면 대표 지역 둘도 "어느 대지형의 어느 자리" 를
                  가져야 한다.

    선택지        (a) **대표 지역 둘은 대지형 안의 국지 사정이다** — 어느 대지형의 한
                      자리이며, 어느 지형인지는 아직 정해지지 않았다.
                      → BW §19 가 이미 "지역마다 국지적인 사정이 다르다" 를 인정한다.
                        노드를 지우지 않고 arises_from 만 다시 잡으면 된다.
                  (b) **아홉째·열째 대지형이다** — 같은 격으로 올린다.
                      → BT §15 의 열 항에 답할 수 있어야 하는데 BW 는 그중 매질과 원리
                        정도만 공급한다. 나머지는 지어내야 한다.
                  (c) **그대로 둔다** — 두 문서가 세운 것을 각자 두고, 겹치는지는 그 땅이
                      실제로 세계에 들어올 때 판단한다.
                      → 지금 아무것도 하지 않는 선택이며, 판단을 미루는 값은 낮다.

    Agent 판단     (a) 와 (c) 중에서는 (c) 를 권한다. (a) 로 옮기려면 "어느 지형인가" 를
                  지금 골라야 하는데 그 근거를 두 문서 어디도 공급하지 않는다.
                  Q47 이 (a) 로 닫히면 그때 이 질문은 배선 하나로 줄어든다.

    DECISION      (c) 그대로 둔다 (Human)

## Q50. BT 의 자원 24종·세력 37종을 언제 노드로 세울 것인가 — CLOSED

    무엇          BT 는 지형마다 자연 자원 셋과 세력 넷 남짓을 든다 — 왕골 · 태양심 ·
                  이름목 · 숨결진주 · 방향석 · 맥동정 · 가능유리 · 회귀밀 …, 그리고
                  갈비성 연맹 · 해숨 부족 · 가면촌 · 숨지기 · 길청자 · 미궁상인 ….
                  이번 주입은 그중 **하나도** 노드로 세우지 않았다.

    왜 세우지 않았나  자원 노드(IT-* / IP-*)는 `grants` 로 **이미 있는** MC-* 를 가리켜야
                  하고, 세력 노드(MA-*)는 관점과 원하는 것을 가져야 한다. BT 는 둘 다
                  공급하지 않는다 — 자원은 무엇을 하는지까지만 적고 어느 능력을 여는지
                  말하지 않으며, 세력은 무엇을 하는 무리인지 한 줄로만 적는다.
                  지어내면 주입이 아니라 창작이 된다 (guides/master-inject.md).

    지금 상태     각 MW-TERRAIN-* 의 detail 이 그 땅이 낳은 것의 이름을 담고 있어, 자리가
                  비어 있다는 사실이 Graph 에서 보인다. 자원 카탈로그 쪽에는 이미
                  승인 대기 문서가 하나 있다 — `content/proto-adventure/design/Design-Resource-Catalog-R0.md`
                  (Q36 과 묶여 있다).

    선택지        (a) **지금 세우지 않는다 (현행 유지)** — 자원은 승인 대기 중인 카탈로그
                      문서의 주입이, 세력은 그 지형의 WHY 확장이 받는다.
                      → 같은 자리를 두 곳에서 만들지 않는다. 대신 BT §12 의 연결
                        (자원이 다음 지형을 연다)이 Graph 에서는 아직 문장으로만 남는다.
                  (b) **자원만 먼저 세운다** — origin_trace 의 world_state 를 이제 지형
                      노드가 공급할 수 있으므로 `grants` 를 비우고 `grants_note` 에 사유를
                      적어 세운다 (SCHEMA 가 허용하는 형태다 — 능력을 열지 않는 자원은 정상이다).
                      → 24 종이 한 번에 들어오고, 카탈로그 문서가 승인되면 둘을 합쳐야 한다.
                  (c) **세력까지 세운다** — 관점을 잠정으로 적고 `grounded` 에 해당하는
                      표시를 남긴다.
                      → Actor 노드에는 그런 표시 자리가 없다. 만들려면 SCHEMA 를 먼저 고친다.

    Agent 판단     (a) 를 권한다. 근거는 겹침이다 — 자원 카탈로그 문서가 이미 Human 승인을
                  기다리고 있고, 그것이 승인되면 같은 자리를 두 번 만든 것이 된다.

    DECISION      (a) 지금 세우지 않는다 (Human)

## Q51. 대지형 Constraint 넷(DRAFT)을 승인할 것인가 — CLOSED

    무엇          BT 주입이 DRAFT 로 낸 넷이다. 넷 다 BT 가 절을 따로 두어 명시한 규칙이며,
                  Agent 는 원본보다 세게 쓰지 않았다.

                  DC-WORLD-TERRAIN-IS-A-PRINCIPLE          BT §1 · §15.1~§15.3 · §16
                  DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION   BT §3 · §13
                  DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE       BT §2 · §15.8 · §15.9
                  DC-WORLD-TERRAIN-READS-AT-A-DISTANCE     BT §14

    지금 상태     넷 다 `status: DRAFT` 이고 **어느 노드에도 걸려 있지 않다**
                  (`constraints:` 배선 0). 승인 전에 배선하면 판정이 아직 없는 원칙이
                  Filter 로 도는 셈이 되기 때문이다. 승인되면 대지형 Capability 아홉과
                  MW-TERRAIN-* 여덟에 배선하고 판정을 채운다.

    옆에서 이미 하는 일  BT §12(자원이 다음 지형을 연다)는 새 DC 로 만들지 않았다 —
                  DC-WORLD-PROGRESSION-IS-REACH 의 `resource_can_open_capability_route`
                  가 이미 같은 것을 요구한다. §11(자원의 유래)도 마찬가지로
                  DC-WORLD-RESOURCE-ADAPTATION-TRACE 가 소유한다. 같은 의미를 새 이름으로
                  만들지 않았다는 뜻이다.

    선택지        (a) 넷 다 승인한다 → 세계 영역 Constraint 가 5 에서 9 가 된다.
                  (b) 일부만 승인한다 → 어느 것을 왜 뺐는지가 그 자리에 남는다.
                      가장 다툴 만한 것은 READS-AT-A-DISTANCE 다 — 넷 중 유일하게
                      보이는 형태를 요구하며, 시각 설계에 가장 가깝다.
                  (c) 반려한다 → 그 원칙들은 constraints/ 에서 지운다. 보류하지 않는다
                      (guides/master-constraint.md).

    DECISION      넷 다 승인 (Human)

## 다섯의 반영 — 무엇이 어디에 들어갔나

    Q47(a) 직교      systems.yaml   MS-BEIRA-TERRAIN · MS-BEIRA-LADDER 양쪽 semantic 에
                                    직교를 명시 (서로를 가리킨다)
                     world-state    머리말 인과도 · 대지형 절 주석 · MW-MACRO-TERRAIN 의
                                    world_shape · MW-DEPTH-GRADIENT 의 detail
                     overlay.md     대지형 Capability 절 intro — 땅이 들어오는 Cycle 은
                                    두 표(층 · 지형)의 요구를 함께 본다
                     남긴 것         "한 지역이 둘을 어떻게 적는가" 의 형태는 그 Cycle 의
                                    03-world-semantic.md 소유다 (정책 §7.2). 지금 정하지 않는다

    Q48(a) 둘 다     world-state    MW-SAFE-FRONTIER 에 "베이라 밖" · 갈비분지에 "베이라 안"
                                    과 안전 사유의 차이를 명시
                     possibilities  MP-PREPARE-IN-CIVILIZATION 의 requires 는 그대로 두었다 —
                                    AND 이므로 두 곳을 함께 적으면 둘 다 요구가 된다.
                                    주석으로 "어느 한 곳이 서면 성립" 을 남겼다

    Q49(c) 그대로    world-state    대표 지역 둘의 절 주석에 결정과 사유를 적었다.
                                    노드는 하나도 옮기지 않았다 (arises_from 그대로)

    Q50(a) 안 세움   capabilities   비주입 절을 "질문이 들고 있다" 에서 "Human 이 확정했다"
                                    로 바꿨다 — 자원은 카탈로그 문서 주입이, 세력은 그
                                    지형의 WHY 확장이 받는다

    Q51 승인         constraints/   DC-WORLD-TERRAIN-* 4종 DRAFT → APPROVED
                     capabilities   대지형 MC 9종에 배선 + 판정 (전부 SATISFIED).
                                    LAW-IS-OBSERVABLE 6건 · SAFETY-IS-A-NATURAL-EXCEPTION 4건
                                    (MC-FIND-SAFE-ROUTE 는 둘 다)

    **넷 중 둘은 걸린 노드가 0 이다** — TERRAIN-IS-A-PRINCIPLE 과 READS-AT-A-DISTANCE 다.
    그 둘은 Capability 가 아니라 **땅 자체의 형태**를 규율하는데, SCHEMA 의 world_state 에는
    `constraints` 칸이 없다 (Capability · Goal · Possibility 에만 있다). 없는 칸을 이번에
    만들지 않았다 — 형식을 바꾸는 일은 주입의 몫이 아니기 때문이다. 그 둘이 실제로
    판정되는 자리는 새 대지형을 세우는 작업(주입 · WHY 확장)과 그 땅을 만드는 Cycle 이며,
    걸린 노드 0 은 도구가 문제로 올리지 않는다 (GLOBAL Scope DC 들과 같은 자리).
    world_state 에 그 칸을 둘 것인가는 필요해질 때 Human 이 정한다.

    **이 다섯이 닫히면서 막힌 것이 하나 풀렸다** — 땅을 세우는 첫 Cycle 의 모양이
    정해질 수 있게 되었다. Frontier 후보는 아직 세우지 않았다 (NEXT 작업).

## TERRAIN 첫 후보 선택 — Human 위임 · 2026-08-26

    Human 지시: "LANE에만 반영하고 다음 세션에서 이어할수 있도록 마무리. 병렬로 진행
    가능한지 확인. 그리고 후보는 알아서 정할 것."

    Frontier 선택은 Human 소유다 (CLAUDE.md 원칙 19). 이번에는 Human 이 그 선택을
    Agent 에게 **명시적으로 위임**했으므로 Agent 가 골랐고, 위임의 사실을 여기 남긴다 —
    원칙이 면제된 것이 아니라 그 자리에서 Human 이 답을 준 것이다.

    고른 것      FR-THE-GROUND-HAS-A-LAW (땅이 법칙을 지닌다) → C-TERRAIN-001
    근거         대지형 Capability 아홉의 overlay_gap 이 서로 다른 문장으로 같은 하나를
                 가리킨다 — 땅이 없다. 나머지 둘은 이것 없이 성립하지 않는다:
                 예고(FR-THE-LAND-SHOWS-BEFORE-IT-TAKES)는 "아무 일도 일어나지 않는 것의
                 예고" 가 되고, 나르기(FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED)는 나를 이유가
                 없다. 셋 중 유일하게 **다른 레인과 파일이 겹치지 않는다**는 점도 함께 봤다
    고르지 않은 것 예고는 값이 싸지만 순서가 뒤다. 나르기는 셋 중 가장 크고 아이템 쪽
                 파일에 닿아, 같은 시기에 ITEM 레인이 열리면 겹친다

    Cycle 은 아직 시작하지 않았다 — 판(LANES.md)과 트랙 파일에만 반영했고, 다음 세션이
    `advprotoh-cycle` 로 Stage 1 부터 잡는다. 넘어갈 MASTER TRACE 는 frontier/terrain.md
    의 SELECTED 절이 그대로 들고 있다.

## 주입 — 요정 캐릭터 성장 시스템(GS) · 2026-08-26

    Human 지시: "LANES.md 참고하여 이 기획에 대한 master 주입을 진행한다.
    content/proto-adventure/design/Master-Fairy-Growth-System.md"

    BW 가 세계를, BT 가 그 세계의 땅을 공급했다면 GS 는 **그 땅의 원리가 하나의 인격에
    집중되면 무엇이 되는가**를 공급한다 (GS §1). 인용 약칭을 `GS` 로 새로 두었다
    (성장 영역 — 기존 GR 은 공정 원본이라 자리가 다르다).

    **바뀐 것** — overlay 의 둘째 구멍("성장이 세계 밖에 있다")에 처음으로 이름이 붙었다.
    지금까지 능력치를 바꾸는 유일한 경로는 디버그 명령이었고, 그것이 결손인 줄은 알았지만
    무엇이 그 자리에 들어와야 하는지는 어느 문서도 말하지 않았다. GS §5 · §19 가 그 축을
    다섯으로 명명한다 — Level · Class Mastery · Skill Mastery · Exploration Mastery ·
    Equipment. 다섯 중 **장비 하나는 이미 서 있다** (MC-EQUIP-ITEM — C023 · C024).

    산출물:
        constraints/    DRAFT 8종 — PRINCIPLE-IS-PLAYED(§1 · §2 · §21) ·
                        CLASS-CHANGE-KEEPS-THE-PAST(§3.1) · CLASS-CHANGE-NEEDS-THE-WORLD(§6) ·
                        MASTERY-FROM-OWN-BEHAVIOR(§5) · EXPLORATION-SHARES-THE-PRINCIPLE(§8) ·
                        DIFFERENCE-IS-BEHAVIOR(§17) · SKILL-GAINS-BEHAVIOR(§18) ·
                        STAGE-READS-AT-A-DISTANCE(§7). 승인 대기 → Q52.
                        BT 선례대로 승인 전에는 어느 노드에도 배선하지 않았다
        graph/          MC 5종 — GAIN-LEVEL · GROW-CLASS-MASTERY · MASTER-A-SKILL ·
                        GROW-EXPLORATION-MASTERY · CHANGE-CLASS. 요구처가 전부 방법이다
                        (required_by) — 장소가 요구하는 것은 없다 ·
                        MP 1종 — BECOME-A-HIGHER-FORM. MG-EXPLORE-BEIRA 의 **넷째 갈래**이며
                        앞의 셋과 달리 바깥에서 구해 오지 않고 몸 자체가 상위 형태가 된다 ·
                        MK 1종 — WITNESSED-WORLD-PHENOMENON. Class Change 의 네 문턱 중
                        **살 수 없는 유일한 것**이다 (GS §6) ·
                        MS 3종 — CLASS-EVOLUTION(층 넷) · GROWTH-SOURCE(축 다섯) ·
                        FAIRY-LINEAGE(계열 여덟 — 대지형 여덟의 거울, 순서 없음)
        기존 노드 2종    CHANGED — MC-EQUIP-ITEM 에 MS-GROWTH-SOURCE/EQUIPMENT 소속을 더했다
                        (다섯째 축은 새 노드가 아니라 이미 선 그 노드다) ·
                        MP-OUTGROW-THE-OPPONENT 의 requires 에 MC-GAIN-LEVEL 을 더했다
                        ("자라는 축이 없다" 고 적어 두던 그 자리다)
        growth/         growth-graph.md 에 "성장의 원천" 표가 생겼다 — 일곱 줄 중 하나만
                        세계에 서 있다. CL-* 는 **하나도 세우지 않았다** (Q55)
        open-questions  Q52(승인) · Q53(레벨 ↔ 도달) · Q54(요정은 플레이어인가) ·
                        Q55(Class Line 이름 충돌 — 차단)

    **세우지 않은 것 셋** (지어내지 않았다):

        계열별 능력 목록 (§9~§16)   문서 자신이 "예시" 라고 밝히고, 그것을 요구하는
                                    Possibility 를 공급하지 않는다. 게다가 여덟 계열의
                                    능력 대부분은 그 계열이 딛고 선 땅이 이미 요구하고
                                    있다 (BT 주입의 MC 아홉) — 계열 이름으로 복제하지
                                    않는다 (DC-GROWTH-NO-CAPABILITY-DUPLICATION)
        CL-* (Class 정의)           Class Line 의 이름이 문서마다 다르다 → Q55.
                                    이름이 곧 정체라 나중에 고치면 origin_trace 와
                                    grants 가 통째로 흔들린다
        Class Catalyst 의 자원      GS 는 "세계의 Property" 라고만 적고 어느 자원인지
                                    명명하지 않는다 (태양심은 예시다) — 자원의 이름과
                                    유래는 카탈로그 문서가 소유한다 (Q50(a) 선례)

    **부딪힌 것 둘** — 임의로 풀지 않고 노출했다. 레벨 축과 "진행은 도달"(Q53),
    고정된 캐릭터 판타지와 "역할을 고정하지 않는다"(Q54). 둘 다 해당 노드의 판정을
    UNRESOLVED 로 남겼다 — SATISFIED 로 덮지 않았다.
