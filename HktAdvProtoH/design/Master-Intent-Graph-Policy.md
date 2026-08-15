# Master Intent Graph 구성 정책

> 기존 `Design-Workflow.md`, `Design-CycleWorkflow.md` 의 Goal/Possibility 기반 Workflow 를 유지하면서,
> 대규모 MMORPG 의 Gameplay, World Cause, Actor Motivation, Narrative, Capability 를
> 하나의 추적 가능한 설계 그래프로 통합하기 위한 최종 정책.

---

## 1. 문서 목적

이 문서는 현재 프로젝트에 원래 존재하던 Goal/Possibility Graph 관련 Workflow 를 출발점으로 하여,
논의 과정에서 발견된 한계와 수정 과정을 정리하고, 최종적으로 채택한 Graph 구성 정책을 정의한다.

이 문서의 목적은 다음 세 가지다.

1. 기존 프로젝트 Workflow 에서 Graph 가 담당하던 역할을 보존한다.
2. MMORPG 전체 콘텐츠를 선형 기능 목록이 아니라 목적과 가능성의 연결망으로 생성할 수 있도록 Graph 의 표현력을 확장한다.
3. Gameplay 와 Narrative 를 분리된 후처리 Layer 로 다루지 않고, **왜 Goal 이 생기고 어떤 Possibility 가 선택 가능해지는가까지 하나의 설계 언어로 표현한다.**

최종적으로 Graph 는 단순한 `Goal Tree` 가 아니라 다음을 함께 표현하는 **Typed Directed Graph** 가 된다.

```text
World State / Cause
Actor
Knowledge / Belief
Goal
Possibility
Capability
World State Change / Consequence
```

이 문서에서는 이를 **Master Intent Graph** 라고 부른다.

이 정책이 이 저장소에서 실제로 어떤 파일과 어떤 명령으로 운용되는지는 **Part XVII** 이 담당한다.
Part I~XVI 은 정책 자체이고, Part XVII 이 이 프로젝트 구성에 대한 적용이다.

---

# Part I. 기존 프로젝트 Workflow 에서의 Graph

## 2. 기존 Design-Workflow 의 기본 구조

기존 프로젝트의 [Design-Workflow.md](Design-Workflow.md) 는 전체 설계 흐름을 다음과 같이 정의한다.

```text
               [Human Design]

        Goal Graph       Possibility Graph
             \                 /
              \               /
               └── Intent ───┘
                     │
                     ▼
              World Definition
              ┌──────────────┐
              │ World State  │
              │ World Rule   │
              └──────────────┘
                     │
                     ▼

               [Runtime World]

              World State(t)
                     │
                Input + Rule
                     │
                     ▼
              World State(t+1)
                     │
                     ▼
            Observable World State
                     │
              ┌──────┴──────┐
              ▼             ▼
          Rendering      Verification
```

기존 Workflow 의 핵심 전제는 다음과 같다.

- Goal/Possibility Graph 가 **게임 의도의 Source of Truth** 다.
- Intent 는 Goal/Possibility Graph 에서 추출된다.
- Intent 의 의미는 World State / World Rule 로 구체화되어야 한다.
- Runtime 의 의미 있는 결과는 Observable 해야 한다.
- Runtime Transition 은 다시 Rule → Intent → Possibility → Goal 까지 역추적 가능해야 한다.
- Implementation Agent 가 구현 편의 때문에 상위 설계 의미를 임의로 변경해서는 안 된다.

즉 기존 Graph 의 본래 목적은 "기능 목록" 을 만드는 것이 아니라
**게임에서 왜 어떤 가능성이 존재하는지에 대한 최고 수준의 설계 의도**를 보존하는 것이다.

---

## 3. 기존 Goal / Possibility 의 정의

기존 문서의 대표 예시는 다음과 같다.

```text
AcquireStone
│
├─ PickUpStone
├─ MineStone
├─ BuyStone
└─ ReceiveStone
```

그리고 Possibility 내부에 다시 Goal 이 연결될 수 있다.

```text
AcquireStone
    ↓
MineStone
    ↓
Requires Pickaxe
    ↓
AcquirePickaxe
```

여기에는 이미 중요한 원칙이 포함되어 있다.

### 3.1 Goal

Player 또는 World 관점에서 달성되어야 하는 목적 상태를 나타낸다.

```text
AcquireStone
```

### 3.2 Possibility

하나의 Goal 을 달성할 수 있는 대안적 방법을 나타낸다.

```text
PickUpStone
MineStone
BuyStone
ReceiveStone
```

따라서 본래 Goal/Possibility 관계는 처음부터 단순한 부모-자식 분해라기보다 다음 의미를 가진다.

```text
Goal
    └─ OR: 여러 Possibility 중 하나 이상으로 달성 가능

Possibility
    └─ AND: 해당 방법이 성립하기 위한 여러 조건/Goal 필요
```

---

## 4. 기존 Cycle Workflow 와 Graph 의 관계

[Design-CycleWorkflow.md](Design-CycleWorkflow.md) 에서는 Cycle 을 다음과 같이 정의한다.

```text
이번 Cycle 이 끝나면
Player 가 게임 안에서 정확히 무엇을 할 수 있어야 하는가?
```

Human 이 먼저 Cycle Goal 을 정의한다.

```text
Player 가 Pickaxe 를 가지고
Stone Deposit 에 접근하여
Stone 을 얻을 수 있다.
```

그 다음 Intent 단계가 이 Cycle Goal 을 Goal/Possibility 로 구성하고 Intent 를 추출한다.
이 저장소에서 실제로 도는 단계는 [Design-CycleExecution.md](Design-CycleExecution.md) 가 정의한 8단계다.

```text
Cycle Goal
    ↓
01-cycle.md              Cycle Definition
    ↓
02-intent.md             Goal / Possibility → Intent
    ↓
03-world-semantic.md     World State / Rule / Observable
    ↓
04-gameview.spec.yaml    GameView Specification
    ↓
05-review.md             Human Semantic Review
    ↓
06-world-implementation.md
07-view-implementation.md
    ↓
08-verification.md       Verification + Human Observation
```

따라서 기존 프로젝트에서의 책임 경계는 다음과 같이 유지한다.

### Human

- Root Game Goal 소유
- 중요한 Design Constraint 소유
- 다음 Cycle 에서 실제로 구현할 Cycle Goal 선택
- 설계 의미 변경 승인

### Agent

- 주어진 목적을 Goal/Possibility 구조로 확장
- Intent 추출
- Required World Semantic 도출
- 기존 Capability 재사용 탐색
- 구현 및 검증 Artifact 생성

이 책임 분리는 최종 정책에서도 변경하지 않는다.

추가로 최종 정책에서는 **Master Graph 의 Goal/Possibility 와 Cycle 내부 Goal/Possibility 를
서로 다른 목적의 설계 단계로 구분한다.** Master Graph 는 Human 이 무엇을 만들지 결정할 수 있도록
아이디어와 의미의 공간을 확장하고, Cycle-local Graph(`02-intent.md`)는 이미 결정된 Cycle Goal 을
구현 가능한 의미로 세분화한다. Master Graph 개선은 이 경계 아래의 Cycle 구현 Workflow 를 변경하지 않는다.

---

# Part II. 기존 Graph 를 MMORPG 전체로 확장하면서 발견된 문제

## 5. 문제 1 — Goal Graph 가 선형 작업 분해로 퇴화함

초기 확장 예시는 다음처럼 작성되었다.

```text
ROOT 캐릭터는 생존하여 거대 신을 제거해야 한다
→ 신에게 도달해야 한다
→ 세계를 이동할 수 있어야 한다
→ 목적지에 접근할 수 있어야 한다
→ 자신의 위치를 변경할 수 있어야 한다
→ 이동 가능한 지형 위를 이동할 수 있어야 한다
→ Player 가 입력을 통해 3D 지형 위에서 이동한다
```

이 구조의 문제는 명확하다.

`자신의 위치를 변경한다` 또는 `목적지에 도달한다` 에는 실제로 여러 방법이 존재한다.

```text
걷기
Mount
Ship
Portal
Summon
Flight
```

그런데 하나의 방법만 선택해 아래로 내려가면 Graph 는 사실상 긴 리스트가 된다.

