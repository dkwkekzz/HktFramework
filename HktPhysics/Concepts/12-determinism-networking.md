# [12] 결정론·네트워킹 (Determinism & Networking) — 허브

> 같은 입력은 모든 머신에서 **같은 출력**을 내야 한다 — 이것이 lockstep·롤백·리플레이의 전제이며, 부동소수점·연산 순서·네트워크 모델 전부에 제약을 건다.
> 이 문서는 **목차(인덱스)와 요약**만 보관한다. 세부 이론은 [12-determinism-networking/](12-determinism-networking/) 하위 문서로 분할되어 있다 — 한 주제 = 한 문서.
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

## 2. 하위 문서 인덱스 (세부 이론)

결정론·네트워킹은 직관 단위로 분할되어 있다. 권장 순서는 위에서 아래 — "결정론이란 무엇인가"에서 출발해 "왜 깨지는가(float)"를 거쳐 "어떻게 동기화하는가(네트워크 모델)"로 내려간다.

| # | 문서 | 한 줄 | 핵심 키워드 |
|---|---|---|---|
| 2.1 | [12-determinism-networking/01-determinism.md](12-determinism-networking/01-determinism.md) | 결정론이란·등급·동기 | 순수 함수·bit-exact·cross-platform vs same-binary·lockstep/롤백/리플레이 |
| 2.2 | [12-determinism-networking/02-float-enemies.md](12-determinism-networking/02-float-enemies.md) | 부동소수점 결정론의 적 | FMA·재결합·x87 80bit·초월함수·연산 순서·MT reduction |
| 2.2a | [12-determinism-networking/02a-why-float-diverges.md](12-determinism-networking/02a-why-float-diverges.md) | 왜 float 이 플랫폼마다 갈리나 (심화) | IEEE 가 푼 자유·단일 반올림·이중 반올림·table-maker's dilemma |
| 2.3 | [12-determinism-networking/03-fixed-point.md](12-determinism-networking/03-fixed-point.md) | Fixed-point 산술 | Q16.16·정수 mul/div·동적 범위·크로스플랫폼 원천 해결 |
| 2.4 | [12-determinism-networking/04-deterministic-sim-requirements.md](12-determinism-networking/04-deterministic-sim-requirements.md) | 결정적 시뮬 요건 | 고정 timestep·stable sort·broadphase 순회·warm-start·결정적 RNG |
| 2.5 | [12-determinism-networking/05-network-models.md](12-determinism-networking/05-network-models.md) | 네트워크 모델 | lockstep·rollback·snapshot interp·server-authoritative |
| 2.5a | [12-determinism-networking/05a-rollback-netcode.md](12-determinism-networking/05a-rollback-netcode.md) | Rollback netcode (심화) | 예측·되감기·재시뮬·save/restore 누락의 저주 |
| 2.6 | [12-determinism-networking/06-sync-genre-mapping.md](12-determinism-networking/06-sync-genre-mapping.md) | 동기화 ↔ 장르 매핑 | 입력 전송 vs 상태 복제·대역폭·권위·혼합 전략 |

---

## 3. 한눈 요약

### 결정론의 두 등급 (상세 → [01-determinism](12-determinism-networking/01-determinism.md))

| 등급 | 정의 | 쓰임 |
|---|---|---|
| **bit-exact (cross-platform)** | 모든 비트 일치. ARM/x86, MSVC/Clang, GPU/CPU 무관 | lockstep MMO/RTS, 크로스플레이 |
| **bit-exact (same-binary)** | 같은 바이너리·하드웨어에서만 일치 | 단일 플랫폼 격투 롤백, 리플레이 |
| **통계적/근사** | 평균·분포는 같지만 비트는 다름 | 비결정 시뮬 + 상태 복제 |

### 부동소수점의 적과 대응 (상세 → [02-float-enemies](12-determinism-networking/02-float-enemies.md))

