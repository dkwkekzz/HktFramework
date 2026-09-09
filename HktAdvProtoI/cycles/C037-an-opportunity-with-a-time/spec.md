# C037 — 때가 있는 기회

묶음 「방은 기억하고 때가 되면 내민다」 의 넷째이자 마지막 Cycle — 묶음 블록은 [C035 spec](../C035-one-shape-of-condition/spec.md) 머리에 있다.
**동결** — 묶음 질문 Q6 · Q7 · Q8 의 답("제안대로")과 C036 마감이 남긴 「다음 Cycle 로」 여덟을 받았다.
이 Cycle 이 합쳐지면 묶음의 AI 예심 → Human 실주행 판정이다.

```text
CYCLE          C037-an-opportunity-with-a-time
SOURCE         L2-World-Foundation §3 G4 · G6 · G8(births) · G11 · G13 · §4.2 op 표 · §4.3 기억 · §4.5 progress · outcomes · §5.3 · §5.4 T2 열셋째 답 · T4 결정 나무 · T6 ㊻ ·
               §8 기준 23 · 24 · §10 D3 · L2-World-Time 2.6(경로 · leavesBehind) · RoomNeverSame 확정 9(비늘 — 고래가 다시 지나면 돌아온다 · 시간이 아니다) ·
               L2-World-Tool-Scale §2(등급) · §3 T2 · T4 · T6 · C034(history · RULE-REGION-MEMORY-001) · C035(Condition · 평가기 · 기억 조건) ·
               C036(Opportunity · 기본형 유도 · ㊺ ㊻ · 기회 표) · C018(FALLEN_SCALE · recoveryCause) · C023~C025(탄생 · RULE-LIFE-BIRTH-001)
SELECTED_FROM  묶음 Cycle 목록 4 — "때가 있는 기회"
```

## Playable Goal

숲 가장자리에서 고래가 아직 지나지 않았을 때 비늘 자리를 지목하면 판이 「채취 · **지금은 없다**」 를 말하고(언제 · 왜는 말하지 않는다), 고래가 지나간 뒤
다시 지목하면 그 마디가 사라져 주울 수 있으며, 주우면 그 기회가 닫히고 방의 기억이 오른다. 240 초가 지나면 다시 「지금은 없다」 다 —
되돌리는 것은 시간이 아니라 고래가 다시 지나는 것이다. 이것이 세계의 첫 **Event** 이고 전투가 아니다 (기획서 §8 기준 23 · 24).
그리고 방은 이제 **태어난 것도 센다** — 기억의 마지막 마디(G8 births)가 선다.

## Experience Intent

- Start — 비늘은 "지금은 못 캐는 원천" 이고 왜인지 알 길이 없다.
- End — 비늘은 **때가 있는 기회**다. 지금은 없고 그때는 있다 — 발견된 방이 계속 살아 움직인다 (묶음 Breath 의 "기다림 → 획득 → 새로운 미지" · L0 미증명 ④).

## World Change

1. **Event = 시간 qualifier 를 가진 기회** (G4) — 별도 Event 시스템 없음. 비늘 기회의 availability 가 `all [ passages.<고래> EXISTS (C035 의 기억 조건),
   { target: history, query: history `passages.<고래>.lastAt`, operator: EXISTS, qualifier: time WITHIN 240 } ]` 이 된다 (Q7). 지금 코드의 `recoverySeconds 240` 이 이 조건으로 **옮겨 적힌다** — 값은 그대로.
   평가기의 시간 qualifier 는 C035 가 이미 세웠고 읽기는 `now`(state.time)를 이미 준다 — 이 Cycle 이 그 첫 사용처다.
2. **availability 가 처음으로 평가된다** (C036 이 미룬 자리) — 판정 셋을 그대로 받는다: 참이면 열림 · 거짓이면 닫힘 · **판정 불가는 열지 않되 닫힘으로 말하지도 않는다**
   (「지금은 없다」 는 Event 에만 붙고, 판정 불가 잎을 가진 기회는 이 Cycle 에 Event 가 아니다 — 문의 요구는 지금처럼 C029 의 사유가 말한다).
