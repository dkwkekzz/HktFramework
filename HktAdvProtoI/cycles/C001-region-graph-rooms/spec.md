# C001 — 방 둘과 길 하나

```text
CYCLE          C001-region-graph-rooms
SOURCE         content/roadmap/play/RegionGraphRooms.md (Cycle Breakdown 첫 항목 · §5.1~§5.2 · §6 W1~W8, V1~V4, E1~E3) ·
               content/roadmap/L2-World-Region.md §3 · §9 · §10 · content/roadmap/L2-World-Tool.md §3
SELECTED_FROM  Play Cycle Breakdown — "C001 — 방 둘과 길 하나"
```

이 Play 가 증명하는 축은 L2(세계 자체)이고, 이 Cycle 은 그 축의 **최소 형태**를 세운다.
범위(Playable Goal ~ Out of Scope)와 명세(SPEC ~ UNRESOLVED)를 한 파일에 둔다. UNRESOLVED 없음 → 동결.

## Playable Goal

관찰자의 몸이 백왕령에서 길의 표식으로 걸어가 건너기를 요청하면, 숲 가장자리라는 **다른 방**에 서고,
화면의 바닥 색과 방 이름이 바뀌며, 되돌아가면 백왕령의 같은 자리로 돌아온다.

## Experience Intent

```text
Start   여기가 세계의 전부처럼 보인다. 방 하나, 출구 하나.
End     세계는 방 하나가 아니다. 나는 문명의 경계를 넘었고, 그것이 색으로 보이며, 돌아올 수 있다.
```

Play 의 Breath 중 **익숙함 → 경계 → 호기심** 구간을 만든다. 나머지 구간은 C002 이후다.

## World Change

```text
① WorldPosition 이 둘이 된다 — ActorState 가 regionId 를 가진다. 지금까지 위치는 (x, z) 하나였다
② 세계가 Region 을 여럿 안다 — WorldState.regions. 각 Region 은 extent · depth · anchor 를 가진다
③ 세계가 Region Graph 를 안다 — content/regions/graph.ts 의 Connector 목록 (백왕령 ⇄ 숲 가장자리, 양방향, road)
④ 새 Rule — 건너기(RULE-REGION-TRANSIT-001): anchor 근처의 몸이 요청하면 상대 Region 의 anchor 자리로 옮긴다.
   멀면 거절(사유 코드)
⑤ 이동의 경계가 바뀐다 — WORLD_BOUNDS(전역 상수) → 그 몸이 선 Region 의 extent
⑥ 투영이 Region 으로 잘린다 — 관찰 결과에는 같은 Region 의 존재만 실린다. scene = regionId
⑦ STATE_VERSION 을 올린다 — 스냅샷에 regionId 가 실린다
```

지금 세계(`mining-field`)의 광맥·자율 존재·관찰자 자리는 백왕령의 배치로 옮긴다 — 규칙은 그대로 두고
자리만 Region 이 준다 ([L2-World-Region.md](../../content/roadmap/L2-World-Region.md) §5.3).

## Observable Result

```text
① 화면에 방의 바닥이 그려진다 — Region extent 만큼의 면. 백왕령과 숲 가장자리의 색이 다르다 (depth 태그)
② 방 이름이 보인다 — "백왕령" · "숲 가장자리"
③ 출구 표식이 보인다 — anchor 자리에 표식 하나. 목적지 이름은 없다
④ 건너면 화면이 바뀐다 — 다른 색 · 다른 이름 · 몸은 상대 anchor 자리
⑤ HUD 에 깊이가 읽힌다 — 문명권 / 문명의 경계를 넘었다 (사유 코드 → 문구)
⑥ 멀리서 건너기를 요청하면 거절이 온다 (Request.Outcome)
```

## Reuse

### Existing (그대로 쓴다)

```text
이동 · 몸 충돌 · 관찰자 참여/이탈 · 관찰 결과 봉투(GameViewSnapshot) · interaction 등록과 요청 경로 ·
요청의 대답(RequestOutcome) · HUD label · code-text 문구 표 · 세계 영속 · 다중 관찰자 · 카메라
```

