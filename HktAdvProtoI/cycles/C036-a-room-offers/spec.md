# C036 — 방이 기회를 내민다

묶음 「방은 기억하고 때가 되면 내민다」 의 셋째 Cycle — 묶음 블록은 [C035 spec](../C035-one-shape-of-condition/spec.md) 머리에 있다.
**초안** — C035 마감이 남긴 「다음 Cycle 로」 를 받아 자기 차례("C036 진행")에 동결한다. 묶음 질문 Q3 · Q4 · Q5 의 답이 이 spec 에 든다.
**기반 Cycle** (행 L2 · Design-CycleExecutionWorkflow §21) — 닫는 것은 제공 · 작동 · 손잡이다. 경험(판의 문구 · 줄의 순서 · 읽히는가)은 판정하지 않고 Data Knobs 로 내린다.

```text
CYCLE          C036-a-room-offers
SOURCE         L2-World-Foundation §3 G2 · G3 · G11 · §4.5 Opportunity · §4.2 op 표(이름만) · §5.2 ㊺ ㊻ · §5.3 기회 표 · §6 5 Exploration Contract · §10 D2 ·
               L2-World-Material §3.3(Resource Opportunity 역할 넷) · L2-World-Access §4.3 Lock(cross 기회의 요구) ·
               C035 spec(Condition 형 — availability 가 그 형이다) · C027(판의 「할 수 있는 것」 줄) · C011~C014(원천 · Interaction available/reason)
SELECTED_FROM  묶음 Cycle 목록 3 — "방이 기회를 내민다"
```

## Foundation Goal

- **기구** (engine) — 검사 ㊺ `opportunity-refs`(참조 무결 · op 표 대조 · possibleActions 가 실제 role) · ㊻ `opportunity-summary`(방마다 기회 수 · discovery 별 · Event 수 · 관계 다섯 갈래 — 판정 없음).
  계약 목록(op 표 · Interaction role · discovery 어휘)은 컨텐츠가 건넨다 — 게임 명사 0.
- **계약** (컨텐츠가 데이터로 채운다) — Opportunity 형(§4.5 항목 여덟 · 둘은 자리만) · `RegionSpec.opportunities`(기본형 밖의 것만) · 원천 → 채집 기회 **기본형 유도**(`opportunitiesOf(region)`) ·
  원천 역할 → discovery 기본형 표(Q3) · Mutation op 이름 표(G6) · `InteractionView.opportunity { id, discovery }`. 기회는 **판정하지 않는다** — 이름 · 발견 · 남는 것만 붙는다.
- **예제** (이 세계의 데이터 한 줄) — 숲 가장자리: 원천 여덟의 채집 기회(유도 · TRACE) · 비늘(데이터 · SIGNAL · availability = C035 의 기억 조건) · Lock 있는 문의 cross 기회(Q4).
  판의 「할 수 있는 것」 줄이 그 데이터에서 선다. 백왕령은 건너기뿐 — ㊻ 이 "기회 1 · gather 0" 으로 보인다.

## Data Knobs

컨텐츠가 코드 없이 바꾸는 것 — 자리가 함수 안의 상수면 spec 미달이다. 기본값은 이 Cycle 의 예제다.

```text
손잡이                                          자리                                                          기본값
어느 방이 무엇을 내미는가 (기본형 밖의 기회 · 덮어쓰기)   RegionSpec.opportunities (content/regions/<방>.ts)                  FOREST_EDGE 비늘 · 문의 cross 만
원천 역할 → discovery 기본형                          content/regions 의 표 하나 (역할 다섯 → discovery)                    baseline·by-product·risk·conditional → TRACE · world-event → SIGNAL (Q3)
cross 기회를 세우는 문                               유도 — Lock 이 있는 문 전부 · 데이터로 빼거나 더한다 (같은 id 는 데이터가 이긴다)   Lock 있는 문 전부 (Q4)
Mutation op 표 (군 · op · 지금 그것인 Transition)       content 데이터 (§4.2 표 그대로)                                       기획서 §4.2
discovery 별 판의 표현 · 줄 형식 · 순서 · HIDDEN 을 숨김   content/view 표 · code-text                                         C027 의 줄 형식 그대로 · HIDDEN 만 숨김
기회 표 · 수명 표의 열                                tools observe 보고 (읽기 전용)                                        —
```

## World Change

