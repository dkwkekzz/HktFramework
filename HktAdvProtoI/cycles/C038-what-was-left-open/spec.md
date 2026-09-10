# C038 — 열려 있던 것을 닫는다

묶음 없는 **정비 Cycle** — 「방은 기억하고 때가 되면 내민다」(C034~C037)의 기반 검토가 실측으로 찾아낸 **결손 다섯**을 채운다.
새 의미를 세우지 않는다: 다섯 다 앞 spec 이 이미 약속했으나 지키는 자리가 없던 것이거나, 형은 있는데 읽기가 닿지 않던 자리다.

```text
CYCLE          C038-what-was-left-open
SOURCE         plan/CYCLES.md §3.4 검토 ④ 기반 결손 다섯 (C034~C037 의 기반 검토가 실측으로 찾은 것) ·
               C036 spec SPEC-004(HIDDEN 인 기회는 줄에 서지 않는다 — 약속만 있고 지키는 자리가 없었다) ·
               C035 spec(Condition Target 여덟 — 읽기는 다섯) · C037 spec SPEC-007 경계 ③(㊸ 이 태어남의 키를 잰다) ·
               C035 spec 기본형 ⑤ · C036 Out of Scope(표의 「지금」 은 갓 선 세계) · L2-World-Foundation §4.1 · §4.3 · §4.5 · §5.2 · §5.3
SELECTED_FROM  Human — "HIDDEN 거름부터 세워. 기타 결손 채워"
```

## Playable Goal

세계가 **아직 드러나지 않은 기회를 관찰에 싣지 않는다** — 발견되지 않은 것은 관찰자가 알 길이 없다(그것이 HIDDEN 의 뜻이다).
그리고 조건이 문 · 자락 · 되돌아옴까지 읽고, 검사가 태어남의 셈을 양쪽으로 재고, 도구의 표가 갓 선 세계 말고 **묻는 때**의 값을 보이며,
지나간 것이 남긴 자리가 스러진 것도 방의 기억에 남는다. 화면에 새로 서는 글자는 없다 — 이 Cycle 은 **약속을 지키는 Cycle** 이다.

## Experience Intent

- Start — 형과 약속은 섰는데 그것을 지키는 자리가 비어 있다. 세계는 숨긴 것을 흘리고, 조건은 형보다 좁게 읽고, 표는 한 때만 보인다.
- End — 형이 약속한 만큼 세계가 실제로 그렇게 한다.

## World Change

1. **HIDDEN 거름** (C036 SPEC-004 의 약속) — 관찰의 Interaction 에 기회의 이름을 붙일 때 그 기회의 discovery 가 `HIDDEN` 이면 **자리 자체를 두지 않는다**.
   판정(available · reason)은 그대로다 — 숨는 것은 **기회의 이름**이지 행동이 아니다. 판이 아니라 **세계**가 거른다 (View 는 독립 Client 이므로 · 원칙 1).
2. **조건의 읽기가 형만큼 넓어진다** (C035 가 UNREADABLE 로 둔 셋) —
   `connector` · `state` `open` (그 문이 지금 열려 있는가 — `isConnectorOpen` 의 답 그대로) ·
   `area` · `state` `active` (그 자락이 지금 걸려 있는가 — 방의 위상이 덧씌운 자락인가) ·
   `process` · `state` `phase` 와 `property` `progress` (그 원천의 되돌아옴이 지금 어느 마디인가).
   어휘(`worldConditionVocabulary`)가 그 셋을 함께 열어 검사 ㊹ 이 그 잎을 잰다. **판정 함수는 하나도 바뀌지 않는다** — 읽기가 느는 것뿐이다.
3. **검사 ㊸ 이 태어남을 양쪽으로 잰다** — 지금은 "없는 탄생지를 가리키는 키" 만 잡는다. 생명 계통(`CheckLife.formations`)이 그 탄생지가 **어느 방의 것인지**를
   이미 주므로, 원천 · 경로와 **같은 잣대**로 ① 이 방의 것이 아닌 탄생지 키 ② 셀 자리가 있는데 목록에서 빠진 탄생지를 함께 잡는다.
4. **도구의 표가 묻는 때의 값을 보인다** — `world:observe --report --at <철>` 이 조건 표의 「지금」 과 기회 표의 「지금」 을 그 철의 값으로 낸다.
   밝히지 않으면 지금처럼 갓 선 세계(t=0)이고, 표 머리가 어느 때의 값인지 밝힌다.
5. **스러짐도 방의 기억에 남는다** — 지나간 것이 남긴 자리가 머무는 동안이 지나 스러지면(RULE-PRESENCE-LEFT-FADE-001) 그 원천의 **고갈**로 센다.
   「먹혀서 비워진 것도 고갈로 센다」(C034 의 결정)와 **같은 잣대**다 — 캔 것(takenTotal)은 오르지 않는다.

## Observable Result

