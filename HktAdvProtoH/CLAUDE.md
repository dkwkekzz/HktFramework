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
| [design/](design/) | **기획 문서** — 세계 개념·개발 공정 원문 |

현재 트랙에는 기획 문서만 존재한다. 이전 Stage 기반 운영 구조(`state/`·`workflow/`·`templates/`)는 [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) 개편과 함께 제거되었다.

### 기획 문서

| 문서 | 내용 |
|---|---|
| [Design-Concept.md](design/Design-Concept.md) | 세계와 주체의 행동 구조 — 무엇이 존재하고 어떤 변화가 가능한가 |
| [Design-Workflow.md](design/Design-Workflow.md) | Goal/Possibility 기반 Observable World 구현 Workflow |
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | **개발 공정 기준 문서** — Cycle 단위 점진 개발, World / GameView / Integration 3-Workflow 분리, Capability Module 누적 |

## 작업 규칙

개발의 기본 단위는 **Cycle** 이다. 세부 정의는 [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) 를 따른다.

1. 모든 작업은 사용자가 제시한 하나의 **작고 직접 플레이 가능한 Cycle Goal** 에서 시작한다. 기술 작업 목록이 아니라 세계에서 가능한 플레이 경험으로 정의한다.
2. 하나의 Cycle 은 `World Workflow → GameView Workflow → Integration Workflow → Verification` 전체를 한 번 완주한다 (Stage 1~17). 축소하지 않는다.
3. Cycle 의 결과물은 **World Capability Module** · **GameView Module** · **Playable Build** 셋이다. 하나라도 없으면 Cycle 은 완료가 아니다.
4. 세 Workflow 는 서로의 내부 구현을 알지 않는다. World 가 GameView 로 넘기는 것은 **Observable Contract 와 GameView Specification 뿐**이다 (§2·Rule 7·Rule 8).
5. GameView 는 World State/Rule/Server 내부를 직접 참조하지 않는다. 필요한 Observable 이 없으면 임의로 만들지 말고 **GameView Contract Gap** Proposal 을 올린다 (§32).
6. 이전 Cycle 의 Capability 는 다시 구현하지 않는다 — Module 로 사용한다 (§38·Rule 11).
7. Module 마다 별개의 World 를 만들지 않는다. 모든 Module 은 하나의 공유 World Semantic 위에 Capability 를 추가한다 (§39·Rule 12).
8. World State 에는 세계의 사실만 둔다. 구현 내부 상태(cache·index·thread·packet 등)는 World Semantic 이 아니다 (§9.2·§22).
9. 의미 있는 State 변경은 Authoritative World Rule 을 통해서만 발생한다. Client 는 결과가 아니라 **Command** 만 보낸다 (§10·Rule 3·Rule 4).
10. Observable 은 구현 마지막에 붙이는 Debug UI 가 아니라 World State/Rule 과 **동시에** 설계한다. State 뿐 아니라 `Before → Input → Rule → After` Transition 도 관찰 가능해야 한다 (§11·§15).
11. 완료 상태는 **World Complete / GameView Complete / Playable Cycle Complete** 로 분리 판정한다 — Rendering 문제를 World Capability 실패로 취급하지 않는다 (§37).
12. 완료된 Module 의 의미를 바꿔야 하면 조용히 수정하지 않고 명시적 Version Migration 으로 처리한다 (§41).
13. Cycle 완료 판정은 §42 Cycle Completion Gate 체크리스트로 한다.
