# 개체 기반 창발형 오픈월드 설계

## 1. 목표

이 설계의 목표는 현실 세계를 그대로 복제하는 것이 아니다.

대신 다음과 같은 세계를 만드는 것이다.

- 세계는 개체들의 총체로 표현된다.
- 시간의 흐름에 따라 개체의 상태가 변한다.
- 개체는 필요에 따라 더 작은 하위 개체들로 나뉠 수 있다.
- 물질은 고정된 타입이 아니라 구성, 구조, 상태의 조합으로 표현된다.
- 물질 간 상호작용은 공통 규칙으로 계산된다.
- 다양한 물질, 파괴, 혼합, 화학반응, 상전이, 생명 성장 등이 같은 기반 위에서 발생한다.
- 결과를 직접 정의하기보다, 기저 규칙으로부터 결과가 창발하도록 한다.

기본 관점은 다음과 같다.

> 게임 세계는 매 틱마다 개체들의 현재 상태를 읽고, 상호작용 결과를 계산해 다음 상태로 갱신하는 시스템이다.

---

# 2. 개체의 정의

개체는 단순히 이름이 붙은 오브젝트가 아니다.

> 개체는 일정한 경계를 가지고, 내부 상태를 유지하며, 다른 개체와 상호작용할 수 있는 계산 단위다.

예를 들어 다음은 모두 개체가 될 수 있다.

- 바위
- 돌 조각
- 물방울
- 물 웅덩이
- 철판
- 녹층
- 나무
- 세포
- 생명체
- 연기 구름
- 밀폐된 공간의 공기

개체의 최소 구조는 다음과 같다.

```cpp
struct Entity
{
    EntityId Id;

    EntityState State;

    EntityId Parent;
    Array<EntityId> Children;
    Array<RelationId> Relations;

    ResolutionLevel Resolution;
};
```

개체가 가지는 핵심 정보는 다음과 같다.

- 현재 상태
- 상위 개체
- 하위 개체
- 다른 개체와의 관계
- 현재 계산 해상도

---

# 3. 개체 계층

개체는 하위 개체들의 집합으로 구성될 수 있다.

```text
세계
└ 지역
   └ 산
      └ 바위
         └ 돌 조각
            └ 물질 단위
```

하지만 이 계층을 현실의 원자·분자·세포 구조와 정확히 일치시킬 필요는 없다.

계층을 나누는 기준은 다음이다.

> 하위 개체를 따로 계산해야 상호작용 결과가 달라지는가?

결과가 달라지지 않는다면 하나의 개체로 유지한다.

예를 들어 바위 전체가 하나처럼 움직일 때는 바위를 하나의 개체로 계산한다.

```text
바위 개체
```

충격으로 내부 차이가 중요해지면 필요한 부분만 나눈다.

```text
바위
├ 충격 영역
├ 균열 영역
└ 나머지 영역
```

완전히 깨지면 독립 개체가 된다.

```text
돌 조각 A
돌 조각 B
돌 조각 C
```

즉 계층은 고정된 구조가 아니라 필요에 따라 펼쳐지고 접히는 구조다.

---

# 4. 상위 개체와 하위 개체의 상태

상위 개체의 상태는 하위 개체 상태의 합 또는 요약이다.

질량은 다음과 같다.

\[
M = \sum_i m_i
\]

질량 중심은 다음과 같다.

\[
\mathbf{x} = \frac{\sum_i m_i\mathbf{x}_i}{\sum_i m_i}
\]

운동량은 다음과 같다.

\[
\mathbf{P} = \sum_i m_i\mathbf{v}_i
\]

에너지는 다음과 같다.

\[
E = \sum_i E_i
\]

중요한 점은 상위 개체와 하위 개체가 같은 물질을 중복 소유하면 안 된다는 것이다.

다음 두 방식 중 하나를 선택해야 한다.

```text
상위 상태 = 하위 상태의 캐시된 요약
```

또는

