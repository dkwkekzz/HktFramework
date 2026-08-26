# 베이라 요정 클래스 상세 설계

## Layer 0 — Origin Class

---

## 1. Layer 방식

클래스 성장은 단순한 직업 승급이 아니라 **기존 원리에 새로운 원리가 결합되는 과정**으로 정의한다.

```text
Layer 0
기초 Principle
→ Origin Class

Layer 1
기초 Principle + 새로운 Principle A
→ Advanced Class A

또는

기초 Principle + 새로운 Principle B
→ Advanced Class B
```

따라서 하나의 Class에서 반드시 하나의 다음 Class만 나오는 것은 아니다.

```text
                ┌─ Principle A → Class A
Origin Principle
                ├─ Principle B → Class B
                └─ Principle C → Class C
```

그러나 새 Class는 기존 Class를 버리지 않는다.

```text
새 Class
=
이전 Class의 모든 핵심 Capability
+
새로운 Principle
+
새로운 전투 Rule
+
새로운 Exploration Capability
+
새로운 외형
```

Class Change가 이전 형태를 기반으로 상위 형태를 만든다는 기존 원칙을 그대로 따른다.

이번 Layer에서는 다음 6개의 Origin Class만 완성한다.

| 계열       | Principle | Origin Class  | 한 문장 판타지                                    |
| ---------- | --------- | ------------- | ------------------------------------------------ |
| 백왕계     | 결속      | **골완투사**  | 힘을 몸과 무기에 결속해 무엇이든 정면에서 부순다 |
| 역락계     | 방향      | **역락검사**  | 자신의 낙하와 운동 방향을 바꾸며 전장을 질주한다 |
| 태양심계   | 축적      | **열술사**    | 주변의 열을 빼앗아 저장하고 거대한 화력으로 돌려준다 |
| 진명계     | 정체성    | **명각사**    | 존재를 읽고 이름을 새겨 그 존재의 규칙을 이용한다 |
| 숨결계     | 대기      | **숨결술사**  | 공기가 없는 곳에도 자신의 전장을 만들어낸다     |
| 맥동계     | 공명      | **맥동사**    | 살아 있는 대지와 생명에 자신의 박동을 연결한다   |

---

## 2. Origin Class 전투 공통 구조

각 Origin Class는 다음 요소를 가진다.

```text
Basic Attack
Skill 1
Skill 2
Skill 3
Skill 4
Active Response
Class Mechanic
Ultimate
```

전투 중 별도의 Guard / Dodge / Parry / Counter 버튼을 계속 추가하지 않는다.

모든 캐릭터는 하나의 `Response` 입력을 가지며, **Class에 따라 같은 Response 버튼이 전혀 다른 행동을 수행한다.**

```text
백왕계 → Brace
역락계 → Reverse Step
태양심계 → Thermal Release
진명계 → Observe
숨결계 → Air Cushion
맥동계 → Resonance
```

Response는 일반적인 생존 필수가 아니라 숙련에 대한 보상이다.

```text
Normal Response
→ 안정적인 기본 효과

Precision Response
→ 캐릭터 고유 Opportunity 발생
```

이는 Active Defense를 필수 패링 미니게임이 아니라 캐릭터 능력의 표현 통로로 사용한다는 전투 원칙을 따른다.

Aura 역시 실시간 수치 배분을 사용하지 않는다.

```text
BODY
ABILITY
AWARENESS
```

세 방향을 기반으로 몇 개의 의미 있는 Profile만 사용한다.

Origin Class에서는 복잡한 Contract를 주력으로 사용하지 않는다.

대신:

```text
단순한 Requirement
단순한 Condition
명확한 World Operation
명확한 Counterplay
```

를 먼저 갖춘다.

상위 Layer로 올라갈수록 이것들이 Contract와 복합 Rule Ability로 발전한다.

---

## 3. 백왕계 요정

### Origin Class — 골완투사

#### 3.1 정체성

##### Principle

**결속**

세계압을 자신의 육체와 무기에 강하게 결속한다.

백왕의 골격이 과도한 세계압을 하나의 육체에 붙잡아 두었던 것과 동일한 현상을 작은 인간형 육체에서 일으킨다.

##### Character Fantasy

> **"작은 체구의 괴력이 아니라, 단련된 육체와 거대한 무기로 정면에서 모든 것을 밀어붙이는 소녀."**

빠르거나 화려하지 않다.

상대가 거대할수록 오히려 이 캐릭터의 존재감이 커진다.

```text
막는다.
버틴다.
밀어낸다.
들어 올린다.
부순다.
```

가 플레이의 핵심이다.

---

#### 3.2 개성

성격은 직선적이고 담백하다.

복잡한 술수보다 직접 확인하는 것을 좋아한다.

```text
문이 잠겼다.
→ 부술 수 있는지 본다.

괴물이 길을 막는다.
→ 밀어낼 수 있는지 본다.

동료가 위험하다.
→ 자신이 앞에 선다.
```

