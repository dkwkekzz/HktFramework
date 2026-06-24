# [01.7] 보간 (Interpolation)

> 시뮬레이션은 고정 timestep 으로 *띄엄띄엄* 전진하는데, 화면은 60/120/144Hz 로 *매끄럽게* 그려야 한다. 그 간극을 메우는 게 보간이다. 위치는 `lerp`, 회전은 `nlerp`/`slerp`, 그리고 시뮬↔렌더를 잇는 **render interpolation(accumulator + alpha)** — 거기에 도사린 이중덮개 부호·`acos` 클램프·slerp 0/0 폴백까지.
> **상위 허브**: [../01-kinematics.md](../01-kinematics.md) · **상위 지도**: [../README.md](../README.md)

---

## 1. 왜 보간이 필요한가

물리 결정론([12](../12-determinism-networking.md))은 **고정 timestep**(예: 60Hz, dt=1/60)을 요구한다(허브 §5). 하지만 모니터 주사율은 144Hz 일 수도, 프레임이 튀어 33Hz 일 수도 있다. 시뮬과 렌더의 박자가 다르다. 그냥 "마지막 시뮬 상태"를 그리면 시뮬보다 빠른 화면에서 **끊김(stutter)** 이, 느린 화면에서 **건너뜀** 이 보인다.

해법: 시뮬은 고정 dt 로 돌리되, 렌더는 **이전 상태와 현재 상태 사이를 `alpha` 로 보간**해 그린다. 이게 render interpolation 이고, 그 부품이 lerp/nlerp/slerp 다.

두 층위를 구분하라:
- **값 보간(value interp)**: 두 자세 사이를 매끈히 잇는 수학 — lerp(위치)·nlerp·slerp(회전).
- **렌더 보간(render interp)**: 시뮬 루프와 렌더 루프를 accumulator+alpha 로 분리하는 *루프 패턴*. 위 값 보간을 도구로 쓴다.

표기: 두 끝점 `a, b`(위치) 또는 `q0, q1`(회전), 보간 파라미터 `t ∈ [0,1]`.

---

## 2. 위치 보간: lerp

가장 단순. 직선 위를 등속으로:

```
lerp(a, b, t) = (1 − t) a + t b = a + t (b − a)
```

위치·스케일·색 등 **벡터 공간 양**은 lerp 가 정답이다. 비용 최저, 특이점 없음. 끝점에서 정확(`t=0→a`, `t=1→b`). 회전에는 직접 쓰면 안 된다 — 사원수를 lerp 하면 단위 노름을 벗어나 자세가 찌그러진다(아래 nlerp 가 그 보정).

직관: lerp 이 "옳은" 이유는 위치가 **평평한 벡터 공간(flat space)** 에 살기 때문이다. 두 점을 잇는 최단 경로가 직선이고, 그 직선을 `t` 비율로 나눈 점이 정확히 `lerp`. 회전이 까다로운 건 자세가 평평하지 않은 **굽은 구면(`S³`)** 에 살아서다 — 구면 위 두 점을 직선으로 이으면 구를 뚫고 들어가 버린다(그래서 nlerp 가 다시 표면으로 끌어올린다). 보간의 모든 미묘함은 이 "평평 vs 굽음"의 차이에서 나온다.

---

## 3. 회전 보간: nlerp vs slerp

회전은 단위 사원수 — `S³`(4D 단위구) 위의 점이다. 두 점을 잇는 길은 직선이 아니라 **구면 위의 호(arc)** 다.

### 3.1 이중덮개 부호 — 모든 회전 보간의 전제

`q` 와 `−q` 는 **같은 회전**([04a](04a-quaternion-derivative.md) 이중덮개). 그래서 보간 전에 두 끝이 "가까운 쪽"을 보게 맞춰야 한다:

```
if dot(q0, q1) < 0:
    q1 = −q1          # 더 짧은 호(<180°)를 따라가도록
```

이걸 빼면 nlerp/slerp 모두 **"긴 길(>180°)"로 빙글 돈다**(허브 §5 대표 함정). 비교·블렌딩 전 항상 먼저.

