# CYCLE-<NNN> — Verification Report

> Stage 5 산출물. **실제 실행 출력**을 근거로 판정한다. 코드를 읽고 추정하지 않는다.

## 재현 방법

```bash

```

## 검사 1 — Semantic Closure

Intent Package 의 Semantic Inventory 전 항목 대조.

| # | Intent 의미 요소 | 대응 State / Rule | 코드 위치 | 판정 |
|---|---|---|---|---|
| 1 | | | | PASS / FAIL |

```text
판정: PASS / FAIL
```

## 검사 2 — Observable Closure

각 Precondition 이 **개별로** 관측되는가.

| Precondition | 관측 가능 | 실제 출력 |
|---|---|---|
| P1 | [ ] | |

실패 이유가 설계 언어로 나오는가.

```text
<실제 출력 붙여넣기>
```

```text
판정: PASS / FAIL
```

## 검사 3 — Runtime Closure

### 성공 경로 — 실제 실행 출력

```text
Before

Input

Rule

After

```

### 부정 경로 — Precondition 하나가 거짓일 때 실제 출력

```text

```

Rule 이 실행되지 않았고 그 이유가 관측되었는가.

```text
판정: PASS / FAIL
```

## 검사 4 — Traceability

Runtime 출력의 Rule ID 에서 시작해 실제로 따라간 경로.

```text
Runtime Transition   <출력의 어느 부분>
 ↓
World Rule           <02 의 어느 항목>
 ↓
Intent               <01 의 어느 항목>
 ↓
Possibility          <Contract 의 어느 항목>
 ↓
Goal                 <Contract 의 어느 항목>
```

역방향(Goal → 현재 Runtime instance) 확인.

```text

```

```text
판정: PASS / FAIL
```

## 추가 검사 — Rule 귀속

Rule 밖에서 Semantic State 를 변경하는 코드 검색 결과.

```text
검색 방법:
발견 건수:
발견 위치:
```

```text
판정: PASS / FAIL
```

## 종합 판정

| 검사 | 판정 |
|---|---|
| Semantic Closure | |
| Observable Closure | |
| Runtime Closure | |
| Traceability | |
| Rule 귀속 | |

```text
종합: PASS / FAIL
```

## FAIL 시 — 최초 원인과 담당 Stage

```text
최초 원인:

담당 Stage:   Stage 2 (의미 정의) / Stage 4 (구현)

재실행 시 추가 입력:

```

> 이 Stage 는 고치는 Stage 가 아니다. 원인만 보고하고 STOP 한다.
