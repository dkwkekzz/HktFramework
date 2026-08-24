# 베이라 요정 원리·성장 시스템 통합 설계

## 문서 목적
베이라 세계관의 세계압 → 위험 → 적응 → 자원 → Capability → 탐험 확장 구조에 요정의 존재론과 캐릭터 성장 시스템을 연결한다.
이 문서는 다른 Design/Implementation Agent가 추가 해석 없이 원리 카탈로그, 요정, Class, 성장 규칙, WorldState, ObservableState와 검증 테스트를 구현하기 위한 Source of Truth다.

---

## 1. 설계의 출발점

### 1.1 첨부 세계관에서 이미 확정된 것

베이라는 단순히 몬스터가 강한 대륙이 아니다.

높은 세계압으로 인해 생명·물질·환경이 인간 세계에서는 불가능한 상태까지 변화할 수 있는 원초 세계다.

베이라의 위험과 보물은 서로 다른 설정이 아니라 동일한 세계 법칙의 결과다.

세계압은 Mana나 단순 에너지가 아니라:

생명과 물질이 현재 상태를 넘어 다른 상태가 될 수 있도록 만드는 가능성의 압력

이다. 세계압이 높아질수록 변화 가능성, 환경 극단화, 생존 압력, 적응과 특수 Property가 함께 증가한다.

세계압은 다음 두 상태로 나타난다.

Free World Pressure
= 아직 특정 Property로 안정되지 않은 가능성
= 환경 변화와 위험을 발생시킨다.
Bound World Pressure
= 생명이나 물질이 안정된 Property로 결속한 가능성
= 기관, 식물, 광물, 소재, Item Property가 된다.

따라서 베이라의 기본 인과는 다음과 같다.

```text
Free World Pressure
↓
극단적인 환경
↓
생존 압력
↓
수많은 실패와 죽음
↓
일부 생명과 물질이 적응
↓
안정된 Property
↓
Resource
```

위험과 보물은 같은 세계압의 서로 다른 결과다.

기존 Progression 또한 단순 Level 상승이 아니다.

```text
UNKNOWN
↓
관찰
↓
이해
↓
대응 방법 발견
↓
Capability 획득
↓
Resource 획득
↓
새로운 Growth Route
↓
새로운 지역
↓
더 깊은 UNKNOWN
```

본 문서는 이 구조를 변경하지 않는다.

본 문서가 추가하는 것은 다음이다.

세계압이 하나의 자아와 선택 능력으로 결속된 경우 무엇이 되는가?

그 답이 요정이다.

---

## 2. 최종 핵심 정의

### 2.1 세계의 대원리

베이라 전체를 관통하는 가장 상위 원리는 다음과 같다.

```text
PR-POSSIBILITY:
  display_name: 가능성
  semantic: >
    현재 존재하는 상태는 최종 상태가 아니며,
    다른 상태가 될 수 있다.
```

PR-POSSIBILITY는 일반적인 플레이어블 요정 하나가 독점하는 원리가 아니다.

베이라와 세계압 전체를 설명하는 Meta Principle이다.

```text
PR-POSSIBILITY
│
├─ 가능성을 열어 둔다.
│   └─ Free World Pressure
│
├─ 환경과 생존 압력이 가능성을 선택한다.
│   └─ Adaptation
│
└─ 선택된 가능성이 Property로 안정된다.
    └─ Bound World Pressure
```

베이라는 높은 Free World Pressure 때문에 위험한 동시에, 인간 세계에서 존재할 수 없는 Property와 자원이 태어나는 곳이다.

---

### 2.2 World Principle

```text
WorldPrinciple:
  semantic: >
    세계의 특정 상태가 어떤 조건에서
    어떤 다른 상태로 변화하는지를 반복적으로 결정하는 원리.
```

원리는 단순한 테마나 명사가 아니다.

원리에는 반드시 다음이 있어야 한다.

어떤 WorldState를 다루는가?
어떤 변화를 일으키는가?
어떤 조건에서 작동하는가?
세계 안에서 반복적으로 관찰되는가?
위험과 유익한 결과가 모두 가능한가?

예:

검
→ 원리가 아니다.
→ 특정 원리를 실현하는 도구다.
경계
→ 무엇이 하나이고 무엇이 분리되어 있는지를 결정한다.
→ World Principle이 될 수 있다.

---

### 2.3 요정

```text
Fairy:
  semantic: >
    하나의 World Principle이
    지속적인 자아, 기억, 선택 능력을 가진 상태로 결속된 존재.
```

이를 Self-Bound Principle, 즉 자아 결속 원리라고 정의한다.

```text
World Pressure
│
├─ 자유 상태
│   └─ 환경 변화 / Hazard
│
├─ 물질 결속
│   └─ 광물 / 소재 / Item Property
│
├─ 생명 결속
│   └─ 기관 / 적응 / Creature Capability
│
└─ 자아 결속
    └─ Fairy
```

일반 생물과 요정의 차이는 능력의 크기가 아니다.

일반 적응 생물
= 원리를 생존 본능에 따라 반복한다.
요정
= 원리를 이해하고,
  무엇에 어떻게 적용할지 선택한다.

---

### 2.4 위험

위험은 악한 원리 때문에 발생하지 않는다.

```text
Danger:
  semantic: >
    하나의 원리가 선택과 조절 없이
    환경 또는 생존 목적에 강제 결속되어
    반복적으로 작동하는 상태.
```

예:

회귀의 요정
→ 무엇을 어느 상태로 되돌릴지 선택한다.
회귀 생물
→ 손상될 때마다 자신의 신체를 무조건 되돌린다.
회귀 Hazard
→ 영역 내부에서 발생한 모든 상태 변화를 되돌린다.

즉:

요정은 원리를 선택해서 사용하고, 위험은 원리에 의해 행동을 강제당한다.

---

### 2.5 Resource

```text
Resource:
  semantic: >
    하나의 가능성이 생명 또는 물질 안에
    안정된 Property로 결속된 것.
```

