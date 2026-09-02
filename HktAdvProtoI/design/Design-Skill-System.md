# SYSTEM DESIGN DOCUMENT

## Skill System Architecture — 최종안

| 항목        | 내용                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| **상태**    | Final Design Draft                                                                                           |
| **기반**    | `기본 공격/방어 공식`, `Damage Type — Physical / Aura`                                                        |
| **범위**    | Skill / Targeting / Spatial Presence / Execution / Effect                                                     |
| **작성 목적** | 근접 공격, 단일 대상 공격, 범위 공격, 투사체, 장판, 광선, 함정, 소환 등 다양한 MMORPG 스킬을 기존 World Capability의 조합으로 확장할 수 있는 공통 구조를 정의한다. |

> **핵심 명제**
>
> Skill은 Fireball, Beam, Area 같은 이름별 시스템의 집합이 아니다.
>
> **Skill은 어떤 기준으로 대상을 잡고, 기존 World Capability를 어떤 공간·시간 구조로 실행하여, 최종적으로 어떤 World State Transition을 발생시킬지를 정의한다.**

---

# 0. 설계 원칙

현재 전투 시스템에는 이미 피해 계산 구조가 존재한다.

```text
Skill Base Damage
+ Attack × Skill Attack Ratio
→ Defense
→ Final Damage
```

Damage Type 또한 `Physical / Aura` 중 어떤 공격·방어 능력치를 사용할지를 결정하며, 새로운 공격 형태마다 별도의 피해 공식을 요구하지 않는다.

기존 전투 시스템의 핵심 원칙 역시 다음과 같다.

> 새로운 시스템은 새로운 피해 공식을 만들지 않는다.
> 기존 공식의 입력값이나 결과에 필요한 의미만 추가한다.

Skill System도 같은 원칙을 따른다.

따라서:

```text
Sword Slash
Fireball
Meteor
Beam
Poison Field
Chain Lightning
Trap
```

등을 각각 별도 System으로 만들지 않는다.

---

# 1. 문서 구성과 책임 경계

Skill System은 네 책임으로 나눈다. 각 책임은 하나의 문서가 소유하며, 같은 의미를 두 문서에 중복해 두지 않는다.

```text
Skill System
│
├─ Skill-System
│    전체 구조와 책임 경계
│
├─ World Spatial Presence
│    Actor가 아닌 존재가 세계 공간에 존재하는 방법
│
├─ Skill Execution Form
│    Skill이 World Capability를 실행하는 방법
│
└─ Skill Effect
     실행 결과 기존 World State Transition을 호출하는 방법
```

| 문서                                                         | 소유하는 의미                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Skill-System.md` (이 문서)                                    | Skill이 무엇인가 · 전체 시스템 관계 · 각 문서의 책임 경계 · 새 Primitive 추가 기준 · 금지 구조 · 수용 기준                                       |
| [`World-Spatial-Presence.md`](World-Spatial-Presence.md)   | Actor가 아닌 존재의 공간 존재 · Transform · Shape · Lifetime · Movement · Anchor · Observation Layer와의 경계                  |
| [`Skill-Execution-Form.md`](Skill-Execution-Form.md)       | Activation · Target Anchor · Target Resolution · Spatial Query · Execution 방식(Contact / Direct / Spatial Query / Spatial Presence / Trigger / Composition) |
| [`Skill-Effect.md`](Skill-Effect.md)                       | Resolved Target을 현재 구현된 World Capability에 연결하는 방법 · 미구현 Effect를 선점하지 않는 규칙                                      |

경계 판정이 애매할 때는 다음 질문으로 나눈다.

```text
"세계에 무엇이 존재하는가"          → World-Spatial-Presence
"어떤 기준으로 누구를 고르는가"      → Skill-Execution-Form
"고른 대상에게 무엇이 일어나는가"    → Skill-Effect
"이 전부가 어떻게 하나의 Skill인가"  → Skill-System
```

---

# 2. Skill의 정의

Skill은 다음과 같이 정의한다.

> **Actor가 특정 Activation과 Targeting을 통해 하나 이상의 World Capability를 실행하는 규칙**

개념적으로:

```text
Skill
│
├─ Activation
│
├─ Target Anchor
│
├─ Execution
│
├─ Target Resolution
│
└─ Effect
```

여기서 가장 중요한 것은 **Target Anchor와 Target Resolution을 분리하는 것**이다.

Skill 자체는 새로운 세계 규칙을 소유하지 않는다. Skill은 이미 세계에 존재하는 Capability를 어떤 순서와 공간 구조로 부를지만 결정한다.

---

# 3. Target Anchor와 Target Resolution은 다르다

스킬에서 다음 두 질문은 서로 다르다.

```text
어디를 향해 Skill을 사용하는가?
```

와

```text
결과적으로 누가 Effect를 받는가?
```

따라서 Targeting을 하나의 개념으로 처리하지 않는다.

```text
Target Anchor
    Skill 실행의 공간적 기준
    Self / Unit / Direction / GroundPoint

