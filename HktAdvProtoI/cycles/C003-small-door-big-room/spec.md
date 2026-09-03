# C003 — 작은 문, 큰 방, 돌아올 수 없는 길

```text
CYCLE          C003-small-door-big-room
SOURCE         content/roadmap/play/RegionGraphRooms.md §5.5 · §5.6 · §5.7 · §5.8 · §6 W4~W6 · V1~V4 · E1 ·
               확정 사항 1·2·3·4
               (근거: content/roadmap/L2-World-Region.md §7 중첩 Region 사슬 · §11 깊이의 미지 · §5 이름 표 ·
                content/roadmap/L2-World-Concept.md §3.2 depth 다섯)
SELECTED_FROM  Play Cycle Breakdown — "C003 — 작은 문, 큰 방, 돌아올 수 없는 길"
```

**확장 Cycle** — `cycles/C001-region-graph-rooms/spec.md` 와 `cycles/C002-many-exits/spec.md` 의
State/Rule 위에 더한다. 복사·재작성하지 않는다. 여기 없는 것은 그 둘 그대로다.

## Playable Goal

관찰자의 몸이 숲 안쪽에서 붉은 눈의 거목으로 들어가 **작은 문**을 건너면, 지금까지의 어느 방보다
**네 배 넓은 방**에 서고 시점이 그만큼 물러나 자기 몸이 작아진다. 그 방의 끝으로 걸어가면
**요청하지 않았는데 떨어져** 심장 호수에 선다 — 올라갈 출구가 없고 남은 것은 물길 하나다.
물길을 건너면 숲 안쪽으로 나오는데 **들어갔던 자리가 아니다**.

## Experience Intent

```text
Start   작은 문 하나가 나무 밑동에 있다. 들어가면 무엇이 있는지 모른다.
End     안이 밖보다 컸고, 끝까지 갔더니 떨어졌고, 떨어진 곳에는 돌아갈 길이 없었다.
        남은 길 하나를 건너니 아까 그 방인데 서 있는 자리가 다르다.
        연결에는 종류가 있다 — 어떤 것은 묻고 건너고, 어떤 것은 묻지 않고 데려간다.
```

Play 의 Breath 중 **발견 → 방향 상실 → 이해** 구간을 만든다. 귀환과 새로운 미지는 C002 가 지은
방들을 되짚는 것이므로 새로 짓는 것이 없다.

## World Change

```text
① 방이 여섯에서 아홉이 된다 — RED_EYE_TREE(wild) · TREE_INNER_WORLD(deep) · HEART_LAKE(deep).
   depth 태그에 deep 이 처음 나온다 (civil · outer · wild · deep 네 단계 · 확정 2 의 배정이 완성된다)
② 방의 크기가 방마다 다를 수 있게 된다 — TREE_INNER_WORLD 만 80×80 이고 나머지 여덟은 40×40 (확정 4).
   방 크기는 이미 Region 마다의 extent 였다 (C001) — 이 Cycle 이 처음으로 **다른 값을 쓴다**
③ 중첩(Containment)이 세계 데이터에 처음 선다 — TREE_INNER_WORLD 의 부모는 RED_EYE_TREE 이고
   HEART_LAKE 의 부모는 TREE_INNER_WORLD 다 (L2-World-Region §7 의 사슬).
   Spatial Embedding 은 없다 — 자식이 부모보다 크다
④ Connector 가 열에서 열셋이 된다 — 종류가 다섯에서 일곱으로 (falling · river 추가)
⑤ **요청 없이 일어나는 전이**가 생긴다 — transition 이 falling 인 Connector 는 그 anchor 에
   닿는 것만으로 건너진다. 세계가 묻지 않고 데려간다 (Play §5.6)
⑥ **돌아갈 수 없는 자리**가 생긴다 — 심장 호수에 떨어진 자리는 anchor 이되 어느 Connector 도
   그리로 되돌아오지 않는다. 그 방에서 나가는 끝은 물길 하나다
⑦ 한 방으로 **다른 자리로** 들어갈 수 있게 된다 — 물길은 숲 안쪽의 RIVER_MOUTH 로 나온다.
   거목으로 나갔던 TREE_APPROACH 와 다른 자리다
⑧ 경계(frontier)가 하나 줄어든다 — RED_EYE_TREE 가 지어져 목록에서 빠진다.
   Connector 둘(TREE_APPROACH · ORE_TREE_TRAIL)은 **손대지 않는다** (C002 가 예고한 그대로)
⑨ 검사가 중첩을 안다 — 자식마다 부모와 잇는 Connector 가 있는가 (검사 ⑥)
```

