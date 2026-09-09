# C037 — 때가 있는 기회

묶음 「방은 기억하고 때가 되면 내민다」 의 넷째이자 마지막 Cycle — 묶음 블록은 [C035 spec](../C035-one-shape-of-condition/spec.md) 머리에 있다.
**초안** — C036 마감이 남긴 「다음 Cycle 로」 를 받아 자기 차례("C037 진행")에 동결한다. 묶음 질문 Q6 · Q7 · Q8 의 답이 이 spec 에 든다.
이 Cycle 이 합쳐지면 묶음의 AI 예심 → Human 실주행 판정이다.

```text
CYCLE          C037-an-opportunity-with-a-time
SOURCE         L2-World-Foundation §3 G4 · G6 · G11 · G13 · §4.2 op 표 · §4.5 progress · outcomes · §5.3 · §5.4 T2 열셋째 답 · T4 결정 나무 · T6 ㊻ · §8 기준 23 · 24 · §10 D3 ·
               L2-World-Time 2.6(경로 · leavesBehind) · RoomNeverSame 확정 9(비늘 — 고래가 다시 지나면 돌아온다 · 시간이 아니다) ·
               L2-World-Tool-Scale §2(등급) · §3 T2 · T4 · T6 · C035(Condition · 기억 조건) · C036(Opportunity · 기본형 · ㊺ ㊻) · C018(FALLEN_SCALE · recoveryCause)
SELECTED_FROM  묶음 Cycle 목록 4 — "때가 있는 기회"
```

## Playable Goal

숲 가장자리에서 고래가 아직 지나지 않았을 때 자리를 지목하면 판이 「채취 · 비늘 — 지금은 없다」 를 말하고(언제 · 왜는 말하지 않는다), 고래가 지나간 뒤(그림자 · 경로 선을
보고) 다시 지목하면 「채취 · 비늘」 이 서서 주울 수 있으며, 주우면 그 기회가 닫히고 방의 기억이 오른다. 240 초가 지나면 다시 「지금은 없다」 다 —
되돌리는 것은 시간이 아니라 고래가 다시 지나는 것이다. 이것이 세계의 첫 **Event** 이고 전투가 아니다 (기획서 §8 기준 23 · 24).

## Experience Intent

- Start — 비늘은 "지금은 못 캐는 원천" 이고 왜인지 알 길이 없다.
- End — 비늘은 **때가 있는 기회**다. 지금은 없고 그때는 있다 — 발견된 방이 계속 살아 움직인다 (묶음 Breath 의 "기다림 → 획득 → 새로운 미지" · L0 미증명 ④).

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

1. 고래가 지나기 전(세계 시작 직후 · HKT_PRESENCE 없음): 숲 가장자리 판 「채취 · 비늘 — 지금은 없다」. 원천 자리를 지목해도 「언제」 는 없다.
2. `HKT_PRESENCE=SKY_WHALE_ROUTE` 로 고래가 지나간 뒤: 「채취 · 비늘」 · 주울 수 있다 · 주우면 소지에 고래 비늘 · 방의 기억 `sources[FALLEN_SCALE].takenTotal` 1 · 「채취 · 비늘 — 지금은 없다」 로 돌아간다.
3. 240 세계 초가 지나면 (고래가 다시 지나지 않았으면) 「지금은 없다」 — 시간은 되돌리지 않는다 (RoomNeverSame 확정 9 회귀).
4. `world:check` ㊻ 에 Event 1 (숲 가장자리). ㊺ 통과 — outcomes 의 op 가 표 안이다.
5. `world:observe --report` 기회 표에 비늘 행 — discovery SIGNAL · Event 예 · target FALLEN_SCALE · yield Material.
6. `world:author` 의 brief 에 열셋째 답 자리 · `world:lab` 이 등급 판정에 결정 나무를 쓴다 · 편중 요약에 ㊻.
7. 회귀 — 먹이 잔해(PREY_REMAINS · 눈 없는 것이 남긴다)도 같은 형의 Event 로 선다 (데이터 한 줄 — 코드 0). 나머지 세계는 C036 과 같다.

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
- SPEC-008 회귀 — 검사 마흔여덟의 답 · hash · 모든 판정 · 먹이 잔해의 되돌아옴이 C036 과 같다. 규칙 코드에 기회 · 경로의 이름 글자가 없다.

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
이 spec 에서 새로 생긴 의미: **먹이 잔해의 WITHIN 값** — 지금 코드의 recoverySeconds 를 그대로 옮긴다(기본형 ①) — 값이 다르면 그때 묻는다.
