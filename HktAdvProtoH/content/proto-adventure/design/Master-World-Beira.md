# 베이라 Master / Growth Graph

세계압·탐험·자원·전투 통합 설계

---

## 1. 게임의 핵심

Player는 특정 임무를 수행하기 위해 베이라에 파견된 사람이 아니다.
Player는 안전한 문명권에서 출발하여 자신의 목적과 방식으로 베이라를 탐험한다.

```yaml
MA-PLAYER:
  type: actor

  semantic: >
    안전한 문명권에서 출발하여 베이라를 탐험하고,
    발견한 세계 상태에 따라 자신의 Goal,
    해결 방법, 성장 경로를 선택하는 Actor.

  fixed_role: none
  fixed_class: none
  fixed_faction: none
  fixed_combat_style: none
```

Root Game Goal:

```text
ROOT GAME GOAL

베이라를 탐험한다.
```

보다 정확한 의미는 다음과 같다.

Player는 자신이 이해하고 대응할 수 있는 세계의 범위를 확장한다.

---

## 2. 베이라는 무엇인가

베이라는 단순히 위험한 생물이 많은 미개척 대륙이 아니다.
베이라는 인간 문명권보다 훨씬 높은 세계의 변화 가능성이 남아 있는 원초 생태권이다.

핵심 정의:

베이라는 높은 세계압으로 인해 생명·물질·환경이 인간 세계에서는 불가능한 상태까지 변화할 수 있는 원초 세계다.

따라서 베이라의 위험과 보물은 별개의 현상이 아니다.
둘은 동일한 세계 법칙에서 발생한다.

---

## 3. 세계압(World Pressure)

MW-WORLD-PRESSURE

세계압은 단순한 에너지나 Mana가 아니다.

세계압은:

세계가 생명과 물질에게 현재 상태를 넘어 변화할 수 있도록 만드는 가능성의 압력이다.

세계압이 높을수록:

```text
변화 가능성 증가
↓
환경의 극단화
↓
생존 압력 증가
↓
생명 / 물질의 극단적 적응
↓
인간의 상식으로는 불가능한 Property 발생
```

따라서 세계압은 동시에 두 가지를 만든다.

```text
WORLD PRESSURE
│
├─ DANGER
│
└─ POSSIBILITY
```

---

## 4. 낮은 세계압과 높은 세계압

세계압이 낮은 지역:

```text
WORLD PRESSURE LOW
↓
변화 가능성 낮음
↓
생명 / 물질의 상태가 안정적
↓
예측 가능한 생물학과 물리
↓
장기 정착 가능
↓
문명 발생
```

장점:

```text
안전
예측 가능
안정
재현 가능
```

하지만 동시에:

```text
극단적인 재생 없음
기적적인 소재 없음
초월적 생명 현상 없음
불가능한 Property 발생 가능성 낮음
```

즉 안전하지만 가능성의 폭이 좁다.

높은 세계압 지역:

```text
WORLD PRESSURE HIGH
↓
변화 가능성 증가
↓
극단적인 환경
↓
극단적인 생존 경쟁
↓
극단적인 적응
↓
인간 세계에서는 불가능한 Property 발생
```

따라서:

안전한 세계는 안정되어 있기 때문에 평범하고,
위험한 세계는 변화할 수 있기 때문에 기적적이다.

---

## 5. Free World Pressure와 Bound World Pressure

세계압을 두 상태로 구분한다.

### Free World Pressure

아직 특정 생명이나 물질의 안정된 Property로 고정되지 않은 세계압.

```text
FREE WORLD PRESSURE
↓
환경 변화
↓
생물 변화
↓
불안정한 생태
↓
새로운 적응 경쟁
```

이것이 주로 위험을 만든다.

### Bound World Pressure

생명이나 물질이 세계압에 적응하여 하나의 안정된 Property로 정착시킨 상태.

```text
BOUND WORLD PRESSURE
↓
특수 생물 기관
특수 식물
특수 광물
특수 소재
특수 Item Property
```

