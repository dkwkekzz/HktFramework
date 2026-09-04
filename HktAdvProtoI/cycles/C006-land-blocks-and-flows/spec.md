# C006 — 땅이 막고 흐른다

```text
CYCLE          C006-land-blocks-and-flows
SOURCE         content/roadmap/play/RoomBecomesLand.md §2 Play Goal · §4 Breath(막힘 · 흐름 · 그늘 · 이해) ·
               §5.1 · §5.2 · §5.3 · §6 E6·E7 · W15 · W16 · V7 · V8 · 확정 사항 1·2·3·5
               (근거: content/roadmap/L2-World-Tool.md §4 코드 대응 ·
                design/Plan-World-Authoring-Engine.md §2.2-6·§2.2-8 · §3.2 두 산출물 · §3.5 결정론 · §4 1단계 ⑤⑥ ·
                content/roadmap/L2-World-Concept.md W2 · §3.5 settlement layer)
SELECTED_FROM  Play Cycle Breakdown — "C006 — 땅이 막고 흐른다"
```

**확장 Cycle** — C001~C005 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.
C005 는 땅을 **관찰자만** 만들었다. 이 Cycle 에서 **세계가 처음 땅을 읽는다** — 그래서 규칙 표가
world 와 view 의 공유물이 되고, 그 자리를 여기서 정한다 (C005 UNRESOLVED 가 이 Cycle 로 미뤘던 것).

## Playable Goal

백왕령의 `space` 에 curve 하나와 point 둘과 area 넷을 더해 컴파일하면, 관찰자가 북쪽 능선으로
걸어 올라가다 **막히고**(세계의 대답: 너무 가파르다), 방을 가로지르는 **강에 막히며**, 다리 자리
하나로만 건넌다. 강가는 젖은 색이고, 도시 곁에 백색 거목이 서 있으며, 조건 area 안에 서면 HUD 가
**왜 여기가 안전한가**(산이 막는다 · 강이 먹인다 · 거목이 물린다)를 말한다.

## Experience Intent

```text
Start   북쪽은 솟았지만 아무것도 막지 않는다. 방은 여전히 어디로든 걸어갈 수 있는 색칠된 바닥이다.
End     못 넘는 산과 못 건너는 물이 생겼다. 건널 자리는 하나뿐이고, 거목 아래 도시가 있다.
        땅이 처음으로 몸에 닿았고, 화면이 "안전한 이유"를 말한다.
```

Play 의 Breath 중 **막힘 → 흐름 → 그늘 → 이해** 구간을 만든다. **조망**(world:observe 넷과 보고)은
C007 이다.

## World Change

```text
① 백왕령의 space 에 op 가 일곱 는다 —
   curve(feature/river · profile carve) 하나 · point(feature/bridge) 하나 · point(landmark/WHITE_GIANT_TREE) 하나 ·
   area(settlement/condition:ridge · condition:river · condition:tree) 셋 · area(settlement/city) 하나
② 세계가 자기 Region 의 Description 을 컴파일해 들고 있다 — WorldState 에 terrain 이 생긴다.
   저장되는 것은 여전히 Description 뿐이고 terrain 은 되살릴 때 다시 컴파일된다 (유도되는 사실)
③ 이동 규칙이 목표 자리의 traversable 을 읽는다 — 0 이면 거절하고 사유 태그를 사유 코드로 낸다.
   급경사(45° 이상)와 물이 0 이고, 다리 자리는 물 위여도 1 이다
④ 관찰자가 선 자리에 걸린 settlement/condition 태그가 투영된다 — 그것이 HUD 의 safe-by 사유 코드다
⑤ 그 밖의 규칙은 하나도 바뀌지 않는다 — 몸 충돌 · 채광 · 전투 · 전이 전부 그대로다
```

## Observable Result

