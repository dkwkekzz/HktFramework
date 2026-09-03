# C002 — CYCLE SPEC

```text
CYCLE          C002-many-exits
SOURCE         content/roadmap/play/RegionGraphRooms.md (Cycle Breakdown 둘째 항목 · §5.1 · §5.3 · §5.4 · §5.8 · §6 W4~W7, V1~V3, E1 · 확정 사항 1·2·4·5)
SELECTED_FROM  Play Cycle Breakdown — "[ ] C002 — 출구는 여럿, 목적지는 모른다"
PREV           00-cycle.md
```

**확장 Cycle** — C001 의 Semantic/Rule 위에 더한다. `cycles/C001-region-graph-rooms/02-world.md` 의
State·Rule 을 복사하거나 다시 쓰지 않는다. 여기 없는 것은 C001 그대로다.

Playable Goal · World Change · Observable Result · Out of Scope 는 00-cycle 이 소유한다.

## SPEC

```text
SPEC-001  방이 여섯이다
          조건   세계가 만들어진다
          기대   Region 이 여섯이다 — WHITE_KING_DOMAIN(civil) · FOREST_EDGE(outer) ·
                FOREST_DEEP(wild) · EXPLORER_RUIN(wild) · PREDATOR_NEST(wild) · BIO_ORE_FIELD(wild).
                새 방 넷은 전부 extent 40×40 (−20..20) 이고 자기 Local Space 를 가진다 (확정 4).
                depth 태그 값이 셋이 된다 — civil 1 · outer 1 · wild 4 (확정 2 의 wild 5 중 거목은 C003)
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
          경계   방 사이의 좌표는 서로 무관하다 (C001 SPEC-001) — 같은 tag 가 두 방에서 다른 자리다

SPEC-003  Connector 가 열이다
          조건   세계가 만들어진다
          기대   Graph 의 Connector 는 아래 열이고 이 순서다 (exitsOf 의 결정론이 이 순서를 따른다)
                  id               from                          to                              direction      transition
                  FOREST_PATH      WHITE_KING_DOMAIN.FOREST_PATH  FOREST_EDGE.FOREST_PATH          bidirectional  road
                  RUIN_TRAIL       FOREST_EDGE.RUIN_TRAIL         EXPLORER_RUIN.RUIN_TRAIL         bidirectional  trail
                  DEEP_TRAIL       FOREST_EDGE.DEEP_TRAIL         FOREST_DEEP.DEEP_TRAIL           bidirectional  trail
                  NEST_TRAIL       FOREST_DEEP.NEST_TRAIL         PREDATOR_NEST.NEST_TRAIL         bidirectional  trail
                  ORE_TRAIL        FOREST_DEEP.ORE_TRAIL          BIO_ORE_FIELD.ORE_TRAIL          bidirectional  trail
                  TREE_APPROACH    FOREST_DEEP.TREE_APPROACH      RED_EYE_TREE.FOREST_DEEP_SIDE    bidirectional  interaction
                  ORE_TREE_TRAIL   BIO_ORE_FIELD.TREE_TRAIL       RED_EYE_TREE.ORE_SIDE            bidirectional  trail
                  ANCIENT_GATE     FOREST_DEEP.ANCIENT_GATE       FANTASY_MAZE.ANCIENT_GATE        one-way        door
                  RED_WASTE_PASS   WHITE_KING_DOMAIN.RED_WASTE_PASS  RED_WASTE.WHITE_KING_SIDE     one-way        pass
                  ICE_CANYON_PASS  WHITE_KING_DOMAIN.ICE_CANYON_PASS ICE_CANYON.WHITE_KING_SIDE    one-way        pass
                그러므로 방마다 나갈 곳의 수는 백왕령 3 · 숲 가장자리 3 · 숲 안쪽 5 ·
                탐험대 폐허 1 · 포식수 둥지 1 · 생체 광석 지대 2 다 (§5.8 그대로)
          경계   짓지 않은 방(RED_EYE_TREE · FANTASY_MAZE · RED_WASTE · ICE_CANYON)에서 나가는 끝은
                아무에게도 실리지 않는다 — 그 방에는 몸이 설 수 없기 때문이다

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
                **요청의 대답**으로만 드러난다 — 목적지는 건너 봐야(물어봐야) 안다 (Play §5.1)

SPEC-008  다섯 출구의 방
          조건   관찰자의 몸이 FOREST_DEEP 에 있다
          기대   entities 에 role = region-exit 인 존재가 다섯이고, 그 중 ANCIENT_GATE 하나만
                state = locked · kind = door 다. interactions 에 transit 이 다섯 실린다.
                목적지 Region 의 id 와 이름은 어디에도 실리지 않는다 (C001 SPEC-007 그대로)
          경계   EXPLORER_RUIN · PREDATOR_NEST 에서는 region-exit 이 하나뿐이고 entities 에
                관찰자 자신 말고 아무 것도 없다

SPEC-009  Graph 정합 검사가 경계와 닿음을 안다
          조건   Description 들과 Graph 로 검사를 돌린다
          기대   ① 경계로 밝힌 region 을 가리키는 끝은 unknown-region 도 missing-anchor 도 아니다
                ② 경계로 밝혔는데 Description 이 있으면 오류다 (frontier-built) — 지어진 방은
                   경계 목록에서 빠져야 한다
                ③ 경계로 밝혔는데 아무 Connector 도 가리키지 않으면 오류다 (unused-frontier)
                ④ 시작 방(WHITE_KING_DOMAIN)에서 Connector 를 따라 닿지 않는 방이 있으면 오류다
                   (unreachable — 검사 ⑧). 닿음은 지어진 방들 사이에서만 센다
                이 Cycle 의 데이터로 검사를 돌리면 오류가 하나도 없다
          경계   검사는 세계를 바꾸지 않는 읽기 전용이다 (C001 그대로)

SPEC-010  영속과 이전 세계
          조건   세계를 스냅샷으로 저장하고 되살린다
          기대   STATE_VERSION 은 올라가지 않는다 — 스냅샷에 실리는 형이 하나도 바뀌지 않았다.
                방과 Graph 는 저장되지 않고 컨텐츠 데이터에서 다시 온다 (C001 R7).
                C001 에서 저장된 스냅샷도 그대로 되살아난다
          경계   되살린 몸의 regionId 가 여섯 방 중 하나가 아니면 데이터 오류다 (C001 의 throw 그대로)
```

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다:

```text
새 anchor 의 좌표          데이터다 (C001 선례). 방향만 Play §5.8 의 그래프 모양에서 왔다 —
                          숲으로 북, 돌아가는 길은 그 반대 변. 고대 문만 변이 아닌 안쪽 모서리 자리다
거절 사유의 순서            00-cycle Observable ②·⑥ 이 "붙어서 요청하면 거절이 온다" 이므로 거리가
                          닫힘·경계보다 앞이다. 멀리서도 사유가 보이면 걸어가 볼 이유가 사라진다
경계 출구의 표식            Play §5.1 "목적지는 건너야 안다" 를 지킨다 — 열림과 같게 둔다 (SPEC-007 경계)
붉은 황야·얼음 협곡의 방향   백왕령의 동/서. 방 사이 좌표는 무관하므로(R3) 지도의 방위가 아니라
                          "길이 아닌 두 곳" 이라는 것만 뜻한다
RED_EYE_TREE 쪽 두 Connector 를
C002 에 두는 것            Play §5.3 이 숲 안쪽의 출구를 다섯으로 못박았다. 방은 C003 이 짓는다 —
                          그때 Description 하나가 늘고 경계 목록에서 이름 하나가 빠질 뿐 Connector 는 그대로다
```
