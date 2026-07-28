# 가이드 — 데이터 흐름: 세계관 입력부터 렌더까지

> 이 시스템이 굴러가는 과정을 **코드 레벨**로 따라가는 가이드다. 세계관을 입력하면 AI 가 정확히 어떤 데이터를 만들고, 그 데이터가 어디에 소비되어, 최종적으로 어떤 데이터로 렌더되는지를 실제 타입·모듈 경로로 추적한다. 예시는 첫 세계(§41)의 "반향수" 한 마리로 끝까지 간다.
>
> 표기: `구현됨` = `proto/src/` 에 실재하는 코드(Phase 0~4 완료분). `Phase N` = 해당 단계에서 구현 예정. 기획서 근거는 § 번호.

## 한 장 요약

```
themes(사람의 문장) ─AI(Phase 5)→ WorldDefinition(정의 13종: axiom·schema·rule·species·agent·goal·bootstrap …)
                                      │  검증(Phase 6) 후 WorldRepository 에 고정 — AI 의 역할은 여기서 끝
                                      ▼
        initialize_world → WorldRuntime(state) + Scheduler(이벤트 힙)                       [구현됨]
                                      ▼  advance_time 마다
        이벤트 → RuleEngine(조건·효과) → StateStore.modify ─┬─ RawWorldChange → EventDetector → 사건·개입 기회
                                                            ├─ ObservationSignal → 믿음 → 재판단 → 새 행동 예약
                                                            └─ dirty 마킹 → WorldStatePatch (경계를 넘는 유일한 출력)
                                      ▼
        ViewModelBuilder(3D→2D 투영·모드 필터·의미→속성 번역) → SceneViewModel → 렌더러(속성 그대로)   [구현됨]
```

AI 가 만드는 것은 **정의 데이터**, 런타임이 굴리는 것은 **상태 + 이벤트 + 믿음 + 변경 기록**, 화면에 도달하는 것은 **patch 를 거친 SceneViewModel** 하나다.

## 0단계 — 입력: 사람이 쓰는 유일한 데이터

```jsonc
// WorldSeedInput (§4) — 세계 생성 화면(Phase 5)에서 제출
{ "themes": ["강한 제약은 강한 능력을 만들지만, 어기면 반동을 받는다",
             "문명 밖에는 능력의 흔적을 흡수해 적응하는 생물이 존재한다", ...],
  "desiredExperiences": [...], "prohibitedElements": [...] }
```

현재(Phase 4 완료 시점)는 이 자리에 **수동 세계**가 있다: `proto/src/content/manual-world/` 가 Phase 5 생성기가 출력해야 할 것과 **같은 포맷**의 데이터를 손으로 든다. 즉 지금 돌아가는 모든 데이터 포맷이 곧 생성 AI 의 출력 계약이다(분해 원칙 — [README.md](README.md) 의존 그래프 참조).

## 1단계 — AI 가 만드는 데이터 (Phase 5 `generation/`)

각 생성기는 `TextGenerationPort.generate(taskId, systemPrompt, input, outputSchema)` 를 호출하고 출력은 JSON Schema 로 즉시 검증된다. 만들어지는 데이터와 그 소비처:

```jsonc
// ① AxiomGenerator → WorldAxiom (§7) — 문장이 "불변 제약"이 됨. 소비처: Phase 6 검증(위반 규칙 반려)
{ "id": "axiom.power_cost", "statement": "강한 능력은 강한 대가를 요구한다", "immutable": true }

// ② SchemaGenerator → StateSchema (§9) — 존재할 수 있는 상태의 선언. 소비처: StateStore 검증 [구현됨: core/world/StateSchema.ts]
{ "id": "offspringThreat", "ownerType": "agent", "dataType": "number",
  "min": 0, "max": 100, "observable": false, "updatePolicy": "event" }
//        ^^^^^^^^^^^^^^^^^ observable:false → 어떤 신호로도 새지 않는 상태 = 믿음 분리(§10)의 데이터 근거

// ③ RuleGenerator → RuleDefinition (§11) — 세계의 물리법칙. 소비처: RuleEngine [구현됨: core/rules/]
{ "id": "rule.echo_beast_defend", "scope": "entity", "priority": 70,
  "tags": ["violence", "threat", "creature"],          // ← change 로 전파되어 사건 탐지의 재료가 된다 (Phase 4)
  "triggers": [{ "type": "entity_entered", "locationTag": "nest_area" }],
  "conditions": [{ "left": { "type": "actor_state", "key": "offspringThreat" }, "operator": ">", "right": { "type": "constant", "value": 60 } }],
  "effects": [{ "type": "modify_state", "target": { "type": "target" }, "stateKey": "health", "operation": "add", "value": -30 }],
  "observations": [{ "channel": "sound", "signal": "beast_roar", "strength": 80 }] }

// ④ SpeciesGenerator → SpeciesDefinition (§15) — 감각·본능·필요 자원. 소비처: PerceptionSystem(감각), GoalSystem(본능)
{ "id": "species.echo_beast", "senses": [{ "channel": "energy_sense", "range": 35, "accuracy": 0.9 }],
  "instincts": ["goal.protect_offspring"] }

// ⑤ AgentGenerator → AgentDefinition + traits (§18) — 판단 계수 9종은 코드가 직접 읽는 수치. 소비처: GoalSystem·ActionPlanner
{ "id": "agent.villager_tomm", "traits": { "riskTolerance": 34, "uncertaintyAversion": 71, ... },
  "goalGraphId": "goals.tomm", "beliefs": [ /* 초기 오해 포함 가능 */ ] }

// ⑥ GoalGraphGenerator → GoalNode/GoalEdge (§19) — 충돌 구조 포함. 소비처: GoalSystem
{ "nodes": [{ "id": "goal.feed_family", "targetConditions": [...], "allowedActionTags": ["hunt", "trade"] }],
  "edges": [{ "from": "goal.feed_family", "to": "goal.keep_beliefs", "relation": "conflicts", "weight": 0.7 }] }

// ⑦ BootstrapGenerator → 초기 배치 — 사건은 없고 긴장된 초기 상태만(§41). 소비처: WorldBootstrap [구현됨]
{ "entities": [{ "id": "creature.echo_beast_mother", "type": "agent",
    "position": { "regionId": "region.silent_forest", "x": 41, "y": 18, "z": 3 },   // 공간 데이터는 3D (§13 개정)
    "states": { "aggression": 12, "offspringThreat": 95 } }] }
```

이 밖에 압력(§8)·공간(§13)·자원(§14)·조직(§17)·능력(§16)·행동(§21)·사건 패턴(§28)이 같은 방식으로 생성되어 `WorldDefinition`(§5, `core/world/types.ts`) 하나로 조립된다.

핵심: **AI 의 출력물은 전부 "정의"이고 문장이 아니다.** Phase 6 `WorldValidator` 가 §34 규칙(대가 없는 능력, 대상 없는 규칙 등)으로 반려한 뒤 `persistence/WorldRepository.save()` 로 고정하며, **이후 AI 는 시뮬레이션에 개입하지 않는다**(§2.1). 현재는 `core/world/WorldValidation.ts` 가 이 검증의 선행분(태그·id 실존 검사 등)을 수동 세계에 이미 적용하고 있다.

## 2단계 — 런타임이 그 데이터를 소비하는 경로 [구현됨]

브라우저 UI 는 `app/WorkerHost.ts` 로 §38 메시지를 보내고, Worker 안의 `core/simulation/RuntimeServer.handle()` 이 받는다 (headless 테스트는 같은 코드를 `InlineHost` 로 실행):

```
initialize_world { definition }      ← 1단계의 WorldDefinition (지금은 content/manual-world)
  → WorldBootstrap: bootstrap 을 EntityState 로 전개, interval 규칙을 Scheduler 반복 이벤트로 등록

advance_time { amount }
  → SimulationLoop.advance()         이벤트 힙에서 시각순으로 꺼내 처리, 매 시각마다 §26 훅 6개 호출
```

이벤트 하나가 처리될 때 데이터가 도는 경로 (사냥꾼이 둥지 근처로 이동을 완료한 순간):

