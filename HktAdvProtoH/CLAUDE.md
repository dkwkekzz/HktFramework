# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 개발 방식 — Progressive Cycle Workflow

이 프로젝트는 [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md)의 Progressive Cycle Workflow를 따른다.

- **Cycle** = 하나의 작은 World Capability를 `Intent → World State → World Rule → Runtime Transition → Observable → Human Verification`까지 완전히 닫는 상위 작업 단위. 검증된 결과만 World Baseline에 누적한다.
- **Stage** = 하나의 Agent invocation이 수행하는 작업 단위. **ONE INVOCATION = ONE STAGE** — 한 세션에서 여러 Stage를 연속 실행하지 않고, Stage 간에는 대화가 아니라 Artifact만 전달한다.
- 모든 작업 요청은 [guides/STAGE-ROUTER.md](guides/STAGE-ROUTER.md)에서 시작한다 — 현재 Stage를 식별하고 해당 Stage Guide + 입력 Artifact만 로드한다.
- **Human Semantic Review 없이 Implementation으로 진행하지 않는다.** 설계 의미가 부족하면 추측하지 않고 DESIGN GAP을 만들고 중단한다.
- 전체 규칙(RULE 1~12)은 [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) §27 참조.

### Agent 기본 Context

```text
context/TARGET-HORIZON.md
+
context/CURRENT-CYCLE.md
+
context/WORLD-BASELINE.md 중 관련 Subset
+
현재 Stage 입력 Artifact (cycles/cycle-XXX/)
+
현재 Stage Guide (guides/)
```

`design/` 원본 문서는 기본 입력이 아니라 **fallback reference**다 (RULE 12).

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** |
| [guides/STAGE-ROUTER.md](guides/STAGE-ROUTER.md) | **작업 진입점** — Stage 식별·라우팅 |
| [context/TARGET-HORIZON.md](context/TARGET-HORIZON.md) | 최종 방향 + 절대 구조 원칙 (저변경) |
| [context/WORLD-BASELINE.md](context/WORLD-BASELINE.md) | 구현·검증 완료된 World Semantic (Cycle 종료마다 갱신) |
| [context/CURRENT-CYCLE.md](context/CURRENT-CYCLE.md) | 현재 Cycle Contract + Stage 진행 상황 |
| [context/EVOLUTION-BACKLOG.md](context/EVOLUTION-BACKLOG.md) | 장기 필요 가능성이 있는 유예 Semantic |
| [guides/](guides/) | Stage별 수행 가이드 (STAGE-0 ~ STAGE-7) |
| [templates/](templates/) | Artifact 템플릿 (Contract, Intent, World Definition, …) |
| [cycles/](cycles/) | Cycle별 Artifact Chain 저장소 |
| [design/Design-Concept.md](design/Design-Concept.md) | 세계·주체 개념 원문 (fallback reference) |
| [design/Design-Workflow.md](design/Design-Workflow.md) | Observable World 구현 Workflow 원문 (fallback reference) |
| [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | Progressive Cycle Workflow 원문 (fallback reference) |
