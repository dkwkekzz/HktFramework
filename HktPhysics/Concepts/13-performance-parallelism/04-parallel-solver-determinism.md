# [13·2.4] 병렬 솔버 · 합산 순서 결정론 (Parallel Solver: Coloring, Batching & Deterministic Reduction)

> 직렬인 PGS 를 병렬로 돌리려면 "동시에 풀어도 안전한 제약"을 골라야 한다(그래프 컬러링·batch). 그리고 그 병렬 합산이 매 실행 같은 비트를 내도록 순서를 고정한다 — 결정론의 핵심 전장.
> **상위 노드**: [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [05-constraint-solving](../05-constraint-solving.md) · [12-determinism-networking](../12-determinism-networking.md) · [00-foundations](../00-foundations.md)

---

[01-sleeping-island](01-sleeping-island.md) 으로 island 을 갈라 *island 간* 병렬은 거저 얻었다. 문제는 **하나의 island 내부**다 — 그 안의 접촉 제약들은 서로 바디를 공유해 의존하므로 마구잡이 병렬은 데이터 레이스를 일으킨다. 이 절은 그 내부를 안전하게 쪼개는 법(컬러링·batch)과, 병렬이 만든 합산을 결정론적으로 다시 모으는 법을 다룬다.

## SIMD batch — 같은 식을 4·8개 제약에 동시에

SoA([02-data-layout](02-data-layout.md))가 깔리면 한 SIMD 명령으로 4개(SSE)·8개(AVX) 제약을 동시에 푼다. 접촉 솔버의 내부 루프는 본질적으로 같은 식을 제약마다 반복하므로 SIMD 의 이상적 대상이다.

```
# 4-wide 접촉 충격량 (SoA, lane = 4개 제약 동시)
for batch in constraints.groups_of(4):
    jv   = simd_dot4(batch.normal, batch.relVel)        # 4개 동시 내적
    dλ   = -batch.effMass * (jv + batch.bias)
    λnew = simd_max4(batch.λ + dλ, 0)                    # 4개 동시 클램프(λ≥0)
    dλ   = λnew - batch.λ; batch.λ = λnew
    apply_impulse4(batch, dλ)                            # gather/scatter
```

문제는 단 하나: PGS 는 본질적으로 **직렬**(이전 제약의 결과를 다음이 읽음)이라, 4-wide 로 묶으려면 **같은 batch 안의 4개 제약이 서로 다른 바디 쌍**이어야 한다(공유 바디 없음). 그래야 lane 간 데이터 의존이 없다. 이 "공유 바디 없는 묶음 만들기"가 그래프 컬러링이다.

> 📐 **심화: 그래프 컬러링으로 병렬 충돌 솔버를 어떻게 쪼개나** — "공유 바디 없는 제약끼리 묶는다"는 한 줄이 실제로는 *제약 그래프 채색* 문제이고, 왜 색이 곧 병렬 안전 단위인지·색 사이는 왜 순차여야 하는지·Gauss-Seidel 의 직렬 의존이 어떻게 색 안에서 풀리는지가 직관 장벽이다. [04a-graph-coloring-batching](04a-graph-coloring-batching.md) 에서 그래프로 푼다.

## 결정적 병렬화의 어려움 — 부동소수점 결합법칙

부동소수점 덧셈은 **결합법칙이 깨진다**: `(a+b)+c ≠ a+(b+c)` (반올림이 매 연산 다르게 일어나므로). 한 바디가 여러 제약에서 충격량을 받아 합산할 때, **스레드 완료 순서가 매번 다르면 합산 순서가 달라져 결과가 비트 단위로 갈린다.** 이것이 [12](../12-determinism-networking.md) 위반 — desync — 의 1순위 원인이다.

결정론을 지키는 세 처방:

1. **고정 작업 분할**: island/배치 분배를 스레드 수·스케줄과 *무관*하게 입력에만 의존시킨다. 코어가 4개든 16개든 같은 batch 구성이 나와야 한다.
2. **순서 독립 reduction**: 한 바디로 들어오는 충격량을 스레드 로컬에 모은 뒤, **정해진(인덱스 정렬된) 순서**로 최종 합산한다. 합산 *순서*가 입력으로 결정되면 비트가 재현된다.
3. **원자적 누산 금지**: `atomic add` 는 빠르지만 도착 순서대로 더해 **순서가 비결정적** → 결정론 빌드에선 금지. (눈요기 전용이면 허용 가능 — [05-gpu-physics](05-gpu-physics.md) 와 같은 사고.)

```
# 결정적 reduction 스케치
thread_local accum[body]              # 스레드별 부분합
parallel_for(c in color): accum_local[c.body] += impulse(c)
# 병렬 끝난 뒤, 바디 인덱스 오름차순으로 고정 순서 합산:
for body in sorted(bodies):
    v[body] += sum_in_fixed_order(accum_local_from_all_threads[body])
```

Jolt 가 "병렬이면서 결정적"을 달성한 비결이 바로 이 **고정 분할 + 정렬 합산**이다. 핵심 통찰: 결정론은 "병렬을 포기"해서가 아니라 **비결정성의 원천(순서)을 입력에 고정**해서 얻는다.

---

**관련 함정** (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트)):
- **스레드 완료 순서 = desync 원인 1순위**: 누산 순서가 스레드 스케줄에 의존하면 같은 입력도 다른 출력. → 고정 분할 + 정렬 reduction. `atomic add` 누산은 결정론을 죽인다.
- **SIMD batch 의 숨은 의존**: 같은 batch 에 공유 바디가 끼면 lane 간 데이터 레이스 → 컬러링으로 보장. 자동 SIMD(컴파일러)에 맡기지 말고 명시적 batch 구성([04a-graph-coloring-batching](04a-graph-coloring-batching.md)).
- **load imbalance**: 거대 island 하나가 병렬화를 무력화 → island 내부 컬러링 분할 또는 큰 island 전용 경로.

**다음**: [04a-graph-coloring-batching](04a-graph-coloring-batching.md) — 컬러링의 그래프적 정체. (병렬 솔버를 넘어가려면 [05-gpu-physics](05-gpu-physics.md) 로.)