### 수정

모든 Goal 에서 먼저 다음 질문을 한다.

> 이 Goal 을 달성할 수 있는 의미 있게 다른 Possibility 가 무엇인가?

그리고 Goal 은 여러 Possibility 로 횡방향 확장한다.

```text
G: 목적지에 도달한다

├─ P: 걸어서 간다
├─ P: Mount 로 간다
├─ P: Ship 으로 간다
├─ P: Portal 을 이용한다
├─ P: 다른 Player 에게 Summon 된다
└─ P: 비행한다
```

---

## 6. 문제 2 — Tree 로 표현하면 공유 Goal 이 복제됨

예를 들어 `충분한 Gold 를 확보한다` 는 다음 모든 콘텐츠가 필요로 할 수 있다.

```text
Mount 구매
Ship 구매
Potion 구매
Equipment 구매
Repair
Portal 사용
Housing
War Supply
```

Tree 라면 `AcquireGold` 를 각 Branch 에 계속 복제해야 한다.

### 수정

동일 의미 Goal 은 하나만 정의하고 여러 노드가 참조한다.

```text
BuyMount ---------\
BuyPotion ---------\
RepairEquipment ----> G: AcquireEnoughGold
UsePortal ---------/
BuyHouse ---------/
```

따라서 실제 구조는 Tree 가 아니라 **DAG 성격을 가진 Directed Graph** 다.

단, 최종 Master Intent Graph 에서는 World State 변화와 Narrative progression 까지 표현하므로
항상 순수한 수학적 DAG 만을 강제하지 않는다. Design dependency 영역은 가능한 한 비순환적으로 유지하고,
Runtime state 변화나 반복 가능한 관계는 별도의 State Transition 의미로 다룬다.

---

## 7. 문제 3 — Leaf 와 Cycle Goal 의 의미가 혼동됨

초기에는 Graph 의 말단 Goal 을 그대로 Cycle Goal 이라고 간주했다.

그러나 Graph 는 필요하면 계속 세분화할 수 있다.

```text
Player 가 Stone 을 채굴한다
    ↓
Deposit 을 안다
Tool 을 가진다
Range 안에 있다
Mine Action 을 수행한다
...
```

따라서 절대적인 `Leaf` 를 정의하기 어렵다.

### 수정: Frontier 개념

Cycle Goal 은 절대적 Leaf 가 아니라 **현재 구현 상태 기준의 Frontier** 다.

```text
Frontier Goal / Frontier Capability
=
현재 Existing World 에는 아직 없지만,
하나의 새로운 플레이 가능성을 추가하고
실제 Client 에서 명확한 결과로 검증할 수 있는
가장 작은 단위
```

Human 은 Master Graph 에서 현재 Frontier 후보 중 하나를 선택해 다음 Cycle Goal 로 사용한다.

중요한 점은 Master Graph 의 한 노드가 Cycle 내부에서는 다시 세분화될 수 있다는 것이다.

---

## 8. 문제 4 — 저수준 Capability 까지 Goal 로 표현함

초기 Graph 에서는 다음과 같은 것들도 모두 Goal 로 취급했다.

```text
걸을 수 있다
점프할 수 있다
Inventory 에 Item 을 넣을 수 있다
근접 공격할 수 있다
NPC 와 대화할 수 있다
```

그러나 이런 항목은 대개 "누가 왜 원하는가" 를 가진 목적이라기보다
여러 목적에서 재사용되는 **Capability** 다.

```text
G: 신의 성채에 도달한다

P: 육로로 침투한다
requires:
    K: 성채 위치를 안다
    C: Walk
    C: Jump
    C: Combat
    S: Route 가 열려 있다
```

`Walk` 를 다시 Goal 로 만들어 `왜 걷고 싶은가?` 를 물을 필요는 없다.

### 수정

최종 Graph 에서는 `Goal` 과 `Capability` 를 분리한다.

- Goal: Actor 가 어떤 이유로 달성하려는 상태
- Capability: Goal/Possibility 를 수행하기 위해 재사용되는 플레이/세계 능력

이 구분으로 상위 설계 Graph 가 구현 세부로 불필요하게 길어지는 것을 방지한다.

---

# Part III. Narrative 를 별도 Graph 로 두려 했던 중간안과 문제점

## 9. 중간안 — 3 Layer 구조

Gameplay Goal Graph 만으로는 스토리가 부족하다는 문제가 발견되었다.

```text
G: 식량을 확보한다
P: 야생 동물을 사냥한다
```

만으로는 다음이 설명되지 않는다.

- 왜 지금 사냥이 필요한가?
- 어떤 NPC 가 이 문제와 관계되어 있는가?
- 특별한 Creature 가 존재하는가?
- 누구와 누구의 이해관계가 충돌하는가?
- Player 의 선택에 따라 무엇이 달라지는가?

그래서 한때 다음 3 Layer 모델을 제안했다.

```text
World Causal Graph
+
Narrative Graph
+
Goal / Possibility Graph
```

예:

```text
World Cause:
God -> Divine Anchor -> Forest Corruption -> Deer Migration -> Food Shortage

Narrative:
Rowan / Elia / Forest Wardens / Blackhorn

Gameplay:
Hunt / Track / Protect / Tame / Trade
```

이 접근은 Story Thread 를 생성하는 데는 유용했지만 구조적으로 한계가 있다.

---

## 10. 문제 5 — Narrative 가 Goal 에 붙는 후처리 장식처럼 됨

별도의 Narrative Graph 를 Gameplay Graph 위에 "겹친다" 고 정의하면 다음 관계가 불분명해진다.

```text
어떤 Narrative 사건이
정확히 어떤 Goal 을 생성하는가?

NPC 의 Belief 가
어떤 Possibility 를 열거나 닫는가?

Player 가 새로운 사실을 알게 되었을 때
왜 Goal/Possibility Graph 가 달라지는가?

어떤 선택이
다른 Actor 의 Goal 을 지원하거나 방해하는가?
```

실제 게임에서 Narrative 는 Goal 에 붙는 설명이 아니다.

Narrative 요소가 Goal 자체를 생성한다.

```text
마을의 식량 부족
    ↓ motivates
Rowan: Hunting Ground 를 복구하고 싶다
    ↓ belief
"Blackhorn 이 Deer 를 몰아냈다"
    ↓ creates
Rowan: Blackhorn 을 제거하고 싶다
```

따라서 Narrative 와 Goal 은 강하게 결합되어 있으며
독립적인 두 설계 구조로 분리하는 것이 부자연스럽다.

---

# Part IV. 최종 결론 — Master Intent Graph

## 11. 최종 원칙

최종적으로 `Goal/Possibility Graph + Narrative Graph + World Causal Graph` 를 별개의 Graph 로 유지하지 않는다.

대신 **하나의 Typed Master Intent Graph** 로 통합한다.

```text
                    MASTER INTENT GRAPH

      WORLD STATE / CAUSE
               │
               │ causes / motivates
               ▼
        ACTOR ────────> GOAL
          │              │
          │              │ OR
          │              ▼
          │         POSSIBILITY
          │          /    |    \
          │         /     |     \
          │ requires    changes   affects
          ▼       ▼        ▼        ▼
       BELIEF  CAPABILITY WORLD    OTHER
       KNOWLEDGE          STATE    GOALS
          │                         │
          └──── reveals/reframes ───┘
```

Narrative 는 더 이상 별도 Node Type 이나 별도 Graph 가 아니다.

**World Cause → Actor Belief/Desire → Goal → Possibility → Consequence → Knowledge/Goal 변화**
로 이어지는 경로 자체가 Narrative 다.

---

## 12. 최종 Node Type

### 12.1 WorldState

World 에서 현재 참인 의미 있는 상태다.

```text
W101 Forest 가 Corrupted 상태다
W102 Deer 개체군이 북쪽으로 Migration 중이다
W103 Village 의 Food Supply 가 부족하다
W104 Blackhorn.alive == true
```

WorldState 는 Narrative 배경이 아니라 Goal 과 Possibility 를 발생시키는 실제 원인이다.

### 12.2 Actor

자기 관점, 이해관계, Goal 을 가질 수 있는 주체다.

