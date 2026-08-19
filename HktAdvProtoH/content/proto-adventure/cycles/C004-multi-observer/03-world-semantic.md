# CYCLE C004 — World Semantic

## SEMANTIC DELTA
    REUSED
        World.Bounds · World.Actors · World.Deposits · World.Time
        Actor 의 모든 State (Id · CharacterKind · Control · Position · MoveSpeed ·
            AttackRange · PerceptionRange · WanderPath · WanderIndex · Inventory ·
            CurrentAction)
        RULE-MOVE-001 · RULE-MOVE-PROGRESS-001 · RULE-MINE-001 · RULE-MINE-COMPLETE-001 ·
        RULE-ATTACK-001 · RULE-ATTACK-COMPLETE-001 · RULE-HIT-001 ·
        RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001 · RULE-NPC-DECIDE-001
        — 이번 Cycle 은 게임 행동의 판정을 하나도 바꾸지 않는다.
          기존 Rule 은 이미 "어떤 Actor" 를 인자로 받는다. 바뀌는 것은 그 Actor 를
          누가 정하는가뿐이다.

    ADDED
        World.Observers               세계가 아는 관찰자들
        Observer.Id                   관찰자가 밝힌 자기 식별
        Observer.ActorId              그 관찰자의 몸
        Observer.Present              지금 세계를 보고 있는가
        World.SpawnPoints             관찰자의 몸이 처음 놓이는 자리들 (고정 상수)
        RULE-OBSERVER-JOIN-001        관찰자가 들어와 몸을 갖는 법칙
        RULE-OBSERVER-LEAVE-001       관찰자가 보고 있지 않게 되는 법칙

    CHANGED
        세계에 조종되는 몸이 있는 조건
            BEFORE  세계는 시작할 때부터 Control = player 인 Actor 를 정확히 하나 가진다
                    (`playerActor(state)` 가 그것을 찾는다).
            AFTER   조종되는 몸은 관찰자가 들어올 때 생긴다.
                    관찰자가 없는 세계에는 자율 존재들만 있고,
                    관찰자가 여럿이면 조종되는 몸도 여럿이다.
                    "그 player Actor" 를 가리키는 의미는 더 이상 없다.

        Action Request 의 주체 결정
            BEFORE  요청은 언제나 Control = player 인 그 Actor 를 주체로 판정된다.
            AFTER   요청은 그것이 도착한 이어짐에 붙은 관찰자의 몸을 주체로 판정된다
                    (INTENT-REQUEST-ATTRIBUTION-001).
                    요청 자체는 주체를 지정하지 않는다 — 지정할 수단이 없다.

        Observer Projection
            BEFORE  세계의 관찰 결과는 하나이며 누가 받든 같다.
            AFTER   관찰 결과는 관찰자마다 만들어진다.
                    Interaction 가용성과 HUD 는 그 관찰자의 몸을 기준으로 판정되고,
                    entity 의 role 은 보는 이에 따라 달라진다.

        RULE-WORLD-TICK-001
            BEFORE  Transition  1. 도착한 요청 처리 → 2~4 진행 → 5. Time += dt
                    Result      Observation 하나
            AFTER   Transition  0. 도착한 참여/이탈 처리(RULE-OBSERVER-JOIN/LEAVE-001)
                                1~5 그대로
                    Result      Observations — 지금 보고 있는 관찰자 각각의 관찰 결과
            Reason  세계의 모든 상태 변화는 Rule 을 통해서만 일어난다.
                    관찰자가 들어오고 나가는 것도 세계의 상태 변화다.

    AFFECTED
        RULE-NPC-DECIDE-001
            판정 내용 변경 없음. 인지 대상(`perceivedTarget`)은 이미 "다른 모든 Actor"
            중에서 고르므로 조종되는 몸이 여럿이 되면 그 중 가장 가까운 것을 고른다.
            보는 이가 없는 몸도 세계에 있는 몸이므로 인지 대상이 된다 —
            떠났다고 세계에서 사라지지 않기 때문이다 (INTENT-OBSERVER-LEAVE-001).

        RULE-MOVE-001 · RULE-MINE-001 · RULE-ATTACK-001 · RULE-ACTION-BEGIN-001
            받는 Actor 가 요청을 보낸 관찰자의 몸이 된다. Precondition · Transition ·
            Result 는 그대로다.

        C001 · C002 · C003 의 모든 플레이 Scenario
            관찰자가 한 명일 때 같은 조작이 같은 결과를 내야 한다 (Regression).
            단 "세계가 시작하자마자 몸이 있다" 는 전제는 "관찰자가 들어오면 몸이 있다" 로
            바뀐다 — 검증은 관찰자 하나를 들여보낸 뒤 시작한다.

