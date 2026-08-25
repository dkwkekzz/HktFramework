# SYSTEM DESIGN DOCUMENT

## Damage Type — Physical / Aura

Combat Damage Type · 물리 / 오라 피해 분리

| **문서 버전** | R0 |
|---------------|----|
| **상태** | System Design Draft |
| **기반** | `Design-Combat-OffenseDefense-R0.md` C010 — Basic Attack / Defense Formula |
| **계획 층** | Damage Type (기본 문서 작성 시점의 계획 번호 C013) |
| **범위** | Physical Attack / Aura Attack / Armor / Resistance / Skill Damage Type |
| **작성 목적** | 하나의 기본 피해 공식을 보존하면서 공격과 방어의 준비 선택을 두 갈래로 만든다 |

> **핵심 명제**
> 스킬은 물리 또는 오라 중 하나의 방식으로 피해를 만들고, 대상은 그 방식에 맞는 방어 능력으로 피해를 줄인다.

# 0. 설계 방향

이 층의 목표는 속성 상성표를 만드는 것이 아니다.

C010에서 검증한 다음 관계를 두 피해 경로에 똑같이 적용한다.

```text
공격 능력이 높다 → 그 타입의 스킬이 더 아프다
대응 방어 능력이 높다 → 그 타입의 피해를 덜 받는다
```

Damage Type이 추가되면 플레이어는 전투 전에 다음을 판단할 수 있다.

```text
상대의 Armor가 높고 Resistance가 낮다
    → Aura 스킬이 상대적으로 유리하다

상대가 Aura 공격을 주로 사용한다
    → Resistance를 준비하면 더 오래 버틴다
```

그러나 틀린 타입을 골랐다는 이유만으로 공격이 무효가 되지는 않는다. 상성은 별도의 보너스·페널티 표가 아니라 **서로 다른 공격 능력과 방어 능력의 분포**에서만 생긴다.

# 1. 타입은 두 개만 둔다

```text
Physical
Aura
```

**Physical Damage**

무기, 신체, 투사체처럼 물리적인 충격이 만드는 피해다. `Physical Attack`으로 강해지고 대상의 `Armor`로 감소한다.

**Aura Damage**

오라, 마력 또는 그에 준하는 비물질적 힘이 만드는 피해다. `Aura Attack`으로 강해지고 대상의 `Resistance`로 감소한다.

`Magic`을 별도 세 번째 타입으로 만들지 않는다. 세계관에서 마법이라는 표현을 사용하더라도 계산 의미는 `Aura`에 포함한다. 이름을 늘리는 일은 실제로 다른 공격·방어 선택이 필요해진 뒤에 한다.

# 2. Actor의 전투 능력치

C010의 `Attack`과 `Defense`를 다음 네 값으로 분리한다.

```text
Physical Attack
Aura Attack
Armor
Resistance
```

| 능력치 | 의미 | 사용하는 피해 타입 |
|--------|------|---------------------|
| Physical Attack | 물리 스킬에 기여하는 공격 능력 | Physical |
| Aura Attack | 오라 스킬에 기여하는 공격 능력 | Aura |
| Armor | 물리 피해를 줄이는 방어 능력 | Physical |
| Resistance | 오라 피해를 줄이는 방어 능력 | Aura |

모든 값은 0 이상이다. 음수 방어로 피해를 증폭하는 규칙은 이 층에 넣지 않는다.

능력치 총합이나 장비 예산을 이 문서에서 고정하지 않는다. 다만 같은 성장 단계의 Actor가 네 값을 모두 최고로 가질 수 있게 만들면 타입 선택이 사라지므로, 콘텐츠와 장비는 보통 한쪽 공격 또는 한쪽 방어에 더 많이 투자하게 설계한다.

# 3. 스킬은 정확히 하나의 Damage Type을 가진다

모든 피해 스킬은 다음 값을 가진다.

```text
Skill Base Damage
Skill Attack Ratio
Skill Damage Type = Physical | Aura
```

한 번의 타격은 정확히 하나의 타입만 가진다.

```text
Sword Slash     Damage Type = Physical
Aura Bolt       Damage Type = Aura
```

한 타격을 물리 60% + 오라 40%처럼 나누지 않는다. 혼합 피해는 계산 경위와 방어 선택을 흐리고, 한 타격에 두 방어 공식을 동시에 적용하게 만든다. 혼합 표현이 필요하면 서로 다른 타입의 타격 이벤트 두 개로 명시적으로 설계하며, 이번 층에서는 그 기능도 구현하지 않는다.

