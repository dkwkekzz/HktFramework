# master/ — Master Intent Graph

> ## 진행 순서 — 2026-08-17 Human 지시
>
> 전투 기본 규칙(OffenseDefense) 트랙을 마무리하는 것이 먼저다. 그 전에는 이 디렉터리를
> **새로 세우는** 작업(M2 Graph 확장 · Constraint 신설)을 시작하지 않는다.
> 닫힌 Cycle 을 반영하는 MF Feedback 은 그 제한에 걸리지 않는다 — 그것을 미루면
> `frontier.md` 와 `overlay.md` 가 현재 세계와 어긋나 다음 선택을 흐린다.
>
> Human 이 직접 세운 것은 `constraints/` 뿐이다. `graph/` `overlay.md` `frontier.md` 는
> R1 개정 때 설계 문서의 의미를 옮겨 둔 것이며 Master 를 처음부터 세운 결과가 아니다.
>
> 현재 어긋나 있는 것 — `overlay.md` 의 MC-GUARD 가 아직 MISSING 이다.
> C011 08-verification.md 가 승격 근거를 냈으나 반영 전이다.
> (`frontier.md` 는 2026-08-17 MF 로 갱신되었다.)

이 디렉터리는 **Master Layer** 의 산출물이다.

```text
MASTER LAYER   무엇을 왜 만들 것인가 · 어떤 다른 방법이 있는가 · 어떤 Constraint 아래인가
CYCLE LAYER    선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다  → cycles/
```

정책 원본은 [../design/Master-Intent-Graph-Policy.md](../design/Master-Intent-Graph-Policy.md) 다.
파일 형식의 단일 출처는 [SCHEMA.md](SCHEMA.md) 다.
작업 방법은 `../guides/master-*.md` 가, 실행은 `advprotoh-master` 스킬이 담당한다.

## 현재 상태

전투 영역 주입 — 원본 `design/Design-Combat-OffenseDefense-R0.md` (본문 바이트 단위 보존).
Graph 는 Quality Gate 자가 점검(정책 §25)까지 돌렸다.
**Constraint 층은 비어 있다** — Agent 가 원본에서 산출했던 DC/CC 를 Human 지시로 제거했다.

```text
Constraint    0     제거됨 — Human 이 세운다 (constraints/README.md)
Candidate     0     제거됨
Actor         2     Knowledge 2 · Belief 0
Goal          2     Possibility 9
Capability   17     IMPLEMENTED 2 · PARTIAL 2 · MISSING 13
Frontier      6     전부 PROPOSED — 선택 없음
WorldState    0     비어 있다 (아래)

Open Question 3   → open-questions.md
```

Constraint 가 없으므로 Graph 의 `constraints` · `constraint_evaluation` 은 전부 비어 있고,
Frontier 의 후보 조건 6번(Active Constraint 와 양립)은 판정되지 않는다.

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
