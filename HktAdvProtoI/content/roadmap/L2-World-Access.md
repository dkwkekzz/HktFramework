# L2 — 세계의 요구와 가능성: Access 계약 (기반 층 2 · 세계 절반 ② 부속 넷째)

상태: **확정** (Human 원문 + 검토 반영 — "승인"). [L2-World-Region.md](L2-World-Region.md) 의 넷째 확장 계약이다 —
새로운 설계 층도, 별도 Gameplay 시스템도 만들지 않는다. [L2-World-Material.md](L2-World-Material.md) ·
[L2-World-Time.md](L2-World-Time.md) · [L2-World-Life.md](L2-World-Life.md) 와 같은 자리다.

2층의 여섯 기획은 세계를 **쓰는 문법**을 다 세웠다 — 공간 · 땅 · 규칙 · 재료 · 시간 · 생명. 그런데 L0 의 문장
"위험을 극복할 재료를 제공한다 · 세계가 재료를 **충분히** 제공해야 한다" ([L0-Game.md](L0-Game.md) §1) 는 아직
검사할 수 없다. 세계가 **무엇을 요구하는가**(협곡의 문: "체열이 감지된다")와 세계가 **무엇을 가졌는가**(열을 저장하는 결정)가
서로 다른 말로 적혀 있고, 둘을 잇는 것은 지금 사람의 손 하나뿐이기 때문이다. 이 문서는 그 구멍을 메운다:
*세계의 요구와 세계의 가능성을 같은 어휘로 적는다. 요구는 정답을 지목하지 않고, 하나의 요구에 여러 종류의 답이 올 자리를 남긴다.
그러면 "모든 요구에 답할 가능성이 세계 어딘가에 있는가" 를 기계가 센다.*

§1 이 Human 원문이고 §2 이후는 검토와 번역이다 — 원문을 이 저장소의 확정 문서 · 도구 · 지금 세계에 잇는다.
**세계 사실을 더하지 않았다** — 어휘 항목마다 근거 문서를 적었고, 근거가 없는 것은 §10 의 빈칸으로만 남긴다.
Human 이 언제든 뒤집는다.

```text
이 문서가 소유한다      세계가 요구하는 것(Lock · Requirement)의 종류와 자리 · 세계가 가진 것(Possibility)의 성질 어휘 ·
                      둘을 같은 말로 적는 규칙 · 하나의 요구에 여러 종류의 답이 올 자리 · 요구를 알아낼 흔적의 자리 ·
                      충분성과 가능성 밀도의 검사 · 2층에서 요구가 관찰되는 방식(현상을 보이되 답의 자리는 말하지 않는다)
이 문서가 바꾼다        Material §6.1 observableProperties — 문장은 그대로 두고 **어휘 태그**를 곁에 더한다.
                      Region §6 Soft/Hard Requirement 와 Time 2.4 ② Connector activation — 셋을 한 형(Lock)으로 읽는다.
                      Tool-Scale §1 고정 공식 · T2 · T4 — 작성기 질문 넷과 검사 아홉이 든다 (§5.4)
이 문서가 소유하지 않는다  가능성이 실제로 요구에 답하는 판정(몸이 추위를 버티는가 — 3층) · 가능성을 지니는 방식(소지 · 장비 · 동행 — 3 · 4층) ·
                      성질의 수치 · 조합 · 상쇄(4층) · 관찰자가 요구를 어디까지 이해하는가(3층) · 클래스와 지식이 가능성이 되는 방식(3 · 7층) ·
                      플레이어 사이의 가능성 공유(뒤 층)
```

---

## 1. 원문 (Human)

> 둘 다 권장대로 처리. 아래 내용을 보고 리뷰하고 동의하면 내용 개선해줘.

원문의 절 번호는 아래 그대로이고, 제목 수준만 이 문서에 맞게 낮췄다. 글자는 그대로다.

### L2-World-Access — 세계의 요구와 가능성

> 세계의 어떤 자리는 플레이어에게 특정한 **요구**를 가진다.
> 세계의 재료·생명·환경·지식·주체는 그 요구에 답할 수 있는 **성질과 가능성**을 가진다.
>
> 이 층은 정답을 정하지 않는다.
> **무엇이 요구되고, 세계 어디에 그것에 답할 가능성이 존재하는가**를 세계 사실로 세운다.

#### 1. 목적

게임의 핵심 경험은 다음 흐름이다.

```text
미지
→ 위험·이상 현상
→ 관찰
→ 이해
→ 가능성 탐색
→ 시도
→ 극복
→ 성장
→ 새로운 미지
```

세계에는 단순히 위험과 보상이 흩어져 있는 것이 아니라,

```text
어떤 곳은 무엇인가를 요구하고
세계 어딘가의 존재들은 그 요구에 답할 성질을 가진다.
```

이 관계가 존재해야 한다.
이 문서의 목적은 그 관계를 세계의 공통 문법으로 만드는 것이다.

#### 2. 핵심 개념

##### 2.1 Lock — 세계가 묻는 것

`Lock`은 특정 아이템을 요구하는 장치가 아니다.

> **그 장소·현상·Connector가 통과 또는 이용을 위해 요구하는 세계 조건**

이다.

예:

```text
FROST_DEPTH
requires:
  property: heat:hides
```

의 의미는

```text
HEAT_CRYSTAL을 가지고 와라
```

가 아니다.
의미는 오직

```text
이곳을 지나려면 체열 감지에 답할 방법이 필요하다.
```

이다.
따라서 규칙 코드는 특정 아이템·클래스·생명·축을 이름으로 알지 않는다.

##### 2.2 Possibility — 세계가 가진 답의 가능성

세계의 Seed는 자신이 가진 성질을 선언할 수 있다.

```text
MaterialSeed.properties
LifeSeed.properties
Environment.properties
...
```

예:

```text
FROST_CRYSTAL
  heat:absorbs
HEAT_CRYSTAL
  heat:stores
```

이 성질이 실제로 어떤 방식으로 이용되는지는 이 층이 결정하지 않는다.
이 층은 단지

> **세계에 이런 성질을 가진 것이 존재한다.**

까지를 소유한다.

##### 2.3 Lock과 Key는 1:1 관계가 아니다

내부 구현에서는 편의를 위해 `Lock`, `Key Property`라는 말을 사용할 수 있다.
그러나 세계 설계의 의미는 다음과 같다.

```text
World Problem
    ↓
Requirement
World Possibilities
    ↓
Properties
Player
    ↓
여러 가능성을 발견·선택·조합하여 Requirement에 답한다
```

따라서 다음 구조를 목표로 한다.

```text
하나의 Requirement
        ↓
여러 종류의 Possible Answer
```

예:

```text
FROST_DEPTH
Requirement:
  체열 감지를 피한다
가능한 답의 원천:
Material
  열을 저장한다
Life
  열을 먹는다
Environment
  특정 시간에는 감지력이 약해진다
Actor
  자신의 체열을 낮출 수 있다
Knowledge
  감지 기관을 우회하는 방법을 안다
Combination
  여러 성질을 결합한다
```

**중요한 Lock이 하나의 특정 Seed만을 정답으로 가지는 상태는 완성된 설계로 보지 않는다.**

#### 3. Access가 존재하는 자리

자물쇠는 새로운 장소를 만드는 것이 아니다.
기존 세계의 장소와 연결 위에 **의미를 매단다.**

```text
area
  → soft requirement
Connector.anchor
  → hard requirement
```

##### soft

조건을 만족하지 않아도 접근할 수 있으나 비용·위험·제약이 커진다.

예:

```text
혹한 지역
→ 체온을 해결하지 않아도 진입 가능
→ 오래 머물기 어렵다
```

##### hard

조건 없이는 해당 전이나 기능이 성립하지 않는다.

예:

```text
미로의 심장 문
→ 특정 상태가 아니면 Connector가 활성화되지 않는다
```

`soft / hard`는 **난이도 차이**가 아니라 세계가 플레이어에게 주는 가능성의 차이다.

#### 4. 파일

```text
content/regions/<id>.ts
  RegionSpec += access {
    locks
    silence
  }
content/regions/properties.ts
  PropertyVocabulary
  세계 전체가 공유하는 성질 어휘
content/regions/resource-ecology.ts
  MaterialSeed += properties
content/regions/graph.ts
  Connector와 Lock의 관계
```

