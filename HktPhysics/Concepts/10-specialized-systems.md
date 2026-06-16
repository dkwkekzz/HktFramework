# [10] 특화 시스템 (Specialized Systems) — 허브

> 코어 솔버(03~05) 위에 얹어 게임플레이가 직접 요구하는 거동을 만드는 *특화 솔버* 모음 — 캐릭터 이동·차량·액티브 래그돌·부력/공력·파괴.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [10-specialized-systems/](10-specialized-systems/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md)

---

## 1. 위치와 역할

코어 강체 엔진(적분 [03](03-time-integration.md) · 충돌 감지 [04](04-collision-detection.md) · 구속 해법 [05](05-constraint-solving.md))은 "물리적으로 그럴듯한" 거동을 보장하지만, 게임이 원하는 거동은 종종 *물리적으로 부정확해도 통제 가능해야 한다*. 캐릭터는 미끄러지지 않고 계단을 올라야 하고, 차량은 운전 느낌(feel)이 우선이며, 부서지는 벽은 예술가가 의도한 조각으로 깨져야 한다.

특화 시스템은 이 간극을 메운다. 공통 패턴은 두 가지다.

- **코어 위에 얹는 전용 솔버** — character controller, vehicle 처럼 일반 강체 루프 안에 *특수 규칙*(collide-and-slide, 타이어 모델)을 끼워 넣는다.
- **코어 산출물의 게임플레이용 후처리/제어** — active ragdoll(조인트 [06](06-joints-articulation.md) + 모터), destruction(연결 그래프 분리) 처럼 코어 구속 해법의 결과를 제어 신호로 다룬다.

```
[03 적분] · [04 충돌] · [05 구속]  ── 코어 ──┐
                                            ▼
[06 조인트/관절체] ──→ active ragdoll · vehicle wheel constraint
[04 충돌(swept/raycast)] ──→ character controller · raycast vehicle
[08 height-field] ──→ 부력(물 표면)
[11 공간 구조] ──→ destruction island / debris broad-phase
```

> 핵심 원칙: 특화 시스템은 코어를 *대체*하지 않고 *제약/주입*한다. 결정론(determinism, [12](12-determinism-networking.md))을 깨기 가장 쉬운 곳이기도 하다 — 게임플레이 편의를 위해 도입한 raycast·sweep·정렬되지 않은 island 순회가 곧잘 비결정성의 원천이 된다.

---

## 2. 하위 문서 인덱스 (세부 이론)

특화 시스템은 직관 단위로 분할되어 있다. 각 문서는 정의 → 수식 → 알고리즘 → 실무 트레이드오프를 담는다. 차량의 *타이어 마찰*과 파괴의 *Voronoi 분할*은 직관 장벽이 높아 심화(`NNa`) 문서로 한 단계 더 들어간다.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [10-specialized-systems/01-character-controller.md](10-specialized-systems/01-character-controller.md) | 캐릭터 컨트롤러 | kinematic·collide-and-slide·step/slope·ground·moving platform |
| 2.2 | [10-specialized-systems/02-vehicle-dynamics.md](10-specialized-systems/02-vehicle-dynamics.md) | 차량 동역학 | raycast vs full wheel·서스펜션·드라이브트레인 루프 |
| 2.2a | [10-specialized-systems/02a-tire-friction.md](10-specialized-systems/02a-tire-friction.md) | 타이어 마찰 심화 | slip ratio/angle·Pacejka·friction circle·저속 발산 |
| 2.3 | [10-specialized-systems/03-active-ragdoll.md](10-specialized-systems/03-active-ragdoll.md) | 액티브 래그돌 | PD 제어·powered constraint·애니-물리 blend·get-up |
| 2.4 | [10-specialized-systems/04-buoyancy-aerodynamics.md](10-specialized-systems/04-buoyancy-aerodynamics.md) | 부력·공력 | 아르키메데스·부력 중심·항력·양력·wind field |
| 2.5 | [10-specialized-systems/05-destruction-fracture.md](10-specialized-systems/05-destruction-fracture.md) | 파괴·분쇄 | 사전 분할·연결 그래프·island/support·debris |
| 2.5a | [10-specialized-systems/05a-voronoi-fracture.md](10-specialized-systems/05a-voronoi-fracture.md) | Voronoi 분할 심화 | 최근접 셀·수직 이등분면·점 분포·클러스터링 |

