# [13] 성능·병렬 (Performance & Parallelism)

> 솔버를 더 빠르게: 접촉 그래프를 독립 island 로 쪼개 병렬화하고, 저에너지 바디를 재워(sleeping) 일을 줄이며, SoA·SIMD·job system·GPU 로 같은 수학을 더 적은 사이클에 돌린다 — 정확도·결정론을 화폐로.
> **상위 지도**: [Concepts/README.md](README.md) · **횡단 최적화**: [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md)

형제 문서: [00-foundations.md](00-foundations.md) · [01-kinematics.md](01-kinematics.md) · [02-dynamics.md](02-dynamics.md) · [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md) · [06-joints-articulation.md](06-joints-articulation.md) · [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) · [10-specialized-systems.md](10-specialized-systems.md) · [11-spatial-structures.md](11-spatial-structures.md) · [12-determinism-networking.md](12-determinism-networking.md) · **[13-performance-parallelism.md]**

---

## 1. 위치와 역할

이 노드는 특정 솔버를 새로 만들지 않는다. 대신 **이미 정의된 솔버(03 적분 · 04 충돌 · 05 구속)를 "어떻게 더 적은 시간·전력으로 돌리는가"** 를 다루는 횡단(cross-cutting) 관심사다. README 의 DAG 에서 `[13] ⟂ (04·05 에 island/sleeping/SIMD/GPU 로 가지를 침)` 로 표기된 그 가지다.

핵심 긴장 관계는 단 하나다:

```
성능  ↔  정확도  ↔  결정론
```

이 노드의 거의 모든 기법은 이 삼각형 안에서 하나를 깎아 다른 하나를 산다. 그래서 [12] 결정론·네트워킹과 짝을 이룬다 — 12 가 "무엇을 보존해야 하는가"를 정하면, 13 은 "그 제약 안에서 얼마나 빨라질 수 있는가"를 정한다. **연산 순서·부동소수점 결합법칙·스레드 비결정성**이 곧장 12 의 위반으로 직결되므로, 이 문서의 모든 최적화는 "결정론 등급(level)"을 함께 명시한다.

물리는 프레임 예산을 두고 렌더·게임플레이·AI 와 경쟁한다. 60fps = 16.6ms, 그중 물리는 보통 2~5ms 안에 broadphase + narrowphase + 솔버 + 적분 + sleeping 전부를 끝내야 한다. 이 노드는 그 예산을 지키는 도구상자다.

---

## 2. 핵심 이론

### 2.1 Island / 분할 (접촉 그래프의 연결 요소)

**island = 접촉·조인트로 직접/간접 연결된 동적 바디들의 집합.** 그래프 이론으로 정확히 말하면 *접촉 제약 그래프의 연결 요소(connected component)* 다.

- **정점(vertex)**: 동적(dynamic) 강체.
- **간선(edge)**: 두 바디 사이의 접촉 manifold 또는 조인트.
- **정적/kinematic 바디**: island 분리의 "벽" 역할 — 간선을 잇지 않는다(질량 무한이라 충격량을 받지 않으므로 다른 동적 바디를 결합시키지 않는다). 이것이 island 가 작게 유지되는 핵심 이유다.

왜 중요한가: **05 의 PGS/TGS 솔버는 island 내부에서만 정보가 전파된다.** 서로 닿지 않은 두 더미는 충격량을 주고받지 않으므로, 각 island 를 *완전히 독립적인 작은 LCP 문제*로 풀 수 있다. → **island 단위로 솔버를 병렬화**하는 것이 가장 자연스럽고 결정성을 지키기 쉬운 병렬화다(island 간 데이터 의존이 없음).

union-find(disjoint set)로 매 프레임 island 를 구성한다:

```
build_islands(contacts, joints):
    for each dynamic body b: makeset(b)
    for each edge (a,b) in contacts ∪ joints:
        if a.dynamic and b.dynamic:
            union(a, b)              # 정적 바디는 union 하지 않는다 → 벽
    islands = group bodies by find(root)
    return islands                   # 각 island 는 독립 솔버 작업 단위
```

복잡도: union-find 는 사실상 `O((V+E)·α(V))` (α=역 Ackermann, 상수 취급). 부하 불균형(load imbalance)이 진짜 문제다 — 거대한 더미 하나가 단일 island 로 묶이면 그 island 가 직렬 병목이 된다. 대책: ① island 내부를 **그래프 컬러링**으로 다시 batch(같은 색=공유 바디 없음=동시 풀이 가능), ② 큰 island 를 여러 job 으로 쪼개되 경계에서 동기화.