## Observable Result

```text
① 붉은 눈의 거목 방에 출구 표식이 셋 보인다 — 그 중 하나(안으로 드는 문)는 방 한가운데 가까이 있다
② 그 문을 건너면 바닥 색이 또 바뀌고(deep) HUD 깊이가 "법칙이 낯설어지는 심부" 를 읽는다
③ 같은 화면에서 **몸이 작아진다** — 시점이 물러나 방이 넓게 잡힌다. 바닥 테두리가 훨씬 멀다
④ 그 방의 반대편 끝으로 걸어가면 `Q` 를 누르지 않았는데 scene 이 바뀐다 — 심장 호수다
⑤ 심장 호수에는 출구 표식이 **하나뿐**이다. 떨어져 선 자리에는 아무 표식도 없다
⑥ 그 하나(물길)를 건너면 숲 안쪽이다 — 바닥 색과 방 이름이 아까 그 방인데 **선 자리가 다르다**.
   출구 다섯이 다시 보이고 그 중 하나는 여전히 닫힌 표식이다
⑦ 거목 내부 세계와 심장 호수를 지나는 동안 다른 방의 몸·광맥은 한 번도 보이지 않는다
⑧ 백왕령까지 되짚어 돌아오면 아직 건너지 않은 출구 둘(고개)이 그대로 남아 있다
```

## Reuse

### Existing (그대로 쓴다)

```text
RULE-REGION-TRANSIT-001 의 전제·전이 전부 (C002 까지) · RULE-MOVE-001 의 extent 경계 ·
Region 별 투영 · region-exit 존재와 transit interaction · region-exit 의 state(open | locked) ·
Request.Outcome 사유 코드 경로 · hud region.depth · 방 바닥 polygon 과 depth 색 표 ·
출구 표식 sprite 와 transition 색 표 · RegionSpec 형 · ANCHOR_LAYER · exitsOf 의 순서 결정론 ·
FRONTIER_REGIONS · CLOSED_CONNECTORS · 세계 영속 · 다중 관찰자 ·
engine/world-authoring 의 Description · Graph · 검사 다섯 · engine/view-kernel 의 시점(orientation · follow)
```

### Added (이 Cycle 이 세운다)

```text
Data       content/regions/{red-eye-tree,tree-inner-world,heart-lake}.ts ·
           graph.ts 에 Connector 셋 · containment 둘 · FRONTIER_REGIONS 에서 RED_EYE_TREE 제거 ·
           forest-deep.ts 에 anchor RIVER_MOUTH 추가
World      RULE-REGION-FALL-001 (요청 없이 일어나는 전이 — Tick 시스템) ·
           RULE-REGION-TRANSIT-001 의 전이 부분을 둘이 함께 쓰는 자리로
Protocol   없음 — 봉투의 형은 바뀌지 않는다 (값의 가짓수만 는다)
View       depth deep 색과 문구 · 방 이름 셋 · transition 색 둘(falling · river) ·
           방 크기 → 시점 거리 (regionViewDistance)
Engine     checkGraph 의 검사 ⑥ (containment-unlinked) ·
           viewOffset 의 거리 인자 · ViewCamera.setDistance · SceneState.viewDistance
```

## Out of Scope

