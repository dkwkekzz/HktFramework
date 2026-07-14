# 개체 기반 창발형 세계 시뮬레이션 구현 설계

## 1. 문서 목적

이 문서는 개체 기반 창발형 오픈월드를 실제 서버·클라이언트 구조로 구현하기 위한 기본 설계를 정리한다.

이 시스템은 서버가 세계의 모든 미시 상태를 보유한다는 전제를 사용하지 않는다. 대신 서버는 다음 정보만 권위 있게 관리한다.

- 질량, 에너지, 운동량, 원소량 등의 보존량
- 온도, 압력, 조성, 상 비율 등의 거시 상태
- 플레이어나 시뮬레이션에 의해 확정된 구조적 사실
- 아직 구체화되지 않은 상세 상태의 가능 범위
- 상태를 변화시킨 인과적 사건의 이력
- 관찰 또는 상호작용 시 상세 상태를 생성하기 위한 규칙과 시드

클라이언트는 관찰되는 영역을 서버의 제약 조건 안에서 상세화하고, 시각·물리·화학 표현을 생성한다. 중요한 상호작용 결과는 서버가 검증하여 거시 상태와 확정 사실로 다시 환원한다.

---

# 2. 핵심 세계관

## 2.1 세계는 완전한 미시 상태로 존재하지 않는다

관찰되지 않은 바위 내부의 모든 결정, 미세 균열, 입자 위치를 서버가 미리 저장하지 않는다.

서버가 보유하는 바위 상태는 다음과 같은 형태다.

```text
질량: 1,000 kg
부피: 380 L
원소 조성:
- 규소계 65%
- 금속계 20%
- 기타 15%

평균 온도: 21℃
온도 분산: 낮음
손상도: 0.12
기공률: 0.04
주요 균열: 1개
표현 불확실성: 높음
```

이 상태는 하나의 정확한 내부 배치를 의미하지 않는다. 이 조건을 만족하는 가능한 상세 상태들의 집합을 의미한다.

```text
권위 있는 세계 상태
= 보존량
+ 거시 상태
+ 확정 사실
+ 가능한 상세 상태의 제약
```

## 2.2 관찰은 상세 상태의 조회가 아니라 해석이다

관찰이 시작되면 서버에 숨겨져 있던 상세 상태를 다운로드하는 것이 아니다.

클라이언트는 다음 입력을 이용해 필요한 영역을 구체화한다.

```text
거시 상태
+ 보존량 예산
+ 경계 조건
+ 확정된 구조
+ 생성 시드
+ 생성기 버전
+ 관찰 해상도
```

따라서 관찰은 다음 과정이다.

```text
거시 상태
→ 가능한 상세 상태 생성
→ 제약 조건 검사
→ 관찰용 표현 확정
```

## 2.3 상호작용은 일부 상세를 세계의 확정 사실로 만든다

관찰만으로 생성된 미세한 표면 돌기나 먼지는 권위 있는 상태가 아니다.

그러나 플레이어가 바위에 구멍을 뚫거나, 나무의 가지를 자르거나, 문을 부수면 해당 결과는 이후에도 유지되어야 한다.

```text
장식적 상세
→ 관찰이 끝나면 폐기 가능

통계적 상세
→ 거시 수치로 압축

인과적으로 중요한 상세
→ 확정 사실 또는 구조적 앵커로 저장
```

---

# 3. 서버 권위 상태

## 3.1 전체 구조

```cpp
struct AuthoritativeMacroState
{
    EntityId Id;
    uint64_t Version;

    ConservedState Conserved;
    ThermodynamicSummary Thermodynamics;
    CompositionSummary Composition;
    StructureSummary Structure;

    std::vector<CommittedFact> Facts;
    UnresolvedState Unresolved;

    SpatialBounds Bounds;
    SimulationTimestamp LastUpdatedAt;
};
```

## 3.2 보존 상태

보존 상태는 상세화와 거시화 과정에서 절대 중복되거나 손실되면 안 된다.

