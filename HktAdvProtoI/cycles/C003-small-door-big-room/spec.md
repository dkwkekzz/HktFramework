# C003 — 작은 문, 큰 방, 돌아올 수 없는 길

```text
CYCLE          C003-small-door-big-room
SOURCE         content/roadmap/play/RegionGraphRooms.md (Cycle Breakdown 셋째 항목 · §5.5~§5.7 · §5.8 · 확정 사항 3·4 · §6 V4) ·
               content/roadmap/L2-World-Region.md §5(R5 중첩) · §10(direction · transition)
SELECTED_FROM  Play Cycle Breakdown — "C003 — 작은 문, 큰 방, 돌아올 수 없는 길"
```

범위(Playable Goal ~ Out of Scope)는 design 이 Play 에서 잘라 쓴다. 명세(SPEC ~ UNRESOLVED)는 cycle 이 덧붙여 동결한다.

## Playable Goal

숲 안쪽에서 붉은 눈의 거목(작은 방)에 들어가 문을 건너면 지금까지 어느 방보다 큰 내부 세계(deep)에 서고, 그 방의
어느 출구에 닿는 순간 요청 없이 심장 호수로 떨어지며, 올라갈 출구가 없어 남은 물길로 나오면 숲 안쪽의 **다른 자리**다 —
거기서 되짚어 백왕령까지 돌아오면 Play Goal 이 성립한다 (scene 여섯 이상 · depth 셋 · 남은 출구 하나 이상).

## Experience Intent

```text
Start   방은 다 비슷한 크기고, 건넌 길은 되돌아올 수 있다.
End     안이 밖보다 크다. 돌아갈 수 없는 길이 있고, 그러면 남은 길이 답이다. 나온 곳은 들어간 곳이 아니다 —
        연결에는 종류가 있다: 길 · 문 · 추락 · 물길.
```

Play 의 Breath 중 **발견 → 방향 상실 → 이해 → 귀환 → 새로운 미지** 구간. 이 Cycle 로 Play 의 Breath 가 끝까지 이어진다.

## World Change

```text
① 방이 셋 는다 — RED_EYE_TREE(wild, 작은 방) · TREE_INNER_WORLD(deep, 80×80 — 확정 4) · HEART_LAKE(deep)
② 중첩 — TREE_INNER_WORLD 의 parent = RED_EYE_TREE. Spatial Embedding 없음 — 자식이 부모보다 크다 (R5)
③ Connector 가 는다 — FOREST_DEEP ⇄ RED_EYE_TREE(interaction) · BIO_ORE_FIELD ⇄ RED_EYE_TREE(trail) ·
   RED_EYE_TREE ⇄ TREE_INNER_WORLD(door) · TREE_INNER_WORLD → HEART_LAKE(falling, one-way) ·
   HEART_LAKE → FOREST_DEEP(river, one-way, FOREST_DEEP 의 다른 anchor)
④ 일방향 — direction = one-way 면 역방향 anchor 가 없다. 도착 방의 들어온 자리에는 anchor 가 없다
⑤ 추락 — transition = falling 은 요청 없이 anchor 에 닿는 것만으로 전이된다 (W4)
⑥ depth 태그가 는다 — deep
```

## Observable Result

```text
① 거목(작은 방)에서 문을 건너면 큰 방이다 — 바닥이 화면보다 넓고, 색과 깊이 문구가 deep 으로 바뀐다
② 카메라가 방 extent 에 맞는다 — 큰 방은 넓게 (V4)
③ 내부 세계의 어느 표식에 닿으면 키를 누르지 않았는데 심장 호수에 서 있다 (추락)
④ 심장 호수에는 올라갈 표식이 없다 — 표식이 하나뿐 (물길)
⑤ 물길을 건너면 숲 안쪽이다 — 몸이 선 자리가 거목 쪽 표식이 아니다
⑥ 되짚어 백왕령에 오면 붉은 황야 쪽 · 얼음 협곡 쪽 표식이 그대로 남아 있다 (Play Goal 의 셋째 확인)
```

## Reuse

### Existing (그대로 쓴다)

```text
C001 · C002 의 전부 — Region · Graph · 건너기(활성 상태 · 사유 코드) · transition 종류 표식 · depth 색/문구 · 투영 · 카메라 장치
```

### Added (이 Cycle 이 세운다)

```text
World      Region.parent(중첩) · Connector.direction 판정(one-way 는 역방향 없음) · falling 전이(요청 없이 — 세계 Tick 이 판정) ·
           도착 anchor 만 있는 Connector
Data       content/regions/ 방 셋 · graph.ts Connector 다섯 · TREE_INNER_WORLD 의 extent 80×80 · parent
View       deep 색/문구 · falling · river · interaction 표식 · 카메라를 방 extent 에 맞춤
Engine     RegionGraph 형에 direction · parent 가 없으면 더한다 (world-authoring) · 카메라 extent 맞춤이 기구면 view-kernel/camera
```

## Out of Scope

```text
데이터만으로 방을 더하고 문을 여는 것의 실측 · world:observe --graph   C004
심장 호수 안의 것(호수에 비친 달 등) · 거목 안의 존재                  컨텐츠 층의 뒤 Play
높이 · 지형 · 실제 낙차                                              RoomBecomesLand — 추락은 Connector 종류일 뿐이다
```
