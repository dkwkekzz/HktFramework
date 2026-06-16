# [09·2.4a] GPU 파티클 데이터 흐름 심화 (GPU Pipeline Dataflow, from the ground up)

> "왜 CPU가 카운트조차 못 읽게 막는가(zero-readback)", "free-list와 atomic compaction은 정확히 어떻게 도는가", "왜 하필 bitonic sort 인가", "indirect draw가 우회하는 것은 무엇인가" — GPU 파티클의 진짜 직관 장벽인 *데이터 흐름* 을 근본부터 푼다.
> **상위 노드**: [04-gpu-particles.md](04-gpu-particles.md) · [09-particles.md](../09-particles.md) · **상위 지도**: [README.md](../README.md) · **의존**: [13-performance-parallelism](../13-performance-parallelism.md)

---

## 0. 한 문장 요약

> **GPU 파티클이 어려운 이유는 적분이 아니라 "데이터가 CPU로 절대 돌아오지 않게 하면서, 동시에 가변 개수의 입자를 태우고·죽이고·정렬하는" 흐름 설계에 있다.** 핵심 제약은 단 하나 — *CPU가 GPU 결과를 기다리는 순간(readback) 파이프라인이 멈춘다*. 아래 모든 트릭(free-list, atomic compaction, indirect dispatch/draw, bitonic sort)은 이 한 제약을 우회하기 위해 존재한다.

[03-integration](03-integration.md)의 적분 자체는 한 줄짜리 per-thread 연산이라 쉽다. 어려운 건 "가변 개수"와 "되읽지 않기"의 충돌이다. 이 문서는 그 충돌을 한 걸음씩 푼다.

---

## 1. 근본 제약 — 왜 CPU↔GPU 왕복이 독인가

GPU는 수천 스레드를 묶어 처리하는 깊은 파이프라인이고, CPU와는 **비동기(async)** 로 돈다. CPU가 "지금 입자가 몇 개 살아있지?"를 알려고 GPU 버퍼를 되읽으면(**readback**):

```
CPU: dispatch(update) ──→ │ (GPU가 일하는 동안 CPU는 다음 프레임 준비)
                          │
CPU: readback(aliveCount) ─X─ GPU 가 update 끝낼 때까지 CPU 정지(stall)
                              그리고 PCIe 버스를 거꾸로 건너오는 지연까지
```

이 한 번의 동기화로 CPU·GPU 양쪽 파이프라인이 거품(bubble)을 문다. 수백만 입자를 60fps로 굴리려면 **프레임당 readback 0회**가 목표다. 그러려면 "다음에 무엇을 얼마나 할지"의 결정조차 GPU 안에서 끝나야 한다. 이것이 아래 모든 구조의 출발점이다.

---

## 2. Free-list 와 atomic — "빈 슬롯"을 수천 스레드가 동시에 집는 법

CPU 풀에서는 swap-and-pop으로 빈 슬롯을 관리했다([01-lifecycle-emitter §2](01-lifecycle-emitter.md)). GPU에서는 수천 스레드가 **동시에** 새 입자를 태우려 한다 — "다음 빈 슬롯"을 두 스레드가 같이 집으면 한 입자를 덮어쓴다(race). 

해법은 **atomic counter** 다. 빈 슬롯 인덱스들을 담은 배열(free-list)과 그 꼭대기를 가리키는 카운터를 두고, 슬롯을 집을 때 원자적으로 카운터를 내린다:

```
// 한 슬롯 할당 — 수천 스레드가 동시에 호출해도 안전
int slotIdx = atomicAdd(&freeListTop, -1);   // 원자적: 두 스레드가 같은 값을 못 받음
int particleSlot = freeList[slotIdx];        // 그 스레드만의 고유 슬롯
```

`atomicAdd`는 하드웨어가 "읽고-더하고-쓰기"를 쪼개질 수 없는 한 동작으로 보장한다. 그래서 N개 스레드가 동시에 불러도 서로 다른 N개 값을 받는다 — 충돌 없이 N개의 고유 슬롯이 분배된다.