```text
데이터만으로 방을 더하는 것의 실측 · world:observe --graph 보고            C004
고대 문을 여는 규칙 · 무엇이 잠금을 푸는가 · 발견 상태                     RuleBoundRoom (C005~)
환상의 미로 · 붉은 황야 · 얼음 협곡의 방 자체                              이 Play 밖 (확정 5)
거목 내부 세계와 심장 호수 안의 내용물(물 · 생물 · 구조)                   4층 이후 — 방은 이름만 있고 비어 있다
떨어지는 동안의 시간 · 낙하 연출 · 낙하 피해                               없다 — 전이는 한 순간이다 (Out of Scope, 받을 자리 없음)
방 전체를 한 화면에 담는 시점 · 줌 조작                                    C002 이월 부채 그대로 (아래 UNRESOLVED 기본형)
높이 · 표면 · 경사 · scatter                                              RoomBecomesLand (C008~C010)
```

## SPEC

```text
SPEC-001  방이 아홉이고 깊이가 넷이다
          조건   세계가 만들어진다
          기대   Region 이 아홉이다 — C002 의 여섯 + RED_EYE_TREE(wild) · TREE_INNER_WORLD(deep) ·
                HEART_LAKE(deep). depth 값의 배정은 civil 1 · outer 1 · wild 5 · deep 2 다 (확정 2).
                extent 는 TREE_INNER_WORLD 만 −40..40 × −40..40 이고 나머지 여덟은 −20..20 × −20..20 이다 (확정 4)
          경계   새 방 셋에는 anchor 말고 아무 것도 없다 — 몸도 광맥도 놓이지 않는다

SPEC-002  새 anchor 는 아래 자리다
          조건   세계가 만들어진다
          기대   각 Region 의 Description 에 아래 anchor point 가 있다 (layer = anchor).
                한 Region 안에서 tag 는 유일하다
                  RED_EYE_TREE      FOREST_DEEP_SIDE(0, −18) · ORE_SIDE(18, 0) · INNER_DOOR(0, 6)
                  TREE_INNER_WORLD  OUTER_DOOR(0, −38) · FALL(0, 38)
                  HEART_LAKE        FALL_LANDING(0, 0) · RIVER(0, −18)
                  FOREST_DEEP       RIVER_MOUTH(14, −8)                        (C002 의 다섯에 더한다)
          경계   FOREST_DEEP 의 anchor 는 여섯이 되지만 그 방에서 나가는 끝은 다섯 그대로다 —
                RIVER_MOUTH 로 나가는 Connector 가 없기 때문이다 (SPEC-003)

SPEC-003  Connector 가 열셋이다
          조건   세계가 만들어진다
          기대   C002 의 열 뒤에 아래 셋이 이 순서로 이어진다 (exitsOf 의 결정론이 이 순서를 따른다)
                  id               from                         to                            direction  transition
                  TREE_INNER_DOOR  RED_EYE_TREE.INNER_DOOR      TREE_INNER_WORLD.OUTER_DOOR   bidir.     door
                  TREE_FALL        TREE_INNER_WORLD.FALL        HEART_LAKE.FALL_LANDING       one-way    falling
                  HEART_RIVER      HEART_LAKE.RIVER             FOREST_DEEP.RIVER_MOUTH       one-way    river
                그러므로 방마다 나갈 곳의 수는 백왕령 3 · 숲 가장자리 3 · 숲 안쪽 5 · 탐험대 폐허 1 ·
                포식수 둥지 1 · 생체 광석 지대 2 · 붉은 눈의 거목 3 · 거목 내부 세계 2 · 심장 호수 1 이다
          경계   C002 가 놓은 Connector 열은 하나도 바뀌지 않는다 — TREE_APPROACH · ORE_TREE_TRAIL 의
                끝(RED_EYE_TREE.FOREST_DEEP_SIDE · RED_EYE_TREE.ORE_SIDE)도 그대로다.
                방 하나가 지어졌을 뿐이다

SPEC-004  중첩이 세계 데이터에 있다
          조건   세계가 만들어진다
          기대   Graph 의 containment 가 둘이다 —
                  { parent: RED_EYE_TREE,     child: TREE_INNER_WORLD }
                  { parent: TREE_INNER_WORLD, child: HEART_LAKE }
                (L2-World-Region §7 의 사슬: 붉은 눈의 거목 → 거목 내부 세계 → 심장 호수)
          경계   중첩은 관찰 결과에 실리지 않는다 — 몸이 어느 방의 안쪽 방에 있는지는 화면이 말하지
                않는다. 이 Cycle 에서 중첩이 하는 일은 검사 ⑥ 뿐이고, 세계 규칙 중 무엇도 이 값을 읽지 않는다.
                Spatial Embedding 도 없다 — 자식의 extent 가 부모보다 넓어도 오류가 아니다

SPEC-005  안이 밖보다 크다
          조건   관찰자의 몸이 RED_EYE_TREE 에서 TREE_INNER_DOOR 로 건넌다
          기대   몸은 TREE_INNER_WORLD.OUTER_DOOR(0, −38) 에 선다. 그 방의 extent 는 한 변 80 으로
                건너오기 전 방(한 변 40)의 두 배이고, 몸이 갈 수 있는 넓이는 네 배다 —
                (0, 38) 은 이동이 받아들여지고 (0, 41) 은 out-of-bounds 로 거절된다 (RULE-MOVE-001 그대로)
          경계   되돌아가는 문(같은 Connector)은 RED_EYE_TREE.INNER_DOOR 로 나온다 — 들어간 자리다

SPEC-006  추락은 요청 없이 일어난다
          조건   관찰자의 몸이 TREE_INNER_WORLD 안에서 FALL anchor 로부터 INTERACTION_RANGE 이내에 있고,
                세계가 Tick 을 하나 돈다
          기대   아무 요청 없이 몸의 regionId 가 HEART_LAKE 로, position 이 FALL_LANDING(0, 0) 으로 바뀐다.
                velocity 는 (0, 0) 이고 currentAction 은 idle 이다 (건너기의 전이와 같다)
          경계   ① 진행 중인 행동이 있어도 떨어진다 — 추락은 행동이 아니므로 대체 가능성을 묻지 않는다
                ② 방금 떨어진 몸은 그 다음 Tick 에 다시 떨어지지 않는다 — 심장 호수에는 falling Connector 가 없다
                ③ transition 이 falling 이 아닌 Connector 의 anchor 위에 서 있어도 아무 일도 일어나지 않는다.
                   요청 없이 데려가는 것은 falling 하나뿐이다

SPEC-007  떨어진 자리에서는 돌아갈 수 없다
          조건   관찰자의 몸이 HEART_LAKE 에 있다
          기대   entities 에 role = region-exit 인 존재가 **하나**뿐이고 그 kind 는 river 다.
                interactions 에 transit 이 하나 실린다. 떨어져 선 자리(0, 0) 에는 표식이 없다
          경계   TREE_FALL 로 건너기를 요청하면 wrong-region 으로 거절된다 — 그 Connector 는 one-way 이고
                이 방에는 그 끝이 나갈 곳으로 서지 않는다 (C001 의 사유 그대로 · 새 사유가 아니다)

SPEC-008  물길은 다른 자리로 낸다
          조건   관찰자의 몸이 HEART_LAKE.RIVER 옆에서 HEART_RIVER 로 건너기를 요청한다
          기대   몸은 FOREST_DEEP 의 RIVER_MOUTH(14, −8) 에 선다 — 거목으로 나갔던
                TREE_APPROACH(0, 18) 와 다른 자리다. 그 방의 출구 다섯이 다시 실리고
                그 중 ANCIENT_GATE 하나만 state = locked 다 (C002 그대로)
          경계   FOREST_DEEP 에서 HEART_RIVER 로 되건너기를 요청하면 wrong-region 이다 — one-way 다

SPEC-009  검사가 중첩을 알고, 경계가 하나 줄었다
          조건   Description 들과 Graph 로 검사를 돌린다
          기대   ① containment 의 자식마다, 그 자식과 부모를 잇는 Connector 가 하나라도 있어야 한다.
                   없으면 오류다 (containment-unlinked — 검사 ⑥). 방향은 묻지 않는다 (추락은 one-way 다)
                ② RED_EYE_TREE 는 이제 Description 이 있으므로 경계 목록에 있으면 안 된다 (frontier-built).
                   남은 경계는 FANTASY_MAZE · RED_WASTE · ICE_CANYON 셋이고 셋 다 가리켜져 있다
                ③ 아홉 방 전부가 WHITE_KING_DOMAIN 에서 Connector 를 따라 닿는다 (unreachable 없음)
                이 Cycle 의 데이터로 검사를 돌리면 오류가 하나도 없다
          경계   검사는 세계를 바꾸지 않는 읽기 전용이다

SPEC-010  관찰 계약과 영속은 형이 그대로다
          조건   관찰 결과가 만들어지고, 세계를 스냅샷으로 저장하고 되살린다
          기대   봉투의 형이 하나도 바뀌지 않는다 — region-exit 의 kind 에 falling · river 가,
                hud region.depth 의 value 에 deep 이, scene 에 새 Region id 셋이 값으로 더해질 뿐이다.
                STATE_VERSION 은 올라가지 않고 C001 · C002 에서 저장된 스냅샷도 그대로 되살아난다.
                중첩 · 방 크기 · 시점 거리는 아무것도 저장되지 않는다
          경계   시점이 몸에서 떨어지는 거리는 세계로 나가지 않는다 — 관찰자가 자기 방 데이터를 읽어
                정한다 (원칙 2 · 시점 방향과 같은 성질)
```

