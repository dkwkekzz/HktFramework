# L2 — Region Foundation: 세계 무대의 문법 (기반 층 2 · 세계 절반 ② 부속 다섯째)

상태: **확정** (Human 승인 1회 — "Human 질문 열 전부 제안대로 승인". §1 은 Human 주입 원문 · §2 이후는 번역. Play [play/RoomRemembersAndOffers.md](play/RoomRemembersAndOffers.md)
와 한 번에 승인됐다 — Time · Access 의 선례). [L2-World-Region.md](L2-World-Region.md) 의 **다섯째 확장 계약**이다 —
새로운 설계 층도, 별도 Gameplay 시스템도 만들지 않는다.

앞선 부속 넷은 각각 **축 하나**를 더했다 — 재료 · 시간 · 생명 · 접근. 이 문서는 축을 더하지 않는다. 그 넷과 ② 자체가
**어느 자리에 서 있는가**를 여덟 자리로 이름 짓고(§3.1), 어느 계약도 소유하지 않던 셋을 더한다 — **조건의 한 형** ·
**기억**(방이 자기에게 일어난 일을 센 것 — 무엇이 그것을 지우는가까지) · **기회**(방이 내미는 것 = 데이터 · 때가 있는 기회 = Event). L1 이 세계의 문법(존재 · 상태 · 주체 · 법칙 · 시간)이었듯
이것은 **무대의 문법**이다 — 2층이 세운 것을 한 표에 놓고, 새 플레이가 올 때 기반이 늘지 않게 하는 경계(§14)를 준다.

```text
이 문서가 소유한다      Region 의 여덟 자리(Space · Contents · State · Rules · Processes · Observation · Relations · Persistence)와
                      앞선 계약의 대응 · Opportunity 의 정의와 공통 구조 · Event = 시간 있는 Opportunity · Condition 의 한 형 ·
                      Mutation 의 World Operation 표 · Persistence 의 다섯 수명과 History · Yield 표 · 설계 경계 일곱 질문 ·
                      최소 완성 기준 25 의 대조
이 문서가 바꾼다        Tool-Scale §2 의 등급 판정에 **결정 나무**(§14)가 생긴다 · T2 의 열두 답에 열셋째("무엇을 할 수 있고 무엇을
                      기억하는가")가 는다 · 흩어진 조건 자리 넷(CONNECTOR_ACTIVATIONS · phases.connectorActivation · Lock.requires ·
                      occurrence.seasons/dayPhases)이 **한 형으로 읽힌다** · "캔 횟수" 가 되돌아오면 0 으로 지워지던 것이 방의 **기억**으로 남는다
이 문서가 소유하지 않는다  Player Knowledge 와 발견 상태 다섯(3층) · Actor 의 행동과 NPC(3층) · 전투(5층) · 제작 · 경제 · 세력 · 협동 ·
                      구조 · 미니게임 · 서사(4층 이후 · 컨텐츠 행) · 확률(L1 §3 — 5층 이후의 첫 숙제) · 원문 §2.3 의 Property 이름들
                      (예시 어휘 — 이 세계의 사실이 아니다 · §2 ③)
```

---

## 1. 원문 (Human)

> `@HktAdvProtoI/content/roadmap/README.md` 아래 내용을 반영하여 세계 무대 기획을 고도화한다. 현재 상태를 파악하고 연결 및 강화하여
> /advprotoi-design 로 작업한다.

주입물은 아래 전문이다. 글자는 그대로이고 제목 수준만 이 문서 안에 들어가도록 낮췄다.

### Region Foundation R1 — 지역 세계 문법과 플레이 가능성