Target Resolution
    실제로 Effect를 받는 Actor 집합의 결정
    Single / Spatial
```

Target Anchor는 **실제 Effect 대상 수를 결정하지 않는다.**

같은 `Unit` Anchor라도 결과는 다를 수 있다.

### 단일 마법

```text
Target Anchor = Unit
Resolution    = Single
```

### 대상 중심 폭발

```text
Target Anchor = Unit
Resolution    = Spatial
Origin        = Target.Position
Geometry      = Circle(5m)
Selection     = All
```

따라서 `Unit Target = 단일 대상 스킬`이 아니다. 두 축은 반드시 독립적으로 유지한다.

각 축의 상세 정의와 Parameter는 [`Skill-Execution-Form.md`](Skill-Execution-Form.md)가 소유한다.

---

# 4. Skill Execution 전체 흐름

```text
Activation
    ↓
Target Anchor 결정
    ↓
Execution
    ↓
Target Resolution
    ↓
Resolved Target(s)
    ↓
Effect
    ↓
World State Transition
    ↓
Observer Projection
    ↓
Observable World
```

Execution에는 현재 다음 기본 방식만 둔다.

```text
Contact
Direct
Spatial Query
Spatial Presence
Trigger
Composition
```

이 여섯 가지 외의 실행 방식을 Skill 이름 때문에 추가하지 않는다. 필요하다면 §6의 기준을 먼저 통과해야 한다.

---

# 5. 기존 Skill 형태의 재해석

MMORPG에서 일반적으로 부르는 형태는 다음 조합으로 표현한다.

| 콘텐츠 표현          | 시스템 구성                                          |
| --------------- | ----------------------------------------------- |
| 단일 공격           | Unit Anchor + Single Resolution                 |
| 범위 공격           | Spatial Resolution                              |
| 근접 공격           | Contact                                         |
| Projectile      | Spatial Presence + Movement + Collision Trigger |
| 폭발              | Spatial Query + Once                            |
| 장판              | Spatial Presence + 반복 Spatial Query             |
| Attached Area   | Spatial Presence + Anchor                       |
| Moving Area     | Spatial Presence + Movement                     |
| Beam            | Line Spatial Query + 반복 실행                      |
| Trail           | 이동 중 Presence 반복 생성                             |
| Trap            | Spatial Presence + Trigger                      |
| Chain           | 반복 Target Resolution + Direct                   |
| Movement Attack | Actor Movement + Contact/Spatial Query          |
| Tether          | Persistent Relation + 반복 Execution              |
| Summon          | Actor Spawn Capability                          |

이 목록을 `SkillType` 또는 `DeliveryType` enum으로 고정하지 않는다.

이 표는 **구현 목록이 아니라 번역표**다. 각 행의 실제 구성 예시는 [`Skill-Execution-Form.md`](Skill-Execution-Form.md)가 소유한다.

---

# 6. 새 Primitive 추가 기준

새 시스템 Primitive는 다음 조건을 **모두** 만족할 때만 추가한다.

1. 기존 Capability 조합으로 표현할 수 없다.
2. Parameter 추가로 해결할 수 없다.
3. 새로운 World State 또는 생명주기가 필요하다.
4. 새로운 판정 규칙이 존재한다.
5. 실제 Gameplay에서 독립적인 의미가 관찰된다.
6. 여러 콘텐츠에서 재사용 가능하다.

따라서:

```text
Beam
Fireball
Meteor
Whirlwind
PoisonField
```

같은 콘텐츠 이름은 새로운 Primitive의 근거가 아니다.

새 Primitive가 필요하다고 판단하면 구현 전에 다음을 명시한다.

```text
기존 Capability 조합으로 표현할 수 없는 이유
새로운 World 의미
새로운 Runtime 생명주기
새로운 관찰 상태
재사용 가능한 Skill 예시 둘 이상
```

---

# 7. 구현에서 금지할 구조

다음과 같은 Skill 이름별 시스템을 만들지 않는다.

```text
FireballSystem
MeteorSystem
BeamSystem
PoisonFieldSystem
```

다음처럼 전달 방식과 Effect를 결합하지 않는다.

```text
ProjectileDamage
AreaDamage
BeamDamage
MeleeDamage
```

또한:

```text
SkillType =
    SingleTarget
    AoE
