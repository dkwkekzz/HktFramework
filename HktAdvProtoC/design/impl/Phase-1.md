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

- `shared/state.ts` — §9.1 `WorldState`/`EntityState`. 주체 런타임(`agentRuntimes`)·신호 대기열·변화 로그가 여기 함께 실려 스냅샷 하나로 복원된다.
- `core/world/StateStore.ts` — 상태 쓰기의 단일 경로. 스키마 검증 + patch dirty + `RawWorldChange` + `state_changed` 큐.
- `core/world/StateSchema.ts` — §9 `StateSchema` + 스키마 검증기(등록 안 된 stateKey 쓰기 시 오류 — "임의 문자열로 저장하지 않는다") + 파생 상태 계산식.
- `core/world/Conditions.ts` · `Queries.ts` · `Signals.ts` — 조건 평가, 대상 검색(§21 `TargetQuery`), 관찰 효과 → 신호.
- `core/world/WorldBootstrap.ts` · `WorldValidation.ts` — 초기 배치 실체화, §34 부분집합 검증.
- `core/agents/` — `AgentRuntime`(간이 판단), `PerceptionSystem`(간이), `BeliefStore`.
- `core/actions/ActionSystem.ts` — 행동의 시간 점유·비용 지불·완료 처리·공간 이동.
- `core/rules/HandwrittenRules.ts` — 규칙 20개를 TS 함수로. 단, **각 규칙은 `{ id, triggers, run(ctx) }` 형태로 등록**해 Phase 2 의 `RuleDefinition` 과 같은 트리거 체계를 공유한다(DSL 이관 시 1:1 대응 목적).
- `core/simulation/WorldSystems.ts` — §26 루프의 7개 훅을 실제 시스템으로 채우는 배선.
- `content/manual-world/` — 수동 세계 데이터(TS 상수가 아닌 JSON — Phase 5 생성 출력과 같은 자리에 놓기 위함).
- `scripts/run-30-days.ts` — 30일 headless 실행(`npm run sim`).

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

규칙 20개 분류(코드 작성, §11 의미 준수) — 괄호는 구현된 규칙 id (`core/rules/HandwrittenRules.ts`):
- 신진대사 4: 허기 증가(`rule.hunger_growth`), 허기→체력 감소(`rule.hunger_health_decay`), 식사 효과(`rule.eat_effect`), 휴식 회복(`rule.rest_recovery`) (interval/action 트리거)
- 자원 순환 4: 침묵림 자원 재생(`rule.forest_resource_regrowth` — 식량·잔재 노드를 함께 재생), 마을 식량 소비(`rule.village_food_consumption` — 비축을 헐어 구성원에게 배급), 사냥 산출(`rule.hunt_yield`), 거래 이전(`rule.trade_transfer`) (interval/action 트리거)
- 생태 4: 반향수 섭식(`rule.echo_beast_feeding`), 새끼 위협도 변화(`rule.offspring_threat_change`), 영역 압박(`rule.territory_pressure`), 공격 판정(`rule.attack_resolution`) (state/action 트리거)
- 사회 4: 거래 가격(`rule.trade_price`), 보고→조직 믿음 전파(`rule.report_propagation`), 위협 목격→공포(`rule.threat_sighting_fear`), 토벌 소집 조건(`rule.subjugation_call`) (action/state 트리거)
- 관찰 신호 4: 이동 흔적(`rule.movement_trace`), 공격 소음(`rule.attack_noise`), 사체 발견(`rule.carcass_discovery`), 흔적 잔류(`rule.residue_trace`) — 신호의 실체는 행동의 `visibleSignals`(§21) 또는 규칙의 `observations`(§11)에 데이터로 선언되고, 이 규칙들이 그것을 신호로 내보낸다

### 구현하며 확정한 사항

기획서에 형태만 있고 값이 없던 지점들을 Phase 1 에서 다음과 같이 못박았다. Phase 2·3 은 이 규약 위에서 확장한다.

