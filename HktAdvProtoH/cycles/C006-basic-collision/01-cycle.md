# CYCLE C006 — Basic Collision

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review    APPROVED
[PASS] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## TYPE
    New Capability    공간 점유·충돌이라는 새 세계 규칙 (기존 Attack/Move 는 이 규칙의 영향을 받는다)

## TARGET CAPABILITY
    Collision (공간 점유 · 밀어냄 · 행동 충돌 반경)

## GOAL
    플레이어는 다른 존재와 같은 자리에 겹쳐 설 수 없고 —
    몸을 맞대면 서로 뉴턴 법칙대로 밀려나며,
    휘두름이 만드는 충돌 반경에 맞은 상대는 그 힘만큼 밀쳐진다.
    이 모든 충돌체는 디버그 관찰을 켜면 눈으로 확인할 수 있다.

## INCLUDED
    공간 점유            모든 Actor 는 반경을 가진 원으로 공간을 차지한다
    몸 밀어냄            겹친 두 몸은 질량 비례로 서로를 밀어낸다 (뉴턴 제3법칙)
    운동량과 감쇠        밀린 몸은 속도를 얻고, 속도는 마찰로 잦아든다
    행동 충돌 반경       attack 의 휘두름(swing)이 진행 구간 동안 충돌 반경을 만든다
    타격 충격량          휘두름 충돌 반경에 닿은 몸은 충격량을 받아 밀쳐진다
    디버그 관찰          몸 충돌체·행동 충돌 반경 전부를 View 에서 켜고 끄며 볼 수 있다

## EXCLUDED
    발사체               새 행동 추가는 다음 Cycle — 이번엔 충돌 반경 구조가 발사체를 담을 수 있게만 설계한다
    지형·장애물 충돌     지형은 지금처럼 경계(WorldBounds)만 막는다
    피해량·체력          맞으면 밀쳐지고 hit 반응만 — 수치 피해는 다루지 않는다
    수직(Y) 충돌         충돌은 지면 평면(x, z)에서만 판정한다
    Deposit 공간 점유    광맥은 이번 Cycle 에선 몸이 없다

## RELATED EXISTING CAPABILITY
    Actor Position / Move        (C001·C002) — 이동 결과가 이제 몸에 막히고 밀린다
    Attack / Hit                 (C002) — 완료 순간 반경 판정이 swing 진행 충돌 반경으로 바뀐다
    NPC Wander                   (C002) — 배회 이동도 같은 충돌 규칙을 받는다
    Multi Observer Projection    (C004) — 충돌체 관찰이 Projection 에 실려 나간다
