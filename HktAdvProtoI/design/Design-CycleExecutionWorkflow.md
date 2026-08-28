# Cycle Execution Workflow — 단순화 최종안

## 1. Cycle의 정의

Cycle은 하나의 작고 관찰 가능한 플레이 결과를 실제 세계의 상태와 규칙으로 구현하고 검증하는 작업 단위다.

Cycle의 목적은 거대한 시스템을 한 번에 설계하는 것이 아니다.
이미 존재하는 기획에서 이번에 구현할 작은 범위를 선택하고,

> 기획 → 작은 명세 → 세계 의미와 규칙 → 구현 → 검증

순서로 실제 게임 세계에 하나씩 쌓아가는 것이다.

## 2. 전체 구조

```text
DESIGN
게임이 어떻게 작동해야 하는가?
        │
        ▼
CYCLE SPEC
이번 Cycle에서 정확히 무엇을 성립시킬 것인가?
        │
        ▼
WORLD SEMANTIC + RULE
세계에 무엇이 존재하며,
어떤 조건에서 어떻게 변화하는가?
        │
        ▼
IMPLEMENTATION
그 의미와 규칙을 실제 코드로 실행한다.
        │
        ▼
GAMEVIEW
그 결과를 플레이어가 관찰할 수 있게 표현한다.
        │
        ▼
VERIFICATION
기획한 결과와 실제 게임의 결과가 같은지 확인한다.
```

핵심은 각 단계가 이전 단계를 재해석하지 않는 것이다.
각 단계는 필요한 정보만 더 구체적인 형태로 변환한다.

## 3. 1단계 — DESIGN

### 목적

게임의 원리와 플레이 경험을 정의한다.
Design은 Human이 소유하는 원본 의미다.

예:

```text
NPC는 자신이 알고 있는 전투 지식을
행동 판단에 사용할 수 있다.

잘못된 지식을 가지고 있다면
잘못된 행동을 선택할 수도 있다.
```

또는:

```text
플레이어가 적의 공격 직전에 방어하면
피해를 완전히 막고 공격자를 노출시킨다.

일반적인 방어는 피해만 감소시킨다.
```

Design은 반드시 구현 구조를 설명할 필요가 없다.
다음과 같은 것은 Design의 책임이 아니다.

- CombatResolver
- StateMachine
- EventDispatcher
- Repository
- Component
- Factory
- Network Replication

Design이 대답해야 하는 것은 오직:

> 게임에서 무엇이 성립해야 하는가?

이다.

## 4. 2단계 — CYCLE SPEC

### 목적

큰 Design에서 이번 Cycle에서 실제로 구현할 범위만 잘라낸다.

Cycle Spec은 새로운 기획서가 아니다.
Design을 Goal Graph나 새로운 추상 구조로 다시 해석하지 않는다.
단지 이번 Cycle의 작업 범위를 명확하게 고정한다.

### 기본 형식

| 항목 | 내용 |
|---|---|
| Source | 어떤 Design에서 나온 작업인가? |
| 이번 Cycle에서 성립시킬 것 | 플레이어 또는 세계에서 어떤 결과를 만들 것인가? |
| 이번 Cycle에서 하지 않을 것 | 범위를 어디까지 제한하는가? |
| 검증 | 무엇을 직접 보면 완료라고 판단할 수 있는가? |

### 예시

**Source**

```text
Design-NPC-Combat-Knowledge.md
```

**이번 Cycle**

```text
Wolf는 Fire가 위험하다는 지식을 가질 수 있다.

FireDanger를 알고 있는 Wolf는
횃불을 든 Player가 접근하면 거리를 벌린다.

FireDanger를 모르는 Wolf는
동일한 상황에서도 기존 공격 행동을 유지한다.
```

**이번에 하지 않는 것**

- Wolf의 학습 과정
- 종족 간 지식 전파
- 장기 기억
- 잘못된 지식 수정
- 여러 종류의 위험 비교

**검증**

```text
동일한 상황에 두 Wolf를 배치한다.

Wolf A
FireDanger = Known

Wolf B
FireDanger = Unknown

Player가 Torch를 들고 접근한다.

A → Player에게서 멀어진다.
B → 기존 공격 행동을 수행한다.
```

## 5. Cycle Spec의 중요한 원칙

Cycle Spec은 Design에 없는 의미를 임의로 만들면 안 된다.

예를 들어 Design에:

```text
공격 직전에 Guard하면 Perfect Guard가 된다.
```

라고만 정의되어 있는데 Agent가 임의로:

```text
PerfectGuardWindow = 0.2 sec
```

를 결정하면 안 된다.

이 경우에는:

```text
UNRESOLVED
Perfect Guard 허용 시간
```

으로 남겨야 한다.

즉,

