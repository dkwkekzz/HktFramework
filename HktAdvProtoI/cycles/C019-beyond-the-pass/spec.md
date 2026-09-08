# C019 — 고개 너머 다른 갈래

```text
CYCLE          C019 — 얼음 협곡 · 빙결 협곡 방 둘 + 고개 활성 + 위험 갈래 셋
SOURCE         content/roadmap/play/RoomOfAnotherKind.md (§2 완료 확인 ① · §3 · §4 자신감·낯섦·눈멂·미끄러짐 ·
               §5.1 · §6 W33 앞머리 · W34 · W35 · V17 일부 · V18 일부 · E16 · 확정 1 · 5 · 6)
               content/roadmap/M5-FrostCanyon.md (세계관 사실 표 · 열 질문 ⑤ ⑦ ⑩)
               content/roadmap/L2-World-Concept.md §3.1 위험 갈래 일곱 · §3.2 깊이 다섯 · §5 · §6
               content/roadmap/L2-World-Time.md §2.4 태그 덧씌움 · §3 데이터 계약 · 원칙 T3 · T4 · T6
               content/roadmap/L2-World-Region.md §5.1 이름 표 · §10 activation · §16
               content/roadmap/play/RegionGraphRooms.md 확정 5 (얼음 협곡은 경계였다)
SELECTED_FROM  Play §7 Cycle Breakdown 의 첫 항목 (C019)
```

## Playable Goal

관찰자가 백왕령 서쪽 고개를 넘어 **얼음 협곡**에 서고 그 안쪽 **빙결 협곡**까지 걸어 들어가,
숲과 하나도 겹치지 않는 위험 갈래 셋을 몸으로 겪는다 — **눈보라**가 낮인데도 보이는 범위를
좁히고, **절벽**이 몸을 세우고, **결정면**에 서면 세계가 결정화를 말한다. 그리고 같은 고개로
백왕령에 돌아온다.

## Experience Intent

```text
Start  숲을 다 안다. 재료도 위험도 어디서든 같은 문법으로 읽힌다. 서쪽 고개는 아직 못 가는 곳이었다.
End    고개 너머는 다른 문법이다. 흙이 아니라 서리이고, 나를 노리는 것이 아니라 세계 자체가 나를 깎는다.
       낮인데 앞이 보이지 않고, 걸어온 길이 절벽에서 끊기고, 발밑의 면이 몸에 무언가를 한다.
```

Play §4 Breath 의 **자신감 → 낯섦 → 눈멂 → 미끄러짐** 구간이다. 닿음(재료)은 C020 · 결핍과
되돌아봄은 C021 이 받는다.

## World Change

1. **방 둘이 선다** — `ICE_CANYON` 얼음 협곡(depth `outer` · 고개 너머 첫 방) ·
   `FROST_CANYON` 빙결 협곡(depth `wild` · 그 안쪽). `ICE_CANYON` 은 C002 부터 경계 이름이었고
   이제 지어진 방이 되어 경계 목록에서 빠진다 (`RED_EYE_TREE` · `FANTASY_MAZE` 의 선례).
   경계는 셋 그대로다 (`RED_WASTE` · `INVERTED_GARDEN` · `WALKING_FOREST`).
2. **고개가 열린다** — `ICE_CANYON_PASS` 가 양방향이 된다. 그리고 협곡 안쪽으로 오솔길 하나
   (`FROST_CANYON_TRAIL`)가 배열 끝에 이어 붙는다. Connector 는 열여덟이 된다.
3. **방이 늘 서 있는 위상을 밝힐 수 있다** — `RegionPhases.standing`. 철도 소란도 지나가는 것도
   아닌 넷째 자리이고, 원인이 하나 더 는 것이 아니라 **원인 없이** 걸리는 자리다. 숲의 위험은
   무언가가 걸어 왔고(철 · 소란 · 지나가는 것), 협곡의 위험은 **방 자체**다.
4. **위험 자락이 관찰 범위를 밝힐 수 있다** — `HazardOverlay.observeRange { day, night }`.
   그 자락에 선 관찰자에게 그 거리 너머의 몸과 원천이 실리지 않는다. 겹치면 가장 좁은 것이
   이긴다. 밝히지 않은 자락은 아무 일도 하지 않는다.
