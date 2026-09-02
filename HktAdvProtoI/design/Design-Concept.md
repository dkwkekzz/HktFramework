# MMORPG 세계 문법 — 존재와 변화

## 1. 목적

이 문서는 MMORPG 세계에서 **무엇이 존재하고, 그것이 어떤 상태를 가지며, 어떤 규칙에 의해 변화하는지**를 정의한다.

전투, 탐험, 아이템, 성장, NPC, 환경 등 모든 게임 시스템은 이 문법 위에서 세계의 일부로 표현된다.

이 문서는 로드맵 기반 층의 **1층 — 세계의 문법**이다 ([content/roadmap/README.md](../content/roadmap/README.md) §2).
문법만 정한다 — 주체가 **어떻게 행동을 고르는가**(지식·숙련·경험·선호·목적·가능성 그래프)는
3층의 재료인 [Design-Subject-Decision.md](Design-Subject-Decision.md) 가 맡는다.

> **예시에 대하여** — 문서의 예시에 등장하는 이름(`Fairy01`, `AncientForest`)과 속성(`BodyTemperature`,
> `Poisoned`, `Class`)은 문법을 설명하기 위한 것이다. 어느 층의 확정도 아니다. 그 의미는 각 층이
> 주입될 때 Human 이 정한다.

---

# 2. 세계

세계는 다음 요소로 구성된다.

```text
World
├─ Entity
│  └─ Subject
├─ State
├─ Law
│  ├─ Natural Law
│  └─ Action Law
└─ Time
```

세계의 기본 동작은 다음과 같다.

```text
Entity가 존재한다.
        ↓
현재 State를 가진다.
        ↓
조건이 충족되면 Law가 적용된다.
        ↓
State가 변화한다.
```

즉 세계의 모든 변화는 기본적으로 다음 구조를 가진다.

```text
현재 State
    +
Law
    ↓
새로운 State
```

시간은 세계의 일부다. 시간이 흐르는 단위(tick)마다 세계는 Natural Law 의 조건을 검사하고,
Subject 가 요청한 Action Law 를 실행한다. 시간 자체(`WorldTime`)도 State 다.

---

# 3. Entity

## 정의

**Entity는 세계 안에서 독립된 동일성을 가지고 존재하는 것이다.**

예:

```text
Fairy01
Wolf01
Sword01
Tree01
StoneDeposit01
Fireball01
```

같은 종류의 존재라도 개별 상태를 가져야 한다면 서로 다른 Entity다.

예를 들어:

```text
Sword01
- Durability = 80

Sword02
- Durability = 15
```

두 검은 같은 종류일 수 있지만 세계에서는 서로 다른 Entity다.

Entity는 캐릭터에 한정되지 않는다.

생물, 아이템, 자원, 구조물, 투사체, 설치물 등 세계에서 독립적으로 존재하고 추적되어야 하는 것은 Entity로 표현할 수 있다.

---

# 4. State

## 정의

**State는 현재 세계에서 참인 사실이다.**

Entity의 속성도 State이고 Entity 사이의 관계도 State다.

예:

```text
HP(Fairy01) = 80

Location(Fairy01) = AncientForest

Durability(Sword01) = 45

Owns(Fairy01, Sword01) = true

Burning(Tree01) = true

Hostile(Wolf01, Fairy01) = true
```

따라서 현재 세계는 State들의 집합으로 표현할 수 있다.

```text
Fairy01
- HP = 80
- Location = AncientForest

Sword01
- Durability = 45
- Owner = Fairy01

Wolf01
- HP = 60
- HostileTo = Fairy01

Tree01
- Burning = true
```

State는 세계의 현재 모습을 표현한다.

## 저장되는 State 와 유도되는 사실

세계가 **저장하는 State** 와, 저장된 State 로부터 **계산되는 사실**은 구분한다.

```text
저장되는 State        Location(Fairy01) · HP(Fairy01) · Amount(Ore01)
유도되는 사실         Near(Fairy01, Ore01) · InRange(Fairy01, Wolf01, Sword) · Alive(Wolf01) · Downed(Wolf01)
```

