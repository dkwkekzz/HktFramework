# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~6은 step 닫을 때 **덮어쓴다**(누적 금지)·§7 INDEX만 **literal 1줄** append. 발견/한계 전문은 `step-NNNN.md`. 누적 함정 금지: §5 step별 재나열 금지(현재 마커+핵심 step)·§3 ✅격차 한 줄로·§4 반복 참조 불변만. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0501](step-0501.md) — **#16 라운드 4차 1: mailsagatransient — 완전 saga liveness *손실 체제* 편입 시작**: 우편 saga 를 내장 손실 seam `mailAckDrop`(1회 드롭)+autoRetry 로 구동해 *실제 회신 손실*을 주입, 재전송 자가 치유(pending 0 drain·gives==acked·retries≥1) 를 verify-kit ORDER 편입. 공용 하니스 `runMailLoss` 추가. 박스 무수정→reg 0.
- **한 줄 상태**: reg ALL OK·mailsagatransient 5/5·spine ALL OK.
- **다음**: 🎯 **#16 라운드 4차 arc(0501~0510 진행 중)** — 0491~0500 서비스 capstone 이 *행복 경로*(pending/abandon/permFailed 0 자명)만 봤던 sagaLivenessConsistent 를 손실 하 비자명 검증. 남은 조각: unacked(0502)·abandon(0503)·abandonpub(0504)·readmit(0505)·readmitpub(0506)·permfail(0507)·failpub(0508)·3way grand(0509)·promotedsagaloss 가드(0510). **arc 후 후속**: ⒝ #74 실 GW ⒞ #46 금고↔가방 escrow ⒟ #75 프로파일. 🔎 **0491~0500 묶음 리뷰 적기(infra-review)**.

---

## 2. NEXT — 가설 (후보, 권위는 이 절)

> 🎯 **#16 라운드 4차 arc(0501~0510 진행 중) — 완전 saga liveness *손실 체제* 편입(STATE §2 ⒜·라운드 3차 잔여 집행)**: 0491~0500 서비스 capstone 은 *행복 경로*만 구동해 sagaLivenessConsistent(pending==pendingGive+abandonedGive+permFailed)가 (0,0,0) 자명 참이었다. 이 arc 는 우편 saga 내장 손실 seam(mailAckDrop 1회 드롭·mailAckDropAlways 지속 드롭)으로 *실제 회신 손실*을 주입해 재전송→포기(abandon)→재admission(readmit)→영구실패(permFailed) 수명주기를 발현시키고 각 국면에서 3분할·회계 정합이 *비자명*(각 항 nonzero) 성립함을 단언. 편입: transient(0501)·unacked(0502)·abandon(0503)·abandonpub(0504)·readmit(0505)·readmitpub(0506)·permfail(0507)·failpub(0508)·3way grand(0509)·promotedsagaloss 가드(0510). 공용 하니스 `runMailLoss`·박스 무수정→매 step reg 0. **이 arc 닫히면 #16 완전 해소**.

> 🎯 **(닫힘) #16 라운드 3차 arc(0491~0500 ✅) — 서비스 saga capstone 재작성 편입(감사 §2 ①-b)**: 거래소 saga/교차/취소·우편 saga/교차/만료·길드 로스터/금고·종합 격리·promotedsvc 가드 9종 ORDER 편입(행복 경로). 손실 체제는 라운드 4차(위)가 이음.

