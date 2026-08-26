# Design-Combat-Knowledge-Extension-R0

## 전투 지식과 숙련 확장 시스템

> **핵심 명제**
>
> 플레이어는 전투 규칙을 직접 작성하지 않는다.
> 세계 속에서 이미 성립한 완성된 전투 지식을 발견하고, 배우고, 성장시키고, 선택하여 캐릭터에게 적용한다.
>
> 전투 숙련은 복잡한 입력이나 AI 스크립트 작성 능력이 아니라
> 세계와 상대를 이해하고, 필요한 지식을 획득하여, 현재 전투에 적합한 지식 조합을 구성하는 능력에서 만들어진다.

---

## 0. 문서 위치

본 문서는 `Design-Combat-UpperLayer-R0`의 전투 시스템을 변경하지 않는다.

심층 전투 문서는 다음을 정의한다.

```text
Combat Core
    ↓
Damage / Defense
    ↓
Damage Type / Penetration / Critical
    ↓
Combat Response
    ↓
Ability Rule
    ↓
Aura / Nen
```

본 문서는 그보다 한 단계 위에서:

플레이어가 Response / Aura / Ability Rule을 어떻게 간접적으로 운용하고 숙련시키는가

를 정의한다.

따라서 관계는 다음과 같다.

```text
[ Combat Knowledge ]
        ↓
전투 상황을 해석하고
운용 방침을 제공한다.
        ↓
[ Aura / Response / Ability ]
        ↓
[ Existing Combat System ]
```

Combat Knowledge는 새로운 피해 공식도, 새로운 전투 판정도 아니다.

기존 전투 Capability를 어떻게 운용할 것인지 알려주는 획득 가능한 지식 계층이다.

---

## 1. 해결하려는 문제

심층 전투에서는 다음과 같은 판단이 필요하다.

```text
언제 방어를 우선할 것인가?

언제 Aura를 보존할 것인가?

언제 상대 능력을 관찰할 것인가?

어떤 공격을 어떤 Response로 받아낼 것인가?

Contract 조건을 어떻게 성립시킬 것인가?

특정 Monster의 능력을 어떻게 파훼할 것인가?
```

이를 플레이어가 직접:

```text
IF EnemyAttack == Heavy
THEN Guard

IF Aura < 30%
THEN Preserve
```

처럼 구성하게 만들면 전투 시스템이 사실상 스크립트 편집기가 된다.

반대로 모든 판단을 캐릭터에게 기본 제공하면:

```text
캐릭터가 처음부터 모든 상황에 최적으로 대응
```

하게 되어 플레이어가 성장하고 학습할 영역이 사라진다.

따라서 중간 계층으로 Combat Knowledge를 둔다.

---

## 2. Combat Knowledge 정의

Combat Knowledge는:

> 특정 전투 상황을 이해하고 대응하기 위한 완성된 판단 규칙의 집합

이다.

플레이어는 내부 규칙을 작성하거나 수정하지 않는다.

하나의 완성된 객체로 존재한다.

예:

```text
「견고한 수호」

보호 대상이 위험할 때
공격보다 보호를 우선한다.

적용 결과:
- BODY Aura 우선
- 보호 대상 주변 Position 선호
- Intercept 우선
- 공격적 Ability 사용 억제
```

플레이어가 보는 것은:

```text
견고한 수호
```

라는 하나의 지식이다.

내부 판단은 시스템이 소유한다.

---

## 3. Combat Knowledge는 물리 Item이 아니다

Combat Knowledge를 '아이템화한다'는 것은 반드시 가방에 들어가는 물건으로 만든다는 의미가 아니다.

개념적으로는 획득하고 보유하며 선택할 수 있는 객체라는 의미다.

```text
Item
→ 소유하는 물질

Skill
→ 습득한 행동

Combat Knowledge
→ 습득한 판단법
```

세 가지 모두 Actor에게 새로운 Capability를 제공한다.

```text
검 획득
→ 공격 Capability

Skill 학습
→ 새로운 행동 Capability

Combat Knowledge 습득
→ 새로운 판단 Capability
```

