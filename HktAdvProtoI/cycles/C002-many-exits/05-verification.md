# C002 — VERIFICATION

```text
CYCLE          C002-many-exits
SOURCE         content/roadmap/play/RegionGraphRooms.md
SELECTED_FROM  Play Cycle Breakdown — "[ ] C002 — 출구는 여럿, 목적지는 모른다"
PREV           02-world.md
```

검증 기준은 코드 구조가 아니라 **플레이 결과 · World State** 다. State 이름은 02-world 의 점 경로만 쓴다.
`실측` 과 `관측된 State` 는 build 통합이 **실제로 돌린 값**으로 채웠다. 자동 시나리오 30(테스트 42)은 전부 PASS 이고,
실주행 값은 세계를 굴려 백왕령 → 숲 가장자리 → 숲 안쪽 → 광석 지대까지 걸어가며 관측한 것이다.
자동 테스트 대응: `content/world/tests/c002-many-exits.spec.ts`.

공통 값 (01/02 에서 온 것만):

```text
Region        WHITE_KING_DOMAIN(civil) · FOREST_EDGE(outer) · FOREST_DEEP(wild) ·
              EXPLORER_RUIN(wild) · PREDATOR_NEST(wild) · BIO_ORE_FIELD(wild)
extent        여섯 Region 모두 { minX −20, maxX 20, minZ −20, maxZ 20 }
anchor        WHITE_KING_DOMAIN  FOREST_PATH(0, 18) · RED_WASTE_PASS(18, 0) · ICE_CANYON_PASS(−18, 0)
              FOREST_EDGE        FOREST_PATH(0, −18) · DEEP_TRAIL(0, 18) · RUIN_TRAIL(−18, 0)
              FOREST_DEEP        DEEP_TRAIL(0, −18) · NEST_TRAIL(−18, 0) · ORE_TRAIL(18, 0) ·
                                 TREE_APPROACH(0, 18) · ANCIENT_GATE(−13, 13)
              EXPLORER_RUIN      RUIN_TRAIL(18, 0)
              PREDATOR_NEST      NEST_TRAIL(18, 0)
              BIO_ORE_FIELD      ORE_TRAIL(−18, 0) · TREE_TRAIL(0, 18)
Connector     FOREST_PATH(road) · RUIN_TRAIL(trail) · DEEP_TRAIL(trail) · NEST_TRAIL(trail) ·
              ORE_TRAIL(trail) · TREE_APPROACH(interaction) · ORE_TREE_TRAIL(trail) ·
              ANCIENT_GATE(door, one-way) · RED_WASTE_PASS(pass, one-way) · ICE_CANYON_PASS(pass, one-way)
frontier      RED_EYE_TREE · FANTASY_MAZE · RED_WASTE · ICE_CANYON
closed        ANCIENT_GATE (나머지 아홉은 열려 있다)
INTERACTION_RANGE  2.0 (C001 그대로)
STATE_VERSION      hkt-adv-proto-i/2 (올라가지 않는다)
관찰자             player-1 (둘째 관찰자는 player-2)
거절 사유 코드     unknown-connector → wrong-region → out-of-range → connector-inactive →
                   region-not-built → action-busy (이 순서로 첫 하나)
```

표기 — `Actor[player-1]` 은 관찰자 player-1 의 몸. `snapshot` 은 그 관찰자의 관찰 결과 봉투.
`exits(R)` 는 그 Region 에서 관찰한 `entities` 중 `role = region-exit` 인 것들.
`transit → C` 는 `interactions` 중 `id = transit · targetEntityId = C` 인 항목.
"방으로 걸어간다" 는 이동 요청 + Tick 으로 그 자리에 서는 것이다 (하네스가 State 를 직접 놓지 않는다).

## 1. Scenarios

### SPEC-001 · 방이 여섯이다

```text
S-001  (SPEC-001) 세계는 Region 여섯을 안다 — 새 방 넷은 전부 wild · extent 40×40
  Given   세계를 새로 만든다
  When    World.regions 를 읽는다
  Then    World.regions 의 id 집합 = { WHITE_KING_DOMAIN, FOREST_EDGE, FOREST_DEEP,
                                       EXPLORER_RUIN, PREDATOR_NEST, BIO_ORE_FIELD } (여섯)
          Region.depth 의 분포 = civil 1 · outer 1 · wild 4
          FOREST_DEEP · EXPLORER_RUIN · PREDATOR_NEST · BIO_ORE_FIELD 넷 모두
            Region.depth = wild · extent = { minX −20, maxX 20, minZ −20, maxZ 20 }
  실측    PASS
  관측된 State  REGION_SPECS = WHITE_KING_DOMAIN/civil · FOREST_EDGE/outer · FOREST_DEEP/wild ·
                EXPLORER_RUIN/wild · PREDATOR_NEST/wild · BIO_ORE_FIELD/wild (여섯 · civil 1 · outer 1 · wild 4).
                여섯 전부 extent { −20, 20, −20, 20 }

S-002  (SPEC-001 경계) 새 방 넷에는 anchor 말고 아무 것도 없다
  Given   세계를 새로 만든다 (관찰자 하나가 들어온다 — 기본 배치)
  When    World 의 모든 Actor 와 Deposit 의 regionId 를 읽는다
  Then    regionId 값의 집합 = { WHITE_KING_DOMAIN } 뿐 —
          FOREST_DEEP · EXPLORER_RUIN · PREDATOR_NEST · BIO_ORE_FIELD 에 놓인 Actor 0 · Deposit 0
          그 넷에서 관찰하면 entities 는 관찰자 자신 + region-exit 들뿐이다 (S-019 · S-020 이 수를 본다)
  실측    PASS
  관측된 State  기본 배치의 Actor·Deposit 의 regionId 집합 = { WHITE_KING_DOMAIN } 하나.
                새 방 넷의 Actor 0 · Deposit 0
```

