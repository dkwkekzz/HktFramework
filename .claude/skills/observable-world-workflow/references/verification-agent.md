# Stage 5 — Verification Agent

## 목적

코드가 **실행되는지**가 아니라, **설계 의미가 Runtime 에서 실제로 닫혀 있는지** 검증한다.

## 입력

```
APPROVED World Definition Package (WORLD-...)
Implementation Result (IMPL-...)
Runtime evidence / 실행 가능한 환경
common-invariants.md
```

## 태도

주장을 믿지 않고 **재현**한다. `IMPL-*` 이 "구현했다" 고 적은 항목은 **코드 라인 인용 또는 실행 출력**으로 확인한다.
확인하지 못한 항목은 PASS 로 적지 않는다.

## 검증 1 — Semantic Closure

Intent 에 등장하는 **모든 의미**가 World Definition 과 코드에 존재하는가.

```
알고 있다          → Knowledge State
도구를 가지고 있다   → Inventory State
채굴 가능한 도구     → Tool Capability
가까이 있다         → Position / Range
채굴한다           → Mine Rule
자원을 얻는다       → Inventory Transition
```

**하나라도 연결되지 않으면 FAIL.**

## 검증 2 — Observable Closure

World Rule 의 **판단과 결과에 영향을 주는 의미가 모두 Observable** 한가.

```
Mine Precondition
  KnowsDeposit      true
  HasMiningTool     true
  InRange           false
  DepositAvailable  true

MineStone  UNAVAILABLE
Reason:    Actor is out of interaction range
```

- 개별 Precondition 판정값이 하나의 bool 로 뭉개져 있으면 FAIL.
- 선택에 영향을 주는 Knowledge / Preference / Experience / Skill / CurrentGoal / CurrentPossibility 가 노출되지 않으면 FAIL (I4).
- View 가 Observable 이 아니라 World 내부를 읽고 있으면 FAIL (I7).

## 검증 3 — Runtime Scenario

실제로 세계를 굴려 최소 다음을 관찰한다.

```
Before   Input   Rule   After
```

성공 경로 하나와 **실패(UNAVAILABLE) 경로 하나**를 모두 확인한다. 실패 경로에는 Reason 이 있어야 한다.

## 검증 4 — Traceability

```
Runtime Transition → World Rule → Intent → Possibility → Goal
```

역방향도 확인한다.

```
Goal → Possibility → Intent → Rules → Current Runtime Instances
```

끊긴 지점이 있으면 FAIL.

## 하지 않는 것

- 구현을 고치지 않는다. 검증은 판정이다. (실패 원인과 위치까지만 보고한다.)
- 설계를 고치지 않는다.
- 검증을 통과시키기 위해 Observable Contract 를 해석으로 완화하지 않는다.
- PASS 를 위해 테스트를 새로 작성해 "통과했다" 고 하지 않는다 — 증거는 **설계가 요구한 관찰**이지 새 테스트의 초록불이 아니다.

## 출력

`artifacts/verification/VERIFY-WORLD-<DOMAIN>-<NNN>.md`

```
Final Result: PASS | FAIL | BLOCKED BY DESIGN GAP
```

`Evidence` 에는 실제 실행한 명령과 그 출력을 인용한다. 인용 없는 PASS 는 무효다.

## 종료

`Verification Report` 를 생성하고 REGISTRY 를 갱신하면 **STOP** 한다.
FAIL 이어도 스스로 고치지 않는다 — 수정은 Stage 4 의 새로운 호출이다.
그 다음은 **Human Observation** 이다.
