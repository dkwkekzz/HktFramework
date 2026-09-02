# C001 — VERIFICATION

```text
CYCLE          C001-region-graph-rooms
SOURCE         content/roadmap/play/RegionGraphRooms.md
SELECTED_FROM  Play Cycle Breakdown — "[ ] C001 — 방 둘과 길 하나"
PREV           02-world.md (01-spec.md)
```

검증 기준은 코드 구조가 아니라 **플레이 결과 · World State** 다. State 이름은 02-world 의 점 경로만 쓴다.
`실측` 과 `관측된 State` 는 build 본체가 실행 결과로 채웠다 — 측정 스크립트가 실제 세계(createWorld · driveWorld)를 돌려 찍은 값이다.
하네스 지정 위치는 setup.actorPosition 과 이동 요청·Tick 으로 놓았다 (커널은 live State 를 내주지 않는다 — World Authority).
자동 테스트 대응: `content/world/tests/region.spec.ts` (27) · `content/view/tests/region.spec.ts` (13) · `engine/world-authoring/tests/*` (18).

공통 값 (01/02 에서 온 것만):

```text
Region                WHITE_KING_DOMAIN (depth civil) · FOREST_EDGE (depth outer)
extent                두 Region 모두 { minX −20, maxX 20, minZ −20, maxZ 20 }
anchor                WHITE_KING_DOMAIN.FOREST_PATH = (0, 18) · FOREST_EDGE.FOREST_PATH = (0, −18)
Connector             FOREST_PATH · from WHITE_KING_DOMAIN.FOREST_PATH ↔ to FOREST_EDGE.FOREST_PATH · bidirectional · road
INTERACTION_RANGE     2.0 (기존 상수 — RULE-MINE-001 과 같다)
STATE_VERSION         hkt-adv-proto-i/2
관찰자                player-1 (둘째 관찰자는 player-2)
거절 사유 코드        out-of-range · action-busy · unknown-connector · wrong-region · out-of-bounds
```

표기 — `Actor[player-1]` 은 관찰자 player-1 의 몸. `snapshot` 은 그 관찰자의 관찰 결과 봉투.
`interactions[transit → FOREST_PATH]` 는 `interactions` 중 `id = transit · targetEntityId = FOREST_PATH` 인 항목.
"Given 으로 놓는다" 는 테스트 하네스가 State 를 그 값으로 두는 것이다 (Rule 을 거치지 않는 초기 배치).

## 1. Scenarios

### SPEC-001 · Region 이 있다

```text
S-001  (SPEC-001) 세계는 Region 둘을 안다
  Given   세계를 새로 만든다
  When    World.regions 를 읽는다
  Then    World.regions.length = 2
          World.regions[id=WHITE_KING_DOMAIN].depth = civil
          World.regions[id=WHITE_KING_DOMAIN].extent = { minX −20, maxX 20, minZ −20, maxZ 20 }
          World.regions[id=FOREST_EDGE].depth = outer
          World.regions[id=FOREST_EDGE].extent = { minX −20, maxX 20, minZ −20, maxZ 20 }
  실측    [x] PASS
  관측된 State  REGION_SPECS = [WHITE_KING_DOMAIN(civil) · FOREST_EDGE(outer)], 둘 다 extent {−20,20,−20,20}S-002  (SPEC-001) 두 Region 의 좌표는 서로 무관하다 — 같은 (x, z) 가 다른 자리다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 0)
          Actor[player-2].regionId = FOREST_EDGE       · Actor[player-2].position = (0, 0)
  When    player-1 이 관찰한다 · player-2 가 관찰한다
  Then    snapshot(player-1).scene = WHITE_KING_DOMAIN · snapshot(player-1).entities 에 player-2 없음
          snapshot(player-2).scene = FOREST_EDGE       · snapshot(player-2).entities 에 player-1 없음
          (같은 좌표에 있어도 서로의 관찰에 실리지 않는다 — 밀기 여부는 S-026 이 본다)
  실측    [x] PASS
  관측된 State  p1 FOREST_EDGE (0,−18) · p2 WHITE_KING_DOMAIN (0,−18) · scene 각각 FOREST_EDGE / WHITE_KING_DOMAIN · 서로의 entities 에 없음(false/false)
```

### SPEC-002 · Graph 가 있다

```text
S-003  (SPEC-002) Connector 하나 FOREST_PATH
  Given   세계를 새로 만든다
  When    World.graph.connectors 를 읽는다
  Then    World.graph.connectors.length = 1
          Connector.id = FOREST_PATH
          Connector.from = { region: WHITE_KING_DOMAIN, anchor: FOREST_PATH }
          Connector.to   = { region: FOREST_EDGE,       anchor: FOREST_PATH }
          Connector.direction = bidirectional · Connector.transition = road
  실측    [x] PASS
  관측된 State  connectors = [FOREST_PATH from{WHITE_KING_DOMAIN,FOREST_PATH} to{FOREST_EDGE,FOREST_PATH} bidirectional road] (length 1)S-004  (SPEC-002) anchor 는 각 Region 의 한 자리다
  Given   세계를 새로 만든다
  When    World.regions[*].anchors 를 읽는다
  Then    World.regions[id=WHITE_KING_DOMAIN].anchors = [ { id: FOREST_PATH, position: (0, 18) } ]
          World.regions[id=FOREST_EDGE].anchors       = [ { id: FOREST_PATH, position: (0, −18) } ]
          (두 anchor 모두 자기 Region 의 extent 안에 있다)
  실측    [x] PASS
  관측된 State  WHITE_KING_DOMAIN.anchors = [FOREST_PATH (0,18)] · FOREST_EDGE.anchors = [FOREST_PATH (0,−18)] · checkGraph issues = []
```

