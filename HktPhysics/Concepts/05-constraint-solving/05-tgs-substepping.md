# [05·2.5] TGS · substepping (Temporal Gauss–Seidel)

> 전통 SI는 한 큰 스텝의 *속도* 만 반복해 풀고 위치는 마지막에 한 번 적분 → 큰 회전/빠른 물체에서 부정확. **TGS**는 스텝을 `N`개 substep으로 쪼개고 substep마다 위치를 즉시 갱신해 *시간 축으로도* Gauss–Seidel을 돌린다 — 현대 주류(Box2D v3, PhysX).
> **상위 노드**: [05-constraint-solving.md](../05-constraint-solving.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-sequential-impulse](03-sequential-impulse.md) (속도 풀이) · [03-time-integration](../03-time-integration.md) (substep·timestep)

---

## 문제 — 한 큰 스텝의 속도만 풀면

전통 SI는 한 timestep `h` 동안:
1. 속도를 여러 번 반복해 구속을 만족시키고,
2. 위치는 **마지막에 한 번** `h` 만큼 적분한다.

문제: 속도를 푸는 동안 `J`(법선·팔 길이 `r`)는 *스텝 시작 위치* 기준으로 고정돼 있다. 큰 회전이나 빠른 이동이 한 스텝에 일어나면, 스텝 끝의 실제 기하와 처음 잡은 `J` 가 어긋나 부정확해진다(긴 막대가 빠르게 도는 경우 특히).

## TGS — 시간을 쪼개고 substep마다 위치 갱신

**TGS(Temporal Gauss–Seidel)** 는 스텝을 `N`개 **substep** 으로 쪼개고, 각 substep마다 (a) 소수 반복으로 속도를 풀고 (b) **위치를 즉시 갱신**한 뒤 (c) `J`/팔 길이를 다시 계산한다. [03a-pgs-convergence](03a-pgs-convergence.md)가 *공간상* 구속 순서로 Gauss–Seidel을 돌렸다면, TGS는 *시간 축* 으로도 "방금 갱신한 위치를 즉시 다음 substep에 쓴다" — 그래서 Temporal Gauss–Seidel이다.

```
for substep in 1..N:                  # h_sub = h / N
    적분(속도 예측, h_sub)
    for it in 1..iters_per_substep:   # 보통 1~2
        구속 속도 풀이(soft, bias 포함)
    위치 적분(h_sub) + Jacobian/제약 갱신
    relax pass(restitution 없이 한 번 더)  # 잔류 에너지 정리
```

**왜 더 강성한가**: substep마다 위반이 작아진다(`h_sub = h/N` 만큼만 진행) → [03a-pgs-convergence](03a-pgs-convergence.md) §3의 "위반이 작으면 적은 반복으로 따라잡는다" 가 적용. 총 반복 수가 같아도 시간을 잘게 쪼개면 PGS의 저주파 수렴 한계를 크게 완화한다. **위치를 substep마다 갱신**하므로 빠른 회전에도 `J` 가 따라간다.

**soft constraint와 결합**: TGS는 보통 Catto의 soft constraint([01-contact-model](01-contact-model.md)의 CFM/ERP 재매개화)와 함께 쓴다 — **TGS soft**. soft가 Baumgarte의 에너지 추가를 억제하고, substep이 강성을 끌어올린다.

**relax pass**: substep 끝에 restitution을 끈 채 한 번 더 풀어 substepping이 남긴 잔류 에너지를 정리한다.

## 효과와 비용

- 더 적은 *총* 반복으로 더 강성한 스택, 빠른 회전에 강함.
- Box2D v3는 **TGS soft**(Catto soft constraint + substepping), PhysX는 **TGS solver** 가 기본.
- substep은 timestep을 잘게 쪼개므로 [03]/[12] 결정론에 직접 영향: **substep 수 `N` 은 시뮬 상수** 다. 런타임에 흔들면 거동·재현이 깨진다.

---

**관련 함정** (전체 체크리스트는 [05-constraint-solving §5](../05-constraint-solving.md#5-함정--결정론-체크리스트)):
- **TGS substep 수 = 결정론 인자**: substep/반복 카운트는 시뮬 상수. CVar로 노출하더라도 결정론 경로에선 고정값으로 잠근다([12]).
- **위치 갱신 후 `J` 미갱신**: substep마다 팔 길이·법선을 다시 계산 안 하면 TGS의 이점(빠른 회전 정확도)이 사라진다.
- **relax pass 누락**: 잔류 에너지가 쌓여 미세 가열/지터.

**다음**: [06-position-based](06-position-based.md) — 임펄스를 아예 건너뛰고 위치를 직접 투영하는 PBD/XPBD.