```cpp
struct ConservedState
{
    double Mass;
    Vector3 Momentum;
    double TotalEnergy;
    double ElectricCharge;

    ElementAmounts Elements;
};
```

기본 보존 조건:

```text
상세화 전 총질량 = 상세화 후 하위 상태의 총질량
상세화 전 총에너지 = 상세화 후 하위 상태의 총에너지
상세화 전 운동량 = 상세화 후 하위 상태의 총운동량
상세화 전 각 원소량 = 상세화 후 각 원소량의 합
```

상위 개체와 하위 상세 상태가 동시에 질량을 소유하면 안 된다.

## 3.3 열역학적 거시 상태

평균값만 저장하면 임계 현상을 잃을 수 있으므로 분포 요약을 포함한다.

```cpp
struct ScalarDistributionSummary
{
    double Mean;
    double Variance;
    double Minimum;
    double Maximum;

    double AboveCriticalFraction;
    Vector3 MainGradient;
    double CorrelationLength;
};

struct ThermodynamicSummary
{
    double Volume;

    ScalarDistributionSummary Temperature;
    ScalarDistributionSummary Pressure;
    ScalarDistributionSummary Density;

    PhaseFractions Phases;

    double PhysicalEntropy;
};
```

예를 들어 평균 온도가 낮더라도 일부 영역이 발화 온도를 넘었을 수 있다.

```text
평균 온도: 80℃
최대 온도: 620℃
발화 온도 이상 비율: 3%
```

이 정보가 있어야 관찰되지 않는 영역의 연소 가능성을 유지할 수 있다.

## 3.4 조성 상태

원소량과 화학종 요약을 구분한다.

```cpp
struct CompositionSummary
{
    ElementAmounts Elements;
    SpeciesAmounts MajorSpecies;

    double MixtureHomogeneity;
    Vector3 MainCompositionGradient;
    double ReactiveFraction;
};
```

- `Elements`: 보존 검증의 기준
- `MajorSpecies`: 현재 화학 상태를 계산하기 위한 요약
- `MixtureHomogeneity`: 얼마나 균일하게 섞여 있는가
- `ReactiveFraction`: 현재 반응 가능한 물질의 비율

## 3.5 구조 상태

```cpp
struct StructureSummary
{
    double Integrity;
    double Porosity;
    double Connectivity;
    double DefectDensity;

    Vector3 MainAlignment;
    Vector3 MainStressDirection;
    Vector3 WeakestDirection;

    std::vector<StructuralAnchor> MajorFeatures;
};
```

`MajorFeatures`는 반드시 다시 생성되어야 하는 구조다.

```text
큰 균열
절단면
구멍
통로
부러진 가지
문
경첩
관절
플레이어가 설치한 구조물
```

모든 미세 균열과 결함을 저장하는 것은 아니다.

## 3.6 미확정 상태

```cpp
struct UnresolvedState
{
    GeneratorId Generator;
    uint32_t GeneratorVersion;
    uint64_t GenerationSeed;

    double RepresentationUncertainty;
    double MinimumDetailScale;
    double MaximumDetailScale;
};
```

`RepresentationUncertainty`는 물리적 엔트로피와 다르다.

```text
PhysicalEntropy
- 실제 세계 내부의 에너지 분산과 비가역성

RepresentationUncertainty
- 서버가 미세 상태를 아직 결정하지 않은 정도
```

---

# 4. 확정 사실과 구조적 앵커

## 4.1 확정 사실

```cpp
struct CommittedFact
{
    FactId Id;
    FactType Type;

    EntityId Entity;
    SpatialRegion Region;
    SimulationTimestamp Time;

    StateDelta MacroDelta;
    std::optional<StructuralAnchor> Anchor;

    EventId CauseEvent;
};
```

예시:

```text
이 위치의 물질 5 kg이 채굴됨
이 절단면을 따라 개체가 분리됨
이 영역이 불탔음
이 생명체의 기관이 손실됨
이 문이 열린 상태로 고정됨
```

## 4.2 구조적 앵커

