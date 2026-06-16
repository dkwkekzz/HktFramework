# [06·2.1] 조인트 = Jacobian 한 줄(들) (Joints as Jacobian rows)

> 조인트의 본질은 "두 강체의 상대 6-DOF 중 일부를 0 으로 묶는 등식 구속". 그 묶음을 한 줄(또는 여러 줄)의 Jacobian 으로 쓰고, 05 의 임펄스 솔버에 그대로 넘긴다.
> **상위 노드**: [06-joints-articulation.md](../06-joints-articulation.md) · **상위 지도**: [README.md](../README.md) · **의존**: [05-constraint-solving.md](../05-constraint-solving.md)

---

[05 구속 해법](../05-constraint-solving.md) 은 두 종류의 구속을 푼다 — **접촉(contact, 부등식)** 과 **조인트(joint, 등식)**. 이 문서는 조인트가 어떻게 05 의 Jacobian/임펄스 기계에 *그대로* 올라타는지를 보인다.

**조인트의 본질**: "두 강체의 상대 운동 중 일부 자유도(DOF)를 0 으로 고정한다". 접촉이 "파고들지 마라"(한쪽 방향만 막는 부등식)인 데 비해, 조인트는 "이 점은 항상 붙어 있어라 / 이 축으로만 돌아라"(양방향으로 막는 등식)이다.

**등식 ↔ 부등식의 유일한 구조적 차이**: 조인트의 라그랑주 승수 λ 는 **부호 제한이 없다**(접촉의 λ_n ≥ 0 과 대비). 한계(limit)와 모터(motor)는 이 등식 위에 *부등식/목표*를 추가로 얹는 것이다(→ [03-limits-motors](03-limits-motors.md)).

**위치 구속 → 속도 구속 → Jacobian**

[05](../05-constraint-solving.md) 에서 본 등식 구속의 일반형이다. 위치 수준 구속 `C(x) = 0` 을 시간 미분하면 속도 수준 구속이 나오고, 그 계수가 Jacobian 이다:

```
C(x) = 0                      // 위치 제약 (등식)
Ċ = J v = 0                   // 속도 제약 — J 가 조인트의 Jacobian
J = ∂C/∂x                     // 행: 막는 DOF 수,  열: 관련 강체들의 6-DOF (v,ω)
```

조인트가 막는 DOF 가 `m` 개면 J 는 `m×12` 행렬(두 강체 각 6-DOF: 병진 3 + 회전 3). 솔버 한 반복의 골격:

```
effective mass  K = J M⁻¹ Jᵀ            // m×m 효과 질량
bias           b = (β/Δt) C  +  γ Ċ      // Baumgarte/soft 보정 (05 참조)
solve          K λ = -(J v + b)
apply          v += M⁻¹ Jᵀ λ
```

여기서 `M⁻¹` 은 두 강체의 역질량/역관성을 모은 블록 대각행렬, `λ` 는 구속 임펄스다. 접촉과 *완전히 같은 코드 경로*를 쓰되, 마지막에 λ 를 clamp 하지 않는 것만 다르다.

**가장 작은 두 예제 — Distance 와 Ball-socket**

조인트 Jacobian 이 실제로 어떻게 생겼는지는 두 개의 최소 예제로 손에 잡힌다.

```
# Distance (1-DOF 막음): 두 anchor 사이 거리 L 유지
d   = p_b - p_a
n   = d / ‖d‖
C   = ‖d‖ - L
J   = [ -nᵀ, -(r_a × n)ᵀ,  nᵀ, (r_b × n)ᵀ ]     // 1×12

# Ball-socket (3-DOF 막음): 두 anchor 가 한 점
C   = (p_b + r_b) - (p_a + r_a)                  // 3-벡터
J   = [ -I, [r_a]×, I, -[r_b]× ]                 // 3×12, [·]× = skew(외적 행렬)
```

`[r]×` 는 외적을 행렬로 표현한 **skew-symmetric 행렬**(`[r]× v = r × v`)이며, 회전이 anchor 점 속도에 주는 기여(`ω × r`)를 J 에 싣는 표준 방식이다. `r_a`, `r_b` 는 각 강체 질량중심에서 anchor 까지의 벡터(월드).

> 직관: Jacobian 한 행은 "이 강체쌍이 어떻게 움직이면 구속을 위반하는가"의 방향이다. 솔버는 그 방향 속도 성분을 임펄스로 정확히 상쇄한다. 막는 DOF 가 많을수록(fixed=6) 행이 늘 뿐, 기계는 동일하다.

각 조인트 타입이 구체적으로 몇 행을, 어떤 식으로 막는지는 → [02-joint-types](02-joint-types.md).

---

**관련 함정** (전체 체크리스트는 [06-joints-articulation §5](../06-joints-articulation.md#5-함정--결정론-체크리스트)):
- **등식엔 clamp 금지**: 조인트 λ 는 부호 자유. 접촉 코드를 재사용하다 무심코 `λ ≥ 0` clamp 를 남기면 조인트가 한쪽으로만 작동해 늘어진다.
- **anchor 르버 암 `r` 의 좌표계**: `[r]×` 에 넣는 `r` 은 *월드* 회전이 적용된 현재 르버 암이어야 한다. 로컬 그대로 쓰면 회전한 바디에서 토크가 틀어진다.

**다음**: [02-joint-types](02-joint-types.md) — hinge·prismatic·universal·fixed… 타입별 구속식과 DOF.
