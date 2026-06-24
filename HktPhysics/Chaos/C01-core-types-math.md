# C01 — 코어 타입·수학

> **이 챕터가 답하는 질문**: Chaos 코드의 거의 모든 줄에 `FVec3`·`FRotation3`·`FRigidTransform3`·`FMatrix33` 이 나온다. 이것들은 *대체 무엇*이고, 왜 엔진의 `FVector`·`FQuat` 를 그냥 안 쓰고 따로 두었는가?
> **대응 Concepts**: [00 — 기초(벡터·쿼터니언·행렬)](../Concepts/00-foundations.md) · [01 — 운동학(위치·자세·변환)](../Concepts/01-kinematics.md)
> **선행 챕터**: [C00 — 모듈·빌드 지형](./C00-module-build.md) (특히 §2 정밀도 정책·ISPC)

---

## 왜 이 챕터를 두 번째로 읽는가

C00 에서 지형을 잡았으니, 이제 코드를 이루는 *벽돌*을 봐야 한다. Chaos 의 모든 알고리즘은 결국 위치를 더하고, 회전을 합성하고, 관성으로 토크를 나누는 일이다. 그 연산의 피연산자가 바로 이 챕터의 타입들이다. 이걸 모르면 이후 어느 챕터에서든 `FVec3 X = ...` 한 줄에서 "이게 float 인가 double 인가, 엔진 벡터인가 별개인가"를 매번 다시 물어야 한다.

그런데 C01 의 핵심 메시지는 의외로 한 문장이다 — **Chaos 는 수학 라이브러리를 새로 만들지 않았다.** 코어 타입들은 언리얼 자신의 LWC 수학 타입(`UE::Math::TVector`/`TQuat`/`TTransform`/`TMatrix`)을 **정밀도별로 감싼 얇은 래퍼**일 뿐이다. 이 사실 하나를 받아들이면 나머지가 전부 쉽게 풀린다.

> **LWC(Large World Coordinates)란?** 언리얼이 거대한 월드(수십 km 단위)에서 좌표 정밀도가 깨지는 문제를 풀려고 도입한 체계로, 핵심 수학 타입의 기본 정밀도를 float 에서 **double 로 올린** 것이다. `UE::Math::TVector<double>` 처럼 정밀도를 템플릿 인자로 받는 형태가 그 결과물이고, Chaos 가 이걸 그대로 물려받았기에 `FReal=double`(§2)이 자연스럽게 맞물린다.

---

## 1. 큰 그림: 이름은 새것, 속은 엔진 것

모든 코어 타입의 별칭이 한곳에 모여 있다 — `ChaosCore/Public/Chaos/Core.h`. 이 파일이 사실상 Chaos 타입 시스템의 색인이다.

```cpp
using FVec3          = TVector<FReal, 3>;          // :17
using FRotation3     = TRotation<FReal, 3>;        // :19
using FMatrix33      = PMatrix<FReal, 3, 3>;       // :20
using FRigidTransform3 = TRigidTransform<FReal, 3>;// :22
```

여기서 `TVector`·`TRotation`·`PMatrix`·`TRigidTransform` 은 Chaos 의 템플릿이지만, 정작 구현을 들춰보면 대부분 **엔진 타입을 상속**한다. 예를 들어 3차원 벡터의 실체는 이렇다 — `Vector.h:615`:

```cpp
template<>
class TVector<FRealDouble, 3> : public UE::Math::TVector<FRealDouble>  // = 엔진 FVector
{
    using UE::Math::TVector<FRealDouble>::X;   // X·Y·Z 를 그대로 물려받음
    ...
    static inline FRealDouble DotProduct(...);  // 물리에서 자주 쓰는 헬퍼만 덧붙임
};
```

즉 `FVec3` 은 엔진의 `FVector`(double 정밀도) *그 자체*에 물리용 정적 헬퍼 몇 개를 얹은 것이다. 회전도, 변환도, 4x4 행렬도 같은 패턴이다(`TRotation<.,3> : public UE::Math::TQuat`, `TRigidTransform<.,3> : public UE::Math::TTransform`, `PMatrix<.,4,4> : public UE::Math::TMatrix`).

