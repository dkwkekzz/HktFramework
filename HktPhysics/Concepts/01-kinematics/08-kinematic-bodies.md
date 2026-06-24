# [01.8] 운동학적 바디 (Kinematic Bodies)

> 엘리베이터·이동 플랫폼·스크립트로 움직이는 문 — 힘이 아니라 **외부가 정한 경로**로 움직이지만, 위에 선 dynamic 바디를 제대로 밀어야 한다. 그 비밀은 "위치를 순간이동하지 말고, **target pose + dt 로 속도를 역산**해 주입"하는 것. dynamic/static/kinematic 세 바디 타입과 텔레포트 함정, 그리고 character controller 로의 연결.
> **상위 허브**: [../01-kinematics.md](../01-kinematics.md) · **상위 지도**: [../README.md](../README.md)

---

## 1. 왜 kinematic 바디인가

물리 엔진의 바디는 보통 세 종류다:

| 타입 | 누가 움직이나 | 힘을 받나 | 충돌 응답 | 예 |
|---|---|---|---|---|
| **static** | 아무도(고정) | — | 다른 바디를 막음 | 지형·벽·정적 콜라이더 |
| **dynamic** | **시뮬레이션**(힘·충돌) | 받음 | 완전 참여 | 떨어지는 상자·래그돌 |
| **kinematic** | **외부 코드**(스크립트·애니메이션) | **안 받음** | 남을 밀지만 안 밀림 | 이동 플랫폼·문·MovingPlatform·캐릭터 |

kinematic 의 정체성: **"무한 질량처럼 행동하되 경로는 외부가 정한다."** 중력·충돌로 안 밀리지만(`m→∞` 처럼), 자신은 정해진 대로 움직이며 **위에 올라탄 dynamic 바디를 밀고 끌고 마찰로 데려간다.**

핵심 질문: kinematic 이 힘을 안 받는다면, 위에 선 상자에 운동량을 어떻게 전달하나? → **속도가 있어야** 솔버가 그 속도를 상자에 전달한다. 그래서 위치만 바꾸면 안 되고 **속도를 줘야** 한다. 이 문서 전체가 그 한 문장의 전개다.

---

## 2. 정의: kinematic 의 운동학

kinematic 바디도 상태 `(x, q, v, ω)` 를 갖는다(허브 §1). 차이는 **`v, ω` 의 출처**:

- dynamic: `v, ω` ← 적분기가 힘/토크에서 계산([02](../02-dynamics.md)·[03](../03-time-integration.md)).
- kinematic: `v, ω` ← **외부가 준 target pose 로부터 역산**.

즉 dynamic 은 `(F,τ) → (a,α) → (v,ω) → (x,q)` 로 *내려가고*, kinematic 은 `target (x,q) → (v,ω)` 로 *거꾸로 올라간다*. 그 역산이 핵심.

이 "거꾸로"가 kinematic 의 본질이다. dynamic 바디는 *원인(힘)* 을 주면 시뮬이 *결과(운동)* 를 계산하지만, kinematic 바디는 우리가 *결과(목표 자세)* 를 정해 놓고 시뮬에게 "이렇게 되도록 해당하는 속도를 알아서 써라"라고 통보한다. 그래서 kinematic 바디의 가속도·관성·질량은 시뮬 입장에서 의미가 없다(무한 질량 취급) — 오직 매 스텝 주입되는 `(v, ω)` 만이 주변 dynamic 세계와 대화하는 유일한 채널이다.

---

## 3. 수식: target pose → 속도 역산

이번 스텝 동안 kinematic 바디를 현재 자세 `(x, q)` 에서 목표 `(x_t, q_t)` 로 옮기고 싶다. dt 동안 그 변위를 내는 **속도**를 역산한다.

### 3.1 선속도 (단순)

```
v = (x_t − x) / dt
```

위치 차를 dt 로 나눈 평균 속도. 이 `v` 를 바디에 주입하면 솔버가 이 속도로 위에 선 dynamic 바디를 민다.

### 3.2 각속도 (회전은 사원수)

회전은 빼기로 안 된다([02](02-angular-motion.md)). 현재→목표 **상대 회전**([06](06-relative-motion.md))을 구해 축–각/로그로 내린다([04a](04a-quaternion-derivative.md) §3·§4.2):

```
q_delta = q_t ⊗ q*                       # 현재에서 목표로 가는 회전(world, 왼쪽 곱 규약)
if q_delta.w < 0: q_delta = −q_delta     # 이중덮개: 짧은 길([07] 부호 정규화)
θ·n = 2 · log(q_delta)                    # 회전벡터(축×각). 2 = ½ 의 역(반각→전각, [04a])
ω = (θ·n) / dt                            # 각속도(rad/s)
```

