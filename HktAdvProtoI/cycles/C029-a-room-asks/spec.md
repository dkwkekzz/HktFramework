# C029 — 방이 묻는다

```text
CYCLE          C029 — 성질 어휘 · Lock 데이터 계약 · 문 앞의 현상과 지목의 대답 · Seed 의 성질 · 검사 아홉
SOURCE         content/roadmap/play/RoomAsksForPossibilities.md (§2 완료 확인 ① ② · §4 막힘·현상·추측 ·
               §5.1 · §5.2 · §5.7 · §6 W46~W49 · W52 · V23 · V25 · E19 · 확정 1 ~ 4 · 8)
               content/roadmap/L2-World-Access.md §3 확정 K1~K15 · §4 데이터 계약 · §5.2 검사 ㉞~㊷ ·
               §9 역기술(9.1 Lock 표 · 9.2 Possibility 표 · 9.3 검사를 지금 돌리면) · §10 D1 · D4 · 빈칸 1
               content/roadmap/L2-World-Material.md §6.1 observableProperties (다섯 항) · S4 흔적 · S10 쓰임
               content/roadmap/play/RoomOfAnotherKind.md §5.3 (FROST_DEPTH 의 문 · 확정 4) · 부록 FROZEN_REMAINS
               content/roadmap/play/RoomBearsMaterial.md D2 (재료 셋의 성질 문장) · RoomAnswersWhenAsked §5.3 지목
SELECTED_FROM  Play §7 Cycle Breakdown 의 첫째 항목 (C029 — 이 Play 의 첫 Cycle)
확장            C009(문의 활성 조건) · C016(문의 철 조건) · C020(문이 밝힌 요구) · C011~C014(재료 계통) ·
               C026~C028(지목과 판) 위에 **더한다** — 그 spec 들의 Semantic/Rule 을 복사하지 않고 이름으로 인용한다
```

## Playable Goal