## WORLD STATE
    World
        Bounds          World Authority (고정 상수)                        [REUSED]
        Actors          World Authority                                   [REUSED]
        Deposits        World Authority                                   [REUSED]
        Time            World Authority                                   [REUSED]
        Observers       World Authority — 세계가 아는 관찰자들             [ADDED]

    Observer                                                              [ADDED]
        Id              World Authority.
                        관찰자가 밝힌 값을 세계가 받아 적은 것이다 (INTENT-OBSERVER-IDENTITY-001).
                        세계는 이 값이 참인지 따지지 않지만, 한 번 받아 적은 뒤에는
                        세계의 것이다 — 관찰자가 나중에 바꿔 말할 수 없다.
        ActorId         World Authority — 세계가 정한다. 관찰자가 고를 수 없다.
        Present         World Authority — 지금 이 관찰자가 세계를 보고 있는가.
                        RULE-OBSERVER-JOIN-001 이 참으로, RULE-OBSERVER-LEAVE-001 이
                        거짓으로 만든다.

    World.SpawnPoints   관찰자의 몸이 처음 놓이는 자리들.                   [ADDED]
                        결정론 시뮬레이션 값이므로 헤더 상수로 고정한다.
                        몇 번째 몸인지로 자리가 정해지므로 같은 순서로 들어오면
                        언제나 같은 배치가 된다.

    Observer.Id 의 한계 길이도 고정 상수다 — 세계가 받아 적을 수 있는 크기를 넘는 밝힘은
    받아들이지 않는다 (RULE-OBSERVER-JOIN-001 Precondition).

    이어짐 상태(connecting · connected · disconnected)는 여전히 World State 가 아니다 —
    관찰자 쪽이 소유한다 (C003). 세계가 갖는 것은 "이 관찰자가 지금 보고 있는가"(Present)
    뿐이며, 이 값은 세계의 **진행**에 영향을 주지 않는다.
    관찰자가 0명이어도 RULE-WORLD-TICK-001 은 그대로 돈다.

