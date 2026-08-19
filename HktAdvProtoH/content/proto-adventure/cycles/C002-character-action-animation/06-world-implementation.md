# CYCLE C002 — World Implementation

## IMPLEMENTED
    ActionKind · CurrentAction · ActionDefinition   world/semantic/action.ts
    Actor.Id / CharacterKind / Control              world/semantic/actor.ts
    Actor.AttackRange / PerceptionRange             world/semantic/actor.ts
    Actor.WanderPath / WanderIndex                  world/semantic/actor.ts
    World.Actors (Actor 하나 → 여럿)                world/semantic/world-state.ts
    ATTACK_RANGE · PERCEPTION_RANGE · NPC_MOVE_SPEED world/semantic/world-state.ts
    RULE-ACTION-BEGIN-001                          world/rules/action-begin.ts
    RULE-ATTACK-001                                world/rules/attack.ts
    RULE-ATTACK-COMPLETE-001                       world/rules/attack.ts
    RULE-HIT-001                                   world/rules/attack.ts
    ActionKind.hit                                 world/semantic/action.ts
    RULE-MINE-COMPLETE-001                         world/rules/mine.ts
    RULE-ACTION-PROGRESS-001                       world/simulation/action-progress.ts
    RULE-NPC-DECIDE-001                            world/simulation/npc-decide.ts
    attack Action Request 경로                     world/actions/dispatch.ts

## REUSED
    World.Bounds · Actor.Position · Actor.MoveSpeed  world/semantic/world-state.ts · position.ts
    Inventory.Items · Tool.Capability               world/semantic/inventory.ts · item.ts
    Deposit                                         world/semantic/deposit.ts
    InteractionRange                                world/semantic/world-state.ts

## AFFECTED UPDATED
    RULE-MOVE-001                world/rules/move.ts
        MoveTarget 설정 → CurrentAction(move) 진입. action-busy Precondition·Result 추가.
    RULE-MOVE-PROGRESS-001       world/simulation/move-progress.ts
        Actor 하나 → move 행동 중인 모든 Actor. 도달 시 CurrentAction = idle.
    RULE-MINE-001                world/rules/mine.ts
        즉시 획득 → 채굴 행동 진입. 획득은 RULE-MINE-COMPLETE-001 으로 이관.
        Precondition 평가가 state 가 아니라 actor 를 받는다 (Actor 가 여럿이므로).
    Player View Projection       world/projection/player-view.ts
        Actor 전체를 entities.character 로 투영. specId 가 VIEW-CHARACTER-ACTION-001 로 바뀐다.
    protocol/gameview.ts
        EntityView 에 kind · progress · targetEntityId 추가 (선택 항목).
        HudItemView 에 'label' 종류와 progress 추가.
        기존 항목은 그대로 — C001 이 쓰던 구조는 깨지지 않는다.
    protocol/semantic-id.ts
        C002 의 Rule / Intent 식별자 추가.

## PROJECTION
    entities.character            world/projection/player-view.ts
        id · role(player-character | npc-character) · kind · position ·
        state(=CurrentActionKind) · progress(=ActionProgress) · targetEntityId
    entities.deposit              동일 파일 (C001 REUSED, kind 에 resourceKind 추가)
    interactions.move             available = 행동 대체 가능성, reason = action-busy
    interactions.attack           대상 없는 1개 — action-busy 하나만
    interactions.mine             대상 Deposit 별 1개 — C001 사유 + action-busy
    hud.inventory.stone           counter
    hud.tool.hasMiningTool        flag
    hud.player.action             label + progress   (04-gameview.spec.yaml 의 hud.playerAction)

    04-gameview.spec.yaml 의 hud.actionHint 는 별도 항목으로 투영하지 않는다 —
    interactions[].available / reason 이 같은 의미를 이미 담고 있으며,
    "어느 대상의 힌트를 보여줄지" 는 View 의 표현 결정이다 (C001 의 mineHint 와 같은 처리).

## TICK 순서 (결정론의 일부)
    1. RULE-NPC-DECIDE-001      자율 Actor 가 행동을 결정한다
    2. RULE-MOVE-PROGRESS-001   이동 행동이 진행된다
    3. RULE-ACTION-PROGRESS-001 시간 행동이 진행되고 완료 효과가 적용된다

    world/index.ts 의 tick 이 이 순서를 고정한다. 순서가 바뀌면 같은 입력에 다른 결과가 나온다.

## TESTS
    world/tests/action.spec.ts   초기 idle · HUD 관찰 · action-busy 거부(이동/채굴) ·
                                 종료 후 재개 · 진행도 없음/범위                        7건
    world/tests/attack.spec.ts   대상 없이 시작 · 멀리 있어도 시작 · 대상 미탑재 ·
                                 유일 사유 action-busy · 이동 중 공격 가능
                                 완료 시 범위 타격 · 범위 밖 무피해 · 아무도 없을 때 ·
                                 여럿 동시 타격 · 휘두르는 동안 물러선 대상은 안 맞음
                                 피격 지속·진행도·복귀 · 대체 불가 행동도 끊김 ·
                                 피격 중 요청 거부                                     13건
    world/tests/npc.spec.ts      순회 시작 · 순회 지점 전환 · 인지 후 접근→공격 ·
                                 공격 중 재결정 없음 · 결정론 재현                      5건
    world/tests/mine.spec.ts     C001 판정 유지 + 완료 시 획득 · 진행도 ·
                                 C001 REGRESSION(이동→채굴→획득)                        7건
    world/tests/move.spec.ts     C001 판정 유지(state 이름만 move) + 목적지 대체        5건

    npm test → 83 passed (실행 결과 — 이후 Cycle 의 테스트를 포함한 현재 합계)

## NOTES
    - Actor.MoveTarget 은 State 에서 사라졌다. 이동 목적지는 CurrentAction.targetPosition 이다.
      기존 코드에서 moveTarget 을 읽던 곳은 모두 CurrentAction 경유로 바뀌었다.
    - 자율 Actor 는 매 Tick 결정하지만 isSameAction 판정으로 같은 행동은 재시작하지 않는다.
      재시작하면 Elapsed 가 0 으로 돌아가 진행도 관찰이 깨진다.
    - 공격은 대상을 담지 않는다. dispatch 의 attack 분기는 targetEntityId 를 읽지 않으며,
      RULE-ATTACK-001 의 Precondition 은 action-busy 하나뿐이다.
    - RULE-HIT-001 은 RULE-ACTION-BEGIN-001 을 거치지 않는 유일한 행동 진입이다.
      피격은 그 캐릭터가 요청한 행동이 아니기 때문이다 (beginAction 만 직접 호출한다).
    - RULE-ACTION-PROGRESS-001 은 진행 대상을 Tick 시작 시점의 행동으로 고정한다.
      고정하지 않으면 그 Tick 에 타격받아 들어간 피격이 같은 dt 로 밀려 즉시 끝나 버린다
      (실제로 그렇게 동작해 테스트가 잡아냈다).
    - NPC 의 이동 속도만 별도 상수(NPC_MOVE_SPEED 2.5)다 — 행동 전환을 눈으로 볼 수 있게 하려는
      의도이며, MoveSpeed 가 Actor 별 State 라는 기존 의미를 그대로 쓴다.
