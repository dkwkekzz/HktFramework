# [02.7] 에너지 (Energy — Kinetic, Potential, Work-Energy)

> 운동E(병진 `½m|v|²` + 회전 `½ωᵀIω`)와 위치E, 그리고 일–에너지 정리. 게임 물리에서 에너지의 진짜 쓸모는 "보존돼야 할 양"이라는 점이다 — 적분기가 에너지를 새로 만들거나 잃으면 그게 곧 수치 오류의 가시적 신호(에너지 드리프트)다. 본 문서는 에너지를 적분기 진단 도구로 세우고, 왜 symplectic 적분기는 드리프트가 유계인데 explicit Euler는 폭발하는지를 [../03-time-integration.md](../03-time-integration.md)로 연결한다.
> **상위 허브**: [02-dynamics.md](../02-dynamics.md) · **상위 지도**: [README.md](../README.md)

---

## 1. 왜 필요한가 — 에너지는 적분기의 거짓말 탐지기

동역학은 힘·토크에서 가속도를 뽑고([06-newton-euler.md](06-newton-euler.md)), 적분기가 그걸 시간으로 굴린다([../03-time-integration.md](../03-time-integration.md)). 문제는 이산화(discretization)가 항상 오차를 낳는다는 것 — 그 오차가 **에너지의 형태로 드러난다**. 마찰 없는 진자가 영원히 같은 높이로 흔들려야 하는데:

- explicit(전진) Euler: 점점 **빨라진다**(에너지 증가 → 발산).
- backward(후진) Euler: 점점 **죽는다**(에너지 감소 → 인공 감쇠).
- symplectic(semi-implicit) Euler: **유계로 진동**(에너지 거의 보존).

즉 **총에너지를 매 프레임 측정하면 적분기·솔버가 제대로 도는지 진단할 수 있다**. 보존계인데 에너지가 단조 증가/감소하면 버그 신호다. 이것이 에너지를 다루는 실전 이유다.

---

## 2. 운동에너지 (Kinetic Energy) — 정의

강체의 운동E는 병진과 회전의 합이다:

```
KE = KE_trans + KE_rot
KE_trans = ½·m·|v|²                  (v = CoM 속도, 스칼라 m)
KE_rot   = ½·ωᵀ·I·ω                  (I = CoM 기준 관성텐서, ω = 각속도)
```

**단위:** 줄(J) = kg·m²/s². 둘 다 양수(`I` 양정치, `m>0`).

**왜 `½ωᵀIω`인가:** 회전하는 강체의 각 질량 조각 속도는 `ω×r`, 그 운동E는 `½ρ|ω×r|²`. 전부 적분하면 정확히 `½ωᵀIω`로 정리된다 — 선형의 `½m|v|²`에서 `m→I`, `v→ω`로 바뀐 회전 짝(허브 §3 대응표). `I`가 텐서라 `ωᵀIω`라는 이차형식이 됨.

**주축 형태:** 주축 정렬이면([04a §3](04a-inertia-tensor-geometric.md)) `KE_rot = ½(I₁ω₁² + I₂ω₂² + I₃ω₃²)`. 2D에선 `½·I·ω²`(스칼라, [04a §6](04a-inertia-tensor-geometric.md)).

**값 예(굴러가는 공):** 반지름 `r`, 질량 `m`, `I=⅖mr²`(속 찬 구, [04](04-inertia-tensor.md))인 공이 미끄러짐 없이 구르면 `v=ωr`. 총 `KE = ½mv² + ½·(⅖mr²)·(v/r)² = ½mv² + ⅕mv² = 0.7·mv²`. 회전이 전체 운동E의 `⅕/0.7 ≈ 29%`를 차지한다 — 같은 속도라도 굴러 내려온 공이 미끄러져 내려온 물체보다 병진 속도가 느린(에너지가 회전에 분배된) 이유. 회전E를 빼먹고 병진만 세면 에너지 진단이 틀어진다.

**좌표 불변성:** `KE_rot`은 body든 world든 같다 — `I_world=R·I_body·Rᵀ`, `ω_world=R·ω_body`를 넣으면 `R`이 상쇄(`RᵀR=E`). 에너지는 스칼라라 좌표와 무관(드리프트 측정이 좌표에 안 휘둘리는 이유).

