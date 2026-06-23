# ⑥ 데이터 — 세계가 세션보다 오래 살게

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 동기 디스크 기록이 *어떤* 서버 tick 에도 끼면 안 된다. write-behind 큐로 비동기 영속하되, 죽어도 replay 로 복구한다 — 그래서 세계가 한 세션보다 오래 산다.

---

## 캐시 ⬜ 미착수

- **무슨 서버인가**: 핫 데이터(세션·가방·시세)를 앞단에 둬 DB 직행을 막는 휘발 캐시 서버.
- **이론 기반**: *읽기 캐시(look-aside) + 무효화*. 진실 원천이 아니라 *복사본* — 비유: 자주 보는 책을 책상에 두고(캐시), 원본은 서고(DB)에 둔다.
- **왜 필요했나 → 어떻게 구현했나**: 매 조회가 DB 직행하면 느리다 → 앞단 흡수층이 필요. *아직 미착수* — `src/` 에 전용 캐시 박스 없음. 다음 씨앗 = 휘발 캐시 계약 + 무효화 규칙.
- **지금 어디 / 남은 것**: 미착수.

## 게임/계정 DB · write-behind 🟡 자라는 중

- **무슨 서버인가**: 영속 진실을 비동기로 기록·복구하는 저장 서버(`src/persist.js`). tick 동기 디스크 I/O 0 이 목표.
- **이론 기반**: *write-behind(쓰기 지연 큐)* + *event sourcing(효과 저널 replay)* + *N-replica quorum*(과반 합의해야 진짜 기록). 비유 — 받아쓰기 비서: 말한 즉시 디스크에 안 새기고(write-behind) 메모(저널)에 적어뒀다 한꺼번에 기록하며, 사본을 여러 비서가 들고 *과반이 받아야* "기록됨"으로 친다(quorum).
- **왜 필요했나 → 어떻게 구현했나** (각 마디가 앞 마디의 한계를 푼다):
  - *최초 구조*: 동기 디스크 기록이 tick 에 끼면 시뮬이 막힌다. **비동기 + 죽어도 복구**: `step-0017` PersistStore 첫 박스(효과 저널·write-behind·kill→replay). `step-0018` 스냅샷 압축(무계 저널 유계). `step-0020` 읽기모델 복구원(CQRS late-join).
  - 저널을 나르는 *홉*에서 흘리면 복구가 깨진다 → **홉 신뢰**: `step-0023~0026` NAK·tail 손실 감지·in-flight give/mint 복구(itemDesync 0·dupe 0).
  - 단일 저장본은 죽으면 끝이다 → **복제·정족수**: `step-0027` failover 이중쓰기. `step-0028` N-replica quorum-read(생존 union 복구). `step-0029` quorum write ack(W 정족수 durable·durableSeq).
  - quorum 미달 seq 가 떠다니면 정합이 흔들린다 → **정합 윈도**: `step-0031~0032` quorum-fill(W 미달 seq 재-fan-out)+유계 K·fill retry.
- **지금 어디 / 남은 것**: 효과 저널 write-behind → 복제·정족수 → 정합 윈도 유계화까지. 증분 스냅샷·fsync·anti-entropy·*월드/버스 자체 영속*은 후속(STATE §3 🟡 "캐시 + write-behind 영속").

> **참고 — 게임 서비스 *자기 박스* 영속(별 PersistStore 미경유)**: 같은 event-sourcing 골격(휘발 projection ⟂ durable op 저널·crash→seq replay·스냅샷+tail 압축)이 PersistStore 밖에서도 박스 안에 직접 산다 — 멤버십(`svc-party.js`·0085/0086)·**거래소**(`svc-exchange-core.js`·0109 op 저널 replay → 0110 스냅샷 압축). 가방(0017/0018)·파티·거래소가 *완전히 같은 두 step 짝*으로 닫혀, event sourcing 이 박스 종류와 무관한 보편 레시피임을 보인다. 잔여: 이 자기-저널들을 별 PersistStore 박스(N-replica quorum)로 통합(#30).

---

> **이 계층 다음 걸음**: 캐시 박스 씨앗을 심어 "조회가 DB 직행 안 함"을 세우고, 영속 대상을 가방 너머 *월드·버스·거래소*로 넓혀(자기-저널 → 별 PersistStore 통합·#30) 전 계층이 죽어도 되살아나게.
