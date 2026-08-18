# CYCLE C008 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (실행 확인 — Human Play 확인 대기)
[PASS] Regression

## NEW BEHAVIOR
    시점을 돌린다                 → 세계를 다른 쪽에서 본다. 돌린 각은 유지된다
    시점을 기울인다               → 3D 지형의 기복과 지평선이 각도에 따라 다르게 보인다
    돌린 뒤 앞으로 간다           → 같은 키가 세계의 다른 방향이 된다 (보고 있는 쪽)
    몸이 왼쪽을 향한다            → 그림이 좌우로 뒤집혀 보인다
    시점을 돌린다 (몸은 그대로)   → 같은 몸이 반대쪽을 향한 것으로 읽히고 그림도 뒤집힌다
    정면·정후면을 향한다          → 좌우가 흐려도 그림이 깜빡이지 않는다 (직전 쪽 유지)
    휘두른다                      → 그림이 보이는 쪽으로 칼끝이 나간다

## WORLD SCENARIO
    세계는 이번 Cycle 에서 바뀌지 않았다 (03 WORLD CHANGE: NONE).
    새 전이가 없으므로 새 World Scenario 도 없다. 대신 이 Cycle 이 기대는 기존 전이가
    그대로 성립하는지를 재실행으로 확인했다 — View 없이.

    RULE-BODY-FACING-001            world/tests/collision.spec.ts
        Before  facing = (0, 1)
        Input   Move(Player, +x 방향 목적지)
        Rule    RULE-MOVE-PROGRESS-001 → faceToward
        After   facing = (1, 0)                                    [PASS]

    ActionCollider (칼끝이 몸 방향에서 나온다)   world/tests/collision.spec.ts · attack.spec.ts
        Before  facing = (1, 0), attack 진행 중
        Rule    actionCollider — Facing 을 회전시켜 칼끝 자리를 만든다
        After   Center 가 몸의 +x 쪽 호 위에 있다                   [PASS]

    실행: `npx vitest run world/tests server/tests` — 21 파일 291항목 전부 통과
    (world 몫 138항목 포함). 세계 코드 변경 없음이므로 이 전부가 회귀 확인이기도 하다.

## PROJECTION
    04 의 source 가 실제 Projection 경로와 일치하는지 대조했다.

        entities.character.facing  ← Actor.Facing
            world/projection/observer-view.ts:105 — 조건 없이 실린다.
            디버그 관찰이 꺼져 있어도 온다 → 그림이 매 프레임 방향을 읽을 수 있다  [PASS]
        entities.character.kind    ← Actor.CharacterKind (observer-view.ts:70)      [PASS]
        entities.character.swing   ← ActionCollider (attack 진행 중에만)            [PASS]
        interactions.move          ← Move.Availability / FailureReason              [PASS]

    viewpoint · spriteOrientation 은 Projection 에 없다 — 있어서는 안 된다.
    04 가 worldKnows: false 로 선언했고, 실제로 protocol/gameview.ts 에 이 둘에 해당하는
    필드가 없다.                                                                    [PASS]

## VIEW FIXTURE
    실행: `npx vitest run view/tests` — 30항목 신규 · 전부 통과

    view/tests/view-orientation.spec.ts (16)
        기본 시점이 C007 까지의 고정 오프셋(0, 7.5, 13)과 같은 자리를 만든다        [PASS]
        돌린 각이 유지되고 저절로 되돌아가지 않는다                                 [PASS]
        tilt 가 한계 안에 머문다 (뒤집히지 않는다)                                  [PASS]
        π 를 넘어가는 지점에서도 방향이 건너뛰지 않는다 (연속성)                    [PASS]
        turn = 0 의 이동 방향이 C007 까지와 같다 (회귀)                             [PASS]
        turn = 90° 에서 같은 키가 세계의 다른 방향이 된다                           [PASS]
        환산 결과는 언제나 단위 방향 — 비스듬히 눌러도 빨라지지 않는다              [PASS]
        반대 시점에서 같은 몸 방향이 반대 부호로 읽힌다                             [PASS]

    view/tests/facing.spec.ts (14) — fixtures/facing.fixture.json
        rabbit-swordsman 의 원본은 오른쪽을 본다                                    [PASS]
        읽힌 쪽 ≠ 기준 방향이면 뒤집는다                                            [PASS]
        모호 구간에서 부호가 오가도 직전 쪽을 유지한다                              [PASS]
        시점을 180° 돌리면 같은 몸이 반대로 읽힌다 (세계는 그대로)                  [PASS]
        **보이는 쪽과 칼끝이 지나는 쪽이 어긋나지 않는다 — 9개 시점 각 전부**       [PASS]
        몸 방향이 없는 대상(광맥)은 이 결정을 받지 않는다                           [PASS]