3. **progress 가 history 경로를 가리킨다** (§4.5 — 유도 · 저장하지 않는다) — 비늘: `{ counter, sources.<비늘>.takenTotal }` (C036 의 기본형 그대로).
4. **outcomes 가 실제 op 으로 적힌다** — 비늘 채취의 world = [Entity CHANGE_STATE(원천 phase) · Ownership GRANT(Material)] · yield = [Material · WorldInfluence(소란)].
   검사 ㊺ 가 op 표(C036)로 대조한다. **Yield 표**(G11)가 데이터로 서고 2층은 앞 넷만 값을 가진다.
5. **기회가 열리고 닫힌다** — op 표의 Opportunity 군(OPEN · CLOSE · COMPLETE)에 이름이 붙는다: availability 가 참이면 OPEN · 거짓이면 CLOSE · 주움이 완료되면 COMPLETE.
   전부 **유도**다 — 저장되는 기회 State 는 없다 (원천 phase 와 history 가 이미 그것을 든다).
6. **판이 「지금은 없다」 를 갈라 말한다** (Q6) — Event 인 기회는 닫혀 있어도 「할 수 있는 것」 줄에 서되 「— 지금은 없다」 가 붙는다. 언제까지 · 왜는 말하지 않는다.
   Event 가 아닌 기회는 지금처럼 phase 의 사유로 말한다 (회귀).
7. **방이 태어난 것도 센다** (G8 · §4.3 마지막 마디) — `RegionMemory.births[<탄생지>]` 가 서고 RULE-LIFE-BIRTH-001 이 그것을 올린다. 다른 셈과 같은 규율이다 —
   누가 했는지는 없고, 뒤척임이 묻지 못하며, 되살려도 남는다. 판의 「기억」 줄에 한 마디가 는다.
8. **도구 셋** (Q8 — 함께) — T2 brief 의 열셋째 답("무엇을 할 수 있고 무엇을 기억하는가") · T4 등급 판정의 **결정 나무**(기획서 §14 일곱 질문 → A/B/C) ·
   T6 `world:lab` 편중 요약에 ㊻. `content/authoring/contracts.ts` 의 계약 목록에 **기회 계약**(discovery 어휘 · 동사 · op 표 · yield 열)이 든다.
   `world:observe --report` 기회 표에 **「지금」 열**이 선다 — 조건 표와 같이 갓 선 세계(t=0)의 값이다 (C036 이 미룬 자리).

## Observable Result

1. 고래가 지나기 전(갓 선 세계 · `HKT_PRESENCE` 없음): 숲 가장자리 비늘 자리를 지목하면 「할 수 있는 것  채취 · … · **지금은 없다** · 신호로 온다」.
   「언제」 도 「고래」 도 어느 줄에도 없다.
2. `HKT_PRESENCE=SKY_WHALE_ROUTE` 로 고래가 지난 뒤: 그 마디가 사라지고 주울 수 있다. 주우면 소지에 고래 비늘이 들고 방의 기억이 오르며 다시 「지금은 없다」 로 돌아간다.
3. 240 세계 초가 지나면(고래가 다시 지나지 않았으면) 「지금은 없다」 — 시간이 되돌리지 않는다 (RoomNeverSame 확정 9 회귀).
4. `world:check` 마흔여덟 — ㊻ 에 Event 2(비늘 · 먹이 잔해) · ㊺ 통과(outcomes 의 op 가 표 안) · ㊸ 이 태어남의 키까지 잰다.
5. `world:observe --report` 기회 표에 「지금」 열이 서고 비늘 행이 Event · 닫힘이다. Yield 표가 열 열넷으로 선다.
6. `world:lab` 편중 요약에 ㊻ 이 들고, 등급 판정이 일곱 질문의 결정 나무로 A/B/C 를 낸다 (가스 마을 · 유령 도시 · 마법도시의 등급은 그대로 — 회귀).
7. 붉은 눈의 거목에서 알집이 터진 뒤 그 방을 지목하면 판의 「기억」 줄에 태어남의 셈이 함께 선다.
8. 회귀 — 나머지 세계는 C036 과 같다 (검사 마흔여덟의 답 · 방 열셋의 hash · 모든 판정).

## Reuse

