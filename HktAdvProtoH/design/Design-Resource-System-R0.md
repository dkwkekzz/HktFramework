# SYSTEM DESIGN DOCUMENT

## Resource System — 세계가 아이템의 원천을 만드는 방식

| **문서 버전** | R0 |
|---|---|
| **상태** | Human 원안 (레이아웃 정리만 — 내용은 원문 그대로) |
| **원문 파일명** | 원문은 이 문서를 `Design-Resource-Catalog-R0.md` 로 지목했으나 그 이름은 이미 **다른 문서**(그래프가 언급한 자원의 전수 조사 · 승인 대기)가 쓰고 있다. 두 문서는 세대가 다른 병렬 문서이므로 이 문서는 자기 제목을 따라 `Design-Resource-System-R0.md` 로 선다 |
| **범위** | 자원이 왜 존재하며 어디에서 생기고 어떻게 획득되고 획득이 세계에 무엇을 남기는가 |
| **관계** | 네 문서의 최종 관계와 최상위 원칙은 이 문서 **부록** 이 소유한다 |

---

### 0. 목적

이 문서는 베이라 세계에서 **자원이 왜 존재하며, 어디에서 생기고, 어떻게 획득되고, 획득이 세계에 어떤 결과를 남기는가**를 정의한다.

아이템 제작법보다 먼저 존재해야 하는 문서다.

```text
World Principle
↓
Terrain / Ecology
↓
Resource Source
↓
Resource
↓
Material
↓
Item
```

베이라에서는 세계압이 안정된 Property로 결속되었을 때 광물·식물·기관·소재·자원이 된다.

따라서 자원은 임의로 배치하는 Loot Node가 아니다.

> **Resource = 세계의 Principle이 물질·생명·환경·정보에 반복적으로 작용한 결과, Actor가 획득하고 다른 상태로 변환할 수 있게 된 세계 상태다.**

---

## 1. 소유 경계

| 계층            | 소유                                      |
| ------------- | --------------------------------------- |
| Master        | Resource 종류, 생성 원인, Property, 획득 방식의 의미 |
| Runtime World | 실제 광맥·식물·사체·자원 개체, 남은 양, 현재 상태          |
| Cycle         | 채집 시간, 획득량, 재생 시간, 손상량 등의 수치            |

Resource Catalog에 `채굴하면 3개 획득` 같은 수치는 들어가지 않는다.

---

# 2. Resource와 Resource Source

둘을 분리한다.

## Resource Source

자원을 만들어 내거나 보유하고 있는 세계 존재다.

```text
광맥
식물
생체 기관
사체
대기 결정 군락
토양층
기억 모래층
유랑대지의 탈피 부위
```

## Resource

Source로부터 분리되어 Actor가 운반하거나 가공할 수 있는 상태다.

```text
열기억철 광석
혈수지
공생결절
숨결석
기억유리 원석
충격석
```

관계:

```text
Resource Source
    │
    ├─ 자연 성장
    ├─ 축적
    ├─ 분비
    ├─ 탈피
    └─ 매장
         ↓
      Harvest
         ↓
      Resource
```

---

# 3. Resource Source 분류

## GEOLOGICAL

세계압이 암석과 광물에 결속된다.

예:

* 균압석
* 열기억철
* 상향맥석
* 고정암
* 충격석

## BIOLOGICAL_PLANT

식물이 생존 과정에서 Property를 축적한다.

예:

* 혈수지
* 심박목
* 음형수지

## BIOLOGICAL_ORGAN

생물이 지형에 적응하며 획득한 기관이다.

```text
열 저장낭
공생결절
공명기관
압력 감지기관
```

반드시 죽여야 얻을 필요는 없다.

```text
사냥
탈피 수거
분비물 채취
절단
마취 후 추출
공생 분리
```

등 서로 다른 획득법을 허용한다.

## ENVIRONMENTAL

자연 순환 자체에서 생성된다.

```text
안정수
정상수
등토
빙하 보존 생체조직
```

## INFORMATIONAL

추상적인 상태가 물질에 결속된다.

```text
기억유리
증언사
공백석
```

---

# 4. Resource Formation