```text
상위 상태 = 실제 상태
하위 상태 = 필요할 때 복원되는 상세 표현
```

둘을 동시에 독립적인 실제 상태로 취급하면 질량과 에너지가 중복된다.

---

# 5. 큰 바위와 작은 돌무더기의 차이

큰 바위와 작은 돌 여러 개가 동일한 총질량과 조성을 가진다고 해도 데이터적으로는 다르다.

차이는 구성 요소 수가 아니라 구성 요소 사이의 관계다.

## 5.1 큰 바위

```text
조각 A ─ 강한 결합 ─ 조각 B
   │                    │
강한 결합           강한 결합
   │                    │
조각 C ─ 강한 결합 ─ 조각 D
```

특징:

- 상대 위치가 거의 고정된다.
- 힘이 전체 구조로 전달된다.
- 하나의 선속도와 각속도를 공유한다.
- 결합을 파괴해야 분리된다.
- 하나의 외곽 경계를 가진다.

## 5.2 돌무더기

```text
돌 A ─ 마찰 접촉 ─ 돌 B
돌 C      접촉 없음      돌 D
```

특징:

- 각 돌이 독립적으로 움직일 수 있다.
- 접촉 관계가 계속 바뀐다.
- 별도의 파괴 없이 흩어질 수 있다.
- 내부에 빈 공간이 존재한다.
- 각 돌이 독립적인 외곽 경계를 가진다.

이를 표현하기 위한 관계 데이터는 다음과 같다.

```cpp
struct Relation
{
    EntityId A;
    EntityId B;

    RelationType Type;

    float Strength;
    float Stiffness;
    float Friction;
    float BreakEnergy;
};
```

초기에는 관계 타입을 두 종류로 시작할 수 있다.

```cpp
enum class RelationType
{
    Bond,
    Contact
};
```

- `Bond`: 내부적으로 결합되어 있음
- `Contact`: 표면이 일시적으로 접촉함

개체 계층은 무엇으로 구성되어 있는지를 나타낸다.

관계는 왜 하나처럼 행동하는지를 나타낸다.

---

# 6. 개체의 생성

개체는 무에서 생성되는 것이 아니다.

> 기존 세계 상태에서 독립적으로 유지되고 상호작용할 수 있는 새로운 경계가 형성될 때 개체가 생성된다.

개체 생성은 크게 네 종류로 구분할 수 있다.

```cpp
enum class EntityCreationType
{
    Initial,
    Aggregate,
    Split,
    Refine
};
```

## 6.1 Initial

월드 초기 상태를 구성하기 위한 생성이다.

예:

- 지형
- 초기 바위
- 물
- 대기
- 생명 씨앗

## 6.2 Aggregate

여러 개체가 결합해 하나의 상위 개체를 형성한다.

```text
돌 조각 여러 개
→ 결합 증가
→ 상대 운동 감소
→ 안정된 경계 형성
→ 바위 개체 생성
```

## 6.3 Split

기존 개체의 결합이 끊어져 여러 독립 개체가 된다.

```text
바위
→ 결합 파괴
→ 돌 조각 A, B, C
```

## 6.4 Refine

요약 상태를 더 상세한 하위 개체로 펼친다.

```text
산 요약 개체
→ 바위 개체들
→ 광물 덩어리들
```

`Refine`은 물질이 새로 생성되는 것이 아니라 표현 해상도가 바뀌는 것이다.

개체 생성 조건은 다음과 같다.

- 외부와 구분되는 경계가 존재한다.
- 내부 결합이 외부 결합보다 강하다.
- 하나의 운동 단위처럼 행동한다.
- 일정 시간 이상 안정적으로 유지된다.

---

# 7. 물질의 표현

물질을 `Rock`, `Wood`, `Mud`, `Metal` 같은 고정 타입만으로 표현하면 창발성이 제한된다.

물질은 다음 네 요소로 표현하는 것이 좋다.

```text
물질 상태
= 구성 성분
+ 내부 구조
+ 현재 상태
+ 구성 요소 사이 관계
```

