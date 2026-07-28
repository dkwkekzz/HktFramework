# Phase 7 — 플레이어 개입

> 근거: §42-7(사용자가 하나의 주체를 조작해 월드에 개입), §31(플레이어 구현), §30(개입 기회), §32(성장 시스템), §21(NPC/플레이어 행동 비분리).

## 목표

플레이어가 NPC 와 **동일한 데이터 구조·행동 체계**로 세계에 개입한다(§31, §21). 차이는 단 하나 — 행동 선택을 시스템이 아니라 사용자가 한다.

## 산출 모듈

- `shared/player.ts` — `PlayerRuntimeState`·`PlayerJournalEntry`·`GrowthChange`·`PlayerKnowledgeView` (스냅샷과 Worker 경계를 넘는 순수 데이터)
- `core/agents/PlayerAgent.ts` — 부착·지식 필터·행동 후보 게시·요청 검증·저널
- `core/agents/GrowthSystem.ts` — `record_growth` 효과의 접수·사건 귀속·선택 구조·능력 합성(§32)
- `core/agents/phase7Checks.ts` — §30 참여 시나리오 재현과 측정 (verify 와 테스트가 공유)
- `core/simulation/RuntimeServer.ts` 확장 — `execute_player_action` / `attach_player` / `detach_player` / `accept_growth`
- `content/player-world/` — 수동 세계 + 개입 층 (행동 2 · 규칙 8 · 능력 2)
- `viewmodel/SceneViewModel.ts` 의 `player` 패널 + `app/main.ts` 조작 화면 (본격 화면 구성은 Phase 8)

### 왜 별도의 세계 층인가

Phase 6 이 고정한 §35 합격선(다양성·깊이)은 **플레이어가 없는 30일**의 측정치이고(§35 는 무개입 판정이다), Phase 4 가 고정한 실행 기준선도 그 세계의 것이다.
개입용 행동·성장 규칙을 수동 세계에 직접 넣으면 두 기준선이 함께 움직여, "생성된 세계가 수동 세계만큼 다양한가"라는 Phase 6 의 질문 자체가 흔들린다.
그래서 `buildManualWorld(seed)` 는 한 글자도 바꾸지 않고, `buildPlayerWorld(seed)` 가 그 위에 층을 얹는다 — Phase 1~6 의 55개 완료 조건은 이전과 **동일한 해시**로 통과한다.

## 상세 설계

### 7.1 플레이어 = 주체 (§31)

- `PlayerRuntimeState extends AgentRuntimeState`. 인식·믿음·기억·관계·상태·비용 지불 전부 NPC 파이프라인 공유. `AgentRuntime.process` 에서 판단 단계만 분기: NPC 는 ActionPlanner, 플레이어는 **행동 요청 대기 상태**로 전환하고 UI 에 상황을 게시.
- 플레이어 유휴 시 시간 진행 정책: 시간은 플레이어와 무관하게 흐른다(§44-5 "플레이어가 없어도"). 행동 미선택 = idle 행동일 뿐, 세계는 계속 진행. 배속·일시정지는 §36.2 시간 조절로 처리.

### 7.2 지식 필터 (§30, §31)

- `discoveredEntityIds` / `discoveredLocationIds`: 인식 파이프라인이 플레이어 믿음을 갱신할 때 함께 갱신. UI 는 이 집합과 BeliefRecord 에 있는 것만 그린다 — **실제 상태를 UI 로 누출하지 않는다**(§36.3 플레이어 모드 규칙의 선행 구현).
- 사건 표시는 Phase 4 의 `getEventViewFor(playerId, eventId)` 를 그대로 사용 → §30 의 "아는 것/모르는 것" 분리가 자동 성립. `InterventionOpportunity.discoveredByPlayer` 는 사건 관련 신호를 플레이어가 1회 이상 관찰했는지로 판정.

### 7.3 행동 제시와 실행 (§31, §21)