필요해지면 동일한 PropertyVocabulary를 이후

```text
Material
Life
Actor
Environment
Item
Knowledge
```

가 공유한다.
`PropertyVocabulary`는 Region 전용 시스템이 아니다.

> **세계가 서로를 설명하기 위해 사용하는 공통 의미 어휘**

이다.

#### 5. PropertyVocabulary

Property는 메커니즘이나 수치를 정의하지 않는다.

예:

```text
heat:stores
heat:absorbs
heat:emits
heat:hides
light:emits
light:absorbs
flesh:stores
flesh:absorbs
space:fixes
```

이것은 다음과 같은 계산을 뜻하지 않는다.

```text
heat = 35
resistance = 50
duration = 30 sec
```

계산·강도·지속시간·조합식은 4층 이후의 책임이다.
2층에서 Property가 말하는 것은 오직

```text
무엇을 할 수 있는 성질인가
```

이다.

#### 6. 중요한 원칙 — 문제는 정답을 직접 지목하지 않는다

다음 형태는 피한다.

```text
FROST_DEPTH
requires:
  item: HEAT_CRYSTAL
```

대신:

```text
FROST_DEPTH
requires:
  heat:hides
```

세계 콘텐츠를 추가할 때 새로운 해법은 기존 Lock을 수정하지 않고 추가될 수 있어야 한다.

예:

```text
새로운 생물
THERMAL_LEECH
  heat:absorbs
```

또는

```text
새로운 요정 능력
COLD_BODY
  heat:hides
```

이 추가되면 기존 FROST_DEPTH에도 새로운 가능성이 생길 수 있다.
이것이 PropertyVocabulary를 세계 공통 어휘로 두는 가장 중요한 이유다.

#### 7. 발견과 판정의 분리

데이터의 Lock은 명확해야 한다.
그러나 플레이어가 처음부터 그 답을 알고 있어서는 안 된다.
따라서 다음을 구분한다.

```text
World Truth
≠
Player Observation
≠
Actor Knowledge
```

실제 세계 사실:

```text
FROST_DEPTH
requires heat:hides
```

첫 관찰:

```text
"문 가까이 가자 몸에서 피어오르는 김이 푸르게 빛난다."
```

추가 관찰:

```text
"차가운 물체는 반응하지 않는다."
```

지식 획득 후:

```text
"문은 살아 있는 것을 보는 것이 아니라 체열을 감지한다."
```

충분한 이해 후:

```text
"체열을 감출 수 있다면 통과할 가능성이 있다."
```

2층은 **World Truth와 관찰 가능한 단서가 존재할 자리**까지 만든다.
관찰자가 어느 수준까지 이해하는지는 3층의 책임이다.

#### 8. 실패 역시 세계를 알려야 한다

Access는 단순한

```text
성공 / 실패
```

판정으로 끝나서는 안 된다.
플레이어의 시도가 실패했을 때도 세계에 대한 새로운 관찰이 가능해야 한다.

예:

```text
횃불을 들고 접근
→ 감지 반응이 더 강해진다
빙정석을 몸에 붙임
→ 감지는 약해지지만 몸이 급격히 식는다
열을 저장하는 결정 사용
→ 감지가 거의 사라진다
```

2층은 실제 피해량·지속시간·효과를 계산하지 않는다.
그러나 이후 층이 다음 플레이를 만들 수 있도록

```text
Property가 Requirement에
SUPPORTS
OPPOSES
REVEALS
```

와 같은 관계를 형성할 수 있는 의미 공간을 남긴다.

핵심은 다음이다.

> 실패가 단순한 거절이 아니라
> **세계의 규칙에 대한 추가 정보가 될 수 있어야 한다.**

#### 9. 성장과 Access

이 문서는 클래스나 성장 시스템을 결정하지 않는다.
다만 성장의 세계적 의미 하나를 제공한다.

```text
성장
→ 이전보다 더 많은 세계의 요구에 답할 가능성을 가진다.
```

이를 단순히

```text
보유한 Key의 수 증가
```

로 해석하지 않는다.
향후 성장에서는 다음이 모두 가능하다.

```text
알아볼 수 있는 Requirement가 늘어난다
사용할 수 있는 Property가 늘어난다
같은 Property를 다루는 방법이 늘어난다
여러 Property를 결합할 수 있다
기존 Property를 다른 목적으로 사용할 수 있다
```

따라서 Access는 성장의 결과인

> **이전에는 접근할 수 없었던 가능성에 접근한다**

를 세계 상태로 표현하는 기반이다.

#### 10. MMORPG에서의 의미

세계의 Requirement와 Possibility는 한 플레이어 안에서만 닫힐 필요가 없다.

예:

```text
플레이어 A
  열 성질을 다룰 수 있음
플레이어 B
  공간 성질을 다룰 수 있음
플레이어 C
  생물의 감지 원리를 알고 있음
플레이어 D
  필요한 Material의 원천을 발견함
```

하나의 문제를 해결하기 위해

```text
발견
정보
채집
제작
능력
운반
거래
협력
```

이 서로 다른 플레이어에게 분산될 수 있다.
따라서 **Requirement와 그에 답하는 Possibility의 원천이 서로 다른 Region에 존재하는 것**은 단순한 이동거리 설계가 아니다.

향후

```text
탐험
전문화
거래
정보 가치
파티 플레이
지역 경제
```

가 생길 수 있는 세계적 전제가 된다.
2층은 이것을 강제하지 않는다.
다만 세계가 한 플레이어의 단일 정답만으로 닫히지 않도록 가능성을 보존한다.

#### 11. 도구가 검사할 것

기존 참조 무결성 검사는 유지한다.

```text
㉞ Property 참조 무결성
㉟ Requirement를 만족할 가능성이 세계 어딘가에 존재하는가
㊱ Property 축 편중
㊲ Lock과 가능성의 Region 분포
㊳ 고아 Property
```

여기에 **가능성 밀도**를 관찰한다.

##### ㊴ Possible Answer Count

중요한 Requirement마다 서로 다른 답의 원천이 몇 종류 존재하는지 보고한다.

```text
FROST_DEPTH / heat:hides
Material       1
Life           1
Environment    1
Actor          0
Knowledge      0
Combination    unknown
```

이 검사는 최소 개수를 강제하지 않는다.
다만

```text
중요 Lock
Possible Answer = 1
```

인 경우 사람이 즉시 볼 수 있어야 한다.

##### ㊵ Source Diversity

가능한 답이 실제로 같은 종류의 복제인지 검사한다.
다음은 숫자가 셋이어도 사실상 한 답이다.

```text
Heat Crystal A
Heat Crystal B
Heat Crystal C
```

다음은 서로 다른 가능성이다.

```text
Material
Life
Environment
Actor Capability
Knowledge
```

##### ㊶ Discovery Support

Requirement를 알아낼 세계적 단서가 존재하는지 보고한다.

```text
visual clue
material clue
life clue
environment clue
historical clue
```

Lock은 있는데 어떤 관찰로도 그것의 원인을 알 수 없다면 `GAP`이다.

##### ㊷ New Possibility Reach

Requirement를 해결했을 때 무엇이 새롭게 닿는지 보고한다.

```text
new Region
new Material
new Life
new Connector
new Observation
```

단순히 문 하나가 열리고 끝나는 구조를 발견하기 위한 보고다.

#### 12. 작성기의 고정 질문

Region 작성기는 기존 질문에 다음을 추가한다.

```text
아홉째 —
이 방은 플레이어에게 무엇을 묻는가?
없으면 없다고 적는다.
열째 —
이 방과 세계에 존재하는 것들은
어떤 Requirement에 답할 성질을 가지는가?
열한째 —
중요한 Requirement에는
서로 다른 원천의 답이 존재할 여지가 있는가?
열두째 —
플레이어가 그 Requirement를 알아낼
관찰 가능한 흔적은 무엇인가?
```

이를 통해 도구가 방 백 개를 만들었는데

```text
열쇠 없는 문 백 개
```

또는

```text
문마다 전용 열쇠 하나
```

가 생기는 것을 막는다.

#### 13. 등급 판정