5. **위험 자락이 접촉 코드를 밝힐 수 있다** — `HazardOverlay.contact`. 그 자락에 선 동안 그 코드가
   안전 · 위험의 코드와 **같은 자리**에 함께 실린다. 몸의 값은 한 톨도 달라지지 않는다.
6. **협곡 둘의 데이터** — 골 바닥의 서리(표면 태그 `frost`) · 양옆 얼음 절벽(급경사 → 통행 0) ·
   눈보라 자락(`hazard/climate` + 관찰 범위) · 결정면 자락(`hazard/matter` + 접촉 `crystallizing`) ·
   절벽 자락(`hazard/terrain`). 셋은 숲의 갈래(`hazard/creature`)와 하나도 겹치지 않는다.

## Observable Result

1. 백왕령 서쪽의 고개 표식으로 걸어가 건너면 **얼음 협곡**에 선다 — "아직 갈 수 없는 곳" 이라는
   거절이 나지 않는다. 같은 고개로 백왕령에 돌아온다.
2. 협곡의 바닥 색이 숲 · 백왕령 어느 것과도 다르다(서리). 방 양옆에 급경사 띠가 벽으로 둘러선다.
3. 협곡 안쪽으로 한 번 더 건너면 **빙결 협곡**이고 방 바닥 색이 한 단계 더 차다(`wild`).
4. 빙결 협곡의 눈보라 자락에 들어서면 **낮인데도** 멀리 있던 몸이 화면에서 사라진다.
   자락 밖으로 나오면 다시 실린다.
5. 절벽 쪽으로 걸어가면 "너무 가파르다" 로 막힌다.
6. 결정면 자락에 서면 발밑을 말하는 판에 그 자리의 위험과 **닿음**이 함께 뜬다
   (`hazard/matter` · `crystallizing`). 자락 밖으로 나오면 그 줄이 사라진다.
7. 백왕령 · 숲 · 미로는 이 Cycle 전과 한 값도 다르지 않다.

## Reuse

```text
Existing (그대로 쓴다)
  Region Graph · Connector · 경계 이름 · 건너기 요청과 거절 (C001~C004)
  컴파일 — stamp ridge(C005) · 표시선 curve(C018) · SurfaceRule.nearCurve(C006) · BlockRule.minSlope(C006)
  이동이 traversable 을 읽는다 (C006 RULE-MOVE-001)
  hazard · depth 덧씌움의 형과 자리 판정 (C016 RegionPhase · HazardOverlay · areasOf · areaCoversPoint)
  걸린 것 standingConditions 와 발밑의 판 (C006 · C016 · C027 RULE-STANDING-READING-001)
  밤이 방 안을 한 번 더 자른다 (C015 OBSERVE_RANGE_NIGHT)
  깊이 다섯 · 위험 갈래 일곱의 어휘 (content/authoring/contracts.ts)

Added — World
  RegionPhases.standing              늘 걸리는 덧씌움 (형은 RegionPhase 그대로)
  HazardOverlay.observeRange         그 자락이 좁히는 관찰 범위 { day, night }
  HazardOverlay.contact              그 자락에 선 동안 실리는 접촉 코드
  hazardEffectsAt()                  선 자리의 자락들이 밝힌 범위와 접촉 코드 (region-phase.ts)
  RULE-OBSERVE-RANGE-001             투영이 때와 자락 중 좁은 쪽을 쓴다 (observer-view.ts)

Added — Data
  content/regions/ice-canyon.ts      얼음 협곡 (ICE_CANYON 이름의 새 주인)
  content/regions/frost-canyon.ts    빙결 협곡
  graph.ts                           방 둘 · Connector 하나 추가 · 고개 하나 CHANGED · 경계 하나 제거
  terrain-rules.ts                   SURFACE_FROST 태그와 그 표면 규칙 한 줄 · 서리 선의 tag

Added — View
  SURFACE_COLORS[frost]              서리 바닥의 색
  REGION_NAMES 둘                    얼음 협곡 · 빙결 협곡
  code-text 넷                       hazard/climate · hazard/terrain · hazard/matter · crystallizing

Added — Engine
  없음. Play E16 이 "없음이 목표" 라고 적은 그대로다 — 기구는 하나도 늘지 않는다.
```

