# [13·2.1] Sleeping · Island (저에너지 비활성화와 접촉 그래프 분할)

> 가장 큰 두 레버 — 안 움직이는 바디는 아예 풀지 않고(sleeping), 닿은 바디 집합을 독립 island 로 쪼개 따로/병렬로 푼다(island).
> **상위 노드**: [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [05-constraint-solving](../05-constraint-solving.md) · [12-determinism-networking](../12-determinism-networking.md)

---

이 두 기법은 "일을 더 빨리 한다"가 아니라 **"안 해도 되는 일을 안 한다"** 에 속한다. 그래서 거의 손실 없이 큰 비용을 깎는다 — 성능·정확도·결정론 삼각형에서 가장 싸게 사는 다이얼이다.

## Island — 접촉 그래프의 연결 요소

**island = 접촉·조인트로 직접/간접 연결된 동적 바디들의 집합.** 그래프 이론으로 정확히 말하면 *접촉 제약 그래프의 연결 요소(connected component)* 다.

- **정점(vertex)**: 동적(dynamic) 강체.
- **간선(edge)**: 두 바디 사이의 접촉 manifold 또는 조인트.
- **정적/kinematic 바디**: island 분리의 "벽" 역할 — 간선을 잇지 않는다(질량 무한이라 충격량을 받지 않으므로 다른 동적 바디를 결합시키지 않는다). 이것이 island 가 작게 유지되는 핵심 이유다.

왜 중요한가: **[05](../05-constraint-solving.md) 의 PGS/TGS 솔버는 island 내부에서만 정보가 전파된다.** 서로 닿지 않은 두 더미는 충격량을 주고받지 않으므로, 각 island 를 *완전히 독립적인 작은 LCP 문제*로 풀 수 있다. → **island 단위로 솔버를 병렬화**하는 것이 가장 자연스럽고 결정성을 지키기 쉬운 병렬화다(island 간 데이터 의존이 없음 — 자세한 분배는 [03-job-system](03-job-system.md)).

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

복잡도: union-find 는 사실상 `O((V+E)·α(V))` (α=역 Ackermann, 상수 취급). **부하 불균형(load imbalance)이 진짜 문제다** — 거대한 더미 하나가 단일 island 로 묶이면 그 island 가 직렬 병목이 된다. 대책: ① island 내부를 **그래프 컬러링**으로 다시 batch(같은 색=공유 바디 없음=동시 풀이 가능), ② 큰 island 를 여러 job 으로 쪼개되 경계에서 동기화.

> 📐 **심화: 큰 island 를 어떻게 병렬로 쪼개나** — "island 가 독립이라 병렬"까지는 직관적이지만, *하나의 거대 island 내부*를 어떻게 lane/스레드로 안전하게 가르는가(그래프 컬러링·배치)는 직관 장벽이 높다. 합산 순서 결정론까지 묶어 [04-parallel-solver-determinism](04-parallel-solver-determinism.md) 와 그 심화 [04a-graph-coloring-batching](04a-graph-coloring-batching.md) 에서 다룬다.

## Sleeping / deactivation — 저에너지 비활성화

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

핵심 미묘함 세 가지 — 전부 island 과 얽혀 있다:

1. **island 단위 sleeping**: 한 바디만 재우면 안 된다. **island 전체가 모두 저에너지일 때** 통째로 재워야 한다 — 안 그러면 자는 바디가 깬 바디에 닿아 "한쪽만 자는" 비물리적 상태가 된다. Jolt·Box2D 모두 island 단위로 판정.
2. **히스테리시스(hysteresis)**: 재우는 임계값과 깨우는 임계값을 다르게(깨우는 쪽을 더 민감하게) 둬서, 임계값 근처에서 자고-깨고를 반복하는 **채터링(chattering)** 을 막는다. `timeToSleep` 자체가 시간축 히스테리시스 역할도 한다.
3. **wake 전파(propagation)**: 자는 바디는 충돌·힘·사용자 텔레포트로 깨워져야 한다. 깨우면 **접촉으로 연결된 island 전체를 같이 깨운다**(BFS/union-find로 전파). 깨우기 누락 = "공중에 떠 자는 상자" 같은 명백한 버그.

```
wake(b):
    if not b.asleep: return
    for each body c in island_of(b):       # island 통째로 깨움
        c.asleep = false; c.sleepTimer = 0
```

**결정론 주의**: sleep timer·임계값은 결정론에 직접 영향을 준다. rollback([12](../12-determinism-networking.md))에서 sleep 상태(`sleepTimer`·`asleep`)도 스냅샷에 포함해야 하고, 부동소수점 `motion` 비교가 플랫폼마다 갈리면 sleep 타이밍이 desync 된다.

---

**관련 함정** (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트)):
- **wake 전파 누락**: 깨울 때 island 전체를 안 깨우면 "공중에 자는 바디"·"닿았는데 안 깨는 바디" 버그. 텔레포트/힘/제약 추가 시에도 깨워야 한다.
- **sleeping 채터링**: 단일 임계값이면 임계 근처에서 자고-깨고 진동 → 히스테리시스(재움/깸 임계 분리 + timeToSleep).
- **sleep 상태는 시뮬 상태다**: rollback/스냅샷([12](../12-determinism-networking.md))에 `sleepTimer`·`asleep` 플래그를 반드시 포함. 누락하면 재현/롤백 시 sleep 타이밍이 갈려 desync.
- **load imbalance**: 거대 island 하나가 병렬화를 무력화. island 내부 컬러링 분할 또는 큰 island 전용 경로([04-parallel-solver-determinism](04-parallel-solver-determinism.md)).

**다음**: [02-data-layout](02-data-layout.md) — 같은 솔버를 더 빠르게: 데이터를 캐시·SIMD 친화적으로 재배치한다.
