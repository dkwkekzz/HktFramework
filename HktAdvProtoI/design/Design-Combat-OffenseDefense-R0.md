<!--
저장소 주석 (원본 아님) — 이 파일은 Human 이 작성한 전투 System Design Document 원본이다.

1. R1 전면 개정 — 구판 R0(FLOW / BREAK / VOW 등 확장 전투 시스템 일괄 설계)을
   "가장 단순한 공격/방어 공식 먼저" 로 대체했다. 구판의 시스템 다수는 §14 확장 순서로
   이연되었고 그 세부 수치·판정은 삭제되었다 — 필요하면 git history 의 이 파일에서 본다.
   파일명의 R0 은 저장소 곳곳의 참조 안정성을 위해 유지한다.
2. **Cycle 번호를 쓰지 않는다.** 이 기준선은 Cycle 을 처음부터 다시 세므로(첫 Cycle 은
   C001) 옛 트랙의 번호는 아무것도 가리키지 않는다. 이 문서의 층은 번호가 아니라
   **이름**으로 식별한다 — 기본 공식 · Critical · Defense Action · Damage Type ·
   Penetration · Active Defense · Aura/Nen. 실제 Cycle 번호는 승인된 Play Design 의
   Cycle Breakdown 이 정한다.
3. 능동 방어(막기·되받아침)는 한때 구현됐다가 이 개정의 층 순서(기본 공식이 먼저,
   능동 방어는 그 위)와 어긋나 롤백됐다. 지금 코드에 없으며 §14 의
   Defense Action → Active Defense 순서로 재구축한다.
4. §3·§4·§5·§11 의 수치·공식은 이 문서가 원본이다 — 해당 Cycle 의 `02-world.md` 가
   그것을 옮겨 받아 소유한다.
5. 옛 Master Layer 산출물(`master/graph` · `overlay` · `frontier` · `constraints`)은 이
   기준선에서 걷어냈다. 이 문서의 Goal/Possibility/Capability 의미를 받는 자리는 이제
   `content/roadmap/play/` 다. 구 Constraint 이름(PLAYER-CAUSALITY · ONE-FORMULA ·
   ONE-LAYER-AT-A-TIME · SHARED-BUDGET · MATCHUP-SOFT)은 이 파일과
   `Design-Combat-DamageType-R0.md` 가 근거였다 — 필요해지면 Play Design 의 판단
   기준으로 되살린다.
-->

# SYSTEM DESIGN DOCUMENT

## 기본 공격/방어 공식 (Basic Attack / Defense Formula)

Combat Offense / Defense · 기본 공격·방어 공식

> **핵심 명제**
> 내 공격력이 높으면 더 아프고, 상대 방어력이 높으면 덜 아프다.

| **문서 버전** | R1 (전면 개정 — 구판 R0 대체)          |
|---------------|----------------------------------------|
| **상태**      | System Design Draft                    |
| **기반**      | 지금 있는 기본 전투 정책 (Intent)        |
| **범위**      | Attack / Defense / Skill Base Damage / Skill Attack Ratio |
| **작성 목적** | 이후 모든 공격/방어 시스템의 공통 계산 기반 |

# 0. 설계 방향

이 층의 목표는 복잡한 전투를 완성하는 것이 아니다.

먼저 모든 전투의 기반이 되는 가장 단순한 MMORPG식 공식을 만든다.

이번 단계에서는 다음 질문만 해결한다.

> 내 공격력이 높으면 더 아프고, 상대 방어력이 높으면 덜 아프다.

명중, 회피, 치명타, 막기, 속성 상성, 관통, 넨 배분, 가드 브레이크 등의
시스템은 아직 넣지 않는다.

이 층이 이후 모든 공격/방어 시스템의 공통 계산 기반이 된다.

# 1. 전투의 최소 구조

현재 존재하는 값:

```text
HP
CP
Move Speed
Attack Speed
Skill Damage
Skill CP Charge
Skill CP Cost
```

여기에 딱 두 능력치만 추가한다.

```text
Attack
Defense
```

**Attack**

Actor가 공격을 얼마나 강하게 만들어내는지를 나타낸다.
장비, 성장, 버프 등으로 증가할 수 있다.

**Defense**

Actor가 들어오는 피해를 얼마나 줄이는지를 나타낸다.
방어구, 성장, 버프 등으로 증가할 수 있다.

따라서 Actor의 기본 전투 능력치는 우선 다음 정도면 충분하다.

