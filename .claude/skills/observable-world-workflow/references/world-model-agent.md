# Stage 2 — World Model Agent

## 목적

Intent 를 **실행 가능한 세계 의미론으로 폐쇄**한다.

```
Intent → Required World State → World Rule → Observable Contract
```

## 읽는 것

```
Intent Package (INTENT-...)
common-invariants.md
artifact-contracts.md
```

## 읽지 않는 것

```
구현 코드
implementation-agent.md / verification-agent.md
원본 설계 문서 전체
```

의미 정의가 부족할 때만 `source-index.md` 를 거쳐 원본의 **해당 절만** 읽는다.

## 핵심 질문

Intent 의 **문장 조각 하나하나**에 대해 묻는다.

> 이 문장을 세계에서 사실로 만들려면 어떤 상태 또는 규칙이 존재해야 하는가?

```
"광맥을 알고 있다"        → Actor.Knowledge, Deposit.Identity
"적절한 도구를 가지고 있다" → Actor.Inventory, Tool.Capability
"접근 가능하다"           → Actor.Position, Deposit.Position, InteractionRange
"채굴한다"               → RULE-MINE-001
"자원을 얻는다"           → Inventory Transition
```

Intent 의 `Semantic Terms` 표에 있는 모든 항목이 **하나 이상의 State 또는 Rule 로 매핑**되어야 한다.

## 절차

1. **Required World State** 도출
   - 각 항목에 "Intent 의 어느 문장에서 왔는가" 를 표기한다.
   - `common-invariants.md` I3 로 걸러낸다 — Implementation State 는 넣지 않는다.
   - I4 확인 — 선택에 영향을 주는 Knowledge / Preference / Experience / Skill / CurrentGoal / CurrentPossibility 가 필요하면 **World State 로 올린다**.
2. **World Rule** 정의

```
RULE-<NAME>-<NNN>
  Implements:   INTENT-...
  Derived From: GOAL-... / POSSIBILITY-...

  Input          Actor, Deposit
  Preconditions  Actor.Alive == true
                 Actor.Knows(Deposit) == true
                 Actor.HasTool(Mining) == true
                 Distance(Actor, Deposit) <= MiningInteractionRange
                 Deposit.ResourceAmount > 0
  Transition     Deposit.ResourceAmount -= ExtractAmount
                 Actor.Inventory[Deposit.ResourceType] += ExtractAmount
  Result         <세계에 남는 사실>
```

   - Rule 은 코드 함수가 아니라 **세계에서 허용되는 상태 전이의 정의**다.
   - Intent 의 결과 문장이 Transition 에 전부 나타나야 한다.
3. **Observable Contract** 정의 — State/Rule 을 만들면서 **동시에** 정의한다. 구현 후에 Debug UI 를 붙이는 것이 아니다.

   질문: *인간이 이 Intent 가 실제로 세계에서 성립함을 확인하려면 무엇을 볼 수 있어야 하는가?*

   최소 노출 항목:

```
Actor / CurrentGoal / SelectedPossibility / CurrentRule
각 Precondition 의 개별 판정값 (true/false)
Before State / Input / Rule / After State
실행되지 않은 경우 Status=UNAVAILABLE 과 그 Reason
```

   Projection 은 **Semantic Lossless** 여야 한다 — 메모리 복제가 아니라, 설계 판단에 필요한 의미가 사라지지 않는다는 뜻이다.
4. **Required Views** — Designer / Debug / Game View 가 각각 Observable 의 무엇을 읽는지 적는다. View 는 World 내부를 직접 읽지 않는다 (I7).
5. **Semantic Closure Checklist** 작성 — Intent 문장 조각 × 대응 State/Rule 표. 빈 칸이 하나라도 있으면 이 Package 는 미완이다.
6. `artifacts/world/WORLD-<DOMAIN>-<NNN>.md` 를 `Review Status: DRAFT` 로 쓰고 REGISTRY 갱신.

## 하지 않는 것

- 클래스·파일·자료구조를 설계하지 않는다. (Stage 4 의 자유)
- Intent 문장의 의미를 다듬거나 확장하지 않는다.
- 스스로 `APPROVED` 를 쓰지 않는다. 출력은 항상 `DRAFT` 다.

## Design Gap 규칙

필요한 세계 의미가 현재 설계에 없다면 **임의로 확정하지 않는다**.

```
WORLD DESIGN GAP

Intent:            INTENT-MINING-001
Missing Semantic:  ToolCapability
Reason:            Mining 가능 여부를 표현할 World State 가 없음.
Proposed State:    Tool.Capability
Blocking:          yes
```

`artifacts/design-gaps/GAP-<NNN>.md` 로 기록하고 **STOP** 한다.

## 종료

`World Definition Package` (DRAFT) 를 생성하면 **STOP** 한다.
다음은 **Human Semantic Review** 이며, 자동으로 진행하지 않는다.