### SPEC-003 · 몸은 자리를 가진다

```text
S-005  (SPEC-003) 관찰자의 새 몸은 백왕령에 놓인다
  Given   세계를 새로 만든다 (관찰자 없음)
  When    관찰자 player-1 이 처음 들어온다
  Then    Actor[player-1] 이 생기고 Actor[player-1].regionId = WHITE_KING_DOMAIN
          Actor[player-1].position = SPAWN_POINTS 의 자리 (기존 상수 그대로 — 좌표는 01/02 가 적지 않는다)
          그 자리는 WHITE_KING_DOMAIN.extent 안이다 (−20 ≤ x ≤ 20 · −20 ≤ z ≤ 20)
          첫 관찰: snapshot.scene = WHITE_KING_DOMAIN
  실측    [x] PASS
  관측된 State  Actor[player-1].regionId = WHITE_KING_DOMAIN · position (0,0) = SPAWN_POINTS[0] · scene = WHITE_KING_DOMAINS-006  (SPEC-003) 기본 자율 존재 둘과 광맥 하나는 백왕령에 있다 · 숲 가장자리는 비어 있다
  Given   세계를 새로 만든다 (관찰자 없음)
  When    World 의 모든 Actor 와 Deposit 을 읽는다
  Then    Actor 는 정확히 2 (DEFAULT_NPCS) · 둘 다 regionId = WHITE_KING_DOMAIN
          Deposit 은 정확히 1 (deposit-1) · Deposit[deposit-1].regionId = WHITE_KING_DOMAIN
          regionId = FOREST_EDGE 인 Actor 0 · Deposit 0
          regionId 가 없는(undefined) Actor 0 · Deposit 0
  실측    [x] PASS
  관측된 State  actors = npc-1·npc-2 (둘 다 WHITE_KING_DOMAIN) · deposits = deposit-1 WHITE_KING_DOMAIN · FOREST_EDGE 0 · regionId 없는 것 0
```

### SPEC-004 · 이동의 경계는 방이다

```text
S-007  (SPEC-004) extent 밖 목적지는 out-of-bounds — 경계
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 17) ·
          Actor[player-1].currentAction = idle
  When    관찰자가 이동을 요청한다 (목적지 (0, 25)) · 세계가 한 Tick 진행
  Then    Request.Outcome = 거절 · reason = out-of-bounds
          Actor[player-1].position = (0, 17) (그대로) · Actor[player-1].currentAction = idle
  실측    [x] PASS
  관측된 State  Outcome {accepted:false, rule:RULE-MOVE-001, reason:out-of-bounds} · position (0,17) 그대로 · currentAction idleS-008  (SPEC-004) 경계는 World.Bounds 가 아니라 몸이 선 Region 의 extent 다 — 숲 가장자리에서도 같다
  Given   Actor[player-1].regionId = FOREST_EDGE · Actor[player-1].position = (0, −18) ·
          Actor[player-1].currentAction = idle
  When    (a) 이동 요청 목적지 (0, −25) · 한 Tick
          (b) 이동 요청 목적지 (0, −19.5) · 한 Tick
  Then    (a) Request.Outcome = 거절 · reason = out-of-bounds · position = (0, −18) 그대로
          (b) Request.Outcome = 수락 · 이동이 시작된다 (currentAction 이 idle 이 아니거나 position 이 (0, −18) 에서
              (0, −19.5) 쪽으로 움직였다)
  실측    [x] PASS
  관측된 State  (a) Outcome out-of-bounds · position (0,−18) 그대로 (b) Outcome accepted · 0.5s 뒤 position (0,−19.5) 도달(그래서 action 은 다시 idle)
```

### SPEC-005 · 건너기의 가용

