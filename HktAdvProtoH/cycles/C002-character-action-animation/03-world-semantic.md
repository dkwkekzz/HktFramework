# CYCLE C002 — World Semantic

## SEMANTIC DELTA
    REUSED
        World.Bounds
        Actor.Position
        Actor.MoveSpeed
        Actor.Inventory / Inventory.Items
        Item.Kind · Tool.Capability
        Deposit.Position / ResourceKind / ResourceAmount
        InteractionRange

    ADDED
        World.Actors                 (Actor 가 여럿 존재한다 — Collection)
        Actor.Id
        Actor.CharacterKind          (캐릭터 종류 식별자)
        Actor.Control                (player | autonomous)
        Actor.CurrentAction          (Kind · Target · Elapsed · Duration)
        ActionKind                   (idle | move | attack | mine)
        ActionDefinition.Duration    (행동 종류별 소요 시간 — 없을 수 있음)
        ActionDefinition.Replaceable (진행 중 다른 행동으로 대체 가능한가)
        Actor.AttackRange
        Actor.PerceptionRange
        Actor.WanderPath             (자율 캐릭터의 순회 지점 목록)
        Actor.WanderIndex
        RULE-ACTION-BEGIN-001
        RULE-ACTION-PROGRESS-001
        RULE-ATTACK-001
        RULE-MINE-COMPLETE-001
        RULE-NPC-DECIDE-001

    CHANGED
        World.Actor → World.Actors
            BEFORE  World 는 Actor 하나를 가진다.
            AFTER   World 는 Actor 여럿을 가지며 그 중 Control = player 인 Actor 가
                    플레이어의 캐릭터다. 기존 규칙의 "Actor" 는 모두 "요청 대상 Actor" 로 읽는다.

        RULE-MOVE-001
            NEW PRECONDITION  현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001 경유)
            CHANGED TRANSITION  MoveTarget 설정 대신 CurrentAction = move(TargetPosition)
            NEW RESULT        Failure(action-busy)

        RULE-MOVE-PROGRESS-001
            CHANGED INPUT      모든 Actor 중 CurrentAction.Kind = move 인 Actor
            CHANGED TRANSITION 도달하면 CurrentAction 을 idle 로 되돌린다

        RULE-MINE-001
            CHANGED TRANSITION  즉시 자원 감소·획득이 아니라
                                CurrentAction = mine(Deposit) 로 채굴 행동을 시작한다
            NEW PRECONDITION    현재 행동이 대체 가능하다
            NEW RESULT          Failure(action-busy)
            실제 자원 감소·획득은 RULE-MINE-COMPLETE-001 로 이관된다.

        Actor.MoveTarget
            BEFORE  Actor 의 독립 State
            AFTER   CurrentAction(move).Target 으로 흡수 — 별도 State 로 존재하지 않는다

    AFFECTED
        RULE-MINE-001 의 Observable (Mine.Availability / FailureReason) — action-busy 사유 추가
        Player View Projection — Actor 하나가 아니라 모든 Actor 를 투영한다
        C001 Stone Mining 플레이 — 채굴이 즉시가 아니라 시간이 걸린다 (결과는 보존, Regression 대상)

