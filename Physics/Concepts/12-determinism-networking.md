# [12] 결정론·네트워킹 (Determinism & Networking)

> 같은 입력은 모든 머신에서 **같은 출력**을 내야 한다 — 이것이 lockstep·롤백·리플레이의 전제이며, 부동소수점·연산 순서·네트워크 모델 전부에 제약을 건다.
> **상위 지도**: [Concepts/README.md](README.md) · **횡단 제약**: [03-time-integration.md](03-time-integration.md) · [04-collision-detection.md](04-collision-detection.md) · [05-constraint-solving.md](05-constraint-solving.md)

---

## 1. 위치와 역할

이 문서는 트리의 어느 한 분기에 매달리는 노드가 아니다. README 의 DAG 에서 `[12] ⟂` 로 표기된 **횡단 관심사(cross-cutting concern)** 다 — 코어 시뮬 루프 전체(`[03]` 적분 → `[04]` 충돌 감지 → `[05]` 구속 해법)에 동시에 제약을 건다.

```
forces → [03] 적분 → [04] broad→narrow → [05] contact+joint → commit
   ▲          ▲              ▲                     ▲
   └──────────┴──────────────┴─────────────────────┘
        [12] 결정론: 이 모든 단계가 bit-exact 재현 가능해야 한다
```

핵심 메시지: **결정론은 사후에 끼워 넣을 수 없다.** 부동소수점 표현, 연산 순서, 자료구조 순회 순서, 컴파일 플래그까지 *처음부터* 정책으로 못 박아야 한다 (README §4: "12는 처음부터 정해야 한다 — 나중에 못 바꿈"). 형제 노드 가운데 `03`(고정 timestep), `04`(broadphase 순회 순서), `05`(warm-start 캐시·접촉 순서)에 가장 직접적인 요구사항을 부과한다.

> **형제 문서 전체**: [00-foundations](00-foundations.md) · [01-kinematics](01-kinematics.md) · [02-dynamics](02-dynamics.md) · [03-time-integration](03-time-integration.md) · [04-collision-detection](04-collision-detection.md) · [05-constraint-solving](05-constraint-solving.md) · [06-joints-articulation](06-joints-articulation.md) · [07-deformable-bodies](07-deformable-bodies.md) · [08-fluids](08-fluids.md) · [09-particles](09-particles.md) · [10-specialized-systems](10-specialized-systems.md) · [11-spatial-structures](11-spatial-structures.md) · **12-determinism-networking**(이 문서) · [13-performance-parallelism](13-performance-parallelism.md)

---

## 2. 핵심 이론

### 2.1 결정론이란

**결정적 시뮬레이션(deterministic simulation)** 이란, 동일한 초기 상태 `S₀` 와 동일한 입력열 `(I₀, I₁, …, Iₙ)` 이 주어지면 *어느 머신·어느 실행에서도* 동일한 상태열 `(S₁, …, Sₙ₊₁)` 을 내는 성질이다.

```
S_{t+1} = step(S_t, I_t)      // step 은 순수 함수여야 한다
∀ machine A, B:  S₀ᴬ = S₀ᴮ ∧ Iᴬ = Iᴮ  ⇒  Sₙᴬ = Sₙᴮ
```

결정론에는 두 등급이 있다.

| 등급 | 정의 | 쓰임 |
|---|---|---|
| **bit-exact (cross-platform)** | 모든 비트가 일치. ARM/x86, MSVC/Clang, GPU/CPU 무관 | deterministic lockstep MMO/RTS, 입력만 전송하는 P2P, 크로스플레이 |
| **bit-exact (same-binary)** | *같은 바이너리·같은 하드웨어*에서만 일치 | 단일 플랫폼 격투 게임 롤백, 같은 빌드끼리의 리플레이 |
| **통계적/근사 (statistical)** | 평균·분포는 같지만 비트는 다름 | 비결정 시뮬 + 상태 복제. 동기화는 네트워크로 강제 |

**왜 필요한가** — 세 가지 용례가 결정론을 *강제*한다.