> 직관: free-list + atomic은 "번호표 뽑기"다. 창구(스레드)가 아무리 많아도 번호표 기계(atomicAdd)가 같은 번호를 두 번 안 내준다. 단 **누가 몇 번을 받는지는 경합 순서에 달려 비결정적** — 이것이 §5 결정론 함정의 뿌리다.

---

## 3. Compaction — 죽은 입자를 GPU 안에서 솎아내기

매 프레임 일부 입자가 죽는다([01 §1](01-lifecycle-emitter.md)의 KILL). CPU라면 swap-and-pop으로 끝이지만, GPU에서는 "살아남은 것만 앞으로 모으기(compaction)"를 병렬로 해야 한다. 두 갈래:

**(a) Atomic append (alive list 재구성)** — 가장 흔하다.
업데이트 pass에서 각 스레드가 자기 입자를 검사해, 살아있으면 새 alive 버퍼에 atomic으로 밀어 넣는다:

```
// per-thread
if (particle.age < particle.lifetime) {
    int dst = atomicAdd(&aliveCount, 1);   // 새 alive 리스트에서 내 자리 예약
    aliveList[dst] = myIndex;              // 살아남은 입자 인덱스만 조밀하게 모임
}
// 죽은 입자는 자기 슬롯을 free-list 로 반환 (또 다른 atomicAdd)
```

끝나면 `aliveCount`가 다음 pass의 dispatch/draw 개수다 — **CPU로 안 보낸다**(§4).

**(b) Prefix-sum(scan) compaction** — 순서를 보존하고 싶을 때.
"내 앞에 살아있는 입자가 몇 개인가"를 병렬 prefix-sum으로 구해 그 위치에 쓴다. atomic append보다 비싸지만 **출력 순서가 입력 순서를 따라** 결정적이다(결정론 경로에서 선호).

> 두 방식의 차이가 곧 결정론 차이다 — atomic append는 빠르지만 순서가 경합에 의존(비결정), prefix-sum은 느리지만 순서 안정. [13](../13-performance-parallelism.md)의 병렬 리덕션·scan 과 같은 구조다.

---

## 4. Indirect dispatch / draw 와 bitonic sort — 카운트를 GPU에 가둔 채 일하기

§2~§3에서 `aliveCount`·`spawnCount`가 전부 GPU 버퍼 안에 있다. 이제 "그 개수만큼 스레드를 dispatch"하고 "그 개수만큼 인스턴스를 draw"해야 하는데, 개수를 CPU가 모른다 — 되읽으면 stall이다(§1).

**Indirect dispatch / draw** 가 답이다. 개수를 CPU가 인자로 넘기는 대신, **GPU 버퍼에 적힌 인자(indirect args buffer)** 를 GPU가 직접 읽어 실행한다:

```
// 보통 draw:    CPU 가 instanceCount 를 알아야 함  → readback 필요 → stall
DrawInstanced(instanceCount = ???)          // ??? 를 CPU 가 모른다

// indirect draw: 인자가 GPU 버퍼에 있음        → CPU 는 "그 버퍼로 그려"만 지시
argsBuffer = { vertexCount, aliveCount, ... } // ← compaction pass 가 GPU 에서 채움
DrawIndirect(argsBuffer)                      // GPU 가 buffer 읽어 알아서 그림
```

즉 한 compute pass가 `aliveCount`를 args 버퍼에 써 넣으면, 다음 dispatch/draw가 그 값을 GPU 내부에서 집어 쓴다. CPU는 "이 버퍼로 그려"라고 명령만 큐에 넣을 뿐, 값은 끝까지 GPU에 머문다 — **zero readback 달성**.

**왜 정렬은 bitonic sort 인가**:
반투명 입자는 back-to-front로 그려야 한다([04 §4](04-gpu-particles.md)). 그런데 quicksort 같은 비교 정렬은 **데이터 의존 분기**(피벗에 따라 경로가 갈림)가 있어 SIMD 수천 스레드에 맞지 않다 — 스레드마다 다른 길로 가면 GPU가 직렬화된다(divergence). 

