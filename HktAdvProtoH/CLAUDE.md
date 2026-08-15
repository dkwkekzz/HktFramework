# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

개발의 기본 단위는 **Cycle** — 현재 게임에 플레이 가능한 Delta 하나를 더한다.

## 두 층

작업은 두 층으로 나뉜다. 경계는 **Cycle Goal 한 문장** 이다.

```text
MASTER 층    무엇을 만들 것인가        master/            M1 · M2 · M3
             세계 원인 · Actor 동기 · 믿음 · Goal · 대안 Possibility · Capability
             Human 이 후보 중 하나를 골라 Cycle Goal 로 확정한다
──────────────────────────── CYCLE BOUNDARY ────────────────────────────
CYCLE 층     그것을 어떻게 닫을 것인가  cycles/<CycleId>/  Stage 1 ~ 8
             확정된 Cycle Goal 을 Intent → World Semantic → 구현 → 검증으로 닫는다
```

Master 층이 Cycle 층에 요구하는 것은 없다 — Cycle Goal 이 정해지면 Stage 1~8 은 그대로다.
연결은 정확히 두 지점이다: `01-cycle.md` 의 `MASTER TRACE`(**선택**)와,
Cycle 완료 후의 Capability 상태 갱신.

## 읽는 순서

모든 Agent 는 다음 셋만 읽고 작업한다.

```text
1. CLAUDE.md              이 문서 — 공통 불변 규칙
2. guides/<stage>.md      자기 단계의 작업 방법
3. cycles/<CycleId>/…     현재 Cycle 의 입력 Artifact   (Master 층이면 master/graph/…)
```

필요한 경우에만 관련 기존 Capability Artifact 나 코드를 추가로 확인한다.
`design/` 전체 문서는 일반적인 작업 Context 가 아니다.

단계 실행은 스킬이 담당한다 — 다음 미완료 Stage 판정, 공통 규칙 상세, Artifact 형식을
스킬이 로드한다. 따라서 이 문서에는 원칙과 인덱스만 둔다.

```text
Cycle 층 Stage 1~8    advprotoh-cycle 스킬
Master 층 M1 · M2     advprotoh-master 스킬
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
16. Master 층은 고를 수 있는 것을 넓히고 Cycle 층은 고른 것을 닫는다 — 서로의 단계를 대신하지 않는다.
17. 다음 Cycle Goal 은 Human 이 고른다. Agent 는 Frontier 후보를 만들 뿐이다.
18. Capability 의 IMPLEMENTED 는 주장이 아니라 근거다 — Cycle ID 와 구현 위치를 인용한다.
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

## Master 층 인덱스 (Cycle 이전)

| Step | Guide | Artifact |
|---|---|---|
| M1. Master Graph Expansion | [guides/master-expand.md](guides/master-expand.md) | `master/graph/*.yaml` |
| M2. Overlay & Frontier | [guides/master-frontier.md](guides/master-frontier.md) | `master/frontier.md` |
| M3. Cycle Goal 선택 | Human | Cycle Goal 한 문장 |

정책은 [design/Master-Intent-Graph-Policy.md](design/Master-Intent-Graph-Policy.md),
파일 규약과 현재 상태는 [master/README.md](master/README.md).
관찰·정합 검사: `npm run master` / `npm run master:check`.

## Stage 인덱스 (Cycle)

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
| [master/](master/) | Master Intent Graph · Frontier 후보 — 무엇을 만들 것인가 | 계속 넓어진다 |
| [cycles/](cycles/) | Cycle Artifact — 진행 기록 | History, 수정하지 않는다 |
| [world/](world/) | Authoritative World 구현 (Server) | 현재 게임, 계속 발전 |
| [view/](view/) | Client View 구현 | 현재 게임, 계속 발전 |
| [protocol/](protocol/) | World ↔ View 경계 타입만 | 현재 게임, 계속 발전 |
| [design/](design/) | 원본 설계 — 경계 사례에서만 참조 | 원본 |

## 기준 문서 (Source of Truth)

| 문서 | 내용 |
|---|---|
| [Design-Concept.md](design/Design-Concept.md) | 세계와 주체의 행동 구조 — 무엇이 존재하고 어떤 변화가 가능한가 |
| [Design-Workflow.md](design/Design-Workflow.md) | Goal/Possibility 기반 Observable World 구현 Workflow |
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | Cycle 단위 점진 개발 공정 |
| [Design-CycleExecution.md](design/Design-CycleExecution.md) | **Agent 실행 방식** — 이 작업환경의 근거 |
| [Master-Intent-Graph-Policy.md](design/Master-Intent-Graph-Policy.md) | **Master 층** — Cycle 이전의 설계 그래프 구성 정책 |

`guides/` 는 이 문서들에서 각 단계에 필요한 규칙만 압축한 것이다.

충돌 시 우선순위:

```text
Artifact 이름 · 단계 구분 · Agent 실행 방식   → Design-CycleExecution.md
Cycle 이전(무엇을 만들 것인가)의 설계 공정     → Master-Intent-Graph-Policy.md
그 외 공정과 게임 의미                        → Design-Workflow / Design-CycleWorkflow
```

`Master-Intent-Graph-Policy.md` 는 Cycle 내부 8단계를 바꾸지 않는다 — Cycle Goal 이전만 다룬다.

`Design-CycleWorkflow.md` 의 §33(Artifact 이름 5종)과 §19(Implementation 단일 단계)는
`Design-CycleExecution.md` 가 대체한다 — 실제 규격은 `01-cycle.md` ~ `08-verification.md` 8종,
World / View 구현 2단계다.
