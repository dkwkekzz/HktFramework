# CURRENT-CYCLE

> 현재 Cycle의 Scope와 Contract. Cycle 종료 후 새로운 Cycle Contract로 교체한다.

## 상태

**활성 Cycle 없음.**

첫 Cycle(CYCLE-001)은 아직 시작되지 않았다. Cycle을 시작하려면:

1. [../templates/CYCLE-CONTRACT.md](../templates/CYCLE-CONTRACT.md) 템플릿으로 Cycle Contract를 작성해 이 문서를 교체한다.
2. `cycles/cycle-001/` 디렉터리를 만들고 Contract 사본을 `cycles/cycle-001/00-cycle-contract.md`로 저장한다.
3. 이후 Stage는 [../guides/STAGE-ROUTER.md](../guides/STAGE-ROUTER.md)를 따라 **한 invocation에 한 Stage씩** 진행한다.

첫 Cycle 후보는 워크플로 원문 §21의 예시대로 `Mining (Resource Extraction)`이 유력하다 — 단, Contract 작성 자체가 Cycle의 Scope Definition 단계이며 인간의 결정 사항이다.

## Stage 진행 상황

| Stage | Artifact | 상태 |
|---|---|---|
| Scope Definition | Cycle Contract | — |
| Intent | Intent Package | — |
| World Model | World Definition Package | — |
| Human Semantic Review | Semantic Review Result | — |
| Implementation | Implementation Result | — |
| Verification | Verification Report | — |
| Evolution Compatibility Review | Evolution Compatibility Result | — |
| World Baseline Merge | WORLD-BASELINE 갱신 | — |
