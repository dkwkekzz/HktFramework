# 백왕계 요정 — 성장 트리 / Class Change 조건 설계 R0

## 1. 성장 구조

백왕계의 성장은 하나의 직선적인 Class Evolution을 중심으로 한다.

```text
백골권희
   ↓
왕골가디언
   ↓
백왕발키리
   ↓
백왕현신
```

하지만 클래스만 바뀌는 것은 아니다.
각 단계에서 동시에 네 종류의 성장이 진행된다.

```text
Character Growth
    │
    ├─ 기본 성장
    │    Level / 기본 능력치
    │
    ├─ Class 성장
    │    Class Mastery
    │
    ├─ 능력 성장
    │    Skill / 전투·탐험 Capability
    │
    └─ 세계 성장
         Knowledge / Resource / World Experience
```

최종적으로:

> **캐릭터 레벨은 기본적인 MMORPG 성장감을 만들고, Class Mastery는 백왕계답게 플레이한 정도를 나타내며, World Experience와 Resource가 새로운 Class Change를 현실적으로 가능하게 한다.**

## 2. 성장의 가장 중요한 원칙

백왕계는 단순히 몬스터를 많이 잡아서 백왕현신이 되지 않는다.

백왕의 원리는 애초에 초거대 생명체가 과도한 세계압을 몸에 결속하고 자신의 형태를 유지했던 능력에서 나온다.
따라서 성장 행동 역시 그 원리를 따라야 한다.

```text
강한 힘을 상대한다.
↓
버틴다.
↓
자신 안에 받아들인다.
↓
제어한다.
↓
더 큰 힘으로 되돌린다.
↓
마침내 다른 존재까지 지킬 수 있게 된다.
```

Class Evolution은 이 과정의 규모가 커지는 것이다.

## 3. 성장의 4개 축

### A. Character Level

일반적인 MMORPG의 기본 성장축.

다음 플레이에서 Experience를 얻는다.

* 몬스터 전투
* 보스 전투
* 탐험
* 새로운 지역 발견
* 사건 해결
* NPC 구조
* World Action 수행
* 원정 성공

Level은 주로 다음 값의 기본치를 증가시킨다.

```text
HP
Attack Power
Defense
Max Energy
기본 골압 한도
```

따라서 기존 `MC-ATTACK-POWER`도 명확한 성장 경로를 가진다.

```text
플레이
→ Experience
→ Character Level
→ Base Attack Power 증가
```

단, Level만 높다고 상위 Class가 되는 것은 아니다.

## 4. Class Mastery

Class Mastery는

> **현재 Class의 힘을 얼마나 제대로 사용할 수 있는가**

를 나타낸다.

각 클래스마다 별도로 존재한다.

예:

```text
백골권희 Mastery
왕골가디언 Mastery
백왕발키리 Mastery
```

Mastery는 단순 전투 횟수로 오르지 않는다.
백왕계의 핵심 행동을 성공해야 한다.

## 5. 백왕계 Mastery 행동

### 핵심 Mastery Source

#### ① 견딘다

자신에게 위협적인 공격을 `골벽식` 등으로 성공적으로 받아낸다.

#### ② 되돌린다

흡수한 골압을 공격으로 변환해 적에게 유효한 결과를 만든다.

#### ③ 무너뜨린다

강적의 자세와 구조를 괴력으로 붕괴시킨다.

#### ④ 움직인다

자신보다 훨씬 무거운 대상이나 구조물을 힘으로 이동시킨다.

#### ⑤ 지킨다

아군이나 NPC가 받을 위험을 자신의 능력으로 막는다.

#### ⑥ 버티며 전진한다

압력·충격·붕괴 같은 위험 환경을 정면으로 돌파한다.

## 6. Mastery는 반복 작업을 제한한다

같은 약한 몬스터에게 계속 Guard를 사용하는 것만으로 최고 Mastery에 도달해서는 안 된다.

