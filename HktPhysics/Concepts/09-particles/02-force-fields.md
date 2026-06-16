# [09·2.2] 힘·필드와 간이 충돌 (Force Fields & Approximate Collision)

> 09 동역학의 본체. 입자는 서로를 안 보므로 각자 외부 장(field)의 합만 계산하면 끝 — 그래서 완전 병렬이다. 충돌마저 "근사"로 친다.
> **상위 노드**: [09-particles.md](../09-particles.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-dynamics](../02-dynamics.md) · [03-time-integration](../03-time-integration.md)

---

## 1. 힘·필드 — 09 의 동역학 본체

입자에 작용하는 가속도는 외부 **장(field)** 들의 단순 합이다. 입자끼리 영향을 주지 않으므로([08 유체](../08-fluids.md)와의 결정적 차이) 각 입자는 독립적으로 `a(x, v, t)` 만 계산하면 된다 — 이웃을 읽지 않으니 완전 병렬(embarrassingly parallel)이다:

```
a_total = Σ_field  a_field(x, v, t)

중력(gravity)   : a = g                                  (상수)
항력(drag)      : a = -k * v          (선형)  또는  -k * |v| * v  (이차)
끌림(attractor) : a = G * (p_center - x) / |p_center - x|^3    (점 인력/척력)
와류(vortex)    : a = ω × (x - axis)                     (축 주위 회전)
난류(turbulence): a = curl( noise(x, t) )                (curl noise — 발산 0)
```

각 필드가 `(x, v, t)`만의 함수라는 점이 핵심이다. 이웃 입자 상태가 인자에 없으므로 [11 공간 구조](../11-spatial-structures.md)(이웃 탐색)가 필요 없고, N개 입자를 N개 스레드에 그냥 뿌리면 된다. 이것이 09가 수백만 규모로 가는 근본 이유이고, 이웃을 읽는 순간 07/08로 넘어가는 경계이기도 하다([05-simulation-boundary](05-simulation-boundary.md)).

---

## 2. Curl noise — 왜 noise 를 그냥 쓰면 안 되는가

**Curl noise** 가 절차적 난류의 핵심 기법이다. 단순 noise를 속도장으로 직접 쓰면 발산(divergence)이 0이 아니라 — 즉 장 안에 "샘(source)"과 "싱크(sink)"가 생겨 — 입자가 특정 점으로 뭉치거나 흩어진다. 연기·불꽃이 한 점으로 빨려드는 부자연스러운 결과다.

해법은 noise 포텐셜의 **회전(curl)** 을 속도로 쓰는 것이다. 벡터 항등식

```
∇ · (∇ × F) = 0      // 임의의 벡터장 F 의 회전은 발산이 0
```

이 항상 성립하므로, `velocity = curl(noisePotential)` 로 만든 속도장은 **발산 0**(비압축, divergence-free)이 보장된다. 결과적으로 입자가 뭉치지 않고 **비압축성처럼 보이는** 자연스러운 소용돌이가 나온다 — 입자 상호작용 없이, 즉 [08 유체](../08-fluids.md)의 SPH 비용 없이 유체의 외형만 싸게 흉내 내는 것이다.

> 직관: 진짜 유체는 이웃 압력으로 비압축을 *강제*하지만(비쌈), curl noise는 처음부터 발산 0인 장을 *공짜로 합성*한다(쌈). 외형은 비슷하되 09는 물리를 풀지 않는다.

---

## 3. 간이 충돌 (Approximate Collision)

충돌(collision)을 09에서는 정식 [04 충돌 감지](../04-collision-detection.md)의 narrow phase 없이 **근사**로 처리한다:

```
Plane collision        : signed distance < 0 이면 위치 보정 + 속도 반사
                         v' = v - (1+e)(v·n) n            // e = 반발계수(restitution)
SDF collision          : 정적 형상을 부호거리장으로 굽고 입자마다 1회 질의 (단일 물체엔 정확)
Depth-buffer collision : GPU 파티클의 사실상 표준 — 화면 depth 를 충돌면으로 재활용
```

- **Plane**: 가장 싸다. 바닥·벽 같은 무한 평면에 대해 부호거리로 침투를 검출하고 법선 방향 속도 성분을 반사한다. 반발계수 `e`로 튐 정도를, 마찰로 접선 속도 감쇠를 흉내 낸다.
- **SDF(signed distance field)**: 정적/소수 동적 형상을 부호거리장으로 미리 구워 3D 텍스처로 상주. 입자마다 1회 샘플로 거리와 gradient(=normal)를 동시에 얻는다. 화면 의존성이 없어 plane보다 정확하지만, 동적 형상은 SDF 갱신 비용 때문에 제한적.
- **Depth-buffer**: GPU 파티클 전용 근사. 구조와 한계는 [04-gpu-particles §3](04-gpu-particles.md) 및 심화 [04a](04a-gpu-pipeline-dataflow.md)에서 다룬다.

어느 경우든 09의 충돌은 **단방향**이다 — 입자는 환경에 반응하지만 환경은 입자를 모른다. 입자가 환경에 힘을 되돌려주거나 입자끼리 밀어내야 하면 그것은 09의 범위를 벗어난다.

---

## 4. 관련 함정

(전체 체크리스트는 [09-particles §5](../09-particles.md#5-함정--결정론-체크리스트))

- **curl noise 누락 시 뭉침**: 단순 noise를 속도장으로 쓰면 발산≠0이라 입자가 뭉치거나 흩어진다. 반드시 `curl(noise)`로 발산 0을 보장.
- **Depth-buffer collision의 구조적 한계**: 화면 밖·오클루전 뒤 충돌 누락, 얇은/뒤쪽 면 관통, 화면공간 normal 부정확, 카메라 의존(같은 입자가 각도 따라 다르게 충돌 → 결정론 불가). 정확/결정론이 필요하면 SDF 또는 정식 [04] 충돌로. (상세 [04-gpu-particles](04-gpu-particles.md))
- **plane/SDF 침투 보정 누락**: 속도만 반사하고 위치를 표면 밖으로 밀어내지 않으면 입자가 표면에 박혀 떨린다(sticking/jitter). signed distance 만큼 되밀기 필수.

**다음**: [03-integration](03-integration.md) — 합산된 가속도로 상태를 dt 만큼 전진시키는 적분.
