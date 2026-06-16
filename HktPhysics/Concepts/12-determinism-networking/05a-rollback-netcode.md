# [12·2.5a] Rollback Netcode — 예측·재시뮬의 기계 (Prediction & Re-simulation, from the ground up)

> "예측이 어떻게 거의 맞는가", "과거로 되감아 다시 돌리는데 왜 화면이 안 튀는가", "save/restore 에 무엇을 담아야 하고 빠뜨리면 왜 어긋나는가"를 **타임라인과 함께 근본부터** 푼다.
> **상위 노드**: [05-network-models.md](05-network-models.md) · [12-determinism-networking.md](../12-determinism-networking.md) · **상위 지도**: [README.md](../README.md) · **의존**: [01-determinism](01-determinism.md) · [04-deterministic-sim-requirements](04-deterministic-sim-requirements.md)

---

## 0. 한 문장 요약

> **rollback netcode = "상대 입력이 아직 안 왔으니 *일단 예측해서* 진행하고, 진짜 입력이 오면 *틀린 그 프레임으로 되감아 다시 돌리는*" 시간여행 시뮬레이션이다.** 결정론이 재시뮬을 원래와 비트까지 똑같게 만들어 주고, 한 프레임 안에 여러 프레임을 다시 돌릴 만큼 step 이 가볍고 save/restore 가 빨라야 화면이 안 튄다.

전통적 지연 기반(delay-based) netcode 는 상대 입력을 *기다렸다가* 진행해서 핑이 곧 입력 지연이 된다. rollback 은 기다리지 않는다 — 그래서 격투 게임처럼 프레임 단위 반응성이 생명인 장르의 표준이 됐다.

---

## 1. 왜 예측이 거의 맞는가

핵심 통찰: **사람의 입력은 프레임 단위로 보면 거의 안 바뀐다.** 60fps 에서 한 프레임은 16.7ms — 그 사이 플레이어가 방향을 바꾸거나 버튼 상태를 토글할 확률은 낮다. 그래서 가장 단순한 예측 "**지난 프레임 입력을 그대로 반복한다**"가 대부분의 프레임에서 맞는다.

```
예측 규칙(기본형):  predicted_remote_input[f] = last_known_remote_input
```

예측이 맞으면 — 절대다수의 프레임 — rollback 은 *아무 일도 하지 않는다*. 보이지 않는 비용 없는 진행이다. 예측이 틀리는 건 상대가 실제로 입력을 바꾼 순간뿐이고, 그때만 §2 의 되감기가 발동한다.

---

## 2. 되감고 다시 돌리기 — 타임라인

```
프레임 진행:        ... f7  f8  f9   (f8·f9 는 예측한 원격 input 으로 이미 진행됨)
                              ▲ 여기서 로컬은 벌써 f9 까지 와 있다 (반응성 확보)

원격 input 도착 →   f8 의 *실제* input 이 예측과 다름이 판명

rollback:           ① 상태를 f8 직전(= f7 끝)으로 restore
                    ② f8 을 진짜 input 으로 re-sim
                    ③ f9 도 (이미 알던 로컬 input + 갱신된 원격 input 으로) re-sim
                    ④ 현재 프레임까지 catch-up
```

이 ①~④ 가 **한 화면 프레임 안에** 다 끝나야 한다. 그래서 두 전제가 필수다:

- **결정론**: ②③ 의 재시뮬이 원래 진행과 *비트까지* 같은 규칙을 따라야 한다. 안 그러면 catch-up 한 현재 상태가 미묘하게 달라 매 정정마다 튄다. (재시뮬을 순수 함수로 만드는 요건 = [04-deterministic-sim-requirements](04-deterministic-sim-requirements.md).)
- **빠른 step + save/restore**: N 프레임 되감으면 N 번 재시뮬 + 1 번 restore 를 16.7ms 안에. step 이 무겁거나 스냅샷 복원이 느리면 프레임을 놓친다.

## 왜 화면이 안 튀는가

정정은 "현재 보이는 프레임"이 아니라 **과거 프레임(f8)** 에서 일어난다. 다시 돌린 결과가 현재까지 catch-up 되어 화면에 반영될 때, 예측이 *거의* 맞았다면(§1) 정정 폭이 작아 눈에 안 띈다. 예측이 크게 틀린 드문 경우에만 약간의 순간이동(teleport)이 보이고, 보통 보간/스무딩으로 가린다.

---

## 3. save/restore — 무엇을 담아야 하는가 (그리고 누락의 저주)

