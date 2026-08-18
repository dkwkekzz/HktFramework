# CYCLE C005 — World Semantic

## SEMANTIC DELTA
    REUSED
        World.Bounds · World.Actors · World.Deposits · World.Time · World.Observers
        Observer.Id · Observer.ActorId · Observer.Present
        Actor 의 모든 State
        RULE-MOVE-001 · RULE-MOVE-PROGRESS-001 · RULE-MINE-001 · RULE-MINE-COMPLETE-001 ·
        RULE-ATTACK-001 · RULE-ATTACK-COMPLETE-001 · RULE-HIT-001 ·
        RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001 · RULE-NPC-DECIDE-001 ·
        RULE-OBSERVER-JOIN-001 · RULE-OBSERVER-LEAVE-001
        — 이번 Cycle 은 게임 판정을 하나도 바꾸지 않는다.

    ADDED
        Observer.AcknowledgedMark     그 관찰자에게서 받아들인 마지막 표식
        RULE-OBSERVER-MARK-001        표식을 받아들이는 법칙

    CHANGED
        RULE-WORLD-TICK-001
            Transition 0 이 참여/이탈에 더해 표식도 처리한다.
            도착한 순서대로 처리하므로, 같은 Tick 에 들어온 참여 → 표식 순서가 유지된다.

        Observer Projection
            그 관찰자의 관찰 결과에 Observer.AcknowledgedMark 가 실린다.
            다른 관찰자의 표식은 실리지 않는다 (INTENT-PER-OBSERVER-PROJECTION-001).

    AFFECTED
        없음.
        표식은 어떤 게임 Rule 의 Precondition 도, Transition 도 건드리지 않는다.
        Actor · Deposit · World.Time 은 표식과 무관하게 움직인다.
        C001~C004 의 모든 플레이 Scenario 는 그대로 성립해야 한다 (Regression).

## WORLD STATE
    Observer
        Id                  World Authority                                   [REUSED]
        ActorId             World Authority                                   [REUSED]
        Present             World Authority                                   [REUSED]
        AcknowledgedMark    World Authority — 이 관찰자에게서 받아들인 마지막 표식 [ADDED]
                            관찰자가 매기지만, 무엇을 받아들였는지는 세계가 정한다.
                            처음 참여할 때 0 으로 시작한다.
                            뒤로 가지 않는다 — 늦게 도착한 옛 표식은 무시된다.

    표식은 게임 상태가 아니다.
    세계의 물건 · 몸 · 시간 중 어느 것도 표식 때문에 달라지지 않는다.
    세계가 표식으로 하는 일은 "너에게서 여기까지 받았다"를 그 관찰자에게 되돌리는 것뿐이다.

    이어짐의 품질(왕복 시간 · 도착률 · 보낸 양 · 다시 이은 횟수)은 World State 가 아니다.
    세계는 관찰자와 자신 사이가 얼마나 잘 통하는지 모른다 — 알 필요도 없다.
    그것은 관찰자 쪽이 자기 시계로 재는 것이며, GameView Specification 의
    session/telemetry 절이 그 의미의 소유자를 관찰자 쪽으로 규정한다 (C003 의 방식 그대로).

## WORLD RULE
    RULE-OBSERVER-MARK-001                                                [ADDED]
        Implements     INTENT-OBSERVER-MARK-001
        Input          표식이 도착한 이어짐의 관찰자, 그 관찰자가 붙인 표식 값
        Preconditions  1. 세계가 아는 관찰자다
                       2. 표식이 유한한 수다
                       3. 표식이 지금까지 받아들인 것보다 크다
        Transition     Observer.AcknowledgedMark = 표식
        Result         Success | Failure(unknown-observer) | Failure(stale-mark)

        게임 상태를 바꾸지 않는다. 어떤 행동 Rule 에도 위임하지 않는다.
        모르는 관찰자의 표식은 아무것도 바꾸지 못한다 —
        요청과 같은 규율이다 (INTENT-REQUEST-ATTRIBUTION-001).

    RULE-OBSERVER-JOIN-001                                                [CHANGED]
        첫 참여로 만들어지는 Observer 의 AcknowledgedMark 는 0 이다.
        재참여는 AcknowledgedMark 를 되돌리지 않는다 —
        같은 관찰자가 이어 온 것이므로 세계가 받아들인 자리도 이어진다.
        그 밖의 Transition 은 C004 그대로다.

    RULE-WORLD-TICK-001                                                   [CHANGED]
        Implements     INTENT-WORLD-CLOCK-001 · INTENT-PER-OBSERVER-PROJECTION-001
        Input          경과 시간 dt, 도착해 있는 참여/이탈/표식, 도착해 있는 Action Request 들
        Preconditions  없음 — 세계는 언제나 진행한다
        Transition     0. 도착한 참여/이탈/표식을 도착 순서대로 처리한다
                          (RULE-OBSERVER-JOIN-001 · RULE-OBSERVER-LEAVE-001 ·
                           RULE-OBSERVER-MARK-001)
                       1~5. C004 그대로
        Result         Observations — Present 인 관찰자 각각의 Observer Projection

        표식이 요청보다 앞서 처리되는 이유: 같은 Tick 에 "요청 + 그 뒤의 표식"이 함께
        도착했을 때, 그 표식이 그 요청까지 포함한다고 관찰자가 믿을 수 있어야 한다.
        관찰자는 언제나 요청을 보낸 뒤에 표식을 붙이므로, 세계가 표식을 먼저 받아들여도
        같은 Tick 안에서 그 요청도 함께 판정된다 — 두 값이 같은 관찰 결과로 나간다.

