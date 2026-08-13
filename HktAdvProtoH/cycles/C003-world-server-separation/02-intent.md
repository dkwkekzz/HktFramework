# CYCLE C003 — Intent

## GOAL / POSSIBILITY
    GOAL-WORLD-EXISTS-INDEPENDENTLY
        세계는 그것을 보고 있는 화면과 별개로 존재하고 진행한다.
        ├── POSSIBILITY-WORLD-OWN-CLOCK
        │     세계가 자기 시계로 시간을 진행시킨다 — 아무도 보고 있지 않아도.
        ├── POSSIBILITY-OBSERVE-FROM-OUTSIDE
        │     관찰자는 세계 밖에서 이어 붙어 관찰 결과를 받아 본다.
        └── POSSIBILITY-REQUEST-FROM-OUTSIDE
              관찰자는 행동을 요청으로 보내고, 판정은 세계 쪽에서 일어난다.

    GOAL-OBSERVER-KNOWS-ITS-LINK
        관찰자는 자신이 지금 세계와 이어져 있는지 알 수 있다.
        └── POSSIBILITY-LINK-STATE
              이어짐 · 잇는 중 · 끊김 이 관찰자에게 드러나고, 끊기면 다시 이을 수 있다.

## INTENT SET
    INTENT-WORLD-CLOCK-001

        세계는 자신의 시계를 가지며

        관찰자가 있든 없든, 관찰자가 보고 있든 아니든
        그 시계로 시간을 진행시킨다.

        세계가 시작된 뒤 흐른 시간은 관찰 가능하며,
        그 값으로 관찰자는 세계가 자기 화면과 무관하게 진행했음을 알 수 있다.

    INTENT-WORLD-OBSERVATION-001

        세계는 자신의 진행에 맞추어

        그 시점의 관찰 결과를 관찰자에게 내보낸다.

        관찰자는 세계 내부를 직접 읽지 않는다 —
        받은 관찰 결과만이 관찰자가 세계에 대해 아는 전부다.

    INTENT-REMOTE-REQUEST-001

        관찰자는 행동을 요청으로 세계에 보낸다.

        요청은 보내는 즉시 세계가 되지 않는다.
        세계가 그 요청을 받아 자신의 규칙으로 판정하고,
        판정의 결과는 그 뒤에 오는 관찰 결과에서 드러난다.

        따라서 관찰자가 보는 세계는 언제나 조금 이전의 세계이며,
        자신의 요청이 받아들여졌는지도 관찰 결과로만 알 수 있다.

    INTENT-OBSERVER-LINK-001

        관찰자는 자신과 세계 사이의 이어짐 상태를 안다 —
        이어짐 · 잇는 중 · 끊김.

        끊긴 동안 관찰자는 마지막으로 받은 세계를 계속 보되
        그것이 현재가 아닐 수 있음을 알며, 요청을 보낼 수 없다.

        다시 이어지면 최신 관찰 결과를 받아 현재의 세계로 돌아온다.

        이 상태는 세계의 상태가 아니라 관찰자 쪽의 상태다 —
        세계는 누가 자신을 보고 있는지에 따라 달라지지 않는다.

## DESIGN TRACE
    INTENT-WORLD-CLOCK-001
        Source Goal         GOAL-WORLD-EXISTS-INDEPENDENTLY
        Source Possibility  POSSIBILITY-WORLD-OWN-CLOCK
    INTENT-WORLD-OBSERVATION-001
        Source Goal         GOAL-WORLD-EXISTS-INDEPENDENTLY
        Source Possibility  POSSIBILITY-OBSERVE-FROM-OUTSIDE
    INTENT-REMOTE-REQUEST-001
        Source Goal         GOAL-WORLD-EXISTS-INDEPENDENTLY
        Source Possibility  POSSIBILITY-REQUEST-FROM-OUTSIDE
    INTENT-OBSERVER-LINK-001
        Source Goal         GOAL-OBSERVER-KNOWS-ITS-LINK
        Source Possibility  POSSIBILITY-LINK-STATE

## EXISTING INTENT DELTA
    REUSED
        INTENT-ACTION-STATE-001 · INTENT-ACTION-EXCLUSIVE-001 ·
        INTENT-ATTACK-001 · INTENT-CHARACTER-KIND-001 · INTENT-MOTION-OBSERVE-001
        — 행동의 의미는 하나도 바뀌지 않는다.

    CHANGED
        INTENT-MOVE-001 (C001) · INTENT-ACTION-PROGRESS-001 (C002)
            BEFORE  "시간에 걸쳐" 진행한다 — 시간을 흘려보내는 주체가 명시되지 않았고,
                    실제로는 관찰자의 화면이 매 프레임 세계를 진행시켰다.
            AFTER   시간을 흘려보내는 주체는 세계 자신이다 (INTENT-WORLD-CLOCK-001).
                    관찰자가 없어도, 화면이 멈춰 있어도 행동은 진행되고 끝난다.
            Reason  GOAL-WORLD-EXISTS-INDEPENDENTLY —
                    세계가 화면에 종속되어 있으면 "세계"가 아니라 화면의 일부다.
            Note    Precondition · Transition · Result 는 그대로다.

        INTENT-NPC-AUTONOMY-001 (C002)
            BEFORE  자율 캐릭터가 스스로 행동을 선택한다.
            AFTER   위와 같되, 그 선택은 관찰자와 무관하게 계속 일어난다 —
                    아무도 보고 있지 않은 동안에도 NPC 는 자기 길을 간다.
            Reason  INTENT-WORLD-CLOCK-001
