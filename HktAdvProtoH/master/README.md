# master/ — Master Intent Graph

> ## 진행 순서 — 2026-08-17 Human 지시 (2026-08-18 갱신)
>
> 전투 기본 규칙(OffenseDefense) 트랙을 마무리하는 것이 먼저다. 그 전에는 이 디렉터리를
> **새 영역으로** 넓히는 작업(다른 주제의 WHY/OPTIONS/NEED Graph 확장 · Constraint 신설)을
> 시작하지 않는다. 닫힌 Cycle 을 반영하는 Feedback 은 그 제한에 걸리지 않는다 — 그것을 미루면
> `frontier.md` 와 `overlay.md` 가 현재 세계와 어긋나 다음 선택을 흐린다.
>
> Human 이 직접 세운 것은 `constraints/` 뿐이다. `graph/` `overlay.md` `frontier.md` 는
> R1 개정 때 설계 문서의 의미를 옮겨 둔 것이며 Master 를 처음부터 세운 결과가 아니다.
>
> **2026-08-18 — 이 지시 아래에서 Graph 확장을 한 번 실행했다.** OffenseDefense 트랙 자신의
> 다음 층(Penetration)이 Graph 에 노드가 없어 Frontier 에 나타나지 못하고 있었다.
> 새 영역이 아니라 **진행 중인 트랙의 결손**이므로 위 제한의 취지에 어긋나지 않는다고
> 판단했다 — MC-PENETRATION · MP-PIERCE-THE-HARD-DEFENSE 2종. 이견이 있으면 되돌린다.

이 디렉터리는 **Master Layer** 의 산출물이다.

```text
MASTER LAYER   WHY → OPTIONS → NEED → NEXT — 무엇을 왜 만들지 결정한다
CYCLE LAYER    선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다  → cycles/
```

## 기본 절차 — 4단계

Master 는 네 단계만 기본 절차로 사용한다 (정책 §9). 각 단계의 산출물이 이 디렉터리다.

```text
1. WHY        World / Actor / Goal — 누가 무엇을 왜 원하는가      → graph/ (world-state·actors·knowledge·goals)
       ↓
2. OPTIONS    Goal 을 달성하는 의미 있게 다른 여러 Possibility     → graph/possibilities.yaml
       ↓
3. NEED       각 Possibility 에 필요한 Capability
              + Existing World 에 이미 있는지 확인                → graph/capabilities.yaml · overlay.md
       ↓
4. NEXT       Missing / Partial 중 Frontier 후보 선택             → frontier.md
       ↓
   Human Select  →  기존 8 Stage Cycle
```

Constraint 는 단계가 아니라 각 선택 지점에 적용되는 **Filter** 다 (정책 §2.3 · §10).
Feedback(아래 접합점)은 닫힌 Cycle 의 사실을 반영하는 작업이며 기본 4단계에 들어가지 않는다.
Knowledge / Belief · Conflict · Consequence · Reveal / Reframe · Constraint Candidate 는
실제 설계 결정에 영향을 줄 때만 쓰는 보조 규칙이다 (정책 §11).

정책 원본은 [../design/Master-Intent-Graph-Policy.md](../design/Master-Intent-Graph-Policy.md) 다.
파일 형식의 단일 출처는 [SCHEMA.md](SCHEMA.md) 다.
작업 방법은 `../guides/master-*.md` 가, 실행은 `advprotoh-master` 스킬이 담당한다.

## 현재 상태

전투 영역 주입 — 원본 `design/Design-Combat-OffenseDefense-R0.md` **R1** (§14 확장 순서가
Cycle 사다리다). 기준 시점 **C012 닫힘 (2026-08-18)**.

```text
Constraint    8     APPROVED 5 (Active) · DRAFT 3 (보류 — Q12)
Candidate     3     APPROVED 1 (→ DC) · PENDING 2
Actor         2     Knowledge 2 · Belief 0
Goal          2     Possibility 11
Capability   20     IMPLEMENTED 7 · PARTIAL 2 · MISSING 11
Frontier      1     PROPOSED — FR-PENETRATION-DEVALUES-THE-WALL (Human 선택 대기)
WorldState    0     비어 있다 (아래)

Open Question 5   → open-questions.md (Q2 · Q3 · Q8 · Q11 · Q12)
```

닫힌 Possibility 3종 — MP-OUTGROW-THE-OPPONENT(C010) · MP-TRADE-BODY-FOR-RESOURCE(C011) ·
MP-MATCH-WEAPON-TO-ARMOR(C012). 요구 Capability 가 하나도 비어 있지 않은 경로들이다.

아직 비어 있는 것 — 지어내지 않고 남긴 자리다:

```text
root.md                  Root Game Goal · World Premise — Human 소유. 비어 있다
graph/world-state.yaml   World Cause 가 없다. 주입된 문서가 전투 규칙 문서이기 때문이다.
                         그래서 Goal 의 caused_by / motivation 도 비어 있다  → Q2
Belief                   오독의 여지를 어디까지 둘지가 미정이다              → Q3
전투 밖 경로             같은 상대를 싸움 밖으로 넘어서는 길이 없다          → Q8
```

## 수명

```text
cycles/     History     한번 닫히면 수정하지 않는다
master/     현재 상태    world/ view/ 처럼 계속 갱신된다
```

과거 판정을 남기려면 파일을 복제하지 말고 Node 의 `status` 와 근거 Cycle 참조로 남긴다.

## 파일

| 경로 | 내용 | 소유 |
|---|---|---|
| [root.md](root.md) | Root Game Goal · World Premise | **Human** |
| [constraints/](constraints/) | `DC-*.yaml` — 승인된 Design Constraint | **Human** 승인 |
| [graph/](graph/) | MW · MA · MK · MB · MG · MP · MC · edges | Master Design Agent |
| [overlay.md](overlay.md) | Capability × 현재 구현 상태 (IMPLEMENTED/PARTIAL/MISSING) | Master Design Agent |
| [frontier.md](frontier.md) | `FR-*` 후보 + Human 선택 기록 | Agent 제안 / **Human** 선택 |
| [candidates/](candidates/) | `CC-*.md` — 미승인 Constraint Candidate | Agent 제안 / **Human** 승인 |
| [open-questions.md](open-questions.md) | 승인 대기 · Constraint 충돌 · 설계 공백 · Trade-off | Agent 제기 / **Human** 결정 |

## 두 층의 접합점

접합점은 둘뿐이다. 그 외 경로로 두 층이 서로를 건드리지 않는다.

```text
아래로   frontier.md 의 선택된 FR-*   →  cycles/<CycleId>/01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  overlay.md 갱신 · candidates/ 제출
```

Cycle Agent 는 `master/` 를 **직접 편집하지 않는다**. 보고까지가 Cycle 의 책임이고,
반영은 Master Feedback Stage 가 한다.

## 절대 규칙

```text
Constraint 는 시스템 목록을 만들지 않는다 — Goal/Possibility 의 형태를 제한할 뿐이다.
Capability 의 필요성은 Possibility 에서 나온다 — Constraint 에서 나오지 않는다.
수치·공식·판정 상수는 여기 두지 않는다 — Cycle 의 03-world-semantic.md 가 소유한다.
Agent 는 Constraint 를 자동 승격하지 않는다 — Human 이 승인한다.
Agent 는 Constraint 충돌을 임의로 해결하지 않는다 — Trade-off 로 노출한다.
```