다만 무모한 광전사는 아니다.

자신이 **얼마나 버틸 수 있는가를 정확히 아는 육체적 자신감**이 캐릭터의 성격을 만든다.

---

#### 3.3 무기

##### 왕골봉

백왕의 골편을 심재로 사용한 굵고 짧은 대형 봉.

```text
타격
받치기
밀어내기
지렛대
고정
투척
```

을 모두 수행한다.

검처럼 정교한 무기가 아니라 **힘이라는 캐릭터 판타지를 확대하는 도구**다.

탐험에서도 동일한 무기를 사용한다.

---

#### 3.4 전투 역할

```text
근거리 Bruiser
+
Front Line
+
Stagger / Displacement
```

주요 World Operation:

```text
Damage
Push
Fix
Break
Store
Release
```

---

#### 3.5 Class Mechanic — 왕골격

골완투사의 핵심은 `결속력`이다.

강한 충격을 받아내거나 직접 힘을 가할수록 몸과 왕골봉에 세계압이 결속된다.

```text
강한 공격을 Guard
강한 적과 힘겨루기
Heavy Attack 적중
구조물 파괴
↓
Bound Force 증가
```

Bound Force는 단순 공격력 버프가 아니다.

특정 스킬의 행동 가능성을 확장한다.

```text
Bound Force 0
→ 일반 밀치기

Bound Force 1
→ 대형 적 밀치기 가능

Bound Force 2
→ 자세 붕괴 가능

Bound Force MAX
→ 왕골해방 가능
```

---

#### 3.6 Active Response — 버티기

##### Normal

왕골봉을 지면 또는 자신의 몸에 고정한다.

```text
Incoming Damage 감소
Knockback 저항
```

##### Precision

충격을 흘려보내지 않고 그대로 결속한다.

```text
피해 대폭 감소
+
Bound Force 획득
+
상대에게 Balance Opportunity
```

즉 좋은 방어가 다음 공격을 가능하게 한다.

---

#### 3.7 전투 Skill

##### Basic — 골쇄연격

왕골봉을 짧고 강하게 휘두르는 기본 연계.

빠른 연속타보다 타격 하나하나의 중량감이 중요하다.

---

##### Skill 1 — 백왕철추

왕골봉을 머리 위에서 내려찍는다.

```text
Damage
+
Stagger
```

Bound Force가 충분하면:

```text
Stagger
→ Posture Break
```

로 발전한다.

---

##### Skill 2 — 골주박기

왕골봉을 지면에 박아 자신의 위치를 고정한다.

```text
Fix Self Position
+
Knockback Resistance
```

보스의 돌진이나 환경 압력에 맞서기 위한 기술이다.

---

##### Skill 3 — 왕골밀기

왕골봉으로 대상을 걸어 몸 전체로 밀어낸다.

```text
Push
```

대형 대상에게는 충분한 Bound Force가 필요하다.

---

##### Skill 4 — 압축파쇄

현재 Bound Force 일부를 소비해 짧은 충격파를 발생시킨다.

```text
Bound Force Consume
↓
Area Stagger
+
Break
```

---

#### 3.8 Ultimate — 왕골해방

지금까지 결속한 힘을 한 번의 공격으로 방출한다.

```text
Stored Force
↓
왕골봉
↓
Target
↓
Ground
```

대상의 HP만 깎는 기술이 아니다.

강한 적일수록:

```text
Position 붕괴
Posture 붕괴
주변 구조물 파괴
```

가 함께 발생한다.

---

#### 3.9 Aura

##### 기본 성향

**BODY**

```text
BODY
→ 결속 가능한 충격 증가
→ Guard 안정성 증가
→ 더 큰 대상과 힘겨루기 가능
```

##### ABILITY

왕골격과 방출 능력을 강화한다.

##### AWARENESS

구조물의 하중점이나 거대 생물의 균형점을 파악한다.

---

#### 3.10 Counterplay

백왕계는 강하지만 반드시 힘을 **받아내거나 접촉해야 한다.**

따라서 상대는:

```text
거리 유지
약한 연속 공격으로 Response 소모
강한 공격을 일부러 주지 않음
고정되지 않은 지형에서 싸움
```

등으로 왕골격 축적을 방해할 수 있다.

---

#### 3.11 모험

##### World Action 1 — 괴력

```text
거대 바위 이동
문 강제 개방
쓰러진 나무 이동
대형 장치 회전
```

##### World Action 2 — 지지

```text
붕괴 구조물 지탱
거대 생물의 움직임 저지
압력문 고정
```

##### Passive — 세계압 내성

강한 압력이나 하중이 존재하는 지역을 다른 캐릭터보다 안정적으로 통과한다.

---

#### 3.12 Class Mastery

다음 행동이 성장으로 직접 이어진다.

```text
강한 공격을 정면에서 받아냄
자신보다 큰 적을 밀어냄
무거운 세계 개체 이동
붕괴를 막음
환경 압력을 버팀
```

---

#### 3.13 외형

