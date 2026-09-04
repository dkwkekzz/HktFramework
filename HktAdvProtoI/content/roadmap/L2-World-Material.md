# L2 — 세계 재료 생태와 공급 계약 (기반 층 2 · 세계 절반 ② 부속)

상태: **확정** (Human 승인 원문 보존). [L2-World-Region.md](L2-World-Region.md) 의 **확장 계약**이다 —
새로운 설계 층도, 별도 Gameplay 시스템도 만들지 않는다.

① [L2-World-Concept.md](L2-World-Concept.md) 가 "위험과 보상은 같은 근원에서 나온다"를 주었고,
② [L2-World-Region.md](L2-World-Region.md) 가 "Region 은 그 근원 하나에서 위험·단서·재료·보상을
파생시키는 세계 단위"라고 주었다. 이 문서는 그 둘이 남긴 구멍 하나를 닫는다 — **재료가 세계에서
왜·어디서·어떤 상태로 생기고, 캐면 무엇이 달라지며, 어떻게 되돌아오는가.**

§1 이 원문이고, §2 이후는 원문을 도구([L2-World-Tool.md](L2-World-Tool.md))와 공정에 잇는 번역이다.
원문에 없는 세계 사실은 더하지 않았다.

```text
이 문서가 소유한다      재료가 세계에서 왜 생기는가 · 어디에 존재하는가 · 어떤 상태에서 나타나는가 ·
                      무엇이 그 존재를 암시하는가 · 채취되면 세계가 어떻게 변하는가 ·
                      어떻게 고갈·회복·이동하는가 · 후속 층에 어떤 세계 사실을 넘기는가
이 문서가 바꾼다        play/README.md 의 덮임 지도 — "W4 위험과 보상의 동근원(자원 사슬) → 4층" 중
                      **세계 쪽 절반이 2층으로 온다** (§2.1). 4층이 받는 것은 그 재료의 *쓰임*이다
이 문서가 소유하지 않는다  조합 문법 · Recipe · 제작 UI · Item 효과 · Skill/Class 변화 · 수치 ·
                      Drop 확률 · 경제 가격 · 거래 규칙 · 플레이어 지식 상태
```

---

## 1. 원문

### L2 — 세계 재료 생태와 공급 계약

상태: 제안 — Human 승인 시 L2-World-Region.md의 확장 계약으로 사용한다.
위치: 기반 층 2 · 세계 절반 ② 부속. 새로운 설계 층이나 별도 Gameplay 시스템을 만들지 않는다.

연결 문서:

* L2-World-Concept.md — 위험과 보상은 같은 근원에서 나오며, 세계가 성장의 원천이다.
* L2-World-Region.md — Region은 위험·단서·재료·보상을 하나의 World Cause에서 파생시키는 세계 단위다.

```text
이 문서가 소유한다
  재료가 세계에서 왜 생기는가 · 어디에 존재하는가 · 어떤 상태에서 나타나는가 ·
  무엇이 그 존재를 암시하는가 · 채취되면 세계가 어떻게 변하는가 · 어떻게 고갈·회복·이동하는가 ·
  후속 성장/아이템/조합 설계에 어떤 세계 사실을 넘기는가

이 문서가 소유하지 않는다
  조합 문법 · Recipe · 제작 UI · Item 효과 · Skill/Class 변화 · 수치 · Drop 확률 ·
  경제 가격 · 거래 규칙 · 플레이어 지식 상태
```

────────

#### 0. 한 문장 정의

> Region은 대표 보상 하나를 숨겨 둔 장소가 아니라, 하나의 World Cause가 여러 재료 원천과 흔적·부산물·출현 기회를 지속적으로 만들어내는 살아 있는 무대다.

이 문서는 재료를 어떻게 조합하는가를 정하지 않는다. 대신 후속 시스템이 조합할 수 있도록, 세계가 충분하고 다양한 재료를 인과적으로 생성·노출·회복하는 조건을 정한다.

────────

#### 1. 해결해야 하는 문제

기존 World Concept과 Region Architecture는 다음을 이미 확정했다.

```text
위험한 세계 조건
→ 그 조건 때문에 생긴 생태·현상
→ 같은 조건에서 생긴 재료
→ 위험을 넘어설 새로운 가능성
```

그러나 Region마다 Resource와 Growth Outcome 하나만 적어도 현재 계약을 형식적으로 통과할 수 있다. 이 경우 세계는 다음처럼 축소될 수 있다.

```text
고유 현상 하나
→ 핵심 위험 하나
→ 대표 재료 하나
→ 다음 Region
```

이 구조는 위험과 보상의 인과는 지키지만, 성장과 조합 시스템이 사용할 재료의 양·다양성·지속성을 보장하지 않는다.

이 문서는 다음 결손을 닫는다.

1. 한 World Cause가 대표 재료 외에 어떤 재료 원천과 부산물을 만드는가.
2. 플레이어가 Region의 경계·중간·핵심에서 각각 무엇을 발견할 수 있는가.
3. 재료가 시간·날씨·사건·생태·World State에 따라 어떻게 출현하는가.
4. 재료의 존재를 직접 보기 전에 어떤 흔적으로 추론할 수 있는가.
5. 공유 세계에서 채취와 고갈 뒤에도 재료 공급이 어떻게 이어지는가.
6. 채취가 세계에 어떤 상태 변화를 남기는가.
7. 재료와 부산물이 Region 사이를 어떻게 이동하거나 변형되는가.
8. 후속 설계가 임의의 효과를 붙이지 않도록 어떤 세계 사실을 인계하는가.

────────

#### 2. 설계 목표

##### 2.1 무대가 보장해야 하는 경험

```text
이상한 흔적을 본다.
→ 무엇이 생기고 있는지 추측한다.
→ 원천을 찾는다.
→ 위험과 생태 속에서 재료를 확보한다.
→ 채취 결과로 세계가 달라진다.
→ 다른 시기·상태·장소에서 새로운 원천이 나타난다.
→ 얻은 재료의 세계적 성질이 후속 성장·조합 설계의 입력이 된다.
```

##### 2.2 충분한 재료의 의미

충분하다는 아이템 이름의 수가 많다는 뜻이 아니다. 다음 조건이 충족된다는 뜻이다.

* 탐험의 여러 깊이에서 서로 다른 재료 기회가 존재한다.
* 광맥이나 몬스터 Drop 한 종류에 공급이 편중되지 않는다.
* 같은 World Cause가 생물·식물·지형·잔류물 등 여러 원천을 만든다.
* 고정 좌표 외에도 Region State와 사건에 따라 새로운 기회가 발생한다.
* 공유 세계에서 먼저 온 플레이어가 모든 기회를 영구히 제거하지 않는다.
* 일부 재료와 흔적이 Region 경계를 넘어 세계의 연속성을 만든다.
* 각 재료는 후속 설계가 해석할 수 있는 고유한 세계적 성질을 가진다.

────────

#### 3. 핵심 개념

##### 3.1 World Material Seed

후속 Item·Class·Skill·조합 설계에 전달하는 재료의 세계 사실이다.

```text
World Material Seed
= Identity
+ World Origin
+ Observable Property
+ World Form
+ Source Relation
+ Availability
```

Material Seed는 다음만 말한다.

