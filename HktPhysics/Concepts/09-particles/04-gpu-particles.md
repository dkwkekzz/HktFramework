# [09·2.4] GPU 파티클 파이프라인 (GPU Particles)

> 수십만~수백만 입자의 표준 구현. 입자 상태를 GPU 버퍼에 두고 compute shader 가 통째로 굴린다 — CPU는 거의 손을 안 댄다.
> **상위 노드**: [09-particles.md](../09-particles.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-integration](03-integration.md) · [13-performance-parallelism](../13-performance-parallelism.md)

---

## 1. CPU 파티클 — 언제 충분한가

먼저 GPU가 *필요 없는* 경우. 소규모(수백~수천), 게임플레이 로직과 결합이 쉬워야 하는 경우는 **CPU 파티클**이 정답이다. SoA + SIMD로 수만까지 끌어올릴 수 있고, swap-and-pop 풀([01-lifecycle-emitter](01-lifecycle-emitter.md))로 관리하며, 무엇보다 **결정론 확보가 쉽다**(§4). 게임플레이 영향 파티클은 거의 CPU다.

대량·순수 시각이면 GPU로 넘어간다.

---

## 2. GPU 파티클 — compute shader 파이프라인

대량(수십만~수백만)의 표준. 입자 상태를 GPU 버퍼(SSBO/structured buffer)에 두고 **compute shader** 가 단계별로 업데이트한다:

```
[Emit pass]    indirect dispatch 로 spawnCount 만큼 슬롯 채움 (atomic counter 로 free-list 관리)
[Update pass]  per-thread = per-particle: force field 합산 → 적분 → age++
[Compact/Kill] 죽은 입자 제거 (atomic compaction 또는 alive list 재구성)
[Sort pass]    알파 블렌딩용 view-depth 정렬 (bitonic sort) — 필요 시
[Render]       instanced billboard draw (indirect args 로 CPU readback 회피)
```

각 pass는 [02-force-fields](02-force-fields.md)의 필드 합산과 [03-integration](03-integration.md)의 적분을 그대로 per-thread로 돌리는 것이다. 입자가 이웃을 안 보므로 한 스레드 = 한 입자로 완벽히 병렬화된다.

CPU는 거의 관여하지 않는다 — **zero readback** 이 목표다. 살아있는 입자 카운트조차 GPU에 머물고, CPU로 되읽지 않은 채 `DrawIndirect`로 렌더한다.

> 📐 **심화**: 왜 이런 모양인가 — "왜 CPU가 카운트를 못 읽게 하는가(zero-readback)", "free-list와 atomic compaction은 정확히 어떻게 도는가", "왜 정렬이 bitonic sort 인가", "indirect draw가 무엇을 우회하는가" 를 데이터 흐름 관점에서 푼 전용 문서 → [04a-gpu-pipeline-dataflow.md](04a-gpu-pipeline-dataflow.md). GPU 파티클의 직관 장벽은 적분이 아니라 **이 데이터 흐름**에 있다.

---

## 3. GPU 파티클의 충돌 — 씬을 모르는 입자

GPU 파티클은 씬 지오메트리를 모른다(전체 충돌 메시를 GPU로 넘기는 비용이 과다하다). 그래서 충돌을 두 근사로 푼다.

**Depth-buffer collision** (사실상 표준):
이미 렌더된 **depth buffer** 를 충돌 표면으로 재활용한다.

```
1. 입자를 화면 공간(screen space)으로 투영
2. 해당 픽셀의 depth 와 입자 depth 비교
3. 입자가 표면 "뒤"면 충돌로 간주
4. 화면공간 normal(depth 미분 ∂z/∂x, ∂z/∂y)로 반사
```

공짜에 가깝지만(이미 있는 버퍼 재활용) 구조적 한계가 많다(§4).

**SDF collision** (정적/소수 동적):
정적 형상을 부호거리장(signed distance field)으로 미리 구워 3D 텍스처로 GPU에 상주시킨다. 입자마다 1회 샘플로 거리·gradient(normal) 획득 → depth-buffer 방식의 화면 의존성을 제거. 동적 형상은 SDF 갱신 비용 때문에 제한적. (개념 자체는 [02-force-fields §3](02-force-fields.md))

UE Niagara는 후자를 **Global Distance Field** 로 제공해 [11 공간 구조](../11-spatial-structures.md) 없이도 환경 충돌을 처리한다.

---

## 4. 정렬 (sorting) — 물리가 아니라 렌더 문제

정렬은 물리가 아니라 렌더 문제지만 GPU 파이프라인에 끼므로 여기서 다룬다. 반투명 알파 블렌딩(alpha blending)은 화면에서 **back-to-front** 순서로 그려야 올바르므로 view-depth 정렬이 필요하다. 수백만 입자를 GPU에서 정렬하려면 분기 없는 병렬 정렬망인 **bitonic sort** 를 쓴다(O(N log²N), GPU 친화).

반대로 **additive 블렌딩**(불꽃·빛)은 더하기라 순서 무관(commutative) → **정렬 생략 가능**. 실무에선 additive 이펙트를 우선해 정렬 비용을 통째로 피하기도 한다.

bitonic sort가 왜 GPU에 맞는지(분기 없는 고정 비교 네트워크)는 [04a-gpu-pipeline-dataflow §4](04a-gpu-pipeline-dataflow.md).

---

## 5. 관련 함정

(전체 체크리스트는 [09-particles §5](../09-particles.md#5-함정--결정론-체크리스트))

- **GPU 비결정성**: atomic 카운터 기반 emit/compaction은 스레드 경합 순서가 비결정 → 입자 인덱스·정렬 결과가 실행마다 다를 수 있다. 부동소수점 GPU 연산은 드라이버/하드웨어별로도 다르다([12](../12-determinism-networking.md)). 시각엔 무해, 게임플레이엔 치명적 — 게임플레이 영향분은 CPU 시뮬로.
- **Depth-buffer collision의 구조적 한계**([13](../13-performance-parallelism.md)):
  - 화면 밖·오클루전 뒤 표면은 depth가 없어 **충돌 누락**(입자가 통과).
  - depth는 가장 앞 표면만 알므로 **얇은/뒤쪽 면 관통**.
  - 화면공간 normal은 depth 미분 추정이라 가장자리에서 부정확.
  - 카메라 의존 → 같은 입자가 카메라 각도에 따라 다르게 충돌(결정론 불가). 정확/결정론이 필요하면 SDF 또는 정식 [04] 충돌로.
- **CPU readback으로 인한 stall**: 카운트를 CPU로 되읽어 draw call을 구성하면 GPU↔CPU 동기화로 파이프라인이 멈춘다. `DrawIndirect`로 카운트를 GPU에 둔 채 렌더([04a](04a-gpu-pipeline-dataflow.md)).

**다음**: [04a-gpu-pipeline-dataflow](04a-gpu-pipeline-dataflow.md) — 이 파이프라인의 데이터 흐름을 근본부터. (또는 경계 정리로 → [05-simulation-boundary](05-simulation-boundary.md))
