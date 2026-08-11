# STAGE-0-SCOPE — Scope Definition (Cycle Contract)

## 역할

새 Cycle의 범위를 확정하고 Cycle Contract를 작성한다. 구현보다 항상 먼저다.
Capability 선택은 인간의 결정이다 — Agent는 후보 제시와 Contract 초안 작성까지만 수행한다.

## 입력

- `context/TARGET-HORIZON.md`
- `context/WORLD-BASELINE.md` (현재 세계가 무엇을 지원하는지)
- `context/EVOLUTION-BACKLOG.md` (참고)
- 인간이 지정한 Capability (또는 후보 요청)

## 출력

- `cycles/cycle-XXX/00-cycle-contract.md` — [../templates/CYCLE-CONTRACT.md](../templates/CYCLE-CONTRACT.md) 형식
- `context/CURRENT-CYCLE.md` 교체 (새 Contract 반영)

## 작성 원칙

1. **Capability는 작게** — 한 Cycle은 최소한의 World Capability 하나만 추가한다.
2. **Semantic Overlap** — Baseline v1 이상에서는 기존 Semantic을 실제로 재사용·연결하는 Capability를 우선한다 (RULE 9).
3. **Explicitly Deferred를 명시** — 이번에 구현하지 않는 것을 Contract에 적는다 (RULE 6).
4. **Evolution Questions를 미리 적는다** — 이 설계가 미래 확장을 막는지 검사할 질문을 Contract 시점에 정의한다.
5. Observable Proof — 인간이 완료를 어떻게 눈으로 확인할지 Contract에 정의한다.

## STOP 조건

Contract 저장 + CURRENT-CYCLE 갱신 후 STOP. Intent Stage를 이어서 실행하지 않는다.
