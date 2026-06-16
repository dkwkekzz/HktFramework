# [00] 수학·수치 기반 (Foundations) — 허브

> 게임 물리의 모든 분기가 딛고 서는 토대 — 선형대수(linear algebra), 회전 대수(rotation algebra), 미적분/상미분방정식(ODE), 부동소수점 수치해석(numerical analysis).
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [00-foundations/](00-foundations/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: (없음 — 최상위 기반)

---

## 1. 위치와 역할

이 문서는 물리 엔진 지식 그래프의 **뿌리 노드**다. 다른 모든 분기 — 운동학([01](01-kinematics.md)), 동역학([02](02-dynamics.md)), 시간 적분([03](03-time-integration.md)), 충돌 검출([04](04-collision-detection.md)), 제약 해석([05](05-constraint-solving.md)) 등 — 은 여기서 정의한 객체(벡터, 행렬, 사원수)와 연산 규칙, 그리고 부동소수점의 한계를 전제로 한다.

게임 물리 파이프라인을 한 틱(tick) 기준으로 추상화하면 다음과 같다.

```
[입력/상태]
  → 운동학(위치·속도 표현)         ... 01
  → 동역학(힘 → 가속도, 뉴턴 법칙)  ... 02
  → 적분(상태를 dt 만큼 전진)       ... 03
  → 충돌 검출(겹침/접촉 찾기)        ... 04
  → 제약/조인트 해석(겹침·관절 해소) ... 05, 06
  → [다음 상태]
```

이 모든 단계가 **공통으로** 사용하는 것이 본 문서(와 하위 문서)의 내용이다.

- **선형대수**는 위치/속도/힘 같은 물리량의 *컨테이너*이자 변환의 언어다. 04(충돌)의 분리축 정리(SAT), 05(제약)의 야코비안(Jacobian) 모두 벡터·행렬 연산이다.
- **회전 표현(사원수 등)**은 강체(rigid body)의 자세(orientation)를 다루는 02·03의 핵심 도구다. 적분 시 회전을 어떻게 전진시키는가가 03과 직결된다.
- **ODE 관점**은 "물리 시뮬레이션 = 미분방정식의 수치적 풀이"라는 03의 전체 프레임을 규정한다.
- **부동소수점/수치해석**은 12([결정론·네트워킹](12-determinism-networking.md))과 13([성능·병렬](13-performance-parallelism.md))의 근본 제약이다. 결정론(determinism)은 IEEE754 이해 없이는 불가능하다.

요컨대 이 기반을 읽지 않고 다른 노드를 읽으면 "왜 정규화(normalize)를 매 틱 다시 하는가", "왜 큰 좌표에서 떨림이 생기는가", "왜 오일러각을 쓰면 안 되는가" 같은 질문에 답할 수 없다.

---

## 2. 하위 문서 인덱스 (세부 이론)

수학 기반은 주제별로 분할되어 있다. 각 문서는 정의 → 수식 → 알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [00-foundations/01-vectors.md](00-foundations/01-vectors.md) | 벡터 | norm·정규화·내적·외적·2D 외적 |
| 2.2 | [00-foundations/02-matrices-transforms.md](00-foundations/02-matrices-transforms.md) | 행렬과 변환 | 아핀 4x4·합성·정규직교·Gram-Schmidt·(UE5 워크드 예제) |
| 2.3 | [00-foundations/03-rotations.md](00-foundations/03-rotations.md) | 회전의 표현 | 행렬·오일러·축각·사원수·SLERP |
| 2.3a | [00-foundations/03a-quaternions-geometric.md](00-foundations/03a-quaternions-geometric.md) | 사원수 기하학적 심화 | 복소수→S³·반각·sandwich·이중 덮개·SLERP (🎨 드래그 viz) |
| 2.4 | [00-foundations/04-calculus-ode.md](00-foundations/04-calculus-ode.md) | 미적분·ODE | 도함수·상태공간·안정성·테일러 |
| 2.5 | [00-foundations/05-numerical-floating-point.md](00-foundations/05-numerical-floating-point.md) | 수치해석·부동소수점 | IEEE754·상쇄·조건수·epsilon 비교 |
| 2.6 | [00-foundations/06-identities-approximations.md](00-foundations/06-identities-approximations.md) | 항등식·근사 | 소각근사·NLERP·clamp·rsqrt |

> 🎨 **인터랙티브 시각화**: [00-foundations/vectors-dot-cross.html](00-foundations/vectors-dot-cross.html) — 내적·외적의 기하학적 의미를 점을 드래그하며 직접 실험(외부 라이브러리 없는 순수 Canvas 2D).

---

## 3. 한눈 요약 — 도구 비교

수학 기반에서 선택지가 갈리는 도구들을 한 표로 모았다. 상세는 각 하위 문서.

| 도구 | 목적 | 장점 | 단점/트레이드오프 |
|---|---|---|---|
| 회전 행렬(3x3) | 회전 표현·벡터 회전 | 곱 한 번에 회전, SIMD/GPU 친화 | 9성분 중복, 재직교화 필요, 보간 난해 |
| 오일러각 | 오소링·UI 입력 | 사람이 직관적 | 짐벌락, 순서 의존, 보간 불량 |
| 축-각 / 회전 벡터 | 각속도 연결, 최소 표현 | 물리적 의미 명확 | 합성 어려움, 0 근방 불안정 |
| 사원수 | 자세 저장·적분·보간 | 컴팩트(4성분), 정규화 저렴, 짐벌락 없음, SLERP | 비직관적, double-cover 부호 처리 |
| 4x4 동차행렬 | 아핀 변환(회전+이동+스케일) | 변환 합성·계층(scene graph) 일관 | 메모리/연산량, 비균등 스케일 시 법선 처리 주의 |
| double 정밀도 | 큰 월드·정밀 적분 | 정밀도 16자리 | 메모리 2배, SIMD 폭 절반, 결정론 동일 보장은 별개 |
| 고정소수점(fixed-point) | 크로스플랫폼 결정론 | 비트 단위 재현성 | 동적 범위 제한, 구현 복잡 (→ [12](12-determinism-networking.md)) |
| SIMD(SSE/AVX/NEON) | 벡터·배치 연산 가속 | 4~8배 처리량 | 데이터 정렬(SoA), 플랫폼별 반올림 차이 주의 |

**좌표계 규약(handedness) 선택** — 엔진마다 다르다. 왼손/오른손, Y-up/Z-up. 한 번 정하면 외적의 부호, 회전 방향, 행렬 곱 순서가 전부 거기에 묶인다. 혼용은 부호 버그의 단골 원인.

**행 우선 vs 열 우선(row-major vs column-major)** — 메모리 레이아웃과 곱 순서 규약이 엮인다. DirectX/HLSL 전통은 행 우선·행벡터, OpenGL/수학 교과서는 열 우선·열벡터. 인터롭 시 전치(transpose) 필요 여부를 항상 확인.

---

## 4. 실무 (엔진은 무엇을 쓰는가)

수학 기반 계층에서 주요 엔진의 선택은 대체로 수렴한다.

- **자세 표현**: Bullet, PhysX, Havok, Jolt, Box2D(2D는 단순 각), **Chaos(UE5)** 모두 내부 강체 자세를 **사원수**로 저장하고 각속도로 적분한다. 행렬은 충돌/렌더로 넘길 때 변환한다.
- **Jolt Physics**: 결정론과 멀티스레드를 목표로 SIMD(SSE/AVX/NEON)를 적극 활용. `Vec3`/`Quat`/`Mat44` 자체 수학 라이브러리, float 기반이되 연산 순서를 고정해 *동일 바이너리* 내 결정론을 보장(크로스플랫폼은 별도 보장 아님). 게임 물리 수치 기반의 모범 사례.
- **PhysX(NVIDIA)**: `PxVec3`, `PxQuat`, `PxMat44`. float 기반. GPU 가속(rigid/cloth/particle) 경로는 부동소수점 비결정성을 동반하므로 결정론이 필요하면 CPU 경로.
- **Havok**: 상용 콘솔 타이틀 다수. SIMD 최적화 수학, 결정론 옵션 제공.
- **Bullet**: 오픈소스 표준. `btVector3`(SIMD 정렬), `btQuaternion`, `btTransform`. 교육·로보틱스에서도 널리 쓰임.
- **Box2D**: 2D. 회전은 단일 각/`b2Rot`(cos·sin 쌍)으로 표현 — 2D에서는 사원수가 과하다. v3 부터 SIMD 와이드 솔버 도입.
- **Chaos (Unreal Engine 5)**: UE 의 `FVector`(double, UE5부터 LWC — Large World Coordinates), `FQuat`, `FTransform`, `FMatrix`. **UE5 의 LWC** 가 "큰 좌표 정밀도" 문제([00-foundations/05](00-foundations/05-numerical-floating-point.md))에 대한 엔진 차원의 대응 — 좌표를 double 로 승격해 거대 월드의 떨림을 줄였다. 단 double 이라도 자동 결정론을 보장하진 않는다.

공통 패턴: **핵심 수학 타입은 SIMD 정렬(16바이트)된 자체 구조체**로 두고, 정규화·역제곱근에 하드웨어 명령을 쓰며, 사원수 자세를 매 스텝 정규화한다.

---

## 5. 공통 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **정규화 빠뜨림**: 사원수/회전 행렬을 적분하고 정규화를 안 하면 누적 오차로 스케일이 섞이거나(행렬) 회전이 왜곡된다(사원수). → 매 스텝 또는 주기적 재투영 필수. ([00-foundations/03](00-foundations/03-rotations.md))
- **`acos`/`asin`에 클램프 누락**: 내적 결과가 반올림으로 `1.0000001` 이 되면 `acos` 가 NaN. 항상 `clamp(x, -1, 1)`. ([00-foundations/06](00-foundations/06-identities-approximations.md))
- **0 길이 정규화**: `v/|v|` 에서 `|v|=0` → NaN/Inf. 길이 epsilon 체크 후 폴백(예: 영벡터 또는 기본 축) 처리. ([00-foundations/01](00-foundations/01-vectors.md))
- **부동소수점 `==` 비교**: 누적 오차로 정확히 같아지는 일은 거의 없다. epsilon 비교 사용. ([00-foundations/05](00-foundations/05-numerical-floating-point.md))
- **상쇄(cancellation)**: 큰 두 좌표의 차로 작은 변위를 구할 때 정밀도 폭락. 가능하면 로컬 좌표/상대 좌표로 계산. ([00-foundations/05](00-foundations/05-numerical-floating-point.md))
- **결합법칙 의존**: `(a+b)+c == a+(b+c)` 를 가정하지 말 것. 특히 **멀티스레드 리덕션(reduction)의 합산 순서**가 비결정적이면 결과 비트가 갈린다 → 결정론 깨짐([12](12-determinism-networking.md), [13](13-performance-parallelism.md)). 순서 고정 또는 보상합(Kahan summation).
- **크로스플랫폼 부동소수점 차이**: 컴파일러 최적화(`-ffast-math`, FMA), x87 80비트 확장정밀, SIMD 반올림 모드, 초월함수(`sin/cos`) 구현 차이로 같은 코드가 플랫폼마다 다른 비트를 낸다. 진짜 결정론(lockstep)에는 고정소수점 또는 엄격히 통제된 부동소수점 빌드가 필요([12](12-determinism-networking.md)).
- **`-ffast-math` 위험**: NaN/Inf 가정 완화, 재결합 허용 → 성능은 얻지만 결정론·정확도를 잃는다. 물리 코어에는 보통 끈다.
- **double-cover 부호**: 사원수 보간/비교 전 `q1.q2 < 0` 이면 한쪽 부호 반전. 안 하면 "먼 길로 도는" 보간이나 잘못된 거리. ([00-foundations/03](00-foundations/03-rotations.md))
- **큰 월드 떨림(far-from-origin jitter)**: 원점에서 멀어질수록 ULP 가 커져 위치/물리가 떨린다. origin rebasing, 타일 좌표, 또는 double/LWC(UE5)로 대응. ([00-foundations/05](00-foundations/05-numerical-floating-point.md))
- **비균등 스케일과 법선**: 비균등 스케일(non-uniform scale) 행렬로 법선을 변환할 때 같은 행렬을 쓰면 안 됨 → **역전치(inverse transpose)** 행렬을 써야 직교성이 유지된다. ([00-foundations/02](00-foundations/02-matrices-transforms.md))

---

## 6. 더 읽기 / 관련 노드

**형제 노드 (이 기반을 직접 사용하는 곳)**
- [01-kinematics](01-kinematics.md) — 위치·속도·각속도, 회전의 운동학적 적용
- [02-dynamics](02-dynamics.md) — 뉴턴-오일러 방정식, 관성텐서, 토크(외적의 물리)
- [03-time-integration](03-time-integration.md) — ODE 수치 적분기, 안정성/심플렉틱, 자세 적분
- [04-collision-detection](04-collision-detection.md) — 분리축 정리(SAT), GJK (벡터·투영 집약)
- [05-constraint-solving](05-constraint-solving.md) — 야코비안, 선형계 풀이, 조건수
- [12-determinism-networking](12-determinism-networking.md) — 고정소수점, 부동소수점 결정론, lockstep
- [13-performance-parallelism](13-performance-parallelism.md) — SIMD, 병렬 리덕션과 합산 순서

**외부 레퍼런스**
- David H. Eberly, *Game Physics* (2nd ed.) / *3D Game Engine Design* — 수학 기반의 백과사전급 레퍼런스.
- Christer Ericson, *Real-Time Collision Detection* — 벡터·기하 연산과 수치 안정성의 실무 바이블.
- Ian Millington, *Game Physics Engine Development* — 밑바닥부터 엔진을 만드는 입문서.
- Eric Lengyel, *Foundations of Game Engine Development, Vol.1: Mathematics* — 선형대수·변환·사원수 집중.
- Ken Shoemake, "Animating Rotation with Quaternion Curves" (SIGGRAPH 1985) — SLERP 의 원전.
- David Goldberg, "What Every Computer Scientist Should Know About Floating-Point Arithmetic" (1991) — IEEE754 필독 논문.
- Erin Catto (Box2D), GDC 강연 시리즈 — "Soft Constraints", "Numerical Methods" 등 실무 수치 기법.
- Quake III Arena 소스 (`q_math.c`) — fast inverse sqrt 의 역사적 원본.