```text
① 북쪽 능선의 급경사로 이동하면 몸이 서고 세계의 대답이 뜬다 — "너무 가파르다"
② 강이 방을 동서로 가로지른다 — 파여 있고, 강가 띠는 다른 색이다(젖음)
③ 강에 들어서려 하면 거절된다. 다리 자리에서는 건너진다 — 남북을 오가는 길이 하나뿐이다
④ 백색 거목이 도시 곁에 서 있다 — 땅에 붙은 큰 표식
⑤ 조건 area 안에 서면 HUD 가 그 조건을 말한다 — 산 · 강 · 거목 셋이 서로 다른 문구다
⑥ 도시 area 의 테두리가 보인다 — 조건 셋 가운데 사람이 사는 자리
⑦ 나머지 여덟 방은 평평하고 아무것도 막지 않는다 — 걸음이 C005 까지와 같다
⑧ 세계와 관찰자가 같은 땅을 본다 — hash 가 같고, 막히는 자리와 그려진 급경사가 같은 자리다
```

## Reuse

### Existing (그대로 쓴다)

```text
engine/world-authoring 의 buildHeightField · evaluateSurface · compileRegion · stamp op · descriptionHash ·
engine/view-kernel 의 createTerrain(view, palette) · terrainHeightSampler · renderer.setTerrain ·
SceneGroundZone(바닥 polygon) · 캐릭터 billboard sprite 장치 ·
RULE-MOVE-001 의 extent 판정(그대로 — traversable 판정을 그 뒤에 잇는다) · Request.Outcome 거절과 사유 코드 ·
HUD label · region { id, hash } 대조와 hash-mismatch 문구 · 투영 전부 · 영속 전부 ·
C005 의 stamp(ridge) 데이터와 표면 규칙 표
```

### Added (이 Cycle 이 세운다)

```text
Engine     world-authoring — curve op 의 높이 반영(carve) · curve 거리장 · traversable 격자(경사 임계 + blocker
           + 사유 태그) · areas/points 를 컴파일 산출로 내보내기 · tagsAt(x, z, layer) 조회 ·
           view-kernel/terrain — landmark point → instanced billboard
Data       content/regions/white-king-domain.ts 에 op 일곱 ·
           content/regions/terrain-rules.ts (표면 규칙 · 통행 규칙 — world 와 view 가 함께 읽는 자리)
World      WorldState 의 terrain(Region 별 컴파일 결과) · 이동 규칙의 traversable 판정 ·
           관찰자 자리의 조건 태그 투영
Protocol   거절 사유 코드 둘(급경사 · 물) · 관찰자의 조건 태그 목록 — 항목 추가만
View       terrain-presentation 에 wet 색과 landmark sprite · code-text 에 문구 넷 ·
           biome-rules 는 regions/terrain-rules 를 가리키게 된다 (규칙의 단일 출처)
```

### 규칙 표의 자리 (C005 가 미룬 결정)

```text
세계 사실(경사 임계 · 통행 임계 · 강가 젖음 폭 · 표면 태그 순서)  → content/regions/terrain-rules.ts
                       world 와 view 가 같은 파일을 읽는다. 경계 규칙 4 그대로 — regions 는 데이터다
표현(태그 → 색 · 태그 → sprite · 코드 → 문구)                   → content/view (그대로)
```

## Out of Scope

```text
world:observe 넷 · 보고(검사 ①~⑨) · world:shot · world:compile · 컴파일 산출 굽기      C007
숲 가장자리에 basin 을 데이터로 더해 코드 diff 0 실측                                   C007
scatter(규칙이 놓는 장식) · random(seed) · instance 여럿                                C007
경로 탐색 · 통행 불가를 피해 가는 이동 · 밀려남                                          없음(이 Play 밖)
조건이 실제로 포식자를 막는 것(조건은 표시다) · 높이가 속도·체력에 하는 일               3층 이후
```

## SPEC