## Out of Scope

```text
빙정석 계통(Seed 하나 · 원천 넷 · Trace · 회복 · Isolation/Outflow)        C020
협곡이 요구하는 것이 협곡에 없다는 문 (FROST_DEPTH · 긴 밤)                C021
Region 간 태그 덧씌움 (협곡의 추위가 백왕령 북쪽 조건을 약하게 한다)        C021
두 Region 을 나란히 놓는 world:observe --report                             C021
붉은 황야(RED_WASTE)                                                        짓지 않는다 (확정 9)
몸이 어떻게 깎이는가 · 체온 · 감지하는 포식자                                3층 · 5층
빙정석의 쓰임                                                               4층 이후 (S10)
```

## SPEC

```text
SPEC-001  고개가 열린다
  백왕령에서 ICE_CANYON_PASS 로 건너기를 요청하면 몸이 ICE_CANYON 에 선다.
  경계 ① 얼음 협곡에서 같은 고개로 요청하면 백왕령으로 돌아온다 (양방향).
  경계 ② 백왕령의 출구 차례는 한 자리도 바뀌지 않는다.

SPEC-002  방 둘이 선다
  ICE_CANYON 의 깊이는 outer 이고 FROST_CANYON 의 깊이는 wild 다. 관찰의 scene 이 그 방이다.
  경계 ① 두 방을 잇는 것은 오솔길 하나뿐이고, 빙결 협곡에서 나가는 끝은 그 하나다.
  경계 ② 경계 이름은 셋 그대로다 — ICE_CANYON 이 빠지고 아무것도 늘지 않는다.

SPEC-003  골 바닥에 서리가 깔린다
  두 방의 골 바닥은 표면 태그 frost 다.
  경계 서리 선을 가지지 않은 방(백왕령 · 숲 · 미로 …)의 표면 태그는 한 값도 달라지지 않는다.

SPEC-004  절벽이 몸을 세운다
  협곡 양옆의 벽은 급경사라 통행 격자가 0 이고, 그리로 걷기를 요청하면 too-steep 으로 거절된다.
  경계 골 바닥은 두 방 다 들어온 자리에서 나가는 자리까지 걸어서 이어진다.

SPEC-005  방이 늘 서 있는 위상을 밝힌다
  방이 standing 을 밝히면 그 덧씌움은 어느 철에도 · 소란과 무관하게 · 아무것도 지나지 않아도 걸린다.
  경계 ① 밝히지 않은 방은 이 Cycle 전과 한 값도 다르지 않다.
  경계 ② 철 · 깨어남 · 지나가는 것의 덧씌움과 **함께** 걸린다 — 어느 하나가 다른 것을 지우지 않는다.
  경계 ③ 저장되지 않는다 — 되살린 세계도 같은 답을 낸다.

SPEC-006  눈보라가 시야를 좁힌다
  관찰 범위를 밝힌 자락에 선 관찰자에게, 낮이면 20 · 밤이면 10 보다 먼 몸과 원천이 실리지 않고
  그것에 걸린 상호작용도 함께 빠진다.
  경계 ① 자락 밖은 C015 그대로다 — 낮은 방 전체 · 밤은 20.
  경계 ② 관찰자 자신의 몸은 언제나 실린다.
  경계 ③ 출구 · 방의 사실 · 걸린 것 · 자국 · 지나는 것 · 때 · HUD 는 자르지 않는다.
  경계 ④ 자락 여럿이 겹치면 **가장 좁은 것**이 이긴다.

SPEC-007  결정면이 닿음을 말한다
  접촉 코드를 밝힌 자락에 선 동안 그 코드가 걸린 것에 함께 실린다.
  경계 ① 자락 밖으로 나오면 실리지 않는다.
  경계 ② 몸의 값(체력 · 기력 · 속도 · 상태)은 한 값도 달라지지 않는다 — 2층은 표시까지다.

SPEC-008  위험 갈래 셋이 숲과 겹치지 않는다
  두 방이 밝힌 위험은 hazard/climate · hazard/terrain · hazard/matter 셋이고, 숲이 쓰는
  hazard/creature 와 하나도 겹치지 않는다. 그 자락에 선 관찰자의 걸린 것에 그 코드가 실린다.
  경계 셋 다 어휘 일곱(content/authoring/contracts.ts) 안의 값이다 — 새 갈래를 짓지 않는다.

SPEC-009  덧씌움이지 재컴파일이 아니다
  상시 위상은 컴파일 결과를 한 값도 바꾸지 않는다 — 높이 · 표면 · 통행 격자 · hash 가 그대로다.
  경계 같은 방을 두 번 컴파일하면 같은 hash 다 (C005 부터의 불변).

SPEC-010  앞의 세계는 그대로다 (회귀)
  백왕령 · 숲 가장자리 · 숲 안쪽 · 생체 광석 지대 · 미로의 관찰 결과는 이 Cycle 로 한 값도
  달라지지 않는다 — 실리는 몸의 수 · 걸린 것 · 출구 차례 · 표면 태그 · hash.
```