Mastery Gain에는 `Challenge`가 존재한다.

```text
현재 Class가 쉽게 처리할 수 있는 행동
→ 낮은 Mastery

현재 Class와 비슷한 수준
→ 정상 Mastery

현재 Class의 한계에 가까운 행동
→ 높은 Mastery

이전에 성공하지 못했던 행동
→ 최초 성공 Bonus
```

따라서 플레이어는 자연스럽게 더 위험한 적과 지역을 찾아간다.

## 7. Class Mastery 단계

모든 Class는 단순한 경험치 Bar 대신 4단계 숙련 상태를 가진다.

```text
입문
↓
숙련
↓
완성
↓
극의
```

### 입문

Class Change 직후.
핵심 Skill과 Class Mechanic을 사용할 수 있다.

### 숙련

Class의 주요 전투 루프를 안정적으로 수행한다.
새로운 Skill과 기존 Skill 변형이 열린다.

### 완성

전투뿐 아니라 탐험에서도 원리를 자유롭게 사용한다.
다음 Class Change를 위한 World Trial에 도전할 수 있다.

### 극의

현재 Class의 핵심 능력을 한계 상황에서 증명한 상태.
상위 Class Change의 핵심 조건이다.

## 8. 전체 성장 그래프

```text
[백골권희]
│
├─ Character Level 성장
│
├─ 백골권희 Mastery
│   ├─ 골벽식 성공
│   ├─ 갈비돌진으로 적 제압
│   ├─ 파성권으로 구조 파괴
│   └─ 압력 환경 돌파
│
├─ Skill 성장
│   ├─ 백골연권
│   ├─ 골벽식
│   ├─ 갈비돌진
│   └─ 파성권
│
├─ World Experience
│   └─ 백왕 갈비분지 심부 경험
│
└─ Catalyst
    └─ 왕골
         ↓
   CLASS CHANGE
         ↓
[왕골가디언]
│
├─ Character Level 성장
│
├─ 왕골가디언 Mastery
│   ├─ 축압 운용
│   ├─ 강적 자세 붕괴
│   ├─ 아군 보호
│   └─ 대형 구조물 대응
│
├─ Skill 성장
│   ├─ 기존 4 Skill 진화
│   ├─ 왕골진각
│   ├─ 압력수납
│   ├─ 골문쇄락
│   └─ 갈비성채
│
├─ World Experience
│   └─ 거대 생물과의 힘겨루기
│
└─ Catalyst
    └─ 백왕의 치아
         ↓
   CLASS CHANGE
         ↓
[백왕발키리]
│
├─ Character Level 성장
│
├─ 백왕발키리 Mastery
│   ├─ 압력반전
│   ├─ 보스 자세 붕괴
│   ├─ 재해급 충격 수용
│   └─ 파티 전선 유지
│
├─ Skill 성장
│   ├─ 기존 Skill 고급화
│   ├─ 척추관통
│   ├─ 압력반전
│   └─ 백왕강림
│
├─ World Experience
│   └─ 백왕 골격 심부 도달
│
└─ Catalyst
    ├─ 왕골
    ├─ 백왕의 치아
    └─ 골수천
         ↓
   CLASS CHANGE
         ↓
[백왕현신]
│
├─ 왕체 현현
├─ 백왕재림
├─ 기존 Skill 최종 Evolution
├─ 최고 등급 탐험 Capability
└─ Endgame Mastery
```

## 9. CLASS 1 — 백골권희 성장

### 시작 상태

백골권희는 플레이어가 백왕계의 기본 판타지를 즉시 이해하도록 한다.

```text
때린다.
막는다.
민다.
부순다.
```

### 기본 Skill

* 백골연권
* 골벽식
* 갈비돌진
* 파성권

### 기본 Exploration Capability

* 약한 장애물 파괴
* 무거운 물체 이동
* 충격 완화
* 약한 압력 지역 통과