## State

```text
World.regions[]                       REUSED — 값만 는다 (셋 추가)
  Region.depth                        REUSED — 값에 deep 이 더해진다 (civil | outer | wild | deep)
  Region.extent                       REUSED — 값이 방마다 다를 수 있음이 처음 쓰인다 (80×80 하나)

World.graph.containment[]             ADDED (형은 C001 부터 있었고 비어 있었다 — 값이 처음 든다)
  { parent, child }                   어떤 방을 통해 발견되며 세계관상 어디에 속하는가.
                                      Connectivity(Connector)와도 Spatial Embedding 과도 다른 관계다
                                      (L2-World-Region §7). 정적 컨텐츠 데이터 — 저장되지 않는다
World.graph.connectors[]              REUSED — 값만 는다 (셋 추가)
  Connector.transition                REUSED — 값에 falling · river 가 더해진다
World.graph.frontiers[]               CHANGED — RED_EYE_TREE 가 빠진다 (셋 남는다)

Actor.regionId · Actor.position       REUSED — 추락도 이 둘만 바꾼다 (건너기와 같은 전이)
```

이 Cycle 의 데이터 값 — SPEC-002 (anchor) · SPEC-003 (Connector) · SPEC-004 (중첩) 의 표가 원본이다.

```text
RED_EYE_TREE       depth wild   extent −20..20 × −20..20   anchor 셋
TREE_INNER_WORLD   depth deep   extent −40..40 × −40..40   anchor 둘     ← 이 Cycle 의 큰 방
HEART_LAKE         depth deep   extent −20..20 × −20..20   anchor 둘
containment        RED_EYE_TREE ⊃ TREE_INNER_WORLD ⊃ HEART_LAKE
frontiers          FANTASY_MAZE · RED_WASTE · ICE_CANYON
closed             ANCIENT_GATE                                          (C002 그대로)
```

