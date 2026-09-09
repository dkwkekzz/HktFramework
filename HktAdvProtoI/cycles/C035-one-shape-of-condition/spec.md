# C035 — 조건은 하나의 형이다

## 묶음 — 방은 기억하고 때가 되면 내민다

```text
기획서     content/roadmap/L2-World-Foundation.md — §3 G3 · G4 · G5 · G6 · G7 · G8 · G11 · G13 · §4.1~§4.5 데이터 계약 · §5.2 검사 ㊸~㊼ · §5.3 관찰 도구 ·
           §5.4 T2 열셋째 답 · T4 결정 나무 · T6 ㊻ · §8 기준 23 · 24 · §10 D2 · D3 · 빈칸 2
           content/roadmap/L2-World-Time.md — 2.6 지나가는 것 · 2.7 뒤척임 · RoomNeverSame 확정 9(비늘 = WORLD_EVENT · 고래가 다시 지나면 돌아온다)
           content/roadmap/L2-World-Access.md — §4.3 Lock.requires(time · state) · K2 · K12 · 빈칸 1
           의미의 출처는 이 셋뿐이다. 옛 Play 문서는 없다 — 그것이 내린 확정은 아래 질문으로 다시 묻는다
행         기반 층 L2 — 세계 절반 ②-부속 다섯째 (Region Foundation). 새 축 없음 · 새 layer 없음
Goal       관찰자가 숲 가장자리에서 (1) 방이 자기에게 일어난 일을 센 것을 지목으로 읽고 뒤척임 · 되돌아옴 · 되살리기 뒤에도 그 셈이 남는 것을 보고
           [C034 — 코드에 있다], (2) 세계의 조건(문이 열리는 때 · 원천이 나는 철 · 결속의 조건)이 한 형으로 읽히고 그 형이 기억을 읽는 것을 보고,
           (3) 방이 내미는 것(기회)이 판의 「할 수 있는 것」으로 서며, (4) 고래가 지나간 뒤 떨어진 비늘이 **때가 있는 기회(Event)** 로 —
           지금은 없고 그때는 있는 것으로 — 읽히고 주워진다
Intent     Start  방은 센다(C034). 그러나 그 셈은 아직 아무것도 판정하지 않고, 조건은 데이터 넷에 다른 모양으로 흩어져 있으며, 무엇을 할 수 있는지는
                  걸어가 거절당해야 안다. 비늘은 "원천 하나" 일 뿐이다
           End    조건이 한 형이고 그 형이 기억을 읽는다. 판이 "이 방에서 무엇을 할 수 있는가" 를 말하고, 때가 있는 것은 "지금은 없다" 로
                  갈라 말하되 언제까지인지는 말하지 않는다 — 발견된 방이 계속 살아 움직인다 (L0 미증명 ① · ④)
Breath     셈이 남는다(놀람 · C034) → 뒤척여도 남는다(신뢰 · C034) → 조건이 그것을 읽는다(이해) → 할 수 있는 것이 판에 선다(시도) →
           때가 있는 것이 지금은 없다(기다림) → 고래가 지나간 뒤 있다(획득) → 새로운 미지
Cycle      C034 방이 기억한다        닫힘 — main 에 있다 (cycles/C034-the-room-remembers · 옛 공정의 마지막 Cycle)
           C035 조건은 하나의 형이다   이 spec — Condition 형(G5 · D2) · 게임 명사 없는 평가기 · 흩어진 조건 자리 넷을 형으로 읽는다(빈칸 2) · 검사 ㊹ ·
                                    기억을 읽는 첫 조건 · 회귀(문 · 원천 · 결속이 그대로)
           C036 방이 기회를 내민다     cycles/C036-a-room-offers/spec.md — Opportunity 형(G3 · D2) · RegionSpec.opportunities · 원천마다 채집 기회 기본형 ·
                                    문의 cross 기회 · Interaction 판정에 기회의 이름 · 판의 「할 수 있는 것」 이 기회 데이터에서 · discovery 넷 · 검사 ㊺ ㊻ · 기회 표
           C037 때가 있는 기회        cycles/C037-an-opportunity-with-a-time/spec.md — Event(G4 · D3 비늘) · progress 는 history 경로 · outcomes = op 표(G6) +
                                    yield 열 넷(G11) · 판의 「지금은 없다」 · T2 열셋째 답 · T4 결정 나무 · T6 ㊻ (묶음의 마지막)
           순서는 의존성이다 — 기억(C034)이 있어야 조건이 읽을 것이 있고, 형(C035)이 있어야 기회의 availability 를 적을 수 있고, 기회(C036)가 있어야
           Event(C037)가 그 특수형이다. 셋의 spec 을 한 번에 썼다 — 뒤 spec 은 앞 Cycle 마감이 남긴 「다음 Cycle 로」 를 반영해 자기 차례에 동결한다.
           STATE_VERSION 은 C034 가 올렸다(11). C035 · C036 은 새 State 가 없어 다른 묶음과 병행할 수 있다
미지       없음 — M4 천공고래의 길을 깊게 한다 (기획서 빈칸 5 · Human 확정). 이름 있는 새 사실을 Human 이 주면 그때 바꾼다
검사       기반 층이라 열 질문은 기획서 §9 가 답했다 — 위험을 더하지 않고 자리를 말한다 · 재료는 같은 자리(기회의 outcomes) · 성장은 Yield 열 넷 ·
           Core Breath 의 관찰 → 이해 → 시도 와 극복 → 성장 → 새로운 미지 사이의 기억
질문       아래 UNRESOLVED — 묶음 전체(C035~C037)의 것을 여기서 한 번에 묻는다. "C035 진행" 이 답과 함께 오면 묶음이 승인되고 이 spec 이 동결된다.
           C036 · C037 의 spec 은 자기 차례에 앞 Cycle 의 「다음 Cycle 로」 를 받아 동결한다 (그때 새로 생긴 의미만 묻는다)
```

