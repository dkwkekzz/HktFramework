# C037 — 때가 있는 기회

묶음 「방은 기억하고 때가 되면 내민다」 의 넷째이자 마지막 Cycle — 묶음 블록은 [C035 spec](../C035-one-shape-of-condition/spec.md) 머리에 있다.
**초안** — C036 마감이 남긴 「다음 Cycle 로」 를 받아 자기 차례("C037 진행")에 동결한다. 묶음 질문 Q6 · Q7 · Q8 의 답이 이 spec 에 든다.
**기반 Cycle** (행 L2 · Design-CycleExecutionWorkflow §21) — 이 Cycle 이 합쳐지면 묶음의 **AI 기반 예심 → Human 기반 검토**다 (실주행이 아니다 — 계약 · 경계 · 손잡이를 읽고 답한다).

```text
CYCLE          C037-an-opportunity-with-a-time
SOURCE         L2-World-Foundation §3 G4 · G6 · G11 · G13 · §4.2 op 표 · §4.5 progress · outcomes · §5.3 · §5.4 T2 열셋째 답 · T4 결정 나무 · T6 ㊻ · §8 기준 23 · 24 · §10 D3 ·
               L2-World-Time 2.6(경로 · leavesBehind) · RoomNeverSame 확정 9(비늘 — 고래가 다시 지나면 돌아온다 · 시간이 아니다) ·
               L2-World-Tool-Scale §2(등급) · §3 T2 · T4 · T6 · C035(Condition · 기억 조건) · C036(Opportunity · 기본형 · ㊺ ㊻) · C018(FALLEN_SCALE · recoveryCause)
SELECTED_FROM  묶음 Cycle 목록 4 — "때가 있는 기회"
```

## Foundation Goal

- **기구** (engine) — 없음 예정. 시간 qualifier(WITHIN · AFTER · FOR)는 C035 의 평가기가 이미 판정한다. T4 결정 나무는 grade 의 데이터, T6 ㊻ 은 lab 이 검사 보고를 읽는 것.
- **계약** (컨텐츠가 데이터로 채운다) — **Event = availability 에 시간 qualifier 가 있는 기회** (별도 Event 시스템 없음 · G4) · `progress` 가 history 경로를 가리킨다(유도) ·
  `outcomes { world: [op], yield: [열] }` 가 op 표(C036)와 Yield 표(열 열넷 · 2층 값 넷 · G11)로 대조된다 · 기회의 OPEN/CLOSE/COMPLETE 는 **유도**(저장되는 기회 State 없음 — 원천 phase 와 history 가 든다) ·
  `InteractionView.opportunity.event · open` · brief 의 열셋째 답 · grade 의 결정 나무 · lab 의 ㊻.
- **예제** (이 세계의 데이터 한 줄 — 둘) — 숲 가장자리의 비늘(`passages[SKY_WHALE_ROUTE].lastAt WITHIN 240` · 되돌리는 것은 시간이 아니라 다시 지나감 · RoomNeverSame 확정 9)과
  먹이 잔해(PREY_REMAINS · BLIND_HUNTER_ROUTE — **같은 형에 데이터 한 줄 · 코드 0**: 이것이 곧 손잡이 실측이다). 판은 닫힌 Event 에 「— 지금은 없다」 만 붙인다 — 언제 · 왜는 말하지 않는다.
  세계의 첫 Event 가 채집이고 전투가 아니다 (기획서 §8 기준 23 · 24).

## Data Knobs

```text
손잡이                                          자리                                                        기본값
어느 기회가 Event 인가 · 그 창(WITHIN 값)           RegionSpec.opportunities[<id>].availability (content/regions)      비늘 240 · 먹이 잔해는 지금 코드의 recoverySeconds (기본형 ①)
무엇이 창을 여는가 (어느 경로의 lastAt)              같은 자리 — history 경로                                        SKY_WHALE_ROUTE · BLIND_HUNTER_ROUTE
progress 가 가리키는 셈                           같은 자리 — history 경로                                        sources[<id>].takenTotal
outcomes 의 op · yield 열                         같은 자리 · op 표(C036) · Yield 표 (content 데이터)                 [CHANGE_STATE · GRANT] · [Material · WorldInfluence]
Yield 표의 열과 2층이 값을 가지는 열                  content 데이터 (열 열넷)                                         앞 넷만 값
닫힌 Event 를 판에 세우는가 · 그 문구 · 여는 창을 말하는가   content/view 표 · code-text                                     세운다 · 「— 지금은 없다」 · 창은 말하지 않는다 (Q6 · 확정 9)
T4 결정 나무 (일곱 질문 → A/B/C)                   content/authoring 데이터 (grade 의 입력)                            기획서 §5.4
```

## World Change

