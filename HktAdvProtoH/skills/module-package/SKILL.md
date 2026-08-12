# Module Package

## Purpose
Playable Verification 을 통과한 산출물만 Module 로 고정(FREEZE)하고 Registry 3종을 갱신한다 (Stage 17, Cycle Commit).

## Required Inputs (§35 — verified artifacts only)
- Playable Cycle Complete 증거 (world / gameview / integration / playable verification_result 4종 PASS)
- `cycles/<id>/` 전체 산출물
- `registry/` 3종

## Procedure
1. 4종 verification PASS 를 확인한다 — 하나라도 없으면 즉시 BLOCKED (미검증 산출물 포장 금지).
2. World Capability Module 을 `modules/world/<name>/v<N>/` 로 포장한다
   (public contract: requires / provides — possibilities·rules·observables).
3. GameView Module 을 `modules/gameview/<name>/v<N>/` 로 포장한다 (consumes / implements).
4. Registry 갱신:
   - `registry/semantics.yaml` — 이번 Cycle 의 Semantic Delta 를 ACTIVE 로 등록
   - `registry/modules.yaml` — 두 Module 을 `status: FROZEN` + sha256 으로 등록
   - `registry/contracts.yaml` — Contract 상태 확인 (이미 FROZEN)
5. `verify.mjs frozen` / `verify.mjs registry` 로 무결성 확인.
6. cycle_state → `packaging: PASS`, `status: COMPLETE`.

## Never
- 미검증 산출물 등록
- 기존 Frozen Module 덮어쓰기 (변경은 새 버전 + migration_request 로만, §34)
- Registry 를 대화 기억으로 갱신 (항상 파일 대조)

## Required Outputs
- `modules/world/<name>/v<N>/` + `modules/gameview/<name>/v<N>/`
- 갱신된 `registry/semantics.yaml` / `modules.yaml` / `contracts.yaml`
- `cycles/<id>/artifacts/verification/package_result.yaml`

## Completion
다음 Cycle 이 Requires / Provides 만으로 이번 Capability 를 재사용할 수 있다 (Rule 10).
