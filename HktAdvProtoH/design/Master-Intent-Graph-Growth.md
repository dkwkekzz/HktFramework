# Master Intent Graph 확장 설계 — Growth Graph

## 21. 목적

Growth Graph는 다음 질문에 답한다.

Actor는 필요한 Capability를 세계 안에서 어떻게 획득하고, 조합하고, 성장시키는가?

기존 Master Graph의 중심 인과는 변경하지 않는다.

```text
Goal
  ↓
Possibility
  ↓ requires
Capability
  ↓
Frontier
  ↓
Cycle

```

Growth Graph는 이 흐름에 새로운 Stage를 추가하지 않는다.
대신 Capability를 기준으로 역방향 질문을 제공한다.

```text
Capability
    ▲
    │ acquired_from
    │
┌───┴───────────┐
│               │
Class          Item
│               │
└───────┬───────┘
        │
      Actor

```

정리하면:

```text
Master Graph
왜 이 Capability가 필요한가?

Growth Graph
이 Capability를 세계에서 어떻게 획득할 수 있는가?

```

## 22. 핵심 원칙

### 22.1 Growth는 별도 Workflow Stage가 아니다

기존 Master 실행 순서는 그대로 유지한다.

```text
WHY → OPTIONS → NEED → NEXT

```

Growth Graph는 `NEED`에서 발견된 Capability에 대해 사용 가능한 획득 경로를 Overlay하는 보조 Graph다.

```text
Goal
 ↓
Possibility
 ↓ requires
Capability
 ↓
Growth Overlay
 ├─ Class
 ├─ Item
 ├─ Actor
 └─ World Interaction

```

Growth Graph 때문에 `GROWTH`라는 새로운 Master Stage를 만들지 않는다.

### 22.2 Class와 Item은 Capability의 필요성을 만들지 않는다

다음 구조는 허용하지 않는다.

```text
BAD

심연의 버서커가 존재한다
        ↓
심연 스킬이 필요하다
        ↓
MC-ABYSS-RAGE 생성

```

Capability의 필요성은 항상 기존 Master 인과에서 나온다.

```text
GOOD

WorldState
심연에 오염됨
        ↓

Goal
심연에서 살아남는다
        ↓

Possibility
심연을 받아들여 힘으로 이용한다
        ↓ requires

MC-ABYSS-ADAPTATION
MC-ABYSS-RAGE

```

그 후 Growth Graph가 묻는다.

```text
MC-ABYSS-RAGE
       ▲
       │ acquired_from
       │
CL-ABYSS-BERSERKER

```

즉 Class는 Capability의 설계 이유가 아니다.
Class는 Capability를 획득하는 세계 내 성장 경로다.

## 23. Growth Graph의 위치

전체 구조는 다음과 같다.

```text
====================================================
                    MASTER
====================================================

World / Actor
      ↓
     Goal
      ↓
 Possibility
      ↓
 Capability
      │
      ├────────────────────────────┐
      │                            │
      ▼                            ▼
 Existing World Overlay       Growth Overlay
 IMPLEMENTED                  어떻게 얻는가?
 PARTIAL                      │
 MISSING                      ├─ Class
      │                       ├─ Item
      │                       ├─ Actor
      │                       └─ World
      ▼
 Frontier
      ↓
 Cycle


====================================================
                   RUNTIME WORLD
====================================================

Actor
 ├─ Current Class
 ├─ Owned Items
 ├─ Equipped Items
 └─ Effective Capabilities

```

Master는 성장의 의미와 획득 조건을 관리한다.
Runtime은 현재 어떤 Actor가 실제로 무엇을 소유하고 있는지를 관리한다.

## 24. Class 정의

### 24.1 Class (`CL-*`)

Class는 특정 Skill 목록을 담기 위해 존재하는 Container가 아니다.
Class는 다음 조건을 만족하는 Actor의 의미 있는 성장 상태다.

```text
World와의 상호작용
        ↓
Actor의 선택
        ↓
Capability 획득 / 변화
        ↓
의미 있는 역할 Pattern 형성
        ↓
Class

```

Class는 최소한 다음을 설명할 수 있어야 한다.

```text
1. 이 Class가 세계에서 왜 존재하는가?
2. 어떤 World / Actor / 사건과 연결되는가?
3. Actor는 어떤 과정을 통해 이 Class가 되는가?
4. 이 Class가 되었을 때 무엇을 할 수 있게 되는가?

```

