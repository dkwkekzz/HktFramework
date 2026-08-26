# Design-Combat-UpperLayer-R0

## Active Defense / Aura-Nen 심층 전투 설계

> **핵심 명제**
>
> 전투 상층의 목적은 플레이어에게 더 많은 버튼을 주는 것이 아니다.
> **같은 기본 공격·방어 공식 위에서 서로 다른 전투 규칙을 가진 캐릭터가 충돌하도록 만드는 것**이다.

---

## 0. 문서 목적

현재 전투의 하층에는 다음 기반이 존재한다.

```text
Damage
Defense
Damage Type
Penetration
Critical
```

이 층들은 기본적으로 다음 질문을 해결한다.

> 공격이 적중했을 때 최종적으로 어떤 피해가 발생하는가?

기존 전투 설계 역시 동일한 상태에서는 동일한 피해가 발생하는 결정론적 기반을 유지하며, 상위 시스템이 기존 공식을 교체하지 않고 한 층씩 의미를 추가하도록 설계되어 있다.

이제 그 위에 두 개의 상층을 추가한다.

```text
Active Defense
Aura / Nen
```

첨부된 기존 설계에서도 Active Defense는 Guard 이후 Perfect Guard·Guard Break·Counter를 확장하는 층으로, Aura/Nen은 공격·방어·기력 집중 및 조건·제약·서약을 다루는 최상층으로 예정되어 있다.

하지만 이를 그대로 구현하면 두 문제가 발생한다.

1. Active Defense가 모바일에서 지나치게 높은 조작 부담을 만든다.
2. Aura/Nen이 수많은 게이지와 배분값을 관리하는 복잡한 서브게임이 된다.

따라서 이 문서는 두 층을 다음과 같이 재정의한다.

> **Active Defense = 공격을 받는 순간 자신의 전투 능력을 표현하는 Response Layer**
>
> **Aura/Nen = 힘의 배분과 제약을 이용하여 자신이 가진 Capability의 규칙을 변화시키는 Ability Rule Layer**

---

## 1. 전체 전투 구조

최종 전투 구조는 다음과 같다.

```text
┌─────────────────────────────────────┐
│ Aura / Nen                          │
│ Allocation · Condition · Contract   │
│ 개인 능력의 규칙을 변화시킨다       │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ Character Ability                   │
│ Skill · Passive · Response          │
│ 세계에 무엇을 할 수 있는가          │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ Active Defense                      │
│ Guard · Evade · Counter · Intercept │
│ 공격에 어떻게 대응하는가            │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ Critical / Penetration / Type       │
│ 결과를 어떻게 수정하는가            │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ Damage / Defense Formula            │
│ 최종 피해를 계산한다                │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ Combat Core                         │
│ Action · Collider · Body · HP · CP  │
└─────────────────────────────────────┘
```

상층 시스템은 하층을 대체하지 않는다.

예를 들어:

```text
Counter 성공
    ↓
피해 공식 변경 X
Counter Opportunity 생성
    ↓
Counter Skill 실행
    ↓
기존 Damage Pipeline으로 피해 계산
```

Aura/Nen 역시 새로운 피해 공식을 만들지 않는다.

```text
Contract 충족
    ↓
Skill Capability 확장
    ↓
필요한 경우 기존 Attack / Defense / Penetration 등에 Modifier
    ↓
기존 피해 공식 사용
```

이는 기존 문서의

> 새로운 시스템은 새로운 피해 공식을 만들지 않고 기존 공식에 하나의 의미를 추가한다.

라는 원칙을 그대로 유지한다.

단, 전투 상층은 **피해 이외의 World Operation**을 허용한다.

피해 공식을 확장하는 것과 전투에서 가능한 행동의 종류를 확장하는 것은 서로 다른 문제다.

---

## 2. 상층 전투가 해결해야 하는 문제

현재 하층 전투가 제공하는 빌드 차이는 대부분 다음 형태다.

```text
더 많이 때린다.
덜 맞는다.
특정 타입에 강하다.
방어를 더 많이 뚫는다.
특정 조건에서 큰 피해를 준다.
```

이 구조만 계속 확장하면 스킬 이름과 연출은 달라도 본질적으로:

```text
Damage
Damage + Debuff
Area Damage
Damage Over Time
Buffed Damage
```

로 수렴한다.

상층 전투의 목적은 이것을 넘어서는 것이다.

예를 들어 캐릭터 A가 가진 능력이:

> 자신을 공격한 적의 이동을 봉인한다.

캐릭터 B는:

> 자신이 관찰한 Skill 하나를 봉인한다.

캐릭터 C는:

> 아군에게 향하는 공격의 대상을 자신으로 변경한다.

캐릭터 D는:

> 자신이 받은 공격을 저장했다가 다른 대상에게 전달한다.

캐릭터 E는:

> 일정 시간 동안 지정한 적과 자신의 위치 관계를 고정한다.

가 될 수 있어야 한다.

즉 상층의 목표는:

> **Damage Variation이 아니라 Rule Variation을 만든다.**

---

## 3. 설계 원칙

### 3.1 Low Input · High Depth

플레이어가 전투 중 직접 조작해야 하는 것은 제한한다.

기본 입력은 다음 정도를 유지한다.

```text
이동
Basic Attack
Skill 1
Skill 2
Skill 3
Skill 4
Active Response
Aura Profile
```

전투의 깊이는 버튼 개수가 아니라 각 행동 뒤에서 평가되는:

```text
Timing
Condition
Target
Allocation
Contract
World State
Counterplay
```

에서 나온다.

---

### 3.2 능동 방어는 필수가 아니라 선택적 숙련이어야 한다

일반 공격을 막기 위해 항상 Perfect Guard를 요구하지 않는다.

```text
기본 생존
    =
Defense
장비
위치
일반 Guard
```

가 담당한다.

Active Defense는 그 위의 숙련이다.

```text
좋은 Timing
        ↓
더 좋은 Response Result
```

즉:

> 못하면 게임을 할 수 없는 시스템이 아니라
> 잘하면 새로운 가능성이 열리는 시스템이어야 한다.

---

### 3.3 Aura는 실시간 수치 조절 UI가 아니다

다음과 같은 시스템은 사용하지 않는다.

```text
오른팔 Aura 73%
몸 Aura 17%
시야 Aura 10%
강화 21%
방출 17%
조작 13%
...
```

이것은 설정적으로는 깊지만 MMORPG 플레이에서는 관리 부담이 지나치게 높다.

Aura의 복잡성은 내부 Rule이 담당한다.

플레이어는 **의미 있는 상태만 선택한다.**

---

### 3.4 강력한 능력에는 읽을 수 있는 이유가 존재해야 한다

강력한 효과가 발생했다면 상대도 원인을 이해할 수 있어야 한다.

```text
왜 봉인되었는가?
왜 이동할 수 없는가?
왜 공격이 반사되었는가?
왜 저 Skill을 사용할 수 없는가?
```

결과에는 반드시 원인이 존재한다.

```text
Condition
Contract
Aura State
Observed Event
Response
```

중 하나 이상으로 설명 가능해야 한다.

---

## 4. Active Defense Layer

### 4.1 정의

Active Defense는:

> **공격이 자신 또는 보호 대상에게 도달하는 순간 Actor가 선택할 수 있는 Response Capability**

이다.

기존의 Guard / Dodge / Parry / Counter를 별도 시스템으로 만들지 않는다.

모두 하나의 `Response`라는 공통 구조를 사용한다.

---

### 4.2 Response Slot

각 Actor는 기본적으로 하나의 `Active Response Slot`을 가진다.

```text
Active Response Slot
        │
        ├─ Guard
        ├─ Evade
        ├─ Parry
        ├─ Counter
        ├─ Intercept
        ├─ Absorb
        └─ Character Unique Response
```

캐릭터 또는 Class에 따라 이 슬롯에 무엇을 장착할 수 있는지가 다르다.

예:

```text
Knight
→ Guard
Duelist
→ Parry
Assassin
→ Evade
Guardian
→ Intercept
Nen User
→ Aura Absorb
```

UI에는 모두 동일하게 **Response 버튼 하나**만 존재할 수 있다.

---

## 5. Response Window

기존 C019의 시점 판정 기반 위에서 공격은 Response 가능한 시간을 가진다.

```text
Attack Telegraph
        ↓
Response Open
        ↓
Precision Window
        ↓
Impact
        ↓
Response Close
```

Response의 결과는 최소 세 단계다.

```text
NONE
NORMAL
PRECISION
```

### NONE

Response하지 않았다.

```text
→ 기존 Damage Pipeline
```

### NORMAL

Response Window 안에 행동했다.

```text
→ 장착 Response의 기본 효과
```

### PRECISION

특정 Precision Window에 정확하게 행동했다.

```text
→ Response의 강화 효과
```

---

## 6. Perfect Guard의 정의

Perfect Guard라는 별개의 행동은 존재하지 않는다.

Guard의 Precision 결과가 Perfect Guard다.

예:

```text
Guard
    Normal
        Damage Taken × 0.5
    Precision
        Damage Taken = 0
        Attacker → Exposed
        Counter Opportunity 생성
```