- **모든 행동 버튼을 표시하지 않는다**(§31): 표시 목록 = ActionPlanner 의 후보 생성기(§22)를 플레이어에 적용한 결과. actorRequirements·위치·아는 대상(BeliefView) 필터가 NPC 와 동일하게 작동하므로 "현재 위치, 능력, 관계, 지식으로 실행 가능한 행동만" 이 저절로 나온다. 차이: 점수순 정렬만 하고 잘라내지 않는다(선택은 사용자 몫).
- 행동 후보·저널·사건 뷰는 ViewModel 빌더가 `SceneViewModel` 의 패널 필드(`actionPanel`, `journal`, `eventPanel`)로 변환해 게시한다 — UI 는 코어 타입(`ActionCandidate` 등)을 직접 소비하지 않는다(Phase 0 §0.6). 플레이어 지식 필터(7.2)도 빌더 단계에서 적용되므로, UI 코드에는 "숨길지 말지"의 판단 자체가 존재하지 않는다.
- `execute_player_action` 처리: 요청 검증(지금도 가능한가 — 대기 중 세계가 변했을 수 있음) → 실패 시 사유 응답 → 성공 시 비용 지불·행동 예약(NPC 와 동일 경로 §27-7~8). 행동 결과는 규칙이 결정 — 플레이어 특권 코드 경로 금지.
- `journal`(§31): 플레이어의 관찰·행동·사건 발견을 시간순 기록. 상태가 아니라 로그 — 판단에 쓰이지 않고 UI 전용.

### 7.4 성장 (§32)

- `GrowthChange` 전 필드(§32: sourceEventId 필수 — 모든 성장은 출처 사건이 있다).
- 성장 발생 조건 7종(§32 목록)을 **DSL 규칙**으로 작성(위험 행동 성공, 반복 관찰, 실패·반동 경험, 관계·지위 획득, 지식 발견…). 규칙 효과에 `record_growth` 효과 타입을 추가(Phase 2 EffectExecutor 확장) — NPC 에게도 동일 적용(§21 비분리 원칙).
- §32 능력 성장 예시의 "사용자의 선택"(새 제약 채택): 성장 규칙이 발화하면 즉시 적용이 아니라 **선택지를 InterventionOpportunity 형태로 게시**하고, 수락 시 능력 정의(restrictions·출력)를 갱신. 수치 증가와 선택 구조의 병행(§32 마지막 문장). NPC 는 같은 선택지를 ActionPlanner 점수로 자동 결정.

### 7.5 설계에서 옮겨진 것 (구현 중 확정)

| 설계 | 구현에서 달라진 것 | 이유 |
|---|---|---|
| `discoveredEntityIds: Set<string>` (§31) | 정렬된 배열 | Set 은 JSON 스냅샷에서 사라지고 순회 순서가 결정론을 흔든다(§39) |
| 지식 필터를 **빌더**에서 적용 (7.3) | **코어**에서 적용 — `PlayerKnowledgeView` 만 경계를 넘는다 | 빌더에서 거르면 실제 상태가 이미 경계를 넘은 뒤다. 거를 것을 아예 보내지 않는 쪽이 §36.3 을 더 강하게 지킨다 |
| 표시 목록 = 활성 목적의 후보 (7.3) | 활성 목적의 후보 **+ 모든 행동 태그를 허용하는 합성 목적**(`goal.player_intent`) | 목적에 매인 후보만 주면 사용자가 자기 목적 밖의 일을 할 수 없다. §31 이 요구한 필터는 "위치·능력·관계·지식"이지 "지금의 목적"이 아니다 |
| 성장은 규칙 발화 즉시 적용 (7.4) | **출처 사건이 탐지된 뒤** 적용 (대기열 + 하루 기한) | §32 는 sourceEventId 를 필수로 둔다. 사건 탐지는 §26 순서의 뒤쪽이므로, 성장은 자기를 낳은 사건을 기다렸다가 확정된다. 하루 안에 사건이 되지 못한 변화는 성장이 아니다 |
| 수락 시 **능력 정의를 갱신** (7.4) | 정의는 불변으로 두고 성장 원장 위에서 합성(`effectiveAbility`) | 정의는 §39 저장의 세 축 중 하나다. 정의를 고쳐 쓰면 같은 정의·같은 시드로 다시 실행해도 같은 세계에 도달하지 못한다 |
| `§38` 메시지 4종 | `attach_player` / `detach_player` / `accept_growth` 추가 | §38 은 "메시지 예시"다. 조작 시작·성장 응답은 `execute_player_action` 하나로 표현하면 행동 id 에 의미를 실어야 해서 더 나빠진다 |

## 구현 스텝

1. PlayerRuntimeState + 판단 분기 + idle 정책.
2. 지식 필터(discovered 집합, UI 게이트) + 사건 뷰 연결.
3. 후보 기반 행동 패널 + `execute_player_action` 왕복(검증·실패 사유 포함).
4. journal 기록.
5. GrowthSystem + 성장 규칙(개입 층에 6개 — 수치 5 + 선택 1) + 선택형 성장 흐름.
6. 시나리오 검증: §30 의 참여 방식 목록(토벌 참가/현장 조사/추적/연구자 협력/정보 판매/방관)을 실제 조작으로 재현.

