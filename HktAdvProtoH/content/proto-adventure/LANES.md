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
| VIEW | OPEN | BACKLOG 다음 항목(request-feedback)부터 — equipment-panel 은 아래 충돌 칸 | 없음 |
| MASTER | BLOCKED | OPTIONS Q35 (몸이 아닌 존재를 요구하는 Possibility) | FEEDBACK 의 병합 (미처리 Feedback 이 먼저다) |
| ENGINE | OPEN | 기반 부채 하나 — 표시 문구를 사유 코드로 바꿔 팩에 회수 (C009 폭이 넓고 조립·팩 채택 동반 — 착수 전 범위 확인) | 없음 |
| PROCESS | HOLD | 없음 | — (공정 변경 중에는 다른 레인을 새로 띄우지 않는다) |

## 레인 사이 충돌 — 순서가 아니라 파일이 겹치는 곳

표의 "기다리는 것" 이 잡지 못하는, 동시에 돌 때의 겹침만 적는다.

| 겹침 | 지금의 판단 |
|---|---|
| VIEW 의 equipment-panel ↔ WORLD·ITEM | ITEM Cycle 이 장비 유효 값 화면을 건드릴 수 있다 — equipment-panel 은 ITEM Cycle 병합 뒤에 연다 (그 뒤의 drag-and-drop · responsive-workspace 도 함께 밀린다) |
| VIEW 의 touch-reason ↔ ENGINE | ENGINE 이 열었다 — touch-pad 가 `unavailableText` 를 버튼에 그린다. VIEW 는 눈검증·백로그 정리만 남았다 |

## HUMAN 대기

Human 이 답하면 풀리는 것들이다. 답의 자리는 괄호가 가리킨다.

| 무엇 | 풀리는 것 |
|---|---|
| WORLD·ITEM 후보 선택 (frontier/item.md SELECTED) | WORLD·ITEM 레인 착수 |
| Q37 — 자리에 이름을 줄 것인가 (open-questions.md) | FR-ARRANGE-WHAT-YOU-CARRY 존치/삭제 |
| Design-Creature-Behavior-R0.md 승인 | Inject → MC-PREDICT · MC-OBSERVE 습성 해금 |
| Design-Resource-Catalog-R0.md 승인 | Inject → Q36 · 회복 아이템 해금 |