```text
Player
Hunter Rowan
Herbalist Elia
Forest Wardens
Blackhorn
Faction
Guild
Settlement
```

필요하다면 조직이나 집단도 Actor 로 취급할 수 있다.

### 12.3 Knowledge / Belief

Actor 가 알고 있거나 사실이라고 믿는 정보다.

`Knowledge` 와 `Belief` 를 구분하는 이유는 Actor 의 행동이 객관적 World State 가 아니라
**그 Actor 가 알고 있다고 생각하는 것**에 의해 결정될 수 있기 때문이다.

```text
K100 Player knows BlackhornLocation

B100 Rowan believes:
    Blackhorn causes Deer migration
```

Belief 는 틀릴 수 있다. 이 차이가 Mystery, Investigation, Reversal 을 만든다.

이 구분은 이 프로젝트에서 새로 도입하는 개념이 아니다 —
[Design-Concept.md](Design-Concept.md) §4.1 이 이미 주체의 지식과 믿음을 세계 의미로 정의한다.

### 12.4 Goal

특정 Actor 가 어떤 이유로 원하는 Desired State 다.

Goal 은 더 이상 단순히 "세계에서 참이어야 하는 상태" 만으로 정의하지 않는다.

권장 Schema:

```text
Goal {
    id
    owner
    desired_state
    motivation
    belief_context
    stakes
}
```

예:

```text
G101
owner:
    Rowan

desired_state:
    Village.HuntingGround == restored

motivation:
    Village 의 Food Supply 를 회복하고 싶다

belief_context:
    Rowan believes Blackhorn causes Deer migration

stakes:
    Village 의 장기 생존
```

상위 Narrative/Content Goal 은 최소한 `owner`, `desired_state`, `motivation` 이 설명되어야 한다.

### 12.5 Possibility

하나의 Goal 을 달성하거나 진전시키는 후보 방법이다.

Possibility 는 단순 Action 이름이 아니라 **의미 있는 선택 경로** 다.

권장 Schema:

```text
Possibility {
    id
    achieves
    requires
    supports
    opposes
    changes
    reveals
    creates_goal
}
```

예:

```text
P201 KillBlackhorn

achieves:
    G200 Village Hunting 문제를 해결한다

requires:
    C_Combat
    C_Travel
    K_BlackhornLocation

supports:
    G101 Rowan 의 Goal

opposes:
    G120 Warden 의 Blackhorn 보호 Goal

changes:
    W104 Blackhorn.alive = false
    Rowan.Reputation +=
    Warden.Reputation -=

reveals:
    Blackhorn 이 죽어도 Forest Corruption 은 지속됨

creates_goal:
    G210 실제 Corruption 원인을 조사한다
```

### 12.6 Capability

여러 Goal/Possibility 가 공통으로 재사용하는 플레이 또는 World 능력이다.

```text
C_Walk
C_Jump
C_Combat
C_Loot
C_Talk
C_Trade
C_Track
C_Tame
C_Mine
C_Craft
C_Party
```

Capability 는 **왜 해야 하는가** 를 설명하지 않는다.

그 Capability 를 **왜 지금 사용하는가** 는 Goal/Possibility 경로가 설명한다.

이것이 Goal 과 Capability 의 핵심 차이다.

---

## 13. 최종 Edge Type

Master Intent Graph 에서는 관계의 의미를 명시해야 한다.

### CAUSES

World State 가 다른 World State 를 발생시킨다.

```text
Divine Anchor --CAUSES--> Forest Corruption
```

### MOTIVATES

World State, Knowledge, Event 가 Actor 의 Goal 형성을 자극한다.

```text
Food Shortage --MOTIVATES--> Rowan's RestoreHuntingGround Goal
```

### WANTS

Actor 가 Goal 을 소유한다.

```text
Rowan --WANTS--> RestoreHuntingGround
```

### BELIEVES / KNOWS

Actor 와 Knowledge/Belief 를 연결한다.

```text
Rowan --BELIEVES--> Blackhorn caused migration
```

### ACHIEVES

Possibility 가 Goal 을 달성하거나 진전시킨다.

```text
KillBlackhorn --ACHIEVES--> RestoreHuntingGround
```

### REQUIRES

Possibility 가 성립하기 위해 필요한 Capability, Knowledge, World State 또는 다른 Goal 을 연결한다.

```text
KillBlackhorn --REQUIRES--> C_Combat
              --REQUIRES--> K_BlackhornLocation
```

### SUPPORTS

Possibility 가 다른 Actor Goal 에 도움을 준다.

```text
KillBlackhorn --SUPPORTS--> Rowan Goal
```

### OPPOSES

Possibility 가 다른 Actor Goal 을 방해한다.

```text
KillBlackhorn --OPPOSES--> Warden ProtectBlackhorn Goal
```

### CHANGES

Possibility 실행 결과 World State 가 변한다.

```text
KillBlackhorn --CHANGES--> Blackhorn.alive = false
```

### REVEALS

Action/State 변화가 새로운 Knowledge 를 공개한다.

```text
InvestigateCorpse --REVEALS--> Corruption is not caused by Blackhorn
```

### REFRAMES

새 Knowledge 가 기존 Goal 의 의미나 우선순위를 다시 해석하게 만든다.

```text
Blackhorn is not the cause --REFRAMES--> KillBlackhorn Goal
```

### CREATES_GOAL

새 State/Knowledge 가 새로운 Goal 을 발생시킨다.

```text
Knowledge: Divine Anchor is corrupting forest
    --CREATES_GOAL--> Destroy / Purify Anchor
```

---

# Part V. Goal / Possibility 의 최종 의미

## 14. Goal → Possibility 는 OR

하나의 Goal 에는 원칙적으로 여러 방법이 존재할 수 있다.

```text
G: Village 의 Food Problem 을 해결한다

├─ P: Blackhorn 을 죽인다
├─ P: 진짜 원인을 조사한다
├─ P: 다른 Hunting Ground 를 찾는다
├─ P: Fishing 으로 대체 식량을 확보한다
├─ P: Caravan 으로 식량을 공급한다
└─ P: Forest Corruption 을 정화한다
```

단순한 표현상의 동의어는 별도 Possibility 로 만들지 않는다.

Possibility 는 플레이 방식, 관계, 비용, 위험, 결과 중 하나 이상이 실질적으로 달라야 한다.

---

## 15. Possibility → Requirements 는 AND

특정 Possibility 를 선택하려면 여러 조건이 동시에 충족되어야 할 수 있다.

```text
P: Blackhorn 을 추적해 원인을 조사한다

requires:
    C_Travel
    C_Track
    K_BlackhornLastKnownLocation
    W: Trackable traces exist
```

이 Requirements 는 새로운 Goal 일 수도 있고, Capability/Knowledge/WorldState 일 수도 있다.

이 점이 기존 `Possibility → Requires Goal` 모델에서 확장된 부분이다.

---

## 16. Goal 은 가능한 한 Actor-Owned 여야 한다

상위 콘텐츠 Goal 은 다음 질문에 답할 수 있어야 한다.

```text
누가 이 상태를 원하는가?
왜 원하는가?
무엇을 사실이라고 믿기 때문에 원하는가?
실패하면 무엇을 잃는가?
```

답할 수 없다면 다음 두 경우를 검토한다.

1. 사실은 Goal 이 아니라 Capability 다.
2. 아직 Motivation/Narrative Context 가 정의되지 않은 불완전한 Goal 이다.

```text
"걸을 수 있다"                                   → 대체로 Capability
"Player 는 무너지는 숲에서 살아남기 위해
 안전한 마을에 도달하려 한다"                     → Goal
```

---

# Part VI. Narrative 의 최종 정의

## 17. Narrative 는 별도 Graph 가 아니다

최종 정책에서 Narrative 는 다음 경로다.

```text
World Cause
    ↓
Actor 가 상황을 인식하거나 오해함
    ↓
Actor Goal 생성
    ↓
Goal Conflict
    ↓
Player 가 Possibility 를 선택
    ↓
World State / 관계 변화
    ↓
새로운 Knowledge 공개
    ↓
Goal 이 생성되거나 Reframe 됨
```

즉 Narrative 는 Graph 위에 붙는 Text Layer 가 아니라
**Master Intent Graph 의 인과적 진행 자체** 다.

