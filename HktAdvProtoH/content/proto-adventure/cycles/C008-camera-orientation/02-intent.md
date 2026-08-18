# C008 — Intent

## GOAL / POSSIBILITY
    GOAL-VIEWPOINT-CHOSEN           관찰자는 세계를 자신이 고른 방향에서 본다
        └── POSSIBILITY-TURN-VIEW       시점을 돌려 보는 방향을 바꾼다

    GOAL-MOVE-BY-SIGHT              주체는 자신이 보고 있는 쪽으로 나아간다
        └── POSSIBILITY-VIEW-RELATIVE-MOVE
                                        보는 방향을 세계의 방향으로 옮겨 그리로 가기를 요청한다

    GOAL-FACING-LEGIBLE             몸이 향한 방향은 그 몸의 그림에서 읽힌다
        └── POSSIBILITY-FACING-PROJECTED
                                        몸 방향을 시점에서 본 좌우로 환산해 그림을 그 쪽으로 보인다

    GOAL-STRIKE-PREDICTABLE         휘두름이 어디로 나갈지는 보이는 그림만으로 예측된다
        └── POSSIBILITY-IMAGE-FROM-FACING
                                        그림이 몸 방향에서 유도되므로 보이는 쪽이 곧 맞는 쪽이다

## INTENT SET
    INTENT-VIEWPOINT-ORIENT-001

        세계를 관찰하는 자는 바라보는 방향을 가진다 —
        수평으로 도는 각과 위아래로 기우는 각.

        관찰자는 그 두 각을 바꿀 수 있고,
        바꾼 방향은 다시 바꾸기 전까지 그대로 유지된다 — 저절로 되돌아가지 않는다.
        기우는 각은 세계가 뒤집혀 보이지 않도록 위아래 한계 안에 머문다.

        이 방향은 관찰자의 것이지 세계의 상태가 아니다.
        다른 관찰자는 내가 어디를 보고 있는지 알지 못하며,
        내가 어디를 보든 세계에서 일어나는 일은 달라지지 않는다.

    INTENT-VIEWPOINT-FOLLOW-001

        관찰자의 시점은 자신의 몸을 두고 그 주위를 돈다.
        방향을 어떻게 돌리든 자신의 몸은 관찰 범위 안에 남는다.

        보는 방향의 변화는 이어져 있다 —
        한 순간에 다른 방향으로 건너뛰지 않고 지나온 방향을 거쳐 도달한다.
        시점은 지형의 표면 아래로 내려가지 않는다 — 땅속에서 세계를 보지 않는다.

    INTENT-MOVE-BY-VIEW-001

        나아가려는 주체에게 앞이란 세계의 고정된 축이 아니라
        그 주체를 보고 있는 관찰자가 향한 방향이다.

        앞은 관찰자가 보고 있는 쪽, 뒤는 그 반대, 좌우는 그 방향의 좌우다.
        관찰자가 시점을 돌리면 같은 뜻의 요청도 세계의 다른 방향이 된다.

        그렇게 정해진 방향은 세계의 방향으로 환산되어 요청되며,
        실제로 갈 수 있는지, 얼마나 갔는지, 무엇에 막혔는지는
        지금까지대로 세계가 정한다 — 관찰자의 방향은 요청의 기준일 뿐
        세계의 판정에 들어가지 않는다.

    INTENT-FACING-SCREEN-SIDE-001

        몸이 향한 방향은 관찰자의 시점에서 볼 때
        화면의 왼쪽 또는 오른쪽 중 한쪽으로 읽힌다.

        같은 몸이 같은 방향을 향하고 있어도 관찰자가 시점을 돌리면 반대쪽으로 읽힌다 —
        읽히는 좌우는 몸과 시점 사이의 관계이지 몸만의 성질이 아니다.

        몸이 시점의 정면이나 정후면을 향해 좌우 어느 쪽도 아닌 구간에서는
        직전에 읽힌 쪽을 유지한다 — 읽히는 방향이 매 순간 뒤바뀌지 않는다.

    INTENT-SPRITE-ORIENT-001

        존재의 그림에는 저마다 원래 향하고 있는 쪽이 있고,
        그 기준 방향은 존재의 종류마다 다르다.

        읽힌 좌우가 그 기준 방향과 다르면 그림은 좌우가 뒤집혀 보이고,
        같으면 원본 그대로 보인다.

        기준 방향은 그림의 성질이지 세계의 상태가 아니다 —
        세계는 몸이 어디를 향했는지까지만 알고, 그것을 무슨 그림으로 어느 쪽을 향해
        보일지는 보는 쪽이 정한다 (BOUNDARY RESOLVED 참조).

    INTENT-STRIKE-LEGIBLE-001

        휘두름이 나가는 방향은 지금까지대로 몸이 향한 방향이 정한다.
        그림에 보이는 좌우는 그 몸 방향에서 유도된 것이므로,
        관찰자는 그림만 보고 휘두름이 어느 쪽으로 나갈지 알 수 있다.

        방향이 그림을 정하는 것이지 그림이 방향을 정하지 않는다 — 이 순서는 뒤집히지 않는다.
        한 번 시작된 휘두름은 진행 중 방향을 바꾸지 않으므로,
        시작할 때 보인 그 쪽으로 끝까지 나간다.

