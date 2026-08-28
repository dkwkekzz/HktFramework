# SYSTEM DESIGN DOCUMENT

## Design World Spatial Presence — Actor가 아닌 존재의 공간 존재

| 항목        | 내용                                                                                       |
| --------- | ------------------------------------------------------------------------------------------ |
| **상태**    | Final Design Draft                                                                         |
| **상위 문서** | [`Skill-System.md`](Skill-System.md)                                                       |
| **범위**    | Identity / Transform / Shape / Lifetime / Movement / Anchor / Observation 경계               |
| **작성 목적** | Projectile · Area · Trap 을 각각의 시스템으로 만들지 않기 위해, **Actor가 아닌 존재가 세계 공간에 자리를 가지는 방법**을 먼저 정의한다. |

> **핵심 명제**
>
> Fireball, 장판, 함정은 서로 다른 시스템이 아니다.
> **셋 모두 "세계에 자리를 가진 Actor 아닌 존재"이며, 차이는 Movement · Anchor · Lifetime · Trigger의 값 차이일 뿐이다.**

---

# 0. 이 문서의 책임

```text
소유한다
    Actor가 아닌 존재가 세계에 존재한다는 사실
    그 존재의 Transform · Shape · Lifetime
    Movement · Anchor
    생명주기와 소멸 사유
    World Truth 와 Observation 의 경계

소유하지 않는다
    누가 그것을 사용하는가 · 어떤 Trigger를 걸었는가   → Skill-Execution-Form.md
    닿은 대상에게 무엇이 일어나는가                     → Skill-Effect.md
    화면에서 어떤 VFX로 보이는가                        → View / GameView Specification
    누가 그것을 볼 수 있는가                            → Observation Rule
```

---

# 1. 왜 먼저 필요한가

Projectile, Persistent Area, Trap 등을 만들기 전에 세계가 먼저 다음 Capability를 가져야 한다.

> **Actor가 아닌 존재도 세계 공간에 자리를 가질 수 있다.**

이를 Spatial Presence라 한다.

이 Capability가 없으면 각 Skill 구현이 자기만의 임시 개념을 만들게 된다.

```text
Fireball 이 자기만의 "날아가는 것" 을 만든다
장판이   자기만의 "남아 있는 것" 을 만든다
함정이   자기만의 "기다리는 것" 을 만든다
    ↓
같은 의미가 세 벌 생기고, 셋 다 관찰 방식이 다르다
```

Skill 내부에 임시 개념을 만드는 대신, 먼저 World Spatial Presence를 확장한다.

---

# 2. 정의

```text
SpatialPresence
{
    Identity
    Transform
    Shape
    Source / Owner
    Lifetime

    optional:
        Movement
        Anchor
}
```

정확한 구현 타입은 해당 Cycle이 결정한다.

| 필드              | 의미                                                    |
| --------------- | ------------------------------------------------------ |
| `Identity`      | 세계가 이 존재를 계속 같은 것으로 지목할 수 있는 식별자                       |
| `Transform`     | 현재 위치와 방향                                              |
| `Shape`         | 공간을 차지하는 형태 (Spatial Query의 Geometry와 같은 어휘를 쓴다)        |
| `Source / Owner` | 이 존재를 만든 주체 — Effect의 공격자 판정과 Filter(Enemy/Ally)의 근거   |
| `Lifetime`      | 얼마나 존재하는가 · 무엇이 그것을 끝내는가                               |
| `Movement`      | (선택) 스스로 이동하는 규칙                                       |
| `Anchor`        | (선택) 다른 존재의 위치를 따르는 관계                                 |

Spatial Presence는 다음을 소유하지 않는다.

```text
피해량
공격 능력치
쿨다운
스킬 이름
```

`Source`는 소유하지만 그 Source의 능력치를 복사해 들고 있지 않는다. Effect 시점에 Source Actor를 참조한다.

---

# 3. 전투 전용이 아니다

동일한 World Capability는 다음에도 사용할 수 있어야 한다.

```text
Projectile
Area
Trap
Magic Circle
Dropped Item
Torch
Door
Corpse
Placed Object
```

따라서 처음부터:

```text
ProjectileEntity
AreaEntity
TrapEntity
```

를 각각 독립적인 세계 기반 타입으로 만들지 않는다.

만약 어떤 존재가 스스로 판단하고 행동한다면 그것은 Spatial Presence가 아니라 **Actor**다.

```text
Spatial Presence     세계에 자리를 가지지만 스스로 결정하지 않는다
Actor                스스로 행동을 결정한다
```

소환수는 Actor이며 Spatial Presence가 아니다. 이것이 Summon을 전달 형태로 두지 않는 이유다.

---

# 4. 생명주기

기본 생명주기:

```text
Create
 ↓
Exist
 ↓
State Change
 ↓
Remove
```

예:

### Fireball

```text
Create
 ↓
Move
 ↓
Collision
 ↓
Remove
```

### Area

```text
Create
 ↓
Remain
 ↓
Expire
 ↓
Remove
```

### Trap

```text
Create
 ↓
Wait
 ↓
Enter
 ↓
Activate
 ↓
Remove
```

세 예시 모두 같은 생명주기이며, 다른 것은 **무엇이 State Change를 일으키는가**뿐이다.

---

# 5. Movement

Presence가 스스로 이동하는 규칙이다. 없으면 제자리에 있다.

```text
Movement
{
    kind        Straight / Homing / Ballistic / None
    speed
    direction 또는 targetRef
}
```

Movement는 이동만 정의한다. 무엇에 부딪히는지, 부딪히면 무슨 일이 생기는지는 Trigger와 Effect가 정한다.

```text
허용   Movement.kind = Homing, targetRef = 어떤 Actor
금지   Movement 가 "맞으면 5 피해" 를 소유하는 것
```

Homing은 대상 참조를 요구한다. 참조 대상이 사라졌을 때의 행동(직진 계속 / 즉시 소멸)은 Presence 정의가 명시해야 한다.

---

# 6. Anchor

Presence가 다른 존재의 위치를 따르는 관계다.

```text
Anchor
{
    kind        World / Actor
    ref         (Actor인 경우)
    offset
}
```

이 하나의 필드가 세 형태를 가른다.

```text
Anchor = World,  Movement = 없음    → 지면 장판
Anchor = World,  Movement = 있음    → 이동하는 충격파
Anchor = Actor,  Movement = 없음    → 캐릭터를 따라다니는 Aura
```

별도의 `AttachedArea` · `MovingVolume` Primitive를 만들지 않는 이유가 이것이다.

Anchor 대상이 세계에서 사라지면 Presence도 소멸한다 — 이것은 기본 규칙이며, 남아야 한다면 그 Presence가 소멸 시점에 `Anchor = World`인 새 Presence를 만드는 것으로 표현한다.

---

# 7. Shape

Presence가 공간을 차지하는 형태다.

```text
Point
Line
Circle / Sphere
Box
Cone
Arc
Ring
```

Shape는 Spatial Query의 Geometry와 같은 어휘를 쓴다. 같은 의미에 두 어휘를 두지 않는다.

Shape는 두 가지에 쓰인다.

```text
1. Trigger 판정        무엇이 이 존재에 닿았는가 · 들어왔는가
2. Query Origin 제공   이 존재를 기준으로 다시 공간을 조회할 때
```

Shape가 곧 Effect 범위인 것은 아니다. 반경 1m의 Fireball Presence가 충돌 후 반경 5m의 Circle Query를 실행할 수 있다.

---

# 8. Lifetime과 소멸

Presence는 반드시 끝난다. 끝나는 사유는 관찰 가능해야 한다.

```text
Expire          Lifetime 소진
Collision       무언가에 닿음
Triggered       발동 후 소모
AnchorLost      기준 존재가 사라짐
Removed         세계 규칙에 의한 제거
```

무한히 존재하는 Presence를 기본값으로 두지 않는다. 영구 설치물이 필요하다면 그것은 Lifetime이 없는 것이 아니라 **Lifetime의 종료 조건이 시간이 아닌 것**이다.

---

# 9. Trigger와의 관계

Presence는 세계 사건을 **발생시키기만** 한다. 그 사건이 무엇을 실행하는지는 Skill이 정한다.

