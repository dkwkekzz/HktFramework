# C036 — 방이 기회를 내민다

묶음 「방은 기억하고 때가 되면 내민다」 의 셋째 Cycle — 묶음 블록은 [C035 spec](../C035-one-shape-of-condition/spec.md) 머리에 있다.
**동결** — 묶음 질문 Q3 · Q4 · Q5 의 답("제안대로")과 C035 마감이 남긴 「다음 Cycle 로」 여섯을 받았다.

```text
CYCLE          C036-a-room-offers
SOURCE         L2-World-Foundation §3 G2 · G3 · G6 · G9 · G11 · §4.2 Mutation op 표 · §4.5 Opportunity · §5.2 ㊺ ㊻ · §5.3 기회 표 · §6 5 Exploration Contract · §10 D2 ·
               L2-World-Material §3.3(Resource Opportunity 역할 넷 — `ResourceSourceSpec.opportunity`) · L2-World-Access §4.3 Lock(cross 기회의 요구) ·
               C035 spec(Condition 형 — availability 가 그 형이다) · C027(판의 「할 수 있는 것」 줄) · C011~C014(원천 · Interaction available/reason) ·
               C035 마감이 남긴 「다음 Cycle 로」 여섯 — 판정은 아래 §Out of Scope 와 §SPEC 경계가 진다
SELECTED_FROM  묶음 Cycle 목록 3 — "방이 기회를 내민다"
```

## Playable Goal

숲 가장자리에서 원천을 지목하면 판의 「할 수 있는 것」 줄이 **기회 데이터**에서 오고, 그 줄이 **어떻게 알게 되는 것인가**(discovery)를 함께 진다 —
밑동의 허물은 흔적이 말하고(TRACE), 비늘은 신호로 온다(SIGNAL). 세계가 판정하는 것은 지금과 한 값도 다르지 않다 — 기회는 판정하지 않고
**이름 · 발견 · 남는 것**만 붙는다. 도구는 방마다 무엇을 내미는지를 표로 보이고(㊻ · 기회 표), 그 데이터가 유령을 가리키지 않는지 검사한다(㊺).

## Experience Intent

- Start — 무엇을 할 수 있는지는 알아도 그것을 **어떻게 알게 되었는지**는 판이 말하지 않는다. 방이 내미는 것의 목록은 어디에도 없다.
- End — 방이 내민다. 어떤 것은 보이고(VISIBLE) 어떤 것은 흔적이 말하고(TRACE) 어떤 것은 신호로만 온다(SIGNAL) (묶음 Breath 의 "할 수 있는 것이 판에 선다").

## World Change

1. **Opportunity 형이 선다** (G3 · §4.5) — id · region · availability(Condition — C035 의 형) · discovery(VISIBLE · SIGNAL · TRACE · HIDDEN — NPC · KNOWLEDGE 는 자리만) ·
   target({ kind: source | area | connector | route | process, ref }) · possibleActions([observe · gather · cross · move] — 이미 있는 동사만) ·
   progress({ kind: none | counter | phase, ref: history 경로 | state 경로 }) · outcomes({ world: [Mutation op], yield: [Material | Access | Discovery | WorldInfluence] }).
   participants · rules 는 자리만. 형과 그 잎을 펴는 기구는 기반(engine)이 든다 — Condition 의 선례 그대로 게임 명사 0.
2. **RegionSpec.opportunities 가 선다** — 없으면 빈 목록. 원천마다 채집 기회 하나 · Lock 이 걸린 문마다 건너기 기회 하나는 **기본형으로 유도**되고(Q5),
   데이터에는 기본형 밖의 것만 적는다.
3. **Interaction 판정에 기회의 이름이 붙는다** — 관찰의 `InteractionView` 에 그 행동이 속한 기회의 id 와 discovery 가 실린다. available/reason 은 지금처럼 규칙이 유도한다
   (기회는 판정하지 않는다 — §4.5).
4. **판의 「할 수 있는 것」 줄이 discovery 를 말한다** — 줄의 형식 · 순서 · 거절 사유는 C027 · C028 그대로이고, 그 줄에 "어떻게 알게 되는 것인가" 한 마디가 붙는다.
   세계 위에 뜨는 글자는 늘지 않는다.