---

## 3. 한눈 요약 — 시스템·기법·의존

특화 시스템 각각이 어떤 코어를 빌려 쓰는지 한 표로 모았다. 상세는 각 하위 문서.

| 시스템 | 핵심 기법 | 의존 코어 |
|---|---|---|
| Character controller | collide-and-slide(반복 투영), step/slope, ground sweep, moving platform | [04] swept · [01] 운동학 바디 |
| Vehicle | raycast suspension, Pacejka 타이어, friction circle, drivetrain 루프 | [05] 구속 · [06] 조인트 |
| Active ragdoll | PD/powered drive, 애니메이션-물리 blend, get-up | [06] ragdoll · 조인트 모터 |
| 부력·공력 | 잠긴 부피 샘플링, height-field 샘플, 항력/양력 근사, wind field | [08] height-field · [02] 동역학 |
| Destruction | Voronoi pre-fracture, 연결 그래프, island 분리, debris 컬링 | [11] island · [04] 충돌 |

---

## 4. 실무 (엔진은 무엇을 쓰는가)

- **Jolt — `CharacterVirtual`** : 코어 강체와 분리된 kinematic 캐릭터 컨트롤러. collide-and-slide, step/slope, 무빙 플랫폼, 다른 캐릭터 간 상호작용을 내장. 결정론을 중시하는 모던 구현의 기준선.
- **UE5 Chaos — Character Movement** : UE는 전통적으로 `CharacterMovementComponent`(완전 커스텀 kinematic, 네트워크 예측 내장)를 쓰며, Mover/Chaos 기반 캐릭터로 이행 중.
- **UE5 Chaos Vehicles** : 차량 전용 플러그인. raycast 휠 + Pacejka 계열 타이어 + 엔진/기어/디퍼렌셜 모델. (구) PhysX 시절의 **PhysX Vehicle(`PxVehicle`)** SDK 를 계승한 워크플로.
- **PhysX Vehicle** : NVIDIA PhysX 의 차량 SDK — raycast/sweep 기반 휠, 타이어/서스펜션/드라이브트레인 풀 모델. 다수 상용 엔진의 차량 토대.
- **UE5 Chaos Destruction** : Geometry Collection 에디터로 Voronoi 사전 분할 + 다단계 클러스터링을 베이크, 런타임에 연결 그래프 기반 island 분리로 무너뜨린다.
- **NVIDIA Blast** : 파괴 전용 미들웨어. asset-time 사전 분할(`NvBlastAuthoring`) + runtime 그래프 손상/island 분리(`NvBlast`) + debris/액터 관리(`NvBlastTk`)로 계층화. Chaos 이전 세대 AAA 파괴의 표준.
- **Active ragdoll** : UE 의 **Physical Animation Component**(본별 strength 로 애니메이션 추종) + PhysicsAsset 조인트의 angular drive. Unity 는 `ConfigurableJoint` 의 drive(spring/damper)로 동일 패턴.
- **부력** : 전용 엔진 기능보다 게임별 구현이 일반적 — 물체를 샘플 포인트로 근사해 height-field 물 표면 아래 점에 부력·항력을 가한다(예: UE의 Water 플러그인 + 커스텀 부력 컴포넌트).

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **Raycast/sweep 는 비결정성의 단골**: character/vehicle 의 ground sweep, 휠 ray 가 broad-phase 순회 순서나 부동소수점 차이([00](00-foundations.md))에 민감하다. 결정론([12](12-determinism-networking.md))이 필요하면 질의 순서를 고정하고 fixed timestep 안에서만 수행한다. (`specialized-systems/01-character-controller`, `specialized-systems/02-vehicle-dynamics`)
- **Collide-and-slide 반복 횟수**: 너무 적으면 코너에서 끼이고(stuck), 너무 많으면 비용↑·미세 떨림(jitter). 잔여 속도 epsilon 컷오프를 둬야 무한 진동을 막는다. (`specialized-systems/01-character-controller`)
- **Step offset 의 down-sweep 누락**: up→forward 만 하고 down-sweep 을 빠뜨리면 캐릭터가 공중에 뜨거나 경사에서 튄다. step 시퀀스는 3단을 모두 지켜야 한다. (`specialized-systems/01-character-controller`)
- **무빙 플랫폼 회전**: 위치 delta 만 적용하고 회전 delta 를 빠뜨리면 회전 플랫폼에서 캐릭터가 미끄러진다. 또 플랫폼 적용 시점이 캐릭터 갱신 전/후냐에 따라 한 프레임 어긋남(jitter)이 생긴다. (`specialized-systems/01-character-controller`)
- **타이어 모델 폭주**: 저속에서 `slipRatio`/`slipAngle` 분모(|v|)가 0 에 가까워 힘이 발산한다. 저속 클램프(정지 마찰 별도 처리, |v| 하한)가 필수. friction circle 합성을 안 하면 가속+조향 동시에서 그립이 비현실적으로 커진다. (`specialized-systems/02a-tire-friction`)
- **PD 게인 불안정**: active ragdoll 의 `Kp`/`Kd` 가 timestep 대비 과하면 explicit PD 가 발산한다. powered constraint(implicit drive)로 옮기거나 게인을 substep 에 맞춰 조정한다. 부위별 blend 경계에서 토크가 불연속이면 팝(pop)이 난다. (`specialized-systems/03-active-ragdoll`)
- **부력 안정성**: 잠긴 부피 샘플 수가 적으면 물 표면 부근에서 힘이 계단식으로 튀어 물체가 떨린다. 부력 중심을 무게중심으로 잘못 두면 복원 토크가 사라져 배가 뒤집힌다. 항력 댐핑 없이는 무한히 출렁인다. (`specialized-systems/04-buoyancy-aerodynamics`)
- **파괴의 결정론·비용**: island 재계산이 연결 그래프 순회 순서에 의존하면 비결정적이다(네트워크 동기화 시 클라마다 다른 잔해). 런타임 절단은 특히 비결정적이라 멀티플레이에선 베이크 결과만 동기화하거나 효과를 시각 전용으로 분리한다. debris 폭발은 컬링/강등/sleeping 없이는 프레임을 잡아먹는다. (`specialized-systems/05-destruction-fracture`, `specialized-systems/05a-voronoi-fracture`)

---

## 6. 더 읽기 / 관련 노드

- **선행(필수)**: [05-constraint-solving.md](05-constraint-solving.md) (impulse/PGS/TGS — 차량·래그돌 구속의 기반) · [06-joints-articulation.md](06-joints-articulation.md) (조인트·모터·ragdoll — active ragdoll·full wheel 의 토대)
- **연계**: [01-kinematics.md](01-kinematics.md) (운동학 바디 — kinematic 캐릭터) · [04-collision-detection.md](04-collision-detection.md) (swept/raycast — collide-and-slide·휠 ray) · [08-fluids.md](08-fluids.md) (height-field — 부력 물 표면) · [09-particles.md](09-particles.md) (debris 강등·바람) · [11-spatial-structures.md](11-spatial-structures.md) (island·broad-phase) · [12-determinism-networking.md](12-determinism-networking.md) (raycast/island 비결정성) · [13-performance-parallelism.md](13-performance-parallelism.md) (sleeping·island·debris 컬링)
- **형제 문서 전체**: [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) · **[10-specialized-systems.md](10-specialized-systems.md)** · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · [13-performance-parallelism.md](13-performance-parallelism.md)