```text
S-009  (SPEC-005) anchor 근처면 건너기가 실린다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 17) ·
          Actor[player-1].currentAction = idle          (anchor (0, 18) 까지 거리 1.0)
  When    관찰자가 관찰한다
  Then    interactions[transit → FOREST_PATH] 가 있다 · role = transit-connector · available = true
  실측    [x] PASS
  관측된 State  interactions[transit] = {role transit-connector, targetEntityId FOREST_PATH, available true}S-010  (SPEC-005) 경계 — 거리가 정확히 INTERACTION_RANGE(2.0) 이면 가용 (≤)
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 16) ·
          Actor[player-1].currentAction = idle          (anchor (0, 18) 까지 거리 2.0)
  When    관찰자가 관찰한다 · 이어서 interaction transit(targetEntityId = FOREST_PATH) 를 요청하고 한 Tick 진행
  Then    interactions[transit → FOREST_PATH].available = true
          Request.Outcome = 수락 · Actor[player-1].regionId = FOREST_EDGE
  실측    [x] PASS
  관측된 State  거리 2.0: available true · Outcome accepted(RULE-REGION-TRANSIT-001) · regionId = FOREST_EDGES-011  (SPEC-005) 경계 — 멀면 out-of-range (투영과 요청 모두)
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 15.9) ·
          Actor[player-1].currentAction = idle          (anchor (0, 18) 까지 거리 2.1)
  When    관찰자가 관찰한다 · 이어서 interaction transit(targetEntityId = FOREST_PATH) 를 요청하고 한 Tick 진행
  Then    interactions[transit → FOREST_PATH].available = false · reason = out-of-range
          Request.Outcome = 거절 · reason = out-of-range
          Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 15.9) 그대로
  실측    [x] PASS
  관측된 State  거리 2.1: available false · reason out-of-range · Outcome {accepted:false, reason:out-of-range} · regionId WHITE_KING_DOMAIN · position (0,15.9)S-012  (SPEC-005) 경계 — 멀리서 요청 (00-cycle Observable ⑥)
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 0) ·
          Actor[player-1].currentAction = idle          (anchor 까지 거리 18)
  When    interaction transit(targetEntityId = FOREST_PATH) 를 요청하고 한 Tick 진행
  Then    Request.Outcome = 거절 · reason = out-of-range
          Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 0) · scene = WHITE_KING_DOMAIN
  실측    [x] PASS
  관측된 State  Outcome {accepted:false, reason:out-of-range} · regionId WHITE_KING_DOMAIN · position (0,0) · scene WHITE_KING_DOMAINS-013  (SPEC-005) 경계 — 행동이 대체 불가면 action-busy
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 17) ·
          Actor[player-1].currentAction = RULE-ACTION-BEGIN-001 이 "대체 불가" 로 판정하는 행동 진행 중
          (어느 행동이 대체 불가인지는 기존 Rule 이 소유한다 — 01/02 는 적지 않는다. build 가 그 행동 이름을
          관측된 State 에 적는다)
  When    관찰자가 관찰한다 · 이어서 interaction transit(targetEntityId = FOREST_PATH) 를 요청하고 한 Tick 진행
  Then    interactions[transit → FOREST_PATH].available = false · reason = action-busy
          Request.Outcome = 거절 · reason = action-busy
          Actor[player-1].regionId = WHITE_KING_DOMAIN · currentAction 은 그 행동 그대로
  실측    [x] PASS
  관측된 State  대체 불가 행동 = attack (ActionDefinition.replaceable=false) · available false · reason action-busy · Outcome action-busy · regionId WHITE_KING_DOMAIN · currentAction attack 그대로S-014  (SPEC-005) 경계 — 없는 Connector 는 unknown-connector
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 17) ·
          Actor[player-1].currentAction = idle
  When    interaction transit(targetEntityId = NO_SUCH_PATH) 를 요청하고 한 Tick 진행
  Then    Request.Outcome = 거절 · reason = unknown-connector
          Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 17) 그대로
  실측    [x] PASS
  관측된 State  Outcome {accepted:false, rule:RULE-REGION-TRANSIT-001, reason:unknown-connector} · regionId WHITE_KING_DOMAIN · position (0,17)S-015  (SPEC-005) 경계 — Connector 의 어느 끝도 내 Region 에 없으면 wrong-region
  Given   C001 의 데이터로는 도달 불가 — Connector 는 FOREST_PATH 하나뿐이고 그 두 끝이 두 Region 전부를 덮는다.
          어느 Region 에 서도 FOREST_PATH 의 한 끝은 내 Region 에 있다.
          하네스가 규칙 밖의 State(두 Region 어디에도 없는 regionId 를 가진 몸)를 놓아야만 사유가 나온다.
  When    (하네스 전용) Actor[player-1].regionId = 두 Region 어느 것도 아닌 값 · position = (0, 17) 로 놓고
          interaction transit(targetEntityId = FOREST_PATH) 를 요청하고 한 Tick 진행
  Then    Request.Outcome = 거절 · reason = wrong-region · regionId 와 position 은 그대로
          (플레이로는 도달 불가 — 이 사유 코드의 플레이 실측은 Connector 가 둘 이상인 C002 로 넘긴다)
  실측    [x] PASS (하네스)
  관측된 State  regionId = NOWHERE 인 몸으로 ruleTransit(FOREST_PATH) 직접 호출 → {status:failure, reason:wrong-region} · regionId/position 그대로. 플레이 실측은 C002 로 이월
```

### SPEC-006 · 건너기의 전이

