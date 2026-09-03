# C002 — GAMEVIEW (State → 표현)

```text
CYCLE          C002-many-exits
SOURCE         00-cycle Observable Result ①~⑧ · 01-spec SPEC-006 · 007 · 008 · 02-world Observable
SELECTED_FROM  Play Cycle Breakdown — "[ ] C002 — 출구는 여럿, 목적지는 모른다"
PREV           02-world.md Observable 절 · content/protocol/gameview.ts (무변경)
```

GameView 는 새 의미를 만들지 않는다. 이 Cycle 에서 **새 코드 경로는 하나도 생기지 않았다** —
C001 이 세운 표 넷에 줄이 늘었을 뿐이다. 그것이 Play 의 불변 조건("폴리싱은 데이터로")이 실제로
서 있다는 첫 증거다.

| 관찰 State (점 경로) | 화면의 무엇 | 어느 표 |
|---|---|---|
| `regionSpec(snapshot.region.id).depth` = `wild` | `zones[0].fill` 0x1c4a5a op .34 · `edge` 0x0e2a36 op .85 — outer 보다 어둡고 차가운 푸른 그늘 | `region-presentation.ts` `DEPTH_PRESENTATIONS` |
| `snapshot.region.id` = `FOREST_DEEP` · `EXPLORER_RUIN` · `PREDATOR_NEST` · `BIO_ORE_FIELD` | `zones[0].label` = 숲 안쪽 / 탐험대 폐허 / 포식수 둥지 / 생체 광석 지대 (미등록 → id) | `REGION_NAMES` |
| `entities[role=region-exit].state` = `locked` | `spriteId region-exit:locked` — 판을 가로지르는 쇠 빗장 + 자루의 자물쇠. 라벨 없음 | `sprites.ts` `REGION_EXIT_LOCKED` |
| `entities[role=region-exit].state` = `open` (경계를 가리키는 것 포함) | `spriteId region-exit:open` — C001 팻말 그대로 | `sprites.ts` `REGION_EXIT_OPEN` |
| `entities[role=region-exit].kind` = `trail` | `tint 0x8fae6a` — 길이 되다 만 풀. 흙(road)에서 초록으로 한 칸 | `TRANSITION_TINTS` (`role-presentation.ts` 의 `tintByKind`) |
| `entities[role=region-exit].kind` = `door` | `tint 0xb05a5a` — 자연이 아닌 인공물. 이 계열의 유일한 붉은색 | 〃 |
| `entities[role=region-exit].kind` = `pass` | `tint 0x9fd0e8` — 능선을 넘는 찬 하늘빛. 따뜻한 계열의 정반대 | 〃 |
| `entities[role=region-exit].kind` = `interaction` | `tint 0xc79bea` — 걸어 나가는 게 아니라 안으로 드는 것. 자연에 없는 보라 | 〃 |
| `entities[role=region-exit].kind` 미등록 | tint 없이 표식만 그려진다 (폴백 — 종류가 늘어도 게임은 멈추지 않는다) | 〃 |
| `interactions[id=transit].reason` = `connector-inactive` | "잠겨 있다" — 무엇이 잠갔는지 말하지 않는다 (여는 규칙이 없으므로) | `code-text.ts` |
| `interactions[id=transit].reason` = `region-not-built` | "아직 갈 수 없는 곳이다" — "아직" 이 세계의 끝이 아님을 진다 (Play 확정 사항 5) | `code-text.ts` |
| `hud[id=region.depth].value` = `wild` | `깊이` = "아무도 돌보지 않는 야생" (civil "문명권" · outer "문명의 경계를 넘었다" 를 잇는다) | `hud-presentation.ts` · `code-text.ts` |

C001 의 행(바닥 폴리곤 · hash 대조 · road tint · transit 키 `Q` · civil/outer 문구)은 그대로다.

**색을 밝기가 아니라 색상(hue)으로 갈랐다** — 숲 안쪽에서 표식 다섯이 한 화면에 서기 때문이다.
이 Cycle 의 핵심 관찰이 "출구는 종류만 보인다" 이므로, 다섯이 서로 구분되지 않으면 Cycle 자체가 성립하지 않는다.

**View 가 알지 못하는 것** — 경계(frontier) 목록 · 닫힌 Connector 목록 · 건너간 뒤 Region 의 id/이름 ·
Connector 의 방향. 세계가 그것을 싣지 않으므로 View 는 그것을 표현할 수 없다. "아직 없는 곳" 은
표식이 아니라 **요청의 대답**으로만 드러난다 (01-spec SPEC-007 경계).

view 테스트 14 (`content/view/tests/region-c002.spec.ts`). 기존 view 테스트 136 은 그대로 통과 —
fixture 를 하나도 고칠 필요가 없었다 (봉투의 형이 바뀌지 않았기 때문이다).
