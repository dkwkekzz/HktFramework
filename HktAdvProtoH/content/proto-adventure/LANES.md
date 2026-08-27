# LANES — 레인 배차판

**살아 있는 문서다** — 레인 **사이**의 지금 상태만 담는다. 레인 **안**의 할일은 각 레인의
소유 파일(frontier/<트랙>.md · works/BACKLOG.md · Cycle Artifact)이 담고, 여기 중복하지
않는다. 완료·경위를 여기 쌓지 않는다 (CLAUDE.md 원칙 20). 규칙과 갱신 방법의 단일 출처는
[guides/works.md](../../guides/works.md) 의 "배차판" 절이다.

관찰: `npm run lanes` 가 이 판과 저장소의 실제 상태(Cycle Stage · SELECTED · 미처리
Feedback · BACKLOG)를 겹쳐 `LANES.html` 로 그린다. `npm run lanes:check` 는 판이 실제와
어긋나는 곳만 보고한다.

브라우저에서 보는 고정 링크는 하나다 — **main 의 판**을 가리키며 바뀌지 않는다.
갱신 규칙(언제 덮어쓰고 언제 덮어쓰지 않는가)의 단일 출처는
[master/README.md](master/README.md) 의 "고정 링크" 절이고, 거기 셋이 함께 적혀 있다.

    https://claude.ai/code/artifact/ca6a873b-1e46-4ac6-8db7-54edd562fae3

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
| FEEDBACK | OPEN | **둘이 밀렸다** — `C-TERRAIN-001`(Constraint 재판정 DC-WORLD-TERRAIN-IS-A-PRINCIPLE SATISFIED → PARTIAL · Master Gap: BT §15 셋째 항이 비어 있다 · 다음 후보는 이미 트랙 파일에 섰다) 과 `C-COMBAT-001`(Overlay 판정 둘 PARTIAL · Constraint 후보 하나). 한 실행이 배치로 처리하되 `feedback/<CycleId>.md` 는 따로 만든다 | 없음 — 병합 뒤 최신 main 위에서 (`npm run feedback:gate`) |
| WORLD·ITEM | HUMAN | 후보 5 중 선택 대기 — Agent 추천 FR-THE-PLACES-ARE-NARROWER (+FR-SEE-BEFORE 얹기) | Human Select (frontier/item.md) |
| WORLD·COMBAT | HUMAN | `C-COMBAT-001-where-your-power-sits` — Stage 1~8 닫힘. 검사 6종 통과 · 실제 브라우저에서 키→요청→세계→관찰 왕복 실측. **STATUS 는 IN PROGRESS** — 사람이 손으로 눌러 본 뒤에만 COMPLETE 다 (Gate 14항). 남은 후보 아홉이 UL 전체를 덮는다 | Human Play (`npm run dev` → `U` → `2`) |
| WORLD·TERRAIN | OPEN | `C-TERRAIN-001` **COMPLETE**. 다음 후보는 `FR-THE-LAND-KEEPS-WHAT-IT-TAKES`(땅이 거둔 것을 간직한다) — PROPOSED 이며 Human 선택 대기. **미처리 MASTER FEEDBACK 이 있다** (08 의 Constraint 재판정 · Master Gap) — Feedback 레인이 먼저 돈 뒤 잡는다 | 병합 뒤 최신 main 위에서 (`npm run feedback:gate`) |
| WORLD·GROWTH | RUNNING | `C-GROWTH-001-what-you-did-makes-you` — Stage 1 닫힘. C-COMBAT-001 이 main 에 든 뒤 최신 main 위에서 잡았다 (`effectiveStat` 은 이미 세 항이다). **COMBAT 과 같은 파일을 본다 — 아래 충돌 칸** | 없음 |
| VIEW | OPEN | BACKLOG 다음 항목(drag-and-drop)부터 — 기반 동반이 필요한 셋(tip-flip-at-the-edge · escape-leaves-the-field · workspace-two-columns)은 ENGINE 뒤에 잡는다 | 없음 |
| MASTER | OPEN | OPTIONS Q35 (몸이 아닌 존재를 요구하는 Possibility) — 이제 스킬 실행 형태의 빈 다섯 칸만 막는다. 성장(GS · GB)과 전투 상층(UL) 주입은 둘 다 끝났다: 결정 열(Q52~Q61) 반영 · GROWTH 후보 3 · COMBAT 후보 10 과 SELECTED 까지 | 없음 — 미처리 Feedback 이 0 이다 (`npm run feedback:gate`) |
| ENGINE | OPEN | 셋 — ① **자판이 표면 안을 다니는 길** — 정해진 초점 차례가 없고(`tabindex` 0건), 글자 자리에서 `Esc` 가 죽는다(붙잡는 단계가 `INPUT` 에서 비켜 주고 받는 자리가 없다). 다시 그릴 때 초점을 붙드는 자리는 이미 섰다. BACKLOG 의 `escape-leaves-the-field` · `skill-focus-order` 가 이것을 기다린다 ② **겹침 표면의 자리 잡기** — 곁말이 가장자리에서 접히는 일 · 구획을 나란히 놓는 일 (`tip-flip-at-the-edge` · `workspace-two-columns`) ③ 지면 구역 장치 `SceneGroundZone` ([design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md)) — C-TERRAIN-001 의 04 확정 뒤 | 없음 |
| PROCESS | OPEN | 없음 — 보고 형식이 guides/works.md 의 "보고" 절에 섰다 | 없음 |