## 10. 백골권희 Mastery Tree

```text
백골권희
│
├─ [공격]
│   ├─ 백골연권 숙련
│   └─ 파성권 숙련
│
├─ [결속]
│   ├─ 골벽식 숙련
│   └─ 골압 최대치 증가
│
├─ [괴력]
│   ├─ 갈비돌진 강화
│   └─ 구조물 파괴 Capability
│
└─ [극의]
    └─ 강한 충격을 받고
       자신의 힘으로 되돌린다
```

### 숙련 보상 예시

#### 입문

기본 4 Skill.

#### 숙련

* 골압 저장량 증가
* 골벽식 정확 방어 개방
* 갈비돌진 후 백골연권 연계 가능

#### 완성

* 파성권 완전 충전
* 중량 Exploration Action 강화

#### 극의

`왕골가디언 Trial` 개방.

## 11. 백골권희 → 왕골가디언

### Class Change 조건

| 조건 | 요구 |
| --- | --- |
| Character | 최소 성장 기준 충족 |
| Class | 백골권희 Mastery 극의 |
| Combat Proof | 강한 공격을 완전 결속하고 반격 성공 |
| Exploration Proof | 붕괴 또는 압력 환경에서 다른 존재 보호 |
| World Experience | 백왕의 골격 내부 탐험 |
| Catalyst | 왕골 획득 |
| Trial | 백왕 갈비의 압력을 일정 시간 견딤 |

왕골은 작은 세계압 변화를 흡수하는 골편이며 실제로 장비와 방벽의 핵심 소재로 사용된다.

### Class Change 결과

```text
백골권희
↓
왕골가디언
```

#### 즉시 변화

* 외형 Evolution
* 골압 최대치 증가
* 축압 Mechanic 개방
* 왕골진각
* 압력수납
* 골문쇄락
* 갈비성채
* 이전 Skill 4개 Evolution

## 12. CLASS 2 — 왕골가디언 성장

왕골가디언의 성장 주제는:

> **자신만 버티던 힘을 공간과 동료에게 확장한다.**

### 전투 성장

```text
내 공격
→ 적의 자세까지 붕괴

내 방어
→ 파티 보호

내 골압
→ 저장과 방출을 의도적으로 제어
```

### 탐험 성장

```text
물체를 부순다
→
구조물을 움직인다

충격을 버틴다
→
통로 자체를 지탱한다
```

## 13. 왕골가디언 Mastery Tree

```text
왕골가디언
│
├─ [축압]
│   ├─ 압력수납
│   ├─ 최대 골압 증가
│   └─ 축압 유지
│
├─ [붕괴]
│   ├─ 왕골진각
│   ├─ 골문쇄락
│   └─ 대형 적 자세 붕괴
│
├─ [수호]
│   ├─ 갈비성채
│   ├─ 아군 피해 차단
│   └─ 붕괴 환경 보호
│
└─ [극의]
    └─ 자신보다 거대한 존재의
       운동을 힘으로 저지한다
```

## 14. 왕골가디언 → 백왕발키리

### 핵심 의미

왕골가디언은 압력을 버텼다.
백왕발키리는 그 압력을 이용해 **거대한 존재에게 자신의 힘을 강요할 수 있어야 한다.**

### Class Change 조건

| 조건 | 요구 |
| --- | --- |
| Character | 상위 성장 기준 충족 |
| Class | 왕골가디언 Mastery 극의 |
| Combat Proof | 대형 적의 자세를 직접 붕괴 |
| Power Proof | 거대 생물과 힘겨루기 성공 |
| Guardian Proof | 위험 상황에서 파티 보호 성공 |
| World Experience | 백왕의 거대한 골격 구조 관찰 |
| Catalyst | 백왕의 치아 파편 |
| Craft | 치아 파편을 이용한 상위 건틀릿 완성 |

백왕의 치아 파편은 비정상적인 구조까지 절단할 수 있는 무기 소재다.

