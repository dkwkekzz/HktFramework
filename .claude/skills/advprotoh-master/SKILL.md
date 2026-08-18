---
name: advprotoh-master
description: HktAdvProtoH 의 Master Layer 작업을 실행한다 — WHY(World·Actor·Goal) / OPTIONS(대안 Possibility) / NEED(필요 Capability + Existing World Overlay) / NEXT(Frontier 후보) 4단계 기본 절차와, 닫힌 Cycle 의 Master Feedback 반영. Constraint 는 단계가 아니라 각 선택 지점의 Filter 다. Cycle Goal 이 어디서 오는지를 담당하는 위층이며, Frontier 선택(Human) 이후는 advprotoh-cycle 스킬이 이어받는다. 사용자가 "Master Graph 확장 / Constraint 정리 / Frontier 뽑아줘 / Overlay 갱신 / 다음 Cycle 뭐 할지 / Master 피드백 반영 / AdvProtoH master" 를 요청하면 사용.
---

# HktAdvProtoH Master Layer Runner

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.

이 프로젝트의 Workflow 는 두 층이다.

```text
MASTER LAYER (이 스킬)   WHY → OPTIONS → NEED → NEXT — 무엇을 왜 만들지 결정한다
                         → master/ 에 쌓이는 하나의 Graph. History 가 아니라 현재 상태다

CYCLE LAYER (advprotoh-cycle)   선택된 NEXT 를 World Semantic 과 Rule 로 폐쇄한다
                         → cycles/ 8 Stage. 이 스킬이 그 공정을 바꾸지 않는다
```

접합점은 **둘뿐**이다.

```text
아래로   frontier.md 의 SELECTED  →  cycles/<CycleId>/01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  overlay.md · frontier.md · candidates/ 반영 (Feedback)
```

## 0. Master 의 기본 절차는 4단계뿐이다

```text
1. WHY        World / Actor / Goal — 누가 무엇을 왜 원하는가
       ↓
2. OPTIONS    Goal 을 달성하는 의미 있게 다른 여러 Possibility
       ↓
3. NEED       각 Possibility 에 필요한 Capability
              + Existing World 에 이미 있는지 확인 (Overlay)
       ↓
4. NEXT       Missing / Partial Capability 중 Frontier 후보 선택
       ↓
   Human Select
       ↓
   기존 8 Stage Cycle
```

- **Constraint 는 단계가 아니라 Filter 다** — WHY/OPTIONS/NEED/NEXT 의 각 선택 지점에서
  Active Constraint 를 적용할 뿐, 별도 Stage 를 만들지 않는다 (정책 §2.3 · §10).
- Knowledge / Belief · Actor Conflict · Consequence · Reveal / Reframe · Constraint Candidate 는
  실제 설계 결정에 영향을 줄 때만 쓰는 **보조 규칙**이다 (정책 §11).
- Feedback(위 접합점)은 닫힌 Cycle 의 사실을 반영하는 작업이며 기본 4단계에 들어가지 않는다.

## 1. 대상 Step 판정

인자로 Step 이 지정되면 그것을 쓴다. 지정되지 않으면 아래 순서로 판정한다.

1. 처리되지 않은 `08-verification.md` 의 `MASTER FEEDBACK` 이 있으면 → **Feedback** 을 먼저 돌린다
2. `master/root.md` 가 비어 있으면 → **멈추고 Human 에게 Root Goal / World Premise 를 요청**
3. Goal 의 주체·이유가 비어 있거나 이번 요청이 새 영역이면 → **WHY**
4. Goal 은 있는데 의미 있게 다른 Possibility 가 탐색되지 않았으면 → **OPTIONS**
5. Possibility 의 Requirement 가 비어 있거나 `overlay.md` 가 오래됐으면 → **NEED**
6. Overlay 는 최신인데 `frontier.md` 에 후보가 없으면 → **NEXT**
7. 후보가 있으면 → **멈추고 Human 에게 선택을 요청**

| Step | Guide | 입력 | 출력 |
|---|---|---|---|
| WHY | `guides/master-graph.md` | `root.md` · Active DC · 기존 Graph | `graph/` world-state · actors · knowledge · goals |
| OPTIONS | `guides/master-graph.md` | Goal · Active DC (Filter) | `graph/possibilities.yaml` (+ CC-*) |
| NEED | `guides/master-graph.md` · `guides/master-overlay.md` | Possibility · Cycle 실측 | `graph/capabilities.yaml` · `master/overlay.md` |
| NEXT | `guides/master-frontier.md` | `overlay.md` · Graph · Active DC | `master/frontier.md` |
| Human Select | — | `frontier.md` | **Human 전용 — Agent 가 고르지 않는다** |
| Feedback | `guides/master-feedback.md` | `08-verification.md` MASTER FEEDBACK | overlay · frontier · CC 갱신 |

