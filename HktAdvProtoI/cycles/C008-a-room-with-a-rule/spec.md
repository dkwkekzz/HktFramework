# C008 — 규칙이 하나 있는 방

```text
CYCLE          C008-a-room-with-a-rule
SOURCE         content/roadmap/play/RuleBoundRoom.md §2 Play Goal · §4 Breath(자신감 → 당황 → 의심 → 관찰) ·
               §5.1 · §5.2 · §5.3 · §5.6 · §6 W9~W12 · W15' · V5 · V6 · 확정 사항 1·2·3·6
               (근거: content/roadmap/L2-World-Region.md §16 Region Spec(FANTASY_MAZE) · §4.3 Rule Contract ·
                §17 규칙 가독성 · content/roadmap/L2-World-Concept.md W5 · W9 ·
                content/roadmap/L2-World-Tool.md §2 "땅이 시간에 따라 바뀌는가")
SELECTED_FROM  Play Cycle Breakdown — "C008 — 규칙이 하나 있는 방"
```

**확장 Cycle** — C001~C007 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.
C007 까지 땅은 **컴파일 결과(정적)** 였다. 이 Cycle 에서 **땅의 통행이 처음으로 State 가 된다** —
다만 재컴파일이 아니라 컴파일 결과 위에 Region State 가 덧씌워지는 형태다 (Play §5.2).

## Playable Goal

관찰자가 고대 문을 지나 **환상의 미로**에 들어선다. 구역 넷이 있고 구역마다 다른 식물이 서 있으며
통로 여섯 중 넷만 열려 있다. 걸으면 **압력이 오르고**, 넘치면 열린 통로의 집합이 **바뀐다** —
왔던 길이 막히고 없던 길이 열린다. 닫힌 통로에 들어서려 하면 세계가 거절한다. 식물은 그 자리 그대로다.

## Experience Intent

```text
Start   미로는 길을 외우면 된다. 지도를 그리면 된다.
End     왔던 통로가 막혀 있다. 가만히 서 있으면 아무 일도 없는데 걸으면 바뀐다 —
        바닥의 압력이 차고 있었다. 길은 외울 수 없지만 규칙은 관찰할 수 있다.
```

Play 의 Breath 중 **자신감 → 당황 → 의심 → 관찰** 구간을 만든다.
**가설 · 시험 · 이해 · 이용 · 도달**(심장에 닿는 것)은 C009 이고, **공유된 세계**는 C010 이다.

## World Change

```text
① 환상의 미로가 지어진다 — FANTASY_MAZE 가 경계 목록에서 빠지고 Region 이 된다 (80×80 · depth deep).
   space 에 구역 area 넷(cell/A~D) · 통로 area 여섯(passage/AB · BC · CD · DA · AC · BD) ·
   식물 point 넷(clue) · anchor 둘(ANCIENT_GATE 입구 · HEART_GATE 심장 쪽)
② 나가는 문이 하나 선다 — MAZE_GATE_RETURN (미로 → 숲 안쪽). Region Spec 의 exit.default 다.
   들어가면 나올 수 있어야 한다 (검사 ⑦)
③ 세계가 Region State 를 든다 — WorldState.regions[FANTASY_MAZE] = { pattern, pressure, rearrangedAt }.
   **저장된다** — 유도되는 사실인 terrain 과 달리 이것은 세계가 기억하는 State 다 (STATE_VERSION 이 오른다)
④ 규칙이 하나 선다 — RULE_MAZE_CONNECTION. 미로 안의 몸이 움직인 거리가 압력이 되고,
   압력이 임계를 넘으면 통로 패턴이 다음으로 넘어가고 압력은 0 이 된다
⑤ 이동 규칙에 전제가 하나 는다 — 목표 자리가 **닫힌 통로 area 안**이면 거절한다 (passage-closed).
   컴파일 결과(traversable)는 바뀌지 않는다. State 가 그 위에 덧씌워진다
⑥ 미로 밖에서는 아무것도 바뀌지 않는다 — 다른 여덟 방에는 압력도 통로도 없다
```

## Observable Result

