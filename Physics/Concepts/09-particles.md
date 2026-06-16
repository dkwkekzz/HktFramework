# [09] 파티클·이펙트 (Particles)

> 회전 없는 질점(point mass)을 수천~수백만 개 대량으로 굴리는, 가장 단순한 동역학의 가장 큰 규모 적용 — 정확도보다 처리량(throughput)이 지배한다.
> **상위 지도**: [Concepts/README.md](README.md) · **의존**: [03-time-integration.md](03-time-integration.md)

---

## 1. 위치와 역할

파티클 시스템(particle system)은 [02 동역학](02-dynamics.md)의 **질점(point mass)** — 즉 위치·속도만 갖고 회전·관성텐서를 무시하는 가장 단순한 물체 — 를 **대량으로** 동시에 시뮬레이션하는 분기다. 강체 파이프라인이 "소수의 물체를 정확하게" 푼다면, 파티클은 "다수의 물체를 싸게" 푼다.

DAG 상 위치(README §2)는 명확하다:

```
[03 적분] ──→ [09 파티클]
[11 공간 구조] ──→ [09 파티클]   (충돌 인식 파티클의 broad phase)
[12 결정론] ⟂ [09]              (게임플레이 영향 파티클은 결정론 필요)
[13 성능]   ⟂ [09]              (GPU compute 가 사실상 표준 구현)
```

핵심은 **무엇에 의존하지 *않는가*** 다. 순수 시각 효과 파티클은 [04 충돌 감지]의 narrow phase, [05 구속 해법]의 임펄스 솔버, [06 조인트]를 **전부 건너뛴다**. 입자끼리의 상호작용(particle–particle interaction)이 본격화되면 그것은 더 이상 "파티클"이 아니라 [07 변형체](07-deformable-bodies.md)(mass–spring)거나 [08 유체](08-fluids.md)(SPH)다. 09의 정체성은 **상호작용 없는(또는 단방향) 독립 질점의 군집**이라는 점에 있다.

> 실무 규칙: "한 입자가 다른 입자의 상태를 읽어야 하는가?"가 분기점이다. 아니오 → 09(완전 병렬, embarrassingly parallel). 예 → 08(SPH)/07(spring).

---

## 2. 핵심 이론

### 2.1 파티클의 상태와 life-cycle

한 입자의 최소 상태는 질점 동역학 그 자체다:

```
struct Particle {
    vec3  position;     // x
    vec3  velocity;     // v
    float age;          // 생성 후 경과 시간
    float lifetime;     // 총 수명 (age >= lifetime → 소멸)
    // 시각 속성 (물리 무관): color, size, rotation(빌보드용 스칼라각), ...
}
```

생애주기(life-cycle)는 세 단계 루프다 — 이것이 강체 파이프라인과 가장 다른 점, 즉 **입자가 매 프레임 태어나고 죽는다**:

```
1. SPAWN   에미터가 방출률에 따라 신규 입자 생성, 초기 분포 샘플링
2. UPDATE  force field 적분(03) → age += dt
3. KILL    age >= lifetime || 경계 이탈 || 충돌 소멸 → 슬롯 반환
```

### 2.2 메모리 — pool 과 ring buffer (life-cycle 의 진짜 비용)

매 프레임 수만 개를 할당/해제하면 힙이 죽는다. 그래서 파티클 시스템의 자료구조는 사실상 **고정 크기 풀(fixed-size pool)**로 정해져 있다.

- **Object pool**: `MaxParticles` 크기 배열을 선두 할당. `aliveCount`로 활성 구간 관리. 소멸 시 **swap-and-pop**(죽은 슬롯을 마지막 활성 입자와 교환 후 `aliveCount--`) — 순서가 깨지지만 O(1)이고 활성 입자가 배열 앞쪽에 조밀하게 유지되어 캐시·SIMD에 유리하다.
- **Ring buffer**: 수명이 균일할 때, 가장 오래된 것이 항상 먼저 죽으므로 head/tail 인덱스만으로 관리. 정렬 불필요.
- **SoA(Structure of Arrays)**: `position[]`, `velocity[]`를 분리 배열로 — SIMD/GPU coalesced access의 전제. AoS(위 struct 나열)는 직관적이지만 대량에선 SoA가 표준([13 성능](13-performance-parallelism.md)).

> 핵심 통찰: 파티클 "물리"의 절반은 적분이 아니라 **메모리 회전(pool 재활용)**이다. 풀 고갈(pool exhaustion) 시 정책 — 신규 방출 드롭 vs 가장 오래된 것 강제 소멸 — 을 명시해야 한다.

### 2.3 에미터 (Emitter) — 분포의 샘플링