| 적 | 대응 |
|---|---|
| FMA 융합 | `-ffp-contract=off`, 또는 모든 타깃에서 FMA 강제 통일 |
| fast-math | 끈다. 엄격 IEEE 모드 |
| x87 80bit | SSE/SSE2 스칼라 강제(`-mfpmath=sse`), x87 회피 |
| 초월함수 | 자체 결정적 근사로 교체 |
| 연산 순서 | 안정 정렬 + ID tie-break, 순회 순서 고정 |
| MT reduction | 결정적 reduction / 고정 partition |
| 공통 | 같은 컴파일러·플래그·라이브러리 버전 핀 |

### 네트워크 모델 스펙트럼 (상세 → [05-network-models](12-determinism-networking/05-network-models.md) · [06-sync-genre-mapping](12-determinism-networking/06-sync-genre-mapping.md))

```
입력만 전송 ◀──────────────────────────────────────▶ 상태(transform) 전송
deterministic lockstep   rollback/GGPO   snapshot interp.   server-authoritative
  (RTS/MMO)               (격투)          + prediction        (슈터/MMO)
  결정론 ★★★★★            결정론 ★★★★★      결정론 ☆            결정론 ☆
```

| 축 | 전체 결정적 시뮬 (입력 전송) | 상태 복제 (transform 전송) |
|---|---|---|
| 대역폭 | 객체 수 무관 (입력 크기) | 객체 수에 비례 |
| 결정론 요구 | **필수** (bit-exact) | 거의 불필요 |
| 실패 모드 | desync (전체 붕괴) | 위치 오차/보정 튐 |
| **장르** | **RTS, 격투, lockstep MMO** | **FPS/슈터, 배틀로얄, 대규모 MMO** |

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

**주요 기법/도구**

- **엄격 부동소수점 모드** — MSVC `/fp:strict` + `/fp:except-`, GCC/Clang `-frounding-math -ffp-contract=off`, `-mfpmath=sse -msse2` 로 x87 회피. (→ [02-float-enemies](12-determinism-networking/02-float-enemies.md) · [02a](12-determinism-networking/02a-why-float-diverges.md))
- **결정적 수학 라이브러리** — 삼각/지수/제곱근을 룩업+다항 근사로 자작해 플랫폼 ULP 차 제거. 또는 [fixed-point](12-determinism-networking/03-fixed-point.md) 전면 도입.
- **결정적 reduction** — 병렬 합을 고정 partition·고정 순서 트리로 묶거나, 솔버를 결정적 그래프 컬러링으로 병렬화(`[13]` 과 조율).
- **상태 해시(checksum)** — 매 N 프레임 시뮬 상태를 해시해 피어/리플레이 간 비교. desync 를 *발생 프레임에서* 잡는 1순위 진단 도구.
- **스냅샷 save/restore** — 롤백을 위한 빠른 직렬화. SoA 메모리·고정 크기 풀로 memcpy 수준 복원. (→ [05a-rollback-netcode](12-determinism-networking/05a-rollback-netcode.md))
- **GGPO / GGPO 계열 SDK** — 롤백 netcode 의 사실상 표준 라이브러리. 예측·롤백·동기화를 추상화.
- **Photon Quantum** — fixed-point 기반 결정적 ECS 물리 + 예측·롤백을 통합 제공하는 상용 프레임워크.
- **링 버퍼 입력 큐 + 입력 지연(input delay)** — lockstep 의 지터 흡수. RTT 만큼 입력을 앞당겨 예약.

**netcode 사례**

- **GGPO** (Skullgirls 등 격투) — 롤백 netcode 를 대중화. 입력 예측 + 비트 정확 재시뮬.
- **Photon Quantum** — fixed-point 결정 ECS 물리. RTS/대전류 크로스플레이.
- **Overwatch** — **서버 권위 + 클라 예측/보정** 의 교과서. 입력 전송 후 서버 시뮬, 클라 prediction + reconciliation, lag compensation(히트 판정 시 과거 상태 되감기).
- **Rocket League** — 차량 물리를 **결정적 고정 timestep**(120Hz physics)으로 돌리고, 서버 권위 + 클라 예측을 결합. 물리 일관성이 게임성의 핵심이라 결정론에 강하게 투자.
- **StarCraft / Age of Empires** (RTS 고전) — deterministic lockstep, 입력만 전송. 수천 유닛을 좁은 대역폭으로 동기화한 정전(正典).

