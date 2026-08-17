# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

개발의 기본 단위는 **Cycle** — 현재 게임에 플레이 가능한 Delta 하나를 더한다.

## 현재 상태 — 먼저 읽는다 (2026-08-17 Human 지시)

지금은 **전투 기본 규칙(OffenseDefense) 트랙을 마무리하는 중**이다.
그것이 끝나기 전에는 Master Layer 를 세우는 작업을 시작하지 않는다.

기준 문서는 [design/Design-Combat-OffenseDefense-R0.md](design/Design-Combat-OffenseDefense-R0.md) (R1) 이고,
§14 확장 사다리를 **아래에서부터 한 층씩** 올린다.

```text
닫힘   Basic Damage 층      cycles/C010-stats-decide-the-damage           COMPLETE
       Defense Action 층    cycles/C011-guard-trades-body-for-resource    COMPLETE
보류   Critical 층          DC-COMBAT-PLAYER-CAUSALITY 의 random_critical 금지와 충돌.
                            R1 자신이 "결정론을 중요하게 여긴다면 넣을지 다시 판단한다" 고
                            열어 두었고 결정은 아직 미기록 — master/open-questions.md Q11
진행   Damage Type 층       cycles/C012-damage-type-chooses-the-defense   IN PROGRESS
                            세부 설계 원본은 design/Design-Combat-DamageType-R0.md 다
                            (2026-08-17 도착 — 이 층이 막혀 있던 이유가 풀렸다)
그 위  Penetration → Active Defense(완벽한 막기·되받아치기) → Aura/Nen
```

각 층은 **자기 설계 원본이 도착한 뒤에** 연다. 원본이 네 단어뿐이면 Cycle 을 열지 않는다 —
Agent 가 없는 설계를 지어내 채우는 것은 금지다.

### Master Layer 는 아직 시작 전이다

Human 이 직접 세운 것은 `master/constraints/` 뿐이다. `master/graph/` `master/overlay.md`
`master/frontier.md` 는 R1 개정 때 설계 문서의 의미를 옮겨 둔 것이며 **Master Layer 를 실제로
세운 결과가 아니다** (2026-08-17 Human 확인). 따라서 지금은:

```text
다음 Cycle 을 frontier.md 만 보고 고르지 않는다.
```

`frontier.md` 는 Capability 의존성만 본다 — **층 높이를 보지 않는다.** 실제로 그 목록은 Guard 가
닫히자 Active Defense(완벽한 막기)를 다음으로 올리는데, 그 사이의 Damage Type · Penetration
두 층을 건너뛴다. 구 C010·C011 이 롤백된 원인이 바로 그 종류의 층 건너뛰기였다.
**층 순서의 기준은 `frontier.md` 가 아니라 R1 §14 와 §15 층 그림이다.**

이 절은 OffenseDefense 트랙이 닫히고 Master Layer 를 제대로 세운 뒤에 Human 이 걷는다.

## 두 층

Workflow 는 두 층이다. 무엇을 왜 만들지 정하는 층과, 그것을 실제로 닫는 층을 분리한다.

```text
MASTER LAYER   master/    무엇을 왜 만들 것인가 · 어떤 다른 방법이 있는가 · 어떤 Constraint 아래인가
               지속적으로 자라는 하나의 Typed Graph. History 가 아니라 현재 상태다
                   Constraint → Goal → (OR) Possibility → (AND) Capability
                   → Existing World Overlay → Frontier

CYCLE LAYER    cycles/    선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다
               기존 8 Stage. Master 도입으로 이 공정은 변경되지 않는다
```

접합점은 **둘뿐**이다. 그 외 경로로 두 층이 서로를 건드리지 않는다.

```text
아래로   master/frontier.md 의 SELECTED   →  01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  master/overlay.md · candidates/ 반영
```

Cycle Agent 는 `master/` 를 편집하지 않는다 — 보고까지가 Cycle 의 책임이다.
Master Agent 는 `world/` `view/` 를 편집하지 않는다 — Overlay 판정을 위해 읽기만 한다.

정책 원본: [design/Master-Intent-Graph-Policy.md](design/Master-Intent-Graph-Policy.md)

## 읽는 순서

모든 Agent 는 다음 셋만 읽고 작업한다.

