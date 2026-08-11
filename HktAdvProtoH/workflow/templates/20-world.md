# 20-world — <PKG-ID>

## Required World State

> 세계의 사실만. Implementation State(캐시, 인덱스, 버퍼 등)는 여기에 오지 않는다.
> Agent 의 판단에 영향을 주는 상태(Knowledge, Preference, CurrentGoal 등)는 Decision Semantic State 로서 반드시 포함하고 Observable 대상이다.

| 개체 | 속성 | 의미 | 신규/기존 |
|---|---|---|---|
| Actor | Position | 위치 | 기존 |
| Actor | Knowledge | 알고 있는 사실 | 신규 |
| Deposit | ResourceAmount | 남은 자원량 | 신규 |

## World Rule

### RULE-<도메인>-<번호>

| 필드 | 값 |
|---|---|
| Implements | INTENT-… |
| Derived From | GOAL-… / POSS-… |

```text
Input
    Actor, Deposit

Preconditions
    Actor.Knows(Deposit) == true
    Actor.HasTool(Mining) == true
    Distance(Actor, Deposit) <= MiningInteractionRange
    Deposit.ResourceAmount > 0

Transition
    Deposit.ResourceAmount -= ExtractAmount
    Actor.Inventory[Deposit.ResourceType] += ExtractAmount
```

## Observable Contract — OBS-<도메인>-<번호>

> 인간이 이 Intent 의 성립을 확인하려면 무엇을 볼 수 있어야 하는가?
> Rule 의 모든 Precondition 평가값 + Before/After + 선택 이유가 노출 대상이다.

노출 필수:

```text
Actor (이름, 관련 상태)
Current Goal / Selected Possibility / Current Rule
각 Precondition 의 평가값 (true/false + 불가 사유)
Transition: Before → Input → Rule → After
```

## Required Views

| View | 보여줄 것 |
|---|---|
| DesignerView | Goal→Possibility→Rule 경로 + Precondition 평가 + Before/After |
| DebugView | (필요 시) |
| GameView | (필요 시) |

## Intent 의미 단위 → State/Rule 매핑표

> 10-intent.md 의 의미 단위 목록 전체가 매핑되어야 WORLD_READY 가 된다.

| 의미 단위 | 매핑 |
|---|---|
| 광맥을 알고 있다 | Actor.Knowledge |
| Mine 행동 | RULE-… |