## 완료 조건 (DoD)

전부 `cd proto && npm run verify` 의 Phase 7 절에서 ✓ 와 실제 수치로 출력된다 (시드 42, 30일).

- [x] 플레이어가 §30 예시 개입 방식 중 4개 이상을 실제로 수행할 수 있고, "아무것도 하지 않는다" 도 유효하다(세계는 계속 변한다).
- [x] 같은 사건에 전투·협상·정보·거래 개입이 모두 존재한다(§44-8).
- [x] 플레이어 UI 에 미발견 개체·미관찰 사실이 노출되지 않는다(자동 테스트 — UI 를 띄우지 않고 판정).
- [x] 플레이어 행동이 NPC 와 같은 규칙 경로로 처리된다(전용 효과 코드 없음).
- [x] 플레이어 개입 후 사건 결과·관계·후속 목적이 변한 기록이 남는다(§44-9·10).
- [x] 성장이 수치 증가 + 선택 구조로 발생하고 GrowthChange 로 기록된다.
- [x] (추가) 개입이 있어도 같은 시드·같은 조작이면 같은 세계다(§44-12).

## 관측 결과 (시드 42, 30일)

> 아래 수치는 전부 `npm run verify` 의 Phase 7 절 출력 그대로다.

### §30 참여 방식 — 사냥꾼 kael 을 조작한 30일

| 일 | 참여 방식 | 실행 | 비고 |
|---|---|---|---|
| 1 | 습격 현장을 조사한다 | `action.move`(반향수) | 사거리 밖이라 먼저 다가감 |
| 2 | 토벌대에 참가한다 | `action.attack`(반향수) | |
| 3 | 습격 현장을 조사한다 | `action.observe`(반향수) | |
| 4 | 생물을 추적한다 | `action.track`(반향수) | |
| 6 | 연구자를 돕는다 | `action.move`(rion) | |
| 8 | 상인에게 정보를 판매한다 | `action.sell_info`(ren) | 사흘의 관찰이 팔 물건이 되었다 |
| 12·15·16·21 | 연구자를 돕는다 | `action.move`(rion) | 연구자가 숲을 돌아다녀 다섯 번 쫓아가야 했다 |
| 23 | 연구자를 돕는다 | `action.assist`(rion) | |

- 수행한 §30 참여 방식 **5종**, 행동 13회, change 9,665건, 사건 24건.
- **방관 실행**(같은 시드, 한 번도 개입하지 않음): 플레이어 행동 0회인데도 change 9,000건 · 사건 33건 · NPC 성장 122건. 세계는 플레이어를 기다리지 않는다(§44-5).
- 두 실행의 로그 해시 `a09756e8` ≠ `8d8cb480` — 개입은 세계를 갈랐다.
- 개입 세계도 재현된다: 같은 시드·같은 조작 → 같은 해시, 다른 시드(43)는 `806c342f`(§44-12).

### §44-8 — 하나의 사건, 네 갈래 개입

`event.0`(`ecological_conflict`) 에 대해 플레이어에게 열린 개입 후보 14종이 **전투·협상·정보·거래** 네 갈래를 모두 덮는다.
개입 방식 목록은 저작된 것이 아니라 행동 체계에서 역산된 것이므로(§30), 층에 행동을 더하면 개입 방식도 저절로 늘어난다 — `action.assist`·`action.sell_info` 를 더하자 협상·거래 갈래가 그냥 생겼다.

### 지식 필터 (§36.3 플레이어 모드)

- 30일 동안 화면에 실린 사실 **395건**을 매일 감사 — 위반 0건.
- 세계에 있는 **관찰 불가 상태 152종 중 화면 노출 0종**. 막을 것이 있었고, 전부 막혔다.
- 마지막 화면의 사실 출처: 자기 감각 28 · 믿음 8 (그 시각 kael 의 감각 범위에는 아무도 없었다).
- 화면은 세계가 아니라 **믿음**을 보여준다 — 실제와 표시가 갈린 4건 중 셋:

| 대상 | 상태 | 실제 | 화면 | 확신 |
|---|---|---|---|---|
| `agent.ren` | `carried_food` | 200 | 16 | 0.29 |
| `agent.ren` | `promise_broken` | false | **true** | 0.38 |
| `agent.mar` | `carried_food` | 6 | 16 | 0.29 |

