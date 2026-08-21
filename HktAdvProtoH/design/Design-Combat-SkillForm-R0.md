# SYSTEM DESIGN DOCUMENT

## Skill Form — 스킬 발동·전달·판정 형태 시스템

| 항목        | 내용                                                                                      |
| --------- | --------------------------------------------------------------------------------------- |
| **상태**    | System Design Draft                                                                     |
| **기반**    | `C010 — Basic Attack / Defense Formula`, `Damage Type — Physical / Aura`                |
| **범위**    | Skill Activation / Targeting / Delivery / Geometry / Timing / Effect                    |
| **작성 목적** | 근접 공격, 투사체, 폭발, 힐, 장판, 광선, 돌진, 소환 등 MMORPG에서 사용하는 다양한 스킬 형태를 공통 규칙으로 표현할 수 있는 기반을 정의한다. |

> **핵심 명제**
>
> 스킬의 차이는 새로운 피해 공식을 만드는 것이 아니라,
> **효과가 어떤 방식으로 발동되고, 세계에 나타나며, 대상에게 전달되는가의 차이**로 표현한다.

---

# 0. 설계 배경

현재 전투 시스템에는 이미 피해량을 결정하는 공통 구조가 존재한다.

```text
Skill Base Damage
+ Actor Attack × Skill Attack Ratio
→ Defense 적용
→ Final Damage
```

또한 Damage Type 층에서는 피해 스킬이 `Physical | Aura` 중 하나를 가지고, 이에 따라 사용할 공격 능력과 방어 능력을 선택한다.

따라서 앞으로 파이어볼, 근접 공격, 장판, 레이저 등의 스킬을 추가할 때마다 새로운 피해 시스템을 만드는 것은 현재 전투 설계 원칙과 맞지 않는다.

기존 전투 설계의 원칙은 다음과 같다.

> 새로운 시스템은 새로운 피해 공식을 만들지 않는다.
> 기존 공식의 입력값이나 결과값에 한 가지 의미를 추가한다.

이번 시스템은 이를 스킬 전체 구조로 확장한다.

```text
검으로 벤다
파이어볼을 날린다
폭발시킨다
장판을 만든다
레이저를 발사한다
대상을 치료한다
소환수를 만든다
```

이것들은 각각 별도의 전투 시스템이 아니다.

모두 동일한 **Skill Form Primitive의 조합 결과**다.

---

# 1. 목표

이번 시스템의 목표는 다음 질문에 답하는 것이다.

> **스킬 효과는 세계에서 어떤 형태로 발생하여 누구에게 적용되는가?**

이를 위해 모든 Skill을 다음 여섯 축의 조합으로 정의한다.

```text
Skill
│
├─ Activation
│   어떻게 발동하는가
│
├─ Targeting
│   무엇을 기준으로 사용하는가
│
├─ Delivery
│   효과가 세계에서 어떻게 전달되는가
│
├─ Geometry
│   어느 공간을 판정하는가
│
├─ Timing
│   언제, 몇 번 판정하는가
│
└─ Effect
    대상에게 실제로 무엇을 하는가
```

이 여섯 축은 서로 독립적이어야 한다.

예를 들어 `Heal`을 특정 Skill Type으로 정의하지 않는다.

```text
단일 대상 힐
= DirectTarget + Heal

투사체 힐
= Projectile + Heal

광역 힐
= BurstArea + Heal

힐 장판
= PersistentArea + Periodic + Heal

연쇄 힐
= Chain + Heal
```

같은 Effect라도 전달 방식에 따라 전혀 다른 스킬을 만들 수 있어야 한다.

---

# 2. 전체 구조

스킬 실행은 다음 순서로 이해한다.

```text
Skill Input
    ↓
Activation
    ↓
Targeting
    ↓
Delivery 생성
    ↓
Geometry를 통해 대상 판정
    ↓
Timing 규칙에 따라 Hit 발생
    ↓
Effect 실행
```

Damage Effect라면 마지막 단계에서 기존 Damage 시스템을 호출한다.

