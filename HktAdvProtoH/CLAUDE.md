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
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | **개발 공정 기준 문서** — Cycle 8단계 공정과 World Capability Module 누적 |
| [Design-GameView.md](design/Design-GameView.md) | GameView Architecture |

## 작업 규칙

개발의 기본 단위는 **Cycle** 이다. 세부 정의는 [design/Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) 를 따른다.

하나의 Cycle 은 8단계로 고정한다 (Design-CycleWorkflow §3).

```text
1 Cycle Scope        무엇을 이번 Cycle에서 완성하는가?
2 Intent Design      세계에서 무엇이 가능해야 하는가?
3 World Semantic     그것이 참이려면 세계에 무엇이 존재해야 하는가?
4 Authority          누가 어떤 Input으로 어떤 상태 변화를 확정하는가?
5 Observation        각각의 Observer는 그 세계를 어떻게 볼 수 있는가?
6 Implementation     이 의미를 실제 프로그램으로 어떻게 구현하는가?
7 Playable Composition  Module들을 어떻게 게임으로 조립하는가?
8 Verification & Packaging  설계한 세계가 실제로 그렇게 동작하는가?
```

1. 모든 작업은 사용자가 제시한 하나의 **작고 직접 플레이 가능한 Cycle Goal** 에서 시작한다. 기술 작업 목록이 아니라 세계에서 가능한 플레이 경험으로 정의한다 (§4).
2. 위 8단계를 축소하거나 건너뛰지 않는다. 단계 간 책임을 섞지 않는다 — 각 단계가 무엇을 결정하고 무엇을 결정하지 않는지는 §14 표를 따른다.
3. Cycle 의 결과물은 **World Capability Module** 과 **Playable World** 둘 다이다. 하나라도 없으면 Cycle 은 완료가 아니다 (§12).
4. Goal/Possibility 와 Intent 가 게임 의미의 Source of Truth 다. Intent 의 모든 의미는 World State 또는 World Rule 로 표현되어야 한다 — Semantic Closure (Rule 1·2).
5. World Semantic 의 실제 상태 변화는 Authoritative World Rule 을 통해서만 발생한다. Client 는 World State 를 바꾸지 않고 행동 Command 만 보낸다 (Rule 3·4).
6. Client 와 Designer 는 World 내부를 직접 읽지 않고 Observer 별 Observable World 를 사용한다. Observable 은 Network Packet 이 아니라 World 의 Semantic Projection 이다 (Rule 5·6).
7. Snapshot·Delta·Packet·Serialization 등 Transport 는 Implementation Detail 이며 World State 에 포함하지 않는다. Local/IPC/Network 교체가 Semantic Workflow 를 바꾸면 안 된다 (§9, Rule 7).
8. 이전 Cycle 의 Capability 는 재구현하지 않고 Requires/Provides Contract 로 사용한다. Module 내부 구현에 직접 접근해 연결하지 않는다 (§10, Rule 8).
9. Module 마다 별개의 World State 를 만들지 않는다. 모든 Capability 는 동일한 World Semantic 위에서 상호작용한다 (Rule 9).
10. 검증은 §11 의 6종(Positive · Negative · Traceability · Authority Closure · Observable Closure · Module Independence)을 모두 통과해야 한다. "코드가 동작한다" 는 완료가 아니다 (§16).
