# step-0017 개념 해설 — 영속(event sourcing)과 "세계가 세션보다 오래 산다"

> `step-0017.md` 가 *무엇을 했나*(압축 기록)라면, 이 문서는 *그 개념이 무엇이고 왜 중요한가*를 푼다.
> 본문 한국어, 닫은 step 의 개념 문서는 이후 수정하지 않는다([CLAUDE.md](CLAUDE.md) 산출물 규약).
> 상호 링크: [step-0017.md](step-0017.md) · [STATE.md](STATE.md) · 직전 개념 [step-0016-concepts.md](step-0016-concepts.md)(이벤트 버스).

## 개념 한눈표

| 개념 | 한 줄 정의 | 이 step 에서의 위치 |
|---|---|---|
| **영속(persistence)** | 상태가 프로세스 수명과 *독립*으로 보관됨 | PersistStore 박스 — 가방 죽어도 저널은 산다 |
| **데이터 계층(layer 6)** | 캐시·DB·write-behind — "세계가 세션보다 오래 산다" | SPINE 6계층의 마지막 미진입 박스의 첫 실체화 |
| **event sourcing** | 현재 상태가 아닌 *효과 로그*를 저장하고 replay 로 재현 | 저널 `[{seq,kind:'mint'|'xfer'…}]` — §4 "복제=재현" |
| **write-behind** | 변이를 비동기로 기록·ack 를 안 기다림 | 가방이 fire-and-forget 으로 저널 send |
| **crash + replay** | 프로세스 사망 후 로그 재생으로 상태 재구성 | invRestart — 인프로세스 crash()+replay, 멀티 진짜 kill→replay |
| **복구 투명(transparent recovery)** | 재시작 후 상태가 무재시작과 *비트 동일* | recover 가설 — base==recov(영속이 보존의 원인) |
| **write-behind 윈도** | 기록 전 죽으면 손실되는 in-flight 구간 | quiescent restart 로 비워 투명 — 활성 중 손실은 후속 |
| **제어 평면 vs 응용 평면** | 복구 안무 ≠ 월드/서비스 메시지 스트림 | 복구는 net.log 비-기여 → 인프로세스/멀티 비트 동일 |
| **재현 vs 상태 전송** | (저널 replay) vs (스냅샷 통째 복사) | 영속의 기본 = 재현(0013 loadstate 와 대비) |

---

## 1. 왜 영속인가 — 0014~0016 의 서비스는 전부 "세션과 함께 죽었다"

0014 가 가방을, 0015 가 채팅을, 0016 이 버스를 존 밖으로 분리했다 — 신성한 tick 은 지켜졌다. 그런데 그 박스들의 상태(가방 원장·채팅 구독·버스 라우팅)는 전부 *RAM 에만* 살았다. 프로세스가 죽으면 원장이 사라진다. 0013 이 *존*의 죽음을 failover(추종자 승격·재-provisioning)로 다뤘지만, *서비스*의 죽음은 미착수였고 — 더 근본적으로 *"상태가 어디에 영속하는가"* 가 빈칸이었다.

상용 MMO 의 가방은 *계정 DB* 에 산다 — 서버가 죽어도, 패치로 재시작해도, 다음 주에 로그인해도 아이템은 그대로다. 이것이 SPINE 데이터 계층의 약속: **"세계가 세션보다 오래 산다."** 이 step 은 그 첫 조각을 가방 원장에서 친다.

## 2. event sourcing — "상태"가 아니라 "효과의 로그"를 저장한다

영속에는 두 길이 있다:
- **스냅샷(상태 전송)**: 현재 원장 전체를 주기적으로 통째 저장. 복구 = 최신 스냅샷 로드.
- **event sourcing(재현)**: 수락한 *효과*(mint/xfer)를 순서대로 로그에 append. 복구 = 로그 replay.

HktInfra 의 정전 제약(§4)은 **"복제 = 재현, 상태 전송 아님"** 이다 — `(seed+params+intent 로그)` 가 기본이고 스냅샷은 최후 수단. 그래서 이 step 은 event sourcing 을 택했다. PersistStore 의 저널은 가방의 *효과 로그*다:

```
pickup 성공 → {seq:0, kind:'mint', itemId:'item0', owner:'hero3'}
give   성공 → {seq:1, kind:'xfer', itemId:'item0', from:'hero3', to:'hero5'}
```

새 가방은 이 저널을 seq 순서로 replay 해 ledger·byOwner·minted·transfers 를 *재구성*한다. 원장의 현재 모습은 저장된 적이 없다 — 효과의 누적으로 *재현*될 뿐. 이것이 "재현"이 "상태 전송"보다 강한 이유: 저널만 온전하면 어느 시점의 원장이든 결정론적으로 복원된다.

## 3. write-behind — 신성한 tick 밖의 비동기 기록

가방은 변이를 수락하면 저널 메시지를 persist 로 *던지고*(`net.send(inventory→persist)`) 결과(item_result)를 *영속 ack 없이* 즉시 클라에 보낸다. 이것이 write-behind — 디스크/영속 I/O 가 응답 경로를 막지 않는다. 가방의 onMsg 는 *tick 이 아니라 반응*이고, persist 로의 send 는 비동기 메시지라 어떤 tick 도 블록하지 않는다(신성한 tick).

