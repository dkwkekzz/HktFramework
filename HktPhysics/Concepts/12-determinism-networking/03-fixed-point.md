# [12·2.3] Fixed-point 산술 (Fixed-point Arithmetic)

> 부동소수점의 크로스플랫폼 골칫거리를 *원천 제거*하는 길 — 정수만으로 시뮬레이션한다. 정수 산술은 모든 플랫폼에서 똑같다.
> **상위 노드**: [12-determinism-networking.md](../12-determinism-networking.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations](../00-foundations.md) · [02-float-enemies](02-float-enemies.md)

---

[02-float-enemies](02-float-enemies.md) 와 [02a-why-float-diverges](02a-why-float-diverges.md) 가 보였듯, 크로스플랫폼 bit-exact 의 마지막 벽(초월함수 ULP·FMA 가용성)은 컴파일 플래그로 못 넘는다. 이 벽을 *근본부터* 없애는 방법은 부동소수점을 아예 쓰지 않는 것이다 — **정수 산술은 모든 IEEE 무관 플랫폼에서 동일하게 정의**된다. 정수 덧셈·뺄셈·곱셈에는 반올림 모드도, 80bit 확장도, FMA 융합 선택도 없다.

## Q-포맷 고정소수점

`Q16.16` 은 32비트 정수를 정수부 16비트·소수부 16비트로 해석한다 (값 = `raw / 2¹⁶`). 즉 정수 `65536` 이 실수 `1.0` 을 뜻한다.

```c
typedef int32_t fixed;            // Q16.16
const int SHIFT = 16;

fixed add(fixed a, fixed b) { return a + b; }            // 정수 덧셈 그대로
fixed mul(fixed a, fixed b) {
    return (fixed)(((int64_t)a * b) >> SHIFT);            // 64bit 로 올려 곱한 뒤 시프트
}
fixed div(fixed a, fixed b) {
    return (fixed)(((int64_t)a << SHIFT) / b);
}
// sqrt/sin/cos 는 정수 알고리즘 또는 룩업테이블로 — 모든 플랫폼 동일 결과
```

곱셈에서 `int64_t` 승격이 핵심이다. `Q16.16 × Q16.16` 의 참값은 소수부 32비트(`Q32.32`)라 32비트 안에 안 들어간다 → 64비트로 올려 곱한 뒤 `>> SHIFT` 로 다시 `Q16.16` 으로 내린다. 이 승격을 빠뜨리면 오버플로로 조용히 틀린 값이 나온다.

## 트레이드오프

| 장점 | 단점 |
|---|---|
| **완전한 cross-platform bit-exact** | 동적 범위(dynamic range)가 좁다 — overflow/underflow 직접 관리 |
| float 함정(FMA/x87/fast-math) 전부 무관 | 정밀도가 비트 위치에 고정 — 큰 값·작은 값 동시 표현 약함 |
| 검증·해시 비교가 단순 | 곱셈마다 64bit 승격·시프트 → 비용·구현 복잡도 |
| 결정론 보장이 "공짜"에 가까움 | 라이브러리 생태계 빈약 — sqrt/삼각/벡터 전부 자작 |

직관: float 은 지수부가 소수점을 "떠다니게(floating)" 해 큰 값과 작은 값을 한 타입으로 다룬다. fixed-point 는 소수점을 **고정**해 그 유연성을 포기하는 대신, 모든 연산을 결정적 정수 연산으로 환원한다. 결정론을 정밀도·동적 범위와 맞바꾸는 셈.

## 어디까지 필요한가 — 타깃 결정론 등급에 따라

[01-determinism](01-determinism.md) 의 등급 표가 그대로 판단 기준이다.

- **크로스플레이·이종 하드웨어 lockstep** (모바일+PC RTS, 콘솔 크로스플레이) → fixed-point 가 사실상 유일하게 견고한 답 (예: Photon Quantum).
- **단일 플랫폼 롤백** (콘솔 격투) → 같은 바이너리면 float 으로도 same-binary bit-exact 달성 가능. fixed-point 불필요.
- **서버 권위 + 상태 복제** → 결정론 요건 자체가 느슨. float 그대로.

> 요컨대 fixed-point 는 "크로스플랫폼 bit-exact"라는 가장 빡센 등급을 위한 무거운 무기다. 등급이 낮으면 비용만 치르고 이득이 없다 — 목표 등급을 먼저 정하라.

---

**관련 함정** (전체 체크리스트는 [12-determinism-networking §5](../12-determinism-networking.md#5-함정--결정론-체크리스트)):
- **곱셈 오버플로** — `mul` 에서 `int64_t` 승격을 빠뜨리면 조용히 틀린다. 항상 넓은 타입으로 올려 곱하고 시프트.
- **동적 범위 초과** — 큰 좌표·작은 변위를 한 Q-포맷에 담으면 정밀도가 폭락하거나 오버플로. 범위를 직접 설계.
- **등급 과잉** — same-binary 면 충분한데 fixed-point 를 도입하면 비용만 든다.

**다음**: [04-deterministic-sim-requirements](04-deterministic-sim-requirements.md) — 부동소수점이든 정수든, 코어 루프에 거는 결정론 요건.