## PLAYABLE
    Server + Client 를 붙여 (npm run dev) 실제로 조작하고 화면을 기록했다.
    브라우저 자동 조작(Chromium)으로 키 입력을 넣고 화면을 찍어 확인했다.

    1. 시점 회전        Z / X · 오른쪽 버튼 끌기로 시점이 돌고, 지형과 광맥의 화면상
                        자리가 그에 맞게 바뀐다. 놓아도 그 방향에 머문다             [확인]
    2. 시점 기울임      R / T 로 지평선이 오르내리고 3D 지형의 기복이 옆에서 보인다  [확인]
    3. 시점 기준 이동   시점을 돌린 뒤 W 를 누르면 화면 안쪽으로 나아간다.
                        같은 키가 시점에 따라 세계의 다른 방향이 된다                [확인]
    4. 좌우 뒤집기      D 로 가면 원본 그대로(오른쪽), A 로 가면 뒤집혀(왼쪽) 보인다 [확인]
    5. 시점에 따른 읽힘 몸을 그대로 두고 시점만 180° 돌리면 같은 몸이 뒤집혀 보인다  [확인]

    4·5 는 눈으로만 판정하지 않고 **화면 픽셀로 대조**했다 —
    두 장면을 같은 자리에서 잘라, 그대로 겹쳤을 때와 좌우로 뒤집어 겹쳤을 때의
    차이를 재어 어느 쪽이 더 일치하는지 확인했다 (그림 픽셀만, 0~765 척도의 평균 차).

        몸이 돈다 (시점 고정)    그대로 겹침 156  ·  뒤집어 겹침 113   → 뒤집힌 관계  [PASS]
        시점이 돈다 (몸 고정)    그대로 겹침 135  ·  뒤집어 겹침  72   → 뒤집힌 관계  [PASS]

    이 대조가 처음에는 정반대로 나왔고(그대로 7 · 뒤집어 148 — 즉 전혀 뒤집히지 않았다),
    그 덕분에 아래 두 결함을 찾았다. 둘 다 고친 뒤 위 값으로 뒤집혔다.

## FAILURES → 수정
    [FIXED] 스프라이트가 뒤집히지 않았다
        원인   THREE.Sprite 는 셰이더에서 모델 행렬의 길이(length)로 크기를 구한다 —
               scale.x 를 음수로 두어도 부호가 사라져 뒤집히지 않는다
        수정   그림을 읽는 방향을 뒤집는다 (텍스처 가로 진행 반전 + 기준점 좌우 이동,
               절차 생성 그림은 뒤집힌 텍스처를 따로 캐시)  view/sprites/billboard.ts
        분류   View 구현 결함 — Semantic · Spec 은 바꾸지 않았다

    [FIXED] 멈출 때마다 몸이 뒤를 돌아봤다
        원인   이동 키를 놓을 때 "마지막으로 관찰한 자리로 가라"를 보냈다.
               그 자리는 이미 지나온 자리여서 몸이 뒤로 한 걸음 돌아왔고,
               움직인 방향이 몸 방향이므로(C006) 멈출 때마다 뒤를 향했다
        수정   놓을 때 아무것도 보내지 않는다 — 마지막 목적지에 도착하면 스스로 멈춘다
               app/main.ts
        분류   Client 요청 결함. 세계 규칙은 옳게 작동하고 있었다 —
               C007 까지는 몸 방향이 화면에 드러나지 않아 보이지 않았을 뿐이다.
               이번 Cycle 이 드러냈고, 드러나자 결함이 되었다

    반환된 Stage 없음 — 둘 다 구현 결함이며 Semantic · Spec 은 그대로다.

