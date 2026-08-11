# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다. 
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 작업 방식 — Observable World Agent Workflow

이 트랙의 모든 구현 작업은 **`observable-world-workflow` Skill (Stage Router)** 을 통해 진행한다.

```
ONE INVOCATION = ONE STAGE
```

한 번의 호출에서 한 Stage 만 수행하고 결과 Artifact 를 남긴 뒤 종료한다.
다음 Stage 는 **새로운 호출**이 그 Artifact 를 입력으로 시작한다.

```
Human Design (design/graph/)
   → Intent Package        (artifacts/intent/)
   → World Definition      (artifacts/world/)          DRAFT
   → Human Semantic Review                             APPROVED 만 통과
   → Implementation Result (artifacts/implementation/)
   → Verification Report   (artifacts/verification/)
   → Human Observation
```

지켜야 할 최소 불변식은
[.claude/skills/observable-world-workflow/references/common-invariants.md](../.claude/skills/observable-world-workflow/references/common-invariants.md) 에 있다.

설계 의미가 부족하면 **발명하지 않고** `artifacts/design-gaps/GAP-*.md` 를 내고 멈춘다.
Goal / Possibility / Intent 의 의미 변경은 구현 변경이 아니라 설계 변경이며, 인간의 결정이다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

원본 설계 문서(`design/Design-Concept.md`, `design/Design-Workflow.md`)는 **기본 Context 에 넣지 않는다**.
필요할 때만 [source-index.md](../.claude/skills/observable-world-workflow/references/source-index.md) 를 거쳐
해당 절만 읽는다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** (핵심만 — 상세는 artifacts/) |
| [design/Design-Concept.md](design/Design-Concept.md) | 세계 의미론 원문 — fallback reference |
| [design/Design-Workflow.md](design/Design-Workflow.md) | 구현 Workflow 원문 — fallback reference |
| [design/graph/](design/graph/README.md) | Human Design — Goal / Possibility Graph (Source of Truth) |
| [artifacts/REGISTRY.md](artifacts/REGISTRY.md) | Stage 간 Handoff Artifact 색인 |
| [.claude/skills/observable-world-workflow/SKILL.md](../.claude/skills/observable-world-workflow/SKILL.md) | Stage Router (Control Plane) |