```text
Hit
 ↓
Damage Effect
 ↓
Damage Type
 ↓
Physical / Aura
 ↓
Offense / Defense Stat 선택
 ↓
기존 Damage Formula
 ↓
Final Damage
```

따라서 스킬의 외형이나 공격 방식이 달라져도 피해 공식은 변하지 않는다.

---

# 3. Activation — 발동 방식

Activation은 플레이어가 Skill을 어떤 입력 방식으로 실행하는지를 정의한다.

## 3.1 Normal

입력 즉시 Skill 실행을 시작한다.

```text
Input
→ Execute
```

대표:

* 일반 공격
* 즉발 마법
* 대시
* 투사체 발사

---

## 3.2 Cast

일정 준비 시간이 끝난 뒤 실행한다.

```text
Input
→ Cast Time
→ Execute
```

대표:

* 강력한 주문
* 메테오
* 대형 회복 마법

Cast가 중단될 수 있는지는 별도 Interrupt 시스템이 필요한 시점에 확장한다.

---

## 3.3 Charge

입력을 유지한 시간에 따라 Skill Parameter가 변화한다.

```text
Input Hold
    ↓
Charge
    ↓
Release
    ↓
Execute
```

변경 가능한 값 예:

```text
Damage
Range
Radius
Projectile Speed
Knockback
```

Charge 자체가 Damage 공식을 바꾸지는 않는다.

Charge 결과가 Skill Parameter에 Modifier를 제공한다.

---

## 3.4 Hold / Channel

입력을 유지하는 동안 Skill이 계속 실행된다.

```text
Input Hold
→ Active
→ Active
→ Active
→ Release
```

대표:

* 회전 공격
* 레이저
* 지속 힐
* 생명 흡수

---

## 3.5 Combo

하나의 Skill 입력이 여러 실행 단계로 이어진다.

```text
Step 1
→ Step 2
→ Step 3
```

각 Step은 별도의 Delivery와 Effect를 가질 수 있다.

예:

```text
1타 → Contact
2타 → Contact
3타 → BurstArea
```

---

## 3.6 Toggle

Skill을 활성화한 뒤 다시 끌 때까지 유지한다.

```text
OFF
 ↓ Input
ON
 ↓ Input
OFF
```

대표:

* Aura
* 지속 자세
* 지속 Buff

---

# 4. Targeting — 대상 지정 방식

Targeting은 효과가 어디에서 시작하거나 어느 방향으로 향할지를 결정한다.

초기 Primitive는 다음 네 종류로 제한한다.

```text
Self
Unit
Direction
GroundPoint
```

## Self

시전자 자신을 기준으로 한다.

예:

```text
회전 공격
자기 중심 폭발
자기 회복
Aura
```

## Unit

하나의 Actor를 지정한다.

예:

```text
Heal
Curse
Homing Missile
Chain Lightning 시작 대상
```

## Direction

시전자 기준 방향을 사용한다.

예:

```text
검 공격
화살
파이어볼
레이저
충격파
```

## GroundPoint

세계의 특정 위치를 지정한다.

예:

```text
Meteor
장판
Trap
Summon
```

---

# 5. Delivery — 핵심 전달 형태

Delivery는 **Skill Effect가 세계에서 어떤 방식으로 대상에게 도달하는가**를 정의한다.

초기 공통 Primitive는 다음 14종으로 정의한다.

```text
Contact
DirectTarget
Projectile
Beam
MovingVolume
BurstArea
PersistentArea
AttachedArea
Trail
MovementAttack
Chain
Tether
Trap
Summon
```

---

# 6. Contact — 직접 접촉형

Caster 또는 무기의 Collider가 Target Body와 직접 접촉한다.

현재 전투의

```text
ACTION
→ SWING
→ COLLIDER
→ BODY
→ HIT REACTION
```

구조를 그대로 사용하는 가장 기본적인 형태다.

대표:

```text
Sword Slash
Thrust
Punch
Kick
Smash
Sweep
Spin Attack
```