* 세계에서 무엇으로 보이는가.
* 어떤 원인으로 생기는가.
* 자연 상태에서 무엇을 흡수·방출·축적·변형하는가.
* 생물의 기관, 식물, 광물, 분비물, 잔류물 등 어떤 형태로 존재하는가.
* 어떤 조건에서 유지되거나 붕괴하는가.
* 어디에서 어느 정도의 공급 안정성을 가지는가.

다음은 말하지 않는다.

* 무엇과 조합해야 하는가.
* 어떤 Recipe가 존재하는가.
* 장비나 Skill에 어떤 수치 효과를 주는가.
* 어떤 Class의 필수 재료인가.

##### 3.2 Resource Source

Material Seed를 세계에 실제로 발생시키는 원천이다.

예:

* 특정 광물을 흡수한 뿌리
* 생물의 기관·허물·알·사체
* 균류나 식물 군락
* 지층·광맥·퇴적층
* 폭풍·공간 변형·열원 등이 남긴 응결물
* 포식·번식·이동·붕괴 뒤에 남은 부산물

Resource Source는 단순 Loot Node가 아니다. 생태·현상·지형의 일부이며 상태와 생애를 가진다.

##### 3.3 Resource Opportunity

플레이어가 재료 또는 그 원천에 접근할 수 있는 하나의 세계적 기회다.

```text
Resource Opportunity
= Source
+ Occurrence Condition
+ Spatial Position
+ Clue
+ Threat Relation
+ World Consequence
```

같은 Material Seed라도 여러 Opportunity를 가질 수 있다.

```text
생물의 살아 있는 기관
사체에서 남은 기관
포식자의 둥지에 쌓인 잔류물
이동 경로에 떨어진 허물
특정 사건 뒤 생긴 변형물
```

##### 3.4 Resource Ecology

하나의 Region 안에서 World Cause와 재료 원천들이 맺는 관계다.

```text
World Cause
├─ Environment / Region Rule
├─ Producer / Accumulator
├─ Consumer / Carrier
├─ Residue / By-product
├─ Resource Source
├─ Trace
├─ Depletion / Recovery
└─ Region Flow
```

##### 3.5 Resource Flow

재료·원천·부산물·생물 운반체가 Region 사이를 이동하는 관계다.

Resource Flow는 플레이어 거래나 경제가 아니다. 강, 바람, 생물 이동, 붕괴, Connector 현상 등 세계 내부의 이동만 다룬다.

────────

#### 4. 재료 생태의 핵심 원칙

##### M1. 하나의 World Cause는 하나의 대표 재료가 아니라 Resource Web을 만든다

좋은 Region은 다음처럼 닫힌다.

```text
World Cause
→ 환경 변화
→ 생산자 또는 축적자
→ 그것을 먹거나 옮기는 생물
→ 사체·허물·분비물·퇴적물
→ 서로 다른 위치와 상태의 재료 원천
```

모든 원천이 서로 다른 Material Seed를 내야 하는 것은 아니다. 같은 재료가 다른 순도·형태·오염 상태로 나타날 수도 있다. 중요한 것은 Region의 재료가 하나의 상자나 보스 사체에만 집중되지 않는 것이다.

##### M2. 재료는 Drop Table이 아니라 세계 개체와 현상의 일부다

재료는 반드시 다음 중 하나에 매달린다.

* Actor 또는 생물의 몸과 생애
* 식물·균류 군락
* Terrain·지층·수계
* Region Rule이 만든 현상
* 다른 Source의 잔류물이나 부산물
* World State 전이가 만든 일시적 결과

원천 없는 Resource Area나 이유 없이 반복 생성되는 Loot Node를 만들지 않는다.

##### M3. Region 안에는 재료 기회의 공간적 구배가 있다

특수 Region은 원칙적으로 다음 네 역할을 검토한다.

| 역할 | 무대에서의 의미 |
|---|---|
| **Baseline Opportunity** | Region의 경계나 비교적 안전한 구간에서 현상과 재료 계통을 처음 접한다. |
| **Risk Opportunity** | 더 깊은 위험·생태 관계에 접근해야 얻을 수 있다. |
| **Conditional Opportunity** | 시간·날씨·사건·World State가 맞을 때만 드러난다. |
| **By-product Opportunity** | 포식·이동·붕괴·번식·사망 등 생태 과정의 결과로 생긴다. |

고유하거나 유한한 World Event Opportunity는 선택적으로 추가한다.

실제 재료 종류 수는 Region의 규모에 따라 정한다. 다만 세계적으로 중요한 특수 Region은 대표 재료 하나만 두지 않고, 위 네 역할 중 최소 세 역할을 충족해야 한다.

##### M4. 재료 발견은 흔적에서 시작한다

모든 주요 Resource Source는 직접 노출되기 전에 하나 이상의 Trace를 남겨야 한다.

```text
변색된 토양
먹고 남은 껍질
비정상적인 식생
광택·열·냄새·소리
사체의 분해 방식
생물의 이동 방향
지형의 균열과 침전
최근 채취되거나 고갈된 흔적
```

Trace는 단순 안내 표식이 아니다. 다음을 추론하게 해야 한다.

* 무엇이 근처에 있는가.
* 어떤 조건에서 생기는가.
* 현재 접근 가능한 상태인가.
* 어떤 위험이나 생물과 연결되는가.
* 이미 고갈되었는가, 회복 중인가.

##### M5. 재료는 Region State와 시간에 연결된다

고정 배치만으로 모든 공급을 해결하지 않는다. 각 Source는 다음 조건 중 필요한 것을 가진다.

* 시간대 또는 주기
* 날씨·기후 상태
* 특정 생물의 이동·번식·사망
* Region Rule의 활성 단계
* Connector 배열이나 접근 상태
* 다른 Source의 존재·부재
* 플레이어 또는 세계 사건으로 발생한 상태 변화

조건은 플레이어가 관찰할 수 있어야 한다. 보이지 않는 랜덤 출현만으로 희귀성을 만들지 않는다.

##### M6. 모든 Source는 생애를 가진다

Resource Source는 가능한 경우 다음 상태 흐름을 정의한다.

```text
Latent
→ Accumulating / Growing
→ Exposed / Active
→ Available
→ Depleted / Disturbed / Transformed
→ Recovering / Migrated / Extinct
```

모든 단계를 강제하지는 않는다. 대신 현재 Source가 어디에서 생기고, 채취 뒤 무엇이 되며, 다시 나타난다면 어떤 원인으로 회복되는지는 반드시 정한다.

##### M7. 공유 세계의 공급은 세계 내부의 과정으로 유지된다

Source는 다음 공급 유형 중 하나를 가진다.

| Supply Mode | 의미 |
|---|---|
| `BASELINE_RENEWABLE` | 생장·번식·퇴적 등으로 비교적 안정적으로 회복된다. |
| `CONDITIONAL_RENEWABLE` | 특정 상태나 사건이 다시 충족되어야 회복된다. |
| `MIGRATORY` | 같은 자리에 재생되지 않고 생물·현상과 함께 위치가 이동한다. |
| `EVENT_SCARCE` | 드문 세계 사건 동안만 생기지만 사건은 반복 가능하다. |
| `FINITE_WORLD_STATE` | 세계에 한정되어 있고 소진이 영구적 또는 장기적 변화를 만든다. |