### §21 비분리 — 플레이어 특권 없음

규칙·효과·행동·판단 11개 모듈(`RuleEngine`·`EffectExecutor`·`ConditionEvaluator`·`TargetSelector`·`ObservationEmitter`·`ActionSystem`·`ActionPlanner`·`GoalSystem`·`PerceptionSystem`·`RelationshipSystem`·`MemorySystem`)에 플레이어 분기 **0건**.
§31 이 허용한 유일한 분기는 `AgentRuntime.shouldReplan` 의 한 줄이다 — 그 한 줄이 "행동 선택을 시스템이 아니라 사용자가 한다"의 전부다.

실행 로그로도 확인된다 — 같은 행동에서 플레이어가 탄 규칙이 NPC 가 탄 규칙의 부분집합이다.

| 행동 | 플레이어가 탄 규칙 | NPC |
|---|---|---|
| `action.attack` | attack_resolution, fear_of_the_feared, threat_breeds_fear | 동일 |
| `action.sell_info` | sell_info_deal | 동일 |
| `action.eat` / `action.move` / `action.rest` | eat_effect / movement_trace / rest_recovery | 동일 |

### §44-9·10 — 개입이 남긴 것

`event.3`(`subjugation_muster`, 순변화 60개)에 플레이어가 참여자로 들어갔다.
마을이 mar·ren 에 대한 신뢰를 100→-100, 42→-100 으로 꺾었고 연구회의 비축 식량은 116→2 로 말랐다.
그 사건에서 새로 활성화된 목적 6건 — `agent.ren:goal.subjugate_beast`, `agent.rion:goal.report_findings`, `faction.silent_village:goal.faction_food_security` …

§29 의 여섯 번째 항(`playerRelevance`)도 이번에 실체가 되었다: 조작 세계에서는 24/24건에 가산되고, **조작 주체가 없는 수동 세계에서는 0/37건**이다 — Phase 4 의 중요도 기준선이 움직이지 않는 이유가 이 0 이다.

### §32 성장 — 플레이어 6건 · NPC 126건 (같은 규칙)

| 일 | 종류 | 변화 | 규칙 | 출처 사건 |
|---|---|---|---|---|
| 1 | identity | `patience` 50 → 52 | growth_failure_backlash | event.0 |
| 2 | ability | `ability.echo_stillness.restriction` → "하루에 세 개의 대상에만 이름을 붙일 수 있다" | growth_ability_choice | event.0 |
| 2 | ability | `ability.echo_stillness.outputRange.max` 40 → **80** | growth_ability_choice | event.0 |
| 3 | knowledge | `curiosity` 35 → 37 | growth_repeated_observation | event.1 |
| 4 | knowledge | `uncertaintyAversion` 55 → 52 | growth_tracking_knowledge | event.0 |
| 22 | identity | `patience` 52 → 54 | growth_failure_backlash | event.10 |

- 출처 사건 없는 성장 **0건** (§32 sourceEventId 필수).
- 선택 구조: 새 제약을 받아들여 능력 제약 2→3종, 출력 상한 40→80 — §11.4 의 "제약이 무거울수록 출력이 크다"가 성장에도 그대로 적용된다.
- 수치 성장은 §18 판단 변수를 움직인다. `uncertaintyAversion` 이 내려가면 인식 단계에서 기존 믿음을 고수하는 무게가 줄고, `patience` 가 오르면 목적 쿨다운과 기억 대조의 무게가 바뀐다 — 같은 상황에서 다른 선택이 나온다. 그것이 §32 가 말하는 "행동 가능성의 확장"이다.
- NPC 126건은 같은 규칙에서 나왔다. 성장은 플레이어의 특권이 아니다(§21).

### 저널 (§31)

240줄(상한) — 발견 2 · 관찰 195 · 사건 24 · 행동 13 · 성장 6. 시간순이며 판단에 쓰이지 않는다.

## 이후 Phase 인터페이스

- `SceneViewModel.player` 의 패널 필드(`actionPanel`/`journal`/`eventPanel`/`growthOffers`) → Phase 8 화면 구성의 재료. Phase 8 은 이 필드들의 렌더러만 추가하며 빌더·코어를 변경하지 않는다.
- `PlayerKnowledgeView` 가 §36.3 **플레이어 모드**의 데이터 계약이다. 개발자 모드는 지금처럼 `player_view` 없이 patch 만 소비하면 된다 — 두 모드의 차이가 코드 분기가 아니라 **데이터 경로**로 이미 갈려 있다.
