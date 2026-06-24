# [01.5] 좌표 프레임과 변환 (Frames & Transforms)

> 충돌 부착점도, 조인트 앵커도, 카메라도, 본(bone)도 — 전부 "어느 프레임에서 본 양인가"를 정확히 추적해야 푼다. 이 문서는 world/local/parent 프레임, TRS 분리 저장(UE `FTransform`), 변환 합성과 그 **곱 순서**, 그리고 위치뿐 아니라 **속도까지 프레임을 옮기는 법**을 끝까지 판다.
> **상위 허브**: [../01-kinematics.md](../01-kinematics.md) · **상위 지도**: [../README.md](../README.md)

---

## 1. 왜 프레임이 필요한가

물리에서 "위치 `(3, 0, 1)`"은 그 자체로는 의미가 없다. **무엇을 기준으로** 3 인가? 월드 원점? 캐릭터 발밑? 부모 본? 같은 점이 프레임마다 다른 좌표를 갖는다. 엔진이 매 프레임 푸는 거의 모든 기하 질문 — "이 충돌점이 월드 어디인가", "자식 본은 부모를 따라 어떻게 움직이나", "조인트 앵커 두 개가 얼마나 어긋났나([06](06-relative-motion.md))" — 은 결국 **한 프레임의 좌표를 다른 프레임의 좌표로 옮기는 일**이다.

그래서 운동학의 핵심 도구는 **변환(transform)**: 한 좌표 프레임을 다른 프레임으로 옮기는 강체 사상(rigid transform). 회전 + 평행이동, 그리고 게임 엔진에서는 스케일까지.

자주 쓰는 세 프레임:
- **world (월드)**: 전역 고정 기준. 모든 것을 비교하는 공통 좌표계.
- **local / body (로컬·바디)**: 객체 자신에 고정. 객체와 함께 움직인다. "내 앞 1m" 같은 양은 로컬에서 자연스럽다.
- **parent (부모)**: 계층(scene graph·skeleton)에서 한 단계 위. 자식의 로컬 변환은 *부모 프레임 기준* 으로 저장된다.

---

## 2. 정의: 변환이란 무엇인가

### 2.1 강체 변환과 TRS

한 점 `p` 를 프레임 A 좌표에서 프레임 B 좌표로 옮기는 변환 `T_{B←A}` 는 회전 `R` 과 평행이동 `t` 로:

```
p_B = R · p_A + t          (강체 변환: 회전 후 평행이동)
```

게임 엔진은 여기에 **스케일 `S`** 를 더한 **TRS**(Translation·Rotation·Scale)를 다룬다:

```
p_B = R · (S · p_A) + t    (스케일 → 회전 → 평행이동 순서로 적용)
```

순서가 중요하다: **스케일 먼저, 그 다음 회전, 마지막 평행이동**(S·R·T 를 점에 적용할 때 오른쪽부터). 순서를 바꾸면 비균등 스케일에서 전단(shear)이 생긴다.

### 2.2 동차 행렬 vs 분리 저장 (FTransform 직관)

변환을 표현하는 두 방식:

**(a) 4×4 동차 행렬(homogeneous matrix)** — 회전·평행이동을 한 행렬에:

```
        [ R   t ]          [ p ]      (점은 (p, 1) 동차좌표,
  M  =  [ 0   1 ]   ,   M  [ 1 ]       방향벡터는 (d, 0))
```

장점: 합성이 그냥 행렬 곱. GPU·셰이더 친화. 단점: 16 float, 회전 보간하려면 분해해야 하고, 비균등 스케일이 회전과 얽혀 재정규화가 까다롭다.

**(b) 분리 저장 (UE `FTransform`)** — Quat + Vec(translation) + Vec(scale)을 따로:

```
struct FTransform { FQuat Rotation; FVector Translation; FVector Scale3D; }
```

장점(허브 §4 와 일치):
- 회전 보간·정규화가 싸다(사원수 slerp/nlerp 직접, [07](07-interpolation.md)).
- 비균등 스케일을 회전과 분리해 명확히 다룬다.
- 메모리 10 float(4+3+3) < 16.

단점: 점 변환할 때마다 사원수→행렬 환산 비용. 그래서 엔진은 *저장* 은 분리, *대량 점 변환* 직전엔 행렬로 캐시(허브 §4 "행렬은 변환 캐시·렌더에서만").

`FTransform` 직관: **"이 객체는 부모 기준으로, 이만큼 돌고(Quat) 이만큼 키우고(Scale) 이만큼 옮겨진(Vec) 좌표틀"** 을 들고 있는 한 덩어리. 본 하나, 액터 하나마다 하나씩.

---

## 3. 수식: 합성과 곱 순서 (가장 자주 틀리는 곳)