##### A

세계 어휘 안에서 Requirement와 Possibility를 표현할 수 있다.
중요한 Requirement의 경우 복수 해결 가능성이 존재하거나 자연스럽게 확장될 수 있다.
관찰 가능한 단서가 있다.

##### B

기존 어휘로 표현되지만 아직 해당 Possibility의 원천이 배치되지 않았다.

```text
GAP
Missing:
  해당 Property를 가진 Seed 또는 세계 요소
Return To:
  Content Layer
```

##### C

기존 PropertyVocabulary로 표현할 수 없는 새로운 종류의 세계 요구다.
새로운 축 또는 관계에 대한 Human 판단이 필요하다.

#### 14. 지금 세계에 적용

##### 14.1 현재 Lock

| 자리                | 강도          | Requirement                               | 비고                     |
| ----------------- | ----------- | ----------------------------------------- | ---------------------- |
| `MAZE_HEART_GATE` | hard        | state: 미로 패턴 P2                           | 기존 Connector 상태        |
| 숲의 긴 밤 문          | hard        | time: LONG_NIGHT                          | 시간 조건                  |
| `FROST_DEPTH`     | hard + soft | time: LONG_NIGHT + property: `heat:hides` | 첫 Property Requirement |

다음은 Lock이 아니다.

```text
눈보라
절벽
결정면
추락
물길
미구현 Region 경계
안전 조건
```

위험과 Access Requirement를 구분한다.

##### 14.2 현재 Possibility

| Seed                | 성질                                             |
| ------------------- | ---------------------------------------------- |
| `BIO_ORE`           | `flesh:stores`, `light:emits`                  |
| `ORE_EATER_MOLT`    | `light:emits`                                  |
| `GIANT_TREE_FUNGUS` | `flesh:absorbs`, `light:absorbs`               |
| `FROST_CRYSTAL`     | `heat:absorbs`, `light:emits`, `heat:grows-on` |
| `HEAT_CRYSTAL`      | `heat:stores`                                  |
| `SPATIAL_CRYSTAL`   | `space:fixes`                                  |
| `WHALE_SCALE`       | 미정                                             |

`HEAT_CRYSTAL`은 아직 세계에 원천이 없다.
따라서 현재 검사는 다음을 보고한다.

```text
FROST_DEPTH
requires heat:hides
Known Possible Answer:
  HEAT_CRYSTAL / heat:stores
Source:
  MISSING
Result:
  GAP
```

#### 15. FROST_DEPTH를 하나의 정답으로 닫지 않는다

첫 구현에서 `HEAT_CRYSTAL`은 가능한 답 하나가 될 수 있다.
그러나 세계 계약은 다음 확장을 허용해야 한다.

```text
FROST_DEPTH
requires:
  heat:hides
Possible Answers
Material
  HEAT_CRYSTAL
Life
  체열을 먹는 생물 또는 기관
Environment
  특정 시간·기후에서 감지 약화
Actor
  체열 억제 능력
Knowledge
  감지 영역 또는 감지 기관 우회
Combination
  열 흡수 + 보온
  다른 존재를 Carrier로 사용
```

이 중 무엇을 실제 게임에 넣을지는 이후 Play가 결정한다.
2층은 **다른 답이 들어올 자리를 닫지 않는 것**을 책임진다.

#### 16. L0 판단 기준

##### 어떤 위험을 주는가

이 문서는 위험을 새로 만들지 않는다.
Lock은 위험 또는 세계 현상이 플레이어에게 **무엇을 요구하는가**를 표현할 뿐이다.

##### 극복할 재료를 어디에 두는가

Requirement에 답할 성질은 세계 어딘가에 존재할 수 있어야 한다.
그러나 하나의 Requirement를 하나의 재료에 고정하지 않는다.
가능한 답은

```text
Material
Life
Environment
Knowledge
Actor
Combination
```

어디에서든 올 수 있다.

##### 요정은 무엇으로 자라는가

구체적인 성장 방식을 결정하지 않는다.
다만 성장 결과를 다음과 같이 세계 사실로 표현할 수 있게 한다.

> 이전보다 더 많은 세계의 Requirement에 답할 수 있게 된다.

##### Core Breath의 어디인가

```text
위험
→ 관찰
→ 이해
→ 가능성 탐색
→ 시도
→ 극복
→ 성장
→ 새로운 미지
```

2층은

```text
무엇이 요구되는가
무엇이 세계에 존재하는가
어떤 흔적을 관찰할 수 있는가
어떤 새로운 가능성이 뒤에 있는가
```

를 세계 사실로 세운다.

#### 17. 미증명 넷과의 관계

##### ① 재방문해도 재미있는가

부분적으로 기여한다.

```text
첫 방문
→ 해결하지 못한 Requirement 발견
성장·발견 이후
→ 과거 장소가 새로운 가능성이 된다
```

직접적인 반복 변화는 Time·Life의 몫이다.

##### ② 여럿이어야 하는 이유

가능성의 원천이 서로 다른 지역·주체·전문성에 분포될 수 있게 한다.
이것이 향후

```text
정보 교환
거래
분업
협력
```

의 세계적 근거가 된다.

##### ③ 성장 선택의 애착과 고민

이 문서가 가장 크게 기여하는 부분이다.
세계가

```text
무엇을 요구하는가
```

와

```text
어떤 종류의 답들이 존재할 수 있는가
```

를 분리함으로써 플레이어에게 선택할 대상이 생긴다.
고민 자체는 이후 성장·아이템·지식 시스템이 만든다.

##### ④ 발견 뒤에도 살아 움직이는가

직접 다루지 않는다.
Time·Life의 책임이다.

#### 18. 남는 UNRESOLVED

```text
· knowledge Requirement의 실제 판정 — 3층
· Player가 Lock의 진실을 얼마나 아는가 — 3층
· Property의 강도·수치·지속시간 — 4층
· 여러 Property의 조합과 상쇄 — 4층
· Seed를 소지·장비·섭취·동행한다는 의미 — 3·4층
· 요정 자체가 Possibility가 되는 성장 — 7층
· 위험이 발생하고 강화되는 법칙 — 위험 계약
· 플레이어 간 Possibility 공유 방식 — 이후 사회·경제 시스템
```

#### 19. 첫 Play — RoomAsksForPossibilities

기존 `RoomAsksForAKey`를 다음처럼 확장한다.

```text
이름
  RoomAsksForPossibilities
목적
  하나의 방이 특정 아이템이 아니라
  세계의 성질을 요구할 수 있음을 증명한다.
상황
  관찰자가 FROST_DEPTH를 발견한다.
  처음에는 들어가지 못한다.
  관찰을 통해
  "무언가가 체열에 반응한다"
  는 흔적을 확인한다.
  세계 어딘가에서
  이에 답할 수 있는 성질을 발견한다.
  그것이 정답 아이템이 아니라
  여러 가능한 답 중 하나임을 세계 데이터가 증명한다.
```

##### Cycle 1 — Requirement

```text
PropertyVocabulary
FROST_DEPTH Lock
  requires heat:hides
관찰 시
  Requirement의 직접 이름이 아니라
  세계적 현상을 보여준다.
검사 ㉞~㊷
HEAT_CRYSTAL 원천이 없으므로
GAP을 보고한다.
```

##### Cycle 2 — 첫 Possibility

```text
HEAT_CRYSTAL
  heat:stores
세계 원천 하나 배치
FROST_DEPTH와 연결 가능한
첫 Material Possibility가 생긴다.
㉟ 통과
㊴ Possible Answer Count = 1
```

##### Cycle 3 — 다른 종류의 Possibility

Material과 다른 원천 하나를 추가한다.

예:

```text
Life
  체열을 흡수하는 생물
또는
Environment
  LONG_NIGHT 동안 감지 약화
```

검사:

```text
Possible Answer Count >= 2
Source Diversity >= 2
```

##### 이후 Play

최소 하나의 중요한 Requirement에 대해

```text
Material
Life
Environment
Actor / Knowledge
```

중 **서로 다른 세 계통의 해결 가능성**이 실제 플레이에서 성립하는지 검증한다.

이것이 성공하면 Access 시스템은

```text
열쇠를 찾아 문을 여는 시스템
```