## 7.1 구성 성분

무엇이 얼마나 들어 있는지를 나타낸다.

초기에는 실제 주기율표 전체를 구현할 필요가 없다.

게임에서 의미 있는 기초 성분만 정의할 수 있다.

예:

- 수분 성분
- 광물 성분
- 금속 성분
- 유기 성분
- 섬유 성분
- 연료 성분
- 산화 성분
- 점결 성분
- 기체 성분

```cpp
struct Composition
{
    Map<SubstanceId, float> Amounts;
};
```

## 7.2 내부 구조

같은 성분이라도 내부 배열에 따라 물성이 달라진다.

```cpp
struct InternalStructure
{
    float Density;
    float Porosity;
    float Alignment;
    float Connectivity;
    float DefectRate;
    float GrainSize;
};
```

예:

- 나무: 섬유 방향성이 강함
- 유리: 균질하지만 균열 전파가 빠름
- 모래: 알갱이 내부 결합은 강하지만 알갱이 사이는 약함
- 스펀지: 기공률이 높음
- 금속: 내부 결합이 강하고 소성 변형이 가능함

## 7.3 현재 상태

물질의 성질은 환경에 따라 변한다.

```cpp
struct MaterialState
{
    float Temperature;
    float Pressure;
    float InternalEnergy;
    float Moisture;
    float Damage;
};
```

예를 들어 같은 흙도 다음처럼 달라진다.

```text
마른 흙
→ 부서지고 날림

젖은 흙
→ 뭉치고 점착성이 생김

수분이 매우 많은 흙
→ 진흙처럼 흐름

고온의 흙
→ 굳거나 녹음
```

---

# 8. 물질 속성의 표현

속성은 가능한 한 `Sticky`, `Hard`, `Burning` 같은 불리언으로 표현하지 않는다.

대신 원인이 되는 연속적인 물성을 저장하고, 결과적인 성질은 계산한다.

처음 구현할 핵심 속성은 다음과 같다.

```cpp
struct MaterialProperties
{
    float Density;

    float Cohesion;
    float Rigidity;
    float Viscosity;
    float Compressibility;

    float SurfaceTension;
    float ShapeMemory;

    float ThermalConductivity;
};
```

## 8.1 Cohesion

구성 요소가 서로 모여 있으려는 정도다.

- 낮음: 기체, 분말
- 중간: 액체
- 높음: 점액, 고체 구조

## 8.2 Rigidity

형태 변화를 견디는 정도다.

- 높음: 바위, 유리, 금속
- 낮음: 물, 공기

## 8.3 Viscosity

흐름과 내부 재배열에 저항하는 정도다.

- 낮음: 물
- 높음: 꿀, 진흙, 용암

## 8.4 Compressibility

압력에 의해 부피가 줄어드는 정도다.

- 낮음: 고체, 액체
- 높음: 기체

## 8.5 SurfaceTension

표면적을 줄이고 하나의 덩어리로 유지되려는 정도다.

- 물방울 형성
- 액체 합쳐짐
- 작은 액체 덩어리 유지

## 8.6 ShapeMemory

외력이 사라졌을 때 이전 형태로 돌아가려는 정도다.

- 고무: 높음
- 금속: 조건에 따라 중간
- 진흙: 낮음
- 물: 없음

---

# 9. 고체·액체·기체의 구분

고체·액체·기체를 서로 다른 개체 클래스로 만들지 않는다.

```cpp
class SolidEntity;
class LiquidEntity;
class GasEntity;
```

이 방식은 얼음이 녹거나 물이 증발할 때 타입 교체가 필요하고, 진흙·젤·용암 같은 중간 상태를 표현하기 어렵다.

대신 다음처럼 본다.

> 고체·액체·기체는 물질의 종류가 아니라 현재 상태에서 나타나는 운동과 변형 방식이다.

## 9.1 고체

