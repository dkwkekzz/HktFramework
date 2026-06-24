# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~6은 step 닫을 때 **덮어쓴다**(누적 금지)·§7 INDEX만 **literal 1줄** append. 발견/한계 전문은 `step-NNNN.md`. 누적 함정 금지: §5 step별 재나열 금지(현재 마커+핵심 step)·§3 ✅격차 한 줄로·§4 반복 참조 불변만. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0232](step-0232.md) — **instancereap 모드 spine 승급(#16)**: 0222 bespoke 검증 모드(인스턴스 수요 자동 despawn)를 `engine/verify-kit.js` 누적 키트로 승급. 박스 `.js` 0줄 → reg 0 자명. **정리·도구 라운드 2/10**.
- **한 줄 상태**: reg ALL OK·instancereap: 5/5 active 1·reaped 3·점유 보호·spine ALL OK(instanceleave+instancereap 누적 편입).
- **다음**: 🔧 **#16 spine 승급 라운드 진행 중**(0231~0240 — 3차 라운드 0221~0230 bespoke 10모드를 1 step 당 1개씩 누적 회귀화). 남은: 0223~0230 (placerebalance·placedrain·cachecapacity·cachetouch·worldwb·worldfsync·loginauth·loginabandon[verify.js→kit 이동]). 라운드 후 다음 방향(실배선#51/정리#49/멀티프로세스#9)은 `infra-review` 평결.

---

## 2. NEXT — 가설 (후보, 권위는 이 절)