1. **Deterministic lockstep (RTS/MMO)** — 수천 유닛의 전체 월드 상태를 매 프레임 전송하면 대역폭이 폭발한다. 대신 **입력(input)만** 교환하고 각 클라이언트가 동일 시뮬을 독립 실행한다. 결정론이 깨지면 클라이언트들이 갈라져(desync) 게임이 붕괴한다.
2. **Rollback netcode (격투/대전)** — 상대 입력을 받기 전에 예측으로 진행하고, 틀리면 과거로 되감아(rollback) 재시뮬(re-sim)한다. 재시뮬이 원래 결과와 *비트 단위로* 같아야 화면 튐 없이 수렴한다.
3. **Replay / Spectate / 디버깅** — 입력열 + 초기 시드만 저장하면 전체 경기를 재현한다. 결정론은 리플레이 용량을 입력 크기로 줄이고, 버그를 100% 재현 가능하게 만든다.

### 2.2 부동소수점 결정론의 적 (the enemies)

IEEE 754 `float`/`double` 자체는 **잘 정의(well-defined)** 되어 있다 — `+`, `-`, `*`, `/`, `sqrt` 는 표준이 정확히 반올림(correctly rounded)되도록 규정한다. 비결정의 근원은 부동소수점이 아니라 **그 위의 컴파일러·하드웨어·실행 순서**다.

**(a) 컴파일러 최적화 — 같은 소스, 다른 비트**

```
// FMA (fused multiply-add): a*b + c 를 한 명령으로, 중간 반올림 없이 계산
//   x86(AVX2) 는 FMA 지원, 구형 타깃은 별도 mul→add → 결과 다름
r = a*b + c;            // 컴파일러가 FMA 로 융합할지 안 할지가 비트를 바꾼다

// 재결합(reassociation): (a+b)+c vs a+(b+c) — 부동소수점은 비결합(non-associative)
//   -ffast-math / /fp:fast 가 이를 허용 → 순서가 바뀌어 비트가 달라짐

// x87 80-bit 확장 정밀도: 구형 32-bit x86 은 레지스터에서 80bit 로 계산 후
//   메모리 spill 시점에 64/32bit 로 절단 → spill 타이밍(레지스터 압박)에 결과 의존
```

**(b) `-ffast-math` / `/fp:fast`** — 결합법칙 가정, `x*0 = 0` 같은 비-IEEE 단순화, FMA 자유 융합, denormal flush 를 모두 켠다. **결정론에 치명적**. 결정 시뮬은 `/fp:strict`(MSVC) 또는 `-ffp-contract=off -fno-fast-math`(GCC/Clang) 가 출발선이다 — 다만 `/fp:strict` 도 *플랫폼 간* bit-exact 를 보장하진 않는다 (아래 (c) 때문).

**(c) 초월함수(transcendentals) `sin`/`cos`/`exp`/`pow`** — IEEE 754 가 정확 반올림을 **요구하지 않는** 함수들. libm 구현(glibc vs MSVC CRT vs Apple)·SIMD 벡터화·CPU 마이크로코드에 따라 마지막 비트(ULP)가 다르다. 크로스플랫폼 bit-exact 가 목표면 **자체 결정적 구현(테이블/다항식 근사)으로 교체**해야 한다.

**(d) 연산 순서 (비결합성)** — `a₀ + a₁ + … + aₙ` 의 합은 더하는 순서에 따라 결과가 달라진다. 자료구조 순회 순서(포인터 정렬 vs ID 정렬), 컨테이너 반복 순서, `std::sort` 의 동률 처리가 모두 비트에 영향을 준다.

**(e) 멀티스레드 reduction 순서** — 병렬 합산/누적은 스레드 스케줄에 따라 결합 순서가 매 실행마다 달라진다. → 비결정의 가장 흔한 원인. `[13]` 성능과 정면 충돌하므로 **결정적 reduction**(고정 분할 + 고정 순서 트리 합, 또는 단일 스레드 누적)이 필요하다.

**대응 요약**

