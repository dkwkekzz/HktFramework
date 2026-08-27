# Growth Overlay — Capability 획득 경로

Master Capability 를 **"세계 안에서 어떻게 얻는가"**(Class / Item / Actor / World Interaction)
관점으로 겹쳐 본 결과다. [../overlay.md](../overlay.md) 와 축이 다르다.

```text
../overlay.md      그 의미가 세계에 구현되어 있는가        있는가 / 없는가
이 문서            그 Capability 를 얻는 경로가 있는가      가질 수 있는가 / 없는가
```

둘을 헷갈리면 안 된다. 공격력이 피해를 바꾸는 것(구현됨)과 플레이어가 공격력을 올릴 수
있는 것(획득 경로)은 다른 이야기이고, 지금 이 프로젝트가 정확히 그 사이에 걸려 있다.

GR = `design/Master-Intent-Graph-Growth.md` (공정 원본) ·
GS = `content/proto-adventure/design/Master-Fairy-Growth-System.md` (성장 기획 원본) ·
GB = `content/proto-adventure/design/Design-Growth-Balance-R0.md` (비용·보상 균형) ·
FC = `content/proto-adventure/design/Design-Fairy-Class-Layer0-R0.md` (계열별 Origin Class).
형식: [../SCHEMA.md](../SCHEMA.md).

이 문서가 답하는 것은 **얻을 수 있는가**다. GB 가 묻는 **그 값이 치른 것과 맞는가**는
옆자리가 소유한다 — [balance/](balance/) 다 (Human 결정 · HISTORY Q58(c)).
파일 하나 = 성장 하나이며 지금 하나가 서 있다 (GBC-GAIN-LEVEL).

## 성장의 원천 — 값이 어디에서 올라오는가

GS §5 · §19 주입으로 이 표가 생겼다. 이 문서가 지금까지 답하지 못하던 질문 —
"Capability 를 세계 안에서 어떻게 얻는가" 의 **Class 쪽 절반** — 이 여기서 시작한다.

| 성장 대상 | 원천 (무엇을 해야 오르는가) | 노드 | 세계 |
|---|---|---|---|
| Character Level | 전투 · 탐험 · 발견 · 사건 해결 | MC-GAIN-LEVEL | 없음 |
| 기본값 (생명력·공격력·방어력·기력·이동) | Character Level + Class | MC-ATTACK-POWER 외 — 값 자체는 이미 있다 | 값은 있고 **키우는 축이 없다** |
| Class Mastery | 그 형태 고유의 행동 | MC-GROW-CLASS-MASTERY | 없음 |
| Skill Mastery | 실제 사용과 난도 높은 활용 | MC-MASTER-A-SKILL | 없음 |
| Exploration Mastery | 자기 원리로 환경 문제 해결 | MC-GROW-EXPLORATION-MASTERY | 없음 |
| Equipment | 세계 자원 획득 · 제작 · 강화 | **MC-EQUIP-ITEM** | **있다** (C023 · C024) |
| Class Change | Level + Mastery + World Experience + Catalyst | MC-CHANGE-CLASS | 없음 — **아래쪽 형태는 섰다**(Origin CL-* 6), 넘어갈 위쪽이 없다 |

다섯 축 중 **하나만 세계에 서 있다**. 그리고 서 있는 그 하나는 성장이 아니라 자원으로
감당하는 갈래(MP-ADAPT-BY-RESOURCE)에 매달려 있다 — 물건을 걸면 값이 오르지만 그것은
값을 *키우는* 것이 아니라 *얹는* 것이다. 걸린 것을 풀면 정확히 원래 몸으로 돌아온다.

Class Catalyst(GS §6)의 자리는 비어 있다. GS 는 그것이 "강한 형태를 유지하기 위해 필요한
세계의 Property" 라고만 적고 어느 자원인지 명명하지 않는다 (태양심을 예로 들 뿐이다) —
자원의 이름과 유래는 승인 대기 중인 자원 카탈로그 문서가 소유한다.

