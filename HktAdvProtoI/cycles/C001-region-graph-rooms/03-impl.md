# C001 — IMPLEMENTATION

```text
CYCLE          C001-region-graph-rooms
SOURCE         content/roadmap/play/RegionGraphRooms.md
SELECTED_FROM  Play Cycle Breakdown — "[ ] C001 — 방 둘과 길 하나"
PREV           02-world.md (01-spec.md)
```

통합 후 build 본체가 최종 작성. 코드 자체는 커밋이 소유한다 — 커밋 `3eb4007`(protocol·경계 규칙 4) · `f7bdb05`(engine) ·
`f2563b8`(world·regions) · 그리고 이 문서와 함께 가는 view 커밋.

## 변경 파일

```text
protocol   content/protocol/gameview.ts (RegionView · GameViewSnapshot.region 필수) · semantic-id-core.ts (RULE_REGION_TRANSIT)
engine     engine/world-authoring/{description,graph,check}.ts + tests/ · view-kernel/scene/scene-state.ts (polygon) ·
           view-kernel/renderer/renderer.ts (drawPolygonZone) · protocol-core/gameview.ts (region?)
regions    content/regions/{spec,white-king-domain,forest-edge,graph,index}.ts            ← 새 데이터 폴더 (경계 규칙 4)
world      content/world/semantic/{region(신규),actor,deposit,spawn,world-state}.ts · rules/{transit(신규),move,observer-body}.ts ·
           actions/interactions.ts · simulation/{body-push,body-momentum,swing-strike,npc-decide}.ts ·
           projection/observer-view.ts · index.ts · tests/region.spec.ts(신규) · tests/move.spec.ts
view       content/view/{region-presentation(신규),resolve,role-presentation,interaction-presentation,hud-presentation,code-text,sprites}.ts ·
           tests/region.spec.ts(신규) · tests/fixtures/region-*.json(신규) · 기존 fixture 9개(region 필드)
tools      tools/boundary/check.ts (규칙 4)
```

## Rule ↔ 코드

| Rule | 파일 · 함수 |
|---|---|
| R1 RULE-REGION-TRANSIT-001 | `content/world/rules/transit.ts` — `ruleTransit` · `evaluateTransitPreconditions` · `exitFor`(unknown-connector / wrong-region) |
| R2 RULE-MOVE-001 전제 1 | `content/world/rules/move.ts` — `ruleMove`: `extentContains(regionExtent(actor.regionId), target)` |
| R3 관찰자 몸의 regionId | `content/world/rules/observer-body.ts` — `spawnObserverBody` (`regionId: START_REGION`) · `semantic/region.ts` — `START_REGION` |
| R4 초기 배치 | `content/world/index.ts` — `createWorld`: DEFAULT_NPCS · deposit-1 의 `regionId: START_REGION` |
| R5 AFFECTED | `simulation/body-push.ts` — `groupByRegion` + Region 그룹마다 `resolveCirclePush` · `simulation/body-momentum.ts` — 그룹마다 `integrateMomentum(…, regionExtent)` · `simulation/swing-strike.ts` — 다른 regionId 는 건너뜀 · `simulation/npc-decide.ts` — `perceivedTarget` 에서 다른 regionId 제외 |
| R6 투영 | `content/world/projection/observer-view.ts` — `projectObserverView`: scene = self.regionId · actor/deposit 필터 · anchor 마다 region-exit entity + transit interaction · hud `region.depth` · `region { id, hash }` |
| R7 영속 | `content/world/semantic/world-state.ts` — `STATE_VERSION = 'hkt-adv-proto-i/2'` · World.bounds 제거. regions/graph 는 스냅샷에 없고 `content/regions` 에서 다시 읽는다 (`semantic/region.ts`) |
| State 표 (데이터) | `content/regions/white-king-domain.ts` · `forest-edge.ts` · `graph.ts` — Plan §3.1 의 RegionDescription 형 그대로. 뒤의 지형 op 는 같은 `ops` 에 더한다 |
| 관찰 계약 | `content/protocol/gameview.ts` — `RegionView` · `GameViewSnapshot.region` |