Existing: `FALLEN_SCALE`(C018 — supply event-scarce · recoveryCause 고래의 지나감 · recoverySeconds 240) · `PREY_REMAINS`(눈 없는 것이 남긴다) · `leavesBehind` ·
RULE-PRESENCE-PASS-001 · RULE-SOURCE-RECOVERY-001 · RULE-MINE-COMPLETE-001 · RULE-LIFE-BIRTH-001 · RULE-REGION-MEMORY-001 · `recordMemory` · `RegionMemory`(C034) ·
Condition + `evaluateCondition`(time qualifier · `now`) + `worldConditionReader` + 기억 조건(C035) · `Opportunity` 형 · `opportunitiesOf` · `isEventOpportunity` · ㊺ ㊻ · 기회 표(C036) ·
Region 작성기 T1~T6(`brief` · `grade` · `draft` · `lab`) · `WORLD_CONTRACTS` · 판의 「기억」 줄(C034) · 「할 수 있는 것」 줄(C027 · C036).

Added:

- World · `RULE-OPPORTUNITY-OPEN-001`(availability 를 평가해 열림/닫힘/완료를 **유도**한다) · 비늘 · 먹이 잔해의 Event availability 데이터 · outcomes 데이터 ·
  `RegionMemory.births` 와 그것을 올리는 한 자리(RULE-LIFE-BIRTH-001 안 · `recordMemory` 의 사건 하나) · Yield 표(열 열넷 · 2층 값 넷).
- Protocol · `InteractionView.opportunity` 에 `event: boolean` · `open: boolean` · `RegionMemoryView` 에 `births` (C034 의 `passages` 어법 그대로).
- View · 「— 지금은 없다」(code-text) · 판의 「기억」 줄에 태어남 한 마디.
- 도구 · brief 의 열셋째 답 · 등급의 결정 나무 · lab 편중 요약의 ㊻ · observe 기회 표의 「지금」 열 · Yield 표 · authoring 계약에 기회 계약.
- Engine · 새 기구 없음 예정 — 시간 qualifier 는 C035 의 평가기가 이미 판정하고, 결정 나무는 `grade` 가 받는 **데이터**다. 검사 ㊸ 의 어휘에 태어남의 키가 는다(계약은 컨텐츠가 건넨다).

## Out of Scope

- 되돌아옴의 코드 경로를 조건 형으로 **옮기는 것** — 원천의 phase 는 그대로 RULE-SOURCE-RECOVERY-001 이 든다. Event 는 그 위의 **읽기**다 (기회는 판정하지 않는다).
- 닫는 창(Event 가 저절로 닫히는 시각을 판이 말하는 것) — 두지 않는다 (RoomNeverSame 확정 9 · "언제 다시" 는 끝까지 말하지 않는다).
- `CROSSED` 를 비롯한 change qualifier 의 실사용 — 이 Cycle 의 progress 는 counter 뿐이다. "값이 문턱을 넘었다" 를 쓰는 Cycle 이 그 어법을 받는다 (C036 이 남긴 것).
- 탄생지의 채취(harvest-source)를 기회로 세우는 것 — 유도가 원천만 훑는다. 받을 Cycle 이 없으니 [DESIGN.md §3 의 "남은 것"](../../plan/DESIGN.md) 으로 보낸다.
- 문의 저쪽 끝에서 cross 기회가 서는 것 — Lock 이 선 방에서만 이름이 붙는다 (기본형 ⑤ · 그대로 둔다).
- 전투 · Boss · killed Event → 5층. 확률(chance) → 5층 이후. Region 자체 성장의 첫 사례 → 빈칸 3.
- `STATE_VERSION` 올림 — 올리지 않는다 (기본형 ④).

## SPEC

- SPEC-001 Event 의 정의 — availability 에 시간 qualifier 가 있는 기회가 Event 다. 검사 ㊻ 이 그 수를 센다. 이 세계의 Event 는 둘(비늘 · 먹이 잔해)이다.
  경계 — 시간 qualifier 가 없는 기회는 Event 가 아니다 (다른 마흔 남짓은 그대로).
- SPEC-002 열림 — 그 경로가 이 방을 지난 시각으로부터 240 초 안이면 비늘 기회가 열려 있고(open) 그 밖은 닫혀 있다.
  그 답이 원천의 phase 판정(캘 수 있는가)과 **모든 때에 같다** — 어긋나면 fail.
  경계 ① — 한 번도 지나지 않았으면 닫혀 있다 (기억 조건이 거짓 · C035 의 `needs-passage` 는 그대로 선다).
  경계 ② — 주워서 고갈되면 닫힌다 · 다시 열리는 것은 다시 지나감뿐이다 (240 초를 기다려도 열리지 않는다).
