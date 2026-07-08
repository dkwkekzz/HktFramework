# C02 — 파티클·강체 표현

> **이 챕터가 답하는 질문**: C01 에서 본 `FVec3`·`FRotation3`·`FMatrix33` 한 값들이, 실제 강체 하나의 상태로는 어떻게 묶이는가? 그리고 그런 강체 *수천 개*가 한 솔버 안에서 어떻게 저장되고, 코드는 그것을 무엇으로 들고 다니는가?
> **대응 Concepts**: [02 — 동역학(질량·관성·힘·토크)](../Concepts/02-dynamics.md)
> **선행 챕터**: [C01 — 코어 타입·수학](./C01-core-types-math.md) (특히 §1 값 타입, §2 정밀도 다이얼, §4 SOA 발상)

---

## 왜 이 챕터를 세 번째로 읽는가

C01 의 마지막 문장이 약속한 게 있다 — "그 값들이 수천 개 모여 어떻게 저장되는가"가 C02 라고. 그 약속을 지킬 차례다.

물리 솔버 코드를 읽다 보면 `Particle->GetX()`, `Rigid->GetP()`, `Particles.GetInvM(Index)` 같은 줄이 끝없이 나온다. 이 한 줄들을 매번 더듬지 않으려면 딱 두 가지를 머릿속에 박아야 한다. 첫째, **강체의 상태가 물리적으로 무엇으로 구성되는가** — 위치·자세·속도·질량·관성. 둘째, **그것이 메모리에 어떻게 깔려 있는가** — 한 강체가 한 구조체가 아니라, 수천 강체의 같은 속성끼리 모인 *열(column)* 들로 흩어져 있다는 사실.

이 챕터의 핵심 메시지도 C01 처럼 한 문장이다 — **Chaos 는 강체를 "객체"로 저장하지 않는다. "열"로 저장한다.** 강체 5번의 상태는 어디에도 한 덩어리로 모여 있지 않다. 위치 배열의 5번 칸, 회전 배열의 5번 칸, 질량 배열의 5번 칸… 에 흩어져 있고, 정수 `5` 하나가 그 모두를 가리키는 주소다. 이 한 가지 발상(SOA, Struct of Arrays)이 나머지 구조 전부를 결정한다. C01 §4 에서 SIMD 패킹의 동기로 잠깐 봤던 그 발상이, 여기서는 파티클 시스템 전체의 골격이 된다.

> **용어 정리**: Chaos 는 강체든 천 입자든 전부 **파티클(particle)** 이라 부른다. "한 점"이라는 뜻이 아니라 "시뮬레이션이 추적하는 한 개체"라는 뜻이다. 강체(rigid body)는 그중 회전·질량·관성까지 갖춘 가장 무거운 종류다. 이 챕터의 주인공은 그 강체지만, 더 가벼운 종류들(정적·키네마틱)이 같은 틀을 공유한다는 점이 핵심이다.

---

## 1. 강체 하나가 아니라 "열"이다 — SOA 의 실체

가장 밑바닥 저장 메커니즘부터 보자. 모든 파티클 컨테이너의 뿌리는 `TArrayCollection` 이다 — `ChaosCore/Public/Chaos/ArrayCollection.h:9`. 이 클래스가 하는 일은 놀랄 만큼 단순하다. **자기 자신은 데이터를 거의 안 들고, 대신 "열 배열들의 목록"을 든다.**

```cpp
class TArrayCollection {
    ...
    int32 AddArray(TArrayCollectionArrayBase* Array);  // 열 하나를 등록
    void  ResizeHelper(const int32 Num) {              // 모든 열을 한꺼번에
        MSize = Num;
        for (TArrayCollectionArrayBase* Array : MArrays)
            if (Array) Array->Resize(Num);             // 락스텝으로 리사이즈
    }
protected:
    TArray<TArrayCollectionArrayBase*> MArrays;         // 등록된 열들
    uint32 MSize;                                       // 모든 열의 공통 길이
};
```

여기서 모든 게 나온다. 각 파생 클래스는 자기 멤버 배열(`MX`, `MV`, `MM`…)을 생성자에서 `AddArray` 로 이 목록에 끼워 넣는다. 그러면 `AddParticles`/`Resize`/`DestroyParticle` 한 번이 **등록된 모든 열에 동시에** 전파된다(`ArrayCollection.h:90~`). 그 결과 모든 열의 길이가 항상 같고, **정수 인덱스 하나가 모든 열의 같은 칸 = 한 파티클의 전체 상태**를 가리키게 된다. 이것이 SOA 의 실체다.

가장 얇은 층 `TParticles`(`Particles.h:31`)를 보면 이게 눈에 보인다. 이 층이 등록하는 열은 **단 하나, 위치 `MX`** 뿐이다.

