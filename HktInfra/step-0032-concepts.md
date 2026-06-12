# step-0032 concepts — Bounded Sweep & In-flight Fill Retry

> 정식 기록: [step-0032.md](step-0032.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 내장 retry(self-healing sweep) | 별도 재시도 로직 없이, 주기 sweep 의 멱등 재-scan 자체가 손실된 fill 을 다음 주기에 재발신하는 성질 | fill 손실 ⒜ 닫음 |
| 유계 sweep(bounded/sliding window) | sweep 이 `durableSeq` 위 K개만 훑어 per-sweep 비용을 O(K) 로 상한 | sweep 무계 ⒝ 닫음 |
| 미끄러지는 창(sliding coverage) | `durableSeq` 전진에 창이 따라 미끄러져, K < 윈도 라도 전체를 결국 덮음 | K=8 으로 윈도 24 수렴 |
| 수렴 지연 vs 비용 상한 | 유계는 *느리게* 하지 비용을 *늘리지* 않는다 — fills 동일·durableSeq 동일 | K=8 == 무계 결과 |
| 멱등 retry | 첫 시도 드롭은 미저장 → retry 만 저장 → 중복 0 | dupe 0 |

## 1. 문제 — 0031 의 두 낙관

0031 의 quorum-fill 은 두 가지를 낙관했다:
1. **fill 은 항상 배달된다**(`resend:true` 가 손실 모델을 우회). 실 네트워크는 fill 도 떨군다 — 그러면 그 seq 는 영영 정족수 미달로 남나?
2. **sweep 은 매번 윈도 전체를 스캔한다**(`[durableSeq+1 .. journalSeq-1]`). 윈도가 크면 per-tick 비용이 윈도에 비례 — 무계.

이 step 은 두 낙관을 각각 *내장 retry* 와 *유계 sweep* 으로 닫는다.

## 2. 내장 retry — 가장 좋은 retry 는 안 짠 retry

핵심 통찰: **0031 의 sweep 은 이미 retry 다.** sweep 은 매 주기 `n<W`(정족수 미달) 인 seq 를 *다시* 채운다. fill 이 손실되면 그 seq 의 ack 가 안 와 `n` 이 안 늘고, 따라서 *다음 sweep 이 같은 seq 를 또 발견해 또 채운다*. 손실 → 미-ack → 다음 주기 재발견 → 재발신. 이것이 retry다 — 타이머도, 미-ack 추적 큐도, 재시도 카운터도 없이.

검증은 이를 결정론으로 못박는다: fill 의 *첫 시도만* 떨구는 손실 모델(`seenFill` 마킹)로 fill 당 정확히 1회 retry 를 강제 → `fills = 2 × F0`(드롭 1 + 배달 1) 가 정확히 관측된다. durableSeq 는 여전히 total-1 로 수렴 — 손실에도 윈도가 닫힌다.

대가(정직한 한계): retry 지연 = `wfPeriod` 의 배수. 손실 1회마다 한 주기를 더 기다린다. *빠른* retry(손실 즉시 감지)는 ack-타임아웃 추적을 요하며 이 step 밖.

## 3. 유계 sweep — 비용을 O(윈도) 에서 O(K) 로

무계 sweep 은 매 tick 윈도 전체를 훑는다. 윈도가 수천이면 per-tick 비용이 수천 — tick 예산을 위협한다(영속 평면이라 신성한 tick 은 아니지만, 서비스 CPU 낭비). `wfWindow=K` 는 sweep 을 `durableSeq` 바로 위 K개로 제한한다.

겉보기 우려: K < 윈도 면 상위 윈도 seq 를 영영 못 보나? 아니다 — **창이 미끄러진다.** 하위 K개가 durable 해지면 `durableSeq` 가 전진하고, 다음 sweep 의 창 `[durableSeq+1 .. durableSeq+K]` 가 위로 미끄러져 다음 K개를 본다. 윈도가 연속이면 이 미끄러짐이 전체를 덮는다. 검증: K=8 이 윈도 24 를 무계와 *동일한* fills·durableSeq 로 수렴.

흥미로운 점: 유계가 무계와 *같은* fills(2×F0)에 도달한다. 유계는 수렴을 *느리게*(더 많은 sweep 에 나눠) 할 뿐 일을 *늘리지* 않는다 — 미끄러지는 창이 각 seq 를 정확히 필요한 만큼만 친다(이미 durable 한 하위는 창에서 빠져나가 재방문 0).

## 4. 멱등은 손실 아래서도 유지된다

retry 가 중복 저장을 안 만드나? 첫 시도가 *드롭*되면 스토어에 안 닿아 *저장 안 됨* → ack 안 옴 → 둘째 시도(retry)가 *처음으로* 저장·ack. 그래서 스토어 저널에 그 seq 는 한 번만. dupe 0 가드(보유 스토어 skip)와 합쳐, 손실·retry 가 섞여도 어느 저널에도 중복 seq 0.

(경계: 첫 시도가 *닿고 ack 만* 손실되는 케이스는 이 모델 밖 — 비-신뢰 스토어면 둘째가 중복 저장될 수 있고, 신뢰 스토어(0023 recvSeqs dedup)면 그조차 멱등. ack-손실×신뢰 스토어 결합은 후속.)

## 한 줄 요약

0031 윈도 해소 sweep 은 *고칠 게 없는 retry* 와 *유계 비용*을 거의 공짜로 얻는다: fill 이 손실돼도 주기 재-scan 이 다음 주기에 자연 재발신(내장 retry·fills 2×F0 로 관측)하고, sweep 을 `durableSeq` 위 K개로 유계화해도 미끄러지는 창이 전체 윈도를 무계와 *동일 비용*으로 덮는다. 첫 시도 드롭은 미저장이라 retry 에도 dupe 0, 그렇게 만든 durable 은 crash{primary,p4} 를 견딘다. wfWindow 0 = 0031 비트 동일.
