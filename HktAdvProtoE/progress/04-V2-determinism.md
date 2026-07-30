# 04. V2 determinism

> 현재 상태 요약은 [../STATE.md](../STATE.md). 착수 절차는 [00-Module-Checklist.md](00-Module-Checklist.md).

## 한 일

원문 「8」의 V2(시간·ID·무작위성을 결정적으로 만든다 / Seed RNG, Tick Clock, Deterministic ID /
같은 시드를 100회 실행해 같은 ID·난수열 출력)를 원문 「22」 절차대로 구현했다.
시드 조합 규칙은 [Design-MMO.md](../design/Design-MMO.md) 29장이 규정한다.

| 단계 | 결과 |
|---|---|
| 1 선행 모듈 확인 | V0 (원문 「8」이 V2 의 선행을 V0 하나로 규정) |
| 2 MODULE.yaml 작성 | [V2-determinism/MODULE.yaml](../packages/verification/V2-determinism/MODULE.yaml) |
| 3 실패하는 시나리오 | 대표 장면 7개 |
| 4 최소 구현 | `src/{seed,rng,clock,id,module}.ts` |
| 5 타입·단위 테스트 | 단위 89건 |
| 6 속성 테스트 | 13속성 × numRuns 1000 (시드 20260730 고정) |
| 7 대표 Lab 실행 | Lab V2 탭 — 자동 발견으로 등록 없이 올라왔다 |
| 8 인과 추적 확인 | 시드 구성 표기(`seedLabel`)로 "이 난수가 무엇에서 나왔는지"가 화면에 남는다 |
| 9 통합 시나리오 | 통합 17건 (축소 시뮬레이션 리플레이). VS0 은 K0~K3 대기 |
| 10 증거 파일 | `evidence/latest.json` |
| 11 VERIFIED 등록 | **하지 않음** — G6 미충족, 상태는 `LAB_PASS` |

## 세 자원

| 자원 | 구현 | 대체 대상 |
|---|---|---|
| 무작위성 | `Rng` — SplitMix64 (BigInt 64비트) | `Math.random()` |
| 시간 | `TickClock` — 시각은 `tick × msPerTick` | `Date.now()` · `new Date()` |
| ID | `IdFactory` — `sha256(시드/종류/순번)` | UUID v4 |

시드는 원문 29장의 다섯 구성요소(`worldSeed + tick + subjectId + decisionCounter + situationId`)를
sha256 으로 접어 만든다. 다섯 중 하나만 달라도 시드가 갈라지는 것을 단위·속성·장면 세 곳에서 확인한다.

## 설계 판단

- **fork 는 부모의 현재 상태가 아니라 생성 시드에서 파생한다.** 하나의 스트림을 여럿이 나눠 쓰면
  나중에 소비자를 하나 추가하는 것만으로 그 뒤 모든 값이 밀려 리플레이가 깨진다(GI-12).
  이름표로 하위 스트림을 열면 소비 순서가 결과를 바꾸지 않는다. 통합 테스트의 축소 시뮬레이션에서
  "지각 스트림을 뒤늦게 추가해도 사건 로그가 그대로"임을 확인한다.
- **`IdFactory` 는 순번을 종류별로 센다.** 같은 이유다 — 새 종류의 id 를 발급해도 기존 종류의 열이 밀리지 않는다.
- **BigInt 64비트 연산.** 브라우저 Lab 과 서버 리플레이가 같은 수를 봐야 한다. 32비트 부동소수 트릭은
  엔진에 따라 갈라질 여지가 있어 쓰지 않았다. 알려진 SplitMix64(seed=0) 출력 세 개를 테스트에 고정해
  구현이 바뀌면 즉시 드러나게 했다.
- **거절 표집.** `nextInt` 의 나머지 연산 치우침을 없앤다. 치우친 난수는 시뮬레이션 결과를 조용히 왜곡한다.
  20000회 표본으로 분포를 확인한다.
- **빈 목록·음수 가중치는 오류.** `pick([])` 이 `undefined` 를 돌려주면 호출부에서 조용히 퍼진다.
- **V1 을 쓰지 않았다.** 원문 「8」이 V2 의 선행을 V0 하나로 규정하므로 선언에 없는 의존을 만들지 않았다.
  입력 검증은 손으로 쓰고, 같은 계약을 `schemas/` 에 JSON Schema 로 두었다. 그 스키마는 **저장소 규약 검사가
  V1 로 컴파일**해 강제한다 — 모듈 간 의존을 늘리지 않으면서 스키마를 방치하지 않는 자리다.
- **스냅샷/복원**을 세 자원 모두에 넣었다. K3(event-replay)가 사건 로그의 중간 지점부터 재생할 때 쓴다.

## 규약 검사가 실제로 작동했다

V2 를 만들자마자 `tests/conventions.test.ts` 가 등록 없이 걸렸다 — README 없음, `evidence/latest.json` 없음.
그리고 **검사기의 결함도 하나 드러났다**: Lab 안내 문구 `'Date.now()·new Date() 를 읽지 않으므로…'` 처럼
**문자열 안의 언급**을 위반으로 셌다. 주석만 걷어내던 것을 문자열 리터럴까지 걷어내도록 고치고
(템플릿의 `${...}` 보간은 코드이므로 남긴다), 그 제거기 자체를 검사하는 테스트를 넣었다.

## 게이트 판정 (원문 「5」)

| 게이트 | 상태 | 근거 |
|---|---|---|
| G0 목적 | 통과 | MODULE.yaml `purpose` 한 문장 |
| G1 계약 | 통과 | 입력·출력·소유 상태(`rng_state`·`clock_state`·`id_counters`) 명시 |
| G2 단위 | 통과 | 89건 — 알려진 값 고정 · 범위 · 분포 · 경계 · 거부 |
| G3 속성 | 통과 | 13속성 × 1000 — 재현성·범위·비변경·스냅샷·fork 독립성 |
| G4 직관 | 통과 | Lab V2 탭 7장면 (패널 7 · 콘솔 오류 0). 비교가 핵심인 3장면은 후보 표를 비교표로 특화했다 |
| G5 결정성 | 통과 | 같은 입력 100회 → digest 1개 · 브라우저 20회 재실행 → 해시 1개 |
| G6 통합 | **미충족** | VS0 이 K0~K3 을 요구 |
| G7 회귀 | 통과 | V0·V1 테스트와 증거 그대로 통과 |
| G8 증거 | 통과 | `evidence/latest.json` (dependencyVersions V0=0.1.0) |

## 다음 작업에 넘기는 것

- **V3 scenario-runner** — `runScenario` 와 V0·V1·V2 가 각자 복붙해 갖고 있는 `defineScene` 헬퍼를 흡수한다.
  세 모듈의 헬퍼가 거의 같은 모양이므로 V3 이 가져갈 몫이 분명하다. `ModuleContext` 의 `seed`/`tick` 을
  V2 의 `Rng`/`TickClock` 으로 채우는 것도 V3 의 일이다.
- **V4 evidence-gate** — `tools/verify.mjs` · `tools/lab-shot.mjs` · `tests/conventions.test.ts` 를 흡수한다.
- **K0~K3** — 세계 상태 변경과 사건 로그가 V2 의 시드 조합 규칙을 그대로 쓴다.
  K3(event-replay)는 세 자원의 스냅샷으로 중간 재생을 구현한다.
- V0·V1·V2 의 `VERIFIED` 승격은 VS0 통과 시점.
