# C001 — WORLD SEMANTIC + RULE

```text
CYCLE          C001-region-graph-rooms
SOURCE         content/roadmap/play/RegionGraphRooms.md · content/roadmap/L2-World-Region.md §3 · §9 · §10 · content/roadmap/L2-World-Tool.md §3
SELECTED_FROM  Play Cycle Breakdown — "[ ] C001 — 방 둘과 길 하나"
PREV           01-spec.md
```

전부 컨텐츠(팩)의 의미다. 기반은 여기 나오는 명사(방 · 백왕령 · 깊이 · 길)를 모른다 — 기구 추출은 build 의 몫.

## State (Semantic)

```text
World.regions[]                       세계가 아는 Region 들 (컨텐츠 데이터에서 온다 · 저장되지 않는 정적 사실)
  Region.id                           WHITE_KING_DOMAIN | FOREST_EDGE
  Region.depth                        civil | outer                        (L2-World-Concept §3.2 의 depth 태그)
  Region.extent                       { minX, maxX, minZ, maxZ } — 그 Region 의 Local Space
  Region.anchors[]
    Anchor.id                         Connector 가 가리키는 이름 — FOREST_PATH
    Anchor.position                   Local Space 의 한 자리
  Region.hash                         Description 에서 유도되는 값 — 저장하지 않는다 (유도되는 사실)

World.graph.connectors[]              Region 사이의 전이 (컨텐츠 데이터 · 정적)
  Connector.id                        FOREST_PATH
  Connector.from                      { region: WHITE_KING_DOMAIN, anchor: FOREST_PATH }
  Connector.to                        { region: FOREST_EDGE,       anchor: FOREST_PATH }
  Connector.direction                 bidirectional                        (L2-World-Region §10)
  Connector.transition                road

Actor.regionId                        몸이 선 Region                        ADDED — WorldPosition = regionId + (x, z)
Deposit.regionId                      광맥이 있는 Region                     ADDED

World.bounds                          CHANGED → 제거. Region.extent 가 대신한다
```

이 Cycle 의 데이터 값 (Description 의 형 — Plan §3.1 그대로. 나중의 지형 op 는 이 ops 에 더해진다):

```text
WHITE_KING_DOMAIN   depth civil   extent −20..20 × −20..20   ops: [ point(layer anchor, tag FOREST_PATH, position (0, 18)) ]
FOREST_EDGE         depth outer   extent −20..20 × −20..20   ops: [ point(layer anchor, tag FOREST_PATH, position (0, −18)) ]
graph               FOREST_PATH   WHITE_KING_DOMAIN.FOREST_PATH ↔ FOREST_EDGE.FOREST_PATH · bidirectional · road
```

방향의 근거 — WE §32 (숲의 South 가 백왕령). 좌표는 배치 데이터다 (SPAWN_POINTS 선례).

## Rule

```text
R1  RULE-REGION-TRANSIT-001                                                  ADDED
    IF   관찰자의 몸 A 가 Connector C 의 한쪽 끝(from 또는 to — 양방향이므로 둘 다) anchor P 와 같은 Region 에 있고
         distance(A.position, P.position) ≤ INTERACTION_RANGE 이고
         A.currentAction 이 대체 가능(RULE-ACTION-BEGIN-001)이고
         A 가 C 로 건너기를 요청한다
    THEN A.regionId = 반대쪽 끝의 region · A.position = 반대쪽 anchor 의 position ·
         A.velocity = (0, 0) · A.currentAction = idle
    ELSE 거절 — out-of-range | action-busy | unknown-connector | wrong-region
         (wrong-region: 그 Connector 의 어느 끝도 A 의 Region 에 없다)

R2  RULE-MOVE-001                                                            CHANGED (전제 1 만)
    IF   목적지가 region(A.regionId).extent 안이 아니다
    THEN 거절 out-of-bounds
    (나머지 전제와 전이는 그대로)

R3  RULE-OBSERVER-JOIN-001 의 몸 부분 (spawnObserverBody)                      CHANGED
    THEN 새 몸의 regionId = WHITE_KING_DOMAIN (자리는 SPAWN_POINTS 그대로)

R4  세계의 초기 배치                                                          CHANGED
    THEN 기본 자율 존재 둘 · 광맥 하나의 regionId = WHITE_KING_DOMAIN

R5  RULE-BODY-PUSH-001 · RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001           AFFECTED (대상 집합만)
    IF   두 몸의 regionId 가 다르다
    THEN 서로 후보에 들지 않는다 — 밀지 않고 · 맞지 않고 · 인지하지 않는다
    (같은 Region 이면 기존 판정 그대로)

R6  관찰 투영 (projectObserver)                                               CHANGED
    THEN scene = self.regionId ·
         entities = { self 와 같은 regionId 의 Actor } ∪ { 같은 regionId 의 Deposit } ∪
                    { 그 Region 의 anchor 마다 region-exit 존재 (id = Connector.id · kind = transition · position = anchor) } ·
         interactions 에 anchor 마다 transit (R1 의 전제로 available/reason) ·
         hud 에 region.depth (label · value = Region.depth) ·
         봉투에 region { id, hash }

R7  영속                                                                     CHANGED
    THEN STATE_VERSION = hkt-adv-proto-i/2. 스냅샷은 Actor.regionId · Deposit.regionId 를 싣는다.
         World.regions · World.graph 는 싣지 않는다 — 컨텐츠 데이터에서 다시 온다
```

## REUSED / ADDED

```text
REUSED   INTERACTION_RANGE · RULE-ACTION-BEGIN-001(evaluateActionBegin) · SPAWN_POINTS · Request.Outcome 사유 코드 경로 ·
         out-of-range / out-of-bounds / action-busy 사유 코드 · HudItemView(label) · EntityView 봉투 · InteractionView 봉투 ·
         스냅샷/복구 규칙(버전 불일치 → 새 세계) · DEFAULT_NPCS · deposit-1
ADDED    World.regions · World.graph · Actor.regionId · Deposit.regionId · RULE-REGION-TRANSIT-001 ·
         사유 코드 unknown-connector · wrong-region · role region-exit · interaction transit · hud region.depth ·
         봉투 region { id, hash }
CHANGED  RULE-MOVE-001 전제 1 · RULE-OBSERVER-JOIN-001 몸 부분 · 초기 배치 · 투영 · STATE_VERSION · World.bounds 제거
AFFECTED RULE-BODY-PUSH-001 · RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001 (같은 Region 안에서만)
```

## Observable

build 가 그대로 protocol/ 로 옮긴다.

```text
snapshot.scene                        = self.regionId                               (봉투의 기존 필드 — 값의 뜻이 바뀐다)
snapshot.region.id                    = Region.id
snapshot.region.hash                  = Region.hash
entities[role=player-character | other-player-character | npc-character]   같은 Region 의 것만 (기존 필드 그대로)
entities[role=resource-deposit]       같은 Region 의 것만
entities[role=region-exit]            id = Connector.id · kind = Connector.transition · position = Anchor.position
interactions[id=transit]              role = transit-connector · targetEntityId = Connector.id · available · reason
hud[id=region.depth]                  kind = label · value = Region.depth
```

투영하지 않는 것 — 목적지 Region 의 id/이름 · Connector.direction · 다른 Region 의 존재 · World.graph 전체.
"목적지는 건너야 안다" 가 이 Play 의 미지감이다 (RegionGraphRooms §5.1).