유도되는 사실은 저장하지 않는다 — 언제나 저장된 State 로부터 다시 계산한다. 같은 사실을 두 곳에 두면
어느 쪽이 참인지 세계가 답할 수 없게 된다.

Law 의 **조건**에는 둘 모두 쓸 수 있다. Law 의 **결과**는 저장되는 State 만 바꾼다 — 유도되는 사실은
그 결과로 저절로 달라진다.

---

# 5. Subject

## 정의

**Subject는 스스로 행동을 실행할 수 있는 Entity다.**

예:

```text
플레이어가 조작하는 요정
몬스터
상인
NPC
동물
```

Subject도 일반 Entity와 동일하게 State를 가진다.

```text
Fairy01
- HP = 80
- Location = Forest
- Class = Swordsman
```

Subject의 특징은 세계에 정의된 특정 `Action Law`를 실행할 수 있다는 것이다.

누가 그 행동을 선택하는지는 Subject의 종류에 따라 달라질 수 있다.

플레이어 캐릭터라면 플레이어의 입력이 행동을 결정할 수 있고, NPC라면 별도의 행동 결정 시스템이 행동을 결정할 수 있다.

세계 문법에서 중요한 것은 **선택 과정이 아니라 선택된 행동이 세계에서 어떻게 실행되는가**이다.
선택 과정 — 주체가 무엇을 알고, 무엇을 원하고, 무엇을 선호하여 어느 행동을 고르는가 — 는
[Design-Subject-Decision.md](Design-Subject-Decision.md) 가 정의한다. 그 문서가 정의하는 지식·숙련·경험·선호·목적
역시 이 문법 안에서는 전부 **Subject 의 State** 다.

---

# 6. Law

## 정의

**Law는 특정 조건에서 State가 어떻게 변화하는지를 정의한다.**

기본 형태는 다음과 같다.

```text
조건
↓
Law 적용
↓
State 변화
```

예:

```text
조건

Burning(Tree01) = true
Near(Tree01, Tree02) = true

결과

Burning(Tree02) = true
```

Law는 변화가 발생하는 방식에 따라 크게 두 종류로 나뉜다.

```text
Law
├─ Natural Law
└─ Action Law
```

## Law 의 결과는 계산일 수 있다

결과는 고정된 값이 아니라 **현재 State 를 인자로 하는 계산**일 수 있다.

```text
HP(target) -= Damage(attacker, skill, target)
```

`Damage` 는 attacker 의 State(클래스·장비·지식), skill 의 State, target 의 State 를 읽어 값을 낸다.
계산의 입력은 언제나 State 다 — 세계 밖의 값이 결과에 들어오지 않는다.

## Law 의 결과는 확률을 가질 수 있다

결과는 확정적일 수도, 확률적일 수도 있다.

```text
조건

Attack(Fairy01, Wolf01, FireBall) 실행

결과

HP(Wolf01) -= FireDamage                    항상
Burning(Wolf01) = true                      확률 IgniteChance(Fairy01, FireBall, Wolf01)
```

확률 역시 계산이다 — 그 값은 State 로부터 나온다 (`IgniteChance` 는 클래스·장비·지식의 State 가 정한다).
어느 쪽으로 굴러갔는가를 정하는 것은 세계다. 세계는 같은 State 와 같은 시간에서 같은 결과를 낸다
(결정론) — 확률은 세계가 가진 난수 State 로 굴린다. 세계 밖에서 굴린 값을 세계가 받아들이지 않는다.

## Law 의 적용은 시간에 걸칠 수 있다

Law 는 즉시 끝나는 것만이 아니다. 시작하고, 진행되고, 끝나는 것도 있다.

```text
Mine(Fairy01, Ore01, Pickaxe01) 실행

시작   CurrentAction(Fairy01) = Mine(Ore01)      Progress = 0        ← Action Law
진행   Progress(Fairy01) += 1  (tick 마다)                            ← Natural Law
끝     Progress 가 Duration 에 닿으면 Amount(Ore01) -= 2 …            ← Natural Law
```

