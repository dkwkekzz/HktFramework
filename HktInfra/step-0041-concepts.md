# step-0041 concepts — Result-Path Replay Buffer Self-Sizing via Consumer Ack

> 정식 기록: [step-0041.md](step-0041.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 결과 경로 replay 버퍼 | producer(가방)가 발신 결과를 보관했다 버스 복구 시 재발행하는 무손실 소스(0036 outBuffer) | 가방 `outBuffer` — 이 step 이 ack 로 유계화 |
| ack 워터마크 가지치기 | 소비자가 처리 확인한 순번 이하를 producer 버퍼에서 제거 → 미-ack 만 남김 | 게이트웨이 `svc.item.out.ack{outSeq}` → 가방 `_onOutAck` |
| 자기-크기조정 | 고정 K 추정 없이 버퍼가 정상=0, gap=gap만큼 자동 성장 | 정상 idle drain·gap 자동 성장 → resendOut 이 덮음 |
| 멱등 결과 | belief Set 갱신이라 재배달 무해 → consumer dedup 불요 | ack 는 dedup 아닌 *가지치기 신호*(0036 발견 재사용) |
| producer/consumer 대칭 | 요청 경로(0040)와 결과 경로는 방향만 뒤바뀐 같은 구조 | `_onItemAck`↔`_onOutAck`·`svc.item.ack`↔`svc.item.out.ack` |

## 1. 왜 결과 버퍼도 유계화가 필요한가 — 0039→0040→0041 의 흐름

버스 failover(0034)는 라우팅(파생 상태)만 복구한다 — crash gap 동안 떨군 메시지는 버스(영속 0)가 못 메운다. 진실 원천인 *producer 가 재발행*해야 한다(0036 결과 경로·0037 요청 경로). 그러려면 producer 가 발신물을 *보관*해야 하는데, 무계 보관은 장기 가동 시 메모리 무한 성장(런타임 위험)이다.

0039 는 이를 *고정 K 창*(busWindow — 최근 K 개만)으로 묶었다. 그러나 K 는 *최대 예상 gap(다운타임×발신율)* 을 운영자가 사전 추정해야 한다 — 작으면 gap 의 일부가 evict 되어 손실, 크면 메모리 낭비. 0040 은 *요청 경로*에서 이 추정을 없앴다(소비자 ack 로 가지치기). **이 step 은 *결과 경로*에서 같은 일을 한다.** 0040 §9 가 "결과 경로 outBuffer ack-가지치기는 후속"이라 명시했던 그 조각이다.

## 2. ack 워터마크 가지치기 — 결과 경로 판

가방이 `svc.item.out` 으로 결과를 발신할 때 producer-local 단조 순번 `outSeq` 를 붙인다(0,1,2,…). outBuffer 는 이 순서로 쌓이므로 front 가 항상 최소 outSeq 다.

소비자인 게이트웨이는 결과를 클라에 *중계할 때마다* 그 `outSeq` 를 `svc.item.out.ack` 로 가방에 돌려보낸다("이건 클라까지 갔다"). 가방은 받은 outSeq 로 워터마크 `outAcked` 를 단조 전진시키고, `outBuffer[0].outSeq ≤ outAcked` 인 동안 front 를 제거한다. 남는 건 *아직 클라 도달이 확인 안 된*(in-flight) 결과뿐 — 이게 정확히 *재발행이 필요할 수 있는* 집합이다.

## 3. 자기-크기조정이 K 추정을 없애는 원리

- **정상 구간**: 발신→중계→ack 가 한두 tick 안에 돌아 outBuffer 가 0 으로 빠진다(idle drain). 메모리 ≈ in-flight backlog(발신 버스트의 함수·가동 길이 무관).
- **gap 구간**: 버스 crash 로 게이트웨이가 끊기면 ack 도 멈춘다 → 그 사이 발신 결과가 outBuffer 에 *그대로 쌓인다*(가지칠 ack 가 없으니). 버퍼가 **정확히 gap 크기만큼** 자동 성장.
- **복구**: 재구독 직후 `resendOut` 이 outBuffer(=미-ack=gap 결과)를 재발행 → 뒤처진 클라가 따라잡는다(desync 0). 운영자가 gap 을 *몰라도* 버퍼가 알아서 그만큼 컸으므로 무손실.

검증 수치(verify `busoutack`): ack 변종 desync 0(unbnd 와 동일·무손실)·미-튜닝 fixedK8 desync 4(대조: K<gap 손실)·ack 최종 outBuffer 0(idle drain)·가동 길이 70/140/210 에서 unbnd outBuf 60/120/180(∝발신) vs ack peak 24 고정.

## 4. 왜 결과 손실은 desync 로, 요청 손실은 minted 로 나타나는가

- **요청 손실**(0040): 요청이 안 닿으면 mint 자체가 없다 → ledger 에도 belief 에도 없음 → *정합*(desync 0). 지표는 `minted<base`.
- **결과 손실**(이 step): mint 는 됐는데(ledger 에 있음) 결과(item_result)가 클라에 안 닿으면 belief 가 뒤처진다 → *불일치*(desync>0). 지표는 `itemDesync`.

그래서 같은 ack-가지치기지만 무손실의 *증거*가 경로마다 다르다. 0040 fixed 의 "minted−10·desync 4" 에서 desync 4 는 사실 결과 경로 손실이었다(busWindow 가 두 버퍼를 함께 묶었으므로) — 이 step 이 결과 버퍼를 ack 로 분리해 그 절반을 해소했다.

## 5. 정직한 한계 — 다중 소비자

ack 가지치기는 *게이트웨이*(클라 접점) 중계에 키잉된다. `svc.item.out` 에는 둘째 소비자 ranking 도 구독한다 — 만약 ranking 이 게이트웨이보다 뒤처진 채 가방이 outBuffer 를 가지치면, ranking 이 놓친 결과를 복구하지 못할 수 있다. 현 토폴로지는 두 소비자가 같은 버스 crash/재구독으로 lockstep 배달되어 안전하다(rankDesync 0 확인). 일반 N-소비자 환경에선 *모든 구독자 ack 의 최소*(min-워터마크)로 가지쳐야 한다 — 후속 과제.

## 한 줄 요약

0040 의 요청 버퍼 ack-가지치기를 *결과 버퍼*에 거울처럼 적용 — 게이트웨이가 중계한 outSeq 를 ack 하면 가방이 outBuffer 를 자기-크기조정해, 고정 K 추정 없이 결과 경로도 무손실·유계·가동-길이 무관을 달성한다.