---

## 5. 함정 · 결정론 체크리스트

분할된 각 문서의 함정을 한 곳에 모은 체크리스트. 괄호는 상세 위치.

- **"float 은 비결정"은 오해** — IEEE 기본 연산은 결정적이다. 비결정은 *컴파일러·하드웨어·순서*에서 온다. 적을 정확히 지목하라. ([02-float-enemies](12-determinism-networking/02-float-enemies.md))
- **`/fp:strict` 도 크로스플랫폼을 보장하지 않는다** — 초월함수 ULP 차·FMA 가용성 차이가 남는다. 진짜 크로스플랫폼 bit-exact 가 필요하면 fixed-point 나 자체 결정 수학으로. ([02a-why-float-diverges](12-determinism-networking/02a-why-float-diverges.md) · [03-fixed-point](12-determinism-networking/03-fixed-point.md))
- **멀티스레드는 결정론의 천적** — `[13]` 의 병렬화(island/job/SIMD reduction)는 순서를 흩뜨린다. 결정성과 성능을 동시에 원하면 결정적 reduction·그래프 컬러링을 처음부터 설계. ([02-float-enemies](12-determinism-networking/02-float-enemies.md) · [04-deterministic-sim-requirements](12-determinism-networking/04-deterministic-sim-requirements.md))
- **순회 순서가 새는 곳** — 포인터 주소 정렬, `std::unordered_map` 순회, 해시 버킷 순서, `std::sort` 의 불안정 동률은 전부 비결정. **영속 ID + stable sort + ID tie-break** 로 봉쇄. ([04-deterministic-sim-requirements](12-determinism-networking/04-deterministic-sim-requirements.md))
- **RNG 누수** — 어딘가의 `rand()`·`std::random_device`·시간 시드 한 줄이 전체 결정론을 깬다. RNG 는 시드 통제 하에 명시적으로. ([04-deterministic-sim-requirements](12-determinism-networking/04-deterministic-sim-requirements.md))
- **결정론은 사후 추가 불가** — 자료구조·메모리 레이아웃·플래그가 다 얽힌다. 네트워킹 모델을 *프로젝트 초기에* 확정하라 (README §4·3). ([01-determinism](12-determinism-networking/01-determinism.md) · [06-sync-genre-mapping](12-determinism-networking/06-sync-genre-mapping.md))
- **save/restore 누락 상태** — 롤백에서 스냅샷에 안 담긴 캐시(warm-start λ, broadphase 트리, sleeping 플래그)는 재시뮬을 어긋나게 한다. 시뮬 상태 전체가 직렬화 대상인지 점검. ([05a-rollback-netcode](12-determinism-networking/05a-rollback-netcode.md))
- **desync 디버깅은 해시 없이는 지옥** — 상태 checksum 을 처음부터 심어 *어느 프레임·어느 객체*에서 갈렸는지 이분 탐색하라. (§4 도구)
- **렌더 보간이 시뮬에 새지 않게** — 보간/외삽은 표시 전용. 그 결과가 다음 step 입력으로 피드백되면 결정론이 깨진다. ([04-deterministic-sim-requirements](12-determinism-networking/04-deterministic-sim-requirements.md))

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
  - GGPO 문서 / Glenn Fiedler "Networked Physics", "Deterministic Lockstep", "Floating Point Determinism" (gafferongames).
  - Photon Quantum — fixed-point 결정 ECS 백서.
  - Jolt / Rapier 의 결정론 설계 문서, Yann Collet 등 cross-platform float 논의.
  - Overwatch GDC "Networking Scripted Weapons and Abilities", Rocket League netcode 발표.