```cpp
struct StructuralAnchor
{
    AnchorId Id;
    AnchorType Type;

    LocalTransform Transform;
    SpatialShape Shape;

    MaterialConstraint Material;
    double Persistence;
};
```

앵커는 상세화할 때 반드시 반영된다.

예를 들어 바위에 뚫린 구멍이 있다면 어떤 시드로 다시 상세화하더라도 그 구멍은 유지되어야 한다.

---

# 5. 시뮬레이션 해상도

## 5.1 시뮬레이션 LOD의 의미

시뮬레이션 LOD는 단순히 계산 빈도를 낮추는 개념이 아니다. 해상도에 따라 사용하는 상태 표현과 모델 자체가 달라진다.

```text
LOD 0: 통계적 영역
LOD 1: 단일 거시 개체
LOD 2: 구조적 부품 그래프
LOD 3: 물질 셀
LOD 4: 국소 미세 표현
```

## 5.2 LOD 0 — 통계적 영역

```text
숲
- 총 생물량
- 수분 분포
- 평균 연령
- 종 구성
- 화재 진행 방향
- 질병률
```

개별 나무는 존재하지 않을 수 있다.

## 5.3 LOD 1 — 거시 개체

```text
바위
- 총질량
- 평균 조성
- 전체 운동
- 평균 온도
- 손상도
- 주요 균열
```

일반적인 이동과 단순 충돌은 이 수준에서 처리한다.

## 5.4 LOD 2 — 구조 그래프

```text
나무
├ 줄기
├ 뿌리
├ 큰 가지 A
└ 큰 가지 B
```

부품 사이의 결합과 힘 전달, 구조적 파괴가 중요할 때 사용한다.

## 5.5 LOD 3 — 물질 셀

```text
표면 셀
내부 셀
고온 셀
균열 주변 셀
```

다음 현상에 사용한다.

- 부분적 열 전달
- 표면 산화
- 액체 침투
- 국소 화학반응
- 균열 전파
- 상 변화

## 5.6 LOD 4 — 미세 표현

아주 짧은 시간과 좁은 영역에만 사용한다.

```text
절단 지점
폭발 중심
정밀 제작 영역
실험적 화학반응
생명체의 핵심 기관
```

서버 전체 세계에서 상시 유지하지 않는다.

---

# 6. 활성 표현과 상태 소유권

## 6.1 단일 소유권 원칙

한 시점에 하나의 상태 표현만 보존량을 소유하고 수정할 수 있어야 한다.

```text
부모 거시 상태 활성
→ 자식 상세 상태는 비활성 또는 미존재

자식 상세 상태 활성
→ 부모 상태는 읽기 전용 요약
```

이를 위반하면 질량과 에너지가 중복된다.

## 6.2 Active Frontier

개체 계층에서 현재 실제 계산을 담당하는 노드 집합을 `Active Frontier`라고 정의한다.

```text
산
├ 바위 A
├ 바위 B
└ 바위 C
```

가능한 활성 상태:

```text
산 전체가 거시적으로 활성
```

또는:

```text
바위 A: 거시 활성
바위 B: 상세 활성
바위 C: 거시 활성
산: 읽기 전용 요약
```

---

# 7. 관찰과 상세화 계약

## 7.1 상세화 계약

서버는 클라이언트에 임의의 상세 상태 생성 권한을 주지 않는다.

```cpp
struct RefinementContract
{
    ContractId Id;

    EntityId Entity;
    uint64_t BaseVersion;

    SpatialRegion TargetRegion;
    SimulationLevel AllowedLevel;

    ConservedState RegionBudget;
    BoundaryConditions Boundary;

    std::vector<StructuralAnchor> RequiredAnchors;

    uint64_t RefinementSeed;
    uint32_t GeneratorVersion;

    ErrorTolerance AllowedError;
    SimulationTimestamp ExpireAt;
};
```

## 7.2 상세화 계약의 의미