## WORLD STATE
    World
        Bounds                   World Authority (고정 상수)                    [REUSED]
        Actors                   World Authority — Actor 목록                   [ADDED]

    Actor
        Id                       World Authority (고정)                          [ADDED]
        CharacterKind            World Authority (고정) — 예: adventurer · slime  [ADDED]
        Control                  World Authority (고정) — player | autonomous     [ADDED]
        Position                 World Authority                                 [REUSED]
        MoveSpeed                World Authority (고정 상수)                     [REUSED]
        AttackRange              World Authority (고정 상수)                     [ADDED]
        PerceptionRange          World Authority (고정 상수, autonomous 만 의미)  [ADDED]
        WanderPath               World Authority (고정, autonomous 만 의미)       [ADDED]
        WanderIndex              World Authority                                 [ADDED]
        Inventory.Items          World Authority                                 [REUSED]
        CurrentAction            World Authority                                 [ADDED]

    CurrentAction
        Kind                     idle | move | attack | mine
        TargetPosition           Kind = move 일 때의 목적지 (없을 수 있음)
        TargetActorId            Kind = attack 일 때의 대상 (없을 수 있음)
        TargetDepositId          Kind = mine 일 때의 대상 (없을 수 있음)
        Elapsed                  행동이 시작된 뒤 흐른 시간
        Duration                 이 행동의 소요 시간 (없으면 스스로 끝나지 않는다)

    ActionDefinition             ActionKind 에서 파생되는 고정 의미 (State 가 아니다)
        idle     Duration 없음   Replaceable = true
        move     Duration 없음   Replaceable = true    (목적지 도달로 끝난다)
        attack   Duration 있음   Replaceable = false
        mine     Duration 있음   Replaceable = false

    Deposit
        Position / ResourceKind / ResourceAmount    World Authority             [REUSED]