이 아니라

> **세계를 이해하고, 세계가 가진 여러 가능성 중 자신의 해결법을 찾아내는 탐험 시스템**

으로 증명된다.

#### 20. 최종 원칙

```text
Lock은 정답을 요구하지 않는다.
Lock은 세계의 조건을 말한다.
Property는 특정 Lock의 열쇠가 아니다.
세계 존재가 가진 성질이다.
하나의 중요한 Requirement에는
여러 종류의 가능성이 답할 수 있어야 한다.
플레이어는 답을 지급받지 않는다.
관찰하고 이해하여 가능성을 발견한다.
실패도 세계를 이해하게 해야 한다.
성장은 Key 수집이 아니라
세계에 답할 수 있는 가능성의 확장이다.
Access의 목적은 길을 막는 것이 아니라
플레이어가 세계를 다시 이해하게 만드는 것이다.
```

> 원문은 채팅에서 왔다 — 제목 수준만 낮췄고 글자는 그대로다. 절 번호(1~20)와 검사 번호(㉞~㊷)도 원문 그대로다.

---

## 2. 검토 — 동의하는 것과 고친 것

원문은 앞선 초안("열쇠와 자물쇠")의 방향을 **한 단계 위로** 올렸다. 초안은 "자물쇠는 성질을 묻고 열쇠는 성질을 가진다" 까지였고,
원문은 거기에 넷을 더했다 — 하나의 요구에 **여러 종류**의 답 · 요구를 알아낼 **흔적**의 자리 · 실패가 **정보**가 되는 관계 ·
답의 원천이 여러 플레이어에게 **분산**될 수 있다는 전제. 넷 다 L0 의 "성장과 조합의 재미" 에 초안보다 가깝다 — 초안은
"열쇠를 찾아 문을 연다" 로 읽힐 위험이 있었고, 원문 §6 · §15 · §20 이 그것을 막는다. **방향에 동의한다.** 아래는 번역하며 고친 넷이다.

```text
① 등급 B 의 뜻          원문 §13 의 B("어휘로 표현되나 원천이 없다")는 Tool-Scale §2 의 B("그 지역만의 Region Rule 하나가 필요하다") 와 글자가 겹친다.
                       두 B 는 다른 축이다 — Tool-Scale 의 A/B/C 는 "새 규칙 · 새 축이 필요한가" 를 가르고, 원문의 B 는 "답이 아직 배치되지 않았다" 는
                       **상태**다. 등급 글자를 겹쳐 쓰지 않는다: 원문의 B 는 어느 등급에서든 붙을 수 있는 **GAP** 으로 둔다 (§5.4).
                       원문의 A · C 는 Tool-Scale 의 A · C 와 뜻이 같다
② Cycle 3 의 "다른 종류"   원문 §19 Cycle 3 의 예("체열을 흡수하는 생물" · "LONG_NIGHT 동안 감지 약화")는 둘 다 **새 세계 사실**이다 — 확정 문서에 없다.
                       특히 둘째는 FROST_DEPTH 의 문이 긴 밤에만 열린다는 확정(RoomOfAnotherKind §5.3)과 겹쳐 time 조건과 구분이 사라진다.
                       기존 사실에서 나오는 후보로 바꿔 위임 결정으로 둔다 — 눈보라(협곡에 이미 있다 · 관찰 범위를 절반으로 — 확정 6)가
                       **감지도** 약하게 한다는 Environment 가능성 (§10 D3). 생물은 3층 뒤로 미룬다
③ Actor · Knowledge     원문 §2.3 · §15 의 가능성 원천 여섯 중 Actor · Knowledge · Combination 은 3 · 4 · 7층의 것이다. 2층은 **자리만** 둔다 —
                       ㊴ 의 표에 그 열이 있고 값이 0 인 채로 서는 것까지가 2층이다. Life 는 2층에 개체군 값이 있으므로(Life F14) LifeSeed.properties 가 설 수 있다
④ SUPPORTS·OPPOSES·REVEALS  원문 §8 의 관계 셋을 별도 구조로 두지 않고 **어휘 표의 짝 열**로 흡수한다 — 초안의 pairsWith(짝) 가 SUPPORTS 였고,
                       거기에 OPPOSES(더 나쁘게 한다 — 횃불의 heat:emits) 와 REVEALS(요구를 드러낸다 — 빙정석의 heat:absorbs 가 "감지가 약해진다" 를 보인다)를
                       더한다. 2층에서 판정되는 것은 없다 — 관계는 데이터이고, 3 · 4층이 읽는다 (§4.1)
```

원문이 초안에서 **덜어 낸** 것도 있다 — 자족적 기획서 형식(문제 · 목표 · 계약 항목 · 12단계 · 검증 묶음 · 작업 지시 · 완료 조건)이다.
그 가운데 Play 와 Cycle 이 실제로 쓰는 것(데이터 계약 · 검사 · 작성 양식 · 완료 조건)만 §4 · §6 · §7 에 짧게 되살렸다.

---

## 3. 이 계약이 확정한 것

확정 항목은 **K**(Key·Lock — 원문 §2.3 이 "내부 구현의 말" 로 허용했다). Concept 의 W · Region 의 R · Material 의 S · Time 의 T ·
Life 의 F 와 같은 자리의 이름공간이다.

| # | 확정 | 원문 |
|---|---|---|
| **K1** | Lock 은 세계 사실이다 — 특정 아이템을 요구하는 장치가 아니라 그 자리 · 현상 · Connector 가 요구하는 **세계 조건**. 위험이 요구하는 형태이지 위험과 별개의 장치가 아니다 | §2.1 · §16 |
| **K2** | Lock 이 요구하는 것은 넷 — property · time · state · knowledge. 새로 더한 것은 property 하나이고 time · state 는 이미 있던 활성 조건 둘을 한 형으로 읽은 것, knowledge 는 자리만 | §14.1 · §18 |
| **K3** | Lock 은 정답을 지목하지 않는다 — `requires: item` 이 아니라 `requires: property`. 새 해법은 기존 Lock 을 고치지 않고 더해진다 | §6 |
| **K4** | Possibility 는 세계 존재가 가진 **성질**이다 — 특정 Lock 의 열쇠가 아니다. 2층의 Possibility 는 Material Seed(그리고 개체군 값이 있는 LifeSeed)의 properties 이고, Environment · Actor · Knowledge · Combination 은 자리만 | §2.2 · §15 |
| **K5** | 요구와 가능성은 하나의 **PropertyVocabulary**(축:관계)로 적힌다. 세계 공통 어휘이고 Region 전용이 아니다. 컨텐츠 데이터이며 규칙 코드는 그 글자를 모른다 (R13 의 확장) | §4 · §5 |
| **K6** | Property 는 수치 · 메커니즘 · 조합식이 아니다 — "무엇을 할 수 있는 성질인가" 까지다 | §5 |
| **K7** | 태그는 문장의 색인이다 — observableProperties 의 문장에 없는 성질을 태그가 말하지 않는다 (초안에서 유지) | — |
| **K8** | **하나의 중요한 Requirement 에는 여러 종류의 답이 올 자리가 있다.** 중요 Lock 이 특정 Seed 하나만을 정답으로 가지는 상태는 완성이 아니다 — 종류(Material · Life · Environment · Actor · Knowledge · Combination)가 다른 것이 다양성이지 같은 종류의 복제가 아니다 | §2.3 · §15 · ㊴ ㊵ |
| **K9** | 묻는 것마다 답할 가능성이 있다 — 모든 property Lock 에 그것을 지나지 않고 닿는 Possibility 의 원천이 하나 이상 (검사 ㉟). 없으면 GAP 이다 | §11 · §14.2 |
| **K10** | 발견과 판정은 분리된다 — World Truth ≠ Player Observation ≠ Actor Knowledge. 2층은 World Truth 와 **관찰 가능한 단서가 설 자리**까지 만들고, 관찰자가 어디까지 이해하는가는 3층. Lock 마다 그것을 알아낼 흔적이 하나 이상 있어야 한다 (검사 ㊶) | §7 · ㊶ |
| **K11** | 실패도 세계를 알린다 — Property 가 Requirement 에 대해 SUPPORTS · OPPOSES · REVEALS 관계를 가질 수 있는 의미 공간을 남긴다. 2층에서 판정하지 않는다 — 어휘 표의 짝 열이 그 자리다 | §8 |
| **K12** | 2층은 요구를 세우고 · 가능성을 세고 · 현상을 보인다. property · knowledge Lock 을 **판정하지 않는다** — 몸(3층) · 소지(4층) · 지식(3층)이 온 뒤의 일이다. time · state 는 지금처럼 판정한다 | §2.2 · §18 |
| **K13** | 요구와 답의 원천이 다른 Region · 다른 주체에 분포되는 것을 세계가 막지 않는다 — 강제하지 않되 보존한다. 분업 · 거래 · 협력의 세계 쪽 전제 | §10 |
| **K14** | 성장은 Key 의 수가 아니라 **답할 수 있는 요구의 확장**이다. 이 층은 그 단위(답할 수 있는 Lock 의 집합)만 넘긴다 | §9 |
| **K15** | Access 의 목적은 길을 막는 것이 아니라 세계를 다시 이해하게 하는 것이다 — 문 하나가 열리고 끝나는 구조는 보고한다 (검사 ㊷) | §20 · ㊷ |