##### 체형

건강하고 운동성이 느껴지는 균형 잡힌 체형.

근육을 과장하지 않지만:

```text
어깨
등
허벅지
종아리
```

에 실제 힘을 사용할 수 있는 단단한 인상이 있다.

##### 실루엣

```text
중형 체격
+
굵은 왕골봉
+
허리와 어깨의 백골 장식
```

##### 색

```text
상아백
회백색
짙은 갈색
검은 세계압 문양
```

##### 전투 연출

힘이 축적될수록:

```text
몸의 문양
→ 왕골봉
→ 등 뒤
```

순서로 백색 골격 형태의 Aura가 이어진다.

MAX 상태에서는 등 뒤에 백왕의 갈비뼈를 연상시키는 짧은 잔상이 나타난다.

---

## 4. 역락계 요정

### Origin Class — 역락검사

#### 4.1 정체성

##### Principle

**방향**

속도가 빠른 것이 아니다.

**자신에게 작용하는 아래쪽과 운동의 방향을 바꾼다.**

기존 역락계의 핵심은 자신 → 적 → 투사체 → 공간으로 방향 제어 범위가 성장한다는 것이다. Origin에서는 우선 **자신의 방향**을 지배한다.

##### Character Fantasy

> **"전장이 바닥 하나로 이루어져 있다고 생각하지 않는 검사."**

```text
바닥
벽
천장
공중
적의 등 뒤
```

가 모두 동일한 이동 공간이다.

---

#### 4.2 개성

가만히 서 있는 것을 싫어한다.

직선보다 우회로를 좋아하고, 무언가를 보면 가장 먼저:

> "저기까지 어떤 방향으로 갈 수 있을까?"

를 생각한다.

싸움에서도 적의 정면보다 **적이 예상하지 않은 방향** 자체를 찾는다.

---

#### 4.3 무기

##### 역락도

한손 곡검.

질주하면서 베고 즉시 방향을 전환하기 쉽도록 짧고 가볍다.

칼 자체가 능력의 근원은 아니다.

**방향 전환 직후 만들어지는 운동량을 타격으로 전달하기 위한 도구**다.

---

#### 4.4 전투 역할

```text
Mobile DPS
+
Position Exploit
+
Trajectory Control
```

주요 Operation:

```text
Move
Change Direction
Push
Redirect
Target Position Exploit
```

---

#### 4.5 Class Mechanic — 연속낙하

방향 전환 이후 일정 시간 안에 다시 방향을 바꾸면 `Flow`가 유지된다.

```text
Direction Change
↓
이동
↓
Attack
↓
Direction Change
↓
Flow 유지
```

Flow가 높을수록 새로운 이동 연결이 열린다.

멈추면 빠르게 사라진다.

---

#### 4.6 Active Response — 역보

공격이 도달하기 직전 자신의 낙하 방향을 옆으로 바꾼다.

##### Normal

```text
짧은 방향 이동
+
공격 판정 이탈
```

##### Precision

```text
회피
+
Flow 유지
+
공격자의 측면 또는 후방으로 이동할 수 있는 Direction Opportunity
```

---

#### 4.7 Skill

##### Basic — 유선검

이동 방향을 따라 베는 기본 공격.

정지 상태보다 이동 중 사용할 때 자연스럽게 다음 행동과 이어진다.

---

##### Skill 1 — 낙선

지정한 방향을 새로운 아래쪽으로 삼아 순간 가속한다.

```text
Change Self Direction
+
Dash
```

---

##### Skill 2 — 벽천보

벽 또는 천장을 일정 시간 새로운 지면으로 사용한다.

```text
Surface Traversal
```

전투와 탐험에서 동일하게 사용한다.

---

##### Skill 3 — 반류

접촉한 소형 투사체의 진행 방향을 비튼다.

Origin 단계에서는 자유로운 조작이 아니라:

```text
좌
우
상
하
```

정도의 큰 방향 전환만 가능하다.

---

##### Skill 4 — 천락참

현재 낙하 방향으로 강하게 가속하며 베어 내려간다.

낙하 거리가 길수록 공격 자체가 아니라 **충돌 Momentum**이 강해진다.

---

#### 4.8 Ultimate — 역락연무

짧은 시간 동안 여러 번의 Self Direction Change를 연속 사용한다.

```text
바닥
→ 벽
→ 천장
→ 공중
→ Target
```

하나의 긴 연속 공격으로 연결한다.

---

#### 4.9 Aura

##### 기본

**BODY**

가속과 방향 변화에 육체가 견딜 수 있게 한다.

##### ABILITY

더 급격한 방향 전환과 공중 사용을 가능하게 한다.

##### AWARENESS

```text
투사체 궤적
적의 돌진 방향
낙하 경로
```

를 더 일찍 읽는다.

---

#### 4.10 Counterplay

역락검사는 계속 움직여야 강하다.

따라서:

```text
좁은 공간
이동 경로 봉쇄
Surface 제거
광범위 Zone
Flow 끊기
```