따라서 기존 성장 구조와 같은 방식으로 관리할 수 있다.

---

## 4. Knowledge와 Combat Knowledge의 구분

일반 Knowledge와 Combat Knowledge는 구분한다.

### Knowledge

세계에 대한 사실을 안다.

예:

```text
거대 악마는 날개를 펼치면
Aura Projectile을 반사한다.
```

### Combat Knowledge

그 사실을 실제 전투 운용으로 변환할 수 있다.

예:

```text
「악마의 날개 파훼법」

Wing Reflect 활성
    ↓
원거리 Aura Ability 억제
    ↓
접근 / 근거리 공격 우선
    ↓
Wing Reflect 종료 후 원래 운용 복귀
```

따라서 관계는:

```text
World Observation
        ↓
Knowledge
        ↓
이해 / 연구 / 전수
        ↓
Combat Knowledge
        ↓
Combat Capability 운용
```

이다.

---

## 5. 모든 Knowledge가 Combat Knowledge가 되는 것은 아니다

예:

```text
Knowledge:
악마의 피는 독성이 있다.
```

이 정보가 바로 전투 행동을 바꾸지 않는다면 단순 Knowledge다.

하지만:

```text
Knowledge:
악마가 피를 흘리면
주변에 독성 영역이 생성된다.
```

를 이용하여:

```text
「피 흘리는 악마와 싸우는 법」

Bleeding Demon 근처 접근 억제
독성 영역 발생 후 Position 변경
```

이라는 Combat Knowledge가 만들어질 수 있다.

따라서 Combat Knowledge는 사실 그 자체가 아니라 그 사실을 전투에 적용하는 방법이다.

---

## 6. Combat Knowledge의 기본 구조

각 Combat Knowledge는 내부적으로 최소한 다음 구조를 가진다.

```text
CombatKnowledge

Identity

Required Knowledge

Applicable Situation

Combat Interpretation

Preferred Intent

Aura Guidance

Response Guidance

Ability Guidance

Position Guidance

Exit Condition
```

그러나 이 전체 구조를 플레이어에게 Rule Editor 형태로 공개하지 않는다.

플레이어에게는 의미 중심으로 표시한다.

예:

```text
악마의 날개 파훼법

효과:
날개를 펼친 악마를 상대할 때
원거리 공격을 억제하고 접근전을 우선한다.

필요 지식:
악마의 날개 반사 능력
```

---

## 7. Combat Knowledge 종류

Combat Knowledge를 시스템적으로 지나치게 분리할 필요는 없지만, 설계와 콘텐츠 제작을 위해 크게 네 계열로 구분한다.

### 7.1 Response Knowledge

공격이나 위험에 어떻게 대응할지를 개선한다.

예:

```text
견고한 수호

역공의 자세

동료 대신 맞기

마력 흡수

대형 공격 흘려내기
```

영향:

```text
Combat Response
Guard
Evade
Intercept
Counter
Absorb
Redirect
```

---

### 7.2 Aura Knowledge

Aura를 어떻게 운용할지를 개선한다.

예:

```text
기력 보존

전신 강화

감각 확장

능력 집중

장기전 호흡

단기 폭발
```

영향:

```text
Aura Allocation

Aura Reserve

Aura 소비 우선순위

Ability 준비

Response용 Aura 확보
```

---

### 7.3 Enemy Knowledge

특정 존재·종족·능력에 대한 대응법이다.

예:

```text
거대 악마 사냥법

용의 비늘 파훼법

사령술사 상대법

심연 생물의 시야에서 벗어나는 법
```

영향:

```text
Target Priority

Position

Ability Selection

Response Selection

Counterplay
```

---

### 7.4 Ability Knowledge

자신이 가진 능력을 더 정교하게 운용하는 방법이다.

예:

```text
사슬 운용술

표식 연계법

축적력 방출

관찰 후 봉인

보호 영역 운용
```

영향:

```text
Condition 성립

Contract 활용

World Operation 선택

Ability 연계
```

---

## 8. Combat Knowledge 획득

전투 지식은 UI 메뉴에서 구매하는 추상적인 Perk가 아니다.