```
[스케줄 이벤트 action_completed]  → core/actions/ActionSystem.ts
 → RuleEngine (core/rules/RuleEngine.ts)
    트리거 색인에서 rule.echo_beast_defend 히트 (entity_entered: nest_area)
    ConditionEvaluator: offspringThreat(95) > 60 → 참
    EffectExecutor → StateStore.modify("agent.hunter", "health", "add", -30)
         │              (core/world/StateStore.ts — 모든 상태 쓰기의 단일 경로)
         │                ├─ StateSchema 검증 (min/max·미등록 키 거부)
         │                ├─ dirty 마킹 ───────────────────────────→ (3단계 patch 로)
         │                └─ RawWorldChange 기록 (shared/change.ts)
         │                     { tags: ["rule", "rule.echo_beast_defend", "violence", "threat",
         │                              "creature", "living", "human", "hunter"], ... }   ← 규칙+개체 태그 합산 전파
    ObservationEmitter (core/rules/ObservationEmitter.ts)
      → ObservationSignal (shared/observation.ts) { channels: ["sound"], signal: "beast_roar", strength: 80, ... }
```

`ObservationSignal` 은 인식 파이프라인으로 간다 — **실제 상태와 믿음이 갈라지는 지점**:

```
core/agents/PerceptionSystem.ts
  canObserve: 채널점수 + 강도 + 주의 − 거리감쇠(distance3d, z 포함) − 차폐 > 50   (§23)
  → 기억 대조(MemorySystem) → 원인 후보 → traits·관계로 왜곡 → BeliefStore.upsert:
     BeliefRecord { subjectId: "creature.echo_beast_mother", stateKey: "aggression",
                    believedValue: 90, confidence: 0.82 }        (shared/beliefs.ts)
     ^^^^ 실제 aggression 은 12 — offspringThreat(95)는 observable:false 라서 아무도 본 적이 없다
  → 믿음 변화량 큼 → important_observation 플래그 → shouldReplan (§26)
```

재판단은 **오직 믿음만 입력으로** 받는다 — 판단 코드가 `WorldState` 를 직접 읽는 것은 린트로 금지되어 있고, 유일한 창이 `core/agents/BeliefView.ts` 다 (자기 감각 / 믿음 / 지각 / 모름 4종만 반환):

```
core/agents/GoalSystem.ts     calculateGoalActivation(agent, goal, beliefView)   §20 — 활성도 11항
 → 활성 목적: goal.report_danger (aggression=90 이라 믿으므로)
core/agents/ActionPlanner.ts  후보 생성(allowedActionTags 필터, 아는 대상만) → §22 점수식 → softmax
 → 난수는 RandomContext{worldSeed, tick, entityId} — 같은 시드면 같은 선택 (shared/random.ts)
 → Scheduler.schedule({ type: "action_completed", executeAt: now + duration })   다음 연쇄 시작
```

조직(faction)도 같은 파이프라인을 돈다(`core/agents/FactionRuntime.ts`, §17) — 조직의 믿음은 구성원 보고의 집약이고, 조직의 행동에는 구성원 **위임**이 포함되어 개인 목적 그래프에 조직 유래 목적이 주입된다.

한편 `RawWorldChange` 누적분은 반 일 주기로 사건이 된다:

```
core/events/ChangeCollector.ts   태그·위치 색인 (링 버퍼)
core/events/EventDetector.ts     패턴 매칭: requiredTags ∩ timeWindow ∩ locationRadius, 참여자 ≥ 최소치 (§28)
 → WorldEvent (shared/events.ts) { type: "ecological_conflict", participants: [반향수·마을·연구회…],
                                   affectedStates, changes, status: "ongoing", significance(§29 6항) }
core/events/EventViews.ts        getEventViewFor(agentId, eventId) — 그 주체의 믿음과 교집합한 "아는 사건"만 (§30)
 → InterventionOpportunity { knownFacts, possibleInteractions, timeSensitivity }   ← Phase 7 플레이어 UI 의 입력
```

시드 42 · 30일 기준 change 약 8천 건이 6개 패턴으로 묶여 사건 37건이 된다 — 아무도 사건을 작성하지 않았다. 전 과정은 `cd proto && npm run verify` 한 줄로 ✓/✗ 재현된다.

## 3단계 — 렌더: 어떤 데이터가 화면이 되는가 [구현됨]

