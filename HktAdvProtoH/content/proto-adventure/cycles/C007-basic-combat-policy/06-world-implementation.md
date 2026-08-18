# C007 — World Implementation

## IMPLEMENTED
    Actor.Name · Hp/HpMax · Cp/CpMax · MoveMode · TempoStats 3종
                                          world/semantic/actor.ts
    SkillDefinition · COMBAT_PROFILES · 시뮬레이션 상수
                                          world/semantic/combat.ts
    Actor.Modifiers (파생)                world/semantic/combat.ts  actorModifiers()
    Actor.Downed (파생)                   world/semantic/combat.ts  isDowned()
    effectiveMoveSpeed · skillDuration    world/semantic/combat.ts
    MutableAttribute 목록 + Range (R2)    world/semantic/combat.ts
    ActionKind heavy-attack · downed      world/semantic/action.ts
    CurrentAction.budgetSettled           world/semantic/action.ts
    World.StrikeEvents · DebugAuthority   world/semantic/world-state.ts

    RULE-SKILL-BEGIN-001                  world/rules/skill.ts        ruleSkillBegin
    RULE-SKILL-BUDGET-001                 world/rules/skill.ts        ruleSkillBudget
    RULE-STRIKE-DAMAGE-001                world/rules/strike-damage.ts
    RULE-DOWNED-001                       world/rules/strike-damage.ts ruleDowned
    RULE-MOVE-MODE-001                    world/rules/move-mode.ts
    RULE-ATTRIBUTE-SET-001 (R2)           world/rules/attribute-set.ts
    RULE-CP-RUN-DRAIN-001                 world/simulation/cp-run-drain.ts
    RULE-STRIKE-EVENT-EXPIRE-001          world/simulation/strike-event-expire.ts

## REUSED
    RULE-ACTION-BEGIN-001                 world/rules/action-begin.ts (duration 인자만 더함)
    RULE-HIT-001                          world/rules/attack.ts
    ActionCollider · 접촉 판정             world/semantic/collision.ts · simulation/swing-strike.ts
    RULE-BODY-PUSH/MOMENTUM-001           world/simulation/body-*.ts (그대로)
    Observer Projection 골격               world/projection/observer-view.ts

## AFFECTED UPDATED
    RULE-SWING-STRIKE-001                 world/simulation/swing-strike.ts
                                          쓰러진 몸 제외 + 고정 피해 + 첫 타격 수지 정산
    RULE-MOVE-PROGRESS-001                world/simulation/move-progress.ts
                                          걸음 = effectiveMoveSpeed × dt
    RULE-NPC-DECIDE-001                   world/simulation/npc-decide.ts
                                          쓰러진 자는 결정하지 않고, 인지 대상도 되지 않는다.
                                          자율 존재는 기본 스킬만 쓴다
    RULE-WORLD-TICK-001                   world/simulation/world-tick.ts
                                          8. CP-RUN-DRAIN → 9. Time += dt → 10. EVENT-EXPIRE
    RULE-OBSERVER-JOIN-001                world/rules/observer-join.ts
                                          새 몸이 자기 종류의 자원·템포 능력치와 이름을 갖는다
    RULE-ATTACK-001 → RULE-SKILL-BEGIN-001 world/actions/dispatch.ts · rules/attack.ts
                                          attack.ts 에는 RULE-HIT-001 만 남았다
    createWorld                           world/index.ts
                                          자율 존재 프로필·이름, World.DebugAuthority 초기화

## PROJECTION
    entities[].name · vitality            world/projection/observer-view.ts
    entities[].attributes (R2 — 전 속성)  world/projection/observer-view.ts
    interactions attack · skill-heavy      가용성 + 사유 + profile(damage/charge/cost)
    interactions move-mode · set-attribute 가용성 + 사유
    hud.self.* 13항목                      hp · cp · downed · moveMode · tempo 3 · modifier 4
    snapshot.strikes                       World.StrikeEvents
    snapshot.debug                         open + mutableAttributes

## PROTOCOL
    ActionRequest.mode · attribute         protocol/actions.ts
    VitalityView · AttributesView          protocol/gameview.ts
    StrikeEventView · DebugAuthorityView   protocol/gameview.ts
    InteractionView.profile                protocol/gameview.ts
    RULE_* · INTENT_* 식별자 17종 추가      protocol/semantic-id.ts

## TESTS
    world/tests/combat.spec.ts            39 항목 — 전부 통과
        VITALITY          자원 초기값 · 이름
        STRIKE-DAMAGE     고정 피해 · 고급 > 기본 · 한 휘두름 한 번
        SKILL-BUDGET      기본 충전 / 허공 무수지 / 고급 순소모 / 다중 타격 1회 정산
        SKILL-COST-GATE   insufficient-cp 거절 + 관찰 · 기본 스킬은 무료 · profile 관찰
        DOWNED            쓰러짐 · 대상 제외 · 행동 정지
        RUN               달리기 가속 + 누수 · 정지 시 무누수 · 고갈 복귀 · 명시값 · 누수량
        MODIFIER-COMPOSE  원천 없음 1 · 달리기 · 피격 · 두 원천 곱
        TEMPO             공격 속도 단축 · 시작 시 확정 · 이동 속도 차이
        STRIKE-OBSERVE    결과 내용 · TTL 만료
        ATTRIBUTE-OBSERVE 남의 속성 전부 · hud.self
        ATTRIBUTE-MUTATE  목록/범위 · 변경 · 권한 닫힘 · 거절 3종 · 쓰러짐 유발/해제 · 최대치 clamp
        결정론            같은 입력 → 같은 세계

    기존 회귀                              250개 전부 통과 (기존 211 + 신규 39)
    world/tests/attack.spec.ts             RULE-ATTACK-001 → RULE-SKILL-BEGIN-001 식별자만 갱신

## NOTES
    - 기존 attack 행동 종류 이름을 바꾸지 않았다. 모션 집합·View 자산이 그대로 이어진다.
    - budgetSettled 를 CurrentAction 에 둔 이유: 행동과 함께 사라져야 하는 값이기 때문이다
      (StruckActorIds 와 같은 성격).
    - Modifiers 는 저장하지 않는다. 매번 유도하므로 원천이 늘어도 저장 구조가 바뀌지 않는다.
    - 세계 난수원은 없다 (R1). Math.random 은 여전히 world/ 에 한 줄도 없다.
    - 검증 중 확인된 상호작용: 맞은 몸은 밀려나므로(C006) 한자리에서 연달아 때리기 어렵다.
      의도된 결과이며, 테스트는 이를 우회하지 않고 그대로 반영해 작성했다.

## GAP
    없음.

## DEVIATION
    Actor.Name 을 "관찰자가 밝힌 식별" 이 아니라 세계 순번(`Player 1`)으로 정했다.
    C004 RULE-OBSERVER-JOIN-001 이 "세계 밖에서 온 문자열을 세계 안 존재의 이름으로
    쓰지 않는다" 를 이미 확정해 두었기 때문이다. 03-world-semantic.md 를 R2 정정했다.
