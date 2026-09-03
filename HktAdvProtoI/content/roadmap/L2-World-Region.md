# L2 — 세계 content 구성 (기반 층 2 · 세계 절반 ②)

상태: **확정** (Human 주입 원문). 로드맵 2층 결과물의 **세계 절반 ②**다 ([README.md](README.md) §2).
① [L2-World-Concept.md](L2-World-Concept.md) 가 세계가 무엇인가를 주었고, 이 문서는 **세계가 어떻게
짜이는가** — Region 이라는 단위, Region 의 규칙, Region 사이의 연결, Region 속의 Region — 를 준다.

§1 이 원문이고, §2 이후는 원문을 도구([L2-World-Tool.md](L2-World-Tool.md))와 공정에 잇는 번역이다.
원문에 없는 세계 사실은 더하지 않았다 — 다만 Human 이 위임한 결정(§5)은 이 문서가 내렸다.

```text
이 문서가 소유한다      Region 의 정의 · Global/Region Rule 과 Rule Contract · 진입/이탈 · Nested Region ·
                      하나의 World Context · 세계 공간 모델(RegionId + Local) · Connector 모델 ·
                      Region 제작 공정 12단계 · Region Spec 양식 · 검증 기준
이 문서가 바꾼다        L2-World-Tool.md 의 "Region 하나 = 세계 하나" — 세계는 Region Graph 다 (§3)
이 문서가 소유하지 않는다  각 Region Rule 의 수치 · 지식이 진입을 여는 방식 · 발견 상태 → Play · 3층 (§4)
```

---

## 1. 원문

### World Region Architecture — 규칙을 품은 중첩 세계

#### 0. 한 문장 정의

이 세계는 하나의 거대한 연속 지형이 아니라, 각자 고유한 공간·상태·규칙·탐험 의미를 가진 Region들이 연결된 하나의 논리적 세계이며, 하나의 Region 안에서 다시 세계에 유일한 다른 Region을 발견할 수 있는 중첩 구조다.

#### 1. 문서의 목적

이 문서는 미지의 세계를 구성하는 공간 단위와 탐험 구조를 정의한다.
핵심 목적은 다음과 같다.

* 특별한 장소에서만 작동하는 세계 규칙을 지역 단위로 표현한다.
* 지역 규칙으로부터 고유한 탐험 방식과 국소적 플레이를 발생시킨다.
* Region 안에서 또 다른 Region을 발견하는 방식으로 세계의 깊이를 확장한다.
* 모든 장소를 하나의 연속된 3차원 지형으로 제작하지 않고도 하나의 일관된 오픈월드를 구성한다.
* 위험·단서·재료·성장이 하나의 인과 구조로 이어지게 한다.

이 문서에서 Region은 단순한 Terrain 구역이나 Biome이 아니다. Region은 세계를 나누는 기술적 청크가 아니라, 하나의 탐험 문제와 세계 규칙을 완결된 형태로 보유하는 설계 단위다.

#### 2. 세계의 기본 전제

플레이어는 하나의 요정을 성장시키며 미지의 세계를 탐험한다.
미지의 세계는 단순히 아직 보지 못한 넓은 지형이 아니다. 플레이어가 아직 알지 못하는 다음 요소들의 집합이다.

* 어디에 무엇이 존재하는가
* 어떤 규칙이 작동하는가
* 그 규칙은 무엇 때문에 발생하는가
* 무엇이 위험하며 어떤 조건에서 안전해지는가
* 어떤 재료와 지식이 위험을 극복하게 하는가
* 하나의 장소가 어떤 다른 장소로 이어지는가

따라서 탐험의 기본 흐름은 다음과 같다.

```text
이상 현상 발견
→ 관찰과 시도
→ 지역 규칙의 일부 파악
→ 필요한 지식·재료·능력 준비
→ 위험 돌파
→ 보상과 새로운 가능성 획득
→ 요정의 행동 가능 범위 확장
→ 더 깊은 Region 발견
```

여기서 '경험'은 두 층으로 구분한다.

* 플레이어 경험: 관찰하고, 추론하고, 선택하고, 결과를 이해하는 과정
* 요정의 성장: 지식·재료·아이템·Skill·상태 변화로 인해 실제 행동 가능성이 증가하는 결과

세계의 위험은 단순한 방해물이 아니며, 재료는 단순한 수집물이 아니다. 위험은 플레이어에게 부족한 가능성을 드러내고, 재료와 지식은 그 부족을 보완하는 수단이 된다.

#### 3. Region의 정의

Region은 다음 요소를 함께 소유하는 세계 단위다.

```text
Region = Local Space + Rule Set + World State + Exploration Meaning + World Connection
```

| 구성 요소 | 정의 |
|---|---|
| Identity | 이 장소가 세계에서 무엇이며 무엇이 특별한지 정의한다. |
| Local Space | 해당 Region 내부에서 사용하는 독립적인 3차원 공간이다. |
| World Cause | 환경·규칙·생태가 형성된 세계 내부의 원인이다. |
| Rule Set | Region 내부에서 활성화되는 규칙의 집합이다. |
| World State | 파괴, 고갈, 활성화, 발견, 점유 등 지속되는 현재 상태다. |
| Environment / Ecology | 규칙의 결과로 형성된 환경과 생태다. |
| Threat / Resource / Clue | 위험, 극복 수단, 규칙을 알아내는 단서다. |
| Exploration Structure | 플레이어가 관찰하고 선택하며 돌파하는 구조다. |
| Entry / Exit | 진입·이탈·재진입이 가능한 조건과 방식이다. |
| Connector | 다른 Region과의 실제 이동 관계다. |
| Growth Outcome | 이곳을 탐험한 뒤 새롭게 가능해지는 행동이다. |
| Child Region | 이 Region을 통해 발견되는 또 다른 완전한 Region이다. |

Region의 크기는 면적이 아니라 독립적인 탐험 의미와 상태 경계로 결정한다. 대륙 규모의 숲, 거대한 생물의 내부, 작은 상점, 한밤 동안만 존재하는 마을 모두 Region이 될 수 있다.

