# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(고정 크기 대시보드)**: §1~6은 step 닫을 때 **덮어쓴다**(누적 금지)·§7 INDEX만 **literal 1줄** append. 발견/한계 전문은 `step-NNNN.md`. 누적 함정 금지: §5 step별 재나열 금지(현재 마커+핵심 step)·§3 ✅격차 한 줄로·§4 반복 참조 불변만. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0201](step-0201.md) — **인스턴스(던전) 서버 분리·spawn 기본**(너비 우선 1차 시작): 새 박스 `src/instance.js`(InstanceServer)·`instanceSpawn`→active SSOT(멱등 no-op·권위 단일 소유)·존과 수명주기 분리. OFF 플래그 `instanceService`(OFF→박스 0=0200 비트 동일). 닿는 박스: instance(신규)·net-core·topo-actors/build/run.
- **한 줄 상태**: reg ALL OK·instancespawn: 5/5 active 3/spawns 4·spine ALL OK.
- **다음**: §2 — **0202 인스턴스 despawn + 클라 라우팅**(인스턴스 박스 기본 통신 완성), 이후 오케스트레이터 배치(0203~). 너비 1차 진행 중.

---

## 2. NEXT — 가설 (후보, 권위는 이 절)

> **단계 = 1차 너비** (CLAUDE.md "진행 정책"). 0107~0200 이 서비스 한 줄(거래소·우편·길드)을 영속~정합 capstone 까지 깊게 판 결과, SPINE 6계층에 *기본 통신조차 없는 박스*가 남았다. **이제 심화를 멈추고 그 빈 박스들을 기본 통신 선까지 세운다.** 1차 완료 = 아래 잔여 박스 전부가 "기본 통신 가능"(목적 달성 최소 연산 + 척추 5항 + reg 0). 그 뒤에야 2차 고도화 백로그를 연다.

**1차 너비 잔여 박스 (이 순서로 — 각 박스는 *기본만*, 심화 금지):**
1. **인스턴스(던전) 서버** (계층2) — 🟡 spawn ✅(0201·active SSOT) · despawn/route 후속(0202). 존과 수명주기 분리.
2. **오케스트레이터 존 배치** (계층5) — place/query 기본: "어느 존을 어디에" 배치 결정 SSOT + 질의. (현 orchestrator.js 는 존 failover 만.)
3. **캐시 박스** (계층6) — get/set 기본: 핫 데이터 read-through/write-through 1홉. DB 직행 대체.
4. **월드 영속** (계층6) — append/replay 기본: 존 intent 로그 event sourcing → 상태 재구성(서비스 PersistStore 아닌 *월드* 판).
5. **로그인 큐·티켓 실체화** (계층1) — enqueue/dequeue/expire 기본: 스텁 티켓을 대기열+만료로.

