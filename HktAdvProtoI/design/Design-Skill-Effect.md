# SYSTEM DESIGN DOCUMENT

## Design Skill Effect — 실행 결과의 World State Transition

| 항목        | 내용                                                                                      |
| --------- | ----------------------------------------------------------------------------------------- |
| **상태**    | Final Design Draft                                                                        |
| **상위 문서** | [`Skill-System.md`](Skill-System.md)                                                      |
| **기반**    | `C010 — Basic Attack / Defense Formula`, `Damage Type — Physical / Aura`                  |
| **범위**    | Resolved Target → 기존 World Capability 연결 / 새 Effect 도입 절차                                |
| **작성 목적** | Skill이 대상에게 무엇을 하는지를, **현재 세계에 실제로 구현된 State Transition Capability만으로** 정의한다.           |

> **핵심 명제**
>
> Effect는 Skill이 새로 만드는 능력이 아니다.
> **Effect는 이미 세계가 할 수 있는 일을, Skill이 결정한 대상에게 부르는 호출이다.**

---

# 0. 이 문서의 책임

```text
소유한다
    Effect 의 정의
    현재 사용 가능한 Effect 목록 (지금은 Damage 하나)
    Damage 로의 연결 방식
    새 Effect Capability 도입 절차
    미구현 Effect 를 선점하지 않는 규칙

소유하지 않는다
    피해 공식 자체                → Design-Combat-OffenseDefense-R0 (C010)
    Physical / Aura 의 의미        → Design-Combat-DamageType-R0
    누가 대상이 되는가             → Skill-Execution-Form.md
    무엇이 세계에 존재하는가        → World-Spatial-Presence.md
```

---

# 1. Effect의 정의

Effect는 다음과 같이 정의한다.

> **Skill Execution 결과 호출되는 기존 World State Transition Capability**

따라서 다음처럼 미래 기능을 모두 미리 enum으로 선언하지 않는다.

```text
Damage
Heal
Shield
Stun
Slow
Root
Buff
...
```

현재 세계에 실제로 존재하는 Capability만 Skill에서 사용할 수 있다.

Skill System이 다른 시스템의 의미를 미리 정의하지 않는다. `Heal`이라는 이름을 Effect 목록에 적어 두는 것만으로도, 그것은 "회복이란 무엇인가"를 Skill이 먼저 선점한 것이 된다.

---

# 2. 현재 Effect — Damage

현재 명확하게 존재하는 Effect는 Damage다.

```text
Resolved Target
      ↓
Damage
      ↓
Damage Type
      ↓
Physical / Aura
      ↓
Offense / Defense 선택
      ↓
기존 Damage Formula
      ↓
HP 감소
```

같은 상태와 같은 타격은 동일한 피해를 발생시키는 기존 결정론적 규칙을 그대로 사용한다.

## 2.1 Skill이 제공하는 입력

Skill은 피해 공식을 소유하지 않는다. Skill이 공식에 넣는 것은 다음뿐이다.

```text
Skill Base Damage
Skill Attack Ratio
Damage Type          Physical / Aura
Source Actor         공격 능력치의 출처
Target Actor         방어 능력치의 출처
```

## 2.2 공식은 변하지 않는다

어떤 Execution을 거쳐 왔는지는 피해에 영향을 주지 않는다.

```text
Contact              → Damage
Spatial Query        → Damage
Presence Collision   → Damage
Periodic Query       → Damage
```

네 경로 모두 같은 공식을 지난다. 다음은 존재하지 않는다.

```text
금지   ProjectileDamage
금지   AreaDamage
금지   BeamDamage
금지   MeleeDamage
```

## 2.3 여러 대상에 적용될 때

Spatial Resolution의 결과가 여러 Actor라면, 각 대상마다 공식을 **독립적으로** 계산한다.

```text
Resolved Target[]
    ↓
for each Target
    ↓
Damage(Source, Target, BaseDamage, Ratio, Type)
```