- **공간 이동은 규칙이 아니라 행동 체계의 내장 효과**다(`ActionDefinition.movement`). 규칙 20개는 "세계가 상태에 가하는 힘"만 담고, 위치 변경 같은 공간 원시 연산은 행동이 직접 수행한다.
- **접근 후보**: 사거리 밖 대상에게는 그 대상으로 가는 이동 후보를 만든다. 이 후보는 도착해서 할 행동의 진척도·비용·위험을 할인해 함께 짊어진다 — "위험한 사냥터에는 애초에 가지 않는다"가 여기서 나온다. 추격 반경(`TargetQuery.approachMaxDistance`)은 짐승이 둥지에서 얼마나 멀리까지 쫓아오는지를 정한다.
- **행동 점수의 단위 정합 계수**(`COST_SCALE`, `RISK_SCALE`)와 **최소 수용 점수**: 기대 이득보다 비용·위험이 크면 그 목적은 지금 실행 불가로 보고 다음 목적으로 넘어간다(§27 `handleNoAvailableAction`). §20 활성도의 `feasibility` 항이 Phase 3 에 들어오면 최소 수용 점수는 사라진다.
- **`targetConditions` 는 실행 시점에 쓰인다**: 이미 이루어진 목적은 활성화되지 않는다. 이것이 없으면 주체는 충족된 목적을 영원히 반복한다.
- **관찰 → 판단의 연결점**: `ObservationEffect.claim.observerStateKey` 는 신호를 관찰한 주체 *자신의* 상태를 갱신한다. 인식 계층은 믿음만 만들고, 그 다음(공포·보고)은 전부 `state_changed` 규칙이 받는다.

## 상세 설계

### 1.1 StateStore 와 변경 기록

- 모든 상태 쓰기는 `store.modify(entityId, key, op, value)` 단일 경로. 여기서 ① 스키마 검증(§9 min/max/dataType) ② dirty set(patch 용) ③ `RawWorldChange` 기록(§28 — Phase 4 소비, Phase 1 부터 쌓는다) 을 동시에 처리한다.
- `StateSchema.updatePolicy`(§9) 3종 처리: `continuous` 는 interval 규칙이 갱신, `event` 는 규칙·행동 효과가 갱신, **`derived` 는 쓰기 금지** — 등록된 파생식(다른 상태들의 함수)으로 읽기 시점 계산하며 modify 시도는 오류다.
- `StateSchema.observable`/`observationChannels`(§9)는 인식 계층과의 계약: 상태 변경이 신호로 노출될 수 있는지와 그 채널을 선언한다. 규칙·행동의 `ObservationEffect` 는 이 선언과 일치해야 하며(불일치는 검증 오류 — §34 `state.schema` 의 일부), 비관찰(observable=false) 상태는 어떤 신호로도 노출되지 않는다 — 믿음 분리(§10)의 데이터 근거.

### 1.2 주체 실행 사이클 (§27 12단계)

`AgentRuntime.process(agent)` 를 §27 순서 그대로: 관찰 → 믿음 갱신 → 목적 활성도(간이) → 목적 선택 → 행동 후보 → 행동 선택 → 비용 지불 → 행동 예약. 행동 완료는 스케줄러 이벤트 `action_completed` 로 돌아와 규칙 실행 → 상태 변화 → 관찰 신호 생성(§27-9~11).

### 1.3 재판단 트리거 (§26)

`shouldReplan` 을 기획서 코드 그대로 구현: 행동 없음 / important_observation / goal_invalidated / survivalPressure>70 / stress>85. 매 tick 전 주체 순회 금지 — 재판단 필요 주체만 `updateUrgentAgents` 훅에서 처리(§26 "매 틱 판단하지 않는다").

### 1.4 행동의 시간 점유

`ActionDefinition.duration`(§21) 만큼 스케줄러에 완료 이벤트를 예약. 이동은 §13 `SpaceConnection.travelCost` 를 duration 으로 사용. 위치는 지역 내 3D 좌표(`Position` §9.1 — x·y 수평, z 고도) + 지역 간은 연결 그래프. **공간 거리 규약**: 거리·반경·감쇠가 필요한 모든 계산(이동 시간 보정, Phase 2 반경 검색, Phase 3 관찰 거리 감쇠)은 3D 유클리드 거리를 사용한다 — 렌더가 2D 투영이어도 시뮬레이션은 z 를 무시하지 않는다.

## 구현 스텝

1. StateSchema 등록기 + StateStore (검증·dirty·change 기록).
2. 수동 세계 JSON 로더 → `WorldState` 부트스트랩 (§4~§18 타입의 수동 인스턴스).
3. 행동 10종 + 실행 규칙(비용, duration, 완료 이벤트).
4. 규칙 20개 등록 + 트리거 디스패치(interval 은 스케줄러 반복 이벤트, state_changed 는 StateStore 후킹).
5. 간이 인식·믿음 (신호 생성 → 거리 판정 → 믿음 덮어쓰기).
6. 간이 목적 선택 + 행동 후보/선택 + `shouldReplan`.
7. 30일 headless 실행 스크립트(§35 최소 테스트의 전신) + 셸 페이지에서 개체 위치·상태 텍스트 표시 — SceneViewModel `entities` 필드 확장으로만(Phase 0 §0.6 경계 준수, 페이지가 WorldState 를 직접 읽지 않는다).

