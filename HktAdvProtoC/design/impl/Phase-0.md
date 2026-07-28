# Phase 0 — 프로젝트 골격과 결정론 기반

> 근거: §37(웹 클라이언트 구조), §38(브라우저 실행 구조), §39(저장 구조), §26(이벤트 기반 시뮬레이션). 기획서의 명시적 단계는 아니지만 §42 전 단계가 공유하는 전제 구조라서 선행 분리한다.

## 목표

시뮬레이션 내용이 하나도 없어도 "시간이 흐르고, 저장·복원되고, 같은 시드로 재현되는" 빈 세계를 만든다. §44-12(재현성)와 §44-4(브라우저 시간 진행)의 기반.

## 산출 모듈 (§37 트리 그대로)

```
HktAdvProtoC/proto/
├─ index.html
├─ package.json / tsconfig.json / vite.config.ts
└─ src/
   ├─ app/            # Phase 8 전까지는 최소 셸 1페이지
   ├─ core/
   │  ├─ world/       # WorldDefinition·WorldState 타입, WorldRuntime 골격
   │  └─ simulation/  # Scheduler, SimulationLoop, SimulationWorker
   ├─ persistence/    # WorldRepository, SnapshotRepository, EventLogRepository
   ├─ viewmodel/      # SceneViewModel 스키마 + 빌더 (렌더·UI 의 유일한 데이터 소스)
   └─ shared/         # RandomContext RNG, 시간 상수, patch 타입
```

`core/rules` `core/agents` `core/events` `generation` `rendering` 디렉터리는 자리만 만들고 해당 Phase 에서 채운다.

## 상세 설계

### 0.1 시뮬레이션 시간 모델

- 시간 단위: 정수 tick. `1 tick = 시뮬레이션 1분`, `1일 = 1440 tick` 으로 고정(§35 "가상 시간 30일" 테스트의 기준 단위). 부동소수점 시간 금지 — 결정론 보호.
- `WorldState.simulationTime: number` (§9.1) 는 tick 정수.

### 0.2 시드 RNG — `RandomContext` (§39)

```typescript
interface RandomContext {
  worldSeed: number;
  simulationStep: number;
  entityId?: string;
}
```

- 구현: splitmix64 로 `hash(worldSeed, simulationStep, fnv1a(entityId))` 를 상태로 만든 뒤 xoshiro128** 스트림 생성. 라이브러리 의존 없이 ~40줄.
- **호출 규약**: 전역 싱글턴 RNG 금지. 확률이 필요한 모든 지점은 `RandomContext` 를 명시적으로 만들어 `rng(ctx).next()` 를 호출한다. `Math.random` 은 ESLint 규칙으로 코어 디렉터리에서 금지.
- 같은 (시드, 스텝, 개체) 이면 호출 순서와 무관하게 같은 난수열 → 병렬 개체 처리 순서가 바뀌어도 재현 유지.

### 0.3 이벤트 스케줄러 (§26)

```typescript
interface ScheduledSimulationEvent {
  id: string; executeAt: number; type: string;
  targetIds: string[]; payload: Record<string, unknown>; priority: number;
}
```

- 자료구조: 이진 min-heap. 정렬 키 `(executeAt, -priority, seq)` — `seq` 는 삽입 순번으로 동순위 결정론 보장.
- API: `schedule(event)`, `cancel(id)`, `popDue(now)`.
- `SimulationLoop.step(deltaTicks)` 는 §26 메인 루프의 함수 골격 7단계를 순서 그대로 호출하되, Phase 0 에서는 `processScheduledEvents` 만 실체이고 나머지는 no-op 훅으로 둔다. 이후 Phase 가 훅을 채운다.

### 0.4 Worker 브리지 (§38)

- 메시지 타입은 §38 의 `WorkerRequest` / `WorkerResponse` 를 그대로 사용: `initialize_world` / `advance_time` / `execute_player_action` / `request_snapshot` ↔ `world_initialized` / `state_patch` / `events_created` / `snapshot`.
- **patch 포맷**: §38 "변경된 데이터만 patch 로 전달". `WorldStatePatch = { time: number; upserts: EntityState[]; removedIds: string[]; globalStates?: Record<string, unknown> }`. 런타임은 tick 처리 중 dirty set 을 수집해 `advance_time` 응답마다 flush.
- 코어는 Worker API 를 직접 만지지 않는다. `SimulationWorker.ts` 만 postMessage 를 알고, 동일 인터페이스의 `InlineHost`(같은 스레드 실행)를 두어 Vitest headless 테스트가 Worker 없이 코어를 돌린다.

### 0.5 저장 구조 (§39)

- 세 저장소 분리: `WorldRepository`(WorldDefinition — 불변), `SnapshotRepository`(WorldSnapshot — 특정 시점 전체 상태), `EventLogRepository`(스냅샷 이후 상태 변경 로그).
- Phase 0 구현체: in-memory + JSON 직렬화(내보내기/불러오기 파일). IndexedDB 승격은 Phase 7 이후 필요 시 — 인터페이스는 지금 확정한다.
- 복원 절차(§39): 최신 스냅샷 로드 → 이후 EventLog 순차 재실행 → 현재 상태. 재실행이 가능하려면 EventLog 항목은 "결과 상태"가 아니라 "입력 이벤트"(스케줄된 이벤트 + 플레이어 행동)를 기록한다.