모든 중요한 Resource는 기존 정책대로 다음 Trace를 가져야 한다.

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

---

### 2.6 Class

```text
Class:
  semantic: >
    요정이 자신의 World Principle을
    특정한 해석과 사용 방식으로 안정시킨 자아 형태.
```

Class는 직업 목록이 아니다.

```text
Class
=
Principle Core
×
Principle Aspect
×
Interpretation
×
Operation
×
Target Domain
×
Constraint
```

예:

Principle Core
= Boundary
Interpretation
= 보호
Operation
= 유지
Target Domain
= 공간 영역
Constraint
= 자신이 직접 선언한 경계만 유지 가능
결과
= 경계 수호자 Class

---

### 2.7 Class Change

```text
ClassChange:
  semantic: >
    베이라에서 발견한 새로운 가능성을
    자신의 정체성을 잃지 않은 상태로
    새로운 자아 형태에 결속하는 과정.
```

Class Change는 다음 구조를 가진다.

```text
현재 Class
+
새로운 Principle Aspect 이해
+
의미 있는 경험
+
필요 Resource 또는 Property
+
의도적인 선택
+
Class Trial
↓
새 Class 해금
```

Class Change의 핵심은 다음이다.

환경이 요정을 강제로 바꾸는 것이 아니라, 요정이 무엇이 될지를 선택한다.

---

## 3. 원리로 인정하기 위한 기준

새로운 원리를 추가하려는 Agent는 아래 조건을 모두 검토해야 한다.

검증 항목	질문
상태 대상	이 원리는 어떤 WorldState를 다루는가?
연산	유지, 변화, 연결, 절단, 전달 등 어떤 변화를 일으키는가?
반복성	하나의 사건이 아니라 여러 생물·지역·자원에서 반복되는가?
독립성	특정 무기, 종족, 인물 없이도 존재하는가?
양면성	위험과 유익한 결과가 모두 가능한가?
관찰성	플레이어가 원인의 작동을 관찰할 수 있는가?
대응성	이 원리에 대응하는 Capability를 설계할 수 있는가?
성장성	최소 두 가지 이상의 Class 해석을 만들 수 있는가?
Trace	World Pressure에서 Resource까지 인과를 추적할 수 있는가?

다음은 원리로 인정하지 않는다.

검
궁수
불꽃 마법사
힐러
전설의 장비
강한 공격
얼음 던전

이들은 각각 도구, 역할, 연출, 결과 또는 콘텐츠 형식이다.

원리 후보는 다음처럼 표현해야 한다.

절단
경계
보존
전달
적응
관찰
정체성
연결
반복
종결

---

## 4. 원리의 발현 구조

하나의 원리는 세계에서 다섯 가지 형태로 나타날 수 있다.

발현 형태	설명	예시
Free Manifestation	안정되지 않은 원리	회귀 영역, 공간 단층
Instinct-Bound Creature	생존 본능에 원리가 결속된 생물	재생 포식자, 적응 갑각 생물
Bound Property	물질 또는 기관에 안정된 원리	회귀초, 경계결정
Self-Bound Fairy	자아와 선택을 획득한 원리	회귀의 요정, 경계의 요정
Class Form	요정이 선택한 원리의 사용 방식	복원자, 경계 수호자

```text
World Principle
│
├─ manifests_as → Hazard
├─ manifests_as → Creature Capability
├─ binds_as     → Resource Property
├─ embodied_by  → Fairy
└─ interpreted_as → Class
```

---

## 5. 요정 캐릭터의 구성

모든 요정은 다음 두 층으로 구성한다.

```text
Fairy
│
├─ Principle Core
│   └─ 변하지 않는다.
│
└─ Class Form
    └─ 경험과 선택에 따라 변경된다.
```

### 5.1 고정되는 것

Fairy ID
Principle Core
Identity Anchor
기본 외형 모티프
Principle의 근본 한계

### 5.2 성장하는 것

Attribute
Capability Mastery
Principle Understanding
Discovered Aspect
Bound Property
Class
Equipment Permission
Slot Unlock
Identity Stability

---

## 6. 캐릭터 성장의 전체 구조

캐릭터의 성장은 단일 Level이나 공통 XP로 표현하지 않는다.

```text
플레이 행동
↓
WorldEvent
↓
Growth Source 판정
↓
Growth Evidence 생성
↓
Progress 증가
↓
Milestone 충족
↓
Attribute / Skill / Slot / Class / Capability 해금
↓
새로운 WorldState에 대응
```

### 6.1 성장 축

성장 축	의미	주요 결과
Embodiment	신체와 기본 수행 능력	AttackPower, Defense, MaxStamina
Mastery	특정 행동과 Capability 숙련	Skill 변화, 비용 감소, 연계
Understanding	Principle과 WorldState 이해	Class Requirement, 약점 발견
Binding	외부 Property를 안정적으로 보유	Item 효과, 특수 Capability
Identity Stability	변화 속에서 자신의 자아 유지	Class Change, 변형 저항
Class Growth	원리 해석을 자아 형태로 고정	Skill, Resource Rule, Slot

---

## 7. Growth Source

모든 성장에는 플레이 안의 원인이 있어야 한다.

Growth Source	실제 플레이	성장 대상
Practice	의미 있는 상황에서 Skill 성공	Mastery
Observation	새로운 현상과 원리 관찰	Understanding
Challenge	현재 능력으로 불확실한 위험 극복	Embodiment
Adaptation	Hazard를 경험하고 대응법 확립	Resistance / Capability
Binding	Resource Property를 자신의 시스템에 결속	Bound Property
Relationship	다른 Actor와 지속적인 관계 형성	Connection 관련 성장
Choice	원리의 사용 방식과 대가 선택	Class Interpretation
Trial	선택한 해석을 실제 행동으로 증명	Class Unlock
Class Practice	해당 Class의 핵심 Loop 수행	Class Mastery

---

### 7.1 의미 있는 경험

