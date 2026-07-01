# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~6은 step 닫을 때 **덮어쓴다**(누적 금지)·§7 INDEX만 **literal 1줄** append. 발견/한계 전문은 `step-NNNN.md`. 누적 함정 금지: §5 step별 재나열 금지(현재 마커+핵심 step)·§3 ✅격차 한 줄로·§4 반복 참조 불변만. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0447](step-0447.md) — **#4 실 net.step 배리어 치환 7**: `async-net.driveAsyncReplicas` — M 복제가 receive/tick 분리·서로 다른 페이스(1·2·3보)로 굴러 진행 skew>0(비-lockstep)이어도 최종 실 월드 digest == canonical. 중앙 배리어(동기 tick) 제거 후에도 페이스 무관 desync 0. run() 미호출 → reg 구조적 0.
- **한 줄 상태**: reg ALL OK·netpace 5/5(skew12~28·==canonical·desync 0)·async-net.js 10.5KB·박스 >30KB 0개·spine ALL OK.
- **다음**: 🎯 **#4 실 net.step 배리어 치환 arc(0441~0450 진행 중)**: 실 Net-형 intent 스트림+스탬프(0441 ✅)→sim fold(0442 ✅)→holdback 재정렬(0443)→실 actor 디스패치(0444)→손실 resync(0445)→복제 수렴 desync0(0446)→배리어-free 진행(0447)→exactly-once 회계(0448)→lockstep 보장 등가(0449)→grand capstone(0450). async-net 는 run() 밖 substrate → 매 step reg 구조적 0. **후속**: 실 net.step 배리어 *실제 치환*(이 arc 는 in-proc 등가 증명 먼저)·실 host.js child 업스트림(#70·#57 짝)·#68/#69 경미.

---

## 2. NEXT — 가설 (후보, 권위는 이 절)

> 🎯 **#4 실 net.step 배리어 치환 arc(0441~0450)** — async-core(0431~0440)가 *추상 이벤트*로 증명한 substrate 를 **실 engine Net 메시지 형태**(client→zone intent·from/to/payload)·**동결 sim seam(DummySimCore)**에 잇는다. 신규 박스 `async-net.js`: 실 Net-형 intent 스트림+스탬프(0441 ✅)→sim fold(0442 ✅)→holdback 재정렬(0443 ✅)→실 actor.onMsg 디스패치(0444 ✅·net.step 배달 절반 치환)→손실 resync(0445 ✅)→M 복제 수렴 desync0(0446 ✅)→배리어-free 진행(0447 ✅)→exactly-once 회계(0448)→lockstep *보장* 등가(0449·실 engine Net 배리어 대조)→grand capstone(0450). DownClient/UpClient·async-core 처럼 *in-proc 등가 먼저*, 실 net.step 배리어 *실제 치환*은 후속 arc. **매 step reg 구조적 0**(async-net run() 미호출).
> **설계 제약**: spine 게이트는 `verify.js all`. async-net 은 run() 경로가 호출하지 않는 검증 전용 박스 → run() 비트 불변 → reg 0(net-core 는 require 1줄만 추가). substrate 원시는 async-core 재사용(복제 금지)·sim fold 는 engine DummySimCore(동결 seam) 사용.

**후속 백로그**: ⒜ #4 substrate 실 net.step 배리어 치환(0431~0440 in-proc 다음 arc)·⒝ 실 host.js child 업스트림(#70·#57 짝)·금고↔가방 escrow·per-producer ack·버스 라우팅 영속·#68/#69 경미. **⛔ "C++ 시뮬 코어"는 백로그에 없다**(범위 밖·§4). 방향 권위 = `infra-review`.

