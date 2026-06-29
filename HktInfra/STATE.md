# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~6은 step 닫을 때 **덮어쓴다**(누적 금지)·§7 INDEX만 **literal 1줄** append. 발견/한계 전문은 `step-NNNN.md`. 누적 함정 금지: §5 step별 재나열 금지(현재 마커+핵심 step)·§3 ✅격차 한 줄로·§4 반복 참조 불변만. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0388](step-0388.md) — **#65 양방향 동기 8: syncPlan 이 placement 권위 기준** — syncPlan 이 orch plan(stale) 아닌 placement(실 위치)로 차분 → migrate 후 *옳은* host 에 누락 존 복원. 직전: 0387 placement-aware report.
- **한 줄 상태**: reg ALL OK·coordsync2 5/5(migrate z3 후 syncPlan→hostB 복원·hostA 미복원·desync0)·박스 >30KB 0개·spine ALL OK.
- **다음**: 🎯 **#65 양방향 동기 sub-arc(0381~)** — 코디네이터 lifecycle↔placement 권위 동기: placement SSOT(0381 ✅)→ coordDesync(placement 기준)→ migrate 가 placement 갱신(→migrate 후 desync 0)→ coordCoherent 가 coordDesync 사용→ failover placement 갱신+lost 추적→ lost 제외 coherence→ placement-aware report→ syncPlan placement 기준→ placementCoherent bijection→ grand capstone syncedCoherent. **후속**: cluster-run.js 옛 runMulti 합류(#62 잔여)·업스트림 intent 실 클라(#61)·진짜 비동기(#4).

---

## 2. NEXT — 가설 (후보, 권위는 이 절)

> 🎯 **#62 runMulti 통합 sub-arc(0371~0380 ✅ 닫힘)** — verify ad-hoc cluster 구동(driveCluster 0368)을 *broker 측 제어 평면 상주*(`cluster-coord.js` ClusterCoordinator)로 옮겼다: start·tick·연속 run 루프·매-tick desync 가드·상주 migrate/failover·syncPlan 비파괴 자가 치유·egress 집계·report·grand capstone coordCoherent. **다음 후보(권위는 infra-review)**: ⒜ orch 권위 placement↔실 cluster lifecycle 양방향 동기(코디네이터 migrate/failover 가 orch zoneHost 도 갱신→migrate 후 clusterCoherent)·⒝ cluster-run.js 옛 lockstep runMulti 와 코디네이터 코드 합류·⒞ 업스트림 intent 실 클라(#61).
> **설계 제약**: spine 게이트는 `verify.js all`. cluster-coord 는 새 박스(run() 데이터 평면 미사용 → reg 0). reg 는 항상 in-proc run() 비트 대조.

