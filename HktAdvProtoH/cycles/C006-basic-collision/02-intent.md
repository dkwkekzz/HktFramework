# C006 — Intent

## GOAL / POSSIBILITY
    GOAL-SPACE-EXCLUSIVE            존재들은 공간을 배타적으로 차지한 채 세계에 있다
        └── POSSIBILITY-BODY-PUSH       겹침이 생기면 몸끼리 서로 밀어내어 해소한다

    GOAL-FORCE-INTERACTION          행동이 힘이 되어 세계의 몸들에 작용한다
        └── POSSIBILITY-SWING-IMPACT    휘두름이 충돌 반경을 만들고, 닿은 몸에 충격을 전달한다

    GOAL-COLLISION-OBSERVABLE       세계의 모든 충돌체는 숨김없이 관찰될 수 있다
        └── POSSIBILITY-DEBUG-OBSERVE   관찰자가 디버그 관찰을 켜서 충돌체를 본다

## INTENT SET
    INTENT-BODY-OCCUPY-001 (R1 AMENDED — 몸은 부피다)

        세계의 모든 Actor 는
        반경과 높이와 질량을 가진 캡슐 부피의 몸으로 공간을 차지한다.
        서로 밀어내는 판정은 지면 평면에 투영된 원으로 한다 (충돌은 지면 평면 — 01 EXCLUDED).
        몸은 존재하는 동안 항상 참인 상태다 — 행동과 무관하게 사라지지 않는다.

    INTENT-BODY-PUSH-001

        두 Actor 의 몸이 겹쳐 있으면,
        세계는 시간이 진행될 때마다
        겹친 깊이만큼 두 몸을 서로 반대 방향으로 밀어낸다.
        두 몸이 주고받는 힘의 크기는 같고 방향은 반대이며 (뉴턴 제3법칙),
        각자가 밀려나는 정도는 자신의 질량에 반비례한다.

    INTENT-BODY-MOMENTUM-001

        힘을 받은 몸은 속도를 얻고,
        시간이 진행되는 동안 그 속도만큼 관성으로 움직이며 (뉴턴 제1·2법칙),
        지면 마찰로 속도가 점차 잦아들고,
        세계 경계를 넘어서는 밀려나지 않는다.

    INTENT-BODY-FACING-001 (R1 ADDED — Human Play 반환 반영)

        몸은 언제나 어느 한 방향을 향하고 있다.
        움직이면 움직이는 방향을 향하게 되고,
        자율 존재는 휘두르기 전에 겨눈 대상을 향해 몸을 돌린다.

    INTENT-ACTION-COLLIDER-001 (R1 CHANGED)

        행동은 자신의 종류에 따라 세계에 충돌체를 만들 수 있다.
        attack 의 휘두름은 몸 전체를 감싸는 반경이 아니라 —
        몸이 향한 방향 앞에서 칼끝이 지나가는 자리에 충돌체를 만들며,
        휘두름 구간 동안 그 충돌체가 호를 그리며 쓸고 지나간다.
        충돌체는 그것을 만든 행동이 끝나면 함께 사라진다.

    INTENT-SWING-IMPACT-001

        활성화된 휘두름 충돌체에 자신이 아닌 몸이 닿으면,
        그 몸은 타격당해 하던 행동이 중단되고 (기존 피격 반응),
        휘두른 몸에서 밀려나는 방향으로 충격량을 받아 밀쳐진다.
        하나의 휘두름은 같은 몸을 한 번만 타격한다.

    INTENT-COLLISION-OBSERVE-001

        관찰자는 세계에 존재하는 모든 충돌체 —
        모든 몸의 위치·반경과 모든 행동 충돌 반경의 위치·반경·활성 여부 — 를
        관찰할 수 있다.
        이 관찰은 확인용이며, 켜고 끄는 것은 관찰자의 선택이다.

## DESIGN TRACE
    INTENT-BODY-OCCUPY-001
        Source Goal         GOAL-SPACE-EXCLUSIVE
        Source Possibility  POSSIBILITY-BODY-PUSH
    INTENT-BODY-PUSH-001
        Source Goal         GOAL-SPACE-EXCLUSIVE
        Source Possibility  POSSIBILITY-BODY-PUSH
    INTENT-BODY-MOMENTUM-001
        Source Goal         GOAL-SPACE-EXCLUSIVE · GOAL-FORCE-INTERACTION
        Source Possibility  POSSIBILITY-BODY-PUSH · POSSIBILITY-SWING-IMPACT
    INTENT-ACTION-COLLIDER-001
        Source Goal         GOAL-FORCE-INTERACTION
        Source Possibility  POSSIBILITY-SWING-IMPACT
    INTENT-SWING-IMPACT-001
        Source Goal         GOAL-FORCE-INTERACTION
        Source Possibility  POSSIBILITY-SWING-IMPACT
    INTENT-COLLISION-OBSERVE-001
        Source Goal         GOAL-COLLISION-OBSERVABLE
        Source Possibility  POSSIBILITY-DEBUG-OBSERVE
    INTENT-BODY-FACING-001 (R1)
        Source Goal         GOAL-FORCE-INTERACTION
        Source Possibility  POSSIBILITY-SWING-IMPACT

## EXISTING INTENT DELTA
    REUSED
        INTENT-ATTACK-001           휘두름은 여전히 대상 없이 세계에 대고 한다 — 방향 의미를 새로 만들지 않는다
        INTENT-HIT-REACTION-001     피격 반응(행동 중단)은 그대로 — 충격량이 더해질 뿐이다
        INTENT-ACTION-PROGRESS-001  충돌 반경의 활성 구간은 기존 행동 진행 시간 위에 정의된다
    CHANGED
        INTENT-ATTACK-HIT-001
            기존  휘두름이 끝나는 순간의 위치·반경으로 한 번에 판정한다
            변경  휘두름 진행 중 활성화된 충돌 반경에 닿는 시점마다 판정한다 —
                  무엇이 맞는지는 완료 순간이 아니라 접촉이 정한다
    AFFECTED
        INTENT-MOVE-001             이동으로 정한 위치도 몸 밀어냄·경계의 영향을 받는다
        INTENT-NPC-AUTONOMY-001     배회·접근 이동 역시 같은 몸 규칙 아래 놓인다
