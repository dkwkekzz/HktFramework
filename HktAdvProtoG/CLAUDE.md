# CLAUDE.md

HktAdvProtoG — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.
작업 방식은 [AGENTS.md](AGENTS.md) 부트스트랩을 따른다 — 요청 유형을 분류해
작업용 Skill 하나를 적용하고, 공통 불변 규칙을 위반하지 않는다.
다른 프로젝트( HktAdvProtoF 등 )는 참고하지 말 것.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** |
| [AGENTS.md](AGENTS.md) | **부트스트랩** — 요청 유형 → Skill 라우팅 + 공통 불변 규칙 |
| [docs/Design-ModulePlan-CycleWorkflow.md](docs/Design-ModulePlan-CycleWorkflow.md) | **최상위 설계·구현 기준 (헌법)** — 모듈 순서·Cycle 정의·Step 규칙·Gate·완료 판정 |
| [docs/Design-MasterPlan.md](docs/Design-MasterPlan.md) | 세계 설계도 (원문) |
| [docs/Design-ModulePlan.md](docs/Design-ModulePlan.md) | 모듈 분할 계획 (원문) |

## 스킬

| 스킬 | 언제 |
|---|---|
| `advprotog-cycle-planner` | 다음 Cycle 설계 (계획 전용 — 코드를 수정하지 않는다) |
| `advprotog-step-implementer` | Module Step 하나(또는 소규모 묶음) 구현 |
| `advprotog-scenario-verifier` | Scenario·완료 증거 검증 (수정 없이 최초 원인 보고) |
| `advprotog-cycle-integrator` | Cycle 전체 통합·회귀 검증·VERIFIED 판정 |
| `advprotog-workflow-maintainer` | Workflow·Skill 구조 변경 (이 스킬로만 수정) |
