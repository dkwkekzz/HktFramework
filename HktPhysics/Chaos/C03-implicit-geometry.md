# C03 — implicit geometry

> **이 챕터가 답하는 질문**: C02 의 파티클은 `MGeometry` 라는 *모양으로의 포인터 열*만 들고, 그 모양의 정체는 미뤄 뒀다. 그 모양은 대체 무엇인가? Box·구·convex·지형·triangle mesh처럼 생김새가 전혀 다른 것들을, Chaos 는 어떻게 *하나의 타입*으로 묶어 충돌 코드에 넘기는가?
> **대응 Concepts**: [04 — 충돌 검출(형상 표현·거리·법선)](../Concepts/04-collision-detection.md)
> **선행 챕터**: [C02 — 파티클·강체 표현](./C02-particle-rigid-body.md) (특히 §3 의 `MGeometry` 열, `FImplicitObjectPtr`)

---

## 왜 이 챕터를 네 번째로 읽는가

C02 에서 강체의 *상태*(위치·자세·질량)를 어떻게 저장하는지 봤다. 그런데 강체가 충돌하려면 상태만으로는 부족하다 — "이 몸이 공간에서 어떤 *부피*를 차지하는가"를 알아야 한다. 그 부피를 기술하는 것이 geometry이고, C02 §3 에서 파티클이 `MGeometry`(`FImplicitObjectPtr`) 한 칸으로 가리키던 바로 그 대상이다.

여기서 첫 번째 난관이 보인다. 충돌 파이프라인(C05~C07)은 Box와 구를, 구와 convex를, convex와 지형을… 모든 조합을 다뤄야 한다. 그런데 모양마다 클래스가 따로면, 충돌 코드가 모양 종류의 곱(N×N)만큼 분기해야 한다. Chaos 는 이걸 어떻게 피했는가?

C03 의 핵심 메시지도 한 문장이다 — **Chaos 는 모든 모양을 "부호 있는 거리 함수(signed distance function, SDF)"라는 단 하나의 인터페이스 뒤에 숨긴다.** Box든 triangle mesh든, 결국 "공간의 한 점 `x` 를 주면 표면까지의 부호 있는 거리와 그 방향(법선)을 돌려주는 함수"로 환원된다. 이 함수 하나만 있으면 충돌 코드는 모양의 구체적 종류를 몰라도 된다. 그 위에 **Scaled·Transformed·Union 같은 decorator**가 얹혀, 같은 모양을 복제 없이 변형·공유·합성한다. 이 두 가지(단일 SDF 인터페이스 + decorator 합성)가 C03 전체를 떠받친다.

> **"implicit"이란?** 모양을 꼭짓점·면의 *목록*(explicit/명시적)으로 적는 대신, 함수 `φ(x)` 의 *영점 등고면*(`φ(x)=0` 인 점들의 집합)으로 *암묵적*으로 정의한다는 뜻이다. 구라면 `φ(x)=|x−중심|−반지름`. 이 한 함수가 "안인지 밖인지(부호), 얼마나 떨어졌는지(크기), 어느 쪽인지(기울기=법선)"를 동시에 준다. 충돌 해소에 필요한 정보가 정확히 그 셋이다.

---

## 1. 모든 모양은 하나의 함수다 — `FImplicitObject` 와 `PhiWithNormal`

모든 geometry의 뿌리는 `FImplicitObject` 다 — `ImplicitObject.h:110`. 이 클래스는 `FChaosRefCountedObject` 를 상속하는데, 이 사실이 C02 와 곧장 맞물린다 — 파티클의 `MGeometry` 가 `FImplicitObjectPtr`(=`TRefCountPtr<FImplicitObject>`, `ImplicitFwd.h:32`)인 이유가 여기 있다. geometry는 **참조 카운트로 공유되는 불변 객체**다(§6·§8에서 그 의미가 커진다).

이 거대한 추상 클래스에서 **반드시 구현해야 하는 순수 가상 함수는 사실상 단 하나**다 — `ImplicitObject.h:251`:

