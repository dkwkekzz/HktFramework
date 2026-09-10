# L3 — 주체와 몸 (기반 층 3 · 기획서 · 주입됨)

상태: **주입됨 — 자를 자리는 Human 결정 대기** — 3층은 열려 있다(2층 판정과 병행 — [plan/DESIGN.md](../../plan/DESIGN.md) §1). Human 이 채팅으로 준 3층 기획서 전문을 그대로 보존했다 (`advprotoi-inject`). 3층에는 앞 층이 옮겨 세운 대기 기획서 둘([L3-Subject-Expedition.md](L3-Subject-Expedition.md) · [L3-Subject-Discovery.md](L3-Subject-Discovery.md))이 있고, 이 원문은 그 둘의 주제(편성 · 무대 · 앎 · 행동)와 그 둘이 소유하지 않던 **몸의 값**을 한 문서로 묶어 왔다. 원문의 §23~§27 이 전체에 걸쳐 있어 어디서 가를지 애매하므로 나누지 않았다 — 세 문서의 관계는 Human 이 정한다 ([plan/DESIGN.md](../../plan/DESIGN.md) §3 이 문서 절의 질문 · [plan/TODO.md](../../plan/TODO.md) §1).
§1 이 원문이다 — **글자 그대로**, 제목 수준만 맞췄다 (규칙: [design/Design-DesignAuthoringWorkflow.md §5 · §10](../../design/Design-DesignAuthoringWorkflow.md) · [README.md §4](README.md)). 검토 · 계약 절은 이 기획서를 자를 때 선다. Human 이 언제든 고친다.

```text
이 기획서가 세운다        Life 를 플레이 가능한 Actor 로 — 몸(저장되는 State: position · hp · cp · currentAction · core · equipmentSlots) · 유도되는 성질(Body Property Resolver — maxHp · maxCp · perceptionRange …) ·
                        Awareness · Knowledge(learn / forget / knows) · Condition target:actor · Controller 와 무관한 Action Port(ActorActionRequest · Lifecycle) · Core 가 몸에 귀속된 State ·
                        Expedition(members · activeActor · bag) · 무대의 한 명과 교체 · Membership ≠ World Presence · 장착 슬롯 6 · Bag 소유 구조. Cycle 넷(A Body · B Knowledge & Action · C Expedition & Stage · D Attachment) — 원문 §26
                        (원문 §1 · §2.1 · §26 이 말한 것이지 배분 판정이 아니다)
이 기획서가 소유하지 않는다  아이템 · Bag 의 내용 · 장착 가능 여부(4층 — [L4-Item-Gem.md](L4-Item-Gem.md) · [L4-Item-Craft.md](L4-Item-Craft.md)) · 공격 · 피해 · 교체의 전투 규칙(5층 — [L5-Combat-Emergent.md](L5-Combat-Emergent.md)) ·
                        Aura Allocation · Ability Rule · Skill · Active/Entry/Leave/Off-field 의 내용(6층 — [L6-Skill-Class.md](L6-Skill-Class.md)) · Core 성장 · Class Change(7층 — [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md)) ·
                        Player Input Mapping · NPC AI 의사결정(별도 Controller — 원문 §2.2) · 화면(8층 · Required 로)
함께 읽는다 (옮기지 않는다)  [L3-Subject-Expedition.md](L3-Subject-Expedition.md)(L7 §4 · §5 · §9~§11 · §20 — 편성 · 무대 · Core) · [L3-Subject-Discovery.md](L3-Subject-Discovery.md)(Foundation §2.5 · §2.6 · §7.7 · §7.9 — 발견 상태 · NPC 행동) ·
                        L7 확정 3 · 4 · 5 · 10 · 11 · 12 · 위임 D1 · [Access](L2-World-Access.md) §14.1 · §15 · K12(몸이 답한다) · [Life](L2-World-Life.md) F10 · [M5](M5-FrostCanyon.md) ·
                        design/Design-Subject-Decision · Design-Autonomous-Behavior-Knowledge-R0 · Design-Creature-Behavior-R0 · Design-Inventory-Equipment-D1 ·
                        코드의 지금 — `content/world/semantic/actor.ts` ActorState(hp · cp · perceptionRange 가 고정 상수로 있다) · `combat.ts` actorModifiers · `condition.ts` target:'actor' 자리(C035) — [codemap](../../codemap/CONTENT.md)
놓는 미지                 원문에 없다 — 3층 Cycle 이 놓을 "무엇을 원하는지 아는 생물 하나"(README §1)는 후보 2 의 M8 이 맡고 있다. 이 문서의 몫인지는 Human (질문)
자르는 때                 Human 이 세 문서의 관계를 정한 뒤 — "L3-Subject-Body 로 spec 써" (Cycle 은 원문 §26 의 넷이 후보)
```