단순 Respawn Timer는 구현 수단일 수 있지만 세계 설명이 될 수 없다. 각 회복에는 번식, 이동, 축적, 퇴적, 재활성화 등 세계 내부 원인이 있어야 한다.

FINITE_WORLD_STATE는 특별한 세계 변화에만 사용한다. 다수 플레이어의 기본 성장에 반복적으로 필요한 공급을 이 유형 하나에 의존시키지 않는다.

##### M8. 채취는 세계에 결과를 남긴다

모든 주요 Source는 채취·훼손·제거가 다음 중 무엇을 바꾸는지 정의한다.

* 해당 Source의 상태와 외형
* 주변 생물의 행동
* 생산자·소비자 관계
* 위험의 강도나 위치
* 다른 재료의 생성 조건
* Terrain 또는 Connector의 안정성
* 회복 속도나 다음 출현 위치

변화가 항상 거대할 필요는 없다. 다만 채취 전후가 세계에서 구분되어야 한다. 아무 반응 없이 사라졌다가 같은 좌표에 다시 나타나는 오브젝트를 기본형으로 삼지 않는다.

##### M9. 일부 재료는 Region 경계를 넘어 흐른다

Region이 논리적으로 연결된 하나의 세계라면 재료 생태도 완전히 고립되어서는 안 된다.

각 주요 Region은 다음 중 하나를 정의한다.

* 다른 Region에서 유입되는 원천·부산물
* 다른 Region으로 이동하는 생물·입자·퇴적물
* Connector 상태에 따라 바뀌는 이동 경로
* 같은 Material Seed가 다른 Region에서 변형되어 나타나는 관계
* 외부 흐름이 없는 경우, 그것이 차단된 세계적 이유

모든 Region에 억지 흐름을 만들 필요는 없다. 다만 고립 여부조차 World Cause로 설명한다.

##### M10. 무대는 재료의 세계 사실을 넘기고 해석은 후속 층에 맡긴다

Material Seed에는 후속 설계가 사용할 수 있는 관찰 가능한 성질을 적는다.

예:

```text
열을 흡수한다.
진동에 반응한다.
특정 생물의 체내에서만 축적된다.
빛을 받으면 구조가 무너진다.
사망 뒤 일정 상태에서 결정화된다.
```

그러나 다음 문장은 이 문서에 적지 않는다.

```text
A와 B를 조합하면 검이 된다.
냉기 피해 +20을 준다.
특정 Class 진화에 10개 필요하다.
```

────────

#### 5. Resource Ecology Contract

모든 세계적으로 중요한 특수 Region은 다음 계약을 작성한다.

```text
Resource Ecology Contract
├─ Cause Network
├─ Material Seeds
├─ Resource Sources
├─ Opportunity Gradient
├─ Occurrence Conditions
├─ Trace Network
├─ Source Lifecycle
├─ Harvest Consequence
├─ Depletion / Recovery
├─ Inflow / Outflow
└─ Downstream Handoff
```

##### 5.1 Cause Network

어떤 World Cause가 어떤 생산자·축적자·운반체·소비자·잔류물을 만드는지 적는다.

```text
원인 없는 재료 금지
재료만을 위해 존재하는 생물 금지
생태와 관계없이 배치된 보상 상자 금지
```

##### 5.2 Material Seeds

Region에서 처음 등장하거나 의미 있게 변형되는 재료의 세계 사실을 적는다.

##### 5.3 Resource Sources

Material Seed가 어느 개체·지형·현상에 존재하는지 적는다. 하나의 Material Seed가 여러 Source를 가질 수 있고, 하나의 Source가 여러 Material Seed를 품을 수도 있다.

##### 5.4 Opportunity Gradient

경계·중간·핵심·조건부 상태에서 어떤 재료 기회가 있는지 적는다.

##### 5.5 Occurrence Conditions

시간·날씨·사건·생태·Region State·Connector 상태와의 관계를 적는다.

##### 5.6 Trace Network

플레이어가 원천의 존재·위치·상태를 추론할 수 있는 흔적과 피드백을 적는다.

##### 5.7 Source Lifecycle

생성·축적·노출·고갈·회복 또는 소멸의 흐름을 적는다.

##### 5.8 Harvest Consequence

채취가 Source와 주변 세계에 남기는 변화를 적는다.

##### 5.9 Depletion / Recovery

공유 World State에서 공급이 고갈되고 되살아나는 세계 내부 원인을 적는다.

##### 5.10 Inflow / Outflow

Region 경계를 넘는 자연적 이동과 변형을 적는다.

##### 5.11 Downstream Handoff

후속 Item·Growth·Combination 설계가 받을 Material Seed와 공급 조건을 적되, 사용법은 결정하지 않는다.

────────

#### 6. 데이터 계약

아래는 의미 계약이다. 실제 TypeScript 타입과 파일 배치는 구현 Agent가 기존 코드 구조에 맞춰 조정할 수 있으나 필드의 의미는 유지한다.

##### 6.1 World Material Seed

```yaml
WorldMaterialSeed:
  id: MATERIAL_ID
  name: 표시 이름
  identity: 이 재료가 세계에서 무엇인가
  origin:
    worldCause: WORLD_CAUSE_ID
    description: 어떤 자연·생태·현상 때문에 생기는가
  worldForms:
    - form: RAW_FORM_ID
      description: 자연 상태에서 어떤 모습으로 존재하는가
  observableProperties:
    appearance:
      - 화면에서 구분되는 특징
    behavior:
      - 자연 상태에서 관찰되는 반응
    conditionResponse:
      - 특정 환경·상태에서 어떻게 달라지는가
    persistence:
      - 분리되거나 환경이 바뀐 뒤 무엇이 유지되는가
    danger:
      - 자체 위험이 있다면 무엇인가
  sourceRefs:
    - RESOURCE_SOURCE_ID
  availability:
    supplyMode: BASELINE_RENEWABLE
    originRegions:
      - REGION_ID
  downstreamBoundary:
    definesHere:
      - 세계 기원
      - 관찰 가능한 성질
      - 자연 상태의 형태
      - 공급 조건
    deferred:
      - recipe
      - combination rule
      - item effect
      - skill/class requirement
      - numeric balance
```

##### 6.2 Resource Source

```yaml
ResourceSource:
  id: RESOURCE_SOURCE_ID
  region: REGION_ID
  materialSeeds:
    - MATERIAL_ID
  carrier:
    type: CREATURE | PLANT | FUNGUS | TERRAIN | WATER | ATMOSPHERE | PHENOMENON | RESIDUE
    ref: WORLD_ENTITY_OR_FEATURE_ID
  cause:
    worldCause: WORLD_CAUSE_ID
    relation: 생산·흡수·축적·운반·퇴적·잔류 중 무엇인가
  occurrence:
    depthAreas:
      - outer
    requiredWorldState:
      - STATE_CONDITION
    timeOrCycle:
      - OBSERVABLE_CYCLE
    dependencies:
      - OTHER_SOURCE_OR_ACTOR_ID
  spatialRole: BASELINE | RISK | CONDITIONAL | BY_PRODUCT | WORLD_EVENT
  clues:
    - trace: TRACE_ID
      reveals: 존재 | 방향 | 활성 상태 | 고갈 상태 | 회복 단계
  lifecycle:
    initial: LATENT
    transitions:
      - from: LATENT
        to: AVAILABLE
        cause: WORLD_EVENT_OR_PROCESS
      - from: AVAILABLE
        to: DEPLETED
        cause: HARVEST_OR_WORLD_PROCESS
  harvestConsequence:
    sourceState: 채취 후 Source가 어떻게 보이고 변하는가
    ecologyState:
      - 주변 생태·위험·지형에 남는 결과
  supply:
    mode: CONDITIONAL_RENEWABLE
    depletionScope: LOCAL_SOURCE | REGION_POPULATION | WORLD_UNIQUE
    recoveryCause: 번식·생장·퇴적·이동·재활성화 등 세계 내부 원인
    recoveryFeedback:
      - 회복 단계가 보이는 흔적
  flow:
    inflow:
      - RESOURCE_FLOW_ID
    outflow:
      - RESOURCE_FLOW_ID
```