> 구현을 위해 새로운 게임 의미를 결정하는 것은 구현이 아니라 기획이다.

Agent는 이 둘을 구분해야 한다.

## 6. 3단계 — WORLD SEMANTIC

### 목적

Cycle Spec을 실제 세계가 보유해야 할 의미로 변환한다.

여기서는:

> 세계에 무엇이 존재해야 하는가?

를 정의한다.

예:

```text
Wolf
- knowledge
- behaviorState

Player
- heldItem

Knowledge
- subject
- dangerState
```

또는 Perfect Guard라면:

```text
Actor
- hp
- combatState

Attack
- attacker
- target
- impactTime
- damage

Guard
- actor
- startTime
- active
```

World Semantic은 코드 클래스 설계가 아니다.

- KnowledgeService
- KnowledgeRepository
- KnowledgeManager

같은 것을 정의하는 단계가 아니다.
여기서는 게임 세계가 이해해야 하는 개념과 상태만 정의한다.

## 7. 4단계 — WORLD RULE

### 목적

세계 상태가 어떤 조건에서 어떻게 변하는지를 정의한다.

World Rule의 기본 형태는 단순하다.

```text
현재 상태
+
행동 / 사건
+
조건
=
새로운 상태
```

예:

```text
IF
Wolf knows Fire is dangerous
AND
Player holds Torch

THEN
Wolf.behaviorState = AVOID
```

Perfect Guard라면:

```text
IF
GuardStart가 PerfectGuardWindow 안에 존재

THEN
Damage를 적용하지 않는다.
Attacker를 EXPOSED 상태로 만든다.
```

Rule은 최대한 Design의 언어와 직접 대응되어야 한다.

## 8. Semantic과 Rule의 관계

두 개를 따로 생각할 수 있지만 실제 작업에서는 하나의 구현 명세로 관리해도 된다.

```text
WORLD

State
─────
Player.HP
Player.GuardState

Enemy.CombatState

Attack.ImpactTime
Attack.Damage


Rule
────
Attack Impact 직전 Guard
→ Damage 0
→ Attacker EXPOSED
```

따라서 실제 Cycle에서는

- World Semantic
- World Rule

을 하나의 문서로 묶어도 된다.
중요한 것은 문서의 개수가 아니라 의미가 분명한 것이다.

## 9. 5단계 — IMPLEMENTATION

### 목적

World Semantic과 Rule을 실제 프로그램에서 실행한다.

여기에서 처음으로 소프트웨어 구조가 등장한다.

- Entity
- Component
- System
- Event
- Command
- State Machine
- Scheduler
- Network
- Storage

등이 필요할 수 있다.
하지만 매우 중요한 원칙이 있다.

### Implementation은 Design과 1:1 구조일 필요가 없다

예를 들어 Design에는:

```text
Perfect Guard
```

하나만 존재하더라도 실제 구현에는:

- AttackResolver
- CombatState
- InputBuffer
- WorldClock
- DamageSystem
- Replication

등 여러 코드 구조가 필요할 수 있다.
이것은 정상이다.

따라서:

```text
Design Concept
        ↕
Code Class
```

의 1:1 대응을 요구하지 않는다.

대신 반드시:

```text
Design
   ↓
Semantic / Rule
   ↓
Implementation
```

의 의미 추적은 가능해야 한다.

즉 모든 중요한 구현은:

> 어떤 World Semantic 또는 Rule을 성립시키기 위해 존재하는가?

를 설명할 수 있어야 한다.

## 10. 구현의 가장 중요한 제약

### 현재 의미보다 앞서 구현하지 않는다

미래의 MMORPG를 예상하여 구조를 미리 만들지 않는다.

현재 Cycle에서 필요한 것이:

```text
Attack
→ HP 감소
```

뿐이라면 그것을 구현한다.

아직 존재하지 않는 미래 요구를 예상하여:

- DamageProvider
- DamageStrategy
- DamagePipeline
- DamageModifierChain
- DamageConsumer
- DamageRegistry

등을 먼저 만들지 않는다.

### 추상화는 실제 반복에서 발견한다

잘못된 순서:

```text
미래에 필요할 것 같다
        ↓
Pattern 설계
        ↓
Framework 구축
        ↓
기능 구현
```

올바른 순서:

```text
구체적인 Rule 구현
        ↓
새 Cycle에서 또 다른 Rule 구현
        ↓
실제 중복 발견
        ↓
공통 구조 확인
        ↓
Refactoring / Abstraction
```

예:

| Cycle | 기능 |
|---|---|
| Cycle A | Poison |
| Cycle B | Burn |
| Cycle C | Bleed |

실제로 세 기능 모두:

```text
적용
→ 지속
→ 주기적 실행
→ 만료
```

를 반복한다면 그때:

```text
TimedEffect
```

라는 공통 구조를 추출한다.

