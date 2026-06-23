# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(에이전트 효율 — 토큰이 step 수에 비례해 터지지 않게 *강제*)**: 이 파일은 *고정 크기 대시보드*다. §1~6은 step을 닫을 때마다 **덮어쓴다(rewrite)** — 누적하지 않는다. 오직 §7 INDEX만 **literal 1줄** append(`step | 조각 | 통과+핵심수치 1개` — *문단 금지*). 발견/한계의 *전문*은 STATE가 아니라 `step-NNNN.md`에 산다. **세 가지 누적 함정 금지**: ① §5 에서 큰 그림 진척을 step별로 *재나열*하지 말 것 — 현재 마커 + 핵심 step 목록만 ② §3 에서 ✅해소된 격차를 전문 보존하지 말 것 — *한 줄로 떨어뜨린다* ③ §4 는 *여러 step 이 반복 참조하는 불변*만. 닫힌 step 의 발견·한계 전문은 각 `step-NNNN.md`(역사의 SSOT), 1줄 요약은 §7 INDEX. 마커: ✅해소 🟡부분 🔴열림(최우선) ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0133](step-0133.md) — **정리: topo-build.js 버스 구독 테이블 분할**(topo-subs.js·buildSubs·기능 0·reg 0): 0131·0132 가 구독 행을 더해 topo-build 가 33.1KB>30KB(박스 트리거)를 다시 넘겨, `if(bus){…subs.push…}` 블록(~35행)을 `buildSubs(c)`(topo-subs.js)로 verbatim 이동(각 변수 c. 접두)·topo-build 는 한 줄 호출로 위임. net.log·버스 라우팅·audit 스트림·구독 spec 비트 동일(topsplit). 크기 33.1→25.5KB·topo-subs 9.6KB. topo-actors 0098 분리의 후속(이번엔 구독 테이블). 닿는 박스: topo-build·topo-subs(신규).
- **한 줄 상태**: reg ALL OK(src=baseline 비트 동일)·topsplit: 5시드 logHash src==base(0xf8032c41…)·bus/audit/subs 동일·전 키트 모드+spine 통과.
- **다음**: §2 참조(포기 give 보상·topology 정리·우편/길드·비동기 결정론🔴·0131~0140 묶음 리뷰 시점).

---

## 2. NEXT — step-0044 후 가설 (후보, 권위는 이 절)

**step-0133 이 *정리*(topo-build 구독 테이블→topo-subs.js·기능 0·reg 0)로 박스 크기를 다시 유계화(33.1→25.5KB). 다음 후보: *포기 give 보상*(영구 실패 list-leg → listing abort·0122 exchCompensate 의 timeout 판)·*정리* topology(31.6KB) 분할·*우편/길드 서비스*·*buy leg 보상*·*비동기 결정론*(🔴). 🔧 topology 31.6KB. 🔎 0131~0140 묶음 리뷰(`infra-review`) 시점.**

**검증할 것(공통)**: ① **회귀 0**(새 항 OFF=직전 비트 동일) ② **신성한 tick**(존 tick 밖·비-침습) ③ **E2E 동치**(멀티프로세스=인프로세스·은닉) ④ **가설**(고장 주입·복구 수렴 증명).

**병행 백로그(블로킹 아님·전문은 §3·각 step 문서)**: ⬜ per-producer ack·fsync·anti-entropy·버스 라우팅 영속/분산·활성 중 다운타임+재발행·월드 영속·거래소/우편/길드·비동기 결정론(논리 클럭)·서버간 인증·재접속·티켓.

**빌드 인프라 — `engine/` 공유 커널 + `src/` 단일 소스(0049 전환)**: `engine/`=VM 커널·PRNG·FNV·`Net`·동결 `ISimCore`·`panel-kit`·`verify-kit`(누적 회귀·추가만)·`close-step`·`new-step`. 코드는 **`src/` 제자리 수정** + `src/STEP` + `src/verify.js`(NETPREV=`../baseline` 고정) + `baseline/`(직전 동결 1벌·dual-mode). **절차**: ① `new-step.js` ② 닿는 박스만 Edit + verify 셸 새 모드 ③ `close-step.js` ④ 델타 커밋+`git tag`. 정리: 0030·0035·0038·0043·0049·0053. *태그 push 거부 환경=로컬만*.

**TESTBED**: `run.js`(`node run.js`=src/·`spine`=누적 회귀·`<NNNN>`·`report`·`scenario`·`live`) + `report.html`(녹화) + `live.js`(SSE). 훅 `onTick`·`inject`(write-seam·미제공=no-op→reg 0).