에 취약하다.

---

#### 4.11 모험

```text
벽 달리기
천장 이동
상향 폭포 탑승
절벽 우회
낙하 방향 변경
멀리 있는 장치에 투사체 반사
```

##### Passive — 방향감각

지역의 중력 방향이나 비정상적인 낙하 흐름을 시각적으로 감지한다.

---

#### 4.12 Mastery

```text
이동을 끊지 않고 전투
연속 방향 변경
공중 전투
투사체 방향 전환
비정상 중력 지역 통과
```

---

#### 4.13 외형

가볍고 길게 흐르는 실루엣.

```text
짧은 상의
얇은 다리 방어구
긴 리본
곡검
비대칭 장식
```

리본과 머리카락은 현재 중력 방향을 보여주는 중요한 시각 장치다.

색은:

```text
청백색
남색
밝은 청록
```

방향 전환 순간 발밑에 짧은 화살촉형 Aura가 나타난다.

---

## 5. 태양심계 요정

### Origin Class — 열술사

#### 5.1 정체성

##### Principle

**축적**

태양심계는 주변의 열을 빼앗아 내부에 저장하고, 포화된 힘을 다시 방출한다.

##### Character Fantasy

> **"싸울수록 전장이 차가워지고 자신은 태양처럼 뜨거워진다."**

---

#### 5.2 개성

평상시에는 느긋하고 차분하다.

힘을 즉시 쓰기보다 모으는 것을 좋아한다.

그러나 충분히 축적된 순간에는 행동과 표정이 급격히 공격적으로 변한다.

캐릭터의 성격 자체가:

```text
저온
→ 안정

축적
→ 흥분

과충전
→ 폭발
```

의 리듬을 가진다.

---

#### 5.3 무기

##### 태양심장

검은 결정체가 박힌 짧은 마도 지팡이.

열을 모으고 방향성 있게 방출하기 위한 Focus 역할을 한다.

---

#### 5.4 전투 역할

```text
Resource Mage
+
Drain
+
Burst
+
Area Control
```

주요 Operation:

```text
Drain
Store
Transfer
Slow
Create Zone
Release
```

---

#### 5.5 Class Mechanic — Heat Gauge

```text
주변 열 흡수
적의 열 흡수
Skill 흡수
↓
Heat Gauge 상승
```

낮으면 안전하지만 약하다.

높으면 강력하지만 과열 위험이 생긴다.

```text
COLD
STABLE
HOT
OVERHEAT
```

네 상태로 읽을 수 있다.

---

#### 5.6 Active Response — 열방출

저장된 열을 순간적으로 외부로 폭발시켜 공격을 밀어낸다.

##### Normal

```text
Heat 소비
+
Damage 감소
```

##### Precision

근접 공격일 경우 순간적인 열교환이 발생한다.

```text
Damage 감소
+
Target Heat Drain
+
Heat Gauge 회복
```

---

#### 5.7 Skill

##### Basic — 열탄

작은 압축 열탄을 발사한다.

---

##### Skill 1 — 냉취

대상으로부터 열을 빼앗는다.

```text
Drain Heat
+
Target Slow
+
Heat Gauge Gain
```

---

##### Skill 2 — 태양탄

Heat Gauge를 소비하여 고열 투사체를 발사한다.

---

##### Skill 3 — 냉각장

주변 열을 지속적으로 흡수하는 작은 영역을 만든다.

```text
Create Zone
+
Heat Drain
```

영역 안의 적은 점차 느려진다.

---

##### Skill 4 — 열광선

축적한 열을 좁은 직선으로 방출한다.

Heat가 높을수록 사거리보다 **지속시간과 관통 가능한 대상**이 증가한다.

---

#### 5.8 Ultimate — 일심폭발

현재 저장한 대부분의 Heat를 순간 방출한다.

강력하지만 이후:

```text
Heat Gauge → COLD
```

가 되어 다시 축적 과정이 필요하다.

---

#### 5.9 Aura

##### 기본

**ABILITY**

축적과 방출 Capability에 집중한다.

##### BODY

과열을 견딜 수 있는 범위가 증가한다.

##### AWARENESS

주변 열 흐름과 숨어 있는 생물의 체열을 감지한다.

---

#### 5.10 Counterplay

```text
열원이 적은 환경
Heat 흡수 대상과 거리 유지
과충전 유도
폭발 직후 공격
```

이 명확한 대응법이 된다.

---

#### 5.11 모험

```text
얼음 녹이기
추운 지역 보온
열 흔적 추적
얼어붙은 장치 가동
열원이 있는 장소 탐색
```

##### Passive — 열시야

생물과 장치가 남긴 열의 흐름을 관찰할 수 있다.

---

#### 5.12 Mastery

```text
많은 열 흡수
Overheat 직전에서 안정적으로 전투
냉각 지역 탐험
열원을 찾아 환경 문제 해결
저장 Heat를 낭비하지 않고 사용
```

---

#### 5.13 외형