| 적 | 대응 |
|---|---|
| FMA 융합 | `-ffp-contract=off`, 또는 *모든* 타깃에서 FMA 강제 통일 |
| fast-math | 끈다. 엄격 IEEE 모드 |
| x87 80bit | SSE/SSE2 스칼라 강제(`-mfpmath=sse`), x87 회피 |
| 초월함수 | 자체 결정적 근사로 교체 |
| 연산 순서 | 안정 정렬(stable) + ID 기준 tie-break, 순회 순서 고정 |
| MT reduction | 결정적 reduction / 고정 partition |
| 공통 | 같은 컴파일러·같은 플래그·같은 라이브러리 버전 핀(pin) |

### 2.3 Fixed-point 산술 (정수 기반)

부동소수점의 크로스플랫폼 골칫거리를 *원천 제거*하는 길은 **정수만으로** 시뮬레이션하는 것이다. 정수 덧셈·뺄셈·곱셈은 모든 IEEE 무관 플랫폼에서 동일하게 정의된다.

**Q-포맷 고정소수점** — `Q16.16` 은 32비트 정수를 정수부 16비트·소수부 16비트로 해석한다 (값 = `raw / 2¹⁶`).

```
typedef int32_t fixed;            // Q16.16
const int SHIFT = 16;

fixed add(fixed a, fixed b) { return a + b; }            // 정수 덧셈 그대로
fixed mul(fixed a, fixed b) {
    return (fixed)(((int64_t)a * b) >> SHIFT);            // 64bit 로 올려 곱한 뒤 시프트
}
fixed div(fixed a, fixed b) {
    return (fixed)(((int64_t)a << SHIFT) / b);
}
// sqrt/sin/cos 는 정수 알고리즘 또는 룩업테이블로 — 모든 플랫폼 동일 결과
```

| 장점 | 단점 |
|---|---|
| **완전한 cross-platform bit-exact** | 동적 범위(dynamic range)가 좁다 — overflow/underflow 직접 관리 |
| float 함정(FMA/x87/fast-math) 전부 무관 | 정밀도가 비트 위치에 고정 — 큰 값·작은 값 동시 표현 약함 |
| 검증·해시 비교가 단순 | 곱셈마다 64bit 승격·시프트 → 비용·구현 복잡도 |
| 결정론 보장이 "공짜"에 가까움 | 라이브러리 생태계 빈약 — sqrt/삼각/벡터 전부 자작 |

**어디까지 필요한가** — 정답은 "타깃 결정론 등급에 따라".

- **크로스플레이·이종 하드웨어 lockstep** (모바일+PC RTS, 콘솔 크로스플레이) → fixed-point 가 사실상 유일하게 견고한 답 (예: Photon Quantum).
- **단일 플랫폼 롤백** (콘솔 격투) → 같은 바이너리면 float 으로도 same-binary bit-exact 달성 가능. fixed-point 불필요.
- **서버 권위 + 상태 복제** → 결정론 요건 자체가 느슨. float 그대로.

### 2.4 결정적 시뮬 요건 (코어 루프에 거는 제약)

bit-exact 가 가능하려면 코어 루프의 *모든 비결정 진입점*을 닫아야 한다.

1. **고정 timestep** (`[03]`) — 가변 `dt` 는 결정론을 즉시 깬다. 고정 `Δt`(예: 1/60s) + accumulator 패턴 필수. 렌더 보간은 상태를 바꾸지 않는 *표시 전용*으로 분리.
2. **안정적 객체·접촉 순서** — 시뮬 결과는 `[05]` 솔버가 접촉/조인트를 푸는 **순서에 의존**(PGS/sequential impulse 는 순서 민감). 객체는 영속 ID 로, 접촉은 `(idA, idB, featureId)` 같은 결정적 키로 **stable sort** 해야 한다. 포인터 주소·해시 순회 순서로 정렬하면 실행마다 달라진다.
3. **결정적 broadphase 순회** (`[04]`·`[11]`) — DBVT/SAP/공간 해시가 만드는 후보쌍 목록의 *순서*가 다음 단계 입력이다. 트리 재구성·해시 버킷 순회를 결정적으로(삽입 순서 무관하게 ID 정렬로) 산출.
4. **warm-start 캐시 순서** (`[05]`) — TGS/sequential impulse 의 warm starting 은 이전 프레임 람다(λ)를 캐시에서 끌어온다. 캐시 매칭과 적용 순서가 결정적이어야 누적 결과가 일치.
5. **결정적 난수** — 모든 RNG 는 명시 시드 + 결정적 알고리즘(xorshift/PCG). `rand()`·스레드 로컬 RNG·시간 시드 금지.
6. **상태에 영향 주는 부동소수점 전부**를 위 2.2 정책 아래 둔다. 디버그 드로/로깅 등 *상태에 안 들어가는* 계산은 자유.

