# [13] 성능·병렬 (Performance & Parallelism) — 허브

> 솔버를 더 빠르게: 접촉 그래프를 독립 island 로 쪼개 병렬화하고, 저에너지 바디를 재워(sleeping) 일을 줄이며, SoA·SIMD·job system·GPU 로 같은 수학을 더 적은 사이클에 돌린다 — 정확도·결정론을 화폐로.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [13-performance-parallelism/](13-performance-parallelism/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
> **상위 지도**: [Concepts/README.md](README.md) · **횡단 최적화 대상**: [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · **결정론 짝**: [12-determinism-networking.md](12-determinism-networking.md)

형제 문서: [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) · [10-specialized-systems.md](10-specialized-systems.md) · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · **[13-performance-parallelism.md]**

---

## 1. 위치와 역할

이 노드는 특정 솔버를 새로 만들지 않는다. 대신 **이미 정의된 솔버([03](03-time-integration.md) 적분 · [04](04-collision-detection.md) 충돌 · [05](05-constraint-solving.md) 구속)를 "어떻게 더 적은 시간·전력으로 돌리는가"** 를 다루는 횡단(cross-cutting) 관심사다. README 의 DAG 에서 `[13] ⟂ (04·05 에 island/sleeping/SIMD/GPU 로 가지를 침)` 로 표기된 그 가지다.

핵심 긴장 관계는 단 하나다:

```
성능  ↔  정확도  ↔  결정론
```

이 노드의 거의 모든 기법은 이 삼각형 안에서 하나를 깎아 다른 하나를 산다. 그래서 [12](12-determinism-networking.md) 결정론·네트워킹과 짝을 이룬다 — 12 가 "무엇을 보존해야 하는가"를 정하면, 13 은 "그 제약 안에서 얼마나 빨라질 수 있는가"를 정한다. **연산 순서·부동소수점 결합법칙·스레드 비결정성**이 곧장 12 의 위반으로 직결되므로, 이 문서의 모든 최적화는 "결정론 등급(level)"을 함께 명시한다.

물리는 프레임 예산을 두고 렌더·게임플레이·AI 와 경쟁한다. 60fps = 16.6ms, 그중 물리는 보통 2~5ms 안에 broadphase + narrowphase + 솔버 + 적분 + sleeping 전부를 끝내야 한다. 이 노드는 그 예산을 지키는 도구상자다.

---

## 2. 하위 문서 인덱스 (세부 이론)

성능·병렬은 직관 단위로 분할되어 있다. 각 문서는 정의 → 메커니즘 → 알고리즘 → 결정론 트레이드오프를 담는다. 권장 순서는 위에서 아래 — "안 해도 되는 일 줄이기(2.1)" → "데이터 빠르게(2.2)" → "코어로 흩기(2.3)" → "안전하게 쪼개고 결정론 지키기(2.4)" → "GPU(2.5)" → "어디를 얼마나(2.6)".

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [13-performance-parallelism/01-sleeping-island.md](13-performance-parallelism/01-sleeping-island.md) | Sleeping · Island | 연결 요소·union-find·island 단위 sleep·히스테리시스·wake 전파 |
| 2.2 | [13-performance-parallelism/02-data-layout.md](13-performance-parallelism/02-data-layout.md) | 데이터 레이아웃 (DOD) | SoA vs AoS·아레나·인덱스 핸들·false sharing |
| 2.2a | [13-performance-parallelism/02a-soa-simd-relayout.md](13-performance-parallelism/02a-soa-simd-relayout.md) | SoA·SIMD 재배치 심화 | lane 충전·정렬 로드·gather/scatter·캐시라인 |
| 2.3 | [13-performance-parallelism/03-job-system.md](13-performance-parallelism/03-job-system.md) | Job System · 태스크 병렬 | 단계별 병렬성·work-stealing·Task Graph/JobSystem |
| 2.4 | [13-performance-parallelism/04-parallel-solver-determinism.md](13-performance-parallelism/04-parallel-solver-determinism.md) | 병렬 솔버 · 합산 순서 결정론 | SIMD batch·고정 분할·정렬 reduction·atomic 금지 |
| 2.4a | [13-performance-parallelism/04a-graph-coloring-batching.md](13-performance-parallelism/04a-graph-coloring-batching.md) | 그래프 컬러링·배치 심화 | 충돌 그래프·독립 집합·색칠 GS·incremental 채색 |
| 2.5 | [13-performance-parallelism/05-gpu-physics.md](13-performance-parallelism/05-gpu-physics.md) | GPU Physics | SIMT·Jacobi vs GS·readback stall·결정론 포기 |
| 2.6 | [13-performance-parallelism/06-profiling-lod.md](13-performance-parallelism/06-profiling-lod.md) | 프로파일링·예산·물리 LOD | 프레임 예산·단계 계측·substep/iteration 다이얼·LOD |

> 📐 **심화 문서 두 개**: 직관 장벽이 높은 두 지점에 depth 를 두었다 — ① **2.2a** SoA 가 *왜* SIMD lane 을 채우고 AoS 는 왜 손해인가(데이터 재배치 직관), ② **2.4a** *하나의* 거대 island 내부를 그래프 컬러링으로 *어떻게* 병렬 충돌 솔버로 쪼개나.

---

## 3. 한눈 요약

### 주요 기법 — 무엇을 깎아 무엇을 사는가

| 기법 | 트레이드오프 | 한 줄 | 상세 |
|---|---|---|---|
| Island 분할 | (거의 손실 없음) → 병렬성 | 연결 요소 단위 독립 솔버 | (2.1) |
| Sleeping | 약간의 반응성 → 큰 CPU 절감 | 저에너지 island 비활성 | (2.1) |
| SoA 레이아웃 | 코드 복잡도 → 대역폭/SIMD | 같은 필드 연속 배치 | (2.2, 2.2a) |
| SIMD batch | 코드 복잡도 → 4·8× 처리량 | 컬러링된 batch 동시 풀이 | (2.4, 2.4a) |
| Job system | 결정론 난이도 → 코어 확장 | island/단계 병렬 | (2.3) |
| GPU 솔버 | 결정론·동기화비 → 대량 처리 | 입자/유체/옷감 대량화 | (2.5) |
| 물리 LOD | 정확도 → 비용 | 멀리/안 보이는 건 싸게 | (2.6) |
| 반복 수 튜닝 | 정확도 → 시간 | iteration/substep 다이얼 | (2.6) |

### 정확도 vs 성능 다이얼 (결정론 영향)

| 다이얼 | ↑ 올리면(정확) | ↓ 내리면(빠름) | 결정론 영향 |
|---|---|---|---|
| substep 수 | 안정·CCD↑, 침투↓ | 비용 선형↓ | 안전(고정이면) |
| solver iteration | 접촉 수렴↑, 떨림↓ | 비용↓ | 안전(고정이면) |
| sleeping 공격성 | 반응성↑ | CPU↓ 크게 | 임계/타이머 스냅샷 필요 |
| SIMD/SoA | (정확도 동일) 처리량↑ | — | 안전 |
| 멀티스레드 | (정확도 동일) 처리량↑ | — | **고정 분할·정렬 합산 필요** |
| GPU 솔버 | 대량 처리량↑↑ | — | **결정론 포기** |
| 물리 LOD | 근거리 정확 | 원거리 비용↓↓ | 시각 전용이면 안전 |

> 원칙: **정확도를 사는 다이얼(substep·iteration)** 은 결정론에 대체로 안전하고, **처리량을 사는 다이얼(멀티스레드·GPU)** 일수록 결정론을 위협한다. 12 의 요구를 먼저 보고 13 의 다이얼을 돌린다. (다이얼 운용은 [2.6](13-performance-parallelism/06-profiling-lod.md).)

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진 | 이 노드에서의 대표 선택 |
|---|---|
| **Jolt** | 대규모 병렬 + **결정적** 솔버의 모범. island 단위 분배 + 고정 작업 분할 + 정렬 reduction 으로 "병렬이면서 비트 재현 가능". 우수한 island sleeping. (Horizon Forbidden West) |
| **PhysX (NVIDIA)** | **GPU rigid/cloth/fluid** 솔버(PhysX 5, GPU TGS). CPU 측은 task-based 병렬. GPU 경로는 결정론 비보장 → 시각 효과/대량 시뮬 위주. |
| **Box2D** | (v3) 멀티스레딩 + SIMD(SoA) contact 솔버, island + TGS soft. 교과서적으로 깔끔한 island/sleeping 구현 참조용. |
| **Chaos (UE5)** | UE **Task Graph** 위에서 broadphase/솔버 병렬. island 기반 솔버, Chaos Cloth/Destruction. 결정론은 옵션·제약적. |
| **Bullet** | `btParallelConstraintSolver`(parallel PGS), 멀티스레드 dispatcher. 오픈소스 병렬 솔버의 고전 참조. |
| **Havok** | 결정론 옵션 + 고도 최적화 솔버, SPU/멀티코어 시절부터 job 기반 분할의 산업 표준. |

읽는 법: **결정론이 필요하면 Jolt 의 길**(고정 분할·정렬 합산·CPU, → [2.4](13-performance-parallelism/04-parallel-solver-determinism.md)), **눈요기 대량이면 PhysX GPU 의 길**(결정론 포기·GPU 안에서 완결, → [2.5](13-performance-parallelism/05-gpu-physics.md)). 둘은 같은 엔진 안에서 공존할 수 있다 — 게임플레이 판정은 CPU 결정론, 잔해·물보라·천은 GPU.

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **스레드 완료 순서 = desync 원인 1순위.** 부동소수점 결합법칙이 깨지므로, 누산 순서가 스레드 스케줄에 의존하면 같은 입력도 다른 출력. → 고정 분할 + 정렬 reduction. `atomic add` 로 충격량을 누산하면 빠르지만 결정론은 죽는다. ([2.4](13-performance-parallelism/04-parallel-solver-determinism.md))
- **GPU 는 결정론을 포기한다.** 드라이버/아키텍처별 부동소수점 차이 → lockstep([12](12-determinism-networking.md)) 불가. GPU 결과를 게임플레이 판정에 쓰지 말 것. ([2.5](13-performance-parallelism/05-gpu-physics.md))
- **sleep 상태는 시뮬 상태다.** rollback/스냅샷([12](12-determinism-networking.md))에 `sleepTimer`·`asleep` 플래그를 반드시 포함. 누락하면 재현/롤백 시 sleep 타이밍이 갈려 desync. ([2.1](13-performance-parallelism/01-sleeping-island.md))
- **wake 전파 누락.** 깨울 때 island 전체를 안 깨우면 "공중에 자는 바디"·"닿았는데 안 깨는 바디" 버그. 텔레포트/힘/제약 추가 시에도 깨워야 한다. ([2.1](13-performance-parallelism/01-sleeping-island.md))
- **sleeping 채터링.** 단일 임계값이면 임계 근처에서 자고-깨고 진동 → 히스테리시스(재움/깸 임계 분리 + timeToSleep). ([2.1](13-performance-parallelism/01-sleeping-island.md))
- **load imbalance.** 거대 island 하나가 병렬화를 무력화. island 내부 컬러링 분할 또는 큰 island 전용 경로. ([2.1](13-performance-parallelism/01-sleeping-island.md) · [2.4a](13-performance-parallelism/04a-graph-coloring-batching.md))
- **false sharing.** 스레드별 출력 버퍼를 캐시라인 정렬 안 하면 코어 추가가 오히려 느려진다(`alignas(64)`). ([2.2](13-performance-parallelism/02-data-layout.md))
- **SIMD batch 의 숨은 의존.** 같은 batch 에 공유 바디가 끼면 lane 간 데이터 레이스 → 컬러링으로 보장. 자동 SIMD(컴파일러)에 맡기지 말고 명시적 batch 구성. ([2.4](13-performance-parallelism/04-parallel-solver-determinism.md) · [2.4a](13-performance-parallelism/04a-graph-coloring-batching.md))
- **채색 순서 비고정.** 채색을 스레드/해시 순서로 하면 색 배치가 매 실행 달라져 합산 순서가 갈리고 desync. → 입력 순서 고정. ([2.4a](13-performance-parallelism/04a-graph-coloring-batching.md))
- **substep/iteration 과다 = 예산 초과.** "안정성 문제를 반복 수로 덮는" 습관은 프레임을 잡아먹는다. 근본 원인(작은 mass ratio, 깊은 침투)을 [05](05-constraint-solving.md) 에서 먼저 해결. ([2.6](13-performance-parallelism/06-profiling-lod.md))
- **인덱스 vs 포인터.** 결정론·직렬화엔 인덱스. 포인터 주소는 실행마다 달라 비결정적이고 압축(compaction)을 막는다. ([2.2](13-performance-parallelism/02-data-layout.md))
- **readback stall.** GPU 결과를 매 프레임 CPU 회수하면 PCIe 왕복·커널 런치로 stall → GPU 안에서 완결 후 렌더가 직접 소비. ([2.5](13-performance-parallelism/05-gpu-physics.md))

---

## 6. 더 읽기 / 관련 노드

- **직접 최적화 대상**: [04-collision-detection.md](04-collision-detection.md)(broad/narrowphase 병렬화·SIMD GJK) · [05-constraint-solving.md](05-constraint-solving.md)(island·batch·PGS/TGS 병렬화의 본진).
- **공간 구조**: [11-spatial-structures.md](11-spatial-structures.md) — broadphase 시간복잡도(`O(n²)`→로그)를 결정, island 구성의 입력.
- **결정론 짝 노드**: [12-determinism-networking.md](12-determinism-networking.md) — 이 문서의 모든 "결정론 주의"가 가리키는 곳. 무엇을 보존할지(12)가 얼마나 빨라질지(13)의 상한을 정한다.
- **대량 시뮬 수요처**: [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) — GPU 솔버·Jacobi 병렬화의 주 고객.
- **기반**: [00-foundations.md](00-foundations.md)(부동소수점 결합법칙·수치) · [03-time-integration.md](03-time-integration.md)(substep 정의).
- 외부: Jolt `Physics/PhysicsSystem`·`JobSystem` 소스, Box2D v3 솔버, Erin Catto "Soft Constraints"/TGS 강연, NVIDIA PhysX GPU 문서, Mike Acton "Data-Oriented Design" 강연.
