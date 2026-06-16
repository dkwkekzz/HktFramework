# [10] 특화 시스템 (Specialized Systems)

> 코어 솔버(03~05) 위에 얹어 게임플레이가 직접 요구하는 거동을 만드는 *특화 솔버* 모음 — 캐릭터 이동(character controller), 차량(vehicle), 액티브 래그돌(active ragdoll), 부력·공력(buoyancy/aerodynamics), 파괴(destruction/fracture).
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md)

---

## 1. 위치와 역할

코어 강체 엔진(적분 [03] · 충돌 감지 [04] · 구속 해법 [05])은 "물리적으로 그럴듯한" 거동을 보장하지만, 게임이 원하는 거동은 종종 *물리적으로 부정확해도 통제 가능해야 한다*. 캐릭터는 미끄러지지 않고 계단을 올라야 하고, 차량은 운전 느낌(feel)이 우선이며, 부서지는 벽은 예술가가 의도한 조각으로 깨져야 한다.

특화 시스템은 이 간극을 메운다. 공통 패턴은 두 가지다.

- **코어 위에 얹는 전용 솔버** — character controller, vehicle 처럼 일반 강체 루프 안에 *특수 규칙*(collide-and-slide, 타이어 모델)을 끼워 넣는다.
- **코어 산출물의 게임플레이용 후처리/제어** — active ragdoll(조인트 [06] + 모터), destruction(연결 그래프 분리) 처럼 코어 구속 해법의 결과를 제어 신호로 다룬다.

```
[03 적분] · [04 충돌] · [05 구속]  ── 코어 ──┐
                                            ▼
[06 조인트/관절체] ──→ active ragdoll · vehicle wheel constraint
[04 충돌(swept/raycast)] ──→ character controller · raycast vehicle
[08 height-field] ──→ 부력(물 표면)
[11 공간 구조] ──→ destruction island / debris broad-phase
```

> 핵심 원칙: 특화 시스템은 코어를 *대체*하지 않고 *제약/주입*한다. 결정론(determinism, [12])을 깨기 가장 쉬운 곳이기도 하다 — 게임플레이 편의를 위해 도입한 raycast·sweep·정렬되지 않은 island 순회가 곧잘 비결정성의 원천이 된다.

---

## 2. 핵심 이론

### 2.1 Character Controller (캐릭터 컨트롤러)

플레이어/NPC 캐릭터는 "현실적인 강체"보다 "반응성 좋은 게임플레이 객체"를 원한다. 두 가지 구현 철학이 있다.

- **Kinematic(직접 이동, 운동학 바디)** — 캐릭터를 운동학 바디([01] 운동학 바디 참조)로 두고 *직접 위치를 명령*한다. 물리 솔버가 캐릭터에 힘을 가하지 않으며, 캐릭터가 일방적으로 세계를 밀어낸다. 이동 의도(desired velocity)를 받아 매 프레임 충돌을 풀며 위치를 갱신한다. 통제가 쉽고 결정적이라 대부분의 게임이 채택한다.
- **Dynamic(rigid body 캡슐)** — 캡슐 형태의 *진짜 동역학 강체*에 힘/임펄스를 가해 이동한다. 환경과 양방향 상호작용(상자를 밀고 밀림)이 자연스럽지만, 미끄러짐·기울어짐·끼임을 추가 구속(upright constraint 등)으로 잡아야 해 통제가 어렵다.

#### Collide-and-slide (충돌 후 미끄러짐)

kinematic 컨트롤러의 심장. 원하는 이동 벡터를 충돌면을 따라 *투영(project)* 하여 벽에 부딪혀도 멈추지 않고 미끄러지게 한다. 한 번이 아니라 **여러 번 반복 투영**(보통 3~5회)하여 코너(두 벽이 만나는 곳)에서 끼이지 않게 한다.

```
function CollideAndSlide(pos, velocity, maxIters):
    remaining = velocity
    for i in 0..maxIters:
        hit = SweepCapsule(pos, remaining)        # swept 충돌 [04]
        if not hit:
            pos += remaining
            break
        pos += remaining * hit.t                   # 충돌 지점까지 이동
        # 충돌면 법선으로 잔여 이동을 투영(미끄러짐 평면에 사영)
        leftover = remaining * (1 - hit.t)
        remaining = leftover - dot(leftover, hit.normal) * hit.normal
        if length(remaining) < epsilon: break
    return pos
```