## Class — 여섯 Origin 이 무엇을 여는가

FC 주입으로 `growth/classes/` 에 CL-* 여섯이 섰다 (백왕 · 역락 · 태양심 · 진명 · 숨결 ·
맥동의 Origin Class). 이 표가 답하는 것은 **어떤 몸이 되면 무엇을 쓸 수 있게 되는가**다 —
지금까지 이 문서의 Class 쪽 절반이 통째로 비어 있던 자리다.

| Class (계열) | Principle | 맞는 순간의 대응 | 여는 Capability | 옮기지 못한 것 |
|---|---|---|---|---|
| 골완투사 (백왕) | 결속 | 버티기 | MC-GUARD · MC-FORTIFY · MC-ABSORB · MC-BREAK · MC-FORCE-MOVEMENT | 괴력 · 지지 · 세계압 내성 |
| 역락검사 (역락) | 방향 | 역보 | MC-EVADE · MC-REPOSITION · MC-USE-TERRAIN · **MC-REDEFINE-DOWN** · **MC-REDIRECT-FALLING-THING** | 없음 |
| 열술사 (태양심) | 축적 | 열방출 | MC-ABSORB · MC-CONTROL-SPACE · MC-CARRY-LIFE-SUPPORT · MC-READ-ENVIRONMENT · **MC-DRAIN** | 체열 감지 |
| 명각사 (진명) | 정체성 | 판독 | MC-OBSERVE · MC-OBSERVE-ABILITY · MC-MARK · MC-DISCOVER-WEAKNESS · MC-IMPERSONATE-IDENTITY · MC-VERIFY-REALITY | 기술 흉내 · 앎의 공유 |
| 숨결술사 (숨결) | 대기 | 기막 | MC-CONTROL-SPACE · MC-FORCE-MOVEMENT · MC-INTERRUPT · MC-CARRY-LIFE-SUPPORT · MC-READ-ENVIRONMENT · **MC-PLACE-FOOTING** | 없음 |
| 맥동사 (맥동) | 공명 | 역맥 | MC-BIND · MC-OBSERVE · MC-READ-ENVIRONMENT · **MC-LINK-TO-LIVING-WORLD** · **MC-HOLD-BIOLOGICAL-STATE** | 없음 |

여섯 전부가 대응 자리 셋(MC-ACTIVE-RESPONSE · MC-PRECISION-RESPONSE · MC-OPPORTUNITY)과
조건 자리(MC-ABILITY-CONDITION)를 함께 연다 — 같은 자리에 서로 다른 것을 끼우는 형태이므로
노드는 하나이고 획득 경로가 여섯이다 (DC-GROWTH-NO-CAPABILITY-DUPLICATION).

### 이 표로 무엇이 달라졌는가

지금까지 이 문서의 마지막 줄은 "전투 Capability 전반 — 획득 경로 없음, CL-* 0 개" 였다.
그 줄이 사라졌다. **설계에서는 스무 개 넘는 Capability 가 이제 세계 안의 획득 경로를
가진다** — 그 몸이 되는 것이다. 다만 획득 경로가 생긴 것과 세계에서 그것을 얻을 수 있는
것은 다르다: 세계의 몸은 여전히 종류 하나이고 형태를 고르는 일도 바꾸는 일도 없다
(MC-CHANGE-CLASS · MC-GROW-CLASS-MASTERY 둘 다 MISSING).

### 굵은 여섯은 Q71(b) 확장으로 섰다

Human 이 "지금 만든다" 가 아니라 **"요구를 먼저 찾는다"** 를 골랐고 (HISTORY Q71(b)),
찾아보니 대부분 이미 요구되고 있었다 — BT 가 각 대지형의 **주요 경험**으로 적어 두었는데
BT 주입이 Capability 로 들어 올리지 않았을 뿐이다.