##### 6.3 Resource Flow

```yaml
ResourceFlow:
  id: RESOURCE_FLOW_ID
  materialOrSource: MATERIAL_OR_SOURCE_ID
  from:
    region: REGION_ID
    source: RESOURCE_SOURCE_ID
  to:
    region: REGION_ID
    destinationRole: 퇴적지 | 서식지 | 통과 경로 | 변형 지대
  carrier:
    type: CREATURE | WIND | WATER | FALLING | RIFT | WORLD_PHENOMENON
    ref: CARRIER_ID
  connector:
    ref: CONNECTOR_ID
  condition:
    - WORLD_STATE_OR_CYCLE
  transformation:
    resultMaterial: MATERIAL_ID_OR_SAME
    description: 이동 뒤 형태가 달라진다면 그 세계적 이유
  feedback:
    - 도착 또는 이동을 알아볼 수 있는 흔적
```

##### 6.4 RegionSpec 확장

기존 RegionSpec에 다음 블록을 추가한다.

```yaml
Region:
  # 기존 필드 유지
  resourceEcology:
    causeNetwork:
      - WORLD_CAUSE_TO_SOURCE_RELATION
    materialSeeds:
      - MATERIAL_ID
    sources:
      - RESOURCE_SOURCE_ID
    opportunityGradient:
      baseline:
        - RESOURCE_SOURCE_ID
      risk:
        - RESOURCE_SOURCE_ID
      conditional:
        - RESOURCE_SOURCE_ID
      byProduct:
        - RESOURCE_SOURCE_ID
      worldEvent:
        - RESOURCE_SOURCE_ID
    traces:
      - TRACE_ID
    inflows:
      - RESOURCE_FLOW_ID
    outflows:
      - RESOURCE_FLOW_ID
    isolationReason: 외부 흐름이 없다면 그 이유
    downstreamHandoff:
      materialSeeds:
        - MATERIAL_ID
      unresolvedUses: true
```

##### 6.5 Terrain Description 연결

RegionSpec.space의 기존 layer를 다음 의미로 연결한다.

```text
area/point(layer: 'resource')
  → Resource Source가 실제로 존재하거나 출현할 수 있는 자리

point/curve/area(layer: 'trace')
  → Source의 존재·방향·상태를 암시하는 흔적

curve/area(layer: 'presence')
  → 재료를 운반하거나 출현 조건을 만드는 압도적 존재·생물의 경로

point(layer: 'anchor')
  → Resource Flow가 Connector를 통과할 때의 논리적 연결점
```

공간 배치는 Source의 의미 계약에서 파생한다. 먼저 광맥·약초 위치를 그린 뒤 이유를 붙이지 않는다.

────────

#### 7. Region 제작 공정에 반영하는 방식

새 Workflow를 만들지 않는다. 기존 12단계의 산출물을 다음처럼 확장한다.

**단계 1. Core Proposition**

기존 정의를 유지한다. 추가 질문:

```text
이 현상은 어떤 종류의 물질·기관·잔류물·변형 지형을 만들 수 있는가?
```

**단계 2. World Cause**

기존 정의를 유지한다. 추가 산출물:

```text
Cause Network 초안
- 무엇이 생산하는가
- 무엇이 축적하는가
- 무엇이 먹고 옮기는가
- 무엇이 죽거나 붕괴한 뒤 남는가
```

**단계 3. Rule Set**

기존 Rule Contract를 유지한다. 추가 확인:

* Core/Supporting/Ambient Rule이 Source의 생성·노출·이동·회복 중 무엇을 바꾸는가.
* 규칙 상태 변화가 Resource Opportunity로 관찰되는가.

**단계 4. Phenomenon / Ecology**

기존 산출물에 Resource Ecology Contract를 추가한다.

필수 산출물:

* Material Seed 목록
* Resource Source 목록
* Source 간 생태 관계
* Source Lifecycle
* Supply Mode

**단계 5. Exploration Contract**

기존 Threat·Clue·Opportunity·Refuge·Reward·Discovery에 다음을 포함한다.

* Baseline / Risk / Conditional / By-product Opportunity
* Source를 찾는 Trace
* 고갈·회복 상태를 읽는 피드백
* 채취 뒤 달라지는 세계 상태

**단계 6. Entry / Exit / Connector**

Connector가 Source 또는 Resource Flow에 미치는 영향을 정의한다.

* 어떤 공급이 Connector 개방 상태에 의존하는가.
* 이동하는 생물·현상이 어느 Connector를 통과하는가.
* Connector가 닫히면 대체 공급 또는 고립 상태가 생기는가.

**단계 7. Growth Outcome**

기존 정의를 유지하되 이 층에서는 다음만 확정한다.

```text
무엇을 얻었는가           Material Seed / 세계 사실
어떤 공급 조건을 갖는가    Availability / Supply Mode
무엇으로 성장하는가        후속 층 위임
어떻게 조합하는가          후속 층 위임
```

**단계 8. Topology**

기존 Region/Connector 관계에 Resource Flow를 겹쳐 본다.

* Inflow / Outflow
* 이동 운반체
* 도착지의 퇴적·변형·서식 관계
* 외부 흐름이 없는 Region의 고립 원인

**단계 9. Spatial Requirement**

기존 거리·높이·시야·경로 요구에 Opportunity Gradient를 배치한다.

```text
경계부     첫 흔적과 Baseline Opportunity
전이부     생태 관계를 읽을 수 있는 Source
핵심부     Risk Opportunity
변동 구역  Conditional / By-product Opportunity
피난처     획득물을 확인하고 다음 위험을 판단할 자리
```

모든 재료를 핵심부 한 지점에 몰아넣지 않는다.

**단계 10. Terrain Compilation**

각 Source·Trace·Flow를 resource·trace·presence·anchor layer로 옮긴다.

**단계 11. Play Observation**

다음을 관찰한다.

* 재료 아이콘 없이 Trace만으로 Source를 추적할 수 있는가.
* Region 초입에서도 재료 계통과 현상을 접할 수 있는가.
* 위험이 깊어질수록 단순 수량이 아니라 다른 Source와 출현 조건이 나타나는가.
* 채취 전후의 세계 상태가 구분되는가.
* 다른 플레이어가 채취한 뒤에도 회복 과정이나 대체 기회를 관찰할 수 있는가.
* 특정 시기·상태에 재방문할 이유가 생기는가.

**단계 12. Revision**