이것이 인간 입장에서 자원이 된다.

---

## 6. 위험과 자원의 관계

따라서 베이라의 가장 중요한 세계 법칙은 다음과 같다.

```text
높은 Free World Pressure
↓
극단적인 환경
↓
극단적인 생존 압력
↓
수많은 실패와 죽음
↓
일부 생명 / 물질이 적응 성공
↓
세계압을 안정된 Property로 고정
↓
Bound World Pressure
↓
인간 세계에서 불가능한 자원
```

즉:

위험과 보물은 같은 세계압의 서로 다른 결과다.

---

## 7. 왜 사람들은 베이라를 탐험하는가

문명권은 안전하지만 세계압이 낮다.
따라서 인간이 문명권 내부에서 아무리 기술을 발전시켜도 얻기 어려운 것들이 존재한다.

베이라에는 그것들이 자연적으로 존재할 가능성이 있다.

예:

```text
불치병을 치료하는 식물

신체를 원래 상태로 복원하는 생명

노화를 크게 늦추는 물질

엄청난 에너지를 저장하는 기관

기억을 물질에 보존하는 생물

공간적 파괴에도 손상되지 않는 광물

정신 간섭을 막는 생물 구조

인간이 만들 수 없는 무기 소재
```

따라서 인간에게 베이라는:

```text
가장 위험한 장소
AND
문명권의 한계를 넘어설 수 있는 장소
```

이다.

---

## 8. 대표 자원 — 회귀초

MW-HYPER-PREDATION

어떤 베이라 지역에서는 생명체가 일상적으로 치명적인 육체 손상을 입는다.

```text
극단적인 포식 경쟁
↓
신체 파괴 빈번
↓
일반적인 회복 속도로는 생존 불가능
```

일부 식물은 다른 방향으로 적응한다.

```text
상처를 빠르게 치료한다
```

가 아니라:

```text
안정되어 있던 이전 생체 상태를 유지한다.
```

방향으로 적응한다.

결과:

```text
MW-HYPER-PREDATION
↓
Extreme Survival Pressure
↓
Biological State Preservation
↓
회귀초
```

Capability:

```text
MC-RESTORE-BIOLOGICAL-STATE

생명체를 단순 치료하는 것이 아니라
최근의 안정적인 생체 상태에 가깝게 복원한다.
```

인간 문명에서는:

```text
치명상
장기 손상
절단
일부 질병
```

등 기존 의료의 한계를 넘어서는 자원이 될 수 있다.

---

## 9. 회귀초가 있는 곳이 위험한 이유

회귀초가 특별해서 위험한 지역에 있는 것이 아니다.

반대로:

그렇게 끔찍한 생태계였기 때문에 회귀초 같은 생물이 탄생할 수 있었다.

따라서:

```text
Extreme Danger
↓
Extreme Adaptation
↓
Extreme Resource
```

가 기본 인과다.

---

## 10. 대표 자원 — 경계결정

MW-SPATIAL-SHEAR

어떤 지역에서는 공간 자체의 경계가 반복적으로 어긋난다.

```text
공간 단층 발생
↓
일반 물질 파괴
↓
대부분의 물질 소멸
↓
특수한 구조를 가진 물질만 잔존
```

결국 공간 변화 속에서도 자신의 구조를 유지하는 광물이 형성된다.

```yaml
IP-BOUNDARY-STABLE:
  semantic: >
    주변 공간의 경계가 변화하더라도
    자신의 구조적 연속성을 유지한다.
```

이 광물로 무기를 제작하면:

```text
IT-BOUNDARY-BLADE
```

단순한:

```text
공격력 +1000
```

검이 아니라:

다른 물질의 구조적 연결을 절단하거나, 비정상적인 방어 구조에도 영향을 줄 수 있는 무기

가 될 수 있다.

---

## 11. 자원의 설계 원칙

모든 중요한 베이라 Resource에는 가능하면 다음 Trace가 존재해야 한다.