```cpp
virtual FReal PhiWithNormal(const FVec3& x, FVec3& Normal) const = 0;
```

`Phi`(φ)는 점 `x` 에서 표면까지의 **부호 있는 거리** — 밖이면 양수, 안이면 음수, 표면이면 0. `Normal` 은 그 지점에서 표면이 향하는 방향. 이 한 함수가 모양의 *전부*를 정의한다. 나머지 인터페이스 — `SignedDistance(x)`(`:245`), `BoundingBox()`(`:266`), `Raycast`(`:299`), `Overlap`(`:372`) — 는 이 위에 파생되거나, 모양별로 더 빠른 버전을 덮어쓴다.

가장 단순한 예가 구다. `TSphere::PhiWithNormal`(`Sphere.h:84`)는 교과서의 SDF 정의 그 자체다:

```cpp
OutNormal = InSamplePoint - Center;          // 중심에서 점으로 향하는 벡터
return OutNormal.SafeNormalize() - GetRadiusf(); // 그 길이 − 반지름 = 부호 거리
```

(여기서 `SafeNormalize()` 는 `OutNormal` 을 제자리에서 단위벡터로 만들면서 *원래 길이*를 반환한다 — `Vector.h:567,775`. 그래서 `반환된 길이 − 반지름` 이 곧 부호 거리이고, 같은 호출이 `OutNormal` 에 법선까지 남긴다.) 중심에서 점까지 거리를 재고 반지름을 빼면 표면까지의 부호 거리, 그 방향을 정규화하면 법선. Box(`Box.h:162`)·평면(`Plane.h`)·capsule(`Capsule.h`)도 각자의 해석적 공식으로 같은 두 값을 돌려준다. **충돌 코드 입장에선 전부 똑같다 — `PhiWithNormal` 을 부를 뿐이다.** 이것이 N×N 분기를 무너뜨리는 추상화의 핵심이다(다만 실전 충돌은 거리만이 아니라 *support 함수*도 쓴다 — §3·C06).

---

## 2. 타입은 한 바이트 — 구상 종류와 wrapper 플래그가 한 칸에

SDF 인터페이스가 종류를 *감추*지만, 가끔은 종류를 *알아야* 한다(예: Box–Box 전용 빠른 경로). 그래서 모든 implicit object는 자기 종류를 1바이트로 들고 다닌다 — `EImplicitObjectType = uint8`(`ImplicitObjectType.h:42`). 이 바이트의 설계가 영리하다.

낮은 비트는 **구상(concrete) 종류**의 열거값이다 — `Sphere=0, Box, Plane, Capsule, Transformed, Union, LevelSet, …, Convex, …, TriangleMesh, HeightField, …`(`ImplicitObjectType.h:11~`). 높은 비트는 **wrapper 플래그**다:

```cpp
IsWeightedLattice = 1 << 5,
IsInstanced       = 1 << 6,
IsScaled          = 1 << 7
```

즉 "scale된 구"의 타입 바이트는 `Sphere | IsScaled` 한 값으로 표현된다 — 새 열거값을 만들 필요 없이, 구상 종류에 플래그를 OR 한다. 안쪽 구상 종류만 떼어내려면 `GetInnerType()`(`ImplicitObjectType.h:60`)이 플래그 비트를 마스크 아웃한다. (§6의 decorator가 이 플래그를 세운다.)

이 타입 바이트로 **안전한 다운캐스트**가 이뤄진다 — C02 의 파티클 핸들 캐스트와 똑같은 발상이다. `IsA<TSphere>()`(`ImplicitObject.h:124`)는 `TImplicitTypeInfo` 로 타입을 비교하고, `AsA<T>()`(`:131`)는 맞으면 캐스팅·아니면 nullptr 을 준다. 더 엄격한 `GetObject<T>()` 는 `T::StaticType() == Type` 를 직접 검사한다. 각 구상 클래스가 `static constexpr StaticType()` 를 제공하므로(예 `Convex.h:202`, `ImplicitObjectUnion.h:40`→`Union`), 컴파일타임 상수 한 번 비교로 끝난다. `GetType()` 자체는 그냥 저장된 `Type` 필드를 돌려준다(`ImplicitObject.cpp:67`, 필드는 `ImplicitObject.h:585`).

