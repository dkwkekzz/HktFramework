# ISPC 가이드 — 개념부터 직접 쓰는 법까지

> **무엇인가**: ISPC(Intel SPMD Program Compiler)는 "한 레인에서 도는 스칼라 코드처럼" 자연스럽게 쓰면 컴파일러가 알아서 SIMD 벡터 커널로 펼쳐주는 오픈소스 컴파일러다.
> **왜 이 문서**: Chaos 가 핫한 솔버 루프를 ISPC 로 가속한다(C00 §2 참조). 그 배경(Intel 전용인가? CPU 대안? GPU 가 낫지 않나?)과, 내가 직접 ISPC 커널을 쓰는 방법을 한곳에 정리한다.
> **관련**: [C00 — 모듈·빌드 지형](./C00-module-build.md) §2

---

## 1. "Intel" 이 붙었지만 Intel 전용이 아니다

이름의 함정이다. ISPC 는 **오픈소스(BSD 라이선스)** 컴파일러이고, Intel CPU 에서만 도는 게 아니다. 하는 일은 표준 SIMD 명령을 뽑아내는 것이라, 같은 명령셋을 쓰는 어떤 CPU 에서도 그대로 돈다.

지원 타깃을 보면 명확하다.

- **x86 계열**: SSE2, SSE4, AVX, AVX2, AVX512 — Intel 뿐 아니라 **AMD CPU 에서도 동일하게 동작**한다.
- **ARM NEON**: Apple Silicon(M1~), 모바일·콘솔의 ARM 칩.
- **Intel GPU**(Gen9, Xe 계열)도 타깃 가능하다.

호스트 OS 는 Windows·macOS·Linux, 빌드 타깃으로는 Android·iOS·PS4/PS5 까지 지원한다. 그래서 Chaos 의 `.ispc` 커널은 PC(Intel/AMD)·맥(ARM)·콘솔·모바일에서 모두 살아 있다. C00 에서 본 `p.Chaos.*.ISPC` 토글이 플랫폼과 무관하게 의미를 갖는 이유다.

2025 년 들어 ARM 지원이 특히 좋아졌다 — 1.26 버전부터 `--arch=arm` 이 ARMv7 이 아니라 ARMv8 로 매핑되고, 새 NEON 타깃(`neon-i16x16`, `neon-i8x32`)과 네이티브 dot product(sdot/udot)가 추가되어 ARMv8 성능이 평균 13% 올랐다. Apple Silicon 비중을 생각하면 의미 있는 변화다.

---

## 2. 다른 CPU SIMD 대안들 — 그리고 ISPC 의 자리

CPU 에서 SIMD 를 끌어내는 길은 ISPC 말고도 여럿 있다.

| 방법 | 장점 | 단점 |
|---|---|---|
| 컴파일러 자동 벡터화 | 가장 편함 (그냥 루프) | 가장 안 믿음직 — 루프가 조금만 복잡해도 포기 |
| 인트린식 직접 작성 (`_mm256_add_ps`, `vaddq_f32`) | 가장 빠름, 완전 제어 | **ISA 마다 따로 작성** → 이식성 최악 |
| SIMD 래퍼 라이브러리 (UE `VectorRegister`, Chaos `Simd4.h`, Google Highway, xsimd, `std::simd`, Eigen) | 한 코드로 여러 ISA | 추상화 비용·표현력 한계 |
| OpenMP `#pragma omp simd` | 지시어 한 줄 | 컴파일러 의존, 제어 약함 |
| **ISPC** | 자동 벡터화의 편의 + 인트린식급 성능 + 크로스-ISA | 별도 `.ispc` 소스·빌드 통합 필요 |

ISPC 의 독특한 자리는 **SPMD(Single Program, Multiple Data) 모델**이다. 인트린식처럼 ISA 별로 짜지 않고, "한 레인에서 도는 스칼라 코드"처럼 자연스럽게 쓰면 컴파일러가 알아서 여러 레인으로 펼쳐 벡터화한다. 즉 *편의성·성능·이식성*을 한 번에 노린다. Chaos 가 스프링·충돌·조인트 같은 뜨거운 솔버 루프를 굳이 ISPC 로 뽑은 이유다.