대가는 **write-behind 윈도**: 저널 메시지는 1-tick 비동기라, 가방이 *기록이 도착하기 전에* 죽으면 그 변이는 영속에 없다(클라는 ack 받았는데 저널엔 빈칸). 이 step 은 이 윈도를 *비워서* 투명을 증명한다 — 가방이 모든 op 를 마치고 저널이 다 도착한 *정지(quiescent)* 시점(tick 60)에 재시작. 활성 중 죽음의 bounded loss·재수렴(ack/resend·손실 감지)은 정직한 후속(§9).

## 4. crash + replay — "프로세스 사망"을 두 모드에서 같게 모델링

복구는 두 모드에서 일어나지만 *비트 동일*해야 한다(E2E):
- **인프로세스**(`run`): 같은 가방 객체를 `crash()`(원장·역인덱스·카운터·mintTotal 비움 = RAM 소실 모델) 후 `replay(persist.journal)`. PersistStore 는 *별 객체*라 crash 의 영향을 안 받는다.
- **멀티프로세스**(`runMulti`): broker 가 ⒜ persist(*안 죽음*)에서 저널 읽고 ⒝ 가방 호스트를 진짜 `child.kill('SIGKILL')`(소켓 RST·RAM 진짜 소멸) ⒞ 새 호스트 spawn·init(빈 가방)·`replay` ⒟ 'inventory' 라우팅을 새 호스트로 전환.

이 둘이 비트 동일한 *비결*은 **복구가 제어 평면**이라는 것이다. 복구 안무(crash·kill·spawn·replay)는 월드/서비스 *응용 메시지 스트림*(net.log)에 한 줄도 안 남긴다 — 저널 *쓰기*(inventory→persist)만 응용 메시지다. 그래서 인프로세스의 객체 wipe 와 멀티프로세스의 진짜 child.kill 이 *같은 net.log* 를 낳고, replay 후 같은 원장을 낳는다. 영속/failover 는 "응용이 보는 세계" 밖의 일이다.

**mintTotal 복원** 한 줄이 *미래의* 투명도 지킨다: replay 가 mintTotal 을 mint 항목 수로 되돌리므로, 복구 후 다음 pickup 이 받는 itemId 가 무재시작과 같다(item0,item1,…의 연속성). 복구가 과거뿐 아니라 이후 행동에도 투명하다.

## 5. 복구 투명 — "영속이 보존의 *원인*임"을 대조군으로 증명

가설(`recover`)의 핵은 세 줄 비교다:
- **base** = 영속 ON·무재시작 → 최종 원장.
- **recov** = 영속 ON·가방 kill→replay → 최종 원장. **base 와 비트 동일**(영속 투명).
- **lost** = 영속 OFF·가방 kill(replay 불가) → 원장 *비어버림*(0 vs 51~56).

recov==base 만으로는 "복구가 잘 됐다"까지다. lost 가 *소실*을 보여야 "영속이 *없으면* 죽음이 원장을 지운다 = 영속이 보존의 원인" 이 닫힌다. 이것이 과학적 대조 — 같은 kill, 영속 유무만 다르게 해 인과를 분리한다. 더해 복구 후 클라 belief 가 원장 진실로 재수렴(itemDesync 0)하고, 저널 항목 수가 수락 변이 수(minted+transfers)와 정확히 같다(저널 완전성).

## 6. 0013 재-provisioning 과의 닮음과 차이

존 failover(0013)와 가방 failover(0017)는 거의 일대일이다:

| | 0013 존 | 0017 가방 |
|---|---|---|
| 죽음 | 진짜 child.kill | 진짜 child.kill |
| 새 프로세스 | spawnOne(zone1g) | spawnOne(inventory_r) |
| 상태 회복 | **loadstate**(스냅샷 *상태 전송*) | **replay**(저널 *재현*) |
| 라우팅 | gateway reroute | placement 전환 |

차이는 단 하나 — *상태 전송(loadstate)* 대 *재현(replay)*. 존은 스냅샷을 통째 받아 핫 standby 로 미러를 잇지만, 가방은 *효과 로그를 재생*해 원장을 다시 짓는다. 후자가 §4 "복제=재현"에 더 충실하다 — 진실은 *현재 상태*가 아니라 *그 상태에 이른 효과의 로그*에 있다. 같은 failover 골격(0013) 위에서 *영속의 의미*가 한 칸 더 깊어진 것이다.

## 7. 한 줄 요약

**데이터 계층의 첫 박스(PersistStore)가 가방 원장을 event sourcing 저널로 영속화한다 — 가방을 진짜로 죽여도(RAM 소실) 새 가방이 저널을 replay 해 원장을 죽기 전과 비트 동일하게 재현하고(영속 투명), 영속이 없으면 같은 죽음이 원장을 지운다(영속=보존의 원인). 복구는 제어 평면이라 인프로세스/멀티프로세스가 비트 동일 — "세계가 세션보다 오래 산다"가 수치 명제가 됐다.**
