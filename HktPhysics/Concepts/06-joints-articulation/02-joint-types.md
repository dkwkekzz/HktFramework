# [06·2.2] 조인트 타입별 구속식과 DOF (Joint types: hinge, ball, prismatic, fixed, distance …)

> 강체쌍의 상대 운동은 6-DOF(병진 3 + 회전 3). 각 조인트는 그중 일부를 0 으로 묶고 나머지를 남긴다 — "막는 DOF 수 = Jacobian 행 수".
> **상위 노드**: [06-joints-articulation.md](../06-joints-articulation.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-joint-as-jacobian](01-joint-as-jacobian.md)

---

각 조인트를 **"막는 DOF(constrained)" 와 "남는 DOF(free)"** 로 본다. 둘의 합은 항상 6(상대 6-DOF)이다.

| 조인트 | 남는 DOF | 막는 DOF | 구속식 C | 용도 |
|---|---|---|---|---|
| **Distance** | 5 | 1 | `‖p_b − p_a‖ − L = 0` | 로프(고정 길이), 막대 |
| **Ball-socket / Point-to-point (spherical)** | 3 (회전) | 3 (병진) | `p_a + R_a r_a − (p_b + R_b r_b) = 0` | 어깨·고관절, ragdoll 관절 |
| **Hinge / Revolute** | 1 (한 축 회전) | 5 | point-to-point(3) + 두 perpendicular 축 정렬(2) | 팔꿈치·무릎, 문, 바퀴 축 |
| **Prismatic / Slider** | 1 (한 축 병진) | 5 | 축 직교 병진(2) + 회전 전부(3) | 서스펜션 스트럿, 피스톤, 엘리베이터 |
| **Universal (Hooke)** | 2 (직교 두 축 회전) | 4 | point-to-point(3) + 한 축 정렬(1) | 드라이브 샤프트, 손목 |
| **Cylindrical** | 2 (한 축 회전+병진) | 4 | 축 직교 병진(2) + 축 직교 회전(2) | 나사 없는 축 |
| **Fixed / Weld** | 0 | 6 | 상대 위치(3) + 상대 회전(3) 고정 | 본 융합, 파편 접착, compound |
| **Planar** | 3 (평면 2병진+1회전) | 3 | 평면 법선 병진(1) + 면내 회전 외 2축(2) | 평면 위 슬라이딩 |

> **읽는 법**: 막는 DOF 수 = J 의 행 수. 예) hinge 는 `6−1=5` 행짜리 Jacobian(point-to-point 3 행 + 회전 정렬 2 행). fixed 는 6 행, distance 는 1 행.

**가장 헷갈리는 부분 — Hinge 의 회전 정렬 구속**

hinge(경첩)는 두 바디가 *한 축*으로만 상대 회전해야 한다. 즉 두 바디의 hinge 축이 항상 한 직선 위에 있어야 한다. 이걸 어떻게 등식으로 쓰나? 축 a 에 직교하는 두 벡터 `t1, t2` 와의 내적이 0 이어야 한다는 조건으로 쓴다:

```
// a_a = 바디A 의 hinge 축(월드),  a_b = 바디B 의 hinge 축(월드)
// t1, t2 = a_a 에 직교하는 두 단위벡터
C_rot = [ t1 · a_b ,  t2 · a_b ] = [0, 0]    // a_b 가 a_a 와 평행 → 두 직교성분 0
```

회전 자유도를 "막는" 구속을 **두 직교 성분의 0** 으로 표현하는 것이 3D 조인트의 핵심 트릭이다. 세 번째 성분(축 자체를 따라 도는 회전)은 일부러 남겨 둔다 — 그게 hinge 가 허용하는 단 하나의 회전 DOF 다.

이 트릭을 일반화하면 표의 다른 타입들이 따라 나온다:
- **Universal** 은 직교 두 축 회전을 남기므로 회전 정렬을 *한 축*(1 행)만 건다.
- **Prismatic** 은 축 방향 병진만 남기므로 회전 3 + 직교 병진 2 = 5 행을 막는다.
- **Fixed** 는 아무것도 안 남기므로 ball-socket(병진 3) + 회전 정렬(3) = 6 행.

> 직관: "남기고 싶은 DOF 의 방향에는 Jacobian 행을 두지 않고, 막고 싶은 방향마다 행을 하나씩 둔다." 조인트 설계 = 6 방향 중 어디에 행을 꽂을지 고르는 일.

각 행의 구체적 Jacobian 성분 작성법(`[r]×` 사용 등)은 → [01-joint-as-jacobian](01-joint-as-jacobian.md) 의 Distance/Ball-socket 최소 예제 참조.

---

**관련 함정** (전체 체크리스트는 [06-joints-articulation §5](../06-joints-articulation.md#5-함정--결정론-체크리스트)):
- **축 정렬 구속의 `t1, t2` 선택**: a 에 직교하는 두 벡터를 매 프레임 *일관되게* 골라야(이전 프레임과 급변 금지) Jacobian 이 튀지 않는다.
- **DOF 합 ≠ 6 실수**: 막는 + 남는 = 6 이 안 맞으면 조인트가 과/부족 구속 → 떨림 또는 늘어짐.

**다음**: [03-limits-motors](03-limits-motors.md) — 남은 DOF 에 한계·모터·스프링을 얹기.