## 기구 추출 (Agent E → engine, 게임 명사 없음)

| 기구 | 무엇 | 어떤 요구에서 | 재사용처 |
|---|---|---|---|
| `RegionDescription` · `PointOp` · `Extent` · `XZ` | Local Space 하나의 Source of Truth | SPEC-001 · 002 | 모든 Region 데이터. stamp·curve·area 는 같은 ops 에 더해진다 (RoomBecomesLand) |
| `extentContains` · `extentPolygon` · `extentCenter` | 경계 판정(포함) · 그리기용 꼭짓점 · 중심 | SPEC-004 · 007 | 이동 경계 · 바닥 그리기 · 카메라 |
| `pointsOf` · `findPoint` | layer/tag 로 point 조회 | SPEC-002 · 005 · 007 | anchor · 뒤에 spawn/deposit/actor 자리도 point 로 |
| `descriptionHash` | 정규화 JSON 위 FNV-1a — 같은 Description → 같은 값 | SPEC-007 ④ · 010 | 봉투 region.hash · 컴파일 캐시 키 |
| `RegionGraph` · `Connector` · `exitsOf`(순서 보존) · `findConnector` | Region 사이의 전이 목록과 조회 | SPEC-002 · 005 · 006 | 건너기 Rule · 투영 · 중첩(containment) |
| `checkGraph` — unknown-region · missing-anchor · no-exit | Description 들과 Graph 의 정합 (검사 ⑤ · ⑦) | SPEC-002 | `world:observe --graph` (C004) · 정적 검사 |
| `SceneGroundZone.shape.polygon` + `drawPolygonZone` | 닫힌 점열을 지형에 드리워 채움·띠 테두리·라벨 | SPEC-007 (바닥) | area op 의 polygon 그리기 |
| `GameViewSnapshot.region?` | 봉투의 구역 id+hash | SPEC-007 ④ | hash 대조 |

engine 테스트 18 (description 8 · graph 5 · check 5). ENGINE GAP 없음 — 전부 더하기였다.

## Architecture 변화

```text
content/regions/        world 와 view 가 함께 읽는 데이터 폴더가 생겼다. 경계 규칙 4 (regions → engine 만) 를 tools/boundary 가 강제한다
engine/world-authoring/ 세계 제작 도구의 첫 모듈 — Description · Graph · 검사. 컴파일러(높이·표면·scatter)는 아직 없다
WorldPosition           (x, z) → regionId + (x, z). World.bounds 는 사라지고 Region.extent 가 대신한다
STATE_VERSION           1 → 2. 이전 스냅샷은 복구되지 않는다 (server/world-store 의 기존 규칙)
```

## GAP 처리

```text
IMPLEMENTATION GAP (W, 자리에서 해소)  RULE-BODY-MOMENTUM-001 의 경계 — World.bounds 제거의 귀결. 02-world AFFECTED 에 한 줄 더함
DESIGN GAP                            없음
ENGINE GAP                            없음
```

## 알려진 부채 (다음 Cycle 의 자리)

```text
wrong-region 은 C001 그래프로는 플레이 도달 불가 — Connector 가 둘 이상인 C002 에서 플레이 실측 (S-015 는 하네스)
바닥 폴리곤은 꼭짓점 넷만 지형에 드리운다 — 기존 sine 지형의 굴곡에 채움이 부분적으로 묻힐 수 있다.
    테두리 띠는 1단위 분할로 지형을 따른다. 방이 평평해지는 것은 heightAt 이 컴파일 결과를 읽는 C008 의 일이다
바닥 색은 hud 가 아니라 클라이언트 데이터(regionSpec.depth)에서 정한다 — 어긋남은 hash 대조가 드러낸다 (Plan §3.5 방식)
Play §6 V4 (카메라를 방 extent 에 맞춤) 는 00-cycle Observable 에 없어 하지 않았다 — C003 의 80×80 방에서 필요해진다
```
