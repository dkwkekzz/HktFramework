# C00 — 모듈·빌드 지형

> **이 챕터가 답하는 질문**: Chaos 소스를 처음 열면 800개가 넘는 파일이 쏟아진다. 그중 *어디부터*, *어떤 순서로* 읽어야 하며, 내가 지금 보는 코드가 *실제로 빌드되는 코드가 맞는지*를 어떻게 아는가?
> **대응 Concepts**: 없음 (순수 구현 지형)
> **선행 챕터**: 없음 — 여기가 시작점이다.

---

## 왜 이 챕터를 가장 먼저 읽는가

알고리즘을 한 줄도 다루지 않는 이 챕터를 맨 앞에 두는 이유는 단순하다. **지형을 모르면 길을 잃기 때문**이다.

Chaos 코드를 읽다 보면 세 번 멈칫하게 된다. 첫째, "이 클래스는 어느 모듈에 속하고, 왜 저 모듈은 안 건드려도 되지?" 둘째, "여기 `FReal` 은 float 인가 double 인가? `FRealSingle` 은 또 뭐지?" 셋째, "이 `#if INTEL_ISPC` 블록은 실제로 도는 코드인가, 죽은 코드인가?"

이 세 가지는 알고리즘이 아니라 **빌드 시스템의 문제**다. 한 번 정리해두면 이후 모든 챕터에서 다시 묻지 않아도 된다. 그래서 C00 의 목표는 딱 세 가지를 내 머릿속에 고정하는 것이다 — 모듈의 **경계와 의존 방향**, 같은 소스를 다른 바이너리로 만드는 **컴파일 토글**, 그리고 코드 전체를 가로지르는 **규약**(CVar 이름·로그·`Public/Private`).

---

## 1. 세 개의 모듈, 그리고 그것을 설명하는 하나의 규칙

분석 대상의 본체는 `Source/Runtime/Experimental/` 아래 세 모듈이다. 크기부터 보면 무게 중심이 어디 있는지 한눈에 보인다 — **ChaosCore**(38파일), **Chaos**(800여 파일), **ChaosSolverEngine**(25파일). 가운데가 압도적으로 무겁고 양 끝은 얇다. 정작 중요한 건 이 세 모듈이 *어느 방향으로 의존하는가*인데, 의존 방향이 README 의 핵심 전략("본체 3모듈만 끝까지 이해하면 나머지는 그 위에 올라탄 특화 솔버로 빠르게 읽힌다")을 그대로 증명해준다.

규칙은 하나다: **의존은 아래로만 흐른다.**

맨 아래 **ChaosCore** 는 오직 `Core` 와 `IntelISPC` 에만 의존한다. 주목할 점은 `CoreUObject` 에 의존하지 *않는다*는 것 — 즉 UObject·리플렉션 없이 순수한 수학과 타입만 담는다. 이게 ChaosCore 가 최하단인 이유이고, 그래서 `FReal`·`FVec3`·`Matrix` 같은 기본 벽돌은 엔진의 어떤 무거운 개념도 끌어들이지 않는다.

가운데 **Chaos** 는 본체다. ChaosCore 위에 얹혀 `CoreUObject`(UObject 사용), `IntelISPC`(SIMD 커널), `GeometryCore`, 그리고 비주얼 디버거(CVD, ChaosVisualDebugger)용 `ChaosVDRuntime` 등에 의존한다. 내부적으로는 `Eigen`(선형대수·SVD)과 `MeshDescription` 을 비공개로 쓴다. 한 가지 흥미로운 흔적이 있는데, `PhysicsCore` 를 *링크 의존이 아니라 인클루드 경로로만* 끌어온다. `ChaosEngineInterface.h` 한 헤더 때문인데, 이건 게임 스레드 브리지(C14)가 여기쯤 걸쳐 있다는 신호다.

맨 위 **ChaosSolverEngine** 는 비로소 `Engine` 에 의존한다. 거꾸로 말하면 **본체 Chaos 는 `Engine` 을 모른다** — 월드도, 액터도 모른다. 월드와의 통합은 전부 SolverEngine 이 떠안는다. 바로 이 단방향성이 "본체만 이해하면 된다"는 전략의 구조적 근거다. 본체는 자족적이라 월드 없이도 말이 되고, 위성 모듈들은 그 위에 끼워 맞춰진 것일 뿐이다.

