# [00·2.6] 자주 쓰는 항등식 · 근사 (Identities & Approximations)

> 선형화·보간·수치 폭주 방지에 쓰는 실무 상비약. 위 다섯 절을 코드로 옮길 때 반복 등장한다.
> **상위 노드**: [00-foundations.md](../00-foundations.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-rotations](03-rotations.md) · [05-numerical-floating-point](05-numerical-floating-point.md)

---

**소각 근사 (small-angle approximation)** — `theta` 가 작을 때(라디안):

```
sin(theta) ≈ theta
cos(theta) ≈ 1 - theta^2/2  ≈ 1
tan(theta) ≈ theta
```

각속도 적분, 작은 회전 합성, 안정성 분석에서 선형화(linearization)에 쓴다.

**작은 회전의 사원수**: `omega*dt` 가 작을 때 자세 적분 근사

```
dq ≈ (1, 0.5 * omega * dt)     // 그 후 정규화
q_new = normalize( dq * q )
```

(정식 유도와 다양한 적분 방식은 [03-time-integration](../03-time-integration.md).)

**선형 보간(lerp) 후 정규화 = NLERP**: SLERP 가 비싸거나 각이 작을 때.

```
q = normalize( (1-t)*q1 + t*q2 )     // 단, q1.q2 < 0 이면 q2 부호 반전
```

**클램프(clamp)·포화(saturate)**: 수치 폭주 방지.

```
clamp(x, lo, hi) = max(lo, min(hi, x))
```

`acos` 입력은 반올림으로 `[-1,1]` 을 살짝 벗어날 수 있어 **반드시 clamp** 후 호출(아니면 NaN).

**제곱근 회피**: 비교/임계는 제곱 길이로, 정규화는 `inv_len = rsqrt(len2)` 로([05-numerical-floating-point](05-numerical-floating-point.md)의 fast inverse sqrt 참조).

---

**이전 절**: [05-numerical-floating-point](05-numerical-floating-point.md) · **허브로**: [00-foundations.md](../00-foundations.md)