## State

이 Cycle 은 **세계 State 를 하나도 늘리지 않는다.** 상시 위상도 · 관찰 범위도 · 접촉 코드도 전부
같은 시각 · 같은 자리면 언제나 같은 답이 나오는 **유도된 사실**이다 (C016 의 위상 · C015 의 때와
같은 갈래). 저장되는 것은 여전히 몸 · 방의 State · 원천 · 소란 · 자국 · 지나가는 것뿐이다.

늘어나는 것은 **컨텐츠 데이터**뿐이다.

```text
RegionSpec.phases.standing            RegionPhase — 늘 걸리는 덧씌움 (없으면 아무 일도 없다)
HazardOverlay.observeRange?           { day: number; night: number } — 그 자락이 좁히는 범위
HazardOverlay.contact?                string — 그 자락에 선 동안 실리는 코드
```

이 Cycle 의 데이터 값 표.

| 자리 | 값 | 근거 |
|---|---|---|
| 눈보라 안의 관찰 범위 (낮) | 20 | 확정 6 "낮에도 관찰 범위 절반 · Time 의 밤과 같은 값" |
| 눈보라 안의 관찰 범위 (밤) | 10 | 확정 6 "긴 밤의 눈보라는 그 절반의 절반" |
| 자락 밖의 관찰 범위 | 낮 = 방 전체 · 밤 = 20 | C015 그대로 (한 값도 건드리지 않는다) |
| 얼음 협곡의 깊이 | `outer` | 확정 1 "고개 너머 첫 방" · Concept §3.2 |
| 빙결 협곡의 깊이 | `wild` | 확정 1 "그 안쪽" · Concept §3.2 |
| 위험 갈래 | `hazard/climate` · `hazard/terrain` · `hazard/matter` | Concept §3.1 · M5 세계관 사실 표 |
| 접촉 코드 | `crystallizing` | Play V18 |
| 표면 태그 | `frost` | Play §5.1 · V17 |
| 두 방을 잇는 이음 | 오솔길(`trail`) | 기본형 — 아래 목록 ⑦ |
| 땅의 모양 (벽 · 골의 폭 · 자락의 자리와 크기) | 배치 데이터 | 기본형 — 아래 목록 ① ② ③ |

## Rule

