# [07·2.3] Cloth 특화 주제 (Cloth Simulation)

> 천(cloth)만의 난제 — 자기 충돌·콜라이더 충돌·바람/공력·over-stretch(LRA/tether)·주름 — 을 다룬다. 코어 솔버는 [02-pbd-xpbd](02-pbd-xpbd.md), 여기는 그 위에 얹는 천 전용 트릭들.
> **상위 노드**: [07-deformable-bodies.md](../07-deformable-bodies.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-pbd-xpbd](02-pbd-xpbd.md) · [04-collision-detection.md](../04-collision-detection.md) · [11-spatial-structures.md](../11-spatial-structures.md)

---

천의 코어 솔버는 [02-pbd-xpbd](02-pbd-xpbd.md)(거리·굽힘 구속)지만, 천은 그 위에 얹는 별도 난제가 많다.

**자기 충돌 (self-collision).** 천이 자기 자신을 통과하지 않게 해야 한다(접힌 옷자락). 모든 질점쌍을 보는 건 O(n²) 이라 [11-spatial-structures.md](../11-spatial-structures.md) 공간 가속 구조(공간 해시·BVH)로 broad phase 를 깔고, 가까운 삼각형-점/삼각형-삼각형 쌍에만 척력 구속이나 충돌 응답을 건다. CCD([04-collision-detection.md](../04-collision-detection.md))를 섞어 빠른 천의 터널링을 막는다. **게임에서 가장 비싸고 자주 끄는 기능**이다.

**충돌체와의 충돌.** 캐릭터 몸(보통 capsule/sphere 근사 콜라이더)에 천을 얹는다. 질점이 콜라이더에 파고들면 표면 밖으로 위치 투영 + 마찰. UE Chaos Cloth 등은 스켈레탈 메시에 **collider primitive(capsule/sphere/convex)** 를 본(bone)에 붙여 근사한다 — 정확한 메시 충돌보다 훨씬 싸고 본을 따라 자동으로 움직인다.

**바람/공력 (wind / aerodynamics).** 삼각형 면적과 법선, 상대 풍속으로 항력·양력을 면에 가한다:

```
v_rel = v_wind - v_tri              # 천 면 기준 상대 풍속
F_aero = ρ * A * (Cd*(v_rel·n)*n + Cl*(...))   # 항력 Cd + 양력 Cl, n=면 법선
```

- **항력(drag, Cd)**: 면 법선 방향 상대풍의 제곱에 비례해 면을 미는 힘. 깃발을 펄럭이게 하는 주동력.
- **양력(lift, Cl)**: 면이 비스듬할 때 흐름에 수직으로 생기는 힘.

펄럭임(flag flutter)은 양력 항과 약한 감쇠가 만드는 자기 진동이다 — 감쇠가 너무 세면 축 늘어지고, 약하면 발작적으로 떤다.

**LRA / tether (long-range attachment).** PBD 천은 반복이 부족하면 **무한정 늘어나(over-stretch)** 캐릭터에서 천이 줄줄 흘러내린다. LRA 는 각 질점에 "고정점(attachment)으로부터의 최대 허용 거리"를 **단방향(one-sided) 구속**으로 걸어, 멀어지면 끌어당기되 가까우면 자유롭게 둔다.

```
if |p_i - p_anchor| > maxDist:
    p_i ← p_anchor + maxDist * normalize(p_i - p_anchor)   # 단방향(끌어당기기만)
```

거리 구속 한 줄이면 되고 반복을 거의 안 잡아먹는데도 신축을 확실히 막는다 — 적은 반복으로도 over-stretch 를 잡는 값싼 트릭. Chaos·NvCloth 모두 채택. 단방향이라 천이 안쪽으로 자유롭게 접히는 것은 막지 않는다.

**주름 (wrinkles).** 저해상도 시뮬 + 고해상도 normal map/메시 디테일을 얹거나(post wrinkle), 굽힘 구속을 약하게 해 자연스러운 접힘을 유도한다. 시뮬 해상도를 올리는 것보다 훨씬 싸게 디테일을 산다.

**UE Chaos Cloth 작업 흐름.** Skeletal Mesh → Cloth Editor 에서 painting(질량/강성/max-distance 등 weight map) → collider(capsule/sphere/convex) 부착 → Chaos Cloth(XPBD 기반)가 런타임 시뮬. max-distance weight map 이 곧 LRA 의 질점별 `maxDist` 다.

---

**관련 함정** (전체 체크리스트는 [07-deformable-bodies §5](../07-deformable-bodies.md#5-함정--결정론-체크리스트)):
- **over-stretch / 흘러내림**: 반복 부족 시 천이 늘어난다 → **LRA/tether** 로 단방향 max-distance.
- **self-collision 비용·불안정**: O(n²) 회피로 공간 해시/BVH([11](../11-spatial-structures.md)) 필수, 그래도 가장 비싼 항목 — LOD 로 끄거나 거리로 컬링.
- **빠른 천 터널링**: 콜라이더/자기 충돌에 CCD([04](../04-collision-detection.md)) 섞기.

**다음**: [04-fem](04-fem.md) — 천·soft 의 *이산* 모델을 넘어 연속체역학으로 가는 길.