- 일정한 형태를 유지한다.
- 일정한 부피를 유지한다.
- 구성 요소의 상대 위치가 지속된다.
- 전단력을 견딘다.
- 한계를 넘으면 변형되거나 깨진다.

```text
응집력 높음
강성 높음
형태 기억 높음
압축성 낮음
```

## 9.2 액체

- 부피는 거의 유지한다.
- 형태는 유지하지 않는다.
- 내부 배열이 계속 바뀔 수 있다.
- 흐름에 저항하는 점성이 있다.
- 표면장력을 가진다.

```text
응집력 중간 이상
강성 거의 없음
점성 존재
압축성 낮음
표면장력 존재
```

## 9.3 기체

- 형태를 유지하지 않는다.
- 부피를 유지하지 않는다.
- 가능한 공간으로 퍼진다.
- 쉽게 압축된다.
- 구성 요소 간 지속 결합이 거의 없다.

```text
응집력 매우 낮음
강성 없음
점성 낮음
압축성 높음
표면장력 거의 없음
```

---

# 10. 상을 enum 하나로 저장하지 않는 이유

물질은 한순간에 완전히 고체에서 액체로 바뀌지 않는다.

얼음이 녹는 중에는 고체와 액체가 동시에 존재한다.

따라서 다음 비율을 저장하는 것이 좋다.

```cpp
struct PhaseFractions
{
    float Solid;
    float Liquid;
    float Gas;
};
```

항상 다음을 만족한다.

\[
f_s + f_l + f_g = 1
\]

예:

```text
얼음
- 고체 1.0
- 액체 0.0
- 기체 0.0

녹는 얼음
- 고체 0.7
- 액체 0.3
- 기체 0.0

끓는 물
- 고체 0.0
- 액체 0.6
- 기체 0.4
```

대표 상은 편의를 위한 캐시 값으로 둘 수 있다.

```cpp
enum class DominantPhase
{
    Solid,
    Liquid,
    Gas
};
```

하지만 대표 상은 원인이 아니라 계산 결과다.

---

# 11. 물질 정의와 현재 상태의 분리

고정된 물질 특성과 현재 개체 상태를 분리해야 한다.

## 11.1 물질 정의

```cpp
struct MaterialDefinition
{
    MaterialId Id;

    float MeltingTemperature;
    float BoilingTemperature;

    float SpecificHeat;
    float FusionEnergy;
    float VaporizationEnergy;

    PhaseProperties SolidProperties;
    PhaseProperties LiquidProperties;
    PhaseProperties GasProperties;
};
```

## 11.2 현재 물질 인스턴스

```cpp
struct MaterialInstance
{
    MaterialId Material;

    float Mass;
    float InternalEnergy;
    float Temperature;
    float Pressure;

    PhaseFractions Fractions;
    MaterialProperties EffectiveProperties;
};
```

물질 정의는 어떤 조건에서 어떻게 변하는지를 나타낸다.

현재 상태는 지금 실제로 어떤 상태인지 나타낸다.

---

# 12. 상전이

상전이는 온도만 바꾸는 것이 아니라 내부 에너지와 결합 구조가 변하는 과정이다.

```text
고체 가열
→ 내부 에너지 증가
→ 녹는점 도달
→ 결합 일부 붕괴
→ 고체 비율 감소
→ 액체 비율 증가
```

상전이 중에는 들어온 에너지가 먼저 결합 구조를 바꾸는 데 사용될 수 있다.

예:

```text
얼음에 열 유입
→ 온도 상승
→ 녹는점 도달
→ 용융 에너지 소비
→ 얼음이 물로 변함
→ 완전히 녹은 뒤 다시 온도 상승
```

압력도 영향을 줄 수 있으므로 확장된 규칙은 다음과 같다.

```cpp
struct PhaseTransitionRule
{
    Phase From;
    Phase To;

    Curve TransitionTemperatureByPressure;
    float RequiredEnergy;
};
```

---

# 13. 혼합 상태의 유효 속성

고체·액체·기체가 함께 존재할 때 현재 물성은 각 상의 비율로부터 계산한다.

