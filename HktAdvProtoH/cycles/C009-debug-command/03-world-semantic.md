# C009 — World Semantic

> 02-intent.md 가 넘긴 BOUNDARY 3건을 여기서 판정한다.
>
>   1  명령 목록은 세계의 **성질**이다 (State 가 아니다). 지금 걸 수 있는지만 State 가 정한다.
>   2  세계의 대답은 **Tick 의 산출물**이다 — 새 World State 를 만들지 않는다.
>      요청이 Tick 에 판정되므로(C003) 대답도 그 Tick 에서 나온다.
>   3  지목 수단은 이름이 아니라 **Actor.Id** 다 — 이름은 겹칠 수 있고 Id 는 겹치지 않는다.
>
> 판정 근거는 각 절의 RATIONALE 에 적는다.

## SEMANTIC DELTA
    REUSED
        Actor.Id                        지목 수단. 이미 존재하고 이미 투영된다
        Actor.Name                      사람이 읽는 이름. 지목에 쓰지 않는다
        World.DebugAuthority.Open       세계가 조작을 허용하는가 (C007 R2)
        MutableAttribute 목록·허용 범위  바꿀 수 있는 속성과 그 범위 (C007 R2)
        RULE-ATTRIBUTE-SET-001          값을 바꾸는 판정 — 한 줄도 바뀌지 않는다
        RULE-WORLD-TICK-001             요청은 Tick 에 판정된다 (C003)
        Observer.Id                     대답이 누구에게 가는지의 기준 (C004)
        Collision 관찰값 전부            충돌체 관찰 (C006) — 이번 Cycle 이 건드리지 않는다
        Actor 속성 전부의 관찰           속성 관찰 (C007 R2) — 그대로다

    ADDED
        World.CommandCatalog            세계 밖에서 세계에 손댈 수 있는 것들의 목록.
                                        World State 가 아니라 세계의 성질이다 (RATIONALE 1)
        Command.Availability            그 명령을 지금 걸 수 있는가 + 불가 사유.
                                        State(DebugAuthority)에서 판정되는 관찰값이다
        Request.Mark                    요청에 관찰자가 붙이는 표식. 세계는 해석하지도
                                        저장하지도 않고 대답에 그대로 되돌린다
        Request.Outcome                 하나의 요청에 대한 세계의 대답.
                                        World State 가 아니라 Tick 의 산출물이다 (RATIONALE 2)
        RULE-REQUEST-REPLY-001          모든 요청은 대답을 받는다

    CHANGED
        World.MutableAttributes 의 관찰 자리
            기존  "바꿀 수 있는 속성과 허용 범위" 가 그 자체로 관찰된다 (C007 R2)
            변경  그것이 World.CommandCatalog 안 set-attribute 명령이 받는 값의
                  허용 범위로 들어간다. 값도 뜻도 그대로이고 실리는 자리만 달라진다
        RULE-WORLD-TICK-001
            기존  Tick 은 받아 둔 요청을 판정하고 관찰자별 관찰 결과를 낸다
            변경  Tick 은 그에 더해 그 Tick 에서 판정한 요청들의 대답을 관찰자별로 낸다.
                  판정 자체는 바뀌지 않는다 — 이미 나오던 결과를 버리지 않고 내보낼 뿐이다

    AFFECTED
        RULE-MOVE-001 · RULE-MINE-001 · RULE-SKILL-BEGIN-001 · RULE-MOVE-MODE-001
        RULE-ATTRIBUTE-SET-001 · RULE-OBSERVER-JOIN-001 (요청 경로)
                                        전부 이제 자기 판정 결과가 요청한 이에게 돌아간다.
                                        각 Rule 의 Preconditions·Transition·Result 는
                                        하나도 바뀌지 않는다 — 결과가 버려지지 않을 뿐이다
        RULE-DOWNED-001                 생명을 명령으로 되돌리면 쓰러진 몸이 일어난다.
                                        C007 R2 가 이미 정한 것이며 이번에 처음 실제로 걸린다
        RULE-MOVE-PROGRESS-001          바뀐 이동 속도로 지금까지대로 나아간다
        RULE-ACTION-PROGRESS-001        바뀐 행동 속도로 지금까지대로 진행한다
        RULE-CP-RUN-DRAIN-001           바뀐 달리기 배율 아래에서도 기력 규칙은 그대로다