```text
CYCLE          C035-one-shape-of-condition
SOURCE         L2-World-Foundation §3 G5 · G8("기억은 Condition 의 Target 이다") · §4.1 · §5.2 ㊹ · §10 D2 · 빈칸 2 · L2-World-Access §4.3 · K2 · 빈칸 1 ·
               기존 spec 의 ADDED — C009(패턴 조건 activation) · C016(철 조건 · phases.seasons) · C023(결속 조건 LifeRequirement) · C029(Lock.requires time · state) ·
               C034(history · RULE-REGION-MEMORY-001). 기존 Semantic/Rule 을 복사하지 않고 이름으로 인용한다.
               C034 마감이 남긴 「다음 Cycle 로」 둘 — ① 관찰의 passages 형(배열 + presence 코드)과 spec 표기(passages[routeId])의 차이 → 이 spec 은 세계 State 의
               키(routeId)로 조건을 적는다 · 관찰 계약 표기는 봉투 쪽(배열 + presence)을 따른다 ② "셈이 처음으로 판정한다" → SPEC-006
SELECTED_FROM  묶음 Cycle 목록 2 — "조건은 하나의 형이다"
```

## Playable Goal

세계의 문 · 원천 · 결속이 지금과 똑같이 열리고 나고 서는데, 그 조건이 데이터 넷의 서로 다른 모양이 아니라 **한 형(Condition)** 으로 읽히고,
`world:check` ㊹ 가 그 형의 참조 무결을 한 검사로 잰다. 그리고 그 형이 처음으로 **기억을 읽는다** — 숲 가장자리의 비늘 자리는 고래가 이 방을
한 번이라도 지났는가를 **조건**으로 말한다(지나기 전엔 조건이 서지 않고 판이 그것을 코드로 싣는다 · 지난 뒤엔 그 줄이 사라진다). 화면은 그것 말고 달라지지 않는다.

## Experience Intent

- Start — 셈은 있지만 아무것도 읽지 않는다. 조건은 넷의 다른 말로 적혀 있다.
- End — 조건이 한 말이고, 그 말이 과거를 읽는다 (묶음 Breath 의 "조건이 그것을 읽는다").

## World Change