## OBSERVABLE SEMANTIC
    Observer.AcknowledgedMark           [ADDED] 세계가 나에게서 받아들인 마지막 표식.
                                        그 관찰자의 관찰 결과에만 실린다.
    (C001~C004 의 Observable 전부)       [REUSED] 변경 없음

    관찰되지 않는 것
        다른 관찰자의 AcknowledgedMark — 표식은 그 관찰자와 세계 사이의 일이다.
        표식 실패 사유(unknown-observer · stale-mark) — 세계 안의 누구에게도
        의미가 없다. 관찰자는 받아들여진 자리가 그대로인 것으로 알 수 있다.
        세계가 표식을 받은 시각 — 세계의 시계와 관찰자의 시계는 다른 시계다.
        둘을 맞추는 것은 이번 Cycle 의 의미가 아니며, 왕복은 관찰자 쪽 시계
        하나만으로 재진다 (보낸 시각과 돌아온 시각 모두 관찰자의 시계다).

## SEMANTIC CLOSURE
    INTENT-OBSERVER-MARK-001
        "표식을 붙일 수 있다"              → RULE-OBSERVER-MARK-001 Input
        "뒤로 가지 않는다"                 → Precondition 3 (지금까지보다 커야 한다)
        "받아들인 마지막 표식을 기억한다"  → Observer.AcknowledgedMark (World Authority)
        "관찰 결과에 실어 되돌린다"        → Observable: 그 관찰자의 Projection
        "게임에서 아무것도 바꾸지 않는다"  → Transition 이 Observer 한 줄뿐이고
                                             어떤 행동 Rule 에도 위임하지 않는다
        "늦게 온 옛 표식은 되돌리지 않는다"→ Failure(stale-mark), 상태 변화 없음

    INTENT-LINK-ROUNDTRIP-001
        "보낸 시각을 안다"                 → 관찰자 쪽 (World 밖)
        "돌아온 시각을 안다"               → 관찰자 쪽 (World 밖)
        "걸린 시간을 알 수 있다"           → 두 시각의 차. 세계가 관여하지 않는다.
        "인과의 왕복이다"                  → 표식은 RULE-WORLD-TICK-001 Transition 0 에서
                                             받아들여지고 같은 Tick 의 Result 로 나간다.
                                             즉 돌아온 표식은 "그 Tick 까지 세계가
                                             판정을 마쳤다"는 뜻이다.
        "게임 요청 없이도 잴 수 있다"      → 표식은 Action Request 가 아니다.
                                             독립된 도착물이며 자기 Rule 을 갖는다.

    INTENT-LINK-FLOW-001
        "얼마나 자주 오는지"               → 관찰자 쪽. 세계는 자기 Tick 마다 내보낼 뿐이다.
        "마지막으로 온 지 얼마나"          → 관찰자 쪽 (C003 의 조용히 죽은 이어짐 판정과
                                             같은 값을 쓴다)
        "사이의 일이다"                    → World State 에 두지 않는 이유. 세계는
                                             관찰자가 받았는지 모른다.

    INTENT-LINK-EFFORT-001
        "얼마나 보내고 있는지"             → 관찰자 쪽 (자기가 보낸 것을 자기가 센다)
        "몇 번 다시 이었는지"              → 관찰자 쪽 (이어짐은 관찰자 쪽 상태다 — C003)

    INTENT-LINK-BINDING-VISIBLE-001
        "누구로서"                         → Observer.Id (C004, 이미 관찰된다)
        "어느 몸으로"                      → Observer.ActorId (C004, 이미 관찰된다)
        "어느 세계에"                      → 관찰자 쪽 (자신이 붙은 주소를 자신이 안다)
        "새로 만들지 않고 보이게 한다"     → World 에 추가되는 것이 없다.
                                             GameView Specification 과 View 의 일이다.

    INTENT-LINK-ALWAYS-SHOWN-001
        "언제나 보인다"                    → 표시 규칙이므로 World 밖이다.
                                             GameView Specification 이 규정한다.

    CLOSURE 판정   PASS
                   Intent 6종 중 World 가 책임지는 것은 INTENT-OBSERVER-MARK-001 하나이며
                   State 1 · Rule 1 로 닫힌다. 나머지 5종은 관찰자 쪽 의미이며
                   GameView Specification 의 session/telemetry 절이 소유자를 규정한다
                   (C003 이 INTENT-OBSERVER-LINK-001 을 다룬 방식과 같다).
                   닫히지 않은 문장 없음.

    OBSERVABLE CLOSURE 판정   PASS
                   RULE-OBSERVER-MARK-001 의 판단 근거(받아들인 자리)가
                   Observer.AcknowledgedMark 로 관찰된다.
                   실패 사유를 관찰하지 않는 이유는 위 OBSERVABLE SEMANTIC 에 적었다 —
                   관찰자는 받아들여진 자리가 그대로인 것으로 실패를 안다.