그리고 **검사 ㉞~㊷**(§11) · **작성기 질문 넷**(§12) · **첫 Play RoomAsksForPossibilities 와 Cycle 셋**(§19)이 확정 대상이다.

### 3.1 이 계약이 2층에서 성립하는 범위

```text
2층이 세운다   어휘 · Lock 의 자리와 요구 · Material/Life Seed 의 성질 · Lock 을 알아낼 흔적의 자리 · 충분성과 밀도의 검사 ·
              지목했을 때의 대답(현상) · time · state Lock 의 판정(이미 있던 것) · Environment 가능성 중 이미 있는 것(철 · area 덧씌움)
3층이 받는다   property Lock 을 몸이 답하는 것 · knowledge Lock 의 판정 · Actor 가능성(체열 억제 같은 능력) · 관찰자가 요구를 어디까지 이해하는가 ·
              Life 가능성이 걸어 다니는 것(2층은 개체군 값과 그 성질까지)
4층이 받는다   가능성을 지니는 것(소지 · 장비 · 섭취 · 동행) · 물건이 재료의 성질을 물려받는 것 · 성질의 수치 · 조합과 상쇄 · SUPPORTS/OPPOSES 의 실제 효과
7층이 받는다   클래스 · 요정 자체가 가능성이 되는 성장
뒤 층          플레이어 사이의 가능성 공유(정보 · 거래 · 협력)
```

Material §2.1 이 "4층의 앞 절반(무엇이 어디서 나는가)" 을 2층으로 가져왔듯, 이 계약은 **3 · 4층의 앞 절반(무엇이 무엇을 요구하고
무엇이 그것에 답할 수 있는가)** 을 2층으로 가져온다. 뒤 층은 "어떻게 지니고 어떻게 답하는가" 만 정한다.

---

## 4. 데이터 계약 (의미 계약 — 타입과 파일 배치는 구현이 정한다)

원문 §4 의 파일 자리 그대로다. 새 layer 는 없다 — Lock 은 이미 있는 `area` · `anchor` 에, Possibility 는 Seed 에 매달린다.

### 4.1 PropertyVocabulary — 세계 공통 어휘

```yaml
PropertyVocabulary:                 # content/regions/properties.ts — 세계 전체 하나. Region 전용이 아니다 (K5)
  aspects:
    - { id: heat,      meaning: 열 · 체온 · 추위,            basis: "Concept §6 · Region §4.2 · §12 · RoomOfAnotherKind 확정 2·3" }
    - { id: light,     meaning: 빛 · 색 · 어둠,              basis: "Time 2.2 · RoomOfAnotherKind 확정 3 · RoomBearsMaterial D2" }
    - { id: vibration, meaning: 진동 · 소리 · 정지,           basis: "Concept §11 맹목의 사냥꾼 · §12 침묵의 계곡 · Time 2.6" }
    - { id: space,     meaning: 공간 연결 · 전이 목적지,       basis: "Region §12 · §16 FIX_TRANSITION_DESTINATION · Concept §5 현상" }
    - { id: flesh,     meaning: 살아 있는 것의 몸 — 결정화 · 붙음 · 안에 쌓임,  basis: "Concept §5 물질 · D2 · Life F7" }
  relations:
    - { id: absorbs,  meaning: 먹는다 (줄인다),   basis: "RoomOfAnotherKind 확정 3" }
    - { id: stores,   meaning: 담아 둔다,         basis: "Region §12 열을 저장하는 결정" }
    - { id: emits,    meaning: 낸다,              basis: "RoomOfAnotherKind 확정 3 · D2" }
    - { id: senses,   meaning: 감지한다,          basis: "Region §4.2 · Concept §11" }
    - { id: hides,    meaning: 숨긴다,            basis: "Concept §11 움직이지 않으면 찾지 못한다" }
    - { id: grows-on, meaning: 닿으면 자란다,      basis: "RoomOfAnotherKind 확정 3" }
    - { id: fixes,    meaning: 고정한다,          basis: "Region §12 · §16" }
  answers:                          # 원문 §8 의 관계 셋 — Requirement 에 대해 Property 가 하는 일 (K11). 데이터이고 2층은 판정하지 않는다
    - { requirement: "heat:hides",  property: "heat:stores",  kind: SUPPORTS, basis: "Region §12 열 저장 결정 → 체온 유지" }
    - { requirement: "heat:hides",  property: "heat:absorbs", kind: SUPPORTS, note: "감지는 약해지되 몸이 식는다 — 비용은 4층", basis: "원문 §8" }
    - { requirement: "heat:hides",  property: "heat:emits",   kind: OPPOSES,  basis: "원문 §8 횃불" }
    - { requirement: "heat:hides",  property: "heat:absorbs", kind: REVEALS,  basis: "원문 §7 차가운 물체는 반응하지 않는다" }
    - { requirement: "heat:absorbs", property: "heat:stores", kind: SUPPORTS, basis: "혹한 area — Region §6.1 소프트 예시" }
```

`[ ] 확정 D1` 축 다섯 · 관계 일곱은 Human 이 "이대로" 로 확정했다 (§10). 새 항목은 근거 절과 함께만 더한다 — 근거 없는 성질은 어휘가 아니라 빈칸이다.
`answers` 는 원문 §8 이 남긴 의미 공간이고, 위 다섯 줄은 원문과 확정 문서에서 나온 것만이다.

### 4.2 Possibility — Seed 의 성질

```yaml
WorldMaterialSeed += properties:    # 재료 계약 §6.1 의 확장. observableProperties 의 문장은 그대로
  properties:
    - { tag: "heat:absorbs", from: behavior }        # 다섯 항 중 어느 문장에서 나왔는가 (K7)

LifeSeed += properties:             # Life 계약 §3.2 의 확장 — 개체군 값이 있는 생명의 성질. 걸어 다니는 것은 3층
  properties: [...]
```

### 4.3 Lock — Requirement

```yaml
Lock:
  id: LOCK_ID
  at: { kind: area | connector, ref: AREA_TAG | CONNECTOR_ID }   # 원문 §3 — 실제로 있는 자리
  strength: soft | hard                                          # area 면 soft 기본 · connector 면 hard 기본
  requires:                            # 하나 이상. 전부 참이어야 열린다 (K2)
    - { property: "heat:hides" }       # 2층: 현상만 보이고 판정 없음 (K12)
    - { time: { season: LONG_NIGHT } } # 2층 판정 — 철별 활성 조건(Time W26)이 여기로 온다
    - { state: { region: REGION_ID, patterns: [PATTERN] } }      # 2층 판정 — CONNECTOR_ACTIVATIONS 가 여기로 온다
    - { knowledge: KNOWLEDGE_ID }      # 3층 — 자리만
  important: true | false              # ㊴ ㊵ 가 "중요 Lock" 만 세게 본다. 무엇이 중요한가는 그 Region 의 Play 가 적는다
  traces: [TRACE_ID]                   # 원문 §7 — 이 요구를 알아낼 흔적. 하나 이상 (K10 · ㊶). trace layer 의 op 다
  relaxedBy:                           # Environment 가능성 — 어떤 area · 철 안에서는 요구가 약해지는가 (원문 §15 Environment · D3)
    - { area: AREA_TAG } | { season: SEASON } | { dayPhase: NIGHT }
  reason: ASKS_CODE                    # 지목했을 때 판이 말하는 사유 코드 — **현상**을 말한다 ("김이 푸르게 빛난다"), 요구의 이름을 말하지 않는다
```

