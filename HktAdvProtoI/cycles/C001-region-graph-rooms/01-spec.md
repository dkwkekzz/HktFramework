# C001 — CYCLE SPEC

```text
CYCLE          C001-region-graph-rooms
SOURCE         content/roadmap/play/RegionGraphRooms.md (Cycle Breakdown 첫 항목 · §5.1~§5.2 · §6 W1~W8, V1~V4, E1~E3)
SELECTED_FROM  Play Cycle Breakdown — "[ ] C001 — 방 둘과 길 하나"
PREV           00-cycle.md
```

Playable Goal · World Change · Observable Result · Out of Scope 는 00-cycle 이 소유한다. 여기는 그것을
참·거짓을 가릴 수 있는 문장으로 **폐쇄**한 것만 더한다.

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
          경계   일방향 · 닫힘 · 만들어지지 않은 Region 은 이 Cycle 에 없다 (00-cycle Out of Scope)

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

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (원본 §20 · 이 스킬의 "Design 침묵의 판정"):

```text
anchor 의 정확한 자리      데이터다 (SPAWN_POINTS 선례). 방향만 Design 이 준다 — WE §32 "South → 백왕령" 이므로
                          숲 가장자리의 남쪽 변, 백왕령의 북쪽 변. 좌표는 02-world 의 State 표가 적는다
건너는 순간의 행동         idle 로 되돌린다 — 새 방에서 진행 중이던 이동 목표는 뜻이 없다 (좌표계가 다르다)
건너는 순간의 물리 속도     0 — 방 사이에 관성은 없다. 세계 문법상 두 Local Space 는 이어져 있지 않다 (R3)
hash 의 산법              기구의 것 — build 가 정한다. 의미는 "같은 Description → 같은 값" 뿐이다
```