#### 0. Region의 정의
`Region`은 콘텐츠 묶음도, 이벤트 컨테이너도 아니다.
> **Region은 세계의 일정 범위를 소유하며, 그 범위 안에서 무엇이 존재하고, 어떤 상태이며, 어떤 법칙이 적용되고, 무엇이 변화하며, 플레이어가 무엇을 발견하고 행할 수 있는지를 정의하는 Local World Context다.**
따라서 Region 자체는 다음 질문에 답해야 한다.
```text
어디인가?             → Space
무엇이 존재하는가?    → Contents
현재 어떤 상태인가?   → State
무엇이 가능한가?      → Rules
무엇이 스스로 변하는가? → Processes
무엇을 알 수 있는가?  → Observation
다른 세계와 어떻게 이어지는가? → Relations
무엇을 기억하는가?    → Persistence
```
그리고 이 기반으로부터 플레이어의 행동 가능성이 만들어진다.
```text
Region Foundation
        ↓
Opportunity
        ↓
Player Action
        ↓
Outcome
        ↓
World / Player Change
```
---
#### 1. 전체 구조
Region은 세 층으로 나눈다.
```text
┌─────────────────────────────────────────────┐
│ 1. WORLD FOUNDATION                         │
│                                             │
│ Space · Contents · State · Rules            │
│ Processes · Observation · Relations         │
│ Persistence                                 │
├─────────────────────────────────────────────┤
│ 2. OPPORTUNITY                              │
│                                             │
│ 탐험 · 채집 · 성장 · 전투 · NPC · 퍼즐      │
│ 제작 · 발견 · 거래 · 점령 · 협동 · 기타      │
├─────────────────────────────────────────────┤
│ 3. RUNTIME                                  │
│                                             │
│ Read → Evaluate → Mutate → Propagate        │
│                    ↓                        │
│                 Persist                     │
└─────────────────────────────────────────────┘
```
중요한 원칙:
> **전투, 채집, 퍼즐, NPC 조우를 Region의 기반 기능으로 각각 구현하지 않는다.**
이것들은 Region의 기반 요소를 조합하여 만들어지는 **Opportunity**다.
따라서 새로운 플레이 종류가 추가되어도 Region 기반 구조가 계속 확장되지 않는다.
---
#### 2. Region Foundation — 8개 구성 요소
##### 2.1 Space — 지역의 공간 구조
###### 정의
Region이 세계에서 차지하는 공간과 내부 구조.
###### 구성
```text
Region Boundary
Area
Anchor
Connector
Nested Region
Spatial Relation
Navigation Surface
```
###### 세부 기능
| 요소                 | 의미                              |
| ------------------ | ------------------------------- |
| Boundary           | Region의 적용 범위                   |
| Area               | Region 내부의 부분 공간                |
| Anchor             | 의미가 붙는 특정 위치                    |
| Connector          | 다른 Area/Region으로 이어지는 연결        |
| Nested Region      | Region 내부에서 접근 가능한 독립 공간        |
| Spatial Relation   | 위/아래, 인접, 포함, 거리 등              |
| Navigation Surface | 걸을 수 있음, 날 수 있음, 수영 가능 등 이동 가능성 |
###### 지원해야 할 판정
```text
inside
outside
enter
exit
distance
height
direction
adjacent
contains
connected
lineOfSight
occupancy
density
```
###### 이것으로 만들어지는 플레이
* 길 찾기
* 탐험
* 숨겨진 장소 발견
* 절벽/수중/공중 이동
* 미로
* 플랫폼 퍼즐
* 매복
* 점령
* 추적
* 특정 위치 방어
* 숨겨진 Region 진입
---
#### 2.2 Contents — 지역에 존재하는 것
###### 정의
Region 안에서 실제로 세계의 일부로 존재하는 개체들.
###### 큰 분류
```text
Actor
Resource
Object
Structure
Hazard
Phenomenon
Trace
```
###### Actor
```text
Monster
Animal
NPC
Merchant
Faction Member
Boss
Neutral Creature
Summoned Entity
```
###### Resource
```text
광물
식물
생물 재료
물
기체
마력
유물
특수 현상에서 얻는 물질
```
###### Object
```text
상자
문
레버
석상
책
잔해
장치
함정
운반물
설치물
```
###### Structure
```text
마을
캠프
둥지
성
다리
제단
탑
광산
폐허
```
###### Hazard
```text
독
불
낙석
가시
용암
심연
폭풍
포식 영역
```
###### Phenomenon
물체나 Actor가 아니지만 지역에 존재하는 세계 현상.
```text
안개
마력장
중력 이상
공간 왜곡
독성 구름
빛의 흐름
소리를 먹는 영역
```
###### Trace
이미 일어난 세계 변화가 남긴 흔적.
```text
발자국
혈흔
부러진 나무
시체
냄새
배설물
잔류 마력
전투 흔적
채굴 흔적
```
`Trace`는 우리 게임에서 특히 중요하다.
세계에 대한 **추적과 추론**을 가능하게 하기 때문이다.
---
#### 2.3 State — 현재 지역이 어떠한가
Contents가 **무엇이 있는지**라면 State는 **현재 어떤 상태인지**다.
Region은 확장 가능한 `Property` 집합을 가진다.
```text
RegionState
    environment.*
    ecology.*
    resource.*
    danger.*
    society.*
    control.*
    structure.*
    anomaly.*
```
고정된 필드가 아니라 세계 전체에서 공유하는 Property Vocabulary를 사용한다.
##### Environment
```text
temperature
humidity
light
wind
rain
snow
fog
waterLevel
toxicity
manaDensity
```
##### Ecology
```text
predatorPopulation
preyPopulation
vegetation
disease
migrationPressure
birthRate
deathRate
```
##### Resource
```text
oreDensity
herbDensity
resourceQuality
depletion
regeneration
rarity
```
##### Danger
```text
threat
alert
corruption
instability
hostility
disasterRisk
```
##### Society
```text
population
prosperity
hunger
tradeDemand
security
```
##### Control
```text
ownerFaction
influence
contested
occupation
```
##### Structure
```text
bridgeIntegrity
villageCondition
gateState
shrinePower
```
##### Anomaly
프로젝트의 미지의 세계를 위한 중요한 상태군.
```text
spatialInstability
worldPressure
mutation
curse
unknownEnergy
```
Region마다 필요한 Property만 가진다.
---
#### 2.4 Rules — 지역에서 세계가 작동하는 방식
###### 정의
State가 사실이라면 Rule은 **그 사실들이 어떤 결과를 만드는가**다.
Rule은 네 종류로 나눈다.
##### A. Constraint
가능/불가능을 정한다.
```text
이 Area에서는 비행할 수 없다.
독 안에서는 일반 식물이 생존할 수 없다.
밤에만 Connector를 통과할 수 있다.
```
##### B. Modifier
기존 세계 법칙의 값을 변경한다.
```text
이곳에서는 화염 피해가 증가한다.
물속 이동 속도가 감소한다.
회복 효과가 약화된다.
```
##### C. Reaction
어떤 사실이나 행동에 세계가 반응한다.
```text
IF 큰 소음 발생
THEN 포식자 접근
```
##### D. Transformation
세계의 존재나 상태가 다른 것으로 변한다.
```text
독 안개 + 특정 꽃
→ 독 결정 생성
```
따라서:
> **지역 Rule은 전투 규칙만 의미하지 않는다.**
이동, 채집, 성장, 환경, 생태, 제작, 퍼즐 등 모든 세계 상호작용에 적용된다.
---
#### 2.5 Processes — 플레이어가 없어도 진행되는 변화
Rule은 원인과 결과의 관계다.
Process는 그 Rule을 사용하여 **시간에 따라 실제 세계를 변화시키는 것**이다.
##### 환경 Process
```text
낮 ↔ 밤
비
폭풍 이동
수위 변화
계절 변화
```
##### 생태 Process
```text
번식
사망
포식
이동
이주
영역 확장
질병
```
##### Resource Process
```text
생성
성장
숙성
고갈
재생
변이
품질 상승
```
Albion의 오픈월드 몬스터가 방치될수록 성장하여 더 강하고 가치 있는 개체가 되는 사례처럼, 콘텐츠 자체가 시간에 따라 달라질 수도 있다.
##### NPC Process
```text
이동
노동
휴식
거래
사냥
탐색
도망
집결
```
##### 사회 Process
```text
마을 성장
세력 확장
교역
전쟁
치안 악화
거점 건설
```
##### 위험 Process
```text
오염 확산
포식자 증가
화재 확산
마력 폭주
공간 붕괴
```
##### Region 자체 성장
Region 역시 고정되어 있지 않아도 된다.
```text
작은 둥지
→ 성숙한 군락
→ 거대 군락
→ 주변 Region 침식
```
또는
```text
폐허
→ NPC 정착
→ 캠프
→ 마을
→ 요새
```
즉 **Region 자체에도 성장·쇠퇴·변이가 존재할 수 있다.**
---
#### 2.6 Observation — 플레이어가 세계를 어떻게 아는가
세계에 존재한다고 해서 플레이어가 바로 알아서는 안 된다.
```text
World Truth
    ↓
Observable Signal
    ↓
Player Observation
    ↓
Player Knowledge
```
##### 관찰 수단
```text
시각
소리
냄새
흔적
NPC 정보
지도
도구
요정 능력
아이템
직접 실험
```
##### 발견 상태
```text
UNKNOWN
SUSPECTED
DISCOVERED
UNDERSTOOD
MASTERED
```
예:
```text
WORLD TRUTH
"붉은 안개는 출혈한 생물을 추적하는 포식자를 끌어들인다."
```
처음에는:
```text
UNKNOWN
```
플레이어는
```text
출혈
→ 붉은 안개
→ 이상한 울음소리
→ 포식자 등장
```
만 경험한다.
이후 지식을 얻어 법칙을 이해한다.
이 때문에 **지역의 법칙 자체가 탐험 콘텐츠**가 된다.
---
#### 2.7 Relations — 다른 세계와의 관계
Region은 독립된 섬이 아니다.
##### 공간 관계
```text
adjacent
connected
contains
containedBy
```
##### 환경 관계
```text
upstream
downstream
windward
weatherPath
```
##### 생태 관계
```text
migrationRoute
feedingGround
breedingGround
```
##### 사회 관계
```text
tradeRoute
territory
enemyTerritory
supplyRoute
```
##### 사건 관계
```text
fireSpreadsTo
invasionTargets
eventUnlocks
resourceFlowsTo
```
이를 통해:
```text
Region A 포식자 증가
        ↓
Region B 초식동물 이주
        ↓
Region C 식생 감소
        ↓
Region C 희귀 곤충 증가
```
같은 세계 연쇄가 가능해진다.
Albion의 Roads처럼 Region 연결 자체가 불안정하고 변화하는 세계도 동일한 Connector/Relation 구조에서 표현할 수 있다.
---
#### 2.8 Persistence — 지역이 무엇을 기억하는가
모든 변화가 같은 기간 유지되는 것은 아니다.
```text
TRANSIENT
SESSION
TEMPORARY
WORLD
PERSISTENT
```
그리고 History를 가질 수 있다.
```text
lastBossDeath
lastRain
timesHarvested
totalDeaths
previousOwner
previousEvents
lastMigration
```
History 역시 Condition으로 사용할 수 있다.
예:
```text
IF
    greatDemonKilled >= 3
AND
    daysSinceLastKill < 7
THEN
    demonSpecies adapts
```
즉 **과거의 플레이가 미래의 지역 조건이 된다.**
---
#### 3. Runtime — Region이 가지는 실제 능력
이제 이전 문서의 `Observe / Judge / Act`를 정확한 위치에 놓는다.
이것들은 Region 구성 요소가 아니라 **Region Runtime이 위의 구성 요소를 처리하는 방법**이다.
##### 3.1 Read
Region Foundation의 사실을 읽는다.
```text
State
Contents
Space
Rules
Processes
History
Relations
Player
World
```
---
##### 3.2 Evaluate
읽은 사실에 Condition을 적용한다.
---
##### 3.3 Mutate
판정 결과로 세계를 변경한다.
---
##### 3.4 Propagate
변화를 다른 Region이나 World로 전달한다.
---
##### 3.5 Persist
변경된 사실을 적절한 수명 동안 저장한다.
따라서 정확한 실행 구조는:
```text
                 REGION FOUNDATION
 Space ──────┐
 Contents ───┤
 State ──────┤
 Rules ──────┤
 Processes ──┼── Read
 Observation ┤      ↓
 Relations ──┤   Evaluate
 History ────┘      ↓
                 Mutate
                    ↓
              ┌─────┴─────┐
           Persist      Propagate
```
이제 구성 요소와 핵심 능력이 직접 연결된다.
---
#### 4. Condition — 세계의 모든 조건을 표현하는 방법
수백 종류의 Condition Type을 만드는 방식으로 가면 안 된다.
Condition을 **“어떤 사실을 어떤 방법으로 검사하는가”**로 만든다.
기본 형태:
```text
Condition =
    Target
    + Property / Query
    + Operator
    + Value
    + Qualifier
```
---
##### 4.1 Target
무엇을 보는가.
```text
World
Region
Area
Anchor
Connector
Actor
NPC
Monster
Resource
Object
Structure
Phenomenon
Player
Party
Faction
Process
Opportunity
History
```
---
##### 4.2 Query
어떤 사실을 읽는가.
```text
property
exists
count
distance
contains
state
capability
knowledge
relation
history
```
---
##### 4.3 Operator
```text
==
!=
>
>=
<
<=
IN
CONTAINS
EXISTS
NOT_EXISTS
```
집합에는:
```text
ANY
ALL
NONE
COUNT
PERCENT
```
---
##### 4.4 시간 조건
```text
FOR
SINCE
WITHIN
BEFORE
AFTER
EVERY
BETWEEN
```
---
##### 4.5 변화 조건
현재 값만 보는 것이 아니라 변화도 본다.
```text
BECAME
CHANGED
INCREASED
DECREASED
CROSSED
```
예:
```text
threat CROSSED 80
```
---
##### 4.6 행동 조건
Player/NPC가 행한 것도 World Fact다.
```text
killed
gathered
interacted
used
crafted
entered
left
damaged
healed
talked
traded
moved
observed
```
---
##### 4.7 확률
불확실한 세계를 위해 별도의 조건으로 지원한다.
```text
CHANCE
WEIGHTED_SELECT
SEEDED_RANDOM
```
중요한 점은 **전투 명중률 같은 임의 판정과 세계 콘텐츠의 불확실성을 분리**한다는 것이다.
---
#### 5. Mutation — Condition 결과로 세계에 가능한 변화
역시 콘텐츠 종류별 Effect를 만들지 않는다.
모든 결과는 몇 가지 World Operation으로 환원한다.
##### Property
```text
SET
ADD
SUBTRACT
MULTIPLY
CLAMP
```
##### Entity
```text
CREATE
REMOVE
MOVE
TRANSFORM
CHANGE_STATE
```
##### Relation
```text
CONNECT
DISCONNECT
REDIRECT
ADD_RELATION
REMOVE_RELATION
```
##### Rule
```text
ENABLE
DISABLE
ADD
REMOVE
MODIFY
```
##### Process
```text
START
STOP
PAUSE
ADVANCE
RESET
```
##### Opportunity
```text
REVEAL
OPEN
CLOSE
START
COMPLETE
FAIL
TRANSFORM
```
##### Knowledge
```text
REVEAL
HIDE
REFINE
CONFIRM
```
##### Ownership
```text
GRANT
REMOVE
TRANSFER
```
여기서 Ownership은 단순 아이템만이 아니다.
```text
Item
Material
Knowledge
Currency
Reputation
Access
Capability
```
모두 가능하다.
---
#### 6. Opportunity — Region에서 플레이어가 할 수 있는 것
여기가 이전 문서에서 가장 부족했던 부분이다.
`Opportunity`는 다음과 같이 정의한다.
> **Region 안에서 플레이어가 발견하고 선택하여 개입할 수 있으며, 그 결과 플레이어나 세계에 의미 있는 변화가 발생하는 가능성.**
현존 MMORPG들도 실제 지역을 전투만으로 채우지 않는다. GW2 Zone에는 탐색 지점, 이동 해금, Hero Challenge, Jumping Puzzle, 미니던전, Dynamic Event 등이 함께 존재하며 Dynamic Event 자체도 전투일 필요가 없다. FFXIV 역시 지역별 사냥뿐 아니라 채집·낚시·관광 기록 등을 별도 진행 요소로 사용한다.
우리 Region은 최소 다음 활동군을 표현할 수 있어야 한다.
---
#### 7. 지역 플레이의 전체 활동군
##### 7.1 탐험 / 발견
플레이어가 **세계에 무엇이 있는지 알아내는 활동**.
###### 구체 활동
```text
새 Area 발견
숨겨진 길 발견
랜드마크 발견
동굴 발견
Nested Region 발견
비밀 방 발견
미지 생물 발견
미지 Resource 발견
환경 현상 발견
지도 작성
길 기록
위험 지역 기록
```
###### 기반 요소
```text
Space
Contents
Observation
Relations
```
###### 주요 결과
```text
Knowledge
Access
Map
New Opportunity
Material Source 발견
```
---
#### 7.2 이동 / Traversal
목적지까지 가는 것 자체가 플레이.
```text
등반
활강
비행
수영
잠수
점프
밧줄
탈것
벽 통과
포탈
공간 왜곡 이용
```
환경과 결합하면:
```text
폭풍 이용 활강
강물 이용 이동
거대 생물을 타고 이동
밤에만 나타나는 다리
```
###### 기반
```text
Space
Rules
State
Capability
```
---
#### 7.3 자원 탐색 / 채집
성장의 가장 중요한 원천 중 하나.
```text
광석
식물
목재
물
결정
마력
생물 기관
알
독
포자
유물
```
단순 Node 클릭에 한정하지 않는다.
###### 획득 방법
```text
채취
채광
사냥
해체
추출
포획
정제
기다려 숙성
환경 반응 유도
NPC 교환
퍼즐 해결
```
Albion도 동적 Resource Hotspot과 Resource Treasure를 지역의 탐험·경쟁 요소로 사용한다.
###### 기반
```text
Contents
State
Rules
Processes
```
---
#### 7.4 전투 / 사냥
전투도 Opportunity 중 하나다.
```text
일반 사냥
희귀 개체
Elite
Boss
매복
추적 사냥
방어
호위
Territory 전투
세력전
PvP
PvPvE
환경 이용 전투
퍼즐 전투
생태 개입 전투
```
###### 기반
```text
Actor
Space
Rules
State
Processes
```
---
#### 7.5 Character Growth — 플레이어 자체 성장
Region은 아이템만 주는 장소가 아니다.
지역 경험 그 자체가 캐릭터 성장이 될 수 있어야 한다.
##### 성장 결과
```text
Class Progress
Class Change Requirement
Skill 습득
Skill 숙련
Capability 획득
Knowledge 습득
Affinity 성장
NPC 관계 성장
Faction Reputation
전투 숙련
탐험 숙련
채집 숙련
```
###### 예
```text
절벽 지대에서 장기간 비행
→ 공중 이동 숙련 상승
```
```text
독 환경을 조사하고 생존
→ 독 환경 지식 획득
```
```text
고대 정령과 여러 차례 조우
→ 특정 Class Change 조건 충족
```
즉:
> **지역은 성장 재료뿐 아니라 성장 경험도 제공한다.**
---
#### 7.6 제작 / 변환
지역의 환경 자체를 제작 도구로 사용할 수 있다.
```text
제작
정제
조합
요리
연금
마력 부여
아이템 성장
수리
분해
```
그리고:
```text
용암에서만 정제 가능
폭풍 속에서 충전
특정 생물 내부에서 숙성
월광 아래에서 변이
```
같은 **지역 의존 제작**도 가능하다.
---
#### 7.7 NPC 조우 / 사회적 상호작용
NPC는 Quest 버튼이 아니다.
###### 조우
```text
우연히 만남
찾아감
구조
추적
매복당함
동행
```
###### 상호작용
```text
대화
정보 획득
거래
흥정
고용
의뢰
설득
협박
도움
치료
선물
도둑질
전투
```
###### 관계 변화
```text
Affinity
Trust
Fear
Hostility
Reputation
Debt
```
###### 결과
```text
지식
재료
아이템
동료
새 Connector
새로운 Opportunity
세력 변화
```
---
#### 7.8 Puzzle / Problem Solving
퍼즐을 별도 미니게임 엔진으로만 생각하지 않는다.
> **World State를 이해하고 원하는 State로 바꾸는 활동**
이다.
###### 공간 퍼즐
```text
길 찾기
미로
높이
배치
순서
```
###### Object 퍼즐
```text
레버
문
석상
장치
```
###### Environment 퍼즐
```text
물
빛
바람
불
소리
중력
```
###### 생태 퍼즐
```text
특정 생물 유인
포식자 회피
식물 성장
```
###### 지식 퍼즐
```text
흔적 추론
언어 해독
패턴 관찰
약점 발견
```
###### 조합 퍼즐
```text
아이템
Skill
Class
NPC
환경
```
이 구조는 우리 프로젝트의 **조합의 재미**와 직접 연결된다.
---
#### 7.9 Investigation / Knowledge
탐험과 별도로 **이해하는 행위**를 하나의 플레이 축으로 둔다.
```text
흔적 조사
시체 조사
생물 관찰
환경 실험
NPC 증언
문헌 발견
반복 관찰
```
결과:
```text
World Fact 발견
Weakness 발견
Resource 획득법 발견
Rule 발견
Hidden Region 발견
Recipe 발견
Class Change 조건 발견
```
---
#### 7.10 Tracking / Hunting
우리 게임과 특히 잘 맞는 별도 활동군.
```text
발자국
냄새
마력 흔적
배설물
부러진 식생
피
소리
먹이 흔적
```
을 연결하여 대상을 추적한다.
Albion도 오픈월드에서 Tracking을 독립적인 콘텐츠 축으로 확장하고 있다.
추적의 결과는 꼭 전투일 필요가 없다.
```text
희귀 생물 발견
NPC 발견
숨겨진 지역
Resource Source
생태 현상
```
---
#### 7.11 구조물 / 세계 변경
플레이어가 지역에 직접 개입한다.
```text
건설
수리
파괴
활성화
봉인
정화
오염
다리 설치
캠프 건설
Beacon 설치
Portal 안정화
```
결과적으로 Region 자체의 기능이 바뀔 수 있다.
---
#### 7.12 경제 / 거래
```text
구매
판매
교환
운반
납품
가격 차익
희귀 자원 거래
```
Region State가 경제에 영향을 준다.
```text
약초 부족
→ 약값 증가
광산 발견
→ 광물 공급 증가
Connector 폐쇄
→ 공급 감소
```
---
#### 7.13 세력 / 영토
```text
지원
방해
점령
방어
침투
정찰
보급
파괴
```
Region State:
```text
owner
influence
security
supply
```
가 변한다.
---
#### 7.14 협동 / 경쟁
MMORPG이므로 다른 플레이어도 세계 조건이다.
```text
공동 탐험
공동 사냥
공동 채집
공동 Puzzle
지역 방어
대규모 Event
자원 경쟁
사냥 경쟁
PvP
Territory 경쟁
```
---
#### 7.15 구조 / 구조 요청 / Escort
```text
길 잃은 NPC 발견
부상자 구조
포획 생물 해방
운반
호위
치료
피난
```
전투가 없어도 완전한 Region Event가 된다.
GW2 Dynamic Event에도 수집, 구조, 보호, 건설, 조사, NPC 지원 등 비전투 목적이 명시적으로 존재한다.
---
#### 7.16 Mini Game / Local Game Rule
Region이 일시적으로 다른 플레이 규칙을 제공할 수도 있다.
```text
경주
낚시 대회
사냥 대회
숨바꼭질
보물 찾기
카드
도박
스포츠
```
핵심은 별도 세계를 만드는 것이 아니라:
```text
Temporary RuleSet
+
Opportunity
```
로 표현하는 것이다.
---
#### 7.17 Narrative / World Story
스토리 역시 Region의 세계 상태 변화와 연결한다.
```text
NPC 등장
↓
사건
↓
Region State 변화
↓
새 NPC 이동
↓
새로운 장소 개방
↓
새로운 Knowledge
```
고정 Quest Line일 수도 있고 동적 사건일 수도 있다.
---
#### 8. Opportunity의 공통 구조
위의 17가지 활동마다 시스템을 따로 만들면 안 된다.
모든 Opportunity는 동일한 구조를 사용한다.
```text
Opportunity
    availability
    discovery
    participants
    target
    possibleActions
    rules
    progress
    outcomes
```
##### availability
언제 존재하는가.
```text
Condition
```
##### discovery
어떻게 알게 되는가.
```text
VISIBLE
SIGNAL
NPC
TRACE
KNOWLEDGE
HIDDEN
```
##### target
무엇에 개입하는가.
```text
Actor
Resource
Object
Area
Phenomenon
Process
```
##### possibleActions
플레이어가 무엇을 할 수 있는가.
```text
move
observe
interact
attack
gather
use
carry
craft
talk
protect
...
```
##### progress
필요한 경우 진행 상태.
```text
State
Counter
Objective
Phase
```
##### outcomes
```text
World Mutation
+
Player Yield
```
---
#### 9. 성장 보상의 통합
Region이 제공하는 가치도 통일한다.
단순 `Reward Item`이 아니다.
```text
Yield
```
의 종류:
| Yield           | 의미              |
| --------------- | --------------- |
| Material        | 성장/제작 재료        |
| Item            | 장비·소비·특수 물건     |
| Currency        | 교환 가치           |
| Knowledge       | 세계에 대한 이해       |
| Recipe          | 새로운 조합 가능성      |
| Skill           | 새로운 행동          |
| Capability      | 새로운 세계 상호작용 능력  |
| Class Progress  | Class Change 성장 |
| Mastery         | 특정 행위 숙련        |
| Relationship    | NPC 관계          |
| Reputation      | 세력 관계           |
| Access          | 지역/Connector 접근 |
| Discovery       | 지도/생물/자원 기록     |
| World Influence | 세계를 변화시킬 권한/영향  |
따라서 지역 플레이 루프는:
```text
발견
 ↓
선택
 ↓
행동
 ↓
세계 반응
 ↓
Material / Knowledge / Capability / Growth
 ↓
새로운 조합
 ↓
이전에는 불가능했던 Opportunity 가능
 ↓
더 깊은 탐험
```
이 된다.
---
#### 10. Event는 Opportunity의 특수형이다
이제 `Event`를 Region 최상위 개념으로 보지 않는다.
> **Event = 시간과 진행 상태를 가지는 Opportunity**
이다.
전투 Event:
```text
몬스터 침공
```
채집 Event:
```text
희귀 꽃 대량 개화
```
탐험 Event:
```text
폭풍 동안만 숨겨진 섬 등장
```
NPC Event:
```text
이동 상단 방문
```
Puzzle Event:
```text
월식 동안 고대 장치 활성화
```
생태 Event:
```text
거대 생물 이동
```
사회 Event:
```text
마을 축제
```
따라서 Event 시스템은 **전투 시스템이 아니다.**
---
#### 11. Condition → Opportunity → Outcome
이제 전체가 하나로 연결된다.
예:
##### 희귀 식물
```text
State
    humidity > 80
    moon = FULL
Process
    flowering
Condition
    밤
    + 습도 높음
    + 보름달
↓
Contents
    MoonFlower 생성
↓
Opportunity
    발견 / 채집
↓
Player Action
    특수 방법으로 채집
↓
Yield
    MoonFlower
↓
Player Growth
    특수 연금 재료
```
---
##### 떠돌이 NPC
```text
Relations
    tradeRoute exists
State
    roadSafety > 50
Process
    merchantMigration
↓
NPC 등장
↓
Opportunity
대화
거래
정보 획득
호위
도둑질
```
---
##### 고대 퍼즐
```text
Space
    AncientAnchor
Contents
    3 Statues
Rules
    Statues react to moonlight
Observation
    engraved clues
↓
Opportunity
    Investigation + Puzzle
↓
State
    statues aligned
↓
Mutation
    Connector OPEN
↓
Opportunity
    Hidden Region exploration
```
---
##### 포식자 사냥
```text
Process
    predator reproduction
↓
State
    predatorPressure > 80
↓
Trace 증가
NPC 반응 변화
초식동물 감소
↓
Opportunity
    조사
    추적
    사냥
↓
Boss 제거
↓
State
    predatorPressure -= 60
↓
Process 변화
    초식동물 회복
↓
Resource 변화
    특정 식물 증가
```
전투가 **생태와 자원 탐험의 일부**가 된다.
---
#### 12. 프로젝트의 핵심 Region Loop
우리 게임에서 Region의 가장 중요한 기능은 콘텐츠를 많이 담는 것이 아니다.
Region 하나가 다음 순환을 만들어야 한다.
```text
           ┌─────────────┐
           │   UNKNOWN   │
           └──────┬──────┘
                  ↓
              OBSERVE
                  ↓
             UNDERSTAND
                  ↓
          ┌────── CHOOSE ──────┐
          ↓                     ↓
       EXPLORE               INTERACT
       GATHER                COMBAT
       TRACK                 PUZZLE
       TALK                  CRAFT
          └──────────┬──────────┘
                     ↓
                WORLD CHANGE
                     ↓
              GROW / ACQUIRE
                     ↓
              NEW CAPABILITY
                     ↓
           NEW OPPORTUNITY
                     ↓
               DEEPER UNKNOWN
```
즉 Region의 최종 목적은:
> **플레이어에게 다양한 콘텐츠를 제공하는 것**이 아니라
> **세계의 사실과 법칙을 발견하고, 자신의 능력과 조합을 이용해 개입하며, 그 결과로 성장하고 새로운 미지에 접근하게 만드는 것**이다.
---
#### 13. 최종 Region 구조
```text
Region
│
├─ space
│   ├─ boundary
│   ├─ areas
│   ├─ anchors
│   ├─ connectors
│   └─ nestedRegions
│
├─ contents
│   ├─ actors
│   ├─ resources
│   ├─ objects
│   ├─ structures
│   ├─ hazards
│   ├─ phenomena
│   └─ traces
│
├─ state
│   └─ properties
│
├─ rules
│   ├─ constraints
│   ├─ modifiers
│   ├─ reactions
│   └─ transformations
│
├─ processes
│   ├─ environment
│   ├─ ecology
│   ├─ resources
│   ├─ actors
│   ├─ society
│   └─ anomalies
│
├─ observation
│   ├─ visibility
│   ├─ signals
│   ├─ clues
│   └─ knowledge
│
├─ relations
│   ├─ spatial
│   ├─ environmental
│   ├─ ecological
│   ├─ social
│   └─ causal
│
├─ persistence
│   ├─ lifetime
│   └─ history
│
└─ opportunities
    ├─ exploration
    ├─ traversal
    ├─ gathering
    ├─ combat
    ├─ growth
    ├─ crafting
    ├─ npc
    ├─ puzzle
    ├─ investigation
    ├─ tracking
    ├─ construction
    ├─ economy
    ├─ faction
    ├─ cooperation
    ├─ rescue
    ├─ localGame
    └─ narrative
```
단, 마지막 `opportunities`는 **새로운 World Primitive가 아니다.**
위의 Foundation을 사람이 플레이 가능한 단위로 조합한 **콘텐츠 정의 Layer**다.
---
#### 14. 가장 중요한 설계 경계
앞으로 Region 기능을 추가할 때 다음 질문으로 판단한다.
###### 새로운 것이 세계의 사실인가?
→ `Contents / State / Relation`
###### 세계가 작동하는 새로운 원리인가?
→ `Rule`
###### 시간에 따라 스스로 일어나는 변화인가?
→ `Process`
###### 새로운 공간적 의미인가?
→ `Space`
###### 플레이어가 그것을 알게 되는 방식인가?
→ `Observation`
###### 과거를 기억해야 하는가?
→ `Persistence`
###### 이미 존재하는 요소들을 이용한 새로운 플레이인가?
→ `Opportunity`
이 마지막 구분이 중요하다.
예를 들어:
```text
낚시
사냥
보물찾기
경주
퍼즐
Boss
호위
```
가 추가될 때마다 Region Foundation이 증가하면 설계가 잘못된 것이다.
이들은 모두 기존 세계 요소를 다른 방식으로 조합한 Opportunity여야 한다.
---
#### 15. Region의 최소 완성 기준
Region Foundation이 충분히 일반적인지는 다음 질문으로 검증한다.
하나의 Region에서 신규 기반 시스템 추가 없이 다음을 데이터로 표현할 수 있는가?
```text
□ 걸어다니고 새로운 장소를 찾는다.
□ 숨겨진 공간을 발견한다.
□ 환경에 의해 길이 열리고 닫힌다.
□ 식물·광물·생물 등에서 재료를 얻는다.
□ 자원이 고갈되고 다시 자란다.
□ 몬스터가 살아가고 이동한다.
□ 사냥하고 추적한다.
□ Boss가 조건에 따라 탄생한다.
□ 플레이어가 지역 경험을 통해 성장한다.
□ 지식이나 Capability를 획득한다.
□ NPC를 우연히 만난다.
□ NPC가 스스로 이동하고 행동한다.
□ 거래·대화·도움·적대가 가능하다.
□ 물체와 환경을 이용해 Puzzle을 만든다.
□ 특정 지식이나 조합으로 해결한다.
□ 건설·파괴·수리할 수 있다.
□ 지역 자체가 성장하고 쇠퇴한다.
□ 생태가 변화한다.
□ 세력이 지역을 점유한다.
□ 하나의 Region 변화가 다른 Region에 전달된다.
□ 세계의 법칙을 플레이어가 모를 수 있다.
□ 관찰과 경험으로 법칙을 알아낸다.
□ 조건에 따라 임의의 Event가 발생한다.
□ 전투가 아닌 Event도 동일하게 발생한다.
□ 전투·채집·탐험·NPC·Puzzle이 서로 영향을 미친다.
```
이 항목들이 성립한다면 Region은 특정 콘텐츠를 구현한 것이 아니라,
> **향후 세계에서 발생 가능한 콘텐츠를 만들어낼 기반 문법을 가진 것**
으로 볼 수 있다.