따라서:

```text
Guard
    ↓
숙련
    ↓
Perfect Guard
```

라는 자연스러운 구조가 된다.

---

## 7. Counter의 정의

Counter 역시 반드시 별도의 버튼일 필요가 없다.

Counter는 대부분 `Opportunity`를 통해 발동한다.

예:

```text
Precision Guard
        ↓
Counter Opportunity
Precision Evade
        ↓
Back Attack Opportunity
Parry
        ↓
Weapon Break Opportunity
```

Opportunity가 생성되면 특정 Skill이 변화할 수 있다.

```text
Skill 1
평상시:
Quick Slash
Counter Opportunity 보유:
Reversal Slash
```

따라서 모바일에서:

```text
Perfect Guard 버튼
Counter 버튼
Dodge 버튼
Parry 버튼
```

을 각각 만들 필요가 없다.

---

## 8. Evade

Evade 역시 RNG 회피와 구별한다.

```text
Dodge Chance
```

가 아니다.

플레이어가 실제 Response를 실행하여 공격 판정으로부터 벗어난 것이다.

대표 방식:

```text
Displacement
Invulnerability Window
Target Invalidity
Phase
```

초기 구현에서는 가장 단순한 것을 사용한다.

```text
Evade
    ↓
짧은 이동
    +
짧은 공격 판정 무효 Window
```

Precision Evade는 다음과 같은 결과를 줄 수 있다.

```text
Aura 비용 감소
적 후방 Opportunity
상대 Skill 정보 획득
다음 Skill 강화
```

---

## 9. Response는 캐릭터 능력의 일부다

상층 전투에서 가장 중요한 확장은 이것이다.

Response가 항상:

```text
Guard
Evade
Counter
```

로 끝날 필요가 없다.

예를 들어:

### 기록술사

```text
Response = Observe
Precision Response
→ 공격은 정상적으로 피함
→ 사용된 Skill을 ObservedSkill로 기록
```

### 흡수자

```text
Response = Absorb
Normal
→ Damage 일부 감소
Precision
→ 감소된 Damage만큼 Aura Reserve 회복
```

### 공간술사

```text
Response = Shift
Precision
→ 자신과 공격자의 위치 교환
```

### 수호자

```text
Response = Intercept
아군에게 향한 공격에 사용
→ 공격 Target을 자신으로 변경
```

즉 Active Defense는 단순 액션 전투 기능이 아니라:

> **캐릭터의 고유 능력이 공격을 받는 순간 표현되는 통로**

가 된다.

---

## 10. Response Resource

Response를 무제한 난사하지 못하게 한다.

하지만 새로운 복잡한 자원 시스템을 만드는 것도 피한다.

초기에는 기존 CP 또는 Aura Reserve를 사용할 수 있다.

예:

```text
Guard
CP Cost = 10
Evade
CP Cost = 15
Counter
CP Cost = 20
```

혹은 Cooldown을 사용할 수 있다.

중요한 것은:

> Response만을 위한 또 하나의 별도 게이지를 만들지 않는다.

---

## 11. Aura/Nen Layer의 정의

Aura/Nen은 마법 공격력 같은 새로운 공격 타입이 아니다.

정의:

> **Actor가 가진 힘을 어떤 Capability에 우선 배분하고, 어떠한 조건과 제약 아래 사용할지를 결정하는 최상위 Combat Rule Layer**

구성 요소는 네 가지다.

```text
Aura Reserve
Aura Allocation
Condition
Contract
```

그리고 그 결과가:

```text
Ability Rule
```

에 영향을 준다.

---

## 12. Aura Reserve

Aura Reserve는 Actor가 특수 능력에 사용할 수 있는 힘이다.

이미 CP가 이 역할을 충분히 수행한다면 초기 단계에서는 새로운 Resource를 만들지 않아도 된다.

즉 구현 관점에서는 두 가지가 가능하다.

### 초기

```text
Aura Resource = CP
```

### 이후

Aura 자체가 충분히 독립적인 의미를 가지게 되었을 때:

```text
CP
→ 일반 Combat Resource
Aura
→ Nen Capability Resource
```

로 분리한다.

처음부터 분리하지 않는다.

---

## 13. Aura Allocation

Aura Allocation은 현재 자신의 힘을 어디에 집중하는지를 나타낸다.

초기 축은 세 개면 충분하다.

```text
BODY
ABILITY
AWARENESS
```

### BODY

자신의 몸과 무기, 직접 전투에 힘을 집중한다.

영향 가능 항목:

```text
Attack
Defense
Guard
Physical Response
Resistance
```

---

### ABILITY

고유 Skill과 특수 Capability에 힘을 집중한다.