**에너지 vs 각운동량 — 둘 다 봐라.** 자유 회전체(`τ=0`)는 `KE_rot`과 `|L|` **둘 다** 보존돼야 한다([06 §3](06-newton-euler.md)). 그런데 `KE_rot=½ωᵀIω`와 `L=I·ω`는 다른 양이라, 적분기가 한쪽만 깨거나 둘 다 깰 수 있다. 진단에선 둘을 같이 찍는 게 강력하다:
- `KE_rot` 증가 + `|L|` 증가 → explicit 자이로 발산([06 §5](06-newton-euler.md)).
- `KE_rot`은 유지되는데 세차 궤적만 어긋남 → 위상 오차(허용 가능할 때 많음).
- 둘 다 NaN/점프 → 무효 관성·관통([05 §6](05-mass-properties.md)).
각운동량은 벡터라 방향까지 본다 — `τ=0`인데 `L` 방향이 도는 것은 가짜 토크(잘못된 `r` 기준, 허브 §5)의 신호.

---

## 3. 위치에너지 (Potential Energy)

위치E는 보존력(conservative force)이 위치에 저장한 에너지다. 게임에서 흔한 둘:

```
중력:    PE_grav = m·g·h          (h = 기준면 위 CoM 높이, g≈9.81)
스프링:  PE_spring = ½·k·x²        (x = 자연길이로부터 변위, k = 강성)
```

보존력은 PE의 음의 기울기다: `F = −∇PE`. 중력 `F = −mg·ẑ` (아래로), 스프링 `F = −k·x` (Hooke). 보존력만 PE를 가진다 — **마찰·항력은 비보존(소산)**이라 PE가 없고 에너지를 열로 버린다.

**총역학에너지:** `E = KE + PE`. 보존계(외력이 보존력뿐, 마찰 없음)에선 `E = const`. 이 보존이 §1의 진단 기준선이다.

---

## 4. 일–에너지 정리 (Work-Energy Theorem)

힘이 한 일(work)은 운동E 변화와 같다:

```
W = ∫ F·dr = ΔKE_trans          (병진)
W_τ = ∫ τ·dθ = ΔKE_rot          (회전, 토크가 한 일)
```

**유도(병진):** `F = m·dv/dt`, `W = ∫F·dr = ∫ m(dv/dt)·v dt = ∫ m·d(½|v|²) = Δ(½m|v|²)`. 회전도 `τ = I·dω/dt`(+ 자이로)로 같은 꼴.

**보존력의 일 = −ΔPE.** 보존력이 한 일은 PE 감소량과 같다(`W_cons = −ΔPE`). 그래서:

```
ΔKE = W_total = W_cons + W_noncons = −ΔPE + W_friction
⟹  Δ(KE+PE) = W_friction ≤ 0
```

마찰 없으면 `Δ(KE+PE)=0` — 총에너지 보존. 마찰 있으면 `W_friction<0`만큼 단조 감소. **이것이 진단의 핵심 부등식**: 보존계인데 `KE+PE`가 증가하면 적분기가 에너지를 *만들고* 있는 것이다(버그).

**자이로 항과 에너지:** 자이로 항 `ω×(I·ω)`은 `ω`에 수직이라 일을 하지 않는다(`ω·(ω×Iω)=0`) — 이론상 `KE_rot` 불변. 그런데 explicit 적분은 이 무일(無功) 항을 무력하게 다뤄 에너지를 주입하고 발산시킨다([06 §5](06-newton-euler.md)). 자이로 발산은 곧 `KE_rot` 단조 증가로 드러난다.

---

## 5. 에너지 드리프트를 진단 신호로 — 알고리즘

매 프레임 총에너지를 찍어 적분기·솔버 건강을 본다:

```
measure_energy(bodies):
    E = 0
    for b in bodies:
        E += ½·b.m·dot(b.v, b.v)              # KE_trans
        E += ½·dot(b.ω, b.I_world · b.ω)       # KE_rot
        E += b.m·g·b.com.z                     # PE_grav
        E += Σ ½·k·x²  over springs            # PE_spring
    return E

# 진단:
#  보존 시나리오(마찰 0)에서 E(t) 관찰
#   - E 단조 증가      → explicit 발산 / 자이로 explicit / 강성 스프링 외력
#   - E 단조 감소      → backward Euler 인공 감쇠 / 과한 솔버 감쇠
#   - E 유계 진동      → symplectic 정상 (목표)
#   - E 점프/NaN       → 무효 관성([05 §6]) / 0 질량 나눗셈 / 관통
```

