# master/ — Master Intent Graph

이 디렉터리는 **Master Layer** 의 산출물이다.

```text
MASTER LAYER   무엇을 왜 만들 것인가 · 어떤 다른 방법이 있는가 · 어떤 Constraint 아래인가
CYCLE LAYER    선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다  → cycles/
```

정책 원본은 [../design/Master-Intent-Graph-Policy.md](../design/Master-Intent-Graph-Policy.md) 다.
파일 형식의 단일 출처는 [SCHEMA.md](SCHEMA.md) 다.
작업 방법은 `../guides/master-*.md` 가, 실행은 `advprotoh-master` 스킬이 담당한다.

## 현재 상태

전투 영역 Master 작업 완료 — 원본 `design/Design-Combat-OffenseDefense-R0.md`.
Quality Gate 자가 점검(정책 §25)까지 돌렸고, 남은 것은 **Human 결정 8건**뿐이다.

```text
Constraint    4     DC-COMBAT-*  (APPROVED 1 · DRAFT 3 — 승인 대기)
Candidate     3     CC-*         (전부 PENDING)
Actor         2     Knowledge 2 · Belief 0
Goal          2     Possibility 9
Capability   17     IMPLEMENTED 2 · PARTIAL 2 · MISSING 13
Frontier      6     전부 PROPOSED — 선택 없음
WorldState    0     비어 있다 (아래)

Open Question 8   → open-questions.md
```

Cycle 을 열기 전에 답해야 하는 것은 **Q1(Constraint 승인)** 이고,
전투 Frontier 중 Flow / Vow 계열은 **Q4** 가 먼저 답해져야 한다.

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