1. **Opportunity 형이 선다** (G3 · §4.5) — id · region · availability(Condition — C035 의 형) · discovery(VISIBLE · SIGNAL · TRACE · HIDDEN — NPC · KNOWLEDGE 는 자리만) ·
   target({ source | area | connector | route | process }) · possibleActions([observe · gather · cross · move] — 이미 있는 동사만) · progress({ none | counter | phase, ref }) ·
   outcomes({ world: [Mutation op], yield: [Material | Access | Discovery | WorldInfluence] }). participants · rules 는 자리만.
2. **RegionSpec.opportunities** 가 선다 — 없으면 빈 목록. 원천마다 채집 기회 하나는 **기본형으로 유도**되고(Q5 제안) 데이터에는 기본형 밖의 것만 적는다.
3. **Interaction 판정에 기회의 이름이 붙는다** — `InteractionView` 에 그 행동이 속한 기회의 id 와 discovery. available/reason 은 지금처럼 규칙이 유도한다 (기회는 판정하지 않는다).
4. **판의 「할 수 있는 것」 줄의 출처가 기회 데이터가 된다** (C027 재사용 · 줄 형식 그대로). 세계 위에 뜨는 글자는 늘지 않는다.
5. **Mutation op 에 이름이 붙는다** (G6) — 기존 Transition 을 옮기지 않고 op 표(Property SET/ADD/CLAMP · Entity CHANGE_STATE · Relation CONNECT/DISCONNECT ·
   Process START/STOP/ADVANCE/RESET · Opportunity OPEN/CLOSE/COMPLETE · Ownership GRANT)의 이름을 준다. 검사 ㊺ 가 outcomes.world 의 op 가 표 안인지 본다.
6. **검사 ㊺ ㊻** — ㊺ Opportunity 의 availability · target · outcomes 참조 무결 + op 표 + possibleActions 가 실제 Interaction role (통과/실패) ·
   ㊻ 방마다 기회의 수 · discovery 종류별 수 · Event 수 · 관계 다섯 갈래 목록 (요약 — 판정 없음 · 기회 0 인 방 · 관계 0 인 방이 눈에 띈다).
7. `world:observe --report` 에 **기회 표** (행이 방 · 열이 기회 — discovery · Event 여부 · target · yield) 와 **수명 표**(C034 의 PERSISTENCE_TABLE 을 보고에).

## Observable Result

도구 · State 가 먼저다 — 화면은 예제 하나.

1. `world:check` 마흔여덟 — ㊺ 통과 · ㊻ 요약(방마다 기회 수 · discovery 별 · Event 0 · 관계 갈래). 일부러 없는 원천을 target 으로 한 기회를 넣으면 ㊺ fail. op 표 밖의 이름을 outcomes 에 넣으면 fail.
2. `world:observe --report` 기회 표(행이 방 · 열이 기회 — discovery · Event 여부 · target · yield) · 수명 표(C034 의 PERSISTENCE_TABLE).
3. 관찰 봉투 — harvest-source · transit-connector Interaction 에 `opportunity { id, discovery }` 가 실린다. move-to · skill 에는 없다.
4. 같은 원천에 다가가 캐면 지금과 똑같이 된다 — 거절 사유 · 거리 · 도구 · phase 판정이 한 값도 다르지 않다 (회귀). 기회의 이름이 그 판정에 붙어 있을 뿐이다.
5. 예제 화면 — 숲 가장자리의 판 「할 수 있는 것」 이 기회 데이터에서 선다: 원천 여덟의 채집(TRACE) · 비늘(SIGNAL) · Lock 있는 문의 건너기(cross). 줄 형식은 C027 과 같다.
   백왕령은 건너기뿐 (원천이 없는 방 · 기획서 "결핍이 아니라 조건"). 그림은 이 둘.

## Module Check

모듈마다 무엇이 단언하나 — 하나라도 비면 "작동" 미달.

```text
모듈                                     단언
검사 ㊺ ㊻ (engine)                       engine/world-authoring/tests (check) — 통과 · 유령 target fail · op 표 밖 fail · 두 번 돌려도 같다 · 계약 목록 없이는 absent
Opportunity 형 · 기본형 유도 (world)        시나리오 SPEC-001 · SPEC-002 (원천마다 하나 · 같은 id 는 데이터가 이긴다)
RULE-OPPORTUNITY-NAME-001 (world)          SPEC-003 + 회귀 (available/reason 불변 — C011~C014 · C029 시나리오 재실행)
관찰 봉투 opportunity (protocol)            SPEC-003 의 봉투 단언 (있는 행동 · 없는 행동)
판의 「할 수 있는 것」 (view)                content/view/tests — discovery 별로 선다 · HIDDEN 은 안 선다 · 줄 형식 · 순서는 C027 과 같다
op 이름 표 (data)                          SPEC-005 (Transition 다섯 군이 표 안이다 — 코드는 안 옮겼다)
observe 기회 표 · 수명 표 (tools)            tools/world-editor/tests (observe) — 열 · 두 번 돌려도 같다
손잡이                                     SPEC-009
명사 0                                    SPEC-008 (grep)
```