```text
SPEC-001  백왕령에 강과 거목과 조건이 놓인다
          조건   세계가 만들어진다
          기대   WHITE_KING_DOMAIN 의 space.ops 에 kind = curve 인 op 가 하나(layer feature · tag river ·
                profile carve · 동서로 가로지름) · kind = point 가 둘(feature/bridge · landmark/WHITE_GIANT_TREE) ·
                kind = area 가 넷(settlement/condition:ridge · condition:river · condition:tree · settlement/city) 있다.
                C005 의 stamp(ridge) 는 그대로 남는다
          경계   나머지 여덟 방의 ops 에는 curve 도 settlement area 도 없다. anchor point 는 아홉 방 모두 그대로다

SPEC-002  급경사는 몸을 막는다
          조건   관찰자가 능선의 급경사 자리(경사 45° 이상)로 이동을 요청한다
          기대   거절된다. 몸의 자리가 바뀌지 않고, 급경사 사유 코드가 나온다
          경계   같은 능선의 비탈(45° 미만)로는 이동이 받아들여진다 — 오를 수 있는 곳과 막힌 곳이 갈린다

SPEC-003  물은 막고 다리는 건네준다
          조건   관찰자가 강 폭 안의 자리로 이동을 요청한다
          기대   거절된다. 물 사유 코드가 나오고 급경사 사유 코드와 다르다
          경계   다리 point 자리에서는 같은 강을 건너는 이동이 받아들여진다 —
                강의 남과 북을 잇는 자리가 그 하나다

SPEC-004  강가는 젖는다
          조건   백왕령의 컴파일 결과를 본다
          기대   surfaceTags 에 젖음이 있고, 강 중심에서 정해진 거리 안의 격자에 그것이 붙는다.
                거기서 먼 평지에는 붙지 않는다
          경계   강이 없는 방에는 젖음이 하나도 없다 — 표면은 규칙 표가 아니라 데이터가 만든다

SPEC-005  강은 땅을 판다
          조건   curve 를 더하기 전과 후의 같은 자리(강 중심선 위)의 높이를 잰다
          기대   후가 낮다. 강 폭 밖의 자리는 두 경우가 같다 — carve 는 자기 폭 안에서만 작용한다
          경계   curve 의 값 하나(폭 · 깊이 · 점 하나)가 달라지면 region hash 가 달라진다

SPEC-006  세계와 관찰자가 같은 땅을 읽는다
          조건   세계가 백왕령을 컴파일하고, 관찰자도 같은 Description 을 컴파일한다
          기대   둘의 region hash 가 같다. 세계가 막는 자리(traversable = 0)와 관찰자가 급경사·물로
                그리는 자리가 같은 격자 칸이다
          경계   같은 Description 을 두 번 컴파일하면 traversable 격자의 모든 값이 같다 (결정론)

SPEC-007  조건 area 가 왜 안전한지를 말한다
          조건   관찰자가 조건 area 셋 각각의 안에 선다
          기대   그 자리의 조건 태그가 투영되고 HUD 에 사유가 뜬다. 셋이 서로 다른 코드다
                (산이 막는다 · 강이 먹인다 · 거목이 물린다)
          경계   조건 area 밖(같은 방의 다른 자리)에 서면 아무 사유도 뜨지 않는다.
                area 가 겹치는 자리에 서면 걸린 것이 전부 뜬다 — 하나로 줄이지 않는다

SPEC-008  거목이 땅에 선다
          조건   백왕령의 컴파일 결과로 땅을 그린다
          기대   landmark point 가 그리는 쪽 instance 하나로 나오고, 그 자리의 높이가 격자의 높이와 같다
          경계   landmark 가 없는 방에는 instance 가 없다 — 없는 것을 지어내지 않는다

SPEC-009  데이터가 없는 방은 아무것도 막지 않는다
          조건   op 가 stamp 도 curve 도 없는 여덟 방에서 이동을 요청한다
          기대   traversable 이 전부 1 이고 이동은 C005 까지와 같이 extent 만으로 판정된다
          경계   Description 을 모르는 region id 면 땅이 없고, 이동은 extent 판정만으로 돈다 —
                땅이 없다고 게임이 멈추지 않는다

SPEC-010  땅은 여전히 저장되지 않는다
          조건   세계를 저장하고 되살린다
          기대   스냅샷에 height · surface · traversable 이 없다. 되살린 세계가 같은 Description 에서
                terrain 을 다시 만들고, 되살린 뒤에도 급경사와 물이 똑같이 막는다
          경계   백왕령의 hash 는 op 가 늘었으므로 C005 와 다른 값이다 — 형이 아니라 데이터가 바뀐 것이다
```

## State

