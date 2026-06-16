# [00·2.5] 수치해석 · 부동소수점 (Numerical Analysis & Floating-Point)

> 결정론([12](../12-determinism-networking.md))과 안정성의 근본 제약. IEEE754 를 모르면 lockstep 도 떨림 제거도 불가능하다.
> **상위 노드**: [00-foundations.md](../00-foundations.md) · **상위 지도**: [README.md](../README.md) · **의존**: (기반)

---

게임 물리는 실수를 **부동소수점(floating-point)** 으로 근사한다. 이 근사의 성질을 모르면 결정론([12](../12-determinism-networking.md))도 안정성도 얻을 수 없다.

**IEEE 754** — 표준 부동소수점 표현. `값 = (-1)^sign * (1.mantissa) * 2^exponent`.

| 타입 | 비트 | 가수(mantissa) | 유효 십진 자리 | 비고 |
|---|---|---|---|---|
| float (단정밀, single) | 32 | 23 | 약 7자리 | 게임 물리 기본 |
| double (배정밀) | 64 | 52 | 약 15-16자리 | 큰 좌표/정밀 적분 |

핵심 함의:
- **상대 정밀도(machine epsilon)**: float 은 `eps ≈ 1.19e-7`, double 은 `≈ 2.22e-16`. 표현 가능한 두 인접 값의 간격(ULP, Unit in the Last Place)은 **값의 크기에 비례**한다.
- 따라서 좌표가 커질수록 정밀도가 *떨어진다*. 원점에서 1m 떨어진 곳의 정밀도와 100km 떨어진 곳의 정밀도가 다르다 → 멀리 가면 물체가 떨리는(jitter) 근본 원인. 해법: 월드 원점 리베이싱(origin rebasing), tile/sector 좌표계, double 사용.

**반올림(rounding)과 결합/교환 법칙 깨짐**: 부동소수점 덧셈은 **결합법칙이 성립하지 않는다**.

```
(a + b) + c   !=   a + (b + c)      // 일반적으로
```

→ 합산 순서가 바뀌면 결과 비트가 달라진다. 멀티스레드에서 부분합을 합치는 순서가 비결정적이면 결과가 갈라진다 → 결정론 붕괴([12](../12-determinism-networking.md), [13](../13-performance-parallelism.md)).

**상쇄 (catastrophic cancellation)**: 비슷한 크기의 두 수를 빼면 유효숫자가 대량 손실된다.

```
a = 1.0000001, b = 1.0000000  →  a - b = 0.0000001
앞쪽 유효숫자가 모두 약분되어, 결과는 b의 마지막 1~2비트의 오차에 지배된다.
```

예: 이차방정식 근의 공식에서 `-b + sqrt(b^2 - 4ac)` 가 상쇄에 취약 → 수치적으로 안정한 변형 사용. 두 큰 위치의 차로 작은 변위를 구할 때도 동일 위험.

**조건수 (condition number)**: 입력의 작은 변화가 출력을 얼마나 증폭하는가. 조건수가 큰(ill-conditioned) 행렬을 푸는 제약/조인트 솔버([05](../05-constraint-solving.md))는 작은 입력 오차가 폭발한다 → 질량비(mass ratio)가 극단적이거나 거의 특이(near-singular)한 야코비안에서 발생.

**epsilon 비교 (안전한 실수 비교)**: `==` 로 부동소수점을 비교하지 말 것.

```
// 절대 오차(absolute)
fabs(a - b) <= EPS

// 상대 오차(relative) — 큰 값에 적합
fabs(a - b) <= EPS * max(fabs(a), fabs(b))

// 혼합(실무 권장)
fabs(a - b) <= EPS_ABS + EPS_REL * max(fabs(a), fabs(b))
```

크기에 따라 적절한 방식을 골라야 한다. 영(zero) 근처 비교는 절대 오차, 큰 값 비교는 상대 오차.

**누적 오차 (error accumulation)**: 매 틱 작은 오차가 더해진다. 정규화를 안 하면 사원수가 단위 구면을 벗어나고, 회전 행렬은 직교성을 잃는다. → 주기적 재투영([03-rotations](03-rotations.md)의 정규화)으로 막는다. 적분 오차의 누적은 에너지 드리프트(energy drift)로 나타난다([03](../03-time-integration.md)의 심플렉틱 적분기로 완화).

**fast inverse square root (역사적 실무 트릭)**: 과거 Quake III 의 그 유명한 비트 해킹.

```
i = 0x5f3759df - (i >> 1);   // 비트 패턴으로 초기 추정
y = y * (1.5f - 0.5f*x*y*y); // 뉴턴-랩슨 1회 보정
```

오늘날에는 하드웨어 `rsqrtss`(SSE)/SIMD 명령이 더 빠르고 정확하므로 **교육적 의미** 위주다. 핵심 교훈은 "정확도와 속도를 트레이드(근사 후 뉴턴 1~2회 보정)" 라는 사고방식 — 정규화·거리 계산에서 여전히 유효하다.

---

**관련 함정** (전체 체크리스트는 [00-foundations §5](../00-foundations.md#5-공통-함정--결정론-체크리스트)):
- **부동소수점 `==` 비교** / **상쇄** / **결합법칙 의존** / **크로스플랫폼 부동소수점 차이** / **`-ffast-math` 위험** / **큰 월드 떨림** — 모두 이 절의 직접 귀결. 결정론이 필요하면 연산 순서 고정 또는 fixed-point([12](../12-determinism-networking.md)).

**다음**: [06-identities-approximations](06-identities-approximations.md) — 위 한계를 다루는 실무 항등식·근사.
