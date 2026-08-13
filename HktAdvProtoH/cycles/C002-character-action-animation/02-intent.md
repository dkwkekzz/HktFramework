# CYCLE C002 — Intent

## GOAL / POSSIBILITY
    GOAL-CHARACTER-BEHAVIOR-OBSERVABLE
        세계의 모든 캐릭터는 매 순간 하나의 행동 안에 있고,
        그 행동이 무엇이며 얼마나 진행되었는지가 세계에 드러난다.
        ├── POSSIBILITY-ACT-BY-COMMAND
        │     플레이어가 자기 캐릭터에게 행동을 요청하여 행동을 시작시킨다.
        ├── POSSIBILITY-ACT-BY-SELF
        │     스스로 판단하는 캐릭터가 자신의 상황을 근거로 행동을 선택한다.
        ├── POSSIBILITY-ACT-OVER-TIME
        │     시작된 행동은 시간에 걸쳐 진행되고, 끝나면 대기 행동으로 돌아간다.
        └── POSSIBILITY-ACT-AS-MOTION
              캐릭터의 행동은 그 캐릭터가 가진 모션으로 관찰된다.

    GOAL-CHARACTER-VARIETY
        세계에는 종류가 다른 캐릭터들이 함께 존재하고,
        같은 행동이라도 종류마다 다른 모습으로 관찰된다.
        └── POSSIBILITY-KIND-DEFINED-MOTION
              캐릭터 종류가 재생할 수 있는 모션은 미리 고정된 것이 아니라,
              그 종류에 대해 주어진 모션이 있는 만큼 관찰된다.

## INTENT SET
    INTENT-ACTION-STATE-001

        세계에 존재하는 모든 캐릭터는

        언제나 정확히 하나의 현재 행동 안에 있으며

        아무 행동도 수행하고 있지 않을 때에도
        "대기"라는 행동 안에 있는 것으로 관찰된다.

    INTENT-ACTION-PROGRESS-001

        현재 행동 안에 있는 캐릭터는

        시간이 흐르는 동안 그 행동을 진행시켜

        행동마다 정해진 소요 시간만큼 진행되면 그 행동을 끝내고
        대기 행동으로 돌아간다.

        행동의 진행 정도는 세계에서 관찰 가능하다.
        소요 시간이 정해지지 않은 행동(대기 · 이동)은 스스로 끝나지 않고,
        다른 행동이 시작되거나 그 행동의 목적이 달성될 때 끝난다.

    INTENT-ACTION-EXCLUSIVE-001

        행동에는 다른 행동으로 대체될 수 있는 것과 없는 것이 있다.

        대기와 이동은 언제든 새 행동으로 대체된다.
        공격과 채굴은 진행 중인 동안 다른 행동으로 대체되지 않으며,

        그 동안 들어온 다른 행동 요청은 수행되지 않고
        수행되지 않은 사유를 알 수 있다.

    INTENT-ATTACK-001

        대상 캐릭터를 인지하고 있고
        그 대상이 공격 가능한 거리 안에 있으며
        지금 대체 불가능한 행동 중이 아닌 캐릭터는

        공격을 수행하여

        정해진 시간 동안 그 대상을 향한 공격 행동 안에 들어가고,
        시간이 끝나면 공격을 마치고 대기로 돌아간다.

        대상이 없거나 거리가 멀면 공격은 시작되지 않으며 그 사유를 알 수 있다.
        (공격이 대상에게 무엇을 하는가 — 피해 · 사망 — 는 이번 Cycle 의 의미가 아니다.)

    INTENT-NPC-AUTONOMY-001

        플레이어가 조종하지 않고 스스로 판단하는 캐릭터는

        자신의 인지 범위와 현재 상황을 근거로 다음 행동을 스스로 선택하여

        인지 범위 안에 다른 캐릭터가 있으면 그쪽으로 향하고
        공격 가능한 거리에 이르면 공격하며,
        인지 범위 안에 아무도 없으면 세계 안을 스스로 돌아다닌다.

        대체 불가능한 행동 중에는 새로운 선택을 하지 않는다.

        인지 범위는 캐릭터가 가진 세계의 의미이며,
        캐릭터마다 다를 수 있다.

    INTENT-CHARACTER-KIND-001

        세계의 각 캐릭터는 자신이 어떤 종류의 존재인지를 가지며

        그 종류는 캐릭터가 관찰될 때 함께 드러나

        같은 행동을 하더라도 종류가 다르면 다른 모습으로 관찰될 수 있다.

    INTENT-MOTION-OBSERVE-001

        캐릭터의 종류와 현재 행동, 그리고 그 행동의 진행 정도를 아는 관찰자는

        그 종류가 그 행동에 대해 가진 모션을 진행 정도에 맞추어 재생하여

        캐릭터가 지금 무엇을 하고 있는지를 화면에서 구분할 수 있다.

        어떤 종류가 어떤 행동에 대한 모션을 가지고 있지 않다면
        그 캐릭터는 여전히 관찰되지만 그 행동은 대신할 수 있는 모습으로 표현된다.
        모션이 몇 종류 존재하는지는 세계의 규칙이 아니라 주어진 데이터가 정한다.