## 레인 사이 충돌 — 순서가 아니라 파일이 겹치는 곳

표의 "기다리는 것" 이 잡지 못하는, 동시에 돌 때의 겹침만 적는다.

| 겹침 | 지금의 판단 |
|---|---|
| VIEW 의 장비 구획 ↔ WORLD·ITEM | 장비 구획이 V-012 로 섰다 — 이제 겹치는 것은 **고른 것 구획**이다. ITEM 의 후보 `FR-SEE-BEFORE-YOU-WEAR`(걸기 전에 안다)가 골라지면 그 Cycle 이 미리 본 값을 그 자리에 싣는다. **둘 다 자기 영역 끝에 더하고 기존 줄을 옮기지 않는다** |
| WORLD·TERRAIN ↔ WORLD·ITEM | **지금은 겹치지 않는다** — 고른 것이 첫 후보(땅이 법칙을 지닌다)라 아이템 파일에 닿지 않는다. 겹치는 것은 셋째 후보(FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED)이며, 그것을 고를 때 ITEM 이 무엇을 도는 중인지 먼저 본다 |
| WORLD·TERRAIN ↔ VIEW | 땅은 화면에 보여야 하므로 이 Cycle 이 `view/` 를 건드린다. VIEW 의 다음 항목(drag-and-drop)은 소지품 표면 안의 일이라 자리가 다르지만 표면 상태·HUD 에서 스칠 수 있다 — **둘 다 자기 영역 끝에 추가만 하고 기존 줄을 옮기지 않는다** (frontier/README.md 공유 지점 규칙과 같다) |
| WORLD·GROWTH ↔ WORLD·TERRAIN | 둘 다 `world/semantic/actor.ts` 에 몸의 새 자리를 더한다 (성장은 쌓이는 것, 땅은 거두어 가는 것). **자기 영역 끝에 추가만 하고 기존 줄을 옮기지 않는다** (frontier/README.md 공유 지점 규칙). 둘 다 관찰 계약을 넓히므로 `gameview-*` 도메인 파일도 각자 자기 파일에만 더한다 |
| **WORLD·GROWTH ↔ WORLD·COMBAT** | **겹친다 — 순서는 정해졌다: COMBAT 이 먼저다** (Human 지시). 둘 다 `world/semantic/combat.ts` 의 **유효 값 계산**(`effectiveStat`)에 항을 더한다 — 성장은 자란 값을, 배분은 지금 몰아 둔 곳을. 같은 함수 안이라 끝에 추가하는 것으로 갈라지지 않는다. **GROWTH 를 잡는 세션은 C-COMBAT-001 이 main 에 들어간 뒤 최신 main 위에서 시작한다** — 그때 `effectiveStat` 은 이미 세 항이고 성장이 넷째가 된다. 자기 줄(OPEN)은 그 세션이 스스로 고친다 (works.md 쓰기 규칙) |
| WORLD·COMBAT ↔ VIEW | 상층 후보 열이 전부 전투 HUD 에 자리를 요구한다 (지금의 배분 · 대답 가능 여부 · 기회). VIEW 와 같은 파일(`hud-presentation.ts` · `combat-presentation.ts`)에서 만나므로 위와 같은 규칙 — 자기 영역 끝에 추가만 한다 |
| WORLD·TERRAIN ↔ ENGINE | ENGINE 의 지면 구역 장치(`SceneGroundZone`)를 TERRAIN 의 Stage 7 이 소비한다 — 04 가 관찰 표면을 확정한 뒤 ENGINE 이 착수하고, fallback(안 그림)이 있어 BLOCKED 는 아니다. 소유 분해·순서: [design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md) |
| 기반의 문구 ↔ VIEW 의 문구 표 | 기반이 새 문구 코드를 부르면 팩의 `view/code-text.ts` 에 줄이 는다 — 그 한 줄이 겹치는 전부다. 코드의 단일 출처는 `engine/view-kernel/presentation/text-codes.ts` 의 `ENGINE_TEXT_CODES` 이고, 덮이지 않은 것은 팩의 검사(`view/tests/engine-text.spec.ts`)가 어느 자리인지 가리킨다 |
| VIEW 의 skill-focus-order ↔ ENGINE | 초점 차례를 세우는 자리가 기반이면 ENGINE 동반이 필요하다 — 지금은 팩 키(`L`)가 지름길로 그 구멍을 메우고 있다 |