### 24.2 Class의 세계 인과

Class에는 반드시 하나 이상의 `origin_trace`가 존재한다.

```text
World Cause
    ↓
Actor Situation
    ↓
Goal
    ↓
Possibility
    ↓
Capability
    ↓
Class

```

예:

```text
MW-ABYSS-CORRUPTION
심연은 생명체를 잠식한다.
        ↓

MA-PLAYER
심연에 오염된다.
        ↓

MG-SURVIVE-ABYSS
심연의 침식 속에서 살아남는다.
        ↓

MP-ACCEPT-ABYSS
심연을 제거하지 않고 받아들여 사용한다.
        ↓

MC-ABYSS-ADAPTATION
MC-ABYSS-RAGE
        ↓

CL-ABYSS-BERSERKER
심연의 버서커

```

따라서 `심연의 버서커`를 제거해도 다음 세계 요소는 그대로 존재해야 한다.

```text
심연
심연 오염
심연 생물
심연에 오염된 NPC
정화 방법
봉인 방법
심연을 받아들이는 방법

```

Class는 세계의 원인이 아니라 세계와 Actor가 상호작용한 결과다.

## 25. Class Change

Class Change는 단순 Level 조건이 아니라 Growth Graph의 Transition이다.

```text
CL-WARRIOR
     │
     ├── transitions_to ──► CL-GUARDIAN
     │
     └── transitions_to ──► CL-BERSERKER

```

Transition은 Requirement를 가질 수 있다.

```text
CL-BERSERKER
      │
      │ transitions_to
      ▼
CL-ABYSS-BERSERKER

requires:

MC-RAGE
AND
MC-ABYSS-ADAPTATION
AND
MW-ACTOR-ABYSS-CORRUPTED

```

Class Change Requirement는 다음을 참조할 수 있다.

```text
Capability
WorldState
Item / Resource
Actor Relationship
Knowledge / Belief
기존 Class

```

Class Graph는 Tree일 필요가 없다.

```text
                 CL-WARRIOR
                  /      \
                 /        \
                ▼          ▼
       CL-BERSERKER     CL-GUARDIAN
                \          /
                 \        /
                  ▼      ▼
               CL-ABYSS-KNIGHT

```

하나의 Class에 여러 진입 경로가 존재할 수 있다.

## 26. Class와 Capability

Class는 두 종류의 Capability 관계를 가진다.

```text
requires
Class가 되기 전에 Actor가 갖춰야 하는 능력

grants
Class 상태가 됨으로써 사용할 수 있게 되는 능력

```

예:

```yaml
id: CL-ABYSS-BERSERKER
type: class

semantic: >
  심연의 침식을 제거하지 않고 자신의 분노와 결합하여
  전투력으로 사용하는 전사 상태.

origin_trace:
  world_state: MW-ABYSS-CORRUPTION
  goal: MG-SURVIVE-ABYSS
  possibility: MP-ACCEPT-ABYSS

requires:
  - MC-RAGE
  - MC-GREAT-WEAPON
  - MC-ABYSS-ADAPTATION

grants:
  - MC-ABYSS-RAGE
  - MC-ABYSS-RELEASE

```

여기서:

```text
MC-RAGE
MC-GREAT-WEAPON
MC-ABYSS-ADAPTATION

```

은 심연의 버서커가 존재하기 때문에 만들어지는 것이 아니다.
각 Capability는 자신의 Goal / Possibility 경로를 가지고 있어야 한다.

## 27. Item Growth

### 27.1 Item의 역할

Item은 Actor에게 다음을 제공할 수 있다.

```text
Property
Capability
Capability Modifier
Resource
World Interaction

```

Item 역시 Capability의 존재 이유를 만들지 않는다.

```text
BAD

불의 검을 만들고 싶다
    ↓
Fire Slash Skill 생성

```


```text
GOOD

Possibility
화염에 약한 적을 불로 공격한다
        ↓
requires
MC-FIRE-ATTACK
        ↓
Growth Overlay
IT-FIRE-SWORD가 이 Capability를 제공할 수 있다

```

## 28. Item Definition과 Item Instance를 분리한다

무한한 아이템 조합을 Master Graph에 모두 생성하지 않는다.
두 층으로 나눈다.

