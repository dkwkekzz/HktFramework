# [01.6] 상대 운동 (Relative Motion)

> 조인트는 "두 바디가 *서로에 대해* 어떻게 놓여 있고 움직이는가"의 문제다. 상대 자세 `q_AB`, 상대 각속도, 그리고 그것들로 정의되는 **joint error 와 그 도함수** — 구속 솔버([05](../05-constraint-solving.md))가 0 으로 몰아갈 양 — 이 문서가 그 다리를 놓는다.
> **상위 허브**: [../01-kinematics.md](../01-kinematics.md) · **상위 지도**: [../README.md](../README.md)

---

## 1. 왜 상대 운동인가

지금까지([01](01-linear-motion.md)~[05](05-frames-transforms.md))는 *한* 바디의 운동을 world 기준으로 기술했다. 그런데 조인트(경첩·볼소켓·슬라이더)·접촉·부착은 본질적으로 **두 바디 사이의 관계**다. 경첩이 "닫혀 있다"는 건 절대 자세가 아니라 **두 바디의 상대 자세**가 특정 값이라는 뜻이다.

구속 솔버([05](../05-constraint-solving.md))는 이 관계를 "오차 함수 `C`"로 쓰고, **`C = 0` 을 유지**하도록 충격량을 푼다. 그 `C` 와, 솔버가 실제로 다루는 `Ċ`(시간 도함수)를 만들려면 먼저 **상대 위치·상대 자세·상대 속도**를 운동학적으로 정의해야 한다. 즉 이 문서는 운동학([01])과 조인트([06-joints](../06-joints-articulation.md))를 잇는 경첩이다.

표기:
- 바디 A, B 의 world 자세: `q_A`(사원수), `R_A`; 위치 `x_A`; 선속도 `v_A`; 각속도 `ω_A`(world frame).
- 사원수 곱 `⊗`, 켤레 `q*`(단위 사원수의 역 = 켤레). 회전 합성 규약은 [05](05-frames-transforms.md) §3.2 와 통일.

---

## 2. 상대 자세 (relative orientation)

### 2.1 `q_AB`: B 를 A 프레임에서 본 자세

"B 가 A 에 대해 얼마나 돌아 있는가"를 나타내는 상대 회전:

```
q_AB = q_A* ⊗ q_B          (B 의 자세를 A 프레임으로 가져온 것)
```

읽는 법: `q_B = q_A ⊗ q_AB` — "world→A 로 돌고(`q_A`), 다시 A→B 로 돌면(`q_AB`) world→B(`q_B`)". 그래서 `q_AB = q_A* ⊗ q_B`(왼쪽에서 `q_A*` 로 A 를 상쇄). 위치도 마찬가지로 A 프레임에서 본 B 원점:

```
p_AB = R_A* (x_B − x_A) = conj(q_A).rotate(x_B − x_A)
```

이건 [05](05-frames-transforms.md)의 역변환·합성을 두 바디에 적용한 것일 뿐이다 — 상대 운동은 프레임 변환의 특수한 사용례다.

### 2.2 곱 순서·이중덮개 주의

- **곱 순서**는 회전 합성 규약([05](05-frames-transforms.md) §3.2)을 그대로 탄다. `q_A* ⊗ q_B` 인지 `q_B ⊗ q_A*` 인지를 엔진 규약 하나로 고정하라(여기선 "world→A→B" 해석의 왼쪽 곱 규약).
- **이중덮개**: `q_AB` 와 `−q_AB` 는 같은 상대 회전. joint error 를 각으로 뽑을 때(§4) 부호를 정규화하지 않으면 "거의 정렬"인데 오차가 ~360°로 튄다([07](07-interpolation.md) 이중덮개와 같은 함정).

---

## 3. 상대 속도 (relative velocity)

### 3.1 상대 선속도·각속도

두 바디의 상대 운동은 속도에서도 정의된다. 가장 단순한 형태(질량중심 기준):

```
v_rel = v_B − v_A                      (상대 선속도, world frame)
ω_rel = ω_B − ω_A                      (상대 각속도, world frame)
```

각속도는 **벡터처럼 그냥 뺀다** — 순간 각속도 `ω` 는 (유한 회전과 달리) 벡터이기 때문([02](02-angular-motion.md)). 단, 두 `ω` 가 같은 프레임(여기 world)에서 표현돼 있어야 한다. body frame 으로 보고 싶으면 `ω_rel,A-body = R_A*(ω_B − ω_A)`.