```cpp
TParticles() { AddArray(&MX); }              // Particles.h:37
...
TArrayCollectionArray<TVector<T, d>> MX;      // 위치 열 하나
```

즉 `TParticles` 단계의 "파티클"은 위치밖에 없는 점이다. 나머지 속성(회전·속도·질량…)은 위 층들이 자기 열을 *추가로* 등록하면서 붙는다. 이 누적 구조가 §3 의 주제다.

---

## 2. 인덱스는 정체성이 아니다 — RemoveAtSwap 의 함정과 핸들의 존재 이유

SOA 에는 대가가 따른다. 파티클을 지울 때다. `TParticles::DestroyParticle`(`Particles.h:76`)의 기본 동작은 `RemoveAtSwap` 이다 — `ArrayCollection.h:119`.

```cpp
enum class ERemoveParticleBehavior : uint8 {
    RemoveAtSwap,  // O(1) 이지만 파티클들의 상대 순서가 바뀐다
    Remove         // 순서는 유지하지만 O(n)
};
```

`RemoveAtSwap` 은 지울 칸에 **맨 끝 칸을 옮겨 덮고** 길이를 하나 줄인다. 모든 열에 동시에. O(1) 이라 빠르지만, 부작용이 결정적이다 — **인덱스 5에 있던 파티클이 다음 순간 다른 파티클일 수 있다.** 끝에 있던 녀석이 5번 자리로 점프해 왔기 때문이다.

그래서 `ParticleHandle.h:412` 의 주석이 못을 박는다:

```cpp
int32 ParticleIdx;  // Index into the particle struct of arrays. Note the index can change
```

여기서 이 챕터의 두 번째 큰 구조가 나온다 — **인덱스로 파티클을 들고 다니면 안 된다.** 인덱스는 휘발성 주소일 뿐 정체성이 아니다. 정체성을 들고 다니는 도구가 바로 **핸들(handle)** 이고(§6), 변하지 않는 진짜 ID 가 `FUniqueIdx`(`GeometryParticlesfwd.h:86`)다. SOA 가 빠른 대신, 그 빠름이 강요하는 간접 층이 핸들이다. 둘은 한 묶음으로 이해해야 한다.

---

## 3. 능력의 사다리 — 상속이 곧 열의 누적

이제 강체가 어떻게 조립되는지 본다. Chaos 파티클의 클래스 상속은 OOP 의 "is-a" 라기보다 **"능력을 한 칸씩 더 얹는 사다리"** 로 읽는 게 정확하다. 한 층을 올라갈 때마다 새 열(속성)이 `AddArray` 로 추가되고, 그만큼 더 무거운 파티클이 된다. 강체에 이르는 사다리는 이렇다:

```
TArrayCollection           ── 열 목록 + 락스텝 리사이즈 (저장 엔진)
  └ TParticles             ── + MX (위치)
     └ TSimpleGeometryParticles  ── + MR (자세), MGeometry (모양)
        └ TGeometryParticlesImp   ── + UniqueIdx, 핸들 역포인터, Shapes, Bounds, SpatialIdx, …   [Static]
           └ TKinematicGeometryParticlesImp ── + MV (선속도), MW (각속도), KinematicTarget   [Kinematic]
              └ TRigidParticles       ── + M/InvM (질량), I/InvI (관성), 힘·가속, CoM, ObjectState   [Rigid base]
                 └ TPBDRigidParticles ── + P/Q (예측 위치·자세), PreV/PreW, SolverBodyIndex   [Rigid 최종]
```

각 단계의 의미를 물리로 옮기면:

**TParticles → 위치만.** §1 에서 본 점.

**TSimpleGeometryParticles → 자세와 모양이 붙는다.** `MR`(회전, `SimpleGeometryParticles.h:127`)과 `MGeometry`(implicit geometry 포인터, `:130`)가 추가된다. 이제 파티클은 "월드 어디에, 어떤 방향으로, 어떤 모양으로" 있다. 모양 자체(Box·Convex·TriMesh…)는 C03 의 주제이고, 여기서는 파티클이 그것을 *가리키는 포인터 열*을 갖는다는 것만 안다.

**TGeometryParticlesImp(=`TGeometryParticles`, `EParticleType::Static`) → 시뮬레이션 시민권.** **모든 시뮬레이션 파티클이 공유하는 공통 인프라가 여기 한꺼번에 등록된다**(`GeometryParticles.h:267~`, 22개 열) — 영구 ID `MUniqueIdx`, 게임스레드 파티클·핸들로의 역참조, 충돌 형상 instance `MShapesArray`, 로컬·월드 bound, 공간 가속 구조 인덱스 `MSpatialIdx`, 충돌·구속 그래프 연결, 동기화·resim 상태 등. 이 열들은 정적이든 동적이든 *모두* 필요하다는 게 핵심이다 — 벽·바닥도 충돌 형상과 bound가 있어야 하고, 움직이는 물체가 공간 가속 구조로 질의해 올 수 있게 공간 인덱스도 등록돼야 한다. 그래서 **이 단계가 "정적(Static) 파티클"의 완성형**이다. 움직이지 않는 벽·바닥은 여기까지면 충분하다 — 속도도 질량도 필요 없으니까. `MParticleType = EParticleType::Static`(`:168`)이 그 표식이다. (참고로 한 층이 더하는 *열의 수*만 보면 아래 Rigid 층이 25개로 더 많다 — 다만 그쪽은 동적 강체만 쓰는 열들이다.)

