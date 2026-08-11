# WORKFLOW.md — 작업 방식

> 모든 작업 요청의 진입점. 현재 Stage를 식별하고, 해당 Stage 섹션의 지시대로 수행한 뒤 **STOP**한다.
> 원문 명세: [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) (RULE 1~12는 §27).

## 실행 원칙

**ONE INVOCATION = ONE STAGE.** 한 세션에서 여러 Stage를 연속 실행하지 않는다. 다음 Stage는 별도 invocation에서 시작한다.

Stage 간 전달은 대화·reasoning이 아니라 **Artifact**다:

```text
Conversation History   X          Handoff Artifact       O
Previous Reasoning     X          Stage Guide (이 문서)   O
전체 설계 문서          X          필요한 Reference       O
```

모든 Stage의 기본 Context:

```text
STATE.md (작업 상태: 현재 Cycle + Baseline + Backlog)
+ 현재 Stage 입력 Artifact (cycles/cycle-XXX/)
+ 이 문서의 해당 Stage 섹션
```

`design/` 기획 문서는 **fallback reference**다 — Artifact와 Baseline만으로 의미를 판단할 수 없을 때만 읽는다 (RULE 12).

## Stage 라우팅

| 요청 유형 | Stage | 입력 Artifact | 출력 Artifact |
|---|---|---|---|
| Cycle 시작 / Scope 정의 | 0. Scope Definition | (인간 결정) | `00-cycle-contract.md` |
| Intent 도출 | 1. Intent | `00` | `01-intent-package.md` |
| World State/Rule 설계 | 2. World Model | `01` | `02-world-definition.md` |
| 세계 정의 리뷰 | 3. Human Semantic Review | `02` | `03-semantic-review.md` |
| 구현 | 4. Implementation | `02` (APPROVED) | `04-implementation-result.md` + 코드 |
| 검증 | 5. Verification | `01`~`04` + 코드 | `05-verification-report.md` |
| 진화 호환성 검사 | 6. Evolution Review | `00`+`02`+`05` | `06-evolution-review.md` |
| Baseline 병합 | 7. Baseline Merge | `05`+`06` (모두 통과) | STATE.md Baseline 갱신 |

Artifact는 `cycles/cycle-XXX/`에 위 고정 이름으로 저장하고, 형식은 [templates/](templates/)를 따른다. 번호가 앞선 Artifact 없이 다음 Stage를 시작할 수 없다.

## Gate 규칙

- **Human Review Gate**: `03`이 `APPROVED`가 아니면 Stage 4 시작 불가 (RULE 4). Agent가 대신 통과시킬 수 없다.
- **Design Gap**: 어느 Stage든 필요한 의미가 정의돼 있지 않으면 추측하지 않고 [templates/DESIGN-GAP.md](templates/DESIGN-GAP.md) 형식으로 `cycles/cycle-XXX/gaps/GAP-NNN.md`를 생성하고 STOP (RULE 5). Agent는 설계 변경 후보를 제출할 뿐, 설계를 직접 변경하지 않는다.
- **Merge Gate**: Verification 4종 + Evolution Review가 모두 통과해야 병합 (RULE 10, 11).

## Stage 종료 시 공통 의무

1. 출력 Artifact를 `cycles/cycle-XXX/`에 저장한다.
2. `STATE.md`의 Stage 진행 표를 갱신한다 (상태 기록은 STATE.md에만).
3. **STOP** — 다음 Stage를 실행하지 않는다.

---

## Stage 0 — Scope Definition (Cycle Contract)

새 Cycle의 범위를 확정한다. Capability 선택은 인간의 결정 — Agent는 후보 제시와 Contract 초안까지만.

