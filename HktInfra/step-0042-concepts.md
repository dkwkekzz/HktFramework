# step-0042 concepts — Bounding the Dedup Set via a Reverse Prune Watermark

> 정식 기록: [step-0042.md](step-0042.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| dedup 집합(seenReqs) | 재발행 중복을 멱등 폐기하려 처리한 reqId 를 기억하는 집합(0037) | 가방 `seenReqs` — 이 step 이 워터마크로 유계화 |
| 역방향 워터마크 | producer 가 소비자에게 "이 이하는 재발행 안 한다"를 통보하는 단조 경계 | 게이트웨이 `svc.item.seen{upTo: inAcked}` |
| 재발행 범위 ↔ dedup 범위 상보성 | 재발행은 >inAcked, dedup 필요 범위는 ≤inAcked 의 잔여 — 같은 워터마크로 자름 | 안전성(dupe 0)의 근거 |
| 유계 exactly-once | dedup 집합이 영구 보관 없이도 정확 | replay 소스 유계(0039~40) ⇒ dedup 도 유계 |
| ack 핸드셰이크 폐루프 | 전진 ack(0040)+역방향 워터마크(이 step)로 producer/consumer 메모리 양쪽 묶음 | svc.item.ack ⊕ svc.item.seen |

## 1. 문제 — 무한히 자라는 dedup 집합

0037 은 버스 failover 의 *요청 경로* 무손실을 위해 게이트웨이가 보관한 요청을 복구 시 재발행하게 했다. 재발행은 gap *전* 도달한 요청도 다시 보내므로, 가방은 reqId 를 `seenReqs` 에 기록해 *최초 1회만* 처리한다(pickup 이중 mint 0). 문제: `seenReqs` 는 처리한 *전* reqId 를 영구 보관 → 장기 가동 시 메모리 무한 성장. 0040·0041 이 게이트웨이 inBuffer·가방 outBuffer 를 유계화했지만 이 dedup 집합은 §9 미해소로 남아 있었다.

## 2. 핵심 관찰 — 재발행 범위와 dedup 범위는 상보적이다

게이트웨이는 `busAck`(0040) 으로 inBuffer 에서 `reqId ≤ inAcked` 를 가지친다 — 즉 **재발행 소스에는 `reqId > inAcked` 만 남는다.** 따라서:

- 재발행이 닿을 수 있는 reqId = **> inAcked**
- dedup 으로 막아야 할 reqId = 재발행될 수 있는 것 = **> inAcked**
- 그러므로 `reqId ≤ inAcked` 는 *영영 재출현하지 않는다* → 그 dedup 상태는 **불필요**.

dedup 집합은 "재발행이 닿을 수 있는 창"만 기억하면 된다. replay 소스가 유계(0039~0040)이므로 dedup 집합도 유계일 수 있다. 흔한 직관("exactly-once dedup 은 영구 보관")은 *무계 replay* 를 암묵 가정한 것이다.

## 3. 메커니즘 — 역방향 워터마크

게이트웨이가 `inAcked` 가 전진할 때 그 값을 `svc.item.seen{upTo}` 로 가방에 통보한다. 가방은 `seenReqs` 에서 `reqId ≤ upTo` 를 제거한다. 이는 0040 ack 의 *역방향*이다:

- **전진(0040)**: 가방 → 게이트웨이 `svc.item.ack{reqId}` ("처리했다" → inBuffer 가지치기)
- **역방향(이 step)**: 게이트웨이 → 가방 `svc.item.seen{inAcked}` ("이 이하 재발행 안 한다" → seenReqs 가지치기)

ack 가 한 바퀴 돌아 producer(게이트웨이 inBuffer)와 consumer(가방 seenReqs) 양쪽의 무계 상태를 *같은 워터마크*로 묶는다.

## 4. 자기-크기조정과 failover 안전성

- **정상 구간**: ack→inAcked 전진→seen 통보→seenReqs 가지치기 가 한두 tick 안에 돌아 seenReqs 가 in-flight 만 남는다(피크 24·가동 길이 무관).
- **gap 구간**(bus crash): ack 가 끊겨 inAcked 가 정지 → seen 워터마크도 정지 → **gap reqId 가 seenReqs 에 보존된다.** 복구 시 게이트웨이가 gap 요청을 재발행하면 보존된 seenReqs 가 정확히 그것들을 dedup 으로 폐기(이중 mint 0).

즉 *유계화* 와 *dupe 0* 가 충돌하지 않는다 — gap 동안 자동으로 보관 창이 넓어지고 정상 복귀 후 다시 좁아진다. 검증(`seenbound`): 무계 seenReqs 60→120→180(∝처리) vs bound peak 24 고정·minted 동일·dupe 0·failover 에도 dupe 0(peak 60→54).

## 5. 정직한 한계

- **단일 producer 가정**: 워터마크는 게이트웨이 단일 producer 의 reqId 네임스페이스 기준이다. 다중 게이트웨이가 같은 가방에 발신하면 reqId 가 겹쳐 producer 별 워터마크가 필요(현재 단일이라 충분).
- **gap 비용**: failover 시 보관 창이 gap 만큼 커진다(dupe 0 보존의 대가) — 유계지만 완벽 튜닝된 고정 창보다 클 수 있다(0040/0041 과 동일 트레이드오프).

## 한 줄 요약

게이트웨이가 자기 inBuffer prune 프런티어(inAcked)를 역방향 워터마크로 통보하면 가방이 dedup 집합을 그만큼 잊을 수 있다 — 재발행 범위와 dedup 보관 범위가 상보적이라, 유계 replay 위에서 dedup 도 영구 보관 없이 정확(dupe 0)하게 유계화된다.