**테스트 시나리오:** 마찰 0 진자, 자유 회전 비대칭 강체(`τ=0`, [06 §3](06-newton-euler.md)의 세차), 궤도 운동. 이들은 해석적으로 에너지 보존이라 드리프트가 순수 수치 오차다.

**값으로 보는 차이(스프링-질량 예).** `m=1`, `k=1`, 초기 `x=1, v=0`이면 참 에너지 `E=½kx²=0.5`로 영원히 일정해야 한다. 같은 `dt=0.1`로 1000스텝 돌리면:
- explicit Euler: `E`가 매 진동마다 조금씩 커져 수십 배로 발산(스프링이 점점 세게 튕긴다).
- backward Euler: `E`가 단조 감소해 진동이 잦아들어 멈춘다(인공 감쇠).
- semi-implicit Euler: `E`가 `0.5` 근처에서 작은 폭으로 진동만 하고 **추세 없음** — 위치 위상은 약간 어긋나도 에너지는 유계.

세 적분기 모두 같은 힘·같은 dt인데 장기 거동이 갈린다는 점이 핵심이다. 위상(phase) 정확도가 아니라 **에너지 추세**가 적분기 등급을 가른다.

**주의:** symplectic 적분기도 에너지가 *정확히* 일정하진 않다 — 참 에너지 근처를 **유계로 진동**한다(shadow Hamiltonian 보존, §6). 그래서 "완벽한 상수"가 아니라 "유계·비드리프트"가 합격 기준. 장기적 단조 추세가 있으면 문제.

---

## 6. symplectic vs explicit — 에너지로 본 차이

적분기마다 에너지 거동이 갈리는 이유는 [../03-time-integration.md](../03-time-integration.md)의 심플렉틱 분기에서 깊게 다루지만, 에너지 관점의 요약:

| 적분기 | 에너지 거동 | 게임에서 |
|---|---|---|
| **explicit(forward) Euler** | 단조 증가 → 발산 | 금지(강성·자이로에서 폭발) |
| **backward(implicit) Euler** | 단조 감소 → 인공 감쇠 | 안정하나 에너지 잃음(cloth 등 감쇠 OK일 때) |
| **symplectic(semi-implicit) Euler** | 유계 진동(드리프트 없음) | 게임 표준 — 싸고 안정·장기 에너지 보존 |
| **Verlet** | 심플렉틱류, 유계 | PBD·입자에 궁합 |
| **RK4** | 고차 정확하나 비-심플렉틱(느린 드리프트) | 매끄러운 힘장 전용 |

**왜 symplectic이 보존하나(직관):** symplectic 적분기는 위상공간(phase space)의 면적(심플렉틱 형식)을 보존한다. 그 결과 참 Hamiltonian이 아니라 그것에 매우 가까운 **shadow Hamiltonian**을 정확히 보존하며, 그래서 참 에너지가 일정 범위 안에서만 진동하고 **장기 드리프트가 없다**. explicit Euler는 이 면적 보존을 깨서 매 스텝 에너지를 새는/만드는 방향으로 누적시킨다([../03-time-integration.md](../03-time-integration.md)의 심플렉틱·에너지 분기에 면적 보존·shadow Hamiltonian 상세).

게임이 semi-implicit Euler를 사실상 표준으로 쓰는 이유가 이 에너지 거동이다 — explicit만큼 싸면서 장기 안정.

---

## 6a. 한 프레임에서 에너지가 새는 지점들

전체 시뮬은 적분만이 아니라 충돌·구속까지 거치므로, 에너지는 여러 단계에서 들고 난다. 진단할 때 어디서 새는지 부위를 좁히려면 단계별로 봐야 한다(파이프라인은 허브 §1, [../03-time-integration.md](../03-time-integration.md)):