영향 가능 항목:

```text
Skill Strength
Duration
Range
Maximum Target
Capability Tier
Contract Efficiency
```

---

### AWARENESS

세계와 적을 인지하는 데 힘을 집중한다.

영향 가능 항목:

```text
Detection
Hidden State Perception
Skill Observation
Response Window
Weakness Information
Aura Detection
```

---

## 14. Aura Profile

플레이어가 전투 도중 숫자를 직접 조절하지 않는다.

미리 Profile을 만든다.

예:

### Balanced

```text
BODY       2
ABILITY    2
AWARENESS  2
```

### Reinforce

```text
BODY       4
ABILITY    1
AWARENESS  1
```

### Hatsu

```text
BODY       1
ABILITY    4
AWARENESS  1
```

### Hunter

```text
BODY       1
ABILITY    1
AWARENESS  4
```

전투 중에는:

```text
Aura Profile 변경
```

만 한다.

따라서 내부에서는 복잡한 힘 배분이 존재하지만 플레이 입력은 한 번의 선택이다.

---

## 15. Allocation은 단순 공격력 버프가 아니다

가장 단순한 초기 구현은 기존 문서처럼:

```text
BODY 집중
Attack ↑
Defense ↑
```

여도 된다.

그러나 최종 목적은 그 이상이다.

예:

```text
AWARENESS 3 이상
    → Hidden Actor 감지 가능
ABILITY 4 이상
    → Chain Bind의 두 번째 Constraint 사용 가능
BODY 4 이상
    → Heavy Counter가 Guard Break에 저항 가능
```

즉 Allocation은 단순 수치 강화뿐 아니라:

> **어떤 Capability를 현재 사용할 수 있는가**

에도 관여해야 한다.

---

## 16. Rule-based Ability

Aura/Nen의 핵심은 스킬을 단순 Effect가 아니라 Rule로 정의하는 것이다.

모든 고급 Skill은 가능한 한 다음 구조를 가진다.

```text
Ability
    ├─ Trigger
    ├─ Target
    ├─ Requirement
    ├─ Condition
    ├─ World Operation
    ├─ Cost
    ├─ Contract
    ├─ Failure
    └─ Counterplay
```

---

## 17. Trigger

Ability가 언제 시작될 수 있는가.

예:

```text
On Cast
On Hit
On Damaged
On Precision Response
On Target Skill Use
On Death
On Contract Violation
```

Trigger 자체가 능력의 개성을 만들 수 있다.

---

## 18. Requirement

능력을 사용할 수 있기 위한 현재 상태다.

예:

```text
Aura Ability ≥ 3
ObservedSkill 존재
Target에 Mark 존재
HP ≤ 30%
Counter Opportunity 존재
특정 Item 장착
```

Requirement를 만족하지 않으면 Skill은 발동하지 않는다.

---

## 19. Condition

Condition은 능력이 강력한 효과를 얻기 위한 세계 조건이다.

예:

```text
Target이 나를 먼저 공격했다.
대상이 특정 Species다.
밤이다.
내 HP가 절반 이하이다.
상대 Skill을 직접 관찰했다.
전투 중 한 번도 다른 대상을 공격하지 않았다.
```

Condition은 단순 확률이 아니다.

항상 WorldState에서 확인할 수 있어야 한다.

---

## 20. Contract

Contract는 자신에게 걸어 둔 의도적인 제약이다.

가장 중요한 설계 원칙:

> **Contract는 Damage Modifier를 얻기 위한 패널티가 아니라 새로운 Capability를 허용하기 위한 대가다.**

나쁜 예:

```text
HP -20%
→ Damage +30%
```

가능은 하지만 이것만으로 Aura/Nen을 구성하지 않는다.

좋은 예:

```text
오직 나를 먼저 공격한 대상에게만 사용할 수 있다.
    ↓
Target의 이동 Capability를 봉인할 수 있다.
```

또는:

```text
전투당 한 번만 사용할 수 있다.
    ↓
상대 Skill 하나를 강제로 Cancel할 수 있다.
```

또는:

```text
지속 중 다른 공격 Skill을 사용할 수 없다.
    ↓
지정한 아군이 받는 공격 Target을 자신에게 이전한다.
```

---

## 21. Contract의 구조

Contract는 다음처럼 표현한다.

```text
Restriction
        ↓
Capability Permission
        ↓
Violation Result
```

예:

```text
Restriction
    Chain Bind 상태에서는
    다른 Actor를 공격할 수 없다.
Permission
    Target의 이동 Capability를 제한한다.
Violation
    Bind 해제
    Skill Seal 10초
```