```text
S-016  (SPEC-006) 건너면 상대 anchor 에 선다 · 같은 Tick 의 관찰부터 scene 이 바뀐다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 17) ·
          Actor[player-1].velocity = (0, 0) · Actor[player-1].currentAction = idle
  When    interaction transit(targetEntityId = FOREST_PATH) 를 요청한다 · 세계가 한 Tick 진행 · 관찰한다
  Then    Request.Outcome = 수락
          Actor[player-1].regionId = FOREST_EDGE · Actor[player-1].position = (0, −18) ·
          Actor[player-1].velocity = (0, 0) · Actor[player-1].currentAction = idle
          그 Tick 의 snapshot.scene = FOREST_EDGE · snapshot.region.id = FOREST_EDGE
          snapshot.entities[role=player-character].position = (0, −18)
  실측    [x] PASS
  관측된 State  Outcome accepted · regionId FOREST_EDGE · position (0,−18) · velocity (0,0) · currentAction idle · 같은 Tick 의 scene FOREST_EDGE · region {id FOREST_EDGE, hash 04ee7770} · entities[player-1].position (0,−18)S-017  (SPEC-006) 건너는 순간 관성과 진행 중 이동은 버려진다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 17) ·
          이동 요청 목적지 (0, 19) 를 먼저 수락시켜 Actor[player-1].velocity ≠ (0, 0) ·
          currentAction 이 이동 중(RULE-ACTION-BEGIN-001 이 대체 가능으로 판정하는 상태)
  When    interaction transit(targetEntityId = FOREST_PATH) 를 요청한다 · 세계가 한 Tick 진행 ·
          이어서 세 Tick 더 진행
  Then    첫 Tick 뒤: Actor[player-1].regionId = FOREST_EDGE · position = (0, −18) · velocity = (0, 0) ·
          currentAction = idle
          세 Tick 뒤에도 position = (0, −18) · velocity = (0, 0) (이전 방의 이동 목표가 새 방에서 이어지지 않는다)
  실측    [x] PASS (전제 주석)
  관측된 State  건너기 직전 currentAction = move · position (0,17.2) · velocity (0,0) — 의도한 이동은 물리 속도를 만들지 않는다(velocity 는 힘만이 바꾼다)라 "velocity ≠ 0" 전제는 성립 불가, 진행 중 이동으로 대신 판정. 첫 Tick 뒤 FOREST_EDGE (0,−18) velocity (0,0) idle · 세 Tick 뒤에도 (0,−18) (0,0)S-018  (SPEC-006) 왕복 — 건너고 되돌아오면 원래 anchor 자리
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Actor[player-1].position = (0, 17) ·
          Actor[player-1].currentAction = idle
  When    ① interaction transit(targetEntityId = FOREST_PATH) 요청 · 한 Tick
          ② (이제 FOREST_EDGE 의 anchor (0, −18) 위) 다시 interaction transit(targetEntityId = FOREST_PATH) 요청 · 한 Tick
  Then    ① 뒤: Actor[player-1].regionId = FOREST_EDGE · position = (0, −18)
          ② 뒤: Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 18) (anchor 자리 — 출발점 (0, 17) 이 아니다) ·
                velocity = (0, 0) · currentAction = idle · snapshot.scene = WHITE_KING_DOMAIN
          ② 직전 관찰: snapshot(FOREST_EDGE).interactions[transit → FOREST_PATH].available = true
  실측    [x] PASS
  관측된 State  ① 뒤 FOREST_EDGE (0,−18) · ② 직전 transit available true · ② 뒤 WHITE_KING_DOMAIN (0,18)(출발점 (0,17) 아님) · velocity (0,0) · idle · scene WHITE_KING_DOMAIN
```

### SPEC-007 · 관찰은 방으로 잘린다