런타임에서 이 모듈들이 살아나는 진입점도 기억해둘 만하다. `IMPLEMENT_MODULE(FChaosEngineModule, Chaos)` 가 Chaos 를 UE 모듈 매니저에 등록하고, 그 `StartupModule` 이 `GeometryCore` 를 먼저 로드한 뒤 `-SingleThreadedPhysics` 커맨드라인 플래그를 파싱한다(이건 뒤의 결정론 얘기로 이어진다). 솔버를 실제로 만들고 소유하는 레지스트리는 별도의 `FChaosSolversModule` 이고, 전용 물리 스레드 관련 전역 CVar 들이 여기 모여 산다 — C12 의 예고편이다.

---

## 2. 내가 읽는 코드가 실제로 도는 코드인가 — 같은 소스, 다른 바이너리

Chaos 에서 가장 헷갈리는 함정은, **소스 한 벌이 빌드 설정에 따라 전혀 다른 바이너리가 된다**는 점이다. 코드를 읽을 때 "이 줄이 정말 실행되나?"를 판단하려면 토글이 어디서 결정되는지를 알아야 한다.

### 정밀도: `FReal` 은 무엇인가

기본 시뮬레이션 정밀도는 **double** 이다. `Real.h` 에 `using FReal = FRealDouble`(=double)로 못 박혀 있고, 그 옆에 `FRealSingle`(=float)이 따로 있다. 둘이 나뉜 건 의도다 — `FReal`(double)은 월드 좌표나 누적되는 상태처럼 정밀도가 중요한 곳에 쓰고, `FRealSingle`(float)과 그 친척 `FSolverReal` 류는 솔버 내부의 뜨거운 루프나 ISPC 경계처럼 속도가 중요한 곳에 쓴다. 그래서 코드에서 둘이 섞여 보이면 그건 버그가 아니라 "정밀도 대 성능"이라는 트레이드오프의 흔적으로 읽으면 된다. (이 정책의 타입 레벨 구체화는 C01 에서 본다.)

이 정책을 지키게 만드는 안전장치도 빌드 단에 있다. 두 본체 모듈 모두 암묵적 좁힘 캐스트(double↔float 같은)를 **경고가 아니라 에러로 승격**시킨다. 정밀도 사고를 컴파일 단계에서 막겠다는 뜻이다.

### ISPC: 두 겹의 문을 통과해야 도는 코드

ISPC(Intel SPMD Program Compiler)는 한 명령으로 여러 데이터를 동시에 처리하는 SIMD 벡터 커널을 별도 `.ispc` 소스로 작성하게 해주는 컴파일러다. Chaos 에는 이런 `.ispc` 파일이 23개 있어 무거운 솔버 루프를 가속한다. 핵심은, 한 기능의 ISPC 경로가 **두 겹의 문**을 통과해야 실제로 돈다는 것이다.

첫 번째 문은 컴파일 타임이다. `#if INTEL_ISPC` 로 커널 자체가 포함될지 정해지고, `CHAOS_<X>_ISPC_ENABLED_DEFAULT` 매크로가 기본 on/off 를 정한다. 두 번째 문은 런타임이다. `p.Chaos.<X>.ISPC` CVar 로 켜고 끌 수 있다. 단, **이 런타임 토글은 비-Shipping 빌드에서만 변수**이고, Shipping 빌드에서는 `static constexpr` 상수로 굳어져 더 이상 바꿀 수 없다. 그래서 "ISPC 켜고 끄며 비교 디버깅"은 개발 빌드에서만 가능하다.

읽는 요령: ISPC 결합부는 어느 파일에서나 거의 똑같은 관용구를 쓴다. `#if INTEL_ISPC` 로 생성된 `.ispc.generated.h` 를 포함하고, 바로 아래 `static_assert` 로 C++ 구조체와 ISPC 구조체의 **메모리 레이아웃이 바이트 단위로 일치하는지** 컴파일 타임에 검증한 뒤, CVar 를 단다. 이 패턴을 한 번 익히면 어느 솔버 파일에서든 ISPC 블록을 빠르게 건너뛰거나 따라갈 수 있다.

