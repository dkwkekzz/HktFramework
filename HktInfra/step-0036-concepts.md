# step-0036 concepts — Producer replay: making bus failover lossless on the result path

> 정식 기록: [step-0036.md](step-0036.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| Producer replay | 메시지 *발신자*가 보낸 것을 보관했다 장애 복구 시 다시 보내는 재전송 | 가방이 `svc.item.out` 결과를 `outBuffer` 에 보관·`resendOut()` 재발행 |
| At-least-once + 멱등 소비 = effectively-once | 중복 전송을 허용하되 소비자가 멱등이면 결과는 정확히 한 번 | 클라 belief 가 `Set` → 재배달 멱등 → dedup 불요 |
| 파생 상태 vs 진실 원천 | 버스는 라우팅(파생)만·영속 0 → 복구는 진실 원천이 한다 | crash gap 메시지는 producer(가방)만 메울 수 있다 |
| behind vs ahead desync | belief < 원장(결과 손실) vs belief > 원장(요청/give 손실) | 측정상 전부 behind → 결과 재발행만으로 desync 0 |

## 1. 무엇을 — 버스 failover 의 *결과 경로* 무손실

[step-0034](step-0034.md) 는 버스가 죽었다 살아날 때 **소비자 재구독**으로 라우팅 테이블을 재구성했다(버스는 라우팅이라는 *파생 상태*만 들고, 진실 원천은 소비자다 — 그래서 버스 내부 영속이 불필요했다). 하지만 crash 와 재구독 사이의 *gap* 동안 버스로 들어온 메시지는 라우팅이 비어 있어 전부 버려졌다(`unrouted`). 그중 **`svc.item.out` 결과**(가방이 아이템을 mint 한 뒤 클라에 알리는 메시지)가 떨궈지면, 원장엔 아이템이 있는데 클라는 그걸 모른다 → 클라 belief 가 원장보다 *뒤처진다*(itemDesync). 0034 는 이를 "정직한 한계"(at-most-once 손실)로 남겼다.

이 step 은 그 gap 손실을 메운다. 핵심 통찰: **버스는 crash 후 살아 돌아온 새 박스(영속 0)라 gap 의 떨군 메시지를 못 메운다 — 메울 수 있는 건 crash 를 살아남은 producer(가방)뿐이다.** 가방이 발신한 결과를 `outBuffer` 에 보관했다가, 버스가 복구(재구독)되면 보관분을 `svc.item.out` 에 **재발행**한다. 뒤처진 클라가 그 결과를 받아 belief 를 원장으로 끌어올린다 → itemDesync 0.

## 2. 왜 — producer replay 는 0023·0025 의 *버스 판*

이 시리즈는 "신뢰 전달"을 같은 모양으로 반복해 왔다: **at-least-once 전송 + 멱등 소비 = effectively-once**.
- 0023: 가방→persist *저널 홉* — persist 가 갭을 NAK 하면 가방이 `sentBuffer` 에서 재전송.
- 0025: 클라 *give-resend* — 클라가 확인한 give 를 복구 시 재발행.
- **이 step**: 가방→버스 *결과 홉* — 버스 복구 시 가방이 `outBuffer` 에서 재발행.

같은 원리가 *버스(pub/sub)* 경계에 적용된 것이다. 차이는 트리거: 저널 홉은 NAK(수신자가 갭을 감지), 이 step 은 버스 복구 신호(producer 가 복구 시점에 일괄 재발행). 둘 다 producer 가 보관(buffer)을 들고 있다 재전송한다.

## 3. 어떻게 검증했나 — 멱등 소비가 dedup 을 없앤다

재발행은 *이미 받은 결과까지* 다시 보낸다(무계 outBuffer v1). 보통 이런 중복은 소비자에서 dedup 키((publisher,seq))로 걸러야 한다. 그런데 여기선 **클라 belief 가 `Set`** 이다 — `item_result(pickup)` 는 `items.add`, `give` 는 `items.delete`, `item_recv` 는 `items.add`. Set 연산은 멱등이라, 이미 반영된 결과를 다시 받아도 belief 가 안 바뀐다. **gap 에 떨군 결과만** belief 를 원장으로 끌어올린다. 그래서 consumer dedup 없이도 정확하다. 또 재발행은 *읽기 전용 fan-out*(원장을 안 건드림)이라 보존(conserved)·정합(consistent)이 불변이다.

검증: `busfail` 모드가 4런(base·crashOnly·recover·resend)을 비교한다. recover(재구독만)는 desync 6 잔존(대조군 — 결과 gap 손실이 보임), resend(busResend ON)는 desync 0(무손실)·outResends 18. `busResend` OFF 면 보관·재발행이 전부 휴면 → 0035 비트 동일(reg 0).

## 4. 의외의 발견 — desync 의 범인은 결과지 요청이 아니다

0034 §9 와 직관은 "gap 의 *요청*이 떨궈져 원장이 클라보다 뒤처진다"고 봤다. 그러나 측정해 보니 6 desync 전부 *belief < 원장*(클라가 뒤처짐)이었다 — 즉 원장엔 아이템이 있는데 클라가 모른다 = *결과* 손실. *요청* 이 떨궈지면 mint 자체가 안 일어나 원장에도 클라에도 없어 양측이 일치한다(desync 0 기여·단 base 보다 적게 mint). 그래서 **결과 경로 재발행만으로 desync 0** 이 달성된다. 요청 경로(base 대비 mint 손실 회복)는 별도 follow-up.

## 한 줄 요약

버스 failover 의 결과 경로를 무손실로 — 가방(producer)이 `svc.item.out` 결과를 보관했다 버스 복구 시 재발행(0023/0025 의 버스 판), 클라 belief 가 `Set` 이라 멱등이라 dedup 없이 desync 6→0. 범인은 요청 드롭이 아니라 결과 드롭이었다.
