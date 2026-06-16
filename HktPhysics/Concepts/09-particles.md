# [09] 파티클·이펙트 (Particles) — 허브

> 회전 없는 질점(point mass)을 수천~수백만 개 대량으로 굴리는, 가장 단순한 동역학의 가장 큰 규모 적용 — 정확도보다 처리량(throughput)이 지배한다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [09-particles/](09-particles/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
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

> 실무 규칙: "한 입자가 다른 입자의 상태를 읽어야 하는가?"가 분기점이다. 아니오 → 09(완전 병렬, embarrassingly parallel). 예 → 08(SPH)/07(spring). 이 판단 트리의 전모는 [09-particles/05-simulation-boundary.md](09-particles/05-simulation-boundary.md).

---

## 2. 하위 문서 인덱스 (세부 이론)

파티클 시스템을 직관 단위로 분할했다. 각 문서는 정의 → 수식/알고리즘 → 실무 트레이드오프를 담는다. 권장 순서는 위에서 아래.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [09-particles/01-lifecycle-emitter.md](09-particles/01-lifecycle-emitter.md) | 수명주기와 에미터 | spawn·update·kill·pool·ring buffer·SoA·분포 샘플링·RNG |
| 2.2 | [09-particles/02-force-fields.md](09-particles/02-force-fields.md) | 힘·필드와 간이 충돌 | gravity·drag·attractor·vortex·curl noise·plane/SDF/depth 충돌 |
| 2.3 | [09-particles/03-integration.md](09-particles/03-integration.md) | 적분 (비용 우선) | symplectic Euler·Verlet·"눈에 안 띌 만큼"의 정확도 철학 |
| 2.4 | [09-particles/04-gpu-particles.md](09-particles/04-gpu-particles.md) | GPU 파티클 파이프라인 | compute shader·SSBO·emit/update/compact/sort/render·depth/SDF collision |
| 2.4a | [09-particles/04a-gpu-pipeline-dataflow.md](09-particles/04a-gpu-pipeline-dataflow.md) | GPU 데이터 흐름 심화 | zero-readback·free-list·atomic compaction·bitonic sort·indirect draw (왜) |
| 2.5 | [09-particles/05-simulation-boundary.md](09-particles/05-simulation-boundary.md) | 시뮬과의 경계 | 09 vs 07/08·판단 트리·비용 차수·이웃 탐색 문턱 |

---

## 3. 한눈 요약 — 언제 무엇을

09 내부에서 갈리는 선택, 그리고 09를 떠나야 하는 경계를 한 표로 모았다. 상세는 [09-particles/05-simulation-boundary.md](09-particles/05-simulation-boundary.md).

| 종류 | 입자–입자 상호작용 | 환경 충돌 | 적분 | 분기 |
|---|---|---|---|---|
| **단순(시각) 파티클** | 없음 | 없음/plane 근사 | symplectic Euler | **09** |
| **충돌 인식 파티클** | 없음 | SDF/depth/plane | Euler + 충돌 응답 | **09**(+[11]) |
| **상호작용 입자(천/연기)** | 스프링 | 정확 | Verlet/XPBD | [07](07-deformable-bodies.md) |
| **유체 입자** | 압력·점성(이웃 탐색) | 정확 | PBF/PCISPH | [08](08-fluids.md) |

비용 차수의 직관: 단순 파티클은 입자당 O(1)이라 N에 선형이고 GPU 친화적. 이웃 탐색이 생기는 순간 [11 공간 구조](11-spatial-structures.md)가 필수가 되고 비용이 한 자릿수 뛴다 — 이것이 08/07로 넘어가는 진짜 문턱이다.

**CPU vs GPU 구현 선택:**

| 구현 | 규모 | 강점 | 트레이드오프 |
|---|---|---|---|
| **CPU 파티클** | 수백~수만 | 게임플레이 결합 쉬움, 결정론 확보 쉬움 | 대량 불가, SoA+SIMD로 한계 확장 |
| **GPU 파티클(compute)** | 수십만~수백만 | 압도적 처리량, zero readback | 결정론 어려움, 충돌이 근사(depth/SDF), CPU와 데이터 단절 |

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
- 충돌의 실무 기본값: 화면에 보이는 대량 이펙트는 **depth-buffer collision**, 정확도가 필요한 소수는 **plane/SDF**, 게임플레이 영향(데미지 볼륨 등)은 아예 파티클이 아닌 [04 충돌](04-collision-detection.md) 쿼리로 분리하는 것이 정석이다. (충돌 근사 상세 → [09-particles/02-force-fields.md](09-particles/02-force-fields.md), [09-particles/04-gpu-particles.md](09-particles/04-gpu-particles.md))
- UE 구체: Niagara의 GPU sim은 [11](11-spatial-structures.md) 없이도 환경 충돌을 Global SDF로 처리하고, 입자 간 상호작용이 필요하면 Niagara Fluids(이건 사실상 [08])로 넘어간다.

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **결정론 분리가 09의 1순위 원칙**([12 결정론](12-determinism-networking.md)). 게임플레이 영향 파티클(투사체·데미지/회복 볼륨·트랩 트리거)은 시뮬 결정론 **필수**(고정 timestep, 결정론 RNG, 연산 순서 고정, GPU 비결정성 회피) — 보통 이런 것은 파티클로 만들지 말고 정식 [04]/[05] 객체로 둔다. 순수 시각 효과(불꽃·연기·잔해)는 비결정 허용. (전반: [09-particles/01-lifecycle-emitter.md](09-particles/01-lifecycle-emitter.md), [09-particles/05-simulation-boundary.md](09-particles/05-simulation-boundary.md))
- **RNG 공유 오염**: 시각 파티클 RNG가 게임플레이 RNG 스트림과 같은 시드를 당기면 결정론 게임플레이가 깨진다 → 스트림을 물리적으로 분리. (09-particles/01-lifecycle-emitter)
- **dt 의존성**: `v += a*dt; x += v*dt`에서 가변 dt는 비결정 + 외형 변화. 게임플레이 영향분은 [03]의 고정 timestep accumulator 필수. 방출 누적기 소수부 carry도 dt 의존. (09-particles/01-lifecycle-emitter, particles/03-integration)
- **swap-and-pop 순서 비결정**: 죽은 슬롯 교체로 배열 순서가 바뀌면 순서 의존 부동소수점 연산이 미세하게 달라진다. 결정론 경로에선 순서 안정 소멸 또는 stable index. (09-particles/01-lifecycle-emitter)
- **GPU 비결정성**: atomic 카운터 기반 emit/compaction은 스레드 경합 순서가 비결정 → 입자 인덱스·정렬 결과가 실행마다 다름. 시각엔 무해, 게임플레이엔 치명적. (09-particles/04-gpu-particles, particles/04a-gpu-pipeline-dataflow)
- **Depth-buffer collision의 구조적 한계**([13](13-performance-parallelism.md)): 화면 밖·오클루전 충돌 누락, 얇은/뒤쪽 면 관통, 화면공간 normal 부정확, 카메라 의존(결정론 불가). 정확/결정론이 필요하면 SDF 또는 정식 충돌로. (09-particles/02-force-fields, particles/04-gpu-particles)
- **Pool 고갈 정책 미정**: `MaxParticles` 초과 시 동작(드롭 vs 강제소멸)을 안 정하면 "버스트 때 이펙트가 사라지는" 비결정 버그. (09-particles/01-lifecycle-emitter)
- **과잉 정확도**: RK4·암시적 적분을 시각 파티클에 쓰는 건 비용 낭비. 정확도가 필요하면 그건 09가 아니라 07/08이다. (09-particles/03-integration, particles/05-simulation-boundary)
- **curl noise 누락 시 뭉침**: 단순 noise를 속도장으로 쓰면 발산≠0이라 입자가 뭉치거나 흩어진다. curl(noise)로 발산 0 보장. (09-particles/02-force-fields)

---

## 6. 더 읽기 / 관련 노드

**형제 노드**
- [03-time-integration](03-time-integration.md) — symplectic Euler/Verlet, 고정 timestep (직접 의존)
- [02-dynamics](02-dynamics.md) — 질점 동역학(F = ma)의 가장 단순한 형태가 곧 파티클 (선행 개념)
- [07-deformable-bodies](07-deformable-bodies.md) — 상호작용=스프링, "입자가 서로 영향을 주면" 넘어가는 곳 (경계 형제)
- [08-fluids](08-fluids.md) — 상호작용=압력·SPH (경계 형제)
- [04-collision-detection](04-collision-detection.md) · [11-spatial-structures](11-spatial-structures.md) — 충돌 인식 시 broad phase
- [12-determinism-networking](12-determinism-networking.md) — 게임플레이 vs 시각 결정론 분리 (횡단)
- [13-performance-parallelism](13-performance-parallelism.md) — GPU compute, depth-buffer collision 비용/한계, SoA·SIMD (횡단)

**외부 레퍼런스**
- Robert Bridson, "Curl-Noise for Procedural Fluid Flow" (SIGGRAPH 2007) — 발산 0 절차적 속도장의 원전.
- Wolfgang Engel (ed.), *GPU Pro / GPU Zen* 시리즈 — GPU 파티클 파이프라인·indirect draw 실무 기법.
- Lutz Latta, "Building a Million Particle System" (GDC 2004) — GPU 파티클의 역사적 출발점.
- UE Niagara / Unity VFX Graph 공식 문서 — 모듈러 스택·compute-graph 의 산 예시.

### 형제 문서 전체
[00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · **09-particles.md** · [10-specialized-systems.md](10-specialized-systems.md) · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · [13-performance-parallelism.md](13-performance-parallelism.md)