**진행 중이라는 사실 자체가 State 다.** 그래서 진행 중에 다른 Law 가 개입할 수 있다 — 맞아서 끊기고,
피로로 느려지고, 도중에 대상이 사라진다. 한 행동은 이렇게 **시작을 놓는 Action Law 와 그 뒤를 잇는
Natural Law 들**로 나뉘어 표현될 수 있다.

---

# 7. Natural Law

## 정의

**Natural Law는 Subject의 행동 없이 조건에 의해 발생하는 변화다.**

세계는 시간이 흐르는 단위(tick)마다 Natural Law 의 조건을 검사하고, 충족된 것을 적용한다.

예:

```text
불이 주변으로 번진다.

추운 환경에서 체온이 내려간다.

독에 중독된 생물의 체력이 감소한다.

낮이 지나면 밤이 된다.

떨어지는 물체가 아래로 이동한다.

시작된 행동이 진행된다.
```

예를 들어 혹한 환경은 다음과 같이 표현될 수 있다.

```text
조건

Temperature(Area) < -20
ColdResistance(Fairy01) < 10

결과

BodyTemperature(Fairy01) -= 1
```

이러한 법칙을 통해 환경 자체가 세계에 영향을 준다.

---

# 8. Action Law

## 정의

**Action Law는 Subject가 행동을 통해 실행하는 Law다.**

예:

```text
Move
Attack
UseSkill
PickUp
Equip
Mine
Craft
Trade
Interact
```

예를 들어 공격은 다음과 같이 표현할 수 있다.

```text
Attack(attacker, target, skill)
```

조건:

```text
Alive(attacker)
Alive(target)

CanUse(attacker, skill)

InRange(attacker, target, skill)
```

결과:

```text
HP(target) -= Damage(attacker, skill, target)
```

채굴 역시 같은 구조다.

```text
Mine(subject, deposit, tool)
```

조건:

```text
Near(subject, deposit)

Owns(subject, tool)

CanMine(tool, deposit)
```

결과:

```text
Amount(deposit) -= 2

Inventory(subject, Ore) += 2

Durability(tool) -= 1
```

전투와 채굴은 서로 다른 게임 시스템이지만 세계의 관점에서는 동일하다.

둘 모두 **조건을 만족한 Subject가 Action Law를 실행하여 State를 변화시키는 것**이다.

---

# 9. 세계 변화

게임에서 발생하는 모든 결과는 State의 변화로 표현한다.

### 이동

```text
Location(Fairy01)

Forest
→
Cliff
```

### 공격

```text
HP(Wolf01)

50
→
25
```

### 채굴

```text
Amount(Ore01)

10
→
8
```

### 아이템 획득

```text
Owner(Sword01)

None
→
Fairy01
```

### 장착

```text
EquippedWeapon(Fairy01)

None
→
Sword01
```

### 상태 이상

```text
Poisoned(Fairy01)

false
→
true
```

게임 시스템이 아무리 복잡해져도 세계에 실제로 발생한 결과는 이 원칙으로 표현할 수 있어야 한다.

```text
State
↓
Law
↓
State Change
```

## 한 순간에 여러 Law 가 적용된다

MMORPG 에서는 같은 순간에 여러 Subject 가 행동하고, 여러 Natural Law 의 조건이 동시에 충족된다.

```text
Amount(Ore01) = 1

같은 tick 에
Mine(Fairy01, Ore01, …)
Mine(Fairy02, Ore01, …)
```

둘 다 조건을 만족했지만 둘 다 결과를 얻을 수는 없다. **어느 Law 가 먼저 적용되는가를 세계가 정한다** —
그 순서 자체가 세계의 규칙이다. 순서가 정해져 있으므로 같은 State 에서 같은 요청들은 언제나 같은 결과를
낸다. 세계 밖(관찰자·클라이언트)이 순서를 정하지 않는다.