모든 Region이 반드시 새로운 특수 규칙을 가져야 하는 것은 아니다. 일반적인 Region은 Global Rule과 공통 환경 규칙만으로 구성될 수 있다. 다만 세계적으로 중요한 특수 Region은 최소 하나 이상의 고유한 Region Rule 또는 독립적인 탐험 구조를 가져야 한다.

#### 4. 세계 규칙의 구조

##### 4.1 Global Rule

세계 어디에서나 성립하는 기본 법칙이다.
예:

* Actor는 위치와 상태를 가진다.
* Item은 소유되거나 세계 공간에 존재한다.
* 피해는 생명 상태를 변화시킨다.
* 요정은 자신이 획득한 Skill을 사용할 수 있다.

Global Rule은 세계의 공통 문법이다. Region Rule은 Global Rule을 무시하는 임의의 예외가 아니라, 명시된 범위에서 이를 추가·변형하거나 조건부로 예외화한다.

##### 4.2 Region Rule

특정 Region의 경계 안에서만 활성화되는 규칙이다.
예:

* 침묵의 계곡에서는 소리가 일정 거리 이상 전달되지 않는다.
* 걷는 숲에서는 일정 주기마다 길의 연결이 변한다.
* 유리 사막에서는 직사광선에 노출된 대상에게 열이 축적된다.
* 빙결 심층에서는 체열을 가진 존재가 포식자에게 감지된다.
* 환상의 미로에서는 특정 행동에 따라 Connector 관계가 재편된다.

Region Rule은 다음 세 방식으로 Global Rule과 결합한다.

| 방식 | 의미 |
|---|---|
| Additive | 기존 법칙 위에 새로운 상태나 반응을 추가한다. |
| Transformative | 기존 작동 방식을 지역 안에서 변형한다. |
| Conditional Exception | 명시된 조건에서만 Global Rule의 일부를 예외화한다. |

##### 4.3 Rule Contract

모든 Region Rule은 최소한 다음 항목을 정의해야 한다.

```text
Rule
├─ Scope: 어디에서 누구에게 적용되는가
├─ Trigger: 무엇이 규칙을 활성화하는가
├─ Condition: 어떤 상태에서 성립하는가
├─ Effect: 세계의 무엇이 어떻게 변하는가
├─ Feedback: 플레이어가 결과를 어떻게 감지하는가
├─ Exploit: 이해한 플레이어가 어떻게 활용하거나 대응하는가
├─ Persistence: 결과가 얼마나 유지되는가
└─ Priority: 다른 규칙과 충돌할 때 무엇이 우선하는가
```

좋은 Region Rule은 다음 조건을 만족한다.

* 관찰 가능성: 결과가 화면, 소리, 상태 변화, 개체 행동 등으로 드러난다.
* 인과성: 플레이어가 행동과 결과의 관계를 학습할 수 있다.
* 활용 가능성: 알게 된 규칙이 선택과 대응 방법을 바꾼다.
* 경계 명확성: 규칙의 적용 범위와 종료 조건이 정의된다.
* 일관성: 같은 조건에서는 같은 원리로 작동한다.
* 조합 가능성: 다른 규칙·생태·지형과 결합하여 더 복합적인 상황을 만든다.

규칙은 수량보다 역할로 관리한다.

* Core Rule: Region의 핵심 탐험 방식을 결정한다.
* Supporting Rule: Core Rule을 관찰하고 활용할 수 있게 한다.
* Ambient Rule: 분위기와 생태적 차이를 형성한다.

하나의 Region에 많은 고유 시스템을 무작정 추가하지 않는다. 소수의 Core Rule과 재사용 가능한 Rule Primitive를 조합해 복합적인 결과를 만든다.

#### 5. Region Rule이 Gameplay를 만드는 방식

Region 고유의 플레이는 별도의 UI 미니게임으로 분리하기보다 세계 규칙의 조합에서 발생한다.
예를 들어 다음 규칙이 존재한다고 가정한다.

```text
빛이 닿지 않는 지형은 보이지 않는다.
+ 빛의 위치가 일정 주기로 이동한다.
+ 어둠 속 생물은 빛을 피해 이동한다.
```

이 규칙들은 다음 플레이를 만든다.

```text
빛의 위치 확인
→ 다음 이동 경로 관찰
→ 빛이 이동하기 전에 안전지대로 이동
→ 생물의 반응을 이용해 위험 위치 추정
→ 더 깊은 장소로 전진
```

이때 Gameplay는 규칙과 분리된 별도 모드가 아니다. 플레이어가 세계를 이해하고 활용하는 과정 자체가 해당 Region의 고유 플레이가 된다.

#### 6. 진입·이탈·재진입 구조

Region 접근 조건은 두 종류로 구분한다.

##### 6.1 Soft Requirement

진입 자체는 가능하지만 준비하지 않으면 생존하거나 전진하기 어렵다.
예:

* 극저온을 견딜 수단이 없으면 체온이 빠르게 감소한다.
* 포식자의 활동 시간을 모르면 안전한 이동 구간을 찾기 어렵다.
* 특정 재료가 없으면 독성 안개 속 체류 시간이 제한된다.

Soft Requirement는 플레이어가 실패를 통해 필요 조건을 발견할 수 있으므로 기본 방식으로 사용한다.

##### 6.2 Hard Entry Rule

Connector가 활성화되지 않거나 물리적으로 진입할 수 없는 조건이다.
예:

* 특정 문양의 순서를 알아야 석문이 열린다.
* 조수 상태가 바뀌어야 수중 통로가 드러난다.
* Region의 특정 World State가 충족되어야 균열이 형성된다.

Hard Entry Rule은 특별한 발견이나 세계 상태 전이를 표현할 때만 사용한다. 단순한 레벨 제한이나 UI 잠금으로 대체하지 않는다.

모든 Region은 진입 조건뿐 아니라 다음 사항도 정의해야 한다.

* 이탈 가능한 경로
* 실패했을 때 되돌아갈 수 있는 방법
* 재진입 시 유지되는 상태
* 일방향 이동인지 양방향 이동인지
* Connector가 비활성화됐을 때의 대체 경로

#### 7. Nested Region의 정의

Nested Region은 하나의 Region을 탐험하거나 상호작용하는 과정에서 발견되는 또 다른 완전한 Region이다.

