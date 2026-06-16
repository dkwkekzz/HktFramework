# [06·2.4] Ragdoll — 본 계층을 강체+조인트로 (Ragdoll: skeleton → bodies & joints)

> 골격 애니메이션의 본(bone) 트리를 물리로 바꾸는 매핑. 본=강체, 부모-자식 연결=조인트(보통 ball-socket/swing-twist), 가동범위=조인트 한계. 질량비·깊은 사슬이 안정성의 적.
> **상위 노드**: [06-joints-articulation.md](../06-joints-articulation.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-joint-types](02-joint-types.md) · [03-limits-motors](03-limits-motors.md)

---

ragdoll 은 게임에서 조인트/관절체가 가장 눈에 띄게 쓰이는 곳이다. 매핑은 단순하다:

```
스켈레톤 본 트리           →   물리 표현
─────────────────────────────────────────
각 본 (혹은 본 묶음)       →   1 개의 강체 (캡슐/구가 보통)
부모-자식 본 연결          →   1 개의 조인트 (대개 ball-socket 또는 swing-twist)
관절 가동 범위             →   조인트 한계 (swing/twist cone)
본 길이·굵기              →   강체 형상 + 질량/관성텐서
```

**핵심 설계 항목**

- **충돌 그룹 / self-collision**: 인접 본(부모-자식)끼리는 충돌을 *끈다*. 서로 겹쳐 있으니 끄지 않으면 첫 프레임에 폭발한다. 보통 "조인트로 연결된 쌍은 충돌 무시" + 사용자 collision group/mask. 비인접 본의 자기충돌(손이 다리에 안 박히게)은 켤지 말지 비용·품질 트레이드오프.
- **swing-twist 한계**: ball-socket 에 해부학적 가동범위를 주려면 단순 cone 보다, 회전을 **swing(원뿔 방향)** 과 **twist(축 자체 회전)** 로 분해해 서로 다른 각 한계를 주는 **swing-twist 분해**가 표준이다(어깨는 swing 넓고 twist 좁음 등).
- **안정성 문제**: 본은 질량비가 극단적(골반 vs 손가락)이고 사슬이 깊다 → 반복 임펄스 솔버가 수렴 안 해 떨거나 늘어난다(→ [06 §5](../06-joints-articulation.md#5-함정--결정론-체크리스트)). 그래서 정밀 ragdoll 은 *축소 좌표(articulation)* 로 푸는 것이 점점 표준이 됐다(→ [05-maximal-vs-reduced](05-maximal-vs-reduced.md)).
- **애니메이션 블렌딩 (active ragdoll)**: 순수 ragdoll(완전 물리)과 키프레임 애니(완전 비물리) 사이를 섞는다. 조인트 모터를 **PD 드라이브**로 켜서 *애니 포즈를 목표 각으로* 추종시키면 "물리적으로 반응하지만 자세는 유지"하는 active ragdoll 이 된다(모터 메커니즘은 [03-limits-motors](03-limits-motors.md)). 상세는 [10 특화 시스템](../10-specialized-systems.md).

> 직관: ragdoll 은 새 이론이 아니라 §2.1~2.3 의 *조립*이다 — ball-socket(타입) + swing-twist 한계(limit) + 선택적 PD 모터(active). 어려움은 이론이 아니라 *수치적 안정성*에 있고, 그 답이 축소 좌표다.

---

**관련 함정** (전체 체크리스트는 [06-joints-articulation §5](../06-joints-articulation.md#5-함정--결정론-체크리스트)):
- **자기충돌 미설정**: 인접 본 충돌을 안 끄면 첫 프레임에 폭발. 조인트-연결 쌍 충돌 무시는 거의 필수.
- **무거운 부모 ↔ 가벼운 자식 질량비**: maximal 반복 솔버의 고질병. 완화책: 반복 ↑, TGS substep, 질량비 압축, 또는 **reduced 좌표 전환**(→ [05-maximal-vs-reduced](05-maximal-vs-reduced.md)).
- **swing-twist 분해의 float 민감성**: 분해·정규화 시점을 모든 머신에서 동일하게(결정론).

**다음**: [05-maximal-vs-reduced](05-maximal-vs-reduced.md) — ragdoll 의 안정성 문제가 가리키는 두 좌표 패러다임의 비교.