따라서 Contract는 실제 World Rule이다.

---

## 22. World Operation

헌터×헌터 수준의 Ability 다양성을 만들기 위해 가장 중요한 기반이다.

Skill은 Damage 이외에 세계에 다음 Operation을 가할 수 있어야 한다.

| 영역    | World Operation                        |
| ------- | -------------------------------------- |
| 생명    | Damage · Heal · Drain                  |
| 위치    | Move · Pull · Push · Swap · Fix        |
| 행동    | Interrupt · Disable · Enable · Replace |
| 관계    | Mark · Bind · Protect · Link           |
| 대상    | Redirect · Intercept · Retarget        |
| 정보    | Observe · Reveal · Hide · Track        |
| 자원    | Consume · Store · Transfer · Steal     |
| 피해    | Absorb · Reflect · Redirect · Delay    |
| 개체    | Spawn · Destroy · Attach               |
| Skill   | Seal · Copy · Record · Modify          |
| 영역    | Create Zone · Restrict Entry           |
| 시간    | Delay · Reserve · Trigger Later        |

이것이 상층 전투의 실제 확장 공간이다.

---

## 23. Skill은 World Capability의 조합이다

예:

### Chain Bind

```text
Trigger
Cast
Requirement
Target이 나를 공격한 기록 존재
Target
Actor 1
World Operation
Bind Relation 생성
Movement Range 제한
Cost
Aura 30
Contract
Bind 동안 다른 Actor 공격 금지
Violation
Bind 즉시 파괴
Ability Seal
Counterplay
Chain Entity 파괴
Caster 이동 강제
Contract 위반 유도
```

이 Skill은 Damage가 없어도 강력하다.

---

## 24. Counterplay는 모든 강한 Ability에 존재한다

상층 전투가 깊어질수록 가장 위험한 것은:

> 상대 입장에서 아무것도 할 수 없는 능력

이다.

따라서 강한 World Operation은 최소 하나 이상의 Counterplay를 가져야 한다.

Counterplay 종류:

```text
Avoid
Interrupt
Destroy
Break Condition
Force Contract Violation
Spend Resource
Move
Dispel
Observe
Exploit Window
```

예:

```text
Chain Bind
    ↓
Chain Entity 파괴 가능
Skill Seal
    ↓
Caster에게서 일정 거리 이상 이탈하면 해제
Damage Storage
    ↓
저장 중 Actor를 공격하면 저장량 일부 손실
```

---

## 25. 정보 자체가 전투 자원이 된다

헌터×헌터식 전투에서 중요한 것은:

> 상대가 무엇을 할 수 있는지 알아내는 과정

이다.

따라서 `Knowledge`를 Combat Layer와 연결한다.

예:

```text
Unknown Ability
        ↓
직접 관찰
        ↓
Ability Identity 발견
        ↓
조건 일부 발견
        ↓
Counterplay 발견
```

AWARENESS Allocation이 높을수록 더 많은 정보를 획득할 수 있다.

예:

```text
Awareness 1
→ Skill 이름
Awareness 2
→ Skill Type
Awareness 3
→ Condition
Awareness 4
→ Contract
Awareness 5
→ Counterplay
```

정확한 단계는 이후 조정한다.

핵심은:

> 강한 Skill을 단순히 맞아 보고 외우는 것이 아니라 세계 안에서 분석할 수 있어야 한다.

---

## 26. Active Defense와 Aura/Nen의 결합

두 시스템은 독립적이지 않다.

예:

### 기록술사

고유 Ability:

```text
Skill을 관찰하고 기록한다.
```

Response:

```text
Precision Observe
    ↓
피격 없이 상대 Skill 기록
```

Aura:

```text
Awareness 집중
    ↓
더 복잡한 Skill까지 분석 가능
```

Contract:

```text
기록한 Skill만 봉인 가능
```

최종적으로:

```text
Enemy Skill
      ↓
Precision Response
      ↓
ObservedSkill
      ↓
Aura Awareness
      ↓
Condition 충족
      ↓
Seal Ability
      ↓
Contract
```

하나의 캐릭터 전투 방식이 된다.

---

## 27. 예시 — 수호자

### Response

```text
Intercept
```

아군에게 공격이 들어오는 순간 사용한다.

Normal:

```text
Target
Ally → Self
```

Precision:

```text
Target 변경
+
Guard 자동 적용
+
Counter Opportunity
```

### Aura

```text
BODY 집중
→ Guard 강화
AWARENESS 집중
→ Intercept 가능한 거리 증가
```

### Contract

```text
Protect 상태 동안
지정 Ally와 일정 거리 이상 떨어질 수 없다.
```

그 대가로:

```text
Ally 대상 공격을 강제로 자신에게 Redirect 가능
```

---

## 28. 예시 — 축적자

### 고유 Rule

자신이 방어한 공격 에너지를 저장한다.

```text
Guard Damage Reduced
        ↓
Stored Force 증가
```

### Precision Guard

```text
피해 0
+
더 높은 Stored Force
```

### Release Skill

```text
Stored Force를 소비
        ↓
기존 Damage Formula의
Skill Base Damage에 추가
```

### Contract

```text
Stored Force를 가진 동안
Aura Profile을 변경할 수 없다.
```

상대는 이를 알고:

```text
약한 공격으로 Guard 강요
Profile 고정
강한 공격 회피
```

같은 대응을 할 수 있다.

---

## 29. 예시 — 사냥꾼

### Awareness 중심 Actor

```text
Target 관찰
        ↓
행동 패턴 기록
        ↓
Weakness Condition 발견
```

예:

```text
상대가 Heavy Skill 사용 후
0.8초 동안 Aura Defense 감소
```

이것이 단순 자동 Debuff가 아니라:

```text
Observe
    ↓
Knowledge
    ↓
Opportunity
```

로 발생한다.

이후:

```text
Weakness Exploit Skill
```

을 사용할 수 있다.

---

## 30. 복잡성 제어

상층 시스템은 강력하지만 플레이어에게 모든 내부 규칙을 직접 노출하지 않는다.

플레이어에게 필요한 핵심 UI는 다음이다.

### 전투 HUD

```text
HP
CP / Aura
Skill 1~4
Response
현재 Aura Profile
```

### 필요한 경우 표시

```text
Opportunity
Contract State
Mark
ObservedSkill
Important Condition
```

내부 시스템:

```text
World Operation
Constraint Evaluation
Capability Permission
Relation
Trigger
```

은 엔진이 관리한다.

---

## 31. 모바일 입력 원칙

모바일에서 다음 입력을 목표로 한다.

```text
왼손
→ 이동
오른손
→ 기본 공격
→ Skill
→ Response
→ Aura Profile
```

하지 않는다:

```text
Guard 버튼
Dodge 버튼
Parry 버튼
Counter 버튼
Aura Attack 버튼
Aura Defense 버튼
Aura Sight 버튼
```

캐릭터의 Build가 **Response의 의미를 결정**한다.

---

## 32. 자동 전투와의 관계

상층 시스템은 자동 전투에서도 최소 기능이 가능해야 하지만 사람의 판단에는 보상이 있어야 한다.

예:

```text
AUTO
→ Normal Response 가능
MANUAL
→ Precision Response 가능
```

또는:

```text
AUTO
→ 기본 Aura Profile 유지
MANUAL
→ 상황에 따라 Profile 변경
```

따라서 모바일 MMORPG에서도 기본 플레이는 가능하지만 숙련 플레이어가 분명한 차이를 만들 수 있다.

---

## 33. 관찰 가능한 Combat State

모든 상층 상태는 관찰 가능해야 한다.

예:

```text
actor.response
actor.auraProfile
actor.auraAllocation
actor.contracts[]
actor.marks[]
actor.links[]
actor.opportunities[]
actor.observedSkills[]
ability.conditions[]
ability.available
ability.unavailableReason
```

예:

```text
Skill: Chain Bind
available = false
reason:
TARGET_HAS_NOT_ATTACKED_CASTER
```

사람과 AI Agent 모두 결과의 원인을 즉시 확인할 수 있어야 한다.

---

## 34. Combat Event

중요 전투 변화는 Event로 남긴다.

```text
RESPONSE_USED
PRECISION_RESPONSE
OPPORTUNITY_CREATED
AURA_PROFILE_CHANGED
CONDITION_SATISFIED
CONDITION_LOST
CONTRACT_ACTIVATED
CONTRACT_VIOLATED
ABILITY_TRIGGERED
RELATION_CREATED
RELATION_REMOVED
SKILL_OBSERVED
SKILL_SEALED
```

예:

```text
PRECISION_RESPONSE
actor = player
response = GUARD
source = enemy-heavy-slash
OPPORTUNITY_CREATED
type = COUNTER
duration = 1.2
```

---

## 35. 설명 가능한 전투 결과

상층에서 어떤 결과가 발생해도 World Report만 보면 이유를 추적할 수 있어야 한다.

예:

```text
Enemy cannot move.
WHY?
ChainBind relation exists.
WHY?
Skill CHAIN_BIND succeeded.
WHY?
Condition TARGET_ATTACKED_CASTER = true.
WHY?
Enemy attacked Player at t=31.2.
Contract active:
Caster cannot attack another Actor.
```