> C02 의 `EParticleType` 가 "어느 SOA 에 사는가"였다면, 여기 `EImplicitObjectType` 는 "어떤 모양이며 어떤 wrapper에 감싸였는가"다. 둘 다 1바이트 + 타입 기반 캐스트라는 같은 패턴을 쓴다.

---

## 3. primitive 동물원 — 해석적 SDF 와 볼록 다면체

구상 모양은 크게 두 부류로 갈린다.

**해석적 primitive.** 구(`Sphere.h:27`)·Box(`Box.h:22`)·평면(`Plane.h:13`)·capsule(`Capsule.h:22`)·cylinder(`Cylinder.h:14`)·tapered cylinder·capsule. 이들은 SDF 가 닫힌 수식으로 떨어진다 — §1 의 구처럼 몇 줄이면 `φ` 와 법선이 나온다. 그래서 가볍고 빠르고 정확하다. 동역학적으로 움직이는 강체의 충돌 형상은 대개 이 primitive(또는 그 Union)로 구성한다.

**볼록 다면체 `FConvex`**(`Convex.h:25`). 임의의 볼록 껍질(convex hull)을 표현한다. 내부적으로 면 평면 배열 `Planes`, 꼭짓점 배열 `Vertices`, 그리고 **`StructureData`**(half-edge 위상 구조, `ConvexStructureData.h`)를 든다. 단순 primitive와 결정적으로 다른 점은, 충돌이 `PhiWithNormal`(SDF)만으로 풀리지 않고 **support 함수**를 쓴다는 것이다 — `GetSupportVertex(Direction)`(`Convex.h:571`)와 `SupportCore`(`:734`)는 "주어진 방향으로 가장 멀리 있는 꼭짓점"을 돌려준다. 이 연산이 **GJK/EPA**(볼록 모양 두 개 사이 거리·관통을 support 함수만으로 반복 계산하는 표준 알고리즘 — C06)의 기본 질의이며, `StructureData` 의 half-edge 위상이 그 탐색을 빠르게 만든다. **support 함수의 본격적 쓰임은 C06(Narrow phase)** 의 몫이고, 여기서는 "볼록 모양은 SDF 외에 support 함수도 제공한다"는 사실만 챙긴다.

볼록인지 아닌지는 `bIsConvex` 플래그(`ImplicitObject.h:572`, `IsConvex()` `:277`)로 표시된다. 이게 중요한 이유 — **볼록 모양끼리는 GJK 같은 강력한 일반 알고리즘이 통하지만, 비볼록은 안 통한다.** 그래서 다음 부류가 따로 있다.

---

## 4. 비볼록 거구 — 지형과 triangle mesh

세상은 볼록하지 않다. 울퉁불퉁한 지형, 임의의 정적 레벨 mesh는 하나의 볼록 껍질로 담기지 않는다. Chaos 는 이들을 위한 전용 구상 타입을 둔다.

**`FHeightField`**(`HeightField.h:31`) — 높이값 격자로 표현하는 지형. 규칙적 grid라 "어느 cell 위에 있는가"를 O(1) 로 찾고 그 cell의 삼각형 두 개와만 검사하면 되므로, 넓은 지형을 싸게 다룬다.

**`FTriangleMeshImplicitObject`**(`TriangleMeshImplicitObject.h:489`) — 임의의 triangle soup(위상 정보 없이 삼각형만 잔뜩 모인 집합). 거대한 정적 충돌 mesh(건물·바위 등)에 쓴다. 삼각형이 수만 개일 수 있으므로 내부에 자체 가속 구조(BVH류)를 들고, 질의 시 bound로 후보 삼각형을 좁힌다.

