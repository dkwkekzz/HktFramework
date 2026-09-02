# C001 — 방 둘과 길 하나

## Source

[content/roadmap/play/RegionGraphRooms.md](../../content/roadmap/play/RegionGraphRooms.md) — Cycle Breakdown 의 첫 항목.
이 Play 가 증명하는 축은 L2(세계 자체)이고, 이 Cycle 은 그 축의 **최소 형태**를 세운다.

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