```
프레임 파이프라인        에너지 영향
─────────────────────────────────────────────
힘 적용(중력·스프링)     보존력은 PE↔KE 교환만(보존). 강성 explicit이면 주입(폭발)
적분(integrate)          적분기 등급대로(§6) — explicit 주입 / symplectic 유계
충돌 감지·관통 해소       관통을 위치로 밀어내면(positional push) 에너지 주입 가능
restitution(반발)        e<1이면 충돌마다 KE 일부 소산(의도된 비탄성)
friction(마찰)           접선 KE를 소산(의도). 과하면 미끄러짐이 끈적해짐
구속 솔버 반복(PGS)       baumgarte·slop이 소량 에너지 주입/소산(안정화 대가)
sleeping(저속 정지)       임계 KE 미만이면 강제 0 — 미세 에너지 버림(의도)
```

**진단 전략:** 단계마다 직전/직후 에너지를 찍으면 범인이 좁혀진다. 보존 시나리오에서 "적분 직후" 증가면 적분기 문제, "충돌 직후" 점프면 관통 해소/restitution 설정, "솔버 직후" 드리프트면 baumgarte·반복 수 문제. 의도된 소산(restitution e<1, friction)과 버그성 주입을 이렇게 구분한다.

---

## 7. 실무

- **에너지 모니터를 켜라:** 디버그 빌드에서 총에너지 HUD/로그는 적분기·솔버 회귀를 잡는 값싼 보험(§5). 보존 시나리오에서 단조 추세 = 버그.
- **강성 스프링·항력을 explicit 외력으로 넣지 마라:** 큰 `k`/`b`는 explicit에서 에너지를 폭발시킨다(허브 §5). implicit([../03-time-integration.md](../03-time-integration.md)) 또는 구속([../05-constraint-solving.md](../05-constraint-solving.md))으로 옮긴다.
- **솔버 감쇠 ≠ 물리 마찰:** 구속 솔버의 인공 감쇠(baumgarte·restitution slop)는 에너지를 빼서 안정화한다. 의도된 소산과 버그성 소산을 에너지로 구분.
- **자이로 발산은 KE_rot로 보인다:** 자이로 항 켜고 explicit이면 `KE_rot`가 치솟는다([06 §5](06-newton-euler.md)). implicit으로 옮기거나 끈다.
- **결정론:** 에너지 측정은 진단용일 뿐, 시뮬 경로에 피드백 걸지 마라(측정값으로 보정하면 부동소수 비결정성이 시뮬에 샌다, [../12-determinism-networking.md](../12-determinism-networking.md)).
- **회전E를 빼먹지 마라:** 구르는/회전하는 물체의 진단에서 `½ωᵀIω`를 누락하면 총에너지가 틀리게 측정돼 멀쩡한 시뮬을 버그로 오진한다(§2의 굴러가는 공 예).
- **단계별 측정:** 적분·충돌·솔버 직후를 나눠 찍어 누수 부위를 좁힌다(§6a). 한 점만 보면 의도된 소산과 버그를 못 가린다.

---

## 더 읽기 / 관련 노드

- **선행·자매** — [06-newton-euler.md](06-newton-euler.md): 자이로 항의 무일(無功)성과 explicit 발산. [04a-inertia-tensor-geometric.md](04a-inertia-tensor-geometric.md): `½ωᵀIω`의 텐서 이차형식, 좌표 불변. [01-newton-laws.md](01-newton-laws.md): 보존력·스프링·항력.
- **직접 후속** — [08-lagrangian.md](08-lagrangian.md): `L = KE − PE`로 운동방정식을 에너지에서 직접 유도, Hamiltonian `H = KE+PE`로의 다리.
- **적분(핵심 연결)** — [../03-time-integration.md](../03-time-integration.md): 에너지 드리프트·symplectic·shadow Hamiltonian·면적 보존의 본가. explicit↔implicit·Verlet·RK.
- **횡단** — [../12-determinism-networking.md](../12-determinism-networking.md): 측정값 피드백 금지. [../05-constraint-solving.md](../05-constraint-solving.md): 솔버 감쇠의 에너지 영향.

> 한 줄 정리: 운동E(`½m|v|²` + `½ωᵀIω`)와 위치E(`mgh`, `½kx²`)의 합은 보존계에서 일정해야 하며, 그 보존을 매 프레임 측정하면 적분기·솔버의 거짓말(에너지 생성/소실)을 잡는 진단 신호가 된다 — explicit Euler는 폭발, symplectic은 유계 진동, 그 차이가 게임이 semi-implicit을 표준으로 쓰는 이유다.
