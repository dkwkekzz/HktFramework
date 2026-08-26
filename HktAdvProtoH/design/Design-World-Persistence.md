# Design — 세계의 영속과 복구

status: IMPLEMENTED — 검증은 `engine/world-kernel/tests/persistence.spec.ts`(커널 계약) ·
`content/proto-adventure/world/tests/persistence.spec.ts`(팩 실측)가 상시 확인한다

## 목적

지금 세계는 프로세스 메모리에만 산다 — `server/world-host.ts` 가 기동마다
`createWorld()` 로 새 세계를 만들고, 종료하면 모든 것이 사라진다.
INTENT-OBSERVER-REJOIN-001 이 약속한 "재참여하면 몸·자리·가진 것이 이어진다" 는
**프로세스가 살아 있는 동안만** 참이다. "걸어 둔 것이 재접속 후 그대로인가" 라는
질문에 세계가 껐다 켜진 경우를 포함해 예라고 답하게 만든다.

이 작업은 게임 의미를 더하지 않는다 — 새 Rule·새 관찰이 없다. 이어짐의 의미는
INTENT-OBSERVER-REJOIN-001 이 이미 소유하고, 영속은 그 의미가 성립하는 범위를
프로세스 수명 너머로 늘릴 뿐이다. 그래서 Cycle 이 아니라 **기반(ENGINE) 트랙**이다.

## 답해야 하는 두 질문

```text
무엇이 영속되는가     사실(State)은 전부, 과정(이어짐·큐·시계)은 전혀
복구는 어떤 단위인가   세계 하나 · Tick 경계의 스냅샷 전체 — 부분 복구는 없다
```

## 원칙 — 기존 설계에서 그대로 파생된다

1. **Engine 은 팩 State 를 들여다보지 않는다** (분리 설계 반전 ③).
   따라서 영속도 불투명하다: 스냅샷은 팩 State 전체를 **데이터 그대로** 담는다.
   Engine 이 필드를 열거·해석하지 않으므로, 팩에 State 필드가 늘어도
   영속 코드는 열리지 않는다.
2. **Tick 이 유일한 원자성 경계다** (RULE-WORLD-TICK-001).
   Tick 도중의 세계는 일관된 상태가 아니므로 스냅샷은 Tick 사이에서만 뜬다.
   (단일 스레드라 Tick 도중에 스냅샷 호출이 끼어들 수 없다 — 계약이 아니라 사실이다.)
3. **사실은 영속되고 과정은 영속되지 않는다.**
   State 는 세계가 아는 사실이고, 이어짐(links)·pending 큐·마지막 관찰·시계는
   지금 진행 중인 과정이다. 과정은 복구 후 관찰자들이 다시 붙으면서 저절로 재생된다.
4. **결정론은 State 안에 있다.** ChanceSeed·ChanceCursor 가 State 에 있으므로
   복구된 세계는 같은 흔들림의 흐름을 이어 간다 — 껐다 켜도 이야기가 갈라지지 않는다.

## 무엇이 영속되는가

| 항목 | 영속 | 이유 |
|---|---|---|
| 팩 State 전체 (actors 의 자리·소지품·**장비**, deposits, 이벤트 목록, chanceSeed/Cursor …) | O | 세계의 사실 — Engine 은 내용을 모른 채 통째 담는다 |
| CoreWorldState.time | O | 세계의 나이 — 관찰자가 없어도 흐른 시간이 사실이다 |
| CoreWorldState.observers (Id → 몸의 귀속, acknowledgedMark) | O | "그 몸은 그 관찰자의 것" 이 영속의 핵심 사실이다 |
| observers[].present | **복구 시 전부 false** | 기동 직후 아무도 보고 있지 않다 — 이어짐은 과정이다 |
| pending 요청·참여 큐 (kernel 내부) | X | 도착했지만 판정 전인 과정 — 유실은 미판정 요청의 유실이며, 클라이언트의 기다리는 요청 표가 이미 응답 없음을 다룬다 |
| latest 관찰 결과 (kernel 내부) | X | 다음 Tick 이 새로 만든다 |
| links·시계 (world-host) | X | 프로세스의 것 — 세계의 사실이 아니다 |

만료 수명을 가진 이벤트 목록(strikeEvents 등)도 특별 취급하지 않고 State 의 일부로
그대로 담는다 — 복구 후 기존 만료 규칙이 알아서 정리한다. 특례를 만들면 Engine 이
팩 State 를 해석하게 된다 (원칙 1 위반).

`present=false` 강제만이 복구 시 Engine 이 손대는 유일한 지점이며, 이는 Engine 이
소유한 CoreWorldState 안이다 — 팩 영역은 건드리지 않는다.

## 복구 단위 — 세계 하나, 전체