## 1. 원문 — 주입물 (글자 그대로)

출처: Human 주입 (채팅 전문 · `advprotoi-inject`). 제목 수준만 한 단계씩 내렸다 (원문의 `#` → `###`).

> 생명은 세계 안에서 **몸을 가지고 존재하며**, 세계를 관찰하고, 무언가를 알고, 행동을 시도할 수 있다.
> 플레이어가 조종하든 NPC AI가 조종하든 세계가 보는 생명의 구조는 동일하다.

---

### 1. 이 층의 목적

3층은 `Life`를 실제 플레이 가능한 **Actor**로 만든다.

2층까지의 생명은 세계에 존재할 수 있는 대상이었다.
3층부터 생명은 다음을 가진다.

```text
Life
 └─ Actor
     ├─ Body           세계에 서 있는 상태
     ├─ Awareness      세계를 감지하는 범위
     ├─ Knowledge      알고 있는 것
     ├─ Action Port    행동을 시도하는 입구
     ├─ Core           몸에 귀속된 Core
     └─ Equipment Slots
```

그리고 여러 Actor를 하나의 원정으로 묶는다.

```text
Expedition
 ├─ Members
 ├─ Active Actor       현재 무대에 서 있는 한 명
 └─ Bag                4층이 채울 원정 공용 물건 자리
```

이 층의 결과는 다음 한 문장으로 정의한다.

> **어떤 생명이 세계에 서 있고, 무엇을 감지하고 알고 있으며, 어떤 행동을 시도하고, 현재 어떤 생명이 플레이어를 대신하여 세계에 개입하고 있는지 세계가 표현할 수 있다.**

---

### 2. 범위

#### 2.1 이 층에서 세운다

| 영역               | 3층의 책임                            |
| ---------------- | --------------------------------- |
| 몸                | Actor가 세계에 존재하는 공통 상태             |
| HP / CP          | 현재값을 가진 몸의 자원                     |
| Body Property    | 몸의 성질을 유도하는 열린 구조                 |
| Condition Target | `target:actor`가 실제 Actor를 참조      |
| Awareness        | Actor가 세계를 감지할 수 있는 유도값           |
| Knowledge        | Actor가 무엇을 알고 있는지 저장·조회           |
| 행동               | 모든 Controller가 사용하는 공통 행동 입력구     |
| Core             | Core가 Actor의 몸에 귀속될 자리            |
| 편성               | 여러 Actor를 Expedition으로 구성         |
| 무대               | Expedition 중 현재 세계에 개입하는 Actor 하나 |
| 교체               | Active Actor를 변경하는 기본 행동          |
| 장착 자리            | Actor마다 6개의 장착 슬롯                 |
| 공용 가방 자리         | Expedition이 하나의 Bag을 소유할 구조       |

---

#### 2.2 이 층에서 세우지 않는다

다음은 의도적으로 이후 층에 남긴다.

| 내용                   |          담당 층 |
| -------------------- | ------------: |
| 아이템이 무엇인가            |             4 |
| Bag 안의 실제 Item 규칙    |             4 |
| 장착 가능 여부             |             4 |
| 장착 아이템의 효과           |         4 / 6 |
| 공격·피해·방어             |             5 |
| 교체의 전투 규칙            |             5 |
| Aura Allocation      |             6 |
| Ability Rule         |             6 |
| Skill 실행 규칙          |             6 |
| 장착물이 제공하는 Skill      |             6 |
| Core 성장              |             7 |
| 클래스 체인지              |             7 |
| Player Input Mapping | 별도 Controller |
| NPC AI 의사결정          | 별도 Controller |