---

## 18. Main Story 와 Side Story 를 구조적으로 분리하지 않는다

Graph 관점에서 Main Story 와 Side Story 는 같은 구조를 가진다.

차이는 주로 다음과 같다.

- Root Goal 과의 거리
- 영향을 주는 World State 범위
- 관련 Actor 수
- Consequence 의 규모
- 전체 진행에 대한 중요도

```text
Blackhorn 문제
    ↓
Forest Corruption
    ↓
Divine Anchor
    ↓
God Influence
    ↓
Root Goal
```

처음에는 Local Side Story 처럼 보이지만 조사 결과 Main Story 와 직접 연결될 수 있다.

따라서 `Main Quest`, `Side Quest` 는 Graph Node Type 이 아니라
이후 Content Classification/Presentation 으로 취급한다.

---

# Part VII. Canonical Example — Blackhorn

이 Part 는 정책의 형태를 보여 주는 예시다 — 이 저장소의 세계 설정이 아니다.
M1 이 만드는 `master/graph/R0xx-*.yaml` 이 같은 형태를 따른다.

## 19. World Cause

```text
W001 거대 신의 Divine Influence 가 세계에 퍼진다
    │
    └─CAUSES→ W100 북부 숲의 Divine Anchor 가 활성화된다
                    │
                    └─CAUSES→ W101 Forest Corruption
                                    │
                                    └─CAUSES→ W102 Deer Migration
                                                    │
                                                    └─CAUSES→ W103 Village Food Shortage
```

## 20. Actor Goal 생성

### Rowan

```text
A100 Rowan

W103 Food Shortage --MOTIVATES--> G101 Restore Hunting Ground

A100 --BELIEVES--> B100 "Blackhorn 이 Deer 를 몰아냈다"

B100 --CREATES_GOAL--> G102 Kill Blackhorn
```

### Elia

```text
A110 Elia

W101 Forest Corruption --MOTIVATES--> G110 Discover true cause of forest anomaly
```

### Forest Wardens

```text
A120 Forest Wardens

K120 Blackhorn is an Ancient Guardian --MOTIVATES--> G120 Protect Blackhorn
```

### Blackhorn

```text
A130 Blackhorn

W101 Corruption --MOTIVATES--> G130 Move Deer herd to a safe region
```

이 순간 이미 Narrative 가 발생한다.

```text
Rowan wants Blackhorn dead
        VS
Wardens want Blackhorn alive
        VS
Elia wants investigation first
        VS
Blackhorn is trying to protect the herd
```

## 21. Player Goal 과 Possibility

Player 가 Rowan 과 대화하고 문제를 받아들인다면:

```text
G200
owner:          Player
desired_state:  Village Hunting/Food problem is resolved
```

가능한 경로:

```text
G200
│
├─ P201 Kill Blackhorn
│   requires { C_Travel, C_Combat, K_BlackhornLocation }
│   supports { G102 Rowan }
│   opposes  { G120 Wardens, G130 Blackhorn }
│
├─ P202 Track Blackhorn and investigate
│   requires { C_Travel, C_Track }
│   reveals  { K_CorruptionEvidence }
│
├─ P203 Protect Blackhorn and remove Poachers
│   requires { C_Combat, C_FactionInteraction }
│   supports { G120 Wardens }
│
├─ P204 Tame / ally with Blackhorn
│   requires { C_Tame, K_BlackhornNature }
│
└─ P205 Build alternate food supply
    requires { C_Fishing | C_Farming | C_Trade | C_Caravan }
```

중요한 점은 모든 Possibility 가 처음부터 Player 에게 보일 필요가 없다는 것이다.

Knowledge 에 따라 Graph 의 **runtime availability** 가 달라질 수 있다.

## 22. Knowledge 가 Possibility 를 바꾼다

처음 Player 가 Rowan 의 주장만 알고 있다면:

```text
Known Possibilities
- Kill Blackhorn
- Find another Hunting Ground
```

Elia 의 조사 결과를 알게 되면:

```text
NEW Knowledge   Blackhorn 이 Deer 를 공격한 흔적이 없다
NEW Possibility Investigate Corruption
```

Wardens 의 Knowledge 를 얻으면:

```text
NEW Knowledge     Blackhorn 은 Deer 를 안전한 곳으로 유도 중이다
NEW Possibilities Protect Blackhorn / Purify Corruption
```

따라서 Narrative progression 은 단순 Text 진행이 아니라
**Goal/Possibility availability 의 변화** 다.

---

# Part VIII. Master Graph 와 Runtime 의 관계

## 23. Design Possibility 와 Runtime Availability 를 구분한다

Master Intent Graph 에는 설계상 가능한 모든 주요 Possibility 가 존재할 수 있다.

하지만 Runtime 에서는 다음 이유로 현재 사용 불가능할 수 있다.

```text
Capability 부족
Knowledge 부족
World State 불충족
Actor 관계 부족
Resource 부족
다른 선택의 결과로 폐쇄됨
```

```text
P204 Tame Blackhorn

Design:   EXISTS
Runtime:  UNAVAILABLE
Reason:   Player does not know Blackhorn is a guardian.
          Player lacks Taming capability.
```

기존 프로젝트가 Goal/Possibility 의 Runtime 상태도 Observable 해야 한다는 원칙과 연결된다
(`Design-CycleWorkflow.md` §17 Designer Observation).

### 23.1 Design-Concept 의 공유 Runtime Graph 와의 관계

[Design-Concept.md](Design-Concept.md) §8.5 는 **Runtime 의 공유 목적·가능성 그래프** 를 정의한다 —
종·문화 단위로 미리 정의된 정적 가능성 공간이며, 개별 주체는 자기 지식·숙련도·선호로
그중 일부 경로만 인식하고 활성화한다.

Master Intent Graph 는 그것과 같은 것이 아니다. 둘은 다음 관계다.

```text
Master Intent Graph            설계 시간. 무엇을 만들 것인가.
    │                          Human 이 읽고 Cycle 을 고르는 대상.
    │  Cycle 을 거쳐 구현되면
    ▼
World Semantic / Rule          실행 시간. 세계가 실제로 아는 것.
    │
    ▼
공유 목적·가능성 그래프          Runtime. 주체가 행동을 고르는 구조.
(Design-Concept §8.5)          NPC 결정과 Player 가용 경로 판정.
```

Master Graph 의 Possibility 가 Runtime 의 가능성 노드로 그대로 복사되는 것이 아니다.
Master Graph 의 Possibility 는 Cycle 을 통해 World Rule 로 닫히고,
그 Rule 이 성립하는 조건이 Runtime 그래프의 경로 가용성이 된다.

한 방향으로만 말하면 다음과 같다.

```text
Master Graph 에 없는 Possibility 는 설계되지 않은 것이고,
World Rule 로 닫히지 않은 Possibility 는 아직 플레이할 수 없는 것이며,
Runtime 에서 주체가 인식하지 못하는 경로는 지금 그 주체에게 없는 것이다.
```

---

## 24. 기존 Design → Runtime Traceability 는 유지한다

기존 구조:

```text
Goal → Possibility → Intent → World State / Rule → Runtime Transition → Observable
```

최종 구조에서는 상위 Trace 가 확장된다.

```text
World Cause / Actor / Belief
            ↓
           Goal
            ↓
       Possibility
            ↓
          Intent
            ↓
    World State / Rule
            ↓
    Runtime Transition
            ↓
        Observable
```

그리고 역방향도 가능해야 한다.

```text
Observed Runtime Event
    ↓
World Rule
    ↓
Intent
    ↓
Possibility
    ↓
Goal
    ↓
Actor Motivation / World Cause
```

이것이 최종 Graph 확장의 가장 중요한 목적이다.

**게임 안에서 발생하는 행동이 단지 어떤 기능에서 나온 것인지가 아니라,
왜 이 세계에서 이 행동이 존재하는지까지 역추적 가능해야 한다.**

---

# Part IX. Cycle Workflow 와 최종 Graph

## 25. Master Intent Graph 는 Cycle 을 자동 선택하지 않는다

Master Graph 가 거대해져도 다음 Cycle Goal 의 선택권은 Human 에게 있다.

Agent 는 다음을 제공한다.