## WORLD RULE
    RULE-ACTION-BEGIN-001                          (모든 행동 시작의 공통 관문)
        Implements     INTENT-ACTION-STATE-001 · INTENT-ACTION-EXCLUSIVE-001
        Input          Actor, 시작하려는 Action(Kind + Target)
        Preconditions  ActionDefinition(Actor.CurrentAction.Kind).Replaceable = true
        Transition     Actor.CurrentAction = { Kind, Target, Elapsed: 0,
                                               Duration: ActionDefinition(Kind).Duration }
        Result         Success | Failure(action-busy)

        이후 모든 행동 시작 Rule 은 자기 고유 Precondition 을 먼저 판정하고
        이 Rule 을 통해 행동에 진입한다. 어떤 Actor 도 CurrentAction 없이 존재하지 않는다
        (초기 CurrentAction = idle).

    RULE-ACTION-PROGRESS-001                       (시간 진행 법칙 — Simulation Tick)
        Implements     INTENT-ACTION-PROGRESS-001
        Input          경과 시간 dt, 모든 Actor
        Preconditions  Actor.CurrentAction.Duration 이 존재한다
        Transition     Elapsed += dt
                       Elapsed >= Duration 이면
                           해당 행동의 완료 효과 Rule 을 적용하고
                           CurrentAction = idle
        Result         Progress | Completed

        완료 효과 Rule    mine → RULE-MINE-COMPLETE-001
                          attack → 없음 (이번 Cycle 에서 공격의 결과는 정의되지 않는다)

    RULE-MOVE-001                                                        [CHANGED]
        Implements     INTENT-MOVE-001 · INTENT-ACTION-STATE-001
        Input          Actor, TargetPosition
        Preconditions  1. TargetPosition 이 World.Bounds 안에 있다
                       2. 현재 행동이 대체 가능하다 (RULE-ACTION-BEGIN-001)
        Transition     RULE-ACTION-BEGIN-001 로 CurrentAction = move(TargetPosition)
        Result         Success
                       | Failure(out-of-bounds)   ← Precondition 1
                       | Failure(action-busy)     ← Precondition 2

    RULE-MOVE-PROGRESS-001                                               [CHANGED]
        Implements     INTENT-MOVE-001 · INTENT-ACTION-PROGRESS-001
        Input          경과 시간 dt, CurrentAction.Kind = move 인 모든 Actor
        Preconditions  CurrentAction.TargetPosition 이 존재한다
        Transition     Position 을 TargetPosition 방향으로 MoveSpeed × dt 만큼 이동
                       도달하면 Position = TargetPosition, CurrentAction = idle
        Result         Progress | Arrived

    RULE-ATTACK-001                                                      [ADDED]
        Implements     INTENT-ATTACK-001
        Input          Actor, TargetActorId
        Preconditions  1. TargetActorId 가 세계에 존재하고 Actor 자신이 아니다
                       2. distance(Actor.Position, Target.Position) <= Actor.AttackRange
                       3. 현재 행동이 대체 가능하다
        Transition     RULE-ACTION-BEGIN-001 로 CurrentAction = attack(TargetActorId)
        Result         Success
                       | Failure(no-target)       ← Precondition 1
                       | Failure(out-of-range)    ← Precondition 2
                       | Failure(action-busy)     ← Precondition 3

        공격이 대상에게 미치는 효과는 이번 Cycle 에 정의되지 않는다 (01-cycle EXCLUDED).

    RULE-MINE-001                                                        [CHANGED]
        Implements     INTENT-MINING-001 · INTENT-ACTION-STATE-001
        Input          Actor, Deposit
        Preconditions  1. Actor.Inventory 에 Mining Capability 를 가진 Item 이 있다
                       2. distance(Actor.Position, Deposit.Position) <= InteractionRange
                       3. Deposit.ResourceAmount > 0
                       4. 현재 행동이 대체 가능하다
        Transition     RULE-ACTION-BEGIN-001 로 CurrentAction = mine(Deposit)
        Result         Success
                       | Failure(no-mining-tool)  ← Precondition 1
                       | Failure(out-of-range)    ← Precondition 2
                       | Failure(deposit-depleted)← Precondition 3
                       | Failure(action-busy)     ← Precondition 4

    RULE-MINE-COMPLETE-001                                               [ADDED]
        Implements     INTENT-MINING-001 · INTENT-ACTION-PROGRESS-001
        Input          Actor (CurrentAction.Kind = mine 이 Duration 을 채운 시점)
        Preconditions  대상 Deposit 의 ResourceAmount > 0
        Transition     Deposit.ResourceAmount -= 1
                       Actor.Inventory.Items[stone].Count += 1
        Result         Success | Failure(deposit-depleted)

        실패해도 행동은 종료된다 (CurrentAction = idle) — 획득만 일어나지 않는다.

    RULE-NPC-DECIDE-001                                                  [ADDED]
        Implements     INTENT-NPC-AUTONOMY-001
        Input          Control = autonomous 인 Actor, 세계의 다른 Actor 들
        Preconditions  현재 행동이 대체 가능하다 (attack · mine 진행 중에는 결정하지 않는다)
        Transition     인지 대상 = PerceptionRange 안의 가장 가까운 다른 Actor
                       (거리가 같으면 Actor.Id 사전순으로 앞선 쪽 — 결정론)

                       인지 대상이 있고 거리 <= AttackRange
                           → RULE-ATTACK-001 (대상 공격)
                       인지 대상이 있고 거리 > AttackRange
                           → RULE-MOVE-001 (대상 Position 을 목적지로)
                       인지 대상이 없음
                           → 현재 위치가 WanderPath[WanderIndex] 에 도달했으면
                             WanderIndex = (WanderIndex + 1) mod WanderPath 길이
                             RULE-MOVE-001 (WanderPath[WanderIndex] 를 목적지로)

                       결정한 행동이 현재 행동과 같으면(같은 Kind + 같은 대상) 유지한다
                       — 진행 중인 행동을 매 Tick 재시작하지 않는다.
        Result         Decided(ActionKind) | Unchanged

        이 Rule 은 세계 규칙이지 Client 의 요청이 아니다 — Tick 에서 실행된다.

## OBSERVABLE SEMANTIC
    Actor.Id
    Actor.CharacterKind                  캐릭터 종류
    Actor.Control                        player | autonomous
    Actor.Position
    Actor.CurrentActionKind              idle | move | attack | mine
    Actor.ActionProgress                 0..1 — Duration 이 있는 행동에서만 존재
    Actor.ActionTargetId                 현재 행동의 대상 (Actor 또는 Deposit) — 없을 수 있음
    Actor.Inventory.StoneCount           (player Actor 에 한해 HUD 로 관찰)  [REUSED]
    Actor.Inventory.HasMiningTool                                            [REUSED]
    Deposit.Position / ResourceAmount / Availability                         [REUSED]
    Mine.Availability + Mine.FailureReason        (no-mining-tool | out-of-range |
                                                   deposit-depleted | action-busy)
    Attack.Availability + Attack.FailureReason    (no-target | out-of-range | action-busy)
                                                  — 대상 Actor 별로 평가된다

    관찰되지 않는 것: MoveSpeed · AttackRange · PerceptionRange · WanderPath · Duration 원값.
    이들은 행동 상태와 진행도로 충분히 관찰되며, 원값 노출은 View 를 World 내부에 결합시킨다.