대상 수는 피해 계수가 아니다.

```text
금지   대상이 많으면 1인당 피해를 자동 감소시키는 숨은 규칙
허용   Selection = Max N 으로 대상 수 자체를 제한하는 것
허용   Skill Parameter 가 명시적으로 그런 규칙을 선언하는 것
```

숨은 보정은 관찰 계약을 깨뜨린다 — 화면에서 왜 그만큼 아팠는지 설명할 수 없게 된다.

## 2.4 한 실행이 같은 대상을 여러 번 맞히지 않는다

하나의 Execution이 만든 하나의 Resolution 결과에서, 같은 Actor는 한 번만 Effect를 받는다.

반복 피해가 필요하다면 그것은 여러 번의 Trigger이며, 각 Trigger마다 새로운 Resolution이 일어난다.

```text
Periodic Trigger
    ↓ Tick 1   Query → Target[] → Damage
    ↓ Tick 2   Query → Target[] → Damage
```

Tick 사이에 대상이 범위를 벗어났다면 그 Tick에는 맞지 않는다. 이것이 장판이 "들어와 있는 동안 아픈" 이유이며, 별도 규칙이 아니라 Resolution이 매번 다시 일어난 결과다.

---

# 3. 하나의 Execution에 여러 Effect

하나의 Execution이 둘 이상의 Effect를 부를 수 있다.

```text
Execution
    ↓
Resolved Target[]
    ↓
Effect[]
```

단, **각 Effect는 그 시점에 세계에 구현되어 있어야 한다.** 지금 세계에 Damage 하나만 있다면, 현재 표현할 수 있는 조합도 Damage 하나뿐이다.

```text
지금 가능       Damage
Knockback 구현 이후   Damage + Knockback
Heal 구현 이후        Damage(Target) + Heal(Caster)
```

Effect 목록에 아직 없는 것을 적어 두고 "구현되면 켜진다"고 두지 않는다. 그것은 정의를 선점하는 것이다.

---

# 4. Effect는 전달 방식이 아니다

Effect와 Execution을 같은 자리에 두지 않는다.

```text
금지    Execution = Heal
금지    Effect    = Projectile

허용    Execution = Direct        + Effect = Heal
허용    Execution = Spatial Query + Effect = Heal
허용    Execution = Contact       + Effect = Damage
```

같은 Effect가 여러 Execution과 결합할 수 있어야 하고, 같은 Execution이 여러 Effect와 결합할 수 있어야 한다. 이 직교성이 깨지면 스킬마다 시스템이 하나씩 생긴다.

---

# 5. 미구현 Effect를 선점하지 않는다

Skill System은 아직 세계에 없는 능력의 의미를 정의하지 않는다.

```text
Heal      회복이란 무엇인가 · 최대치는 무엇인가 · 죽은 대상에게 되는가
Shield    무엇을 얼마나 막는가 · 언제 사라지는가 · 피해 공식의 어디에 끼는가
Stun      무엇을 못 하게 되는가 · 이동은 · 이미 진행 중인 Action 은
Slow      무엇이 느려지는가 · 중첩하면
```

이 질문들은 Skill의 질문이 아니라 각 Capability 자신의 질문이다. Skill이 먼저 답을 적어 두면, 나중에 그 Capability를 설계하는 Cycle이 이미 굳은 정의를 물려받게 된다.

따라서 Skill 문서·정의·코드 어디에도 미구현 Effect의 이름을 예비 항목으로 두지 않는다.

---

# 6. 새 Effect Capability 도입 절차

새 Effect가 필요하면 순서는 항상 다음과 같다.

```text
STEP 1   그 Capability 를 요구하는 플레이 결과를 적는다
STEP 2   그 Capability 의 World Semantic 을 정의한다
             무엇이 변하는가 · 언제 끝나는가 · 무엇과 충돌하는가 · 어떻게 관찰되는가
STEP 3   해당 Cycle 이 그것을 세계에 구현한다
STEP 4   구현된 이후에 Skill Effect 로 사용할 수 있다
```