1. **Condition 형이 선다** — Target(region · area · connector · source · process · route · clock · history — 여덟 · actor · player · faction 은 자리만) +
   Query(property · exists · count · state · history) + Operator(== != > >= < <= IN EXISTS NOT_EXISTS) + Value + Qualifier(time: FOR/SINCE/WITHIN/BEFORE/AFTER ·
   change: BECAME/CROSSED/INCREASED/DECREASED — 하나까지) + 집합(all · any). chance 는 자리만 (빈칸 1).
2. **평가기가 선다** — 게임 명사 없이 형을 판정하는 기구(ENGINE). 값을 저장하지 않는다 — change qualifier 의 직전 값은 호출자가 준다(유도).
3. **흩어진 조건 자리 넷이 이 형으로 읽힌다** — ① Lock.requires 의 time · state(C029) ② ResourceSource.occurrence(seasons · dayPhases)(C011 · C016)
   ③ RegionPhases.seasons 의 철 키(C016) ④ LifeSite.requires(source-available · rain · population-at-most · population-at-least)(C023).
   옮기는가 읽기만 하는가는 Q1 (제안: 읽기만 — 어댑터). 어느 쪽이든 **판정 결과는 한 값도 달라지지 않는다**.
4. **기억이 Target 이 된다** — `{ target: history, query: history, ... }` 가 `RegionState.history` 를 읽는다. 첫 사례는 Q2 (제안: 비늘 자리 —
   `passages[SKY_WHALE_ROUTE] EXISTS`).
5. **검사 ㊹** — 모든 Condition 의 target.ref · query 가 실제로 있는 것과 그 형의 속성을 가리키고 qualifier 가 유효한가 — ㉓ · ㉖ · ㉞ 이 각자 보던 것의 일반형.
   기존 셋의 답은 달라지지 않는다.
6. 규칙 코드는 여전히 어떤 조건도 이름으로 알지 못한다 (R13 · Material · Life · Access 의 규율 그대로).

## Observable Result

1. 문 · 원천 · 결속 · 위상 — 고요 · 스밈 · 긴 밤 · 뒤척임 어느 때에도 C034 까지의 세계와 **한 값도 다르지 않다** (회귀 — 검사 마흔다섯의 답 · 방 열셋의 hash · 시나리오 전부).
2. `world:check` 에 ㊹ 가 선다 (마흔여섯) — 조건 자리 넷에서 읽힌 Condition 전부의 참조 무결 · 통과. 일부러 유령 ref 를 넣으면 fail.
3. 숲 가장자리의 비늘 자리(FALLEN_SCALE): 고래가 한 번도 지나지 않은 세계에서 지목하면 판의 조건 줄이 「지나간 것이 있어야 한다」 로 서고(기억 조건이 서지 않는다),
   한 번 지난 뒤(HKT_PRESENCE=SKY_WHALE_ROUTE) 지목하면 그 줄이 사라진다 — 조건이 기억을 읽었다 (Q2 제안대로일 때). 원천의 phase · 되돌아옴은 그대로다.
4. `world:observe --report` 의 열쇠 × 자물쇠 표 곁에 **조건 표** — Condition 마다 한 행(어디에 · target · query · qualifier · 지금 참인가). 읽기 전용.

## Reuse

Existing: `Lock.requires` · `lockTraceCodesAt` · `isConnectorOpen` · `connectorClosedReason`(RULE-LOCK-REASON-001) · `ResourceSource.occurrence` · `sourceConditions`(RULE-SOURCE-CONDITION-001) ·
`RegionPhases.seasons` · `regionPhaseAt`(RULE-REGION-PHASE-001) · `LifeRequirement` · `lifeUnmetCodes`(RULE-LIFE-BINDING-001) · `RegionState.history`(C034) ·
`worldClockAt` · `isRainingAt` · `findPopulation` · 검사 묶음(`CheckReport` · ㉓ ㉖ ㉞) · `world:observe --report` · 판의 조건 줄(C029 「요구」 · C016 「이 철이 아니다」).

Added:
- Engine · `engine/world-authoring/condition` — Condition 형(타입) · `evaluateCondition(condition, read)` — read 는 호출자가 주는 조회 함수(경로 → 값 · 직전 값). 게임 명사 0.
  검사 ㊹ (`condition-refs`) — 계약 목록(Target 종류마다 실제 id · query 마다 허용 속성)은 컨텐츠가 건넨다.
