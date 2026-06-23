# ⑥ 데이터 — 세계가 세션보다 오래 살게

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 동기 디스크 기록이 *어떤* 서버 tick 에도 끼면 안 된다. write-behind 큐로 비동기 영속하되, 죽어도 replay 로 복구한다 — 그래서 세계가 한 세션보다 오래 산다.

---

## 캐시 서버 ⬜ 미착수

**무슨 서버인가**: 핫 데이터(세션·가방·시세)를 앞단에 둬 DB 직행을 막는 휘발 캐시 서버. *비유 — 자주 보는 책을 책상에 두고(캐시) 원본은 서고(DB)에.*

**필요한 기능들**:

1. **읽기 캐시(look-aside)** ⬜ — 왜: 매 조회가 DB 직행하면 느림. / 어떻게: 앞단 휘발 캐시(Redis 등가). / 했나: 미착수(`src/` 캐시 박스 없음).
2. **무효화 규칙** ⬜ — 왜: 캐시는 복사본이라 stale 위험. / 어떻게: 무효화/TTL. / 했나: 미착수.

**지금 어디 / 다음**: 미착수. 다음 씨앗 = 휘발 캐시 계약 + 무효화 규칙.

## 게임/계정 DB · write-behind 서버 🟡 자라는 중

**무슨 서버인가**: 영속 진실을 비동기로 기록·복구하는 저장 서버(`src/persist.js`). tick 동기 디스크 I/O 0 이 목표. *비유 — 받아쓰기 비서*: 말한 즉시 디스크에 안 새기고 메모(저널)에 적어뒀다 한꺼번에 기록하며, 사본을 여러 비서가 들고 과반이 받아야 "기록됨".

**필요한 기능들** (기능마다 다른 이론에 기댄다):

1. **write-behind + 죽어도 복구** ✅ — 왜: 동기 디스크 기록이 tick 에 끼면 시뮬 막힘. / 어떻게: 쓰기 지연 큐 + event sourcing(효과 저널 replay). / 했나: `step-0017` PersistStore 첫 박스(kill→replay) → `step-0020` 읽기모델 복구원(CQRS late-join).
2. **저널 압축** ✅ — 왜: 무계 저널은 메모리 누설. / 어떻게: 주기 스냅샷 + tail replay. / 했나: `step-0018`.
3. **홉 신뢰 전달** ✅ — 왜: 저널을 나르는 홉에서 흘리면 복구 깨짐. / 어떻게: NAK·tail 손실 감지·in-flight give/mint 복구. / 했나: `step-0023~0026`(itemDesync 0·dupe 0).
4. **복제·정족수(quorum)** ✅ — 왜: 단일 저장본은 죽으면 끝. / 어떻게: N-replica + quorum read/write ack(과반 합의해야 진짜 기록). / 했나: `step-0027` 이중쓰기 → `step-0028` quorum-read → `step-0029` quorum write ack(durableSeq).
5. **정합 윈도 유계화** ✅ — 왜: quorum 미달 seq 가 떠다니면 정합 흔들림. / 어떻게: quorum-fill(W 미달 seq 재-fan-out) + 유계 K·fill retry. / 했나: `step-0031~0032`.
6. **증분 스냅샷·fsync·월드/버스 자체 영속** ⬜ — 왜: 아직 fsync 0·월드/버스 영속 0. / 어떻게: 증분 스냅샷·fsync·anti-entropy. / 했나: 미착수(STATE §3 🟡).

**지금 어디 / 다음**: write-behind → 압축 → 홉 신뢰 → 복제·정족수 → 정합 윈도 유계화까지. 다음 = 영속 대상을 월드/버스로 확장.

> **참고 — 게임 서비스 *자기 박스* 영속(별 PersistStore 미경유)**: 같은 event-sourcing 레시피(휘발 projection ⟂ durable op 저널·crash→seq replay·스냅샷+tail 압축)가 박스 안에 직접 산다 — 멤버십(`svc-party.js`·0085/0086)·거래소(`svc-exchange-core.js`·0109→0110). 가방(0017/0018)·파티·거래소가 *같은 두 step 짝*으로 닫혀 event sourcing 의 보편성을 보인다. 잔여: 이 자기-저널들을 별 PersistStore 박스(N-replica quorum)로 통합(#30).

---

> **이 계층 다음 걸음**: 캐시 박스 씨앗 + 영속 대상을 가방 너머 *월드·버스·거래소*로(자기-저널 → 별 PersistStore 통합·#30).