### 0.6 ViewModel 경계 (분해 원칙 5)

렌더·UI 와 시뮬레이션 데이터의 격리는 나중에 붙일 수 없으므로 Phase 0 에서 경계를 확정한다.

- **데이터 흐름 고정**: `WorldState patch → ViewModelBuilder → SceneViewModel → 렌더러/UI`. 빌더는 메인 스레드에서 patch 를 구독해 ViewModel 을 증분 갱신한다. 렌더러·app 페이지는 `SceneViewModel` 이외의 어떤 타입도 import 할 수 없다.
- **의존 규칙의 기계 강제**: ESLint `no-restricted-imports` 로 `rendering/`·`app/` 에서 `core/`·`persistence/` import 를 금지한다. 원칙이 아니라 빌드 오류로 강제 — 위반 코드는 컴파일 단계에서 죽는다.
- **`SceneViewModel` 의 성격**: 표시 대상의 **속성만** 담는다(위치, 크기, 라벨, 강도, 태그 유래의 심볼 키, 색상 키 등 표현 중립 값). "어떻게 그릴지"(색상 코드, 픽셀, 폰트, 레이아웃)는 렌더러 소관이고, "시뮬레이션 의미가 무엇인지"(위험도 계산, 믿음 필터링, 사건 중요도 판정)는 빌더에서 끝낸다. 렌더러는 받은 속성을 **그대로** 매핑만 한다.
- Phase 0 시점의 최소 스키마: `{ time: number; speed: number; entities: Array<{ id, kind, position?, label, stateBadges: Array<{key, value}> }> }`. 이후 Phase 는 이 스키마에 **필드를 추가**할 뿐이며(지도 레이어·신호·사건 오버레이·패널 뷰 등), 렌더러 교체가 코어·빌더에 역류하는 변경은 금지.
- 셸 페이지(스텝 8)부터 이 경계를 지킨다 — "텍스트로 tick 표시" 조차 SceneViewModel 을 소비한다. 최초 소비자가 규율의 증명이다.

## 구현 스텝

1. Vite + TS strict + Vitest 스캐폴드, ESLint(`Math.random`/`Date.now` 코어 금지 + `rendering/`·`app/` 의 `core/` import 금지 규칙).
2. `shared/`: tick 상수, RNG(단위 테스트: 같은 ctx → 같은 열, 다른 entityId → 다른 열).
3. `core/simulation/Scheduler` heap + 결정론 테스트(동순위 이벤트 삽입 순서 재현).
4. `core/world`: 기획서 §5·§9 타입 선언부(값 없이 타입만), 빈 `WorldRuntime`.
5. `SimulationLoop.step` 골격 + no-op 훅.
6. Worker 브리지 + InlineHost + patch 수집.
7. persistence 3종 + 스냅샷/재실행 round-trip.
8. `viewmodel/`: 최소 SceneViewModel 스키마 + patch 구독 빌더.
9. 최소 셸 페이지: 시드 입력 → 빈 세계 초기화 → 시간 진행 버튼 → 현재 tick 표시 (SceneViewModel 소비).

## 완료 조건 (DoD)

- [x] 같은 시드로 두 번 실행한 빈 세계 30일 진행이 상태 해시까지 동일하다. (`determinism.test.ts` — 진행 호출 단위 불변성 포함)
- [x] 스냅샷 저장 → 이벤트 로그 재실행 복원 상태 == 연속 실행 상태 (`persistence/roundtrip.test.ts`)
- [x] 브라우저에서 Worker 로 `advance_time` → `state_patch` 왕복이 동작한다. (`scripts/smoke.mjs` — 실 Chromium)
- [x] 동일 코어 코드가 Vitest(headless)와 Worker 양쪽에서 실행된다. (InlineHost/SimulationWorker 가 같은 RuntimeServer 실행)
- [x] `rendering/`·`app/` 에서 `core/` import 가 린트 오류로 차단되고, 셸 페이지가 SceneViewModel 만으로 동작한다. (eslint no-restricted-imports — 위반 픽스처로 차단 확인)

## 이후 Phase 에 제공하는 인터페이스

- `SimulationLoop` 의 7개 훅 자리(§26) — Phase 1~4 가 순서대로 채움.
- `RandomContext` 규약 — 모든 확률 지점의 유일한 난수 소스.
- patch/저장 포맷 — ViewModel 빌더와 Phase 6 자동 테스트의 입력.
- `SceneViewModel` 경계 — 이후 모든 화면·렌더 작업(Phase 1 셸 표시, Phase 7 플레이어 패널, Phase 8 전체 화면)의 유일한 데이터 소스. 각 Phase 는 스키마에 필드를 추가할 뿐 경계를 우회하지 않는다.
