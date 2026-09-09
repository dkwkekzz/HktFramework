# C032 — 방이 기억한다

## 묶음 — 방은 기억하고 때가 되면 내민다

```text
기획서     content/roadmap/L2-World-Foundation.md — §3 G1~G13 (특히 G3 · G4 · G5 · G7 · G8) · §4.1~§4.5 데이터 계약 · §5.2 검사 ㊸~㊼ · §5.3 관찰 도구 ·
           §5.4 T2 열셋째 답 · T4 결정 나무 · T6 ㊻ · §8 기준 23 · 24 · §10 D2~D5 · 빈칸 2
           content/roadmap/L2-World-Time.md — 2.6 지나가는 것 · 2.7 뒤척임 (비늘 · burySigns) · RoomNeverSame 확정 9(비늘 = WORLD_EVENT)
           의미의 출처는 이 둘뿐이다. 옛 Play 문서(RoomRemembersAndOffers)는 없다 — 그것이 내린 확정은 아래 질문으로 다시 묻는다
행         기반 층 L2 — 세계 절반 ②-부속 다섯째 (Region Foundation). 새 축 없음 · 새 layer 없음
Goal       관찰자가 숲 가장자리에서 (1) 방이 자기에게 일어난 일을 센 것을 지목으로 읽고 — 몇 번 캐였고 · 고래가 몇 번 지났고 · 뒤척임이 몇 번
           지났는가 — 뒤척임과 되돌아옴이 지나도 그 셈이 남는 것을 보고, (2) 세계의 조건(문이 열리는 때 · 원천이 나는 철 · 문의 요구)이
           한 형으로 적혀 그 형이 기억을 읽는 것을 보고, (3) 방이 내미는 것(기회)이 판의 「할 수 있는 것」으로 서며, (4) 고래가 지나간 뒤
           떨어진 비늘이 **때가 있는 기회(Event)** 로 — 지금은 없고 그때는 있는 것으로 — 읽히고 주워진다
Intent     Start  방은 지금만 안다 — 캐면 taken 이 오르고 되돌아오면 0 이다. 내가 여기서 무엇을 했는지 세계는 잊는다. 무엇을 할 수 있는지는
                  걸어가 거절당해야 안다. 비늘은 "원천 하나" 일 뿐이다
           End    같은 방이 우리가 한 일을 세어 두고 그것이 다음 조건이 된다. 판이 "이 방에서 무엇을 할 수 있는가" 를 말하고, 때가 있는 것은
                  "지금은 없다" 로 갈라 말하되 언제까지인지는 말하지 않는다 — 발견된 방이 계속 살아 움직인다 (L0 미증명 ① · ④)
Breath     되돌아옴 → 셈이 남는다(놀람) → 뒤척여도 남는다(신뢰) → 조건이 그것을 읽는다(이해) → 할 수 있는 것이 판에 선다(시도) →
           때가 있는 것이 지금은 없다(기다림) → 고래가 지나간 뒤 있다(획득) → 새로운 미지(다음에 무엇이 열리는가)
Cycle      C032 방이 기억한다        RegionState.history(D4) · 되돌아옴·뒤척임이 묻지 않는다(D5) · 저장 · 판의 「기억」 줄 · 수명 표(G7) · 검사 ㊸ ㊼ · world:observe
           C033 조건은 하나의 형이다   Condition 형(G5 · D2) · 게임 명사 없는 평가기(ENGINE) · 흩어진 조건 자리 넷을 형으로 읽는다(빈칸 2) · 검사 ㊹ ·
                                    history 가 Target 이 된다 · 회귀(문 · 원천 · 미로가 그대로)
           C034 방이 기회를 내민다     Opportunity 형(G3 · D2) · RegionSpec.opportunities · 원천마다 채집 기회 기본형 · Interaction 판정에 기회의 이름 ·
                                    판의 「할 수 있는 것」이 기회 데이터에서 · discovery 넷 · 검사 ㊺ ㊻ · world:observe --report 기회 표
           C035 때가 있는 기회        Event = availability 에 시간 qualifier(G4 · D3 비늘) · progress 는 history 경로 · outcomes = op 표(G6) + yield 열 넷(G11) ·
                                    판이 「지금은 없다」를 갈라 말하고 "언제까지" 는 말하지 않는다 · T2 열셋째 답 · T4 결정 나무 · T6 ㊻ (묶음의 마지막 — 도구까지)
           순서는 의존성이다 — 기억이 있어야 조건이 읽을 것이 있고, 형이 있어야 기회의 availability 를 적을 수 있고, 기회가 있어야 Event 가 그 특수형이다.
           C032 · C033 은 Reuse 가 겹치지 않아 다른 묶음(3층 편성 · Rooms GAP)과 병행할 수 있다. STATE_VERSION 이 오르므로 PR 은 번호 순으로 합친다
미지       없음 — M4 천공고래의 길을 깊게 한다 (기획서 빈칸 5 · Human 확정). 이름 있는 새 사실을 Human 이 주면 그때 바꾼다
검사       기반 층이라 열 질문은 §9 가 이미 답했다 — 위험을 더하지 않고 자리를 말한다 · 재료는 같은 자리(기회의 outcomes) · 성장은 Yield 열 넷 ·
           Core Breath 의 관찰 → 이해 → 시도 와 극복 → 성장 → 새로운 미지 사이의 **기억**
질문       아래 UNRESOLVED — 묶음 전체의 것을 여기서 한 번에 묻는다. "C032 진행" 이 답과 함께 오면 묶음이 승인되고 이 spec 이 동결된다
```