**후속 백로그**: ⒝ 업스트림 intent 실 클라(#61). ⒞ 진짜 비동기(#4)·금고↔가방 escrow·per-producer ack·버스 라우팅 영속. **⛔ "C++ 시뮬 코어"는 백로그에 없다**(범위 밖·§4). 방향 권위 = `infra-review`(0291~0380 8묶음 리뷰 적기).

**빌드 인프라 — `engine/` 공유 커널 + `src/` 단일 소스(0049)**: `engine/`=VM·PRNG·FNV·Net·ISimCore·verify-kit(추가만)·close-step·new-step. **절차**: ①new-step ②닿는 박스 Edit+verify 새 모드 ③close-step ④델타 커밋+git tag. NETPREV=`../baseline` 고정. 훅 inject(미제공=reg 0).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| ⛔범위밖 | **C++ 시뮬 코어 (HktInfra 과제 아님)** | 월드 | **결정론 시뮬 *내부 구현*은 HktInfra 범위가 아니다** — `ISimCore` 이음새 뒤 블랙박스·HktGameplay(C++ HktCore) 소관. HktInfra 는 이음새로 *이벤트만 받아 클라에 전파*. 더미 stub 은 영구 stub(C++ 화 숙제 아님). 반복 오해 금지 — [SPINE.md](SPINE.md) §0. |
| ✅ | **#56 브리지 존 데이터 평면 (entity 트래픽)** | 코디네이션/월드 | 0281~0290 해소: enter/move/leave·런타임 tick·migrate 무손실(행동적)·hostdown 소실·stop 폐기·단일 소유·정합·graceful census 보존·capstone(entityFlowCoherent·entityConserved). |
| 🟡 | **#9 멀티프로세스 배선 (직접 라우팅 ✅ · host 컨테이너 ✅ · 월드 다운스트림 E2E ✅ · #57 드라이버+실 spawn+실 데이터 평면 ✅ · runMulti 코어 통합 🟡)** | 코디네이션/엣지 | 0291~0310 직접 라우팅·host 컨테이너·0319~0350 월드 다운스트림 E2E. **#57 ✅(0351~0360 드라이버+실 spawn·clusterHostsCoherent · 0361~0370 실 데이터 평면: deliver/zonedel/tick/egress/migrate 상태보존/killHost·failover/reconcile/격리/driveCluster 통합·clusterCoherent desync 0)**. **남은 것: cluster-run.js runMulti 코어에 orch 상주(broker 측 제어 평면)·연속 tick 루프·업스트림 intent 실 클라(#61)**. |
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
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 레지스트리+Orchestrator+broker(0001~13)·프레즌스 SSOT·self-healing·epoch 펜싱(0054~106). 존 배치: advisory(0203~24)→executed SSOT #51(0241~50)→실 zone.js 브리지 #51b(0272~80·fullyCoherent)·#56 entity 데이터 평면(0281~90·entityFlowCoherent)·#9 직접 라우팅(0291~300·directFlowCoherent)·실 host.js 컨테이너(0301~10·hostProcCoherent)·부하 균형(0311~18·hostBalanced)·월드 다운스트림 E2E(0319~50·downstreamWorldCoherent: 포착→전파→실 클라 수렴 desync0). **#57 실 OS 프로세스 spawn(0351~60·ClusterHostDriver·clusterHostsCoherent) + 실 데이터 평면(0361~70·deliver/tick/migrate 상태보존/kill·failover/reconcile/driveCluster·clusterCoherent desync 0·실 host.js child_process E2E) + #62 runMulti 통합(0371~80·`cluster-coord.js` ClusterCoordinator·start/tick/연속 run 루프/매-tick desync 가드/상주 migrate·failover/syncPlan 비파괴 자가 치유/egress 집계/report/coordCoherent grand capstone — verify ad-hoc 구동을 broker 측 제어 평면 상주화)**. orch 정리(0251·0267·0305·0323·0332)·도구 #43(0271) |
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
| [0241–0250](reviews/review-0241-0250.md) | 배치 SSOT 실배선 #51 arc(executed running·migrate/rebalance/drain/stop/auto/hostdown·reconcile/lifecycle capstone·placeQuery executed host) | 통과(reg 0·spine OK) |
| [0251–0260](reviews/review-0251-0260.md) | 정리(#49 orch-placement 분리)→캐시 4차 고도화 arc(write-through·mget·negative·SETNX·SETEX·DEL·stats·prefix·정합 capstone) | 통과(reg 0·spine OK) |
| [0261–0270](reviews/review-0261-0270.md) | 정리(#49 wiring) arc — topo-inject/failover/boxes·svc-exchange/guild/inventory/mail/mailbox·orch-control·gateway-msg 믹스인 분할(투명·>30KB 박스 해소) | 통과(reg 0·spine OK) |
| [0271–0280](reviews/review-0271-0280.md) | 도구 #43(close-step >30KB 가드)→#51b 실 zone.js 브리지 arc(placement 집행이 실 EntityZone 런타임 lifecycle 구동·start/migrate/stop/hostdown/rebalance/drain·정합 capstone fullyCoherent) | 통과(reg 0·spine OK) |
| [0281–0290](reviews/review-0281-0290.md) | #56 브리지 존 데이터 평면 arc(enter/move/leave·런타임 tick·migrate무손실/hostdown소실/stop폐기·단일소유·정합·graceful보존·capstone entityFlowCoherent·entityConserved) | 통과(reg 0·spine OK) |
| [0291–0300](step-0291.md) | #9 멀티프로세스 배선 arc: 존 런타임 전송 seam·host mailbox·게이트웨이 존 디렉토리·게이트웨이→실 존 직접 enter/move/leave 라우팅·이주/장애 정합·dir bijection·capstone directFlowCoherent | 통과(reg 0·spine OK) · 5/5 directFlowCoherent·conserved·stale0 |
| [0301–0310](step-0301.md) | #9 잔여(실 host.js 물리 분리) arc: host 1급 컨테이너 zoneHosts·자기 inbox 수신·자기 루프 tick·단일소유/drift·roster reg/dereg·정리 분할 orch-hostproc·inbox stale 거부·census·hostContainerCoherent·bijection·capstone hostProcCoherent | 통과(reg 0·spine OK) · 5/5 hpcoh·consv·recv==drained+stale·census1 |
| [0311–0318](step-0311.md) | host 프로세스 컨테이너 심화·**부하 균형 sub-arc**: hostLoadSkew(존 수 불균형)→생애주기 로그 hostLifecycle→다중 존/동시 host 장애 failover(hostZones·hostCount)→entity 가중 부하 hostEntitySkew/자동 배치 placeAutoE/재배치 placeRebalanceE→capstone 균형 술어 hostBalanced(존 수·entity 둘 다·placeRebalanceE→균형) | 통과(reg 0·spine OK) · 각 5/5 |
| [0319–0330](step-0319.md) | downstream 데이터 평면 *포착* sub-arc(#9 후속): host 산출 AOI 라활 포착(no-op→버퍼링 싱크)→AOI 정확성/증분 델타/상호 가시/exit→직렬화 경계→존 격리→이주 연속→무굶김→무손실 회계→capstone downstreamCoherent(zoneViewConserved&&AllKeyed&&serializable) | 통과(reg 0·spine OK) · 각 5/5 |
| [0331–0341](step-0331.md) | downstream 전파 sub-arc(#9 후속): host 뷰 egress(0331)·브리지 init 분리 정리(0332)·게이트웨이 수신(0333)·게이트웨이→클라 라우팅(0334)·per-세션 dseq(0335)·egress 버퍼 자기-크기조정/ack(0336)·재전송 복구(0337)·타임아웃 재전송(0338)·leave 정리(0339)·다중 존 격리 gatewayDeliveryIsolated(0340)·capstone downstreamSettled(0341) | 통과(reg 0·spine OK) · 각 5/5 settled·iso·복구 |
| [0342–0349](reviews/review-0341-0350.md) | 실 다운스트림 클라 수렴 sub-arc(#9 후속): DownClient 수신(0342)·상호 가시 zoneAuthSig(0343)·손실 하 수렴(0344)·교차 관찰자 일치(0345)·capstone convergedTo(0346)·수신 버퍼 유계 K(0347)·late-join keyframe(0348)·대시보드 downstreamReport(0349) | 통과(reg 0·spine OK) · 각 5/5 desync0 |
| [0350](step-0350.md) | 월드 다운스트림 grand capstone(#9 후속): downstreamWorldCoherent(모든 존 downstreamCoherent[포착]&&downstreamSettled[전파]) + 다중 존·손실·migrate·late-join 뒤 worldCoherent && 모든 실 DownClient convergedTo[desync0] && isolated·host→게이트웨이→실 클라 E2E·월드 다운스트림 0319~0350 닫기·읽기 전용 비트 동일 | 통과(reg 0·spine OK) · worldcap 5/5 world·수렴·iso |
| [0351–0360](reviews/review-0351-0360.md) | #57 실 host.js OS 프로세스 spawn — 드라이버 계약+실 spawn sub-arc: hostSpawnPlan(0351)·델타(0352)·clusterDriver 훅(0353)·roster(0354)·frame(0355)·egress(0356)·ClusterHostDriver 번역+flush(0357)·실 child_process 존 인스턴스화(0358)·zoneadd 다중 존(0359)·capstone clusterHostsCoherent+실 다중 host(0360) | 통과(reg 0·spine OK) · 각 5/5·실 host.js 2 프로세스 A=[z1,z2]·B=[z3] |
| [0361](step-0361.md) | #57 실 데이터 평면 1: 실 host.js deliver E2E(onFrame frame 동봉·flush deliver→실 host.js {cmd:'deliver',items}→실 프로세스 zone.onMsg entity 적용·in-proc 권위와 desync 0) | 통과(reg 0·spine OK) · hostdeliverreal 5/5 실 a1 {x:5,y:5}==in-proc 권위 |
| [0362](step-0362.md) | #57 실 데이터 평면 2: 실 host.js zonedel(host.js zonedel cmd·flush stop→실 존 제거·다른 존 보존·in-proc running 정합) | 통과(reg 0·spine OK) · hostzonedelreal 5/5 placeStop z1→실 z2 만·running z2 |
| [0363](step-0363.md) | #57 실 데이터 평면 3: 실 host.js tick(tickZone→실 zone.onTick·pending move 적용 + view_delta egress 산출·실 a1 위치==in-proc 권위) | 통과(reg 0·spine OK) · hosttickreal 5/5 실 a1 {x:11,y:11}==in-proc·egress 1 |
| [0364](step-0364.md) | #57 실 데이터 평면 4: 실 host.js migrate 상태 보존(migrateZone snapshot→zoneadd→loadstate→zonedel·실 프로세스 경계 넘어 entity 무손실·release+acquire) | 통과(reg 0·spine OK) · hostmigratereal 5/5 z1 A→B·a1 {x:5,y:5} 보존·hostA none |
| [0365](step-0365.md) | #57 실 데이터 평면 5: 실 host.js killHost(child_process SIGKILL·livePids 2→1) + failoverZone(죽은 host 존을 생존 host 새 인스턴스 재가동·상태 소실 정직한 한계) | 통과(reg 0·spine OK) · hostkillreal 5/5 kill 2→1·failover z1→hostB·a1 소실 |
| [0366](step-0366.md) | #57 실 데이터 평면 6: reconcile(plan,cluster,specOf)·orch hostSpawnPlan 목표에 실 cluster spawn/zoneadd/killHost 수렴·상태 기반 집행 표준 reconcile | 통과(reg 0·spine OK) · hostreconcilereal 5/5 plan→실 hostA[z1,z3]·hostB[z2]·live2 |
| [0367](step-0367.md) | #57 실 데이터 평면 7: 실 다중 host 격리(hostEntities 헬퍼·실 host 존별 entity·교차 누수 0·실 프로세스 경계가 격리 강제) | 통과(reg 0·spine OK) · hostisoreal 5/5 hostA={z1:[a1]}·hostB={z2:[b1]}·누수0 |
| [0368](step-0368.md) | #57 실 데이터 평면 8: driveCluster 통합 E2E(#62 runMulti analog·reconcile+deliver 재생+전 존 tick 한 호출·orch 드라이버가 실 cluster 전체 데이터 평면 구동) | 통과(reg 0·spine OK) · hostdrivereal 5/5 2 host a1{x:9,y:9}·b1{x:10,y:5}==in-proc·views2 |
| [0369](step-0369.md) | #57 실 데이터 평면 9: clusterDesync 정합 술어(실 host entity 위치 vs in-proc 권위 양방향 불일치 수·desync 0=수렴·ghost 주입 검출로 by-construction 아님) | 통과(reg 0·spine OK) · hostdesyncreal 5/5 정상 0·ghost 주입 1 |
| [0370](step-0370.md) | #57 실 데이터 평면 10·grand capstone: clusterCoherent(clusterDesync==0)·2 host·3 zone driveCluster→전 entity 실 host==권위·실 migrate 상태 보존·release·실 데이터 평면 0361~0370 닫기 | 통과(reg 0·spine OK) · clusterdatacap 5/5 coherent·migrate 보존·release |
| [0371–0380](reviews/review-0371-0380.md) | #62 runMulti 통합·broker 측 제어 평면 상주(`cluster-coord.js` ClusterCoordinator): 골격+start(0371)·tick(0372)·연속 run 루프(0373)·매-tick desync 가드(0374)·상주 migrate(0375)·상주 failover(0376)·syncPlan 비파괴 자가 치유(0377)·egress 집계(0378)·report(0379)·capstone coordCoherent(0380) | 통과(reg 0·spine OK) · coordcap 5/5 maxDesync0·drift 치유·coordCoherent·report coh |
| [0381](step-0381.md) | #65 양방향 동기 1: 코디네이터 placement SSOT(zone→실 host·where 권위·start 가 hostSpawnPlan 초기화·placedHost 질의·orch=entity 권위 분리) | 통과(reg 0·spine OK) · coordplace 5/5 placement z1@A·z2@B·z3@A==orch plan |
| [0382](step-0382.md) | #65 양방향 동기 2: coordDesync()=placement 권위로 host 조회+orch entity 권위(zoneEntityPos·host-무관) 양방향 대조(stale orch plan 무관) | 통과(reg 0·spine OK) · coorddesync2 5/5 coordDesync0==clusterDesync0 |
| [0383](step-0383.md) | #65 양방향 동기 3: migrate 가 this.placement[zone]=to 갱신(핵심 fix)→coordDesync 새 host 조회·migrate 후 desync 0 | 통과(reg 0·spine OK) · coordmigsync 5/5 placedHost hostB·coordDesync0 vs clusterDesync1(orch stale) |
| [0384](step-0384.md) | #65 양방향 동기 4: run 가드·coordCoherent 가 coordDesync(placement 기준) 채택→migrate 포함 연속 루프·capstone 정합 | 통과(reg 0·spine OK) · coordmigcap 5/5 run5+migrate→maxDesync0·coordCoherent Y |
| [0385](step-0385.md) | #65 양방향 동기 5: failover 가 placement[zone]=toHost 갱신+lostZones 기록(상태 소실 #63 명시 추적) | 통과(reg 0·spine OK) · coordfosync 5/5 z1·z3→hostB·lostZones={z1,z3} |
| [0386](step-0386.md) | #65 양방향 동기 6: coordDesync 가 lostZones reverse 부재(비자발 손실) 제외·forward ghost 검사 유지 | 통과(reg 0·spine OK) · coordfocoh 5/5 failover 후 desync0·ghost 주입 desync1 |
| [0387](step-0387.md) | #65 양방향 동기 7: placement-aware report(hosts/zones/coordDesync/lost 기준)→migrate/failover 후 대시보드 정합 | 통과(reg 0·spine OK) · coordreport2 5/5 migrate 후 hosts2·zones3·ents2·desync0·coherent |
| [0388](step-0388.md) | #65 양방향 동기 8: syncPlan 이 placement(실 위치) 기준 차분(orch plan stale 무관)→migrate 후 옳은 host 복원 | 통과(reg 0·spine OK) · coordsync2 5/5 migrate z3→drift→syncPlan hostB 복원·hostA 미복원·desync0 |
