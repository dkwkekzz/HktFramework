# Phase 1 — 수동 정의된 작은 세계

> 근거: §42-1. 콘텐츠 규모와 목록은 §42-1 명시값 그대로: 상태 스키마, 규칙 20개(코드), 행동 10개, 종족 2개, 조직 2개, 개인 5명, 목적 그래프, 관찰과 믿음. 세계 소재는 §41(첫 번째 세계)의 부분집합. 런타임 구조는 §9, §26, §27.

## 목표

"생성 AI 없이, 세계 시뮬레이션이 실제로 작동하는지 검증"(§42-1). 플레이어 없이 시간이 흐르면 5명의 개인과 2개 조직·2개 종족이 목적에 따라 이동·행동하고 상태가 변한다(§44-5).

## 범위에 대한 명확화

기획서상 목적 그래프·관찰·믿음은 Phase 1 에 포함되지만, **전체 판단 모델(§20 활성도 계산식, §22 softmax, §24 기억, §25 관계)은 §42-3(주체 판단 시스템)의 몫**이다. Phase 1 은 같은 데이터 구조를 쓰되 판단 로직만 간이형으로 둔다:

- 목적 그래프: `GoalGraph`/`GoalNode`/`GoalEdge`(§19) 구조 그대로 사용. 활성도는 `baseImportance + 긴급도` 두 항만.
- 행동 선택: 후보 중 최고 점수 1개 선택(개인 성향 랜덤성은 Phase 3).
- 믿음: `BeliefRecord`(§10) 구조 그대로. 갱신은 "관찰 성공 → believedValue 를 신호 payload 로 덮어씀, confidence 고정" 간이형.
- 관찰: `ObservationSignal`(§23) 구조 그대로. `canObserve` 는 거리 + 채널 일치만.

이렇게 하면 Phase 3 은 **데이터 마이그레이션 없이 판단 함수만 교체**한다.

## 산출 모듈

- `core/world/WorldState.ts` — §9.1 `WorldState`/`EntityState`, 상태 접근은 `StateStore`(dirty 추적 포함) 경유.
- `core/world/StateSchema.ts` — §9 `StateSchema` + 스키마 검증기(등록 안 된 stateKey 쓰기 시 오류 — "임의 문자열로 저장하지 않는다").
- `core/agents/` — `AgentRuntime`(간이 판단), `PerceptionSystem`(간이), `BeliefStore`.
- `core/rules/HandwrittenRules.ts` — 규칙 20개를 TS 함수로. 단, **각 규칙은 `{ id, triggers, run(ctx) }` 형태로 등록**해 Phase 2 의 `RuleDefinition` 과 같은 트리거 체계를 공유한다(DSL 이관 시 1:1 대응 목적).
- `content/manual-world/` — 수동 세계 데이터(TS 상수가 아닌 JSON — Phase 5 생성 출력과 같은 자리에 놓기 위함).

## 수동 세계 콘텐츠 명세 (§41 부분집합)

| 항목 | 수량(§42-1) | 내용 |
|---|---|---|
| 지역 | 2 | 침묵림(위험·자원 풍부), 마을(안전·식량 소비) — §13 구조(`RegionDefinition`, `SpaceConnection`) |
| 종족 | 2 | 인간, 반향수(§15 `species.echo_beast` 예시 그대로) |
| 조직 | 2 | 마을(식량 유지 목적), 연구회(생물 관찰 목적) — §17 구조 |
| 개인 | 5 | 사냥꾼, 상인, 마을 지도자, 연구자, 반향수 어미 — §41 초기 상태("식량 비축 감소", "교역로 근처 흔적", "새끼 보호") 반영 |
| 자원 | 3~4 | 식량, 능력 잔재(ability_residue), 교역품 — §14 구조(생산·소비 규칙 연결 필수) |
| 행동 | 10 | 이동/관찰/사냥(수집)/식사/거래/보고/추적/공격/도주/휴식 — §21 `ActionDefinition` 구조, 전부 비용 또는 위험 보유(§34) |
| 규칙 | 20 | 아래 분류 |