```text
CYCLE          C032-a-room-remembers
SOURCE         L2-World-Foundation §3 G7 · G8 · §4.3 · §4.4 · §5.2 ㊸ ㊼ · §5.3 · §10 D4 · D5 · L2-World-Time 2.7 · 기존 spec 의 ADDED — C012(sources.taken) ·
               C013(recovery) · C016(onTurn · turnsApplied) · C017(disturbance phase) · C018(presence pass) · C023(life birth) · C026~C028(판 · 지목) ·
               C008(RegionState · STATE_VERSION 규율). 기존 Semantic/Rule 을 복사하지 않고 이름으로 인용한다
SELECTED_FROM  묶음 Cycle 목록 1 — "방이 기억한다"
```

## Playable Goal

숲 가장자리에서 밑동의 허물을 캐고 되돌아오길 기다린 뒤 다시 지목하면 판이 「기억」 줄로 "두 번 캐였다 · 한 번 바닥났다" 를 말한다.
긴 밤이 걷히며 뒤척임이 자국을 묻은 뒤에도, 세계를 저장했다 되살린 뒤에도 그 줄은 그대로다. 방을 지목하면 뒤척임이 몇 번 지났고 고래가 몇 번 지났는지도 선다.

## Experience Intent

- Start — 되돌아오면 캔 흔적이 지워진다. 세계는 내가 한 일을 잊는다.
- End — 같은 방이 우리가 한 일을 셈해 두고 지목하면 말한다. 뒤척여도 남는다 (묶음 Breath 의 "셈이 남는다 → 뒤척여도 남는다").

## World Change

1. 방 하나의 State 에 **기억(history)** 이 선다 — 원천마다 캐인 횟수 누계 · 고갈된 횟수 · 마지막 고갈 시각, 방마다 뒤척임 횟수 · 깨어난 횟수와 마지막 시각 ·
   지나간 것마다 횟수와 마지막 시각 · 탄생지마다 태어난 횟수와 마지막 시각 (D4).
2. 셈은 일어난 일의 Transition 안에서 오른다 — 채취 완료 · 고갈 · 뒤척임 적용 · 소란이 임계를 넘음 · 경로가 방에 들어섬 · 태어남. 새 세계 과정은 없다.
3. 되돌아옴이 `taken` 을 0 으로 돌려도 누계는 남고, 뒤척임이 자국 · 덧씌움 · 마디를 처음으로 돌려도 셈은 남는다 (D5).
4. 기억은 저장된다 — 스냅샷에 실리고 STATE_VERSION 이 오른다. 기억이 없는 옛 스냅샷은 0 으로 읽는다.
5. State 필드마다 "무엇이 그것을 지우는가" 가 **표**로 적힌다 (G7 다섯 — TRANSIENT · SESSION · TEMPORARY · WORLD · PERSISTENT). history 는 PERSISTENT.