행동 횟수만으로는 성장하지 않는다.

약한 적에게 같은 공격을 1,000번 사용
→ 새로운 Evidence 없음
→ 성장 없음
서로 다른 방어 구조를 가진 적을
관찰하고 다른 방식으로 돌파
→ 새로운 Challenge Evidence
→ Embodiment 또는 Mastery 성장

각 GrowthEvent는 noveltySignature를 가진다.

예:

```text
noveltySignature
=
위협 유형
+
대상 방어 구조
+
사용한 해결 방식
+
환경 조건
```

동일한 Signature의 반복은 Progress를 추가하지 않거나 크게 제한한다.

---

## 8. 현재 성장 결손을 닫는 규칙

### 8.1 AttackPower

AttackPower는 적 처치 수나 일반 XP로 직접 증가하지 않는다.

```text
의미 있는 공격 행동
↓
서로 다른 저항 구조에 힘을 성공적으로 전달
↓
Offensive Embodiment Evidence
↓
Embodiment Milestone
↓
Base AttackPower 증가
```

최종 AttackPower는 다음 세 원천을 가진다.

```text
Final AttackPower
=
Base AttackPower from Embodiment
+
Active Class Modifier
+
Equipment / Bound Property Modifier
```

반드시 관찰 가능한 원인이 남아야 한다.

AttackPower
12 → 13
Cause
GR-OFFENSIVE-EMBODIMENT-01
Evidence
경계 갑각 파괴
공간 단층 생물의 연결부 절단
중장갑 포식자의 약점 타격

디버그 명령은 테스트에서만 사용할 수 있으며 실제 플레이 저장 상태의 성장 원천이 될 수 없다.

---

### 8.2 Stamina

기력이 자연 회복되는지는 성장 요소가 아니라 우선 World Rule로 결정한다.

```text
WR-STAMINA-RECOVERY:
  semantic: >
    일정 시간 동안 기력 소비 행동을 수행하지 않으면
    기력이 자연 회복된다.
```

다음은 Balance 값이다.

Recovery Delay
Recovery Per Second
Combat Recovery Multiplier
Out-of-Combat Recovery Multiplier

성장으로 변경 가능한 것은 다음이다.

MaxStamina
Recovery Delay Modifier
특정 행동 중 Recovery 가능 여부
Class 전용 회복 조건
Resource 전환 방식

예:

경계 수호자
→ 선언한 경계 안에서 Guard 성공 시 Stamina 일부 회복
복원자
→ 최근 안정 상태로 돌아갈 때 Stamina도 일부 복원

정리하면:

회복이 존재하는가
= World Rule
얼마나 회복하는가
= Balance
어떤 조건에서 다르게 회복하는가
= Class / Growth

---

### 8.3 Equipment Slot

장착 Slot은 Level 조건으로 열리지 않는다.

모든 잠긴 Slot은 반드시 unlockSource를 가진다.

```text
EquipmentSlotState:
  slot_id: SLOT-PRINCIPLE-RELIC
  locked: true
  unlock_source:
    type: class
    id: CL-PRESERVATION-RESTORER
```

가능한 Unlock Source:

Class 획득
Class Trial 완료
특정 기관 결속
특정 Actor에게 훈련
Identity Stability 확보

기존 장착 시스템이 정의한 전체 Slot 수는 유지한다.

본 성장 시스템은 다음만 책임진다.

어떤 Slot이 잠겨 있는가?
무엇을 하면 열리는가?
왜 열렸는가?
현재 Class가 어떤 Item Category를 허용하는가?

---

## 9. 초기 플레이어블 요정 6종

초기 6종은 베이라의 상태, 구조, 인식 영역을 단계적으로 대표한다.

```text
상태 원리
├─ 보존
└─ 적응
구조 원리
├─ 경계
└─ 연결
인식·자아 원리
├─ 관찰
└─ 정체성
```

이 여섯 원리는 베이라의 물질적 위험부터 UNKNOWN 단계의 추상적 위험까지 확장할 수 있다.

첨부 세계관에서도 심부 이후 기억, 감각, 인식, Identity, 공간, 관계와 행동 Pattern까지 세계압의 영향을 받는다.

---

### 9.1 보존의 요정

id: FY-PRESERVATION
principle: PR-PRESERVATION
display_concept: 회귀의 요정
visual_motif:
  - 고리
  - 씨앗
  - 흔적

Principle

존재는 자신의 안정된 상태를 참조하여 그 상태를 유지하거나 복원할 수 있다.

세계 발현

형태	내용
Hazard	영역의 상태가 반복적으로 과거로 돌아간다.
Creature	치명상을 입을 때마다 이전 신체 상태로 되돌아간다.
Resource	회귀초
Player Need	재생 차단, 기준 상태 식별, 상태 보존

회귀초는 단순 회복 식물이 아니라 이전의 안정적인 생체 상태를 유지하도록 적응한 생명이다.

Class Graph

```text
CL-PRESERVATION-ORIGIN
│
├─ CL-RESTORER
│   └─ 손상된 생체 상태 복원
│
└─ CL-STASIS-WARDEN
    └─ 현재 상태의 강제 변화 방지
```

복원자

Operation
= Restore
Target
= 생명 상태
Signature Capability
= MC-RESTORE-BIOLOGICAL-STATE

성장 경험:

회귀초의 작동 관찰
최근 안정 상태 식별
치명상 Actor 복원
유익한 변화와 손상을 구분

정지 수호자

Operation
= Preserve
Target
= 자신 / 동료 / 지정 영역
Signature Capability
= MC-PRESERVE-STATE

성장 경험:

독, 출혈, 변형과 같은 상태 변화를 방어
동료가 원치 않는 변화에 저항하도록 보호
지정 시간 동안 영역 상태 유지

실패 형태

```text
모든 변화를 손상으로 판단
↓
성장, 기억, 관계까지 되돌림
↓
회귀 집착체
```

---

### 9.2 경계의 요정

