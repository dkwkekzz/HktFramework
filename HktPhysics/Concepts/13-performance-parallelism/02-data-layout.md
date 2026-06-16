# [13·2.2] 데이터 레이아웃 (Data-Oriented Design: SoA · 캐시 · 메모리)

> 물리 솔버는 메모리 대역폭·캐시에 묶인(memory-bound) 워크로드 — 같은 수학이라도 데이터를 어떻게 늘어놓는가가 2~10배를 가른다.
> **상위 노드**: [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations](../00-foundations.md)

---

CPU 가 빨라진 속도보다 메모리가 느려진 격차가 더 커서, 현대 물리 솔버의 병목은 산술이 아니라 **데이터를 코어까지 끌어오는 일**이다. 그래서 "어떤 연산을 하는가"보다 "데이터가 캐시라인(보통 64B)에 어떻게 들어오는가"가 먼저다. 이것이 데이터 지향 설계(DOD, Data-Oriented Design)의 출발점이다.

## SoA vs AoS — 같은 데이터, 다른 줄세우기

- **AoS (Array of Structs)** — 객체지향 기본형. `struct Body { vec3 pos; vec3 vel; quat rot; ... }; Body bodies[N];`. 한 바디의 모든 필드가 인접 → 단일 객체 접근엔 좋으나, "모든 바디의 `vel.x` 만 훑기" 같은 솔버 패턴에선 매 캐시라인에 안 쓰는 필드가 끼어 대역폭을 낭비하고 SIMD 가 안 먹는다.
- **SoA (Struct of Arrays)** — DOD/SIMD 기본형. `struct Bodies { float posX[N], posY[N], posZ[N]; float velX[N]...; }`. 같은 필드가 연속 → 캐시라인이 전부 유효 데이터, **SIMD 로 4·8개 lane 을 한 번에** 로드/연산 가능.

```
AoS:  [p0 v0 r0][p1 v1 r1][p2 v2 r2]...   # 한 바디 묶음. vel만 훑으면 p,r 낭비
SoA:  [p0 p1 p2 ...][v0 v1 v2 ...][r0 ...]  # 한 필드 묶음. SIMD 친화
```

핵심 직관: 솔버 루프가 "여러 바디의 *같은 필드*를 동시에" 훑는다면 SoA, "한 바디의 *모든 필드*를" 만진다면 AoS 가 유리하다. 물리 솔버의 내부 반복은 압도적으로 전자다 — 그래서 SoA 가 기본이 된다. **SoA 는 SIMD 의 전제조건**이기도 하다(자세한 재배치 직관은 심화 문서).

> 📐 **심화: 왜 SoA 라야 SIMD lane 이 채워지나** — "필드를 연속으로 두면 빠르다"는 결론 뒤에는, SIMD 레지스터의 lane 이 메모리에서 어떻게 채워지는가(연속 로드 vs gather), AoS 위 SIMD 가 왜 거의 항상 손해인가, gather/scatter 비용이 어디서 오는가가 있다. 이 데이터 재배치 직관을 [02a-soa-simd-relayout](02a-soa-simd-relayout.md) 에서 그림으로 푼다.

## 캐시·메모리 부수 기법

SoA 가 큰 줄기라면, 다음은 그 위에서 캐시·할당·스레드를 다듬는 기법들이다.

- **메모리 풀 / 아레나(arena) 할당**: 프레임마다 contact·constraint·island 작업 버퍼를 풀에서 통째로 잡고 통째로 리셋. `new`/`delete` 산발 호출 제거 → 단편화·할당 비용 0 에 수렴, 캐시 지역성 향상. 물리는 프레임 단위로 수명이 깔끔히 끊기는 데이터가 많아 아레나가 특히 잘 맞는다.
- **인덱스 핸들 vs 포인터**: 바디를 포인터 대신 `uint32` 인덱스로 참조 → 재배치(compaction)·직렬화·결정론에 유리. 포인터 주소는 실행마다 달라 **비결정적**이고, 배열을 압축(빈 슬롯 제거)할 때 포인터는 전부 깨지지만 인덱스는 리맵 한 번이면 된다.
- **false sharing**: 서로 다른 스레드가 같은 캐시라인(64B)의 *다른* 변수를 쓰면, 하드웨어 캐시 일관성 프로토콜이 라인 전체를 코어 사이에서 핑퐁시켜 성능이 급락한다(논리적 충돌이 없는데도). 대책: 스레드별 데이터를 캐시라인 경계로 **패딩/정렬**(`alignas(64)`), 또는 스레드 로컬에 누산한 뒤 마지막에 한 번 합치기(reduction — 순서 결정론은 [04-parallel-solver-determinism](04-parallel-solver-determinism.md)).

---

**관련 함정** (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트)):
- **false sharing**: 스레드별 출력 버퍼를 캐시라인 정렬 안 하면 코어 추가가 오히려 느려진다(`alignas(64)`).
- **인덱스 vs 포인터**: 결정론·직렬화엔 인덱스. 포인터 주소는 실행마다 달라 비결정적이고 압축(compaction)을 막는다.

**다음**: [02a-soa-simd-relayout](02a-soa-simd-relayout.md) — SoA 가 SIMD lane 을 채우는 메커니즘을 그림으로. (레이아웃을 건너뛰려면 [03-job-system](03-job-system.md) 로.)