```text
Region.space.ops[]                REUSED — 값이 일곱 는다 (curve 하나 · point 둘 · area 넷). 형은 ENGINE 이 세운다
Region.hash                       REUSED — descriptionHash 그대로. ops 가 늘어 값이 바뀐다

WorldState.terrain[regionId]      ADDED — 그 방의 컴파일 결과 (height · surface · traversable · areas · points).
                                  저장되지 않는다 — 세계가 설 때와 되살릴 때 Description 에서 다시 만든다
  .traversable[cell]              0 = 막힘 · 1 = 통행. 0 인 칸은 사유 태그를 함께 갖는다 (급경사 · 물)
  .areas[]                        { layer, tag, shape } — 자리로 태그를 묻는 조회의 원본
  .points[]                       { layer, tag, position } — 다리와 거목의 자리

Observer.standingConditions[]     ADDED(투영) — 몸이 선 자리에 걸린 settlement/condition 태그 목록.
                                  세계 State 가 아니라 매 관찰마다 terrain.areas 에서 유도된다
```

이 Cycle 의 데이터 값:

```text
WHITE_KING_DOMAIN   curve(feature/river · carve) — 동서로 가로지르는 점 목록 · 폭 · 깊이는 데이터
                    point(feature/bridge) — 강 위 한 자리 (확정 3 "건너는 자리는 하나")
                    point(landmark/WHITE_GIANT_TREE) — 도시 곁 (확정 2)
                    area(settlement/condition:ridge) 산맥 기슭 · (condition:river) 강가 ·
                    (condition:tree) 거목 둘레 · (settlement/city) 그 가운데 (Play §5.3)
통행 임계            45° (확정 1 · 결정론 시뮬 상수로 고정 — 데이터가 아니다)
표면                평지 · 비탈 · 급경사 (C005) + 젖음 (확정 5 의 넷이 다 선다)
해상도               TERRAIN_RESOLUTION = 1 (확정 4 · C005 가 고정한 그대로)
```

## Rule

```text
R1  RULE-MOVE-001                                CHANGED (전제가 는다)
    IF  이동 요청의 목표 자리가 extent 안이고, 그 방의 terrain 이 있고,
        목표 자리의 traversable = 0 이다
    THEN 거절한다. 몸은 그대로이고, 그 칸의 사유 태그가 사유 코드가 된다
    비고 extent 판정은 그대로 먼저 온다 (C005 까지의 out-of-bounds 는 한 글자도 안 바뀐다).
         terrain 이 없는 방은 C005 까지와 똑같이 extent 만으로 판정된다 (SPEC-009)

R2  RULE-TERRAIN-COMPILE-001                     ADDED
    IF  세계가 서거나 되살아난다
    THEN 아홉 방 각각의 Description 을 규칙 표로 컴파일해 terrain 으로 든다.
         컴파일은 순수하므로 같은 Description 은 같은 격자를 준다 (SPEC-006 경계)

R3  RULE-TRAVERSABLE-001                         ADDED (컴파일 안의 규칙 — engine 이 기구, 임계는 규칙 표)
    IF  격자 칸의 경사가 통행 임계 이상이거나, 막는 curve(물) 폭 안이다
    THEN 그 칸은 traversable = 0 이고 사유 태그를 갖는다
    IF  그 칸이 통과 point(다리)의 자리다
    THEN 앞의 것을 덮고 1 이다 — 놓은 것이 규칙을 이긴다 (SPEC-003 경계)

R4  RULE-SAFEBY-001                              ADDED
    IF  관찰자의 몸이 settlement/condition area 안에 있다
    THEN 그 태그들이 관찰 결과에 실린다 (겹치면 전부)

R5  관찰 투영 · 영속 · 몸 충돌 · 채광 · 전투 · 전이   REUSED
    THEN 하나도 바뀌지 않는다. 땅이 몸에 닿는 자리는 R1 하나뿐이다 (확정 1)

R6  C005 의 R1~R4                                 AFFECTED
    THEN 대상 집합만 는다 — 표면 태그가 넷이 되고 백왕령의 hash 값이 다시 바뀐다
```

## REUSED / ADDED