id: FY-BOUNDARY
principle: PR-BOUNDARY
display_concept: 검과 문의 요정
visual_motif:
  - 검
  - 문
  - 선

Principle

무엇이 하나이며, 어디에서 끝나고, 무엇과 분리되는지를 결정한다.

세계 발현

형태	내용
Hazard	공간 경계가 어긋나는 단층
Creature	신체 일부가 서로 다른 공간에 존재하는 생물
Resource	경계결정
Player Need	구조 유지, 비정상 연결 절단, 통로 생성

경계결정은 공간 변화 속에서도 구조적 연속성을 유지하며, 이를 이용한 무기는 비정상적인 구조적 연결을 절단할 수 있다.

Class Graph

```text
CL-BOUNDARY-ORIGIN
│
├─ CL-BOUNDARY-WARDEN
│   └─ 경계를 유지하고 내부를 보호
│
└─ CL-SEVERANCE-BLADE
    └─ 의도한 연결만 절단
```

경계 수호자

Operation
= Declare / Maintain
Target
= 공간 영역
Signature Capability
= MC-MAINTAIN-BOUNDARY

연결 단절자

Operation
= Sever
Target
= 물질 구조 / 생물 기관 / 능력 연결
Signature Capability
= MC-CUT-ABNORMAL-STRUCTURE

성장 경험:

공간 단층 경계 관찰
경계결정 획득
정상 연결과 비정상 연결 구분
동료를 손상시키지 않고 특정 구조만 절단

실패 형태

```text
모든 연결을 위협으로 판단
↓
자신과 타인, 공간, 관계를 계속 분리
↓
고립 경계체
```

---

### 9.3 적응의 요정

id: FY-ADAPTATION
principle: PR-ADAPTATION
display_concept: 탈피의 요정
visual_motif:
  - 탈피
  - 짐승
  - 변화하는 기관

Principle

반복되는 압력은 다음 상태의 구조와 대응 방식을 바꾼다.

세계 발현

형태	내용
Hazard	공격과 환경 조건이 계속 바뀌는 지역
Creature	같은 공격을 반복할수록 저항하는 생물
Resource	적응 기관
Player Need	공격 유형 변화, 약점 분석, 적응 초기화

DEEP에서는 공격 Adaptation, 신체 구조 변경과 극단적 재생이 주요 위험으로 등장한다.

Class Graph

```text
CL-ADAPTATION-ORIGIN
│
├─ CL-COUNTERFORM
│   └─ 경험한 위협에 일시적 대응 형성
│
└─ CL-ASSIMILATOR
    └─ 외부 Property 하나를 선택적으로 결속
```

대응체

Operation
= Respond
Target
= 자기 신체
Signature Capability
= MC-ADAPT-TO-THREAT

동화자

Operation
= Bind / Reproduce
Target
= 외부 기관 또는 Property
Signature Capability
= MC-BIND-ADAPTIVE-PROPERTY

성장 경험:

서로 다른 Hazard에서 생존
위협의 원인과 대응 기관 연결
어떤 적응을 유지하고 버릴지 선택

실패 형태

```text
모든 위협에 적응하려 함
↓
신체와 행동이 계속 변경
↓
원래의 정체성 소실
↓
무정형 적응체
```

---

### 9.4 연결의 요정

id: FY-CONNECTION
principle: PR-CONNECTION
display_concept: 실과 덩굴의 요정
visual_motif:
  - 실
  - 덩굴
  - 고리

Principle

서로 다른 존재는 상태, 자원, 감각과 결과를 연결하여 공유할 수 있다.

세계 발현

형태	내용
Hazard	접촉한 존재를 하나의 생체 Network에 편입
Creature	감각과 피해를 군체 전체가 공유
Resource	공생 핵
Player Need	연결 추적, 피해 분산 차단, 자원 공유

Class Graph

```text
CL-CONNECTION-ORIGIN
│
├─ CL-BOND-WEAVER
│   └─ 동료 사이의 상태와 자원 연결
│
└─ CL-SYMBIOTIC-SHEPHERD
    └─ 다른 생명 Capability와 공생
```

유대 직조자

Operation
= Connect / Route
Target
= 동료 Actor
Signature Capability
= MC-SHARE-RESOURCE

공생 인도자

Operation
= Symbiosis
Target
= 선택한 생물 또는 기관
Signature Capability
= MC-FORM-SYMBIOTIC-LINK

성장 경험:

동료와 피해 또는 Stamina 공유
생물 Network의 전달 구조 관찰
서로 이익이 되는 연결 유지
필요할 때 연결을 자발적으로 해제

실패 형태

```text
연결을 항상 유익하다고 판단
↓
모든 존재를 하나의 Network에 편입
↓
개별 의지 소실
↓
군체 결속체
```

---

### 9.5 관찰의 요정

id: FY-OBSERVATION
principle: PR-OBSERVATION
display_concept: 별과 눈의 요정
visual_motif:
  - 별
  - 눈
  - 렌즈

Principle

관찰은 세계의 상태를 구분 가능한 정보로 만들며, 관찰자와 대상 사이에 관계를 만든다.

세계 발현

형태	내용
Hazard	관찰한 대상이 관찰자를 역추적
Creature	시선을 감지하고 공격 Pattern을 변경
Resource	관측 렌즈 기관
Player Need	약점 발견, Pattern 예측, 현실 검증

Class Graph

```text
CL-OBSERVATION-ORIGIN
│
├─ CL-TRUTH-SEER
│   └─ 숨겨진 WorldState와 거짓 인식 판별
│
└─ CL-PATTERN-HUNTER
    └─ 반복 행동을 기록하고 다음 행동 예측
```

진실 관측자

Operation
= Reveal / Verify
Target
= WorldState / Perception
Signature Capability
= MC-VERIFY-REALITY

패턴 사냥꾼

Operation
= Record / Predict
Target
= Creature Behavior
Signature Capability
= MC-PREDICT

성장 경험:

새 Creature의 행동 관찰
관찰 정보와 실제 결과 대조
거짓 정보와 실제 WorldState 구분
약점 발견 후 전투 또는 회피로 검증

실패 형태

```text
자신의 관찰을 절대적 사실로 판단
↓
새로운 증거를 거부
↓
세계를 잘못된 Pattern에 강제
↓
확정 관측체
```

---

### 9.6 정체성의 요정

id: FY-IDENTITY
principle: PR-IDENTITY
display_concept: 이름과 거울의 요정
visual_motif:
  - 이름
  - 거울
  - 가면

Principle

변화가 지속되어도 무엇이 같은 존재이며 무엇이 그 존재에게 속하는지를 결정한다.

세계 발현

형태	내용
Hazard	이름, 기억, Class 또는 신체 소유권이 변경
Creature	다른 Actor의 Identity를 탈취
Resource	자아 정박핵
Player Need	Identity Anchor, 강제 변형 저항, 현실 검증

Class Graph

```text
CL-IDENTITY-ORIGIN
│
├─ CL-ANCHOR-KEEPER
│   └─ 변화 속에서 자신의 자아 유지
│
└─ CL-MASK-WALKER
    └─ 정체성을 잃지 않고 외부 형태를 임시 사용
```

자아 정박자

Operation
= Anchor
Target
= Self Identity
Signature Capability
= MC-IDENTITY-ANCHOR

가면 보행자

Operation
= Assume / Release
Target
= 외부 Form
Signature Capability
= MC-SAFE-TRANSFORM

성장 경험:

강제 변형에 저항
Class Change 전후 자아 연속성 유지
타인의 형태를 사용한 뒤 원래 상태로 복귀
자신의 기억과 외부 기억 구분

실패 형태

```text
사용한 역할과 형태를 모두 자신이라 판단
↓
Identity 충돌
↓
인격과 Class 분열
↓
무명 다중체
```

---

## 10. Class 설계 규칙

### 10.1 모든 Class가 반드시 바꾸는 것

Class는 최소 세 가지 이상을 변경해야 한다.

사용 가능한 Capability
Skill 또는 Action의 작동 방식
Class Resource Rule
Equipment Permission
Slot Unlock
Attribute Profile
외형과 연출
World Interaction

다음은 Class로 인정하지 않는다.

AttackPower +5
Defense +3
MaxHealth +10

수치만 바꾸는 것은 Trait 또는 Balance Modifier다.

---

### 10.2 Class Requirement

모든 Class는 다음 다섯 종류의 Requirement를 사용한다.

```text
ClassRequirements:
  aspect_evidence:
    - 원리의 특정 Aspect를 관찰했는가?
  mastery:
    - 필요한 Capability를 실제 플레이에서 사용했는가?
  bound_property:
    - 필요한 Resource 또는 Property를 결속했는가?
  meaningful_choice:
    - 원리를 어떤 방식으로 사용할지 선택했는가?
  class_trial:
    - 선택한 해석을 실제 상황에서 증명했는가?
```

일부 Class는 이 중 하나를 생략할 수 있지만, 단순 Level Requirement만으로 열 수 없다.

---

### 10.3 Class 보존

Class Change는 이전 Class를 삭제하지 않는다.

```text
FairyClassState:
  active_class_id: CL-BOUNDARY-WARDEN
  unlocked_class_ids:
    - CL-BOUNDARY-ORIGIN
    - CL-BOUNDARY-WARDEN
    - CL-SEVERANCE-BLADE
```

Class 전환 조건은 별도 Rule로 정의한다.

초기 기본값:

전투 중 전환 불가
안전권 또는 지정된 Transformation Point에서 전환
전환 시 Active Skill Set과 Equipment Permission 재계산
Principle Core와 획득한 Evidence는 유지

향후 특정 Class는 전투 중 변신 Capability를 가질 수 있다.

---

## 11. Class Change의 성장 Loop

```text
미지의 Principle Manifestation 발견
↓
Observation Evidence 획득
↓
원리 작동 방식 이해
↓
Hazard 또는 Creature 대응
↓
Resource / Property 획득
↓
Fairy Principle Core와 결속 가능성 확인
↓
Interpretation 선택
↓
Class Trial
↓
Class Unlock
↓
새 Capability
↓
기존에 진입할 수 없던 WorldState 진입
```

이는 기존 베이라의 탐험 Loop와 동일한 구조를 사용한다.

베이라 Resource는 단순 판매 Loot가 아니라 새로운 Capability와 탐험 Route를 열 수 있어야 한다.

---

## 12. Master Graph 확장

기존 Master Graph의 CAUSES, REQUIRES, GRANTS, CHANGES, SUPPORTS, OPPOSES는 그대로 사용한다.

원리 시스템을 위해 다음 Edge만 추가한다.

Edge	의미
MANIFESTS_AS	원리가 Hazard 또는 Creature Capability로 나타남
BINDS_AS	원리가 Resource Property로 안정됨
EMBODIED_BY	원리가 요정의 Principle Core로 인격화됨
INTERPRETED_AS	요정이 원리를 특정 Class로 해석함

예:

```text
PR-PRESERVATION
│
├─ MANIFESTS_AS → MW-REGRESSION-FIELD
├─ MANIFESTS_AS → CR-SELF-RESETTING-PREDATOR
├─ BINDS_AS → IT-REGRESSION-HERB
├─ EMBODIED_BY → FY-PRESERVATION
├─ INTERPRETED_AS → CL-RESTORER
└─ INTERPRETED_AS → CL-STASIS-WARDEN
```

Class와 성장 Route는 기존 Edge로 표현한다.

```text
CL-RESTORER
├─ REQUIRES → GX-OBSERVE-REGRESSION
├─ REQUIRES → IT-REGRESSION-HERB
├─ REQUIRES → TR-RESTORE-ALLY
├─ GRANTS → MC-RESTORE-BIOLOGICAL-STATE
└─ UNLOCKS → SLOT-BIOLOGICAL-RELIC
```

기존 Graph에 UNLOCKS가 없다면 GRANTS로 통일한다.

