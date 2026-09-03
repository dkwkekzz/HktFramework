# C002 — IMPLEMENTATION

```text
CYCLE          C002-many-exits
SOURCE         content/roadmap/play/RegionGraphRooms.md
SELECTED_FROM  Play Cycle Breakdown — "[ ] C002 — 출구는 여럿, 목적지는 모른다"
PREV           02-world.md (01-spec.md)
```

**확장 Cycle** — C001 의 구조 위에 값을 늘렸다. 코드 자체는 커밋이 소유한다:
`577db41`(engine) · `ebc43b2`(world·regions) · `c84e0b9`(view) · 그리고 이 문서와 함께 가는 검증 커밋.

## 관찰 계약

**바뀐 것이 없다.** 02-world Observable 이 말한 대로 봉투의 형은 그대로이고 값의 가짓수만 늘었다 —
`EntityView.state` 와 `InteractionView.reason` 은 이미 `string` 이고(`engine/protocol-core/gameview.ts`),
`hud[].value` 도 이미 의미 코드다. 그래서 `content/protocol/` 은 이 Cycle 에서 한 줄도 바뀌지 않았고
`STATE_VERSION` 도 그대로다 (SPEC-010 · S-023 실측).

## 변경 파일

```text
engine     engine/world-authoring/{graph,check}.ts + tests/{graph,check}.spec.ts
regions    content/regions/{forest-deep,explorer-ruin,predator-nest,bio-ore-field}.ts   ← 새 방 넷
           content/regions/{graph,index,white-king-domain,forest-edge}.ts
world      content/world/semantic/region.ts · rules/transit.ts · projection/observer-view.ts
view       content/view/{region-presentation,sprites,code-text}.ts
tests      content/world/tests/c002-many-exits.spec.ts(신규 · 42) ·
           content/view/tests/region-c002.spec.ts(신규 · 14) ·
           content/world/tests/region.spec.ts(C001 회귀 정리 — 아래)
protocol   없음
```

## Rule ↔ 코드

| Rule | 파일 · 함수 |
|---|---|
| R1 RULE-REGION-TRANSIT-001 (전제 둘 · 사유 순서) | `content/world/rules/transit.ts` — `exitFor`(unknown-connector · wrong-region) → `evaluateTransitPreconditions`(wrong-region → out-of-range → connector-inactive → region-not-built → action-busy) → `ruleTransit`(전이). 판정 재료는 `content/world/semantic/region.ts` 의 `isConnectorOpen` · `isRegionBuilt` |
| R2 투영의 region-exit state | `content/world/projection/observer-view.ts` — `projectObserverView` 의 `regionExitsOf` 루프: `state: isConnectorOpen(id) ? 'open' : 'locked'`. reason 은 같은 루프의 `evaluateTransitPreconditions` — 투영과 Rule 이 한 판정을 공유한다 |
| R3 초기 배치 (REUSED) | 코드 변경 없음. `semantic/region.ts` `START_REGION` 그대로 — 새 방 넷은 비어 있다 (S-002) |
| R4 Graph 정합 검사 | 검사 자체는 기구 — `engine/world-authoring/check.ts` `checkGraph(descriptions, graph, anchorLayer, startRegion?)`. 그것이 먹는 데이터는 컨텐츠가 소유한다 — `content/regions/graph.ts` 의 `frontiers`(`FRONTIER_REGIONS`) · `regions` · `connectors` |
| R5 MOVE/PUSH/MOMENTUM/SWING/NPC (AFFECTED) | 코드 변경 없음. `regionExtent` 가 여섯 방 모두에 답한다 — 판정 대상은 여전히 같은 regionId 안뿐이다 (S-028 · S-029) |
| R6 영속 (REUSED) | 코드 변경 없음. `REGION_SPECS` · `REGION_GRAPH` · `FRONTIER_REGIONS` · `CLOSED_CONNECTORS` 는 전부 스냅샷 밖의 정적 데이터다 (S-008 · S-023 · S-024) |
| 데이터 (SPEC-002 · 003 표) | `content/regions/*.ts` — 방 여섯의 anchor 와 Connector 열. 배열 순서가 `exitsOf` 의 결정론이다 |

