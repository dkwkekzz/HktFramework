# Orchestration — Agent Execution Layer

[Design-AgentExecution.md](../design/Design-AgentExecution.md) 의 Agent Execution Layer 구현.
게임 의미·개발 공정의 Source of Truth 는 [Design-CycleWorkflow.md](../design/Design-CycleWorkflow.md),
그 공정을 Agent 가 실행하는 방법의 Source of Truth 는 Design-AgentExecution.md 다.

## 이 트랙에서의 구현 형태

이 환경에서 Orchestrator / Session / Verifier 는 **Claude Agent Session** 이 수행한다.

- **Runner 프로토콜** ([runner/](runner/)) — 각 역할의 Agent 가 따라야 하는 절차 문서.
  - [runner/orchestrator.md](runner/orchestrator.md) — Control Plane: 상태 머신, Task 생성, Freeze, Routing
  - [runner/session_runner.md](runner/session_runner.md) — Worker Session: Task Envelope 실행 규약
  - [runner/verifier_runner.md](runner/verifier_runner.md) — Verifier Session: 독립 검증 규약
- **Deterministic 검증** — AI 판단이 필요 없는 검사는 전부 Script:
  [`scripts/validation/verify.mjs`](../scripts/validation/verify.mjs) (Node 내장만 사용, 의존성 없음).
- **Schemas** ([schemas/](schemas/)) — 공식 Artifact 의 기계 검증 스키마 6종.
- **Failure Routing** ([routing/failure_routes.yaml](routing/failure_routes.yaml)) — §33 표의 기계화.

## 상태의 위치

| 무엇 | 어디 |
|---|---|
| Cycle 진행 상태 | `cycles/<id>/cycle_state.yaml` (유일한 재개 기준) |
| Session 간 통신 | `cycles/<id>/artifacts/` 등 공식 Artifact 파일 |
| Cycle 간 공유 지식 | `registry/{semantics,modules,contracts}.yaml` |
| Frozen 경계 | `contracts/` + registry 의 sha256 (Script 로 보호 검증) |

대화 기록은 상태가 아니다. 어떤 Session 도 이전 Session 의 대화를 요구할 수 없다.

## 빠른 사용법

```bash
# 개별 검사
node scripts/validation/verify.mjs schema cycle_state cycles/C001/cycle_state.yaml
node scripts/validation/verify.mjs envelope cycles/C001/tasks/C001-SEMANTIC-001.yaml
node scripts/validation/verify.mjs closure C001      # Semantic Closure trace 완전성
node scripts/validation/verify.mjs frozen            # Frozen Contract/Module 해시 보호
node scripts/validation/verify.mjs registry          # Registry 정합성

# Cycle 전체 감사 (schema + envelope + outputs + session index + closure)
node scripts/validation/verify.mjs cycle C001

# 환경 전체 (registry + frozen + 모든 cycle)
node scripts/validation/verify.mjs all
```

모든 검사는 위반 시 exit code 1 로 실패한다. Orchestrator 는 Gate 평가 전 반드시 해당 검사를 실행한다.