## Observable Result

1. 원천을 지목하면 판에 「기억」 줄 — 캐인 횟수 · 바닥난 횟수 · 마지막으로 바닥난 때("N초 전" 어법). 한 번도 캐이지 않은 원천에는 줄이 없다.
2. 자리(방)를 지목하면 판에 「기억」 줄 — 뒤척임 N번 · 깨어남 N번(마지막 N초 전) · 지나감 (경로 이름마다 N번 · 마지막 N초 전) · 탄생 (탄생지마다 N번). 0 인 항목은 줄이 없다.
3. 되돌아온 뒤 · 뒤척임 뒤 · 저장했다 되살린 뒤에도 1 · 2 의 수가 그대로다.
4. 누가 했는지는 어디에도 없다 — 관찰자 둘이 같은 원천을 캐도 한 수로 오른다.
5. `world:observe <방>` 이 그 방의 history 를 보고에 낸다 (읽기 전용). `world:check` 에 ㊸(history 의 키가 실제 원천 · 경로 · 탄생지인가 — 통과/실패)과
   ㊼(Persistence 요약 — State 필드별 지우는 손 · 적히지 않은 필드 · history 의 크기 — 판정 없음)이 는다 (마흔셋 → 마흔다섯).

## Reuse

Existing (그대로 쓴다 — 이름만 인용):
- `RegionState` (rule? · sources[] · disturbance · tracks? · lifeSites? · populations?) · `ResourceSourceState.taken` · `WorldState.turnsApplied` · `seasonsApplied`
- RULE-MINE-COMPLETE-001 (채취 완료 · taken +1 · 고갈) · RULE-SOURCE-RECOVERY-001 (되돌아옴 — taken → 0) · RULE-SEASON-TURN-001 (뒤척임 적용 · burySigns) ·
  RULE-DISTURBANCE-PHASE-001 (dormant → awake) · RULE-PRESENCE-PASS-001 (마디 이동) · RULE-LIFE-BIRTH-001 (태어남) — 여섯이 AFFECTED
- `engine/world-kernel/persistence` (스냅샷 · `restoreState` · `STATE_VERSION`) · `projectObserverView` · 판 (C026~C028 — `readPlace` · target frame · 나이 어법 "N초 전")
- `tools/world-editor/check.ts` (`CheckReport` · 검사 묶음의 붙을 자리) · `observe.ts` (방 보고)

Added (이 Cycle 이 세운다):
- World · `RegionState.history` (§State) · R1~R6 · 수명 표 데이터(State 필드 → 지우는 손) · `STATE_VERSION` hkt-adv-proto-i/11
- Protocol · `RegionView.history` · 원천 `EntityView.memory` (관찰 계약)
- View · 판의 「기억」 줄 (자리 · 원천) — 문구는 view 의 표
- 도구 · 검사 ㊸ ㊼ · `world:observe <방>` 의 history 절
- Engine · 없음 예정 — 계수 · 시각 갱신은 게임 명사가 벗겨지면 `+1` 과 대입뿐이라 기구가 아니다. 검사 ㊸ 의 "키가 목록 안인가" 는 기존 참조 무결 검사 기구(㉞ 의 것) 재사용

## Out of Scope

- Condition 형 · 평가기 · history 를 읽는 조건 → C033. 기회 · 「할 수 있는 것」 → C034. Event · 비늘의 때 → C035.
- 기억을 **지우는** 결정(FINITE_WORLD_STATE 의 그 Region 결정) — 자리만 (PERSISTENT 의 정의). 지우는 사례 없음.
- 관찰자별 기억(누가) — 세지 않는다 (G8 · T2.7). 3층 Player Knowledge 의 일.
- 원천 밖의 기억(Object · Structure) — 컨텐츠 행.

## SPEC