### Class Change 결과

* 왕척 현현
* 외형이 전장의 왕녀 형태로 Evolution
* 척추관통
* 압력반전
* 백왕강림
* 중형 대상 Grab
* 대형 적 힘겨루기 강화
* 파티 규모 보호 Capability 확대

## 15. CLASS 3 — 백왕발키리 성장

백왕발키리의 성장 주제는:

> **거대한 힘을 상대하는 것이 아니라 거대한 힘과 대등하게 싸운다.**

이때부터 성장 목표가 일반 몬스터보다:

```text
거대 생물
보스
지역 재해
초대형 구조
세계압 폭주
```

로 이동한다.

## 16. 백왕발키리 Mastery Tree

```text
백왕발키리
│
├─ [대적]
│   ├─ 척추관통
│   ├─ 대형 적 돌파
│   └─ 거대 생물 자세 붕괴
│
├─ [반전]
│   ├─ 압력반전
│   ├─ 초대형 공격 Counter
│   └─ 적의 힘 역이용
│
├─ [강림]
│   ├─ 백왕강림
│   ├─ 광역 붕괴
│   └─ 전장 진입
│
├─ [수호]
│   ├─ 갈비성채 확장
│   └─ 재해 속 파티 보호
│
└─ [극의]
    └─ 재해 규모의 힘을
       자신의 몸에 결속하고도
       Identity를 유지한다
```

## 17. 백왕발키리 → 백왕현신

이 Class Change는 단순한 전직이 아니다.

백왕계 요정이

> **백왕의 Property를 사용하는 존재**

에서

> **백왕의 결속 원리 자체를 인격으로 현현시키는 존재**

로 넘어가는 순간이다.

## 18. 최종 Class Change 조건

| 조건 | 요구 |
| --- | --- |
| Character | Endgame 성장 기준 |
| Class | 백왕발키리 Mastery 극의 |
| Combat Proof | 보스급 공격을 압력반전 |
| Destruction Proof | 거대 대상의 자세 완전 붕괴 |
| Guardian Proof | 재해급 상황에서 다수 대상 보호 |
| Exploration Proof | 백왕 골격 심부 도달 |
| World Knowledge | 백왕이 세계압을 결속했던 구조 이해 |
| Resource | 왕골 |
| Resource | 백왕의 치아 |
| Resource | 골수천 |
| Final Trial | 백왕의 잔존 세계압을 자신의 몸에 결속 |
| Result | 결속 상태에서도 자기 Identity 유지 |

골수천은 외부 Property에 쉽게 변질되지 않고 탐험가의 상태를 안정시키는 물이기 때문에, 백왕의 강한 Property를 개인에게 안정적으로 결속시키는 최종 촉매로 사용한다.

## 19. 최종 Trial — 「백왕의 무게」

백왕현신 Class Change의 마지막 시험이다.

백왕 골격 심부에는 아직 결속된 강한 세계압이 남아 있다.
플레이어가 그 앞에 선다.

```text
Trial 시작
↓
압력 증가
↓
이동 제한
↓
골벽식과 골압 운용
↓
점점 강해지는 충격
↓
왕척 일부 파손
↓
최대 압력 도달
```

여기서 적을 죽이는 것이 목표가 아니다.
목표는 단 하나다.

> **무너지지 않는다.**

일정 시간 버티면 캐릭터 주변의 압력이 캐릭터를 짓누르는 대신 몸 안으로 흘러들기 시작한다.
그리고 최초의 `왕체 현현`이 발생한다.

```text
백왕의 압력
+
요정의 Identity
↓
안정적인 결속
↓
백왕현신
```

## 20. CLASS 4 — 백왕현신 성장

백왕현신이라고 성장이 종료되는 것은 아니다.
이후부터는 Endgame Mastery가 열린다.

### 성장 방향

```text
자신을 지킨다
↓
한 명을 지킨다
↓
파티를 지킨다
↓
전장을 지킨다
↓
지역을 재해로부터 지킨다
```

