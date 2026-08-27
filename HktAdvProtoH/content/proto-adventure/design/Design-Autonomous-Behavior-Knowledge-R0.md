# Design-Autonomous-Behavior-Knowledge-R0

## 자율 존재 행동·지식·성향 통합 설계

> **참조 문서**
>
> - `Design-Combat-Knowledge-Extension-R0.md`
>
> 본 문서는 `Design-Combat-Knowledge-Extension-R0.md`의 **Knowledge / Combat Knowledge 철학을 자율 존재의 전체 행동 체계로 확장**한다.
>
> 참조 문서에서 Combat Knowledge는 새로운 전투 능력을 만드는 것이 아니라, **Actor가 이미 가진 Capability를 현재 상황에 적절하게 운용하기 위한 완성된 판단법**으로 정의된다.
>
> 본 문서는 이 원칙을 전투 밖까지 일반화한다.
>
> ```text
> Design-Combat-Knowledge-Extension-R0
>            │
>            │ 전투 영역에서 정의
>            ↓
>      Combat Knowledge
>            │
>            │ 본 문서에서 일반화
>            ↓
>     Operational Knowledge
>            │
>     ┌──────┼──────────┐
>     ↓      ↓          ↓
>   Combat  Trade    Survival ...
> Knowledge Knowledge Knowledge
> ```
>
> 따라서 **Combat Knowledge의 의미와 규칙은 본 문서가 다시 정의하지 않는다.**
>
> `Combat Knowledge`는 `Operational Knowledge`의 전투 특화 하위 유형으로 참조한다.

---

# 0. 한 문장 설계

> **자율 존재는 자신이 인지하고 알고 있는 세계를 바탕으로 목적을 세우고, 습득한 행동 지식을 통해 가능한 전략을 해석하며, 자신의 Capability와 성향에 맞는 행동을 선택한다.**

자율 존재의 행동은 다음 여섯 요소로 설명되어야 한다.

```text
Goal
무엇을 원하는가

Knowledge
무엇을 알고 있는가

Operational Knowledge
어떻게 해야 하는지 무엇을 배웠는가

Capability
실제로 무엇을 할 수 있는가

Disposition
무엇을 선호하거나 꺼리는가

WorldState
지금 실제로 무슨 일이 벌어지고 있는가
```

최종 행동은 이들의 결합이다.

```text
WorldState
    ↓
Perception
    ↓
Knowledge
    ↓
Situation Interpretation
    ↓
Goal
    ↓
Operational Knowledge
    ↓
Strategy Candidates
    ↓
Disposition + Capability
    ↓
Behavior
    ↓
Action
    ↓
World Rule
    ↓
WorldState
```

---

# 1. 왜 Knowledge가 필요한가

기존 자율 행동 시스템만 사용하면 다음과 같은 구조가 된다.

```text
침입자가 영역에 들어왔다.
        ↓
영역을 지킨다.
        ↓
경고 / 추격 / 공격 / 후퇴
        ↓
성향 가중치로 하나를 선택
```

이것만으로도 개체 차이는 만들 수 있다.

하지만 문제가 있다.

왜 어떤 몬스터는 인간의 활을 피해 접근하는가?

왜 어떤 상인은 위험한 숲의 안전한 길을 알고 있는가?

왜 숙련된 기사와 초보 기사가 같은 몸과 같은 기술을 가지고도 다르게 싸우는가?

이를 전부 `aggression`, `intelligence`, `caution` 같은 가중치로 표현하면:

```text
지능이 높아서 좋은 판단을 한다.
```

라는 설명 불가능한 AI가 된다.

따라서 세 요소를 분리한다.

```text
Disposition
→ 무엇을 선호하는가

Knowledge
→ 무엇을 알고 있는가

Operational Knowledge
→ 알고 있는 것을 행동에 어떻게 적용하는가
```

---

# 2. Knowledge의 세 층

## 2.1 Knowledge — 사실을 안다

세계에 관한 사실이다.

```text
붉은갈기 영역수는 정오 무렵 물가로 간다.
북쪽 계곡에는 청명초가 자란다.
화염술사는 큰 공격 전에 손의 Aura가 강해진다.
저 플레이어는 과거에 나를 공격했다.
```

Knowledge 자체는 행동 명령이 아니다.

