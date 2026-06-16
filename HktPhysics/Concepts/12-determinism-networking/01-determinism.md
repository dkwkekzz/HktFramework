# [12·2.1] 결정론이란 — 등급과 동기 (What Determinism Is)

> 같은 초기 상태 + 같은 입력 → 어디서나 같은 출력. 이 단순한 성질이 lockstep·롤백·리플레이의 모든 전제다.
> **상위 노드**: [12-determinism-networking.md](../12-determinism-networking.md) · **상위 지도**: [README.md](../README.md) · **의존**: [00-foundations](../00-foundations.md)

---

**결정적 시뮬레이션(deterministic simulation)** 이란, 동일한 초기 상태 `S₀` 와 동일한 입력열 `(I₀, I₁, …, Iₙ)` 이 주어지면 *어느 머신·어느 실행에서도* 동일한 상태열 `(S₁, …, Sₙ₊₁)` 을 내는 성질이다. step 함수가 **순수 함수(pure function)** — 숨은 입력(시계·난수·메모리 주소·스레드 스케줄)에 의존하지 않는 함수 — 여야 성립한다.

```
S_{t+1} = step(S_t, I_t)      // step 은 순수 함수여야 한다
∀ machine A, B:  S₀ᴬ = S₀ᴮ ∧ Iᴬ = Iᴮ  ⇒  Sₙᴬ = Sₙᴮ
```

## 결정론의 두 등급 (그리고 비결정 근사)

"결정적"은 흑백이 아니라 **얼마나 넓은 환경에서 비트가 일치하느냐**의 등급 문제다. 이 등급을 처음에 정하지 않으면 뒤의 모든 정책(부동소수점 통제 강도, fixed-point 채택 여부)이 흔들린다.

| 등급 | 정의 | 쓰임 |
|---|---|---|
| **bit-exact (cross-platform)** | 모든 비트가 일치. ARM/x86, MSVC/Clang, GPU/CPU 무관 | deterministic lockstep MMO/RTS, 입력만 전송하는 P2P, 크로스플레이 |
| **bit-exact (same-binary)** | *같은 바이너리·같은 하드웨어*에서만 일치 | 단일 플랫폼 격투 게임 롤백, 같은 빌드끼리의 리플레이 |
| **통계적/근사 (statistical)** | 평균·분포는 같지만 비트는 다름 | 비결정 시뮬 + 상태 복제. 동기화는 네트워크로 강제 |

직관: 위로 갈수록 보장이 강하고 구현이 비싸다. **크로스플랫폼 bit-exact 가 가장 어렵다** — 같은 소스라도 컴파일러·CPU·라이브러리가 다르면 마지막 비트가 갈리기 때문이다(왜 그런지는 [02-float-enemies](02-float-enemies.md) 와 [02a-why-float-diverges](02a-why-float-diverges.md)). same-binary 만 필요하면 부담이 크게 준다.

## 왜 필요한가 — 세 가지 용례가 결정론을 *강제*한다

1. **Deterministic lockstep (RTS/MMO)** — 수천 유닛의 전체 월드 상태를 매 프레임 전송하면 대역폭이 폭발한다. 대신 **입력(input)만** 교환하고 각 클라이언트가 동일 시뮬을 독립 실행한다. 결정론이 깨지면 클라이언트들이 갈라져(desync) 게임이 붕괴한다. (→ [05-network-models](05-network-models.md))
2. **Rollback netcode (격투/대전)** — 상대 입력을 받기 전에 예측으로 진행하고, 틀리면 과거로 되감아(rollback) 재시뮬(re-sim)한다. 재시뮬이 원래 결과와 *비트 단위로* 같아야 화면 튐 없이 수렴한다. (→ [05a-rollback-netcode](05a-rollback-netcode.md))
3. **Replay / Spectate / 디버깅** — 입력열 + 초기 시드만 저장하면 전체 경기를 재현한다. 결정론은 리플레이 용량을 입력 크기로 줄이고, 버그를 100% 재현 가능하게 만든다.

> **핵심 메시지**: 결정론은 사후에 끼워 넣을 수 없다. 어느 등급을 목표로 하느냐가 자료구조·메모리 레이아웃·컴파일 플래그·네트워크 모델을 *처음부터* 규정한다. (→ 요건 전체는 [04-deterministic-sim-requirements](04-deterministic-sim-requirements.md))

---

**관련 함정** (전체 체크리스트는 [12-determinism-networking §5](../12-determinism-networking.md#5-함정--결정론-체크리스트)):
- **"float 은 비결정"은 오해** — IEEE 기본 연산은 결정적이다. 비결정은 *컴파일러·하드웨어·순서*에서 온다. 적을 정확히 지목하라([02-float-enemies](02-float-enemies.md)).
- **결정론은 사후 추가 불가** — 목표 등급과 네트워크 모델을 프로젝트 초기에 확정하라.

**다음**: [02-float-enemies](02-float-enemies.md) — 결정론을 깨는 부동소수점의 적들.
