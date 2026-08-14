# C008 — Human Semantic Review

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    (01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml)

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 쟁점
    이번 Cycle 은 세계를 전혀 바꾸지 않는다 (03 WORLD CHANGE: NONE).
    시점 방향은 관찰자의 것이고, 존재별 원본 기준 방향은 그림의 것이다.
    세계는 지금까지대로 몸이 향한 방향까지만 안다.

    검토자가 함께 확인한 반대 선택지 3개 — 모두 채택하지 않았다.

        시점을 세계에 들인다      다른 관찰자에게 내 시선이 보이거나 정면/등 뒤 판정에
                                  시점이 쓰여야 할 때 필요하다. 이번 Goal 에는 없다
        기준 방향을 세계가 안다   그림을 갈아 끼우면 값이 달라지는 것을 세계에 두게 된다
        제자리 회전을 추가한다    멈춘 채 방향만 바꾸는 행동 — 새 World Rule 이 필요하다.
                                  이번 Cycle 의 EXCLUDED 로 유지한다

## 결과
    APPROVED
    Reviewed By  Human (세션 승인 — "APPROVED — 이대로 구현")
    Note         위 3건은 이번 Cycle 의 경계 밖으로 확정한다.
                 필요해지면 각각 별도 Cycle 로 연다 (시점의 세계 진입 · 제자리 회전).