```text
Current World Capability Overlay
Implemented / Partial / Missing

+

Master Intent Graph

↓

Frontier Candidates
```

Human 이 Frontier 중 하나를 선택한다.

---

## 26. Frontier 후보의 정의

Frontier 후보는 다음 조건을 만족해야 한다.

1. 아직 Existing World 에서 완전히 제공되지 않는다.
2. 하나 이상의 상위 Goal/Possibility 를 실제로 전진시킨다.
3. Player 가 Client 에서 직접 플레이하여 명확한 결과를 확인할 수 있다.
4. 하나의 Cycle 안에서 의미적으로 폐쇄 가능한 크기다.
5. 단순 구현 Task 가 아니라 새로운 World/Game Capability 다.

```text
BAD   Inventory System 구현
GOOD  Player 가 Loot 한 Item 을 Inventory 에 획득하고 이후 사용할 수 있다.
```

```text
BAD   Tracking System 구현
GOOD  Player 가 숲의 Footprint 를 조사하여 대상이 이동한 방향을 알아낼 수 있다.
```

후자의 경우 Master Intent Graph 에서 다음처럼 추적된다.

```text
G200 Village 문제 해결
    ↓
P202 Track Blackhorn
    ↓ requires
Missing Capability: C_Track
    ↓
Human selects Cycle Goal
    ↓
"Player 가 Footprint 를 조사하여 이동 방향을 추적할 수 있다"
```

---

## 27. Cycle 내부 Workflow 는 변경하지 않는다

이번 Master Intent Graph 개선은 **Cycle 이전의 Master Design / Idea Expansion 영역을 개선하는 것** 이다.

Master Intent Graph 는 다음 질문을 다룬다.

```text
무엇을 게임에 만들 것인가?
왜 그것이 필요한가?
누가 그것을 원하는가?
어떤 세계 상태와 Story 에서 그 목적이 생기는가?
같은 목적을 달성하는 다른 Possibility 는 무엇인가?
어떤 Capability 가 여러 콘텐츠에서 재사용되는가?
```

Human 이 이 설계 공간에서 하나의 Frontier 를 선택하여 **Cycle Goal 을 확정하는 순간**,
Master Design 단계의 역할은 끝난다.
그 이후는 이 저장소가 이미 정의한 8단계 Cycle Workflow 의 문제로 환원된다.

```text
==================================================
          MASTER DESIGN / IDEA EXPANSION
==================================================

Master Intent Graph                      master/graph/
    │
    ├─ World Cause / State
    ├─ Actor / Motivation / Belief
    ├─ Goal / Possibility
    ├─ Conflict / Consequence
    └─ Capability Reference
    │
    ▼
Existing World Capability Overlay        npm run master
    │
    ▼
Frontier Candidates                      master/frontier.md
    │
    │ Human Design Decision
    ▼
Cycle Goal 확정

==================================================
                CYCLE BOUNDARY
==================================================

"이번 Cycle 이 끝나면
 Player 가 게임 안에서 정확히 무엇을 할 수 있어야 하는가?"

==================================================
          EXISTING CYCLE WORKFLOW (8 Stage)
==================================================

01-cycle.md               Cycle Definition
    ↓
02-intent.md              Cycle-local Goal/Possibility + Intent
    ↓
03-world-semantic.md      World State / Rule / Observable
    ↓
04-gameview.spec.yaml     GameView Specification
    ↓
05-review.md              Human Semantic Review
    ↓
06-world-implementation.md
07-view-implementation.md
    ↓
08-verification.md        Verification + Human Observation
    ↓
Existing MMORPG gains New Capability
    │
    └──────────────> Master Graph Overlay Update
```

### 27.1 Master Goal/Possibility 와 Cycle-local Goal/Possibility 는 목적이 다르다

두 단계 모두 `Goal/Possibility` 라는 표현을 사용할 수 있지만 역할은 서로 다르다.

#### Master Intent Graph 의 Goal/Possibility

질문:

> 게임에 어떤 경험과 가능성을 만들 것인가?

목적:

- 아이디어 공간 확장
- Story / World Cause / Actor Motivation 부여
- 대안 Possibility 탐색
- 콘텐츠 간 관계와 재사용 Capability 발견
- Human 이 선택할 Frontier 후보 생성

```text
G: Village 의 Food Problem 을 해결한다

├─ P: Blackhorn 을 죽인다
├─ P: 원인을 조사한다
├─ P: 다른 Hunting Ground 를 찾는다
├─ P: 대체 식량 공급망을 만든다
└─ P: Forest Corruption 을 정화한다
```

#### Cycle-local Goal/Possibility (`02-intent.md`)

질문:

> 이미 결정된 하나의 플레이 결과가 실제 World 에서 성립하려면 무엇이 가능해야 하는가?

목적:

- Human 이 확정한 Cycle Goal 의 semantic decomposition
- 구현에 필요한 세부 목적과 조건의 폐쇄
- Intent 추출
- World State / Rule 로 이어질 의미 정의

```text
Cycle Goal:
Player 가 숲의 Footprint 를 조사하여 대상이 이동한 방향을 알아낼 수 있다.

Cycle-local decomposition:

G: Footprint 로부터 이동 방향을 알아낸다

P: Footprint 를 직접 조사한다

requires:
    Footprint 를 인식할 수 있다
    Footprint 에 접근할 수 있다
    Footprint 를 조사할 수 있다
    조사 결과 Direction Knowledge 를 얻는다
```

이 단계에서는 다시 Story 를 확장하거나 Actor Conflict 를 새로 생성할 필요가 없다.
**무엇을 만들 것인지는 이미 Cycle Goal 로 결정되었기 때문이다.**

### 27.2 Cycle Goal 의 출처는 Cycle 내부 Workflow 와 독립적이다

Cycle Goal 은 다음 어디에서든 나올 수 있다.

```text
Master Intent Graph
Human designer intuition
Story idea
Player feedback
Existing gameplay problem
Technical opportunity that Human promotes into a design goal
```

하지만 Human 이 Cycle Goal 을 확정한 뒤에는 출처와 무관하게 동일한 기존 Cycle Workflow 를 사용한다.

따라서 Master Intent Graph 의 도입 때문에 `01-cycle.md` 에
`Actor`, `Narrative Context`, `World Cause`, `served_goals` 같은 필드를
**새로운 필수 입력으로 추가하지 않는다.**
필요하면 `MASTER TRACE` 로 참조할 수 있지만 그것은 **선택 항목(Provenance)** 이며,
Cycle 구현 파이프라인의 필수 의미는 확정된 Cycle Goal 자체가 소유한다.

기존 Cycle 이 `MASTER TRACE` 없이 완료된 것도 결함이 아니다 — C001~C009 가 그렇다.
Master Graph 는 그 Cycle 들이 만든 Capability 를 사후에 참조할 뿐이다.

### 27.3 Narrative 가 포함된 Cycle 도 별도 Workflow 를 요구하지 않는다

Cycle Goal 자체에 Story 의미가 포함되어 있다면
그 의미도 기존 Intent → World Semantic 폐쇄 규칙을 그대로 따른다.

```text
Cycle Goal:
Player 가 Rowan 과 대화하여
Rowan 이 Blackhorn 을 Deer 감소의 원인이라고 믿고 있음을 알 수 있다.
```

이 경우 별도의 Narrative Stage 를 추가하지 않는다.
Cycle Intent 가 요구하는 의미를 World State / Rule 로 표현하면 된다.

```text
Intent
    Player 가 Rowan 과 대화하면
    Rowan 이 가진 정보를 전달받을 수 있다.

World Semantic
    Rowan.Dialogue / Rowan.Belief
    Player.Knowledge

World Rule
    TalkToRowan
      Preconditions
      Transition: Player.Knowledge += RowanBelief
```

즉 Narrative 는 **Cycle 이전에는 아이디어와 목적을 생성하는 강력한 설계 요소** 지만,
Cycle Goal 확정 이후에는 다른 모든 의미와 마찬가지로 기존 Semantic Closure 대상일 뿐이다.

### 27.4 기존 Cycle 결과는 Migration 대상이 아니라 그대로 유효하다

이미 구현된 Movement, Mining, Combat, Collision, Camera, Debug Command 등의 Cycle 은
다시 설계하거나 재구현할 필요가 없다.