```text
HP
CP
Attack
Defense
MoveSpeed
AttackSpeed
```

# 2. 스킬은 여전히 자기 피해 성격을 가진다

지금 있는 **Skill Damage** 개념은 유지한다.

다만 이것을 앞으로는 **Skill Base Damage** 라고 정의한다.

예:

```text
Basic Attack    Base Damage = 50
Heavy Attack    Base Damage = 120
```

스킬 자체의 강함과 Actor 자신의 공격력을 분리하기 위해서다.

# 3. 가장 기본적인 공격 공식

우선 공격 피해를 다음처럼 계산한다.

```text
Raw Damage
    = Skill Base Damage
    + Attack × Skill Attack Ratio
```

예를 들어:

```text
Actor Attack = 100
Basic Attack
    Base Damage  = 50
    Attack Ratio = 0.5
```

이면

```text
Raw Damage = 50 + 100 × 0.5 = 100
```

이다. 강한 스킬이라면:

```text
Heavy Attack
    Base Damage  = 100
    Attack Ratio = 1.0
```

따라서 같은 Actor가 사용하면:

```text
100 + 100 × 1.0 = 200
```

이 된다.

이 구조의 장점은 명확하다.

> **Actor의 성장과 스킬의 성장을 따로 조절할 수 있다.**

# 4. 기본 방어 공식

Defense는 피해를 일정 비율 감소시킨다.

가장 단순한 diminishing return 공식을 사용한다.

```text
Defense Multiplier
    = Defense Constant
    / (Defense Constant + Defense)
```

초기에는:

```text
Defense Constant = 100
```

으로 둔다. 따라서:

| **Defense** | **받는 피해** |
|-------------|---------------|
| 0           | 100%          |
| 25          | 80%           |
| 50          | 67%           |
| 100         | 50%           |
| 200         | 33%           |
| 300         | 25%           |

방어력이 계속 증가해도 완전 무적이 되지 않는다.

그리고 방어력이 높아질수록 추가 Defense의 효율이 점차 완만해진다.

# 5. 최종 피해 공식

따라서 이 층의 전체 피해 공식은 단 하나다.

```text
Raw Damage
    = Skill Base Damage
    + Attack × Skill Attack Ratio

Final Damage
    = Raw Damage
    × Defense Constant
      / (Defense Constant + Target Defense)
```

최종 결과는 정수로 반올림한다.

예:

```text
공격자    Attack = 100
스킬      Base Damage = 50 · Attack Ratio = 1.0
방어자    Defense = 50
```

공격 피해:

```text
50 + 100 = 150
```

Defense 적용:

```text
150 × 100 / 150 = 100
```

따라서:

```text
Final Damage = 100
```

HP가 500 이었다면 500 → 400 이 된다.

# 6. 중요한 원칙 — RNG는 아직 없다

이 층에서는 다음을 전부 만들지 않는다.

```text
Miss
Dodge
Critical
Block
Parry
Random Damage
```

Swing Collider가 실제로 상대 몸에 닿았다면 공격은 성공한다.

그리고 동일한 상태에서는 항상 동일한 피해가 발생한다.

즉:

```text
같은 Attack · 같은 Skill · 같은 Defense
    → 항상 같은 Final Damage
```

지금 있는 결정론적 전투 철학을 그대로 유지한다.

# 7. 공격 시스템

공격 시스템의 역할은 여기까지만 한다.

```text
스킬 시작
    ↓
Collider 활성화
    ↓
상대 Body와 충돌
    ↓
Raw Damage 계산
    ↓
상대 Defense 적용
    ↓
Final Damage 계산
    ↓
HP 감소
    ↓
Hit Reaction
    ↓
CP Charge / Cost 처리
```

새로운 공격 판정 시스템을 만들지 않는다.

기존의

```text
ACTION · SWING · COLLIDER · BODY · HIT REACTION
```

구조를 그대로 사용한다.

이 층은 단지 피해 계산 단계만 확장한다.

# 8. 방어 시스템

이번 단계의 방어는 버튼을 누르는 행동이 아니다.

**Defense 능력치 자체가 방어 시스템이다.**

즉:

```text
방어구를 좋은 것으로 바꾼다
    ↓
Defense 증가
    ↓
같은 공격에서 받는 피해 감소
```

이것이 MMORPG에서 가장 기본적인 방어 구조다.

아직:

```text
Guard · Perfect Guard · Shield · Block · Parry
```

는 없다.

