# SYSTEM DESIGN DOCUMENT

## Skill Execution Form — 실행 형태

| 항목        | 내용                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------- |
| **상태**    | Final Design Draft                                                                                    |
| **상위 문서** | [`Skill-System.md`](Skill-System.md)                                                                  |
| **범위**    | Activation / Target Anchor / Target Resolution / Spatial Query / Execution                            |
| **작성 목적** | Skill이 기존 World Capability를 **어떤 기준으로, 어떤 공간·시간 구조로 실행하는지**를 정의한다. 대상에게 무엇이 일어나는지는 정의하지 않는다.        |

> **핵심 명제**
>
> **어디를 향해 쓰는가(Target Anchor)와 누가 맞는가(Target Resolution)는 다른 질문이다.**
> Execution은 그 둘 사이를 잇는 공간·시간 구조일 뿐이며, 그 자체로 피해 의미를 가지지 않는다.

---

# 0. 이 문서의 책임

```text
소유한다
    Activation
    Target Anchor
    Target Resolution
    Spatial Query (Origin · Geometry · Filter · Selection)
    Execution (Contact · Direct · Spatial Query · Spatial Presence · Trigger · Composition)
    Skill Definition 권장 구조
    Skill 실행의 관찰 계약

소유하지 않는다
    Resolved Target에게 무엇이 일어나는가        → Skill-Effect.md
    Actor가 아닌 존재가 세계에 어떻게 존재하는가   → World-Spatial-Presence.md
    피해 공식 · Damage Type                      → 기존 전투 시스템
```

---

# 1. 실행 흐름

```text
Activation
    ↓
Target Anchor 결정
    ↓
Execution
    ↓
Target Resolution
    ↓
Resolved Target[]
    ↓
Effect
```

이 흐름은 한 방향이다. Effect가 Target Resolution을 되돌리거나, Target Resolution이 Activation 조건을 바꾸지 않는다.

Execution은 여러 번 반복되거나(Trigger) 다른 Execution을 낳을 수 있다(Composition). 그때도 각 실행은 위 흐름을 그대로 반복한다.

---

# 2. Activation — 발동 방식

Activation은 Skill 실행이 **언제 시작되고 언제 끝나는지**를 정의한다.

```text
Normal
Cast
Charge
Hold / Channel
Combo
Toggle
```

## 2.1 Normal

입력 즉시 실행을 시작한다.

```text
Input
→ Execute
```

## 2.2 Cast

준비 시간이 끝난 뒤 실행한다.

```text
Input
→ Cast Time
→ Execute
```

Cast가 중단될 수 있는지(Interrupt)는 이 문서가 정의하지 않는다. Interrupt는 별도 World Capability이며, 존재할 때 Activation이 그것을 참조한다.

## 2.3 Charge

입력을 유지한 시간이 Skill Parameter를 바꾼다.

```text
Input Hold
    ↓
Charge
    ↓
Release
    ↓
Execute
```

변경 대상은 Parameter이지 공식이 아니다.

```text
허용   Charge → Geometry.Radius 증가
허용   Charge → Presence.Speed 증가
허용   Charge → Skill Base Damage 증가
금지   Charge → 새로운 피해 계산 경로
```

## 2.4 Hold / Channel

입력을 유지하는 동안 Execution이 반복된다.

```text
Input Hold
→ Execute
→ Execute
→ Execute
→ Release
```

반복 간격은 Trigger(§8.5)가 소유한다.

## 2.5 Combo

하나의 Skill 입력이 여러 실행 단계로 이어진다.

```text
Step 1
→ Step 2
→ Step 3
```

각 Step은 서로 다른 Target Anchor · Execution · Effect를 가질 수 있다.

## 2.6 Toggle

활성화한 뒤 다시 끌 때까지 유지한다.

```text
OFF
 ↓ Input
ON
 ↓ Input
OFF
```

ON 상태 동안 무엇이 반복되는지는 Execution과 Trigger가 정한다. Toggle 자체는 상태 유지만 의미한다.

---

# 3. Target Anchor — 실행 기준

Target Anchor는 Skill 실행의 **공간적 기준**을 정한다.

초기 형태는 다음 네 가지다.

```text
Self
Unit
Direction
GroundPoint
```

## 3.1 Self

Caster 자신을 기준으로 한다.

```text
회전베기
자기 중심 폭발
Aura
자기 회복
```

## 3.2 Unit

하나의 Actor를 기준으로 한다.

```text
단일 공격
단일 힐
대상 추적 투사체
대상 중심 광역기
```