에미터는 입자를 **어디서·얼마나·어떤 초기 상태로** 만드는가를 규정한다.

방출 모드:

```
Continuous : 초당 R 개. 누적 = R * dt. 소수부 carry 로 dt 변동 흡수.
             spawnCount = floor(emitAccumulator); emitAccumulator -= spawnCount;
Burst      : 특정 시각 t 에 N 개 한꺼번에 (폭발·타격 이펙트).
```

초기 분포(initial distribution) 샘플링:

```
위치  : 점 / 선 / 디스크 / 구 / 박스 / 메시 표면 — 형상 위 균일 샘플
속도  : 방향(콘 각도 등) + 속력 [vmin, vmax] 무작위
수명  : lifetime ∈ [Lmin, Lmax]
크기/색: life 에 따른 커브(curve)로 보간 (대부분 시각 전용)
```

여기서 **모든 무작위는 RNG 호출**이며, 이것이 결정론(§5)의 첫 번째 지뢰다.

### 2.4 힘·필드 (Force Fields) — 09 의 동역학 본체

입자에 작용하는 가속도는 외부 **장(field)**들의 단순 합이다. 입자끼리 영향을 주지 않으므로(08과 결정적 차이) 각 입자는 독립적으로 `a(x, v, t)`만 계산하면 된다:

```
a_total = Σ_field  a_field(x, v, t)

중력(gravity)   : a = g                                  (상수)
항력(drag)      : a = -k * v          (선형)  또는  -k * |v| * v  (이차)
끌림(attractor) : a = G * (p_center - x) / |p_center - x|^3    (점 인력/척력)
와류(vortex)    : a = ω × (x - axis)                     (축 주위 회전)
난류(turbulence): a = curl( noise(x, t) )                (curl noise — 발산 0)
```

**Curl noise**가 핵심 기법이다. 단순 noise를 속도장으로 쓰면 발산(divergence)이 0이 아니라 입자가 한 점으로 뭉치거나 흩어진다. noise 포텐셜의 회전(curl)을 취하면 `∇·(∇×F)=0`이 항상 성립 → **비압축성처럼 보이는** 자연스러운 소용돌이를 입자 상호작용 없이 싸게 얻는다(유체의 외형을 SPH 비용 없이 흉내).

충돌(collision)은 09에서 **근사**로 처리한다:

```
Plane collision        : signed distance < 0 이면 위치 보정 + 속도 반사(v' = v - (1+e)(v·n)n)
SDF collision          : 정적 형상을 부호거리장으로 굽고 입자마다 질의 (단일 물체엔 정확)
Depth-buffer collision  : GPU 파티클의 사실상 표준 (§3.3, §4)
```

### 2.5 적분 — 정확도보다 비용

대량이므로 입자당 연산을 최소화한다. [03 적분](03-time-integration.md)에서 **symplectic Euler**가 사실상 기본값이다 — 1차 정확도지만 입자당 곱셈 몇 번, 에너지가 폭주하지 않는 안정성:

```
// Symplectic(semi-implicit) Euler — v 를 먼저 갱신, 그 v 로 x 갱신
v += a(x, v, t) * dt;
x += v * dt;
```

스프링 같은 복원력이 끼면 **Verlet**도 쓴다(위치 기반, 속도 묵시적):

```
x_new = 2*x - x_prev + a * dt^2;
x_prev = x;   x = x_new;
```

RK4/암시적 적분은 09에선 거의 안 쓴다 — 입자당 4번 force 평가는 수백만 규모에서 사치다. "한 입자가 좀 틀려도 화면엔 안 보인다"가 09의 정확도 철학이다.

### 2.6 시뮬과의 경계 — 언제 무엇을 (이 문서의 의사결정 핵심)

| 종류 | 입자–입자 상호작용 | 환경 충돌 | 적분 | 분기 |
|---|---|---|---|---|
| **단순(시각) 파티클** | 없음 | 없음/plane 근사 | symplectic Euler | **09** |
| **충돌 인식 파티클** | 없음 | SDF/depth/plane | Euler + 충돌 응답 | **09**(+[11]) |
| **상호작용 입자(천/연기)** | 스프링 | 정확 | Verlet/XPBD | [07](07-deformable-bodies.md) |
| **유체 입자** | 압력·점성(이웃 탐색) | 정확 | PBF/PCISPH | [08](08-fluids.md) |

판단 트리:

```
입자가 서로의 상태를 읽는가?
├─ 아니오 → 환경과 충돌하는가?
│           ├─ 아니오 → 단순 파티클 (09, GPU 로 수백만 가능)
│           └─ 예    → 충돌 인식 파티클 (09 + SDF/depth, [11] broad phase)
└─ 예    → 유지 거리/밀도가 핵심인가?
            ├─ 거리(형상 유지) → 변형체 [07]
            └─ 밀도(비압축)   → 유체 [08]
```

비용 차수의 직관: 단순 파티클은 입자당 O(1)이라 N에 선형이고 GPU 친화적. 이웃 탐색이 생기는 순간 [11 공간 구조](11-spatial-structures.md)가 필수가 되고 비용이 한 자릿수 뛴다 — 이것이 08/07로 넘어가는 진짜 문턱이다.

---

## 3. 주요 기법/도구

### 3.1 CPU 파티클
소규모(수백~수천), 게임플레이 로직 결합이 쉬운 경우. SoA + SIMD로 수만까지. swap-and-pop 풀. 결정론 확보가 쉽다(§5).

### 3.2 GPU 파티클 (compute shader)
대량(수십만~수백만)의 표준. 입자 상태를 GPU 버퍼(SSBO/structured buffer)에 두고 **compute shader**가 업데이트:

```
[Emit pass]    indirect dispatch 로 spawnCount 만큼 슬롯 채움 (atomic counter 로 free-list 관리)
[Update pass]  per-thread = per-particle: force field 합산 → 적분 → age++
[Compact/Kill] 죽은 입자 제거 (atomic compaction 또는 alive list 재구성)
[Sort pass]    알파 블렌딩용 view-depth 정렬 (bitonic sort) — 필요 시
[Render]       instanced billboard draw (indirect args 로 CPU readback 회피)
```

CPU는 거의 관여하지 않는다(zero readback이 목표) — 카운트조차 GPU에 머물고 `DrawIndirect`로 렌더한다.

### 3.3 Depth-buffer collision (GPU 파티클의 충돌 근사)
GPU 파티클은 씬 지오메트리를 모른다(전체를 GPU로 넘기는 비용 과다). 그래서 **이미 렌더된 depth buffer**를 충돌 표면으로 재활용한다: 입자를 화면 공간에 투영 → 해당 픽셀 depth와 비교 → 입자가 표면 "뒤"면 충돌로 간주, 화면공간 normal(depth 미분)로 반사. 한계는 §5와 [13](13-performance-parallelism.md)에서 다룬다.

### 3.4 SDF collision
정적/소수 동적 형상을 부호거리장(signed distance field)으로 미리 구워 3D 텍스처로 GPU에 상주. 입자마다 1회 샘플로 거리·gradient(normal) 획득 → depth-buffer 방식의 화면 의존성을 제거. 동적 형상은 SDF 갱신 비용 때문에 제한적.

### 3.5 정렬 (sorting)
물리가 아니라 렌더 문제지만 GPU 파이프라인에 끼므로 언급: 반투명 알파 블렌딩은 back-to-front 정렬 필요 → GPU **bitonic sort**(O(N log²N), GPU 친화). additive 블렌딩은 순서 무관 → 정렬 생략 가능.

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진/도구 | 성격 | 파티클 구현 요점 |
|---|---|---|
| **UE Niagara** | UE5 표준(Cascade 대체) | 모듈러 스택, CPU/GPU sim 선택, depth-buffer + Global Distance Field(SDF) collision, GPU 정렬 |
| **UE Cascade** | 레거시 | 모듈 기반, 주로 CPU. Niagara 로 이전 |
| **Unity VFX Graph** | HDRP/URP, GPU 중심 | compute-graph 노드 그래프, 수백만 GPU 입자, depth collision |
| **Unity Shuriken** | 빌트인, CPU 중심 | 컴포넌트 기반, 게임플레이 결합 쉬움, 소~중규모 |
| **PopcornFX** | 미들웨어 | 크로스 플랫폼, CPU+GPU 하이브리드, 에디터 강력 |

- README §5 엔진 매핑: 실시간 물리 엔진(PhysX/Chaos)도 GPU 파티클(particle/fluid)을 제공하지만, 게임 이펙트의 대다수는 **VFX 시스템**(위 표)이 담당한다 — 물리 엔진과 VFX는 보통 별도 파이프라인이다.
- 충돌의 실무 기본값: 화면에 보이는 대량 이펙트는 **depth-buffer collision**, 정확도가 필요한 소수는 **plane/SDF**, 게임플레이 영향(데미지 볼륨 등)은 아예 파티클이 아닌 [04 충돌](04-collision-detection.md) 쿼리로 분리하는 것이 정석이다.
- UE 구체: Niagara의 GPU sim은 [11](11-spatial-structures.md) 없이도 환경 충돌을 Global SDF로 처리하고, 입자 간 상호작용이 필요하면 Niagara Fluids(이건 사실상 [08])로 넘어간다.

