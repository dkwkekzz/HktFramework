# STATE — 살아있는 현재

> "지금 어디까지 왔고 다음은 무엇인가"의 **단일 진실 원천(SSOT)**.
> 큰 목표·규칙은 [CLAUDE.md](CLAUDE.md) · 척추(인프라 큰 그림)는 [SPINE.md](SPINE.md) · 각 step 상세 기록은 `step-NNNN.md`.
>
> **구조 규칙(에이전트 효율 — 토큰이 step 수에 비례해 터지지 않게 *강제*)**: 이 파일은 *고정 크기 대시보드*다. §1~6은 step을 닫을 때마다 **덮어쓴다(rewrite)** — 누적하지 않는다. 오직 §7 INDEX만 **literal 1줄** append(`step | 조각 | 통과+핵심수치 1개` — *문단 금지*). 발견/한계의 *전문*은 STATE가 아니라 `step-NNNN.md`에 산다. **세 가지 누적 함정 금지**: ① §5 에서 큰 그림 진척을 step별로 *재나열*하지 말 것 — 현재 마커 + 핵심 step 목록만 ② §3 에서 ✅해소된 격차를 전문 보존하지 말 것 — *한 줄로 떨어뜨린다* ③ §4 는 *여러 step 이 반복 참조하는 불변*만. 닫힌 step 의 발견·한계 전문은 각 `step-NNNN.md`(역사의 SSOT), 1줄 요약은 §7 INDEX. 마커: ✅해소 🟡부분 🔴열림(최우선) ⬜백로그 🔧노브.

---

## 1. NOW

- **닫힌 step**: [step-0164](step-0164.md) — **아이템 우편 2-서비스 보존**(mailCustodyItems): 보유 우편 아이템 집합 ≡ 가방 'mailcustody' 소유(거래소 0120 open≡escrow 의 우편 판). 세 leg 가 in-transit 아이템을 보유 우편과 일치(아이템은 발신자/custody/수령자 중 한 곳에만·보존). 닿는 박스: svc-mail.
- **한 줄 상태**: reg ALL OK(미호출=0163 비트 동일)·exmlinv4: mailCustodyItems [item2]==가방 mailcustody [item2]·합치·spine 통과.
- **다음**: §2 — 아이템 우편 saga 신뢰 전달(0165 give 회신·0166 실패 보상·0167 회신 손실 재전송·0168 dedup·0169 회계·0170 교차 정합 capstone).

---

## 2. NEXT — step-0044 후 가설 (후보, 권위는 이 절)

