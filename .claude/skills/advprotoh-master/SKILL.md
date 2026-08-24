---
name: advprotoh-master
description: HktAdvProtoH 의 Master Layer 작업을 실행한다 — WHY(World·Actor·Goal) / OPTIONS(대안 Possibility) / NEED(필요 Capability + Existing World Overlay) / NEXT(Frontier 후보) 4단계 기본 절차와, 닫힌 Cycle 의 Master Feedback 반영, 그리고 Human 이 지목한 기반 기획 문서의 주입(Inject — 탐색이 아니라 번역: 문서에 있는 의미만 Constraint·Graph 로 옮긴다). Constraint 는 단계가 아니라 각 선택 지점의 Filter 다. Cycle Goal 이 어디서 오는지를 담당하는 위층이며, Frontier 선택(Human) 이후는 advprotoh-cycle 스킬이 이어받는다. 사용자가 "Master Graph 확장 / Constraint 정리 / Frontier 뽑아줘 / Overlay 갱신 / 다음 Cycle 뭐 할지 / Master 피드백 반영 / 기획 문서 반영·주입 / AdvProtoH master" 를 요청하면 사용.
---

# HktAdvProtoH Master Layer Runner

**작업 디렉토리: `HktAdvProtoH/`** — `guides/` `design/` `engine/` `tools/` 는 이 폴더 기준.
**컨텐츠 경로는 활성 팩 루트 기준** — `hkt.pack.json` 의 active 가 가리키는
`content/<active>/` 아래에 `master/` `cycles/` `world/` `view/` `protocol/`(팩 확장) 이 있다.
`engine/` 과 `engine/protocol-core/` 는 기반이다 — **컨텐츠 작업 중에 편집하지 않는다**
(`npm run boundary:check` 가 경계를 강제한다). 기반 변경은 별도 기반 트랙으로만 한다.

이 프로젝트의 Workflow 는 두 층이다.

```text
MASTER LAYER (이 스킬)   WHY → OPTIONS → NEED → NEXT — 무엇을 왜 만들지 결정한다
                         → master/ 에 쌓이는 하나의 Graph. History 가 아니라 현재 상태다

CYCLE LAYER (advprotoh-cycle)   선택된 NEXT 를 World Semantic 과 Rule 로 폐쇄한다
                         → cycles/ 8 Stage. 이 스킬이 그 공정을 바꾸지 않는다
```

접합점은 **둘뿐**이다.

```text
아래로   frontier/<트랙>.md 의 SELECTED  →  cycles/<CycleId>/01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  overlay.md · frontier/<트랙>.md ·
         feedback/<CycleId>.md · candidates/ 반영 (Feedback)
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

### 4단계가 아닌 것 — 기반 기획 주입 (Inject)

Human 이 기반 기획 문서(`design/Design-*.md` — 전투 규칙 등)를 쓰거나 개정하고
그 **반영**을 지시하면, 그것은 4단계 탐색이 아니라 **주입**이다.

```text
탐색 (기본 4단계)   Graph 가 원본. 새 의미를 찾는다
주입 (Inject)       Human 문서가 원본. 문서에 있는 의미만 옮긴다 — 번역이지 창작이 아니다
```

주입 요청을 4단계로 처리해 문서에 없는 Goal/Possibility 를 지어내지 마라.
반대로, 문서 없이 4단계를 주입처럼 굴려 탐색을 건너뛰지도 마라.

## 1. 대상 Step 판정

이 스킬은 MASTER 레인이다 — **main 위에서 한 번에 하나만** 돈다 (레인 규칙: guides/works.md).

인자로 Step 이 지정되면 그것을 쓴다. 지정되지 않으면 아래 순서로 판정한다.

1. 이번 요청이 Human 이 지목한 기반 기획 문서의 반영·주입이면 → **Inject**
2. 처리되지 않은 `08-verification.md` 의 `MASTER FEEDBACK` 이 있으면(그 Cycle 의
   `master/feedback/<CycleId>.md` 가 없으면 미처리다) → **Feedback** 을 먼저 돌린다.
   Feedback 은 그 Cycle 이 main 에 병합된 뒤 **최신 main 위에서만** 돈다 (Guide 의 Where)
3. `master/root.md` 가 비어 있으면 → **멈추고 Human 에게 Root Goal / World Premise 를 요청**
4. Goal 의 주체·이유가 비어 있거나 이번 요청이 새 영역이면 → **WHY**
5. Goal 은 있는데 의미 있게 다른 Possibility 가 탐색되지 않았으면 → **OPTIONS**
6. Possibility 의 Requirement 가 비어 있거나 `overlay.md` 가 오래됐으면 → **NEED**
7. Overlay 는 최신인데 대상 트랙의 `frontier/<트랙>.md` 에 후보가 없으면 → **NEXT**
8. 후보가 있으면 → **멈추고 Human 에게 선택을 요청**

| Step | Guide | 입력 | 출력 |
|---|---|---|---|
| WHY | `guides/master-graph.md` | `root.md` · Active DC · 기존 Graph | `graph/` world-state · actors · knowledge · goals |
| OPTIONS | `guides/master-graph.md` | Goal · Active DC (Filter) | `graph/possibilities.yaml` (+ CC-*) |
| NEED | `guides/master-graph.md · guides/master-overlay.md` | Possibility · Cycle 실측 | `graph/*.yaml` 의 overlay*/implemented* 필드 → `overlay.md` 재생성 |
| NEXT | `guides/master-frontier.md` | `overlay.md` · Graph · Active DC | `master/frontier/<트랙>.md` |
| Human Select | — | `frontier/` | **Human 전용 — Agent 가 고르지 않는다** |
| Feedback | `guides/master-feedback.md` | `08-verification.md` MASTER FEEDBACK | `feedback/<CycleId>.md` · overlay · frontier/<트랙> · CC 갱신 |
| Inject | `guides/master-inject.md` | Human 지정 기반 기획 문서 · 기존 Graph/DC | constraints(DRAFT) · graph(§ provenance) · overlay · open-questions |

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
part_of 없는 MC-* 를 만들지 않는다 — 시스템·자리는 graph/systems.yaml 에 있는 것만
   가리키고, 문서가 이름만 댄 조각은 grounded: false 다 (Frontier Target 금지).