- 입력: STATE.md (Baseline·Backlog), 인간이 지정한 Capability
- 출력: `00-cycle-contract.md` ([템플릿](templates/CYCLE-CONTRACT.md)) + STATE.md 현재 Cycle 교체
- 원칙:
  1. Capability는 작게 — 한 Cycle은 최소한의 World Capability 하나만.
  2. Semantic Overlap — 기존 Semantic을 실제로 재사용·연결하는 Capability 우선 (RULE 9).
  3. Explicitly Deferred(이번에 안 하는 것)와 Evolution Questions(미래 확장을 막는지 검사할 질문)를 Contract에 명시.
  4. Observable Proof — 인간이 완료를 어떻게 눈으로 확인할지 정의.

## Stage 1 — Intent

Contract의 Goal / Possibility Scope에서 세계가 보장해야 하는 의미 단위(Intent)를 추출한다.

- 입력: `00-cycle-contract.md`, Baseline 관련 Subset
- 출력: `01-intent-package.md` ([템플릿](templates/INTENT-PACKAGE.md))
- 원칙:
  1. Intent는 구현 구조가 아니다 — 클래스·메서드·서비스 이름이 나오면 잘못. "세계에서 무엇이 참이어야 하는가"만 서술.
  2. 각 Intent는 Source Goal / Possibility ID를 명시 (`Goal → Possibility → Intent` trace).
  3. Goal / Possibility 의미를 변경·추가·삭제하지 않는다. Contract 범위 밖 Intent 금지.

## Stage 2 — World Model

Intent의 모든 의미를 `Required World State + World Rule + Observable`로 폐쇄한다.

- 입력: `01-intent-package.md`, `00-cycle-contract.md`, Baseline
- 출력: `02-world-definition.md` ([템플릿](templates/WORLD-DEFINITION-PACKAGE.md))
- 원칙:
  1. **Semantic Closure** — Intent의 모든 문장이 State/Rule로 연결. 하나라도 안 되면 실패.
  2. World State에는 세계 의미만 — Implementation State(`cacheEntry` 류) 금지. "세계의 사실인가, 프로그램의 사실인가"를 항상 묻는다.
  3. Rule 판단에 영향을 주는 상태(Knowledge, Preference, CurrentGoal 등)는 Decision Semantic State — Observable 대상.
  4. Rule 형식: `Preconditions / Input / Transition` + `Implements: INTENT-XXX` trace.
  5. Observable Contract를 State/Rule과 **동시에** 정의 (Semantic Lossless Projection). Transition도 `Before/Input/Rule/After`로 관찰 가능해야 한다.
  6. Entity 단위 의미 — 단일 Player 가정(`World.playerX`) 금지. 기존 Baseline Semantic 재사용, 충돌 재정의 금지.
- STOP 후 **반드시 Human Review Gate 대기** — Implementation으로 자동 진행 금지.

## Stage 3 — Human Semantic Review

인간이 "이 World State / Rule이 내 Intent를 정확하게 표현하는가?"를 판정하는 Gate.

- 입력: `02-world-definition.md` (+ `01` 대조용)
- 출력: `03-semantic-review.md` ([템플릿](templates/SEMANTIC-REVIEW-RESULT.md)) — `APPROVED` 또는 `REJECTED (Reason + Required Change)`
- Agent가 할 수 있는 것: 검토용 요약(Intent ↔ State/Rule 매핑 표) 제시, 인간 판정의 기록.
- Agent가 할 수 없는 것: 판정 자체(자동 APPROVED 금지). REJECTED 시 수정은 새로운 Stage 2 invocation으로.

## Stage 4 — Implementation

APPROVED World Definition을 `State → Rule → Transition → Observable` 닫힌 세계 단위로 구현한다.