### 3.2 부착점에서의 상대 속도 (조인트가 실제로 보는 양)

조인트는 질량중심이 아니라 **앵커점(anchor)** 에서 만난다. A 의 앵커 `r_A`(A-로컬), B 의 앵커 `r_B`(B-로컬)일 때 각 앵커의 world 속도는([03](03-point-velocity.md)·[05](05-frames-transforms.md) §3.4):

```
v_Pa = v_A + ω_A × (R_A r_A)
v_Pb = v_B + ω_B × (R_B r_B)
```

조인트가 0 으로 몰려는 **접점 상대 속도**:

```
v_rel@anchor = v_Pb − v_Pa
            = (v_B − v_A) + ω_B × (R_B r_B) − ω_A × (R_A r_A)
```

이 식이 곧 point-to-point(볼소켓) 구속의 속도 오차 `Ċ` 의 뼈대이고, `ω×r` 항들이 자코비안의 각속도 열을 만든다([05](../05-constraint-solving.md)).

---

## 4. joint error 와 그 도함수

이제 핵심: 구속을 "오차 함수 `C`"로 쓰고 그 `Ċ` 를 상대 운동량으로 표현한다.

### 4.1 위치 오차 (point-to-point / ball-socket)

두 앵커가 world 에서 같은 점이어야 한다:

```
C_pos = (x_B + R_B r_B) − (x_A + R_A r_A)        (∈ ℝ³, 0 이어야 함)
```

이걸 시간 미분하면 — 정확히 §3.2 의 앵커 상대 속도가 나온다:

```
Ċ_pos = v_rel@anchor = (v_B − v_A) + ω_B×(R_B r_B) − ω_A×(R_A r_A)
```

**위치 오차의 도함수 = 상대 속도.** 이게 "운동학이 조인트의 언어를 정의한다"는 말의 구체적 뜻이다. 솔버는 `Ċ_pos = 0`(속도 레벨)을 충격량으로 만들고, 드리프트한 `C_pos`(위치 레벨)는 Baumgarte/위치보정으로 따로 밀어 넣는다([05](../05-constraint-solving.md)).

### 4.2 자세 오차 (angular / hinge·fixed)

상대 자세가 목표 `q_target`(예: 고정 조인트면 초기 상대자세, 경첩이면 축 주위 회전만 허용)에서 얼마나 벗어났나:

```
q_err = q_target* ⊗ q_AB          (오차 회전. q_err ≈ 단위면 정렬됨)
```

이 오차를 **솔버가 쓰는 3-벡터**로 뽑으려면 사원수를 축–각/로그로 내린다([00](../00-foundations.md), [04a](04a-quaternion-derivative.md) exp/log):

```
θ_err = 2 · log(q_err)            (≈ 작은 각이면 q_err 의 허수부 ×2, 회전벡터)
```

> 여기 `2·log` 의 **2** 는 [04a](04a-quaternion-derivative.md)의 ½ 의 역수다 — 사원수가 반각을 담으므로, 사원수 오차에서 *물리 각* 을 꺼내려면 2 를 곱한다. ½ 과 2 는 같은 이중덮개 사실의 양면.

자세 오차의 도함수는 상대 각속도:

```
Ċ_ang = ω_rel = ω_B − ω_A         (목표가 정지면. 목표가 움직이면 ω_target 을 뺀다)
```

### 4.3 정리: 운동학 → 구속의 다리

```
              위치 레벨 C           속도 레벨 Ċ (솔버가 푸는 것)
point-to-point: (x_B+R_B r_B)−(x_A+R_A r_A)  →  Δv + ω_B×r_B' − ω_A×r_A'
angular(fixed): 2·log(q_target*⊗q_A*⊗q_B)    →  ω_B − ω_A
hinge:          위 자세오차의 "축 외 2성분"    →  ω_rel 의 "축 외 2성분"
```

오른쪽 열의 `Δv`, `ω×r`, `ω_B−ω_A` 가 전부 이 문서에서 정의한 상대 운동량이다. 솔버는 이걸 `J·v`(자코비안 × 속도)로 묶어 충격량을 푼다 — 그 한 칸 위가 [05-constraint-solving](../05-constraint-solving.md)·[06-joints](../06-joints-articulation.md).

---

## 5. 알고리즘 / 의사코드

