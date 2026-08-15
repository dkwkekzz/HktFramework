---
name: advprotoh-master
description: HktAdvProtoH 의 Master Layer 작업을 실행한다 — Design Constraint 정리 / Master Intent Graph 확장(World Cause·Actor·Goal·대안 Possibility·Capability) / Capability Overlay 판정 / Frontier 후보 생성 / 닫힌 Cycle 의 Master Feedback 반영. Cycle Goal 이 어디서 오는지를 담당하는 위층이며, Frontier 선택 이후는 advprotoh-cycle 스킬이 이어받는다. 사용자가 "Master Graph 확장 / Constraint 정리 / Frontier 뽑아줘 / Overlay 갱신 / 다음 Cycle 뭐 할지 / Master 피드백 반영 / AdvProtoH master" 를 요청하면 사용.
---

# HktAdvProtoH Master Layer Runner

**작업 디렉토리: `HktAdvProtoH/`** — 이하 상대 경로는 이 폴더 기준.

이 프로젝트의 Workflow 는 두 층이다.

```text
MASTER LAYER (이 스킬)   무엇을 왜 만들 것인가 · 어떤 다른 방법이 있는가 · 어떤 Constraint 아래인가
                         → master/ 에 쌓이는 하나의 Graph. History 가 아니라 현재 상태다

CYCLE LAYER (advprotoh-cycle)   선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다
                         → cycles/ 8 Stage. 이 스킬이 그 공정을 바꾸지 않는다
```

접합점은 **둘뿐**이다.

```text
아래로   frontier.md 의 SELECTED  →  cycles/<CycleId>/01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  overlay.md · candidates/ 반영 (MF Stage)
```

## 1. 대상 Stage 판정

인자로 Stage 가 지정되면 그것을 쓴다. 지정되지 않으면 아래 순서로 판정한다.

1. 처리되지 않은 `08-verification.md` 의 `MASTER FEEDBACK` 이 있으면 → **MF**
2. `master/root.md` 가 비어 있으면 → **멈추고 Human 에게 Root Goal / World Premise 를 요청**
3. `master/graph/` 가 비어 있거나 이번 요청이 새 영역이면 → **M2** (필요하면 M1 먼저)
4. Graph 는 있는데 `overlay.md` 가 오래됐으면 → **M3**
5. Overlay 는 최신인데 `frontier.md` 에 후보가 없으면 → **M4**
6. 후보가 있으면 → **멈추고 Human 에게 선택을 요청** (M5)

| Stage | Guide | 입력 | 출력 |
|---|---|---|---|
| M1 Constraint | `guides/master-constraint.md` | `root.md` · 기존 DC · CC | `master/constraints/DC-*.yaml` |
| M2 Graph Expansion | `guides/master-graph.md` | `root.md` · DC · 기존 Graph | `master/graph/*.yaml` (+ CC-*) |
| M3 Capability Overlay | `guides/master-overlay.md` | Graph · Cycle 실측 | `master/overlay.md` |
| M4 Frontier | `guides/master-frontier.md` | `overlay.md` · Graph · DC | `master/frontier.md` |
| M5 Human Selection | — | `frontier.md` | **Human 전용 — Agent 가 고르지 않는다** |
| MF Feedback | `guides/master-feedback.md` | `08-verification.md` MASTER FEEDBACK | overlay · frontier · CC 갱신 |

M5 가 차례면 **작업을 멈추고** 후보와 근거·추천 순서를 제시한 뒤 사용자의 선택을 받는다.
선택이 끝나면 이 스킬은 종료하고 `advprotoh-cycle` 로 넘긴다.

## 2. 읽는다

정확히 이것만 읽는다. 더 읽지 마라.

```text
1. CLAUDE.md                              공통 원칙·인덱스
2. guides/master-<이번 Stage>.md           작업 방법·완료 조건
3. master/SCHEMA.md                        파일 형식
4. 위 표의 입력 파일
```

추가로 필요할 때만:

* Overlay 판정(M3)·Feedback(MF)에 한해 **관련 있는** Cycle 의 `08-verification.md`
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
4. Guide 의 `DONE WHEN` (= 정책 문서 §25 Quality Gate) 을 항목별로 자가 점검한다.

### 이 층에서 절대 하지 않는 것

```text
Human 승인 없이 Constraint 를 추가·삭제·완화·승격하지 않는다.
Constraint 충돌을 임의로 해결하지 않는다 — Trade-off 로 노출한다.
Constraint 에서 시스템/기능 목록을 도출하지 않는다.
   Constraint --constrains--> Goal → Possibility --requires--> Capability  가 유일한 방향이다.
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
Capability 상태를 판정할 근거가 없다      → M3 로 정식 재판정. 추측하지 않는다
Cycle 결과가 상위 의미와 어긋난다         → Human (MASTER GAP)
```

## 4. 닫기

* 커밋 메시지 형식: `HktAdvProtoH: Master <Stage> — <한 줄 요약>`
* M4 를 끝냈으면 후보와 추천 근거를 제시하고 **Human 선택을 기다린다**.
* 선택 이후의 작업은 이 스킬이 아니라 `advprotoh-cycle` 이다.
  선택된 Frontier 의 내용을 `01-cycle.md` 의 `MASTER TRACE` 로 넘긴다.
* 무엇이 끝났고 다음이 무엇인지 보고한다.