**TKinematicGeometryParticlesImp(`EParticleType::Kinematic`) → 속도가 붙는다.** `MV`(선속도)·`MW`(각속도)·`KinematicTargets` 세 열을 추가한다(`KinematicGeometryParticles.h:19~`). 키네마틱 파티클은 "스스로 정해진 대로 움직이지만, 힘에는 반응하지 않는" 몸이다(엘리베이터·플랫폼). 속도는 있는데 질량은 아직 없다는 점이 정확히 그 성격을 코드로 표현한다 — 외력으로 가속될 수 없으니 질량이 무의미하다. `KinematicTarget` 은 "다음에 여기로 가라"는 목표 자세를 담는 열로, 속도를 역산하는 근거가 된다.

**TRigidParticles(`EParticleType::Rigid`) → 비로소 질량·관성·힘.** 진짜 동역학이 여기서 시작된다(`RigidParticles.h:122~` RegisterArrays). 질량 `MM`/역질량 `MInvM`, 관성 `MI`/역관성 `MInvI`, 가속도, 임펄스, 무게중심 `MCenterOfMass`·`MRotationOfMass`, 그리고 상태·플래그를 묶은 `CoreData`. 이것이 Concepts 02 동역학의 양들이 처음으로 전부 모이는 지점이다. 질량·관성의 세부는 §5.

**TPBDRigidParticles → 솔버가 쓰는 예측 상태.** 최종 층은 `MP`·`MQ`(예측 위치·자세), `MPreV`·`MPreW`, `MSolverBodyIndex` 를 더한다(`PBDRigidParticles.h:53~` RegisterArrays, 멤버 `:277,278`). 이 `P/Q` 의 의미가 §4 의 주제이고, Chaos 가 "PBD(Position-Based Dynamics)" 엔진인 이유가 바로 이 한 쌍에 담겨 있다.

> **두 개의 enum, 두 개의 시선.** 같은 사다리를 두 enum 이 본다. `EParticleType`(`GeometryParticlesfwd.h:10`: Static/Kinematic/Rigid/Clustered…)은 **"어느 SOA 컨테이너에 사는가"** = 클래스 종류를 가리키고, `EObjectStateType`(`Particle/ObjectState.h`: Static/Kinematic/Dynamic/Sleeping)은 **"지금 어떻게 행동하는가"** = 런타임 상태를 가리킨다. 둘은 대개 맞물리지만 같지 않다 — 한 Rigid 컨테이너의 파티클이 Dynamic 이었다가 Sleeping 이 되기도 하고(§5), 심지어 Kinematic 으로 전환되기도 한다. 컨테이너는 그대로 둔 채 상태만 바꾼다.

또 하나 헷갈리기 쉬운 갈래가 있다. `TDynamicParticles`(`DynamicParticles.h`)는 위 강체 사다리와 **다른 가지**다. 이름이 "Dynamic" 이라 강체의 동적 상태처럼 보이지만, 실제로는 `TParticles` 에서 곧장 갈라져 나와 속도·질량만 얹은 별도 계열로, 천·soft body(PBD softs) 솔버가 쓴다. 강체는 `TKinematic…→TRigid…→TPBDRigid…` 줄기를 타고, `TDynamicParticles` 줄기와 만나지 않는다. 이름에 속지 말 것.

### 구체 예시 — 어떤 게임 물체가 어느 파티클이 되는가

사다리는 추상적이다. 한 게임 레벨을 짓는다고 상상하며 실제 물체를 하나씩 얹어보면, 각 파티클을 *언제* 고르는지가 선명해진다. 고르는 기준은 딱 하나다 — **이 물체가 무엇을 할 수 있어야 하는가.** 능력이 하나 늘 때마다 사다리를 한 칸 오르고, 그만큼 열(=메모리·계산)을 더 낸다. 그러니 "필요 없는 능력은 안 사는" 게 원칙이다.

**바닥·벽·지형·계단·건물 → Static.** 레벨의 뼈대. 절대 안 움직이고 힘에도 반응하지 않으니, 위치를 갱신할 일도 속도·질량을 둘 일도 없다 — 오직 "부딪힐 대상"으로만 존재한다. 그래서 Static 파티클은 공간 구조에 한 번 등록되면 재빌드 없이 재사용되고(C04 정적 bucket), 서로 부딪힐 일이 없어 broad phase 순회에서도 빠진다(C05). 레벨의 대부분이 이것이고 가장 싸다. **"안 움직인다"가 확실하면 무조건 Static** — 윗칸 능력은 전부 낭비다.

