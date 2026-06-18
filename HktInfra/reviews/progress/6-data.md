# ⑥ 데이터 — 세계가 세션보다 오래 살게

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 동기 디스크 기록이 *어떤* 서버 tick 에도 끼면 안 된다. write-behind 큐로 비동기 영속하되, 죽어도 replay 로 복구한다 — 그래서 세계가 한 세션보다 오래 산다.

---

## 캐시 ⬜ 미착수

- **푸는 병목**: 매 조회가 DB 직행하면 느리다 — 핫 데이터(세션·가방·시세)를 앞단에 둬 DB 부하를 흡수.
- **지금 어디**: 미착수(`src/` 에 전용 캐시 박스 없음).
- **다음 씨앗**: 휘발 캐시(Redis 등가) 계약 + 무효화 규칙.

## 게임/계정 DB · write-behind ✅ 자라는 중

- **푸는 병목**: 동기 I/O 를 tick 밖으로 + 죽어도 안 잃기(replay) + 여러 복제본이 *합의*해야 진짜 기록(quorum).
- **지금 어디**: 효과 저널 write-behind → 복제·정족수 → 정합 윈도 유계화까지.
  - `step-0017` — PersistStore 첫 박스: 효과 저널·write-behind·kill→replay.
  - `step-0018` — 스냅샷 압축.
  - `step-0020` — 읽기모델 복구원(CQRS late-join).
  - `step-0023~0026` — 홉 신뢰(NAK·tail·in-flight give/mint).
  - `step-0027` — failover(이중쓰기).
  - `step-0028` — N-replica quorum-read.
  - `step-0029` — quorum write ack(`durableSeq`).
  - `step-0031~0032` — 정합 윈도 해소 + 유계 K·fill retry.
- **남은 것**: 증분 스냅샷·fsync·anti-entropy·월드/버스 자체 영속.

---

> **이 계층 다음 걸음**: 캐시 박스 씨앗을 심어 "조회가 DB 직행 안 함"을 세우고, 영속 대상을 가방 너머 *월드·버스*로 넓혀 전 계층이 죽어도 되살아나게.