이 둘은 `bIsConvex=false` 이고, 보통 **정적/키네마틱 파티클**(C02 §3 의 Static/Kinematic 컨테이너)의 형상으로만 쓴다 — 동적 강체끼리 비볼록-비볼록 충돌은 비싸고 불안정하기 때문이다(C02 의 "벽·바닥은 정적이면 충분"과 정확히 연결된다). 이들의 SDF·support 질의가 본질적으로 비싸다는 점이, 다음 챕터들에서 **bounding box와 공간 가속 구조**가 왜 필수인지의 동기가 된다(→ C04).

---

## 5. core와 margin — 둥글린 핵심이라는 trick

`FImplicitObject` 의 멤버 중 처음 보면 의아한 것이 `FRealSingle Margin`(`ImplicitObject.h:571`)이다. 모든 모양이 "margin"을 하나씩 든다.

발상은 이렇다: GJK 같은 볼록 충돌 알고리즘은 모양이 *완벽히 뾰족한 모서리·꼭짓점*을 가질 때 수치적으로 불안정해진다. 그래서 Chaos 는 모양을 **"줄어든 core + 둥글림 margin"** 으로 다룬다 — 실제 Box보다 살짝 작은 core Box를 두고, 그 표면을 margin 두께만큼 바깥으로 부풀려 둥근 모서리를 만드는 식이다. support 함수가 core에서 동작하고 margin을 더하면(`Convex` 의 `GetMarginAdjustedVertex` `Convex.h:617`), 모서리가 둥글려져 충돌이 강건해진다.

주의할 점(주석에 명시, `ImplicitObject.h:564~`): **모든 타입이 margin을 같은 의미로 쓰지 않는다.** 구에선 margin이 사실상 반지름 역할을 하는 식이라, `SetMargin` 은 함부로 노출하지 않고 파생 클래스가 필요할 때만 연다. margin이 실제 충돌 정확도·관통 깊이에 어떻게 들어가는지는 **C06·C07(narrow phase·충돌 솔버)** 에서 다시 본다. 여기서는 "모든 모양은 core + margin의 이중 표현을 가질 수 있고, 그건 GJK 강건성을 위한 장치"라는 구조만 챙긴다.

---

## 6. decorator — 복제 없이 변형·공유·합성하기

지금까지가 "잎(leaf) 모양"이라면, 이제 그것들을 *감싸* 재사용하는 층이다. 핵심 원리는 **원본 geometry를 복사하지 않고, 포인터로 감싼 뒤 질의를 가로채 변형한다**는 것이다(decorator 패턴). 네 가지가 있다.

**Instanced `FImplicitObjectInstanced`**(`ImplicitObjectScaled.h:20` — Scaled 와 같은 헤더에 산다. Scaled 가 Instanced 를 상속하는 친척이기 때문이다) — 하나의 geometry를 여러 body가 *공유*하게 한다. 같은 의자 mesh 1000개를 놓을 때, mesh는 한 벌만 두고 1000개의 instance가 그것을 가리킨다. §1 의 참조 카운트 공유가 이걸 가능하게 한다.

**Scaled `TImplicitObjectScaled`**(`ImplicitObjectScaled.h:446`) — 안쪽 객체 `MObject` 를 가리키고, 질의 시 좌표를 역scale·법선을 재scale해 *비균일 scale*을 입힌다. 타입 바이트에 `IsScaled` 를 OR 하고(`StaticType()` 이 `TConcrete::StaticType() | IsScaled`, `ImplicitObjectScaled.h:517`), margin은 `바깥 margin + 안쪽 margin` 으로 합친다(`:72`). 같은 Box mesh를 길쭉하게/납작하게 — 원본 복제 없이.

**Transformed `TImplicitObjectTransformed`**(`ImplicitObjectTransformed.h:36`) — 안쪽 객체에 *상대 변환*(`MTransform`)을 붙인다. 질의 점을 역변환해 안쪽으로 보내고 결과를 되돌린다. 한 강체 안에서 부분 형상을 제자리에 배치할 때 쓴다.

