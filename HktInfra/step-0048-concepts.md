# step-0048 concepts — Consumer Lease Lifecycle Reconciliation

> 정식 기록: [step-0048.md](step-0048.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 소비자 lease (복습) | 생산자 frontier 보다 `leaseSpan` 이상 침묵한 소비자를 *죽은 것*으로 보고 min 정의역에서 축출 | 0045 가 도입, 이 step 이 lifecycle 을 보강 |
| 시작-시점 죽음 (§2) | 구독은 했으나 *한 번도 ack 안 한* 소비자 — 축출 기준 미확립 + min 을 -1 에 고정 | 지연 baseline 으로 해소 |
| 지연(lazy) baseline | 침묵 시계를 *처음 sweep 에서 만났을 때* frontier 로 시작(leaseSpan grace) | §2 의 해법 |
| 축출 비가역 (§3) | `evicted` 에 한 번 들면 영영 못 빠짐 → 돌아온 소비자 정의역 미복귀 | 재admission 으로 해소 |
| 재admission | 축출된 소비자가 재-ack 하면 `evicted` 에서 제거 → min 정의역 복귀 | §3 의 해법 |
| lease lifecycle | 소비자의 정의역 멤버십이 진입(구독)·죽음(축출)·복귀(재admission)를 따라가는 것 | 이 step 의 한 조각 |

## 1. lease 가 푼 문제와 남긴 두 구멍 (복습→문제)

0044 의 min-워터마크는 결과 버퍼(`outBuffer`)를 *모든 소비자 frontier 의 최소*까지만 가지친다 — 그래야 가장 뒤처진 소비자도 굶지 않는다. 대가는 "한 소비자가 영영 죽으면 그 frontier 에 min 이 고정돼 버퍼 무계 성장". 0045 의 lease 가 이를 풀었다: 생산자 frontier 보다 `leaseSpan` 이상 *침묵*한 소비자를 죽은 것으로 보고 정의역에서 축출 → min 이 산 소비자만으로 전진 → 버퍼 drain.

여기서 *침묵*의 측정은 `consumerSeen`(소비자가 마지막 ack 한 시점의 생산자 frontier)에 기댄다. 그런데 이 값은 **그 소비자가 처음 ack 할 때** 비로소 생긴다. 두 구멍이 여기서 난다:

- **§2 — 한 번도 ack 안 하면 침묵을 못 잰다.** 구독만 하고(정의역에 들고) 영영 죽은 소비자는 `consumerSeen` 이 영영 안 생긴다 → 축출 sweep 의 `seen !== undefined` 검사를 통과 못 함 → **영영 안 축출**. 더 나쁜 건 min 계산: `consumerWm` 도 없으니 그 소비자는 `-1` 로 계산돼 **min 을 -1 에 고정** → 버퍼가 아무것도 못 가지침. lease 가 풀려던 무계 성장이 *처음부터 죽은* 소비자에겐 그대로 재발한다.
- **§3 — 축출은 돌이킬 수 없다.** `evicted` 에 들어간 소비자는 영영 거기 머문다. 그 소비자가 *돌아와도*(재구독 → 결과 재수신 → 재-ack) 정의역에 복귀할 길이 없다 → 돌아온 소비자가 필요로 하는 *이후* 결과까지 버퍼가 자유롭게 가지쳐 **starve 가 재발**한다.

두 구멍은 lease 정의역이 소비자 *lifecycle* 의 양 끝(진입·복귀)을 추적 못 해서 생긴다 — 그래서 한 조각으로 함께 푼다.

## 2. 지연 baseline — "ack 할 기회를 준 시점"부터 침묵을 잰다 (§2 해법)

직관적 해법은 "구독하면 즉시 침묵 시계를 켠다"(생성 시 `consumerSeen=-1`)지만, 이건 **건강한 소비자를 오축출**한다. 게이트웨이와 ranking 이 같은 결과 스트림을 받아도 ack 도착에 한 tick 차가 나면, 시작 버스트에서 frontier 가 `leaseSpan` 을 넘어 전진한 뒤에야 ranking 첫 ack 이 도착할 수 있다 → ranking 이 *살아있는데* 축출(그 뒤 재admission 으로 자가 복구하지만 flap). 검증의 ctl 이 이걸 `ev 1·readm 1` 로 정확히 드러냈다.

그래서 채택한 건 **지연(lazy) baseline**: 축출 sweep 이 침묵 기준 없는 소비자를 *처음 만났을 때* 그때의 frontier 로 기준을 깔고 이번엔 안 축출한다(= `leaseSpan` 만큼의 grace). 다음 sweep 부터 `frontier − baseline > leaseSpan` 으로 잰다. 효과:

- 산 소비자: grace 안에 첫 ack → `consumerSeen` 이 *현재* frontier 로 갱신 → 영영 안 축출(ctl `ev 0`).
- never-ack 소비자: grace 가 지나도 침묵 → `leaseSpan` 뒤 축출 → min 이 산 소비자만으로 전진 → 버퍼 유계(peak 36, run-length 무관).

lease 의 침묵 시계는 "구독했다"가 아니라 "ack 할 기회를 줬다"부터 가야 한다 — 그게 지연 baseline 의 뜻이다.

## 3. 재admission — 축출을 가역으로 (§3 해법)

축출이 *영구 죽음*에만 안전한 판정인데, 현실의 "죽음"은 종종 *일시적*(재시작·재구독)이다. 그래서 축출을 **가역**으로 만든다: 축출된 소비자가 다시 ack 하면(돌아왔다는 증거) `evicted` 에서 빼 정의역에 복귀시킨다(`readmissions` 계측). 복귀 후 그 소비자의 frontier 가 다시 min 을 눌러 *이후* 결과를 보존한다.

주의할 정합 두 가지: ⒜ `outAcked` 는 단조라 복귀가 워터마크를 *되돌리진* 않는다 — 전진을 *멈출* 뿐(이미 가지친 옛 결과는 못 되살림). ⒝ 갓 복귀한 소비자를 같은 tick 즉시 재축출하지 않도록 sweep 가 방금 ack 한 소비자(`c===ev.consumer`)를 건너뛴다. 복귀가 닫는 건 *복귀 이후의* starve 재발이고, 축출 윈도 동안 잃은 옛 결과는 그 소비자가 자기 쓰기 저널 reconstruct(0020)로 복구한다.

## 4. 왜 한 조각인가 — lifecycle 의 양 끝

§2(진입·죽음)와 §3(복귀)를 한 플래그(`busLeaseLife`)로 묶은 건 둘이 *서로를 필요로* 하기 때문이다. §2 만 고쳐 never-ack 소비자를 적극 축출하면, *일시적으로 느린* 소비자를 비가역으로 오축출할 위험이 커진다 — §3 의 가역성이 그 안전망이다. 두 빈틈은 같은 정의역(`evicted` + `consumerSeen` baseline)의 양 끝이라 함께 풀어야 lease 가 lifecycle 에 대해 정합한다.

## 한 줄 요약

소비자 lease 의 침묵 시계를 "ack 할 기회를 준 시점"부터 켜고(지연 baseline → never-ack 소비자도 유계 축출·§2) 축출을 재-ack 으로 되돌릴 수 있게(재admission → 돌아온 소비자 정의역 복귀·§3) 만들어, lease 정의역이 소비자 lifecycle 에 정합하게 했다 — `busLeaseLife` OFF=0047 비트 동일.