왜 `dot<0` 이 "반대쪽"을 뜻하나: 단위 사원수 두 개의 내적은 둘 사이 각의 코사인(정확히는 `cos(Ω)`, Ω 는 4D 각). `dot<0` 은 4D 에서 90° 넘게 벌어졌다는 뜻 — 같은 물리 회전을 나타내는 두 표현 `q1`, `−q1` 중 *먼 쪽* 을 골랐다는 신호다. `−q1` 로 뒤집으면 `dot>0`, 즉 짧은 호 쪽 표현이 된다. `q≡−q`(이중덮개)라서 이 뒤집기는 결과 회전을 안 바꾸고 *경로만* 짧게 만든다.

### 3.2 nlerp — lerp 후 정규화

```
nlerp(q0, q1, t) = normalize( (1−t) q0 + t q1 )
```

사원수를 그냥 lerp 한 뒤 단위 노름으로 끌어내린다. 결과는 짧은 호를 따라가지만 **각속도가 비등속**(중간에 빨라졌다 느려짐). 다만 작은 각 차이(연속 프레임)에선 그 편차가 거의 안 보인다. **싸고**(곱·덧셈·1 normalize) 안정적 — **게임 기본**(허브 §3.3·§4).

### 3.3 slerp — 등속 구면 보간

```
Ω = acos( clamp(dot(q0, q1), −1, 1) )       # 두 사원수 사이 각
slerp(q0, q1, t) = [ sin((1−t)Ω) q0 + sin(tΩ) q1 ] / sin(Ω)
```

호를 따라 **등각속도(constant angular velocity)** 로 움직인다 — 수학적으로 "옳은" 회전 보간. 대신 `acos`·`sin` 3 회로 비싸다. 큰 각 키프레임 보간(애니메이션·카메라 큰 회전)에서 nlerp 의 비등속이 눈에 띄면 slerp.

### 3.4 slerp 의 두 함정

**(a) `acos` 클램프**: `dot(q0,q1)` 가 부동소수점 반올림으로 `1.0000001` 이 되면 `acos` 가 NaN(정의역 `[−1,1]` 초과). **반드시 `clamp(dot, −1, 1)`**(허브 §5).

**(b) 0/0 폴백**: `q0≈q1` 이면 `Ω≈0` → `sin(Ω)≈0` → `0/0`. 이땐 slerp 가 수치적으로 폭발하므로 **lerp/nlerp 로 폴백**:

```
if dot(q0,q1) > 0.9995:        # 거의 같다
    return nlerp(q0, q1, t)    # 0/0 회피. 작은 각이라 등속 편차 무시 가능
```

`acos` 클램프와 0/0 폴백은 별개 — 둘 다 넣어야 안전하다.

### 3.5 선택 요약 (허브 §3.3 과 일치)

| 방법 | 대상 | 속도 특성 | 비용 | 쓰는 곳 |
|---|---|---|---|---|
| lerp | 위치·스케일 | — | 최저 | 모든 벡터 양 |
| nlerp | 회전 | 비등속(보통 무시 가능) | 낮음 | 게임 기본, 연속 프레임 |
| slerp | 회전 | 등속 | 높음 | 큰 각, 정밀 애니메이션, `Ω→0` 폴백 |

---

## 4. render interpolation: accumulator + alpha

값 보간을 시뮬 루프에 끼우는 고전 패턴(Glenn Fiedler "Fix Your Timestep!", Erin Catto — 허브 §6).

### 4.1 아이디어

- 시뮬은 **고정 dt** 로만 전진한다.
- 실제 프레임 시간은 가변 → 남는 시간을 **accumulator** 에 쌓는다.
- accumulator 가 dt 를 넘으면 시뮬 1스텝(여러 번 가능). 매 스텝 전 **현재 상태를 prev 로 더블버퍼**.
- 렌더할 때 `alpha = accumulator / dt`(0~1, 다음 스텝까지 얼마나 왔나)로 **prev↔cur 보간**해 그린다.

### 4.2 알고리즘

```text
dt = 1/60                       # 고정 시뮬 timestep
accumulator = 0
prev_state = cur_state = initial

loop each frame:
    frame_time = clamp(now - last, 0, 0.25)    # 0.25: "death spiral" 방지 상한
    last = now
    accumulator += frame_time

    while accumulator >= dt:
        prev_state = cur_state                 # 더블버퍼: 보간 위해 직전 상태 보존
        cur_state  = simulate(cur_state, dt)   # 고정 dt 시뮬 1스텝(결정론)
        accumulator -= dt

    alpha = accumulator / dt                    # ∈ [0,1)

    # 렌더 상태 = prev 와 cur 사이 alpha 보간
    render_pos = lerp(prev_state.x,  cur_state.x,  alpha)
    render_rot = nlerp(prev_state.q, cur_state.q, alpha)   # 부호 정규화 내장
    draw(render_pos, render_rot)
```

