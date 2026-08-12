# Architecture Rules — Integration

근거: [Design-AgentExecution.md](../Design-AgentExecution.md) §2 Rule 9·10·13, §30~§34, [Design-CycleWorkflow.md](../Design-CycleWorkflow.md) Part III.

## Rule 9 — Integration Independence

World와 GameView의 실제 결합은 별도 Integration Workflow가 담당한다.
World/GameView Session은 서로를 직접 결합하지 않는다.

## Rule 10 — Module Reuse

완료된 Module은 후속 Cycle에서 다시 구현하지 않는다.
새 Capability는 Module Registry를 먼저 조회하고, provides가 있으면 Reuse한다.

## Rule 13 — Playable Verification

모든 Cycle은 실제 Cycle Goal을 플레이 가능한 형태로 검증하고 종료한다.
Unit Test 통과 ≠ Cycle Complete.

## E2E Trace (§30)

Integration은 다음 사슬 전체를 검증하고 `e2e_trace.yaml`로 남긴다.

```
Client Input → World Command → Authoritative Rule → World Transition
→ Observer Projection → Observable → GameView Binding → Rendering
```

## 세 종류의 Completion (§32)

- **World Complete** — Intent/State/Rule/Authority/Observable/Traceability + World Runtime Verification
- **GameView Complete** — Specification/Composition/Asset Binding/Observable Binding/Rendering + View Verification
- **Playable Cycle Complete** — World Complete + GameView Complete + Integration Verification + Playable Goal Verification

Rendering 문제를 World Capability 실패로 취급하지 않는다.

## Frozen Module 정책 (§34)

- Cycle Complete 후 World Capability Module과 GameView Module은 FROZEN이다.
- 후속 Cycle은 Requires / Provides만 사용한다.
- Frozen Module 직접 수정 금지 — New Capability Module / Extension Module 우선.
- 기존 Semantic 자체가 잘못된 경우에만 `VERSION_MIGRATION_REQUEST` (명시적 Migration, v1 → v2).

## 검증 (Verifier가 확인할 것)

- E2E Trace의 모든 단계가 Contract id로 연결됨
- Playable Scenario가 Cycle Goal 자체를 검사함 (world/observable/gameview 3층 expected)
- Frozen path 변경 없음 (`scripts/validation/verify.mjs frozen`)
- Registry 갱신이 검증 통과 산출물만 포함함