가장 단순한 방식은 다음과 같다.

\[
P_{effective}
=
 f_sP_s + f_lP_l + f_gP_g
\]

하지만 강성과 같은 일부 속성은 선형으로 변하지 않을 수 있다.

예를 들어 고체 구조가 연결되어 있는 동안에는 강성을 유지하다가, 연결 구조가 끊기는 순간 급격히 약해질 수 있다.

따라서 실제 구현에서는 곡선을 사용할 수 있다.

```cpp
effective.Rigidity =
    definition.RigidityBySolidFraction.Evaluate(
        fractions.Solid);
```

---

# 14. 화학 시스템의 기본 구조

화학반응을 표현하려면 다음 세 개념을 구분해야 한다.

```text
원소
- 반응 전후에도 보존되는 기본 재료

화학종
- 원소들이 특정 결합 구조를 가진 상태

물질 개체
- 여러 화학종이 특정 공간에서 섞이고 배열된 것
```

예:

```text
원소: Fe, O, H
화학종: Fe, O₂, H₂O, Fe₂O₃
물질 개체: 철판, 녹슨 철판, 물, 습한 공기
```

화학반응은 개체를 다른 클래스로 교체하는 것이 아니다.

> 개체 내부 또는 개체 사이의 화학종 양과 결합 구조가 바뀌는 과정이다.

---

# 15. 화학종과 원소 보존

각 화학종은 어떤 원소로 구성되는지 정의한다.

```cpp
struct SpeciesDefinition
{
    SpeciesId Id;

    Map<ElementId, int> ElementCounts;
    BondGraph Bonds;

    float FormationEnergy;
    float Density;
    float MeltingPoint;
};
```

예:

```text
H₂O
- H: 2
- O: 1

Fe₂O₃
- Fe: 2
- O: 3
```

화학반응 전후에는 각 원소의 총량이 보존되어야 한다.

```text
반응 전 철 원자 수 = 반응 후 철 원자 수
반응 전 산소 원자 수 = 반응 후 산소 원자 수
```

---

# 16. 화학반응 데이터

초기 구현은 반응식 기반이 적절하다.

```cpp
struct ReactionDefinition
{
    Map<SpeciesId, float> Reactants;
    Map<SpeciesId, float> Products;

    float ActivationEnergy;
    float EnergyDelta;

    float MinTemperature;
    float BaseReactionRate;

    Optional<SpeciesId> Catalyst;
};
```

예를 들어 철의 산화를 단순화하면 다음과 같다.

```text
철 + 산소 + 물
→ 녹
```

실제 반응은 더 복잡하지만 게임에서는 하나의 `Rust` 화학종으로 추상화할 수 있다.

---

# 17. 반응 조건과 반응 속도

반응식이 가능하다고 항상 반응하는 것은 아니다.

다음 조건을 확인해야 한다.

- 필요한 반응물이 존재하는가
- 온도가 충분한가
- 압력이 적절한가
- 반응물끼리 접촉하는가
- 촉매가 존재하는가
- 반응이 진행될 시간이 있었는가

반응 속도는 개념적으로 다음과 같이 계산할 수 있다.

\[
r
=
k(T)
\times C_A
\times C_B
\times A_{contact}
\]

여기서:

- `k(T)`: 온도에 따른 반응 속도
- `C_A`, `C_B`: 반응물의 농도 또는 양
- `A_contact`: 접촉 면적

게임 구현 예시는 다음과 같다.

```cpp
float CalculateReactionAmount(
    const ReactionDefinition& reaction,
    const ChemicalContext& context,
    float deltaTime)
{
    float available =
        CalculateLimitingReactant(reaction, context);

    float temperatureFactor =
        CalculateTemperatureFactor(
            context.Temperature,
            reaction.ActivationEnergy);

    float catalystFactor =
        context.HasCatalyst ? context.CatalystFactor : 1.0f;

    return Min(
        available,
        reaction.BaseReactionRate
        * temperatureFactor
        * context.ContactArea
        * catalystFactor
        * deltaTime);
}
```