### 2.2 Sleeping / deactivation (저에너지 비활성화)

**가장 큰 성능 레버.** 안 움직이는 바디는 풀 필요가 없다. 100개 상자가 쌓여 정지하면, 솔버 비용을 ~0 으로 떨어뜨릴 수 있다.

판정은 운동 에너지 대용 지표를 임계값과 비교한다:

```
motion(b) = w_lin·|v|² + w_ang·|ω|²      # 선형·각 속도의 가중 제곱합
if motion(b) < sleepThreshold:
    b.sleepTimer += dt
    if b.sleepTimer > timeToSleep:        # 예: 0.5s 연속 저에너지
        deactivate(b)                     # v=ω=0, 솔버/적분에서 제외
else:
    b.sleepTimer = 0
```

핵심 미묘함:

1. **island 단위 sleeping**: 한 바디만 재우면 안 된다. **island 전체가 모두 저에너지일 때** 통째로 재워야 한다 — 안 그러면 자는 바디가 깬 바디에 닿아 "한쪽만 자는" 비물리적 상태가 된다. Jolt·Box2D 모두 island 단위로 판정.
2. **히스테리시스(hysteresis)**: 재우는 임계값과 깨우는 임계값을 다르게(깨우는 쪽을 더 민감하게) 둬서, 임계값 근처에서 자고-깨고를 반복하는 **채터링(chattering)** 을 막는다. `timeToSleep` 자체가 시간축 히스테리시스 역할도 한다.
3. **wake 전파(propagation)**: 자는 바디는 충돌·힘·사용자 텔레포트로 깨워져야 한다. 깨우면 **접촉으로 연결된 island 전체를 같이 깨운다**(BFS/union-find로 전파). 깨우기 누락 = "공중에 떠 자는 상자" 같은 명백한 버그.

```
wake(b):
    if not b.asleep: return
    for each body c in island_of(b):       # island 통째로 깨움
        c.asleep = false; c.sleepTimer = 0
```

결정론 주의: sleep timer·임계값은 결정론에 직접 영향을 준다. rollback(12)에서 sleep 상태도 스냅샷에 포함해야 하고, 부동소수점 `motion` 비교가 플랫폼마다 갈리면 sleep 타이밍이 desync 된다.

### 2.3 데이터 지향 설계 (DOD): SoA vs AoS

물리 솔버는 **메모리 대역폭·캐시 미스에 묶인(memory-bound)** 워크로드다. 같은 수학이라도 레이아웃이 2~10배 차이를 낸다.

- **AoS (Array of Structs)** — 객체지향 기본형. `struct Body { vec3 pos; vec3 vel; quat rot; ... }; Body bodies[N];`. 한 바디의 모든 필드가 인접 → 단일 객체 접근엔 좋으나, "모든 바디의 vel.x 만 훑기" 같은 솔버 패턴에선 매 캐시라인에 안 쓰는 필드가 끼어 대역폭을 낭비하고 SIMD 가 안 먹는다.
- **SoA (Struct of Arrays)** — DOD/SIMD 기본형. `struct Bodies { float posX[N], posY[N], posZ[N]; float velX[N]...; }`. 같은 필드가 연속 → 캐시라인이 전부 유효 데이터, **SIMD 로 4·8개 lane 을 한 번에** 로드/연산 가능.

```
AoS:  [p0 v0 r0][p1 v1 r1][p2 v2 r2]...   # 한 바디 묶음. vel만 훑으면 p,r 낭비
SoA:  [p0 p1 p2 ...][v0 v1 v2 ...][r0 ...]  # 한 필드 묶음. SIMD 친화
```

부수 기법:

- **메모리 풀 / 아레나(arena) 할당**: 프레임마다 contact·constraint·island 작업 버퍼를 풀에서 통째로 잡고 통째로 리셋. `new`/`delete` 산발 호출 제거 → 단편화·할당 비용 0 에 수렴, 캐시 지역성 향상.
- **인덱스 핸들 vs 포인터**: 바디를 포인터 대신 `uint32` 인덱스로 참조 → 재배치(compaction)·직렬화·결정론에 유리(포인터 값은 비결정적).
- **false sharing**: 서로 다른 스레드가 같은 캐시라인(보통 64B)의 다른 변수를 쓰면, 하드웨어가 라인 전체를 핑퐁시켜 성능이 급락. 대책: 스레드별 데이터를 캐시라인 경계로 **패딩/정렬**(`alignas(64)`), 스레드 로컬 누산 후 마지막에 합치기(reduction).