- SPEC-001 원천의 셈 — 원천이 캐일 때마다(RULE-MINE-COMPLETE-001) `history.sources[id].takenTotal` 이 1 오른다. 고갈되는 그 완료에서 `depletedTimes` 가 1 오르고 `lastDepletedAt` 이 그 세계 시각이 된다.
  경계 ① — 되돌아옴(RULE-SOURCE-RECOVERY-001)이 `taken` 을 0 으로 돌려도 셋은 한 값도 바뀌지 않는다. 경계 ② — 캐이지 않은 원천에는 `history.sources[id]` 가 없다 (0 을 지어내지 않는다).
- SPEC-002 방의 셈 — 뒤척임이 그 방에 적용될 때 `history.turns` 가 1 오른다. 소란이 dormant → awake 로 넘을 때 `history.awakenings.times` 가 1 오르고 `lastAt` 이 그 시각이 된다.
  경로가 이 방의 마디에 들어설 때 `history.passages[routeId].times` 가 1 오르고 `lastAt` 이 그 시각이 된다 (한 지나감에 한 방 한 번). 탄생지에서 태어날 때 `history.births[formationId]` 가 같은 형으로 오른다.
  경계 — awake 인 채로 소란이 더 쌓여도 `awakenings` 는 오르지 않는다 (넘은 것만 센다). 같은 지나감이 같은 방의 마디 둘을 지나도 한 번이다.
- SPEC-003 뒤척임은 기억을 묻지 않는다 — RULE-SEASON-TURN-001 이 자국 · 덧씌움 · 마디를 처음으로 돌리는 그 tick 에 `history` 의 어느 값도 바뀌지 않는다 (turns 가 1 오르는 것 말고는).
  경계(회귀) — 자국은 여전히 묻히고(RULE-TRACK 회귀) 마디는 여전히 처음으로 돌아간다 (C016 회귀).
- SPEC-004 아무도 없어도 센다 — 관찰자가 하나도 없는 세계에서 고래가 시간표대로 지나고 뒤척임이 오면 `passages` · `turns` 가 오른다.
- SPEC-005 저장되고 되살아난다 — 스냅샷에 `history` 가 실리고 `restoreState` 가 그대로 돌려준다. `STATE_VERSION` 이 hkt-adv-proto-i/11 이다.
  경계 — history 가 없는 스냅샷(옛 형)은 모든 셈을 0(없음)으로 읽고 되살아난다 — 버리지 않는다 (기본형 ①).
- SPEC-006 지목하면 말한다 — 원천을 지목한 판에 그 원천의 `memory` 가, 자리를 지목한 판에 그 방의 `history` 가 「기억」 줄로 선다. 0 이거나 없는 항목은 줄이 없다.
  경계 — 어느 줄에도 관찰자의 이름 · 수는 없다. 관찰자 둘이 번갈아 캐도 `takenTotal` 은 하나의 수다.
- SPEC-007 수명 표 — `RegionState` 의 모든 필드(rule.pattern · rule.pressure · rule.rearrangedAt · sources[].phase · taken · progress · siteIndex · collapsedSites · disturbance.value · phase ·
  tracks · lifeSites · populations · history)에 지우는 손 하나가 표에 적혀 있다. 검사 ㊼ 이 그 표를 요약해 내고, 표에 없는 필드를 이름으로 보인다 (판정 없음).
- SPEC-008 검사 ㊸ — `history.sources` · `passages` · `births` 의 키가 그 방의 실제 원천 · 실제 경로 · 실제 탄생지가 아니면 fail. `world:observe <방>` 의 보고에 history 절이 있다.
  경계 — 일부러 유령 키를 넣은 스냅샷이 ㊸ 에 잡힌다.

## State