**엘리베이터·이동 플랫폼·회전문·컨베이어·스크립트로 여닫는 문 → Kinematic.** "내가 정한 경로대로 움직이되, 부딪혀도 밀려나지 않는" 몸. 플레이어가 플랫폼에 올라타면 플랫폼은 플레이어를 들어올리지만, 플레이어나 떨어진 상자가 플랫폼을 도로 밀지는 못한다. 이 *일방통행*이 정확히 **무한 질량**(InvM=0, §5)으로 표현된다. 그런데 왜 속도(`MV`/`MW`)는 필요할까? 올라탄 물체에 **운동량과 마찰을 전달**해야 하기 때문이다 — 플랫폼이 옆으로 1 m/s 로 가면 그 위 상자도 실려가야 자연스럽다. `KinematicTarget`("다음 프레임 여기로")에서 속도를 역산해 그 전달을 만든다. **"움직이지만 물리에 안 밀려야 한다"면 Kinematic.**

**떨어지는 상자·굴러가는 배럴·폭발 파편·던진 병·쌓인 나무궤짝·ragdoll 뼈 → Dynamic(Rigid).** 중력·충격·마찰에 온전히 반응하는 "진짜 물리 물체". 여기서 비로소 질량·관성·힘이 다 필요하다 — 무거운 궤짝은 천천히 기울고 가벼운 병은 팽그르르 도는 그 차이가 바로 관성 텐서(§5)다. 사다리 꼭대기 `TPBDRigidParticles` 이고, `P/Q` 예측 자세를 솔버가 매 프레임 밀고 당겨 겹침을 푼다(§4). **"세계에 물리적으로 반응해야 한다"면 Dynamic.**

**정착해 쌓인 박스 더미 → Dynamic 이지만 Sleeping.** 같은 Dynamic 파티클이라도 충분히 느려지면 잠든다(§5) — 컨테이너는 그대로 두고 상태만 Sleeping 으로 바꿔 솔버 계산에서 뺀다. 던진 궤짝 열 개가 바닥에 정착하면 열 개가 다 잠들어 사실상 공짜가 되고, 무언가 다시 치면 깬다. **"동적이지만 지금은 멈춰 있다"를 위한 성능 장치.**

**부서지는 기둥·유리창·잔해 → Clustered(파괴).** 온전할 땐 조각들이 하나로 묶여(cluster) 한 강체처럼 굴다가, 충격을 받으면 개별 조각으로 흩어진다. 강체 사다리 옆에 붙은 특화 계열(`FPBDRigidClusteredParticles`)이며, 자세한 건 C16.

**깃발·망토·천·젤리 같은 변형체의 정점들 → `TDynamicParticles`(별도 가지).** 바로 위에서 경고한 그 별도 줄기가 여기 쓰인다. 천 한 장은 강체가 아니라 수백 개 정점의 그물이고, 각 정점은 회전도 관성 텐서도 의미가 없다 — 위치·속도·질량이면 족하다. 그래서 무거운 강체 사다리를 타지 않고 `TParticles` 에서 곧장 갈라진 가벼운 계열을 쓴다. **"강체가 아니라 변형체"면 이 가지.**

한 장의 표로:

| 게임 물체 | 파티클 (타입/상태) | 왜 이걸 쓰나 (핵심 능력) |
|---|---|---|
| 바닥·벽·지형·건물 | Static | 안 움직임·충돌 대상만 → 위치/속도/질량 불필요, 최저 비용 |
| 엘리베이터·플랫폼·회전문 | Kinematic | 정해진 대로 움직이되 안 밀림(무한 질량) + 실린 물체에 속도 전달 |
| 상자·배럴·파편·ragdoll | Dynamic (Rigid) | 중력·충돌·마찰에 반응 → 질량·관성·힘 전부 필요 |
| 정착한 박스 더미 | Dynamic + Sleeping | 동적이나 정지 → 계산에서 제외(성능) |
| 부서지는 기둥·잔해 | Clustered | 묶였다 흩어지는 파괴 (→ C16) |
| 천·망토·젤리 정점 | `TDynamicParticles` | 변형체 → 회전·관성 무의미, 위치·속도·질량만 |

이 표를 뒤집으면 §3 사다리의 의미가 한 문장으로 선다 — **필요한 능력만큼만 사다리를 오르고, 딱 그만큼만 열(메모리·계산)을 낸다.** Static 에 질량을 안 두고, 천 정점에 관성 텐서를 안 두는 것. 그게 SOA + 능력 사다리 설계가 노리는 절약이다.

---

## 4. X/R 과 P/Q — PBD 엔진의 심장 한 쌍

