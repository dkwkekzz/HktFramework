# CYCLE C001 — Intent

## GOAL / POSSIBILITY
    GOAL-RESOURCE-ACQUIRE-STONE
        Actor 가 Stone 을 보유한 상태에 도달한다.
        └── POSSIBILITY-MINE-STONE
            Stone Deposit(광맥)에 접근하여 Mining 가능한 Tool 로 캐서 획득한다.
            └── POSSIBILITY-REACH-DEPOSIT
                세계 안에서 이동하여 Deposit 에 접근한다. (POSSIBILITY-MINE-STONE 의 전제 경로)

## INTENT SET
    INTENT-MOVE-001

        세계에 위치를 가진 Actor 는

        세계 안의 도달 가능한 지점으로 이동을 수행하여

        자신의 위치를 시간에 걸쳐 그 지점까지 옮길 수 있다.

    INTENT-MINING-001

        Stone Deposit 의 위치를 알고 있고,
        Mining 가능한 Tool(곡괭이)을 보유하고 있으며,
        Deposit 에 접근해 있는(상호작용 가능한 거리) Actor 는

        Mine 을 수행하여

        Deposit 의 잔여 자원을 1 감소시키고
        자신의 Inventory 에 Stone 1개를 획득할 수 있다.

        잔여 자원이 없는 Deposit 에서는 획득할 수 없고,
        Tool 이 없거나 거리가 멀면 Mine 은 수행되지 않으며 그 사유를 알 수 있다.

## DESIGN TRACE
    INTENT-MOVE-001
        Source Goal         GOAL-RESOURCE-ACQUIRE-STONE
        Source Possibility  POSSIBILITY-REACH-DEPOSIT
    INTENT-MINING-001
        Source Goal         GOAL-RESOURCE-ACQUIRE-STONE
        Source Possibility  POSSIBILITY-MINE-STONE

## EXISTING INTENT DELTA
    REUSED   없음 — 첫 Cycle
    CHANGED  없음