```text
R1  RULE-REGION-PHASE-001 (CHANGED)  — 늘 서 있는 위상
    IF   방이 phases.standing 을 밝혔다
    THEN 그 덧씌움이 철 · 깨어남 · 지나가는 것의 것들과 **함께** 걸린다. 차례는 맨 앞이다 —
         깊이가 겹치면 나중 것(철 → 깨어남 → 지나가는 것)이 이기고, 위험은 걸린 것이 전부 실린다.
    ELSE 밝히지 않은 방은 이 Cycle 전과 한 값도 다르지 않다.
    비고  규칙은 그 덧씌움이 무엇을 뜻하는지도 어느 방의 것인지도 이름으로 알지 못한다 —
          "늘 걸리는 자리를 밝힌 방" 만 안다 (C004 가 세운 규율 · C016 R1 의 어법 그대로).

R2  RULE-OBSERVE-RANGE-001 (ADDED)  — 자락이 시야를 좁힌다
    IF   관찰자가 선 자리를 덮은 위험 자락들 중 관찰 범위를 밝힌 것이 있다
    THEN 그 방의 몸과 원천은 지금 때(낮/밤)에 맞는 값 안의 것만 실리고, 그것에 걸린 상호작용도 함께 빠진다.
         여럿이 겹치면 **가장 좁은 값**이 이긴다. 때가 주는 범위(밤 20)와도 좁은 쪽이 이긴다.
    ELSE C015 그대로다 — 낮은 방 전체, 밤은 관찰자에게서 20.
    경계  관찰자 자신의 몸은 언제나 실린다 (C015 R2 경계 ① 그대로).
    비고  규칙은 "눈보라" 를 알지 못한다 — 자락이 밝힌 두 수를 읽을 뿐이다.

R3  RULE-STANDING-CONTACT-001 (ADDED)  — 닿아 있다는 사실
    IF   관찰자가 선 자리를 덮은 위험 자락이 접촉 코드를 밝혔다
    THEN 그 코드가 걸린 것(standingConditions)에 안전 · 위험의 코드와 함께 실린다.
    ELSE 아무것도 늘지 않는다.
    경계  몸의 값은 한 톨도 달라지지 않는다. 2층이 하는 것은 **말하는 것**까지다 (Play §5.1).
    비고  위험의 코드가 "이 자리가 무엇인가" 라면 이것은 "지금 내가 그것에 닿아 있다" 이다 —
          앞의 것은 내가 서지 않아도 참이고 뒤의 것은 내가 서야 참이다. 그래서 두 말이 함께 선다.

R4  RULE-STANDING-CONDITIONS-001 (AFFECTED)  — 대상 집합만 는다
    상시 위상이 건 위험 코드도 철 · 깨어남 · 지나가는 것의 것과 함께 실린다. 규칙은 한 줄도 바뀌지 않는다.

R5  RULE-TRANSIT-001 · RULE-CONNECTOR-ACTIVATION-001 (AFFECTED)  — 대상 집합만 는다
    경계였던 이름 하나가 지어진 방이 되었다. 규칙은 한 줄도 바뀌지 않는다 (C003 · C008 이 세운 그대로).

R6  RULE-MOVE-001 (AFFECTED)  — 대상 집합만 는다
    협곡의 벽이 급경사라 통행 격자가 0 이고, 그리로 가는 요청이 too-steep 으로 거절된다.
    C006 의 임계(45°)가 두 방에서 그대로 선다 — 규칙도 표도 한 값 바뀌지 않는다.

R7  RULE-OBSERVE-PROJECTION (AFFECTED)  — 대상 집합만 는다
    R2 가 자르는 자리는 C015 가 자르던 그 자리 하나뿐이다. 봉투에 새 자리는 나지 않는다.
```

## REUSED / ADDED / CHANGED / AFFECTED

```text
REUSED    RULE-TRANSIT-001 · RULE-CONNECTOR-ACTIVATION-001 · RULE-MOVE-001 ·
          RULE-STANDING-CONDITIONS-001 · RULE-STANDING-READING-001 · RULE-OBSERVE-PROJECTION ·
          RULE-WORLD-CLOCK-001 · 컴파일(높이 · 표면 · 통행 · hash)
ADDED     RULE-OBSERVE-RANGE-001 · RULE-STANDING-CONTACT-001 ·
          RegionPhases.standing · HazardOverlay.observeRange · HazardOverlay.contact ·
          ICE_CANYON · FROST_CANYON · FROST_CANYON_TRAIL · SURFACE_FROST
CHANGED   RULE-REGION-PHASE-001 (걸리는 위상에 상시의 것이 앞선다) ·
          ICE_CANYON_PASS 의 방향 (one-way → bidirectional) ·
          FRONTIER_REGIONS (ICE_CANYON 이 빠진다 — 이름의 주인이 방 파일로 옮겨 간다)
AFFECTED  RULE-STANDING-CONDITIONS-001 · RULE-MOVE-001 · RULE-TRANSIT-001 ·
          RULE-CONNECTOR-ACTIVATION-001 · RULE-OBSERVE-PROJECTION (전부 대상 집합만)
```

## Observable (관찰 계약)

봉투에 **새 자리는 하나도 나지 않는다.** 이미 있는 자리의 값이 달라질 뿐이다.