Skill 종류를 Slash, Thrust 등으로 시스템에 추가하지 않는다.

차이는 Geometry로 표현한다.

```text
찌르기
Contact + Line

횡베기
Contact + Arc

회전베기
Contact + Circle
```

---

# 7. DirectTarget — 대상 직접형

World를 이동하는 별도 전달체 없이 지정된 Target에게 바로 Effect를 발생시킨다.

```text
Caster
 ↓
Target
 ↓
Effect
```

대표:

```text
Heal
Buff
Debuff
Curse
Instant Damage
Dispel
Resource Transfer
```

예:

```text
Basic Heal

Activation = Cast
Targeting = Unit
Delivery = DirectTarget
Effect = Heal
```

---

# 8. Projectile — 투사체형

세계에 이동 가능한 Projectile을 생성한다.

```text
Caster
 ↓
Projectile Spawn
 ↓
World Movement
 ↓
Collision
 ↓
Hit
```

기본 Parameter:

```text
Speed
Lifetime
Collision Radius
Trajectory
Hit Policy
```

Trajectory:

```text
Straight
Homing
Ballistic
Curved
Returning
Orbiting
```

Hit Policy:

```text
StopOnHit
Pierce
HitNTargets
Bounce
Return
```

예:

```text
Arrow
= Projectile
+ Straight
+ StopOnHit

Magic Spear
= Projectile
+ Straight
+ Pierce

Homing Missile
= Projectile
+ Homing
```

---

# 9. Beam — 광선형

Caster에서 특정 방향 또는 Target까지 직선 영역을 판정한다.

```text
Caster ================= Target
```

두 가지 형태를 지원한다.

## Instant Beam

```text
Input
→ Line 판정
→ Hit
```

## Continuous Beam

```text
Channel
→ Line 판정
→ Tick
→ Tick
→ Tick
```

대표:

```text
Laser
Breath
Lightning Beam
Healing Beam
```

---

# 10. MovingVolume — 이동 영역형

Projectile과 달리 작은 투사체가 아니라 **공격 영역 자체가 세계를 이동한다.**

대표:

```text
Shockwave
Wave
Flame Wall
Tornado
Sword Wave
```

예:

```text
Shockwave

Delivery = MovingVolume
Geometry = Box
Width = 8m
Speed = 12m/s

Effect
= Damage
+ Knockback
```

보스의 광역 패턴을 만들 때 중요한 Primitive다.

---

# 11. BurstArea — 순간 영역형

특정 위치에서 한 번 공간 판정을 실행한다.

```text
Create Area
 ↓
Overlap
 ↓
Hit
 ↓
Destroy
```

대표:

```text
Explosion
Meteor Impact
Lightning Strike
Ground Smash
Nova
```

발생 위치는 Targeting이 결정한다.

```text
Self + BurstArea
→ 자기 중심 폭발

GroundPoint + BurstArea
→ 지정 지역 폭발

Projectile Impact + BurstArea
→ 파이어볼 폭발
```

---

# 12. PersistentArea — 지속 영역형

세계의 특정 위치에 일정 시간 존재한다.

```text
Spawn Area
 ↓
Enter / Stay
 ↓
Tick
 ↓
Tick
 ↓
Duration End
```

대표:

```text
Fire Field
Poison Field
Healing Field
Slow Field
Silence Field
Buff Zone
```

기본 Event:

```text
OnEnter
OnTick
OnExit
```

기본 Parameter:

```text
Duration
TickInterval
Geometry
TargetFilter
```

---

# 13. AttachedArea — 부착 영역형

PersistentArea와 달리 특정 Actor 또는 Object의 위치를 따라다닌다.

```text
Actor 이동
 ↓
Area 이동
```

대표:

```text
Damage Aura
Healing Aura
Whirlwind
Flame Cloak
Rotating Blade
```

예:

```text
Whirlwind

Activation = Hold
Targeting = Self
Delivery = AttachedArea
Geometry = Circle
Timing = Periodic
Effect = Damage
```

---

# 14. Trail — 경로 생성형