rollback 은 임의 과거 프레임으로 **상태를 복원**할 수 있어야 한다. 즉 시뮬 상태 전체를 빠르게 직렬화/역직렬화해야 한다. 실무에선 **SoA 메모리 + 고정 크기 풀** 로 짜서 `memcpy` 수준으로 save/restore 한다(포인터·동적 할당이 없어야 통째 복사가 가능).

여기서 가장 악명 높은 버그: **"시뮬 상태인데 스냅샷에 안 담긴 것"**. step 의 출력에 영향을 주는데 save 대상에서 빠진 숨은 상태가 있으면, restore 후 재시뮬이 원래와 어긋난다. 대표적 누락:

- **warm-start 람다(λ) 캐시** ([05-constraint-solving](../05-constraint-solving.md)) — 솔버가 이전 프레임 임펄스를 끌어다 쓴다. 안 담으면 수렴 경로가 달라진다.
- **broadphase 트리/페어 캐시** ([04](../04-collision-detection.md)·[11](../11-spatial-structures.md)) — 후보쌍 순서가 다음 step 입력이다.
- **sleeping/island 플래그** — 자고 있던 객체가 깨어 있는 걸로 복원되면 경로가 갈린다.
- **RNG 시드 상태** — 재시뮬 중 같은 난수열이 나와야 한다.

> 규칙: **"다음 step 의 입력이 될 수 있는 모든 것"이 스냅샷 대상**이다. ([04-deterministic-sim-requirements](04-deterministic-sim-requirements.md) 의 1~6 이 그대로 "save 해야 할 목록"이기도 하다.) 무엇이 시뮬 상태인지 경계가 흐리면 rollback 은 미묘한 desync 로 무너진다.

---

## 4. lockstep 과의 대조 — 왜 rollback 이 반응성을 사는가

| 축 | Deterministic lockstep | Rollback (GGPO) |
|---|---|---|
| 원격 입력 | **기다린다**(확정 후 step) | **예측**으로 안 기다림 |
| 입력 지연 | = RTT (느린 피어가 묶음) | 숨김(예측), 정정은 과거에서 |
| 결정론 필요 | 필수 | 필수(재시뮬 bit-exact) |
| 추가 비용 | 없음 | save/restore + 재시뮬 N프레임/프레임 |
| 적합 | 다수 유닛 RTS/MMO | 소수 객체 격투/대전 |

둘 다 결정론에 의존하지만 **시간 처리가 정반대**다. lockstep 은 모두를 동기화 지점에 묶어 *기다리고*, rollback 은 예측으로 *앞서 나간 뒤 틀리면 고친다*. 그래서 rollback 은 객체가 적고(되감기 비용이 작고) 반응성이 생명인 격투에, lockstep 은 객체가 많고(예측·되감기 비용이 폭발) 약간의 지연이 허용되는 RTS 에 맞는다.

---

## 5. 함정 (전체 체크리스트는 [12-determinism-networking §5](../12-determinism-networking.md#5-함정--결정론-체크리스트))

- **save/restore 누락 상태** — warm-start λ·broadphase 트리·sleeping 플래그·RNG 가 스냅샷에 빠지면 재시뮬이 어긋난다. "다음 step 입력이 되는 모든 것"을 점검.
- **재시뮬 비결정** — ② 의 재시뮬이 원래와 다른 규칙(다른 순서·다른 부동소수점 경로)을 타면 매 정정이 튄다. step 을 순수 함수로.
- **무거운 step / 느린 스냅샷** — N프레임 catch-up 이 한 프레임 예산을 넘으면 프레임 드랍. SoA·고정 풀로 memcpy 복원.
- **과한 예측 거리** — 핑이 크면 되감을 프레임이 늘어 비용·정정 폭이 커진다. 입력 지연을 약간 섞어 균형.

---

## 6. 더 읽기

- [05-network-models](05-network-models.md) — 네트워크 모델 스펙트럼(이 문서의 상위 절).
- [04-deterministic-sim-requirements](04-deterministic-sim-requirements.md) — 재시뮬을 bit-exact 로 만드는 코어 루프 요건(= save 목록).
- [01-determinism](01-determinism.md) — same-binary vs cross-platform 등급(롤백은 보통 same-binary 면 충분).
- GGPO 문서 / Glenn Fiedler, "Networked Physics" (gafferongames).
- "Skullgirls" / EVO 시리즈 rollback 사례 발표.
