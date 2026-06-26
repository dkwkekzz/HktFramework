# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~6은 step 닫을 때 **덮어쓴다**(누적 금지)·§7 INDEX만 **literal 1줄** append. 발견/한계 전문은 `step-NNNN.md`. 누적 함정 금지: §5 step별 재나열 금지(현재 마커+핵심 step)·§3 ✅격차 한 줄로·§4 반복 참조 불변만. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0330](step-0330.md) — **#9 후속 capstone: 다운스트림 데이터 평면 전 정합 `downstreamCoherent`** (zoneViewConserved && zoneViewAllKeyed && serializable). 혼합 lifecycle(enter/move/leave/migrate) 뒤 두 존 downstreamCoherent + hostProcCoherent + entityConserved·total 2 → **downstream sub-arc 0319~0330 닫기**. 읽기 전용·0329 비트 동일.
- **한 줄 상태**: reg ALL OK·downstreamcap 5/5(dc1·dc2·hpcoh·consv·total2)·`run.js all` ALL OK·spine ALL OK.
- **다음**: 🎯 **downstream 데이터 평면 sub-arc(0319~0330 ✅ 닫힘)** — host 프로세스 AOI 뷰 *산출·포착·정확성*(AOI/증분/상호 가시/exit/직렬화/격리/이주 연속성/무굶김/무손실 회계/capstone). 부하 균형 sub-arc(0311~0318 ✅) 위에. **후속**: ⒜ 게이트웨이→실 클라 전파(재전송/ack·실 클라 하니스) ⒝ 실 host.js *OS 프로세스/소켓* spawn(cluster-run.js 통합) ⒞ 진짜 비동기(#4·논리클럭)·버스 라우팅 영속. 🔎 **0291~0300·0301~0310·0311~0320·0321~0330 묶음 리뷰 적기 — 미실시(4묶음 누적)**.

---

## 2. NEXT — 가설 (후보, 권위는 이 절)

> 🎯 **실 host.js 물리 프로세스 분리 arc(0301~0310) ✅ 완료** — #9(0291~0300)이 데이터 평면을 게이트웨이 직접 라우팅으로 옮겼으나 zone-host 핸들은 여전히 orch 인프로세스 *flat* zoneRuntimes Map·host=문자열 태그였다. 이 arc 가 host 를 *1급 프로세스 컨테이너*(zoneHosts)로 분리: 0301 컨테이너 레지스트리(_hostSet)·0302 자기 inbox 수신+자기 루프 drain·tick·0303 단일소유/drift·0304 roster spawn/despawn·0305 정리 분할(orch-hostproc.js)·0306 inbox stale 거부(이중 쓰기 방지)·0307 host 프로세스 census·0308 hostContainerCoherent·0309 다중 churn bijection·0310 capstone(hostProcCoherent=directFlowCoherent && hostContainerCoherent). 각 플래그 OFF→직전 step 비트 동일(reg 0). **다음 = 실 host.js *OS 프로세스/소켓* spawn**(현 zoneHosts 는 orch 인프로세스 논리 컨테이너·cluster-run.js 실 spawn 통합 후속). 방향 권위 = `infra-review`(다음: 0291~0300·0301~0310 묶음 평결 — 2묶음 누적).

**후속 백로그 (다음 묶음 우선순위)**: ⒜ **#9 멀티프로세스 배선** — 0030 이후 박스 host.js 0, 게임서비스·데이터·코디네이션 계층 전부 인프로세스 전용. #51b 가 orch 추상 running→실 EntityZone 런타임 핸들까지 이었으므로(0272~0280), 다음은 그 핸들을 *실 프로세스*(host.js 소켓)로 분리. ⒝ **entity 트래픽의 실 zone.js 흐름**(#9 위·게이트웨이→실 존 런타임 enter/move 라우팅·이주 시 entity 무손실 실증) ⒞ 진짜 비동기(#4·논리클럭) + 금고↔가방 escrow·per-producer ack·버스 라우팅 영속. **⛔ "C++ 시뮬 코어"는 백로그에 없다**(범위 밖·§4·HktGameplay).

> **#51b 실 zone.js 브리지(0272~0280·완료)**: orch 가 placement 집행(_start/_migrate/_stop/_hostDown/_rebalance/_drain)으로 *실 EntityZone 인스턴스* lifecycle 을 구동(zoneRuntimes 레지스트리·orch-zonebridge.js 믹스인·팩토리 makeActor 주입). running 문자열 추상 SSOT↔실 핸들 정합(zoneRuntimeDrift·bridgeCoherent·fullyCoherent). migrate(상태 보존·같은 핸들) vs hostdown(소실·새 인스턴스) 의미 분리. zoneBridge OFF→전 step 비트 동일(reg 0). 잔여: 실 프로세스 분리(#9)·entity 트래픽.

**빌드 인프라 — `engine/` 공유 커널 + `src/` 단일 소스(0049)**: `engine/`=VM·PRNG·FNV·Net·ISimCore·verify-kit(추가만)·close-step·new-step. **절차**: ①new-step ②닿는 박스 Edit+verify 새 모드 ③close-step ④델타 커밋+git tag. NETPREV=`../baseline` 고정. 훅 inject(미제공=reg 0).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| ⛔범위밖 | **C++ 시뮬 코어 (HktInfra 과제 아님)** | 월드 | **결정론 시뮬 *내부 구현*은 HktInfra 범위가 아니다** — `ISimCore` 이음새 뒤 블랙박스·HktGameplay(C++ HktCore) 소관. HktInfra 는 이음새로 *이벤트만 받아 클라에 전파*. 더미 stub 은 영구 stub(C++ 화 숙제 아님). 반복 오해 금지 — [SPINE.md](SPINE.md) §0. |
| ✅ | **#56 브리지 존 데이터 평면 (entity 트래픽)** | 코디네이션/월드 | 0281~0290 해소: enter/move/leave·런타임 tick·migrate 무손실(행동적)·hostdown 소실·stop 폐기·단일 소유·정합·graceful census 보존·capstone(entityFlowCoherent·entityConserved). |
| 🟡 | **#9 멀티프로세스 배선 (게이트웨이 직접 라우팅 ✅ · host 프로세스 컨테이너 ✅ · 실 OS 프로세스 🟡)** | 코디네이션/엣지 | 0291~0300 직접 라우팅(seam·mailbox·디렉토리·enter/move/leave·이주/장애·dir bijection·directFlowCoherent). **실 host.js 물리 분리 arc 0301~0310 ✅**: host=1급 프로세스 컨테이너(zoneHosts·_hostSet)·자기 inbox 수신·자기 루프 tick·roster spawn/despawn·stale 거부(이중 쓰기 방지)·census·hostContainerCoherent·multi-churn bijection·capstone hostProcCoherent. **남은 것: 실 host.js *OS 프로세스/소켓* spawn**(현 zoneHosts=orch 인프로세스 논리 컨테이너·cluster-run.js 실 spawn 통합). |
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
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 레지스트리+Orchestrator+broker(lockstep→TCP→허브·kill·split-brain 0·0001~0013)·lease→프레즌스 SSOT→self-healing·공지 epoch 펜싱(0054~0106). broker 물리 분산·진짜 비동기 후속 · **오케스트레이터 존 배치 🟡 advisory(0203~0224)→실배선 #51 executed SSOT arc(0241~0250)→**#51b 실 zone.js 브리지(0272~0280·orch 가 placement 집행으로 실 EntityZone 런타임 lifecycle 구동·zoneRuntimes·start/migrate/stop/hostdown/rebalance/drain·읽기 경로·정합 capstone fullyCoherent)** 완료. **#56 브리지 존 데이터 평면 ✅(0281~0290·enter/move/leave·런타임 tick·migrate무손실/hostdown소실/stop폐기·단일소유·정합·graceful보존·capstone)**. **#9 멀티프로세스 배선 🟡(0291~0300·전송 seam·host mailbox·디렉토리·게이트웨이 직접 라우팅·directFlowCoherent)→실 host.js 물리 분리 arc ✅(0301~0310·host=1급 프로세스 컨테이너 zoneHosts·자기 inbox 수신·자기 루프 tick·roster spawn/despawn·inbox stale 거부·census·hostContainerCoherent·multi-churn bijection·capstone hostProcCoherent — 남은 것=실 OS 프로세스/소켓 spawn·cluster-run.js 통합)**. **host 프로세스 컨테이너 심화·부하 균형 sub-arc ✅(0311~0318·hostLoadSkew·생애주기 로그·다중 존/동시 host 장애·entity 가중 부하/자동 배치 placeAutoE/재배치 placeRebalanceE·균형 술어 hostBalanced)**. **#9 후속 downstream 데이터 평면 sub-arc ✅(0319~0330·SPINE §4 경로2 월드 다운스트림: host 산출 AOI 뷰 포착(no-op→버퍼링 싱크)·AOI/증분 델타/상호 가시/exit 정확성·직렬화 경계·존 격리·이주 연속성·무굶김·무손실 회계·capstone downstreamCoherent — 게이트웨이→실 클라 전파 후속)**. orch 정리(0251·0267·0305·0323 뷰 분할). 도구 #43(0271)** |
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
| [0311](step-0311.md) | host 프로세스 컨테이너 심화 1: 부하 불균형 질의 hostLoadSkew(전 host 컨테이너 존 수 분포 max−min·A 몰림 배치를 placeRebalance 로 균형·읽기 전용·0310 비트 동일) | 통과(reg 0·spine OK) · 5/5 skew0 2→skew1 ≤1·총존 4 보존·hostContainerCoherent |
| [0312](step-0312.md) | host 프로세스 컨테이너 심화 2: 생애주기 이벤트 로그 hostLifecycle(_hostSet spawn/despawn 순서 스트림·실 cluster.spawnOne/killHost 지점 씨앗·net 집합==가동 host·OFF 플래그 zoneHostLifecycle·0311 비트 동일) | 통과(reg 0·spine OK) · 5/5 spawn3·despawn1·net==live·sp−dp==hosts |
| [0313](step-0313.md) | host 프로세스 컨테이너 심화 3: 다중 존 host 장애 failover + 질의 hostZones(host)(hostA 2존·엔티티3 장애→두 존 생존 host 재가동·entity3 소실·z3 보존·hostZones(A)빈·despawn A·읽기 전용·0312 비트 동일) | 통과(reg 0·spine OK) · 5/5 total1·lost3·A빈·despawnA·hcoh·consv |
| [0314](step-0314.md) | host 프로세스 컨테이너 심화 4: entity 가중 부하 hostEntitySkew(부하를 존 수 아닌 entity 수로·존 수 균형이어도 entity 몰림 드러냄·읽기 전용·0313 비트 동일) | 통과(reg 0·spine OK) · 5/5 zoneSkew0 vs entSkew3·총 entity4 |
| [0315](step-0315.md) | host 프로세스 컨테이너 심화 5: 다중 동시 host 장애 + 질의 hostCount(2 host 각 2존 연속 down→4존 전부 마지막 생존 host·hostCount 3→1·despawn A·B·bijection·읽기 전용·0314 비트 동일) | 통과(reg 0·spine OK) · 5/5 hostCount1·C존4·despAB2·hcoh·bij |
| [0316](step-0316.md) | host 프로세스 컨테이너 심화 6: entity 가중 자동 배치 placeAutoE(_leastLoadedByEntities·hostEntityLoad·존 수 균형이어도 만원 host 회피·placeAuto 의 entity 가중 판·새 op 미수신이면 0315 비트 동일) | 통과(reg 0·spine OK) · 5/5 auto z3@A vs autoE z3@B·hcoh |
| [0317](step-0317.md) | host 프로세스 컨테이너 심화 7: entity 가중 재배치 placeRebalanceE(_rebalanceByEntities·entity 무거운 host→가벼운 host 존 이주·gap<2 까지·gap 단조 감소 종료·무손실·새 op 미수신이면 0316 비트 동일) | 통과(reg 0·spine OK) · 5/5 skew0 6→skew1 0·moves1·총 entity6 보존 |
| [0318](step-0318.md) | host 프로세스 컨테이너 심화 8·부하 sub-arc capstone: 균형 술어 hostBalanced(존 수·entity 불균형 둘 다 허용 안·entity 몰림 hostBalanced 전 false→placeRebalanceE→true·균형 후 conserved/coherent·읽기 전용·0317 비트 동일) | 통과(reg 0·spine OK) · 5/5 bal0 false→bal1 true·skew4→0·consv·hcoh |
| [0319](step-0319.md) | downstream 데이터 평면 1(#9 후속): host AOI 뷰 산출 포착(런타임 존 net 싱크 no-op→버퍼링·view/view_delta 보관·질의 zoneViewFrames/zoneViewsFor·SPINE §4 경로2 월드 다운스트림 씨앗·플래그 불요·0318 비트 동일) | 통과(reg 0·spine OK) · 5/5 viewFrames4·z1views4·미가동 0 |
| [0320](step-0320.md) | downstream 데이터 평면 2(#9 후속): host 산출 뷰의 AOI 정확성(질의 zoneViewBuf·zoneVisibleIds·a1·a2 반경 밖→각 세션 reset 뷰 enter==자기만·게이트웨이 발신·읽기 전용·0319 비트 동일) | 통과(reg 0·spine OK) · 5/5 a1→[a1]·a2→[a2]·match·toGW |
| [0321](step-0321.md) | downstream 데이터 평면 3(#9 후속): host 산출 뷰의 증분 델타 정확성(질의 zoneViewStats·a1 3회 이동→reset1+update3=total4≪14tick·매 tick 전체 아닌 변경분만·대역 절감·읽기 전용·0320 비트 동일) | 통과(reg 0·spine OK) · 5/5 reset1·update3·total4<14·updHasA1 |
| [0322](step-0322.md) | downstream 데이터 평면 4(#9 후속): host 산출 뷰의 상호 가시(질의 zoneViewEntered·a1 이 a2 쪽 이동→반경 안→서로 enter 델타·상호 가시·최종 vis 둘 다 [a1,a2]·읽기 전용·0321 비트 동일) | 통과(reg 0·spine OK) · 5/5 a1entered⊇a2·a2entered⊇a1·mutVis |
| [0323](step-0323.md) | 정리 분할: 다운스트림 뷰 질의 6종(0319~0322)→orch-views.js 믹스인(Object.assign 투명 분할·>30KB 트리거 유계화·orch-zonebridge 30.6KB→28.1KB·기능 0·0322 비트 동일) | 통과(reg 0·spine OK) · 분할 후 비트 동일·zoneviewsplit 5/5·박스 ≤30KB |
| [0324](step-0324.md) | downstream 데이터 평면 5(#9 후속): host 산출 뷰의 AOI exit 델타(질의 zoneViewExited·a1 접근 후 멀어짐→서로 exit·최종 vis 자기만·동적 가시 상실·읽기 전용·0323 비트 동일) | 통과(reg 0·spine OK) · 5/5 a1exit⊇a2·a2exit⊇a1·finVis 자기만 |
| [0325](step-0325.md) | downstream 데이터 평면 6(#9 후속): host 산출 뷰의 직렬화 경계(질의 zoneViewWire·산출 뷰 JSON round-trip 동일·와이어 바이트>0·소켓 준비·원격-검증 토대·_zoneDeliver 다운스트림 짝·읽기 전용·0324 비트 동일) | 통과(reg 0·spine OK) · 5/5 frames4·bytes440·serializable |
| [0326](step-0326.md) | downstream 데이터 평면 7(#9 후속): 다중 존 독립 다운스트림(질의 zoneViewSessions·z1·z2 동시→각자 자기 세션에만 뷰·존 간 누수 0·격리·읽기 전용·0325 비트 동일) | 통과(reg 0·spine OK) · 5/5 z1sess{a1,a2}·z2sess{b1}·noLeak |
| [0327](step-0327.md) | downstream 데이터 평면 8(#9 후속): host 이주 중 뷰 연속성(질의 zoneViewReport·z1 A→B 이주 같은 핸들·a1 이동 전후→update 4 연속·entity 보존·host B·serializable·읽기 전용·0326 비트 동일) | 통과(reg 0·spine OK) · 5/5 update4·total1·hostB·pos9,9·serializable |
| [0328](step-0328.md) | downstream 데이터 평면 9(#9 후속): 세션 무굶김(술어 zoneViewAllKeyed·모든 활성 세션이 초기 reset keyframe 받음·a1·a2·a3 enter→셋 다 keyed·no-starvation·읽기 전용·0327 비트 동일) | 통과(reg 0·spine OK) · 5/5 sessions3·allKeyed·resets1/1/1 |
| [0329](step-0329.md) | downstream 데이터 평면 10(#9 후속): 뷰 무손실 회계(술어 zoneViewConserved·모든 view frame 이 정확히 한 세션 귀속·고아 0·세션별 합==전체·읽기 전용·0328 비트 동일) | 통과(reg 0·spine OK) · 5/5 frames8==sumSess·consv |
| [0330](step-0330.md) | downstream 데이터 평면 11·capstone(#9 후속): 전 정합 downstreamCoherent(zoneViewConserved&&zoneViewAllKeyed&&serializable·혼합 lifecycle enter/move/leave/migrate 뒤 두 존 정합+hostProcCoherent+entityConserved·downstream sub-arc 0319~0330 닫기·읽기 전용·0329 비트 동일) | 통과(reg 0·spine OK) · 5/5 dc1·dc2·hpcoh·consv·total2 |
