# C002 — 출구는 여럿, 목적지는 모른다

```text
CYCLE          C002-many-exits
SOURCE         content/roadmap/play/RegionGraphRooms.md §5.1 · §5.3 · §5.4 · §5.8 · §6 W4~W7, V1~V3, E1 · 확정 사항 1·2·4·5
               (근거: content/roadmap/L2-World-Region.md §5 이름 표 · §10 Connector · L2-World-Concept.md §3.2 depth)
SELECTED_FROM  Play Cycle Breakdown — "C002 — 출구는 여럿, 목적지는 모른다"
```

**확장 Cycle** — `cycles/C001-region-graph-rooms/spec.md` 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.
여기 없는 것은 C001 그대로다.

## Playable Goal

관찰자의 몸이 백왕령에서 출구 셋을 보고(길 하나 · 고개 둘), 고개 쪽으로 건너기를 요청하면 **아직 없는 곳**이라는
대답을 받는다. 길로 나가 숲 가장자리 → 숲 안쪽까지 걸으면 출구가 다섯인 방에 서고, 그 중 하나(고대 문)는
**닫혀 있어 거절**하며, 나머지로 막다른 POI 방 셋을 드나든다 — 목적지의 이름은 어디에도 나오지 않고,
출구는 **종류**(길 · 오솔길 · 문 · 고개 · 들어감)만 표식으로 구분된다.

## Experience Intent

```text
Start   길은 하나뿐인 줄 알았다. 나가는 곳이 셋인데 어디로 가는지는 모른다.
End     세계에는 갈 수 있는 곳, 아직 없는 곳, 잠긴 곳이 있다. 이름은 없고 종류만 있다.
        나는 그 중 몇 개만 열어 보았고 남은 것이 더 많다.
```

Play 의 Breath 중 **낯섦 → 불안** 구간과, 첫 방의 **새로운 미지**를 만든다.

## World Change

```text
① 방이 둘에서 여섯이 된다 — FOREST_DEEP · EXPLORER_RUIN · PREDATOR_NEST · BIO_ORE_FIELD.
   depth 태그에 wild 가 처음 나온다 (civil · outer · wild 세 단계)
② Connector 가 하나에서 열이 된다 — 종류 다섯(road · trail · door · pass · interaction) ·
   방향 둘(bidirectional · one-way) · 활성 둘(열림 · 닫힘)
③ 그래프가 **아직 짓지 않은 곳(frontier)** 을 가리킬 수 있게 된다 — RED_WASTE · ICE_CANYON ·
   FANTASY_MAZE · RED_EYE_TREE. Connector 는 있고 방은 없다. 세계는 이것을 오류가 아니라 **경계**로 안다
④ 새 거절 둘 — connector-inactive(닫힌 문) · region-not-built(아직 없는 곳).
   거절은 세계 State 를 바꾸지 않는다 (RULE-REQUEST-REPLY-001 재사용)
⑤ Connector 의 활성 상태가 컨텐츠 데이터에서 온다 — 닫힌 것의 목록. 여는 규칙은 이 Cycle 에 없다 (Play W7)
⑥ 출구 표식이 열림/닫힘을 구분한다 — region-exit 존재의 state 가 open | locked 로 갈린다
⑦ 검사가 늘어난다 — frontier 를 아는 정합 검사 + 시작 방에서 모든 방에 닿는가 (검사 ⑧)
```

방 하나(붉은 눈의 거목)는 짓지 않는다. C002 는 그 자리에 **frontier 를 가리키는 Connector** 만 둔다 —
C003 이 RegionSpec 하나를 더하고 경계 목록에서 이름 하나를 빼면 그 문이 열린다. Connector 는 손대지 않는다.

## Observable Result

