# Stage 5 — Verification

단순한 코드 테스트가 아니다. **네 종류의 Closure** 를 검사한다.

## 입력

```text
cycles/<cycle-id>/01-INTENT-PACKAGE.md
cycles/<cycle-id>/02-WORLD-DEFINITION-PACKAGE.md
cycles/<cycle-id>/04-IMPLEMENTATION-RESULT.md
Repository (읽기)
```

## 출력

```text
cycles/<cycle-id>/05-VERIFICATION-REPORT.md
```

템플릿: [../templates/VERIFICATION-REPORT.md](../templates/VERIFICATION-REPORT.md)

## 검사 1 — Semantic Closure

> Intent 의 모든 의미가 State / Rule 로 표현되었는가?

`01` 의 Semantic Inventory 를 한 줄씩 대조한다.

| Intent 의미 요소 | 대응 State / Rule | 코드 위치 | 판정 |
|---|---|---|---|

하나라도 대응이 없으면 **FAIL**. "코드에는 있지만 이름이 다르다" 는 통과지만,
"의미가 사라졌다" 는 FAIL 이다.

## 검사 2 — Observable Closure

> Rule 의 판단과 결과를 이해하는 데 필요한 의미가 Observable 한가?

각 Precondition 이 **개별로** 관측되는지 확인한다.

```text
KnowsDeposit       true
HasMiningTool      true
InRange            false
DepositAvailable   true
```

그리고 실패 이유가 설계 언어로 나오는지 확인한다.

```text
MineStone   unavailable
Reason:     Actor is out of interaction range.
```

Precondition 4개를 하나의 boolean 으로 합쳐서 보고하면 **FAIL** 이다.

## 검사 3 — Runtime Closure

> 실제로 Semantic Transition 이 발생하는가?

실행하여 아래 4요소를 **실제 출력으로** 확보한다. 코드를 읽고 추정하지 않는다.

```text
Before
Input
Rule
After
```

Report 에 실제 실행 출력을 붙인다. State 뿐 아니라 **Transition 자체가 관측 가능**해야 한다.

추가로 **부정 경로**를 최소 1개 실행한다 — Precondition 하나가 거짓인 상태에서
Rule 이 실행되지 않고, 그 이유가 관측되는가.

## 검사 4 — Traceability

> 다음 연결이 실제 산출물에서 끊기지 않는가?

```text
Runtime Transition
 ↓
World Rule
 ↓
Intent
 ↓
Possibility
 ↓
Goal
```

Runtime 출력의 Rule ID 에서 시작해 `02` → `01` → Contract 까지 실제로 따라간다.
역방향(Goal → 현재 Runtime instance)도 확인한다.

## 추가 검사 — Rule 귀속

Semantic State 를 변경하는 코드가 **Rule 밖에** 있는지 검색한다 (P3).
Rule 을 거치지 않는 Semantic State 변경이 하나라도 있으면 FAIL 이다.

## 판정

네 Closure + Rule 귀속이 모두 PASS 여야 Stage 6 로 갈 수 있다.
하나라도 FAIL 이면 Report 에 **최초 원인과 담당 Stage** 를 적는다.

```text
FAIL 원인이 구현에 있음   → Stage 4 재실행
FAIL 원인이 의미 정의에 있음 → Stage 2 재실행 (Stage 3 Gate 를 다시 통과해야 함)
```

## 금지

```text
구현을 대규모로 수정하는 것 — 검증 Stage 는 고치는 Stage 가 아니다
실행하지 않고 코드만 읽고 PASS 판정
"대체로 동작한다" 식의 판정 — 각 검사는 PASS / FAIL 둘 중 하나다
Observable 미비를 "다음 Cycle 에서" 로 넘기는 것 (P8)
```

## 종료

`05-VERIFICATION-REPORT.md` 작성 → `context/CURRENT-CYCLE.md` 갱신 → **STOP.**
