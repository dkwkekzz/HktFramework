# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다. 
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

작업 방식은 [AGENTS.md](AGENTS.md) 부트스트랩을 따른다 — **ONE INVOCATION = ONE STAGE**.
요청의 Stage 하나를 식별해 해당 Stage Guide 만 로드하고, 그 Stage 만 수행한 뒤 STOP 한다.
다음 Stage 는 별도 invocation 이다. Stage 간에는 대화가 아니라 **Artifact** 만 전달한다.

다른 프로젝트( HktAdvProtoF / G 등 )는 참고하지 말 것.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** |
| [AGENTS.md](AGENTS.md) | **부트스트랩** — Stage Router 절차 + 공통 불변 규칙 12개 |
| [context/TARGET-HORIZON.md](context/TARGET-HORIZON.md) | **기본 Context** — 최종 방향 + 절대 원칙 (변경 빈도 최소) |
| [context/WORLD-BASELINE.md](context/WORLD-BASELINE.md) | **기본 Context** — 검증된 World Semantic (Stage 7 만 갱신) |
| [context/CURRENT-CYCLE.md](context/CURRENT-CYCLE.md) | **기본 Context** — 현재 Cycle 과 Stage 진행 위치 |
| [context/EVOLUTION-BACKLOG.md](context/EVOLUTION-BACKLOG.md) | 미래 의미 기록 (placeholder 를 만들기 위한 목록이 아님) |
| [stages/](stages/) | Stage Guide 8종 — Stage 당 하나 |
| [templates/](templates/) | Artifact 서식 9종 |
| [cycles/](cycles/) | Cycle 별 Artifact 산출물 |
| [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | 운영 헌법 (원본) — **fallback reference** |
| [design/Design-Concept.md](design/Design-Concept.md) | 세계·주체 개념 원문 — **fallback reference** |
| [design/Design-Workflow.md](design/Design-Workflow.md) | Observable World 구현 Workflow 원문 — **fallback reference** |

`design/` 은 기본 Context 가 아니다 (RULE 12). 기존 Artifact 와 Baseline 만으로
판단할 수 없을 때만 연다.

## 스킬

| 스킬 | 언제 |
|---|---|
| `advprotoh-stage-router` | 모든 Stage 작업 — Stage 식별 → Guide 로드 → 그 Stage 만 수행 → STOP |