움직이는 Actor 또는 Object가 지나간 경로를 따라 효과 영역을 만든다.

```text
Movement
→ Area
→ Area
→ Area
→ Area
```

대표:

```text
Fire Trail
Poison Trail
Ice Path
Lightning Path
```

Trail은 보통 PersistentArea와 조합한다.

```text
Trail
→ PersistentArea 반복 생성
```

---

# 15. MovementAttack — 이동 결합형

Caster 자신이 이동하면서 Skill을 수행한다.

대표:

```text
Dash
Charge
Leap
Dive
Blink Strike
Teleport Attack
```

Movement와 Effect를 분리한다.

```text
MovementAttack
    ↓
Movement 수행

동시에

Geometry 판정
    ↓
Effect 실행
```

따라서 Damage가 없는 이동기 역시 같은 기능을 사용할 수 있다.

---

# 16. Chain — 연쇄형

하나의 대상에서 다른 대상으로 Effect를 계속 전달한다.

```text
Target A
 ↓
Target B
 ↓
Target C
```

기본 Parameter:

```text
MaxJump
JumpRange
TargetFilter
RepeatTargetAllowed
```

대표:

```text
Chain Lightning
Chain Heal
Ricochet
Bouncing Blade
```

Damage 전용 시스템이 아니다.

```text
Chain + Damage
Chain + Heal
Chain + Buff
```

모두 가능해야 한다.

---

# 17. Tether — 연결형

두 Actor 사이에 일정 시간 관계를 유지한다.

```text
Caster ================= Target
```

대표:

```text
Life Drain
Healing Link
Mana Drain
Leash
Buff Link
```

Beam과의 차이는 명확하다.

```text
Beam
= 공간상의 Line 판정

Tether
= 두 Entity 사이 관계 유지
```

---

# 18. Trap — 설치·발동형

Skill 실행 시 World에 Trigger Object를 생성한다.

```text
Place
 ↓
Trap
 ↓
Wait
 ↓
Trigger
 ↓
다른 Delivery 실행
```

Trigger 예:

```text
EnemyEnter
Contact
Timer
ManualActivate
DamageReceived
```

Trap 자체가 Damage 계산을 하지 않는다.

예:

```text
Mine
= Trap
→ EnemyEnter
→ BurstArea
→ Damage
```

---

# 19. Summon — 소환형

새로운 Actor 또는 World Object를 생성한다.

대표:

```text
Pet
Turret
Totem
Spirit
Clone
Drone
Guardian
```

중요한 원칙:

> Summon 전용 공격 시스템을 만들지 않는다.

소환된 Actor도 기존 Skill Form을 그대로 사용한다.

```text
Turret
→ Projectile

Dragon
→ Beam

Totem
→ AttachedArea

Spirit
→ Contact
```

---

# 20. Geometry — 공간 판정 형태

Delivery와 실제 공간 모양을 분리한다.

기본 Geometry:

```text
Point
Circle / Sphere
Cone
Arc
Line
Capsule
Box
Ring
Path
```

예:

| Skill | Delivery       | Geometry     |
| ----- | -------------- | ------------ |
| 찌르기   | Contact        | Line         |
| 횡베기   | Contact        | Arc          |
| 회전베기  | Contact        | Circle       |
| 브레스   | Beam           | Cone 또는 Line |
| 장판    | PersistentArea | Circle       |
| 화염벽   | PersistentArea | Box          |
| 도넛 패턴 | BurstArea      | Ring         |

이를 통해 MMORPG 보스의 다양한 패턴을 새로운 시스템 없이 표현할 수 있다.

---

# 21. Timing — 판정 시간 형태

Timing은 Hit이 언제 몇 번 발생하는지를 정의한다.

```text
Single
MultiHit
Delayed
Periodic
Continuous
```

## Single

한 번 판정한다.

```text
Sword Slash
Fireball Impact
```

## MultiHit

하나의 실행에서 여러 번 판정한다.

```text
Triple Slash
Rapid Shot
```

## Delayed