### SPEC-002 · anchor 가 방마다 여럿이다

```text
S-003  (SPEC-002) 각 방의 anchor 자리가 표 그대로다 — 출구 표식의 position 으로 읽는다
  Given   관찰자의 몸이 여섯 방을 차례로 지난다 (백왕령 → 숲 가장자리 → 숲 안쪽 → 둥지 → 광석 지대 → 폐허)
  When    각 방에서 관찰한다
  Then    exits(R) 의 { id → position } 이 공통 값의 anchor 표와 같다
            WHITE_KING_DOMAIN  FOREST_PATH(0, 18) · RED_WASTE_PASS(18, 0) · ICE_CANYON_PASS(−18, 0)
            FOREST_EDGE        FOREST_PATH(0, −18) · DEEP_TRAIL(0, 18) · RUIN_TRAIL(−18, 0)
            FOREST_DEEP        DEEP_TRAIL(0, −18) · NEST_TRAIL(−18, 0) · ORE_TRAIL(18, 0) ·
                               TREE_APPROACH(0, 18) · ANCIENT_GATE(−13, 13)
            EXPLORER_RUIN      RUIN_TRAIL(18, 0)
            PREDATOR_NEST      NEST_TRAIL(18, 0)
            BIO_ORE_FIELD      ORE_TRAIL(−18, 0) · ORE_TREE_TRAIL(0, 18)
          한 방 안에서 두 anchor 가 같은 자리에 있지 않다 (tag 유일 · 정합은 S-021 이 본다)
          모든 anchor 가 자기 Region 의 extent 안이다 (−20 ≤ x ≤ 20 · −20 ≤ z ≤ 20)
  실측    PASS
  관측된 State  실주행 관찰의 exits position —
                WHITE_KING_DOMAIN FOREST_PATH@0,18 · RED_WASTE_PASS@18,0 · ICE_CANYON_PASS@−18,0
                FOREST_EDGE       FOREST_PATH@0,−18 · RUIN_TRAIL@−18,0 · DEEP_TRAIL@0,18
                FOREST_DEEP       DEEP_TRAIL@0,−18 · NEST_TRAIL@−18,0 · ORE_TRAIL@18,0 ·
                                  TREE_APPROACH@0,18 · ANCIENT_GATE@−13,13
                BIO_ORE_FIELD     ORE_TRAIL@−18,0 · ORE_TREE_TRAIL@0,18
                전부 표와 같고, 한 방 안에서 겹치는 자리가 없다

S-004  (SPEC-002 경계) 방 사이의 좌표는 서로 무관하다 — 같은 tag 가 두 방에서 다른 자리다
  Given   S-003 의 관찰들
  When    같은 tag 를 쓰는 두 끝의 position 을 견준다
  Then    FOREST_PATH  백왕령 (0, 18)  ≠  숲 가장자리 (0, −18)
          DEEP_TRAIL   숲 가장자리 (0, 18) ≠ 숲 안쪽 (0, −18)
          RUIN_TRAIL   숲 가장자리 (−18, 0) ≠ 폐허 (18, 0)
          NEST_TRAIL   숲 안쪽 (−18, 0) ≠ 둥지 (18, 0)
          ORE_TRAIL    숲 안쪽 (18, 0) ≠ 광석 지대 (−18, 0)
  실측    PASS
  관측된 State  FOREST_PATH (0,18) ≠ (0,−18) · DEEP_TRAIL (0,18) ≠ (0,−18) ·
                RUIN_TRAIL (−18,0) ≠ (18,0) · NEST_TRAIL (−18,0) ≠ (18,0) · ORE_TRAIL (18,0) ≠ (−18,0)
```

### SPEC-003 · Connector 가 열이다

