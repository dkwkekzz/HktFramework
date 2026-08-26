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
| WORLD·COMBAT | OPEN | `C-COMBAT-001` 착수 대기 — SELECTED `FR-WHERE-YOUR-POWER-SITS`(지금 힘이 어디에 몰려 있는가). Stage 1 부터, 아직 시작하지 않았다. 남은 후보 아홉이 UL 전체를 덮는다 | 없음 — 다만 이 판과 트랙 파일이 main 에 들어간 뒤에 잡는다 |
| WORLD·TERRAIN | OPEN | `C-TERRAIN-001` 착수 대기 — SELECTED `FR-THE-GROUND-HAS-A-LAW`(땅이 법칙을 지닌다). Stage 1 부터, 아직 시작하지 않았다. 시각화의 소유 분해·진행 순서는 [design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md) 를 따른다 | 없음 — 다만 이 판과 트랙 파일이 main 에 들어간 뒤에 잡는다 |
| WORLD·GROWTH | OPEN | `C-GROWTH-001` 착수 대기 — SELECTED `FR-WHAT-YOU-DID-MAKES-YOU`(한 일이 몸을 키운다). Stage 1 부터, 아직 시작하지 않았다. **COMBAT 과 같은 파일을 본다 — 아래 충돌 칸** | 없음 — 다만 이 판과 트랙 파일이 main 에 들어간 뒤에 잡는다 |
| VIEW | OPEN | BACKLOG 다음 항목(tooltip-on-focus)부터 — equipment-panel 은 아래 충돌 칸 | 없음 |
| MASTER | OPEN | OPTIONS Q35 (몸이 아닌 존재를 요구하는 Possibility) — 이제 스킬 실행 형태의 빈 다섯 칸만 막는다. 성장(GS · GB)과 전투 상층(UL) 주입은 둘 다 끝났다: 결정 열(Q52~Q61) 반영 · GROWTH 후보 3 · COMBAT 후보 10 과 SELECTED 까지 | 없음 — 미처리 Feedback 이 0 이다 (`npm run feedback:gate`) |
| ENGINE | OPEN | 셋 — ① 남은 기반 문구(겹침 표면·슬롯 띠·손가락 띠·이어짐; 명령 표면이 간 길 그대로) ② 표면 안의 **초점 차례**(`tabindex` 0건 — Tab 이 글자 자리·슬롯에 한 번에 닿지 못한다) ③ 지면 구역 장치 `SceneGroundZone` ([design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md)) — C-TERRAIN-001 의 04 확정 뒤 | 없음 |
| PROCESS | HOLD | 없음 | — (공정 변경 중에는 다른 레인을 새로 띄우지 않는다) |

## 레인 사이 충돌 — 순서가 아니라 파일이 겹치는 곳

표의 "기다리는 것" 이 잡지 못하는, 동시에 돌 때의 겹침만 적는다.

