# Phase 2 — 규칙 DSL

> 근거: §42-2(조건 평가기·대상 선택기·효과 실행기·관찰 신호 생성기), §11(RuleDefinition), §12(규칙 DSL 요구 능력과 확률 사용 제한).

## 목표

규칙을 TS 코드가 아닌 JSON 으로 작성·실행한다(§12 "사람과 생성 AI가 모두 작성할 수 있어야 한다"). Phase 1 의 코드 규칙 20개를 전부 DSL 로 이관하고 결과 동일성을 증명한다.

## 산출 모듈 (§37 `core/rules/`)

- `RuleTypes.ts` — 정규형 타입 정의 (§11 `RuleDefinition` 전 필드)
- `RuleEngine.ts` — 트리거 색인, 우선순위·쿨다운 관리, 규칙 큐, 연쇄 상한
- `ConditionEvaluator.ts` — `RuleCondition`(§11.2) + `ValueReference` 해석
- `EffectExecutor.ts` — `RuleEffect` 6종(§11.3) + 관계 변경 + 확률·예약 효과(§12)
- `TargetSelector.ts` — `TargetSelector`/`TargetQuery` 해석(태그·범위 검색)
- `ObservationEmitter.ts` — `ObservationEffect` → `ObservationSignal` 생성(§23 연결)
- `RuleSchema.ts` — DSL JSON Schema + 축약형 로더 (Phase 5 생성 출력 검증과 §34 에서 재사용)
- `capabilities.ts` / `abilityChecks.ts` — DoD 를 실행으로 증명하는 검사 묶음 (`npm run verify` 가 그대로 찍는다)
- `migrationBaseline.ts` — 이관 동일성 기준선 비교기

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

변형: `actor` / `target`(트리거 대상) / `entity(id)` / `query`. `query` 는 §12 예시 `entities[tag=plant]` 문법: `{ tags: string[], ownerType?, withinRadius?: {of, r}, limit? }`. 검색 결과는 id 정렬로 결정론화. 반경 검색의 거리는 3D 유클리드(Phase 1 공간 거리 규약). 지역 내 반경 검색은 개체 수가 §40 규모(수백)이므로 선형 스캔으로 충분 — 공간 색인은 도입하지 않는다.

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

- [x] §12 요구 능력 10항목(조건/상태 변경/자원 이동/생성·소멸/관계 변경/신호/예약/확률/주변 검색/태그 선택)이 각각 테스트로 증명된다.
- [x] Phase 1 시나리오가 DSL 규칙만으로 코드 규칙과 동일한 change 로그를 낸다.
- [x] §11.4 "제약에 의한 능력 증폭" 예시 규칙이 그대로 로드·실행된다.
- [x] §16 예시 능력 픽스처의 발동·유지 조건 위반·반동이 행동+규칙 분해 매핑(2.7)으로 실행된다.
- [x] 규칙 연쇄 상한 초과가 감지·보고된다.

검증: `cd proto && npm run verify` — Phase 1 5항 + Phase 2 23항, 합계 28/28 통과.

## 구현에서 확정한 것

### C1. DSL 표현력 보강 — 이관이 드러낸 것 (§12 요구 능력 범위 안)

코드 규칙을 옮기다 보니 §11.3 의 효과 목록만으로는 **같은 결과가 나오지 않는** 규칙이 있었다.
가장 분명한 예가 `rule.village_food_consumption` 이다. "필요량을 계산하고, 비축이 모자라면 있는 만큼만
헐고, 실제로 헌 만큼의 비율로 구성원에게 배급한다" — 여기에는 ① 조직마다 반복 ② 효과 이전에 확정되는
중간값(`taken`) ③ 그 중간값을 쓰는 산술이 전부 필요하다. 확장은 §12 가 이미 요구한 능력을 표현
가능하게 만드는 선에서 멈췄다(새 효과 종류를 늘리지 않았다).

