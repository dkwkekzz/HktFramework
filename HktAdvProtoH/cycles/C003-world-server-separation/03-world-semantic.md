# CYCLE C003 — World Semantic

## SEMANTIC DELTA
    REUSED
        World.Bounds · World.Actors · Deposit
        Actor 의 모든 State (Position · CurrentAction · CharacterKind · Control · …)
        RULE-MOVE-001 · RULE-ATTACK-001 · RULE-MINE-001 · RULE-MINE-COMPLETE-001 ·
        RULE-ACTION-BEGIN-001
        — 이번 Cycle 은 게임 행동의 의미를 하나도 바꾸지 않는다.

    ADDED
        World.Time               세계가 시작된 뒤 흐른 시간
        World.TickInterval       세계가 스스로 진행하는 주기 (고정 상수)
        RULE-WORLD-TICK-001      세계가 자기 시계로 자신을 진행시키는 법칙
        Observation Emission     Tick 마다 그 시점의 Observer Projection 을 내보내는 것

    CHANGED
        시간 진행의 주체
            BEFORE  외부(관찰자의 렌더 루프)가 dt 를 주며 World.tick 을 부른다.
            AFTER   World 가 자신의 TickInterval 로 스스로 진행한다.
                    외부는 세계를 진행시킬 수 없다.

        Observation 의 흐름
            BEFORE  외부가 원할 때 projectPlayerView() 를 호출해 가져간다 (pull).
            AFTER   세계가 Tick 마다 내보낸다 (push).
                    관찰자는 받은 것만 안다.

        Action Request 의 도달
            BEFORE  호출 즉시 Rule 이 실행되고 결과가 반환값으로 돌아온다.
            AFTER   요청은 세계에 도착해 다음 Tick 의 판정 대상이 된다.
                    판정 결과는 반환값이 아니라 그 뒤의 관찰 결과로 드러난다.

    AFFECTED
        RULE-MOVE-PROGRESS-001 · RULE-ACTION-PROGRESS-001 · RULE-NPC-DECIDE-001
            부르는 주체가 RULE-WORLD-TICK-001 로 바뀐다. 판정 내용은 불변.
        Observer Projection
            World.Time 이 관찰 항목에 추가된다.
        C001 · C002 의 모든 플레이 Scenario
            같은 조작이 같은 결과를 내야 한다 (Regression).

## WORLD STATE
    World
        Bounds          World Authority (고정 상수)                      [REUSED]
        Actors          World Authority                                 [REUSED]
        Deposits        World Authority                                 [REUSED]
        Time            World Authority — Tick 마다 누적된다             [ADDED]

    World.TickInterval  세계가 자신을 진행시키는 주기.
                        결정론 시뮬레이션 값이므로 헤더 상수로 고정한다. [ADDED]

    관찰자와의 이어짐 상태는 World State 가 아니다.
    세계는 누가 자신을 보고 있는지에 따라 달라지지 않는다 (INTENT-OBSERVER-LINK-001).
    그 상태는 관찰자 쪽이 소유하며 GameView Specification 의 session 절이 규정한다.

## WORLD RULE
    RULE-WORLD-TICK-001                                                  [ADDED]
        Implements     INTENT-WORLD-CLOCK-001 · INTENT-WORLD-OBSERVATION-001
        Input          경과 시간 dt (세계 자신의 시계가 준다)
        Preconditions  없음 — 세계는 언제나 진행한다
        Transition     1. 도착해 있는 Action Request 를 순서대로 처리한다
                          (각 요청은 해당 행동 시작 Rule 로 위임된다)
                       2. RULE-NPC-DECIDE-001
                       3. RULE-MOVE-PROGRESS-001
                       4. RULE-ACTION-PROGRESS-001
                       5. World.Time += dt
        Result         Observation — 이 시점의 Observer Projection 을 내보낸다

        1~4 의 순서는 C002 가 고정한 순서를 그대로 따르며, 요청 처리가 그 앞에 붙는다.
        요청이 먼저인 이유: 그 Tick 에 도착한 조작이 그 Tick 의 진행에 반영되어야
        관찰자가 보는 "요청 → 다음 관찰 결과" 인과가 한 칸 이상 밀리지 않는다.

    RULE-MOVE-PROGRESS-001 · RULE-ACTION-PROGRESS-001 · RULE-NPC-DECIDE-001   [AFFECTED]
        판정·전이 내용 변경 없음. 호출 주체만 RULE-WORLD-TICK-001 이 된다.

## OBSERVABLE SEMANTIC
    World.Time                          [ADDED] 세계가 시작된 뒤 흐른 시간 (초)
    (C001 · C002 의 Observable 전부)     [REUSED] 변경 없음

    관찰되지 않는 것: World.TickInterval 원값 —
    세계가 얼마나 자주 진행하는지는 관찰자가 알 필요가 없다.
    관찰자에게 필요한 것은 "세계가 지금 어디까지 왔는가"(World.Time)뿐이다.

## SEMANTIC CLOSURE
    INTENT-WORLD-CLOCK-001
        "세계는 자신의 시계를 가진다"        → World.TickInterval + RULE-WORLD-TICK-001
        "관찰자가 있든 없든 진행한다"        → RULE-WORLD-TICK-001 Precondition 없음
        "흐른 시간은 관찰 가능하다"          → World.Time (Observable)
        "자기 화면과 무관했음을 알 수 있다"  → 관찰자가 보지 않은 동안에도 World.Time 이
                                               흘러 있다는 사실로 관찰된다

    INTENT-WORLD-OBSERVATION-001
        "진행에 맞추어 내보낸다"             → RULE-WORLD-TICK-001 Result: Observation
        "내부를 직접 읽지 않는다"            → 세계 밖으로 나가는 것은 Observer Projection 뿐
        "받은 것만이 아는 전부다"            → 관찰자에게 세계를 묻는 경로가 없다 (pull 없음)

    INTENT-REMOTE-REQUEST-001
        "요청으로 보낸다"                    → Action Request (C001 계약 그대로)
        "즉시 세계가 되지 않는다"            → 요청은 다음 Tick 의 처리 대상이 된다
        "세계가 자신의 규칙으로 판정한다"    → RULE-WORLD-TICK-001 Transition 1
        "결과는 뒤에 오는 관찰 결과에서"     → 같은 Tick 의 Result: Observation
        "조금 이전의 세계를 본다"            → 관찰 결과는 만들어진 시점의 세계다

    INTENT-OBSERVER-LINK-001
        "이어짐 상태를 안다"                 → World 밖의 의미다.
                                               세계는 관찰자의 존재로 달라지지 않으므로
                                               World State 에 두지 않는다.
                                               GameView Specification 의 session 절이
                                               이 의미의 소유자를 관찰자 쪽으로 규정한다.
        "끊긴 동안 마지막 세계를 본다"       → 같은 이유로 관찰자 쪽 규칙
        "요청을 보낼 수 없다"                → 같은 이유 (세계는 도착하지 않은 요청을 모른다)

    CLOSURE 판정   PASS — Intent 의 모든 문장이 State · Rule · 경계 규정 중 하나로 연결된다.
                   INTENT-OBSERVER-LINK-001 은 의도적으로 World 밖에 둔다.