참조 문서 역시 일반 Knowledge를 세계에 관한 사실로, Combat Knowledge를 그 사실의 전투 적용법으로 분리한다.

---

## 2.2 Operational Knowledge — 행동하는 법을 안다

Knowledge를 실제 행동 판단으로 변환하는 완성된 지식이다.

```text
「불길을 피해 먹이를 쫓는 법」
「희귀 약초를 효율적으로 채집하는 법」
「위험 지역을 통과하는 법」
「손님과 흥정하는 법」
「도둑을 상대하는 법」
```

Operational Knowledge는 내부적으로 판단 규칙을 갖지만 Actor나 플레이어가 이를 직접 작성하지 않는다.

```text
Knowledge:
불타는 영역은 접근하면 위험하다.

Operational Knowledge:
「불길을 피해 추격하는 법」

FireArea가 직접 경로에 존재
        ↓
직선 접근 억제
        ↓
우회 경로 선호
```

---

## 2.3 Combat Knowledge

Combat Knowledge는 Operational Knowledge의 전투 특화 계열이다.

```text
Operational Knowledge
│
├─ Combat Knowledge
├─ Survival Knowledge
├─ Trade Knowledge
├─ Profession Knowledge
├─ Exploration Knowledge
└─ Social Knowledge
```

Combat Knowledge의 세부 구조는 본 문서에서 다시 정의하지 않고 `Design-Combat-Knowledge-Extension-R0.md`를 Source of Truth로 사용한다.

참조 문서에서 Combat Knowledge는 다음 흐름을 가진다.

```text
World
↓
Knowledge
↓
Combat Knowledge
↓
Combat Intent
↓
Aura / Response / Ability
↓
World Rule
```

본 문서에서는 이를 자율 존재 행동 구조 안에 다음처럼 연결한다.

```text
Goal
↓
Combat Knowledge
↓
Combat Strategy
↓
Combat Intent
↓
Aura / Response / Ability
↓
Action
```

---

# 3. Goal — 무엇을 원하는가

Goal은 행동의 이유다.

예:

```text
살아남는다.
배고픔을 해결한다.
영역을 지킨다.
동료를 보호한다.
재고를 확보한다.
돈을 번다.
가게를 운영한다.
명령을 수행한다.
```

Goal은 Knowledge와 다르다.

```text
Goal:
살아남는다.

Knowledge:
저 동굴에는 강한 포식자가 산다.

Operational Knowledge:
「포식자의 영역을 안전하게 지나가는 법」
```

Knowledge가 Goal을 만들 필요는 없다.

대신 Knowledge는 **Goal을 어떻게 달성할 것인가**를 바꾼다.

---

# 4. Capability — 무엇을 실제로 할 수 있는가

Operational Knowledge가 새로운 물리 능력을 만들어내서는 안 된다.

이 원칙은 `Design-Combat-Knowledge-Extension-R0.md`의 Combat Knowledge 규칙을 그대로 따른다.

참조 문서는:

> Combat Knowledge + Character Capability → Actual Behavior

의 관계를 정의한다.

자율 행동에서도 같다.

예:

```text
Operational Knowledge:
「위협적인 대상을 안전하게 제압한다」
```

Actor A:

```text
Capability:
Shield
Intercept
Push
```

결과:

```text
막는다
→ 밀어낸다
```

Actor B:

```text
Capability:
Bind
Range Attack
```

결과:

```text
거리를 둔다
→ 속박한다
```

Actor C:

```text
Capability:
Run
Hide
```

결과:

```text
싸우지 않는다
→ 도망친다
→ 숨는다
```

같은 지식이라도 몸이 다르면 행동이 달라진다.

---

# 5. Disposition — 무엇을 선호하는가

Disposition은 지식이나 능력이 아니다.

```text
겁이 많다.
호기심이 많다.
공격적이다.
재산에 집착한다.
영역 집착이 강하다.
동료애가 강하다.
욕심이 많다.
끈질기다.
```

예:

두 상인 모두 다음을 안다.

```text
Knowledge:
서쪽 길에는 도적이 자주 출몰한다.

Operational Knowledge:
「도적이 많은 길을 피하는 법」
```

상인 A:

```text
risk_aversion = 높음
```

→ 우회한다.

상인 B:

```text
risk_aversion = 낮음
profit_desire = 높음
```

→ 시간 절약을 위해 그대로 통과한다.

둘은 **똑같이 알고 있지만 가치 판단이 다르다.**

---

# 6. 행동 가능성 Graph

그래프는 모든 구체적인 상황의 정답을 미리 작성하는 것이 아니다.

그래프가 정적으로 정의하는 것은:

```text
무엇을 원할 수 있는가
무엇을 할 수 있는가
어떤 전략이 가능한가
어떤 행동을 조합할 수 있는가
```

이다.

기본 구조:

```text
Goal
↓
Strategy
↓
Behavior
↓
Action
↓
World Result
```

Knowledge는 이 그래프 위에서 **현재 상황에서 어떤 경로가 의미 있는지를 해석한다.**

예:

```text
G_PROTECT_TERRITORY
│
├─ Observe
├─ Warn
├─ Approach
├─ DriveOut
├─ Attack
└─ Retreat
```

기본 몬스터:

```text
침입자가 접근
→ 경고 또는 접근
```

인간 사냥꾼에 대한 지식을 가진 몬스터:

```text
Knowledge:
활은 거리를 벌렸을 때 위험하다.

Operational Knowledge:
「활 사냥꾼에게 접근하는 법」
→ 직선 접근 억제
→ 장애물 접근 선호
→ 사격 직후 접근 선호
```

그래프에 새로운 `HumanArcherAttackBehavior`를 만드는 것이 아니다.

기존 행동 가능성을 지식이 다르게 평가한다.

---

# 7. 판단은 Event 하나로 시작하지 않는다

자율 행동은 단순한 Event Driven AI가 아니다.

판단은 **의미 있는 세계 변화**에 의해 다시 평가된다.

```text
외부 사건
공격받음
도난당함
영역 침입

인지 변화
새로운 대상을 발견
대상을 놓침

자기 상태 변화
생명 감소
배고픔 증가
피로 증가

관계 변화
신뢰 변화
동료 사망
명령 수신

시간
아침
영업 시작
경고 후 3초 경과

행동 결과
이동 성공
채집 실패
공격 실패

조건 문턱
생명 30% 이하
재고 5개 이하
배고픔 70% 이상
```

이를 통틀어:

```text
Reevaluation Signal
```

이라 한다.

---

# 8. 재평가 구조

```text
WorldState 변화
      ↓
Reevaluation Signal
      ↓
관련 Goal Dirty
      ↓
Goal 재평가
      ↓
현재 Goal 유지 또는 변경
      ↓
관련 Knowledge 활성화
      ↓
Strategy 평가
      ↓
Behavior 선택
```

모든 NPC가 매 Tick 전체 행동 그래프를 다시 계산하지 않는다.

Action이 정상 진행 중이라면 그대로 실행한다.

```text
MOVE_TO 실행 중
→ AI 전체 재판단 없음
```

그러다:

```text
길이 막힘
대상 소실
위험 증가
더 중요한 Goal 활성화
```

가 발생하면 다시 판단한다.

---

# 9. Knowledge 활성화

NPC가 보유한 모든 Knowledge를 항상 평가하지 않는다.

Knowledge에는 최소한 다음 구조가 있다.

```yaml
OperationalKnowledge:
  id:
  required_knowledge:
  applicable_situation:
  interpretation:
  preferred_strategy:
  guidance:
  exit_condition:
```

현재 상황과 관련된 것만 활성화한다.

예:

```text
보유 Knowledge = 30

현재:
약초 채집 중

관련 Knowledge:
- 계절별 약초 채집
- 붉은갈기 영역 회피
- 우천 후 희귀 약초 채집

Active Knowledge = 3
```

Combat Knowledge 역시 동일한 원리를 따르며 세부 규칙은 참조 문서에 따른다.

---

# 10. Knowledge 충돌

두 지식이 서로 다른 행동을 권할 수 있다.

```text
「위험한 장소를 피한다」
→ 숲에 들어가지 않는다.

「우천 후 청명초 채집」
→ 오늘 북쪽 숲에 들어간다.
```

NPC가 직접 Rule Priority를 가지는 스크립트 구조로 만들지 않는다.

Combat Knowledge 문서에서 정의한 원칙처럼 **상황 특이성과 지식 자체의 중요도**를 이용한다.

