# C008 — View Implementation

## SPEC CONSUMED
    viewpoint.orientation.turn / tilt        view/camera/orientation.ts
                                             두 각과 그로부터 나오는 방향의 순수 계산.
                                             three 를 쓰지 않는다 — 값으로 검증된다
    viewpoint.orientation.continuity         view/camera/orientation.ts (turned)
                                             절대 각을 지정하는 길을 두지 않았다 —
                                             언제나 "지금 방향에서 얼마만큼" 이다
    viewpoint.orientation.tilt.bounded       view/camera/orientation.ts (clampTilt)
    viewpoint.follows                        view/camera/camera.ts (follow)
    viewpoint.constraint 지형 아래 금지      view/camera/camera.ts (TERRAIN_CLEARANCE)
    viewpoint.owner: observer                시점 값은 View 안에만 있다 —
                                             ActionRequest 에 실리는 경로가 없다

    entities.character.facing.read           view/presentation/facing-presentation.ts
                                             + view/camera/orientation.ts (screenSideValue)
    entities.character.facing.ambiguous      facing-presentation.ts (readSide, AMBIGUOUS_BAND)
                                             직전 쪽은 app/main.ts 가 프레임 사이에 기억한다
    spriteOrientation.baseline               facing-presentation.ts (SPRITE_BASELINE)
    spriteOrientation.rule                   facing-presentation.ts (facingDecision)

    interactions.move.direction.basis        view/camera/orientation.ts (worldDirection)
    interactions.move.direction.conversion   app/main.ts — 세계 좌표로 환산해 보낸다

## ASSET MAPPING
    존재 종류 → 그림의 기준 방향 (04 spriteOrientation.baseline)

        rabbit-swordsman → right     원본이 오른쪽을 본다. 휘두름도 오른쪽으로 나간다
        wanderer         → right     같은 그림을 쓴다
        (등록되지 않은 종류) → right  기본값

    이 표는 세계에 없다. 그림을 갈아 끼우면 이 표만 바뀐다.

## INPUT → ACTION REQUEST
    이동 (변경)      WASD → 지금 보고 있는 방향 기준으로 환산 → Move(세계 좌표)
                     같은 키가 시점에 따라 세계의 다른 방향이 된다

    시점 (신규)      오른쪽 버튼 끌기 → 시점 회전 (view/input/pointer.ts)
                     Z / X            → 왼쪽 · 오른쪽으로 돈다
                     R / T            → 올려다본다 · 내려다본다
                     **어느 것도 Action Request 가 되지 않는다** — 세계로 나가지 않는다.
                     상호작용 키(E·F·G·Shift)와 관찰 토글(C·V)을 피해 배치했다.
                     왼쪽 클릭은 지금까지대로 이동·상호작용이다 (브라우저는 왼쪽 버튼에만
                     click 을 내므로 시점 끌기와 섞이지 않는다)

## 그림 뒤집기
    THREE.Sprite 는 scale.x 를 음수로 두어도 뒤집히지 않는다 — 셰이더가 모델 행렬의
    길이(length)로 크기를 구하기 때문에 부호가 사라진다. 그래서 그림을 읽는 방향을 뒤집는다.

        모션 시트    텍스처의 가로 진행을 반대로 (repeat.x 음수 + offset 이동) —
                     프레임 사각형 안에서 같은 구간을 반대로 훑는다
        기준점       발 자리도 함께 옮긴다 (center.x → 1 - center.x)
        절차 생성    뒤집힌 텍스처를 따로 캐시한다 — 텍스처를 공유하므로 한 장에 지시를
                     걸면 뒤집지 않는 대상까지 뒤집힌다

    view/sprites/billboard.ts

## CHANGED — 멈춤 요청
    app/main.ts — 이동 키를 놓을 때 아무것도 보내지 않는다.

        기존   "마지막으로 관찰한 자리로 가라"를 보내 그 자리에 세웠다
        문제   그 자리는 이미 지나온 자리다 (관찰은 세계보다 늦게 도착한다).
               몸이 뒤로 한 걸음 돌아왔고, 움직인 방향이 몸 방향이므로
               (C006 RULE-BODY-FACING-001) 멈출 때마다 뒤를 돌아봤다
        지금   마지막으로 요청한 목적지는 늘 몸보다 앞에 있다. 그리로 가다 도착하면
               스스로 멈춘다 (RULE-MOVE-PROGRESS-001 Arrived)

    C007 까지는 이 어긋남이 보이지 않았다 — 몸 방향이 화면에 드러나지 않았기 때문이다.
    이번 Cycle 이 그것을 드러냈고, 드러나자 결함이 되었다.
    세계를 고치지 않고 Client 의 요청 방식만 바로잡았다.

## FIXTURE TESTS
    view/tests/view-orientation.spec.ts   16항목
        기본 시점이 C007 까지의 고정 오프셋과 같은 자리를 만든다 (회귀)
        돌린 각의 유지 · tilt 한계 · 접히는 지점에서의 연속성
        시점 기준 이동 — turn = 0 에서 기존과 같음(회귀), 90° 에서 세계의 다른 방향
        환산 결과는 언제나 단위 방향 (비스듬히 눌러도 빨라지지 않는다)
        몸 방향의 화면 좌우 — 반대 시점에서 반대 부호, 정면·정후면에서 0

    view/tests/facing.spec.ts             14항목
        종류별 기준 방향 · 기본값
        모호 구간에서 직전 쪽 유지 (부호가 오가도 떨리지 않는다)
        시점을 돌리면 같은 몸이 반대로 보인다
        **보이는 쪽과 칼끝이 지나는 쪽이 어긋나지 않는다 — 9개 시점 각에서**
        몸 방향이 없는 대상(광맥)은 이 결정을 받지 않는다

    fixtures/facing.fixture.json          몸 방향 3종 + 휘두르는 중인 몸(칼끝 포함)

## NOTES
    resolvePresentation 은 순수 함수로 남겼다. 시점 각과 "직전에 읽힌 쪽"은 옵션으로 들어가고,
    갱신은 조립 루트가 한다 — 결정 Layer 가 프레임 사이의 기억을 갖지 않게 하기 위해서다.
    덕분에 같은 입력에 같은 결과가 나오고 Fixture 로 검증된다.