```text
① 고대 문을 건너면 미로다 — 방 이름과 깊이(심부)가 뜨고, 입구는 구역 A 안이다
② 구역 넷이 바닥에 구분되어 보이고 구역마다 **다른 식물**이 서 있다
③ 통로 여섯 중 열린 넷과 닫힌 둘의 바닥 색이 다르다
④ 닫힌 통로로 들어서려 하면 거절된다 — "길이 닫혀 있다"
⑤ 걸으면 HUD 의 압력이 오른다 (얼마나 찼는지 함께 보인다). 서 있으면 오르지 않는다
⑥ 압력이 넘치는 순간 열린 통로가 바뀐다 — 색이 바뀌고 그 순간이 화면에 뜬다("길이 바뀌었다")
⑦ 바뀐 뒤 왔던 통로가 막혀 있을 수 있다. 그러나 **식물은 그 자리 그대로다** — 어느 구역인지는 알 수 있다
⑧ 세계를 저장했다 되살려도 패턴과 압력이 그대로다
```

## Reuse

### Existing (그대로 쓴다)

```text
Region · Connector · 건너기 규칙 · 경계(frontier) 판정 · 중첩 · 투영 · 다중 관찰자 ·
engine/world-authoring 전부 (area op · point op · compile · traversable · tagsAt · observe) ·
content/regions 의 규칙 표(terrain-rules)와 컴파일 배선 · RULE-MOVE-001 의 extent·traversable 판정 ·
Request.Outcome 거절과 사유 코드 · HUD label/counter · SceneGroundZone(polygon · intensity) ·
캐릭터 billboard sprite 장치 · landmark instance(C006) · 영속(스냅샷) · SYSTEMS 배열의 순서 규약
```

### Added (이 Cycle 이 세운다)

```text
Data       content/regions/fantasy-maze.ts — Region Spec 하나 (space 의 op 열둘 + 패턴 표) ·
           graph.ts 에 MAZE_GATE_RETURN 하나 · FANTASY_MAZE 가 경계 목록에서 빠진다
World      WorldState.regions[id].state (Region State · 저장된다) · RULE_MAZE_CONNECTION 시스템 하나 ·
           이동 규칙의 통로 전제 · 미로 State 의 투영
Protocol   RegionView.state (pattern · pressure · pressureLimit · rearrangedAt) — 항목 추가만.
           STATE_VERSION 이 오른다 (저장되는 State 가 늘었다)
View       구역·통로 zone 과 열림/닫힘 색 · 식물 표식 표 · 압력 HUD · 문구 둘
Engine     없음 — Play §6 E5 가 "없음이 목표다" 라고 적었다. Rule Primitive 추출은 두 번째 Region Rule 이 올 때다
```

## Out of Scope

```text
heartAccess · 패턴 조건 activation · 심장 Region(MAZE_HEART) · 돌아가기 명령(COLLAPSE_TO_ENTRY)   C009
두 관찰자가 같은 State 를 본다는 증명 · 한쪽의 걸음이 다른 쪽의 압력이 되는 실측                  C010
RULE_SPATIAL_ECHO (ambient) · bridgeState · 뒤집힌 정원 · 공간 왜곡 결정(보상) · 미로의 포식 생물   이 Play 밖
지식으로 문을 여는 것 (entry.requirement.knowledge)                                             3층
Rule Primitive 를 engine 으로 뽑는 것                                                            두 번째 Region Rule 이 올 때
통로가 닫히면서 몸을 밀어내는 것 · 경로 탐색                                                      없음 — 이동은 요청 판정뿐이다
```

## SPEC

