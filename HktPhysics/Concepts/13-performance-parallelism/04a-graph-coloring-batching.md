# [13·2.4a] 그래프 컬러링과 배치 — 병렬 충돌 솔버를 어떻게 가르나 (Graph Coloring & Batching, from the graph up)

> "공유 바디 없는 제약끼리 묶는다"가 실제로는 *제약 그래프 채색* 문제다. 왜 색이 곧 병렬 안전 단위인지, 왜 색 사이는 순차여야 하는지, Gauss-Seidel 의 직렬 의존이 색 안에서 어떻게 풀리는지를 근본부터 푼다.
> **상위 노드**: [04-parallel-solver-determinism.md](04-parallel-solver-determinism.md) · [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [05-constraint-solving](../05-constraint-solving.md)

---

## 0. 한 문장 요약

> **제약을 정점, "같은 바디를 건드림"을 간선으로 보면, 동시에 풀어도 안전한 제약 집합 = 서로 간선이 없는 정점 집합 = 같은 색**이다. 그래서 병렬 솔버의 분할은 *제약 그래프의 색칠(graph coloring)* 로 환원된다. 색 *안*은 충돌이 없어 병렬·SIMD 안전, 색 *사이*는 같은 바디를 갱신할 수 있어 순차로 돌린다.

---

## 1. 왜 마구잡이 병렬은 안 되나 — 충격량의 읽기-수정-쓰기

PGS(Projected Gauss-Seidel) 접촉 솔버는 제약 하나를 풀 때마다 그 제약이 잇는 **두 바디의 속도를 읽고-고쳐-쓴다**(read-modify-write). Gauss-Seidel 의 본질은 "방금 갱신한 값을 다음 제약이 *즉시* 본다"는 것 — 그래서 빨리 수렴한다. 하지만 바로 이 즉시성이 직렬 의존이다.

두 제약 `c1=(A,B)`, `c2=(B,C)` 가 바디 `B` 를 공유한다고 하자. 둘을 다른 스레드/ lane 에서 동시에 풀면:

```
스레드1:  read B.v → 고침 → write B.v
스레드2:  read B.v → 고침 → write B.v     # 동시 = 데이터 레이스, 한쪽 갱신이 증발
```

`B.v` 에 대한 갱신이 서로를 덮어써(lost update) 충격량이 새거나, 결정론이 깨진다. **공유 바디가 곧 의존 간선**이다.

## 2. 제약 그래프 — 정점·간선의 재정의

여기서 관점을 뒤집는다. 보통 물리 그래프는 "바디=정점, 접촉=간선"이다([01-sleeping-island](01-sleeping-island.md) 의 island 그래프). 컬러링에서는 **제약을 정점으로** 본다:

```
정점(vertex) = 제약(접촉/조인트) 하나
간선(edge)   = 두 제약이 바디를 공유함 (= 동시에 풀면 충돌)
```

이 그래프를 **충돌 그래프(conflict graph)** 라 부른다. 우리가 원하는 것은 "동시에 풀어도 안전한 제약들의 묶음" = 서로 간선이 없는 정점들 = **독립 집합(independent set)**. 그리고 모든 제약을 이런 묶음 몇 개로 *분할*하는 것이 바로 **그래프 채색**이다 — 인접한(간선으로 이어진) 두 정점은 다른 색을 받으니, **같은 색 = 독립 집합 = 공유 바디 없음**.

```
접촉:  A-B,  B-C,  C-D,  A-D     (사각형 더미)
충돌 그래프(제약을 정점으로):
   c_AB ── c_BC      c_AB, c_CD 는 바디 안 겹침 → 같은 색 가능
    │        │        c_AB, c_BC 는 B 공유 → 다른 색
   c_AD ── c_CD
채색:  색0 = {c_AB, c_CD},  색1 = {c_BC, c_AD}
```

## 3. 왜 "색 안 병렬 / 색 사이 순차"인가

- **색 안(intra-color)**: 정의상 서로 바디를 공유하지 않는다 → 어느 바디도 두 번 갱신되지 않는다 → 데이터 레이스 없음 → **병렬·SIMD lane 으로 동시에 풀어도 안전**. 이 색 하나가 곧 [04-parallel-solver-determinism](04-parallel-solver-determinism.md) 의 한 SIMD batch(4·8 제약 묶음)다.
- **색 사이(inter-color)**: 다른 색의 제약은 같은 바디를 건드릴 수 있다 → **순차로** 돈다. 색0 을 다 푼 *뒤* 색1 을 푼다.

```
for color in colors:            # 색 사이: 순차 (의존 있음)
    parallel_for c in color:    # 색 안: 병렬 안전 (독립)
        solve(c)
    # 색 경계에서 갱신된 속도가 다음 색의 입력이 됨
```

핵심 직관: 채색은 직렬 PGS 를 **"순차 단계 = 색 수" 개의 병렬 단계로** 바꾼다. 색 수가 적을수록(=그래프가 성길수록) 순차 단계가 적어 병렬도가 높다. 색 수의 하한은 그래프의 최대 차수+1 근방 — 한 바디에 많은 제약이 몰릴수록(빽빽한 더미) 색이 늘어 병렬 이득이 준다.

## 4. Gauss-Seidel 의 직렬성은 어디로 갔나 — 색칠 GS = 하이브리드

순수 GS 는 "방금 값 즉시 반영"이고, 순수 Jacobi 는 "전부 이전 반복 값으로 동시에"([05-gpu-physics](05-gpu-physics.md))다. **색칠 GS(colored Gauss-Seidel)** 는 그 사이다:

- 한 색 *안*: 서로 바디를 안 겹치므로, 동시에 풀어도 "남의 갱신을 못 봐서 생기는 손해"가 **없다**(애초에 공유가 없으니 볼 것도 없음). → 색 안에서는 Jacobi 처럼 병렬이지만 수렴 손해가 없다.
- 색 *사이*: 순차라서 앞 색의 갱신을 뒤 색이 즉시 본다. → GS 의 빠른 수렴(정보 전파)을 색 경계에서 유지한다.

> 그래서 색칠 GS 는 "GS 의 수렴 + Jacobi 의 병렬성"을 절충해 가져온다. 순수 Jacobi 보다 적은 반복으로 수렴하면서, 순수 GS 의 완전 직렬을 피한다.

## 5. 채색 알고리즘 — 실무에선 근사로 충분

최소 색 수를 찾는 것(최적 채색)은 NP-난해지만, 솔버는 **최소가 아니어도 된다** — 적당히 적은 색이면 충분하다. 실무 그리디(greedy):

```
greedy_color(constraints):
    for c in constraints (입력 순서 고정):     # ← 순서를 고정해야 결정론
        used = { color[n] for n in neighbors(c) }   # 이웃이 쓴 색
        color[c] = smallest color not in used        # 안 쓰인 가장 작은 색
```

- **결정론**: 제약을 *입력에 고정된 순서*로 채색해야 매 실행 같은 색 배치가 나온다([04-parallel-solver-determinism](04-parallel-solver-determinism.md) 의 "고정 작업 분할"). 스레드·해시 순서에 의존하면 desync.
- **부하 균형**: 색마다 제약 수가 고르면 좋다(한 색이 너무 작으면 그 병렬 단계가 코어를 놀린다). 일부 엔진은 색 크기 균형까지 고려해 채색.
- **incremental**: 매 프레임 접촉이 조금씩 바뀌므로, 전 프레임 색을 warm-start 삼아 부분 재채색해 비용을 아낀다.

## 6. island 컬러링 vs SIMD batch — 두 쓰임새

같은 채색이 두 곳에서 쓰인다([04-parallel-solver-determinism](04-parallel-solver-determinism.md) 에서 합류):

1. **큰 island 내부 병렬화**: 거대 더미가 단일 island 로 묶여 직렬 병목([01-sleeping-island](01-sleeping-island.md) 의 load imbalance)일 때, 그 안을 색으로 갈라 색마다 `parallel_for`. island 간 병렬로는 못 쪼개는 한 덩어리를 색으로 쪼갠다.
2. **SIMD batch 구성**: 같은 색에서 4·8개를 골라 한 SIMD 묶음으로([04-parallel-solver-determinism](04-parallel-solver-determinism.md) 의 4-wide 루프). 색이 공유 바디 없음을 보장하므로 lane 간 레이스가 없다.

> 둘 다 "공유 바디 없는 제약을 모아 동시에"라는 같은 원리의 다른 입자도(粒度) — 하나는 스레드 단위, 하나는 SIMD lane 단위.

---

## 7. 함정 (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트))

- **채색 순서 비고정**: 채색을 스레드/해시 순서로 하면 색 배치가 매 실행 달라져 합산 순서가 갈리고 desync. → 입력 순서 고정.
- **색 너무 많음**: 빽빽한 더미는 색이 많아져 순차 단계가 늘고 병렬 이득이 준다 — 큰 island 전용 경로나 substep 으로 완화.
- **숨은 공유 바디**: 채색을 빠뜨린 제약(예: 나중에 추가된 접촉)이 batch 에 끼면 lane 레이스. batch 구성 전 반드시 전체 채색.
- **색 크기 불균형**: 작은 색이 많으면 그 병렬 단계가 코어를 놀린다 → 색 크기 균형 고려.

---

## 8. 더 읽기

- [04-parallel-solver-determinism](04-parallel-solver-determinism.md) — batch·고정 분할·정렬 합산의 개요(이 문서의 상위 절).
- [05-constraint-solving](../05-constraint-solving.md) — PGS/TGS·sequential impulse 의 직렬 솔버 본체.
- [05-gpu-physics](05-gpu-physics.md) — 색칠 GS 의 한 극단인 순수 Jacobi(GPU).
- [01-sleeping-island](01-sleeping-island.md) — island(바디 그래프)와 충돌 그래프(제약 그래프)의 대비.
- Erin Catto (Box2D), GDC "Solver2D"/TGS 강연 — 병렬 솔버 배치의 실무.
- Jolt `Physics/Constraints` 솔버 소스 — island + 컬러 batch + 고정 분할의 모범 구현.
