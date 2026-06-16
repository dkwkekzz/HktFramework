# [12·2.4] 결정적 시뮬 요건 (Requirements on the Core Loop)

> bit-exact 가 가능하려면 코어 루프의 *모든 비결정 진입점*을 닫아야 한다. 부동소수점 정책 하나로는 부족하다 — 순서·캐시·난수까지 못 박는다.
> **상위 노드**: [12-determinism-networking.md](../12-determinism-networking.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-time-integration](../03-time-integration.md) · [04-collision-detection](../04-collision-detection.md) · [05-constraint-solving](../05-constraint-solving.md)

---

[02-float-enemies](02-float-enemies.md) 가 *값* 의 결정론을 다뤘다면, 여기서는 *흐름* 의 결정론을 다룬다. 코어 시뮬 루프(`[03]` 적분 → `[04]` 충돌 → `[05]` 구속)의 비결정 진입점은 부동소수점만이 아니다. 객체 순서·캐시 매칭·난수까지 전부 못 박아야 step 이 순수 함수가 된다.

1. **고정 timestep** (`[03]`) — 가변 `dt` 는 결정론을 즉시 깬다. 고정 `Δt`(예: 1/60s) + accumulator 패턴 필수. 렌더 보간은 상태를 바꾸지 않는 *표시 전용* 으로 분리. (→ [03-time-integration](../03-time-integration.md))

2. **안정적 객체·접촉 순서** — 시뮬 결과는 `[05]` 솔버가 접촉/조인트를 푸는 **순서에 의존**한다(PGS/sequential impulse 는 순서 민감). 객체는 영속 ID 로, 접촉은 `(idA, idB, featureId)` 같은 결정적 키로 **stable sort** 해야 한다. 포인터 주소·해시 순회 순서로 정렬하면 실행마다 달라진다. (→ [05-constraint-solving](../05-constraint-solving.md))

3. **결정적 broadphase 순회** (`[04]`·`[11]`) — DBVT/SAP/공간 해시가 만드는 후보쌍 목록의 *순서* 가 다음 단계 입력이다. 트리 재구성·해시 버킷 순회를 결정적으로(삽입 순서 무관하게 ID 정렬로) 산출. (→ [04-collision-detection](../04-collision-detection.md) · [11-spatial-structures](../11-spatial-structures.md))

4. **warm-start 캐시 순서** (`[05]`) — TGS/sequential impulse 의 warm starting 은 이전 프레임 람다(λ)를 캐시에서 끌어온다. 캐시 매칭과 적용 순서가 결정적이어야 누적 결과가 일치.

5. **결정적 난수** — 모든 RNG 는 명시 시드 + 결정적 알고리즘(xorshift/PCG). `rand()`·스레드 로컬 RNG·시간 시드 금지. 단 한 줄의 `std::random_device` 가 전체 결정론을 깬다.

6. **상태에 영향 주는 부동소수점 전부** 를 [02-float-enemies](02-float-enemies.md) 정책 아래 둔다. 디버그 드로/로깅 등 *상태에 안 들어가는* 계산은 자유 — 결정론의 경계는 "다음 step 의 입력이 되는가"다.

> 직관: 결정론은 step 함수를 **순수 함수**로 만드는 작업이다. 위 1~6 은 step 이 숨어서 의존할 수 있는 비결정 입력 — 시계(1), 메모리 주소(2·3), 캐시 잔재(4), 엔트로피(5), 부동소수점 자유(6) — 을 하나씩 봉인하는 목록이다. 하나라도 새면 desync 가 난다.

이 요건들은 `[13]` 병렬화와 정면으로 충돌한다(순서를 흩뜨리므로). 결정성과 성능을 동시에 원하면 **결정적 reduction·그래프 컬러링**을 처음부터 설계해야 한다(→ [13-performance-parallelism](../13-performance-parallelism.md)).

---

**관련 함정** (전체 체크리스트는 [12-determinism-networking §5](../12-determinism-networking.md#5-함정--결정론-체크리스트)):
- **순회 순서가 새는 곳** — 포인터 정렬·`std::unordered_map` 순회·해시 버킷 순서·불안정 동률은 전부 비결정. 영속 ID + stable sort + ID tie-break.
- **RNG 누수** — `rand()`·`std::random_device`·시간 시드 한 줄이 전체를 깬다. 시드 통제 하에 명시적으로.
- **렌더 보간이 시뮬에 새지 않게** — 보간/외삽은 표시 전용. 다음 step 입력으로 피드백되면 결정론이 깨진다.

**다음**: [05-network-models](05-network-models.md) — 이 결정론을 전제로(또는 우회해) 물리를 동기화하는 네트워크 모델들.