## 기구 추출 (Agent E → engine, 게임 명사 없음)

| 기구 | 무엇 | 어떤 요구에서 | 재사용처 |
|---|---|---|---|
| `RegionGraph.frontiers?` | Connector 가 가리키되 Description 이 없는 이름들. 선택적 필드 — 없으면 아무 이름도 경계가 아니다 | SPEC-004 | 점진적으로 자라는 세계 일반 — 방을 하나씩 지어 나가는 어떤 팩이든 |
| `isFrontier(graph, id)` | 그 이름이 이 Graph 가 밝힌 경계인가 | SPEC-004 · 009 ① | 검사 · 투영 · 전이 판정 |
| `reachableRegions(graph, start)` | 시작 방에서 Connector 를 따라 닿는 방들. one-way 는 from→to 만, connectors 순서를 지키는 너비 우선(결정론) | SPEC-009 ④ | 고립 방 탐지 · 길찾기 앞단 · 지도 도달성 질의 |
| `checkGraph(…, startRegion?)` 의 검사 셋 | `frontier-built` · `unused-frontier` · `unreachable` + 경계 쪽 끝의 면제 | SPEC-009 ①~④ | `world:observe --graph`(C004) · 정적 검사 |

engine 테스트 36 (description 8 · graph 12 · check 16). **ENGINE GAP 없음** — 전부 선택적 필드·선택적 인자·새 export
의 더하기였고 기존 export 시그니처는 하나도 바뀌지 않았다. `frontiers` 가 없으면 `checkGraph` 의 판정도 예전 그대로다.

## Architecture 변화

```text
없음. C001 이 세운 자리(content/regions 데이터 폴더 · engine/world-authoring · WorldPosition = regionId + (x, z))
가 그대로 늘어났을 뿐이다. 새 개념 하나 — 그래프가 "아직 짓지 않은 곳"(frontier)을 가리킬 수 있다.
이것은 세계 제작이 점진적이라는 사실을 기구가 처음으로 아는 자리다.
```

## GAP 처리

```text
IMPLEMENTATION GAP  없음
ENGINE GAP          없음 (전부 더하기)
DESIGN GAP          없음
```

## 회귀 정리

`content/world/tests/region.spec.ts` 의 C001 단정 넷이 "방이 정확히 둘" · "Connector 가 정확히 하나" ·
"백왕령 entities 가 정확히 다섯" · "숲 가장자리 entities 가 정확히 둘" 을 못박고 있었다.
넓어진 세계에서도 **같은 뜻이 참인 문장**으로 고쳤다 — C001 의 둘이 여전히 맨 앞이고(순서 보존),
몸·광맥의 집합은 그대로이며, 출구는 늘었으므로 `toContainEqual` 로 그 하나를 짚는다.
기대를 낮춘 것이 아니다: 지운 단정은 없고 C001 테스트 27 이 전부 통과한다.

## 알려진 부채 (다음 Cycle 의 자리)

```text
`pass` 색이 붙은 표식은 지금 전부 경계를 가리킨다 — "고개 = 아직 없는 곳" 으로 읽힐 여지가 있다.
    View 가 만든 의미가 아니라 C002 데이터가 그렇게 생긴 결과다. 방이 지어지면 저절로 풀린다
방 바닥이 지형 굴곡에 묻힐 수 있다 (C001 이월) — 방이 평평해지는 C008 의 일이다
카메라가 방 크기에 맞지 않는다 (C001 이월) — 80×80 방이 나오는 C003 에서 필요해진다
```

C001 이 이월한 부채 하나는 **닫혔다** — `wrong-region` 사유가 S-010 에서 실제 플레이 경로로 관측되었다
(백왕령에서 숲 안쪽의 Connector 를 요청). Connector 가 둘 이상이 되면서 하네스 없이 도달 가능해졌다.