다음 경우 수정한다.

* 대표 재료 하나만 존재한다.
* 모든 재료가 몬스터 사망 Drop으로만 나온다.
* Source의 존재를 공략 좌표나 UI 표식으로만 알 수 있다.
* 고갈 뒤 세계 내부 원인 없이 타이머로 복원된다.
* 채취가 주변 생태와 상태에 아무 결과도 남기지 않는다.
* Region마다 재료 계통이 완전히 고립되어 세계의 연속성이 보이지 않는다.
* Material Seed에 후속 Item 효과나 Recipe를 미리 확정했다.

────────

#### 8. 검증 기준

기존 L2-World-Region.md §17 검증 기준에 다음 묶음을 추가한다.

##### 8.1 재료 인과

* 모든 Material Seed가 하나 이상의 World Cause와 Resource Source를 가지는가.
* 모든 Resource Source가 환경·생태·현상 중 하나에 실제로 속하는가.
* 재료만을 얻기 위해 이유 없이 존재하는 생물·상자·노드가 없는가.
* 같은 Cause가 만든 위험과 Source의 관계를 설명할 수 있는가.

##### 8.2 재료 다양성

* 세계적으로 중요한 특수 Region이 Opportunity 역할 세 종류 이상을 충족하는가.
* Region의 재료가 하나의 Carrier 유형에만 편중되지 않는가.
* 경계·중간·핵심 또는 변동 상태에서 서로 다른 발견 기회가 있는가.
* 대표 재료 외에 부산물·잔류물·변형 원천이 존재하는가.

##### 8.3 발견 가능성

* 주요 Source마다 직접 노출 이전에 Trace가 있는가.
* Trace가 단순 위치 표시가 아니라 원천의 종류·방향·상태 중 하나를 드러내는가.
* 출현 조건과 회복 과정이 화면·소리·행동·지형 변화로 관찰되는가.
* 고갈된 장소와 아직 활성인 장소를 구분할 수 있는가.

##### 8.4 지속 공급

* 모든 Source가 Supply Mode를 가지는가.
* Renewable Source가 세계 내부의 회복 원인을 가지는가.
* Finite Source가 왜 유한하며 소진 뒤 세계가 어떻게 달라지는지 정의했는가.
* 공유 세계에서 후발 플레이어가 관찰하거나 접근할 대체 Opportunity가 있는가.
* 기본적인 반복 공급을 World Unique Source 하나에 의존하지 않는가.

##### 8.5 세계 반응

* 채취가 Source 상태와 외형에 결과를 남기는가.
* 주요 채취가 주변 생태·위험·지형·다른 Source 중 하나 이상에 영향을 주는가.
* 과도한 채취가 단순 대기 시간이 아니라 변화된 세계 상태를 만드는가.
* 회복 단계가 새로운 Trace와 행동 변화를 만드는가.

##### 8.6 Region 연결

* 주요 Region이 Inflow·Outflow 또는 명시된 Isolation Reason을 가지는가.
* Resource Flow의 from/to Region과 Connector가 실제 그래프에 존재하는가.
* 같은 Material Seed가 다른 Region에서 나타날 경우 변형 이유가 있는가.
* 흐름이 Region의 생태와 공간 연결을 실제로 설명하는가.

##### 8.7 후속 층 경계

* Material Seed가 세계 기원과 관찰 가능한 성질을 제공하는가.
* Recipe·조합 결과·Item 수치·Class 요구 조건을 확정하지 않았는가.
* 후속 설계가 사용할 공급 유형과 원천 위치를 명확히 인계하는가.

────────

#### 9. 도구 보고 항목

기존 world:observe --report의 ①~⑨에 다음을 추가한다. 기계는 재미나 세계관의 질을 판정하지 않고, 빠진 계약과 끊긴 참조를 보고한다.

```text
⑩ 모든 resource area/point 에 sourceId가 있는가
⑪ 모든 Resource Source가 worldCause와 materialSeed를 참조하는가
⑫ 모든 Material Seed가 하나 이상의 유효한 Source를 가지는가
⑬ 모든 주요 Source가 Supply Mode와 Lifecycle을 가지는가
⑭ Renewable Source에 recoveryCause가 있는가
⑮ Finite Source에 depletion consequence가 있는가
⑯ 모든 주요 Source에 Trace 참조가 있는가
⑰ Trace가 가리키는 Source와 Region이 실제로 존재하는가
⑱ Resource Flow의 from/to Region·Source·Connector가 유효한가
⑲ 특수 Region의 Opportunity 역할 분포를 요약하는가
⑳ Region별 Carrier 유형 분포와 Source 수를 요약하는가
㉑ source 없는 resource 배치와 material 없는 source를 보고하는가
㉒ 외부 Flow도 Isolation Reason도 없는 주요 Region을 보고하는가
```

수량의 적정성은 Human이 판단한다. 도구는 대표 재료 하나뿐, 모든 Source가 CREATURE, Conditional Opportunity 없음 같은 편중을 요약해 보이게 한다.

────────

#### 10. Region Spec 작성 양식

다른 Agent는 Region을 설계할 때 기존 Region Spec 뒤에 다음 표를 반드시 채운다.

##### 10.1 Material Seed 표

| Material Seed | 세계 기원 | 자연 형태 | 관찰 가능한 성질 | 공급 유형 | 후속 사용 |
|---|---|---|---|---|---|
| `ID` | World Cause와 생성 과정 | 기관·광물·분비물·잔류물 등 | 세계 안에서 실제로 보이는 반응 | Supply Mode | **미정 — 후속 층** |

##### 10.2 Resource Source 표

| Source | Carrier | 공간 역할 | 출현 조건 | Trace | 채취 결과 | 회복 원인 |
|---|---|---|---|---|---|---|
| `ID` | 생물·식물·지형·현상 등 | Baseline/Risk/Conditional/By-product | State·시간·사건 | 무엇으로 발견하는가 | 세계가 무엇으로 변하는가 | 어떻게 다시 생기는가 |

##### 10.3 Opportunity Gradient

```text
경계부:
중간부:
핵심부:
조건부 상태:
생태 부산물:
세계 사건:
```

##### 10.4 Resource Flow 표

| Flow | 출발 Region/Source | 운반체·현상 | 조건 | 도착 Region | 도착 뒤 변화 | Trace |
|---|---|---|---|---|---|---|

##### 10.5 미해결 질문

다음이 없으면 임의로 채우지 않고 UNRESOLVED로 남긴다.

* Material Seed의 고유한 세계적 성질
* Source의 회복 원인
* 채취가 생태에 미치는 결과
* Region 간 자연 이동의 근거
* Finite Source를 반복 성장에 사용해도 되는지에 대한 후속 설계 판단

────────

#### 11. 비확정 적용 예시 — 거대 악마의 숲

아래는 기존 World Concept의 생태 사슬을 계약에 옮기는 작성 방식 예시다. 새로운 정식 세계 사실을 확정하지 않는다.

기존 Cause Network:

```text
거대 수목
→ 특정 광물을 뿌리에서 흡수
→ 광물을 먹는 곤충
→ 곤충을 먹는 대형 조류
→ 조류를 사냥하는 포식자
→ 포식자의 사체에서 특수 균류
→ 균류 때문에 거대 수목 성장
```