```text
① 백왕령에 출구 표식이 셋 보인다 — 길 하나(기존) · 고개 둘. 종류마다 표식 색이 다르고 목적지 이름은 없다
② 고개에 붙어 건너기를 요청하면 거절이 화면에 뜬다 — "아직 갈 수 없는 곳이다" (region-not-built)
③ 숲 가장자리의 출구가 셋으로 는다 — 돌아가는 길 · 숲 안쪽 · 탐험대 폐허
④ 숲 안쪽의 바닥 색이 또 바뀌고(wild) HUD 깊이가 "야생" 을 읽는다
⑤ 숲 안쪽에 출구 표식이 다섯 보인다 — 그 중 하나는 **닫힌 표식**이다
⑥ 닫힌 문에 붙어 요청하면 거절이 화면에 뜬다 — "잠겨 있다" (connector-inactive). 몸은 그 자리 그대로다
⑦ 막다른 방 셋에 들어갔다 나온다 — 각 방에는 돌아가는 출구가 하나(광석 지대만 둘)뿐이고 방은 비어 있다
⑧ 여섯 방을 지나는 동안 scene 이 여섯 번 바뀌고, 다른 방의 몸·광맥은 한 번도 보이지 않는다
```

## Reuse

### Existing (그대로 쓴다)

```text
RULE-REGION-TRANSIT-001 의 뼈대(anchor 근접 · 행동 대체 가능 · 반대쪽 anchor 로 이동) · RULE-MOVE-001 의 extent 경계 ·
Region 별 투영 · region-exit 존재와 transit interaction · Request.Outcome 사유 코드 경로 · hud region.depth ·
방 바닥 polygon 과 depth 색 표 · 출구 표식 sprite · 세계 영속 · 다중 관찰자 ·
engine/world-authoring 의 Description · Graph · 검사
```

### Added (이 Cycle 이 세운다)

```text
Data       content/regions/{forest-deep,explorer-ruin,predator-nest,bio-ore-field}.ts ·
           graph.ts 에 Connector 아홉 · FRONTIER_REGIONS · CLOSED_CONNECTORS ·
           forest-edge/white-king-domain 에 anchor 추가
World      RULE-REGION-TRANSIT-001 에 거절 둘 (connector-inactive · region-not-built) ·
           투영의 region-exit state(open | locked)
Protocol   없음 — 봉투의 형은 바뀌지 않는다 (값의 가짓수만 는다)
View       depth wild 색 · 방 이름 넷 · transition 색 넷(trail · door · pass · interaction) ·
           닫힌 출구 표식 · 문구 셋(야생 · 잠겨 있다 · 아직 갈 수 없는 곳이다)
Engine     RegionGraph.frontiers · isFrontier · reachableRegions ·
           checkGraph 의 검사 셋 (frontier-built · unused-frontier · unreachable)
```

## Out of Scope

```text
붉은 눈의 거목 방 · 거목 내부 세계 · 심장 호수 · 중첩 · 일방향 추락 · 물길        C003
데이터만으로 방을 더하는 것의 실측 · world:observe --graph 보고                 C004
문을 여는 규칙 · 무엇이 잠금을 푸는가 · 발견 상태(누가 무엇을 아는가)             RuleBoundRoom (C005~) · 3층
붉은 황야 · 얼음 협곡 · 환상의 미로의 방 자체                                    이 Play 밖 (확정 사항 5) · RuleBoundRoom
POI 방 안의 내용물(둥지의 짐승 · 폐허의 물건 · 광석)                             4층 이후 — 방은 이름만 있고 비어 있다
카메라를 방 extent 에 맞추는 것                                                 C003 (80×80 방이 나올 때)
높이 · 표면 · 경사 · scatter                                                    RoomBecomesLand (C008~C010)
```

## SPEC