강체 사다리의 마지막 층이 더한 `P`·`Q`(`PBDRigidParticles.h:66,73`)는 단순한 추가 열이 아니다. **Chaos 가 어떤 종류의 엔진인지**를 드러내는 핵심이다.

강체 하나는 자세 정보를 *두 벌* 들고 있다:

- `X`(위치, `TParticles::MX`) + `R`(자세, `TSimpleGeometryParticles::MR`) — **현재(이번 스텝 시작 시점의) 변환.**
- `P`(위치) + `Q`(자세, `TPBDRigidParticles::MP/MQ`) — **예측(predicted) 변환.** 적분과 구속 해소가 작업하는 "임시 미래 자세".

PBD 의 한 스텝은 대략 이렇게 흐른다 — 먼저 속도·힘으로 `P/Q` 를 미래로 한 발 적분해 던져두고(예측), 충돌·조인트 구속이 그 `P/Q` 를 직접 밀고 당겨 제약을 만족시키고, 마지막에 `(P−X)/dt` 로 속도를 역산한 뒤 `X/R ← P/Q` 로 현재를 갱신한다. 즉 **구속을 "힘"이 아니라 "위치 보정"으로 푸는** 게 PBD 이고, 그 위치 보정이 일어나는 칠판이 바로 `P/Q` 열이다. 그래서 솔버 코드가 `GetP()`/`SetQ()` 를 그토록 자주 부른다 — 그게 작업 표면이니까.

이 한 쌍의 초기화 흔적이 상태 전이 코드에 남아 있다. 파티클이 Dynamic 으로 깨어날 때 `SetP(GetX)`·`SetQf(GetRf)` 로 예측 자세를 현재 자세에서 출발시킨다(`PBDRigidParticles.h:161~`, `SetObjectState`). 적분 루프·서브스텝의 전체 시퀀스는 **C11(Evolution)** 의 몫이다. 여기서는 "강체는 현재 자세와 예측 자세를 동시에 들고 있고, 후자가 솔버의 작업면"이라는 구조만 챙긴다.

---

## 5. 질량과 관성 — 0 이라는 영리한 인코딩, 그리고 대각선으로 접힌 텐서

§3 에서 TRigidParticles 가 질량·관성을 얹는다고 했다. 그 저장 방식에 두 가지 묘수가 있다.

**첫째, 역(inverse) 값을 함께 저장하고, 0 으로 "무한 질량"을 인코딩한다.** 강체는 질량 `M` 과 함께 **역질량 `InvM`**, 관성 `I` 와 함께 **역관성 `InvI`** 를 나란히 든다. 동역학 수식이 거의 항상 `1/m`, `I⁻¹` 꼴로 쓰이기 때문에(가속도 = 힘 × 역질량) 매번 나누지 않으려고 미리 역수를 캐싱한다. 그런데 여기에 영리한 부수 효과가 있다 — **정적/키네마틱 = 무한 질량 = 역질량 0.** 무한대를 저장할 필요 없이 `InvM=0, InvI=0` 한 줄이면 "이 몸은 충돌에 밀리지 않는다"가 수식상 자동으로 성립한다(0 을 곱하면 보정이 사라지므로). §3 에서 키네마틱을 두고 "질량이 무의미하다"고 한 것이 코드에서는 바로 이 **역질량 0(=무한 질량, 외력으로 가속 불가)** 으로 나타난다 — "질량 없음"과 "무한 질량"은 같은 사실의 두 표현이다.

한 가지 주의: 아래 전환 코드는 **`TRigidParticles` 컨테이너에 사는 파티클**(즉 잠재적으로 동적인 강체)이 **런타임 상태**(`EObjectStateType`)를 바꿀 때 도는 것이다(§3 의 두 enum 구분). 처음부터 정적 컨테이너(`Static` 타입)에 사는 벽·바닥은 애초에 이 `InvM` 열을 갖지 않으므로 이 코드와 무관하다. 여기서 "Static/Kinematic 으로 간다"는 *상태*를 말하는 것이지 *컨테이너*를 말하는 게 아니다. 이 전환이 `SetObjectState`(`PBDRigidParticles.h:161~`)에 그대로 보인다:

```cpp
// Dynamic → Static/Kinematic 으로 갈 때
this->InvM(Index) = 0.0f;
this->InvI(Index) = TVec3<FRealSingle>(0);
// 반대로 Dynamic 으로 갈 때
this->InvM(Index) = 1.f / this->M(Index);
this->InvI(Index) = TVec3<FRealSingle>(1.f/I[0], 1.f/I[1], 1.f/I[2]);
```

**둘째, 관성 텐서가 3×3 행렬이 아니라 3-벡터로 접혀 있다.** C01 §3 에서 `FMatrix33`(PMatrix 3×3)이 "관성 텐서의 자리"라고 했는데, 정작 파티클이 저장하는 관성 `MI` 는 `TVec3<FRealSingle>`(`RigidParticles.h:415`) — **대각 성분 세 개뿐인 벡터**다. 왜?

