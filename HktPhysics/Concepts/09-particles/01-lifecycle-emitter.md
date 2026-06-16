# [09·2.1] 수명주기와 에미터 (Particle Life-cycle & Emitter)

> 입자가 매 프레임 태어나고 죽는다 — spawn/update/kill 루프, 그 비용의 진짜 정체인 메모리 회전(pool·ring·SoA), 그리고 초기 상태를 뿌리는 에미터.
> **상위 노드**: [09-particles.md](../09-particles.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-dynamics](../02-dynamics.md) · [03-time-integration](../03-time-integration.md)

---

## 1. 파티클의 상태와 생애주기

한 입자의 최소 상태는 [02 동역학](../02-dynamics.md)의 질점(point mass) 그 자체다 — 위치와 속도뿐, 회전·관성텐서는 없다:

```
struct Particle {
    vec3  position;     // x
    vec3  velocity;     // v
    float age;          // 생성 후 경과 시간
    float lifetime;     // 총 수명 (age >= lifetime → 소멸)
    // 시각 속성 (물리 무관): color, size, rotation(빌보드용 스칼라각), ...
}
```

강체 파이프라인과 가장 다른 점은 **입자가 매 프레임 태어나고 죽는다**는 것이다. 생애주기(life-cycle)는 세 단계 루프다:

```
1. SPAWN   에미터가 방출률에 따라 신규 입자 생성, 초기 분포 샘플링
2. UPDATE  force field 적분(03) → age += dt
3. KILL    age >= lifetime || 경계 이탈 || 충돌 소멸 → 슬롯 반환
```

SPAWN의 분포 샘플링은 §3(에미터), UPDATE의 force/적분은 [02-force-fields](02-force-fields.md)/[03-integration](03-integration.md)에서 다룬다. 이 문서의 나머지는 KILL과 SPAWN을 떠받치는 **메모리 회전**에 집중한다.

---

## 2. 메모리 — pool 과 ring buffer (life-cycle 의 진짜 비용)

매 프레임 수만 개를 할당/해제하면 힙이 죽는다. 그래서 파티클 시스템의 자료구조는 사실상 **고정 크기 풀(fixed-size pool)** 로 정해져 있다.

- **Object pool**: `MaxParticles` 크기 배열을 선두 할당. `aliveCount`로 활성 구간 관리. 소멸 시 **swap-and-pop**(죽은 슬롯을 마지막 활성 입자와 교환 후 `aliveCount--`) — 순서가 깨지지만 O(1)이고 활성 입자가 배열 앞쪽에 조밀하게 유지되어 캐시·SIMD에 유리하다.
- **Ring buffer**: 수명이 균일할 때, 가장 오래된 것이 항상 먼저 죽으므로 head/tail 인덱스만으로 관리. 정렬·교환 불필요.
- **SoA(Structure of Arrays)**: `position[]`, `velocity[]`를 분리 배열로 — SIMD/GPU coalesced access의 전제. AoS(위 struct 나열)는 직관적이지만 대량에선 SoA가 표준([13 성능](../13-performance-parallelism.md)).

```
// swap-and-pop kill — O(1), 순서 비보존
void Kill(int i) {
    aliveCount--;
    swap(particle[i], particle[aliveCount]);   // 죽은 슬롯에 마지막 활성 입자를 당겨옴
    // 주의: i 슬롯이 새 입자로 채워졌으므로 같은 i 를 다시 검사해야 한다
}
```

> 핵심 통찰: 파티클 "물리"의 절반은 적분이 아니라 **메모리 회전(pool 재활용)** 이다. 풀 고갈(pool exhaustion) 시 정책 — 신규 방출 드롭 vs 가장 오래된 것 강제 소멸 — 을 반드시 명시해야 한다. 안 정하면 버스트 때 비결정적으로 이펙트가 사라진다.

GPU 구현에서는 이 pool/free-list 관리가 atomic 카운터로 옮겨가는데, 그 데이터 흐름의 직관은 [04a-gpu-pipeline-dataflow](04a-gpu-pipeline-dataflow.md).

---

## 3. 에미터 (Emitter) — 분포의 샘플링

에미터는 입자를 **어디서·얼마나·어떤 초기 상태로** 만드는가를 규정한다.

**방출 모드:**

```
Continuous : 초당 R 개. 누적 = R * dt. 소수부 carry 로 dt 변동 흡수.
             emitAccumulator += R * dt;
             spawnCount = floor(emitAccumulator);
             emitAccumulator -= spawnCount;
Burst      : 특정 시각 t 에 N 개 한꺼번에 (폭발·타격 이펙트).
```

소수부 carry(누적기에 분수를 남겨 다음 프레임으로 넘기는 것)는 가변 dt에서 평균 방출률을 유지해 준다. 단 이 누적이 dt에 의존하므로 결정론 경로에서는 고정 dt가 전제다(§4).

**초기 분포(initial distribution) 샘플링:**

```
위치   : 점 / 선 / 디스크 / 구 / 박스 / 메시 표면 — 형상 위 균일 샘플
속도   : 방향(콘 각도 등) + 속력 [vmin, vmax] 무작위
수명   : lifetime ∈ [Lmin, Lmax]
크기/색 : life 에 따른 커브(curve)로 보간 (대부분 시각 전용)
```

여기서 **모든 무작위는 RNG 호출**이며, 이것이 결정론(§4)의 첫 번째 지뢰다. "형상 위 균일 샘플"은 생각보다 까다롭다 — 예컨대 구 표면을 균일하게 뿌리려면 단순 `(rand, rand, rand)` 정규화로는 모서리에 몰린다(올바른 균일 구면 샘플링 필요). 디스크도 `r = R*sqrt(rand)`로 면적 비례 보정을 해야 중심 쏠림이 없다.

---

## 4. 관련 함정

(전체 체크리스트는 [09-particles §5](../09-particles.md#5-함정--결정론-체크리스트))

- **RNG 공유 오염**: 시각 파티클의 RNG가 게임플레이 RNG 스트림과 같은 시드를 당기면, 비결정 시각 효과가 결정론 게임플레이를 깨뜨린다. **스트림을 물리적으로 분리**하라(별도 RNG 인스턴스, 별도 seed).
- **swap-and-pop 순서 비결정**: 죽은 슬롯 교체로 배열 순서가 바뀌면, 순서 의존 연산(합산 누적 순서 등 부동소수점)이 미세하게 달라진다. 결정론 경로에선 순서 안정 소멸(stable removal) 또는 stable index 사용.
- **Pool 고갈 정책 미정**: `MaxParticles` 초과 시 동작(드롭/강제소멸)을 안 정하면 비결정적 버그. 정책을 명시.
- **방출 누적기 dt 의존**: 소수부 carry가 dt에 의존하므로, 결정론 경로에선 고정 dt를 가정해야 방출 시점·개수가 재현된다([03](../03-time-integration.md)의 고정 timestep accumulator).

**다음**: [02-force-fields](02-force-fields.md) — 태어난 입자를 움직이는 힘·필드, 그리고 간이 충돌.
