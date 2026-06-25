# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~6은 step 닫을 때 **덮어쓴다**(누적 금지)·§7 INDEX만 **literal 1줄** append. 발견/한계 전문은 `step-NNNN.md`. 누적 함정 금지: §5 step별 재나열 금지(현재 마커+핵심 step)·§3 ✅격차 한 줄로·§4 반복 참조 불변만. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0280](step-0280.md) — **#51b 실 zone.js 브리지 9·capstone: 전 계층 정합**. `fullyCoherent()` — placement(결정)==running(집행)==zoneRuntimes(실물) 세 층 완전 일치. 7종 op 혼합 후 참 → **#51b 실 zone.js 브리지 arc(0272~0280) 닫기**.
- **한 줄 상태**: reg ALL OK·zonecapstone: 5/5 7종 op 후 fullyCoherent·rtCount==runCount==placed==3·`run.js all` ALL OK·spine ALL OK.
- **다음**: 🎯 **#51b 브리지 완료(0272~0280) — orch 추상 running→실 EntityZone 런타임 lifecycle(start/migrate/stop/hostdown/rebalance/drain) 구동·읽기 경로·정합 capstone**. 다음 묶음: ⒜ **#9 멀티프로세스 배선**(실 host.js 소켓·게임서비스·데이터 계층 인프로세스 탈피)·⒝ 진짜 비동기(#4·논리클럭)·⒞ entity 트래픽의 실 zone.js 흐름(#9 위). 🔎 **0271~0280 묶음 리뷰 적기**(#43 도구 + #51b 브리지 9).

---

## 2. NEXT — 가설 (후보, 권위는 이 절)

> 🎯 **#49 정리 arc(0261~0270)·도구 #43(0271)·#51b 실 zone.js 브리지 arc(0272~0280) 완료**. 방향 권위 = `infra-review`(다음: 0271~0280 묶음 평결).

**후속 백로그 (다음 묶음 우선순위)**: ⒜ **#9 멀티프로세스 배선** — 0030 이후 박스 host.js 0, 게임서비스·데이터·코디네이션 계층 전부 인프로세스 전용. #51b 가 orch 추상 running→실 EntityZone 런타임 핸들까지 이었으므로(0272~0280), 다음은 그 핸들을 *실 프로세스*(host.js 소켓)로 분리. ⒝ **entity 트래픽의 실 zone.js 흐름**(#9 위·게이트웨이→실 존 런타임 enter/move 라우팅·이주 시 entity 무손실 실증) ⒞ 진짜 비동기(#4·논리클럭) + 금고↔가방 escrow·per-producer ack·버스 라우팅 영속. **⛔ "C++ 시뮬 코어"는 백로그에 없다**(범위 밖·§4·HktGameplay).

> **#51b 실 zone.js 브리지(0272~0280·완료)**: orch 가 placement 집행(_start/_migrate/_stop/_hostDown/_rebalance/_drain)으로 *실 EntityZone 인스턴스* lifecycle 을 구동(zoneRuntimes 레지스트리·orch-zonebridge.js 믹스인·팩토리 makeActor 주입). running 문자열 추상 SSOT↔실 핸들 정합(zoneRuntimeDrift·bridgeCoherent·fullyCoherent). migrate(상태 보존·같은 핸들) vs hostdown(소실·새 인스턴스) 의미 분리. zoneBridge OFF→전 step 비트 동일(reg 0). 잔여: 실 프로세스 분리(#9)·entity 트래픽.

