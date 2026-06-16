# [10·2.3] 액티브 래그돌 / 피지컬 애니메이션 (Active Ragdoll / Physical Animation)

> 수동 래그돌에 *모터를 달아* 애니메이션을 물리적으로 추종하게 하는 시스템 — 충격에 반응해 흔들리지만 다시 자세를 잡는다. PD 제어, powered constraint, 애니메이션-물리 블렌딩/일어서기.
> **상위 노드**: [10-specialized-systems.md](../10-specialized-systems.md) · **상위 지도**: [README.md](../README.md) · **의존**: [06-joints-articulation](../06-joints-articulation.md) (ragdoll·조인트 모터)

---

수동(passive) 래그돌([06](../06-joints-articulation.md))은 관절을 늘어뜨려 "기절·사망" 거동만 만든다. **액티브 래그돌**은 동일한 ragdoll 골격에 *모터를 달아* 애니메이션을 물리적으로 추종하게 한다 — 충격에 반응하며 흔들리지만 다시 자세를 잡는다. 피격 반응, 비틀거림, 자연스러운 균형 회복이 여기서 나온다.

## PD 제어로 애니메이션 추종

각 관절이 목표 애니메이션 포즈를 향하도록 토크를 만든다. 비례-미분(Proportional-Derivative) 제어다.

```
τjoint = Kp * (θtarget - θcurrent) + Kd * (ω̇target - ωcurrent)
# Kp: 강성(자세를 얼마나 강하게 잡는가)
# Kd: 댐핑(흔들림 억제)
```

- **`Kp`(비례항)**: 현재 각도와 목표 각도의 차이에 비례하는 복원 토크 — 자세를 목표로 끌어당기는 스프링.
- **`Kd`(미분항)**: 각속도 차이에 비례하는 감쇠 토크 — 진동을 잡는 댐퍼.

직관적으로 각 관절에 "목표 자세를 향하는 스프링-댐퍼"를 단 것이다. 충격을 받으면 스프링이 늘어나 흔들리고, 곧 복원 토크가 자세를 되돌린다.

## Powered constraint (구동 구속) / drive

위 PD 토크를 *명시적(explicit)* 으로 매 프레임 계산해 가하면 게인이 클 때 발산하기 쉽다([05](../05-constraint-solving.md) 의 explicit 적분 불안정과 같은 문제). 그래서 엔진은 조인트 모터(angular drive)에 목표 회전과 강성/댐핑(spring/damping)을 주는 **powered constraint** 방식을 쓴다 — PD 제어를 솔버 구속(implicit drive)으로 구현한 것이라 안정성이 훨씬 좋다. 같은 의도(목표 포즈로 끌어당김)를 솔버가 암시적으로 풀어 큰 게인에서도 폭주하지 않는다.

## 블렌딩 / 일어서기 (Blending / get-up)

키네마틱 애니메이션과 물리 시뮬레이션 결과를 가중 혼합(blend weight)한다.

- 평소엔 **애니메이션 우세**(blend weight 높음) — 깔끔한 모션.
- 피격 시 **물리 우세**로 전환 — 충격 방향으로 비틀거리고 흔들린다.
- 다시 애니메이션 우세로 끌어올려 *일어서기(get-up)* 를 연출한다.

부위별 blend(상체만 물리, 하체는 애니메이션 유지)도 흔하다 — 달리면서 상체만 총격에 반응하는 식. blend 경계에서 토크가 불연속이면 팝(pop)이 나므로 가중치를 부드럽게 보간해야 한다.

## 실무

- **UE — Physical Animation Component** : 본별 strength 로 애니메이션을 추종하고, PhysicsAsset 조인트의 angular drive 로 powered constraint 를 건다.
- **Unity** : `ConfigurableJoint` 의 drive(spring/damper)로 동일 패턴을 구현한다.

---

**관련 함정** (전체 체크리스트는 [10-specialized-systems §5](../10-specialized-systems.md#5-함정--결정론-체크리스트)):
- **PD 게인 불안정**: `Kp`/`Kd` 가 timestep 대비 과하면 explicit PD 가 발산 → powered constraint(implicit drive)로 옮기거나 게인을 substep 에 맞춰 조정.
- **blend 경계 팝**: 부위별/상태별 blend 경계에서 토크가 불연속이면 pop → 가중치를 부드럽게 보간.

**다음**: [04-buoyancy-aerodynamics](04-buoyancy-aerodynamics.md) — 물·공기가 물체에 가하는 힘의 해석적 근사.