```text
이 영역 안에는 질량이 얼마 존재한다
원소 조성은 무엇이다
내부 에너지는 얼마다
경계에서 열과 물질이 어떻게 교환된다
이 균열과 구멍은 반드시 유지되어야 한다
어느 해상도까지 구체화할 수 있다
허용 가능한 보존 오차는 얼마다
```

## 7.3 상세화 과정

```text
1. 관찰 또는 상호작용 요청 발생
2. 서버가 대상 영역과 필요한 해상도 결정
3. 대상 영역에 보존량 예산 할당
4. 기존 앵커와 확정 사실 전달
5. 클라이언트가 상세 구조 생성
6. 열역학·구조 제약을 만족하도록 보정
7. 시각·물리·화학 Proxy 생성
```

상세화 결과는 반드시 계약 예산을 만족해야 한다.

## 7.4 결정적 공유 상세와 로컬 상세

여러 클라이언트가 같은 개체를 볼 때 모든 시각 디테일이 같을 필요는 없다.

```text
공유 상세
- 충돌 표면
- 주요 균열
- 자원 위치
- 절단 가능한 구조
- 통로와 구멍

로컬 상세
- 작은 표면 돌기
- 미세 먼지
- 작은 파편
- 연기 난류
- 장식적 색 변화
```

공유 상세 생성 키:

```text
EntityId
+ RegionId
+ StateVersion
+ GeneratorVersion
+ RefinementSeed
```

로컬 상세는 여기에 클라이언트 로컬 시드를 추가할 수 있다.

---

# 8. 관찰되지 않는 영역의 시간 진행

## 8.1 거시 전이

관찰되지 않는 영역은 상세 시뮬레이션 대신 거시 전이 함수로 진행한다.

```cpp
MacroState AdvanceMacroState(
    const MacroState& current,
    const ExternalFlux& external,
    Duration dt,
    RandomStream& stochastic);
```

개념적으로:

```text
다음 거시 상태
= 현재 거시 상태
+ 외부 유입과 유출
+ 거시 반응
+ 확률적이지만 적법한 변화
```

확률적 변화도 반드시 보존 법칙을 만족해야 한다.

## 8.2 관찰되지 않는 녹 발생 예

입력:

```text
철 원소량
산소 노출량
수분량
평균 온도
표면적
현재 녹 비율
```

거시 결과:

```text
철 화학종 감소
산화물 증가
산소 감소
구조 강도 감소
표면 손상 증가
에너지 변화
```

정확히 어느 위치에 녹이 생겼는지는 아직 정하지 않는다.

관찰 시 다음 조건을 반영해 배치한다.

```text
수분 노출 방향
공기 접촉 표면
중력 방향
기존 균열
열 분포
```

## 8.3 멀리 있는 화재 예

서버는 개별 나무의 불꽃을 계산하지 않는다.

```text
화재 영역
연소 물질량
방출 열량
연기량
바람 방향
수분 분포
확산 속도
```

플레이어가 접근하면 이 거시 결과를 만족하도록 다음을 구체화한다.

```text
불탄 나무 분포
현재 타고 있는 나무
연기 기둥
숯과 재
국소 온도
```

---

# 9. 상호작용 처리

## 9.1 개체 직접 수정 금지

상호작용 중 한 개체가 다른 개체의 상태를 즉시 수정하면 처리 순서에 따라 결과가 달라진다.

```cpp
// 지양
entityA.Modify(entityB);
entityB.Modify(entityA);
```

모든 상호작용은 변화 제안으로 생성한다.

## 9.2 변화 제안

```cpp
struct ProposedTransition
{
    EventId ProposalId;

    std::vector<EntityId> Participants;
    uint64_t BaseVersion;

    SpatialRegion AffectedRegion;

    StateDelta MacroDelta;
    std::vector<TopologyOperation> TopologyChanges;
    std::vector<StructuralAnchor> NewAnchors;

    ConservationReport Conservation;
};
```

## 9.3 최소 상태 전이 정보

에너지 변화만으로는 결과를 표현할 수 없다.

같은 에너지도 다음처럼 사용될 수 있다.

