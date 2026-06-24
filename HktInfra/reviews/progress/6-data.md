# ⑥ 데이터 — 세계가 세션보다 오래 살게

> 인덱스: [README.md](README.md) · 구조 권위: [../../SPINE.md](../../SPINE.md) §2 · 마커: [../../STATE.md](../../STATE.md) §5
>
> **계층 한 줄**: 동기 디스크 기록이 *어떤* 서버 tick 에도 끼면 안 된다. write-behind 큐로 비동기 영속하되, 죽어도 replay 로 복구한다 — 그래서 세계가 한 세션보다 오래 산다.

---

## 캐시 서버 🟡 자라는 중

**무슨 서버인가**: 핫 데이터(세션·가방·시세)를 앞단에 둬 DB 직행을 막는 휘발 캐시 서버(`src/cache.js`). *비유 — 자주 보는 책을 책상에 두고(캐시) 원본은 서고(DB)에.*

**필요한 기능들**:

1. **읽기 캐시(set/get + read-through)** ✅ 기본 — 왜: 매 조회가 DB 직행하면 느림. / 어떻게: 앞단 휘발 캐시(Redis 등가)·hit 즉답·miss 시 소스서 읽어 채움(read-through). / 했나: `step-0205` `CacheStore` 새 박스·cacheSet→store(덮어씀) + `step-0206` cacheGet hit/miss·miss→소스(backing) 채운 뒤 답(첫 miss 만 1홉·이후 hit). DB 직행 흡수.
2. **stale 차단(TTL 만료 + 무효화)** ✅ — 왜: 캐시는 복사본이라 stale 위험·메모리 무계. / 어떻게: ⒜ 시간 기반 TTL 스윕(setAt+ttl≤now 회수·Redis TTL 등가) ⒝ 소스 기반 명시 무효화(write 시 사본 끊고 read-through 재적재). / 했나: `step-0211` cacheExpire(setAt 기록→TTL 회수·메모리 유계) + `step-0212` cacheInvalidate(소스 변경→사본 끊기→다음 get miss→fresh 재적재·write 일관성). 미주입이면 휴면(reg 0).
3. **개수 유계(LRU eviction)** ✅ — 왜: TTL(시간)만으론 키 수가 무한히 늘 수 있음 → 메모리 폭발. / 어떻게: 키 수 상한 + 가장 오래 안 쓴 키 회수(recency=set/get 둘 다 반영하는 진짜 LRU·Redis maxmemory allkeys-lru 등가). / 했나: `step-0225` cacheCapacity(size>cap 면 setAt 최소 키 회수·개수 유계) + `step-0226` cacheLruTouch(get hit 시 recency 갱신→핫 키 생존·set-시각만이던 0225 를 진짜 LRU 로). 미주입이면 capacity=∞(reg 0).
4. **write-behind·소스 PersistStore 연결** ⬜ — 왜: 캐시 쓰기를 DB 로 비동기 반영·소스를 실 영속 박스로. / 어떻게: write-behind 큐·소스를 실 PersistStore 박스로. / 했나: 미착수(현 소스=주입 backing map·2차 잔여).

**지금 어디 / 다음**: set/get + read-through + TTL 만료·무효화(0211~0212·stale 차단) + **용량 LRU 회수·recency touch(0225~0226·개수 유계·진짜 LRU)**까지. 다음(2차) = write-behind·소스를 실 PersistStore 박스로 연결.

## 월드 영속 서버 🟡 자라는 중

**무슨 서버인가**: 월드(존) 상태를 *intent 로그*로 event sourcing 하는 저장 서버(`src/worldlog.js`·데이터 3분할 ①). 서비스 PersistStore(효과 저널)·캐시(휘발)와 직교 — 월드 상태는 DB 행이 아니라 로그로 산다. *비유 — 체스 기보*: 말 위치(상태)를 사진으로 안 남기고 *수순(intent)* 만 적어두면 언제든 같은 판을 재현한다.

**필요한 기능들**:

1. **intent 로그 append** ✅ 기본 — 왜: 세계 상태의 유일 쓰기 경로(intent·SPINE §4 경로1)를 durable 로 남겨야 재현·복구가 선다. / 어떻게: append-only 로그(seq 단조). / 했나: `step-0207` `WorldLog` 새 박스·worldAppend→로그.
2. **replay 재구성(crash 무손실)** ✅ 기본 — 왜: 투영이 죽어도 로그로 복원. / 어떻게: 로그 전수 재적용 reducer(move→위치·pickup→소지)·crash 후 동일 digest. / 했나: `step-0208` replay·crash→로그만으로 동일 상태(결정론 덕·복제=재현).
3. **스냅샷 압축 + crash/recover 정합** ✅ — 왜: 무계 로그는 메모리 누설·복구는 메시지 구동이라야 슈퍼바이저가 명령. / 어떻게: ⒜ 투영을 스냅샷으로 굳히고 로그를 tail(seq>snapshotSeq)로 절단·replay=스냅샷+tail==전체-로그 replay(무손실) ⒝ crash/recover 를 op 로(슈퍼바이저 명령). / 했나: `step-0213` worldSnapshot(스냅샷+tail·무손실 압축·저장 유계·가방0018/우편0146/길드0185 의 월드 판) + `step-0214` worldCrash/worldRecover(메시지 구동·crash 후 동일 digest 복원·스냅샷 load-bearing=tail 단독 불충분 증명·스냅샷 arc 0207~0214 닫기). 미주입이면 휴면(reg 0).
4. **write-behind 버퍼 + fsync durable barrier** ✅ — 왜: 매 intent 마다 디스크 쓰면 신성한 tick 이 막히고, "로그에 적혔다"와 "디스크에 *확정*됐다"는 다르다(crash 윈도). / 어떻게: ⒜ intent 를 버퍼에 모았다 flush 로 일괄 적층(쓰기 지연·배치·미flush=비-durable) ⒝ durableSeq 워터마크=fsync 로 물리 확정된 최대 seq·recoverDurable 은 seq≤durableSeq 만 복구(fsync 이후 tail 미보장). / 했나: `step-0227` worldBuffer/worldFlush(버퍼링→일괄 durable 적층) + `step-0228` worldFsync/worldRecoverDurable(durableSeq 경계·flush[페이지캐시]/fsync[물리 확정] 구분). 미주입이면 휴면(reg 0). *한계: fsync 는 인프로세스 모델(실 디스크 sync 아님)·C++ 호스트서 실 fsync 로 교체.*
5. **실 존 연동·다중 클라 결정론** ⬜ — 왜: 지금은 검증 주입 intent 만 로그에 적층·실제 존 상태 미연결·#1 결정론 복제. / 어떻게: 존↔worldlog 배선(존 tick 의 intent 를 worldlog 로)·다중 클라 인터리빙. / 했나: 미착수(2차 잔여·#1 결정론 복제와 합류).

**지금 어디 / 다음**: intent 로그 append+replay + 스냅샷 압축·crash/recover 정합(0213~0214) + **write-behind 버퍼·fsync durable barrier(0227~0228·durability 계층 분화)**까지. 다음(2차) = 실 존 상태 연동(현 intent=검증 주입·#1 결정론 복제와 합류).

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
