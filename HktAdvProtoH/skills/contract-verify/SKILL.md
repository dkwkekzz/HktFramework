# Contract Verify

## Purpose
Contract Boundary 산출물(Authority / Observable / GameView Spec)을 독립 검증하고
Freeze 가능 여부를 판정한다 (§22~§24).

## Required Inputs
- `cycles/<id>/artifacts/world-design/`
- `cycles/<id>/artifacts/contracts/` (authority / command / observable / gameview_spec)
- `orchestration/schemas/`, `registry/contracts.yaml`

## Procedure
1. **Authority Closure (§22)**: 모든 world_rules 의 transition 대상 State 가 authority 에
   `AuthoritativeWorld` 소유로 지정되어 있는가. 모든 Command 에 prohibited_fields 가 있는가.
   Client 가 결과를 보내는 경로가 없는가.
2. **Observable Closure (§23)**: 각 Rule 의 preconditions·transition 을 이해하는 데 필요한
   의미가 Observer Projection 에 존재하는가. Designer 8항목이 모두 있는가.
3. **GV Spec 검사**: Spec 의 모든 source 가 Observable Contract 항목인가.
   구체 asset/renderer 지정이 없는가 (Rule 8).
4. **Freeze 준비**: id / version 부여 확인, 세 문서 상호 참조 무결성.
5. verification_result 기록. PASS 시 Orchestrator 가 FREEZE_CONTRACT 를 수행한다
   (Verifier 는 Freeze 하지 않는다).

## Never
- Contract 직접 수정 (FAIL 로 보고)
- 미검증 상태로 Freeze 권고
- World/GameView 구현 코드 열람 (아직 존재하지 않아야 정상)

## Required Outputs
- `contract_verify.yaml` (verification_result schema, gate: CONTRACT)

## Completion
Authority Closure PASS + Observable Closure PASS + GV Spec PASS → Contract Gate PASS.
FAIL 시 failure_type: AUTHORITY_VIOLATION / OBSERVABLE_GAP / VIEW_SPEC_GAP.