```text
MASTER

Item Type
Item Property
Item Modifier
Capability 관계
Composition Rule


RUNTIME

실제로 생성된 Item Instance
현재 Property 조합
현재 Modifier 조합
현재 Owner
획득 Source

```

### 28.1 Item Type (`IT-*`)

아이템의 기본 의미를 정의한다.

```yaml
id: IT-LONG-SWORD
type: item_type

semantic: >
  한 손 또는 두 손으로 사용하는 긴 날의 근접 무기.

```

### 28.2 Item Property (`IP-*`)

아이템이 가지는 세계적 성질이다.

```yaml
id: IP-ABYSS
type: item_property

semantic: >
  아이템 내부에 심연 에너지가 존재한다.

```

Property는 단순 숫자 옵션이 아니다.
세계에서 의미를 가지는 속성만 Master에 둔다.

```text
Fire
Abyss
Holy
Poisoned
Living
Cursed

```

구체적인 수치는 Cycle / World Rule이 소유한다.

### 28.3 Item Modifier (`IM-*`)

Item의 행동이나 Capability를 의미 있게 변화시키는 조합 요소다.

예:

```yaml
id: IM-ABYSS-RESONANCE
type: item_modifier

requires:
  - IP-ABYSS

grants:
  - MC-ABYSS-RESONANCE

```

단순한:

```text
공격력 +13
방어력 +7

```

같은 수치는 Master Growth Graph의 Node로 만들지 않는다.

## 29. Item Instance (`II-*`)

Item Instance는 Runtime World에 실제로 존재하는 개체다.

예:

```text
II-7A31
"가론의 심연 대검"

 ├─ base ───────────► IT-GREAT-SWORD
 ├─ property ───────► IP-ABYSS
 ├─ modifier ───────► IM-ABYSS-RESONANCE
 ├─ grants ─────────► MC-ABYSS-RESONANCE
 ├─ obtained_from ──► MA-GARON
 └─ owned_by ───────► MA-PLAYER

```

`II-*`는 Master Registry의 정적 설계 Node가 아니다.
현재 World 상태에 따라 생성되고 소멸할 수 있는 Runtime Entity다.

## 30. Item 획득

Item은 세계의 Actor / Location / Event / Composition을 통해 획득된다.

```text
Actor
  │
  │ drops / gives / trades
  ▼
Item Instance

```

예:

```text
MA-GARON
검은 기사 가론
      │
      │ defeated
      ▼
II-ABYSS-HEART
      │
      ├─ property → IP-ABYSS
      └─ grants   → MC-ABYSS-ADAPTATION

```

따라서 아이템 역시 세계와 인과적으로 연결된다.

```text
심연
  ↓
가론이 심연에 잠식됨
  ↓
가론의 신체가 변화함
  ↓
Abyss Heart 생성
  ↓
Player가 가론을 쓰러뜨림
  ↓
Abyss Heart 획득

```

아이템이 Loot Table에 있기 때문에 존재하는 것이 아니라 세계 상태의 결과로 존재하도록 한다.

## 31. Item Composition

아이템 조합은 새로운 Item Instance를 만들 수 있다.

```text
II-IRON-SWORD ───────┐
                     │
                     ├─ composed_into
                     ▼
                II-ABYSS-SWORD
                     ▲
                     │
II-ABYSS-CORE ───────┘

```

새 Item Instance는 사용된 Component의 의미를 계승하거나 새로운 Property / Modifier를 얻을 수 있다.

```text
II-IRON-SWORD
   +
II-ABYSS-CORE
   ↓
II-ABYSS-SWORD

base:
  IT-LONG-SWORD

property:
  IP-ABYSS

modifier:
  IM-ABYSS-RESONANCE

grants:
  MC-ABYSS-RESONANCE

```

모든 가능한 조합 결과를 사전에 Node로 만들지 않는다.

## 32. 무한 Growth Graph

Growth Graph의 확장성은 모든 경우의 수를 미리 만드는 것으로 구현하지 않는다.
대신 Schema와 Rule은 유한하게 유지하고, 실제 World에서 사건이 발생할 때 Instance Graph가 확장된다.

```text
Definition Graph
      │
      │ Runtime Event
      ▼
새 Instance 생성
      │
      ├─ Actor와 연결
      ├─ Item Type과 연결
      ├─ Property와 연결
      ├─ Modifier와 연결
      ├─ Capability와 연결
      └─ 획득 Source와 연결

```

따라서:

```text
Graph Schema       유한
현재 Runtime Graph 유한
가능한 Growth      사실상 무한

```

으로 유지한다.

## 33. Actor Effective Capability

현재 Actor가 실제 사용할 수 있는 Capability는 여러 Source를 합성하여 계산한다.

```text
Effective Capability
=
Innate
+ Class
+ Equipped Item
+ Owned Resource
+ Temporary World Effect

```

Graph 예:

```text
                         MA-PLAYER
                             │
       ┌─────────────────────┼────────────────────┐
       │                     │                    │
     innate             active_class           equips
       │                     │                    │
       ▼                     ▼                    ▼
 MC-DODGE          CL-ABYSS-BERSERKER      II-ABYSS-SWORD
                             │                    │
                           grants               grants
                             │                    │
                             ▼                    ▼
                       MC-ABYSS-RAGE      MC-ABYSS-RESONANCE

```

결과:

```text
MA-PLAYER

Effective Capabilities
├─ MC-DODGE
├─ MC-RAGE
├─ MC-ABYSS-ADAPTATION
├─ MC-ABYSS-RAGE
└─ MC-ABYSS-RESONANCE

```

Capability 자체는 Source별로 복제하지 않는다.

```text
BAD

MC-CLASS-COUNTER
MC-ITEM-COUNTER
MC-NPC-COUNTER

```


```text
GOOD

                   MC-COUNTER
                  ▲     ▲     ▲
                  │     │     │
              Class   Item   Actor

```

## 34. Growth Possibility

필요한 Capability가 없을 경우 Growth Graph 자체가 새로운 Player Possibility를 만들 수 있다.

예:

```text
MG-DEFEAT-ANCIENT-KNIGHT
          ↓
MP-COUNTER-KNIGHT
          ↓ requires
MC-COUNTER

```

현재:

```text
MC-COUNTER
MISSING FOR ACTOR

```

Growth Graph를 조회한다.

```text
                     MC-COUNTER
                     ▲        ▲
                     │        │
                  grants    grants
                     │        │
              CL-GUARDIAN   IT-COUNTER-RUNE
                     ▲        ▲
                     │        │
                  become    acquire

```

그러면 새로운 Possibility가 만들어질 수 있다.

```text
Goal
Ancient Knight를 돌파한다

Possibility A
다른 전투법으로 상대한다.

Possibility B
Guardian이 되어 Counter를 배운다.

Possibility C
Counter Rune을 가진 Actor를 찾아 획득한다.

```

중요:

Growth Graph가 Goal을 대신하지 않는다.
Actor가 현재 Goal을 달성하기 위해 성장하는 것이 의미 있을 때만 Growth Possibility를 만든다.

## 35. Class와 Item의 교차 성장

Class와 Item은 독립된 성장 트리가 아니다.
둘은 동일한 Capability Network에 연결된다.

```text
                     MC-ABYSS-ADAPTATION
                      ▲                 ▲
                      │                 │
                    grants            grants
                      │                 │
           CL-ABYSS-INITIATE      IT-ABYSS-HEART

```

따라서 같은 Capability를 여러 방식으로 얻을 수 있다.

```text
심연을 견디는 법

A. 심연 수도자에게 배운다.
B. 심연의 심장을 장착한다.
C. 오랫동안 심연에서 살아남아 적응한다.
D. 심연의 버서커로 Class Change한다.

```

각 방법의:

```text
Gameplay
Cost
Risk
Relationship
Consequence

```

가 실제로 다르면 별도 Possibility가 될 수 있다.

## 36. 심연의 버서커 전체 예시