규칙 20개 분류(코드 작성, §11 의미 준수):
- 신진대사 4: 허기 증가, 허기→체력 감소, 식사 효과, 휴식 회복 (interval 트리거)
- 자원 순환 4: 침묵림 식량 재생, 마을 식량 소비, 사냥 산출, 거래 이전 (interval/action 트리거)
- 생태 4: 반향수 섭식(ability_residue), 새끼 위협도 변화, 영역 압박, 공격 판정 (state/action 트리거)
- 사회 4: 거래 가격, 보고→조직 믿음 전파, 위협 목격→공포, 토벌 소집 조건 (action/state 트리거)
- 관찰 신호 4: 이동 흔적, 공격 소음, 사체 발견, 흔적 잔류 (행동·규칙 효과에 부착된 `ObservationEffect`)

## 상세 설계

### 1.1 StateStore 와 변경 기록

- 모든 상태 쓰기는 `store.modify(entityId, key, op, value)` 단일 경로. 여기서 ① 스키마 검증(§9 min/max/dataType) ② dirty set(patch 용) ③ `RawWorldChange` 기록(§28 — Phase 4 소비, Phase 1 부터 쌓는다) 을 동시에 처리한다.

### 1.2 주체 실행 사이클 (§27 12단계)

`AgentRuntime.process(agent)` 를 §27 순서 그대로: 관찰 → 믿음 갱신 → 목적 활성도(간이) → 목적 선택 → 행동 후보 → 행동 선택 → 비용 지불 → 행동 예약. 행동 완료는 스케줄러 이벤트 `action_completed` 로 돌아와 규칙 실행 → 상태 변화 → 관찰 신호 생성(§27-9~11).

### 1.3 재판단 트리거 (§26)

`shouldReplan` 을 기획서 코드 그대로 구현: 행동 없음 / important_observation / goal_invalidated / survivalPressure>70 / stress>85. 매 tick 전 주체 순회 금지 — 재판단 필요 주체만 `updateUrgentAgents` 훅에서 처리(§26 "매 틱 판단하지 않는다").

### 1.4 행동의 시간 점유

`ActionDefinition.duration`(§21) 만큼 스케줄러에 완료 이벤트를 예약. 이동은 §13 `SpaceConnection.travelCost` 를 duration 으로 사용. 위치는 지역 내 2D 좌표(`Position` §9.1) + 지역 간은 연결 그래프.

## 구현 스텝

1. StateSchema 등록기 + StateStore (검증·dirty·change 기록).
2. 수동 세계 JSON 로더 → `WorldState` 부트스트랩 (§4~§18 타입의 수동 인스턴스).
3. 행동 10종 + 실행 규칙(비용, duration, 완료 이벤트).
4. 규칙 20개 등록 + 트리거 디스패치(interval 은 스케줄러 반복 이벤트, state_changed 는 StateStore 후킹).
5. 간이 인식·믿음 (신호 생성 → 거리 판정 → 믿음 덮어쓰기).
6. 간이 목적 선택 + 행동 후보/선택 + `shouldReplan`.
7. 30일 headless 실행 스크립트(§35 최소 테스트의 전신) + 셸 페이지에서 개체 위치·상태 텍스트 표시 — SceneViewModel `entities` 필드 확장으로만(Phase 0 §0.6 경계 준수, 페이지가 WorldState 를 직접 읽지 않는다).

## 완료 조건 (DoD)

- [ ] 플레이어 없이 30일 실행 시 5명 전원이 목적에 따라 1회 이상 행동한다(§35).
- [ ] 마을 식량 감소 → 사냥/거래 발생 → 반향수 접촉 → 공포·보고 전파, 의 연쇄가 **작성하지 않은 순서로** 발생한다(로그로 확인).
- [ ] 반향수 어미의 실제 상태(새끼 보호)와 마을 사람의 믿음(공격적)이 분리 저장된다(§10 예시 재현).
- [ ] 동일 시드 재실행 시 30일 로그가 동일하다.
- [ ] 모든 상태 쓰기가 스키마 검증을 통과한다(미등록 키 쓰기 테스트는 실패해야 함).

## 이후 Phase 인터페이스

- 규칙 20개의 `{id, triggers, conditions(암묵), effects(암묵)}` 목록 → Phase 2 DSL 이관 체크리스트.
- 간이 판단 함수 시그니처(`selectActiveGoal`, `generateActionCandidates`, `selectAction`) — Phase 3 이 본 구현으로 교체.
- `RawWorldChange` 누적 로그 — Phase 4 입력.
