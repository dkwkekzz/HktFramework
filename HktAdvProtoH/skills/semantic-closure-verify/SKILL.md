# Semantic Closure Verify

## Purpose
Intent 의 모든 의미가 World State 또는 World Rule 로 해소되는지 독립 검증한다 (§21, Rule 2).

## Required Inputs
- `cycles/<id>/artifacts/intent/intent.yaml`
- `cycles/<id>/artifacts/world-design/` 전체 (semantic_dependencies / semantic_delta / world_state / world_rules / intent_trace)
- `registry/semantics.yaml`

## Procedure
1. Deterministic 먼저: `node scripts/validation/verify.mjs closure <cycle>` 실행
   — trace 의 모든 항목이 resolved_to 를 갖고, 대상 id 가 world_state/world_rules 에 실재하는지.
2. Intent 의 의미 문장을 직접 열거하고 intent_trace 와 대조한다 — trace 에 누락된 의미가 없는지 (SEMANTIC_GAP).
3. semantic_delta 의 각 항목을 Registry 와 대조한다 — 기존 semantic 과 의미가 겹치면 SEMANTIC_DUPLICATION.
4. world_state 에 구현 내부 상태(cache/thread/packet 등)가 없는지 검사한다.
5. verification_result 를 기록한다 (evidence 에 실행 명령·대조 근거 포함).

## Never
- 산출물을 직접 수정 (Verifier 는 고치지 않는다, FAIL 로 보고)
- Generator 의 reasoning 요청
- 하나라도 미해소인데 PASS 판정

## Required Outputs
- `semantic_closure.yaml` (verification_result schema, gate: SEMANTIC_CLOSURE)

## Completion
모든 Intent 의미가 State/Rule 로 추적되고 중복·구현오염이 없으면 PASS.
하나라도 실패하면 FAIL + failure_type (SEMANTIC_GAP / SEMANTIC_DUPLICATION).