> 🎯 **3차 균형 라운드 완료**(0221~0230) — 5박스 *각 2조각* 심화(backlog "추가 심화" 집행·균형·전부 reg 0·spine OK). **다음 방향(4차 심화/멀티프로세스 배선#9/spine 승급#16/신규 너비)의 권위 판정은 `infra-review`**(0221~0230 묶음). step-loop 은 그 평결을 읽어 여기로 승급.

**3차 균형 라운드 5박스 — 각 2조각 ✅:** ①인스턴스 이탈(0221)+수요 despawn(0222) ②오케 재배치 자동(0223)+host 드레인(0224) ③캐시 용량 LRU(0225)+touch(0226) ④월드영속 write-behind(0227)+fsync(0228) ⑤로그인 계정 검증(0229)+큐 이탈(0230).

**4차/후속 백로그 (🔴 제외)**: 5박스 추가 심화(실 존 연동·복제 anti-entropy·트리거 정교화) + 신규 5박스 멀티프로세스 배선(#9)·spine 승급(#16) + 금고↔가방 escrow·per-producer ack·버스 라우팅 영속·서버간 인증.

**빌드 인프라 — `engine/` 공유 커널 + `src/` 단일 소스(0049)**: `engine/`=VM·PRNG·FNV·Net·ISimCore·verify-kit(추가만)·close-step·new-step. **절차**: ①new-step ②닿는 박스 Edit+verify 새 모드 ③close-step ④델타 커밋+git tag. NETPREV=`../baseline` 고정. 훅 inject(미제공=reg 0).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| 🔴 | **C++ 시뮬 코어 headless 빌드 (최우선)** | 월드 | 결정론 시뮬 코어가 UE 모듈에 링크되면 'UObject 0' 이라도 빌드 불가 → 원격 검증 불가. UE-모듈-free 코어 분리/얇은 shim 필요(§4). C++ 승격 선결(0003 §8.2). |
| 🔴 | **비동기 실행 아래 결정론 (lockstep 배리어 해제)** | 코디네이션 | 0013 까지 결정론은 중앙 lockstep 배리어가 떠받침. 진짜 비동기는 논리 클럭(Lamport/벡터)·인과 순서로 후속(0012 §9-3·0105 §9). |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정검증·대기열·만료(0001). |
| ⬜ | **다중 클라 결정론 복제·예측** | 월드 | 0002~0004 결정론 복제·예측은 C++ 시뮬 승격에서 부활. 다중 클라 intent 인터리빙·예측/롤백(0001 §8.6). |
| ⬜ | **서버간 인증 없음** | 버스 | 존이 게이트웨이 발신 암묵 신뢰(0001). |
| 🟡 | **버스 단일점·분산·영속** | 버스 | 동적구독/failover/무손실/lease/self-healing ✅(0016~0061). 남은 것: 라우팅 영속·다중 브로커·per-producer ack. |
| 🟡 | **서비스 영속·failover (가방·채팅·파티·길드 ✅·버스 ⬜)** | 서비스/데이터 | 저널+압축+write-behind(0017~0029·0085·0184). 버스 라우팅 영속 0. |
| 🟡 | **거래소·우편·랭킹·길드·길드 금고 ✅** | 서비스 | 거래소(0107~0140)·우편(0142~0180)·길드(0181~0190·로스터/마스터십/이양)·길드 금고(0191~0200·공유 아이템 원장·예치/인출/발행/영속/스냅샷/배지/정합 capstone) 동형. 금고↔가방 escrow 연동 후속. |
| 🟡 | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | 프레즌스 박스·귓속말/파티 라우팅(0064~0106). 남은 것: cluster kill→replay·존 배치·부하 분산. |
| 🟡 | **캐시 + write-behind 영속 (저널+압축·홉 신뢰·failover/N-replica/quorum/윈도 ✅)** | 데이터 | PersistStore+압축·홉 신뢰→quorum→윈도(0017~0032). fsync 0·월드 영속 0. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속서 뷰/권위 재구성. |

> **✅ 해소된 격차** — 전문은 §7 INDEX·각 `step-NNNN.md`. 묶음: 골격~전송(01~04)·AOI~failover(05~13)·게임서비스+영속+quorum(14~32)·버스(33~63)·프레즌스/귓속말/파티(64~106)·거래소/우편(107~180)·길드(181~).

> **상시 렌즈 — 척추** ([SPINE.md](SPINE.md) §5): 매 step은 verify 4기둥 + 척추 5항(①신성한 tick ②결정론 코어 ③권위 단일 소유 ④은닉·단일 연결 ⑤headless·원격 검증). 분리 기준: *존 tick 과 같은 박자로 돌아야 하는가?*

---

## 4. DURABLE CONSTRAINTS — 모든 step이 지킬 정전(canonical) 사실

> 여러 step이 반복 참조하는 불변. 새 step은 이걸 어기면 척추에서 벗어난 것 — 재설계.

- **회귀 0**: 새로 더한 항을 끄면(플래그=0) 직전 step과 **비트 단위 동일**(verify `reg`, maxDiff=0).
- **신성한 tick**: 존 시뮬 tick 안에 시뮬 외 작업(동기 I/O·인증·트랜잭션·팬아웃) 금지 — 전부 비동기 서비스/버스 경유.
- **결정론 코어**: 세계 상태의 쓰기 경로는 intent→결정론 시뮬 코어 하나. 같은 시드·로그 → 같은 해시. **`Math.random` 금지, 시드 의사난수만.**
- **권위 단일 소유**: 모든 상태 조각의 쓰기 권위는 정확히 한 곳(매 tick 소유자=1). 이동은 release+acquire **쌍 거래**/트랜잭션.
- **은닉·단일 연결**: 클라는 게이트웨이만 안다. 서버간은 버스/명시 인터페이스만 — 타 서버 내부·DB 직접 접근 금지.
- **수렴(desync 0)**: 클라 예측 뷰는 권위 재현으로 수렴. 겹친 뷰의 참여자는 조정 후 일치.
- **복제 = 재현, 상태 전송 아님**: `(seed+params+intent 로그)` 가 기본. 전체 스냅샷은 late-join·복구의 최후 수단.
- **Sim = 인터페이스 우선, C++ 최후 교체**: 존 시뮬은 *동결된 Sim 인터페이스* 뒤에 산다 — 오늘은 더미(헤드리스), 인프라 전체를 원격 E2E 로 세운 뒤 인터페이스 무변경으로 얇은 C++ 호스트로 *교체만*(원격 검증 루프 보존·[TOOLS.md](TOOLS.md) §4·§6). 더미는 인터페이스의 *첫 구현*.
- **headless·원격 검증(게임 시뮬 포함, 협상 불가)**: 모든 서버 동작 검증은 *결정론 시뮬 코어까지* UE·GUI 없이 headless·원격(이 환경/CI)서 가능. 더미=Node 자명 충족. **'UObject 0' 으로는 부족** — 시뮬 코어가 UE 모듈(`Core`·`CoreUObject`·`Json` 등)에 링크되면 headless 빌드 불가(§3 격차) → UE-모듈-free 코어 분리/얇은 shim 선결 ([TOOLS.md](TOOLS.md) §1·§4).
- **수치 = verify 출력**: 모든 문서 수치는 시드 [42, 7, 1234, 99, 2026] 평균으로 재현.
- **코어 netcode 불변**: 결정론 시뮬 코어 순수성(UObject 0 — headless 빌드 가능) · 서버 권위(클라 읽기전용) · ISP 3-Layer · 시뮬 상태 직접쓰기 금지(intent 경유). 인프라는 *확장*하되 *깨지 않는다*.
- **한 step = 한 조각**: 더 떠올라도 다음으로 전가. 새 코어는 직전 코어를 잇고 박스/계약 하나만 더한다.
- **도구 = tick 판정 + 원격-검증** ([TOOLS.md](TOOLS.md)): tick 동기는 C++(결정론 시뮬 코어), 그 외는 원격 빌드·헤드리스 검증 도구(Go·Node·컨테이너). 시뮬만 격리(UObject 0 순수성=얇은 호스트로 CI 빌드).
- **데이터 3분할** ([TOOLS.md](TOOLS.md) §3): ① 월드 영속=intent 로그+스냅샷 ② 트랜잭션 진실(가방·계정)=PostgreSQL→분산 SQL ③ Redis=휘발/캐시. 월드 상태를 DB 행으로 저장하지 않는다.

---

## 5. 6계층 진행 현황 ([SPINE.md](SPINE.md) §6)

| # | 계층 | 박스 | 상태 (현재 마커 + 핵심 step) |
|---|------|------|------|
| 1 | 엣지 | 로그인/인증 · 게이트웨이 | 🟡 스텁(일회 티켓·단일 연결·은닉 0001)+별 OS 프로세스(0010)+GW producer ns(0046) · **로그인 큐 🟡 대기열+티켓 발급+만료(0209~0210)+수용량 백프레셔(0219)+재접속 재개(0220)+계정 검증(0229)+큐 이탈(0230·좀비 슬롯 회수)**. 게이트웨이 군 풀 후속 |
| 2 | 월드 | 존 · 인스턴스 (분할·AOI·조정·핸드오프) | 🟡 존 VM+결정론 복제+AOI+분할·핸드오프(소유자=1)+failover+별 프로세스(0001~0013) · **인스턴스 🟡 spawn+despawn(0201~0202)+수요 자동 spawn(0215)+라우팅(0216)+이탈(0221)+수요 자동 despawn(0222·탄력 축소)**. 존 N개 후속 |
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 가방/채팅/ranking/읽기모델+write-behind/quorum(0014~0063)·귓속말/파티(0071~0106)·거래소(0107~0140)·우편(0142~0180) 동형(escrow/발행/3leg/saga)·길드(0181~0190·로스터/마스터십/배지/이양)·길드 금고(0191~0200·공유 아이템 원장·예치/인출/발행/영속/스냅샷/배지/정합). 금고↔가방 escrow 연동 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 substrate→토픽 pub/sub→ServiceBus→발신 소비자→동적구독/failover/무손실/replay 유계·ack 자기조정/min-wm/lease·ns·lifecycle·적응형(0004~0054). 분산·per-producer ack·라우팅 영속 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 레지스트리+Orchestrator+broker(lockstep→TCP→허브·kill·split-brain 0·0001~0013)·lease→프레즌스 SSOT→self-healing·공지 epoch 펜싱(0054~0106). broker 물리 분산·진짜 비동기 후속 · **오케스트레이터 존 배치 🟡(0203~0204·placeZone+placeQuery)+부하 배치(0217)+재배치 핸드오프(0218)+부하 재배치 자동 트리거(0223)+host 드레인(0224·퇴역 안전 이주)** |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 PersistStore(효과 저널·write-behind·kill→replay)→스냅샷 압축→복구→홉 신뢰→failover/N-replica quorum→윈도(0017~0062) · **캐시 🟡 set/get+read-through(0205~0206)+TTL 만료(0211)+무효화(0212)+용량 LRU 회수(0225)+recency touch(0226·진짜 LRU)** · **월드 영속 🟡 intent 로그 append+replay(0207~0208)+스냅샷 압축(0213)+crash/recover 정합(0214)+write-behind 버퍼(0227)+fsync durable barrier(0228·물리 확정 경계)**. 버스 영속 후속 |

---

## 6. 빠른 참조

- 큰 그림·계층 책임·씨앗·척추 5항: [SPINE.md](SPINE.md) · 도구·스택·데이터 3분할: [TOOLS.md](TOOLS.md)
- **의외의 발견 / 정직한 한계 전문**: 각 `step-NNNN.md`.

---

## 7. INDEX — 시리즈 검증 현황 (유일하게 append, 1행/step)

| step | 더한 한 조각 | 결과 (회귀 0 전제) |
|---|---|---|
| _묶음 0001–0100 (전문=reviews/ 묶음 감사·progress/)_ |  |  |
| [0001–0010](reviews/review-0001-0010.md) | 헤드리스 토대 — 4박스→존 결정론 복제·AOI·핸드오프·failover→멀티프로세스 IPC/TCP | 통과(reg 0·spine OK) |
| [0011–0020](reviews/review-0011-0020.md) | 와이어 현실화(TCP·토픽 버스·진짜 kill)→게임 서비스 분리(가방·채팅)→데이터 영속(저널·스냅샷·CQRS) | 통과(reg 0·spine OK) |
| [0021–0030](reviews/review-0021-0030.md) | 서비스 영속 완성→write-behind 신뢰성 4부작→PersistStore 이중쓰기/N복제/quorum→박스 분할 | 통과(reg 0·spine OK) |
| [0031–0040](reviews/review-0031-0040.md) | 정합성 윈도 해소→버스 동적구독/failover/양경로 replay 무손실→replay 유계·ack 자기조정 | 통과(reg 0·spine OK) |
| [0041–0050](reviews/review-0041-0050.md) | 버스 replay 자기조정→다중소비자 min-워터마크→소비자 lease lifecycle→정리(src/ 단일화 0049) | 통과(reg 0·spine OK) |
| [0051–0060](reviews/review-0051-0060.md) | cadence 적응→lease 관측→프레즌스 SSOT→self-healing 제어 루프(반응·확인·재시도·상한) | 통과(reg 0·spine OK) |
| [0061–0070](reviews/review-0061-0070.md) | 대체 소비자(spawnReplace)→전용 프레즌스 박스 호(shadow·failover 승격·질의·발행 전 경로 failover-safe) | 통과(reg 0·spine OK) |
| [0071–0080](reviews/review-0071-0080.md) | 귓속말/파티 라우터→전달 신뢰 호(영수증·재시도·상한·exactly-once dedup) | 통과(reg 0·spine OK) |
| [0081–0090](reviews/review-0081-0090.md) | 전달 dedup 유계·관측→파티 1:N 영수증/ack 집계→멤버십 영속(증분·저널·압축) | 통과(reg 0·spine OK) |
| [0091–0100](reviews/review-0091-0100.md) | 파티 종결 3종·발행 양끝→멤버별 수신함→수신함 메모리 3차원 유계화→정리 2건 | 통과(reg 0·spine OK) |
| [0101–0106](step-0101.md) | 수신함 읽음 영수증·체크아웃 유계·읽음/손실 발행→공지 epoch 펜싱(active·wrouter) | 통과(reg 0) |
| [0107–0110](reviews/review-0101-0110.md) | 거래소 arc — 분리·체결발행·영속·저널 스냅샷 압축 | 통과(reg 0·spine OK) |
| [0111–0120](reviews/review-0111-0120.md) | 거래소 취소/시세피드/만료 + 거래소↔가방 escrow legs·2-서비스 보존 | 통과(reg 0·spine OK) |
| [0121–0130](reviews/review-0121-0130.md) | 거래소 saga — give 비동기·보상·dedup 유계·정합 capstone·자동 재전송·escrow transfers | 통과(reg 0·spine OK) |
| [0131–0140](reviews/review-0131-0140.md) | 거래소 saga — 재시도 상한·포기/재admission 발행·자동·상한·영구실패·liveness capstone | 통과(reg 0·spine OK) |
| [0141–0150](reviews/review-0141-0150.md) | 우편 arc — 서비스 분리·수령·입금발행·영속·압축·읽음/만료 발행·회계 정합 capstone | 통과(reg 0·spine OK) |
| [0151–0160](reviews/review-0151-0160.md) | 우편 배지 읽기모델(MailFeed)·질의 + 아이템 첨부 우편(수령/만료/정합) | 통과(reg 0·spine OK) |
| [0161–0170](reviews/review-0161-0170.md) | 아이템 우편↔가방 escrow 3-leg·보존 + 우편 saga(비동기/손실/재전송/transfers capstone) | 통과(reg 0·spine OK) |
| [0171–0180](reviews/review-0171-0180.md) | 우편 saga — 자동 재전송·상한·포기/재admission 발행·영구실패·liveness capstone | 통과(reg 0·spine OK) |
| [0181–0190](reviews/review-0181-0190.md) | 길드 arc — 분리·가입/탈퇴·발행·영속·압축·배지(GuildFeed)·정합·마스터 이양·capstone | 통과(reg 0·spine OK) |
| [0191–0200](reviews/review-0191-0200.md) | 길드 금고 arc — deposit/withdraw·발행·영속·압축·배지·정합·원장 단일소유·capstone | 통과(reg 0·spine OK) |
| [0201](step-0201.md) | 인스턴스(던전) 서버 분리·spawn 기본(InstanceServer·instanceSpawn·active SSOT·너비 1차 시작) | 통과 · active 3/spawns 4 |
| [0202](step-0202.md) | 인스턴스 despawn(instanceDespawn·수명주기 SSOT 완성·일회성 수명) | 통과 · active 2/retired 1 |
| [0203](step-0203.md) | 오케스트레이터 존 배치 SSOT(placeZone·zoneId→host·정적 배치 한계 제거 씨앗) | 통과 · placed 2/zone1 hostC |
| [0204](step-0204.md) | 오케스트레이터 존 배치 질의(placeQuery→placeReply·원격 request/reply·순수 읽기) | 통과 · rx 2/sent 2 |
| [0205](step-0205.md) | 캐시 박스 분리·set/get 기본(CacheStore·cacheSet·핫 데이터 1홉·DB 직행 대체) | 통과 · size 3/session gw2 |
| [0206](step-0206.md) | 캐시 read-through(cacheGet·miss→소스 채움·DB 직행 흡수) | 통과 · hits 2/misses 2 |
| [0207](step-0207.md) | 월드 영속 박스·intent 로그 append(WorldLog·worldAppend·event sourcing·데이터 3분할 ①) | 통과 · 길이 4/seq 단조 |
| [0208](step-0208.md) | 월드 영속 replay 재구성(replay·crash→로그 무손실·event sourcing 복제=재현) | 통과 · 무손실 0x7de275ff |
| [0209](step-0209.md) | 로그인 큐 박스·enqueue/dequeue(LoginQueue·대기열 FIFO+티켓 발급·폭주 엣지 흡수) | 통과 · 큐 2/admit 1 |
| [0210](step-0210.md) | 로그인 티켓 만료 TTL(loginExpire·너비 1차 5박스 완성) | 통과 · p1 만료/p2 생존 |
| [0211](step-0211.md) | 캐시 TTL 만료(cacheExpire·setAt+ttl≤now 회수·메모리 유계·2차 고도화 캐시 #1) | 통과 · k1 만료/k2 생존·evicted 1 |
| [0212](step-0212.md) | 캐시 무효화(cacheInvalidate·소스 변경 시 사본 끊기→fresh 재적재·2차 고도화 캐시 #2) | 통과 · invalidated 1·k1=fresh |
| [0213](step-0213.md) | 월드영속 스냅샷 압축(worldSnapshot·스냅샷+tail==전체 replay·무손실·2차 고도화 월드영속 #1) | 통과 · tail 2<full 5·digest 동일 |
| [0214](step-0214.md) | 월드영속 정합 capstone(worldCrash/worldRecover·메시지 구동·스냅샷 load-bearing·arc 0207~0214 닫기) | 통과 · recover==full·snap제거 달라짐 |
| [0215](step-0215.md) | 인스턴스 수요 spawn(instanceDemand·active<target 부족분 자동 채움·탄력 확장·2차 고도화 인스턴스 #1) | 통과 · active 3·demandSpawns 3·멱등 |
| [0216](step-0216.md) | 인스턴스 플레이어 라우팅(instanceRoute·player→instance 배정 SSOT·재배정 release+acquire·2차 고도화 인스턴스 #2) | 통과 · routed 3/reroute 1/reject 1 |
| [0217](step-0217.md) | 오케스트레이터 부하 배치(placeAuto·최소 부하 host 선택·부하 분산·결정론 tie-break·2차 고도화 오케 #1) | 통과 · A·B·C·A·부하 2/1/1 |
| [0218](step-0218.md) | 오케스트레이터 존 재배치 핸드오프(placeMigrate·release+acquire 쌍·권위 단일 소유 보존·2차 고도화 오케 #2) | 통과 · z1 A→C·배치 보존·mig 1/rej 2 |
| [0219](step-0219.md) | 로그인 큐 수용량 백프레셔(loginCapacity·admitted cap 도달 시 입장 보류·동접 상한·2차 고도화 로그인 #1) | 통과 · admitted 2/queue 1/rejected 1 |
| [0220](step-0220.md) | 로그인 큐 재접속 세션 재개(loginReconnect·유효 티켓 재개·새 티켓 0·2차 고도화 로그인 #2·균형 라운드 0211~0220 닫기) | 통과 · p1 tkt-1 재개·p2 miss |
| [0221](step-0221.md) | 인스턴스 플레이어 이탈(instanceLeave·route 해제·occupancy 감소·권위 release·0216 acquire 짝·3차 고도화 인스턴스 #1·균형 라운드 0221~0230 시작) | 통과 · d1 occ 2→1·left 1·miss 1 |
| [0222](step-0222.md) | 인스턴스 수요 자동 despawn(instanceReap·active>target 빈 인스턴스 회수·점유 보호·0215 수요 spawn 거울·3차 고도화 인스턴스 #2) | 통과 · demand 4→reap target 1→reaped 3·active 1 |
| [0223](step-0223.md) | 오케 부하 재배치 자동 트리거(placeRebalance·불균형≥2 최대→최소 host 존 자동 이주·균형 수렴·0218 자동판·3차 고도화 오케 #1) | 통과 · A3/0/0→A1/B1/C1·moves 2 |
| [0224](step-0224.md) | 오케 host 드레인(placeDrain·퇴역 host 모든 존 나머지 최소부하로 이주·release+acquire 연쇄·드레인 후 부하 0·3차 고도화 오케 #2) | 통과 · A2→A0·B2·C2·moves 2 |
| [0225](step-0225.md) | 캐시 용량 LRU 회수(cacheCapacity·키 수 상한·size>cap 면 setAt 최소 키 회수·개수 유계·0211 시간 유계 짝·allkeys-lru 더미·3차 고도화 캐시 #1) | 통과 · cap 2·k1 회수·size 2·evic 1 |
| [0226](step-0226.md) | 캐시 recency touch(cacheLruTouch·get hit 시 setAt 갱신→핫 키 생존·진짜 LRU·0225 set-시각만의 보완·3차 고도화 캐시 #2) | 통과 · get k1 후 k2 회수·k1 생존·touches 1 |
| [0227](step-0227.md) | 월드영속 write-behind 버퍼(worldBuffer/worldFlush·intent 버퍼링→durable 로그 일괄 적층·쓰기 지연 배치·미flush=비-durable crash 윈도·3차 고도화 월드영속 #1) | 통과 · 버퍼 2→flush 로그 2·미flush 1 비-durable |
| [0228](step-0228.md) | 월드영속 fsync durable barrier(worldFsync/worldRecoverDurable·durableSeq=디스크 확정 프런티어·seq≤durableSeq 만 복구·flush/fsync 구분·3차 고도화 월드영속 #2) | 통과 · durableSeq 3·dur복구 3·full 5 |
| [0229](step-0229.md) | 로그인 계정 검증(loginAuth·validAccounts 만 enqueue·미인증 거부·줄 이전 차단·0001 검증 큐 실체화·3차 고도화 로그인 #1) | 통과 · p1·p2 enqueue·pX 거부·authRejects 1 |
| [0230](step-0230.md) | 로그인 큐 이탈(loginAbandon·입장 전 대기열 제거·미줄 멱등 no-op·좀비 슬롯 회수·0219 백프레셔 정확도·3차 고도화 로그인 #2·3차 균형 라운드 0221~0230 닫기) | 통과 · p2 이탈·큐 [p1,p3]·aband 1·miss 1 |
| [0231](step-0231.md) | instanceleave 모드 spine 승급(#16 — 0221 bespoke→verify-kit 누적 회귀·박스 0줄·OPS 함수내 지역화·정리 라운드 1/10) | 통과(reg 0·spine OK) · 5/5 d1 occ 1 |
| [0232](step-0232.md) | instancereap 모드 spine 승급(#16 — 0222 수요 자동 despawn·정리 라운드 2/10) | 통과(reg 0·spine OK) · 5/5 active 1·reaped 3 |