### 2.4 SIMD (4·8-wide 솔버)

SoA 가 깔리면 한 SIMD 명령으로 4개(SSE)·8개(AVX) 제약을 동시에 푼다. 접촉 솔버의 내부 루프는 본질적으로 같은 식을 제약마다 반복하므로 SIMD 의 이상적 대상이다.

```
# 4-wide 접촉 충격량 (SoA, lane = 4개 제약 동시)
for batch in constraints.groups_of(4):
    jv   = simd_dot4(batch.normal, batch.relVel)        # 4개 동시 내적
    dλ   = -batch.effMass * (jv + batch.bias)
    λnew = simd_max4(batch.λ + dλ, 0)                    # 4개 동시 클램프(λ≥0)
    dλ   = λnew - batch.λ; batch.λ = λnew
    apply_impulse4(batch, dλ)                            # gather/scatter
```

- **batch constraint**: PGS 는 본질적으로 직렬(이전 결과를 다음이 읽음)이라, 4-wide 로 묶으려면 **같은 batch 안의 4개 제약이 서로 다른 바디 쌍**이어야 한다(공유 바디 없음=그래프 컬러링). 그래야 lane 간 데이터 의존이 없다.
- **gather/scatter** 비용: SoA 라도 제약→바디 인덱싱이 흩어지면 gather 가 느릴 수 있다. AVX-512 의 `vgather`/`vscatter` 또는 바디 데이터 재배열로 완화.
- SoA 는 SIMD 의 **전제조건**이다(2.3). AoS 위에서 SIMD 는 거의 항상 손해.

### 2.5 멀티스레딩 (job/task system)

물리 파이프라인의 각 단계는 병렬화 가능성이 다르다:

| 단계 | 병렬화 방식 | 난점 |
|---|---|---|
| Broadphase | 공간 분할/BVH 갱신을 영역별 분할 | 동적 트리 갱신의 쓰기 경합 |
| Narrowphase | 후보 쌍을 job 으로 분배(embarrassingly parallel) | manifold 출력 버퍼 경합 |
| Island 구성 | union-find(주로 직렬, 또는 병렬 CC) | 그래프 알고리즘의 직렬성 |
| 솔버 | **island 단위 분배** + island 내 컬러 batch | load imbalance, 결정론 |
| 적분/sleeping | 바디별 독립 → 완전 병렬 | 거의 없음 |

**job/task system**: 전역 워커 스레드 풀 + work-stealing 큐. 작업을 잘게(fine-grained) 쪼개 큐에 던지면 놀고 있는 코어가 가져간다. UE 의 Task Graph, Jolt 의 `JobSystem`, Intel TBB 가 대표.

```
parallel_solve(islands):
    for each island in islands:           # island 간 독립 → 병렬 안전
        schedule_job( solve_island(island) )
    barrier()                              # 모든 island 끝날 때까지 대기
# 큰 island 내부:
solve_island(I):
    colors = graph_color(I.constraints)    # 같은 색 = 공유 바디 없음
    for color in colors:                   # 색 사이엔 의존 → 순차
        parallel_for(c in color):          # 색 안은 병렬 안전
            solve_constraint(c)
```

**결정적 병렬화의 어려움(→ [12])**: 부동소수점 덧셈은 **결합법칙이 깨진다**(`(a+b)+c ≠ a+(b+c)`). 스레드 완료 순서가 매번 다르면 누산 합산 순서가 달라져 결과가 비트 단위로 갈린다. 결정론을 지키려면:

1. **고정 작업 분할**: island/배치 분배를 스레드 수와 무관하게 입력에만 의존시킨다.
2. **순서 독립 reduction**: 결과를 스레드 로컬에 모은 뒤 **정해진(인덱스 정렬된) 순서**로 최종 합산.
3. **원자적 누산 금지**: `atomic add` 는 빠르지만 순서 비결정적 → 결정론 빌드에선 금지.

Jolt 가 "병렬이면서 결정적"을 달성한 비결이 바로 이 고정 분할 + 정렬 합산이다.

### 2.6 GPU physics

대량 동질(homogeneous) 입자(파티클 09 · 유체 08 · 옷감 07)는 GPU 의 SIMT 모델에 완벽히 맞는다. 강체(rigid)도 PhysX 5 처럼 GPU 솔버가 있으나 분기·불규칙 접촉 그래프 때문에 입자류만큼 깔끔히 떨어지진 않는다.

