# LANES — 레인 배차판

**살아 있는 문서다** — 레인 **사이**의 지금 상태만 담는다. 레인 **안**의 할일은 각 레인의
소유 파일(frontier/<트랙>.md · works/BACKLOG.md · Cycle Artifact)이 담고, 여기 중복하지
않는다. 완료·경위를 여기 쌓지 않는다 (CLAUDE.md 원칙 20). 규칙과 갱신 방법의 단일 출처는
[guides/works.md](../../guides/works.md) 의 "배차판" 절이다.

관찰: `npm run lanes` 가 이 판과 저장소의 실제 상태(Cycle Stage · SELECTED · 미처리
Feedback · BACKLOG)를 겹쳐 `LANES.html` 로 그린다. `npm run lanes:check` 는 판이 실제와
어긋나는 곳만 보고한다.

세션 시작 프롬프트는 언제나 이 한 줄이다:

    "AdvProtoH 배차판(LANES.md) 보고 열린 레인 하나 진행해"

## 레인

상태 어휘는 넷이다.

    OPEN      지금 세션을 띄울 수 있다
    RUNNING   세션이 잡고 있다 — "지금" 칸에 작업 ID 를 적는다
    BLOCKED   다른 레인의 결과를 기다린다 — "기다리는 것" 이 사라졌는지는
              착수하려는 세션이 스스로 확인하고, 사라졌으면 OPEN 으로 고쳐 잡는다
    HUMAN     Human 결정을 기다린다 — 결정이 오면 OPEN

| 레인 | 상태 | 지금 | 기다리는 것 |
|---|---|---|---|
| FEEDBACK | OPEN | 없음 — 닫힌 Cycle 이 모두 Master 에 들어갔다 | 없음 — 병합 뒤 최신 main 위에서 (`npm run feedback:gate`) |
| WORLD·ITEM | HUMAN | 후보 5 중 선택 대기 — Agent 추천 FR-THE-PLACES-ARE-NARROWER (+FR-SEE-BEFORE 얹기) | Human Select (frontier/item.md) |
| WORLD·COMBAT | BLOCKED | 후보 0 — FR-THE-SHAPE-IS-DATA 가 C025 로 닫혔다 | MASTER 의 OPTIONS(Q35) 가 후보를 낳는 것 |
| WORLD·TERRAIN | OPEN | `C-TERRAIN-001` 착수 대기 — SELECTED `FR-THE-GROUND-HAS-A-LAW`(땅이 법칙을 지닌다). Stage 1 부터, 아직 시작하지 않았다. 시각화의 소유 분해·진행 순서는 [design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md) 를 따른다 | 없음 — 다만 이 판과 트랙 파일이 main 에 들어간 뒤에 잡는다 |
| VIEW | OPEN | BACKLOG 다음 항목(slot-key-hint)부터 — 기반 동반이 필요한 둘(tip-flip-at-the-edge · workspace-two-columns)은 ENGINE 뒤에 잡는다 | 없음 |
| MASTER | OPEN | OPTIONS Q35 (몸이 아닌 존재를 요구하는 Possibility) — 대지형 NEXT 는 끝났다 (TERRAIN 트랙 후보 3) | 없음 — 미처리 Feedback 이 0 이라 막던 것이 사라졌다 (`npm run feedback:gate`) |
| ENGINE | OPEN | 셋 — ① 표면 안의 **초점 차례**(`tabindex` 0건 — Tab 이 글자 자리·슬롯에 한 번에 닿지 못한다. 다시 그릴 때 초점을 붙드는 자리는 이미 섰다) ② 겹침 표면의 **자리 잡기** 둘 — 곁말이 가장자리에서 접히는 일 · 구획을 나란히 놓는 일 (BACKLOG `tip-flip-at-the-edge` · `workspace-two-columns` 가 그것을 기다린다) ③ 지면 구역 장치 `SceneGroundZone` ([design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md)) — C-TERRAIN-001 의 04 확정 뒤 | 없음 |
| PROCESS | HOLD | 없음 | — (공정 변경 중에는 다른 레인을 새로 띄우지 않는다) |