- **Step offset(계단 오르기)** — 작은 턱(예: 0.3~0.4m 이하)은 충돌로 막지 않고 *위로 들어올린 뒤 전진, 다시 내려놓는* 시퀀스(up-sweep → forward-sweep → down-sweep)로 자연스럽게 오른다.
- **Slope limit(경사 한계)** — 지면 법선과 up 벡터의 각도가 한계(예: 45°)를 넘으면 "걸을 수 있는 바닥"이 아니라 "벽/미끄럼면"으로 취급해 미끄러져 내려가게 한다.
- **Ground detection(접지 판정)** — 캐릭터 발밑으로 짧은 sweep/ray 를 쏴 접지 여부·지면 법선을 얻는다. 점프 가능 여부, 중력 적용, 경사 처리의 기준이 된다. 미세한 틈에서 깜빡이는 것을 막으려 약간의 hysteresis(접지 유지 거리)를 둔다.
- **무빙 플랫폼(moving platform)** — 접지한 플랫폼의 프레임 간 변환(delta transform)을 캐릭터에 *부모처럼 적용*해 함께 실려 가게 한다. 회전 플랫폼은 위치뿐 아니라 회전 delta 도 캐릭터 위치에 반영해야 한다(결정론·재현성에서 까다로운 지점).

### 2.2 Vehicle Dynamics (차량 동역학)

차량은 차체(chassis) 강체 하나에 바퀴 4개의 힘을 합산해 구동한다. 바퀴 모델링에 두 갈래가 있다.

- **Raycast vehicle(레이캐스트 차량)** — 바퀴를 실제 충돌체로 두지 않고, 차체에서 각 바퀴 위치 아래로 *ray 를 쏴* 지면까지 거리로 서스펜션 압축량을 구한다. 가볍고 안정적이며 대부분의 게임 차량이 채택(원조: Bullet `btRaycastVehicle`).
- **Full rigid-body wheel(완전 강체 바퀴)** — 각 바퀴를 별도 강체로 두고 hinge/suspension 조인트([06])로 차체에 연결, 실제 회전·접촉을 시뮬레이션한다. 사실적이지만 비싸고 튜닝이 어렵다.

#### 타이어 모델 (Tire Model)

차량 운전 느낌의 90%는 타이어가 만든다. 핵심은 **슬립(slip)이 마찰력을 만든다**는 점이다.

- **Slip ratio(종방향 슬립)** — 바퀴 원주 속도와 차량 진행 속도의 불일치. 가속/제동에서 추진력·제동력을 결정.

  ```
  slipRatio = (ωwheel * Rwheel - vlong) / |vlong|
  ```

- **Slip angle(횡방향 슬립각)** — 바퀴가 향하는 방향과 실제 진행 방향 사이 각도. 코너링 힘(조향력)을 결정.

  ```
  slipAngle = atan2(vlat, |vlong|)
  ```

- **Pacejka magic formula(파제카 매직 포뮬러)** — 슬립 → 힘 곡선의 사실적 모양(처음 선형 상승 → 피크 → 완만한 하강)을 4개 계수로 근사하는 산업 표준.

  ```
  F(slip) = D * sin( C * atan( B*slip - E*(B*slip - atan(B*slip)) ) )
  # B: stiffness, C: shape, D: peak, E: curvature
  ```

- **Friction circle / ellipse(마찰원)** — 타이어가 낼 수 있는 총 마찰력은 한계가 있고, 종방향(가속/제동)과 횡방향(조향)이 *그 한계를 나눠 쓴다*. 풀 가속 중에는 조향력이 줄어 언더스티어가 나는 이유.

  ```
  (Flong / μFz)^2 + (Flat / μFz)^2 ≤ 1      # 원 안쪽이어야 함
  ```

#### 서스펜션 (Suspension)

각 바퀴는 스프링-댐퍼로 차체를 떠받친다. raycast 차량에서는 ray 길이로 압축량 `x` 를 얻고 차체에 위 방향 힘을 가한다.

```
Fsuspension = k * (restLength - rayDistance) - c * compressionVelocity   # 스프링 - 댐퍼
# k: 스프링 강성, c: 댐핑 계수
```

#### 엔진 / 기어 / 드라이브트레인 (Engine / Gear / Drivetrain)

- 엔진 토크 곡선(RPM → torque), 기어비, 디퍼렌셜을 거쳐 구동축 바퀴에 토크를 전달한다.

  ```
  wheelTorque = engineTorque * gearRatio * finalDriveRatio * efficiency
  ```