## Reuse

Existing: `InteractionView`(available · reason · role) · `projectObserverView` 의 interactions(harvest-source · transit-connector · move-to …) · 판의 「할 수 있는 것」 줄(C027 · `being.offer`) ·
`ResourceSource.opportunity`(baseline · by-product · risk · conditional · world-event — Material 역할) · `Lock` · Condition 형 + 평가기(C035) · 검사 묶음 · observe 보고 · `PERSISTENCE_TABLE`(C034).

Added:
- World · Opportunity 형(content/regions) · `RegionSpec.opportunities` · 원천 → 채집 기회 기본형 유도(`opportunitiesOf(region)`) · `RULE-OPPORTUNITY-NAME-001`(Interaction 에 기회 id · discovery 를 붙인다) ·
  Mutation op 이름 표(content — 데이터).
- Protocol · `InteractionView.opportunity?: { id, discovery }`.
- View · 「할 수 있는 것」 줄이 기회에서 — discovery 별 표현(문구는 code-text) · 세계 위 글자 0.
- Engine · 검사 ㊺(`opportunity-refs`) ㊻(`opportunity-summary` + 관계 목록) — 계약 목록(op 표 · Interaction role · discovery 어휘)은 컨텐츠가 건넨다.
- 도구 · observe 기회 표 · 수명 표.
- 데이터 · FOREST_EDGE.opportunities — 기본형 밖의 것: 비늘(Event 는 C037 이 시간 qualifier 를 얹는다 — 여기서는 availability 가 C035 의 기억 조건 · discovery SIGNAL) · 문의 cross 기회(Q4).

## Out of Scope

- Event(시간 qualifier · progress · outcomes 의 실제 op 대조 · yield 열 넷의 실제 값) → C037. 여기서 outcomes 는 자리와 이름만.
- Opportunity 의 OPEN/CLOSE/COMPLETE 전이 → C037.
- participants(3층) · rules(등급 B) · NPC · KNOWLEDGE discovery → 자리만.
- 17 활동군 중 2층 밖(전투 · 제작 · NPC · 퍼즐 · 경제 …) → 그 층 (같은 형에 든다 — 기획서 §2 ⑦).

## SPEC

- SPEC-001 형이 선다 — Opportunity 하나가 §4.5 의 항목 여덟(둘은 자리만)으로 적히고 `RegionSpec.opportunities` 에 든다. 없는 방은 빈 목록.
- SPEC-002 기본형 유도 — 원천이 있는 방은 원천마다 채집 기회 하나가 유도된다: id `gather:<sourceId>` · availability = 그 원천의 조건(C035 어댑터 — occurrence · 없으면 항상 참) ·
  discovery = Q3 표 · target source · possibleActions [gather] · progress { counter, history.sources[id].takenTotal } · outcomes { world: [Entity CHANGE_STATE], yield: [Material] }.
  경계 — 데이터에 같은 id 를 적으면 데이터가 이긴다 (덮어쓴다).
- SPEC-003 이름이 붙는다 — 관찰의 harvest-source · transit-connector Interaction 에 그 행동이 속한 기회의 id 와 discovery 가 실린다. 기회가 없는 행동(move-to · skill)은 실리지 않는다.
  경계 — available/reason 은 한 값도 달라지지 않는다 (회귀 — C011~C014 · C029 시나리오).
- SPEC-004 판이 기회에서 말한다 — 「할 수 있는 것」 줄의 출처가 기회 목록이다. discovery 가 HIDDEN 인 기회는 줄에 서지 않는다(발견 전). TRACE · SIGNAL · VISIBLE 은 선다 — 표현의 차이는 view 의 표.
  경계 — 줄의 형식 · 순서 · 거절 사유 문구는 C027 · C028 과 같다.