```text
SPEC-001  방이 여섯이다
          조건   세계가 만들어진다
          기대   Region 이 여섯이다 — WHITE_KING_DOMAIN(civil) · FOREST_EDGE(outer) ·
                FOREST_DEEP(wild) · EXPLORER_RUIN(wild) · PREDATOR_NEST(wild) · BIO_ORE_FIELD(wild).
                새 방 넷은 전부 extent 40×40 (−20..20) 이고 자기 Local Space 를 가진다 (확정 4)
          경계   새 방 넷에는 anchor 말고 아무 것도 없다 — 몸도 광맥도 놓이지 않는다

SPEC-002  anchor 가 방마다 여럿이다
          조건   세계가 만들어진다
          기대   각 Region 의 Description 에 아래 anchor point 가 있다 (layer = anchor).
                한 Region 안에서 tag 는 유일하다
                  WHITE_KING_DOMAIN  FOREST_PATH(0, 18) · RED_WASTE_PASS(18, 0) · ICE_CANYON_PASS(−18, 0)
                  FOREST_EDGE        FOREST_PATH(0, −18) · DEEP_TRAIL(0, 18) · RUIN_TRAIL(−18, 0)
                  FOREST_DEEP        DEEP_TRAIL(0, −18) · NEST_TRAIL(−18, 0) · ORE_TRAIL(18, 0) ·
                                     TREE_APPROACH(0, 18) · ANCIENT_GATE(−13, 13)
                  EXPLORER_RUIN      RUIN_TRAIL(18, 0)
                  PREDATOR_NEST      NEST_TRAIL(18, 0)
                  BIO_ORE_FIELD      ORE_TRAIL(−18, 0) · TREE_TRAIL(0, 18)
          경계   방 사이의 좌표는 서로 무관하다 — 같은 tag 가 두 방에서 다른 자리다

SPEC-003  Connector 가 열이다
          조건   세계가 만들어진다
          기대   Graph 의 Connector 는 아래 열이고 이 순서다 (exitsOf 의 결정론이 이 순서를 따른다)
                  id               from                              to                              direction      transition
                  FOREST_PATH      WHITE_KING_DOMAIN.FOREST_PATH     FOREST_EDGE.FOREST_PATH          bidirectional  road
                  RUIN_TRAIL       FOREST_EDGE.RUIN_TRAIL            EXPLORER_RUIN.RUIN_TRAIL         bidirectional  trail
                  DEEP_TRAIL       FOREST_EDGE.DEEP_TRAIL            FOREST_DEEP.DEEP_TRAIL           bidirectional  trail
                  NEST_TRAIL       FOREST_DEEP.NEST_TRAIL            PREDATOR_NEST.NEST_TRAIL         bidirectional  trail
                  ORE_TRAIL        FOREST_DEEP.ORE_TRAIL             BIO_ORE_FIELD.ORE_TRAIL          bidirectional  trail
                  TREE_APPROACH    FOREST_DEEP.TREE_APPROACH         RED_EYE_TREE.FOREST_DEEP_SIDE    bidirectional  interaction
                  ORE_TREE_TRAIL   BIO_ORE_FIELD.TREE_TRAIL          RED_EYE_TREE.ORE_SIDE            bidirectional  trail
                  ANCIENT_GATE     FOREST_DEEP.ANCIENT_GATE          FANTASY_MAZE.ANCIENT_GATE        one-way        door
                  RED_WASTE_PASS   WHITE_KING_DOMAIN.RED_WASTE_PASS  RED_WASTE.WHITE_KING_SIDE        one-way        pass
                  ICE_CANYON_PASS  WHITE_KING_DOMAIN.ICE_CANYON_PASS ICE_CANYON.WHITE_KING_SIDE       one-way        pass
                그러므로 방마다 나갈 곳의 수는 백왕령 3 · 숲 가장자리 3 · 숲 안쪽 5 ·
                탐험대 폐허 1 · 포식수 둥지 1 · 생체 광석 지대 2 다 (§5.8 그대로)
          경계   짓지 않은 방에서 나가는 끝은 아무에게도 실리지 않는다 — 그 방에는 몸이 설 수 없다

SPEC-004  아직 짓지 않은 곳을 가리킬 수 있다
          조건   Connector 의 반대쪽 region 에 Description 이 없다
          기대   그 region 은 Graph 가 **경계(frontier)** 로 밝힌 이름이어야 한다 —
                RED_EYE_TREE · FANTASY_MAZE · RED_WASTE · ICE_CANYON 넷.
                밝혀진 경계는 정합 오류가 아니다. 경계 쪽 끝의 anchor 는 있는지 보지 않는다
          경계   경계로 밝히지 않은 이름을 가리키면 정합 오류다 (SPEC-009)

SPEC-005  닫힌 Connector 가 있다
          조건   세계가 만들어진다
          기대   ANCIENT_GATE 하나가 닫혀 있다. 닫힘은 컨텐츠 데이터의 목록에서 오고 세계 State 에
                들어가지 않는다 — 이 Cycle 에는 여는 규칙도 닫는 규칙도 없다 (Play W7)
          경계   나머지 아홉은 열려 있다

SPEC-006  건너기의 거절이 여섯이 된다
          조건   관찰자의 몸이 Connector C 로 건너기를 요청한다
          기대   아래 순서로 첫 번째로 걸리는 사유 하나가 대답이다. 이 순서는 관찰 결과의
                interactions[transit].reason 과 요청의 대답(Request.Outcome)에 똑같이 쓰인다
                  1 unknown-connector   C 가 Graph 에 없다                                (C001)
                  2 wrong-region        C 의 어느 끝도 몸의 Region 에 없다                  (C001)
                  3 out-of-range        이쪽 끝 anchor 와의 거리 > INTERACTION_RANGE       (C001)
                  4 connector-inactive  C 가 닫혀 있다                                     ADDED
                  5 region-not-built    건너간 뒤의 region 에 Description 이 없다            ADDED
                  6 action-busy         현재 행동이 대체 불가 (RULE-ACTION-BEGIN-001)       (C001)
          경계   거절은 세계 State 를 하나도 바꾸지 않는다 — 몸의 regionId · position · velocity ·
                currentAction 이 요청 전과 같다

SPEC-007  출구 표식이 열림과 닫힘으로 갈린다
          조건   관찰 결과가 만들어진다
          기대   region-exit 존재의 state 가 닫힌 Connector 면 locked · 아니면 open 이다.
                kind 는 Connector 의 transition 그대로 — road | trail | door | pass | interaction
          경계   경계(frontier)를 가리키는 출구도 state 는 open 이다. "아직 없는 곳" 은 표식이 아니라
                **요청의 대답**으로만 드러난다 — 목적지는 물어봐야 안다 (Play §5.1)

SPEC-008  다섯 출구의 방
          조건   관찰자의 몸이 FOREST_DEEP 에 있다
          기대   entities 에 role = region-exit 인 존재가 다섯이고, 그 중 ANCIENT_GATE 하나만
                state = locked · kind = door 다. interactions 에 transit 이 다섯 실린다.
                목적지 Region 의 id 와 이름은 어디에도 실리지 않는다
          경계   EXPLORER_RUIN · PREDATOR_NEST 에서는 region-exit 이 하나뿐이고 entities 에
                관찰자 자신 말고 아무 것도 없다

SPEC-009  Graph 정합 검사가 경계와 닿음을 안다
          조건   Description 들과 Graph 로 검사를 돌린다
          기대   ① 경계로 밝힌 region 을 가리키는 끝은 unknown-region 도 missing-anchor 도 아니다
                ② 경계로 밝혔는데 Description 이 있으면 오류다 (frontier-built)
                ③ 경계로 밝혔는데 아무 Connector 도 가리키지 않으면 오류다 (unused-frontier)
                ④ 시작 방(WHITE_KING_DOMAIN)에서 Connector 를 따라 닿지 않는 방이 있으면 오류다
                   (unreachable — 검사 ⑧). 닿음은 지어진 방들 사이에서만 센다
                이 Cycle 의 데이터로 검사를 돌리면 오류가 하나도 없다
          경계   검사는 세계를 바꾸지 않는 읽기 전용이다

SPEC-010  영속과 이전 세계
          조건   세계를 스냅샷으로 저장하고 되살린다
          기대   STATE_VERSION 은 올라가지 않는다 — 스냅샷에 실리는 형이 하나도 바뀌지 않았다.
                방과 Graph 는 저장되지 않고 컨텐츠 데이터에서 다시 온다.
                C001 에서 저장된 스냅샷도 그대로 되살아난다
          경계   되살린 몸의 regionId 가 여섯 방 중 하나가 아니면 데이터 오류다 (C001 의 throw 그대로)
```

