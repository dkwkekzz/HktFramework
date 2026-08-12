# Session Runner Protocol (Worker)

Worker Session 역할을 맡은 Agent 가 따르는 절차.
근거: [Design-AgentExecution.md](../../design/Design-AgentExecution.md) §6·§15·§17·§19·§35.

## 시작 규약

Worker Session 은 **Task Envelope 하나로 시작한다.** 그 외의 지시·히스토리·대화 요약은 받지 않는다.

1. Task Envelope (`cycles/<id>/tasks/<TASK-ID>.yaml`) 를 읽는다.
2. `task.skill` 에 해당하는 `skills/<skill>/SKILL.md` 를 읽는다.
3. `task.allowed_inputs` 의 파일만 입력으로 읽는다.

## Permission 규약

- **read**: `task.read_scope` 안에서만 읽는다.
- **write**: `task.write_scope` 안에만 쓴다.
- **forbidden**: `task.forbidden_scope` 는 읽기도 금지다.
  GameView Session 의 World 내부, World Session 의 GameView 내부가 대표적이다 (§35 Matrix).
- Frozen Contract / Frozen Module / Intent 는 어떤 Session 도 수정할 수 없다.
- Task Boundary 를 넘는 변경이 필요하면 **직접 하지 말고** BLOCKED 로 종료해
  Orchestrator 에게 새 Task 생성을 요청한다.

## Coding Session (§6.2)

한 Session 안에서 `inspect → edit → build → test → fix → re-test` 는 허용.
단 Intent 변경 / Contract 변경 / Frozen Module 수정 / 타 Branch 구현은 불가.

## 종료 규약

1. `task.required_outputs` 를 **전부** `task.write_scope` 아래에 생성한다.
   하나라도 못 만들면 `COMPLETE` 가 아니다.
2. Handoff Result 를 write_scope 안에 남긴다 (`handoff_result` schema):
   `task_id / session_id / skill / status / outputs / unresolved`.
3. status:
   - `COMPLETE` — 모든 출력 생성, unresolved 없음(또는 명시).
   - `BLOCKED` — 진행 불가. blocker artifact 를 만들고 `handoff.blocker` 로 가리킨다.
     (예: GameView 의 Observable 부재 → `contract_gap` Proposal, §29)
   - `FAILED` — 시도했으나 실패. 원인을 unresolved 에 기록.
4. 자기 결과를 스스로 PASS 판정하지 않는다 — Gate 평가는 Verifier 의 몫이다 (§20).
5. Session 의 대화 Context 는 버려진다. 다음 Session 에 필요한 모든 것은 Artifact 에 있어야 한다.

## Artifact 규약 (§19)

- Machine-readable 우선: YAML / JSON / source / test result / trace.
- Artifact 는 자기 완결적이어야 한다 — "이전 세션에서 논의한 대로" 같은 참조 금지.
