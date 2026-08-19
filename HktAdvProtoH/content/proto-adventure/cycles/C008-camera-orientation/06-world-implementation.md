# C008 — World Implementation

> **변경 없음.** 03-world-semantic.md 가 WORLD CHANGE: NONE 으로 닫았고,
> 구현 단계에서 그 판정이 실제로 성립하는지 확인한 결과 세계 코드는 한 줄도 바뀌지 않았다.

## IMPLEMENTED
    없음 — 이번 Cycle 이 더한 World State · World Rule 은 없다.

## REUSED
    Actor.Facing                     world/semantic/actor.ts:38
    RULE-BODY-FACING-001             world/semantic/collision.ts:84 (faceToward)
                                     world/simulation/move-progress.ts:27 에서 호출된다 —
                                     한 걸음 옮길 때마다 그 방향을 향한다
    ActionCollider (칼끝)            world/semantic/collision.ts:57
                                     Facing 에서 유도된다 — 그림과 같은 값에서 나온다
    RULE-SWING-STRIKE-001            world/simulation/swing-strike.ts
    RULE-MOVE-PROGRESS-001           world/simulation/move-progress.ts
    Actor.CharacterKind              world/semantic/actor.ts:32

## AFFECTED UPDATED
    없음 — 기존 Rule 의 Input · Precondition · Transition · Result 중 바뀐 것이 없다.

## PROJECTION
    변경 없음. 이번 Cycle 이 읽는 값은 모두 이미 나가고 있었다.

    body.facing        world/projection/observer-view.ts:105    (C006 부터 상시 제공)
    position / kind    world/projection/observer-view.ts        (C001 · C002)
    swing.center       world/projection/observer-view.ts        (C006)

## TESTS
    새로 추가한 World 테스트 없음 — 새 규칙이 없으므로 검증할 새 전이가 없다.

    기존 세계 테스트 전부 재실행 (회귀)
        world/tests/collision.spec.ts  RULE-BODY-FACING-001 포함 8항목 통과
        world/tests + server/tests     전 항목 통과 (전체 301 중 세계 몫)

## NOTES
    이 단계에서 실제로 한 일은 "세계를 고치지 않아도 되는지"를 코드로 확인한 것이다.
    확인 항목 셋.

        1. 몸 방향이 상시 관찰되는가
           observer-view.ts 는 body 를 조건 없이 싣는다 — 디버그 관찰이 꺼져 있어도 온다.
           따라서 그림이 매 프레임 방향을 읽을 수 있다.

        2. 칼끝이 몸 방향에서 유도되는가
           collision.ts 의 actionCollider 는 actor.facing 을 회전시켜 칼끝 자리를 만든다.
           그림의 좌우도 같은 actor.facing 에서 나오므로 둘은 같은 원천을 공유한다 —
           어긋날 여지가 구조적으로 없다 (이 명제는 07 의 테스트가 값으로 확인한다).

        3. 목적지 요청이 방향의 기준을 묻지 않는가
           RULE-MOVE-001 은 TargetPosition 만 받는다. 관찰자가 그 좌표를 무엇을 기준으로
           정했는지는 요청에 실리지 않으며 판정에도 들어가지 않는다.

    한 가지는 07 로 넘어갔다 — 멈춤 요청이 몸을 뒤로 돌려세우던 문제.
    원인은 세계가 아니라 Client 의 멈춤 요청 방식이었다 (07 NOTES 참조).
    세계 규칙(움직인 방향이 몸 방향이다)은 옳게 작동하고 있었고, 그 규칙에 잘못된 목적지를
    준 쪽이 Client 였다. 그래서 이 단계는 여전히 변경 없음이다.
