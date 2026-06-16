# [01·2.8] 운동학적 바디 (Kinematic Bodies)

> 힘을 무시하고 위치를 직접 제어하되 dynamic 바디는 밀어내는 바디. 핵심은 "target pose + dt → 속도 역산".
> **상위 노드**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-point-velocity.md](03-point-velocity.md) · [06-relative-motion.md](06-relative-motion.md)

---

물리 엔진의 바디는 보통 세 종류로 나뉜다:

- **dynamic**: 힘/충돌에 반응, 동역학으로 적분([02-dynamics.md](../02-dynamics.md)·[03-time-integration.md](../03-time-integration.md)).
- **static**: 절대 안 움직임(레벨 지오메트리). 질량 ∞ 로 취급.
- **kinematic**: **힘을 무시하고 위치를 직접 제어** 하지만, dynamic 바디를 **밀어낸다**(무한 질량처럼 행동).

## 속도 역산 — kinematic 의 핵심

운동학적 바디의 핵심은: 위치는 스크립트/애니메이션/입력이 정하고, 엔진은 그 **속도를 위치 변화로부터 역산** 해서 충돌 해법에 넘긴다:

```
v_kinematic = (target_pos − current_pos) / dt
ω_kinematic = 2 · (q_target ⊗ q_current*).xyz / dt      // 작은 회전차의 각속도 근사
```

각속도 역산 식의 `2 ·` 와 `(q_target ⊗ q_current*).xyz` 는 회전 미분 `q̇ = ½ ω̂ ⊗ q` 를 거꾸로 푼 것이다 — 작은 회전차 `Δq = q_target ⊗ q_current*` 의 벡터부가 `≈ ½ ω dt` 이므로 `ω ≈ 2 Δq.xyz / dt`(유도 배경은 [04a-quaternion-derivative.md](04a-quaternion-derivative.md)). 상대 자세 `q_target ⊗ q_current*` 자체는 상대 운동([06-relative-motion.md](06-relative-motion.md))의 형태다.

이 역산 속도가 있어야 움직이는 플랫폼/문이 위에 선 dynamic 바디에 올바른 운동량을 전달한다. 텔레포트하듯 위치만 바꾸면 운동량 전달이 깨지고 끼임·관통이 생긴다. 이동 플랫폼·엘리베이터·움직이는 콜라이더가 전형적 용례다.

> **character controller** 는 운동학적 바디의 대표 응용이다 — 중력/충돌은 받되 일반 강체 동역학 대신 직접 위치 제어(슬라이딩·스텝 오프셋·캡슐 스윕)를 한다. 상세는 [10-specialized-systems.md](../10-specialized-systems.md).

---

**관련 함정** (전체 체크리스트는 [01-kinematics §5](../01-kinematics.md#5-함정--결정론-체크리스트)):
- **kinematic 위치 텔레포트**: 속도 역산 없이 위치만 바꾸면 위에 선 dynamic 바디에 운동량이 전달 안 되어 끼임/관통. 항상 target+dt 인터페이스로.
- **각속도 역산의 작은-각 가정**: `ω ≈ 2 Δq.xyz / dt` 는 한 스텝의 회전차가 작다고 가정한다 — 큰 회전 점프엔 부정확.

**다음**: 운동학을 마쳤다면 → [02-dynamics.md](../02-dynamics.md) 에서 운동학 양 `(x,q,v,ω)` 에 *원인*(힘·토크·관성)을 붙인다. 또는 허브 [01-kinematics.md](../01-kinematics.md) 로 돌아가 다른 분기로.