---

## 2. 검토 — 동의하는 것과 고친 것

원문은 지역을 **여덟 자리 + 기회 + 실행**으로 적었다. 그 뼈대는 이 저장소가 Play 여덟으로 세워 온 것과 **어긋나지 않는다** —
Region ②(그래프 · 규칙 · 중첩) · Material(원천 · 흔적 · 생애) · Time(시계 · 위상 · 소란 · 경로) · Life(탄생 · 개체군 · 관계) · Access(요구 · 성질 · 답)가
전부 여덟 자리 안에 들어간다 (§3.1). 원문이 새로 주는 것은 **셋**이다: ① 새 플레이가 올 때 기반이 늘지 않게 하는 경계(§14) ②
조건 · 변화 · 기회를 **종류의 목록이 아니라 한 형**으로 쓰는 문법(§4 · §5 · §8) ③ 지역이 **기억**한다(§2.8). 셋 다 L0 의 "미지의 세계에서의
성장과 조합" 에 닿는다 — 조합의 재미는 부품이 적고 형이 하나일 때 난다. **방향에 동의한다.** 아래는 번역하며 고친 아홉이다.

```text
① Region 의 정의       원문 §0 "Local World Context" 는 R2(Local Space + Rule Set + World State + Exploration Meaning + World Connection)와
                      Region §3 표의 열둘을 **재배열**한 것이다 — 새 정의가 아니다. 열둘 중 Identity · World Cause · Exploration Structure ·
                      Growth Outcome 은 여덟 자리 밖의 것(Region 이 왜 그런가 · 무엇을 내미는가)이라 그대로 남고, 나머지 여덟이 자리에 든다 (§3.1)
② Rules 넷            원문 §2.4 의 Constraint · Modifier · Reaction · Transformation 은 "규칙이 **하는 일**" 의 분류이고, Region §4 의
                      Additive · Transformative · Conditional 은 "Global Rule 과 **결합하는 방식**" 이다. 둘은 다른 축이라 둘 다 남긴다 —
                      넷은 Rule Contract 여덟 항목 중 **Effect 항의 어휘**로 둔다. 새 Rule 문법은 없다 (Life F13 그대로)
③ State 의 이름들      원문 §2.3 의 이름 쉰 남짓(temperature · predatorPopulation · corruption · ownerFaction …)은 **예시 어휘**다 —
                      원문 스스로 "Region 마다 필요한 Property 만 가진다" 고 적었다. 이 세계의 사실(이름)은 Human 만 짓고(README §4 ①),
                      선행 추상화는 금지다(spec.ts — "나머지 필드는 그 Region 을 실제로 쓰는 Play 가 더한다"). 그러므로 이름은 받지 않고
                      **이름공간의 형식**만 받는다 — 지금 있는 Region State 를 그 이름공간에 놓는다 (§3.1 State). Access 의 PropertyVocabulary(K5)
                      는 "무엇이 무엇을 **한다**"(성질)의 어휘이고 원문의 것은 "지금 얼마나"(값)의 어휘라 겹치지 않는다. 새 값은 그것을 쓰는 Play 와 함께만
④ Observation 의 깊이   원문 §2.6 의 네 단(World Truth → Signal → Observation → Knowledge)에서 2층은 **앞 둘**이다 — T8(시간은 관찰 가능해야) ·
                      S4(흔적이 먼저) · K10(요구를 알아낼 흔적) · R14(규칙의 형을 말한다). 발견 상태 다섯(UNKNOWN…MASTERED)은 Region §8 Discovery State ·
                      Access §7 네 단계와 같은 것 — **3층**이다. 관찰 수단 중 도구 · 아이템 · 요정 능력 · NPC 정보도 4 · 6 · 3층
⑤ Persistence 다섯 수명  이 세계는 지금 둘로만 산다 — 저장되는 State(스냅샷 · WORLD)와 유도 사실(저장 안 함) (L1 "저장과 유도"). 자국 60 초 ·
                      소란의 가라앉음은 "수명" 이 아니라 **세계 과정**이 지우는 것이다. 그래서 다섯 수명을 저장 기구 다섯으로 읽지 않고
                      **"무엇이 그것을 지우는가"** 로 읽는다 — TRANSIENT 는 과정이 · SESSION 은 관찰자가 · TEMPORARY 는 뒤척임이 · WORLD 는 아무것도 ·
                      PERSISTENT 는 결정만이 지운다 (G7). 새 기구 없음. History 만은 새것이다 — 지금 세계는 "몇 번 캤는가(taken)" 를 되돌아오면
                      0 으로 지우고, 남는 시각은 미로의 rearrangedAt 하나뿐이다 (G8)
⑥ Condition · Mutation  원문 §4 · §5 는 종류의 **목록**이다. 2층에서 실제로 서는 부분집합만 형으로 받는다 (§4). 행동 조건 열셋 중 2층에 있는 것은
                      gathered · entered · crossed 셋 — killed · crafted · talked · traded 는 그 층이 올 때 같은 형에 한 줄씩 는다.
                      **확률(CHANCE · WEIGHTED_SELECT · SEEDED_RANDOM)은 두지 않는다** — L1 §3 이 "난수 State 가 없다 · 확률을 처음 쓰는 층이
                      결정론을 지키는 방식과 함께 정한다" 고 했고 그것은 5층 이후의 첫 숙제다. 형에 자리만 비워 둔다 (빈칸 1).
                      Mutation 의 Knowledge 군은 3층 · Ownership 은 Material(소지)만 2층 — 지금 채광이 이미 그것이다
⑦ Opportunity 17 활동군  2층에서 데이터로 설 수 있는 것은 탐험 · 이동 · 채집 · 발견(관찰) · 추적 · 세계 변경의 절반(캐면 달라진다) · Event 다.
                      전투 · 성장 · 제작 · NPC · 퍼즐(지식 · 조합) · 경제 · 세력 · 협동 · 구조 · 미니게임 · 서사는 3~7층과 컨텐츠 행이 온 뒤
                      **같은 형에 든다** — 그것이 원문 §14 의 약속이고, 이 문서는 그 형이 지금 있는 동사(observe · gather · cross · move)만으로
                      성립하는지를 증명한다. 공통 구조 여덟 중 participants 는 3층(몸) — 2층은 "여럿" 을 소란으로만 센다 · rules(Temporary RuleSet)는
                      Tool-Scale 의 등급 B(Region Rule 하나)와 같은 것
⑧ Runtime 다섯         Read → Evaluate → Mutate → Propagate → Persist 는 L1 의 tick(Natural Law 조건 검사 → Transition) · SYSTEMS 순서 ·
                      C021(위상이 방을 넘는다) · Flow(S9) · Population Link via(F14) · 스냅샷에 **이미 이름 없이 서 있다**. 이 문서는 이름만 준다 —
                      "Region Runtime" 은 별도 시스템이 아니다 (F13 이 Life System 에 대해 말한 것과 같다). Propagate 는 Relation 을 따라
                      Mutation 이 건너는 것이고, 그 Relation 은 G9 의 다섯 갈래다
⑨ 최소 완성 기준 25     기계가 재는 것과 사람이 보는 것을 가른다. 25 중 2층에서 서는 것 · Play 대기(Life · Access · 이 Play) · 뒤 층 · 컨텐츠 행을
                      §8 이 대조한다 — "기반 시스템 추가 없이 데이터로" 가 기준이므로 등급 A/B/C 의 판정 표와 같은 자리다
```