```text
RegionState.history                           (ADDED · PERSISTENT — 그 Region 의 결정만 지운다 · 지금 지우는 사례 없음)
  sources[sourceId].takenTotal                 정수 ≥ 0 — 캐인 누계
  sources[sourceId].depletedTimes              정수 ≥ 0 — 바닥난 횟수
  sources[sourceId].lastDepletedAt             세계 초 | 없음
  turns                                        정수 ≥ 0 — 뒤척임 횟수
  awakenings.times · awakenings.lastAt         정수 · 세계 초 | 없음
  passages[routeId].times · .lastAt            정수 · 세계 초 | 없음
  births[formationId].times · .lastAt          정수 · 세계 초 | 없음
history 자체는 모든 방에 자리를 가진다(소란처럼 — 어느 방에나 일어난 일이 있을 수 있다). 안의 항목은 일어났을 때만 생긴다.
상한 없음 (정수). 누가 했는지 없음.

수명 표 (ADDED · 데이터 — 검사 ㊼ 의 입력)
  rule.pattern · pressure · rearrangedAt        WORLD
  sources[].phase · taken                       WORLD
  sources[].progress                            TRANSIENT (되돌아옴이 지운다)
  sources[].siteIndex                           TEMPORARY (뒤척임)
  sources[].collapsedSites                      PERSISTENT (무너진 마디)
  disturbance.value                             TRANSIENT (고요에 가라앉는다)
  disturbance.phase                             WORLD
  tracks                                        TRANSIENT (60 초) · TEMPORARY (뒤척임)
  lifeSites · populations                       WORLD
  history                                       PERSISTENT
```

## Rule

- R1 (ADDED) IF 채취가 완료된다(RULE-MINE-COMPLETE-001 의 전이) THEN 그 원천의 `history.sources[id].takenTotal += 1`; 그 완료가 고갈이면 `depletedTimes += 1` · `lastDepletedAt = now`.
- R2 (ADDED) IF 뒤척임이 방에 적용된다(RULE-SEASON-TURN-001) THEN `history.turns += 1`. history 의 다른 값은 그대로 (D5).
- R3 (ADDED) IF 소란의 위상이 dormant → awake 로 넘는다(RULE-DISTURBANCE-PHASE-001) THEN `history.awakenings.times += 1` · `lastAt = now`.
- R4 (ADDED) IF 경로의 지나감이 이 방의 마디에 처음 들어선다(RULE-PRESENCE-PASS-001 · 같은 지나감에서 한 번) THEN `history.passages[routeId].times += 1` · `lastAt = now`.
- R5 (ADDED) IF 탄생지에서 태어난다(RULE-LIFE-BIRTH-001) THEN `history.births[formationId].times += 1` · `lastAt = now`.
- R6 (ADDED) IF 스냅샷에 history 가 없다 THEN 모든 방의 history 는 비어 있다 (항목 없음) — 되살리기는 성립한다.
- AFFECTED — RULE-MINE-COMPLETE-001 · RULE-SOURCE-RECOVERY-001 · RULE-SEASON-TURN-001 · RULE-DISTURBANCE-PHASE-001 · RULE-PRESENCE-PASS-001 · RULE-LIFE-BIRTH-001 (전이는 그대로 · 셈이 곁에 선다).
- CHANGED — 없음.

## REUSED / ADDED

- REUSED: RegionState · ResourceSourceState · 위 여섯 Rule id · persistence · projectObserverView · 판 · world:check 묶음 · world:observe.
- ADDED: RegionState.history · 수명 표 · R1~R6 · RegionView.history · EntityView.memory · 「기억」 줄 · 검사 ㊸ ㊼ · STATE_VERSION 11.
- AFFECTED: 위 여섯.

## Observable (관찰 계약)

```text
region.history.turns                              정수
region.history.awakenings                         { times, lastAt? }
region.history.passages[routeId]                  { times, lastAt? }
region.history.births[formationId]                { times, lastAt? }
entity(source).memory                             { takenTotal, depletedTimes, lastDepletedAt? }   — 캐인 적 있는 원천에만
투영하지 않는 것   누가 했는가(없다) · 다른 방의 history(같은 방만) · 지우는 손의 표(도구의 것 — 세계는 말하지 않는다) ·
                 "다음에 무엇이 열리는가"(C033 · C035 의 몫 — 셈은 말하되 그것이 무엇의 조건인지는 말하지 않는다)
```

## UNRESOLVED

묶음 전체의 질문이다 — 답과 함께 "C032 진행" 이 오면 동결된다. 각 줄에 제안값을 붙였다 — "제안대로" 면 그것으로 간다.