이 사슬은 하나의 대표 재료가 아니라 다음 Source 후보를 자연스럽게 만든다.

```text
거대 수목의 광물 축적 부위
광물을 먹은 곤충의 몸·허물·잔류물
대형 조류가 옮긴 곤충 잔해
포식자의 사체
사체에서 성장한 특수 균류
균류가 분해한 뒤 남은 토양·뿌리 주변 변화
```

Agent는 각 후보에 대해 다음만 결정한다.

1. 어떤 Material Seed를 세계에 제공하는가.
2. 어디에서 어떤 상태일 때 나타나는가.
3. 어떤 Trace로 먼저 발견되는가.
4. 채취가 먹이사슬과 Source 상태에 무엇을 남기는가.
5. 번식·포식·분해·수목 성장 중 어떤 과정으로 회복되는가.
6. 생물 이동으로 다른 장소나 Region에 운반되는가.
7. 후속 Item/Combination 설계에 넘길 관찰 가능한 세계 성질은 무엇인가.

다음은 결정하지 않는다.

```text
곤충 껍질 + 균류 = 특정 장비
포식자 기관 = 공격력 증가
거목 재료 10개 = Class 진화
```

────────

#### 12. 다른 Agent의 작업 지시

##### 12.1 입력

* L2-World-Concept.md
* L2-World-Region.md
* 대상 Region의 현재 RegionSpec
* 대상 Region의 World Cause, Rule Set, Ecology, Connector Graph

##### 12.2 작업 순서

```text
1. 기존 World Cause와 Ecology에서 생산자·축적자·운반체·소비자·잔류물을 추출한다.
2. 임의의 보상 아이템을 만들지 않고 Material Seed 후보를 도출한다.
3. 각 Material Seed를 실제 Resource Source에 연결한다.
4. Baseline/Risk/Conditional/By-product Opportunity를 배치한다.
5. 각 Source의 Trace·Occurrence·Lifecycle·Supply Mode를 작성한다.
6. 채취 결과와 회복 원인을 World State 전이로 작성한다.
7. Connector Graph 위에 자연적인 Inflow/Outflow를 검토한다.
8. RegionSpec.resourceEcology와 Terrain resource/trace layer를 작성한다.
9. 검증 기준과 도구 보고 항목을 실행한다.
10. Recipe·Item 효과·Class 요구가 들어갔다면 제거하고 후속 층으로 넘긴다.
```

##### 12.3 산출물

```text
A. 대상 Region의 Resource Ecology Contract
B. World Material Seed 목록
C. Resource Source 목록과 Lifecycle
D. Opportunity Gradient
E. Trace Network
F. Depletion / Recovery 계약
G. Resource Flow 또는 Isolation Reason
H. RegionSpec.resourceEcology 패치
I. Terrain resource/trace/presence 배치 요구
J. UNRESOLVED 목록
```

##### 12.4 금지

* Region마다 대표 재료 하나만 배치하고 완료하지 않는다.
* 모든 재료를 몬스터 처치 Drop으로 만들지 않는다.
* 세계 원인 없이 희귀도와 Respawn 시간부터 정하지 않는다.
* 미니맵 아이콘을 Trace의 대체물로 사용하지 않는다.
* 공유 세계의 영구 고갈을 기본 성장 재료에 적용하지 않는다.
* 재료 획득 뒤 세계가 즉시 원상복구되는 것으로 처리하지 않는다.
* 이 문서에서 Recipe·조합식·Item 수치·Class 변화까지 설계하지 않는다.
* 기존 문서에 없는 정식 세계 사실을 예시라는 표시 없이 확정하지 않는다.

────────

#### 13. 완료 조건

대상 Region은 다음 질문에 모두 답할 때 재료를 제공하는 무대로 닫힌다.

```text
1. 무엇이 이 재료를 만드는가?
2. 재료는 어떤 세계 개체·지형·현상에 존재하는가?
3. 플레이어는 보기 전에 어떤 흔적으로 존재를 추론하는가?
4. 경계·중간·핵심·조건부 상태에서 각각 어떤 기회가 있는가?
5. 어떤 시간·사건·생태·World State에서 나타나는가?
6. 채취하면 Source와 주변 세계가 어떻게 달라지는가?
7. 고갈되면 어떤 세계 과정으로 회복·이동·소멸하는가?
8. 공유 세계에서 후발 플레이어에게 어떤 관찰·대체 기회가 남는가?
9. 다른 Region과 어떤 물질·생물·현상 흐름을 주고받는가?
10. 후속 성장·아이템·조합 Agent에게 어떤 Material Seed를 넘기는가?
11. Recipe와 효과를 정하지 않고도 재료의 고유한 세계성이 분명한가?
```

────────

#### 14. 최종 원칙

* 무대는 조합법을 소유하지 않지만, 조합할 가치가 있는 재료의 세계적 근거를 소유한다.
* Region은 보상 하나를 품은 퍼즐 상자가 아니라 여러 Source와 상태를 가진 재료 생태다.
* 재료는 World Cause·생태·현상·지형에 매달리며 원천 없이 배치되지 않는다.
* 재료는 고정 좌표뿐 아니라 시간·사건·World State에 따라 나타난다.
* 플레이어는 아이콘보다 Trace를 통해 재료의 존재와 상태를 발견한다.
* 채취는 Source와 주변 세계에 관찰 가능한 결과를 남긴다.
* 공급은 Respawn이라는 외부 규칙이 아니라 생장·번식·이동·퇴적·재활성화라는 세계 과정으로 설명된다.
* 일부 재료와 부산물은 Region 사이를 이동하여 세계의 연속성을 만든다.
* Material Seed는 세계 기원과 관찰 가능한 성질을 후속 층에 넘기되, Recipe·효과·수치는 넘겨받은 층이 결정한다.
* 이 계약이 닫혀야 세계는 성장과 조합 시스템이 장기간 소비할 수 있는 재료를 충분히 제공하는 무대가 된다.

> 원문은 채팅에서 왔다 — 표와 번호 목록으로만 되살렸고 글자는 그대로다. 절 번호(0~14)와 원칙 번호(M1~M10)도 원문 그대로다.

---

## 2. 이 계약이 확정한 것

원문의 원칙 번호는 **M1~M10** 이고 로드맵 §3 의 미지 행 번호도 **M1·M2** 다 — 다른 이름공간이므로
번역은 확정 항목에 **S**(Source·Supply)를 쓴다. "M1" 이라고 쓰면 원문의 원칙이고, "미지 M1" 이라고
쓰면 거대 악마의 숲이다.

