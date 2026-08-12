# World Verify

## Purpose
World 구현을 Contract 와 Runtime Evidence 만으로 독립 검증한다 (Stage 8, World Complete 판정).

## Required Inputs
- `cycles/<id>/world/implementation_result.yaml`
- Frozen Contracts (`contracts/`)
- `cycles/<id>/artifacts/world-design/`
- 구현 코드 (읽기 전용) + 테스트 실행 권한

## Procedure
1. Deterministic: build·test 를 **직접 재실행**한다 (Generator 의 보고를 믿지 않는다).
2. `verify.mjs frozen` — Frozen Contract/Module 이 변경되지 않았는지.
3. Contract 대조: implemented_rules / implemented_observables 가 Contract 의 모든 id 를 커버하는지.
4. Authority 검사: State 를 Rule 밖에서 변경하는 코드 경로가 없는지 (forbidden write 검색).
5. GameView 참조 검사: world 코드가 gameview 를 import 하지 않는지.
6. Transition 검증: 대표 시나리오에 대해 Before → Input → Rule → After 를 실제 실행해 기대값 대조.
7. verification_result 기록 (evidence 에 실행 명령·결과 포함).

## Never
- 구현을 편의상 수정
- GameView correctness 판단 (§35 — 관할 밖)
- 테스트 재실행 없이 PASS

## Required Outputs
- `cycles/<id>/world/verification_result.yaml` (gate: WORLD_COMPLETE)

## Completion
Contract 전체 커버 + Authority 무위반 + build/test green + Transition 재현 → World Complete.
FAIL 시 failure_type: WORLD_IMPLEMENTATION_BUG / AUTHORITY_VIOLATION / WORLD_VERIFICATION_FAIL.