```text
# 상대 자세·위치 (A 프레임에서 본 B)
function relative_pose(qA, xA, qB, xB):
    q_AB = conj(qA) ⊗ qB
    if q_AB.w < 0: q_AB = -q_AB         # 이중덮개 부호 정규화(짧은 길)
    p_AB = conj(qA).rotate(xB - xA)
    return (q_AB, p_AB)

# 앵커 상대 속도 (point-to-point Ċ)
function anchor_rel_velocity(A, B, rA_local, rB_local):
    raW = A.R.rotate(rA_local)
    rbW = B.R.rotate(rB_local)
    vPa = A.v + cross(A.omega, raW)
    vPb = B.v + cross(B.omega, rbW)
    return vPb - vPa                    # = Ċ_pos

# 위치 오차 (point-to-point C)
function pos_error(A, B, rA_local, rB_local):
    return (B.x + B.R.rotate(rB_local)) - (A.x + A.R.rotate(rA_local))

# 자세 오차를 3-벡터로 (fixed/hinge 공통 재료)
function ang_error_vec(qA, qB, q_target):
    q_err = conj(q_target) ⊗ (conj(qA) ⊗ qB)
    if q_err.w < 0: q_err = -q_err      # 부호 정규화 — 이거 빼면 ~2π 오차 튐
    return 2 * log(q_err)               # 회전벡터. 2 = ½ 의 역(반각→전각)

# 상대 각속도 (Ċ_ang)
function ang_rel_velocity(A, B):
    return B.omega - A.omega            # 같은 world frame 가정
```

---

## 6. 실무 트레이드오프

- **부호 정규화는 필수**: `q_AB`·`q_err` 에서 `w<0` 이면 반전(`-q`). 안 하면 거의 정렬 상태에서 자세 오차가 ~2π 로 튀어 솔버가 "긴 길"로 풀려 한 바퀴 돈다([07](07-interpolation.md)·허브 §5).
- **속도 레벨 vs 위치 레벨**: 솔버는 보통 `Ċ=0`(속도)을 충격량으로 풀고, 누적 위치 오차 `C`는 Baumgarte/soft-constraint/위치투영으로 따로 보정. 운동학은 `C`와 `Ċ` *둘 다* 의 식을 공급한다([05](../05-constraint-solving.md)).
- **프레임 일관성**: `ω_B − ω_A` 는 두 ω 가 같은 프레임일 때만 의미. world 로 통일하거나 한쪽 body 로 명시 변환([05](05-frames-transforms.md) §3.4). 섞으면 조인트가 미세하게 떨거나 드리프트.
- **`2·log` 의 작은각 폴백**: `log(q_err)` 는 `q_err≈단위`에서 `허수부/sin(θ/2)` 가 0/0 → 1차 근사 `θ_err ≈ 2·(qx,qy,qz)`로 폴백([07](07-interpolation.md) slerp 0/0 와 같은 종류).
- **엔진 매핑**: PhysX `D6Joint`·UE Chaos joint·Bullet `btTypedConstraint`·Jolt constraint 모두 내부적으로 이 상대 자세/속도 오차를 자코비안으로 만들어 푼다. point-to-point·hinge·fixed 의 `C`/`Ċ` 구조는 엔진을 가리지 않고 동일.

---

## 7. 더 읽기 / 관련 노드

- **선행 프레임** — [05-frames-transforms.md](05-frames-transforms.md): 변환 합성·역변환·속도 프레임 변환 — `q_AB`·앵커 world 속도가 그 직접 응용.
- **각속도 기초** — [02-angular-motion.md](02-angular-motion.md): `ω` 가 벡터라 `ω_B−ω_A` 가 되는 이유(유한 회전은 안 됨).
- **한 점 속도** — [03-point-velocity.md](03-point-velocity.md): `v_P = v_cm + ω×r` — 앵커 상대 속도(§3.2)의 토대.
- **회전 미분/로그** — [04a-quaternion-derivative.md](04a-quaternion-derivative.md): `2·log` 의 2 가 ½ 의 역인 이유(이중덮개·반각).
- **다음(조인트)** — [../06-joints-articulation.md](../06-joints-articulation.md): 여기 정의한 `C`/`Ċ` 가 hinge·ball·prismatic 등 각 조인트의 구체적 오차로.
- **구속 솔버** — [../05-constraint-solving.md](../05-constraint-solving.md): `Ċ = J v` 자코비안·충격량·Baumgarte — 상대 속도가 그 입력.
- **보간** — [07-interpolation.md](07-interpolation.md): 부호 정규화·0/0 폴백을 공유하는 자매 문제.