```text
거대 악마의 숲
└─ 붉은 눈의 거목
   └─ 거목 내부 세계
      └─ 심장 호수
```

Child Region은 작은 방이나 Dungeon Room으로 제한되지 않는다. 외부 입구는 작더라도 내부에는 수 km 규모의 독립적인 오픈월드가 존재할 수 있다.

Nested Region을 이해할 때 다음 세 관계를 구분한다.

| 관계 | 의미 |
|---|---|
| Containment | 어떤 Region을 통해 발견되며 세계관상 어디에 속하는가 |
| Connectivity | 실제로 어느 Connector를 통해 이동하는가 |
| Spatial Embedding | 부모 Region의 좌표 안에 물리적으로 포함되는가 |

Child Region이라는 사실은 Containment 관계를 의미하지만, 부모 Region의 XYZ 공간 안에 실제 크기대로 포함된다는 뜻은 아니다.

따라서 작은 문 하나가 거대한 내부 세계로 이어지는 것은 공간 오류가 아니다. 그 연결이 세계의 규칙과 현상으로 설명되고 플레이어에게 일관된 관계로 인식되면 된다.

#### 8. 하나의 세계와 Region의 유일성

모든 Region은 하나의 World Context 안에서 고유한 RegionId를 가진다.

```text
Player A ─┐
Player B ─┼─→ REGION_FANTASY_MAZE
Player C ─┘
```

플레이어마다 별도의 환상의 미로가 자동 생성되는 구조가 아니다. 공간 전환 방식이 Warp처럼 보이더라도 목적지는 세계에 하나만 존재하는 장소다.

따라서 Region의 주요 World State는 공유된다.

* 파괴된 다리는 다른 플레이어에게도 파괴되어 있다.
* 고갈된 자원은 재생 규칙에 따라 회복되기 전까지 고갈 상태다.
* 사망한 고유 개체는 부활 규칙이 없다면 사라진 상태로 유지된다.
* 활성화된 Connector는 정의된 지속성에 따라 다른 플레이어에게도 영향을 준다.

다만 플레이어가 무엇을 발견했고 어떤 규칙을 알고 있는지는 개인 지식 상태로 분리할 수 있다.

```text
World State
≠
Player Discovery State
```

Region의 공간과 변화는 공유되지만, 그 의미를 얼마나 이해했는지는 플레이어마다 다를 수 있다.

#### 9. 세계 공간 모델

세계 전체를 하나의 거대한 Cartesian 좌표계로 구성하지 않는다.

```text
Logical World
├─ Global Rules
├─ Region Containment
├─ Region Connector Graph
└─ Regions
   └─ Local 3D Space
```

플레이어의 위치는 다음 두 값으로 표현한다.

```text
WorldPosition = RegionId + LocalPosition(x, y, z)
```

각 Region은 독립적인 Local Coordinate Space를 가질 수 있다.

```text
GIANT_DEMON_FOREST  → Local Space A
FANTASY_MAZE        → Local Space B
INVERTED_GARDEN     → Local Space C
```

이 공간들은 좌표상 연속되지 않아도 논리적으로 하나의 세계에 속한다. 실제 세계의 연결 관계는 글로벌 XYZ 거리가 아니라 Region Connector Graph가 정의한다.

#### 10. Connector 모델

Connector는 Region과 Region 사이의 이동 관계다.
물리적으로 연속된 길뿐 아니라 상호작용, 추락, 균열, 생물 내부 진입, 특정 현상 등도 Connector가 될 수 있다.

```text
Connector
├─ Physical
│  ├─ Road
│  ├─ Pass
│  ├─ Cave
│  ├─ River
│  └─ Bridge
└─ Transition
   ├─ Door
   ├─ Portal
   ├─ Rift
   ├─ Falling
   ├─ Climbing
   ├─ Interaction
   └─ WorldPhenomenon
```

모든 Connector는 다음 항목을 가진다.

```yaml
Connector:
  id: MAZE_GATE
  from:
    region: GIANT_DEMON_FOREST
    anchor: ANCIENT_GATE
  to:
    region: FANTASY_MAZE
    anchor: MAZE_ENTRANCE
  direction: BIDIRECTIONAL
  transition: INTERACTION
  discovery: HIDDEN_UNTIL_OBSERVED
  activation:
    knowledge: ANCIENT_GATE_PATTERN
  persistence: WORLD_SHARED
  fallback: RETURN_TO_ANCIENT_GATE
```

Region Rule은 Connector의 활성화 여부, 목적지, 방향, 연결 순서를 변화시킬 수 있다. 이 경우 Connector Graph 자체가 해당 Region의 World State가 된다.

#### 11. 미지의 세계를 만드는 방식

미지는 단순한 지리적 미발견 상태가 아니다. 다음 요소 중 하나 이상을 플레이어가 아직 이해하지 못한 상태다.

* 공간의 미지: 어디에 무엇이 있는지 모른다.
* 규칙의 미지: 어떤 조건에서 무엇이 발생하는지 모른다.
* 원인의 미지: 왜 그런 현상과 생태가 존재하는지 모른다.
* 상태의 미지: 현재 Region이 어떤 변화 단계에 있는지 모른다.
* 연결의 미지: 이 장소가 어디로 이어지는지 모른다.
* 깊이의 미지: 발견한 세계 안에 무엇이 더 존재하는지 모른다.

Nested Region은 세계를 수평 면적뿐 아니라 수직·내부·현상·규칙·재귀 방향으로 확장한다.

```text
숲
→ 거목 내부
→ 내부 호수
→ 호수에 비친 달
→ 뒤집힌 정원
→ 아직 정의되지 않은 더 깊은 Region
```

따라서 세계의 크기는 km²만으로 결정되지 않는다.
플레이어가 아직 이해하지 못한 공간·규칙·원인·연결의 수가 이 세계의 체감 규모를 결정한다.

#### 12. Region과 요정 성장의 연결

Region은 위험과 보상을 따로 배치하는 장소가 아니다. 하나의 World Cause로부터 위험·단서·재료·보상이 함께 파생되어야 한다.

```text
World Cause
├─ Region Rule
├─ Environment / Ecology
├─ Threat
├─ Clue
├─ Resource
└─ Growth Opportunity
```

