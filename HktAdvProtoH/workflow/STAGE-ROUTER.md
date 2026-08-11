# STAGE-ROUTER

> 모든 작업 요청의 진입점. Agent는 작업을 시작하기 전에 이 문서로 현재 Stage를 식별하고, 해당 Stage Guide + 입력 Artifact만 로드한다.

## 실행 원칙 — ONE INVOCATION = ONE STAGE

하나의 invocation(작업 세션)에서 여러 Stage를 연속으로 처리하지 않는다.

```text
요청
 ↓
현재 Stage 식별
 ↓
현재 Stage Guide + 필요한 Handoff Artifact 로드
 ↓
현재 Stage 수행
 ↓
다음 Artifact 생성
 ↓
STOP  (다음 Stage는 별도 invocation)
```

전달 규칙:

```text
Conversation History   X
Previous Reasoning     X
전체 설계 문서          X

Handoff Artifact       O
Stage Guide            O
필요한 Reference       O
```

## Router의 책임 (이것만 한다)

1. 현재 요청의 Stage를 식별한다.
2. 필요한 Stage Guide를 선택한다.
3. 필요한 입력 Artifact가 존재하는지 확인한다 — 없으면 진행 불가를 보고하고 STOP.
4. 해당 Stage에서 허용된 Reference만 선택한다.
5. 현재 Stage를 수행하게 한다.

하지 않는 것: 다음 Stage 자동 실행 · 여러 Stage 연속 실행 · Workflow 전체 자동 완료 · 이전 Agent reasoning 유지 · 전체 원본 문서 자동 로드 · **Human Review 자동 통과**.

## Stage 라우팅 표

| 요청 유형 | Stage | Guide | 입력 Artifact (state/cycles/cycle-XXX/) | 출력 Artifact |
|---|---|---|---|---|
| Cycle 시작 / Scope 정의 | Scope Definition | [STAGE-0-SCOPE.md](STAGE-0-SCOPE.md) | (없음 — 인간 결정) | `00-cycle-contract.md` |
| Intent 도출 | Intent | [STAGE-1-INTENT.md](STAGE-1-INTENT.md) | `00-cycle-contract.md` | `01-intent-package.md` |
| World State/Rule 설계 | World Model | [STAGE-2-WORLD-MODEL.md](STAGE-2-WORLD-MODEL.md) | `01-intent-package.md` | `02-world-definition.md` |
| 세계 정의 리뷰 | Human Semantic Review | [STAGE-3-SEMANTIC-REVIEW.md](STAGE-3-SEMANTIC-REVIEW.md) | `02-world-definition.md` | `03-semantic-review.md` |
| 구현 | Implementation | [STAGE-4-IMPLEMENTATION.md](STAGE-4-IMPLEMENTATION.md) | `02-world-definition.md` (APPROVED) | `04-implementation-result.md` + 코드 |
| 검증 | Verification | [STAGE-5-VERIFICATION.md](STAGE-5-VERIFICATION.md) | `01`~`04` Artifact + 코드 | `05-verification-report.md` |
| 진화 호환성 검사 | Evolution Compatibility Review | [STAGE-6-EVOLUTION-REVIEW.md](STAGE-6-EVOLUTION-REVIEW.md) | `00` + `02` + `05` | `06-evolution-review.md` |
| Baseline 병합 | World Baseline Merge | [STAGE-7-BASELINE-MERGE.md](STAGE-7-BASELINE-MERGE.md) | `05` + `06` (모두 통과) | `state/WORLD-BASELINE.md` 갱신 |

## 모든 Stage의 기본 Context

```text
state/TARGET-HORIZON.md
+
state/CURRENT-CYCLE.md  (Current Cycle Contract)
+
state/WORLD-BASELINE.md 중 관련 Subset
+
현재 Stage 입력 Artifact
+
현재 Stage Guide
```

`design/` 아래 원본 문서는 **fallback reference**다 — 기존 Artifact와 Baseline만으로 의미를 판단할 수 없을 때만 읽는다 (RULE 12).

## Gate 규칙

- **Human Semantic Review Gate**: `03-semantic-review.md`가 `APPROVED`가 아니면 Implementation Stage를 시작할 수 없다 (RULE 4).
- **Design Gap**: 어느 Stage든 필요한 의미가 정의되어 있지 않으면 추측하지 않고 [../templates/DESIGN-GAP.md](../templates/DESIGN-GAP.md) 형식의 Design Gap을 생성하고 STOP한다 (RULE 5).
- **Baseline Merge Gate**: Verification + Evolution Compatibility가 모두 통과해야 병합한다 (RULE 10, 11).

## Stage 종료 시 공통 의무

1. 출력 Artifact를 `state/cycles/cycle-XXX/`에 저장한다.
2. `state/CURRENT-CYCLE.md`의 Stage 진행 상황 표를 갱신한다.
3. **STOP** — 다음 Stage를 실행하지 않는다.