```text
snapshot.scene                     관찰자의 몸이 선 방 — 협곡 둘이 그 값이 될 수 있다
snapshot.entities[]                R2 가 자르는 대상 (몸 · 원천). 자락 안에서는 낮에도 잘린다
snapshot.interactions[]            잘린 것에 걸린 것은 함께 빠진다 (C015 의 어법 그대로)
snapshot.standingConditions[]      안전의 코드 · 위험의 코드 · **접촉의 코드**가 한 목록으로
snapshot.hud[region.depth]         선 자리의 깊이 — 협곡 둘에서는 방의 깊이 그대로다
snapshot.region.{id,hash}          방과 그 땅의 hash — 상시 위상은 hash 를 건드리지 않는다
region-exit 존재                   고개 · 오솔길. 목적지 이름은 여전히 싣지 않는다
```

**투영하지 않는 것** — 왜 좁아졌는지 · 지금 범위가 얼마인지 · 어느 자락이 그것을 걸었는지 ·
그 자락이 상시의 것인지 철의 것인지 · 자락의 모양과 크기 · 눈보라가 언제 그치는지(그치지 않는다) ·
결정면이 몸에 무엇을 하는지. 관찰자는 **앞이 안 보인다는 것**과 **발밑이 무엇인가**만 알고,
그것을 잇는 것이 이 Cycle 의 플레이다 (Time T8 · C016 · C018 이 세운 규율 그대로).

## UNRESOLVED

**없음** — Play 의 확정 사항 아홉과 Concept · Time · Region 이 이번에 필요한 게임 의미를 다 준다.

기본형으로 둔 것 (Human 이 감사할 자리).

```text
① 협곡 두 방의 땅 모양 — 벽의 자리 · 높이 · 골의 폭. Design 은 "얼음 절벽" 이라고만 한다.
   백왕령의 능선(C005) · 숲 가장자리의 분지(C007)와 같은 **배치 데이터**로 두고, 컴파일해
   실측한 값을 데이터 주석에 적는다.
② 눈보라 자락 · 결정면 자락 · 절벽 자락의 자리와 크기. Design 에 없다 — 같은 배치 데이터다.
   눈보라만은 "지속적"(Concept §6)이므로 방의 대부분을 덮되 **들어온 자리는 덮지 않는다**:
   그래야 "들어서면 좁아진다" 가 한 걸음으로 관찰된다.
③ 서리가 깔리는 폭. Design 에 없다 — 강가 젖음(C006 RIVER_WET_DISTANCE)의 선례로 골 바닥과
   그 비탈까지 덮고 절벽은 덮지 않는 값으로 둔다 (서리는 바닥에 앉고 벽은 맨 얼음바위다).
④ **상시 위상이라는 자리**(phases.standing). Design 은 "지속적인 눈보라" 라고만 하고, 지금 세계에는
   철 · 소란 · 지나가는 것이 걸지 않는 위험을 놓을 자리가 없었다. 형은 기존 RegionPhase 그대로이고
   원인이 느는 것이 아니라 **원인 없이** 걸리는 자리 하나를 낸 것이다. 다르게 두려면 Human 이 뒤집는다.
⑤ 접촉 코드가 **걸린 것과 같은 자리**에 실린다. Design 은 "사유 코드" 라고만 한다 — 봉투에 새 자리를
   내지 않았다 (C016 이 위험의 코드를 안전의 코드 곁에 둔 그 판단의 연장).
⑥ ICE_CANYON_PASS 를 **양방향**으로 두었다. Design 은 "고개가 열린다" 만 말하고 돌아오는 길을 따로
   적지 않았다. 고개는 넘어갔다 돌아오는 것이므로 문 둘(C008 의 MAZE_GATE_RETURN 선례)을 세우지
   않고 하나를 양방향으로 두었다. 백왕령의 출구 차례는 한 자리도 바뀌지 않는다.
⑦ 두 방을 잇는 이음의 종류 = **오솔길**(trail). Design 에 없다 — 협곡 안으로 난 좁은 길이므로
   일곱 중 그것이 가장 가깝다. 고개(pass)는 넘는 것이라 안쪽으로 드는 데 쓰지 않았다.
⑧ 두 방의 seed. 방마다 다른 값을 이어 붙였다 (C001 부터의 어법).
```
