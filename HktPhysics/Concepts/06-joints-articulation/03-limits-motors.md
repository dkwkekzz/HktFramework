# [06·2.3] 한계 · 모터 · 드라이브 (Limits, motors, drives)

> 조인트가 *남긴* DOF 에 추가로 거는 제약 — 한계(부등식 벽), 모터(목표 속도/위치를 향한 능동 임펄스), 스프링/감쇠(PD·soft). 등식 위에 얹는 한 층.
> **상위 노드**: [06-joints-articulation.md](../06-joints-articulation.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-joint-as-jacobian](01-joint-as-jacobian.md)

---

[02-joint-types](02-joint-types.md) 의 조인트는 어떤 DOF 를 *막고* 어떤 DOF 를 *남기는지* 정한다. 한계·모터·드라이브는 그 **남긴 DOF** 위에 다시 거는 제약이다.

**조인트 한계(joint limit) — 부등식 구속, "회전판에 박힌 두 벽"**

hinge 각 θ 를 `[θ_min, θ_max]` 안에 가둔다. 한계에 *닿았을 때만* 활성화된다:

```
if   θ < θ_min:   C = θ - θ_min ,   λ ≥ 0      // 아래쪽 벽: 밀어올리는 임펄스만
elif θ > θ_max:   C = θ - θ_max ,   λ ≤ 0      // 위쪽 벽: 눌러내리는 임펄스만
else:             비활성 (접촉처럼 켰다 껐다)
```

→ 사실상 **접촉(부등식)** 과 똑같이 푼다. λ 가 한쪽 부호로만 clamp 되는 것이 등식 조인트와의 차이. 한계는 "허용 각도 범위의 양 끝에 세운 두 개의 벽"이다.

**모터(motor) — 목표를 향한 능동 임펄스, 단 토크 상한**

모터는 남은 DOF 를 *능동적으로* 움직인다. 핵심은 무한히 세게 밀지 않고 `|λ| ≤ τ_max·Δt`(최대 토크/힘) 로 box-clamp 하는 것:

```
# 속도 모터: 상대 각속도를 ω_target 으로
C_dot_target = ω_target
λ = K⁻¹ ( ω_target - J v )
λ = clamp(λ, -τ_max·Δt, +τ_max·Δt)    // 최대 토크 한계 → λ box-clamp

# 위치/스프링 드라이브 (PD): 목표 각 θ_target
τ = k_p (θ_target - θ)  -  k_d θ̇       // stiffness k_p, damping k_d
```

**스프링/감쇠 드라이브** 는 위 PD 토크를 직접 적용하거나, soft-constraint(05 의 `γ, β` 또는 XPBD 의 compliance `α`)로 표현한다. soft 표현이 큰 stiffness 에서 *명시적 PD 보다 안정* 하다 — `k_p` 를 키워도 발산하지 않는다(implicit 적분 효과). 명시적 PD 는 `Δt·k_p` 가 안정 한계를 넘으면 진동·폭발한다.

> **TGS soft / XPBD 통합**: 현대 솔버는 limit·motor·drive 를 전부 "compliance 와 damping 을 가진 soft 등식/부등식 구속"으로 일원화한다. 강성 `= 1/α` 로 연속 조절되어, hard 조인트(α→0)부터 물렁한 스프링(α 큼)까지 *한 코드 경로* 로 처리한다. limit 도 한쪽-clamp 된 soft 구속일 뿐이다.

직관으로 세 층을 정리하면:
- **조인트**(등식) = 막을 DOF.
- **한계**(부등식) = 남긴 DOF 의 *끝에 세운 벽*.
- **모터/드라이브**(목표) = 남긴 DOF 를 *원하는 곳으로* 미는 힘, 토크 상한 안에서.

ragdoll 의 "물리적으로 반응하되 자세는 유지"(active ragdoll)는 바로 이 모터 드라이브로 애니 포즈를 목표 각 삼아 추종시켜 만든다 → [04-ragdoll](04-ragdoll.md).

---

**관련 함정** (전체 체크리스트는 [06-joints-articulation §5](../06-joints-articulation.md#5-함정--결정론-체크리스트)):
- **조인트 한계 = 부등식**: 등식 조인트와 달리 limit 은 접촉처럼 λ clamp 필요. clamp 누락 시 한계가 양방향으로 끌어당겨 본이 한계각에 "달라붙는다".
- **soft drive 발산**: 명시적 PD 모터는 `k_p` 가 크면 발산(`Δt·k_p` 가 안정 한계 초과). soft constraint/implicit 표현으로 회피.

**다음**: [04-ragdoll](04-ragdoll.md) — 본 계층을 강체+조인트로 바꾸는 매핑.
