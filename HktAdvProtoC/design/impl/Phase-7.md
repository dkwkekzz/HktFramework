# Phase 7 — 플레이어 개입

> 근거: §42-7(사용자가 하나의 주체를 조작해 월드에 개입), §31(플레이어 구현), §30(개입 기회), §32(성장 시스템), §21(NPC/플레이어 행동 비분리).

## 목표

플레이어가 NPC 와 **동일한 데이터 구조·행동 체계**로 세계에 개입한다(§31, §21). 차이는 단 하나 — 행동 선택을 시스템이 아니라 사용자가 한다.

## 산출 모듈

- `core/agents/PlayerAgent.ts` — `PlayerRuntimeState`(§31: AgentRuntimeState 확장 + controlledByUser, discovered*, journal)
- `core/simulation` 확장 — `execute_player_action` 처리(§38 메시지는 Phase 0 에 이미 정의)
- `app/SimulationPage` 의 플레이어 조작 패널 (본격 화면 구성은 Phase 8, 여기서는 기능 확보)
- `core/agents/GrowthSystem.ts` — `GrowthChange`(§32)

## 상세 설계

### 7.1 플레이어 = 주체 (§31)

- `PlayerRuntimeState extends AgentRuntimeState`. 인식·믿음·기억·관계·상태·비용 지불 전부 NPC 파이프라인 공유. `AgentRuntime.process` 에서 판단 단계만 분기: NPC 는 ActionPlanner, 플레이어는 **행동 요청 대기 상태**로 전환하고 UI 에 상황을 게시.
- 플레이어 유휴 시 시간 진행 정책: 시간은 플레이어와 무관하게 흐른다(§44-5 "플레이어가 없어도"). 행동 미선택 = idle 행동일 뿐, 세계는 계속 진행. 배속·일시정지는 §36.2 시간 조절로 처리.

### 7.2 지식 필터 (§30, §31)

- `discoveredEntityIds` / `discoveredLocationIds`: 인식 파이프라인이 플레이어 믿음을 갱신할 때 함께 갱신. UI 는 이 집합과 BeliefRecord 에 있는 것만 그린다 — **실제 상태를 UI 로 누출하지 않는다**(§36.3 플레이어 모드 규칙의 선행 구현).
- 사건 표시는 Phase 4 의 `getEventViewFor(playerId, eventId)` 를 그대로 사용 → §30 의 "아는 것/모르는 것" 분리가 자동 성립. `InterventionOpportunity.discoveredByPlayer` 는 사건 관련 신호를 플레이어가 1회 이상 관찰했는지로 판정.

### 7.3 행동 제시와 실행 (§31, §21)

- **모든 행동 버튼을 표시하지 않는다**(§31): 표시 목록 = ActionPlanner 의 후보 생성기(§22)를 플레이어에 적용한 결과. actorRequirements·위치·아는 대상(BeliefView) 필터가 NPC 와 동일하게 작동하므로 "현재 위치, 능력, 관계, 지식으로 실행 가능한 행동만" 이 저절로 나온다. 차이: 점수순 정렬만 하고 잘라내지 않는다(선택은 사용자 몫).
- `execute_player_action` 처리: 요청 검증(지금도 가능한가 — 대기 중 세계가 변했을 수 있음) → 실패 시 사유 응답 → 성공 시 비용 지불·행동 예약(NPC 와 동일 경로 §27-7~8). 행동 결과는 규칙이 결정 — 플레이어 특권 코드 경로 금지.
- `journal`(§31): 플레이어의 관찰·행동·사건 발견을 시간순 기록. 상태가 아니라 로그 — 판단에 쓰이지 않고 UI 전용.

### 7.4 성장 (§32)

- `GrowthChange` 전 필드(§32: sourceEventId 필수 — 모든 성장은 출처 사건이 있다).
- 성장 발생 조건 7종(§32 목록)을 **DSL 규칙**으로 작성(위험 행동 성공, 반복 관찰, 실패·반동 경험, 관계·지위 획득, 지식 발견…). 규칙 효과에 `record_growth` 효과 타입을 추가(Phase 2 EffectExecutor 확장) — NPC 에게도 동일 적용(§21 비분리 원칙).
- §32 능력 성장 예시의 "사용자의 선택"(새 제약 채택): 성장 규칙이 발화하면 즉시 적용이 아니라 **선택지를 InterventionOpportunity 형태로 게시**하고, 수락 시 능력 정의(restrictions·출력)를 갱신. 수치 증가와 선택 구조의 병행(§32 마지막 문장). NPC 는 같은 선택지를 ActionPlanner 점수로 자동 결정.

## 구현 스텝

1. PlayerRuntimeState + 판단 분기 + idle 정책.
2. 지식 필터(discovered 집합, UI 게이트) + 사건 뷰 연결.
3. 후보 기반 행동 패널 + `execute_player_action` 왕복(검증·실패 사유 포함).
4. journal 기록.
5. GrowthSystem + 성장 규칙(수동 세계에 4~5개) + 선택형 성장 흐름.
6. 시나리오 검증: §30 의 참여 방식 목록(토벌 참가/현장 조사/추적/연구자 협력/정보 판매/방관)을 실제 조작으로 재현.

## 완료 조건 (DoD)

- [ ] 플레이어가 §30 예시 개입 방식 중 4개 이상을 실제로 수행할 수 있고, "아무것도 하지 않는다" 도 유효하다(세계는 계속 변한다).
- [ ] 같은 사건에 전투·협상·정보·거래 개입이 모두 존재한다(§44-8).
- [ ] 플레이어 UI 에 미발견 개체·미관찰 사실이 노출되지 않는다(자동 테스트: UI 모델 ⊆ 믿음+discovered).
- [ ] 플레이어 행동이 NPC 와 같은 규칙 경로로 처리된다(전용 효과 코드 없음 — 코드 리뷰 체크).
- [ ] 플레이어 개입 후 사건 결과·관계·후속 목적이 변한 기록이 남는다(§44-9·10 에 플레이어 참여 케이스 추가).
- [ ] 성장이 수치 증가 + 선택 구조로 발생하고 GrowthChange 로 기록된다.

## 이후 Phase 인터페이스

- 행동 패널·저널·사건 뷰의 데이터 모델 → Phase 8 화면 구성의 재료.
