# [01·2.5] 좌표 프레임과 변환 (Frames & Transforms)

> 운동학 양은 항상 "어느 프레임에서 본 것인가" 를 명시해야 의미가 있다. 강체 변환의 표현·합성·속도 변환을 정리한다.
> **상위 노드**: [01-kinematics.md](../01-kinematics.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations.md](../00-foundations.md) (행렬·변환·사원수) · [03-point-velocity.md](03-point-velocity.md)

---

운동학 양은 항상 *어떤 프레임에서 본 것인가* 를 명시해야 의미가 있다. 게임 엔진의 표준 프레임:

- **world (월드/global)**: 공통 기준계.
- **local / body / object**: 강체 고유 좌표(원점 = 보통 pivot 또는 질량중심).
- **parent**: 씬 그래프에서 부모 노드 기준(계층 변환).

## 강체 변환 (rigid transform) 의 표현

자세 + 위치를 합친 강체 변환은 동차좌표 4×4 행렬, 또는 (회전 R/q + 평행이동 t) 분리 저장 두 방식이 있다:

```
동차 4×4:           분리 (위치 t, 자세 q/R):
⎡ R | t ⎤           점 변환:  p_world = R · p_local + t
⎢ --+-- ⎥           역변환:   p_local = Rᵀ · (p_world − t)
⎣ 0 | 1 ⎦
```

균등(uniform) 변환에는 (스케일까지) **TRS** = `T · R · S` 합성을 쓴다. UE 의 `FTransform` 이 정확히 (Rotation `FQuat`, Translation `FVector`, Scale3D) 분리 저장 방식이다 — 회전 보간·정규화가 싸고, 비균등 스케일 처리가 명확하기 때문([실무 절](../01-kinematics.md#4-실무-엔진은-무엇을-쓰는가)).

## 변환 합성 (composition)

부모→자식 체인을 곱으로 합성한다. 행렬은 행렬곱, 분리 저장은 회전·평행이동을 각각 합성:

```
행렬:      M_world = M_parent · M_local
분리:      q_world = q_parent ⊗ q_local
           t_world = q_parent · t_local + t_parent     ( q · v = 사원수로 벡터 회전 )
```

**비가환 주의**: 변환 합성도 회전처럼 순서가 중요하다(`A·B ≠ B·A`). 행 우선(row-major, 좌측 곱) vs 열 우선(column-major, 우측 곱) 규약은 엔진마다 다르다 — UE 는 행벡터·좌측곱(`v' = v·M`), 많은 수학 교재/GLM 은 열벡터·우측곱(`v' = M·v`). 이 규약 혼동이 변환 버그 1위 원인이다.

## 속도의 프레임 변환

위치만이 아니라 **속도/각속도도 프레임을 바꿔 표현**해야 할 때가 많다(예: body frame 관성텐서로 토크 계산은 [02-dynamics.md](../02-dynamics.md)).

```
각속도(자유벡터):     ω_world = R · ω_body          (평행이동 무관, 회전만)
선속도(점에 붙음):     v_world = R · v_body + v_origin + ω_world × (R · r_local)
```

선속도는 *어느 점의 속도인가* 에 따라 `ω × r` 항이 붙는다([03-point-velocity.md](03-point-velocity.md)). 회전하는 프레임(rotating frame)에서 본 속도/가속도에는 코리올리(Coriolis)·구심 가짜힘 항이 추가로 나타나지만, 그 동역학적 처리는 [02-dynamics.md](../02-dynamics.md) 로 미룬다.

---

**관련 함정** (전체 체크리스트는 [01-kinematics §5](../01-kinematics.md#5-함정--결정론-체크리스트)):
- **행벡터 vs 열벡터 / 곱 순서**: 엔진 규약(UE=좌측곱)과 수학교재(우측곱)가 다르다. 합성 순서를 뒤집으면 조용히 틀린다.
- **자유벡터 vs 점 부착 벡터**: 각속도는 회전만 적용(`R·ω_body`), 선속도는 `ω×r` 항이 붙는다 — 혼동 주의.
- **비균등 스케일과 법선**: 비균등 스케일 변환에서 법선은 역전치 행렬로([00-foundations.md](../00-foundations.md)).

**다음**: [06-relative-motion.md](06-relative-motion.md) — 두 프레임 사이의 상대 자세·상대 속도.