## 완료 조건 (DoD)

`cd proto && npm run verify` 한 줄이 아래 5항을 실제 30일 실행으로 점검해 ✓/✗ 와 수치를 출력한다.
(같은 시드면 언제 돌려도 같은 출력이 나온다. 항목의 코드는 `src/scripts/verify.ts`.)

```
=== Phase 1 완료 조건 점검 — 시드 42, 30일 ===

✓ 5명 전원이 목적에 따라 1회 이상 행동
    kael:247 mar:180 ren:181 rion:206 echo_beast_mother:221
✓ 연쇄가 작성하지 않은 순서로 발생
    마을 식량 감소(1일) → 사냥꾼이 숲으로(23일) → 반향수와 접촉(23일) → 공포 상승(23일) → 마을에 보고(28일) → 토벌 소집(29일)
✓ 실제 상태와 믿음이 분리 저장
    실제 공격성 21 / 마을 믿음 90 / 연구자 믿음 보호중=true / 관찰불가 상태 누출 없음
✓ 동일 시드 재실행 로그 동일 / 다른 시드는 다름
    시드 42 해시 d0fbce9c (4040건) · 시드 43 해시 bfdcb9cc
✓ 미등록 키·파생 상태 쓰기가 거부됨
    미등록 키 거부 / 파생 상태 거부

5/5 통과
```

| DoD | 근거 명령 | 자동 테스트 |
|---|---|---|
| 5명 전원이 목적에 따라 1회 이상 행동(§35) | `npm run verify` 1항 | `manualWorld.test.ts` |
| 연쇄가 작성하지 않은 순서로 발생 | `npm run verify` 2항 · `npm run sim -- --log` | `manualWorld.test.ts` |
| 실제 상태와 믿음의 분리(§10 예시 재현) | `npm run verify` 3항 | `manualWorld.test.ts` · `perception.test.ts` |
| 동일 시드 재실행 로그 동일(§44-12) | `npm run verify` 4항 | `manualWorld.test.ts` · `determinism.test.ts` |
| 모든 상태 쓰기가 스키마 검증을 통과(§9) | `npm run verify` 5항 | `StateStore.test.ts` |

### 시드 42, 30일에서 실제로 일어난 일

```
 0일  지도자가 비축을 채우고, 상인이 마을 사냥터에서 식량을 구해 판다
 0일  숲에 들어간 연구자가 반향수에게 습격당한다 (공포 34→100)
 2일  연구자가 연구회에 보고한다 — 연구회의 위협 믿음 20→90
 2~22일 사냥꾼이 안전한 마을 사냥터에서 식량을 대고, 마을 비축이 오르내린다
23일  마을 사냥터가 고갈되자 사냥꾼이 숲 채집지로 넘어가 습격당한다 (공포 0→100)
28일  사냥꾼이 마을에 보고한다 — 마을의 위협 믿음 25→90
29일  위협 믿음과 식량 부족이 겹쳐 토벌이 소집된다
```

같은 생물을 두고 마을은 "공격적(90)"이라 믿고 연구자는 "새끼를 지키는 중(true)"이라 믿는 동안,
반향수의 실제 공격성은 21 이고 관찰 불가 상태인 새끼 위협도는 누구의 믿음에도 새지 않는다.

## 이후 Phase 인터페이스

- 규칙 20개의 `{id, triggers, conditions(암묵), effects(암묵)}` 목록 → Phase 2 DSL 이관 체크리스트.
  `WorldValidation` 이 `ActionDefinition.executionRules` 와 `action_executed` 트리거의 1:1 대응을 강제하므로, 이관 중 어긋나면 즉시 검증 오류가 난다.
  조건 표현(`ConditionDefinition`/`ValueReference`)과 대상 선택(`TargetQuery`)은 이미 데이터다 — Phase 2 는 `run(ctx)` 본문을 `effects` 데이터로 바꾸는 일만 남는다.
- 간이 판단 함수 시그니처(`calculateGoalActivation`, `generateActionCandidates`, `scoreActionCandidate`, `selectAction`) — Phase 3 이 본 구현으로 교체. `AgentRuntime.test.ts` 가 교체 후에도 지켜야 할 계약을 명시한다.
- `RawWorldChange` 누적 로그 — Phase 4 입력. 행동·규칙·관찰 맥락이 태그로 중첩 기록된다(`["action","action.hunt","rule","rule.hunt_yield"]`).
- `SceneViewModel.entities`(+`tags`, `topGoal`) — Phase 7·8 화면이 이어서 쓴다.