검은 결정과 내부의 주황빛이 대비된다.

```text
검정
적갈색
주황
백열색
```

Heat Gauge가 증가하면:

```text
결정 내부
→ 의상 문양
→ 머리카락 끝
→ 주변 공기
```

순서로 발광한다.

Overheat에서는 주변 공기가 아지랑이처럼 왜곡된다.

---

## 6. 진명계 요정

### Origin Class — 명각사

#### 6.1 정체성

##### Principle

**정체성**

존재를 구분하고 기록하는 세계 원리를 다룬다.

진명계의 기본 판타지는 적의 정체를 읽고 표식을 새기고 다른 존재의 일부를 흉내 내는 것이다.

##### Character Fantasy

> **"처음 만난 적에게는 약하지만, 상대를 알아갈수록 무서워지는 사냥꾼."**

---

#### 6.2 개성

사람의 이름, 습관, 말투를 잘 기억한다.

대상을 섣불리 판단하지 않고 먼저 관찰한다.

새로운 생물을 만났을 때 공격보다:

```text
본다.
기억한다.
구분한다.
이름 붙인다.
```

가 먼저다.

---

#### 6.3 무기

##### 명각필

길고 가는 각인용 침과 붓의 중간 형태.

공중 또는 대상에게 Identity Mark를 새긴다.

허리에는 다양한 가면 조각을 지닌다.

---

#### 6.4 전투 역할

```text
Observer
+
Debuffer
+
Information
+
Conditional Control
```

주요 Operation:

```text
Observe
Mark
Reveal
Record
Copy
Retarget
```

---

#### 6.5 Class Mechanic — Name Mark

대상을 충분히 관찰하면 `Identity Fragment`를 얻는다.

```text
관찰
Skill 목격
특정 행동 확인
↓
Identity Fragment
↓
Name Mark
```

Mark가 있는 대상에게만 일부 고급 Skill을 사용할 수 있다.

---

#### 6.6 Active Response — 판독

공격이 들어오는 순간 공격 자체를 관찰한다.

##### Normal

짧게 회피한다.

##### Precision

```text
Evade
+
사용된 Skill Record
+
Identity Fragment 획득
```

전투 설계의 `Observe Response → ObservedSkill` 구조를 직접 캐릭터화한다.

---

#### 6.7 Skill

##### Basic — 각침

명각필을 이용한 빠른 찌르기.

---

##### Skill 1 — 명각

대상에게 Name Mark를 새긴다.

Mark는 세계 안에서 실제 문양으로 보인다.

---

##### Skill 2 — 명파

Mark가 있는 대상의 특정 약점을 드러낸다.

```text
Reveal
```

AWARENESS가 높으면 더 많은 정보를 얻는다.

---

##### Skill 3 — 가면흉내

직접 관찰하고 기록한 단순 Skill 하나의 행동적 특징을 모방한다.

Origin에서는 완전 복제가 아니다.

예:

```text
돌진
짧은 투사체
간단한 이동기
```

정도만 가능하다.

---

##### Skill 4 — 위명

Mark가 있는 하급 생물에게 자신의 Identity를 일시적으로 다르게 인식시킨다.

```text
Hostile
→ Neutral
```

또는 짧은 시간 Target 판단을 흐린다.

---

#### 6.8 Ultimate — 초명

지정 대상의 Identity Mark를 완전히 전개한다.

잠시 동안:

```text
중요 Skill
행동 Condition
취약 상태
```

가 훨씬 명확하게 드러난다.

파티 전체가 해당 정보를 이용할 수 있다.

---

#### 6.9 Aura

##### 기본

**AWARENESS**

진명계의 핵심이다.

```text
AWARENESS ↑
→ 더 많은 정보 관찰
→ 더 복잡한 Identity 판독
```

##### ABILITY

Mark를 이용한 능력의 범위를 강화한다.

##### BODY

관찰 중 공격당하는 위험을 줄이고 근접 전투를 강화한다.

---

#### 6.10 Counterplay

```text
Mark 제거
시야 차단
행동 패턴 변경
가짜 분신 사용
관찰되지 않은 Skill 사용
```

으로 대응할 수 있다.

진명계는 **모르는 대상에게 즉시 강해서는 안 된다.**

---

#### 6.11 모험

```text
몬스터 Identity 복제
적대 생물 통과
소유자 표식 확인
지워진 흔적 추적
진짜와 가짜 판별
```

##### Passive — 잔명

세계 개체에 남아 있는 Identity의 흔적을 희미하게 볼 수 있다.

---

#### 6.12 Mastery

```text
새로운 종 관찰
새로운 Skill 기록
위장 간파
숨겨진 Identity 발견
Mark를 이용한 전투 해결
```

---

#### 6.13 외형

가면과 문양이 핵심이다.

```text
백색
먹색
자주색
붉은 각인
```

의상을 좌우 비대칭으로 구성한다.

허리와 머리 뒤에 작은 가면 조각들이 달려 있으며, 기록한 Identity가 증가하면 일부 가면에 새로운 문양이 생긴다.