원문이 든 예(MoonFlower · 붉은 안개 · 떠돌이 NPC · 고대 석상 · 포식자 사냥 · Albion · GW2 · FFXIV)는 **문법 설명용**이다 — 어느 것도 이 세계의
사실로 확정하지 않는다 (L1 §2 가 Concept 의 예시에 대해 한 것과 같다). 첫 적용은 Play 가 **이미 있는 사실**로 한다 (§10 D3).

---

## 3. 이 계약이 확정한 것

확정 항목은 **G**(Ground — 무대의 바닥). Concept 의 W · Region 의 R · Material 의 S · Time 의 T · Life 의 F · Access 의 K 와 같은 자리의 이름공간이다.

| # | 확정 | 원문 |
|---|---|---|
| **G1** | **Region 은 여덟 자리를 가진 Local World Context 다** — Space · Contents · State · Rules · Processes · Observation · Relations · Persistence. 새 정의가 아니라 R2 와 Region §3 열둘의 재배열이고, 앞선 계약 넷(재료 · 시간 · 생명 · 접근)은 전부 이 여덟 자리 안에 있다 (§3.1) | §0 · §1 · §13 |
| **G2** | **기반은 여덟에서 늘지 않는다.** 새 플레이(낚시 · 사냥 · 보물찾기 · 경주 · 퍼즐 · Boss · 호위 …)는 기존 요소의 조합 = **Opportunity** 다. 무엇이 기반이고 무엇이 조합인지는 §14 의 일곱 질문이 가르고, 그 일곱이 Tool-Scale §2 등급 판정(A · B · C)의 **결정 나무**가 된다 (§5.4) | §1 · §14 |
| **G3** | **Opportunity 는 World Primitive 가 아니라 컨텐츠 정의 층이다** — 데이터다. 공통 구조 여덟(availability · discovery · participants · target · possibleActions · rules · progress · outcomes) 중 2층은 여섯을 채운다(participants · rules 는 자리만). possibleActions 는 이미 있는 동사뿐 — 기회가 늘어도 동사는 늘지 않는다 | §6 · §8 · §13 |
| **G4** | **Event = 시간과 진행 상태를 가진 Opportunity.** 별도 Event 시스템은 없다 — Event 는 availability 에 시간 조건이, progress 에 상태가 있는 기회다. 지나가는 것(T7)과 WORLD_EVENT 원천(S3)이 이미 그 첫 사례이고, 이 계약은 그것을 기회 데이터로 적는다 | §10 |
| **G5** | **Condition 은 하나의 형이다** — Target + Query + Operator + Value + Qualifier(시간 · 변화). 종류를 늘리지 않는다. 지금 흩어진 조건 자리 넷(`CONNECTOR_ACTIVATIONS` · `phases.connectorActivation` · `Lock.requires` · `occurrence.seasons/dayPhases`)은 이 형으로 **읽힌다** — 옮기는가 어댑터인가는 Cycle spec 이 정한다 (Access 빈칸 1 과 같은 자리 · §10 빈칸 2) | §4 |
| **G6** | **Mutation 은 소수의 World Operation 이다** — 컨텐츠 종류별 Effect 를 만들지 않는다. 2층에서 서는 것: Property SET/ADD/CLAMP · Entity CHANGE_STATE · Relation CONNECT/DISCONNECT · Process START/STOP/ADVANCE/RESET · Opportunity OPEN/CLOSE/COMPLETE · Ownership GRANT(Material). 나머지는 표에 자리만 (§4.2). 기존 Transition 을 옮기지 않는다 — 이름을 붙이고 검사가 대조한다 | §5 |
| **G7** | **남는 것의 종류는 "무엇이 그것을 지우는가" 로 가른다.** 원문의 다섯 수명은 저장 기구 다섯이 아니라 지우는 손 다섯이다 — **스치는 것**(시간이 지운다 · TRANSIENT) · **관찰자만 쥐는 것**(SESSION) · **뒤척임이 묻는 것**(TEMPORARY) · **세계에 남는 것**(아무것도 지우지 않는다 — 스냅샷에 실린다 · WORLD) · **지워지지 않는 것**(그 Region 이 결정으로만 지운다 — FINITE_WORLD_STATE · 멸종 · 무너진 마디 · PERSISTENT). State 필드마다 이 다섯 중 하나가 **적혀 있어야** 하고(§4.4) 지우는 손이 없는 값은 검사가 보인다 (㊼) | §2.8 |
| **G8** | **방은 기억한다** — 자기에게 일어난 일을 센 것(몇 번 캐였는가 · 마지막 고갈은 언제였는가 · 뒤척임이 몇 번 지났는가 · 고래가 몇 번 지났는가)이 지워지지 않는 계수와 시각으로 남는다. 되돌아옴이 캔 횟수를 0 으로 되돌려도 누계는 남고, **뒤척임**(긴 밤이 걷히며 세계가 다시 짜이는 순간 — 자국과 발자국을 묻는다)이 지나도 셈은 남는다 (Human 확정 — 자국은 뒤척임이 묻는 것, 셈은 지워지지 않는 것). 기억은 Condition 의 **Target** 이다 — 과거의 플레이가 미래의 조건이 된다. 항목은 §10 D4 · 상한 없음 (정수) · 누가 했는지는 세지 않는다 | §2.8 |
| **G9** | **Relations 는 이미 다섯 갈래로 서 있다** — 공간(Graph · Connector R6) · 환경(Flow S9) · 생태(Population Link `via` F14) · 사건(위상이 방을 넘는다 C021 · Presence 경로 T7) · 사회(없음 — 뒤 층). 새 구조 없음 — 이름을 주고, **Propagate 는 Relation 을 따라 Mutation 이 건너는 것**이다. 검사는 관계를 한 목록으로 보고한다 (㊻ 곁) | §2.7 · §3.4 |
| **G10** | **Observation 의 2층 몫은 World Truth → Observable Signal 까지다** (T8 · S4 · K10 · R14). Player Observation 은 판(C026~C028)이고, Player Knowledge 와 발견 상태 다섯은 3층이다 | §2.6 |
| **G11** | **Yield 는 하나의 표다.** 2층에서 실제로 나는 것: Material · Access(활성) · Discovery(기록 — 관찰자가 쥔다) · World Influence(캐면 달라진다 · 소란). 나머지 열(Item · Currency · Knowledge · Recipe · Skill · Capability · Class Progress · Mastery · Relationship · Reputation)은 **열은 있고 값이 0** 인 채로 선다 — ㊴ 의 Actor · Knowledge 열과 같은 약속 | §9 |
| **G12** | **Region 자체가 성장 · 쇠퇴할 수 있다** — Process 의 Mutation 대상이 Region 의 상시 위상(`phases.standing` · C019)일 수 있다. 첫 사례는 두지 않는다 — 원문의 두 예(둥지 → 군락 · 폐허 → 마을)는 각각 Life 의 개체군과 3층의 NPC 가 필요하다 (§10 빈칸 3) | §2.5 |
| **G13** | **최소 완성 기준 25 는 Region 작성기의 사람이 보는 표다** — 기계가 재는 것(검사 ①~㊼)과 사람이 보는 것을 가른다. 지금 세계의 대조는 §8 | §15 |