```text
====================================================
WORLD
====================================================

MW-ABYSS
심연이 존재한다.
        │
        ▼
MW-ABYSS-CORRUPTION
생명체가 심연에 노출되면 잠식된다.
        │
        ├───────────────┐
        ▼               ▼
    MA-GARON         MA-PLAYER
        │               │
        ▼               ▼
심연에 적응함       심연에 오염됨


====================================================
MASTER WHY
====================================================

MA-PLAYER
    ↓
MG-SURVIVE-ABYSS
심연의 침식에서 살아남는다.


====================================================
MASTER OPTIONS
====================================================

MG-SURVIVE-ABYSS

├─ MP-PURIFY-ABYSS
│    심연을 제거한다.
│
├─ MP-SEAL-ABYSS
│    심연을 봉인한다.
│
└─ MP-ACCEPT-ABYSS
     심연을 받아들이고 이용한다.


====================================================
MASTER NEED
====================================================

MP-ACCEPT-ABYSS

requires

MC-ABYSS-ADAPTATION
MC-ABYSS-CONTROL


====================================================
GROWTH OVERLAY
====================================================

MC-ABYSS-ADAPTATION

├─ learned_from ─────► MA-GARON
├─ granted_by ───────► IT-ABYSS-HEART
└─ required_by ──────► CL-ABYSS-BERSERKER


MC-RAGE
+
MC-GREAT-WEAPON
+
MC-ABYSS-ADAPTATION
        │
        ▼
CL-ABYSS-BERSERKER
        │
        ├─ grants → MC-ABYSS-RAGE
        └─ grants → MC-ABYSS-RELEASE


====================================================
ITEM ROUTE
====================================================

MA-GARON
    │ defeated
    ▼
II-GARON-ABYSS-HEART
    │
    └─ grants → MC-ABYSS-ADAPTATION


====================================================
CLASS ROUTE
====================================================

CL-BERSERKER
    │
    │ + MC-ABYSS-ADAPTATION
    │ + MW-ACTOR-ABYSS-CORRUPTED
    ▼
CL-ABYSS-BERSERKER

```

이 구조에서 `심연의 버서커`는 독립적으로 만들어진 콘텐츠가 아니다.
다음 세계 인과를 압축한 성장 상태다.

```text
심연
→ 심연 오염
→ Actor가 영향을 받음
→ 살아남아야 함
→ 심연을 받아들이는 방법을 선택
→ 심연 적응 Capability 획득
→ 기존 Berserker Capability와 결합
→ 심연의 버서커 성립

```

## 37. 신규 Node ID

기존 Master ID에 다음을 추가한다.

```text
CL-*    Class Definition
IT-*    Item Type
IP-*    Item Property
IM-*    Item Modifier

```

`II-*` Item Instance는 Runtime World ID이며 Master Registry의 정적 Node로 관리하지 않는다.

기존:

```text
MA-*    Actor
MW-*    WorldState
MG-*    Goal
MP-*    Possibility
MC-*    Capability
FR-*    Frontier

```

는 변경하지 않는다.

## 38. 주요 Edge

```text
Class

CL ──transitions_to──► CL
CL ──requires────────► MC / MW / MA Relation / Item
CL ──grants──────────► MC
CL ──originates_from─► MP / MW


Item

II ──base────────────► IT
II ──property────────► IP
II ──modifier────────► IM
II ──grants──────────► MC
II ──composed_from───► II
II ──obtained_from───► MA / World Event


Actor

MA ──active_class────► CL
MA ──owns────────────► II
MA ──equips──────────► II
MA ──has_capability──► MC

```

`has_capability`는 Source of Truth 관계라기보다 현재 Effective Capability를 조회하기 위한 Projection으로 사용한다.
실제 Source는 반드시 역추적 가능해야 한다.

```text
MA-PLAYER
  ↓ has_capability
MC-ABYSS-RAGE
  ↑ grants
CL-ABYSS-BERSERKER

```

## 39. Master ↔ Growth ↔ Cycle 책임

```text
MASTER

왜 필요한가?
어떤 Possibility가 필요한가?
어떤 Capability가 필요한가?
어떤 성장 경로가 존재하는가?


GROWTH GRAPH

그 Capability를
Class / Item / Actor / World를 통해
어떻게 획득할 수 있는가?


CYCLE

선택된 성장 또는 Capability가
실제 World에서 정확히 어떤 Rule로 작동하는가?


RUNTIME

현재 Actor가
실제로 어떤 Class / Item / Capability를 가지고 있는가?

```

Class Skill의 Damage, Cooldown, Resource Cost 등의 수치는 Cycle / World Rule이 소유한다.
Item의 실제 랜덤 수치 및 생성 값도 Runtime / World Rule이 소유한다.

## 40. 저장소 제안

기존 구조를 유지하면서 다음만 추가한다.

```text
master/
├── graph/
├── constraints/
├── growth/
│   ├── classes/
│   │   ├── CL-BERSERKER.md
│   │   └── CL-ABYSS-BERSERKER.md
│   │
│   ├── items/
│   │   ├── types/
│   │   ├── properties/
│   │   └── modifiers/
│   │
│   └── growth-graph.md
│
├── overlay.md
└── frontier.md

```