> 참고: Chaos 는 ISPC 와 자체 SIMD 래퍼(`Simd4.h`/`SimdTypes.h`)를 **병행**한다. ISPC 는 "대량 데이터 배치 루프"에, 자체 래퍼는 "한 벡터·행렬 단위 연산"에 쓰는 식으로 역할이 갈린다.

---

## 3. "GPU 로 하면 더 빠르지 않나" — 경우에 따라 다르다

핵심 오해 포인트다. GPU 가 *항상* 빠른 게 아니라, **물리 시뮬의 성격**에 달렸다.

**GPU 가 이기는 경우 — 데이터가 많고·독립적이고·규칙적일 때.** 천(cloth), 소프트바디, 파티클, 일부 파괴(destruction)는 수만~수십만 요소가 거의 독립적으로 갱신돼서 GPU 가 강하다. UE 도 이런 영역(Niagara, 일부 cloth/destruction)은 GPU 를 쓰고, ISPC 자체에도 Intel GPU 타깃이 있다.

**강체(rigid body) 코어 솔버가 CPU 에 남는 이유:**

- **데이터 의존성**: 제약 해소는 Gauss-Seidel 류 반복 풀이라 본질적으로 순차적이다. 한 제약의 결과가 다음 제약에 영향을 줘서 GPU 의 "수만 스레드 동시 실행" 모델과 잘 안 맞는다. (C09 의 island·graph coloring 이 바로 이 순차성에서 병렬성을 *짜내려는* 장치다.)
- **불규칙·분기 많은 작업**: 충돌 쌍은 매 프레임 개수·종류가 달라지고 분기가 많다. GPU 는 분기 다이버전스에 약하다.
- **레이턴시**: 게임 물리는 매 프레임 CPU(게임 스레드)와 데이터를 주고받는다. CPU↔GPU 왕복 지연이 커서, 적당한 강체 개수에서는 이 왕복 비용이 GPU 연산 이득을 까먹는다. GPU 는 "한 번 올려 오래 굴릴 때" 유리하다.
- **결정론**: 네트워크 동기화(C12·C13)용 결정론적 재현이 GPU 에선 훨씬 까다롭다.

요약: **많고 독립적이면 GPU, 적고 얽혀 있고 저지연이 중요하면 CPU SIMD.** Chaos 는 강체 코어를 후자로 보고 ISPC(CPU SIMD)를 택했고, 천·파티클처럼 전자에 해당하는 영역엔 GPU 경로를 따로 둔다.

---

## 4. 직접 써보기 (A) — 순수 ISPC 기초

UE 와 무관하게 ISPC 만으로 가장 작은 예시를 보자. 핵심 개념 세 가지: `export`(C 에서 부를 함수), `uniform`(모든 레인 공통 스칼라), `varying`(레인마다 다른 값 — 기본값), `foreach`(자동 벡터화 루프).

**`simple.ispc`**
```ispc
// 배열 두 개를 더해 out 에 쓴다. C 의 for 루프처럼 보이지만
// foreach 가 알아서 SIMD 레인 단위로 펼친다.
export void add_arrays(uniform float out[],
                       const uniform float a[],
                       const uniform float b[],
                       uniform int count)
{
    foreach (i = 0 ... count)   // i 는 varying — 레인마다 다른 인덱스
    {
        out[i] = a[i] + b[i];
    }
}
```

**컴파일** (헤더와 오브젝트 파일을 함께 생성):
```bash
ispc simple.ispc -o simple.o -h simple_ispc.h --target=avx2-i32x8
# 멀티타깃(런타임 디스패치)도 가능: --target=sse4,avx2,avx512skx
```

**C++ 에서 호출** — 생성된 헤더가 `ispc::add_arrays` 선언을 준다:
```cpp
#include "simple_ispc.h"   // ispc 가 생성

int main() {
    float a[8] = {1,2,3,4,5,6,7,8};
    float b[8] = {10,20,30,40,50,60,70,80};
    float out[8];
    ispc::add_arrays(out, a, b, 8);   // 일반 C 함수처럼 호출
}
```
```bash
clang++ main.cpp simple.o -o app   # ispc 오브젝트와 그냥 링크
```

`uniform`/`varying` 직관: `uniform int count` 는 모든 레인이 공유하는 스칼라(루프 횟수 등), 인자 없이 `varying` 인 값은 레인마다 다른 값(벡터 한 칸씩). `foreach` 안의 `i` 가 대표적인 varying 이다.

---