**빌드 인프라 — `engine/` 공유 커널 + `src/` 단일 소스(0049)**: `engine/`=VM·PRNG·FNV·Net·ISimCore·verify-kit(추가만)·close-step·new-step. **절차**: ①new-step ②닿는 박스 Edit+verify 새 모드 ③close-step ④델타 커밋+git tag. NETPREV=`../baseline` 고정. 훅 inject(미제공=reg 0).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| ⛔범위밖 | **C++ 시뮬 코어 (HktInfra 과제 아님)** | 월드 | **결정론 시뮬 *내부 구현*은 HktInfra 범위가 아니다** — `ISimCore` 이음새 뒤 블랙박스·HktGameplay(C++ HktCore) 소관. HktInfra 는 이음새로 *이벤트만 받아 클라에 전파*. 더미 stub 은 영구 stub(C++ 화 숙제 아님). 반복 오해 금지 — [SPINE.md](SPINE.md) §0. |
| 🔴 | **비동기 실행 아래 결정론 (lockstep 배리어 해제)** | 코디네이션 | 0013 까지 결정론은 중앙 lockstep 배리어가 떠받침. 진짜 비동기는 논리 클럭(Lamport/벡터)·인과 순서로 후속(0012 §9-3·0105 §9). |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정검증·대기열·만료(0001). |
| ⬜ | **다중 클라 결정론 *전파*·예측** | 월드 | HktInfra 몫 = 같은 intent 스트림을 모든 클라가 재현해 같은 뷰로 수렴(desync 0)·예측/롤백은 *뷰*의 것(더미로 충족). 시뮬 *계산*은 범위 밖. 다중 클라 intent 인터리빙(0001 §8.6). |
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
- **⛔ Sim = HktInfra 범위 밖(이음새 뒤 블랙박스)**: 존 시뮬의 *내부 구현*은 동결 `ISimCore` 이음새 뒤에 살고 **HktGameplay(C++ HktCore)의 일이다** — HktInfra 는 더미 stub 으로 *전파 배선*만 검증하고, C++ 화는 HktInfra 숙제가 *아니다*. HktInfra 가 시뮬에 대해 하는 일 = *이음새로 intent 넘기고 결과 이벤트 받아 클라에 전파*. (반복 오해 금지 — [SPINE.md](SPINE.md) §0.)
- **headless·원격 검증(전송·전파 서버, 협상 불가)**: HktInfra 가 *짓는* 박스(전송·전파)는 UE·GUI 없이 headless·원격(이 환경/CI)서 검증 가능. 더미=Node 자명 충족. **시뮬 *내부*의 headless 빌드·UObject 0 순수성은 HktInfra 통과 조건이 아니다**(이음새 뒤 HktGameplay 소관) — HktInfra 는 시뮬 코드를 끌어안지 않고 이벤트만 전파한다.
- **수치 = verify 출력**: 모든 문서 수치는 시드 [42, 7, 1234, 99, 2026] 평균으로 재현.
- **코어 netcode 불변(HktInfra 가 *지키되 시뮬 코어는 안 짓는다*)**: 서버 권위(클라 읽기전용) · ISP 3-Layer · 시뮬 상태 직접쓰기 금지(intent 경유). 인프라는 *확장*하되 *깨지 않는다*. (시뮬 코어 결정론·UObject 0 순수성 = 이음새 뒤 HktGameplay 불변·HktInfra 는 존중만.)
- **한 step = 한 조각**: 더 떠올라도 다음으로 전가. 새 코어는 직전 코어를 잇고 박스/계약 하나만 더한다.
- **도구 = tick 판정 + 원격-검증** ([TOOLS.md](TOOLS.md)): 그 외 전송·전파 박스는 원격 빌드·헤드리스 검증 도구(Go·Node·컨테이너). tick 동기 결정론 시뮬 코어(C++)는 이음새 뒤 HktGameplay 소관·HktInfra 도구 결정 밖(⛔ 범위 경계).
- **데이터 3분할** ([TOOLS.md](TOOLS.md) §3): ① 월드 영속=intent 로그+스냅샷 ② 트랜잭션 진실(가방·계정)=PostgreSQL→분산 SQL ③ Redis=휘발/캐시. 월드 상태를 DB 행으로 저장하지 않는다.

---

## 5. 6계층 진행 현황 ([SPINE.md](SPINE.md) §6)

