# CLAUDE.md

HktAdvProtoC — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다. 
그 결과로 만화 **헌터헌터 수준**의 다양하면서 깊이있는 세계관, 특색있고 다양한 캐릭터들이 도출되어야 한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

**검토 결과는 직관적으로 확인 가능하게 보고한다.**
"통과했다"는 주장이 아니라 **한 번의 명령으로 눈으로 확인되는 근거**를 남긴다.
- 각 단계는 `npm run verify` 한 줄로 완료 조건 전부를 ✓/✗ 와 실제 수치로 출력한다. 새 완료 조건이 생기면 이 스크립트에 항목을 더한다.
- 보고에는 그 출력을 그대로 싣는다. 표·타임라인처럼 훑어서 판단되는 형태를 쓰고, 산문 설명으로 대체하지 않는다.
- 실패한 항목은 숨기지 않고 같은 표에 ✗ 로 남긴다.

**STATE.md 의 완료 사항은 한 줄로 줄인다.**
완료된 단계는 "무엇을 했는가" 한 줄 + 상세 문서 링크만 남긴다. 구현 내역·관측 결과는 해당 단계 문서(`design/impl/Phase-N.md`)가 갖는다. STATE.md 는 **지금 어디에 있는가**만 보여준다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **지금 어디에 있는가 + TODO** (완료 사항은 한 줄 — 상세는 design/impl/) |
| [design/Design-MMO.md](design/Design-MMO.md) | 기획서 원본 (§ 번호가 모든 설계의 근거) |
| [design/impl/README.md](design/impl/README.md) | 구현 분해 개요 + Phase 목록 |
| [design/impl/Guide-DataFlow.md](design/impl/Guide-DataFlow.md) | 데이터 흐름 가이드 — 입력→AI 생성→런타임→렌더의 코드 레벨 추적 |
| [design/impl/Phase-N.md](design/impl/) | 단계별 상세 설계 · 완료 조건 · 관측 결과 |
| `proto/` | 실행 코드. 검증은 `npm run verify` / `npm test` / `npm run smoke` |
| [run.bat](run.bat) | **원클릭 실행 (Windows)** — 더블클릭하면 Node 확인 → 의존성 설치 → 개발 서버 → 브라우저까지 한 번에 |