```text
World Pressure
↓
Environment
↓
Survival Pressure
↓
Adaptation
↓
Special Property
↓
Resource
```

따라서:

```text
BAD

전설의 약초가 필요하다.
↓
암흑대륙에 배치한다.
```

가 아니라:

```text
GOOD

극단적인 환경이 존재한다.
↓
특정 생명 적응이 발생한다.
↓
그 적응 결과 인간에게 기적적인 자원이 된다.
```

를 사용한다.

---

## 12. 위험과 보상의 통합

세계압이 높아질수록 단순히 위험만 증가하지 않는다.

```text
WORLD PRESSURE ↑
│
├─ Free Pressure 증가 가능
│   ↓
│   위험 증가
│
└─ 새로운 Bound Property 탄생 가능
    ↓
    희귀 자원 가능성 증가
```

따라서:

```text
더 깊은 베이라
=
더 위험한 세계

동시에

더 높은 변화 가능성
=
더 기적적인 발견 가능성
```

이다.

단, 모든 위험 지역이 반드시 가치 있는 Resource를 보장하지는 않는다.
세계압은 가능성을 증가시키지 Loot를 보장하지 않는다.

---

## 13. 인간 문명권이 안전한 이유

문명권은 세계압이 존재하지 않는 장소가 아니다.
세계가 이미 상대적으로 안정된 상태다.

```text
LOW FREE WORLD PRESSURE
↓
환경 변화 적음
↓
생태 변화 적음
↓
장기간 예측 가능
↓
문명 유지 가능
```

따라서 인간 문명은:

세계를 안전하게 만든 존재

가 아니라:

안정된 세계에서 발생할 수 있었던 생태적 결과

에 가깝다.

---

## 14. 안전권

MW-SAFE-FRONTIER

Player는 세계압이 낮고 안정적인 문명권에서 시작한다.

```text
SAFE FRONTIER

Low Free World Pressure
↓
Stable Ecology
↓
Civilization
```

가능한 활동:

```text
휴식
교역
제작
정보 획득
Actor 관계
전투 훈련
Item 거래
Growth Route 탐색
탐험 준비
```

---

## 15. Player는 왜 안전권 밖으로 나가는가

Player의 이유를 하나로 고정하지 않는다.
베이라가 가진 극단적인 가능성 때문에 수많은 Goal이 발생할 수 있다.

예:

```text
불치병 치료법을 찾는다.

희귀 소재를 찾는다.

전설적인 무기를 원한다.

알려지지 않은 생물을 발견한다.

새로운 Combat Capability를 얻는다.

특정 Actor를 찾는다.

돈을 번다.

강해지고 싶다.

새로운 Class Growth를 찾는다.

세계의 비밀을 알고 싶다.

자신만의 발견을 하고 싶다.
```

즉:

```text
ROOT

베이라를 탐험한다.
```

아래에 각 Actor와 상황마다 수많은 Local Goal이 생성된다.

---

## 16. 탐험 Loop

```text
SAFE WORLD
↓
Player chooses Goal
↓
EXPLORE
↓
UNKNOWN REGION
↓
DISCOVERY
↓
NEW WORLDSTATE
↓
LOCAL GOAL / GOAL REFRAME
↓
OPTIONS
↓
NEED
↓
CAPABILITY
↓
GROWTH / RESOURCE
↓
WORLD CHANGE
↓
Player can reach new region
↓
EXPLORE
```

---

## 17. Capability Gate와 Resource

베이라에서 얻은 Resource는 단순 판매용 Loot가 아니다.
Resource가 새로운 Capability 획득 Route가 될 수 있다.

예:

```text
독성 지역
↓
독 적응 생물 발견
↓
정화기관 획득
↓
MC-DETOXIFY 획득 가능
↓
더 강한 독성 지역 탐험 가능
```

또는:

```text
공간 단층 지역
↓
경계결정 발견
↓
Boundary Blade 제작
↓
MC-CUT-ABNORMAL-STRUCTURE
↓
기존에는 파괴할 수 없던 생물 / 구조 대응
```

따라서:

탐험에서 얻은 자원이 다음 탐험의 가능성을 연다.

---

## 18. Growth와 Resource 관계

Capability가 먼저 필요해져야 한다.

```text
Goal
↓
Possibility
↓
requires
↓
MC-DETOXIFY
```

그 다음 Growth Overlay에서:

```text
MC-DETOXIFY
▲
│
├─ learned_from → MA-TOXIN-SCHOLAR
│
├─ granted_by → IT-PURIFICATION-ORGAN
│
├─ granted_by → CL-???
│
└─ adapted_from → 특정 독성 환경
```

처럼 획득 Route를 찾는다.

Resource가 있다는 이유만으로 새로운 Capability를 억지로 만들지 않는다.

---

## 19. 탐험 깊이와 세계압

베이라의 기본 위험 Gradient:

```text
SAFE FRONTIER
↓
FRINGE
↓
WILD
↓
DANGER
↓
DEEP
↓
UNKNOWN
↓
?
```

일반적으로 깊어질수록 Free World Pressure가 높아진다.
하지만 정확한 수치적 거리 공식으로 만들 필요는 없다.
지역마다 Local WorldState가 다를 수 있다.

---

## 20. SAFE

```text
Low World Pressure

평범한 생태
예측 가능한 전투
기본적인 Resource
문명 유지 가능
```

주요 Capability:

```text
MC-ATTACK
MC-DEFEND
MC-EVADE
MC-REPOSITION
```

---

## 21. FRINGE

```text
조금 높은 변화 가능성
↓
강한 토착 포식자
```

필요:

```text
MC-OBSERVE
MC-PREDICT
MC-USE-TERRAIN
```

---

## 22. WILD

```text
특수 갑각
독
비정상적 감각
특수 이동
```

필요:

```text
MC-BREAK
MC-DISCOVER-WEAKNESS
MC-PRECISE-TARGETING
MC-CONTROL-SPACE
```

동시에 인간에게 가치 있는 특수 생물 소재가 본격적으로 등장한다.

---

## 23. DANGER

생물과 Environment를 독립적으로 볼 수 없다.

```text
Hazard
+
Creature
+
Terrain
```

필요:

```text
MC-READ-ENVIRONMENT
MC-FORCE-MOVEMENT
MC-USE-HAZARD
MC-INTERRUPT
```

Resource 역시 특정 환경 Property를 가지기 시작한다.

---

## 24. DEEP

인간의 전투 상식이 무너지기 시작한다.

예:

```text
극단적인 재생
신체 구조 변경
공생 Network
생체 영역
공격 Adaptation
```

필요:

```text
MC-DISCOVER-WEAKNESS
MC-DISRUPT-ABILITY
MC-MAINTAIN-PRESSURE
MC-TARGET-SPECIFIC-PART
MC-READ-CREATURE-SYSTEM
```

이곳부터 특히 강력한 Resource가 등장할 수 있다.

---

## 25. UNKNOWN

세계압이 생명과 물질뿐 아니라 인간이 추상적이라고 생각하는 영역까지 변화시킨다.

```text
기억
감각
인식
Identity
공간
관계
행동 Pattern
```

등이 생존 Resource가 될 수 있다.

예:

```text
기억을 먹는 생명

관찰자를 추적하는 생명

Identity를 빼앗는 생명

공간을 둥지로 사용하는 생명

죽음을 번식으로 이용하는 생명
```

필요:

```text
MC-PROTECT-PERCEPTION
MC-VERIFY-REALITY
MC-IDENTITY-ANCHOR
MC-RESIST-INFLUENCE
MC-BREAK-BIOLOGICAL-LINK
MC-ESCAPE-ALTERED-SPACE
```

그리고 이들의 적응 기관은 인간에게 상상을 초월하는 Resource가 될 수 있다.

---