이것들은 Defense 공식 위에 나중에 올라간다.

# 9. 지금 있는 전투와의 관계

기존:

```text
INTENT-STRIKE-DAMAGE-001
    스킬이 100 피해라면 언제나 100 피해
```

였다면 이 층에서는 다음과 같이 바뀐다.

**INTENT-STRIKE-DAMAGE-001 — CHANGED**

스킬은 자신의 기본 피해량과 공격 계수를 가진다.

타격의 기본 공격 피해는 스킬의 기본 피해량과 공격자의 Attack 능력치로
결정된다.

그 피해는 대상의 Defense 능력에 의해 감소한 뒤 생명에 적용된다.

같은 공격자, 같은 스킬, 같은 대상 상태에서 발생한 타격은 언제나 같은
피해를 만든다.

피해 계산에는 난수를 사용하지 않는다.

# 10. 신규 INTENT

**INTENT-ATTACK-POWER-001**

Actor는 공격의 위력을 나타내는 Attack 능력치를 가진다.

Attack은 스킬이 가진 공격 계수에 따라 해당 스킬의 피해에 기여한다.

Attack이 증가하면 같은 스킬이 만드는 피해도 증가한다.

---

**INTENT-SKILL-SCALING-001**

스킬은 기본 피해량과 Attack 능력치를 얼마나 피해로 변환하는지를 나타내는
공격 계수를 가진다.

기본 피해량과 공격 계수는 스킬마다 다를 수 있다.

따라서 같은 Actor가 사용해도 스킬에 따라 피해량은 달라진다.

---

**INTENT-DEFENSE-001**

Actor는 들어오는 공격 피해를 줄이는 Defense 능력치를 가진다.

Defense는 피해를 완전히 제거하지 않으며, 값이 증가할수록 피해 감소
효과의 증가폭은 점차 작아진다.

---

**INTENT-DAMAGE-CALCULATE-001**

타격이 발생하면 세계는 먼저 스킬의 기본 피해량과 공격자의 Attack으로
공격 피해를 계산한다.

그 뒤 대상의 Defense를 적용하여 최종 피해를 결정한다.

계산 결과에는 난수가 개입하지 않는다.

# 11. 첫 번째 밸런스 기준

초기 테스트에서는 숫자를 단순하게 유지한다.

**일반 Actor**

```text
HP      500
CP      100
Attack  100
Defense 50
```

**Basic Attack**

```text
Base Damage  25
Attack Ratio 0.5
CP Charge    10
CP Cost       0
```

Raw Damage:

```text
25 + 100 × 0.5 = 75
```

Defense 50 적용:

```text
75 × 100 / 150 = 50
```

최종: **50 Damage** — 대략 10회 정도 맞으면 쓰러진다.

**Advanced Attack**

```text
Base Damage  75
Attack Ratio 1.0
CP Charge     0
CP Cost      50
```

Raw Damage:

```text
75 + 100 = 175
```

Defense 적용:

```text
175 × 100 / 150 ≈ 117
```

기본 공격보다 약 2.3배 강하다.

따라서 지금 있는:

```text
기본 공격 → CP 충전
고급 공격 → CP 소비
```

구조도 그대로 유지된다.

# 12. 성장 구조도 자연스럽게 생긴다

이 공식이 있으면 별도의 복잡한 시스템 없이 RPG 성장이 가능하다.

예를 들어 검을 교체해서:

```text
Attack  100 → 120
```

이 되었다고 하자.

```text
Basic Attack     25 + 120 × 0.5 = 85
Advanced Attack  75 + 120 × 1.0 = 195
```

공격력이 증가했지만 공격 계수가 높은 스킬이 더 큰 혜택을 받는다.

그래서 자연스럽게:

```text
빠른 기술 → 낮은 Ratio
강한 기술 → 높은 Ratio
```

같은 스킬 차별화도 가능해진다.

# 13. 이 층에서 하지 않을 것

이 부분을 명확하게 제한하는 것이 중요하다.

이번 Cycle에서는 다음을 구현하지 않는다.

```text
Critical
Accuracy
Miss
Dodge
Parry
Block
Armor Penetration
Physical / Magical Defense
Damage Type
Element
Guard
Guard Break
Perfect Guard
Counter
Nen Type
Aura Allocation
Condition / Vow
```

전부 이후 확장 시스템이다.

# 14. 점진적인 확장 순서

기본 공식을 만든 뒤 한 층씩 추가한다.