---

# 18. 녹이 스는 과정

철 개체와 주변 공기·수분이 접촉한다고 가정한다.

```text
철 개체
- Fe

주변 공기
- O₂
- H₂O
```

매 틱 다음을 처리한다.

```text
1. 철 표면과 주변 개체의 접촉 확인
2. 철, 산소, 물의 양 확인
3. 반응 온도와 촉매 조건 확인
4. 반응량 계산
5. 반응물 감소
6. 녹 화학종 생성
7. 반응열 반영
8. 표면 물성 갱신
```

데이터 변화는 다음과 같다.

```cpp
iron.FeAmount -= consumedIron;
air.OxygenAmount -= consumedOxygen;
air.WaterAmount -= consumedWater;

iron.RustAmount += producedRust;
```

처음에는 철 개체 표면의 조성 변화로만 표현한다.

```text
철판
- 내부: 철
- 표면: 녹
```

녹층이 충분히 두꺼워지면 하위 개체가 될 수 있다.

```text
철판
├ 철 본체
└ 녹층
```

녹층이 떨어지면 독립 개체가 된다.

```text
철판 개체
녹 조각 개체
녹 가루 개체
```

---

# 19. 새로운 물질이 만들어지는 방식

새로운 물질은 하나의 의미만 가지지 않는다.

## 19.1 새로운 화학종

원자 결합이 바뀐다.

```text
수소 + 산소
→ 물
```

## 19.2 혼합물

화학종은 그대로지만 서로 섞인다.

```text
물 + 소금
→ 소금물
```

## 19.3 합금

여러 금속이 섞여 새로운 내부 배열과 물성을 형성한다.

```text
금 + 구리
→ 금-구리 합금
```

## 19.4 결정화와 침전

용액 속 물질이 고체 구조를 형성한다.

```text
용액 속 화학종
→ 결정 핵 생성
→ 결정 성장
→ 고체 개체 형성
```

따라서 새로운 물질은 다음 중 하나 이상이 변한 결과다.

```text
새로운 화학종
새로운 혼합비
새로운 상
새로운 결정 구조
새로운 미세 구조
```

---

# 20. 미리 정의된 반응과 창발적 반응

## 20.1 미리 정의된 화학종 방식

가능한 화학종과 반응을 데이터로 정의한다.

장점:

- 안정적이다.
- 성능 예측이 쉽다.
- 밸런싱이 쉽다.
- 디버깅이 쉽다.

단점:

- 정의되지 않은 분자는 생성되지 않는다.

## 20.2 결합 그래프 생성 방식

분자를 원소 노드와 결합 간선의 그래프로 표현한다.

```cpp
struct Molecule
{
    Array<Atom> Atoms;
    Array<ChemicalBond> Bonds;
};
```

반응은 기존 결합을 끊고 새로운 결합을 만드는 과정이 된다.

장점:

- 정의되지 않은 화학종도 생성될 수 있다.
- 높은 창발성을 얻을 수 있다.

단점:

- 경우의 수가 폭발한다.
- 안정성 판단이 어렵다.
- 성능과 디버깅 비용이 크다.

## 20.3 권장 방식

오픈월드 게임에서는 혼합 방식이 적절하다.

```text
주요 반응
- 미리 정의된 반응식 사용

희귀하거나 실험적인 반응
- 제한된 결합 문법으로 생성
```

즉:

```text
미리 정의된 주요 화학종
+
제한된 규칙으로 생성되는 화학종
```

---

# 21. 상 변화와 개체 생성의 분리

상 변화와 개체 생성은 같은 일이 아니다.

```text
상 변화
= 개체 내부 상태 변화

개체 생성
= 물질 경계가 새로 형성되는 변화
```

예를 들어 얼음이 녹는 동안에는 하나의 개체 안에서 고체와 액체 비율이 변할 수 있다.