Region의 기본 성장 계약은 다음과 같다.

```text
Threat
→ 현재 요정에게 부족한 가능성을 드러냄
Clue
→ 위험과 규칙의 인과를 이해하게 함
Resource / Knowledge
→ 대응 수단을 만들거나 사용할 수 있게 함
Overcome
→ 규칙을 활용하여 위험을 돌파함
Growth Outcome
→ 요정이 이전에는 할 수 없던 행동을 할 수 있게 됨
New Access
→ 더 깊거나 다른 Region에 접근 가능해짐
```

좋은 보상은 단순히 수치를 올리는 데 그치지 않는다. 다음 탐험에서 새로운 선택을 가능하게 해야 한다.
예:

* 열을 저장하는 결정 → 빙결 Region에서 체온 유지
* 공간 왜곡 결정 → 특정 Connector의 목적지 고정
* 포식자의 감각 기관 → 냄새 기반 탐지 규칙 역이용
* 지역 규칙에 대한 지식 → 이전에는 보이지 않던 진입 조건 해석

이 구조를 통해 요정의 성장은 세계와 분리된 메뉴상의 변화가 아니라, 세계를 더 깊이 탐험할 수 있는 실제 가능성의 확장이 된다.

#### 13. Region Rule과 Terrain의 관계

Terrain은 Region의 출발점이 아니라 규칙과 탐험을 플레이 가능한 공간으로 변환한 결과다.

```text
Region Identity
→ World Cause
→ Region Rule
→ Environment / Ecology
→ Exploration Problem
→ Required Spatial Relation
→ Terrain Description
→ Playable Region
```

예:

```text
Rule
물이 차오르면 일부 생물이 활성화된다.

Gameplay
수위를 관찰하고 안전한 고지대로 이동한다.

Spatial Requirement
저지대 / 고지대 / 섬 / 수로 / 탈출 경로

Terrain
분지 / 언덕 / 절벽 / 수로
```

Terrain Compiler는 Point, Curve, Area, Field, Terrain Cell, Surface, Feature 등의 재사용 가능한 구성 요소를 조합해 필요한 공간 구조를 생성한다.

Region Rule 역시 가능한 경우 재사용 가능한 Rule Primitive로 구성한다.

```text
Trigger + Condition + State Change + Feedback + Reset
```

이 원칙은 새로운 Region마다 완전히 새로운 코드와 자연 경관 자산을 요구하지 않으면서도 서로 다른 탐험 경험을 만들기 위한 기반이다.

#### 14. 공간 분리의 제작 원칙

Region을 독립적인 Local Space로 분리하는 것은 단순한 로딩 최적화가 아니다. 다음 목적을 동시에 달성하는 세계 표현 방식이다.

##### 14.1 극단적으로 다른 장소의 연결

인접 지형을 자연스럽게 이어 붙이지 않고도 평범한 숲, 무한 미로, 뒤집힌 정원, 거대한 생물 내부를 하나의 세계에 배치할 수 있다.

##### 14.2 미지감 유지

높은 곳에서 주변 Terrain 전체를 확인하더라도 Region Graph의 깊이와 숨겨진 연결 관계는 드러나지 않는다.

##### 14.3 제작 자원의 집중

광대한 빈 공간과 전이 지형을 반복 제작하는 대신, 탐험 의미가 밀집된 장소에 Terrain·Vegetation·Landmark·Creature·Interaction 자원을 집중할 수 있다.

##### 14.4 세계관적 정당화

공간 분리는 개발 편의를 감추기 위한 임의의 Warp가 되어서는 안 된다. 문, 균열, 추락, 생물 내부, 반사면, 시간 현상 등 플레이어가 이해할 수 있는 Connector와 세계 원인을 통해 표현한다.

좌표의 연속성보다 세계 관계의 일관성이 우선한다.

#### 15. Region 제작 공정

Region 제작은 다음 순서로 진행한다.

1. **Core Proposition** — 이 Region이 플레이어에게 제시하는 핵심 미지와 탐험 의미를 한 문장으로 정의한다.
2. **World Cause** — 그 장소의 환경·규칙·생태가 존재하는 세계 내부의 원인을 정의한다.
3. **Rule Set** — Core Rule, Supporting Rule, Ambient Rule을 구분하고 각 Rule Contract를 작성한다.
4. **Phenomenon / Ecology** — 규칙의 결과로 존재하는 지형 현상, 생물 행동, 자원 생성, 시간 변화를 정의한다.
5. **Exploration Contract** — Threat, Clue, Opportunity, Refuge, Reward, Discovery의 인과 관계를 구성한다.
6. **Entry / Exit / Connector** — 발견, 진입, 실패, 이탈, 재진입, 다른 Region과의 연결을 정의한다.
7. **Growth Outcome** — 플레이어가 무엇을 이해하고 요정이 무엇을 획득하며 어떤 새 가능성이 열리는지 정의한다.
8. **Topology** — Containment 관계, Connector Graph, Child Region, 동적 연결 변화를 정의한다.
9. **Spatial Requirement** — 규칙과 탐험을 성립시키는 거리, 높이, 시야, 경로, 구역 관계를 정의한다.
10. **Terrain Compilation** — 공간 요구를 Point, Curve, Area, Field, Terrain Cell과 Landmark로 변환한다.
11. **Play Observation** — 플레이어가 규칙을 관찰하고 인과를 학습하며 대응할 수 있는지 검증한다.
12. **Revision** — 규칙이 보이지 않거나, 보상이 원인과 분리되거나, 경로가 단조롭거나, 제작 비용이 과도한 부분을 수정한다.

#### 16. Region Spec

