# [13·2.3] Job System · 태스크 병렬 (Multithreading: Jobs & Task Parallelism)

> 물리 파이프라인을 단계별로·island 단위로 잘게 쪼개 워커 스레드 풀에 던진다 — 각 단계의 병렬화 가능성과 난점이 다르다.
> **상위 노드**: [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [04-collision-detection](../04-collision-detection.md) · [05-constraint-solving](../05-constraint-solving.md)

---

코어가 늘어난 만큼 빨라지려면 일을 코어 수만큼 동시에 흘려야 한다. 물리 파이프라인은 단계마다 병렬화의 성격이 다르므로, "어디가 쉽고 어디가 어려운가"를 먼저 보는 게 출발점이다.

## 단계별 병렬화 성격

| 단계 | 병렬화 방식 | 난점 |
|---|---|---|
| Broadphase | 공간 분할/BVH 갱신을 영역별 분할 | 동적 트리 갱신의 쓰기 경합 |
| Narrowphase | 후보 쌍을 job 으로 분배(embarrassingly parallel) | manifold 출력 버퍼 경합 |
| Island 구성 | union-find(주로 직렬, 또는 병렬 CC) | 그래프 알고리즘의 직렬성 |
| 솔버 | **island 단위 분배** + island 내 컬러 batch | load imbalance, 결정론 |
| 적분/sleeping | 바디별 독립 → 완전 병렬 | 거의 없음 |

직관: 입력이 서로 독립인 단계(narrowphase 후보 쌍, 바디별 적분)는 거저 병렬이고, *공유 자료구조에 쓰는* 단계(broadphase 트리 갱신, manifold 버퍼)는 경합을 풀어야 하며, *그래프를 도는* 단계(island 구성)는 본질적으로 직렬기가 끼어 가장 까다롭다.

## job/task system — work-stealing 워커 풀

**전역 워커 스레드 풀 + work-stealing 큐.** 작업을 잘게(fine-grained) 쪼개 큐에 던지면 놀고 있는 코어가 가져간다(steal). 코어마다 자기 큐를 먼저 비우고, 비면 남의 큐 꼬리에서 훔쳐 와 부하를 자동 평준화한다 — [01-sleeping-island](01-sleeping-island.md) 의 load imbalance 를 런타임에 완화하는 장치다.

UE 의 **Task Graph**, Jolt 의 **`JobSystem`**, Intel **TBB** 가 대표.

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

바깥 루프(island 간)는 [01-sleeping-island](01-sleeping-island.md) 가 보장한 독립성 덕에 자유롭게 병렬화된다. 안쪽 루프(큰 island 내부 컬러 batch)와 거기서 생기는 합산 순서·결정론 문제는 [04-parallel-solver-determinism](04-parallel-solver-determinism.md) 의 영역이다.

## 작업 분할이 곧 결정론 정책

job system 을 쓰는 순간 **스레드 완료 순서가 매 실행 비결정적**이 된다. 이게 부동소수점 누산 순서를 바꾸면 결과가 비트 단위로 갈린다([12](../12-determinism-networking.md)). 그래서 결정론을 원하면 job 분할을 *스레드 수·스케줄과 무관하게 입력에만 의존*하도록 고정해야 한다. 분할 정책 자체가 결정론 정책이다 — 구체적 처방(고정 분할 + 정렬 reduction)은 [04-parallel-solver-determinism](04-parallel-solver-determinism.md).

---

**관련 함정** (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트)):
- **쓰기 경합**: broadphase 트리 갱신·narrowphase manifold 버퍼는 공유 자료구조에 쓴다 → 영역 분할 또는 스레드 로컬 버퍼 후 병합.
- **load imbalance**: 거대 island 하나가 병렬화를 무력화 → island 내부 컬러링 분할(work-stealing 만으론 한 job 이 안 쪼개지면 못 푼다).
- **완료 순서 의존**: 스레드 완료 순서에 누산이 의존하면 desync — 분할을 입력에만 의존시키고 합산을 정렬([04-parallel-solver-determinism](04-parallel-solver-determinism.md)).

**다음**: [04-parallel-solver-determinism](04-parallel-solver-determinism.md) — 큰 island 내부를 안전하게 쪼개고(컬러링·배치), 합산 순서로 결정론을 지킨다.
