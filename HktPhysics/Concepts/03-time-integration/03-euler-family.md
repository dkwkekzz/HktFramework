# [03·2.3] Euler 삼형제 — Forward · Symplectic · Backward

> 같은 두 줄짜리 적분기인데 순서와 시점만 바꾸면 폭발(forward)·게임 표준(symplectic)·무조건 안정(backward)로 갈린다.
> **상위 노드**: [03-time-integration.md](../03-time-integration.md) · **상위 지도**: [README.md](../README.md) · **의존**: [02-taxonomy](02-taxonomy.md)

---

Euler 적분기는 가장 단순한 single-step 적분기이고, 세 변형이 explicit↔implicit 스펙트럼의 양 끝과 게임 표준을 모두 차지한다. 세 변형의 코드 차이는 **한 줄**이지만 거동은 완전히 다르다.

## (a) Explicit (Forward) Euler — 쓰면 안 되는 기준선

현재 도함수를 그대로 dt 만큼 외삽한다.

```
v_{n+1} = v_n + a_n · dt          (a_n = F(x_n, v_n)/m)
x_{n+1} = x_n + v_n · dt          ← 옛 속도 v_n 을 사용!
```

직관은 단순하지만 강체 물리에서는 **금기**에 가깝다. 보존계(등속 원운동/조화진동)에서 forward Euler 는 매 스텝 *접선 방향으로 바깥쪽으로* 외삽해, 궤적이 나선형으로 *바깥으로* 퍼진다. 무중력 스프링(`a = −k x`)에 적용하면:

```
선형계 [x;v]_{n+1} = A [x;v]_n  의 증폭행렬 A 의 고윳값 크기
|λ| = sqrt(1 + (k/m)dt²) > 1
→ 매 스텝 진폭이 (1 + O(dt²)) 배 커진다 → 에너지가 단조 증가 → 폭발.
```

즉 어떤 dt 를 골라도 보존계에서 forward Euler 는 *무조건* 에너지를 주입한다(조건부로 "느리게" 폭발할 뿐). 안정 영역(stability region)이 허수축을 포함하지 못해, 진동계(eigenvalue 가 순허수)는 절대 안정화하지 못한다. **정확도**는 1차(전역 O(dt)). 싸고 부정확하고 불안정 — 교과서 출발점일 뿐이다.

## (b) Symplectic / Semi-implicit Euler — 게임 표준

forward Euler 에서 **순서 한 줄만 바꾸면** 거동이 극적으로 좋아진다. 속도를 먼저 갱신하고, *갱신된 새 속도*로 위치를 민다.

```
v_{n+1} = v_n + a_n · dt          ← 속도 먼저
x_{n+1} = x_n + v_{n+1} · dt      ← 새 속도 v_{n+1} 로 위치 (이 한 줄이 핵심)
```

이름이 여럿이다: **semi-implicit Euler**, **symplectic Euler**, **Euler–Cromer**, (게임 코드에서) 그냥 "Euler". 정확도는 여전히 1차지만, 보존계에서 에너지가 단조 증가/감소하지 않고 참값 주위에서 **유계로 진동(bounded oscillation)** 한다 — 장시간 시뮬레이션에서도 폭발하거나 죽지 않는다.

```
스프링계 증폭행렬의 고윳값 크기 |λ| = 1   (dt < 2·sqrt(m/k) 인 한)
→ 진폭이 커지지도 작아지지도 않음. 위상만 약간 어긋남(주파수 오차).
```

> 📐 **심화: 왜 한 줄 차이가 에너지를 보존하는가** — forward 와 symplectic 은 코드 한 줄 차이인데 한쪽은 폭발하고 한쪽은 영원히 안정하다. "symplectic 이라 그렇다"는 답이 아니라, *수정 해밀토니안(shadow Hamiltonian)* 과 위상공간 면적 보존(Liouville)으로 그 까닭을 끝까지 푼 전용 문서가 있다 → [03a-symplectic-energy.md](03a-symplectic-energy.md).

**왜 거의 모든 강체 엔진이 이걸 쓰는가**:

1. **싸다** — forward Euler 와 연산량 동일. 함수평가 1회/스텝.
2. **장기 에너지 안정** — 게임은 수 시간 돌아도 안 터져야 한다. symplectic 의 유계 에너지 거동이 정확히 이 요구에 맞는다.
3. **구속 솔버와 궁합** — Box2D/PhysX/Bullet 류의 **속도 기반 sequential impulse**([05-constraint-solving.md](../05-constraint-solving.md)) 파이프라인은 "속도를 먼저 적분 → 충돌/구속으로 속도를 보정 → 보정된 속도로 위치 전진" 구조다. 이게 바로 semi-implicit Euler 의 형태다 — 적분기와 솔버가 자연스럽게 한 흐름이 된다.
4. **충분히 정확** — 게임은 우주 궤도 정밀도가 필요 없다. 시각적으로 그럴듯하고 안 터지면 된다.