Damage Type은 **스킬 정의의 속성**이다. 공격자의 장비나 대상의 상태가 타격 순간 임의로 타입을 바꾸지 않는다. 타입 전환 스킬이 미래에 필요하다면 각각 별개의 스킬 형태로 관찰 가능하게 정의한다.

# 4. 하나의 타입 대응표

피해 계산은 스킬 타입으로 사용할 공격 능력과 방어 능력을 고른다.

| Skill Damage Type | Offense Stat | Defense Stat |
|-------------------|--------------|--------------|
| Physical | Attacker.PhysicalAttack | Target.Armor |
| Aura | Attacker.AuraAttack | Target.Resistance |

이 표는 보너스 배율표가 아니다. 단지 C010 공식에 넣을 값을 선택하는 규칙이다.

# 5. 최종 피해 공식

C010의 공식 형태와 `Defense Constant = 100`을 유지한다.

```text
Offense Stat
    = Damage Type에 대응하는 공격자의 공격 능력

Defense Stat
    = Damage Type에 대응하는 대상의 방어 능력

Raw Damage
    = Skill Base Damage
    + Offense Stat × Skill Attack Ratio

Defense Multiplier
    = Defense Constant
    / (Defense Constant + Defense Stat)

Final Damage
    = round(Raw Damage × Defense Multiplier)
```

`Raw Damage > 0`이면 `Final Damage`의 최솟값은 1이고, `Raw Damage = 0`이면 최종 피해도 0이다. C010과 마찬가지로 방어 능력이 피해를 완전히 없애지 않게 하기 위해서다.

즉 타입별로 서로 다른 공식을 만드는 것이 아니라, **하나의 공식이 타입에 따라 입력 능력치만 선택한다.**

# 6. 계산 예시

공격자와 방어자의 상태가 다음과 같다고 하자.

```text
Attacker
    Physical Attack = 100
    Aura Attack     = 60

Target
    Armor           = 100
    Resistance      = 25
```

두 스킬의 Base Damage와 Attack Ratio는 같다.

```text
Sword Slash
    Type         = Physical
    Base Damage  = 50
    Attack Ratio = 1.0

Aura Bolt
    Type         = Aura
    Base Damage  = 50
    Attack Ratio = 1.0
```

**Sword Slash**

```text
Raw Damage   = 50 + 100 × 1.0 = 150
Final Damage = round(150 × 100 / (100 + 100)) = 75
```

**Aura Bolt**

```text
Raw Damage   = 50 + 60 × 1.0 = 110
Final Damage = round(110 × 100 / (100 + 25)) = 88
```

공격자의 Aura Attack이 더 낮아도 대상의 Resistance가 낮으므로 Aura Bolt가 더 큰 최종 피해를 낸다. 이것이 이 층이 만드는 준비 선택이다.

# 7. 소프트 상성 원칙

Damage Type의 상성은 선택을 만들되 결과를 지배하지 않아야 한다.

이를 위해 다음 원칙을 둔다.

1. **면역은 없다.** Armor나 Resistance가 높아도 양의 피해는 최소 1 남는다.
2. **타입 보너스 배율은 없다.** `Physical vs. Aura` 또는 무기별 가위바위보 표를 두지 않는다.
3. **잘못 고른 타입도 작동한다.** 차이는 대응 방어 능력의 값에서만 나온다.
4. **약점은 관찰 가능해야 한다.** 플레이어가 Armor와 Resistance 또는 그 차이를 알 수 있어야 선택에 원인이 생긴다.
5. **타입만으로 승패를 확정하지 않는다.** 스킬의 Base Damage, Ratio, 공격자의 능력치와 실행 성공은 계속 중요하다.

따라서 이 문서는 `DC-COMBAT-MATCHUP-SOFT`의 문안을 다음처럼 해석한다.

> 공격 형태와 방어 형태의 상성은 선택을 만들되 결과를 지배하지 않는다. 상성은 별도 피해 배율이 아니라 대응 공격·방어 능력치의 차이로 표현한다.

구판 Constraint의 `break_efficiency`는 이 층에 Break가 없으므로 채택하지 않는다. Break가 실제로 설계되는 층에서 다시 판단한다.

# 8. 결정론과 플레이어 인과