| 추가 | 무엇 | 왜 필요했나 |
|---|---|---|
| `forEach: TargetSelector` | 규칙 본문을 개체마다 한 벌씩 실행, 그 개체가 `target` | 조직·주체 순회 규칙 (`village_food_consumption`, `echo_beast_feeding`, `offspring_threat_change`) |
| `bindings[]` | 규칙 본문에서 한 번만 계산하고 기억하는 값 (지연 계산) | 효과가 상태를 바꾸기 **전에** 확정돼야 하는 중간값 (`taken` → `ration`) |
| `expr` 값 참조 | add·sub·mul·div·neg·min·max·floor·ceil·round·abs | `min(need, reserve)`, `clamp(5,80)`, `(threat-fear)×0.4` |
| `query_value` | 검색 결과를 값으로 (count / first / sum / min / max) | "반경 안 침입자 수", "가장 가까운 잔재원의 잔량" |
| 효과별 `conditions` | 효과 하나에만 걸리는 조건 | if/else 를 규칙 하나로 (`offspring_threat_change`) |
| `valueRef` | §11.3 의 리터럴 `value` 를 계산값으로 확장 | `amount += regrowth` 처럼 대상 자신의 상태를 쓰는 효과 |
| `each` 바인딩 | 지금 이 효과가 건드리는 개체 · 검색 후보 | 대상이 여럿인 효과에서 "그 개체"를 가리킬 방법 |
| `{type:"world"}` 대상 | 전역 상태(ownerType=world) | `food_price` (`rule.trade_price`) |
| `entity_type` 값 참조 | 개체 종류 비교 | `subjugation_call` 의 "조직일 때만" 방어 |

`div` 는 0 으로 나눌 때 NaN 이 아니라 0 을 돌려준다 — 조건이 막지 못한 경우에도 NaN 이 상태로 새지 않게 한다.

### C2. 규칙 큐의 정렬 범위 (§2.2 보정)

§2.2 는 "tick 내 규칙 큐에 (priority desc, ruleId asc) 로 쌓아 순차 실행"이라고 적었다.
구현은 **발화 단위(트리거 하나)로 정렬하고 발화 묶음끼리는 FIFO** 다.

tick 전체를 하나의 우선순위 큐로 만들면 같은 tick 안의 서로 다른 상태 변화가 깨우는 규칙들이
"변화 순서"가 아니라 "우선순위 순서"로 섞인다. 예컨대 하루 경계에서는 `food_reserve` 변화와
`offspring_threat` 변화가 같은 라운드에 들어오는데, 전역 우선순위 큐는 `territory_pressure`(60)를
`subjugation_call`(45)보다 먼저 돌린다 — Phase 1 과 change 로그 **순서**가 달라지고 "동일 로그" DoD 가 깨진다.
발화 단위 정렬로도 실행 순서는 완전히 결정론이다: `(라운드 asc, 변화 순서 asc, priority desc, ruleId asc)`.

연쇄 깊이 상한은 설계대로 16 으로 올렸다(Phase 1 은 8). 수동 세계는 30일 동안 한 번도 8회에 닿지 않아
로그는 그대로다 — 시드 1·42·43 완전 일치가 그 증거다.

### C3. 관찰 신호는 두 갈래로 나간다

- 규칙의 `observations`(§11) 는 **규칙이 발동하면 자동으로** 나간다. 그래서 §11.4 예시 규칙을
  한 글자도 고치지 않고 로드해도 `unstable_high_density_energy` 신호가 실제로 발생한다.
- 행동의 `visibleSignals`(§21) 는 규칙이 `emit_signal` 효과로 꺼내 쓴다 (`movement_trace` 계열).

### C4. `entity_entered` 의 발화 지점

"이동 완료 처리"를 **지역이 실제로 바뀐 순간**으로 못박았다. 행동 완료 시 이동을 적용한 뒤
`position.regionId` 가 달라졌으면, 그 지역 개체의 태그로 발화한다. 같은 지역 안의 이동은 발화하지 않는다.

### C5. 전역 상태 부트스트랩

`ownerType="world"` 스키마의 기본값을 부트스트랩에서 채운다. 그 전에는 어떤 규칙이 처음
`setGlobal` 하기 전까지 "등록됐는데 값이 없는 상태"가 존재했다(§9 위반).

### C6. 이관 완료 후의 동일성 증명 보존

설계대로 `HandwrittenRules.ts` 를 삭제하면 diff 를 다시 돌릴 수 없다. 그래서 삭제 직전의 코드 규칙
실행 결과를 `content/manual-world/migration-baseline.json` 으로 굳혔다(시드 1·42·43 / 30일 —
change 로그 해시·건수, 최종 개체 해시, 규칙별 발동 횟수, 주요 개체의 최종 상태).
`npm run verify` 와 `ruleMigration.test.ts` 는 매번 DSL 을 실제로 돌려 이 기준선과 맞춰 본다.
두 실행이 나란히 살아 있던 커밋(`migrationEquivalence.test.ts`)이 git 이력에 남아 있다.

