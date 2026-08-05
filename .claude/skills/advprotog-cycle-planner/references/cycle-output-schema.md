# Cycle 산출물 스키마

`cycles/<cycle-id>/` 산출물 6종의 필수 내용. 형식 원본은
[docs/Design-ModulePlan-CycleWorkflow.md](../../../HktAdvProtoG/docs/Design-ModulePlan-CycleWorkflow.md)
(이하 "원본 문서") — 섹션 번호로 인용한다.

## CYCLE.md — 사람이 읽는 Cycle MMORPG 계약

원본 문서 §12 "Cycle 문서 템플릿" 의 20개 절을 그대로 사용한다.
필수 계약 항목(플레이어 판타지·세계 약속·지역 범위·핵심 Gameplay Loop·플레이어 역할·
경제·성장·멀티플레이·영속성·Situation)은 원본 문서 Phase 3 의 표를 따른다.

* Gameplay Loop 는 `초기 동기 → 정보 획득 → 준비 → 행동 → 위험/충돌 → 보상 → 세계 상태 변화 → 새로운 가능성` 구조로 쓰고, Loop 간 연결을 명시한다 (Phase 4 의 검증 질문 6개에 답해야 한다).
* Situation 은 최소 5개 — 고정 퀘스트 문장이 아니라 `발생 조건 / 참여 주체 / 충돌하는 의존성 / 관찰 가능한 현상 / 가능한 개입 / 개입하지 않은 결과 / 결과로 남는 상태 / 후속 Situation` 구조 (Phase 5).
* 깊이 축은 주 1개 + 보조 최대 2개 + 유지 축 + 비범위 (원본 문서 §7).

## CYCLE.yaml — 기계 판독 계약

원본 문서 Phase 3 의 `CycleSpec` 구조를 YAML 로 작성한다.
`LOOPS.yaml`·`SITUATIONS.yaml` 은 별도 파일로 두지 않고
`coreGameplayLoops`·`situations` 필드로 이 파일에 통합한다.

## STEPS.md — Module Step 목록

`V → O → S → D → P → Q → W → R → E → G → C → X → N → A` 순서.
각 Step 은 원본 문서 §13 "Module Step 템플릿" 의 항목을 갖춘다.

* Step ID / 모드(CREATE·EXTEND·REFINE·HARDEN·REUSE — SKIP 없음)
* 목적 / Cycle 에서의 책임
* `player_visible_contribution` / `mmorpg_loop_contribution` (필수 — 원본 문서 Phase 8)
* 입력·출력(consumes/produces + consumedBy) / 읽고 쓰는 상태 / 이벤트
* 구현할 타입·객체·함수 / 변경·생성 파일
* Scenario / Lab 검증 / 자동 테스트 / 완료 조건 / 예상 위험

## SCENARIOS.md — 검증 분해

각 Situation 을 정상·실패·경계·멀티플레이·저장/복구 Scenario 로 분해한다.
종류별 검증 질문은 원본 문서 Phase 6 의 표(인과·공간·경제·사회·충돌·멀티플레이·영속·회귀)를 따른다.
Scenario 는 Cycle 목표가 아니라 검증 단위다.

## ACCEPTANCE.md — 완료 판정 기준

원본 문서 Phase 12 의 Acceptance Gate 10종
(Identity / Gameplay Loop / World Autonomy / Multiplayer / Progression /
Economy / Persistence / Player Comprehension / Developer Explainability /
Determinism·Regression) 을 이번 Cycle 의 구체 검증 항목으로 번역한 체크리스트.
VERIFIED 상태 기계는 원본 문서 Phase 14 를 따른다.

## TRACE.graph.json — 인과 역추적 그래프

원본 문서 §6.1·Phase 7 의 역추적 결과.
모든 플레이 증거 노드는 하나 이상의 공리·주체·의존성 노드까지 연결되어야 한다.

## evidence/

계획 시점에는 빈 디렉터리. 구현·검증 단계(step-implementer / scenario-verifier /
cycle-integrator)에서 Step 완료 증거·리플레이·상태 해시·플레이테스트 보고가 채워진다.