## State

```text
World.regions[]                       REUSED — 값만 는다 (넷 추가)
  Region.depth                        REUSED — 값에 wild 가 더해진다 (civil | outer | wild)

World.graph.frontiers[]               ADDED — Connector 가 가리키되 아직 짓지 않은 region 의 이름들.
                                      "세계의 끝" 이 아니라 "아직 만들지 않은 곳" 이라는 세계의 선언이다.
                                      정적 컨텐츠 데이터 — 저장되지 않는다
World.graph.connectors[]              REUSED — 값만 는다 (아홉 추가)
  Connector.transition                REUSED — 값에 trail · door · pass · interaction 이 더해진다
  Connector.direction                 REUSED — 값에 one-way 가 처음 쓰인다

World.closedConnectors[]              ADDED — 닫힌 Connector 의 id 들. 정적 컨텐츠 데이터다 —
                                      World State 에 넣지 않고 저장하지도 않는다 (Play W7)

Connector.isBuilt                     유도 — 반대쪽 끝의 region 이 World.regions 에 있는가
Connector.isOpen                      유도 — id 가 World.closedConnectors 에 없는가
```

이 Cycle 의 데이터 값 — SPEC-002 (anchor) · SPEC-003 (Connector) 의 표가 원본이다.

```text
FOREST_DEEP      depth wild   extent −20..20 × −20..20   anchor 다섯
EXPLORER_RUIN    depth wild   extent −20..20 × −20..20   anchor 하나
PREDATOR_NEST    depth wild   extent −20..20 × −20..20   anchor 하나
BIO_ORE_FIELD    depth wild   extent −20..20 × −20..20   anchor 둘
frontiers        RED_EYE_TREE · FANTASY_MAZE · RED_WASTE · ICE_CANYON
closed           ANCIENT_GATE
```