```

처럼 단일/범위를 Skill Type으로 고정하지 않는다.

단일/범위 여부는 **Target Resolution 결과**다.

Effect를 Execution 자리에 두지 않는다.

```text
금지    Execution = Heal
허용    Execution = Direct        + Effect = Heal
허용    Execution = Spatial Query + Effect = Heal
```

---

# 8. World와 View의 경계

World는 다음 사실의 Source of Truth다.

```text
어떤 Skill이 실행 중인가
어떤 Spatial Presence가 존재하며 어디에 있는가
어떤 Target이 Resolve되었는가
어떤 Effect가 언제 실행되었는가
그 결과 World State가 어떻게 변했는가
```

View는 이 결과를 자체적으로 추론하지 않는다.

```text
World
    Collision · Target Resolution · Effect 결정
        ↓
    GameView Specification
        ↓
View
    결과를 표현
```

Projectile을 화면에 그렸다는 사실이 충돌 여부를 결정하지 않는다. VFX가 넓게 퍼졌다는 사실이 Spatial Query의 반경을 넓히지 않는다.

관찰 가능성(누가 그것을 볼 수 있는가) 역시 Skill의 책임이 아니라 Observation Rule의 책임이다 — [`World-Spatial-Presence.md`](World-Spatial-Presence.md) §10.

---

# 9. 새로운 Skill을 설계하는 순서

Agent는 Skill 이름을 보고 바로 시스템 타입을 추가해서는 안 된다.

다음 순서로 작업한다.

## STEP 1 — 플레이 결과 정의

```text
"파이어볼이 날아가고,
적과 충돌하면 폭발하며,
폭발 범위의 적들에게 피해를 준다."
```

## STEP 2 — Target Anchor 정의

```text
Direction
```

## STEP 3 — Execution 분해

```text
Spatial Presence
Movement
Collision Trigger
Spatial Query
```

## STEP 4 — Target Resolution 정의

```text
Origin
    Collision Position
Geometry
    Circle
Filter
    Enemy
Selection
    All
```

## STEP 5 — Effect 연결

```text
Damage
```

## STEP 6 — 필요한 Capability의 구현 여부 확인

```text
Spatial Presence     MISSING
Movement             EXISTS / EXTEND
Collision Trigger    MISSING
Spatial Query        MISSING
Damage               IMPLEMENTED
```

## STEP 7 — 부족한 Capability만 해당 Cycle에서 구현

한 Cycle이 모든 빈칸을 한 번에 채우지 않는다. 그 Cycle의 플레이 목표가 요구하는 Capability만 구현한다.

---

# 10. Master Layer 와의 접합

이 문서는 Skill 영역의 판단 기준이 인용하는 **근거 문서**다. 어떤 절이 어떤 원칙을 공급하는지는 다음과 같다.

| 이 문서                                | Constraint                            |
| ----------------------------------- | ------------------------------------- |
| §2 · §5 · §7 · §11                  | `DC-SKILL-IS-COMBINATION-NOT-NAME`    |
| §7 · §0                             | `DC-SKILL-DELIVERY-IS-NOT-EFFECT`     |
| §6 · §9                             | `DC-SKILL-COMBINE-BEFORE-NEW-FORM`    |
| §3 · §7 · 핵심 원칙                    | `DC-SKILL-ANCHOR-IS-NOT-RESOLUTION`   |
| 핵심 원칙 · [`Skill-Effect.md`](Skill-Effect.md) §1 · §5 | `DC-SKILL-EFFECT-MUST-ALREADY-EXIST` |
| 핵심 원칙 · [`World-Spatial-Presence.md`](World-Spatial-Presence.md) §1 · §3 | `DC-SKILL-PRESENCE-IS-WORLD-NOT-SKILL` |

스킬 전달 형태의 사다리(`MS-SKILL-FORM`)도 이 문서의 §4 · §5 를 자리 목록의 근거로 쓴다.

이 문서의 절을 재배치하거나 삭제할 때는 위 Constraint 의 인용이 함께 살아 있는지 확인한다. 근거가 사라진 Constraint 는 보류하지 않고 삭제하는 것이 이 프로젝트의 규칙이며, 그 판단은 Human 이 한다.

---

# 11. 최종 구조

```text
                         Skill
                           │
               ┌───────────┴───────────┐
               │                       │
          Activation              Target Anchor
                                Self / Unit
                              Direction / Ground
               │                       │
               └───────────┬───────────┘
                           ↓
                     Skill Execution
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
    Contact              Direct          Spatial Operation
                                                │
                                  ┌─────────────┴─────────────┐
                                  │                           │
                            Spatial Query               Spatial Presence
                                  │                           │
                             Origin                       Transform
                             Geometry                     Shape
                             Filter                       Lifetime
                             Selection                    Movement
                                  │                       Anchor
                                  │                           │
                                  └─────────────┬─────────────┘
                                                ↓
                                             Trigger
                                                ↓
                                      Target Resolution
                                                ↓
                                         Resolved Target[]
                                                ↓
                                      Existing World Capability
                                                ↓
                                         World State Change
                                                ↓
                                      Observer Projection
                                                ↓
                                        Observable World
