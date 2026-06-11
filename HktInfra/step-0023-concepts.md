# step-0023 concepts — Reliable Write-Behind Journal Hop (NAK-based Gap Detection + Resend)

> 정식 기록: [step-0023.md](step-0023.md) · 현재 위치: [STATE.md](STATE.md)

이 step 의 *핵심 개념*("무엇을·왜·어떻게 검증했나")을 푼다. 압축적 정식 기록은 [step-0023.md](step-0023.md).

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| write-behind 윈도 | 효과를 수락한 뒤 저널이 *내구적으로 안착하기까지*의 손실 가능 구간 | 이 step 이 그 윈도의 *전송-손실* 절반을 닫는다 |
| 갭 감지(gap detection) | 연속 seq 의 *빈칸*으로 손실을 *수신측이* 알아내는 것 | PersistStore 가 `[0..maxRecvSeq]` 미수신 seq 색출 |
| NAK(부정 ack) | "이것들 안 왔으니 다시 줘"를 수신측이 송신측에 알리는 신호 | persist → inventory `journal_nak{missing}` |
| at-least-once + 멱등 = effectively-once | 재전송으로 *적어도 한 번* 도달 + 중복은 *멱등 수신*으로 무해 = 결과적 정확히 한 번 | 재전송 + `recvSeqs` dedup → 영속은 effectively-once |
| tail 손실 | 후속 트래픽이 없는 *마지막* 항목의 손실(NAK-only 가 못 잡는 사각) | §9 한계 — heartbeat/timeout 필요 |

## 1. write-behind 윈도 — 무엇이 위험한가

0017 의 가방 영속은 *write-behind* 다: 효과(mint/xfer)를 수락하면 즉시 클라에 응답하고, 저널은 *비동기*로 PersistStore 에 보낸다(fire-and-forget — 신성한 tick 밖). 빠르지만 **윈도**가 생긴다: 효과 수락 ~ 저널의 내구 안착 사이에 무언가 잘못되면 그 효과가 *영속되지 않는다*. 두 종류:
- **전송 손실**: 저널 메시지가 네트워크에서 드롭(이 step 이 닫는 절반).
- **in-flight 손실**: 보내는 도중 가방 프로세스가 죽어 미-ack 항목이 RAM 과 함께 소멸(남은 절반 — §9).

0017~0022 의 복구는 *저널이 온전하다고 가정*했다. 손실이 있으면 저널에 갭이 생기고, 복구(replay)는 *빠진 효과만큼 손실*된 원장을 만든다. 그래서 write-behind 는 *신뢰성*이 따라와야 진짜 내구적이다.

## 2. 갭 감지는 왜 *수신측*이 하는가

핵심 통찰. 손실을 누가 알아채는가? **받는 쪽(persist)** 이다 — seq 0,1,2,4 를 받으면 "3 이 빠졌다"를 *수신측만* 안다(송신측은 3 을 보냈으니 모른다). 그래서:
- PersistStore 가 `recvSeqs`(받은 seq 집합)와 `maxRecvSeq` 를 들고, 매 수신 시 `[0..maxRecvSeq]` 중 빠진 seq 를 색출한다.
- 빠진 게 있으면 송신자(`m.from` = inventory)에게 **NAK**(`journal_nak{missing}`)를 보낸다.
- inventory 는 NAK 를 받으면(`onMsg` — 반응형) `sentBuffer` 에 보관해둔 그 seq 를 **재전송**한다.

이 구조의 미덕: **양쪽 다 반응형**(persist 도 inventory 도 `onTick` 0)이라 *송신측 타이머가 필요 없다* → 신성한 tick 을 안 깬다. 이는 0008(핸드오프의 keyframe/NAK 복원)과 *같은 원리*다 — 손실은 받는 쪽이 알고, NAK 로 되돌린다. 이 step 은 그 패턴을 *저널 홉*에 입혔다.

## 3. at-least-once + 멱등 = effectively-once

신뢰 전달의 등식. 재전송은 *중복*을 만들 수 있다(원본이 늦게 도착 + 재전송이 도착 → seq 5 가 두 번). 그래서 재전송만으로는 "정확히 한 번"이 아니다. 멱등 수신이 짝을 이뤄야 한다:
- **at-least-once**: 손실되면 NAK→재전송으로 *적어도 한 번*은 도달(NAK 자체가 손실돼도 매 수신 재-NAK 로 결국 수렴).
- **멱등 수신**: `recvSeqs.has(seq)` 면 dedup — 두 번째 도착은 push 하지 않는다.
- 합 = **effectively-once 영속**: 전송은 거칠어도(손실·중복) 저널은 *정확히 한 벌*.

멱등의 키는 `seq`(0017 의 단조 순번)다. 0017 이 "저널에 빈칸·중복이 있어도 itemId 재사용·seq 중복이 구조적으로 불가"하게 설계해둔 것이 — 이 step 의 신뢰 전달이 올라설 *토대*였다. 과거 설계가 미래 기능을 떠받친 사례.

## 4. tail 손실 — NAK-only 의 본질적 사각

갭 감지는 *후속 seq 가 도착해야* 작동한다(빠진 3 은 4 가 와야 보인다). 그런데 *마지막(최고 seq) 항목*이 손실되면 그 뒤에 올 게 없어 영영 미감지 → 영구 손실. 이것이 NAK-only 프로토콜의 본질적 한계다(송신측 timeout/heartbeat 가 있어야 메운다). 이 step 의 5 고정 시드는 손실율 0.3 에서 우연히(=결정론적으로) tail 이 생존해 검증이 통과하지만, 일반 해소는 *다중 메커니즘*(heartbeat·ack-timeout·스냅샷 fence)이라 STATE §2 ⒜ 의 나머지로 남긴다. 정직한 사각.

## 검증으로 무엇을 보였나

- **무손실**: 저널 홉 loss 0.3·redundancy 1 아래, 신뢰 ON 이면 persist 저널 완전(writes == 무손실 기준)·복구 원장 == 무손실 기준(invDigest 동일·전 시드). NAK 166~187·재전송 223~239.
- **대조**: 신뢰 OFF 면 같은 손실이 저널 16~18개 갭(영구 손실) → 복구 원장 손실(invDigest 다름).
- **비-침습**: journalReliable OFF → 0022 비트 동일(reg 25/25). 무손실이면 신뢰 ON 도 0022 동일(persist+rel+rst — 휴면).
- **E2E**: 멀티프로세스(chat-restart 14) = 인프로세스 비트 동일(신뢰 휴면).

## 한 줄 요약

**write-behind 저널 홉이 *전송-신뢰화*된다 — persist 가 seq 갭을 감지해 NAK, inventory 가 sentBuffer 에서 재전송, recvSeqs 가 멱등 수신.** 핵심: 갭 감지는 *수신측*의 일이라 양쪽 반응형(신성한 tick 보존)이고, at-least-once 전송 + 멱등 수신 = effectively-once 영속. write-behind 신뢰성의 *전송-손실 절반*을 닫는다(in-flight·tail 손실은 후속).