**긴 밤에 빙결 협곡 안쪽의 문 앞에 서면 몸에서 김이 피어올라 푸르게 빛나고, 그 문을 지목하면
판이 "체열이 감지된다" 라고 답한다** — 요구의 이름도 답이 어디 있는지도 말하지 않는다. 그리고
그 협곡의 결정을 지목하면 판이 처음으로 **재료의 이름과 그 성질**을 말한다("빙정석 · 열을 먹는다 ·
푸르게 빛난다 · 열이 닿으면 자란다"). 세계에 성질의 어휘 하나가 서고, 세 문이 같은 형(Lock)으로 적힌다.

## Experience Intent

```text
Start  문은 잠겨 있고 표식은 "저장된 열이 있어야 한다" 라고 적혀 있다 — 세계가 답을 알려 준 셈이다.
End    문은 답을 알려 주지 않는다. 알려 주는 것은 **현상**이다 — 내 몸의 김이 푸르게 빛나고
       언 사체 곁의 결정에는 김이 없다. "살아 있는 것이 아니라 따뜻한 것을 본다" 는 내가 읽은 것이다.
```

Play §4 Breath 의 **막힘 → 현상 → 추측** 세 마디다. 되돌아감·발견(C030) · 다른 길·넘길 것(C031)이 뒤를 잇는다.

## World Change

1. **세계에 성질의 어휘가 하나 선다** — 축 다섯(heat · light · vibration · space · flesh) ·
   관계 일곱(absorbs · stores · emits · senses · hides · grows-on · fixes) · 그리고 요구에 대해 성질이
   하는 일(answers) 다섯 줄. 세계 전체에 하나이고 Region 전용이 아니다. **규칙 코드는 이 글자를
   하나도 알지 못한다** (C004 가 세운 규율 · K5).
2. **요구가 한 형으로 적힌다 (Lock)** — 지금 두 표(`CONNECTOR_ACTIVATIONS` · `CONNECTOR_REQUIREMENTS`)에
   흩어져 있던 문의 조건과 요구가 `RegionSpec.access.locks` 하나로 **옮겨진다**. 세 문이 그 형으로 선다:
   미로의 심장 문(state) · 걷는 숲의 문(time) · 빙결 심층의 문(time + property).
   **판정하는 함수는 여전히 하나다** — 열림/잠김의 답도 사유도 한 값 달라지지 않는다.
3. **요구를 알아낼 흔적이 데이터에 선다** — Lock 마다 traces. 빙결 심층의 문은 둘이다:
   문 앞의 자락(몸이 들면 김이 서고 푸르게 빛난다)과 언 사체의 자리(그것에는 김이 없다 — 대조).
4. **문 앞에 서면 몸이 그것을 보인다** — 그 자락 안의 **몸**에 조건 코드가 실린다. 세계 위에 늘 뜬
   글자가 아니고 HUD 도 아니다 — 몸의 투영에 붙고, 자락 밖으로 나오면 사라진다.
   **차가운 것(원천 · 출구 표식)에는 실리지 않는다.**
5. **지목하면 현상을 말한다** — 빙결 심층 문의 표식이 지고 있던 요구의 코드가 **현상의 코드**로
   바뀐다("저장된 열이 있어야 한다" → "체열이 감지된다"). 요구의 이름도 · 무엇이 그것을 채우는지도 ·
   답이 어디 있는지도 여전히 싣지 않는다.
6. **재료가 성질을 진다** — Material Seed 에 성질 태그가 붙는다(숲 셋 · 빙정석). 태그는 그 재료의
   관찰되는 문장 하나를 가리킨다 — 문장에 없는 성질을 태그가 말하지 않는다.
7. **판이 재료의 이름과 성질을 말한다** — 원천을 지목하면 무엇인가(재료 이름)와 그 성질 문장들이
   판에 선다. C011 이 남긴 부채("판이 재료의 이름을 말하지 않는다")를 여기서 갚는다.
8. **도구가 요구와 가능성을 잰다** — 검사 아홉(㉞~㊷)이 스물여섯 뒤에 붙어 서른다섯이 된다.
   참조 무결성 셋(㉞ ㉟ ㊶)과 요약 여섯(㊱ ㊲ ㊳ ㊴ ㊵ ㊷). 세계를 바꾸지 않는 읽기 전용이다.

## Observable Result

1. 긴 밤에 빙결 협곡의 북쪽 끝(문 앞)에 걸어가면 몸에 **김이 서고 푸르게 빛난다**. 자락 밖으로
   물러나면 사라진다.
2. 그 문을 지목하면 판의 「걸린 것」이 **체열이 감지된다**이다. 요구의 이름(heat:hides)도 · 답의
   자리도 · 화살표도 화면 어디에도 없다.
3. 언 사체 곁의 결정을 지목하면 김의 표시가 없다 — 그것은 문 앞에 서지 않는다.
4. 그 결정을 지목한 판이 **빙정석 · 열을 먹는다 · 푸르게 빛난다 · 열이 닿으면 자란다**를 말한다.
   숲의 원천을 지목하면 그 재료의 이름과 성질이 같은 어법으로 선다.
5. 고요에 그 문은 여전히 **잠겨** 있고 긴 밤에는 **열려** 있다 — 사유도 "이 철이 아니다" 그대로다.
   미로의 심장 문도 배열 P2 에서만 열린다. 문의 열림은 한 값도 달라지지 않았다.
6. `npm run world:check` 가 서른다섯을 낸다 — ㉞ 통과 · ㊶ 통과 · ㉟ 은 GAP(답할 성질의 원천이
   아직 없다) · ㊱ ㊲ ㊳ ㊴ ㊵ ㊷ 이 수를 적는다. 종료 코드는 0 이다.
7. ㊳ 이 고아 어휘를 그대로 보인다 — `space:fixes` 와 `vibration` 축은 요구도 답도 없다.
   ㊷ 이 "빙결 심층의 문 뒤는 경계" 를 보인다. 둘 다 이 Cycle 의 결손이 아니라 다음 행의 자리다.
8. 숲 · 미로 · 백왕령 · 협곡의 땅과 원천과 관찰 범위는 한 값도 달라지지 않는다.

## Reuse

```text
Existing (그대로 쓴다 · 이름만 인용한다)
  RULE-CONNECTOR-ACTIVATION-001 문이 지금 열려 있는가 (C002 · C009 · C016) — 판정하는 자리 하나
  RULE-EXIT-REQUIREMENT-001 문이 밝힌 것이 표식에 실린다 (C020) — 자리 그대로, 값의 뜻만 바뀐다
  RULE-BEING-READING-001 · beingRows 지목한 존재의 판 (C027) · 판의 「걸린 것」 줄 (C012 · C027)
  EntityView.conditions 조건 코드가 실리는 자리 (C012 · C020) — 봉투에 새 자리를 내지 않는다
  MaterialSeed · ResourceSourceSpec · MATERIAL_SEEDS (C011 · C014 · C018 · C020)
  Region Description 의 area/point op 와 areaCoversPoint (C005~C007)
  검사 스물여섯과 CheckItem · CheckRef · reachableRegions (T1 · C014 · C018)

Added — Data (content/regions)
  properties.ts                          PropertyVocabulary — 축 다섯 · 관계 일곱 · answers 다섯 (D1)
  access.ts                              Lock 형 · 요구 형 · 흔적 형 · 사유 코드 · 연결자별 Lock 색인
  frost-canyon.ts                        문 앞의 자락 op 하나 · 그 방의 access.locks 하나
  fantasy-maze.ts · forest-deep.ts       그 방의 access.locks 하나씩 (옮겨 온 것)
  graph.ts                               CONNECTOR_ACTIVATIONS · CONNECTOR_REQUIREMENTS 가 사라진다 (CHANGED)
  resource-ecology.ts                    MaterialSeed.properties · 숲 셋과 빙정석의 태그

Added — World (content/world)
  RULE-LOCK-ACTIVATION-001               Lock 의 time · state 요구가 문의 열림을 정한다 (판정하는 자리는 그대로)
  RULE-LOCK-TRACE-BODY-001               Lock 의 흔적 자락에 든 몸에 그 흔적의 조건 코드가 실린다
  RULE-LOCK-REASON-001                   Lock 이 밝힌 현상의 코드가 그 문의 표식에 실린다

Added — View (content/view)
  material-property 줄                   지목한 원천의 판에 재료 이름과 성질 문장이 선다
  문구                                    asks-warmth(체열이 감지된다) · breath-glows(김이 푸르게 빛난다) ·
                                          재료 성질 문장 여덟

Added — Engine (engine/world-authoring)
  CheckAccess 계약 + 검사 아홉 (㉞~㊷)    게임 명사 없이 — 어휘 · Lock · Seed 의 성질을 구조로만 받는다

Added — Tools
  world:check 가 서른다섯을 낸다 (읽기 전용 · 세계를 바꾸지 않는다)
```

## Out of Scope

```text
HEAT_CRYSTAL Seed 를 MATERIAL_SEEDS 에 세우는 것                        C030 — 아래 "기본형으로 둔 것" ①
열을 저장하는 결정의 원천 · trace · 채취 · 회복 · ㉟ 통과 · ㊴ Material 1  C030
Lock.relaxedBy(눈보라) · 완화 표시 · ㊴ Environment 1 · ㊵ ≥ 2           C031
열쇠 × 자물쇠 표 (world:observe --report 의 E20)                        C030
T4 계약 목록에 성질 어휘 (E21)                                          C031
MAZE_GATE 의 knowledge Lock — 요구의 갈래로 자리만 두고 데이터는 비워 둔다  3층 (확정 1 · K2 · ㊶ 이 흔적을 요구한다)
property Lock 을 실제로 판정하는 것 (몸 · 소지)                          3 · 4층 (K12 — 이 Play 의 마지막 장면은 거절이다)
RegionSpec.access.silence (왜 묻지 않는가)                              읽는 검사가 아직 없다 — T4 가 받는다 (C031)
성질의 수치 · 조합 · SUPPORTS/OPPOSES 의 실제 효과                       4층
```

## SPEC

```text
SPEC-001  세계에 성질의 어휘가 하나 선다
  축 다섯과 관계 일곱이 세계 전체에 하나로 서고, 요구에 대해 성질이 하는 일(answers)이 함께 적힌다.
  경계 ① 규칙 코드는 어떤 축도 어떤 관계도 이름으로 알지 못한다 — 어휘를 통째로 갈아도
         세계가 도는 방식은 한 줄도 달라지지 않는다.
  경계 ② 어휘에 있으나 아무도 쓰지 않는 항목(고아)이 있어도 검사는 실패하지 않는다 — 수만 적는다.

SPEC-002  요구가 한 형으로 적히고, 문의 열림은 한 값도 달라지지 않는다
  세 문의 조건이 Lock 으로 옮겨진 뒤에도 열림/잠김의 답과 잠긴 사유가 옮기기 전과 같다 —
  미로의 심장 문은 배열 P2 에서만, 걷는 숲과 빙결 심층의 문은 긴 밤에만 열린다.
  경계 ① Lock 을 갖지 않은 문은 언제나 활성이다 (지금까지의 세계 그대로).
  경계 ② property 요구는 열림을 판정하지 않는다 — 그것을 밝힌 문도 밝히지 않은 문과 같은 답을 낸다.
  경계 ③ 저장되는 State 가 하나도 늘지 않는다 — 되살린 세계도 같은 답을 낸다.

SPEC-003  문 앞의 현상 — 몸이 그것을 보인다
  Lock 의 흔적이 몸에 보일 것을 밝혔으면, 그 흔적의 자락 안에 선 몸에 그 조건 코드가 실린다.
  경계 ① 자락 밖으로 나오면 실리지 않는다 — 저장되지 않는 유도된 사실이다.
  경계 ② 몸이 아닌 것(원천 · 출구 표식)에는 어느 자리에서도 실리지 않는다.
  경계 ③ 관찰자 자신의 몸만이 아니라 그 자락에 든 **모든 몸**에 실린다.
  경계 ④ 보일 것을 밝히지 않은 흔적은 몸에 아무것도 걸지 않는다 (언 사체의 자리가 그렇다).

SPEC-004  지목하면 현상을 말한다
  현상의 코드를 밝힌 Lock 이 걸린 문의 표식에 그 코드가 실리고, 지목하면 판이 그 말을 한다.
  경계 ① 요구의 이름(축:관계) · 답이 될 재료 · 답의 자리는 어디에도 실리지 않는다.
  경계 ② 현상을 밝히지 않은 Lock 이 걸린 문의 표식은 한 값도 달라지지 않는다.
  경계 ③ 그 코드는 문의 열림을 한 값도 건드리지 않는다.

SPEC-005  재료가 성질을 지고, 판이 그것을 말한다
  Seed 에 붙은 성질 태그마다 그 재료의 문장 하나가 있고, 원천을 지목하면 판에 재료의 이름과
  그 문장들이 선다.
  경계 ① 성질을 밝히지 않은 재료(고래 비늘)의 판은 이름까지만 말한다.
  경계 ② 재료가 아닌 것(출구 표식 · 몸)의 판에는 그 줄이 아예 없다.
  경계 ③ 쓰임은 어디에도 없다 — 무엇으로 만드는지 이 층은 말하지 않는다.

SPEC-006  도구가 요구와 가능성을 잰다
  world:check 가 아홉을 더해 서른다섯을 낸다. ㉞(어휘·자리의 참조)와 ㊶(Lock 마다의 흔적)은
  통과이고, ㉟ 은 답할 성질의 원천이 아직 없어 GAP 이며, ㊱ ㊲ ㊳ ㊴ ㊵ ㊷ 은 수만 적는다.
  경계 ① GAP 도 요약도 종료 코드를 1 로 만들지 않는다 — 종료 코드는 fail 하나가 정한다.
  경계 ② 읽기 전용이다 — 돌린 앞뒤로 저장소에 는 것이 없고 세계의 값도 바뀌지 않는다.
  경계 ③ 두 번 돌리면 글자까지 같다.

SPEC-007  앞의 세계는 그대로다 (회귀)
  방 열하나의 땅 · 표면 · 통행 · hash · 걸린 것 · 관찰 범위 · 원천의 phase 와 마디 · 자국 ·
  지나는 것 · 소란이 한 값도 달라지지 않는다. 검사 스물여섯의 답도 그대로다.
```

## State

이 Cycle 은 **세계 State 를 하나도 늘리지 않는다.** 어휘도 Lock 도 성질도 전부 컨텐츠 데이터이고,
문 앞의 현상은 같은 자리 · 같은 데이터면 언제나 같은 답이 나오는 **유도된 사실**이다
(C016 의 위상 · C019 의 상시 · C020 의 요구와 같은 갈래).

```text
PropertyVocabulary        세계 전체 하나 — 데이터
  aspects[]               { id · meaning · basis }
  relations[]             { id · meaning · basis }
  answers[]               { requirement · property · kind(SUPPORTS|OPPOSES|REVEALS) · basis }

RegionSpec.access?        그 방이 묻는 것 — 데이터 (없으면 묻지 않는 방이다)
  locks[]                 Lock

Lock                      요구 하나
  id                      LOCK_ID
  at                      { kind: 'connector' | 'area' · ref }
  strength                'soft' | 'hard'
  requires[]              { property? · time? · state? · knowledge? } — 전부 참이어야 열린다
  important?              ㊴ ㊵ 가 세게 보는가 (밝히지 않으면 거짓)
  traces[]                { op · showsOnBody? } — 이 요구를 알아낼 흔적. 하나 이상
  reason?                 지목했을 때 판이 말하는 **현상**의 코드 (밝히지 않으면 표식이 그대로다)

MaterialSeed.properties?  그 재료의 성질 태그들 — 데이터 (밝히지 않으면 성질이 없는 재료다)
  { tag · from }          from = 다섯 항 중 어느 문장에서 나왔는가
                          (appearance | behavior | conditionResponse | persistence | danger)
```

이 Cycle 의 데이터 값 표.

| 자리 | 값 | 근거 |
|---|---|---|
| 축 다섯 | heat · light · vibration · space · flesh | Access §4.1 · D1 |
| 관계 일곱 | absorbs · stores · emits · senses · hides · grows-on · fixes | Access §4.1 · D1 |
| answers 다섯 | heat:hides ← heat:stores(S) · heat:absorbs(S) · heat:emits(O) · heat:absorbs(R) · heat:absorbs ← heat:stores(S) | Access §4.1 |
| Lock 셋 | MAZE_HEART_GATE(state) · WALKING_FOREST_DOOR(time) · FROST_DEPTH_DOOR(time + property) | Access §9.1 |
| 중요한 Lock | FROST_DEPTH_DOOR 하나 | Access §9.1 "중요" |
| 빙결 심층 문의 요구 | time LONG_NIGHT · property `heat:hides` | Access §9.1 · 확정 2 |
| 그 문의 흔적 | 문 앞의 자락(몸에 김) · 언 사체의 자리(대조) | 확정 3 · D4 |
| 문 앞 자락 | 원 중심 (0, 18) · 반지름 4 — 문 anchor 그 자리 | 아래 기본형 ③ |
| 몸에 걸리는 코드 | `breath-glows` | 아래 기본형 ④ |
| 그 문의 현상 코드 | `asks-warmth` | Play §6 V25 |
| 미로 심장 문의 흔적 | 위치를 유지하는 식물 넷 (clue-a ~ clue-d) | Access §9.1 "위치를 유지하는 식물" |
| 걷는 숲 문의 흔적 | 숲 안쪽의 흙 (trace-deep-base) | Access §9.1 "하늘 · 흙 · 발자국이 철을 말한다" |
| 생체 광석의 성질 | flesh:stores · light:emits | Access §9.2 |
| 광식충 허물의 성질 | light:emits | Access §9.2 |
| 거목균의 성질 | flesh:absorbs · light:absorbs | Access §9.2 |
| 빙정석의 성질 | heat:absorbs · light:emits · heat:grows-on | Access §9.2 |
| 고래 비늘의 성질 | 없음 | Access §9.2 "(성질 미정)" · 빈칸 4 |

## Rule

```text
R1  RULE-LOCK-ACTIVATION-001 (CHANGED — C009 R1 · C016 R4 의 그 판정 자리)  — Lock 이 문의 열림을 정한다
    IF   그 문에 걸린 Lock 이 time 요구를 밝혔고 지금 철이 그 목록에 없다
    THEN 잠긴다 — 사유는 "이 철이 아니다".
    IF   그 문에 걸린 Lock 이 state 요구를 밝혔고 그 방의 지금 패턴이 그 목록에 없다 (또는 State 가 없다)
    THEN 잠긴다 — 사유는 "잠겨 있다".
    ELSE 활성이다.
    경계 ① property · knowledge 요구는 이 판정에 들어오지 않는다 (K12) — 2층은 표시까지다.
    경계 ② Lock 이 없는 문 · 요구를 하나도 밝히지 않은 Lock 은 언제나 활성이다.
    비고  **판정하는 함수는 여전히 하나다** (C009 가 세운 규율). 늘어난 것은 그 함수가 읽는 자리가
          두 표에서 Lock 하나로 바뀐 것뿐이고, 어떤 문이 무엇을 요구하는지는 여전히 데이터에만 있다.

R2  RULE-LOCK-TRACE-BODY-001 (ADDED)  — 문 앞의 현상
    IF   몸이 선 방의 Lock 가운데 어느 흔적이 **몸에 보일 것**을 밝혔다
         AND 그 흔적의 op 가 그 방에 실제로 있는 area 다
         AND 몸이 그 area 안에 있다
    THEN 그 몸의 조건 코드에 그 흔적이 밝힌 코드가 실린다.
    ELSE 그 몸에는 한 글자도 늘지 않는다.
    경계 ① 몸이 아닌 것에는 어느 자리에서도 실리지 않는다 — 실리는 자리를 몸의 투영에만 둔다.
    경계 ② 겹치면 걸린 것이 전부 실린다 (걸린 것의 어법 그대로 · C006 · C016 · C019).
    경계 ③ 밝힌 op 이 그 방에 없으면 아무 일도 하지 않는다 (끊긴 참조는 조용하다 · C021 R1 의 규율).
    비고  규칙은 김도 문도 알지 못한다 — Lock 이 가리킨 자락을 묻고 코드를 옮길 뿐이다.

R3  RULE-LOCK-REASON-001 (CHANGED — C020 R5 의 그 자리)  — 지목하면 현상을 말한다
    IF   그 문에 걸린 Lock 이 현상의 코드를 밝혔다
    THEN 그 출구 표식의 조건 코드에 그 코드가 실린다.
    ELSE 그 표식은 한 값도 달라지지 않는다.
    경계 ① 열림/잠김을 한 값도 건드리지 않는다 (C020 이 세운 그 분할선 그대로).
    경계 ② 요구의 이름도 · 무엇이 그것을 채우는지도 · 어디서 나는지도 내지 않는다.
    비고  C020 의 `requires-stored-heat`(요구의 이름)가 `asks-warmth`(현상)로 바뀐다. 자리도 형도
          그대로이고 바뀐 것은 **그 코드가 무엇을 말하는가** 하나다 — 세계는 답을 알려 주지 않는다 (K8).

R4  검사 아홉 (ADDED · 기반)  — 요구와 가능성을 잰다
    ㉞ 참조    Lock 의 property 요구와 Seed 의 성질 태그가 어휘에 있는가 · at.ref 가 실제 문/자락인가 ·
              성질 태그가 문장 하나(from)를 가리키는가                                        pass | fail
    ㉟ 답      모든 property Lock 에 SUPPORTS 인 성질을 가진 Seed 가 있고, 그 원천이 시작 방에서
              그 Lock 을 지나지 않고 닿는 방에 하나 이상 있는가                              pass | absent(GAP)
    ㊱ 편중    성질 하나가 답하는 Lock 의 수 · 축별 편중                                            report
    ㊲ 거리    Lock 의 방과 답 원천의 방이 같은 비율 · depth 관계                                   report
    ㊳ 고아    어느 Lock 도 요구하지 않는 성질 · 어느 Seed 도 가지지 않은 성질                       report
    ㊴ 종류    중요 Lock 마다 답의 종류별 수 (Material · Life · Environment · Actor · Knowledge)      report
    ㊵ 다양    답이 같은 종류의 복제인가 — 종류가 다른 답의 수                                       report
    ㊶ 흔적    모든 Lock 에 흔적이 하나 이상 있고 그 op 가 그 방(또는 이웃)에 실제로 놓였는가        pass | fail
    ㊷ 뒤      그 Lock 뒤에만 있는 것 (방 · 원천 · 문)                                              report
    경계 ① ㉟ 의 부정은 **실패가 아니라 GAP** 이다 (Access §5.2 가 셋을 갈라 적었다) — 잴 것(답의
           원천)이 놓이지 않은 것이므로 `absent` 로 적고, 통과로도 적지 않는다 (⑮ 의 선례 그대로).
    경계 ② 요약 여섯은 판정하지 않는다 — 많고 적음은 사람이 본다 (⑲ ⑳ 의 선례).
    경계 ③ 계약을 주지 않으면 아홉이 전부 absent 다 (계통 열셋 · 시간 넷이 그런 그대로).
    비고  기반은 heat 도 문도 재료도 알지 못한다 — 어휘 · Lock · 성질을 **구조로만** 받는다.

R5  RULE-BEING-READING-001 (CHANGED — C027 의 그 표)  — 판이 재료의 이름과 성질을 말한다
    IF   지목한 존재가 재료를 밝혔다
    THEN 판에 그 재료의 이름 줄이 서고, 그 재료가 성질을 밝혔으면 성질 문장들이 이어 선다.
    ELSE 그 줄이 아예 없다 (없는 것을 빈 줄로 지어내지 않는다 · C027 의 어법).
    경계 ① 쓰임은 서지 않는다 (S10).
    경계 ② 성질의 말은 재료마다 다르다 — 같은 태그라도 그 재료의 문장이 선다 (태그는 문장의 색인이다 · K7).
```

## REUSED / ADDED

```text
REUSED    RULE-CONNECTOR-ACTIVATION-001 · RULE-EXIT-REQUIREMENT-001 · RULE-BEING-READING-001 ·
          RULE-SAFEBY-001 · RULE-STANDING-CONDITIONS-001 · RULE-OBSERVE-PROJECTION ·
          MaterialSeed · ResourceSourceSpec · CheckItem · reachableRegions · areaCoversPoint
ADDED     RULE-LOCK-TRACE-BODY-001 · 검사 ㉞~㊷ · PropertyVocabulary · Lock · MaterialSeed.properties ·
          RegionSpec.access · `asks-warmth` · `breath-glows` · 문 앞의 자락 op 하나
CHANGED   RULE-LOCK-ACTIVATION-001 (읽는 자리가 두 표에서 Lock 으로 · 답은 그대로) ·
          RULE-LOCK-REASON-001 (표식이 지는 코드가 요구의 이름에서 현상으로) ·
          RULE-BEING-READING-001 (판에 재료의 이름과 성질 줄이 는다)
AFFECTED  빙결 심층 문의 표식을 읽던 시나리오(C020 · C021) — 코드 이름이 바뀐다. 걸리는 조건과
          철에 따른 답은 그대로다. 활성 표를 읽던 시나리오(C004 · C009 · C016 · C021) — 읽는 자리가
          Lock 으로 바뀐다. 답은 그대로다.
```

## Observable (관찰 계약)

```text
투영한다
  entities[].conditions           (있던 자리) 몸에도 실린다 — 문 앞의 현상 코드
  entities[].conditions           (있던 자리) 출구 표식에 현상의 코드 (요구의 이름이 아니다)
  entities[].material             (있던 자리 그대로 — View 가 이제 그것을 읽어 이름과 성질을 짓는다)

투영하지 않는다 — 이것이 이 Play 의 미지감이다
  요구의 이름(heat:hides) · 어휘 그 자체 · answers 표
  그 요구에 답할 재료가 무엇인지 · 어디서 나는지 · 그 방까지의 길
  Lock 이 몇인지 · 어느 문이 무엇을 요구하는지의 표
  흔적이 왜 그렇게 보이는지 · 김이 무엇을 뜻하는지
  Seed 의 성질 태그 그 자체 (판이 옮기는 것은 그 재료의 **문장**이다)
```

## UNRESOLVED

없음.

기본형으로 둔 것 (Design 이 침묵해 기존 규율을 그대로 따른 자리 — Human 이 감사할 자리다).

```text
① HEAT_CRYSTAL Seed 를 이 Cycle 에 세우지 않았다. Play Breakdown 은 "열 결정은 Seed 만" 이라 적었으나,
   원천 없는 재료는 검사 ⑫(자리를 얻은 원천이 없는 재료 · C014 에 동결)에서 **fail** 이 되어 종료 코드를
   1 로 만든다. 이 세계의 선례도 같다 — 원천이 없는 공간 왜곡 결정은 MATERIAL_SEEDS 에 서 있지 않다.
   그래서 Seed 와 그 원천을 함께 세우는 C030 으로 넘긴다. 그 결과 이 Cycle 의 ㉟ 은 "성질을 가진 Seed 가
   없다" 는 GAP 이고 ㊴ 의 Material 열은 0 이다 — C030 이 둘 다 Play 가 적은 자리로 옮긴다.
② 빙결 심층 문 Lock 의 강도를 `hard` 하나로 두었다. Access §9.1 은 "hard + soft" 라 적었으나 강도는
   Lock 하나에 하나이고, 2층이 판정하는 요구(time)는 hard 다. soft 로 읽힐 요구(property)는 판정 자체가
   3층의 것이므로 갈래를 미리 세우지 않았다 (선행 추상화 금지).
③ 문 앞 자락의 자리와 크기 — 원 중심 (0, 18) 반지름 4. Design 은 "문 가까이" 까지만 말한다.
   문의 anchor 그 자리를 중심으로 골 바닥(|x| ≤ 4) 안에 들도록 잡았고, 들어온 자리에서 걸어와
   서너 걸음 안에 들고 나는 것이 몸으로 읽히는 크기다 (C019 가 결정면 자락에 쓴 그 규율).
④ 몸에 걸리는 코드의 이름 `breath-glows` — 코드의 이름은 지금까지 전부 구현이 지었다
   (`recovery-stalled` · `frost-vein-regrown` 의 선례). 사람이 읽을 말은 View 의 표가 옮긴다.
⑤ 흔적의 layer 를 하나로 못 박지 않았다. 빙결 심층의 흔적 둘은 trace layer 에 있으나 미로의 식물은
   clue layer 에 있다 — 검사 ㊶ 은 "그 방에 그 op 이 있는가" 만 묻는다. 흔적은 layer 하나에 갇히지 않는다.
⑥ 걷는 숲 문의 흔적으로 숲 안쪽의 흙 하나를 골랐다. Access §9.1 이 "하늘 · 흙 · 발자국" 셋을 적었는데
   하늘은 놓인 자리가 아니고 발자국은 그때그때 나는 것이라, 셋 중 op 인 것은 흙 하나다.
⑦ answers 의 관계 셋(SUPPORTS · OPPOSES · REVEALS)은 데이터로만 선다 — 2층은 판정하지 않는다 (K11).
⑧ RegionSpec.access.silence 를 두지 않았다 — 읽는 검사가 아직 없어 죽은 데이터가 된다 (Out of Scope).
```