## 5. 직접 써보기 (B) — Unreal/Chaos 통합 방식

UE 에서는 `ispc` 를 손으로 부르지 않는다. **UnrealBuildTool(UBT)이 모듈 안의 `.ispc` 파일을 자동으로 찾아 컴파일**하고, `<파일>.ispc.generated.h` 헤더를 만들어준다. 우리가 할 일은 (1) 모듈이 `IntelISPC` 에 의존하게 하고, (2) `.ispc` 커널을 작성하고, (3) C++ 에서 생성 헤더를 include 해 호출하는 것뿐이다.

Chaos 의 실제 스프링 제약 커널을 표본으로 보자.

**(1) 모듈 의존** — `Chaos.Build.cs:20`
```csharp
PublicDependencyModuleNames.AddRange(new string[] { ... "IntelISPC", ... });
```

**(2) 커널** — `Chaos/Private/Chaos/PBDSpringConstraints.ispc`
```ispc
#define EXPLICIT_VECTOR4 1
#include "Math/Vector.isph"        // UE 가 제공하는 ISPC 헤더(.isph)
#include "Chaos/PBDSofts.isph"

export void ApplySpringConstraints(uniform FVector4f PandInvM[],
                                   const uniform FIntVector2 Constraints[],
                                   const uniform float Dists[],
                                   const uniform float Stiffness,
                                   const uniform int32 NumConstraints)
{
    foreach(i = 0 ... NumConstraints)
    {
        const varying FIntVector2 Constraint = VectorLoad(&Constraints[extract(i,0)]);
        const varying int32 i1 = Constraint.V[0];
        const varying int32 i2 = Constraint.V[1];

        const varying FVector4f PandInvM1 = VectorGather(&PandInvM[i1]);   // 흩어진 메모리 모으기
        const varying FVector4f PandInvM2 = VectorGather(&PandInvM[i2]);
        // ... P1,P2,InvM 분해 후 스프링 보정량 Delta 계산 ...
        VectorScatter(&PandInvM[i1], SetVector4(P1 - (InvM1 * Delta), InvM1)); // 흩어진 메모리 쓰기
        VectorScatter(&PandInvM[i2], SetVector4(P2 + (InvM2 * Delta), InvM2));
    }
}
```
`.isph` 는 ISPC 용 헤더(인터페이스)로, UE 가 `Math/Vector.isph` 같은 공용 수학 헤더를 제공한다. `VectorGather`/`VectorScatter` 는 인덱스가 제각각인(연속이 아닌) 데이터를 SIMD 로 모으고 흩는 연산 — 제약 솔버처럼 입자 인덱스가 불규칙할 때 핵심이다.

**(3) C++ 결합** — `PBDSpringConstraints.cpp`. Chaos 의 표준 4단 패턴이다.

```cpp
#if INTEL_ISPC
#include "PBDSpringConstraints.ispc.generated.h"   // (a) UBT 가 생성한 헤더  :13

// (b) C++ 구조체와 ISPC 구조체의 메모리 레이아웃이 바이트 단위로 같은지 컴파일 타임 검증
static_assert(sizeof(ispc::FVector4f) == sizeof(Chaos::Softs::FPAndInvM), "...");  // :19
static_assert(sizeof(ispc::FIntVector2) == sizeof(Chaos::TVec2<int32>), "...");    // :20

// (c) 런타임 토글 CVar (비-Shipping 에서만 변수)
bool bChaos_Spring_ISPC_Enabled = CHAOS_SPRING_ISPC_ENABLED_DEFAULT;               // :23
FAutoConsoleVariableRef CVarChaosSpringISPCEnabled(
    TEXT("p.Chaos.Spring.ISPC"), bChaos_Spring_ISPC_Enabled, TEXT("..."));         // :24
#endif

// ... 적용부 ...  (:108~)
#if INTEL_ISPC
if (bRealTypeCompatibleWithISPC && bChaos_Spring_ISPC_Enabled)        // (d) ISPC 경로
{
    for (int32 c = 0; c < ConstraintColorNum; ++c)
    {
        const int32 ColorStart = ConstraintsPerColorStartIndex[c];
        const int32 ColorSize  = ConstraintsPerColorStartIndex[c+1] - ColorStart;
        ispc::ApplySpringConstraints(
            (ispc::FVector4f*)Particles.GetPAndInvM().GetData(),       // C++ 포인터를 ispc:: 타입으로 캐스팅
            (ispc::FIntVector2*)&Constraints.GetData()[ColorStart],
            &Dists.GetData()[ColorStart],
            ExpStiffnessValue, ColorSize);
    }
}
else
#endif
{
    // (d') 스칼라 폴백 — ISPC 가 꺼졌거나 컴파일 안 됐을 때
    for (int32 c = 0; c < ConstraintColorNum; ++c)
    {
        // ... PhysicsParallelFor + ApplyHelper(...) 로 한 제약씩 처리 ...
    }
}
```