```text
S-005  (SPEC-003) World.graph.connectors 가 열이고 그 순서다
  Given   세계를 새로 만든다
  When    World.graph.connectors 를 읽는다
  Then    length = 10 이고 순서대로
            FOREST_PATH      WHITE_KING_DOMAIN.FOREST_PATH    ↔ FOREST_EDGE.FOREST_PATH        bidirectional road
            RUIN_TRAIL       FOREST_EDGE.RUIN_TRAIL           ↔ EXPLORER_RUIN.RUIN_TRAIL       bidirectional trail
            DEEP_TRAIL       FOREST_EDGE.DEEP_TRAIL           ↔ FOREST_DEEP.DEEP_TRAIL         bidirectional trail
            NEST_TRAIL       FOREST_DEEP.NEST_TRAIL           ↔ PREDATOR_NEST.NEST_TRAIL       bidirectional trail
            ORE_TRAIL        FOREST_DEEP.ORE_TRAIL            ↔ BIO_ORE_FIELD.ORE_TRAIL        bidirectional trail
            TREE_APPROACH    FOREST_DEEP.TREE_APPROACH        ↔ RED_EYE_TREE.FOREST_DEEP_SIDE  bidirectional interaction
            ORE_TREE_TRAIL   BIO_ORE_FIELD.TREE_TRAIL         ↔ RED_EYE_TREE.ORE_SIDE          bidirectional trail
            ANCIENT_GATE     FOREST_DEEP.ANCIENT_GATE         → FANTASY_MAZE.ANCIENT_GATE      one-way door
            RED_WASTE_PASS   WHITE_KING_DOMAIN.RED_WASTE_PASS → RED_WASTE.WHITE_KING_SIDE      one-way pass
            ICE_CANYON_PASS  WHITE_KING_DOMAIN.ICE_CANYON_PASS→ ICE_CANYON.WHITE_KING_SIDE     one-way pass
  실측    PASS
  관측된 State  connectors 열 개, 배열 순서 그대로 —
                FOREST_PATH(bidirectional/road) · RUIN_TRAIL · DEEP_TRAIL · NEST_TRAIL · ORE_TRAIL(trail) ·
                TREE_APPROACH(interaction) · ORE_TREE_TRAIL(trail) · ANCIENT_GATE(one-way/door) ·
                RED_WASTE_PASS · ICE_CANYON_PASS(one-way/pass)

S-006  (SPEC-003) 방마다 나갈 곳의 수가 3 · 3 · 5 · 1 · 1 · 2 다
  Given   S-003 의 관찰들
  When    각 방의 exits(R).length 를 센다
  Then    WHITE_KING_DOMAIN 3 · FOREST_EDGE 3 · FOREST_DEEP 5 ·
          EXPLORER_RUIN 1 · PREDATOR_NEST 1 · BIO_ORE_FIELD 2
  실측    PASS
  관측된 State  exitsOf — WHITE_KING_DOMAIN=3 · FOREST_EDGE=3 · FOREST_DEEP=5 ·
                EXPLORER_RUIN=1 · PREDATOR_NEST=1 · BIO_ORE_FIELD=2
```

### SPEC-004 · 아직 짓지 않은 곳을 가리킬 수 있다

```text
S-007  (SPEC-004) Description 없는 끝은 전부 경계(frontier)로 밝혀져 있다
  Given   세계를 새로 만든다
  When    World.graph.connectors 의 모든 끝의 region 을 World.regions 와 대조한다
  Then    World.graph.frontiers 집합 = { RED_EYE_TREE, FANTASY_MAZE, RED_WASTE, ICE_CANYON } (넷)
          Description 이 없는 끝의 region 은 전부 World.graph.frontiers 안에 있다
          World.graph.frontiers 의 이름 중 World.regions 에 있는 것은 하나도 없다
  실측    PASS
  관측된 State  frontiers = [RED_EYE_TREE, FANTASY_MAZE, RED_WASTE, ICE_CANYON].
                Description 없는 끝은 전부 이 넷 안이고, 넷 중 지어진 방은 없다
```

### SPEC-005 · 닫힌 Connector 가 있다

```text
S-008  (SPEC-005) ANCIENT_GATE 하나만 닫혀 있고, 닫힘은 세계 State 에 없다
  Given   S-003 의 관찰들 · 세계의 스냅샷
  When    여섯 방에서 본 exits(R) 의 state 를 모으고, 스냅샷의 State 키를 읽는다
  Then    state = locked 인 출구는 FOREST_DEEP 의 ANCIENT_GATE 하나뿐이다
          나머지 아홉 Connector 는 지어진 쪽에서 보면 state = open 이다
          스냅샷의 State 에 closedConnectors · graph · regions · frontiers 가 없다
          (닫힘은 컨텐츠 데이터에서 온다 — 여는 규칙도 닫는 규칙도 이 Cycle 에 없다)
  실측    PASS
  관측된 State  CLOSED_CONNECTORS = [ANCIENT_GATE]. 관찰된 출구 열 중 locked 는 ANCIENT_GATE 하나뿐.
                스냅샷 State 에 closedConnectors · graph · regions · frontiers 키가 없다
```

### SPEC-006 · 건너기의 거절이 여섯이 된다