---

## 3. OPEN GAPS — 열린 격차 (계층은 [SPINE.md](SPINE.md) §6, 매 step 하나씩 메움)

| 마커 | 격차 | 계층 | 상태 |
|---|---|---|---|
| 🔴 | **C++ 시뮬 코어 headless 빌드 (최우선)** | 월드 | 결정론 시뮬 코어가 UE 모듈에 링크되면 'UObject 0' 이라도 빌드 불가 → 원격 검증 불가. UE-모듈-free 코어 분리/얇은 shim 필요(§4). C++ 승격 선결(0003 §8.2). |
| 🔴 | **비동기 실행 아래 결정론 (lockstep 배리어 해제)** | 코디네이션 | 0013 까지 결정론은 중앙 lockstep 배리어가 떠받침. 진짜 비동기는 논리 클럭(Lamport/벡터)·인과 순서로 후속(0012 §9-3·0105 §9). |
| ⬜ | **로그인 큐·티켓 실체화** | 엣지 | 스텁→계정검증·대기열·만료(0001). |
| ⬜ | **다중 클라 결정론 복제·예측** | 월드 | 0002~0004 결정론 복제·예측은 C++ 시뮬 승격에서 부활. 다중 클라 intent 인터리빙·예측/롤백(0001 §8.6). |
| ⬜ | **서버간 인증 없음** | 버스 | 존이 게이트웨이 발신 암묵 신뢰(0001). |
| 🟡 | **버스 단일점·분산·영속(동적구독·failover·무손실·lease·치유·대체활성화 ✅)** | 버스 | 0016 단일 박스·영속 0→동적구독/failover/무손실/lease/self-healing(0033~0061). 남은 것: 라우팅 영속·다중 브로커·per-producer ack. |
| 🟡 | **서비스 영속·failover (가방·채팅·파티 ✅·버스 ⬜)** | 서비스/데이터 | 가방/채팅/파티 저널+압축(0017~0022·0085). write-behind(0023~0029). 버스 라우팅 영속 0. |
| 🟡 | **거래소 ✅(0107~0116)·랭킹/읽기모델 ✅·길드·우편 ⬜** | 서비스 | 0019/0020 CQRS·0107~0116 거래소(escrow 쌍 거래·발행 3종·저널+스냅샷·시세 피드 CQRS·만료 TTL). 우편·길드·거래소↔가방 원자 거래 미착수. |
| 🟡 | **세션/프레즌스 + 오케스트레이터** | 코디네이션 | 프레즌스 박스(0064~0070)·귓속말/파티 라우팅(0071~0106). 남은 것: cluster kill→replay·존 배치·부하 분산. |
| 🟡 | **캐시 + write-behind 영속 (저널+압축·홉 신뢰·failover/N-replica/quorum/윈도 ✅·월드/fsync ⬜)** | 데이터 | PersistStore(0017)+압축(0018)·홉 신뢰→quorum→윈도(0023~0032). fsync 0·월드 영속 0. |
| ⬜ | **크래시 복구·재접속·late-join** | 전체 | 영속서 뷰/권위 재구성. |

> **✅ 해소된 격차 (0001~0101)** — 전문은 §7 INDEX(1줄/step)·각 `step-NNNN.md`. 묶음: 골격~전송(01~04)·AOI~failover(05~09)·프로세스/TCP/버스/kill(10~13)·게임서비스(14~16)·가방/채팅 영속+압축(17~22)·write-behind/quorum(23~32)·버스 동적구독~lease(33~52)·lease→프레즌스 박스(54~70)·귓속말/파티 라우팅~읽음확인(71~101).