요점 정리:
- **(a) 생성 헤더**: `<커널이름>.ispc.generated.h` 를 `#if INTEL_ISPC` 안에서 include. 직접 만들지 않는다(UBT 가 생성).
- **(b) `static_assert`**: ISPC 와 C++ 가 같은 메모리를 공유하므로, 두 언어의 구조체 크기가 어긋나면 즉시 컴파일 에러로 잡는다. ISPC 통합에서 가장 흔한 버그(레이아웃 불일치)를 원천 차단.
- **(c) CVar**: `p.Chaos.<X>.ISPC` 로 런타임 on/off. Shipping 빌드에선 `static constexpr` 로 굳어 토글 불가(C00 §2 "두 겹의 문").
- **(d) 이중 경로**: 항상 ISPC 경로 옆에 **스칼라 폴백**을 둔다. ISPC 가 컴파일 제외(`#if INTEL_ISPC` 거짓)거나 런타임에 꺼졌을 때 같은 결과를 내야 하므로. `bRealTypeCompatibleWithISPC`(C00 §2, `FReal` 이 float/double 일 때만 참) 검사도 함께 건다.

---

## 6. 직접 써보기 (C) — 내 UE 모듈에 ISPC 커널 추가 레시피

1. **모듈 의존 추가** — `MyModule.Build.cs` 의 `PublicDependencyModuleNames`(또는 Private)에 `"IntelISPC"` 를 넣는다.
2. **커널 작성** — `MyModule/Private/.../MyKernel.ispc` 생성. 데이터는 가능하면 SOA(배열) 형태로 받게 설계한다(`foreach` 가 잘 펼쳐지도록). 공용 수학이 필요하면 `#include "Math/Vector.isph"`.
3. **공유 구조체 정렬** — C++ 쪽 구조체와 ISPC 쪽 타입의 메모리 레이아웃을 맞추고, `.cpp` 에 `static_assert(sizeof(...) == sizeof(...))` 로 못 박는다.
4. **C++ 결합** — `#if INTEL_ISPC` 안에서 `#include "MyKernel.ispc.generated.h"` 후 `ispc::MyKernel(...)` 호출. C++ 포인터는 `(ispc::FFoo*)` 로 캐스팅해 넘긴다.
5. **토글 + 폴백** — `bMyKernel_ISPC_Enabled` 전역 + `FAutoConsoleVariableRef`(`p.MyModule.MyKernel.ISPC`)를 만들고, `if (ISPC 가능 && 켜짐) { ispc 경로 } else { 스칼라 경로 }` 로 양쪽 결과가 같도록 짠다.
6. **빌드** — 평소처럼 빌드하면 UBT 가 `.ispc` 를 자동 컴파일하고 `.generated.h` 를 만든다. 별도 `ispc` 호출 불필요.
7. **검증** — `p.MyModule.MyKernel.ISPC 0/1` 로 두 경로 결과를 비교(개발 빌드 한정). 비트 단위로 다를 수 있으니(SIMD 연산 순서 차이) 결정론이 중요하면 허용 오차·연산 순서를 검토한다.

> **함정 메모**: SIMD 경로와 스칼라 경로는 부동소수점 연산 순서가 달라 결과가 비트 단위로 갈릴 수 있다. 네트워크 결정론(C13)이 걸린 코드라면 이 차이를 반드시 통제 대상으로 본다.

---

## 7. 언제 ISPC 를 쓰는가 — 적용 판단 기준 (ECS·데이터 지향 로직)