---

# 10. 게임 시스템과 세계 문법

전투, 탐험, 성장, 아이템, 클래스, 지식 등의 시스템은 각각 고유한 규칙을 가질 수 있다.

하지만 그 결과가 세계에서 발생할 때는 공통된 세계 문법으로 표현된다.

## 세 성장 축

이 게임의 캐릭터는 세 성장 축을 가진다 ([content/roadmap/L0-Game.md](../content/roadmap/L0-Game.md) §1).

```text
클래스    사용할 수 있는 스킬을 제공한다
아이템    그 스킬을 증폭시키거나 속성을 부가한다
지식      두 축을 연결하여 세계에서 발현될 수 있게 한다
```

세 축은 서로 다른 시스템이지만 세계 안에서는 전부 **Subject 의 State** 이고, Law 의 **조건과 계산**에
들어가는 방식만 다르다.

클래스는 어떤 Action Law 를 실행할 수 있는가(조건)를 연다.

```text
Class(Fairy01) = FlameMage
        ↓
CanUse(Fairy01, FireBall) = true
```

아이템은 그 Action Law 의 결과 계산에 들어간다 — 증폭하거나, 없던 속성을 부가한다.

```text
Equipped(Fairy01, FlameCore01)
        ↓
FireDamage(Fairy01, FireBall, target) += Power(FlameCore01)          증폭
IgniteChance(Fairy01, FireBall, target) += Ignite(FlameCore01)       부가
```

지식은 두 축을 잇는다 — 클래스가 준 스킬과 아이템이 준 속성이 **함께** 세계에 발현되는 조건이다.

```text
Knows(Fairy01, FlameCoreChanneling) = true
        ↓
FireBall 의 결과 계산에 FlameCore01 의 속성이 들어간다

Knows(Fairy01, FlameCoreChanneling) = false
        ↓
FireBall 은 나가지만 FlameCore01 은 결과에 아무 영향이 없다
```

즉 클래스는 **조건**을, 아이템은 **계산**을, 지식은 **그 둘을 잇는 조건**을 담당한다.
세 축의 State 가 하나의 Law 안에서 만나 결과를 낸다 — 그 결과가 확률을 가지므로, 세 축의 조합은 곧
**확률의 조합**이다. 이 게임의 핵심 재미는 그 조합에서 나온다.

지식이 무엇이고 어떻게 얻어지며 주체의 행동 선택에 어떻게 쓰이는가는
[Design-Subject-Decision.md](Design-Subject-Decision.md) 와
[Design-Autonomous-Behavior-Knowledge-R0.md](Design-Autonomous-Behavior-Knowledge-R0.md) 가 정의한다.
이 문서는 지식이 세계에 닿는 자리 — **Law 의 조건과 계산에 들어가는 State** — 만 정한다.

따라서 개별 게임 시스템은 서로 다른 의미를 가지더라도 세계 안에서는 공통적으로 다음 구조를 사용한다.

```text
Entity
+
State
+
Law
↓
State Change
```

---

# 11. 핵심 문법

이 세계의 가장 기본적인 문법은 다음 네 가지 질문으로 정리된다.

| 개념          | 질문                    |
| ----------- | --------------------- |
| **Entity**  | 무엇이 존재하는가?            |
| **State**   | 지금 그것은 어떤 상태인가?       |
| **Subject** | 무엇이 행동할 수 있는가?        |
| **Law**     | 어떤 조건에서 무엇이 어떻게 변하는가? |

그리고 세계는 반복해서 다음과 같이 움직인다.

```text
Entity가 존재한다.

현재 State가 있다.

시간이 한 단위 흐른다.

Natural Law가 발생하거나
Subject가 Action Law를 실행한다.
여럿이면 세계가 정한 순서로 적용된다.

State가 변한다.

변화된 State가 새로운 현재 세계가 된다.
```

이 구조가 MMORPG 세계를 구성하는 기본 문법이다.