1. **Event = 시간 qualifier 를 가진 기회** (G4) — 별도 Event 시스템 없음. 비늘 기회의 availability = `all [ passages[SKY_WHALE_ROUTE] EXISTS (C035), { target: history passages[SKY_WHALE_ROUTE].lastAt,
   qualifier: time WITHIN 240 } ]` (Q7 제안). 지금 코드의 `recoverySeconds 240` 이 이 조건으로 옮겨 적힌다 — 값은 그대로.
2. **progress 가 history 경로를 가리킨다** (§4.5 — 유도 · 저장하지 않는다) — 비늘: `{ counter, history.sources[FALLEN_SCALE].takenTotal }`.
3. **outcomes 가 실제로 대조된다** — 비늘 채취의 world = [Entity CHANGE_STATE(원천 phase) · Ownership GRANT(Material)] · yield = [Material(WHALE_SCALE) · WorldInfluence(소란)].
   검사 ㊺ 가 op 표(C036)로 대조한다. Yield 표의 나머지 열은 있고 값이 0 (G11).
4. **기회가 열리고 닫힌다** (Opportunity OPEN/CLOSE/COMPLETE 의 이름) — availability 가 참이면 OPEN, 주우면 COMPLETE, 거짓이면 CLOSE. 전부 **유도**다 — 저장되는 기회 State 는 없다
   (원천 phase 와 history 가 이미 그것을 든다).
5. **판이 "지금은 없다" 를 갈라 말한다** (Q6 제안) — Event 인 기회는 availability 가 거짓일 때도 「할 수 있는 것」 줄에 서되 「— 지금은 없다」 가 붙는다. 언제까지 · 왜는 말하지 않는다.
   Event 가 아닌 기회(원천의 채집)는 지금처럼 phase 의 사유로 말한다.
6. **도구 셋** (Q8 제안 — 함께) — T2 열셋째 답(brief 에 "무엇을 할 수 있고 무엇을 기억하는가") · T4 결정 나무(기획서 §14 일곱 질문 → A/B/C — 등급 판정기의 입력) ·
   T6 ㊻ 편중 요약(lab 에 기회 밀도). content/authoring 의 계약 목록에 기회 계약(availability · discovery · target · outcomes · op 표 · discovery 어휘)이 든다.

## Observable Result

도구 · State 가 먼저다 — 화면은 예제 하나.

1. `world:check` ㊻ 에 Event 2 (숲 가장자리의 비늘 · 먹이 잔해의 방). ㊺ 통과 — outcomes 의 op 가 표 안이고 yield 가 표의 열이다.
2. `world:observe --report` 기회 표에 비늘 행 — discovery SIGNAL · Event 예 · target FALLEN_SCALE · yield Material. 먹이 잔해 행도 같은 열로.
3. 관찰 봉투 — 비늘의 Interaction 에 `opportunity.event true` · `open` 이 고래가 지난 시각으로부터 240 초 안이면 true, 밖이면 false · 원천 phase 의 available 과 같은 답.
4. `world:author` 의 brief 에 열셋째 답 자리 · `world:grade` 가 결정 나무로 A/B/C 를 낸다 (가스 마을 · 유령 도시 · 마법도시가 지금과 같은 등급) · `world:lab` 편중 요약에 ㊻.
5. 회귀 — 먹이 잔해(PREY_REMAINS · 눈 없는 것이 남긴다)가 같은 형의 Event 로 선다 (데이터 한 줄 — 코드 0). 나머지 세계는 C036 과 같다.
6. 예제 화면 — 고래가 지나기 전(HKT_PRESENCE 없음): 숲 가장자리 판 「채취 · 비늘 — 지금은 없다」(「언제」 는 없다). `HKT_PRESENCE=SKY_WHALE_ROUTE` 뒤: 「채취 · 비늘」 · 주우면
   방의 기억 `sources[FALLEN_SCALE].takenTotal` 1 · 다시 「— 지금은 없다」. 240 초가 지나도 고래가 다시 지나지 않았으면 「지금은 없다」 그대로 (확정 9). 그림은 앞 둘.

## Module Check

```text
모듈                                       단언
Event 판정 RULE-OPPORTUNITY-OPEN-001 (world)   시나리오 SPEC-001 · SPEC-002 (열림 = phase 의 available 과 같은 답 · 경계 둘) · 회귀 RULE-SOURCE-RECOVERY-001 · RULE-PRESENCE-PASS-001
progress · outcomes 데이터 (data)              SPEC-004 · SPEC-005 (㊺ 대조 · 표 밖 fail) · SPEC-006 Yield 표
관찰 봉투 event · open (protocol)               SPEC-002 의 봉투 단언
판의 「— 지금은 없다」 (view)                    content/view/tests — 닫힌 Event 는 붙는다 · 열리면 안 붙는다 · Event 아닌 기회는 회귀 · "N초 뒤" · "고래가 지나면" 글자 없음 (SPEC-003 경계)
검사 ㊻ Event 수 (engine · C036 재사용)          SPEC-001 (둘)
T2 열셋째 · T4 결정 나무 · T6 ㊻ (tools)        SPEC-007 · tools/world-editor/tests (brief · grade · lab) — brief 미답 fail · 등급 셋 회귀
손잡이                                       SPEC-009 (먹이 잔해가 그 실측이다)
명사 0                                      SPEC-008 (grep)
```

