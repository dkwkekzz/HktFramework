# V2 determinism

> 계약: [MODULE.yaml](MODULE.yaml) · 페이즈 문서: [10-Phase-V-Verification.md](../../../design/modules/10-Phase-V-Verification.md) · 선행: [V0](../V0-module-contract/README.md)
> 시드 조합 규칙의 근거: [Design-MMO.md](../../../design/Design-MMO.md) 29장

## 목적 (G0)

시간·ID·무작위성을 결정적 자원으로 제공해, 같은 시드와 같은 입력이면 언제나 같은 난수열·같은 ID·같은 틱 진행이 나오게 한다.

이것이 없으면 GI-12(리플레이 불일치 금지)를 지킬 수 없고, 사건 로그를 대조할 수도 없다.

## 세 자원

| 자원 | 클래스 | 대체하는 것 |
|---|---|---|
| 무작위성 | `Rng` (SplitMix64) | `Math.random()` |
| 시간 | `TickClock` | `Date.now()` · `new Date()` · `performance.now()` |
| ID | `IdFactory` | UUID v4 등 난수 기반 id |

### 시드 조합 — 원문 29장 그대로

```text
worldSeed + currentTick + subjectId + decisionCounter + situationId
```

```ts
const rng = Rng.fromComponents({
  worldSeed: 20260730n,
  tick: 12,
  subjectId: 'npc_hunter_01',
  decisionCounter: 3,
  situationId: 'sit_hunt',
});
```

다섯 항목 중 하나만 달라도 다른 시드가 나온다. 빠진 항목과 빈 문자열도 구분한다 — 그렇지 않으면
서로 다른 주체·틱이 같은 난수를 쓰게 된다.

### fork — 소비자를 늘려도 기존 열이 흔들리지 않는다

하나의 난수 스트림을 여럿이 나눠 쓰면, 나중에 소비자를 하나 추가하는 것만으로 그 뒤 모든 값이 밀려
리플레이가 깨진다. 그래서 소비자마다 이름표로 하위 스트림을 연다.

```ts
const perception = rng.fork('perception');   // 부모가 몇 번 뽑았든 같은 스트림
const deliberation = rng.fork('deliberation');
```

하위 시드는 부모의 **현재 상태가 아니라 생성 시드**에서 파생한다. 같은 이유로 `IdFactory` 는
순번을 **종류별로** 센다 — 새 종류의 id 를 발급해도 기존 종류의 열이 밀리지 않는다.

### 스냅샷

`Rng` · `TickClock` · `IdFactory` 모두 `snapshot()` / `restore()` 를 갖는다. K3(event-replay)가
사건 로그의 중간 지점부터 재생할 때 쓴다.

## 구현 선택

- **SplitMix64 + BigInt** — 64비트 정수 연산을 BigInt 로 해서 엔진·플랫폼이 달라도 같은 열이 나온다.
  브라우저 Lab 과 서버 리플레이가 같은 수를 봐야 하기 때문이다. 알려진 시드 0 의 출력값을 단위 테스트에 고정해 두었다.
- **거절 표집** — `nextInt` 는 나머지 연산의 치우침을 거절 표집으로 없앤다. 치우친 난수는 시뮬레이션 결과를
  조용히 왜곡한다. 분포 테스트로 확인한다.
- **빈 목록은 오류** — `pick([])` 이 `undefined` 를 돌려주면 호출부에서 조용히 퍼진다.
- **입력 비변경** — `shuffle` 은 새 배열을 돌려준다.
- **V1 을 쓰지 않는다** — 원문 「8」이 V2 의 선행을 V0 하나로 규정한다. 입력 검증은 손으로 쓰고,
  같은 계약을 `schemas/` 에 JSON Schema 로 두었다. 그 스키마는 저장소 규약 검사가 V1 로 컴파일해 강제한다.

## 실행

```bash
pnpm test V2-determinism   # 단위 · 속성 · 통합
pnpm lab                   # 브라우저 Lab → V2 탭
pnpm verify V2 --lab       # 증거 발급 → evidence/latest.json
```

## 검증 상태

현재 `LAB_PASS` — [evidence/latest.json](evidence/latest.json) 참조. `VERIFIED` 가 아닌 이유는 V0·V1 과 같다
(G6 통합 게이트의 VS0 이 K0~K3 을 요구한다).

## 다음 모듈이 쓰는 법

```ts
// K2(rule-transaction) 처럼 판정에 난수가 필요한 곳
const rng = Rng.fromComponents({ worldSeed, tick, subjectId, decisionCounter, situationId });
const success = rng.nextFloat() < chance;

// K3(event-replay) 처럼 id 가 필요한 곳
const eventId = ids.next('event');

// 시각이 필요한 곳 — 벽시계를 읽지 않는다
const now = clock.timeMs;
```

## 파일

```text
MODULE.yaml                계약
schemas/                   입력·출력 JSON Schema (저장소 규약 검사가 V1 로 컴파일한다)
src/seed.ts                원문 29장 조합 규칙 · 하위 시드 파생
src/rng.ts                 SplitMix64 · nextInt/pick/shuffle/weighted · fork · 스냅샷
src/clock.ts               틱 기반 시계
src/id.ts                  결정적 ID 발급기
src/module.ts              ModuleDefinition (입력 검증 · 불변조건)
scenarios/                 대표 검증 장면 7개
lab/                       Lab 실행 진입점
tests/{unit,property,integration}/
evidence/latest.json       원문 「21」 증거
```