### 2.5 네트워크 모델

물리 동기화 방식은 "**전체 결정적 시뮬을 공유**" vs "**상태를 복제**"의 스펙트럼이다.

```
입력만 전송 ◀──────────────────────────────────────▶ 상태(transform) 전송
deterministic lockstep   rollback/GGPO   snapshot interp.   server-authoritative
  (RTS/MMO)               (격투)          + prediction        (슈터/MMO)
  결정론 ★★★★★            결정론 ★★★★★      결정론 ☆            결정론 ☆
```

**(a) Deterministic lockstep** — 모든 피어가 입력을 교환하고, 모두가 입력을 받은 *확정 프레임*에서만 동시에 step. 대역폭 = 입력 크기(유닛 수 무관) → RTS 의 수천 유닛에 이상적. 단점: **가장 느린 피어가 전체를 묶고**(입력 지연 = RTT), 단 한 곳의 desync 가 치명적. 결정론 필수.

**(b) Rollback (GGPO 계열)** — 상대 입력을 기다리지 않고 *예측 입력*으로 즉시 진행. 실제 입력 도착 시 예측이 틀렸으면 그 프레임으로 **rollback** 후 진짜 입력으로 **re-simulate**. 입력 지연을 숨겨 격투 게임의 반응성을 확보. 재시뮬이 bit-exact 여야 하므로 결정론 + 빠른 상태 save/restore(스냅샷) + 가벼운 step 이 전제.

```
프레임 진행:        ... f7  f8  f9 (예측 input_remote)
원격 input 도착 →  f8 의 실제 input 이 예측과 다름
rollback:          상태를 f8 로 복원 → f8, f9 를 실제 input 으로 재시뮬 → 현재로 catch-up
```

**(c) Snapshot interpolation + 보간/예측** — 서버가 주기적 **스냅샷(상태)** 을 보내고, 클라는 과거 시점 두 스냅샷 사이를 **보간(interpolation)** 해 부드럽게 표시(원격 객체). 자기 객체는 입력 즉시 반영하는 **예측(prediction)**. 결정적 시뮬 불필요 — 상태가 직접 오기 때문. Source 엔진(Quake/Half-Life 계보)의 고전.

**(d) Server-authoritative + client prediction/reconciliation** — 서버가 **유일한 권위(authority)**. 클라는 입력을 보내며 동시에 로컬에서 예측 실행(prediction). 서버의 권위 상태가 오면 예측과 비교해 어긋나면 **reconciliation**(서버 상태로 보정 후 미확인 입력 재적용). 치트 저항·일관성에서 최강. 대부분의 경쟁 슈터·MMO 의 표준. 결정론 요건은 느슨(서버가 진실).

### 2.6 물리 동기화: 전체 시뮬 vs 상태 복제 — 장르 매핑

| 축 | 전체 결정적 시뮬 (입력 전송) | 상태 복제 (transform 전송) |
|---|---|---|
| 보내는 것 | 입력만 | 위치/회전/속도 스냅샷 |
| 대역폭 | 객체 수 무관 (입력 크기) | 객체 수에 비례 |
| 결정론 요구 | **필수** (bit-exact) | 거의 불필요 |
| 권위 | 분산(모두 동일 시뮬) 또는 서버 | 서버 권위 |
| 실패 모드 | desync (전체 붕괴) | 약간의 위치 오차/보정 튐 |
| **장르** | **RTS, 격투, lockstep MMO, 시뮬** | **FPS/슈터, 배틀로얄, 대규모 MMO** |