**왜 굳이 감쌌는가?** 두 가지 이유다. 첫째, **정밀도를 한 다이얼로 바꾸기 위해서**(§2). 엔진 코드에 `FVector`(double)와 `FVector3f`(float)가 따로 있듯, 물리는 상황마다 정밀도를 갈아끼워야 하는데, `TVector<T,3>` 처럼 `T` 로 파라미터화해두면 별칭 한 줄로 정밀도를 통제할 수 있다. 둘째, **물리 전용 연산을 붙이기 위해서** — 관성 텐서, 쿼터니언 적분 헬퍼 등 엔진 일반 수학엔 없는 것들.

이론과의 대응은 그대로다: Concepts 의 *위치 벡터* → `FVec3`, *방향 쿼터니언* → `FRotation3`, *강체 자세(pose)* → `FRigidTransform3`, *관성 텐서* → `FMatrix33`.

---

## 2. 정밀도는 다이얼이다 — `FReal` 과 `f` 접미사

C00 에서 봤듯 기본 정밀도는 **double** 이다 — `Real.h:13,14,22`:

```cpp
using FRealDouble = double;
using FRealSingle = float;
using FReal = FRealDouble;   // 기본 다이얼: double
```

이 다이얼이 Core.h 의 별칭 체계에 그대로 반영된다. 같은 타입이 **두 벌**씩 있다.

- `FVec3`, `FRotation3`, `FRigidTransform3`, `FMatrix33` → `FReal`(double) 기반. 월드 좌표·누적 상태처럼 정밀도가 중요한 곳.
- `FVec3f`, `FRotation3f`, `FRigidTransform3f` → `FRealSingle`(float) 기반. 이름 끝에 **`f` 접미사**가 붙는다. 솔버 핫루프·ISPC 경계처럼 속도가 중요한 곳. (`Core.h:26-29`)

그래서 코드에서 `FVec3` 과 `FVec3f` 가 섞여 보이면, 그건 "정밀도 대 성능" 트레이드오프의 흔적으로 읽으면 된다(C00 §2 의 다이얼이 타입 레벨로 구체화된 것). 추가로 `TVec3<T>`, `TRotation3<T>` 같은 **정밀도 미지정 템플릿 별칭**(`Core.h:40-50`)도 있는데, 이건 "정밀도를 호출자가 정하게" 열어둔 제네릭 코드용이다.

마지막으로 C00 에서 만난 `bRealTypeCompatibleWithISPC`(`Real.h:28`)가 여기서 의미를 갖는다 — ISPC 커널은 float/double 만 다루므로, 이 상수가 참일 때만 ISPC 경로로 분기한다(ISPC 가이드 §5 의 `if (bRealTypeCompatibleWithISPC && ...ISPC_Enabled)` 패턴). 지금은 `FReal=double` 이라 항상 참이지만, `FReal` 의 정의를 다른 타입으로 바꿀 여지를 남겨두려고 컴파일 타임 검사로 박아둔 것이다(정의가 바뀌면 ISPC 경로가 자동으로 비활성화되어 스칼라 폴백으로 안전하게 떨어진다).

---

## 3. 네 개의 벽돌

### FVec3 — 위치·속도·힘

가장 흔한 타입. 위치, 선속도, 가속도, 힘, 법선 등 거의 모든 3차원 양이 `FVec3`(=`TVector<FReal,3>`=엔진 `FVector`)다. 앞서 봤듯 엔진 `UE::Math::TVector` 를 상속하므로 `X`/`Y`/`Z` 접근, 내적·외적·정규화가 다 된다(`Vector.h:615~`, float 판은 `:406~`). 제네릭 `TVector<T,d>`(`Vector.h:39`)는 임의 차원·타입용 폴백이고, 실제 핫한 3D 경로는 위 특수화가 처리한다.

### FRotation3 — 방향(쿼터니언)

강체의 방향은 쿼터니언으로 표현한다 — `FRotation3`(=`TRotation<FReal,3>`)는 엔진 `UE::Math::TQuat` 을 상속한다(`Rotation.h:267`, float 판 `:48`). 물리에서 자주 쓰는 생성 헬퍼가 정적 메서드로 붙어 있다: `FromAxisAngle(축, 각)`(`Rotation.h:413`), `FromElements(x,y,z,w)`(`:396`). 쿼터니언을 쓰는 이유는 Concepts 01 의 운동학과 1:1 대응 — 짐벌락 없이 회전을 합성·적분하기 위해서다(자세 적분의 실제 코드는 C11 에서).