핵심 규칙(허브 §5):
- **`alpha` 보간 결과를 시뮬 상태로 되먹이지 말 것** — 표시용일 뿐. 되먹이면 결정론이 깨진다.
- **`clamp(frame_time, …)`** 으로 spiral of death(한 프레임이 너무 길어 시뮬 스텝이 폭주 → 더 느려짐) 방지.
- 보간은 **prev→cur**(한 스텝 지연을 감수). 외삽(extrapolation, cur 너머 예측)은 끊김은 줄지만 오버슈트·되돌림이 생긴다 — 보통 보간을 택한다.

### 4.3 왜 시뮬과 렌더를 분리하나

고정 dt 시뮬 = **결정론·안정성**([12](../12-determinism-networking.md)). 가변 alpha 렌더 = **부드러움**. 둘을 한 루프에 섞으면(가변 dt 시뮬) 적분 결과가 프레임레이트에 종속돼 비결정적이 된다(허브 §5). render interpolation 은 이 둘을 깨끗이 가르는 표준 답.

---

## 5. 실무 트레이드오프

- **nlerp 가 기본, slerp 는 필요할 때만**: 연속 프레임의 작은 각에선 nlerp 의 비등속이 눈에 안 띄고 훨씬 싸다. 큰 키프레임 회전·정밀 카메라에서만 slerp. 그리고 **slerp 의 `Ω→0` 폴백은 결국 nlerp** — 한 코드에 둘 다 산다.
- **세 가지 가드는 항상 함께**: ① 이중덮개 부호(`dot<0 → −q`) ② `acos` 클램프(`clamp(dot,−1,1)`) ③ slerp 0/0 폴백(`dot>0.9995 → nlerp`). 셋 중 하나만 빠져도 특정 입력에서 빙글 돌거나 NaN(허브 §5).
- **분리 보간(FTransform)**: 위치는 lerp, 회전은 nlerp/slerp, 스케일은 lerp — `FTransform` 각 성분을 따로 보간([05](05-frames-transforms.md)). 4×4 행렬을 통째 lerp 하면 회전이 찌그러진다.
- **결정론**: slerp 의 `acos`/`sin`, nlerp 의 `normalize` 는 플랫폼별 초월함수/제곱근 차이로 lockstep 을 깰 수 있다 → render interp 는 **표시 전용**이라 보통 결정론 경로 밖이라 괜찮지만, *시뮬* 안에서 보간을 쓰면 검증된 math 필요([12](../12-determinism-networking.md)).
- **엔진 매핑(허브 §4)**: UE5 `FQuat::Slerp`/`FastLerp`(nlerp)·LDS render interpolation; Box2D·일반 게임은 게임 코드가 직접 prev/cur 더블버퍼로 render interp; PhysX/Bullet/Jolt 는 보간을 게임/엔진 상위층에 맡긴다. accumulator+alpha 루프는 엔진 무관 공통 패턴.

---

## 6. 더 읽기 / 관련 노드

- **선행** — [04a-quaternion-derivative.md](04a-quaternion-derivative.md): 이중덮개(`q≡−q`)·`S³`·반각 — 부호 정규화와 slerp 가 사는 구면의 근거. [../00-foundations.md](../00-foundations.md): 사원수 노름·`exp/log`.
- **프레임 분리 보간** — [05-frames-transforms.md](05-frames-transforms.md): `FTransform` 의 성분별(위치 lerp·회전 slerp) 보간.
- **상대 운동** — [06-relative-motion.md](06-relative-motion.md): 부호 정규화·0/0 폴백을 공유하는 자매 함정(joint error).
- **적분 루프** — [../03-time-integration.md](../03-time-integration.md): 고정 timestep + accumulator 루프의 적분 측 전문(이 문서는 그 렌더 측).
- **결정론** — [../12-determinism-networking.md](../12-determinism-networking.md): 고정 dt 시뮬 vs 가변 alpha 렌더 분리, 초월함수의 결정론 제약(허브 §5).
- **외부** — Glenn Fiedler "Fix Your Timestep!", Erin Catto(Box2D) GDC — accumulator+alpha 패턴의 고전(허브 §6).