## WORLD STATE

    변화 없음 — 이번 Cycle 은 World State 를 하나도 더하지 않는다.

    World.DebugAuthority.Open           World Authority     REUSED (C007 R2)
        세계 밖(세계를 띄우는 쪽)이 정한다. 요청으로는 바꿀 수 없다.
        Command.Availability 는 전적으로 이 값이 정한다.

    Actor.Id                            World Authority     REUSED
        존재를 서로 구별해 부르는 수단. 세계가 정하며 겹치지 않는다.

    RATIONALE 1 — 명령 목록은 왜 State 가 아닌가
        State 는 세계가 굴러가며 달라지는 것이다. 걸 수 있는 명령의 목록은
        세계가 굴러가도 달라지지 않는다 — 그것은 이 세계가 어떤 규칙 위에 서 있는가,
        즉 세계의 성질이다. 세계마다 다른 것은 "지금 그것을 허용하는가"(DebugAuthority)
        이고 그것은 이미 State 로 있다.

        같은 판단이 이미 선례로 있다 — MutableAttribute 목록과 그 허용 범위는
        C007 R2 에서 State 가 아니라 세계의 성질로 두었고 관찰 결과에만 실렸다.
        이 Cycle 은 그 판단을 명령 전체로 넓힐 뿐 새 판단을 하지 않는다.

    RATIONALE 3 — 지목은 왜 이름이 아닌가
        Actor.Name 은 사람이 읽으라고 있는 것이며 겹칠 수 있다 —
        같은 종류의 존재가 여럿이면 같은 이름을 가진다. 겹치는 것으로 지목하면
        무엇을 지목했는지가 관찰자에게도 세계에도 분명하지 않다.
        Actor.Id 는 겹치지 않고 이미 관찰 결과에 실려 있다.
        새 State 를 만들지 않고 INTENT-ENTITY-ADDRESSABLE-001 이 닫힌다.

## WORLD PROPERTY

    World.CommandCatalog                세계의 성질 (State 아님)     ADDED
        세계 밖에서 세계에 손댈 수 있는 것들의 목록.
        세계 안의 행동(Interaction — 이동·채굴·스킬)과는 다른 것이다.
        Interaction 은 몸이 세계 안에서 하는 일이고,
        Command 는 세계의 규칙 밖에서 세계에 손을 대는 일이다 (C007 R2 의 표현 그대로).

        Command
            Id              그 명령을 가리키는 이름
            Effect          무엇을 하는가 (의미 코드 — 문구는 View 가 정한다)
            Parameters      받는 것들, 순서대로

        Parameter
            Id              그 자리의 이름
            Required        없어도 되는가
            OmittedMeaning  없을 때 무엇으로 치는가 (의미 코드)
            Domain          받을 수 있는 값의 범위
                entity          세계에 있는 존재를 Actor.Id 로 가리킨다
                choice          정해진 몇 가지 이름 중 하나.
                                각 선택지는 뒤따르는 자리의 Domain 을 정할 수 있다
                number          수치 — 하한과 상한을 가진다
                text            그 밖의 낱말

        이번 Cycle 의 목록은 하나다.

            Command  set-attribute
                Effect      존재의 속성 값을 바꾼다
                Parameters
                    target      entity   Required 아님
                                OmittedMeaning  요청한 이의 몸
                    attribute   choice   Required
                                선택지 = MutableAttribute 목록 (REUSED, C007 R2)
                                각 선택지가 value 자리의 Domain 을 정한다
                                    hp                  number  0 … 100000
                                    hpMax               number  1 … 100000
                                    cp                  number  0 … 100000
                                    cpMax               number  1 … 100000
                                    moveSpeed           number  0 … 100
                                    runSpeedMultiplier  number  0.1 … 10
                                    actionSpeed         number  0.1 … 10
                                    moveMode            choice  walk | run
                    value       앞의 선택이 정한 Domain   Required

        관찰 토글(충돌체·속성 펼침)은 이 목록에 없다 — 세계로 오지 않기 때문이다
        (INTENT-OBSERVER-COMMAND-001). 관찰자 쪽 목록과 이 목록이 화면에서 한 자리에
        보이는 것은 GameView Specification 이 정할 일이다.

        새 명령이 세계에 생기면 이 목록에 Command 가 하나 더 나타난다.
        Command 와 Parameter 의 구조는 그때 바뀌지 않는다 —
        그것이 INTENT-COMMAND-CATALOG-001 이 요구한 "항목이 하나 더해질 뿐" 이다.