기존 결과는 그대로 유지된다.

```text
World State
World Rule
Server Authority
Action Request
Observable State
GameView Specification
Implementation
Tests
Playable Verification
```

Master Intent Graph 에서는 기존 Cycle 이 만든 Capability 를
상위 Goal/Possibility 와 연결하기만 하면 된다.

```text
Existing Capability from C001:
    C_MINE_DEPOSIT

Master Intent Graph references:

돌을 확보한다
    └─ 직접 캔다
         requires -> C_MINE_DEPOSIT

대장장이 이야기
    └─ 부족한 광석을 확보한다
         requires -> C_MINE_DEPOSIT

세력 전쟁
    └─ 공성 자재를 조달한다
         requires -> C_MINE_DEPOSIT
```

따라서 이번 변경은 기존 구현을 무효화하는 Architecture Migration 이 아니다.
**기존 Capability 가 왜 존재하고 어떤 상위 콘텐츠에서 재사용되는지를 설명하는
상위 Design Source of Truth 를 추가하는 변화** 다.

---

# Part X. Agent Graph Generation Policy

## 28. Graph 생성 순서

Agent 가 Root Goal 또는 특정 Content Region 을 확장할 때 다음 순서를 따른다.
이 10단계의 실행 규격은 [guides/master-expand.md](../guides/master-expand.md) 와
[guides/master-frontier.md](../guides/master-frontier.md) 가 담당한다.

### Step 1. Root / Current Goal 의 Owner 와 Motivation 확인

```text
누가 원하는가?
왜 원하는가?
어떤 World State 때문에 생겼는가?
어떤 Knowledge/Belief 에 기반하는가?
```

상위 Goal 인데 이 질문에 답할 수 없다면 Goal 정의를 보완한다.

### Step 2. Goal 의 Possibility 를 폭으로 확장

가능하면 서로 의미가 다른 3~6개의 방법을 탐색한다.

다음 Dimension 을 검토한다.

```text
Direct action
Combat
Exploration
Economy
Craft
Social cooperation
Faction / diplomacy
Knowledge / investigation
World manipulation
Alternative supply / substitution
```

모든 Goal 이 억지로 3~6개를 가져야 하는 것은 아니지만,
`방법이 하나뿐이다` 라는 가정을 자동으로 하지 않는다.

### Step 3. 각 Possibility 의 Requirements 도출

```text
Goal
Capability
Knowledge / Belief
World State
Actor Relationship
Resource / Ownership State
```

### Step 4. Existing Registry 와 중복 검사

새 Capability/Goal 을 만들기 전 기존 Graph 를 검색한다.
의미가 같은 노드는 새로 만들지 않고 재사용한다.

### Step 5. Actor Conflict 검사

```text
누구의 Goal 을 지원하는가?
누구의 Goal 을 방해하는가?
누가 이 선택을 좋아하거나 싫어하는가?
```

Conflict 가 없다고 항상 잘못된 것은 아니지만,
Narrative-heavy Content 에서는 Conflict 부족을 경고한다.

### Step 6. Consequence 정의

Possibility 가 성공하면 최소한 하나 이상의 의미 있는 State 가 변해야 한다.

```text
World State / Actor Relationship / Knowledge / Resource Availability
Access / Entity State / Territory / Economy / Population / Ecology
```

### Step 7. Reveal / Reframe / New Goal 검사

```text
무엇을 새로 알게 되는가?
기존 믿음이 틀렸음이 드러나는가?
새로운 Goal 이 생기는가?
새로운 Possibility 가 열리는가?
기존 Possibility 가 닫히는가?
```

### Step 8. Existing World Capability Overlay

각 Requirement 가 현재 구현되어 있는지 평가한다.

```text
IMPLEMENTED
PARTIAL
MISSING
```

이 저장소에서 이 판정은 주장이 아니라 근거를 갖는다 —
`IMPLEMENTED` / `PARTIAL` 은 그것을 만든 Cycle ID 와 실제 구현 위치를 인용해야 한다.

### Step 9. Frontier 후보 생성

Missing Capability 중 플레이 가능한 작은 단위를 Frontier 후보로 만든다.

### Step 10. Human 이 Cycle Goal 선택

Agent 가 자동으로 개발 우선순위를 확정하지 않는다.

---

# Part XI. Graph Quality Gates

## 29. Goal Quality Gate

- [ ] Owner 가 명확한가?
- [ ] Desired State 가 명확한가?
- [ ] Motivation 이 존재하는가?
- [ ] 필요하면 Belief/Knowledge Context 가 정의되어 있는가?
- [ ] Stakes 가 이해 가능한가?
- [ ] 사실 Capability 인데 Goal 로 잘못 표현한 것은 아닌가?

## 30. Possibility Quality Gate

- [ ] 같은 Goal 에 다른 실질적 방법이 존재할 가능성을 탐색했는가?
- [ ] Possibility 간 Gameplay/Cost/Risk/Relationship/Consequence 차이가 있는가?
- [ ] Requirements 가 명시되어 있는가?
- [ ] Supports/Opposes 관계를 검토했는가?
- [ ] World State 변화가 존재하는가?
- [ ] 단순한 동의어를 Possibility 로 중복 생성하지 않았는가?

## 31. Narrative Quality Gate

별도 Narrative 문서를 검사하는 것이 아니라 Graph 관계를 검사한다.

- [ ] 사건의 World Cause 가 존재하는가?
- [ ] 주요 Actor 가 서로 다른 Goal 또는 관점을 가지는가?
- [ ] Actor 의 Belief 와 객관적 World State 가 다를 가능성이 있는가?
- [ ] Player 가 개입할 이유가 Goal 로 표현되어 있는가?
- [ ] Player 선택이 실제 State/Relationship 을 바꾸는가?
- [ ] Knowledge Reveal 이 후속 Goal/Possibility 에 영향을 주는가?
- [ ] Kill 하나만 유일한 해결책으로 고정되지 않았는가?
- [ ] Local Story 가 필요하다면 더 큰 World Cause 로 역추적 가능한가?

## 32. DAG / Reuse Quality Gate

- [ ] 동일 Goal 을 Branch 마다 복제하지 않았는가?
- [ ] 동일 Capability 를 Content 마다 새 이름으로 만들지 않았는가?
- [ ] 시스템별 World 를 따로 만드는 대신 Shared World Capability 를 재사용하는가?
- [ ] 한 Capability 가 여러 상위 Possibility 에 기여하는 연결이 보이는가?

## 33. Cycle Quality Gate

- [ ] Frontier 는 실제 Client 에서 플레이 가능한가?
- [ ] 한 Cycle 에서 명확한 결과를 검증할 수 있는가?
- [ ] 단순 코드 Task 가 아닌 World Capability 인가?
- [ ] 어떤 상위 Possibility 를 가능하게 하는지 추적되는가?
- [ ] 완료 후 Existing MMORPG 에 누적 가능한가?

---

# Part XII. Anti-patterns

## 34. 피해야 할 구조

### 34.1 선형 Goal Chain 만 생성

```text
Root -> Goal -> Goal -> Goal -> Leaf
```

대안 Possibility 가 사라지므로 Graph 의 의미가 없다.

### 34.2 MMORPG 시스템 목록을 먼저 만든 뒤 이유를 끼워 맞춤

```text
Combat / Crafting / Auction House / Guild / Raid / Housing
```

부터 시작하지 않는다.

이들은 Root Goal 과 Actor Goal 을 여러 방식으로 해결하는 과정에서
Capability/Content Cluster 로 파생되어야 한다.

### 34.3 모든 저수준 Action 을 Goal 로 만듦

```text
Walk Goal / Jump Goal / Inventory Goal
```

이런 항목은 대개 Capability 다.

### 34.4 Narrative 를 Quest Text 로만 붙임

```text
Capability: Hunt Deer
Narrative: NPC 가 Deer 10마리 잡아달라고 함
```

이 구조는 Narrative 가 Goal/Possibility 에 아무 영향도 주지 않는다.

### 34.5 Narrative Graph 를 별도 진실로 관리

Gameplay Graph 와 Narrative Graph 가 각각 다른 Source of Truth 가 되면
둘 사이의 동기/결과 관계가 불명확해진다.