```text
S-009  (SPEC-006 ①) 없는 Connector 는 unknown-connector
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · anchor FOREST_PATH(0, 18) 바로 앞 · currentAction = idle
  When    interaction transit(targetEntityId = NO_SUCH_PATH) 를 요청한다
  Then    Request.Outcome = 거절 · reason = unknown-connector
  실측    PASS
  관측된 State  요청 'NO_SUCH' → { status: failure, rule: RULE-REGION-TRANSIT-001, reason: unknown-connector }

S-010  (SPEC-006 ②) 이 방에 끝이 없는 Connector 는 wrong-region — C001 이 이월한 자리
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 0) · currentAction = idle
  When    interaction transit(targetEntityId = DEEP_TRAIL) 를 요청한다
          (DEEP_TRAIL 의 두 끝은 FOREST_EDGE 와 FOREST_DEEP — 백왕령에 없다)
  Then    Request.Outcome = 거절 · reason = wrong-region
          Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 0) 그대로
          (C001 은 Connector 가 하나여서 하네스로만 볼 수 있었다 — 여기서 플레이로 관측된다)
  실측    PASS
  관측된 State  백왕령에서 DEEP_TRAIL 요청 → reason: wrong-region.
                C001 이 하네스로만 확인했던 사유가 실제 플레이 경로에서 관측되었다 (열린 부채 해소)

S-011  (SPEC-006 ③) 멀면 out-of-range — 닫힘·경계보다 앞이다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (18 − INTERACTION_RANGE − 0.1, 0)
          (anchor RED_WASTE_PASS(18, 0) 까지 거리 2.1)
  When    관찰한다 · interaction transit(targetEntityId = RED_WASTE_PASS) 를 요청한다
  Then    interactions[transit → RED_WASTE_PASS].available = false · reason = out-of-range
          Request.Outcome = 거절 · reason = out-of-range
          (RED_WASTE 는 짓지 않은 방인데도 사유는 region-not-built 가 아니다 — 순서 ③ < ⑤)
  실측    PASS
  관측된 State  백왕령 (0,17) 에서 RED_WASTE_PASS(18,0) 요청 → reason: out-of-range (region-not-built 아님).
                멀리서 ANCIENT_GATE 요청 → out-of-range (connector-inactive 아님)

S-012  (SPEC-006 ④) 닫힌 문에 붙어 요청하면 connector-inactive
  Given   Actor[player-1].regionId = FOREST_DEEP · position = ANCIENT_GATE anchor(−13, 13) 위 ·
          currentAction = idle
  When    관찰한다 · interaction transit(targetEntityId = ANCIENT_GATE) 를 요청한다
  Then    interactions[transit → ANCIENT_GATE].available = false · reason = connector-inactive
          Request.Outcome = 거절 · reason = connector-inactive
          (ANCIENT_GATE 는 닫혀 있고 그 너머 FANTASY_MAZE 도 없다 — 사유는 닫힘이 먼저다 · 순서 ④ < ⑤)
  실측    PASS
  관측된 State  FOREST_DEEP 의 (−13,13) 에 서서 ANCIENT_GATE 요청 →
                outcome { accepted: false, reason: connector-inactive }. 건너간 뒤도 짓지 않은 곳이지만 닫힘이 먼저다

S-013  (SPEC-006 ⑤) 아직 없는 곳으로 건너려 하면 region-not-built
  Given   (a) Actor[player-1].regionId = WHITE_KING_DOMAIN · position = RED_WASTE_PASS anchor(18, 0) 위
          (b) 같은 몸이 ICE_CANYON_PASS anchor(−18, 0) 위
          (c) Actor[player-1].regionId = BIO_ORE_FIELD · position = ORE_TREE_TRAIL anchor(0, 18) 위
  When    각각 그 Connector 로 건너기를 요청한다
  Then    (a) (b) (c) 모두 Request.Outcome = 거절 · reason = region-not-built
          해당 interactions[transit → C].available = false · reason = region-not-built
          Actor[player-1].regionId 가 바뀌지 않는다
  실측    PASS
  관측된 State  FOREST_DEEP (0,18) 에서 TREE_APPROACH → region-not-built ·
                BIO_ORE_FIELD (0,18) 에서 ORE_TREE_TRAIL → region-not-built ·
                백왕령의 고개 둘도 붙어서 요청하면 같다

S-014  (SPEC-006 ⑥) 행동이 대체 불가면 action-busy — 다만 닫힘이 먼저다
  Given   Actor[player-1].regionId = FOREST_DEEP · position = DEEP_TRAIL anchor(0, −18) 위 ·
          currentAction = RULE-ACTION-BEGIN-001 이 대체 불가로 판정하는 행동 진행 중
          (어느 행동인지는 기존 Rule 이 소유한다 — build 가 관측된 State 에 적는다)
  When    (a) interaction transit(targetEntityId = DEEP_TRAIL) 를 요청한다
          (b) 같은 행동 중에 ANCIENT_GATE anchor 옆에서 transit(ANCIENT_GATE) 를 요청한다
  Then    (a) Request.Outcome = 거절 · reason = action-busy · regionId = FOREST_DEEP 그대로
          (b) Request.Outcome = 거절 · reason = connector-inactive (순서 ④ < ⑥)
  실측    PASS
  관측된 State  대체 불가 행동 중 열린 출구 → action-busy · 같은 행동 중 닫힌 문 → connector-inactive (④ < ⑥)

S-015  (SPEC-006) 여섯 사유가 모두 관측된다 — 한 벌로 모은다
  Given   S-009 ~ S-014 의 배치들
  When    각각의 요청을 건다
  Then    관측된 reason 의 집합 = { unknown-connector, wrong-region, out-of-range,
                                    connector-inactive, region-not-built, action-busy } (여섯)
  실측    PASS
  관측된 State  여섯 사유 전부 실측되었다 — unknown-connector(S-009) · wrong-region(S-010) ·
                out-of-range(S-011) · connector-inactive(S-012) · region-not-built(S-013) · action-busy(S-014)

S-016  (SPEC-006 경계) 거절은 세계 State 를 하나도 바꾸지 않는다
  Given   Actor[player-1].regionId = FOREST_DEEP · position = ANCIENT_GATE anchor(−13, 13) 위 ·
          velocity = (0, 0) · currentAction = idle
  When    transit(ANCIENT_GATE) 를 요청하고 한 Tick 진행
  Then    Request.Outcome = 거절 · reason = connector-inactive
          Actor[player-1].regionId · position · velocity · currentAction 이 요청 전과 같다
          snapshot.scene = FOREST_DEEP 그대로
  실측    PASS
  관측된 State  connector-inactive 거절 전후의 몸 —
                전 { regionId FOREST_DEEP, position (−13,13), velocity (0,0), action idle }
                후 { regionId FOREST_DEEP, position (−13,13), velocity (0,0), action idle } — 같다
```