| # | 확정 | 원문 |
|---|---|---|
| **S1** | 하나의 World Cause 는 대표 재료 하나가 아니라 **Resource Web** 을 만든다. 같은 재료가 다른 순도·형태로 나타나도 된다 — 금지된 것은 상자 하나·사체 하나로의 집중이다 | M1 |
| **S2** | 재료는 Drop Table 이 아니라 세계 개체·현상의 일부다. **원천 없는 resource 배치 금지** — 도구가 검사한다 (⑩·㉑) | M2 |
| **S3** | Region 안에 재료 기회의 **공간적 구배**가 있다 — Baseline · Risk · Conditional · By-product (+선택적 World Event). 세계적으로 중요한 특수 Region 은 **최소 세 역할** | M3 |
| **S4** | 모든 주요 Source 는 직접 노출 이전에 **Trace** 를 남긴다. Trace 는 위치 표시가 아니라 종류·방향·상태 중 하나를 드러낸다 | M4 |
| **S5** | 재료는 고정 배치만이 아니라 **Region State·주기·사건**에 연결된다. 조건은 관찰 가능해야 한다 — 보이지 않는 난수로 희귀성을 만들지 않는다 | M5 |
| **S6** | 모든 Source 는 **생애**를 가진다 (Latent → Accumulating → Available → Depleted → Recovering/Migrated/Extinct). 전 단계를 강제하지 않되 생성·채취 후·회복 원인은 반드시 정한다 | M6 |
| **S7** | 공급은 **다섯 Supply Mode** 중 하나다. Respawn Timer 는 구현 수단일 수 있어도 세계 설명이 아니다 — 회복에는 세계 내부 원인이 있다. `FINITE_WORLD_STATE` 를 기본 성장 공급에 쓰지 않는다 | M7 |
| **S8** | 채취는 세계에 결과를 남긴다. **채취 전후가 세계에서 구분되어야** 하고, 반응 없이 같은 좌표에 다시 나타나는 오브젝트를 기본형으로 삼지 않는다 | M8 |
| **S9** | 일부 재료는 **Region 경계를 넘어 흐른다** (Resource Flow). 흐름이 없다면 그 고립조차 World Cause 로 설명한다 | M9 |
| **S10** | Material Seed 는 **세계 기원과 관찰 가능한 성질**만 넘긴다. Recipe · 조합 결과 · Item 수치 · Class 요구는 이 층이 쓰지 않는다 | M10 |
| **S11** | **Resource Ecology Contract 열한 항목**(§5)이 세계적으로 중요한 특수 Region 의 필수 산출물이다 | §5 |
| **S12** | 데이터 계약 넷 — `WorldMaterialSeed` · `ResourceSource` · `ResourceFlow` · `RegionSpec.resourceEcology`. 필드의 **의미**가 계약이고 타입·파일 배치는 구현이 정한다 | §6 |

그리고 **12단계 확장**(§7) · **검증 기준 일곱 묶음**(§8) · **도구 보고 ⑩~㉒**(§9) · **Region Spec 작성 양식**(§10)이
확정 대상이다.

### 2.1 무엇이 2층으로 오고 무엇이 남는가 — 덮임 지도의 수정

[play/README.md](play/README.md) 의 덮임 지도는 "W4 위험과 보상의 동근원(자원 사슬) → 4층" 이라고 적었다.
이 계약은 그 한 줄을 **둘로 가른다**.

```text
2층으로 온다 (세계 절반 ② 부속 — 이 문서)
  재료가 세계에서 왜 생기는가 · 어디에 붙어 있는가 · 무엇이 그것을 암시하는가 ·
  어떤 조건에서 나타나는가 · 캐면 세계가 어떻게 달라지는가 · 어떤 세계 과정으로 돌아오는가 ·
  Region 사이를 어떻게 흐르는가
        → 전부 **세계의 사실**이다. 몸도 지식도 성장도 없이 성립하고, 관찰로 증명된다

4층 이후에 남는다 (그 재료의 *쓰임*)
  소지·장비·가공 사슬 · 조합 문법 · Recipe · Item 효과 · 수치 · Class 요구 · 경제
        → 전부 **재료를 받는 쪽의 결정**이다. 이 문서는 그것을 정하지 않는다 (S10)
```

즉 4층이 사라지는 것이 아니라 **입력이 먼저 선다**. 4층은 "무엇이 어디서 나는가"를 새로 정하는 대신
2층이 넘긴 Material Seed 를 받아 쓰임을 정한다 — 로드맵 §2 의 4층 열("무엇이 어디서 나는가(2 의 지역과
연결) · 소지·장비·가공 사슬") 중 앞 절반이 여기서 닫힌다.

### 2.2 이 계약이 2층에서 성립하는 범위 — 생물은 아직 없다

원문의 Cause Network 는 생산자·소비자·운반체로 **생물**을 부른다 (곤충 · 조류 · 포식자). 그러나 3층
(주체와 몸 — 생물은 무엇을 알고 어떻게 행동하는가)은 미주입이다. 그러므로 2층에서 성립하는 것과
3층으로 넘기는 것을 가른다.

```text
2층이 세운다   생물이 **남긴 것**과 그것이 놓인 자리 — 허물 · 사체 · 둥지의 잔류물 · 분해된 토양.
              그리고 그 자리를 만드는 세계 과정(축적 · 생장 · 분해 · 퇴적)과 그 과정의 Region State.
              Carrier 유형 중 PLANT · FUNGUS · TERRAIN · WATER · PHENOMENON · RESIDUE 가 여기 선다
3층이 받는다   생물이 실제로 걸어 다니며 먹고 옮기고 죽는 것 — Carrier 유형 CREATURE 의 *살아 있는* 쪽,
              MIGRATORY 공급의 운반체, "주변 생물의 행동이 바뀐다"(M8)는 채취 결과
```

이것은 계약을 깎는 것이 아니라 **계약이 먼저 서고 생물이 나중에 그 자리에 들어오는** 순서다 —
2층이 세운 Source·Trace·Supply 는 3층에서 생물이 서면 그대로 그 생물에 매달린다.

**이 분할선은 [L2-World-Life.md](L2-World-Life.md) 가 옮겼다** (②-부속 셋째 · F10 · §2.1). 생물의 **탄생**은 2층으로
왔다 — 무엇이 재료인가 · 어떤 Region Rule 이 결속시키는가 · 무엇을 소비하는가 · 전후에 어떤 흔적이 남는가 ·
그것이 만드는 개체군 값과 개체군 사이의 관계(먹는다 · 부른다 · 남긴다)까지. 3층은 태어난 개체가 걷고 먹고 옮기고 죽는 것을 받는다. 이 문서가 남긴 UNRESOLVED
하나("살아 있는 운반체의 이동")의 절반이 그렇게 닫혔다 — **어디서 오는가**는 2층, **어떻게 다니는가**는 3층이다.

그 문서가 지목한 이 계약의 구멍 하나: 부록 A.2 의 `MOLT_LITTER` 는 회복 원인이 "탈피 주기" 인데 **벗은 것이
세계에 없었다.** 검사 ㉛ 이 앞으로 그런 자리를 잡아낸다.

---

## 3. 도구에 주는 변화

### 3.1 layer — 새 layer 를 만들지 않는다

원문 §6.5 가 요구하는 넷은 이미 있다. `resource` · `trace` · `presence` 는
[L2-World-Concept.md](L2-World-Concept.md) §3.5 가 확정한 layer 이고, `anchor` 는
[L2-World-Region.md](L2-World-Region.md) §3 이 더한 layer 다. 이 계약이 하는 일은 **그 넷에 의미를
매다는 것**뿐이다.

```text
resource   area/point   Source 가 존재하거나 출현할 수 있는 자리 — op 마다 sourceId 를 가진다 (검사 ⑩)
trace      point/curve/area   Source 의 존재·방향·상태를 암시하는 흔적 — 무엇을 드러내는지(reveals)를 가진다
presence   curve/area   재료를 운반하거나 출현 조건을 만드는 존재의 자리·경로
anchor     point        Resource Flow 가 Connector 를 통과할 때의 논리적 연결점 (Connector 의 anchor 그대로)
```