## WORLD RULE

    RULE-ATTRIBUTE-SET-001                                      REUSED — 변경 없음
        Implements     INTENT-ATTRIBUTE-MUTATE-001 (C007 R2)
        Input          대상 Actor.Id, 속성 이름, 새 값
        Preconditions  1. World.DebugAuthority.Open 이 참이다
                       2. 대상 Actor.Id 가 세계에 있다
                       3. 속성 이름이 MutableAttribute 목록에 있다
                       4. 새 값이 그 속성의 허용 범위 안에 있다
        Transition     그 속성에 새 값을 넣는다.
                       Hp 가 0 이 되면 RULE-DOWNED-001 이 이어지고,
                       쓰러진 몸의 Hp 를 올리면 다시 일어난다.
                       HpMax/CpMax 를 낮추면 현재값도 함께 그 안으로 들어온다.
        Result         Success | Failure(debug-closed | unknown-target |
                                         unknown-attribute | value-out-of-range)

        이번 Cycle 은 이 Rule 을 바꾸지 않는다. 바뀌는 것은 이 Result 가
        요청한 이에게 닿는다는 것뿐이다.

    RULE-REQUEST-REPLY-001                                      ADDED
        Implements     INTENT-REQUEST-REPLY-001 · INTENT-REPLY-CORRESPONDENCE-001
        Input          요청한 Observer.Id, 요청 하나, 그 요청에 실려 온 Request.Mark(있으면)
        Preconditions  없음 — 도착한 모든 요청이 대답을 받는다.
                       세계가 모르는 관찰자의 요청도 "모르는 관찰자다" 라는 대답을 받는다.
                       걸 수 없는 명령을 건 것도 "그런 명령이 없다" 라는 대답을 받는다
        Transition     없음 — 세계의 상태는 이 Rule 로 바뀌지 않는다.
                       세계는 누가 무엇을 걸었는지 기억하지 않는다
        Result         그 요청을 판정한 Rule 의 결과를 그대로 낸다 —
                       받아들임(어느 Rule 이) | 거절(어느 Rule 이, 무슨 사유로).
                       요청에 실려 온 Request.Mark 를 그대로 붙여 낸다.
                       이 대답은 요청한 Observer 에게만 간다

        RATIONALE 2 — 대답은 왜 State 가 아닌가
            요청은 도착 즉시 판정되지 않고 받아 두었다가 Tick 에 판정된다
            (C003 INTENT-REMOTE-REQUEST-001, RULE-WORLD-TICK-001).
            따라서 대답이 나오는 자리는 그 Tick 이며, 관찰자별 관찰 결과가
            나오는 자리와 같다. 관찰 결과가 State 가 아니라 Tick 의 산출물이듯
            대답도 그렇다. 세계는 대답을 쌓아 두지 않는다.

            한 Tick 에 여러 요청이 판정되면 대답도 여럿 나온다 —
            그래서 어느 대답이 어느 요청의 것인지 짚을 수단(Request.Mark)이 필요하다.

    RULE-WORLD-TICK-001                                         CHANGED
        Implements     INTENT-WORLD-CLOCK-001 (C003) · INTENT-REQUEST-REPLY-001 (C009)
        Input          흐른 시간, 받아 둔 관찰자 변동, 받아 둔 요청들
        Preconditions  없음
        Transition     기존 그대로 — 받아 둔 것을 순서대로 판정하고 세계를 진행시킨다
        Result         기존  관찰자별 관찰 결과
                       추가  관찰자별 대답들 (RULE-REQUEST-REPLY-001 의 산출)
                       판정 순서도 판정 내용도 바뀌지 않는다.
                       지금까지 버려지던 각 Rule 의 Result 를 버리지 않을 뿐이다