```text
Presence 가 만드는 사건
    OnCollision
    OnEnter
    OnExit
    OnTimer
    OnExpire
    OnManualActivation

Skill 이 그 사건에 붙이는 것
    다음 Execution
```

따라서 같은 Presence 정의가 서로 다른 Skill에서 다른 결과를 낸다.

```text
동일 Presence (Circle · Ground · Lifetime 10s · OnTimer 1s)
    ↓ Skill A          Damage Query
    ↓ Skill B          (Heal Capability 구현 이후) Heal Query
```

---

# 10. Observation 경계

세계에 존재한다는 것과 모든 Observer에게 보인다는 것은 다른 사실이다.

따라서:

```text
World Truth
      ↓
Observation Rule
      ↓
Observer-specific Projection
      ↓
Observable World
      ↓
GameView
```

구조를 유지한다.

Spatial Presence는:

```text
무엇이 존재하는가
어디에 존재하는가
어떤 상태인가
```

만 소유한다.

다음은 소유하지 않는다.

```text
누가 그것을 관찰할 수 있는가
화면에서 어떤 VFX로 표현하는가
```

이 경계는 실제 Gameplay 의미를 가진다.

```text
숨겨진 함정
    World Truth        존재한다 · 위치가 있다 · Trigger가 살아 있다
    Observation        설치자에게만 보인다
    ↓
    보이지 않는 관찰자도 실제로 그것을 밟는다
```

View가 그리지 않았다는 이유로 판정이 사라지지 않고, View가 그렸다는 이유로 판정이 생기지 않는다.

---

# 11. 결정론

Presence는 전투 판정의 일부다. 따라서 같은 세계 상태에서 같은 Presence는 같은 결과를 낳아야 한다.

```text
Movement 는 고정 시뮬레이션 시간 단위로 진행한다
Trigger 판정 순서는 규칙으로 정해져 있다
같은 Tick 에 여러 Presence 가 소멸하면 그 순서도 규칙으로 정해져 있다
```

프레임 레이트, 렌더 보간, 클라이언트 시점이 판정에 영향을 주지 않는다.

---

# 12. 관찰 계약

Presence 하나에 대해 최소 다음을 관찰할 수 있어야 한다.

```text
presenceId
kind 또는 sourceSkillId
sourceActor
position
direction
shape
remainingLifetime
anchorRef          (있는 경우)
movementKind       (있는 경우)
```

소멸 시:

```text
presenceId
removeReason       Expire / Collision / Triggered / AnchorLost / Removed
position
```

이 관찰만으로 "왜 저 파이어볼이 저기서 사라졌는가"를 화면 밖에서 설명할 수 있어야 한다.

---

# 13. 금지 구조

```text
금지   ProjectileEntity · AreaEntity · TrapEntity 를 각각 독립 세계 타입으로 만드는 것
금지   Presence 가 피해량 · 능력치 · 공식을 소유하는 것
금지   Presence 가 관찰 가능성(누가 보는가)을 소유하는 것
금지   Presence 를 VFX 수명에 맞춰 만드는 것 (VFX 는 결과의 표현이다)
금지   종료 조건 없는 Presence
금지   Skill 내부에만 존재하는 임시 공간 존재 개념
```

---

# 14. 수용 기준

1. Fireball · 장판 · 함정을 같은 Presence 구조로 표현할 수 있다.
2. Attached Area와 Moving Area가 Anchor · Movement 값 차이로만 갈린다.
3. Presence가 전투 외 용도(설치물 · 떨어진 아이템 등)에도 쓰일 수 있는 형태다.
4. 모든 Presence가 관찰 가능한 소멸 사유를 가진다.
5. Anchor 대상이 사라졌을 때의 규칙이 정의되어 있다.
6. World Truth와 Observer별 Observable State가 분리되어 있다.
7. 같은 세계 상태에서 같은 Presence가 같은 결과를 낸다.
8. Presence 관찰만으로 그것이 언제 왜 사라졌는지 설명할 수 있다.
9. Presence가 어떤 Effect도 직접 소유하지 않는다.
10. 소환수는 Presence가 아니라 Actor로 처리된다.