가능하면 세계 안의 원인을 통해 습득한다.

대표 획득원:

```text
Class 성장

스승에게 전수

조직 / 유파 가입

책 / 비전서 연구

Monster 관찰

Monster 반복 전투

특정 실패 경험

특정 성공 경험

고대 기록 해독

Item 분석

특정 지역 조사

다른 Actor에게 전수

Contract 수행

특정 Ability 숙련
```

예:

```text
백왕 기사단 수련
    ↓
「견고한 수호」

거대 악마의 공격 반복 관찰
    ↓
Knowledge:
「악마의 날개」

악마 사냥꾼에게 전수
    ↓
「악마의 날개 파훼법」

심연에서 장기간 생존
    ↓
「기력을 숨긴 채 이동하는 법」
```

Combat Knowledge 자체가 세계 콘텐츠의 보상이 된다.

---

## 9. 발견 → 이해 → 습득

특히 Enemy Knowledge는 한 번 적을 보는 것만으로 즉시 얻지 않는다.

기본 흐름:

```text
Encounter
    ↓
Observation
    ↓
Fact 발견
    ↓
Knowledge 생성
    ↓
Knowledge 충분
    ↓
전투법 발견 / 전수
    ↓
Combat Knowledge 획득
```

예:

```text
거대 악마 첫 조우

"원거리 공격이 이상하게 되돌아온다."
        ↓
반복 관찰

"날개를 펼친 동안에만 반사된다."
        ↓
Knowledge 획득

「악마의 날개 — Aura Projectile Reflect」
        ↓
사냥꾼 NPC에게 질문 / 직접 연구
        ↓
Combat Knowledge

「악마의 날개 파훼법」
```

전투와 탐험이 성장으로 직접 연결된다.

---

## 10. Combat Knowledge 장착

Actor가 획득한 모든 Knowledge를 동시에 완벽하게 활용하게 하지 않는다.

Actor는 제한된 `Combat Knowledge Slot`을 가진다.

예:

```text
Combat Knowledge Slots = 4
```

플레이어는 전투 전에 준비한다.

```text
[견고한 수호]

[기력 보존]

[악마의 날개 파훼법]

[표식 연계술]
```

즉 플레이어가 만드는 것은 규칙이 아니라:

> 이번 전투에서 무엇을 알고 싸울 것인가

라는 준비다.

---

## 11. 왜 슬롯 제한이 필요한가

모든 지식이 항상 적용된다면 지식을 많이 모은 플레이어가 아무 선택 없이 절대적으로 우월해진다.

슬롯 제한이 있으면:

```text
Collection
        ↓
Selection
        ↓
Build
```

가 된다.

예를 들어 동일한 Guardian이라도:

### Raid Guardian

```text
견고한 수호
광역 공격 대응
장기전 기력 보존
악마의 날개 파훼법
```

### PvP Guardian

```text
Ability 관찰
Contract 간파
봉인 대응
역공의 자세
```

### Exploration Guardian

```text
Ambush 대응
독성 생물 대응
Aura 보존
동료 보호
```

처럼 달라진다.

---

## 12. Combat Knowledge와 Character Capability

중요한 원칙:

> Combat Knowledge가 Actor에게 존재하지 않는 능력을 만들어내지는 않는다.

예:

```text
「견고한 수호」
```

를 배웠다고 해서 Intercept Capability가 없는 Mage가 갑자기 Intercept를 사용할 수 있는 것은 아니다.

Combat Knowledge는:

```text
Actor가 가진 Capability를
더 적절하게 운용한다.
```

따라서:

```text
Combat Knowledge
        +
Character Capability
        ↓
Actual Behavior
```

이다.

동일한 Knowledge도 캐릭터마다 다른 행동이 나온다.

---

## 13. 같은 지식, 다른 캐릭터

예:

Combat Knowledge

```text
「위험한 동료를 우선 보호한다」
```

Guardian:

```text
Approach
→ Intercept
→ Guard
```

Barrier Mage:

```text
Barrier
→ 접근 차단
```

Space User:

```text
Position Swap
→ 공격 Target 변경
```

Binder:

```text
Attacker Mark
→ Movement Bind
```

Knowledge는 목적과 판단법을 제공한다.

실행 방식은 캐릭터가 가진 Capability에서 나온다.

이 때문에 캐릭터 개성이 유지된다.

---

## 14. Aura/Nen과의 연결

Aura를 플레이어가 직접 퍼센트 단위로 제어하지 않는다.

Aura 운용 역시 Combat Knowledge가 확장할 수 있다.

초기 Actor:

```text
기본 Aura 운용
```

지식 습득:

```text
「기력 보존」

위험하지 않은 상황에서
Aura Reserve를 유지한다.
```

추가 지식:

```text
「능력 준비」

Contract 성립 가능성이 높아지면
Ability 발동에 필요한 Aura를 미리 확보한다.
```

추가 지식:

```text
「전신 강화」

근접 교전이 지속될 때
BODY Allocation을 우선한다.
```

따라서 Aura 숙련은:

```text
숫자 조작 증가
```

가 아니라:

```text
운용법의 종류 증가
```

로 성장한다.

---

## 15. Response와의 연결

Combat Response 역시 기본 Capability와 Knowledge를 분리한다.

예:

```text
Capability:
Guard

Knowledge:
없음
```

이라면 Actor는 기본적인 Guard만 수행한다.

이후:

```text
「대형 공격 흘려내기」
```

를 배우면:

```text
Heavy Attack
    ↓
Guard로 단순히 받아내는 대신
피해와 Resource 손실을 최소화하는 Response 운용
```

을 할 수 있다.

또:

```text
「역공의 자세」
```

가 있다면:

```text
Guard 가능한 공격
+
상대가 Exposed될 가능성이 높은 상황
        ↓
Counter 성립을 고려한 Response 운용
```

이 가능해진다.

숙련은 Response 버튼 추가가 아니라 Response를 사용하는 지능의 증가다.

---

## 16. Contract와의 연결

Contract는 특히 Knowledge와 강하게 연결된다.

예:

```text
Ability:
Judgement Chain

Contract:
나를 먼저 공격한 대상에게만 사용 가능
```

초기 사용자는 단순히 조건이 우연히 성립할 때 사용한다.

하지만:

```text
「심판의 사슬 운용술」
```

을 습득하면:

```text
Judgement Target 지정
        ↓
Contract 미충족 확인
        ↓
불필요한 선제 공격 억제
        ↓
Target 행동 관찰
        ↓
Target의 공격으로 Contract 성립
        ↓
Judgement Chain 사용
```

과 같은 운용이 가능하다.

즉:

> Contract 자체가 강한 능력을 만들고
> Combat Knowledge가 그 Contract를 잘 성립시키는 법을 제공한다.

---

## 17. Combat Intent의 역할 변경

기존 심층 전투 문서의:

```text
ASSAULT
DEFEND
OBSERVE
PRESERVE
ABILITY
```

같은 Combat Intent는 유지할 수 있다.

다만 플레이어가 계속 직접 전환하는 주된 UI일 필요는 없다.

Combat Knowledge가 상황을 해석하여 적절한 Intent를 제안하거나 선택한다.

예:

```text
「미지의 적을 대하는 법」

Unknown Ability 감지
        ↓
OBSERVE
```

```text
「기력을 아껴라」

Aura Reserve 위험
        ↓
PRESERVE
```

```text
「빈틈을 놓치지 않는다」

Target Exposed
        ↓
ASSAULT
```

따라서 구조는:

```text
Combat Knowledge
        ↓
Situation Interpretation
        ↓
Combat Intent
        ↓
Aura / Response / Ability
```

가 된다.

Combat Intent는 Knowledge의 실행 언어에 가까워진다.

---

## 18. Combat Knowledge의 성장

Combat Knowledge 자체도 성장 가능한 개체가 될 수 있다.

단순 수치 강화보다는 더 깊은 상황 이해 또는 더 정교한 운용법을 획득하는 방식으로 성장한다.

예:

### 기력 보존 I

```text
Aura가 부족하면
고비용 Ability 사용 억제
```

### 기력 보존 II