## Reuse

Existing: FALLEN_SCALE 원천(C018 — supply event-scarce · recoveryCause RECOVERY_WHALE_PASSAGE · harvests 1 · recoverySeconds 240) · PREY_REMAINS · `leavesBehind` · RULE-PRESENCE-PASS-001 · RULE-SOURCE-RECOVERY-001 ·
RULE-MINE-COMPLETE-001 · RULE-REGION-MEMORY-001(C034) · Condition + 평가기 + 기억 조건(C035) · Opportunity 형 · 기본형 · ㊺ ㊻ · 기회 표(C036) · Region 작성기 T1~T6(brief · grade · draft · lab) · `WORLD_CONTRACTS`.

Added:
- World · Event 판정(availability 의 시간 qualifier 실사용 — `RULE-OPPORTUNITY-OPEN-001` 유도) · 비늘 · 먹이 잔해의 availability 데이터 · progress · outcomes 데이터 · Yield 표(열 열넷 · 2층 값 넷).
- Protocol · `InteractionView.opportunity` 에 `event: boolean` · `open: boolean` (C036 의 필드에 둘).
- View · 「— 지금은 없다」 (code-text).
- 도구 · T2 열셋째 답(brief schema 한 절) · T4 결정 나무(grade 의 입력 — 일곱 질문 → A/B/C) · T6 ㊻ (lab 편중 요약) · authoring contracts 에 기회 계약.
- Engine · 없음 예정 — 시간 qualifier 는 C035 의 평가기가 이미 판정한다. 결정 나무는 grade 의 데이터.

## Out of Scope

- 되돌아옴의 코드 경로 자체를 조건 형으로 **옮기는 것** — 원천의 phase 는 그대로 RULE-SOURCE-RECOVERY-001 이 든다. Event 는 그 위의 **읽기**다 (기회는 판정하지 않는다).
- 닫는 창(Event 가 저절로 닫히는 시각을 판이 말하는 것) — 두지 않는다 (RoomNeverSame 확정 9 · "언제 다시" 는 끝까지 말하지 않는다).
- 전투 · Boss · killed Event → 5층. 확률 → 5층 이후.
- Region 자체 성장의 첫 사례 → 빈칸 3.

## SPEC

- SPEC-001 Event 의 정의 — availability 에 시간 qualifier 가 있는 기회가 Event 다. 검사 ㊻ 이 그 수를 센다. 비늘 · 먹이 잔해 둘이 Event 다.
- SPEC-002 열림 — 고래가 이 방을 지난 시각으로부터 240 초 안이면 비늘 기회가 열려 있다(open) · 그 밖은 닫혀 있다. 원천의 phase 판정(available)과 **같은 답**이다 — 둘이 어긋나면 fail.
  경계 ① — 한 번도 지나지 않았으면 닫혀 있고 사유는 C035 의 기억 조건이다. 경계 ② — 주워서 고갈되면 닫힌다(COMPLETE) · 다시 열리는 것은 다시 지나감뿐이다.
- SPEC-003 판의 어법 — Event 인 기회는 닫혀 있어도 「할 수 있는 것」 줄에 서고 「— 지금은 없다」 가 붙는다. 열려 있으면 붙지 않는다. Event 가 아닌 기회는 서지 않거나 phase 의 사유로 선다(회귀).
  경계 — 어느 줄에도 "N초 뒤" · "고래가 지나면" 은 없다.
- SPEC-004 progress — 비늘 기회의 progress 가 `history.sources[FALLEN_SCALE].takenTotal` 을 가리키고, 주울 때마다 1 오른다 (C034 회귀).
- SPEC-005 outcomes — 주움의 world op 는 [Entity CHANGE_STATE · Ownership GRANT] 이고 yield 는 [Material · WorldInfluence] 다. 검사 ㊺ 가 표로 대조해 통과. 표 밖 이름이면 fail.
- SPEC-006 Yield 표 — 열 열넷(Material · Access · Discovery · WorldInfluence · Item · Currency · Knowledge · Recipe · Skill · Capability · ClassProgress · Mastery · Relationship · Reputation)이
  데이터로 서고 2층은 앞 넷만 값을 가진다. 뒤 열은 0 (G11 · ㊴ 의 Actor 열과 같은 약속).