## REGRESSION
    세계 코드가 바뀌지 않았으므로 기존 Scenario 전부가 회귀 대상이다.

    실행: `npx vitest run` — 22 파일 301항목 전부 통과 (신규 30 포함, 기존 271 전부)

        C001 Mining / Move            world/tests/mine.spec.ts · move.spec.ts        [PASS]
        C002 Action / NPC / Motion    action.spec.ts · npc.spec.ts · motion.spec.ts  [PASS]
        C003 World Server             server/tests/world-host.spec.ts                [PASS]
        C004 Observer                 observer.spec.ts · observer-identity.spec.ts   [PASS]
        C005 Link Telemetry           link-telemetry.spec.ts · observer-mark.spec.ts [PASS]
        C006 Collision / Facing       collision.spec.ts · collision-debug.spec.ts    [PASS]
        C007 Combat                   world·view combat.spec.ts (60항목)             [PASS]

    View 표현 회귀 — 이번 Cycle 이 건드린 두 자리를 값으로 고정해 두었다.
        기본 시점(turn = 0)의 카메라 자리가 C007 까지와 같다                         [PASS]
        기본 시점의 이동 방향 환산이 C007 까지와 같다 (W = -z, D = +x)               [PASS]

    경계 회귀 — 정적 검사
        view/ · app/ 에서 world/ 를 import 하지 않는다                               [PASS]
        world/ 에서 view/ 를 import 하지 않는다                                      [PASS]
        protocol/gameview.ts 에 viewpoint · spriteOrientation 이 없다                [PASS]
        `npx tsc --noEmit` 통과                                                      [PASS]

## COMPLETION GATE
    [x] 작은 플레이 가능한 Goal 이 정의되어 있다              01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                        02 GOAL / POSSIBILITY 4쌍
    [x] Intent 가 존재한다                                    02 INTENT SET 6종
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다       03 SEMANTIC CLOSURE
                                                              (세계 밖에서 닫히는 문장은
                                                               책임 소재를 명시했다)
    [x] World State 변화가 World Rule 을 통해서만 발생한다    이번 Cycle 은 상태를 바꾸지 않는다
    [x] World 는 Authoritative 하다                           목적지 요청뿐 — 시점은 실리지 않는다
    [x] GameView Specification 이 존재한다                    04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다          import 정적 검사 통과
    [x] World 는 View 구현 정보를 사용하지 않는다             기준 방향은 세계에 없다
    [x] World 를 View 없이 검증할 수 있다                     world/tests 138항목
    [x] View 를 Fixture 만으로 검증할 수 있다                 facing.fixture.json + 30항목
    [x] Server + Client 연결 시 실제 플레이가 가능하다        PLAYABLE 1~5
    [x] Runtime 결과를 Goal / Possibility / Intent 까지 추적  아래 TRACE
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다       **대기**
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다        시점·좌우 읽기·기준 방향 표는
                                                              전부 현재 view/ 에 있다

## TRACE
    화면에서 몸이 왼쪽을 향해 보인다
        ← flip = true                          view/presentation/facing-presentation.ts
        ← 읽힌 쪽(left) ≠ 기준 방향(right)     04 spriteOrientation
        ← screenSideValue(turn, facing) < 0    04 entities.character.facing.read
        ← Actor.Facing                         03 REUSED · RULE-BODY-FACING-001 (C006)
        ← INTENT-FACING-SCREEN-SIDE-001 · INTENT-SPRITE-ORIENT-001
        ← POSSIBILITY-FACING-PROJECTED ← GOAL-FACING-LEGIBLE
        ← 01 GOAL "…좌우로 뒤집히는 그림에서 읽고"

## STATUS
    IN PROGRESS  — Human Play 확인 대기.
                   사람이 직접 시점을 돌려 보고, 돌린 채 걸어 보고,
                   보이는 쪽으로 휘둘러 맞는지 확인하면 COMPLETE 로 바꾼다.