```text
향후 필요한 Response 비용까지 고려하여
Aura Reserve 확보
```

### 기력 보존 III

```text
Contract 발동 가능성과
Enemy Ability까지 고려하여
필요 Reserve 판단
```

즉:

```text
효과 +10%
```

가 아니라:

```text
판단할 수 있는 세계 상태가 증가
```

하는 것이 이상적이다.

---

## 19. 지식 성장의 근거

Knowledge 성장은 실제 경험과 연결한다.

예:

```text
기력 보존 사용
+
Aura 고갈 상황 반복 경험
        ↓
보다 정교한 Aura 소비 패턴 이해
        ↓
기력 보존 II
```

또는:

```text
거대 악마 사냥법 I
+
악마 개체 다수 관찰
+
특정 특수 개체 발견
        ↓
거대 악마 사냥법 II
```

이렇게 하면 지식도 다른 게임 시스템과 마찬가지로 세계에서 성장한다.

---

## 20. 지식의 변형

모든 Combat Knowledge가 단일 직선 성장일 필요는 없다.

예:

```text
기본 검술 대응
        │
        ├─ 중검 대응
        │
        ├─ 쌍검 대응
        │
        └─ 장검 Counter 중심
```

또는:

```text
악마 사냥법
        │
        ├─ 비행 악마
        ├─ 심연 악마
        └─ 군체 악마
```

따라서 지식 자체도 성장 그래프를 형성할 수 있다.

---

## 21. 지식의 희소성

Combat Knowledge는 장비와 마찬가지로 가치 차이를 가질 수 있다.

하지만 단순:

```text
Common
Rare
Epic
Legendary
```

에 따른 숫자 상승만을 의미해서는 안 된다.

희귀한 지식일수록:

```text
더 희귀한 Situation을 이해하거나

더 강력한 Capability를 운용하거나

더 복잡한 Contract를 활용하거나

일반적으로 알기 어려운 Counterplay를 제공한다.
```

예:

```text
일반 지식:
화염 공격은 멀리 떨어진다.

희귀 지식:
화염술사의 Aura 순환이 끊기는 순간을 식별한다.

전설적 지식:
특정 화염술의 Contract 구조 자체를 역이용한다.
```

---

## 22. 지식과 세계의 조직

Combat Knowledge는 세계의 문화와 조직을 표현하는 중요한 수단이 된다.

예:

### 백왕 기사단

```text
왕을 대신해 죽는 법

전선 유지

대형 적 저지

동료 Intercept
```

### 심연 사냥꾼

```text
보이지 않는 적 감지

Aura 은폐

괴물 행동 분석

도주 경로 확보
```

### 사슬 유파

```text
표식 유지

Contract 유도

Bind 연계

상대 Capability 봉인
```

조직의 차이를 단순 장비 외형이 아니라 싸우는 사고방식으로 표현할 수 있다.

---

## 23. 지식 전수

Knowledge가 세계의 객체라면 Actor 사이에 전수될 수 있다.

```text
Master
    ↓
Student
```

단, 모든 지식이 즉시 완벽히 복제될 필요는 없다.

예:

```text
스승의 전수
    ↓
Knowledge 획득

실전 경험 없음
    ↓
숙련도 낮음

사용 / 경험
    ↓
완전한 Combat Knowledge로 정착
```

이를 통해:

```text
교관
길드
학교
기사단
사냥꾼 협회
비밀 유파
```

같은 세계 구조가 실제 성장 콘텐츠가 된다.

---

## 24. 지식과 Item의 연결

Combat Knowledge는 Item으로부터도 획득할 수 있다.

예:

```text
고대 검술서
    ↓
읽기
    ↓
「역공의 자세」 습득
```

하지만 책 자체와 Knowledge를 구분한다.

```text
Book
= Knowledge를 전달하는 Item

Combat Knowledge
= Actor에게 남은 학습 결과
```

따라서 책을 버려도 배운 지식은 유지될 수 있다.

반대로:

```text
특수 Artifact를 장착했을 때만
Knowledge 사용 가능
```

같은 설계도 가능하다.

---