```text
SPEC-001  미로가 지어진다
          조건   세계가 만들어진다
          기대   FANTASY_MAZE 에 Description 이 있다 — extent 80×80 · depth deep ·
                area 가 열(cell 넷 · passage 여섯) · clue point 넷 · anchor 둘(입구 · 심장 쪽).
                그리고 경계(frontier) 목록에 더는 없다
          경계   나가는 Connector 가 하나 있다 (MAZE_GATE_RETURN) — 들어가면 나올 수 있다.
                checkGraph 의 검사 일곱이 전부 0 이다 (지어진 방이 경계 목록에 남아 있어도 오류다)

SPEC-002  고대 문으로 들어간다
          조건   숲 안쪽에서 고대 문을 건넌다
          기대   관찰 결과의 방이 FANTASY_MAZE 로 바뀌고 몸은 입구 anchor 자리에 놓인다.
                그 자리는 구역 A 안이다
          경계   C007 까지 그 문이 내던 "아직 갈 수 없는 곳이다" 는 더 이상 나오지 않는다 —
                방이 지어졌기 때문이고, 건너기 규칙은 한 글자도 바뀌지 않았다

SPEC-003  걸으면 압력이 오른다
          조건   미로 안의 몸이 거리 d 만큼 움직인다
          기대   그 방의 pressure 가 d × k 만큼 오른다 (확정 1 — k = 1)
          경계   서 있으면 오르지 않는다. 미로 **밖**의 몸이 움직여도 미로의 pressure 는 오르지 않는다

SPEC-004  넘치면 길이 바뀐다
          조건   pressure 가 임계 P 이상이 된다 (확정 1 — P = 120)
          기대   pattern 이 순환의 다음으로 넘어가고(DEFAULT → P1 → P2 → DEFAULT) pressure 는 0 이 된다.
                열린 통로의 집합이 패턴 표대로 바뀐다
          경계   한 번에 여러 번 넘지 않는다 — 한 tick 에 임계를 크게 넘겨도 패턴은 한 칸만 간다.
                패턴이 셋이므로 세 번 넘기면 처음으로 돌아온다

SPEC-005  닫힌 통로는 막는다
          조건   지금 패턴에서 닫힌 통로 area 안의 자리로 이동을 요청한다
          기대   거절되고 사유 코드가 passage-closed 다. 몸의 자리는 바뀌지 않는다
          경계   열린 통로 area 안으로는 받아들여진다. 그리고 **닫힌 통로 안에 있어도 갇히지 않는다** —
                거기서 열린 자리로 나가는 요청은 받아들여진다 (판정은 목표 자리만 본다)

SPEC-006  식물은 그 자리에 있다
          조건   패턴이 바뀐다
          기대   clue point 넷의 자리도 태그도 바뀌지 않는다. 구역 area 넷도 그대로다 —
                재배열이 바꾸는 것은 통로의 열림/닫힘뿐이다
          경계   컴파일 결과(height · surface · traversable · areas · points)는 한 값도 바뀌지 않는다.
                Region hash 도 그대로다 — 바뀐 것은 State 이지 Description 이 아니다

SPEC-007  세계가 미로의 상태를 말한다
          조건   미로 안의 관찰자가 관찰한다
          기대   관찰 결과에 그 방의 pattern · pressure · 임계값이 실린다.
                패턴이 바뀐 순간이 관찰 결과에서 읽힌다
          경계   미로 밖의 방에서는 그 자리가 비어 있다 — 없는 것을 0 으로 지어내지 않는다

SPEC-008  자율 존재의 걸음도 압력이다
          조건   미로 안에 자율 존재가 있고 그것이 움직인다 (확정 6)
          기대   관찰자가 가만히 있어도 pressure 가 오른다. Scope 는 미로 안의 **모든 몸**이다
          경계   미로 밖의 자율 존재는 미로의 압력에 아무것도 더하지 않는다

SPEC-009  미로의 상태는 저장된다
          조건   압력을 쌓고 패턴을 넘긴 뒤 세계를 저장하고 되살린다
          기대   pattern 과 pressure 가 그대로다. 되살린 세계에서 같은 통로가 열려 있고 같은 통로가 막는다
          경계   STATE_VERSION 이 C007 과 다르다 — 저장되는 State 가 늘었으므로 옛 스냅샷은 복구되지 않는다

SPEC-010  미로 밖은 그대로다
          조건   백왕령·숲 가장자리 등 다른 방에서 걷고 이동을 요청한다
          기대   압력도 통로도 없고, 이동 판정은 C006·C007 과 한 글자도 다르지 않다
          경계   다른 방의 관찰 결과에도 미로의 State 는 실리지 않는다
```

## State

```text
WorldState.regions[regionId].pattern       ADDED — 지금 열려 있는 통로 집합의 이름 (DEFAULT · P1 · P2)
WorldState.regions[regionId].pressure      ADDED — 그 방에 쌓인 압력 (0 이상 · 임계에서 0 으로 돌아간다)
WorldState.regions[regionId].rearrangedAt  ADDED — 마지막으로 패턴이 바뀐 세계 시각 (없으면 없음)
   ↑ 셋 다 **저장된다.** 컴파일 결과(terrain)와 달리 Description 에서 유도되지 않는다 —
     세계가 기억하는 State 이므로 스냅샷에 실리고 STATE_VERSION 이 오른다

Region.space.ops[]     REUSED — 미로의 op 열둘이 새로 선다 (형은 이미 있다)
RegionSpec             REUSED — depth · space. 여기에 이 방의 **패턴 표**가 데이터로 붙는다
```