### 3.1 여덟 자리 ↔ 이미 선 것 — 대응표

이 표가 이 문서의 절반이다. "연결" 이 여기서 일어난다 — 새로 세우는 것이 아니라 서 있는 것을 자리에 놓는다.

| 자리 | 원문의 세부 | 이 세계에 이미 선 것 (계약 · 코드) | 아직 없는 것 — 어디 |
|---|---|---|---|
| **Space** | Boundary · Area · Anchor · Connector · Nested Region · Spatial Relation · Navigation Surface · 판정 열셋 | R1 · R3 · R5 · R6 · `RegionDescription`(area · point · anchor layer) · Graph(containment · connectors) · traversable 격자 · height-field · surface 태그(서리가 다섯째) · 판정 inside/enter/exit/distance/adjacent/contains/connected → `engine/world-authoring/query` · 검사 ⑤~⑧ | lineOfSight · occupancy · density — 요구 없음(그것을 쓰는 Play 가 온다) · 비행 · 수영 Navigation Surface — 그 갈래의 컨텐츠 행(surface 태그 한 줄) |
| **Contents** | Actor · Resource · Object · Structure · Hazard · Phenomenon · Trace | Resource = Source(S2 · S6) · Hazard = hazard layer 태그(Concept §3.1 · C016 · C019 갈래 넷) · Phenomenon = presence 경로(T7) · 눈보라 area · Trace = trace layer(S4) · track(T2.7) · Structure = landmark(BLOCK_LANDMARK · 다리 · 표식) · Actor = 몸(actors) — 2층은 개체군 값(F9 첫 깊이) | **Object**(상자 · 문 · 레버 · 장치 · 함정 · 운반물) — 하나도 없다 → 컨텐츠 행(그 방의 퍼즐) · Structure 의 State(bridgeIntegrity) — 다리 하나에 상태 없음 → 그 방의 Play |
| **State** | Property 집합 · 이름공간 여덟 | `RegionState` = rule(pattern · pressure · rearrangedAt) · sources[](phase · taken · progress · siteIndex · collapsedSites) · disturbance(value · phase) · tracks[] · (Life 뒤) populations · lifeSites. 이름공간에 놓으면 — anomaly.pattern · resource.sources · danger.disturbance · ecology.populations · **environment.*** 은 전역 시계의 유도 사실(방 State 아님) | society.* · control.* · structure.* — 없음(뒤 층 · 그 방의 Play). 이름은 받지 않는다(§2 ③) |
| **Rules** | Constraint · Modifier · Reaction · Transformation | R7 Rule Contract 여덟 · **Constraint** = 건너기 거절 여섯 · 닫힌 통로 · 급경사 · **Modifier** = 관찰 범위 배율(밤 · 눈보라) · 되돌아옴 속도(긴 밤 두 배) · **Reaction** = 소란 임계 → 깨어남 · 걸음 → 압력 → 재배열 · **Transformation** = 결정면이 옆으로 옮겨 선다 · 노두가 다음 마디로 · 뒤척임. Rule Primitive(Region §3.3 기구 후보) | 넷은 Effect 의 어휘로만 — 새 문법 없음(§2 ②) |
| **Processes** | 환경 · 생태 · 자원 · NPC · 사회 · 위험 · Region 자체 성장 | 시계 · 철(T1~T3) · 되돌아옴(S6 · S7 · 원천마다 길이) · 소란의 가라앉음 · 뒤척임(onTurn) · 경로 시간표(T7) · (Life) 결속 → 전이 · 개체군의 오르내림(F14) | NPC · 사회 → 3층 이후 · **Region 자체 성장** → G12 · 빈칸 3 |
| **Observation** | World Truth → Signal → Observation → Knowledge · 수단 열 · 발견 상태 다섯 | T8(하늘 · 흙 · 흔적이 시각을 말한다) · S4(흔적이 먼저) · K10(요구를 알아낼 흔적) · R14(규칙의 형) · 판(C026~C028 — 지목 · 대상 프레임 · 기록) · 밤의 범위 · 눈보라 · movement-reading | Player Knowledge · 발견 상태 다섯 → 3층(G10) · 도구 · 아이템 · 요정 능력 → 4 · 6층 · 지도 → 두지 않는다(Concept §19-08 · Trail 초안 Q1) |
| **Relations** | 공간 · 환경 · 생태 · 사회 · 사건 | Graph · Connector(R6 열 항목) · Flow(S9 — 호수 바닥 → 물길 → 어귀) · Population Link `via`(F14) · 위상이 방을 넘는다(C021) · Presence 경로가 방들을 지난다(T7) | 사회(tradeRoute · territory) → 뒤 층 · 관계를 **한 목록**으로 보는 보고 없음 → 검사 ㊻ 곁 |
| **Persistence** | 수명 다섯 · History | 스냅샷(`engine/world-kernel/persistence` · `STATE_VERSION` · 파일 store) · 과정이 지우는 것(track 60 초 · 소란 0.5/s) · 뒤척임이 묻는 것(onTurn.burySigns · 덧씌움) · 관찰자가 쥐는 것(기록 · Observe 확정 7 · 12) · FINITE_WORLD_STATE(S7) · 멸종(F15) · collapsedSites | **기억 없음** (캔 횟수는 되돌아오면 0 · 남는 시각은 미로의 rearrangedAt 하나뿐) → 이 Play · 무엇이 무엇을 지우는지가 데이터에 적혀 있지 않다 → 이 Play(§4.4) |
| **Opportunity** | 17 활동군 · 공통 구조 여덟 · Event | Resource Opportunity(Material §3.3 — 역할 넷) · Interaction(observe · gather · cross · move — `InteractionView` available/reason) · WORLD_EVENT 원천(비늘 · 먹이 잔해) · 판의 「할 수 있는 것」 줄(C027) · Lock(K1 — 요구) | **Opportunity 데이터 없음** — availability · discovery · target · progress · outcomes 를 한 자리에 적는 형 → 이 Play · 17 중 2층 밖은 §7 |
| **Runtime** | Read → Evaluate → Mutate → Propagate → Persist | L1 tick · `SYSTEMS` 배열 하나가 순서를 고정 · Natural Law · Transition · 스냅샷 | 이름만 받는다 — 시스템이 아니다(§2 ⑧) |