부분 복구(관찰자 단위·Actor 단위)는 없다. 세계는 하나의 인과이고 Tick 하나가
전체를 함께 진행시키므로, 부분만 되돌리면 인과가 찢어진다 (예: 광맥은 캐인
상태인데 캔 돌은 가방에 없는 세계). 복구란 "Tick N 이 끝난 순간의 세계"를
통째로 다시 붙드는 것이다.

## 계약

```text
engine/world-kernel/persistence.ts
  WorldSnapshot = { version: string, state: <팩 State, plain JSON 데이터> }
  takeSnapshot(version, state)      복제해 담는다 — 이후의 세계 진행이 스냅샷을 못 건드린다
  restoreState(snapshot, version)   되살린다 — 버전 불일치면 null. 복구 시 Engine 이
                                    손대는 유일한 지점: 모든 observers[].present = false

engine/world-kernel/kernel.ts
  World.snapshot(): WorldSnapshot   Tick 사이에 현재 State 를 데이터로 내놓는다.
                                    버전은 WorldContent.stateVersion — 팩이 선언하고 올린다

content/<pack>/world/index.ts
  createWorld(setup, restored?)     restored 가 있으면 초기 배치 대신 그 State 로 커널을
                                    조립한다. 팩은 복구 State 를 해석하지 않는다
  restoreWorld(snapshot)            restoreState 를 자기 STATE_VERSION 으로 부른다
                                    (STATE_VERSION 은 semantic/world-state.ts 헤더 상수)

server/ (조립 — 세계를 띄우는 쪽)
  world-store.ts                    파일 하나(JSON) 어댑터 — 임시 파일 + rename 이라
                                    저장 도중 죽어도 직전 스냅샷이 깨지지 않는다
  main.ts                           기동 시 있으면 복구, 없으면 초기 배치. 주기 저장 +
                                    정상 종료(SIGINT/SIGTERM) 시 저장. 조정 손잡이:
                                    HKT_WORLD_SAVE(자리, 기본 .world/snapshot.json) ·
                                    HKT_WORLD_SAVE_INTERVAL_MS(주기 ms, 기본 5000,
                                    0 이하 = 저장 끔)
  Tick 마다 저장하지 않는 이유: 프로토타입에서 직렬화 비용 대비 얻는 것이 없고,
  비정상 종료 시 최근 몇 초의 유실은 정직한 한계로 받아들인다
```

전제이자 새 계약: **팩 State 는 plain JSON 데이터다** (함수·클래스·Map 금지).
현재 이미 사실이며(배열·객체·수·문자열뿐), 이 설계로 계약이 된다 —
`boundary:check` 수준의 상시 검사로 승격할 후보다.

## 버전 — 팩이 바뀌면 스냅샷은 버린다

스냅샷은 `version`(팩 id + 팩이 올리는 State 형태 버전)을 지닌다. 불일치하면
복구하지 않고 새 세계로 시작하며 로그로 밝힌다. 마이그레이션은 만들지 않는다 —
Cycle 마다 State 형태가 자라는 프로토타입에서 마이그레이션 비용은 얻는 것보다
크고, "버렸다" 를 숨기지 않는 것이 정직하다. 형태를 바꾼 Cycle 이 버전을 올릴
책임을 진다 (팩 소유).

## 검증

두 층의 테스트가 상시 확인한다 (`npm test`):

1. 커널 계약 (`engine/world-kernel/tests/persistence.spec.ts` — 인라인 최소 팩, content
   무의존): 스냅샷 격리 · present=false 와 재참여 시 몸 이어짐 · 결정론(끊김 없이
   2N Tick == N Tick → 스냅샷 → 복구 → N Tick) · 버전 불일치 거부
2. 팩 실측 (`content/proto-adventure/world/tests/persistence.spec.ts`): 소지품·장비·
   광맥 잔량이 스냅샷을 거쳐 그대로다 — "걸어 둔 것이 재접속 후 그대로" 의 실측 —
   그리고 자율 존재가 있는 기본 배치 세계의 결정론이 스냅샷을 거쳐도 이어진다

## 레인과 경계

- 이 작업은 ENGINE 레인이다. 단, 조립 지점(`server/`)이 함께 열린다 —
  works.md 의 ENGINE 쓰기 범위(`engine/`)에 조립 층(`server/`)이 어느 레인
  소유인지 공백이 있다. 이 작업 한정으로 engine+server 를 한 몸으로 보되,
  공백 자체는 PROCESS 레인에 보고한다.
- `content/` 는 팩 채택 최소분만 열린다 — `createWorld` 의 restored 인자 ·
  `restoreWorld` · `STATE_VERSION` 상수 (proto-adventure 와 blank 두 팩 모두).