## 25. 플레이어 숙련의 정의

이 시스템에서 플레이어 숙련은 네 단계로 발전한다.

### 1. Character Knowledge

```text
내 캐릭터는 무엇을 할 수 있는가?
```

### 2. World Knowledge

```text
상대와 세계는 어떤 규칙으로 움직이는가?
```

### 3. Combat Knowledge Collection

```text
그 상황을 상대하기 위해
어떤 전투법을 알고 있는가?
```

### 4. Preparation

```text
이번 전투에는
어떤 지식을 가져갈 것인가?
```

결과:

```text
Character Understanding
        +
World Understanding
        +
Knowledge Collection
        +
Knowledge Selection
        ↓
Combat Mastery
```

---

## 26. 숙련의 핵심은 정답 암기가 아니다

특정 Boss에게:

```text
Knowledge A만 끼면 정답
```

이 되어서는 안 된다.

하나의 상황에 여러 대응 지식이 존재할 수 있어야 한다.

예:

```text
Enemy:
강력한 Projectile Reflect
```

대응:

```text
Knowledge A
→ 근접 접근

Knowledge B
→ Projectile 사용 억제

Knowledge C
→ Reflect 자체를 Aura Seal

Knowledge D
→ Reflect를 역이용하여 다른 Target 공격

Knowledge E
→ 방어 상태 종료까지 Aura 보존
```

따라서 Knowledge 역시 Character Capability와 조합되어 다른 전략을 만든다.

---

## 27. 전투 준비 플레이

Combat Knowledge는 MMORPG의 전투 전 준비를 의미 있게 만든다.

예:

```text
거대 악마 지역 진입

Known Threats:
- Wing Reflect
- Fire Breath
- Fear Aura
- Flying Phase
```

플레이어가 보유한 지식:

```text
악마의 날개 파훼법

화염 호흡 대응

Fear Resistance 운용

기력 보존

동료 보호

비행 적 추격

역공
```

Knowledge Slot = 4라면 선택이 필요하다.

이것이 실질적인 Build 선택이다.

---

## 28. 예상하지 못한 상황

모든 지식을 완벽하게 준비하지 못하는 상황도 중요하다.

예:

```text
예상:
일반 거대 악마

실제:
변이 개체
```

새로운 Ability:

```text
Blood Mist
```

관련 Knowledge가 없다.

따라서:

```text
기존 Combat Knowledge로 대응 불가능
        ↓
기본 Character Capability로 버팀
        ↓
관찰
        ↓
새로운 Knowledge 발견
```

이 과정 자체가 새로운 성장으로 이어진다.

---

## 29. 실패 역시 지식의 원천

전투 실패를 단순 손실로 끝내지 않는다.

예:

```text
Player Party 전멸
        ↓
Combat Record 생성

관찰:
Boss가 세 번째 Roar 이후
항상 Aura Burst 사용
        ↓
Knowledge Progress
```

반복 전투가 단순 패턴 암기가 아니라 실제 세계 Knowledge 획득으로 표현된다.

---

## 30. UI 원칙

플레이어에게 내부 Rule Script를 노출하지 않는다.

Knowledge 선택 화면은 아이템/Skill 장착과 비슷해야 한다.

예:

```text
COMBAT KNOWLEDGE

[ 견고한 수호 ]
보호 대상이 위험할 때
보호 행동을 우선한다.

[ 기력 보존 ]
필요 이상의 Aura 소비를 억제하고
비상 대응 자원을 확보한다.

[ 악마의 날개 파훼법 ]
Wing Reflect 동안
반사 가능한 공격을 억제한다.

[ 관찰 후 봉인 ]
충분히 분석한 Ability를
봉인 대상으로 우선한다.
```

플레이어는 효과를 이해하고 선택하면 된다.

---

## 31. 내부 Rule은 관찰 가능해야 한다

플레이어가 Script를 편집하지 않더라도 시스템 검증을 위해 내부 판단은 관찰 가능해야 한다.

예:

```text
Active Knowledge:
악마의 날개 파훼법

Observed:
Target.WingReflect = true

Decision:
Suppress Projectile Ability

Intent:
APPROACH

Aura:
BODY priority

Reason:
COMBAT_KNOWLEDGE_DEMON_WING_COUNTER
```

