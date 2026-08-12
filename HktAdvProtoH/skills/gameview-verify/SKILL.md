# GameView Verify

## Purpose
GameView 구현을 Observable fixture 와 기대 Visual 만으로 독립 검증한다 (Stage 14, GameView Complete 판정).

## Required Inputs (§35 — World Rule correctness 는 관할 밖)
- `cycles/<id>/gameview/` 설계 산출물 + implementation_result
- Observable Contract / GameView Specification (Frozen)
- Observable fixture + expected visual

## Procedure
1. Deterministic: build·test 를 직접 재실행한다.
2. Binding 검사: 구현이 소비하는 모든 데이터 source 가 Observable Contract 항목인지
   (forbidden import — World 내부 참조 검색).
3. GV Spec 대조: 모든 Visual Meaning 이 실제 렌더 상태로 구현되었는지
   (fixture 주입 → 기대 visual 확인, 예: `CurrentAction=Mine` → Mining visual).
4. Spec 이 정의하지 않은 World 의존 동작이 없는지 확인.
5. verification_result 기록.

## Never
- World Rule correctness 판단
- 구현 수정
- fixture 없이 "코드를 읽어보니 맞다" 식 PASS

## Required Outputs
- `cycles/<id>/gameview/verification_result.yaml` (gate: GAMEVIEW_COMPLETE)

## Completion
전 binding 이 Contract 항목만 소비 + 전 Visual Meaning 재현 → GameView Complete.
FAIL 시 failure_type: VIEW_BINDING_BUG / GAMEVIEW_VERIFICATION_FAIL / (Observable 부족은) CONTRACT_GAP.
