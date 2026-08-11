# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

## 폴더 구조 — 4분류

| 폴더 | 분류 | 내용 |
|---|---|---|
| [state/](state/) | **작업 상태** | Agent가 기본으로 읽는 장기 Context 3종 — `TARGET-HORIZON.md`(방향·구조 원칙, 저변경) · `WORLD-BASELINE.md`(검증된 세계 의미) · `CURRENT-CYCLE.md`(현재 Cycle + Stage 진행) — 및 `EVOLUTION-BACKLOG.md`(유예 Semantic) · `cycles/`(Cycle별 Artifact 기록) |
| [workflow/](workflow/) | **작업 방식** | `STAGE-ROUTER.md`(진입점) + Stage 0~7 가이드 — 한 invocation은 자기 Stage 파일만 읽는다 |
| [templates/](templates/) | **템플릿** | Stage 출력 Artifact 형식 8종 |
| [design/](design/) | **기획 문서** | 세계 개념·워크플로 원문 — fallback reference, 필요할 때만 읽는다 |

## 작업 규칙

1. 모든 작업 요청은 [workflow/STAGE-ROUTER.md](workflow/STAGE-ROUTER.md)에서 시작한다 — 현재 Stage를 식별하고 해당 Stage 가이드 + 입력 Artifact만 로드한다. **모든 문서를 다 읽지 않는다.**
2. **ONE INVOCATION = ONE STAGE** — 한 세션은 한 Stage만 수행하고 STOP. Stage 간 전달은 대화가 아니라 `state/cycles/`의 Artifact.
3. Human Semantic Review(APPROVED) 없이 Implementation으로 진행하지 않는다.
4. 설계 의미가 부족하면 추측하지 않고 DESIGN GAP을 만들고 중단한다.
5. Stage 종료 시 [state/CURRENT-CYCLE.md](state/CURRENT-CYCLE.md)의 진행 표를 갱신한다 — 진행 상태 기록처는 여기 하나다.