| # | 계층 | 박스 | 상태 (현재 마커 + 핵심 step) |
|---|------|------|------|
| 1 | 엣지 | 로그인/인증 · 게이트웨이 | 🟡 스텁(일회 티켓·단일 연결·은닉 0001)+별 OS 프로세스(0010)+GW producer ns(0046) · **로그인 큐 🟡 대기열+티켓 발급+만료(0209~0210)+수용량 백프레셔(0219)+재접속 재개(0220)+계정 검증(0229)+큐 이탈(0230·좀비 슬롯 회수)**. 게이트웨이 군 풀 후속 |
| 2 | 월드 | 존 · 인스턴스 (분할·AOI·조정·핸드오프) | 🟡 존 VM+결정론 복제+AOI+분할·핸드오프(소유자=1)+failover+별 프로세스(0001~0013) · **인스턴스 🟡 spawn+despawn(0201~0202)+수요 자동 spawn(0215)+라우팅(0216)+이탈(0221)+수요 자동 despawn(0222·탄력 축소)**. 존 N개 후속 |
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 가방/채팅/ranking/읽기모델+write-behind/quorum(0014~0063)·귓속말/파티(0071~0106)·거래소(0107~0140)·우편(0142~0180) 동형(escrow/발행/3leg/saga)·길드(0181~0190·로스터/마스터십/배지/이양)·길드 금고(0191~0200·공유 아이템 원장·예치/인출/발행/영속/스냅샷/배지/정합). 금고↔가방 escrow 연동 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 substrate→토픽 pub/sub→ServiceBus→발신 소비자→동적구독/failover/무손실/replay 유계·ack 자기조정/min-wm/lease·ns·lifecycle·적응형(0004~0054). 분산·per-producer ack·라우팅 영속 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 레지스트리+Orchestrator+broker(lockstep→TCP→허브·kill·split-brain 0·0001~0013)·lease→프레즌스 SSOT→self-healing·공지 epoch 펜싱(0054~0106). broker 물리 분산·진짜 비동기 후속 · **오케스트레이터 존 배치 🟡 advisory(0203~0224)→실배선 #51 executed SSOT arc(0241~0250)→**#51b 실 zone.js 브리지(0272~0280·orch 가 placement 집행으로 실 EntityZone 런타임 lifecycle 구동·zoneRuntimes·start/migrate/stop/hostdown/rebalance/drain·읽기 경로·정합 capstone fullyCoherent)** 완료(잔여: 실 프로세스 분리 #9·entity 트래픽). orch 정리(0251·0267). 도구 #43(0271·close-step src>30KB 가드)** |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 PersistStore(효과 저널·write-behind·kill→replay)→스냅샷 압축→복구→홉 신뢰→failover/N-replica quorum→윈도(0017~0062) · **캐시 🟡 set/get·read-through·TTL·무효화·LRU 용량/recency(0205~0226)+Redis-like 4차 arc(0252~0260·write-through·bulk·negative·SETNX·SETEX·delete·stats·prefix·coherent capstone)** · **월드 영속 🟡 intent 로그·replay·스냅샷·crash/recover·write-behind 버퍼·fsync durable barrier(0207~0228)**. 버스 영속 후속 |

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
| [0201–0210](step-0201.md) | 너비 1차 5박스: 인스턴스 spawn/despawn·오케 배치 SSOT(placeZone/query)·캐시 set/read-through·월드 intent 로그/replay·로그인 큐/티켓 | 통과(reg 0) |
| [0211–0220](step-0211.md) | 2차 균형: 캐시 TTL/무효화·월드 스냅샷/crash-recover·인스턴스 수요 spawn/라우팅·오케 부하배치/핸드오프·로그인 백프레셔/재접속 | 통과(reg 0) |
| [0221–0230](step-0221.md) | 3차 균형: 인스턴스 이탈/자동 despawn·오케 자동 재배치/드레인·캐시 LRU 용량/recency·월드 write-behind/fsync·로그인 계정검증/큐이탈 | 통과(reg 0) |
| [0231–0240](step-0231.md) | #16 승급 라운드: 3차 균형 10모드(instanceleave~loginabandon)를 verify-kit 누적 회귀로 승격·verify.js 순수 셸 정리 | 통과(reg 0·spine OK) |
| [0241](step-0241.md) | 배치 SSOT 실배선 #51-1: 존 런타임 레지스트리(running·executed SSOT·placeExecute→placeZone start·advisory paper→executed lifecycle 첫 조각) | 통과(reg 0·spine OK) · 5/5 running 2·starts 2·결정==집행 |
| [0242](step-0242.md) | 배치 SSOT 실배선 #51-2: executed placeMigrate(_migrate·실 존 런타임 release+acquire 이주·running 원자 교체·0218 paper 의 집행 판) | 통과(reg 0·spine OK) · 5/5 z1 hostA→hostC 실 이주·단일 소유 |
| [0243](step-0243.md) | 배치 SSOT 실배선 #51-3: executed placeRebalance(_rebalance 가 매 move 마다 _migrate·실 존 런타임 균형 수렴·0223 자동 트리거의 집행 판) | 통과(reg 0·spine OK) · 5/5 3/0/0→running 1/1/1·rtMig 2 |
| [0244](step-0244.md) | 배치 SSOT 실배선 #51-4: executed placeDrain(_drain 이 매 move 마다 _migrate·드레인 후 그 host running 0·0224 퇴역 안전 이주의 집행 판) | 통과(reg 0·spine OK) · 5/5 A 드레인→running A 0·B 2·C 2 |
| [0245](step-0245.md) | 배치 SSOT 실배선 #51-5: reconcile capstone(placementDrift 질의·혼합 op 후 결정==집행·drift 0·runningCount==placedCount·advisory→executed arc 닫기) | 통과(reg 0·spine OK) · 5/5 drift 0·run 4/placed 4 |
| [0246](step-0246.md) | 배치 SSOT 실배선 #51-6: executed placeStop(_stop·존 운영 퇴역·결정+집행 동시 제거·instance _despawn 의 존 판·드레인과 달리 그 존 자체 내림) | 통과(reg 0·spine OK) · 5/5 z2 퇴역·placed 2·drift 0 |
| [0247](step-0247.md) | 배치 SSOT 실배선 #51-7: executed placeAuto(부하 기반 자동 배치가 최소부하 host 에 실 런타임 _start·0217 advisory 자동 배치의 집행 판) | 통과(reg 0·spine OK) · 5/5 running A2/B1/C1·starts 4·drift 0 |
| [0248](step-0248.md) | 배치 SSOT 실배선 #51-8: host 장애 복구(placeHostDown·_hostDown·죽은 host 존 생존 host 재가동 re-acquire·드레인과 달리 비자발·release 불가) | 통과(reg 0·spine OK) · 5/5 A 장애→A run 0·rescued 2·drift 0 |
| [0249](step-0249.md) | 배치 SSOT 실배선 #51-9: 전 lifecycle 집행 capstone(runningHosts 질의·start·auto·migrate·hostdown·stop 혼합 후 결정==집행·drift 0·단일 소유·arc 0241~0249 닫기) | 통과(reg 0·spine OK) · 5/5 run 4/placed 4·drift 0·single owner |
| [0250](step-0250.md) | 배치 SSOT 실배선 #51-10: placeQuery executed host(질의 회신에 실 가동 running 추가·게이트웨이 실 위치 라우팅·읽기 경로 완성·0241~0250 decade 닫기) | 통과(reg 0·spine OK) · 5/5 reply host==running==hostC |
| [0251](step-0251.md) | 정리(#49): 오케스트레이터 배치 런타임 분리(orch-placement.js 믹스인·Object.assign prototype·투명 분할·34KB→27.5KB·정리 라운드 1) | 통과(reg 0·spine OK) · 5/5 drift 0·running 단일 소유 |
| [0252](step-0252.md) | 캐시 write-through 소스 정합(cacheWriteThrough·set 시 backing source 동시 기록·무효화 후 read-through 최신값·4차 고도화 캐시 #1) | 통과(reg 0·spine OK) · 5/5 WT get=v2·OFF get=v1(stale) |
| [0253](step-0253.md) | 캐시 bulk get(cacheMget·여러 키 read-through 일괄 조회·라운드트립 N→1·배치 페치·4차 고도화 캐시 #2) | 통과(reg 0·spine OK) · 5/5 mget=[v1,v2,s3,∅]·hits2/miss2 |
| [0254](step-0254.md) | 캐시 negative caching(cacheNegative·소스에도 없는 키 known-absent 기억·재조회 소스 단축·침투 방어·set 시 해제·4차 고도화 캐시 #3) | 통과(reg 0·spine OK) · 5/5 ON negHits1·OFF 0 |
| [0255](step-0255.md) | 캐시 put-if-absent(cacheAdd·SETNX·키 없을 때만 쓰기·최초-기록-승·분산 락/유일 점유 primitive·4차 고도화 캐시 #4) | 통과(reg 0·spine OK) · 5/5 add1 true·add2 false·store v1 |
| [0256](step-0256.md) | 캐시 per-key TTL(cacheSetEx·SETEX·키별 만료 수명·cacheExpire 스윕 per-key 우선·차등 만료·4차 고도화 캐시 #5) | 통과(reg 0·spine OK) · 5/5 k1(ttl2)만료·k2(글로벌10)생존 |
| [0257](step-0257.md) | 캐시 explicit delete(cacheDelete·DEL·store+writeThrough 면 source 영구 제거·무효화와 달리 재적재 없음·4차 고도화 캐시 #6) | 통과(reg 0·spine OK) · 5/5 del→undefined·inv→v2 |
| [0258](step-0258.md) | 캐시 stats 관측(cacheStats·INFO·hits/misses/hitRate/size 회신·hitRate()·stats() accessor·운영 폴링·4차 고도화 캐시 #7) | 통과(reg 0·spine OK) · 5/5 hits2·miss1·hitRate0.667 |
| [0259](step-0259.md) | 캐시 namespace 무효화(cacheDeletePrefix·SCAN+DEL·prefix 매칭 키 일괄 제거·세션/길드 단위 무효화·단일 delete 패턴판·4차 고도화 캐시 #8) | 통과(reg 0·spine OK) · 5/5 session:* 2제거·item 생존 |
| [0260](step-0260.md) | 캐시 정합 capstone(coherent·store↔setAt 1:1·store∩negatives=∅·keyTtl⊆store·무효화 keyTtl 정리·캐시 arc 0252~0260 닫기) | 통과(reg 0·spine OK) · 5/5 14-op 혼합 매단계 coherent |
| [0261](step-0261.md) | 정리(#49 wiring): topo-run 제어 평면 주입열 분리(topo-inject.js·applyInjections·rankDie~loginOps·inject verbatim·투명 분할·35.9→22.7KB) | 통과(reg 0·spine OK) · 5/5 injsplit active 2·cache k1/k2 |
| [0262](step-0262.md) | 정리(#49 wiring): topo-run crash/failover 복구 주입 분리(topo-failover.js·applyFailover·persistRestart~busRestart verbatim·투명 분할·22.7→13.1KB·#49 topo-run 해소) | 통과(reg 0·spine OK) · 5/5 fosplit 복구 투명 ledger 일치 |
| [0263](step-0263.md) | 정리(#49 wiring): topo-build 서비스 박스 add 시퀀스 분리(topo-boxes.js·addServiceBoxes·gateway~loginqueue verbatim·ctx 150이름·투명 분할·31.5→14.7KB·#49 topo-build 해소) | 통과(reg 0·spine OK) · 5/5 boxsplit 13/13 박스 spec |
| [0264](step-0264.md) | 정리(#49 wiring): svc-exchange-core 영속/failover 메서드 믹스인 분리(svc-exchange-persist.js·_journal/crash/reconstruct·Object.assign prototype·투명 분할·30.7→26.6KB·#49 마지막 >30KB 박스 해소) | 통과(reg 0·spine OK) · 5/5 xchsplit crash→reconstruct 복원 |
| [0265](step-0265.md) | 정리(#49 인접·선제): svc-guild 트랜잭션 핸들러 믹스인 분리(svc-guild-txn.js·onMsg create~query·Object.assign prototype·투명 분할·29.5→24.4KB) | 통과(reg 0·spine OK) · 5/5 gldsplit 로스터+금고 정합 |
| [0266](step-0266.md) | 정리(#49 인접·선제): svc-inventory-core 생성자 필드 초기화 믹스인 분리(svc-inventory-init.js·_init ~120필드·Object.assign prototype·투명 분할·28.5→5.7KB) | 통과(reg 0·spine OK) · 5/5 invsplit 필드 정확·crash 정합 |
| [0267](step-0267.md) | 정리(#49 인접·선제): orchestrator 제어 평면 핸들러 믹스인 분리(orch-control.js·onMsg/onTick·Object.assign prototype·0251 placement 의 짝·투명 분할·27.5→18.9KB) | 통과(reg 0·spine OK) · 5/5 orchctlsplit placeZone SSOT |
| [0268](step-0268.md) | 정리(#49 인접·선제): svc-mail-core saga 헬퍼 믹스인 분리(svc-mail-saga.js·_custody/_resendPending/_readmit·Object.assign prototype·투명 분할·25.3→19.9KB) | 통과(reg 0·spine OK) · 5/5 mailsplit saga 헬퍼 정합 |
| [0269](step-0269.md) | 정리(#49 인접·선제): svc-mailbox dedup 헬퍼 믹스인 분리(svc-mailbox-dedup.js·_pruneEpoch/_seenHas/_seenAdd/seenSize/_ack·Object.assign prototype·투명 분할·24.7→22.8KB) | 통과(reg 0·spine OK) · 5/5 mboxsplit 멱등 dedup |
| [0270](step-0270.md) | 정리(#49 인접·선제): gateway 메시지 라우팅 핸들러 믹스인 분리(gateway-msg.js·onMsg 업/다운스트림 라우팅·Object.assign prototype·투명 분할·22.8→16.5KB·#49 정리 arc 0261~0270 닫기) | 통과(reg 0·spine OK) · 5/5 gwsplit worldDigest 재현·live 6 |
| [0271](step-0271.md) | 도구 갭 #43: close-step src/ 박스 >30KB 가드(engine/close-step.js·매 close src 스캔·비실패 경고·#49 재발 방비·net-core 무변경) | 통과(reg 0 자명·spine OK) · 최대 svc-exchange-core 26.0KB ≤30KB(>30KB 0개) |
| [0272](step-0272.md) | #51b 실 zone.js 브리지 1: orch 존 런타임 레지스트리(orch-zonebridge.js·_bridgeStart·placeZone 집행이 실 EntityZone 인스턴스 host 바인딩·running 추상↔실 런타임 연결·팩토리 makeActor 주입·zoneBridge OFF→0271 동일) | 통과(reg 0·spine OK) · 5/5 z1→hostA·z2→hostB·rtCount 2·zoneStarts 2·실EZ |
| [0273](step-0273.md) | #51b 실 zone.js 브리지 2: _migrate 실 런타임 host 이주(_bridgeMigrate·같은 EntityZone 핸들 host release+acquire 원자 교체·재생성 아님·상태 보존·zoneMigrations 계측·OFF→0272 동일) | 통과(reg 0·spine OK) · 5/5 z1 A→C→A·zoneStarts 2 불변·zoneMigrations 2 |
| [0274](step-0274.md) | #51b 실 zone.js 브리지 3: _stop 실 런타임 종료(_bridgeStop·placeStop 집행이 실 EntityZone 런타임 zoneRuntimes 제거·핸들 폐기·zoneStops 계측·없는 존 멱등·OFF→0273 동일) | 통과(reg 0·spine OK) · 5/5 z1 퇴역→rtCount 1·z1 gone·z2 live·zoneStops 1 |
| [0275](step-0275.md) | #51b 실 zone.js 브리지 4: _hostDown 실 런타임 재가동(_bridgeHostDown·죽은 host 의 실 EntityZone 생존 host 새 인스턴스 재가동·비자발·상태 보존 불가·migrate 와 구분·zoneRescued·runtimeOn 질의·OFF→0274 동일) | 통과(reg 0·spine OK) · 5/5 hostA 장애→runtimeOn(A) 0·rescued 2·rtCount 3 |
| [0276](step-0276.md) | #51b 실 zone.js 브리지 5: zoneRuntimeDrift 정합 질의(running 문자열 SSOT↔zoneRuntimes 실 핸들 host 표류 수·전 op 뒤 0·placementDrift 의 실물 판·읽기 전용·OFF→0275 동일) | 통과(reg 0·spine OK) · 5/5 혼합 lifecycle 후 drift 0·rtCount 2==runCount |
| [0277](step-0277.md) | #51b 실 zone.js 브리지 6: _rebalance 실 핸들 균형(zoneRuntimeHosts 질의·rebalance 매 move _migrate→_bridgeMigrate transitive 실 핸들 분산·OFF→0276 동일) | 통과(reg 0·spine OK) · 5/5 3존 A 몰림→runtimeOn 1/1/1·hosts 3·drift 0·starts 3 |
| [0278](step-0278.md) | #51b 실 zone.js 브리지 7: _drain 실 핸들 비움(bridgeCoherent primitive·drift0+수일치·drain 매 move graceful 이주·drain↔hostdown 구분·OFF→0277 동일) | 통과(reg 0·spine OK) · 5/5 hostA 드레인→runtimeOn(A) 0·rtCount 3·coherent·starts 3 |
| [0279](step-0279.md) | #51b 실 zone.js 브리지 8: placeQuery 실 런타임 host 회신(placeReply runtimeHost 필드·실 핸들 위치·0250 의 브리지 판·읽기 경로 완성·OFF→reply 바이트 동일) | 통과(reg 0·spine OK) · 5/5 z1 이주 후 runtimeHost=hostC==실핸들==running==placement |
| [0280](step-0280.md) | #51b 실 zone.js 브리지 9·capstone: 전 계층 정합(fullyCoherent·placement==running==zoneRuntimes 3층·placementDrift0+bridgeCoherent+placedCount==runtimeCount·7종 op 혼합·#51b arc 0272~0280 닫기·OFF→0279 동일) | 통과(reg 0·spine OK) · 5/5 7종 op 후 fullyCoherent·rtCount==runCount==placed 3 |