| 겹침 | 지금의 판단 |
|---|---|
| VIEW 의 equipment-panel ↔ WORLD·ITEM | ITEM Cycle 이 장비 유효 값 화면을 건드릴 수 있다 — equipment-panel 은 ITEM Cycle 병합 뒤에 연다 (그 뒤의 drag-and-drop · responsive-workspace 도 함께 밀린다) |
| WORLD·TERRAIN ↔ WORLD·ITEM | **지금은 겹치지 않는다** — 고른 것이 첫 후보(땅이 법칙을 지닌다)라 아이템 파일에 닿지 않는다. 겹치는 것은 셋째 후보(FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED)이며, 그것을 고를 때 ITEM 이 무엇을 도는 중인지 먼저 본다 |
| WORLD·TERRAIN ↔ VIEW | 땅은 화면에 보여야 하므로 이 Cycle 이 `view/` 를 건드린다. VIEW 의 다음 항목(tooltip-on-focus)은 상세를 여는 자리라 자리가 다르지만 표면 상태·HUD 에서 스칠 수 있다 — **둘 다 자기 영역 끝에 추가만 하고 기존 줄을 옮기지 않는다** (frontier/README.md 공유 지점 규칙과 같다) |
| WORLD·GROWTH ↔ WORLD·TERRAIN | 둘 다 `world/semantic/actor.ts` 에 몸의 새 자리를 더한다 (성장은 쌓이는 것, 땅은 거두어 가는 것). **자기 영역 끝에 추가만 하고 기존 줄을 옮기지 않는다** (frontier/README.md 공유 지점 규칙). 둘 다 관찰 계약을 넓히므로 `gameview-*` 도메인 파일도 각자 자기 파일에만 더한다 |
| **WORLD·GROWTH ↔ WORLD·COMBAT** | **이제 겹친다.** "COMBAT 이 후보 0 이라 겹치지 않는다" 던 조건이 UL 주입으로 사라졌다. 둘 다 `world/semantic/combat.ts` 의 **유효 값 계산**(`effectiveStat`)에 항을 더한다 — 성장은 자란 값을, 배분은 지금 몰아 둔 곳을. 같은 함수 안이라 끝에 추가하는 것으로 갈라지지 않는다. **둘 중 하나를 먼저 돌리고 다른 쪽은 병합 뒤 최신 main 위에서 잡는다** — 순서는 Human 이 정한다 (아래 HUMAN 대기) |
| WORLD·COMBAT ↔ VIEW | 상층 후보 열이 전부 전투 HUD 에 자리를 요구한다 (지금의 배분 · 대답 가능 여부 · 기회). VIEW 와 같은 파일(`hud-presentation.ts` · `combat-presentation.ts`)에서 만나므로 위와 같은 규칙 — 자기 영역 끝에 추가만 한다 |
| VIEW 의 touch-reason ↔ ENGINE | ENGINE 이 열었다 — touch-pad 가 `unavailableText` 를 버튼에 그린다. VIEW 는 눈검증·백로그 정리만 남았다 |
| WORLD·TERRAIN ↔ ENGINE | ENGINE 의 지면 구역 장치(`SceneGroundZone`)를 TERRAIN 의 Stage 7 이 소비한다 — 04 가 관찰 표면을 확정한 뒤 ENGINE 이 착수하고, fallback(안 그림)이 있어 BLOCKED 는 아니다. 소유 분해·순서: [design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md) |
| VIEW 의 슬롯 띠·표면 문구 ↔ ENGINE | ENGINE 이 남은 기반 문구를 회수하면 `hud/surface.ts` · `hud/slot-bar.ts` 가 팩의 문구 표를 타게 된다 — 그때 그 표에 줄이 는다 (VIEW 가 쓰는 자리이므로 병합 뒤에 잇는다) |
| VIEW 의 skill-focus-order ↔ ENGINE | 초점 차례를 세우는 자리가 기반이면 ENGINE 동반이 필요하다 — 지금은 팩 키(`L`)가 지름길로 그 구멍을 메우고 있다 |

## HUMAN 대기

Human 이 답하면 풀리는 것들이다. 답의 자리는 괄호가 가리킨다.

| 무엇 | 풀리는 것 |
|---|---|
| WORLD·ITEM 후보 선택 (frontier/item.md SELECTED) | WORLD·ITEM 레인 착수 |
| GROWTH 와 COMBAT 중 어느 Cycle 을 먼저 돌리는가 | 둘이 같은 함수(`effectiveStat`)에 손대므로 동시에 못 돈다 — 뒤로 밀리는 쪽은 병합 뒤 최신 main 위에서 잡는다 (위 충돌 칸) |
| 문서의 분류 다섯에 `도구` 를 더할 것인가 (Design-View-Inventory-Equipment-UX-D1 §6) | 곡괭이가 `기타` 대신 자기 칸을 얻는다 (V-008 REPORT) |
| Q37 — 자리에 이름을 줄 것인가 (open-questions.md) | FR-ARRANGE-WHAT-YOU-CARRY 존치/삭제 |
| Design-Creature-Behavior-R0.md 승인 | Inject → MC-PREDICT · MC-OBSERVE 습성 해금 |
| Design-Resource-Catalog-R0.md 승인 | Inject → Q36 · 회복 아이템 해금 · BT 자원 24종의 자리 (그 문서가 받기로 정해졌다 — HISTORY Q50(a)) · GS 의 Class Catalyst 자리 |
| 계열별 요정 문서(백왕 성장 · Layer0) 주입 | CL-* 착수 — 이름의 소유는 정해졌다 (HISTORY Q55(b)). MC-CHANGE-CLASS 가 넘어갈 형태가 생긴다 |