- **잘 맞는 것**: 수십만 입자 SPH/PBF(08), cloth/소프트 PBD(07), GPU 파티클(09) — 균일 데이터 + 병렬 친화 솔버(Jacobi 류).
- **Jacobi vs Gauss-Seidel**: GPU 는 모든 제약을 *이전 반복 값으로* 동시에 푸는 **Jacobi/병렬 친화** 반복을 선호(GS 는 직렬 의존). 수렴은 느려 반복 수를 늘려 보상.
- **CPU↔GPU 동기화 비용**: PCIe 왕복 + 커널 런치 지연이 핵심 병목. 게임플레이가 매 프레임 결과를 CPU 로 회수(readback)하면 stall 발생 → "GPU 안에서 끝까지 돌리고 결과는 렌더에서 직접 소비"가 정석. 충돌 콜백·트리거를 CPU 로직과 묶으려면 동기화 비용이 이득을 잡아먹을 수 있다.
- **결정론 포기**: GPU 부동소수점은 드라이버·아키텍처·스케줄링에 따라 결과가 달라진다. 따라서 **GPU physics 는 사실상 결정론을 포기**한다 → lockstep 멀티플레이(12)에는 부적합, 보통 "시각 효과(눈요기) 전용"으로 쓰고 게임플레이 판정은 CPU 결정론 솔버에 맡긴다.

---

## 3. 주요 기법/도구

| 기법 | 무엇을 깎아 무엇을 사는가 | 한 줄 |
|---|---|---|
| Island 분할 | (거의 손실 없음) → 병렬성 | 연결 요소 단위 독립 솔버 |
| Sleeping | 약간의 반응성 → 큰 CPU 절감 | 저에너지 island 비활성 |
| SoA 레이아웃 | 코드 복잡도 → 대역폭/SIMD | 같은 필드 연속 배치 |
| SIMD batch | 코드 복잡도 → 4·8× 처리량 | 컬러링된 batch 동시 풀이 |
| Job system | 결정론 난이도 → 코어 확장 | island/단계 병렬 |
| GPU 솔버 | 결정론·동기화비 → 대량 처리 | 입자/유체/옷감 대량화 |
| 물리 LOD | 정확도 → 비용 | 멀리/안 보이는 건 싸게 |
| 반복 수 튜닝 | 정확도 → 시간 | iteration/substep 다이얼 |

**프로파일링/예산**

- **프레임 예산**: 물리는 전체 프레임의 고정 슬라이스(예: 16.6ms 중 3ms). 단계별 타이밍(broad/narrow/solve/integrate)을 항시 계측 — 핫스팟은 보통 narrowphase 또는 큰 island 솔버.
- **substep · iteration 다이얼**: substep(작은 dt 여러 번)은 안정성·CCD 정확도를 사고 비용은 선형 증가. velocity/position iteration 수는 접촉 수렴 품질을 산다. 둘 다 "보이는 만큼만" 올린다.
- **시간복잡도 핫스팟**: broadphase 가 naive `O(n²)`면 즉사 → 11(공간 구조)로 `O(n log n)`/기대 `O(n)`. 솔버는 `O(반복수 × 제약수)`. 큰 island 가 `O(island크기)` 직렬 꼬리를 만든다.

**물리 LOD (Level of Detail)**

- 카메라 거리/중요도로 substep·iteration·sleeping 임계값을 차등 적용.
- 먼 ragdoll → 단순 캡슐 1개, 가까운 것 → 풀 본 시뮬.
- 화면 밖 군중 → 더 공격적으로 재우거나 시뮬 주기 다운샘플.

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

읽는 법: **결정론이 필요하면 Jolt 의 길**(고정 분할·정렬 합산·CPU), **눈요기 대량이면 PhysX GPU 의 길**(결정론 포기·GPU 안에서 완결). 둘은 같은 엔진 안에서 공존할 수 있다 — 게임플레이 판정은 CPU 결정론, 잔해·물보라·천은 GPU.

---

## 5. 함정·결정론 주의

