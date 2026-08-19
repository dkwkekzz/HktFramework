# CYCLE C005 — Human Semantic Review

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    (01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml)

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 검토자에게 제시된 결정
    1. 세계가 새로 갖는 것은 Observer.AcknowledgedMark 하나뿐이다.
       RULE-OBSERVER-MARK-001 은 게임 상태를 바꾸지 않고, 표식은 뒤로 가지 않으며,
       늦게 도착한 옛 표식은 무시된다.
    2. 나머지 5개 Intent(왕복 시간 · 도착률 · 마지막 수신 경과 · 보낸 양 ·
       다시 이은 횟수)는 전부 관찰자 쪽 의미다. 세계는 사이가 얼마나 잘 통하는지 모른다.
       C003 이 session.link 를 관찰자 쪽에 둔 것과 같은 처리다.
    3. 왕복의 정의 — 소켓 왕복이 아니라 인과의 왕복이다.
       내 표식이 세계에 닿아 그 Tick 의 판정을 마치고 관찰 결과로 돌아오기까지.
       기각된 대안 — server/attach.ts 가 소켓 수준에서 메아리하는 방식:
       세계를 건드리지 않아 간단하지만, 재는 값이 "판정까지의 지연"이 아니게 되고
       다음 Cycle(예측 보정)이 필요로 하는 값과도 달라진다.
    4. 표식은 Tick Transition 0 에서 요청보다 먼저 처리된다.
       관찰자가 언제나 요청을 보낸 뒤 표식을 붙이므로, 같은 Tick 안에서 그 요청도
       함께 판정되어 두 값이 같은 관찰 결과로 나간다.

## 결과
    APPROVED
    Return To  없음
    Reason     위 4가지 결정을 포함해 승인.

## 기록 경위
    이 판정은 검토자가 대화에서 직접 선택한 것을 그대로 옮겨 적은 것이다.
    Agent 가 판정하지 않았다.