답은 무게중심 정보 쌍 `CenterOfMass`·**`RotationOfMass`** 에 있다. 질량 속성을 계산하는 단계(`MassProperties.h`)에서 Chaos 는 임의의 모양에서 완전한 3×3 관성 텐서를 구한 뒤, 이를 **대각화(diagonalize)** 해서 주축(principal axes)을 찾는다 — `TransformToLocalSpace`(`MassProperties.h:40,41`)와 `Combine`(`:69`, 주석에 "diagonalize the inertia and set the rotation of mass accordingly"라고 명시)이 그 작업이다. 그 결과:

- 비대각 성분이 0 이 되는 좌표계(주축 정렬)를 찾고, 그 회전을 **`RotationOfMass`** 로 저장한다.
- 그 좌표계에서 텐서는 대각선뿐이므로, **주관성 모멘트 세 개**만 `MI`(=TVec3)에 저장하면 충분하다.

즉 "3×3 텐서"는 "대각 3-벡터 + 정렬 회전"으로 무손실 분해되어 저장된다. C01 의 `FMatrix33` 은 *계산 중간 단계*(`FMassProperties::InertiaTensor`, `MassProperties.h:36`)에서 잠깐 쓰이고, 파티클의 *영구 저장*은 벡터로 접힌다. 메모리도 절약하고, 솔버에서 `I⁻¹` 적용도 성분별 곱으로 끝난다.

> **상태와 sleeping.** `CoreData`(`RigidParticles.h:65`)는 `ObjectState`/`PreObjectState`/`ControlFlags` 등 자주 함께 읽히는 작은 값들을 한 구조체로 묶은 열이다(주석: broadphase 필터링에서 통째로 읽힌다). 강체가 충분히 느려지면 `SetSleeping`(`PBDRigidParticles.h:122`)이 속도를 0 으로 만들고 상태를 Sleeping 으로 바꿔 솔버 비용에서 제외한다 — 깰 때를 대비해 직전 속도를 `PreV/PreW` 에 보관해 둔다. sleeping 임계·아일랜드 단위 처리는 C09 에서.

---

## 6. SOA 는 저장, 핸들은 손잡이 — 그리고 게임스레드의 그림자

§2 에서 "인덱스는 정체성이 아니다, 그래서 핸들이 있다"고 했다. 이제 핸들의 정체를 본다. `TParticleHandleBase`(`ParticleHandle.h:400~`)의 실체는 충격적으로 단순하다 — **SOA 포인터 + 인덱스 + 타입**, 그게 전부다:

```cpp
union { TGeometryParticles<T,d>* GeometryParticles;
        TKinematicGeometryParticles<T,d>* KinematicGeometryParticles;
        TPBDRigidParticles<T,d>* PBDRigidParticles; ... };  // 어느 SOA 인가
int32 ParticleIdx;   // 그 SOA 의 몇 번 칸인가 (변할 수 있음)
EParticleType Type;  // 어느 종류인가
```

핸들의 접근자는 전부 이 둘로 SOA 를 되짚는 **얇은 위임**이다 — `GetX()` 는 `GeometryParticles->GetX(ParticleIdx)`(`ParticleHandle.h:558`), `GetP()` 는 `PBDRigidParticles->GetP(ParticleIdx)`(`:1106`)로 풀린다. 즉 데이터는 SOA(열)에 있고, 핸들은 "그 열의 한 행을 가리키는 타입 있는 손잡이"일 뿐이다. SOA 가 빠른 일괄 처리를 위한 *저장 레이아웃*이라면, 핸들은 코드가 한 강체를 *지목해 다루기 위한 인터페이스*다. 같은 데이터의 두 시선.

핸들 계층도 SOA 사다리를 그대로 거울처럼 따른다(`TGeometryParticleHandleImp` → `TKinematicGeometryParticleHandleImp` → `TPBDRigidParticleHandleImp`). 그래서 종류를 좁히는 **다운캐스트**가 `Type` enum 한 번 비교로 끝난다 — `CastToRigidParticle()` 은 `Type >= EParticleType::Rigid` 일 때만 캐스팅하고 아니면 nullptr 을 준다(`ParticleHandle.h:1697~`). 정적 파티클 핸들에 `CastToRigidParticle()` 을 부르면 안전하게 nullptr 이 떨어지는 식이다. 이게 fwd 헤더 주석 "Used for down casting when iterating over multiple SOAs"(`GeometryParticlesfwd.h:9`)의 의미다.

