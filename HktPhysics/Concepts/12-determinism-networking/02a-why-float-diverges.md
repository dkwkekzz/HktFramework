# [12·2.2a] 왜 같은 코드가 플랫폼마다 갈리는가 (Why Identical Code Diverges Across Platforms)

> "IEEE 754 는 표준이라며? 그런데 왜 같은 소스가 x86 과 ARM 에서, MSVC 와 Clang 에서 마지막 비트가 다른가?"를 **근본부터** 푼다. 답은 IEEE 가 규정한 것과 *풀어 둔 것* 의 틈에 있다.
> **상위 노드**: [02-float-enemies.md](02-float-enemies.md) · [12-determinism-networking.md](../12-determinism-networking.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations](../00-foundations.md)

---

## 0. 한 문장 요약

> **IEEE 754 는 "기본 연산 *하나하나*"의 결과만 못 박았다 — 표현식 전체를 *어떤 순서로*, *어느 중간 정밀도로*, *몇 번 반올림하며* 평가할지는 컴파일러·CPU 에 맡겼다.** 같은 소스라도 컴파일러가 그 자유를 다르게 쓰면(FMA 융합·재결합·중간 정밀도·초월함수 구현) 결과 비트가 갈린다. 결정론은 이 자유를 *전부 빼앗는* 작업이다.

아래는 이 문장을 네 갈래로 풀어낸 것이다.

---

## 1. IEEE 754 가 보장하는 것과 안 하는 것

IEEE 754 의 핵심 약속은 정확히 이것이다:

> `+`, `-`, `*`, `/`, `sqrt` 같은 **기본 연산은, 무한 정밀도로 계산한 참값을 현재 반올림 모드로 한 번 반올림한 값** 과 비트까지 같아야 한다 (correctly rounded). 입력이 같으면 출력 비트가 같다.

이것만 보면 결정적이어야 마땅하다. 그런데 표준이 **규정하지 않은** 것들이 있다:

- **표현식의 평가 순서·결합** — `a+b+c` 를 `(a+b)+c` 로 할지 `a+(b+c)` 로 할지. C/C++ 표준은 부동소수점 재결합을 컴파일러 재량으로 둘 여지를 준다(특히 fast-math).
- **중간 결과의 정밀도** — `float r = a*b + c;` 에서 `a*b` 를 32bit 로 잘라 저장하고 더할지, 더 넓은 정밀도(80bit, 또는 FMA 의 무한정밀 중간값)로 들고 갈지.
- **초월함수의 마지막 비트** — `sin`/`cos`/`exp`/`pow` 는 correctly-rounded 를 **요구하지 않는다**. 구현마다 ULP 가 다를 자유가 있다.
- **denormal/예외 처리·반올림 모드의 기본값** — 빌드·런타임 플래그에 좌우된다.

> 결정론이 깨지는 모든 경로는 이 "풀어 둔 것" 중 하나로 환원된다. 아래 §2~§4 가 그 틈을 구체화한다.

---

## 2. FMA — "곱하고 더하기"가 한 번 반올림될 때

`r = a*b + c` 를 두 방식으로 계산할 수 있다:

```
방식 A (분리):  t = round(a*b);  r = round(t + c)     // 반올림 두 번
방식 B (FMA):   r = round(a*b + c)                    // 중간 반올림 없이 한 번
```

FMA(fused multiply-add)는 `a*b` 의 **무한정밀 중간값**을 들고 있다가 `+c` 까지 한 뒤 *한 번만* 반올림한다. 그래서 방식 B 가 더 정확하지만 — **방식 A 와 다른 비트**를 낸다.

핵심은: 두 방식 다 IEEE 754 *위반이 아니다*. 표준은 "FMA 연산은 한 번 반올림"이라 규정하고, 또 별도의 mul·add 도 각각 정확 반올림이면 합법이다. **둘 중 무엇을 쓸지를 표준이 안 정한다.** AVX2/NEON 은 FMA 명령이 있어 컴파일러가 융합하고, 구형 타깃은 분리 연산을 낸다 → 같은 소스, 다른 비트.

→ 대응: `-ffp-contract=off` 로 융합 금지(모든 타깃을 방식 A 로 통일), 또는 *모든* 타깃에서 FMA 를 강제해 방식 B 로 통일. 어느 쪽이든 **하나로 못 박는** 것이 핵심.

---

## 3. x87 80비트 — 같은 CPU 안에서도 갈리는 이중 반올림

구형 32-bit x86 의 x87 FPU 는 레지스터 내부를 **80비트 확장 정밀도**로 계산한다. 코드가 `double`(64bit)을 다뤄도 레지스터 안에서는 80bit 로 누적되다가, 값이 메모리로 **spill** 될 때 비로소 64bit 로 절단된다.

