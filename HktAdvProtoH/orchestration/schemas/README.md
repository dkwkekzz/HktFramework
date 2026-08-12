# Orchestration Schemas

Agent Execution Layer 의 공식 Artifact 스키마. [Design-AgentExecution.md](../../design/Design-AgentExecution.md) §15·§18·§27·§29·§34 를 기계 검증 가능한 형태로 고정한 것이다.

## 스키마 선언 형식 (mini-schema)

각 `*.schema.yaml` 은 다음 형식으로 필드를 선언하며,
`scripts/validation/verify.mjs schema <name> <file>` 이 이를 읽어 대상 YAML 을 검증한다.

```yaml
schema: <name>
version: 1
fields:
  <dot.path>:            # 중첩 경로. `*` 는 임의 키(맵의 모든 값)에 매칭
    type: string|int|number|bool|list|map|any
    required: true|false # 기본 false. `*` 경로의 required 는 "존재하는 각 항목에 필수" 의미
    enum: [A, B]         # 허용 값 제한 (선택)
    pattern: "^C[0-9]+$" # 정규식 제한 (선택, string 전용)
    item_type: string    # list 원소 타입 (선택)
```

## 스키마 목록

| 스키마 | 대상 | 근거 |
|---|---|---|
| `cycle_state.schema.yaml` | `cycles/<id>/cycle_state.yaml` | §18 |
| `task.schema.yaml` | `cycles/<id>/tasks/*.yaml` (Task Envelope) | §15 |
| `verification_result.schema.yaml` | 각 Gate 의 검증 결과 | §20 |
| `handoff_result.schema.yaml` | Worker Session 종료 보고 | §27 |
| `contract_gap.schema.yaml` | GameView Contract Gap Proposal | §29 |
| `migration_request.schema.yaml` | Frozen Module Version Migration 요청 | §34 |