Unit Anchor는 이미 세계에 있는 대상 지목 관계(`CurrentTarget`)를 사용한다. Skill이 자체 대상 선택 규칙을 새로 만들지 않는다.

## 3.3 Direction

특정 방향을 기준으로 한다.

```text
횡베기
찌르기
화살
파이어볼
브레스
충격파
```

## 3.4 GroundPoint

세계의 특정 위치를 기준으로 한다.

```text
Meteor
장판
Trap
설치물
```

## 3.5 Anchor가 결정하지 않는 것

Target Anchor는 **실제 Effect 대상 수를 결정하지 않는다.**

```text
Anchor 가 결정한다
    실행의 기준 위치 · 기준 방향 · 기준 Actor
    사용 가능 여부의 전제 (대상이 없으면 Unit Anchor 스킬은 시작하지 않는다)

Anchor 가 결정하지 않는다
    몇 명이 맞는가
    누가 맞는가
    어떤 순서로 맞는가
```

---

# 4. Target Resolution — 실제 효과 대상 결정

Target Resolution은 실행 결과 실제로 어떤 Actor가 Effect를 받을지를 결정한다.

초기에는 크게 다음 두 형태로 본다.

```text
Single
Spatial
```

## 4.1 Single Resolution

이미 하나의 대상이 결정되어 있으며 그 대상에 직접 Effect를 적용한다.

```text
Target Anchor
    ↓
Resolved Unit
    ↓
Effect
```

대표:

```text
단일 대상 공격
단일 힐
단일 Buff
단일 상태 변화
```

예:

```text
Basic Heal
Target Anchor = Unit
Resolution    = Single
Effect        = Heal
```

단, Heal Capability가 실제 세계에 구현된 이후에만 사용할 수 있다 ([`Skill-Effect.md`](Skill-Effect.md) §5).

Single Resolution의 대상은 Anchor에서만 오는 것이 아니다. Contact 결과나 Collision 결과도 이미 결정된 하나의 대상이 될 수 있다.

```text
Anchor       Unit          → Resolved Unit
Contact      접촉한 Actor   → Resolved Unit
Collision    충돌한 Actor   → Resolved Unit
```

## 4.2 Spatial Resolution

공간을 조회하여 조건에 맞는 Actor 집합을 결정한다.

```text
Origin
+
Geometry
+
Filter
+
Selection
    ↓
Target[]
```

이것이 MMORPG의 **범위 공격/AoE의 실제 기반**이다.

`AoE`라는 별도의 Skill Type을 만들지 않는다.

---

# 5. Spatial Query

Spatial Resolution은 Spatial Query를 사용한다.

최소 구성:

```text
SpatialQuery
{
    Origin
    Geometry
    Filter
    Selection
}
```

Spatial Query는 **읽기 연산**이다. 세계 상태를 바꾸지 않으며, 같은 세계 상태에 같은 Query를 넣으면 항상 같은 Target 목록을 같은 순서로 돌려준다.

## 5.1 Origin

공간 검색의 기준 위치다.

Origin은 Target Anchor와 동일할 수도 있고 실행 과정에서 새로 만들어질 수도 있다.

```text
Self.Position
Target.Position
GroundPoint
Projectile.CollisionPosition
SpatialPresence.Position
```

따라서 다음도 가능하다.

```text
Target Anchor = Unit
Query Origin
    = Target.Position
Geometry
    = Circle
```

즉:

> 선택한 적 주변 모든 적에게 피해

같은 스킬을 자연스럽게 표현할 수 있다.

방향이 필요한 Geometry(Cone·Arc·Line·Box)는 Origin과 함께 기준 방향을 받는다. 기준 방향의 출처 역시 Anchor이거나 Presence의 진행 방향이다.

## 5.2 Geometry

Spatial Query의 공간적 형태다.

초기 형태:

```text
Point
Line
Circle / Sphere
Box
Cone
Arc
Ring
```

예:

```text
찌르기
→ Line

횡베기
→ Arc

브레스
→ Cone

자기 중심 폭발
→ Circle

도넛 패턴
→ Ring
```

Geometry는 Damage 의미를 가지지 않는다. 넓은 Geometry가 더 아프지 않고, 좁은 Geometry가 더 정확하지 않다. 그런 의미가 필요하다면 Skill Parameter나 Effect가 소유한다.

## 5.3 Target Filter

공간 안에 있다고 모두 Effect 대상이 되는 것은 아니다.

Filter가 적용 가능한 Actor를 결정한다.

초기에는 단순하게 시작한다.