## AUTHORITY

    World.CommandCatalog        World      세계가 정한다. 관찰자는 읽기만 한다
    Command.Availability        World      DebugAuthority 에서 판정된다
    Request.Outcome             World      세계의 판정 그 자체다
    Request.Mark                Observer   관찰자가 붙인다. 세계는 해석하지 않고 되돌린다
                                           (C005 Observer.Mark 와 같은 성질 — 다만
                                            세계는 이것을 받아들이지도 저장하지도 않는다)

## OBSERVABLE SEMANTIC

    World.CommandCatalog                        전부 관찰된다
        밝혀지는 것 자체가 목적이다 (INTENT-COMMAND-CATALOG-001).
        Command 의 Id · Effect · Parameters 와 각 Parameter 의
        Required · OmittedMeaning · Domain 이 모두 관찰된다.
        문구로 어떻게 보일지는 View 가 정한다 — 세계는 의미 코드만 낸다.

    Command.Availability + FailureReason        전부 관찰된다
        지금 걸 수 있는가와 걸 수 없다면 왜인가 (debug-closed).
        기존 Interaction 의 available/reason 과 같은 모양이다.

    Request.Outcome                             요청한 관찰자에게만
        accepted 인가 refused 인가
        어느 Rule 이 판정했는가
        refused 라면 무슨 사유인가 — Rule 이 이미 내던 사유 코드 그대로
        요청에 실려 온 Request.Mark

        관찰되지 않는 것: 남의 요청과 그 대답. 세계가 무엇을 판정했는지는
        지금까지대로 관찰 결과에서 드러난다 (INTENT-PER-OBSERVER-PROJECTION-001).

    Actor.Id                                    REUSED — 이미 관찰된다
        지목 수단. 관찰자가 무엇을 지목할 수 있는지 알려면 이것이 보여야 한다.

    Actor 의 모든 속성                            REUSED — 이미 관찰된다 (C007 R2)
        명령으로 바뀐 값의 결과가 여기서 보인다.

    OBSERVABLE CLOSURE
        RULE-ATTRIBUTE-SET-001 의 판단에 쓰이는 것이 모두 관찰된다.
            DebugAuthority.Open        → Command.Availability + FailureReason
            대상이 세계에 있는가        → 관찰 결과의 entity 목록 (Actor.Id)
            속성이 목록에 있는가        → CommandCatalog 의 attribute 선택지
            값이 범위 안인가            → CommandCatalog 의 그 선택지가 정한 Domain
            그리고 판정 결과 자체        → Request.Outcome
        네 Precondition 모두 걸기 전에 관찰할 수 있고, 걸린 뒤에는 사유로 돌아온다.