- 입력: `02-world-definition.md` (APPROVED — `03`으로 확인), Repository. 기획 문서는 다시 읽지 않는다.
- 출력: 코드 + `04-implementation-result.md` ([템플릿](templates/IMPLEMENTATION-RESULT.md))
- 결정 가능: 클래스/자료구조/파일/함수 구조, 캐싱, 코드 추상화.
- 변경 불가: Goal/Possibility/Intent/Rule 의미, Required World State, Observable Contract. 구현이 어렵다는 이유의 Precondition 제거·State 생략·Observable 생략은 세계 규칙 변경이므로 불가.
- 원칙:
  1. 의미 있는 상태 변화는 Rule을 통해서만 — Rule 밖 World State 직접 변경 금지.
  2. View는 Observable World State만 읽는다.
  3. `Before/Input/Rule/After` Transition이 Runtime에서 관찰 가능해야 한다.
  4. Rule 구현에 `Implements: INTENT-XXX` trace를 남긴다.
  5. 과도한 미래 추상화 금지 (RULE 8) — 지금 필요한 만큼만.

## Stage 5 — Verification

단순 코드 테스트가 아니다. 4종을 모두 검사하고 재현 방법을 남긴다.

- 입력: `01`~`04` + 코드
- 출력: `05-verification-report.md` ([템플릿](templates/VERIFICATION-REPORT.md))
- 검사 4종:
  1. **Semantic Closure** — Intent 모든 의미가 State/Rule로 표현되었는가.
  2. **Observable Closure** — Rule 판단·결과 이해에 필요한 의미가 Observable한가. 실행 불가 시 reason도 표현되는가.
  3. **Runtime Closure** — 실제 실행에서 `Before/Input/Rule/After` Transition이 발생하고 그 자체가 Observable한가. **실측 값만 기록** — 약속 금지.
  4. **Traceability** — Runtime Transition → Rule → Intent → Possibility → Goal 역추적 성립.
- 실패 발견 시 이 invocation에서 수정하지 않는다 — 원인 기록 후 STOP, 수정은 새 Stage 4로.

## Stage 6 — Evolution Compatibility Review

현재 구조가 Target Horizon을 **불필요하게 제한하는지** 검사한다. 미래 기능 구현 여부를 검사하는 게 아니다.

- 입력: `00`(Evolution Questions), `02`, `05`, [design/Design-TargetHorizon.md](design/Design-TargetHorizon.md)
- 출력: `06-evolution-review.md` ([템플릿](templates/EVOLUTION-COMPATIBILITY-RESULT.md)) + 필요 시 STATE.md Backlog 추가
- 판정 기준:
  - 같은 의미 모델 안에서 추가가 가능하면 통과 — 실제 구현 불필요. instance가 하나뿐인 건 문제 아님, 모델이 하나만 허용하는 게 문제 (`World.playerInventory` X / `Actor01.Inventory` O).
  - 반대 방향도 검사 — 확장성을 이유로 만든 과도한 구현 추상화(RULE 8 위반)도 지적.
- 하나라도 구조적으로 막혀 있으면 FAIL — Cycle 미완료. 수정은 별도 invocation(Stage 2 또는 4 재진입).

## Stage 7 — Baseline Merge

검증 완료된 Semantic을 STATE.md의 World Baseline에 병합하고 Cycle을 닫는다.

- Gate: `05` 4종 통과 + `06` PASS. 아래 체크리스트 전부 확인 — 하나라도 실패면 병합 불가.
- 출력: STATE.md 갱신 — Baseline 버전 증가(vN → vN+1) + History 행 추가, 현재 Cycle을 "없음"으로 초기화, TODO 갱신.
- 병합 원칙: 검증된 Semantic만 (RULE 11), 세계 의미만 기재(구현 세부 금지).

```text
[ ] Cycle Scope가 명확하다.
[ ] Goal / Possibility Trace가 존재한다.
[ ] Intent가 명확하다.
[ ] Intent의 모든 의미가 World State / Rule에 존재한다.
[ ] World Rule에 의한 실제 Transition이 발생한다.
[ ] Transition이 Observable하다.
[ ] 인간이 설계 언어로 결과를 확인할 수 있다.
[ ] Runtime에서 Design까지 역추적할 수 있다.
[ ] 새로운 Semantic이 기존 Baseline과 연결된다.
[ ] 현재 구현이 Target Horizon을 구조적으로 막지 않는다.
[ ] 검증된 결과가 World Baseline에 병합되었다.
```