### 4.4 RegionSpec 확장

```yaml
RegionSpec += access:
  locks: [Lock]                        # 없으면 빈 목록 — "묻지 않는다" (원문 §12 아홉째)
  silence: 왜 묻지 않는가 (선택)         # 백왕령 — 안전 조건이 있어서
```

Lock 은 State 가 아니다 — 컨텐츠 데이터다. 열렸는가(time · state)는 지금처럼 Region State 와 세계 시계에서 매 tick 유도된다.
property · knowledge 의 답은 2층에 없다 — 뒤 층이 주체의 State(소지 · 몸 · 지식)에서 유도한다.

### 4.5 Answer Map — 도구가 채운다

```yaml
AnswerMap:                             # world:check 의 산출. 사람이 적지 않는다
  - lock: LOCK_ID
    requirement: "heat:hides"
    answers:
      - { kind: Material,    id: HEAT_CRYSTAL, property: "heat:stores", sourceRegions: [...], reachableWithoutLock: true|false }
      - { kind: Life,        ... }
      - { kind: Environment, relaxedBy: ... }
      - { kind: Actor,       count: 0 }      # 3층 전에는 0
      - { kind: Knowledge,   count: 0 }
      - { kind: Combination, count: unknown }
    reach: { regions: [...], sources: [...], lives: [...], connectors: [...] }   # ㊷ — 이 Lock 뒤에만 있는 것
```

기존 둘(`CONNECTOR_ACTIVATIONS` · `phases.connectorActivation`)을 Lock 형으로 옮길지는 첫 Cycle 의 spec 이 정한다 (§10 빈칸 1).

---

## 5. 도구에 주는 변화

### 5.1 layer · 파일

새 layer 는 없다. 파일은 원문 §4 그대로 — `properties.ts` 는 Region 파일 밖에 세계 전체 하나 (materials.ts · lives.ts 와 같은 자리).
규칙 코드는 **어떤 축도 어떤 Lock 도 이름으로 알지 못한다** — R13 이 방과 Connector 에, Material 이 재료에, Life 가 생명에 대해 말한 것이
여기에도 그대로 성립한다.

### 5.2 도구가 새로 검사하는 것 — ㉞~㊷

원문 §11 그대로다. 성질은 둘로 갈린다.

```text
참조 무결성 (통과/실패 · GAP)
  ㉞ Lock.requires 와 Seed.properties 가 어휘에 있는가 · at.ref 와 traces 가 실제 자리인가 · 태그가 문장 하나를 가리키는가
  ㉟ 모든 property Lock 에 SUPPORTS 관계의 성질을 가진 Seed 가 있고, 그 원천이 civil 에서 그 Lock 을 지나지 않고 닿는 Region 에 하나 이상 있는가 — 없으면 GAP
  ㊶ 모든 Lock 에 traces 가 하나 이상 있고 그 흔적이 그 Lock 의 Region(또는 이웃)에 실제로 놓였는가 — 없으면 GAP
분포 요약 (판정 없음 — 사람이 본다)
  ㊱ 성질 하나가 답하는 Lock 의 수 · 축별 편중
  ㊲ Lock 의 Region 과 답 원천의 Region 이 같은 비율 · depth 관계
  ㊳ 어느 Lock 도 요구하지 않는 성질 · 어느 Seed 도 가지지 않은 성질 (고아 어휘)
  ㊴ 중요 Lock 마다 답의 종류별 수 (Material · Life · Environment · Actor · Knowledge · Combination) — = 1 이면 눈에 띄게
  ㊵ 답이 같은 종류의 복제인가 — 종류가 다른 답의 수
  ㊷ Lock 뒤에만 있는 것(Region · Source · Life · Connector · 관찰) — 비어 있으면 "문 하나로 끝나는 구조"
```

㉟ 은 검사 ⑧(civil 에서 모든 Region 에 닿는가)의 그래프 탐색에 Lock 을 벽으로 놓고 다시 도는 것이고, ㊷ 은 그 반대편(벽 뒤에 남는 것)이다 —
새 기구가 아니라 `reachableRegions` 의 재사용이다. ㊴ 의 Actor · Knowledge 열은 3층 전에는 0 으로 선다 — 그것이 정상이고, 열이 있다는 것이 2층의 약속이다.

### 5.3 관찰 도구

`world:observe --report` 에 **열쇠 × 자물쇠 표**(Answer Map 을 사람이 읽는 형) 하나 — 행이 Lock, 열이 답의 종류, 칸이 답과 그 원천의 Region.
Region §2.1 ③ "보고를 사람이 읽는 것" 의 한 답이다.

### 5.4 도구 절반 2단계에 주는 변화 — Region 작성기가 요구와 가능성을 안다

Life §3.5 가 한 것과 같다. 원문 §12 · §13 을 Tool-Scale 에 얹는다.

```text
§1 고정 공식     재료 계약 표 다섯 · 철 덧씌움 넷 · 생명 계약 · **접근 계약(Lock · 성질 · 흔적 · 답의 종류)** · 검사 ①~㊷
§2 등급         A · C 는 원문 §13 과 Tool-Scale §2 가 같다. 원문의 "B"(어휘로 표현되나 원천이 없다)는 등급이 아니라 **GAP** —
                어느 등급에서든 붙는다 (§2 검토 ①). GAP 형식: Required 그 성질의 답 · Missing 그 성질을 가진 Seed 또는 세계 요소 ·
                Reason 원천 없음 · Return To 컨텐츠 층(그 답을 놓을 행)
T2 질문 넷      Concept §17 의 일곱 + Life 의 여덟째 + 원문 §12 의 **아홉째 ~ 열두째**(무엇을 묻는가 · 무엇이 답할 성질을 가지는가 ·
                다른 종류의 답이 올 여지가 있는가 · 알아낼 흔적은 무엇인가)
T4 계약 목록     요구가 어휘에 없는 축을 부르면 C. 어휘에 있으나 답이 없으면 GAP. 중요 Lock 인데 답이 한 종류뿐이면 **경고**(판정 아님 — ㊴)
T6 편중 요약     ⑲ ⑳ ㉒ ㉕ ㉖ ㉚ ㉝ 에 ㊱~㊵ ㊷ 이 더해진다
```

### 5.5 도구 밖으로 가는 것

| 원문 | 무엇인가 | 어디 |
|---|---|---|
| property Lock 의 실제 판정 · SUPPORTS/OPPOSES 의 효과 · 비용 | 주체 State 에서 유도 — Natural Law 의 조건 (Design-Concept §7 혹한 예시) | 3층 · 4층 |
| knowledge Lock 의 판정 · 관찰자가 요구를 어디까지 이해하는가 (§7 의 네 단계) | 주체가 무엇을 아는가 | 3층 (Design-Subject-Decision §8) |
| Actor 가능성 (체열 억제 능력) | 몸 · 능력 | 3층 · 6층 |
| 성질의 수치 · 조합 · 상쇄 (Combination) | 계산 · Mechanism · Recipe | 4층 (Design-Item-System-R1 §2 · §9) |
| 가능성을 지니는 방식 (소지 · 장비 · 섭취 · 동행) | 소지 · 장비 | 3 · 4층 |
| 플레이어 사이의 가능성 공유 (정보 · 거래 · 협력) | 사회 · 경제 | 뒤 층 |
| 안전 조건 (`settlement/condition`) | Lock 의 거울 — 조건이 있어 묻지 않는 자리. Silence Reason 으로만 참조한다 | Land (RoomBecomesLand §5.3) |
| 위험이 발생하고 강화되는 법칙 | 이 문서는 요구만 본다 | 별도 제안(위험의 계약) |

---

## 6. 공정 대응 — 새 Workflow 를 만들지 않는다

Region §4 · Material §4 · Life §4 의 대응표에 그대로 겹친다. Region 하나를 쓸 때 12단계에 더해지는 것만 적는다.