1. HIDDEN 인 기회를 데이터에 두어도 관찰의 어느 Interaction 에도 그 이름이 실리지 않는다. 그 행동의 available · reason 은 한 값도 달라지지 않는다.
2. `world:check` 마흔여덟의 답이 그대로다 — ㊹ 의 자리 · 잎 수는 어휘가 넓어져도 지금 데이터에 그 갈래의 조건이 없으므로 변하지 않는다.
   일부러 문 · 자락 · 되돌아옴을 묻는 조건을 넣으면 ㊹ 이 그것을 **통과시킨다**(전에는 어휘 밖이라 걸렸다).
3. ㊸ 이 태어남의 뒷면을 잡는다 — 그 방의 것이 아닌 탄생지 키를 넣으면 fail, 셀 자리가 있는데 목록에서 빼도 fail.
4. `npm run world:observe -- --report --at LONG_NIGHT` 의 조건 표 · 기회 표의 「지금」 이 긴 밤의 값이다 (밝히지 않으면 갓 선 세계).
5. 비늘이 스러진 뒤 그 자리를 지목하면 판의 「기억」 줄에 고갈의 셈이 올라 있다 — 아무도 캐지 않았는데도.
6. 회귀 — 그 밖의 모든 판정 · 검사의 답 · 방 열셋의 hash 가 C037 과 같다.

## Reuse

Existing: `opportunityNameOf`(C036) · `RULE-OPPORTUNITY-NAME-001` · `DECIDABLE_DISCOVERY_KINDS`(engine) ·
`worldConditionReader` · `worldConditionVocabulary` · `UNREADABLE`(C035) · `isConnectorOpen` · `depthOverlayAt` · `hazardOverlayTagsAt` · `sourceStateOf` ·
`CheckMemory` · `CheckLife.formations`(region 을 이미 든다) · ㊸ 의 원천 · 경로 잣대 · `world:observe --at`(방 하나의 보고가 이미 받는다) ·
`remember`(C034 · 사건 `depleted`) · `RULE-PRESENCE-LEFT-FADE-001`(C037).

Added:

- World · 투영의 HIDDEN 거름(RULE-OPPORTUNITY-NAME-001 에 경계 한 줄) · 조건 읽기 셋(connector · area · process)과 그 어휘 · 스러짐의 기억 한 줄.
- Engine · ㊸ 의 태어남 뒷면 잣대(`CheckMemory` 에 방마다의 탄생지를 견줄 입력 — 계통이 이미 주는 것을 쓴다).
- 도구 · `world:observe --report --at <철>`.
- View · 없음 — `discovery-hidden` 문구는 세계가 그것을 싣지 않게 되었으므로 표에서 **지운다**(닿지 않는 말을 표에 두지 않는다).

## Out of Scope

- HIDDEN 이 **발견되는** 절차(무엇이 그것을 드러내는가) → 3층 (발견 상태 다섯 · Foundation §5.5). 이 Cycle 은 **거름**만 세운다.
- 새 조건 갈래(actor · player · faction · chance)의 읽기 → 그 층. 이 Cycle 이 여는 셋은 **이미 형에 있고 세계가 값을 아는** 것뿐이다.
- 「몇 번 스러졌나」 를 고갈과 **따로** 세는 것 → 두지 않는다 (같은 잣대로 센다 · 아래 기본형 ③).
- 판이 스러짐을 따로 말하는 것 → 없다 (판은 고갈의 셈을 지금 어법 그대로 말한다).
- `--at` 이 방 하나의 그림에 덧씌움을 얹는 것 → §5 도구 부채 그대로 (보고만 낸다).

## SPEC

- SPEC-001 HIDDEN 거름 — 어떤 기회의 discovery 가 `HIDDEN` 이면 그 기회의 이름이 관찰의 어느 Interaction 에도 실리지 않는다 (`opportunity` 자리 자체가 없다).
  경계 ① — 그 행동의 `available` · `reason` · `role` · 차례는 한 값도 달라지지 않는다 (숨는 것은 이름이지 행동이 아니다).
  경계 ② — VISIBLE · SIGNAL · TRACE 는 지금 그대로 실린다.
- SPEC-002 조건이 문을 읽는다 — `{ target: connector <문>, query: state 'open' }` 이 그 문이 지금 열려 있는가를 답하고, 그 답이 `isConnectorOpen` 과 모든 철 · 모든 패턴에서 같다.
- SPEC-003 조건이 자락을 읽는다 — `{ target: area <자락>, query: state 'active' }` 가 그 자락이 지금 방의 위상으로 걸려 있는가를 답한다.
  경계 — 어느 위상도 걸지 않는 자락은 거짓이다 (모른다가 아니다 — 그 자락은 세계에 있고 지금 걸려 있지 않을 뿐이다).
- SPEC-004 조건이 되돌아옴을 읽는다 — `{ target: process <원천>, query: state 'phase' }` 가 그 원천의 지금 phase 를,
  `{ target: process <원천>, query: property 'progress' }` 가 되돌아옴의 진행을 답한다.
  경계 — 세계가 모르는 이름은 여전히 판정 불가다 (없는 것과 모르는 것은 다르다 · C035 규율).