예:

```text
Specific Knowledge
>
General Knowledge
```

그리고 최종 선택에는 Disposition도 영향을 준다.

```text
청명초 가격 폭등
+
희귀 채집법
+
높은 탐욕
+
낮은 위험 회피
→ 위험을 감수하고 진입
```

---

# 11. 예제 A — 붉은갈기 영역수

## 11.1 기본 Actor

```yaml
kind: RED_MANE_BEAST

goals:
  - SURVIVE
  - SATISFY_HUNGER
  - PROTECT_TERRITORY
  - REST

capabilities:
  - WALK
  - RUN
  - BITE
  - ROAR
  - CHARGE
  - EAT

disposition:
  territory: 0.85
  self_preservation: 0.70
  aggression: 0.60
  curiosity: 0.25
```

---

## 11.2 기본 Knowledge

어린 개체:

```text
Knowledge:
자신의 사냥터 위치.

Knowledge:
먹을 수 있는 소형 생물.
```

Operational Knowledge:

```text
「영역을 지키는 기본 습성」

침입자를 발견
→ 관찰
→ 경고
→ 물러나지 않으면 몰아냄
```

---

## 11.3 경험 많은 개체

이 개체는 인간과 여러 번 싸웠다.

Knowledge:

```text
인간의 긴 활은 먼 거리에서 위험하다.
활을 쏜 직후에는 다음 공격까지 시간이 있다.
불타는 지역은 지나가면 몸이 손상된다.
```

Combat Knowledge:

```text
「인간 사냥꾼 상대법」
```

본 Knowledge는 `Design-Combat-Knowledge-Extension-R0.md`에서 정의한 Enemy Knowledge 계열과 동일한 역할을 한다. Enemy Knowledge는 Target Priority, Position, Ability Selection, Response 등에 영향을 준다.

결과:

```text
인간 침입
↓
활을 들고 있음 인지
↓
「인간 사냥꾼 상대법」 활성
↓
직선 Charge 억제
↓
바위 뒤 접근
↓
사격 이후 접근
↓
근접 거리에서 Bite / Charge
```

---

# 12. 같은 종, 다른 개체

### Beast-A

```text
Knowledge:
인간 활의 위험을 모름.

Disposition:
공격성 높음.
```

결과:

```text
침입
→ 경고
→ 정면 돌진
```

### Beast-B

```text
Knowledge:
활 공격을 경험함.

Combat Knowledge:
인간 사냥꾼 상대법

Disposition:
공격성 높음.
```

결과:

```text
침입
→ 활 확인
→ 장애물 이용
→ 사격 이후 돌진
```

### Beast-C

```text
Knowledge:
활 공격을 경험함.

Combat Knowledge:
인간 사냥꾼 상대법

Disposition:
자기 보존 매우 높음.
```

결과:

```text
침입
→ 활 확인
→ 위협 평가
→ 영역 유지보다 생존 Goal 우선
→ 후퇴
```

차이는 명확하다.

```text
A와 B:
지식 차이

B와 C:
성향 차이
```

---

# 13. 몬스터가 Knowledge를 얻는 과정

Combat Knowledge 문서는 관찰과 경험을 실제 지식 획득의 원인으로 사용한다.

NPC에게도 같은 원칙을 적용할 수 있다.

첫 전투:

```text
인간이 활을 사용
↓
화살에 피해
↓
Observation 생성
```

반복 경험:

```text
거리가 멀수록 활 공격을 자주 받음
↓
Knowledge
「인간의 활은 원거리에서 위험하다」
```

특정 경험 또는 무리 전수:

```text
Knowledge 충분
↓
Combat Knowledge 획득
「인간 사냥꾼 상대법」
```

중요한 것은 머신러닝처럼 런타임에서 새로운 알고리즘을 만드는 것이 아니다.

게임에 정의된 Knowledge가 **세계 원인을 통해 Actor에게 획득되는 것**이다.

---

# 14. 예제 B — 약초 상인 레나

## 14.1 Actor

```yaml
actor: LENA

goals:
  - SURVIVE
  - EARN_INCOME
  - MAINTAIN_STOCK
  - OPERATE_SHOP
  - REST

capabilities:
  - WALK
  - TALK
  - TRADE
  - COLLECT
  - CARRY
  - FLEE

disposition:
  risk_aversion: 0.70
  greed: 0.55
  sociability: 0.82
  property_attachment: 0.68
```