## 11. Architecture도 Cycle과 함께 성장한다

Cycle은 기능만 점진적으로 추가하는 공정이 아니다.
소프트웨어 Architecture 역시 실제 요구에 따라 점진적으로 발견한다.

| Cycle | 기능 | 결과 |
|---|---|---|
| Cycle 1 | Attack | → HP 감소 |
| Cycle 2 | Guard | → 피해 감소 |
| Cycle 3 | Perfect Guard | → 피해 무효 + Exposed |

초기에는 각각 작은 Rule일 수 있다.
기능이 쌓이며 공통적인 전투 처리 구조가 명확하게 나타나면:

```text
CombatResolution
```

같은 공통 개념을 추출한다.

즉:

> Architecture가 미래의 기능을 결정하는 것이 아니라
> 실제 기능의 축적이 Architecture를 만든다.

## 12. GAMEVIEW

### 목적

World의 결과를 플레이어가 직접 관찰할 수 있는 형태로 표현한다.

GameView는 World의 의미를 새로 만들지 않는다.
World State를 표현한다.

예:

```text
Player.HP
→ HP Bar

Wolf.behaviorState = AVOID
→ Player 반대 방향으로 이동

Enemy.CombatState = EXPOSED
→ 노출 상태 Animation / Effect
```

World는 GameView의 구체적인 구현 방식을 알 필요가 없다.
World는 필요한 관측 상태만 제공한다.

## 13. VERIFICATION

### 목적

Cycle Spec에서 약속한 플레이 결과가 실제로 성립하는지 확인한다.

검증 기준은 구현 코드 구조가 아니다.
반드시 플레이 결과와 World State를 기준으로 한다.

예:

```text
Given

Wolf A
FireDanger = Known

Wolf B
FireDanger = Unknown


When

Player holds Torch
Player approaches both Wolves


Then

Wolf A → AVOID
Wolf B → ATTACK


PASS
```

Perfect Guard라면:

```text
Given

Player HP = 100
Enemy Attack Damage = 20


When

Perfect Guard 성공


Then

Player HP = 100
Enemy = EXPOSED
```

Human은 이 결과를 보고 Cycle의 성공 여부를 판단할 수 있어야 한다.

## 14. 전체 Trace

하나의 Cycle은 다음처럼 추적된다.

```text
DESIGN

"불의 위험성을 알고 있는 늑대는
횃불을 든 상대를 경계한다."

        ↓

CYCLE SPEC

이번 Cycle:
Knowledge 여부에 따라
Wolf 행동이 달라진다.

        ↓

WORLD SEMANTIC

Wolf.knowledge
Wolf.behaviorState
Player.heldItem

        ↓

WORLD RULE

Known FireDanger
+
Player holds Torch

→ AVOID

        ↓

IMPLEMENTATION

실제 Runtime Code

        ↓

GAMEVIEW

Wolf가 Player에게서 물러남

        ↓

VERIFICATION

Known Wolf → 물러남
Unknown Wolf → 공격

PASS
```

이 Trace가 유지되는 것이 중요하다.

## 15. Master Graph의 위치

Master Graph는 Cycle 구현 공정의 필수 단계가 아니다.

Master Graph의 역할은:

> 다음에 무엇을 만들 것인가?

를 탐색하는 것이다.

```text
World / Actor
      ↓
Goal
      ↓
Possibility
      ↓
Required Capability
      ↓
Missing Capability
      ↓
Frontier
```

Human이 Frontier를 선택하면 해당 결과가 Cycle의 작업 후보가 된다.
하지만 이후 구현은 Master Graph를 다시 해석하지 않는다.

```text
MASTER GRAPH
다음 작업 탐색
       │
       ▼
Human 선택
       │
       ▼
CYCLE
```

Human이 직접 다음 Cycle을 지정했다면 Master Graph를 거칠 필요도 없다.

예:

```text
Human:
"이번에는 인벤토리 장착을 구현한다."

        ↓

Design-Item
        ↓
Cycle Spec
        ↓
World Semantic / Rule
        ↓
Implementation
```

따라서 Master Graph는 설계 탐색 도구이고 Cycle은 구현 공정이다.
둘은 분리한다.

## 16. 기존 Intent 단계

별도의 Intent 문서는 필수 단계로 두지 않는다.

Cycle Spec에 이미:

- 누가
- 무엇을 할 수 있고
- 어떤 조건에서
- 어떤 결과가 발생하는지

명확하게 정의되어 있다면 별도의 Intent 문서는 동일한 내용을 다시 번역할 뿐이다.
정보를 추가하지 않는 단계는 제거한다.
필요한 의미는 Design과 Cycle Spec에서 직접 World Semantic으로 전달한다.

## 17. Cycle 산출물

하나의 Cycle은 최소한 다음 네 가지를 남긴다.