전투력 역시:

```text
작은 적을 때린다
↓
큰 적을 넘어뜨린다
↓
거대 생물을 멈춘다
↓
보스를 무릎 꿇린다
↓
재해 자체와 힘겨루기한다
```

로 확대된다.

## 21. 백왕현신 Endgame Tree

```text
백왕현신
│
├─ [왕체]
│   ├─ 왕체 지속시간
│   ├─ 왕체 중 Skill 변화
│   └─ 최대 골압 확장
│
├─ [재림]
│   ├─ 백왕재림
│   ├─ 재해급 붕괴
│   └─ 환경 개입
│
├─ [성역]
│   ├─ 갈비성채 → 골수성역
│   └─ 파티 전체 보호
│
├─ [괴력]
│   ├─ 대형 대상 Grab Challenge
│   └─ 초대형 구조물 World Action
│
└─ [왕의 흔적]
    └─ 특별 장비 / Skill Variant /
       Character Story 확장
```

## 22. Skill 성장과 Class 성장의 관계

상위 Class가 되었다고 기존 Skill이 버려지지 않는다.

### 예 — 골벽식

```text
백골권희
자기 자신 Guard
↓
왕골가디언
뒤쪽 아군까지 보호
↓
백왕발키리
정확 Guard 시 반압력
↓
백왕현신
재해급 공격에 갈비 현현
```

### 예 — 파성권

```text
백골권희
강한 Punch
↓
왕골가디언
압력파
↓
백왕발키리
대형 적 자세 파괴
↓
백왕현신
백왕의 거대 골완 동시 현현
```

따라서 Class Change의 체감은:

> **"새로운 스킬 몇 개를 얻었다"가 아니라 기존의 모든 능력이 새로운 규모로 올라갔다**

여야 한다.

## 23. Exploration Growth Tree

백왕계의 탐험 성장도 Class와 함께 올라간다.

```text
[백골권희]
약한 벽 파괴
무거운 물체 이동
낙하 충격 완화
        ↓
[왕골가디언]
대형 문 강제 개방
구조물 지탱
임시 방벽
파티 낙하 보호
        ↓
[백왕발키리]
대형 구조물 이동
거대 생물 힘겨루기
고압 지역 선두 돌파
재해성 충격 방어
        ↓
[백왕현신]
초대형 구조물 지지
지역 붕괴 억제
재해급 압력 통과
대형 생물 관문 강제 개방
파티 전체 안정 영역
```

성장할수록 단순히 더 높은 숫자의 돌을 부수는 것이 아니다.
**World Action 자체의 규모가 커진다.**

## 24. 장비 성장과 연결

백왕계의 Class Evolution에는 세계 자원이 계속 개입한다.

```text
백골권희
기본 왕골 장비
↓
왕골가디언
왕골을 이용한 상위 골완
↓
백왕발키리
백왕의 치아 결속
↓
백왕현신
왕골
+
백왕의 치아
+
골수천
+
백왕 잔존 세계압
```

따라서 Class Change가 일어나면 자연스럽게 새로운 장비 제작 Goal도 발생한다.

이는 대지형에서 얻은 Resource가 다음 Capability를 열어야 한다는 베이라의 Progression 원칙과 연결된다.

## 25. Class Change UI에서 보여야 하는 정보

다음 Class를 선택하면 단순히:

```text
Lv.40 필요
```

라고 표시해서는 안 된다.

플레이어에게 아래가 보인다.

### 백왕발키리 해금 예

```text
백왕발키리

Character
✓ 요구 성장 단계 달성

Mastery
✓ 왕골가디언 — 극의

힘의 증명
✓ 대형 생물 자세 붕괴
✓ 거대 생물 힘겨루기

수호의 증명
✓ 동료를 보호하며 붕괴 상황 생존

세계 경험
✓ 백왕 척추 내부 발견

촉매
✓ 백왕의 치아 파편

장비
□ 백왕치아 골완 제작
```