```text
Enemy
Ally
Self
```

필요한 Cycle에서 이후 확장할 수 있다.

```text
Actor Type
Faction
Tag
State
```

등을 실제 게임 요구가 생겼을 때 추가한다. 아직 세계에 Faction 개념이 없다면 Filter에 Faction을 미리 선언하지 않는다.

## 5.4 Target Selection

Filter를 통과한 후보 가운데 실제 대상을 결정한다.

초기:

```text
One
All
Max N
```

필요할 경우 이후:

```text
Nearest
Farthest
Lowest HP
Highest HP
Random
```

등을 확장할 수 있다.

현재 결정론적 전투 철학을 유지하는 동안 `Random` 같은 선택 정책은 별도 설계 없이 추가하지 않는다.

`Max N`과 `One`은 후보 순서를 요구한다. 순서 규칙(예: Origin으로부터의 거리)이 정해지지 않은 채 `Max N`을 쓰지 않는다 — 그것은 결정론을 깨뜨린다.

---

# 6. 단일 공격과 범위 공격

두 종류의 차이는 Skill Type이 아니라 Resolution의 차이다.

## 단일 대상 공격

```text
Target Anchor
    Unit
Resolution
    Single
Effect
    Damage
```

## 범위 공격

```text
Target Anchor
    Self / Unit / Direction / GroundPoint
Resolution
    Spatial
SpatialQuery
    Origin
    Geometry
    Filter
    Selection
Effect
    Damage
```

---

# 7. Execution — 실행 방식

Execution에는 현재 다음 기본 방식만 둔다.

```text
Contact
Direct
Spatial Query
Spatial Presence
Trigger
Composition
```

---

# 8. 각 Execution 방식

## 8.1 Contact

현재 존재하는 Actor의 Swing Collider와 Body 접촉을 사용한다.

```text
ACTION
 ↓
SWING
 ↓
COLLIDER
 ↓
BODY
 ↓
Contact Event
```

기존 전투 시스템은 이미 이 구조를 가지고 있으므로 새로운 Melee System을 만들지 않는다.

예:

```text
Sword Slash
Target Anchor
    Direction
Execution
    Contact
Resolution
    Contact한 Actor
Effect
    Damage
```

Contact 범위가 여러 Actor에게 닿는다면 여러 Actor에게 각각 Hit가 발생할 수 있다.

따라서 근접 공격도 반드시 단일 대상일 필요는 없다.

## 8.2 Direct

이미 결정된 Actor에게 공간 전달 과정 없이 실행한다.

```text
Resolved Unit
    ↓
Direct
    ↓
Effect
```

대표:

```text
단일 힐
즉시 공격
Buff
Debuff
Resource Transfer
```

단 해당 World Capability가 실제로 구현되어 있어야 한다.

Direct는 "거리 판정이 없다"는 뜻이 아니다. 사용 가능 거리 조건은 Activation의 전제이며, Direct는 그 조건이 통과한 뒤 공간 전달체 없이 Effect가 적용된다는 의미다.

## 8.3 Spatial Query Execution

세계 공간을 한 번 조회해 대상을 결정하고 Effect를 적용한다.

```text
Origin 결정
    ↓
Spatial Query
    ↓
Resolved Target[]
    ↓
Effect
```

폭발, 범위 근접 공격, Ground AoE가 모두 이 형태다. 폭발이라는 별도 Primitive는 존재하지 않는다 — 그것은 **한 번 실행되는 Spatial Query**다.

## 8.4 Spatial Presence Execution

세계에 Actor가 아닌 존재를 만든다.

```text
Create Spatial Presence
    ↓
(Presence가 세계에 존재하는 동안)
    ↓
Trigger
    ↓
다음 Execution
```

Presence의 상태·생명주기·Movement·Anchor는 [`World-Spatial-Presence.md`](World-Spatial-Presence.md)가 소유한다. 이 문서는 Skill이 Presence를 **만들고 그 Trigger를 받는 방법**만 정의한다.

## 8.5 Trigger

Trigger는 특정 세계 사건을 다른 Execution과 연결한다.

```text
OnCollision
OnEnter
OnExit
OnTimer
OnExpire
OnManualActivation
```

Trigger 자체에 Damage 의미는 없다.

예:

```text
Projectile Collision
        ↓
OnCollision
        ↓
Spatial Query
        ↓
Damage
```

Timing(한 번 / 반복 / 지연)은 별도 축이 아니라 Trigger의 형태다.