- World · 조건 자리 넷 → Condition 어댑터(읽기) · `RULE-CONDITION-READ-001`(형으로 읽는 한 자리) · history Target 의 read(`RULE-CONDITION-HISTORY-001`) ·
  첫 history 조건 데이터 한 줄(Q2).
- Protocol · 원천 대상 프레임에 `conditions` 가 이미 있다(C014) — 코드 하나 추가(`needs-passage` 류). 새 필드 없음 (Q2 제안대로면).
- 도구 · `world:observe --report` 조건 표.

## Out of Scope

- Opportunity 형 · availability 에 Condition 을 놓는 것 · 「할 수 있는 것」 → C036. Event · 시간 qualifier 의 실사용 · progress → C037.
- actor · player · faction Target · capability · knowledge · distance · contains · relation query → 3 · 4층 (자리만).
- chance → 5층 이후 (빈칸 1). Mutation 의 이름 붙이기(op 표) → C037 (outcomes 가 처음 쓴다).
- 조건 자리 넷을 **옮기는** 것 — Q1 이 "옮긴다" 면 이 Cycle 이 CHANGED 로 받는다. 제안은 읽기만.

## SPEC

- SPEC-001 형이 선다 — Condition 하나가 Target 여덟 중 하나 · Query 다섯 중 하나 · Operator 아홉 중 하나 · Value · Qualifier 하나까지 · all/any 집합으로 적히고 평가기가 참/거짓을 낸다.
  경계 ① — 자리만인 Target(actor · player · faction) · Query(distance · contains · relation · capability · knowledge) · chance 는 형에 있되 평가기가 "판정 불가" 를 낸다 (거짓이 아니다).
  경계 ② — change qualifier 는 직전 값을 호출자가 주지 않으면 판정 불가다 (평가기는 아무것도 저장하지 않는다).
- SPEC-002 Lock 이 형으로 읽힌다 — `Lock.requires` 의 time 항은 `{ target: clock, query: property season, operator: IN, value: seasons }`, state 항은
  `{ target: region <ref>, query: state pattern, operator: IN, value: patterns }` 로 읽히고, 그 판정이 `isConnectorOpen` 의 답과 모든 문 · 모든 철 · 모든 패턴에서 같다.
  경계 — property · knowledge 항은 읽되 판정 불가(2층은 판정하지 않는다 · K12) — 지금처럼 문이 요구를 **표시**만 한다.
- SPEC-003 원천의 때가 형으로 읽힌다 — `occurrence.seasons` · `dayPhases` 가 clock Target 의 IN 조건으로 읽히고 그 판정이 `sourceConditions` 의 not-this-season · not-this-hour 와 같다.
- SPEC-004 위상과 결속이 형으로 읽힌다 — `RegionPhases.seasons` 의 철 키가 clock 조건으로, `LifeRequirement` 넷이 source(exists/state) · clock(property rain) · region(count population) 조건으로
  읽히고 판정이 `regionPhaseAt` · `lifeUnmetCodes` 와 같다.
  경계 — 판정이 같다는 것을 시나리오가 **철 넷 × 낮밤 둘**에서 잰다 (회귀).
- SPEC-005 검사 ㊹ — 위 넷에서 읽힌 Condition 전부의 target.ref 가 실제 id 를, query 가 그 Target 의 실제 속성을 가리키고 qualifier 가 유효하면 통과. 유령 ref · 없는 속성 · 어긋난 qualifier 는 fail.
  경계 — ㉓ · ㉖ · ㉞ 의 답은 그대로다 (겹쳐 보되 지우지 않는다).
- SPEC-006 기억이 조건이 된다 — `{ target: history <이 방>, query: history passages[SKY_WHALE_ROUTE], operator: EXISTS }` 가 고래가 이 방을 지난 적이 있을 때만 참이다.
  이 조건이 숲 가장자리 비늘 자리의 조건 데이터로 서고, 판의 조건 줄이 그것을 코드로 싣는다. (Q2 제안대로일 때 — 다른 답이면 그 사례로 바꾼다)
  경계 ① — 조건이 거짓이어도 원천의 phase · 되돌아옴 · 채취 판정은 이 Cycle 에서 달라지지 않는다 — 조건은 **읽히고 말해질 뿐** 아직 문을 열고 닫지 않는다 (여는 것은 C036 의 기회 availability).
  경계 ② — 되살린 세계에서도 같은 답이다 (history 가 PERSISTENT).