5. **Mutation op 에 이름이 붙는다** (G6 · §4.2) — 기존 Transition 을 옮기지 않고 op 표(Property SET/ADD/CLAMP · Entity CHANGE_STATE · Relation CONNECT/DISCONNECT ·
   Process START/STOP/ADVANCE/RESET · Opportunity OPEN/CLOSE/COMPLETE · Ownership GRANT)의 이름을 준다. 어느 Transition 이 어느 op 인가는 컨텐츠의 표가 적는다.
6. **검사 ㊺ ㊻** — ㊺ Opportunity 의 availability(Condition · ㊹ 재사용) · target.ref · progress.ref · outcomes.world 의 op 가 표 안 · possibleActions 가 실제 Interaction role 인가
   (통과/실패) · ㊻ 방마다 기회의 수 · discovery 종류별 수 · Event 수(availability 에 시간 qualifier 가 있는 것 — 이 Cycle 은 0) · 관계 다섯 갈래 목록
   (요약 — 판정 없음 · 기회 0 인 방 · 관계 0 인 방이 눈에 띈다). 검사는 마흔여덟이 된다.
7. `world:observe --report` 에 **기회 표**(행이 방 · 열이 기회 — id · discovery · Event 여부 · target · possibleActions · yield)와 **수명 표**(C034 의 `PERSISTENCE_TABLE` — 지금은 검사 ㊼ 만 읽는다).

## Observable Result

1. 숲 가장자리에서 밑동의 허물을 지목(Alt+클릭)하면 판의 「할 수 있는 것」 줄에 **흔적이 말한다**(TRACE)가 함께 선다. 비늘 자리를 지목하면 **신호로 온다**(SIGNAL)가 선다 —
   같은 방의 두 원천이 갈려 읽힌다. 줄의 형식 · 순서 · 거절 사유 문구는 C027 · C028 과 같다.
2. 문(건너기)의 줄도 기회에서 온다 — Lock 이 걸린 문 셋(WALKING_FOREST_DOOR · FROST_DEPTH_DOOR · MAZE_HEART_GATE)의 건너기가 그 기회의 discovery 를 진다.
3. 같은 원천에 다가가 캐면 지금과 똑같이 된다 — 거절 사유 · 거리 · 도구 · phase · 되돌아옴 판정이 한 값도 다르지 않다. 기회의 이름이 그 판정에 붙어 있을 뿐이다.
4. `world:check` 마흔여덟 — ㊺ 통과 · ㊻ 요약(방마다 기회 수 · discovery 별 수 · Event 0 · 관계 다섯 갈래). 없는 원천을 target 으로 한 기회를 넣으면 ㊺ fail,
   op 표 밖의 이름을 outcomes 에 넣어도 fail.
5. `world:observe --report` 에 기회 표와 수명 표가 선다.

## Reuse

Existing: `InteractionView`(available · reason · role · profile) · `projectObserverView` 의 interactions(harvest-source · transit-connector · move-to …) · 판의 「할 수 있는 것」 줄
(C027 · `targetFrame` · `placeRows` · `beingRows`) · `ResourceSourceSpec.opportunity`(baseline · by-product · risk · conditional · world-event — Material 역할 넷 + 세계 사건) ·
`Lock` · `LOCKS` · `lockOfConnector` · Condition 형 + `evaluateCondition` + `conditionLeaves` + `worldConditionVocabulary`(C035) · `lockCondition` · `sourceOccurrenceCondition`(C035 어댑터) ·
검사 묶음(`CheckReport` · `CheckItem` · ㊹ · ㊼) · `world:observe --report` · `PERSISTENCE_TABLE`(C034) · `sourcesInRegion` · `regionExitsOf`.

Added:

- Engine · `engine/world-authoring/opportunity.ts` — `Opportunity` 형 · `OpportunityDiscovery` · `OpportunityTarget` · `OpportunityProgress` · `Mutation` · `MUTATION_OPS`(§4.2 표의 군 × op 어휘) ·
  `opportunityRefs(opportunity)`(참조 잎 펴기) · `formatOpportunity`. 게임 명사 0 · 저장 0 · 판정 0.
  검사 ㊺(`opportunity-refs`) · ㊻(`opportunity-summary`) — 계약 목록(Target 갈래마다 실제 id · Interaction role 어휘 · 관계 다섯 갈래)은 컨텐츠가 건넨다(`CheckOpportunity`).
- World · `content/world/semantic/mutation.ts` — `MUTATION_BINDINGS`(지금 그것인 Transition ↔ op — RULE id 로 인용) · `RULE-OPPORTUNITY-NAME-001`(관찰의 Interaction 에 기회 id · discovery 를 붙인다).
- Protocol · `InteractionView.opportunity?: { id, discovery }`.
- View · 「할 수 있는 것」 줄의 discovery 한 마디 — discovery 코드 셋의 문구(`code-text`). 세계 위 글자 0.
- 데이터 (content/regions) · `content/regions/opportunity.ts` — `RegionOpportunity` 목록 · `opportunitiesOf(regionId)`(기본형 유도 + 데이터 덮어쓰기) · `ALL_OPPORTUNITIES` 색인 ·
  `RegionSpec.opportunities?`. 데이터로 적는 것: 숲 가장자리 비늘의 기회(discovery SIGNAL · availability = 기억 조건) · Lock 이 걸린 문 셋의 cross 기회.
- 도구 · `world:observe --report` 기회 표 · 수명 표.

## Out of Scope

- Event(시간 qualifier · progress 값 · outcomes 의 실제 op 대조 · yield 열 넷의 실제 값) → C037. 여기서 outcomes · progress 는 **자리와 이름만**이고 아무것도 굴리지 않는다.
- Opportunity 의 OPEN/CLOSE/COMPLETE 전이 · **availability 의 평가** → C037. 이 Cycle 은 availability 를 데이터로 적고 참조 무결만 잰다 — 여는 것도 닫는 것도 아니다.
  따라서 "판정 불가(undecidable)를 닫힘으로 읽는가"(C035 결정 대기)는 C037 이 정한다.
- `history.births` 에 한 줄을 더하는 것(C034 가 자리만 둔 것) → C037 — 이 Cycle 의 어떤 기회도 그 경로를 progress 로 쓰지 않는다.
- `worldConditionReader` 의 area · connector · process Target 읽기 → 그것을 조건으로 쓰는 Cycle. cross 기회의 target 은 **참조**이지 Condition 이 아니므로 이 Cycle 에 읽기가 늘지 않는다.
- participants(3층) · rules(등급 B) · NPC · KNOWLEDGE discovery · HIDDEN 기회의 발견 절차 → 그 층 (형에 자리만).
- 17 활동군 중 2층 밖(전투 · 제작 · NPC · 퍼즐 · 경제 …) → 그 층 (같은 형에 든다 — 기획서 §2 ⑦).
- 기회 표의 「지금 참인가」 열 → 없다. C035 조건 표의 「지금」 이 갓 선 세계(t=0)의 값인 것과 같은 자리라 열을 두지 않는다.

## SPEC

- SPEC-001 형이 선다 — Opportunity 하나가 §4.5 의 항목 여덟(participants · rules 는 자리만)으로 적히고 `RegionSpec.opportunities` 에 든다. 밝히지 않은 방은 빈 목록이다.
  경계 ① — availability 에 쓰는 Condition 은 판정 가능한 갈래만 쓴다 (자리만인 Target actor · player · faction 과 Query distance · contains · relation · capability · knowledge · chance 는
  이 Cycle 의 데이터에 없다 — 형에는 그대로 있다). 경계 ② — discovery 는 넷 중 하나이고 이 Cycle 의 데이터에 HIDDEN 은 없다.
