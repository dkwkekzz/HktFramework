# C025 — World Implementation

## 한 줄

    **`world/` 에서 바뀐 파일이 0 개다.**

    03 이 `ADDED 없음 · CHANGED 없음` 으로 판정했고, 04 가 `change: NONE` 으로 판정했다.
    그 판정이 맞다면 이 Stage 는 **아무것도 하지 않는 것이 옳은 수행**이다.

## IMPLEMENTED

    없음 — 새 State 도 새 Rule 도 새 투영도 만들지 않았다.

    04 의 `gap.status: 없음` 이 근거이며, Stage 7 이 화면을 세우는 동안 계약에 없는
    값이 필요해진 적이 **한 번도 없다.** 그러므로 `GAMEVIEW GAP` 으로 04 로 돌아갈 일도,
    `WORLD SEMANTIC GAP` 으로 03 으로 돌아갈 일도 생기지 않았다.

## REUSED

    기술 관문 판정             `world/rules/skill.ts` — `evaluateSkillPreconditions`
    기술 시작 · 기력 수지        `world/rules/skill.ts` — RULE-SKILL-BEGIN-001 · RULE-SKILL-BUDGET-001
    기술 카탈로그              `world/semantic/combat.ts` — `SKILL_DEFINITIONS`
    기술 피해 파생             `world/semantic/combat.ts` — `rawDamage`
    기술 구간 경계             `world/semantic/combat.ts` — `swingBegin` · `swingEnd`
    기술 투영                  `world/projection/observer-view.ts` — available · reason · profile
    요청 대답 규칙             `engine/world-kernel/request-reply.ts` — RULE-REQUEST-REPLY-001
    요청 표식                  `protocol/actions.ts` — `ActionRequest.mark`

## AFFECTED UPDATED

    없음 — 판정이 바뀌지 않았으므로 함께 발전시킬 기존 Rule 도 없다.

## PROJECTION

    변경 없음. 기술 셋을 손으로 싣는 지금의 형태를 그대로 둔다
    (05 가 채택한 03 JUDGEMENT ② — 기술이 넷이 되는 날의 부채로 남긴다).

    04 가 계약 문장으로 못박은 `skill.identification`("`profile` 이 실린 interaction 이
    기술이다")은 **투영을 고치지 않고도 이미 참이다.** `profile` 은 기술 셋에만 실리고
    그 밖의 어떤 interaction 에도 실리지 않는다 — 이 Stage 가 한 일은 그것을 확인한 것이다.

## TESTS

    새로 쓴 세계 테스트 없음.

    이 Cycle 은 세계의 행동을 하나도 바꾸지 않으므로 **기존 세계 테스트의 기대값이
    한 줄도 달라지지 않는 것**이 이 Stage 의 검증이다. 그 확인은 08 이 실측으로 소유한다.

## NOTES

    ### 이 Stage 가 실제로 한 일

    04 의 판정을 **반증하려 시도한 것**이다. Stage 7 이 화면을 세우는 내내
    "계약에 없는 값이 필요한가" 를 물었고, 답은 매번 아니오였다.

        무엇을 그릴 것인가          `interactions[].profile` 이 실린 항목 전부
        지금 되는가                 `interactions[].available`
        안 되면 왜인가              `interactions[].reason`
        얼마를 치르고 무엇을 내는가   `interactions[].profile` 의 일곱 값
        내 요청이 어떻게 되었나       `RequestOutcomeView` — 이미 관찰자에게 오고 있었다

    다섯 모두 이미 와 있었다. 이 Cycle 이 연 것은 **도착하는 자리**뿐이다.

    ### 세계에 넣지 않은 것

    Stage 7 에서 세 가지를 세계에 넣고 싶은 순간이 있었고 셋 다 넣지 않았다.

        걸어 둔 요청(pending)      03 WORLD STATE 가 이미 금한 것이다 — 세계는 누가 무엇을
                                 걸었는지 기억하지 않는다. 관찰자가 자기 표식으로 안다

        "이것이 기술이다" 라는 칸    03 JUDGEMENT ① 이 기각한 것이다 — `profile` 로 이미 갈린다.
                                 계약에 칸을 더하지 않았다

        받아들여짐이 얼마나 머무는가  화면의 시간이지 세계의 시간이 아니다.
                                 시계를 쥔 조립 루트가 정한다 (07 NOTES)
