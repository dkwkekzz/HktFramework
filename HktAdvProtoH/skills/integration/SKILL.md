# Integration

## Purpose
World Capability Module 과 GameView Module 을 Contract 로만 결합해 Playable Composition 을 만든다 (Stage 15).

## Required Inputs (§30)
- World Capability Module (verification 통과분)
- GameView Module (verification 통과분)
- Observable Contract / GameView Specification (Frozen)
- World Configuration (초기 배치·설정)

## Procedure
1. 두 Module 을 Contract 경계로만 연결한다 — Module 내부를 수정하지 않는다.
2. World Configuration 으로 실행 가능한 조합(Playable Composition)을 구성한다.
3. E2E Trace 를 실제 실행으로 검증한다:
   `Client Input → World Command → Authoritative Rule → World Transition
   → Observer Projection → Observable → GameView Binding → Rendering`
4. 각 단계의 실측값을 `e2e_trace.yaml` 로 기록한다 (§30 — Contract id 로 연결).
5. 사슬이 끊기면 끊긴 단계와 소유 Stage 를 기록하고 FAIL 처리한다 (임시 우회 금지).

## Never
- World Rule / GameView Binding 수정 (발견된 문제는 Routing 으로)
- Module 내부 구현 세부 의존 (§35 — avoid internals)
- Contract 를 거치지 않는 직접 연결

## Required Outputs
- `cycles/<id>/integration/composition.yaml`
- `cycles/<id>/integration/e2e_trace.yaml`
- `cycles/<id>/integration/verification_result.yaml` (gate: INTEGRATION)

## Completion
E2E 사슬 전 단계가 Contract id 로 연결된 실측 Trace 로 재현된다.
FAIL 시 failure_type: INTEGRATION_FAILURE (원인 Stage 명시).