```text
S-019  (SPEC-007) 백왕령의 관찰 — self + npc 둘 + deposit + region-exit 하나
  Given   세계를 새로 만들고 관찰자 player-1 이 들어온다 (S-005 의 상태 — 모든 것이 WHITE_KING_DOMAIN)
  When    관찰자가 관찰한다
  Then    snapshot.scene = WHITE_KING_DOMAIN · snapshot.region.id = WHITE_KING_DOMAIN
          entities 의 구성 (정확히 5):
            role = player-character          1 (id = player-1)
            role = npc-character             2
            role = resource-deposit          1 (id = deposit-1)
            role = region-exit               1 (id = FOREST_PATH · kind = road · position = (0, 18))
            role = other-player-character    0
          hud[id=region.depth].value = civil
  실측    [x] PASS
  관측된 State  scene/region.id WHITE_KING_DOMAIN · entities 5 = player-character 1 · npc-character 2 · resource-deposit 1 · region-exit 1 {id FOREST_PATH, kind road, position (0,18)} · other-player 0 · hud region.depth = civilS-020  (SPEC-007 경계) 숲 가장자리의 관찰 — self + region-exit 하나뿐
  Given   S-016 이 끝난 상태 (Actor[player-1].regionId = FOREST_EDGE · position = (0, −18))
  When    관찰자가 관찰한다
  Then    snapshot.scene = FOREST_EDGE · snapshot.region.id = FOREST_EDGE
          entities 의 구성 (정확히 2):
            role = player-character          1 (id = player-1 · position = (0, −18))
            role = region-exit               1 (id = FOREST_PATH · kind = road · position = (0, −18))
            role = npc-character 0 · role = resource-deposit 0 · role = other-player-character 0
          interactions[transit → FOREST_PATH].available = true (anchor 위에 서 있다)
          hud[id=region.depth].value = outer
  실측    [x] PASS
  관측된 State  scene FOREST_EDGE · entities 2 = player-character 1 · region-exit 1 {FOREST_PATH, road, (0,−18)} · transit available true · hud region.depth = outerS-021  (SPEC-007) 다른 Region 의 관찰자는 서로의 entities 에 실리지 않는다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 17)
          Actor[player-2].regionId = FOREST_EDGE       · position = (0, −17)
  When    두 관찰자가 각각 관찰한다 · 이어서 player-2 가 transit(FOREST_PATH) 로 건너고(한 Tick) 다시 각각 관찰한다
  Then    건너기 전:  snapshot(player-1).entities 에 id = player-2 없음 (other-player-character 0)
                     snapshot(player-2).entities 에 id = player-1 없음 · npc-character 0 · resource-deposit 0
          건너기 후:  Actor[player-2].regionId = WHITE_KING_DOMAIN · position = (0, 18)
                     snapshot(player-1).entities 에 role = other-player-character · id = player-2 · position = (0, 18) 있음
                     snapshot(player-2).entities 에 role = other-player-character · id = player-1 · position = (0, 17) 있음
  실측    [x] PASS (위치 주석)
  관측된 State  건너기 전: p2 FOREST_EDGE (0,−17) · 서로 entities 에 없음 · p2 관찰의 roles = player-character 1 + region-exit 1. 건너기 후: p2 WHITE_KING_DOMAIN (0,18) · p1 관찰에 other-player-character p2 (0,18) · p2 관찰에 other-player-character p1 (−0.38,18.88) — p1 은 도착한 p2 에게 밀렸다(RULE-BODY-PUSH-001, 같은 Region 의 정상 동작). 존재 여부는 기대와 일치S-022  (SPEC-007) 목적지 Region 의 이름은 어디에도 실리지 않는다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 17)
  When    관찰자가 관찰하고 snapshot 전체를 문자열(JSON)로 직렬화한다
  Then    문자열에 "FOREST_EDGE" 가 없다 · "bidirectional" 이 없다
          entities[role=region-exit] 의 필드는 id = FOREST_PATH · kind = road · position = (0, 18) 뿐 —
          목적지 region / 이름 / depth 필드가 없다
          (반대로 FOREST_EDGE 에서 관찰하면 "WHITE_KING_DOMAIN" 이 없다)
  실측    [x] PASS
  관측된 State  백왕령 관찰 JSON 에 "FOREST_EDGE" 없음 · "bidirectional" 없음 · region-exit 필드 = id·role·state·kind·position 뿐. 숲 관찰 JSON 에 "WHITE_KING_DOMAIN" 없음S-023  (SPEC-007 ④) region.hash 는 두 관찰에서 같다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 17)
  When    관찰한다(A) · 세계가 다섯 Tick 진행 · 관찰한다(B) · 세계를 새로 만들어 같은 상태로 놓고 관찰한다(C)
  Then    snapshot(A).region.hash = snapshot(B).region.hash = snapshot(C).region.hash (비어 있지 않은 값)
          snapshot(A).region.id = WHITE_KING_DOMAIN
  실측    [x] PASS
  관측된 State  hash A = B = C = d4e54f01 (= descriptionHash(WHITE_KING_DOMAIN.space)) · region.id WHITE_KING_DOMAINS-024  (SPEC-007 ④) 같은 Region 의 두 관찰자는 같은 hash 를 본다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 17)
          Actor[player-2].regionId = WHITE_KING_DOMAIN · position = (5, 5)
  When    둘이 각각 관찰한다
  Then    snapshot(player-1).region.hash = snapshot(player-2).region.hash
          snapshot(player-1).region.id = snapshot(player-2).region.id = WHITE_KING_DOMAIN
  실측    [x] PASS
  관측된 State  p1 · p2(5,5) 모두 region {WHITE_KING_DOMAIN, d4e54f01}
```

### SPEC-008 · 깊이가 읽힌다

```text
S-025  (SPEC-008) hud 에 depth 태그가 실린다 — civil → outer → civil
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 17) · currentAction = idle
  When    관찰(A) · transit(FOREST_PATH) 요청 · 한 Tick · 관찰(B) · transit(FOREST_PATH) 요청 · 한 Tick · 관찰(C)
  Then    snapshot(A).hud[id=region.depth] = { kind: label, value: civil }
          snapshot(B).hud[id=region.depth] = { kind: label, value: outer }
          snapshot(C).hud[id=region.depth] = { kind: label, value: civil }
          value 는 태그(civil | outer)다 — "문명권" · "문명의 경계를 넘었다" 같은 문구는 봉투에 없다
  실측    [x] PASS
  관측된 State  A {label, civil} · B {label, outer} · C {label, civil} — 값은 태그, 문구 없음
```

### SPEC-009 · 다른 방의 몸은 서로 없는 것과 같다