특히 아래는 3층에서 만들지 않는다.

```text
Response
Allocation
Ability Rule
World Operation
Contract
```

3층은 이들이 **Actor를 대상으로 동작할 수 있는 자리만 만든다.**

---

### 3. Actor와 Body

#### 3.1 Actor

`Actor`는 세계에 행동 가능한 생명을 표현하는 런타임 주체다.

기존 `ActorState`를 버리지 않고 확장한다.

현재 존재하는 상태:

```text
position
body
facing
velocity
hp
cp
moveMode
tempo
wanderPath
inventory
currentAction
```

3층에서는 이를 다음 개념으로 정리한다.

```text
Actor
 ├─ Identity
 ├─ Presence
 ├─ Body State
 ├─ Core
 ├─ Awareness
 ├─ Knowledge
 ├─ Current Action
 └─ Equipment Slots
```

---

### 4. Body State

몸의 상태에는 두 종류가 있다.

#### 4.1 저장되는 상태

현재 순간의 실제 세계 상태다.

예:

```text
position
facing
velocity

hp
cp

moveMode
currentAction

core

equipmentSlots
```

이 값들은 실제로 변화할 수 있기 때문에 저장한다.

---

#### 4.2 유도되는 성질

몸의 최종 성질은 `ActorState`에 닫힌 필드로 저장하지 않는다.

예:

```text
maxHp
maxCp
perceptionRange
movementSpeed
bodyMass
...
```

개념적으로는 다음과 같다.

```text
Actor State
      +
Body
      +
Equipment        ← 4 / 6층
      +
Core             ← 7층
      +
Knowledge        ← 3 / 6층
      +
Ability/Aura     ← 6층
      ↓
Body Property Resolver
      ↓
Derived Properties
```

기존 `combat.ts`의 `actorModifiers`와 같은 방향을 유지한다.

따라서 새로운 시스템은

```ts
actor.perceptionRange = 20
```

처럼 최종값을 Actor에 고정하지 않는다.

대신 개념적으로:

```ts
deriveActorProperty(actor, 'perceptionRange')
```

처럼 질의한다.

---

### 5. HP와 CP

새로운 전투 자원을 추가하지 않는다.

```text
HP
CP
```

두 자원을 그대로 사용한다.

CP는 이후 Aura/Nen 계열 시스템에서도 사용하는 공통 자원이다.

```text
Aura Resource = CP
```

3층에서는 CP의 의미를 확장하지 않는다.

여기서 필요한 것은 오직:

```text
Actor가 CP를 가진다.
CP에는 현재값이 있다.
CP의 최대값 등은 Body Property로 유도할 수 있다.
CP는 이후 시스템이 소비하거나 회복시킬 수 있다.
```

이다.

전투 중 얼마를 사용하고 어떻게 회복하는지는 5·6층의 책임이다.

---

### 6. Body Property

Body Property는 **몸에 대한 세계의 질의 인터페이스**다.

예:

```text
"이 생명의 인지 범위는 얼마인가?"
"최대 CP는 얼마인가?"
"얼마나 빠르게 움직일 수 있는가?"
```

다음 형태를 목표로 한다.

```text
Actor
  ↓
Property Query
  ↓
여러 Property Source
  ↓
최종값
```

Property Source는 앞으로 계속 추가될 수 있다.

```text
Body
Equipment
Core
Knowledge
Condition
Ability
Aura
World Effect
...
```

3층의 중요한 규율은 하나다.

> **새 시스템이 Actor의 성질을 바꾸기 위해 ActorState에 새로운 최종값 필드를 추가할 필요가 없어야 한다.**

---

### 7. Awareness — 생명이 세계를 감지하는 방법

`AWARENESS`는 3층에서 세운다.

가장 기본적인 형태는:

```text
Actor
  ↓
perceptionRange
  ↓
감지 가능한 World 존재
```

이다.

하지만 `perceptionRange`는 상수가 아니다.

```text
perceptionRange
    =
deriveActorProperty(actor, AWARENESS)
```

로 얻는다.

따라서 이후:

```text
Body
Knowledge
Item
Aura Allocation
Condition
지역 효과
```

등이 인지력을 변경해도 구조를 수정할 필요가 없다.

3층에서는 **무엇을 감지할 수 있는가**까지만 다룬다.

감지한 정보의 UI 표시나 자동 전투 반응은 별개의 문제다.

---

### 8. Knowledge — 생명은 무엇을 아는가

Actor는 세계 전체를 알고 있지 않다.

Actor마다 알고 있는 것이 다를 수 있다.

따라서 Actor는 자신의 `Knowledge`를 가진다.

```text
Actor
 └─ Knowledge
      ├─ K1
      ├─ K2
      └─ K3
```

Knowledge의 가장 기본적인 기능은 다음 세 가지다.

```text
learn
forget
knows
```

예:

```text
요정 A
 ├─ 독버섯은 위험하다
 ├─ 화염 늑대는 물에 약하다
 └─ 고대문의 문자 일부를 읽을 수 있다
```

Knowledge는 단순 UI 정보가 아니다.

이후 Ability Rule이 Actor를 평가할 때 사용할 수 있는 **세계 상태의 일부**다.

```text
Ability Rule
    ↓
Actor Knowledge Query
    ↓
행동 결과가 달라질 수 있음
```

다만 그 규칙 자체는 6층에서 만든다.

3층에서는 오직:

> **Actor가 Knowledge를 소유하고 세계가 이를 질의할 수 있다.**

까지 세운다.

---

### 9. Knowledge와 능력

생명은 자신이 가진 Knowledge를 이용해 자신의 능력을 극대화할 수 있다.

그러나 다음처럼 만들지 않는다.

```text
Knowledge
→ 공격력 +20%
```

이렇게 하면 Knowledge와 전투 시스템이 직접 결합된다.

대신:

```text
Actor
 └─ Knowledge

Ability Rule
 └─ Knowledge를 조건 또는 입력으로 질의
```

형태로 둔다.

예를 들어 이후 6층에서는 다음과 같은 규칙을 만들 수 있다.

```text
화염 늑대의 약점을 알고 있다
        ↓
특정 Ability Rule 사용 가능
```

또는

```text
고대 검술 지식을 알고 있다
        ↓
특정 Skill Source 활성화
```

3층은 이 가능성만 연다.

---

### 10. Condition의 Actor Target

C035에서 만들어진 Condition Target 중:

```text
actor
player
faction
```

에서 `actor`를 3층에서 실제 대상으로 연결한다.

개념적으로:

```ts
ConditionTarget =
    | { type: 'actor', actorId: ActorId }
    | ...
```

가 된다.

따라서 세계는 다음을 표현할 수 있다.

```text
Actor A가 존재한다.
        ↓
Condition이 Actor A를 대상으로 한다.
```

Condition이 어떤 효과를 주는지는 여기서 결정하지 않는다.

---

### 11. 행동 — Actor Action Port

3층에서 가장 중요한 원칙 중 하나다.

**Player와 NPC를 별개의 행동 시스템으로 만들지 않는다.**

다음 구조를 사용한다.

```text
Player Input ───┐
                │
NPC AI ─────────┼→ Actor Action Request → World
                │
Script/Event ───┘
```

세계는 행동의 출처를 알 필요가 없다.

모든 Controller는 같은 형식으로 Actor에게 행동을 요청한다.

---

### 12. Action Request

3층은 세상의 모든 행동 종류를 enum으로 미리 정의하지 않는다.

대신 **모든 행동이 들어갈 수 있는 공통 입구**를 만든다.

개념적으로:

```text
ActorActionRequest

actor
action
target?
parameters?
```

이 요청을 통해 이후 시스템은 다음을 추가할 수 있다.