## Rule

```text
R1  RULE-REGION-TRANSIT-001                                                  CHANGED (거절 둘 추가 · 순서 확정)
    IF   (C001 R1 의 전제 그대로) 이고
         Connector C 가 열려 있고 (C.id ∉ World.closedConnectors) 이고
         건너간 뒤의 region 이 지어져 있다 (∈ World.regions)
    THEN (C001 R1 의 전이 그대로 — regionId · position · velocity · currentAction)
    ELSE 거절 — SPEC-006 의 순서로 첫 번째 사유 하나.
         거절은 세계 State 를 바꾸지 않는다 (RULE-REQUEST-REPLY-001 재사용)

R2  관찰 투영 (projectObserver) 의 region-exit 부분                            CHANGED
    THEN region-exit 존재의 state = C.isOpen ? open : locked
         (kind = Connector.transition · position = 이쪽 anchor · id = Connector.id — C001 그대로)
    투영하지 않는 것 — Connector.isBuilt · frontiers 목록 · 반대쪽 region 의 이름

R3  세계의 초기 배치                                                          REUSED (변화 없음)
    THEN 관찰자의 새 몸 · 기본 자율 존재 둘 · 광맥 하나는 그대로 WHITE_KING_DOMAIN 에 놓인다.
         새 방 넷은 비어 있다

R4  Graph 정합 검사                                                           CHANGED (경계를 알고, 닿음을 본다)
    IF   Connector 의 한 끝이 가리키는 region 에 Description 이 없다
    THEN 그 이름이 World.graph.frontiers 에 있으면 정상 · 없으면 unknown-region
    IF   frontiers 의 이름에 Description 이 있다                THEN frontier-built
    IF   frontiers 의 이름을 아무 Connector 도 가리키지 않는다     THEN unused-frontier
    IF   시작 방에서 Connector 를 따라 닿지 않는 지어진 방이 있다  THEN unreachable        (검사 ⑧)

R5  RULE-MOVE-001 · RULE-BODY-PUSH-001 · RULE-BODY-MOMENTUM-001 ·
    RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001                              AFFECTED (대상 집합만 — 자동)
    THEN 방이 여섯이 되어도 판정은 그대로다. 같은 regionId 안에서만 서로를 본다

R6  영속                                                                     REUSED (변화 없음)
    THEN STATE_VERSION 그대로. 방·Graph·frontiers·closed 는 스냅샷에 없고 컨텐츠 데이터에서 다시 온다
```