```
레지스터에 머무는 동안:  80bit 정밀도로 계산
메모리로 spill 되는 순간: 64bit 로 반올림 (절단)
```

문제는 **언제 spill 되느냐가 레지스터 압박(register pressure)에 달렸다**는 것 — 즉 컴파일러의 레지스터 할당, 주변 코드량, 최적화 수준에 따라 같은 식이 어떤 때는 80bit 중간값으로, 어떤 때는 64bit 절단을 거쳐 계산된다. 이게 **이중 반올림(double rounding)**: 80bit 로 반올림한 뒤 다시 64bit 로 반올림하면, 처음부터 64bit 로 한 번 반올림한 것과 다를 수 있다.

→ 대응: **x87 을 아예 쓰지 않는다.** SSE/SSE2 스칼라 경로 강제(`-mfpmath=sse -msse2`). SSE 는 32/64bit 폭으로 직접 계산해 확장 정밀도 자체가 없으므로 이 문제가 사라진다. 64-bit 빌드는 기본이 SSE2 라 보통 안전.

---

## 4. 초월함수 — 표준이 손 뗀 영역

`sin`, `cos`, `exp`, `log`, `pow` 는 무리수·초월수를 내므로 "무한정밀 참값을 한 번 반올림"을 *합리적 비용으로* 보장하기 어렵다(table-maker's dilemma). 그래서 IEEE 754 는 이들에 correctly-rounded 를 **권고만** 하고 강제하지 않는다.

결과적으로:

- glibc 의 `sin`, MSVC CRT 의 `sin`, Apple libm 의 `sin` 이 같은 입력에 **다른 마지막 비트**를 낼 수 있다.
- SIMD 벡터화 버전(`__m256` sin)과 스칼라 버전이 다를 수 있다.
- 같은 라이브러리라도 버전업으로 ULP 가 바뀔 수 있다.

이건 컴파일 플래그로 못 막는다. 라이브러리·하드웨어의 구현 차이이기 때문.

→ 대응: 크로스플랫폼 bit-exact 가 목표면 **자체 결정적 구현으로 교체** — 룩업 테이블 + 다항식(미니맥스/체비셰프) 근사, 또는 [03-fixed-point](03-fixed-point.md) 의 정수 알고리즘. "표준 libm 을 부르지 않는다"가 원칙.

---

## 5. 종합 — 왜 `/fp:strict` 만으로 부족한가

`/fp:strict`(또는 `-frounding-math -ffp-contract=off`)는 §2(FMA 융합 금지)·§3(엄격 IEEE 평가)·재결합 금지를 잡아 준다. **그래서 same-binary·same-platform 결정론에는 충분**하다. 하지만:

- §4 초월함수는 *라이브러리* 문제라 컴파일 플래그가 못 건드린다.
- FMA *가용성* 자체가 플랫폼마다 다르면 "융합 금지"로 통일해도, 통일된 그 결과가 다른 코드 경로(예: 손으로 쓴 SIMD)와 어긋날 수 있다.

> 그래서 **크로스플랫폼 bit-exact 의 사다리**는: ① 엄격 IEEE 모드로 컴파일러 자유 박탈 → ② x87 회피(SSE) → ③ 초월함수 자체 구현 → ④ 그래도 불안하면 부동소수점을 버리고 [fixed-point](03-fixed-point.md) 로. 위로 갈수록 "표준이 풀어 둔 자유"를 더 많이 빼앗는다.

---

## 6. 함정 (전체 체크리스트는 [12-determinism-networking §5](../12-determinism-networking.md#5-함정--결정론-체크리스트))

- **"IEEE 라서 안전"** — IEEE 는 *기본 연산 하나*만 보장한다. 표현식 평가·초월함수는 보장 밖.
- **FMA 비통일** — 일부 타깃만 융합하면 비트가 갈린다. off 로 끄거나 on 으로 통일, 둘 중 하나로.
- **x87 잔존** — 32-bit 레거시 빌드에서 spill 타이밍 의존. SSE2 강제.
- **표준 `sin/cos` 호출** — 크로스플랫폼이면 libm 직접 호출 금지, 자체 근사로.

---

## 7. 더 읽기

- [02-float-enemies](02-float-enemies.md) — 적들의 개요(이 문서의 상위 절)와 대응 요약 표.
- [03-fixed-point](03-fixed-point.md) — 부동소수점 자유를 원천 제거하는 정수 산술.
- [00-foundations](../00-foundations.md) / [00-foundations/05-numerical-floating-point](../00-foundations/05-numerical-floating-point.md) — IEEE 754·상쇄·조건수·ULP 의 기초.
- David Goldberg, "What Every Computer Scientist Should Know About Floating-Point Arithmetic" (1991).
- Glenn Fiedler, "Floating Point Determinism" (gafferongames) — 게임 맥락의 실전 정리.