```text
Move
Interact
Attack
Guard
Use Skill
Gather
Craft
Talk
Equip
Open
Climb
Swim
Investigate
...
```

3층의 책임은 이 행동들의 규칙을 구현하는 것이 아니다.

3층이 보장해야 하는 것은:

> 새로운 행동 종류가 추가되더라도 Player Controller와 NPC Controller의 기반 구조를 다시 만들지 않아도 된다.

이다.

---

### 13. Action Lifecycle

Actor는 현재 수행 중인 행동을 가질 수 있다.

기존:

```text
currentAction
```

을 유지한다.

공통 생명주기는 최소한 다음을 표현할 수 있어야 한다.

```text
Requested
   ↓
Active
   ↓
Completed
```

또는

```text
Active
   ↓
Cancelled
```

행동마다 시간·피해·비용·Ability Rule 등을 어떻게 처리할지는 이후 시스템이 결정한다.

3층은 단지 Actor에게

```text
현재 무엇을 하고 있는가
```

를 표현할 공통 자리를 제공한다.

---

### 14. Controller와 Actor의 분리

Actor 자신이 AI여서는 안 된다.

```text
Actor
≠
NPC AI
```

마찬가지로:

```text
Actor
≠
Player
```

Actor는 세계에 존재하는 생명이다.

Controller는 그 생명에게 행동 요청을 보내는 외부 시스템이다.

```text
Controller
    ↓
ActorActionRequest
    ↓
Actor
```

따라서 동일한 Actor를 상황에 따라

```text
Player Controller
NPC Controller
Script Controller
```

가 제어하는 것도 가능하다.

이 구조가 있어야 추후:

* 플레이어 캐릭터
* 몬스터
* 상인
* 동료
* 소환수
* 자동 행동
* 컷신

을 하나의 Actor 시스템으로 처리할 수 있다.

---

### 15. Core

Core는 별도의 World Item으로 두지 않는다.

3층에서는 **Actor의 몸에 귀속된 State**로 자리만 만든다.

```text
Actor
 └─ Core State
```

Core가 어떤 능력과 성장 가능성을 제공하는지는 7층의 책임이다.

3층에서 필요한 규칙은 하나다.

> **Core는 Actor의 성장과 변화가 귀속될 수 있는 몸의 지속 상태이다.**

따라서 Actor가 교체되거나 무대에서 내려가더라도 Core는 Actor와 함께 유지된다.

---

### 16. Expedition — 여러 생명을 하나의 원정으로 묶는다

플레이어는 하나의 Actor가 아니라 **원정 단위**를 가진다.

```text
Expedition
 ├─ Member A
 ├─ Member B
 ├─ Member C
 └─ ...
```

Expedition은 최소한 다음 상태를 가진다.

```text
members
activeActor
bag
```

`members`의 최대 수나 편성 제한은 이 층에서 고정하지 않는다.

---

### 17. 무대의 한 명

Expedition의 모든 Actor가 동시에 플레이어 대신 세계에 개입하지 않는다.

항상 하나의 Actor가 **Active Actor**다.

```text
Expedition

A  ← Active
B
C
D
```

Active Actor는 현재 플레이어가 세계에 개입하는 몸이다.

따라서 기존의

```text
Observer = 하나의 Body
```

구조를

```text
Observer
   ↓
Expedition
   ↓
Active Actor
   ↓
Body
```

구조로 확장한다.

---

### 18. Active Actor 교체

교체는 단순 UI 기능이 아니다.

> **플레이어가 세계에 개입하는 몸을 변경하는 행동이다.**

기본 전이는 다음과 같다.

```text
Active = A

switch(B)

Active = B
```

이때 3층에서는 다음만 처리한다.

```text
현재 Active Actor가 누구인가
새 Active Actor로 변경할 수 있는 구조
Observer가 새 Active Actor를 따라감
```

다음은 처리하지 않는다.

```text
교체 쿨다운
전투 중 교체 제한
교체 스킬
등장 공격
버프
장판 유지
전투 페이즈
```

모두 5·6층에서 추가한다.

---