Runtime Item Instance는 `master/`에 저장하지 않는다.
Runtime World의 기존 Actor / Entity 저장 구조를 따른다.

## 41. Growth Quality Gate

Class

* Class가 세계의 어떤 요소에서 발생했는지 설명할 수 있는가?
* Class가 먼저 존재하고 Capability를 억지로 만든 것은 아닌가?
* Class Change 조건이 World / Actor 의미와 연결되는가?
* 기존 Capability를 이름만 바꾸어 복제하지 않았는가?
* Class가 제공하는 Capability가 다른 Goal에서도 재사용 가능한가?
* Class를 제거해도 원인이 되는 World 설정은 독립적으로 성립하는가?

Item

* Item이 세계 안에서 어디서 왔는지 추적 가능한가?
* Item Property가 단순 수치가 아니라 세계적 의미를 가지는가?
* Item이 기존 Capability를 불필요하게 복제하지 않는가?
* 가능한 모든 조합을 사전에 생성하고 있지 않은가?
* Runtime에서 실제 생성된 Item만 Instance로 존재하는가?
* `obtained_from` 또는 `composed_from`으로 provenance를 추적할 수 있는가?

Growth

* 필요한 Capability의 원인은 여전히 Goal / Possibility인가?
* Class / Item은 획득 경로로만 동작하는가?
* 하나의 Capability에 여러 획득 방법을 허용할 수 있는가?
* 서로 다른 획득 방법의 Cost / Risk / Gameplay 차이가 표현되는가?
* 현재 Actor의 Capability가 어떤 Source에서 왔는지 역추적 가능한가?

## 42. Anti-pattern

Class를 먼저 만들고 설정을 붙인다

```text
BAD

심연의 버서커를 만든다
→ 심연 Skill 5개를 만든다
→ 나중에 심연 지역을 만든다

```


```text
GOOD

심연이 존재한다
→ Actor가 심연에 영향을 받는다
→ 심연을 이용하는 Possibility가 생긴다
→ Capability가 필요해진다
→ Capability 조합에서 심연의 버서커가 성립한다

```

Class마다 같은 Capability를 복제한다

```text
BAD

BerserkerCounter
GuardianCounter
ItemCounter

```


```text
GOOD

MC-COUNTER
   ▲
   ├─ CL-BERSERKER
   ├─ CL-GUARDIAN
   └─ IT-COUNTER-RUNE

```

Item 조합을 모두 정적 Node로 만든다

```text
BAD

검 × 속성 × Prefix × Suffix × Skill
모든 조합을 Master에 생성

```


```text
GOOD

Item Type
+ Property
+ Modifier
+ Composition Rule

        ↓ Runtime

필요한 Item Instance만 생성

```

Growth가 Goal을 대체한다

```text
BAD

다음 Class를 얻어야 한다.
그래서 Quest를 만든다.

```


```text
GOOD

Actor가 어떤 Goal을 가진다.
        ↓
현재 Capability로 해결하기 어렵다.
        ↓
새 Capability 획득이 하나의 유효한 Possibility가 된다.
        ↓
Class / Item / Actor를 통한 성장 경로를 탐색한다.

```

## 43. 최종 정의

```text
Goal
Actor가 무엇을 원하는가?

Possibility
그 Goal을 어떤 방법으로 달성할 수 있는가?

Capability
그 방법을 가능하게 하려면 무엇을 할 수 있어야 하는가?

Growth
그 Capability를 세계에서 어떻게 획득할 수 있는가?

Class
세계와 상호작용한 Actor에게 형성되는
지속적인 성장 역할 / 상태.

Item
세계에서 생성·획득·조합되어
Actor의 Property 또는 Capability를 변화시키는 개체.

```

최종 인과는 다음과 같이 유지한다.

```text
WORLD
  ↓
ACTOR
  ↓
GOAL
  ↓
POSSIBILITY
  ↓
CAPABILITY
  ↑
  │
GROWTH ROUTES
├─ CLASS
├─ ITEM
├─ ACTOR
└─ WORLD INTERACTION

```

Class와 Item은 세계 밖에서 Skill을 공급하는 메뉴가 아니다.
세계와 Actor의 상호작용을 통해 Capability를 획득하는 서로 다른 성장 경로다.
Capability의 필요성은 Possibility가 만들고, Growth Graph는 그 Capability를 어디서 어떻게 얻을 수 있는지를 설명한다.