### FRigidTransform3 — 강체의 자세(pose)

회전 + 평행이동 + 스케일을 한 덩어리로 묶은 것이 `FRigidTransform3`(=`TRigidTransform<FReal,3>`)로, 엔진 `UE::Math::TTransform` 을 상속한다(`Transform.h:299`, float 판 `:148`). 이것이 "강체가 월드 어디에 어떤 자세로 있는가"를 담는 단위다 — Concepts 01 의 *강체 자세* 그 자체. `GetTranslation()`/`GetRotation()`/`GetScale3D()` 로 성분을 꺼내고, 역변환·합성 연산(`:366~`)으로 좌표계를 오간다(예: 월드↔로컬, 충돌점 변환에서 끊임없이 쓰인다).

### FMatrix33 / PMatrix — 관성 텐서의 자리 (예외적 벽돌)

나머지 셋과 결이 다른 하나가 `PMatrix` 다. `FMatrix33`(=`PMatrix<FReal,3,3>`)는 **관성 텐서**를 담기 위한 3x3 행렬이다 — 회전 동역학의 핵심 양으로, "이 강체가 각 축으로 얼마나 돌기 싫어하는가"를 나타낸다(Concepts 02 동역학과 연결).

흥미로운 구현 디테일: 3x3 라고 해놓고도 실제로는 엔진의 **4x4** `UE::Math::TMatrix` 를 상속한다(`Matrix.h:377`). 즉 저장은 4x4 지만 논리적으로 3x3 로 쓴다. 그래서 관성 텐서 전용 **대각 생성자**가 따로 있다 — `PMatrix(x00, x11, x22)`(`Matrix.h:388`)는 대각만 채우고 나머지를 0(과 `M[3][3]=1`)으로 둔다. 주축 관성(principal moments)을 그대로 넣는 흔한 경우를 위한 것이다. `PMatrix` 는 이 밖에도 3x2·2x2·4x4 등 여러 차원으로 특수화돼 있다(`Matrix.h:27~`).

---

## 4. 값 타입 위에 있는 또 하나의 층 — SIMD 패킹

지금까지의 타입은 "하나의 벡터·회전·행렬"을 담는다. 그런데 솔버는 *수천 개*를 한꺼번에 처리해야 한다. 여기서 별도의 SIMD 층이 등장한다 — `ChaosCore/Public/Chaos/SimdTypes.h`, `Simd4.h`.

핵심 아이디어는 헤더 주석(`SimdTypes.h:24~`)에 직접 적혀 있다: N개의 3-벡터를 한 벡터씩 통째로 늘어놓은 배열(AOS, Array of Structs: `[v0, v1, v2, ...]`)이 아니라, **X만 모은 배열·Y만 모은 배열·Z만 모은 배열**로 쪼개 저장한다(SOA, Struct of Arrays). 이렇게 하면 SIMD 레지스터 한 칸에 서로 다른 N개 벡터의 X가 나란히 담겨 "N개 데이터를 1개 비용으로" 처리할 수 있고, *한 벡터 안의* X·Y·Z 를 가로질러 더해야 하는 수평(horizontal) 연산 — 내적의 마지막 합산 같은, SIMD 가 특히 비싸게 처리하는 연산 — 을 피할 수 있다. 실제 사용처로 `FPBDCollisionSolverSimd` 의 `SolvePositionNoFriction`/`SolveVelocity` 가 명시돼 있다(C07 충돌 솔버에서 다시 본다).

**C00 의 ISPC 와 무엇이 다른가?** 둘 다 SIMD 지만 층이 다르다. ISPC 는 *별도 언어·별도 컴파일러*로 커널을 뽑는 방식이고(ISPC 가이드 참조), `SimdTypes.h`/`Simd4.h` 는 *C++ 안에서* `VectorRegister`(엔진 SIMD 인트린식 래퍼)로 직접 짠 SIMD 코드다. 같은 목표(벡터화)를 두 가지 도구로 공략하는 셈이다. 참고로 `SimdTypes.h` 는 아직 `Private` 네임스페이스의 WIP 이고 4레인(`TNumLanes==4`)만 지원한다(`:14-15`).

