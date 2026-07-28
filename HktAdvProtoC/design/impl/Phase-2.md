# Phase 2 — 규칙 DSL

> 근거: §42-2(조건 평가기·대상 선택기·효과 실행기·관찰 신호 생성기), §11(RuleDefinition), §12(규칙 DSL 요구 능력과 확률 사용 제한).

## 목표

규칙을 TS 코드가 아닌 JSON 으로 작성·실행한다(§12 "사람과 생성 AI가 모두 작성할 수 있어야 한다"). Phase 1 의 코드 규칙 20개를 전부 DSL 로 이관하고 결과 동일성을 증명한다.

## 산출 모듈 (§37 `core/rules/`)

- `RuleEngine.ts` — 트리거 색인, 우선순위·쿨다운 관리, 규칙 실행 파이프라인
- `ConditionEvaluator.ts` — `RuleCondition`(§11.2) + `ValueReference` 해석
- `EffectExecutor.ts` — `RuleEffect` 6종(§11.3) + 확률·예약 효과(§12)
- `TargetSelector.ts` — `TargetSelector`/`TargetQuery` 해석(태그·범위 검색)
- `ObservationEmitter.ts` — `ObservationEffect` → `ObservationSignal` 생성(§23 연결)
- `RuleSchema.ts` — DSL JSON Schema(Phase 5 생성 출력 검증과 §34 에서 재사용)

## 상세 설계

### 2.1 데이터 형식 — §11 `RuleDefinition` 그대로

`id / name / scope / priority / triggers / conditions / effects / observations / cooldown / derivedFromAxioms` 전 필드 구현. §12 예시의 `when/if/then` 축약형은 로더에서 정규형(`RuleDefinition`)으로 변환해 받아들인다(생성 AI·수기 작성 편의, 실행기는 정규형 하나만 안다).

### 2.2 트리거 색인 (§11.1 — 5종)

| 트리거 | 색인 구조 | 발화 지점 |
|---|---|---|
| `state_changed` | `Map<stateKey, ruleId[]>` | StateStore.modify 후킹 (Phase 1 의 change 기록 지점) |
| `interval` | 스케줄러 반복 이벤트 | Phase 0 Scheduler |
| `action_executed` | `Map<actionId, ruleId[]>` | 행동 완료 처리 |
| `entity_entered` | `Map<locationTag, ruleId[]>` | 이동 완료 처리 |
| `relationship_changed` | `Map<relationshipKey, ruleId[]>` | RelationshipStore(Phase 3에서 실체화, 훅만 선치) |

발화된 규칙은 즉시 실행하지 않고 tick 내 **규칙 큐**에 `(priority desc, ruleId asc)` 로 쌓아 순차 실행 — 실행 순서 결정론 보장. 규칙 효과가 다시 트리거를 발화하면 같은 큐에 추가하되, tick 당 연쇄 깊이 상한(기본 16, CVar 성격의 설정값)을 두고 초과 시 오류 로그 — §34 "무한 순환" 런타임 방어선.

### 2.3 ValueReference 와 조건 평가 (§11.2)

`ValueReference` 변형: `constant` / `actor_state` / `target_state` / `world_state` / `event_payload` / `path`(§12 예시의 `region.temperature` 형 점 표기). 점 표기는 `owner.stateKey` 로 해석하고 존재하지 않는 경로는 **조건 실패가 아니라 검증 오류**로 처리(§34 "모든 규칙의 대상이 실제로 존재한다").
연산자: `> >= < <= == != contains`(§11.2) 전부.

### 2.4 효과 실행 (§11.3 + §12 요구 능력)

§11.3 의 6종(`modify_state`, `transfer_resource`, `create_entity`, `destroy_entity`, `emit_signal`, `schedule_rule`)에 §12 가 요구하는 나머지 능력을 효과 옵션으로 추가:

- **관계 변경**: `modify_relationship` — Phase 3 의 `RelationshipState` 필드를 대상으로. Phase 2 시점엔 실행기만 준비.
- **확률적 효과**: 모든 효과에 선택 필드 `chance?: number`. 난수는 `RandomContext{worldSeed, simulationStep, entityId: 대상id}` 로만 생성. §12 의 제한("확률은 인과관계를 대체하지 않는다") 은 Phase 6 검증 항목으로 넘긴다(확률 효과가 유일한 진행 경로인 규칙 탐지).
- **예약된 효과**: `schedule_rule { ruleId, delay }` → Phase 0 스케줄러.
- **주변 개체 검색 / 태그 대상 선택**: TargetSelector 로 통합.

`transfer_resource` 는 잔량 부족 시 가능한 만큼만 이동하고 부족분을 change 로그에 남긴다(§14 자원 순환의 폐쇄성 유지).