```text
MC-REDEFINE-DOWN            산맥 §8.7 핵심 경험 — 세계가 정한 아래쪽을 바꾼다
MC-REDIRECT-FALLING-THING   산맥 §8.7 — 적과 투사체의 낙하 방향 변경
MC-PLACE-FOOTING            산맥 §8.7 · 무호흡해 §7.7 — 두 땅이 따로 명명했다
MC-HOLD-BIOLOGICAL-STATE    혈화수해 §11.7 — 완전히 개화하기 전 대상 구조
MC-LINK-TO-LIVING-WORLD     걷는 대륙 §9.6 — 유랑대지의 진로를 바꿀지 선택
MC-DRAIN                    빙원 §5.1 의 법칙을 사람이 작게 한다 (유일하게 갈래 쪽에서 나왔다)
```

**셋은 노드가 되지 않고 접혔다** — 표면 주행은 MC-REDEFINE-DOWN 의 결과이고, 빼앗김에
따르는 느려짐은 MC-DRAIN 의 semantic 자체다. 같은 의미를 둘로 세우지 않는다.

### 기술을 표현할 재료가 어디까지 있는가

위 표는 **무엇이 일어나는가**(효과)만 센다. 그런데 기술 하나는 효과만으로 서지 않는다 —
발동 · 대상 기준 · **실행** · **대상 결정** · 효과의 조합이다
(`DC-SKILL-IS-COMBINATION-NOT-NAME`). FC 의 기술 마흔여덟(여섯 계열 × 여덟)을 그 축으로
대조하면 **효과는 거의 다 있고 나머지 둘이 비어 있다.**

| 축 | 지금 | 걸리는 기술 |
|---|---|---|
| 효과 — 무엇이 일어나는가 | 거의 찬다. 위 표의 MC-* 들 | 남은 다섯은 아래 절 |
| **실행 — 어떻게 닿는가** | MS-SKILL-FORM 여섯 칸 중 **둘**. 접촉(MC-COMBAT-STRIKE) · 공간 존재(MC-PLACE-FOOTING) | 열탄 · 태양탄 · 열광선 · 냉각장 · 압기탄 · 숨결장 · 숨의 방 · 압축파쇄 · 일심폭발 · 지맥청 · 대맥동 · 반류(비틀 투사체가 없다) |
| **대상 — 누구에게 가는가** | 적대와 중립뿐. **아군이 없다** | 생근결 · 대맥동 · 숨의 방 · 초명 |

막는 것은 Capability 결손이 아니라 **세계의 축**이라 노드를 더 세워서 풀리지 않는다.
실행 축은 `Q35`(층인가 갈래인가)가, 대상 축은 `Q60(c)`(아군은 사람을 지어내지 말고
세계의 존재로 받는다)가 소유한다. 그리고 역락계는 축이 하나 더 걸린다 —
**세계에 위아래가 없어**(`WorldPosition` 은 x·z 뿐) MC-REDEFINE-DOWN 과
MC-REDIRECT-FALLING-THING 이 노드로 서 있어도 놓을 자리가 없다
([../frontier/terrain.md](../frontier/terrain.md) 의 "지금 열 수 없는 것").

계열별로 얼마나 걸리는지는 각 CL-* 의 `grants_note` 가 적는다. 가장 크게 걸리는 것은
**태양심계**(여덟 중 넷이 실행 형태를 요구한다)와 **맥동계**(절반이 아군을 요구한다)다.

### 아직 비어 있는 다섯

| 계열 | 없는 것 | 왜 세우지 않았나 |
|---|---|---|
| 진명 | 기술 흉내 · 앎의 공유 | 어느 땅도 어느 갈래도 요구하지 않는다 |
| 백왕 | 괴력 · 지지 · 세계압 내성 | 백왕의 갈비분지는 **가장 안전한 땅**이라 그런 요구를 내지 않는다 (BT §4.6) |
| 태양심 | 숨은 생물의 체열 감지 | MC-READ-ENVIRONMENT 는 "생물과 독립적으로 환경을 읽는다" 라 어긋난다 |

요구가 없는데 Class 가 있다는 이유로 Capability 를 만들면 방향이 뒤집힌다
(DC-GROWTH-NEED-FROM-POSSIBILITY). 요구하는 자리가 서면 그때 잇는다.

