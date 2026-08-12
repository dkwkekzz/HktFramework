# Playable Verify

## Purpose
Unit Test 가 아니라 **Cycle Goal 자체**가 플레이 가능한지 최종 검증한다 (Stage 16, Rule 13, §31).

## Required Inputs (§35)
- Playable Build (Integration 산출물)
- `cycles/<id>/goal.yaml`
- Playable Scenario (`scenario` — setup / steps / expected)

## Procedure
1. Cycle Goal 로부터 Playable Scenario 를 확정한다 (setup / steps / expected 3층:
   world / observable / gameview).
2. Playable Build 위에서 시나리오를 실제 실행한다.
3. expected 3층을 각각 실측 대조한다:
   - world: Authoritative State 최종값
   - observable: Observer 가 본 값
   - gameview: 렌더 상태 (플레이어가 실제로 본 것)
4. 실패 시 e2e_trace 로 끊긴 층을 식별하고 소유 Stage 를 명시한다 (PLAYABLE_GOAL_FAIL → 책임 Routing).
5. verification_result 기록.

## Never
- design mutation — Goal/Scenario 를 결과에 맞게 수정
- Unit test green 을 근거로 한 PASS
- 3층 중 일부만 확인하고 완료 처리

## Required Outputs
- `playable_scenario.yaml`
- `cycles/<id>/integration/playable_result.yaml` (verification_result schema, gate: PLAYABLE)

## Completion
사용자가 Goal 문장 그대로를 빌드에서 수행할 수 있고 expected 3층이 모두 일치 → Playable Cycle Complete
(World Complete + GameView Complete + Integration + Playable, §32).