> 결론: "정확도를 더 사면(RK4) 비싸지고, 그래도 symplectic 만큼 장기 안정하지 않다"가 게임이 semi-implicit Euler 를 표준으로 쓰는 한 줄 요약이다.

## (c) Implicit (Backward) Euler — 무조건 안정, stiff 계의 필수품

backward Euler 는 미래의 도함수로 갱신한다.

```
v_{n+1} = v_n + a(x_{n+1}, v_{n+1}) · dt     ← 우변에 미래 값 등장!
x_{n+1} = x_n + v_{n+1} · dt
```

우변이 미지수 `y_{n+1}` 에 의존하므로 **대수 방정식을 풀어야** 한다 — 그래서 "암묵(implicit)".

**무조건 안정(unconditionally stable)** — backward Euler 의 안정 영역은 좌반평면 전체를 덮는다. 즉 *어떤 dt 를 써도 폭발하지 않는다*. 대신 공짜가 아니다: 에너지를 **인위적으로 감쇠(numerical damping)** 시킨다. 진동이 실제보다 빨리 죽는다. 그래서 정확도보다 "큰 dt 로도 안 터지는 것"이 더 중요한 곳에서 쓴다.

**왜 cloth/soft body([07-deformable-bodies.md](../07-deformable-bodies.md))·stiff 계에 필수인가**:

- **stiff system(강성계)**: 스프링 강성 `k` 가 매우 크면(빳빳한 천, 강한 제약) explicit 의 안정 한계 `dt < 2·sqrt(m/k)` 가 *말도 안 되게 작아진다*. 5000개 스프링의 천을 explicit 으로 안정화하려면 dt 가 마이크로초 단위가 되어 실시간 불가.
- backward Euler 는 이 한계가 없으므로 **프레임 dt(예: 1/60s) 한 방에** 빳빳한 천을 안정적으로 적분한다. Baraff–Witkin "Large Steps in Cloth Simulation"(1998) 이 정확히 이 논리로 게임/영화 cloth 의 표준을 세웠다.

**어떻게 푸는가 — 선형화 + (뉴턴) 반복**: 비선형 `f` 를 1차 테일러 전개해 선형계로 만든다(semi-implicit / linearly-implicit).

```
방정식:   (I − dt·∂f/∂y) · Δy = dt · f(y_n)
          └──────┬───────┘
            야코비안 J = ∂f/∂y 로 만든 시스템 행렬
풀이:     큰 희소 선형계 → conjugate gradient(CG) 등으로 Δy 해결
          y_{n+1} = y_n + Δy
```

- `f` 가 강한 비선형이면 위 선형화를 **뉴턴 반복(Newton iteration)** 으로 감싸 수렴할 때까지 반복한다(보통 1~수 회).
- cloth 에선 힘의 야코비안(stiffness matrix)을 조립하고 희소 선형계를 CG 로 푼다 — 한 스텝 비용이 explicit 보다 훨씬 크지만, 큰 dt 한 방이 작은 dt 수천 방보다 싸다.

> implicit 의 트레이드: 안정성·큰 dt 를 사고 → 비용(선형계 풀이)·인위적 감쇠를 지불한다. 그래서 강체 메인 루프는 symplectic Euler(싸고 에너지 보존), cloth/soft 는 implicit(안정·감쇠 허용)로 갈린다. PBD/XPBD([05-constraint-solving.md](../05-constraint-solving.md))는 이 implicit 비용을 *위치 투영 반복*으로 우회하는 별개의 길이다.

---

**관련 함정** (전체 체크리스트는 [03-time-integration §5](../03-time-integration.md#5-함정--결정론-체크리스트)):
- **forward Euler 의 위치 갱신에 옛 속도를 쓰는 것** — semi-implicit 와 단 한 줄 차이지만 결과는 폭발 vs 안정. 코드 리뷰에서 가장 흔한 미세 버그.
- **stiff 요소 하나가 전체 dt 를 묶음** — explicit 으로 빳빳한 천/제약을 섞으면 한 군데 때문에 전부 폭발. 그 부분만 implicit/PBD 로 분리하라.

**다음**: [04-verlet](04-verlet.md) — 속도를 저장하지 않고 두 과거 위치에서 끌어내는 적분기.