```text
1. CLAUDE.md              이 문서 — 공통 불변 규칙
2. guides/<stage>.md      자기 단계의 작업 방법
3. 입력 Artifact          Cycle 이면 cycles/<CycleId>/… · Master 면 master/…
```

필요한 경우에만 관련 기존 Capability Artifact 나 코드를 추가로 확인한다.
`design/` 전체 문서는 일반적인 작업 Context 가 아니다.

단계 실행은 스킬이 담당한다 — 다음 미완료 Stage 판정, 공통 규칙 상세, Artifact 형식을
스킬이 로드한다. 따라서 이 문서에는 원칙과 인덱스만 둔다.

```text
Cycle Stage    advprotoh-cycle 스킬
Master Stage   advprotoh-master 스킬
```

## 핵심 원칙

```text
 1. AI Agent 는 전체 설계 문서를 매번 읽지 않는다.
 2. CLAUDE.md 는 프로젝트 전체 공통 불변 규칙을 제공한다.
 3. 각 Stage Guide 는 해당 단계의 작업 방법만 제공한다.
 4. 각 Agent 는 이전 Artifact 를 입력받아 다음 Artifact 를 만든다.
 5. Artifact 가 Agent 간 Context 전달 수단이다. 대화 History 가 아니다.
 6. Cycle 은 기능 Module 이 아니라 하나의 플레이 가능한 Game Delta 다.
 7. 새 Cycle 은 기존 Capability 를 재사용하거나 확장하거나 변경할 수 있다.
 8. 과거 Cycle Artifact 는 History 로 보존한다.
 9. 현재 World 와 View 는 Cycle 을 거치며 계속 발전한다.
10. 기존 Semantic 변경 시 REUSED / ADDED / CHANGED / AFFECTED 를 명시한다.
11. 영향을 받는 기존 Rule 과 플레이 Scenario 도 함께 검증한다.
12. World 는 Authoritative Server 이고 View 는 독립적인 Client 다.
13. World → View 계약은 GameView Specification 이다.
14. View 는 GameView Specification 만으로 동작할 수 있어야 한다.
15. 최종 완료 조건은 코드 작성이 아니라 실제 Cycle Goal 의 플레이 가능성이다.
16. Cycle Goal 은 Master Layer 의 Frontier 에서 온다 — 없으면 그 사유를 적는다.
17. Constraint 는 Goal/Possibility/Capability 의 **형태**를 제한할 뿐, 시스템 목록을
    직접 만들지 않는다. Capability 의 필요성은 Possibility 에서 나온다.
18. Master 에는 플레이 의미를, Cycle 에는 수치·공식·판정을 둔다.
19. Constraint 의 승격·변경과 다음 Cycle Goal 선택은 Human 이 결정한다.
```

## Kind 정적 데이터

존재 종류(CharacterKind)의 정적 데이터는 3원소(world 카탈로그 · view kind 표현 · `motions/<kind>/`)에만
둔다. 세부 규칙은 각 Stage Guide(World / View Implementation · Verification)가 담당한다.
관찰·정합 검사: `npm run catalog` / `npm run catalog:check`.

## 막혔을 때

이전 단계에서 확정된 의미를 임의로 바꾸거나 없는 의미를 만들어내지 않는다.
부족한 내용을 명시하고 그 의미를 책임지는 단계로 반환한다.

```text
GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  어느 단계가 이 의미를 책임지는가
```

반환 방향은 정해져 있다. 마지막 하나가 두 층 사이의 반환이다.

```text
View 정보 부족             → GameView Specification
Spec 정보 부족             → World Semantic
Semantic 정보 부족         → Intent
Intent 가 Goal 과 불일치    → Cycle Definition (Human)
Cycle Goal 이 상위 Possibility / Constraint 와 어긋남 → MASTER (Human)
```

## Master Stage 인덱스

| Stage | Guide | Artifact |
|---|---|---|
| M1. Constraint | [guides/master-constraint.md](guides/master-constraint.md) | `master/constraints/DC-*.yaml` |
| M2. Graph Expansion | [guides/master-graph.md](guides/master-graph.md) | `master/graph/*.yaml` |
| M3. Capability Overlay | [guides/master-overlay.md](guides/master-overlay.md) | `master/overlay.md` |
| M4. Frontier | [guides/master-frontier.md](guides/master-frontier.md) | `master/frontier.md` |
| M5. Human Selection | Human | `frontier.md` 의 `SELECTED` → Cycle Stage 1 |
| MF. Feedback | [guides/master-feedback.md](guides/master-feedback.md) | `overlay.md` · `frontier.md` · `candidates/` |