여덟 자리 밖에 남는 Region §3 의 넷 — Identity(무엇이 특별한가) · World Cause(왜) · Exploration Structure(어떻게 겪는가) · Growth Outcome(무엇이 열리는가) —
은 **Region 이 왜 그런가와 무엇을 내미는가**다. 앞의 둘은 Concept §17 의 질문 1 · 2 이고 뒤의 둘은 Opportunity 와 Yield 로 이 문서에 든다.

---

## 4. 데이터 계약 (의미 계약 — 타입과 파일 배치는 구현이 정한다)

새 layer 는 없다. 새 파일은 Opportunity 목록 하나뿐이고 Region 파일 안에 둘지 밖에 둘지는 구현이 정한다 (Material · Life 의 어법).
규칙 코드는 **어떤 기회도 어떤 조건도 이름으로 알지 못한다** — R13 이 방에 · Material 이 재료에 · Life 가 생명에 · Access 가 Lock 에 대해 말한 것이
여기에도 성립한다. 기회를 더하는 것은 값이 느는 일이지 규칙이 느는 일이 아니다.

### 4.1 Condition — 하나의 형 (G5)

```yaml
Condition:
  target: { kind: region | area | connector | source | process | route | clock | history, ref: ID }   # 2층에서 서는 Target 여덟 — actor · player · faction 은 자리만
  query: property | exists | count | state | history                                                # distance · contains · relation · capability · knowledge 는 그 층에서
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | IN | EXISTS | NOT_EXISTS
  value: 수치 | 문자열 | 목록
  qualifier:                        # 하나까지. 없으면 "지금"
    time:   { FOR | SINCE | WITHIN | BEFORE | AFTER, 세계 초 또는 { season | dayPhase } }
    change: { BECAME | CROSSED | INCREASED | DECREASED }                                             # 직전 tick 과 견준다 — 값을 저장하지 않는다(유도)
  all: [Condition] | any: [Condition]                                                                  # 집합 — ANY · ALL. NONE 은 any 의 부정
  # chance: 두지 않는다 (§2 ⑥ · 빈칸 1)
```

행동 조건(gathered · entered · crossed)은 별도 종류가 아니다 — 그 행동이 남기는 **History**(§4.3)를 `history` query 로 읽는 것이다.
원문 §4.6 "행한 것도 World Fact 다" 가 그 뜻이다.

지금 세계의 조건 자리 넷이 이 형으로 읽힌다 (옮김 · 어댑터는 spec — 빈칸 2):

```text
CONNECTOR_ACTIVATIONS(C009)          { target: region MAZE · query: state · patterns IN [P2] }
phases.LONG_NIGHT.connectorActivation { target: clock · query: property season · == LONG_NIGHT }
occurrence.seasons / dayPhases        { target: clock · query: property · IN [...] }
Lock.requires (Access §4.3)           time · state 항은 위와 같다 · property · knowledge 항은 3 · 4층이 target: actor 로 채운다
```

### 4.2 Mutation — World Operation 표 (G6)

| 군 | 2층에서 서는 op | 지금 그것인 Transition | 자리만 |
|---|---|---|---|
| Property | SET · ADD · CLAMP | 소란 addDisturbance(ADD + CLAMP) · 압력 · progress · taken | SUBTRACT · MULTIPLY |
| Entity | CHANGE_STATE | 원천 phase(available → depleted → recovering) · 미로 pattern · 소란 phase · lifeSites phase | CREATE · REMOVE · MOVE · TRANSFORM(원천이 마디를 옮기는 것은 MOVE 의 첫 후보) |
| Relation | CONNECT · DISCONNECT | Connector 활성(철 · 패턴) · 닫힌 통로 | REDIRECT · ADD/REMOVE_RELATION |
| Process | START · STOP · ADVANCE · RESET | 되돌아옴 시작/진행/멎음(recovery-stalled) · 뒤척임이 자국을 처음으로(RESET) | PAUSE |
| Opportunity | OPEN · CLOSE · COMPLETE | (이 Play 가 처음 세운다) | REVEAL · START · FAIL · TRANSFORM |
| Knowledge | — | — | 전부 3층 |
| Ownership | GRANT(Material) | 채취가 소지에 준다 | REMOVE · TRANSFER · Item 이하 |

옮기지 않는다 — 기존 Transition 은 그대로 두고 **이름을 붙인다**. 검사 ㊺ 가 Opportunity.outcomes 의 op 가 이 표 안인지만 본다.

### 4.3 기억 — history (G8)

```yaml
RegionState += history:             # 기억 — 저장된다 · 스냅샷에 실린다 · 뒤척임이 묻지 않는다(Human 확정) · 상한 없음
  sources[id]:  { takenTotal: 정수, depletedTimes: 정수, lastDepletedAt: 세계 초 | null }
  turns:        정수                                     # 뒤척임 횟수
  awakenings:   { times: 정수, lastAt: 세계 초 | null }    # 소란이 임계를 넘은 횟수
  passages[routeId]: { times: 정수, lastAt: 세계 초 | null }   # 경로가 이 방을 지난 횟수
  (Life 뒤) births[formationId]: { times, lastAt }
```

기억은 **일어난 일의 계수와 시각**만이다 — 누가 했는가는 없다 (T2.7 "관찰자의 이름은 실리지 않는다" 와 같은 규율). 관찰에 실리는 것은 지목했을 때의
「기억」 줄뿐이다(§6 11).

### 4.4 남는 것의 종류 — 무엇이 그것을 지우는가 (G7)

수명은 타입이 아니라 **표**다 — State 필드마다 "무엇이 그것을 지우는가" 하나. Cycle 이 State 를 더할 때 이 표에 한 줄을 더한다 (spec 의 State 절).