시뮬레이션에서 경계 밖으로 나가는 데이터는 둘뿐이다: `WorldStatePatch`(변경분)와 `events_created`(사건 갱신) — 둘 다 §38 프로토콜(`shared/protocol.ts`).

```jsonc
// WorldStatePatch (shared/state.ts) — StateStore 가 마킹한 dirty 만 WorldRuntime.flushPatch() 가 모은다
{ "time": 43200,
  "upserts": [{ "id": "agent.hunter", "position": { "regionId": "...", "x": 40, "y": 17, "z": 2 },
                "states": { "health": 42 }, ... }],
  "removedIds": [], "globalStates": { ... } }
```

메인 스레드의 `viewmodel/ViewModelBuilder.ts` 가 이걸 받아 **시뮬레이션 의미를 표시 속성으로 번역**한다. 3D→2D 투영도 여기서 일어난다:

```ts
// ViewModelBuilder 내부 (실제 코드)
const { regionId, x, y, z } = entity.position;
scene.position = { regionId, x, y };   // 렌더러가 받는 좌표엔 z 필드 자체가 없다
scene.elevation = z;                    // 고도는 표시 속성으로 분리
```

최종 산출이 `viewmodel/SceneViewModel.ts` 의 `SceneViewModel` 이고, **렌더러·페이지는 이것만 import 할 수 있다** (eslint `no-restricted-imports` 로 `app/`·`rendering/` 의 `core/` 접근이 빌드 오류):

```jsonc
{ "time": 43200, "day": 30, "initialized": true,
  "entities": [{ "id": "agent.hunter", "kind": "agent", "position": { "x": 40, "y": 17, ... }, "elevation": 2,
                 "stateBadges": [{ "key": "health", "value": "42" }] }],
  "globalBadges": [...] }
// Phase 7~8 에서 필드 추가 예정: map(지역 형상·colorKey), overlays(사건), actionPanel, eventPanel …
```

`app/main.ts` 의 `render()` 는 이 속성을 **그대로** DOM 에 매핑할 뿐, `if (danger > 50)` 같은 시뮬레이션 값 해석이 없다. 플레이어 모드(Phase 7)에서는 빌더가 믿음+발견 집합 밖의 데이터를 ViewModel 에 아예 넣지 않으므로, "반향수의 실제 aggression=12" 는 화면에 존재할 수 없다.

## 단계 ↔ 모듈 ↔ 구현 현황

| 흐름 단계 | 데이터 | 모듈 | 상태 |
|---|---|---|---|
| 입력 | `WorldSeedInput` | 세계 생성 화면 | Phase 5 |
| 생성 | `WorldDefinition` 13종 | `generation/*Generator` + `TextGenerationPort` | Phase 5 (현재 대역: `content/manual-world/`) |
| 검증 | `ValidationIssue` | `WorldValidator` + 자동 30일 실행 | Phase 6 (선행분: `core/world/WorldValidation.ts` 구현됨) |
| 부트스트랩 | `EntityState` | `core/world/WorldBootstrap.ts` | 구현됨 |
| 규칙 실행 | `RuleDefinition` → `StateChange` | `core/rules/` 6모듈 | 구현됨 |
| 상태 기록 | `RawWorldChange` | `core/world/StateStore.ts` | 구현됨 |
| 인식·믿음 | `ObservationSignal` → `BeliefRecord` | `core/agents/PerceptionSystem·BeliefView` | 구현됨 |
| 판단 | `ActiveGoalState` → `ScheduledActionState` | `core/agents/GoalSystem·ActionPlanner·FactionRuntime` | 구현됨 |
| 사건 | `WorldEvent`·`InterventionOpportunity` | `core/events/` 5모듈 | 구현됨 |
| 플레이어 | `PlayerRuntimeState` | 판단 분기 + 지식 필터 | Phase 7 |
| 경계 출력 | `WorldStatePatch`·`events_created` | `RuntimeServer`·`PatchCollector` | 구현됨 |
| 표시 번역 | `SceneViewModel` | `viewmodel/ViewModelBuilder.ts` | 구현됨 (필드는 Phase 7~8 확장) |
| 문장화 | 사건 제목·대화·소문 | `EventInterpreter` (표현 전용, 쓰기 권한 없음 §33.3) | Phase 8 |