전투 중 Mark가 활성화되면 눈동자 안에도 동일한 문양이 나타난다.

---

## 7. 숨결계 요정

### Origin Class — 숨결술사

#### 7.1 정체성

##### Principle

**대기**

공기가 존재하는 장소에서 바람을 조종하는 것이 아니다.

> **공기가 성립하지 않는 장소에 공기가 존재할 조건 자체를 만든다.**

숨결진주가 임시 대기권을 만드는 세계 현상을 캐릭터 능력으로 압축한 형태다.

##### Character Fantasy

> **"자신이 서 있는 곳을 살아갈 수 있는 공간으로 만든다."**

---

#### 7.2 개성

주변 사람의 상태를 매우 잘 살핀다.

누가 숨을 헐떡이는지, 누가 긴장하고 있는지 자연스럽게 알아챈다.

성격은 밝지만 조급하지 않다.

전투 역시 상대를 직접 파괴하기보다 **공간의 상태를 바꾸는 것**에서 시작한다.

---

#### 7.3 무기

##### 숨결환장

끝부분이 비어 있는 고리형 지팡이.

공기를 압축하고 방향성을 부여한다.

---

#### 7.4 전투 역할

```text
Zone Controller
+
Support
+
Displacement
```

주요 Operation:

```text
Create Zone
Push
Pull
Move
Protect
Restrict
```

---

#### 7.5 Class Mechanic — Breath Zone

숨결술사는 제한된 수의 작은 `Breath Zone`을 만들 수 있다.

```text
Zone 안
→ 정상적인 공기

Zone 경계
→ 압력차 발생
```

Skill은 이 압력차를 이용한다.

---

#### 7.6 Active Response — 기막

공기를 순간 압축하여 몸 앞에 탄성막을 만든다.

##### Normal

```text
Damage 감소
+
Knockback 감소
```

##### Precision

공격의 힘을 압력차로 되돌린다.

```text
Damage 감소
+
Attacker Push
```

---

#### 7.7 Skill

##### Basic — 압기탄

압축한 공기 덩어리를 발사한다.

---

##### Skill 1 — 숨결장

작은 Breath Zone을 생성한다.

전투와 탐험의 모든 능력의 기반이다.

---

##### Skill 2 — 풍압

두 Zone 또는 자신과 Zone 사이의 압력차를 발생시켜 대상을 밀어낸다.

---

##### Skill 3 — 진공절

아주 짧은 순간 좁은 공간에서 공기를 제거한다.

```text
Interrupt
+
Movement Disturb
```

긴 침묵이나 강제 행동불능이 아니라 순간적인 행동 방해에 가깝다.

---

##### Skill 4 — 공기발판

짧은 시간 압축된 공기층을 만든다.

```text
Spawn Temporary Surface
```

공중 이동과 위치 확보에 사용한다.

---

#### 7.8 Ultimate — 숨의 방

넓은 Breath Zone을 전개한다.

영역 안에서는:

```text
아군 호흡 안정
투사체 궤적 변화
밀치기 능력 강화
```

가 발생한다.

즉 자신의 전장을 만든다.

---

#### 7.9 Aura

##### 기본

**ABILITY**

Zone과 압력 조작에 집중한다.

##### BODY

공기압을 이용한 이동과 방어를 강화한다.

##### AWARENESS

미세한 공기 흐름으로:

```text
움직이는 생물
숨겨진 통로
공간의 균열
```

을 감지한다.

---

#### 7.10 Counterplay

```text
Breath Zone 밖으로 이동
Zone 파괴
Zone 사이 연결 차단
Caster를 계속 이동시킴
```

으로 전장을 무너뜨릴 수 있다.

---

#### 7.11 모험

```text
무산소 지역 탐험
수중 호흡 공간 생성
밀폐 공간 환기
공기 발판 생성
바람으로 장치 조작
```

##### Passive — 기류감지

보이지 않는 틈과 통로의 공기 이동을 감지한다.

---

#### 7.12 Mastery

```text
무호흡 환경 유지
여러 생명체에게 공기 제공
Zone을 이용한 전투
압력차로 환경 퍼즐 해결
공기 흐름으로 숨겨진 공간 발견
```

---

#### 7.13 외형

둥근 형태가 많다.

```text
고리
구체
풍선 같은 천 장식
반투명 소재
```

색은:

```text
하늘색
백색
연한 청록
```

Breath Zone 주변에는 투명한 구형 경계와 작은 부유 입자가 나타난다.

옷과 머리카락은 항상 아주 약한 바람을 받는 것처럼 움직인다.

---

## 8. 맥동계 요정

### Origin Class — 맥동사

#### 8.1 정체성

##### Principle

**공명**

자신의 힘만 사용하는 캐릭터가 아니다.

살아 있는 대지와 거대한 생물의 박동에 자신의 박동을 맞춰 그 존재가 가진 힘을 빌린다.