**우편(Mail) 서비스 arc 완성(0142~0150 분리/수령/발행/영속/압축/읽음발행/만료TTL/만료발행/회계 capstone✅) — SPINE §2 우편 박스 = 거래소 arc(0107~0140)와 동형 골격. 다음 arc 후보: *발행 게이트 통합*(거래소+우편 발행 일원화)·*아이템 우편*(가방 연동 give·만료 반환·2-서비스 보존)·*길드 서비스*·*비동기 결정론*(🔴). 🔧 topo-run 27KB·svc-mail ~6KB. 🔎 0131~0140·0141~0150 묶음 리뷰 적기(`infra-review`).**

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
| 🟡 | **거래소 ✅(0107~0140)·우편 ✅(0142~0160)·랭킹/읽기모델 ✅·길드 ⬜** | 서비스 | 0107~0140 거래소(escrow·발행 7종·saga liveness)·0142~0160 우편(메시지 0142~0150·미읽음 배지 MailFeed 0151~0156·아이템 첨부 0157~0160). 길드·가방 연동 아이템 우편(give/반환)·발행 게이트 통합 후속. |
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
| 3 | 게임 서비스 | 가방 · 채팅 · 길드 · 거래소 · 우편 · 랭킹 | 🟡 가방/채팅/ranking/읽기모델(0014~0022)→write-behind/quorum(0023~0032)→대체 소비자(0061~0063). **귓속말/파티 라우팅 wrouter(0071~0106)**: 라우팅·failover·1:N·멤버십·전달 신뢰·파티 집계/영속·epoch 펜싱·수신함 유계/드레인. **거래소 arc 0107~0140**: escrow 쌍 거래·발행 7종·영속/압축·시세 피드·만료 TTL·가방 give 3leg·2-서비스 보존·saga liveness(0121~0140: 자율 복구·네 정합층 완성·전문 §7). 정리 0124/0133. **우편 arc 0142~0160**: 메시지(0142~0150 입금/수령/발행 3종/영속·압축/만료 TTL/회계 capstone)·미읽음 배지 읽기 모델 MailFeed(0151~0156 입금/읽음/만료 반영·영속 late-join·회계 capstone·질의)·아이템 첨부(0157~0160 첨부/수령/만료/itemConsistent). 신성한 tick·권위 0. 가방 연동 give/반환·발행 게이트·길드 후속 |
| 4 | 버스 | 이벤트 버스 | 🟡 0004 substrate→0012 토픽 pub/sub→0016 ServiceBus→0019 발신 소비자→0033 동적 구독→0034 failover→0036/0037 결과/요청 무손실→0039~0042 replay 유계·ack 자기조정→0044 min-워터마크→0045~0052 lease/ns/lifecycle/적응형→0054 관측. 분산·per-producer ack·라우팅 영속 후속 |
| 5 | 코디네이션 | 세션/프레즌스 · 오케스트레이터 | 🟡 0001 레지스트리+0009 Orchestrator+0010~0013 broker(lockstep→TCP→버스 허브·kill·split-brain 0). 0054~0063 lease→프레즌스 SSOT→self-healing. 프레즌스 박스(0064~0070)·0105/0106 공지 epoch 펜싱. broker 물리 분산·진짜 비동기 후속 |
| 6 | 데이터 | 캐시 · DB · write-behind | 🟡 0017 PersistStore 첫 박스(효과 저널·write-behind·kill→replay)→0018 스냅샷 압축→0020 읽기모델 복구원→0021~0022 채팅 영속/스냅샷→0023~0026 홉 신뢰→0027~0029 failover/N-replica quorum→0031~0032 윈도+유계 K→0062 대체 소비자 recon. 증분 스냅샷·fsync·월드/버스 영속 후속 |

---

## 6. 빠른 참조

- 큰 그림·계층 책임·씨앗 매핑·척추 5항: [SPINE.md](SPINE.md) · 도구·스택·데이터 3분할: [TOOLS.md](TOOLS.md)
- **의외의 발견 / 정직한 한계 전문**: 각 `step-NNNN.md`(STATE 중복 안 함 — §3·§4가 load-bearing 요약).

---

## 7. INDEX — 시리즈 검증 현황 (유일하게 append, 1행/step)