직관: 동기화해야 할 **동적 객체가 많고**(수천 유닛) 대역폭이 병목이면 → 결정적 시뮬(입력 전송). 동적 객체가 적고(플레이어·발사체) **반응성·치트 저항**이 우선이면 → 서버 권위 상태 복제. 많은 현대 게임은 **혼합** — 핵심 캐릭터/발사체는 서버 권위, 잔해/장식 물리는 비동기 로컬(결정론 불필요).

---

## 3. 주요 기법/도구

- **엄격 부동소수점 모드** — MSVC `/fp:strict` + `/fp:except-`, GCC/Clang `-frounding-math -ffp-contract=off`, `-mfpmath=sse -msse2` 로 x87 회피.
- **결정적 수학 라이브러리** — 삼각/지수/제곱근을 룩업+다항 근사로 자작해 플랫폼 ULP 차 제거. 또는 fixed-point 전면 도입.
- **결정적 reduction** — 병렬 합을 고정 partition·고정 순서 트리로 묶거나, 솔버를 결정적 그래프 컬러링으로 병렬화(`[13]` 과 조율).
- **상태 해시(checksum)** — 매 N 프레임 시뮬 상태를 해시해 피어/리플레이 간 비교. desync 를 *발생 프레임에서* 잡는 1순위 진단 도구.
- **스냅샷 save/restore** — 롤백을 위한 빠른 직렬화. SoA 메모리·고정 크기 풀로 memcpy 수준 복원.
- **GGPO / GGPO 계열 SDK** — 롤백 netcode 의 사실상 표준 라이브러리. 예측·롤백·동기화를 추상화.
- **Photon Quantum** — fixed-point 기반 결정적 ECS 물리 + 예측·롤백을 통합 제공하는 상용 프레임워크.
- **링 버퍼 입력 큐 + 입력 지연(input delay)** — lockstep 의 지터 흡수. RTT 만큼 입력을 앞당겨 예약.

---

## 4. 실무 (엔진은 무엇을 쓰는가)

| 엔진/프레임워크 | 결정론 접근 |
|---|---|
| **Havok Physics** | 결정론 **옵션** 제공(determinism mode). 같은 빌드·같은 입력 순서 보장 시 same-platform 재현. 멀티스레드 결정성은 별도 보장 필요. |
| **PhysX (NVIDIA)** | float 기반. *같은 하드웨어·같은 빌드·동일 스레드 구성*에서 결정적이지만 **크로스플랫폼 bit-exact 는 비보장**. GPU 경로는 더 약함. |
| **Jolt Physics** | 설계 단계부터 **결정론을 1급 목표**로. 같은 바이너리에서 cross-platform 까지 노린 신중한 부동소수점·순회 순서 관리(호라이즌 포비든 웨스트). 그래도 *다른 컴파일러/플랫폼*은 별도 검증 권장. |
| **Rapier (Rust)** | `enhanced-determinism` **feature** 를 켜면 동일 플랫폼 cross-run 결정성 보장(연산 순서·구조 순회 고정). 크로스플랫폼은 여전히 어려움. |
| **Box2D** | 단일 스레드·고정 순서면 same-binary 결정적. 교과서적 명료함으로 결정론 학습용 기준선. |
| **Chaos (UE5)** | 기본은 비결정 지향(성능 우선). 결정 시뮬보다는 네트워크 **상태 복제/예측**(UE Replication, Network Prediction)에 무게. |

**netcode 사례**

