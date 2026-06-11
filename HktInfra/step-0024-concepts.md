# step-0024 concepts — Tail-Loss Detection via Heartbeat (closing the NAK-only blind spot)

> 정식 기록: [step-0024.md](step-0024.md) · 현재 위치: [STATE.md](STATE.md)

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|------|-----------|---------------------|
| Tail loss | 시퀀스의 *끝* 항목이 손실되는 것 — 뒤에 더 올 것이 없어 "빈칸"으로 안 보인다 | 가방 저널 홉의 마지막 seq 들이 손실 |
| NAK-only 의 사각 | NAK 은 *받은 최고 seq 아래*의 갭만 본다 → tail 은 구조적으로 미감지 | 0023 §9 가 명시한 한계 |
| Heartbeat | 발신자가 주기적으로 *내가 어디까지 보냈나*(high-water mark)를 통보 | `journal_hb{maxSentSeq}` (가방→persist) |
| High-water mark | 발신자가 보낸 최대 seq — 수신자가 "여기까지 와야 한다"의 기준 | `maxSentSeq = journalSeq-1` |
| 감지 vs 배달 | tail 문제는 *배달 실패*가 아니라 *감지 실패* — 알면 기존 재전송이 메운다 | 재전송 배달은 신뢰 모델로 격리 |

## 1. 무엇을·왜·어떻게

### 문제 — NAK 은 *끝*을 못 본다

0023 은 저널 홉을 신뢰화했다: persist 가 `[0..maxRecvSeq]` 에서 미수신 seq 를 색출해 NAK 하면 가방이 재전송한다. 이 방식은 **"빈칸"을 보는 능력**에 의존한다 — seq 5 를 받고 seq 7 을 받으면 6 이 빈칸으로 *보인다*.

그런데 *마지막* seq 들이 손실되면? 가방이 seq 0..47 을 보냈는데 45,46,47 이 손실되면, persist 의 `maxRecvSeq` 는 44 에서 멈춘다. `[0..44]` 엔 빈칸이 없다 — 45,46,47 은 "받을 차례가 아직 안 온" 것과 구분되지 않는다. 활동이 멈춰(quiescent) 그 뒤를 잇는 저널이 없으면 갭 스캔이 다시 돌지도 않는다. persist 저널은 **영영 불완전** → 크래시 복구 시 마지막 변이들이 사라진다.

이것이 0023 §9 가 정직하게 남긴 사각이다: **NAK-only 는 받은 최고 seq *위*를 못 본다.** tail 손실은 그 위에서 일어난다.

### 해법 — 발신자가 "어디까지 보냈는지" 말한다 (heartbeat)

수신자가 모르는 정보(끝이 어딘가)는 **발신자만 안다.** 그래서 가방이 주기적으로 *내가 보낸 최대 seq*(`maxSentSeq = journalSeq-1`)를 persist 에 통보한다 — 이것이 **heartbeat**(`journal_hb`). persist 는 갭 스캔 상한을 `max(maxRecvSeq, maxSentSeq)` 로 올린다. 이제 45,46,47 이 `[0..47]` 안에서 빈칸으로 *보인다* → NAK → 재전송 → 저널 완전.

핵심 통찰: **tail 문제는 *배달*이 아니라 *감지* 문제다.** persist 가 "뭐가 빠졌는지" *알기만* 하면 0023 의 재전송 기계가 그대로 메운다. 그래서 이 step 은 새 배달 경로를 안 만든다 — **high-water mark 통보**라는 *감지* 한 조각만 더한다. (검증에서 재전송 배달을 신뢰 모델로 둔 것도 *감지*만 격리하기 위함이다.)

### 왜 reactive 인가 — 신성한 tick 보존

heartbeat 는 본질적으로 *주기적*이라 시간 축이 필요하다. 하지만 이를 *존 시뮬 tick* 에 넣으면 신성한 tick 을 깬다. 그래서 heartbeat 는 **가방 자신의 제어 평면 `onTick`** 에 산다 — 존 tick 이 아니라 *서비스 레벨* 주기다. `journalHeartbeat` OFF 면 onTick 이 호출돼도 no-op(메시지 0) → 0023 비트 동일(회귀 0). 이 분리가 "tick 동기 작업"(존 시뮬)과 "tick 무관 주기 작업"(서비스 heartbeat)의 경계를 명확히 한다.

### 어떻게 검증했나

저널 홉에 **tail 손실**을 결정론적으로 주입(`JTAIL`: tick≥16 의 *최초 전송* 100% 드롭, 재전송/NAK/heartbeat 는 신뢰 배달):
- **heartbeat ON**: maxSentSeq 통보 → persist 가 tail NAK(21~24회) → 재전송 → 저널 완전(writes==무손실 기준) → 복구 무손실(invDigest 동일).
- **heartbeat OFF**(NAK-only): tail NAK **0**(구조적 미감지) → 저널 갭 21~24개 → 복구 손실. 이 0 이 §9 사각의 직접 증명이다.
- 회귀 0: OFF 면 step-0023 비트 동일(25/25). 복구 후 desync 0·소유≤1. spine 24-step 사슬 통과.

## 한 줄 요약

수신자는 *받은 것의 빈칸*만 보지만 *끝*은 발신자만 안다 — heartbeat 로 high-water mark 를 통보하면 NAK-only 의 tail 사각이 닫힌다. tail 손실은 배달이 아니라 *감지* 문제이므로, 통보 한 조각이 0023 재전송 기계를 그대로 살려 저널을 완전하게 만든다.