```text
열
운동
변형
균열
상 변화
화학 결합 변화
```

따라서 최소한 다음을 전파해야 한다.

```text
에너지 변화와 형태
운동량 변화
물질·화학종 이동
구조적 연결 변화
개체 생성·분리·병합
```

## 9.4 상태 변화량

```cpp
struct StateDelta
{
    double MassDelta;
    Vector3 MomentumDelta;
    double EnergyDelta;

    ElementAmounts ElementDelta;
    SpeciesAmounts SpeciesDelta;

    ThermodynamicDelta Thermodynamics;
    StructureDelta Structure;
};
```

## 9.5 서버 검증

서버는 제안된 결과를 다음 기준으로 검증한다.

```text
현재 상태 버전과 일치하는가
플레이어가 실제로 전달 가능한 에너지인가
질량이 보존되는가
운동량이 보존되는가
각 원소량이 보존되는가
기존 확정 구조와 모순되지 않는가
허용된 상세화 영역 안의 결과인가
게임플레이 규칙을 위반하지 않는가
```

검증된 결과만 권위 상태에 적용한다.

---

# 10. 전이 이벤트

## 10.1 전이 이벤트 구조

```cpp
struct TransitionEvent
{
    EventId Id;
    SimulationTimestamp Time;

    std::vector<EntityId> Participants;
    SpatialRegion AffectedRegion;

    EnergyTransfer Energy;
    Vector3 MomentumTransfer;
    MatterTransfer Matter;

    std::vector<TopologyOperation> TopologyChanges;
    std::vector<StructuralAnchor> NewAnchors;

    uint64_t BasedOnVersion;
    uint64_t ResultVersion;
};
```

## 10.2 이벤트의 역할

이벤트는 다음 용도로 사용한다.

```text
서버 상태 갱신
관찰 중인 클라이언트 동기화
시각 효과 생성
상세 상태의 국소 수정
리플레이와 디버깅
거시 상태의 인과 이력 유지
```

서버는 모든 미세 움직임을 이벤트로 전파하지 않는다.

전파 대상:

```text
큰 에너지 변환
중요한 충돌
화학반응의 거시 결과
결합 파괴
개체 분리와 병합
상 변화
영구 손상
```

로컬 파티클이나 작은 난류는 클라이언트가 자체 생성한다.

---

# 11. 개체 생성·분리·병합

## 11.1 구조 변경 명령

틱 중간에 개체 계층을 즉시 수정하지 않는다.

```cpp
enum class TopologyOperationType
{
    Create,
    Split,
    Merge,
    Destroy,
    Refine,
    Coarsen
};

struct TopologyOperation
{
    TopologyOperationType Type;
    std::vector<EntityId> Sources;
    std::vector<MacroState> Results;
};
```

## 11.2 분리

```text
내부 결합 손상
→ 연결 그래프 분리
→ 독립된 연결 성분 탐색
→ 각 성분에 질량·에너지·운동량 배분
→ 새로운 개체 생성
```

분리된 개체들의 합은 원래 개체의 보존량과 같아야 한다.

## 11.3 병합

두 물질 덩어리가 접촉했다고 항상 병합되는 것은 아니다.

병합 조건의 예:

```text
지속적인 경계 결합
상대 운동 감소
내부 결합이 외부 결합보다 강함
별도 개체로 유지할 이유가 없음
```

병합 후에도 기존에 중요한 구조가 있다면 하위 앵커로 유지한다.

---

# 12. 상세 상태의 거시화

## 12.1 관찰 종료

상세 상태를 더 이상 유지할 필요가 없으면 다음으로 압축한다.

```text
총 보존량
평균과 분산
최대·최소값
주요 공간적 기울기
손상도와 결함 밀도
중요한 구조적 앵커
표현 불확실성
```

## 12.2 폐기 가능한 정보

```text
작은 균열의 정확한 위치
미세 입자의 위치
작은 물결
먼지 입자
작은 연기 소용돌이
장식적 표면 형상
```

## 12.3 유지해야 하는 정보

