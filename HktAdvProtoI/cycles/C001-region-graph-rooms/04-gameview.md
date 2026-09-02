# C001 — GAMEVIEW (State → 표현)

```text
CYCLE          C001-region-graph-rooms
SOURCE         content/roadmap/play/RegionGraphRooms.md §6 V1~V3 · 00-cycle Observable Result ①~⑥
SELECTED_FROM  Play Cycle Breakdown — "[ ] C001 — 방 둘과 길 하나"
PREV           02-world.md Observable 절 · content/protocol/gameview.ts
```

GameView 는 새 의미를 만들지 않는다 — 관찰 계약의 State 를 표현만 한다. 색·문구·표식은 전부 `content/view` 의 **표**다.
방을 더하거나 색을 바꾸는 것은 코드 변경이 아니다 (Play 의 불변 조건).

| 관찰 State (점 경로) | 화면의 무엇 | 어느 표 |
|---|---|---|
| `snapshot.region.id` → `regionSpec(id).space.extent` | `zones[0].shape = polygon(네 꼭짓점)` · `id = region:<id>` — **방의 바닥** | `region-presentation.ts` `regionZones` + `content/regions` 데이터 + `extentPolygon` |
| `regionSpec(id).depth` (civil / outer) | `zones[0].fill` civil 0xf0c878 op .30 / outer 0x2e7a48 op .32 · `edge` 같은 계열 진한 색 | `DEPTH_PRESENTATIONS` (미등록 → 무채색) |
| `snapshot.region.id` | `zones[0].label` = 방 이름 (백왕령 / 숲 가장자리 · 미등록 → id) | `REGION_NAMES` |
| `snapshot.region.hash` ≠ `descriptionHash(spec.space)` | label 뒤 ` — 세계와 다른 땅을 보고 있다` | `code-text` `region.hash-mismatch` |
| `regionSpec(id)` 없음 | `zones = []` · 나머지 그대로 (예외 없음 — 폴백) | `regionZones` |
| `entities[role=region-exit].state` (open) | `spriteId region-exit:open` · size 2.0 · cameraFollow 없음 · **라벨 없음** (목적지 이름을 내지 않는다) | `ROLE_PRESENTATIONS['region-exit']` · `sprites.ts` 팻말 픽셀아트 |
| `entities[role=region-exit].kind` (road) | `tint 0xe0c48a` | `TRANSITION_TINTS` (`tintByKind`) |
| `entities[role=region-exit].position` | 표식 자리 = anchor | (변환 없음) |
| `interactions[role=transit-connector]` | key `KeyQ` · keyLabel `Q` · prompt `건너기` · targetEntityId = Connector id | `interaction-presentation.ts` |
| `interactions[…].reason` | out-of-range / action-busy 기존 문구 · `unknown-connector` "그런 길이 없다" · `wrong-region` "여기서 갈 수 있는 길이 아니다" | `code-text.ts` |
| `hud[id=region.depth].value` | label `깊이` · civil → "문명권" · outer → "문명의 경계를 넘었다" | `hud-presentation.ts` · `code-text.ts` |
| `snapshot.scene` | `SceneState.terrain` (기존 경로 그대로 — 값이 regionId 가 되었다) | — |

키 선택 — Q. `engine/view-kernel/input/keyboard.ts` 의 시점 키가 R·T 를 잡고, E·F·G·Shift 는 이미 interaction 의 것이라 비어 있는 것 중
WASD 왼손이 그대로 닿는 Q 를 골랐다. 조립(app/main.ts)은 손대지 않았다 — 키 있는 interaction 을 눌러 `targetEntityId` 와 함께 보내는
기존 경로로 내려간다.

view 테스트 13 (`content/view/tests/region.spec.ts`) · 기존 fixture 9 개에 `region` 필드 추가 (봉투를 팩이 필수로 좁혔기 때문).