이 Cycle 의 데이터 값:

```text
FANTASY_MAZE     extent 80×80 · depth deep · seed 는 데이터
구역 넷           cell/A · B · C · D — 40×40 area 넷 (Play §5.6 의 자리 그대로: A 좌상 · B 우상 · C 우하 · D 좌하)
통로 여섯         passage/AB · BC · CD · DA (인접) · AC · BD (대각선) — 구역이 맞닿는 자리의 area
식물 넷           clue/<구역마다 다른 태그> — 이름은 데이터다 (아래 UNRESOLVED 의 기본형)
anchor 둘         ANCIENT_GATE (입구 · 구역 A 안) · HEART_GATE (구역 B 안 · C009 가 쓴다)
패턴 표           DEFAULT: AB · BC · CD · DA   |   P1: AC · CB · BD · DA   |   P2: AD · DC · CA · BD
                 (확정 2 · Play §5.6 의 표 그대로. P2 의 심장 문은 C009 의 것이다)
압력 상수         P = 120 · k = 1 (확정 1 · 결정론 시뮬 상수로 헤더 고정 — 데이터가 아니다)
```

## Rule

```text
R1  RULE-MAZE-CONNECTION-001                     ADDED (Core · Region Rule)
    Scope      그 방의 State 를 가진 Region 안의 모든 몸 (관찰자 · 자율 존재 구분 없음 — 확정 6)
    Trigger    이동으로 몸의 자리가 바뀐다
    Condition  항상 — 그 방 안에 있으면
    Effect     pressure += 움직인 거리 × k.  pressure ≥ P 이면 pattern 을 순환의 다음으로,
               pressure = 0, rearrangedAt = 지금. 한 tick 에 한 칸만 넘어간다 (SPEC-004 경계)
    Feedback   관찰 결과의 pattern · pressure · rearrangedAt (문구는 View 가 정한다)
    Priority   move-progress 뒤 · 투영 앞 (SYSTEMS 배열 순서 — L1 적용 순서)
    비고       규칙은 방 이름을 알지 못한다. "State 를 가진 방" 이라는 조건만 안다 —
               미로라는 이름은 데이터에만 있다 (C004 가 세운 규율)

R2  RULE-MOVE-001                                CHANGED (전제가 하나 더 는다)
    IF   목표 자리가 그 방의 **닫힌 통로 area** 안이다 (지금 pattern 이 열지 않은 passage 태그)
    THEN 거절한다 — 사유 코드 passage-closed. 몸은 그대로다
    비고 순서는 extent → traversable(C006) → 통로(C008) 다. 앞의 둘은 한 글자도 바뀌지 않는다.
         컴파일 결과를 고치지 않는다 — State 가 그 위에 덧씌워진다 (Play §5.2)

R3  RULE-STABLE-PLANT-CLUE-001                   ADDED (Supporting — 규칙이라기보다 선언)
    THEN 재배열은 통로의 열림/닫힘만 바꾼다. clue point 도 cell area 도 컴파일 결과도 그대로다.
         이것이 관찰의 기준점이다 (Play §5.3 · Region §17 규칙 가독성)

R4  RULE-REGION-TRANSIT-001                      AFFECTED (대상 집합만 는다)
    THEN 고대 문 너머가 이제 지어진 방이다. 규칙도 사유 코드도 그대로이고,
         "아직 갈 수 없는 곳이다" 가 안 나오는 것은 데이터가 바뀌었기 때문이다 (C004 의 증명 그대로)

R5  영속                                          CHANGED (형이 는다)
    THEN 스냅샷에 Region State 가 실린다. STATE_VERSION 이 오른다 — 옛 스냅샷은 복구되지 않는다

R6  그 밖의 Rule 전부                              REUSED — 하나도 바뀌지 않는다
```

## REUSED / ADDED