```text
한 번          Execution 직후 1회
지연           OnTimer(t)
반복           OnTimer(interval) 반복
진입 시        OnEnter
소멸 시        OnExpire
```

## 8.6 Composition

복잡한 Skill은 기존 Execution을 연결해서 만든다.

```text
Execution
 ↓
Trigger
 ↓
Execution
 ↓
Trigger
 ↓
Effect
```

새 Skill 이름 때문에 새로운 시스템을 만들지 않는다.

Composition에는 종료 조건이 있어야 한다. 무한히 자기를 다시 부르는 Composition은 허용하지 않는다 — 반복 횟수, 남은 Lifetime, MaxCount 중 하나가 반드시 감소해야 한다.

---

# 9. 구성 예시

## 9.1 Fireball

```text
Activation
    Cast
Target Anchor
    Direction
Execution
    Create Spatial Presence
Spatial Presence
    Movement
Trigger
    OnCollision
Target Resolution
    Spatial
Origin
    Collision Position
Geometry
    Circle
Filter
    Enemy
Selection
    All
Effect
    Damage(Aura)
```

흐름:

```text
Caster
 ↓
Fireball Presence
 ↓
Movement
 ↓
Collision
 ↓
Circle Spatial Query
 ↓
Enemy[]
 ↓
Damage
```

별도의 `FireballSystem`은 존재하지 않는다.

## 9.2 단일 투사체 공격

화살이 처음 맞은 대상 한 명에게만 피해를 준다면:

```text
Target Anchor
    Direction
Execution
    Spatial Presence
Movement
    Forward
Trigger
    OnCollision
Resolution
    Collision Target
Effect
    Damage(Physical)
```

폭발이 없으므로 Spatial Query가 필요하지 않다.

## 9.3 횡베기

```text
Activation
    Normal
Target Anchor
    Direction
Execution
    Spatial Query
Origin
    Caster
Geometry
    Arc
Filter
    Enemy
Selection
    All
Effect
    Damage(Physical)
```

이 경우 범위 근접 공격도 `AoESkill`이라는 별도 타입 없이 표현된다.

기존 Swing Collider를 직접 이용하는 구현이라면 Contact 기반으로도 표현할 수 있으며, 어느 쪽이 World Semantic에 더 맞는지는 해당 Cycle이 결정한다.

## 9.4 대상 중심 광역기

```text
Target Anchor
    Unit
Target Resolution
    Spatial
Origin
    Target.Position
Geometry
    Circle
Filter
    Enemy
Selection
    All
Effect
    Damage
```

이 예시는 **Target Anchor와 Target Resolution을 분리해야 하는 가장 중요한 이유**다.

## 9.5 Ground AoE

```text
Target Anchor
    GroundPoint
Execution
    Spatial Query
Origin
    GroundPoint
Geometry
    Circle
Selection
    All Enemy
Effect
    Damage
```

## 9.6 Persistent Area (장판)

```text
Target Anchor
    GroundPoint
Execution
    Create Spatial Presence
Presence
    Anchor = Ground
    Lifetime = N
Trigger
    Periodic
Target Resolution
    Spatial
Origin
    Presence.Position
Geometry
    Circle
Filter
    Enemy
Selection
    All
Effect
    Damage
```

Damage 장판과 향후 Healing 장판은 공간 시스템을 공유한다. 마지막 World Capability만 다르다.

## 9.7 Attached Area / Moving Area

두 형태는 새로운 Primitive가 아니라 Presence의 상태 차이다.

```text
Attached Area
    Presence.Anchor = Caster
    → 기준이 Actor를 따라간다

Moving Area
    Presence.Movement = 있음
    → 기준이 스스로 이동한다

Ground Area
    Presence.Anchor = World Position
    Presence.Movement = 없음
```

## 9.8 Beam

별도 Beam Primitive가 반드시 필요한 것은 아니다.

```text
Activation
    Hold
Target Anchor
    Direction
Execution
    Repeated Spatial Query
Origin
    Caster
Geometry
    Line
Filter
    Enemy
Selection
    All / First
Effect
    Damage
```

이 구조만으로 필요한 Gameplay 의미가 모두 표현된다면 Beam System은 추가하지 않는다.

## 9.9 Chain

Chain 또한 별도 Damage 시스템이 아니다.

```text
Initial Anchor
    Unit
Resolution
    Single
Effect
    Damage
    ↓
다음 Target 선택
    ↓
Direct Effect
    ↓
MaxCount까지 반복
```

필요한 것은 별도의 `ChainDamage`가 아니라 **Target Propagation Policy**다.