---

## 5. 함정·결정론 주의

- **결정론 분리가 09의 1순위 원칙**([12 결정론](12-determinism-networking.md)). 두 부류를 코드 경로부터 갈라라:
  - **게임플레이 영향 파티클**(투사체, 데미지/회복 볼륨, 트랩 트리거): 시뮬 결정론 **필수**. 고정 timestep, 결정론 RNG(seed 동기화), 연산 순서 고정, GPU 비결정성 회피(가능하면 CPU 시뮬 또는 결과를 게임플레이에 되먹이지 말 것). 보통 이런 것은 **파티클로 만들지 말고** 정식 [04]/[05] 객체로 둔다.
  - **순수 시각 효과**(불꽃, 연기, 잔해 비주얼): 비결정 허용. 클라이언트마다 달라도 무방 — 오히려 GPU 비동기·프레임률 의존을 자유롭게 써도 된다.
- **RNG 공유 오염**: 시각 파티클의 RNG가 게임플레이 RNG 스트림과 같은 시드를 당기면, 비결정 시각 효과가 결정론 게임플레이를 깨뜨린다. **스트림을 물리적으로 분리**하라(별도 RNG 인스턴스).
- **dt 의존성**: `v += a*dt; x += v*dt`에서 가변 dt(프레임률 변동)는 비결정 + 외형 변화를 낳는다. 게임플레이 영향분은 [03]의 **고정 timestep accumulator** 필수. 방출 누적기의 소수부 carry도 dt에 의존하므로 결정론 경로에선 고정 dt 가정.
- **swap-and-pop 순서 비결정**: 죽은 슬롯 교체로 배열 순서가 바뀌면, 순서 의존 연산(합산 누적 순서 등 부동소수점)이 미세하게 달라진다. 결정론 경로에선 순서 안정 소멸 또는 stable index 사용.
- **GPU 비결정성**: atomic 카운터 기반 emit/compaction은 스레드 경합 순서가 비결정 → 입자 인덱스·정렬 결과가 실행마다 다를 수 있다. 시각엔 무해, 게임플레이엔 치명적. 부동소수점 GPU 연산은 드라이버/하드웨어별로도 다르다([12]).
- **Depth-buffer collision의 구조적 한계**([13](13-performance-parallelism.md)):
  - 화면 밖·오클루전 뒤 표면은 depth가 없어 **충돌 누락**(입자가 통과).
  - depth는 가장 앞 표면만 알므로 **얇은/뒤쪽 면 관통**.
  - 화면공간 normal은 depth 미분 추정이라 가장자리에서 부정확.
  - 카메라 의존 → 같은 입자가 카메라 각도에 따라 다르게 충돌(결정론 불가). 정확/결정론이 필요하면 SDF 또는 정식 충돌로.
- **Pool 고갈 정책 미정**: `MaxParticles` 초과 시 동작을 정하지 않으면 "버스트 때 이펙트가 사라지는" 비결정적 버그. 드롭/강제소멸 정책을 명시.
- **과잉 정확도**: RK4·암시적 적분을 시각 파티클에 쓰는 건 비용 낭비. 09의 정확도 예산은 "눈에 안 띌 만큼"이면 충분 — 정확도가 필요하면 그건 09가 아니라 07/08이다.

---

## 6. 더 읽기 / 관련 노드

- **직접 의존**: [03-time-integration.md](03-time-integration.md) — symplectic Euler/Verlet, 고정 timestep.
- **선행 개념**: [02-dynamics.md](02-dynamics.md) — 질점 동역학(힘 = 질량 × 가속도)의 가장 단순한 형태가 곧 파티클.
- **경계 형제**: [07-deformable-bodies.md](07-deformable-bodies.md)(상호작용=스프링), [08-fluids.md](08-fluids.md)(상호작용=압력·SPH) — "입자가 서로 영향을 주면" 넘어가는 곳.
- **충돌 인식 시**: [04-collision-detection.md](04-collision-detection.md), [11-spatial-structures.md](11-spatial-structures.md) — broad phase로 충돌 후보 추리기.
- **횡단**: [12-determinism-networking.md](12-determinism-networking.md)(게임플레이 vs 시각 결정론 분리), [13-performance-parallelism.md](13-performance-parallelism.md)(GPU compute, depth-buffer collision 비용/한계, SoA·SIMD).

### 형제 문서 전체
[00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · **09-particles.md** · [10-specialized-systems.md](10-specialized-systems.md) · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · [13-performance-parallelism.md](13-performance-parallelism.md)