### 3.1 합성 (계층을 따라 world 로 올리기)

자식 본의 world 변환은 부모 체인을 따라 로컬 변환을 **누적 합성**한다. A→B, B→C 변환이 있으면 A→C 는:

```
T_{C←A} = T_{C←B} ∘ T_{B←A}
```

행렬로는 곱이지만 — **순서가 표기 규약에 따라 뒤집힌다.** 여기가 함정(허브 §5).

### 3.2 행벡터 vs 열벡터: UE 는 좌측 곱

두 규약이 공존한다:

```
수학 교재 (열벡터, column-vector):   p' = M p        (점이 오른쪽, 변환은 왼쪽에서 곱)
   → 합성:  M_total = M_parent · M_local           (적용 순서의 역순으로 왼쪽에 쌓임)

UE (행벡터, row-vector, 좌측 곱):    p' = p M        (점이 왼쪽, 변환은 오른쪽에서 곱)
   → 합성:  M_total = M_local · M_parent           (적용 순서대로 왼쪽→오른쪽)
```

**UE 규약(행벡터)**: 점이 행이므로 `p' = p · M_local · M_parent · ... · M_world`. 즉 **로컬에서 출발해 오른쪽으로 부모를 곱해 올라간다**. `FTransform` API 로는:

```
WorldTransform = LocalTransform * ParentTransform   // UE: 왼쪽이 자식, 오른쪽이 부모
// (A * B 는 "A 를 적용한 뒤 B 를 적용" — A 가 자식/먼저)
```

수학 교재(열벡터)에서 같은 합성은 `Parent · Local`(부모가 왼쪽). **두 규약은 곱 순서가 정반대다.** 사원수 합성도 똑같이 규약을 탄다 — 섞으면 회전이 조용히 거꾸로 합성된다.

핵심 체크: **"내 엔진은 점을 행으로 두는가 열로 두는가"** 를 먼저 못박고, 모든 합성을 그 규약 하나로 통일하라. UE 코드를 짜면서 교재 곱 순서를 쓰면 빌드는 되는데 캐릭터가 엉뚱하게 휜다.

### 3.3 역변환

`T_{A←B} = (T_{B←A})⁻¹`. 강체(스케일 1)일 때:

```
R⁻¹ = Rᵀ              (직교성)
t⁻¹ = −Rᵀ t
즉  p_A = Rᵀ (p_B − t)
```

스케일이 있으면 `S⁻¹` 도 역순으로 끼워야 한다(역은 합성 순서를 뒤집는다: `(AB)⁻¹ = B⁻¹A⁻¹`).

### 3.4 속도 변환 (위치만이 아니다)

프레임 B 가 world 에 대해 `(R, t)` 자세이고 선속도 `v_B`, 각속도 `ω_B` 로 움직일 때, B 에 고정된 점 `r`(B-로컬)의 world 속도는([03](03-point-velocity.md)의 `v_P = v_cm + ω×r`):

```
v_world(point) = v_B + ω_B × (R · r)
```

방향벡터(속도·힘·법선)와 위치벡터는 **변환이 다르다**:

```
위치점 변환:   p_world = R · p_local + t      (회전 + 평행이동 둘 다)
방향벡터 변환: d_world = R · d_local          (회전만 — 평행이동 무시)
```

동차좌표가 이 차이를 자동화한다: 점 `(p,1)` 의 1 이 `t` 를 끌어오고, 방향 `(d,0)` 의 0 이 `t` 를 죽인다. **속도는 방향벡터처럼 회전만** 적용한다(평행이동은 위치에만). 각속도 프레임 변환은:

```
ω_world = R · ω_body          (각속도는 방향벡터 → 회전만)
```

이건 [04a](04a-quaternion-derivative.md) §2.3 의 `ω_world = R ω_body` 와 정확히 같은 식이다 — 프레임 변환의 한 사례.

---

## 4. 알고리즘 / 의사코드