| 단계 | 더해지는 것 | 이 저장소 |
|---|---|---|
| 1 Core Proposition · 2 World Cause | 이 현상은 무엇을 요구하는가 · 그 원인에서 난 재료는 무엇을 가졌는가 — **같은 축**이어야 한다 (협곡: 열을 먹는 결정 → 열을 요구 · 열을 먹는 재료) | Play Design |
| 5 Exploration Contract | Threat 에 요구를, Clue 에 **그 요구를 알아낼 흔적**(traces)을, Reward 에 성질을. 중요 Lock 이면 답의 종류가 둘 이상 올 자리 | Play Design |
| 6 Entry / Exit / Connector | Soft/Hard Requirement 를 Lock 으로. knowledge 는 자리만 | `cycles/<CycleId>/spec.md` |
| 7 Growth Outcome | 무엇을 묻는가 · 무엇을 가졌는가 · 답이 어디 있는가(도구가) · 실제로 여는가(후속 층 위임) | spec.md |
| 8 Topology | Lock 을 벽으로 놓고 그래프를 다시 본다 — 답의 원천이 Lock 밖에 있는가 · Lock 뒤에 무엇이 있는가 | `graph.ts` |
| 9 Spatial Requirement | Lock 앞에 **지목할 자리**와 흔적이 놓일 자리 | RegionSpec.space |
| 11 Play Observation | 문 앞에서 지목하면 현상이 읽히는가 · 요구의 이름과 답의 자리를 세계가 말하지 않는가 · 재료를 지목하면 성질이 읽히는가 · 관찰자가 스스로 잇는가 | Cycle 완료 조건 + ㉞~㊷ |
| 12 Revision | 요구가 어휘에 없다(C) · 답이 없다(GAP) · 흔적이 없다(GAP) · 중요 Lock 에 답이 한 종류(경고) · 판이 답의 자리를 말한다 · 원인 없이 잠갔다 · 문 하나로 끝난다(㊷) | Cycle 반복 |

---

## 7. 작성 양식과 완료 조건

### 7.1 양식 — Region 마다 재료 표 뒤에 채운다

```text
Lock 표        | Lock | 자리 | 강도 | 요구 | 중요 | 흔적 | 완화(relaxedBy) | 사유 코드 | 원인(World Cause 의 어느 마디) |
Possibility 표 | Seed | 문장(observableProperties 원본 · 그대로) | 태그 | 어느 항에서 |
Answer 표      도구가 채운다 — 사람은 비워 둔다 (§4.5)
Silence        묻지 않는 방이면 한 줄 — 왜
```

새 어휘 항목이 필요하면 §4.1 에 근거 절과 함께 한 줄 — 근거가 없으면 UNRESOLVED 로 남긴다.

### 7.2 완료 조건 — Region 하나

```text
1. 이 방은 무엇을 묻는가 — 묻지 않는다면 왜인가?
2. 묻는 것은 어느 위험의 원인에서 나왔는가?
3. 묻는 것은 어휘의 어느 축:관계인가?
4. 그 요구를 알아낼 흔적이 이 방(또는 이웃)에 있는가?
5. 이 방의 재료는 무엇을 가졌는가 — 어느 문장에서?
6. 이 방의 Lock 에 답이 되는 것은 세계 어느 방 · 어느 종류에 있는가 — 그 방은 이 Lock 을 지나지 않고 닿는가?
7. 중요 Lock 이면 다른 종류의 답이 올 자리가 열려 있는가?
8. 이 Lock 뒤에 무엇이 있는가 — 문 하나로 끝나지 않는가?
9. 지목하면 무엇이 읽히는가 — 요구의 이름과 답의 자리는 안 읽히는가?
10. 뒤 층에 무엇을 넘기고 무엇을 넘기지 않는가?
```

세계 전체는 ㉟ 과 ㊶ 이 통과하고(갈 수 없는 곳 · 알 수 없는 요구가 없다) 중요 Lock 의 ㊵ 이 사람의 눈에 든 채로 이 계약 위에서 충분하다.

---

## 8. L0 판단 기준 · 미증명 넷

원문 §16 · §17 이 답했다. 번역이 더하는 것은 하나 — Core Breath 의 **"가능성 탐색"** 마디는 원문이 L0 §3 의 사슬(미지 → … → 이해 → 시도 → …)에
새로 끼운 것이다. L0 의 사슬을 고치지 않는다: "이해 → 시도" 사이의 일이고, 이 문서가 그 사이에 세계 사실(답의 종류와 자리)을 세운다고 읽는다.
승인 시 L0 를 고칠지는 Human 의 것이다 (§10 빈칸 5).

---

## 9. 지금 세계에 적용 — 역기술

원문 §14 를 확정 문서와 대조해 채웠다. 새로 놓은 Lock 도 Possibility 도 없다.

### 9.1 Lock

| 자리 | 강도 | 요구 | 중요 | 흔적 (traces) | 지금 어디에 적혀 있나 | 이 계약에서 |
|---|---|---|---|---|---|---|
| 미로의 심장 문 `MAZE_HEART_GATE` | hard | state: 미로 패턴 P2 | — | 위치를 유지하는 식물 · 문양 (RuleBoundRoom) | `CONNECTOR_ACTIVATIONS` (C009) | Lock 하나 — 형만 바뀐다 (빈칸 1) |
| 긴 밤에만 열리는 문 (숲) | hard | time: LONG_NIGHT | — | 하늘 · 흙 · 발자국이 철을 말한다 (Time T8) | `phases.LONG_NIGHT.connectorActivation` (RoomNeverSame W26) | Lock 하나 — 같다 |
| 빙결 심층의 문 (`FROST_DEPTH` 경계) | hard + soft | time: LONG_NIGHT **그리고** property: `heat:hides` | **중요** | 원문 §7 의 앞 둘 — "문 가까이 가자 몸에서 피어오르는 김이 푸르게 빛난다" · "차가운 물체는 반응하지 않는다" (D4 · 첫 Play 가 trace 로 놓는다). 지금 데이터에는 사유 코드("체열이 감지된다") 뿐 | RoomOfAnotherKind §5.3 · W33 | **첫 property Lock.** ㉟ 과 ㊶ 이 여기서 GAP 을 보고한다 — 첫 Play 가 둘 다 통과로 바꾼다 |
| 미로 입구 `MAZE_GATE` | hard | knowledge: `ANCIENT_GATE_PATTERN` | — | — | Region §16 양식 예시 — 데이터에 없다 (C004 는 문을 그냥 열었다) | 자리만 (K2 · K12) — 3층이 온 뒤 |

Lock 이 아닌 것 — 원문 §14.1 그대로: 눈보라 · 절벽 · 결정면 · 추락 · 물길 · 미구현 Region 경계(`region-not-built`) · 안전 조건(백왕령 산맥 — Silence Reason).
위험과 Access Requirement 를 구분한다. `[ ] 빈칸 3` 결정면(접촉하면 결정화)이 `flesh` 를 요구하는 soft Lock 인지는 Human — 원문은 Lock 이 아니라고 두었고 그대로 따른다.

### 9.2 Possibility

| Seed | 문장 (원본 · 그대로) | 태그 | 원천 | 근거 |
|---|---|---|---|---|
| `BIO_ORE` 생체 광석 | 살아 있는 것의 몸을 따라 옮겨 다니며 쌓인다 · 쌓인 자리를 붉게 물들인다 · 물에 갈리면 붉은빛을 잃는다 | `flesh:stores` · `light:emits` | 숲 셋 (C011) | RoomBearsMaterial D2 |
| `ORE_EATER_MOLT` 광식충 허물 | 붉은 결이 있되 옅다 · 마르면 부서진다 · 밑동 그늘에 모인다 | `light:emits` | 숲 (C011) | D2 |
| `GIANT_TREE_FUNGUS` 거목균 | 사체에서만 자란다 · 사체를 삭여 흙을 붉게 되돌린다 · 그늘에서만 산다 | `flesh:absorbs` · `light:absorbs` | 숲 (C014) | D2 |
| `FROST_CRYSTAL` 빙정석 | 열을 먹는다(닿은 것을 식힌다 · 숨이 언다) · 푸르게 빛난다 · 열이 닿으면 자란다 | `heat:absorbs` · `light:emits` · `heat:grows-on` | 협곡 넷 (C020) | RoomOfAnotherKind 확정 3 |
| `HEAT_CRYSTAL` 열을 저장하는 결정 | 빙결 Region 에서 체온 유지 (예시 한 줄) | `heat:stores` | **숲 계통 — 자리는 첫 Play** (D2) | Region §12 · RoomOfAnotherKind 확정 4 |
| `SPATIAL_CRYSTAL` 공간 왜곡 결정 | 특정 Connector 의 목적지 고정 | `space:fixes` | 없음 (미로의 reward — Region §16) | `[ ] 빈칸 4` |
| `WHALE_SCALE` 고래 비늘 | (성질 미정) | — | 세계 사건 (C018) | RoomNeverSame 확정 9 · `[ ] 빈칸 4` |

