# [01·2.3] 강체 한 점의 속도 — v = v_cm + ω × r (Rigid Body Point Velocity)

> 강체의 모든 점은 같은 `ω` 로 회전하지만 선속도는 위치마다 다르다. 운동학에서 가장 많이 쓰이는 공식이자 충돌·조인트 솔버의 입력.
> **상위 노드**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) (외적) · [02-angular-motion.md](02-angular-motion.md)

---

강체(rigid body)의 모든 점은 같은 `ω` 로 회전하지만, 각 점의 *선속도* 는 회전 중심으로부터의 위치에 따라 다르다. 이것이 운동학에서 가장 많이 쓰이는 공식이다:

```
v_P = v_cm + ω × r          ( r = P − x_cm, 질량중심에서 점 P 로의 벡터 )
```

- `v_cm`: 질량중심(center of mass)의 병진 속도.
- `ω × r`: 회전이 점 P 에 더하는 접선 속도. 외적이므로 `r` 에 수직이고 크기는 `|ω||r|sinφ`.

직관: 병진(`v_cm`) 위에 회전이 얹은 "바람개비" 성분(`ω × r`)을 더한 것. 회전축 위의 점(`r ∥ ω`)은 회전 기여가 0이고, 축에서 멀수록 접선 속도가 커진다.

## 가속도 버전 — 구심항과 오일러항

점 P 의 가속도는 한 단계 더 미분해 얻으며, **구심항(centripetal)** 과 **오일러(접선)항** 이 나온다:

```
a_P = a_cm + α × r + ω × (ω × r)
                ↑           ↑
            오일러항(접선)  구심항(centripetal, 안쪽으로)
```

- `α × r` (오일러항): 각가속도가 만드는 접선 가속도.
- `ω × (ω × r)` (구심항): 회전축 안쪽을 향하며, 등속 회전에서도 사라지지 않는다(`= −|ω|² r⊥`).

## 왜 솔버가 이 식을 쓰는가

이 공식은 충돌·조인트 솔버에서 **접촉점의 상대 속도** 를 구할 때 핵심이다. [05-constraint-solving.md](../05-constraint-solving.md) 구속 해법은 이 `v = v_cm + ω × r` 를 자코비안(Jacobian)으로 선형화해 임펄스를 푼다 — 즉 "한 점의 속도가 강체 상태 `(v, ω)` 에 어떻게 선형 의존하는가" 가 곧 자코비안 행이다.

### 상대 속도 (두 강체 사이의 접촉점)

```
v_rel = (v_A + ω_A × r_A) − (v_B + ω_B × r_B)
```

법선 방향 성분 `v_rel · n̂` 이 양수면 분리(separating), 음수면 침투(approaching) 중 — restitution(반발)·friction(마찰) 계산의 입력이다([05-constraint-solving.md](../05-constraint-solving.md)). (프레임 A·B 자체의 상대 운동은 [06-relative-motion.md](06-relative-motion.md) 에서 본다.)

---

**관련 함정** (전체 체크리스트는 [01-kinematics §5](../01-kinematics.md#5-함정--결정론-체크리스트)):
- **외적 순서/부호**: `ω × r` 와 `r × ω` 는 부호가 반대. `r` 은 *질량중심→점* 방향으로 일관되게 잡을 것.
- **연산 순서 / FMA**: `ω × r` 의 부동소수점 누적 순서가 플랫폼마다 다르면 결과가 갈린다([12-determinism-networking.md](../12-determinism-networking.md)).

**다음**: [04-rotation-derivative.md](04-rotation-derivative.md) — `ω` 로 *자세 자체* 를 시간 전진시키는 미분 규칙.