```text
struct Transform { Quat q; Vec3 t; Vec3 s; }     # UE FTransform 류 (분리 저장)

# 점을 local → world (스케일→회전→평행이동)
function transform_point(T, p_local):
    return T.q.rotate(T.s ⊙ p_local) + T.t       # ⊙ = 성분별 곱(스케일)

# 방향벡터 local → world (회전만, 스케일·평행이동 제외하거나 비균등시 inverse-transpose)
function transform_direction(T, d_local):
    return T.q.rotate(d_local)                    # 균등 스케일 가정. 비균등이면 법선은 별도 처리

# 합성 (UE 규약: child 를 먼저 적용, 결과 = child ∘ parent 를 "child * parent" 로)
function compose(child, parent):                  # WorldOf(child) = child * parent
    out.q = parent.q ⊗ child.q                    # 회전: 부모로 자식을 감쌈(규약 주의!)
    out.s = parent.s ⊙ child.s
    out.t = parent.q.rotate(parent.s ⊙ child.t) + parent.t
    return out

# 역변환 (균등 스케일 가정)
function inverse(T):
    inv.q = conjugate(T.q)
    inv.s = 1 / T.s
    inv.t = inv.q.rotate(-(inv.s ⊙ T.t))
    return inv

# 점을 world → local
function inv_transform_point(T, p_world):
    return inverse(T).q.rotate(inverse(T).s ⊙ (p_world - T.t))   # 또는 inverse(T) 한 번 캐시 후 transform_point

# B-프레임에 고정된 점 r 의 world 속도 (선+각)
function point_world_velocity(v_B, omega_B, R_B, r_local):
    return v_B + cross(omega_B, R_B.rotate(r_local))
```

> compose 의 회전 합성 순서(`parent ⊗ child` 인지 `child ⊗ parent` 인지)는 **사원수 곱 규약 + 행/열벡터 규약**의 곱으로 결정된다. 엔진 한 곳에서 단위테스트(부모만 90° 돌렸을 때 자식 끝점이 어디 가나)로 한 번 못박고 전 코드가 거기 따르게 하라. 이게 §3.2 함정의 실무 방어선.

---

## 5. 실무 트레이드오프

- **분리 저장(FTransform) vs 4×4 행렬**: 저장·보간·정규화는 분리 저장이 이긴다(허브 §4·§2.2). 하지만 한 변환으로 *수천 점* 을 변환할 땐 사원수→행렬 환산을 한 번 캐시해서 행렬 곱이 빠르다. 엔진은 둘을 상황별로 쓴다.
- **비균등 스케일은 지뢰**: 비균등 스케일 + 회전 합성은 전단을 만들 수 있어 `FTransform` 합성에도 경고가 붙는다(UE 는 비균등 스케일 체인에서 정확성 보장을 약화). 물리 콜라이더는 가능한 균등 스케일·스케일 베이크를 권장. 법선 변환은 `(R S)⁻ᵀ`(inverse-transpose)를 써야 비균등에서 직각이 유지된다.
- **곱 순서 통일**: 허브 §5 의 대표 함정. UE(행벡터·좌측곱)와 수학교재(열벡터·우측곱)를 섞지 말 것. 새 코드는 엔진 규약을 따르고, 외부 수식을 옮길 땐 곱 순서를 반드시 뒤집어 검산.
- **속도 ≠ 위치 변환**: 속도·법선·각속도는 방향벡터 → 회전만. 평행이동을 실수로 더하면(점 변환 함수 재사용) 속도가 프레임 위치만큼 어긋난다. 점/방향 변환 함수를 분리해 둬라.
- **엔진 매핑**: UE5 `FTransform`(Quat+Vec+Scale, 행벡터·좌측곱, 허브 §4) / PhysX `PxTransform`(Quat+Vec, 스케일 없음 — 콜라이더 지오메트리에 스케일 내장) / Box2D `b2Transform`(2D: 위치+각도) / Bullet·Jolt 도 Quat+Vec 중심. 스케일을 변환에 넣느냐(UE)·지오메트리에 넣느냐(PhysX)가 엔진별로 갈린다.

---

## 6. 더 읽기 / 관련 노드

- **선행** — [04a-quaternion-derivative.md](04a-quaternion-derivative.md): `ω_world = R ω_body` 의 유도(각속도 프레임 변환의 뿌리). [../00-foundations.md](../00-foundations.md): 사원수·회전행렬·동차좌표 기초.
- **한 점 속도** — [03-point-velocity.md](03-point-velocity.md): `v_P = v_cm + ω×r` — 속도 프레임 변환(§3.4)의 물리 기반.
- **상대 운동** — [06-relative-motion.md](06-relative-motion.md): 두 프레임의 상대 변환 `q_AB`·상대 속도 — 이 문서의 변환 합성/역변환을 조인트 앵커 비교에 적용.
- **보간** — [07-interpolation.md](07-interpolation.md): `FTransform` 의 회전 성분을 slerp/nlerp, 위치를 lerp 로 보간하는 분리 보간.
- **충돌/조인트** — [../04-collision-detection.md](../04-collision-detection.md)·[../05-constraint-solving.md](../05-constraint-solving.md): 콜라이더·조인트 앵커를 world 로 올리는 변환이 자코비안의 기하 토대.
- **결정론** — [../12-determinism-networking.md](../12-determinism-networking.md): 변환 합성·`ω×r` 의 부동소수점 누적 순서가 플랫폼별로 갈리는 문제(허브 §5).