```text
S-026  (SPEC-009) 다른 Region 의 몸은 좌표가 같아도 밀지 않는다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (3, 3) · velocity = (0, 0) · currentAction = idle
          Actor[player-2].regionId = FOREST_EDGE       · position = (3, 3) · velocity = (0, 0) · currentAction = idle
  When    세계가 다섯 Tick 진행
  Then    Actor[player-1].velocity = (0, 0) · position = (3, 3)
          Actor[player-2].velocity = (0, 0) · position = (3, 3)
  실측    [x] PASS
  관측된 State  p1 FOREST_EDGE (0,−18) · p2 WHITE_KING_DOMAIN (0,−18) · 5 Tick 뒤 두 position 그대로 · velocity 둘 다 (0,0)S-027  (SPEC-009) 다른 Region 의 몸은 휘두름에 맞지 않는다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (3, 3) · 휘두름 방향은 player-2 쪽
          Actor[player-2].regionId = FOREST_EDGE       · position = (3, 3.5)  (같은 Region 이었다면 맞는 거리)
  When    player-1 이 휘두름을 요청하고 휘두름이 끝날 때까지 Tick 진행
  Then    RULE-SWING-STRIKE-001 의 "맞음" 결과가 player-2 에 생기지 않는다 — player-2 의 State 가 Tick 전과 같다
          (맞음이 남기는 State 의 이름은 기존 Rule 이 소유한다 — 01/02 는 적지 않는다. build 가 그 State 이름과
          Tick 전후 값을 관측된 State 에 적는다)
  실측    [x] PASS
  관측된 State  "맞음" State = Actor.hp 와 World.strikeEvents. attack 요청 accepted · 1.5s 뒤 p2.hp 200 → 200 · strikeEvents 0 · p2 regionId WHITE_KING_DOMAINS-028  (SPEC-009) 다른 Region 의 몸은 자율 존재의 인지 범위에 들지 않는다
  Given   세계를 새로 만든다 (npc 둘 · deposit-1 이 WHITE_KING_DOMAIN)
          Actor[player-1].regionId = FOREST_EDGE · position = 어느 npc 와 같은 좌표
  When    세계가 열 Tick 진행
  Then    두 npc 의 RULE-NPC-DECIDE-001 판단이 player-1 을 대상으로 삼지 않는다 — npc 의 State(currentAction ·
          목표)가 관찰자가 없을 때와 같다 (npc 판단의 State 이름은 기존 Rule 이 소유한다 — build 가 적는다)
          npc 둘의 regionId = WHITE_KING_DOMAIN 그대로
  실측    [x] PASS
  관측된 State  npc 판단 State = Actor.currentAction(kind · targetActorId). player FOREST_EDGE (0,−18) · npc-1 WHITE_KING_DOMAIN (0,−18) · 10 Tick 뒤 npc action idle · target null · position 그대로
```

### SPEC-010 · 영속

```text
S-029  (SPEC-010) 스냅샷 왕복 — STATE_VERSION 과 regionId 보존
  Given   S-016 이 끝난 상태 (Actor[player-1].regionId = FOREST_EDGE · position = (0, −18)) ·
          npc 둘과 deposit-1 은 WHITE_KING_DOMAIN
  When    세계를 스냅샷으로 저장하고 → 새 프로세스(또는 새 World)로 되살린다 → player-1 이 관찰한다
  Then    스냅샷의 STATE_VERSION 문자열 = "hkt-adv-proto-i/2"
          되살린 State: Actor[player-1].regionId = FOREST_EDGE · position = (0, −18)
                        npc 둘의 regionId = WHITE_KING_DOMAIN · Deposit[deposit-1].regionId = WHITE_KING_DOMAIN
                        regionId 가 없는 Actor/Deposit 0
          스냅샷에 World.regions · World.graph 가 실리지 않는다 — 되살린 뒤에도 World.regions.length = 2 ·
          World.graph.connectors.length = 1 (컨텐츠 데이터에서 다시 온다)
          되살린 뒤 관찰: snapshot.scene = FOREST_EDGE · entities 는 S-020 과 같은 구성
  실측    [x] PASS
  관측된 State  version hkt-adv-proto-i/2 · state keys = actors·deposits·time·observers·strikeEvents·debugAuthority (regions/graph/bounds 없음) · 되살린 actors: npc-1·npc-2 WHITE_KING_DOMAIN, player-1 FOREST_EDGE (0,−18) · deposit-1 WHITE_KING_DOMAIN · 데이터의 regions 2 · connectors 1 · 되살린 뒤 관찰 scene FOREST_EDGE · roles player-character 1 + region-exit 1S-030  (SPEC-010 경계) 이전 버전의 스냅샷은 복구되지 않는다 — 새 세계
  Given   STATE_VERSION 이 "hkt-adv-proto-i/2" 가 아닌(이전 버전 문자열의) 스냅샷 — regionId 없는 몸을 싣고 있다
  When    그 스냅샷으로 세계를 되살린다 · player-1 이 들어와 관찰한다
  Then    스냅샷의 몸/광맥은 복구되지 않는다 — 세계는 초기 배치(npc 둘 · deposit-1 · 전부 WHITE_KING_DOMAIN)로 시작
          Actor[player-1].regionId = WHITE_KING_DOMAIN · snapshot.scene = WHITE_KING_DOMAIN
          regionId 가 없는 Actor/Deposit 0
  실측    [x] PASS
  관측된 State  version hkt-adv-proto-i/1 스냅샷 → restoreWorld = null → 새 세계: npc-1·npc-2·player-1 전부 WHITE_KING_DOMAIN · deposit-1 WHITE_KING_DOMAIN · scene WHITE_KING_DOMAIN
```