## SEMANTIC CLOSURE
    INTENT-ACTION-STATE-001
        "언제나 정확히 하나의 현재 행동"     → Actor.CurrentAction (필수 State, 초기값 idle)
        "대기라는 행동 안에 있다"            → ActionKind.idle

    INTENT-ACTION-PROGRESS-001
        "시간이 흐르는 동안 진행"            → RULE-ACTION-PROGRESS-001 (Elapsed += dt)
        "정해진 소요 시간"                   → ActionDefinition.Duration
        "끝나면 대기로 돌아간다"             → Transition: CurrentAction = idle
        "진행 정도는 관찰 가능"              → Observable: Actor.ActionProgress
        "소요 시간 없는 행동은 스스로 끝나지 않는다"
                                             → idle/move 는 Duration 없음,
                                               move 는 RULE-MOVE-PROGRESS-001 의 Arrived 로 종료

    INTENT-ACTION-EXCLUSIVE-001
        "대체될 수 있는 것과 없는 것"        → ActionDefinition.Replaceable
        "수행되지 않는다"                    → RULE-ACTION-BEGIN-001 Precondition 실패
        "사유를 알 수 있다"                  → Failure(action-busy) + Observable FailureReason

    INTENT-ATTACK-001
        "대상을 인지하고 있고"               → RULE-ATTACK-001 Precondition 1
        "공격 가능한 거리"                   → Actor.AttackRange → Precondition 2
        "대체 불가능한 행동 중이 아닌"       → Precondition 3
        "정해진 시간 동안 공격 행동 안에"    → CurrentAction = attack, Duration
        "끝나면 대기로"                      → RULE-ACTION-PROGRESS-001
        "사유를 알 수 있다"                  → Attack.FailureReason (Observable)

    INTENT-NPC-AUTONOMY-001
        "플레이어가 조종하지 않는"           → Actor.Control = autonomous
        "인지 범위"                          → Actor.PerceptionRange
        "그쪽으로 향한다"                    → RULE-NPC-DECIDE-001 → RULE-MOVE-001
        "공격 가능한 거리에서 공격"          → RULE-NPC-DECIDE-001 → RULE-ATTACK-001
        "스스로 돌아다닌다"                  → Actor.WanderPath + WanderIndex
        "대체 불가 행동 중엔 결정하지 않는다"→ RULE-NPC-DECIDE-001 Precondition
        "캐릭터마다 다를 수 있다"            → PerceptionRange 는 Actor 별 State

    INTENT-CHARACTER-KIND-001
        "어떤 종류의 존재인지"               → Actor.CharacterKind
        "관찰될 때 함께 드러난다"            → Observable: Actor.CharacterKind

    INTENT-MOTION-OBSERVE-001
        "종류와 현재 행동, 진행 정도를 아는 관찰자"
                                             → Observable: CharacterKind ·
                                               CurrentActionKind · ActionProgress
        "그 행동에 대해 가진 모션을 재생"    → World 밖의 의미다.
                                               World 는 종류·행동·진행도까지 책임지고,
                                               어떤 모션을 어떻게 재생할지는
                                               GameView Specification 계약으로 View 가 결정한다.
        "모션이 없으면 대신할 수 있는 모습"  → 같은 이유로 View 책임 (World Rule 아님).
        "몇 종류인지는 데이터가 정한다"      → World Semantic 에 모션 목록을 두지 않는다.
                                               World 는 모션의 존재 여부를 알지 못하며,
                                               알 필요도 없다 (World / View 경계).

    CLOSURE 판정   PASS — Intent 의 모든 문장이 State · Rule · 경계 규정 중 하나로 연결된다.