### 19. Presence — 편성원과 세계에 서 있는 몸의 분리

Expedition에 속해 있다고 해서 모든 Actor가 같은 위치에 물리적으로 서 있을 필요는 없다.

따라서 개념을 분리한다.

```text
Expedition Membership
≠
World Presence
```

예:

```text
A — Active / World Presence
B — Reserve
C — Reserve
D — Reserve
```

교체하면:

```text
A — Reserve
B — Active / World Presence
```

가 된다.

이 기반 위에 이후:

```text
비활성 요정의 장판
지원 능력
소환
동시 등장
특정 지역에서 둘 이상 등장
```

같은 규칙을 추가할 수 있다.

3층에서는 **Active 하나라는 기본 플레이 형태**만 세운다.

---

### 20. 장착 슬롯

모든 Actor는 6개의 장착 자리를 가진다.

```text
Actor
 └─ Equipment
      ├─ Slot 1
      ├─ Slot 2
      ├─ Slot 3
      ├─ Slot 4
      ├─ Slot 5
      └─ Slot 6
```

슬롯은 특정 부위로 고정하지 않는다.

즉:

```text
weapon
helmet
armor
boots
```

같은 의미를 3층에서 부여하지 않는다.

슬롯의 의미는 이후 아이템·성장 설계가 결정할 수 있다.

---

### 21. Equipment Slot의 역할

3층에서 Slot은 오직:

```text
Actor가 외부 능력 Source를 연결할 수 있는 자리
```

다.

구조적으로는:

```text
Actor
 └─ Equipment Slot
       ↓
     Source
```

까지만 세운다.

이후 4층에서:

```text
Source = Item
```

을 연결할 수 있고,

6층에서는:

```text
Item
 ↓
Ability Source
 ↓
Ability Rule
```

을 연결할 수 있다.

중요한 규칙:

> 장착 Slot 자체는 Skill이나 능력을 실행하지 않는다.

Slot은 **능력 출처를 Actor에게 연결하는 자리**일 뿐이다.

---

### 22. Expedition Bag

가방은 Actor별이 아니라 원정 단위에 하나 존재한다.

```text
Expedition
 ├─ Actor A
 ├─ Actor B
 ├─ Actor C
 └─ Bag
```

하지만 3층에서는 Bag의 내용물을 설계하지 않는다.

3층은:

```text
Expedition이 하나의 Bag을 가진다.
```

라는 소유 구조까지만 만든다.

다음은 4층에서 담당한다.

```text
30칸
Item 이동
Stack
획득
버리기
소모
장착
제작
```

---

### 23. 전체 구조

3층 완료 후 세계에서 Actor의 구조는 다음과 같다.

```text
Life
 ↓
Actor
 ├─ Identity
 │
 ├─ Body
 │   ├─ Transform
 │   ├─ HP
 │   ├─ CP
 │   ├─ Current Action
 │   └─ Core
 │
 ├─ Derived Properties
 │   ├─ Awareness
 │   ├─ Max HP
 │   ├─ Max CP
 │   └─ ...
 │
 ├─ Knowledge
 │
 ├─ Equipment
 │   └─ 6 Slots
 │
 └─ Action Port
```

플레이어 쪽은:

```text
Player
 ↓
Expedition
 ├─ Members[]
 ├─ Active Actor
 └─ Bag
```

행동은:

```text
Player Controller ─┐
NPC Controller ────┼→ Action Request → Actor → World
Other Controller ──┘
```

성질은:

```text
Body
Equipment
Knowledge
Core
Ability
World
   ↓
Property Sources
   ↓
Derived Actor Property
```

가 된다.

---

### 24. 구현 규율

3층 구현에서는 다음 규율을 지킨다.

#### R1. HP와 CP 이외의 전투 자원을 만들지 않는다

```text
Aura Resource = CP
```

를 유지한다.

---

#### R2. 변화 가능한 몸의 성질을 ActorState의 닫힌 필드로 늘리지 않는다

최종 성질은 Property Resolver를 통해 유도한다.

특히:

```text
perceptionRange
```