> 정리하면 C01 의 타입은 두 층이다 — **(1) 한 값 타입**(`FVec3`/`FRotation3`/…, 엔진 수학 래퍼) 위에 **(2) 다수를 묶는 SIMD 패킹 타입**(`Simd4`/SOA)이 얹힌다.

---

## 5. 결정론·스레딩 메모

- **정밀도 혼용이 결정론 변수다.** 월드 상태는 double(`FVec3`), 솔버 핫패스는 float(`FVec3f`). float↔double 변환 지점마다 정밀도 손실이 생기고(코드 곳곳의 `LWC_TODO: Precision loss` 주석이 그 지점들, 예 `Vector.h:422,426`, `Rotation.h`, `Matrix.h`), float 경로는 플랫폼·컴파일러 간 부동소수점 순서에 더 민감하다 → C13 네트워크 결정론에서 재검토.
- **직렬화 버전 GUID.** `Core.h:55` 의 `ChaosVersionGUID` 는 Chaos 데이터 직렬화/DDC 버전을 못 박는 값이다. 머지 충돌 시 새 GUID 로 교체해야 하며(주석 경고), 안 그러면 DDC 버전 충돌로 로드 중 크래시가 난다 — 결정론적 캐시 일관성의 토대.
- **SIMD 연산 순서.** SOA 패킹·ISPC 경로는 스칼라 경로와 합산 순서가 달라 비트 단위 결과가 갈릴 수 있다(C00 §4 와 동일한 주의).

---

## 6. 무엇을 들고 다음으로 가는가

세 문장으로 압축하면:

첫째, **코어 타입은 엔진 LWC 수학(`UE::Math::*`)을 정밀도별로 감싼 얇은 래퍼다** — 새 수학 라이브러리가 아니다. `Core.h` 가 그 색인이다. 둘째, **정밀도는 `FReal`(double 기본)/`FRealSingle`(float, `f` 접미사) 다이얼로 통제된다** — 둘이 섞이면 성능 트레이드오프의 흔적. 셋째, **`FMatrix33`(PMatrix 3x3)은 관성 텐서 전용 예외 벽돌**이고, 그 위에 `Simd4`/SOA 라는 다수-패킹 SIMD 층이 따로 있다.

다음은 **C02 — 파티클·강체 표현**이다. 거기서 이 벽돌들이 실제 강체의 상태로 조립된다 — `FVec3` 위치·속도, `FRotation3` 자세, `FMatrix33` 관성이 §4 에서 본 SOA 발상 그대로 파티클 배열로 배치되고, `TGeometryParticleHandle` 로 다뤄진다. C01 이 "한 값이 무엇인가"였다면, C02 는 "그 값들이 수천 개 모여 어떻게 저장되는가"다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 주장 | 앵커 |
|---|---|
| 코어 타입 별칭 색인(FVec3/FRotation3/FMatrix33/FRigidTransform3 + f판 + 템플릿판) | `ChaosCore/Public/Chaos/Core.h:16-22,26-29,40-50` |
| 정밀도 정책 `FReal=double`·`FRealSingle=float`·ISPC 호환 | `ChaosCore/Public/Chaos/Real.h:13,14,22,28` |
| `FVec3` 의 실체 = 엔진 `UE::Math::TVector` 상속(double/float 특수화) | `ChaosCore/Public/Chaos/Vector.h:615,406`; 제네릭 `:39` |
| `FRotation3` = 엔진 `UE::Math::TQuat` 상속·FromAxisAngle/FromElements | `ChaosCore/Public/Chaos/Rotation.h:267,48,396,413` |
| `FRigidTransform3` = 엔진 `UE::Math::TTransform` 상속·역변환/합성 | `ChaosCore/Public/Chaos/Transform.h:299,148,366` |
| `FMatrix33`(PMatrix 3x3)=4x4 TMatrix 상속·관성 대각 생성자 | `ChaosCore/Public/Chaos/Matrix.h:377,388` |
| SIMD SOA 패킹 타입(목적·사용처·WIP/4레인) | `ChaosCore/Public/Chaos/SimdTypes.h:14-15,24-` ; `Simd4.h` |
| 직렬화 버전 GUID | `ChaosCore/Public/Chaos/Core.h:55` |
| float↔double 정밀도 손실 지점 표식 | `ChaosCore/Public/Chaos/Vector.h:422,426` 등 `LWC_TODO` 주석 |