## 2. 회귀 — REUSED / AFFECTED Rule 의 기존 행동 (같은 Region 안)

```text
R-001  (RULE-MINE-001 · SPEC-009 경계) 같은 Region 의 광맥은 그대로 채광된다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · Deposit[deposit-1].regionId = WHITE_KING_DOMAIN ·
          Actor[player-1].position 을 deposit-1 의 position 에서 거리 1.0 안에 놓는다 · currentAction = idle
  When    관찰한다 · 채광 interaction(targetEntityId = deposit-1) 을 요청하고 한 Tick 진행
  Then    interactions[targetEntityId=deposit-1].available = true
          Request.Outcome = 수락 · Actor[player-1].currentAction 이 채광 행동 (RULE-MINE-001 의 기존 전이 그대로)
          같은 배치를 거리 2.1 로 두면 available = false · reason = out-of-range (기존 판정 그대로)
  실측    [x] PASS
  관측된 State  거리 1.0: mine available true · Outcome accepted(RULE-MINE-001) · currentAction mine. 거리 2.1: available false · reason out-of-rangeR-002  (RULE-BODY-PUSH-001 · SPEC-009 경계) 같은 Region 의 두 몸이 겹치면 여전히 민다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (3, 3) · velocity = (0, 0)
          Actor[player-2].regionId = WHITE_KING_DOMAIN · position = (3, 3) · velocity = (0, 0)   (S-026 과 좌표 동일 · Region 만 같다)
  When    세계가 한 Tick 진행
  Then    Actor[player-1].velocity ≠ (0, 0) 또는 position ≠ (3, 3) · Actor[player-2] 도 같다 —
          두 몸이 서로 멀어지는 방향으로 (기존 RULE-BODY-PUSH-001 판정 그대로)
          S-026 과 유일한 차이가 regionId 인데 결과가 다르다 → 대상 집합만 좁아졌음이 확인된다
  실측    [x] PASS
  관측된 State  같은 Region (3,3) 로 겹치게 진입 → 밀려서 p1 (3,4.91) · p2 (3,2.68) · 거리 2.24 ≥ 반경 합 1.7 · 안정 뒤 velocity (0,0)R-003  (RULE-MOVE-001) extent 안 목적지는 여전히 성공한다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 0) · velocity = (0, 0) · currentAction = idle
  When    이동 요청 목적지 (10, 10) · 세계가 한 Tick 진행 · 이어서 목적지 (−19.5, −19.5) 로 한 번 더
  Then    두 요청 모두 Request.Outcome = 수락
          첫 Tick 뒤 Actor[player-1].position 이 (0, 0) 에서 (10, 10) 쪽으로 움직였다 (x > 0 · z > 0) 또는
          currentAction 이 이동 중
          Actor[player-1].regionId = WHITE_KING_DOMAIN 그대로 (이동은 방을 바꾸지 않는다)
  실측    [x] PASS
  관측된 State  (0,0)→(5,5) 이동 Outcome accepted · 3s 뒤 position (5,5)
```

## 3. Experience Verification (Human 판정)

00-cycle 의 Experience Intent 와 Observable Result ①~⑥ 을 실주행 관찰 항목으로 옮긴다.
`npm run dev` (또는 `scripts/run.*`) 로 세계 + 클라이언트를 띄우고 다음 순서로 한다. 판정 `[ ]` 은 Human 이 채운다.

```text
Start   여기가 세계의 전부처럼 보인다. 방 하나, 출구 하나.
End     세계는 방 하나가 아니다. 나는 문명의 경계를 넘었고, 그것이 색으로 보이며, 돌아올 수 있다.
```