를 고정 상태로 만들지 않는다.

---

#### R3. 상태와 성질을 구분한다

예:

```text
currentHp        State
currentCp        State
position         State

maxHp            Property
maxCp            Property
perceptionRange  Property
```

---

#### R4. Player와 NPC는 같은 Actor 행동 경로를 사용한다

```text
Controller → ActorActionRequest
```

하나만 둔다.

---

#### R5. 행동 종류를 3층 enum으로 폐쇄하지 않는다

새로운 행동이 생겼을 때 Actor 기반 시스템을 수정하지 않는 구조를 사용한다.

---

#### R6. Knowledge가 직접 전투 수치를 변경하지 않는다

Knowledge는 이후 Rule이 읽는 Actor 상태다.

---

#### R7. 장착 슬롯은 Ability Rule을 알지 않는다

```text
Slot → Source
```

까지만 책임진다.

---

#### R8. Expedition Membership과 World Presence를 분리한다

편성되어 있다는 사실과 현재 무대에 서 있다는 사실은 다르다.

---

#### R9. Active Actor 하나를 플레이어의 현재 World Intervention으로 사용한다

Observer와 Camera 역시 고정 Body가 아니라 현재 Active Actor를 추적한다.

---

### 25. 관찰 가능한 검증

3층은 다음 장면들로 완료 여부를 판단할 수 있다.

| 검증                 | 관찰 결과                             |
| ------------------ | --------------------------------- |
| Actor Spawn        | Actor가 위치·HP·CP를 가지고 세계에 존재       |
| HP/CP 변경           | 현재값 변화가 관찰됨                       |
| Property Source 추가 | ActorState 수정 없이 유도값 변화           |
| Awareness 변경       | 감지 범위가 실제로 달라짐                    |
| Condition Target   | `target:actor`가 특정 Actor를 참조      |
| Knowledge 획득       | Actor별 Knowledge 조회 결과가 달라짐       |
| Action Request     | 외부 Controller가 Actor에게 행동 요청 가능   |
| Current Action     | Actor가 현재 수행하는 행동 조회 가능           |
| Expedition 편성      | 여러 Actor가 하나의 Expedition에 존재      |
| Active Actor       | 현재 무대 Actor를 조회 가능                |
| Actor Switch       | Active A → B가 되고 Observer가 B를 사용  |
| Reserve Actor      | 편성원이나 현재 World Presence가 아님       |
| Equipment          | 모든 Actor가 정확히 6개 Slot 보유          |
| Bag Ownership      | Expedition 하나가 Bag 하나를 참조         |
| Core               | 각 Actor의 Core가 Actor State와 함께 유지 |

---

### 26. Cycle 분할

3층은 크게 네 묶음으로 구현하는 것이 적절하다.

#### Cycle A — Body Foundation

```text
Actor
HP / CP
Core
Body Property
Condition target:actor
Awareness
```

**증명**

> Actor의 몸이 세계에 존재하며, HP/CP와 열린 Body Property를 가진다.

---

#### Cycle B — Knowledge & Action

```text
Awareness → Observation
Knowledge possession/query
ActorActionRequest
Current Action
Controller-independent Action Port
```

**증명**

> Actor는 자신이 감지하고 알고 있는 상태를 가지며, 행동의 출처와 무관하게 세계에 행동을 요청할 수 있다.

---

#### Cycle C — Expedition & Stage

```text
Expedition
Members
Active Actor
Reserve
Switch
Observer → Active Actor
```

**증명**

> 여러 Actor를 원정으로 편성하고 세계에 개입하는 Actor를 교체할 수 있다.

---

#### Cycle D — Attachment Foundation

```text
Actor Equipment Slots × 6
Expedition Bag ownership
Ability Source 연결 자리
```

**증명**

> Actor와 Expedition이 이후 Item/Ability 시스템을 연결할 구조를 가진다.

---

### 27. 3층 완료 상태

3층이 끝났을 때 아직 다음은 없어도 된다.

```text
검
방어구
공격 Skill
Aura
Class
Damage Formula
AI
전투 중 교체 규칙
Inventory UI
아이템 효과
```