### 2.5 TargetSelector

변형: `actor` / `target`(트리거 대상) / `entity(id)` / `query`. `query` 는 §12 예시 `entities[tag=plant]` 문법: `{ tags: string[], ownerType?, withinRadius?: {of, r}, limit? }`. 검색 결과는 id 정렬로 결정론화. 지역 내 반경 검색은 개체 수가 §40 규모(수백)이므로 선형 스캔으로 충분 — 공간 색인은 도입하지 않는다.

### 2.6 ObservationEmitter

규칙·행동의 `observations`(§11 `ObservationEffect`) 를 실행 위치 기준의 `ObservationSignal`(§23) 로 변환해 신호 큐에 적재. Phase 1 간이 인식이 즉시 소비하고, Phase 3 에서 본 인식 파이프라인이 대체.

### 2.7 능력 정의의 실행 매핑 (§16)

`AbilityDefinition` 은 전용 실행기를 만들지 않는다 — §21 "능력을 사용한다" 행동과 규칙 체계로 분해 실행한다(콘텐츠는 Phase 5 에서 생성되지만, 실행 경로는 DSL 엔진의 몫이므로 여기서 확정):

| §16 필드 | 실행 주체 |
|---|---|
| `activationConditions` | `action.use_ability` 의 actorRequirements 로 합성 |
| `costs` | 행동 costs 로 합성 |
| `restrictions` + 증폭·반동 | §11.4 형태의 `action_executed` 트리거 규칙(제약 유효 → 출력 배율, 반동 위험) |
| `maintenanceConditions` | 능력 활성 중 interval 감시 규칙 — 위반 시 `failureEffects` 실행 |
| `restrictions` 위반 검사 | 조건식 대상이 행동 이력인 경우(예: §16 "거짓말 금지") 해당 태그 행동의 `action_executed` 트리거로 검사 |
| `observableSignals` | `ObservationEffect` 그대로 |
| `knownBy` | 관찰·소문으로 갱신되는 믿음(§10)의 초기값 |
| `mastery` | §32 성장 체계(Phase 7 `record_growth`)가 갱신 |

Phase 2 DoD 에 능력 1개 픽스처(§16 `ability.contract_truth` 예시)의 발동·유지 위반·반동 실행 테스트를 포함한다.

## Phase 1 규칙 이관

- 코드 규칙 20개를 1:1 로 JSON 파일화(`content/manual-world/rules/*.json`).
- **동일성 증명**: 같은 시드로 (a) 코드 규칙 실행 30일 (b) DSL 규칙 실행 30일 의 change 로그를 diff. 완전 일치가 목표이며, 불일치는 이관 버그 또는 코드 규칙의 암묵 로직(DSL 표현력 부족)을 드러낸다 — 후자는 DSL 능력 추가로 해소(§12 요구 능력 내에서).
- 이관 완료 후 `HandwrittenRules.ts` 삭제. 이후 모든 규칙은 JSON 만 존재한다.

## 구현 스텝

1. `RuleSchema` JSON Schema + 로더(축약형→정규형).
2. ConditionEvaluator + ValueReference (+ 단위 테스트: 연산자 전수, 잘못된 경로 오류).
3. TargetSelector (+ 결정론 테스트).
4. EffectExecutor 6종 + chance/schedule (+ 자원 이동 경계 테스트).
5. RuleEngine 트리거 색인 + 규칙 큐 + 연쇄 상한.
6. ObservationEmitter 연결.
7. 규칙 20개 이관 + 코드/DSL 30일 diff 테스트.

## 완료 조건 (DoD)

- [ ] §12 요구 능력 10항목(조건/상태 변경/자원 이동/생성·소멸/관계 변경/신호/예약/확률/주변 검색/태그 선택)이 각각 테스트로 증명된다.
- [ ] Phase 1 시나리오가 DSL 규칙만으로 코드 규칙과 동일한 change 로그를 낸다.
- [ ] §11.4 "제약에 의한 능력 증폭" 예시 규칙이 그대로 로드·실행된다(능력 콘텐츠는 없어도 규칙 자체는 파싱·발화 테스트).
- [ ] §16 예시 능력 픽스처의 발동·유지 조건 위반·반동이 행동+규칙 분해 매핑(2.7)으로 실행된다.
- [ ] 규칙 연쇄 상한 초과가 감지·보고된다.

## 이후 Phase 인터페이스

- `RuleSchema` — Phase 5 규칙 생성기의 출력 계약, Phase 6 스키마 검증 입력.
- `ObservationSignal` 큐 — Phase 3 인식 시스템 입력.
- change 로그 — Phase 4 사건 탐지 입력 (규칙 실행이 tags 를 change 에 전파).
