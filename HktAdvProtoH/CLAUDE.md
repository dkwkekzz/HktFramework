# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 폴더 구조

| 폴더 | 내용 |
|---|---|
| [design/](design/) | **기획 문서** — 세계 개념·개발 공정·Agent 실행 아키텍처 + [architecture-rules/](design/architecture-rules/) + [goals/](design/goals/) |
| [orchestration/](orchestration/) | Agent Execution Layer — [schemas/](orchestration/schemas/) 6종, [runner/](orchestration/runner/) 프로토콜 3종, [routing/](orchestration/routing/) Failure Routing |
| [skills/](skills/) | Minimum Skill Set 14종 (재사용 가능 HOW, stateless) |
| [registry/](registry/) | Semantic / Module / Contract Registry — Cycle 간 공식 기억 |
| [contracts/](contracts/) | Frozen Contract 저장소 (commands / observable / gameview-spec) |
| [modules/](modules/) | FROZEN Capability Module 저장소 (world / gameview) |
| [cycles/](cycles/) | Cycle 실행 로그 — 대화 없이 재개 가능. [C001](cycles/C001/) = Mining Dry Run · [C002](cycles/C002/) = Mining 실구현 (첫 REAL Cycle) |
| [scripts/](scripts/) | [validation/verify.mjs](scripts/validation/verify.mjs) — deterministic 검증 (schema·closure·frozen·registry·cycle) + build/test 스크립트 |
| [source/](source/) | 게임 런타임 소스 — **Web/TypeScript** (C002 확정): world(순수 TS) + gameview(three.js 스프라이트 빌보드 + 3D 지형) |

### 기준 문서 (Source of Truth)

| 문서 | 내용 |
|---|---|
| [Design-Concept.md](design/Design-Concept.md) | 세계와 주체의 행동 구조 — 무엇이 존재하고 어떤 변화가 가능한가 |
| [Design-Workflow.md](design/Design-Workflow.md) | Goal/Possibility 기반 Observable World 구현 Workflow |
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | **개발 공정 기준** — Cycle 단위 점진 개발, World / GameView / Integration 3-Workflow 분리 (Stage 1~17) |
| [Design-AgentExecution.md](design/Design-AgentExecution.md) | **Agent 실행 환경 기준** — Skill / Task / Session / Artifact / Verifier / Registry / Orchestrator |

관계: Design-CycleWorkflow = 게임 의미·공정의 WHAT, Design-AgentExecution = Agent 가 그것을 실행하는 HOW.

## 작업 규칙

개발의 기본 단위는 **Cycle** 이다. 공정은 [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md),
실행은 [Design-AgentExecution.md](design/Design-AgentExecution.md) 를 따른다.

### 공정 (Design-CycleWorkflow)

1. 모든 작업은 사용자가 제시한 하나의 **작고 직접 플레이 가능한 Cycle Goal** 에서 시작한다.
2. 하나의 Cycle 은 `World → GameView → Integration → Verification` 전체(Stage 1~17)를 완주한다.
3. Cycle 결과물은 **World Capability Module · GameView Module · Playable Build** 셋이다.
4. World 가 GameView 로 넘기는 것은 **Observable Contract 와 GameView Specification 뿐**이다 (Rule 7·8).
5. 필요한 Observable 이 없으면 임의로 만들지 말고 **Contract Gap** Proposal 을 올린다.
6. 이전 Cycle 의 Capability 는 재구현하지 않고 Module 로 사용한다 (Rule 10).
7. 모든 Module 은 하나의 공유 World Semantic 위에 얹힌다 — Capability 별 분화 금지 (Rule 11).
8. World State 에는 세계의 사실만 둔다. 의미 있는 변경은 Authoritative Rule 로만, Client 는 Command 만 (Rule 3·4).
9. Observable 은 State/Rule 과 **동시에** 설계한다 — `Before → Input → Rule → After` 관찰 가능.
10. 완료는 World / GameView / Playable Complete 로 분리 판정한다 (§32).
11. Frozen Module 의미 변경은 명시적 Version Migration 으로만 (§34).

### 실행 (Design-AgentExecution)

12. 역할별 절차는 [orchestration/runner/](orchestration/runner/) 프로토콜을 따른다 —
    Orchestrator 는 설계하지 않고, Worker 는 Task Envelope 하나로 시작하며, Verifier 는 Generator 와 분리된다.
13. 상태는 대화가 아니라 파일이다 — Cycle 은 `cycles/<id>/cycle_state.yaml`, Cycle 간 지식은 `registry/`.
    Session 간 전달은 공식 Artifact(YAML)로만 한다.
14. 새 Semantic 정의 전 반드시 `registry/semantics.yaml` 을 조회한다 (lookup-first).
15. Gate 평가 전 deterministic 검사를 먼저 실행한다: `node scripts/validation/verify.mjs all`
    (schema / envelope / closure / frozen / registry / cycle). FAIL 은 재시도가 아니라
    [failure_routes.yaml](orchestration/routing/failure_routes.yaml) 로 책임 Stage Routing.
16. Frozen Contract/Module 은 수정 금지 — registry 의 sha256 으로 강제되며 위반은 `verify.mjs frozen` 이 검출한다.
17. registry 재사용 대상은 `FROZEN` 만이다. C001 DRY_RUN 항목은 C002 (첫 실제 Cycle) 에서
    실검증 후 승격·대체 완료 — Semantic 11종 ACTIVE, Contract 4종·Module 2종 FROZEN.
    C001 이 남긴 결정 3가지(런타임 스택=Web/TypeScript · Asset Catalog=절차 생성 스프라이트 ·
    build/test 스크립트)는 C002 에서 확정되었다. 후속 Cycle 은 mining-world-v1 /
    mining-view-v1 의 Requires/Provides 를 재사용한다 (Rule 10).