### Added (이 Cycle 이 세운다)

```text
World      WorldState.regions · ActorState.regionId · RULE-REGION-TRANSIT-001 · extent 경계 이동 ·
           Region 별 투영 · STATE_VERSION 올림
Protocol   GameViewSnapshot.scene = regionId (형은 그대로 — 값의 의미가 바뀐다) · region { id, hash }
Data       content/regions/white-king-domain.ts · forest-edge.ts · graph.ts
View       방 바닥(SceneGroundZone polygon) · depth 색 표 · 방 이름 라벨 · 출구 표식 · 깊이 문구
Engine     E1 의 최소 — RegionDescription(extent · points) · RegionGraph 형 · 검사 ⑤⑦ (anchor 존재 · 이탈 있음)
           E2 SceneGroundZone.shape 에 polygon
```

## Out of Scope

```text
숲 안쪽 · POI 방 셋 · 거목 · 내부 세계 · 심장 호수      C002 · C003
닫힌 문 · 일방향 · 중첩                                C002 · C003
붉은 황야 · 얼음 협곡 Connector (거절 사유)              C002
데이터만으로 방을 더하는 것의 실측                        C004
높이 · 표면 · 경사 · scatter · 컴파일러의 지형 부분       RoomBecomesLand (C008~C010) — 방은 평평하다
Region Rule · Region State · 압력                       RuleBoundRoom (C005~C007)
발견 상태(누가 무엇을 아는가) · 지식으로 여는 문           3층
```

## SPEC

```text
SPEC-001  Region 이 있다
          조건   세계가 만들어진다
          기대   세계는 Region 둘을 안다 — WHITE_KING_DOMAIN(depth civil) · FOREST_EDGE(depth outer). 각각
                extent 40×40 (−20..20)이고 자기 Local Space 를 가진다. 두 Region 의 좌표는 서로 무관하다
                (같은 (x, z) 가 다른 자리다)

SPEC-002  Graph 가 있다
          조건   세계가 만들어진다
          기대   Connector 하나 FOREST_PATH — from WHITE_KING_DOMAIN 의 anchor FOREST_PATH ↔ to FOREST_EDGE 의
                anchor FOREST_PATH. direction = bidirectional · transition = road. anchor 는 각 Region 의
                한 자리(position)다

SPEC-003  몸은 자리를 가진다
          조건   관찰자가 처음 들어온다 / 세계가 자율 존재와 광맥을 처음 놓는다
          기대   모든 Actor 와 Deposit 은 regionId 를 가진다. 관찰자의 새 몸은 WHITE_KING_DOMAIN 에
                SPAWN_POINTS 로 놓인다. 기본 자율 존재 둘과 광맥 하나도 WHITE_KING_DOMAIN 에 있다.
                FOREST_EDGE 는 비어 있다 (C001 에서는 출구만 있다)

SPEC-004  이동의 경계는 방이다
          조건   몸이 이동을 요청한다
          기대   RULE-MOVE-001 전제 1 이 World.Bounds 가 아니라 **그 몸이 선 Region 의 extent** 로 판정된다.
                경계   extent 밖 목적지는 out-of-bounds 로 거절된다 (기존 사유 코드 그대로)

SPEC-005  건너기의 가용
          조건   관찰자의 몸이 자기 Region 의 어느 anchor 근처에 있다
          기대   그 anchor 를 이쪽 끝으로 갖는 Connector 마다 건너기 interaction 이 available = true 로 실린다.
                "근처" 는 INTERACTION_RANGE(기존 상수, RULE-MINE-001 과 같다) 이내다.
          경계   멀면 available = false · reason = out-of-range. 행동이 대체 불가면 reason = action-busy
                (RULE-ACTION-BEGIN-001 재사용). 요청해도 같은 사유로 거절된다 (Request.Outcome)

SPEC-006  건너기의 전이
          조건   가용한 건너기를 요청한다
          기대   몸의 regionId = 상대 Region · position = 상대 anchor 의 position · velocity = 0 ·
                currentAction = idle. 같은 Tick 의 관찰 결과부터 scene 이 상대 regionId 다.
                양방향 Connector 이므로 상대 anchor 에서 같은 Connector 로 건너면 원래 anchor 로 돌아온다.
          경계   일방향 · 닫힘 · 만들어지지 않은 Region 은 이 Cycle 에 없다 (Out of Scope)

SPEC-007  관찰은 방으로 잘린다
          조건   관찰자의 몸이 Region R 에 있다
          기대   ① scene = R 의 id
                ② entities 에는 R 에 있는 몸과 광맥만 실린다 — 다른 Region 의 것은 실리지 않는다
                ③ R 의 anchor 마다 존재 하나가 더 실린다 — role region-exit · id = 그 Connector 의 id ·
                   kind = transition(road) · position = anchor. 목적지 Region 의 이름은 어디에도 실리지 않는다
                ④ 봉투에 region { id: R.id, hash } 가 실린다. hash 는 R 의 Description 에서 결정적으로 나온다
                   (같은 Description → 같은 hash)
          경계   FOREST_EDGE 에서는 entities 가 관찰자 자신 + region-exit 하나뿐이다

SPEC-008  깊이가 읽힌다
          조건   관찰 결과가 만들어진다
          기대   hud 에 id = region.depth · kind = label · value = 그 Region 의 depth 태그(civil | outer) 가 실린다.
                문구(방 이름 · "문명의 경계를 넘었다")는 View 의 표가 정한다 — 세계는 태그만 준다

SPEC-009  다른 방의 몸은 서로 없는 것과 같다
          조건   두 몸이 다른 Region 에 있다
          기대   서로 밀지 않고(RULE-BODY-PUSH-001) · 휘두름에 맞지 않고(RULE-SWING-STRIKE-001) ·
                자율 존재의 인지 범위에 들지 않는다(RULE-NPC-DECIDE-001). 좌표가 겹쳐도 그렇다
          경계   같은 Region 이면 지금과 똑같이 판정된다 — 기존 Rule 은 바뀌지 않고 대상 집합만 좁아진다

SPEC-010  영속
          조건   세계를 스냅샷으로 저장하고 되살린다
          기대   STATE_VERSION 이 올라간다. 되살린 State 의 모든 몸·광맥이 regionId 를 가진다. 이전 버전의
                스냅샷은 복구되지 않는다 (기존 규칙 — 버려지고 새 세계)
```

