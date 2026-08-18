# C007 — Human Semantic Review

> 이 문서는 Human 의 판정 기록이다. 아래 "결과"와 "개정 요구"는 사용자가 구술한 내용을
> 그대로 옮긴 것이며, Agent 의 판단이 아니다.

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    (01~04 R1 축소 개정본 — 판정 능력치 제외, 스킬 고정 피해)

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 결과
    APPROVED WITH AMENDMENTS
    Return To  Intent  (아래 두 개정 사항의 의미를 세우기 위해)

## 개정 요구 (Human)
    A. 모든 속성은 관찰 가능해야 한다.
       — 남의 속성을 가리는 경계를 두지 않는다. 세계는 숨기지 않는다.

    B. 디버깅 버전에서는 속성을 임의로 변경하는 것도 가능하면 좋겠다.
       — 이번 Cycle 은 기반만 마련한다.
         치트 같은 완성된 조작 수단은 이후 Cycle 에서 해결한다.

## 반영 지시
    R2 로 02 · 03 · 04 를 개정한 뒤 World Implementation 으로 진행한다.
    R1 에서 확정된 나머지 의미(고정 피해 · 기력 수지 · 템포 능력치)는 그대로 둔다.