## 레인 사이 충돌 — 순서가 아니라 파일이 겹치는 곳

표의 "기다리는 것" 이 잡지 못하는, 동시에 돌 때의 겹침만 적는다.

| 겹침 | 지금의 판단 |
|---|---|
| VIEW 의 장비 구획 ↔ WORLD·ITEM | 장비 구획이 V-012 로 섰다 — 이제 겹치는 것은 **고른 것 구획**이다. ITEM 의 후보 `FR-SEE-BEFORE-YOU-WEAR`(걸기 전에 안다)가 골라지면 그 Cycle 이 미리 본 값을 그 자리에 싣는다. **둘 다 자기 영역 끝에 더하고 기존 줄을 옮기지 않는다** |
| WORLD·TERRAIN ↔ WORLD·ITEM | **지금은 겹치지 않는다** — 고른 것이 첫 후보(땅이 법칙을 지닌다)라 아이템 파일에 닿지 않는다. 겹치는 것은 셋째 후보(FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED)이며, 그것을 고를 때 ITEM 이 무엇을 도는 중인지 먼저 본다 |
| WORLD·TERRAIN ↔ VIEW | 땅은 화면에 보여야 하므로 이 Cycle 이 `view/` 를 건드린다. VIEW 의 다음 항목(tooltip-on-focus)은 상세를 여는 자리라 자리가 다르지만 표면 상태·HUD 에서 스칠 수 있다 — **둘 다 자기 영역 끝에 추가만 하고 기존 줄을 옮기지 않는다** (frontier/README.md 공유 지점 규칙과 같다) |
| WORLD·TERRAIN ↔ ENGINE | ENGINE 의 지면 구역 장치(`SceneGroundZone`)를 TERRAIN 의 Stage 7 이 소비한다 — 04 가 관찰 표면을 확정한 뒤 ENGINE 이 착수하고, fallback(안 그림)이 있어 BLOCKED 는 아니다. 소유 분해·순서: [design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md) |
| VIEW 의 슬롯 띠·표면 문구 ↔ ENGINE | **회수가 끝났다** — 기반이 부르는 코드의 단일 출처는 `engine/view-kernel/presentation/text-codes.ts` 의 `ENGINE_TEXT_CODES` 이고, 말은 팩의 `view/code-text.ts` 에 있다. 기반이 새 코드를 부르면 팩의 검사(`view/tests/engine-text.spec.ts`)가 그 자리를 가리키므로, 이제 겹침은 **그 표에 줄을 더하는 일** 하나다 |
| VIEW 의 skill-focus-order ↔ ENGINE | 초점 차례를 세우는 자리가 기반이면 ENGINE 동반이 필요하다 — 지금은 팩 키(`L`)가 지름길로 그 구멍을 메우고 있다 |

## HUMAN 대기

Human 이 답하면 풀리는 것들이다. 답의 자리는 괄호가 가리킨다.

| 무엇 | 풀리는 것 |
|---|---|
| WORLD·ITEM 후보 선택 (frontier/item.md SELECTED) | WORLD·ITEM 레인 착수 |
| 문서의 분류 다섯에 `도구` 를 더할 것인가 (Design-View-Inventory-Equipment-UX-D1 §6) | 곡괭이가 `기타` 대신 자기 칸을 얻는다 (V-008 REPORT) |
| Q37 — 자리에 이름을 줄 것인가 (open-questions.md) | FR-ARRANGE-WHAT-YOU-CARRY 존치/삭제 |
| Design-Creature-Behavior-R0.md 승인 | Inject → MC-PREDICT · MC-OBSERVE 습성 해금 |
| Design-Resource-Catalog-R0.md 승인 | Inject → Q36 · 회복 아이템 해금 · BT 자원 24종의 자리 (그 문서가 받기로 정해졌다 — HISTORY Q50(a)) |
