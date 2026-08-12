# <ID> — Human Semantic Review

담당: Human. 구현 전에 의미 연결만 확인한다.

## 검토 대상

```text
Cycle Goal
    ↓
Intent
    ↓
World Semantic
    ↓
GameView Specification
```

## 질문

1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 결과

    APPROVED | RETURNED

    Return To   <Intent | World Semantic | GameView Specification>
    Reason      <무엇이 부족한가>

## 비고

    <구현 단계에서 유의할 점>