---

# 15. 초보 상인

Knowledge:

```text
북쪽 숲에 약초가 있다.
```

Profession Knowledge:

```text
「기본 약초 채집」
```

상태:

```text
HerbStock = 3
DesiredStock = 20
```

Goal:

```text
G_MAINTAIN_STOCK
```

행동:

```text
북쪽 숲 선택
↓
이동
↓
약초 탐색
↓
채집
↓
귀환
```

---

# 16. 숙련 상인

숙련된 레나는 더 많은 사실을 알고 있다.

```text
Knowledge:
비가 온 다음 날 북쪽 계곡에는 청명초가 많이 자란다.

Knowledge:
붉은갈기 영역수는 정오에 서쪽 물가로 이동한다.

Knowledge:
청명초는 최근 시장에서 높은 가격에 거래된다.
```

Operational Knowledge:

```text
「우천 후 청명초 채집법」
「붉은갈기 사냥터 통과법」
「희귀 약초 매매법」
```

현재 상태:

```text
어제 비가 왔다.
현재 10:00.
청명초 재고 부족.
청명초 가격 높음.
```

판단:

```text
G_EARN_INCOME
+
G_MAINTAIN_STOCK
        ↓
관련 Knowledge 활성
        ↓
북쪽 계곡 가치 높음
        ↓
붉은갈기 활동 시간 고려
        ↓
정오 이전 채집
```

같은 상인이지만 지식 때문에 훨씬 다른 행동을 한다.

---

# 17. 몬스터와 상인의 조우

세계 상황:

```text
10:40

레나
→ 북쪽 계곡으로 이동

붉은갈기 Beast-B
→ 영역 순찰
```

레나가 영역에 들어간다.

몬스터:

```text
Perception:
레나 발견

Goal:
PROTECT_TERRITORY

Operational Knowledge:
영역을 지키는 기본 습성

Disposition:
영역 집착 높음

→ 경고
```

레나:

```text
Perception:
붉은갈기 발견

Knowledge:
붉은갈기는 영역을 벗어나면 추격을 멈추는 경향

Operational Knowledge:
「붉은갈기 사냥터 통과법」

Goal:
SURVIVE
+
MAINTAIN_STOCK

→ 전투하지 않음
→ 영역 경계 방향으로 후퇴
```

몬스터:

```text
레나가 영역 밖으로 나감

PROTECT_TERRITORY 달성

→ 추격 종료
```

---

# 18. 지식이 없는 상인이라면

다른 상인 B는 해당 Knowledge가 없다.

```text
붉은갈기 발견

Knowledge:
없음
```

따라서 기본 위험 대응만 가능하다.

```text
위협 발견
→ 반대 방향 도주
```

문제는 그 방향이 오히려 영역 깊숙한 곳일 수 있다는 것이다.

```text
붉은갈기
→ 침입 지속
→ 추격 지속

상인
→ 더 깊이 도망
→ 위험 증가
```

같은 Capability를 가진 NPC인데도 세계에 대한 이해 차이가 실제 생존률 차이를 만든다.

---

# 19. 상인의 Combat Knowledge

레나가 전투 경험이 많은 상인이라면 Combat Knowledge도 가질 수 있다.

예:

```text
Combat Knowledge:
「짐을 지키며 도망치는 법」
```

상황:

```text
도적 접근
```

기본 상인:

```text
FLEE
```

숙련 상인:

```text
귀중품을 몸 가까이 이동
↓
도적과 거리 확보
↓
경비병 방향으로 이동
↓
필요하면 방어 Skill 사용
```

이 역시 새로운 Capability가 아니다.

레나가 실제로 가지고 있는:

```text
Carry
Move
Guard
CallForHelp
```

를 더 정교하게 사용하는 것이다.

이는 Combat Knowledge가 Character Capability를 더 잘 운용할 뿐 없는 능력을 생성하지 않는다는 참조 문서의 원칙을 그대로 따른다.

---

# 20. 경비병과의 연결

상인이 도난당했다.

```text
Event:
ItemStolen
```

레나:

```text
Knowledge:
마을 경비병이 절도를 단속한다.

Operational Knowledge:
「절도 신고법」
```

행동:

```text
경비병 탐색
↓
도난 사실 전달
```

경비병:

```text
Knowledge:
Player-1이 Merchant-Lena의 물건을 훔쳤다.
```

Goal:

```text
PROTECT_SETTLEMENT
```

Combat Knowledge:

```text
「도주 범죄자 제압법」
```

Capability:

```text
Run
Block
Bind
Attack
```

결과:

```text
출구 차단
↓
정지 명령
↓
불응
↓
Bind
```

즉 사건 하나가 직접:

```text
상인 도난
→ 경비병 공격
```

을 발생시키지 않는다.

중간에:

```text
사건
↓
인지
↓
Knowledge
↓
Goal
↓
Operational / Combat Knowledge
↓
행동
```

이 존재한다.

---

# 21. NPC 성장

NPC 성장 역시 단순 수치 증가만으로 표현할 필요가 없다.

초보 약초상:

```text
기본 약초 식별
마을 주변 채집지
```

숙련 약초상:

```text
계절별 약초 출현
위험 지역 우회
희귀 약초 판별
시장 가격 대응
```

왕실 약초상:

```text
마물 기관 약재화
독성 중화
희귀 산지 네트워크
고급 거래
```

즉:

```text
NPC 성장
=
Capability 성장
+
Knowledge 성장
+
Operational Knowledge 성장
+
관계 성장
```

으로 표현할 수 있다.

Combat Knowledge 문서 역시 전투 Knowledge의 성장을 단순 효과 증가가 아니라 **판단할 수 있는 세계 상태의 증가**로 정의한다.

같은 원칙을 자율 행동 전체에 적용한다.

---

# 22. 조직과 문화

Knowledge가 Actor의 행동 방식을 결정한다면 조직 자체가 고유한 행동 문화를 가질 수 있다.

예:

```text
백왕 기사단
├─ 전열을 유지하는 법
├─ 동료 대신 맞는 법
├─ 대형 적 저지
└─ 왕실 보호
```

```text
심연 사냥꾼
├─ 보이지 않는 존재 감지
├─ 괴물 행동 분석
├─ Aura 은폐
└─ 퇴로 확보
```

Combat Knowledge 문서에서도 조직 차이를 단순 장비가 아니라 **싸우는 사고방식의 차이**로 표현한다.

이를 일반 NPC까지 확장하면:

```text
상인 길드
→ 가격 판단법
→ 운송 위험 평가
→ 계약 관행

사냥꾼 마을
→ 흔적 읽기
→ 위험 생물 회피
→ 사체 해체

왕실 사회
→ 예법
→ 신분 판단
→ 명령 체계
```

같은 문화적 차이가 실제 행동 차이가 된다.

---

# 23. Knowledge 전수

Knowledge와 Operational Knowledge는 Actor 사이에 전달될 수 있다.

```text
스승
↓
제자

부모
↓
자식

길드
↓
회원

무리의 경험 많은 개체
↓
어린 개체
```

Combat Knowledge의 전수 원칙 역시 참조 문서에서 이미 정의되어 있다.

따라서:

```text
늙은 사냥꾼
→ 어린 사냥꾼에게 마물 대응법 전수

숙련 상인
→ 견습생에게 희귀 약초 판별법 전수

기사단 교관
→ 병사에게 전열 유지법 전수
```

가 실제 세계 성장 시스템이 된다.

---

# 24. 플레이어와 NPC의 대칭

Knowledge 시스템 역시 플레이어와 NPC에게 다른 세계 법칙을 제공하지 않는다.

```text
Player Actor
↓
Knowledge 습득
↓
Operational / Combat Knowledge 사용
```

```text
NPC Actor
↓
Knowledge 습득
↓
Operational / Combat Knowledge 사용
```

차이는 제어 방식이다.

플레이어는 자신이 준비할 Knowledge를 선택할 수 있다.

NPC는:

```text
경험
교육
직업
조직
현재 역할
```

등 세계 상태에 의해 사용 가능한 Knowledge가 결정된다.

Combat Knowledge에서 플레이어가 규칙을 직접 작성하지 않고 완성된 지식을 획득·선택한다는 원칙 역시 그대로 유지한다.

---