ECS(Entity Component System)나 데이터 지향 설계와 ISPC 는 궁합이 좋다. ECS 는 컴포넌트를 SOA(배열)로 연속 저장하고 시스템이 그 배열을 쭉 훑는데, 이게 정확히 SIMD 가 원하는 형태다 — `foreach(i = 0 ... N)` 가 "컴포넌트 X 를 가진 모든 엔티티"에 그대로 매핑된다. (Unity DOTS+Burst 가 이 발상 그 자체다.)

그렇다고 **모든** ECS 시스템에 ISPC 를 까는 건 손해다. ISPC 가 실제로 이득인 시스템은 아래 네 조건을 **동시에** 만족할 때다.

| 조건 | 좋은 예 | 나쁜 예 |
|---|---|---|
| **레인 독립성** (가장 중요) — 각 엔티티를 서로 영향 없이 처리 | 이동 적분 `pos += vel*dt`, 데미지 계산, 파티클 갱신 | 충돌·공간 쿼리·계층 변환 등 엔티티가 *다른* 엔티티를 읽고 쓰는 것 |
| **연산 집약적** — FLOP 이 많음 | 수학 무거운 변환·물리 | 메모리만 들었다 놨다 하는 memory-bound 시스템 |
| **분기 적음** — 레인 다이버전스 없음 | 균일한 산술 루프 | `if` 가 많아 레인마다 다른 길로 가는 로직 |
| **충분히 많고 뜨거움** — 통합 비용을 넘는 이득 | 매 프레임 도는 대량 엔티티 | 엔티티 적거나 가끔 도는 시스템 |

**레인 독립성**이 핵심이다. 엔티티가 다른 엔티티를 건드리면 SIMD 의 "모든 레인 동시 실행" 가정이 깨진다 — 이게 C09 의 island·graph coloring 이 존재하는 이유다(의존성을 억지로 독립 그룹으로 쪼개야 병렬화가 된다).

**비용도 잊지 말 것.** ISPC 는 별도 `.ispc` 언어, C++↔ISPC 레이아웃 `static_assert` 동기화, 스칼라 폴백 이중 경로, 디버깅 난이도, 빌드 복잡도를 더한다. 안 뜨거운 코드에까지 깔면 코드베이스가 두 배로 무거워지고 버그 표면만 늘어난다.

**그리고 ECS 의 캐시 친화적 레이아웃 이득은 ISPC 없이도 얻어진다.** 잘 짠 ECS 는 평범한 스칼라 C++ 로도 빠르고, 단순 루프는 컴파일러 자동 벡터화나 `Simd4.h` 래퍼로도 어느 정도 먹힌다. ISPC 는 그 위에 얹는 *두 번째* 최적화지 기본값이 아니다.

> **실전 규칙**: 먼저 프로파일링하고, **뜨겁고·넓고·연산 많고·레인 독립적인 소수의 시스템에만** ISPC 를 박아라. Chaos 가 정확히 이렇게 한다 — 전부 ISPC 로 짜지 않고 스프링·충돌·조인트·천 같은 특정 솔버 루프만 골라 쓰며, 항상 스칼라 경로를 옆에 둔다. ECS 로 치면 "모든 시스템"이 아니라 "physics integration·particle update 같은 핫 시스템 몇 개"에 선택 적용하는 그림이다.

---

## 부록 — 앵커 일람 (UE 5.7)

| 주장 | 앵커 |
|---|---|
| Chaos 모듈의 `IntelISPC` 의존 | `Chaos/Chaos.Build.cs:20` |
| ISPC 커널 예시(`export`/`foreach`/gather/scatter) | `Chaos/Private/Chaos/PBDSpringConstraints.ispc:16-58` |
| 생성 헤더 include·static_assert·CVar | `Chaos/Private/Chaos/PBDSpringConstraints.cpp:13,19-20,23-24` |
| ISPC/스칼라 이중 경로 | `Chaos/Private/Chaos/PBDSpringConstraints.cpp:111-141` |
| `FReal` ISPC 호환 검사 | `ChaosCore/Public/Chaos/Real.h:28` |

## 출처 (개념 §1~§3)

- [Intel ISPC 1.26 Compiler Delivers Improved ARM Support — Phoronix](https://www.phoronix.com/news/Intel-ISPC-1.26)
- [Features — Intel® Implicit SPMD Program Compiler](https://ispc.github.io/features.html)
- [Intel® Implicit SPMD Program Compiler (ispc.github.io)](https://ispc.github.io/)
- [GitHub — ispc/ispc](https://github.com/ispc/ispc)