**Union `FImplicitObjectUnion`**(`ImplicitObjectUnion.h:26`) — 여러 하위 객체 `MObjects` 를 *하나의 합성 모양*으로 묶는다. 자동차처럼 여러 primitive로 이뤄진 body가 전형이다. 하위가 많으면 내부에 **BVH**(`FImplicitBVH`, `ImplicitObjectBVH.h`)를 선택적으로 켜서(`SetAllowBVH`/`RebuildBVH`, `ImplicitObjectUnion.h:64`) 질의 시 후보를 좁힌다 — 이 BVH 가 C04 공간 가속의 축소판이다. tree 순회는 `AccumulateAllImplicitObjects`(`:141`)가 부모 변환을 누적하며 잎까지 내려가는 식으로 이뤄진다.

이 네 decorator 덕에, Chaos 의 geometry는 작은 잎 모양들과 그것을 감싸는 wrapper들의 **tree**가 된다. 그리고 §2 의 타입 바이트가 "이 node가 잎인가, scale wrapper인가, Union인가"를 한 바이트로 알려준다.

---

## 7. C02·다음 챕터와의 접속

세 개의 실이 이 챕터에서 풀려 다음으로 이어진다.

- **C02 쪽으로**: 파티클의 `MGeometry`(`FImplicitObjectPtr`)는 이 챕터의 `FImplicitObject` tree의 *루트*를 가리킨다. 참조 카운트라서 여러 파티클(instance)이 같은 geometry를 공유하고, 파티클이 사라져도 다른 참조가 있으면 geometry는 산다.
- **C04 쪽으로**: `BoundingBox()`(`ImplicitObject.h:266`)·`HasBoundingBox()`·`CalculateTransformedBounds()`. 모든 충돌은 정밀한 SDF 질의 전에 **싼 bound 검사**로 후보를 거른다. 그 bound를 모아 만드는 공간 가속 구조(AABBTree·BV)가 C04 이고, Union 의 내장 BVH 가 그 예고편이다.
- **C06 쪽으로**: 볼록 모양의 **support 함수**(§3)와 **margin**(§5)은 GJK/EPA narrow phase 의 입력이다. `PhiWithNormal` 이 "이미 겹친 정도"를 준다면, support 함수는 "어떻게 겹쳤는가(접촉 다양체)"를 푸는 재료다.

---

## 8. 결정론·스레딩·성능 메모

- **geometry는 공유되는 불변 객체다.** `FChaosRefCountedObject` 기반 참조 카운트(`ImplicitObject.h:110`)로 여러 파티클·스레드가 한 geometry를 동시에 *읽는다*. 시뮬 도중 형상은 보통 바뀌지 않으므로(불변), 읽기 공유는 안전하고 메모리도 아낀다. 단 참조 카운트 증감 자체는 스레드 경계에서 주의 지점 — GT/PT 마샬링(C12·C14)에서 누가 소유·해제하는지가 문제가 된다.
- **margin·scale은 정밀도 손실 지점이다.** Scaled wrapper의 역scale/법선 재정규화(`ImplicitObject.h:542~`의 `ScaleNormalizedHelper` 류)와 margin 보정은 float 연산이라, C01·C02 에서 본 float↔double 경계와 같은 결정론 주의가 적용된다.
- **BVH 캐시는 빌드 순서에 의존한다.** Union 의 BVH(`RebuildBVH`)나 triangle mesh 내부 가속 구조는 한 번 만들어 캐시한다 — 같은 입력이라도 빌드 경로가 다르면 tree 구조가 달라질 수 있어, 질의 순서에 민감한 경로의 비트 재현성은 C13 에서 재검토한다.

---

## 9. 무엇을 들고 다음으로 가는가

세 문장으로 압축하면:

첫째, **모든 모양은 `FImplicitObject` 의 `PhiWithNormal`(부호 거리 + 법선) 하나로 환원된다** — 충돌 코드가 모양 종류를 몰라도 되게 만드는 단일 SDF 인터페이스다. 둘째, **종류는 1바이트(`EImplicitObjectType`)로, 구상 종류(저비트) + wrapper 플래그(고비트, IsScaled/IsInstanced)로 인코딩**되며, 타입 기반 캐스트(`IsA`/`AsA`)가 C02 핸들과 같은 패턴이다. 셋째, **geometry는 잎 모양(primitive·Convex·HeightField·TriMesh)과 decorator(Instanced·Scaled·Transformed·Union)의 참조 카운트 tree**이며, Union 의 내장 BVH 가 다음 챕터의 예고편이다.

