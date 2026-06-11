# step-0025 concepts — In-Flight Give Loss & Client Resend (live ack ≠ durability)

> 정식 기록: [step-0025.md](step-0025.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| In-flight loss | 라이브로 처리됐으나 아직 *내구화 전*인 효과가 crash 로 소실 | 가방 활성 중 죽음 → 미-ack sentBuffer 소멸 |
| 라이브 ack ≠ 내구성 | 클라가 받은 결과(item_result)는 *처리됨*을 뜻하지 *영속됨*을 뜻하지 않는다 | 복구 원장이 belief 보다 뒤처지는 원인 |
| Belief = 의도된 진실 | 클라 belief 는 의도된 최종 상태 — 원장이 그걸 *따라가야* 한다 | 재발행으로 원장을 belief 로 끌어올림 |
| Client resend | 클라가 확인한 op 를 복구 후 재발행해 손실분을 재적용 | give 한정(resendGives) |
| 멱등 재적용 | 이미 적용된 op 는 재발행돼도 무효(이중 적용 0) | 가방 `owner==from` 체크(0014 기존) |
| id 재할당 문제 | 서버가 id 를 부여하면 재발행이 *새 id* 를 낳아 belief 와 어긋남 | pickup mint 손실이 §9 인 이유 |

## 1. 무엇을·왜·어떻게

### 문제 — 라이브 ack 는 내구성을 보장하지 않는다

write-behind 는 빠르다: 가방이 효과를 RAM 원장에 적용하고 *즉시* 클라에 결과(item_result)를 보낸 뒤, 저널은 *나중에* persist 로 비동기 흘린다. 클라가 결과를 받으면 belief 를 갱신한다 — "나는 이 아이템을 줬다(없다)/받았다(있다)."

그런데 저널이 persist 에 닿기 *전에* 가방이 죽으면? 그 in-flight 저널(미-ack `sentBuffer`)은 RAM 과 함께 사라진다. 복구는 persist 의 *불완전한* 저널을 replay 하므로, **이미 클라가 믿는 전송이 복구 원장엔 없다.** 클라 belief 는 앞서 있고 원장은 뒤처진다 → itemDesync. 이것이 0024 §9 가 남긴 in-flight 손실이다.

핵심: **라이브 ack 는 "처리됐다"는 뜻이지 "영속됐다"는 뜻이 아니다.** 0023~0024 는 *전송 손실*(저널이 가다가 사라짐)을 닫았지만, in-flight 손실은 *crash 가 발신 버퍼를 비우는* 것이라 재전송할 원본조차 없다.

### 해법 — 클라가 진실을 다시 말한다 (give resend)

여기서 발상의 전환: **클라 belief 가 *의도된 진실*이고 원장이 뒤처진 것**이다. 그렇다면 원장을 belief 로 끌어올리면 된다 — 클라가 자기가 한 전송을 *다시 말하면(재발행)* 된다.

give 는 이 재수렴이 깔끔하다. give 는 *기존* itemId 를 옮길 뿐 새 id 를 만들지 않는다. 복구 원장은 전송이 빠져 아이템이 아직 *sender* 소유다. 클라(sender)가 같은 give 를 재발행하면 가방은 `owner==from(sender)` 를 만족해 전송을 *재적용* → 원장이 belief 를 따라잡는다. itemId 보존이라 belief 도 안 흔들린다.

**멱등성은 공짜다.** 가방의 give 는 *이미*(0014) `owner==from` 을 요구한다 — 이미 durable 한 전송은 복구 원장에서 아이템이 *receiver* 소유라 `owner≠from` → 거부(이중 전송 0). 그래서 가방·persist 를 *한 줄도 안 고치고* 클라 측 한 조각(보관 + 재발행)만으로 닫힌다.

### 왜 give 만 — id 재할당의 벽

pickup(mint)은 다르다. 서버가 itemId 를 *부여*한다(mintTotal++). 재발행 pickup 은 *새 id*(itemM)를 만든다 — 클라가 믿는 옛 id(itemN)는 복구 원장에 영영 없다. 새 id 를 채택하려면 belief 를 재구성(id-reconciliation)해야 하는데, 그건 더 큰 조각이라 §9 로 연기했다(사용자 승인 범위). 이 step 은 손실을 *xfer 저널만*(mint 는 durable·id 보존)으로 격리해 give 의 깔끔한 재수렴만 증명한다.

### 은닉이 설계를 제약한 자리

재발행엔 `toAvatar`(수신자)가 필요하다. 그런데 게이트웨이는 item_result 를 클라에 중계할 때 toAvatar 를 *은닉*한다(척추 ④ — 클라는 서비스 내부를 모른다). 그래서 클라는 toAvatar 를 *발신 시점*(`_itemAction`, 자기가 peer 를 골랐을 때)에 잡아 pending 큐에 둬야 했다. 결과로 확인되면 giveLog 로 옮긴다. 은닉 불변이 복구 설계를 *제약*한 구체 사례다.

### 어떻게 검증했나

xfer 저널에 손실 주입(`XGIVELOSS` — 전송 저널만 드롭·mint durable):
- **resend OFF**: 복구 원장이 belief 보다 뒤처짐 — itemDesync 3~6·전송 0개 반영.
- **resend ON**: 클라 재발행 3~9회 → itemDesync **0**·복구 원장 == 무손실 truth(invDigest 비트 동일)·전송 전부 재적용·dupe 0(own≤1)·conserved·consistent.
- 회귀 0: clientResend OFF → step-0024 비트 동일(25/25). spine 25-step 사슬 통과.

## 한 줄 요약

라이브 ack 는 내구성이 아니다 — in-flight 손실은 복구 원장을 클라 belief 뒤에 남긴다. belief 가 의도된 진실이므로, 클라가 확인한 give 를 같은 itemId 로 재발행하면 원장이 belief 를 따라잡는다(멱등은 0014 `owner==from` 가 공짜로 제공). 서버 할당 id 인 mint 손실만 id-reconciliation 으로 §9.
