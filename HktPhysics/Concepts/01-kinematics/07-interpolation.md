# [01·2.7] 보간 — lerp · nlerp · slerp 와 렌더 보간 (Interpolation)

> 위치·자세를 두 상태 사이에서 매끄럽게 잇는 보간(lerp/nlerp/slerp), 그리고 고정 timestep 물리와 가변 프레임레이트 렌더를 잇는 render interpolation.
> **상위 노드**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) (사원수·SLERP·NLERP)

---

## 자세 표현의 선택 (representation trade-off)

보간 방식은 자세를 무엇으로 저장하느냐에 묶인다. 운동학에서 쓰는 네 표현의 비교:

| 표현 | 성분 | 장점 | 단점 | 실무 용도 |
|---|---|---|---|---|
| 오일러 각 (Euler) | 3 | 직관적, 작음 | **짐벌락**, 보간 나쁨, 순서 모호 | UI 입력·DCC 노출만 |
| 축–각 (axis–angle) | 4(3+1) | ω 와 직결, 적분 친화 | 합성 불편 | 회전 델타·imgui |
| 회전행렬 (rotation matrix) | 9 | 점 변환 즉시 | 메모리·재정규화 비용 | 캐시된 변환·GPU |
| **사원수 (quaternion)** | 4 | 짐벌락無, slerp, 합성·정규화 싸다 | 직관성↓, 이중덮개 | **강체 자세 저장 표준** |

> 이중덮개(double cover): `q` 와 `−q` 는 **같은 회전**. slerp·비교 시 부호를 맞춰야(dot<0 이면 한쪽 반전) 최단경로로 간다. (근본 유도는 [00-foundations.md](../00-foundations.md) 의 사원수 심화.)

## 위치: 선형 보간 (lerp)

```
lerp(a, b, t) = a + t·(b − a) = (1−t)·a + t·b      ( t ∈ [0,1] )
```

## 회전: slerp / nlerp

사원수 회전 보간은 단순 lerp 하면 등속도가 깨지고 노름이 1을 벗어난다. 둘 중 하나를 쓴다:

```
nlerp(q0,q1,t) = normalize( lerp(q0,q1,t) )        싸다, 비등속(거의 무시 가능), 최단경로 보장 위해 dot<0 시 q1←−q1
slerp(q0,q1,t):                                     등속(constant angular velocity), 비싸다
    Ω = acos(q0·q1)                                 (dot<0 이면 q1 ← −q1 후 진행)
    slerp = ( sin((1−t)Ω)/sinΩ )·q0 + ( sin(tΩ)/sinΩ )·q1
    Ω→0 이면 lerp 로 폴백 (0/0 회피)
```

대부분의 게임은 인접 프레임 회전차가 작아 **nlerp 로 충분**하고 더 빠르다. slerp 는 큰 각 보간(애니메이션 키프레임 간)에서 가치가 있다. (SLERP 가 초구 위 측지선이고 NLERP 가 현을 따라가는 근사라는 기하학적 이유는 [00-foundations.md](../00-foundations.md) 의 사원수 심화.)

## 렌더 보간 (render interpolation) — 고정 timestep 과의 결합

물리는 **고정 timestep**(예: 60 Hz)으로 돌리고 렌더는 가변 프레임레이트로 도는 것이 결정론과 안정성의 표준 패턴이다([03-time-integration.md](../03-time-integration.md)·[12-determinism-networking.md](../12-determinism-networking.md)). 그 사이의 "남는 시간"을 보간으로 메운다:

```
accumulator += frameTime
while (accumulator >= dt) { physicsStep(dt); swap(prev,cur); accumulator −= dt; }
alpha = accumulator / dt                                  // 0..1, 다음 스텝까지의 비율
renderPos  = lerp(prevPos,  curPos,  alpha)
renderRot  = slerp(prevRot, curRot,  alpha)               // 또는 nlerp
```

이렇게 하면 물리 주기와 렌더 주기가 어긋나도 화면이 부드럽다. (외삽 extrapolation 도 가능하나 충돌 시 튀므로 보간이 안전.) **이 루프의 전체 논의는 [03-time-integration.md](../03-time-integration.md)** 에 있다.

---

**관련 함정** (전체 체크리스트는 [01-kinematics §5](../01-kinematics.md#5-함정--결정론-체크리스트)):
- **이중덮개 부호**: slerp/nlerp/비교 전에 `dot(q0,q1)<0` 이면 한쪽을 반전. 안 하면 "긴 길(>180°)" 로 돌아 빙글 돈다.
- **slerp 0/0**: `Ω≈0`(거의 같은 회전)이면 `sinΩ→0` → lerp/nlerp 폴백.
- **`acos` 클램프**: `Ω = acos(q0·q1)` 에서 내적이 반올림으로 `>1` 이면 NaN → `clamp(·,−1,1)`([00-foundations.md](../00-foundations.md)).
- **보간은 표시용, 시뮬은 시뮬용**: render interpolation 결과(`alpha` 보간 pose)를 시뮬레이션 상태로 되먹이지 말 것 — 결정론이 깨진다([12-determinism-networking.md](../12-determinism-networking.md)).

**다음**: [08-kinematic-bodies.md](08-kinematic-bodies.md) — 힘을 무시하고 위치를 직접 제어하는 운동학적 바디.