## Rule

```text
R1  RULE-REGION-FALL-001                                                     ADDED
    IF   Actor A 가 선 Region 에서 나가는 끝 E 의 transition 이 falling 이고
         distance(A.position, E 의 이쪽 anchor) ≤ INTERACTION_RANGE 이고
         E 의 Connector 가 열려 있고 (CLOSED_CONNECTORS 에 없다) 이고
         건너간 뒤의 region 이 지어져 있다
    THEN A.regionId = 반대쪽 끝의 region · A.position = 반대쪽 anchor 의 자리 ·
         A.velocity = (0, 0) · A.currentAction = idle
    거절이 없다 — 요청이 아니기 때문이다. 대답할 상대가 없으므로 사유 코드도 없다.
    행동이 진행 중이어도 묻지 않는다 (RULE-ACTION-BEGIN-001 을 부르지 않는다) —
    떨어지는 것은 하기로 한 일이 아니다 (01-spec SPEC-006 경계 ①).
    한 Tick 에 한 몸은 한 번만 옮겨진다 — 옮긴 뒤 그 몸에 대한 판정을 멈춘다.
    Tick 진행 순서의 **맨 끝**이다: 이 Tick 의 자리가 다 정해진 뒤에 세계가 떨어질 사람을 본다

R2  RULE-REGION-TRANSIT-001                                                  CHANGED (전이 부분을 나눠 쓴다)
    THEN 전제와 사유 여섯은 C002 그대로. 전이(regionId · position · velocity · currentAction)만
         R1 과 같은 자리에서 일어난다 — 두 규칙이 같은 전이를 하되 묻는 것이 다를 뿐임을 코드가 말한다

R3  RULE-MOVE-001                                                            AFFECTED (대상 값만)
    THEN extent 판정은 그대로다. 방마다 extent 가 다르므로 같은 좌표가 어떤 방에서는 안이고
         어떤 방에서는 밖이다 — (0, 38) 은 거목 내부 세계 안이고 다른 여덟 방에서는 밖이다

R4  RULE-BODY-MOMENTUM-001 · RULE-BODY-PUSH-001 · RULE-SWING-STRIKE-001 ·
    RULE-NPC-DECIDE-001                                                      AFFECTED (대상 집합만 — 자동)
    THEN 방이 아홉이 되어도 판정은 그대로다. 같은 regionId 안에서만 서로를 본다

R5  관찰 투영 (projectObserver)                                              REUSED (변화 없음)
    THEN region-exit · transit · hud region.depth · region { id, hash } 전부 C002 그대로.
         falling 도 나가는 끝이므로 표식과 transit 이 실린다 — 특별한 자리를 두지 않는다.
         중첩 · 방 크기 · 경계 목록은 싣지 않는다

R6  Graph 정합 검사                                                          CHANGED (중첩을 본다)
    IF   containment 의 자식 C 와 그 부모 P 를 잇는 Connector 가 하나도 없다
    THEN containment-unlinked                                                 (검사 ⑥)
    나머지 검사 다섯은 C002 그대로

R7  영속                                                                     REUSED (변화 없음)
    THEN STATE_VERSION 그대로. 방·Graph·중첩·frontiers·closed 는 스냅샷에 없고 컨텐츠 데이터에서 다시 온다
```

