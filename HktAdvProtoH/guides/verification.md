# Verification Stage Guide

## Role

이번 Cycle 이 실제로 닫혔는지 검증하고, 영향받은 기존 기능의 Regression 을 확인한다.

## Input

- `cycles/<CycleId>/01~07` 전체
- `world/` `view/` `protocol/` 현재 구현
- 관련 과거 Cycle 의 `08-verification.md` (Regression Scenario 기반)

## Do

1. **Semantic Closure** — Goal → Possibility → Intent → State / Rule 이 모두 연결되는가.
2. **World Rule 실행** — View 없이 `Before → Input → Rule → After` 를 실측한다.
3. **Projection** — World 결과가 `04-gameview.spec.yaml` 계약대로 산출되는가.
4. **View Binding** — Fixture 만으로 View 가 그 의미를 표현하는가.
5. **Playable** — Server + Client 를 연결해 Cycle Goal 을 실제로 달성한다.
6. **Regression** — `03-world-semantic.md` 의 AFFECTED 항목과 과거 Cycle Scenario 를 재실행한다.

## Output

`cycles/<CycleId>/08-verification.md`

```text
CYCLE C012 — Inventory Capacity

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

NEW BEHAVIOR
    Inventory has room   → Item acquisition succeeds
    Inventory full       → Item acquisition fails (reason: inventory-full)

WORLD SCENARIO
    Before  UsedCapacity = 9, Capacity = 10
    Input   Pickup(Player, Stone)
    Rule    RULE-ADD-ITEM
    After   UsedCapacity = 10, Items += Stone

REGRESSION
    Mining with available capacity  → still succeeds   (C003 scenario)
    Pickup with available capacity  → still succeeds   (C002 scenario)
    Trade receive with capacity     → still succeeds   (C009 scenario)

STATUS
    COMPLETE
```

실패는 원인이 즉시 보이게 적는다.

```text
[PASS] Intent
[FAIL] Semantic Closure
Missing   Tool.Capability
Return To World Semantic
```

## Must

- 검증은 **실행 결과**로 기록한다 — 통과 주장만 적지 않는다.
- 6종 검사 결과를 모두 표기한다 (해당 없음이면 사유를 적는다).
- AFFECTED 로 표시된 기존 Rule 은 반드시 Regression 을 돈다.
- 최종 판정은 Human Play 이후에 `COMPLETE` 로 바꾼다.

## Must Not

- 검증을 통과시키기 위해 Semantic 이나 Spec 을 수정하지 않는다 — 실패는 담당 단계로 반환한다.
- 코드가 돌아간다는 사실만으로 완료 판정하지 않는다.

## Done When

Cycle Completion Gate 가 모두 참이다.

```text
[ ] 작은 플레이 가능한 Goal 이 정의되어 있다
[ ] Goal / Possibility / Intent 가 존재한다
[ ] Intent 의 모든 의미가 State / Rule 로 닫혀 있다
[ ] World State 변화가 World Rule 을 통해서만 발생한다
[ ] GameView Specification 이 존재한다
[ ] View 는 Spec 외 World 정보를 사용하지 않는다
[ ] World 를 View 없이 검증할 수 있다
[ ] View 를 Fixture 만으로 검증할 수 있다
[ ] Server + Client 연결 시 실제 플레이가 가능하다
[ ] Runtime 결과를 Goal / Possibility / Intent 까지 추적할 수 있다
[ ] 영향받은 기존 기능이 여전히 동작한다
[ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다
[ ] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다
```