> 🔎 **감사(2026-07-02) 남은 우선순위**: ① **#16**(2차 grand capstone ✅ + **3차 서비스 saga capstone 진행 중**·위 arc) ② #74 실 GW 분리 ③ #46 escrow+서버간 인증 ④ #75 프로덕션 프로파일. **⛔ "C++ 시뮬 코어" 백로그 없음**(§4).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| ⛔범위밖 | **C++ 시뮬 코어 (HktInfra 과제 아님)** | 월드 | 결정론 시뮬 *내부 구현*은 범위 밖 — `ISimCore` 뒤 블랙박스·HktGameplay 소관·더미 stub 영구(§4·[SPINE](SPINE.md) §0). |
| ✅ | **#56 브리지 존 데이터 평면** | 코디네이션/월드 | 0281~0290 해소(enter/move/leave·migrate 무손실·단일 소유·entityFlowCoherent). |
| 🟡 | **#9 멀티프로세스 배선 (직접 라우팅·host 컨테이너·월드 다운스트림 E2E·#57 실 spawn+데이터 평면 ✅)** | 코디네이션/엣지 | 0291~0350 직접 라우팅·host 컨테이너·월드 다운스트림 E2E · **#57 ✅(0351~0370 드라이버+실 spawn+실 데이터 평면·clusterCoherent desync 0)**. 남은 것: cluster-run.js runMulti 코어 orch 상주·연속 tick 루프·업스트림 실 클라(#61). |
| 🟡 | **비동기 실행 아래 결정론 (#4·lockstep 배리어 해제)** | 코디네이션 | **#4 in-proc substrate ✅(0431~40) + 실 Net·sim seam 브리지 등가 ✅(0441~50) + 실 run() net.step 배리어 치환 ✅(0451~60) + 다중 존 이주 하 유계 resync ✅(0461~70·`async-barrier.js` wrap-aware interior 가드·다중 존 loss+delay 하 world/뷰==lockstep·exactly-once·deferSpan<horizon·deferredAcrossHandoff0·OFF→net.step reg 0)**. 남은 것: 완전-ON(경계 포함 async·lockstep 등가 불가·0461 발견)·downstream 재접속·실 host.js child 업스트림(#70). |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정검증·대기열·만료(0001). |
| 🟡 | **다중 클라 결정론 *전파*·예측 (업스트림 실 클라 ✅ in-proc+실 경계)** | 월드/엣지 | 다운스트림 실 DownClient(0342~50·desync 0) + 업스트림 실 UpClient(0421~30·#61·in-proc) + **실 host.js child 경계 업스트림 ✅(0471~80·#70·intent 소켓 넘어 실 host.js 존→egress 뷰 되먹임·경계 넘어 desync0·손실 exactly-once·생애주기)**. 남은 것: 실 게이트웨이 프로세스 분리(seam→실 GW). |
| ⬜ | **서버간 인증 없음** | 버스 | 존이 게이트웨이 발신 암묵 신뢰(0001). |
| 🟡 | **버스 단일점·분산·영속** | 버스 | 동적구독/failover/무손실/lease/self-healing ✅(0016~61). 남은 것: 라우팅 영속·다중 브로커·per-producer ack. |
| 🟡 | **서비스 영속·failover (가방·채팅·파티·길드 ✅·버스 ⬜)** | 서비스/데이터 | 저널+압축+write-behind(0017~0184). 버스 라우팅 영속 0. |
| 🟡 | **거래소·우편·랭킹·길드·길드 금고 ✅** | 서비스 | 거래소(0107~40)·우편(0142~80)·길드(0181~90·로스터/마스터십/이양)·길드 금고(0191~0200·공유 원장/예치/인출/영속/정합) 동형. 금고↔가방 escrow 후속. |
| 🟡 | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | 프레즌스 박스·귓속말/파티 라우팅(0064~106). 남은 것: cluster kill→replay·존 배치·부하 분산. |
| 🟡 | **캐시 + write-behind 영속 (저널+압축·홉 신뢰·failover/quorum/윈도 ✅)** | 데이터 | PersistStore+압축·홉 신뢰→quorum→윈도(0017~0032). fsync 0·월드 영속 0. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속서 뷰/권위 재구성. |
| 🟡 | **#16 bespoke 검증 spine 미승급 — 서비스 계층 실행 검증 0** | 전체 | 시대별 grand capstone 9종 승급 완료(0481~0489·verify-kit ORDER). 남음: 서비스 saga capstone(거래소/우편/길드) 재작성 편입(git per-commit 에만·HEAD 재검증 불가·감사 §2 ①-b). |
| ⬜ | **#75 프로덕션 프로파일(유계 기본값 1벌)** | 전체 | reg-0 규칙 부작용 — 유계 노브 기본 무계(downRecvWindow 0·capacity ∞·leaseSpan 0·재시도 무제한). 권장값 세트를 verify 모드로 봉인(감사 2026-07·§2 권고 ④). |

> **✅ 해소된 격차** 전문: §7 INDEX·각 `step-NNNN.md`. **상시 렌즈 — 척추**([SPINE.md](SPINE.md) §5): 매 step verify 4기둥 + 척추 5항(①tick ②결정론 ③권위 단일 ④은닉 ⑤headless). 분리 기준: *존 tick 박자로 돌아야 하나?*

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
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 레지스트리+Orchestrator+broker(0001~13)·프레즌스 SSOT·self-healing·epoch 펜싱(0054~106). 존 배치 executed SSOT→실 zone.js 브리지·#56 데이터 평면·#9 직접 라우팅·host 컨테이너·월드 다운스트림 E2E(0241~0350). **#57 실 OS 프로세스+데이터 평면(0351~70)·#62 상주 코디네이터(0371~80)·#65 placement 동기(0381~90)·#66/#67 이중 권위(0391~400)·#62 runMulti 합류(0401~20)**. **#4 async: substrate(0431~40)→실 Net·sim seam(0441~50)→net.step 배리어 치환(0451~60)→다중 존 이주 유계 resync(0461~70·async-barrier)**. **#70 실 host.js child 경계 업스트림(0471~80·cluster-hostdriver)**. #16 승급 라운드 2차 grand capstone 항구화(0481~·coord* capstone 승격 포함) |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 PersistStore(효과 저널·write-behind·kill→replay·스냅샷 압축·복구·홉 신뢰·failover/quorum·윈도 0017~62) · **캐시 🟡 set/get·read-through·TTL·무효화·LRU+Redis-like(0205~60)** · **월드 영속 🟡 intent 로그·replay·스냅샷·crash/recover·write-behind·fsync(0207~28)**. 버스 영속 후속 |

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
| 0421–[0430](step-0430.md) | #61 업스트림 실 클라 arc: UpClient(발신 액터)·enter/move/leave 발신·양방향 뷰 수신·수렴 desync0·합성 동치·다중 인터리빙·손실 gap-resync·업스트림 회계·grand capstone(발신→게이트웨이→존→egress→수신 desync0·생애주기·보존) | 통과(reg 0·spine OK) · upe2ecap 5/5 |
| 0431–[0440](step-0440.md) | #4 진짜 비동기 substrate in-proc arc: `async-core.js` — Lamport 클럭→인과 교환→전순서→holdback 재정렬→인과 배달→async 수렴→비-lockstep 진행→손실 resync→exactly-once 회계→capstone(M 복제 순열+손실 desync0·인과존중). run() 미호출 reg 구조적 0 | 통과(reg 0·spine OK) · asynce2ecap 5/5 |
| [0441–0450](reviews/review-0441-0450.md) | #4 실 net.step 배리어 치환 in-proc 등가 arc: async-net.js — 실 Net-형 intent 스트림·sim fold·holdback·디스패치·resync·복제수렴·배리어-free·exactly-once·lockstep 등가·capstone(실 engine Net 배리어==배리어-free substrate==canonical) | 통과(reg 0·spine OK) · nete2ecap 5/5 |
| 0451–[0460](step-0460.md) | #4 실 net.step 배리어 *실제* 치환 arc: 신규 `async-barrier.js`·run() 이 net.step 대신 stepper 로 월드입력을 정전 순서(m.id) holdback/resync 배달 — seam→스탬프→holdback→손실+resync→무-resync 대조→exactly-once→지연 jitter→다중 존→다운스트림 수렴→capstone. 손실+지연 하 world/뷰==lockstep·exactly-once·다중존 투명·OFF→net.step reg 0 | 통과(reg 0·spine OK) · bare2ecap 5/5 |
| [0461–0470](reviews/review-0461-0470.md) | #4 완전 async 전환 arc: `async-barrier.js` wrap-aware interior 유계 resync 가드 — 발산 포착(0461)→loss/delay 가드(0462~63)→결합+exactly-once(0464)→유계 증명(0465)→가드 대조(0466)→이주 명제(0467)→exactly-once 완전 회계(0468)→다운스트림(0469)→capstone(0470). 다중 존 loss+delay world/뷰==lockstep·이주 전 유계 resync·OFF→net.step reg 0 | 통과(reg 0·spine OK) · mze2ecap 5/5 |
| [0471–0480](reviews/review-0471-0480.md) | #70 실 host.js child 경계 업스트림: `cluster-hostdriver.js` 업스트림 seam(intentToZoneMsg/deliverIntent/feedViews/upstreamAuthSig/driveUpstream/zoneEntity) — 실 UpClient intent 소켓 넘어 실 host.js 존→egress 되먹임(경계 desync0·손실 exactly-once·생애주기·회계). clusterDriverReal OFF→reg 0 | 통과(reg 0·spine OK) · upce2ecap 5/5 |
| [0481–0490](reviews/review-0481-0490.md) | #16 승급 라운드 2차: 시대별 grand capstone 9종(mze2ecap·bare2ecap·nete2ecap·asynce2ecap·worldcap·upce2ecap·clusterdatacap·coordmergecap·coordcap)을 verify-kit ORDER 항구화 + promoted16 등록 가드(0490). cluster capstone 은 makeVerifyKit ctx dep 주입·박스 무수정→reg 0 | 통과(reg 0·spine OK) · promoted16 9/9·capstone 5/5 |
| [0491](step-0491.md) | #16 승급 라운드 3차 1: 거래소↔가방 saga 정합 capstone(0140 sagaLiveConsistent 판) 재작성해 verify-kit ORDER 편입·서비스 계층 첫 실행 검증 | 통과(reg 0·spine OK) · svcexchangecap 5/5 |
| [0492](step-0492.md) | #16 승급 라운드 3차 2: 거래소↔가방 2-서비스 교차 회계 capstone(0130 판·giveOks==escrowXfers) 재작성 편입 | 통과(reg 0·spine OK) · svcexchangexfer 5/5 |
| [0493](step-0493.md) | #16 승급 라운드 3차 3: 아이템 우편↔가방 saga 정합 capstone(0170 sagaLiveConsistent 판·mailC+itemC+escrowC+sagaC) 재작성 편입 | 통과(reg 0·spine OK) · svcmailcap 5/5 |
| [0494](step-0494.md) | #16 승급 라운드 3차 4: 우편↔가방 2-서비스 교차+saga liveness capstone(0164/0180 판·giveOks==escrowXfers·pending 3분할) 재작성 편입 | 통과(reg 0·spine OK) · svcmailxfer 5/5 |
| [0495](step-0495.md) | #16 승급 라운드 3차 5: 길드 로스터 single-master 정합 capstone(0190 rosterConsistent 판·이양 쌍 거래·master 보호) 재작성 편입 | 통과(reg 0·spine OK) · svcguildcap 5/5 |
| [0496](step-0496.md) | #16 승급 라운드 3차 6: 길드 금고 원장 정합 capstone(0199 bankConsistent 판·itemId 단일 길드 소유·예치−인출==잔여) 재작성 편입 | 통과(reg 0·spine OK) · svcbankcap 5/5 |
| [0497](step-0497.md) | #16 승급 라운드 3차 7: 우편 메시지 통수 회계 capstone(0150 mailConsistent 판·sent==held+fetched+expired·만료 TTL) 재작성 편입 | 통과(reg 0·spine OK) · svcmailexpire 5/5 |
| [0498](step-0498.md) | #16 승급 라운드 3차 8: 서비스 종합 격리 capstone 신규(거래소+우편+길드 한 run()·각 술어 동시 성립·공유 가방 격리) | 통과(reg 0·spine OK) · svcsvccombined 5/5 |
| [0499](step-0499.md) | #16 승급 라운드 3차 9: 거래소 release 경로(취소·만료 TTL) escrow 반환 capstone 재작성 편입·아이템 판매자 복귀 | 통과(reg 0·spine OK) · svcexchangecancel 5/5 |
| [0500](step-0500.md) | #16 승급 라운드 3차 10·arc 닫기: 서비스 saga capstone 9종 ORDER/MODES 등록 가드 promotedsvc 추가·헤더 카탈로그 갱신(0491~0500 닫힘) | 통과(reg 0·spine OK) · promotedsvc 9/9 |
| [0501](step-0501.md) | #16 라운드 4차 1: mailsagatransient — 우편 saga 일시 회신 손실(mailAckDrop drop-once)+autoRetry 자가 치유 편입·공용 하니스 runMailLoss | 통과(reg 0·spine OK) · mailsagatransient 5/5 |