```text
얼음 개체
→ 고체 70%, 액체 30%
```

녹은 물이 흘러 떨어질 때 새로운 물방울 개체가 생성된다.

```text
얼음 개체의 액체 질량 감소
→ 물방울 개체 생성
```

화학반응도 마찬가지다.

```text
화학종 생성
→ 특정 위치에 축적
→ 독립적인 경계 형성
→ 새로운 개체 생성
```

---

# 22. 틱 처리 구조

개체 중심으로 단순화한 기본 틱은 다음과 같다.

```text
1. 활성 개체 선택
2. 주변 개체와 관계 확인
3. 접촉과 결합 갱신
4. 힘과 운동 계산
5. 열 전달 계산
6. 상전이 계산
7. 화학반응 후보 검색
8. 반응량 계산 및 적용
9. 물성 재계산
10. 결합 생성·파괴 처리
11. 개체 병합·분리 판단
12. 상위 개체 상태 갱신
13. 필요하면 해상도 상승·하강
```

개념적인 코드는 다음과 같다.

```cpp
void TickEntity(Entity& entity, float deltaTime)
{
    UpdateRelations(entity, deltaTime);
    UpdateMotion(entity, deltaTime);
    UpdateHeatTransfer(entity, deltaTime);
    UpdatePhaseState(entity, deltaTime);
    UpdateChemistry(entity, deltaTime);
    UpdateMaterialProperties(entity);

    TryBreakBonds(entity);
    TrySplitEntity(entity);
    TryAggregateEntity(entity);
    TryChangeResolution(entity);
}
```

---

# 23. 오픈월드 규모를 위한 해상도

오픈월드 전체의 모든 하위 개체를 항상 계산할 수는 없다.

따라서 개체는 요약 상태와 상세 상태를 오갈 수 있어야 한다.

## 요약 상태

```text
총질량
평균 조성
평균 온도
평균 상 비율
평균 구조
전체 강도
손상도
```

## 상세 상태

```text
하위 개체
개별 결합
부분별 온도
부분별 화학 조성
균열
국소 반응
```

평소에는 다음처럼 계산한다.

```text
바위 하나
```

충격이나 열, 화학반응이 발생하면 필요한 부분만 펼친다.

```text
바위
├ 충격 영역
├ 가열 영역
├ 녹은 영역
└ 안정 영역
```

안정되면 다시 요약 상태로 병합한다.

해상도 변화 전후에는 다음이 보존되어야 한다.

```text
질량
운동량
에너지
각 원소의 총량
```

---

# 24. 최초 구현을 위한 최소 데이터 모델

```cpp
struct EntityState
{
    float Mass;

    Transform Transform;
    Vector3 LinearVelocity;
    Vector3 AngularVelocity;

    float InternalEnergy;
    float Temperature;
    float Pressure;

    Composition Composition;
    InternalStructure Structure;
    PhaseFractions Phase;
    MaterialProperties Properties;

    float Damage;
    float Integrity;
};
```

```cpp
struct Entity
{
    EntityId Id;
    EntityState State;

    EntityId Parent;
    Array<EntityId> Children;
    Array<RelationId> Relations;

    ResolutionLevel Resolution;
};
```

```cpp
struct Relation
{
    EntityId A;
    EntityId B;

    RelationType Type;

    float Strength;
    float Stiffness;
    float Friction;
    float BreakEnergy;
};
```

```cpp
struct ChemicalState
{
    Map<SpeciesId, float> Amounts;
};
```

---

# 25. 단계별 구현 순서

## 1단계: 개체와 관계

- 개체 생성과 제거
- 부모·자식 구조
- 결합과 접촉
- 병합과 분리
- 질량과 운동량 보존

목표:

```text
큰 바위와 돌무더기를 구분할 수 있다.
바위가 깨져 돌 조각이 될 수 있다.
```

## 2단계: 기본 물성

- 밀도
- 응집력
- 강성
- 점성
- 압축성
- 표면장력
- 형태 기억