- SPEC-002 채집 기회의 기본형 유도 — 원천이 있는 방은 원천마다 채집 기회 하나가 유도된다: id `gather:<sourceId>` · region 그 방 · availability = 그 원천의 조건
  (C035 `sourceOccurrenceCondition` · 원천이 밝힌 `condition` — 둘 다 없으면 항상 참) · discovery = 역할 표(Q3: baseline · by-product · risk · conditional → TRACE · world-event → SIGNAL) ·
  target { source, 그 원천 id } · possibleActions [gather] · progress { counter, `sources.<id>.takenTotal` } · outcomes { world: [Entity CHANGE_STATE], yield: [Material] }.
  경계 — 데이터에 같은 id 를 적으면 데이터가 이긴다(덮어쓴다). 원천이 없는 방은 채집 기회가 0 이다.
- SPEC-003 건너기 기회의 기본형 유도 — Lock 이 걸린 Connector 마다 건너기 기회 하나가 유도된다: id `cross:<connectorId>` · region 그 Lock 이 선 방 · availability = 그 Lock 의 조건
  (C035 `lockCondition`) · discovery VISIBLE(문은 보인다) · target { connector, 그 문 id } · possibleActions [cross] · progress { none } · outcomes { world: [], yield: [Access] }.
  경계 — Lock 이 없는 문은 기회가 서지 않는다 (이 Cycle 은 "묻는 문" 만 이름을 준다).
- SPEC-004 이름이 붙는다 — 관찰의 harvest-source · transit-connector Interaction 에 그 행동이 속한 기회의 id 와 discovery 가 실린다. 기회가 없는 행동(move-to · 스킬 · 명령)에는 실리지 않는다.
  경계 — available · reason · role · profile · 순서는 한 값도 달라지지 않는다 (회귀 — C011~C014 · C027 · C029 시나리오).
- SPEC-005 판이 discovery 를 말한다 — 「할 수 있는 것」 줄에 그 기회의 discovery 한 마디가 붙는다(VISIBLE · TRACE · SIGNAL). 기회가 없는 줄은 지금 그대로다.
  경계 ① — 줄의 형식 · 순서 · 거절 사유 문구는 C027 · C028 과 같다. 경계 ② — discovery 는 무엇을 할 수 있는가를 **바꾸지 않는다** (판정은 규칙의 것이다).
- SPEC-006 op 이름 — 기존 Transition 다섯 군(소란 Property ADD+CLAMP · 원천 phase Entity CHANGE_STATE · Connector 활성 Relation CONNECT/DISCONNECT ·
  되돌아옴 Process START/STOP/ADVANCE/RESET · 채취 Ownership GRANT)에 op 표의 이름이 붙는다 — 코드는 옮기지 않는다.
  경계 — 표에 적힌 op 는 전부 §4.2 의 op 어휘 안이고, 기회의 outcomes.world 에 쓰인 op 도 전부 그 어휘 안이다.
- SPEC-007 검사 ㊺ — 모든 Opportunity 의 availability Condition(㊹ 의 잣대) · target.ref 실재 · progress.ref 가 읽을 수 있는 경로 · outcomes.world 의 op 가 표 안 ·
  possibleActions 가 실제 Interaction role 이면 통과. 어느 하나라도 어긋나면 fail.
  경계 — ㊹ 의 답은 그대로다 (겹쳐 보되 지우지 않는다).
- SPEC-008 검사 ㊻ — 방마다 기회 수 · discovery 별 수 · Event 수 · 관계 다섯 갈래(공간 · 환경 · 생태 · 사건 · 사회) 목록을 보고한다. 판정 없음(report) · 두 번 돌려도 글자까지 같다.
  경계 — 기회가 0 인 방 · 관계가 0 인 방이 그 표에서 드러난다 (백왕령은 원천이 없어 채집 기회가 0 이다 · 사회 관계는 어느 방에도 없다).
- SPEC-009 회귀 — 검사 마흔여섯의 답 · 방 열셋의 hash · 문의 열림 · 원천의 때와 되돌아옴 · 결속 · 위상이 C035 와 같다. 규칙 코드에 기회의 이름 글자가 없다.

## State