## HUMAN 대기

Human 이 답하면 풀리는 것들이다. 답의 자리는 괄호가 가리킨다.

| 무엇 | 풀리는 것 |
|---|---|
| WORLD·ITEM 후보 선택 (frontier/item.md SELECTED) | WORLD·ITEM 레인 착수 |
| C-COMBAT-001 Human Play — 손으로 `U` → 숫자를 눌러 보기 | Stage 8 STATUS 가 COMPLETE 로 닫히고 FEEDBACK 레인이 열린다. 봐야 할 것 셋: 두 걸음이 전투 중 손에 맞는가 · 세로 목록 넷이 눈에 걸리는가 · 상대의 `[몸]` 표시가 교전 중 읽히는가 |
| C-COMBAT-001 의 PARTIAL 판정 둘 (08-verification.md MASTER FEEDBACK) | `MC-AURA-ALLOCATION` · `MP-EXPLOIT-OPEN-BODY` 를 어디까지로 볼 것인가 — 플레이로는 갈래가 성립하나 노드는 덜 찼다. Master(Human)가 정한다 |
| `lanes:check` 의 SELECTED 규칙 (PROCESS — 이 판을 고치지 않고 보고만 한다) | 지금 이 판에서 어긋남 1건이 상시로 뜬다. 검사는 "SELECTED 가 있으면 레인은 OPEN·RUNNING" 만 보고 **그 트랙의 Cycle 이 도는 중인지를 보지 않는다** — works.md 는 Human 대기면 HUMAN 이라 적었으므로 판이 맞고 검사가 좁다. 고칠 자리는 `tools/lanes/build.ts` 의 `crossCheck` 이며 재료는 이미 있다 (`t.cycle` 의 Stage·Status). PROCESS 가 HOLD 라 착수하지 않았다 |
| 문서의 분류 다섯에 `도구` 를 더할 것인가 (Design-View-Inventory-Equipment-UX-D1 §6) | 곡괭이가 `기타` 대신 자기 칸을 얻는다 (V-008 REPORT) |
| Q37 — 자리에 이름을 줄 것인가 (open-questions.md) | FR-ARRANGE-WHAT-YOU-CARRY 존치/삭제 |
| Design-Creature-Behavior-R0.md 승인 | Inject → MC-PREDICT · MC-OBSERVE 습성 해금 |
| Design-Resource-Catalog-R0.md 승인 | Inject → Q36 · 회복 아이템 해금 · BT 자원 24종의 자리 (그 문서가 받기로 정해졌다 — HISTORY Q50(a)) · GS 의 Class Catalyst 자리 |
| 계열별 요정 문서(백왕 성장 · Layer0) 주입 | CL-* 착수 — 이름의 소유는 정해졌다 (HISTORY Q55(b)). MC-CHANGE-CLASS 가 넘어갈 형태가 생긴다 |
