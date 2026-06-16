# [13·2.2a] SoA·SIMD 데이터 재배치 — 왜 줄세우기가 처리량을 가르나 (SoA & SIMD, from the layout up)

> "필드를 연속으로 두면 빠르다"의 *왜*를 근본부터 푼다 — SIMD lane 이 메모리에서 어떻게 채워지는가, AoS 위 SIMD 가 왜 거의 항상 손해인가, gather/scatter 비용이 어디서 오는가.
> **상위 노드**: [02-data-layout.md](02-data-layout.md) · [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations](../00-foundations.md)

---

## 0. 한 문장 요약

> **SIMD 한 명령은 "나란히 붙어 있는 N개 float 를 통째로 한 레지스터에 싣고, 같은 연산을 N번 동시에" 한다.** SoA 는 솔버가 실제로 묶어 처리하는 값들(여러 바디의 같은 필드)을 메모리에서 정확히 그 "나란히 붙은" 모양으로 미리 늘어놓는 재배치다. AoS 는 그 값들 사이에 안 쓰는 필드를 끼워 넣어 한 줄 로드를 불가능하게 만들고, 그래서 흩어 모으는(gather) 비싼 길로 돌아가게 한다.

---

## 1. SIMD 가 메모리에서 lane 을 채우는 법

SSE 는 128비트 레지스터에 `float` 4개, AVX 는 256비트에 8개를 담는다. 이 "동시에 처리되는 한 칸"을 **lane** 이라 부른다. 4-wide 덧셈 한 명령은:

```
[a0 a1 a2 a3] + [b0 b1 b2 b3] = [a0+b0  a1+b1  a2+b2  a3+b3]   # lane 4개 동시
```

여기서 결정적인 사실: 이 레지스터를 **빠르게** 채우는 길은 메모리에서 *연속한 16바이트*(float 4개)를 한 번에 긁어 오는 **정렬 로드(aligned load)** 다. 즉 SIMD 가 진짜 빨라지려면, 같이 처리할 4개 값이 메모리에서 **물리적으로 나란히** 있어야 한다.

이것이 레이아웃 문제로 직결되는 이유다 — "어떤 4개를 한 lane 묶음으로 처리하는가"가 정해지면, 그 4개를 메모리에서 어떻게 늘어놓을지가 곧장 따라온다.

## 2. 솔버는 무엇을 4개씩 묶나 — "여러 바디의 같은 필드"

물리 솔버 내부 루프의 본질은 **같은 식을 제약마다(또는 바디마다) 반복**하는 것이다. 예: 접촉 충격량 갱신은 모든 제약에 대해 똑같은 `dλ = -effMass * (jv + bias)` 를 돈다. 4-wide 로 묶으려면 *서로 다른 4개 제약*의 같은 양(`effMass`, `jv`, `bias`)을 각 lane 에 싣는다.

즉 한 묶음에 들어가는 것은 "한 바디의 pos.x/pos.y/pos.z" 가 **아니라** "바디0.velX / 바디1.velX / 바디2.velX / 바디3.velX" — *여러 객체의 같은 필드*다. 솔버가 실제로 병렬화하는 축이 바로 이 축이다.

## 3. 두 레이아웃을 lane 으로 겹쳐 보기

같은 데이터(N개 바디의 velX/velY/velZ)를 두 방식으로 늘어놓고, "4개 바디의 velX 를 한 레지스터에 싣기"가 어떻게 되는지 보자.

```
AoS:  [vx0 vy0 vz0 | vx1 vy1 vz1 | vx2 vy2 vz2 | vx3 vy3 vz3 | ...]
            ↑               ↑               ↑               ↑
       원하는 lane:  vx0 ......... vx1 ......... vx2 ......... vx3
       → 3칸씩 띄엄띄엄(stride=3). 한 줄 로드로 못 담는다.
       → lane 마다 따로 긁어 모아야 함 = gather (느림)

SoA:  [vx0 vx1 vx2 vx3 | vx4 ... ][vy0 vy1 vy2 vy3 ...][vz0 ...]
       ↑___________↑
       원하는 lane:  vx0 vx1 vx2 vx3  ← 이미 연속 16B
       → 정렬 로드 한 방에 레지스터가 채워진다 (빠름)
```

직관: SoA 는 솔버가 *어차피 묶어 처리할* 값들을 메모리에서 미리 그 묶음 모양으로 정렬해 둔 것이다. 그래서 로드가 곧 lane 충전이 된다. AoS 는 같은 값들 사이에 `vy`, `vz` 가 끼어 stride 가 생기고, SIMD 가 한 줄로 못 담는다.

## 4. 왜 AoS 위 SIMD 는 거의 항상 손해인가 — 두 가지 낭비

**(1) 캐시라인 낭비.** 캐시는 64B 라인 단위로 메모리를 끌어온다. "모든 바디의 velX 만" 훑는 패턴에서:

- SoA: velX 들이 연속이라 64B 라인 16개 float 가 *전부 velX* — 100% 유효.
- AoS: 한 라인을 끌면 vx 하나당 vy·vz(·pos·rot…)가 딸려 와 라인의 일부만 쓴다. 대역폭의 상당 부분을 안 쓸 데이터 운반에 버린다.

memory-bound 워크로드에서 이 낭비가 곧 시간이다([02-data-layout](02-data-layout.md) 의 "2~10배").

**(2) lane 충전 비용 = gather/scatter.** AoS 에서 4개 lane 을 채우려면 stride 진 네 주소에서 따로 읽어 와야 한다. 이걸 하드웨어가 한 명령으로 해 주는 것이 **gather**(`vgather`), 쓰는 쪽이 **scatter**(`vscatter`, AVX-512)다. 하지만 gather/scatter 는 정렬 로드보다 훨씬 비싸다(여러 캐시라인 접근·지연). 그래서 "SoA 로 미리 재배치해 정렬 로드로 바꾸는" 편이 거의 항상 이긴다.

```
정렬 로드(SoA)     : 1 캐시라인 → 4 lane    (싸다)
gather(AoS, stride): 최대 4 주소 접근 → 4 lane (비싸다)
```

## 5. 남는 비용 — SoA 라도 인덱싱이 흩어지면 gather

SoA 가 만능은 아니다. 제약은 "어떤 바디 쌍"을 가리키는 인덱스를 들고 있어서, **제약 → 바디 데이터** 접근이 바디 배열 위에서 흩어진다(제약 7번이 바디 3·91 을 참조하는 식). 이때는 SoA 라도 바디 필드를 gather 로 모아야 한다.

완화책:
- **바디 데이터 재배열**: 한 batch 가 참조하는 바디들을 연속으로 모아 두면(또는 제약을 바디 인접 순으로 정렬) gather 가 줄어든다.
- **AVX-512 `vgather`/`vscatter`**: 흩어진 접근을 한 명령으로 — 그래도 정렬 로드보단 비싸다.
- batch 구성 자체를 지역성까지 고려해 짜기(같은 색 batch 안에서 바디 인덱스가 뭉치도록).

> 핵심: SoA 는 "필드 축"의 흩어짐을 없앤다. 남는 흩어짐("어떤 바디를 참조하는가" 축)은 batch/바디 정렬로 줄인다. 둘 다 결국 **로드를 정렬 로드에 가깝게** 만드는 작업이다.

## 6. lane 을 안전하게 묶으려면 — 컬러링으로 넘어가는 다리

여기까지가 "어떻게 빠르게 싣나"다. 하지만 4개 제약을 한 lane 묶음으로 *동시에 갱신*하려면 한 조건이 더 있다 — **그 4개가 같은 바디를 건드리면 안 된다.** 그러면 lane 사이에 쓰기 충돌(데이터 레이스)이 생긴다. 이 "공유 바디 없는 4개 고르기"가 곧 그래프 컬러링이고, 병렬 솔버의 본진이다.

> 그래서 SoA·SIMD 의 *데이터* 재배치(이 문서)와 *작업* 분할(컬러링)은 한 쌍이다. 작업 쪽 직관은 [04-parallel-solver-determinism](04-parallel-solver-determinism.md) 와 심화 [04a-graph-coloring-batching](04a-graph-coloring-batching.md).

---

## 7. 함정 (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트))

- **AoS 위 자동 SIMD 기대**: 컴파일러 자동 벡터화는 AoS stride 앞에서 gather 로 떨어지거나 포기한다. 처리량을 원하면 SoA 로 *명시적* 재배치.
- **gather/scatter 과신**: "AVX-512 면 흩어져도 괜찮다"는 착각. gather 는 정렬 로드보다 비싸다 — 재배치를 먼저 시도.
- **정렬 누락**: 정렬 로드(`load_ps`)는 16/32B 정렬을 요구. 안 맞으면 크래시 또는 비정렬 로드로 느려짐 → 아레나 할당 시 정렬 보장([02-data-layout](02-data-layout.md)).
- **부분 batch(꼬리)**: 제약 수가 4의 배수가 아니면 마지막 묶음의 빈 lane 처리(마스킹 또는 패딩)를 잊지 말 것.

---

## 8. 더 읽기

- [02-data-layout](02-data-layout.md) — SoA/AoS·캐시·아레나의 개요(이 문서의 상위 절).
- [04-parallel-solver-determinism](04-parallel-solver-determinism.md) / [04a-graph-coloring-batching](04a-graph-coloring-batching.md) — lane 을 안전하게 묶는 컬러링·배치.
- [00-foundations](../00-foundations.md) — SIMD 정렬·부동소수점 기반.
- Mike Acton, "Data-Oriented Design and C++" (CppCon 2014) — DOD 의 고전 강연.
- Box2D v3 SIMD contact 솔버 소스 — SoA 와이드 솔버의 실전 참조.