- **스레드 완료 순서 = desync 원인 1순위.** 부동소수점 결합법칙이 깨지므로, 누산 순서가 스레드 스케줄에 의존하면 같은 입력도 다른 출력. → 고정 분할 + 정렬 reduction(2.5). `atomic add` 로 충격량을 누산하면 빠르지만 결정론은 죽는다.
- **GPU 는 결정론을 포기한다.** 드라이버/아키텍처별 부동소수점 차이 → lockstep(12) 불가. GPU 결과를 게임플레이 판정에 쓰지 말 것.
- **sleep 상태는 시뮬 상태다.** rollback/스냅샷(12)에 sleepTimer·asleep 플래그를 반드시 포함. 누락하면 재현/롤백 시 sleep 타이밍이 갈려 desync.
- **wake 전파 누락**: 깨울 때 island 전체를 안 깨우면 "공중에 자는 바디"·"닿았는데 안 깨는 바디" 버그. 텔레포트/힘/제약 추가 시에도 깨워야 한다.
- **sleeping 채터링**: 단일 임계값이면 임계 근처에서 자고-깨고 진동 → 히스테리시스(재움/깸 임계 분리 + timeToSleep).
- **load imbalance**: 거대 island 하나가 병렬화를 무력화. island 내부 컬러링 분할 또는 큰 island 전용 경로.
- **false sharing**: 스레드별 출력 버퍼를 캐시라인 정렬 안 하면 코어 추가가 오히려 느려진다(`alignas(64)`).
- **SIMD batch 의 숨은 의존**: 같은 batch 에 공유 바디가 끼면 lane 간 데이터 레이스 → 컬러링으로 보장. 자동 SIMD(컴파일러)에 맡기지 말고 명시적 batch 구성.
- **substep/iteration 과다 = 예산 초과.** "안정성 문제를 반복 수로 덮는" 습관은 프레임을 잡아먹는다. 근본 원인(작은 mass ratio, 깊은 침투)을 05 에서 먼저 해결.
- **인덱스 vs 포인터**: 결정론·직렬화엔 인덱스. 포인터 주소는 실행마다 달라 비결정적이고 압축(compaction)을 막는다.

### 정확도 vs 성능 트레이드오프 표

| 다이얼 | ↑ 올리면(정확) | ↓ 내리면(빠름) | 결정론 영향 |
|---|---|---|---|
| substep 수 | 안정·CCD↑, 침투↓ | 비용 선형↓ | 안전(고정이면) |
| solver iteration | 접촉 수렴↑, 떨림↓ | 비용↓ | 안전(고정이면) |
| sleeping 공격성 | 반응성↑ | CPU↓ 크게 | 임계/타이머 스냅샷 필요 |
| SIMD/SoA | (정확도 동일) 처리량↑ | — | 안전 |
| 멀티스레드 | (정확도 동일) 처리량↑ | — | **고정 분할·정렬 합산 필요** |
| GPU 솔버 | 대량 처리량↑↑ | — | **결정론 포기** |
| 물리 LOD | 근거리 정확 | 원거리 비용↓↓ | 시각 전용이면 안전 |

> 원칙: **정확도를 사는 다이얼(substep·iteration)** 은 결정론에 대체로 안전하고, **처리량을 사는 다이얼(멀티스레드·GPU)** 일수록 결정론을 위협한다. 12 의 요구를 먼저 보고 13 의 다이얼을 돌린다.

---

## 6. 더 읽기 / 관련 노드

- **직접 최적화 대상**: [04-collision-detection.md](04-collision-detection.md)(broad/narrowphase 병렬화·SIMD GJK) · [05-constraint-solving.md](05-constraint-solving.md)(island·batch·PGS/TGS 병렬화의 본진).
- **공간 구조**: [11-spatial-structures.md](11-spatial-structures.md) — broadphase 시간복잡도(`O(n²)`→로그)를 결정, island 구성의 입력.
- **결정론 짝 노드**: [12-determinism-networking.md](12-determinism-networking.md) — 이 문서의 모든 "결정론 주의"가 가리키는 곳. 무엇을 보존할지(12)가 얼마나 빨라질지(13)의 상한을 정한다.
- **대량 시뮬 수요처**: [07-deformable-bodies.md](07-deformable-bodies.md) · [08-fluids.md](08-fluids.md) · [09-particles.md](09-particles.md) — GPU 솔버·Jacobi 병렬화의 주 고객.
- **기반**: [00-foundations.md](00-foundations.md)(부동소수점 결합법칙·수치) · [03-time-integration.md](03-time-integration.md)(substep 정의).
- 외부: Jolt `Physics/PhysicsSystem`·`JobSystem` 소스, Box2D v3 솔버, Erin Catto "Soft Constraints"/TGS 강연, NVIDIA PhysX GPU 문서, Mike Acton "Data-Oriented Design" 강연.