매번 캐스트하기 번거로운 코드를 위해 `FGenericParticleHandle`(`ParticleHandle.h:1765~`)이라는 통합 wrapper가 있다. 어떤 핸들이든 받아 균일한 API 를 주되, 그 종류에 없는 속성은 안전한 기본값을 돌려준다 — 예컨대 `GetV()` 는 키네마틱이 아니면 영벡터를 반환한다(`:1853`). "타입을 따지지 않고 일단 물어보는" 호출부를 위한 문법 설탕이다.

마지막으로, 지금까지의 핸들은 전부 **물리 스레드(PT) 쪽** 이야기다. 게임 스레드(GT)에는 그림자 짝이 따로 산다 — `TGeometryParticle`/`FPBDRigidParticle`(`ParticleHandleFwd.h` 끝부분). `TThreadParticle<EThreadContext>` 가 컨텍스트에 따라 GT 파티클이냐 PT 핸들이냐를 골라준다(`ParticleHandleFwd.h` 마지막). 이 **GT/PT 이중화**가 Chaos 비동기 구조의 출발점인데, 둘 사이의 마샬링·dirty 추적은 **C12(Solver 프런트엔드·스레딩)**·**C14(GT 인터페이스)** 의 본론이다. 여기서는 "핸들은 PT 측 손잡이이고, GT 에는 별도 표현이 있다"는 경계선만 그어 둔다.

> **컨테이너는 하나가 아니다 (→ C11·C12).** 위 SOA 들은 솔버가 **타입·상태별로 여러 개**를 동시에 소유한다 — 솔버 `FPBDRigidsSolver` 가 `FPBDRigidsSOAs` 묶음을 값으로 들고(StaticParticles·KinematicParticles·DynamicParticles·DynamicKinematicParticles·…Disabled·Clustered·GeometryCollection), Evolution 은 그걸 참조로 빌려 쓴다. 컨테이너 9개는 솔버가 켜질 때 빈 채로 한꺼번에 생성되고(`PBDRigidsSOAs.h:278~290`), 파티클은 타입별 팩토리(`CreateStaticParticles`/`CreateDynamicParticles` 등 `:335~393`)로 추가된다. 핵심은 **파티클이 sleeping·kinematic·disabled 로 상태가 바뀌면 그 행이 `MoveToSOA`(`ParticleHandle.h:786`)로 다른 컨테이너로 옮겨 간다**는 점이다 — §2 에서 "인덱스는 변한다"고 한 바로 그 일이 런타임에 일어나고, 이때 핸들의 `ParticleIdx` 가 자동으로 재배선된다. 솔버가 매 스텝 "활성 강체만" 빠르게 순회하려고 상태별로 컨테이너를 쪼개 둔 것이며, 그 소유·이동·뷰 메커니즘 전체는 C11·C12 의 몫이다.

---

## 7. 결정론·스레딩 메모

- **정밀도 혼용이 여기서 구체적 자국을 남긴다.** C01 §2 의 다이얼이 파티클 열마다 갈린다 — **위치 `MX`/`MP` 는 `FReal`(double)** 이지만, **자세 `MR`/`MQ`, 속도 `MV`/`MW`, 관성 `MI` 는 `FRealSingle`(float)** 이다(`SimpleGeometryParticles.h:127`, `PBDRigidParticles.h` private 멤버, `RigidParticles.h:415`). 월드 좌표만 double 로 지키고 회전·속도·관성은 float 로 줄여 캐시·SIMD 효율을 챙긴 트레이드오프다. 직렬화 코드가 구버전(double 저장)과 신버전(`SinglePrecisonParticleDataPT`) 사이를 변환하는 분기(`KinematicGeometryParticles.h`, `PBDRigidParticles.h` Serialize)가 이 전환의 흔적이고, float↔double 경계는 C13 결정론에서 다시 본다.
- **RemoveAtSwap 이 순서를 비결정적으로 만든다.** §2 의 swap-remove 는 파티클의 인덱스 순서를 삭제 이력에 의존하게 만든다. 같은 씬이라도 생성·삭제 순서가 다르면 메모리 배치가 달라지고, 합산 순서에 민감한 부동소수점 경로에서 미세한 결과 차이로 번질 수 있다. 결정론이 필요한 경로는 인덱스가 아니라 `FUniqueIdx` 로 정렬·식별해야 한다.
- **핸들 ≠ 인덱스 규율.** 프레임을 가로질러 파티클을 들고 있어야 하면 인덱스를 캐싱하지 말고 핸들(또는 UniqueIdx)을 들어야 한다(§2). 인덱스 캐싱은 swap-remove 한 번에 엉뚱한 파티클을 가리키는 버그가 된다.

---

## 8. 무엇을 들고 다음으로 가는가

세 문장으로 압축하면:

첫째, **Chaos 는 강체를 객체가 아니라 열(SOA)로 저장한다** — `TArrayCollection` 이 모든 속성 열을 락스텝으로 관리하고, 정수 인덱스 하나가 한 파티클의 전 상태를 가리킨다. 단 그 인덱스는 `RemoveAtSwap` 때문에 변하므로 정체성이 아니며, 그래서 **핸들**(SOA 포인터 + 인덱스 + 타입)이 존재한다. 둘째, **상속은 능력의 사다리다** — Static(위치·자세·모양) → Kinematic(+속도) → Rigid(+질량·관성·힘) → PBDRigid(+예측 `P/Q`)로 한 칸씩 열이 쌓이고, `P/Q` 가 PBD 솔버의 작업면이다. 셋째, **질량·관성은 역값(0=무한질량)으로, 텐서는 대각 3-벡터 + RotationOfMass 로 접혀** 저장된다 — C01 의 `FMatrix33` 은 계산 중간에만 등장한다.

다음은 **C03 — implicit geometry**다. §3 에서 파티클이 `MGeometry` 라는 *모양으로의 포인터 열*을 든다고만 하고 미뤄 둔, 바로 그 모양의 정체를 본다. `FImplicitObject` 계층이 Box·Sphere·Convex·HeightField·TriangleMesh 를 어떻게 한 추상으로 묶고, Scaled/Transformed/Union 으로 합성하는가. C02 가 "강체의 상태를 어떻게 저장하는가"였다면, C03 은 "그 강체가 점유하는 공간을 무엇으로 기술하는가"다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 주장 | 앵커 |
|---|---|
| SOA 저장 엔진: 열 목록 + 락스텝 리사이즈 | `ChaosCore/Public/Chaos/ArrayCollection.h:9,36,93~`; `ArrayCollectionArrayBase.h` |
| `TParticles` 는 위치 `MX` 열만 등록 | `Chaos/Public/Chaos/Particles.h:31,37`; `MX` 멤버 `:202` |
| RemoveAtSwap = O(1) 이나 순서 재배치 / Remove = O(n) | `Particles.h:24(enum),76`; `ArrayCollection.h:119` |
| "인덱스는 변할 수 있다" 경고 + ParticleIdx | `Chaos/Public/Chaos/ParticleHandle.h:412` |
| 영구 ID `FUniqueIdx` | `Chaos/Public/Chaos/GeometryParticlesfwd.h:86` |
| 자세 `MR`·모양 `MGeometry` 열 (float 회전) | `Chaos/Public/Chaos/SimpleGeometryParticles.h:127,130,55` |
| Geometry 층의 열들(UniqueIdx·Shapes·Bounds·SpatialIdx…) + Static 표식 | `Chaos/Public/Chaos/GeometryParticles.h:168,267~,641~` |
| Kinematic 층: `MV`·`MW`·`KinematicTargets` | `Chaos/Public/Chaos/KinematicGeometryParticles.h:19~,117~` |
| Rigid 층: 질량·관성·CoM·CoreData 등록 | `Chaos/Public/Chaos/RigidParticles.h:122~,174~,407~,415` |
| PBDRigid 층: 예측 `MP`/`MQ`·`MPreV`/`MPreW`·`MSolverBodyIndex` | `Chaos/Public/Chaos/PBDRigidParticles.h:53~`(RegisterArrays), 멤버 `:277,278` |
| EParticleType(컨테이너) vs EObjectStateType(런타임 상태) | `GeometryParticlesfwd.h:10`; `Chaos/Public/Chaos/Particle/ObjectState.h` |
| `TDynamicParticles` 는 강체와 별개 가지(softs) | `Chaos/Public/Chaos/DynamicParticles.h` |
| InvM/InvI=0 으로 정적/키네마틱 인코딩, Dynamic 전환 시 역수 계산 | `PBDRigidParticles.h:161~`(SetObjectState) |
| 관성 = 대각 3-벡터 + RotationOfMass(대각화) | `Chaos/Public/Chaos/RigidParticles.h:415`; `MassProperties.h:23~,36,40,69` |
| sleeping: 속도 0·상태 전이·PreV/PreW 보관 | `PBDRigidParticles.h:122~`(SetSleeping); `RigidParticles.h:65`(CoreData) |
| 핸들 = SOA 포인터 union + ParticleIdx + Type | `ParticleHandle.h:400~,412` |
| 핸들 접근자 = SOA 위임(GetX/GetP) | `ParticleHandle.h:558,1106` |
| 타입 기반 다운캐스트 Cast*Particle | `ParticleHandle.h:1691~,1697~` |
| `FGenericParticleHandle` 통합 wrapper(없는 속성=기본값) | `ParticleHandle.h:1765~,1853` |
| GT 파티클 ↔ PT 핸들 이중화, 컨텍스트 선택 | `ParticleHandleFwd.h`(끝부분 `TThreadParticle`) |
| 단정밀도 직렬화 전환(SinglePrecisonParticleDataPT) | `KinematicGeometryParticles.h`·`PBDRigidParticles.h` Serialize |