다음은 **C04 — 공간 가속 구조**다. 이 챕터에서 "정밀한 SDF·support 질의는 비싸다"고 거듭 말했는데, 그 비싼 질의를 *소수의 후보로 좁히는* 자료구조가 C04 다. `BoundingBox()` 가 뱉는 AABB 들을 `TAABBTree`·`BoundingVolume`·`HierarchicalSpatialHash` 로 조직해, "수천 개 중 충돌 가능성 있는 쌍"만 추려 narrow phase 로 넘긴다. C03 이 "한 모양을 어떻게 기술하는가"였다면, C04 는 "수천 모양 중 누구와 누가 부딪힐 수 있는가를 어떻게 빨리 추리는가"다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 주장 | 앵커 |
|---|---|
| 모든 geometry의 뿌리 `FImplicitObject` = 참조 카운트 객체 | `Chaos/Public/Chaos/ImplicitObject.h:110` |
| 유일한 핵심 순수 가상 = `PhiWithNormal`(부호 거리 + 법선) | `ImplicitObject.h:251` |
| 파생 인터페이스: SignedDistance·BoundingBox·Raycast·Overlap | `ImplicitObject.h:245,266,299,372` |
| 구의 SDF 본문(교과서 정의) | `Chaos/Public/Chaos/Sphere.h:27,84` |
| Box PhiWithNormal | `Chaos/Public/Chaos/Box.h:22,162` |
| 타입 = uint8, 구상 종류(저비트) + wrapper 플래그(고비트) | `Chaos/Public/Chaos/ImplicitObjectType.h:11~,33~,42` |
| `GetInnerType` 가 플래그 마스크 아웃 | `ImplicitObjectType.h:60` |
| 타입 기반 캐스트 IsA/AsA/GetObject, StaticType 비교 | `ImplicitObject.h:124,131,199`; `ImplicitObject.cpp:67`; 필드 `:585` |
| EImplicitObject 플래그(IsConvex/HasBoundingBox/DisableCollisions) | `ImplicitObjectType.h:63~,67` |
| `FConvex`: Planes·Vertices·StructureData(half-edge) | `Chaos/Public/Chaos/Convex.h:25,47~50,202` |
| 볼록 support 함수(GJK용) GetSupportVertex/SupportCore | `Convex.h:571,734`; margin 보정 `:617` |
| 볼록 플래그 bIsConvex/IsConvex() | `ImplicitObject.h:572,277` |
| 비볼록: HeightField(격자 지형) | `Chaos/Public/Chaos/HeightField.h:31` |
| 비볼록: TriangleMesh(triangle soup + 내부 가속) | `Chaos/Public/Chaos/TriangleMeshImplicitObject.h:489` |
| core + margin(GJK 강건성), 타입마다 의미 다름 | `ImplicitObject.h:571,564~`; scale 법선 헬퍼 `:542` |
| decorator Instanced(공유) | `Chaos/Public/Chaos/ImplicitObjectScaled.h:20` |
| decorator Scaled(scale, 타입에 IsScaled OR, margin 합산) | `ImplicitObjectScaled.h:446,517,72` |
| decorator Transformed(상대 변환) | `Chaos/Public/Chaos/ImplicitObjectTransformed.h:36,56~59` |
| decorator Union(배열 + 선택적 BVH, tree 순회) | `Chaos/Public/Chaos/ImplicitObjectUnion.h:26,40,64,141` |
| Union 내장 BVH | `Chaos/Public/Chaos/ImplicitObjectBVH.h:15` |
| `FImplicitObjectPtr` = TRefCountPtr (C02 MGeometry 와 연결) | `Chaos/Public/Chaos/ImplicitFwd.h:32` |
