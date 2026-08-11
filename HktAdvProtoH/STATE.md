# STATE.md — 작업 상태

> 이 트랙의 **모든 작업 상태는 이 문서 하나에만** 기록한다. 다른 곳에 진행 상태를 중복 기록하지 않는다.
> 갱신 시점: 각 Stage 종료 시(진행 표), Cycle 병합 시(Baseline·Backlog), 새 Cycle 시작 시(현재 Cycle 교체).

## 현재 Cycle

**활성 Cycle 없음.** CYCLE-001 Scope Definition 대기 (후보: Mining / Resource Extraction — [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) §21 예시. Capability 선택은 인간 결정).

| Stage | Artifact (cycles/cycle-XXX/) | 상태 |
|---|---|---|
| 0. Scope Definition | 00-cycle-contract.md | — |
| 1. Intent | 01-intent-package.md | — |
| 2. World Model | 02-world-definition.md | — |
| 3. Human Semantic Review | 03-semantic-review.md | — |
| 4. Implementation | 04-implementation-result.md | — |
| 5. Verification | 05-verification-report.md | — |
| 6. Evolution Compatibility | 06-evolution-review.md | — |
| 7. Baseline Merge | (아래 Baseline 갱신) | — |

## World Baseline

실제 구현·검증 완료된 World Semantic만 기재한다. Cycle의 Verification + Evolution Compatibility가 모두 통과한 뒤에만 갱신한다. 구현 세부(클래스/파일)는 기재하지 않는다.

### v0 — 빈 세계

```text
Supported State:          (없음)
Supported Rules:          (없음)
Supported Goals:          (없음)
Supported Possibilities:  (없음)
Observable:               (없음)
```

### History

| Baseline | Cycle | Capability Added | 병합일 |
|---|---|---|---|
| v0 | — | 초기 상태 (빈 세계) | 2026-08-11 |

## Evolution Backlog

장기적으로 필요할 가능성이 있는 유예 Semantic. **Backlog에 있다는 이유로 World State에 placeholder/dummy field를 만들지 않는다.**
추가 형식: `- <Semantic> — (CYCLE-XXX에서 유예) <사유>`

- Multiple Actor contention
- Resource ownership
- Resource regeneration
- Persistence
- Network authority
- Regional simulation
- Economy
- Guild
- Social relationship
- Ecology

## TODO

- [ ] CYCLE-001 Scope Definition — Cycle Contract 작성 ([WORKFLOW.md](WORKFLOW.md) Stage 0)
