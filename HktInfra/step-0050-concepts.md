# step-0050 concepts — Adaptive leaseSpan (self-sizing the eviction threshold from observed ack cadence)

> 정식 기록: [step-0050.md](step-0050.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| ack cadence(침묵 길이) | 한 소비자가 연속 ack 사이에 생산자 frontier 가 전진한 양 | 산/죽음을 가르는 liveness 신호 |
| 고정 leaseSpan 의 한계 | 임계가 정상 cadence 보다 작으면 *산* 소비자를 반복 오축출 | 0048 §9 정직한 한계 |
| flapping | 산 소비자가 cadence 주기마다 축출→재admission→재축출 | 고정 작은 임계 OFF 의 증상(ev ∝ 생산량) |
| consumerMaxGap | 소비자가 *살아서 견딘* 최대 침묵의 per-c 러닝 최대 | 적응형 임계의 cadence 추정 |
| 적응형 임계 | `consumerMaxGap + leaseSpan`(여유 마진) | leaseSpan 의미: 절대 임계 → cadence 위 마진 |
| 죽음 감지 보존 | 죽은 소비자는 max 동결 → 침묵이 동결값+마진 초과 → 여전히 축출 | 적응형이 유계성을 깨지 않음 |

## 1. 왜 고정 임계가 문제인가 — ack cadence 는 사전에 모른다

소비자 lease(0045)는 *침묵한* 소비자를 죽은 것으로 보고 결과 버퍼(outBuffer)의 min-워터마크 정의역에서 축출한다. 침묵 = `frontier − consumerSeen(c)`: 소비자 c 가 마지막 ack 한 이후 생산자(가방)가 부여한 결과 outSeq 가 얼마나 늘었는가. 산 소비자도 이 값이 *정상적으로* 어느 정도 커진다 — 생산이 ack 보다 앞서거나, 소비자가 결과를 묶어 처리하면. 그 *정상 cadence* 는 생산율×소비자 속도의 함수라 **운영 전엔 알 수 없다**.

`leaseSpan` 이 고정이면 두 갈래로 다 진다: 너무 작으면(< 정상 cadence) 산 소비자를 cadence 주기마다 오축출하고, 너무 크면 진짜 죽은 소비자를 늦게 감지해 버퍼가 그만큼 더 큰다. 0048 verify §9 가 이를 "영구-죽음 vs 일시-지연 분리 임계 — 여전히 오축출 위험" 으로 남겼다. 실측으로 산 ranking 소비자는 `leaseSpan ≤ 5` 에서 축출되고 `≥ 6` 에서 안전했다(정상 cadence peak ~6).

## 2. flapping — 오축출이 *영구* 가 아니라 *반복* 이다

0048 의 lifecycle 정합(busLeaseLife)이 축출된 소비자의 재admission(재-ack 시 정의역 복귀)을 더했다. 그래서 고정 작은 임계 아래에서 산 소비자는 *영영 죽지* 않는다 — 대신 cadence 주기마다 **축출 → 재admission → 다시 침묵 → 재축출** 을 반복한다. 이 churn 이 flapping 이고, 횟수가 생산량(결과 outSeq 총량)에 비례한다(ops10 → 6회, ops30 → 26회). 한 번의 오축출보다 더 나쁘다: 매 주기 그 소비자가 필요로 하는 결과 보존이 흔들린다.

## 3. consumerMaxGap — 살아서 견딘 cadence 를 학습

핵심 통찰: **산 소비자의 침묵은 언젠가 ack 으로 끝나고, 죽은 소비자의 침묵은 영영 안 끝난다.** 그래서 ack 으로 *끝난* 침묵은 "증명된 생존 cadence" 다. 소비자 c 가 ack 할 때마다 그 직전 침묵 `frontier − prevSeen(c)` 을 per-c 러닝 최대 `consumerMaxGap(c)`(단조 증가)로 모은다.

축출 임계가 `frontier − seen > consumerMaxGap(c) + leaseSpan` 로 바뀐다. `leaseSpan` 은 이제 *cadence 위의 여유 마진* 이다. 산 소비자는 침묵이 자기 관측 cadence 를 마진 안에서만 넘으므로 학습 후 오축출 0. 죽은 소비자는 ack 이 끊겨 max 가 *동결* → 침묵이 무한 전진해 동결값+마진을 초과 → 여전히 축출(유계 보존). 이는 0040/0041 의 "결과 ack 워터마크 self-sizing(peak 가 가동-길이 무관)" 을 lease 임계에 적용한 것 — 사람이 K(또는 leaseSpan)를 맞추지 않는다.

## 4. 무엇을 검증했나

- **reg**: busLeaseAdapt=0 → consumerMaxGap 미사용·임계=leaseSpan → 0049 비트 동일.
- **live**: 고정 OFF 는 flapping(ev ∝ 생산량·6→26) vs 적응 ON 은 학습 후 정착(ev=O(1)·1·생산량 무관).
- **dead**: 적응형도 죽은 소비자 축출(evicted=true) → outBuffer 유계(peak 30) vs lease 끔(무계·156).
- **정합**: minted 보존(dedup 무손상)·원장 자기-정합.

## 5. 정직한 한계

bootstrap 1회 오축출은 *0 이 아니다*(ev=1): cadence 를 학습하려면 그 cadence 의 침묵을 최소 1회 ack 으로 끝낸 사건을 봐야 하므로, 첫 주기엔 prior 가 없어 1회 오축출(readmission 으로 회복). 시작 grace prior 가 후속. consumerMaxGap 은 단조라 cadence 가 *줄면* 임계가 안 내려간다(보수적·EWMA 감쇠 후속). cadence 는 단일 producer(가방) frontier 기준 — 다중 producer 의 producer 별 cadence 분리는 후속.

## 한 줄 요약

고정 leaseSpan 은 *모르는* 정상 cadence 보다 커야 산 소비자를 안 쫓는다 — busLeaseAdapt 는 ack 으로 끝난 침묵(consumerMaxGap)으로 cadence 를 학습해 임계를 self-size: 산 소비자는 정착(flapping → O(1)), 죽은 소비자는 여전히 축출(유계 보존).