Skill이 먼저 그것을 쓰겠다고 선언해서 Capability가 생기지 않는다.

## 6.1 Heal 예시

```text
Heal Capability
    IMPLEMENTED
        ↓
Skill Effect 에서 Heal 사용 가능
```

Heal이 구현되기 전까지, 다음 Skill 정의는 **작성 불가**다.

```text
Basic Heal
Target Anchor = Unit
Resolution    = Single
Effect        = Heal        ← Heal Capability 미구현이면 여기서 멈춘다
```

이때 Cycle은 GAP으로 반환한다.

```text
GAP
Required   대상 하나의 HP 를 회복시킨다
Missing    Heal Capability
Reason     세계에 회복이라는 State Transition 이 없다
Return To  World Semantic (Heal Capability 설계)
```

## 6.2 Condition 예시

Stun · Slow · Root · Buff · Debuff 는 개별 Effect가 아니라 하나의 공통 의미를 요구한다.

Condition이 필요하다면 먼저:

```text
Condition
duration
stack
refresh
expire
remove
```

등의 World Semantic을 정의한다.

그 후:

```text
ApplyCondition
RemoveCondition
```

을 Skill에서 사용할 수 있다.

즉 Skill Effect 목록에 `Stun`이 추가되는 것이 아니라, `ApplyCondition(Stun)`이 가능해지는 것이다.

---

# 7. 관찰 계약

Effect 하나가 적용될 때 최소 다음을 관찰할 수 있어야 한다.

```text
skillId
sourceActor
targetActor
effectKind
executionKind         어떤 실행 경로로 왔는가
position              적용 지점
```

Damage인 경우 기존 Strike Event / Damage Breakdown으로 연결한다.

```text
damageType            Physical / Aura
sourceOffense         선택된 공격 능력치와 그 값
targetDefense         선택된 방어 능력치와 그 값
skillBaseDamage
skillAttackRatio
finalDamage
```

`executionKind`를 함께 관찰하는 이유는, 피해가 달라 보일 때 그것이 **공식 때문인지 대상 수 때문인지** 구분하기 위해서다. 공식은 하나이므로, 차이는 언제나 Resolution 쪽에 있다.

---

# 8. 금지 구조

```text
금지   전달 방식별 피해 종류 (ProjectileDamage · AreaDamage · MeleeDamage)
금지   Execution 자리에 Effect 를 두는 것
금지   Effect 가 자기 피해 공식을 새로 만드는 것
금지   대상 수에 따른 숨은 피해 보정
금지   미구현 Capability 이름을 Effect 목록에 예비로 두는 것
금지   Skill 문서가 Heal · Shield · CC 의 의미를 먼저 정의하는 것
금지   View 가 Effect 결과를 결정하거나 보정하는 것
```

---

# 9. 수용 기준

1. Damage가 유일한 현재 Effect이며, 모든 Execution 경로가 같은 공식을 지난다.
2. Skill은 Base Damage · Ratio · Damage Type · Source · Target만 공식에 제공한다.
3. 여러 대상에 적용될 때 각 대상마다 독립적으로 계산한다.
4. 대상 수에 따른 숨은 보정이 없다.
5. 하나의 Resolution 결과에서 같은 Actor가 두 번 맞지 않는다.
6. 반복 피해는 반복 Trigger + 반복 Resolution으로만 발생한다.
7. 미구현 Effect의 이름이 Skill 정의 어디에도 예비로 등장하지 않는다.
8. 새 Effect는 World Capability 구현 이후에만 Skill에서 사용된다.
9. Effect 적용을 관찰만으로 설명할 수 있다 (누가 · 누구에게 · 어떤 경로로 · 얼마나).
10. Skill Effect 도입 때문에 기존 Damage Formula나 Damage Type 규칙을 수정하지 않는다.
