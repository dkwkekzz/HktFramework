# CYCLE C001 — World Semantic

## SEMANTIC DELTA
    REUSED
        없음 — 첫 Cycle
    ADDED
        World.Bounds
        Actor
        Actor.Position
        Actor.MoveTarget
        Actor.MoveSpeed
        Actor.Inventory
        Inventory.Items
        Item.Kind                (stone | pickaxe)
        Item.Count
        Tool.Capability          (pickaxe → Mining)
        Deposit
        Deposit.Position
        Deposit.ResourceKind     (stone)
        Deposit.ResourceAmount
        InteractionRange
        RULE-MOVE-001
        RULE-MOVE-PROGRESS-001
        RULE-MINE-001
    CHANGED
        없음
    AFFECTED
        없음

## WORLD STATE
    World
        Bounds                  World Authority (고정 상수)
    Actor
        Position                World Authority
        MoveTarget              World Authority (없을 수 있음)
        MoveSpeed               World Authority (고정 상수)
        Inventory.Items         World Authority (Item.Kind 별 Count)
    Deposit
        Position                World Authority
        ResourceKind            World Authority (이번 Cycle 은 stone 고정)
        ResourceAmount          World Authority

    Tool.Capability 은 Item.Kind 에서 파생되는 의미다 — pickaxe 는 Mining Capability 를 가진다.

## WORLD RULE
    RULE-MOVE-001
        Implements     INTENT-MOVE-001
        Input          Actor, TargetPosition
        Preconditions  TargetPosition 이 World.Bounds 안에 있다
        Transition     Actor.MoveTarget = TargetPosition
        Result         Success | Failure(out-of-bounds)

    RULE-MOVE-PROGRESS-001                       (시간 진행 법칙 — Simulation Tick)
        Implements     INTENT-MOVE-001
        Input          경과 시간 dt
        Preconditions  Actor.MoveTarget 이 존재한다
        Transition     Actor.Position 을 MoveTarget 방향으로 MoveSpeed × dt 만큼 이동
                       도달하면 Position = MoveTarget, MoveTarget 제거
        Result         Progress | Arrived

    RULE-MINE-001
        Implements     INTENT-MINING-001
        Input          Actor, Deposit
        Preconditions  1. Actor.Inventory 에 Mining Capability 를 가진 Item(pickaxe) 이 있다
                       2. distance(Actor.Position, Deposit.Position) <= InteractionRange
                       3. Deposit.ResourceAmount > 0
        Transition     Deposit.ResourceAmount -= 1
                       Actor.Inventory.Items[stone].Count += 1
        Result         Success
                       | Failure(no-mining-tool)      ← Precondition 1 실패
                       | Failure(out-of-range)        ← Precondition 2 실패
                       | Failure(deposit-depleted)    ← Precondition 3 실패

## OBSERVABLE SEMANTIC
    Actor.Position
    Actor.Moving                 (MoveTarget 존재 여부)
    Actor.Inventory.StoneCount
    Actor.Inventory.HasMiningTool
    Deposit.Position
    Deposit.ResourceAmount
    Deposit.Availability         (available: ResourceAmount > 0 | depleted: == 0)
    Mine.Availability            (RULE-MINE-001 Precondition 전체 평가 결과)
    Mine.FailureReason           (no-mining-tool | out-of-range | deposit-depleted)

## SEMANTIC CLOSURE
    "세계에 위치를 가진 Actor"           → Actor.Position
    "도달 가능한 지점"                   → World.Bounds + RULE-MOVE-001 Precondition
    "이동을 수행하여"                    → RULE-MOVE-001 (요청 수용)
    "시간에 걸쳐 그 지점까지"            → RULE-MOVE-PROGRESS-001 + Actor.MoveSpeed
    "Deposit 의 위치를 알고 있고"        → Deposit.Position (Observable)
    "Mining 가능한 Tool 을 보유"         → Inventory.Items + Tool.Capability → Precondition 1
    "접근해 있는(상호작용 가능한 거리)"  → InteractionRange → Precondition 2
    "Mine 을 수행하여"                   → RULE-MINE-001
    "잔여 자원을 1 감소"                 → Transition: ResourceAmount -= 1
    "Inventory 에 Stone 1개 획득"        → Transition: Items[stone].Count += 1
    "잔여 자원이 없으면 획득 불가"       → Precondition 3 + Failure(deposit-depleted)
    "사유를 알 수 있다"                  → Mine.FailureReason (Observable)