일정 시간이 지난 뒤 판정한다.

```text
Meteor
Delayed Explosion
```

## Periodic

고정 Interval마다 판정한다.

```text
Poison Field
Healing Field
Aura
```

## Continuous

가능한 연속적인 상태로 유지한다.

주로 Beam, Channel 등에 사용한다.

---

# 22. Effect — 실제 결과

Effect는 대상의 World State를 실제로 변화시킨다.

초기 Effect Primitive:

```text
Damage
Heal
Shield
Buff
Debuff
Stun
Root
Slow
Silence
Knockback
Pull
Launch
ResourceGain
ResourceDrain
Dispel
Cleanse
Spawn
```

하나의 Skill Hit이 여러 Effect를 가질 수 있다.

예:

```text
Shield Bash

Damage
+
Knockback
```

```text
Ice Explosion

Damage
+
Slow
```

```text
Life Drain

Target Damage
+
Caster Heal
```

Damage Effect가 실행될 경우 기존 Damage Type 및 피해 공식을 그대로 사용한다.

Damage Type은 타격마다 Physical 또는 Aura 중 하나의 타입을 가지고 대응 공격·방어 능력치를 선택한다.

---

# 23. Delivery는 조합 가능해야 한다

하나의 Skill이 반드시 하나의 Delivery에서 끝날 필요는 없다.

Delivery는 다음 Delivery를 생성할 수 있다.

```text
Projectile
→ BurstArea

Trap
→ BurstArea

MovementAttack
→ Trail
→ PersistentArea

Projectile
→ Summon

Projectile
→ Chain
```

이것이 복잡한 MMORPG Skill을 만드는 핵심이다.

---

# 24. 대표 Skill 구성 예시

## Sword Slash

```text
Activation = Normal
Targeting = Direction
Delivery = Contact
Geometry = Arc
Timing = Single

Effect
    Damage(Physical)
```

---

## Fireball

```text
Activation = Cast
Targeting = Direction

Delivery
    Projectile
        OnHit
            → BurstArea

Geometry
    Projectile = Sphere
    Explosion = Circle

Timing = Single

Effect
    Damage(Aura)
```

파이어볼이라는 별도 시스템은 존재하지 않는다.

```text
Projectile
+
BurstArea
+
Damage
```

의 조합이다.

---

## Meteor

```text
Activation = Cast
Targeting = GroundPoint
Delivery = BurstArea
Geometry = Circle
Timing = Delayed

Effect
    Damage(Aura)
```

---

## Poison Field

```text
Activation = Cast
Targeting = GroundPoint
Delivery = PersistentArea
Geometry = Circle
Timing = Periodic

Effect
    Damage
```

---

## Whirlwind

```text
Activation = Hold
Targeting = Self
Delivery = AttachedArea
Geometry = Circle
Timing = Periodic

Effect
    Damage(Physical)
```

---

## Heal

```text
Activation = Cast
Targeting = Unit
Delivery = DirectTarget
Timing = Single

Effect
    Heal
```

---

## Healing Sanctuary

```text
Activation = Cast
Targeting = GroundPoint
Delivery = PersistentArea
Geometry = Circle
Timing = Periodic

Effect
    Heal
```

---

## Chain Lightning

```text
Activation = Cast
Targeting = Unit
Delivery = Chain
Timing = MultiHit

MaxJump = 5
JumpRange = 8m

Effect
    Damage(Aura)
```

---

## Life Drain

```text
Activation = Hold
Targeting = Unit
Delivery = Tether
Timing = Periodic

Effect
    Target Damage(Aura)
    Caster Heal
```

---

## Explosive Arrow

```text
Activation = Normal
Targeting = Direction

Projectile
    ↓
Impact
    ↓
BurstArea

Effect
    Damage(Physical)
```

---

## Flame Dash

```text
Activation = Normal
Targeting = Direction

Delivery
    MovementAttack
    +
    Trail

Trail
    → PersistentArea

Effect
    Contact Damage
    Area Damage
```

---

## Mine