```text
REUSED   Rule 전부(R6) · 기존 사유 코드 · 건너기 · 투영 · 컴파일과 규칙 표 · SceneGroundZone · sprite 장치
ADDED    미로 Region 데이터와 패턴 표 · MAZE_GATE_RETURN · Region State 셋 · RULE-MAZE-CONNECTION-001 ·
         R2 의 통로 전제 · RegionView.state · 사유 코드 둘(passage-closed · maze-rearranged) ·
         구역·통로 zone 색 · 식물 표식 표 · 압력 HUD
CHANGED  RULE-MOVE-001 (전제가 는다) · 영속(STATE_VERSION) · FANTASY_MAZE 가 경계에서 방으로
AFFECTED 건너기(고대 문 너머가 지어졌다) · checkGraph 의 수(방 열 · Connector 열넷 · 경계 둘)
```

## Observable (관찰 계약)

투영할 State — 점 경로로:

```text
region { id, hash }                    REUSED — 형도 값의 갈래도 그대로
region.state.pattern                   ADDED — 지금 열려 있는 통로 집합의 이름
region.state.pressure                  ADDED — 그 방에 쌓인 압력
region.state.pressureLimit             ADDED — 넘치는 값 (P). 얼마나 찼는지는 View 가 이 둘로 잰다
region.state.rearrangedAt              ADDED — 마지막으로 바뀐 세계 시각 (없으면 없음)
Request.Outcome.reason                 REUSED 형 — 사유 코드 하나가 는다 (passage-closed)
```

**State 를 갖지 않는 방에서는 `region.state` 가 없다** — 0 으로 지어내지 않는다 (SPEC-007 경계).

**투영하지 않는 것** — 패턴 표(어느 패턴에 어느 통로가 열리는가). 관찰자는 자기 `content/regions` 의
같은 표를 읽어 통로의 열림/닫힘을 스스로 그린다 (땅을 컴파일해 그리는 C005~C007 의 방식 그대로).
**미지감** — 세계는 "지금 패턴이 무엇인가" 만 말하고 "다음에 무엇이 오는가" 도 "어느 패턴에서 심장이
열리는가" 도 말하지 않는다. 그것을 알아내는 것이 이 Play 다.

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
식물 넷의 이름            Design 은 "안정된 식물"·"위치를 유지하는 식물과 문양" 까지만 준다.
                        이름 짓기는 Human 이 위임했다 (Region §5.5). 구역 태그와 짝이 되게 짓고
                        content/regions 의 데이터로 둔다 — 바꾸는 것은 코드가 아니다
구역·통로 area 의 자리     "구역 넷 40×40 · 통로 여섯(인접 넷 + 대각선 둘)" 까지가 Play §5.6 이 준 것이다.
                        통로 area 의 폭과 정확한 자리는 데이터다. 대각선 통로(AC · BD)가 어떻게
                        생겼는지도 마찬가지 — 구역 두 곳을 잇기만 하면 된다
MAZE_GATE_RETURN         Region Spec §16 의 exit.default 이름 그대로다. Play 의 Cycle 목록에는 없지만
                        나가는 문 없이 방을 지으면 검사 ⑦(들어가면 나올 수 있는가)이 깨진다 —
                        C001 부터의 불변이므로 여기서 함께 세운다. 목적지는 들어온 곳(숲 안쪽)이다
닫힌 통로 안에 서 있게 되는 것  판정은 목표 자리만 본다(C006 그대로). 그래서 재배열로 발밑이 닫혀도
                        열린 자리로 걸어 나갈 수 있다 — 갇히지 않는다. 밀어내는 규칙을 지어내지 않는다
한 tick 에 한 칸만        Design 은 "넘치면 재배열" 이라고만 한다. 한 번에 여러 칸을 넘기면 관찰자가
                        인과를 볼 수 없으므로(Region §17 "규칙의 효과를 관찰할 수 있는가") 한 칸으로 둔다
rearrangedAt 를 State 로 두는 것   "재배열 순간" 을 알리는 자리가 필요한데 이 세계에 사건 큐는
                        타격 결과뿐이다. 시각 하나를 State 로 두면 저장·복구와 다중 관찰자가 공짜다 —
                        View 가 "얼마 전인가" 를 재어 문구와 맥동을 정한다 (strikes.since 의 선례)
```
