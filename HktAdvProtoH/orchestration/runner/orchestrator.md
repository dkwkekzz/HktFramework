# Orchestrator Runner Protocol

Cycle Orchestrator 역할을 맡은 Agent Session 이 따르는 절차.
근거: [Design-AgentExecution.md](../../design/Design-AgentExecution.md) §7·§16·§39·§40.

## 책임

cycle_state 관리 · 다음 Task 결정 · Worker Session 생성 · Verification Gate 평가 ·
Failure Routing · Contract Freeze/Version 관리 · Cycle Commit.

## 금지 (§7)

- Intent / World Rule / GameView Visual 을 직접 설계하지 않는다.
- Worker 결과를 임의로 PASS 시키지 않는다 — Gate 는 항상 Verifier(Script 우선)가 평가한다.
- Registry 내용을 대화 기억으로 추정하지 않는다 — 항상 파일을 읽는다.
- Contract Gap 을 World 접근으로 우회하지 않는다.
- Frozen Module / Frozen Contract 를 직접 수정하지 않는다.

## State Machine (§39)

```
START_CYCLE → SCOPE → SCOPE_VERIFY → INTENT → INTENT_VERIFY
→ WORLD_SEMANTIC → SEMANTIC_VERIFY → AUTHORITY → AUTHORITY_VERIFY
→ OBSERVATION → OBSERVABLE_VERIFY → GAMEVIEW_SPEC → CONTRACT_VERIFY
→ FREEZE_CONTRACT
→ [WORLD_BRANCH ∥ GAMEVIEW_BRANCH]  (병렬 — Freeze 이전에는 시작 금지)
→ WORLD_VERIFY / GAMEVIEW_VERIFY
→ INTEGRATION → INTEGRATION_VERIFY → PLAYABLE_VERIFY
→ MODULE_PACKAGE → REGISTRY_COMMIT → COMPLETE_CYCLE
```

`cycle_state.yaml` 의 stage 키: `scope, intent, world_semantic, authority, observation,
gameview_spec, world_implementation, world_verification, gameview, integration,
playable_verification, packaging`.

## 절차

### START_CYCLE

1. 사용자로부터 **플레이 가능한 Cycle Goal** 을 받는다 (기술 작업 목록 거부).
2. 다음 Cycle id 를 결정한다 (`cycles/` 스캔, `C###`).
3. `cycles/<id>/goal.yaml`, `cycle_state.yaml` 을 생성한다 (모든 stage `NOT_STARTED`).
4. `registry/modules.yaml` 을 조회해 재사용 가능한 Capability 를 goal.yaml 의
   `existing_capabilities` 로 기록한다 — 재구현 방지 (Rule 10).

### ADVANCE_CYCLE (반복 단위)

§40 pseudocode 를 따른다.

1. `cycle_state.yaml` 을 읽는다 (대화 기억 금지).
2. 다음 Stage 를 결정하고 `cycles/<id>/tasks/<TASK-ID>.yaml` Task Envelope 를 작성한다.
   - 6요소(Skill/Task/Input/Permission/Output/Gate) 필수.
   - 작성 직후 `verify.mjs envelope <file>` 로 자가 검증한다.
   - Permission 은 §35 Context Permission Matrix 를 따른다.
3. Worker Session 을 격리 실행한다 (Agent tool 또는 독립 세션).
   전달하는 것은 **Task Envelope 경로 하나** — 설계 히스토리·대화 요약 전달 금지.
4. Handoff Result 를 수취한다 (`handoff_result` schema).
   - `BLOCKED` → blocker artifact(예: contract_gap)를 routing 표에 따라 처리.
5. Verifier Session 을 실행한다 (Generator 와 다른 Session, [verifier_runner.md](verifier_runner.md)).
6. `verification.result` 로 분기:
   - `PASS` → stage_status 갱신, committed_artifacts 에 추가, 다음 Stage.
   - `FAIL` → `failure_type` 을 [failure_routes.yaml](../routing/failure_routes.yaml) 로 분류,
     책임 Stage 에 **새 Correction Task** 를 만든다. 같은 Task 재시도 금지.
7. 매 전이 후 `cycle_state.yaml` 을 즉시 갱신한다.

### FREEZE_CONTRACT

CONTRACT_VERIFY PASS 후에만:

1. Observable Contract / GameView Spec / Command Contract 를 `contracts/` 아래로 승격한다.
2. `registry/contracts.yaml` 에 등록한다 — `status: FROZEN`, `path`, `sha256`
   (`sha256sum` 으로 계산).
3. `cycle_state.yaml` 의 `contract.version` 설정, `contract.frozen: true`.
4. 이후 `verify.mjs frozen` 이 매 Gate 마다 해시 불변을 강제한다.
5. Freeze 후에만 WORLD_BRANCH 와 GAMEVIEW_BRANCH 를 병렬로 시작할 수 있다.

Contract 변경이 필요해지면 수정이 아니라 **VERSION_CONTRACT** (새 버전 발급 → 재검증 → Re-Freeze).

### COMPLETE_CYCLE

1. Playable Verification PASS 확인.
2. `module-package` Task 실행 → Module 산출물 고정, registry 3종 갱신
   (모듈 `status: FROZEN` + sha256).
3. `verify.mjs all` 전체 통과 확인.
4. `cycle_state.yaml` → `status: COMPLETE`.
5. git commit — Cycle 디렉토리는 대화 없이 재현 가능한 실행 로그다.

## Session Index

모든 Session 실행을 `cycles/<id>/logs/session-index.yaml` 에 기록한다 (§36):
`id / task / skill / result`.