## 1층 — Basic Damage

```text
Attack
Defense
Skill Base Damage
Skill Attack Ratio
```

목표: MMORPG 기본 공격/방어 공식 완성.

## 2층 — Critical

그 다음 가장 전통적인 RPG 요소 하나만 추가한다.

```text
Critical Chance
Critical Damage
```

다만 현재 시스템이 결정론을 중요하게 여긴다면 Critical 자체를 넣을지
여기서 다시 판단한다.

1층은 Critical 없이도 완전히 동작해야 한다.

## 3층 — Defense Action

그 다음 능동 방어를 추가한다.

```text
Guard
```

처음에는 단순하게:

```text
Guard → Damage Taken × 0.5
```

정도로 시작한다. Perfect Guard나 Guard Break는 아직 없다.

## 4층 — Damage Type

전투의 빌드 다양성이 필요해지는 시점에:

```text
Physical Attack
Magic / Aura Attack
Armor
Resistance
```

를 분리한다.

## 5층 — Penetration

방어력 메타가 생겼을 때:

```text
Armor Penetration
Resistance Penetration
```

을 추가한다.

## 6층 — Active Defense

Guard가 재미있다는 것이 검증된 뒤:

```text
Perfect Guard
Guard Break
Counter
```

를 추가한다. 이때부터 액션 전투의 깊이가 생긴다.

## 7층 — Aura / Nen Layer

여기까지 기본 RPG 전투가 안정적으로 동작한 뒤에야 넨에서 영감을 받은
시스템을 올린다.

예:

```text
공격 집중
방어 집중
기력 집중
조건
제약
서약
특정 상황에서 능력 강화
```

중요한 것은 넨 시스템이 새로운 피해 공식을 만드는 것이 아니라는 점이다.

기존 값:

```text
Attack · Defense · CP · Skill Ratio
```

를 특정 조건에서 변화시키는 상위 규칙으로 만든다.

예:

```text
공격 집중
    Attack  × 1.3
    Defense × 0.7
    CP      -5/sec
```

정도로 충분하다. 기본 공식은 그대로다.

# 15. 전체 구조

결국 전투 시스템은 아래처럼 층층이 쌓인다.

```text
            [ Aura / Nen ]
         조건 · 제약 · 집중
                 ↓
        [ Active Defense ]
     Guard · Counter · Break
                 ↓
          [ Damage Type ]
      Physical · Aura · Pen
                 ↓
          [ RPG Combat ]
        Attack · Defense
                 ↓
         [ Skill Formula ]
 BaseDamage + Attack × Ratio
                 ↓
          [ 기본 전투 Core ]
 Collider · HP · CP · Action
```

가장 아래의 공식은 계속 유지한다.

위의 시스템은 아래 공식을 수정할 뿐 교체하지 않는다.

이 원칙을 잡아두면 확장할수록 시스템이 난잡해지는 것을 상당히 막을 수
있다.

# 16. 이 층의 성공 조건

이번 Cycle의 성공 기준 역시 단순하게 잡는다.

플레이어가 다음 세 가지를 직관적으로 느끼면 성공이다.

1. 공격력이 높은 캐릭터가 같은 스킬을 쓰면 더 세다.

2. 방어력이 높은 캐릭터는 같은 공격을 맞아도 덜 아프다.

3. 기본 공격으로 CP를 모으고 강한 공격으로 CP를 쓰는 기존 전투 루프가
   그대로 동작한다.

이 세 가지가 충분히 재미있고 안정적으로 작동한 다음에만 다음 전투 규칙을
추가한다.

# 핵심 원칙

앞으로의 전투 시스템은 계속 이 규칙을 따른다.

> **새로운 시스템은 새로운 피해 공식을 만들지 않는다.**
> **기존 공식의 입력값이나 결과값에 한 가지 의미만 추가한다.**

예를 들어:

```text
Critical     → Final Damage 를 증폭한다
Guard        → Final Damage 를 감소시킨다
Penetration  → Defense 를 감소시킨다
Aura         → Attack 또는 Defense 를 변화시킨다
Condition    → 특정 조건에서 위 값에 Modifier 를 제공한다
```

이렇게 만들면 처음에는 아주 평범한 MMORPG 전투로 시작하지만, 나중에는
같은 기반 위에서

```text
장비 성장 → 빌드 → 능동 방어 → 기력 운용 → 넨식 조건과 제약
```

순서로 자연스럽게 깊이를 만들어갈 수 있다.