> **상시 렌즈 — 척추** ([SPINE.md](SPINE.md) §5 필독): 매 step은 verify 4기둥 + 척추 체크 5항(① 신성한 tick ② 결정론 코어 ③ 권위 단일 소유 ④ 은닉·단일 연결 ⑤ headless·원격 검증)으로 판정. 분리 판정 기준: *그 일이 존 시뮬 tick 과 같은 박자로 돌아야 하는가?*

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
- **Sim = 인터페이스 우선, C++ 최후 교체**: 존 시뮬은 *동결된 Sim 인터페이스* 뒤에 산다 — 오늘은 더미 구현(헤드리스), 인프라 전체를 원격 E2E 로 세운 뒤 인터페이스 무변경으로 얇은 C++ 호스트로 *교체만*. C++ 선-구축으로 원격 검증 루프를 끊지 않는다 ([TOOLS.md](TOOLS.md) §4·§6). 더미는 throwaway 가 아니라 인터페이스의 *첫 구현*.
- **headless·원격 검증(게임 시뮬 포함, 협상 불가)**: 모든 서버 동작 검증은 *결정론 시뮬 코어까지* Unreal Engine·GUI 없이 headless 로, 원격(이 환경/CI)에서 가능해야 한다. 더미=Node 라 자명히 충족 — C++ 승격 경로도 시뮬 *검증*에 UE 모듈을 링크하지 않는다. **'UObject 0' 으로는 부족**: 결정론 시뮬 코어가 UE 모듈(`Core`·`CoreUObject`·`GameplayTags`·`Json` 등)에 링크되면 headless 빌드 불가(§3 격차) → UE-모듈-free 코어 분리 또는 얇은 헤드리스 shim 으로 충족. 'UE 없이, 원격에서 빌드·통신·검증되는가'가 모든 박스(시뮬 포함)의 통과 조건 ([TOOLS.md](TOOLS.md) §1·§4).
- **수치 = verify 출력**: 모든 문서 수치는 시드 [42, 7, 1234, 99, 2026] 평균으로 재현.
- **코어 netcode 불변**: 결정론 시뮬 코어 순수성(UObject 0 — headless 빌드 가능) · 서버 권위(클라 읽기전용) · ISP 3-Layer · 시뮬 상태 직접쓰기 금지(intent 경유). 인프라는 *확장*하되 *깨지 않는다*.
- **한 step = 한 조각**: 더 떠올라도 다음으로 전가. 새 코어는 직전 코어를 잇고 박스/계약 하나만 더한다.
- **도구 = tick 판정 + 원격-검증** ([TOOLS.md](TOOLS.md)): tick 동기는 C++(결정론 시뮬 코어), 그 외는 원격에서 빌드·헤드리스 검증되는 도구(Go·Node·컨테이너). 시뮬만 무거운 빌드로 격리(시뮬 코어 "UObject 0" 순수성 = 얇은 헤드리스 호스트로 CI 빌드 가능 = 빌드 자산).
- **데이터 3분할** ([TOOLS.md](TOOLS.md) §3): ① 월드 영속 = intent 로그(event sourcing) + 스냅샷 ② 트랜잭션 진실 원천(가방·계정) = PostgreSQL→분산 SQL ③ Redis = 휘발/캐시(진실 원천 아님). 월드 상태를 DB 행으로 저장하지 않는다.

---

## 5. 6계층 진행 현황 ([SPINE.md](SPINE.md) §6)

| # | 계층 | 박스 | 상태 (현재 마커 + 핵심 step) |
|---|------|------|------|
| 1 | 엣지 | 로그인/인증 · 게이트웨이 | 🟡 0001 스텁(일회 티켓·단일 연결·은닉) + 0010 별 OS 프로세스 + 0046 게이트웨이 producer 네임스페이스(다중 게이트웨이 reqId 겹침→복합키). 대기열·만료·재접속·게이트웨이 군 풀 토폴로지 후속 |
| 2 | 월드 | 존 · 인스턴스 (분할·AOI·조정·핸드오프) | 🟡 0001 존 VM +0002~0004 결정론 복제·동결 Sim +0005 AOI +0006 분할·핸드오프(소유자=1) +0007 증분 AOI +0008 반응적 복원 +0009 failover +0010 별 프로세스 +0013 죽은 추종자 재충원. 0002~0004 비트-결정론 복제는 C++ 승격에서 부활. 존 N개·동적 경계 후속 |
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 가방/채팅/ranking/읽기모델(0014~0022)→write-behind/quorum(0023~0032)→대체 소비자(0061~0063). **귓속말/파티 라우팅 wrouter(0071~0106)**: 라우팅·failover·1:N·멤버십 SSOT·전달 신뢰·파티 집계/영속/압축·epoch 펜싱·종결/발행·수신함 유계/드레인/관측·공지 메아리 펜싱. **거래소 arc 0107~0131**(…→0126 재전송+dedup→0127 유계화→0128 회계 불변→0129 자동 재전송→0130 give↔transfers capstone→0131 재시도 상한 sagaMaxRetries→0132 포기 발행 abandonPublish: svc.exchange.saga_abandoned·발행 5종 완비). 신성한 tick·권위 0. 포기 보상·buy leg 보상·우편/길드 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 0004 전송 substrate→0012 토픽 pub/sub→0016 ServiceBus(발행자 무수정 소비자)→0019 발신 소비자→0033 동적 구독→0034 failover→0036/0037 결과/요청 무손실(producer replay)→0039~0042 replay 유계·ack 자기조정→0044 min-워터마크→0045~0048 lease/ns/lifecycle→0050~0052 적응형 leaseSpan/grace/cadence→0054 관측. 분산·per-producer ack·라우팅 영속 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 0001 레지스트리 +0009 Orchestrator(lease·failover) +0010~0013 broker(lockstep→TCP→버스 허브·분단/펜싱·kill·split-brain 0). 0054~0063 lease→프레즌스 SSOT→self-healing. 프레즌스 박스(0064~0070): 분리→버스화→shadow→failover 승격→사망 자율 감지→질의 →0105/0106 공지 epoch 펜싱(presmon·wrouter 메아리 정리). broker 물리 분산·진짜 비동기 후속 |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 0017 PersistStore 첫 박스(효과 저널·write-behind·kill→replay)→0018 스냅샷 압축→0020 읽기모델 복구원→0021~0022 채팅 영속/스냅샷→0023~0026 홉 신뢰→0027~0029 failover/N-replica quorum→0031~0032 윈도+유계 K→0062 대체 소비자 recon. 증분 스냅샷·fsync·월드/버스 영속 후속 |

