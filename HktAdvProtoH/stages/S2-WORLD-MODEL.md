# Stage 2 — World Model

Intent 의 **모든 의미**를 World State + World Rule + Observable 로 폐쇄한다.

## 입력

```text
context/TARGET-HORIZON.md
cycles/<cycle-id>/00-CYCLE-CONTRACT.md
cycles/<cycle-id>/01-INTENT-PACKAGE.md
context/WORLD-BASELINE.md
```

## 출력

```text
cycles/<cycle-id>/02-WORLD-DEFINITION-PACKAGE.md
```

템플릿: [../templates/WORLD-DEFINITION-PACKAGE.md](../templates/WORLD-DEFINITION-PACKAGE.md)

## 핵심 질문

> 이 Intent 문장을 세계에서 사실로 만들려면 어떤 정보가 존재해야 하는가?

```text
"Actor 가 광맥을 알고 있다"     →  Actor.Knowledge
                                  Deposit.Identity

"채굴 도구를 가지고 있다"        →  Actor.Inventory
                                  Item.ToolCapability

"광맥에 접근 가능하다"          →  Actor.Position
                                  Deposit.Position
                                  InteractionRange
```

## 절차

### 1. Required World State

Intent Package 의 Semantic Inventory 항목을 **하나씩** State 로 매핑한다.
매핑되지 않는 항목이 하나라도 남으면 Semantic Closure 실패다.

State 판정 기준 — **이것은 세계의 사실인가, 프로그램 구현의 사실인가?**

```text
World State                     Implementation State (여기 넣지 않는다)
Arin.Position                   vector.capacity
Arin.Inventory                  planner.currentNodeIndex
Arin.Knowledge                  cacheEntry
Deposit01.ResourceAmount        threadId / hashBucket / tempScoreBuffer
```

**Decision Semantic State** — 어떤 상태가 세계의 판단 결과에 영향을 준다면
그것도 세계의 의미다. Planner 내부 변수가 아니다.

```text
Knowledge   Preference   Experience
Skill       CurrentGoal  CurrentPossibility
```

Entity 단위 의미로만 쓴다 (`Actor01.Inventory`, 절대 `World.playerInventory` 아님).

### 2. Required World Rule

```text
RULE-<NAME>-<NNN>

Implements:      INTENT-<...>
Derived From:    GOAL-<...> / POSSIBILITY-<...>

Input:           Rule 이 받는 Entity 들
Preconditions:   판정 가능한 술어 목록
Transition:      어떤 State 가 어떻게 바뀌는가
```

Rule 은 코드 함수가 아니라 **세계에서 허용되는 상태 전이의 정의**다.
Precondition 은 전부 1 단계에서 정의한 State 만으로 판정 가능해야 한다.

### 3. Required Observable

Observable 은 나중에 붙이는 Debug UI 가 아니다. **여기서 함께 정의한다.**

> 인간이 이 Intent 가 실제로 세계에서 성립하고 있음을 확인하려면 무엇을 볼 수 있어야 하는가?

최소한 다음이 Observable Contract 에 있어야 한다.

```text
Actor / Entity 식별
Current Goal
Selected Possibility
각 Precondition 의 참·거짓
Selected Rule
Before State
Input
After State
```

그리고 **실행되지 않은 이유**도 관측 가능해야 한다.

```text
MineStone   unavailable
Reason:     Actor is out of interaction range.
```

**Semantic Lossless Projection** — 설계 판단에 필요한 의미가 Projection 과정에서
사라지면 안 된다. 메모리를 전부 복제하라는 뜻이 아니다.

### 4. Closure 자기 점검표

Package 안에 다음 표를 반드시 포함한다. Stage 5 가 이 표를 재검증한다.

| Intent 의미 요소 | 대응 State / Rule | Observable 경로 |
|---|---|---|
| … | … | … |

빈칸이 하나라도 있으면 Package 를 완료로 표시하지 않는다.

### 5. Baseline 대조

기존 Baseline 에 같은 의미가 이미 있으면 **새로 만들지 않고 재사용**한다 (RULE 9).
이름만 다른 중복 Semantic 은 Feature Island 의 시작이다.

## 금지

```text
Intent 의 의미를 바꾸거나 조건을 생략
Implementation Mechanism 결정 (클래스·자료구조·ECS·DB·캐시)
Contract 의 Deferred 항목을 State 로 선반영 (placeholder / dummy field)
Observable 을 "나중에 붙인다" 로 미루기
Rule 없이 변경되는 Semantic State 를 정의
```

## DESIGN GAP

필요한 의미가 Intent 나 Baseline 어디에도 없으면 임의로 확정하지 말고
[../templates/DESIGN-GAP.md](../templates/DESIGN-GAP.md) 로 Gap 을 제출하고 중단한다.

## 종료

`02-WORLD-DEFINITION-PACKAGE.md` 작성 → `context/CURRENT-CYCLE.md` 갱신 → **STOP.**
다음은 Stage 3 — **인간 Gate** 다. Implementation 으로 넘어가지 않는다 (RULE 4).