---

## 13. 정적 정의와 Runtime State의 분리

### 13.1 정적 카탈로그

다음은 콘텐츠 정의이며 런타임 Actor마다 복제하지 않는다.

PrincipleDefinition
FairyDefinition
ClassDefinition
GrowthRuleDefinition
TrialDefinition
EquipmentSlotDefinition
ResourceDefinition
CapabilityDefinition

### 13.2 Runtime Actor State

Actor는 자신의 현재 상태와 진행도만 가진다.

interface FairyGrowthState {
  fairyId: string;
  principleId: string;
  activeClassId: string;
  unlockedClassIds: string[];
  attributes: {
    attackPower: number;
    defense: number;
    maxHealth: number;
    maxStamina: number;
  };
  embodimentRanks: Record<string, number>;
  masteryProgress: Record<string, number>;
  understandingEvidenceIds: string[];
  boundPropertyIds: string[];
  unlockedSlotIds: string[];
  identityStability: number;
  integrationLoad: number;
  classRequirementProgress: Record<string, RequirementProgress>;
  recentGrowthEvidence: GrowthEvidence[];
}

identityStability와 integrationLoad는 데이터 구조에 포함하되, 본격적인 괴물화와 자아 붕괴 시스템은 후속 Cycle까지 비활성화할 수 있다.

---

## 14. 핵심 데이터 정의

### 14.1 PrincipleDefinition

interface PrincipleDefinition {
  id: string;
  displayName: string;
  semantic: string;
  stateDimensions: string[];
  operations: string[];
  validTargetDomains: string[];
  manifestations: {
    hazardIds: string[];
    creatureCapabilityIds: string[];
    resourcePropertyIds: string[];
    fairyIds: string[];
  };
  limits: string[];
}

### 14.2 ClassDefinition

interface ClassDefinition {
  id: string;
  fairyId: string;
  principleId: string;
  displayName: string;
  aspect: string;
  interpretation: string;
  operations: string[];
  targetDomains: string[];
  constraints: string[];
  requirements: ClassRequirement[];
  grantedCapabilityIds: string[];
  grantedSkillIds: string[];
  attributeModifiers: Record<string, number>;
  unlockedSlotIds: string[];
  equipmentPermissions: string[];
  resourceRuleOverrides: string[];
  nextClassIds: string[];
}

### 14.3 GrowthRuleDefinition

interface GrowthRuleDefinition {
  id: string;
  listensToEventTypes: string[];
  conditions: GrowthCondition[];
  noveltyPolicy: {
    signatureFields: string[];
    repeatMode: "ignore" | "reduce" | "allow";
  };
  progressEffects: GrowthProgressEffect[];
  rewardEffects: GrowthRewardEffect[];
  evidenceTemplate: string;
}

### 14.4 GrowthEvidence

interface GrowthEvidence {
  id: string;
  ruleId: string;
  actorId: string;
  sourceEventId: string;
  worldTime: number;
  locationId: string;
  targetIds: string[];
  noveltySignature: string;
  before: unknown;
  after: unknown;
  causeText: string;
}

모든 영구 성장 변화는 하나 이상의 GrowthEvidence를 남겨야 한다.

---

## 15. Runtime 처리 흐름

```text
Player Input
↓
World Action
↓
World Rule 실행
↓
WorldEvent 발생
↓
GrowthSystem이 Event 구독
↓
GrowthRule 조건 평가
↓
Growth Evidence 생성
↓
Progress 또는 Reward 적용
↓
WorldState 갱신
↓
Observable Growth State 생성
↓
GameView 전달
```

### 15.1 책임 분리

World

성장 조건 판정
수치 변경
Class Requirement 충족
Class Unlock
Slot Unlock
Stamina Rule
Save / Load

GameView

현재 성장 상태 표시
성장 원인 표시
Class Requirement 표시
Class Change 선택 UI
Slot 잠금 이유 표시

GameView는 Class Unlock 여부를 직접 결정하지 않는다.

---

## 16. Observable Growth State

World는 다음 형태의 ViewModel을 제공해야 한다.

interface GrowthViewModel {
  actorId: string;
  attributes: Array<{
    id: string;
    value: number;
    nextMilestone?: string;
    recentCause?: string;
  }>;
  activeClass: {
    id: string;
    name: string;
    principleName: string;
  };
  availableClasses: Array<{
    id: string;
    name: string;
    status: "LOCKED" | "AVAILABLE" | "UNLOCKED";
    requirements: Array<{
      description: string;
      satisfied: boolean;
      evidenceIds: string[];
    }>;
  }>;
  equipmentSlots: Array<{
    slotId: string;
    locked: boolean;
    unlockReason?: string;
  }>;
  recentGrowthEvents: Array<{
    title: string;
    before?: string;
    after?: string;
    cause: string;
  }>;
}

표시 예:

AttackPower
12 → 13
원인:
서로 다른 세 종류의 방어 구조를
실전에서 돌파했습니다.
경계 수호자
[해금 가능]
✓ 공간 단층 관찰
✓ 경계결정 획득
✓ 구조 연속성 유지 경험
✓ 경계 수호의 시련 완료
Principle Relic Slot
LOCKED
해금 조건:
복원자 또는 정지 수호자 Class 획득

---

## 17. 위험 설계 절차

새로운 Creature, Hazard 또는 Boss를 만드는 Agent는 다음 순서를 따른다.

1단계 — Principle

어떤 원리가 작동하는가?

2단계 — WorldState

어떤 환경과 상태에서 원리가 강하게 나타나는가?

3단계 — Compulsion

이 존재는 왜 원리를 선택하지 못하고 반복하는가?

4단계 — Capability

그 원리가 Creature에게 어떤 행동 가능성을 주는가?

5단계 — Counterplay

플레이어는 무엇을 관찰하고 어떤 Capability로 대응하는가?

6단계 — Resource

생존에 성공한 기관 또는 물질에는 어떤 Property가 결속되는가?