```text
Activation = Normal
Targeting = GroundPoint

Trap
    ↓
EnemyEnter
    ↓
BurstArea
    ↓
Damage
```

---

## Turret

```text
Activation = Normal
Targeting = GroundPoint

Summon
    ↓
Turret Actor 생성

Turret Skill
    Projectile
    ↓
    Damage
```

---

# 25. Skill Definition 권장 구조

구현체의 정확한 타입명은 해당 Cycle에서 결정할 수 있으나 Domain 의미는 다음 구조를 유지한다.

```text
SkillDefinition
{
    Activation
    Targeting
    Delivery[]
    Geometry
    Timing
    Effect[]
}
```

필요한 Parameter는 각 Form이 소유한다.

예:

```text
Projectile
{
    speed
    lifetime
    trajectory
    hitPolicy
}
```

```text
PersistentArea
{
    duration
    tickInterval
}
```

```text
Chain
{
    maxJump
    jumpRange
}
```

SkillDefinition에 모든 Form의 Optional Parameter를 평평하게 집어넣지 않는다.

---

# 26. World Runtime의 책임

World는 다음 사실의 Source of Truth다.

```text
현재 어떤 Skill이 실행 중인가
어떤 Delivery Object가 존재하는가
각 Delivery의 위치와 상태
어떤 Geometry에 어떤 Actor가 포함되었는가
언제 Hit가 발생했는가
어떤 Effect가 실행되었는가
```

View는 이 결과를 자체적으로 추론해서는 안 된다.

예를 들어 Projectile을 화면에 그렸다고 해서 View가 충돌 여부를 결정하지 않는다.

```text
World
    Projectile Collision 결정
        ↓
    Hit 발생
        ↓
    ViewModel 제공

View
    결과를 표현
```

---

# 27. 관찰 계약

이번 시스템 역시 다른 Cycle과 동일하게 직관적으로 검증 가능해야 한다.

Skill 실행 상태에서 최소 다음 정보를 관찰할 수 있어야 한다.

## Skill

```text
skillId
activation
targeting
currentPhase
```

## Delivery Instance

```text
deliveryType
sourceActor
position
direction
remainingLifetime
```

필요한 경우:

```text
projectileSpeed
areaRadius
tickInterval
chainIndex
targetId
```

## Hit Event

```text
skillId
deliveryType
sourceActor
targetActor
hitPosition
effect[]
```

Damage라면 기존 Strike Event / Damage Breakdown으로 연결한다.

현재 Damage Type 설계 역시 실제 타격에서 선택된 공격·방어 능력치와 계산 경위를 관찰 가능하게 제공하도록 요구한다.

---

# 28. 중요한 설계 제약

## 28.1 Skill 이름을 시스템 타입으로 만들지 않는다

금지 예:

```text
SkillType.Fireball
SkillType.Meteor
SkillType.Whirlwind
SkillType.Heal
SkillType.PoisonField
```

이것들은 Content다.

System에는 Primitive만 존재한다.

---

## 28.2 Damage와 Delivery를 결합하지 않는다

잘못된 구조:

```text
ProjectileDamage
AreaDamage
MeleeDamage
```

올바른 구조:

```text
Projectile
    ↓
Damage

Area
    ↓
Damage

Contact
    ↓
Damage
```

---

## 28.3 Heal 역시 Delivery가 아니다

금지:

```text
Delivery = Heal
```

허용:

```text
DirectTarget + Heal
BurstArea + Heal
PersistentArea + Heal
Chain + Heal
```

---

## 28.4 새로운 Delivery 때문에 새로운 피해 공식을 만들지 않는다

다음은 모두 동일 Damage Effect를 사용한다.

```text
Sword
Fireball
Meteor
Beam
Trap
Summon Attack
```

현재 전투 공식은 공격자의 공격 능력, Skill Base Damage와 Ratio, 대상의 방어 능력으로 최종 피해를 계산한다.

---

## 28.5 시스템보다 조합을 우선한다

새로운 Skill 요구가 들어오면 Agent는 먼저 질문한다.