## 26. 전투 역시 세계압에서 파생된다

전투 Creature를 먼저 만들지 않는다.

```text
World Pressure
↓
Environment
↓
Survival Pressure
↓
Creature Adaptation
↓
Creature Capability
↓
Player Encounter
↓
Goal
↓
Combat Possibility
↓
Player Capability Requirement
```

예:

```text
높은 충격 환경
↓
충격 저항 생태
↓
갑각 생물
↓
일반 Attack 비효율
↓
MG-OVERCOME-CREATURE
↓
MP-BREAK-DEFENSE
↓
requires MC-BREAK
```

---

## 27. 전투는 Goal이 아니다

일반적으로:

```text
BAD

Creature 발견
↓
MG-KILL-CREATURE
```

로 만들지 않는다.

대신:

```text
Creature가 자원을 지키고 있다.

Creature가 길을 막는다.

Creature가 Player를 사냥한다.

Creature를 관찰해야 한다.

Creature의 특정 기관이 필요하다.
```

같은 WorldState에서 Goal이 발생한다.

예:

```text
MG-ACQUIRE-RARE-ORGAN
│
├─ MP-KILL-CREATURE
├─ MP-TAKE-SHED-ORGAN
├─ MP-TRADE-WITH-ACTOR
├─ MP-FIND-DEAD-SPECIMEN
└─ MP-FORCE-CREATURE-TO-RELEASE
```

Combat은 그중 하나다.

---

## 28. 범용 Combat Graph

전투를 선택했을 경우:

```text
MP-DEFEAT-BY-COMBAT
│
├─ MP-OVERWHELM
├─ MP-READ-AND-PUNISH
├─ MP-BREAK-DEFENSE
├─ MP-EXPLOIT-WEAKNESS
├─ MP-CONTROL-MOVEMENT
├─ MP-OUTLAST
├─ MP-INTERRUPT
└─ MP-WEAPONIZE-ENVIRONMENT
```

여기에서 범용 Capability Requirement가 파생된다.

---

## 29. 위험과 보상을 하나의 Graph로 표현

```text
                    MW-WORLD-PRESSURE
                           │
                           ▼
               HIGH CHANGE POTENTIAL
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       FREE WORLD PRESSURE       ADAPTATION / BINDING
              │                         │
              ▼                         ▼
        ENVIRONMENT CHANGE        STABLE PROPERTY
              │                         │
              ▼                         ▼
       SURVIVAL PRESSURE             RESOURCE
              │                         │
              ▼                  ┌──────┼───────┐
         EXTREME ECOLOGY          ▼      ▼       ▼
              │                 Plant  Organ   Mineral
              ▼                           │
            DANGER                        ▼
              │                         ITEM
              │                           │
              └────────────┬──────────────┘
                           ▼
                       MA-PLAYER
                           │
                           ▼
                     GOAL / OPTIONS
                           │
                           ▼
                       CAPABILITY
                           │
                           ▼
                      MORE EXPLORE
```

---

## 30. Master의 상위 Root Cause

베이라 Graph의 최상위 인과는 다음을 기준으로 한다.

```text
MW-PRIMAL-WORLD
세계는 본래 높은 변화 가능성을 가진다.
│
▼

MW-WORLD-PRESSURE
세계압은 생명과 물질의
변화 가능성을 증가시킨다.
│
├────────────────────────────┐
│                            │
▼                            ▼

FREE PRESSURE            BOUND PRESSURE
│                            │
▼                            ▼
환경 변화                 안정된 Property
│                            │
▼                            ▼
생존 압력                  희귀 자원
│
▼
극단적인 적응
│
▼
위험한 생태
```

둘은 같은 Root에서 발생한다.

---

## 31. 왜 베이라를 탐험하는가

최종적으로 이 질문에 다음과 같이 답한다.

베이라는 인간이 살아가기에는 지나치게 변화가 큰 세계다.

그러나 바로 그 이유 때문에:

인간의 안정된 세계에서는 태어날 수 없는 생명, 물질, Property가 존재한다.

그래서 사람들은 베이라로 간다.

누군가는:

```text
병을 치료하기 위해
```

누군가는:

```text
부자가 되기 위해
```

누군가는:

```text
강해지기 위해
```

누군가는:

```text
새로운 무기를 얻기 위해
```

누군가는:

```text
세상에 존재하지 않던 것을 발견하기 위해
```

누군가는 단순히:

```text
저 너머에 무엇이 있는지 알고 싶어서
```

간다.

---

## 32. 게임 Progression

Progression은 단순히:

```text
Level 1
→ Level 20
→ Level 100
```

이 아니다.

핵심 Progression:

```text
UNKNOWN

↓

관찰한다.

↓

이해한다.

↓

대응 방법을 발견한다.

↓

Capability를 획득한다.

↓

Resource를 획득한다.

↓

새로운 Growth Route가 열린다.

↓

이전에는 갈 수 없던 곳에 간다.

↓

더 이상한 WorldState를 발견한다.

↓

UNKNOWN
```

---

## 33. Agent가 Resource를 설계할 때 반드시 묻는 질문

새로운 강력한 Resource를 만들 때:

### 1. 어디에서 발생했는가?

```text
어떤 WorldState인가?
```

### 2. 왜 그 Property가 필요한가?

```text
어떤 Survival Pressure에 대한 적응인가?
```

### 3. 무엇이 세계압을 고정했는가?

```text
식물?
생물 기관?
광물?
다른 구조?
```

### 4. 인간에게 왜 가치 있는가?

```text
문명권에서는 불가능한 어떤 문제를 해결하는가?
```

### 5. 그것을 얻기 위해 어떤 Gameplay가 발생하는가?

```text
Combat?
Exploration?
Observation?
Negotiation?
Harvest?
Craft?
```

### 6. 어떤 Capability를 열 수 있는가?

```text
새로운 지역이나 Possibility를 열 수 있는가?
```

---

## 34. 절대 피해야 할 Resource 설계

```text
BAD

엄청 좋은 약초
→ 암흑대륙에 배치
```

```text
BAD

전설 검
→ 심부 보스 Drop
```

```text
BAD

세계압이 높다
→ 아이템 등급이 높다
```

대신:

```text
World Pressure
↓
Environment
↓
Survival Pressure
↓
Adaptation
↓
Property
↓
Resource
↓
Player Possibility / Growth
```

를 추적한다.

---

## 35. 최종 세계관 정의

**세계압**

생명과 물질이 현재의 안정된 한계를 넘어 변화할 수 있도록 만드는 세계의 가능성 압력.

**Free World Pressure**

아직 안정된 Property로 고정되지 않아 환경과 생태를 계속 변화시키는 세계압.

**Bound World Pressure**

생명이나 물질의 특수한 Property로 안정적으로 정착한 세계압.

**베이라**

높은 Free World Pressure로 인해 극단적인 생태적 위험과 인간 세계에서는 존재할 수 없는 기적적인 자원이 동시에 발생하는 원초 생태권.

**안전한 문명권**

Free World Pressure가 낮아 생명과 환경의 변화 폭이 제한되고 장기적인 예측과 정착이 가능한 영역.

**탐험**

안정된 인간 세계에서는 얻을 수 없는 가능성을 찾아 더 높은 세계압의 영역으로 진입하는 행위.

**Growth**

그 과정에서 얻은 Knowledge / Capability / Item / Class / Adaptation을 이용해 이전에는 대응할 수 없던 세계에 대응 가능해지는 과정.

---

## 36. 세계관 핵심 문장

베이라는 위험하기 때문에 보물이 있는 곳이 아니다.

기적이 태어날 수 있을 정도로 세계가 자유롭게 변화하기 때문에 위험한 곳이다.

그리고 게임 전체를 대표하는 문장은 다음과 같다.

기적이 존재할 수 있는 세계는, 안전할 수 없다.
