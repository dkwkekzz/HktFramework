# CLAUDE.md

HktAdvProtoE — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다. 
그 결과로 만화 **헌터헌터 수준**의 다양하면서 깊이있는 세계관, 특색있고 다양한 캐릭터들이 도출되어야 한다.

## 지켜야 할 사항

작업 진행 상황은 항상 [STATE.md](STATE.md) 에 기록하고, 새 작업을 시작하기 전에 먼저 읽는다.

## 문서 인덱싱

| 문서 | 역할 |
|---|---|
| [STATE.md](STATE.md) | **현재 핵심 상태 + TODO** (핵심만 — 상세는 progress/) |
| [design/Design-MMO.md](design/Design-MMO.md) | 세계 설계도 — 주체-기원 가능성 세계 (무엇을 만드는가) |
| [design/Design-Modules.md](design/Design-Modules.md) | **모듈 분할 총론 + 문서 라우터** (어떻게 나눠 만드는가) |
| [design/modules/](design/modules/) | 페이즈별 모듈 상세 · 공통 계약 · 통합 시나리오 · 작업 프로토콜 |

## 작업 진입 절차

모듈 구현 작업은 [design/modules/40-Agent-Protocol.md](design/modules/40-Agent-Protocol.md) 의
**세션 시작 체크리스트**를 따른다. 요약하면:

1. [STATE.md](STATE.md) 모듈 상태 보드 확인 → 선행 모듈이 `VERIFIED` 인지 검사
2. 해당 페이즈 문서에서 목적·대표 검증·금지 항목 확인
3. [design/modules/01-Global-Invariants.md](design/modules/01-Global-Invariants.md) 에서 강제할 GI 항목 확인
4. 실패하는 검증 시나리오 → 구현 → 단위·속성 → Lab → 통합 → 증거 → `VERIFIED`

`IMPLEMENTED` 는 완료가 아니다. 증거(`evidence/latest.json`) 없는 `VERIFIED` 표시는 금지한다.