> 기존 Primitive의 조합으로 만들 수 있는가?

가능하다면 새로운 시스템을 추가하지 않는다.

---

# 29. 새 Primitive 추가 기준

다음 조건을 모두 만족할 때에만 Delivery Primitive를 추가한다.

1. 기존 Primitive 조합으로 의미를 표현할 수 없다.
2. 단순 Parameter 추가만으로 해결할 수 없다.
3. World에서 실제로 다른 생명주기 또는 판정 규칙이 필요하다.
4. 두 개 이상의 Skill에서 재사용 가능하다.
5. 관찰 가능한 Gameplay 차이를 만든다.

예를 들어:

```text
Fireball
```

은 새 Primitive가 아니다.

```text
Projectile + BurstArea
```

로 표현 가능하기 때문이다.

---

# 30. 구현 우선순위

처음부터 모든 Primitive를 한 Cycle에서 구현하지 않는다.

현재 프로젝트의 점진 확장 원칙에 따라 필요한 Skill을 만들 때 한 층씩 추가한다.

권장 순서:

```text
1. Contact
2. DirectTarget
3. Projectile
4. BurstArea
5. PersistentArea
6. Beam
7. MovementAttack
8. AttachedArea
9. Chain
10. Trap
11. Summon
12. Tether / Trail / MovingVolume
```

Cycle의 실제 목표가 특정 Primitive를 먼저 요구한다면 순서를 변경할 수 있다.

중요한 것은 **필요한 만큼만 구현하고 이미 검증한 Primitive를 재사용하는 것**이다.

이는 기존 전투 시스템이 가장 단순한 공격/방어 공식부터 시작해 한 층씩 확장하도록 설계된 방향과 동일하다.

---

# 31. 이번 설계에서 하지 않을 것

이번 문서는 스킬 형태의 공통 문법만 정의한다.

다음은 별도 시스템에서 다룬다.

```text
Skill Balance 수치
Critical
Accuracy / Dodge
Guard / Parry
Guard Break
Armor Penetration
Resistance Penetration
Element
Fire / Ice / Lightning 상성
Aura / Nen Allocation
Condition
Restriction
Vow
Crowd Control Resistance
Casting Interrupt
Cooldown System
Global Cooldown
Threat / Aggro 상세 규칙
Summon AI
Projectile Network Prediction
Animation 구현
VFX 구현
Sound 구현
```

필요해지는 Cycle에서 별도 층으로 확장한다.

---

# 32. 수용 기준

Skill Form 시스템은 다음 조건을 만족해야 한다.

1. 근접 공격을 `Contact + Geometry + Damage`로 표현할 수 있다.
2. 단일 힐을 `DirectTarget + Heal`로 표현할 수 있다.
3. 파이어볼을 `Projectile → BurstArea → Damage`로 표현할 수 있다.
4. 장판 공격을 `PersistentArea + Periodic + Damage`로 표현할 수 있다.
5. 힐 장판을 같은 PersistentArea 시스템과 Heal Effect로 표현할 수 있다.
6. 광선을 Beam으로 표현할 수 있다.
7. 돌진 공격을 MovementAttack으로 표현할 수 있다.
8. Chain Damage와 Chain Heal이 같은 Chain 시스템을 사용한다.
9. Trap이 다른 Delivery를 Trigger할 수 있다.
10. Summon Actor가 기존 Skill Form을 다시 사용할 수 있다.
11. Delivery 종류가 달라져도 Damage Effect는 기존 Damage Formula를 사용한다.
12. Skill 이름 때문에 새로운 시스템 enum을 만들 필요가 없다.
13. World의 관찰 결과만으로 Skill이 어떤 Activation, Delivery, Geometry, Timing, Effect를 사용했는지 설명할 수 있다.
14. View가 충돌·Hit·Effect 결과를 자체적으로 결정하지 않는다.
15. 새로운 Skill 요구 대부분을 기존 Primitive의 조합으로 표현할 수 있다.

---

# 33. 최종 구조