Damage Type은 난수를 추가하지 않는다.

```text
같은 공격자 능력치
+ 같은 스킬과 Damage Type
+ 같은 대상 방어 능력치
    → 항상 같은 Final Damage
```

타입은 스킬을 선택할 때 플레이어가 고르고, 공격의 성공 여부는 기존 `ACTION · SWING · COLLIDER · BODY` 접촉으로 정한다. 실제 접촉 뒤에 타입 대응표와 공식이 적용된다.

따라서 결과의 원인은 다음 순서로 설명할 수 있다.

```text
플레이어가 스킬을 선택함
    ↓
Swing Collider가 Body에 닿음
    ↓
스킬의 Damage Type이 공격/방어 능력치를 선택함
    ↓
하나의 공식이 Final Damage를 계산함
```

# 9. 기존 C010과의 관계 및 이행

Damage Type 층은 C010을 폐기하지 않고 일반화한다.

```text
C010
    Attack  → 공식의 Offense Stat
    Defense → 공식의 Defense Stat

Damage Type
    Physical이면 Physical Attack / Armor를 선택
    Aura이면 Aura Attack / Resistance를 선택
```

이행 시 기존 콘텐츠의 체감을 보존하기 위해 다음 규칙을 사용한다.

```text
기존 Attack  → Physical Attack
기존 Defense → Armor
기존 모든 피해 스킬 → Physical
```

`Aura Attack`과 `Resistance`의 초기값은 새 Aura 콘텐츠의 밸런스와 함께 명시한다. 기존 값을 기계적으로 복제하면 모든 Actor가 두 타입에 똑같이 강해져 선택이 생기지 않고, 0으로 일괄 설정하면 Aura가 과도하게 강해질 수 있으므로 구현 Cycle의 Balance가 실제 수치를 소유한다.

이행이 끝나면 의미가 중복되는 일반 `Attack`과 `Defense` 필드는 남기지 않는다. 호환 별칭을 영구히 유지하면 어느 값이 공식의 권위인지 모호해진다.

# 10. 관찰 계약

플레이어가 타입을 고를 수 있으려면 세계는 그 선택의 원인과 결과를 관찰 가능하게 해야 한다.

## Actor

```text
Physical Attack
Aura Attack
Armor
Resistance
```

자기 능력치는 항상 보여 준다. 상대의 Armor와 Resistance는 적어도 전투 전에 비교 가능한 값 또는 `물리에 강함 / 오라에 약함` 같은 세계가 계산한 표현으로 제공한다. View가 종류 이름으로 약점을 추측해서는 안 된다.

## Skill

```text
Damage Type
Base Damage
Attack Ratio
현재 사용자 능력치로 계산한 Raw Damage
```

## Strike Event / Damage Breakdown

```text
Damage Type
Offense Stat Name
Offense Stat Value
Base Damage
Attack Contribution
Raw Damage
Defense Stat Name
Defense Stat Value
Defense Multiplier
Final Damage
```

피해 숫자만 보여 주는 것으로는 선택을 학습할 수 없다. 어떤 타입이 어떤 방어에 의해 얼마나 줄었는지 같은 타격 기록에서 설명할 수 있어야 한다.

# 11. 신규 및 변경 INTENT

**INTENT-DAMAGE-TYPE-001**

피해를 만드는 스킬은 Physical 또는 Aura 중 정확히 하나의 Damage Type을 가진다.

Damage Type은 해당 타격의 계산에 사용할 공격 능력과 방어 능력을 결정한다.

---

**INTENT-TYPED-OFFENSE-001**

Actor는 Physical Attack과 Aura Attack을 가진다.

Physical Attack은 Physical 스킬에만, Aura Attack은 Aura 스킬에만 기여한다.

---

**INTENT-TYPED-DEFENSE-001**

Actor는 Armor와 Resistance를 가진다.

Armor는 Physical 피해를, Resistance는 Aura 피해를 C010의 감쇄식으로 줄인다. 대응하지 않는 타입의 피해에는 기여하지 않는다.

---

**INTENT-DAMAGE-CALCULATE-001 — CHANGED**

타격이 발생하면 세계는 스킬의 Damage Type에 대응하는 공격자의 공격 능력과 대상의 방어 능력을 선택한다.

세계는 선택한 두 값, 스킬의 Base Damage와 Attack Ratio를 C010에서 정한 하나의 공식에 적용하여 최종 피해를 결정한다.