## WORLD RULE
    RULE-OBSERVER-JOIN-001                                                [ADDED]
        Implements     INTENT-OBSERVER-IDENTITY-001 · INTENT-OBSERVER-JOIN-001 ·
                       INTENT-OBSERVER-REJOIN-001
        Input          관찰자가 밝힌 Id, 그 밝힘이 도착한 이어짐
        Preconditions  1. Id 가 비어 있지 않다
                       2. Id 의 길이가 한계 이내다
        Transition     이미 아는 Id 인 경우 (재참여)
                           1. 그 Observer.Present = true
                           2. 같은 Id 로 다른 이어짐이 보고 있었다면 그 이어짐은 떨어진다
                              — 몸 하나에 조종하는 이는 하나다 (INTENT-OBSERVER-REJOIN-001)
                           3. 몸은 만들지 않는다. 이전 몸을 그대로 쓴다 —
                              자리 · 가진 것 · 하던 행동이 이어진다
                       처음 보는 Id 인 경우 (첫 참여)
                           1. 새 Actor 를 만든다
                              Control        = player
                              Position       = SpawnPoints[지금까지 만든 몸의 수]
                              CharacterKind  = 기본값 (C002 의 기본 종류)
                              Inventory      = 기본 소지품 (C001 의 기본 — 곡괭이 하나)
                              그 밖의 State  = 기존 Actor 생성 규칙 그대로
                           2. World.Actors 에 더한다
                           3. Observer{Id, ActorId, Present: true} 를 World.Observers 에 더한다
        Result         Success(Id, ActorId) | Failure(invalid-observer-id)

        Actor.Id 는 세계가 순번으로 정한다. 관찰자가 밝힌 Id 를 몸의 이름에 섞지 않는다 —
        세계 밖에서 온 문자열이 세계 안 존재의 이름이 되어서는 안 된다.

    RULE-OBSERVER-LEAVE-001                                               [ADDED]
        Implements     INTENT-OBSERVER-LEAVE-001
        Input          이어짐을 잃은 관찰자의 Id
        Preconditions  세계가 아는 관찰자다
        Transition     1. 그 Observer.Present = false
                       2. 몸은 그대로 둔다 — 자리에서 사라지지 않는다
                       3. 하고 있던 행동은 취소하지 않는다 —
                          RULE-ACTION-PROGRESS-001 이 세계의 시간대로 끝까지 진행시킨다
        Result         Success(Id) | Failure(unknown-observer)

        이 Rule 은 몸을 자율 존재로 바꾸지 않는다. 몸의 Control 은 player 그대로이며
        RULE-NPC-DECIDE-001 의 대상이 되지 않는다 — 보는 이가 없는 몸은
        스스로 새 행동을 시작하지 않는다 (INTENT-OBSERVER-LEAVE-001).

    RULE-WORLD-TICK-001                                                   [CHANGED]
        Implements     INTENT-WORLD-CLOCK-001 · INTENT-PER-OBSERVER-PROJECTION-001
        Input          경과 시간 dt, 도착해 있는 참여/이탈, 도착해 있는 Action Request 들
        Preconditions  없음 — 세계는 언제나 진행한다
        Transition     0. 도착한 참여/이탈을 순서대로 처리한다
                          (RULE-OBSERVER-JOIN-001 · RULE-OBSERVER-LEAVE-001)
                       1. 도착해 있는 Action Request 를 순서대로 처리한다.
                          각 요청의 주체는 그 요청이 도착한 이어짐의 관찰자의 몸이다.
                          세계가 모르는 관찰자의 요청은 아무 Rule 에도 위임되지 않는다.
                       2. RULE-NPC-DECIDE-001
                       3. RULE-MOVE-PROGRESS-001
                       4. RULE-ACTION-PROGRESS-001
                       5. World.Time += dt
        Result         Observations — Present 인 관찰자 각각에 대한 Observer Projection

        참여가 요청보다 앞서는 이유: 같은 Tick 에 들어오면서 보낸 요청이
        그 Tick 에 판정될 수 있어야 "요청 → 다음 관찰 결과" 인과가 밀리지 않는다.
        1~5 의 순서는 C002 · C003 이 고정한 것을 그대로 따른다.

    RULE-MOVE-001 · RULE-MINE-001 · RULE-ATTACK-001 ·
    RULE-ACTION-BEGIN-001 · RULE-NPC-DECIDE-001                           [AFFECTED]
        판정 · 전이 내용 변경 없음. 주체 Actor 를 정하는 경로만 바뀐다.

## OBSERVABLE SEMANTIC
    Observer.Self                       [ADDED] 이 관찰 결과를 받는 이가 누구인가 —
                                        자신의 Id 와 자신의 몸(ActorId).
                                        관찰자는 이것으로 화면 속 어느 것이 자기 몸인지 안다.

    Character.Role                      [CHANGED] 보는 이에 따라 달라진다
                                            내 몸                  player-character   [REUSED]
                                            다른 관찰자의 몸       other-player-character [ADDED]
                                            자율 존재              npc-character      [REUSED]

    Character.Attended                  [ADDED] 그 몸을 지금 조종하는 이가 있는가.
                                        다른 관찰자의 몸에 대해서만 의미가 있다 —
                                        떠난 이의 몸이 남아 있다는 사실이 이것으로 관찰된다
                                        (INTENT-OBSERVER-LEAVE-001).

    Observers.PresentCount              [ADDED] 지금 이 세계를 함께 보고 있는 관찰자의 수.

    Interaction 가용성 · 사유            [CHANGED] 관찰자 자신의 몸을 기준으로 판정된다.
    Inventory · Tool · 행동 상태 HUD     [CHANGED] 관찰자 자신의 몸의 것만 실린다.
                                        다른 관찰자의 소지품과 가용성은 실리지 않는다
                                        (INTENT-PER-OBSERVER-PROJECTION-001).

    Character 의 위치 · 상태 · 종류 · 진행도   [REUSED] 모든 몸에 대해 그대로 관찰된다.
    World.Time                                 [REUSED]

    관찰되지 않는 것
        다른 관찰자의 Observer.Id — 누가 접속해 있는지의 이름은 이번 Cycle 의 의미가 아니다.
        관찰 결과에는 몸(entity)과 수(count)만 나타난다.
        RULE-OBSERVER-JOIN-001 의 실패 사유는 참여하지 못한 관찰자에게만 의미가 있으며,
        세계 안의 다른 관찰자에게는 관찰되지 않는다.