```yaml
Region:
  id: FANTASY_MAZE
  name: 환상의 미로
  coreProposition:
    관찰자의 행동에 따라 공간 연결이 변하며,
    길을 암기하는 대신 변화 규칙을 이해해야 한다.
  worldCause:
    description: >-
      미로를 이루는 공간 결정층은 내부에서 발생한 움직임과 접촉을
      압력으로 축적하고, 압력 차를 해소하는 과정에서 통로 연결을 재배열한다.
  rules:
    core:
      - RULE_MAZE_CONNECTION
    supporting:
      - RULE_STABLE_PLANT_CLUE
    ambient:
      - RULE_SPATIAL_ECHO
  state:
    connectorPattern: DEFAULT
    bridgeState: INTACT
    heartAccess: LOCKED
  entry:
    connector: MAZE_GATE
    requirement:
      knowledge: ANCIENT_GATE_PATTERN
  exit:
    default: MAZE_GATE_RETURN
    emergency: COLLAPSE_TO_ENTRY
  exploration:
    threat: 반복되는 공간과 포식 생물
    clue: 위치를 유지하는 식물과 문양
    opportunity: 행동으로 Connector를 재배열
    reward: 공간 왜곡 결정
    discovery: 미로의 심장과 뒤집힌 정원
  growthOutcome:
    knowledge: MAZE_CONNECTION_LOGIC
    material: SPATIAL_CRYSTAL
    capability: FIX_TRANSITION_DESTINATION
  topology:
    parent: GIANT_DEMON_FOREST
    children:
      - INVERTED_GARDEN
```

이 예시에서 공간 결정층은 Connector 변화, 안정된 식물 단서, 공간 왜곡 결정이라는 보상을 하나의 원인으로 묶는다. 이처럼 원인·규칙·생태·단서·보상은 함께 폐쇄되어야 하며, 어느 하나가 독립적으로 배치되어서는 안 된다.

#### 17. 검증 기준

세계 일관성

* Region의 환경·규칙·생태·보상이 같은 World Cause에서 파생되는가
* 공간 연결이 단순한 개발 편의가 아니라 세계 현상으로 납득되는가
* Global Rule과 Region Rule의 관계가 명확한가

규칙 가독성

* 규칙의 효과를 관찰할 수 있는가
* 실패 원인을 플레이어가 추적할 수 있는가
* 규칙을 이해한 뒤 실제 선택이 달라지는가
* 적용 경계와 종료 조건이 보이는가

탐험 구조

* 위험을 만나기 전에 최소한의 단서가 존재하는가
* 실패가 정보로 전환되는가
* 재료와 지식이 실제 대응 수단이 되는가
* 보상이 다음 가능성을 여는가

중첩 세계

* Child Region이 독립적인 탐험 의미를 가지는가
* Containment, Connectivity, Spatial Embedding이 혼동되지 않는가
* 진입뿐 아니라 이탈과 재진입이 정의되어 있는가
* 목적지 Region의 World State가 공유되고 지속되는가

제작 가능성

* Core Rule의 수가 통제되어 있는가
* Rule Primitive와 Terrain Component를 재사용할 수 있는가
* 넓고 빈 전이 지형보다 밀도 높은 핵심 공간에 자원을 집중하는가
* 공간 분리가 반복적인 Portal 연출에만 의존하지 않는가

#### 18. 최종 원칙

* Region은 Terrain 조각이 아니라 공간·규칙·상태·탐험을 함께 소유하는 세계 단위다.
* 특수한 Region은 고유한 Region Rule을 가질 수 있으며, 규칙은 관찰·학습·활용 가능한 형태로 작성한다.
* Region Rule은 별도 미니게임을 덧붙이는 대신 세계 안에서 고유한 플레이를 발생시킨다.
* Region의 위험·단서·재료·보상은 하나의 World Cause에서 파생되어야 한다.
* Region 안에는 다시 하나의 완전한 Region이 존재할 수 있다.
* Child Region은 부모의 좌표 안에 실제 크기대로 포함될 필요가 없다.
* 모든 Region은 하나의 World Context 안에서 고유하게 존재하며 주요 World State를 공유한다.
* 세계의 실제 구조는 하나의 글로벌 XYZ Terrain이 아니라 Region Containment와 Connector Graph가 정의한다.
* Terrain은 규칙과 탐험을 성립시키는 공간적 결과물이다.
* 요정의 성장은 세계의 규칙을 이해하고 더 깊은 Region에 접근할 수 있는 가능성의 확장으로 표현한다.
* 공간 분리는 제작상의 한계를 숨기는 장치가 아니라 미지와 다양성을 만드는 세계 문법으로 사용한다.
* 세계의 체감 크기는 지형의 넓이가 아니라 아직 이해되지 않은 공간·규칙·원인·연결의 깊이로 결정된다.

> 원문의 표 셋(구성 요소 · 결합 방식 · 중첩 관계)과 공정 12단계는 채팅에서 평문으로 왔다 — 표와 번호 목록으로만 되살렸고 글자는 그대로다.

---

## 2. 이 구성이 확정한 것

| # | 확정 | 원문 |
|---|---|---|
| **R1** | 세계는 하나의 연속 지형이 아니라 **Region Graph** 다. 연결은 XYZ 거리가 아니라 Connector Graph 가 정한다 | §0 · §9 · §18 |
| **R2** | Region = Local Space + Rule Set + World State + Exploration Meaning + World Connection. 크기는 면적이 아니라 탐험 의미와 상태 경계로 정한다 | §3 |
| **R3** | `WorldPosition = RegionId + LocalPosition`. Region 마다 독립 좌표계 | §9 |
| **R4** | Region 은 세계에 **하나뿐**이다. World State 는 공유되고, 발견 상태는 플레이어마다 다르다 | §8 |
| **R5** | Region 은 **중첩**된다. Containment ≠ Connectivity ≠ Spatial Embedding — 자식이 부모 좌표 안에 실제 크기로 들어 있을 필요가 없다 | §7 |
| **R6** | Connector 는 길만이 아니다 — 문 · 균열 · 추락 · 상호작용 · 현상도 Connector 다. 열 항목(from/to anchor · direction · transition · discovery · activation · persistence · fallback)을 가진다 | §10 |
| **R7** | Region Rule 은 Global Rule 의 예외가 아니라 명시된 범위의 추가·변형·조건부 예외다. Rule Contract 여덟 항목과 Core/Supporting/Ambient 역할 | §4 |
| **R8** | Region 의 고유 플레이는 미니게임이 아니라 규칙의 조합에서 난다 | §5 |
| **R9** | 진입은 Soft Requirement 가 기본, Hard Entry 는 발견·상태 전이에만. 모든 Region 은 이탈·실패 복귀·재진입·방향·대체 경로를 정의한다 | §6 |
| **R10** | 위험 · 단서 · 재료 · 보상은 **하나의 World Cause** 에서 함께 파생되고 함께 닫힌다 | §12 · §16 |
| **R11** | Terrain 은 출발점이 아니라 결과다 — Identity → Cause → Rule → Ecology → 탐험 문제 → 공간 요구 → Terrain | §13 |
| **R12** | 공간 분리는 제작 편의가 아니라 세계 문법이다 — 좌표의 연속보다 관계의 일관성 | §14 |
| **R13** | 방과 Connector 는 **데이터**다. 총 수에 상한이 없고 수십~수백 규모를 전제한다. 규칙 코드는 그 이름을 알지 못한다 | §2.1 (Human 주입) |