유랑대지와 거대 생명 자체가 세계 지형을 이루는 설정에서 직접 나온다.

##### Character Fantasy

> **"땅을 밟는 순간 혼자가 아니게 되는 캐릭터."**

---

#### 8.2 개성

행동하기 전에 듣는다.

대화를 할 때도 침묵이 길지만 무관심한 것이 아니다.

사람뿐 아니라:

```text
생물
나무
지면
거대 생명체
```

의 상태를 모두 하나의 리듬처럼 받아들인다.

---

#### 8.3 무기

##### 맥동창

땅에 꽂을 수 있는 짧고 굵은 창.

전투 무기이면서 동시에 세계와 연결되는 Resonance Stake 역할을 한다.

---

#### 8.4 전투 역할

```text
Resonance Support
+
Ground Control
+
Sustain
```

주요 Operation:

```text
Link
Detect
Heal
Transfer
Root
Create Relation
```

---

#### 8.5 Class Mechanic — 공명선

맥동창 또는 직접 접촉을 통해 살아 있는 대상과 `Resonance Link`를 만든다.

```text
Self
↕
Ground
↕
Living Structure
```

연결된 상태에서만 사용할 수 있는 능력이 존재한다.

---

#### 8.6 Active Response — 역맥

공격 충격을 자신의 몸에서 끝내지 않고 연결된 지면으로 흘려보낸다.

##### Normal

```text
Damage 일부 감소
```

##### Precision

```text
Damage 감소
+
지면으로 충격 전달
+
Attacker에게 짧은 Resonance Stagger
```

단:

```text
Resonance Link 없음
→ 강화 효과 없음
```

이라는 명확한 Requirement가 있다.

---

#### 8.7 Skill

##### Basic — 맥창

맥동창으로 찌른다.

연결된 지면 위에서는 타격에 작은 공명파가 발생한다.

---

##### Skill 1 — 지맥청

지면을 통해 주변 움직임을 감지한다.

```text
Reveal Moving Actor
```

---

##### Skill 2 — 맥진

Resonance Link를 통해 충격파를 전달한다.

지면과 연결된 대상에게만 도달한다.

---

##### Skill 3 — 생근결

아군 또는 생명체와 짧은 Link를 만든다.

```text
Link
+
Recovery
```

즉시 큰 Heal이 아니라 일정 시간 생체 안정성을 높인다.

---

##### Skill 4 — 뿌리깨움

살아 있는 뿌리나 생체 지형이 존재하면 짧게 활성화한다.

```text
Attach
+
Restrict Movement
```

인공 바닥에서는 사용할 수 없다.

---

#### 8.8 Ultimate — 대맥동

주변의 모든 유효한 Resonance Link를 하나의 박동으로 동기화한다.

```text
Linked Allies
→ 회복

Linked Enemies
→ Stagger

Living Ground
→ Pulse
```

하나의 공격이 아니라 **연결되어 있는 관계 전체를 한 번 움직이는 능력**이다.

---

#### 8.9 Aura

##### 기본

**AWARENESS / ABILITY**

두 성향의 중간에 위치한다.

AWARENESS:

```text
더 멀리 있는 박동 감지
숨은 생명체 감지
```

ABILITY:

```text
더 많은 Link
더 강한 Resonance Operation
```

BODY는 직접 전투와 충격 전달을 강화한다.

---

#### 8.10 Counterplay

맥동계는 연결이 끊기면 급격히 약해진다.

```text
공중 이동
죽은 지형
인공 구조물
Resonance Stake 파괴
강제 이동
```

이 중요한 Counterplay가 된다.

---

#### 8.11 모험

```text
유랑대지 움직임 감지
거대 생명체와 교감
생체 Route 발견
손상된 생체 구조 진단
살아 있는 문 개방
```

##### Passive — 생맥

가까운 생명체와 살아 있는 지형의 박동을 느낀다.

---

#### 8.12 Mastery

```text
거대 생명체와 공명
새로운 생체 지형 발견
대지의 상처 복구
Link를 유지하며 전투
지면 감지를 이용해 위험 회피
```

---

#### 8.13 외형

자연을 단순히 장식으로 붙이지 않는다.

몸과 장비에 **맥박처럼 반복되는 선**이 존재한다.

```text
흙빛
짙은 녹색
청록
생체 발광색
```

맥동창은 나무와 뼈, 광물의 중간처럼 보이는 소재다.

공명 상태에서는:

```text
발
→ 다리
→ 몸
→ 창
→ 지면
```

을 연결하는 빛의 맥이 실제 세계에 나타난다.

---

## 9. 6개 Origin Class의 플레이 차이