> `2·log` 의 **2** 는 [04a](04a-quaternion-derivative.md)의 ½ 의 역수, [06](06-relative-motion.md) §4.2 와 같은 사실. 사원수 델타에서 *물리 각속도* 를 꺼내는 환산이다.

이 `(v, ω)` 를 한 스텝 동안 바디에 실으면, 솔버가 끝나고 적분되면 자세가 정확히 `(x_t, q_t)` 에 도달하고, **그 사이 동안 접촉한 dynamic 바디들이 이 속도를 전달받는다.**

### 3.3 왜 이게 텔레포트보다 옳은가

- **순간이동(`x := x_t` 직접 대입)**: 속도 `v` 는 그대로 0(또는 옛값) → 솔버가 "이 바디는 안 움직인다"고 본다 → 위에 선 상자에 **운동량 전달 0** → 상자가 안 따라오거나, 갑자기 겹쳐서(penetration) 다음 스텝에 튕겨 나간다(허브 §5 텔레포트 함정).
- **속도 역산**: `v = Δx/dt` 가 0 이 아니므로 솔버가 정상적으로 상자를 민다. 플랫폼과 상자가 자연스럽게 함께 간다.

한 줄: **"위치를 옮기지 말고 속도를 줘서 옮겨지게 하라."**

직관으로 한 번 더: 물리 솔버는 "겹침(penetration)"과 "상대 속도"만 본다. 텔레포트는 플랫폼을 *순간* 에 상자 안으로 밀어넣어 큰 겹침을 만들지만, 그 순간 둘의 상대 속도는 0 이다 — 솔버 입장에선 "갑자기 겹쳐 있는, 안 움직이는 두 물체"라 마찰로 데려갈 근거가 없고 오직 분리 충격량만 쏜다. 반대로 속도를 주면 매 스텝 겹침은 작고 상대 속도가 살아 있어, 솔버가 마찰·접촉으로 상자를 *부드럽게 동승* 시킨다. 즉 운동량 전달은 "위치 변화"가 아니라 "속도"를 통해서만 일어난다 — 이것이 모든 물리 엔진의 접촉 솔버 전제다([../05-constraint-solving.md](../05-constraint-solving.md)).

---

## 4. 알고리즘 / 의사코드

```text
# kinematic 바디를 target pose 로 (속도 역산 — 엔진 표준 인터페이스)
function move_kinematic(body, x_target, q_target, dt):
    # 선속도
    body.v = (x_target - body.x) / dt

    # 각속도 (사원수 델타 → 회전벡터 → /dt)
    q_delta = q_target ⊗ conj(body.q)
    if q_delta.w < 0: q_delta = -q_delta          # 짧은 길
    rotvec = 2 * log(q_delta)                      # ≈ 작은각이면 2*(qx,qy,qz)
    body.omega = rotvec / dt

    # ★ 위치/자세는 직접 대입하지 않는다 — 솔버+적분기가 v,omega 로 전진시킨다.
    #   (텔레포트 금지. 엔진이 이 v,omega 로 접촉 dynamic 바디를 민다.)

# 진짜 텔레포트가 꼭 필요할 때(순간이동 스킬 등) — 의도적 분리
function teleport_kinematic(body, x_new, q_new):
    body.x = x_new; body.q = q_new
    body.v = 0; body.omega = 0                     # 속도 0: 주변에 운동량 전달 안 함(의도된 동작)
    # 주의: 위에 선 바디는 따라오지 않음. 겹침 발생 가능 → 같은 프레임에 주변 재배치/깨우기 필요
```

엔진 API 대응(허브 §4):

```
PhysX:  actor->setKinematicTarget(PxTransform)     # 내부에서 v,ω 역산
Jolt:   body.MoveKinematic(targetPos, targetRot, dt)
Bullet: CF_KINEMATIC_OBJECT + getMotionState()->setWorldTransform()  # MotionState 로 주입
UE5:    Movement 컴포넌트 / SetWorldTransform(sweep) — kinematic 제어
Box2D:  b2_kinematicBody + SetLinearVelocity/SetAngularVelocity      # 2D: ω 스칼라
```

PhysX `setKinematicTarget`·Jolt `MoveKinematic` 은 **§3 의 속도 역산을 엔진이 대신** 해준다 — 그래서 "target + dt" 인터페이스가 표준이다.

---

## 5. 텔레포트 함정과 character controller 연결

### 5.1 텔레포트 함정 정리(허브 §5)

위치만 바꾸는 순간이동의 부작용:
1. **운동량 미전달**: 위에 선 dynamic 바디가 안 따라옴(플랫폼만 가고 상자는 제자리).
2. **관통/끼임**: 새 위치가 dynamic 바디와 겹치면, 솔버가 다음 스텝에 강한 분리 충격량으로 **튕겨낸다**.
3. **CCD 우회**: 큰 순간이동은 연속 충돌 검출(CCD)을 건너뛰어 벽을 관통.