**빌드 인프라 — `engine/` 공유 커널 + `src/` 단일 소스(0049)**: `engine/`=VM·PRNG·FNV·Net·verify-kit(추가만)·close-step·new-step. **절차**: ①new-step ②닿는 박스 Edit+verify 새 모드 ③close-step ④델타 커밋+git tag. NETPREV=`../baseline` 고정.

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| ⛔범위밖 | **C++ 시뮬 코어 (HktInfra 과제 아님)** | 월드 | 결정론 시뮬 *내부 구현*은 범위 밖 — `ISimCore` 뒤 블랙박스·HktGameplay 소관·더미 stub 영구(§4·[SPINE](SPINE.md) §0). |
| ✅ | **#56 브리지 존 데이터 평면** | 코디네이션/월드 | 0281~0290 해소(enter/move/leave·migrate 무손실·단일 소유·entityFlowCoherent). |
| 🟡 | **#9 멀티프로세스 배선 (직접 라우팅·host 컨테이너·월드 다운스트림 E2E·#57 실 spawn+데이터 평면 ✅)** | 코디네이션/엣지 | 0291~0350 직접 라우팅·host 컨테이너·월드 다운스트림 E2E · **#57 ✅(0351~0370 드라이버+실 spawn+실 데이터 평면·clusterCoherent desync 0)**. 남은 것: cluster-run.js runMulti 코어 orch 상주·연속 tick 루프·업스트림 실 클라(#61). |
| 🟡 | **비동기 실행 아래 결정론 (#4·lockstep 배리어 해제)** | 코디네이션 | **#4 in-proc substrate ✅(0431~0440·`async-core.js`)** + **실 Net 메시지·sim seam 브리지 진행(0441~·`async-net.js`)**: 추상 substrate(Lamport·holdback·전순서·resync·회계)를 실 engine Net 메시지 형태·동결 DummySimCore 에 잇는 중(0441 스트림+스탬프 ✅). 남은 것: sim fold/디스패치/복제 수렴/등가(0442~0450)·그 뒤 실 `net.step` 배리어 *실제 치환*. |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정검증·대기열·만료(0001). |
| 🟡 | **다중 클라 결정론 *전파*·예측 (업스트림 실 클라 ✅ in-proc)** | 월드 | 다운스트림 실 DownClient(0342~50·desync 0) + **업스트림 실 UpClient(0421~30·#61·자기 plan intent 발신·자기 뷰 수신·다중 인터리빙·손실 수렴·desync 0)**. 남은 것: 실 host.js child 경계 업스트림(#57 짝). |
| ⬜ | **서버간 인증 없음** | 버스 | 존이 게이트웨이 발신 암묵 신뢰(0001). |
| 🟡 | **버스 단일점·분산·영속** | 버스 | 동적구독/failover/무손실/lease/self-healing ✅(0016~61). 남은 것: 라우팅 영속·다중 브로커·per-producer ack. |
| 🟡 | **서비스 영속·failover (가방·채팅·파티·길드 ✅·버스 ⬜)** | 서비스/데이터 | 저널+압축+write-behind(0017~0184). 버스 라우팅 영속 0. |
| 🟡 | **거래소·우편·랭킹·길드·길드 금고 ✅** | 서비스 | 거래소(0107~40)·우편(0142~80)·길드(0181~90·로스터/마스터십/이양)·길드 금고(0191~0200·공유 원장/예치/인출/영속/정합) 동형. 금고↔가방 escrow 후속. |
| 🟡 | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | 프레즌스 박스·귓속말/파티 라우팅(0064~106). 남은 것: cluster kill→replay·존 배치·부하 분산. |
| 🟡 | **캐시 + write-behind 영속 (저널+압축·홉 신뢰·failover/quorum/윈도 ✅)** | 데이터 | PersistStore+압축·홉 신뢰→quorum→윈도(0017~0032). fsync 0·월드 영속 0. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속서 뷰/권위 재구성. |

> **✅ 해소된 격차** — 전문은 §7 INDEX·각 `step-NNNN.md`. 묶음: 골격~전송·AOI~failover·게임서비스+영속+quorum·버스·프레즌스/귓속말/파티·거래소/우편·길드(01~200).

> **상시 렌즈 — 척추** ([SPINE.md](SPINE.md) §5): 매 step은 verify 4기둥 + 척추 5항(①tick ②결정론 ③권위 단일 ④은닉 ⑤headless). 분리 기준: *존 tick 과 같은 박자로 돌아야 하는가?*

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
- **⛔ Sim = HktInfra 범위 밖(이음새 뒤 블랙박스)**: 존 시뮬 *내부 구현*은 동결 `ISimCore` 뒤·**HktGameplay(C++ HktCore) 소관**. HktInfra 는 더미 stub 으로 *전파 배선*만 검증(C++ 화는 숙제 아님)·이음새로 intent 넘기고 결과 이벤트를 클라에 전파. (반복 오해 금지 — [SPINE.md](SPINE.md) §0.)
- **headless·원격 검증(전송·전파 서버, 협상 불가)**: HktInfra 가 *짓는* 박스(전송·전파)는 UE·GUI 없이 headless·원격(CI)서 검증(더미=Node 자명). 시뮬 *내부*의 headless 빌드·UObject 0 순수성은 통과 조건 아님(이음새 뒤 HktGameplay 소관).
- **수치 = verify 출력**: 모든 문서 수치는 시드 [42, 7, 1234, 99, 2026] 평균으로 재현.
- **코어 netcode 불변(HktInfra 가 *지키되 시뮬 코어는 안 짓는다*)**: 서버 권위(클라 읽기전용) · ISP 3-Layer · 시뮬 상태 직접쓰기 금지(intent 경유). 인프라는 *확장*하되 *깨지 않는다*. (시뮬 코어 결정론·UObject 0 순수성 = 이음새 뒤 HktGameplay 불변·HktInfra 는 존중만.)
- **한 step = 한 조각**: 더 떠올라도 다음으로 전가. 새 코어는 직전 코어를 잇고 박스/계약 하나만 더한다.
- **도구 = tick 판정 + 원격-검증** ([TOOLS.md](TOOLS.md)): 그 외 전송·전파 박스는 원격 빌드·헤드리스 검증 도구(Go·Node·컨테이너). tick 동기 결정론 시뮬 코어(C++)는 이음새 뒤 HktGameplay 소관·HktInfra 도구 결정 밖(⛔ 범위 경계).
- **데이터 3분할** ([TOOLS.md](TOOLS.md) §3): ① 월드 영속=intent 로그+스냅샷 ② 트랜잭션 진실(가방·계정)=PostgreSQL→분산 SQL ③ Redis=휘발/캐시. 월드 상태를 DB 행으로 저장하지 않는다.

---

## 5. 6계층 진행 현황 ([SPINE.md](SPINE.md) §6)

| # | 계층 | 박스 | 상태 (현재 마커 + 핵심 step) |
|---|------|------|------|
| 1 | 엣지 | 로그인/인증 · 게이트웨이 | 🟡 스텁(일회 티켓·단일 연결·은닉 0001)+별 OS 프로세스(0010)+GW producer ns(0046) · **로그인 큐 🟡 대기열+발급+만료+백프레셔+재접속+계정검증+큐이탈(0209~0230)**. 게이트웨이 군 풀 후속 |
| 2 | 월드 | 존 · 인스턴스 (분할·AOI·조정·핸드오프) | 🟡 존 VM+결정론 복제+AOI+분할·핸드오프(소유자=1)+failover+별 프로세스(0001~13) · **인스턴스 🟡 spawn/despawn+수요 자동 spawn/despawn+라우팅+이탈(0201~0222)**. 존 N개 후속 |
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 가방/채팅/ranking/읽기모델+write-behind/quorum(0014~63)·귓속말/파티(0071~106)·거래소(0107~40)·우편(0142~80) 동형(escrow/3leg/saga)·길드+금고(0181~0200·로스터/마스터십/공유 원장/영속/정합). 금고↔가방 escrow 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 substrate→토픽 pub/sub→ServiceBus→동적구독/failover/무손실/replay 유계·ack 자기조정/min-wm/lease·ns·lifecycle·적응형(0004~0054). 분산·per-producer ack·라우팅 영속 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 레지스트리+Orchestrator+broker(0001~13)·프레즌스 SSOT·self-healing·epoch 펜싱(0054~106). 존 배치: advisory→executed SSOT #51→실 zone.js 브리지 #51b·#56 entity 데이터 평면·#9 직접 라우팅·실 host.js 컨테이너·부하 균형·월드 다운스트림 E2E(0241~0350·downstreamWorldCoherent). **#57 실 OS 프로세스 spawn+데이터 평면(0351~70·clusterCoherent) + #62 broker 측 상주 코디네이터(0371~80) + #65 placement 양방향 동기(0381~90) + #66/#67 tick placement-aware·orch 이중 권위(0391~400·unifiedCoherent) + #62 runMulti 복원력 코드 합류(0401~20·cluster-run.js 단일 진입점)**. **#4 async substrate(0431~40·async-core.js) + 실 Net·sim seam 브리지(0441~·async-net.js·run() 밖)**. orch 정리·도구 #43(0271) |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 PersistStore(효과 저널·write-behind·kill→replay)→스냅샷 압축→복구→홉 신뢰→failover/N-replica quorum→윈도(0017~0062) · **캐시 🟡 set/get·read-through·TTL·무효화·LRU+Redis-like 4차(0205~0260·write-through/bulk/SETNX/SETEX/prefix/coherent)** · **월드 영속 🟡 intent 로그·replay·스냅샷·crash/recover·write-behind·fsync barrier(0207~0228)**. 버스 영속 후속 |

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
| [0319–0350](reviews/review-0341-0350.md) | 월드 다운스트림 데이터 평면 E2E(#9 후속): 포착(0319~0330·AOI 산출→증분 델타/격리/이주 연속/무손실·downstreamCoherent)→전파(0331~0341·egress/dseq/ack/gap·타임아웃 재전송/격리·downstreamSettled)→실 DownClient 수렴(0342~0349·desync0/late-join keyframe)→grand capstone downstreamWorldCoherent(0350·host→게이트웨이→실 클라 E2E·#60 해소) | 통과(reg 0·spine OK) · worldcap 5/5 |
| [0351–0360](reviews/review-0351-0360.md) | #57 실 host.js OS 프로세스 spawn — 드라이버 계약+실 spawn sub-arc: hostSpawnPlan(0351)·델타(0352)·clusterDriver 훅(0353)·roster(0354)·frame(0355)·egress(0356)·ClusterHostDriver 번역+flush(0357)·실 child_process 존 인스턴스화(0358)·zoneadd 다중 존(0359)·capstone clusterHostsCoherent+실 다중 host(0360) | 통과(reg 0·spine OK) · 각 5/5·실 host.js 2 프로세스 A=[z1,z2]·B=[z3] |
| [0361–0370](reviews/review-0361-0370.md) | #57 실 host.js 데이터 평면 10조각: deliver(0361)·zonedel(0362)·tick/egress(0363)·migrate 상태보존(0364)·killHost+failover(0365)·reconcile(0366)·격리(0367)·driveCluster(0368)·clusterDesync(0369)·capstone clusterCoherent(0370·2 host·3 zone·migrate desync 0) | 통과(reg 0·spine OK) · clusterdatacap 5/5 coherent·migrate 보존·release |
| [0371–0380](reviews/review-0371-0380.md) | #62 runMulti 통합·broker 측 제어 평면 상주(`cluster-coord.js` ClusterCoordinator): 골격+start(0371)·tick(0372)·연속 run 루프(0373)·매-tick desync 가드(0374)·상주 migrate(0375)·상주 failover(0376)·syncPlan 비파괴 자가 치유(0377)·egress 집계(0378)·report(0379)·capstone coordCoherent(0380) | 통과(reg 0·spine OK) · coordcap 5/5 maxDesync0·drift 치유·coordCoherent·report coh |
| [0381–0390](reviews/review-0381-0390.md) | #65 양방향 동기·코디네이터 placement 권위(where) SSOT: placement SSOT(0381)·coordDesync(0382)·migrate/failover placement 갱신+lost(0383~86)·placement-aware report/syncPlan(0387~88)·placementCoherent bijection(0389)·capstone syncedCoherent(0390·migrate/failover 포함) | 통과(reg 0·spine OK) · coordsyncedcap 5/5 syncedCoherent Y·coordDesync0 |
| [0391–0400](reviews/review-0391-0400.md) | #66 tick placement-aware(0391~93)+#67 orch 이중 권위 합류(0394~98): tick/deliver placement 순회·mid-run migrate 발현·orchWhere/authoritiesAgree·migrate/failover where write-back·통합 unifiedCoherent(0399)·grand capstone(0400) | 통과(reg 0·spine OK) · coordunifiedcap 5/5 unified Y·maxDesync0 |
| [0401–0410](reviews/review-0401-0410.md) | #62 runMulti 합류·복원력 코어 승격: 펜싱(0401)·silence(0402)·restart(0403)·정리(0404)·reprovision+mirror(0405~06)·clusterInfo(0407)·runScenario(0408)·promoteStandby(0409)·capstone runMultiCoherent(0410) | 통과(reg 0·spine OK) · coordmulticap 5/5 runMultiCoherent Y·a1 보존 |
| [0411–0420](reviews/review-0411-0420.md) | #62 코드 합류 — 코디네이터를 runMulti zone-cluster 복원력의 단일 진입점으로: coordSetup(0411)·coordScenarioFromOpts(0412)·runMultiViaCoord(0413)·clusterInfo parity(0414)·equivalence(0415)·warm-failover/fence/restart 번역(0416~18)·runMulti OFF-게이트 위임(0419)·capstone(0420) | 통과(reg 0·e2e OK·spine OK) · coordmergecap 5/5 runMultiCoherent Y·mig/reprov/promo 1·a1 보존 |
| [0421](step-0421.md) | #61 업스트림 실 클라 1: UpClient(발신 액터·kind 'upclient')·onTick joinAt zoneEnter 발신·topo 배선·upClients OFF→reg 0 | 통과(reg 0·spine OK) · upclient 5/5 uc0 zoneEnter 발신·a1@z1 {5,5} |
| [0422](step-0422.md) | #61 업스트림 실 클라 2: UpClient.onTick plan 한 발씩 zoneMove 발신(클라가 자기 plan 으로 intent 생성) | 통과(reg 0·spine OK) · upmove 5/5 a1 {9,8}==enter(5,5)+Σplan |
| [0423](step-0423.md) | #61 업스트림 실 클라 3: UpClient 양방향(onMsg view→seen·DownClient 동형)·세션→uc0 바인딩→자기 AOI 뷰 수신 | 통과(reg 0·spine OK) · uprecv 5/5 sent3+deltas3·seenSig a1@9,8 |
| [0424](step-0424.md) | #61 업스트림 실 클라 4: 수렴 desync 0(uc0.seenSig==orch.zoneAuthSig·convergedTo·발신→권위 반영→뷰 수렴)·검증 전용 | 통과(reg 0·spine OK) · upconverge 5/5 seenSig==authSig a1@9,8·converged Y |
| [0425](step-0425.md) | #61 업스트림 실 클라 5: UpClient ≡ 합성 entityOps 동치(같은 plan→같은 최종 권위 위치·둘 다 수렴·실 클라가 합성 대체) | 통과(reg 0·spine OK) · upvsscript 5/5 up a1=={script} {9,8}·uc0·dc0 수렴 |
| [0426](step-0426.md) | #61 업스트림 실 클라 6: 다중 UpClient 인터리빙(uc0=a1@z1·uc1=b1@z2 동시 발신·각자 자기 존 권위 수렴·desync0) | 통과(reg 0·spine OK) · upmulti 5/5 uc0·uc1 수렴·a1@z1 {7,7}·b1@z2 {8,6} |
| [0427](step-0427.md) | #61 업스트림 실 클라 7: UpClient.leaveAt(zoneLeave 발신·접속 생애주기 enter→move→leave 완결) | 통과(reg 0·spine OK) · upleave 5/5 sent4→a1 제거 |
| [0428](step-0428.md) | #61 업스트림 실 클라 8: 손실 하 수렴(egress 손실→gap-resync→uc0 desync0·손실 진짜 gaps≥1+복구 resyncs≥1)·검증 전용 | 통과(reg 0·spine OK) · uplossy 5/5 gaps1·resyncs1·uc0 수렴 |
| [0429](step-0429.md) | #61 업스트림 실 클라 9: 업스트림 회계(UpClient.intentLog/intentDelta·발신 intent==권위 반영·발신 손실 0) | 통과(reg 0·spine OK) · upaccount 5/5 intentLog4==sent·{9,9}==enter+Δ |
| [0430](step-0430.md) | #61 업스트림 실 클라 10·grand capstone: 양방향 실 클라 E2E(발신→게이트웨이→존→egress→수신 desync0·생애주기·보존·발신 회계)·0421~0430 닫기 | 통과(reg 0·spine OK) · upe2ecap 5/5 uc0 수렴·a1 체류·b1 제거·보존 Y |
| [0431](step-0431.md) | #4 진짜 비동기 1: 신규 박스 async-core.js Lamport 논리 클럭 원시(makeLamportClock·local/send/recv·clock condition)·run() 미호출 reg 구조적 0 | 통과(reg 0·spine OK) · lcstamp 5/5 스탬프 1..K 단조 |
| [0432](step-0432.md) | #4 진짜 비동기 2: lamportExchange(N site 교환→이벤트 로그+happens-before 간선)·clockConditionViolations | 통과(reg 0·spine OK) · lcrecv 5/5 clock condition 위반 0 |
| [0433](step-0433.md) | #4 진짜 비동기 3: totalOrder(키 (lc,siteIndex))·totalOrderSound — 전순서=내용 함수·순열 불변·엄격·인과 존중 | 통과(reg 0·spine OK) · lcorder 5/5 8 순열 동일 전순서 |
| [0434](step-0434.md) | #4 진짜 비동기 4: makeHoldback(교차-site 재정렬·FIFO·low-water-mark 안정성 점진 방출) | 통과(reg 0·spine OK) · lcreorder 5/5 인터리빙 불변·close前 방출>0 |
| [0435](step-0435.md) | #4 진짜 비동기 5: causalDeliver(deps=happens-before 선행 충족 방출·FIFO-free)·causalViolations | 통과(reg 0·spine OK) · lccausal 5/5 적대적 도착 위반0·stuck0 |
| [0436](step-0436.md) | #4 진짜 비동기 6: applyDigest(배달열 순차 fold→상태 다이제스트) — 두 site 상이 도착→desync 0 수렴 | 통과(reg 0·spine OK) · asyncconv 5/5 desync 0·정전 일치 |
| [0437](step-0437.md) | #4 진짜 비동기 7: makeAsyncSite(receive/tick 분리) — 복제 불균등 속도(비-lockstep)·페이스 무관 수렴 | 통과(reg 0·spine OK) · asyncprogress 5/5 skew>0·desync 0 |
| [0438](step-0438.md) | #4 진짜 비동기 8: withSseq·makeResyncSite(연속분만 holdback·hole 감지·재전송) — 손실 하 수렴 | 통과(reg 0·spine OK) · asynclossy 5/5 손실→재전송→desync 0 |
| [0439](step-0439.md) | #4 진짜 비동기 9: accountDelivered(emitted/applied/dups/missing/complete) — 순열+손실 exactly-once·다이제스트 불변 | 통과(reg 0·spine OK) · asyncaccount 5/5 complete·digInv |
| [0440](step-0440.md) | #4 진짜 비동기 10·grand capstone: asynce2ecap — M 복제 순열+손실→clock0·전복제 desync0·인과존중·exactly-once·0431~0440 닫기 | 통과(reg 0·spine OK) · asynce2ecap 5/5 |
| [0441](step-0441.md) | #4 실 net.step 배리어 치환 1: 신규 `async-net.js`·worldIntentStream — 다중 client 실 Net-형 intent+Lamport 스탬프·program 간선·run() 밖 reg 구조적 0 | 통과(reg 0·spine OK) · netintent 5/5 lc단조·clock0·재현 |
| [0442](step-0442.md) | #4 실 net.step 배리어 치환 2: async-net.simFold — 배달 순서대로 동결 sim seam DummySimCore 에 fold·totalOrder 정규화 순열 불변·raw 도착 갈림(substrate load-bearing) | 통과(reg 0·spine OK) · netsimfold 5/5 순열불변·raw갈림 |
| [0443](step-0443.md) | #4 실 net.step 배리어 치환 3: async-net.makeZoneMailbox — 교차-client 재정렬 스트림 수신·holdback 점진 방출·인터리빙 불변·simFold 수렴 | 통과(reg 0·spine OK) · netreorder 5/5 sig불변·수렴·close前16~32 |
| [0444](step-0444.md) | #4 실 net.step 배리어 치환 4: async-net.makeZoneActor·deliverToActor — net.step 배달 절반 치환·실 actor.onMsg→동결 sim·상태==canonical | 통과(reg 0·spine OK) · netdispatch 5/5 actor==canonical·applied40 |
| [0445](step-0445.md) | #4 실 net.step 배리어 치환 5: async-net.makeZoneResync — per-client sseq gap-resync·실 전송 손실 복원·손실+재정렬에도 simFold 수렴 | 통과(reg 0·spine OK) · netlossy 5/5 수렴·gaps≥10·resyncs≥4 |
| [0446](step-0446.md) | #4 실 net.step 배리어 치환 6: async-net.convergeReplicas — M 복제 존 상이 순열+손실→배리어 없이 전 복제 실 월드 desync 0·==canonical | 통과(reg 0·spine OK) · netconverge 5/5 desync 0 |
| [0447](step-0447.md) | #4 실 net.step 배리어 치환 7: async-net.driveAsyncReplicas — receive/tick 분리·독립 페이스 skew>0(비-lockstep)에도 전 복제 ==canonical | 통과(reg 0·spine OK) · netpace 5/5 skew12~28·desync 0 |