graph 노드에 근거·정정 경위·날짜 주석을 쌓지 않는다 — 노드에는 값만.
   근거는 overlay.md · Cycle 반영 경위는 feedback/<CycleId>.md ·
   Master 층 결정 경위는 HISTORY.md 소유다 (원칙 20).
frontier 트랙 파일에 진행 현황·공정 규칙을 쓰지 않는다 — 네 절(후보·추천·SELECTED·
   지금 열 수 없는 것)만. 현황은 graph/GRAPH.md 의 척추 절이, 트랙 목록·병렬 규칙은
   frontier/README.md 가 소유한다.
자기 Cycle 의 트랙 밖 frontier/ 파일을 Feedback 에서 고치지 않는다 — 트랙 이동·트랙 간
   판단은 직렬 NEXT 작업으로만 (원칙 22).
world/ view/ 코드를 수정하지 않는다 — Overlay 판정을 위해 읽기만 한다.
cycles/ 의 Artifact 를 수정하지 않는다 — History 다.
다음 Cycle Goal 을 자동 확정하지 않는다 — Human 이 고른다.
UNRESOLVED 를 SATISFIED 로 간주하지 않는다.
기반 기획 문서의 반영을 4단계 탐색으로 대신하지 않는다 — 주입은 문서에 있는 의미만 옮긴다.
```

### 막히면 — 지어내지 않는다

```text
Root Goal / World Premise 가 없다        → Human (master/root.md)
Constraint 충돌 · 예외가 필요하다        → Human (Trade-off 제시)
Capability 상태를 판정할 근거가 없다      → NEED 로 정식 재판정. 추측하지 않는다
Cycle 결과가 상위 의미와 어긋난다         → Human (MASTER GAP)
```

## 4. 닫기

* `graph/` 나 `constraints/` 를 고쳤으면 `npm run master:graph` 를 돌려
  `graph/GRAPH.md` 와 `overlay.md`(둘 다 생성물 — 손으로 고치지 않는다)를 다시 만들고
  **같은 커밋에** 넣는다. 그 출력이 정합 문제도 알려 준다 —
  없는 ID 참조 · `requires`↔`required_by` 비대칭 · 없는 Constraint 참조 · 고아 노드.
  ERROR 가 있으면 지어내서 덮지 말고 그 노드를 고치거나 Human 에게 되돌린다.
* 이어서 Human 이 보는 고정 링크를 갱신한다 — Artifact 도구에
  `file_path` = `graph/graph-view.artifact.html`, `url` = `master/README.md` 의 고정 링크.
  **`url` 을 반드시 함께 넘긴다** — 빼면 같은 링크에 덮어쓰지 않고 새 주소가 생겨
  Human 이 낡은 링크를 계속 보게 된다. Artifact 도구가 없는 환경이면 건너뛰고 보고한다.
* 커밋 메시지 형식: `HktAdvProtoH: Master <Step> — <한 줄 요약>`
* NEXT 를 끝냈으면 후보와 추천 근거를 제시하고 **Human 선택을 기다린다**.
* 선택 이후의 작업은 이 스킬이 아니라 `advprotoh-cycle` 이다.
  선택된 Frontier 의 내용을 `01-cycle.md` 의 `MASTER TRACE` 로 넘긴다.
* 무엇이 끝났고 다음이 무엇인지 보고한다.