계산 결과에는 난수가 개입하지 않는다.

---

**INTENT-DAMAGE-TYPE-OBSERVE-001**

세계는 Actor의 타입별 공격·방어 능력, 스킬의 Damage Type, 그리고 실제 타격에서 선택된 능력치와 계산 결과를 관찰 가능하게 제공한다.

# 12. 시스템 흐름

```text
스킬 시작
    ↓
Collider 활성화
    ↓
상대 Body와 충돌
    ↓
Skill Damage Type 읽기
    ↓
대응 Offense Stat / Defense Stat 선택
    ↓
Raw Damage 계산
    ↓
대응 Defense 적용
    ↓
Final Damage 계산
    ↓
HP 감소
    ↓
타입과 계산 경위를 Strike Event에 기록
    ↓
Hit Reaction / CP 처리
```

새 명중 판정, 충돌 판정 또는 Hit Reaction을 만들지 않는다.

# 13. 이 층에서 하지 않을 것

```text
Element (Fire / Ice / Lightning ...)
Elemental weakness / resistance table
Physical subtype (Slash / Pierce / Blunt)
Mixed or split damage in one hit
Damage immunity
Damage-over-time
Healing type
Critical
Accuracy / Miss / Dodge
Armor Penetration / Resistance Penetration
Guard / Perfect Guard / Block / Parry
Guard Break / Counter / Break efficiency
Damage type conversion during a hit
Aura allocation / Nen type / Condition / Vow
```

특히 관통은 다음 층의 책임이다. 이 문서에서는 Armor와 Resistance가 언제나 그대로 공식에 들어간다.

# 14. 수용 기준

Damage Type 층은 다음 조건을 모두 만족해야 한다.

1. Physical 스킬은 Physical Attack과 Armor만 읽는다.
2. Aura 스킬은 Aura Attack과 Resistance만 읽는다.
3. 모든 피해 스킬은 정확히 하나의 유효한 Damage Type을 가진다.
4. 두 타입 모두 C010과 같은 단 하나의 감쇄 공식을 사용한다.
5. 같은 상태와 같은 접촉은 언제나 같은 피해를 만든다.
6. Armor 변화는 Aura 피해를 바꾸지 않고, Resistance 변화는 Physical 피해를 바꾸지 않는다.
7. 양의 Raw Damage는 방어가 아무리 높아도 최소 1의 피해를 만든다.
8. 기존 콘텐츠를 Physical로 이행했을 때 이행 전 C010의 피해 결과가 유지된다.
9. 관찰 결과만으로 스킬 타입, 선택된 공격·방어 능력치, 최종 피해의 계산 경위를 설명할 수 있다.
10. 별도 타입 보너스, 관통, 면역, 혼합 피해가 숨어서 적용되지 않는다.

# 15. 이후 확장과의 경계

## Penetration

관통 층은 타입 대응이 끝난 뒤 선택된 방어 능력에만 작용한다.

```text
Physical → Armor Penetration → Effective Armor
Aura     → Resistance Penetration → Effective Resistance
```

관통이 Damage Type을 바꾸거나 대응하지 않는 방어 능력을 읽어서는 안 된다.

## Active Defense

Guard, Perfect Guard, Counter는 타격에 기록된 Damage Type을 읽을 수 있지만 이 문서는 그 효율을 정하지 않는다. 능동 방어는 접촉·시각·자원 같은 플레이어 행동의 결과를 별도 층으로 추가해야 한다.

## Aura / Nen

미래의 오라 배분은 `Aura Attack`이나 `Resistance`를 변화시킬 수 있다. 그러나 조건·제약·서약의 비용과 상한은 Aura/Nen 층이 소유하며, 여기의 타입 대응표나 기본 피해 공식을 대체하지 않는다.

# 16. World of Warcraft와의 비교

이 설계는 MMORPG의 대표 사례인 **World of Warcraft(이하 WoW)** 와 닮은 부분이 있지만,
WoW의 규칙을 그대로 옮긴 것은 아니다. WoW는 버전(Retail / Classic)과 확장팩에 따라
세부 규칙이 크게 달라지므로, 여기서는 오랫동안 유지된 구조적 특징과 이 문서의 결정을
비교한다.

## 16.1 닮은 점

### 방어가 모든 피해를 똑같이 줄이지 않는다