```text
REUSED   Rule 전부(R5) · 기존 사유 코드 · STATE_VERSION · descriptionHash · region { id, hash } 대조 ·
         C005 의 stamp 데이터와 표면 규칙 · SceneGroundZone · billboard sprite 장치
ADDED    curve/traversable/tagsAt/instance 기구 (engine) · op 일곱 (데이터) ·
         terrain-rules.ts (world·view 공유 규칙 표) · WorldState.terrain · R1 의 traversable 전제 ·
         R4 의 조건 태그 투영 · 사유 코드 둘 · 젖음 색 · landmark sprite · 문구 넷
CHANGED  RULE-MOVE-001 (전제에 traversable 이 는다) ·
         규칙 표의 자리 — content/view → content/regions (world 도 읽어야 하므로. 값은 그대로)
AFFECTED C005 의 표면 규칙(젖음이 는다) · 백왕령 hash · 관찰자가 보는 바닥과 그 위의 표식
```

## Observable (관찰 계약)

투영할 State — 점 경로로:

```text
region { id, hash }                    REUSED — 형도 값의 갈래도 그대로
Request.Outcome.reason                 REUSED 형 — 사유 코드 둘이 는다 (급경사 · 물). 코드 목록은 view 가 문구로 옮긴다
Observer.standingConditions[]          ADDED — 몸이 선 자리의 settlement/condition 태그 목록 (없으면 빈 목록)
```

**투영하지 않는 것** — height · surface · traversable 격자 · areas · points 의 본체.
관찰자는 자기 `content/regions` 의 같은 Description 을 같은 규칙 표로 컴파일해 그것을 스스로 만든다
(C005 의 방식 그대로). 세계가 보낸 hash 와 다르면 이미 있는 문구가 그 사실을 말한다.
30Hz 관찰 결과에 격자를 싣는 것은 이 계약의 것이 아니다 (Plan §3.5).

**미지감** — 다리가 어디 있는지도, 어디가 막히는지도 봉투가 알려주지 않는다.
걸어 보아야 안다 — 화면의 색과 세계의 대답이 유일한 안내다.

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
강의 점 목록 · 폭 · 깊이       확정 2 가 "강은 동서로 가로지른다" 까지 주었다. 나머지는 데이터다
                             (C001~C003 의 anchor 좌표 · C005 의 stamp 값 선례). 방을 남북으로
                             가르되 다리 하나로 이어지게 둔다 — 그래야 확정 3 이 관찰된다
다리 자리와 통과 폭            "건너는 자리는 하나"(확정 3)만 확정이다. 어디이고 얼마나 넓은지는 데이터
강가 젖음의 폭                 규칙 표의 값. 확정 5 가 젖음을 넷 중 하나로 세웠을 뿐 폭은 어디에도 없다
조건 area 셋의 모양과 크기     Play §5.3 이 "산맥 기슭 · 강가 · 거목 둘레" 라고 자리만 주었다
condition 태그의 이름          Concept §3.5 는 `settlement/condition` 까지 주고, Play §5.3 은
                             safe-by 를 ridge · river · tree 셋으로 갈랐다. 그 둘을 잇기 위해
                             `condition:ridge` 식으로 적었다 — 접두사가 Concept 의 `condition` 이다
                             (C007 의 검사 ③ 이 이 접두사를 읽는다)
사유 코드의 문구               코드는 세계의 것이고 문구는 view 의 것이다 (C001 부터의 규약).
                             "너무 가파르다" 는 Play §4 가 준 말이고, 물과 safe-by 셋은 그 어법을 따랐다
겹친 조건을 줄이지 않는 것      Play 가 셋을 함께 말하므로(§4 이해 "산맥이 막고 · 강이 먹이고 · 거목이 물린다")
                             걸린 것을 전부 낸다. 우선순위를 지어내지 않는다
규칙 표를 regions 로 옮기는 것  C005 가 이 Cycle 로 미룬 결정이다. 세계가 통행 임계를 읽어야 하는 순간
                             표는 world·view 공유물이 된다 — 그 자리는 경계 규칙 4 가 이미 정해 둔
                             content/regions 다. 값은 한 글자도 바꾸지 않고 자리만 옮긴다
```