목표:

```text
바위, 물, 공기, 진흙, 슬라임을 같은 시스템으로 구분할 수 있다.
```

## 3단계: 열과 상전이

- 내부 에너지
- 온도
- 열전도
- 고체·액체·기체 비율
- 용융과 기화

목표:

```text
얼음이 녹고, 물이 끓고, 용암이 식어 굳을 수 있다.
```

## 4단계: 화학반응

- 원소
- 화학종
- 반응식
- 활성화 에너지
- 촉매
- 반응열

목표:

```text
철이 녹슬고, 물질이 타고, 새로운 생성물이 만들어질 수 있다.
```

## 5단계: 구조와 미세 배열

- 기공률
- 섬유 방향
- 결정 구조
- 균열 전파
- 내부 통로

목표:

```text
나무, 유리, 금속, 모래가 같은 성분만으로는 구분되지 않는 구조적 차이를 가진다.
```

## 6단계: 생명

- 경계 유지
- 물질 흡수
- 대사
- 성장
- 항상성
- 복제

목표:

```text
생명체가 외부 물질을 흡수해 자신의 하위 개체를 만들고 성장할 수 있다.
```

---

# 26. 설계의 핵심 원칙

## 원칙 1

개체는 물질의 최소 단위가 아니라 현재 계산에 필요한 경계 단위다.

## 원칙 2

큰 개체와 작은 개체는 동일한 구조를 사용한다.

## 원칙 3

계층은 고정하지 않고 필요할 때 펼치고 접는다.

## 원칙 4

개체 계층과 결합 관계를 분리한다.

```text
계층
- 무엇으로 구성되어 있는가

관계
- 왜 하나처럼 행동하는가
```

## 원칙 5

물질은 타입이 아니라 구성, 내부 구조, 상태, 관계의 조합이다.

## 원칙 6

고체·액체·기체는 별도 클래스가 아니라 현재 물성의 결과다.

## 원칙 7

화학반응은 개체 교체가 아니라 화학종과 결합 구조의 변화다.

## 원칙 8

상 변화와 개체 생성은 분리한다.

## 원칙 9

모든 해상도 변화와 반응에서 보존량을 유지한다.

```text
질량
운동량
에너지
원소량
```

## 원칙 10

결과를 직접 코딩하기보다 공통 규칙을 조합한다.

```text
UpdateRock()
UpdateMud()
UpdateSlime()
```

같은 물질별 전용 처리보다 다음과 같은 공통 처리를 사용한다.

```text
결합 형성
결합 파괴
변형
흐름
열 전달
상전이
화학반응
개체 병합
개체 분리
```

---

# 27. 최종 구조

전체 설계는 다음과 같이 요약된다.

```text
세계
└ 개체들
   ├ 상태
   │  ├ 질량과 운동
   │  ├ 내부 에너지
   │  ├ 화학 조성
   │  ├ 내부 구조
   │  ├ 상 비율
   │  └ 유효 물성
   │
   ├ 하위 개체
   ├ 상위 개체
   ├ 관계
   │  ├ 결합
   │  └ 접촉
   │
   └ 계산 해상도
```

틱마다 다음이 계산된다.

```text
현재 상태
+ 주변 개체
+ 개체 관계
+ 외부 에너지와 힘
+ 화학반응 규칙
=
다음 상태
```

이를 통해 다음과 같은 결과를 같은 기반 위에서 표현할 수 있다.

- 큰 바위와 돌무더기
- 파괴와 균열
- 물의 흐름과 기체 확산
- 진흙과 슬라임
- 얼음의 용융과 물의 기화
- 철의 산화
- 연소와 폭발
- 합금과 결정화
- 물질을 흡수해 성장하는 생명체

최종 목표는 모든 현실 물질을 정확히 재현하는 것이 아니다.

> 적은 수의 일관된 기저 규칙으로부터 플레이어가 납득할 수 있는 다양한 물질과 현상이 창발하도록 만드는 것이다.
