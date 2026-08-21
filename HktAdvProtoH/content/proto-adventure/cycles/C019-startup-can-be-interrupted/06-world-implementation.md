# C019 — World Implementation

## IMPLEMENTED

    SkillDefinition.SwingBegin · SwingEnd        world/semantic/combat.ts
        기술이 자기 구간 경계를 지닌다. 기본값 상수 둘(DEFAULT_SWING_BEGIN 0.25 ·
        DEFAULT_SWING_END 0.75)은 지금까지 세계가 쓰던 값 그대로이며, 기본 기술과
        오라 기술이 그 값을 쓴다 — 두 기술은 한 톨도 바뀌지 않았다.
        큰 기술만 0.50 · 0.85 다 (03 BALANCE ①).

    RULE-SKILL-PHASE-001                        world/semantic/combat.ts (skillPhase)
        파생 판정이므로 상태를 바꾸지 않는다 — actionCollider 와 같은 자리에 둔다.
        경계를 기술에서 읽고, ActionCollider 도 같은 값을 읽는다:
        "칼끝이 활성인 구간" 과 "phase 가 active" 가 언제나 일치한다.

    RULE-SKILL-CANCEL-001                       world/rules/attack.ts
        선딜 중 피격이면 그 기술을 hit 으로 대체하고 World.CancelEvents 에 남긴다.
        기력을 되돌리는 코드가 없다 — RULE-SKILL-BUDGET-001 이 첫 타격에서만
        정산하므로 나가지 못한 기술은 애초에 정산된 적이 없다 (03 의 판단 그대로).

    World.CancelEvents                          world/semantic/combat.ts · world-state.ts
        CancelEvent { attackerId · targetId · skill · position · time }.
        StrikeEvent · UnharmedContact 와 나란한 자리다.

## REUSED

    Actor.CurrentAction · ActionProgress        C002 — 구간 판정이 이 위에 선다
    ActionCollider                              C006 — 기하는 그대로, 경계만 기술에서 읽는다
    RULE-HARM-GATE-001                          C018 — 캔슬은 이 관문 뒤에서만 불린다
    RULE-SKILL-BUDGET-001                       C007 — 손대지 않았다. 캔슬의 대가가 여기서 나온다
    RULE-STRIKE-DAMAGE-001 · 피해 공식 일체       C007 · C010 — 한 글자도 닿지 않았다
    STRIKE_EVENT_TTL                            C007 — 캔슬도 같은 수명을 쓴다

## AFFECTED UPDATED

    RULE-HIT-001 (CHANGED)                      world/rules/attack.ts
        시그니처가 `ruleHit(state, target, attacker)` 로 바뀌고 HitOutcome 을 돌려준다.
        세 갈래: cancelled(선딜) · uninterrupted(판정·후딜) · struck(기술이 아닌 행동).
        부르는 곳은 한 곳뿐이다 (RULE-SWING-STRIKE-001).

    RULE-SWING-STRIKE-001 (AFFECTED)            world/simulation/swing-strike.ts
        ruleHit 에 state 와 attacker 를 넘기는 것 외에는 문장이 바뀌지 않았다.
        맞은 사실 · 밀려남 · 피해 · 기력 수지는 결과와 무관하게 그대로 일어난다.

    RULE-NPC-DECIDE-001 (CHANGED)               world/simulation/npc-decide.ts
        Cp >= 큰 기술 비용이면 heavy-attack, 아니면 attack.
        같은 행동 비교(isSameAction)를 **고른 뒤로** 옮겼다 — 먼저 비교하면
        "이미 attack 중" 이라는 이유로 큰 기술로 갈아탈 기회를 잃는다.

    RULE-STRIKE-EVENT-EXPIRE-001 (CHANGED)      world/simulation/strike-event-expire.ts
        캔슬도 같은 수명으로 사라진다. 수명 규칙을 셋으로 나누지 않았다.

    collision.ts 의 전역 상수 (CHANGED)          world/semantic/collision.ts
        SWING_BEGIN · SWING_END 를 제거하고 기술에서 읽는다. 값 자체는 그대로이므로
        기본·오라 기술의 접촉 시점은 한 프레임도 달라지지 않는다.