최종 정책에서는 하나의 Master Intent Graph 를 사용한다.

### 34.6 선택이 Dialogue 에서만 다르고 World 는 동일

Player Choice 는 가능한 경우 Observable State 또는 Relationship 차이를 남겨야 한다.

### 34.7 Goal/Possibility 를 Implementation Agent 가 편의상 삭제

Graph 의미 변경은 Design 변경이다.
구현이 어렵다는 이유만으로 Possibility 를 제거하지 않는다.

---

# Part XIII. 권장 데이터 표현

## 35. Goal 예시

```yaml
id: G200
type: goal
owner: PLAYER
desired_state: VillageFoodProblemResolved
motivation:
  - HelpVillageSurvive
belief_context:
  - CurrentKnowledgeOfBlackhorn
stakes:
  - VillageFoodSupply
```

## 36. Possibility 예시

```yaml
id: P201
type: possibility
name: KillBlackhorn
achieves:
  - G200
requires:
  capabilities:
    - C_TRAVEL
    - C_COMBAT
  knowledge:
    - K_BLACKHORN_LOCATION
supports:
  - G102
opposes:
  - G120
  - G130
changes:
  - W_BLACKHORN_ALIVE_FALSE
reveals:
  - K_CORRUPTION_PERSISTS
creates_goal:
  - G210
```

## 37. Capability 예시

```yaml
id: C_TRACK
type: capability
semantic:
  Player can inspect a world trace and infer the target's movement direction.
```

Capability 는 구현 모듈명이 아니라 **플레이 가능한 의미** 로 기술한다.

이 저장소의 실제 파일 규격(필드 이름·필수 항목·검사 규칙)은
`advprotoh-master` 스킬의 `references/graph-format.md` 가 단일 출처다.

---

# Part XIV. 기존 Workflow 에서 무엇이 유지되고 무엇이 바뀌었는가

## 38. 유지되는 것

### Source of Truth 원칙

Graph 는 여전히 게임 의도의 가장 높은 수준 Source of Truth 다.

### Intent 추출

Implementation 은 Graph 에서 직접 시작하지 않고,
선택된 Goal/Possibility 를 Intent 로 의미적으로 폐쇄한다.

### World Semantic Closure

Intent 의 의미는 World State / World Rule 로 표현되어야 한다.

### Observable

Rule 판단과 결과에 필요한 의미적 State 는 관찰 가능해야 한다.

### Runtime Traceability

Runtime → Rule → Intent → Possibility → Goal 역추적을 유지한다.

### Human Cycle Ownership

다음 Cycle Goal 은 Human 이 선택한다.

### Capability Accumulation

Cycle 결과는 별도 Prototype World 가 아니라 하나의 Existing MMORPG World 에 누적된다.

### Cycle 내부 Workflow 비변경 원칙

이번 Graph 개선의 변경 범위는 Cycle 이전의 Master Design 영역이다.
Human 이 Cycle Goal 을 확정한 이후의 8단계 구조는 변경하지 않는다.

Master Graph 의 Narrative, Actor Motivation, World Cause 는
Cycle Goal 을 발굴하고 의미를 부여하는 데 사용되며,
Cycle 내부의 새로운 필수 Stage 나 필수 Metadata 가 되지 않는다.

---

## 39. 수정된 것

### 기존

```text
Goal Graph + Possibility Graph
```

### 수정

```text
Typed Master Intent Graph
```

Goal/Possibility 를 중심에 두되 다음 의미가 Graph 안으로 들어온다.

```text
World Cause
Actor
Knowledge / Belief
Capability
Consequence / State Change
Goal Conflict
```

---

### 기존

Goal 아래에 Goal 을 계속 분해하는 경향.

### 수정

```text
Goal
  -> OR Possibility
      -> AND Requirements
```

Requirements 는 Goal 뿐 아니라 Capability/Knowledge/WorldState 가 될 수 있다.

---

### 기존

Graph 의 말단을 Cycle Goal 로 간주하기 쉬움.

### 수정

절대 Leaf 대신 **Current Frontier** 를 사용한다.

---

### 기존

Gameplay Graph 와 Narrative 를 별도 Layer 로 연결.

### 수정

Narrative 를 독립 Graph 로 두지 않는다.

```text
World Cause
→ Actor Motivation / Belief
→ Goal
→ Possibility
→ State Change
→ Knowledge
→ New/Reframed Goal
```

이 경로 자체가 Narrative 다.

---

### 기존

Walk, Attack, Talk 같은 저수준 의미도 Goal 로 표현 가능.

### 수정

목적과 재사용 능력을 분리한다.

```text
Goal != Capability
```

---

# Part XV. 최종 전체 Workflow

## 40. Project-Level Workflow

```text
Human Design
    │
    │ Root Goal / World Premise / Design Constraints
    ▼
Master Intent Graph                       master/graph/
    │
    ├─ World State / Causes
    ├─ Actors
    ├─ Knowledge / Beliefs
    ├─ Goals
    ├─ Possibilities
    └─ Capabilities
    │
    ▼
Existing World Capability Overlay          npm run master
    │
    ▼
Frontier Candidates                        master/frontier.md
    │
    │ Human selects
    ▼
Cycle Goal

================ CYCLE BOUNDARY ================

    │
    ▼
Existing Cycle Workflow (01 ~ 08)
    │
    ▼
Cycle-local Goal/Possibility + Intent
    │
    ▼
World State / World Rule
    │
    ▼
Observable Semantic
    │
    ▼
GameView Specification
    │
    ▼
Implementation
    │
    ▼
Verification + Human Observation
    │
    ▼
Existing MMORPG gains New Capability
    │
    └──────────────> Master Graph Overlay Update
```

---

# Part XVI. 최종 한 문장 정의

## 41. Master Intent Graph

> **Master Intent Graph 는 세계의 원인과 상태, Actor 의 지식·믿음·욕망, Actor-owned Goal,
> Goal 을 달성하는 대안적 Possibility, Possibility 가 요구하는 재사용 가능한 Capability,
> 그리고 선택으로 발생하는 World State 변화와 새로운 Knowledge/Goal 을 하나의 Typed Graph 로
> 연결하여, MMORPG 에서 "누가 왜 무엇을 하며 어떤 다른 방법이 있고 그 결과 세계가 어떻게
> 변하는가" 를 Runtime 까지 추적 가능하게 만드는 최상위 Design Source of Truth 다.**

## 42. 운영 원칙 요약

1. Root Goal 과 핵심 Design Constraint 는 Human 이 소유한다.
2. Graph 는 시스템 목록이 아니라 목적과 원인에서 출발한다.
3. 상위 Goal 은 가능한 한 Actor-owned Goal 로 표현한다.
4. Goal 에서 여러 Possibility 를 먼저 탐색한다.
5. Possibility 는 AND Requirements 를 가진다.
6. 저수준 재사용 능력은 Goal 이 아니라 Capability 로 분리한다.
7. 동일 Goal/Capability 는 복제하지 않고 Graph 에서 재사용한다.
8. Narrative 는 별도 Layer 가 아니라 World Cause → Goal → Possibility → Consequence 의 연결 구조다.
9. Belief/Knowledge 는 Goal 과 Possibility Availability 를 바꿀 수 있다.
10. Player Choice 는 가능한 경우 Observable World State 또는 Relationship 변화로 남는다.
11. Master Graph 의 절대 Leaf 를 찾지 않고 현재 구현 기준 Frontier 를 찾는다.
12. Human 이 Frontier 중 다음 Cycle Goal 을 선택한다.
13. Human 이 Cycle Goal 을 확정한 순간 Master Design 단계는 종료되며,
    이후에는 기존 8단계 Cycle Workflow 를 변경 없이 사용한다.
    Master Graph 의 Narrative/Actor/World Cause 를 Cycle 내부의 새로운 필수 Stage 로 추가하지 않는다.
14. 완료된 Capability 는 하나의 Existing MMORPG World 에 누적한다.
15. 모든 Runtime 의미는 가능하면
    `World Cause / Actor Motivation → Goal → Possibility → Intent → Rule → Runtime` 까지
    역추적 가능해야 한다.

## 43. 이 정책이 해결하려는 최종 질문