Root Game Goal / World Premise (`master/root.md`) 와 Constraint 승인은 Human 소유다.
파일 형식의 단일 출처는 [master/SCHEMA.md](master/SCHEMA.md) 다.

## Cycle Stage 인덱스

| Stage | Guide | Artifact |
|---|---|---|
| 1. Cycle Definition | [guides/cycle-definition.md](guides/cycle-definition.md) | `01-cycle.md` |
| 2. Intent | [guides/intent.md](guides/intent.md) | `02-intent.md` |
| 3. World Semantic | [guides/world-semantic.md](guides/world-semantic.md) | `03-world-semantic.md` |
| 4. GameView Specification | [guides/gameview-spec.md](guides/gameview-spec.md) | `04-gameview.spec.yaml` |
| 5. Human Semantic Review | Human | `05-review.md` |
| 6. World Implementation | [guides/world-implementation.md](guides/world-implementation.md) | `world/` + `06-world-implementation.md` |
| 7. View Implementation | [guides/view-implementation.md](guides/view-implementation.md) | `view/` + `07-view-implementation.md` |
| 8. Verification | [guides/verification.md](guides/verification.md) | `08-verification.md` |

각 단계의 MUST / MUST NOT / DONE WHEN 은 해당 Guide 에 있다. 여기에 중복해 두지 않는다.

## 디렉터리 인덱스

| 경로 | 내용 | 수명 |
|---|---|---|
| [guides/](guides/) | Stage Guide — 단계별 작업 방법·완료 조건 | 공정이 바뀔 때만 |
| [master/](master/) | Master Intent Graph — Constraint · Graph · Overlay · Frontier | 현재 상태, 계속 자란다 |
| [cycles/](cycles/) | Cycle Artifact — 진행 기록 | History, 수정하지 않는다 |
| [world/](world/) | Authoritative World 구현 (Server) | 현재 게임, 계속 발전 |
| [view/](view/) | Client View 구현 | 현재 게임, 계속 발전 |
| [protocol/](protocol/) | World ↔ View 경계 타입만 | 현재 게임, 계속 발전 |
| [design/](design/) | 원본 설계 — 경계 사례에서만 참조 | 원본 |

## 기준 문서 (Source of Truth)

| 문서 | 내용 |
|---|---|
| [Design-Concept.md](design/Design-Concept.md) | 세계와 주체의 행동 구조 — 무엇이 존재하고 어떤 변화가 가능한가 |
| [Master-Intent-Graph-Policy.md](design/Master-Intent-Graph-Policy.md) | **Master Layer 정책** — Constraint · Graph · Overlay · Frontier · 두 층의 접합 |
| [Design-Workflow.md](design/Design-Workflow.md) | Goal/Possibility 기반 Observable World 구현 Workflow |
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | Cycle 단위 점진 개발 공정 |
| [Design-CycleExecution.md](design/Design-CycleExecution.md) | **Agent 실행 방식** — 이 작업환경의 근거 |

`guides/` 는 이 문서들에서 각 단계에 필요한 규칙만 압축한 것이다.

충돌 시 우선순위:

```text
Master Layer 의 의미·절차                     → Master-Intent-Graph-Policy.md
Artifact 이름 · 단계 구분 · Agent 실행 방식   → Design-CycleExecution.md
그 외 공정과 게임 의미                        → Design-Workflow / Design-CycleWorkflow
```

`Design-Workflow` / `Design-CycleWorkflow` 의 Goal/Possibility 는 **Cycle-local** 의미로 읽는다.
지속적인 상위 Goal/Possibility 는 `master/` 가 소유한다 (Master-Intent-Graph-Policy §19).

`Design-CycleWorkflow.md` 의 §33(Artifact 이름 5종)과 §19(Implementation 단일 단계)는
`Design-CycleExecution.md` 가 대체한다 — 실제 규격은 `01-cycle.md` ~ `08-verification.md` 8종,
World / View 구현 2단계다.
