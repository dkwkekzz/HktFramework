# C002 — WORLD SEMANTIC + RULE

```text
CYCLE          C002-many-exits
SOURCE         content/roadmap/play/RegionGraphRooms.md §5.1 · §5.3 · §5.4 · §5.8 · §6 W4~W7 · 확정 사항 1·2·4·5
SELECTED_FROM  Play Cycle Breakdown — "[ ] C002 — 출구는 여럿, 목적지는 모른다"
PREV           01-spec.md
```

**확장** — C001 의 State/Rule 위에 더한다. 여기 없는 것은 `cycles/C001-region-graph-rooms/02-world.md`
그대로다. 전부 컨텐츠(팩)의 의미다 — 기반은 방·문·고개·잠김을 모른다.

## State (Semantic)

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
                                      World State 에 넣지 않고 저장하지도 않는다. 여는 규칙은 이 Cycle 에 없다 (Play W7)

Connector.isBuilt                     유도 — 반대쪽 끝의 region 이 World.regions 에 있는가
Connector.isOpen                      유도 — id 가 World.closedConnectors 에 없는가
```

이 Cycle 의 데이터 값 — 01-spec SPEC-002 (anchor) · SPEC-003 (Connector) 의 표가 그대로 원본이다.

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
    ELSE 거절 — 아래 순서로 첫 번째 사유 하나 (01-spec SPEC-006)
         unknown-connector → wrong-region → out-of-range → connector-inactive → region-not-built → action-busy
    거절은 세계 State 를 바꾸지 않는다 (RULE-REQUEST-REPLY-001 재사용)

R2  관찰 투영 (projectObserver) 의 region-exit 부분                            CHANGED
    THEN region-exit 존재의 state = C.isOpen ? open : locked
         (kind = Connector.transition · position = 이쪽 anchor · id = Connector.id — C001 그대로)
    투영하지 않는 것 — Connector.isBuilt · frontiers 목록 · 반대쪽 region 의 이름.
    "아직 없는 곳" 은 요청의 대답(reason)으로만 드러난다 (01-spec SPEC-007 경계)

R3  세계의 초기 배치                                                          REUSED (변화 없음)
    THEN 관찰자의 새 몸 · 기본 자율 존재 둘 · 광맥 하나는 그대로 WHITE_KING_DOMAIN 에 놓인다.
         새 방 넷은 비어 있다 (01-spec SPEC-001 경계)

R4  Graph 정합 검사                                                           CHANGED (경계를 알고, 닿음을 본다)
    IF   Connector 의 한 끝이 가리키는 region 에 Description 이 없다
    THEN 그 이름이 World.graph.frontiers 에 있으면 정상 (anchor 도 보지 않는다) · 없으면 unknown-region
    IF   frontiers 의 이름에 Description 이 있다                THEN frontier-built
    IF   frontiers 의 이름을 아무 Connector 도 가리키지 않는다     THEN unused-frontier
    IF   시작 방에서 Connector 를 따라 닿지 않는 지어진 방이 있다  THEN unreachable        (검사 ⑧)
    검사는 읽기 전용이다 — 세계를 바꾸지 않는다

R5  RULE-MOVE-001 · RULE-BODY-PUSH-001 · RULE-BODY-MOMENTUM-001 ·
    RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001                              AFFECTED (대상 집합만 — 자동)
    THEN 방이 여섯이 되어도 판정은 그대로다. 같은 regionId 안에서만 서로를 본다 (C001 R5)

R6  영속                                                                     REUSED (변화 없음)
    THEN STATE_VERSION 그대로. 방·Graph·frontiers·closed 는 스냅샷에 없고 컨텐츠 데이터에서 다시 온다
```

## REUSED / ADDED

```text
REUSED   RULE-REGION-TRANSIT-001 의 전제·전이 · INTERACTION_RANGE · evaluateActionBegin ·
         out-of-range / action-busy / unknown-connector / wrong-region 사유 코드 ·
         role region-exit · interaction transit · hud region.depth · region { id, hash } ·
         RegionSpec 형 · ANCHOR_LAYER · exitsOf 의 순서 결정론 · STATE_VERSION · SPAWN_POINTS
ADDED    Region 넷 (FOREST_DEEP · EXPLORER_RUIN · PREDATOR_NEST · BIO_ORE_FIELD) · depth 값 wild ·
         Connector 아홉 · transition 값 넷(trail · door · pass · interaction) · direction 값 one-way ·
         World.graph.frontiers · World.closedConnectors ·
         사유 코드 connector-inactive · region-not-built · region-exit 의 state 값 locked ·
         검사 코드 frontier-built · unused-frontier · unreachable
CHANGED  RULE-REGION-TRANSIT-001 (전제 둘 · 사유 순서) · 투영의 region-exit state · Graph 정합 검사
AFFECTED 없음 — C001 의 AFFECTED 들은 방이 늘어도 같은 판정을 그대로 한다 (R5)
```

## Observable

build 가 그대로 `content/protocol/` 로 옮긴다. C001 의 계약에서 **바뀌는 것만** 적는다.

```text
entities[role=region-exit].state          = open | locked                                    (값 추가)
entities[role=region-exit].kind           = road | trail | door | pass | interaction         (값 추가)
interactions[id=transit].reason           += connector-inactive | region-not-built           (값 추가)
hud[id=region.depth].value                += wild                                            (값 추가)
snapshot.scene · snapshot.region.id       = 여섯 Region id 중 하나                            (값 추가)
```

봉투의 **형은 하나도 바뀌지 않는다** — 값의 가짓수만 는다. 그래서 STATE_VERSION 도 그대로다.
투영하지 않는 것 (C001 그대로 · 여기서 는 것 포함) — 목적지 region 의 id/이름 · Connector.direction ·
frontiers 목록 · closedConnectors 목록 · 다른 방의 존재 · Graph 전체.
