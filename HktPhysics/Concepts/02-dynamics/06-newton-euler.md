# [02·2.6] Newton–Euler 방정식 — 강체 6DOF (Newton–Euler Equations)

> 질점 두 법칙을 강체(병진 3 + 회전 3 = 6자유도)로 확장한 한 쌍의 운동방정식. 그리고 선형에는 없는 회전 고유의 비선형 항 — 자이로스코픽 항 `ω×(I·ω)` 와 그것이 만드는 세차·중간축 정리.
> **상위 노드**: [02-dynamics.md](../02-dynamics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-newton-laws](01-newton-laws.md), [02-torque](02-torque.md), [04-inertia-tensor](04-inertia-tensor.md), [05-mass-properties](05-mass-properties.md)

---

질점 두 법칙을 강체(6자유도: 병진 3 + 회전 3)로 확장한 한 쌍의 방정식이 **Newton–Euler equations** 다.

```
병진 (Newton):   F_total = m · a_cm
회전 (Euler):    τ_total = I·α + ω × (I·ω)
```

- 위쪽(Newton)은 **무게중심(center of mass)** 의 가속도에 대한 식이다. 강체에 어떤 힘이 어디에 걸리든, 그 합력은 무게중심을 단순 질점처럼 가속시킨다. *어디에 거는가*는 회전(아래 식)으로만 영향을 준다([02-torque](02-torque.md)).
- 아래쪽(Euler)에서 `α` 는 각가속도, `I` 는 (보통 world frame) 관성텐서다([04-inertia-tensor](04-inertia-tensor.md)).

## 자이로스코픽 항 (gyroscopic term) ω × (I·ω)

Euler 식의 두 번째 항 `ω × (I·ω)` 가 선형에는 없는 회전 고유의 비선형 항이다. 의미:

- `I·ω = L`(각운동량)이므로 이 항은 `ω × L` 이다. `ω` 와 `L` 이 평행하지 않을 때만(즉 비대칭으로 회전할 때만) 0 이 아니다 — 왜 둘이 어긋나는가는 [04a 심화 §2](04a-inertia-tensor-geometric.md).
- 토크가 전혀 없어도(`τ=0`) 이 항 때문에 각속도 방향이 변할 수 있다 — **자유 세차운동(free precession)**, 던진 스마트폰이 중간 축으로 돌면 뒤집히는 **테니스 라켓 정리(중간축 정리)** 가 이 항의 결과다.
- 풀어 쓰면(world frame): `α = invI · (τ − ω × (I·ω))`. 이게 적분기가 매 스텝 계산하는 각가속도다.

> **결정론·안정성 주의**: 자이로스코픽 항은 explicit Euler 에서 **에너지를 만들어내며 발산**하기 쉽다. 많은 게임 엔진은 이 항을 *아예 생략*하거나(빠른 자전 물체가 드물어 시각적으로 무해), implicit 하게 처리한다. 예컨대 PhysX·Bullet 은 옵션 플래그로만 켠다. 생략 여부가 결과를 바꾸므로 **네트워크 동기화 대상이면 양쪽이 같은 선택을 해야 한다**([12-determinism-networking](../12-determinism-networking.md)).

## body frame 형태 (Euler's equations)

`I` 가 body 에 상수인 점을 이용해, 주축 body frame 에서 성분별로 풀면 고전적 오일러 방정식이 된다:

```
τ1 = I1·ω̇1 + (I3 − I2)·ω2·ω3
τ2 = I2·ω̇2 + (I1 − I3)·ω3·ω1
τ3 = I3·ω̇3 + (I2 − I1)·ω1·ω2
```

`(Ii − Ij)·ωⱼ·ωₖ` 항이 자이로스코픽 결합이다. world frame 의 `ω × (I·ω)` 와 동일한 내용이며, body frame 은 `I` 가 상수라 해석에 편하지만 게임 엔진은 보통 world frame 으로 푼다(상태가 world 에 있으므로).

---

**관련 함정** (전체 체크리스트는 [02-dynamics §5](../02-dynamics.md#5-함정--결정론-체크리스트)):
- **자이로스코픽 항의 발산**: explicit Euler 에서 `ω×(I·ω)` 는 에너지를 만들어 발산하기 쉽다. 켤 거면 implicit 처리하거나 작은 dt. 켜고/끄는 선택이 **결정론 분기**다([12]).
- **각도 좌표/사원수 정규화 누락**: 회전 적분 후 사원수를 정규화하지 않으면 스케일 드리프트로 관성/토크가 왜곡된다([01-kinematics](../01-kinematics.md)).

**다음**: [07-energy](07-energy.md) — 운동방정식과 별개로 시뮬레이션 정확성을 검증하는 잣대.