- 바퀴 각가속도는 구동 토크와 노면 반작용(타이어 종방향 힘 × 반경)의 차로 적분한다. RPM 은 다시 구동 바퀴 회전수로부터 역산해 피드백 루프를 닫는다.

### 2.3 Active Ragdoll / Physical Animation (액티브 래그돌 / 피지컬 애니메이션)

수동(passive) 래그돌([06])은 관절을 늘어뜨려 "기절·사망" 거동만 만든다. **액티브 래그돌**은 동일한 ragdoll 골격에 *모터를 달아* 애니메이션을 물리적으로 추종하게 한다 — 충격에 반응하며 흔들리지만 다시 자세를 잡는다.

- **PD 제어(Proportional-Derivative)로 애니메이션 추종** — 각 관절이 목표 애니메이션 포즈를 향하도록 토크를 만든다.

  ```
  τjoint = Kp * (θtarget - θcurrent) + Kd * (ω̇target - ωcurrent)
  # Kp: 강성(자세를 얼마나 강하게 잡는가), Kd: 댐핑(흔들림 억제)
  ```

- **Powered constraint(구동 구속) / drive** — 엔진의 조인트 모터(angular drive)에 목표 회전과 강성/댐핑(spring/damping)을 주는 방식. PD 제어를 솔버 구속으로 구현한 것이라 안정성이 좋다(implicit drive).
- **블렌딩(blending) / get-up** — 키네마틱 애니메이션과 물리 시뮬레이션 결과를 가중 혼합한다. 평소엔 애니메이션 우세(blend weight 높음), 피격 시 물리 우세로 전환해 비틀거리고, 다시 애니메이션 우세로 끌어올려 *일어서기(get-up)* 를 연출한다. 부위별(상체만 물리, 하체는 애니메이션) blend 도 흔하다.

### 2.4 부력·공력 (Buoyancy & Aerodynamics)

물·공기 같은 매질이 물체에 가하는 힘. 전체 유체 시뮬([08]) 없이 *해석적 근사*로 처리하는 게 게임 실무다.

- **부력(Buoyancy, Archimedes)** — 잠긴 부피(submerged volume)가 밀어낸 유체 무게만큼 위로 뜨는 힘.

  ```
  Fbuoyancy = ρfluid * g * Vsubmerged   (위 방향)
  ```

  실무에선 물체를 voxel/샘플 포인트로 근사해 *물 표면 아래에 있는 점들*만 합산한다. 물 표면 높이는 보통 [08]의 height-field(shallow water/Gerstner 파도)에서 샘플링한다 — 파도 위에서 배가 출렁이는 효과의 출처. 힘을 무게중심이 아닌 *부력 중심(center of buoyancy)* 에 가해야 복원 토크가 생겨 배가 자세를 잡는다.
- **항력(Drag)** — 속도 제곱에 비례해 운동을 거스르는 힘. 물속 감속, 낙하산, 종단속도의 원천.

  ```
  Fdrag = -½ * ρ * |v|² * Cd * A * v̂
  ```

- **양력(Lift, 간단 익형)** — 받음각(angle of attack)에 따라 진행 방향에 수직으로 생기는 힘. 비행기 날개·글라이더·돛에 쓰며, `Cl(받음각)` 곡선으로 근사한다.

  ```
  Flift = ½ * ρ * |v|² * Cl(α) * A   (진행방향에 수직)
  ```

- **바람(Wind)** — 전역/국소 바람장(wind field)을 속도에 더해 *상대 속도*로 항력·양력을 계산한다. 천([07])·나뭇잎·파티클([09])에도 동일하게 주입한다.

### 2.5 파괴 / 분쇄 (Destruction / Fracture)

물체를 조각으로 쪼개 무너지게 하는 시스템. 런타임 비용 때문에 *사전 분할*이 표준이다.

- **사전 분할(pre-fracture) / Voronoi shattering** — 메시 내부에 점을 뿌리고 Voronoi 다이어그램으로 공간을 셀로 나눠 미리 조각 메시를 만들어 둔다. 클러스터링으로 큰 덩어리 → 작은 조각의 계층(다단계 파괴)을 굽기도 한다.
- **연결 그래프 / island(connectivity graph)** — 조각들이 어떻게 붙어 있는지를 그래프로 둔다. 충격이 결합(bond)을 끊으면, 끊긴 뒤 *연결 성분(connected component)* 을 다시 계산해 분리된 덩어리(island, [11]·[13]의 island 개념과 연결)를 동적 강체로 풀어준다. "support" (고정점에 연결된 island 는 안 떨어짐) 판정이 핵심이다.
- **런타임(runtime) vs 베이크(baked) 파괴** — 베이크: 모든 조각·결합을 사전 계산(저비용·결정적, 변형 패턴 고정). 런타임: 충격 위치에 맞춰 즉석에서 절단(고비용·다양, 결정성·성능 위험). 게임 대부분은 베이크 + 약간의 런타임 island 분리.
- **디브리(debris) 관리** — 깨진 조각 수가 폭발하므로 수명·거리 기반 컬링, 작은 조각의 강체 → 파티클([09]) 강등, sleeping([13]) 으로 비용을 관리한다.