그리고 **제작 공정 12단계**(§15) · **Region Spec 양식**(§16) · **검증 기준 다섯 묶음**(§17)이 확정되었다.

### 2.1 규모 — 방도 연결도 데이터다 (R13)

Human 주입: **"문(각 방에서 다른 곳으로 가는 입구) = Connector 는 데이터이고, 수십 수백 개가 될 수 있다."**

용어부터 맞춘다. "문"은 Connector 의 **갈래 하나**(`door`)이고, *각 방에서 다른 곳으로 가는 입구*
전체를 가리키는 말은 **Connector** 다 (§10). 그 입구가 방 안 어디에 서 있는지는 `anchor` 가 정한다.
그러므로 R13 이 말하는 것은 문의 수가 아니라 **Connector 의 수**다.

```text
상한 없음   Region 도 Connector 도 content/regions 의 값이다. 세계가 커지는 것은 값이 느는 일이지
           규칙이 느는 일이 아니다 — 규칙 코드는 어떤 방도 어떤 연결도 이름으로 알지 못한다
근거       측정했다: content/world 35 파일 0 hit · engine 64 파일 0 hit
           (이름을 아는 자리는 content/regions 데이터와 content/view 의 표뿐)
```

**성능은 벽이 아니다.** 방 1000 · Connector 6000 의 합성 그래프로 잰 값 (한 방의 출구를 훑는
`exitsOf` 는 지금 전체 Connector 를 선형으로 본다):

| 규모 | `exitsOf` 1회 | 60틱 × 관찰자 4 (1초) | `checkGraph` | `reachableRegions` |
|---|---|---|---|---|
| 방 9 · Connector 18 | 0.011 ms | 2.6 ms | 0.6 ms | 0.09 ms |
| 방 200 · Connector 800 | 0.004 ms | 0.9 ms | 2.5 ms | 1.3 ms |
| 방 1000 · Connector 6000 | 0.056 ms | 13 ms | 127 ms | 50 ms |

매 틱 도는 것(`exitsOf`)은 수천 규모에서도 1초에 13 ms 다. 무거운 둘(`checkGraph` ·
`reachableRegions`)은 **도구가 부를 때만** 도는 검사이지 세계의 틱이 아니다.
그러므로 지금의 선형 순회를 인덱스로 바꾸는 것은 **아직 하지 않는다** — 요구가 오면 그때 한다.

**벽은 총 수가 아니라 셋이다.** 규모를 늘릴 때 먼저 무너지는 것은 여기다.

```text
① 한 방의 출구 수     투영은 출구마다 표식 하나와 transit 하나를 싣는다. 화면이 표식으로 덮이고,
                    지금 프롬프트는 그 중 **하나만** 말한다.
                    **여기에도 상한을 두지 않는다** (Human 확정) — 방 하나에 출구가 서른이어도
                    세계는 틀리지 않았다. 그러므로 이것은 세계가 답할 문제가 아니라
                    **표현이 받아야 할 숙제**다 (RegionGraphRooms 확정 9 · "출구가 많은 방")
② 손으로 짓는 것      방마다 RegionSpec 파일 하나 · 이름 표 한 줄 · anchor 좌표. 수백 개를 사람이
                    쓰는 것은 데이터가 아니라 노동이다. 여기서부터 도구(생성·검증)가 그 자리를 받는다.
                    이름 짓기는 §5.5 로 위임됐다
③ 보고를 사람이 읽는 것  world:observe 는 데이터를 줄줄이 다 찍는다. Connector 가 수천이면 그 표는
                    읽을 수 있는 물건이 아니다 — 요약·추리기가 필요해지는 지점이다.
                    이것은 세계의 질문이 아니라 **도구의 일**이며, 그 규모를 실제로 다루는
                    Cycle 이 받는다 (C004 는 요구가 없어 전체 출력만 만들었다)
```

셋 다 **총 수의 문제가 아니라 한 화면·한 사람이 감당하는 수의 문제**다. 세계는 얼마든지 커질 수 있고,
커지면서 좁아지는 것은 한 자리에서 한 번에 보이는 것이다. 그래서 셋 중 **어느 것도 세계에 상한을
두는 것으로 풀지 않는다** — 보는 쪽이 넓어져야 한다.

## 3. 도구에 주는 변화 — L2-World-Tool.md 의 결정 하나를 뒤집는다

도구 절반은 "1단계는 Region 하나 = 세계 하나, 다중 Region 은 기반 층의 새 행 후보"로 확정했었다.
② 는 그것을 **2층 안에서** 뒤집는다 — 세계 자체가 Region Graph 이므로 새 축이 아니라 2층의 정의다.
그리고 뒤집는 방향이 도구를 **더 단순하게** 만든다.

```text
버린다    WE §24 "Compiler 가 Region Graph 를 실제 지형 경계로 변환한다" — 이어 붙이지 않는다 (§14)
버린다    Description 의 connector op (변에 붙는 offset · width) — 경계 이음이 아니라 전이다
버린다    글로벌 XYZ · Region 간 seam · streaming 의 근거 하나 더
남는다    Region 하나 = Description 하나 = Local Space 하나. 컴파일은 Region 단위 그대로
더한다    Region Graph — Containment(parent/children) + Connector 목록. World Data 다
더한다    Description 의 point(layer: 'anchor') — Connector 가 가리키는 자리
더한다    WorldPosition 에 regionId. 관찰 결과의 scene 이 regionId 가 된다 (이미 문자열이다)
```