## PROJECTION

    Entity.actionPhase          기술 진행 중일 때만 실린다 (startup | active | recovery).
                                가려짐 목록(C014)에 더하지 않았다 — 언제나 실린다.
    GameViewSnapshot.cancels    World.CancelEvents 를 그대로 투영. strikes · contacts 와 나란하다.
    Skill.profile.swingBegin/End 세 기술 모두에 실린다 — 고르기 전에 선딜을 안다.

    protocol/gameview.ts 에 CancelEventView 를 더하고 EntityView · SkillProfileView 를
    넓혔다. View 코드는 이 Stage 에서 건드리지 않았다 (Stage 7 몫).

## TESTS

    world/tests/skill-phase.spec.ts             신규 21건 — 전부 통과

        RULE-SKILL-PHASE-001            5건  기술이 아니면 없음 · 기본/큰 기술의 경계 ·
                                             같은 진행도가 다른 구간 · 경계에 선 순간은
                                             이미 나간 것 · 선딜 0.15 ↔ 0.45초
        RULE-HIT-001 (CHANGED)          5건  선딜이면 캔슬 · 판정이면 진행도도 흔들리지 않음 ·
                                             후딜도 유지 · 기술 아니면 지금과 같음 ·
                                             **같은 개입이 시점만으로 갈린다**
        RULE-NPC-DECIDE-001             2건  모았다가 큰 기술을 건다 · 그 구간이 관찰된다
        관찰                            4건  기술 아니면 실리지 않음 · 세 구간이 다 읽힘 ·
                                             방해 없으면 완주 · profile 에 경계
        캔슬 관찰                       4건  캔슬이 실림 · 그 기술의 피해가 세계에 없음 ·
                                             끊은 타격은 성립한 타격 · 같은 수명

    전체 회귀                            849건 통과 (기존 828 + 신규 21)

    기존 테스트 손질 두 가지 — 둘 다 의미를 바꾸지 않는 정합 수정이다.
        ① SWING_BEGIN import 를 DEFAULT_SWING_BEGIN / 그 기술의 값으로 바꿨다.
           큰 기술을 쓰는 세 곳은 HEAVY.swingBegin 을 읽으므로 경계가 바뀌어도 따라간다.
        ② combat.spec 의 피격 배율 검증 둘이 "1.5초 뒤" 라는 고정 시각에 기대고 있었다.
           자율 존재가 큰 기술을 고르면 첫 타격 시각이 달라지므로 **맞을 때까지 굴리는**
           방식으로 바꿨다 — 검증하려는 것은 타이밍이 아니라 맞은 직후의 배율이다.

## NOTES

    ① 판정 구간 피격에는 충전 억제가 오지 않는다
       03 BALANCE ③ 의 판단대로 두었다. 코드로는 "hit 행동이 오지 않으므로
       HIT_CHARGE_FACTOR 원천이 걸리지 않는다" 이며, 새 타이머를 만들지 않았다.

    ② isSameAction 비교 위치를 옮긴 것이 유일한 구조 변경이다
       기존 코드는 사거리 안이면 곧바로 "이미 attack 중이면 유지" 로 빠졌다.
       그대로 두면 기력이 30 을 넘겨도 영원히 기본 기술만 나온다.

    ③ engine/ 은 한 줄도 건드리지 않았다
       구간·캔슬은 전부 팩의 의미다. 호 스윕 접촉은 여전히 engine/physics/sweep 이
       하고, 이 팩은 경계 값과 대상 선택과 접촉의 의미만 소유한다.

    ④ WORLD SEMANTIC GAP 없음