### 위쪽이 비어 있다 — 다만 모양은 정해졌다

여섯 CL-* 의 `transitions_to` 가 전부 비어 있다. 상위 형태의 CL-* 를 세우는 것은 다음
Layer 의 설계 문서다.

**갈래는 여럿이다** (Human 결정 — HISTORY Q69(b)). 한 칸에 형태가 하나씩 서는 사슬이
아니라, 기초 원리에 어떤 원리가 결합되었는가에 따라 같은 칸에서 갈라지는 나무다 (FC §1).
GS 가 이름을 준 여섯(왕골권사 · 천주질주자 · 태양포식자 · 가면술사 · 풍압사 · 대지공명사)은
각 계열에서 **한 갈래**이고, 나머지 갈래의 이름은 그 갈래를 세우는 문서가 원리에서 도출한
뒤에 따라온다 — 이름이 먼저가 아니다 (DC-GROWTH-CLASS-COMES-FROM-A-PRINCIPLE).

이 결정이 늘리는 것은 작업량만이 아니다. `MC-CHANGE-CLASS` 가 닫히려면 조건 넷(GS §6)에
더해 **여럿 중 무엇으로 갈지 고르는 일**이 세계에 서야 하고, 갈래마다 관문 넷을 따로
닫아야 한다 (SCHEMA 의 CL-* — `response` · `counterplay` · `cannot_yet` · `extends_toward`).

### 관문 넷은 이제 값이다

`npm run master:graph` 가 CL-* 의 네 칸이 비었는지, `grants` 와 `origin_trace` 가 없는
노드를 가리키는지 검사한다 (Human 결정 — HISTORY Q70(c)). 열두 질문 중 다른 DC 가 값으로
요구하는 넷만 칸이고, 나머지 여덟은 `semantic` · `detail` · `world_shape` 산문에 남는다.

## 광물 — 어디서 왔고 무엇을 여는가

Q22 로 세계의 광물을 정의했다. 각 광물은 **어떤 압력이 그것만 남겼는가**를 갖는다 —
좋은 것을 위험한 곳에 배치한 것이 아니라, 그 환경이 남긴 것이 인간에게 값진 것이다
(BW §11 · §33 · DC-WORLD-RESOURCE-ADAPTATION-TRACE).

| 광물 | 유래 | 왜 그것만 남았나 | 성질 | 제작물 | 여는 Capability |
|---|---|---|---|---|---|
| 평범한 돌 | MW-SAFE-FRONTIER | 변화시키는 압력이 없어 그냥 남았다 — 겪은 일이 없다 | 없음 (그것이 요점) | IT-COMMON-STONE | 없음 |
| 경계결정 | MW-SPATIAL-SHEAR | 공간이 어긋나도 구조적 연속성을 유지했다 | IP-BOUNDARY-STABLE | IT-BOUNDARY-BLADE | **MC-CUT-ABNORMAL-STRUCTURE** (IM-BOUNDARY-EDGED) |
| 불식광 | MW-ZONE-WILD | 독과 삭임이 만연해 반응하는 것은 다 사라졌다 | IP-UNREACTIVE | IT-SEALED-VESSEL | 없음 (사유 아래) |
| 산격석 | MW-ZONE-DANGER | 충격을 한 점에 받는 구조는 부서지고 흩어 보내는 것만 남았다 | IP-SHOCK-DISPERSING | IT-WARDING-PLATE | 없음 (사유 아래) |
| 불연정 | MW-ZONE-DEEP | 공생 Network 에 끌려 들어간 것은 그 체계의 일부가 되었고, 끌려 들어가지 않은 것만 광물로 남았다 | IP-BIOLOGICALLY-CLOSED | IT-SEVERING-BLADE | **MC-BREAK-BIOLOGICAL-LINK** (IM-BIO-SEVERING) |
| 정박정 | MW-ZONE-UNKNOWN | 정체가 흔들린 것은 더 이상 그것이 아니게 되고, 자기 동일성을 잃지 않은 것만 같은 것으로 남았다 | IP-SELF-IDENTICAL | IT-ANCHOR-STONE | **MC-IDENTITY-ANCHOR** (IM-IDENTITY-ANCHORED) |