규칙: **일반 이동은 항상 target+dt(속도 역산). 진짜 순간이동만 의도적으로 텔레포트** + 주변 바디 깨우기/재배치.

### 5.2 character controller 로의 연결

캐릭터 컨트롤러(플레이어 이동)는 대표적 kinematic 응용([../10-specialized-systems.md](../10-specialized-systems.md)):

- 캐릭터는 보통 **kinematic 캡슐** — 중력·충돌로 *밀리지 않고*(컨트롤이 명확), 입력으로 정한 속도/목표로 움직인다.
- 매 프레임 입력 → 의도 속도 → **collide-and-slide**(벽을 만나면 미끄러짐 벡터로 투영)로 실제 변위 계산 → 그 변위를 §3 처럼 속도로 주입(또는 sweep 이동).
- **이동 플랫폼 위의 캐릭터**: 플랫폼도 kinematic. 플랫폼의 `v, ω` 를 캐릭터 기준 프레임에 더해 "함께 실려 가게"([05](05-frames-transforms.md) §3.4 의 `v_world = v_B + ω_B × r` — 플랫폼 위 한 점 속도). 이게 상대 운동([06](06-relative-motion.md))·프레임 변환([05])이 캐릭터 이동에서 만나는 지점.

즉 kinematic 바디의 운동학(이 문서) → 프레임/상대 운동([05]·[06]) → 응용(character controller, [10])으로 이어진다.

---

## 6. 실무 트레이드오프

- **target+dt 가 표준, 텔레포트는 예외**: 거의 모든 kinematic 이동은 속도 역산 인터페이스로(허브 §4·§5). 텔레포트는 순간이동 스킬·리스폰처럼 *의도적 불연속* 에만, 그것도 주변 바디 깨우기와 함께.
- **dt 일관성**: 속도 역산 `v=Δx/dt` 의 dt 는 **시뮬 고정 dt** 와 같아야 한다. 가변 dt 를 쓰면 속도가 프레임레이트에 종속돼 결정론·물리 응답이 흔들린다(허브 §5, [07](07-interpolation.md) render interp 로 부드러움은 따로).
- **각속도 부호/폴백**: `2·log(q_delta)` 는 부호 정규화(`w<0→−q`)와 작은각 0/0 폴백 필요([06](06-relative-motion.md)·[07](07-interpolation.md)). 빼먹으면 큰 회전 목표에서 플랫폼이 "긴 길"로 돈다.
- **kinematic↔dynamic 한 방향**: kinematic 은 dynamic 을 밀지만 그 역은 없다(무한 질량). 두 kinematic 이 서로 밀어야 하는 상황은 솔버가 못 푼다 — 설계로 피한다.
- **엔진 매핑(허브 §4)**: PhysX `eKINEMATIC`+`setKinematicTarget`, Bullet `CF_KINEMATIC_OBJECT`+MotionState, Jolt `EMotionType::Kinematic`+`MoveKinematic`, Box2D `b2_kinematicBody`(2D, ω 스칼라), UE5 Chaos `Movement` 컴포넌트 — 모두 "target pose 받아 속도 역산" 또는 "속도 직접 주입" 인터페이스. 위치 직접 대입을 권장하는 엔진은 없다.

---

## 7. 더 읽기 / 관련 노드

- **속도 역산의 수학** — [04a-quaternion-derivative.md](04a-quaternion-derivative.md): `2·log` 의 2(=½ 의 역)·exp/log. [02-angular-motion.md](02-angular-motion.md): 회전은 빼기 안 됨(상대 회전 필요).
- **프레임/한 점 속도** — [05-frames-transforms.md](05-frames-transforms.md) §3.4·[03-point-velocity.md](03-point-velocity.md): 플랫폼 위 점의 속도 `v_B+ω_B×r` — 이동 플랫폼 위 캐릭터 동승.
- **상대 운동** — [06-relative-motion.md](06-relative-motion.md): `q_delta`·부호 정규화·`2·log` 를 공유. 플랫폼-캐릭터 상대 운동.
- **보간** — [07-interpolation.md](07-interpolation.md): 고정 dt 시뮬(속도 역산의 dt)과 render interpolation 분리, 부호/0-0 폴백.
- **동역학 대비** — [../02-dynamics.md](../02-dynamics.md): dynamic 의 `(F,τ)→(a,α)→(v,ω)` 하향 흐름(kinematic 의 역방향).
- **응용** — [../10-specialized-systems.md](../10-specialized-systems.md): character controller·이동 플랫폼 — kinematic 운동학의 대표 응용.
- **결정론** — [../12-determinism-networking.md](../12-determinism-networking.md): 고정 dt·속도 역산의 dt 일관성(허브 §5).