```text
왜 이 기능/행동이 게임에 존재하는가?
누가 무엇을 원하기 때문에 이 Goal 이 생겼는가?
그 Goal 은 어떤 세계 상태와 사건에서 파생되었는가?
Player 에게 다른 해결 방법은 무엇이 있는가?
그 방법을 사용하려면 어떤 Capability 와 Knowledge 가 필요한가?
그 선택은 누구를 돕고 누구를 방해하는가?
선택 결과 World State 는 실제로 무엇이 달라지는가?
새롭게 무엇을 알게 되고 어떤 Goal 이 다시 생기는가?
현재 구현되지 않은 부분 중 다음 Cycle 로 만들 수 있는 것은 무엇인가?
실제 Runtime 결과는 이 설계 의도까지 역추적 가능한가?
```

이 질문에 답할 수 있는 상태를 Master Intent Graph 의 완성 기준으로 삼는다.

---

# Part XVII. 이 프로젝트에서의 운용

Part I~XVI 은 정책이다. 이 Part 는 그 정책이 `HktAdvProtoH/` 에서
어떤 파일·어떤 단계·어떤 명령으로 도는지를 고정한다.

## 44. 두 층 구조

이 프로젝트의 Workflow 는 이제 두 층이다.

```text
MASTER 층    무엇을 만들 것인가        master/          M1 · M2      Human 이 고른다
─────────────────────── CYCLE BOUNDARY ───────────────────────
CYCLE 층     그것을 어떻게 닫을 것인가  cycles/<CycleId>/ Stage 1~8   Artifact 로 닫는다
```

두 층은 **Cycle Goal 한 문장** 으로만 연결된다.
Master 층이 Cycle 층에 넘기는 것은 그 문장(과 선택적 Provenance)이고,
Cycle 층이 Master 층에 돌려주는 것은 **Capability 의 구현 상태** 하나다.

## 45. Master 층의 파일

```text
master/
    README.md               읽는 순서 · 파일 규약 · 갱신 책임
    graph/
        00-root.yaml        World Premise · Root Goal · Design Constraint · 최상위 World Cause
        capabilities.yaml   Capability Registry (전역 재사용 · 구현 상태 · Cycle 근거)
        R0xx-<name>.yaml    Region — worldstate · actor · knowledge · goal · possibility
    frontier.md             Frontier 후보 — Human 이 다음 Cycle Goal 을 고르는 목록
```

**지금 이 저장소의 Graph 는 비어 있다 — 형태만 있다.** `00-root.yaml` 과 `capabilities.yaml` 은
골격이고 Region 은 아직 없다. 내용을 채우는 것은 M1 의 일이며, 그 출발점인 Root Goal 과
World Premise 는 Human 이 준다. Agent 가 세계 설정을 임의로 지어 채우지 않는다.

Region 은 콘텐츠의 한 덩어리다. Region 경계는 Story 단위이지 시스템 단위가 아니다.
Capability 는 Region 을 가로질러 재사용되므로 Region 파일에 정의하지 않고
`capabilities.yaml` 한 곳에만 둔다 (§32 Reuse Gate).

## 46. Master 층의 단계

| Step | Guide | 입력 | 출력 |
|---|---|---|---|
| M1 Master Graph Expansion | [guides/master-expand.md](../guides/master-expand.md) | Root / 확장 대상 Region | `master/graph/*.yaml` |
| M2 Overlay & Frontier | [guides/master-frontier.md](../guides/master-frontier.md) | `master/graph/` + 현재 `world/` `view/` | `master/frontier.md` |
| M3 Human Selection | Human | `master/frontier.md` | Cycle Goal 한 문장 |

M1 은 Part X 의 Step 1~7, M2 는 Step 8~9, M3 은 Step 10 이다.

실행은 **`advprotoh-master` 스킬** 이 담당한다 —
Cycle 층의 `advprotoh-cycle` 스킬과 같은 방식으로, 필요한 문서만 로드한다.

## 47. Overlay 는 주장이 아니라 검사다

```text
npm run master          Capability Overlay + Graph 통계 + Frontier 재료를 출력한다
npm run master:check    참조 무결성과 Quality Gate 만 검사한다 (실패하면 종료 코드 1)
```

`master:check` 가 검사하는 것:

```text
ID 중복 · ID 접두 규약
참조 무결성        achieves / requires / supports / opposes / changes / reveals /
                   creates_goal / motivates / causes / owner 가 실재하는 노드를 가리키는가
Goal Gate          owner · desired_state · motivation 이 있는가 (§29)
Possibility Gate   achieves · requires · changes 가 있는가 (§30)
Capability Gate    status 가 IMPLEMENTED/PARTIAL 이면 근거 Cycle 을 인용하는가 (§28 Step 8)
Reuse Gate         Region 파일이 Capability 를 자체 정의하지 않는가 (§32)
고아 노드          어떤 Possibility 도 요구하지 않는 Capability
단일 Possibility   Possibility 가 하나뿐인 Goal (경고 — 금지는 아니다, §34.1)
```

Overlay 의 `IMPLEMENTED` 는 문장이 아니라 **Cycle ID + 구현 위치** 로 뒷받침된다.
근거 없는 `IMPLEMENTED` 는 검사 실패다.

## 48. Cycle 층과의 연결 — 정확히 두 지점

Master 층이 Cycle 층을 바꾸지 않는다는 원칙(§27)을 지키기 위해,
연결 지점은 다음 둘로 제한한다.

### 48.1 들어가는 방향 — Cycle Definition 의 선택적 Provenance

`01-cycle.md` 에 `MASTER TRACE` 항목을 **선택적으로** 쓸 수 있다.

```text
## MASTER TRACE
    Frontier      F-0xx
    Serves        P-<Possibility Id>  (G-<Goal Id>)
    Capability    C_<이름>             MISSING → 이번 Cycle 이 만든다
```

없어도 Cycle 은 성립한다. Cycle Goal 이 Master Graph 밖에서 왔다면 `없음` 이라고 적는다.
이 항목은 Stage 2 이후 어떤 단계의 입력도 아니다 — 순수한 출처 기록이다.

### 48.2 나오는 방향 — Verification 이후의 Overlay 갱신

Cycle 이 `08-verification.md` 에서 `STATUS COMPLETE` 가 된 뒤
(즉 Human Play 확인 이후) `master/graph/capabilities.yaml` 의 해당 Capability 를 갱신한다.

```text
status   MISSING → PARTIAL | IMPLEMENTED
cycles   + <CycleId>
where    + 실제 구현 위치
```

Cycle 이 어떤 Capability 도 건드리지 않았다면 갱신할 것이 없다 — 그것도 정상이다.
Overlay 갱신은 Cycle Artifact 를 수정하지 않는다. `cycles/` 는 History 다.

**이 둘 말고 Master 층이 Cycle 층에 요구하는 것은 없다.**
Stage 2~8 의 Guide 는 Master Graph 를 읽지 않고, 읽을 필요도 없다.

## 49. 기존 Cycle(C001~C009)의 취급

기존 9개 Cycle 은 Master Graph 이전에 만들어졌다.
이들은 `MASTER TRACE` 가 없고, 앞으로도 추가하지 않는다 — History 는 수정하지 않는다.

Master Graph 는 이 Cycle 들이 만든 Capability 를 `capabilities.yaml` 에 등록하고
상위 Goal/Possibility 가 그것을 `requires` 로 참조하는 방식으로만 연결한다.
즉 기존 구현에 대한 설명이 사후에 붙는 것이지, 기존 구현이 재작성되는 것이 아니다 (§27.4).

등록은 미리 하지 않는다. Possibility 가 그것을 요구할 때 그 Capability 를 등록하고 상태를
판정한다 — 쓰이지 않는 Capability 목록을 먼저 만드는 것은 §34.2 (시스템 목록부터 만들기) 다.

## 50. Master 층에서 막혔을 때

Cycle 층과 같은 규칙이다 — 지어내지 않는다.

```text
MASTER GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  Human (Root Goal / Design Constraint) | M1 (Graph) | M2 (Overlay)
```

Root Goal 과 Design Constraint 는 Human 소유다 (§42-1).
Agent 는 Root Goal 을 새로 만들지 않는다.