Constraint 자체의 작업(신설·재작성·승인·충돌 Trade-off)은 Step 이 아니다 —
Human 이 명시적으로 요청할 때만 `guides/master-constraint.md` 로 수행한다
(`master/constraints/DC-*.yaml`). Agent 가 절차 중에 스스로 시작하지 않는다.

Human Select 가 차례면 **작업을 멈추고** 후보와 근거·추천 순서를 제시한 뒤 사용자의 선택을 받는다.
선택이 끝나면 이 스킬은 종료하고 `advprotoh-cycle` 로 넘긴다.

## 2. 읽는다

정확히 이것만 읽는다. 더 읽지 마라.

```text
1. CLAUDE.md                              공통 원칙·인덱스
2. 위 표에서 이번 Step 의 Guide            작업 방법·완료 조건
3. master/SCHEMA.md                        파일 형식
4. 위 표의 입력 파일
```

추가로 필요할 때만:

* NEED(Overlay 판정)·Feedback 에 한해 **관련 있는** Cycle 의 `08-verification.md`
* Overlay 판정에 한해 `world/` `view/` 코드 — **읽기만 한다**
* Guide 로 판단할 수 없는 경계 사례에 한해
  `design/Master-Intent-Graph-Policy.md` 의 **해당 섹션만**

정책 문서 전체를 매번 로드하는 것은 이 워크플로우의 실패다.
`design/` 의 Cycle 3종(`Design-Workflow` · `Design-CycleWorkflow` · `Design-CycleExecution`)은
Master 작업의 Context 가 아니다.

## 3. 실행

1. Guide 의 `DO` 를 순서대로 수행한다.
2. Guide 의 `MUST` / `MUST NOT` 을 위반하지 않는다.
3. 출력을 `master/SCHEMA.md` 형식으로 쓴다.
4. Guide 의 `DONE WHEN` (= 정책 문서 §15 Quality Gate — WHY/OPTIONS/NEED/NEXT 절)을
   항목별로 자가 점검한다. Optional 항목은 해당될 때만 검사한다.

### 이 층에서 절대 하지 않는 것

```text
Human 승인 없이 Constraint 를 추가·삭제·완화·승격하지 않는다.
Constraint 충돌을 임의로 해결하지 않는다 — Trade-off 로 노출한다.
Constraint 에서 시스템/기능 목록을 도출하지 않는다.
   Goal → Possibility --requires--> Capability 가 유일한 방향이고
   Constraint 는 옆에서 --constrains--> 로 제한할 뿐이다.
보조 규칙(Knowledge/Belief·Conflict·Consequence·Reveal/Reframe)을 기계적으로 채우지 않는다.
수치·공식·State 이름을 master/ 에 쓰지 않는다 — Cycle 의 03-world-semantic.md 소유다.
world/ view/ 코드를 수정하지 않는다 — Overlay 판정을 위해 읽기만 한다.
cycles/ 의 Artifact 를 수정하지 않는다 — History 다.
다음 Cycle Goal 을 자동 확정하지 않는다 — Human 이 고른다.
UNRESOLVED 를 SATISFIED 로 간주하지 않는다.
```

### 막히면 — 지어내지 않는다

```text
Root Goal / World Premise 가 없다        → Human (master/root.md)
Constraint 충돌 · 예외가 필요하다        → Human (Trade-off 제시)
Capability 상태를 판정할 근거가 없다      → NEED 로 정식 재판정. 추측하지 않는다
Cycle 결과가 상위 의미와 어긋난다         → Human (MASTER GAP)
```

## 4. 닫기

* 커밋 메시지 형식: `HktAdvProtoH: Master <Step> — <한 줄 요약>`
* NEXT 를 끝냈으면 후보와 추천 근거를 제시하고 **Human 선택을 기다린다**.
* 선택 이후의 작업은 이 스킬이 아니라 `advprotoh-cycle` 이다.
  선택된 Frontier 의 내용을 `01-cycle.md` 의 `MASTER TRACE` 로 넘긴다.
* 무엇이 끝났고 다음이 무엇인지 보고한다.
