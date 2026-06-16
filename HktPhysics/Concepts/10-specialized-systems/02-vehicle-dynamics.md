# [10·2.2] 차량 동역학 (Vehicle Dynamics)

> 차체(chassis) 강체 하나에 바퀴 4개의 힘을 합산해 구동하는 솔버 — 바퀴 모델링(raycast vs full body), 서스펜션 스프링-댐퍼, 엔진→기어→드라이브트레인 토크 루프. 운전 느낌의 핵심인 *타이어 마찰*은 별도 심화로.
> **상위 노드**: [10-specialized-systems.md](../10-specialized-systems.md) · **상위 지도**: [README.md](../README.md) · **의존**: [05-constraint-solving](../05-constraint-solving.md) (구속) · [06-joints-articulation](../06-joints-articulation.md) (조인트)

---

차량은 차체(chassis) 강체 하나에 바퀴 4개가 만드는 힘(서스펜션·타이어)을 합산해 구동한다. 운전 "느낌(feel)"이 물리 정확도보다 우선이라, 게임 차량은 *해석적 근사*와 튜닝 가능한 계수에 크게 의존한다.

## 바퀴 모델링 — 두 갈래

- **Raycast vehicle(레이캐스트 차량)** — 바퀴를 실제 충돌체로 두지 않고, 차체에서 각 바퀴 위치 아래로 *ray 를 쏴* 지면까지 거리로 서스펜션 압축량을 구한다. 가볍고 안정적이며 대부분의 게임 차량이 채택(원조: Bullet `btRaycastVehicle`).
- **Full rigid-body wheel(완전 강체 바퀴)** — 각 바퀴를 별도 강체로 두고 hinge/suspension 조인트([06](../06-joints-articulation.md))로 차체에 연결, 실제 회전·접촉을 시뮬레이션한다. 사실적이지만 비싸고 튜닝이 어렵다.

게임 대부분은 raycast 휠을 기본으로 한다 — 안정성·성능·튜닝 용이성 모두 우세하기 때문.

## 서스펜션 (Suspension)

각 바퀴는 스프링-댐퍼로 차체를 떠받친다. raycast 차량에서는 ray 길이로 압축량을 얻고 차체에 위 방향 힘을 가한다.

```
Fsuspension = k * (restLength - rayDistance) - c * compressionVelocity   # 스프링 - 댐퍼
# k: 스프링 강성, c: 댐핑 계수
```

`restLength - rayDistance` 가 압축량(스프링이 줄어든 정도), `compressionVelocity` 는 압축 속도다. 스프링 항이 차체를 들어올리고 댐퍼 항이 출렁임을 잡는다. 이 힘은 바퀴 접점에서 차체에 가해지므로 무게 이동(weight transfer) — 가속 시 뒤가 가라앉고 제동 시 앞이 가라앉는 — 도 자연히 따라 나온다.

## 타이어 모델 — 운전 느낌의 90%

차량 운전 느낌의 대부분은 타이어가 만든다. 핵심은 **슬립(slip)이 마찰력을 만든다**는 점 — 바퀴와 노면의 속도 불일치가 추진·제동·코너링 힘으로 변환된다. 슬립 비율/슬립각의 정의, 그 비선형 곡선(Pacejka magic formula), 그리고 종·횡 마찰을 한 예산으로 묶는 friction circle 은 직관 장벽이 높아 별도 문서로 깊이 다룬다.

> 📐 **타이어 마찰 심화**: "왜 슬립이 곧 힘인가 · slip ratio/angle 의 정의 · Pacejka 곡선의 모양과 4계수 · friction circle 로 종/횡 그립이 한 예산을 나눠 쓰는 이유 · 저속 발산 처리"를 모은 전용 문서 → [02a-tire-friction.md](02a-tire-friction.md).

## 엔진 / 기어 / 드라이브트레인 (Engine / Gear / Drivetrain)

- 엔진 토크 곡선(RPM → torque), 기어비, 디퍼렌셜을 거쳐 구동축 바퀴에 토크를 전달한다.

  ```
  wheelTorque = engineTorque * gearRatio * finalDriveRatio * efficiency
  ```

- 바퀴 각가속도는 구동 토크와 노면 반작용(타이어 종방향 힘 × 반경)의 차로 적분한다. RPM 은 다시 구동 바퀴 회전수로부터 역산해 **피드백 루프를 닫는다** — 엔진이 바퀴를 돌리고, 바퀴가 노면에서 받는 반작용이 다시 엔진 RPM 을 결정한다. 이 닫힌 루프가 가속의 묵직함과 헛바퀴(휠스핀)를 만든다.

## 실무

- **UE5 Chaos Vehicles** : 차량 전용 플러그인. raycast 휠 + Pacejka 계열 타이어 + 엔진/기어/디퍼렌셜 모델. (구) PhysX 시절의 **PhysX Vehicle(`PxVehicle`)** SDK 를 계승한 워크플로.
- **PhysX Vehicle** : NVIDIA PhysX 의 차량 SDK — raycast/sweep 기반 휠, 타이어/서스펜션/드라이브트레인 풀 모델. 다수 상용 엔진의 차량 토대.

---

**관련 함정** (전체 체크리스트는 [10-specialized-systems §5](../10-specialized-systems.md#5-함정--결정론-체크리스트)):
- **타이어 모델 폭주**: 저속에서 `slipRatio`/`slipAngle` 분모(|v|)가 0 에 가까워 힘이 발산 → 저속 클램프 필수(상세 [02a-tire-friction](02a-tire-friction.md)).
- **friction circle 누락**: 가속+조향 동시 그립이 비현실적으로 커진다 → 종/횡 합성 필요(상세 [02a-tire-friction](02a-tire-friction.md)).
- **Raycast 휠 비결정성**: 휠 ray 가 broad-phase 순회·부동소수점에 민감 → 질의 순서 고정, fixed timestep ([12](../12-determinism-networking.md)).

**다음**: [02a-tire-friction](02a-tire-friction.md) — 슬립이 힘이 되는 원리와 Pacejka 곡선.