### 왜 둘은 아무 능력도 열지 않는가

불식광과 산격석은 성질과 제작물만 있고 `grants` 가 비어 있다. 빠뜨린 것이 아니다.

지금 어떤 Possibility 도 "삭임을 견딘다" 나 "환경 위험을 견딘다" 를 요구하지 않는다.
요구가 없는데 자원이 있다는 이유로 Capability 를 만들면 그 순간 방향이 뒤집힌다 —
`DC-GROWTH-NEED-FROM-POSSIBILITY` 와 BW §18 이 금지하는 바로 그 형태다.
요구하는 경로가 생기면 그때 잇는다. 그때까지 이 둘은 재료이고, 그것으로 충분하다.
세계압은 가능성을 늘릴 뿐 전리품을 보장하지 않는다 (BW §12).

### BW §17 순환이 그래프에서 닫혔다

세 개의 `grants` 배선이 "한 층의 산물이 다음 층의 조건이 된다" 를 실제 간선으로 만든다.

```text
MW-SPATIAL-SHEAR   → 경계결정 → MC-CUT-ABNORMAL-STRUCTURE  → MP-ADAPT-BY-RESOURCE
MW-ZONE-DEEP       → 불연정   → MC-BREAK-BIOLOGICAL-LINK   → MW-ZONE-UNKNOWN 의 demands
MW-ZONE-UNKNOWN    → 정박정   → MC-IDENTITY-ANCHOR         → MW-ZONE-UNKNOWN 의 demands
```

세 경우 모두 **필요가 먼저 있었고 경로가 나중에 붙었다.** 세 Capability 전부
이 광물들을 세우기 전부터 어떤 Possibility 나 층이 요구하고 있던 노드다.

아래 둘은 특히 순환이 좁게 도는 경우다 — DEEP 에서 얻은 것이 UNKNOWN 을 열고,
UNKNOWN 에서 얻은 것이 다시 UNKNOWN 을 더 감당하게 한다. 한 번 다녀와 본 사람만
제대로 들어갈 수 있다는 형태이며, BW §16 탐험 Loop 가 층 안에서도 도는 경우다.

## 아직 경로가 없는 것

| Capability | 획득 경로 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-PENETRATION | **없음** | C013 08-verification 은 관통 값의 변경을 **디버그 명령**으로 실측했다. 종류가 정한 초기값 외에 이 값을 바꾸는 세계 내 행위가 없다 — 08 이 그 사실을 Possibility 주의로 직접 보고했다 | 관통을 얻는 경로 전부. 형태(장비·성장·준비 행동)가 정해지지 않았다 |
| MC-ATTACK-POWER | **부분** — 장착 하나 (C023 · C024) | 코드 대조 — 걸어 둔 물건이 유효 값을 얹지만 기본값은 스폰 시 정해진 뒤 그대로이고, 그 값을 바꾸는 유일한 규칙은 여전히 디버그 명령이다 | 기본값을 **키우는** 경로. GS §19 주입으로 그 형태는 정해졌다 — 전투·탐험·발견·사건 해결이 Level 을 올리고 Level 이 기본값을 올린다 (MC-GAIN-LEVEL). 세계에 그 축이 없다 |
| MC-RESTORE-BIOLOGICAL-STATE | **없음** | BW §8 은 원천(회귀초)만 명시하고 Item ID 를 명명하지 않았다 | 회귀초의 IT-* 와 획득·사용 규칙. 문서가 ID 를 주지 않아 세우지 않았다 — 광물은 Q22 로 정의했으나 식물은 Human 지시 범위 밖이었다 쓰는 개념(MC-USE-ITEM)이 선 다음 Cycle 이 원천과 함께 가져온다 (HISTORY Q31) |
| 전투 Capability 전반 | **설계에는 있다 — 세계에는 없다** | FC 주입으로 Origin CL-* 여섯이 섰고 위 표가 그 배선이다. 그러나 코드 대조 — 몸이 형태를 갖는 일도, 형태를 고르거나 바꾸는 사건도 세계에 없다 | 몸에 형태라는 자리. 그리고 위쪽 CL-*(상위 형태) 0 개 — 갈래 문제(Q69)가 먼저다 |

