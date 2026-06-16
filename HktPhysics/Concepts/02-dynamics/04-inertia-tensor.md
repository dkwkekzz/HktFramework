# [02·2.4] 관성텐서 (Inertia Tensor)

> 회전의 "질량"이 왜 스칼라가 아니라 **3×3 대칭 텐서**인가. 정의(부피 적분)·주축(principal axes)·평행축 정리·body↔world 변환. 3D 강체 동역학에서 가장 직관 장벽이 높은 주제 — 핵심만 여기 두고, "왜 그렇게 되는가"는 심화 문서로 분리한다.
> **상위 노드**: [02-dynamics.md](../02-dynamics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) (행렬·고유값·외적), [03-momentum-impulse](03-momentum-impulse.md)

---

회전은 선형의 "유사물"이지만 결정적 차이는 **관성이 스칼라가 아니라 텐서**라는 점이다. 여기가 3D 강체 동역학에서 가장 까다롭고 가장 중요한 부분이다.

> 📐 **근본부터 기하학적 심화**: "왜 텐서인가(방향마다 다른 관성) · 왜 `L`과 `ω`가 평행하지 않은가 · 주축은 어디서 오는가 · 평행축 정리는 왜 성립하는가 · world 변환 `R·I·Rᵀ`의 정체"를 분포 적분→대칭행렬 고유분해→자이로 직관까지 풀어낸 전용 문서 → [04a-inertia-tensor-geometric.md](04a-inertia-tensor-geometric.md).

## 정의 — 질량분포의 부피 적분

관성텐서는 "이 물체가 각 축 회전에 얼마나 저항하는가"를 담은 대칭 3×3 행렬이다. 강체의 질량분포 `ρ(r)` 에 대해 부피 적분으로 정의된다:

```
        ⎡ Ixx  Ixy  Ixz ⎤
I_cm =  ⎢ Iyx  Iyy  Iyz ⎥      (Iyx=Ixy 등, 대칭)
        ⎣ Izx  Izy  Izz ⎦

대각 성분 (moments of inertia):
  Ixx = ∫ (y² + z²) ρ dV
  Iyy = ∫ (x² + z²) ρ dV
  Izz = ∫ (x² + y²) ρ dV

비대각 성분 (products of inertia):
  Ixy = Iyx = −∫ x·y ρ dV
  Ixz = Izx = −∫ x·z ρ dV
  Iyz = Izy = −∫ y·z ρ dV
```

> 부호 주의: 곱 관성(products of inertia)의 음부호는 텐서 형태 `L = I·ω` 와 일관되도록 한 관례다. 자료에 따라 부호 규약이 다르니, 평행축 정리·world 변환 식과 자기 일관성을 반드시 확인할 것.

물리적 의미: `Ixx` 는 x축 둘레 회전에 대한 관성으로, 질량이 그 축에서 멀수록(반지름 제곱) 커진다. 같은 질량이라도 길게 뻗은 막대는 긴 축 둘레는 잘 돌고(작은 I), 직교 축 둘레는 잘 안 돈다(큰 I). 즉 회전 관성은 **방향마다 다른 양**이고, 그래서 단일 숫자가 아니라 텐서가 필요하다(→ [04a 심화 §1·§2](04a-inertia-tensor-geometric.md)).

## 주축 (principal axes)과 대각화

`I` 는 대칭 행렬이므로 항상 직교 고유벡터(eigenvector)들로 대각화된다. 이 고유벡터 방향이 **주축(principal axes)** 이고, 고유값이 **주관성모멘트(principal moments)** 다:

```
R_p ᵀ · I · R_p = diag(I1, I2, I3)
```

주축 좌표계에서는 곱 관성이 전부 0 → `I` 가 대각행렬 → `L = I·ω` 가 성분별 곱으로 단순해진다. 대칭이 좋은 도형(구·박스·캡슐)은 body 좌표축이 곧 주축이라 처음부터 대각이다. 그래서 엔진은 **관성텐서를 대각벡터(I1,I2,I3)와 본체 회전으로 저장**하는 경우가 많다 — 역행렬이 성분 역수로 끝나 `invI` 계산이 싸진다. (왜 대칭행렬은 항상 직교 대각화되며, 그 축이 왜 "흔들림 없는 회전축"인가는 → [04a 심화 §3](04a-inertia-tensor-geometric.md).)

