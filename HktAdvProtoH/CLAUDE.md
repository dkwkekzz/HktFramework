# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 작업 규칙

**작업 시작 시 [AGENTS.md](AGENTS.md) 와 자기 단계의 [guides/](guides/) 하나만 읽는다.**

`design/` 전체 문서는 일반적인 작업 Context 가 아니다 — Guide 로 판단할 수 없는 경계 사례에서만 참조한다.

Agent 실행 규칙 전체는 [AGENTS.md](AGENTS.md) 에 있다. 요약:

1. 개발의 기본 단위는 **Cycle** — 현재 게임에 플레이 가능한 Delta 하나를 더한다.
2. 단계 간 전달은 대화가 아니라 **Artifact** (`cycles/<CycleId>/NN-*.md`) 로 한다.
3. 모든 Cycle 은 하나의 **공유 World / View** 를 발전시킨다. Capability 별 분화 금지.
4. World 는 Authoritative Server, View 는 Client. 서로의 내부 구현을 참조하지 않는다.
5. World → View 의 공개 계약은 **GameView Specification 하나**다.
6. 이전 단계에서 확정된 의미를 임의로 바꾸지 않는다 — 부족하면 담당 단계로 **Gap 반환**.
7. 기존 Semantic 변경 시 **REUSED / ADDED / CHANGED / AFFECTED** 를 명시하고 Regression 을 함께 검증한다.
8. 완료 조건은 코드 실행이 아니라 **실제 Cycle Goal 의 플레이 가능성**이다.

## 폴더 구조

| 폴더 | 내용 |
|---|---|
| [AGENTS.md](AGENTS.md) | **모든 Agent 공통 불변 규칙** — 항상 첫 번째로 읽는다 |
| [guides/](guides/) | Stage Guide 7종 — 단계별 작업 방법 (`ROLE / INPUT / DO / OUTPUT / MUST / MUST NOT / DONE WHEN`) |
| [cycles/](cycles/) | Cycle Artifact — 진행 기록. 과거 Cycle 은 수정하지 않는다 |
| [world/](world/) | Authoritative World 구현 (Server) |
| [view/](view/) | Client View 구현 |
| [protocol/](protocol/) | World ↔ View 경계 타입만 |
| [design/](design/) | 원본 설계 문서 — 기본 작업 Context 아님 |

## Cycle 실행 흐름

```text
Human Cycle Goal
    → 01-cycle.md            guides/cycle-definition.md
    → 02-intent.md           guides/intent.md
    → 03-world-semantic.md   guides/world-semantic.md
    → 04-gameview.spec.yaml  guides/gameview-spec.md
    → 05-review.md           Human Semantic Review
    → world/  + 06-world-implementation.md   guides/world-implementation.md
    → view/   + 07-view-implementation.md    guides/view-implementation.md
    → 08-verification.md     guides/verification.md
    → Human Play → Cycle Complete
```

## 기준 문서 (Source of Truth)

| 문서 | 내용 |
|---|---|
| [Design-Concept.md](design/Design-Concept.md) | 세계와 주체의 행동 구조 — 무엇이 존재하고 어떤 변화가 가능한가 |
| [Design-Workflow.md](design/Design-Workflow.md) | Goal/Possibility 기반 Observable World 구현 Workflow |
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | Cycle 단위 점진 개발 공정 — World / GameView / Verification |

`guides/` 는 이 문서들에서 각 단계에 필요한 규칙만 압축한 것이다. 둘이 충돌하면 `design/` 이 원본이다.