이 정도까지 설명 가능해야 한다.

---

## 36. Character Ability의 기본 구조

향후 Class / Fairy / Item / Monster Ability 모두 가능한 한 동일한 Capability 구조를 사용한다.

```text
AbilityDefinition
identity
trigger
target
requirements
conditions
cost
operations[]
contract
failure
counterplay
presentation
```

능력의 출처만 다르다.

```text
Class
Item
Fairy
Monster
Region
Artifact
Aura
```

하지만 World에서는 모두 동일한 Ability Rule이다.

---

## 37. MMORPG 빌드와 연결

캐릭터의 전투 빌드는 단순히:

```text
Attack +10%
Critical +5%
```

의 조합으로 끝나지 않는다.

빌드는 다음 다섯 축의 조합이 된다.

```text
Skill Set
Response
Aura Profile
Contract
Equipment Capability
```

따라서 같은 Class라도:

### Build A

```text
Guard
BODY Aura
Counter 중심
```

### Build B

```text
Observe Response
AWARENESS Aura
Seal 중심
```

### Build C

```text
Absorb Response
ABILITY Aura
Stored Power 중심
```

으로 완전히 다른 전투가 가능하다.

---

## 38. PvE에서의 의미

Monster 역시 동일한 Rule 구조를 사용한다.

예:

### 거대 악마

```text
Contract-like Rule
눈이 열린 동안:
전방 모든 Ability 강화
눈이 닫혀 있는 동안:
Defense 강화
하지만 Awareness Capability 상실
```

플레이어는:

```text
패턴 관찰
        ↓
Rule 발견
        ↓
Aura 배분 변경
        ↓
Response 변경
        ↓
약점 이용
```

으로 싸운다.

단순히 빨간 바닥을 피하는 전투에서 벗어난다.

---

## 39. PvP에서의 의미

PvP의 핵심은:

```text
내 Build
vs
상대 Build
```

가 아니라

```text
내가 알고 있는 상대 Rule
vs
상대가 알고 있는 내 Rule
```

까지 확장된다.

따라서 정보가 전투의 일부가 된다.

강력한 능력일수록:

```text
Condition
Contract
Tell
Counterplay
```

가 중요하다.

---

## 40. 시각적 표현

상층 능력은 반드시 WorldState와 연결된 시각 표현을 가진다.

예:

```text
Bind
→ 실제 Chain Entity
Mark
→ Target 위 Symbol
Contract
→ Actor Aura Pattern
Aura Profile
→ Body / Ability / Awareness에 따라 다른 Aura 표현
Counter Opportunity
→ 매우 짧은 명확한 Feedback
ObservedSkill
→ Target Skill Icon 일부 공개
```

단순 UI Icon만으로 처리하지 않는다.

세계에서 발생한 변화는 가능하면 세계 자체에서 보인다.

---

## 41. 사용하지 않을 구조

다음 구조는 지양한다.

### 1. 실시간 Aura Slider

```text
Attack Aura 37%
Defense Aura 29%
Sight Aura 34%
```

→ 조작 부담.

### 2. 모든 Active Defense 별도 버튼

```text
Guard
Parry
Dodge
Counter
```

→ 모바일 입력 과부하.

### 3. Contract = Stat Penalty

```text
HP -10%
Damage +20%
```

만 반복.

→ 능력 다양성을 만들지 못함.

### 4. Ability = Damage + Debuff

모든 Skill이 결국 같은 구조로 수렴.

### 5. Counterplay 없는 강제 Rule

상대가 이해하거나 대응할 방법이 없음.

---

## 42. 점진 구현 순서

이 상층도 한 번에 구현하지 않는다.

### F1 — Response

```text
Active Response Slot
Guard
Evade
```

목표:

> 공격을 받는 순간 하나의 선택을 할 수 있다.

---

### F2 — Precision Response

```text
Response Window
Normal
Precision
```

목표:

> 타이밍 숙련이 전투 결과를 바꾼다.

---

### F3 — Opportunity / Counter

```text
Counter Opportunity
Skill Variant
```

목표:

> 좋은 방어가 새로운 공격 기회를 만든다.

---

### F4 — Aura Allocation

```text
BODY
ABILITY
AWARENESS
Aura Profile
```

목표:

> 전투 중 힘을 어디에 집중할 것인지 선택한다.

---

### F5 — Condition

```text
WorldState 기반 Condition
```

목표:

> 상황에 따라 능력의 가능 여부가 변한다.

---

### F6 — Contract

```text
Restriction
Permission
Violation
```

목표:

> 스스로 제약을 받아 새로운 Capability를 얻는다.