# 25. 구현 데이터 구조

## Actor

```yaml
Actor:
  kind:
  capabilities:
  drives:
  disposition:
  perceived_facts:
  memories:
  knowledge:
  operational_knowledge:
  relations:
  behavior_runtime:
    active_goal:
    active_knowledge:
    active_strategy:
    current_behavior:
    current_action:
    target:
```

---

# 26. Knowledge

```yaml
Knowledge:
  id:
  subject:
  facts:
  acquisition_source:
  confidence:
```

예:

```yaml
id: K_RED_MANE_TERRITORY
facts:
  - red_mane_stops_pursuit_outside_territory
```

---

# 27. Operational Knowledge

```yaml
OperationalKnowledge:
  id:
  required_knowledge:
  applicable_situation:
  interpretation:
  preferred_strategies:
  discouraged_strategies:
  required_capability:
  exit_condition:
```

예:

```yaml
id: OK_ESCAPE_RED_MANE
required_knowledge:
  - K_RED_MANE_TERRITORY
applicable_situation:
  - perceived_red_mane
  - inside_red_mane_territory
preferred_strategies:
  - MOVE_TOWARD_TERRITORY_EDGE
  - AVOID_DIRECT_COMBAT
exit_condition:
  - outside_red_mane_territory
```

---

# 28. Combat Knowledge와의 코드 관계

`CombatKnowledge`를 별도의 완전히 독립적인 AI 시스템으로 만들지 않는다.

권장 구조:

```text
OperationalKnowledge
        ↑
        │ specializes
CombatKnowledge
```

공통:

```text
Required Knowledge
Applicable Situation
Interpretation
Preferred Intent / Strategy
Exit Condition
```

Combat 전용:

```text
Aura Guidance
Response Guidance
Ability Guidance
Position Guidance
Combat Intent
```

따라서 전투 세부 구조와 성장·장착 규칙은 반드시:

```text
Design-Combat-Knowledge-Extension-R0.md
```

를 따른다.

본 문서는 그 Combat Knowledge가 **자율 존재의 Goal/Behavior 시스템 어디에 들어가는가**만 정의한다.

---

# 29. 판단 추적

모든 판단은 설명 가능해야 한다.

예:

```yaml
actor: Lena

active_goal:
  MAINTAIN_STOCK

observed:
  rain_yesterday: true
  current_time: 10:00
  clear_herb_stock: 2

known:
  - CLEAR_HERB_AFTER_RAIN
  - RED_MANE_NOON_MOVEMENT

active_knowledge:
  - AFTER_RAIN_HERB_GATHERING
  - RED_MANE_TERRITORY_TRAVEL

strategy_candidates:
  NORTH_VALLEY: 0.86
  MARKET_PURCHASE: 0.42
  NORMAL_FOREST: 0.38

selected:
  NORTH_VALLEY

reason:
  - high_clear_herb_value
  - before_red_mane_peak_activity
  - gathering_capability_available
```

Combat Knowledge 또한 참조 문서가 요구하는 것처럼 활성 Knowledge와 판단 이유를 추적할 수 있어야 한다.

---

# 30. 최종 역할 분리

| 개념 | 질문 | 예 |
|---|---|---|
| Goal | 무엇을 원하는가? | 살아남는다 |
| WorldState | 실제로 어떤 상황인가? | 불길이 앞을 막는다 |
| Perception | 무엇을 알아챘는가? | 불길을 봤다 |
| Knowledge | 무엇을 알고 있는가? | 불길은 위험하다 |
| Operational Knowledge | 어떻게 해야 하는가? | 불길을 우회한다 |
| Combat Knowledge | 전투에서 어떻게 운용하는가? | 화염술사 공격 직후 접근 |
| Capability | 무엇을 할 수 있는가? | 달리기, 점프, 공격 |
| Disposition | 무엇을 선호하는가? | 위험 회피가 높다 |
| Strategy | 어떤 방식으로 목적을 이룰까? | 우회한다 |
| Behavior | 구체적으로 무엇을 수행하는가? | 안전한 경로로 이동 |
| Action | 세계에 무엇을 요청하는가? | MOVE_TO |
| World Rule | 실제 결과는 어떻게 결정되는가? | 이동·충돌·기력 판정 |

---

# 31. 최종 구조