---

## 3. 주요 기법/도구

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

## 5. 함정·결정론 주의

- **Raycast/sweep 는 비결정성의 단골** — character/vehicle 의 ground sweep, 휠 ray 가 broad-phase 순회 순서나 부동소수점 차이([00])에 민감하다. 결정론([12])이 필요하면 질의 순서를 고정하고 fixed timestep 안에서만 수행한다.
- **Collide-and-slide 반복 횟수** — 너무 적으면 코너에서 끼이고(stuck), 너무 많으면 비용↑·미세 떨림(jitter). 잔여 속도 epsilon 컷오프를 둬야 무한 진동을 막는다.
- **Step offset 의 down-sweep 누락** — up→forward 만 하고 down-sweep 을 빠뜨리면 캐릭터가 공중에 뜨거나 경사에서 튄다. step 시퀀스는 3단을 모두 지켜야 한다.
- **무빙 플랫폼 회전** — 위치 delta 만 적용하고 회전 delta 를 빠뜨리면 회전 플랫폼에서 캐릭터가 미끄러진다. 또 플랫폼 적용 시점이 캐릭터 갱신 전/후냐에 따라 한 프레임 어긋남(jitter)이 생긴다.
- **타이어 모델 폭주** — 저속에서 `slipRatio`/`slipAngle` 분모(|v|)가 0 에 가까워 힘이 발산한다. 저속 클램프(예: 정지 마찰 별도 처리, |v| 하한)가 필수. friction circle 합성을 안 하면 가속+조향 동시에서 그립이 비현실적으로 커진다.
- **PD 게인 불안정** — active ragdoll 의 `Kp`/`Kd` 가 timestep 대비 과하면 explicit PD 가 발산한다. powered constraint(implicit drive)로 옮기거나 게인을 substep 에 맞춰 조정한다. 부위별 blend 경계에서 토크가 불연속이면 팝(pop)이 난다.
- **부력 안정성** — 잠긴 부피 샘플 수가 적으면 물 표면 부근에서 힘이 계단식으로 튀어 물체가 떨린다. 부력 중심을 무게중심으로 잘못 두면 복원 토크가 사라져 배가 뒤집힌다. 항력 댐핑 없이는 무한히 출렁인다.
- **파괴의 결정론·비용** — island 재계산이 연결 그래프 순회 순서에 의존하면 비결정적이다(네트워크 동기화 시 클라마다 다른 잔해). 런타임 절단은 특히 비결정적이라 멀티플레이에선 베이크 결과만 동기화하거나 효과를 시각 전용으로 분리한다. debris 폭발은 컬링/강등/sleeping 없이는 프레임을 잡아먹는다.

---

## 6. 더 읽기 / 관련 노드

- **선행(필수)**: [05-constraint-solving.md](05-constraint-solving.md) (impulse/PGS/TGS — 차량·래그돌 구속의 기반) · [06-joints-articulation.md](06-joints-articulation.md) (조인트·모터·ragdoll — active ragdoll·full wheel 의 토대)
- **연계**: [01-kinematics.md](01-kinematics.md) (운동학 바디 — kinematic 캐릭터) · [04-collision-detection.md](04-collision-detection.md) (swept/raycast — collide-and-slide·휠 ray) · [08-fluids.md](08-fluids.md) (height-field — 부력 물 표면) · [09-particles.md](09-particles.md) (debris 강등·바람) · [11-spatial-structures.md](11-spatial-structures.md) (island·broad-phase) · [12-determinism-networking.md](12-determinism-networking.md) (raycast/island 비결정성) · [13-performance-parallelism.md](13-performance-parallelism.md) (sleeping·island·debris 컬링)
- **형제 문서 전체**: [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) · **[10-specialized-systems.md](10-specialized-systems.md)** · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · [13-performance-parallelism.md](13-performance-parallelism.md)
