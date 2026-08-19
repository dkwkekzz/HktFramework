# C009 — Human Semantic Review

## 검토 대상
    Cycle Goal (01, R1) → Intent (02) → World Semantic (03) → GameView Specification (04)

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 검토된 판정
    03 이 02 에서 넘겨받아 판정한 3건.

    1  명령 목록은 World State 가 아니라 세계의 성질이다
       이 Cycle 은 World State 를 하나도 더하지 않는다.
    2  세계의 대답은 Tick 의 산출물이다 — 세계는 대답을 쌓아 두지 않는다
       요청이 Tick 에 판정되므로(C003) 대답이 나오는 자리도 그 Tick 이다.
    3  지목은 Actor.Name 이 아니라 Actor.Id 다
       이름은 겹칠 수 있고 Id 는 겹치지 않으며 이미 투영된다.

    그리고 04 의 경계 유지.

    4  관찰 토글(충돌체·속성 펼침)은 세계 카탈로그 밖에 둔다
       같은 표면에 모이되 origin 으로 구분된다.
       한 자리에 모이는 것은 사람이 인지하는 표면이지 권한의 경계가 아니다.

## 결과
    APPROVED

    Return To  없음
    Reason     없음

## 검토자 지시 (View Implementation 방향)
    명령 표면은 **목록 우선 + 타이핑** 으로 만든다.

        열면 걸 수 있는 것 전부가 뜻·받는 것·허용 범위와 함께 먼저 보인다.
        그 상태에서 타이핑하면 후보가 좁혀지고,
        남은 자리와 그 자리의 허용 범위가 계속 보인다.

    아무것도 모르는 사람은 읽고 고르며,
    아는 사람은 바로 친다.

    이 지시는 04 의 commandSurface.browse · commandSurface.guide 요구를
    어떻게 만족시킬지에 대한 것이며, 계약 자체를 바꾸지 않는다.