### SPEC-007 · 출구 표식이 열림과 닫힘으로 갈린다

```text
S-017  (SPEC-007) region-exit 의 kind 는 Connector 의 transition 그대로다
  Given   S-003 의 관찰들
  When    exits(R) 의 { id → kind } 를 모은다
  Then    FOREST_PATH road · RUIN_TRAIL trail · DEEP_TRAIL trail · NEST_TRAIL trail ·
          ORE_TRAIL trail · TREE_APPROACH interaction · ORE_TREE_TRAIL trail ·
          ANCIENT_GATE door · RED_WASTE_PASS pass · ICE_CANYON_PASS pass
          kind 값의 가짓수 = 5 (road · trail · door · pass · interaction)
  실측    PASS
  관측된 State  관찰된 kind — road(FOREST_PATH) · trail(RUIN/DEEP/NEST/ORE/ORE_TREE) ·
                interaction(TREE_APPROACH) · door(ANCIENT_GATE) · pass(RED_WASTE_PASS · ICE_CANYON_PASS)

S-018  (SPEC-007 경계) 경계를 가리키는 출구도 state = open 이다 — 목적지는 건너 봐야 안다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN (기본 배치)
  When    관찰한다
  Then    exits(WHITE_KING_DOMAIN)[id=RED_WASTE_PASS].state = open · kind = pass
          exits(WHITE_KING_DOMAIN)[id=ICE_CANYON_PASS].state = open · kind = pass
          (둘 다 짓지 않은 방을 가리키는데 표식은 열림이다)
          BIO_ORE_FIELD 의 ORE_TREE_TRAIL · FOREST_DEEP 의 TREE_APPROACH 도 state = open
          snapshot 어디에도 frontier 목록이 없다 — 문자열로 직렬화해도 값 하나로 실린
          RED_WASTE · ICE_CANYON · RED_EYE_TREE · FANTASY_MAZE 가 없다
          (Connector 의 id 인 RED_WASTE_PASS · ICE_CANYON_PASS 는 C001 SPEC-007 대로 실린다 —
           금지된 것은 경계로 밝힌 **방 이름**이다)
  실측    PASS
  관측된 State  경계를 가리키는 넷 — RED_WASTE_PASS/open · ICE_CANYON_PASS/open ·
                TREE_APPROACH/open · ORE_TREE_TRAIL/open. locked 는 ANCIENT_GATE 하나뿐이다.
                FOREST_DEEP 의 관찰 결과에 값 "RED_EYE_TREE" · "FANTASY_MAZE" 가 하나도 없다
```

### SPEC-008 · 다섯 출구의 방

```text
S-019  (SPEC-008) 숲 안쪽은 출구가 다섯이고 그 중 하나만 잠겨 있다
  Given   관찰자의 몸이 백왕령 → 숲 가장자리 → 숲 안쪽으로 건너간다
  When    FOREST_DEEP 에서 관찰한다
  Then    snapshot.scene = FOREST_DEEP · snapshot.region.id = FOREST_DEEP
          exits(FOREST_DEEP).length = 5
          그 중 state = locked 인 것은 ANCIENT_GATE 하나 · kind = door
          나머지 넷(DEEP_TRAIL · NEST_TRAIL · ORE_TRAIL · TREE_APPROACH)은 state = open
          interactions 중 id = transit 인 항목이 다섯이고 targetEntityId 가 그 다섯 Connector 다
          hud[id=region.depth].value = wild
          snapshot 을 문자열로 직렬화해도 목적지 Region 의 id 가 나오지 않는다 —
          FOREST_EDGE · PREDATOR_NEST · BIO_ORE_FIELD · RED_EYE_TREE · FANTASY_MAZE 없음
  실측    PASS
  관측된 State  FOREST_DEEP 관찰 — exits 다섯
                DEEP_TRAIL/open/trail@0,−18 · NEST_TRAIL/open/trail@−18,0 · ORE_TRAIL/open/trail@18,0 ·
                TREE_APPROACH/open/interaction@0,18 · ANCIENT_GATE/locked/door@−13,13.
                transit interaction 다섯 · hud region.depth = wild · 목적지 이름 없음

S-020  (SPEC-008 경계) 막다른 방 셋 — 돌아가는 출구뿐이고 방은 비어 있다
  Given   관찰자의 몸이 EXPLORER_RUIN · PREDATOR_NEST · BIO_ORE_FIELD 에 차례로 들어간다
  When    각 방에서 관찰한다
  Then    EXPLORER_RUIN  entities = 관찰자 자신 1 + region-exit 1 (RUIN_TRAIL · trail · (18, 0)) 뿐
          PREDATOR_NEST  entities = 관찰자 자신 1 + region-exit 1 (NEST_TRAIL · trail · (18, 0)) 뿐
          BIO_ORE_FIELD  entities = 관찰자 자신 1 + region-exit 2 (ORE_TRAIL · ORE_TREE_TRAIL) 뿐
          세 방 모두 npc-character 0 · resource-deposit 0 · other-player-character 0
          세 방 모두 hud[id=region.depth].value = wild
          돌아가는 Connector 로 다시 요청하면 수락되고 숲 안쪽의 그 anchor 자리에 선다
  실측    PASS
  관측된 State  BIO_ORE_FIELD — region-exit 아닌 존재는 player-1 하나뿐 · exits 둘(ORE_TRAIL · ORE_TREE_TRAIL).
                EXPLORER_RUIN · PREDATOR_NEST 는 exits 하나뿐이고, 돌아가는 요청은 성공한다
```

