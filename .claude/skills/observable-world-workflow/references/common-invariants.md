# Common Invariants — 모든 Stage 공유 최소 규칙

모든 Stage 가 이 문서를 로드한다. 이 문서는 세계 의미론 교과서가 아니라 **위반 판정 기준**이다.

## I1. Goal / Possibility 가 의도의 Source of Truth 다

구현 편의로 다음을 하지 않는다.

```
Goal 의미 변경
Possibility 추가 / 삭제
기존 관계 생략
구현이 어렵다는 이유의 경로 제거
새로운 목적의 임의 생성
```

설계 그래프를 바꾸는 것은 구현 변경이 아니라 **Design Change** 다. → Design Gap 으로 제출한다.

## I2. Intent 는 구현 요구사항이 아니라 세계 의미다

잘못된 Intent:

```
MiningComponent 를 만든다.
Mine() 함수를 만든다.
InventoryService 를 호출한다.
```

올바른 Intent:

```
광맥을 알고 있고,
적절한 도구를 가지고 있으며,
광맥에 접근 가능한 Actor 는
Mine 을 수행하여
광맥의 자원을 감소시키고
자신의 Stone 보유량을 증가시킬 수 있다.
```

Intent 에는 **세계에서 무엇이 참이어야 하는가**만 존재한다. 어떻게 구현할지는 Stage 4 의 책임이다.

## I3. World State 와 Implementation State 를 구분한다

World State (세계의 사실):

```
Actor.Position   Actor.HP   Actor.Inventory   Actor.Knowledge
Actor.Preference   Actor.Skill   Deposit.ResourceAmount
CurrentGoal   CurrentPossibility
```

Implementation State (프로그램의 사실):

```
planner.currentNodeIndex   cacheEntry   vector.capacity
threadId   hashBucket   temporaryScoreBuffer
```

판단 기준 한 문장: **이것은 세계의 사실인가, 프로그램 구현의 사실인가?**
세계의 사실만 World Semantic State 가 된다.

## I4. Decision Semantic State 도 World State 다

주체의 **선택에 영향을 주는** 다음 상태는 Planner 내부 변수로 숨기지 않는다.

```
Knowledge   Preference   Experience   Skill
CurrentGoal   CurrentPossibility
```

이들은 세계의 의사결정 의미이므로 **Observable 해야 한다**.

## I5. 의미 있는 상태 변화는 World Rule 에 귀속된다

```
WorldState(t)
      │  Rule + Input
      ▼
WorldState(t+1)
```

코드 어디선가 이유 없이 `stoneCount++` 하는 것은 금지다.
의미 있는 변화는 반드시 `Mine` / `Trade` / `Pickup` / `Reward` / `Spawn` 같은 **특정 World Rule 의 결과**여야 한다.

## I6. Semantic State 와 Transition 은 Observable 해야 한다

현재 상태만 보이는 것으로는 부족하다. 최소 관찰 단위:

```
Before   Input   Rule   After
```

Rule 의 **실행 여부에 영향을 주는 조건**과 **실행되지 않은 이유**도 관찰 가능해야 한다.

```
MineStone
  KnowsDeposit:      true
  HasMiningTool:     true
  InRange:           false
  DepositAvailable:  true

Status: UNAVAILABLE
Reason: Actor is out of interaction range
```

## I7. View 는 Observable World State 만 읽는다

```
              World
                ↓
         ObservableWorld
          ↓      ↓      ↓
       Game   Debug   Designer
```

View 가 World 내부 구현(Planner 내부, System 내부)을 직접 읽으면 서로 다른 세계를 보게 된다. 금지다.

## I8. 추적은 끝까지 이어진다

```
Goal → Possibility → Intent → Rule → State Transition
```

역방향(Runtime Transition → Rule → Intent → Possibility → Goal)도 성립해야 한다.
모든 Artifact 는 자신의 Trace 를 명시한다.

## I9. 설계가 부족하면 발명하지 않고 Gap 을 낸다

```
WORLD DESIGN GAP

Intent:            INTENT-MINING-001
Missing Semantic:  ToolCapability
Reason:            Mining 가능 여부를 표현할 World State 가 없음.
Proposed State:    Tool.Capability
Blocking:          yes
```

Agent 는 설계 변경을 **수행**하지 않고 설계 변경 **후보를 제출**한다. 그리고 STOP.

## I10. 완료 조건

```
코드가 컴파일된다 / 실행된다 / 테스트 하나가 통과한다   →  완료 아님
```

완료는 다음이다.
**설계 Intent 가 세계의 상태와 규칙으로 존재하고, 실제 상태 전이가 발생하며, 그 의미와 원인이 인간에게 설계 언어 그대로 관찰 가능하다.**
