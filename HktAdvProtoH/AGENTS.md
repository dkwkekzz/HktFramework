# HktAdvProtoH Agent Bootstrap — Stage Router

이 프로젝트는 **Observable World — Progressive Cycle Workflow** 로 진행한다.
운영 기준의 단일 원본은 [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) 다
(단, RULE 12 — 그 문서는 **fallback reference** 이지 기본 Context 가 아니다).

## 가장 중요한 규칙

```text
ONE INVOCATION = ONE STAGE
```

한 세션에서 두 Stage 를 연속으로 처리하지 않는다.
현재 Stage 의 Artifact 를 만들면 **STOP** 한다.

## Stage Router 절차

요청을 받으면 다음 5단계만 수행한다.

```text
1. 현재 요청의 Stage 를 식별한다.
2. 해당 Stage Guide 를 읽는다.
3. 필요한 입력 Artifact 가 존재하고 유효한지 확인한다.
4. 해당 Stage 에서 허용된 Reference 만 연다.
5. 그 Stage 하나만 수행하고 STOP 한다.
```

Stage Router 가 **하지 않는 것**:

```text
다음 Stage 자동 실행
여러 Stage 연속 실행
Workflow 전체 자동 완료
이전 Agent 의 reasoning 유지
전체 원본 설계 문서 자동 로드
Human Semantic Review 자동 통과
```

## Stage 식별표

| 요청이 이런 뜻이면 | Stage | Guide |
|---|---|---|
| 다음에 무엇을 만들지 정하자 / Cycle 범위 / Contract | 0. Cycle Scope | [stages/S0-CYCLE-SCOPE.md](stages/S0-CYCLE-SCOPE.md) |
| 이 Cycle 의 Intent 를 뽑자 | 1. Intent | [stages/S1-INTENT.md](stages/S1-INTENT.md) |
| State / Rule / Observable 을 정의하자 | 2. World Model | [stages/S2-WORLD-MODEL.md](stages/S2-WORLD-MODEL.md) |
| 이 World Definition 을 승인/반려한다 | 3. Human Review | [stages/S3-HUMAN-SEMANTIC-REVIEW.md](stages/S3-HUMAN-SEMANTIC-REVIEW.md) |
| 구현하자 / 코드를 쓰자 | 4. Implementation | [stages/S4-IMPLEMENTATION.md](stages/S4-IMPLEMENTATION.md) |
| 검증하자 / Closure 확인 | 5. Verification | [stages/S5-VERIFICATION.md](stages/S5-VERIFICATION.md) |
| 이 구조가 미래를 막는가 | 6. Evolution Compatibility | [stages/S6-EVOLUTION-COMPATIBILITY.md](stages/S6-EVOLUTION-COMPATIBILITY.md) |
| Baseline 에 병합하자 / Cycle 을 닫자 | 7. Baseline Merge | [stages/S7-BASELINE-MERGE.md](stages/S7-BASELINE-MERGE.md) |

현재 어느 Stage 인지는 [context/CURRENT-CYCLE.md](context/CURRENT-CYCLE.md) 가 알려준다.

요청이 어느 Stage 인지 모호하면 **추측해서 진행하지 않고 인간에게 묻는다.**

## 기본 Context (모든 Stage 공통)

```text
context/TARGET-HORIZON.md
context/CURRENT-CYCLE.md
context/WORLD-BASELINE.md 의 관련 부분집합
현재 Stage 의 입력 Artifact
현재 Stage Guide
```

이것으로 판단할 수 없을 때만 `design/` 원본을 fallback 으로 연다 (RULE 12).

## 공통 불변 규칙

| # | 규칙 |
|---|---|
| 1 | ONE INVOCATION = ONE STAGE. |
| 2 | 다음 Stage 를 자동으로 실행하지 않는다. |
| 3 | Agent 사이에는 reasoning 이 아니라 Artifact 를 전달한다. |
| 4 | Human Semantic Review 없이 Implementation 으로 진행하지 않는다. |
| 5 | 설계 의미가 부족하면 추측하지 않고 DESIGN GAP 을 만든다. |
| 6 | 현재 Cycle 에 필요하지 않은 미래 기능을 구현하지 않는다. |
| 7 | 현재 Cycle 의 편의를 위해 최종 World Model 을 막는 특수한 의미 가정을 만들지 않는다. |
| 8 | 확장성을 이유로 미래의 Implementation Mechanism 을 과도하게 추상화하지 않는다. |
| 9 | 새 Cycle 은 가능하면 기존 Semantic 을 실제로 재사용한다. |
| 10 | Cycle 완료는 State → Rule → Transition → Observable 이 하나의 닫힌 의미 단위로 검증된 상태다. |
| 11 | 검증된 Semantic 만 World Baseline 에 추가한다. |
| 12 | 전체 원본 문서는 기본 입력이 아니라 fallback reference 다. |

## Artifact Chain

Artifact 가 Stage 사이의 API 다.

```text
00 Cycle Contract → 01 Intent Package → 02 World Definition Package
→ 03 Semantic Review Result (인간 Gate) → 04 Implementation Result
→ 05 Verification Report → 06 Evolution Compatibility Result
→ 07 World Baseline Update
```

산출물 위치: `cycles/<cycle-id>/`
서식: [templates/](templates/)

## DESIGN GAP

필요한 세계 의미가 없으면 [templates/DESIGN-GAP.md](templates/DESIGN-GAP.md) 형식으로
`cycles/<cycle-id>/GAP-<n>-<slug>.md` 를 쓰고 **현재 Stage 를 중단**한다.
"일단 이렇게 가정하고" 는 금지다.

## 다른 프로젝트

HktAdvProtoF / G 등 다른 트랙은 참고하지 않는다.