```text
플레이어가 만든 구멍
주요 절단면
큰 균열
개체의 분리 여부
자원 채취 결과
생명체의 기관 손실
새로 열린 통로
화학 조성의 거시 변화
```

---

# 13. 시각 처리

## 13.1 시뮬레이션과 렌더링 분리

```cpp
struct VisualProxy
{
    EntityId SourceEntity;
    uint64_t SourceVersion;

    VisualLOD Level;

    GeometryHandle Geometry;
    MaterialHandle Material;
    EffectState Effects;
};
```

시뮬레이션 개체는 메시나 파티클을 직접 소유하지 않는다.

```text
권위 거시 상태
→ 해석된 상세 상태
→ Visual Descriptor
→ Mesh / Voxel / Gaussian / Particle
```

## 13.2 시각 LOD와 시뮬레이션 LOD

둘은 독립적이다.

| 상황 | 시뮬레이션 LOD | 시각 LOD |
|---|---:|---:|
| 멀리 보이는 산 | 낮음 | 중간 |
| 가까운 장식용 돌 | 낮음 | 높음 |
| 화면 밖 폭발 | 높음 | 없음 |
| 플레이어가 만지는 슬라임 | 높음 | 높음 |
| 지하 화학반응 | 중간 | 없음 |

## 13.3 시각 전환 일관성

LOD가 변해도 다음 특징은 유지한다.

```text
전체 외곽
주요 돌출부
큰 균열
색 분포
영구 손상
질량 중심
주요 구조적 앵커
```

전환 방식:

```text
기존 Proxy 유지
→ 새 Proxy 생성
→ 앵커 정렬
→ 위치와 속도 보정
→ 짧은 모핑 또는 페이드
→ 기존 Proxy 제거
```

---

# 14. LOD 동기화

## 14.1 시뮬레이션 중요도

거리만으로 결정하지 않는다.

```cpp
double CalculateSimulationPriority(const Entity& entity)
{
    return
        entity.ObserverImportance +
        entity.InteractionIntensity +
        entity.StateChangeRate +
        entity.RepresentationUncertainty +
        entity.GameplayImportance;
}
```

## 14.2 상세화 조건

```text
플레이어가 직접 접촉함
높은 에너지 충돌 발생
화학반응 속도가 증가함
내부 분산이 커짐
요약 모델의 오차가 커짐
생명체나 퀘스트 핵심 개체임
```

## 14.3 거시화 조건

```text
일정 시간 상호작용 없음
내부 상태가 안정됨
상세 상태를 요약해도 오차가 작음
공유 관찰자가 없음
중요한 이벤트가 종료됨
```

## 14.4 히스테리시스

LOD가 경계에서 반복 전환되는 것을 막는다.

```text
상세화 임계치: 0.8
거시화 임계치: 0.3
최소 상세 유지 시간: 2초
최소 거시 유지 시간: 5초
```

---

# 15. 틱 스케줄링

## 15.1 업데이트 등급

```cpp
enum class UpdateClass
{
    EveryTick,
    Frequent,
    Slow,
    EventDriven,
    Sleeping
};
```

예시:

```text
매 틱
- 플레이어 주변 충돌
- 직접 조작
- 빠른 연소와 폭발

5~10틱마다
- 열 전달
- 액체 이동
- 구조 응력 완화

1초 이상 간격
- 녹
- 성장
- 부패
- 생태 변화

이벤트 기반
- 결합 파괴
- 개체 분리
- 발화
- 상 전이 시작
```

## 15.2 전체 서버 틱

```text
1. 입력과 외부 이벤트 수집
2. 활성 영역과 해상도 결정
3. 필요한 상세화 계약 발급
4. 공간적 상호작용 후보 탐색
5. 거시·상세 상호작용 변화량 계산
6. 화학·열·구조 전이 계산
7. 보존 법칙 검증
8. 상태 변화 일괄 적용
9. 개체 생성·분리·병합 처리
10. 부모 거시 상태 갱신
11. 전이 이벤트 생성
12. 관심 클라이언트에 이벤트 배포
13. 비활성 상세 상태 거시화
```

