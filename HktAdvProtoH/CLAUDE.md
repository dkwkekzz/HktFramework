# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 문서 구조 — 4분류

| 분류 | 위치 | 내용 |
|---|---|---|
| **작업 상태** | [STATE.md](STATE.md) | 현재 Cycle + Stage 진행 + World Baseline + Evolution Backlog + TODO. **상태는 이 문서에만 기록한다.** |
| **작업 방식** | [WORKFLOW.md](WORKFLOW.md) | Stage 라우팅 + Stage 0~7 수행 규칙 + Gate. **모든 작업 요청의 진입점.** |
| **템플릿** | [templates/](templates/) | Stage 출력 Artifact 형식 8종 |
| **기획 문서** | [design/](design/) | 세계 개념·워크플로 원문·Target Horizon (fallback reference — 필요할 때만 읽는다) |

Cycle 산출물 기록은 [cycles/](cycles/)에 쌓인다 (`cycle-XXX/00~06-*.md` — 자세한 규칙은 WORKFLOW.md).

## 작업 규칙

1. 작업 시작 전 [STATE.md](STATE.md)를 읽고, [WORKFLOW.md](WORKFLOW.md)에서 현재 Stage를 식별한다.
2. **ONE INVOCATION = ONE STAGE** — 한 세션은 한 Stage만 수행하고 STOP. Stage 간 전달은 대화가 아니라 `cycles/`의 Artifact.
3. Human Semantic Review(APPROVED) 없이 Implementation으로 진행하지 않는다.
4. 설계 의미가 부족하면 추측하지 않고 DESIGN GAP을 만들고 중단한다.
5. Stage 종료 시 STATE.md의 진행 표를 갱신한다.