| step | 더한 한 조각 | 결과 (회귀 0 전제) |
|---|---|---|
| [0001](step-0001.md) | 최소 골격 토폴로지 (4박스+세션 계약) | 통과 · 은닉 0/47 |
| [0002](step-0002.md) | 존 결정론 복제 (추종자 존+입력 미러 탭) | 통과 · 0/60 desync |
| [0003](step-0003.md) | Sim 인터페이스 동결 (ISimCore v1·2구현) | 통과 · 구체 참조 0 |
| [0004](step-0004.md) | 현실 전송(지연·손실·재정렬)+논리-tick | 통과 · desync 597→0 |
| [0005](step-0005.md) | 멀티 클라+AOI 브로드캐스트 (EntityZone) | 통과 · 절감 51~68% |
| [0006](step-0006.md) | 공간 분할+존 간 권위 핸드오프 (EntityZone ×2) | 통과 · 소유자=1 |
| [0007](step-0007.md) | 증분 AOI(enter/exit/update) | 통과 · 증분≡전체 288 |
| [0008](step-0008.md) | 전송 열화 아래 핸드오프+반응적 복원(ack/NAK/keyframe) | 통과 · 손실 0~30%·desync 0 |
| [0009](step-0009.md) | 추종자 승격 failover(shadow 복제·lease 감지) | 통과 · 사망→소유자 1 |
| [0010](step-0010.md) | 프로세스 경계 현실화(실 프로세스/IPC·broker) | 통과 |
| [0011](step-0011.md) | 실 TCP 소켓 전송(IPC→TCP·프레이밍) | 통과 |
| [0012](step-0012.md) | 버스 분산+열화 내성(토픽 pub/sub·분단·펜싱) | 통과 · split-brain 0 |
| [0013](step-0013.md) | 진짜 프로세스 kill 아래 failover(child.kill·epoch 펜싱) | 통과 · split-brain 0 |
| [0014](step-0014.md) | 가방 서비스 분리(아이템 원장 존 tick 밖·단일 소유·쌍 거래) | 통과 |
| [0015](step-0015.md) | 채팅 서비스 분리(채널 팬아웃·구독 라우팅·지역 격리) | 통과 · 누설 0 |
| [0016](step-0016.md) | 이벤트 버스 서비스 층(발행/구독·무수정 소비자) | 통과 |
| [0017](step-0017.md) | 가방 failover·영속(원장 영속 저널 재구성·event sourcing) | 통과 |
| [0018](step-0018.md) | 가방 저널 스냅샷 압축(intent 로그+주기 스냅샷) | 통과 · 92%↓ |
| [0019](step-0019.md) | 발신하는 둘째 소비자(RankingService·CQRS) | 통과 |
| [0020](step-0020.md) | 읽기 모델 영속·late-join(crash→저널 recon) | 통과 |
| [0021](step-0021.md) | 채팅 영속·failover(crash→커맨드 로그 replay) | 통과 |
| [0022](step-0022.md) | 채팅 커맨드 로그 스냅샷 압축(스냅샷+tail) | 통과 |
| [0023](step-0023.md) | 저널 홉 신뢰 전달(write-behind 홉 갭 NAK+재전송) | 통과 |
| [0024](step-0024.md) | 저널 홉 tail 손실 감지(heartbeat→tail NAK) | 통과 |
| [0025](step-0025.md) | in-flight give 손실 복구(give-resend→belief 재수렴) | 통과 |
| [0026](step-0026.md) | in-flight mint 손실 복구: id-reconciliation(re-mint) | 통과 · dupe 0 |
| [0027](step-0027.md) | PersistStore failover: 이중쓰기 보조(primary+backup) | 통과 |
| [0028](step-0028.md) | PersistStore N-replica+quorum: 생존 union 복구 | 통과 · union==base |
| [0029](step-0029.md) | PersistStore quorum 쓰기 ack: W 정족수 durable | 통과 |
| [0030](step-0030.md) | 정리: 박스 1개=파일 1개 분할 + engine 승격(verify-kit) | OK |
| [0031](step-0031.md) | 정합성 윈도 해소(quorum-fill) | 통과 |
| [0032](step-0032.md) | 윈도 해소 유계 sweep+fill retry(wfWindow K 창) | 통과 |
| [0033](step-0033.md) | 버스 동적 구독/해지(runtime unsub/sub) | 통과 |
| [0034](step-0034.md) | 버스 failover(crash→재협상·진실원천=소비자) | 통과 |
| [0035](step-0035.md) | 정리: cluster.js 박스-부품 4분할(45KB) | 통과 |
| [0036](step-0036.md) | 버스 failover 결과 무손실(producer replay) | 통과 |
| [0037](step-0037.md) | 버스 failover 요청 무손실(gateway replay) | 통과 |
| [0038](step-0038.md) | 정리: topology.js 박스-부품 분할(31KB) | OK |
| [0039](step-0039.md) | 버스 replay 버퍼 유계화(busWindow 슬라이딩 K 창) | 통과 |
| [0040](step-0040.md) | 요청 replay 버퍼 자기조정(busAck) | OK |
| [0041](step-0041.md) | 결과 replay 버퍼 자기조정(busOutAck) | 통과 |
| [0042](step-0042.md) | seenReqs dedup 유계화(busSeenBound) | 통과 |
| [0043](step-0043.md) | 정리: svc-inventory.js 박스-부품 3분할(34KB) | 통과 |
| [0044](step-0044.md) | 다중 소비자 min-워터마크(busMinWm) | 통과 |
| [0045](step-0045.md) | 소비자 lease/축출(busConsumerLease) | 통과 |
| [0046](step-0046.md) | 게이트웨이 producer 네임스페이스(busProducerNs — (producer,reqId) 복합키) | 통과 |
| [0047](step-0047.md) | per-producer seen 워터마크(busSeenNs) | 통과 |
| [0048](step-0048.md) | 소비자 lease lifecycle(busLeaseLife) | 통과 · readm 1 |
| [0049](step-0049.md) | 단일 살아있는 소스 src/ 전환(복사 전진 폐기·기능 0·reg 0) | OK · src=baseline=0048 |
| [0050](step-0050.md) | 적응형 leaseSpan(busLeaseAdapt) | 통과 |
| [0051](step-0051.md) | 시작 cadence prior(busLeaseGrace) | 통과 |
| [0052](step-0052.md) | 윈도 cadence(busCadenceWindow) | 통과 |
| [0053](step-0053.md) | 정리: 트랜잭션 onMsg→svc-inventory-txn.js 추출(31.9→25.5KB) | 통과 |
| [0054](step-0054.md) | lease 생애 관측(busLeaseAudit) | 통과 |
| [0055](step-0055.md) | lease 생애 반응(busLeasePresence) | 통과 |
| [0056](step-0056.md) | 프레즌스 self-healing(busPresenceRecover) | 통과 |
| [0057](step-0057.md) | 치유 확인 고리(recoverAck) | 통과 |
| [0058](step-0058.md) | 미확인 명령 재시도(recoverRetry) | 통과 |
| [0059](step-0059.md) | 재시도 상한(recoverMaxRetries) | 통과 |
| [0060](step-0060.md) | 프레즌스 발행(presencePublish) | 통과 |
| [0061](step-0061.md) | 대체 소비자 자동 활성화(spawnReplace) | 통과 |
| [0062](step-0062.md) | 대체 소비자 late-join recon(spawnReconstruct) | 통과 |
| [0063](step-0063.md) | 프레즌스 모니터(presenceMonitor) | 통과 |
| [0064](step-0064.md) | 전용 프레즌스 박스 분리(presenceBox) | 통과 |
| [0065](step-0065.md) | 프레즌스 보고 버스화(presenceReportBus) | 통과 |
| [0066](step-0066.md) | 프레즌스 shadow 복제(presenceShadow) | 통과 |
| [0067](step-0067.md) | 프레즌스 failover 승격(presencePromote) | 통과 |
| [0068](step-0068.md) | 프레즌스 사망 자율 감지(presenceLease) | 통과 |
| [0069](step-0069.md) | 프레즌스 SSOT 질의(presenceQuery→presenceReply) | 통과 |
| [0070](step-0070.md) | failover 중 질의 연속성(presenceAnnounce) | 통과 |
| [0071](step-0071.md) | 귓속말 라우터(whisperRouter) | 통과 |
| [0072](step-0072.md) | 귓속말 라우터 failover(whisperFailover) | 통과 |
| [0073](step-0073.md) | 파티 라우터(1:N 팬아웃) | 통과 |
| [0074](step-0074.md) | 재타깃 윈도 질의 재시도(whisperRetry) | 통과 |
| [0075](step-0075.md) | 파티 멤버십 SSOT(partyService) | 통과 |
| [0076](step-0076.md) | 전달 영수증(whisperReceipt) | 통과 |
| [0077](step-0077.md) | 전달 손실 재시도(whisperDeliverRetry) | 통과 |
| [0078](step-0078.md) | 전달 재시도 상한(deliverMaxRetries) | 통과 |
| [0079](step-0079.md) | 전달 포기 통지(deliverNotify) | 통과 |
| [0080](step-0080.md) | 수신측 dedup(deliverDedup) | 통과 |
| [0081](step-0081.md) | dedup seen 유계화(deliverDedupBound) | 통과 |
| [0082](step-0082.md) | 전달 실패 발행(failedPublish) | 통과 |
| [0083](step-0083.md) | 파티 1:N 영수증 집계(partyReceipt) | 통과 |
| [0084](step-0084.md) | 증분 가입/탈퇴+변경 발행(partyChange) | 통과 |
| [0085](step-0085.md) | 파티 멤버십 영속·failover(partyPersist) | 통과 |
| [0086](step-0086.md) | 파티 저널 스냅샷 압축(partySnapshot) | 통과 |
| [0087](step-0087.md) | 전달 수명주기 관측(deliveredPublish) | 통과 |
| [0088](step-0088.md) | 파티 ack 집계(partyAckTally) | 통과 |
| [0089](step-0089.md) | producer epoch 워터마크(epochKeyed — restart epoch++·(prod,epoch) 키) | 통과 |
| [0090](step-0090.md) | epoch 워터마크 유계화(epochBound) | 통과 |
| [0091](step-0091.md) | 옛 epoch grace 유예(deliverEpochGrace) | 통과 |
| [0092](step-0092.md) | 파티 ack 타임아웃 포기(partyAckGiveup) | 통과 |
| [0093](step-0093.md) | 파티 incomplete 발행(partyIncompletePublish) | 통과 |
| [0094](step-0094.md) | 정리: svc-whisper 박스-부품 분할(core/handlers/entry) | OK |
| [0095](step-0095.md) | 파티 complete 발행(partyCompletePublish) | 통과 |
| [0096](step-0096.md) | 멤버별 Mailbox 토폴로지(mailbox2) | 통과 |
| [0097](step-0097.md) | 귓속말 반송 발행(bouncePublish) | 통과 |
| [0098](step-0098.md) | 정리: topo-build 박스-부품 분할(topo-actors.js) | OK |
| [0099](step-0099.md) | Mailbox inbox 유계화(inboxBound) | 통과 |
| [0100](step-0100.md) | Mailbox inbox 드레인(drain) | 통과 |
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
| [0112](step-0112.md) | 거래소 시세 피드 읽기 모델(marketFeed) | 통과 |
| [0113](step-0113.md) | 시세 피드 영속·late-join(marketReconstruct) | 통과 |
| [0114](step-0114.md) | 매물 만료 TTL(exchExpiry) | 통과 · expired 1 |
| [0115](step-0115.md) | 매물 만료 발행(expirePublish) | 통과 · ON pub 1 |
| [0116](step-0116.md) | 시세 피드 만료 반영(MarketFeed svc.exchange.expired 구독) | 통과 |
| [0117](step-0117.md) | 거래소↔가방 list 인출(exchInventory leg1) | 통과 |
| [0118](step-0118.md) | 거래소↔가방 buy 입금(exchInventory leg2) | 통과 |
| [0119](step-0119.md) | 거래소↔가방 cancel/expire 반환(exchInventory leg3) | 통과 |
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
| [0135](step-0135.md) | saga 재admission 발행(readmitPublish) | 통과 · pub 1==readmit 1·발행 6종 |
| [0136](step-0136.md) | saga 재admission 자동 트리거(autoReadmit) | 통과 · readmit 1/pending 0 |
| [0137](step-0137.md) | saga 재admission 횟수 상한(readmitMax) | 통과 · readmit 2/permFailed 1 |
| [0138](step-0138.md) | saga 영구 실패 발행(failPublish) | 통과 · pub 1==permFailed 1·발행 7종 |
| [0139](step-0139.md) | 가방 회복 자기 공지(invUpPublish) | 통과 · invUpPub 1→readmit 1·실 버스 체인 |
| [0140](step-0140.md) | saga liveness 회계 정합 capstone(sagaLiveConsistent) | 통과 · 4체제 true·네 정합층 완성 |
| [0141](step-0141.md) | 정리: topology.js run 드라이버→topo-run.js 분리(quorumMergeJournals·run·runMulti·기능 0) | OK · 31.5→~1.0KB 진입점·reg 0 |
| [0142](step-0142.md) | 우편(Mail) 서비스 분리(MailService) | 통과 · sent 4·held 3/1·멱등·결정론 |
| [0143](step-0143.md) | 우편 수령(mailFetch) | 통과 · h1 fetched 2·재수령 0·accountConsistent |
| [0144](step-0144.md) | 우편 입금 발행(mailSentPublish) | 통과 · published 3==audit 3==sent·비-침습·OFF 0 |
| [0145](step-0145.md) | 우편 영속·failover(mailPersist) | 통과 · reconstruct==pre digest·OFF 소실·accountConsistent |
| [0146](step-0146.md) | 우편 저널 스냅샷 압축(mailSnapshot) | 통과 · tail 2<full 8·3자 비트동일·accountConsistent |
| [0147](step-0147.md) | 우편 읽음 확인 발행(mailReadPublish) | 통과 · readPublished 3==audit 3==fetched·비-침습·OFF 0 |
| [0148](step-0148.md) | 우편 만료 TTL(mailTtl) | 통과 · expired 1·accountConsistent·reconstruct==live·ttl0 만료0 |
| [0149](step-0149.md) | 우편 만료 발행(mailExpirePublish) | 통과 · expirePublished 1==audit 1==expired·3종 동시·OFF 0 |
| [0150](step-0150.md) | 우편 회계 정합 capstone(mailConsistent) | 통과 · 4체제 true·분할 0/3/0·0/0/3·1/2/1·crash 복구 정합 |
| [0151](step-0151.md) | 우편 미읽음 배지 읽기 모델(mailFeed·MailFeed) | 통과 · unread 3/2·total 5==sent |
| [0152](step-0152.md) | MailFeed 읽음 반영(mailFeedRead) | 통과 · h1 0/3·total 2·unread==sent−read |
| [0153](step-0153.md) | MailFeed 만료 반영(mailFeedExpire) | 통과 · h2 0/0/2·unread==sent−read−expired |
| [0154](step-0154.md) | MailFeed 영속·late-join(reconstruct·우편 op 저널 replay 로 배지 복원) | 통과 · crash→reconstruct digest==라이브 |
| [0155](step-0155.md) | MailFeed 회계 정합 capstone(feedConsistent·unread==sent−read−expired·MailFeed arc 닫기) | 통과 · 4체제 true·totalUnread==totalHeld |
| [0156](step-0156.md) | 미읽음 배지 질의 인터페이스(mailUnreadQuery→mailUnreadReply·request/reply over net) | 통과 · queriesRx 2·repliesSent 2·회신==배지 |
| [0157](step-0157.md) | 아이템 첨부 우편(mailItem·mailSend item → 우편 1통이 아이템 1개 보유·거래소 escrow 의 우편 판) | 통과 · sent 3·itemSent 2·itemHeld 2 |
| [0158](step-0158.md) | 아이템 우편 수령(itemFetched·보유→수령 아이템 이동·itemHeld→itemFetched) | 통과 · itemSent 3·itemHeld 1·itemFetched 2 |
| [0159](step-0159.md) | 아이템 우편 만료 회수(itemExpired·mailSweep 만료 시 아이템 회수·itemHeld→itemExpired) | 통과 · itemSent 3·held/fetch/exp 1/1/1 |
| [0160](step-0160.md) | 아이템 우편 회계 정합 capstone(itemConsistent·itemSent==itemHeld+itemFetched+itemExpired·아이템 우편 arc 닫기) | 통과 · 4체제 true·분할 0/2/0·0/0/2·1/1/1 |
| [0161](step-0161.md) | 아이템 우편 발신 인출 leg1(mailInv·mailSend → 발신자 가방→mailcustody give·거래소 0117 의 우편 판) | 통과 · gives 2·owner=mailcustody·발신자 잔여 0 |
| [0162](step-0162.md) | 아이템 우편 수령 입금 leg2(mailFetch → custody→수령자 가방 give·거래소 0118 의 우편 판) | 통과 · item0→h1·item1 custody 잔류·gives 3 |
| [0163](step-0163.md) | 아이템 우편 만료 반환 leg3(mailSweep 만료 → custody→발신자 가방 give·거래소 0119 의 우편 판) | 통과 · item1→x 반환·gives 4·세 leg 완비 |
| [0164](step-0164.md) | 아이템 우편 2-서비스 보존(mailCustodyItems ≡ 가방 mailcustody 소유·거래소 0120 의 우편 판) | 통과 · [item2]==[item2]·합치·보존 |