```

---

# 12. 수용 기준

최종 Skill System은 다음 조건을 만족해야 한다.

1. 단일 대상 공격을 표현할 수 있다.
2. 하나의 Unit을 대상으로 하는 단일 힐을 표현할 수 있다.
3. Direction 기반 범위 공격을 표현할 수 있다.
4. GroundPoint 기반 범위 공격을 표현할 수 있다.
5. Self 중심 범위 공격을 표현할 수 있다.
6. Unit을 Anchor로 하지만 주변 여러 Actor에게 적용되는 광역기를 표현할 수 있다.
7. 범위 안 모든 Actor 또는 최대 N개 Actor를 선택할 수 있도록 확장 가능하다.
8. Projectile 충돌 대상 한 명에게만 적용되는 Skill을 표현할 수 있다.
9. Projectile 충돌 지점을 중심으로 범위 판정하는 Fireball을 표현할 수 있다.
10. 장판을 Spatial Presence + Spatial Query 조합으로 표현할 수 있다.
11. Beam을 필요하면 Line Query의 반복으로 표현할 수 있다.
12. Attached Area와 Moving Area를 별도 Primitive 없이 Presence의 상태 차이로 표현할 수 있다.
13. Trap을 Presence + Trigger로 표현할 수 있다.
14. Summon을 Delivery가 아니라 Actor Spawn Capability로 처리한다.
15. `Single Target / AoE`를 Skill Type enum으로 만들지 않는다.
16. 아직 존재하지 않는 Heal/Shield/CC 등을 Skill System에서 임의로 정의하지 않는다.
17. Damage는 기존 Damage Type과 Damage Formula를 그대로 사용한다.
18. Spatial Presence의 World Truth와 Observer별 Observable State를 분리한다.
19. View가 Target Resolution, Collision 또는 Effect 결과를 결정하지 않는다.
20. 새로운 Skill 요구가 들어왔을 때 먼저 기존 Capability 조합으로 표현 가능한지 검증한다.

각 문서의 개별 수용 기준은 해당 문서가 소유한다.

---

# 핵심 원칙

> **Target Anchor와 Target Resolution은 다르다.**
> **Unit을 조준한다고 단일 대상 스킬인 것은 아니다.**
> **범위 공격은 Skill Type이 아니라 Spatial Query를 통해 여러 Target이 결정된 결과다.**
> **Skill 이름을 시스템으로 만들지 않는다.**
> **Projectile, Area, Beam, Trap은 우선 기존 World Capability의 조합으로 표현한다.**
> **Actor가 아닌 공간 존재가 필요하다면 Skill 내부에 임시 개념을 만들지 않고 먼저 World Spatial Presence를 확장한다.**
> **Effect는 현재 세계에 실제로 존재하는 State Transition Capability만 사용할 수 있다.**
> **어떤 공격 형태가 추가되어도 기존 Damage Formula는 유지한다.**
> **Skill System은 세계 위에 별도의 전투 세계를 만드는 것이 아니라 기존 World를 조합하여 사용하는 시스템이다.**