### grants 가 몸에 닿으려면 무엇이 먼저 서야 하는가

`IM-BOUNDARY-EDGED → MC-CUT-ABNORMAL-STRUCTURE` 같은 배선은 **설계의 간선**이다.
그 간선이 실제 몸의 능력이 되려면 세계에 "이 물건을 지금 적용하고 있다" 는 상태가
있어야 한다 — 그 자리가 `MC-EQUIP-ITEM` 이다 (IS §3 · §5.4). 그리고 그 물건이
재료에서 나오려면 `MC-CRAFT-FROM-MATERIALS` 가, 층에서 얻어 오려면
`MC-TRANSFER-ITEM` 이 서야 한다. 넷 다 지금은 MISSING 이다 (../overlay.md).

```text
IP 성질 ──► IM 조합 ──grants──► MC 능력        설계에서는 닫혀 있다 (Q22)
                                   │
                          MC-EQUIP-ITEM 이 없어 여기서 끊긴다   ← 세계의 결손
                                   │
                                 몸의 능력
```

### 채집은 있는데 왜 획득 경로가 없다고 하는가

세계에 채집이 하나 있다 — 곡괭이를 들고 광맥에 다가가 돌을 캔다. 그 돌이 이제
`IT-COMMON-STONE` 으로 세계 유래를 갖게 되었지만, 여전히 개수만 세어지고 아무 데도
쓰이지 않는다. 만들 것도, 장착할 것도, 팔 상대도 없다.

그러니 세계에는 **물건을 얻는 행위**는 있고 **그 물건으로 달라지는 것**이 없다.
Growth 의 관점에서 이것은 경로가 아니라 경로의 앞부분 한 칸이다.
설계에서 순환이 닫힌 것과 세계에서 순환이 도는 것은 다르다.

## 구현 현황

| 층 | 상태 |
|---|---|
| 설계 (이 문서) | IP 5 · IT 6 · IM 3 · grants 3 건 — BW §17 순환이 그래프에서 닫혔다. **CL 6** — 여섯 계열의 Origin Class 가 FC 주입으로 섰다. 상위 형태와 나머지 두 계열(가능성 · 혈화)은 비어 있다 |
| 세계 (`world/`) | 광물 1 종(돌)만 존재하고 쓰임이 없다. 제작·장착·거래 규칙 전무 |
| 결손의 이름 | IS 주입으로 넷이 노드가 되었다 — MC-USE-ITEM · MC-EQUIP-ITEM · MC-CRAFT-FROM-MATERIALS · MC-TRANSFER-ITEM (모두 MISSING) |

## 채워지는 경로

```text
master/root.md (Root Game Goal · World Premise — Human)
      ↓
WHY — 세계 사실(MW-*)이 생긴다
      ↓
OPTIONS / NEED — 그 세계에서 Possibility 와 필요 Capability 가 나온다
      ↓
그 필요를 채우는 CL-* / IT-* / IM-* 가 origin_trace 를 갖추고 선다   ← 역방향 금지
      ↓
이 표에 획득 경로가 채워진다
```

Class 노드는 `origin_trace`(World Cause) 필수다 (DC-GROWTH-CLASS-ORIGIN-TRACE).
Item 도 같은 요구를 SCHEMA 의 `origin_trace` 로 진다 (GR §41 Item Gate).

이 파일에는 **현재 상태만** 둔다 — 갱신 이력은 [../HISTORY.md](../HISTORY.md) 소유다.
Cycle Agent 는 이 파일을 직접 편집하지 않는다.