### 9.3 검사를 지금 돌리면

```text
㉞ 통과 (어휘 표가 서면)
㉟ GAP 1 — FROST_DEPTH: heat:hides 를 요구하는데 SUPPORTS 인 heat:stores 의 Seed(HEAT_CRYSTAL)에 원천이 아직 없다 (D2 가 숲 계통으로 정했고 자리는 첫 Play)
㊶ GAP 1 — FROST_DEPTH: 요구를 알아낼 흔적이 데이터에 아직 없다 (D4 가 둘을 정했고 첫 Play Cycle ① 이 놓는다)
㊴ FROST_DEPTH / heat:hides — Material 1(원천 미배치) · Life 0 · Environment 0 · Actor 0 · Knowledge 0 · Combination unknown → **답이 한 종류**
㊵ 1 — 중요 Lock 인데 종류가 하나다 (D3 이 둘째 종류를 둔다)
㊷ FROST_DEPTH 뒤 — 빙결 심층(deep) · 그 너머는 경계. 원천 · 생명은 아직 없다 — "문 하나로 끝나는 구조" 에 가깝다 (빈칸 6)
㊱ heat 축이 성질 넷 중 둘 — 편중 아님
㊲ Lock 셋 · property Lock 하나 · 답의 Region ≠ Lock 의 Region (숲 ≠ 협곡 — 원문 §10 의 분산이 첫 사례에서 선다)
㊳ 고아: space:fixes(답도 요구도 없음) · vibration(답도 요구도 없음 — 3층 맹목의 사냥꾼이 올 자리) · flesh 요구 없음
```

GAP 둘과 고아 셋과 단일 종류 하나 — 전부 **이미 문서에 있던 빈 자리**다. 이 계약은 그것을 새로 만든 것이 아니라 보이게 한 것이다.

---

## 10. 위임된 결정과 빈칸

Human 이 "권장대로" · "알아서" 로 위임한 셋은 이 문서가 내렸다 (D1 · D2 · D4). D3 은 검토 ② 에서 새로 생긴 것이다. Human 이 언제든 뒤집는다.

```text
D1  어휘 — 축 다섯(heat · light · vibration · space · flesh) · 관계 일곱(absorbs · stores · emits · senses · hides · grows-on · fixes) 을 **이대로 확정**한다.
    새 항목은 근거 절과 함께만 더한다 (§4.1)
D2  열을 저장하는 결정(HEAT_CRYSTAL)의 원천 — **숲 계통**이다. 생체 광석이 "살아 있는 것의 몸을 따라 옮겨 다니며 쌓인다"(D2 성질 ①) 는 사실에서,
    열을 담는 것도 살아 있는 것 안에 쌓이는 자리에서 난다고 읽는다 (RoomOfAnotherKind 확정 4 의 후보 그대로). 어느 방 · 어느 Carrier · 어느 마디인가는
    **첫 Play(RoomAsksForPossibilities)가 정한다** — 그 Play 가 컨텐츠 행 M7(자원) 을 놓는다. Region §5.5 의 위임 규칙(그것이 무엇인지에서 짓는다)을 따른다
D3  둘째 종류의 답(원문 §19 Cycle 3) — 새 세계 사실을 짓지 않고 **눈보라**를 쓴다: 협곡에 이미 있는 눈보라 area(RoomOfAnotherKind §5.1 · 확정 6 — 관찰 범위를
    절반으로) 가 **감지도** 약하게 한다 (Lock.relaxedBy: 눈보라 area). Environment 가능성이고, "보는 쪽의 범위가 좁아지면 감지하는 쪽도 좁아진다" 는
    확정 6 의 대칭 읽기다. 생물(체열을 먹는 것)은 3층 뒤로 미룬다 — 원문 §19 의 첫 예는 그때 Life 가능성으로 온다.
    Human 이 다른 둘째 종류를 주면 이것을 뒤집는다
D4  FROST_DEPTH 의 흔적(traces) — Human 이 "알아서" 로 위임했다. 원문 §7 의 네 관찰 가운데 **앞 둘**을 세계의 흔적으로 놓는다:
    "문 가까이 가자 몸에서 피어오르는 김이 푸르게 빛난다" (trace · 몸이 문 앞 area 에 들면 보인다 — 빙정석의 푸른 빛과 같은 어휘 light:emits) ·
    "차가운 물체는 반응하지 않는다" (trace · 문 앞에 언 사체 곁의 결정(FROZEN_REMAINS · 이미 있는 원천)이 있고 그것에는 김이 없다).
    뒤의 둘("체열을 감지한다" · "체열을 감출 수 있다면")은 관찰이 아니라 **이해**라 3층의 것이다 (원문 §7 · K10).
    둘 다 기존 사실(빙정석의 빛 · 언 사체의 원천)에서 나왔고 새 존재를 두지 않는다. 자리와 op 는 첫 Play Cycle ① 이 정한다
```

남는 빈칸

```text
[ ] 1  CONNECTOR_ACTIVATIONS · phases.connectorActivation 을 Lock 형으로 옮길 것인가, 셋을 검사만 함께 읽을 것인가 — 첫 Cycle 의 spec
[ ] 3  결정면(접촉 결정화)이 flesh 를 요구하는 soft Lock 인가 — 원문은 아니라고 두었고 그대로 따른다. 뒤집으려면 Human
[ ] 4  공간 왜곡 결정의 원천과 그것이 답하는 Lock · 고래 비늘의 성질 — 남겨도 된다 (고아로 보고될 뿐)
[ ] 5  L0 §3 Core Breath 에 "가능성 탐색" 마디를 넣을 것인가 — 원문 §1 · §16 이 넣었다. L0 는 Human 소유
[ ] 6  FROST_DEPTH 뒤에 무엇이 있는가 (㊷) — 빙결 심층은 지금 경계다. 문이 열린 뒤가 비어 있으면 원문 §15 의 "다른 답이 들어올 자리" 만 있고
       "열 이유" 가 없다. 그 Region 의 행(컨텐츠 층)이 답한다
```

남는 UNRESOLVED — 원문 §18 그대로. 2층이 답하지 않는다.

---

## 11. 다음

```text
첫 계약    [play/RoomAsksForPossibilities.md](play/RoomAsksForPossibilities.md) — 빙결 심층의 문에 이 계약을 처음 쓰는 2층 일곱째 Play
          (원문 §19 · C029~C031). 그 Play 가 미지 M7(열을 저장하는 결정의 원천)을 놓는다
선행       RoomBearsMaterial(원천 · 흔적 · 성질 문장) · RoomOfAnotherKind(첫 property Lock · 눈보라) · RoomAnswersWhenAsked(지목과 판)
자리       Frost(C021) 뒤 · Life 와 병행 가능 (Life 는 Frost 만 기다린다)
이후 Play   중요 Requirement 하나에 서로 다른 세 계통(Material · Life 또는 Environment · Actor/Knowledge)의 답이 실제 플레이에서 성립하는지 — 3층 뒤
뒤에 오는 것  3층 주입 — 이 어휘로 몸(추위 · 체열 · Actor 가능성)을 적는다. 4층 — 이 어휘로 물건의 재료 층과 조합을 적는다.
          L0 §3 의 사슬에 "가능성 탐색" 마디를 넣을지는 빈칸 5 — L0 는 Human 소유
```