WoW에서 Armor의 대표적인 역할은 Physical 피해를 줄이는 것이다. 마법 계열 피해는 Armor가
아닌 별도의 규칙과 효과로 다뤄진다. 따라서 이 문서의 다음 분리는 WoW식 사고와 같은 방향이다.

```text
Physical Damage → Armor
Aura Damage     → Resistance
```

즉 "Defense 하나가 모든 피해를 줄인다"에서 "피해의 학교에 맞는 방어만 읽는다"로
넘어가는 것이 Damage Type 층의 핵심이라는 점은 타당하다.

### 스킬이 자신의 피해 학교를 안다

WoW의 주문과 능력은 Physical, Holy, Fire, Nature, Frost, Shadow, Arcane 같은 Damage School을
가진다. 전투 규칙과 전투 기록은 이 학교를 사용하여 어떤 감쇄·면역·효과가 적용되는지
판단한다. 이 문서의 `Skill Damage Type`도 같은 책임을 더 작은 두 타입으로 수행한다.

### 스킬 계수와 캐릭터 능력을 함께 사용한다

WoW의 능력도 스킬마다 Attack Power 또는 Spell Power 등에 대한 서로 다른 계수를 가질 수 있다.
따라서 `Base Damage + Offense Stat × Attack Ratio`로 스킬 자체의 성격과 Actor 성장을 분리하는
C010 구조는 WoW를 참고해도 자연스럽다.

### Combat Log가 결과의 경위를 전달한다

WoW의 Combat Log는 단순히 HP가 줄었다는 사실만이 아니라 피해 학교와 실제 피해, 흡수·저항·
막힘 같은 결과를 구분한다. 이 문서가 `Strike Event / Damage Breakdown`에 Damage Type,
선택된 능력치와 감쇄 결과를 싣는 것도 같은 이유로 필요하다.

## 16.2 WoW와 다른 점

### WoW는 두 타입보다 더 많은 Damage School을 가진다

WoW의 기본 학교는 Physical 하나와 여러 마법 학교로 나뉘며, 현대 규칙에는 둘 이상의 학교를
동시에 만족하는 복합 학교도 있다. 반면 이 문서는 첫 구현을 `Physical | Aura` 두 개와
단일 타입 타격으로 제한한다.

이는 누락이 아니라 의도적인 축소다. Fire와 Frost를 나눠도 서로 다른 준비 선택이나 세계 규칙이
없다면 이름만 늘어난다. Element와 복합 학교는 실제 플레이 차이가 요구될 때 별도 층에서 추가한다.

### WoW Retail에는 보편적인 Magic Resistance 한 줄이 없다

WoW Classic 계열은 마법 학교별 Resistance와 부분 저항의 영향을 강하게 받았지만, Retail의
일반적인 캐릭터 방어는 `Armor 대 Physical / 하나의 Magic Resistance 대 모든 마법`이라는
완전한 대칭 구조가 아니다. 주문별 피해 감소, 흡수, 면역, Versatility 같은 여러 규칙이
마법 피해 생존에 관여한다.

따라서 이 문서의 `Resistance`는 WoW Retail을 복제한 능력치가 아니다. 이 프로젝트가 작은
프로토타입에서 물리 빌드와 오라 빌드의 준비 선택을 만들기 위해 채택한 **통합 오라 방어 능력치**다.
향후 오라 학교를 세분할 때도 `Resistance`를 무조건 학교별 저항으로 복제하지 않고 실제 장비·
전투 선택이 생기는지 먼저 검증한다.

### WoW의 Armor 공식은 대상과 레벨 문맥을 가진다

WoW의 Armor 감쇄는 고정된 `100 / (100 + Armor)` 하나로 모든 성장 구간을 처리하지 않는다.
레벨과 콘텐츠 스케일에 대응하는 상수가 포함되어, 같은 Armor 값의 효율이 문맥에 따라 달라질 수 있다.

이 프로젝트에는 아직 전투 레벨이 없으므로 `Defense Constant = 100`을 유지하는 것이 맞다.
다만 레벨 성장이 추가될 때는 Damage Type을 늘리는 대신 다음 형태로 상수의 소유권을 확장한다.

```text
Defense Constant = World가 공격자 레벨과 콘텐츠 구간으로 정하는 값
```

그 경우에도 Physical과 Aura가 서로 다른 임의 공식을 갖지 않고 같은 감쇄 함수와 명시적인
세계 상수를 사용하는 원칙은 유지한다.