---

# 16. 클라이언트 처리 파이프라인

```text
1. 서버 거시 상태 수신
2. 관찰 대상과 시각 LOD 결정
3. 필요한 상세화 계약 요청
4. 결정적 공유 상세 생성
5. 로컬 장식 상세 생성
6. 물리·화학·시각 Proxy 실행
7. 상호작용 발생 시 ProposedTransition 생성
8. 서버 확정 이벤트 수신
9. 로컬 예측 상태 보정
10. 관찰 종료 시 상세 상태 폐기
```

---

# 17. 버전 관리와 충돌 해결

## 17.1 상태 버전

모든 상세화 계약과 전이 제안은 기반 상태 버전을 포함한다.

```text
BaseVersion != CurrentVersion
→ 결과가 오래된 상태에 기반함
→ 재검증, 병합 또는 거부
```

## 17.2 충돌 예시

두 플레이어가 동시에 같은 바위를 채굴한다.

```text
플레이어 A: 버전 30 기준 제안
플레이어 B: 버전 30 기준 제안

A 결과 적용
→ 상태 버전 31

B 결과 도착
→ 버전 불일치
→ 남은 질량과 구조 기준으로 재평가
```

## 17.3 충돌 정책

```text
교환 법칙이 성립하는 단순 변화
→ 델타 병합

같은 물질을 중복 소비
→ 제한량 기준 재계산

동일 구조를 서로 다르게 파괴
→ 서버가 우선순위와 시간 순서로 확정

중요한 전투·경제 결과
→ 서버 직접 시뮬레이션
```

---

# 18. 결정성과 재현성

완전한 부동소수점 결정성을 모든 클라이언트에서 보장하려고 하면 비용이 크다.

대신 다음을 구분한다.

```text
권위 결과의 결정성
- 보존량
- 주요 구조
- 개체 생성과 분리
- 게임플레이 결과

시각 결과의 비결정성 허용
- 작은 파편
- 먼지
- 연기 난류
- 미세한 표면
```

공유 상세에는 고정 시드와 생성기 버전을 사용한다.

---

# 19. 보안과 신뢰 경계

클라이언트는 다음을 확정할 수 없다.

```text
새로운 질량 생성
임의의 에너지 생성
숨겨진 자원 발견
서버에 없는 구조 파괴
다른 플레이어 상태 변경
경제적 가치가 있는 결과 확정
```

클라이언트는 결과를 제안하고 서버가 검증한다.

중요한 영역은 서버 또는 신뢰 가능한 서버 작업자가 상세 시뮬레이션한다.

---

# 20. 구현 예시: 녹슨 철문을 가열하고 파괴

## 초기 거시 상태

```text
철문
- 질량: 80 kg
- 철: 88%
- 산화물: 12%
- 평균 온도: 20℃
- 손상도: 0.18
- 경첩 앵커 2개
```

## 관찰과 상세화

플레이어가 접근하면 서버는 경첩과 표면 영역에 계약을 발급한다.

```text
표면: 화학·열 상세화
경첩: 구조 상세화
나머지 문짝: 거시 상태 유지
```

## 가열

```text
불 → 철문
- 열에너지 전달
- 온도 상승
- 국소 열팽창
- 산화 반응 가속
```

서버에는 모든 온도 셀이 저장되지 않는다.

```text
평균 온도 증가
최대 온도 증가
고온 영역 비율 증가
경첩 주변 응력 증가
산화물 비율 증가
```

## 충격

클라이언트가 제안:

```text
운동량 전달
충격 에너지
경첩 손상
새 균열 앵커
```

서버 검증 후:

```text
경첩 결합 파괴
문짝 개체와 경첩 조각 개체 분리
운동량 배분
상태 버전 증가
```

## 관찰 종료

```text
미세 온도 셀 폐기
작은 녹 가루 위치 폐기
경첩 파괴 유지
문짝 변형 앵커 유지
평균 온도와 손상도 저장
```