```text
                     [ Skill Content ]
       Fireball · Heal · Meteor · Whirlwind
                         ↓
                  [ Skill Definition ]
                         ↓
 ┌─────────────────────────────────────────────┐
 │ Activation                                 │
 │ Normal · Cast · Charge · Hold · Combo      │
 ├─────────────────────────────────────────────┤
 │ Targeting                                  │
 │ Self · Unit · Direction · GroundPoint      │
 ├─────────────────────────────────────────────┤
 │ Delivery                                   │
 │ Contact · DirectTarget · Projectile        │
 │ Beam · MovingVolume · BurstArea            │
 │ PersistentArea · AttachedArea · Trail      │
 │ MovementAttack · Chain · Tether            │
 │ Trap · Summon                              │
 ├─────────────────────────────────────────────┤
 │ Geometry                                   │
 │ Point · Circle · Cone · Arc · Line         │
 │ Capsule · Box · Ring · Path                │
 ├─────────────────────────────────────────────┤
 │ Timing                                     │
 │ Single · MultiHit · Delayed                │
 │ Periodic · Continuous                      │
 ├─────────────────────────────────────────────┤
 │ Effect                                     │
 │ Damage · Heal · Shield · Buff · Debuff     │
 │ CC · Movement · Resource · Spawn           │
 └─────────────────────────────────────────────┘
                         ↓
                      [ Hit ]
                         ↓
                  [ Effect System ]
                         ↓
                  Damage인 경우
                         ↓
                 [ Damage Type ]
              Physical / Aura
                         ↓
               [ Damage Formula ]
                         ↓
                World State 변경
```

---

# 34. Agent 작업 원칙

이 문서를 기반으로 구현하거나 다음 Cycle을 설계하는 Agent는 다음 규칙을 따른다.

### 1. Skill 요구를 먼저 분해한다

새 Skill 이름을 보고 바로 코드를 만들지 않는다.

예:

```text
"폭발하는 파이어볼"
```

을 받았다면 먼저:

```text
Activation = Cast
Targeting = Direction
Delivery = Projectile → BurstArea
Timing = Single
Effect = Damage(Aura)
```

로 변환한다.

---

### 2. 기존 Primitive를 검색한다

필요한 기능이 이미 있다면 반드시 재사용한다.

```text
새 Skill
→ 기존 Primitive 조합 가능
→ Content Definition만 추가
```

를 기본 경로로 한다.

---

### 3. 새로운 Primitive는 마지막 수단이다

새 Primitive가 필요하다고 판단하면 구현 전에 다음을 명시한다.

```text
기존 Primitive로 표현할 수 없는 이유
새로운 World 의미
새로운 Runtime 생명주기
새로운 관찰 상태
재사용 가능한 Skill 예시
```

---

### 4. World와 View를 분리한다

World는 Skill의 의미와 판정을 소유한다.

View는 전달받은 상태를 표현한다.

---

### 5. Damage 공식은 건드리지 않는다

Skill Form 구현 때문에 기존 공격/방어 공식이나 Damage Type 규칙을 수정하지 않는다.

정말 변경이 필요하다면 Skill Form 변경이 아니라 별도의 Combat System Layer 문제로 판단한다.

---

# 핵심 원칙

> **Skill은 이름으로 구현하지 않는다.**
> **Skill은 Activation + Targeting + Delivery + Geometry + Timing + Effect의 조합으로 정의한다.**
> **Projectile, Area, Beam, Contact는 피해 종류가 아니라 효과가 세계에 전달되는 방식이다.**
> **Damage, Heal, Buff는 전달 방식이 아니라 대상에게 발생하는 Effect다.**
> **복잡한 Skill은 새로운 시스템을 만드는 것이 아니라 Primitive를 연결하여 만든다.**
> **어떤 공격 형태가 추가되어도 기존 Damage Formula는 유지한다.**

이 구조를 기준으로 이후 Skill Cycle에서는 새로운 스킬을 하나씩 추가하면서 필요한 Primitive만 점진적으로 구현한다.
