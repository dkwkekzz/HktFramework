# Stage Guides

각 Stage 는 **하나의 Agent invocation** 이다. 한 invocation 에서 두 Stage 를 처리하지 않는다.

## Stage 표 — 입력 / 출력 / 허용 Reference

| Stage | Guide | 입력 Artifact | 출력 Artifact | 이 Stage 에서만 허용되는 추가 Reference |
|---|---|---|---|---|
| 0. Cycle Scope | [S0-CYCLE-SCOPE.md](S0-CYCLE-SCOPE.md) | 직전 Verification / Baseline | `00-CYCLE-CONTRACT.md` | `design/Design-Concept.md` (Goal/Possibility 원본) |
| 1. Intent | [S1-INTENT.md](S1-INTENT.md) | `00-CYCLE-CONTRACT.md` | `01-INTENT-PACKAGE.md` | 관련 Goal / Possibility 설계 |
| 2. World Model | [S2-WORLD-MODEL.md](S2-WORLD-MODEL.md) | `01-INTENT-PACKAGE.md` | `02-WORLD-DEFINITION-PACKAGE.md` | — |
| 3. Human Semantic Review | [S3-HUMAN-SEMANTIC-REVIEW.md](S3-HUMAN-SEMANTIC-REVIEW.md) | `02-…` | `03-SEMANTIC-REVIEW-RESULT.md` | (인간 전용 Gate) |
| 4. Implementation | [S4-IMPLEMENTATION.md](S4-IMPLEMENTATION.md) | APPROVED `02-…` + `03-…` | `04-IMPLEMENTATION-RESULT.md` + 코드 | Repository |
| 5. Verification | [S5-VERIFICATION.md](S5-VERIFICATION.md) | `01-…`, `02-…`, `04-…` + 코드 | `05-VERIFICATION-REPORT.md` | Repository (읽기) |
| 6. Evolution Compatibility | [S6-EVOLUTION-COMPATIBILITY.md](S6-EVOLUTION-COMPATIBILITY.md) | `00-…`, `02-…`, `05-…` + 코드 | `06-EVOLUTION-COMPATIBILITY-RESULT.md` | `context/TARGET-HORIZON.md` |
| 7. Baseline Merge | [S7-BASELINE-MERGE.md](S7-BASELINE-MERGE.md) | `05-…`, `06-…` (둘 다 PASS) | `07-WORLD-BASELINE-UPDATE.md` + Baseline 갱신 | — |

모든 Stage 의 **공통 기본 Context**:

```text
context/TARGET-HORIZON.md
context/CURRENT-CYCLE.md
context/WORLD-BASELINE.md 의 관련 부분집합
현재 Stage 의 입력 Artifact
현재 Stage Guide
```

`design/Design-CycleWorkflow.md` 와 `design/Design-Concept.md` 는 **fallback reference** 다 (RULE 12).
기존 Artifact 와 Baseline 만으로 판단할 수 없을 때만 연다.

## Artifact Chain

```text
00 Cycle Contract
      ↓
01 Intent Package
      ↓
02 World Definition Package
      ↓
03 Semantic Review Result   ←  인간 Gate
      ↓  (APPROVED 일 때만)
04 Implementation Result
      ↓
05 Verification Report
      ↓
06 Evolution Compatibility Result
      ↓
07 World Baseline Update
```

Artifact 가 Stage 사이의 API 다. 이전 Stage 의 대화를 알아야 동작하는 Stage 는
Workflow 설계가 잘못된 것이다 (RULE 3).

## 모든 Stage 공통 종료 절차

1. 출력 Artifact 를 `cycles/<cycle-id>/` 에 쓴다.
2. `context/CURRENT-CYCLE.md` 의 Stage 표에서 **자기 줄만** 갱신한다.
3. **STOP.** 다음 Stage 를 실행하지 않고, 다음 Stage 를 요약해 주지도 않는다.
   사용자에게 "다음은 Stage N — 별도 invocation 에서 시작" 만 알린다.

## DESIGN GAP — 모든 Stage 공통 중단 절차

필요한 세계 의미가 정의되어 있지 않으면 **추측하지 않는다** (RULE 5).

1. `cycles/<cycle-id>/GAP-<n>-<slug>.md` 를 [../templates/DESIGN-GAP.md](../templates/DESIGN-GAP.md) 형식으로 쓴다.
2. 현재 Stage 를 **중단**한다. 부분 산출물은 남기되 완료 표시하지 않는다.
3. 설계 변경을 직접 수행하지 않는다. Agent 는 **설계 변경 후보를 제출**할 뿐이다.
4. `Blocking: yes` 인 Gap 은 인간이 해소해야 해당 Stage 를 재실행할 수 있다.