---

# 21. 권장 구현 단계

## 1단계 — 권위 거시 상태

구현 대상:

```text
EntityId
Version
ConservedState
ThermodynamicSummary
CompositionSummary
StructureSummary
```

목표:

- 질량과 에너지 보존
- 거시 상태 저장
- 버전 관리

## 2단계 — 전이 이벤트

구현 대상:

```text
StateDelta
TransitionEvent
ProposedTransition
ConservationReport
```

목표:

- 직접 상태 수정 제거
- 이벤트 기반 상태 갱신
- 서버 검증

## 3단계 — 단순 상세화 계약

구현 대상:

```text
RefinementContract
GenerationSeed
RequiredAnchors
RegionBudget
```

목표:

- 바위 하나를 국소 셀로 펼침
- 상세화 전후 보존량 검증
- 관찰 종료 후 거시화

## 4단계 — 구조적 앵커

구현 대상:

```text
구멍
절단면
큰 균열
결합
부품 연결
```

목표:

- 재상세화 후에도 중요한 구조 유지
- 파괴와 개체 분리 구현

## 5단계 — 클라이언트 시각 해석

구현 대상:

```text
VisualProxy
공유 상세 생성
로컬 장식 생성
LOD 전환
```

목표:

- 시뮬레이션과 렌더링 완전 분리
- 같은 거시 상태에서 다양한 시각 표현 생성

## 6단계 — 관찰되지 않는 거시 시뮬레이션

구현 대상:

```text
녹
열 확산
연소
부패
성장
생태 변화
```

목표:

- 느린 현상을 상세 개체 없이 진행
- 관찰 시 거시 결과를 일관되게 구체화

## 7단계 — 다중 사용자 동기화

구현 대상:

```text
상태 버전 충돌
동시 상호작용
공유 상세
지역 권한
서버 재검증
```

---

# 22. 핵심 불변식

전체 시스템은 다음 불변식을 항상 지켜야 한다.

```text
1. 질량, 에너지, 운동량, 원소량은 허용 오차 안에서 보존된다.

2. 하나의 물질 상태는 한 시점에 하나의 활성 표현만 소유한다.

3. 관찰 상세는 권위 상태가 아니라 권위 상태의 해석이다.

4. 인과적으로 중요한 변화만 확정 사실로 승격된다.

5. 거시화 후에도 다음 상호작용 결과를 바꿀 정보는 유지된다.

6. 클라이언트는 상태를 확정하지 않고 전이를 제안한다.

7. 서버는 모든 상세 상태가 아니라 가능한 상세 상태의 범위를 관리한다.

8. 시각 LOD와 시뮬레이션 LOD는 독립적이다.

9. 확률적 거시 변화도 보존 법칙과 기존 사건을 위반할 수 없다.

10. 상세화는 기존 상태를 발견하는 것이 아니라 제약 안에서 구체화하는 과정이다.
```

---

# 23. 최종 구조

```text
서버
├ 권위 있는 거시 상태
│  ├ 보존량
│  ├ 열역학 상태
│  ├ 조성
│  ├ 구조 요약
│  ├ 확정 사실
│  └ 표현 불확실성
│
├ 거시 전이 시뮬레이터
├ 상세화 계약 관리자
├ 전이 이벤트 검증기
├ 개체 생성·분리·병합 관리자
└ 상태 버전 및 동기화 관리자

클라이언트
├ 관찰 영역 관리자
├ 공유 상세 생성기
├ 로컬 장식 생성기
├ 물리·화학 국소 시뮬레이터
├ Visual Proxy
└ 전이 제안 생성기
```

이 구조의 핵심은 서버가 세계의 모든 세부를 보유하는 것이 아니다.

> 서버는 세계가 반드시 지켜야 하는 사실과 제약을 보유하고,  
> 클라이언트는 관찰되는 부분을 그 제약 안에서 구체화하며,  
> 상호작용으로 의미가 생긴 결과만 다시 서버의 역사와 거시 상태에 편입한다.