---

### F7 — World Operation

우선:

```text
Mark
Bind
Redirect
Observe
Seal
```

정도의 작은 Operation 집합으로 시작한다.

목표:

> Damage가 아닌 Ability가 실제 플레이에서 성립한다.

---

### F8 — Character Rule Ability

각 Character가:

```text
Response
Aura
Contract
World Operation
```

을 하나의 전투 정체성으로 사용한다.

이 단계부터 본격적으로 헌터×헌터식 전투를 확장한다.

---

## 43. 최초 검증용 Character 3종

상층 시스템의 검증은 대규모 Ability Catalog가 아니라 세 캐릭터면 충분하다.

### Guardian

검증:

```text
Guard
Precision Guard
Intercept
BODY Aura
```

---

### Observer

검증:

```text
Evade
Precision Observe
AWARENESS Aura
ObservedSkill
Seal
```

---

### Binder

검증:

```text
ABILITY Aura
Mark
Bind
Contract
Contract Violation
```

이 세 Character가 전혀 다른 전투를 만든다면 상층 구조가 성공한 것이다.

---

## 44. 성공 조건

Active Defense 성공 조건:

1. 모바일에서 Response 입력 하나만으로 사용할 수 있다.
2. Response하지 않아도 기본 MMORPG 전투는 정상적으로 가능하다.
3. Precision Response가 숙련의 분명한 보상을 제공한다.
4. Character에 따라 동일한 Response 입력이 다른 전투 능력을 표현할 수 있다.

Aura/Nen 성공 조건:

1. 전투 중 복잡한 수치 조작을 요구하지 않는다.
2. Aura Allocation 선택이 실제 행동 가능성을 변화시킨다.
3. Condition과 Contract가 강력한 Capability의 이유가 된다.
4. Damage 없이도 강력한 Skill을 만들 수 있다.
5. 강한 Ability에는 상대가 이해할 수 있는 Counterplay가 있다.
6. 모든 결과를 WorldState와 Combat Event로 설명할 수 있다.

---

## 45. 최종 전투 철학

기존 전투 하층은:

```text
무엇이 얼마나 강한가?
```

를 해결한다.

Active Defense는:

```text
공격을 받았을 때
나는 무엇을 할 것인가?
```

를 해결한다.

Aura는:

```text
지금 내 힘을 어디에 집중할 것인가?
```

를 해결한다.

Condition과 Contract는:

```text
나는 어떤 조건을 받아들이는 대신
무엇을 가능하게 만들 것인가?
```

를 해결한다.

World Operation은:

```text
그 능력이 실제 세계에서
무엇을 변화시킬 수 있는가?
```

를 해결한다.

따라서 완성된 전투는:

```text
               World State
                    ↓
             상대를 관찰한다
                    ↓
             Ability를 이해한다
                    ↓
              Aura를 배분한다
                    ↓
              공격을 시작한다
                    ↓
        상대가 Active Response 한다
                    ↓
           Opportunity가 생성된다
                    ↓
          Condition이 충족된다
                    ↓
            Contract가 작동한다
                    ↓
        World Capability가 실행된다
                    ↓
       Damage / Position / Relation /
       Action / Information이 변한다
                    ↓
             새로운 World State
```

가 된다.

이 구조에서 전투의 중심은 더 이상:

> **누가 더 높은 Damage를 가지고 있는가**

만이 아니다.

최종적으로는:

> **누가 상대의 능력을 더 잘 이해하고, 자신의 힘을 더 적절한 곳에 배분하며, 자신이 선택한 조건과 제약을 이용해 더 유리한 세계 규칙을 만들어내는가**

가 된다.

이것을 전투 상층의 최종 목표로 한다.

---

## 핵심 원칙

> **Active Defense는 버튼을 늘리지 않는다. Response의 의미를 늘린다.**
>
> **Aura는 게이지를 늘리지 않는다. 힘을 어디에 사용할 수 있는지를 결정한다.**
>
> **Contract는 단순 패널티가 아니다. 강력한 Capability를 허용하는 규칙이다.**
>
> **Skill 다양성은 Damage Modifier 개수로 만들지 않는다. World Operation의 종류와 그것을 발동시키는 조건의 조합으로 만든다.**
>
> **새로운 전투 상층은 기존 Damage Formula를 교체하지 않는다. 그 공식에 도달하기 전후의 세계 규칙을 풍부하게 만든다.**

이를 통해 기본 MMORPG 전투의 이해 가능성과 모바일 조작성을 유지하면서도, 최종적으로는 **각 캐릭터가 서로 다른 전투 법칙을 가진 MMORPG**까지 확장한다.
