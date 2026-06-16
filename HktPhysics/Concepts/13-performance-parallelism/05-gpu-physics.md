# [13·2.5] GPU Physics (대량 동질 시뮬의 SIMT 가속)

> 수십만 입자·옷감·유체처럼 동질(homogeneous)하고 병렬 친화적인 시뮬은 GPU 의 SIMT 모델에 완벽히 맞는다 — 단, 결정론을 화폐로 낸다.
> **상위 노드**: [13-performance-parallelism.md](../13-performance-parallelism.md) · **상위 지도**: [README.md](../README.md) · **의존**: [07-deformable-bodies](../07-deformable-bodies.md) · [08-fluids](../08-fluids.md) · [09-particles](../09-particles.md) · [12-determinism-networking](../12-determinism-networking.md)

---

CPU 병렬([03-job-system](03-job-system.md))이 수십 코어라면 GPU 는 수천 스레드다. 대신 GPU 는 **SIMT**(Single Instruction, Multiple Threads) — 수천 스레드가 *같은 명령*을 데이터만 달리해 도는 모델이라, **균일한 데이터 + 분기 적은 솔버**일 때만 진가가 난다. 무엇이 맞고 무엇이 안 맞는지가 핵심이다.

## 무엇이 GPU 에 맞나

- **잘 맞는 것**: 수십만 입자 SPH/PBF([08](../08-fluids.md)), cloth/소프트 PBD([07](../07-deformable-bodies.md)), GPU 파티클([09](../09-particles.md)) — 균일 데이터 + 병렬 친화 솔버(Jacobi 류). 모든 요소가 같은 식을 돌고 데이터 모양이 같아 SIMT lane 이 꽉 찬다.
- **덜 맞는 것**: 강체(rigid). PhysX 5 처럼 GPU 강체 솔버가 있으나, **분기·불규칙 접촉 그래프** 때문에 입자류만큼 깔끔히 떨어지지 않는다(접촉 수가 바디마다 들쭉날쭉 → SIMT 발산/divergence).

## Jacobi vs Gauss-Seidel — GPU 는 왜 Jacobi 인가

GPU 는 모든 제약을 *이전 반복 값으로* 동시에 푸는 **Jacobi/병렬 친화** 반복을 선호한다. GS([04a-graph-coloring-batching](04a-graph-coloring-batching.md))는 "방금 갱신을 즉시 본다"는 직렬 의존이 있어, 수천 스레드를 동시에 돌리는 GPU 와 상극이다.

```
Jacobi:   x_new[i] = f(x_old[*])     # 전부 이전 값 → 전 제약 동시 계산 가능 (GPU 천국)
GS:       x[i]     = f(x[< i], x_old[> i])  # 앞 갱신을 즉시 참조 → 직렬 의존
```

대가: Jacobi 는 정보 전파가 느려 **수렴이 느리다**. GPU 는 반복 수(iteration)를 늘려 이를 보상한다 — 스레드가 넘쳐 한 반복이 싸므로, 반복을 더 돌아도 이득. (색칠 GS 가 둘의 절충임은 [04a-graph-coloring-batching §4](04a-graph-coloring-batching.md#4-gauss-seidel-의-직렬성은-어디로-갔나--색칠-gs--하이브리드).)

## CPU↔GPU 동기화 비용 — 진짜 병목

연산 자체보다 **PCIe 왕복 + 커널 런치 지연**이 핵심 병목이다. 게임플레이가 매 프레임 결과를 CPU 로 회수(readback)하면 GPU·CPU 가 서로를 기다리는 **stall** 이 생긴다.

- 정석: **"GPU 안에서 끝까지 돌리고 결과는 렌더에서 직접 소비"** — 시뮬→렌더가 GPU 안에 머물면 회수가 없다.
- 충돌 콜백·트리거를 CPU 로직과 묶으려면 동기화 비용이 GPU 가속 이득을 잡아먹을 수 있다. 그래서 게임플레이에 영향 주는 판정은 GPU 로 안 넘기는 게 보통.

## 결정론 포기 — lockstep 부적합

GPU 부동소수점 결과는 **드라이버·아키텍처·스케줄링에 따라 달라진다**(워프 스케줄 순서·atomic 누산 순서 비결정). 따라서 **GPU physics 는 사실상 결정론을 포기**한다 → lockstep 멀티플레이([12](../12-determinism-networking.md))에는 부적합.

실무 분업: **게임플레이 판정은 CPU 결정론 솔버**([04-parallel-solver-determinism](04-parallel-solver-determinism.md))에 맡기고, **잔해·물보라·천 같은 "눈요기(visual-only)"는 GPU** 로 대량 처리한다. 두 길은 한 엔진 안에서 공존한다.

---

**관련 함정** (전체 체크리스트는 [13-performance-parallelism §5](../13-performance-parallelism.md#5-함정--결정론-체크리스트)):
- **GPU 는 결정론을 포기한다**: 드라이버/아키텍처별 부동소수점 차이 → lockstep([12](../12-determinism-networking.md)) 불가. GPU 결과를 게임플레이 판정에 쓰지 말 것(눈요기 전용).
- **readback stall**: 매 프레임 CPU 회수는 PCIe 왕복·커널 런치로 stall. GPU 안에서 완결 후 렌더가 직접 소비.
- **강체 GPU 의 divergence**: 불규칙 접촉 그래프는 SIMT 발산을 일으켜 입자류만큼 빠르지 않다 — 강체는 보통 CPU.

**다음**: [06-profiling-lod](06-profiling-lod.md) — 어느 다이얼을 얼마나 돌릴지: 프로파일링·예산·물리 LOD.