- SPEC-005 어휘가 함께 넓어진다 — 검사 ㊹ 이 그 세 갈래의 잎을 통과시키고, 어긋난 경로(`open` 아닌 글자 등)는 여전히 fail 이다.
  경계 — 지금 데이터에는 그 갈래의 조건이 하나도 없으므로 ㊹ 의 답(자리 30 · 잎 31)은 달라지지 않는다.
- SPEC-006 ㊸ 의 태어남 뒷면 — 방마다 ① 그 방의 것이 아닌 탄생지 키 ② 셀 자리가 있는데 목록에서 빠진 탄생지를 원천 · 경로와 같은 잣대로 잡는다.
  경계 — 계통(`CheckLife`)을 주지 않으면 뒷면은 재지 않는다 (없는 계약을 거짓으로 읽지 않는다).
- SPEC-007 표가 묻는 때를 보인다 — `--report --at <철>` 이 조건 표 · 기회 표의 「지금」 을 그 철의 값으로 내고, 표 머리가 어느 때인지 밝힌다.
  경계 — `--at` 없이 돌리면 지금과 글자까지 같다 (갓 선 세계).
- SPEC-008 스러짐이 고갈로 센다 — 남긴 자리가 스러지면 그 원천의 `depletedTimes` 가 1 오르고 `lastDepletedAt` 이 그때다. `takenTotal` 은 오르지 않는다.
  경계 ① — 캐서 고갈된 것과 셈이 갈리지 않는다 (같은 사실을 세계가 두 말로 하지 않는다 · C034 의 결정).
  경계 ② — 스러지지 않은 자리(주워 간 자리 · 아직 머무는 자리)의 셈은 달라지지 않는다.
- SPEC-009 회귀 — 검사 마흔여덟의 답 · 방 열셋의 hash · 모든 Interaction 의 available · reason · 순서 · 기회의 유도가 C037 과 같다.

## State

```text
새 State 없음. STATE_VERSION 그대로(11). 스러짐은 이미 있는 셈(sources[id].depletedTimes · lastDepletedAt)에 든다.
```

## Rule

- R1 (CHANGED) RULE-OPPORTUNITY-NAME-001 — IF 그 기회의 discovery 가 HIDDEN THEN 이름을 싣지 않는다. 나머지 전제와 전이는 그대로.
- R2 (AFFECTED) RULE-CONDITION-READ-001 — 읽는 Target 이 다섯에서 여덟이 된다. 판정의 답은 지금 데이터에서 하나도 달라지지 않는다.
- R3 (AFFECTED) RULE-PRESENCE-LEFT-FADE-001 — 스러뜨린 뒤 `remember` 를 한 번 부른다 (셈을 올리는 자리는 여전히 하나다).
- R4 (ADDED · 기반) ㊸ 의 태어남 뒷면 잣대.
- CHANGED — R1 하나. 그 변경은 **약속을 지키는 것**이지 새 의미가 아니다 (C036 SPEC-004 가 이미 그렇게 적었다).

## REUSED / ADDED

- REUSED: 위 Existing 전부.
- ADDED: HIDDEN 거름 · 조건 읽기 셋과 그 어휘 · ㊸ 뒷면 · `--report --at` · 스러짐의 기억.
- CHANGED: RULE-OPPORTUNITY-NAME-001.
- AFFECTED: R2 · R3.

## Observable (관찰 계약)

```text
interaction.opportunity?   REUSED (C036 · C037) — **HIDDEN 인 기회는 이 자리에 서지 않는다** (형은 그대로)
region.memory.sources[].depletedTimes · lastDepletedAt   REUSED (C034) — 스러짐도 이 셈에 든다
투영하지 않는 것   HIDDEN 인 기회의 존재 · 그것이 무엇인지 · 무엇이 그것을 드러내는가 (3층) ·
                 조건이 읽는 새 값(문의 열림 · 자락의 걸림 · 되돌아옴의 마디)은 여전히 조건의 결과 코드로만 말해진다
```

## UNRESOLVED

**없음 — 동결.** 다섯 다 앞 spec 이 이미 정한 의미이고 새로 결정할 게임 의미가 없다.

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 거름은 **세계**가 한다 — 판이 그리지 않는 것으로 두면 다른 Client 가 그것을 보게 된다 (원칙 1 · 3)
② 여는 읽기 셋은 **세계가 이미 값을 아는 것**뿐이다 — 문의 열림 · 자락의 걸림 · 되돌아옴의 마디. 새 State 도 새 판정도 없다
③ 스러짐을 고갈과 **같은 셈**으로 센다 — 「먹혀서 비워진 것도 고갈로 센다」(C034)와 같은 잣대다.
   따로 세면 같은 사실("그 자리가 비었다")을 세계가 두 말로 하게 된다. 따로 세야 하면 데이터가 아니라 형이 늘 자리다
④ `--at` 은 보고의 표에만 닿는다 — 방 하나의 그림에 덧씌움을 얹는 것은 도구 부채 그대로다
⑤ `discovery-hidden` 문구를 표에서 지운다 — 세계가 그 코드를 싣지 않게 되었으므로 닿지 않는 말이다
```