### C7. Phase 3·6 으로 넘긴 것

- `modify_relationship` 은 실행기와 `relationship_changed` 트리거까지만 만들었다. 값은
  `WorldState.relationships` 에 `{from|to: {key: value}}` 로 쌓인다 — §25 `RelationshipState` 실체화는 Phase 3.
- §12 "확률은 인과관계를 대체하지 않는다" 의 정적 검사(확률 효과가 유일한 진행 경로인 규칙 탐지)는 Phase 6.

## 관측 결과

### 이관 동일성 — 코드 규칙 vs DSL 규칙 30일

| 시드 | 코드 규칙 | DSL 규칙 | 판정 |
|---|---|---|---|
| 1 | 4013건 `af561c8c` | 4013건 `af561c8c` | 완전 일치 |
| 42 | 4040건 `d0fbce9c` | 4040건 `d0fbce9c` | 완전 일치 |
| 43 | 4038건 `bfdcb9cc` | 4038건 `bfdcb9cc` | 완전 일치 |

첫 실행부터 일치했다 — 20개 중 표현력이 모자라 규칙을 다시 쓴 것은 없고, C1 의 확장으로 전부 옮겨졌다.

### §12 요구 능력 10항목 (`npm run verify` 출력 그대로)

```
✓ ① 조건 비교            health<40 만 회복 — a0 20→25, a1 60→60 (회복 대상 1/6)
✓ ② 상태 변경            modify_state add 5 → a0.health 20→25
✓ ③ 자원 이동            30 요청 → 잔량 20 만큼만 이동 (a0 20→0, partner 0→20), 부족분 10 기록
✓ ④ 개체 생성과 소멸      marked=true → 템플릿 개체 1개 생성, destroy_entity 후 0개
✓ ⑤ 관계 변경            trust 0→5, relationship_changed 트리거로 trust_echo=1
✓ ⑥ 신호 발생            signal.lab_ping.0 strength=80 claim=marked=true
✓ ⑦ 예약된 효과          schedule_rule delay=5 → 즉시 0, 10 tick 진행 후 7
✓ ⑧ 확률적 효과          chance=0.5 → 시드7 에서 6/8 적중(재실행 동일), 시드8 은 4/8 로 다름
✓ ⑨ 주변 개체 검색        반경 20 내 plant 개수 — a0(거리10)=1, a2(거리50)=0, 타지역=0
✓ ⑩ 태그 기반 대상 선택   tag=plant 만 적중 — plant.amount 40→39, 주체 상태 불변
✓ 쿨다운 (§11)           cooldown=50 — 같은 시각 2회 호출 후 1, +60 tick 뒤 2
✓ entity_entered (§11.1) 지역 이동 완료로 lab_zone 진입 → entered_mark=1
✓ 규칙 연쇄 상한 (§34)    서로를 깨우는 규칙 2개 → 16회에서 중단, 진단 1건
```

### §16 능력 픽스처 — `ability.contract_truth` 한 사이클

```
✓ §11.4 예시 규칙 로드    기획서 JSON 그대로 — 트리거 action_executed, 조건 1, 효과 2(×1.8)
✓ 발동 조건               contract_accepted=true → 발동 가능, false → 불가
✓ 발동                   mental_stamina 100→88, 출력 50×1.8=90, 실패 위험 +25
✓ 관찰 가능 현상          행동 신호 signal.contract_symbols.0 / 규칙 신호 unstable_high_density_energy.1(76)
✓ knownBy → 초기 믿음     agent.sera 의 자기 능력 믿음 출처 ability.contract_truth
✓ 제약 위반              action.lie → lied_since_activation=true, restriction_valid=false
✓ 유지 조건 위반 → 반동    memory_integrity 100→85, 능력 정지, 출력 0
✓ 재발동은 증폭 없음       거짓말 이후 재발동 → 출력 50 (증폭 시 90)
```

거짓말 한 번이 능력을 끄고 기억을 깎는다 — 규칙만으로 §16 의 "제약이 곧 힘"이 굴러간다.

## 이후 Phase 인터페이스

- `RuleSchema` — Phase 5 규칙 생성기의 출력 계약, Phase 6 스키마 검증 입력.
- `ObservationSignal` 큐 — Phase 3 인식 시스템 입력.
- change 로그 — Phase 4 사건 탐지 입력 (규칙 실행이 tags 를 change 에 전파).