---

## 6. 빠른 참조

- 큰 그림·계층 책임·씨앗 매핑·척추 5항: [SPINE.md](SPINE.md) · 도구·스택·데이터 3분할: [TOOLS.md](TOOLS.md)
- **의외의 발견 / 정직한 한계 전문**: 각 `step-NNNN.md`(STATE 중복 안 함 — §3·§4가 load-bearing 요약).

---

## 7. INDEX — 시리즈 검증 현황 (유일하게 append, 1행/step)

| step | 더한 한 조각 | 결과 (회귀 0 전제) |
|---|---|---|
| [0001](step-0001.md) | 최소 골격 토폴로지 (4박스+세션 계약) | 통과 · 은닉 0/47·비트 결정론 |
| [0002](step-0002.md) | 존 결정론 복제 (추종자 존+입력 미러 탭) | 통과 · 0/60 desync·0바이트 |
| [0003](step-0003.md) | Sim 인터페이스 동결 (ISimCore v1·2구현) | 통과 · 구체 참조 0 |
| [0004](step-0004.md) | 현실 전송(지연·손실·재정렬)+논리-tick | 통과 · desync 597→0 |
| [0005](step-0005.md) | 멀티 클라+AOI 브로드캐스트 (EntityZone·시뮬 0) | 통과 · 절감 51~68% |
| [0006](step-0006.md) | 공간 분할+존 간 권위 핸드오프 (EntityZone ×2) | 통과 · 소유자+in-flight=1 |
| [0007](step-0007.md) | 증분 AOI(enter/exit/update+누적 재구성) | 통과 · 증분≡전체 288/288 |
| [0008](step-0008.md) | 전송 열화 아래 핸드오프+반응적 복원(ack/재전송·NAK/keyframe) | 통과 · 손실 0~30%·desync 0 |
| [0009](step-0009.md) | 추종자 승격 failover(shadow 복제·lease 감지·승격) | 통과 · 사망→소유자 1 |
| [0010](step-0010.md) | 프로세스 경계 현실화(실 프로세스/IPC·broker lockstep) | 통과 |
| [0011](step-0011.md) | 실 TCP 소켓 전송(IPC 파이프→TCP·프레이밍) | 통과 |
| [0012](step-0012.md) | 버스 분산+열화 내성(토픽 pub/sub·분단·펜싱) | 통과 · split-brain 0 |
| [0013](step-0013.md) | 진짜 프로세스 kill 아래 failover(child.kill·epoch 펜싱) | 통과 · split-brain 0 |
| [0014](step-0014.md) | 가방 서비스 분리(아이템 원장 존 tick 밖 비동기·단일 소유·쌍 거래) | 통과 |
| [0015](step-0015.md) | 채팅 서비스 분리(채널 팬아웃 비동기·구독 라우팅·지역 격리) | 통과 · 누설 0 |
| [0016](step-0016.md) | 이벤트 버스 서비스 층(발행/구독·직접 결합 제거·무수정 소비자) | 통과 |
| [0017](step-0017.md) | 가방 failover·영속(원장을 영속 저널서 재구성·event sourcing) | 통과 |
| [0018](step-0018.md) | 가방 저널 스냅샷 압축(intent 로그+주기 스냅샷) | 통과 · 92%↓ |
| [0019](step-0019.md) | 발신하는 둘째 소비자(RankingService·CQRS) | 통과 |
| [0020](step-0020.md) | 읽기 모델 영속·late-join(crash→쓰기 저널 recon) | 통과 |
| [0021](step-0021.md) | 채팅 영속·failover(crash→커맨드 로그 replay) | 통과 |
| [0022](step-0022.md) | 채팅 커맨드 로그 스냅샷 압축(스냅샷+tail replay) | 통과 |
| [0023](step-0023.md) | 저널 홉 신뢰 전달(write-behind 홉 갭 NAK+재전송) | 통과 |
| [0024](step-0024.md) | 저널 홉 tail 손실 감지(heartbeat→tail NAK) | 통과 |
| [0025](step-0025.md) | in-flight give 손실 복구(give-resend→belief 재수렴) | 통과 · itemDesync 0 |
| [0026](step-0026.md) | in-flight mint 손실 복구: id-reconciliation(belief→re-mint) | 통과 · dupe 0 |
| [0027](step-0027.md) | PersistStore failover: 이중쓰기 보조(primary+backup) | 통과 · 무손실 |
| [0028](step-0028.md) | PersistStore N-replica+quorum: 생존 union 복구 | 통과 · 생존3 union==base |
| [0029](step-0029.md) | PersistStore quorum 쓰기 ack: W 정족수 durable | 통과 · durSeq T-1 |
| [0030](step-0030.md) | 정리: 박스 1개=파일 1개 분할 + engine 승격(verify-kit)+닫기 게이트 | OK |
| [0031](step-0031.md) | 정합성 윈도 해소(quorum-fill — W 미달 seq 재-fan-out) | 통과 |
| [0032](step-0032.md) | 윈도 해소 유계 sweep+fill retry(wfWindow K 창) | 통과 |
| [0033](step-0033.md) | 버스 동적 구독/해지(runtime unsub/sub) | 통과 · unsub@15→re-sub@18 |
| [0034](step-0034.md) | 버스 failover(crash→재협상·진실원천=소비자) | 통과 · crash@12→재협상 |
| [0035](step-0035.md) | 정리: cluster.js 박스-부품 4분할(45KB) | 통과 |
| [0036](step-0036.md) | 버스 failover 결과 무손실(producer replay) | 통과 |
| [0037](step-0037.md) | 버스 failover 요청 무손실(gateway replay+dedup) | 통과 |
| [0038](step-0038.md) | 정리: topology.js 박스-부품 분할(31KB) | OK |
| [0039](step-0039.md) | 버스 replay 버퍼 유계화(busWindow 슬라이딩 K 창) | 통과 · desync 0 |
| [0040](step-0040.md) | 요청 replay 버퍼 자기조정(busAck — reqId ack→워터마크) | OK |
| [0041](step-0041.md) | 결과 replay 버퍼 자기조정(busOutAck — outSeq ack) | 통과 · desync 0 |
| [0042](step-0042.md) | seenReqs dedup 유계화(busSeenBound — inAcked 워터마크) | 통과 · peak 60→24 |
| [0043](step-0043.md) | 정리: svc-inventory.js 박스-부품 3분할(34KB) | 통과 |
| [0044](step-0044.md) | 다중 소비자 min-워터마크(busMinWm — 결과 버퍼=소비자 frontier 최소) | 통과 |
| [0045](step-0045.md) | 소비자 lease/축출(busConsumerLease — 침묵 길이로 죽은 소비자 축출) | 통과 · ON 유계 |
| [0046](step-0046.md) | 게이트웨이 producer 네임스페이스(busProducerNs — (producer,reqId) 복합키) | 통과 · ON Δ5 |
| [0047](step-0047.md) | per-producer seen 워터마크(busSeenNs — producer 별 가지치기) | 통과 · 유계 |
| [0048](step-0048.md) | 소비자 lease lifecycle(busLeaseLife — never-ack 축출·재admission 가역) | 통과 · readm 1 |
| [0049](step-0049.md) | 단일 살아있는 소스 src/ 전환(복사 전진 폐기·기능 0·reg 0) | OK · src=baseline=0048 |
| [0050](step-0050.md) | 적응형 leaseSpan(busLeaseAdapt — 축출 임계를 ack cadence 로 self-size) | 통과 · 적응 ev=1 |
| [0051](step-0051.md) | 시작 cadence prior(busLeaseGrace — 적응형 lease bootstrap floor) | 통과 · grace ev=0 |
| [0052](step-0052.md) | 윈도 cadence(busCadenceWindow — 추정=최근 K gap max) | 통과 · stall 후 ON 0 |
| [0053](step-0053.md) | 정리: 트랜잭션 onMsg→svc-inventory-txn.js 추출(31.9→25.5KB) | 통과 · spine 53 |
| [0054](step-0054.md) | lease 생애 관측(busLeaseAudit — 축출/재admission→audit) | 통과 · 전이 관측 |
| [0055](step-0055.md) | lease 생애 반응(busLeasePresence — lease→consumerDown) | 통과 |
| [0056](step-0056.md) | 프레즌스 반응(self-healing·busPresenceRecover — recover→재구독) | 통과 |
| [0057](step-0057.md) | 치유 확인 고리(recoverAck — 재구독하며 orch 회신) | 통과 · sent==acks==1 |
| [0058](step-0058.md) | 미확인 명령 재시도(recoverRetry — timeout 뒤 재발신) | 통과 |
| [0059](step-0059.md) | 재시도 상한(recoverMaxRetries — permanentDown 포기) | 통과 |
| [0060](step-0060.md) | 프레즌스 발행(presencePublish — down/up/permanent→audit) | 통과 |
| [0061](step-0061.md) | 대체 소비자 자동 활성화(spawnReplace — standby→'permanent' 활성화) | 통과 |
| [0062](step-0062.md) | 대체 소비자 late-join recon(spawnReconstruct — 쓰기 저널 복원) | 통과 |
| [0063](step-0063.md) | 프레즌스 모니터(presenceMonitor — svc.presence→건강 상태 기계) | 통과 |
| [0064](step-0064.md) | 전용 프레즌스 박스 분리(presenceBox — orch SSOT+발행→PresenceService) | 통과 · orch pub 0 |
| [0065](step-0065.md) | 프레즌스 보고 버스화(presenceReportBus — svc.presence.report) | 통과 |
| [0066](step-0066.md) | 프레즌스 shadow 복제(presenceShadow — 같은 보고로 그림자) | 통과 · shadow==primary |
| [0067](step-0067.md) | 프레즌스 failover 승격(presencePromote — crash→standby promote) | 통과 |
| [0068](step-0068.md) | 프레즌스 사망 자율 감지(presenceLease — hb 침묵→자기 승격) | 통과 |
| [0069](step-0069.md) | 프레즌스 SSOT 질의(presenceQuery→presenceReply·pull) | 통과 · 4/4 |
| [0070](step-0070.md) | failover 중 질의 연속성(presenceAnnounce — active→재타깃) | 통과 · 2/2 |
| [0071](step-0071.md) | 귓속말 라우터(whisperRouter — 질의→up 전달/permanent 반송) | 통과 |
| [0072](step-0072.md) | 귓속말 라우터 failover(whisperFailover — 승격 공지→queryAddr 재타깃) | 통과 · 사망 후 routed 1 |
| [0073](step-0073.md) | 파티 라우터(1:N 팬아웃 — 멤버마다 질의→부분 전달) | 통과 |
| [0074](step-0074.md) | 재타깃 윈도 질의 재시도(whisperRetry — 보류 질의 재발신) | 통과 · ON pending 0 |
| [0075](step-0075.md) | 파티 멤버십 SSOT(partyService — 멤버십⟂라우팅·2단) | 통과 · resolved 3 |
| [0076](step-0076.md) | 전달 영수증(whisperReceipt — Mailbox whisperAck→delivered) | 통과 |
| [0077](step-0077.md) | 전달 손실 재시도(whisperDeliverRetry — deliverTimeout 재발신) | 통과 |
| [0078](step-0078.md) | 전달 재시도 상한(deliverMaxRetries — tries≥상한 포기) | 통과 |
| [0079](step-0079.md) | 전달 포기 통지(deliverNotify — 포기 시 deliveryFailed 회신) | 통과 |
| [0080](step-0080.md) | 수신측 dedup(deliverDedup — Mailbox seq 기억·exactly-once) | 통과 |
| [0081](step-0081.md) | dedup seen 유계화(deliverDedupBound — 워터마크+희소 집합 O(gap)) | 통과 |
| [0082](step-0082.md) | 전달 실패 발행(failedPublish — 포기 시 svc.whisper.failed·audit) | 통과 · ON pub/audit 1 |
| [0083](step-0083.md) | 파티 1:N 영수증 집계(partyReceipt — partyId 별 {members,routed,bounced}) | 통과 · ON {3,2,1} |
| [0084](step-0084.md) | 증분 가입/탈퇴+변경 발행(partyChange — Join/Leave·svc.party.changed) | 통과 · ON 2 |
| [0085](step-0085.md) | 파티 멤버십 영속·failover(partyPersist — 변경 저널 replay·crash→recon) | 통과 · recon [b,c] |
| [0086](step-0086.md) | 파티 저널 스냅샷 압축(partySnapshot — 스냅샷+저널 가지치기·tail replay) | 통과 · tail 2 |
| [0087](step-0087.md) | 전달 수명주기 관측(deliveredPublish — whisperAck→svc.whisper.delivered) | 통과 · ON 1 |
| [0088](step-0088.md) | 파티 ack 집계(partyAckTally — whisperAck→acked=delivered==routed) | 통과 · ON acked |
| [0089](step-0089.md) | producer epoch 워터마크(epochKeyed — restart epoch++·(prod,epoch) 키) | 통과 |
| [0090](step-0090.md) | epoch 워터마크 유계화(epochBound — 높은 epoch→낮은 가지치기) | 통과 |
| [0091](step-0091.md) | 옛 epoch grace 유예(deliverEpochGrace — 최근 N 닫힌 epoch 유예) | 통과 · spine 91 |
| [0092](step-0092.md) | 파티 ack 타임아웃 포기(partyAckGiveup — 멤버 포기→파티 failed 종결) | 통과 · spine 92 |
| [0093](step-0093.md) | 파티 incomplete 발행(partyIncompletePublish — svc.party.incomplete) | 통과 · spine 93 |
| [0094](step-0094.md) | 정리: svc-whisper 박스-부품 분할(core/handlers/entry) | OK · 33→12/10/1KB·spine 94 |
| [0095](step-0095.md) | 파티 complete 발행(partyCompletePublish — svc.party.complete) | 통과 · spine 95 |
| [0096](step-0096.md) | 멤버별 Mailbox 토폴로지(mailbox2 — 둘째 수신함·파티원마다 ack) | 통과 · spine 96 |
| [0097](step-0097.md) | 귓속말 반송 발행(bouncePublish — svc.whisper.bounced) | 통과 · spine 97 |
| [0098](step-0098.md) | 정리: topo-build 박스-부품 분할(topo-actors.js·기능 0) | OK · 32→28.5/4.9KB·spine 98 |
| [0099](step-0099.md) | Mailbox inbox 유계화(inboxBound — inbox 최근 K cap) | 통과 · spine 99 |
| [0100](step-0100.md) | Mailbox inbox 드레인(drain — 소유자 읽음 소비·무손실) | 통과 · spine 100 |
| [0101](step-0101.md) | 읽음 확인 영수증(drainAck — checkout→ackDrain·재드레인 무손실) | 통과 · spine 101 |
| [0102](step-0102.md) | 미확인 체크아웃 유계화(checkoutBound — checkout K cap) | 통과 · spine 102 |
| [0103](step-0103.md) | 읽음 소비 발행(drainedPublish — ackDrain svc.mailbox.drained) | 통과 · spine 103 |
| [0104](step-0104.md) | 수신함 손실 발행(lossPublish — overflow svc.mailbox.overflowed) | 통과 · spine 104 |
| [0105](step-0105.md) | active 공지 epoch 펜싱(announceEpoch — 낡은 메아리 거부) | 통과 · ON stale 1·spine 105 |
| [0106](step-0106.md) | wrouter 공지 epoch 펜싱(0105 라우터 판) | 통과 · ON stale 1·spine 106 |
| [0107](step-0107.md) | 거래소 서비스 분리(ExchangeService — escrow 쌍 거래·존 넘는 거래 첫 박스) | 통과 · listed4/sold2·spine 107 |
| [0108](step-0108.md) | 거래소 체결 발행(exchangePublish — svc.exchange.sold) | 통과 · ON pub 2·spine 108 |
| [0109](step-0109.md) | 거래소 영속·failover(exchangePersist — op 저널 replay) | 통과 · recon==before·spine 109 |
| [0110](step-0110.md) | 거래소 저널 스냅샷 압축(exchangeSnapshot — snapshot+tail) | 통과 · tail 1·spine 110 |
| [0111](step-0111.md) | 거래소 취소 발행(cancelPublish — svc.exchange.cancelled) | 통과 · ON pub 1·spine 111 |
| [0112](step-0112.md) | 거래소 시세 피드 읽기 모델(marketFeed — sold+cancelled 구독→item별 시세) | 통과 · spine 112 |
| [0113](step-0113.md) | 시세 피드 영속·late-join(marketReconstruct — op 저널 replay 로 시세 복원) | 통과 · spine 113 |
| [0114](step-0114.md) | 매물 만료 TTL(exchExpiry — now−listedAt ≥ ttl 자동 회수·종결 expired) | 통과 · expired1·spine 114 |
| [0115](step-0115.md) | 매물 만료 발행(expirePublish — svc.exchange.expired·수명주기 3종) | 통과 · ON pub 1·spine 115 |
| [0116](step-0116.md) | 시세 피드 만료 반영(MarketFeed svc.exchange.expired 구독·수명주기 3종) | 통과 · spine 116 |
| [0117](step-0117.md) | 거래소↔가방 list 인출(exchInventory leg1 — escrow 가방 원장 실체화) | 통과 · spine 117 |
| [0118](step-0118.md) | 거래소↔가방 buy 입금(exchInventory leg2 — give escrow→buyer) | 통과 · spine 118 |
| [0119](step-0119.md) | 거래소↔가방 cancel/expire 반환(exchInventory leg3 — give escrow→seller) | 통과 · spine 119 |
| [0120](step-0120.md) | 거래소↔가방 2-서비스 보존 불변(escrowItemIds — 거래소 open ≡ 가방 escrow 소유·각 1소유자) | 통과 · open==escrow ["item4"]·minted 5·spine 120 |
| [0121](step-0121.md) | 거래소↔가방 escrow give 결과 비동기 수신(exchSaga — give 에 replyTo+cause·가방 item_result echo) | 통과 · gives 9==acked 9·fails 0·spine 121 |
| [0122](step-0122.md) | 거래소↔가방 list 인출 실패 보상(exchCompensate — give 실패→listing abort·open 롤백) | 통과 · giveFails 1·aborted ON1/OFF0·spine 122 |
| [0123](step-0123.md) | 보상 발행(abortPublish — abort→svc.exchange.aborted·audit 관측·수명주기 발행 4종 완비) | 통과 · aborted 1·abortPublished ON1/OFF0·audit ON1/OFF0·spine 123 |
| [0124](step-0124.md) | 정리: svc-exchange.js 박스-부품 분할(core/txn/entry·기능 0·헤더 압축) | OK · 32.4→12.5/7.0/1.1KB·log+ex 비트 동일·spine 124 |
| [0125](step-0125.md) | saga 미해결 give 추적+회신 손실 감지(pendingGives·gid — give 에 gid·pending add/remove) | 통과 · 정상 pending 0/peak 2·손실 pending 9/acked 0·안전 유지·spine 125 |
| [0126](step-0126.md) | saga 회신 재전송+idempotent dedup(exchRetry·sagaDedup — (replyTo,gid) 재실행 0 재회신) | 통과 · dedupON pending 0/안전·OFF open[]!=escrow·spine 126 |
| [0127](step-0127.md) | saga dedup 유계화(sagaDedupBound·saga_done — ack 시 prune 통보) | 통과 · bound ON sagaResults 0/dones 9·spine 127 |
| [0128](step-0128.md) | saga 회계 정합 불변(sagaConsistent — gives==acked+pending·acked==oks+fails) | 통과 · 3체제 true·spine 128 |
| [0129](step-0129.md) | saga 자동 재전송(autoRetry — exchSweep 피기백·주기 타임아웃 재전송) | 통과 · autoON retries 2/pending 0·OFF pending 1·spine 129 |
| [0130](step-0130.md) | 거래소 give↔가방 transfers capstone(escrowXfers — 요청 회계 ≡ 실행 회계) | 통과 · giveOks==escrowXfers==transfers 9·3정합층·spine 130 |
| [0131](step-0131.md) | saga 재시도 상한(sagaMaxRetries — autoRetry/exchRetry gid 당 N회·포기 abort 아님) | 통과 · cap ON retries 2/abandoned 1·OFF 4 발산·open==escrow 안전·sagaConsistent·spine 131 |
| [0132](step-0132.md) | saga 포기 발행(abandonPublish — svc.exchange.saga_abandoned·발행 5종 완비) | 통과 · ON pub 1==abandoned 1·audit saw 1·OFF 0·안전·spine 132 |
| [0133](step-0133.md) | 정리: topo-build 구독 테이블 분할(topo-subs.js·buildSubs·기능 0) | OK · 33.1→25.5KB·log/bus/audit/subs src==base·spine 133 |