- **GGPO** (Skullgirls 등 격투) — 롤백 netcode 를 대중화. 입력 예측 + 비트 정확 재시뮬.
- **Photon Quantum** — fixed-point 결정 ECS 물리. RTS/대전류 크로스플레이.
- **Overwatch** — **서버 권위 + 클라 예측/보정** 의 교과서. 입력 전송 후 서버 시뮬, 클라 prediction + reconciliation, lag compensation(히트 판정 시 과거 상태 되감기).
- **Rocket League** — 차량 물리를 **결정적 고정 timestep**(120Hz physics)으로 돌리고, 서버 권위 + 클라 예측을 결합. 물리 일관성이 게임성의 핵심이라 결정론에 강하게 투자.
- **StarCraft / Age of Empires** (RTS 고전) — deterministic lockstep, 입력만 전송. 수천 유닛을 좁은 대역폭으로 동기화한 정전(正典).

---

## 5. 함정·결정론 주의

- **"float 은 비결정"은 오해** — IEEE 기본 연산은 결정적이다. 비결정은 *컴파일러·하드웨어·순서*에서 온다. 적을 정확히 지목하라.
- **`/fp:strict` 도 크로스플랫폼을 보장하지 않는다** — 초월함수 ULP 차·FMA 가용성 차이가 남는다. 진짜 크로스플랫폼 bit-exact 가 필요하면 fixed-point 나 자체 결정 수학으로 가라.
- **멀티스레드는 결정론의 천적** — `[13]` 의 병렬화(island/job/SIMD reduction)는 순서를 흩뜨린다. 결정성과 성능을 *동시에* 원하면 결정적 reduction·그래프 컬러링을 처음부터 설계.
- **순회 순서가 새는 곳** — 포인터 주소로 정렬, `std::unordered_map` 순회, 해시 버킷 순서, `std::sort` 의 불안정 동률은 전부 비결정. **영속 ID + stable sort + ID tie-break** 로 봉쇄.
- **RNG 누수** — 어딘가의 `rand()`·`std::random_device`·시간 시드 한 줄이 전체 결정론을 깬다. RNG 는 시드 통제 하에 명시적으로.
- **결정론은 사후 추가 불가** — 자료구조·메모리 레이아웃·플래그가 다 얽힌다. 네트워킹 모델(2.5)을 *프로젝트 초기에* 확정하라 (README §4·3).
- **save/restore 누락 상태** — 롤백에서 스냅샷에 안 담긴 캐시(warm-start λ, broadphase 트리, sleeping 플래그)는 재시뮬을 어긋나게 한다. 시뮬 상태 전체가 직렬화 대상인지 점검.
- **desync 디버깅은 해시 없이는 지옥** — 상태 checksum 을 처음부터 심어 *어느 프레임·어느 객체*에서 갈렸는지 이분 탐색하라.
- **렌더 보간이 시뮬에 새지 않게** — 보간/외삽은 표시 전용. 그 결과가 다음 step 입력으로 피드백되면 결정론이 깨진다.

---

## 6. 더 읽기 / 관련 노드

- **직접 제약을 거는 노드**
  - [03-time-integration.md](03-time-integration.md) — 고정 timestep·accumulator. 결정론의 *시간축* 전제.
  - [04-collision-detection.md](04-collision-detection.md) — broadphase 후보쌍 순서·접촉 manifold 키. 결정적 순회.
  - [05-constraint-solving.md](05-constraint-solving.md) — 솔버 순서 민감성(PGS/TGS)·warm-start 캐시 순서.
- **조율 대상**
  - [11-spatial-structures.md](11-spatial-structures.md) — DBVT/SAP/공간 해시의 결정적 산출.
  - [13-performance-parallelism.md](13-performance-parallelism.md) — 병렬화 ⟷ 결정론의 정면 트레이드오프(결정적 reduction).
  - [00-foundations.md](00-foundations.md) — 부동소수점·수치 안정성의 기초.
- **외부 레퍼런스**
  - GGPO 문서 / Glenn Fiedler "Networked Physics", "Deterministic Lockstep" (gafferongames).
  - Photon Quantum — fixed-point 결정 ECS 백서.
  - Jolt / Rapier 의 결정론 설계 문서, Yann Collet 등 cross-platform float 논의.
  - Overwatch GDC "Networking Scripted Weapons and Abilities", Rocket League netcode 발표.