모든 자원은 반드시 다음 질문에 답한다.

```text
왜 여기에서만 생기는가?
↓
어떤 Principle 때문인가?

그 Principle은 무엇에 작용하는가?
↓
암석 / 생명 / 대기 / 정보 ...

어떤 Property가 남는가?
↓
IP-*

그 상태가 오랜 시간 반복되면 무엇이 만들어지는가?
↓
Resource Source
```

지형 역시 `근본 원인 → Property → 자연 순환 → 자원` 순으로 설계하도록 이미 정의되어 있다.

---

# 5. Harvest — 자원을 얻는 행위

채집은 Source에서 Item을 생성하는 단순 버튼이 아니다.

```text
Source
+
Harvest Method
+
Actor Capability
+
Tool
+
Environment
↓
Resource Result
+
Source Change
```

예:

### 열기억철 광맥

```text
정밀 절단
→ 결정 구조 보존
→ 안정된 열기억철

강한 충격
→ 빠른 채굴
→ 구조 손상

폭파
→ 대량 획득
→ 열 급방출
→ 주변 빙하 균열
```

따라서 획득 방식이 결과 자원의 상태에 영향을 줄 수 있다.

---

# 6. Extraction Consequence

모든 중요 자원에는 채집 결과가 있어야 한다.

```text
Resource Gain
≠
World Change 0
```

예를 들어 백야철빙원에서는 광맥 채굴 자체가 지역의 열 균형을 변화시킬 수 있다.

가능한 결과:

```text
Source 감소
Source 파괴
환경 Property 변화
생물 서식지 변화
새로운 위험 생성
NPC 경제 변화
다른 Actor의 접근 가능성 변화
```

---

# 7. Renewable / Exhaustible

Resource는 두 종류로 나눈다.

## Renewable

조건이 유지되면 다시 생성된다.

```text
혈수지
식물성 소재
생물의 탈피물
특정 수계 자원
```

재생은 타이머만으로 이루어지지 않는다.

```text
생물 살아 있음
+
먹이 존재
+
환경 조건 유지
→ 재생
```

## Exhaustible

Source 자체를 소비한다.

```text
광맥
기억유리층
고정암
고대 생물
```

과도하게 채집하면 실제 세계 구조가 변할 수 있다.

---

# 8. Resource State

같은 Resource라도 획득 결과가 달라져야 하는 경우가 있다.

예:

```text
열기억철
Purity
Thermal Saturation
Structural Stability
Contamination
```

이 차이가 실제 Gameplay에 영향을 주기 시작하면 Runtime에서 별도의 Resource Instance 또는 Resource Lot으로 개체화한다.

아무 차이가 없다면:

```text
열기억철 × 14
```

로 유지한다.

---

# 9. 초기 Resource Catalog

| 지형      | Resource | 핵심 Property       | 대표 사용               |
| ------- | -------- | ----------------- | ------------------- |
| 왕관수계 분지 | 균압석      | Pressure 완충       | 건축, 장비 안정화          |
| 왕관수계 분지 | 안정수      | 변질 저항             | 약품, 가공              |
| 백야철빙원   | 열기억철     | 열 저장              | 무기, 난방, 동력          |
| 백야철빙원   | 서리유리     | 열변형 저항            | 저장 용기, 정밀 장치        |
| 흡명수림    | 혈수지      | 생체 활력 보존          | 회복, 의료              |
| 흡명수림    | 심박목      | 충격 반응 경화          | 장비 구조재              |
| 흡명수림    | 공생결절     | 생명 Network 연결     | 생체 장비               |
| 무호흡해    | 숨결석      | 대기 저장             | 탐험                  |
| 무호흡해    | 무음결정     | 진동 전달 차단          | 은폐, 정밀 장비           |
| 무호흡해    | 기압막      | 대기 경계 유지          | 탐험 장치               |
| 역류산맥    | 상향맥석     | 이동 방향 변경          | 이동, 수송              |
| 역류산맥    | 고정암      | 방향 변화 저항          | 장비, 건축              |
| 유랑대지군   | 탈피암      | 압력·충격 저항          | 방어구                 |
| 유랑대지군   | 압력진주     | World Pressure 축적 | 고급 Mechanism        |
| 거울기억사막  | 기억유리     | 정보 보존             | 기록, Skill Mechanism |
| 거울기억사막  | 공백석      | 정보 기록 차단          | 보호, 은폐              |
| 울림석림    | 공명결정     | 진동 저장·전달          | 통신, Skill           |
| 울림석림    | 충격석      | 충격 저장             | 무기, 방어구             |