## REUSED / ADDED

```text
REUSED   RULE-REGION-TRANSIT-001 의 전제·사유 여섯 · INTERACTION_RANGE · RULE-MOVE-001 의 extent 판정 ·
         role region-exit · region-exit 의 state · interaction transit · hud region.depth ·
         region { id, hash } · RegionSpec 형 · ANCHOR_LAYER · exitsOf 의 순서 결정론 ·
         FRONTIER_REGIONS · CLOSED_CONNECTORS · STATE_VERSION · 시점 방향(orientation)
ADDED    Region 셋 · depth 값 deep · Connector 셋 · transition 값 falling · river ·
         World.graph.containment 의 값 둘 · RULE-REGION-FALL-001 ·
         검사 코드 containment-unlinked · SceneState.viewDistance (기구)
CHANGED  RULE-REGION-TRANSIT-001 (전이 부분을 R1 과 나눠 쓴다 — 관찰 가능한 행동은 그대로) ·
         Graph 정합 검사 (검사 ⑥ 추가) · FRONTIER_REGIONS (하나 빠짐) ·
         forest-deep.ts (anchor 하나 추가)
AFFECTED RULE-MOVE-001 · RULE-BODY-* · RULE-SWING-STRIKE-001 · RULE-NPC-DECIDE-001 —
         전부 대상 값/집합만 (판정은 그대로)
```

## Observable (관찰 계약)

C001 · C002 의 계약에서 **바뀌는 것만** 적는다. 봉투의 **형은 하나도 바뀌지 않는다** — 값의
가짓수만 는다. 그래서 `content/protocol/` 은 이 Cycle 에서 손대지 않고 STATE_VERSION 도 그대로다.