```text
새 State 없음. STATE_VERSION 그대로(11). 기회는 데이터와 유도된 사실이고 저장되지 않는다.
데이터 (content/regions)
  RegionSpec.opportunities?       기본형 밖의 것만 — FOREST_EDGE 비늘(discovery SIGNAL · availability = 기억 조건) ·
                                  FOREST_DEEP · FROST_CANYON · FANTASY_MAZE 의 문 셋의 cross 기회
  MUTATION_BINDINGS               지금 그것인 Transition ↔ op (content/world/semantic — RULE id 로 인용)
유도되는 것 (저장하지 않는다)
  원천마다의 채집 기회 · Lock 이 걸린 문마다의 건너기 기회      opportunitiesOf(regionId)
  Interaction 에 붙는 기회 id · discovery                    projectObserverView 가 그때그때 붙인다
```

## Rule

- R1 (ADDED) RULE-OPPORTUNITY-NAME-001 — IF 관찰이 어떤 Interaction 을 싣는다 AND 그 행동이 어느 기회의 possibleActions 에 속하고 그 기회의 target 이 그 대상이다
  THEN 그 Interaction 에 기회 id 와 discovery 가 실린다. 경계 — 판정(available · reason)은 이 규칙이 만지지 않는다.
- R2 (AFFECTED) RULE-OBSERVE-PROJECTION — 싣는 것이 는다 (판정은 그대로).
- R3 (ADDED · 기반) 검사 ㊺ ㊻.
- CHANGED — 없음.

## REUSED / ADDED

- REUSED: 위 Existing 전부.
- ADDED: Opportunity 형 · MUTATION_OPS · opportunityRefs · 검사 ㊺ ㊻ · RULE-OPPORTUNITY-NAME-001 · opportunitiesOf · RegionSpec.opportunities ·
  MUTATION_BINDINGS · `InteractionView.opportunity` · discovery 문구 셋 · 기회 표 · 수명 표.
- AFFECTED: RULE-OBSERVE-PROJECTION.

## Observable (관찰 계약)

```text
interaction.opportunity?          { id, discovery }   — 그 행동이 속한 기회 (없으면 없음 · discovery 는 VISIBLE · SIGNAL · TRACE · HIDDEN 중 하나)
투영하지 않는 것   기회의 availability(Condition) · outcomes · progress 값 · target · possibleActions 전체 · "언제 열리는가" ·
                 HIDDEN 기회의 존재 · 그 방의 기회 전체 목록(판은 지목한 대상의 것만 말한다)
```

## UNRESOLVED

**없음 — 동결.** 묶음 질문 Q3(discovery 첫 값) · Q4(cross 기회도 세운다) · Q5(기본형 유도)는 Human 이 "제안대로" 로 답했다.
C035 마감이 남긴 「다음 Cycle 로」 여섯은 판정했다 — 넷은 위 SPEC · Out of Scope 가 받고(availability 를 평가하지 않는다 · 자리만인 갈래를 데이터에 쓰지 않는다 ·
connector 읽기는 늘지 않는다 · 기회 표에 「지금」 열을 두지 않는다), 둘은 넘긴다(`history.births` → C037 · 수명 표 → World Change 7 로 받았다).

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 기회는 판정하지 않는다 — availability 는 데이터로 적히고 이 Cycle 에서 평가되지 않는다 (여는 것은 C037)
② 기본형 유도는 저장되지 않는다 — 방을 읽을 때마다 같은 목록이 선다 (같은 id 를 데이터에 적으면 데이터가 이긴다)
③ Lock 이 없는 문에는 건너기 기회가 서지 않는다 — 이 Cycle 은 "묻는 문" 만 이름을 준다
④ discovery 는 관찰의 무엇도 자르지 않는다 — HIDDEN 이 데이터에 없으므로 "서지 않는 줄" 은 이 Cycle 에 없다
⑤ observe 나 move 는 기회로 세우지 않는다 (Q4 제안 그대로) — 관찰은 늘 할 수 있고 이동은 기회가 아니다
⑥ 기회 id 는 `gather:<sourceId>` · `cross:<connectorId>` 로 유도한다 — 코드의 자리이지 게임 이름이 아니다
```
