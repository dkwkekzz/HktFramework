# step-0037 concepts — Producer replay on the *request* path: idempotent re-send with reqId dedup

> 정식 기록: [step-0037.md](step-0037.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| 요청 경로 producer replay | 요청 *발신자*(게이트웨이)가 보낸 것을 보관했다 버스 복구 시 다시 보냄 | 게이트웨이가 `svc.item` 요청을 `inBuffer` 에 보관·`resendIn()` 재발행 |
| 멱등 불가 연산(non-idempotent) | 같은 입력을 두 번 처리하면 결과가 달라지는 연산 | `pickup` 은 매번 새 `itemId` mint → 재발행 중복 = 이중 mint |
| reqId dedup | producer-local 단조 id 로 소비자가 *최초 1회만* 처리 | 가방 `seenReqs` — 0023 persist `recvSeqs` 의 요청 홉 판 |
| behind 아닌 손실 = mint 누락 | 요청 드롭은 양측이 모르므로 desync 0·원장만 작아짐 | 헤드라인 지표가 `itemDesync` 아닌 `minted` |

## 1. 무엇을 — 버스 failover 의 *요청 경로* 무손실 (0036 의 거울)

[step-0036](step-0036.md) 은 버스 crash gap 에 떨군 **결과**(`svc.item.out`)를 가방이 보관·재발행해 무손실화했다. 그런데 gap 은 결과만이 아니라 **요청**(`svc.item` — 클라의 pickup/give 인텐트)도 떨군다. 요청이 떨궈지면 그 인텐트는 **가방에 도달조차 못 해 mint 자체가 안 일어난다** → 원장이 base(crash 없는 경우)보다 작다.

이 step 은 그 거울을 메운다. 요청의 진실 원천은 그것을 발행한 **게이트웨이**다 — 0036 에서 결과의 진실 원천이 가방이었던 것과 같은 자리. 게이트웨이가 발행 요청을 `inBuffer` 에 보관했다가, 버스 복구(재구독) 직후 보관분을 `svc.item` 에 **재발행**한다. gap 에 떨군 요청이 그제야 가방에 도달해 mint/xfer → 원장이 base 를 따라잡는다.

## 2. 왜 어렵나 — 요청은 멱등이 아니다 (0036 과의 결정적 차이)

0036 결과 재발행은 *공짜로 멱등*이었다: 클라 belief 가 `Set` 이라 이미 받은 결과를 다시 받아도 무해했다(consumer dedup 불요). **요청 경로는 그렇지 않다.** `pickup` 은 처리될 때마다 *새 `itemId`* 를 mint 한다 — 같은 pickup 요청을 두 번 처리하면 아이템이 둘 생긴다(이중 mint·dupe).

게이트웨이는 버스가 언제 죽었는지 모른다(은닉). 그래서 *gap 에 떨군 것만* 골라 재발행할 수 없고, **보관한 전부**를 재발행한다 — 여기엔 gap *전* 이미 가방에 도달·mint 된 요청도 섞인다. 그대로 두면 그 요청들이 이중 mint 된다.

해법은 이 시리즈가 반복해 온 신뢰 전달 패턴의 **소비자 측 절반**이다: 요청마다 producer-local 단조 **`reqId`** 를 실어 보내고, 가방이 `seenReqs` 집합으로 *최초 1회만* 처리한다(이미 본 reqId → 폐기). 이는 0023 의 persist `recvSeqs`(저널 홉 멱등 수신)를 *요청 홉* 에 적용한 것이다. 결과적으로 **at-least-once 전송(게이트웨이 재발행) + 멱등 소비(reqId dedup) = effectively-once**.

## 3. 어떻게 검증했나 — `minted == base` 한 수가 두 가지를 동시에 증명

요청 드롭의 손실은 0036 이 밝혔듯 `itemDesync` 로 *안 보인다*: 요청이 안 닿으면 mint 가 안 되고, 그러면 원장에도 없고 클라도 모른다 → 양측 일치(desync 0). 손실은 오직 **원장 mint 수가 base 보다 적음**으로만 드러난다. 그래서 헤드라인 지표는 `minted`.

`busreq` 모드가 3런(base·recover·resendReq)을 비교한다:
- recover(재구독만): `minted` 가 base 보다 18 작다(요청 gap 손실·대조군).
- resendReq(busResendReq ON): `minted == base`(손실 18 전량 복구).

여기서 **`== base` 의 *정확함*이 핵심**이다. 게이트웨이는 gap 전 도달분도 재발행하므로, dedup 이 없으면 `minted` 가 base 를 *초과*해야 한다(이중 mint). `minted` 가 base 와 정확히 같다는 것은 ⒜ 손실이 0 이고 ⒝ 이중 mint 도 0(dedup 작동)임을 *한 수로* 증명한다. 더해 itemConserved(size==minted)·ledgerConsistent(byOwner≡ledger)로 재발행이 원장을 오염시키지 않음을 확인한다. `busResendReq` OFF 면 태깅·보관·dedup 이 전부 휴면 → 0036 비트 동일(reg 0).

## 4. 정직한 한계 — give 는 pickup 만큼 깔끔하지 않다

pickup(순수 생성)은 재발행으로 정확히 복구된다. 그러나 *give* 요청은 더 얽힌다: gap 에 떨군 give 의 *결과*를 못 받은 클라는 같은 아이템을 *다시* give 할 수 있다(belief 가 아직 자기 소유로 남아 있어서). 그러면 재발행된 원 give 가 도착할 즈음 owner 가 이미 바뀌어 실패한다(`failedOps`). 결과는 base 와 *다른* transfer 집합으로 수렴하지만(transfers≠base) 원장은 자기-정합하고 클라는 desync 0 로 수렴한다 — *손실*이 아니라 *다른 유효 결과*다. 완전한 give 복구는 0025 give-resend(클라 측)와의 결합 영역이며 이 요청-경로 조각과 직교한다.

## 한 줄 요약

버스 failover 의 요청 경로를 무손실로 — 게이트웨이(producer)가 `svc.item` 요청을 보관했다 버스 복구 시 재발행(0036 결과 replay 의 요청 판). 단 pickup 은 멱등이 아니라 `reqId` dedup 이 필수이고, `minted == base` 한 수가 손실 0 과 이중 mint 0 을 동시에 증명한다.