## DESIGN TRACE
    INTENT-ACTION-STATE-001
        Source Goal         GOAL-CHARACTER-BEHAVIOR-OBSERVABLE
        Source Possibility  POSSIBILITY-ACT-BY-COMMAND · POSSIBILITY-ACT-BY-SELF
    INTENT-ACTION-PROGRESS-001
        Source Goal         GOAL-CHARACTER-BEHAVIOR-OBSERVABLE
        Source Possibility  POSSIBILITY-ACT-OVER-TIME
    INTENT-ACTION-EXCLUSIVE-001
        Source Goal         GOAL-CHARACTER-BEHAVIOR-OBSERVABLE
        Source Possibility  POSSIBILITY-ACT-OVER-TIME
    INTENT-ATTACK-001
        Source Goal         GOAL-CHARACTER-BEHAVIOR-OBSERVABLE
        Source Possibility  POSSIBILITY-ACT-BY-COMMAND · POSSIBILITY-ACT-BY-SELF
    INTENT-NPC-AUTONOMY-001
        Source Goal         GOAL-CHARACTER-BEHAVIOR-OBSERVABLE
        Source Possibility  POSSIBILITY-ACT-BY-SELF
    INTENT-CHARACTER-KIND-001
        Source Goal         GOAL-CHARACTER-VARIETY
        Source Possibility  POSSIBILITY-KIND-DEFINED-MOTION
    INTENT-MOTION-OBSERVE-001
        Source Goal         GOAL-CHARACTER-BEHAVIOR-OBSERVABLE · GOAL-CHARACTER-VARIETY
        Source Possibility  POSSIBILITY-ACT-AS-MOTION · POSSIBILITY-KIND-DEFINED-MOTION

## EXISTING INTENT DELTA
    REUSED
        없음 — 아래 두 Intent 는 모두 이번 Cycle 에서 의미가 확장된다.

    CHANGED
        INTENT-MOVE-001 (C001)
            BEFORE  Actor 는 도달 가능한 지점으로 이동을 수행하여
                    자신의 위치를 시간에 걸쳐 그 지점까지 옮길 수 있다.
            AFTER   위와 같되, 이동은 캐릭터의 현재 행동 중 하나다.
                    이동을 시작하면 캐릭터는 "이동" 행동 안에 들어가고
                    목적지에 도달하면 이동을 끝내고 대기로 돌아간다.
            Reason  INTENT-ACTION-STATE-001 — 모든 캐릭터는 언제나 하나의 행동 안에 있다.

        INTENT-MINING-001 (C001)
            BEFORE  조건을 만족한 Actor 가 Mine 을 수행하면
                    즉시 Deposit 의 자원이 1 줄고 Stone 1개를 획득한다.
            AFTER   조건을 만족한 Actor 가 Mine 을 수행하면
                    정해진 시간 동안 "채굴" 행동 안에 들어가고,
                    그 시간을 끝까지 채웠을 때 Deposit 의 자원이 1 줄고 Stone 1개를 획득한다.
                    채굴 조건은 시작 시점에 판정되며 사유를 알 수 있다는 점은 그대로다.
            Reason  INTENT-ACTION-PROGRESS-001 · INTENT-ACTION-EXCLUSIVE-001 —
                    채굴도 관찰 가능한 하나의 행동이어야 모션으로 표현된다.
            Note    획득이라는 결과 자체는 보존된다 — C001 의 플레이는 여전히 성립한다.