```text
                         WORLD
                           │
                           ↓
                      WorldState
                           │
                           ↓
                       Perception
                           │
                           ↓
                       Knowledge
                           │
                    현재 상황 해석
                           ↓
                         Goal
                           │
                           ↓
                Operational Knowledge
                           │
             ┌─────────────┴──────────────┐
             │                            │
             ↓                            ↓
      General Knowledge             Combat Knowledge
                                         │
                                         │
                Design-Combat-Knowledge-Extension-R0
                                         │
                                         ↓
                                   Combat Intent
                           │
                           ↓
                       Strategy
                           │
             ┌─────────────┴─────────────┐
             ↓                           ↓
        Disposition                  Capability
             └─────────────┬─────────────┘
                           ↓
                       Behavior
                           ↓
                         Action
                           ↓
                      World Rule
                           ↓
                      WorldState
```

---

# 32. 핵심 원칙

1. **NPC 행동은 플레이어에 대한 반응 스크립트가 아니라 자신의 Goal에서 시작한다.**
2. **정적 행동 그래프는 Actor가 할 수 있는 가능성을 정의한다.**
3. **Knowledge는 세계에 대해 무엇을 알고 있는지를 정의한다.**
4. **Operational Knowledge는 그 사실을 행동 판단으로 바꾸는 습득 가능한 완성된 방법이다.**
5. **Combat Knowledge는 Operational Knowledge의 전투 특화 계열이며, 세부 규칙은 `Design-Combat-Knowledge-Extension-R0.md`를 따른다.**
6. **Knowledge는 Capability를 새로 만들지 않는다. Actor가 이미 가진 Capability의 활용법을 바꾼다.**
7. **Disposition은 지식이나 지능이 아니라 선호와 가치 판단을 표현한다.**
8. **같은 종이라도 Knowledge · Operational Knowledge · Disposition · 경험이 다르면 실제 행동이 달라진다.**
9. **NPC가 영리해지는 것은 숨겨진 AI 보정값이 높아지는 것이 아니라 더 많은 사실과 행동법을 배우는 것이다.**
10. **판단은 단순 Event에만 반응하지 않는다. 인지·시간·상태·관계·행동 결과 등 의미 있는 WorldState 변화가 관련 Goal을 재평가한다.**
11. **Behavior Graph가 모든 정답을 품지 않는다. Graph는 가능성을, Knowledge는 그 가능성을 선택하는 이해를 제공한다.**
12. **모든 행동의 이유는 WorldState → Knowledge → Goal → Knowledge 적용 → Strategy → Behavior의 경로로 추적 가능해야 한다.**

---

# 33. 최종 의미

이 구조에서 NPC의 차이는 더 이상:

```text
몬스터 AI
상인 AI
경비병 AI
```

라는 서로 다른 프로그램에서 만들어지지 않는다.

하나의 자율 존재 시스템 위에서:

```text
무엇을 원하는가
+
무엇을 알고 있는가
+
어떻게 해야 하는지 무엇을 배웠는가
+
무엇을 할 수 있는가
+
어떤 성향인가
+
지금 어떤 세계에 놓여 있는가
```

의 차이로 만들어진다.

그리고 전투에 들어가는 순간 그 구조의 전투 부분을 `Design-Combat-Knowledge-Extension-R0.md`의 Combat Knowledge가 담당한다.

따라서 두 문서의 관계는 최종적으로 다음과 같다.

```text
Design-Autonomous-Behavior-Knowledge-R0
= 자율 존재가 세계에서 판단하고 행동하는 공통 상위 구조

Design-Combat-Knowledge-Extension-R0
= 그 공통 구조에서 전투 상황의 판단과 Capability 운용을 담당하는 전문 지식 체계
```

즉 `Combat Knowledge`는 별도의 전투 AI가 아니다.

> **자율 존재가 세계에서 배우고 사용하는 수많은 행동 지식 가운데, 전투라는 상황을 다루는 전문 지식이다.**

이 관계를 유지하면 몬스터·상인·경비병·기사·사냥꾼·플레이어 캐릭터가 서로 다른 AI 규칙으로 분리되지 않고, **같은 세계에서 각자가 무엇을 알고 무엇을 배웠는가에 따라 다르게 살아가는 구조**가 된다.