- SPEC-003 판정 셋 — availability 가 참이면 열림 · 거짓이면 닫힘 · **판정 불가면 열지 않는다**. 판정 불가는 「지금은 없다」 로 말해지지 않는다 (그 마디는 Event 에만 붙는다).
  경계 — 판정 불가 잎을 가진 기회(문의 cross — property · knowledge 를 묻는 Lock)는 Event 가 아니므로 그 줄이 C029 · C036 과 한 값도 다르지 않다.
- SPEC-004 판의 어법 — Event 인 기회는 닫혀 있어도 「할 수 있는 것」 줄에 서고 「— 지금은 없다」 가 붙는다. 열려 있으면 붙지 않는다.
  경계 — 어느 줄에도 "N초 뒤" · "고래가 지나면" 은 없다. 줄의 형식 · 순서 · 사유 · discovery 마디는 C036 과 같다.
- SPEC-005 outcomes — 주움의 world op 는 [Entity CHANGE_STATE · Ownership GRANT] 이고 yield 는 [Material · WorldInfluence] 다. 검사 ㊺ 가 표로 대조해 통과한다.
  경계 — 표 밖의 이름을 넣으면 fail (C036 SPEC-007 그대로).
- SPEC-006 Yield 표 — 열 열넷(Material · Access · Discovery · WorldInfluence · Item · Currency · Knowledge · Recipe · Skill · Capability · ClassProgress · Mastery · Relationship · Reputation)이
  데이터로 서고 2층은 앞 넷만 값을 가진다. 뒤 열은 0 이고 **지워지지 않는다** (㊴ 의 Actor 열과 같은 약속 — 없다는 사실이 표에 선다).
- SPEC-007 방이 태어난 것을 센다 — 탄생지에서 하나가 태어나면 그 방의 `history.births[<탄생지>]` 의 times 가 1 오르고 lastAt 이 그때다.
  경계 ① — 뒤척임도 되돌아옴도 그 셈을 지우지 못하고, 저장하고 되살려도 그대로다 (C034 의 규율 그대로). 경계 ② — 옛 스냅샷(그 자리가 없는 것)을 되살려도 세계가 서고 셈은 0 에서 시작한다.
  경계 ③ — 검사 ㊸ 이 그 키가 실제 탄생지인지 잰다.
- SPEC-008 도구 셋 — brief 에 열셋째 답의 자리가 있고 없으면 미답으로 센다(T2 규율) · 등급이 §14 일곱 질문의 결정 나무로 A/B/C 를 낸다 ·
  `world:lab` 편중 요약에 ㊻ 이 든다 · `world:observe --report` 기회 표에 「지금」 열이 선다(갓 선 세계의 값).
  경계 — 지금 있는 brief 예시 셋(가스 마을 · 유령 도시 · 마법도시)의 등급이 달라지지 않는다 (회귀).
- SPEC-009 회귀 — 검사 마흔여덟의 답 · 방 열셋의 hash · 모든 판정 · 먹이 잔해의 되돌아옴이 C036 과 같다. 규칙 코드에 기회 · 경로 · 탄생지의 이름 글자가 없다.

## State

```text
STATE_VERSION 그대로(11). 기회의 열림 · 닫힘 · 진행은 전부 유도다 (원천 phase · history 가 든다).
State (하나 는다 — 기억의 마지막 마디)
  RegionMemory.births[<탄생지>]   { times, lastAt? } — 다른 셈과 같은 형 · 지워지지 않는 것(PERSISTENT) · 없으면 0 으로 읽는다
데이터 (content/regions · content/authoring)
  FOREST_EDGE.opportunities[비늘]        availability(기억 조건 + WITHIN 240) · outcomes(world 둘 · yield 둘) — 나머지 항목은 C036 의 기본형 그대로
  그 방.opportunities[먹이 잔해]          같은 형 — 눈 없는 것의 경로 · 그 원천의 recoverySeconds 를 그대로 옮긴다
  Yield 표                              열 열넷 · 2층 값 넷
  기회 계약(discovery 어휘 · 동사 · op 표 · yield 열) · T4 결정 나무   → content/authoring/contracts.ts
```

## Rule