```text
entities[role=region-exit].kind           += falling | river                                 (값 추가)
hud[id=region.depth].value                += deep                                            (값 추가)
snapshot.scene · snapshot.region.id       = 아홉 Region id 중 하나                            (값 추가)
```

투영하지 않는 것 — 중첩(어느 방의 안쪽 방인가) · 방의 extent 와 크기 · 목적지 region 의 id/이름 ·
Connector.direction · frontiers 목록 · closedConnectors 목록 · 다른 방의 존재 · Graph 전체 ·
추락이 일어났다는 사건 자체(scene 이 바뀐 것으로만 드러난다).

**방의 크기는 세계가 보내지 않는다.** 관찰자가 자기 `content/regions` 데이터를 읽어 바닥을 그리듯
(C001 · region.hash 로 대조), 시점 거리도 그 데이터에서 정한다 — 시점은 관찰자의 것이고 세계는
그것을 알지 않는다 (원칙 2 · 04 viewpoint.worldKnows: false).

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
추락이 걸리는 거리          INTERACTION_RANGE(2.0) 그대로 — 건너기가 쓰는 그 상수다. Play 는 "anchor 에
                          닿는 것만으로" 라고만 했고, 닿음의 기준을 세계가 이미 하나 가지고 있으므로
                          새 상수를 만들지 않았다
추락에 행동을 묻지 않는 것   Play §5.6 "요청 없이". 요청이 아니면 대답도 없고 거절도 없다 —
                          진행 중인 행동을 이유로 떨어지지 않는다면 그것은 사실상 요청이다
낙하 연출·시간·피해         없다. 전이는 한 순간이다 (건너기와 같다). Play 가 요구한 것은
                          "떨어지면 심장 호수" 라는 사실 하나다
새 anchor 의 좌표           데이터다 (C001 · C002 선례). 방향만 Play §5.8 의 모양에서 왔다 —
                          거목의 안으로 드는 문은 변이 아니라 방 안쪽(밑동)이고, 거목 내부 세계는
                          들어온 문과 추락이 서로 가장 먼 두 변이다 (그래서 "큰 방" 이 걸음으로 읽힌다).
                          RIVER_MOUTH 는 숲 안쪽의 네 변이 이미 찼으므로 안쪽 자리이고,
                          거목으로 나가는 TREE_APPROACH(0, 18) 와 가장 멀다
심장 호수의 도착 자리        방 한가운데(0, 0). 떨어진 자리는 변이 아니라 어디의 한복판이다 —
                          "올라갈 길이 없다" 가 사방으로 읽힌다
방 크기 → 시점 거리의 값     한 변 40 에 거리 15(지금 값) 를 맞춘 비례다 — 기존 여덟 방의 그림이
                          하나도 바뀌지 않고, 한 변 80 인 방에서만 거리가 30 이 된다.
                          "큰 방은 넓게" (Play V4) 를 지키는 가장 작은 규칙이며 표현의 결정이므로
                          View 가 소유한다 (원칙 2)
방 전체를 한 화면에 담는 것   하지 않는다 — C002 이월 부채 그대로 둔다. 이 Cycle 이 필요한 것은
                          "방마다 시점이 다르다" 이지 "방이 다 보인다" 가 아니다.
                          다 보이게 하면 큰 방이 작은 방과 같은 크기로 화면에 앉아 오히려
                          "안이 밖보다 크다" 가 사라진다
Connector 열둘 · 거목의 출구 둘  Play 산문(§5.5 · §5.8 끝줄)과 §5.8 그래프 그림이 어긋난다.
                          **그림을 따른다** — C002 가 이미 그림대로 열을 놓았고, 광석 지대에서
                          거목으로 가는 끝(ORE_TREE_TRAIL)이 그림에만 있기 때문이다.
                          그래서 Connector 는 열셋, 거목의 출구는 셋이다
containment 를 관찰에 싣지 않는 것  Play §5.5 의 관찰은 "작은 방에서 문을 건너니 큰 방이다" 뿐이다.
                          부모가 누구인지는 화면이 말하지 않는다 — 3층(주체가 무엇을 아는가)의 자리다
```
