# Cycle 통합 Gate 기준

원본: [docs/Design-ModulePlan-CycleWorkflow.md](../../../HktAdvProtoG/docs/Design-ModulePlan-CycleWorkflow.md)
Phase 12·13·14. 충돌 시 원본 문서가 우선한다.

## Acceptance Gate 10종 (Phase 12)

| Gate | 판정 질문 |
|---|---|
| 12.1 MMORPG Identity | 탐험 지역·복수 역할·반복 Loop·자율 주체·경제·성장·협력/경쟁·저장 — 하나라도 완전히 없으면 시스템 프로토타입 |
| 12.2 Gameplay Loop | 진입 신호·선택·비용/위험·세계 변화·다음 루프 변화·반복 시 변주 |
| 12.3 World Autonomy | 플레이어 없이 주체가 목적을 선택하고 Situation 이 발생·악화·해소 |
| 12.4 Multiplayer | 공유 상태·권위 충돌 확정·협력/경쟁/거래 중 둘 이상·상호 영향 |
| 12.5 Progression | 플레이 전후 가능 행동 변화, 무제한 해금 아님 |
| 12.6 Economy | 생산·소비가 재고를 바꾸고 교환 가치에 영향, 플레이어·NPC 동일 자원 상태 |
| 12.7 Persistence | 저장·재접속 유지, 사건 로그·스냅샷 복구, 저장 변화가 다음 행동에 사용 |
| 12.8 Player Comprehension | 개발자 콘솔 없이 세계 현상으로 상황 이해 (퀘스트 목록만은 불허) |
| 12.9 Developer Explainability | Lab 에서 공리→사건→변화 전체 인과 추적 |
| 12.10 Determinism·Regression | 동일 시드 동일 해시, 현재+이전 전체 Cycle Scenario·리플레이 통과 |

## VERIFIED 조건 요약

* 실제로 플레이할 수 있다.
* MMORPG 의 반복 활동이 존재한다.
* 여러 해결 방식이 존재한다.
* 플레이어가 없어도 세계가 진행된다.
* 여러 플레이어가 세계 상태를 공유한다.
* 성장으로 새로운 가능성이 열린다.
* 결과가 영속 상태로 남는다.
* 모든 핵심 결과의 인과를 추적할 수 있다.
* 동일 시드와 동일 명령으로 재생할 수 있다.
* 이전 VERIFIED Cycle 의 대표 리플레이가 깨지지 않는다.

## 플레이 테스트 확인 항목 (Phase 13)

스스로 활동 발견 / 역할 간 차이 / 전투 외 행동의 의미 / 타 플레이어 = 기회+위험 /
세계 변화의 행동 유도 / 반복 변주 / NPC 행동의 이해 가능성 / 성장의 실효.

## 동결 산출물 (Phase 14)

CYCLE.yaml·TRACE.graph.json·Step 목록·Scenario 입력과 리플레이·대표 월드 스냅샷·
상태 해시·자동 테스트 결과·플레이 테스트 보고서·완료 증거·알려진 한계·다음 Cycle 후보.
상태 기계(PLANNED → … → VERIFIED)는 Phase 14 를 따른다.