## 평행축 정리 (parallel axis theorem)

무게중심을 지나지 않는 축 둘레 관성은, 무게중심 관성에 "질량 × 거리²"를 더해서 얻는다. 텐서 형태(Huygens–Steiner):

```
스칼라형:  I_axis = I_cm + m·d²            (d = 두 평행축 사이 거리)

텐서형:    I_P = I_cm + m·( (d·d) E₃ − d⊗d )
           d = (무게중심 → 새 기준점) 벡터,  E₃ = 단위행렬,  d⊗d = 외적행렬
```

이것이 **합성 강체(composite body)** 의 관성 계산 핵심이다 — 여러 부품의 `I_cm` 을 전체 무게중심으로 평행축 이동시킨 뒤 더한다([05-mass-properties](05-mass-properties.md)). (왜 항상 "더하기만" 하고 빼지 않는가, 거리² 의 기하학적 정체는 → [04a 심화 §4](04a-inertia-tensor-geometric.md).)

## 흔한 형상의 관성텐서 (body 좌표, 무게중심 원점, 균질 질량 m)

```
실심 구 (solid sphere, 반지름 r):
  Ixx = Iyy = Izz = (2/5)·m·r²

속 빈 구 (hollow shell, 반지름 r):
  Ixx = Iyy = Izz = (2/3)·m·r²

직육면체 박스 (box, 변 길이 w×h×d, 축에 정렬):
  Ixx = (1/12)·m·(h² + d²)
  Iyy = (1/12)·m·(w² + d²)
  Izz = (1/12)·m·(w² + h²)

실심 실린더 (cylinder, 반지름 r, 높이 h, 축 = z):
  Izz = (1/2)·m·r²                       (축 둘레)
  Ixx = Iyy = (1/12)·m·(3·r² + h²)       (직교 축 둘레)

캡슐 (capsule, 원통 반지름 r·높이 h + 양끝 반구):
  실린더(질량 m_c)와 두 반구(합쳐 질량 m_s)로 분해 →
  각각 무게중심 I 구해 평행축 정리로 반구를 ±h/2 만큼 이동 → 합산.
  (닫힌형 식 존재하나 길다 — 실무는 분해+합산이 안전)
```

검증 팁: 어떤 관성텐서든 **삼각부등식(I1 + I2 ≥ I3 등)** 을 만족해야 물리적으로 유효하다. 위반하면 질량 속성 계산에 버그가 있다.

## world frame 으로의 변환

관성텐서는 본체에 고정된 양이라 **body frame 에서 상수**다. 하지만 운동방정식은 world frame 에서 풀어야 하므로, 매 프레임 회전 `R`(body→world)로 변환한다(텐서의 합동변환):

```
I_world = R · I_body · Rᵀ
역행렬:   invI_world = R · invI_body · Rᵀ
```

> 실무 최적화: 회전은 사원수→3×3 행렬로 한 번 만들고, `invI_world` 만 캐싱한다. `invI_body` 가 대각이면 `R · diag(...) · Rᵀ` 는 더 싸게 전개된다. 이 변환을 빼먹고 body 텐서를 world 에서 그냥 쓰면, 회전 중인 물체의 토크 응답이 완전히 틀어진다(흔한 버그). (왜 양옆에 `R` 과 `Rᵀ` 가 끼는지 — 텐서가 "기저에 묶인 양"이라는 점은 → [04a 심화 §5](04a-inertia-tensor-geometric.md).)

---

**관련 함정** (전체 체크리스트는 [02-dynamics §5](../02-dynamics.md#5-함정--결정론-체크리스트)):
- **body 텐서를 world 에서 그대로 사용**: 가장 흔한 버그. 매 프레임 `I_world = R·I_body·Rᵀ` 변환 필수.
- **단위·부호 규약 불일치**: 곱 관성 부호 관례가 자료마다 다르다. 평행축·world 변환과 자기 일관성 검증(삼각부등식 체크).

**다음**: [05-mass-properties](05-mass-properties.md) — 관성텐서가 기준 삼는 무게중심과 합성 강체의 질량 속성.
