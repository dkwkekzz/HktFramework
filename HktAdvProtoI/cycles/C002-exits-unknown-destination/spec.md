# C002 — 출구는 여럿, 목적지는 모른다

```text
CYCLE          C002-exits-unknown-destination
SOURCE         content/roadmap/play/RegionGraphRooms.md (Cycle Breakdown 둘째 항목 · §5.2~§5.4 · §5.8 · 확정 사항 1·2·5) ·
               content/roadmap/L2-World-Region.md §5.1(이름) · §10(Connector) · design/Design-World-Editor-Terrain-Compiler.md §3
SELECTED_FROM  Play Cycle Breakdown — "C002 — 출구는 여럿, 목적지는 모른다"
```

범위(Playable Goal ~ Out of Scope)는 design 이 Play 에서 잘라 쓴다. 명세(SPEC ~ UNRESOLVED)는 cycle 이 덧붙여 동결한다.

## Playable Goal

숲 가장자리에서 출구가 셋으로 늘고, 숲 안쪽으로 건너면 깊이가 또 바뀌며 출구가 다섯 보인다 — 그중 닫힌 문은
건너기를 거절하고, 백왕령의 나머지 출구 둘(붉은 황야 쪽 · 얼음 협곡 쪽)은 "아직 없는 곳"으로 거절한다.
출구는 종류(표식)만 보이고 목적지 이름은 어디에도 없다.

## Experience Intent

```text
Start   길 끝의 출구 하나. 건너면 색이 바뀐 방 하나.
End     방마다 출구가 여럿이고 종류가 다르다. 어떤 문은 닫혀 있고 어떤 길은 아직 없는 곳으로 간다.
        목적지는 건너야 안다 — 지도는 없다.
```

Play 의 Breath 중 **호기심 → 낯섦 → 불안** 구간. 발견(거목) 이후는 C003.

## World Change

```text
① 방이 넷 는다 — FOREST_DEEP(wild) · PREDATOR_NEST(wild, 막다른 방) · EXPLORER_RUIN(wild, 막다른 방) ·
   BIO_ORE_FIELD(wild). 방 안은 비어 있고 이름만 있다 (§5.4 — 폴리싱의 자리)
② Connector 가 는다 — FOREST_EDGE ⇄ EXPLORER_RUIN(trail) · FOREST_EDGE ⇄ FOREST_DEEP(trail) ·
   FOREST_DEEP ⇄ PREDATOR_NEST(trail) · FOREST_DEEP ⇄ BIO_ORE_FIELD(trail) ·
   FOREST_DEEP → FANTASY_MAZE(door, 닫힘) · WHITE_KING_DOMAIN → RED_WASTE(pass) · WHITE_KING_DOMAIN → ICE_CANYON(pass)
③ Connector 에 활성 상태가 생긴다 — Region Spec 의 초기 state 에서 온다. ANCIENT_GATE(FANTASY_MAZE 쪽 door) = LOCKED.
   바꾸는 규칙은 이 Play 에 없다 (W7 — RuleBoundRoom 의 C004 가 데이터로 연다)
④ 건너기 Rule 이 거절 사유 둘을 더 안다 — 닫힌 Connector(connector-inactive) · 만들어지지 않은 Region(region-not-built).
   거절은 세계 State 를 바꾸지 않는다 — 요청의 대답만 돌아온다
⑤ transition 종류가 는다 — road 에 trail · door · pass. 투영은 종류만 싣는다 (목적지 이름은 싣지 않는다)
⑥ depth 태그가 는다 — wild
```

## Observable Result

```text
① 숲 가장자리의 출구가 셋 — 표식이 종류별로 다르다 (road · trail · trail)
② 숲 안쪽으로 건너면 바닥 색과 깊이 문구가 wild 로 바뀐다. 출구 다섯 중 하나(고대 문)는 닫힘 표식이다
③ 닫힌 문에서 건너기를 요청하면 거절 문구가 온다 · 몸은 그대로
④ 백왕령의 붉은 황야 쪽 · 얼음 협곡 쪽 출구(pass 표식)에서 요청하면 "아직 없는 곳" 거절 문구가 온다
⑤ POI 방 셋은 이름만 있는 빈 방이다 — 둥지 · 폐허 · 광석 지대. 막다른 방에는 돌아가는 출구 하나뿐
   (광석 지대는 거목 쪽 출구 자리가 하나 더 — 그 Connector 는 C003)
⑥ 어느 표식에도 목적지 이름이 없다
```

## Reuse

### Existing (그대로 쓴다)

```text
C001 의 전부 — Region · Graph 데이터 · regionId · RULE-REGION-TRANSIT-001 · Region 별 투영 · region-exit 존재 ·
transit interaction · 방 바닥(polygon) · 방 이름 라벨 · depth 색/문구 표 · 거절 사유 경로(Request.Outcome) ·
engine/world-authoring (Description · Graph · 검사 ⑤⑦)
```

### Added (이 Cycle 이 세운다)

```text
World      Connector.activation(Region Spec 초기 state → WorldState) · 사유 코드 connector-inactive · region-not-built ·
           건너기 전제에 활성 상태 · 목적지 Region 존재 여부
Data       content/regions/ 방 넷 · graph.ts Connector 일곱 · FANTASY_MAZE 쪽 door 의 초기 state LOCKED
View       transition 종류별 출구 표식 표(road · trail · door · pass) · 닫힘 표식 · wild 색/문구 · 새 거절 문구 둘 · 방 이름 넷
Engine     없음이 목표 — 검사 ⑥⑧(자식마다 Connector · civil 에서 전부 닿음)이 필요해지면 world-authoring/check 에 더한다
```

## Out of Scope

```text
거목 · 내부 세계 · 심장 호수 · 중첩 · 일방향(추락 · 물길) · 카메라 맞춤   C003
데이터만으로 방을 더하고 문을 여는 것의 실측 · world:observe --graph      C004
고대 문이 열리는 조건 · 미로 안                                       RuleBoundRoom (C005~C007)
붉은 황야 · 얼음 협곡의 방                                            이 Play 밖 — Connector 만 있다 (확정 5)
POI 방 안의 내용물(둥지 · 폐허 · 광석)                                  컨텐츠 층의 뒤 Play
```