| 남는 것의 종류 | 지우는 손 | 지금 그것인 것 |
|---|---|---|
| 스치는 것 (TRANSIENT) | 시간 — 세계 과정이 저절로 지운다 | 발자국(60 초) · 소란 값(고요에 0.5/s) · 되돌아옴 progress |
| 관찰자만 쥐는 것 (SESSION) | 관찰자 — 세계 State 가 아니다 | 기록판 · 온 길(Trail 초안) · 지목 |
| 뒤척임이 묻는 것 (TEMPORARY) | 뒤척임 · 철 | 캔 자국(burySigns) · 덧씌움(phases) · 옮겨 선 마디(siteIndex) |
| 세계에 남는 것 (WORLD) | 아무것도 — 스냅샷에 실린다 | 원천 phase · 캔 횟수 · 미로 pattern · 소란 phase · populations |
| 지워지지 않는 것 (PERSISTENT) | 그 Region 의 결정만 | FINITE_WORLD_STATE · 멸종(F15) · 무너진 마디 · **기억(history)** |

### 4.5 Opportunity (G3 · G4)

```yaml
Opportunity:
  id: OPPORTUNITY_ID
  region: REGION_ID
  availability: Condition                       # 언제 있는가. 시간 qualifier 가 있으면 Event 다 (G4)
  discovery: VISIBLE | SIGNAL | TRACE | HIDDEN   # NPC · KNOWLEDGE 는 자리만(3층)
  target: { kind: source | area | connector | route | process, ref: ID }
  possibleActions: [observe | gather | cross | move]     # 이미 있는 동사만 — Interaction role 과 같다
  progress: { kind: none | counter | phase, ref: history 경로 | state 경로 }   # 유도 — 따로 저장하지 않는다
  outcomes:
    world: [Mutation]                            # §4.2 표의 op 만
    yield: [Material | Access | Discovery | WorldInfluence]   # G11 — 2층의 네 열
  # participants · rules: 자리만 (§2 ⑦)

RegionSpec += opportunities: [Opportunity]        # 없으면 빈 목록 — "내미는 것이 없는 방" 은 검사 ㊻ 이 보인다
```

기회는 **판정하지 않는다** — Interaction 의 available/reason 은 지금처럼 규칙이 유도한다. 기회 데이터는 그 판정에 **이름**(어느 기회의 것인가)과
**언제 · 어떻게 알게 되는가 · 무엇이 남는가**를 붙인다. 판의 「할 수 있는 것」 줄이 이 데이터에서 온다 (C027 재사용).

---

## 5. 도구에 주는 변화

### 5.1 layer · 파일

새 layer 없음. 파일은 §4 — Opportunity 목록 하나 · RegionState.history · 수명 표(문서 + 검사 ㊼ 의 입력).

### 5.2 도구가 새로 검사하는 것 — ㊸~㊼

Concept ①~④ · Region ⑤~⑨ · Material ⑩~㉒ · Time ㉓~㉖ · Life ㉗~㉝ · Access ㉞~㊷ 에 다섯이 이어진다.

```text
참조 무결성 (통과/실패)
  ㊸ history 의 키(원천 · 경로 · 탄생지)가 실제로 있는가 — 지워지지 않는 것이 유령을 가리키지 않게
  ㊹ 모든 Condition 의 target.ref · query 가 실제로 있는 것과 그 형의 속성을 가리키는가 · qualifier 가 유효한가 —
     흩어진 조건 자리 넷을 **한 검사**로 (㉓ · ㉖ · ㉞ 이 각자 보던 것의 일반형)
  ㊺ Opportunity 의 availability · target · outcomes 가 참조 무결이고 outcomes.world 의 op 가 §4.2 표 안인가 ·
     possibleActions 가 실제 Interaction role 인가
분포 요약 (판정 없음 — 사람이 본다)
  ㊻ 방마다 기회의 수 · discovery 종류별 수 · Event(시간 조건 있는 것)의 수 — 기회가 하나도 없는 방 · 한 종류뿐인 방이 눈에 띄게.
     Access ㊷("문 뒤에 무엇이 있는가")의 옆 — **가능성 밀도**. 함께 Relations 를 한 목록으로(공간 · 환경 · 생태 · 사건 — 방 사이 관계가 0 인 방)
  ㊼ Persistence 요약 — State 필드별 수명 · 지우는 손이 적히지 않은 값(PERSISTENT 로 새는 것) · history 의 크기
```

### 5.3 관찰 도구

`world:observe --report` 에 **기회 표** 하나 — 행이 방, 열이 기회(discovery · Event 여부 · target · yield). 열쇠 × 자물쇠 표(Access §5.3) 곁.
`world:observe <방>` 은 그 방의 history 를 읽는다 (읽기 전용 그대로).

### 5.4 도구 절반 2단계에 주는 변화 — Region 작성기가 기회와 기억을 안다 · 등급 판정에 결정 나무

```text
§1 고정 공식     … 접근 계약 · **기회 계약(availability · discovery · target · outcomes)** · **수명 표** · 검사 ①~㊼
§2 등급 판정     §14 의 일곱 질문이 **결정 나무**가 된다 — brief 의 "요구" 가
                  세계의 사실인가 → Contents / State / Relation 의 값 → A
                  작동하는 새 원리인가 → Rule → B (Rule Primitive 가 있으면 조합 → A)
                  스스로 일어나는 변화인가 → Process → B
                  새 공간적 의미인가 → Space 의 op / surface 태그 → A · 없는 판정을 부르면 C
                  알게 되는 방식인가 → Observation → 표현의 표(A) · 새 관찰 계약이면 ENGINE
                  과거를 기억해야 하는가 → Persistence → history 한 줄 → A
                  기존 요소의 새 조합인가 → Opportunity → **A** (데이터)
                  지금 없는 층의 의미(몸 · 지식 · 대결 · 능력 · 성장)를 부르면 → C
T2 열셋째 답     Concept §17 일곱 + Life 여덟째 + Access 아홉째~열두째 + **열셋째 — 무엇을 할 수 있고 무엇을 기억하는가**
                (이 방이 내미는 기회는 무엇이고 · 그중 때가 있는 것(Event)은 무엇이며 · 무엇이 History 로 남아 다음 조건이 되는가)
T3 산출          RegionSpec 에 opportunities 가 함께 나온다 — 원천마다 채집 기회 하나가 기본형 · WORLD_EVENT 원천은 Event 기본형
T6 편중 요약     ⑲ ⑳ ㉒ ㉕ ㉖ ㉚ ㉝ ㊱~㊵ ㊷ 에 ㊻ 이 더해진다
```

### 5.5 도구 밖으로 가는 것

| 원문 | 무엇인가 | 어디 |
|---|---|---|
| Condition 의 실제 평가 · Opportunity 의 OPEN/CLOSE 전이 | 세계 과정 · 규칙 | 컨텐츠 world — Cycle 이 세운다 (기구는 ENGINE — 게임 명사 없는 평가기) |
| Player Knowledge · 발견 상태 다섯 · knowledge Lock | 주체가 아는 것 | 3층 (G10) |
| Actor · NPC · participants | 몸과 행동 | 3층 |
| 전투 Opportunity · Boss 탄생 조건 · killed | 대결 | 5층 (Life 가 탄생 조건을 · 5층이 대결을) |
| 제작 · 지역 의존 제작 · crafted · Recipe · Item · Currency | 재료의 쓰임 | 4층 이후 (S10) |
| Character Growth · Mastery · Class Progress · Capability | 성장 | 7층 |
| 경제 · 세력 · 협동 · 구조 · 미니게임 · 서사 · NPC 조우 | 사회 | 뒤 층 · 컨텐츠 행 |
| 확률 | 난수 State | 5층 이후 (L1 §3 · 빈칸 1) |

---

## 6. 공정 대응 — 새 Workflow 를 만들지 않는다

Region §4 · Material §4 · Life §4 · Access §6 의 대응표에 그대로 겹친다. Region 하나를 쓸 때 12단계에 더해지는 것만 적는다.

| 단계 | 더해지는 것 | 이 저장소 |
|---|---|---|
| 1 Core Proposition · 2 World Cause | 이 방은 **무엇을 내미는가**(기회) · 무엇을 **기억**해 다음 조건으로 삼는가 | Play Design |
| 3 Rule Set | 조건은 Condition 형으로 · 결과는 §4.2 의 op 로 적는다 — Rule Contract 의 Condition · Effect 항 | `cycles/<CycleId>/spec.md` |
| 5 Exploration Contract | Exploration 의 `opportunity` 항이 **Opportunity 데이터**가 된다 · 때가 있는 것은 Event | Play Design → RegionSpec.opportunities |
| 7 Growth Outcome | Yield 표의 어느 열인가 (2층은 네 열) | spec.md |
| 8 Topology | Relations 다섯 갈래 중 이 방이 가진 것 — 관계 0 인 방이 아닌가 (㊻) | `graph.ts` · flows · links |
| 11 Play Observation | 기회가 판에 읽히는가 · 세계가 "언제까지" 를 말하지 않는가 · 기억이 지목으로 읽히는가 · 뒤척임 뒤에도 남는가 | Cycle 완료 조건 + ㊸~㊼ |
| 12 Revision | 조건이 유령을 가리킨다(㊹) · 기회 없는 방(㊻) · 지우는 손 없는 값(㊼) · 새 플레이가 기반을 늘렸다(§14 — 설계 잘못) | Cycle 반복 |

---

## 7. 이 층의 것이 아닌 것

| 무엇 | 왜 | 어디 |
|---|---|---|
| Player Knowledge · 발견 상태 다섯(UNKNOWN…MASTERED) · Investigation 의 결과(Rule 발견 · Weakness) | 주체가 무엇을 아는가 | 3층 (Region §8 · Access §7) |
| Actor 군(Monster · NPC · Merchant · Boss …) · NPC Process · 조우 · 관계 변화 | 몸 · 행동 · 사회 | 3층 이후 |
| 전투 · 사냥 · killed · Boss 제거 · PvP | 대결 | 5층 |
| 제작 · 정제 · 지역 의존 제작 · crafted · Recipe | 재료의 쓰임 | 4층 이후 |
| Character Growth · Yield 의 열 열(Item … Reputation) | 성장 | 4 · 7층 — 열은 있고 값 0 |
| 경제 · 세력 · 협동 · 구조 요청 · 미니게임 · 서사 | 사회 · 컨텐츠 | 뒤 층 · 컨텐츠 행 |
| Object(레버 · 상자 · 장치 · 함정) · Structure 의 State | 세계 사실 — 이름은 Human 것 | 컨텐츠 행 (그 방의 퍼즐) |
| 원문 §2.3 의 Property 이름들 | 예시 어휘 — 이름은 그것을 쓰는 Play 와 함께 | §2 ③ |
| 확률(CHANCE · WEIGHTED_SELECT · SEEDED_RANDOM) | 난수 State 가 없다 — 결정론을 지키는 방식과 함께 | 5층 이후 (L1 §3) |
| Region 자체 성장의 첫 사례 | 개체군(Life) 또는 NPC(3층)가 먼저 | G12 · 빈칸 3 |
| 지도 · lineOfSight · 비행 · 수영 | 요구가 없다 | 그 갈래의 컨텐츠 행 · Trail 초안 Q1 |