## SEMANTIC CLOSURE
    INTENT-OBSERVER-IDENTITY-001
        "자신이 누구인지 밝힌다"          → RULE-OBSERVER-JOIN-001 Input (밝힌 Id)
        "세계는 그것으로 구별한다"        → Observer.Id (World Authority) — 같은 Id 는 같은
                                            관찰자, 다른 Id 는 다른 관찰자
        "참인지 따지지 않는다"            → RULE-OBSERVER-JOIN-001 Precondition 에
                                            자격 검증이 없다 (형식만 본다)
        "말할 수 있는 자는 인정된다"      → Precondition 통과 시 언제나 Success

    INTENT-OBSERVER-JOIN-001
        "세계가 자신의 상태로 받아들인다" → World.Observers += Observer
        "그 관찰자의 몸을 정한다"         → Observer.ActorId
        "새 몸을 만들어 준다"             → RULE-OBSERVER-JOIN-001 Transition (첫 참여)
        "다른 캐릭터와 같은 종류의 존재"  → 새 몸은 기존 Actor State 를 그대로 갖는다.
                                            Actor 에 관찰자 전용 State 를 더하지 않는다.
        "한 관찰자에게 하나의 몸"         → Observer.ActorId 는 하나이며 재참여 시
                                            새로 만들지 않는다

    INTENT-OBSERVER-REJOIN-001
        "새 몸을 만들지 않는다"           → RULE-OBSERVER-JOIN-001 Transition (재참여)
        "자리 · 가진 것 · 행동이 이어진다"→ 몸의 State 를 건드리지 않으므로 그대로다
        "두 곳에서 동시에 들어오면"       → RULE-OBSERVER-JOIN-001 Transition 재참여 2

    INTENT-OBSERVER-LEAVE-001
        "지금 보고 있지 않음을 안다"      → Observer.Present = false
        "몸은 사라지지 않는다"            → RULE-OBSERVER-LEAVE-001 Transition 2
        "하던 행동은 끝까지 진행된다"     → RULE-ACTION-PROGRESS-001 (변경 없음)
        "스스로 새 행동을 시작하지 않는다"→ Control 이 player 그대로이므로
                                            RULE-NPC-DECIDE-001 의 대상이 아니다
        "남은 관찰자들이 볼 수 있다"      → Character.Attended (Observable)

    INTENT-PER-OBSERVER-PROJECTION-001
        "관찰자마다 따로 만든다"          → RULE-WORLD-TICK-001 Result: Observations
        "자신의 몸은 자신이 조종하는 것"  → Character.Role = player-character + Observer.Self
        "다른 몸은 다른 존재로"           → Character.Role = other-player-character
        "내 것으로서만 아는 것은 안 들어간다" → Interaction · HUD 는 관찰자 자신의 몸 기준
        "받은 관찰 결과가 전부다"         → 세계에 묻는 경로는 여전히 없다 (C003 그대로)

    INTENT-REQUEST-ATTRIBUTION-001
        "요청에 누가 보냈는지 실린다"     → 요청은 이어짐을 통해 도착하고,
                                            그 이어짐에 관찰자가 붙어 있다
                                            (RULE-OBSERVER-JOIN-001 Input)
        "그 관찰자의 몸에 대해서만 판정"  → RULE-WORLD-TICK-001 Transition 1
        "다른 몸을 적어 보내도 안 된다"   → Action Request 에 주체를 적는 자리가 없다.
                                            주체는 Observer.ActorId 로만 정해진다.
        "모르는 관찰자의 요청은 무효"     → Transition 1, 위임하지 않는다

    CLOSURE 판정   PASS — Intent 6종의 모든 문장이 State · Rule · Observable 중
                   하나 이상으로 연결된다. 닫히지 않은 문장 없음.

    OBSERVABLE CLOSURE 판정   PASS
                   Rule 판단에 쓰인 값과 실패 사유가 모두 관찰 가능하다.
                       Observer 판정의 근거    Observer.Self · Observers.PresentCount ·
                                               Character.Attended
                       참여 실패 사유          Failure(invalid-observer-id) —
                                               참여하지 못한 관찰자 쪽에서 관찰된다
                       행동 판정의 근거        C001~C003 의 Observable 그대로,
                                               관찰자 자신의 몸 기준