| Class          | 전투에서 반복하는 행동                     | Response | 핵심 Aura           | 핵심 World Operation    | 모험 방식                    |
| -------------- | ------------------------------------------ | -------- | ------------------- | ----------------------- | ---------------------------- |
| **골완투사**   | 받아내고 힘을 모아 부순다                  | 버티기   | BODY                | Store / Push / Break    | 들어 올리고 버틴다           |
| **역락검사**   | 계속 이동하며 공격 방향을 바꾼다           | 역보     | BODY                | Move / Redirect         | 벽·천장·낙하를 이동로로 사용 |
| **열술사**     | 열을 빼앗아 저장하고 방출한다              | 열방출   | ABILITY             | Drain / Store / Release | 열을 찾아 환경을 변화        |
| **명각사**     | 관찰하고 표식을 새겨 규칙을 파악한다       | 판독     | AWARENESS           | Observe / Mark / Record | 흔적과 Identity를 읽는다     |
| **숨결술사**   | 공기 영역을 만들고 압력차를 사용한다       | 기막     | ABILITY             | Create Zone / Push      | 생존 가능한 공간을 만든다    |
| **맥동사**     | 세계와 연결하고 연결을 통해 힘을 전달한다  | 역맥     | AWARENESS / ABILITY | Link / Transfer         | 살아 있는 세계와 교감        |

이 차이는 능력치 차이가 아니다.

```text
백왕
맞는다 → 버틴다 → 모은다 → 부순다

역락
달린다 → 방향을 바꾼다 → 파고든다 → 다시 달린다

태양심
빼앗는다 → 저장한다 → 위험을 감수한다 → 방출한다

진명
본다 → 알아낸다 → 새긴다 → 이용한다

숨결
공간을 만든다 → 압력차를 만든다 → 위치를 바꾼다

맥동
듣는다 → 연결한다 → 전달한다 → 함께 움직인다
```

기존 설계가 요구한 것처럼 캐릭터 차이는 공격력 수치보다 **실제 플레이 행동 자체에서 즉시 드러나야 한다.**

---

## 10. Layer 0에서 의도적으로 제한하는 것

Origin Class가 처음부터 최종 능력을 사용하지 않는다.

### 골완투사

```text
현재:
자신에게 힘을 결속

아직 불가능:
타인 또는 넓은 공간의 결속
```

### 역락검사

```text
현재:
주로 자신의 방향 제어

아직 불가능:
다수 Actor와 공간 전체 방향 제어
```

### 열술사

```text
현재:
열을 저장

아직 불가능:
다른 종류의 에너지·상태까지 저장
```

### 명각사

```text
현재:
Identity 관찰·Mark·부분 모방

아직 불가능:
Identity 자체의 강제 변경
```

### 숨결술사

```text
현재:
작은 대기 영역 생성

아직 불가능:
거대한 지역의 대기 법칙 변경
```

### 맥동사

```text
현재:
개별 생명과 지형에 Link

아직 불가능:
거대한 생태계 전체 동기화
```

이 **현재 한계**가 다음 Class Layer를 만드는 출발점이 된다.

---

## 11. 이후 Layer의 생성 규칙

다음 세션부터 하나의 Layer를 추가할 때 다음 과정만 수행한다.

```text
1. Origin Principle 확인
2. 새롭게 획득한 Principle 하나 선택
3. 두 Principle의 관계 정의
4. 기존 Combat Loop에서
   무엇이 새로 가능해지는지 정의
5. 기존 Response 진화
6. 새 World Operation 추가
7. Exploration Capability 확장
8. 새로운 Condition / Contract 필요 여부 결정
9. 외형 변화
10. 하나 이상의 Class Branch 생성
```

예를 들어 구조적으로는:

```text
결속
+
새 Principle A
=
백왕계 Class A

결속
+
새 Principle B
=
백왕계 Class B
```

가 가능하다.

중요한 것은:

> **새 Class 이름을 먼저 만들고 능력을 끼워 맞추지 않는다.**

반드시:

```text
새 Principle
↓
새로운 Rule
↓
새로운 행동
↓
전투 방식 변화
↓
탐험 방식 변화
↓
외형 변화
↓
Class
```

순서로 만든다.

---

## 12. 최종 기준

Origin Class 하나가 완성되었다고 판단하려면 다음 질문에 즉시 답할 수 있어야 한다.

1. 이 캐릭터의 원리는 무엇인가?
2. 플레이어에게는 그 원리가 어떤 단순한 판타지로 보이는가?
3. 전투에서 반복하는 행동은 무엇인가?
4. Response 버튼을 누르면 이 캐릭터만의 어떤 행동이 일어나는가?
5. Aura를 어디에 집중하는가?
6. Damage 이외에 세계의 무엇을 변화시킬 수 있는가?
7. 상대는 그 능력에 어떻게 대응할 수 있는가?
8. 같은 힘을 탐험에서는 어떻게 사용하는가?
9. 어떤 행동을 많이 해야 Class Mastery가 오르는가?
10. 멀리서 실루엣만 보아도 다른 요정과 구분되는가?
11. 현재 Class가 할 수 없는 것은 무엇인가?
12. 새로운 Principle이 하나 추가되었을 때 어떤 방향으로 확장될 수 있는가?

이 12개가 닫힌 상태에서만 다음 Layer로 넘어간다.