전부 컨텐츠(팩)의 의미다. 기반은 여기 나오는 명사(방 · 백왕령 · 깊이 · 길)를 모른다 — 기구 추출은 실현 단계의 몫.

## State

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
    RULE-BODY-MOMENTUM-001 도 AFFECTED — 밀린 몸이 멈추는 경계가 World.bounds 에서 그 몸의 Region.extent 로
    (World.bounds 제거의 기술적 귀결 — 실현 단계의 IMPLEMENTATION GAP 으로 해소, 의미 변화 없음)

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
AFFECTED RULE-BODY-PUSH-001 · RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001 (같은 Region 안에서만) · RULE-BODY-MOMENTUM-001 (경계 = Region.extent)
```

## Observable (관찰 계약)

실현 단계가 그대로 protocol/ 로 옮긴다.

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

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (원본 §20 · 명세 단계의 "Design 침묵의 판정"):

```text
anchor 의 정확한 자리      데이터다 (SPAWN_POINTS 선례). 방향만 Design 이 준다 — WE §32 "South → 백왕령" 이므로
                          숲 가장자리의 남쪽 변, 백왕령의 북쪽 변. 좌표는 State 절의 표가 적는다
건너는 순간의 행동         idle 로 되돌린다 — 새 방에서 진행 중이던 이동 목표는 뜻이 없다 (좌표계가 다르다)
건너는 순간의 물리 속도     0 — 방 사이에 관성은 없다. 세계 문법상 두 Local Space 는 이어져 있지 않다 (R3)
hash 의 산법              기구의 것 — 실현 단계가 정한다. 의미는 "같은 Description → 같은 값" 뿐이다
```
