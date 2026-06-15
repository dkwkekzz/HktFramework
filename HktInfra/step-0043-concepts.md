# step-0043 concepts — Splitting a Single Class into Box-Parts (Prototype Augmentation)

> 정식 기록: [step-0043.md](step-0043.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 박스 파일 비대화 트리거 | 박스 파일 1개 >30KB 또는 step 디렉토리 >300KB 면 다음 기능 step 전에 정리 step 을 끼운다 | `svc-inventory.js` 34KB → 분할 발동 |
| 정리 step | 기능 추가 0·바이트 동일·reg 0 으로 복사 전진 페이로드를 유계로 묶는 유지보수 step | 이 step 전체(0030·0035·0038 의 가방 판) |
| 프로토타입 증강(믹스인) | 한 클래스의 메서드를 여러 파일이 `Object.assign(Class.prototype, {…})` 로 나눠 다는 기법 | 단일 클래스를 3분할하는 *수단* |
| 분할 투명성(reg 0) | 파일 구조만 바꾸고 동작은 비트 단위 불변임을 verify 가 증명 | reg 25/25 인프로세스 비트 동일 |

## 1. 왜 분할하는가 — 복사 전진의 페이로드를 유계로 묶기

HktInfra 는 step 마다 직전 step 디렉토리를 *통째 복사*해 전진한다(anti-DRY·동결 스냅샷). 이 복사 전진은 step 간 독립성(닫은 step 불변)을 주지만, 한 박스 파일이 계속 커지면 *매 step 복사 비용·self-review diff·미래 분산 토폴로지와의 정합*이 모두 나빠진다. 그래서 **박스 파일 1개가 30KB 를 넘으면**(0030 수립) 다음 *기능* step 전에 **정리 step**을 끼운다 — 기능은 0 이고, 코드를 *재배치*만 하되 동작은 비트 단위로 같다(reg 0).

`svc-inventory.js`(가방)는 0040~0042 의 ack 자기-크기조정·dedup 유계화를 거치며 34KB 로 불었다(0038 §9 가 이미 예고한 후보). 이번 step 이 그 분할이다.

## 2. 단일 클래스를 어떻게 가르는가 — 프로토타입 증강

앞선 정리 step 들(0035 cluster·0038 topology)은 *여러 최상위 함수/클래스*를 다뤘다 — 파일 경계로 그냥 잘라 옮기면 됐다. 그러나 가방은 **단일 클래스** `InventoryService` 다. 생성자 하나에 60여 줄의 필드 초기화가 모여 있어 쪼갤 수 없다(한 함수는 한 파일).

해법은 **프로토타입 증강(믹스인)**:
- **원장 코어**(`svc-inventory-core.js`)가 `class InventoryService { 생성자 + 트랜잭션 onMsg + crash + 조회 }` 를 정의·export 한다.
- **영속**(`-persist.js`)·**버스**(`-bus.js`) 부품이 코어를 require 한 뒤 `Object.assign(InventoryService.prototype, { _journal, onTick, _out, … })` 로 *나머지 메서드를 프로토타입에 단다*.
- **진입점**(`svc-inventory.js`)이 core→persist→bus 순으로 로드해 클래스가 완전히 조립되도록 보장하고 `{ InventoryService }` 를 재노출한다.

메서드 *본문*은 바이트 그대로 옮기고, 객체 리터럴이 요구하는 *콤마*만 더한다 — 그래서 동작이 변할 여지가 없다.

## 3. 왜 reg 0 인가 — 분할 투명성의 증명

세 가지가 reg 0(0042 비트 동일)을 보장한다:
1. **메서드 본문 바이트 동일** — 공백·주석·순서 보존. 콤마는 보일러플레이트.
2. **export·소비 계약 무변경** — 진입점이 노출하는 `{ InventoryService }` 가 0042 와 같고, `net-core.js`·`topo-build.js` 의 `__p('svc-inventory')` 소비가 그대로.
3. **열거 차이 무해** — class 메서드는 프로토타입에 *비-열거*로 붙지만 `Object.assign` 은 *열거 가능* own-속성으로 단다. 코드 어디도 가방 인스턴스/프로토타입을 `for…in`·`Object.keys` 로 돌지 않으므로(grep 확인) 이 차이가 동작에 닿지 않는다.

가방은 `reg` 모드가 *직접 자극*하는 박스(inv 다이제스트를 비교)라, 인프로세스 비트 동일이 곧 분할 투명성의 **직접 증명**이다 — cluster(0035)가 멀티프로세스 E2E 로만 증명했던 것보다 강하다.

## 한 줄 요약

단일 클래스 `InventoryService` 를 *원장 코어 / write-behind 영속 / 버스 결과·replay* 3부품으로 프로토타입 증강(믹스인) 분할 — 메서드 본문 바이트 동일·콤마만 추가·열거 차이 무해 → reg 25/25 비트 동일로 분할 투명성을 직접 증명(박스 파일 34KB→최대 19.6KB).