## REUSED / ADDED

```text
REUSED   RULE-REGION-TRANSIT-001 의 전제·전이 · INTERACTION_RANGE · evaluateActionBegin ·
         out-of-range / action-busy / unknown-connector / wrong-region 사유 코드 ·
         role region-exit · interaction transit · hud region.depth · region { id, hash } ·
         RegionSpec 형 · ANCHOR_LAYER · exitsOf 의 순서 결정론 · STATE_VERSION · SPAWN_POINTS
ADDED    Region 넷 · depth 값 wild · Connector 아홉 · transition 값 넷 · direction 값 one-way ·
         World.graph.frontiers · World.closedConnectors ·
         사유 코드 connector-inactive · region-not-built · region-exit 의 state 값 locked ·
         검사 코드 frontier-built · unused-frontier · unreachable
CHANGED  RULE-REGION-TRANSIT-001 (전제 둘 · 사유 순서) · 투영의 region-exit state · Graph 정합 검사
AFFECTED 없음 — C001 의 AFFECTED 들은 방이 늘어도 같은 판정을 그대로 한다 (R5)
```

## Observable (관찰 계약)

C001 의 계약에서 **바뀌는 것만** 적는다. 봉투의 **형은 하나도 바뀌지 않는다** — 값의 가짓수만 는다.
그래서 `content/protocol/` 은 이 Cycle 에서 손대지 않고 STATE_VERSION 도 그대로다.

```text
entities[role=region-exit].state          = open | locked                                    (값 추가)
entities[role=region-exit].kind           = road | trail | door | pass | interaction         (값 추가)
interactions[id=transit].reason           += connector-inactive | region-not-built           (값 추가)
hud[id=region.depth].value                += wild                                            (값 추가)
snapshot.scene · snapshot.region.id       = 여섯 Region id 중 하나                            (값 추가)
```

투영하지 않는 것 — 목적지 region 의 id/이름 · Connector.direction · frontiers 목록 ·
closedConnectors 목록 · 다른 방의 존재 · Graph 전체.
"목적지는 건너야 안다" 가 이 Play 의 미지감이다 (RegionGraphRooms §5.1).

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
새 anchor 의 좌표          데이터다 (C001 선례). 방향만 Play §5.8 의 그래프 모양에서 왔다 —
                          숲으로 북, 돌아가는 길은 그 반대 변. 고대 문만 변이 아닌 안쪽 모서리다
거절 사유의 순서            Observable ②·⑥ 이 "붙어서 요청하면 거절이 온다" 이므로 거리가 닫힘·경계보다
                          앞이다. 멀리서도 사유가 보이면 걸어가 볼 이유가 사라진다
경계 출구의 표식            Play §5.1 "목적지는 건너야 안다" 를 지킨다 — 열린 것과 같게 둔다 (SPEC-007 경계)
붉은 황야·얼음 협곡의 방향   백왕령의 동/서. 방 사이 좌표는 무관하므로 지도의 방위가 아니라
                          "길이 아닌 두 곳" 이라는 것만 뜻한다
RED_EYE_TREE 쪽 두 Connector
를 C002 에 두는 것          Play §5.3 이 숲 안쪽의 출구를 다섯으로 못박았다. 방은 C003 이 짓는다
extent 경계값의 포함 여부    C001 이 넘긴 숙제 — **포함한다** (`extentContains` 의 ≥ · ≤).
                          −20 과 20 은 방 안이다. 시나리오가 경계를 피하지 않아도 된다
```