### 그 밖의 토글

나머지 컴파일 토글은 "이 바이너리가 어떤 모드로 빌드됐나"를 알려주는 단서들이다. `CHAOS_DEBUG_NAME` 은 Shipping/Test 가 아닐 때만 켜져 파티클·제약에 사람이 읽을 수 있는 이름을 붙인다 — 그래서 CVD 나 로그에 디버그 이름이 안 보이면 Shipping/Test 빌드라는 뜻이다. `CHAOS_CHECKED`(추가 검증)와 `CHAOS_MEMORY_TRACKING`(메모리 추적)은 각각 빌드 옵션으로 켜고, `COMPILE_WITHOUT_UNREAL_SUPPORT=0` 은 Chaos 가 *항상* UE 와 함께 빌드됨을 고정한다(스탠드얼론 모드 비활성).

---

## 3. 모든 챕터를 가로지르는 규약

이후 어느 챕터를 펴든 반복해서 마주칠 약속들이 있다. 미리 익혀두면 매번 해석할 필요가 없다.

**CVar 는 `p.Chaos.<서브시스템>.<설정>` 계층 이름을 쓴다.** 보통 해당 `.cpp` 안 `namespace Chaos { namespace CVars { ... } }` 블록에서 전역 변수 하나와 `FAutoConsoleVariableRef` 하나가 쌍으로 정의된다. 변수명 접두 `b` 는 bool, `Chaos_` 는 설정값이다. 그래서 어떤 서브시스템의 "노브 전체 목록"을 한 번에 보고 싶으면 그 파일에서 `FAutoConsoleVariableRef CVarChaos` 를 grep 하면 된다 — 이 grep 한 줄이 이후 챕터마다 토글 카탈로그를 뽑는 표준 도구가 된다.

**로그는 카테고리로 갈린다.** `ChaosLog.h` 에 `LogChaosGeneral`·`LogChaosThread`·`LogChaosSimulation`·`LogChaosDebug`·`LogChaosDataflow` 와 포괄 카테고리 `LogChaos` 가 있다. (5.7 에서 옛 `UManagedArrayLogging` 은 deprecated 되어 `LogChaos` 로 통합됐다.)

**헤더는 `Public/`(외부 노출)과 `Private/`(구현)로 나뉜다.** 외부에 보이는 심볼에는 `CHAOS_API` 가 붙는다. 어떤 타입을 다른 모듈에서 쓸 수 있는지는 그게 `Public/` 에 있고 `CHAOS_API` 가 붙었는지로 판단한다.

---

## 4. 결정론·스레딩 — 미리 박아둘 씨앗

Chaos 는 비동기·물리-스레드·재시뮬레이션(resim, 과거 프레임을 되감아 다시 시뮬레이션) 구조라 게임 스레드(GT)와 물리 스레드(PT)의 경계가 모든 챕터를 횡단한다. C00 단계에서 알아둘 씨앗은 네 가지다.

전용 물리 스레드는 `p.Chaos.DedicatedThreadEnabled`(기본 켜짐)로 제어되며, 이것이 GT/PT 경계가 존재하는 근본 이유다(상세는 C12~C14). 그 경계가 만드는 비결정성을 디버깅할 때 1차 도구가 `-SingleThreadedPhysics` 플래그로, 멀티스레드를 배제하고 재현 가능한 단일 경로로 돌린다.

정밀도도 결정론 변수다. 기본은 double 이지만 솔버 핫패스는 float 이고, float 경로는 플랫폼·컴파일러 간 부동소수점 연산 순서에 더 민감하다 — 네트워크 결정론(C13)에서 다시 도마에 오른다. 마찬가지로 ISPC(SIMD) 경로와 스칼라 경로는 연산 순서가 달라 비트 단위 결과가 갈릴 수 있으니, `p.Chaos.*.ISPC` 토글은 결정론 비교 시 반드시 통제해야 할 변수다.

---

## 5. 무엇을 들고 다음으로 가는가

C00 을 덮을 때 머릿속에 남아야 할 것은 표가 아니라 세 문장이다.

