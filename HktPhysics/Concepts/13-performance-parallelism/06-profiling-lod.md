# [13·2.6] 프로파일링 · 예산 · 물리 LOD (Profiling, Frame Budget & Physics LOD)

> 어느 다이얼을 얼마나 돌릴지는 계측이 정한다 — 프레임 예산 안에서 단계별 핫스팟을 재고, 거리·중요도로 비용을 차등한다(LOD).
> **상위 노드**: [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-time-integration](../03-time-integration.md) · [11-spatial-structures](../11-spatial-structures.md)

---

앞 절들이 "어떻게 빠르게 하나"라면, 이 절은 **"어디를 얼마나 빠르게 할지 어떻게 정하나"** 다. 물리는 프레임 예산을 두고 렌더·게임플레이·AI 와 경쟁하므로, 추측이 아니라 계측으로 다이얼을 돌린다.

## 프레임 예산과 단계별 계측

60fps = 16.6ms, 그중 물리는 보통 **고정 슬라이스**(예: 3ms) 안에 broadphase + narrowphase + 솔버 + 적분 + sleeping 전부를 끝내야 한다. 단계별 타이밍(broad/narrow/solve/integrate)을 **항시 계측**한다 — 핫스팟은 보통 **narrowphase 또는 큰 island 솔버**다.

시간복잡도로 본 핫스팟의 정체:

- **broadphase**: naive `O(n²)`면 즉사 → [11(공간 구조)](../11-spatial-structures.md) 로 `O(n log n)`/기대 `O(n)`. 가속 구조가 island 구성의 입력이기도 하다.
- **솔버**: `O(반복수 × 제약수)`. 큰 island 가 `O(island크기)` **직렬 꼬리**를 만든다([01-sleeping-island](01-sleeping-island.md) 의 load imbalance → [04a-graph-coloring-batching](04a-graph-coloring-batching.md) 로 쪼갬).

## substep · iteration 다이얼

정확도를 사는 두 다이얼은 비용이 예측 가능하게 늘어 튜닝이 쉽다:

- **substep**(작은 dt 를 여러 번, [03](../03-time-integration.md)): 안정성·CCD 정확도를 사고 비용은 **선형** 증가.
- **velocity / position iteration**: 접촉 수렴 품질을 산다.

원칙: 둘 다 **"보이는 만큼만" 올린다.** 그리고 *고정*하면 결정론에 안전하다([04-parallel-solver-determinism](04-parallel-solver-determinism.md)) — 처리량을 사는 다이얼(멀티스레드·GPU)과 달리, 정확도 다이얼은 결정론을 위협하지 않는다.

## 물리 LOD (Level of Detail)

멀리 있거나 안 보이는 시뮬에 풀 비용을 쓸 이유가 없다. 카메라 거리·중요도로 다이얼을 차등한다:

- 카메라 거리/중요도로 **substep·iteration·sleeping 임계값을 차등** 적용.
- 먼 ragdoll → 단순 캡슐 1개, 가까운 것 → 풀 본 시뮬.
- 화면 밖 군중 → 더 공격적으로 재우거나([01-sleeping-island](01-sleeping-island.md)) 시뮬 주기 다운샘플.

LOD 가 **시각 전용**(게임플레이 판정에 안 쓰임)이면 결정론에 안전하다 — GPU 눈요기와 같은 원리([05-gpu-physics](05-gpu-physics.md)).

## 정확도 vs 성능 트레이드오프 한눈표

| 다이얼 | ↑ 올리면(정확) | ↓ 내리면(빠름) | 결정론 영향 |
|---|---|---|---|
| substep 수 | 안정·CCD↑, 침투↓ | 비용 선형↓ | 안전(고정이면) |
| solver iteration | 접촉 수렴↑, 떨림↓ | 비용↓ | 안전(고정이면) |
| sleeping 공격성 | 반응성↑ | CPU↓ 크게 | 임계/타이머 스냅샷 필요 |
| SIMD/SoA | (정확도 동일) 처리량↑ | — | 안전 |
| 멀티스레드 | (정확도 동일) 처리량↑ | — | **고정 분할·정렬 합산 필요** |
| GPU 솔버 | 대량 처리량↑↑ | — | **결정론 포기** |
| 물리 LOD | 근거리 정확 | 원거리 비용↓↓ | 시각 전용이면 안전 |

> 원칙: **정확도를 사는 다이얼(substep·iteration)** 은 결정론에 대체로 안전하고, **처리량을 사는 다이얼(멀티스레드·GPU)** 일수록 결정론을 위협한다. [12](../12-determinism-networking.md) 의 요구를 먼저 보고 13 의 다이얼을 돌린다.

---

**관련 함정** (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트)):
- **substep/iteration 과다 = 예산 초과**: "안정성 문제를 반복 수로 덮는" 습관은 프레임을 잡아먹는다. 근본 원인(작은 mass ratio, 깊은 침투)을 [05](../05-constraint-solving.md) 에서 먼저 해결.
- **추측 튜닝**: 계측 없이 다이얼을 돌리면 엉뚱한 곳을 깎는다 — 단계별 타이밍을 먼저 본다.

**다음**: 허브로 돌아가기 — [13-performance-parallelism §4 실무](../13-performance-parallelism.md#4-실무-엔진은-무엇을-쓰는가).