7단계 — Growth

그 Resource와 경험이 어떤 Fairy Class Route를 여는가?

전체 Trace:

```text
World Pressure
↓
Principle Manifestation
↓
Environment
↓
Survival Pressure
↓
Creature Compulsion
↓
Creature Capability
↓
Player Observation
↓
Player Capability Requirement
↓
Counterplay
↓
Bound Property
↓
Resource
↓
Fairy Growth / Class
↓
New Exploration Possibility
```

전투 Creature 또한 먼저 만드는 것이 아니라 세계압, 환경, 적응에서 파생되어야 한다.

---

## 18. 구현 Cycle

전체 시스템을 한 번에 구현하지 않는다.

각 Cycle은 플레이 가능한 성장 결과 하나를 닫는다.

---

Cycle 1 — 성장 원천과 첫 Class Change

목표

플레이어가 실제 탐험과 전투를 통해 능력치를 올리고, Resource를 획득하고, 첫 Class를 해금하여 이전에는 통과할 수 없던 지역에 진입한다.

구현 요정

FY-PRESERVATION
FY-BOUNDARY

구현 지역

```text
SAFE FRONTIER
↓
회귀초 포식지
+
공간 단층 협곡
```

구현 콘텐츠

회귀초
경계결정
자기 복원 포식자
공간 단층 Hazard
경계 갑각 생물

반드시 닫아야 하는 결손

AttackPower가 플레이로 상승한다.
MaxStamina가 플레이로 상승한다.
Stamina 자연 회복 Rule이 존재한다.
특수 Equipment Slot이 Class로 해금된다.
Class의 유래가 Principle과 WorldState로 설명된다.

Class 구현 범위

CL-RESTORER
CL-BOUNDARY-WARDEN

각 요정의 두 번째 분기는 정의만 유지하고 Cycle 1에서는 잠가도 된다.

플레이 검증 흐름

```text
안전권 출발
↓
위험 지역 발견
↓
Hazard 관찰
↓
Creature 대응
↓
회귀초 또는 경계결정 획득
↓
Growth Evidence 축적
↓
AttackPower 또는 MaxStamina Milestone
↓
Class Trial
↓
Class Unlock
↓
특수 Slot Unlock
↓
새 Capability 사용
↓
기존에 막힌 경로 통과
```

Cycle 1 완료 기준

* 디버그 명령 없이 Attribute가 최소 한 번 상승한다.
* 상승 원인이 ObservableState에 표시된다.
* 같은 행동 반복만으로 무한 성장하지 않는다.
* Class Requirement가 항목별로 표시된다.
* Class Trial 완료 후 Class가 해금된다.
* Class 획득으로 Capability와 Slot이 실제 변경된다.
* 새 Capability가 WorldState 해결에 사용된다.
* Save/Load 이후 Evidence와 Class 상태가 유지된다.

---

Cycle 2 — 적응과 공생

구현 요정

FY-ADAPTATION
FY-CONNECTION

핵심 기능

Property Binding
Temporary Adaptation
Symbiotic Link
Shared Resource
Integration Load

대표 위험

반복 공격 적응 생물
독성 생태
공생 Network
피해 공유 군체

완료 결과

적응 Property를 선택적으로 결속한다.
동료 또는 생물과 상태를 연결한다.
과도한 결속이 Identity Stability에 부담을 준다.

---

Cycle 3 — 관찰과 정체성

구현 요정

FY-OBSERVATION
FY-IDENTITY

핵심 기능

Perception State
Reality Verification
Identity Anchor
Safe Transformation
False Information
Forced Class Change Resistance

대표 위험

관찰자를 추적하는 생물
거짓 WorldState
Identity 탈취 생물
기억과 역할을 혼동시키는 지역

완료 결과

표시된 정보와 실제 WorldState를 구분한다.
Identity를 잃지 않고 형태를 전환한다.
UNKNOWN 영역의 추상적 위험에 대응한다.

---

Cycle 4 — Class Graph 확장

목표

초기 6종 요정의 두 번째 Class 분기 구현
Class 전환
Class Mastery
Signature Skill
고급 Principle Interaction

추가 Class

CL-STASIS-WARDEN
CL-SEVERANCE-BLADE
CL-COUNTERFORM
CL-ASSIMILATOR
CL-BOND-WEAVER
CL-SYMBIOTIC-SHEPHERD
CL-TRUTH-SEER
CL-PATTERN-HUNTER
CL-ANCHOR-KEEPER
CL-MASK-WALKER

---

## 19. 구현 모듈 구조

실제 프로젝트의 기존 경로에 맞게 이름은 조정할 수 있지만 책임은 유지한다.

```text
world/
├─ principles/
│  ├─ principle-types
│  ├─ principle-catalog
│  └─ principle-validation
│
├─ fairies/
│  ├─ fairy-types
│  ├─ fairy-catalog
│  └─ fairy-state
│
├─ growth/
│  ├─ growth-types
│  ├─ growth-rule-catalog
│  ├─ growth-evaluator
│  ├─ growth-evidence
│  └─ class-change
│
├─ classes/
│  ├─ class-types
│  ├─ class-catalog
│  └─ class-requirement-evaluator
│
├─ resources/
│  ├─ bound-property-catalog
│  └─ property-binding
│
└─ observable/
   └─ growth-view-model
content/
├─ cycle-01/
│  ├─ preservation-content
│  ├─ boundary-content
│  ├─ growth-rules
│  └─ class-trials
│
├─ cycle-02/
└─ cycle-03/
tests/
├─ principle-validation
├─ growth-source
├─ meaningful-experience
├─ attribute-growth
├─ stamina-recovery
├─ slot-unlock
├─ class-unlock
├─ class-change
└─ growth-view-model
```

---

## 20. 테스트 요구사항

### 20.1 Principle 테스트

* Principle에 상태 대상과 Operation이 존재한다.
* Hazard, Resource 또는 Fairy 중 하나 이상의 발현이 존재한다.
* 특정 무기나 역할 이름만으로 정의되지 않는다.
* 위험과 유익한 발현을 모두 설명할 수 있다.