### Damage School과 공격 능력은 개념적으로 같은 것이 아니다

WoW를 참고할 때 가장 주의할 점이다. Damage School은 주로 **어떤 방어와 효과가 반응하는가**를
정하고, Attack Power / Spell Power 계수는 **어떤 공격 능력이 피해를 키우는가**를 정한다.
두 축은 흔히 함께 움직이지만 개념적으로는 분리되어 있다.

이 문서의 첫 구현은 단순함을 위해 둘을 다음처럼 묶는다.

```text
Physical Type → Physical Attack으로 성장 → Armor로 감쇄
Aura Type     → Aura Attack으로 성장     → Resistance로 감쇄
```

따라서 이것은 의도적인 제약이지 Damage Type의 보편 법칙이 아니다. 향후 "Aura Attack으로
강해지는 물리 충격"이나 "Physical Attack으로 강해지는 오라 검기"가 실제 빌드 선택을 만든다면,
스킬에 `Scaling Stat`을 별도 필드로 분리할 수 있다.

```text
Damage Type  = 어떤 방어가 반응하는가
Scaling Stat = 어떤 공격 능력이 기여하는가
```

그 확장 전까지는 예외 스킬을 하드코딩하지 않는다. 예외 하나 때문에 축을 먼저 분리하면 현재의
관찰·밸런스 비용만 늘어난다.

## 16.3 WoW를 참고해 더 구체화한 구현 규칙

비교 결과, 구현 Cycle은 다음 사항을 명시해야 한다.

1. **타입과 표시 이름을 분리한다.** 내부 Domain은 `physical | aura`로 고정하되 View가
   `물리 / 오라`를 세계가 제공한 표시 값으로 보여 준다.
2. **스킬 정의 누락을 허용하지 않는다.** 기존 스킬 이행 중에만 `physical`을 채우며,
   런타임에서 누락된 타입을 조용히 Physical로 간주하지 않는다.
3. **타입은 타격 생성 시 확정한다.** 지연 투사체나 지속 효과가 미래에 생겨도 어느 시점의
   스킬 정의를 썼는지 Strike Event가 명확히 소유해야 한다.
4. **피해 경위의 단계 이름을 고정한다.** `rawDamage → defenseMultiplier → finalDamage`를
   기록하고, 미래의 `absorbed / blocked / resisted`는 실제 규칙이 생긴 뒤 별도 단계로 추가한다.
5. **Resistance를 저항 확률로 해석하지 않는다.** 현재 Resistance는 Aura 피해에 쓰는
   결정론적 diminishing-return 방어 값이며, WoW Classic식 확률·부분 저항은 범위 밖이다.
6. **학교별 색상은 의미의 출처가 아니다.** View의 색이나 이펙트가 아니라 세계가 보낸
   Damage Type이 계산과 전투 기록의 권위다.
7. **NPC도 같은 계약을 사용한다.** 플레이어와 NPC 사이에 별도의 피해 타입 공식이나 숨은
   마법 감쇄를 두지 않는다.

## 16.4 비교 결론

현재 설계는 WoW와 정확히 같은 방식은 아니지만, 다음 골격은 검증된 MMORPG 구조와 일치한다.

```text
스킬이 피해 학교를 가진다
    → 학교에 대응하는 방어 규칙을 고른다
    → 스킬 계수와 Actor 능력으로 피해를 계산한다
    → Combat Log에서 타입과 감쇄 결과를 설명한다
```

다만 WoW를 더 가깝게 따른다는 이유만으로 지금 Fire/Frost/Shadow, 학교별 Resistance,
복합 학교, 부분 저항을 추가해서는 안 된다. 이 프로젝트에는 먼저 `Physical / Aura` 두 선택이
실제 장비·스킬 준비 차이를 만드는지 검증하는 것이 맞다.

# 17. 설계 요약

```text
Damage Type = Physical | Aura

Physical:
    Physical Attack → Armor

Aura:
    Aura Attack → Resistance

Raw Damage
    = Base Damage + 대응 Attack × Attack Ratio

Final Damage
    = round(Raw Damage × 100 / (100 + 대응 Defense))
```

이 층이 추가하는 것은 공식 두 개가 아니라 **선택 하나**다.

> 무엇으로 공격했는가에 따라, 이미 검증된 하나의 공식이 어떤 공격 능력과 어떤 방어 능력을 읽을지가 달라진다.
