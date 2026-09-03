# C002 — 출구는 여럿, 목적지는 모른다

## Source

[content/roadmap/play/RegionGraphRooms.md](../../content/roadmap/play/RegionGraphRooms.md) — Cycle Breakdown 의 둘째 항목.
Play 의 Breath 중 **낯섦 → 불안** 구간과, 첫 방(백왕령)의 **새로운 미지**를 만든다.
C001 이 세운 축(방 · 그래프 · 건너기 · 투영)은 그대로 두고 **연결의 종류**를 늘린다.

## Playable Goal

관찰자의 몸이 백왕령에서 출구 셋을 보고(길 하나 · 고개 둘), 고개 쪽으로 건너기를 요청하면 **아직 없는 곳**이라는
대답을 받는다. 길로 나가 숲 가장자리 → 숲 안쪽까지 걸으면 출구가 다섯인 방에 서고, 그 중 하나(고대 문)는
**닫혀 있어 거절**하며, 나머지로 막다른 POI 방 셋(폐허 · 둥지 · 광석 지대)을 드나든다 — 목적지의 이름은
어디에도 나오지 않고, 출구는 **종류**(길 · 오솔길 · 문 · 고개 · 들어감)만 표식으로 구분된다.

## Experience Intent

```text
Start   길은 하나뿐인 줄 알았다. 나가는 곳이 셋인데 어디로 가는지는 모른다.
End     세계에는 갈 수 있는 곳, 아직 없는 곳, 잠긴 곳이 있다. 이름은 없고 종류만 있다.
        나는 그 중 몇 개만 열어 보았고 남은 것이 더 많다.
```

## World Change

```text
① 방이 둘에서 여섯이 된다 — FOREST_DEEP(wild) · EXPLORER_RUIN(wild) · PREDATOR_NEST(wild) · BIO_ORE_FIELD(wild).
   depth 태그에 wild 가 처음 나온다 (civil · outer · wild 세 단계)
② Connector 가 하나에서 열이 된다 — 종류 다섯(road · trail · door · pass · interaction) ·
   방향 둘(bidirectional · one-way) · 활성 둘(열림 · 닫힘)
③ 그래프가 **아직 짓지 않은 곳(frontier)** 을 가리킬 수 있게 된다 — RED_WASTE · ICE_CANYON · FANTASY_MAZE ·
   RED_EYE_TREE. Connector 는 있고 방은 없다. 세계는 이것을 오류가 아니라 **경계**로 안다
④ 새 거절 둘 — connector-inactive(닫힌 문) · region-not-built(아직 없는 곳).
   거절은 세계 State 를 바꾸지 않는다 (RULE-REQUEST-REPLY-001 재사용)
⑤ Connector 의 활성 상태가 컨텐츠 데이터에서 온다 — 닫힌 것의 목록. 여는 규칙은 이 Cycle 에 없다 (Play W7)
⑥ 출구 표식이 열림/닫힘을 구분한다 — region-exit 존재의 state 가 open | locked 로 갈린다
⑦ 검사가 늘어난다 — frontier 를 아는 정합 검사 + 시작 방에서 모든 방에 닿는가 (검사 ⑧)
```

방 하나(붉은 눈의 거목)는 짓지 않는다. C002 는 그 자리에 **frontier 를 가리키는 Connector** 만 둔다 —
C003 이 RegionSpec 하나를 더하고 frontier 목록에서 이름을 빼면 그 문이 열린다. Connector 는 손대지 않는다.

## Observable Result

```text
① 백왕령에 출구 표식이 셋 보인다 — 길 하나(기존) · 고개 둘. 종류마다 표식 색이 다르고 목적지 이름은 없다
② 고개에 붙어 건너기를 요청하면 거절이 온다 — "아직 갈 수 없는 곳이다" (region-not-built)
③ 숲 가장자리의 출구가 셋으로 는다 — 돌아가는 길 · 숲 안쪽 · 탐험대 폐허
④ 숲 안쪽의 바닥 색이 또 바뀐다 (wild) 며 HUD 깊이가 "야생" 을 읽는다
⑤ 숲 안쪽에 출구 표식이 다섯 보인다 — 그 중 하나는 **닫힌 표식**이다
⑥ 닫힌 문에 붙어 요청하면 거절이 온다 — "잠겨 있다" (connector-inactive). 몸은 그 자리에 그대로 있다
⑦ 막다른 방 셋에 들어갔다 나온다 — 각 방에는 돌아가는 출구가 하나(광석 지대만 둘)뿐이고 방은 비어 있다
⑧ 여섯 방을 지나는 동안 scene 이 여섯 번 바뀌고, 다른 방의 몸·광맥은 한 번도 보이지 않는다
```

## Reuse

### Existing (그대로 쓴다)

```text
RULE-REGION-TRANSIT-001 의 뼈대(anchor 근접 · 행동 대체 가능 · 반대쪽 anchor 로 이동) · RULE-MOVE-001 의 extent 경계 ·
Region 별 투영 · region-exit 존재와 transit interaction · Request.Outcome 사유 코드 경로 · hud region.depth ·
방 바닥 polygon 과 depth 색 표 · 출구 표식 sprite · 세계 영속 · 다중 관찰자 · engine/world-authoring 의 Description·Graph·검사
```

### Added (이 Cycle 이 세운다)

```text
Data       content/regions/{forest-deep,explorer-ruin,predator-nest,bio-ore-field}.ts ·
           graph.ts 에 Connector 아홉 · frontier 목록 · 닫힌 Connector 목록 ·
           forest-edge/white-king-domain 에 anchor 추가
World      RULE-REGION-TRANSIT-001 에 거절 둘 추가 (connector-inactive · region-not-built) ·
           투영의 region-exit state(open | locked)
View       depth wild 색 · 방 이름 넷 · transition 색 넷(trail · door · pass · interaction) ·
           닫힌 출구 표식 · 문구 셋(야생 · 잠겨 있다 · 아직 갈 수 없는 곳이다)
Engine     RegionGraph.frontiers · checkGraph 가 frontier 를 아는 것 · 검사 ⑧ unreachable(시작 방에서 닿지 않는 방)
```

## Out of Scope

```text
붉은 눈의 거목 방 · 거목 내부 세계 · 심장 호수 · 중첩 · 일방향 추락 · 물길        C003
데이터만으로 방을 더하는 것의 실측 · world:observe --graph 보고                 C004
문을 여는 규칙 · 무엇이 잠금을 푸는가 · 발견 상태(누가 무엇을 아는가)             RuleBoundRoom (C005~) · 3층
붉은 황야 · 얼음 협곡 · 환상의 미로의 방 자체                                    이 Play 밖 (확정 사항 5) · RuleBoundRoom
POI 방 안의 내용물(둥지의 짐승 · 폐허의 물건 · 광석)                             4층 이후 — 방은 이름만 있고 비어 있다
카메라를 방 extent 에 맞추는 것                                                 C003 (80×80 방이 나올 때)
높이 · 표면 · 경사 · scatter                                                    RoomBecomesLand (C008~C010)
```