**공간이 의미에서 나온다** — 광맥 자리를 먼저 그리고 이유를 붙이지 않는다 (§6.5 · R11 과 같은 방향).

### 3.2 파일 — RegionSpec 이 resourceEcology 를 품는다

[L2-World-Region.md](L2-World-Region.md) §3.1 이 정한 자리 그대로다. Region Spec 은 의미이고 `space` 는
공간이며, 컴파일러는 여전히 `space` 만 읽는다.

```text
content/regions/<id>.ts        RegionSpec += resourceEcology (§6.4)
content/regions/materials.ts   WorldMaterialSeed 목록 — Region 을 넘어 공유되는 세계 사실이므로 Region 파일 밖
content/regions/sources.ts     ResourceSource 목록 (또는 Region 파일 안 — 구현이 정한다 · S12)
content/regions/flows.ts       ResourceFlow 목록 — from/to 가 두 Region 이므로 graph.ts 곁
```

규칙 코드는 **어떤 재료도 어떤 원천도 이름으로 알지 못한다** — R13 이 방과 Connector 에 대해 말한 것이
재료에도 그대로 성립한다. Source 를 더하는 것은 값이 느는 일이지 규칙이 느는 일이 아니다.

### 3.3 도구가 새로 검사하는 것 — ⑩~㉒

Concept §3.6 의 ①~④ 와 Region §3.2 의 ⑤~⑨ 에 원문 §9 의 열셋이 이어진다. 성질이 둘로 갈린다.

```text
참조 무결성 (통과/실패)   ⑩ ⑪ ⑫ ⑬ ⑭ ⑮ ⑯ ⑰ ⑱ ㉑ ㉒
                       — 끊긴 참조와 빠진 계약. 기계가 판정한다
분포 요약 (판정 없음)     ⑲ Opportunity 역할 분포 · ⑳ Carrier 유형 분포와 Source 수
                       — 편중을 **보이게만** 한다. 적정한지는 Human 이 본다 (§9 마지막 줄)
```

Concept §3.6 의 ① ("resource area 가 hazard area 와 겹치거나 인접하는가")은 이 계약과 같은 것을 본다 —
①이 *같은 근원*을 보고, ⑪이 *그 근원이 적혀 있는가*를 본다.

### 3.4 도구 밖으로 가는 것

| 원문 | 무엇인가 | 어디 |
|---|---|---|
| §6.1 `observableProperties` | 재료의 세계 사실 — 무엇을 흡수·방출하는가 | 컨텐츠 데이터. 그 값이 **무엇인지는 Human 이 준다** (지어내지 않는다) |
| §6.2 `lifecycle` · `supply.recoveryCause` | 세계 과정 하나 = 규칙 하나 | 컨텐츠 world/simulation — Cycle 이 세운다 |
| §6.3 `carrier.type: CREATURE` 의 살아 있는 쪽 | 생물의 행동 | 3층 (§2.2) |
| §4 M8 "주변 생물의 행동" | 같은 것 | 3층 |
| §5.11 Downstream Handoff 의 *쓰임* | Recipe · 효과 · 수치 | 4층 이후 (§2.1) |
| §2.2 "플레이어 지식 상태" | 무엇을 알아냈는가 | 3층 (Discovery State) |

---

## 4. 공정 대응 — §7 의 확장은 우리 공정의 어디인가

원문 §7 은 새 Workflow 를 만들지 않는다고 못박았다. Region §4 의 대응표에 그대로 겹친다.

| §7 확장 | 이 저장소 |
|---|---|
| 1 Core Proposition 추가 질문 · 2 Cause Network · 5 Exploration Contract 확장 · 7 Growth Outcome | Play Design (`play/*.md` — advprotoi-design) |
| 3 Rule Set 추가 확인 · 4 Resource Ecology Contract | `cycles/<CycleId>/spec.md` 의 State/Rule 절 (advprotoi-cycle) |
| 6 Connector 영향 · 8 Resource Flow | `content/regions/graph.ts` + flows |
| 9 Opportunity Gradient 배치 · 10 resource/trace/presence layer | RegionSpec.space + resourceEcology → `world:compile` |
| 11 Play Observation 여섯 · 12 Revision 일곱 | Cycle 의 완료 조건 + `world:observe --report` |

---

## 5. L0 판단 기준 통과

[L0-Game.md](L0-Game.md) §4 의 네 질문.

```text
어떤 위험을 주는가            재료를 만든 것과 위험을 만든 것이 같은 Cause 다 (S1 · Concept §6).
                            깊은 자리의 Risk Opportunity 가 곧 위험 관계에 들어가는 일이다
극복할 재료를 어디에 두는가    이 문서 전체가 그 답이다 — 원천에, 흔적 뒤에, 조건 안에,
                            부산물로, 그리고 Region 을 넘는 흐름 끝에
요정이 무엇으로 자라는가       이 층은 정하지 않는다 (S10). 성장의 **입력**만 넘긴다 —
                            그것이 이 문서가 4층·7층에 하는 유일한 약속이다
Core Breath 의 어느 전이인가   관찰 → 이해 → 시도 구간. "이상한 흔적 → 추측 → 원천 → 확보"(§2.1)가
                            Breath 의 그 세 마디를 재료 쪽에서 다시 만든다
```

---

## 6. 위임된 결정

원문 §10.5 는 "없으면 임의로 채우지 않고 UNRESOLVED 로 남긴다"고 정했고, 이 문서는 처음에 다섯을 남겼다.
Human 이 그중 넷을 **"컨셉에 맞게 알아서"** 로 위임했다 — [L2-World-Region.md](L2-World-Region.md) §5 와
같은 방식이다. 첫 계약을 쓰는 Play 가 내렸고 Human 이 언제든 뒤집는다.

```text
① 재료의 이름              → RoomBearsMaterial D1 — 생체 광석 · 광식충 허물 · 거목균
② 관찰 가능한 성질          → RoomBearsMaterial D2 — 사슬이 이미 말하는 것만 옮겼다
③ 회복의 시간 규모          → RoomBearsMaterial D3 — 세계 초 · 비율 1:1.5:2:3:4
④ 채취 단위                → RoomBearsMaterial D4
⑤ 어느 Source 가 유한한가    → 첫 Region 은 쓰지 않는다 (S7). 뒤의 Region 이 정한다
```

위임의 규칙은 Region §5.5 그대로다 — 준 이름은 정식이고, 나머지는 세계를 짓는 쪽이 **그것이 무엇인지에서**
짓는다. 세계는 정식과 지어진 것을 구분하지 않는다. 남는 UNRESOLVED 는 하나 — 살아 있는 운반체의 이동(3층).

---

## 7. 다음

```text
첫 계약    [play/RoomBearsMaterial.md](play/RoomBearsMaterial.md) — 미지 M1 거대 악마의 숲에 이 계약을
          처음 쓰는 2층 넷째 Play (승인됨 · C011~C014). 그 Play 가 M3 숲의 재료 계통을 놓았다
선행       RoomBecomesLand(C005~C007)가 area·traversable·compile 을,
          RuleBoundRoom(C008~C010)이 Region State 와 세계 과정을 먼저 세운다
```