## SEMANTIC CLOSURE

    INTENT-COMMAND-CATALOG-001
        "세계는 걸 수 있는 명령을 밝힌다"          → World.CommandCatalog (관찰됨)
        "무엇을 하는지"                            → Command.Effect
        "무엇을 받는지"                            → Command.Parameters + Parameter.Domain
        "어디까지 허용되는지"                      → Domain 의 하한·상한·선택지
        "관찰하는 쪽이 지어내지 않는다"            → Authority = World
        "명령이 더해지면 항목이 하나 더 나타난다"  → Command 목록이 열린 목록이며
                                                     구조는 항목 수와 무관하다
        "걸 수 있는 것은 언제나 먼저 밝혀져 있다"  → 목록은 관찰 결과에 늘 실린다.
                                                     걸어 보아야 알게 되는 것이 없다

    INTENT-COMMAND-INVOKE-001
        "목록에 있는 것 하나를 고른다"             → Command.Id
        "받기로 한 대상과 값을 싣는다"             → Parameters
        "목록에 없는 것은 걸 수 없다"              → 알 수 없는 명령은 거절되고
                                                     그 사유가 돌아온다 (unknown-command)
        "세계가 판정한다"                          → RULE-ATTRIBUTE-SET-001 (REUSED)

    INTENT-REQUEST-REPLY-001
        "요청 하나하나에 대답한다"                 → RULE-REQUEST-REPLY-001
        "받아들였는지 거절했는지"                  → Request.Outcome.accepted
        "어느 판정에서 걸렸는지"                   → Request.Outcome.rule + reason
        "보낸 이에게만 간다"                       → 관찰자별 산출 (Observer.Id 귀속)
        "세계의 상태를 알려 주는 것이 아니다"      → Transition 없음.
                                                     상태는 관찰 결과로만 드러난다

    INTENT-REPLY-CORRESPONDENCE-001
        "어느 요청에 대한 것인지 짚을 수 있다"     → Request.Mark 가 그대로 돌아온다
        "연달아 걸어도 섞이지 않는다"              → 한 Tick 의 대답이 여럿이어도
                                                     각자 자기 Mark 를 지닌다

    INTENT-ENTITY-ADDRESSABLE-001
        "존재를 서로 구별해 부른다"                → Actor.Id (REUSED, 겹치지 않는다)
        "무엇을 지목했는지 분명하다"               → Actor.Id 가 관찰 결과에 실려 있다
        "지목하지 않으면 자기 몸"                  → Parameter.OmittedMeaning
                                                     (RULE-ATTRIBUTE-SET-001 이 이미 그렇게 한다)

    WORLD CHANGE: NONE — 아래 셋은 세계의 의미가 아니다.

    INTENT-COMMAND-DISCOVER-001
        세계가 할 일은 밝히는 것까지이며 그것은 World.CommandCatalog 로 닫혔다.
        목록을 어떻게 펼쳐 보이는지는 GameView Specification 의 일이다.

    INTENT-COMMAND-GUIDED-001
        후보를 좁히고 무엇을 더 적어야 하는지 보이는 것은 관찰자가 CommandCatalog 를
        읽어서 하는 일이다 — 세계는 그것을 모른다.
        다만 "목록에 없는 이름" 과 "범위 밖의 값" 이 서로 다른 잘못이라는 것은
        세계가 이미 사유 코드로 구분한다 (unknown-attribute · value-out-of-range).
        그 둘은 걸리기 전에 CommandCatalog 로도 알 수 있고,
        걸린 뒤에는 Request.Outcome 으로 돌아온다.

    INTENT-COMMAND-HISTORY-001
        관찰자가 쥐는 기록이다. 세계는 누가 무엇을 걸었는지 기억하지 않는다
        (RULE-REQUEST-REPLY-001 Transition 없음).

    INTENT-OBSERVER-COMMAND-001
        세계로 오지 않는다. 세계는 그런 것이 걸렸다는 사실조차 알지 못한다.
        충돌체 관찰값과 속성 관찰값은 이미 언제나 나가고 있다 (C006 · C007 R2) —
        보일지 말지는 관찰자의 결정이며 이번에도 그렇다.

## NOTES

    이 Cycle 이 World State 를 하나도 더하지 않는다는 것이 판정 결과다.
    더해지는 것은 세계의 성질 하나(CommandCatalog)와, 이미 나오고 있었으나
    버려지던 것을 내보내는 일(Request.Outcome) 뿐이다.

    C007 R2 는 "받아들여지지 않은 요청은 그 이유를 남긴다" 라고 적었고 실제로
    각 Rule 은 사유를 담은 Result 를 내고 있었다. 그것을 받아 갈 곳이 없었을 뿐이다.
    이번 Cycle 은 없던 판정을 만드는 것이 아니라 이미 있던 판정이 닿게 한다.