AI Agent와 개발자는:

> 왜 캐릭터가 이 행동을 했는가?

를 항상 추적할 수 있어야 한다.

---

## 32. Knowledge 충돌

서로 다른 Knowledge가 다른 판단을 요구할 수 있다.

예:

```text
기력 보존
→ Aura 소비 금지

악마의 날개 파훼법
→ 접근을 위해 Aura 이동 Skill 사용 권장
```

이를 플레이어가 Rule Priority를 직접 편집하게 만들지 않는다.

대신 각 Knowledge는 설계된 중요도와 Situation Specificity를 가진다.

기본 원칙:

```text
Specific Counter Knowledge
        >
General Combat Knowledge
```

예:

```text
특정 Boss 파훼법
        >
일반 기력 보존
```

필요하다면 특정 Knowledge끼리는 설계적으로 `Conflict` 관계를 정의하여 동시에 장착할 수 없게 할 수도 있다.

---

## 33. 지식 조합

일부 Knowledge는 서로 조합되어 새로운 행동을 가능하게 할 수 있다.

예:

```text
Skill Observation
        +
Ability Seal
        ↓
「관찰 후 봉인」
```

또는:

```text
Intercept
        +
Aura Absorption
        ↓
「대신 받아 흡수한다」
```

다만 플레이어가 직접 규칙을 작성하는 것은 아니다.

게임이 정의한 의미 있는 Knowledge 조합을 발견하는 방식으로 한다.

---

## 34. 성장과 Class Change

Combat Knowledge는 Class 성장과도 연결된다.

예:

```text
Apprentice Guardian

기본:
Guard 이해
Protect 이해
```

성장:

```text
Guardian

견고한 수호
Intercept 운용
```

상위 Class:

```text
Royal Guardian

다중 보호
공격 Redirect
Aura Shield 운용
왕실 수호 Contract
```

즉 Class Change는:

```text
Stat 증가
+
Skill 획득
+
새로운 Combat Knowledge 접근
```

을 함께 제공할 수 있다.

---

## 35. Monster 역시 Combat Knowledge를 가질 수 있다

Combat Knowledge는 플레이어 전용 시스템일 필요가 없다.

지능 있는 Actor는 자신만의 전투 지식을 가진다.

예:

```text
늑대 무리

「약한 먹이를 노린다」
```

```text
기사단 병사

「전열을 유지한다」
```

```text
숙련된 Nen Hunter

「Unknown Ability부터 분석한다」
```

따라서 NPC 전투 행동도 임의 AI Behavior가 아니라 세계 속에서 그 Actor가 무엇을 배웠는가로 설명 가능해진다.

---

## 36. 지식을 잃을 수도 있는가

기본적으로 학습한 Knowledge는 Actor의 성장 결과이므로 유지한다.

하지만 세계관에 따라:

```text
기억 봉인

정신 손상

Contract

특수 Ability

Class Change
```

등으로 Knowledge 접근이 제한되는 특수 상황은 만들 수 있다.

중요한 것은 이것 역시 명시적인 WorldState 변화여야 한다.

---

## 37. 첫 번째 구현 범위

초기부터 거대한 Knowledge System을 만들지 않는다.

최초 검증에는 다음 정도면 충분하다.

### Guardian Knowledge

```text
견고한 수호
```

### Aura Knowledge

```text
기력 보존
```

### Monster Knowledge

```text
거대 악마의 날개 파훼법
```

### Ability Knowledge

```text
관찰 후 봉인
```

네 Knowledge가 각각:

```text
Response
Aura
Enemy Counterplay
Ability
```

를 실제로 변화시키는지만 검증한다.

---

## 38. 첫 번째 검증 시나리오

플레이어에게 동일한 Character를 제공한다.

### Knowledge 없음

```text
기본 Character 판단만 사용
```

### 견고한 수호 장착

```text
Ally 위협 대응 변화
```

### 기력 보존 장착

```text
Aura 소비 패턴 변화
```

