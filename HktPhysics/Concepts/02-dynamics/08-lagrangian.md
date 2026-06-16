# [02·2.8] Lagrangian / Hamiltonian 역학 (개념 다리) (Lagrangian / Hamiltonian Mechanics)

> 힘·벡터로 운동을 기술하는 뉴턴역학과 달리, 에너지(스칼라)와 일반화 좌표로 같은 운동을 기술하는 틀. 게임에서 직접 풀 일은 드물지만 — 축소 좌표 관절체([06])와 심플렉틱 적분기([03])로 이어지는 **개념적 다리**라서 중요하다.
> **상위 노드**: [02-dynamics.md](../02-dynamics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [07-energy](07-energy.md)

---

뉴턴역학이 힘·벡터로 운동을 기술한다면, **라그랑주 역학**은 에너지(스칼라)와 **일반화 좌표(generalized coordinates) q** 로 같은 운동을 기술한다.

```
라그랑지안:  L = KE − PE
오일러–라그랑주 방정식:  d/dt (∂L/∂q̇) − ∂L/∂q = Q   (Q = 일반화 힘)

해밀토니안:  H = KE + PE  (보존계에선 총에너지),  정준방정식 q̇ = ∂H/∂p, ṗ = −∂H/∂q
```

게임 물리에서 직접 라그랑지안을 푸는 일은 드물지만, **개념적 다리**가 중요하다.

## 일반화 좌표 = 구속을 좌표에 흡수

핵심 발상은 **일반화 좌표로 구속을 좌표 정의에 녹이는 것**이다. 핀으로 연결된 진자는 데카르트 3DOF 대신 각도 1DOF 면 충분 — 구속이 좌표 정의에 흡수돼 "구속력"을 따로 풀 필요가 없어진다. 데카르트 좌표로 풀면 "막대 길이 일정"을 매 스텝 구속으로 강제해야 하지만, 각도 하나로 매개변수화하면 그 구속이 *애초에 위반될 수 없다*.

## 두 갈래로의 다리

- 이 발상이 곧 **축소 좌표(reduced-coordinate) 관절체** — 관절 각도만으로 트리 구조를 푸는 **Featherstone / Articulated Body Algorithm**([06-joints-articulation](../06-joints-articulation.md))으로 이어진다.
- 반대로 데카르트 좌표 + 구속 솔버는 **최대 좌표(maximal-coordinate)** 접근이며 충격량 솔버([05-constraint-solving](../05-constraint-solving.md))의 영역이다. 두 접근의 트레이드오프(정확/안정 vs 일반/병렬)가 엔진 설계의 큰 갈림길이다.

## 해밀토니안 → 심플렉틱 적분기

해밀토니안 형식은 **심플렉틱 적분기(symplectic integrator)** 의 이론적 토대다 — 위상공간(phase space) 부피를 보존해 장기 에너지 드리프트가 작다([07-energy](07-energy.md)의 에너지 잣대로 드러나는 성질). 게임이 symplectic Euler/Verlet 을 선호하는 근거가 여기 있다([03-time-integration](../03-time-integration.md)).

---

**관련 함정** (전체 체크리스트는 [02-dynamics §5](../02-dynamics.md#5-함정--결정론-체크리스트)):
- 이 절은 개념 다리라 직접적 수치 함정은 적다. 다만 축소 좌표(관절체)와 최대 좌표(구속 솔버)는 결정론·성능 특성이 달라, 어느 쪽을 쓰는지가 [05]/[06]/[12] 의 선택에 영향을 준다.

**다음**: 동역학 분기는 여기서 [03-time-integration](../03-time-integration.md)(적분기)으로 인계된다 — 허브의 [§2.8 적분으로의 인계](../02-dynamics.md#2-하위-문서-인덱스-세부-이론) 참조.
