# Stage 4 — Implementation

APPROVED World Definition 을 실행 가능한 세계로 구현한다.

## 입력

```text
cycles/<cycle-id>/02-WORLD-DEFINITION-PACKAGE.md   (APPROVED 여야 함)
cycles/<cycle-id>/03-SEMANTIC-REVIEW-RESULT.md     (APPROVED 확인용)
Repository
```

`03` 이 APPROVED 가 아니면 **시작하지 않는다** (RULE 4).

원본 설계 문서(`design/Design-Concept.md`, `design/Design-CycleWorkflow.md`)를
다시 읽지 않는다. 필요한 모든 의미는 `02` 안에 있어야 한다 — 없으면 그것이 DESIGN GAP 이다.

## 출력

```text
cycles/<cycle-id>/04-IMPLEMENTATION-RESULT.md
+ 코드
```

템플릿: [../templates/IMPLEMENTATION-RESULT.md](../templates/IMPLEMENTATION-RESULT.md)

## 결정할 수 있는 것 / 없는 것

```text
Agent 가 결정한다                  Agent 가 바꿀 수 없다
─────────────────                  ────────────────────
클래스 구조                        Goal 의미
자료구조                           Possibility 의미
파일 구조                          Intent 의미
함수 구조                          World Rule 의 게임 의미
캐싱                               Required World State (생략 불가)
코드 추상화                        Observable Contract (생략 불가)
Implementation Mechanism
```

구현이 어렵다는 이유로 `Knowledge` 체크를 빼는 것은 코드 최적화가 아니라 **세계 규칙 변경**이다.

## 절차

### 1. 기술 선택 (첫 Cycle 한정)

런타임 기술 스택은 **여기서 처음 결정한다.** 이전 Stage 는 결정하지 않는다.
선택 근거를 `04` Artifact 에 남긴다. 선택 기준은 하나다 —
Observable Contract 를 인간이 실제로 볼 수 있게 만드는 데 무엇이 가장 빠른가.

### 2. World State 구현

`02` 의 Required World State 를 Entity 단위로 구현한다.

```text
금지                          허용
world.playerStoneCount   →    actors["Arin"].inventory["Stone"]
                              deposits["Deposit01"].resourceAmount
```

Runtime 에 Entity 가 하나뿐이어도 **컬렉션 의미**를 유지한다.

### 3. World Rule 구현

- Precondition 은 `02` 의 목록과 **1:1** 로 대응한다. 순서를 합치거나 묶지 않는다 —
  Observable 이 각 Precondition 을 개별로 보고해야 하기 때문이다.
- Transition 은 Rule 안에서만 일어난다.
- **Rule 밖에서 Semantic State 를 변경하는 코드를 만들지 않는다** (P3).
  `stoneCount++` 가 Rule 밖에 있으면 그 자체로 위반이다.

### 4. Observable Projection 구현

Observable 은 World State 를 읽어 **의미 손실 없이** 투영한다.
Rule 실행 시 Transition 레코드(Before / Input / Rule / After)를 남긴다.

```text
        WorldState
            ↓
    ObservableWorldState
      ↓      ↓      ↓
   Game   Debug   Designer
```

View 는 World 내부 구현을 직접 읽지 않는다 (P5). 이번 Cycle 에 View 가
Designer View 하나뿐이어도 이 경계를 만든다.

### 5. Trace 심기

Rule 코드에 자신이 구현하는 Intent / Possibility / Goal ID 를 남긴다.
Stage 5 의 Traceability 검사가 이것을 읽는다.

### 6. Runtime Instance 배치

Contract 가 정한 최소 instance 만 만든다 (예: `Arin` / `Pickaxe01` / `StoneDeposit01`).

## 금지

```text
Contract 의 Deferred 기능 구현 (RULE 6)
미래를 예측한 과잉 추상화 (RULE 8)
    UniversalResourceProviderFactory
    DistributedInteractionOrchestrator
    GenericMMORPGCapabilityResolver
Observable 없이 "동작하니까 완료" 선언
Precondition·State 생략
```

## DESIGN GAP

`02` 에 없는 의미가 필요해지면 임의로 만들지 말고
[../templates/DESIGN-GAP.md](../templates/DESIGN-GAP.md) 로 제출하고 중단한다.
"일단 이렇게 가정하고 구현" 은 금지다 (RULE 5).

## 종료

코드 + `04-IMPLEMENTATION-RESULT.md` → `context/CURRENT-CYCLE.md` 갱신 → **STOP.**
스스로 Verification 을 겸하지 않는다. Stage 5 는 별도 invocation 이다.
