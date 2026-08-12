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
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | **개발 공정 기준 문서** — Cycle 단위 점진 개발과 World Capability Module 누적 |
| [Design-GameView.md](design/Design-GameView.md) | GameView Architecture |

## 작업 규칙

개발의 기본 단위는 **Cycle** 이다. 세부 정의는 [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) 를 따른다.

1. 모든 작업은 사용자가 제시한 하나의 **작고 직접 플레이 가능한 Cycle Goal** 에서 시작한다. 기술 작업 목록이 아니라 세계에서 가능한 플레이 경험으로 정의한다.
2. 하나의 Cycle 은 `Goal/Possibility → Intent → World State/Rule → Observable → Implementation → Playable Assembly → Verification` 전체를 한 번 완주한다. 축소하지 않는다.
3. Cycle 의 결과물은 **재사용 가능한 World Capability Module** 과 **플레이 가능한 검증 세계** 둘 다이다. 하나라도 없으면 Cycle 은 완료가 아니다.
4. 이전 Cycle 의 Capability 는 다시 구현하지 않는다 — Module 로 사용한다 (Design-CycleWorkflow §8).
5. Module 마다 별개의 World 를 만들지 않는다. 모든 Module 은 하나의 공유 World Semantic 위에 Capability 를 추가한다 (§11).
6. World State 에는 세계의 사실만 둔다. 구현 내부 상태(cache·index·thread 등)는 World Semantic 이 아니다 (§12).
7. Observable 은 구현 마지막에 붙이는 Debug UI 가 아니라 World State/Rule 과 **동시에** 설계한다 (§18).
8. 성공 Scenario 만으로 검증하지 않는다. 실패 조건도 플레이 가능한 형태로, 원인이 보이도록 검증한다 (§23).
9. 완료된 Module 의 의미를 바꿔야 하면 조용히 수정하지 않고 명시적 Version 변경으로 처리한다 (§26·§27).
10. Cycle 완료 판정은 §25 Cycle Completion Gate 체크리스트로 한다.