### SPEC-009 · Graph 정합 검사가 경계와 닿음을 안다

```text
S-021  (SPEC-009) 이 Cycle 의 데이터로 검사를 돌리면 오류가 없다
  Given   content/regions 의 Description 들 · Graph · anchor layer · 시작 방 WHITE_KING_DOMAIN
  When    정합 검사를 돌린다
  Then    오류 0 —
            경계(frontier)를 가리키는 끝은 unknown-region 도 missing-anchor 도 아니다 ①
            검사는 읽기 전용이다 — 두 번 돌려도 결과가 같고 데이터가 바뀌지 않는다
  실측    PASS
  관측된 State  checkGraph(REGION_SPECS.space, REGION_GRAPH, 'anchor', WHITE_KING_DOMAIN) = [] (오류 0).
                reachableRegions = 지어진 여섯 전부. 두 번 돌려도 같다 (읽기 전용)

S-022  (SPEC-009 ②③④) 잘못된 데이터는 잡힌다 — frontier-built · unused-frontier · unreachable
  Given   이 Cycle 의 데이터를 셋으로 비틀어 본다
          (a) frontiers 에 지어진 방(WHITE_KING_DOMAIN)을 넣는다
          (b) frontiers 에 아무 Connector 도 가리키지 않는 이름을 넣는다
          (c) FOREST_PATH Connector 를 뺀다 (시작 방에서 나머지 다섯에 닿지 않게 된다)
  When    각각 정합 검사를 돌린다
  Then    (a) 오류에 frontier-built 가 있다
          (b) 오류에 unused-frontier 가 있다
          (c) 오류에 unreachable 이 있다 — 닿음은 지어진 방들 사이에서만 센다
  실측    PASS
  관측된 State  일부러 어긋낸 데이터에서 frontier-built · unused-frontier · unreachable 이 각각 잡힌다
```

### SPEC-010 · 영속과 이전 세계

```text
S-023  (SPEC-010) STATE_VERSION 이 올라가지 않는다 · 방과 Graph 는 저장되지 않는다
  Given   관찰자의 몸이 FOREST_DEEP 에 서 있다
  When    세계를 스냅샷으로 저장하고 되살린 뒤 관찰한다
  Then    스냅샷의 STATE_VERSION 문자열 = "hkt-adv-proto-i/2" (C001 과 같다 — 형이 바뀌지 않았다)
          스냅샷의 State 에 regions · graph · frontiers · closedConnectors · bounds 가 없다
          되살린 Actor[player-1].regionId = FOREST_DEEP · position 이 저장 때와 같다
          되살린 뒤에도 World.regions 는 여섯 · World.graph.connectors 는 열 (컨텐츠 데이터에서 다시 온다)
          되살린 뒤 관찰: snapshot.scene = FOREST_DEEP · exits 다섯 · ANCIENT_GATE 만 locked
  실측    PASS
  관측된 State  STATE_VERSION = 'hkt-adv-proto-i/2' (C001 과 같다). 스냅샷 왕복 후 몸이 FOREST_DEEP 에 그대로 선다

S-024  (SPEC-010) C001 에서 저장된 스냅샷도 그대로 되살아난다
  Given   C001 의 방 둘만 쓰는 상태로 저장된 스냅샷 (몸이 FOREST_EDGE · npc 둘과 광맥은 WHITE_KING_DOMAIN)
  When    C002 의 세계로 되살리고 관찰한다
  Then    복구가 성립한다 (restore 결과가 null 이 아니다)
          Actor[player-1].regionId = FOREST_EDGE · npc 둘과 Deposit 의 regionId = WHITE_KING_DOMAIN
          snapshot.scene = FOREST_EDGE · exits(FOREST_EDGE).length = 3 (C002 의 데이터가 실린다)
  실측    PASS
  관측된 State  방 둘만 쓰던 C001 스냅샷(몸이 FOREST_EDGE)이 여섯 방의 세계에서 그대로 복구된다

S-025  (SPEC-010 경계) 여섯 방 어느 것도 아닌 regionId 는 데이터 오류다
  Given   Actor 의 regionId 가 여섯 방 어느 것도 아닌 스냅샷
  When    그것으로 세계를 되살리고 관찰자가 들어와 관찰한다
  Then    세계가 그 State 를 조용히 받아들이지 않는다 — C001 의 throw 그대로 오류가 난다
  실측    PASS
  관측된 State  여섯 중 어느 것도 아닌 regionId 는 조용히 받아들여지지 않는다 (regionSpecOf 의 throw)
```

### 회귀 — C001 의 관찰 가능 행동이 그대로인가 (원본 §18 · CLAUDE.md 원칙 8)