## DESIGN TRACE
    INTENT-VIEWPOINT-ORIENT-001
        Source Goal         GOAL-VIEWPOINT-CHOSEN
        Source Possibility  POSSIBILITY-TURN-VIEW
    INTENT-VIEWPOINT-FOLLOW-001
        Source Goal         GOAL-VIEWPOINT-CHOSEN
        Source Possibility  POSSIBILITY-TURN-VIEW
    INTENT-MOVE-BY-VIEW-001
        Source Goal         GOAL-MOVE-BY-SIGHT
        Source Possibility  POSSIBILITY-VIEW-RELATIVE-MOVE
    INTENT-FACING-SCREEN-SIDE-001
        Source Goal         GOAL-FACING-LEGIBLE
        Source Possibility  POSSIBILITY-FACING-PROJECTED
    INTENT-SPRITE-ORIENT-001
        Source Goal         GOAL-FACING-LEGIBLE
        Source Possibility  POSSIBILITY-FACING-PROJECTED
    INTENT-STRIKE-LEGIBLE-001
        Source Goal         GOAL-STRIKE-PREDICTABLE
        Source Possibility  POSSIBILITY-IMAGE-FROM-FACING

## EXISTING INTENT DELTA
    REUSED
        INTENT-BODY-FACING-001       (C006) 몸 방향의 의미도, 그것이 정해지는 방식도 그대로다 —
                                     움직이면 그 방향을 향하고, 자율 존재는 겨눈 쪽을 향한다
        INTENT-ACTION-COLLIDER-001   (C006) 휘두름은 지금까지대로 몸 방향 앞에서 호를 그린다
        INTENT-MOVE-001              (C001·C002) 이동의 판정·도달·막힘은 그대로다.
                                     달라지는 것은 목적지가 어떻게 정해지는가뿐이다
        INTENT-COLLISION-OBSERVE-001 (C006) 몸 방향은 이미 관찰할 수 있다 —
                                     이번 Cycle 은 그 관찰값을 그림으로 옮긴다
    CHANGED
        없음 — 세계에서 참인 것은 하나도 바뀌지 않는다.
        이번 Cycle 이 바꾸는 것은 세계를 보는 방향과, 그 방향을 통해 읽히는 방식이다.
    AFFECTED
        INTENT-BODY-FACING-001       몸 방향이 처음으로 그림에 드러난다.
                                     의미는 그대로이나 이제 틀리면 눈에 보인다
        INTENT-NPC-AUTONOMY-001      자율 존재의 그림도 같은 규칙으로 뒤집힌다 —
                                     겨눈 쪽을 향해 몸을 돌린 것이 그림에서 읽힌다
        INTENT-SWING-IMPACT-001      휘두름이 닿는 자리와 그림이 보이는 쪽이 어긋나면
                                     그것이 곧 결함이다 — 검증 대상이 된다

## BOUNDARY RESOLVED
    01-cycle.md 의 BOUNDARY 가 남긴 질문 — 존재마다 다른 "원본 기준 방향" 을 누가 아는가.

        결정   그림의 성질이다. 세계는 알지 않는다.

        근거   세계는 몸이 어느 방향을 향했는지까지를 안다 — 그것이 휘두름을 정하기 때문이다.
               그림의 원본이 어느 쪽을 보고 있는지는 그 몸에 대한 사실이 아니라
               그 몸을 그리기로 한 그림에 대한 사실이며, 같은 존재를 다른 그림으로 바꾸면
               세계는 그대로인 채 이 값만 달라진다.
               세계가 이것을 알게 되면 세계가 그림을 알게 된다.

        결과   이번 Cycle 은 세계에 새로운 상태를 요구하지 않는다.
               읽는 데 필요한 두 가지 — 몸이 향한 방향과 관찰자의 시점 — 중
               앞의 것은 이미 관찰 계약에 있고, 뒤의 것은 관찰자 자신의 것이다.
               World Semantic 단계는 이 판단을 확인하고, 정말 REUSED 만으로
               INTENT 여섯이 닫히는지 검사한다. 닫히지 않으면 이 단계로 반환한다.
