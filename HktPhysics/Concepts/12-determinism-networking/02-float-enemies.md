# [12·2.2] 부동소수점 결정론의 적 (The Enemies of Float Determinism)

> IEEE 754 기본 연산은 결정적이다. 비결정은 부동소수점이 아니라 *그 위의 컴파일러·하드웨어·실행 순서*에서 온다. 적을 정확히 지목하고 하나씩 닫는다.
> **상위 노드**: [12-determinism-networking.md](../12-determinism-networking.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations](../00-foundations.md)

---

IEEE 754 `float`/`double` 자체는 **잘 정의(well-defined)** 되어 있다 — `+`, `-`, `*`, `/`, `sqrt` 는 표준이 *정확히 반올림(correctly rounded)* 되도록 규정한다. 같은 두 비트열을 더하면 어느 IEEE 754 하드웨어에서도 같은 비트열이 나온다. 그러니 "float 은 비결정적"이라는 통념은 틀렸다. 진짜 적은 다음 다섯이다.

## (a) 컴파일러 최적화 — 같은 소스, 다른 비트

```
// FMA (fused multiply-add): a*b + c 를 한 명령으로, 중간 반올림 없이 계산
//   x86(AVX2) 는 FMA 지원, 구형 타깃은 별도 mul→add → 결과 다름
r = a*b + c;            // 컴파일러가 FMA 로 융합할지 안 할지가 비트를 바꾼다

// 재결합(reassociation): (a+b)+c vs a+(b+c) — 부동소수점은 비결합(non-associative)
//   -ffast-math / /fp:fast 가 이를 허용 → 순서가 바뀌어 비트가 달라짐

// x87 80-bit 확장 정밀도: 구형 32-bit x86 은 레지스터에서 80bit 로 계산 후
//   메모리 spill 시점에 64/32bit 로 절단 → spill 타이밍(레지스터 압박)에 결과 의존
```

## (b) `-ffast-math` / `/fp:fast`

결합법칙 가정, `x*0 = 0` 같은 비-IEEE 단순화, FMA 자유 융합, denormal flush 를 모두 켠다. **결정론에 치명적**이고 정확도도 잃는다. 물리 코어에는 보통 끈다. 결정 시뮬은 `/fp:strict`(MSVC) 또는 `-ffp-contract=off -fno-fast-math`(GCC/Clang) 가 출발선이다 — 다만 `/fp:strict` 도 *플랫폼 간* bit-exact 를 보장하진 않는다 (아래 (c) 때문).

## (c) 초월함수(transcendentals) `sin`/`cos`/`exp`/`pow`

IEEE 754 가 정확 반올림을 **요구하지 않는** 함수들. libm 구현(glibc vs MSVC CRT vs Apple)·SIMD 벡터화·CPU 마이크로코드에 따라 마지막 비트(ULP)가 다르다. 크로스플랫폼 bit-exact 가 목표면 **자체 결정적 구현(테이블/다항식 근사)으로 교체**해야 한다.

## (d) 연산 순서 (비결합성)

`a₀ + a₁ + … + aₙ` 의 합은 더하는 순서에 따라 결과가 달라진다. 자료구조 순회 순서(포인터 정렬 vs ID 정렬), 컨테이너 반복 순서, `std::sort` 의 동률(tie) 처리가 모두 비트에 영향을 준다. 코드를 한 줄도 안 고쳐도 객체 *순서*만 바뀌면 결과가 갈린다.

## (e) 멀티스레드 reduction 순서

병렬 합산/누적은 스레드 스케줄에 따라 결합 순서가 매 실행마다 달라진다. → 비결정의 가장 흔한 원인. `[13]` 성능과 정면 충돌하므로 **결정적 reduction**(고정 분할 + 고정 순서 트리 합, 또는 단일 스레드 누적)이 필요하다.

> 📐 **심화: 왜 같은 소스가 플랫폼마다 다른 비트를 내는가** — (a)~(c) 의 근본 원인(IEEE 가 "각 연산"만 규정하고 "표현식 전체의 평가 순서·중간 정밀도·초월함수"는 풀어 둔 것, FMA 의 단일 반올림, x87 의 이중 반올림)을 끝까지 파고든 전용 문서 → [02a-why-float-diverges](02a-why-float-diverges.md).

## 대응 요약

| 적 | 대응 |
|---|---|
| FMA 융합 | `-ffp-contract=off`, 또는 *모든* 타깃에서 FMA 강제 통일 |
| fast-math | 끈다. 엄격 IEEE 모드 |
| x87 80bit | SSE/SSE2 스칼라 강제(`-mfpmath=sse`), x87 회피 |
| 초월함수 | 자체 결정적 근사로 교체 |
| 연산 순서 | 안정 정렬(stable) + ID 기준 tie-break, 순회 순서 고정 |
| MT reduction | 결정적 reduction / 고정 partition |
| 공통 | 같은 컴파일러·같은 플래그·같은 라이브러리 버전 핀(pin) |

이 표를 다 적용해도 *크로스플랫폼* bit-exact 는 (c) 초월함수·FMA 가용성 차이가 남아 깨질 수 있다. 그 벽을 원천 제거하려면 [03-fixed-point](03-fixed-point.md) 로 간다.

---

**관련 함정** (전체 체크리스트는 [12-determinism-networking §5](../12-determinism-networking.md#5-함정--결정론-체크리스트)):
- **`/fp:strict` 도 크로스플랫폼을 보장하지 않는다** — 초월함수 ULP 차·FMA 가용성 차이가 남는다.
- **멀티스레드는 결정론의 천적** — 병렬화는 순서를 흩뜨린다([13](../13-performance-parallelism.md)). 결정적 reduction 을 처음부터 설계.
- **순회 순서가 새는 곳** — 포인터 주소 정렬·`std::unordered_map` 순회·해시 버킷 순서·불안정 동률은 전부 비결정. 영속 ID + stable sort + ID tie-break 로 봉쇄.

**다음**: [02a-why-float-diverges](02a-why-float-diverges.md) — 왜 같은 코드가 플랫폼마다 갈리는가(근본 원인). 건너뛰면 [03-fixed-point](03-fixed-point.md).
