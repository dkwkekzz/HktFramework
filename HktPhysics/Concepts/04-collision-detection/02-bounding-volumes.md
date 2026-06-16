# [04·2.2] Bounding volume — 형상을 감싸는 대리 도형 (Bounding Volumes)

> narrow phase 전, 또는 broad phase 의 잎으로 쓰는 근사 도형. **타이트할수록 false positive 가 줄지만 겹침 테스트가 비싸다** — 이 트레이드오프가 BV 선택의 전부다.
> **상위 노드**: [04-collision-detection.md](../04-collision-detection.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md)

---

bounding volume(BV, 경계 볼륨)은 복잡한 형상을 감싸는 단순한 대리 도형이다. 두 BV 가 안 겹치면 안의 실제 형상도 안 겹치므로, 비싼 narrow phase 를 호출하기 전에 싼 BV 테스트로 먼저 reject 한다. 핵심 긴장:

- **타이트(tight)할수록** 빈 공간을 적게 감싸 → false positive(실제론 안 겹치는데 통과)가 줄어 narrow phase 호출이 줄어든다.
- 하지만 **타이트한 BV 일수록 겹침 테스트 자체가 비싸다**(구 < AABB < k-DOP < OBB).

| BV | 타이트함 | 겹침 테스트 비용 | 회전 갱신 | 비고 |
|---|---|---|---|---|
| **Sphere** | 낮음 | 가장 쌈 (거리 비교) | 불필요(회전 불변) | 빠른 초기 reject |
| **AABB** | 중 | 쌈 (축별 구간 비교) | 회전 시 재계산 필요 | broad phase 표준 |
| **Capsule** | 중상(길쭉한 것) | 쌈(선분-선분 거리) | 회전 따라감 | 캐릭터에 인기 |
| **OBB** | 높음 | 비쌈 (SAT 15축) | 회전 같이 돎 | 타이트하지만 검사 무거움 |
| **k-DOP** | 높음(k↑) | 중(k/2 슬랩) | 회전 시 재계산 | 8/14/18/26-DOP, BVH 잎에 |

**Sphere(구)** — 중심 + 반지름. 두 구는 중심 거리² < (r₁+r₂)² 한 번이면 끝. 회전에 불변이라 갱신이 공짜. 가장 싼 1차 reject.

**AABB(axis-aligned bounding box, 축 정렬 박스)** — 세 축 모두 구간이 겹치면 충돌. 분기 거의 없는 **6 비교**로 끝나서 broad phase 가 AABB 를 쓰는 이유다. 단 객체가 회전하면 월드 축 정렬을 유지하려고 매번 재계산해야 한다(회전한 형상의 새 AABB).

**Capsule(캡슐)** — 선분 + 반지름(둥근 원기둥). 캡슐 겹침 = 두 중심선분 사이 최단거리 < r₁+r₂. 길쭉한 캐릭터를 타이트하게 감싸면서 모서리가 둥글어 걸림이 적어 **캐릭터 콜라이더로 인기**.

**OBB(oriented bounding box, 방향 박스)** — 형상과 함께 회전하는 박스. 가장 타이트한 박스지만 두 OBB 겹침은 **SAT 15축**(3 면법선 A + 3 면법선 B + 9 엣지 외적)으로 판정해야 해서 무겁다. → [03-sat](03-sat.md).

**k-DOP(discrete oriented polytope)** — AABB(=6-DOP)를 일반화. **고정된 k 개 방향의 슬랩(slab)**으로 형상을 감싼다. 방향이 미리 정해져 있어 겹침은 k/2 개 슬랩의 구간 비교로 빠르다. AABB 보다 타이트하면서 OBB 보다 검사가 싸서 **BVH 잎에 자주** 쓰인다(8/14/18/26-DOP 가 흔한 선택).

> 계층 전략: broad phase 트리의 잎은 AABB(또는 k-DOP), narrow phase 직전 1차 reject 는 sphere/AABB, 실제 형상은 narrow phase 가 맡는다. 한 BV 로 모든 걸 하려 들지 않는다.

---

**관련 함정** (전체 체크리스트는 [04-collision-detection §5](../04-collision-detection.md#5-함정--결정론-체크리스트)):
- **회전 후 AABB 부풀림**: 회전한 형상의 새 AABB 는 원래보다 크다 → broad phase 후보가 늘어난다. 자주 회전하는 객체엔 sphere/capsule 이 안정적.
- **margin 일관성**: BV 마다 충돌 margin 을 따로 두면 단계 간 경계가 어긋난다 — broad 의 fat AABB margin 과 narrow 의 surface margin 을 일관되게 관리.

**다음**: [03-sat](03-sat.md) — 볼록 형상의 겹침을 1D 투영으로 환원하는 분리축 정리. (OBB 겹침의 15축이 여기서 나온다.)