- SPEC-007 규칙 코드의 이름 0 — 어댑터 · 평가기 · 검사 어디에도 방 · 원천 · 경로 · 철의 이름 글자가 없다 (grep 이 증거).
- SPEC-008 회귀 — 검사 마흔다섯의 답 · 방 열셋의 hash · 모든 문의 열림 · 원천의 때 · 결속 · 위상이 C034 와 같다.

## State

```text
새 State 없음. STATE_VERSION 그대로(11).
조건 데이터 (content/regions — 값이 느는 일)
  FOREST_EDGE 비늘 자리의 조건 한 줄 (Q2)          { target: history, query: history passages[SKY_WHALE_ROUTE], operator: EXISTS }
읽히는 것 (저장되지 않는다)
  Condition 의 판정                              평가기가 그때그때 낸다
  직전 값(change qualifier)                        호출자가 tick 사이에 들고 준다 — State 가 아니다 (이 Cycle 에 change 를 쓰는 조건은 없다)
```

## Rule

- R1 (ADDED) RULE-CONDITION-READ-001 — IF 세계가 어떤 자리의 조건을 묻는다(문 · 원천 · 위상 · 결속) THEN 그 자리의 데이터가 Condition 형으로 읽히고 평가기가 답한다. 답은 지금의 판정 함수와 같다.
- R2 (ADDED) RULE-CONDITION-HISTORY-001 — IF Condition 의 target 이 history THEN read 는 `RegionState.history` 의 그 경로를 준다 (없으면 없음 — EXISTS 가 거짓).
- R3 (AFFECTED) RULE-LOCK-REASON-001 · RULE-SOURCE-CONDITION-001 · RULE-REGION-PHASE-001 · RULE-LIFE-BINDING-001 — 전제와 전이 그대로. 판정의 **출처**가 어댑터를 지난다 (Q1 읽기만일 때).
  Q1 이 "옮긴다" 면 넷이 CHANGED 가 되고 데이터 파일 넷이 Condition 을 직접 든다.
- R4 (ADDED · 기반) 검사 ㊹ — 참조 무결 통과/실패.
- CHANGED — 없음 (Q1 제안대로일 때).

## REUSED / ADDED

- REUSED: 위 Existing 전부.
- ADDED: Condition 형 · evaluateCondition · 검사 ㊹ · RULE-CONDITION-READ-001 · RULE-CONDITION-HISTORY-001 · 조건 표(observe) · 비늘 조건 데이터 한 줄 · 조건 코드 하나.
- AFFECTED: R3 의 넷.

## Observable (관찰 계약)

```text
entity(source).conditions                         REUSED (C014) — 코드 하나가 는다: 기억 조건이 서지 않을 때 `needs-passage`(가칭 — code-text 가 문구를 짓는다)
투영하지 않는 것   Condition 형 자체(세계는 조건의 **결과 코드**만 말한다 — R14 "규칙의 형을 말한다" 는 코드로) · 판정의 참/거짓 값 · 직전 값 ·
                 "언제 참이 되는가" · 다른 방의 조건
```

## UNRESOLVED

**없음 — 동결.** 묶음 질문 Q1~Q9 는 Human 이 "제안대로" 로 답했다 (아래 제안값이 곧 답이다). 함께 온 방향 하나 — **컨텐츠 층 작업 전까지는 기반에 집중한다. 컨텐츠는 그 기반을 표현할 예제만** —
이 Cycle 의 분해가 그것을 따른다: Condition 형 · 평가기 · 검사 ㊹ 는 기반(engine)에, 컨텐츠는 어댑터 넷과 예제 한 줄(비늘)뿐.

