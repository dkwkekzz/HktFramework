# design/graphs — Goal/Possibility Graph (Human Design 진본)

이 디렉토리의 Graph 파일이 게임 의도의 Source of Truth 다 ([../Design-Workflow.md](../Design-Workflow.md) §3, §30 Rule 1).

- 도메인별 한 파일: `<도메인>.md` (예: `mining.md`, `combat.md`) — 형식은 [../../workflow/templates/graph.md](../../workflow/templates/graph.md)
- **인간만 수정한다.** Agent 는 노드 추가/삭제/의미 변경 불가 — Gap Proposal 로 제안만 한다.
- 노드 ID (`GOAL-*`, `POSS-*`) 는 한 번 부여하면 변경하지 않는다. 하위 Intent/Rule 이 이 ID 로 추적된다.