### 악마의 날개 파훼법 장착

```text
Wing Reflect 대응 변화
```

플레이어가 별도의 Rule을 작성하지 않았음에도:

> 장착한 지식에 따라 같은 캐릭터가 명확하게 다르게 싸운다.

면 1차 성공이다.

---

## 39. 성공 조건

Combat Knowledge 시스템은 다음을 만족해야 한다.

1. 플레이어가 규칙이나 Script를 직접 작성하지 않는다.
2. 하나의 Knowledge가 완성된 전투 판단법으로 존재한다.
3. Knowledge 획득에는 세계 안의 원인이 존재한다.
4. Knowledge는 Character Capability를 활용하며 없는 Capability를 임의 생성하지 않는다.
5. 동일한 Knowledge도 Character마다 다른 방식으로 실행될 수 있다.
6. Knowledge 선택에 따라 실제 전투 행동이 관찰 가능하게 달라진다.
7. 상대에 대한 Knowledge 축적이 실제 전투 숙련 향상으로 연결된다.
8. 강한 Knowledge를 얻는 것뿐 아니라 현재 상황에 무엇을 준비할지가 중요하다.
9. Aura / Response / Contract / Ability Rule과 자연스럽게 연결된다.
10. 모든 판단 결과를 WorldState와 Combat Report에서 설명할 수 있다.

---

## 40. 최종 구조

```text
                    WORLD
                      │
             경험 · 관찰 · 전수
                      ↓
                 Knowledge
                      ↓
             Combat Knowledge
                      │
          ┌───────────┼───────────┐
          │           │           │
       획득          성장        선택
          │           │           │
          └───────────┼───────────┘
                      ↓
                  Character
                      │
           상황을 Knowledge로 해석
                      ↓
                 Combat Intent
                      │
            ┌─────────┼─────────┐
            │         │         │
          Aura     Response   Ability
            │         │         │
            └─────────┼─────────┘
                      ↓
                  World Rule
                      ↓
                  WorldState
```

---

## 41. 최종 플레이 루프

```text
새로운 적과 조우
        ↓
모르는 능력 때문에 고전
        ↓
관찰 / 조사 / 경험
        ↓
세계 Knowledge 획득
        ↓
스승 / 연구 / 실전을 통해
Combat Knowledge 습득
        ↓
보유 지식 중 필요한 것을 선택
        ↓
Character에 적용
        ↓
같은 적을 다른 방식으로 상대
        ↓
더 깊은 능력 / 약점 발견
        ↓
Knowledge 확장
```

이 반복이 전투 성장의 중요한 축이 된다.

---

## 42. 핵심 원칙

플레이어는 전투 AI를 프로그래밍하지 않는다. 전투법을 배운다.

Combat Knowledge는 세계에 대한 사실이 아니라, 그 사실을 실제 전투 판단으로 변환하는 습득 가능한 지식이다.

지식을 많이 수집하는 것만으로 숙련자가 되지 않는다. 현재 상대와 자신의 Capability에 맞는 지식을 준비하는 것이 중요하다.

Response 숙련은 반사 신경의 향상이 아니라 더 나은 대응법을 습득하는 것이다.

Aura 숙련은 세밀한 게이지 조작이 아니라 더 나은 힘의 운용법을 습득하는 것이다.

Nen/Contract 숙련은 강한 능력을 얻는 것뿐 아니라 그 능력의 조건을 성립시키는 방법을 배우는 것이다.

전투 경험은 단순히 경험치가 아니라 새로운 Knowledge를 발견할 기회가 된다.

최종적으로 이 시스템은 전투 숙련을:

```text
손이 빨라진다
```

가 아니라

```text
더 많이 안다
    ↓
더 좋은 전투법을 배운다
    ↓
상황에 맞게 준비한다
    ↓
자신의 Character Capability를 더 잘 활용한다
```

로 표현한다.

이를 통해 캐릭터 성장, 클래스 성장, 몬스터 연구, 탐험, NPC 전수, 조직, 아이템, Aura/Nen과 전투 시스템이 하나의 지식 기반 MMORPG 성장 구조로 연결된다.