```text
Q1  (C035 · 빈칸 2)  조건 자리 넷을 Condition 형으로 **옮기는가**, 데이터는 두고 어댑터가 형으로 **읽기만 하는가**.
                     제안: 읽기만. 옮기면 C009 · C016 · C023 · C029 의 데이터가 CHANGED 가 되고 얻는 것은 파일 모양뿐이다. 검사 ㊹ 는 어댑터가 낸 형을 본다
Q2  (C035)           기억을 읽는 조건의 **첫 사례** — 세계 사실이라 Human 것이다.
                     제안: 숲 가장자리 비늘 자리 — "고래가 이 방을 지난 적이 있다"(passages[SKY_WHALE_ROUTE] EXISTS). 지금 코드의 사실(비늘은 고래가 지나야 난다)을
                     조건 형으로 적는 것이라 새 사실이 아니다. C037 의 Event availability 가 이 조건 위에 시간 qualifier 를 얹는다
Q3  (C036)           기회의 discovery 첫 값 — 원천마다의 채집 기회: baseline · by-product · risk · conditional 은 TRACE(흔적이 먼저 · S4),
                     world-event(비늘 · 먹이 잔해)는 SIGNAL(경로 선 · 그늘). 제안대로인가
Q4  (C036)           2층의 기회 대상 — source 를 대상으로 하는 gather 기회만인가, connector 를 대상으로 하는 cross 기회(Lock 이 있는 문)도 세우는가.
                     제안: 둘 다 — 문의 요구(Lock)가 이미 "무엇을 묻는가" 를 세웠으니 cross 기회는 그 위에 이름만 붙는다. move · observe 는 기회로 세우지 않는다
Q5  (C036)           원천마다의 기회를 **데이터로 적는가**(방 열셋 × 원천 — 손으로 서른 줄) **기본형으로 유도하는가**(원천 하나 = 채집 기회 하나 · 밝힌 방만 데이터).
                     제안: 유도 — RegionSpec.opportunities 는 기본형 밖의 것(비늘 Event · 문의 cross)만 적는다. 기획서 §5.4 T3 "원천마다 채집 기회 하나가 기본형"
Q6  (C037)           판이 때가 있는 기회의 "지금은 없다" 를 어떻게 말하는가 — 기획서 §6 11 "세계가 언제까지를 말하지 않는다".
                     제안: 「할 수 있는 것」 줄에 「— 지금은 없다」 만 붙인다. 언제 · 왜는 말하지 않는다 (흔적이 말한다 — 경로 선 · 그늘)
Q7  (C037)           비늘 Event 의 availability 시간 qualifier — 지금 코드는 recoverySeconds 240 으로 "고래가 지난 뒤 240초 안" 을 대신한다.
                     제안: { …passages[SKY_WHALE_ROUTE].lastAt, qualifier: time WITHIN 240 } 로 같은 값을 조건 형으로 적는다 — 값은 그대로, 자리만 옮긴다
Q8  (C037)           도구 셋(T2 열셋째 답 · T4 결정 나무 · T6 ㊻)을 C037 에 함께 두는가, 도구 Cycle 로 하나 더 자르는가. 제안: 함께 — 셋 다 데이터를 읽는 것뿐이다
Q9  (C034 결정 대기)  C034 가 남긴 결정 넷(먹혀서 고갈된 것도 고갈로 센다 · 밝히지 않은 방도 뒤척임을 센다 · 아라비아 숫자 · 깨어난 시각과 고갈 횟수를 판이 말하지 않는다)은
                     plan/CYCLES.md §3 묶음 절에 있다 — 이 묶음의 판정 때 함께 답한다. 지금 답하면 C035 가 받는다
```

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 평가기는 아무것도 저장하지 않는다 — change qualifier 의 직전 값은 호출자가 든다 (유도 · L1 "저장과 유도")
② 자리만인 Target · Query · chance 는 "판정 불가" 다 — 거짓으로 읽지 않는다 (그 층이 오면 같은 형에 든다)
③ 어댑터는 데이터를 바꾸지 않는다 — 넷의 파일은 한 글자도 달라지지 않는다 (Q1 제안대로일 때)
④ 기억 조건은 이 Cycle 에서 **말해질 뿐** 열고 닫지 않는다 — 여는 것은 C036 의 availability 다 (조건 → 기회 → Event 의 순서)
⑤ 조건 표는 observe 의 보고에만 선다 — 판은 조건의 형이 아니라 결과 코드만 말한다 (R14)
```