```text
S-026  (회귀 · C001 SPEC-006) 백왕령 ⇄ 숲 가장자리 왕복이 그대로다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = FOREST_PATH anchor(0, 18) 위 ·
          currentAction = idle
  When    ① transit(FOREST_PATH) 요청 · 한 Tick   ② 다시 transit(FOREST_PATH) 요청 · 한 Tick
  Then    ① Request.Outcome = 수락 · regionId = FOREST_EDGE · position = (0, −18) ·
             velocity = (0, 0) · currentAction = idle · snapshot.scene = FOREST_EDGE ·
             hud[id=region.depth].value = outer
          ② Request.Outcome = 수락 · regionId = WHITE_KING_DOMAIN · position = (0, 18) ·
             snapshot.scene = WHITE_KING_DOMAIN · hud[id=region.depth].value = civil
          출구가 셋으로 늘어도 이 길의 판정은 C001 과 같다
  실측    PASS
  관측된 State  백왕령(civil) → FOREST_PATH 건너기 성공 → FOREST_EDGE(outer) → 되돌아가면 백왕령의 (0,18)

S-027  (회귀 · C001 SPEC-005) 멀리서 요청하면 out-of-range 다
  Given   Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 0) · currentAction = idle
          (anchor FOREST_PATH(0, 18) 까지 거리 18)
  When    관찰한다 · transit(FOREST_PATH) 를 요청한다
  Then    interactions[transit → FOREST_PATH].available = false · reason = out-of-range
          Request.Outcome = 거절 · reason = out-of-range
          Actor[player-1].regionId = WHITE_KING_DOMAIN · position = (0, 0) 그대로
  실측    PASS
  관측된 State  투영의 interactions[transit] 과 요청의 대답이 같은 사유(out-of-range)를 내고 State 는 그대로다

S-028  (회귀 · C001 SPEC-009) 다른 방의 몸은 서로 없는 것과 같다
  Given   Actor[player-1].regionId = FOREST_EDGE · position = (0, −18)
          Actor[player-2].regionId = WHITE_KING_DOMAIN · position = (0, −18)  (같은 좌표 · 다른 방)
  When    각각 관찰하고 세계가 여러 Tick 진행한다
  Then    snapshot(player-1).entities 에 player-2 없음 · snapshot(player-2).entities 에 player-1 없음
          두 몸의 position 이 그대로 · velocity = (0, 0) (서로 밀지 않는다)
          방이 여섯이 되어도 판정 대상 집합은 같은 regionId 안뿐이다 (02-world R5)
  실측    PASS
  관측된 State  같은 (x, z) 에 선 두 몸이 다른 방이면 서로의 관찰에 없고 밀지도 않는다

S-029  (회귀 · C001 SPEC-004) 이동의 경계는 그 몸이 선 방의 extent 다 — 새 방에서도 같다
  Given   Actor[player-1].regionId = FOREST_DEEP (새 방)
  When    (a) 이동 요청 목적지 (0, 0) · (b) 이동 요청 목적지 (0, 21)
  Then    (a) 수락 — 이동이 시작된다
          (b) 거절 · reason = out-of-bounds · Actor[player-1].position 이 그대로
          같은 판정이 EXPLORER_RUIN · PREDATOR_NEST · BIO_ORE_FIELD 에서도 나온다
  실측    PASS
  관측된 State  FOREST_DEEP 과 막다른 방 셋에서도 extent 안은 수락 · 밖은 out-of-bounds

S-030  (회귀 · C001 SPEC-010) 이전 버전의 스냅샷은 복구되지 않는다 — 새 세계
  Given   STATE_VERSION 이 "hkt-adv-proto-i/2" 가 아닌 스냅샷
  When    그것으로 복구를 시도한다
  Then    복구 결과가 null 이다 (세계는 초기 배치로 시작한다)
          이어서 새 세계에 관찰자가 들어오면 regionId = WHITE_KING_DOMAIN · scene = WHITE_KING_DOMAIN
  실측    PASS
  관측된 State  버전이 다른 스냅샷은 복구되지 않는다 — 세계는 초기 배치로 시작한다
```

## 2. 완료 조건 7항

```text
[x] Design Trace   RegionGraphRooms Cycle Breakdown 둘째 항목 → 00-cycle → 01-spec → 02-world.
                   방 이름·depth 배정·경계 넷은 Play 의 확정 사항 1·2·5 와 L2-World-Region §5 이름 표에서 왔다
[x] Scope          방을 둘에서 여섯으로, Connector 를 하나에서 열로 늘리고 연결에 종류(다섯)·방향(둘)·
                   활성(둘)·경계(아직 짓지 않은 곳)를 세웠다. 건너기의 거절이 넷에서 여섯이 된다
[x] Semantic       World.graph.frontiers · World.closedConnectors · Connector.isBuilt · isOpen ·
                   Region.depth 값 wild — 전부 02-world State 절에 점 경로로 있다
[x] Rule           RULE-REGION-TRANSIT-001 의 전제 둘 추가와 사유 순서 여섯이 01-spec SPEC-006 에 닫혀 있고,
                   S-009~S-016 이 여섯 사유를 하나씩 관측했다
[x] Implementation content/regions(방 넷·Connector 아홉) · rules/transit · projection/observer-view ·
                   view 의 표 셋 · engine/world-authoring 의 검사. npm test 658 통과 · npm run build 통과
[x] Observable     출구의 state(open|locked) · kind(다섯) · transit 의 reason(여섯) · hud region.depth(wild) 가
                   전부 관찰 결과에서 직접 읽힌다. 실주행으로 백왕령 → 광석 지대까지 걸어 관측했다
[x] Verification   자동 시나리오 30(테스트 42) 전부 PASS · 실측값이 §1 에 기입되어 있다.
                   §3 실주행 관찰(X-①~⑨)의 판정만 Human 에게 남는다
```

## 3. Experience Verification (Human 판정)