**2차 고도화 백로그 (너비 완료 전엔 꺼내지 않음·블로킹 격차 🔴 제외)**: 길드 금고↔가방 escrow 연동·발행 게이트 통합·per-producer ack·fsync·anti-entropy·버스 라우팅 영속/분산·서버간 인증·재접속, 그리고 위 1차 박스들의 영속·failover·스냅샷·정합 capstone. 🔎 0191~0200 묶음 리뷰 적기.

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
| 1 | 엣지 | 로그인/인증 · 게이트웨이 | 🟡 스텁(일회 티켓·단일 연결·은닉 0001)+별 OS 프로세스(0010)+게이트웨이 producer 네임스페이스(0046). 대기열·만료·재접속·게이트웨이 군 풀 후속 |
| 2 | 월드 | 존 · 인스턴스 (분할·AOI·조정·핸드오프) | 🟡 존 VM+결정론 복제+AOI+분할·핸드오프(소유자=1)+failover+별 프로세스(0001~0013) · **인스턴스 🌱 spawn SSOT(0201·존과 수명주기 분리·despawn/route 0202~)**. 존 N개·동적 경계 후속 |
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 가방/채팅/ranking/읽기모델+write-behind/quorum(0014~0063)·귓속말/파티(0071~0106)·거래소(0107~0140)·우편(0142~0180) 동형(escrow/발행/3leg/saga)·길드(0181~0190·로스터/마스터십/배지/이양)·길드 금고(0191~0200·공유 아이템 원장·예치/인출/발행/영속/스냅샷/배지/정합). 금고↔가방 escrow 연동 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 substrate→토픽 pub/sub→ServiceBus→발신 소비자→동적구독/failover/무손실/replay 유계·ack 자기조정/min-wm/lease·ns·lifecycle·적응형(0004~0054). 분산·per-producer ack·라우팅 영속 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 레지스트리+Orchestrator+broker(lockstep→TCP→허브·kill·split-brain 0·0001~0013)·lease→프레즌스 SSOT→self-healing·공지 epoch 펜싱(0054~0106). broker 물리 분산·진짜 비동기 후속 |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 PersistStore(효과 저널·write-behind·kill→replay)→스냅샷 압축→읽기모델 복구→채팅 영속→홉 신뢰→failover/N-replica quorum→윈도+유계 K(0017~0062). fsync·월드/버스 영속 후속 |

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
| [0101](step-0101.md) | 읽음 확인 영수증(drainAck) | 통과 |
| [0102](step-0102.md) | 미확인 체크아웃 유계화(checkoutBound) | 통과 |
| [0103](step-0103.md) | 읽음 소비 발행(drainedPublish) | 통과 |
| [0104](step-0104.md) | 수신함 손실 발행(lossPublish) | 통과 |
| [0105](step-0105.md) | active 공지 epoch 펜싱(announceEpoch) | 통과 |
| [0106](step-0106.md) | wrouter 공지 epoch 펜싱(0105 라우터 판) | 통과 |
| [0107](step-0107.md) | 거래소 서비스 분리(ExchangeService) | 통과 |
| [0108](step-0108.md) | 거래소 체결 발행(exchangePublish) | 통과 |
| [0109](step-0109.md) | 거래소 영속·failover(exchangePersist) | 통과 |
| [0110](step-0110.md) | 거래소 저널 스냅샷 압축(exchangeSnapshot) | 통과 · tail 1 |
| [0111](step-0111.md) | 거래소 취소 발행(cancelPublish) | 통과 · ON pub 1 |
| [0112-0113](step-0112.md) | 거래소 시세 피드 읽기 모델+영속·late-join(marketFeed·marketReconstruct) | 통과 |
| [0114-0115](step-0114.md) | 매물 만료 TTL+발행(exchExpiry·expirePublish) | 통과 · expired 1·pub 1 |
| [0116](step-0116.md) | 시세 피드 만료 반영(MarketFeed svc.exchange.expired 구독) | 통과 |
| [0117-0119](step-0117.md) | 거래소↔가방 escrow legs(list 인출·buy 입금·cancel/expire 반환·exchInventory) | 통과 |
| [0120](step-0120.md) | 거래소↔가방 2-서비스 보존(escrowItemIds) | 통과 · open==escrow·minted 5 |
| [0121](step-0121.md) | 거래소↔가방 give 결과 비동기 수신(exchSaga) | 통과 · gives==acked 9 |
| [0122](step-0122.md) | 거래소↔가방 list 인출 실패 보상(exchCompensate) | 통과 · aborted ON1/OFF0 |
| [0123](step-0123.md) | 보상 발행(abortPublish) | 통과 · aborted 1 |
| [0124](step-0124.md) | 정리: svc-exchange.js 박스-부품 분할(core/txn/entry·기능 0) | OK · 32.4→12.5/7.0/1.1KB |
| [0125](step-0125.md) | saga 미해결 give 추적+회신 손실 감지(pendingGives·gid) | 통과 · 손실 pending 9 |
| [0126](step-0126.md) | saga 회신 재전송+idempotent dedup(exchRetry·sagaDedup) | 통과 · dedup 안전 |
| [0127](step-0127.md) | saga dedup 유계화(sagaDedupBound·saga_done) | 통과 · bound sagaResults 0 |
| [0128](step-0128.md) | saga 회계 정합 불변(sagaConsistent) | 통과 · 3체제 true |
| [0129](step-0129.md) | saga 자동 재전송(autoRetry) | 통과 |
| [0130](step-0130.md) | 거래소 give↔가방 transfers capstone(escrowXfers) | 통과 · giveOks==escrowXfers 9 |
| [0131](step-0131.md) | saga 재시도 상한(sagaMaxRetries) | 통과 · retries 2 |
| [0132](step-0132.md) | saga 포기 발행(abandonPublish) | 통과 · pub 1==abandoned 1 |
| [0133](step-0133.md) | 정리: topo-build 구독 테이블 분할(topo-subs.js·buildSubs) | OK · 33.1→25.5KB |
| [0134](step-0134.md) | saga 포기 give 재admission(exchReadmit) | 통과 · readmit 1/pending 0 |
| [0135](step-0135.md) | saga 재admission 발행(readmitPublish) | 통과 · pub 1==readmit 1 |
| [0136](step-0136.md) | saga 재admission 자동 트리거(autoReadmit) | 통과 · readmit 1/pending 0 |
| [0137](step-0137.md) | saga 재admission 횟수 상한(readmitMax) | 통과 · readmit 2/permFailed 1 |
| [0138](step-0138.md) | saga 영구 실패 발행(failPublish) | 통과 · pub 1==permFailed 1 |
| [0139](step-0139.md) | 가방 회복 자기 공지(invUpPublish) | 통과 · invUpPub 1→readmit 1 |
| [0140](step-0140.md) | saga liveness 회계 정합 capstone(sagaLiveConsistent) | 통과 · 4체제 true |
| [0141](step-0141.md) | 정리: topology.js run 드라이버→topo-run.js 분리(기능 0) | OK · 31.5→~1.0KB·reg 0 |
| [0142](step-0142.md) | 우편(Mail) 서비스 분리(MailService) | 통과 · sent 4·held 3/1·멱등·결정론 |
| [0143](step-0143.md) | 우편 수령(mailFetch) | 통과 · h1 fetched 2·재수령 0·accountConsistent |
| [0144](step-0144.md) | 우편 입금 발행(mailSentPublish) | 통과 · published 3==audit 3==sent·비-침습·OFF 0 |
| [0145](step-0145.md) | 우편 영속·failover(mailPersist) | 통과 · reconstruct==pre·OFF 소실 |
| [0146](step-0146.md) | 우편 저널 스냅샷 압축(mailSnapshot) | 통과 · tail 2<full 8 |
| [0147](step-0147.md) | 우편 읽음 확인 발행(mailReadPublish) | 통과 · readPub 3==audit·OFF 0 |
| [0148](step-0148.md) | 우편 만료 TTL(mailTtl) | 통과 · expired 1·reconstruct==live |
| [0149](step-0149.md) | 우편 만료 발행(mailExpirePublish) | 통과 · expirePub 1==audit·OFF 0 |
| [0150](step-0150.md) | 우편 회계 정합 capstone(mailConsistent) | 통과 · 4체제 true·crash 정합 |
| [0151](step-0151.md) | 우편 미읽음 배지 읽기 모델(mailFeed·MailFeed) | 통과 · unread 3/2·total 5==sent |
| [0152](step-0152.md) | MailFeed 읽음 반영(mailFeedRead) | 통과 · unread==sent−read |
| [0153](step-0153.md) | MailFeed 만료 반영(mailFeedExpire) | 통과 · unread==sent−read−expired |
| [0154](step-0154.md) | MailFeed 영속·late-join(우편 op 저널 replay 배지 복원) | 통과 · reconstruct==라이브 |
| [0155](step-0155.md) | MailFeed 회계 정합 capstone(feedConsistent·MailFeed arc 닫기) | 통과 · 4체제·unread==held |
| [0156](step-0156.md) | 미읽음 배지 질의 인터페이스(mailUnreadQuery→mailUnreadReply·request/reply over net) | 통과 · queriesRx 2·repliesSent 2·회신==배지 |
| [0157](step-0157.md) | 아이템 첨부 우편(mailItem·우편 1통이 아이템 보유·거래소 escrow 판) | 통과 · itemSent 2·itemHeld 2 |
| [0158](step-0158.md) | 아이템 우편 수령(itemFetched·itemHeld→itemFetched) | 통과 · held 1·fetched 2 |
| [0159](step-0159.md) | 아이템 우편 만료 회수(itemExpired·itemHeld→itemExpired) | 통과 · held/fetch/exp 1/1/1 |
| [0160](step-0160.md) | 아이템 우편 회계 정합 capstone(itemConsistent·arc 닫기) | 통과 · 4체제 true |
| [0161](step-0161.md) | 아이템 우편↔가방 leg1: 발신 시 발신자 가방 인출(mailInv·escrow) | 통과 · xfers 2·소유자 escrow |
| [0162](step-0162.md) | 아이템 우편↔가방 leg2: 수령 시 escrow→수신자 가방(mailInv) | 통과 · xfers 4·소유자 h1 |
| [0163](step-0163.md) | 아이템 우편↔가방 leg3: 만료 시 escrow→발신자 가방(mailInv) | 통과 · escrowXfers 4 |
| [0164](step-0164.md) | 아이템 우편↔가방 2-서비스 보존 capstone(escrowConsistent·arc 0161~0164) | 통과 · 우편==가방 escrow |
| [0165](step-0165.md) | 정리: svc-mail.js 박스-부품 분할(core/txn/entry·기능 0) | OK · 30.9→25.6/5.9/1.1KB·digest 비트동일 |
| [0166](step-0166.md) | 우편 saga 회신 비동기 수신(mailSaga·ackedGives) | 통과 · gives==acked 4 |
| [0167](step-0167.md) | 우편 saga 미해결 추적+회신 손실 감지(pendingGives·gid) | 통과 · 손실 pending 1 |
| [0168](step-0168.md) | 우편 saga 회신 재전송+idempotent dedup(mailRetry·sagaDedup) | 통과 · ON xfers 4 |
| [0169](step-0169.md) | 우편 saga 회계 정합 capstone(sagaConsistent) | 통과 · 3체제 true |
| [0170](step-0170.md) | 우편 give↔가방 transfers capstone(sagaLiveConsistent·arc 0161~0170) | 통과 · 5/5·2/2 |
| [0171](step-0171.md) | 정리: svc-mail-core 영속 부품 분할(기능 0) | OK · 34.7→30.4KB |
| [0172](step-0172.md) | 우편 saga 자동 주기 재전송(mailAutoRetry·0129 판) | 통과 · ON pending 0 |
| [0173](step-0173.md) | 우편 saga 재시도 상한(mailMaxRetries·0131 판) | 통과 · 상한2 2/1 포기 |
| [0174](step-0174.md) | 우편 saga 포기 발행(mailAbandonPublish·0132 판) | 통과 · pub 1==abandoned |
| [0175](step-0175.md) | 정리: svc-mail-core 헤더 압축(코드 0) | OK · 34→18.6KB |
| [0176](step-0176.md) | 우편 saga 포기 give 재admission(mailReadmit·0134 판) | 통과 · 재무장 1/0 |
| [0177](step-0177.md) | 우편 saga 재admission 발행(mailReadmitPublish·0135 판) | 통과 · pub 1==readmitted |
| [0178](step-0178.md) | 우편 saga 재admission 횟수 상한(mailReadmitMax·0137 판) | 통과 · 상한1 영구실패 차단 |
| [0179](step-0179.md) | 우편 saga 영구 실패 발행(mailFailPublish·0138 판) | 통과 · pub 1==permFailed |
| [0180](step-0180.md) | 우편 saga liveness 정합 capstone(sagaLivenessConsistent·arc 0166~0180) | 통과 · 4체제 4/4 |
| [0181](step-0181.md) | 길드 서비스 분리(guildService·로스터+마스터십 SSOT·single-master) | 통과 · 길드 2·5/5 |
| [0182](step-0182.md) | 길드 증분 가입/탈퇴(guildJoin/Leave·멱등·master 보호) | 통과 · 로스터 [x,c2] |
| [0183](step-0183.md) | 길드 멤버십 변경 발행(guildChangePublish·svc.guild.changed) | 통과 · pub 3==audit·OFF 0 |
| [0184](step-0184.md) | 길드 영속·failover(guildPersist·변경 저널 replay) | 통과 · crash pre==post |
| [0185](step-0185.md) | 길드 저널 스냅샷 압축(guildSnapshot·snapshot+tail) | 통과 · full 8→tail 2 |
| [0186](step-0186.md) | 길드 멤버 수 배지 읽기 모델(guildFeed·GuildFeed) | 통과 · 배지==로스터·OFF 0 |
| [0187](step-0187.md) | GuildFeed 영속·late-join(guildFeedPersist·op 저널 replay) | 통과 · crash pre==post |
| [0188](step-0188.md) | GuildFeed 회계 정합 capstone(feedConsistent·배지==로스터) | 통과 · 4체제 4/4 |
| [0189](step-0189.md) | 마스터 이양(guildTransfer·single-master 쌍 거래·핸드오프 0006 판) | 통과 · x→c1·crash 보존 |
| [0190](step-0190.md) | 길드 정합 capstone(rosterConsistent·single-master·arc 0181~0190 닫기) | 통과 · 3체제 3/3 |
| [0191](step-0191.md) | 길드 금고 deposit(guildBank·guildDeposit·공유 아이템 원장·bank arc 출발) | 통과 · vault [sword,shield]·중복 0 |
| [0192](step-0192.md) | 길드 금고 withdraw(guildWithdraw·입출금 쌍·0118/0158 판) | 통과 · 예치2/인출3→vault [shield] |
| [0193](step-0193.md) | 길드 금고 변경 발행(guildBankPublish·svc.guild.bank.changed·0108/0183 판) | 통과 · ON pub 3==rx·OFF 0 |
| [0194](step-0194.md) | 길드 금고 영속·failover(guildPersist 금고 확장·저널 replay·0184 판) | 통과 · reconstruct==pre·OFF 소실 |
| [0195](step-0195.md) | 길드 금고 저널 스냅샷 압축(guildSnapshot 금고 확장·0185 판) | 통과 · tail 1<full 9·무손실 |
| [0196](step-0196.md) | 길드 금고 아이템 수 배지(guildBankFeed·bankCount·0186 판) | 통과 · 배지==vault·OFF 0 |
| [0197](step-0197.md) | 길드 금고 배지 영속·late-join(guildFeedPersist 금고 배지·0187 판) | 통과 · reconstruct==pre·OFF 소실 |
| [0198](step-0198.md) | 길드 금고 배지 정합 capstone(bankFeedConsistent·배지==vault·0188 판) | 통과 · 3체제 3/3·vault 2/2 |
| [0199](step-0199.md) | 길드 금고 원장 정합(bankConsistent·itemId 단일 길드 소유·0190 판) | 통과 · 3체제 3/3·중복 0 |
| [0200](step-0200.md) | 길드 금고 arc capstone(bankCapstone·원장+배지 결합·0140/0180/0190 금고 판·arc 0191~0200 닫기) | 통과 · 3체제 3/3 |
| [0201](step-0201.md) | 인스턴스(던전) 서버 분리·spawn 기본(InstanceServer·instanceSpawn·active SSOT·너비 1차 시작) | 통과 · active 3/spawns 4 |