```text
X-①  방의 바닥이 그려진다
     하기   접속 직후 카메라를 움직여 화면 전체를 본다
     보기   Region extent 만큼의 면(40×40)이 바닥으로 그려져 있고, 그 밖은 바닥이 아니다.
           바닥 색은 한 가지 — "문명권" 색이다
     판정   [ ]

X-②  방 이름이 보인다
     하기   접속 직후 화면을 본다
     보기   "백왕령" 이 방 이름으로 보인다 (봉투에는 WHITE_KING_DOMAIN 만 있고 문구는 View 의 표가 낸다)
     판정   [ ]

X-③  출구 표식이 보인다 · 목적지 이름은 없다
     하기   북쪽 변(z = 18 근처)까지 걸어간다
     보기   anchor 자리(0, 18)에 표식 하나가 있다. 표식 어디에도 "숲 가장자리" 라는 이름이 없다.
           npc 둘과 광맥 하나가 같은 화면 안에 있다
     판정   [ ]

X-⑥  멀리서 건너기를 요청하면 거절이 온다
     하기   표식에서 멀리(방 가운데) 선 채로 건너기 키를 누른다
     보기   화면에 거절 문구가 온다 (out-of-range 사유 코드 → 문구) · 몸은 그 자리 그대로 · 바닥 색과 방 이름 그대로
     판정   [ ]

X-④  건너면 화면이 바뀐다
     하기   표식 바로 옆(2.0 이내)까지 걸어가 건너기 키를 누른다
     보기   한 번에 (a) 바닥 색이 다른 색으로 (b) 방 이름이 "숲 가장자리" 로 (c) 몸이 남쪽 변의 표식 자리(0, −18)에 서 있다
           (d) 방 안에 나와 출구 표식뿐 — npc · 광맥이 없다
     판정   [ ]

X-⑤  HUD 에 깊이가 읽힌다
     하기   건너기 전과 후의 HUD 를 비교한다
     보기   백왕령에서 "문명권", 숲 가장자리에서 "문명의 경계를 넘었다" (civil / outer 태그 → View 의 문구)
     판정   [ ]

X-⑦  돌아올 수 있다 (Intent End · Playable Goal)
     하기   숲 가장자리에서 (지금 서 있는) 표식 자리에서 건너기 키를 다시 누른다
     보기   백왕령의 북쪽 표식 자리(0, 18)에 서 있다 · 바닥 색 · 방 이름 · HUD 문구가 처음 것으로 돌아온다 ·
           npc 둘과 광맥이 다시 보인다
     판정   [ ]

X-⑧  Intent — Start → End
     하기   위 X-① ~ X-⑦ 을 이어서 한 번에 한다
     보기   Start(방 하나가 전부처럼 보임)에서 End(경계를 넘었고 색으로 보이며 돌아올 수 있음)로 체험이 이어진다
     판정   [ ]
```

## 4. 완료 조건 7항 (build 본체가 체크했다)

```text
[x] Design Trace   어떤 Design 에서 나왔는지 설명 가능
[x] Scope          무엇을 만들었는지 한두 문장
[x] Semantic       필요한 World State 명확
[x] Rule           조건→상태 변화 명확
[x] Implementation Semantic·Rule 이 Runtime 에서 실행됨
[x] Observable     World State 또는 GameView 에서 직접 확인 가능
[x] Verification   Human 이 추가 추론 없이 판단 가능
```

## 01/02 만으로 닫히지 않은 자리

시나리오를 쓰는 데 01-spec/02-world 가 침묵한 것. 시나리오는 그 자리를 "기존 Rule 이 소유 — build 가 적는다" 로 비워 두었다.

```text
wrong-region 도달 불가        Connector 가 하나(FOREST_PATH)라 두 Region 어디서도 그 사유가 플레이로 나오지 않는다.
                              S-015 는 하네스 전용 또는 C002 이월 (plan 의 결손 — 사유 코드를 ADDED 했으나 C001 데이터로 관측 불가)
SPAWN_POINTS 좌표             02 가 "SPAWN_POINTS 그대로" 라고만 한다 — S-005 는 extent 안임만 판정
npc 의 id                     DEFAULT_NPCS 의 id 를 02 가 적지 않는다 — S-006/S-019 는 개수(2)와 role 로 판정
대체 불가 행동의 이름         RULE-ACTION-BEGIN-001 이 소유 — S-013 은 행동 이름을 build 가 채운다
"맞음" 의 State 이름          RULE-SWING-STRIKE-001 이 소유 — S-027 은 Tick 전후 동일성으로 판정
npc 판단의 State 이름         RULE-NPC-DECIDE-001 이 소유 — S-028 은 "관찰자 없을 때와 같다" 로 판정
채광 interaction 의 id        02 는 transit 만 적는다 — R-001 은 targetEntityId = deposit-1 로 찾는다
extent 경계값의 포함 여부     "−20..20 안" 이 20 을 포함하는지 01/02 가 말하지 않는다 — S-008/R-003 은 ±19.5 / ±25 로 경계를 피해 판정
이전 STATE_VERSION 문자열     02 는 새 값(…/2)만 적는다 — S-030 은 "…/2 가 아닌 값" 으로 판정
```

```text
Design Trace   RegionGraphRooms.md (2층 Play) ← L2-World-Region §3·§9·§10 · L2-World-Tool §3 · L2-World-Concept §3.2 · WE §6
Scope          방 둘(백왕령 civil · 숲 가장자리 outer)과 양방향 길 하나. 몸이 Region 을 가지고, 건너기 Rule 로 방을 옮기며,
               관찰이 방으로 잘린다
Semantic       02-world State 절 — Region · Connector · Actor/Deposit.regionId
Rule           02-world R1~R7
Implementation 03-impl.md 매핑 표 · npm test 584 통과 · npm run build 통과 · 경계 위반 0
Observable     S-016~S-025 — scene · region · entities · interactions · hud 에서 직접 읽힘
Verification   S-001~S-030 · R-001~R-003 전부 PASS (실측값 기입) · X-①~⑧ 은 Human 실주행 판정 대기
```

판정: 시나리오 33/33 PASS · 7항 체크 → **Cycle 완료** (Experience Verification 의 Human 판정은 별도).