---

## 8. 최소 완성 기준 25 — 지금 세계와의 대조 (G13)

기준은 *"신규 기반 시스템 추가 없이 데이터로 표현할 수 있는가"* 다. **선 것**은 어느 Play 가 세웠는지, **대기**는 어느 Play 가 세울지, **뒤 층**은 어느 층인지 적는다.

| # | 기준 | 지금 | 어디 |
|---|---|---|---|
| 1 | 걸어다니고 새로운 장소를 찾는다 | 선 것 | Rooms · Land |
| 2 | 숨겨진 공간을 발견한다 | 선 것 — 중첩(작은 문 · 큰 방) · 미로의 심장 | Rooms C003 · Rule C009 |
| 3 | 환경에 의해 길이 열리고 닫힌다 | 선 것 — 긴 밤의 문 · 패턴의 통로 · 추위가 고개를 넘는다 | Time C016 · Rule · Frost C021 |
| 4 | 식물 · 광물 · 생물 등에서 재료를 얻는다 | 선 것 — Carrier 넷(생물은 남긴 것으로) | Material C011 · Frost C020 |
| 5 | 자원이 고갈되고 다시 자란다 | 선 것 | Material C012 · C013 |
| 6 | 몬스터가 살아가고 이동한다 | 절반 — 개체군 값과 경로(현상)까지 · 걷는 개체는 3층 | Life C025 · Time C018 · **3층** |
| 7 | 사냥하고 추적한다 | 추적은 선 것(흔적 → 원천 · 자국 · 경로 선) · 사냥은 5층 | Material C011 · Time C017 · **5층** |
| 8 | Boss 가 조건에 따라 탄생한다 | 탄생 조건은 Life(F9 셋째 깊이 — World Event) · Boss 는 5층 | Life 대기 · **5층** |
| 9 | 플레이어가 지역 경험을 통해 성장한다 | 뒤 층 | **7층** |
| 10 | 지식이나 Capability 를 획득한다 | Access 가 "무엇이 답인가" 까지 · 획득은 뒤 층 | Access 대기 · **3 · 4층** |
| 11 | NPC 를 우연히 만난다 | 뒤 층 | **3층** |
| 12 | NPC 가 스스로 이동하고 행동한다 | 뒤 층 | **3층** |
| 13 | 거래 · 대화 · 도움 · 적대가 가능하다 | 뒤 층 | **3층 이후** |
| 14 | 물체와 환경을 이용해 Puzzle 을 만든다 | 환경 퍼즐은 선 것(미로 · 철의 문) · Object 퍼즐은 컨텐츠 행 | Rule · **컨텐츠 행** |
| 15 | 특정 지식이나 조합으로 해결한다 | 뒤 층 | **3 · 4층** |
| 16 | 건설 · 파괴 · 수리할 수 있다 | 파괴의 절반(캐면 무너진다) · 건설 · 수리는 뒤 층 | Material C012 · **4층 이후** |
| 17 | 지역 자체가 성장하고 쇠퇴한다 | 위상까지(깨어남 · 상시) · 성장의 첫 사례는 없다 | G12 · **빈칸 3** |
| 18 | 생태가 변화한다 | Life 대기 — 개체군이 오르내리고 서로를 부른다 | Life C022~C025 |
| 19 | 세력이 지역을 점유한다 | 뒤 층 | **뒤 층** |
| 20 | 하나의 Region 변화가 다른 Region 에 전달된다 | 선 것 — 흐름 · 위상이 방을 넘는다 · 경로 | Material C014 · Frost C021 · Time C018 |
| 21 | 세계의 법칙을 플레이어가 모를 수 있다 | 선 것 — 세계는 답을 싣지 않는다(K8 · R14 · Q42) | Observe · Access |
| 22 | 관찰과 경험으로 법칙을 알아낸다 | 관찰까지(2층) · "알아냈다" 는 3층 | Observe · **3층** |
| 23 | 조건에 따라 임의의 Event 가 발생한다 | **이 Play** — Event = 시간 있는 기회 (지나가는 것이 첫 사례) | RoomRemembersAndOffers |
| 24 | 전투가 아닌 Event 도 동일하게 발생한다 | **이 Play** — 첫 Event 가 채집이다 | RoomRemembersAndOffers |
| 25 | 전투 · 채집 · 탐험 · NPC · Puzzle 이 서로 영향을 미친다 | 채집 ↔ 탐험 ↔ 생태 ↔ 시간은 선 것 · 전투 · NPC 는 뒤 층 | Material · Time · Life · **5층 · 3층** |

2층이 닫힐 때 서 있어야 하는 것은 **1~5 · 18 · 20 · 21 · 23 · 24** 와 6 · 7 · 10 · 14 · 16 · 17 · 22 · 25 의 2층 몫이다. 나머지는 그 층이 올 때
**같은 형에** 든다 — 그것이 성립하는지가 이 문서의 검사이고, 새 플레이가 기반을 늘리면 설계가 잘못된 것이다 (§14).

---

## 9. L0 판단 기준 · 미증명 넷

```text
어떤 위험을 주는가            이 문서는 위험을 더하지 않는다 — 위험이 어느 자리(Contents.hazard · Rules · Processes)에 서는지를 말한다
극복할 재료를 어디에 두는가    같은 자리에 — 기회의 outcomes 가 World Cause 의 재료를 준다 (R10 · S1 을 기회 데이터가 잇는다)
요정이 무엇으로 자라는가       Yield 표의 열 넷(2층) — 나머지 열은 뒤 층이 채운다. 성장 자체는 정하지 않는다
Core Breath 의 어느 전이인가   관찰 → 이해 → **시도** — "무엇을 할 수 있는가" 가 데이터로 서고 판에 읽히는 구간. 그리고 극복 → 성장 → 새로운 미지
                            사이에 **기억**이 선다 — 과거의 플레이가 다음 미지의 조건이 된다
```

```text
① 재방문해도 재미있는가        기억 — 같은 방이 내가(우리가) 한 일을 셈해 두고 그것이 다음 조건이 된다 (G8). Time 의 "다른 때" 에 "다른 과거" 가 더해진다
② 여럿이어야 하는 이유         History 는 누가 했는지 세지 않는다 — 방이 세는 것은 **우리**가 한 일이다. 소란(T5)이 순간의 합이었다면 History 는 누적의 합
③ 성장 선택의 애착과 고민       닿지 않는다 — Yield 표의 열이 비어 있다는 것만 (G11)
④ 발견 뒤에도 살아 움직이는가   Event = 때가 있는 기회 — 발견된 방이 "지금은 없고 그때는 있는 것" 을 내민다 (G4)
```

---

## 10. 위임된 결정과 빈칸

Human 은 "반영 · 연결 · 강화" 로 위임했고, 아래 다섯을 "제안대로" 로 승인했다. Human 이 언제든 뒤집는다.

```text
D1  자리와 글자 — ②-부속 다섯째 · 확정 항목 G · 새 축 없음. "design 은 여기까지" 였던 STATE §1 을 이 주입이 다시 연다 (승인이 그것을 확정한다)
D2  2층에서 서는 부분집합 — Condition 의 Target 여덟 · Query 다섯 · Qualifier 둘(시간 · 변화) · Mutation 의 op 열둘 · Yield 열 넷 · discovery 넷 (§4).
    나머지는 자리만 — 그 층이 올 때 같은 형에 한 줄씩 는다
D3  첫 기회는 **이미 있는 사실**이다 — 고래가 지나간 뒤 떨어진 비늘(FALLEN_SCALE · WORLD_EVENT 원천 · RoomNeverSame 확정 9). 새 세계 사실을 짓지 않는다.
    첫 Event 가 채집인 이유: 원문 §10 "Event 시스템은 전투 시스템이 아니다" 를 첫 사례에서 보인다
D4  기억의 항목 — 원천마다 캐인 횟수 누계 · 고갈된 횟수 · 마지막 고갈 시각 · 방마다 뒤척임 횟수 · 깨어난 횟수와 마지막 시각 · 지나간 것마다 횟수와 마지막 시각
    (Life 뒤 탄생 횟수). 원문 §2.8 의 예(lastBossDeath · totalDeaths · previousOwner)는 5층 · 뒤 층 — 자리는 같은 형이다
D5  뒤척임은 기억을 묻지 않는다 — 자국 · 발자국은 "뒤척임이 묻는 것" 이고 셈은 "지워지지 않는 것" 이다. 세계가 뒤척여도 일어난 일은 일어난 일이다.
    그래야 "과거의 플레이가 미래의 조건이 된다"(원문 §2.8) 가 성립한다
```

남는 빈칸

```text
[ ] 1  확률 — 두지 않는다 (L1 §3). 5층 이후가 난수 State 와 함께 들인다. 형의 chance 자리는 그때
[ ] 2  흩어진 조건 자리 넷을 Condition 형으로 **옮기는가 · 읽기만 하는가** — 첫 Cycle 의 spec (Access 빈칸 1 과 한 번에)
[ ] 3  Region 자체 성장의 첫 사례 — 둥지 → 군락(Life 의 개체군이 방의 standing 을 바꾼다)이 먼저 올 후보. Life 뒤
[x] 4  뒤척임이 기억을 묻는가 — **묻지 않는다** (D5 · Human 확정)
[x] 5  이 Play 가 놓는 미지 — **없음** (M4 를 깊게 한다 · Human 확정). 이름 있는 새 사실을 Human 이 주면 그때 바꾼다
[ ] 6  Object(레버 · 장치)와 Structure 의 State 가 처음 오는 자리 — 컨텐츠 행 (그 방의 퍼즐)
```

---

## 11. 다음

```text
첫 계약    [play/RoomRemembersAndOffers.md](play/RoomRemembersAndOffers.md) — 숲 가장자리에서 기억 · 조건 · 기회를 처음 데이터로 세우는 2층 Play (C034~C036 · 승인됨)
선행       RoomNeverSame(시계 · 경로 · 비늘 · 뒤척임) · RoomBearsMaterial(원천 · taken) · RoomAnswersWhenAsked(판) — 셋은 닫혀 있다
자리       Life · Access · Trail 과 **병행 가능** — 세계 State 에 history 하나가 늘고 STATE_VERSION 이 오르므로 PR 은 번호 순으로 합친다
이후       Life 가 서면 births 가 history 에 · Access 가 서면 Lock.requires 가 Condition 형에 · 3층이 오면 target: actor 와 Knowledge 군이 같은 형에 든다.
          Region 작성기 T2 열셋째 답 · T4 결정 나무 · T6 ㊻ 은 이 Play 의 마지막 Cycle 이 세운다
```