00-cycle 의 Experience Intent 와 Observable Result ①~⑧ 을 실주행 관찰 항목으로 옮긴다.
`npm run dev` (또는 `scripts/run.*`) 로 세계 + 클라이언트를 띄우고 아래 순서로 한 바퀴 돈다.
건너기 키는 `Q` 다. 판정 `[ ]` 은 Human 이 채운다.

```text
Start   길은 하나뿐인 줄 알았다. 나가는 곳이 셋인데 어디로 가는지는 모른다.
End     세계에는 갈 수 있는 곳, 아직 없는 곳, 잠긴 곳이 있다. 이름은 없고 종류만 있다.
        나는 그 중 몇 개만 열어 보았고 남은 것이 더 많다.
```

```text
X-①  백왕령에 출구가 셋 보인다 (Observable ①)
     하기   접속 직후 카메라를 움직여 백왕령 전체를 본다
     보기   출구 표식이 셋이다 — 북쪽 변(0, 18) 하나 · 동쪽 변(18, 0) 하나 · 서쪽 변(−18, 0) 하나.
           북쪽 하나는 C001 의 "길" 이고 동·서 둘은 그와 다른 종류("고개") 로 보인다 —
           표식의 색/모양이 종류마다 다르다. 어느 표식에도 목적지 이름이 없다
     판정   [ ]

X-②  고개로 건너려 하면 "아직 갈 수 없는 곳" 이라 한다 (Observable ②)
     하기   동쪽 표식(18, 0) 바로 옆까지 걸어가 `Q` 를 누른다. 이어서 서쪽 표식(−18, 0) 에서도 같이 한다
     보기   두 번 다 거절 문구가 온다 — "아직 갈 수 없는 곳이다" (region-not-built).
           몸은 그 자리 그대로이고 바닥 색·방 이름·HUD 가 하나도 바뀌지 않는다
     판정   [ ]

X-③  숲 가장자리의 출구가 셋으로 늘었다 (Observable ③)
     하기   북쪽 표식(0, 18)으로 걸어가 `Q` 로 건넌다. 도착한 방을 둘러본다
     보기   방 이름이 "숲 가장자리" 로 바뀌고 바닥 색이 달라졌다. 출구 표식이 셋 보인다 —
           돌아가는 길(내가 선 남쪽 자리) · 북쪽 하나 · 서쪽 하나. 셋의 종류가 같지 않다
     판정   [ ]

X-④  숲 안쪽은 색과 깊이가 또 다르다 (Observable ④)
     하기   숲 가장자리의 북쪽 표식(0, 18)까지 걸어가 `Q` 로 건넌다
     보기   바닥 색이 앞의 두 방과 또 다르다. 방 이름이 "숲 안쪽" 이고
           HUD 의 깊이가 "야생" 을 읽는다 (백왕령 · 숲 가장자리와 다른 문구)
     판정   [ ]

X-⑤  숲 안쪽에 출구가 다섯이고 그 중 하나는 닫힌 표식이다 (Observable ⑤)
     하기   숲 안쪽에서 카메라를 돌려 방 전체를 본다
     보기   표식이 다섯이다 — 남(0, −18) · 서(−18, 0) · 동(18, 0) · 북(0, 18) ·
           그리고 북서 안쪽 모서리(−13, 13) 하나. 마지막 하나는 나머지 넷과 눈에 띄게 다르다
           (닫힌 표식). 다섯 중 어느 것에도 목적지 이름이 없다
     판정   [ ]

X-⑥  닫힌 문은 "잠겨 있다" 고 한다 (Observable ⑥)
     하기   북서 모서리의 닫힌 표식(−13, 13) 옆까지 걸어가 `Q` 를 누른다
     보기   거절 문구가 온다 — "잠겨 있다" (connector-inactive).
           몸은 그 자리 그대로이고 방도 바뀌지 않는다
     판정   [ ]

X-⑦  막다른 방 셋을 드나든다 (Observable ⑦)
     하기   숲 안쪽에서 ① 서쪽 표식(−18, 0)으로 건너갔다 `Q` 로 돌아오고
           ② 동쪽 표식(18, 0)으로 건너갔다 `Q` 로 돌아온다
           ③ 숲 가장자리로 되돌아가(남쪽 표식) 서쪽 표식(−18, 0)으로 건너갔다 돌아온다
     보기   세 방 모두 비어 있다 — 사람도 짐승도 광맥도 없다. 돌아가는 표식이
           ①③ 은 하나뿐이고, ② (광석 지대) 만 둘이다. 셋 다 바닥 색이 "야생" 이다
     판정   [ ]

X-⑧  여섯 방을 지나는 동안 화면이 여섯 번 바뀌고 다른 방은 보이지 않는다 (Observable ⑧)
     하기   X-① ~ X-⑦ 을 이어서 한 번에 한다
     보기   방을 건널 때마다 (a) 바닥 색 (b) 방 이름 (c) 몸의 자리가 한 번에 바뀐다.
           백왕령 밖 어디에서도 백왕령의 사람 둘과 광맥이 보이지 않는다.
           돌아오면 그것들이 다시 보인다
     판정   [ ]

X-⑨  Intent — Start → End
     하기   위 한 바퀴를 마친 뒤 지금까지 본 것을 떠올린다
     보기   Start(나가는 곳이 셋인데 어디로 가는지 모름)에서
           End(갈 수 있는 곳 · 아직 없는 곳 · 잠긴 곳이 있고, 이름은 없고 종류만 있으며,
           열어 본 것보다 남은 것이 더 많음)로 체험이 이어진다
     판정   [ ]
```