| # | 산출물 | 내용 |
|---|---|---|
| 1 | Cycle Spec | 이번에 무엇을 구현했는가 |
| 2 | World Semantic / Rule | 세계에 무엇이 추가되었고 어떻게 동작하는가 |
| 3 | Implementation | 실제 Runtime Code |
| 4 | Verification | 실제로 성립한다는 증거 |

GameView가 필요한 Cycle이라면 추가로:

```text
5. GameView Spec / Implementation
```

을 남긴다.

## 18. 기존 Cycle의 확장

이후 Cycle에서 기존 기능을 확장할 수 있다.

예:

| Cycle | 기능 |
|---|---|
| Cycle 10 | Inventory |
| Cycle 24 | Equipment |
| Cycle 38 | Item Durability |

Cycle 24가 Cycle 10을 복사하거나 다시 만드는 것이 아니다.
기존 World Semantic과 Rule을 기반으로 새로운 의미와 Rule만 추가한다.

```text
Existing

Inventory
- Item ownership
- Slot


New

Equipment
- EquipmentSlot
- EquippedItem

Rule

Inventory Item
+
Equip Action

→ EquippedItem
```

필요하다면 이 과정에서 기존 Implementation을 리팩터링할 수 있다.
하지만 기존의 관찰 가능한 행동은 유지해야 한다.

## 19. Cycle의 완료 조건

Cycle은 다음이 모두 만족될 때 완료된다.

| 조건 | 내용 |
|---|---|
| Design Trace | 이번 구현이 어떤 Design에서 나온 것인지 설명할 수 있다. |
| Scope | 이번 Cycle에서 무엇을 만들었는지 한두 문장으로 설명할 수 있다. |
| Semantic | 필요한 World State가 명확하다. |
| Rule | 어떤 조건에서 어떤 상태 변화가 발생하는지 명확하다. |
| Implementation | Semantic과 Rule이 실제 Runtime에서 실행된다. |
| Observable | 결과를 World State 또는 GameView에서 직접 확인할 수 있다. |
| Verification | Human이 추가적인 복잡한 추론 없이 성공 여부를 판단할 수 있다. |

## 20. 최종 원칙

Cycle Workflow의 핵심은 많은 단계를 만드는 것이 아니다.
Human의 기획 의미가 실제 게임 세계까지 손실되지 않고 내려가게 만드는 것이다.

따라서 최종 공정은 다음 한 줄로 정의한다.

```text
기획
→ 이번에 구현할 작은 명세
→ 세계의 의미와 규칙
→ 실제 구현
→ 관찰 가능한 검증
```

그리고 모든 Agent는 다음 원칙을 따른다.

- 기획을 임의로 재해석하지 않는다.
- Design에 없는 게임 의미를 Implementation에서 몰래 결정하지 않는다.
- 코드 구조는 Design과 1:1일 필요가 없지만 모든 구현은 어떤 Semantic/Rule을 실현하는지 추적 가능해야 한다.
- 미래 요구를 추측하여 Architecture를 미리 만들지 않는다.
- 추상화는 실제 Cycle에서 반복되는 구조가 발견되었을 때만 만든다.
- 각 Cycle의 결과는 사람이 직접 보고 성공과 실패를 판단할 수 있어야 한다.

## 최종 Cycle 구조

```text
┌────────────────────────────────────┐
│              DESIGN                │
│                                    │
│ 게임이 어떻게 작동해야 하는가?     │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│            CYCLE SPEC              │
│                                    │
│ 이번에 무엇을 성립시킬 것인가?     │
│ 어디까지 만들 것인가?              │
│ 어떻게 확인할 것인가?              │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│       WORLD SEMANTIC + RULE        │
│                                    │
│ 무엇이 존재하는가?                 │
│ 어떤 상태를 가지는가?              │
│ 어떤 조건에서 어떻게 변하는가?     │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│          IMPLEMENTATION            │
│                                    │
│ 현재 Rule을 실행하는 최소한의      │
│ Runtime 구조를 구현한다.            │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│             GAMEVIEW               │
│                                    │
│ World의 결과를 관찰 가능한 형태로   │
│ 표현한다.                           │
└─────────────────┬──────────────────┘
                  │
                  ▼
┌────────────────────────────────────┐
│           VERIFICATION             │
│                                    │
│ Cycle Spec에서 약속한 결과가        │
│ 실제로 성립하는지 확인한다.         │
└─────────────────┬──────────────────┘
                  │
                  ▼

        Reusable World Capability
                  │
                  ▼
             Next Cycle
```

Cycle은 기획을 추상 그래프로 번역하는 공정이 아니다.
기획의 작은 일부를 선택하여 실제 세계의 의미와 규칙으로 만들고, 그것이 게임에서 성립함을 검증하는 공정이다.