- R1 (ADDED) RULE-OPPORTUNITY-OPEN-001 — IF 기회의 availability 가 참 THEN 열림 · 거짓 THEN 닫힘 · 판정 불가 THEN 열지 않음 · 주움이 완료되면 COMPLETE.
  전부 유도이고 아무것도 저장하지 않는다. 판정(available · reason)은 이 규칙이 만지지 않는다.
- R2 (ADDED) RULE-REGION-MEMORY-001 에 사건 하나 — IF 탄생지에서 하나가 태어난다 THEN 그 방의 births 가 오른다 (셈을 올리는 자리는 여전히 `recordMemory` 하나다).
- R3 (AFFECTED) RULE-OPPORTUNITY-NAME-001(C036) — 실리는 것에 `event` · `open` 이 는다.
- R4 (AFFECTED) RULE-LIFE-BIRTH-001 · RULE-SOURCE-RECOVERY-001 · RULE-PRESENCE-PASS-001 — 전제와 전이 그대로. R2 가 앞의 것 뒤에 한 줄 붙고, SPEC-002 가 뒤의 둘과 Event 판정이 같음을 잰다.
- CHANGED — 없음.

## REUSED / ADDED

- REUSED: 위 Existing 전부.
- ADDED: RULE-OPPORTUNITY-OPEN-001 · `RegionMemory.births` · Event 데이터 둘 · outcomes 데이터 · Yield 표 · 기회 계약 · T2 열셋째 · T4 결정 나무 · T6 ㊻ · 기회 표의 「지금」 열 ·
  「지금은 없다」 · 판의 태어남 마디 · `InteractionView.opportunity.event` · `.open` · `RegionMemoryView.births`.
- AFFECTED: R3 · R4.

## Observable (관찰 계약)

```text
interaction.opportunity.event      boolean — 때가 있는 기회인가
interaction.opportunity.open       boolean — 지금 열려 있는가 (판정 불가는 거짓이다 — 세계는 "열려 있지 않다" 까지만 말한다)
region.memory.births[]             { formation, times, lastAt? } — 지난 적 있는 것만 (passages 의 어법 그대로)
투영하지 않는 것   언제 열리는가 · 무엇이 여는가(고래) · 닫는 창 · 남은 시간 · availability 의 형과 잎 · outcomes · Yield 표 · progress 의 값(기억이 이미 싣는다)
```

## UNRESOLVED

**없음 — 동결.** 묶음 질문 Q6(「지금은 없다」 만 붙인다) · Q7(WITHIN 240 으로 자리만 옮긴다) · Q8(도구 셋을 함께)은 Human 이 "제안대로" 로 답했다.
C036 마감이 남긴 「다음 Cycle 로」 여덟은 판정했다 — 여섯을 받고(시간 qualifier 첫 사용처 · availability 의 평가와 판정 불가 · OPEN/CLOSE/COMPLETE 의 이름 ·
기회 표의 「지금」 열 · `history.births` · Event 의 데이터), 둘은 Out of Scope 가 받는다(CROSSED 어법 → 그것을 쓰는 Cycle · 탄생지의 채취 → DESIGN.md 남은 것).

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 먹이 잔해의 WITHIN 값은 지금 코드의 recoverySeconds 를 그대로 옮긴다 — 값이 달라야 하면 그때 묻는다 (자리만 옮기는 Cycle 이다)
② 열림 · 닫힘 · 완료는 유도다 — 저장되는 기회 State 가 없다. 원천의 phase 와 history 가 이미 그것을 든다
③ 판정 불가는 열지 않되 「지금은 없다」 로도 말하지 않는다 — 그 마디는 Event 의 것이다 (C035 기본형 ② "판정 불가는 거짓이 아니다" 를 화면까지 지킨다)
④ STATE_VERSION 을 올리지 않는다 — 저장되는 것이 하나 늘었지만 없는 자리는 0 으로 읽힌다. 언제 올릴 것인가는 C024 가 남긴 결정 대기다
⑤ 문의 저쪽 끝에서는 cross 기회가 서지 않는다 — Lock 은 그 방이 묻는 것이고 기회는 그 방이 내미는 것이다 (C036 이 남긴 것 · 그대로 둔다)
⑥ Yield 표의 뒤 열 열은 값이 0 인 채로 선다 — 없다는 사실이 표에 서야 그 층이 올 자리가 보인다
```