**Bitonic sort** 는 **비교 위치가 데이터와 무관하게 고정된 정렬망(sorting network)** 이다. 어떤 입력이든 같은 (i, j) 쌍을 같은 순서로 비교·교환한다:

```
for k = 2, 4, 8, ... N:           // 단계 (고정)
  for j = k/2, k/4, ... 1:        // 부단계 (고정)
    각 스레드: 고정된 짝 (i, i^j) 를 비교·교환   // 분기 없음, 전부 같은 일
```

분기가 없으니 모든 스레드가 보조를 맞춰 행진한다 — GPU가 가장 잘하는 형태다. 대가는 비교 횟수 O(N log²N)로 quicksort의 O(N log N)보다 많지만, 분기 없는 병렬성이 그 손해를 압도한다.

> 직관: GPU 정렬의 철학은 "똑똑하게 적게 비교"(quicksort)가 아니라 "멍청하지만 모두가 똑같이, 분기 없이 많이 비교"(bitonic)다. 처리량 하드웨어에선 후자가 이긴다 — 09 전체의 "정확도보다 처리량" 철학([03-integration](03-integration.md))이 정렬에서도 반복된다.

---

## 5. 전체 흐름을 한눈에 — 그리고 결정론이 깨지는 지점

```
┌─ Emit pass ───────── atomicAdd 로 free-list 에서 슬롯 분배  ← 경합 순서 비결정 (§2)
│                      spawnCount 는 GPU 버퍼에 (indirect)
├─ Update pass ─────── per-thread: 필드 합산(02) → 적분(03) → age++
├─ Compact/Kill ────── atomic append: aliveCount GPU 버퍼에   ← 순서 비결정 (§3a)
│                      (또는 prefix-sum: 순서 안정 — 결정론용 §3b)
├─ Sort pass ───────── bitonic: 고정 비교망으로 view-depth 정렬 (§4)
└─ Render ──────────── DrawIndirect(argsBuffer)  ← CPU readback 0 (§4)
```

**결정론이 깨지는 정확한 지점**(왜 게임플레이 영향 파티클은 GPU를 피하나):
- **§2 emit·§3a compaction의 atomic 경합 순서**: 어느 스레드가 먼저 atomicAdd에 도달하느냐가 실행마다 다르다 → 입자가 받는 슬롯·alive 리스트 내 위치가 비결정. 순서 의존 부동소수점 합산이 미세하게 갈린다.
- **부동소수점 GPU 연산**: 같은 셰이더라도 드라이버·하드웨어별 반올림/FMA 차이로 비트가 다르다([12](../12-determinism-networking.md)).
- **해법은 회피**: 게임플레이 영향분은 CPU 시뮬([04 §1](04-gpu-particles.md))로 두거나, 정 GPU여야 하면 prefix-sum compaction(§3b)으로 순서를 못 박고 결과를 게임플레이에 *되먹이지 않는다*.

순수 시각 효과라면 이 모든 비결정성이 무해하다 — 오히려 atomic append의 속도를 마음껏 누리면 된다. **결정론 분리가 09의 1순위 원칙**인 이유가 여기서 가장 또렷하다([05-simulation-boundary](05-simulation-boundary.md)).

---

## 6. 관련 함정

(전체 체크리스트는 [09-particles §5](../09-particles.md#5-함정--결정론-체크리스트))

- **GPU 비결정성(atomic 경합)**: emit/compaction의 스레드 순서 비결정 → 게임플레이엔 치명적. 결정론 필요 시 prefix-sum + 되먹임 금지, 또는 CPU 시뮬.
- **CPU readback stall**: 카운트를 되읽으면 파이프라인이 멈춘다. indirect dispatch/draw로 카운트를 GPU에 가둘 것.
- **bitonic 입력 길이**: 고전 bitonic sort는 2의 거듭제곱 길이를 전제 — alive 개수를 패딩(빈 키를 +∞로)하지 않으면 정렬이 틀어진다.

**다음**: [05-simulation-boundary](05-simulation-boundary.md) — 이 모든 게 언제 09에 머물고 언제 07/08로 넘어가는가.