### 20.2 Growth 테스트

* Growth Source 없이 값이 변경되지 않는다.
* 동일한 WorldEvent가 중복 적용되지 않는다.
* 동일 Novelty Signature 반복 시 정책대로 처리된다.
* 성장 전후 값과 원인이 Evidence에 기록된다.
* 디버그 전용 변경이 일반 Save에 들어가지 않는다.

### 20.3 Attribute 테스트

* 공격 관련 Meaningful Challenge가 AttackPower 성장으로 이어진다.
* 단순 약한 대상 반복은 성장하지 않는다.
* Class와 Equipment Modifier가 분리 계산된다.

### 20.4 Stamina 테스트

* Recovery Delay 이전에는 회복하지 않는다.
* Rule 조건 충족 후 결정적으로 회복한다.
* Class Modifier가 World Rule을 덮어쓰지 않고 명시적으로 수정한다.
* Save/Load 후 현재 Stamina와 회복 상태가 유지된다.

### 20.5 Class 테스트

* 모든 Requirement 전에는 Class를 해금할 수 없다.
* Requirement 충족 Evidence가 표시된다.
* Class Change 후 Principle Core가 변경되지 않는다.
* 이전 Class는 Unlocked 상태로 유지된다.
* Active Class에 따라 Capability와 Equipment Permission이 재계산된다.

### 20.6 Slot 테스트

* 잠긴 Slot에는 반드시 Unlock Source가 있다.
* Class 또는 Trial 획득 시 정확한 Slot만 열린다.
* Class가 바뀌어도 영구 해금 여부가 정책대로 유지된다.
* UI가 잠금 이유를 표시할 수 있다.

### 20.7 World 통합 테스트

* 새 Class Capability가 실제 Hazard 또는 Creature 대응에 사용된다.
* 새 Capability 없이 통과할 수 없던 WorldState가 해금 후 통과 가능하다.
* Resource 획득이 다음 탐험 Route를 연다.
* 전투 없이도 가능한 대체 Possibility가 유지된다.

전투는 항상 Goal 자체가 아니라 자원 획득, 길 확보, 관찰, 생존 같은 WorldState에서 파생된 선택지여야 한다.

---

## 21. Agent 구현 규칙

구현 Agent는 다음을 지켜야 한다.

## 1. Generic Character Level을 만들지 않는다.
## 2. 모든 영구 성장에는 Growth Source와 Evidence를 남긴다.
## 3. Class를 전투 역할이나 수치 보너스에서 출발시키지 않는다.
## 4. Principle → Manifestation → Resource → Growth Trace를 먼저 만든다.
## 5. Resource가 있다는 이유만으로 Capability를 억지로 추가하지 않는다.
## 6. 현재 Goal 또는 WorldState가 먼저 Capability를 요구해야 한다.
## 7. Fairy의 Principle Core는 Class Change로 변경하지 않는다.
## 8. UI에서 성장 여부를 결정하지 않는다.
## 9. WorldState와 ObservableState를 완전히 변환 가능하게 만든다.
## 10. 새 요정마다 별도 성장 시스템을 만들지 않는다.
## 11. 차이는 Catalog와 Rule 데이터로 표현한다.
## 12. Cycle 범위를 넘어선 고급 기능은 Schema만 남기고 구현하지 않는다.

---

## 22. 절대 피해야 할 설계

```text
BAD
레벨 20
↓
전직
BAD
몬스터 1,000마리 처치
↓
AttackPower +10
BAD
심부 지역
↓
높은 등급 장비 Drop
BAD
달의 요정
↓
달은 신비로우므로 마법사
BAD
검의 요정
↓
검 Skill 사용
```

대신:

```text
World Principle
↓
WorldState 변화
↓
Hazard / Creature Adaptation
↓
Player Need
↓
Observation / Counterplay
↓
Bound Property
↓
Growth Evidence
↓
Class Interpretation
↓
New Capability
```

를 사용한다.

---

## 23. 최종 통합 구조

```text
                         PR-POSSIBILITY
                       세계는 달라질 수 있다.
                                │
                                ▼
                         WORLD PRESSURE
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
        FREE WORLD PRESSURE             BOUND WORLD PRESSURE
                 │                             │
                 ▼                             ▼
        Hazard / Environment           Property / Resource
                 │                             │
                 ▼                             │
        Survival Pressure                     │
                 │                             │
                 ▼                             │
        Creature Adaptation                   │
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                         World Principle
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
           Danger            Resource            Fairy
      선택 없는 원리       물질 결속 원리      자아 결속 원리
                                                   │
                                                   ▼
                                             Experience
                                                   │
                                                   ▼
                                           Principle Aspect
                                                   │
                                                   ▼
                                              Class Choice
                                                   │
                                                   ▼
                                             Class Change
                                                   │
                                                   ▼
                                            New Capability
                                                   │
                                                   ▼
                                       Previously Unreachable World
                                                   │
                                                   ▼
                                                 UNKNOWN
```

---

## 24. 최종 핵심 문장

베이라의 세계관을 대표하는 문장은 다음과 같다.

기적이 존재할 수 있을 정도로 세계가 자유롭게 변화하기 때문에 베이라는 위험하다.

요정의 존재를 대표하는 문장은 다음과 같다.

요정은 세계를 구성하는 원리가 자아와 선택을 획득한 존재다.

요정의 성장을 대표하는 문장은 다음과 같다.

베이라는 모든 존재에게 다른 것이 될 가능성을 준다. 요정의 성장은 그 가능성에 휩쓸리지 않고 무엇이 될지를 스스로 선택하는 과정이다.

구현 관점의 최종 규칙은 다음 한 문장으로 정리한다.

플레이에서 관찰할 수 있는 원인 없이 어떤 값도 오르지 않으며, 세계의 원리와 연결되지 않은 Class는 존재하지 않는다.