```text
TargetPropagation
{
    MaxCount
    JumpRange
    Filter
    RepeatAllowed
}
```

이 정책은 Selection과 같은 자리에 있다 — 후보 중 다음 하나를 어떻게 고르는가의 규칙이며, 그 선택도 결정론적이어야 한다.

## 9.10 Trap

```text
Target Anchor
    GroundPoint
Execution
    Create Spatial Presence
Presence
    Anchor = Ground
    Lifetime = 길다
Trigger
    OnEnter (Filter = Enemy)
Execution
    Spatial Query
Effect
    Damage
```

Trap 자체는 피해를 계산하지 않는다. Trap은 **기다리는 Presence + Trigger**다.

## 9.11 Movement Attack

```text
Target Anchor
    Direction
Execution
    Actor Movement
    +
    Contact 또는 Spatial Query
Effect
    Damage
```

이동은 Skill의 전달 형태가 아니라 Actor의 이동 Capability다. 따라서 피해가 없는 순수 이동기도 같은 구조를 쓴다.

## 9.12 Summon

```text
Target Anchor
    GroundPoint
Execution
    Actor Spawn Capability
Effect
    (없음 — 세계에 Actor가 추가된 것 자체가 결과다)
```

소환된 Actor는 자기 Skill을 가진 보통의 Actor다. Summon 전용 전투 경로를 만들지 않는다.

---

# 10. Skill Definition 권장 구조

구현체의 정확한 타입명은 해당 Cycle이 결정한다. Domain 의미는 다음 구조를 유지한다.

```text
SkillDefinition
{
    Activation
    TargetAnchor
    Execution[]
    Effect[]
}
```

각 Execution은 자기 Parameter를 소유한다. SkillDefinition에 모든 Execution의 Optional Parameter를 평평하게 집어넣지 않는다.

```text
SpatialQuery
{
    origin
    geometry
    filter
    selection
}
```

```text
SpatialPresenceSpawn
{
    shape
    lifetime
    movement
    anchor
    trigger[]
}
```

```text
TargetPropagation
{
    maxCount
    jumpRange
    filter
    repeatAllowed
}
```

---

# 11. 관찰 계약

World의 관찰 결과만으로 어떤 Skill이 무엇을 했는지 설명할 수 있어야 한다.

## Skill 실행

```text
skillId
activation
targetAnchor
currentPhase
casterId
```

## Execution 단계

```text
executionKind          Contact / Direct / SpatialQuery / SpatialPresence
originPosition
geometry               (Spatial Query인 경우)
candidateCount         Filter 통과 전
filteredCount          Filter 통과 후
resolvedTargets[]      Selection 결과
```

## Effect 연결

```text
skillId
executionKind
sourceActor
targetActor
effect[]
```

Damage라면 기존 Strike Event / Damage Breakdown으로 연결한다.

`candidateCount`와 `filteredCount`를 분리해 관찰하는 이유는, "왜 저 적은 안 맞았는가"가 Geometry 문제인지 Filter 문제인지 Selection 문제인지 화면에서 구분할 수 있어야 하기 때문이다.

---

# 12. 금지 구조

```text
금지   Execution = Fireball / Meteor / Whirlwind
금지   Execution = Damage / Heal
금지   SkillType = SingleTarget / AoE
금지   ProjectileDamage · AreaDamage · MeleeDamage
금지   Geometry에 피해 계수를 넣는 것
금지   Anchor가 Resolution 결과를 직접 확정하는 것
금지   순서 규칙 없는 Max N Selection
금지   종료 조건 없는 Composition
```

---

# 13. 수용 기준

1. Self / Unit / Direction / GroundPoint 네 Anchor를 모두 표현할 수 있다.
2. 같은 Unit Anchor로 Single과 Spatial 두 Resolution을 모두 표현할 수 있다.
3. Spatial Query의 Origin이 Anchor와 다를 수 있다.
4. Geometry · Filter · Selection을 서로 독립적으로 바꿀 수 있다.
5. Contact 결과가 여러 Actor일 수 있다.
6. Trigger로 지연·반복·진입·소멸 시점을 모두 표현할 수 있으며 별도 Timing 축이 없다.
7. Composition으로 Fireball(Presence → Collision → Query → Damage)을 표현할 수 있다.
8. 같은 세계 상태에 같은 Query를 넣으면 항상 같은 Target 목록을 같은 순서로 돌려준다.
9. Skill 이름이 Execution 종류로 등장하지 않는다.
10. 관찰만으로 Anchor · Execution · Resolution · Resolved Target을 설명할 수 있다.