첫째, **의존은 아래로만 흐른다** — 맨 아래 ChaosCore(UObject 모름), 그 위에 얹힌 Chaos(월드 모름), 맨 위에서 월드와 잇는 ChaosSolverEngine. 그래서 본체만 이해하면 된다. 둘째, **내가 읽는 코드가 도는 코드인지는 토글이 정한다** — `FReal` 의 정밀도, ISPC 의 두 겹 문, Shipping 여부. 셋째, **노브와 로그는 규약을 따른다** — `p.Chaos.*` 와 `LogChaos*`, 그리고 `grep "FAutoConsoleVariableRef CVarChaos"` 라는 만능 열쇠.

다음은 **C01 — 코어 타입·수학**이다. 여기서 추상으로 잡은 정밀도 정책(`FReal`/`FRealSingle`)과 ISPC 게이트가, 거기서는 `FVec3`·`FRotation3`·`FRigidTransform3`·`Matrix` 와 `Simd4.h`·`Matrix33.isph` 같은 *실제 타입*으로 손에 잡힌다.

---

## 부록 A — 검증용 앵커 일람 (UE 5.7 기준)

> 본문의 모든 주장은 아래 `파일:라인` 으로 실측 검증했다. 후속 버전에서 라인이 바뀌면 이 표만 갱신한다.

| 주장 | 앵커 |
|---|---|
| Chaos 모듈 정의·의존·유니티 빌드 청크 크기 오버라이드·캐스트 에러 승격 | `Chaos/Chaos.Build.cs:12,14-27,28-33,35-38,40-47,49,51,53-54` |
| ChaosCore 의존(Core+IntelISPC만, CoreUObject 없음)·정의·캐스트 에러 | `ChaosCore/ChaosCore.Build.cs:9-14,16,18-25,27-34,35` |
| ChaosSolverEngine 가 Engine 에 의존·물리지원·네임스페이스 | `ChaosSolverEngine/ChaosSolverEngine.Build.cs:9-23,26,27,28,30` |
| 모듈 등록·StartupModule·GeometryCore 선로드·단일스레드 플래그·CVD | `Chaos/Private/ChaosModule.cpp:9,16,18-25,28-29` |
| 솔버 레지스트리·스레딩 CVar | `Chaos/Private/ChaosSolversModule.cpp` (`p.Chaos.DedicatedThreadEnabled`, `p.Chaos.Thread.DesiredHz`, `p.Chaos.Thread.WaitThreshold`) |
| `FReal=double` 기본·`FRealSingle=float`·ISPC 호환 정책 | `ChaosCore/Public/Chaos/Real.h:13,14,22,28` |
| ISPC 결합 3중 패턴(포함·static_assert·CVar) | `Chaos/Private/Chaos/PBDSpringConstraints.cpp:12,19,23,24` |
| ISPC 기본값 매크로·Shipping constexpr 경로 | `Chaos/Public/Chaos/PBDSpringConstraints.h:250-251,260` |
| CVar 명명 규약 예시(`p.Chaos.PBDCollisionSolver.Position.*`) | `Chaos/Private/Chaos/Collision/PBDCollisionSolver.cpp:31-37` |
| 로그 카테고리·deprecated 통합 | `Chaos/Public/ChaosLog.h:8-20` |

## 부록 B — 빌드 토글 빠른 참조

| 토글 | 값/조건 | 효과 |
|---|---|---|
| `FReal` | `= double` (기본) | 시뮬 기본 정밀도. 핫패스는 `FRealSingle`(float) |
| `INTEL_ISPC` + `p.Chaos.*.ISPC` | 컴파일+런타임 이중 문 | SIMD 커널 경로 on/off (Shipping 은 constexpr 고정) |
| `CHAOS_DEBUG_NAME` | non-Shipping/Test 시 1 | 파티클·제약 디버그 이름 (없으면 = Shipping/Test 빌드) |
| `CHAOS_CHECKED` | 빌드 옵션 | 추가 `check` 검증 |
| `CHAOS_MEMORY_TRACKING` | 빌드 옵션 | 메모리 추적 계측 |
| `COMPILE_WITHOUT_UNREAL_SUPPORT` | `0` 고정 | Chaos 는 항상 UE 와 함께 빌드 |