- SPEC-007 도구 셋 — brief 에 열셋째 답 절이 있고 없으면 미답으로 센다(T2 규율) · grade 가 §14 일곱 질문의 답으로 A/B/C 를 낸다 — 가스 마을 · 유령 도시 · 마법도시가 지금과 같은 등급이다(회귀) ·
  lab 편중 요약에 ㊻ 이 든다.
- SPEC-008 회귀 · 명사 0 — 검사 마흔여덟의 답 · hash · 모든 판정 · 먹이 잔해의 되돌아옴이 C036 과 같다. 규칙 코드 · Event 판정 · 도구에 기회 · 경로 · 원천의 이름 글자가 없다 (grep).
- SPEC-009 손잡이 (데이터 교체 · 코드 diff 0) — ① 먹이 잔해가 데이터 한 줄로 둘째 Event 가 된다 (이 Cycle 의 실측). ② 변형 방(선례 c004)에서 비늘 Event 의 WITHIN 값을 바꾸면 `open` 이 그 값을 따르고,
  여는 경로(lastAt 의 routeId)를 바꾸면 다른 지나감이 창을 연다. ③ view 표에서 닫힌 Event 를 세우지 않게 하면 「— 지금은 없다」 줄이 사라진다. world · view 코드는 한 줄도 바뀌지 않는다.
  경계 — Yield 표에 없는 열 · op 표 밖의 op 는 ㊺ 가 fail 로 잡는다.

## State

```text
새 State 없음. STATE_VERSION 그대로. 기회의 열림 · 닫힘 · 진행은 전부 유도다 (원천 phase · history 가 든다).
데이터 (content/regions · content/authoring)
  FOREST_EDGE.opportunities[FALLEN_SCALE]   availability(기억 조건 + WITHIN 240) · discovery SIGNAL · target source · [gather] · progress counter · outcomes
  FOREST_DEEP(또는 그 방).opportunities[PREY_REMAINS]   같은 형 — BLIND_HUNTER_ROUTE
  Yield 표                                  열 열넷 · 2층 값 넷
  Mutation op 표(C036) · discovery 어휘 · 기회 계약 → content/authoring/contracts.ts
  T4 결정 나무                              일곱 질문 → 자리(Contents/State/Relation → A · Rule/Process → B · Space op → A · 없는 판정 → C · Observation → A/ENGINE · Persistence → A · 조합 → A · 다른 층 → C)
```

## Rule

- R1 (ADDED) RULE-OPPORTUNITY-OPEN-001 — IF 기회의 availability 가 참 THEN 열림(OPEN) · 거짓 THEN 닫힘(CLOSE) · 주움이 완료되면 COMPLETE. 전부 유도 — 저장하지 않는다. 판정(available)은 만지지 않는다.
- R2 (AFFECTED) RULE-OPPORTUNITY-NAME-001(C036) — 실리는 것에 event · open 이 는다.
- R3 (AFFECTED) RULE-SOURCE-RECOVERY-001 · RULE-PRESENCE-PASS-001 — 그대로. SPEC-002 가 둘과 Event 판정이 같음을 잰다.
- CHANGED — 없음.

## REUSED / ADDED

- REUSED: 위 Existing 전부.
- ADDED: RULE-OPPORTUNITY-OPEN-001 · Event 데이터 둘 · Yield 표 · 기회 계약(authoring) · T2 열셋째 · T4 결정 나무 · T6 ㊻ · 「— 지금은 없다」.
- AFFECTED: R2 · R3.

## Observable (관찰 계약)

```text
interaction.opportunity.event     boolean
interaction.opportunity.open      boolean
투영하지 않는 것   언제 열리는가 · 무엇이 여는가(고래) · 닫는 창 · progress 의 값(기억이 이미 싣는다) · outcomes · Yield 표
```

## UNRESOLVED

묶음 질문 Q6 · Q7 · Q8 (C035 spec) 의 답이 이 spec 에 든다. 동결은 자기 차례 — C036 마감이 남긴 「다음 Cycle 로」 를 반영한 뒤.
이 spec 에서 새로 생긴 의미: 없음. **먹이 잔해의 WITHIN 값**은 지금 코드의 recoverySeconds 를 그대로 옮긴다(기본형 ①) — 값은 Data Knobs 의 데이터 자리에 있고 경험 값이라 묻지 않는다.
경험 값(「— 지금은 없다」 의 문구 · 닫힌 Event 를 세우는가 · 기다림으로 읽히는가)은 view 표의 기본값으로 두고, 판정은 이 축을 처음 쓰는 컨텐츠 묶음의 것이다 (DESIGN §3 Foundation 남은 것).