### 3.1 파일 — Region Spec 이 Description 을 품는다

§16 의 Region Spec 은 **의미**이고 도구의 Description 은 **공간**이다. 둘을 파일 하나에 두되
컴파일러는 `space` 만 읽는다.

```text
content/regions/<id>.ts           RegionSpec = { id · name · depth · coreProposition · worldCause ·
                                  rules(id 만) · state(초기) · entry · exit · exploration ·
                                  growthOutcome · topology · space: RegionDescription }
content/regions/graph.ts          RegionGraph = { regions: id[] · containment · connectors: Connector[] }
                                  — Connector 의 from/to.anchor 는 각 Region space 의 point(layer:'anchor')
content/regions/<id>.compiled.generated.ts   컴파일 산출 (Region 단위)
```

Connector 의 열 항목 중 도구가 아는 것은 `from · to · direction · transition` 뿐이다. `discovery ·
activation · persistence · fallback` 은 세계 규칙(Cycle)의 것이다 — 도구는 **자리를 남기고** 검사만 한다.

### 3.2 도구가 새로 검사하는 것 (§17 에서 기계가 볼 수 있는 것)

Concept §3.6 의 네 항목에 더한다.

```text
⑤ 모든 Connector 의 from/to anchor 가 그 Region 의 space 에 실제로 있는가
⑥ 모든 Child Region 에 부모로부터의 Connector 가 하나 이상 있는가 (Containment 에 Connectivity 가 따르는가)
⑦ 모든 Region 에 이탈 Connector(exit.default) 가 있는가 — 들어가면 나올 수 있는가
⑧ civil Region 에서 Connector 만으로 모든 Region 에 닿는가 (고립된 Region 이 없는가)
⑨ Region 의 core rule 수 — 보고만 한다. 몇 개가 많은지는 사람이 판단한다
```

### 3.3 도구 밖으로 가는 것

| 원문 | 무엇인가 | 어디 |
|---|---|---|
| §4 Region Rule · Rule Contract | L1 의 Natural Law 에 **scope** 가 붙은 것. 새 문법이 아니다 — 조건에 "Region R 안" 이 들어간다. Feedback = 관찰 계약, Priority = 적용 순서 | 02-world 의 작성 양식 (advprotoi-plan) — 규칙 하나가 Rule Contract 여덟 항목을 채운다 |
| §13 Rule Primitive (Trigger + Condition + State Change + Feedback + Reset) | 규칙의 재사용 부품 | 기구 추출 후보 — `engine/physics` 옆. 두 번째 Region Rule 이 생길 때 뽑는다 |
| §8 World State 공유 / Discovery State 분리 | 발견은 관찰자의 것 | 3층 (지식) |
| §6 Hard Entry 의 knowledge activation | 지식이 Connector 를 연다 | 3층 이후. 그때까지 Hard Entry 는 World State 조건만 |
| §3 Region World State (bridgeState · heartAccess …) | 세계의 저장되는 State | 컨텐츠 world/semantic — Cycle 이 Region 마다 정의 |
| §9 Local 3D Space 의 y | 지금 세계는 (x, z) 다 | 높이는 컴파일 결과의 height 로 읽는다 — position 에 y 를 더할지는 Play 가 정한다 |

## 4. 공정 대응 — §15 의 12단계는 우리 공정의 어디인가

| §15 | 이 저장소 |
|---|---|
| 1 Core Proposition · 2 World Cause · 5 Exploration Contract · 7 Growth Outcome | Play Design (`play/*.md` — advprotoi-design). Concept §17 일곱 질문과 같은 관문 |
| 3 Rule Set (Rule Contract) · 4 Phenomenon/Ecology | `01-spec` · `02-world` (advprotoi-plan) — Rule Contract 가 02-world 의 규칙 양식이 된다 |
| 6 Entry/Exit/Connector · 8 Topology | `content/regions/graph.ts` + RegionSpec 의 entry/exit/topology |
| 9 Spatial Requirement · 10 Terrain Compilation | RegionSpec.space (Description op) → `world:compile` — 도구의 자리 |
| 11 Play Observation | `05-verification` (advprotoi-build) + `world:observe` |
| 12 Revision | Cycle 반복 |

즉 §15 는 새 공정이 아니라 **기존 공정에 Region 이라는 단위를 얹은 것**이다 — 한 Region 의 첫 Cycle
이 1~10 을 지나고, 11·12 가 그 Cycle 을 닫는다.

## 5. 위임된 결정

Human 이 "알아서" · "적절하게" 로 위임한 것들이다. 이 문서가 내렸고 Human 이 언제든 뒤집는다.

### 5.1 이름 — 프로토타입 정식 명칭

원문 ①·② 와 WE 에 글자로 나온 이름은 **전부 정식**이다 (Human 답 2). WE 의 이름을 포함하는 이유:
② 가 `GIANT_DEMON_FOREST` 아래에 중첩하므로 WE §1 의 최상위 그래프가 그대로 세계의 최상위가 된다.

