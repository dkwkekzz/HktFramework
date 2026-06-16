# [01] 운동학 (Kinematics) — 허브

> 운동학은 **힘과 질량을 보지 않고 운동 그 자체를 기술**한다 — 위치·속도·가속, 회전 표현, 좌표 프레임 변환이 전부 여기 산다. 동역학([02](02-dynamics.md))의 출력(가속도)을 받아 적분기([03](03-time-integration.md))가 다시 운동학 양으로 돌려주는, 시뮬레이션 루프의 *언어* 다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [01-kinematics/](01-kinematics/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [README.md](README.md) · **의존**: [00-foundations.md](00-foundations.md)

---

## 1. 위치와 역할

운동학(kinematics)은 "**무엇이 어떻게 움직이는가**"만 다룬다. *왜* 움직이는가(힘·토크·질량·관성)는 동역학(dynamics, [02](02-dynamics.md))의 몫이다. 이 분리는 단순한 교과서 구획이 아니라 엔진 아키텍처의 경계선이다:

- **운동학 양 (kinematic state)**: 위치 `x`, 자세 `q`(orientation), 선속도 `v`, 각속도 `ω`, 그리고 (적분 관점에서) 선/각 가속도 `a`, `α`. 강체의 *상태(state)* 는 보통 `(x, q, v, ω)` 12자유도(3+3+선/각속도)로 표현한다.
- **운동학 ↔ 동역학 ↔ 적분 의 삼각형**:
  ```
  [02 동역학]  : (힘 F, 토크 τ, 질량 m, 관성 I)  →  (a, α)        ← "왜"
  [03 적분]    : (a, α)  ⊕  현재 (x,q,v,ω)        →  다음 (x,q,v,ω) ← "어떻게 시간을 전진"
  [01 운동학]  : (x,q,v,ω) 의 정의·미분 관계·프레임 변환            ← "무엇을 기술"
  ```
  즉 운동학은 동역학과 적분이 *공유하는 좌표계와 미분 규칙* 을 정의한다. 회전의 미분 규칙([01-kinematics/04](01-kinematics/04-rotation-derivative.md))을 모르면 적분기를 못 짜고, 프레임 변환([01-kinematics/05](01-kinematics/05-frames-transforms.md))을 모르면 충돌·조인트의 부착점을 못 푼다.

- **DAG 상 위치**: `[00 수학] → [01 운동학] → [02 동역학]`. 운동학은 00의 선형대수·사원수를 **운동에 적용**한 첫 계층이고, 동역학·충돌·조인트가 모두 운동학의 어휘를 빌려 쓴다.

이 문서의 약속: **힘/토크/질량/관성텐서가 나오면 곧장 [02](02-dynamics.md)로 미룬다.** 여기서는 운동의 *기술* 과 *미분/변환 규칙* 만 끝까지 판다.

---

## 2. 하위 문서 인덱스 (세부 이론)

운동학은 직관 단위로 분할되어 있다. 각 문서는 정의 → 수식 → 알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [01-kinematics/01-linear-motion.md](01-kinematics/01-linear-motion.md) | 선형 운동 | 위치·속도·가속·SUVAT·유한차분 |
| 2.2 | [01-kinematics/02-angular-motion.md](01-kinematics/02-angular-motion.md) | 각운동 | 각속도 ω·비가환·무한소 vs 유한 회전 |
| 2.3 | [01-kinematics/03-point-velocity.md](01-kinematics/03-point-velocity.md) | 강체 한 점 속도 | v=v_cm+ω×r·구심/오일러항·상대 속도 |
| 2.4 | [01-kinematics/04-rotation-derivative.md](01-kinematics/04-rotation-derivative.md) | 회전의 시간변화 | Ṙ=[ω]×R·q̇=½ωq·푸아송·지수사상 |
| 2.4a | [01-kinematics/04a-quaternion-derivative.md](01-kinematics/04a-quaternion-derivative.md) | 회전 미분 근본 유도 | ½ 유도·skew-symmetric 유도·so(3) |
| 2.5 | [01-kinematics/05-frames-transforms.md](01-kinematics/05-frames-transforms.md) | 좌표 프레임·변환 | world/local/parent·TRS·합성·속도 변환 |
| 2.6 | [01-kinematics/06-relative-motion.md](01-kinematics/06-relative-motion.md) | 상대 운동 | q_AB·상대 각속도·joint error |
| 2.7 | [01-kinematics/07-interpolation.md](01-kinematics/07-interpolation.md) | 보간 | lerp·nlerp·slerp·render interpolation |
| 2.8 | [01-kinematics/08-kinematic-bodies.md](01-kinematics/08-kinematic-bodies.md) | 운동학적 바디 | dynamic/static/kinematic·속도 역산 |

---

## 3. 한눈 요약

### 3.1 운동학 양과 미분 관계

| 양 | 선형 | 회전 | 미분 관계 |
|---|---|---|---|
| 위치/자세 | `x` | `q` (또는 `R`) | — |
| 속도 | `v` | `ω` | `v = ẋ` · `q̇ = ½ ω̂ ⊗ q` · `Ṙ = [ω]× R` |
| 가속도 | `a` | `α` | `a = v̇` · `α = ω̇` |
| 한 점 속도 | — | — | `v_P = v_cm + ω × r` |

핵심 비대칭: 선형 양은 그냥 벡터로 더하고 적분하면 되지만, **유한 회전은 벡터가 아니다**(비가환). 그래서 회전은 *순간 각속도* `ω` 를 통해 `q̇`/`Ṙ` 미분식으로만 적분한다([01-kinematics/02](01-kinematics/02-angular-motion.md)·[01-kinematics/04](01-kinematics/04-rotation-derivative.md)).

### 3.2 자세 표현 트레이드오프

| 표현 | 성분 | 장점 | 단점 | 실무 용도 |
|---|---|---|---|---|
| 오일러 각 (Euler) | 3 | 직관적, 작음 | **짐벌락**, 보간 나쁨, 순서 모호 | UI 입력·DCC 노출만 |
| 축–각 (axis–angle) | 4(3+1) | ω 와 직결, 적분 친화 | 합성 불편 | 회전 델타·imgui |
| 회전행렬 (rotation matrix) | 9 | 점 변환 즉시 | 메모리·재정규화 비용 | 캐시된 변환·GPU |
| **사원수 (quaternion)** | 4 | 짐벌락無, slerp, 합성·정규화 싸다 | 직관성↓, 이중덮개 | **강체 자세 저장 표준** |

### 3.3 보간 선택

| 방법 | 대상 | 속도 특성 | 비용 | 비고 |
|---|---|---|---|---|
| lerp | 위치 | — | 최저 | `(1−t)a + tb` |
| nlerp | 회전 | 비등속(거의 무시) | 낮음 | lerp 후 normalize, 게임 기본 |
| slerp | 회전 | 등속(constant angular vel) | 높음 | 큰 각 키프레임 보간, `Ω→0` 시 폴백 |

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진 | 자세 저장 | 회전 적분 | 보간 | 비고 |
|---|---|---|---|---|
| **UE5 / Chaos** | `FQuat`(double 옵션) | 사원수, 스텝마다 정규화 | `FQuat::Slerp`/`FastLerp`, LDS render interp | `FTransform`=Quat+Vec+Scale 분리 저장. 행벡터·좌측곱. `Movement`컴포넌트가 kinematic 제어 |
| **PhysX** | quaternion (`PxTransform`) | 사원수 q̇=½ωq | — | `eKINEMATIC` 플래그 → `setKinematicTarget()` 로 target pose, 내부에서 속도 역산 |
| **Box2D** | 2D 각도(스칼라 θ) | 스칼라 적분(2D 라 ω 스칼라) | 게임이 직접 render interp | `b2_kinematicBody`. 2D 라 회전이 단일 스칼라로 단순 |
| **Bullet** | quaternion | 사원수 적분(`btTransformUtil::integrateTransform`, exponential map) | — | `CF_KINEMATIC_OBJECT` + `getMotionState` 로 외부 위치 주입 |
| **Jolt** | quaternion | 사원수, 결정론 적분 경로 | — | `EMotionType::Kinematic`, `MoveKinematic()` 로 target+dt → 속도 역산 |

공통 패턴:
- **자세는 사원수**(2D 엔진만 스칼라 각). 행렬은 변환 캐시·렌더에서만. (→ [01-kinematics/07](01-kinematics/07-interpolation.md))
- **kinematic 바디는 "target pose + dt → 속도 역산"** 인터페이스가 표준(위치만 순간이동 X). (→ [01-kinematics/08](01-kinematics/08-kinematic-bodies.md))
- **render interpolation 은 엔진/게임 코드에서** prev/cur 상태 더블버퍼로 처리. (→ [01-kinematics/07](01-kinematics/07-interpolation.md))
- UE 의 `FTransform` 처럼 **분리 저장(quat+vec+scale)** 이 4×4 행렬 저장보다 보편적 — 회전 보간·정규화가 싸고, 비균등 스케일 처리가 명확하기 때문. (→ [01-kinematics/05](01-kinematics/05-frames-transforms.md))

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **사원수 정규화 누락**: 1차 적분 후 `q /= |q|` 를 빼먹으면 노름이 드리프트해 자세에 전단/스케일이 섞인다. 매 스텝 필수. ([01-kinematics/04](01-kinematics/04-rotation-derivative.md))
- **이중덮개 부호**: slerp/nlerp/비교 전에 `dot(q0,q1)<0` 이면 한쪽을 반전. 안 하면 "긴 길(>180°)" 로 돌아 빙글 돈다. ([01-kinematics/07](01-kinematics/07-interpolation.md))
- **오일러 각 짐벌락**: 자세 *저장* 에 오일러 각을 쓰면 특정 자세에서 자유도 1을 잃는다. 저장은 사원수, 오일러는 UI 표시/입력 변환에만. ([01-kinematics/07](01-kinematics/07-interpolation.md))
- **회전 비가환**: 두 회전을 더하거나 순서를 바꾸면 안 된다. "각도를 벡터로 누적" 하는 코드는 큰 각/큰 dt 에서 틀린다 — `ω` 미분식으로 적분할 것. ([01-kinematics/02](01-kinematics/02-angular-motion.md)·[01-kinematics/04](01-kinematics/04-rotation-derivative.md))
- **행벡터 vs 열벡터 / 곱 순서**: 엔진 규약(UE=좌측곱)과 수학교재(우측곱)가 다르다. 합성 순서를 뒤집으면 조용히 틀린다. ([01-kinematics/05](01-kinematics/05-frames-transforms.md))
- **kinematic 위치 텔레포트**: 속도 역산 없이 위치만 바꾸면 위에 선 dynamic 바디에 운동량이 전달 안 되어 끼임/관통. 항상 target+dt 인터페이스로. ([01-kinematics/08](01-kinematics/08-kinematic-bodies.md))
- **degree/radian 혼용**: 내부 수식은 전부 라디안. degree 는 입력/표시 경계에서만 변환. ([01-kinematics/02](01-kinematics/02-angular-motion.md))
- **explicit Euler 의 ½·a·t² 누락**: `x += v·dt` 는 등가속 해석해보다 한 스텝당 위치 오차를 남긴다 → symplectic/Verlet([03](03-time-integration.md)). ([01-kinematics/01](01-kinematics/01-linear-motion.md))
- **`acos` 클램프 / slerp 0/0**: `Ω = acos(q0·q1)` 의 내적이 반올림으로 `>1` 이면 NaN → `clamp(·,−1,1)`; `Ω≈0` 이면 lerp/nlerp 폴백. ([01-kinematics/07](01-kinematics/07-interpolation.md))

### 결정론 (→ [12](12-determinism-networking.md))

- **고정 timestep 필수**: 가변 dt 는 적분 결과를 프레임레이트에 종속시켜 비결정적으로 만든다. 운동학 적분도 *반드시* 고정 dt 위에서. 렌더 부드러움은 보간([01-kinematics/07](01-kinematics/07-interpolation.md))으로 분리.
- **초월함수(sin/cos/acos/exp)** 의 플랫폼·컴파일러별 결과 차이는 사원수 지수사상·slerp 에서 결정론을 깬다. lockstep 멀티플레이는 fixed-point 또는 검증된 결정론 math 라이브러리를 쓴다 — [12](12-determinism-networking.md) 의 핵심 주제.
- **연산 순서 / FMA**: 변환 합성·`ω × r` 의 부동소수점 누적 순서가 플랫폼마다 다르면 결과가 갈린다([00](00-foundations.md) 부동소수점, [12](12-determinism-networking.md) 결정론).
- **보간은 표시용, 시뮬은 시뮬용**: render interpolation 결과(`alpha` 보간 pose)를 시뮬레이션 상태로 되먹이지 말 것 — 결정론이 깨진다.

---

## 6. 더 읽기 / 관련 노드

**형제 노드**
- **선행** — [00-foundations.md](00-foundations.md): 사원수 대수, 로드리게스 공식, `exp/log` 사상, skew-symmetric, 부동소수점.
- **다음** — [02-dynamics.md](02-dynamics.md): 여기서 미룬 힘·토크·질량·관성텐서, Newton–Euler. 운동학 양 `(x,q,v,ω)` 에 *원인* 을 붙인다.
- **적분** — [03-time-integration.md](03-time-integration.md): `q̇=½ωq`·`Ṙ=[ω]×R` 를 실제로 스텝하는 적분기(symplectic Euler/Verlet/RK4/exponential map), 정규화 정책, 고정 timestep + render interpolation 루프 전문.
- **충돌/구속** — [04](04-collision-detection.md)·[05](05-constraint-solving.md): `v=v_cm+ω×r` 상대 속도가 contact/joint 자코비안의 토대.
- **조인트** — [06-joints-articulation.md](06-joints-articulation.md): 상대 변환·상대 속도([01-kinematics/06](01-kinematics/06-relative-motion.md))가 joint error 와 그 도함수.
- **특화** — [10-specialized-systems.md](10-specialized-systems.md): kinematic 바디의 대표 응용 character controller·이동 플랫폼.
- **결정론** — [12-determinism-networking.md](12-determinism-networking.md): 고정 timestep·초월함수·연산 순서가 운동학 적분 결정론에 거는 제약.

**외부 레퍼런스**
- David H. Eberly, *Game Physics* (2nd ed.) — 강체 운동학·회전 적분의 표준 레퍼런스.
- Ian Millington, *Game Physics Engine Development* — 밑바닥부터 강체 상태·적분을 짜는 입문서.
- Erin Catto (Box2D), GDC — fixed timestep + render interpolation 루프의 실무 정석("Fix Your Timestep" 계열).
- Glenn Fiedler, "Fix Your Timestep!" — accumulator + alpha 보간 패턴의 고전 글.