즉 다음 Class가 왜 아직 잠겨 있는지 플레이어가 즉시 알 수 있다.

## 26. 성장의 관찰 가능성

각 성장값은 실제 게임에서 증거가 보여야 한다.

| 성장 | 관찰 가능한 변화 |
| --- | --- |
| Character Level | 기본 능력치 및 Level 표시 |
| Class Mastery | Mastery Gauge / 새로운 Node |
| 골압 성장 | Gauge 최대량 / 캐릭터 발광 |
| Skill 성장 | 새로운 행동과 Animation |
| Exploration 성장 | 이전에 불가능했던 World Action |
| Class Change | 외형 전체 Evolution |
| 장비 성장 | 실제 장비 형상 변화 |
| World Experience | Knowledge / 기록 / Class 조건 체크 |

## 27. 구현용 Growth Source 규칙

백왕계의 증가 가능한 값은 모두 아래 형태로 등록한다.

```text
GrowthSource {
    target
    sourceAction
    requiredChallenge
    observableResult
    reward
    repetitionRule
}
```

예:

```text
GR-WHITEKING-GUARD-001

target:
백골권희 Mastery

sourceAction:
위협적인 공격에 골벽식 사용

requiredChallenge:
현재 캐릭터 기준 유효한 위협

observableResult:
공격 피해 감소
+
골압 획득

reward:
백골권희 결속 Mastery

repetitionRule:
동일한 약한 공격 반복 시 효율 감소
```

## 28. Class Change 데이터 구조

각 Class Change도 명시적으로 표현한다.

```text
ClassEvolution {
    fromClass
    toClass
    levelRequirement
    masteryRequirement
    combatProof[]
    explorationProof[]
    worldExperience[]
    requiredKnowledge[]
    catalyst[]
    finalTrial
    grantsSkills[]
    evolvesSkills[]
    grantsCapabilities[]
    visualEvolution
}
```

따라서 새로운 요정 계열을 만들어도 같은 구조를 재사용할 수 있다.

## 29. 백왕계 전체 성장표

| 단계 | Class | 성장의 중심 | 전투 규모 | 탐험 규모 |
| --- | --- | --- | --- | --- |
| I | 백골권희 | 자신의 힘을 이해 | 일반 적 | 작은 장애물 |
| II | 왕골가디언 | 힘을 저장·제어 | 강적 / 다수 | 구조물 / 파티 |
| III | 백왕발키리 | 거대한 힘과 대적 | 보스 / 거대 생물 | 거대 구조 / 재해 |
| IV | 백왕현신 | 원리 자체를 현현 | 재앙급 대상 | 지역 규모 위험 |

## 30. 최종 성장 경험

백왕계 플레이어의 전체 경험은 다음과 같아야 한다.

```text
처음에는
벽을 부술 정도로 힘이 센 소녀다.
↓
강해지면서
괴물의 공격을 정면으로 받아낼 수 있게 된다.
↓
그다음에는
괴물의 공격을 받아 힘으로 저장한다.
↓
더 강해지면
거대한 괴물의 돌진을 멈추고
무릎을 꿇릴 수 있다.
↓
마침내
재해 규모의 압력을 자기 몸에 결속하고
백왕의 거대한 골격을 세계에 현현시킨다.
```

이것이 백왕계의 Class Change다.

> **백골권희 → 왕골가디언 → 백왕발키리 → 백왕현신은 다른 직업으로 갈아타는 과정이 아니라, 처음부터 가지고 있었던 "나는 세계의 무게를 받아낼 수 있다"라는 하나의 힘이 개인 → 파티 → 거대 생물 → 재해의 규모까지 확대되는 성장 과정이다.**

그리고 이 구조가 다른 요정의 Class Evolution을 설계할 때 사용할 기본 템플릿이 된다.