| id | 이름 | 종류 | 출처 |
|---|---|---|---|
| `WHITE_KING_DOMAIN` | 백왕령 | Region (문명권) | WE §1 · §32 |
| `GIANT_DEMON_FOREST` | 거대 악마의 숲 | Region | WE §3 · ② §7 · §16 |
| `RED_WASTE` | 붉은 황야 | Region | WE §1 |
| `ICE_CANYON` | 얼음 협곡 | Region | WE §1 |
| `FANTASY_MAZE` | 환상의 미로 | Region (자식: 거대 악마의 숲) | ② §16 |
| `INVERTED_GARDEN` | 뒤집힌 정원 | Region (자식: 환상의 미로) | ② §11 · §16 |
| `RED_EYE_TREE` · `TREE_INNER_WORLD` · `HEART_LAKE` | 붉은 눈의 거목 · 거목 내부 세계 · 심장 호수 | Landmark → 중첩 Region 사슬 | WE §3 · ② §7 |
| `MOON_IN_LAKE` · `MAZE_HEART` | 호수에 비친 달 · 미로의 심장 | Region (더 깊은) | ② §11 · §16 |
| `WALKING_FOREST` · `GIANT_MEADOW` · `SILENT_VALLEY` · `FROST_CANYON` · `GLASS_DESERT` · `FROST_DEPTH` | 걷는 숲 · 거인의 초원 · 침묵의 계곡 · 빙결 협곡 · 유리 사막 · 빙결 심층 | Region (그래프 자리 미정) | ① §6 · §12 · ② §4.2 |
| `SKY_WHALE` · `BLIND_HUNTER` | 천공고래 · 맹목의 사냥꾼 | 생물 | ① §9 · §11 |
| `FROST_CRYSTAL` · `SPATIAL_CRYSTAL` · `HEAT_CRYSTAL` | 빙정석 · 공간 왜곡 결정 · 열을 저장하는 결정 | 자원 | ① §6 · ② §12 · §16 |
| `WHITE_GIANT_TREE` · `ANCIENT_GATE` · `TITAN_SKELETON` | 백색 거목 · 고대 문 · 티탄 해골 | 구조/Landmark | ① §3 · ② §10 · WE §32 |
| `EXPLORER_RUIN` · `PREDATOR_NEST` · `BIO_ORE_FIELD` | 탐험대 폐허 · 포식수 둥지 · 생체 광석 지대 | POI | WE §3 |

빙결 협곡(①)과 빙결 심층(②)은 다른 이름이므로 다른 자리로 둔다 — 같은 곳이면 Human 이 합친다.

### 5.2 세계의 이름 (Human 답 1 — 위임)

**미지의 대륙** 을 정식 명칭으로 둔다. 문명권 사람들은 바깥에 이름을 붙이지 않는다 — 이름을
붙인다는 것은 이해했다는 뜻이고 아무도 바깥을 이해하지 못했다 (Concept W7 · W11). 그래서
고유명이 아니라 "미지의 대륙" 그대로가 이름이다. L0-Game.md §2 에 적었다.

### 5.3 지금 세계는 Region 이 아니다 (Human 답 6)

지금 코드의 `mining-field`(`WORLD_BOUNDS` · `SPAWN_POINTS` · `DEFAULT_NPCS` · 광맥)는 Region 이 아니라
**발판**이다. 첫 Region Cycle 이 그것을 Region Description 으로 대체한다 — 남길 것은 규칙(채광 ·
이동 · 전투)이고, 자리와 배치는 Description 이 새로 준다.

### 5.4 첫 Region 둘과 2층 Play 의 자리

2층 Play("안전권을 나서 깊이가 달라지는 것을 본다")는 depth 가 다른 두 자리가 맞닿아야 한다.

```text
WHITE_KING_DOMAIN   depth/civil     문명권. 백왕령 — 왜 안전한가(settlement/condition)는 Play 가 묻는다
GIANT_DEMON_FOREST  depth/outer     숲의 가장자리 — "평범해 보이는 거대한 숲" (Concept §4)
                    depth/wild      거목 주변 — 먹이사슬이 드러나는 안쪽 (WE §3 Identity)
Connector           FOREST_PATH     백왕령 ⇄ 거대 악마의 숲 · Physical/Road · BIDIRECTIONAL (WE §24)
```

한 Region 안에 depth 둘(outer · wild)을 두는 것은 Concept §3.2 의 "깊이는 좌표가 아니라 area 태그"
그대로다. 2층 Play 는 civil → outer 를 건너는 것으로 충분하고, outer → wild 는 다음 Cycle 의 것이다.
환상의 미로 이하의 depth(deep · abyss)는 미정 — 그 Region 의 Play 가 정한다.

### 5.5 규모가 커질 때의 이름 (Human 위임 — "알아서 짓도록 한다")

R13 이 방과 Connector 의 총 수에 상한을 없앴으므로 이름도 수백 개가 된다. Human 이 그것을 위임했다.
이 문서가 내리는 결정은 넷이고, §5 머리 규칙대로 Human 이 언제든 뒤집는다.

```text
① 준 이름은 정식이다      Human 이 문서에 글자로 준 이름은 전부 정식이다 (§5.1 그대로 · Human 답 2).
                       위임은 그 표를 흔들지 않는다 — 표에 없는 것을 채우는 권한일 뿐이다
② 나머지는 지어 넣는다     §5.1 표에 없는 방의 이름은 이 세계를 짓는 쪽이 짓는다.
                       Human 에게 이름을 물어 세계가 멈추지 않는다
③ 이름은 그 방이 무엇인지에서 나온다   L2-World-Concept "지역은 하나의 현상" 을 따른다 —
                       이름이 그 방의 현상(무엇이 있는 자리인가 · 어떤 깊이인가)을 말해야 하고,
                       번호나 좌표에서 나오지 않는다. "R217" 은 이름이 아니다
④ 정식과 지어진 것을 세계가 구분하지 않는다   화면에는 똑같이 이름 하나다.
                       규칙 코드는 어차피 어떤 이름도 알지 못한다 (R13)
```

**모든 방은 이름을 가진다.** 지금 이름 없는 방은 화면에 id 가 그대로 뜨는데(`REGION_NAMES` 의 폴백),
그것은 표현이 빠진 자리이지 "이름 없는 방" 이라는 세계 사실이 아니다.

짓는 **방식**(사람이 쓰는가 · 생성기가 만드는가 · 무엇을 재료로 삼는가)은 여기서 정하지 않는다 —
수백 개를 실제로 짓는 Play 가 그 자리에서 정한다. 위임된 것은 *권한*이지 아직 *공정*이 아니다.

## 6. 다음

```text
ENGINE 레인 A        착수 가능. §3 의 변경(connector op 제거 · anchor layer · RegionGraph 형 · 검사 ⑤~⑧)을
                     Plan §3 에 반영한 채로 세운다.
2층 Play             advprotoi-design — §5.4 의 두 Region 과 FOREST_PATH 로 Play Design 을 쓴다.
                     Region Spec 두 개(백왕령 · 거대 악마의 숲)의 1~8 은 그 Play 가 채운다 — 지어내지 않고
                     ①② 에 있는 것만으로. 없는 것은 Human 질문.
컨텐츠 층 §3          §5.1 의 이름들이 첫 미지 행 후보다. 행으로 올리는 것은 Play 가 놓을 때.
```