```text
Q1  (C033 · 빈칸 2)  흩어진 조건 자리 넷(CONNECTOR_ACTIVATIONS · phases.connectorActivation · occurrence.seasons/dayPhases · Lock.requires)을 Condition 형으로
                     **옮기는가**, 데이터는 두고 평가기가 형으로 **읽기만 하는가**.
                     제안: 읽기만(어댑터). 옮기면 C009 · C016 · C029 의 데이터가 CHANGED 가 되고 얻는 것은 파일 모양뿐이다. 검사 ㊹ 는 어댑터가 낸 형을 본다
Q2  (C033)           기억(history)을 읽는 조건의 첫 사례 — 세계 사실이라 Human 것이다.
                     제안: C033 에서는 두지 않는다. C035 의 Event 가 첫 사례다 — 비늘의 availability = { target: history 이 방 · query: history passages[SKY_WHALE_ROUTE].lastAt ·
                     qualifier: time WITHIN 240 초 }. 지금 코드의 recoverySeconds 240 을 조건 형으로 옮겨 적는 것이라 새 사실이 아니다
Q3  (C032)           뒤척임 횟수를 **모든 방**이 세는가, onTurn 을 밝힌 방만 세는가. 제안: 모든 방 — 뒤척임은 세계의 사건이다 (T3 · 시계는 전역)
Q4  (C032)           지나감의 셈 단위 — 경로가 이 방의 마디에 들어설 때 1(한 지나감에 한 방 한 번) vs 지나감이 시작될 때 경로 위 모든 방에 1.
                     제안: 마디에 들어설 때 — 휘어져 오지 않은 방은 세지 않는다
Q5  (C032)           STATE_VERSION 을 올린다 (hkt-adv-proto-i/11). Life 결정 대기의 "저장 형이 늘 때마다 올릴 것인가" 와 같은 물음 — 이 묶음은 기획서 §11 대로 올린다.
                     제안: 올리되 옛 스냅샷은 R6 으로 되살린다 (버리지 않는다)
Q6  (C034)           기회의 discovery 첫 값 — 원천마다의 채집 기회: baseline · by-product · risk 는 TRACE(흔적이 먼저 · S4), conditional 은 TRACE,
                     world-event(비늘 · 먹이 잔해)는 SIGNAL(경로 선 · 그늘). 제안대로인가
Q7  (C034)           2층의 기회 대상 — source 를 대상으로 하는 gather 기회만인가, connector 를 대상으로 하는 cross 기회(문)도 세우는가.
                     제안: 둘 다 — 문의 요구(Lock)가 이미 "무엇을 묻는가" 를 세웠으니 cross 기회는 그 위에 이름만 붙는다. move · observe 는 기회로 세우지 않는다(어디서나 되는 것)
Q8  (C035)           판이 때가 있는 기회의 "지금은 없다" 를 어떻게 말하는가 — 기획서 §6 11 "세계가 언제까지를 말하지 않는다".
                     제안: 「할 수 있는 것」 줄에 「— 지금은 없다」 만 붙인다. 언제 · 왜는 말하지 않는다 (흔적이 말한다 — 경로 선 · 그늘)
Q9  (C035)           도구 셋(T2 열셋째 답 · T4 결정 나무 · T6 ㊻)을 C035 에 함께 두는가, 도구 Cycle 로 하나 더 자르는가. 제안: C035 에 함께 — 셋 다 데이터를 읽는 것뿐이다
```

기본형으로 둔 것 (Human 이 감사할 자리 — 결정이 걸리면 결정 대기로):

```text
① 옛 스냅샷은 history 없음 → 빈 셈으로 되살린다 (버리지 않는다)
② lastAt 은 세계 초 절대값 — 판은 "N초 전" 으로 유도해 말한다 (Observe 확정의 나이 어법)
③ 「기억」 줄은 0 인 항목을 싣지 않는다 — "캐인 적 없음" 을 말하지 않는다 (침묵이 미지감)
④ births 는 Life 가 코드에 있으므로 이번에 함께 센다 (기획서 "(Life 뒤)" 의 그 자리)
⑤ 수명 표는 content 의 데이터 하나 — 검사 ㊼ 이 읽는다. 기반은 표의 뜻을 모른다
```