이 자원들은 현재 지형 설계에서 이미 자연적 원천과 용도가 정의되어 있다.

---

# 10. ResourceDefinition

```yaml
ResourceDefinition:
  identity:
    id:
    name:
    category:
  origin:
    terrain_ids:
    source_type:
    source_definition:
    formation_principle:
    world_pressure_relation:
  properties:
    property_ids:
    affected_states:
    limits:
  harvesting:
    supported_methods:
    required_capabilities:
    required_tool_usages:
    environmental_requirements:
  consequences:
    source_change:
    environment_change:
    ecological_change:
  lifecycle:
    renewable:
    regeneration_requirements:
    depletion_result:
  processing:
    supported_processes:
    possible_materials:
  progression:
    possible_item_forms:
    possible_mechanisms:
    possible_capabilities:
  observation:
    evidence:
```

---

# 11. Resource 관찰 규칙

플레이어는 설명문만 읽어서 자원을 알아내지 않는다.

```text
Observation
↓
Resource Principle 추론
↓
Harvest Method 선택
↓
다른 Result
```

예:

```text
광맥 주변 원형 서리
↓
열이 중심으로 빠져나가고 있다
↓
충격을 주면 저장 열이 급격히 방출될 수 있다
↓
정밀 절단 도구 선택
```

이는 모든 지형 요소가 `관찰 → 원인 → 추론 → 행동`으로 연결되어야 한다는 세계 설계 원칙과 같다.

---

# 12. 완료 기준

Resource System은 다음이 가능하면 R0 완료다.

```text
새로운 Resource를 추가할 때
기존 Harvest Rule 수정이 필요 없다.

Resource가 왜 그 Terrain에서 생성되는지
Principle까지 추적할 수 있다.

채집 전
가능 / 불가능 / 이유를 관찰할 수 있다.

채집 후
Resource 획득과 Source 변화가 함께 관찰된다.

Resource를 통해
최소 하나의 Item 또는 Capability Route가 열린다.
```

---

# 부록. 네 문서의 최종 관계

```text
WORLD
│
│ World Principle이 무엇을 만들어내는가
▼
Design-Resource-Catalog-R0
│
│ Resource가 무엇으로 사용 가능한가
▼
Design-Item-System-R1
│
│ 지금 이 실제 Item은 어떤 상태인가
▼
Design-Item-Instance-State-R0
│
│ 그 Item이 시간과 플레이에 따라 어떻게 변하는가
▼
Design-Item-Lifecycle-Progression-R0
│
▼
PLAYER PROGRESSION
```

그리고 이 시스템 전체에서 지켜야 할 최상위 원칙은 세 가지입니다.

**첫째, 아이템의 모든 힘은 세계의 원천까지 거슬러 올라갈 수 있어야 한다.**

`강한 검이라서 강하다`가 아니라 `어떤 지형의 어떤 Property를 어떤 방식으로 결속했기 때문에 이런 Capability가 나온다`가 되어야 합니다.

**둘째, 아이템 성장은 숫자 증가보다 가능성 확장이어야 한다.**

새로운 지형을 견디고, 새로운 방식으로 싸우고, 새로운 자원을 다루게 해야 합니다.

**셋째, 아이템은 Actor가 아니지만 세계의 역사를 몸에 남기는 개체가 될 수 있다.**

그래서 플레이어가 오래 사용한 하나의 검이 여러 지역의 소재와 개조와 파손과 재제작을 거쳐 정말로 **그 플레이어만의 장비**가 되는 구조입니다.

> 위 관계도의 `Design-Resource-Catalog-R0` 는 **이 문서**(`Design-Resource-System-R0.md`) 를 가리킨다 — 이 문서 머리의 `원문 파일명` 항을 볼 것.