- SPEC-005 op 이름 — 기존 Transition 다섯 군(소란 ADD+CLAMP · 원천 phase CHANGE_STATE · Connector 활성 CONNECT/DISCONNECT · 되돌아옴 START/STOP/ADVANCE/RESET · 채취 GRANT)에 op 표의 이름이 붙는다 —
  코드는 옮기지 않는다. 검사 ㊺ 가 outcomes.world 의 op 를 이 표로 대조한다.
- SPEC-006 검사 ㊺ — availability 의 Condition 참조(㊹ 재사용) · target.ref 실재 · outcomes.world 의 op 가 표 안 · possibleActions 가 실제 role. 어느 하나 어긋나면 fail.
- SPEC-007 검사 ㊻ — 방마다 기회 수 · discovery 별 수 · Event 수(availability 에 시간 qualifier 가 있는 것 — 이 Cycle 은 0) · 관계 다섯 갈래(공간 · 환경 · 생태 · 사건 · 사회) 목록. 판정 없음 · 두 번 돌려도 같다.
- SPEC-008 회귀 · 명사 0 — 검사 마흔여섯의 답 · hash · 모든 판정이 C035 와 같다. 규칙 코드 · 검사 ㊺ ㊻ · 유도기에 방 · 원천 · 문 · 기회의 이름 글자가 없다 (grep).
- SPEC-009 손잡이 (데이터 교체 · 코드 diff 0) — 변형 방 하나(선례 c004 `VARIANT_ROOM`)에 ① 기본형 밖의 기회를 데이터로 더하고 ② 유도된 채집 기회 하나를 같은 id 로 덮어써 discovery 를 바꾸고
  ③ 역할 → discovery 표의 한 줄을 바꾸면 — 봉투의 `opportunity` · ㊻ 의 수 · 판의 줄이 그것을 따른다. world · view 코드는 한 줄도 바뀌지 않는다.
  경계 — 표 밖의 discovery 값 · 없는 원천을 가리키는 덮어쓰기는 ㊺ 가 fail 로 잡는다 (조용히 무시하지 않는다).

## State

```text
새 State 없음. STATE_VERSION 그대로.
데이터 (content/regions)
  RegionSpec.opportunities        기본형 밖의 것만 — FOREST_EDGE: 비늘(discovery SIGNAL · availability = 기억 조건) · 문의 cross (Q4)
  Mutation op 이름 표             군 · op · 지금 그것인 Transition (기획서 §4.2 표 그대로 · 데이터)
유도되는 것
  원천마다의 채집 기회             opportunitiesOf(region) — 저장하지 않는다
```

## Rule

- R1 (ADDED) RULE-OPPORTUNITY-NAME-001 — IF 관찰이 어떤 Interaction 을 싣는다 AND 그 행동이 어느 기회의 possibleActions 에 속한다 THEN 그 Interaction 에 기회 id 와 discovery 가 실린다.
  경계 — 판정(available/reason)은 이 규칙이 만지지 않는다.
- R2 (AFFECTED) RULE-OBSERVE-PROJECTION — 싣는 것이 는다.
- R3 (ADDED · 기반) 검사 ㊺ ㊻.
- CHANGED — 없음.

## Observable (관찰 계약)

```text
interaction.opportunity?          { id, discovery }   — 그 행동이 속한 기회 (없으면 없음)
투영하지 않는 것   기회의 availability(Condition) · outcomes · progress 값 · "언제 열리는가" · HIDDEN 기회의 존재
```

## UNRESOLVED

묶음 질문 Q3 · Q4 · Q5 (C035 spec) 의 답이 이 spec 에 든다. 동결은 자기 차례 — C035 마감이 남긴 「다음 Cycle 로」 를 반영한 뒤.
이 spec 에서 새로 생긴 의미: 없음 (기본형 ① — 기본형 유도의 discovery 는 Q3 · 이름 `gather:<sourceId>` 는 코드의 자리이지 게임 의미가 아니다).
경험 값은 묻지 않는다 — discovery 별 표현 · 줄의 순서 · 문구는 Data Knobs 의 view 표에 기본값으로 둔다 (판정은 이 축을 처음 쓰는 컨텐츠 묶음).
계약 결정으로 묻는 것 하나 — **availability 가 「판정 불가」 를 어떻게 읽는가** (C035 결정 대기 · 기본형: 닫힘으로 읽지 않는다 — 판정 불가는 "이 층이 답하지 않는다" 이고 기회는 판정하지 않으므로 값이 없다). 기반 검토 때 답한다.