하지만 다음 질문에는 모두 세계가 답할 수 있어야 한다.

```text
이 생명은 누구인가?
어디에 있는가?

HP와 CP는 얼마인가?

몸의 특정 성질은 현재 얼마인가?

무엇을 감지할 수 있는가?
무엇을 알고 있는가?

현재 무엇을 하고 있는가?
새로운 행동을 어디로 요청하는가?

어떤 Core를 가지고 있는가?

어떤 원정에 속해 있는가?
현재 무대에 선 생명은 누구인가?

이 생명에게 외부 Source를 연결할 6개의 자리가 있는가?
이 원정에 공용 Bag의 자리가 있는가?
```

이 질문에 답할 수 있으면 **주체와 몸 층은 닫힌다.**

---

### 28. 한 문장 경계

> **3층은 생명에게 세계에 서는 몸, 세계를 감지하고 아는 상태, 행동을 요청하는 공통 입구, 편성과 교체, Core와 장착 자리를 제공한다. 그 몸으로 무엇을 획득하고, 어떻게 싸우고, 어떤 능력을 발현하며, 어떻게 성장하는지는 4~7층이 결정한다.**

## 2. 걸친 절 — 다른 문서와 나눠 갖거나 옮기지 않은 것

원문에 뒤 층의 절은 없다 — §2.2 · §9 · §18 · §21 · §22 · §27 의 4~7층 언급은 경계 서술이지 그 층의 기획이 아니다. 옮긴 것이 없다.
같은 층의 대기 문서 둘과 겹치는 절은 아래와 같다 — 문장은 옮기지 않았다. 세 문서의 관계는 Human 이 정한다 (질문 — [plan/DESIGN.md](../../plan/DESIGN.md) §3 이 문서 절).

```text
§15 Core · §16~§19 Expedition · 무대의 한 명 · 교체 · Presence · §22 Bag(원정 단위)   L3-Subject-Expedition 의 주제 (L7 §9 · §10 · §11 의 자리 · §20 과 같은 것 — 그 문서 §3 이 여기를 가리킨다).
                                                                            원문 §26 Cycle C 가 그 문서의 후보 2 와 겹친다 — 어느 쪽이 행인가는 Human
§7 Awareness · §8~§9 Knowledge · §10 Condition target:actor · §11~§14 Action Port    L3-Subject-Discovery 의 주제 (Foundation §2.5 NPC Process · §2.6 발견 상태 · §7.9 Investigation — 그 문서 §3 이 여기를 가리킨다).
                                                                            원문 §26 Cycle B 가 그 문서의 후보 5 와 겹친다. 원문의 Knowledge 는 Actor 의 것(learn / forget / knows)이고 Discovery 의 것은
                                                                            Player Knowledge 와 발견 상태 다섯(G10) — 둘의 관계는 원문에 없다 (질문)
§3~§6 Body State · Body Property · §5 HP/CP · §20~§21 장착 슬롯 6               어느 대기 문서도 소유하지 않던 몫("몸의 값" — 두 문서가 "Human 주입" 으로 미룬 것). 이 문서가 처음 받는다
§10 Condition target:actor · §20~§22 장착 슬롯 · Bag                          형의 자리 — Condition 은 C035 의 형에 이 층이 줄을 더한다(Discovery §2 와 같은 자리). 슬롯 · Bag 은 이 층이 자리를, 4층(L4-Item-Gem · L4-Item-Craft)이 내용을. 옮기지 않는다
§3.1 "현재 존재하는 상태"                                                       코드의 ActorState 와 대조는 spec 이 Reuse/Existing 으로 한다 — 여기서 고치지 않는다 (hp · cp · perceptionRange · currentAction 이 있고, R2 의 유도 구조는 없다)
§7 Awareness → Observation                                                  Foundation §2.6 의 2층 몫(World Truth → Observable Signal)은 세워졌다(C034~C038). 이 문서는 "누가 얼마나 멀리 감지하는가" 만 — 관찰 표면은 8층 · Required
```
